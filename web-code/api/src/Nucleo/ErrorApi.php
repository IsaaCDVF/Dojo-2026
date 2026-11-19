<?php
declare(strict_types=1);
namespace Dojo\Nucleo;

/** Error esperado que se devuelve al cliente con su código HTTP. */
final class ErrorApi extends \RuntimeException
{
    public function __construct(string $mensaje, public readonly int $estado = 400, public readonly array $detalle = [])
    {
        parent::__construct($mensaje);
    }
}
