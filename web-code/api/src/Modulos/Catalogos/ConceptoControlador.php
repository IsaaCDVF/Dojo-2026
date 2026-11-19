<?php
declare(strict_types=1);
namespace Dojo\Modulos\Catalogos;

use Dojo\Modulos\Bitacora\Bitacora;
use Dojo\Nucleo\{Db, ErrorApi, Peticion, Respuesta};

/** Lo que el dojo cobra: mensualidad, inscripción, examen, pase de un día, productos (uniforme, guantes...). */
final class ConceptoControlador
{
    private const TIPOS = ['mensualidad', 'inscripcion', 'examen', 'pase_dia', 'producto', 'recargo'];

    /** GET /api/conceptos?tipo=producto */
    public function listar(Peticion $req): void
    {
        $tipo = $req->query['tipo'] ?? null;
        Respuesta::ok($tipo
            ? Db::todos('SELECT id, nombre, tipo FROM conceptos WHERE tipo = ? ORDER BY nombre', [$tipo])
            : Db::todos('SELECT id, nombre, tipo FROM conceptos ORDER BY tipo, nombre'));
    }

    /** POST /api/conceptos  {nombre, tipo} */
    public function crear(Peticion $req): void
    {
        $d = $req->requeridos('nombre', 'tipo');
        $d['nombre'] = trim($d['nombre']);
        if (!in_array($d['tipo'], self::TIPOS, true)) {
            throw new ErrorApi('Tipo no válido', 422, ['permitidos' => self::TIPOS]);
        }
        if (Db::uno('SELECT 1 FROM conceptos WHERE nombre = ?', [$d['nombre']])) {
            throw new ErrorApi('Ya existe un concepto con ese nombre', 409);
        }
        $id = Db::transaccion(function () use ($req, $d) {
            $id = Db::insertar('INSERT INTO conceptos (nombre, tipo) VALUES (?, ?)', [$d['nombre'], $d['tipo']]);
            Bitacora::alta($req, 'conceptos', $id, $d);
            return $id;
        });
        Respuesta::ok(['id' => $id] + $d, 201);
    }
}
