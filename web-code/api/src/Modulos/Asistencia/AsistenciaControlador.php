<?php
declare(strict_types=1);
namespace Dojo\Modulos\Asistencia;

use Dojo\Modulos\Bitacora\Bitacora;
use Dojo\Modulos\Pagos\EstadoCuenta;
use Dojo\Nucleo\{Db, ErrorApi, Parametros, Peticion, Respuesta};
use Dojo\Nucleo\Middleware\Permiso;

/**
 * Fase 3 · Asistencia (BPMN-03). La tableta lee el QR del alumno; la clase la busca sola (la de ahorita en la que está
 * inscrito) o se elige a mano.
 * Reglas, en este orden:
 *   1. El QR existe y el alumno está activo .......................... si no: "alumno_baja"
 *   2. Está inscrito en esa clase, o es alumno nuestro de otra sucursal
 *      inscrito en la misma disciplina y no pasa de N visitas al mes .... si no: "no_inscrito" / "visita_rechazada"
 *   3. Pagos: si debe una mensualidad YA VENCIDA (pasó la tolerancia) no entra ("adeudo");
 *      si está dentro de la tolerancia entra con aviso de cuándo vence
 *   4. No se registra dos veces la misma clase el mismo día (409)
 *   5. Llega después de N minutos del inicio = retardo (se calcula, no se guarda). N retardos = 1 falta
 * Los rechazos de la tableta quedan en accesos_rechazados para que el instructor los vea.
 */
final class AsistenciaControlador
{
    private const MOTIVOS = [
        'alumno_baja' => 'Tu credencial no está activa. Pasa a recepción.',
        'no_inscrito' => 'No estás inscrito en esta clase.',
        'visita_rechazada' => 'Ya usaste tus visitas a otra sucursal de este mes.',
        'adeudo' => 'Tienes un pago vencido. Pasa a recepción a ponerte al corriente.',
    ];

    /** GET /api/asistencias/clases?sucursal_id=&fecha= — las clases del día para la tableta o el instructor */
    public function clases(Peticion $req): void
    {
        $fecha = $this->fecha($req->query['fecha'] ?? null);
        $suc = Permiso::sucursalDe($req) ?? (!empty($req->query['sucursal_id']) ? (int) $req->query['sucursal_id'] : null);
        if (!$suc) throw new ErrorApi('Elige la sucursal', 422);
        $dia = (int) (new \DateTimeImmutable($fecha))->format('N');
        $yo = Db::uno('SELECT i.id FROM instructores i JOIN usuarios u ON u.persona_id = i.persona_id WHERE u.id = ?', [$req->ctx['usuario_id']]);
        $lista = Db::todos(
            'SELECT h.id, h.disciplina_id, d.nombre AS disciplina, h.nivel, TIME_FORMAT(h.hora_inicio, "%H:%i") AS hora_inicio,
                    TIME_FORMAT(h.hora_fin, "%H:%i") AS hora_fin, CONCAT(p.nombre, " ", p.apellido_paterno) AS instructor, h.instructor_id,
                    (SELECT COUNT(*) FROM inscripciones i JOIN alumnos a ON a.id = i.alumno_id WHERE i.horario_id = h.id AND a.estado = "activo"
                      AND i.fecha_inicio <= ? AND (i.fecha_fin IS NULL OR i.fecha_fin >= ?)) AS inscritos,
                    (SELECT COUNT(*) FROM asistencias s WHERE s.horario_id = h.id AND DATE(s.fecha_hora) = ?) AS asistieron
             FROM horarios h JOIN disciplinas d ON d.id = h.disciplina_id JOIN instructores ins ON ins.id = h.instructor_id
             JOIN personas p ON p.id = ins.persona_id
             WHERE h.sucursal_id = ? AND h.dia_semana = ? AND h.activo = 1 ORDER BY h.hora_inicio, d.nombre',
            [$fecha, $fecha, $fecha, $suc, $dia]);
        $ahora = date('H:i');
        foreach ($lista as &$h) {
            $h['mia'] = $yo && (int) $h['instructor_id'] === (int) $yo['id'];
            $h['estado'] = $fecha !== date('Y-m-d') ? ($fecha < date('Y-m-d') ? 'terminada' : 'proxima')
                : ($ahora > $h['hora_fin'] ? 'terminada' : ($ahora >= $h['hora_inicio'] ? 'en_curso' : 'proxima'));
        }
        Respuesta::ok(['fecha' => $fecha, 'sucursal_id' => $suc, 'clases' => $lista]);
    }

