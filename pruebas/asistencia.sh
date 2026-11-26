#!/usr/bin/env bash
# Pruebas de la fase 3 · Asistencia (tableta con QR, reglas, lista del instructor e historial).
# Uso: ./pruebas/asistencia.sh [http://localhost:8080]. Crea sus propios datos: se puede correr varias veces.
# Crea una clase de hoy que empezó hace 10 minutos; entre 23:00 y 01:00 no se puede probar (la clase cruzaría la medianoche).
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

INI=$(date -d '-10 min' +%H:%M); FIN=$(date -d '+50 min' +%H:%M); HOY=$(date +%u); MANANA=$(date -d tomorrow +%u)
if [ "$(date -d '-10 min' +%u)" != "$HOY" ] || [ "$(date -d '+50 min' +%u)" != "$HOY" ]; then echo "Son casi las 12 de la noche: corre estas pruebas más tarde."; exit 0; fi
ATRAS=$(date -d '-45 days' +%Y-%m-%d)

prueba "Login súper admin"                 200 POST /api/auth/login "" '{"email":"admin@dojoos.mx","password":"Dojo2026!"}'
ADM=$(campo "['datos']['token']")
prueba "Login de la tableta de Centro"     200 POST /api/auth/login "" '{"email":"tableta.centro@dojoos.mx","password":"Dojo2026!"}'
TAB=$(campo "['datos']['token']")
prueba "Login Laura"                       200 POST /api/auth/login "" '{"email":"laura@dojoos.mx","password":"Dojo2026!"}'
LAU=$(campo "['datos']['token']"); ADMN=$(campo "['datos']['roles'][0]['usuario_rol_id']"); INST=$(campo "['datos']['roles'][1]['usuario_rol_id']")
prueba "Laura como instructora"            200 POST /api/auth/rol "$LAU" "{\"usuario_rol_id\":$INST}"

echo "Preparación: clase de hoy en Centro y clase de mañana en Norte"
# Clases que hayan quedado de una corrida anterior
curl -s "$API/api/horarios" -H "Authorization: Bearer $ADM" > /tmp/r.json
for h in $(campo "implode(' ', array_column(array_filter(\$j['datos'], fn(\$h) => str_starts_with((string) \$h['nivel'], 'Prueba asistencia')), 'id'))"); do
  curl -s -o /dev/null -X PUT "$API/api/horarios/$h/desactivar" -H 'Content-Type: application/json' -H "Authorization: Bearer $ADM" -d '{"forzar":true}'; done
prueba "Instructores de Centro"            200 GET  "/api/instructores?sucursal_id=1" "$ADM"
INS=$(campo "['datos'][0]['id']")
prueba "Clase de hoy ($INI-$FIN)"          201 POST /api/horarios "$ADM" "{\"sucursal_id\":1,\"disciplina_id\":1,\"instructor_id\":$INS,\"dia_semana\":$HOY,\"hora_inicio\":\"$INI\",\"hora_fin\":\"$FIN\",\"nivel\":\"Prueba asistencia $R\"}"
HOR=$(campo "['datos']['id']")
prueba "Clase de mañana en Norte"          201 POST /api/horarios "$ADM" "{\"sucursal_id\":2,\"disciplina_id\":1,\"instructor_id\":$INS,\"dia_semana\":$MANANA,\"hora_inicio\":\"06:00\",\"hora_fin\":\"06:45\",\"nivel\":\"Prueba asistencia Norte $R\"}"
HORN=$(campo "['datos']['id']")
prueba "Grados de Taekwondo"               200 GET  /api/disciplinas/1/grados "$ADM"
G1=$(campo "['datos'][0]['id']")
alta() {  # alta NOMBRE SUCURSAL FECHA_NACIMIENTO [fecha_alta] → deja el id en $ID y el QR en $QR
  prueba "Alta de $1"                      201 POST /api/alumnos "$ADM" "{\"sucursal_id\":$2,\"nombre\":\"$1\",\"apellido_paterno\":\"Asis$R\",\"fecha_nacimiento\":\"$3\",\"curp\":\"$(curp ${3:2:2}${3:5:2}${3:8:2})\",\"foto\":\"$FOTO\",\"responsable\":{\"nombre\":\"Tutor\",\"apellido_paterno\":\"$1$R\",\"telefono\":\"2221234567\",\"parentesco\":\"madre\"}${4:+,\"fecha_alta\":\"$4\"}}"
  ID=$(campo "['datos']['id']")
  curl -s "$API/api/alumnos/$ID" -H "Authorization: Bearer $ADM" > /tmp/r.json; QR=$(campo "['datos']['codigo_qr']"); }
