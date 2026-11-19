<?php
declare(strict_types=1);
namespace Dojo\Modulos\Bitacora;

use Dojo\Nucleo\{Db, Peticion};

/**
 * Bitácora de auditoría: una fila por campo cambiado (quién, qué, cuándo, valor anterior).
 * Todo servicio que da de alta, cambia o da de baja un registro debe llamarla
 * dentro de la misma transacción.
 */
final class Bitacora
{
    public static function alta(Peticion $req, string $tabla, int $id, array $datos, ?int $sucursal = null): void
    {
        foreach ($datos as $campo => $valor) self::fila($req, 'alta', $tabla, $id, $campo, null, $valor, $sucursal);
    }

    public static function cambio(Peticion $req, string $tabla, int $id, array $antes, array $despues, ?int $sucursal = null): int
    {
        $n = 0;
        foreach ($despues as $campo => $nuevo) {
            if (array_key_exists($campo, $antes) && (string) $antes[$campo] !== (string) $nuevo) {
                self::fila($req, 'cambio', $tabla, $id, $campo, $antes[$campo], $nuevo, $sucursal); $n++;
            }
        }
        return $n;
    }

    public static function baja(Peticion $req, string $tabla, int $id, ?int $sucursal = null): void
    {
        self::fila($req, 'baja', $tabla, $id, null, null, null, $sucursal);
    }

    private static function fila(Peticion $req, string $accion, string $tabla, int $id, ?string $campo, mixed $ant, mixed $nuevo, ?int $sucursal): void
    {
        Db::ejecutar('INSERT INTO bitacora (usuario_id, sucursal_id, accion, tabla, registro_id, campo, valor_anterior, valor_nuevo, ip)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [$req->ctx['usuario_id'], $sucursal ?? ($req->ctx['rol']['sucursal_id'] ?? null), $accion, $tabla, $id, $campo,
             $ant === null ? null : (string) $ant, $nuevo === null ? null : (string) $nuevo, $req->ip]);
    }
}
