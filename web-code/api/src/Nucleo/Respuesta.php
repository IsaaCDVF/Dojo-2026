<?php
declare(strict_types=1);
namespace Dojo\Nucleo;

/** Formato único de respuesta: { "ok": true, "datos": ... } o { "ok": false, "error": ... } */
final class Respuesta
{
    public static function ok(mixed $datos = null, int $estado = 200): void
    {
        http_response_code($estado);
        echo json_encode(['ok' => true, 'datos' => $datos], JSON_UNESCAPED_UNICODE);
    }

    public static function error(string $mensaje, int $estado = 400, array $detalle = []): void
    {
        http_response_code($estado);
        echo json_encode(['ok' => false, 'error' => $mensaje] + ($detalle ? ['detalle' => $detalle] : []), JSON_UNESCAPED_UNICODE);
    }
}
