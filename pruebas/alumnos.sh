#!/usr/bin/env bash
# Pruebas de 2.1 Horarios, 2.4 Personas y 2.5 Inscripción. Uso: ./pruebas/alumnos.sh [http://localhost:8080]
# Crea sus propios datos con nombres al azar: se puede correr varias veces.
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

prueba "Login súper admin"                 200 POST /api/auth/login "" '{"email":"admin@dojoos.mx","password":"Dojo2026!"}'
ADM=$(campo "['datos']['token']")

echo "Horarios"
prueba "Instructores de Centro"            200 GET  "/api/instructores?sucursal_id=1" "$ADM"
INS=$(campo "['datos'][0]['id']")
prueba "Grados de Taekwondo"               200 GET  /api/disciplinas/1/grados "$ADM"
G1=$(campo "['datos'][0]['id']"); G4=$(campo "['datos'][3]['id']"); G6=$(campo "['datos'][5]['id']")
prueba "Horario con cupo 1 (domingo)"      201 POST /api/horarios "$ADM" "{\"sucursal_id\":1,\"disciplina_id\":1,\"instructor_id\":$INS,\"dia_semana\":7,\"hora_inicio\":\"$H:00\",\"hora_fin\":\"$H:59\",\"nivel\":\"Prueba $R\",\"grado_desde_id\":$G1,\"grado_hasta_id\":$G4,\"cupo\":1}"
HOR=$(campo "['datos']['id']")
prueba "Instructor ocupado a esa hora"     409 POST /api/horarios "$ADM" "{\"sucursal_id\":1,\"disciplina_id\":2,\"instructor_id\":$INS,\"dia_semana\":7,\"hora_inicio\":\"$H:30\",\"hora_fin\":\"$H:45\"}"
prueba "Fin antes del inicio"              422 POST /api/horarios "$ADM" "{\"sucursal_id\":1,\"disciplina_id\":1,\"instructor_id\":$INS,\"dia_semana\":6,\"hora_inicio\":\"10:00\",\"hora_fin\":\"09:00\"}"
prueba "Rango de grados al revés"          422 POST /api/horarios "$ADM" "{\"sucursal_id\":1,\"disciplina_id\":1,\"instructor_id\":$INS,\"dia_semana\":6,\"hora_inicio\":\"06:00\",\"hora_fin\":\"06:30\",\"grado_desde_id\":$G4,\"grado_hasta_id\":$G1}"
prueba "Horarios del domingo en Centro"    200 GET  "/api/horarios?sucursal_id=1&dia=7" "$ADM"

echo "Alumnos"
CURP1=$(curp 100515)
prueba "Menor sin responsable adulto"      422 POST /api/alumnos "$ADM" "{\"sucursal_id\":1,\"nombre\":\"Ana\",\"apellido_paterno\":\"Prueba$R\",\"fecha_nacimiento\":\"2015-05-10\",\"curp\":\"$CURP1\",\"foto\":\"$FOTO\",\"responsable\":{\"el_mismo\":true}}"
prueba "CURP mal escrita"                  422 POST /api/alumnos "$ADM" "{\"sucursal_id\":1,\"nombre\":\"Ana\",\"apellido_paterno\":\"P\",\"fecha_nacimiento\":\"2015-05-10\",\"curp\":\"ABC123\",\"foto\":\"$FOTO\",\"responsable\":{\"el_mismo\":true}}"
prueba "Sin foto"                          422 POST /api/alumnos "$ADM" "{\"sucursal_id\":1,\"nombre\":\"Ana\",\"apellido_paterno\":\"P\",\"fecha_nacimiento\":\"2015-05-10\",\"curp\":\"$CURP1\",\"responsable\":{\"el_mismo\":true}}"
prueba "Alta de menor con mamá"            201 POST /api/alumnos "$ADM" "{\"sucursal_id\":1,\"nombre\":\"Ana\",\"apellido_paterno\":\"Prueba$R\",\"fecha_nacimiento\":\"2015-05-10\",\"curp\":\"$CURP1\",\"foto\":\"$FOTO\",\"telefono\":\"222 111 2233\",\"responsable\":{\"nombre\":\"Rosa\",\"apellido_paterno\":\"Prueba$R\",\"telefono\":\"2221234567\",\"parentesco\":\"madre\"}}"
A1=$(campo "['datos']['id']"); RESP=$(campo "['datos']['responsable_id']"); MAT=$(campo "['datos']['matricula']")
[[ "$MAT" =~ ^CENT-[0-9]{2}-[0-9]{4}$ ]] && { pasa=$((pasa+1)); echo "  ok   Matrícula con folio ($MAT)"; } || { falla=$((falla+1)); echo "  FALLA matrícula $MAT"; }
prueba "CURP repetida"                     409 POST /api/alumnos "$ADM" "{\"sucursal_id\":1,\"nombre\":\"Otra\",\"apellido_paterno\":\"P\",\"fecha_nacimiento\":\"2015-05-10\",\"curp\":\"$CURP1\",\"foto\":\"$FOTO\",\"responsable\":{\"id\":$RESP,\"parentesco\":\"madre\"}}"
prueba "Hermano con el mismo responsable"  201 POST /api/alumnos "$ADM" "{\"sucursal_id\":1,\"nombre\":\"Leo\",\"apellido_paterno\":\"Prueba$R\",\"fecha_nacimiento\":\"2013-02-01\",\"curp\":\"$(curp 130201)\",\"foto\":\"$FOTO\",\"responsable\":{\"id\":$RESP,\"parentesco\":\"madre\"}}"
A2=$(campo "['datos']['id']")
prueba "Adulto que paga él mismo"          201 POST /api/alumnos "$ADM" "{\"sucursal_id\":1,\"nombre\":\"Iker\",\"apellido_paterno\":\"Prueba$R\",\"fecha_nacimiento\":\"1995-08-20\",\"curp\":\"$(curp 950820)\",\"foto\":\"$FOTO\",\"responsable\":{\"el_mismo\":true}}"
prueba "Buscar por apellido"               200 GET  "/api/alumnos?buscar=Prueba$R" "$ADM"
igual  "Encuentra a los 3"                 "count(\$j['datos'])" "3"
prueba "Buscar por matrícula"              200 GET  "/api/alumnos?buscar=$MAT" "$ADM"
igual  "Matrícula exacta"                  "['datos'][0]['matricula']" "$MAT"
prueba "Buscar por teléfono"               200 GET  "/api/alumnos?buscar=2221112233" "$ADM"
prueba "Responsable por nombre"            200 GET  "/api/responsables?buscar=Rosa%20Prueba$R" "$ADM"
igual  "Responsable con 2 alumnos"         "['datos'][0]['alumnos_a_cargo']" "2"
prueba "Foto del alumno"                   200 GET  "/api/alumnos/$A1/foto" "$ADM"

