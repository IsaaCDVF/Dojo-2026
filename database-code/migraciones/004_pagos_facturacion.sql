-- Dojo OS · modelo de datos v0.6 · 004_pagos_facturacion
USE dojo;

CREATE TABLE conceptos (
  id      INT AUTO_INCREMENT PRIMARY KEY,
  nombre  VARCHAR(80) NOT NULL,
  tipo    ENUM('mensualidad','inscripcion','examen','pase_dia','producto','recargo') NOT NULL
) ENGINE=InnoDB COMMENT='El recargo por pago tardío es un concepto con precio vigente (RF-77)';

CREATE TABLE precios (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  concepto_id    INT NOT NULL,
  sucursal_id    INT NULL COMMENT 'NULL = precio global',
  monto          DECIMAL(10,2) NOT NULL,
  vigente_desde  DATE NOT NULL,
  vigente_hasta  DATE NULL,
  FOREIGN KEY (concepto_id) REFERENCES conceptos(id),
  FOREIGN KEY (sucursal_id) REFERENCES sucursales(id)
) ENGINE=InnoDB;

CREATE TABLE promociones (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  nombre         VARCHAR(100) NOT NULL COMMENT 'Ej. Paquete noviembre, Convenio Prepa 5, Descuento familiar',
  tipo           ENUM('paquete','convenio','descuento') NOT NULL,
  codigo         VARCHAR(30) NULL UNIQUE COMMENT 'Código que presenta el cliente (paquetes)',
  institucion    VARCHAR(150) NULL COMMENT 'Solo convenios',
  sucursal_id    INT NULL COMMENT 'NULL = todas las sucursales',
  vigente_desde  DATE NOT NULL,
  vigente_hasta  DATE NULL,
  activa         BOOLEAN NOT NULL DEFAULT TRUE,
  FOREIGN KEY (sucursal_id) REFERENCES sucursales(id)
) ENGINE=InnoDB COMMENT='Paquetes, convenios y descuentos en una sola tabla';

CREATE TABLE promocion_conceptos (
  promocion_id  INT NOT NULL,
  concepto_id   INT NOT NULL,
  tipo          ENUM('porcentaje','monto') NOT NULL,
  valor         DECIMAL(10,2) NOT NULL COMMENT 'Ej. inscripción 100 %, uniforme 50 %',
  PRIMARY KEY (promocion_id, concepto_id),
  FOREIGN KEY (promocion_id) REFERENCES promociones(id),
  FOREIGN KEY (concepto_id)  REFERENCES conceptos(id)
) ENGINE=InnoDB COMMENT='Qué descuenta la promoción en cada concepto';

CREATE TABLE alumno_convenios (
  alumno_id      INT NOT NULL,
  promocion_id   INT NOT NULL COMMENT 'Promoción de tipo convenio',
  vigente_desde  DATE NOT NULL,
  vigente_hasta  DATE NULL,
  PRIMARY KEY (alumno_id, promocion_id),
  FOREIGN KEY (alumno_id)    REFERENCES alumnos(id),
  FOREIGN KEY (promocion_id) REFERENCES promociones(id)
) ENGINE=InnoDB COMMENT='Alumnos que tienen derecho a un convenio';

CREATE TABLE perfiles_fiscales (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  responsable_id  INT NOT NULL,
  rfc             VARCHAR(13) NOT NULL,
  razon_social    VARCHAR(150) NOT NULL,
  regimen_fiscal  VARCHAR(5) NOT NULL,
  cp_fiscal       CHAR(5) NOT NULL,
  uso_cfdi        VARCHAR(5) NOT NULL,
  FOREIGN KEY (responsable_id) REFERENCES responsables_pago(id)
) ENGINE=InnoDB;

CREATE TABLE codigos_respuesta_pasarela (
  codigo           VARCHAR(30) PRIMARY KEY COMMENT 'Código que devuelve la pasarela',
  descripcion      VARCHAR(150) NOT NULL,
  mensaje_usuario  VARCHAR(300) NOT NULL COMMENT 'Ej. Hubo un inconveniente con tu tarjeta; el banco no pudo procesar tu pago...',
  permite_reintento BOOLEAN NOT NULL DEFAULT TRUE
) ENGINE=InnoDB COMMENT='Catálogo: qué mensaje ve el usuario según la respuesta del banco (RF-37)';

CREATE TABLE pagos (
  id                   INT AUTO_INCREMENT PRIMARY KEY,
  responsable_id       INT NULL COMMENT 'NULL para pase de un día sin cuenta',
  sucursal_id          INT NOT NULL,
  folio                VARCHAR(20) NULL UNIQUE COMMENT 'Recibo: CENT-R26-000123; se asigna solo al aprobarse',
  fecha                DATETIME NOT NULL,
  metodo               ENUM('pasarela','efectivo','transferencia','saldo_favor') NOT NULL,
  referencia_pasarela  VARCHAR(100) NULL,
  codigo_respuesta     VARCHAR(30) NULL COMMENT 'Respuesta de la pasarela; NULL en efectivo',
  estado               ENUM('pendiente','aprobado','rechazado','reembolsado') NOT NULL,
  registrado_por       INT NULL,
  FOREIGN KEY (responsable_id)   REFERENCES responsables_pago(id),
  FOREIGN KEY (sucursal_id)      REFERENCES sucursales(id),
  FOREIGN KEY (codigo_respuesta) REFERENCES codigos_respuesta_pasarela(codigo),
  FOREIGN KEY (registrado_por)   REFERENCES usuarios(id)
) ENGINE=InnoDB COMMENT='Encabezado del ticket. Cada intento de cobro es un registro: un reintento no borra el rechazo anterior (RN-35)';

