# Bitácora de cambios · Dojo OS

Cada cambio que se une a `develop` agrega una entrada aquí: **qué** cambió, **dónde**, **por qué** y **quién**.
Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versiones: 0.MINOR.PATCH mientras dure el desarrollo.

Tipos: **Agregado** (nuevo), **Cambiado** (cambia algo que ya existía), **Corregido** (error), **Quitado**, **Base de datos** (toda migración), **Seguridad**.

## [Sin publicar]

### Agregado
- Caja → "Por cobrar" (recepción y admin): debajo del buscador, la lista de quién debe sin buscar uno por uno — vencidos (desde cuándo), los que vencen en los próximos 7 días y todos con algo pendiente, con su total; un clic abre su cuenta para cobrar. Cada sucursal ve la suya; el súper admin elige sucursal. — Kevin
- Caja → cobro con tarjeta por QR: recepción marca qué se paga, elige "Tarjeta" y sale un QR de Mercado Pago; la persona lo escanea con su celular y paga con su tarjeta (sin OXXO ni SPEI, porque está en el mostrador). La pantalla ve el pago sola y abre el recibo. Si rechazan la tarjeta puede intentar con otra en el mismo QR; también se puede mandar la liga por WhatsApp, dejarlo para después o cancelarlo. Las llaves de Mercado Pago siguen siendo solo del súper admin. En modo prueba hay botones para simular. El recibo y el corte dicen "QR en caja". — Kevin
- Panel → menú de la cuenta (arriba a la derecha, como en cualquier sistema actual): Datos personales, Preferencias, Seguridad, Ayuda, Atajos de teclado y Cerrar sesión. "Mi perfil" pasa a ser **Mi cuenta** (`/cuenta`) con secciones: datos personales (cambiar teléfono y correo; el correo pide la contraseña), preferencias (idioma, tema y tamaño de letra para **todos** los roles: recepción, instructores, admin), seguridad (cambiar contraseña y ver/cerrar los equipos con sesión abierta) y ayuda según el rol. Todo en español e inglés. — Kevin
- Atajos de teclado en el panel: `?` (lista), `/` (buscador de la pantalla), `T` (claro/oscuro) y `G` + letra para ir a Inicio, Alumnos, Inscripción, Caja, Avisos, Horarios, Asistencia, Exámenes o Mi cuenta (solo las que tu rol puede abrir). — Kevin
- App → Mi cuenta como menú de opciones: Teléfono y correo, Domicilio, Seguridad (contraseña y celulares con sesión abierta), Apariencia, Notificaciones, Ayuda (WhatsApp y teléfono de su sucursal y preguntas frecuentes) y Cerrar sesión, cada una en su pantalla. — Kevin
- El logo siempre se ve: si es blanco y alguien usa el modo claro (o negro en el modo oscuro), se pinta solo del color que se lee, en la app, el login, el menú y los recibos. Si subieron logo para fondo claro y para fondo oscuro, se usa el que toca. — Kevin
- `pruebas/caja_qr.sh` (67) y `pruebas/cuenta.sh` (36). — Kevin