echo "Inscripción"
prueba "Inscribe a Ana (grado 1)"          201 POST /api/inscripciones "$ADM" "{\"alumno_id\":$A1,\"horario_id\":$HOR,\"grado_id\":$G1}"
INSC=$(campo "['datos']['id']")
prueba "Inscripción repetida"              409 POST /api/inscripciones "$ADM" "{\"alumno_id\":$A1,\"horario_id\":$HOR}"
prueba "Clase llena avisa"                 409 POST /api/inscripciones "$ADM" "{\"alumno_id\":$A2,\"horario_id\":$HOR,\"grado_id\":$G1}"
igual  "Motivo cupo lleno"                 "['detalle']['avisos'][0]['motivo']" "cupo_lleno"
prueba "Grado fuera de rango avisa"        409 POST /api/inscripciones "$ADM" "{\"alumno_id\":$A2,\"horario_id\":$HOR,\"grado_id\":$G6}"
igual  "Dos avisos juntos"                 "count(\$j['detalle']['avisos'])" "2"
prueba "Con confirmación se inscribe"      201 POST /api/inscripciones "$ADM" "{\"alumno_id\":$A2,\"horario_id\":$HOR,\"grado_id\":$G6,\"forzar\":true}"
igual  "Excepciones registradas"           "implode(',', \$j['datos']['excepciones'])" "fuera_de_rango,cupo_lleno"
prueba "Ficha de Ana"                      200 GET  "/api/alumnos/$A1" "$ADM"
igual  "Su grado de ubicación"             "['datos']['grados'][0]['orden']" "1"
igual  "Su responsable"                    "['datos']['responsables'][0]['parentesco']" "madre"
prueba "Alumnos del horario"               200 GET  "/api/horarios/$HOR" "$ADM"
igual  "Dos inscritos"                     "count(\$j['datos']['alumnos'])" "2"
prueba "No desactiva con inscritos"        409 PUT  "/api/horarios/$HOR/desactivar" "$ADM" '{}'

echo "Bajas y permisos"
prueba "Baja de Leo"                       200 PUT  "/api/alumnos/$A2/estado" "$ADM" '{"estado":"baja"}'
prueba "Login Laura"                       200 POST /api/auth/login "" '{"email":"laura@dojoos.mx","password":"Dojo2026!"}'
LAU=$(campo "['datos']['token']"); ADMN=$(campo "['datos']['roles'][0]['usuario_rol_id']"); INST=$(campo "['datos']['roles'][1]['usuario_rol_id']")
prueba "Laura como admin de Norte"         200 POST /api/auth/rol "$LAU" "{\"usuario_rol_id\":$ADMN}"
prueba "No ve alumnos de Centro"           403 GET  "/api/alumnos/$A1" "$LAU"
prueba "Busca solo en su sucursal"         200 GET  "/api/alumnos?buscar=Prueba$R" "$LAU"
igual  "Ninguno de Centro"                 "count(\$j['datos'])" "0"
prueba "No inscribe en Centro"             403 POST /api/inscripciones "$LAU" "{\"alumno_id\":$A1,\"horario_id\":$HOR}"
prueba "Laura como instructora"            200 POST /api/auth/rol "$LAU" "{\"usuario_rol_id\":$INST}"
prueba "Instructor no da de alta alumnos"  403 POST /api/alumnos "$LAU" '{}'
prueba "Instructor ve horarios"            200 GET  "/api/horarios" "$LAU"
prueba "Termina inscripción de Ana"        200 PUT  "/api/inscripciones/$INSC/terminar" "$ADM" '{}'
prueba "Desactiva el horario de prueba"    200 PUT  "/api/horarios/$HOR/desactivar" "$ADM" '{"forzar":true}'

echo; echo "Resultado: $pasa pasaron, $falla fallaron"; [ $falla -eq 0 ]