alta Ana 1 2014-02-11;        ANA=$ID; QANA=$QR
alta Leo 1 2015-07-21;        LEO=$ID; QLEO=$QR
alta Beto 1 2013-09-30 "$ATRAS"; BETO=$ID; QBETO=$QR
alta Mia 1 2016-03-03;        MIA=$ID; QMIA=$QR
alta Vic 2 2012-12-12;        VIC=$ID; QVIC=$QR
prueba "Fecha de alta futura"              422 POST /api/alumnos "$ADM" "{\"sucursal_id\":1,\"nombre\":\"X\",\"apellido_paterno\":\"Y\",\"fecha_nacimiento\":\"2014-02-11\",\"curp\":\"$(curp 140211)\",\"foto\":\"$FOTO\",\"responsable\":{\"el_mismo\":true},\"fecha_alta\":\"2099-01-01\"}"
for x in $ANA $LEO $BETO; do prueba "Inscribe $x en la clase de hoy" 201 POST /api/inscripciones "$ADM" "{\"alumno_id\":$x,\"horario_id\":$HOR,\"grado_id\":$G1,\"forzar\":true}"; done
prueba "Vic se inscribe en Norte"          201 POST /api/inscripciones "$ADM" "{\"alumno_id\":$VIC,\"horario_id\":$HORN,\"grado_id\":$G1,\"forzar\":true}"

echo "Tableta"
prueba "Clases de hoy en la tableta"       200 GET  /api/asistencias/clases "$TAB"
igual  "La clase de prueba está en curso"  "array_column(\$j['datos']['clases'], 'estado', 'id')[$HOR]" "en_curso"
prueba "QR que no existe"                  404 POST /api/asistencias/qr "$TAB" "{\"codigo\":\"no-existe\",\"horario_id\":$HOR}"
prueba "Ana entra"                         201 POST /api/asistencias/qr "$TAB" "{\"codigo\":\"$QANA\",\"horario_id\":$HOR}"
igual  "Bienvenida a tiempo"               "['datos']['resultado']" "bienvenido"
igual  "Avisa que su mensualidad vence"    "count(array_filter(\$j['datos']['avisos'], fn(\$a) => str_contains(\$a, 'vence')))" "1"
prueba "Ana otra vez"                      409 POST /api/asistencias/qr "$TAB" "{\"codigo\":\"$QANA\",\"horario_id\":$HOR}"
prueba "Beto con pago vencido"             403 POST /api/asistencias/qr "$TAB" "{\"codigo\":\"$QBETO\",\"horario_id\":$HOR}"
igual  "Motivo: adeudo"                    "['detalle']['motivo']" "adeudo"
prueba "Mia no está inscrita"              403 POST /api/asistencias/qr "$TAB" "{\"codigo\":\"$QMIA\",\"horario_id\":$HOR}"
igual  "Motivo: no inscrita"               "['detalle']['motivo']" "no_inscrito"
prueba "Vic de visita desde Norte"         201 POST /api/asistencias/qr "$TAB" "{\"codigo\":\"$QVIC\",\"horario_id\":$HOR}"
igual  "Marcada como visita"               "\$j['datos']['visita'] ? 'si' : 'no'" "si"
prueba "Centro permite 1 visita al mes"    201 POST /api/parametros/valores "$ADM" '{"clave":"visitas_por_mes","valor":"1","sucursal_id":1}'
prueba "Vic ya no puede de visita"         403 POST /api/asistencias/qr "$TAB" "{\"codigo\":\"$QVIC\",\"horario_id\":$HOR}"
igual  "Motivo: visita rechazada"          "['detalle']['motivo']" "visita_rechazada"
prueba "Regresa a 3 visitas"               201 POST /api/parametros/valores "$ADM" '{"clave":"visitas_por_mes","valor":"3","sucursal_id":1}'
prueba "Retardo después de 2 min (Taekwondo en Centro)" 201 POST /api/parametros/valores "$ADM" '{"clave":"minutos_retardo","valor":"2","sucursal_id":1,"disciplina_id":1}'
prueba "Leo llega"                         201 POST /api/asistencias/qr "$TAB" "{\"codigo\":\"$QLEO\",\"horario_id\":$HOR}"
igual  "Es retardo"                        "['datos']['resultado']" "retardo"
prueba "La tableta no registra a mano"     403 POST /api/asistencias "$TAB" "{\"alumno_id\":$MIA,\"horario_id\":$HOR}"
prueba "La tableta no ve clases de Norte"  403 POST /api/asistencias/qr "$TAB" "{\"codigo\":\"$QVIC\",\"horario_id\":$HORN}"

