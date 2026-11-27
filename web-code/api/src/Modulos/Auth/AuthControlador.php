<?php
declare(strict_types=1);
namespace Dojo\Modulos\Auth;

use Dojo\Nucleo\{Db, ErrorApi, Parametros, Peticion, Respuesta};

final class AuthControlador
{
    /** POST /api/auth/login  { email, password } */
    public function login(Peticion $req): void
    {
        $d = $req->requeridos('email', 'password');
        $id = self::buscarUsuario((string) $d['email']);
        $u = $id ? Db::uno('SELECT id, password_hash, activo, intentos_fallidos, bloqueado_hasta, debe_cambiar_password FROM usuarios WHERE id = ?', [$id]) : null;
        if ($u && $u['bloqueado_hasta'] && strtotime($u['bloqueado_hasta']) > time()) {
            throw new ErrorApi('Cuenta bloqueada por intentos fallidos; intenta en unos minutos', 423);
        }
        if (!$u || !$u['activo'] || !password_verify($d['password'], $u['password_hash'])) {
            if ($u) {
                $max = (int) (Parametros::valor('intentos_login') ?? 5);
                Db::ejecutar('UPDATE usuarios SET intentos_fallidos = intentos_fallidos + 1,
                              bloqueado_hasta = IF(intentos_fallidos + 1 >= ?, NOW() + INTERVAL 15 MINUTE, NULL) WHERE id = ?', [$max, $u['id']]);
            }
            throw new ErrorApi('Usuario o contraseña incorrectos', 401); // mismo mensaje: no revela si el usuario existe
        }
        Db::ejecutar('UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id = ?', [$u['id']]);

        $roles = $this->roles((int) $u['id']);
        if (!$roles) throw new ErrorApi('Tu usuario no tiene roles activos', 403);
        $token = bin2hex(random_bytes(32));
        $sid = Db::insertar('INSERT INTO sesiones (usuario_id, usuario_rol_id, token_hash, ip) VALUES (?, ?, ?, ?)',
            [$u['id'], count($roles) === 1 ? $roles[0]['usuario_rol_id'] : null, hash('sha256', $token), $req->ip]);
        self::anotarDispositivo((int) $sid);
        Respuesta::ok(['token' => $token, 'roles' => $roles, 'debe_elegir_rol' => count($roles) > 1, 'debe_cambiar_password' => (bool) $u['debe_cambiar_password']]);
    }

    /** POST /api/auth/rol  { usuario_rol_id } — una persona con varios roles elige con cuál trabaja. */
    public function elegirRol(Peticion $req): void
    {
        $id = (int) $req->requeridos('usuario_rol_id')['usuario_rol_id'];
        $ok = Db::uno('SELECT 1 FROM usuario_roles WHERE id = ? AND usuario_id = ? AND activo = 1', [$id, $req->ctx['usuario_id']]);
        if (!$ok) throw new ErrorApi('Ese rol no es tuyo', 403);
        Db::ejecutar('UPDATE sesiones SET usuario_rol_id = ? WHERE id = ?', [$id, $req->ctx['sesion_id']]);
        Respuesta::ok(['usuario_rol_id' => $id]);
    }

    /** GET /api/auth/yo — datos del usuario, rol activo y sus permisos (para armar el menú). */
    public function yo(Peticion $req): void
    {
        $p = Db::uno('SELECT u.email, pe.nombre, pe.apellido_paterno, u.debe_cambiar_password FROM usuarios u JOIN personas pe ON pe.id = u.persona_id WHERE u.id = ?',
            [$req->ctx['usuario_id']]);
        $rol = $req->ctx['rol'];
        $permisos = $rol ? array_column(Db::todos('SELECT p.clave FROM rol_permisos rp JOIN permisos p ON p.id = rp.permiso_id
                                                    WHERE rp.rol_id = ? ORDER BY p.clave', [$rol['rol_id']]), 'clave') : [];
        Respuesta::ok(['usuario' => $p, 'rol_activo' => $rol, 'roles' => $this->roles($req->ctx['usuario_id']), 'permisos' => $permisos,
                       'preferencias' => \Dojo\Modulos\Sistema\PreferenciasControlador::de((int) $req->ctx['usuario_id'])]);
    }

    /**
     * PUT /api/auth/contrasena {actual, nueva} — la persona cambia su contraseña (obligatorio si entró con una temporal).
     * Cierra sus otras sesiones; la de este equipo sigue abierta.
     */
    public function cambiarContrasena(Peticion $req): void
    {
        $d = $req->requeridos('actual', 'nueva');
        $u = Db::uno('SELECT password_hash FROM usuarios WHERE id = ?', [$req->ctx['usuario_id']]);
        if (!password_verify((string) $d['actual'], $u['password_hash'])) throw new ErrorApi('La contraseña actual no es correcta', 422, ['campo' => 'actual']);
        $n = (string) $d['nueva'];
        if (mb_strlen($n) < 8 || !preg_match('/[A-Za-zÁÉÍÓÚÑáéíóúñ]/u', $n) || !preg_match('/\d/', $n)) {
            throw new ErrorApi('La contraseña nueva debe tener al menos 8 caracteres, con letras y números', 422, ['campo' => 'nueva']);
        }
        if (password_verify($n, $u['password_hash'])) throw new ErrorApi('La contraseña nueva debe ser distinta a la actual', 422, ['campo' => 'nueva']);
        Db::transaccion(function () use ($req, $n) {
            Db::ejecutar('UPDATE usuarios SET password_hash = ?, debe_cambiar_password = 0 WHERE id = ?', [password_hash($n, PASSWORD_DEFAULT), $req->ctx['usuario_id']]);
            \Dojo\Modulos\Personal\PersonalControlador::cerrarSesiones((int) $req->ctx['usuario_id'], (int) $req->ctx['sesion_id']);
            \Dojo\Modulos\Bitacora\Bitacora::cambio($req, 'usuarios', (int) $req->ctx['usuario_id'], ['password' => '(anterior)'], ['password' => '(la cambió la persona)']);
        });
        Respuesta::ok(['cambiada' => true]);
    }

    /** GET /api/auth/perfil — Mi cuenta → Datos personales (personal del panel) */
    public function perfil(Peticion $req): void
    {
        Respuesta::ok($this->datosPerfil((int) $req->ctx['usuario_id']));
    }

    /** PUT /api/auth/perfil {telefono?, email?, password?} — el correo sirve para entrar: cambiarlo pide la contraseña */
    public function guardarPerfil(Peticion $req): void
    {
        $uid = (int) $req->ctx['usuario_id'];
        $antes = $this->datosPerfil($uid);
        $c = $req->cuerpo; $cambios = [];
        if (array_key_exists('telefono', $c)) {
            $tel = \Dojo\Modulos\Personal\PersonalControlador::telefono($c['telefono']);
            if ($tel !== $antes['telefono']) $cambios['telefono'] = $tel;
        }
        if (array_key_exists('email', $c)) {
            $mail = \Dojo\Modulos\Personal\PersonalControlador::email($c['email']);
            if (!$mail) throw new ErrorApi('Tu correo es tu usuario para entrar: no lo puedes dejar vacío', 422, ['campo' => 'email']);
            if ($mail !== $antes['email']) {
                if (Db::uno('SELECT 1 FROM usuarios WHERE email = ? AND id <> ?', [$mail, $uid])) throw new ErrorApi('Ese correo ya lo usa otra cuenta', 409, ['campo' => 'email']);
                $u = Db::uno('SELECT password_hash FROM usuarios WHERE id = ?', [$uid]);
                if (!password_verify((string) ($c['password'] ?? ''), $u['password_hash'])) throw new ErrorApi('Escribe tu contraseña para cambiar el correo', 422, ['campo' => 'password']);
                $cambios['email'] = $mail;
            }
        }
        if (!$cambios) throw new ErrorApi('Nada que cambiar', 422);
        $pid = (int) $antes['persona_id'];
        Db::transaccion(function () use ($req, $uid, $pid, $cambios, $antes) {
            if (array_key_exists('telefono', $cambios)) {
                $id = Db::uno('SELECT id FROM contactos WHERE persona_id = ? AND tipo IN ("telefono","whatsapp") ORDER BY principal DESC, id LIMIT 1', [$pid])['id'] ?? null;
                if ($cambios['telefono'] === null) { if ($id) Db::ejecutar('DELETE FROM contactos WHERE id = ?', [$id]); }
                elseif ($id) Db::ejecutar('UPDATE contactos SET valor = ? WHERE id = ?', [$cambios['telefono'], $id]);
                else Db::insertar('INSERT INTO contactos (persona_id, tipo, valor, principal) VALUES (?, "telefono", ?, 1)', [$pid, $cambios['telefono']]);
            }
            if (isset($cambios['email'])) Db::ejecutar('UPDATE usuarios SET email = ? WHERE id = ?', [$cambios['email'], $uid]);
            \Dojo\Modulos\Bitacora\Bitacora::cambio($req, 'usuarios', $uid, array_intersect_key($antes, $cambios), $cambios);
        });
        Respuesta::ok($this->datosPerfil($uid));
    }

    /** GET /api/auth/sesiones — en qué equipos está abierta tu sesión */
    public function sesiones(Peticion $req): void
    {
        $filas = Db::todos('SELECT id, ip, ' . (self::hayDispositivo() ? 'dispositivo' : 'NULL dispositivo') . ', creada, ultima_actividad FROM sesiones
                            WHERE usuario_id = ? AND revocada IS NULL AND ultima_actividad > NOW() - INTERVAL 30 DAY ORDER BY ultima_actividad DESC LIMIT 20',
            [$req->ctx['usuario_id']]);
        foreach ($filas as &$f) {
            $f['actual'] = (int) $f['id'] === (int) $req->ctx['sesion_id'];
            $f['equipo'] = self::equipo($f['dispositivo']);
            unset($f['dispositivo']);
        }
        Respuesta::ok($filas);
    }

    /** POST /api/auth/sesiones/cerrar {id?} — cierra una sesión tuya, o sin id todas menos esta */
    public function cerrarSesiones(Peticion $req): void
    {
        $uid = (int) $req->ctx['usuario_id']; $esta = (int) $req->ctx['sesion_id'];
        $id = (int) ($req->cuerpo['id'] ?? 0);
        if ($id === $esta) throw new ErrorApi('Esa es la sesión de este equipo: usa "Cerrar sesión"', 422);
        $n = $id
            ? Db::ejecutar('UPDATE sesiones SET revocada = NOW() WHERE id = ? AND usuario_id = ? AND revocada IS NULL', [$id, $uid])
            : Db::ejecutar('UPDATE sesiones SET revocada = NOW() WHERE usuario_id = ? AND id <> ? AND revocada IS NULL', [$uid, $esta]);
        if ($id && !$n) throw new ErrorApi('Esa sesión ya estaba cerrada', 404);
        Respuesta::ok(['cerradas' => $n]);
    }

    private function datosPerfil(int $uid): array
    {
        $p = Db::uno('SELECT u.persona_id, u.email, pe.nombre, pe.apellido_paterno, pe.apellido_materno,
                             (SELECT c.valor FROM contactos c WHERE c.persona_id = pe.id AND c.tipo IN ("telefono","whatsapp") ORDER BY c.principal DESC, c.id LIMIT 1) telefono
                      FROM usuarios u JOIN personas pe ON pe.id = u.persona_id WHERE u.id = ?', [$uid]);
        $p['roles'] = $this->roles($uid);
        return $p;
    }

    private static function hayDispositivo(): bool
    {
        static $h = null;
        return $h ??= (bool) Db::uno("SHOW COLUMNS FROM sesiones LIKE 'dispositivo'");
    }

    /** Guarda desde qué navegador entró (si ya se corrió el parche 016) */
    public static function anotarDispositivo(int $sesionId): void
    {
        $ua = mb_substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 160);
        if ($ua !== '' && self::hayDispositivo()) Db::ejecutar('UPDATE sesiones SET dispositivo = ? WHERE id = ?', [$ua, $sesionId]);
    }

    /** "Mozilla/5.0 (Windows NT 10.0…) … Chrome/131" → "Chrome · Windows" */
    public static function equipo(?string $ua): string
    {
        if (!$ua) return 'Equipo desconocido';
        $nav = match (true) {
            str_contains($ua, 'Edg/') => 'Edge', str_contains($ua, 'OPR/') => 'Opera', str_contains($ua, 'Firefox/') => 'Firefox',
            str_contains($ua, 'Chrome/') => 'Chrome', str_contains($ua, 'Safari/') => 'Safari', str_starts_with($ua, 'curl') => 'Programa (curl)', default => 'Navegador',
        };
        $so = match (true) {
            str_contains($ua, 'iPhone') => 'iPhone', str_contains($ua, 'iPad') => 'iPad', str_contains($ua, 'Android') => 'Android',
            str_contains($ua, 'Windows') => 'Windows', str_contains($ua, 'Mac OS') => 'Mac', str_contains($ua, 'Linux') => 'Linux', default => '',
        };
        return $so ? "$nav · $so" : $nav;
    }

    /** POST /api/auth/logout */
    public function logout(Peticion $req): void
    {
        Db::ejecutar('UPDATE sesiones SET revocada = NOW() WHERE id = ?', [$req->ctx['sesion_id']]);
        Respuesta::ok();
    }

    /**
     * El personal entra con su correo. En la app el alumno entra con su matrícula (CENT-26-0013)
     * y el responsable con su teléfono de 10 dígitos; los dos también pueden usar su correo si tienen.
     */
    public static function buscarUsuario(string $dato): ?int
    {
        $dato = trim($dato);
        if ($dato === '') return null;
        if (str_contains($dato, '@')) return (int) (Db::uno('SELECT id FROM usuarios WHERE email = ?', [strtolower($dato)])['id'] ?? 0) ?: null;
        if (preg_match('/^[A-Za-z]{2,6}-\d{2}-\d{4}$/', $dato)) {
            return (int) (Db::uno('SELECT u.id FROM alumnos a JOIN usuarios u ON u.persona_id = a.persona_id WHERE a.matricula = ?', [strtoupper($dato)])['id'] ?? 0) ?: null;
        }
        $tel = preg_replace('/\D/', '', $dato);
        if (strlen($tel) === 12 && str_starts_with($tel, '52')) $tel = substr($tel, 2);
        if (strlen($tel) !== 10) return null;
        // Con teléfono entra el responsable de pago (el alumno puede tener el mismo teléfono que su mamá: él usa su matrícula)
        $u = Db::uno('SELECT u.id FROM contactos c JOIN usuarios u ON u.persona_id = c.persona_id JOIN responsables_pago r ON r.persona_id = c.persona_id
                      WHERE c.tipo IN ("telefono","whatsapp") AND c.valor = ? ORDER BY u.id LIMIT 1', [$tel]);
        return $u ? (int) $u['id'] : null;
    }

    private function roles(int $usuarioId): array
    {
        return Db::todos('SELECT ur.id usuario_rol_id, r.nombre rol, s.id sucursal_id, s.nombre sucursal
                          FROM usuario_roles ur JOIN roles r ON r.id = ur.rol_id LEFT JOIN sucursales s ON s.id = ur.sucursal_id
                          WHERE ur.usuario_id = ? AND ur.activo = 1 ORDER BY r.nivel DESC', [$usuarioId]);
    }
}
