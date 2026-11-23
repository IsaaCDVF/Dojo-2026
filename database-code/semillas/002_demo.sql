-- Dojo OS · datos de demostración (NO usar en producción) · v0.6
USE dojo;
SET NAMES utf8mb4;

INSERT INTO sucursales (clave, nombre) VALUES ('CENT','Sucursal Centro'),('NORT','Sucursal Norte'),('PONI','Sucursal Poniente');
INSERT INTO disciplinas (nombre) VALUES ('Taekwondo'),('Karate'),('Jiu-Jitsu'),('Box');
INSERT INTO sucursal_disciplinas SELECT s.id, d.id FROM sucursales s CROSS JOIN disciplinas d WHERE s.clave='CENT' OR d.nombre IN ('Taekwondo','Karate');
INSERT INTO grados (disciplina_id, nombre, orden, color_cinta) VALUES
  ((SELECT id FROM disciplinas WHERE nombre='Taekwondo'),'10 kup',1,'Blanca'),
  ((SELECT id FROM disciplinas WHERE nombre='Taekwondo'),'9 kup',2,'Blanca avanzada'),
  ((SELECT id FROM disciplinas WHERE nombre='Taekwondo'),'8 kup',3,'Amarilla'),
  ((SELECT id FROM disciplinas WHERE nombre='Taekwondo'),'7 kup',4,'Amarilla avanzada'),
  ((SELECT id FROM disciplinas WHERE nombre='Taekwondo'),'6 kup',5,'Verde'),
  ((SELECT id FROM disciplinas WHERE nombre='Taekwondo'),'5 kup',6,'Verde avanzada'),
  ((SELECT id FROM disciplinas WHERE nombre='Taekwondo'),'4 kup',7,'Azul'),
  ((SELECT id FROM disciplinas WHERE nombre='Taekwondo'),'3 kup',8,'Azul avanzada'),
  ((SELECT id FROM disciplinas WHERE nombre='Taekwondo'),'2 kup',9,'Roja'),
  ((SELECT id FROM disciplinas WHERE nombre='Taekwondo'),'1 kup',10,'Roja avanzada'),
  ((SELECT id FROM disciplinas WHERE nombre='Taekwondo'),'1 dan',11,'Negra'),
  ((SELECT id FROM disciplinas WHERE nombre='Taekwondo'),'2 dan',12,'Negra'),
  ((SELECT id FROM disciplinas WHERE nombre='Taekwondo'),'3 dan',13,'Negra');
-- Un instructor de ejemplo con usuario
INSERT INTO personas (nombre, apellido_paterno, fecha_nacimiento) VALUES ('Laura','Méndez','1990-05-12');
SET @p = LAST_INSERT_ID();
INSERT INTO instructores (persona_id, fecha_ingreso) VALUES (@p, '2024-01-15');
SET @inst = LAST_INSERT_ID();
INSERT INTO usuarios (persona_id, email, password_hash) VALUES (@p, 'laura@dojoos.mx', '$2y$10$IKLlkoO0VtYbYtsUYPd.KOGsCOygwlWhgdY91MH12K83XGa5gfMKq');
INSERT INTO usuario_roles (usuario_id, rol_id, sucursal_id)
  SELECT u.id, r.id, s.id FROM usuarios u, roles r, sucursales s
  WHERE u.email='laura@dojoos.mx' AND ((r.nombre='instructor' AND s.clave='CENT') OR (r.nombre='admin_sucursal' AND s.clave='NORT'));
INSERT INTO horarios (sucursal_id, disciplina_id, instructor_id, dia_semana, hora_inicio, hora_fin, nivel, grado_desde_id, grado_hasta_id)
  SELECT s.id, d.id, @inst, x.dia, x.ini, x.fin, x.nivel,
         (SELECT id FROM grados WHERE disciplina_id=d.id AND orden=x.g1), (SELECT id FROM grados WHERE disciplina_id=d.id AND orden=x.g2)
  FROM sucursales s, disciplinas d,
   (SELECT 1 dia,'17:00:00' ini,'18:00:00' fin,'Infantil principiantes' nivel,1 g1,4 g2
    UNION ALL SELECT 1,'18:00:00','19:00:00','Intermedios',5,8
    UNION ALL SELECT 3,'19:00:00','20:30:00','Avanzados y negras',9,13) x
  WHERE s.clave='CENT' AND d.nombre='Taekwondo';

-- Precios base de examen, pase y recargo (la mensualidad y la inscripción las da de alta el administrador en Tarifas)
INSERT INTO precios (concepto_id, sucursal_id, monto, vigente_desde)
  SELECT id, NULL, x.monto, '2026-01-01' FROM conceptos c
  JOIN (SELECT 'examen' tipo, 450 monto UNION ALL SELECT 'pase_dia', 150 UNION ALL SELECT 'recargo', 100) x ON x.tipo = c.tipo;
