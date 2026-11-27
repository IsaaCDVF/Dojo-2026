<?php
declare(strict_types=1);
namespace Dojo\Modulos\Pagos\Pasarela;

use Dojo\Modulos\Bitacora\Bitacora;
use Dojo\Modulos\Catalogos\Tarifas;
use Dojo\Modulos\Pagos\{Cotizador, EstadoCuenta};
use Dojo\Nucleo\{Db, ErrorApi, Folios, Peticion, Respuesta};

/**
 * Pago en línea desde la app (Mercado Pago Checkout Pro: tarjeta, OXXO, SPEI y saldo de Mercado Pago).
 *
 * 1. El responsable elige qué pagar → se crea un pago "pendiente" (metodo = pasarela, sin folio) con sus líneas,
 *    calculadas por el servidor igual que en la caja, y una preferencia en Mercado Pago → la app abre su checkout.
 * 2. Mercado Pago avisa (webhook) o la app pregunta al volver → se consulta el pago en Mercado Pago (la fuente de verdad)
 *    y se aplica: aprobado = folio y recibo; pendiente = ficha de OXXO/SPEI; rechazado = mensaje y puede reintentar.
 * 3. Si mientras tanto alguien pagó lo mismo en caja, lo repetido queda como saldo a favor (nunca se pierde dinero).
 * En modo "prueba" no se habla con Mercado Pago: la app muestra botones que simulan cada resultado.
 */
