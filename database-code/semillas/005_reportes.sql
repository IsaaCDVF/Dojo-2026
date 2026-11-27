-- Dojo OS · semillas · reportes del dueño (se puede correr más de una vez)
USE dojo;
SET NAMES utf8mb4;
INSERT INTO permisos (clave, modulo, descripcion, nivel_minimo)
  SELECT 'reportes.ver', 'sistema', 'Ver los reportes del negocio (ingresos, alumnos, deuda, asistencia)', 4 FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM permisos WHERE clave = 'reportes.ver');
INSERT IGNORE INTO rol_permisos (rol_id, permiso_id)
  SELECT r.id, p.id FROM roles r JOIN permisos p ON p.clave = 'reportes.ver' WHERE r.nombre IN ('super_admin', 'admin_sucursal');