    /**
     * POST /api/asistencias/qr {codigo, horario_id?, sucursal_id?} — la tableta lee la credencial.
     * Sin horario_id la clase se busca sola: de las clases de hoy en la sucursal (desde 1 h antes hasta que terminan),
     * la más cercana a esta hora en la que está inscrito y que no ha registrado; si no está inscrito en ninguna,
     * una de su misma disciplina (visita); si tampoco, la más cercana (y se rechaza como no inscrito).
     */
    public function qr(Peticion $req): void
    {
        $d = $req->requeridos('codigo');
        $codigo = trim((string) $d['codigo']);
        $a = Db::uno('SELECT id FROM alumnos WHERE codigo_qr = ?', [$codigo]);
        if (!$a) throw new ErrorApi('Código no reconocido. Usa la credencial del alumno.', 404);
        $h = !empty($req->cuerpo['horario_id']) ? $this->horario((int) $req->cuerpo['horario_id'], $req) : $this->claseDeAhorita((int) $a['id'], $req);
        $alumno = $this->alumno((int) $a['id'], (int) $h['disciplina_id']);

        // Solo se registra la clase de hoy, desde una hora antes hasta que termina
        $ahora = new \DateTimeImmutable();
        if ((int) $ahora->format('N') !== (int) $h['dia_semana']) throw new ErrorApi('Esa clase no es hoy', 409);
        $ini = new \DateTimeImmutable(date('Y-m-d ') . $h['hora_inicio']);
        $fin = new \DateTimeImmutable(date('Y-m-d ') . $h['hora_fin']);
        if ($ahora > $fin) throw new ErrorApi('La clase de las ' . substr($h['hora_inicio'], 0, 5) . ' ya terminó', 409);
        if ($ahora < $ini->modify('-60 minutes')) throw new ErrorApi('La clase de las ' . substr($h['hora_inicio'], 0, 5) . ' todavía no empieza', 409);

        $ev = $this->evaluar($alumno, $h, date('Y-m-d'));
        if (!$ev['permitido']) {
            Db::ejecutar('INSERT INTO accesos_rechazados (alumno_id, horario_id, sucursal_id, fecha_hora, motivo) VALUES (?, ?, ?, NOW(), ?)',
                [$alumno['id'], $h['id'], $h['sucursal_id'], $ev['motivo']]);
            throw new ErrorApi(self::MOTIVOS[$ev['motivo']], 403, ['resultado' => 'negado', 'motivo' => $ev['motivo'], 'alumno' => $alumno, 'avisos' => $ev['avisos']]);
        }
        $this->sinRepetir($alumno, $h, date('Y-m-d'));
        $id = Db::insertar('INSERT INTO asistencias (alumno_id, horario_id, sucursal_id, fecha_hora, metodo) VALUES (?, ?, ?, NOW(), "qr")',
            [$alumno['id'], $h['id'], $h['sucursal_id']]);
        Respuesta::ok($this->respuesta($id, $alumno, $h, $ev, $ahora), 201);
    }