CREATE TABLE pago_detalles (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  pago_id             INT NOT NULL,
  alumno_id           INT NULL COMMENT 'NULL en pase de un día',
  concepto_id         INT NOT NULL,
  periodo             VARCHAR(7) NULL COMMENT 'AAAA-MM de la mensualidad o del recargo; fijo aunque se pague tarde (RN-34)',
  monto_cobrado       DECIMAL(10,2) NOT NULL COMMENT 'Copia histórica: no cambia si sube el precio',
  descuento_aplicado  DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT 'Copia histórica del descuento',
  promocion_id        INT NULL COMMENT 'Paquete, convenio o descuento que se aplicó',
  FOREIGN KEY (pago_id)      REFERENCES pagos(id),
  FOREIGN KEY (alumno_id)    REFERENCES alumnos(id),
  FOREIGN KEY (concepto_id)  REFERENCES conceptos(id),
  FOREIGN KEY (promocion_id) REFERENCES promociones(id)
) ENGINE=InnoDB COMMENT='Líneas del ticket';

CREATE TABLE facturas (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  pago_id           INT NOT NULL UNIQUE,
  perfil_fiscal_id  INT NOT NULL,
  uuid_sat          CHAR(36) NULL UNIQUE,
  estado            ENUM('pendiente','timbrada','cancelada','error') NOT NULL,
  ruta_xml          VARCHAR(255) NULL,
  ruta_pdf          VARCHAR(255) NULL,
  fecha_timbrado    DATETIME NULL,
  FOREIGN KEY (pago_id)          REFERENCES pagos(id),
  FOREIGN KEY (perfil_fiscal_id) REFERENCES perfiles_fiscales(id)
) ENGINE=InnoDB;

CREATE TABLE suscripciones (
  id                       INT AUTO_INCREMENT PRIMARY KEY,
  responsable_id           INT NOT NULL,
  alumno_id                INT NOT NULL,
  concepto_id              INT NOT NULL,
  modo                     ENUM('automatico','manual') NOT NULL,
  frecuencia               ENUM('mensual','quincenal') NOT NULL DEFAULT 'mensual',
  pasarela_suscripcion_id  VARCHAR(100) NULL COMMENT 'Id en la pasarela; ella hace el cargo',
  estado                   ENUM('activa','pausada','cancelada') NOT NULL,
  dia_cargo                TINYINT NOT NULL COMMENT 'Fijo: pagar tarde no lo recorre (RN-34)',
  FOREIGN KEY (responsable_id) REFERENCES responsables_pago(id),
  FOREIGN KEY (alumno_id)      REFERENCES alumnos(id),
  FOREIGN KEY (concepto_id)    REFERENCES conceptos(id)
) ENGINE=InnoDB;

CREATE TABLE pases_dia (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  persona_id       INT NOT NULL,
  sucursal_id      INT NOT NULL,
  horario_id       INT NOT NULL COMMENT 'Clase para la que recepción registra el pase (RF-27)',
  fecha            DATE NOT NULL,
  pago_detalle_id  INT NOT NULL UNIQUE,
  FOREIGN KEY (persona_id)      REFERENCES personas(id),
  FOREIGN KEY (sucursal_id)     REFERENCES sucursales(id),
  FOREIGN KEY (horario_id)      REFERENCES horarios(id),
  FOREIGN KEY (pago_detalle_id) REFERENCES pago_detalles(id)
) ENGINE=InnoDB;

CREATE TABLE saldos_favor (
  id                      INT AUTO_INCREMENT PRIMARY KEY,
  responsable_id          INT NOT NULL,
  alumno_id               INT NULL,
  origen_pago_detalle_id  INT NOT NULL UNIQUE COMMENT 'Línea pagada que no se usó (ej. examen cancelado)',
  monto                   DECIMAL(10,2) NOT NULL COMMENT 'Copia histórica del monto pagado',
  fecha                   DATETIME NOT NULL,
  aplicado_en_pago_id     INT NULL UNIQUE COMMENT 'NULL = disponible; se usa con metodo saldo_favor',
  FOREIGN KEY (responsable_id)         REFERENCES responsables_pago(id),
  FOREIGN KEY (alumno_id)              REFERENCES alumnos(id),
  FOREIGN KEY (origen_pago_detalle_id) REFERENCES pago_detalles(id),
  FOREIGN KEY (aplicado_en_pago_id)    REFERENCES pagos(id)
) ENGINE=InnoDB COMMENT='Dinero a favor del responsable (RF-74, RN-32)';
