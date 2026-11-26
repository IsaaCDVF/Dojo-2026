-- Dojo OS · semillas de catálogos (obligatorias) · v0.6
USE dojo;
SET NAMES utf8mb4;

INSERT INTO roles (nombre, descripcion, nivel, alcance) VALUES
  ('super_admin','Dirección general: configura todo y ve todas las sucursales',5,'global'),
  ('admin_sucursal','Encargado del dojo: su sucursal',4,'sucursal'),
  ('recepcion','Mostrador: inscribe, cobra y registra solicitudes',3,'sucursal'),
  ('instructor','Valida asistencia y exámenes, captura resultados',3,'sucursal'),
  ('responsable','Paga por uno o varios alumnos',2,'propio'),
  ('alumno','Consulta su información y su avatar',1,'propio'),
  ('tableta','Dispositivo de asistencia de una sucursal',1,'sucursal');

INSERT INTO permisos (clave, modulo, descripcion, nivel_minimo) VALUES
  ('sucursales.gestionar','sistema','Dar de alta, editar y desactivar sucursales',5),
  ('roles.asignar','sistema','Asignar roles de nivel menor al propio',4),
  ('parametros.ver','sistema','Consultar parámetros',3),
  ('parametros.editar','sistema','Cambiar valores de parámetros',5),
  ('bitacora.ver','sistema','Consultar la bitácora de auditoría',4),
  ('reportes.ver','sistema','Ver reportes y tableros',4),
  ('disciplinas.gestionar','catalogos','Disciplinas y su asignación a sucursales',5),
  ('grados.gestionar','catalogos','Grados y cintas por disciplina',5),
  ('horarios.gestionar','catalogos','Horarios, niveles e instructores',4),
  ('horarios.ver','catalogos','Consultar horarios',1),
  ('precios.gestionar','catalogos','Precios con vigencia',5),
  ('promociones.gestionar','catalogos','Paquetes, promociones y convenios',4),
  ('alumnos.ver','personas','Buscar y consultar alumnos',3),
  ('alumnos.crear','personas','Registrar alumnos',3),
  ('alumnos.editar','personas','Editar datos de alumnos',3),
  ('alumnos.baja','personas','Dar de baja alumnos',4),
  ('alumnos.importar','personas','Carga masiva de alumnos',4),
  ('responsables.gestionar','personas','Registrar y editar responsables de pago',3),
  ('perfil.ver','personas','Ver sus propios datos',1),
  ('inscripciones.crear','inscripciones','Inscribir a un horario con su cuenta inicial',3),
  ('asistencia.registrar','asistencia','Registrar asistencia con QR',1),
  ('asistencia.manual','asistencia','Registrar asistencia sin QR',3),
  ('asistencia.validar','asistencia','Validar la lista de la clase',3),
  ('asistencia.ver','asistencia','Consultar asistencia',1),
  ('pagos.cobrar','pagos','Cobrar en mostrador',3),
  ('pagos.ver','pagos','Consultar pagos y estado de cuenta',2),
  ('pagos.en_linea','pagos','Pagar o reintentar en línea',2),
  ('pagos.cancelar','pagos','Cancelar o reembolsar un pago',4),
  ('caja.corte','pagos','Corte de caja',3),
  ('examenes.programar','examenes','Programar fechas de examen de la sucursal',4),
  ('examenes.solicitar','examenes','Solicitar examen',1),
  ('examenes.validar','examenes','Autorizar o rechazar solicitudes',3),
  ('examenes.excepcion','examenes','Autorizar excepciones de plazo o pago',4),
  ('examenes.resultados','examenes','Capturar resultados',3),
  ('facturas.emitir','facturacion','Emitir facturas',3),
  ('facturas.ver','facturacion','Consultar y descargar facturas',2),
  ('avatar.editar','portal','Vestir su avatar',1),
  ('marca.editar','sistema','Cambiar logo, colores, letra e idioma del sistema',5),
  ('pasarela.configurar','sistema','Conectar la cuenta de Mercado Pago y encender el pago en línea',5);

