-- Dojo OS · 009_avatar_apariencia · el alumno personaliza su avatar para que se parezca a él
USE dojo;

CREATE TABLE avatar_apariencia (
  alumno_id    INT PRIMARY KEY,
  piel         VARCHAR(12) NOT NULL DEFAULT '2' COMMENT 'Tono de piel 1 (claro) a 6 (oscuro)',
  peinado      VARCHAR(20) NOT NULL DEFAULT 'corto' COMMENT 'rapado, corto, despeinado, rizado, coleta, chongo, largo',
  color_pelo   VARCHAR(20) NOT NULL DEFAULT 'negro',
  vello        VARCHAR(20) NOT NULL DEFAULT 'ninguno' COMMENT 'ninguno, bigote, candado, barba (solo jóvenes y adultos)',
  complexion   VARCHAR(12) NOT NULL DEFAULT 'media' COMMENT 'delgada, media, robusta',
  actualizado  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (alumno_id) REFERENCES alumnos(id)
) ENGINE=InnoDB COMMENT='Cómo se ve el avatar; lo que trae puesto está en avatar_equipo. La edad (niño, joven, adulto) sale de la fecha de nacimiento';
