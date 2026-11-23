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
                $alta = new \DateTimeImmutable($a['fecha_alta']);
                $dia = min(28, (int) $alta->format('d'));
                $tol = (int) (Parametros::valor('dias_tolerancia_pago', $suc) ?? 5);
                $mes = $alta->modify('first day of this month');
                $limite = $hoy->modify('first day of this month')->modify('-11 months');
                if ($mes < $limite) $mes = $limite;
                for (; $mes <= $hoy; $mes = $mes->modify('+1 month')) {
                    $periodo = $mes->format('Y-m');
                    if (isset($pagados[$cMens['id'] . '|' . $periodo])) continue;
                    $cobro = $mes->setDate((int) $mes->format('Y'), (int) $mes->format('m'), $dia);
                    $vence = $cobro->modify("+$tol days");
                    $estado = $hoy > $vence ? 'vencida' : ($hoy >= $cobro ? 'pendiente' : 'por_vencer');
                    $adeudos[] = self::linea("mens:$aid:$periodo", $aid, $nombre, $cMens, $periodo, $suc, $estado, $vence->format('Y-m-d'));
                    if ($estado === 'vencida' && $cRec && !isset($pagados[$cRec['id'] . '|' . $periodo])) {
                        $adeudos[] = self::linea("rec:$aid:$periodo", $aid, $nombre, $cRec, $periodo, $suc, 'vencida', $vence->format('Y-m-d'));
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
        $saldos = Db::todos('SELECT id, monto, fecha, alumno_id FROM saldos_favor WHERE responsable_id = ? AND aplicado_en_pago_id IS NULL ORDER BY fecha', [$responsableId]);
        $saldo = array_sum(array_map(fn($s) => Tarifas::aCentavos($s['monto']), $saldos));
        return ['alumnos' => $alumnos, 'adeudos' => $adeudos, 'saldo_favor' => Tarifas::aPesos($saldo), 'saldos' => $saldos];
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
