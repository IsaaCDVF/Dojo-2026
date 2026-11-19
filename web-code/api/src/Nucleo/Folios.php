<?php
declare(strict_types=1);
namespace Dojo\Nucleo;

/**
 * Folios legibles sin repetir: CENT-26-0001 (matrícula) y CENT-R26-000123 (recibo).
 * Debe llamarse DENTRO de Db::transaccion(): el FOR UPDATE bloquea la fila hasta el commit.
 */
final class Folios
{
    public static function siguiente(int $sucursalId, string $tipo): string
    {
        $anio = (int) date('Y');
        Db::ejecutar('INSERT IGNORE INTO folios (sucursal_id, tipo, anio, ultimo) VALUES (?, ?, ?, 0)', [$sucursalId, $tipo, $anio]);
        $f = Db::uno('SELECT f.ultimo, s.clave FROM folios f JOIN sucursales s ON s.id = f.sucursal_id
                      WHERE f.sucursal_id = ? AND f.tipo = ? AND f.anio = ? FOR UPDATE', [$sucursalId, $tipo, $anio]);
        $n = $f['ultimo'] + 1;
        Db::ejecutar('UPDATE folios SET ultimo = ? WHERE sucursal_id = ? AND tipo = ? AND anio = ?', [$n, $sucursalId, $tipo, $anio]);
        $aa = substr((string) $anio, 2);
        return $tipo === 'matricula'
            ? sprintf('%s-%s-%04d', $f['clave'], $aa, $n)
            : sprintf('%s-R%s-%06d', $f['clave'], $aa, $n);
    }
}
