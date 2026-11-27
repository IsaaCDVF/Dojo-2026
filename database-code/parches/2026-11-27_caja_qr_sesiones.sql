-- Parche para una base que YA existe: cobro con QR en caja y equipos con sesión (migración 016). OBLIGATORIO. Se puede correr más de una vez.
-- Uso: docker compose exec -T db sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" dojo' < database-code/parches/2026-11-27_caja_qr_sesiones.sql
USE dojo;
SET NAMES utf8mb4;

SET @falta := (SELECT COUNT(*) = 0 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = 'dojo' AND TABLE_NAME = 'pagos_en_linea' AND COLUMN_NAME = 'canal');
SET @sql := IF(@falta, 'ALTER TABLE pagos_en_linea ADD COLUMN canal ENUM(''app'',''caja'') NOT NULL DEFAULT ''app'' COMMENT ''app = lo pagó desde la app; caja = recepción le mostró un QR'' AFTER origen', 'SELECT 1');
PREPARE p FROM @sql; EXECUTE p; DEALLOCATE PREPARE p;

SET @falta := (SELECT COUNT(*) = 0 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = 'dojo' AND TABLE_NAME = 'sesiones' AND COLUMN_NAME = 'dispositivo');
SET @sql := IF(@falta, 'ALTER TABLE sesiones ADD COLUMN dispositivo VARCHAR(160) NULL COMMENT ''Navegador y sistema desde donde entró (User-Agent recortado)'' AFTER ip', 'SELECT 1');
PREPARE p FROM @sql; EXECUTE p; DEALLOCATE PREPARE p;
