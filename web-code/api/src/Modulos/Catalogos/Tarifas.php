<?php
declare(strict_types=1);
namespace Dojo\Modulos\Catalogos;

use Dojo\Nucleo\{Db, ErrorApi};

/**
 * Servicio de tarifas: precio vigente de un concepto y cotización con promociones.
 * Lo usan PrecioControlador, PromocionControlador y, más adelante, Inscripciones (2.5) y Pagos (fase 4).
 *
 * Los montos se calculan en CENTAVOS (enteros) para no tener errores de redondeo con decimales.
 */
final class Tarifas
{
    /** Precio vigente hoy. Gana el de la sucursal sobre el global. null si no tiene precio. */
    public static function precioVigente(int $conceptoId, ?int $sucursal): ?string
    {
        $p = Db::uno(
            'SELECT monto FROM precios
             WHERE concepto_id = ? AND (sucursal_id IS NULL OR sucursal_id = ?)
               AND vigente_desde <= CURDATE() AND (vigente_hasta IS NULL OR vigente_hasta > CURDATE())
             ORDER BY (sucursal_id IS NOT NULL) DESC, vigente_desde DESC, id DESC
             LIMIT 1',
            [$conceptoId, $sucursal]);
        return $p['monto'] ?? null;
    }

    /**
     * Promoción activa y vigente hoy por su código, para esa sucursal (o para todas).
     * vigente_hasta de una promoción es INCLUSIVO: "válida hasta el 30 de noviembre" incluye el 30.
     */
    public static function promocionPorCodigo(string $codigo, ?int $sucursal): array
    {
        $p = Db::uno(
            'SELECT id, nombre, tipo, codigo FROM promociones
             WHERE codigo = ? AND activa = 1
               AND vigente_desde <= CURDATE() AND (vigente_hasta IS NULL OR vigente_hasta >= CURDATE())
               AND (sucursal_id IS NULL OR sucursal_id = ?)',
            [strtoupper($codigo), $sucursal]);
        if (!$p) throw new ErrorApi("El código $codigo no existe, ya venció o no aplica en esta sucursal", 422);
        $p['descuentos'] = [];
        foreach (Db::todos('SELECT concepto_id, tipo, valor FROM promocion_conceptos WHERE promocion_id = ?', [$p['id']]) as $d) {
            $p['descuentos'][(int) $d['concepto_id']] = $d;
        }
        return $p;
    }

    /**
     * Cotiza una lista de conceptos: precio, descuento de la promoción y total por línea.
     * @param array $conceptos [['concepto_id' => 1, 'cantidad' => 1], ...]
     */
    public static function cotizar(array $conceptos, ?int $sucursal, ?string $codigo): array
    {
        if (!$conceptos) throw new ErrorApi('Agrega al menos un concepto', 422);
        $promo = $codigo ? self::promocionPorCodigo($codigo, $sucursal) : null;

        $lineas = []; $subtotal = 0; $descuentos = 0;
        foreach ($conceptos as $c) {
            $id = (int) ($c['concepto_id'] ?? 0);
            $cantidad = (int) ($c['cantidad'] ?? 1);
            if ($cantidad < 1) throw new ErrorApi('La cantidad debe ser 1 o más', 422);
            $concepto = Db::uno('SELECT id, nombre FROM conceptos WHERE id = ?', [$id]);
            if (!$concepto) throw new ErrorApi("El concepto $id no existe", 404);
            $precio = self::precioVigente($id, $sucursal);
            if ($precio === null) throw new ErrorApi("{$concepto['nombre']} no tiene precio vigente", 422);

            $unitario = self::aCentavos($precio);
            $importe = $unitario * $cantidad;
            $desc = 0;
            if ($promo && isset($promo['descuentos'][$id])) {
                $d = $promo['descuentos'][$id];
                $desc = $d['tipo'] === 'porcentaje'
                    ? (int) round($importe * (float) $d['valor'] / 100)
                    : min(self::aCentavos($d['valor']), $importe);   // monto fijo, nunca más que el importe
            }
            $lineas[] = [
                'concepto_id' => $id, 'concepto' => $concepto['nombre'], 'cantidad' => $cantidad,
                'precio_unitario' => self::aPesos($unitario), 'importe' => self::aPesos($importe),
                'descuento' => self::aPesos($desc), 'total' => self::aPesos($importe - $desc),
            ];
            $subtotal += $importe; $descuentos += $desc;
        }
        return [
            'promocion' => $promo ? ['id' => (int) $promo['id'], 'nombre' => $promo['nombre'], 'codigo' => $promo['codigo']] : null,
            'lineas' => $lineas,
            'subtotal' => self::aPesos($subtotal), 'descuento' => self::aPesos($descuentos), 'total' => self::aPesos($subtotal - $descuentos),
        ];
    }

    public static function aCentavos(string|float $monto): int { return (int) round((float) $monto * 100); }
    public static function aPesos(int $centavos): string { return number_format($centavos / 100, 2, '.', ''); }
}
