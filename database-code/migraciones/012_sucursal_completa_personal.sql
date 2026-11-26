-- Dojo OS · 012 · Sucursal completa y alta de personal
-- Una sucursal nueva se da de alta con su teléfono, domicilio, disciplinas y encargado.
-- El personal que da de alta el súper admin (o el admin de su sucursal) entra con una contraseña temporal
-- y la cambia la primera vez.
USE dojo;

ALTER TABLE sucursales
  ADD COLUMN telefono CHAR(10) NULL COMMENT 'Teléfono de la sucursal (10 dígitos)' AFTER nombre;

ALTER TABLE usuarios
  ADD COLUMN debe_cambiar_password BOOLEAN NOT NULL DEFAULT FALSE
  COMMENT 'Entró con contraseña temporal: la API solo le deja cambiarla hasta que lo haga' AFTER password_hash;
