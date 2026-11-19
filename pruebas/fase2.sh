#!/usr/bin/env bash
# Pruebas de la fase 2 · 2.2 Parámetros. Uso: ./pruebas/fase2.sh [http://localhost:8080]
API=${1:-http://localhost:8080}
pasa=0; falla=0
prueba() { local cod; cod=$(curl -s -o /tmp/r.json -w '%{http_code}' -X "$3" "$API$4" -H 'Content-Type: application/json' ${5:+-H "Authorization: Bearer $5"} ${6:+-d "$6"})
  if [ "$cod" = "$2" ]; then pasa=$((pasa+1)); echo "  ok   $1 ($cod)"; else falla=$((falla+1)); echo "  FALLA $1: esperaba $2, llegó $cod → $(cat /tmp/r.json)"; fi; }
campo() { php -r '$j=json_decode(file_get_contents("/tmp/r.json"),true); echo eval("return \$j$argv[1];");' -- "$1"; }

echo "Guardar valores con vigencia"
prueba "Login súper admin"             200 POST /api/auth/login "" '{"email":"admin@dojoos.mx","password":"Dojo2026!"}'
ADM=$(campo "['datos']['token']")
prueba "Guardar 25 min en Centro"      201 POST /api/parametros/valores "$ADM" '{"clave":"minutos_retardo","valor":"25","sucursal_id":1}'
prueba "Cambiar a 10 min en Centro"    201 POST /api/parametros/valores "$ADM" '{"clave":"minutos_retardo","valor":"10","sucursal_id":1}'
[ "$(campo "['datos']['anterior']")" = "25" ] && { pasa=$((pasa+1)); echo "  ok   Regresa el valor anterior"; } || { falla=$((falla+1)); echo "  FALLA valor anterior"; }
prueba "Decimal en minutos"            422 POST /api/parametros/valores "$ADM" '{"clave":"minutos_retardo","valor":"15.5"}'
prueba "Porcentaje mayor a 100"        422 POST /api/parametros/valores "$ADM" '{"clave":"asistencia_minima_examen","valor":"150"}'
prueba "Clave inexistente"             404 POST /api/parametros/valores "$ADM" '{"clave":"no_existe","valor":"1"}'
prueba "Faltan datos"                  422 POST /api/parametros/valores "$ADM" '{"clave":"minutos_retardo"}'

echo "Historial"
prueba "Historial de retardo"          200 GET  "/api/parametros/historial?clave=minutos_retardo" "$ADM"
[ "$(campo "['datos']['historial'][0]['valor']")" = "10" ] && { pasa=$((pasa+1)); echo "  ok   El más nuevo va primero"; } || { falla=$((falla+1)); echo "  FALLA orden del historial"; }
prueba "Historial sin clave"           422 GET  "/api/parametros/historial" "$ADM"

echo "Permisos"
prueba "Login Laura"                   200 POST /api/auth/login "" '{"email":"laura@dojoos.mx","password":"Dojo2026!"}'
LAU=$(campo "['datos']['token']"); ADMN=$(campo "['datos']['roles'][0]['usuario_rol_id']")
prueba "Laura como admin de Norte"     200 POST /api/auth/rol "$LAU" "{\"usuario_rol_id\":$ADMN}"
prueba "Admin de sucursal no edita"    403 POST /api/parametros/valores "$LAU" '{"clave":"minutos_retardo","valor":"5"}'
prueba "Admin de sucursal ve historial" 200 GET "/api/parametros/historial?clave=minutos_retardo" "$LAU"

echo; echo "Resultado: $pasa pasaron, $falla fallaron"; [ $falla -eq 0 ]
