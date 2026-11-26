-- Parche para una base que YA existe: marca blanca (logo, tema, letra, idioma) y preferencias por usuario.
-- Se puede correr más de una vez.
-- Uso: docker compose exec -T db sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" dojo' < database-code/parches/2026-11-26_marca.sql
USE dojo;

CREATE TABLE IF NOT EXISTS marca (
  id             TINYINT PRIMARY KEY DEFAULT 1 COMMENT 'Una sola fila por instalación. En SaaS se cambia por empresa_id',
  nombre         VARCHAR(80) NOT NULL DEFAULT 'Dojo OS' COMMENT 'Nombre comercial: login, menú, recibos, credenciales, app',
  lema           VARCHAR(120) NULL,
  tema           VARCHAR(20) NOT NULL DEFAULT 'oceano' COMMENT 'Tema listo (oceano, dojo, bosque, grafito, ciruela, atardecer) o personalizado',
  color_primario CHAR(7) NULL COMMENT 'Solo con tema personalizado: botones y resaltados (#rrggbb)',
  color_fondo    CHAR(7) NULL COMMENT 'Solo con tema personalizado: tono del fondo en modo oscuro y del menú',
  fuente         VARCHAR(20) NOT NULL DEFAULT 'dm-sans',
  idioma         VARCHAR(5) NOT NULL DEFAULT 'es-MX' COMMENT 'Idioma por defecto; cada usuario puede elegir otro',
  moneda         CHAR(3) NOT NULL DEFAULT 'MXN',
  zona_horaria   VARCHAR(40) NOT NULL DEFAULT 'America/Mexico_City',
  pais           CHAR(2) NOT NULL DEFAULT 'MX',
  actualizado    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  actualizado_por INT NULL,
  FOREIGN KEY (actualizado_por) REFERENCES usuarios(id)
) ENGINE=InnoDB COMMENT='Marca blanca: nombre, tema, letra y región de la empresa que compró el sistema';

CREATE TABLE IF NOT EXISTS marca_imagenes (
  tipo        ENUM('logo','logo_oscuro','icono') PRIMARY KEY COMMENT 'logo = para fondo claro; logo_oscuro = para fondo oscuro; icono = cuadrado (app, pestaña)',
  mime        VARCHAR(30) NOT NULL,
  datos       MEDIUMBLOB NOT NULL,
  actualizado DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB COMMENT='Logos de la marca en la base de datos (se respaldan junto con todo lo demás)';

CREATE TABLE IF NOT EXISTS usuario_preferencias (
  usuario_id  INT PRIMARY KEY,
  idioma      VARCHAR(5) NULL COMMENT 'NULL = el de la empresa',
  tema        ENUM('sistema','claro','oscuro') NOT NULL DEFAULT 'sistema',
  letra       ENUM('normal','grande','muy_grande') NOT NULL DEFAULT 'normal',
  actualizado DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
) ENGINE=InnoDB;

INSERT IGNORE INTO marca (id) VALUES (1);
INSERT IGNORE INTO permisos (clave, modulo, descripcion, nivel_minimo) VALUES ('marca.editar', 'sistema', 'Cambiar logo, colores, letra e idioma del sistema', 5);
INSERT IGNORE INTO rol_permisos (rol_id, permiso_id) SELECT r.id, p.id FROM roles r, permisos p WHERE r.nombre = 'super_admin' AND p.clave = 'marca.editar';
