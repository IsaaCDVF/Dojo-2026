<?php
declare(strict_types=1);
namespace Dojo\Modulos\Inicio;

use Dojo\Modulos\Pagos\EstadoCuenta;
use Dojo\Nucleo\{Db, ErrorApi, Peticion, Respuesta};
use Dojo\Nucleo\Middleware\Permiso;

/**
 * S-02 · Inicio: los números del día según el rol. Cada bloque solo se calcula si el rol tiene el permiso
 * de esa área; así recepción ve caja y adeudos, el instructor sus clases y exámenes por autorizar, etc.
 */
final class InicioControlador
{
    /** GET /api/inicio?sucursal_id= */
    public function resumen(Peticion $req): void
    {
        if (empty($req->ctx['rol'])) throw new ErrorApi('Elige con qué rol vas a trabajar', 409);
        $s = Permiso::sucursalDe($req) ?? (!empty($req->query['sucursal_id']) ? (int) $req->query['sucursal_id'] : null);
        $fs = fn(string $col) => $s ? " AND $col = $s" : '';     // $s es entero: seguro dentro del SQL
        $hoy = date('Y-m-d');
        $r = ['fecha' => $hoy, 'sucursal_id' => $s];

        if (Permiso::tiene($req, 'alumnos.ver')) {
            $r['alumnos'] = Db::uno('SELECT SUM(estado = "activo") AS activos, SUM(estado = "activo" AND fecha_alta >= DATE_FORMAT(CURDATE(), "%Y-%m-01")) AS nuevos_mes,
                                            SUM(estado = "suspendido") AS suspendidos FROM alumnos a WHERE 1 = 1' . $fs('a.sucursal_id'));
            $r['alumnos']['sin_foto'] = (int) Db::uno('SELECT COUNT(*) n FROM alumnos a JOIN personas p ON p.id = a.persona_id WHERE a.estado = "activo" AND p.foto IS NULL' . $fs('a.sucursal_id'))['n'];
        }
        if (Permiso::tiene($req, 'pagos.ver', 'caja.corte')) {
            $r['caja'] = Db::uno('SELECT COUNT(DISTINCT p.id) AS pagos, COALESCE(SUM(d.monto_cobrado - d.descuento_aplicado), 0) AS cobrado
                                  FROM pagos p JOIN pago_detalles d ON d.pago_id = p.id WHERE p.estado = "aprobado" AND p.metodo <> "saldo_favor" AND DATE(p.fecha) = CURDATE()' . $fs('p.sucursal_id'));
            $venc = EstadoCuenta::vencidos($s);
            $r['vencidos'] = ['alumnos' => count($venc), 'lista' => array_slice($venc, 0, 8)];
        }
        if (Permiso::tiene($req, 'examenes.programar', 'examenes.validar', 'examenes.solicitar', 'examenes.excepcion')) {
            $r['examenes'] = Db::uno('SELECT SUM(se.estado = "por_autorizar") AS por_autorizar, SUM(se.estado = "fuera_de_plazo") AS fuera_de_plazo,
                                             SUM(se.estado = "autorizada" AND se.pago_detalle_id IS NULL) AS sin_pago
                                      FROM solicitudes_examen se JOIN examenes e ON e.id = se.examen_id WHERE e.estado = "programado"' . $fs('e.sucursal_id'));
            $r['examenes']['proximos'] = Db::todos('SELECT e.id, e.fecha, d.nombre AS disciplina, s.nombre AS sucursal, e.sede,
                                                           (SELECT COUNT(*) FROM solicitudes_examen x WHERE x.examen_id = e.id AND x.estado NOT IN ("cancelada","no_autorizada")) AS solicitudes
                                                    FROM examenes e JOIN disciplinas d ON d.id = e.disciplina_id JOIN sucursales s ON s.id = e.sucursal_id
                                                    WHERE e.estado = "programado" AND e.fecha >= CURDATE()' . $fs('e.sucursal_id') . ' ORDER BY e.fecha LIMIT 3');
        }
        if (Permiso::tiene($req, 'asistencia.validar', 'asistencia.manual', 'asistencia.ver', 'horarios.ver')) {
            $yo = Db::uno('SELECT i.id FROM instructores i JOIN usuarios u ON u.persona_id = i.persona_id WHERE u.id = ?', [$req->ctx['usuario_id']]);
            $r['asistencia'] = Db::uno('SELECT COUNT(*) AS registros, COUNT(DISTINCT alumno_id) AS alumnos FROM asistencias WHERE DATE(fecha_hora) = CURDATE()' . $fs('sucursal_id'))
                + ['rechazos' => (int) Db::uno('SELECT COUNT(*) n FROM accesos_rechazados WHERE DATE(fecha_hora) = CURDATE()' . $fs('sucursal_id'))['n']];
            $clases = Db::todos(
                'SELECT h.id, d.nombre AS disciplina, h.nivel, s.nombre AS sucursal, TIME_FORMAT(h.hora_inicio, "%H:%i") AS hora_inicio, TIME_FORMAT(h.hora_fin, "%H:%i") AS hora_fin,
                        CONCAT(p.nombre, " ", p.apellido_paterno) AS instructor, h.instructor_id,
                        (SELECT COUNT(*) FROM inscripciones i JOIN alumnos a ON a.id = i.alumno_id WHERE i.horario_id = h.id AND a.estado = "activo"
                          AND i.fecha_inicio <= CURDATE() AND (i.fecha_fin IS NULL OR i.fecha_fin >= CURDATE())) AS inscritos,
                        (SELECT COUNT(*) FROM asistencias x WHERE x.horario_id = h.id AND DATE(x.fecha_hora) = CURDATE()) AS asistieron
                 FROM horarios h JOIN disciplinas d ON d.id = h.disciplina_id JOIN sucursales s ON s.id = h.sucursal_id
                 JOIN instructores ins ON ins.id = h.instructor_id JOIN personas p ON p.id = ins.persona_id
                 WHERE h.activo = 1 AND h.dia_semana = ?' . $fs('h.sucursal_id') . ' ORDER BY h.hora_inicio', [(int) date('N')]);
            $ahora = date('H:i');
            foreach ($clases as &$c) {
                $c['mia'] = $yo && (int) $c['instructor_id'] === (int) $yo['id'];
                $c['estado'] = $ahora > $c['hora_fin'] ? 'terminada' : ($ahora >= $c['hora_inicio'] ? 'en_curso' : 'proxima');
            }
            $r['clases'] = $clases;
        }
        Respuesta::ok($r);
    }
}
