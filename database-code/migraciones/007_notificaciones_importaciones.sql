-- Dojo OS · modelo de datos v0.6 · 007_notificaciones_importaciones
USE dojo;

CREATE TABLE plantillas_notificacion (
  id      INT AUTO_INCREMENT PRIMARY KEY,
  evento  VARCHAR(60) NOT NULL COMMENT 'aviso_cobro, examen_autorizado, elegible...',
  canal   ENUM('email','whatsapp','sms','app') NOT NULL,
  asunto  VARCHAR(150) NULL,
  cuerpo  TEXT NOT NULL
) ENGINE=InnoDB;

CREATE TABLE notificaciones (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  persona_id        INT NOT NULL COMMENT 'Destinatario (normalmente el responsable)',
  plantilla_id      INT NOT NULL COMMENT 'El canal se obtiene de la plantilla',
  mensaje           TEXT NOT NULL COMMENT 'Texto final enviado (copia histórica)',
  fecha_programada  DATETIME NOT NULL,
  fecha_envio       DATETIME NULL,
  estado            ENUM('programada','enviada','fallida') NOT NULL DEFAULT 'programada',
  referencia_tabla  VARCHAR(60) NULL COMMENT 'Qué provocó el aviso; lo llena el código',
  referencia_id     INT NULL,
  FOREIGN KEY (persona_id)   REFERENCES personas(id),
  FOREIGN KEY (plantilla_id) REFERENCES plantillas_notificacion(id)
) ENGINE=InnoDB;

CREATE TABLE importaciones (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id     INT NOT NULL,
  tipo           ENUM('importacion','exportacion','datos_prueba') NOT NULL,
  entidad        VARCHAR(60) NOT NULL COMMENT 'alumnos, horarios, base_completa...',
  formato        ENUM('xlsx','csv','json','sql') NOT NULL,
  archivo        VARCHAR(255) NOT NULL,
  fecha          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  filas_ok       INT NOT NULL DEFAULT 0,
  filas_error    INT NOT NULL DEFAULT 0,
  estado         ENUM('procesando','completada','con_errores','revertida') NOT NULL,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
) ENGINE=InnoDB COMMENT='Cada carga o descarga masiva';

CREATE TABLE importacion_registros (
  importacion_id  INT NOT NULL,
  tabla           VARCHAR(60) NOT NULL,
  registro_id     INT NOT NULL,
  PRIMARY KEY (importacion_id, tabla, registro_id),
  FOREIGN KEY (importacion_id) REFERENCES importaciones(id)
) ENGINE=InnoDB COMMENT='Qué filas creó cada carga; permite borrar los datos de prueba';
