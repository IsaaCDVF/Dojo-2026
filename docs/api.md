# API de Dojo OS · v0.1.0

Base: `http://localhost:8080/api` (desarrollo). Todo es JSON en UTF-8.

**Respuesta correcta:** `{ "ok": true, "datos": ... }`  
**Error:** `{ "ok": false, "error": "mensaje para el usuario", "detalle": { ... } }`

**Sesión:** `POST /auth/login` devuelve un `token`; si `debe_cambiar_password` es `true` (entró con contraseña temporal) todo lo que pide permiso responde 403 hasta que llame `PUT /auth/contrasena`. El token se manda en cada petición como `Authorization: Bearer <token>`.
Si la persona tiene varios roles, debe llamar `POST /auth/rol` antes de usar el resto (si no, responde 409).

| Código | Significa |
|---|---|
| 200 / 201 | Correcto / creado |
| 401 | Sin sesión, token inválido o sesión expirada por inactividad |
| 403 | El rol activo no tiene el permiso, o el dato es de otra sucursal |
| 404 / 405 | Ruta o registro no existe / método no permitido |
| 409 | Duplicado, o falta elegir rol |
| 422 | Datos faltantes o inválidos (`detalle.faltan`) |
| 423 | Cuenta bloqueada por intentos fallidos |

## Endpoints (fase 1)

| Método | Ruta | Permiso | Qué hace |
|---|---|---|---|
| GET | /salud | pública | Estado de la API y número de tablas |
| POST | /auth/login | pública | `{email, password}` → `{token, roles, debe_elegir_rol, debe_cambiar_password}` |
| POST | /auth/rol | sesión | `{usuario_rol_id}` elige con qué rol y sucursal trabajar |
| GET | /auth/yo | sesión | Usuario, rol activo, todos sus roles y permisos (para el menú) |
| POST | /auth/logout | sesión | Cierra la sesión |
| PUT | /auth/contrasena | sesión | `{actual, nueva}`: mínimo 8, con letras y números, distinta a la actual. Quita `debe_cambiar_password` y cierra sus otras sesiones |
| GET | /sucursales | horarios.ver | Lista; un rol de sucursal solo ve la suya |
| POST | /sucursales | sucursales.gestionar | `{clave (4 letras), nombre, telefono?, domicilio?:{calle, numero?, colonia?, cp, municipio, estado}, disciplinas?:[ids], encargado?: {usuario_id} \| {nuevo:{nombre, apellido_paterno, apellido_materno?, fecha_nacimiento, email, telefono?}}}`. Todo o nada (si el encargado falla no queda la sucursal). Con encargado nuevo responde `encargado_nuevo` con su contraseña temporal. El panel pide todo; la API acepta solo clave y nombre |
| GET | /sucursales/{id} | horarios.ver | Con `domicilio`, `disciplinas` y `personal` (roles activos de la sucursal) |
| PUT | /sucursales/{id} | sucursales.gestionar | `{nombre?, activa?, telefono?, domicilio?, disciplinas?}` — la clave no cambia. Quitar una disciplina con horarios activos → 409. Registra en bitácora cada campo |
| GET | /disciplinas | horarios.ver | Lista con número de grados |
| POST | /disciplinas | disciplinas.gestionar | `{nombre}` |
| GET | /disciplinas/{id}/grados | horarios.ver | Grados en orden |
| GET | /parametros | parametros.ver | Valor vigente de cada parámetro en la sucursal del rol |
| GET | /bitacora | bitacora.ver | `?tabla=&registro_id=` últimos 200 cambios |
| POST | /parametros/valores | parametros.editar | `{clave, valor, sucursal_id?, disciplina_id?, grado_id?}`: cierra el vigente de ese alcance y abre uno nuevo, con bitácora |
| GET | /parametros/historial | parametros.ver | `?clave=`: todos los valores, del más nuevo al más viejo, con sucursal y quién lo cambió |
| GET | /conceptos | horarios.ver | `?tipo=` lista de lo que se cobra |
| POST | /conceptos | precios.gestionar | `{nombre, tipo}` alta de concepto (producto, mensualidad...) |
| GET | /precios | horarios.ver | `?sucursal_id=` cada concepto con su precio vigente (el de la sucursal gana al global) |
| POST | /precios | precios.gestionar | `{concepto_id, monto, sucursal_id?}` cierra el vigente y abre uno nuevo, con bitácora |
| GET | /precios/historial | precios.gestionar | `?concepto_id=` todos los precios que ha tenido |
| GET | /promociones | horarios.ver | `?vigentes=1` paquetes, convenios y descuentos con lo que descuentan |
| POST | /promociones | promociones.gestionar | `{nombre, tipo, codigo?, institucion?, sucursal_id?, vigente_desde, vigente_hasta?, conceptos[]}` |
| PUT | /promociones/{id}/desactivar | promociones.gestionar | baja lógica de la promoción |
| POST | /cotizar | inscripciones.crear | `{sucursal_id?, codigo?, conceptos[{concepto_id, cantidad?}]}` precio, descuento y total por línea |

