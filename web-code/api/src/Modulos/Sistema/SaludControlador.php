<?php
declare(strict_types=1);
namespace Dojo\Modulos\Sistema;

use Dojo\Nucleo\{Db, Peticion, Respuesta};

final class SaludControlador
{
    /** GET /api/salud — para saber si la API y la base de datos responden. */
    public function ver(Peticion $req): void
    {
        $db = Db::uno('SELECT COUNT(*) tablas FROM information_schema.tables WHERE table_schema = DATABASE()');
        Respuesta::ok(['api' => 'Dojo OS', 'version' => '0.1.0', 'tablas' => (int) $db['tablas']]);
    }
}
