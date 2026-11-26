#!/usr/bin/env bash
# Pruebas de la fase 6 · App del alumno y del responsable (acceso desde recepción, activación, portal).
# Uso: ./pruebas/app.sh [http://localhost:8080]. Crea sus propios datos: se puede correr varias veces.
API=${1:-http://localhost:8080}
pasa=0; falla=0
prueba() { local cod; cod=$(curl -s -o /tmp/r.json -w '%{http_code}' -X "$3" "$API$4" -H 'Content-Type: application/json' ${5:+-H "Authorization: Bearer $5"} ${6:+-d "$6"})
  if [ "$cod" = "$2" ]; then pasa=$((pasa+1)); echo "  ok   $1 ($cod)"; else falla=$((falla+1)); echo "  FALLA $1: esperaba $2, llegó $cod → $(head -c 300 /tmp/r.json)"; fi; }
# campo "['datos']['id']" lee una ruta del JSON; campo "count(\$j['datos'])" evalúa una expresión con $j
campo() { php -r '$j=json_decode(file_get_contents("/tmp/r.json"),true); $e=$argv[1]; echo eval("return ".($e[0]==="[" ? "\$j$e" : $e).";");' -- "$1"; }
igual() { local v; v=$(campo "$2"); if [ "$v" = "$3" ]; then pasa=$((pasa+1)); echo "  ok   $1 ($v)"; else falla=$((falla+1)); echo "  FALLA $1: esperaba $3, llegó $v"; fi; }
# CURP válida con letras al azar para no repetir
L=BCDFGHJKLMNPQRSTVWXZ; c() { echo -n "${L:$((RANDOM%20)):1}"; }
curp() { echo "PEGA$1HPL$(c)$(c)$(c)0$((RANDOM%10))"; }
FOTO='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
R=$RANDOM; H=$(printf '%02d' $((RANDOM%10+7)))

TEL="22288$(printf '%05d' $R)"; TEL2="22299$(printf '%05d' $R)"
entra() { prueba "$1" 200 POST /api/auth/login "" "{\"email\":\"$2\",\"password\":\"$3\"}"; }

entra "Login súper admin" admin@dojoos.mx 'Dojo2026!'; ADM=$(campo "['datos']['token']")
prueba "Precio de la mensualidad"          201 POST /api/precios "$ADM" '{"concepto_id":1,"monto":"650"}'
prueba "Precio de la inscripción"          201 POST /api/precios "$ADM" '{"concepto_id":2,"monto":"500"}'
prueba "Grados de Taekwondo"               200 GET  /api/disciplinas/1/grados "$ADM"
G3=$(campo "['datos'][2]['id']")
prueba "Horario de lunes en Centro"        200 GET  "/api/horarios?sucursal_id=1&dia=1" "$ADM"
HOR=$(campo "['datos'][0]['id']")

echo "Recepción da el acceso"
prueba "Alta de Ana con su mamá"           201 POST /api/alumnos "$ADM" "{\"sucursal_id\":1,\"nombre\":\"Ana\",\"apellido_paterno\":\"App$R\",\"fecha_nacimiento\":\"2014-02-11\",\"curp\":\"$(curp 140211)\",\"foto\":\"$FOTO\",\"responsable\":{\"nombre\":\"Marta\",\"apellido_paterno\":\"App$R\",\"telefono\":\"$TEL\",\"parentesco\":\"madre\"}}"
ANA=$(campo "['datos']['id']"); RESP=$(campo "['datos']['responsable_id']"); MAT=$(campo "['datos']['matricula']")
prueba "Alta de Leo, hermano"              201 POST /api/alumnos "$ADM" "{\"sucursal_id\":1,\"nombre\":\"Leo\",\"apellido_paterno\":\"App$R\",\"fecha_nacimiento\":\"2016-03-03\",\"curp\":\"$(curp 160303)\",\"foto\":\"$FOTO\",\"responsable\":{\"id\":$RESP,\"parentesco\":\"madre\"}}"
LEO=$(campo "['datos']['id']"); MATL=$(campo "['datos']['matricula']")
prueba "Ana en 8 kup"                      201 POST /api/inscripciones "$ADM" "{\"alumno_id\":$ANA,\"horario_id\":$HOR,\"grado_id\":$G3,\"forzar\":true}"
prueba "Quién tiene la app"                200 GET  "/api/alumnos/$ANA/app" "$ADM"
igual  "Ana y su mamá, sin acceso"         "implode(',', array_column(\$j['datos'], 'estado'))" "sin_acceso,sin_acceso"
prueba "Para quién, falta"                 422 POST "/api/alumnos/$ANA/app" "$ADM" '{"para":"vecino"}'
prueba "Responsable que no paga por ella"  422 POST "/api/alumnos/$ANA/app" "$ADM" '{"para":"responsable","responsable_id":999999}'
prueba "Acceso para Ana"                   201 POST "/api/alumnos/$ANA/app" "$ADM" '{"para":"alumno"}'
CA=$(campo "['datos']['codigo']")
igual  "Su usuario es la matrícula"        "['datos']['usuario']" "$MAT"
igual  "Mensaje para WhatsApp con el código" "str_contains(\$j['datos']['mensaje'], '$CA') ? 'si' : 'no'" "si"
igual  "Sin teléfono propio: al de su mamá" "['datos']['telefono']" "$TEL"
prueba "Acceso para la mamá"               201 POST "/api/alumnos/$ANA/app" "$ADM" "{\"para\":\"responsable\",\"responsable_id\":$RESP}"
CR=$(campo "['datos']['codigo']")
igual  "Su usuario es el teléfono"         "['datos']['usuario']" "$TEL"
prueba "Ya tienen código"                  200 GET  "/api/alumnos/$ANA/app" "$ADM"
igual  "Código enviado a los dos"          "implode(',', array_column(\$j['datos'], 'estado'))" "codigo_enviado,codigo_enviado"

echo "Activar en la app"
prueba "Contraseña corta"                  422 POST /api/app/activar "" "{\"usuario\":\"$TEL\",\"codigo\":\"$CR\",\"password\":\"123\"}"
prueba "Código equivocado"                 422 POST /api/app/activar "" "{\"usuario\":\"$TEL\",\"codigo\":\"000000\",\"password\":\"Marta2026!\"}"
prueba "Usuario que no existe"             422 POST /api/app/activar "" '{"usuario":"2220000000","codigo":"123456","password":"Marta2026!"}'
prueba "La mamá activa con su teléfono"    200 POST /api/app/activar "" "{\"usuario\":\"222 $(echo $TEL | cut -c4-)\",\"codigo\":\"$CR\",\"password\":\"Marta2026!\"}"
TM=$(campo "['datos']['token']")
prueba "El código ya se usó"               422 POST /api/app/activar "" "{\"usuario\":\"$TEL\",\"codigo\":\"$CR\",\"password\":\"Otra2026!\"}"
prueba "Ana activa con su matrícula"       200 POST /api/app/activar "" "{\"usuario\":\"$MAT\",\"codigo\":\"$CA\",\"password\":\"Ana12345\"}"
TA=$(campo "['datos']['token']")
entra "La mamá entra con su teléfono" "$TEL" 'Marta2026!'
entra "Ana entra con su matrícula (minúsculas)" "$(echo $MAT | tr A-Z a-z)" 'Ana12345'
prueba "Contraseña mala"                   401 POST /api/auth/login "" "{\"email\":\"$MAT\",\"password\":\"nope1234\"}"
prueba "Ya están activos"                  200 GET  "/api/alumnos/$ANA/app" "$ADM"
igual  "Activos"                           "implode(',', array_column(\$j['datos'], 'estado'))" "activo,activo"

echo "Lo que ve cada quien"
prueba "La mamá"                           200 GET  /api/app/yo "$TM"
igual  "Responsable de dos"                "(\$j['datos']['es_responsable'] ? 'si' : 'no') . count(\$j['datos']['alumnos'])" "si2"
prueba "Ana"                               200 GET  /api/app/yo "$TA"
igual  "Alumna, no responsable"            "\$j['datos']['alumno_id'] . (\$j['datos']['es_responsable'] ? 'R' : '')" "$ANA"
prueba "Inicio de Ana"                     200 GET  "/api/app/alumnos/$ANA/inicio" "$TA"
igual  "Trae su QR"                        "strlen(\$j['datos']['alumno']['codigo_qr'])" "32"
igual  "Grado actual"                      "['datos']['grado']['nombre']" "8 kup"
igual  "Semana de 7 días"                  "count(\$j['datos']['semana'])" "7"
igual  "Rumbo a 7 kup"                     "['datos']['rumbo']['grado_objetivo']['nombre']" "7 kup"
prueba "Ana no ve a Leo"                   403 GET  "/api/app/alumnos/$LEO/inicio" "$TA"
prueba "La mamá sí ve a Leo"               200 GET  "/api/app/alumnos/$LEO/inicio" "$TM"
prueba "Camino de Ana"                     200 GET  "/api/app/alumnos/$ANA/camino" "$TA"
igual  "Dos grados ya pasados"             "count(array_filter(\$j['datos']['disciplinas'][0]['grados'], fn(\$g) => \$g['estado'] === 'obtenido'))" "2"
igual  "Un solo siguiente"                 "implode(',', array_column(array_filter(\$j['datos']['disciplinas'][0]['grados'], fn(\$g) => \$g['estado'] === 'siguiente'), 'nombre'))" "7 kup"

echo "Avatar"
prueba "Avatar de Ana"                     200 GET  "/api/app/alumnos/$ANA/avatar" "$TA"
igual  "Banda roja desbloqueada (9 kup)"   "array_column(\$j['datos']['accesorios'], 'desbloqueado', 'imagen')['banda-roja'] ? 'si' : 'no'" "si"
igual  "Banda azul bloqueada (6 kup)"      "array_column(\$j['datos']['accesorios'], 'desbloqueado', 'imagen')['banda-azul'] ? 'si' : 'no'" "no"
igual  "Tres insignias ganadas"            "count(array_filter(\$j['datos']['insignias'], fn(\$i) => \$i['obtenida']))" "3"
ID=$(campo "json_encode(array_column(\$j['datos']['accesorios'], 'id', 'imagen'))")
id() { php -r '$m=json_decode($argv[1],true); echo $m[$argv[2]];' -- "$ID" "$1"; }
prueba "No puede ponerse la banda azul"    422 PUT  "/api/app/alumnos/$ANA/avatar" "$TA" "{\"equipo\":[$(id banda-azul)]}"
prueba "Dos bandas a la vez"               422 PUT  "/api/app/alumnos/$ANA/avatar" "$TA" "{\"equipo\":[$(id banda-roja),$(id banda-blanca)]}"
prueba "Banda roja, guantes y atardecer"   200 PUT  "/api/app/alumnos/$ANA/avatar" "$TA" "{\"equipo\":[$(id banda-roja),$(id guantes-rojos),$(id fondo-atardecer)]}"
igual  "Lo trae puesto"                    "count(\$j['datos']['equipo'])" "3"

echo "Apariencia del avatar"
prueba "Apariencia de Ana"                 200 GET  "/api/app/alumnos/$ANA/avatar" "$TA"
igual  "Ana tiene 12 o más: joven"         "['datos']['apariencia']['etapa']" "joven"
igual  "Uniforme de Taekwondo"             "['datos']['apariencia']['disciplina']" "Taekwondo"
igual  "Ana es nueva: debe crear su avatar" "var_export(\$j['datos']['apariencia']['personalizada'], true)" "false"
prueba "Peinado que no existe"             422 PUT  "/api/app/alumnos/$ANA/avatar" "$TA" '{"apariencia":{"peinado":"afro-arcoiris"}}'
prueba "Cabello rizado castaño, piel 4"    200 PUT  "/api/app/alumnos/$ANA/avatar" "$TA" '{"apariencia":{"peinado":"rizado","color_pelo":"castano","piel":"4"}}'
igual  "Se guardó"                         "\$j['datos']['apariencia']['peinado'] . ',' . \$j['datos']['apariencia']['color_pelo'] . ',' . \$j['datos']['apariencia']['piel']" "rizado,castano,4"
igual  "Sin mandar equipo, no se lo quita" "count(\$j['datos']['equipo'])" "3"
igual  "Ya lo personalizó"                 "var_export(\$j['datos']['apariencia']['personalizada'], true)" "true"
prueba "Leo (10 años)"                     200 GET  "/api/app/alumnos/$LEO/inicio" "$TM"
igual  "Es niño"                           "['datos']['apariencia']['etapa']" "nino"
prueba "Un niño no lleva barba"            200 PUT  "/api/app/alumnos/$LEO/avatar" "$TM" '{"apariencia":{"vello":"barba"}}'
igual  "Se queda sin vello"                "['datos']['apariencia']['vello']" "ninguno"
prueba "En Mi familia sale su apariencia"  200 GET  /api/app/familia "$TM"
igual  "Rizado en la familia"              "array_column(array_column(\$j['datos']['alumnos'], 'apariencia', 'id'), 'peinado')[0] ?? ''" "rizado"

echo "Examen desde la app"
prueba "Fecha de examen en 30 días"        201 POST /api/examenes "$ADM" "{\"sucursal_id\":1,\"disciplina_id\":1,\"fecha\":\"$(date -d '+30 days' +%Y-%m-%d) 10:00\",\"sede\":\"Gimnasio $R\"}"
EX=$(campo "['datos']['id']")
prueba "Fechas que puede pedir Ana"        200 GET  "/api/app/alumnos/$ANA/examenes" "$TA"
igual  "Aparece la fecha nueva"            "in_array($EX, array_column(\$j['datos']['fechas'], 'id')) ? 'si' : 'no'" "si"
prueba "Ana solicita"                      201 POST "/api/app/alumnos/$ANA/examenes/$EX" "$TA" '{}'
igual  "Va con el instructor"              "['datos']['estado']" "por_autorizar"
prueba "Otra vez"                          409 POST "/api/app/alumnos/$ANA/examenes/$EX" "$TA" '{}'
prueba "Ana no pide por Leo"               403 POST "/api/app/alumnos/$LEO/examenes/$EX" "$TA" '{}'
prueba "Recepción lo ve en el panel"       200 GET  "/api/examenes/$EX" "$ADM"
igual  "Llegó por el portal"               "array_values(array_filter(\$j['datos']['solicitudes'], fn(\$s) => \$s['alumno_id'] == $ANA))[0]['canal']" "portal"

echo "Familia y pagos"
prueba "Familia de la mamá"                200 GET  /api/app/familia "$TM"
igual  "Sus dos hijos"                     "count(\$j['datos']['alumnos'])" "2"
igual  "Debe algo"                         "\$j['datos']['total'] > 0 ? 'si' : 'no'" "si"
prueba "Ana no es responsable"             403 GET  /api/app/familia "$TA"
prueba "Recepción cobra la inscripción de Ana" 201 POST /api/caja/cobros "$ADM" "{\"responsable_id\":$RESP,\"metodo\":\"efectivo\",\"claves\":[\"insc:$ANA\"]}"
PAGO=$(campo "['datos']['id']")
prueba "La mamá ve su recibo"              200 GET  "/api/app/pagos/$PAGO" "$TM"
igual  "Con su línea"                      "count(\$j['datos']['lineas'])" "1"

echo "Adulto que paga por sí mismo"
prueba "Alta de Raúl"                      201 POST /api/alumnos "$ADM" "{\"sucursal_id\":1,\"nombre\":\"Raúl\",\"apellido_paterno\":\"App$R\",\"fecha_nacimiento\":\"1990-01-01\",\"curp\":\"$(curp 900101)\",\"foto\":\"$FOTO\",\"telefono\":\"$TEL2\",\"responsable\":{\"el_mismo\":true}}"
RAUL=$(campo "['datos']['id']"); MATR=$(campo "['datos']['matricula']")
prueba "Acceso para Raúl"                  201 POST "/api/alumnos/$RAUL/app" "$ADM" '{"para":"alumno"}'
CRA=$(campo "['datos']['codigo']")
prueba "Raúl activa"                       200 POST /api/app/activar "" "{\"usuario\":\"$MATR\",\"codigo\":\"$CRA\",\"password\":\"Raul2026!\"}"
TR=$(campo "['datos']['token']")
prueba "Raúl es alumno y responsable"      200 GET  /api/app/yo "$TR"
igual  "Los dos"                           "(\$j['datos']['alumno_id'] == $RAUL ? 'A' : '') . (\$j['datos']['es_responsable'] ? 'R' : '')" "AR"
prueba "Raúl no ve recibos ajenos"         404 GET  "/api/app/pagos/$PAGO" "$TR"
prueba "Raúl no ve a Ana"                  403 GET  "/api/app/alumnos/$ANA/avatar" "$TR"

echo "Código bloqueado y nueva contraseña"
prueba "Acceso para Leo"                   201 POST "/api/alumnos/$LEO/app" "$ADM" '{"para":"alumno"}'
for n in 1 2 3 4 5; do curl -s -o /dev/null "$API/api/app/activar" -H 'Content-Type: application/json' -d "{\"usuario\":\"$MATL\",\"codigo\":\"99999$n\",\"password\":\"Leo12345\"}"; done
prueba "Tras 5 intentos se bloquea"        423 POST /api/app/activar "" "{\"usuario\":\"$MATL\",\"codigo\":\"123456\",\"password\":\"Leo12345\"}"
prueba "La mamá olvidó su contraseña"      201 POST "/api/alumnos/$LEO/app" "$ADM" "{\"para\":\"responsable\",\"responsable_id\":$RESP}"
CR2=$(campo "['datos']['codigo']")
prueba "Nueva contraseña"                  200 POST /api/app/activar "" "{\"usuario\":\"$TEL\",\"codigo\":\"$CR2\",\"password\":\"Marta2027!\"}"
prueba "La sesión vieja se cerró"          401 GET  /api/app/yo "$TM"
entra "Entra con la nueva" "$TEL" 'Marta2027!'

echo "Mi cuenta: cada quien actualiza sus datos"
TEL3="22277$(printf '%05d' $R)"
prueba "Cuenta de Raúl"                    200 GET  /api/app/cuenta "$TR"
igual  "Entra con matrícula y teléfono"    "implode(',', \$j['datos']['entra_con'])" "$MATR,$TEL2"
prueba "Nada que cambiar"                  422 PUT  /api/app/cuenta "$TR" '{}'
prueba "Teléfono sin su contraseña"        422 PUT  /api/app/cuenta "$TR" "{\"telefono\":\"$TEL3\"}"
prueba "Contraseña equivocada"             422 PUT  /api/app/cuenta "$TR" "{\"telefono\":\"$TEL3\",\"password\":\"otra1234\"}"
prueba "El teléfono de otra mamá"          409 PUT  /api/app/cuenta "$TR" "{\"telefono\":\"$TEL\",\"password\":\"Raul2026!\"}"
prueba "Responsable sin teléfono"          422 PUT  /api/app/cuenta "$TR" '{"telefono":"","password":"Raul2026!"}'
prueba "Cambia su teléfono"                200 PUT  /api/app/cuenta "$TR" "{\"telefono\":\"222 77$(printf '%05d' $R)\",\"password\":\"Raul2026!\"}"
igual  "Quedó limpio"                      "['datos']['telefono']" "$TEL3"
entra "Entra con el teléfono nuevo" "$TEL3" 'Raul2026!'
prueba "El viejo ya no sirve"              401 POST /api/auth/login "" "{\"email\":\"$TEL2\",\"password\":\"Raul2026!\"}"
prueba "Correo mal escrito"                422 PUT  /api/app/cuenta "$TR" '{"email":"raul@","password":"Raul2026!"}'
prueba "Correo de otra cuenta"             409 PUT  /api/app/cuenta "$TR" '{"email":"laura@dojoos.mx","password":"Raul2026!"}'
prueba "Agrega su correo"                  200 PUT  /api/app/cuenta "$TR" "{\"email\":\"Raul$R@Correo.mx\",\"password\":\"Raul2026!\"}"
igual  "En minúsculas"                     "['datos']['email']" "raul$R@correo.mx"
entra "Entra con su correo" "raul$R@correo.mx" 'Raul2026!'
prueba "Domicilio sin código postal"       422 PUT  /api/app/cuenta "$TR" '{"domicilio":{"calle":"Av. 5 de Mayo","municipio":"Puebla","estado":"Puebla"}}'
prueba "Domicilio sin contraseña (no la pide)" 200 PUT /api/app/cuenta "$TR" '{"domicilio":{"calle":"Av. 5 de Mayo","numero":"12","colonia":"Centro","cp":"72000","municipio":"Puebla","estado":"Puebla"}}'
igual  "Guardado"                          "\$j['datos']['domicilio']['calle'] . ' ' . \$j['datos']['domicilio']['cp']" "Av. 5 de Mayo 72000"
prueba "Se muda"                           200 PUT  /api/app/cuenta "$TR" '{"domicilio":{"calle":"Calle 14 Sur","numero":"3301","cp":"72410","municipio":"Puebla","estado":"Puebla"}}'
prueba "Recepción lo ve en la ficha"       200 GET  "/api/alumnos/$RAUL" "$ADM"
igual  "Domicilio nuevo"                   "\$j['datos']['domicilio']['calle'] . ' / ' . implode(',', array_column(\$j['datos']['contactos'], 'valor'))" "Calle 14 Sur / $TEL3,raul$R@correo.mx"
prueba "Queda en la bitácora"              200 GET  "/api/bitacora?tabla=domicilios" "$ADM"
igual  "Con quién lo cambió"               "count(array_filter(\$j['datos']['registros'] ?? \$j['datos'], fn(\$b) => (\$b['tabla'] ?? '') === 'domicilios')) > 0 ? 'si' : 'no'" "si"
prueba "Su modo claro"                     200 PUT  /api/preferencias "$TR" '{"tema":"claro"}'
prueba "Se guarda en su cuenta"            200 GET  /api/preferencias "$TR"
igual  "Claro"                             "['datos']['tema']" "claro"
prueba "Sin sesión no hay cuenta"          401 GET  /api/app/cuenta ""

echo "Permisos del personal"
entra "Login Laura" laura@dojoos.mx 'Dojo2026!'
LAU=$(campo "['datos']['token']"); ADMN=$(campo "['datos']['roles'][0]['usuario_rol_id']"); INST=$(campo "['datos']['roles'][1]['usuario_rol_id']")
prueba "Laura como admin de Norte"         200 POST /api/auth/rol "$LAU" "{\"usuario_rol_id\":$ADMN}"
prueba "No da acceso a alumnos de Centro"  403 POST "/api/alumnos/$ANA/app" "$LAU" '{"para":"alumno"}'
prueba "Laura como instructora"            200 POST /api/auth/rol "$LAU" "{\"usuario_rol_id\":$INST}"
prueba "El instructor no da accesos"       403 POST "/api/alumnos/$ANA/app" "$LAU" '{"para":"alumno"}'
prueba "Laura no tiene alumnos en la app"  200 GET  /api/app/yo "$LAU"
igual  "Lista vacía"                       "count(\$j['datos']['alumnos'])" "0"
prueba "Sin sesión no hay app"             401 GET  /api/app/yo ""

echo; echo "Resultado: $pasa pasaron, $falla fallaron"; [ $falla -eq 0 ]