INSERT INTO rol_permisos (rol_id, permiso_id)
  SELECT r.id, p.id FROM roles r JOIN permisos p ON p.clave IN ('sucursales.gestionar','roles.asignar','parametros.ver','parametros.editar','bitacora.ver','reportes.ver','disciplinas.gestionar','grados.gestionar','horarios.gestionar','horarios.ver','precios.gestionar','promociones.gestionar','alumnos.ver','alumnos.crear','alumnos.editar','alumnos.baja','alumnos.importar','responsables.gestionar','perfil.ver','inscripciones.crear','asistencia.registrar','asistencia.manual','asistencia.validar','asistencia.ver','pagos.cobrar','pagos.ver','pagos.en_linea','pagos.cancelar','caja.corte','examenes.programar','examenes.solicitar','examenes.validar','examenes.excepcion','examenes.resultados','facturas.emitir','facturas.ver','avatar.editar','marca.editar','pasarela.configurar') WHERE r.nombre='super_admin';
INSERT INTO rol_permisos (rol_id, permiso_id)
  SELECT r.id, p.id FROM roles r JOIN permisos p ON p.clave IN ('roles.asignar','parametros.ver','bitacora.ver','reportes.ver','horarios.gestionar','horarios.ver','promociones.gestionar','alumnos.ver','alumnos.crear','alumnos.editar','alumnos.baja','alumnos.importar','responsables.gestionar','perfil.ver','inscripciones.crear','asistencia.manual','asistencia.validar','asistencia.ver','pagos.cobrar','pagos.ver','pagos.cancelar','caja.corte','examenes.programar','examenes.validar','examenes.excepcion','examenes.resultados','facturas.emitir','facturas.ver') WHERE r.nombre='admin_sucursal';
INSERT INTO rol_permisos (rol_id, permiso_id)
  SELECT r.id, p.id FROM roles r JOIN permisos p ON p.clave IN ('parametros.ver','horarios.ver','alumnos.ver','alumnos.crear','alumnos.editar','responsables.gestionar','perfil.ver','inscripciones.crear','asistencia.manual','asistencia.ver','pagos.cobrar','pagos.ver','caja.corte','examenes.solicitar','facturas.emitir','facturas.ver') WHERE r.nombre='recepcion';
INSERT INTO rol_permisos (rol_id, permiso_id)
  SELECT r.id, p.id FROM roles r JOIN permisos p ON p.clave IN ('horarios.ver','alumnos.ver','perfil.ver','asistencia.validar','asistencia.manual','asistencia.ver','examenes.validar','examenes.resultados') WHERE r.nombre='instructor';
INSERT INTO rol_permisos (rol_id, permiso_id)
  SELECT r.id, p.id FROM roles r JOIN permisos p ON p.clave IN ('horarios.ver','perfil.ver','asistencia.ver','pagos.ver','pagos.en_linea','examenes.solicitar','facturas.ver') WHERE r.nombre='responsable';
INSERT INTO rol_permisos (rol_id, permiso_id)
  SELECT r.id, p.id FROM roles r JOIN permisos p ON p.clave IN ('horarios.ver','perfil.ver','asistencia.ver','examenes.solicitar','avatar.editar') WHERE r.nombre='alumno';
INSERT INTO rol_permisos (rol_id, permiso_id)
  SELECT r.id, p.id FROM roles r JOIN permisos p ON p.clave IN ('asistencia.registrar','horarios.ver') WHERE r.nombre='tableta';

INSERT INTO parametros (clave, descripcion, tipo_dato, unidad) VALUES
  ('minutos_retardo','Minutos después del inicio de la clase que cuentan como retardo','minutos','min'),
  ('retardos_por_falta','Retardos que equivalen a una falta','entero',NULL),
  ('asistencia_minima_examen','Porcentaje de asistencia para cumplir criterios de examen','porcentaje','%'),
  ('meses_minimos_grado','Meses en el grado para cumplir criterios de examen','entero','meses'),
  ('dias_anticipacion_examen','Días antes del examen en que cierra la solicitud','dias','días'),
  ('visitas_por_mes','Clases al mes que un alumno puede tomar en otra sucursal','entero',NULL),
  ('dias_aviso_pago','Días antes del vencimiento en que se envían avisos (lista)','texto','días'),
  ('dias_tolerancia_pago','Días después del vencimiento para pagar sin recargo','dias','días'),
  ('minutos_inactividad_sesion','Minutos sin actividad para cerrar la sesión (por definir con el cliente)','minutos','min'),
  ('intentos_login','Intentos fallidos antes de bloquear la cuenta 15 minutos','entero',NULL);

