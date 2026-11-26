<?php
declare(strict_types=1);
namespace Dojo\Modulos\Pagos\Pasarela;

use Dojo\Modulos\Bitacora\Bitacora;
use Dojo\Nucleo\{Db, ErrorApi, Peticion, Respuesta};

/**
 * Configuración → Pagos en línea (solo súper admin): conectar la cuenta de Mercado Pago de la empresa.
 * El Access Token y la clave de los avisos se guardan cifrados y nunca se devuelven (solo sus últimos 4 caracteres).
 * Todo vive en la base y en el panel: no hay que tocar el .env.
 */
final class PasarelaControlador
{
    /** GET /api/pasarela */
    public function ver(Peticion $req): void
    {
        Respuesta::ok($this->datos($req));
    }

    /** PUT /api/pasarela {modo?, public_key?, access_token?, webhook_secret?, url_publica?} (vacío = borrar) */
    public function guardar(Peticion $req): void
    {
        $c = $req->cuerpo;
        $antes = Db::uno('SELECT * FROM pasarela_config WHERE id = 1');
        $set = []; $log = [];
        if (array_key_exists('access_token', $c)) {
            $t = trim((string) $c['access_token']);
            if ($t !== '' && !preg_match('/^(APP_USR|TEST)-[\w-]{20,}$/', $t)) throw new ErrorApi('El Access Token empieza con APP_USR- (o TEST-): cópialo completo de tu panel de Mercado Pago', 422, ['campo' => 'access_token']);
            $set['access_token_cifrado'] = $t === '' ? null : Llaves::cifrar($t); $log['access_token'] = $t === '' ? '(borrado)' : '(nuevo …' . substr($t, -4) . ')';
        }
        if (array_key_exists('webhook_secret', $c)) {
            $w = trim((string) $c['webhook_secret']);
            if ($w !== '' && strlen($w) < 16) throw new ErrorApi('La clave secreta de los avisos parece incompleta', 422, ['campo' => 'webhook_secret']);
            $set['webhook_secret_cifrado'] = $w === '' ? null : Llaves::cifrar($w); $log['webhook_secret'] = $w === '' ? '(borrada)' : '(nueva)';
        }
        if (array_key_exists('public_key', $c)) {
            $k = trim((string) $c['public_key']);
            if ($k !== '' && !preg_match('/^(APP_USR|TEST)-[\w-]{8,}$/', $k)) throw new ErrorApi('La Public Key empieza con APP_USR- (o TEST-)', 422, ['campo' => 'public_key']);
            $set['public_key'] = $k ?: null; $log['public_key'] = $k ?: '(borrada)';
        }
        if (array_key_exists('url_publica', $c)) {
            $u = rtrim(trim((string) $c['url_publica']), '/');
            if ($u !== '' && !preg_match('#^https?://[a-z0-9.-]+(:\d+)?(/[\w./-]*)?$#i', $u)) throw new ErrorApi('Escribe la dirección completa, por ejemplo https://midojo.com', 422, ['campo' => 'url_publica']);
            $set['url_publica'] = $u ?: null; $log['url_publica'] = $u ?: '(borrada)';
        }
        if (array_key_exists('modo', $c)) {
            $m = (string) $c['modo'];
            if (!in_array($m, ['apagado', 'prueba', 'real'], true)) throw new ErrorApi('Modo: apagado, prueba o real', 422, ['campo' => 'modo']);
            $set['modo'] = $m; $log['modo'] = $m;
        }
        if (!$set) throw new ErrorApi('Nada que cambiar', 422);
        $token = array_key_exists('access_token_cifrado', $set) ? $set['access_token_cifrado'] : $antes['access_token_cifrado'];
        if (($set['modo'] ?? $antes['modo']) === 'real' && !Llaves::descifrar($token)) {
            throw new ErrorApi('Para cobrar de verdad primero pon el Access Token de Mercado Pago', 422, ['campo' => 'access_token']);
        }
        Db::transaccion(function () use ($req, $set, $log, $antes) {
            Db::ejecutar('UPDATE pasarela_config SET ' . implode(', ', array_map(fn($k) => "$k = ?", array_keys($set))) . ', actualizado = NOW(), actualizado_por = ? WHERE id = 1',
                [...array_values($set), $req->ctx['usuario_id']]);
            $previo = ['modo' => $antes['modo'], 'public_key' => $antes['public_key'], 'url_publica' => $antes['url_publica'], 'access_token' => '(oculto)', 'webhook_secret' => '(oculto)'];
            Bitacora::cambio($req, 'pasarela_config', 1, $previo, $log);
        });
        Respuesta::ok($this->datos($req));
    }

    /** POST /api/pasarela/probar — revisa con Mercado Pago que el Access Token sirve y de qué cuenta es */
    public function probar(Peticion $req): void
    {
        $cfg = Db::uno('SELECT * FROM pasarela_config WHERE id = 1');
        $yo = (new MercadoPago(PagoEnLineaControlador::token($cfg)))->cuenta();
        Respuesta::ok(['ok' => true, 'cuenta' => $yo['nickname'] ?? null, 'correo' => $yo['email'] ?? null, 'pais' => $yo['site_id'] ?? null,
                       'aviso' => ($yo['site_id'] ?? 'MLM') !== 'MLM' ? 'Esta cuenta no es de México (MLM): los precios van en pesos mexicanos' : null]);
    }

    private function datos(Peticion $req): array
    {
        $c = Db::uno('SELECT * FROM pasarela_config WHERE id = 1');
        $token = Llaves::descifrar($c['access_token_cifrado']);
        $secreto = Llaves::descifrar($c['webhook_secret_cifrado']);
        $base = $c['url_publica'] ?: null;
        return [
            'proveedor' => $c['proveedor'], 'modo' => $c['modo'], 'public_key' => $c['public_key'],
            'tiene_token' => (bool) $token, 'token_final' => $token ? substr($token, -4) : null, 'token_de_prueba' => $token ? str_starts_with($token, 'TEST-') : null,
            'token_ilegible' => $c['access_token_cifrado'] && !$token,   // se perdió la llave de cifrado: volver a capturarlo
            'tiene_secreto' => (bool) $secreto, 'url_publica' => $c['url_publica'],
            'url_aviso' => $base ? "$base/api/pagos-en-linea/aviso" : null, 'https' => $base ? str_starts_with($base, 'https://') : false,
            'actualizado' => $c['actualizado'],
            'pagos_hoy' => Db::uno('SELECT COUNT(*) n, COALESCE(SUM(t.total), 0) total FROM (SELECT p.id, SUM(d.monto_cobrado - d.descuento_aplicado) total FROM pagos p
                                    JOIN pago_detalles d ON d.pago_id = p.id WHERE p.metodo = "pasarela" AND p.estado = "aprobado" AND DATE(p.fecha) = CURDATE() GROUP BY p.id) t'),
        ];
    }
}