echo "Instructor"
prueba "Laura ve sus clases"               200 GET  /api/asistencias/clases "$LAU"
igual  "Marca la suya"                     "array_column(\$j['datos']['clases'], 'mia', 'id')[$HOR] ? 'si' : 'no'" "si"
prueba "Manual a Beto: debe"               409 POST /api/asistencias "$LAU" "{\"alumno_id\":$BETO,\"horario_id\":$HOR}"
igual  "Se puede autorizar"                "\$j['detalle']['se_puede_forzar'] ? 'si' : 'no'" "si"
prueba "Laura lo deja pasar"               201 POST /api/asistencias "$LAU" "{\"alumno_id\":$BETO,\"horario_id\":$HOR,\"forzar\":true}"
BASIS=$(campo "['datos']['id']")
prueba "Asistencia a futuro"               422 POST /api/asistencias "$LAU" "{\"alumno_id\":$MIA,\"horario_id\":$HOR,\"fecha\":\"2099-01-01\"}"
prueba "Lista de la clase"                 200 GET  "/api/asistencias/clase/$HOR" "$LAU"
igual  "Inscritos"                         "['datos']['resumen']['inscritos']" "3"
igual  "Asistieron (con la visita)"        "['datos']['resumen']['asistieron']" "4"
igual  "Con 2 min de tolerancia los 4 son retardo" "['datos']['resumen']['retardos']" "4"
igual  "Intentos rechazados"               "count(\$j['datos']['rechazos'])" "3"
prueba "Valida la lista"                   200 PUT  "/api/asistencias/clase/$HOR/validar" "$LAU" '{}'
igual  "Cuatro validadas"                  "['datos']['validadas']" "4"
prueba "La tableta no quita registros"     403 DELETE "/api/asistencias/$BASIS" "$TAB"
prueba "Quita el de Beto"                  200 DELETE "/api/asistencias/$BASIS" "$LAU"
prueba "Ya no está"                        200 GET  "/api/asistencias/clase/$HOR" "$LAU"
igual  "Quedan tres"                       "['datos']['resumen']['asistieron']" "3"
prueba "Laura como admin de Norte"         200 POST /api/auth/rol "$LAU" "{\"usuario_rol_id\":$ADMN}"
prueba "No ve la lista de Centro"          403 GET  "/api/asistencias/clase/$HOR" "$LAU"

echo "Historial, credencial y examen"
prueba "Historial de Leo"                  200 GET  "/api/alumnos/$LEO/asistencia" "$ADM"
igual  "Un retardo"                        "['datos']['resumen']['retardos']" "1"
prueba "Historial de Vic"                  200 GET  "/api/alumnos/$VIC/asistencia" "$ADM"
igual  "Una visita este mes"               "['datos']['resumen']['visitas_mes']" "1"
prueba "Nueva credencial para Ana"         200 PUT  "/api/alumnos/$ANA/qr" "$ADM" '{}'
prueba "El QR viejo ya no sirve"           404 POST /api/asistencias/qr "$TAB" "{\"codigo\":\"$QANA\",\"horario_id\":$HOR}"
prueba "Examen en 30 días"                 201 POST /api/examenes "$ADM" "{\"sucursal_id\":1,\"disciplina_id\":1,\"fecha\":\"$(date -d '+30 days' +%Y-%m-%d) 10:00\"}"
EX=$(campo "['datos']['id']")
prueba "Criterios de Ana"                  200 GET  "/api/examenes/$EX/criterios?alumno_id=$ANA" "$ADM"
igual  "Cuenta su clase"                   "['datos']['clases_asistidas']" "1"
igual  "Asistencia al 100%"                "['datos']['asistencia']" "100"
prueba "Cancela el examen de prueba"       200 PUT  "/api/examenes/$EX/estado" "$ADM" '{"estado":"cancelado"}'

echo "Limpieza"
prueba "Retardo regresa a 30 min"          201 POST /api/parametros/valores "$ADM" '{"clave":"minutos_retardo","valor":"30","sucursal_id":1,"disciplina_id":1}'
prueba "Desactiva la clase de hoy"         200 PUT  "/api/horarios/$HOR/desactivar" "$ADM" '{"forzar":true}'
prueba "Desactiva la clase de Norte"       200 PUT  "/api/horarios/$HORN/desactivar" "$ADM" '{"forzar":true}'

echo; echo "Resultado: $pasa pasaron, $falla fallaron"; [ $falla -eq 0 ]