### Corregido
- Avisos: en Docker, "Revisar ahora" (y el aviso de examen autorizado) no hacían nada si justo estaba corriendo la revisión automática de cada hora; ahora esperan a que termine. Por eso fallaban 10 pruebas de `avisos.sh`. — Kevin
- Avisos automáticos (menú Avisos): el sistema arma solo cuatro avisos — pago por vencer (según `dias_aviso_pago`, por ejemplo 3 y 1 día antes), pago vencido (un solo aviso con todo lo vencido), días sin venir (parámetro nuevo `dias_sin_asistir`, 14 por defecto; 0 = apagado) y examen autorizado (sale en cuanto el instructor lo autoriza). Recepción los ve en "Por mandar" y con el botón WhatsApp se abre su WhatsApp con el mensaje ya escrito (gratis, sin contratar nada); queda en "Enviados" con quién lo mandó. Si ya pagó, ya vino o le cancelaron el examen, el aviso se quita solo. Cada aviso sale una sola vez. — Kevin
- Sin cron ni cambios en Docker: los avisos se revisan solos cuando alguien usa el sistema (panel, app o la tableta), como mucho una vez por hora y de 8:00 a 21:00, después de responder (no hace esperar a nadie). Botón "Revisar ahora". — Kevin
- Textos de los avisos (admin): cada aviso tiene su texto para la app y para WhatsApp, con variables como {nombre}, {alumno}, {monto} o {fecha}, y se puede apagar. — Kevin
- App: campanita con los avisos de la persona (con contador de nuevos) y notificaciones al celular (Web Push, gratis): "Activar notificaciones" en la campanita y una vez en Mi familia. Al tocar la notificación abre la pantalla del aviso (pagar, examen). En iPhone funciona con la app agregada a la pantalla de inicio. Al cerrar sesión, ese celular deja de recibirlas. Las llaves de notificación se crean solas y se guardan cifradas; no se toca el `.env`. — Kevin
- `pruebas/avisos.sh` (99). — Kevin
- Pago en línea desde la app con Mercado Pago (tarjeta, OXXO, SPEI y saldo de Mercado Pago): el responsable elige qué pagar (la mensualidad vencida va con su recargo), paga en el checkout de Mercado Pago y recibe su recibo con folio; las fichas de OXXO y SPEI quedan pendientes hasta que se pagan. Si lo pagan en caja mientras la ficha sigue viva, lo repetido queda como saldo a favor. — Kevin
- Configuración → Pagos en línea (súper admin): apagado, modo prueba (simula todo dentro del sistema, no cobra) o cobrar con Mercado Pago; Access Token, Public Key, clave de avisos y dirección pública. Las llaves se guardan cifradas (`web-code/api/almacen/llaves/`) y nunca se vuelven a mostrar; no se toca el `.env`. Botón "Probar conexión". — Kevin
- Avisos de Mercado Pago (webhook) con validación de firma, y consulta a Mercado Pago cuando la persona vuelve a la app (funciona aunque el servidor no sea público). — Kevin
- Caja: las líneas con un pago en línea en proceso dicen "Pagando en línea (OXXO/SPEI)". — Kevin
- `pruebas/pagos_linea.sh` (91). — Kevin
- Tabletas de asistencia (Configuración → Tabletas): la tableta de la entrada se conecta con un código de 6 dígitos que muestra en pantalla (`/tableta/vincular`, también desde el login), sin correo ni contraseña. Se queda conectada (no se cierra por inactividad) hasta que la desconectan desde el panel; la lista muestra si está en línea. Las cuentas de tableta con correo de antes siguen funcionando y se listan aparte. — Kevin
- La tableta ya no pide elegir la clase: el alumno acerca su QR y el sistema busca la clase de ahorita en la que está inscrito (si tiene dos seguidas, la más cercana y luego la siguiente; si viene de otra sucursal, una de su disciplina como visita). Muestra las clases de ahora y en el resultado de qué clase quedó. Elegir una clase a mano sigue disponible. Se puede agregar a la pantalla de inicio y abre a pantalla completa. — Kevin
- `pruebas/tabletas.sh` (81). — Kevin
- App: modo claro, además del oscuro. En Mi cuenta se elige "Como mi celular" (la que viene puesta), Claro u Oscuro, y en la cabecera hay un botón de sol/luna. Se guarda en el celular y en su cuenta. Los colores de la marca se respetan en los dos; los que se usan como letra se oscurecen solos para leerse sobre blanco. — Kevin
- App: Mi cuenta. El alumno o el responsable cambia su teléfono, correo y domicilio sin ir a recepción (teléfono y correo piden su contraseña porque sirven para entrar), y su contraseña. Nombre, fecha de nacimiento y CURP siguen en recepción. Los cambios quedan en bitácora y el domicilio se ve en la ficha del alumno. — Kevin
- Personal y accesos (Configuración → Personal y accesos): el súper admin da de alta a cada persona y le da uno o varios roles por sucursal (admin de sucursal, recepción, instructor, tableta); el admin de sucursal da recepción, instructor y tableta en la suya. Quitar roles, desactivar y generar contraseña temporal nueva; todo cierra las sesiones al momento y queda en bitácora. — Kevin
- Contraseña temporal: al dar de alta se genera una (se ve una sola vez, con botón para mandarla por WhatsApp) y la persona debe crear la suya al entrar; la API bloquea todo lo demás mientras tanto. Cambiar contraseña también en Mi perfil. — Kevin
- Nueva sucursal en 5 pasos: datos (la clave se sugiere sola), domicilio, disciplinas que se dan ahí, encargado (persona nueva o alguien del personal) y revisar. Se guarda todo junto. Editar sucursal con teléfono, domicilio, disciplinas y su personal; la lista muestra encargado, ciudad y avisa si una sucursal no tiene encargado. — Kevin
- `pruebas/personal.sh` (109). — Kevin
- Letra propia para el nombre comercial (Apariencia y marca → Letra del nombre): condensada, titular, gruesa, deportiva, elegante o pincel, además de la del sistema. Botones para decorar letras del nombre con raya arriba, subrayado o tachado (por ejemplo, KEMMA ST̅O̅R̅E̅): se dibuja como una línea continua en el panel, el login, los recibos y la app, aunque el nombre venga de copiar y pegar. — Kevin
- App: el alumno que entra por primera vez arma su avatar en 5 pasos (tono de piel, peinado, color de cabello, barba o bigote si no es niño, y complexión) con vista previa animada; puede dejarlo para después y cambiarlo cuando quiera en Mi avatar → Tú. — Kevin
- Marca blanca (Configuración → Apariencia y marca): nombre comercial y lema, logo para fondo claro, para fondo oscuro e ícono; 6 temas de color listos o uno personalizado con revisión automática de contraste; 8 tipos de letra incluidos en el sistema; idioma, moneda, zona horaria y país. Vista previa en vivo en modo claro y oscuro. La marca aparece en el panel, el login, los recibos, las credenciales y la app de alumnos (nombre, logo, colores e ícono al instalarla). — Kevin
- Asistente de logo (Apariencia y marca): se sube una sola imagen y el sistema detecta y quita el fondo, recorta el espacio sobrante, acomoda en horizontal un logo apilado, revisa que se vea en fondo claro y en el menú oscuro (si no, propone versión en blanco/negro o con placa) y saca el símbolo para el ícono. Vista previa de menú, recibo, pestaña y celular antes de guardar. Todo se procesa en el navegador. En el menú, un logo casi cuadrado se muestra con el nombre escrito al lado. — Kevin
- Preferencias por usuario en Mi perfil: idioma (o el de la empresa), tema claro/oscuro/como mi equipo y tamaño de letra. — Kevin
- Traducción con i18next (`web-code/panel/src/i18n`): español e inglés en el menú, la barra superior, el login, elegir rol, Mi perfil y Apariencia. Las demás pantallas siguen en español por ahora. Dinero y fechas con el formato del idioma y la moneda de la empresa. — Kevin
- `pruebas/marca.sh` (60; guarda la marca que haya y la regresa al terminar). — Kevin
- Fase 6 · App móvil para alumnos y responsables (`app-code`, PWA en `/app/`): inicio con credencial QR, rumbo a la siguiente cinta, semana de asistencia y racha; Mi camino de cintas; avatar en SVG con accesorios que se desbloquean por grado e insignias; solicitar examen; Mi familia con lo que se debe, pagos y recibos. Se instala en el celular desde el navegador. — Kevin
- Acceso a la app desde la ficha del alumno (tarjeta "App Dojo OS"): recepción genera un código de 6 dígitos (72 h) y lo manda por WhatsApp; la persona activa su cuenta y crea su contraseña. Volver a generar el código sirve para "olvidé mi contraseña". — Kevin
- API `Modulos/App` (`AccesoControlador`, `AppControlador`); el inicio de sesión acepta matrícula o teléfono. — Kevin
- Avatar animado y personalizable (el mismo dibujo de frente): movimientos de cada disciplina al tocarlo o con botones (Taekwondo: jirugi, dollyo chagi, kyungrye; Karate: oi-zuki, mae-geri, rei; Box: jab, uppercut, victoria; Jiu-Jitsu: derribo, victoria, saludo), tono de piel, peinado, color de cabello, vello facial (no en niños) y complexión. Lo bloqueado se ve a color y se puede probar (vista previa) sin guardarlo. — Kevin
- `pruebas/app.sh` (133). — Kevin
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
- `Cotizador` (nuevo): la caja y el pago en línea arman el ticket con el mismo código. El corte del día ya no lista intentos en línea rechazados o sin pagar, y en "Cobró" dice "App · en línea". — Kevin
- Personal y accesos ya no ofrece el rol de tableta para personas (la tableta se conecta en Configuración → Tabletas) ni lista las tabletas conectadas. — Kevin
- App: el login ya no muestra un avatar de ejemplo; ahora es la portada de la empresa: su símbolo en grande, el nombre con su letra y el lema. — Kevin
- La sesión de alumnos y responsables dura `dias_sesion_app` días (para no pedir la contraseña cada vez que abren la app); el personal sigue con `minutos_inactividad_sesion`. Ficha del alumno: tarjeta "App Dojo OS". — Kevin
- `EstadoCuenta`: el cálculo de mensualidades por periodo es una sola función que usan la caja, la tableta y el Inicio. — Kevin
- `Permiso::tiene()` para preguntar por permisos sin lanzar error. — Kevin
- Criterio de examen: cada N retardos cuentan como una falta al calcular el porcentaje de asistencia. — Kevin
- Alta de alumno acepta `fecha_alta` (solo con permiso `alumnos.importar`) para migrar alumnos que ya venían; de ahí sale su día de cobro. — Kevin
- Un permiso de ruta puede ser "a,b,c": basta con tener cualquiera (`Permiso::exigir`). — Kevin
- Los roles de alcance propio (alumno, responsable) solo ven sus alumnos, su estado de cuenta y sus recibos (`Permiso::alumnosPropios`, `exigirAlumno`, `exigirResponsable`). — Kevin

