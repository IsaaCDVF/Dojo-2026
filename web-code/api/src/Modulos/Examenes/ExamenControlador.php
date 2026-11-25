<?php
declare(strict_types=1);
namespace Dojo\Modulos\Examenes;

use Dojo\Modulos\Bitacora\Bitacora;
use Dojo\Nucleo\{Db, ErrorApi, Parametros, Peticion, Respuesta};
use Dojo\Nucleo\Middleware\Permiso;

/**
 * Fase 5 · Exámenes (BPMN-04 y su subproceso).
 * Flujo de una solicitud:
 *   enviada a tiempo ............ por_autorizar
 *   enviada tarde ............... fuera_de_plazo → (excepción del admin) → por_autorizar | no_autorizada
 *   instructor decide ........... autorizada | no_autorizada (observaciones obligatorias)
 *   autorizada → se cobra en Caja (o excepción "presentar sin pago")
 *   resultado ................... aprobada (sube de grado) | reprobada (debe solicitar y pagar otra vez)
 *   cancelar .................... cancelada; si ya había pagado, el monto queda como saldo a favor (RN-32)
 * Los criterios (meses en el grado y % de asistencia) son una validación blanda: solo avisan (RN-30).
 */
final class ExamenControlador
{
    /** GET /api/examenes?estado=programado */
    public function listar(Peticion $req): void
    {
        $w = ['1 = 1']; $p = [];
        $s = Permiso::sucursalDe($req) ?? (!empty($req->query['sucursal_id']) ? (int) $req->query['sucursal_id'] : null);
        if ($s) { $w[] = 'e.sucursal_id = ?'; $p[] = $s; }
        if (!empty($req->query['estado'])) { $w[] = 'e.estado = ?'; $p[] = $req->query['estado']; }
        $lista = Db::todos(
            'SELECT e.id, e.sucursal_id, s.nombre AS sucursal, e.disciplina_id, d.nombre AS disciplina, e.fecha, e.sede, e.estado,
                    SUM(se.estado IN ("por_autorizar","fuera_de_plazo","enviada")) AS por_revisar,
                    SUM(se.estado = "autorizada") AS autorizadas, SUM(se.estado = "autorizada" AND se.pago_detalle_id IS NULL) AS sin_pago,
                    SUM(se.estado IN ("aprobada","reprobada")) AS con_resultado, COUNT(se.id) AS solicitudes
             FROM examenes e JOIN sucursales s ON s.id = e.sucursal_id JOIN disciplinas d ON d.id = e.disciplina_id
             LEFT JOIN solicitudes_examen se ON se.examen_id = e.id
             WHERE ' . implode(' AND ', $w) . ' GROUP BY e.id ORDER BY e.fecha DESC LIMIT 100', $p);
        foreach ($lista as &$e) $e['fecha_limite'] = $this->fechaLimite($e);
        Respuesta::ok($lista);
    }

    /** POST /api/examenes {sucursal_id?, disciplina_id, fecha: "AAAA-MM-DD HH:MM", sede?} */
    public function programar(Peticion $req): void
    {
        $d = $req->requeridos('disciplina_id', 'fecha');
        $suc = Permiso::sucursalDe($req) ?? (int) ($req->cuerpo['sucursal_id'] ?? 0);
        if (!$suc) throw new ErrorApi('Elige la sucursal', 422);
        $f = \DateTime::createFromFormat('Y-m-d H:i', substr(str_replace('T', ' ', $d['fecha']), 0, 16));
        if (!$f) throw new ErrorApi('Fecha no válida (AAAA-MM-DD HH:MM)', 422);
        if ($f < new \DateTime()) throw new ErrorApi('La fecha del examen ya pasó', 422);
        if (!Db::uno('SELECT 1 FROM disciplinas WHERE id = ? AND activa = 1', [(int) $d['disciplina_id']])) throw new ErrorApi('Disciplina no encontrada', 404);
        $sede = trim((string) ($req->cuerpo['sede'] ?? '')) ?: null;
        $id = Db::transaccion(function () use ($req, $suc, $d, $f, $sede) {
            $id = Db::insertar('INSERT INTO examenes (sucursal_id, disciplina_id, fecha, sede, programado_por) VALUES (?, ?, ?, ?, ?)',
                [$suc, (int) $d['disciplina_id'], $f->format('Y-m-d H:i:00'), $sede, $req->ctx['usuario_id']]);
            Bitacora::alta($req, 'examenes', $id, ['disciplina_id' => $d['disciplina_id'], 'fecha' => $f->format('Y-m-d H:i')], $suc);
            return $id;
        });
        Respuesta::ok(['id' => $id], 201);
    }

    /** GET /api/examenes/{id} — con sus solicitudes */
    public function ver(Peticion $req): void
    {
        $e = $this->examen((int) $req->params['id'], $req);
        $e['fecha_limite'] = $this->fechaLimite($e);
        $e['solicitudes'] = Db::todos(
            'SELECT se.id, se.alumno_id, a.matricula, CONCAT(pe.nombre, " ", pe.apellido_paterno) AS alumno, (pe.foto IS NOT NULL) AS tiene_foto,
                    se.estado, se.canal, se.cumplia_criterios, se.fecha_envio, se.observaciones, se.fecha_resolucion,
                    g.nombre AS grado_objetivo, g.color_cinta, (se.pago_detalle_id IS NOT NULL) AS pagado,
                    (SELECT GROUP_CONCAT(CONCAT(x.tipo, ":", x.decision) SEPARATOR ",") FROM excepciones_examen x WHERE x.solicitud_id = se.id) AS excepciones,
                    CONCAT(pi.nombre, " ", pi.apellido_paterno) AS instructor
             FROM solicitudes_examen se JOIN alumnos a ON a.id = se.alumno_id JOIN personas pe ON pe.id = a.persona_id
             JOIN grados g ON g.id = se.grado_objetivo_id
             LEFT JOIN instructores i ON i.id = se.instructor_id LEFT JOIN personas pi ON pi.id = i.persona_id
             WHERE se.examen_id = ?' . $this->soloPropios($req) . ' ORDER BY se.fecha_envio', [$e['id']]);
        Respuesta::ok($e);
    }

    /** GET /api/examenes/{id}/criterios?alumno_id= — qué grado presentaría y si cumple los criterios */
    public function criterios(Peticion $req): void
    {
        $e = $this->examen((int) $req->params['id'], $req);
        Permiso::exigirAlumno($req, (int) ($req->query['alumno_id'] ?? 0));
        Respuesta::ok($this->evaluar($e, (int) ($req->query['alumno_id'] ?? 0)));
    }

    /** POST /api/examenes/{id}/solicitudes {alumno_id} */
    public function solicitar(Peticion $req): void
    {
        $e = $this->examen((int) $req->params['id'], $req);
        if ($e['estado'] !== 'programado') throw new ErrorApi('Ese examen ya no recibe solicitudes', 409);
        $aid = (int) $req->requeridos('alumno_id')['alumno_id'];
        Permiso::exigirAlumno($req, $aid);
        $canal = in_array($req->ctx['rol']['nombre'] ?? '', ['alumno', 'responsable'], true) ? 'portal' : 'mostrador';
        Respuesta::ok($this->registrar($req, $e, $aid, $canal), 201);
    }

    /** La app del alumno (sin rol de personal) solicita examen; quien llama ya validó que el alumno es suyo */
    public function solicitarDesdeApp(Peticion $req, int $examenId, int $alumnoId): array
    {
        $e = Db::uno('SELECT e.id, e.sucursal_id, s.nombre AS sucursal, e.disciplina_id, d.nombre AS disciplina, e.fecha, e.sede, e.estado
                      FROM examenes e JOIN sucursales s ON s.id = e.sucursal_id JOIN disciplinas d ON d.id = e.disciplina_id WHERE e.id = ?', [$examenId]);
        if (!$e) throw new ErrorApi('Examen no encontrado', 404);
        if ($e['estado'] !== 'programado') throw new ErrorApi('Ese examen ya no recibe solicitudes', 409);
        return $this->registrar($req, $e, $alumnoId, 'portal');
    }

    private function registrar(Peticion $req, array $e, int $aid, string $canal): array
    {
        $ev = $this->evaluar($e, $aid);
        if (Db::uno('SELECT 1 FROM solicitudes_examen WHERE alumno_id = ? AND examen_id = ? AND estado NOT IN ("cancelada","no_autorizada")', [$aid, $e['id']])) {
            throw new ErrorApi('El alumno ya tiene una solicitud para este examen', 409);
        }
        $estado = $ev['en_plazo'] ? 'por_autorizar' : 'fuera_de_plazo';
        $id = Db::transaccion(function () use ($req, $e, $aid, $ev, $estado, $canal) {
            $id = Db::insertar('INSERT INTO solicitudes_examen (alumno_id, examen_id, grado_objetivo_id, fecha_envio, canal, registrada_por, cumplia_criterios, estado)
                                VALUES (?, ?, ?, NOW(), ?, ?, ?, ?)',
                [$aid, $e['id'], $ev['grado_objetivo']['id'], $canal, $canal === 'mostrador' ? $req->ctx['usuario_id'] : null, (int) $ev['cumple'], $estado]);
            Bitacora::alta($req, 'solicitudes_examen', $id, ['alumno_id' => $aid, 'grado' => $ev['grado_objetivo']['nombre'], 'estado' => $estado, 'cumplia' => (int) $ev['cumple'], 'canal' => $canal], (int) $e['sucursal_id']);
            return $id;
        });
        $avisos = [];
        if (!$ev['en_plazo']) $avisos[] = 'Llegó fuera de plazo: el administrador de la sucursal debe autorizar la excepción';
        if (!$ev['cumple']) $avisos[] = 'No cuenta con el periodo mínimo o la asistencia; verifica con administración';
        return ['id' => $id, 'estado' => $estado, 'cumplia_criterios' => $ev['cumple'], 'grado_objetivo' => $ev['grado_objetivo'], 'avisos' => $avisos];
    }

    /** PUT /api/solicitudes-examen/{id}/excepcion {tipo: fuera_de_plazo|presentar_sin_pago, decision: autorizada|rechazada, motivo} */
    public function excepcion(Peticion $req): void
    {
        $d = $req->requeridos('tipo', 'decision', 'motivo');
        if (!in_array($d['tipo'], ['fuera_de_plazo', 'presentar_sin_pago'], true) || !in_array($d['decision'], ['autorizada', 'rechazada'], true)) throw new ErrorApi('Tipo o decisión no válidos', 422);
        $s = $this->solicitud((int) $req->params['id'], $req);
        if ($d['tipo'] === 'fuera_de_plazo' && $s['estado'] !== 'fuera_de_plazo') throw new ErrorApi('La solicitud no está fuera de plazo', 409);
        if ($d['tipo'] === 'presentar_sin_pago' && ($s['estado'] !== 'autorizada' || $s['pago_detalle_id'])) throw new ErrorApi('Solo aplica a solicitudes autorizadas sin pago', 409);
        if (Db::uno('SELECT 1 FROM excepciones_examen WHERE solicitud_id = ? AND tipo = ?', [$s['id'], $d['tipo']])) throw new ErrorApi('Esa excepción ya se decidió', 409);
        Db::transaccion(function () use ($req, $s, $d) {
            Db::ejecutar('INSERT INTO excepciones_examen (solicitud_id, tipo, decision, motivo, decidido_por, fecha) VALUES (?, ?, ?, ?, ?, NOW())',
                [$s['id'], $d['tipo'], $d['decision'], trim($d['motivo']), $req->ctx['usuario_id']]);
            if ($d['tipo'] === 'fuera_de_plazo') {
                $nuevo = $d['decision'] === 'autorizada' ? 'por_autorizar' : 'no_autorizada';
                Db::ejecutar('UPDATE solicitudes_examen SET estado = ?, observaciones = IF(? = "no_autorizada", ?, observaciones) WHERE id = ?', [$nuevo, $nuevo, trim($d['motivo']), $s['id']]);
                Bitacora::cambio($req, 'solicitudes_examen', (int) $s['id'], ['estado' => $s['estado']], ['estado' => $nuevo], (int) $s['sucursal_id']);
            } else {
                Bitacora::alta($req, 'excepciones_examen', (int) $s['id'], ['tipo' => $d['tipo'], 'decision' => $d['decision']], (int) $s['sucursal_id']);
            }
        });
        Respuesta::ok(['id' => (int) $s['id'], 'tipo' => $d['tipo'], 'decision' => $d['decision']]);
    }

    /** PUT /api/solicitudes-examen/{id}/validar {decision: autorizada|no_autorizada, observaciones?} — instructor */
    public function validar(Peticion $req): void
    {
        $dec = $req->requeridos('decision')['decision'];
        if (!in_array($dec, ['autorizada', 'no_autorizada'], true)) throw new ErrorApi('Decisión no válida', 422);
        $obs = trim((string) ($req->cuerpo['observaciones'] ?? ''));
        if ($dec === 'no_autorizada' && $obs === '') throw new ErrorApi('Escribe las observaciones: son obligatorias al no autorizar', 422, ['campo' => 'observaciones']);
        $s = $this->solicitud((int) $req->params['id'], $req);
        if ($s['estado'] !== 'por_autorizar') throw new ErrorApi($s['estado'] === 'fuera_de_plazo' ? 'Primero el administrador debe autorizar la excepción de plazo' : 'La solicitud ya se resolvió', 409);
        $instructor = Db::uno('SELECT i.id FROM instructores i JOIN usuarios u ON u.persona_id = i.persona_id WHERE u.id = ?', [$req->ctx['usuario_id']]);
        Db::transaccion(function () use ($req, $s, $dec, $obs, $instructor) {
            Db::ejecutar('UPDATE solicitudes_examen SET estado = ?, instructor_id = ?, observaciones = ?, fecha_resolucion = NOW() WHERE id = ?',
                [$dec, $instructor['id'] ?? null, $obs ?: null, $s['id']]);
            Bitacora::cambio($req, 'solicitudes_examen', (int) $s['id'], ['estado' => $s['estado']], ['estado' => $dec], (int) $s['sucursal_id']);
        });
        Respuesta::ok(['id' => (int) $s['id'], 'estado' => $dec]);
    }

    /** PUT /api/solicitudes-examen/{id}/resultado {resultado: aprobada|reprobada} */
    public function resultado(Peticion $req): void
    {
        $res = $req->requeridos('resultado')['resultado'];
        if (!in_array($res, ['aprobada', 'reprobada'], true)) throw new ErrorApi('Resultado no válido', 422);
        $s = $this->solicitud((int) $req->params['id'], $req);
        if ($s['estado'] !== 'autorizada') throw new ErrorApi('Solo se captura resultado de solicitudes autorizadas', 409);
        if (!$s['pago_detalle_id'] && !Db::uno('SELECT 1 FROM excepciones_examen WHERE solicitud_id = ? AND tipo = "presentar_sin_pago" AND decision = "autorizada"', [$s['id']])) {
            throw new ErrorApi('El examen no está pagado. Cóbralo en Caja o pide al administrador la excepción para presentar con pago pendiente', 409);
        }
        Db::transaccion(function () use ($req, $s, $res) {
            Db::ejecutar('UPDATE solicitudes_examen SET estado = ? WHERE id = ?', [$res, $s['id']]);
            if ($res === 'aprobada') {
                Db::ejecutar('INSERT INTO alumno_grados (alumno_id, grado_id, fecha_obtencion, origen, solicitud_examen_id) VALUES (?, ?, CURDATE(), "examen", ?)',
                    [$s['alumno_id'], $s['grado_objetivo_id'], $s['id']]);
            }
            Bitacora::cambio($req, 'solicitudes_examen', (int) $s['id'], ['estado' => 'autorizada'], ['estado' => $res], (int) $s['sucursal_id']);
        });
        Respuesta::ok(['id' => (int) $s['id'], 'estado' => $res]);
    }

    /** PUT /api/solicitudes-examen/{id}/cancelar {motivo: no_pago|no_se_presento|a_peticion|otro, detalle?} */
    public function cancelar(Peticion $req): void
    {
        $m = $req->requeridos('motivo')['motivo'];
        if (!in_array($m, ['no_pago', 'no_se_presento', 'a_peticion', 'otro'], true)) throw new ErrorApi('Motivo no válido', 422);
        $s = $this->solicitud((int) $req->params['id'], $req);
        Permiso::exigirAlumno($req, (int) $s['alumno_id']);
        if (in_array($s['estado'], ['cancelada', 'aprobada', 'reprobada', 'no_autorizada'], true)) throw new ErrorApi('Esa solicitud ya está cerrada', 409);
        $saldo = Db::transaccion(function () use ($req, $s, $m) {
            $saldoId = null;
            if ($s['pago_detalle_id']) {
                $det = Db::uno('SELECT d.monto_cobrado - d.descuento_aplicado AS monto, p.responsable_id FROM pago_detalles d JOIN pagos p ON p.id = d.pago_id WHERE d.id = ? AND p.estado = "aprobado"', [$s['pago_detalle_id']]);
                if ($det && $det['responsable_id'] && (float) $det['monto'] > 0) {
                    $saldoId = Db::insertar('INSERT INTO saldos_favor (responsable_id, alumno_id, origen_pago_detalle_id, monto, fecha) VALUES (?, ?, ?, ?, NOW())',
                        [$det['responsable_id'], $s['alumno_id'], $s['pago_detalle_id'], $det['monto']]);
                }
            }
            Db::ejecutar('UPDATE solicitudes_examen SET estado = "cancelada" WHERE id = ?', [$s['id']]);
            Db::ejecutar('INSERT INTO cancelaciones_examen (solicitud_id, motivo, detalle, cancelado_por, fecha, saldo_favor_id) VALUES (?, ?, ?, ?, NOW(), ?)',
                [$s['id'], $m, trim((string) ($req->cuerpo['detalle'] ?? '')) ?: null, $req->ctx['usuario_id'], $saldoId]);
            Bitacora::cambio($req, 'solicitudes_examen', (int) $s['id'], ['estado' => $s['estado']], ['estado' => 'cancelada'], (int) $s['sucursal_id']);
            return $saldoId ? Db::uno('SELECT monto FROM saldos_favor WHERE id = ?', [$saldoId])['monto'] : null;
        });
        Respuesta::ok(['id' => (int) $s['id'], 'estado' => 'cancelada', 'saldo_favor' => $saldo]);
    }

    /** PUT /api/examenes/{id}/estado {estado: realizado|cancelado} */
    public function cambiarEstado(Peticion $req): void
    {
        $nuevo = $req->requeridos('estado')['estado'];
        if (!in_array($nuevo, ['realizado', 'cancelado'], true)) throw new ErrorApi('Estado no válido', 422);
        $e = $this->examen((int) $req->params['id'], $req);
        if ($e['estado'] !== 'programado') throw new ErrorApi('El examen ya está ' . $e['estado'], 409);
        if ($nuevo === 'realizado' && Db::uno('SELECT 1 FROM solicitudes_examen WHERE examen_id = ? AND estado = "autorizada"', [$e['id']])) {
            throw new ErrorApi('Hay alumnos autorizados sin resultado; captúralos o cancela sus solicitudes', 409);
        }
        Db::transaccion(function () use ($req, $e, $nuevo) {
            Db::ejecutar('UPDATE examenes SET estado = ? WHERE id = ?', [$nuevo, $e['id']]);
            Bitacora::cambio($req, 'examenes', (int) $e['id'], ['estado' => $e['estado']], ['estado' => $nuevo], (int) $e['sucursal_id']);
        });
        Respuesta::ok(['id' => (int) $e['id'], 'estado' => $nuevo]);
    }

    /* ---------- reglas ---------- */

    /** Criterios para el examen de una fecha: los del grado + si está en plazo */
    public function evaluar(array $e, int $aid): array
    {
        $a = Db::uno('SELECT id, sucursal_id, estado FROM alumnos WHERE id = ?', [$aid]);
        if (!$a) throw new ErrorApi('Alumno no encontrado', 404);
        if ($a['estado'] !== 'activo') throw new ErrorApi('El alumno no está activo', 409);
        if ((int) $a['sucursal_id'] !== (int) $e['sucursal_id']) throw new ErrorApi('El alumno es de otra sucursal', 422);
        $c = self::rumbo($aid, (int) $e['disciplina_id'], (int) $e['sucursal_id']);
        if (!$c['grado_actual']) throw new ErrorApi("El alumno no tiene grado en {$e['disciplina']}: inscríbelo primero", 422);
        if (!$c['grado_objetivo']) throw new ErrorApi('El alumno ya tiene el grado más alto', 422);
        $limite = $this->fechaLimite($e);
        return $c + ['fecha_limite' => $limite, 'en_plazo' => date('Y-m-d') <= $limite];
    }

    /**
     * Rumbo al siguiente grado en una disciplina (RN-30): meses en el grado y % de asistencia contra los parámetros.
     * Asistencia = clases a las que fue desde su último grado / clases que tuvo (semanas × horarios inscritos);
     * cada N retardos cuentan como una falta. grado_actual o grado_objetivo pueden venir en null.
     */
    public static function rumbo(int $aid, int $disc, int $suc): array
    {
        $actual = Db::uno('SELECT g.id, g.nombre, g.orden, g.color_cinta, ag.fecha_obtencion FROM alumno_grados ag JOIN grados g ON g.id = ag.grado_id
                           WHERE ag.alumno_id = ? AND g.disciplina_id = ? ORDER BY ag.fecha_obtencion DESC, ag.id DESC LIMIT 1', [$aid, $disc]);
        if (!$actual) return ['grado_actual' => null, 'grado_objetivo' => null, 'cumple' => false];
        $sig = Db::uno('SELECT id, nombre, color_cinta FROM grados WHERE disciplina_id = ? AND orden > ? AND activo = 1 ORDER BY orden LIMIT 1', [$disc, $actual['orden']]);
        $mesesReq = (int) (Parametros::valor('meses_minimos_grado', $suc, $disc, (int) $actual['id']) ?? 3);
        $pctReq = (int) (Parametros::valor('asistencia_minima_examen', $suc, $disc, (int) $actual['id']) ?? 80);
        $desde = new \DateTimeImmutable($actual['fecha_obtencion']);
        $dif = $desde->diff(new \DateTimeImmutable('today'));
        $meses = $dif->m + 12 * $dif->y;
        $minRet = (int) (Parametros::valor('minutos_retardo', $suc, $disc) ?? 30);
        $porFalta = max(1, (int) (Parametros::valor('retardos_por_falta', $suc, $disc) ?? 3));
        $c = Db::uno('SELECT COUNT(*) n, COALESCE(SUM(TIMESTAMPDIFF(MINUTE, TIMESTAMP(DATE(s.fecha_hora), h.hora_inicio), s.fecha_hora) > ?), 0) r
                      FROM asistencias s JOIN horarios h ON h.id = s.horario_id
                      WHERE s.alumno_id = ? AND h.disciplina_id = ? AND s.fecha_hora >= ?', [$minRet, $aid, $disc, $actual['fecha_obtencion']]);
        $retardos = (int) $c['r'];
        $asist = max(0, (int) $c['n'] - intdiv($retardos, $porFalta));
        $esperadas = (int) Db::uno('SELECT COALESCE(SUM(GREATEST(1, FLOOR(DATEDIFF(LEAST(CURDATE(), COALESCE(i.fecha_fin, CURDATE())), GREATEST(i.fecha_inicio, ?)) / 7))), 0) n
                                    FROM inscripciones i JOIN horarios h ON h.id = i.horario_id WHERE i.alumno_id = ? AND h.disciplina_id = ?',
            [$actual['fecha_obtencion'], $aid, $disc])['n'];
        $pct = $esperadas ? (int) round(min(100, $asist * 100 / $esperadas)) : 0;
        return [
            'grado_actual' => ['id' => (int) $actual['id'], 'nombre' => $actual['nombre'], 'color_cinta' => $actual['color_cinta'], 'desde' => $actual['fecha_obtencion']],
            'grado_objetivo' => $sig ? ['id' => (int) $sig['id'], 'nombre' => $sig['nombre'], 'color_cinta' => $sig['color_cinta']] : null,
            'meses_en_grado' => $meses, 'meses_requeridos' => $mesesReq, 'asistencia' => $pct, 'asistencia_requerida' => $pctReq,
            'clases_asistidas' => (int) $c['n'], 'clases_esperadas' => $esperadas, 'retardos' => $retardos,
            'cumple_meses' => $meses >= $mesesReq, 'cumple_asistencia' => $pct >= $pctReq, 'cumple' => $meses >= $mesesReq && $pct >= $pctReq,
        ];
    }

    /** Un alumno o responsable solo ve sus propias solicitudes dentro del examen */
    private function soloPropios(Peticion $req): string
    {
        $p = Permiso::alumnosPropios($req);
        return $p === null ? '' : ' AND se.alumno_id IN (' . ($p ? implode(',', $p) : '0') . ')';
    }

    public function fechaLimite(array $e): string
    {
        $dias = (int) (Parametros::valor('dias_anticipacion_examen', (int) $e['sucursal_id'], (int) $e['disciplina_id']) ?? 5);
        return (new \DateTimeImmutable(substr($e['fecha'], 0, 10)))->modify("-$dias days")->format('Y-m-d');
    }

    private function examen(int $id, Peticion $req): array
    {
        $e = Db::uno('SELECT e.id, e.sucursal_id, s.nombre AS sucursal, e.disciplina_id, d.nombre AS disciplina, e.fecha, e.sede, e.estado
                      FROM examenes e JOIN sucursales s ON s.id = e.sucursal_id JOIN disciplinas d ON d.id = e.disciplina_id WHERE e.id = ?', [$id]);
        if (!$e) throw new ErrorApi('Examen no encontrado', 404);
        if (Permiso::alumnosPropios($req) === null) Permiso::exigirSucursal($req, (int) $e['sucursal_id']);
        return $e;
    }

    private function solicitud(int $id, Peticion $req): array
    {
        $s = Db::uno('SELECT se.*, e.sucursal_id FROM solicitudes_examen se JOIN examenes e ON e.id = se.examen_id WHERE se.id = ?', [$id]);
        if (!$s) throw new ErrorApi('Solicitud no encontrada', 404);
        if (Permiso::alumnosPropios($req) === null) Permiso::exigirSucursal($req, (int) $s['sucursal_id']);
        return $s;
    }
}