## Cómo agregar un endpoint
1. Ruta en `api/src/rutas.php` con su permiso.
2. Si el permiso es nuevo: agregarlo en una migración nueva (`INSERT INTO permisos` y `rol_permisos`).
3. Controlador en `api/src/Modulos/<Modulo>/`; copiar el patrón de `SucursalControlador` (transacción + bitácora).
4. Prueba en `pruebas/`, fila en esta tabla y entrada en `CHANGELOG.md`.

## Endpoints · 2.1 Horarios, 2.4 Personas, 2.5 Inscripción

| Método | Ruta | Permiso | Qué hace |
|---|---|---|---|
| PUT | /disciplinas/{id} | disciplinas.gestionar | `{nombre?, activa?}` renombrar o dar de baja lógica |
| POST | /disciplinas/{id}/grados | grados.gestionar | `{nombre, color_cinta?}` agrega un grado al final del orden |
| GET | /horarios | horarios.ver | `?sucursal_id=&disciplina_id=&dia=` clases con instructor, rango de grados e inscritos |
| GET | /horarios/{id} | horarios.ver | La clase con la lista de alumnos inscritos y su grado |
| POST | /horarios | horarios.gestionar | `{sucursal_id, disciplina_id, instructor_id, dia_semana 1-7, hora_inicio, hora_fin, nivel?, grado_desde_id?, grado_hasta_id?, cupo?}`; 409 si el instructor ya tiene clase a esa hora |
| PUT | /horarios/{id}/desactivar | horarios.gestionar | `{forzar?}` 409 si tiene inscritos y no se manda forzar |
| GET | /instructores | horarios.ver | `?sucursal_id=` instructores con rol en esa sucursal |
| GET | /alumnos | alumnos.ver | `?buscar=&estado=` por nombre, matrícula, CURP o teléfono (máx. 100) |
| GET | /alumnos/{id} | alumnos.ver | Ficha: contactos, responsables, inscripciones y grados |
| GET | /alumnos/{id}/foto | alumnos.ver | La foto (imagen, no JSON) |
| POST | /alumnos | alumnos.crear | `{nombre, apellido_paterno, apellido_materno?, fecha_nacimiento, sexo?, curp, foto (data URL), telefono?, email?, sucursal_id?, responsable: {id, parentesco} \| {el_mismo: true} \| {nombre, apellido_paterno, telefono, email?, parentesco}}` → matrícula |
| PUT | /alumnos/{id}/estado | alumnos.baja | `{estado: activo\|suspendido\|baja}`; la baja termina sus inscripciones |
| GET | /responsables | responsables.gestionar | `?buscar=` (mín. 2 letras) con cuántos alumnos paga |
| POST | /inscripciones | inscripciones.crear | `{alumno_id, horario_id, grado_id?, forzar?}`; 409 con `detalle.avisos` si la clase está llena o el grado no entra (se puede forzar y queda en bitácora) |
| PUT | /inscripciones/{id}/terminar | inscripciones.crear | El alumno deja la clase (fecha_fin = hoy) |

## Endpoints · Fase 4 Caja y fase 5 Exámenes

Los adeudos no se guardan: se calculan con inscripciones, grados y pagos. Cada adeudo trae una `clave` (`insc:{alumno}`, `mens:{alumno}:{AAAA-MM}`, `rec:{alumno}:{AAAA-MM}`, `exa:{solicitud}`) y la caja cobra por clave; el servidor vuelve a calcular el precio y la promoción.