final class PagoEnLineaControlador
{
    /** Un pago en línea que todavía puede terminar: abierto hace menos de 1 h sin intento, o ficha de OXXO/SPEI vigente */
    public const ACTIVO = "p.estado = 'pendiente' AND ((pl.mp_pago_id IS NULL AND pl.creado > NOW() - INTERVAL 60 MINUTE)
                           OR (pl.mp_pago_id IS NOT NULL AND (pl.expira IS NULL OR pl.expira > NOW())))";

    public static function modo(): string
    {
        return Db::uno('SELECT modo FROM pasarela_config WHERE id = 1')['modo'] ?? 'apagado';
    }

    /** POST /api/app/pagos-en-linea {claves: ["mens:12:2026-11", ...]} → {pago_id, url, origen, total} */
    public function crear(Peticion $req): void
    {
        $cfg = Db::uno('SELECT * FROM pasarela_config WHERE id = 1');
        if (($cfg['modo'] ?? 'apagado') === 'apagado') throw new ErrorApi('El pago en línea no está activo. Paga en recepción.', 409);
        $claves = array_values(array_unique(array_map('strval', (array) ($req->cuerpo['claves'] ?? []))));
        if (!$claves) throw new ErrorApi('Elige qué quieres pagar', 422);
        $pid = (int) Db::uno('SELECT persona_id FROM usuarios WHERE id = ?', [$req->ctx['usuario_id']])['persona_id'];

        // ¿De cuál de sus cuentas son esas claves? (casi siempre tiene una sola)
        $resp = null;
        foreach (Db::todos('SELECT r.id FROM responsables_pago r WHERE r.persona_id = ?', [$pid]) as $x) {
            $adeudos = array_column(EstadoCuenta::de((int) $x['id'], null)['adeudos'], 'clave');
            if (!array_diff($claves, $adeudos)) { $resp = (int) $x['id']; break; }
        }
        if (!$resp) throw new ErrorApi('Algo de lo que elegiste ya no está pendiente o no es de tu cuenta; recarga la pantalla', 409);
        Respuesta::ok(self::iniciar($req, $cfg, $resp, $claves, null, null, 'app'), 201);
    }

    /**
     * Crea el pago pendiente y (en modo real) la preferencia de Mercado Pago. Lo usan la app y la caja (cobro con QR).
     * $propia: sucursal de quien cobra en caja (no puede cobrar cuentas de otra). $canal: app | caja.
     * @return array{pago_id: int, url: string, origen: string, total: string}
     */
    public static function iniciar(Peticion $req, array $cfg, int $responsableId, array $claves, ?int $propia, ?string $codigo, string $canal): array
    {
        $r = Db::uno('SELECT r.id, pe.nombre, pe.apellido_paterno,
                             (SELECT c.valor FROM contactos c WHERE c.persona_id = pe.id AND c.tipo = "email" LIMIT 1) email
                      FROM responsables_pago r JOIN personas pe ON pe.id = r.persona_id WHERE r.id = ?', [$responsableId]);
        if (!$r) throw new ErrorApi('Responsable no encontrado', 404);
        $r['id'] = (int) $r['id'];

        $x = Cotizador::preparar($r, $propia, $claves, [], $codigo, false);
        foreach ($x['lineas'] as $l) {
            if (!empty($l['en_linea'])) throw new ErrorApi(($canal === 'caja' ? 'Ya hay un pago en línea en proceso para ' : 'Ya tienes un pago en proceso para ') . $l['concepto'] . ($l['detalle'] ? " de {$l['detalle']}" : '') . ($canal === 'caja' ? '. Cancélalo o espera a que venza.' : '. Termínalo o espera a que venza.'), 409, ['pago_id' => $l['en_linea']['pago_id']]);
        }
        if ($x['aPagar'] <= 0) throw new ErrorApi('No hay nada que cobrar', 422);
        $origen = $cfg['modo'] === 'real' ? 'mercadopago' : 'prueba';
        $ref = bin2hex(random_bytes(16));

        $pagoId = Db::transaccion(function () use ($req, $r, $x, $origen, $ref, $canal) {
            $id = Db::insertar('INSERT INTO pagos (responsable_id, sucursal_id, folio, fecha, metodo, estado, registrado_por) VALUES (?, ?, NULL, NOW(), "pasarela", "pendiente", ?)',
                [$r['id'], $x['sucursal'], $req->ctx['usuario_id']]);
            $sol = [];
            foreach ($x['lineas'] as $i => $l) {
                $cl = $x['cot']['lineas'][$i];
                $did = Db::insertar('INSERT INTO pago_detalles (pago_id, alumno_id, concepto_id, periodo, monto_cobrado, descuento_aplicado, promocion_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [$id, $l['alumno_id'], $l['concepto_id'], $l['periodo'], $cl['importe'], $cl['descuento'], (float) $cl['descuento'] > 0 ? $x['cot']['promocion']['id'] : null]);
                if (!empty($l['solicitud_id'])) $sol[$did] = (int) $l['solicitud_id'];
            }
            Db::insertar('INSERT INTO pagos_en_linea (pago_id, referencia, origen, canal, solicitudes) VALUES (?, ?, ?, ?, ?)', [$id, $ref, $origen, $canal, $sol ? json_encode($sol) : null]);
            Bitacora::alta($req, 'pagos', $id, ['metodo' => 'pasarela', 'estado' => 'pendiente', 'total' => $x['cot']['total'], 'origen' => $origen, 'canal' => $canal], $x['sucursal']);
            return $id;
        });

        $url = "/app/pago/$pagoId";
        if ($origen === 'mercadopago') {
            try {
                $token = self::token($cfg);
                $mp = new MercadoPago($token);
                $base = rtrim((string) ($cfg['url_publica'] ?? ''), '/');
                $https = str_starts_with($base, 'https://');
                $marca = preg_replace('/\p{Mn}/u', '', \Dojo\Modulos\Sistema\MarcaControlador::datos()['nombre'] ?? 'Dojo');
                $items = [];
                foreach ($x['lineas'] as $i => $l) {
                    $cl = $x['cot']['lineas'][$i];
                    $neto = round((float) $cl['importe'] - (float) $cl['descuento'], 2);
                    $items[] = ['id' => (string) ($l['clave'] ?? $l['concepto_id']), 'title' => mb_substr($l['concepto'] . (!empty($l['detalle']) ? ' ' . $l['detalle'] : '') . (!empty($l['alumno']) ? ' · ' . $l['alumno'] : ''), 0, 120),
                                'quantity' => 1, 'unit_price' => $neto, 'currency_id' => 'MXN'];
                }
                // En mostrador solo tarjeta o saldo de Mercado Pago (una ficha de OXXO no tiene sentido si la persona está ahí)
                $medios = ['installments' => 1] + ($canal === 'caja' ? ['excluded_payment_types' => [['id' => 'ticket'], ['id' => 'atm'], ['id' => 'bank_transfer']]] : []);
                $pref = ['items' => $items, 'external_reference' => $ref, 'statement_descriptor' => mb_substr(strtoupper(preg_replace('/[^A-Za-z0-9 ]/', '', $marca)), 0, 13),
                         'payment_methods' => $medios, 'metadata' => ['pago_id' => $pagoId, 'canal' => $canal]]
                       + ($r['email'] ? ['payer' => ['email' => $r['email']]] : [])
                       // Mercado Pago descarta las direcciones http: sin https no hay regreso automático ni avisos (se le pregunta al volver)
                       + ($https && $canal === 'app' ? ['back_urls' => ['success' => "$base/app/pago/$pagoId", 'pending' => "$base/app/pago/$pagoId", 'failure' => "$base/app/pago/$pagoId"], 'auto_return' => 'approved'] : [])
                       + ($https ? ['notification_url' => "$base/api/pagos-en-linea/aviso"] : []);
                $p = $mp->crearPreferencia($pref);
                // Con credenciales de prueba (TEST-) el checkout es el de pruebas (sandbox_init_point)
                $url = (string) ((str_starts_with($token, 'TEST-') ? ($p['sandbox_init_point'] ?? null) : null) ?? $p['init_point'] ?? '');
                Db::ejecutar('UPDATE pagos_en_linea SET preferencia_id = ?, url_pago = ? WHERE pago_id = ?', [$p['id'] ?? null, $url, $pagoId]);
            } catch (ErrorApi $e) {
                Db::ejecutar('UPDATE pagos SET estado = "rechazado", codigo_respuesta = "cancelado" WHERE id = ?', [$pagoId]);
                throw $e;
            }
        } else {
            Db::ejecutar('UPDATE pagos_en_linea SET url_pago = ? WHERE pago_id = ?', [$url, $pagoId]);
        }
        return ['pago_id' => $pagoId, 'url' => $url, 'origen' => $origen, 'total' => Tarifas::aPesos($x['aPagar'])];
    }

    /** GET /api/app/pagos-en-linea/{id} — cómo va el pago (si está pendiente, le pregunta a Mercado Pago) */
    public function ver(Peticion $req): void
    {
        $pl = $this->mio($req, (int) $req->params['id']);
        self::consultar($pl, $req->ip);
        Respuesta::ok(self::estado((int) $req->params['id']));
    }

    /** Si el pago sigue pendiente en modo real, le pregunta a Mercado Pago cómo va (máximo cada 10 s) */
    public static function consultar(array $pl, ?string $ip): void
    {
        // En caja, después de una tarjeta rechazada la persona puede intentar con otra en el mismo QR: se sigue preguntando
        $sigue = $pl['estado'] === 'pendiente' || (($pl['canal'] ?? 'app') === 'caja' && $pl['estado'] === 'rechazado'
                 && ($pl['codigo_respuesta'] ?? '') !== 'cancelado' && strtotime((string) $pl['creado']) > time() - 3600);
        if ($pl['origen'] === 'mercadopago' && $sigue && self::modo() === 'real'
            && (!$pl['actualizado'] || strtotime($pl['actualizado']) < time() - 10)) {
            try {
                $mp = new MercadoPago(self::token(Db::uno('SELECT * FROM pasarela_config WHERE id = 1')));
                $pago = $pl['mp_pago_id'] ? $mp->pago($pl['mp_pago_id']) : $mp->ultimoPorReferencia($pl['referencia']);
                if ($pago) self::aplicar($pago, $ip);
                else Db::ejecutar('UPDATE pagos_en_linea SET actualizado = NOW() WHERE id = ?', [$pl['id']]);
            } catch (ErrorApi) { /* sin conexión: se muestra lo último que se sabe */ }
        }
    }

    /** POST /api/app/pagos-en-linea/{id}/prueba {resultado: aprobado|rechazado|tarjeta|oxxo|spei|pagar_ficha|vencer} — solo en modo prueba */
    public function prueba(Peticion $req): void
    {
        $pl = $this->mio($req, (int) $req->params['id']);
        self::simular($pl, (string) ($req->cuerpo['resultado'] ?? ''), $req->ip);
        Respuesta::ok(self::estado($pl['pago_id']));
    }

    /** Modo prueba: hace como si Mercado Pago contestara (lo usan la app y la caja) */
    public static function simular(array $pl, string $res, ?string $ip): void
    {
        if ($pl['origen'] !== 'prueba' || self::modo() !== 'prueba') throw new ErrorApi('Esto solo existe en modo prueba', 409);
        $total = (float) Db::uno('SELECT SUM(monto_cobrado - descuento_aplicado) t FROM pago_detalles WHERE pago_id = ?', [$pl['pago_id']])['t'];
        $base = ['id' => $pl['mp_pago_id'] ?: 'PRUEBA-' . $pl['pago_id'] . '-' . random_int(1000, 9999), 'external_reference' => $pl['referencia'], 'transaction_amount' => $total];
        $sim = match ($res) {
            'aprobado' => ['status' => 'approved', 'status_detail' => 'accredited', 'payment_type_id' => 'credit_card'],
            'rechazado' => ['status' => 'rejected', 'status_detail' => 'cc_rejected_insufficient_amount', 'payment_type_id' => 'credit_card', 'id' => 'PRUEBA-' . $pl['pago_id'] . '-' . random_int(1000, 9999)],
            'oxxo' => ['status' => 'pending', 'status_detail' => 'pending_waiting_payment', 'payment_type_id' => 'ticket', 'date_of_expiration' => date('c', strtotime('+3 days')),
                       'transaction_details' => ['external_resource_url' => "/app/pago/{$pl['pago_id']}?ficha=oxxo"]],
            'spei' => ['status' => 'pending', 'status_detail' => 'pending_waiting_transfer', 'payment_type_id' => 'bank_transfer', 'date_of_expiration' => date('c', strtotime('+2 days')),
                       'transaction_details' => ['external_resource_url' => "/app/pago/{$pl['pago_id']}?ficha=spei"]],
            'pagar_ficha' => ['status' => 'approved', 'status_detail' => 'accredited', 'payment_type_id' => $pl['medio'] ?: 'ticket'],
            'vencer' => ['status' => 'cancelled', 'status_detail' => 'expired', 'payment_type_id' => $pl['medio'] ?: 'ticket'],
            default => throw new ErrorApi('Resultado de prueba no válido', 422),
        };
        if (in_array($res, ['pagar_ficha', 'vencer'], true) && !$pl['mp_pago_id']) throw new ErrorApi('Primero genera la ficha', 409);
        self::aplicar($sim + $base, $ip);
    }

    /**
     * POST /api/pagos-en-linea/aviso (pública) — Mercado Pago avisa que cambió un pago.
     * Si hay clave secreta se valida la firma; en cualquier caso el pago se vuelve a pedir a Mercado Pago con nuestro token.
     */
    public function aviso(Peticion $req): void
    {
        $cfg = Db::uno('SELECT * FROM pasarela_config WHERE id = 1');
        $tipo = (string) ($req->query['type'] ?? $req->query['topic'] ?? $req->cuerpo['type'] ?? $req->cuerpo['topic'] ?? '');
        $dataId = (string) ($req->query['data_id'] ?? $req->query['id'] ?? $req->cuerpo['data']['id'] ?? '');   // PHP cambia "data.id" por "data_id"
        $secreto = Llaves::descifrar($cfg['webhook_secret_cifrado'] ?? null);
        if ($secreto !== null && !MercadoPago::firmaValida($_SERVER['HTTP_X_SIGNATURE'] ?? null, $_SERVER['HTTP_X_REQUEST_ID'] ?? null, $dataId, $secreto)) {
            throw new ErrorApi('Firma no válida', 401);
        }
        if ($tipo !== 'payment' || $dataId === '' || ($cfg['modo'] ?? '') !== 'real') { Respuesta::ok(['ignorado' => true]); return; }
        $pago = (new MercadoPago(self::token($cfg)))->pago($dataId);
        $hecho = self::aplicar($pago, $req->ip);
        Respuesta::ok(['aplicado' => $hecho]);
    }

    /* ------------------------------------------------------------------ */

    /**
     * Aplica lo que dice Mercado Pago (o la simulación) a nuestro pago. Se puede llamar varias veces con lo mismo.
     * @return bool si encontró el pago
     */
    public static function aplicar(array $mp, ?string $ip): bool
    {
        $ref = (string) ($mp['external_reference'] ?? '');
        $pl = Db::uno('SELECT pl.*, p.estado, p.sucursal_id, p.responsable_id, p.registrado_por FROM pagos_en_linea pl JOIN pagos p ON p.id = pl.pago_id WHERE pl.referencia = ?', [$ref]);
        if (!$pl) return false;
        $status = (string) ($mp['status'] ?? '');
        $detalle = (string) ($mp['status_detail'] ?? '');
        $ficha = $mp['transaction_details']['external_resource_url'] ?? $mp['point_of_interaction']['transaction_data']['ticket_url'] ?? null;
        $expira = !empty($mp['date_of_expiration']) ? date('Y-m-d H:i:s', strtotime((string) $mp['date_of_expiration'])) : null;
        $mpId = (string) ($mp['id'] ?? '');
        // Quién "hizo" el cambio en la bitácora: la persona que inició el pago
        $req = new Peticion('POST', '/api/pagos-en-linea/aviso', [], [], null, $ip);
        $req->ctx = ['usuario_id' => (int) $pl['registrado_por'], 'rol' => null];

        Db::transaccion(function () use ($pl, $status, $detalle, $ficha, $expira, $mpId, $mp, $req) {
            $p = Db::uno('SELECT estado FROM pagos WHERE id = ? FOR UPDATE', [$pl['pago_id']]);
            $aprobadoAntes = $p['estado'] === 'aprobado';
            // Un pago aprobado no baja a pendiente ni a rechazado (p. ej. llega tarde el aviso de un intento rechazado anterior)
            if ($aprobadoAntes && !in_array($status, ['refunded', 'charged_back'], true)) return;
            Db::ejecutar('UPDATE pagos_en_linea SET mp_pago_id = ?, medio = ?, estado_pasarela = ?, detalle_pasarela = ?, ficha_url = COALESCE(?, ficha_url), expira = COALESCE(?, expira), actualizado = NOW() WHERE id = ?',
                [$mpId ?: null, $mp['payment_type_id'] ?? null, $status, $detalle ?: null, $ficha, $expira, $pl['id']]);

            if ($status === 'approved') { self::aprobar($pl, $mp, $req); return; }
            if (in_array($status, ['pending', 'in_process', 'authorized'], true)) {
                if ($p['estado'] !== 'pendiente') Db::ejecutar('UPDATE pagos SET estado = "pendiente", codigo_respuesta = "pendiente" WHERE id = ?', [$pl['pago_id']]);
                else Db::ejecutar('UPDATE pagos SET codigo_respuesta = "pendiente" WHERE id = ?', [$pl['pago_id']]);
                return;
            }
            if (in_array($status, ['refunded', 'charged_back'], true)) {
                if (!$aprobadoAntes) return;
                Db::ejecutar('UPDATE pagos SET estado = "reembolsado" WHERE id = ?', [$pl['pago_id']]);
                Db::ejecutar('UPDATE solicitudes_examen SET pago_detalle_id = NULL WHERE pago_detalle_id IN (SELECT id FROM pago_detalles WHERE pago_id = ?)', [$pl['pago_id']]);
                Bitacora::cambio($req, 'pagos', (int) $pl['pago_id'], ['estado' => 'aprobado'], ['estado' => "reembolsado (Mercado Pago: $status)"], (int) $pl['sucursal_id']);
                return;
            }
            // rejected / cancelled
            $codigo = self::codigo($status, $detalle);
            Db::ejecutar('UPDATE pagos SET estado = "rechazado", codigo_respuesta = ? WHERE id = ?', [$codigo, $pl['pago_id']]);
            Bitacora::cambio($req, 'pagos', (int) $pl['pago_id'], ['estado' => $p['estado']], ['estado' => "rechazado ($detalle)"], (int) $pl['sucursal_id']);
        });
        return true;
    }

    /** Dentro de la transacción de aplicar(): folio, líneas y, si algo ya se había pagado por otro lado, saldo a favor */
    private static function aprobar(array $pl, array $mp, Peticion $req): void
    {
        $lineas = Db::todos('SELECT d.id, d.alumno_id, d.concepto_id, d.periodo, d.monto_cobrado - d.descuento_aplicado neto, c.tipo
                             FROM pago_detalles d JOIN conceptos c ON c.id = d.concepto_id WHERE d.pago_id = ?', [$pl['pago_id']]);
        $total = array_sum(array_map(fn($l) => Tarifas::aCentavos($l['neto']), $lineas));
        $cobrado = isset($mp['transaction_amount']) ? Tarifas::aCentavos((string) $mp['transaction_amount']) : $total;
        if ($cobrado < $total) {   // no debería pasar (el monto lo pone el servidor), pero no se da por pagado de menos
            Db::ejecutar('UPDATE pagos_en_linea SET detalle_pasarela = "monto_menor" WHERE id = ?', [$pl['id']]);
            Bitacora::cambio($req, 'pagos', (int) $pl['pago_id'], ['monto' => Tarifas::aPesos($total)], ['monto' => 'Mercado Pago cobró ' . Tarifas::aPesos($cobrado) . ' (no se aplicó)'], (int) $pl['sucursal_id']);
            return;
        }
        $folio = Folios::siguiente((int) $pl['sucursal_id'], 'recibo');
        Db::ejecutar('UPDATE pagos SET estado = "aprobado", folio = ?, fecha = NOW(), referencia_pasarela = ?, codigo_respuesta = "aprobado" WHERE id = ?',
            [$folio, (string) ($mp['id'] ?? ''), $pl['pago_id']]);
        $sol = json_decode((string) ($pl['solicitudes'] ?? ''), true) ?: [];
        $aFavor = 0;
        foreach ($lineas as $l) {
            $repetido = false;
            if (isset($sol[$l['id']])) {
                $repetido = Db::ejecutar('UPDATE solicitudes_examen SET pago_detalle_id = ? WHERE id = ? AND pago_detalle_id IS NULL', [$l['id'], $sol[$l['id']]]) === 0;
            } elseif ($l['tipo'] !== 'examen' && $l['alumno_id']) {
                $repetido = (bool) Db::uno('SELECT 1 FROM pago_detalles d JOIN pagos p ON p.id = d.pago_id WHERE p.estado = "aprobado" AND d.pago_id <> ?
                                            AND d.alumno_id = ? AND d.concepto_id = ? AND d.periodo <=> ? LIMIT 1', [$pl['pago_id'], $l['alumno_id'], $l['concepto_id'], $l['periodo']]);
            }
            if ($repetido) {   // lo pagaron en caja mientras tanto: el dinero queda a su favor
                Db::insertar('INSERT INTO saldos_favor (responsable_id, alumno_id, origen_pago_detalle_id, monto, fecha) VALUES (?, ?, ?, ?, NOW())',
                    [$pl['responsable_id'], $l['alumno_id'], $l['id'], $l['neto']]);
                $aFavor += Tarifas::aCentavos($l['neto']);
            }
        }
        Bitacora::cambio($req, 'pagos', (int) $pl['pago_id'], ['estado' => 'pendiente', 'folio' => null],
            ['estado' => 'aprobado (Mercado Pago ' . ($mp['payment_type_id'] ?? '') . ')', 'folio' => $folio] + ($aFavor ? ['saldo_favor' => Tarifas::aPesos($aFavor)] : []), (int) $pl['sucursal_id']);
    }

    /** status_detail de Mercado Pago → nuestro catálogo de mensajes (codigos_respuesta_pasarela) */
    private static function codigo(string $status, string $detalle): string
    {
        if ($status === 'cancelled') return 'cancelado';
        return match (true) {
            $detalle === 'cc_rejected_insufficient_amount' => 'fondos_insuficientes',
            in_array($detalle, ['cc_rejected_bad_filled_card_number', 'cc_rejected_bad_filled_date', 'cc_rejected_bad_filled_security_code', 'cc_rejected_bad_filled_other'], true) => 'datos_tarjeta',
            in_array($detalle, ['cc_rejected_high_risk', 'cc_rejected_blacklist', 'cc_rejected_call_for_authorize', 'rejected_high_risk', 'rejected_by_regulations'], true) => 'sospecha_fraude',
            in_array($detalle, ['cc_rejected_card_disabled'], true) => 'tarjeta_vencida',
            default => 'rechazo_banco',
        };
    }

    public static function token(array $cfg): string
    {
        $t = Llaves::descifrar($cfg['access_token_cifrado'] ?? null);
        if (!$t) throw new ErrorApi('Falta el Access Token de Mercado Pago (Configuración → Pagos en línea)', 409);
        return $t;
    }

    /** El pago debe ser de una de las cuentas de quien pregunta */
    private function mio(Peticion $req, int $pagoId): array
    {
        $pl = Db::uno('SELECT pl.*, p.estado, p.responsable_id FROM pagos_en_linea pl JOIN pagos p ON p.id = pl.pago_id
                       JOIN responsables_pago r ON r.id = p.responsable_id JOIN usuarios u ON u.persona_id = r.persona_id
                       WHERE pl.pago_id = ? AND u.id = ?', [$pagoId, $req->ctx['usuario_id']]);
        if (!$pl) throw new ErrorApi('Pago no encontrado', 404);
        return $pl;
    }

    public static function estado(int $pagoId): array
    {
        $p = Db::uno('SELECT p.id, p.folio, p.fecha, p.estado, p.codigo_respuesta, pl.origen, pl.medio, pl.estado_pasarela, pl.detalle_pasarela, pl.ficha_url, pl.expira, pl.url_pago, pl.creado,
                             c.mensaje_usuario, c.permite_reintento, s.nombre sucursal,
                             (SELECT SUM(d.monto_cobrado - d.descuento_aplicado) FROM pago_detalles d WHERE d.pago_id = p.id) total,
                             (SELECT COALESCE(SUM(sf.monto), 0) FROM saldos_favor sf JOIN pago_detalles d ON d.id = sf.origen_pago_detalle_id WHERE d.pago_id = p.id) a_favor
                      FROM pagos p JOIN pagos_en_linea pl ON pl.pago_id = p.id JOIN sucursales s ON s.id = p.sucursal_id
                      LEFT JOIN codigos_respuesta_pasarela c ON c.codigo = p.codigo_respuesta WHERE p.id = ?', [$pagoId]);
        if (!$p) throw new ErrorApi('Pago no encontrado', 404);
        $p['lineas'] = Db::todos('SELECT c.nombre concepto, d.periodo, d.monto_cobrado - d.descuento_aplicado neto, CONCAT(pe.nombre, " ", pe.apellido_paterno) alumno
                                  FROM pago_detalles d JOIN conceptos c ON c.id = d.concepto_id LEFT JOIN alumnos a ON a.id = d.alumno_id LEFT JOIN personas pe ON pe.id = a.persona_id
                                  WHERE d.pago_id = ? ORDER BY d.id', [$pagoId]);
        foreach ($p['lineas'] as &$l) if ($l['periodo']) $l['concepto'] .= ' · ' . EstadoCuenta::mes($l['periodo']);
        unset($l);
        $vencido = $p['estado'] === 'pendiente' && !Db::uno('SELECT 1 FROM pagos p JOIN pagos_en_linea pl ON pl.pago_id = p.id WHERE p.id = ? AND ' . self::ACTIVO, [$pagoId]);
        $p['vigente'] = $p['estado'] === 'pendiente' && !$vencido;
        $p['permite_reintento'] = $p['estado'] === 'rechazado' || $vencido ? true : (bool) $p['permite_reintento'];
        $p['modo'] = self::modo();
        $p['id'] = (int) $p['id'];
        return $p;
    }
}
