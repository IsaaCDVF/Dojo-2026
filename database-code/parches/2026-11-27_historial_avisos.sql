-- Parche para una base que YA existe: historial de avisos (migración 017). OBLIGATORIO. Se puede correr más de una vez.
-- Uso: docker compose exec -T db sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" dojo' < database-code/parches/2026-11-27_historial_avisos.sql
USE dojo;
SET NAMES utf8mb4;

SET @falta := (SELECT COUNT(*) = 0 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = 'dojo' AND TABLE_NAME = 'notificaciones' AND COLUMN_NAME = 'motivo');
SET @sql := IF(@falta, 'ALTER TABLE notificaciones ADD COLUMN motivo VARCHAR(20) NULL COMMENT ''Si no salió: sin_celular · ya_no_aplica · vencido · recepcion'' AFTER estado, ADD INDEX idx_notificacion_fecha (fecha_programada)', 'SELECT 1');
PREPARE p FROM @sql; EXECUTE p; DEALLOCATE PREPARE p;

-- Los avisos de la app que ya existían sin celular suscrito
UPDATE notificaciones n JOIN plantillas_notificacion p ON p.id = n.plantilla_id SET n.motivo = 'sin_celular'
  WHERE p.canal = 'app' AND n.estado = 'omitida' AND n.motivo IS NULL;
