<?php
declare(strict_types=1);
namespace Dojo\Modulos\Reportes;

use Dojo\Modulos\Catalogos\Tarifas;
use Dojo\Modulos\Pagos\EstadoCuenta;
use Dojo\Nucleo\{Db, ErrorApi, Parametros, Peticion, Respuesta};
use Dojo\Nucleo\Middleware\Permiso;

/**
 * Reportes para el dueño y los administradores: cómo va el negocio en un mes y los 12 anteriores.
 *  - Ingresos: lo que de verdad entró (pagos aprobados; sin el saldo a favor usado ni lo cancelado), por método.
 *  - Alumnos: activos al cierre de cada mes, altas y bajas (la fecha de baja sale de la bitácora).
 *  - Deuda vencida de hoy por antigüedad, alumnos en riesgo de irse y asistencia por clase y día.
 * El admin de sucursal ve solo la suya; el súper admin, todas o una.
 */
final class ReportesControlador
{
    /** GET /api/reportes?mes=AAAA-MM&sucursal_id= */
    public function resumen(Peticion $req): void
    {
        $mes = (string) ($req->query['mes'] ?? date('Y-m'));
        if (!preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $mes)) throw new ErrorApi('Mes no válido (AAAA-MM)', 422, ['campo' => 'mes']);
        if ($mes > date('Y-m')) $mes = date('Y-m');
        $suc = Permiso::sucursalDe($req) ?? (isset($req->query['sucursal_id']) && $req->query['sucursal_id'] !== '' ? (int) $req->query['sucursal_id'] : null);

        $ini = new \DateTimeImmutable("$mes-01");
        $desde = $ini->modify('-11 months');
        $meses = [];
        for ($m = $desde; $m <= $ini; $m = $m->modify('+1 month')) $meses[] = $m->format('Y-m');

        $serie = array_fill_keys($meses, ['ingresos' => 0, 'efectivo' => 0, 'transferencia' => 0, 'en_linea' => 0, 'cobros' => 0,
                                          'altas' => 0, 'bajas' => 0, 'activos' => 0, 'asistencias' => 0]);
        $fs = $suc ? ' AND p.sucursal_id = ' . (int) $suc : '';
        $fa = $suc ? ' AND a.sucursal_id = ' . (int) $suc : '';

