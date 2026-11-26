# Bitácora de cambios · Dojo OS

Cada cambio que se une a `develop` agrega una entrada aquí: **qué** cambió, **dónde**, **por qué** y **quién**.
Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versiones: 0.MINOR.PATCH mientras dure el desarrollo.

Tipos: **Agregado** (nuevo), **Cambiado** (cambia algo que ya existía), **Corregido** (error), **Quitado**, **Base de datos** (toda migración), **Seguridad**.

## [Sin publicar]

### Agregado
- 2.6 Carga masiva de alumnos desde CSV (`ImportacionControlador`): revisión sin guardar con errores por renglón, importación de los renglones válidos (matrícula, responsable nuevo o ya registrado por teléfono, hermanos con el mismo responsable, grado de migración y fecha de alta), historial de cargas y revertir una carga si nadie la ha usado. Acepta coma o punto y coma y archivos de Excel en Windows-1252. — Kevin
- Inicio con datos reales (`GET /api/inicio`): alumnos activos, cobrado hoy, alumnos con pago vencido, asistencia y rechazos del día, clases de hoy, exámenes por autorizar y próximos; cada bloque según los permisos del rol. — Kevin
- Panel: pantalla Importar alumnos (plantilla, revisión, importar, revertir) e Inicio nuevo. — Kevin
- `pruebas/importacion.sh` (60). — Kevin
- Fase 3 · Asistencia (`Modulos/Asistencia`): clases del día, registro con el QR de la credencial (inscripción, visitas a otra sucursal con límite al mes, pago vencido niega la entrada y dentro de la tolerancia entra con aviso, retardo), registro manual con excepción en bitácora, lista de la clase, validar y quitar registros, historial del alumno y nueva credencial. Los rechazos quedan en `accesos_rechazados`. — Kevin
- Panel: modo tableta (`/tableta`) que lee el QR con la cámara del celular o con un lector USB, y pantalla Asistencia para el instructor; asistencia de 90 días y "Nueva credencial" en la ficha. `npm run celular` levanta el panel con https para usar la cámara. — Kevin
- `pruebas/asistencia.sh` (73). — Kevin
- Fase 4 · Caja en mostrador (`Modulos/Pagos`): estado de cuenta por responsable calculado al momento (inscripción, mensualidades con fecha fija de cobro, recargo por pago tardío y exámenes autorizados), cotización, cobro en efectivo o transferencia con recibo y folio, saldo a favor, corte del día por método y cancelación con motivo. — Kevin
- Fase 5 · Exámenes (`Modulos/Examenes`): fechas por sucursal con fecha límite calculada, solicitud desde mostrador o portal con criterios de validación blanda (meses en el grado y asistencia), excepción de plazo y de pago, autorización del instructor con observaciones obligatorias al rechazar, resultado que sube de grado y cancelación que deja el pago como saldo a favor. — Kevin
- Panel: pantallas Caja (cobro, ticket, recibo imprimible, corte del día) y Exámenes (fechas, solicitudes, autorizar, excepciones, resultados y registro en mostrador). — Kevin
- `pruebas/caja.sh` (54) y `pruebas/examenes.sh` (65). — Kevin
- Panel: pantalla Mi perfil (correo, rol activo y sucursal) y README del panel. — Kevin
- Panel web en React + Tailwind (`web-code/panel`): inicio de sesión, elegir rol, menú por permisos, modo oscuro y claro, avisos y confirmaciones. Pantallas: Inicio, Alumnos, Ficha del alumno con credencial QR, Inscripción en 4 pasos, Horarios, Precios y promociones (con simulador), Parámetros con historial, Bitácora y Configuración (sucursales, disciplinas y grados). — Kevin
- 2.1 Horarios: alta con validación de choque de instructor, rango de grados y cupo; desactivar. — Kevin
- 2.4 Personas: alta de alumno con CURP, foto y matrícula; responsable nuevo, existente (hermanos) o él mismo; búsqueda; baja y suspensión. — Kevin
- 2.5 Inscripción: alumno + clase + grado de ubicación; avisa si la clase está llena o el grado no entra y permite autorizar la excepción. — Kevin
- Disciplinas: renombrar, baja lógica y alta de grados. — Kevin
- `pruebas/alumnos.sh` con 50 pruebas. — Kevin
- 2.2 Parámetros: guardar un valor con vigencia (cierra el anterior y abre uno nuevo en una transacción, con bitácora) y consultar su historial. Validación por tipo de dato. — Kevin
- `pruebas/fase2.sh` con 15 pruebas de parámetros. — Kevin
- 2.3 Tarifas: conceptos, precios con vigencia por sucursal, promociones (paquete, convenio, descuento) y cotización con código. Cálculo en centavos. — Kevin
- `pruebas/tarifas.sh` con 42 pruebas de tarifas y promociones. — Kevin

### Cambiado
- `EstadoCuenta`: el cálculo de mensualidades por periodo es una sola función que usan la caja, la tableta y el Inicio. — Kevin
- `Permiso::tiene()` para preguntar por permisos sin lanzar error. — Kevin
- Criterio de examen: cada N retardos cuentan como una falta al calcular el porcentaje de asistencia. — Kevin
- Alta de alumno acepta `fecha_alta` (solo con permiso `alumnos.importar`) para migrar alumnos que ya venían; de ahí sale su día de cobro. — Kevin
- Un permiso de ruta puede ser "a,b,c": basta con tener cualquiera (`Permiso::exigir`). — Kevin
- Los roles de alcance propio (alumno, responsable) solo ven sus alumnos, su estado de cuenta y sus recibos (`Permiso::alumnosPropios`, `exigirAlumno`, `exigirResponsable`). — Kevin

### Corregido
- Semillas: las fechas de vigencia iniciales eran `NOW()` en la zona del contenedor (UTC) y quedaban "en el futuro" frente a la API (hora de México); ahora son una fecha fija. — Kevin
- Panel: las fechas sin hora (`2026-11-28`) se mostraban un día antes. — Kevin

### Base de datos
- Semilla demo: usuario de la tableta de Centro (`tableta.centro@dojoos.mx`). Para una base que ya existe: `database-code/parches/2026-11-24_usuario_tableta.sql`. — Kevin
- Semilla demo: precios base de examen (450), pase de un día (150) y recargo (100). Solo aplica al crear la base desde cero. — Kevin

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
