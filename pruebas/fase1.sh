#!/usr/bin/env bash
# Pruebas de la Fase 1 contra la API. Uso: ./pruebas/fase1.sh [http://localhost:8080]
# Requiere la base con migraciones + semillas (001_catalogos y 002_demo).
API=${1:-http://localhost:8080}
pasa=0; falla=0
prueba() { # nombre, código esperado, método, ruta, token, cuerpo
  local cod; cod=$(curl -s -o /tmp/r.json -w '%{http_code}' -X "$3" "$API$4" -H 'Content-Type: application/json' ${5:+-H "Authorization: Bearer $5"} ${6:+-d "$6"})
  if [ "$cod" = "$2" ]; then pasa=$((pasa+1)); echo "  ok   $1 ($cod)"; else falla=$((falla+1)); echo "  FALLA $1: esperaba $2, llegó $cod → $(cat /tmp/r.json)"; fi
}
campo() { php -r '$j=json_decode(file_get_contents("/tmp/r.json"),true); echo eval("return \$j$argv[1];");' -- "$1"; }

echo "Salud y acceso"
prueba "API responde"                     200 GET  /api/salud
prueba "Ruta inexistente"                 404 GET  /api/nada
prueba "Sin sesión no entra"              401 GET  /api/sucursales
prueba "Contraseña incorrecta"            401 POST /api/auth/login "" '{"email":"admin@dojoos.mx","password":"mal"}'
prueba "Faltan datos"                     422 POST /api/auth/login "" '{"email":"admin@dojoos.mx"}'
prueba "Login súper admin"                200 POST /api/auth/login "" '{"email":"admin@dojoos.mx","password":"Dojo2026!"}'
ADM=$(campo "['datos']['token']")
prueba "Yo (súper admin)"                 200 GET  /api/auth/yo "$ADM"

echo "Catálogos con bitácora"
CL=$(php -r 'echo substr(str_shuffle("ABCDEFGHIJKLMNOPQRSTUVWXYZ"),0,4);')
prueba "Alta de sucursal"                 201 POST /api/sucursales "$ADM" "{\"clave\":\"$CL\",\"nombre\":\"Sucursal $CL\"}"
SID=$(campo "['datos']['id']")
prueba "Clave repetida"                   409 POST /api/sucursales "$ADM" "{\"clave\":\"$CL\",\"nombre\":\"Otra\"}"
prueba "Clave inválida"                   422 POST /api/sucursales "$ADM" '{"clave":"AB1","nombre":"X"}'
prueba "Cambio de sucursal"               200 PUT  /api/sucursales/$SID "$ADM" "{\"nombre\":\"Sucursal $CL Sur\"}"
prueba "Bitácora del cambio"              200 GET  "/api/bitacora?tabla=sucursales&registro_id=$SID" "$ADM"
[ "$(campo "['datos'][0]['valor_anterior']")" = "Sucursal $CL" ] && { pasa=$((pasa+1)); echo "  ok   La bitácora guarda el valor anterior"; } || { falla=$((falla+1)); echo "  FALLA valor anterior"; }
prueba "Grados de Taekwondo"              200 GET  /api/disciplinas/1/grados "$ADM"
prueba "Parámetros vigentes"              200 GET  /api/parametros "$ADM"

echo "Varios roles y permisos por sucursal"
prueba "Login con dos roles"              200 POST /api/auth/login "" '{"email":"laura@dojoos.mx","password":"Dojo2026!"}'
LAU=$(campo "['datos']['token']"); INST=$(campo "['datos']['roles'][1]['usuario_rol_id']"); ADMN=$(campo "['datos']['roles'][0]['usuario_rol_id']")
prueba "Sin elegir rol no puede"          409 GET  /api/sucursales "$LAU"
prueba "Elige rol instructor"             200 POST /api/auth/rol "$LAU" "{\"usuario_rol_id\":$INST}"
prueba "Instructor no ve parámetros"      403 GET  /api/parametros "$LAU"
prueba "Instructor no crea sucursales"    403 POST /api/sucursales "$LAU" '{"clave":"ZZZZ","nombre":"Z"}'
prueba "Cambia a admin de sucursal"       200 POST /api/auth/rol "$LAU" "{\"usuario_rol_id\":$ADMN}"
prueba "Admin ve solo su sucursal"        200 GET  /api/sucursales "$LAU"
[ "$(php -r 'echo count(json_decode(file_get_contents("/tmp/r.json"),true)["datos"]);')" = "1" ] && { pasa=$((pasa+1)); echo "  ok   Solo aparece una sucursal"; } || { falla=$((falla+1)); echo "  FALLA alcance por sucursal"; }
prueba "Rol ajeno rechazado"              403 POST /api/auth/rol "$LAU" '{"usuario_rol_id":1}'
prueba "Cerrar sesión"                    200 POST /api/auth/logout "$LAU"
prueba "Token cerrado ya no sirve"        401 GET  /api/auth/yo "$LAU"

echo; echo "Resultado: $pasa pasaron, $falla fallaron"; [ $falla -eq 0 ]
