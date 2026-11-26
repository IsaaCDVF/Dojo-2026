<?php
declare(strict_types=1);
namespace Dojo\Modulos\App;

use Dojo\Modulos\Catalogos\Tarifas;
use Dojo\Modulos\Examenes\ExamenControlador;
use Dojo\Modulos\Pagos\EstadoCuenta;
use Dojo\Nucleo\{Db, ErrorApi, Parametros, Peticion, Respuesta};

/**
 * Fase 6 · App del alumno y del responsable (/api/app/*).
 * No dependen del rol elegido: todo se decide por la persona del usuario. Un alumno ve lo suyo;
 * un responsable ve a los alumnos que tiene a su cargo y su estado de cuenta. Nadie ve a otra familia.
 */
final class AppControlador
{
    private const DIAS = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    private const DIAS_LARGOS = ['', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

    /** GET /api/app/yo */
    public function yo(Peticion $req): void
    {
        $pid = $this->persona($req);
        $p = Db::uno('SELECT nombre, apellido_paterno FROM personas WHERE id = ?', [$pid]);
        $propio = Db::uno('SELECT id FROM alumnos WHERE persona_id = ? AND estado <> "baja"', [$pid]);
        $resp = $this->misResponsables($pid);
        $alumnos = [];
        foreach ($this->misAlumnos($pid) as $aid) {
            $a = Db::uno('SELECT a.id, a.matricula, a.estado, s.nombre AS sucursal, p.nombre, p.apellido_paterno, (p.foto IS NOT NULL) AS tiene_foto
                          FROM alumnos a JOIN personas p ON p.id = a.persona_id JOIN sucursales s ON s.id = a.sucursal_id WHERE a.id = ?', [$aid]);
            $alumnos[] = $a + ['propio' => $propio && (int) $propio['id'] === $aid, 'grado' => $this->gradoPrincipal($aid)];
        }
        Respuesta::ok(['persona' => $p, 'alumno_id' => $propio ? (int) $propio['id'] : null, 'es_responsable' => (bool) $resp, 'alumnos' => $alumnos]);
    }

    /** GET /api/app/alumnos/{id}/inicio — saludo, QR, clases de hoy, rumbo al siguiente grado, semana y racha */
    public function inicio(Peticion $req): void
    {
        $a = $this->alumno($req, (int) $req->params['id']);
        $aid = (int) $a['id'];
        $hoy = new \DateTimeImmutable('today');
        $ahora = date('H:i:s');
        $insc = $this->inscripciones($aid);

        $clasesHoy = [];
        foreach ($insc as $i) {
            if ((int) $i['dia_semana'] !== (int) $hoy->format('N') || $i['fecha_inicio'] > $hoy->format('Y-m-d')) continue;
            $reg = Db::uno('SELECT TIME_FORMAT(fecha_hora, "%H:%i") h FROM asistencias WHERE alumno_id = ? AND horario_id = ? AND DATE(fecha_hora) = CURDATE()', [$aid, $i['horario_id']]);
            $clasesHoy[] = ['horario_id' => (int) $i['horario_id'], 'disciplina' => $i['disciplina'], 'nivel' => $i['nivel'], 'hora_inicio' => substr($i['hora_inicio'], 0, 5),
                            'hora_fin' => substr($i['hora_fin'], 0, 5), 'instructor' => $i['instructor'], 'registrada' => $reg['h'] ?? null,
                            'estado' => $ahora > $i['hora_fin'] ? 'terminada' : ($ahora >= $i['hora_inicio'] ? 'en_curso' : 'proxima')];
        }
        usort($clasesHoy, fn($x, $y) => strcmp($x['hora_inicio'], $y['hora_inicio']));
        $proxima = null;
        for ($d = 0; $d <= 7 && !$proxima; $d++) {
            $f = $hoy->modify("+$d days");
            $del = array_filter($insc, fn($i) => (int) $i['dia_semana'] === (int) $f->format('N') && ($d > 0 || $i['hora_inicio'] > $ahora));
            usort($del, fn($x, $y) => strcmp($x['hora_inicio'], $y['hora_inicio']));
            if ($del) { $i = array_values($del)[0]; $proxima = ['fecha' => $f->format('Y-m-d'), 'dia' => $d === 0 ? 'hoy' : ($d === 1 ? 'mañana' : 'el ' . self::DIAS_LARGOS[(int) $f->format('N')]),
                                                                  'hora' => substr($i['hora_inicio'], 0, 5), 'disciplina' => $i['disciplina'], 'nivel' => $i['nivel']]; }
        }

        // Rumbo al siguiente grado (disciplina principal)
        $rumbo = null;
        $disc = Db::uno('SELECT g.disciplina_id FROM alumno_grados ag JOIN grados g ON g.id = ag.grado_id WHERE ag.alumno_id = ? ORDER BY ag.fecha_obtencion DESC, ag.id DESC LIMIT 1', [$aid]);
        if ($disc) {
            $rumbo = ExamenControlador::rumbo($aid, (int) $disc['disciplina_id'], (int) $a['sucursal_id']);
            $rumbo['examen'] = $this->proximoExamen($aid, (int) $disc['disciplina_id'], (int) $a['sucursal_id']);
        }

        // Pagos (lo mismo que revisa la tableta)
        $pago = ['estado' => 'al_dia', 'vence' => null];
        foreach (EstadoCuenta::deAlumno($aid) as $l) {
            if (str_starts_with($l['clave'], 'exa:')) continue;
            if ($l['estado'] === 'vencida') { $pago = ['estado' => 'vencido', 'vence' => $l['vence'], 'concepto' => trim($l['concepto'] . ' ' . ($l['detalle'] ?? ''))]; break; }
            if ($l['estado'] === 'pendiente' && $pago['estado'] === 'al_dia') $pago = ['estado' => 'por_pagar', 'vence' => $l['vence'], 'concepto' => trim($l['concepto'] . ' ' . ($l['detalle'] ?? ''))];
        }

        [$semana, $racha] = $this->semanaYRacha($aid, $insc);
        Respuesta::ok(['alumno' => $a, 'grado' => $this->gradoPrincipal($aid), 'clases_hoy' => $clasesHoy, 'proxima_clase' => $proxima,
                       'rumbo' => $rumbo, 'semana' => $semana, 'racha' => $racha, 'pago' => $pago, 'equipo' => $this->equipo($aid), 'apariencia' => $this->apariencia($aid)]);
    }

    /** GET /api/app/alumnos/{id}/camino — grados de cada disciplina: obtenidos, actual, siguiente y bloqueados */
    public function camino(Peticion $req): void
    {
        $a = $this->alumno($req, (int) $req->params['id']);
        $aid = (int) $a['id'];
        $res = [];
        $discs = Db::todos('SELECT DISTINCT d.id, d.nombre FROM alumno_grados ag JOIN grados g ON g.id = ag.grado_id JOIN disciplinas d ON d.id = g.disciplina_id
                            WHERE ag.alumno_id = ? ORDER BY d.nombre', [$aid]);
        foreach ($discs as $d) {
            $actual = Db::uno('SELECT g.orden FROM alumno_grados ag JOIN grados g ON g.id = ag.grado_id WHERE ag.alumno_id = ? AND g.disciplina_id = ?
                               ORDER BY ag.fecha_obtencion DESC, ag.id DESC LIMIT 1', [$aid, $d['id']]);
            $grados = Db::todos('SELECT g.id, g.nombre, g.orden, g.color_cinta, i.nombre AS insignia,
                                        (SELECT MIN(ag.fecha_obtencion) FROM alumno_grados ag WHERE ag.alumno_id = ? AND ag.grado_id = g.id) AS fecha
                                 FROM grados g LEFT JOIN insignias i ON i.grado_id = g.id WHERE g.disciplina_id = ? AND g.activo = 1 ORDER BY g.orden', [$aid, $d['id']]);
            foreach ($grados as &$g) {
                $o = (int) $g['orden']; $ao = (int) $actual['orden'];
                $g['estado'] = $o < $ao ? 'obtenido' : ($o === $ao ? 'actual' : 'bloqueado');
            }
            unset($g);
            // El siguiente es el primero con orden mayor al actual (puede haber huecos de orden)
            $hay = false;
            foreach ($grados as &$g) { if ((int) $g['orden'] > (int) $actual['orden']) { $g['estado'] = $hay ? 'bloqueado' : 'siguiente'; $hay = true; } }
            unset($g);
            $res[] = ['disciplina_id' => (int) $d['id'], 'disciplina' => $d['nombre'], 'grados' => $grados,
                      'rumbo' => ExamenControlador::rumbo($aid, (int) $d['id'], (int) $a['sucursal_id']),
                      'examen' => $this->proximoExamen($aid, (int) $d['id'], (int) $a['sucursal_id'])];
        }
        Respuesta::ok(['alumno' => ['id' => $aid, 'nombre' => $a['nombre']], 'disciplinas' => $res, 'equipo' => $this->equipo($aid), 'apariencia' => $this->apariencia($aid)]);
    }

    /** GET /api/app/alumnos/{id}/avatar — accesorios (los desbloqueados por grado), lo que trae puesto e insignias */
    public function avatar(Peticion $req): void
    {
        $a = $this->alumno($req, (int) $req->params['id']);
        $aid = (int) $a['id'];
        $acc = Db::todos('SELECT x.id, x.nombre, x.tipo, x.imagen, g.nombre AS grado, g.color_cinta, d.nombre AS disciplina,
                                 (x.grado_id IS NULL OR EXISTS (SELECT 1 FROM alumno_grados ag JOIN grados g2 ON g2.id = ag.grado_id
                                    WHERE ag.alumno_id = ? AND g2.disciplina_id = g.disciplina_id AND g2.orden >= g.orden)) AS desbloqueado
                          FROM accesorios x LEFT JOIN grados g ON g.id = x.grado_id LEFT JOIN disciplinas d ON d.id = g.disciplina_id
                          ORDER BY FIELD(x.tipo, "cabeza","torso","mano","pies","piernas","fondo"), x.grado_id IS NOT NULL, g.orden, x.id', [$aid]);
        foreach ($acc as &$x) { $x['id'] = (int) $x['id']; $x['desbloqueado'] = (bool) $x['desbloqueado']; }
        $ins = Db::todos('SELECT i.id, i.nombre, i.imagen, g.nombre AS grado, g.color_cinta, g.orden, d.nombre AS disciplina,
                                 EXISTS (SELECT 1 FROM alumno_grados ag JOIN grados g2 ON g2.id = ag.grado_id
                                   WHERE ag.alumno_id = ? AND g2.disciplina_id = g.disciplina_id AND g2.orden >= g.orden) AS obtenida
                          FROM insignias i JOIN grados g ON g.id = i.grado_id JOIN disciplinas d ON d.id = g.disciplina_id
                          WHERE g.disciplina_id IN (SELECT g3.disciplina_id FROM alumno_grados ag3 JOIN grados g3 ON g3.id = ag3.grado_id WHERE ag3.alumno_id = ?)
                          ORDER BY d.nombre, g.orden', [$aid, $aid]);
        foreach ($ins as &$i) $i['obtenida'] = (bool) $i['obtenida'];
        Respuesta::ok(['alumno' => ['id' => $aid, 'nombre' => $a['nombre']], 'grado' => $this->gradoPrincipal($aid),
                       'accesorios' => $acc, 'equipo' => $this->equipo($aid), 'apariencia' => $this->apariencia($aid), 'insignias' => $ins]);
    }

    /**
     * PUT /api/app/alumnos/{id}/avatar {equipo?: [accesorio_id], apariencia?: {piel, peinado, color_pelo, vello, complexion}}
     * Equipo: uno por tipo y solo lo desbloqueado (lo bloqueado se puede probar en la app, pero no guardar).
     */
    public function guardarAvatar(Peticion $req): void
    {
        $a = $this->alumno($req, (int) $req->params['id']);
        $aid = (int) $a['id'];
        $hayEquipo = array_key_exists('equipo', $req->cuerpo);
        $ids = array_values(array_unique(array_map('intval', (array) ($req->cuerpo['equipo'] ?? []))));
        $tipos = [];
        foreach ($hayEquipo ? $ids : [] as $id) {
            $x = Db::uno('SELECT x.id, x.tipo, x.nombre, g.nombre AS grado,
                                 (x.grado_id IS NULL OR EXISTS (SELECT 1 FROM alumno_grados ag JOIN grados g2 ON g2.id = ag.grado_id
                                    WHERE ag.alumno_id = ? AND g2.disciplina_id = g.disciplina_id AND g2.orden >= g.orden)) AS ok
                          FROM accesorios x LEFT JOIN grados g ON g.id = x.grado_id WHERE x.id = ?', [$aid, $id]);
            if (!$x) throw new ErrorApi('Accesorio no encontrado', 404);
            if (!(int) $x['ok']) throw new ErrorApi("{$x['nombre']} se desbloquea al llegar a {$x['grado']}", 422);
            if (isset($tipos[$x['tipo']])) throw new ErrorApi('Solo un accesorio de cada tipo', 422);
            $tipos[$x['tipo']] = true;
        }
        $ap = null;
        if (isset($req->cuerpo['apariencia'])) {
            $ap = array_intersect_key($this->apariencia($aid), self::APARIENCIA);   // parte de lo actual (o lo básico)
            foreach ((array) $req->cuerpo['apariencia'] as $k => $v) {
                if (!isset(self::APARIENCIA[$k])) continue;
                if (!in_array((string) $v, self::APARIENCIA[$k], true)) throw new ErrorApi("Ese valor no existe para $k", 422, ['campo' => $k]);
                $ap[$k] = (string) $v;
            }
            if ($this->etapa($aid) === 'nino') $ap['vello'] = 'ninguno';
        }
        Db::transaccion(function () use ($aid, $ids, $hayEquipo, $ap) {
            if ($hayEquipo) {
                Db::ejecutar('DELETE FROM avatar_equipo WHERE alumno_id = ?', [$aid]);
                foreach ($ids as $id) Db::ejecutar('INSERT INTO avatar_equipo (alumno_id, accesorio_id) VALUES (?, ?)', [$aid, $id]);
            }
            if ($ap) Db::ejecutar('INSERT INTO avatar_apariencia (alumno_id, piel, peinado, color_pelo, vello, complexion) VALUES (?, ?, ?, ?, ?, ?)
                                   ON DUPLICATE KEY UPDATE piel = VALUES(piel), peinado = VALUES(peinado), color_pelo = VALUES(color_pelo),
                                   vello = VALUES(vello), complexion = VALUES(complexion)',
                [$aid, $ap['piel'], $ap['peinado'], $ap['color_pelo'], $ap['vello'], $ap['complexion']]);
        });
        Respuesta::ok(['equipo' => $this->equipo($aid), 'apariencia' => $this->apariencia($aid)]);
    }

    /** GET /api/app/alumnos/{id}/examenes — próximas fechas de su sucursal, sus criterios y sus solicitudes */
    public function examenes(Peticion $req): void
    {
        $a = $this->alumno($req, (int) $req->params['id']);
        $aid = (int) $a['id']; $suc = (int) $a['sucursal_id'];
        $ctrl = new ExamenControlador();
        $cExa = EstadoCuenta::concepto('examen');
        $precio = $cExa ? Tarifas::precioVigente((int) $cExa['id'], $suc) : null;
        $fechas = Db::todos('SELECT e.id, e.sucursal_id, s.nombre AS sucursal, e.disciplina_id, d.nombre AS disciplina, e.fecha, e.sede, e.estado
                             FROM examenes e JOIN sucursales s ON s.id = e.sucursal_id JOIN disciplinas d ON d.id = e.disciplina_id
                             WHERE e.sucursal_id = ? AND e.estado = "programado" AND e.fecha >= CURDATE()
                               AND e.disciplina_id IN (SELECT g.disciplina_id FROM alumno_grados ag JOIN grados g ON g.id = ag.grado_id WHERE ag.alumno_id = ?)
                             ORDER BY e.fecha LIMIT 6', [$suc, $aid]);
        foreach ($fechas as &$e) {
            try { $e['criterios'] = $ctrl->evaluar($e, $aid); } catch (ErrorApi $x) { $e['criterios'] = null; $e['no_disponible'] = $x->getMessage(); }
            $e['fecha_limite'] = $ctrl->fechaLimite($e);
            $e['solicitud'] = $this->solicitud($aid, (int) $e['id']);
        }
        unset($e);
        $hist = Db::todos('SELECT se.id, se.estado, se.fecha_envio, se.observaciones, g.nombre AS grado_objetivo, g.color_cinta, e.fecha, d.nombre AS disciplina,
                                  (se.pago_detalle_id IS NOT NULL) AS pagado
                           FROM solicitudes_examen se JOIN examenes e ON e.id = se.examen_id JOIN grados g ON g.id = se.grado_objetivo_id
                           JOIN disciplinas d ON d.id = e.disciplina_id WHERE se.alumno_id = ? ORDER BY se.fecha_envio DESC LIMIT 6', [$aid]);
        Respuesta::ok(['alumno' => ['id' => $aid, 'nombre' => $a['nombre']], 'precio' => $precio, 'fechas' => $fechas, 'historial' => $hist, 'equipo' => $this->equipo($aid), 'apariencia' => $this->apariencia($aid)]);
    }

    /** POST /api/app/alumnos/{id}/examenes/{examen} — solicitar desde la app (canal portal) */
    public function solicitar(Peticion $req): void
    {
        $a = $this->alumno($req, (int) $req->params['id']);
        $r = (new ExamenControlador())->solicitarDesdeApp($req, (int) $req->params['examen'], (int) $a['id']);
        $e = Db::uno('SELECT e.fecha, e.sede, d.nombre AS disciplina FROM examenes e JOIN disciplinas d ON d.id = e.disciplina_id WHERE e.id = ?', [(int) $req->params['examen']]);
        $instr = Db::uno('SELECT CONCAT(p.nombre, " ", p.apellido_paterno) AS nombre FROM inscripciones i JOIN horarios h ON h.id = i.horario_id
                          JOIN instructores ins ON ins.id = h.instructor_id JOIN personas p ON p.id = ins.persona_id
                          JOIN examenes e ON e.disciplina_id = h.disciplina_id AND e.id = ?
                          WHERE i.alumno_id = ? AND (i.fecha_fin IS NULL OR i.fecha_fin >= CURDATE()) LIMIT 1', [(int) $req->params['examen'], (int) $a['id']]);
        Respuesta::ok($r + ['examen' => $e, 'instructor' => $instr['nombre'] ?? null], 201);
    }

    /** GET /api/app/familia — el responsable: sus alumnos, lo que debe, saldo a favor y últimos pagos */
    public function familia(Peticion $req): void
    {
        $pid = $this->persona($req);
        $resp = $this->misResponsables($pid);
        if (!$resp) throw new ErrorApi('Esta cuenta no es de un responsable de pago', 403);
        $out = ['alumnos' => [], 'adeudos' => [], 'saldo_favor' => '0.00', 'pagos' => [], 'total' => '0.00', 'vencido' => '0.00'];
        $total = 0; $vencido = 0; $saldo = 0;
        foreach ($resp as $rid) {
            $edo = EstadoCuenta::de($rid, null);
            foreach ($edo['alumnos'] as $al) {
                $suyos = array_filter($edo['adeudos'], fn($l) => (int) $l['alumno_id'] === (int) $al['id']);
                $estado = 'al_dia';
                foreach ($suyos as $l) { if ($l['estado'] === 'vencida') { $estado = 'vencido'; break; } if ($l['estado'] === 'pendiente') $estado = 'por_pagar'; }
                $out['alumnos'][] = ['id' => (int) $al['id'], 'nombre' => $al['nombre'], 'apellido_paterno' => $al['apellido_paterno'], 'matricula' => $al['matricula'],
                                     'estado_pago' => $estado, 'grado' => $this->gradoPrincipal((int) $al['id']), 'equipo' => $this->equipo((int) $al['id']), 'apariencia' => $this->apariencia((int) $al['id']),
                                     'asistencia_mes' => (int) Db::uno('SELECT COUNT(*) n FROM asistencias WHERE alumno_id = ? AND DATE_FORMAT(fecha_hora, "%Y-%m") = DATE_FORMAT(CURDATE(), "%Y-%m")', [$al['id']])['n']];
            }
            foreach ($edo['adeudos'] as $l) {
                if ($l['estado'] === 'por_vencer') continue;
                $out['adeudos'][] = $l;
                $c = $l['precio'] ? Tarifas::aCentavos($l['precio']) : 0;
                $total += $c; if ($l['estado'] === 'vencida') $vencido += $c;
            }
            $saldo += Tarifas::aCentavos($edo['saldo_favor']);
            foreach (Db::todos('SELECT p.id, p.folio, p.fecha, p.metodo, p.estado, SUM(d.monto_cobrado - d.descuento_aplicado) AS total
                                FROM pagos p JOIN pago_detalles d ON d.pago_id = p.id WHERE p.responsable_id = ? GROUP BY p.id ORDER BY p.fecha DESC LIMIT 10', [$rid]) as $p) $out['pagos'][] = $p;
            $prox = array_values(array_filter($edo['adeudos'], fn($l) => $l['estado'] === 'por_vencer'));
            if ($prox) $out['proximo'] = ['concepto' => $prox[0]['concepto'], 'detalle' => $prox[0]['detalle'], 'vence' => $prox[0]['vence'], 'precio' => $prox[0]['precio']];
        }
        $vence = array_column(array_filter($out['adeudos'], fn($l) => $l['estado'] === 'vencida'), 'vence');
        $out['vencido_desde'] = $vence ? min($vence) : null;
        $out['total'] = Tarifas::aPesos($total); $out['vencido'] = Tarifas::aPesos($vencido); $out['saldo_favor'] = Tarifas::aPesos($saldo);
        $out['sucursal'] = Db::uno('SELECT s.nombre FROM alumnos a JOIN sucursales s ON s.id = a.sucursal_id WHERE a.id = ?', [$out['alumnos'][0]['id'] ?? 0])['nombre'] ?? null;
        Respuesta::ok($out);
    }

    /** GET /api/app/pagos/{id} — recibo de un pago de la familia */
    public function recibo(Peticion $req): void
    {
        $resp = $this->misResponsables($this->persona($req));
        $p = Db::uno('SELECT p.id, p.folio, p.fecha, p.metodo, p.estado, p.responsable_id, s.nombre AS sucursal FROM pagos p JOIN sucursales s ON s.id = p.sucursal_id WHERE p.id = ?', [$req->params['id']]);
        if (!$p || !in_array((int) $p['responsable_id'], $resp, true)) throw new ErrorApi('Recibo no encontrado', 404);
        $p['lineas'] = Db::todos('SELECT c.nombre AS concepto, d.periodo, d.monto_cobrado, d.descuento_aplicado, p.nombre AS alumno
                                  FROM pago_detalles d JOIN conceptos c ON c.id = d.concepto_id LEFT JOIN alumnos a ON a.id = d.alumno_id LEFT JOIN personas p ON p.id = a.persona_id
                                  WHERE d.pago_id = ? ORDER BY d.id', [$p['id']]);
        $tot = 0;
        foreach ($p['lineas'] as &$l) { if ($l['periodo']) $l['concepto'] .= ' · ' . EstadoCuenta::mes($l['periodo']); $tot += Tarifas::aCentavos($l['monto_cobrado']) - Tarifas::aCentavos($l['descuento_aplicado']); }
        $saldo = (int) Db::uno('SELECT COALESCE(SUM(monto) * 100, 0) c FROM saldos_favor WHERE aplicado_en_pago_id = ?', [$p['id']])['c'];
        $p['total'] = Tarifas::aPesos($tot); $p['saldo_usado'] = Tarifas::aPesos($saldo); $p['pagado'] = Tarifas::aPesos($tot - $saldo);
        Respuesta::ok($p);
    }

    /* ---------------- ayudantes ---------------- */

    private function persona(Peticion $req): int
    {
        $u = Db::uno('SELECT persona_id FROM usuarios WHERE id = ?', [$req->ctx['usuario_id']]);
        return (int) $u['persona_id'];
    }

    /** ids de alumnos que la persona puede ver: ella misma y los que tiene a su cargo */
    private function misAlumnos(int $pid): array
    {
        return array_map('intval', array_column(Db::todos(
            'SELECT a.id FROM alumnos a WHERE a.persona_id = ? AND a.estado <> "baja"
             UNION SELECT ar.alumno_id FROM alumno_responsable ar JOIN responsables_pago r ON r.id = ar.responsable_id JOIN alumnos a ON a.id = ar.alumno_id
             WHERE r.persona_id = ? AND ar.vigente_hasta IS NULL AND a.estado <> "baja"', [$pid, $pid]), 'id'));
    }

    private function misResponsables(int $pid): array
    {
        return array_map('intval', array_column(Db::todos('SELECT r.id FROM responsables_pago r WHERE r.persona_id = ?
                                                           AND EXISTS (SELECT 1 FROM alumno_responsable ar WHERE ar.responsable_id = r.id AND ar.vigente_hasta IS NULL)', [$pid]), 'id'));
    }

    private function alumno(Peticion $req, int $id): array
    {
        if (!in_array($id, $this->misAlumnos($this->persona($req)), true)) throw new ErrorApi('Ese alumno no está en tu cuenta', 403);
        $a = Db::uno('SELECT a.id, a.matricula, a.estado, a.sucursal_id, s.nombre AS sucursal, a.codigo_qr, p.nombre, p.apellido_paterno,
                             (p.foto IS NOT NULL) AS tiene_foto
                      FROM alumnos a JOIN personas p ON p.id = a.persona_id JOIN sucursales s ON s.id = a.sucursal_id WHERE a.id = ?', [$id]);
        $a['id'] = (int) $a['id'];
        return $a;
    }

    private function gradoPrincipal(int $aid): ?array
    {
        return Db::uno('SELECT g.nombre, g.color_cinta, d.nombre AS disciplina FROM alumno_grados ag JOIN grados g ON g.id = ag.grado_id
                        JOIN disciplinas d ON d.id = g.disciplina_id WHERE ag.alumno_id = ? ORDER BY ag.fecha_obtencion DESC, ag.id DESC LIMIT 1', [$aid]);
    }

    /** Valores permitidos para personalizar el avatar */
    private const APARIENCIA = [
        'piel' => ['1', '2', '3', '4', '5', '6'],
        'peinado' => ['rapado', 'corto', 'despeinado', 'rizado', 'coleta', 'chongo', 'largo'],
        'color_pelo' => ['negro', 'castano_oscuro', 'castano', 'rubio', 'pelirrojo', 'canoso', 'azul', 'rosa'],
        'vello' => ['ninguno', 'bigote', 'candado', 'barba'],
        'complexion' => ['delgada', 'media', 'robusta'],
    ];

    /** niño (menos de 12), joven (12 a 17) o adulto: cambia las proporciones del avatar */
    private function etapa(int $aid): string
    {
        $e = Db::uno('SELECT TIMESTAMPDIFF(YEAR, p.fecha_nacimiento, CURDATE()) AS edad FROM alumnos a JOIN personas p ON p.id = a.persona_id WHERE a.id = ?', [$aid]);
        $edad = $e && $e['edad'] !== null ? (int) $e['edad'] : 18;
        return $edad < 12 ? 'nino' : ($edad < 18 ? 'joven' : 'adulto');
    }

    /** Cómo se ve: lo que eligió (o lo básico), su etapa por edad y la disciplina que define el uniforme y los movimientos */
    private function apariencia(int $aid): array
    {
        $r = Db::uno('SELECT piel, peinado, color_pelo, vello, complexion FROM avatar_apariencia WHERE alumno_id = ?', [$aid]);
        $personalizada = (bool) $r;   // false = alumno nuevo: la app le pide crear su avatar
        if (!$r) {
            $sexo = Db::uno('SELECT p.sexo FROM alumnos a JOIN personas p ON p.id = a.persona_id WHERE a.id = ?', [$aid])['sexo'] ?? null;
            $r = ['piel' => '2', 'peinado' => $sexo === 'F' ? 'coleta' : 'corto', 'color_pelo' => 'negro', 'vello' => 'ninguno', 'complexion' => 'media'];
        }
        $etapa = $this->etapa($aid);
        if ($etapa === 'nino') $r['vello'] = 'ninguno';
        return $r + ['etapa' => $etapa, 'disciplina' => $this->gradoPrincipal($aid)['disciplina'] ?? null, 'personalizada' => $personalizada];
    }

    /** Lo que trae puesto; si nunca ha elegido, lo básico */
    private function equipo(int $aid): array
    {
        $e = Db::todos('SELECT x.id, x.tipo, x.imagen FROM avatar_equipo ae JOIN accesorios x ON x.id = ae.accesorio_id WHERE ae.alumno_id = ?', [$aid]);
        if (!$e) $e = Db::todos('SELECT MIN(id) AS id, tipo, MIN(imagen) AS imagen FROM accesorios WHERE grado_id IS NULL GROUP BY tipo');
        return array_map(fn($x) => ['id' => (int) $x['id'], 'tipo' => $x['tipo'], 'imagen' => $x['imagen']], $e);
    }

    private function inscripciones(int $aid): array
    {
        return Db::todos('SELECT i.horario_id, i.fecha_inicio, h.dia_semana, h.hora_inicio, h.hora_fin, h.nivel, h.sucursal_id, h.disciplina_id, d.nombre AS disciplina,
                                 CONCAT(p.nombre, " ", p.apellido_paterno) AS instructor
                          FROM inscripciones i JOIN horarios h ON h.id = i.horario_id JOIN disciplinas d ON d.id = h.disciplina_id
                          JOIN instructores ins ON ins.id = h.instructor_id JOIN personas p ON p.id = ins.persona_id
                          WHERE i.alumno_id = ? AND h.activo = 1 AND (i.fecha_fin IS NULL OR i.fecha_fin >= CURDATE())', [$aid]);
    }

    private function proximoExamen(int $aid, int $disc, int $suc): ?array
    {
        $e = Db::uno('SELECT e.id, e.fecha, e.sede, e.sucursal_id, e.disciplina_id FROM examenes e WHERE e.sucursal_id = ? AND e.disciplina_id = ? AND e.estado = "programado" AND e.fecha >= CURDATE()
                      ORDER BY e.fecha LIMIT 1', [$suc, $disc]);
        if (!$e) return null;
        return ['id' => (int) $e['id'], 'fecha' => $e['fecha'], 'sede' => $e['sede'], 'fecha_limite' => (new ExamenControlador())->fechaLimite($e),
                'solicitud' => $this->solicitud($aid, (int) $e['id'])];
    }

    private function solicitud(int $aid, int $examenId): ?array
    {
        return Db::uno('SELECT se.id, se.estado, se.observaciones, (se.pago_detalle_id IS NOT NULL) AS pagado FROM solicitudes_examen se
                        WHERE se.alumno_id = ? AND se.examen_id = ? ORDER BY se.id DESC LIMIT 1', [$aid, $examenId]);
    }

    /**
     * Semana actual (lunes a domingo) día por día y racha: clases seguidas a las que vino, contando hacia atrás
     * desde la última clase que ya pasó (una clase de hoy que no ha terminado no rompe la racha).
     */
    private function semanaYRacha(int $aid, array $insc): array
    {
        $hoy = new \DateTimeImmutable('today');
        $desde = $hoy->modify('-120 days');
        $asis = [];
        foreach (Db::todos('SELECT s.horario_id, DATE(s.fecha_hora) f, TIMESTAMPDIFF(MINUTE, TIMESTAMP(DATE(s.fecha_hora), h.hora_inicio), s.fecha_hora) tarde, h.sucursal_id, h.disciplina_id
                            FROM asistencias s JOIN horarios h ON h.id = s.horario_id WHERE s.alumno_id = ? AND s.fecha_hora >= ?', [$aid, $desde->format('Y-m-d')]) as $s) {
            $lim = (int) (Parametros::valor('minutos_retardo', (int) $s['sucursal_id'], (int) $s['disciplina_id']) ?? 30);
            $asis[$s['f']][$s['horario_id']] = (int) $s['tarde'] > $lim ? 'retardo' : 'asistio';
        }
        $lunes = $hoy->modify('monday this week');
        $semana = [];
        for ($d = 0; $d < 7; $d++) {
            $f = $lunes->modify("+$d days"); $fs = $f->format('Y-m-d'); $n = (int) $f->format('N');
            $tiene = array_filter($insc, fn($i) => (int) $i['dia_semana'] === $n && $i['fecha_inicio'] <= $fs);
            $vino = $asis[$fs] ?? [];
            if ($vino) $estado = in_array('asistio', $vino, true) ? 'asistio' : 'retardo';
            elseif ($fs === $hoy->format('Y-m-d')) $estado = $tiene ? 'hoy' : 'sin_clase';
            elseif ($f > $hoy) $estado = $tiene ? 'proxima' : 'sin_clase';
            else $estado = $tiene ? 'falta' : 'sin_clase';
            $semana[] = ['fecha' => $fs, 'dia' => self::DIAS[$n], 'numero' => (int) $f->format('j'), 'estado' => $estado, 'hoy' => $fs === $hoy->format('Y-m-d')];
        }
        // Clases que tuvo (de su alta en cada horario a hoy), de la más reciente a la más vieja
        $sesiones = [];
        $ahora = date('H:i:s');
        foreach ($insc as $i) {
            $f = $hoy;
            while ($f >= $desde && $f->format('Y-m-d') >= $i['fecha_inicio']) {
                if ((int) $f->format('N') === (int) $i['dia_semana']) {
                    $fs = $f->format('Y-m-d');
                    $esHoy = $fs === $hoy->format('Y-m-d');
                    if (!$esHoy || isset($asis[$fs][$i['horario_id']]) || $ahora > $i['hora_fin']) $sesiones[] = [$fs . ' ' . $i['hora_inicio'], isset($asis[$fs][$i['horario_id']])];
                }
                $f = $f->modify('-1 day');
            }
        }
        rsort($sesiones);
        $racha = 0;
        foreach ($sesiones as [, $vino]) { if (!$vino) break; $racha++; }
        return [$semana, $racha];
    }
}
