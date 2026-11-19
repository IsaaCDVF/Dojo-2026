<?php
declare(strict_types=1);
namespace Dojo\Nucleo;

final class Peticion
{
    /** Contexto que llenan los middleware: usuario, rol activo, sucursal, alcance. */
    public array $ctx = [];
    public array $params = [];

    public function __construct(
        public readonly string $metodo,
        public readonly string $ruta,
        public readonly array $query,
        public readonly array $cuerpo,
        public readonly ?string $token,
        public readonly ?string $ip,
    ) {}

    public static function desdeGlobales(): self
    {
        $json = json_decode(file_get_contents('php://input') ?: '[]', true);
        $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
        return new self(
            $_SERVER['REQUEST_METHOD'] ?? 'GET',
            rtrim(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH), '/') ?: '/',
            $_GET,
            is_array($json) ? $json : [],
            str_starts_with($auth, 'Bearer ') ? substr($auth, 7) : null,
            $_SERVER['REMOTE_ADDR'] ?? null,
        );
    }

    /** Valida campos obligatorios del cuerpo y los devuelve. */
    public function requeridos(string ...$campos): array
    {
        $faltan = array_values(array_filter($campos, fn($c) => !isset($this->cuerpo[$c]) || $this->cuerpo[$c] === ''));
        if ($faltan) throw new ErrorApi('Faltan datos obligatorios', 422, ['faltan' => $faltan]);
        return array_intersect_key($this->cuerpo, array_flip($campos));
    }
}
