<?php
declare(strict_types=1);
namespace Dojo\Modulos\Pagos;

use Dojo\Modulos\Catalogos\Tarifas;
use Dojo\Nucleo\{Db, ErrorApi};

/**
 * Arma un ticket a partir del estado de cuenta: valida las claves pedidas, agrega productos, calcula precios y
 * promoción en el servidor (nunca se confía en el monto que manda la pantalla) y el saldo a favor que cabe.
 * Lo usan la caja (cobro en mostrador) y el pago en línea desde la app.
 */
final class Cotizador
{
    /** @return array{edo: array, sucursal: int, lineas: array, cot: array, saldos: array, saldoCent: int, aPagar: int} */
    public static function preparar(array $r, ?int $propia, array $claves, array $productos, ?string $codigo, bool $usarSaldo): array
    {
        $edo = EstadoCuenta::de($r['id'], $propia);

        // 1. Líneas pedidas: deben existir en el estado de cuenta actual
        $porClave = array_column($edo['adeudos'], null, 'clave');
        $lineas = [];
        foreach (array_unique($claves) as $k) {
            if (!isset($porClave[$k])) throw new ErrorApi("El adeudo $k ya no está pendiente; recarga el estado de cuenta", 409);
            $lineas[] = $porClave[$k];
        }
        // Una mensualidad vencida no se cobra sin su recargo
        foreach ($lineas as $l) {
            if (str_starts_with($l['clave'], 'mens:') && isset($porClave['rec:' . substr($l['clave'], 5)]) && !in_array('rec:' . substr($l['clave'], 5), $claves, true)) {
                throw new ErrorApi("La mensualidad de {$l['detalle']} está vencida: cóbrala junto con su recargo", 422);
            }
        }
        $alumnos = array_column($edo['alumnos'], null, 'id');
        foreach ($productos as $p) {
            $con = Db::uno('SELECT id, nombre FROM conceptos WHERE id = ? AND tipo = "producto"', [(int) ($p['concepto_id'] ?? 0)]);
            if (!$con) throw new ErrorApi('Producto no encontrado', 404);
            $aid = !empty($p['alumno_id']) ? (int) $p['alumno_id'] : null;
            if ($aid && !isset($alumnos[$aid])) throw new ErrorApi('Ese alumno no está a cargo de este responsable', 422);
            for ($i = 0, $n = max(1, min(20, (int) ($p['cantidad'] ?? 1))); $i < $n; $i++) {
                $lineas[] = ['clave' => null, 'alumno_id' => $aid, 'concepto_id' => (int) $con['id'], 'concepto' => $con['nombre'], 'periodo' => null, 'solicitud_id' => null];
            }
        }
        if (!$lineas) throw new ErrorApi('Elige al menos un concepto para cobrar', 422);

        // 2. Precios y promoción: los calcula el servidor (nunca se confía en el monto que manda la pantalla)
        $sucursal = $propia ?? (int) ($alumnos[$lineas[0]['alumno_id'] ?? 0]['sucursal_id'] ?? 0);
        if (!$sucursal) $sucursal = (int) ($edo['alumnos'][0]['sucursal_id'] ?? 0);
        if (!$sucursal) throw new ErrorApi('No se pudo saber la sucursal del cobro', 422);
        $cot = Tarifas::cotizar(array_map(fn($l) => ['concepto_id' => $l['concepto_id'], 'cantidad' => 1], $lineas), $sucursal, $codigo);

        // 3. Saldo a favor
        $saldos = $usarSaldo ? $edo['saldos'] : [];
        $totalCent = Tarifas::aCentavos($cot['total']);
        $saldoCent = array_sum(array_map(fn($s) => Tarifas::aCentavos($s['monto']), $saldos));
        if ($saldoCent > $totalCent) {   // solo se usan saldos completos que quepan en el total
            $usar = []; $acum = 0;
            foreach ($saldos as $s) { $m = Tarifas::aCentavos($s['monto']); if ($acum + $m <= $totalCent) { $usar[] = $s; $acum += $m; } }
            $saldos = $usar; $saldoCent = $acum;
        }
        $aPagar = $totalCent - $saldoCent;

        return compact('edo', 'sucursal', 'lineas', 'cot', 'saldos', 'saldoCent', 'aPagar');
    }
}