### Corregido
- Pagos en línea: Chrome metía la contraseña guardada del panel en los campos del Access Token y de la clave de avisos (y salía "El Access Token empieza con APP_USR-"). Ahora esos campos no se autollenan. — Kevin
- La lista de instructores para horarios ya no muestra a personal desactivado. `pruebas/asistencia.sh` usa a Laura como instructora (antes tomaba el primero de la lista y fallaba si había más instructores) y conecta su propia tableta con código en lugar de entrar con la cuenta `tableta.centro@dojoos.mx` (76 pruebas; ya no falla si esa cuenta se desactivó o se le cambió la contraseña). — Kevin
- Las ventanas del panel mandaban el cursor a la X al escribir la primera letra (no dejaba escribir); ahora al abrir el cursor va directo al primer campo. Pasaba en todas las ventanas. — Kevin
- Login del panel: con un logo cuadrado (solo el símbolo) no se veía el nombre de la empresa; ahora va abajo con su letra. — Kevin
- Semillas: las fechas de vigencia iniciales eran `NOW()` en la zona del contenedor (UTC) y quedaban "en el futuro" frente a la API (hora de México); ahora son una fecha fija. — Kevin
- Panel: las fechas sin hora (`2026-11-28`) se mostraban un día antes. — Kevin

### Base de datos
- `016_caja_qr_sesiones.sql`: `pagos_en_linea.canal` (app | caja) y `sesiones.dispositivo` (navegador desde donde entró). Para una base que ya existe: `parches/2026-11-27_caja_qr_sesiones.sql` (**obligatorio**: sin la columna `canal` no se pueden crear pagos en línea; se puede correr dos veces). — Kevin
- `015_avisos.sql`: completa `plantillas_notificacion` (activa, título) y `notificaciones` (clave única, sucursal, teléfono, leída, quién la mandó, estado `omitida`); tablas `push_suscripciones` y `sistema_estado`. Semilla `004_avisos.sql`: parámetro `dias_sin_asistir`, permisos `avisos.enviar` (admin, admin de sucursal, recepción) y `avisos.configurar` (admin, admin de sucursal) y los 8 textos. Para una base que ya existe: `parches/2026-11-27_avisos.sql` (se puede correr dos veces). — Kevin
- `014_pagos_en_linea.sql`: `pasarela_config` y `pagos_en_linea`; permiso `pasarela.configurar` y mensajes nuevos en `codigos_respuesta_pasarela` (en semillas). Para una base que ya existe: `parches/2026-11-26_pagos_en_linea.sql` (se puede correr dos veces). — Kevin
- `013_dispositivos.sql`: tablas `dispositivos` y `dispositivo_vinculos`. Para una base que ya existe: `parches/2026-11-26_dispositivos.sql` (**obligatorio**: sin estas tablas la API no deja entrar a nadie; se puede correr dos veces). — Kevin
- `012_sucursal_completa_personal.sql`: `sucursales.telefono` y `usuarios.debe_cambiar_password`. Para una base que ya existe: `parches/2026-11-26_sucursal_personal.sql` (se puede correr dos veces). — Kevin
- `011_marca_fuente_nombre.sql`: columna `marca.fuente_nombre` (letra del nombre comercial). Para una base que ya existe: `parches/2026-11-26_marca_nombre.sql` (se puede correr dos veces). — Kevin
- `010_marca_preferencias`: tablas `marca`, `marca_imagenes` y `usuario_preferencias`; permiso `marca.editar` para el súper administrador. Para una base que ya existe: `database-code/parches/2026-11-26_marca.sql`. — Kevin
- `008_app_movil`: tabla `activaciones`. Semilla `003_app_demo`: parámetro `dias_sesion_app`, insignias por grado y 16 accesorios de Taekwondo. Para una base que ya existe: `database-code/parches/2026-11-25_app_movil.sql`. `009_avatar_apariencia`: tabla `avatar_apariencia` (parche `2026-11-25_avatar_apariencia.sql`). — Kevin
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