| Método | Ruta | Permiso | Qué hace |
|---|---|---|---|
| GET | /caja/estado-cuenta/{responsable} | pagos.ver | Alumnos a cargo, adeudos (`estado`: vencida, pendiente, por_vencer), saldo a favor y últimos 10 pagos |
| POST | /caja/cotizar | pagos.cobrar | Mismo cuerpo que /caja/cobros; calcula sin guardar |
| POST | /caja/cobros | pagos.cobrar | `{responsable_id, metodo: efectivo\|transferencia, referencia?, codigo?, usar_saldo?, claves[], productos?[{concepto_id, cantidad, alumno_id?}]}` → `{id, folio, total, saldo_usado, a_pagar}`. 422 si una mensualidad vencida va sin su recargo; 409 si una clave ya no está pendiente |
| GET | /caja/pagos/{id} | pagos.ver | Recibo con líneas, descuento, saldo usado y quién cobró |
| PUT | /caja/pagos/{id}/cancelar | pagos.cancelar | `{motivo}` el pago queda reembolsado y lo cobrado vuelve a quedar pendiente |
| GET | /caja/corte | caja.corte | `?fecha=&sucursal_id=` pagos del día y totales por método |
| GET | /examenes | examenes.programar, validar o solicitar | `?estado=&sucursal_id=` fechas con fecha límite y conteo de solicitudes |
| POST | /examenes | examenes.programar | `{sucursal_id?, disciplina_id, fecha: "AAAA-MM-DD HH:MM", sede?}` |
| GET | /examenes/{id} | examenes.programar, validar o solicitar | La fecha con sus solicitudes (un alumno o responsable solo ve las suyas) |
| PUT | /examenes/{id}/estado | examenes.programar | `{estado: realizado\|cancelado}`; no se marca realizado con autorizados sin resultado |
| GET | /examenes/{id}/criterios | examenes.solicitar o validar | `?alumno_id=` grado actual y siguiente, meses y asistencia contra los parámetros, si está en plazo |
| POST | /examenes/{id}/solicitudes | examenes.solicitar | `{alumno_id}` → `por_autorizar` o `fuera_de_plazo`, con `avisos` si no cumple criterios |
| PUT | /solicitudes-examen/{id}/excepcion | examenes.excepcion | `{tipo: fuera_de_plazo\|presentar_sin_pago, decision: autorizada\|rechazada, motivo}` |
| PUT | /solicitudes-examen/{id}/validar | examenes.validar | `{decision: autorizada\|no_autorizada, observaciones}` (obligatorias al no autorizar) |
| PUT | /solicitudes-examen/{id}/resultado | examenes.resultados | `{resultado: aprobada\|reprobada}`; exige pago o excepción; al aprobar agrega el grado con origen examen |
| PUT | /solicitudes-examen/{id}/cancelar | examenes.programar o solicitar | `{motivo: no_pago\|no_se_presento\|a_peticion\|otro, detalle?}`; si ya pagó, genera saldo a favor |

## Endpoints · Fase 3 Asistencia

| Método | Ruta | Permiso | Qué hace |
|---|---|---|---|
| GET | /asistencias/clases | asistencia.registrar, validar, manual o ver | `?sucursal_id=&fecha=` clases de ese día con `estado` (en_curso, proxima, terminada), inscritos, registrados y `mia` (si es del instructor) |
| POST | /asistencias/qr | asistencia.registrar | `{codigo, horario_id}` → 201 `{resultado: bienvenido\|retardo, alumno, visita, minutos_tarde, avisos[]}`; 403 `detalle.motivo`: no_inscrito, visita_rechazada, adeudo, alumno_baja (queda en accesos_rechazados); 409 si ya registró esa clase hoy o la clase no es ahora; 404 si el código no existe |
| POST | /asistencias | asistencia.manual | `{alumno_id, horario_id, fecha?, forzar?}` registro a mano (hasta 7 días atrás); 409 con `se_puede_forzar` si una regla lo impide; forzado queda en bitácora |
| GET | /asistencias/clase/{horario} | asistencia.validar, manual o ver | `?fecha=` inscritos con su registro, retardo y visita; rechazos; resumen |
| PUT | /asistencias/clase/{horario}/validar | asistencia.validar | `{fecha?}` marca validados los registros del día |
| DELETE | /asistencias/{id} | asistencia.validar | Quita un registro equivocado (bitácora) |
| GET | /alumnos/{id}/asistencia | asistencia.ver, validar o alumnos.ver | `?desde=&hasta=` (90 días por omisión) registros con retardo y visita, rechazos y resumen (retardos, faltas por retardo, visitas del mes) |
| PUT | /alumnos/{id}/qr | alumnos.editar | Nueva credencial: el QR anterior deja de servir |

