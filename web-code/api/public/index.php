<?php
// Punto de entrada único de la API. Nginx manda aquí todas las peticiones /api/*.
declare(strict_types=1);

spl_autoload_register(function (string $clase): void {
    // Dojo\Nucleo\Router -> src/Nucleo/Router.php
    $ruta = __DIR__ . '/../src/' . str_replace(['Dojo\\', '\\'], ['', '/'], $clase) . '.php';
    if (is_file($ruta)) require $ruta;
});

use Dojo\Nucleo\{Config, Peticion, Respuesta, Router, ErrorApi};

Config::cargar(__DIR__ . '/../.env');
date_default_timezone_set(Config::get('APP_TZ', 'America/Mexico_City'));
header('Content-Type: application/json; charset=utf-8');

try {
    $router = new Router();
    require __DIR__ . '/../src/rutas.php';
    $router->despachar(Peticion::desdeGlobales());
} catch (ErrorApi $e) {
    Respuesta::error($e->getMessage(), $e->estado, $e->detalle);
} catch (Throwable $e) {
    error_log((string) $e);
    Respuesta::error(Config::get('APP_DEBUG') === '1' ? $e->getMessage() : 'Error interno', 500);
}
