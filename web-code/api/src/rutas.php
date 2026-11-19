<?php
// Tabla de rutas de la API. Cada ruta indica el permiso que exige (null = pública,
// '' = solo requiere sesión). Al agregar una ruta, actualizar docs/api.md.
use Dojo\Modulos\Sistema\SaludControlador;
use Dojo\Modulos\Auth\AuthControlador;
use Dojo\Modulos\Catalogos\{SucursalControlador, DisciplinaControlador, ParametroControlador};
use Dojo\Modulos\Bitacora\BitacoraControlador;

/** @var Dojo\Nucleo\Router $router */
$router->get('/api/salud',                    [SaludControlador::class, 'ver'],            null);

$router->post('/api/auth/login',              [AuthControlador::class, 'login'],           null);
$router->post('/api/auth/rol',                [AuthControlador::class, 'elegirRol'],       '');
$router->get('/api/auth/yo',                  [AuthControlador::class, 'yo'],              '');
$router->post('/api/auth/logout',             [AuthControlador::class, 'logout'],          '');

$router->get('/api/sucursales',               [SucursalControlador::class, 'listar'],      'horarios.ver');
$router->post('/api/sucursales',              [SucursalControlador::class, 'crear'],       'sucursales.gestionar');
$router->put('/api/sucursales/{id}',          [SucursalControlador::class, 'editar'],      'sucursales.gestionar');

$router->get('/api/disciplinas',              [DisciplinaControlador::class, 'listar'],    'horarios.ver');
$router->post('/api/disciplinas',             [DisciplinaControlador::class, 'crear'],     'disciplinas.gestionar');
$router->get('/api/disciplinas/{id}/grados',  [DisciplinaControlador::class, 'grados'],    'horarios.ver');

$router->get('/api/parametros',               [ParametroControlador::class, 'vigentes'],   'parametros.ver');

$router->get('/api/bitacora',                 [BitacoraControlador::class, 'buscar'],      'bitacora.ver');
$router->post('/api/parametros/valores',  [ParametroControlador::class, 'guardarValor'], 'parametros.editar');