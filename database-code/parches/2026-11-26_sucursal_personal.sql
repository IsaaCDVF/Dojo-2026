-- Parche para una base que YA existe: teléfono de la sucursal y contraseña temporal del personal (migración 012).
-- Se puede correr más de una vez (revisa si las columnas ya están).
-- Uso: docker compose exec -T db sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" dojo' < database-code/parches/2026-11-26_sucursal_personal.sql
USE dojo;

SET @hay := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = 'dojo' AND TABLE_NAME = 'sucursales' AND COLUMN_NAME = 'telefono');
SET @sql := IF(@hay = 0, 'ALTER TABLE sucursales ADD COLUMN telefono CHAR(10) NULL COMMENT ''Teléfono de la sucursal (10 dígitos)'' AFTER nombre', 'SELECT ''sucursales.telefono ya existe''');
PREPARE p FROM @sql; EXECUTE p; DEALLOCATE PREPARE p;

SET @hay := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = 'dojo' AND TABLE_NAME = 'usuarios' AND COLUMN_NAME = 'debe_cambiar_password');
SET @sql := IF(@hay = 0, 'ALTER TABLE usuarios ADD COLUMN debe_cambiar_password BOOLEAN NOT NULL DEFAULT FALSE COMMENT ''Entró con contraseña temporal: la API solo le deja cambiarla hasta que lo haga'' AFTER password_hash', 'SELECT ''usuarios.debe_cambiar_password ya existe''');
PREPARE p FROM @sql; EXECUTE p; DEALLOCATE PREPARE p;
