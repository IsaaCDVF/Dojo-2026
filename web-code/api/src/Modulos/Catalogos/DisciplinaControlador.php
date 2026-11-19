<?php
declare(strict_types=1);
namespace Dojo\Modulos\Catalogos;

use Dojo\Modulos\Bitacora\Bitacora;
use Dojo\Nucleo\{Db, ErrorApi, Peticion, Respuesta};

final class DisciplinaControlador
{
    public function listar(Peticion $req): void
    {
        Respuesta::ok(Db::todos('SELECT d.id, d.nombre, d.activa, COUNT(g.id) grados
                                 FROM disciplinas d LEFT JOIN grados g ON g.disciplina_id = d.id AND g.activo = 1
                                 GROUP BY d.id ORDER BY d.nombre'));
    }

    public function crear(Peticion $req): void
    {
        $d = $req->requeridos('nombre');
        if (Db::uno('SELECT 1 FROM disciplinas WHERE nombre = ?', [$d['nombre']])) throw new ErrorApi('Esa disciplina ya existe', 409);
        $id = Db::transaccion(function () use ($req, $d) {
            $id = Db::insertar('INSERT INTO disciplinas (nombre) VALUES (?)', [$d['nombre']]);
            Bitacora::alta($req, 'disciplinas', $id, $d);
            return $id;
        });
        Respuesta::ok(['id' => $id] + $d, 201);
    }

    public function grados(Peticion $req): void
    {
        Respuesta::ok(Db::todos('SELECT id, nombre, orden, color_cinta FROM grados WHERE disciplina_id = ? AND activo = 1 ORDER BY orden',
            [$req->params['id']]));
    }
}
