-- Dojo OS · 011_marca_fuente_nombre · el nombre comercial puede llevar su propia letra (como en su logo)
USE dojo;
ALTER TABLE marca ADD COLUMN fuente_nombre VARCHAR(20) NOT NULL DEFAULT 'igual'
  COMMENT 'igual = la misma del sistema; oswald, bebas, archivo, russo, playfair, marker' AFTER fuente;
