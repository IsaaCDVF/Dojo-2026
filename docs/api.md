# API de Dojo OS · v0.1.0

Base: `http://localhost:8080/api` (desarrollo). Todo es JSON en UTF-8.

**Respuesta correcta:** `{ "ok": true, "datos": ... }`  
**Error:** `{ "ok": false, "error": "mensaje para el usuario", "detalle": { ... } }`

**Sesión:** `POST /auth/login` devuelve un `token`; se manda en cada petición como `Authorization: Bearer <token>`.
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
| POST | /auth/login | pública | `{email, password}` → `{token, roles, debe_elegir_rol}` |
| POST | /auth/rol | sesión | `{usuario_rol_id}` elige con qué rol y sucursal trabajar |
| GET | /auth/yo | sesión | Usuario, rol activo, todos sus roles y permisos (para el menú) |
| POST | /auth/logout | sesión | Cierra la sesión |
| GET | /sucursales | horarios.ver | Lista; un rol de sucursal solo ve la suya |
| POST | /sucursales | sucursales.gestionar | `{clave (4 letras), nombre}` |
| PUT | /sucursales/{id} | sucursales.gestionar | `{nombre?, activa?}` — registra en bitácora cada campo |
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
