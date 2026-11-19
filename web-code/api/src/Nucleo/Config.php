<?php
declare(strict_types=1);
namespace Dojo\Nucleo;

/** Lee variables del archivo .env (que nunca se sube a GitHub) y del entorno. */
final class Config
{
    private static array $valores = [];

    public static function cargar(string $archivo): void
    {
        if (!is_file($archivo)) return;
        foreach (file($archivo, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $linea) {
            if (str_starts_with(trim($linea), '#') || !str_contains($linea, '=')) continue;
            [$k, $v] = array_map('trim', explode('=', $linea, 2));
            self::$valores[$k] = trim($v, "\"'");
        }
    }

    public static function get(string $clave, ?string $defecto = null): ?string
    {
        return getenv($clave) !== false ? getenv($clave) : (self::$valores[$clave] ?? $defecto);
    }
}