El retardo no se guarda: se calcula con el parámetro `minutos_retardo` vigente (por sucursal y disciplina). `retardos_por_falta` dice cuántos retardos son una falta y `visitas_por_mes` cuántas clases puede tomar en otra sucursal.

## Endpoints · 2.6 Carga masiva e Inicio

| Método | Ruta | Permiso | Qué hace |
|---|---|---|---|
| POST | /alumnos/importar | alumnos.importar | `{archivo, csv, sucursal_id?, confirmar?}`. Sin `confirmar`: reporte `{filas, validas, con_error, errores[{fila, campo, mensaje}], muestra[]}` sin guardar. Con `confirmar`: importa solo los válidos → 201 `{importacion_id, creados}`. Máx. 2,000 renglones |
| GET | /importaciones | alumnos.importar | Últimas 50 cargas con estado (completada, con_errores, revertida) |
| PUT | /importaciones/{id}/revertir | alumnos.importar | Borra los alumnos y responsables que creó la carga; 409 si alguno ya tiene clases, pagos, asistencias o exámenes |
| GET | /inicio | (cualquier rol) | `?sucursal_id=` bloques según permisos: alumnos, caja, vencidos (lista de los 8 más atrasados), examenes, asistencia, clases |

Columnas del CSV (encabezado obligatorio, el orden no importa): **nombre, apellido_paterno, fecha_nacimiento, curp**, apellido_materno, sexo, telefono, email, fecha_alta, disciplina, grado, responsable_nombre, responsable_apellido, responsable_telefono, responsable_parentesco y, para un rol global, sucursal (clave o nombre). Fechas `AAAA-MM-DD` o `DD/MM/AAAA`.

## Endpoints · Fase 6 App del alumno y del responsable

El acceso a la app lo da recepción (no hay registro abierto). El alumno entra con su **matrícula**; el responsable con su **teléfono** (10 dígitos). `POST /auth/login` acepta en `email` el correo, la matrícula o el teléfono. Para alumnos y responsables la sesión dura `dias_sesion_app` días (30 por omisión) en lugar de `minutos_inactividad_sesion`.

| Método | Ruta | Permiso | Qué hace |
|---|---|---|---|
| GET | /alumnos/{id}/app | alumnos.ver | El alumno y sus responsables con `estado` (sin_acceso, codigo_enviado, activo), `usuario`, `codigo_vence`, `ultimo_acceso` |
| POST | /alumnos/{id}/app | alumnos.editar o responsables.gestionar | `{para: alumno\|responsable, responsable_id?}` → 201 `{usuario, codigo, expira, telefono, mensaje}`. Crea el usuario y el rol si hace falta; código de 6 dígitos que vence en 72 h; el anterior deja de servir. Para un alumno sin teléfono, `telefono` es el de su responsable. 422 si el responsable no tiene teléfono; 409 si el teléfono ya es de otro responsable |
| POST | /app/activar | (pública) | `{usuario, codigo, password}` → `{token}`. Contraseña de 8 o más; 5 intentos fallidos bloquean el código (423); cierra las demás sesiones |
| GET | /app/yo | (sesión) | Persona, `alumno_id` (si entrena), `es_responsable` y la lista de alumnos que puede ver |
| GET | /app/alumnos/{id}/inicio | (sesión) | Alumno con `codigo_qr`, grado, clases de hoy, próxima clase, rumbo al siguiente grado con el próximo examen, semana (asistio, retardo, falta, hoy, proxima, sin_clase), racha, estado de pago y avatar puesto |
| GET | /app/alumnos/{id}/camino | (sesión) | Por disciplina: grados con estado (obtenido, actual, siguiente, bloqueado), fecha e insignia; rumbo y examen |
| GET / PUT | /app/alumnos/{id}/avatar | (sesión) | Accesorios con `desbloqueado`, insignias con `obtenida`, equipo puesto y `apariencia`. PUT `{equipo?:[ids], apariencia?:{piel, peinado, color_pelo, vello, complexion}}`: equipo uno por tipo y solo desbloqueados (422); si no se manda `equipo` no se toca. Valores fuera de la lista → 422 |
| GET | /app/alumnos/{id}/examenes | (sesión) | Precio, fechas programadas con criterios, fecha límite y su solicitud; historial |
| POST | /app/alumnos/{id}/examenes/{examen} | (sesión) | Solicita el examen (canal portal) → 201 con `examen` e `instructor` |
| GET | /app/familia | (sesión, responsable) | Alumnos con estado de pago, adeudos (sin los por vencer), total, vencido, saldo a favor, últimos pagos y próximo cargo; 403 si no es responsable |
| GET | /app/pagos/{id} | (sesión, responsable) | Recibo de un pago propio; 404 si es de otra familia |

