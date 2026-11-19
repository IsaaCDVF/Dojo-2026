<?php
declare(strict_types=1);
namespace Dojo\Modulos\Bitacora;

use Dojo\Nucleo\{Db, Peticion, Respuesta};
use Dojo\Nucleo\Middleware\Permiso;

final class BitacoraControlador
{
    /** GET /api/bitacora?tabla=sucursales&registro_id=1 */
    public function buscar(Peticion $req): void
    {
        $w = ['1 = 1']; $p = [];
        if (isset($req->query['tabla']))       { $w[] = 'b.tabla = ?';       $p[] = $req->query['tabla']; }
        if (isset($req->query['registro_id'])) { $w[] = 'b.registro_id = ?'; $p[] = (int) $req->query['registro_id']; }
        if (($s = Permiso::sucursalDe($req)) !== null) { $w[] = 'b.sucursal_id = ?'; $p[] = $s; }
        Respuesta::ok(Db::todos(
            'SELECT b.fecha_hora, b.accion, b.tabla, b.registro_id, b.campo, b.valor_anterior, b.valor_nuevo, u.email usuario
             FROM bitacora b JOIN usuarios u ON u.id = b.usuario_id
             WHERE ' . implode(' AND ', $w) . ' ORDER BY b.id DESC LIMIT 200', $p));
    }
}
