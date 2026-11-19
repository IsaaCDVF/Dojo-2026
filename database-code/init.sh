#!/bin/sh
# Lo ejecuta el contenedor de MySQL solo la primera vez (volumen vacío).
# Orden: migraciones (estructura) y después semillas (catálogos y demo).
set -e
for f in /dojo-db/migraciones/*.sql /dojo-db/semillas/*.sql; do
  echo "Ejecutando $f"
  mysql -uroot -p"$MYSQL_ROOT_PASSWORD" < "$f"
done
