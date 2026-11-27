<?php
declare(strict_types=1);
namespace Dojo\Modulos\Personal;

use Dojo\Modulos\Bitacora\Bitacora;
use Dojo\Nucleo\{Db, ErrorApi, Peticion, Respuesta};
use Dojo\Nucleo\Middleware\Permiso;

/**
 * Personal y accesos: quién entra al panel, con qué rol y en qué sucursal.
 *
 * Reglas (las mismas de la tabla roles):
 * - Solo se dan roles de nivel MENOR al propio: el súper admin (5) da admin de sucursal, recepción, instructor y tableta;
 *   el admin de sucursal (4) da recepción, instructor y tableta, y solo en su sucursal.
 * - Tampoco se toca a alguien de nivel igual o mayor (un admin no le cambia nada a otro admin ni al súper admin).
 * - Al dar de alta se genera una contraseña temporal; la persona la cambia la primera vez que entra.
 * - Quitar un rol o desactivar a alguien cierra sus sesiones al momento.
 */
final class PersonalControlador
{
    /** Roles del personal (los de alcance "propio" son de la app: alumno y responsable) */
    private const ROLES_PERSONAL = "r.alcance <> 'propio'";

    /** GET /api/personal?sucursal_id=&q=&inactivos=1 */
    public function listar(Peticion $req): void
    {
        $w = [self::ROLES_PERSONAL]; $p = [];
        $suc = Permiso::sucursalDe($req) ?? (!empty($req->query['sucursal_id']) ? (int) $req->query['sucursal_id'] : null);
        if ($suc !== null) { $w[] = 'ur.sucursal_id = ?'; $p[] = $suc; }
        if (empty($req->query['inactivos'])) $w[] = 'u.activo = 1';
        if (!empty($req->query['q'])) {
            $like = '%' . trim((string) $req->query['q']) . '%';
            $w[] = "(CONCAT_WS(' ', pe.nombre, pe.apellido_paterno, pe.apellido_materno) LIKE ? OR u.email LIKE ?)"; array_push($p, $like, $like);
        }
        $w[] = 'NOT EXISTS (SELECT 1 FROM dispositivos d WHERE d.usuario_id = u.id)';   // las tabletas viven en Configuración → Tabletas
        $ids = array_column(Db::todos('SELECT DISTINCT u.id FROM usuarios u JOIN personas pe ON pe.id = u.persona_id
            JOIN usuario_roles ur ON ur.usuario_id = u.id JOIN roles r ON r.id = ur.rol_id WHERE ' . implode(' AND ', $w), $p), 'id');
        $lista = array_map(fn($id) => $this->ficha($req, (int) $id), $ids);
        usort($lista, fn($a, $b) => [$b['activo'], $b['nivel'], $a['nombre']] <=> [$a['activo'], $a['nivel'], $b['nombre']]);
        Respuesta::ok($lista);
    }

    /** GET /api/personal/opciones — roles que puede dar quien pregunta y en qué sucursales */
    public function opciones(Peticion $req): void
    {
        $nivel = (int) $req->ctx['rol']['nivel'];
        $suc = Permiso::sucursalDe($req);
        Respuesta::ok([
            'roles' => Db::todos("SELECT r.id, r.nombre, r.descripcion, r.nivel FROM roles r WHERE " . self::ROLES_PERSONAL . " AND r.nivel < ? ORDER BY r.nivel DESC, r.id", [$nivel]),
            'sucursales' => $suc === null ? Db::todos('SELECT id, clave, nombre FROM sucursales WHERE activa = 1 ORDER BY nombre')
                                          : Db::todos('SELECT id, clave, nombre FROM sucursales WHERE id = ?', [$suc]),
        ]);
    }

    /** GET /api/personal/{id} */
    public function ver(Peticion $req): void
    {
        $f = $this->ficha($req, (int) $req->params['id']);
        $this->exigirVisible($req, $f);
        Respuesta::ok($f);
    }

    /**
     * POST /api/personal {nombre, apellido_paterno, apellido_materno?, fecha_nacimiento, sexo?, email, telefono?, roles:[{rol, sucursal_id}]}
     * Responde la contraseña temporal UNA sola vez, con el mensaje listo para mandarlo por WhatsApp.
     */
    public function crear(Peticion $req): void
    {
        $roles = $this->rolesPedidos($req, $req->cuerpo['roles'] ?? null);
        $res = Db::transaccion(fn() => self::darDeAlta($req, $req->cuerpo, $roles));
        Respuesta::ok($res + ['ficha' => $this->ficha($req, $res['usuario_id'])], 201);
    }

    /** PUT /api/personal/{id} {nombre?, apellido_paterno?, apellido_materno?, email?, telefono?, activo?} */
    public function editar(Peticion $req): void
    {
        $id = (int) $req->params['id'];
        $f = $this->ficha($req, $id);
        $this->exigirEditable($req, $f);
        $c = $req->cuerpo;
        $persona = array_intersect_key($c, ['nombre' => 1, 'apellido_paterno' => 1, 'apellido_materno' => 1]);
        foreach ($persona as $k => $v) {
            $v = trim((string) $v);
            if ($k !== 'apellido_materno' && $v === '') throw new ErrorApi('El nombre y el apellido paterno no pueden quedar vacíos', 422, ['campo' => $k]);
            $persona[$k] = $v === '' ? null : mb_substr($v, 0, 60);
        }
        $usuario = [];
        if (array_key_exists('email', $c)) {
            $usuario['email'] = self::email($c['email']);
            if (Db::uno('SELECT 1 FROM usuarios WHERE email = ? AND id <> ?', [$usuario['email'], $id])) throw new ErrorApi('Ese correo ya lo usa otra persona', 409, ['campo' => 'email']);
        }
        if (array_key_exists('activo', $c)) {
            $usuario['activo'] = (int) (bool) $c['activo'];
            if (!$usuario['activo'] && $id === (int) $req->ctx['usuario_id']) throw new ErrorApi('No puedes desactivarte a ti mismo', 422);
        }
        $tel = array_key_exists('telefono', $c) ? self::telefono($c['telefono']) : false;
        if (!$persona && !$usuario && $tel === false) throw new ErrorApi('Nada que cambiar', 422);

        $n = Db::transaccion(function () use ($req, $id, $f, $persona, $usuario, $tel) {
            $n = 0;
            if ($persona) {
                $antes = Db::uno('SELECT nombre, apellido_paterno, apellido_materno FROM personas WHERE id = ?', [$f['persona_id']]);
                Db::ejecutar('UPDATE personas SET ' . implode(', ', array_map(fn($k) => "$k = ?", array_keys($persona))) . ' WHERE id = ?', [...array_values($persona), $f['persona_id']]);
                $n += Bitacora::cambio($req, 'personas', $f['persona_id'], $antes, $persona);
            }
            if ($usuario) {
                $antes = Db::uno('SELECT email, activo FROM usuarios WHERE id = ?', [$id]);
                Db::ejecutar('UPDATE usuarios SET ' . implode(', ', array_map(fn($k) => "$k = ?", array_keys($usuario))) . ' WHERE id = ?', [...array_values($usuario), $id]);
                $n += Bitacora::cambio($req, 'usuarios', $id, $antes, $usuario);
                if (isset($usuario['activo']) && !$usuario['activo']) self::cerrarSesiones($id);
            }
            if ($tel !== false) {
                $antes = ['telefono' => $f['telefono']];
                Db::ejecutar('DELETE FROM contactos WHERE persona_id = ? AND tipo IN ("telefono","whatsapp")', [$f['persona_id']]);
                if ($tel) Db::insertar('INSERT INTO contactos (persona_id, tipo, valor, principal) VALUES (?, "whatsapp", ?, 1)', [$f['persona_id'], $tel]);
                $n += Bitacora::cambio($req, 'contactos', $f['persona_id'], $antes, ['telefono' => $tel]);
            }
            return $n;
        });
        Respuesta::ok(['campos_cambiados' => $n, 'ficha' => $this->ficha($req, $id)]);
    }

    /** POST /api/personal/{id}/roles {rol, sucursal_id} */
    public function darRol(Peticion $req): void
    {
        $id = (int) $req->params['id'];
        $f = $this->ficha($req, $id);
        $this->exigirEditable($req, $f);
        [$r] = $this->rolesPedidos($req, [$req->cuerpo]);
        Db::transaccion(function () use ($req, $id, $f, $r) {
            $ya = Db::uno('SELECT id, activo FROM usuario_roles WHERE usuario_id = ? AND rol_id = ? AND sucursal_id <=> ?', [$id, $r['rol_id'], $r['sucursal_id']]);
            if ($ya && $ya['activo']) throw new ErrorApi('Ya tiene ese rol en esa sucursal', 409);
            if ($ya) {
                Db::ejecutar('UPDATE usuario_roles SET activo = 1 WHERE id = ?', [$ya['id']]);
                Bitacora::cambio($req, 'usuario_roles', (int) $ya['id'], ['activo' => 0], ['activo' => 1], $r['sucursal_id']);
            } else {
                $ur = Db::insertar('INSERT INTO usuario_roles (usuario_id, rol_id, sucursal_id) VALUES (?, ?, ?)', [$id, $r['rol_id'], $r['sucursal_id']]);
                Bitacora::alta($req, 'usuario_roles', $ur, ['usuario_id' => $id, 'rol' => $r['rol'], 'sucursal_id' => $r['sucursal_id']], $r['sucursal_id']);
            }
            if ($r['rol'] === 'instructor') self::asegurarInstructor((int) $f['persona_id']);
        });
        Respuesta::ok($this->ficha($req, $id), 201);
    }

    /** DELETE /api/personal/{id}/roles/{rid} — se desactiva (queda en el historial) y se cierran las sesiones con ese rol */
    public function quitarRol(Peticion $req): void
    {
        $id = (int) $req->params['id']; $rid = (int) $req->params['rid'];
        $f = $this->ficha($req, $id);
        $this->exigirEditable($req, $f);
        $ur = Db::uno('SELECT ur.id, ur.sucursal_id, ur.activo, r.nivel, r.nombre FROM usuario_roles ur JOIN roles r ON r.id = ur.rol_id
                       WHERE ur.id = ? AND ur.usuario_id = ?', [$rid, $id]);
        if (!$ur || !$ur['activo']) throw new ErrorApi('Ese rol no está activo', 404);
        if ((int) $ur['nivel'] >= (int) $req->ctx['rol']['nivel']) throw new ErrorApi('No puedes quitar un rol de tu mismo nivel o mayor', 403);
        if ($ur['sucursal_id'] !== null) Permiso::exigirSucursal($req, (int) $ur['sucursal_id']);
        Db::transaccion(function () use ($req, $ur) {
            Db::ejecutar('UPDATE usuario_roles SET activo = 0 WHERE id = ?', [$ur['id']]);
            Db::ejecutar('UPDATE sesiones SET revocada = NOW() WHERE usuario_rol_id = ? AND revocada IS NULL', [$ur['id']]);
            Bitacora::cambio($req, 'usuario_roles', (int) $ur['id'], ['activo' => 1], ['activo' => 0], $ur['sucursal_id'] !== null ? (int) $ur['sucursal_id'] : null);
        });
        Respuesta::ok($this->ficha($req, $id));
    }

    /** POST /api/personal/{id}/contrasena — contraseña temporal nueva ("olvidé mi contraseña"); cierra sus sesiones */
    public function restablecer(Peticion $req): void
    {
        $id = (int) $req->params['id'];
        $f = $this->ficha($req, $id);
        $this->exigirEditable($req, $f);
        if ($id === (int) $req->ctx['usuario_id']) throw new ErrorApi('Tu contraseña la cambias en Mi perfil', 422);
        $temporal = self::contrasenaTemporal();
        Db::transaccion(function () use ($req, $id, $temporal) {
            Db::ejecutar('UPDATE usuarios SET password_hash = ?, debe_cambiar_password = 1, intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id = ?',
                [password_hash($temporal, PASSWORD_DEFAULT), $id]);
            self::cerrarSesiones($id);
            Bitacora::cambio($req, 'usuarios', $id, ['password' => '(anterior)'], ['password' => '(temporal nueva)']);
        });
        Respuesta::ok(['email' => $f['email'], 'password_temporal' => $temporal, 'telefono' => $f['telefono'],
                       'mensaje' => self::mensaje($f['nombre'], $f['email'], $temporal, false)]);
    }

    /* ---------------- Lo que también usa el alta de sucursal ---------------- */

    /**
     * Crea persona + usuario + roles (dentro de la transacción de quien llama).
     * $roles ya validados con rolesPedidos(). Devuelve usuario_id, email, contraseña temporal y mensaje.
     */
    public static function darDeAlta(Peticion $req, array $c, array $roles): array
    {
        foreach (['nombre', 'apellido_paterno', 'fecha_nacimiento', 'email'] as $k) {
            if (!isset($c[$k]) || trim((string) $c[$k]) === '') throw new ErrorApi('Faltan datos obligatorios', 422, ['faltan' => [$k]]);
        }
        $email = self::email($c['email']);
        if (Db::uno('SELECT 1 FROM usuarios WHERE email = ?', [$email])) {
            throw new ErrorApi('Ya hay una cuenta con ese correo: búscala en Personal y dale el rol desde ahí', 409, ['campo' => 'email']);
        }
        $nac = (string) $c['fecha_nacimiento'];
        $t = \DateTime::createFromFormat('!Y-m-d', $nac);
        if (!$t || $t->format('Y-m-d') !== $nac) throw new ErrorApi('La fecha de nacimiento no es válida', 422, ['campo' => 'fecha_nacimiento']);
        $edad = (int) $t->diff(new \DateTime('today'))->y;
        if ($edad < 16 || $edad > 100) throw new ErrorApi('El personal debe tener entre 16 y 100 años', 422, ['campo' => 'fecha_nacimiento']);
        $sexo = isset($c['sexo']) && $c['sexo'] !== '' ? strtoupper((string) $c['sexo']) : null;
        if ($sexo !== null && !in_array($sexo, ['F', 'M', 'X'], true)) throw new ErrorApi('Sexo: F, M o X', 422, ['campo' => 'sexo']);
        $tel = self::telefono($c['telefono'] ?? null);
        $nombre = mb_substr(trim((string) $c['nombre']), 0, 60);
        $ap = mb_substr(trim((string) $c['apellido_paterno']), 0, 60);
        $am = isset($c['apellido_materno']) && trim((string) $c['apellido_materno']) !== '' ? mb_substr(trim((string) $c['apellido_materno']), 0, 60) : null;

        $pid = Db::insertar('INSERT INTO personas (nombre, apellido_paterno, apellido_materno, fecha_nacimiento, sexo) VALUES (?, ?, ?, ?, ?)', [$nombre, $ap, $am, $nac, $sexo]);
        if ($tel) Db::insertar('INSERT INTO contactos (persona_id, tipo, valor, principal) VALUES (?, "whatsapp", ?, 1)', [$pid, $tel]);
        $temporal = self::contrasenaTemporal();
        $uid = Db::insertar('INSERT INTO usuarios (persona_id, email, password_hash, debe_cambiar_password) VALUES (?, ?, ?, 1)',
            [$pid, $email, password_hash($temporal, PASSWORD_DEFAULT)]);
        Bitacora::alta($req, 'usuarios', $uid, ['nombre' => "$nombre $ap", 'email' => $email]);
        foreach ($roles as $r) {
            $ur = Db::insertar('INSERT INTO usuario_roles (usuario_id, rol_id, sucursal_id) VALUES (?, ?, ?)', [$uid, $r['rol_id'], $r['sucursal_id']]);
            Bitacora::alta($req, 'usuario_roles', $ur, ['usuario_id' => $uid, 'rol' => $r['rol'], 'sucursal_id' => $r['sucursal_id']], $r['sucursal_id']);
            if ($r['rol'] === 'instructor') self::asegurarInstructor($pid);
        }
        return ['usuario_id' => $uid, 'email' => $email, 'password_temporal' => $temporal, 'telefono' => $tel,
                'mensaje' => self::mensaje($nombre, $email, $temporal, true)];
    }

    /**
     * Valida la lista [{rol, sucursal_id}] contra lo que puede dar quien pide.
     * $sucursalNueva: id de una sucursal que se está creando en la misma transacción (aún no "activa" para la lista).
     */
    public function rolesPedidos(Peticion $req, mixed $lista, ?int $sucursalNueva = null): array
    {
        if (!is_array($lista) || !$lista) throw new ErrorApi('Dale al menos un rol (por ejemplo, recepción en una sucursal)', 422, ['campo' => 'roles']);
        $nivel = (int) $req->ctx['rol']['nivel'];
        $res = []; $vistos = [];
        foreach ($lista as $x) {
            $nombre = (string) ($x['rol'] ?? '');
            $rol = Db::uno('SELECT r.id, r.nombre, r.nivel, r.alcance FROM roles r WHERE r.nombre = ?', [$nombre]);
            if (!$rol || $rol['alcance'] === 'propio') throw new ErrorApi("El rol \"$nombre\" no es de personal", 422, ['campo' => 'roles']);
            if ((int) $rol['nivel'] >= $nivel) throw new ErrorApi('Solo puedes dar roles de nivel menor al tuyo', 403, ['campo' => 'roles']);
            $suc = isset($x['sucursal_id']) && $x['sucursal_id'] !== '' ? (int) $x['sucursal_id'] : null;
            if ($rol['alcance'] === 'sucursal') {
                if (!$suc) throw new ErrorApi('Elige la sucursal del rol', 422, ['campo' => 'roles']);
                if ($suc !== $sucursalNueva && !Db::uno('SELECT 1 FROM sucursales WHERE id = ? AND activa = 1', [$suc])) throw new ErrorApi('Sucursal no encontrada o inactiva', 404, ['campo' => 'roles']);
                if ($suc !== $sucursalNueva) Permiso::exigirSucursal($req, $suc);
            } else { $suc = null; }
            $k = $rol['id'] . '-' . $suc;
            if (isset($vistos[$k])) continue;
            $vistos[$k] = true;
            $res[] = ['rol_id' => (int) $rol['id'], 'rol' => $rol['nombre'], 'sucursal_id' => $suc];
        }
        return $res;
    }

    public static function asegurarInstructor(int $personaId): void
    {
        if (!Db::uno('SELECT 1 FROM instructores WHERE persona_id = ?', [$personaId])) {
            Db::insertar('INSERT INTO instructores (persona_id, fecha_ingreso) VALUES (?, CURDATE())', [$personaId]);
        }
    }

    public static function cerrarSesiones(int $usuarioId, ?int $menos = null): void
    {
        Db::ejecutar('UPDATE sesiones SET revocada = NOW() WHERE usuario_id = ? AND revocada IS NULL AND id <> ?', [$usuarioId, $menos ?? 0]);
    }

    /** 10 caracteres sin letras que se confunden (0/O, 1/l/I), con al menos una mayúscula, minúscula y número */
    public static function contrasenaTemporal(): string
    {
        $may = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; $min = 'abcdefghijkmnpqrstuvwxyz'; $num = '23456789';
        $todo = $may . $min . $num;
        $c = [$may[random_int(0, 23)], $min[random_int(0, 23)], $num[random_int(0, 7)]];
        while (count($c) < 10) $c[] = $todo[random_int(0, strlen($todo) - 1)];
        for ($i = count($c) - 1; $i > 0; $i--) { $j = random_int(0, $i); [$c[$i], $c[$j]] = [$c[$j], $c[$i]]; }
        return implode('', $c);
    }

    public static function email(mixed $e): string
    {
        $e = strtolower(trim((string) $e));
        if (!filter_var($e, FILTER_VALIDATE_EMAIL)) throw new ErrorApi('El correo no es válido', 422, ['campo' => 'email']);
        return $e;
    }

    public static function telefono(mixed $t): ?string
    {
        if ($t === null || trim((string) $t) === '') return null;
        $n = preg_replace('/\D/', '', (string) $t);
        if (strlen($n) === 12 && str_starts_with($n, '52')) $n = substr($n, 2);
        if (strlen($n) !== 10) throw new ErrorApi('El teléfono debe tener 10 dígitos', 422, ['campo' => 'telefono']);
        return $n;
    }

    private static function mensaje(string $nombre, string $email, string $temporal, bool $nuevo): string
    {
        $marca = \Dojo\Modulos\Sistema\MarcaControlador::datos()['nombre'] ?? 'Dojo OS';
        $marca = preg_replace('/\p{Mn}/u', '', $marca);
        return ($nuevo ? "Hola $nombre, ya tienes acceso al sistema de $marca." : "Hola $nombre, te dejo una contraseña nueva para el sistema de $marca.")
            . "\nCorreo: $email\nContraseña temporal: $temporal\nAl entrar te va a pedir que crees tu propia contraseña.";
    }

    /* ---------------- Ficha y candados ---------------- */

    private function ficha(Peticion $req, int $id): array
    {
        $u = Db::uno('SELECT u.id usuario_id, u.persona_id, u.email, u.activo, u.debe_cambiar_password, pe.nombre, pe.apellido_paterno, pe.apellido_materno,
                             (SELECT c.valor FROM contactos c WHERE c.persona_id = pe.id AND c.tipo IN ("telefono","whatsapp") ORDER BY c.principal DESC LIMIT 1) telefono,
                             (SELECT MAX(s.ultima_actividad) FROM sesiones s WHERE s.usuario_id = u.id) ultima_vez
                      FROM usuarios u JOIN personas pe ON pe.id = u.persona_id WHERE u.id = ?', [$id]);
        if (!$u) throw new ErrorApi('Persona no encontrada', 404);
        $roles = Db::todos('SELECT ur.id usuario_rol_id, r.nombre rol, r.nivel, r.alcance, ur.sucursal_id, s.nombre sucursal, s.clave, ur.activo
                            FROM usuario_roles ur JOIN roles r ON r.id = ur.rol_id LEFT JOIN sucursales s ON s.id = ur.sucursal_id
                            WHERE ur.usuario_id = ? ORDER BY ur.activo DESC, r.nivel DESC, s.nombre', [$id]);
        $activos = array_filter($roles, fn($r) => (int) $r['activo'] === 1);
        $nivel = $activos ? max(array_map(fn($r) => (int) $r['nivel'], $activos)) : 0;
        $miNivel = (int) $req->ctx['rol']['nivel'];
        foreach ($roles as &$r) { $r['activo'] = (int) $r['activo']; $r['nivel'] = (int) $r['nivel']; $r['se_puede_quitar'] = $r['activo'] && $r['nivel'] < $miNivel && $this->sucursalMia($req, $r['sucursal_id']); }
        unset($r);
        $u['activo'] = (int) $u['activo']; $u['debe_cambiar_password'] = (int) $u['debe_cambiar_password'];
        return $u + ['nivel' => $nivel, 'roles' => $roles, 'editable' => $nivel < $miNivel && $id !== (int) $req->ctx['usuario_id']];
    }

    private function sucursalMia(Peticion $req, mixed $sucursalId): bool
    {
        $propia = Permiso::sucursalDe($req);
        return $propia === null || ($sucursalId !== null && (int) $sucursalId === $propia);
    }

    /** El admin de sucursal solo ve a quien tiene algún rol (activo o no) en su sucursal */
    private function exigirVisible(Peticion $req, array $f): void
    {
        $propia = Permiso::sucursalDe($req);
        if ($propia === null) return;
        foreach ($f['roles'] as $r) if ($r['alcance'] !== 'propio' && (int) $r['sucursal_id'] === $propia) return;
        throw new ErrorApi('Esa persona no trabaja en tu sucursal', 403);
    }

    /** Solo se edita a alguien de nivel menor (alguien sin roles activos queda en nivel 0 y sí se puede) */
    private function exigirEditable(Peticion $req, array $f): void
    {
        $this->exigirVisible($req, $f);
        if ((int) $f['usuario_id'] === (int) $req->ctx['usuario_id']) throw new ErrorApi('Tus propios accesos los cambia alguien de nivel mayor', 403);
        if ($f['nivel'] >= (int) $req->ctx['rol']['nivel']) throw new ErrorApi('No puedes cambiar a alguien de tu mismo nivel o mayor', 403);
    }
}
