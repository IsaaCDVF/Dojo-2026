-- Parche para una base que YA existe (init.sh solo corre las semillas la primera vez).
-- Crea el usuario de la tableta de Centro: tableta.centro@dojoos.mx / Dojo2026!
-- Uso: docker compose exec -T db sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" dojo' < database-code/parches/2026-11-24_usuario_tableta.sql
USE dojo;
SET NAMES utf8mb4;
INSERT INTO personas (nombre, apellido_paterno, fecha_nacimiento)
  SELECT 'Tableta','Centro','2000-01-01' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM usuarios WHERE email='tableta.centro@dojoos.mx');
INSERT INTO usuarios (persona_id, email, password_hash)
  SELECT LAST_INSERT_ID(), 'tableta.centro@dojoos.mx', '$2y$10$IKLlkoO0VtYbYtsUYPd.KOGsCOygwlWhgdY91MH12K83XGa5gfMKq' FROM DUAL
  WHERE ROW_COUNT() > 0;
INSERT INTO usuario_roles (usuario_id, rol_id, sucursal_id)
  SELECT u.id, r.id, s.id FROM usuarios u, roles r, sucursales s
  WHERE u.email='tableta.centro@dojoos.mx' AND r.nombre='tableta' AND s.clave='CENT'
    AND NOT EXISTS (SELECT 1 FROM usuario_roles ur WHERE ur.usuario_id = u.id);
