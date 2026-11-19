-- Dojo OS · modelo de datos v0.6 · 003_alumnos_inscripciones_asistencia
USE dojo;

CREATE TABLE alumnos (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  matricula    VARCHAR(16) NOT NULL UNIQUE COMMENT 'Folio legible: clave de sucursal-año-consecutivo (RF-67)',
  persona_id   INT NOT NULL UNIQUE,
  sucursal_id  INT NOT NULL COMMENT 'Sucursal de origen',
  fecha_alta   DATE NOT NULL,
  estado       ENUM('activo','baja','suspendido') NOT NULL DEFAULT 'activo',
  codigo_qr    VARCHAR(64) NOT NULL UNIQUE COMMENT 'Token aleatorio, no la matrícula; se puede regenerar',
  FOREIGN KEY (persona_id)  REFERENCES personas(id),
  FOREIGN KEY (sucursal_id) REFERENCES sucursales(id)
) ENGINE=InnoDB;

CREATE TABLE responsables_pago (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  persona_id  INT NOT NULL UNIQUE,
  FOREIGN KEY (persona_id) REFERENCES personas(id)
) ENGINE=InnoDB COMMENT='Adulto que paga por uno o varios alumnos';

CREATE TABLE alumno_responsable (
  alumno_id       INT NOT NULL,
  responsable_id  INT NOT NULL,
  parentesco      VARCHAR(30) NOT NULL COMMENT 'padre, madre, esposo(a), él mismo...',
  vigente_desde   DATE NOT NULL,
  vigente_hasta   DATE NULL,
  PRIMARY KEY (alumno_id, responsable_id),
  FOREIGN KEY (alumno_id)      REFERENCES alumnos(id),
  FOREIGN KEY (responsable_id) REFERENCES responsables_pago(id)
) ENGINE=InnoDB;

CREATE TABLE inscripciones (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  alumno_id     INT NOT NULL,
  horario_id    INT NOT NULL,
  fecha_inicio  DATE NOT NULL,
  fecha_fin     DATE NULL,
  FOREIGN KEY (alumno_id)  REFERENCES alumnos(id),
  FOREIGN KEY (horario_id) REFERENCES horarios(id)
) ENGINE=InnoDB COMMENT='Horario que eligió el alumno';

CREATE TABLE asistencias (
  id                   INT AUTO_INCREMENT PRIMARY KEY,
  alumno_id            INT NOT NULL,
  horario_id           INT NOT NULL,
  sucursal_id          INT NOT NULL COMMENT 'Distinta a la del alumno = visita',
  fecha_hora           DATETIME NOT NULL,
  metodo               ENUM('qr','manual') NOT NULL,
  registrado_por       INT NULL COMMENT 'Usuario si fue manual',
  validada_instructor  BOOLEAN NOT NULL DEFAULT FALSE,
  FOREIGN KEY (alumno_id)      REFERENCES alumnos(id),
  FOREIGN KEY (horario_id)     REFERENCES horarios(id),
  FOREIGN KEY (sucursal_id)    REFERENCES sucursales(id),
  FOREIGN KEY (registrado_por) REFERENCES usuarios(id)
) ENGINE=InnoDB COMMENT='El retardo se calcula, no se guarda';

CREATE TABLE accesos_rechazados (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  alumno_id    INT NOT NULL,
  horario_id   INT NOT NULL COMMENT 'Horario que eligió en la tableta',
  sucursal_id  INT NOT NULL,
  fecha_hora   DATETIME NOT NULL,
  motivo       ENUM('no_inscrito','adeudo','visita_rechazada','alumno_baja') NOT NULL,
  FOREIGN KEY (alumno_id)   REFERENCES alumnos(id),
  FOREIGN KEY (horario_id)  REFERENCES horarios(id),
  FOREIGN KEY (sucursal_id) REFERENCES sucursales(id)
) ENGINE=InnoDB COMMENT='Escaneos que la tableta no aceptó (RF-80, RF-23)';
