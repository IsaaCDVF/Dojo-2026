-- Parche para una base que YA existe: avisos automáticos (migración 015 + semillas 004).
-- Se puede correr más de una vez.
-- Uso: docker compose exec -T db sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" dojo' < database-code/parches/2026-11-27_avisos.sql
USE dojo;
SET NAMES utf8mb4;

-- Columnas nuevas (solo si faltan)
DROP PROCEDURE IF EXISTS parche_avisos;
DELIMITER //
CREATE PROCEDURE parche_avisos()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = 'dojo' AND TABLE_NAME = 'plantillas_notificacion' AND COLUMN_NAME = 'activa') THEN
    ALTER TABLE plantillas_notificacion
      ADD COLUMN activa BOOLEAN NOT NULL DEFAULT TRUE COMMENT 'Se puede apagar un aviso sin borrar su texto',
      ADD COLUMN titulo VARCHAR(80) NULL COMMENT 'Título de la notificación en el celular (canal app)',
      ADD UNIQUE KEY uq_plantilla_evento_canal (evento, canal);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = 'dojo' AND TABLE_NAME = 'notificaciones' AND COLUMN_NAME = 'clave') THEN
    ALTER TABLE notificaciones
      ADD COLUMN clave VARCHAR(120) NULL COMMENT 'evento + a quién + de qué: evita repetir el mismo aviso' AFTER id,
      ADD COLUMN sucursal_id INT NULL AFTER persona_id,
      ADD COLUMN titulo VARCHAR(80) NULL AFTER plantilla_id,
      ADD COLUMN telefono CHAR(10) NULL COMMENT 'WhatsApp al que se manda (copia al generarlo)' AFTER titulo,
      ADD COLUMN leida DATETIME NULL COMMENT 'Canal app: cuándo la abrió',
      ADD COLUMN enviada_por INT NULL COMMENT 'Canal whatsapp: quién de recepción la mandó',
      MODIFY estado ENUM('programada','enviada','fallida','omitida') NOT NULL DEFAULT 'programada',
      ADD UNIQUE KEY uq_notificacion_clave (clave),
      ADD INDEX idx_notificacion_bandeja (persona_id, estado),
      ADD FOREIGN KEY (sucursal_id) REFERENCES sucursales(id),
      ADD FOREIGN KEY (enviada_por) REFERENCES usuarios(id);
  END IF;
END //
DELIMITER ;
CALL parche_avisos();
DROP PROCEDURE parche_avisos;

CREATE TABLE IF NOT EXISTS push_suscripciones (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id     INT NOT NULL,
  endpoint       VARCHAR(700) NOT NULL COMMENT 'Dirección del servicio de notificaciones del navegador',
  endpoint_hash  CHAR(64) NOT NULL UNIQUE,
  p256dh         VARCHAR(120) NOT NULL,
  auth           VARCHAR(40) NOT NULL,
  dispositivo    VARCHAR(120) NULL COMMENT 'Navegador / celular (para reconocerla)',
  creada         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ultima_ok      DATETIME NULL,
  fallos         TINYINT NOT NULL DEFAULT 0,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
) ENGINE=InnoDB COMMENT='Celulares que aceptaron recibir notificaciones';

CREATE TABLE IF NOT EXISTS sistema_estado (
  clave        VARCHAR(60) PRIMARY KEY,
  valor        TEXT NULL,
  actualizado  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB COMMENT='Datos internos del sistema: última revisión de avisos, llaves de notificaciones (cifradas)';

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
