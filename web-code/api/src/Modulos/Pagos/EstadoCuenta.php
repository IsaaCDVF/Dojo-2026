<?php
declare(strict_types=1);
namespace Dojo\Modulos\Pagos;

use Dojo\Modulos\Catalogos\Tarifas;
use Dojo\Nucleo\{Db, Parametros};

/**
 * Calcula lo que debe un responsable de pago. Los adeudos NO se guardan (RNF-19): salen de
 * las inscripciones, los grados y los pagos ya hechos.
 *  - Inscripción: una vez por alumno, si nunca se pagó.
 *  - Mensualidad: un periodo AAAA-MM por cada mes desde su alta (máx. 12 hacia atrás) que no esté pagado.
 *    La fecha de cobro es fija: el día del mes de su alta (RN-34). Vence en cobro + días de tolerancia;
 *    después se agrega el recargo por pago tardío de ese periodo (RN-33).
 *  - Examen: solicitudes autorizadas sin pago (RF-61).
 *  Un alumno de baja o suspendido no genera inscripción ni mensualidades.
 * Cada línea trae una "clave" única; la caja cobra por clave y el servidor vuelve a calcular el monto.
 */
final class EstadoCuenta
{
    public static function concepto(string $tipo): ?array
    {
        return Db::uno('SELECT id, nombre FROM conceptos WHERE tipo = ? ORDER BY id LIMIT 1', [$tipo]);
    }

    /** @return array{alumnos: array, adeudos: array, saldo_favor: string, saldos: array} */
    public static function de(int $responsableId, ?int $sucursal): array
    {
        $alumnos = Db::todos(
            'SELECT a.id, a.matricula, a.sucursal_id, a.estado, a.fecha_alta, pe.nombre, pe.apellido_paterno
             FROM alumno_responsable ar JOIN alumnos a ON a.id = ar.alumno_id JOIN personas pe ON pe.id = a.persona_id
             WHERE ar.responsable_id = ? AND ar.vigente_hasta IS NULL' . ($sucursal ? ' AND a.sucursal_id = ?' : '') . ' ORDER BY pe.nombre',
            $sucursal ? [$responsableId, $sucursal] : [$responsableId]);

        $adeudos = self::adeudosDe($alumnos);
        $saldos = Db::todos('SELECT id, monto, fecha, alumno_id FROM saldos_favor WHERE responsable_id = ? AND aplicado_en_pago_id IS NULL ORDER BY fecha', [$responsableId]);
        $saldo = array_sum(array_map(fn($s) => Tarifas::aCentavos($s['monto']), $saldos));
        return ['alumnos' => $alumnos, 'adeudos' => $adeudos, 'saldo_favor' => Tarifas::aPesos($saldo), 'saldos' => $saldos];
    }

