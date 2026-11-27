-- Dojo OS · 016 · Cobro con QR en caja y equipos con sesión abierta (Mi cuenta → Seguridad).
-- Distingue de dónde salió cada pago en línea (la app de la familia o la caja).
USE dojo;

ALTER TABLE pagos_en_linea
  ADD COLUMN canal ENUM('app','caja') NOT NULL DEFAULT 'app' COMMENT 'app = lo pagó desde la app; caja = recepción le mostró un QR' AFTER origen;

-- Mi cuenta → Seguridad: ver en qué equipos está abierta tu sesión y cerrarlas
ALTER TABLE sesiones
  ADD COLUMN dispositivo VARCHAR(160) NULL COMMENT 'Navegador y sistema desde donde entró (User-Agent recortado)' AFTER ip;
