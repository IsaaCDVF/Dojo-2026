-- Dojo OS · app móvil · insignias por grado y accesorios del avatar (Taekwondo de la demo)
USE dojo;
SET NAMES utf8mb4;

INSERT INTO parametros (clave, descripcion, tipo_dato, unidad)
  SELECT 'dias_sesion_app', 'Días sin abrir la app antes de pedir la contraseña otra vez (alumnos y responsables)', 'dias', 'días' FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM parametros WHERE clave = 'dias_sesion_app');
INSERT INTO parametro_valores (parametro_id, valor, vigente_desde, modificado_por)
  SELECT p.id, '30', '2026-01-01 00:00:00', (SELECT id FROM usuarios WHERE email = 'admin@dojoos.mx') FROM parametros p
  WHERE p.clave = 'dias_sesion_app' AND NOT EXISTS (SELECT 1 FROM parametro_valores v WHERE v.parametro_id = p.id);

-- Una insignia por cada grado de Taekwondo
INSERT INTO insignias (grado_id, nombre, imagen)
  SELECT g.id, CONCAT('Cinta ', LOWER(COALESCE(g.color_cinta, g.nombre)), ' · ', g.nombre), CONCAT('insignia-', g.orden)
  FROM grados g JOIN disciplinas d ON d.id = g.disciplina_id
  WHERE d.nombre = 'Taekwondo' AND NOT EXISTS (SELECT 1 FROM insignias i WHERE i.grado_id = g.id);

-- Accesorios: grado_id NULL = desde el primer día; si no, se desbloquea al llegar a ese grado (o uno mayor)
INSERT INTO accesorios (nombre, tipo, imagen, grado_id)
  SELECT x.nombre, x.tipo, x.imagen, (SELECT g.id FROM grados g JOIN disciplinas d ON d.id = g.disciplina_id WHERE d.nombre = 'Taekwondo' AND g.orden = x.orden)
  FROM (SELECT 'Banda blanca' nombre, 'cabeza' tipo, 'banda-blanca' imagen, NULL orden
        UNION ALL SELECT 'Banda roja', 'cabeza', 'banda-roja', 2
        UNION ALL SELECT 'Banda azul', 'cabeza', 'banda-azul', 5
        UNION ALL SELECT 'Banda negra', 'cabeza', 'banda-negra', 9
        UNION ALL SELECT 'Banda dorada', 'cabeza', 'banda-dorada', 11
        UNION ALL SELECT 'Dobok blanco', 'torso', 'dobok-blanco', NULL
        UNION ALL SELECT 'Dobok con cuello negro', 'torso', 'dobok-cuello', 7
        UNION ALL SELECT 'Dobok negro', 'torso', 'dobok-negro', 11
        UNION ALL SELECT 'Guantes rojos', 'mano', 'guantes-rojos', 3
        UNION ALL SELECT 'Guantes azules', 'mano', 'guantes-azules', 6
        UNION ALL SELECT 'Protectores de pie', 'pies', 'protector-pie', 4
        UNION ALL SELECT 'Tatami', 'fondo', 'fondo-tatami', NULL
        UNION ALL SELECT 'Atardecer', 'fondo', 'fondo-atardecer', 3
        UNION ALL SELECT 'Montaña', 'fondo', 'fondo-montana', 6
        UNION ALL SELECT 'Noche estrellada', 'fondo', 'fondo-estrellas', 8
        UNION ALL SELECT 'Dragón', 'fondo', 'fondo-dragon', 11) x
  WHERE NOT EXISTS (SELECT 1 FROM accesorios a WHERE a.imagen = x.imagen);