    /** Adeudos de un solo alumno (lo usa la tableta para decidir si pasa) */
    public static function deAlumno(int $alumnoId): array
    {
        $a = Db::uno('SELECT a.id, a.matricula, a.sucursal_id, a.estado, a.fecha_alta, pe.nombre, pe.apellido_paterno
                      FROM alumnos a JOIN personas pe ON pe.id = a.persona_id WHERE a.id = ?', [$alumnoId]);
        return $a ? self::adeudosDe([$a]) : [];
    }

    /** @param array $alumnos filas con id, sucursal_id, estado, fecha_alta, nombre, apellido_paterno */
    private static function adeudosDe(array $alumnos): array
    {
        $cMens = self::concepto('mensualidad'); $cInsc = self::concepto('inscripcion');
        $cRec = self::concepto('recargo'); $cExa = self::concepto('examen');
        $hoy = new \DateTimeImmutable('today');
        $adeudos = [];

        foreach ($alumnos as $a) {
            $aid = (int) $a['id']; $suc = (int) $a['sucursal_id'];
            $nombre = $a['nombre'] . ' ' . $a['apellido_paterno'];
            $pagados = self::pagados($aid);

            // Un alumno de baja o suspendido ya no genera adeudos nuevos (se cobra lo pendiente antes de la baja)
            $activo = $a['estado'] === 'activo';
            if ($activo && $cInsc && !isset($pagados[$cInsc['id'] . '|'])) {
                $adeudos[] = self::linea("insc:$aid", $aid, $nombre, $cInsc, null, $suc, 'pendiente', null);
            }
            if ($activo && $cMens) {
                $tol = (int) (Parametros::valor('dias_tolerancia_pago', $suc) ?? 5);
                foreach (self::periodos($a['fecha_alta'], $tol, $hoy) as [$periodo, $estado, $vence]) {
                    if (isset($pagados[$cMens['id'] . '|' . $periodo])) continue;
                    $adeudos[] = self::linea("mens:$aid:$periodo", $aid, $nombre, $cMens, $periodo, $suc, $estado, $vence);
                    if ($estado === 'vencida' && $cRec && !isset($pagados[$cRec['id'] . '|' . $periodo])) {
                        $adeudos[] = self::linea("rec:$aid:$periodo", $aid, $nombre, $cRec, $periodo, $suc, 'vencida', $vence);
                    }
                }
            }
            if ($cExa) {
                foreach (Db::todos('SELECT s.id, g.nombre AS grado, e.fecha FROM solicitudes_examen s JOIN examenes e ON e.id = s.examen_id
                                    JOIN grados g ON g.id = s.grado_objetivo_id
                                    WHERE s.alumno_id = ? AND s.estado = "autorizada" AND s.pago_detalle_id IS NULL', [$aid]) as $s) {
                    $l = self::linea("exa:{$s['id']}", $aid, $nombre, $cExa, null, $suc, 'pendiente', substr($s['fecha'], 0, 10));
                    $l['detalle'] = "Examen a {$s['grado']}"; $l['solicitud_id'] = (int) $s['id'];
                    $adeudos[] = $l;
                }
            }
        }
        return $adeudos;
    }

    /**
     * Mensualidades que le tocan a un alumno: un periodo AAAA-MM por mes desde su alta (máx. 12 hacia atrás).
     * Cobro fijo el día de su alta (tope 28, RN-34); vence en cobro + días de tolerancia.
     * @return list<array{0: string, 1: string, 2: string}> [periodo, estado (vencida|pendiente|por_vencer), vence]
     */
    private static function periodos(string $fechaAlta, int $tolerancia, \DateTimeImmutable $hoy): array
    {
        $alta = new \DateTimeImmutable($fechaAlta);
        $dia = min(28, (int) $alta->format('d'));
        $mes = $alta->modify('first day of this month');
        $limite = $hoy->modify('first day of this month')->modify('-11 months');
        if ($mes < $limite) $mes = $limite;
        $r = [];
        for (; $mes <= $hoy; $mes = $mes->modify('+1 month')) {
            $cobro = $mes->setDate((int) $mes->format('Y'), (int) $mes->format('m'), $dia);
            $vence = $cobro->modify("+$tolerancia days");
            $r[] = [$mes->format('Y-m'), $hoy > $vence ? 'vencida' : ($hoy >= $cobro ? 'pendiente' : 'por_vencer'), $vence->format('Y-m-d')];
        }
        return $r;
    }

    /**
     * Alumnos activos con al menos una mensualidad vencida (ya pasó la tolerancia). Para el Inicio:
     * resuelve todo con dos consultas en lugar de calcular la cuenta de cada alumno por separado.
     */
    public static function vencidos(?int $sucursal): array
    {
        $cMens = self::concepto('mensualidad');
        if (!$cMens) return [];
        $f = $sucursal ? ' AND a.sucursal_id = ?' : '';
        $alumnos = Db::todos(
            'SELECT a.id, a.sucursal_id, a.fecha_alta, a.matricula, CONCAT(pe.nombre, " ", pe.apellido_paterno) AS nombre, (pe.foto IS NOT NULL) AS tiene_foto,
                    (SELECT ar.responsable_id FROM alumno_responsable ar WHERE ar.alumno_id = a.id AND ar.vigente_hasta IS NULL LIMIT 1) AS responsable_id
             FROM alumnos a JOIN personas pe ON pe.id = a.persona_id WHERE a.estado = "activo"' . $f, $sucursal ? [$sucursal] : []);
        $pagados = [];
        foreach (Db::todos('SELECT d.alumno_id, d.periodo FROM pago_detalles d JOIN pagos p ON p.id = d.pago_id JOIN alumnos a ON a.id = d.alumno_id
                            WHERE d.concepto_id = ? AND p.estado = "aprobado" AND a.estado = "activo"' . $f,
                            $sucursal ? [$cMens['id'], $sucursal] : [$cMens['id']]) as $x) {
            $pagados[$x['alumno_id'] . '|' . $x['periodo']] = true;
        }
        $hoy = new \DateTimeImmutable('today'); $tol = []; $res = [];
        foreach ($alumnos as $a) {
            $s = (int) $a['sucursal_id'];
            $tol[$s] ??= (int) (Parametros::valor('dias_tolerancia_pago', $s) ?? 5);
            $n = 0; $desde = null;
            foreach (self::periodos($a['fecha_alta'], $tol[$s], $hoy) as [$periodo, $estado, $vence]) {
                if ($estado !== 'vencida' || isset($pagados[$a['id'] . '|' . $periodo])) continue;
                $n++; $desde ??= $vence;
            }
            if ($n) $res[] = $a + ['meses' => $n, 'vencida_desde' => $desde];
        }
        usort($res, fn($x, $y) => [$y['meses'], $x['vencida_desde']] <=> [$x['meses'], $y['vencida_desde']]);
        return $res;
    }

    /** concepto|periodo ya pagados (pagos aprobados) de un alumno */
    private static function pagados(int $alumnoId): array
    {
        $m = [];
        foreach (Db::todos('SELECT d.concepto_id, d.periodo FROM pago_detalles d JOIN pagos p ON p.id = d.pago_id
                            WHERE d.alumno_id = ? AND p.estado = "aprobado"', [$alumnoId]) as $r) {
            $m[$r['concepto_id'] . '|' . ($r['periodo'] ?? '')] = true;
        }
        return $m;
    }

    private static function linea(string $clave, int $aid, string $nombre, array $c, ?string $periodo, int $suc, string $estado, ?string $vence): array
    {
        return ['clave' => $clave, 'alumno_id' => $aid, 'alumno' => $nombre, 'concepto_id' => (int) $c['id'], 'concepto' => $c['nombre'],
                'periodo' => $periodo, 'estado' => $estado, 'vence' => $vence, 'precio' => Tarifas::precioVigente((int) $c['id'], $suc),
                'detalle' => $periodo ? self::mes($periodo) : null, 'solicitud_id' => null];
    }

    public static function mes(string $periodo): string
    {
        $m = ['', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
        [$a, $n] = explode('-', $periodo);
        return ucfirst($m[(int) $n]) . " $a";
    }
}
