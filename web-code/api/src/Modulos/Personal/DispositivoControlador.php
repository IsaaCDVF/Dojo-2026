<?php
declare(strict_types=1);
namespace Dojo\Modulos\Personal;

use Dojo\Modulos\Bitacora\Bitacora;
use Dojo\Nucleo\{Db, ErrorApi, Peticion, Respuesta};
use Dojo\Nucleo\Middleware\Permiso;

/**
 * Tabletas de asistencia (como conectar una tele a una app de video):
 *  1. La tableta abre /tableta/vincular → pide un código (público) y lo muestra en grande.
 *  2. El admin, en Configuración → Tabletas, escribe ese código, el nombre y la sucursal.
 *  3. La tableta, que pregunta cada pocos segundos con su clave secreta, recibe su sesión y entra sola.
 * La sesión de una tableta no se cierra por inactividad; se corta desde el panel con "Desconectar".
 */
final class DispositivoControlador
{
    private const MINUTOS_CODIGO = 10;

    /** POST /api/dispositivos/solicitar (pública) → {codigo, clave, expira_en} */
    public function solicitar(Peticion $req): void
    {
        Db::ejecutar('DELETE FROM dispositivo_vinculos WHERE expira < NOW() - INTERVAL 1 DAY');
        // Freno para que nadie llene la tabla desde fuera: 10 códigos vivos por dirección
        if ((int) Db::uno('SELECT COUNT(*) n FROM dispositivo_vinculos WHERE ip = ? AND expira > NOW() AND entregado IS NULL', [$req->ip])['n'] >= 10) {
            throw new ErrorApi('Demasiados códigos pedidos desde aquí; espera unos minutos', 429);
        }
        do { $codigo = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT); }
        while (Db::uno('SELECT 1 FROM dispositivo_vinculos WHERE codigo = ? AND expira > NOW() AND entregado IS NULL', [$codigo]));
        $clave = bin2hex(random_bytes(32));
        Db::insertar('INSERT INTO dispositivo_vinculos (codigo, clave_hash, ip, expira) VALUES (?, ?, ?, NOW() + INTERVAL ' . self::MINUTOS_CODIGO . ' MINUTE)',
            [$codigo, hash('sha256', $clave), $req->ip]);
        Respuesta::ok(['codigo' => $codigo, 'clave' => $clave, 'expira_en' => self::MINUTOS_CODIGO * 60], 201);
    }

    /** POST /api/dispositivos/estado {clave} (pública) → esperando | vinculado (con token, una sola vez) | expirado */
    public function estado(Peticion $req): void
    {
        $clave = (string) $req->requeridos('clave')['clave'];
        $v = Db::uno('SELECT v.id, v.expira > NOW() vigente, v.dispositivo_id, v.entregado, d.nombre, d.usuario_id, d.activo, s.nombre sucursal
                      FROM dispositivo_vinculos v LEFT JOIN dispositivos d ON d.id = v.dispositivo_id LEFT JOIN sucursales s ON s.id = d.sucursal_id
                      WHERE v.clave_hash = ?', [hash('sha256', $clave)]);
        if (!$v || $v['entregado']) { Respuesta::ok(['estado' => 'expirado']); return; }
        if (!$v['dispositivo_id']) { Respuesta::ok(['estado' => (int) $v['vigente'] ? 'esperando' : 'expirado']); return; }
        if (!(int) $v['activo']) { Respuesta::ok(['estado' => 'expirado']); return; }
        $token = bin2hex(random_bytes(32));
        $ur = Db::uno('SELECT ur.id FROM usuario_roles ur JOIN roles r ON r.id = ur.rol_id AND r.nombre = "tableta" WHERE ur.usuario_id = ? AND ur.activo = 1', [$v['usuario_id']]);
        Db::transaccion(function () use ($v, $token, $ur, $req) {
            Db::ejecutar('UPDATE dispositivo_vinculos SET entregado = NOW() WHERE id = ?', [$v['id']]);
            Db::insertar('INSERT INTO sesiones (usuario_id, usuario_rol_id, token_hash, ip) VALUES (?, ?, ?, ?)', [$v['usuario_id'], $ur['id'] ?? null, hash('sha256', $token), $req->ip]);
        });
        Respuesta::ok(['estado' => 'vinculado', 'token' => $token, 'dispositivo' => ['nombre' => $v['nombre'], 'sucursal' => $v['sucursal']]]);
    }

    /** GET /api/dispositivos — tabletas de las sucursales que le tocan (y las cuentas viejas de tableta con correo) */
    public function listar(Peticion $req): void
    {
        $suc = Permiso::sucursalDe($req);
        $w = $suc === null ? '' : ' WHERE d.sucursal_id = ' . (int) $suc;
        $lista = Db::todos('SELECT d.id, d.nombre, d.sucursal_id, s.nombre sucursal, s.clave, d.activo, d.creado,
                                   CONCAT(pe.nombre, " ", pe.apellido_paterno) creado_por,
                                   (SELECT MAX(x.ultima_actividad) FROM sesiones x WHERE x.usuario_id = d.usuario_id) ultima_vez,
                                   (SELECT COUNT(*) FROM sesiones x WHERE x.usuario_id = d.usuario_id AND x.revocada IS NULL) sesiones
                            FROM dispositivos d JOIN sucursales s ON s.id = d.sucursal_id JOIN usuarios u ON u.id = d.creado_por JOIN personas pe ON pe.id = u.persona_id' . $w
                            . ' ORDER BY d.activo DESC, s.nombre, d.nombre');
        foreach ($lista as &$d) {
            $d['activo'] = (int) $d['activo'];
            $d['conectada'] = $d['activo'] && (int) $d['sesiones'] > 0;
            $d['en_linea'] = $d['conectada'] && $d['ultima_vez'] && strtotime($d['ultima_vez']) > time() - 600;   // habló con el servidor en los últimos 10 min
            unset($d['sesiones']);
        }
        unset($d);
        // Cuentas de tableta de antes (entran con correo y contraseña): se ven para que las desactiven en Personal
        $viejas = Db::todos('SELECT u.id usuario_id, u.email, s.nombre sucursal, CONCAT(pe.nombre, " ", pe.apellido_paterno) nombre
                             FROM usuario_roles ur JOIN roles r ON r.id = ur.rol_id AND r.nombre = "tableta" JOIN usuarios u ON u.id = ur.usuario_id AND u.activo = 1
                             JOIN personas pe ON pe.id = u.persona_id JOIN sucursales s ON s.id = ur.sucursal_id
                             WHERE ur.activo = 1 AND NOT EXISTS (SELECT 1 FROM dispositivos d WHERE d.usuario_id = u.id)' . ($suc === null ? '' : ' AND ur.sucursal_id = ' . (int) $suc));
        Respuesta::ok(['tabletas' => $lista, 'cuentas_con_correo' => $viejas]);
    }

    /** POST /api/dispositivos {codigo, nombre, sucursal_id} — el admin conecta la tableta que muestra ese código */
    public function vincular(Peticion $req): void
    {
        $d = $req->requeridos('codigo', 'nombre', 'sucursal_id');
        $codigo = preg_replace('/\D/', '', (string) $d['codigo']);
        $nombre = mb_substr(trim((string) $d['nombre']), 0, 60);
        $suc = (int) $d['sucursal_id'];
        if ($nombre === '') throw new ErrorApi('Ponle un nombre (por ejemplo, Entrada Centro)', 422, ['campo' => 'nombre']);
        if (!Db::uno('SELECT 1 FROM sucursales WHERE id = ? AND activa = 1', [$suc])) throw new ErrorApi('Sucursal no encontrada o inactiva', 404, ['campo' => 'sucursal_id']);
        Permiso::exigirSucursal($req, $suc);
        $v = Db::uno('SELECT id FROM dispositivo_vinculos WHERE codigo = ? AND expira > NOW() AND dispositivo_id IS NULL AND entregado IS NULL ORDER BY id DESC LIMIT 1', [$codigo]);
        if (strlen($codigo) !== 6 || !$v) throw new ErrorApi('Ese código no existe o ya venció. En la tableta toca "Código nuevo".', 404, ['campo' => 'codigo']);

        $id = Db::transaccion(function () use ($req, $v, $nombre, $suc) {
            // Cuenta interna: sin contraseña usable (nadie puede entrar con ella desde el login)
            $pid = Db::insertar('INSERT INTO personas (nombre, apellido_paterno, fecha_nacimiento) VALUES (?, ?, ?)', [mb_substr($nombre, 0, 60), 'Tableta', '2000-01-01']);
            $uid = Db::insertar('INSERT INTO usuarios (persona_id, email, password_hash) VALUES (?, ?, ?)',
                [$pid, 'tableta-' . bin2hex(random_bytes(6)) . '@dojoos.local', password_hash(bin2hex(random_bytes(24)), PASSWORD_DEFAULT)]);
            Db::ejecutar('INSERT INTO usuario_roles (usuario_id, rol_id, sucursal_id) SELECT ?, id, ? FROM roles WHERE nombre = "tableta"', [$uid, $suc]);
            $id = Db::insertar('INSERT INTO dispositivos (nombre, sucursal_id, usuario_id, creado_por) VALUES (?, ?, ?, ?)', [$nombre, $suc, $uid, $req->ctx['usuario_id']]);
            Db::ejecutar('UPDATE dispositivo_vinculos SET dispositivo_id = ? WHERE id = ?', [$id, $v['id']]);
            Bitacora::alta($req, 'dispositivos', $id, ['nombre' => $nombre, 'sucursal_id' => $suc], $suc);
            return $id;
        });
        Respuesta::ok(['id' => $id, 'nombre' => $nombre, 'sucursal_id' => $suc], 201);
    }

    /** PUT /api/dispositivos/{id} {nombre?, activo?} — activo = 0 desconecta (cierra su sesión al momento) */
    public function editar(Peticion $req): void
    {
        $id = (int) $req->params['id'];
        $d = Db::uno('SELECT id, nombre, activo, sucursal_id, usuario_id FROM dispositivos WHERE id = ?', [$id]);
        if (!$d) throw new ErrorApi('Tableta no encontrada', 404);
        Permiso::exigirSucursal($req, (int) $d['sucursal_id']);
        $c = $req->cuerpo; $nuevo = [];
        if (array_key_exists('nombre', $c)) {
            $nuevo['nombre'] = mb_substr(trim((string) $c['nombre']), 0, 60);
            if ($nuevo['nombre'] === '') throw new ErrorApi('El nombre no puede quedar vacío', 422, ['campo' => 'nombre']);
        }
        if (array_key_exists('activo', $c)) {
            $nuevo['activo'] = (int) (bool) $c['activo'];
            if ($nuevo['activo'] && !(int) $d['activo']) throw new ErrorApi('Una tableta desconectada se vuelve a conectar con un código nuevo', 422);
        }
        if (!$nuevo) throw new ErrorApi('Nada que cambiar', 422);
        Db::transaccion(function () use ($req, $d, $nuevo) {
            Db::ejecutar('UPDATE dispositivos SET ' . implode(', ', array_map(fn($k) => "$k = ?", array_keys($nuevo))) . ' WHERE id = ?', [...array_values($nuevo), $d['id']]);
            if (isset($nuevo['activo']) && !$nuevo['activo']) {
                Db::ejecutar('UPDATE usuarios SET activo = 0 WHERE id = ?', [$d['usuario_id']]);
                Db::ejecutar('UPDATE sesiones SET revocada = NOW() WHERE usuario_id = ? AND revocada IS NULL', [$d['usuario_id']]);
            }
            Bitacora::cambio($req, 'dispositivos', (int) $d['id'], $d, $nuevo, (int) $d['sucursal_id']);
        });
        Respuesta::ok(['id' => $id] + $nuevo);
    }
}