-- Usuario inicial: cambiar la contraseña al primer inicio de sesión
INSERT INTO personas (nombre, apellido_paterno, fecha_nacimiento) VALUES ('Administrador','General','2000-01-01');
INSERT INTO usuarios (persona_id, email, password_hash) VALUES (LAST_INSERT_ID(), 'admin@dojoos.mx', '$2y$10$IKLlkoO0VtYbYtsUYPd.KOGsCOygwlWhgdY91MH12K83XGa5gfMKq');
INSERT INTO usuario_roles (usuario_id, rol_id, sucursal_id) SELECT u.id, r.id, NULL FROM usuarios u, roles r WHERE u.email='admin@dojoos.mx' AND r.nombre='super_admin';

-- Valores globales iniciales (se confirman con el cliente)
INSERT INTO parametro_valores (parametro_id, valor, vigente_desde, modificado_por)
  SELECT p.id, v.valor, '2026-01-01 00:00:00', (SELECT id FROM usuarios WHERE email='admin@dojoos.mx') FROM parametros p JOIN (
    SELECT 'minutos_retardo' clave, '30' valor
    UNION ALL SELECT 'retardos_por_falta' clave, '3' valor
    UNION ALL SELECT 'asistencia_minima_examen' clave, '80' valor
    UNION ALL SELECT 'meses_minimos_grado' clave, '3' valor
    UNION ALL SELECT 'dias_anticipacion_examen' clave, '5' valor
    UNION ALL SELECT 'visitas_por_mes' clave, '3' valor
    UNION ALL SELECT 'dias_aviso_pago' clave, '3,1' valor
    UNION ALL SELECT 'dias_tolerancia_pago' clave, '5' valor
    UNION ALL SELECT 'minutos_inactividad_sesion' clave, '30' valor
    UNION ALL SELECT 'intentos_login' clave, '5' valor
  ) v ON v.clave=p.clave;

INSERT INTO conceptos (nombre, tipo) VALUES
  ('Mensualidad','mensualidad'),('Inscripción','inscripcion'),('Examen de grado','examen'),
  ('Pase de un día','pase_dia'),('Recargo por pago tardío','recargo');

INSERT INTO codigos_respuesta_pasarela (codigo, descripcion, mensaje_usuario, permite_reintento) VALUES
  ('aprobado','Pago aprobado','Tu pago se registró correctamente.',0),
  ('fondos_insuficientes','Fondos insuficientes','Tu banco rechazó el pago por fondos insuficientes. Puedes intentar con otra tarjeta o pagar en la sucursal.',1),
  ('tarjeta_vencida','Tarjeta vencida','Tu tarjeta está vencida. Actualiza tus datos de pago.',1),
  ('rechazo_banco','Rechazo genérico del banco','Hubo un inconveniente con tu tarjeta; el banco no pudo procesar tu pago. Comunícate con tu banco o intenta más tarde.',1),
  ('sospecha_fraude','Bloqueo por seguridad','Tu banco bloqueó el cargo por seguridad. Comunícate con tu banco para autorizarlo.',1),
  ('pendiente','Esperando el pago (OXXO o SPEI)','Tu ficha está lista. Cuando pagues, se registra solo (puede tardar unas horas).',0),
  ('cancelado','Pago cancelado o vencido','El pago se canceló o la ficha venció. Puedes generar uno nuevo.',1),
  ('datos_tarjeta','Datos de la tarjeta incorrectos','Revisa el número, la fecha o el código de seguridad de tu tarjeta e intenta otra vez.',1);
