#!/usr/bin/env bash
# Pruebas de los avisos automáticos: WhatsApp en 1 toque desde recepción y notificaciones en la app.
# Uso: ./pruebas/avisos.sh [http://localhost:8080]. Crea sus propios alumnos y al final los da de baja.
# Ojo: "Revisar ahora" revisa a TODOS los alumnos, así que también pueden aparecer avisos de tus datos reales.
API=${1:-http://localhost:8080}
pasa=0; falla=0
prueba() { local cod; cod=$(curl -s -o /tmp/r.json -w '%{http_code}' -X "$3" "$API$4" -H 'Content-Type: application/json' ${5:+-H "Authorization: Bearer $5"} ${6:+-d "$6"} "${@:7}")
  if [ "$cod" = "$2" ]; then pasa=$((pasa+1)); echo "  ok   $1 ($cod)"; else falla=$((falla+1)); echo "  FALLA $1: esperaba $2, llegó $cod → $(head -c 300 /tmp/r.json)"; fi; }
campo() { php -r '$j=json_decode(file_get_contents("/tmp/r.json"),true); $e=$argv[1]; echo eval("return ".($e[0]==="[" ? "\$j$e" : $e).";");' -- "$1"; }
igual() { local v; v=$(campo "$2"); if [ "$v" = "$3" ]; then pasa=$((pasa+1)); echo "  ok   $1 ($v)"; else falla=$((falla+1)); echo "  FALLA $1: esperaba $3, llegó $v"; fi; }
L=BCDFGHJKLMNPQRSTVWXZ; c() { echo -n "${L:$((RANDOM%20)):1}"; }
curp() { echo "AUVI$1HPL$(c)$(c)$(c)0$((RANDOM%10))"; }
FOTO='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
R=$RANDOM; TV="22277$(printf '%05d' $R)"; TN="22288$(printf '%05d' $R)"; TA="22299$(printf '%05d' $R)"
LEJOS=$(date -d "+30 days" +%Y-%m-%d)
# Filtro de la lista por teléfono: "cuántos avisos de <evento> hay para <tel>"
de() { echo "count(array_filter(\$j['datos']['avisos'], fn(\$a) => \$a['telefono'] === '$1' && \$a['evento'] === '$2'))"; }

prueba "Login súper admin"                   200 POST /api/auth/login "" '{"email":"admin@dojoos.mx","password":"Dojo2026!"}'; ADM=$(campo "['datos']['token']")
prueba "Login Laura (admin de Norte)"        200 POST /api/auth/login "" '{"email":"laura@dojoos.mx","password":"Dojo2026!"}'; LAU=$(campo "['datos']['token']")
ADMN=$(campo "array_column(\$j['datos']['roles'], 'usuario_rol_id', 'rol')['admin_sucursal']")
prueba "Laura como admin de Norte"           200 POST /api/auth/rol "$LAU" "{\"usuario_rol_id\":$ADMN}"
prueba "Login Laura (instructora)"           200 POST /api/auth/login "" '{"email":"laura@dojoos.mx","password":"Dojo2026!"}'; INS=$(campo "['datos']['token']")
INSR=$(campo "array_column(\$j['datos']['roles'], 'usuario_rol_id', 'rol')['instructor']")
prueba "Laura como instructora"              200 POST /api/auth/rol "$INS" "{\"usuario_rol_id\":$INSR}"
prueba "Precio de la mensualidad"            201 POST /api/precios "$ADM" '{"concepto_id":1,"monto":"650"}'
prueba "Precio del examen"                   201 POST /api/precios "$ADM" '{"concepto_id":3,"monto":"450"}'
prueba "Precio de la inscripción"            201 POST /api/precios "$ADM" '{"concepto_id":2,"monto":"500"}'
prueba "Precio del recargo"                  201 POST /api/precios "$ADM" '{"concepto_id":5,"monto":"100"}'
prueba "Parámetros"                          200 GET  /api/parametros "$ADM"
TOL=$(campo "array_column(\$j['datos']['parametros'], 'valor', 'clave')['dias_tolerancia_pago'] ?? 5")
igual  "Existe el parámetro de días sin venir" "isset(array_column(\$j['datos']['parametros'], 'valor', 'clave')['dias_sin_asistir']) ? 'si' : 'no'" "si"

echo "Quién debe"
ALTA_V=$(date -d "-40 days" +%Y-%m-%d)
prueba "Vale: alta hace 40 días (vencida)"   201 POST /api/alumnos "$ADM" "{\"sucursal_id\":1,\"nombre\":\"Vale\",\"apellido_paterno\":\"Aviso$R\",\"fecha_nacimiento\":\"2014-02-11\",\"fecha_alta\":\"$ALTA_V\",\"curp\":\"$(curp 140211)\",\"foto\":\"$FOTO\",\"responsable\":{\"nombre\":\"Vero\",\"apellido_paterno\":\"Aviso$R\",\"telefono\":\"$TV\",\"parentesco\":\"madre\"}}"
VALE=$(campo "['datos']['id']"); RV=$(campo "['datos']['responsable_id']")
# Nico: su cobro fue hace (tolerancia - 2) días, así su mensualidad vence en 2 días
ALTA_N=$(date -d "-$((TOL-2)) days" +%Y-%m-%d)
PV="si"; if [ "$(date -d "$ALTA_N" +%m)" != "$(date +%m)" ] || [ "$(date -d "$ALTA_N" +%-d)" -gt 28 ] || [ "$TOL" -lt 2 ]; then PV="no"; ALTA_N=$(date +%Y-%m-%d); fi
prueba "Nico: su pago vence en 2 días"       201 POST /api/alumnos "$ADM" "{\"sucursal_id\":1,\"nombre\":\"Nico\",\"apellido_paterno\":\"Aviso$R\",\"fecha_nacimiento\":\"2015-03-03\",\"fecha_alta\":\"$ALTA_N\",\"curp\":\"$(curp 150303)\",\"foto\":\"$FOTO\",\"responsable\":{\"nombre\":\"Noé\",\"apellido_paterno\":\"Aviso$R\",\"telefono\":\"$TN\",\"parentesco\":\"padre\"}}"
NICO=$(campo "['datos']['id']"); RN=$(campo "['datos']['responsable_id']")
prueba "Revisar ahora"                       200 POST /api/avisos/revisar "$ADM"
prueba "Lista de recepción"                  200 GET  /api/avisos "$ADM"
igual  "Vero: aviso de pago vencido"         "$(de $TV pago_vencido)" "1"
igual  "Con su nombre, el de Vale y lo que debe" "implode(',', array_map(fn(\$a) => (str_contains(\$a['mensaje'], 'Hola Vero') && str_contains(\$a['mensaje'], 'Vale Aviso$R') && str_contains(\$a['mensaje'], '\$')) ? 'si' : 'no', array_filter(\$j['datos']['avisos'], fn(\$a) => \$a['telefono'] === '$TV')))" "si"
igual  "Sin variables sin llenar"            "count(array_filter(\$j['datos']['avisos'], fn(\$a) => preg_match('/\\{\\w+\\}/', \$a['mensaje'])))" "0"
igual  "Vero no tiene 'por vencer' (ya venció)" "$(de $TV pago_por_vencer)" "0"
if [ "$PV" = "si" ]; then igual "Noé: aviso de pago por vencer" "$(de $TN pago_por_vencer)" "1"
else echo "  (hoy no se puede armar un pago que venza en 2 días dentro del mes: se salta)"; fi
igual  "Recién inscrito: sin aviso de faltas" "count(array_filter(\$j['datos']['avisos'], fn(\$a) => \$a['evento'] === 'ausencia' && in_array(\$a['telefono'], ['$TV','$TN'])))" "0"
igual  "Cuenta por tipo"                     "\$j['datos']['conteo']['pago_vencido'] >= 1 ? 'si' : 'no'" "si"
AV=$(campo "array_values(array_filter(\$j['datos']['avisos'], fn(\$a) => \$a['telefono'] === '$TV'))[0]['id']")
prueba "Revisar otra vez"                    200 POST /api/avisos/revisar "$ADM"
prueba "Lista"                               200 GET  /api/avisos "$ADM"
igual  "No se repite el aviso"               "$(de $TV pago_vencido)" "1"

echo "Quién ve qué"
prueba "Laura en Norte"                      200 GET  /api/avisos "$LAU"
igual  "No ve los de Centro"                 "$(de $TV pago_vencido)" "0"
prueba "Laura en Norte no marca uno de Centro" 403 PUT "/api/avisos/$AV" "$LAU" '{"estado":"enviada"}'
prueba "La instructora no ve avisos"         403 GET  /api/avisos "$INS"
prueba "La instructora no revisa"            403 POST /api/avisos/revisar "$INS"

echo "Mandar por WhatsApp"
prueba "Estado inventado"                    422 PUT  "/api/avisos/$AV" "$ADM" '{"estado":"leido"}'
prueba "Aviso que no existe"                 404 PUT  /api/avisos/99999999 "$ADM" '{"estado":"enviada"}'
prueba "Ya lo mandé"                         200 PUT  "/api/avisos/$AV" "$ADM" '{"estado":"enviada"}'
prueba "Pendientes"                          200 GET  /api/avisos "$ADM"
igual  "Ya no está por mandar"               "$(de $TV pago_vencido)" "0"
prueba "Enviados"                            200 GET  "/api/avisos?vista=enviados" "$ADM"
igual  "Está en enviados, con quién lo mandó" "implode(',', array_map(fn(\$a) => \$a['estado'] . ':' . (\$a['enviada_por'] ? 'quien' : 'nadie'), array_filter(\$j['datos']['avisos'], fn(\$a) => \$a['id'] == $AV)))" "enviada:quien"
prueba "Regresarlo a pendientes"             200 PUT  "/api/avisos/$AV" "$ADM" '{"estado":"programada"}'
prueba "Pendientes"                          200 GET  /api/avisos "$ADM"
igual  "Otra vez por mandar"                 "$(de $TV pago_vencido)" "1"
prueba "Paga en caja"                        200 GET  "/api/caja/estado-cuenta/$RV" "$ADM"
CLAVES=$(campo "json_encode(array_column(\$j['datos']['adeudos'], 'clave'))")
prueba "Cobro de todo lo de Vale"            201 POST /api/caja/cobros "$ADM" "{\"responsable_id\":$RV,\"metodo\":\"efectivo\",\"claves\":$CLAVES}"
prueba "Pendientes"                          200 GET  /api/avisos "$ADM"
igual  "Ya pagó: el aviso se quita solo"     "$(de $TV pago_vencido)" "0"
prueba "Enviados"                            200 GET  "/api/avisos?vista=enviados" "$ADM"
igual  "Queda como 'no se mandó'"            "implode(',', array_map(fn(\$a) => \$a['estado'], array_filter(\$j['datos']['avisos'], fn(\$a) => \$a['id'] == $AV)))" "omitida"

echo "Examen autorizado (sale enseguida, sin esperar la revisión)"
prueba "Grados de Taekwondo"                 200 GET  /api/disciplinas/1/grados "$ADM"; G1=$(campo "['datos'][0]['id']")
prueba "Un horario de Centro"                200 GET  "/api/horarios?sucursal_id=1&dia=1" "$ADM"; HOR=$(campo "['datos'][0]['id']")
prueba "Ana con su mamá"                     201 POST /api/alumnos "$ADM" "{\"sucursal_id\":1,\"nombre\":\"Ana\",\"apellido_paterno\":\"Aviso$R\",\"fecha_nacimiento\":\"2015-05-10\",\"curp\":\"$(curp 150510)\",\"foto\":\"$FOTO\",\"responsable\":{\"nombre\":\"Alma\",\"apellido_paterno\":\"Aviso$R\",\"telefono\":\"$TA\",\"parentesco\":\"madre\"}}"
ANA=$(campo "['datos']['id']"); RA=$(campo "['datos']['responsable_id']")
prueba "Inscribe a Ana"                      201 POST /api/inscripciones "$ADM" "{\"alumno_id\":$ANA,\"horario_id\":$HOR,\"grado_id\":$G1,\"forzar\":true}"
prueba "Acceso para la mamá"                 201 POST "/api/alumnos/$ANA/app" "$ADM" "{\"para\":\"responsable\",\"responsable_id\":$RA}"
CR=$(campo "['datos']['codigo']")
prueba "Activa su app"                       200 POST /api/app/activar "" "{\"usuario\":\"$TA\",\"codigo\":\"$CR\",\"password\":\"Alma2026!\"}"; ALMA=$(campo "['datos']['token']")
prueba "Campanita vacía"                     200 GET  /api/app/avisos "$ALMA"
igual  "Sin examen todavía"                  "count(array_filter(\$j['datos']['avisos'], fn(\$a) => \$a['evento'] === 'examen_autorizado'))" "0"
prueba "Examen en 30 días"                   201 POST /api/examenes "$ADM" "{\"sucursal_id\":1,\"disciplina_id\":1,\"fecha\":\"$LEJOS 10:00\",\"sede\":\"Dojo $R\"}"; EX=$(campo "['datos']['id']")
prueba "Ana pide su examen"                  201 POST "/api/examenes/$EX/solicitudes" "$ADM" "{\"alumno_id\":$ANA}"; SOL=$(campo "['datos']['id']")
prueba "Laura lo autoriza"                   200 PUT  "/api/solicitudes-examen/$SOL/validar" "$INS" '{"decision":"autorizada"}'
sleep 1
prueba "Campanita de Alma"                   200 GET  /api/app/avisos "$ALMA"
igual  "¡Examen autorizado!"                 "implode(',', array_column(array_filter(\$j['datos']['avisos'], fn(\$a) => \$a['evento'] === 'examen_autorizado'), 'titulo'))" "¡Examen autorizado!"
igual  "Lleva a la pantalla del examen"      "implode(',', array_column(array_filter(\$j['datos']['avisos'], fn(\$a) => \$a['evento'] === 'examen_autorizado'), 'ruta'))" "/a/$ANA/examen"
igual  "Con el precio"                       "implode(',', array_map(fn(\$a) => str_contains(\$a['mensaje'], '\$450.00') ? 'si' : 'no', array_filter(\$j['datos']['avisos'], fn(\$a) => \$a['evento'] === 'examen_autorizado')))" "si"
igual  "Sin la ruta escondida en el texto"   "count(array_filter(\$j['datos']['avisos'], fn(\$a) => str_contains(\$a['mensaje'], '[/app')))" "0"
igual  "Sin leer"                            "\$j['datos']['sin_leer'] >= 1 ? 'si' : 'no'" "si"
prueba "Recepción también lo tiene para WhatsApp" 200 GET /api/avisos "$ADM"
igual  "Para Alma"                           "$(de $TA examen_autorizado)" "1"
prueba "Las marca como leídas"               200 POST /api/app/avisos/leidas "$ALMA" '{}'
prueba "Campanita"                           200 GET  /api/app/avisos "$ALMA"
igual  "Nada sin leer"                       "['datos']['sin_leer']" "0"
prueba "Noé no tiene app: no ve la campanita de Alma" 200 GET /api/app/avisos "$ALMA"
igual  "Solo los suyos"                      "count(array_filter(\$j['datos']['avisos'], fn(\$a) => str_contains(\$a['mensaje'], 'Nico')))" "0"

echo "Notificaciones en el celular (suscripción)"
prueba "Llave para suscribirse"              200 GET  /api/app/notificaciones "$ALMA"
igual  "Llave pública P-256 (87 letras)"     "strlen(\$j['datos']['llave'])" "87"
igual  "Todavía sin celulares"               "['datos']['celulares']" "0"
read P256 AUTH <<< "$(php -r '$k=openssl_pkey_new(["private_key_type"=>OPENSSL_KEYTYPE_EC,"curve_name"=>"prime256v1"]); $d=openssl_pkey_get_details($k)["ec"]; $b=fn($x)=>rtrim(strtr(base64_encode($x),"+/","-_"),"="); echo $b("\x04".str_pad($d["x"],32,"\0",STR_PAD_LEFT).str_pad($d["y"],32,"\0",STR_PAD_LEFT))," ",$b(random_bytes(16));')"
EP="https://push.ejemplo.invalid/enviar/$R"
prueba "Suscripción sin llaves"              422 POST /api/app/notificaciones "$ALMA" "{\"endpoint\":\"$EP\"}"
prueba "Dirección sin https"                 422 POST /api/app/notificaciones "$ALMA" "{\"endpoint\":\"http://push.ejemplo.invalid/x\",\"keys\":{\"p256dh\":\"$P256\",\"auth\":\"$AUTH\"}}"
prueba "Suscribe su celular"                 200 POST /api/app/notificaciones "$ALMA" "{\"endpoint\":\"$EP\",\"keys\":{\"p256dh\":\"$P256\",\"auth\":\"$AUTH\"}}"
prueba "Otra vez el mismo celular"           200 POST /api/app/notificaciones "$ALMA" "{\"endpoint\":\"$EP\",\"keys\":{\"p256dh\":\"$P256\",\"auth\":\"$AUTH\"}}"
prueba "Cuántos"                             200 GET  /api/app/notificaciones "$ALMA"
igual  "Un celular (no se duplica)"          "['datos']['celulares']" "1"
prueba "Lo quita"                            200 POST /api/app/notificaciones/quitar "$ALMA" "{\"endpoint\":\"$EP\"}"
igual  "Quitado"                             "['datos']['quitadas']" "1"
prueba "Sin sesión no se suscribe"           401 POST /api/app/notificaciones "" "{\"endpoint\":\"$EP\",\"keys\":{\"p256dh\":\"$P256\",\"auth\":\"$AUTH\"}}"

echo "Textos de los avisos"
prueba "Laura (admin) ve los textos"         200 GET  /api/avisos/plantillas "$LAU"
prueba "La instructora no"                   403 GET  /api/avisos/plantillas "$INS"
prueba "Textos"                              200 GET  /api/avisos/plantillas "$ADM"
igual  "4 avisos × 2 canales"                "count(\$j['datos']['plantillas'])" "8"
PL=$(campo "array_values(array_filter(\$j['datos']['plantillas'], fn(\$p) => \$p['evento'] === 'ausencia' && \$p['canal'] === 'whatsapp'))[0]['id']")
ORIG=$(campo "json_encode(array_values(array_filter(\$j['datos']['plantillas'], fn(\$p) => \$p['id'] == $PL))[0]['cuerpo'], JSON_UNESCAPED_UNICODE)")
prueba "Variable que no existe"              422 PUT  "/api/avisos/plantillas/$PL" "$ADM" '{"cuerpo":"Hola {nombre}, tu {mascota} te extraña"}'
prueba "Muy corto"                           422 PUT  "/api/avisos/plantillas/$PL" "$ADM" '{"cuerpo":"Hola"}'
prueba "Texto nuevo"                         200 PUT  "/api/avisos/plantillas/$PL" "$ADM" '{"cuerpo":"Hola {nombre}, {alumno} lleva {dias} días sin venir. ¡Te esperamos!"}'
prueba "Apagarlo"                            200 PUT  "/api/avisos/plantillas/$PL" "$ADM" '{"activa":false}'
prueba "Revisar"                             200 GET  /api/avisos/plantillas "$ADM"
igual  "Guardado y apagado"                  "implode('|', array_map(fn(\$p) => (\$p['activa'] ? 'on' : 'off') . ':' . \$p['cuerpo'], array_filter(\$j['datos']['plantillas'], fn(\$p) => \$p['id'] == $PL)))" "off:Hola {nombre}, {alumno} lleva {dias} días sin venir. ¡Te esperamos!"
prueba "Regresa el texto original"           200 PUT  "/api/avisos/plantillas/$PL" "$ADM" "{\"cuerpo\":$ORIG,\"activa\":true}"

echo "Dejar todo como estaba"
prueba "Cancela el examen de prueba"         200 PUT  "/api/examenes/$EX/estado" "$ADM" '{"estado":"cancelado"}'
for a in $VALE $NICO $ANA; do prueba "Baja del alumno de prueba $a" 200 PUT "/api/alumnos/$a/estado" "$ADM" '{"estado":"baja","motivo":"Prueba de avisos"}'; done
prueba "Pendientes"                          200 GET  /api/avisos "$ADM"
igual  "Con la baja, sus avisos se quitan solos" "count(array_filter(\$j['datos']['avisos'], fn(\$a) => in_array(\$a['telefono'], ['$TV','$TN','$TA'])))" "0"

echo; echo "Resultado: $pasa pasaron, $falla fallaron"; [ $falla -eq 0 ]
