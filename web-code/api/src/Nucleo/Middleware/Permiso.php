<?php
declare(strict_types=1);
namespace Dojo\Nucleo\Middleware;

use Dojo\Nucleo\{Db, ErrorApi, Peticion};

/** Revisa en el servidor que el rol activo tenga el permiso y que la sucursal le corresponda. */
final class Permiso
{
    public static function exigir(Peticion $req, string $clave): void
    {
        $rol = $req->ctx['rol'] ?? null;
        if (!$rol) throw new ErrorApi('Elige con qué rol vas a trabajar', 409);
        $tiene = Db::uno('SELECT 1 FROM rol_permisos rp JOIN permisos p ON p.id = rp.permiso_id
                          WHERE rp.rol_id = ? AND p.clave = ?', [$rol['rol_id'], $clave]);
        if (!$tiene) throw new ErrorApi('No tienes permiso para esta acción', 403, ['permiso' => $clave]);
    }

    /** Sucursal a la que se limita la consulta: null = todas (alcance global). */
    public static function sucursalDe(Peticion $req): ?int
    {
        $rol = $req->ctx['rol'];
        return $rol['alcance'] === 'global' ? null : (int) $rol['sucursal_id'];
    }

    /** Lanza 403 si el rol activo no puede tocar datos de esa sucursal. */
    public static function exigirSucursal(Peticion $req, int $sucursalId): void
    {
        $propia = self::sucursalDe($req);
        if ($propia !== null && $propia !== $sucursalId) throw new ErrorApi('Esa información es de otra sucursal', 403);
    }
}
