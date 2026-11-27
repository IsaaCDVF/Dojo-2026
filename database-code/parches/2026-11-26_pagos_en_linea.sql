-- Parche para una base que YA existe: pago en línea (migración 014), su permiso y respuestas de la pasarela.
-- Se puede correr más de una vez.
-- Uso: docker compose exec -T db sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" dojo' < database-code/parches/2026-11-26_pagos_en_linea.sql
USE dojo;
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS pasarela_config (
  id                      TINYINT PRIMARY KEY DEFAULT 1,
  proveedor               ENUM('mercadopago') NOT NULL DEFAULT 'mercadopago',
  modo                    ENUM('apagado','prueba','real') NOT NULL DEFAULT 'apagado'
                          COMMENT 'prueba = se simula el pago dentro del sistema (no se cobra nada)',
  public_key              VARCHAR(120) NULL,
  access_token_cifrado    TEXT NULL COMMENT 'Cifrado con la llave de web-code/api/almacen/llaves (nunca se devuelve)',
  webhook_secret_cifrado  TEXT NULL,
  url_publica             VARCHAR(200) NULL COMMENT 'https://... del sistema; sin ella no hay regreso automático ni avisos de Mercado Pago',
  actualizado             DATETIME NULL,
  actualizado_por         INT NULL,
  CHECK (id = 1),
  FOREIGN KEY (actualizado_por) REFERENCES usuarios(id)
) ENGINE=InnoDB COMMENT='Una sola fila: la cuenta de Mercado Pago de la empresa';
INSERT IGNORE INTO pasarela_config (id) VALUES (1);

CREATE TABLE IF NOT EXISTS pagos_en_linea (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  pago_id           INT NOT NULL UNIQUE,
  referencia        CHAR(32) NOT NULL UNIQUE COMMENT 'external_reference que viaja a Mercado Pago',
  origen            ENUM('prueba','mercadopago') NOT NULL,
  preferencia_id    VARCHAR(80) NULL,
  url_pago          VARCHAR(600) NULL,
  mp_pago_id        VARCHAR(40) NULL COMMENT 'Id del pago en Mercado Pago',
  medio             VARCHAR(30) NULL COMMENT 'credit_card, debit_card, ticket (OXXO), bank_transfer (SPEI)...',
  estado_pasarela   VARCHAR(30) NULL COMMENT 'approved, pending, in_process, rejected, cancelled, refunded...',
  detalle_pasarela  VARCHAR(80) NULL COMMENT 'status_detail de Mercado Pago',
  ficha_url         VARCHAR(600) NULL COMMENT 'Ficha para pagar en OXXO o datos de SPEI',
  solicitudes       JSON NULL COMMENT '{pago_detalle_id: solicitud_examen_id} para ligarlas al aprobarse',
  creado            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado       DATETIME NULL,
  expira            DATETIME NULL COMMENT 'Hasta cuándo se puede pagar la ficha (OXXO/SPEI)',
  FOREIGN KEY (pago_id) REFERENCES pagos(id)
) ENGINE=InnoDB COMMENT='Seguimiento de cada pago hecho desde la app';

INSERT INTO permisos (clave, modulo, descripcion, nivel_minimo) VALUES
  ('pasarela.configurar','sistema','Conectar la cuenta de Mercado Pago y encender el pago en línea',5)
ON DUPLICATE KEY UPDATE descripcion = VALUES(descripcion);
INSERT IGNORE INTO rol_permisos (rol_id, permiso_id)
  SELECT r.id, p.id FROM roles r JOIN permisos p ON p.clave = 'pasarela.configurar' WHERE r.nombre = 'super_admin';

INSERT INTO codigos_respuesta_pasarela (codigo, descripcion, mensaje_usuario, permite_reintento) VALUES
  ('pendiente','Esperando el pago (OXXO o SPEI)','Tu ficha está lista. Cuando pagues, se registra solo (puede tardar unas horas).',0),
  ('cancelado','Pago cancelado o vencido','El pago se canceló o la ficha venció. Puedes generar uno nuevo.',1),
  ('datos_tarjeta','Datos de la tarjeta incorrectos','Revisa el número, la fecha o el código de seguridad de tu tarjeta e intenta otra vez.',1)
ON DUPLICATE KEY UPDATE descripcion = VALUES(descripcion), mensaje_usuario = VALUES(mensaje_usuario), permite_reintento = VALUES(permite_reintento);
