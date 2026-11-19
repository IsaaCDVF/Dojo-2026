-- Dojo OS · modelo de datos v0.6 · 002_catalogos_dojo
USE dojo;

CREATE TABLE disciplinas (
  id      INT AUTO_INCREMENT PRIMARY KEY,
  nombre  VARCHAR(60) NOT NULL UNIQUE,
  activa  BOOLEAN NOT NULL DEFAULT TRUE COMMENT 'Baja lógica: una disciplina con historial no se borra'
) ENGINE=InnoDB;

CREATE TABLE sucursal_disciplinas (
  sucursal_id    INT NOT NULL,
  disciplina_id  INT NOT NULL,
  PRIMARY KEY (sucursal_id, disciplina_id),
  FOREIGN KEY (sucursal_id)   REFERENCES sucursales(id),
  FOREIGN KEY (disciplina_id) REFERENCES disciplinas(id)
) ENGINE=InnoDB;

CREATE TABLE grados (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  disciplina_id  INT NOT NULL,
  nombre         VARCHAR(60) NOT NULL,
  orden          TINYINT NOT NULL,
  color_cinta    VARCHAR(30) NULL,
  activo         BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (disciplina_id, orden),
  FOREIGN KEY (disciplina_id) REFERENCES disciplinas(id)
) ENGINE=InnoDB;

CREATE TABLE instructores (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  persona_id     INT NOT NULL UNIQUE,
  fecha_ingreso  DATE NULL,
  FOREIGN KEY (persona_id) REFERENCES personas(id)
) ENGINE=InnoDB;

CREATE TABLE horarios (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  sucursal_id    INT NOT NULL,
  disciplina_id  INT NOT NULL,
  instructor_id  INT NOT NULL,
  dia_semana     TINYINT NOT NULL COMMENT '1 = lunes ... 7 = domingo',
  hora_inicio    TIME NOT NULL,
  hora_fin       TIME NOT NULL,
  cupo           INT NULL COMMENT 'Pendiente de confirmar (ERS 7.3)',
  nivel          VARCHAR(40) NULL COMMENT 'Texto que ve el alumno en la tableta: Infantil, Avanzados...',
  grado_desde_id INT NULL COMMENT 'NULL = desde el primer grado',
  grado_hasta_id INT NULL COMMENT 'NULL = hasta el último grado',
  activo         BOOLEAN NOT NULL DEFAULT TRUE,
  FOREIGN KEY (sucursal_id)   REFERENCES sucursales(id),
  FOREIGN KEY (disciplina_id) REFERENCES disciplinas(id),
  FOREIGN KEY (instructor_id) REFERENCES instructores(id),
  FOREIGN KEY (grado_desde_id) REFERENCES grados(id),
  FOREIGN KEY (grado_hasta_id) REFERENCES grados(id)
) ENGINE=InnoDB;

CREATE TABLE parametros (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  clave        VARCHAR(60) NOT NULL UNIQUE,
  descripcion  VARCHAR(200) NOT NULL,
  tipo_dato    ENUM('entero','decimal','porcentaje','dias','minutos','texto') NOT NULL,
  unidad       VARCHAR(20) NULL
) ENGINE=InnoDB;

CREATE TABLE parametro_valores (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  parametro_id    INT NOT NULL,
  sucursal_id     INT NULL COMMENT 'NULL = valor global',
  disciplina_id   INT NULL COMMENT 'NULL = todas las disciplinas',
  grado_id        INT NULL COMMENT 'NULL = todos los grados (ej. dan: 12 meses, kup: 3)',
  valor           VARCHAR(100) NOT NULL,
  vigente_desde   DATETIME NOT NULL,
  vigente_hasta   DATETIME NULL COMMENT 'NULL = vigente hoy',
  modificado_por  INT NOT NULL,
  FOREIGN KEY (parametro_id)   REFERENCES parametros(id),
  FOREIGN KEY (sucursal_id)    REFERENCES sucursales(id),
  FOREIGN KEY (disciplina_id)  REFERENCES disciplinas(id),
  FOREIGN KEY (grado_id)       REFERENCES grados(id),
  FOREIGN KEY (modificado_por) REFERENCES usuarios(id)
) ENGINE=InnoDB COMMENT='Nunca se edita: se cierra el vigente y se abre uno nuevo';

CREATE TABLE bitacora (
  id              BIGINT AUTO_INCREMENT PRIMARY KEY,
  usuario_id      INT NOT NULL COMMENT 'Quién hizo el cambio',
  sucursal_id     INT NULL,
  fecha_hora      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  accion          ENUM('alta','cambio','baja') NOT NULL,
  tabla           VARCHAR(60) NOT NULL,
  registro_id     INT NOT NULL,
  campo           VARCHAR(60) NULL,
  valor_anterior  TEXT NULL,
  valor_nuevo     TEXT NULL,
  ip              VARCHAR(45) NULL,
  FOREIGN KEY (usuario_id)  REFERENCES usuarios(id),
  FOREIGN KEY (sucursal_id) REFERENCES sucursales(id),
  INDEX idx_bitacora_busqueda (tabla, registro_id),
  INDEX idx_bitacora_fecha (fecha_hora)
) ENGINE=InnoDB COMMENT='Una fila por campo cambiado';
