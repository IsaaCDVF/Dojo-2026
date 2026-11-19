<?php
declare(strict_types=1);
namespace Dojo\Nucleo;

/**
 * Valor vigente de un parámetro. Gana el más específico:
 * sucursal + disciplina + grado  >  sucursal + disciplina  >  sucursal  >  global.
 */
final class Parametros
{
    public static function valor(string $clave, ?int $sucursal = null, ?int $disciplina = null, ?int $grado = null): ?string
    {
        $v = Db::uno(
            'SELECT v.valor FROM parametro_valores v JOIN parametros p ON p.id = v.parametro_id
             WHERE p.clave = :c AND v.vigente_desde <= NOW() AND (v.vigente_hasta IS NULL OR v.vigente_hasta > NOW())
               AND (v.sucursal_id IS NULL OR v.sucursal_id = :s)
               AND (v.disciplina_id IS NULL OR v.disciplina_id = :d)
               AND (v.grado_id IS NULL OR v.grado_id = :g)
             ORDER BY (v.grado_id IS NOT NULL) DESC, (v.disciplina_id IS NOT NULL) DESC, (v.sucursal_id IS NOT NULL) DESC
             LIMIT 1',
            ['c' => $clave, 's' => $sucursal, 'd' => $disciplina, 'g' => $grado]);
        return $v['valor'] ?? null;
    }
}