    /** POST /api/asistencias {alumno_id, horario_id, fecha?, forzar?} — registro manual del instructor o recepción */
    public function manual(Peticion $req): void
    {
        $d = $req->requeridos('alumno_id', 'horario_id');
        $h = $this->horario((int) $d['horario_id'], $req);
        $alumno = $this->alumno((int) $d['alumno_id'], (int) $h['disciplina_id']);
        $fecha = $this->fecha($req->cuerpo['fecha'] ?? null);
        $hoy = date('Y-m-d');
        if ($fecha > $hoy) throw new ErrorApi('No se registra asistencia a futuro', 422);
        if ($fecha < date('Y-m-d', strtotime('-7 days'))) throw new ErrorApi('Solo se corrige la asistencia de los últimos 7 días', 422);
        if ((int) (new \DateTimeImmutable($fecha))->format('N') !== (int) $h['dia_semana']) throw new ErrorApi('Esa clase no se da ese día', 422);

        $ev = $this->evaluar($alumno, $h, $fecha);
        $forzar = !empty($req->cuerpo['forzar']);
        if (!$ev['permitido'] && ($ev['motivo'] === 'alumno_baja' || !$forzar)) {
            throw new ErrorApi(self::MOTIVOS[$ev['motivo']], 409, ['motivo' => $ev['motivo'], 'se_puede_forzar' => $ev['motivo'] !== 'alumno_baja', 'avisos' => $ev['avisos']]);
        }
        $this->sinRepetir($alumno, $h, $fecha);
        $cuando = $fecha === $hoy ? date('Y-m-d H:i:s') : "$fecha {$h['hora_inicio']}";
        $id = Db::transaccion(function () use ($req, $alumno, $h, $cuando, $ev) {
            $id = Db::insertar('INSERT INTO asistencias (alumno_id, horario_id, sucursal_id, fecha_hora, metodo, registrado_por) VALUES (?, ?, ?, ?, "manual", ?)',
                [$alumno['id'], $h['id'], $h['sucursal_id'], $cuando, $req->ctx['usuario_id']]);
            Bitacora::alta($req, 'asistencias', $id, ['alumno_id' => $alumno['id'], 'horario_id' => $h['id'], 'fecha' => $cuando,
                'excepcion' => $ev['permitido'] ? null : $ev['motivo']], (int) $h['sucursal_id']);
            return $id;
        });
        Respuesta::ok($this->respuesta($id, $alumno, $h, $ev, new \DateTimeImmutable($cuando)), 201);
    }

