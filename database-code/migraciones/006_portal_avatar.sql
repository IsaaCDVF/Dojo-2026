-- Dojo OS · modelo de datos v0.6 · 006_portal_avatar
USE dojo;

CREATE TABLE insignias (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  grado_id  INT NOT NULL UNIQUE COMMENT 'Se gana al obtener este grado; la disciplina sale del grado',
  nombre    VARCHAR(80) NOT NULL,
  imagen    VARCHAR(255) NOT NULL,
  FOREIGN KEY (grado_id) REFERENCES grados(id)
) ENGINE=InnoDB COMMENT='Las insignias de un alumno se calculan desde alumno_grados (RF-52, RN-16)';

CREATE TABLE accesorios (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  nombre    VARCHAR(80) NOT NULL,
  tipo      ENUM('cabeza','torso','piernas','pies','mano','fondo') NOT NULL,
  imagen    VARCHAR(255) NOT NULL,
  grado_id  INT NULL COMMENT 'Se desbloquea al obtener este grado; NULL = disponible desde el inicio',
  FOREIGN KEY (grado_id) REFERENCES grados(id)
) ENGINE=InnoDB COMMENT='Un solo avatar por alumno, sin importar la disciplina';

CREATE TABLE avatar_equipo (
  alumno_id     INT NOT NULL,
  accesorio_id  INT NOT NULL,
  PRIMARY KEY (alumno_id, accesorio_id),
  FOREIGN KEY (alumno_id)    REFERENCES alumnos(id),
  FOREIGN KEY (accesorio_id) REFERENCES accesorios(id)
) ENGINE=InnoDB COMMENT='Lo que el alumno trae puesto; lo desbloqueado se calcula por sus grados';
