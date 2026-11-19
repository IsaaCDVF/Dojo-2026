-- Dojo OS · modelo de datos v0.6 · 005_examenes_grados
USE dojo;

CREATE TABLE examenes (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  sucursal_id    INT NOT NULL,
  disciplina_id  INT NOT NULL,
  fecha          DATETIME NOT NULL,
  sede           VARCHAR(120) NULL,
  estado         ENUM('programado','realizado','cancelado') NOT NULL DEFAULT 'programado',
  programado_por INT NOT NULL COMMENT 'Administrador de la sucursal',
  FOREIGN KEY (sucursal_id)    REFERENCES sucursales(id),
  FOREIGN KEY (disciplina_id)  REFERENCES disciplinas(id),
  FOREIGN KEY (programado_por) REFERENCES usuarios(id)
) ENGINE=InnoDB COMMENT='Fechas que programa cada sucursal (RN-31). La fecha límite se calcula: fecha menos N días del parámetro (RF-45)';

CREATE TABLE solicitudes_examen (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  alumno_id          INT NOT NULL,
  examen_id          INT NOT NULL,
  grado_objetivo_id  INT NOT NULL,
  fecha_envio        DATETIME NOT NULL COMMENT 'Se evalúa con parámetros vigentes a esta fecha (RN-25)',
  canal              ENUM('portal','mostrador') NOT NULL,
  registrada_por     INT NULL COMMENT 'Usuario de recepción si fue en mostrador (RF-76)',
  cumplia_criterios  BOOLEAN NOT NULL COMMENT 'Copia al enviar: FALSE y autorizada = excepción del instructor (RF-47)',
  estado             ENUM('enviada','fuera_de_plazo','por_autorizar','autorizada','no_autorizada',
                          'cancelada','aprobada','reprobada') NOT NULL DEFAULT 'enviada'
                     COMMENT 'Pago pendiente = autorizada sin pago_detalle_id (se calcula)',
  instructor_id      INT NULL,
  fecha_resolucion   DATETIME NULL,
  observaciones      VARCHAR(500) NULL COMMENT 'Obligatorias si el instructor rechaza',
  pago_detalle_id    INT NULL UNIQUE COMMENT 'Solo después de autorizar (RF-61)',
  FOREIGN KEY (alumno_id)         REFERENCES alumnos(id),
  FOREIGN KEY (examen_id)         REFERENCES examenes(id),
  FOREIGN KEY (grado_objetivo_id) REFERENCES grados(id),
  FOREIGN KEY (registrada_por)    REFERENCES usuarios(id),
  FOREIGN KEY (instructor_id)     REFERENCES instructores(id),
  FOREIGN KEY (pago_detalle_id)   REFERENCES pago_detalles(id)
) ENGINE=InnoDB;

CREATE TABLE excepciones_examen (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  solicitud_id  INT NOT NULL,
  tipo          ENUM('fuera_de_plazo','presentar_sin_pago') NOT NULL,
  decision      ENUM('autorizada','rechazada') NOT NULL,
  motivo        VARCHAR(500) NOT NULL COMMENT 'Ej. las cintas ya se pidieron',
  decidido_por  INT NOT NULL COMMENT 'Administrador de la sucursal',
  fecha         DATETIME NOT NULL,
  UNIQUE (solicitud_id, tipo),
  FOREIGN KEY (solicitud_id) REFERENCES solicitudes_examen(id),
  FOREIGN KEY (decidido_por) REFERENCES usuarios(id)
) ENGINE=InnoDB COMMENT='Decisiones del administrador fuera de la regla (RF-73, RN-30)';

CREATE TABLE cancelaciones_examen (
  solicitud_id    INT PRIMARY KEY,
  motivo          ENUM('no_pago','no_se_presento','a_peticion','otro') NOT NULL,
  detalle         VARCHAR(300) NULL,
  cancelado_por   INT NOT NULL,
  fecha           DATETIME NOT NULL,
  saldo_favor_id  INT NULL UNIQUE COMMENT 'Si ya había pagado (RN-32)',
  FOREIGN KEY (solicitud_id)   REFERENCES solicitudes_examen(id),
  FOREIGN KEY (cancelado_por)  REFERENCES usuarios(id),
  FOREIGN KEY (saldo_favor_id) REFERENCES saldos_favor(id)
) ENGINE=InnoDB COMMENT='Solo existe si la solicitud se canceló (RF-74)';

CREATE TABLE examen_evaluaciones (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  solicitud_id   INT NOT NULL,
  tipo           ENUM('practico','parcial','tesina','validacion') NOT NULL,
  numero         TINYINT NOT NULL DEFAULT 1 COMMENT 'Parcial 1, 2, 3...',
  fecha          DATETIME NULL,
  calificacion   DECIMAL(5,2) NULL,
  resultado      ENUM('pendiente','aprobado','reprobado') NOT NULL DEFAULT 'pendiente',
  instructor_id  INT NULL,
  UNIQUE (solicitud_id, tipo, numero),
  FOREIGN KEY (solicitud_id)  REFERENCES solicitudes_examen(id),
  FOREIGN KEY (instructor_id) REFERENCES instructores(id)
) ENGINE=InnoDB COMMENT='Un examen de dan puede tener 3 parciales + tesina + validación';

CREATE TABLE alumno_grados (
  id                   INT AUTO_INCREMENT PRIMARY KEY,
  alumno_id            INT NOT NULL,
  grado_id             INT NOT NULL,
  fecha_obtencion      DATE NOT NULL,
  origen               ENUM('ubicacion','examen','migracion') NOT NULL
                       COMMENT 'ubicacion = evaluación técnica al inscribirse',
  solicitud_examen_id  INT NULL COMMENT 'Solo cuando origen = examen',
  evaluado_por         INT NULL COMMENT 'Instructor que hizo la ubicación',
  FOREIGN KEY (alumno_id)           REFERENCES alumnos(id),
  FOREIGN KEY (grado_id)            REFERENCES grados(id),
  FOREIGN KEY (solicitud_examen_id) REFERENCES solicitudes_examen(id),
  FOREIGN KEY (evaluado_por)        REFERENCES instructores(id)
) ENGINE=InnoDB COMMENT='Historial; el grado actual es el más reciente';
