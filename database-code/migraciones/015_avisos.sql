-- Dojo OS · 015 · Avisos automáticos (notificación en la app + WhatsApp en 1 toque desde recepción)
-- Las tablas plantillas_notificacion y notificaciones ya existían (007); aquí se completan:
--   · cada aviso tiene una "clave" única para no mandarlo dos veces
--   · la sucursal (recepción ve solo los suyos), si ya lo leyó en la app y quién lo mandó por WhatsApp
--   · las suscripciones del celular para recibir notificaciones (Web Push)
USE dojo;

ALTER TABLE plantillas_notificacion
  ADD COLUMN activa BOOLEAN NOT NULL DEFAULT TRUE COMMENT 'Se puede apagar un aviso sin borrar su texto',
  ADD COLUMN titulo VARCHAR(80) NULL COMMENT 'Título de la notificación en el celular (canal app)',
  ADD UNIQUE KEY uq_plantilla_evento_canal (evento, canal);

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

CREATE TABLE push_suscripciones (
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

CREATE TABLE sistema_estado (
  clave        VARCHAR(60) PRIMARY KEY,
  valor        TEXT NULL,
  actualizado  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB COMMENT='Datos internos del sistema: última revisión de avisos, llaves de notificaciones (cifradas)';
