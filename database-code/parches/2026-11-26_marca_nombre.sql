-- Parche para una base que YA existe: letra propia para el nombre comercial.
-- Se puede correr más de una vez (revisa si la columna ya está).
-- Uso: docker compose exec -T db sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" dojo' < database-code/parches/2026-11-26_marca_nombre.sql
USE dojo;
SET @hay := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = 'dojo' AND TABLE_NAME = 'marca' AND COLUMN_NAME = 'fuente_nombre');
SET @sql := IF(@hay = 0,
  'ALTER TABLE marca ADD COLUMN fuente_nombre VARCHAR(20) NOT NULL DEFAULT ''igual'' COMMENT ''igual = la misma del sistema; oswald, bebas, archivo, russo, playfair, marker'' AFTER fuente',
  'SELECT ''fuente_nombre ya existe''');
PREPARE p FROM @sql; EXECUTE p; DEALLOCATE PREPARE p;
