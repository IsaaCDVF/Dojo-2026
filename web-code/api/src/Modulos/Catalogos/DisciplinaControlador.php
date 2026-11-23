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

    /** PUT /api/disciplinas/{id}  {nombre?, activa?} — baja lógica con activa = 0 */
    public function editar(Peticion $req): void
    {
        $id = $req->params['id'];
        $antes = Db::uno('SELECT nombre, activa FROM disciplinas WHERE id = ?', [$id]);
        if (!$antes) throw new ErrorApi('Disciplina no encontrada', 404);
        $nuevo = array_intersect_key($req->cuerpo, ['nombre' => 1, 'activa' => 1]);
        if (isset($nuevo['nombre'])) {
            $nuevo['nombre'] = trim((string) $nuevo['nombre']);
            if ($nuevo['nombre'] === '') throw new ErrorApi('El nombre no puede quedar vacío', 422);
            if (Db::uno('SELECT 1 FROM disciplinas WHERE nombre = ? AND id <> ?', [$nuevo['nombre'], $id])) throw new ErrorApi('Ya existe una disciplina con ese nombre', 409);
        }
        if (isset($nuevo['activa'])) $nuevo['activa'] = (int) (bool) $nuevo['activa'];
        if (!$nuevo) throw new ErrorApi('Nada que cambiar', 422);
        $n = Db::transaccion(function () use ($req, $id, $antes, $nuevo) {
            $set = implode(', ', array_map(fn($c) => "$c = ?", array_keys($nuevo)));
            Db::ejecutar("UPDATE disciplinas SET $set WHERE id = ?", [...array_values($nuevo), $id]);
            return Bitacora::cambio($req, 'disciplinas', $id, $antes, $nuevo);
        });
        Respuesta::ok(['id' => $id, 'campos_cambiados' => $n]);
    }

    /** POST /api/disciplinas/{id}/grados  {nombre, color_cinta?} — se agrega al final del orden */
    public function crearGrado(Peticion $req): void
    {
        $id = $req->params['id'];
        $d = $req->requeridos('nombre');
        if (!Db::uno('SELECT 1 FROM disciplinas WHERE id = ?', [$id])) throw new ErrorApi('Disciplina no encontrada', 404);
        $nombre = trim($d['nombre']);
        if (Db::uno('SELECT 1 FROM grados WHERE disciplina_id = ? AND nombre = ? AND activo = 1', [$id, $nombre])) throw new ErrorApi('Ese grado ya existe en la disciplina', 409);
        $color = isset($req->cuerpo['color_cinta']) && trim($req->cuerpo['color_cinta']) !== '' ? trim($req->cuerpo['color_cinta']) : null;
        $nuevo = Db::transaccion(function () use ($req, $id, $nombre, $color) {
            $orden = (int) Db::uno('SELECT COALESCE(MAX(orden), 0) + 1 AS o FROM grados WHERE disciplina_id = ? FOR UPDATE', [$id])['o'];
            $gid = Db::insertar('INSERT INTO grados (disciplina_id, nombre, orden, color_cinta) VALUES (?, ?, ?, ?)', [$id, $nombre, $orden, $color]);
            Bitacora::alta($req, 'grados', $gid, ['disciplina_id' => $id, 'nombre' => $nombre, 'orden' => $orden, 'color_cinta' => $color]);
            return ['id' => $gid, 'orden' => $orden];
        });
        Respuesta::ok($nuevo + ['nombre' => $nombre, 'color_cinta' => $color], 201);
    }
}
