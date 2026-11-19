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
        $u = Db::uno('SELECT id, password_hash, activo, intentos_fallidos, bloqueado_hasta FROM usuarios WHERE email = ?', [$d['email']]);
        if ($u && $u['bloqueado_hasta'] && strtotime($u['bloqueado_hasta']) > time()) {
            throw new ErrorApi('Cuenta bloqueada por intentos fallidos; intenta en unos minutos', 423);
        }
        if (!$u || !$u['activo'] || !password_verify($d['password'], $u['password_hash'])) {
            if ($u) {
                $max = (int) (Parametros::valor('intentos_login') ?? 5);
                Db::ejecutar('UPDATE usuarios SET intentos_fallidos = intentos_fallidos + 1,
                              bloqueado_hasta = IF(intentos_fallidos + 1 >= ?, NOW() + INTERVAL 15 MINUTE, NULL) WHERE id = ?', [$max, $u['id']]);
            }
            throw new ErrorApi('Correo o contraseña incorrectos', 401); // mismo mensaje: no revela si el correo existe
        }
        Db::ejecutar('UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id = ?', [$u['id']]);

        $roles = $this->roles((int) $u['id']);
        if (!$roles) throw new ErrorApi('Tu usuario no tiene roles activos', 403);
        $token = bin2hex(random_bytes(32));
        Db::insertar('INSERT INTO sesiones (usuario_id, usuario_rol_id, token_hash, ip) VALUES (?, ?, ?, ?)',
            [$u['id'], count($roles) === 1 ? $roles[0]['usuario_rol_id'] : null, hash('sha256', $token), $req->ip]);
        Respuesta::ok(['token' => $token, 'roles' => $roles, 'debe_elegir_rol' => count($roles) > 1]);
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
        $p = Db::uno('SELECT u.email, pe.nombre, pe.apellido_paterno FROM usuarios u JOIN personas pe ON pe.id = u.persona_id WHERE u.id = ?',
            [$req->ctx['usuario_id']]);
        $rol = $req->ctx['rol'];
        $permisos = $rol ? array_column(Db::todos('SELECT p.clave FROM rol_permisos rp JOIN permisos p ON p.id = rp.permiso_id
                                                    WHERE rp.rol_id = ? ORDER BY p.clave', [$rol['rol_id']]), 'clave') : [];
        Respuesta::ok(['usuario' => $p, 'rol_activo' => $rol, 'roles' => $this->roles($req->ctx['usuario_id']), 'permisos' => $permisos]);
    }

    /** POST /api/auth/logout */
    public function logout(Peticion $req): void
    {
        Db::ejecutar('UPDATE sesiones SET revocada = NOW() WHERE id = ?', [$req->ctx['sesion_id']]);
        Respuesta::ok();
    }

    private function roles(int $usuarioId): array
    {
        return Db::todos('SELECT ur.id usuario_rol_id, r.nombre rol, s.id sucursal_id, s.nombre sucursal
                          FROM usuario_roles ur JOIN roles r ON r.id = ur.rol_id LEFT JOIN sucursales s ON s.id = ur.sucursal_id
                          WHERE ur.usuario_id = ? AND ur.activo = 1 ORDER BY r.nivel DESC', [$usuarioId]);
    }
}
