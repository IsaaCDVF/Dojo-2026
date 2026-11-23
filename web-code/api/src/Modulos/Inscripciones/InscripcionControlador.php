<?php
declare(strict_types=1);
namespace Dojo\Modulos\Inscripciones;

use Dojo\Modulos\Bitacora\Bitacora;
use Dojo\Nucleo\{Db, ErrorApi, Peticion, Respuesta};
use Dojo\Nucleo\Middleware\Permiso;

/**
 * 2.5 Inscripción: alumno + horario + grado de ubicación.
 * Reglas "flexibles con registro": si el grado no entra en el rango del horario o la clase
 * está llena, la API responde 409 con el motivo; el panel pregunta y, si el usuario confirma,
 * se manda forzar=true y queda en la bitácora.
 * La cuenta inicial (inscripción, mensualidad, uniforme con promoción) se calcula con /api/cotizar;
 * el cobro se registra en Caja (fase 4).
 */
final class InscripcionControlador
{
    /** POST /api/inscripciones  {alumno_id, horario_id, grado_id?, forzar?} */
    public function crear(Peticion $req): void
    {
        $d = $req->requeridos('alumno_id', 'horario_id');
        $forzar = !empty($req->cuerpo['forzar']);
        $a = Db::uno('SELECT id, sucursal_id, estado FROM alumnos WHERE id = ?', [(int) $d['alumno_id']]);
        if (!$a) throw new ErrorApi('Alumno no encontrado', 404);
        if ($a['estado'] !== 'activo') throw new ErrorApi('El alumno no está activo', 409);
        $h = Db::uno('SELECT h.id, h.sucursal_id, h.disciplina_id, h.cupo, h.activo, gd.orden AS orden_desde, gh.orden AS orden_hasta, d.nombre AS disciplina
                      FROM horarios h JOIN disciplinas d ON d.id = h.disciplina_id
                      LEFT JOIN grados gd ON gd.id = h.grado_desde_id LEFT JOIN grados gh ON gh.id = h.grado_hasta_id WHERE h.id = ?', [(int) $d['horario_id']]);
        if (!$h || !$h['activo']) throw new ErrorApi('Horario no encontrado o inactivo', 404);
        Permiso::exigirSucursal($req, (int) $h['sucursal_id']);

        if (Db::uno('SELECT 1 FROM inscripciones WHERE alumno_id = ? AND horario_id = ? AND (fecha_fin IS NULL OR fecha_fin >= CURDATE())', [$a['id'], $h['id']])) {
            throw new ErrorApi('El alumno ya está inscrito en ese horario', 409, ['motivo' => 'duplicado']);
        }

        // Grado: el que mandan (ubicación) o el último que tiene en esa disciplina, o el primero
        $actual = Db::uno('SELECT g.id, g.orden, g.nombre FROM alumno_grados ag JOIN grados g ON g.id = ag.grado_id
                           WHERE ag.alumno_id = ? AND g.disciplina_id = ? ORDER BY ag.fecha_obtencion DESC, ag.id DESC LIMIT 1', [$a['id'], $h['disciplina_id']]);
        $gradoId = !empty($req->cuerpo['grado_id']) ? (int) $req->cuerpo['grado_id'] : null;
        $ubicacion = null;
        if ($gradoId) {
            $ubicacion = Db::uno('SELECT id, orden, nombre FROM grados WHERE id = ? AND disciplina_id = ? AND activo = 1', [$gradoId, $h['disciplina_id']]);
            if (!$ubicacion) throw new ErrorApi("Ese grado no es de {$h['disciplina']}", 422);
        }
        $grado = $actual && (!$ubicacion || $ubicacion['id'] === $actual['id']) ? $actual : ($ubicacion ?? Db::uno(
            'SELECT id, orden, nombre FROM grados WHERE disciplina_id = ? AND activo = 1 ORDER BY orden LIMIT 1', [$h['disciplina_id']]));
        if (!$grado) throw new ErrorApi("{$h['disciplina']} no tiene grados dados de alta", 422);
        $nuevoGrado = !$actual || $actual['id'] !== $grado['id'];

        $avisos = [];
        if (($h['orden_desde'] !== null && $grado['orden'] < $h['orden_desde']) || ($h['orden_hasta'] !== null && $grado['orden'] > $h['orden_hasta'])) {
            $avisos[] = ['motivo' => 'fuera_de_rango', 'mensaje' => "El grado {$grado['nombre']} no está en el rango de esta clase"];
        }
        if ($h['cupo'] !== null) {
            $n = (int) Db::uno('SELECT COUNT(*) n FROM inscripciones i JOIN alumnos x ON x.id = i.alumno_id
                                WHERE i.horario_id = ? AND (i.fecha_fin IS NULL OR i.fecha_fin >= CURDATE()) AND x.estado = "activo"', [$h['id']])['n'];
            if ($n >= (int) $h['cupo']) $avisos[] = ['motivo' => 'cupo_lleno', 'mensaje' => "La clase ya tiene {$n} de {$h['cupo']} lugares ocupados"];
        }
        if ($avisos && !$forzar) {
            throw new ErrorApi(implode('. ', array_column($avisos, 'mensaje')), 409, ['avisos' => $avisos, 'se_puede_forzar' => true]);
        }

        $instructor = !empty($req->cuerpo['evaluado_por']) ? (int) $req->cuerpo['evaluado_por'] : null;
        $res = Db::transaccion(function () use ($req, $a, $h, $grado, $nuevoGrado, $instructor, $avisos) {
            $iid = Db::insertar('INSERT INTO inscripciones (alumno_id, horario_id, fecha_inicio) VALUES (?, ?, CURDATE())', [$a['id'], $h['id']]);
            if ($nuevoGrado) {
                Db::ejecutar('INSERT INTO alumno_grados (alumno_id, grado_id, fecha_obtencion, origen, evaluado_por) VALUES (?, ?, CURDATE(), "ubicacion", ?)',
                    [$a['id'], $grado['id'], $instructor]);
            }
            $datos = ['alumno_id' => $a['id'], 'horario_id' => $h['id'], 'grado' => $grado['nombre']];
            if ($avisos) $datos['excepcion'] = implode('; ', array_column($avisos, 'motivo'));
            Bitacora::alta($req, 'inscripciones', $iid, $datos, (int) $h['sucursal_id']);
            return ['id' => $iid, 'grado' => $grado['nombre'], 'excepciones' => array_column($avisos, 'motivo')];
        });
        Respuesta::ok($res, 201);
    }

    /** PUT /api/inscripciones/{id}/terminar — el alumno deja ese horario (no se borra) */
    public function terminar(Peticion $req): void
    {
        $i = Db::uno('SELECT i.id, i.fecha_fin, h.sucursal_id FROM inscripciones i JOIN horarios h ON h.id = i.horario_id WHERE i.id = ?', [$req->params['id']]);
        if (!$i) throw new ErrorApi('Inscripción no encontrada', 404);
        Permiso::exigirSucursal($req, (int) $i['sucursal_id']);
        if ($i['fecha_fin'] !== null && $i['fecha_fin'] < date('Y-m-d')) throw new ErrorApi('Esa inscripción ya terminó', 409);
        Db::transaccion(function () use ($req, $i) {
            Db::ejecutar('UPDATE inscripciones SET fecha_fin = CURDATE() WHERE id = ?', [$i['id']]);
            Bitacora::cambio($req, 'inscripciones', (int) $i['id'], ['fecha_fin' => $i['fecha_fin']], ['fecha_fin' => date('Y-m-d')], (int) $i['sucursal_id']);
        });
        Respuesta::ok(['id' => (int) $i['id'], 'fecha_fin' => date('Y-m-d')]);
    }
}
