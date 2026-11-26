#!/usr/bin/env bash
# Pruebas de marca blanca (logo, tema, letra, idioma) y preferencias por usuario.
# Uso: ./pruebas/marca.sh [http://localhost:8080]. Al final deja la marca como estaba (Dojo OS, tema océano, sin logos).
API=${1:-http://localhost:8080}
pasa=0; falla=0
prueba() { local cod; cod=$(curl -s -o /tmp/r.json -w '%{http_code}' -X "$3" "$API$4" -H 'Content-Type: application/json' ${5:+-H "Authorization: Bearer $5"} ${6:+-d "$6"})
  if [ "$cod" = "$2" ]; then pasa=$((pasa+1)); echo "  ok   $1 ($cod)"; else falla=$((falla+1)); echo "  FALLA $1: esperaba $2, llegó $cod → $(head -c 300 /tmp/r.json)"; fi; }
campo() { php -r '$j=json_decode(file_get_contents("/tmp/r.json"),true); $e=$argv[1]; echo eval("return ".($e[0]==="[" ? "\$j$e" : $e).";");' -- "$1"; }
igual() { local v; v=$(campo "$2"); if [ "$v" = "$3" ]; then pasa=$((pasa+1)); echo "  ok   $1 ($v)"; else falla=$((falla+1)); echo "  FALLA $1: esperaba $3, llegó $v"; fi; }
entra() { prueba "$1" 200 POST /api/auth/login "" "{\"email\":\"$2\",\"password\":\"$3\"}"; }
# PNG de 1×1 y dos SVG: uno limpio y uno con código
PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
SVG="data:image/svg+xml;base64,$(printf '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="#c00"/></svg>' | base64 -w0)"
MALO="data:image/svg+xml;base64,$(printf '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(1)</script></svg>' | base64 -w0)"
printf '{"imagen":"data:image/png;base64,%s"}' "$(head -c 600000 /dev/urandom | base64 -w0)" > /tmp/grande.json   # se manda desde archivo: no cabe en la línea de comandos

echo "Marca pública"
prueba "Sin sesión se puede leer"          200 GET  /api/marca
igual  "Por defecto Dojo OS"               "['datos']['nombre']" "Dojo OS"
igual  "Tema océano"                       "['datos']['tema']" "oceano"
prueba "Sin sesión no se cambia"           401 PUT  /api/marca "" '{"nombre":"X"}'
entra "Login súper admin" admin@dojoos.mx 'Dojo2026!'; ADM=$(campo "['datos']['token']")
entra "Login Laura" laura@dojoos.mx 'Dojo2026!'; LAU=$(campo "['datos']['token']")
prueba "Roles de Laura"                    200 GET  /api/auth/yo "$LAU"
INST=$(campo "array_column(\$j['datos']['roles'], 'usuario_rol_id', 'rol')['instructor']")
prueba "Laura como instructora"            200 POST /api/auth/rol "$LAU" "{\"usuario_rol_id\":$INST}"
prueba "El instructor no cambia la marca"  403 PUT  /api/marca "$LAU" '{"nombre":"X"}'

echo "Cambiar la marca"
prueba "Nada que cambiar"                  422 PUT  /api/marca "$ADM" '{"otra":"cosa"}'
prueba "Nombre vacío"                      422 PUT  /api/marca "$ADM" '{"nombre":"  "}'
prueba "Tema que no existe"                422 PUT  /api/marca "$ADM" '{"tema":"arcoiris"}'
prueba "Personalizado sin color"           422 PUT  /api/marca "$ADM" '{"tema":"personalizado"}'
prueba "Color mal escrito"                 422 PUT  /api/marca "$ADM" '{"tema":"personalizado","color_primario":"rojo"}'
prueba "Fuente que no existe"              422 PUT  /api/marca "$ADM" '{"fuente":"comic-sans"}'
prueba "Zona horaria inventada"            422 PUT  /api/marca "$ADM" '{"zona_horaria":"Marte/Olympus"}'
prueba "Moneda que no se maneja"           422 PUT  /api/marca "$ADM" '{"moneda":"BTC"}'
prueba "Dojo Águilas en rojo, Montserrat"  200 PUT  /api/marca "$ADM" '{"nombre":"Dojo Águilas","lema":"Disciplina y respeto","tema":"personalizado","color_primario":"#D62828","color_fondo":"#1a1a2e","fuente":"montserrat"}'
igual  "Se guardó el nombre"               "['datos']['nombre']" "Dojo Águilas"
igual  "Color en minúsculas"               "['datos']['color_primario']" "#d62828"
prueba "Para Estados Unidos"               200 PUT  /api/marca "$ADM" '{"idioma":"en-US","moneda":"USD","zona_horaria":"America/Los_Angeles","pais":"US"}'
igual  "Idioma y moneda"                   "\$j['datos']['idioma'] . ' ' . \$j['datos']['moneda']" "en-US USD"
prueba "Queda en la bitácora"              200 GET  "/api/bitacora?tabla=marca" "$ADM"
igual  "Cambio de nombre registrado"       "count(array_filter(\$j['datos']['filas'] ?? \$j['datos'], fn(\$f) => (\$f['campo'] ?? '') === 'nombre')) > 0 ? 'si' : 'no'" "si"

echo "Logos"
prueba "Tipo de imagen inventado"          404 PUT  /api/marca/imagen/fondo "$ADM" "{\"imagen\":\"$PNG\"}"
prueba "No es imagen"                      422 PUT  /api/marca/imagen/logo "$ADM" '{"imagen":"data:text/plain;base64,aG9sYQ=="}'
prueba "SVG con código"                    422 PUT  /api/marca/imagen/logo "$ADM" "{\"imagen\":\"$MALO\"}"
prueba "Más de 512 KB"                     422 PUT  /api/marca/imagen/logo "$ADM" @/tmp/grande.json
prueba "Logo en SVG limpio"                200 PUT  /api/marca/imagen/logo "$ADM" "{\"imagen\":\"$SVG\"}"
prueba "Ícono en PNG"                      200 PUT  /api/marca/imagen/icono "$ADM" "{\"imagen\":\"$PNG\"}"
igual  "Trae las direcciones"              "(\$j['datos']['imagenes']['logo'] ? 'logo' : '') . (\$j['datos']['imagenes']['icono'] ? '+icono' : '') . (\$j['datos']['imagenes']['logo_oscuro'] ? '+oscuro' : '')" "logo+icono"
CT=$(curl -s -o /dev/null -w '%{content_type}' "$API/api/marca/imagen/logo")
if [ "$CT" = "image/svg+xml" ]; then pasa=$((pasa+1)); echo "  ok   El logo se sirve como SVG ($CT)"; else falla=$((falla+1)); echo "  FALLA El logo debía ser image/svg+xml, llegó $CT"; fi
CSP=$(curl -s -D - -o /dev/null "$API/api/marca/imagen/logo" | grep -ci "content-security-policy: default-src 'none'")
if [ "$CSP" = "1" ]; then pasa=$((pasa+1)); echo "  ok   El SVG se sirve sin permiso de ejecutar nada"; else falla=$((falla+1)); echo "  FALLA Falta la cabecera CSP del SVG"; fi
prueba "Manifest de la app"                200 GET  /api/marca/manifest/app
NOM=$(php -r '$j=json_decode(file_get_contents("/tmp/r.json"),true); echo $j["name"] . "|" . $j["icons"][0]["sizes"] . "|" . $j["start_url"];')
if [ "$NOM" = "Dojo Águilas|any|/app/" ]; then pasa=$((pasa+1)); echo "  ok   Manifest con nombre e ícono ($NOM)"; else falla=$((falla+1)); echo "  FALLA Manifest: $NOM"; fi
prueba "Quitar el logo"                    200 DELETE /api/marca/imagen/logo "$ADM"
igual  "Sin logo"                          "\$j['datos']['imagenes']['logo'] === null ? 'si' : 'no'" "si"
prueba "Ya no existe"                      404 GET  /api/marca/imagen/logo

echo "Preferencias por usuario"
prueba "Por defecto"                       200 GET  /api/preferencias "$LAU"
igual  "Tema del sistema, letra normal"    "\$j['datos']['tema'] . ' ' . \$j['datos']['letra'] . ' ' . var_export(\$j['datos']['idioma'], true)" "sistema normal NULL"
prueba "Sin sesión"                        401 GET  /api/preferencias
prueba "Idioma que no hay"                 422 PUT  /api/preferencias "$LAU" '{"idioma":"fr-FR"}'
prueba "Tema raro"                         422 PUT  /api/preferencias "$LAU" '{"tema":"neon"}'
prueba "Laura: inglés, oscuro, letra grande" 200 PUT /api/preferencias "$LAU" '{"idioma":"en-US","tema":"oscuro","letra":"grande"}'
prueba "Solo cambia la letra"              200 PUT  /api/preferencias "$LAU" '{"letra":"muy_grande"}'
igual  "Lo demás se queda"                 "\$j['datos']['idioma'] . ' ' . \$j['datos']['tema'] . ' ' . \$j['datos']['letra']" "en-US oscuro muy_grande"
prueba "Vienen en /auth/yo"                200 GET  /api/auth/yo "$LAU"
igual  "Preferencias de Laura"             "['datos']['preferencias']['tema']" "oscuro"
prueba "El admin sigue con las suyas"      200 GET  /api/preferencias "$ADM"
igual  "Sin cambios"                       "['datos']['tema']" "sistema"
prueba "Laura vuelve al idioma de la empresa" 200 PUT /api/preferencias "$LAU" '{"idioma":null,"tema":"sistema","letra":"normal"}'

echo "Dejar todo como estaba"
prueba "Marca de fábrica"                  200 PUT  /api/marca "$ADM" '{"nombre":"Dojo OS","lema":null,"tema":"oceano","color_primario":null,"color_fondo":null,"fuente":"dm-sans","idioma":"es-MX","moneda":"MXN","zona_horaria":"America/Mexico_City","pais":"MX"}'
prueba "Sin ícono"                         200 DELETE /api/marca/imagen/icono "$ADM"

echo; echo "Resultado: $pasa pasaron, $falla fallaron"; [ $falla -eq 0 ]
