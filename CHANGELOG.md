# Bitácora de cambios · Dojo OS

Cada cambio que se une a `develop` agrega una entrada aquí: **qué** cambió, **dónde**, **por qué** y **quién**.
Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versiones: 0.MINOR.PATCH mientras dure el desarrollo.

Tipos: **Agregado** (nuevo), **Cambiado** (cambia algo que ya existía), **Corregido** (error), **Quitado**, **Base de datos** (toda migración), **Seguridad**.

## [Sin publicar]

### Agregado
- 2.2 Parámetros: guardar un valor con vigencia (cierra el anterior y abre uno nuevo en una transacción, con bitácora) y consultar su historial. Validación por tipo de dato. — Kevin
- `pruebas/fase2.sh` con 15 pruebas de parámetros. — Kevin

## [0.1.0] · 2026-11-06 · Fase 1, primera entrega
### Agregado
- Estructura del repositorio: `api/`, `web/`, `db/`, `docker/`, `docs/`, `pruebas/`. — Kevin
- `docker-compose.yml` con MySQL 8.4 (puerto 3307), PHP 8.3-FPM y Nginx (puerto 8080). — Kevin
- Núcleo de la API en PHP puro: enrutador, conexión PDO, respuestas JSON, manejo de errores. — Kevin
- Inicio de sesión con token, elección de rol cuando la persona tiene varios, cierre de sesión. — Kevin
- Permisos por rol revisados en el servidor y alcance por sucursal (global, sucursal, propio). — Kevin
- Bitácora de auditoría: una fila por campo con valor anterior y nuevo, en la misma transacción. — Kevin
- Folios legibles sin repetir: matrícula `CENT-26-0001` y recibo `CENT-R26-000001`. — Kevin
- Catálogos de ejemplo: sucursales (alta, cambio, lista), disciplinas y grados, parámetros vigentes. — Kevin
- `pruebas/fase1.sh`: 26 pruebas de acceso, permisos, alcance y bitácora. — Kevin

### Base de datos (modelo v0.5 → v0.6)
- Migraciones separadas por bloque en `db/migraciones` (000 a 007) y semillas en `db/semillas`.
- `personas`: + `curp` (única) y `foto` — los pedía RF-14 y faltaban.
- `alumnos`: + `matricula` única — la pedía RF-67 y faltaba.
- `sucursales`: + `clave` de 4 letras, prefijo de los folios.
- `roles`: + `descripcion`, `nivel` (1 a 5) y `alcance`; nuevo rol `tableta` para el dispositivo de asistencia.
- `permisos`: + `nivel_minimo`; catálogo inicial de 37 permisos y su asignación a los 7 roles.
- `usuarios`: + `intentos_fallidos`, `bloqueado_hasta`.
- `horarios`: + `nivel`, `grado_desde_id`, `grado_hasta_id`, `activo` — para "No perteneces a esta clase".
- `disciplinas`, `grados`: + `activa`/`activo` (baja lógica).
- `pagos`: + `folio` de recibo. `bitacora`: + `ip`.
- Tablas nuevas: `folios` (consecutivos por sucursal y año) y `sesiones` (token cifrado, expiración por inactividad).
- Parámetros nuevos: `minutos_inactividad_sesion` (30, por confirmar con el cliente) e `intentos_login` (5).

### Seguridad
- Contraseñas con `password_hash`; el token de sesión se guarda solo como SHA-256.
- Bloqueo de 15 minutos tras 5 intentos fallidos; mismo mensaje si el correo no existe.
- Sesión que expira por inactividad según parámetro y se invalida al cerrar sesión.