| GET | /app/cuenta | (sesión) | Mi cuenta: nombre, matrícula, `telefono`, `email`, `domicilio`, `es_responsable` y `entra_con` (con qué puede entrar) |
| PUT | /app/cuenta | (sesión) | `{telefono?, email?, domicilio?:{calle, numero?, colonia?, cp, municipio, estado} \| null, password?}`. Cambiar teléfono o correo pide `password` (422 si falta o está mal). El responsable no puede quedarse sin teléfono (es su usuario) y no puede usar el de otro responsable (409). El correo también sirve para entrar; si ya lo usa otra cuenta → 409. Todo queda en bitácora con la sucursal del alumno |

El modo claro u oscuro de la app se guarda con `PUT /preferencias {tema}` (el mismo de Mi perfil del panel).

`apariencia` viene en inicio, camino, avatar, exámenes y en cada alumno de familia: `{piel 1-6, peinado (rapado, corto, despeinado, rizado, coleta, chongo, largo), color_pelo, vello (ninguno, bigote, candado, barba), complexion (delgada, media, robusta), etapa (nino < 12, joven < 18, adulto), disciplina, personalizada}`. `personalizada` es `false` mientras el alumno no haya guardado su apariencia: la app le pide armar su avatar la primera vez que entra. Un niño nunca lleva vello facial; la disciplina decide el uniforme y los movimientos.

En `/app/alumnos/{id}/…` el alumno solo se ve a sí mismo y el responsable a los alumnos por los que paga (403 "Ese alumno no está en tu cuenta").

## Endpoints · Marca blanca y preferencias

Cada instalación guarda su marca en la tabla `marca` (una fila). Todo lo de la empresa vive en la base de datos, no en el código ni en el `.env`: el mismo sistema sirve a cualquier cliente y, para pasar a SaaS, la fila única se cambia por una por empresa.

| Método | Ruta | Permiso | Qué hace |
|---|---|---|---|
| GET | /marca | (pública) | `{nombre, lema, tema, color_primario, color_fondo, fuente, fuente_nombre, idioma, moneda, zona_horaria, pais, imagenes: {logo, logo_oscuro, icono}}`. Las imágenes son direcciones con `?v=` para que el navegador las vuelva a pedir cuando cambian |
| PUT | /marca | marca.editar | Cambia solo lo que se manda. `tema`: oceano, dojo, bosque, grafito, ciruela, atardecer o personalizado (requiere `color_primario`). `fuente`: dm-sans, inter, nunito, montserrat, poppins, source-sans, lora, sistema. `fuente_nombre` (letra solo del nombre comercial): igual, oswald, bebas, archivo, russo, playfair, marker. El `nombre` puede traer caracteres combinables (raya arriba U+0305, subrayado U+0332, tachado U+0336): el panel y la app los dibujan como una línea continua. `idioma`: es-MX, en-US. Queda en bitácora |
| GET | /marca/imagen/{tipo} | (pública) | `logo`, `logo_oscuro` o `icono`. Se sirve con `Content-Security-Policy` que no deja ejecutar nada (por los SVG) |
| PUT | /marca/imagen/{tipo} | marca.editar | `{imagen: dataURL}` PNG, JPG, WEBP o SVG hasta 512 KB. Un SVG con scripts, eventos o enlaces externos se rechaza (422) |
| DELETE | /marca/imagen/{tipo} | marca.editar | Vuelve al logo de Dojo OS |
| GET | /marca/manifest/{app} | (pública) | Manifest de la PWA (`app` o `panel`) con el nombre, ícono y color de la empresa |
| GET / PUT | /preferencias | (sesión) | `{idioma (null = el de la empresa), tema: sistema\|claro\|oscuro, letra: normal\|grande\|muy_grande}`. También vienen en `GET /auth/yo` como `preferencias` |

El router acepta parámetros de texto con `{nombre:texto}` (letras minúsculas y guion bajo); `{id}` sigue siendo solo número.

## Endpoints · Personal y accesos

