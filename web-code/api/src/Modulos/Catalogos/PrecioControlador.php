<?php
declare(strict_types=1);
namespace Dojo\Modulos\Catalogos;

use Dojo\Modulos\Bitacora\Bitacora;
use Dojo\Nucleo\{Db, ErrorApi, Peticion, Respuesta};

/**
 * Precios con vigencia. Igual que los parámetros: nunca se edita un precio,
 * se cierra el vigente (vigente_hasta = hoy) y se abre uno nuevo (vigente_desde = hoy).
 * Un precio está vigente si vigente_desde <= hoy y vigente_hasta es NULL o mayor que hoy.
 */
final class PrecioControlador
{
    /** GET /api/precios?sucursal_id=1 — cada concepto con su precio vigente (el de la sucursal gana al global) */
    public function listar(Peticion $req): void
    {
        $sucursal = isset($req->query['sucursal_id']) ? (int) $req->query['sucursal_id'] : null;
        $lista = Db::todos('SELECT id, nombre, tipo FROM conceptos ORDER BY tipo, nombre');
        foreach ($lista as &$c) $c['precio'] = Tarifas::precioVigente((int) $c['id'], $sucursal);
        Respuesta::ok(['sucursal_id' => $sucursal, 'conceptos' => $lista]);
    }

    /** POST /api/precios  {concepto_id, monto, sucursal_id?} */
    public function guardar(Peticion $req): void
    {
        $d = $req->requeridos('concepto_id', 'monto');
        $sucursal = isset($req->cuerpo['sucursal_id']) ? (int) $req->cuerpo['sucursal_id'] : null;
        if (!is_numeric($d['monto']) || (float) $d['monto'] <= 0) {
            throw new ErrorApi('El monto debe ser un número mayor que 0', 422);
        }
        $monto = Tarifas::aPesos(Tarifas::aCentavos($d['monto']));   // redondea a 2 decimales
        $concepto = Db::uno('SELECT id FROM conceptos WHERE id = ?', [(int) $d['concepto_id']]);
        if (!$concepto) throw new ErrorApi('Concepto no encontrado', 404);
        if ($sucursal !== null && !Db::uno('SELECT 1 FROM sucursales WHERE id = ?', [$sucursal])) {
            throw new ErrorApi('Sucursal no encontrada', 404);
        }

        $resultado = Db::transaccion(function () use ($req, $concepto, $sucursal, $monto) {
            $anterior = Db::uno(
                'SELECT id, monto FROM precios
                 WHERE concepto_id = ? AND sucursal_id <=> ?
                   AND vigente_desde <= CURDATE() AND (vigente_hasta IS NULL OR vigente_hasta > CURDATE())',
                [$concepto['id'], $sucursal]);
            if ($anterior) {
                Db::ejecutar('UPDATE precios SET vigente_hasta = CURDATE() WHERE id = ?', [$anterior['id']]);
            }
            $nuevoId = Db::insertar(
                'INSERT INTO precios (concepto_id, sucursal_id, monto, vigente_desde) VALUES (?, ?, ?, CURDATE())',
                [$concepto['id'], $sucursal, $monto]);
            if ($anterior) {
                Bitacora::cambio($req, 'precios', $nuevoId, ['monto' => $anterior['monto']], ['monto' => $monto], $sucursal);
            } else {
                Bitacora::alta($req, 'precios', $nuevoId, ['concepto_id' => $concepto['id'], 'monto' => $monto], $sucursal);
            }
            return ['id' => $nuevoId, 'anterior' => $anterior['monto'] ?? null, 'nuevo' => $monto];
        });
        Respuesta::ok($resultado, 201);
    }

    /** GET /api/precios/historial?concepto_id=1 — todos los precios que ha tenido, del más nuevo al más viejo */
    public function historial(Peticion $req): void
    {
        $id = (int) ($req->query['concepto_id'] ?? 0);
        if (!$id) throw new ErrorApi('Falta concepto_id', 422, ['faltan' => ['concepto_id']]);
        Respuesta::ok(Db::todos(
            'SELECT p.id, p.monto, p.vigente_desde, p.vigente_hasta, s.nombre AS sucursal
             FROM precios p LEFT JOIN sucursales s ON s.id = p.sucursal_id
             WHERE p.concepto_id = ? ORDER BY p.id DESC', [$id]));
    }
}
