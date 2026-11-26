-- Dojo OS · 013 · Tabletas de asistencia como dispositivos
-- La tableta de la entrada ya no es una "persona" con correo y contraseña: se conecta con un código de 6 dígitos
-- que muestra en pantalla y el admin escribe en el panel. Por dentro sigue usando una cuenta con el rol "tableta"
-- (así le aplican los mismos permisos), pero esa cuenta no tiene contraseña con la que alguien pueda entrar.
USE dojo;

CREATE TABLE dispositivos (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  nombre        VARCHAR(60) NOT NULL COMMENT 'Ej. Entrada Centro',
  sucursal_id   INT NOT NULL,
  usuario_id    INT NOT NULL UNIQUE COMMENT 'Cuenta interna con rol tableta en la sucursal',
  activo        BOOLEAN NOT NULL DEFAULT TRUE COMMENT 'Desconectar = 0: se cierra su sesión y ya no puede registrar',
  creado        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  creado_por    INT NOT NULL,
  FOREIGN KEY (sucursal_id) REFERENCES sucursales(id),
  FOREIGN KEY (usuario_id)  REFERENCES usuarios(id),
  FOREIGN KEY (creado_por)  REFERENCES usuarios(id)
) ENGINE=InnoDB COMMENT='Tabletas o celulares que registran asistencia en la entrada';

CREATE TABLE dispositivo_vinculos (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  codigo          CHAR(6)  NOT NULL COMMENT 'Lo que se ve en la tableta y se escribe en el panel',
  clave_hash      CHAR(64) NOT NULL UNIQUE COMMENT 'SHA-256 de la clave secreta que guarda la tableta mientras espera',
  ip              VARCHAR(45) NULL,
  creado          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expira          DATETIME NOT NULL COMMENT '10 minutos',
  dispositivo_id  INT NULL COMMENT 'Se llena cuando el admin escribe el código',
  entregado       DATETIME NULL COMMENT 'Cuando la tableta recibió su sesión (el código ya no sirve)',
  INDEX (codigo),
  FOREIGN KEY (dispositivo_id) REFERENCES dispositivos(id)
) ENGINE=InnoDB COMMENT='Códigos para conectar una tableta (se usan una vez)';
