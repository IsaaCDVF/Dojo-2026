-- Dojo OS · 014 · Pago en línea desde la app (Mercado Pago: tarjeta, OXXO y SPEI)
-- El pago usa las mismas tablas de la caja (pagos con metodo = pasarela). Aquí va lo propio de la pasarela:
-- su configuración (las llaves se guardan cifradas) y el seguimiento de cada intento.
USE dojo;

CREATE TABLE pasarela_config (
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
INSERT INTO pasarela_config (id) VALUES (1);

CREATE TABLE pagos_en_linea (
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
