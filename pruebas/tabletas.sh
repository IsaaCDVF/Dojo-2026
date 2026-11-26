#!/usr/bin/env bash
# Pruebas de las tabletas de asistencia: conectar con código, sesión de la tableta, desconectar,
# y la clase que se busca sola al leer el QR.
# Uso: ./pruebas/tabletas.sh [http://localhost:8080]. Crea sus propios datos y al final desactiva lo que creó.
# Crea clases de hoy alrededor de esta hora; entre 23:00 y 01:00 no se puede probar (cruzarían la medianoche).
API=${1:-http://localhost:8080}
pasa=0; falla=0
prueba() { local cod; cod=$(curl -s -o /tmp/r.json -w '%{http_code}' -X "$3" "$API$4" -H 'Content-Type: application/json' ${5:+-H "Authorization: Bearer $5"} ${6:+-d "$6"})
  if [ "$cod" = "$2" ]; then pasa=$((pasa+1)); echo "  ok   $1 ($cod)"; else falla=$((falla+1)); echo "  FALLA $1: esperaba $2, llegó $cod → $(head -c 300 /tmp/r.json)"; fi; }
campo() { php -r '$j=json_decode(file_get_contents("/tmp/r.json"),true); $e=$argv[1]; echo eval("return ".($e[0]==="[" ? "\$j$e" : $e).";");' -- "$1"; }
igual() { local v; v=$(campo "$2"); if [ "$v" = "$3" ]; then pasa=$((pasa+1)); echo "  ok   $1 ($v)"; else falla=$((falla+1)); echo "  FALLA $1: esperaba $3, llegó $v"; fi; }
L=BCDFGHJKLMNPQRSTVWXZ; c() { echo -n "${L:$((RANDOM%20)):1}"; }
curp() { echo "PEGA$1HPL$(c)$(c)$(c)0$((RANDOM%10))"; }
FOTO='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
R=$RANDOM
A1=$(date -d '-10 min' +%H:%M); A2=$(date -d '+50 min' +%H:%M); B1=$(date -d '+20 min' +%H:%M); B2=$(date -d '+80 min' +%H:%M); HOY=$(date +%u); MANANA=$(date -d tomorrow +%u)
if [ "$(date -d '-10 min' +%u)" != "$HOY" ] || [ "$(date -d '+80 min' +%u)" != "$HOY" ]; then echo "Son casi las 12 de la noche: corre estas pruebas más tarde."; exit 0; fi

prueba "Login súper admin"                   200 POST /api/auth/login "" '{"email":"admin@dojoos.mx","password":"Dojo2026!"}'; ADM=$(campo "['datos']['token']")
prueba "Login Laura"                         200 POST /api/auth/login "" '{"email":"laura@dojoos.mx","password":"Dojo2026!"}'; LAU=$(campo "['datos']['token']")
prueba "Roles de Laura"                      200 GET  /api/auth/yo "$LAU"
ADMN=$(campo "array_column(\$j['datos']['roles'], 'usuario_rol_id', 'rol')['admin_sucursal']")
prueba "Laura como admin de Norte"           200 POST /api/auth/rol "$LAU" "{\"usuario_rol_id\":$ADMN}"
prueba "Sucursales"                          200 GET  /api/sucursales "$ADM"
CENT=$(campo "array_column(\$j['datos'], 'id', 'clave')['CENT']"); NORT=$(campo "array_column(\$j['datos'], 'id', 'clave')['NORT']")

echo "Conectar una tableta con código"
prueba "La tableta pide código (sin sesión)" 201 POST /api/dispositivos/solicitar ""
COD=$(campo "['datos']['codigo']"); CLAVE=$(campo "['datos']['clave']")
igual  "Código de 6 dígitos"                 "preg_match('/^\\d{6}\$/', \$j['datos']['codigo'])" "1"
prueba "Pregunta: todavía nadie la conecta"  200 POST /api/dispositivos/estado "" "{\"clave\":\"$CLAVE\"}"
igual  "Esperando"                           "['datos']['estado']" "esperando"
prueba "Con una clave inventada"             200 POST /api/dispositivos/estado "" '{"clave":"inventada"}'
igual  "No sirve"                            "['datos']['estado']" "expirado"
prueba "Sin sesión no se conecta"            401 POST /api/dispositivos "" "{\"codigo\":\"$COD\",\"nombre\":\"X\",\"sucursal_id\":$CENT}"
prueba "Laura no conecta tabletas de Centro" 403 POST /api/dispositivos "$LAU" "{\"codigo\":\"$COD\",\"nombre\":\"X\",\"sucursal_id\":$CENT}"
prueba "Sin nombre"                          422 POST /api/dispositivos "$ADM" "{\"codigo\":\"$COD\",\"nombre\":\" \",\"sucursal_id\":$CENT}"
prueba "Código equivocado"                   404 POST /api/dispositivos "$ADM" "{\"codigo\":\"000000\",\"nombre\":\"Entrada\",\"sucursal_id\":$CENT}"
prueba "El admin la conecta"                 201 POST /api/dispositivos "$ADM" "{\"codigo\":\"${COD:0:3} ${COD:3:3}\",\"nombre\":\"Entrada Centro $R\",\"sucursal_id\":$CENT}"
DIS=$(campo "['datos']['id']")
prueba "El mismo código ya no sirve"         404 POST /api/dispositivos "$ADM" "{\"codigo\":\"$COD\",\"nombre\":\"Otra\",\"sucursal_id\":$CENT}"
prueba "La tableta pregunta otra vez"        200 POST /api/dispositivos/estado "" "{\"clave\":\"$CLAVE\"}"
igual  "Ya está conectada"                   "\$j['datos']['estado'] . ' / ' . \$j['datos']['dispositivo']['nombre']" "vinculado / Entrada Centro $R"
TAB=$(campo "['datos']['token']")
prueba "La sesión se entrega una sola vez"   200 POST /api/dispositivos/estado "" "{\"clave\":\"$CLAVE\"}"
igual  "Segunda vez: nada"                   "['datos']['estado']" "expirado"
prueba "Quién es la tableta"                 200 GET  /api/auth/yo "$TAB"
igual  "Tableta de Centro, sin elegir rol"   "\$j['datos']['rol_activo']['nombre'] . ' ' . \$j['datos']['rol_activo']['sucursal_id']" "tableta $CENT"
prueba "No ve alumnos"                       403 GET  /api/alumnos "$TAB"
prueba "No da accesos"                       403 GET  /api/personal "$TAB"
prueba "Ve las clases de hoy"                200 GET  /api/asistencias/clases "$TAB"
prueba "Lista de tabletas"                   200 GET  /api/dispositivos "$ADM"
igual  "Conectada"                           "implode(',', array_map(fn(\$d) => \$d['conectada'] ? 'si' : 'no', array_filter(\$j['datos']['tabletas'], fn(\$d) => \$d['id'] == $DIS)))" "si"
igual  "La cuenta vieja con correo aparece aparte" "in_array('tableta.centro@dojoos.mx', array_column(\$j['datos']['cuentas_con_correo'], 'email')) ? 'si' : 'no'" "si"
prueba "Laura (Norte) no la ve"              200 GET  /api/dispositivos "$LAU"
igual  "Sin tabletas de Centro"              "count(array_filter(\$j['datos']['tabletas'], fn(\$d) => \$d['sucursal_id'] == $CENT))" "0"
prueba "No sale como persona en Personal"    200 GET  "/api/personal?inactivos=1&q=Entrada" "$ADM"
igual  "No está"                             "count(\$j['datos'])" "0"

echo "La clase se busca sola"
prueba "Instructora A"                       201 POST /api/personal "$ADM" "{\"nombre\":\"Ines\",\"apellido_paterno\":\"Tab$R\",\"fecha_nacimiento\":\"1990-01-01\",\"email\":\"ines$R@prueba.mx\",\"roles\":[{\"rol\":\"instructor\",\"sucursal_id\":$CENT}]}"
UIA=$(campo "['datos']['usuario_id']")
prueba "Instructor B"                        201 POST /api/personal "$ADM" "{\"nombre\":\"Bruno\",\"apellido_paterno\":\"Tab$R\",\"fecha_nacimiento\":\"1990-01-01\",\"email\":\"bruno$R@prueba.mx\",\"roles\":[{\"rol\":\"instructor\",\"sucursal_id\":$CENT},{\"rol\":\"instructor\",\"sucursal_id\":$NORT}]}"
UIB=$(campo "['datos']['usuario_id']")
prueba "Instructores de Centro"              200 GET  "/api/instructores?sucursal_id=$CENT" "$ADM"
IA=$(campo "array_column(\$j['datos'], 'id', 'nombre')['Ines Tab$R']"); IB=$(campo "array_column(\$j['datos'], 'id', 'nombre')['Bruno Tab$R']")
prueba "Clase A ($A1, empezó hace 10 min)"   201 POST /api/horarios "$ADM" "{\"sucursal_id\":$CENT,\"disciplina_id\":1,\"instructor_id\":$IA,\"dia_semana\":$HOY,\"hora_inicio\":\"$A1\",\"hora_fin\":\"$A2\",\"nivel\":\"Prueba tableta A $R\"}"
HA=$(campo "['datos']['id']")
prueba "Clase B ($B1, empieza en 20 min)"    201 POST /api/horarios "$ADM" "{\"sucursal_id\":$CENT,\"disciplina_id\":1,\"instructor_id\":$IB,\"dia_semana\":$HOY,\"hora_inicio\":\"$B1\",\"hora_fin\":\"$B2\",\"nivel\":\"Prueba tableta B $R\"}"
HB=$(campo "['datos']['id']")
prueba "Clase de mañana en Norte"            201 POST /api/horarios "$ADM" "{\"sucursal_id\":$NORT,\"disciplina_id\":1,\"instructor_id\":$IB,\"dia_semana\":$MANANA,\"hora_inicio\":\"06:00\",\"hora_fin\":\"06:45\",\"nivel\":\"Prueba tableta N $R\"}"
HN=$(campo "['datos']['id']")
alta() {  # alta NOMBRE SUCURSAL → $ID y $QR
  prueba "Alta de $1"                        201 POST /api/alumnos "$ADM" "{\"sucursal_id\":$2,\"nombre\":\"$1\",\"apellido_paterno\":\"Tab$R\",\"fecha_nacimiento\":\"2012-05-05\",\"curp\":\"$(curp 120505)\",\"foto\":\"$FOTO\",\"responsable\":{\"nombre\":\"Tutor\",\"apellido_paterno\":\"$1$R\",\"telefono\":\"2221234567\",\"parentesco\":\"madre\"}}"
  ID=$(campo "['datos']['id']"); curl -s "$API/api/alumnos/$ID" -H "Authorization: Bearer $ADM" > /tmp/r.json; QR=$(campo "['datos']['codigo_qr']"); }
alta Ana $CENT;  ANA=$ID; QANA=$QR
alta Beto $CENT; BETO=$ID; QBETO=$QR
alta Leo $CENT;  LEO=$ID; QLEO=$QR
alta Mia $CENT;  MIA=$ID; QMIA=$QR
alta Vic $NORT;  VIC=$ID; QVIC=$QR
ins() { prueba "Inscribe a $1 en la clase $2" 201 POST /api/inscripciones "$ADM" "{\"alumno_id\":$3,\"horario_id\":$4,\"forzar\":true}"; }
ins Ana A $ANA $HA; ins Beto B $BETO $HB; ins Leo A $LEO $HA; ins Leo B $LEO $HB; ins Vic Norte $VIC $HN
# Que nadie quede con adeudo por la inscripción: lo que se prueba aquí es la clase que se elige
prueba "Ana sin elegir clase"                201 POST /api/asistencias/qr "$TAB" "{\"codigo\":\"$QANA\"}"
igual  "Le tocó la A"                        "['datos']['clase']['id']" "$HA"
prueba "Beto sin elegir clase"               201 POST /api/asistencias/qr "$TAB" "{\"codigo\":\"$QBETO\"}"
igual  "Le tocó la B (aunque falten 20 min)" "['datos']['clase']['id']" "$HB"
prueba "Leo está en las dos"                 201 POST /api/asistencias/qr "$TAB" "{\"codigo\":\"$QLEO\"}"
igual  "Primero la más cercana: la A"        "['datos']['clase']['id']" "$HA"
prueba "Leo otra vez"                        201 POST /api/asistencias/qr "$TAB" "{\"codigo\":\"$QLEO\"}"
igual  "Ahora la B (la A ya la registró)"    "['datos']['clase']['id']" "$HB"
prueba "Leo una tercera vez"                 409 POST /api/asistencias/qr "$TAB" "{\"codigo\":\"$QLEO\"}"
igual  "Ya estaba"                           "['detalle']['resultado']" "repetida"
prueba "Mia no está inscrita en nada"        403 POST /api/asistencias/qr "$TAB" "{\"codigo\":\"$QMIA\"}"
igual  "No inscrita"                         "['detalle']['motivo']" "no_inscrito"
prueba "Vic de Norte, misma disciplina"      201 POST /api/asistencias/qr "$TAB" "{\"codigo\":\"$QVIC\"}"
igual  "Entra como visita"                   "\$j['datos']['visita'] ? 'si' : 'no'" "si"
prueba "Elegida a mano sigue funcionando"    409 POST /api/asistencias/qr "$TAB" "{\"codigo\":\"$QANA\",\"horario_id\":$HA}"
prueba "Tableta de Norte (hoy sin clases)"   201 POST /api/dispositivos/solicitar ""
COD2=$(campo "['datos']['codigo']"); CLAVE2=$(campo "['datos']['clave']")
prueba "Laura conecta la de Norte"           201 POST /api/dispositivos "$LAU" "{\"codigo\":\"$COD2\",\"nombre\":\"Entrada Norte $R\",\"sucursal_id\":$NORT}"
DIS2=$(campo "['datos']['id']")
prueba "Recibe su sesión"                    200 POST /api/dispositivos/estado "" "{\"clave\":\"$CLAVE2\"}"
TABN=$(campo "['datos']['token']")
prueba "Vic en Norte: su clase es mañana"    409 POST /api/asistencias/qr "$TABN" "{\"codigo\":\"$QVIC\"}"
igual  "Ahorita no hay clases"               "['detalle']['resultado']" "sin_clase"

echo "Desconectar"
prueba "Le cambia el nombre"                 200 PUT  "/api/dispositivos/$DIS" "$ADM" "{\"nombre\":\"Recepción Centro $R\"}"
prueba "Laura no desconecta la de Centro"    403 PUT  "/api/dispositivos/$DIS" "$LAU" '{"activo":0}'
prueba "La desconecta"                       200 PUT  "/api/dispositivos/$DIS" "$ADM" '{"activo":0}'
prueba "La tableta ya no entra"              401 GET  /api/auth/yo "$TAB"
prueba "No se reactiva sin código"           422 PUT  "/api/dispositivos/$DIS" "$ADM" '{"activo":1}'
prueba "Laura desconecta la de Norte"        200 PUT  "/api/dispositivos/$DIS2" "$LAU" '{"activo":0}'
prueba "Código que nadie usó: vence"         201 POST /api/dispositivos/solicitar ""

echo "Dejar todo como estaba"
for h in $HA $HB $HN; do prueba "Desactiva la clase $h" 200 PUT "/api/horarios/$h/desactivar" "$ADM" '{"forzar":true}'; done
for u in $UIA $UIB; do prueba "Desactiva al instructor $u" 200 PUT "/api/personal/$u" "$ADM" '{"activo":0}'; done

echo; echo "Resultado: $pasa pasaron, $falla fallaron"; [ $falla -eq 0 ]
