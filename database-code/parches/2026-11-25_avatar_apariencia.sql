-- Parche para una base que YA existe: apariencia del avatar (piel, cabello, vello facial, complexión).
-- Se puede correr más de una vez.
-- Uso: docker compose exec -T db sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" dojo' < database-code/parches/2026-11-25_avatar_apariencia.sql
USE dojo;

CREATE TABLE IF NOT EXISTS avatar_apariencia (
  alumno_id    INT PRIMARY KEY,
  piel         VARCHAR(12) NOT NULL DEFAULT '2' COMMENT 'Tono de piel 1 (claro) a 6 (oscuro)',
  peinado      VARCHAR(20) NOT NULL DEFAULT 'corto' COMMENT 'rapado, corto, despeinado, rizado, coleta, chongo, largo',
  color_pelo   VARCHAR(20) NOT NULL DEFAULT 'negro',
  vello        VARCHAR(20) NOT NULL DEFAULT 'ninguno' COMMENT 'ninguno, bigote, candado, barba (solo jóvenes y adultos)',
  complexion   VARCHAR(12) NOT NULL DEFAULT 'media' COMMENT 'delgada, media, robusta',
  actualizado  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (alumno_id) REFERENCES alumnos(id)
) ENGINE=InnoDB COMMENT='Cómo se ve el avatar; lo que trae puesto está en avatar_equipo. La edad (niño, joven, adulto) sale de la fecha de nacimiento';