Quién entra al panel, con qué rol y en qué sucursal. Solo se dan roles de **nivel menor** al propio: el súper admin da admin de sucursal, recepción, instructor y tableta; el admin de sucursal da recepción, instructor y tableta, y solo en su sucursal. Nadie cambia a alguien de su mismo nivel o mayor, ni sus propios accesos. Al dar de alta se genera una contraseña temporal (10 caracteres) que se muestra una sola vez, con el mensaje listo para WhatsApp.

| Método | Ruta | Permiso | Qué hace |
|---|---|---|---|
| GET | /personal | roles.asignar | `?sucursal_id=&q=&inactivos=1`. Cada persona con `roles` (activos e inactivos, `se_puede_quitar`), `nivel`, `editable`, `debe_cambiar_password`, `ultima_vez`. El admin de sucursal solo ve a quien tiene rol en la suya |
| GET | /personal/opciones | roles.asignar | Roles que puede dar quien pregunta y en qué sucursales |
| GET | /personal/{id} | roles.asignar | Ficha |
| POST | /personal | roles.asignar | `{nombre, apellido_paterno, apellido_materno?, fecha_nacimiento (16 a 100 años), sexo?, email, telefono?, roles:[{rol, sucursal_id}]}` → `{usuario_id, email, password_temporal, telefono, mensaje, ficha}`. Correo ya usado → 409. Rol de instructor → queda también en `instructores` (para horarios) |
| PUT | /personal/{id} | roles.asignar | `{nombre?, apellido_paterno?, apellido_materno?, email?, telefono?, activo?}`. Desactivar cierra sus sesiones; no puedes desactivarte |
| POST | /personal/{id}/roles | roles.asignar | `{rol, sucursal_id}`; si lo tuvo antes se reactiva; repetido → 409 |
| DELETE | /personal/{id}/roles/{rid} | roles.asignar | Desactiva el rol (queda en el historial) y cierra las sesiones con ese rol |
| POST | /personal/{id}/contrasena | roles.asignar | Contraseña temporal nueva ("olvidé mi contraseña"); cierra sus sesiones y desbloquea la cuenta |

## Endpoints · Tabletas de asistencia

La tableta de la entrada se conecta con un código (como una tele con una app de video): abre `/tableta/vincular`, muestra 6 dígitos, el admin los escribe en Configuración → Tabletas y la tableta recibe su sesión. Por dentro usa una cuenta interna con rol `tableta` en la sucursal (sin contraseña con la que alguien pueda entrar). Su sesión **no se cierra por inactividad**; se corta con "Desconectar".

| Método | Ruta | Permiso | Qué hace |
|---|---|---|---|
| POST | /dispositivos/solicitar | pública | → `{codigo (6 dígitos), clave (secreta), expira_en: 600}`. Máximo 10 códigos vivos por IP (429) |
| POST | /dispositivos/estado | pública | `{clave}` → `{estado: esperando \| vinculado \| expirado}`; con `vinculado` trae `token` y `dispositivo {nombre, sucursal}` **una sola vez** |
| GET | /dispositivos | roles.asignar | `{tabletas: [{id, nombre, sucursal, activo, conectada, en_linea (habló en los últimos 10 min), ultima_vez, creado_por}], cuentas_con_correo}` (las tabletas de antes, con correo y contraseña). El admin de sucursal solo ve las suyas |
| POST | /dispositivos | roles.asignar | `{codigo, nombre, sucursal_id}`. Código inexistente, usado o vencido → 404 |
| PUT | /dispositivos/{id} | roles.asignar | `{nombre?, activo: 0}`. Desconectar cierra su sesión al momento; se vuelve a conectar con código nuevo (activo: 1 → 422) |

`POST /asistencias/qr` ya no exige `horario_id`: sin él, la clase se busca sola entre las de hoy en la sucursal de la tableta (desde 1 h antes hasta que terminan): la más cercana a esta hora en la que está inscrito y que no ha registrado; si no está inscrito en ninguna, una de su misma disciplina (visita); si tampoco, la más cercana (y se rechaza como no inscrito). Sin clases a esa hora → 409 con `resultado: sin_clase`. La respuesta trae `clase {id, disciplina, hora_inicio}`. Un rol global manda `sucursal_id`.

`GET /marca/manifest/tableta`: manifiesto para "Agregar a pantalla de inicio" en la tableta (abre `/tableta` a pantalla completa).

