<?php
declare(strict_types=1);
namespace Dojo\Modulos\Catalogos;

use Dojo\Modulos\Bitacora\Bitacora;
use Dojo\Nucleo\{Db, ErrorApi, Peticion, Respuesta};
use Dojo\Nucleo\Middleware\Permiso;

/** Ejemplo completo de catálogo: listar, alta y cambio con bitácora. Copiar este patrón. */
final class SucursalControlador
{
    public function listar(Peticion $req): void
    {
        $s = Permiso::sucursalDe($req);
        Respuesta::ok($s === null
            ? Db::todos('SELECT id, clave, nombre, activa FROM sucursales ORDER BY nombre')
            : Db::todos('SELECT id, clave, nombre, activa FROM sucursales WHERE id = ?', [$s]));
    }

    public function crear(Peticion $req): void
    {
        $d = $req->requeridos('clave', 'nombre');
        $d['clave'] = strtoupper($d['clave']);
        if (!preg_match('/^[A-Z]{4}$/', $d['clave'])) throw new ErrorApi('La clave debe tener 4 letras', 422);
        if (Db::uno('SELECT 1 FROM sucursales WHERE clave = ? OR nombre = ?', [$d['clave'], $d['nombre']])) {
            throw new ErrorApi('Ya existe una sucursal con esa clave o nombre', 409);
        }
        $id = Db::transaccion(function () use ($req, $d) {
            $id = Db::insertar('INSERT INTO sucursales (clave, nombre) VALUES (?, ?)', [$d['clave'], $d['nombre']]);
            Bitacora::alta($req, 'sucursales', $id, $d, $id);
            return $id;
        });
        Respuesta::ok(['id' => $id] + $d, 201);
    }

    public function editar(Peticion $req): void
    {
        $id = $req->params['id'];
        $antes = Db::uno('SELECT nombre, activa FROM sucursales WHERE id = ?', [$id]);
        if (!$antes) throw new ErrorApi('Sucursal no encontrada', 404);
        $nuevo = array_intersect_key($req->cuerpo, ['nombre' => 1, 'activa' => 1]);
        if (isset($nuevo['activa'])) $nuevo['activa'] = (int) (bool) $nuevo['activa'];
        if (!$nuevo) throw new ErrorApi('Nada que cambiar', 422);
        $cambios = Db::transaccion(function () use ($req, $id, $antes, $nuevo) {
            $set = implode(', ', array_map(fn($c) => "$c = ?", array_keys($nuevo)));
            Db::ejecutar("UPDATE sucursales SET $set WHERE id = ?", [...array_values($nuevo), $id]);
            return Bitacora::cambio($req, 'sucursales', $id, $antes, $nuevo, $id);
        });
        Respuesta::ok(['id' => $id, 'campos_cambiados' => $cambios]);
    }
}
