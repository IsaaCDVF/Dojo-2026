<?php
declare(strict_types=1);
namespace Dojo\Nucleo\Middleware;

use Dojo\Nucleo\{Db, ErrorApi, Parametros, Peticion};

/**
 * Valida el token "Authorization: Bearer ..." contra la tabla sesiones.
 * La sesión expira por inactividad según el parámetro minutos_inactividad_sesion.
 */
final class Autenticacion
{
    public static function verificar(Peticion $req): void
    {
        if (!$req->token) throw new ErrorApi('Inicia sesión', 401);
        $minutos = (int) (Parametros::valor('minutos_inactividad_sesion') ?? 30);
        $s = Db::uno('SELECT s.id, s.usuario_id, s.usuario_rol_id, u.activo,
                             s.ultima_actividad < NOW() - INTERVAL ? MINUTE AS expirada
                      FROM sesiones s JOIN usuarios u ON u.id = s.usuario_id
                      WHERE s.token_hash = ? AND s.revocada IS NULL', [$minutos, hash('sha256', $req->token)]);
        if (!$s || !$s['activo']) throw new ErrorApi('Sesión no válida', 401);
        if ($s['expirada']) {
            Db::ejecutar('UPDATE sesiones SET revocada = NOW() WHERE id = ?', [$s['id']]);
            throw new ErrorApi('La sesión expiró por inactividad', 401);
        }
        Db::ejecutar('UPDATE sesiones SET ultima_actividad = NOW() WHERE id = ?', [$s['id']]);

        $req->ctx = ['sesion_id' => (int) $s['id'], 'usuario_id' => (int) $s['usuario_id'], 'rol' => null];
        if ($s['usuario_rol_id']) {
            $rol = Db::uno('SELECT ur.id usuario_rol_id, ur.sucursal_id, r.id rol_id, r.nombre, r.nivel, r.alcance
                            FROM usuario_roles ur JOIN roles r ON r.id = ur.rol_id
                            WHERE ur.id = ? AND ur.activo = 1', [$s['usuario_rol_id']]);
            if (!$rol) throw new ErrorApi('Tu rol ya no está activo; inicia sesión de nuevo', 401);
            $req->ctx['rol'] = $rol;
        }
    }
}
