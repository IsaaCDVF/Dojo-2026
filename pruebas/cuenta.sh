#!/usr/bin/env bash
# Pruebas de Mi cuenta (panel y app): datos personales, equipos con sesión abierta y ayuda.
# Uso: ./pruebas/cuenta.sh [http://localhost:8080]. Crea su propia persona de recepción y al final la desactiva.
API=${1:-http://localhost:8080}
pasa=0; falla=0
prueba() { local cod; cod=$(curl -s -o /tmp/r.json -w '%{http_code}' -X "$3" "$API$4" -H 'Content-Type: application/json' ${5:+-H "Authorization: Bearer $5"} ${6:+-d "$6"} "${@:7}")
  if [ "$cod" = "$2" ]; then pasa=$((pasa+1)); echo "  ok   $1 ($cod)"; else falla=$((falla+1)); echo "  FALLA $1: esperaba $2, llegó $cod → $(head -c 300 /tmp/r.json)"; fi; }
campo() { php -r '$j=json_decode(file_get_contents("/tmp/r.json"),true); $e=$argv[1]; echo eval("return ".($e[0]==="[" ? "\$j$e" : $e).";");' -- "$1"; }
igual() { local v; v=$(campo "$2"); if [ "$v" = "$3" ]; then pasa=$((pasa+1)); echo "  ok   $1 ($v)"; else falla=$((falla+1)); echo "  FALLA $1: esperaba $3, llegó $v"; fi; }
R=$RANDOM; CORREO="cuenta$R@prueba.mx"; NUEVO="cuenta$R.nuevo@prueba.mx"
CHROME='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36'
ANDROID='Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36'

prueba "Login súper admin"                   200 POST /api/auth/login "" '{"email":"admin@dojoos.mx","password":"Dojo2026!"}'; ADM=$(campo "['datos']['token']")
prueba "Sucursales"                          200 GET  /api/sucursales "$ADM"; CENT=$(campo "array_column(\$j['datos'], 'id', 'clave')['CENT']")
prueba "Alta de Iris (recepción)"            201 POST /api/personal "$ADM" "{\"nombre\":\"Iris\",\"apellido_paterno\":\"Cuenta$R\",\"fecha_nacimiento\":\"1997-06-01\",\"email\":\"$CORREO\",\"roles\":[{\"rol\":\"recepcion\",\"sucursal_id\":$CENT}]}"
IID=$(campo "['datos']['usuario_id']"); TEMP=$(campo "['datos']['password_temporal']")
prueba "Entra con la temporal"               200 POST /api/auth/login "" "{\"email\":\"$CORREO\",\"password\":\"$TEMP\"}"; T0=$(campo "['datos']['token']")
prueba "Crea su contraseña"                  200 PUT  /api/auth/contrasena "$T0" "{\"actual\":\"$TEMP\",\"nueva\":\"Iris2026x\"}"
prueba "Entra desde Chrome en Windows"       200 POST /api/auth/login "" "{\"email\":\"$CORREO\",\"password\":\"Iris2026x\"}" -A "$CHROME"; PC=$(campo "['datos']['token']")
prueba "Y desde su celular"                  200 POST /api/auth/login "" "{\"email\":\"$CORREO\",\"password\":\"Iris2026x\"}" -A "$ANDROID"; CEL=$(campo "['datos']['token']")

echo "Datos personales"
prueba "Sus datos"                           200 GET  /api/auth/perfil "$PC"
igual  "Nombre y correo"                     "\$j['datos']['nombre'] . ' ' . \$j['datos']['email']" "Iris $CORREO"
igual  "Sus accesos"                         "implode(',', array_column(\$j['datos']['roles'], 'rol'))" "recepcion"
prueba "Teléfono incompleto"                 422 PUT  /api/auth/perfil "$PC" '{"telefono":"2225"}'
prueba "Pone su teléfono"                    200 PUT  /api/auth/perfil "$PC" "{\"telefono\":\"222 555 $(printf '%04d' $((R%10000)))\"}"
igual  "Guardado limpio"                     "strlen(\$j['datos']['telefono'])" "10"
prueba "Lo mismo otra vez: nada que cambiar" 422 PUT  /api/auth/perfil "$PC" "{\"telefono\":\"222555$(printf '%04d' $((R%10000)))\"}"
prueba "Correo sin contraseña"               422 PUT  /api/auth/perfil "$PC" "{\"email\":\"$NUEVO\"}"
igual  "Pide la contraseña"                  "['detalle']['campo']" "password"
prueba "Correo de otra cuenta"               409 PUT  /api/auth/perfil "$PC" '{"email":"admin@dojoos.mx","password":"Iris2026x"}'
prueba "Correo vacío"                        422 PUT  /api/auth/perfil "$PC" '{"email":""}'
prueba "Cambia su correo"                    200 PUT  /api/auth/perfil "$PC" "{\"email\":\"$NUEVO\",\"password\":\"Iris2026x\"}"
prueba "Entra con el nuevo"                  200 POST /api/auth/login "" "{\"email\":\"$NUEVO\",\"password\":\"Iris2026x\"}"; T3=$(campo "['datos']['token']")
prueba "Con el viejo ya no"                  401 POST /api/auth/login "" "{\"email\":\"$CORREO\",\"password\":\"Iris2026x\"}"

echo "Seguridad: equipos con sesión"
prueba "Sus sesiones"                        200 GET  /api/auth/sesiones "$PC"
igual  "Cuatro abiertas (la de la temporal, la compu, el celular y la del correo nuevo)" "count(\$j['datos'])" "4"
igual  "Chrome · Windows es este"            "implode(',', array_column(array_filter(\$j['datos'], fn(\$s) => \$s['actual']), 'equipo'))" "Chrome · Windows"
igual  "Ve su celular"                       "count(array_filter(\$j['datos'], fn(\$s) => \$s['equipo'] === 'Chrome · Android'))" "1"
SCEL=$(campo "array_values(array_filter(\$j['datos'], fn(\$s) => \$s['equipo'] === 'Chrome · Android'))[0]['id']")
SPC=$(campo "array_values(array_filter(\$j['datos'], fn(\$s) => \$s['actual']))[0]['id']")
prueba "No cierra la de este equipo así"     422 POST /api/auth/sesiones/cerrar "$PC" "{\"id\":$SPC}"
prueba "Cierra la del celular"               200 POST /api/auth/sesiones/cerrar "$PC" "{\"id\":$SCEL}"
prueba "El celular quedó fuera"              401 GET  /api/auth/yo "$CEL"
prueba "Cerrarla otra vez"                   404 POST /api/auth/sesiones/cerrar "$PC" "{\"id\":$SCEL}"
prueba "Sesión de otra persona"              404 POST /api/auth/sesiones/cerrar "$PC" '{"id":1}'
prueba "Cierra todas las demás"              200 POST /api/auth/sesiones/cerrar "$PC" '{}'
igual  "Las otras dos"                       "['datos']['cerradas']" "2"
prueba "La otra quedó fuera"                 401 GET  /api/auth/yo "$T3"
prueba "Esta sigue"                          200 GET  /api/auth/yo "$PC"

echo "Dejar todo como estaba"
prueba "Desactiva a Iris"                    200 PUT  "/api/personal/$IID" "$ADM" '{"activo":0}'
prueba "Sus sesiones se cerraron"            401 GET  /api/auth/yo "$PC"

echo; echo "Resultado: $pasa pasaron, $falla fallaron"; [ $falla -eq 0 ]
