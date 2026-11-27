-- Parche para una base que YA existe (init.sh solo corre migraciones y semillas la primera vez).
-- App móvil: tabla de códigos de activación, parámetro dias_sesion_app, insignias y accesorios del avatar.
-- Se puede correr más de una vez sin duplicar nada.
-- Uso: docker compose exec -T db sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" dojo' < database-code/parches/2026-11-25_app_movil.sql
USE dojo;

CREATE TABLE IF NOT EXISTS activaciones (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id   INT NOT NULL,
  codigo_hash  VARCHAR(255) NOT NULL COMMENT 'Código de 6 dígitos cifrado; se entrega por WhatsApp en recepción',
  expira       DATETIME NOT NULL,
  usada        DATETIME NULL,
  intentos     TINYINT NOT NULL DEFAULT 0 COMMENT 'Tras 5 intentos fallidos el código deja de servir',
  creada_por   INT NOT NULL,
  creada       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  FOREIGN KEY (creada_por) REFERENCES usuarios(id)
) ENGINE=InnoDB COMMENT='Recepción da el acceso a la app: el alumno o responsable activa con el código y pone su contraseña';

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
