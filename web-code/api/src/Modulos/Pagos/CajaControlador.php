<?php
declare(strict_types=1);
namespace Dojo\Modulos\Pagos;

use Dojo\Modulos\Bitacora\Bitacora;
use Dojo\Modulos\Catalogos\Tarifas;
use Dojo\Nucleo\{Db, ErrorApi, Folios, Peticion, Respuesta};
use Dojo\Nucleo\Middleware\Permiso;

/**
 * Fase 4 · Caja en mostrador: estado de cuenta, cobro con recibo, corte del día y cancelación.
 * El cobro automático con tarjeta (pasarela) se conecta después: usa las mismas tablas con metodo = pasarela.
 */
final class CajaControlador
{
    /** GET /api/caja/estado-cuenta/{id}  (id = responsable de pago) */
    public function estadoCuenta(Peticion $req): void
    {
        Permiso::exigirResponsable($req, (int) $req->params['id']);
        $r = $this->responsable((int) $req->params['id']);
        $edo = EstadoCuenta::de($r['id'], $this->sucursalFiltro($req));
        $edo['responsable'] = $r;
        $edo['total'] = Tarifas::aPesos(array_sum(array_map(fn($l) => $l['precio'] ? Tarifas::aCentavos($l['precio']) : 0,
            array_filter($edo['adeudos'], fn($l) => $l['estado'] !== 'por_vencer'))));
        $edo['pagos'] = Db::todos(
            'SELECT p.id, p.folio, p.fecha, p.metodo, p.estado, SUM(d.monto_cobrado - d.descuento_aplicado) AS total
             FROM pagos p JOIN pago_detalles d ON d.pago_id = p.id WHERE p.responsable_id = ? GROUP BY p.id ORDER BY p.id DESC LIMIT 10', [$r['id']]);
        Respuesta::ok($edo);
    }

    /**
     * POST /api/caja/cobros
     * {responsable_id, metodo: efectivo|transferencia, referencia?, codigo?, usar_saldo?,
     *  claves: ["mens:12:2026-11", "insc:12", "exa:5"], productos?: [{concepto_id, cantidad, alumno_id?}]}
     */
    private function preparar(Peticion $req): array
    {
        $d = $req->requeridos('responsable_id', 'metodo');
        $c = $req->cuerpo;
        if (!in_array($d['metodo'], ['efectivo', 'transferencia'], true)) throw new ErrorApi('En caja se cobra en efectivo o transferencia', 422);
        $ref = trim((string) ($c['referencia'] ?? ''));
        if ($d['metodo'] === 'transferencia' && $ref === '') throw new ErrorApi('Escribe el número de rastreo de la transferencia', 422, ['campo' => 'referencia']);
        $r = $this->responsable((int) $d['responsable_id']);
        $propia = Permiso::sucursalDe($req);
        $edo = EstadoCuenta::de($r['id'], $propia);

        // 1. Líneas pedidas: deben existir en el estado de cuenta actual
        $porClave = array_column($edo['adeudos'], null, 'clave');
        $lineas = [];
        foreach (array_unique((array) ($c['claves'] ?? [])) as $k) {
            if (!isset($porClave[$k])) throw new ErrorApi("El adeudo $k ya no está pendiente; recarga el estado de cuenta", 409);
            $lineas[] = $porClave[$k];
        }
        // Una mensualidad vencida no se cobra sin su recargo
        foreach ($lineas as $l) {
            if (str_starts_with($l['clave'], 'mens:') && isset($porClave['rec:' . substr($l['clave'], 5)]) && !in_array('rec:' . substr($l['clave'], 5), $c['claves'], true)) {
                throw new ErrorApi("La mensualidad de {$l['detalle']} está vencida: cóbrala junto con su recargo", 422);
            }
        }
        $alumnos = array_column($edo['alumnos'], null, 'id');
        foreach ((array) ($c['productos'] ?? []) as $p) {
            $con = Db::uno('SELECT id, nombre FROM conceptos WHERE id = ? AND tipo = "producto"', [(int) ($p['concepto_id'] ?? 0)]);
            if (!$con) throw new ErrorApi('Producto no encontrado', 404);
            $aid = !empty($p['alumno_id']) ? (int) $p['alumno_id'] : null;
            if ($aid && !isset($alumnos[$aid])) throw new ErrorApi('Ese alumno no está a cargo de este responsable', 422);
            for ($i = 0, $n = max(1, min(20, (int) ($p['cantidad'] ?? 1))); $i < $n; $i++) {
                $lineas[] = ['clave' => null, 'alumno_id' => $aid, 'concepto_id' => (int) $con['id'], 'concepto' => $con['nombre'], 'periodo' => null, 'solicitud_id' => null];
            }
        }
        if (!$lineas) throw new ErrorApi('Elige al menos un concepto para cobrar', 422);

        // 2. Precios y promoción: los calcula el servidor (nunca se confía en el monto que manda la pantalla)
        $sucursal = $propia ?? (int) ($alumnos[$lineas[0]['alumno_id'] ?? 0]['sucursal_id'] ?? 0);
        if (!$sucursal) $sucursal = (int) ($edo['alumnos'][0]['sucursal_id'] ?? 0);
        if (!$sucursal) throw new ErrorApi('No se pudo saber la sucursal del cobro', 422);
        $codigo = isset($c['codigo']) && trim($c['codigo']) !== '' ? trim($c['codigo']) : null;
        $cot = Tarifas::cotizar(array_map(fn($l) => ['concepto_id' => $l['concepto_id'], 'cantidad' => 1], $lineas), $sucursal, $codigo);

        // 3. Saldo a favor
        $saldos = !empty($c['usar_saldo']) ? $edo['saldos'] : [];
        $totalCent = Tarifas::aCentavos($cot['total']);
        $saldoCent = array_sum(array_map(fn($s) => Tarifas::aCentavos($s['monto']), $saldos));
        if ($saldoCent > $totalCent) {   // solo se usan saldos completos que quepan en el total
            $usar = []; $acum = 0;
            foreach ($saldos as $s) { $m = Tarifas::aCentavos($s['monto']); if ($acum + $m <= $totalCent) { $usar[] = $s; $acum += $m; } }
            $saldos = $usar; $saldoCent = $acum;
        }
        $aPagar = $totalCent - $saldoCent;
        $metodo = $aPagar === 0 && $saldoCent > 0 ? 'saldo_favor' : $d['metodo'];

        return compact('r', 'sucursal', 'metodo', 'ref', 'lineas', 'cot', 'saldos', 'saldoCent', 'aPagar');
    }

    /** POST /api/caja/cotizar — mismo cuerpo que /cobros; calcula el ticket sin guardar nada */
    public function cotizar(Peticion $req): void
    {
        $x = $this->preparar($req);
        Respuesta::ok(['promocion' => $x['cot']['promocion'], 'subtotal' => $x['cot']['subtotal'], 'descuento' => $x['cot']['descuento'],
            'total' => $x['cot']['total'], 'saldo_usado' => Tarifas::aPesos($x['saldoCent']), 'a_pagar' => Tarifas::aPesos($x['aPagar']), 'metodo' => $x['metodo'],
            'lineas' => array_map(fn($l, $c) => ['clave' => $l['clave'], 'concepto' => $l['concepto'], 'alumno_id' => $l['alumno_id'], 'periodo' => $l['periodo']] + $c, $x['lineas'], $x['cot']['lineas'])]);
    }

    public function cobrar(Peticion $req): void
    {
        ['r' => $r, 'sucursal' => $sucursal, 'metodo' => $metodo, 'ref' => $ref, 'lineas' => $lineas, 'cot' => $cot,
         'saldos' => $saldos, 'saldoCent' => $saldoCent, 'aPagar' => $aPagar] = $this->preparar($req);
        $res = Db::transaccion(function () use ($req, $r, $sucursal, $metodo, $ref, $lineas, $cot, $saldos, $saldoCent, $aPagar) {
            $folio = Folios::siguiente($sucursal, 'recibo');
            $pid = Db::insertar('INSERT INTO pagos (responsable_id, sucursal_id, folio, fecha, metodo, referencia_pasarela, estado, registrado_por)
                                 VALUES (?, ?, ?, NOW(), ?, ?, "aprobado", ?)', [$r['id'], $sucursal, $folio, $metodo, $ref ?: null, $req->ctx['usuario_id']]);
            foreach ($lineas as $i => $l) {
                $cl = $cot['lineas'][$i];
                $did = Db::insertar('INSERT INTO pago_detalles (pago_id, alumno_id, concepto_id, periodo, monto_cobrado, descuento_aplicado, promocion_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [$pid, $l['alumno_id'], $l['concepto_id'], $l['periodo'], $cl['importe'], $cl['descuento'], (float) $cl['descuento'] > 0 ? $cot['promocion']['id'] : null]);
                if (!empty($l['solicitud_id'])) Db::ejecutar('UPDATE solicitudes_examen SET pago_detalle_id = ? WHERE id = ? AND pago_detalle_id IS NULL', [$did, $l['solicitud_id']]);
            }
            foreach ($saldos as $s) Db::ejecutar('UPDATE saldos_favor SET aplicado_en_pago_id = ? WHERE id = ? AND aplicado_en_pago_id IS NULL', [$pid, $s['id']]);
            Bitacora::alta($req, 'pagos', $pid, ['folio' => $folio, 'metodo' => $metodo, 'total' => $cot['total'], 'saldo_usado' => Tarifas::aPesos($saldoCent)], $sucursal);
            return ['id' => $pid, 'folio' => $folio, 'metodo' => $metodo, 'subtotal' => $cot['subtotal'], 'descuento' => $cot['descuento'],
                    'total' => $cot['total'], 'saldo_usado' => Tarifas::aPesos($saldoCent), 'a_pagar' => Tarifas::aPesos($aPagar)];
        });
        Respuesta::ok($res, 201);
    }

    /** GET /api/caja/pagos/{id} — recibo */
    public function recibo(Peticion $req): void
    {
        $p = Db::uno('SELECT p.id, p.folio, p.fecha, p.metodo, p.referencia_pasarela AS referencia, p.estado, p.sucursal_id, s.nombre AS sucursal,
                             p.responsable_id, CONCAT(pe.nombre, " ", pe.apellido_paterno) AS responsable, u.email AS cobro
                      FROM pagos p JOIN sucursales s ON s.id = p.sucursal_id LEFT JOIN responsables_pago r ON r.id = p.responsable_id
                      LEFT JOIN personas pe ON pe.id = r.persona_id LEFT JOIN usuarios u ON u.id = p.registrado_por WHERE p.id = ?', [$req->params['id']]);
        if (!$p) throw new ErrorApi('Pago no encontrado', 404);
        Permiso::exigirResponsable($req, $p['responsable_id'] ? (int) $p['responsable_id'] : null);
        if (Permiso::alumnosPropios($req) === null) Permiso::exigirSucursal($req, (int) $p['sucursal_id']);
        $p['lineas'] = Db::todos('SELECT d.id, c.nombre AS concepto, d.periodo, d.monto_cobrado, d.descuento_aplicado, CONCAT(pe.nombre, " ", pe.apellido_paterno) AS alumno
                                  FROM pago_detalles d JOIN conceptos c ON c.id = d.concepto_id LEFT JOIN alumnos a ON a.id = d.alumno_id
                                  LEFT JOIN personas pe ON pe.id = a.persona_id WHERE d.pago_id = ? ORDER BY d.id', [$p['id']]);
        $tot = 0; $desc = 0;
        foreach ($p['lineas'] as &$l) {
            if ($l['periodo']) $l['concepto'] .= ' · ' . EstadoCuenta::mes($l['periodo']);
            $tot += Tarifas::aCentavos($l['monto_cobrado']); $desc += Tarifas::aCentavos($l['descuento_aplicado']);
        }
        $saldo = (int) Db::uno('SELECT COALESCE(SUM(monto) * 100, 0) c FROM saldos_favor WHERE aplicado_en_pago_id = ?', [$p['id']])['c'];
        $p += ['subtotal' => Tarifas::aPesos($tot), 'descuento' => Tarifas::aPesos($desc), 'total' => Tarifas::aPesos($tot - $desc),
               'saldo_usado' => Tarifas::aPesos($saldo), 'pagado' => Tarifas::aPesos($tot - $desc - $saldo)];
        Respuesta::ok($p);
    }

    /** GET /api/caja/corte?fecha=AAAA-MM-DD&sucursal_id= */
    public function corte(Peticion $req): void
    {
        $fecha = $req->query['fecha'] ?? date('Y-m-d');
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $fecha)) throw new ErrorApi('Fecha no válida', 422);
        $s = Permiso::sucursalDe($req) ?? (!empty($req->query['sucursal_id']) ? (int) $req->query['sucursal_id'] : null);
        $w = 'DATE(p.fecha) = ?'; $par = [$fecha];
        if ($s) { $w .= ' AND p.sucursal_id = ?'; $par[] = $s; }
        $pagos = Db::todos(
            "SELECT p.id, p.folio, p.fecha, p.metodo, p.estado, s.nombre AS sucursal, u.email AS cobro,
                    CONCAT(pe.nombre, ' ', pe.apellido_paterno) AS responsable,
                    SUM(d.monto_cobrado - d.descuento_aplicado) AS total,
                    (SELECT COALESCE(SUM(sf.monto), 0) FROM saldos_favor sf WHERE sf.aplicado_en_pago_id = p.id) AS saldo_usado
             FROM pagos p JOIN pago_detalles d ON d.pago_id = p.id JOIN sucursales s ON s.id = p.sucursal_id
             LEFT JOIN usuarios u ON u.id = p.registrado_por LEFT JOIN responsables_pago r ON r.id = p.responsable_id LEFT JOIN personas pe ON pe.id = r.persona_id
             WHERE $w GROUP BY p.id ORDER BY p.fecha", $par);
        $por = ['efectivo' => 0, 'transferencia' => 0, 'pasarela' => 0, 'saldo_favor' => 0]; $cancelados = 0;
        foreach ($pagos as $p) {
            $cobrado = Tarifas::aCentavos($p['total']) - Tarifas::aCentavos($p['saldo_usado']);
            if ($p['estado'] !== 'aprobado') { $cancelados++; continue; }
            $por[$p['metodo']] += $cobrado;
            $por['saldo_favor'] += $p['metodo'] === 'saldo_favor' ? 0 : Tarifas::aCentavos($p['saldo_usado']);
        }
        Respuesta::ok(['fecha' => $fecha, 'sucursal_id' => $s, 'pagos' => $pagos, 'cancelados' => $cancelados,
            'por_metodo' => array_map([Tarifas::class, 'aPesos'], $por),
            'total' => Tarifas::aPesos($por['efectivo'] + $por['transferencia'] + $por['pasarela'])]);
    }

    /** PUT /api/caja/pagos/{id}/cancelar {motivo} — el pago queda como reembolsado; lo cobrado vuelve a quedar pendiente */
    public function cancelar(Peticion $req): void
    {
        $motivo = trim((string) ($req->requeridos('motivo')['motivo']));
        $p = Db::uno('SELECT id, sucursal_id, estado, folio FROM pagos WHERE id = ?', [$req->params['id']]);
        if (!$p) throw new ErrorApi('Pago no encontrado', 404);
        Permiso::exigirSucursal($req, (int) $p['sucursal_id']);
        if ($p['estado'] !== 'aprobado') throw new ErrorApi('Solo se cancelan pagos aprobados', 409);
        Db::transaccion(function () use ($req, $p, $motivo) {
            Db::ejecutar('UPDATE pagos SET estado = "reembolsado" WHERE id = ?', [$p['id']]);
            Db::ejecutar('UPDATE solicitudes_examen SET pago_detalle_id = NULL WHERE pago_detalle_id IN (SELECT id FROM pago_detalles WHERE pago_id = ?)', [$p['id']]);
            Db::ejecutar('UPDATE saldos_favor SET aplicado_en_pago_id = NULL WHERE aplicado_en_pago_id = ?', [$p['id']]);
            Bitacora::cambio($req, 'pagos', (int) $p['id'], ['estado' => 'aprobado'], ['estado' => "reembolsado ($motivo)"], (int) $p['sucursal_id']);
        });
        Respuesta::ok(['id' => (int) $p['id'], 'estado' => 'reembolsado']);
    }

    /** Filtro de sucursal para el estado de cuenta: un rol "propio" ve todo lo suyo */
    private function sucursalFiltro(Peticion $req): ?int
    {
        return Permiso::alumnosPropios($req) === null ? Permiso::sucursalDe($req) : null;
    }

    private function responsable(int $id): array
    {
        $r = Db::uno('SELECT r.id, pe.nombre, pe.apellido_paterno, pe.apellido_materno,
                             (SELECT c.valor FROM contactos c WHERE c.persona_id = pe.id AND c.tipo IN ("telefono","whatsapp") ORDER BY c.principal DESC LIMIT 1) AS telefono,
                             (SELECT c.valor FROM contactos c WHERE c.persona_id = pe.id AND c.tipo = "email" LIMIT 1) AS email
                      FROM responsables_pago r JOIN personas pe ON pe.id = r.persona_id WHERE r.id = ?', [$id]);
        if (!$r) throw new ErrorApi('Responsable no encontrado', 404);
        $r['id'] = (int) $r['id'];
        return $r;
    }
}