    /** GET /api/asistencias/clase/{id}?fecha= — lista de la clase: inscritos con su asistencia, visitantes y rechazos */
    public function lista(Peticion $req): void
    {
        $h = $this->horario((int) $req->params['id'], $req);
        $fecha = $this->fecha($req->query['fecha'] ?? null);
        $ret = $this->minutosRetardo($h);
        $alumnos = Db::todos(
            'SELECT a.id, a.matricula, CONCAT(p.nombre, " ", p.apellido_paterno) AS nombre, (p.foto IS NOT NULL) AS tiene_foto, a.sucursal_id,
                    (i.id IS NOT NULL) AS inscrito, s.id AS asistencia_id, s.fecha_hora, s.metodo, s.validada_instructor,
                    (s.id IS NOT NULL AND TIMESTAMPDIFF(MINUTE, TIMESTAMP(DATE(s.fecha_hora), ?), s.fecha_hora) > ?) AS retardo,
                    (SELECT g.nombre FROM alumno_grados ag JOIN grados g ON g.id = ag.grado_id WHERE ag.alumno_id = a.id AND g.disciplina_id = ?
                      ORDER BY ag.fecha_obtencion DESC, ag.id DESC LIMIT 1) AS grado,
                    (SELECT g.color_cinta FROM alumno_grados ag JOIN grados g ON g.id = ag.grado_id WHERE ag.alumno_id = a.id AND g.disciplina_id = ?
                      ORDER BY ag.fecha_obtencion DESC, ag.id DESC LIMIT 1) AS color_cinta
             FROM alumnos a JOIN personas p ON p.id = a.persona_id
             LEFT JOIN inscripciones i ON i.alumno_id = a.id AND i.horario_id = ? AND i.fecha_inicio <= ? AND (i.fecha_fin IS NULL OR i.fecha_fin >= ?)
             LEFT JOIN asistencias s ON s.alumno_id = a.id AND s.horario_id = ? AND DATE(s.fecha_hora) = ?
             WHERE (i.id IS NOT NULL AND a.estado = "activo") OR s.id IS NOT NULL
             ORDER BY (s.id IS NULL), p.nombre',
            [$h['hora_inicio'], $ret, $h['disciplina_id'], $h['disciplina_id'], $h['id'], $fecha, $fecha, $h['id'], $fecha]);
        foreach ($alumnos as &$a) $a['visita'] = (int) $a['sucursal_id'] !== (int) $h['sucursal_id'];
        $rechazos = Db::todos(
            'SELECT r.id, r.alumno_id, CONCAT(p.nombre, " ", p.apellido_paterno) AS nombre, r.fecha_hora, r.motivo
             FROM accesos_rechazados r JOIN alumnos a ON a.id = r.alumno_id JOIN personas p ON p.id = a.persona_id
             WHERE r.horario_id = ? AND DATE(r.fecha_hora) = ? ORDER BY r.fecha_hora DESC', [$h['id'], $fecha]);
        $asist = array_filter($alumnos, fn($a) => $a['asistencia_id']);
        Respuesta::ok(['clase' => $h, 'fecha' => $fecha, 'minutos_retardo' => $ret, 'alumnos' => $alumnos, 'rechazos' => $rechazos,
            'resumen' => ['inscritos' => count(array_filter($alumnos, fn($a) => (int) $a['inscrito'])), 'asistieron' => count($asist),
                          'retardos' => count(array_filter($asist, fn($a) => (int) $a['retardo'])),
                          'sin_validar' => count(array_filter($asist, fn($a) => !(int) $a['validada_instructor']))]]);
    }

    /** PUT /api/asistencias/clase/{id}/validar {fecha?} — el instructor da por buena la lista del día */
    public function validar(Peticion $req): void
    {
        $h = $this->horario((int) $req->params['id'], $req);
        $fecha = $this->fecha($req->cuerpo['fecha'] ?? null);
        $n = Db::ejecutar('UPDATE asistencias SET validada_instructor = 1 WHERE horario_id = ? AND DATE(fecha_hora) = ? AND validada_instructor = 0', [$h['id'], $fecha]);
        if ($n) Bitacora::cambio($req, 'horarios', (int) $h['id'], ['asistencia_validada' => "pendiente $fecha"], ['asistencia_validada' => "$n registros del $fecha"], (int) $h['sucursal_id']);
        Respuesta::ok(['horario_id' => (int) $h['id'], 'fecha' => $fecha, 'validadas' => $n]);
    }

    /** DELETE /api/asistencias/{id} — quitar un registro equivocado (queda en bitácora) */
    public function quitar(Peticion $req): void
    {
        $s = Db::uno('SELECT id, alumno_id, horario_id, sucursal_id, fecha_hora, metodo FROM asistencias WHERE id = ?', [$req->params['id']]);
        if (!$s) throw new ErrorApi('Registro no encontrado', 404);
        Permiso::exigirSucursal($req, (int) $s['sucursal_id']);
        Db::transaccion(function () use ($req, $s) {
            Db::ejecutar('DELETE FROM asistencias WHERE id = ?', [$s['id']]);
            Bitacora::cambio($req, 'asistencias', (int) $s['id'], ['registro' => "alumno {$s['alumno_id']}, clase {$s['horario_id']}, {$s['fecha_hora']} ({$s['metodo']})"], ['registro' => 'eliminado'], (int) $s['sucursal_id']);
        });
        Respuesta::ok(['id' => (int) $s['id'], 'eliminada' => true]);
    }

    /** GET /api/alumnos/{id}/asistencia?desde=&hasta= — historial con retardos y faltas por retardo */
    public function historial(Peticion $req): void
    {
        $aid = (int) $req->params['id'];
        Permiso::exigirAlumno($req, $aid);
        $a = Db::uno('SELECT id, sucursal_id FROM alumnos WHERE id = ?', [$aid]);
        if (!$a) throw new ErrorApi('Alumno no encontrado', 404);
        if (Permiso::alumnosPropios($req) === null) Permiso::exigirSucursal($req, (int) $a['sucursal_id']);
        $hasta = $this->fecha($req->query['hasta'] ?? null);
        $desde = $this->fecha($req->query['desde'] ?? date('Y-m-d', strtotime($hasta . ' -90 days')));
        $filas = Db::todos(
            'SELECT s.id, s.fecha_hora, s.metodo, s.validada_instructor, s.sucursal_id, su.nombre AS sucursal, d.nombre AS disciplina, h.disciplina_id,
                    TIME_FORMAT(h.hora_inicio, "%H:%i") AS hora_inicio, h.nivel, TIMESTAMPDIFF(MINUTE, TIMESTAMP(DATE(s.fecha_hora), h.hora_inicio), s.fecha_hora) AS minutos_tarde
             FROM asistencias s JOIN horarios h ON h.id = s.horario_id JOIN disciplinas d ON d.id = h.disciplina_id JOIN sucursales su ON su.id = s.sucursal_id
             WHERE s.alumno_id = ? AND DATE(s.fecha_hora) BETWEEN ? AND ? ORDER BY s.fecha_hora DESC', [$aid, $desde, $hasta]);
        $retardos = 0;
        foreach ($filas as &$f) {
            $lim = (int) (Parametros::valor('minutos_retardo', (int) $f['sucursal_id'], (int) $f['disciplina_id']) ?? 30);
            $f['retardo'] = (int) $f['minutos_tarde'] > $lim;
            $f['visita'] = (int) $f['sucursal_id'] !== (int) $a['sucursal_id'];
            $retardos += $f['retardo'] ? 1 : 0;
        }
        $porFalta = max(1, (int) (Parametros::valor('retardos_por_falta', (int) $a['sucursal_id']) ?? 3));
        $rech = Db::todos('SELECT r.fecha_hora, r.motivo, d.nombre AS disciplina FROM accesos_rechazados r JOIN horarios h ON h.id = r.horario_id
                           JOIN disciplinas d ON d.id = h.disciplina_id WHERE r.alumno_id = ? AND DATE(r.fecha_hora) BETWEEN ? AND ? ORDER BY r.fecha_hora DESC',
            [$aid, $desde, $hasta]);
        Respuesta::ok(['desde' => $desde, 'hasta' => $hasta, 'asistencias' => $filas, 'rechazos' => $rech,
            'resumen' => ['asistencias' => count($filas), 'retardos' => $retardos, 'retardos_por_falta' => $porFalta,
                          'faltas_por_retardo' => intdiv($retardos, $porFalta),
                          'visitas_mes' => $this->visitasDelMes($aid, (int) $a['sucursal_id'], date('Y-m-d'))]]);
    }

    /** PUT /api/alumnos/{id}/qr — nueva credencial; la anterior deja de servir */
    public function regenerarQr(Peticion $req): void
    {
        $a = Db::uno('SELECT id, sucursal_id FROM alumnos WHERE id = ?', [$req->params['id']]);
        if (!$a) throw new ErrorApi('Alumno no encontrado', 404);
        Permiso::exigirSucursal($req, (int) $a['sucursal_id']);
        $nuevo = bin2hex(random_bytes(16));
        Db::transaccion(function () use ($req, $a, $nuevo) {
            Db::ejecutar('UPDATE alumnos SET codigo_qr = ? WHERE id = ?', [$nuevo, $a['id']]);
            Bitacora::cambio($req, 'alumnos', (int) $a['id'], ['codigo_qr' => 'anterior'], ['codigo_qr' => 'regenerado'], (int) $a['sucursal_id']);
        });
        Respuesta::ok(['id' => (int) $a['id'], 'codigo_qr' => $nuevo]);
    }

    /* ---------------- reglas ---------------- */

    private function evaluar(array $alumno, array $h, string $fecha): array
    {
        $avisos = [];
        if ($alumno['estado'] !== 'activo') return ['permitido' => false, 'motivo' => 'alumno_baja', 'avisos' => [], 'visita' => false];
        $visita = (int) $alumno['sucursal_id'] !== (int) $h['sucursal_id'];
        $inscrito = Db::uno('SELECT 1 FROM inscripciones WHERE alumno_id = ? AND horario_id = ? AND fecha_inicio <= ? AND (fecha_fin IS NULL OR fecha_fin >= ?)',
            [$alumno['id'], $h['id'], $fecha, $fecha]);
        $restantes = null;
        if (!$inscrito) {
            $tieneDisciplina = Db::uno('SELECT 1 FROM inscripciones i JOIN horarios x ON x.id = i.horario_id WHERE i.alumno_id = ? AND x.disciplina_id = ?
                                        AND i.fecha_inicio <= ? AND (i.fecha_fin IS NULL OR i.fecha_fin >= ?)', [$alumno['id'], $h['disciplina_id'], $fecha, $fecha]);
            if (!$visita || !$tieneDisciplina) {
                $suyas = Db::todos('SELECT x.dia_semana, TIME_FORMAT(x.hora_inicio, "%H:%i") AS hora FROM inscripciones i JOIN horarios x ON x.id = i.horario_id
                                    WHERE i.alumno_id = ? AND x.disciplina_id = ? AND (i.fecha_fin IS NULL OR i.fecha_fin >= ?) ORDER BY x.dia_semana, x.hora_inicio',
                    [$alumno['id'], $h['disciplina_id'], $fecha]);
                $dias = ['', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
                if ($suyas) $avisos[] = 'Tu clase de ' . $h['disciplina'] . ': ' . implode(', ', array_map(fn($x) => $dias[$x['dia_semana']] . ' ' . $x['hora'], $suyas));
                return ['permitido' => false, 'motivo' => 'no_inscrito', 'avisos' => $avisos, 'visita' => $visita];
            }
            $max = (int) (Parametros::valor('visitas_por_mes', (int) $h['sucursal_id']) ?? 3);
            $usadas = $this->visitasDelMes((int) $alumno['id'], (int) $alumno['sucursal_id'], $fecha);
            if ($usadas >= $max) return ['permitido' => false, 'motivo' => 'visita_rechazada', 'avisos' => ["Llevas $usadas de $max visitas este mes"], 'visita' => true];
            $restantes = $max - $usadas - 1;
            $avisos[] = 'Visita desde ' . $alumno['sucursal'] . ': te quedan ' . $restantes . ' este mes';
        }
        // Pagos: vencida = ya pasó la tolerancia
        foreach (EstadoCuenta::deAlumno((int) $alumno['id']) as $l) {
            if ($l['estado'] === 'vencida' && !str_starts_with($l['clave'], 'exa:')) {
                return ['permitido' => false, 'motivo' => 'adeudo', 'avisos' => ["{$l['concepto']}" . ($l['detalle'] ? " de {$l['detalle']}" : '') . ' vencida desde el ' . $this->corta($l['vence'])], 'visita' => $visita];
            }
        }
        foreach (EstadoCuenta::deAlumno((int) $alumno['id']) as $l) {
            if ($l['estado'] === 'pendiente' && str_starts_with($l['clave'], 'mens:')) $avisos[] = "Tu mensualidad de {$l['detalle']} vence el " . $this->corta($l['vence']);
            if (str_starts_with($l['clave'], 'insc:')) $avisos[] = 'Tienes la inscripción pendiente de pago';
        }
        return ['permitido' => true, 'motivo' => null, 'avisos' => $avisos, 'visita' => $visita, 'visitas_restantes' => $restantes];
    }

    private function respuesta(int $id, array $alumno, array $h, array $ev, \DateTimeImmutable $cuando): array
    {
        $tarde = (int) floor(($cuando->getTimestamp() - (new \DateTimeImmutable($cuando->format('Y-m-d ') . $h['hora_inicio']))->getTimestamp()) / 60);
        $retardo = $tarde > $this->minutosRetardo($h);
        $avisos = $ev['avisos'];
        if ($retardo) {
            $mes = (int) Db::uno('SELECT COUNT(*) n FROM asistencias s JOIN horarios x ON x.id = s.horario_id
                                  WHERE s.alumno_id = ? AND DATE_FORMAT(s.fecha_hora, "%Y-%m") = ? AND TIMESTAMPDIFF(MINUTE, TIMESTAMP(DATE(s.fecha_hora), x.hora_inicio), s.fecha_hora) > ?',
                [$alumno['id'], $cuando->format('Y-m'), $this->minutosRetardo($h)])['n'];
            $porFalta = max(1, (int) (Parametros::valor('retardos_por_falta', (int) $h['sucursal_id'], (int) $h['disciplina_id']) ?? 3));
            array_unshift($avisos, "Llegaste $tarde min tarde. Retardos este mes: $mes" . ($mes % $porFalta === 0 ? " (suman una falta)" : " de $porFalta para una falta"));
        }
        return ['id' => $id, 'resultado' => $retardo ? 'retardo' : 'bienvenido', 'minutos_tarde' => max(0, $tarde), 'visita' => $ev['visita'],
                'alumno' => $alumno, 'clase' => ['id' => (int) $h['id'], 'disciplina' => $h['disciplina'], 'hora_inicio' => substr($h['hora_inicio'], 0, 5)],
                'avisos' => $avisos];
    }

    /** La clase de ahorita para ese alumno en la sucursal de la tableta (ver qr()) */
    private function claseDeAhorita(int $alumnoId, Peticion $req): array
    {
        $suc = Permiso::sucursalDe($req) ?? (!empty($req->cuerpo['sucursal_id']) ? (int) $req->cuerpo['sucursal_id'] : null);
        if (!$suc) throw new ErrorApi('Elige la sucursal', 422);
        $hoy = date('Y-m-d');
        $cand = Db::todos('SELECT h.id, h.disciplina_id, ABS(TIMESTAMPDIFF(MINUTE, TIMESTAMP(CURDATE(), h.hora_inicio), NOW())) distancia,
                                  EXISTS(SELECT 1 FROM inscripciones i WHERE i.alumno_id = ? AND i.horario_id = h.id AND i.fecha_inicio <= ? AND (i.fecha_fin IS NULL OR i.fecha_fin >= ?)) inscrito,
                                  EXISTS(SELECT 1 FROM inscripciones i JOIN horarios x ON x.id = i.horario_id WHERE i.alumno_id = ? AND x.disciplina_id = h.disciplina_id
                                          AND i.fecha_inicio <= ? AND (i.fecha_fin IS NULL OR i.fecha_fin >= ?)) misma_disciplina,
                                  EXISTS(SELECT 1 FROM asistencias s WHERE s.alumno_id = ? AND s.horario_id = h.id AND DATE(s.fecha_hora) = ?) registrada
                           FROM horarios h WHERE h.sucursal_id = ? AND h.activo = 1 AND h.dia_semana = ?
                             AND NOW() BETWEEN TIMESTAMP(CURDATE(), h.hora_inicio) - INTERVAL 60 MINUTE AND TIMESTAMP(CURDATE(), h.hora_fin)
                           ORDER BY distancia, h.hora_inicio',
            [$alumnoId, $hoy, $hoy, $alumnoId, $hoy, $hoy, $alumnoId, $hoy, $suc, (int) date('N')]);
        if (!$cand) throw new ErrorApi('Ahorita no hay clases en esta sucursal', 409, ['resultado' => 'sin_clase']);
        $elegir = fn($f) => array_values(array_filter($cand, $f))[0] ?? null;
        $h = $elegir(fn($c) => $c['inscrito'] && !$c['registrada']) ?? $elegir(fn($c) => $c['inscrito'])
          ?? $elegir(fn($c) => $c['misma_disciplina'] && !$c['registrada']) ?? $elegir(fn($c) => $c['misma_disciplina']) ?? $cand[0];
        return $this->horario((int) $h['id'], $req);
    }

    private function sinRepetir(array $alumno, array $h, string $fecha): void
    {
        $ya = Db::uno('SELECT fecha_hora FROM asistencias WHERE alumno_id = ? AND horario_id = ? AND DATE(fecha_hora) = ?', [$alumno['id'], $h['id'], $fecha]);
        if ($ya) throw new ErrorApi($alumno['nombre'] . ' ya registró esta clase a las ' . substr($ya['fecha_hora'], 11, 5), 409, ['resultado' => 'repetida', 'alumno' => $alumno]);
    }

    private function visitasDelMes(int $alumnoId, int $sucursalPropia, string $fecha): int
    {
        return (int) Db::uno('SELECT COUNT(*) n FROM asistencias WHERE alumno_id = ? AND sucursal_id <> ? AND DATE_FORMAT(fecha_hora, "%Y-%m") = ?',
            [$alumnoId, $sucursalPropia, substr($fecha, 0, 7)])['n'];
    }

    private function minutosRetardo(array $h): int
    {
        return (int) (Parametros::valor('minutos_retardo', (int) $h['sucursal_id'], (int) $h['disciplina_id']) ?? 30);
    }

    private function horario(int $id, Peticion $req): array
    {
        $h = Db::uno('SELECT h.id, h.sucursal_id, s.nombre AS sucursal, h.disciplina_id, d.nombre AS disciplina, h.dia_semana, h.hora_inicio, h.hora_fin, h.nivel, h.activo,
                             CONCAT(p.nombre, " ", p.apellido_paterno) AS instructor
                      FROM horarios h JOIN sucursales s ON s.id = h.sucursal_id JOIN disciplinas d ON d.id = h.disciplina_id
                      JOIN instructores i ON i.id = h.instructor_id JOIN personas p ON p.id = i.persona_id WHERE h.id = ?', [$id]);
        if (!$h) throw new ErrorApi('Clase no encontrada', 404);
        Permiso::exigirSucursal($req, (int) $h['sucursal_id']);
        if (!(int) $h['activo']) throw new ErrorApi('Esa clase ya no está activa', 409);
        return $h;
    }

    private function alumno(int $id, int $disciplina): array
    {
        $a = Db::uno('SELECT a.id, a.matricula, a.estado, a.sucursal_id, s.nombre AS sucursal, CONCAT(p.nombre, " ", p.apellido_paterno) AS nombre,
                             (p.foto IS NOT NULL) AS tiene_foto,
                             (SELECT g.nombre FROM alumno_grados ag JOIN grados g ON g.id = ag.grado_id WHERE ag.alumno_id = a.id AND g.disciplina_id = ?
                               ORDER BY ag.fecha_obtencion DESC, ag.id DESC LIMIT 1) AS grado,
                             (SELECT g.color_cinta FROM alumno_grados ag JOIN grados g ON g.id = ag.grado_id WHERE ag.alumno_id = a.id AND g.disciplina_id = ?
                               ORDER BY ag.fecha_obtencion DESC, ag.id DESC LIMIT 1) AS color_cinta
                      FROM alumnos a JOIN personas p ON p.id = a.persona_id JOIN sucursales s ON s.id = a.sucursal_id WHERE a.id = ?', [$disciplina, $disciplina, $id]);
        if (!$a) throw new ErrorApi('Alumno no encontrado', 404);
        $a['id'] = (int) $a['id'];
        return $a;
    }

    private function fecha(?string $f): string
    {
        $f = $f ?: date('Y-m-d');
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $f) || !strtotime($f)) throw new ErrorApi('Fecha no válida (AAAA-MM-DD)', 422);
        return $f;
    }

    private function corta(?string $f): string
    {
        if (!$f) return '';
        $m = ['', 'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
        return (int) substr($f, 8, 2) . ' ' . $m[(int) substr($f, 5, 2)];
    }
}
