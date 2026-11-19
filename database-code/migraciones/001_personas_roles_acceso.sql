-- Dojo OS · modelo de datos v0.6 · 001_personas_roles_acceso
USE dojo;

CREATE TABLE personas (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  nombre            VARCHAR(60)  NOT NULL,
  apellido_paterno  VARCHAR(60)  NOT NULL,
  apellido_materno  VARCHAR(60)  NULL,
  fecha_nacimiento  DATE         NOT NULL,
  sexo              ENUM('F','M','X') NULL,
  curp              CHAR(18)     NULL UNIQUE COMMENT 'Obligatoria para alumnos (RF-14); se valida en la API',
  foto              VARCHAR(255) NULL COMMENT 'Ruta del archivo; obligatoria para alumnos (RF-14)'
) ENGINE=InnoDB COMMENT='Solo datos básicos de cualquier persona';

CREATE TABLE contactos (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  persona_id  INT NOT NULL,
  tipo        ENUM('telefono','email','whatsapp') NOT NULL,
  valor       VARCHAR(120) NOT NULL,
  principal   BOOLEAN NOT NULL DEFAULT FALSE,
  FOREIGN KEY (persona_id) REFERENCES personas(id)
) ENGINE=InnoDB;

CREATE TABLE domicilios (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  persona_id  INT NULL COMMENT 'NULL cuando es domicilio de una sucursal',
  calle       VARCHAR(100) NOT NULL,
  numero      VARCHAR(20)  NULL,
  colonia     VARCHAR(80)  NULL,
  cp          CHAR(5)      NOT NULL,
  municipio   VARCHAR(80)  NOT NULL,
  estado      VARCHAR(60)  NOT NULL,
  FOREIGN KEY (persona_id) REFERENCES personas(id)
) ENGINE=InnoDB;

CREATE TABLE datos_academicos (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  persona_id  INT NOT NULL UNIQUE,
  escuela     VARCHAR(120) NULL,
  nivel       VARCHAR(40)  NULL,
  FOREIGN KEY (persona_id) REFERENCES personas(id)
) ENGINE=InnoDB;

CREATE TABLE sucursales (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  clave         CHAR(4)     NOT NULL UNIQUE COMMENT 'Prefijo de folios: CENT-26-0001',
  nombre        VARCHAR(80) NOT NULL UNIQUE,
  domicilio_id  INT NULL,
  activa        BOOLEAN NOT NULL DEFAULT TRUE,
  FOREIGN KEY (domicilio_id) REFERENCES domicilios(id)
) ENGINE=InnoDB;

CREATE TABLE roles (
  id      INT AUTO_INCREMENT PRIMARY KEY,
  nombre       VARCHAR(40)  NOT NULL UNIQUE COMMENT 'super_admin, admin_sucursal, recepcion, instructor, responsable, alumno, tableta',
  descripcion  VARCHAR(150) NOT NULL,
  nivel        TINYINT      NOT NULL COMMENT 'Nivel de autorización: 5 súper admin ... 1 alumno. Solo se asignan roles de nivel menor al propio',
  alcance      ENUM('global','sucursal','propio') NOT NULL COMMENT 'global: todas las sucursales; sucursal: la del usuario_rol; propio: solo sus datos'
) ENGINE=InnoDB;

CREATE TABLE permisos (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  clave        VARCHAR(80) NOT NULL UNIQUE COMMENT 'Ej. alumnos.crear, pagos.registrar, parametros.editar',
  modulo       VARCHAR(40) NOT NULL,
  descripcion  VARCHAR(200) NOT NULL,
  nivel_minimo TINYINT      NOT NULL DEFAULT 1 COMMENT 'Ningún rol de nivel menor puede recibir este permiso'
) ENGINE=InnoDB COMMENT='Cada acción que el sistema protege';

CREATE TABLE rol_permisos (
  rol_id      INT NOT NULL,
  permiso_id  INT NOT NULL,
  PRIMARY KEY (rol_id, permiso_id),
  FOREIGN KEY (rol_id)     REFERENCES roles(id),
  FOREIGN KEY (permiso_id) REFERENCES permisos(id)
) ENGINE=InnoDB COMMENT='Qué puede hacer cada rol (rompe el muchos a muchos)';

CREATE TABLE usuarios (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  persona_id     INT NOT NULL UNIQUE,
  email          VARCHAR(120) NOT NULL UNIQUE,
  password_hash  VARCHAR(255) NOT NULL,
  activo         BOOLEAN NOT NULL DEFAULT TRUE,
  intentos_fallidos TINYINT NOT NULL DEFAULT 0,
  bloqueado_hasta   DATETIME NULL COMMENT 'Tras N intentos fallidos (parámetro intentos_login) se bloquea 15 minutos',
  FOREIGN KEY (persona_id) REFERENCES personas(id)
) ENGINE=InnoDB COMMENT='Una cuenta por persona; los roles van en usuario_roles';

CREATE TABLE usuario_roles (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id   INT NOT NULL,
  rol_id       INT NOT NULL,
  sucursal_id  INT NULL COMMENT 'NULL = rol global (súper admin)',
  activo       BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE KEY uq_usuario_rol_sucursal (usuario_id, rol_id, sucursal_id),
  FOREIGN KEY (usuario_id)  REFERENCES usuarios(id),
  FOREIGN KEY (rol_id)      REFERENCES roles(id),
  FOREIGN KEY (sucursal_id) REFERENCES sucursales(id)
) ENGINE=InnoDB COMMENT='Un usuario puede ser admin en una sucursal e instructor en otra';

CREATE TABLE sesiones (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id        INT NOT NULL,
  usuario_rol_id    INT NULL COMMENT 'Rol y sucursal con que trabaja, NULL hasta que elige',
  token_hash        CHAR(64) NOT NULL UNIQUE COMMENT 'SHA-256 del token, el token nunca se guarda',
  ip                VARCHAR(45) NULL,
  creada            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ultima_actividad  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revocada          DATETIME NULL COMMENT 'Al cerrar sesión, cambiar contraseña o cambiar roles',
  FOREIGN KEY (usuario_id)     REFERENCES usuarios(id),
  FOREIGN KEY (usuario_rol_id) REFERENCES usuario_roles(id),
  INDEX idx_sesiones_usuario (usuario_id)
) ENGINE=InnoDB COMMENT='La expiración se calcula: ultima_actividad + parámetro minutos_inactividad_sesion';

CREATE TABLE folios (
  sucursal_id  INT NOT NULL,
  tipo         ENUM('matricula','recibo') NOT NULL,
  anio         SMALLINT NOT NULL,
  ultimo       INT NOT NULL DEFAULT 0,
  PRIMARY KEY (sucursal_id, tipo, anio),
  FOREIGN KEY (sucursal_id) REFERENCES sucursales(id)
) ENGINE=InnoDB COMMENT='Último consecutivo por sucursal, tipo y año. Se lee con SELECT ... FOR UPDATE dentro de la transacción';
