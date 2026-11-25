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
        // "a,b,c" = basta con tener cualquiera de esos permisos
        $claves = array_map('trim', explode(',', $clave));
        $marcas = implode(',', array_fill(0, count($claves), '?'));
        $tiene = Db::uno("SELECT 1 FROM rol_permisos rp JOIN permisos p ON p.id = rp.permiso_id
                          WHERE rp.rol_id = ? AND p.clave IN ($marcas) LIMIT 1", [$rol['rol_id'], ...$claves]);
        if (!$tiene) throw new ErrorApi('No tienes permiso para esta acción', 403, ['permiso' => $clave]);
    }

    /** true si el rol activo tiene alguno de los permisos (sin lanzar error) */
    public static function tiene(Peticion $req, string ...$claves): bool
    {
        $rol = $req->ctx['rol'] ?? null;
        if (!$rol || !$claves) return false;
        $marcas = implode(',', array_fill(0, count($claves), '?'));
        return (bool) Db::uno("SELECT 1 FROM rol_permisos rp JOIN permisos p ON p.id = rp.permiso_id WHERE rp.rol_id = ? AND p.clave IN ($marcas) LIMIT 1",
            [$rol['rol_id'], ...$claves]);
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

    /**
     * Roles de alcance "propio" (alumno, responsable): ids de los alumnos que le tocan
     * (él mismo y los que tiene a su cargo). null = el rol no es "propio" y no se filtra.
     */
    public static function alumnosPropios(Peticion $req): ?array
    {
        if (($req->ctx['rol']['alcance'] ?? '') !== 'propio') return null;
        $u = $req->ctx['usuario_id'];
        return array_map('intval', array_column(Db::todos(
            'SELECT a.id FROM alumnos a JOIN usuarios u ON u.persona_id = a.persona_id WHERE u.id = ?
             UNION SELECT ar.alumno_id FROM alumno_responsable ar JOIN responsables_pago r ON r.id = ar.responsable_id
             JOIN usuarios u ON u.persona_id = r.persona_id WHERE u.id = ? AND ar.vigente_hasta IS NULL', [$u, $u]), 'id'));
    }

    /** 403 si un rol "propio" intenta ver a un alumno que no es suyo */
    public static function exigirAlumno(Peticion $req, int $alumnoId): void
    {
        $propios = self::alumnosPropios($req);
        if ($propios !== null && !in_array($alumnoId, $propios, true)) throw new ErrorApi('Ese alumno no está a tu cargo', 403);
    }

    /** 403 si un rol "propio" intenta ver la cuenta de otro responsable */
    public static function exigirResponsable(Peticion $req, ?int $responsableId): void
    {
        if (($req->ctx['rol']['alcance'] ?? '') !== 'propio') return;
        if (!$responsableId || !Db::uno('SELECT 1 FROM responsables_pago r JOIN usuarios u ON u.persona_id = r.persona_id WHERE r.id = ? AND u.id = ?',
            [$responsableId, $req->ctx['usuario_id']])) throw new ErrorApi('Esa cuenta no es tuya', 403);
    }
}
