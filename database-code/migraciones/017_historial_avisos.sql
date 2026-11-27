-- Dojo OS · 017 · Historial de avisos: por qué un aviso no salió (para mostrarlo en palabras normales)
USE dojo;

ALTER TABLE notificaciones
  ADD COLUMN motivo VARCHAR(20) NULL COMMENT 'Si no salió: sin_celular (no activó notificaciones) · ya_no_aplica (ya pagó / ya vino) · vencido (nadie lo mandó en 7 días) · recepcion (decidieron no mandarlo)' AFTER estado,
  ADD INDEX idx_notificacion_fecha (fecha_programada);