        // Ingresos por mes y método: total del pago menos el saldo a favor que se usó (ese dinero ya había entrado antes)
        foreach (Db::todos("SELECT DATE_FORMAT(p.fecha, '%Y-%m') mes, p.metodo,
                                   SUM(x.total - x.saldo) cobrado, COUNT(*) cobros
                            FROM pagos p JOIN (SELECT d.pago_id, SUM(d.monto_cobrado - d.descuento_aplicado) total,
                                                      (SELECT COALESCE(SUM(sf.monto), 0) FROM saldos_favor sf WHERE sf.aplicado_en_pago_id = d.pago_id) saldo
                                               FROM pago_detalles d GROUP BY d.pago_id) x ON x.pago_id = p.id
                            WHERE p.estado = 'aprobado' AND p.metodo <> 'saldo_favor' AND p.fecha >= ? AND p.fecha < ? $fs
                            GROUP BY mes, p.metodo", [$desde->format('Y-m-d'), $ini->modify('+1 month')->format('Y-m-d')]) as $r) {
            if (!isset($serie[$r['mes']])) continue;
            $c = Tarifas::aCentavos($r['cobrado']);
            $k = $r['metodo'] === 'pasarela' ? 'en_linea' : $r['metodo'];
            if (isset($serie[$r['mes']][$k])) $serie[$r['mes']][$k] += $c;
            $serie[$r['mes']]['ingresos'] += $c;
            $serie[$r['mes']]['cobros'] += (int) $r['cobros'];
        }

        // Alumnos: alta, baja (última vez que se dio de baja, según la bitácora) y activos al cierre de cada mes
        $alumnos = Db::todos("SELECT a.id, a.fecha_alta, a.estado,
                                     (SELECT DATE(MAX(b.fecha_hora)) FROM bitacora b WHERE b.tabla = 'alumnos' AND b.registro_id = a.id AND b.campo = 'estado' AND b.valor_nuevo = 'baja') baja
                              FROM alumnos a WHERE 1 = 1 $fa");
        foreach ($alumnos as $a) {
            $baja = $a['estado'] === 'baja' ? ($a['baja'] ?? $a['fecha_alta']) : null;
            $ma = substr($a['fecha_alta'], 0, 7);
            if (isset($serie[$ma])) $serie[$ma]['altas']++;
            if ($baja && isset($serie[substr($baja, 0, 7)])) $serie[substr($baja, 0, 7)]['bajas']++;
            foreach ($meses as $m) {
                $fin = (new \DateTimeImmutable("$m-01"))->modify('last day of this month')->format('Y-m-d');
                if ($a['fecha_alta'] <= $fin && (!$baja || $baja > $fin)) $serie[$m]['activos']++;
            }
        }

        foreach (Db::todos("SELECT DATE_FORMAT(x.fecha_hora, '%Y-%m') mes, COUNT(*) n FROM asistencias x JOIN alumnos a ON a.id = x.alumno_id
                            WHERE x.fecha_hora >= ? AND x.fecha_hora < ?" . ($suc ? ' AND x.sucursal_id = ' . (int) $suc : '') . ' GROUP BY mes',
                           [$desde->format('Y-m-d'), $ini->modify('+1 month')->format('Y-m-d')]) as $r) {
            if (isset($serie[$r['mes']])) $serie[$r['mes']]['asistencias'] = (int) $r['n'];
        }

        $act = $serie[$mes]; $ant = $serie[$ini->modify('-1 month')->format('Y-m')] ?? null;
        $rango = [$ini->format('Y-m-d'), $ini->modify('+1 month')->format('Y-m-d')];

        // Lo vendido en el mes por concepto (incluye lo pagado con saldo a favor)
        $porConcepto = array_map(fn($r) => ['concepto' => $r['concepto'], 'total' => Tarifas::aPesos(Tarifas::aCentavos($r['total'])), 'lineas' => (int) $r['n']],
            Db::todos("SELECT c.nombre concepto, SUM(d.monto_cobrado - d.descuento_aplicado) total, COUNT(*) n
                       FROM pago_detalles d JOIN pagos p ON p.id = d.pago_id JOIN conceptos c ON c.id = d.concepto_id
                       WHERE p.estado = 'aprobado' AND p.fecha >= ? AND p.fecha < ? $fs GROUP BY c.id ORDER BY total DESC", $rango));

        // Clases con más asistencia y por día de la semana
        $clases = Db::todos("SELECT h.id, d.nombre disciplina, h.dia_semana, TIME_FORMAT(h.hora_inicio, '%H:%i') hora, h.nivel, s.nombre sucursal, COUNT(x.id) asistencias,
                                    (SELECT COUNT(*) FROM inscripciones i JOIN alumnos a2 ON a2.id = i.alumno_id WHERE i.horario_id = h.id AND a2.estado = 'activo'
                                       AND i.fecha_inicio <= CURDATE() AND (i.fecha_fin IS NULL OR i.fecha_fin >= CURDATE())) inscritos
                             FROM asistencias x JOIN horarios h ON h.id = x.horario_id JOIN disciplinas d ON d.id = h.disciplina_id JOIN sucursales s ON s.id = h.sucursal_id
                             WHERE x.fecha_hora >= ? AND x.fecha_hora < ?" . ($suc ? ' AND x.sucursal_id = ' . (int) $suc : '') . '
                             GROUP BY h.id ORDER BY asistencias DESC LIMIT 8', $rango);
        $dias = array_fill(1, 7, 0);
        foreach (Db::todos('SELECT WEEKDAY(x.fecha_hora) + 1 d, COUNT(*) n FROM asistencias x WHERE x.fecha_hora >= ? AND x.fecha_hora < ?'
                           . ($suc ? ' AND x.sucursal_id = ' . (int) $suc : '') . ' GROUP BY d', $rango) as $r) $dias[(int) $r['d']] = (int) $r['n'];

        [$deuda, $riesgo, $porSucursalDeuda] = $this->deudaYRiesgo($suc);

        // Por sucursal (solo si ve todas)
        $porSucursal = [];
        if (!$suc) {
            foreach (Db::todos('SELECT id, nombre FROM sucursales WHERE activa = 1 ORDER BY nombre') as $s) {
                $ing = Db::uno("SELECT COALESCE(SUM(d.monto_cobrado - d.descuento_aplicado), 0) - COALESCE((SELECT SUM(sf.monto) FROM saldos_favor sf JOIN pagos p2 ON p2.id = sf.aplicado_en_pago_id
                                     WHERE p2.estado = 'aprobado' AND p2.metodo <> 'saldo_favor' AND p2.sucursal_id = ? AND p2.fecha >= ? AND p2.fecha < ?), 0) t
                                FROM pago_detalles d JOIN pagos p ON p.id = d.pago_id
                                WHERE p.estado = 'aprobado' AND p.metodo <> 'saldo_favor' AND p.sucursal_id = ? AND p.fecha >= ? AND p.fecha < ?",
                               [$s['id'], ...$rango, $s['id'], ...$rango])['t'];
                $porSucursal[] = ['id' => (int) $s['id'], 'sucursal' => $s['nombre'], 'ingresos' => Tarifas::aPesos(Tarifas::aCentavos((string) $ing)),
                                  'activos' => (int) Db::uno('SELECT COUNT(*) n FROM alumnos WHERE sucursal_id = ? AND estado = "activo"', [$s['id']])['n'],
                                  'vencido' => Tarifas::aPesos($porSucursalDeuda[(int) $s['id']] ?? 0)];
            }
        }

        $serieOut = [];
        foreach ($serie as $m => $f) {
            foreach (['ingresos', 'efectivo', 'transferencia', 'en_linea'] as $k) $f[$k] = Tarifas::aPesos($f[$k]);
            $serieOut[] = ['mes' => $m] + $f;
        }

        Respuesta::ok([
            'mes' => $mes, 'sucursal_id' => $suc,
            'kpi' => [
                'ingresos' => Tarifas::aPesos($act['ingresos']), 'ingresos_anterior' => $ant ? Tarifas::aPesos($ant['ingresos']) : null,
                'cobros' => $act['cobros'], 'ticket_promedio' => Tarifas::aPesos($act['cobros'] ? intdiv($act['ingresos'], $act['cobros']) : 0),
                'activos' => $act['activos'], 'activos_anterior' => $ant['activos'] ?? null, 'altas' => $act['altas'], 'bajas' => $act['bajas'],
                'asistencias' => $act['asistencias'], 'asistencias_por_alumno' => $act['activos'] ? round($act['asistencias'] / $act['activos'], 1) : 0,
                'vencido' => Tarifas::aPesos($deuda['total']), 'cuentas_vencidas' => $deuda['cuentas'],
            ],
            'serie' => $serieOut,
            'por_concepto' => $porConcepto,
            'por_sucursal' => $porSucursal,
            'deuda' => ['d1_30' => Tarifas::aPesos($deuda['d1_30']), 'd31_60' => Tarifas::aPesos($deuda['d31_60']), 'd61' => Tarifas::aPesos($deuda['d61']),
                        'cuentas' => $deuda['cuentas']],
            'clases' => array_map(fn($c) => $c + ['asistencias' => (int) $c['asistencias'], 'inscritos' => (int) $c['inscritos']], $clases),
            'dias_semana' => array_values($dias),
            'riesgo' => $riesgo,
        ]);
    }

    /**
     * Deuda vencida de hoy por antigüedad (desde que venció) y alumnos en riesgo de irse:
     * llevan más de "dias_sin_asistir" sin venir, o deben algo vencido hace más de 30 días.
     * @return array{0: array, 1: array, 2: array<int,int>}
     */
    private function deudaYRiesgo(?int $suc): array
    {
        $hoy = new \DateTimeImmutable('today');
        $deuda = ['total' => 0, 'd1_30' => 0, 'd31_60' => 0, 'd61' => 0, 'cuentas' => 0];
        $porSuc = []; $debeAlumno = [];
        $resp = Db::todos('SELECT DISTINCT r.id FROM responsables_pago r JOIN alumno_responsable ar ON ar.responsable_id = r.id AND ar.vigente_hasta IS NULL
                           JOIN alumnos a ON a.id = ar.alumno_id AND a.estado = "activo"' . ($suc ? ' AND a.sucursal_id = ' . (int) $suc : ''));
        foreach ($resp as $x) {
            $tiene = false;
            foreach (EstadoCuenta::de((int) $x['id'], $suc)['adeudos'] as $l) {
                if ($l['estado'] !== 'vencida' || !$l['precio']) continue;
                $c = Tarifas::aCentavos($l['precio']);
                $dias = $l['vence'] ? (int) (new \DateTimeImmutable($l['vence']))->diff($hoy)->days : 0;
                $deuda['total'] += $c; $tiene = true;
                $deuda[$dias <= 30 ? 'd1_30' : ($dias <= 60 ? 'd31_60' : 'd61')] += $c;
                $sa = (int) (Db::uno('SELECT sucursal_id FROM alumnos WHERE id = ?', [$l['alumno_id']])['sucursal_id'] ?? 0);
                $porSuc[$sa] = ($porSuc[$sa] ?? 0) + $c;
                $d = &$debeAlumno[$l['alumno_id']];
                $d = ['monto' => ($d['monto'] ?? 0) + $c, 'dias' => max($d['dias'] ?? 0, $dias)];
                unset($d);
            }
            if ($tiene) $deuda['cuentas']++;
        }

        $riesgo = [];
        foreach (Db::todos("SELECT a.id, a.sucursal_id, CONCAT(pe.nombre, ' ', pe.apellido_paterno) nombre, s.nombre sucursal, a.fecha_alta,
                                   (SELECT DATE(MAX(x.fecha_hora)) FROM asistencias x WHERE x.alumno_id = a.id) ultima
                            FROM alumnos a JOIN personas pe ON pe.id = a.persona_id JOIN sucursales s ON s.id = a.sucursal_id
                            WHERE a.estado = 'activo'" . ($suc ? ' AND a.sucursal_id = ' . (int) $suc : '')) as $a) {
            $lim = (int) (Parametros::valor('dias_sin_asistir', (int) $a['sucursal_id']) ?? 14) ?: 14;
            $desde = $a['ultima'] ?? $a['fecha_alta'];
            $sinVenir = (int) (new \DateTimeImmutable($desde))->diff($hoy)->days;
            $debe = $debeAlumno[$a['id']] ?? null;
            $motivos = [];
            if ($sinVenir >= $lim) $motivos[] = 'sin_venir';
            if ($debe && $debe['dias'] > 30) $motivos[] = 'debe';
            if (!$motivos) continue;
            $riesgo[] = ['alumno_id' => (int) $a['id'], 'nombre' => $a['nombre'], 'sucursal' => $a['sucursal'], 'motivos' => $motivos,
                         'dias_sin_venir' => $sinVenir, 'nunca_vino' => !$a['ultima'], 'debe' => $debe ? Tarifas::aPesos($debe['monto']) : '0.00', 'dias_vencido' => $debe['dias'] ?? 0,
                         'puntos' => count($motivos) * 1000 + $sinVenir + ($debe['dias'] ?? 0)];
        }
        usort($riesgo, fn($x, $y) => $y['puntos'] <=> $x['puntos']);
        $riesgo = array_map(function ($r) { unset($r['puntos']); return $r; }, array_slice($riesgo, 0, 20));
        return [$deuda, $riesgo, $porSuc];
    }
}
