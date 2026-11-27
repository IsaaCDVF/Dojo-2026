-- Dojo OS · 008_app_movil · acceso de alumnos y responsables a la app
USE dojo;

CREATE TABLE activaciones (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id   INT NOT NULL,
  codigo_hash  VARCHAR(255) NOT NULL COMMENT 'Código de 6 dígitos cifrado; se entrega por WhatsApp en recepción',
  expira       DATETIME NOT NULL,
  usada        DATETIME NULL,
  intentos     TINYINT NOT NULL DEFAULT 0 COMMENT 'Tras 5 intentos fallidos el código deja de servir',
  creada_por   INT NOT NULL,
  creada       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  FOREIGN KEY (creada_por) REFERENCES usuarios(id)
) ENGINE=InnoDB COMMENT='Recepción da el acceso a la app: el alumno o responsable activa con el código y pone su contraseña';
