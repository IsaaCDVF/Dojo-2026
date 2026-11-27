-- Dojo OS · semillas · avisos automáticos (se puede correr más de una vez: no repite nada)
-- Variables en los textos: {nombre} a quién se le escribe · {alumno} · {concepto} · {periodo} · {monto} · {fecha}
--                           {dias} · {grado} · {dojo} nombre de la empresa · {sucursal}
USE dojo;
SET NAMES utf8mb4;

INSERT INTO parametros (clave, descripcion, tipo_dato, unidad)
  SELECT 'dias_sin_asistir', 'Días sin venir a clase para avisar al responsable (0 = no avisar)', 'dias', 'días' FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM parametros WHERE clave = 'dias_sin_asistir');
INSERT INTO parametro_valores (parametro_id, valor, vigente_desde, modificado_por)
  SELECT p.id, '14', '2026-01-01 00:00:00', (SELECT id FROM usuarios WHERE email = 'admin@dojoos.mx') FROM parametros p
  WHERE p.clave = 'dias_sin_asistir' AND NOT EXISTS (SELECT 1 FROM parametro_valores v WHERE v.parametro_id = p.id);

INSERT INTO permisos (clave, modulo, descripcion, nivel_minimo)
  SELECT 'avisos.enviar', 'personas', 'Ver y mandar por WhatsApp los avisos del día', 3 FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM permisos WHERE clave = 'avisos.enviar');
INSERT INTO permisos (clave, modulo, descripcion, nivel_minimo)
  SELECT 'avisos.configurar', 'sistema', 'Cambiar el texto de los avisos y encenderlos o apagarlos', 4 FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM permisos WHERE clave = 'avisos.configurar');
INSERT IGNORE INTO rol_permisos (rol_id, permiso_id)
  SELECT r.id, p.id FROM roles r JOIN permisos p ON p.clave = 'avisos.enviar' WHERE r.nombre IN ('super_admin', 'admin_sucursal', 'recepcion');
INSERT IGNORE INTO rol_permisos (rol_id, permiso_id)
  SELECT r.id, p.id FROM roles r JOIN permisos p ON p.clave = 'avisos.configurar' WHERE r.nombre IN ('super_admin', 'admin_sucursal');

INSERT INTO plantillas_notificacion (evento, canal, titulo, cuerpo)
SELECT x.evento, x.canal, x.titulo, x.cuerpo FROM (
  SELECT 'pago_por_vencer' evento, 'app' canal, 'Tu mensualidad vence pronto' titulo,
         'La mensualidad de {alumno} ({periodo}) por {monto} vence el {fecha}. Puedes pagarla desde aquí.' cuerpo
  UNION ALL SELECT 'pago_por_vencer', 'whatsapp', NULL,
         'Hola {nombre} 👋 Te recordamos que la mensualidad de {alumno} ({periodo}) por {monto} vence el {fecha}. Puedes pagar en recepción o desde la app. — {dojo}'
  UNION ALL SELECT 'pago_vencido', 'app', 'Tienes un pago vencido',
         'La mensualidad de {alumno} ({periodo}) venció el {fecha}. Lo vencido suma {monto}. Mientras esté vencida, la tableta no deja pasar a clase.'
  UNION ALL SELECT 'pago_vencido', 'whatsapp', NULL,
         'Hola {nombre}. La mensualidad de {alumno} ({periodo}) venció el {fecha}; lo vencido suma {monto}. Mientras esté vencida no podrá pasar a clase. Puedes pagar en recepción o desde la app. — {dojo}'
  UNION ALL SELECT 'ausencia', 'app', 'Te extrañamos 🥋',
         '{alumno} lleva {dias} días sin venir a clase. ¡Aquí te esperamos!'
  UNION ALL SELECT 'ausencia', 'whatsapp', NULL,
         'Hola {nombre}, te extrañamos 🥋 {alumno} lleva {dias} días sin venir a clase. ¿Todo bien? Aquí lo esperamos en {sucursal}. — {dojo}'
  UNION ALL SELECT 'examen_autorizado', 'app', '¡Examen autorizado!',
         'El instructor autorizó a {alumno} para su examen a {grado} el {fecha}. Costo: {monto}.'
  UNION ALL SELECT 'examen_autorizado', 'whatsapp', NULL,
         '¡Felicidades! 🎉 El instructor autorizó a {alumno} para su examen a {grado} el {fecha}. Costo: {monto}; puedes pagarlo en recepción o desde la app. — {dojo}'
) x WHERE NOT EXISTS (SELECT 1 FROM plantillas_notificacion p WHERE p.evento = x.evento AND p.canal = x.canal);
