<?php
// Tabla de rutas de la API. Cada ruta indica el permiso que exige (null = pública,
// '' = solo requiere sesión). Al agregar una ruta, actualizar docs/api.md.
use Dojo\Modulos\Sistema\SaludControlador;
use Dojo\Modulos\Auth\AuthControlador;
use Dojo\Modulos\Catalogos\{SucursalControlador, DisciplinaControlador, ParametroControlador,
    ConceptoControlador, PrecioControlador, PromocionControlador};
use Dojo\Modulos\Bitacora\BitacoraControlador;
use Dojo\Modulos\Horarios\HorarioControlador;
use Dojo\Modulos\Personas\AlumnoControlador;
use Dojo\Modulos\Inscripciones\InscripcionControlador;

/** @var Dojo\Nucleo\Router $router */
$router->get('/api/salud',                       [SaludControlador::class, 'ver'],             null);

$router->post('/api/auth/login',                 [AuthControlador::class, 'login'],            null);
$router->post('/api/auth/rol',                   [AuthControlador::class, 'elegirRol'],        '');
$router->get('/api/auth/yo',                     [AuthControlador::class, 'yo'],               '');
$router->post('/api/auth/logout',                [AuthControlador::class, 'logout'],           '');

$router->get('/api/sucursales',                  [SucursalControlador::class, 'listar'],       'horarios.ver');
$router->post('/api/sucursales',                 [SucursalControlador::class, 'crear'],        'sucursales.gestionar');
$router->put('/api/sucursales/{id}',             [SucursalControlador::class, 'editar'],       'sucursales.gestionar');

$router->get('/api/disciplinas',                 [DisciplinaControlador::class, 'listar'],     'horarios.ver');
$router->post('/api/disciplinas',                [DisciplinaControlador::class, 'crear'],      'disciplinas.gestionar');
$router->put('/api/disciplinas/{id}',            [DisciplinaControlador::class, 'editar'],     'disciplinas.gestionar');
$router->get('/api/disciplinas/{id}/grados',     [DisciplinaControlador::class, 'grados'],     'horarios.ver');
$router->post('/api/disciplinas/{id}/grados',    [DisciplinaControlador::class, 'crearGrado'], 'grados.gestionar');

// 2.2 Parámetros
$router->get('/api/parametros',                  [ParametroControlador::class, 'vigentes'],    'parametros.ver');
$router->post('/api/parametros/valores',         [ParametroControlador::class, 'guardarValor'],'parametros.editar');
$router->get('/api/parametros/historial',        [ParametroControlador::class, 'historial'],   'parametros.ver');

// 2.3 Tarifas y promociones
$router->get('/api/conceptos',                   [ConceptoControlador::class, 'listar'],       'horarios.ver');
$router->post('/api/conceptos',                  [ConceptoControlador::class, 'crear'],        'precios.gestionar');
$router->get('/api/precios',                     [PrecioControlador::class, 'listar'],         'horarios.ver');
$router->post('/api/precios',                    [PrecioControlador::class, 'guardar'],        'precios.gestionar');
$router->get('/api/precios/historial',           [PrecioControlador::class, 'historial'],      'precios.gestionar');
$router->get('/api/promociones',                 [PromocionControlador::class, 'listar'],      'horarios.ver');
$router->post('/api/promociones',                [PromocionControlador::class, 'crear'],       'promociones.gestionar');
$router->put('/api/promociones/{id}/desactivar', [PromocionControlador::class, 'desactivar'],  'promociones.gestionar');
$router->post('/api/cotizar',                    [PromocionControlador::class, 'cotizar'],     'inscripciones.crear');

// 2.1 Horarios
$router->get('/api/horarios',                    [HorarioControlador::class, 'listar'],        'horarios.ver');
$router->get('/api/horarios/{id}',               [HorarioControlador::class, 'ver'],           'horarios.ver');
$router->post('/api/horarios',                   [HorarioControlador::class, 'crear'],         'horarios.gestionar');
$router->put('/api/horarios/{id}/desactivar',    [HorarioControlador::class, 'desactivar'],    'horarios.gestionar');
$router->get('/api/instructores',                [HorarioControlador::class, 'instructores'],  'horarios.ver');

// 2.4 Personas
$router->get('/api/alumnos',                     [AlumnoControlador::class, 'buscar'],         'alumnos.ver');
$router->post('/api/alumnos',                    [AlumnoControlador::class, 'crear'],          'alumnos.crear');
$router->get('/api/alumnos/{id}',                [AlumnoControlador::class, 'ver'],            'alumnos.ver');
$router->get('/api/alumnos/{id}/foto',           [AlumnoControlador::class, 'foto'],           'alumnos.ver');
$router->put('/api/alumnos/{id}/estado',         [AlumnoControlador::class, 'cambiarEstado'],  'alumnos.baja');
$router->get('/api/responsables',                [AlumnoControlador::class, 'responsables'],   'responsables.gestionar');

// 2.5 Inscripción
$router->post('/api/inscripciones',              [InscripcionControlador::class, 'crear'],     'inscripciones.crear');
$router->put('/api/inscripciones/{id}/terminar', [InscripcionControlador::class, 'terminar'],  'inscripciones.crear');

$router->get('/api/bitacora',                    [BitacoraControlador::class, 'buscar'],       'bitacora.ver');
