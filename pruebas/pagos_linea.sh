#!/usr/bin/env bash
# Pruebas del pago en línea desde la app (Mercado Pago) usando el modo prueba (no se cobra nada ni se habla con Mercado Pago).
# Uso: ./pruebas/pagos_linea.sh [http://localhost:8080]. Crea sus propios datos; al final deja la configuración de pagos como estaba
# (si ya tienes tus llaves de Mercado Pago, no las toca y se salta lo que las necesita).
API=${1:-http://localhost:8080}
pasa=0; falla=0
prueba() { local cod; cod=$(curl -s -o /tmp/r.json -w '%{http_code}' -X "$3" "$API$4" -H 'Content-Type: application/json' ${5:+-H "Authorization: Bearer $5"} ${6:+-d "$6"} "${@:7}")
  if [ "$cod" = "$2" ]; then pasa=$((pasa+1)); echo "  ok   $1 ($cod)"; else falla=$((falla+1)); echo "  FALLA $1: esperaba $2, llegó $cod → $(head -c 300 /tmp/r.json)"; fi; }
campo() { php -r '$j=json_decode(file_get_contents("/tmp/r.json"),true); $e=$argv[1]; echo eval("return ".($e[0]==="[" ? "\$j$e" : $e).";");' -- "$1"; }
igual() { local v; v=$(campo "$2"); if [ "$v" = "$3" ]; then pasa=$((pasa+1)); echo "  ok   $1 ($v)"; else falla=$((falla+1)); echo "  FALLA $1: esperaba $3, llegó $v"; fi; }
L=BCDFGHJKLMNPQRSTVWXZ; c() { echo -n "${L:$((RANDOM%20)):1}"; }
curp() { echo "PEGA$1HPL$(c)$(c)$(c)0$((RANDOM%10))"; }
FOTO='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
R=$RANDOM; TEL="22266$(printf '%05d' $R)"; TEL2="22255$(printf '%05d' $R)"

prueba "Login súper admin"                   200 POST /api/auth/login "" '{"email":"admin@dojoos.mx","password":"Dojo2026!"}'; ADM=$(campo "['datos']['token']")
prueba "Login Laura"                         200 POST /api/auth/login "" '{"email":"laura@dojoos.mx","password":"Dojo2026!"}'; LAU=$(campo "['datos']['token']")
prueba "Roles de Laura"                      200 GET  /api/auth/yo "$LAU"
ADMN=$(campo "array_column(\$j['datos']['roles'], 'usuario_rol_id', 'rol')['admin_sucursal']")
prueba "Laura como admin de Norte"           200 POST /api/auth/rol "$LAU" "{\"usuario_rol_id\":$ADMN}"
prueba "Precio de la mensualidad"            201 POST /api/precios "$ADM" '{"concepto_id":1,"monto":"650"}'
prueba "Precio de la inscripción"            201 POST /api/precios "$ADM" '{"concepto_id":2,"monto":"500"}'

echo "Configuración (solo el súper admin)"
prueba "Cómo está"                           200 GET  /api/pasarela "$ADM"
MODO=$(campo "['datos']['modo']"); TOKEN=$(campo "\$j['datos']['tiene_token'] ? 'si' : 'no'"); SECRETO=$(campo "\$j['datos']['tiene_secreto'] ? 'si' : 'no'")
prueba "Laura no la ve"                      403 GET  /api/pasarela "$LAU"
prueba "Modo inventado"                      422 PUT  /api/pasarela "$ADM" '{"modo":"gratis"}'
prueba "Access Token mal copiado"            422 PUT  /api/pasarela "$ADM" '{"access_token":"hola"}'
prueba "Dirección pública sin http"          422 PUT  /api/pasarela "$ADM" '{"url_publica":"midojo"}'
if [ "$TOKEN" = "no" ]; then prueba "Cobrar de verdad sin token" 422 PUT /api/pasarela "$ADM" '{"modo":"real"}'; fi
prueba "Modo prueba"                         200 PUT  /api/pasarela "$ADM" '{"modo":"prueba"}'

echo "La mamá entra a la app"
prueba "Alta de Sofi con su mamá"            201 POST /api/alumnos "$ADM" "{\"sucursal_id\":1,\"nombre\":\"Sofi\",\"apellido_paterno\":\"Pago$R\",\"fecha_nacimiento\":\"2014-02-11\",\"curp\":\"$(curp 140211)\",\"foto\":\"$FOTO\",\"responsable\":{\"nombre\":\"Rosa\",\"apellido_paterno\":\"Pago$R\",\"telefono\":\"$TEL\",\"parentesco\":\"madre\"}}"
SOFI=$(campo "['datos']['id']"); RESP=$(campo "['datos']['responsable_id']")
prueba "Alta de Tomás, hermano"              201 POST /api/alumnos "$ADM" "{\"sucursal_id\":1,\"nombre\":\"Tomás\",\"apellido_paterno\":\"Pago$R\",\"fecha_nacimiento\":\"2016-03-03\",\"curp\":\"$(curp 160303)\",\"foto\":\"$FOTO\",\"responsable\":{\"id\":$RESP,\"parentesco\":\"madre\"}}"
TOM=$(campo "['datos']['id']")
prueba "Acceso para la mamá"                 201 POST "/api/alumnos/$SOFI/app" "$ADM" "{\"para\":\"responsable\",\"responsable_id\":$RESP}"
CR=$(campo "['datos']['codigo']")
prueba "Activa su cuenta"                    200 POST /api/app/activar "" "{\"usuario\":\"$TEL\",\"codigo\":\"$CR\",\"password\":\"Rosa2026!\"}"
ROSA=$(campo "['datos']['token']")
prueba "Su familia"                          200 GET  /api/app/familia "$ROSA"
igual  "Pago en línea en modo prueba"        "['datos']['pago_en_linea']" "prueba"
INSC="insc:$SOFI"; MENS=$(campo "array_values(array_filter(array_column(\$j['datos']['adeudos'], 'clave'), fn(\$k) => str_starts_with(\$k, 'mens:$SOFI:')))[0]")
INST="insc:$TOM"

echo "Pagar en línea"
prueba "Sin elegir nada"                     422 POST /api/app/pagos-en-linea "$ROSA" '{"claves":[]}'
prueba "Una clave que no es suya"            409 POST /api/app/pagos-en-linea "$ROSA" '{"claves":["insc:999999"]}'
prueba "Inscripción y mensualidad de Sofi"   201 POST /api/app/pagos-en-linea "$ROSA" "{\"claves\":[\"$INSC\",\"$MENS\"]}"
P1=$(campo "['datos']['pago_id']")
igual  "Total que calcula el servidor"       "['datos']['total']" "1150.00"
igual  "En prueba abre la página de la app"  "['datos']['url'] . ' ' . \$j['datos']['origen']" "/app/pago/$P1 prueba"
prueba "Otra vez lo mismo: ya está en proceso" 409 POST /api/app/pagos-en-linea "$ROSA" "{\"claves\":[\"$INSC\"]}"
igual  "Dice cuál"                           "['detalle']['pago_id']" "$P1"
prueba "Cómo va"                             200 GET  "/api/app/pagos-en-linea/$P1" "$ROSA"
igual  "Pendiente y vigente"                 "\$j['datos']['estado'] . ' ' . (\$j['datos']['vigente'] ? 'si' : 'no')" "pendiente si"
prueba "En su familia sale en proceso"       200 GET  /api/app/familia "$ROSA"
igual  "Marcado"                             "count(array_filter(\$j['datos']['adeudos'], fn(\$l) => !empty(\$l['en_linea'])))" "2"
prueba "Recepción no ve pagos ajenos de la app" 404 GET "/api/app/pagos-en-linea/$P1" "$ADM"
prueba "El banco la rechaza"                 200 POST "/api/app/pagos-en-linea/$P1/prueba" "$ROSA" '{"resultado":"rechazado"}'
igual  "Rechazado: fondos insuficientes"     "\$j['datos']['estado'] . ' ' . \$j['datos']['codigo_respuesta']" "rechazado fondos_insuficientes"
igual  "Con mensaje para la persona y reintento" "(str_contains(\$j['datos']['mensaje_usuario'], 'fondos') ? 'si' : 'no') . ' ' . (\$j['datos']['permite_reintento'] ? 'si' : 'no')" "si si"
prueba "Resultado de prueba inventado"       422 POST "/api/app/pagos-en-linea/$P1/prueba" "$ROSA" '{"resultado":"magia"}'
prueba "Reintenta: pago nuevo"               201 POST /api/app/pagos-en-linea "$ROSA" "{\"claves\":[\"$INSC\",\"$MENS\"]}"
P2=$(campo "['datos']['pago_id']")
prueba "Pagar la ficha antes de generarla"   409 POST "/api/app/pagos-en-linea/$P2/prueba" "$ROSA" '{"resultado":"pagar_ficha"}'
prueba "Elige OXXO"                          200 POST "/api/app/pagos-en-linea/$P2/prueba" "$ROSA" '{"resultado":"oxxo"}'
igual  "Pendiente con ficha"                 "\$j['datos']['estado'] . ' ' . \$j['datos']['medio'] . ' ' . (\$j['datos']['ficha_url'] ? 'ficha' : 'sin ficha')" "pendiente ticket ficha"
prueba "Recepción ve que está en proceso"    200 GET  "/api/caja/estado-cuenta/$RESP" "$ADM"
igual  "Con su pago en línea"                "count(array_filter(\$j['datos']['adeudos'], fn(\$l) => (\$l['en_linea']['pago_id'] ?? 0) == $P2))" "2"
prueba "Paga en el OXXO"                     200 POST "/api/app/pagos-en-linea/$P2/prueba" "$ROSA" '{"resultado":"pagar_ficha"}'
igual  "Aprobado con folio"                  "\$j['datos']['estado'] . ' ' . (preg_match('/^CENT-R\\d{2}-\\d{6}\$/', \$j['datos']['folio']) ? 'folio' : 'sin folio')" "aprobado folio"
prueba "Llega otra vez el mismo aviso"       200 POST "/api/app/pagos-en-linea/$P2/prueba" "$ROSA" '{"resultado":"pagar_ficha"}'
igual  "No cambia el folio ni se duplica"    "\$j['datos']['estado']" "aprobado"
prueba "Ya no lo debe"                       200 GET  /api/app/familia "$ROSA"
igual  "Sin la inscripción ni el mes de Sofi" "count(array_filter(\$j['datos']['adeudos'], fn(\$l) => in_array(\$l['clave'], ['$INSC', '$MENS'])))" "0"
igual  "En sus pagos, en línea"              "implode(',', array_map(fn(\$p) => \$p['metodo'] . ':' . \$p['estado'], array_filter(\$j['datos']['pagos'], fn(\$p) => \$p['id'] == $P2)))" "pasarela:aprobado"
igual  "El rechazado no se lista"            "count(array_filter(\$j['datos']['pagos'], fn(\$p) => \$p['id'] == $P1))" "0"
prueba "Su recibo"                           200 GET  "/api/app/pagos/$P2" "$ROSA"
igual  "Pagado"                              "['datos']['pagado']" "1150.00"
prueba "En el corte de hoy de Centro"        200 GET  "/api/caja/corte?sucursal_id=1" "$ADM"
igual  "Cuenta como en línea"                "\$j['datos']['por_metodo']['pasarela'] >= 1150 ? 'si' : 'no'" "si"
igual  "Sin el intento rechazado"            "count(array_filter(\$j['datos']['pagos'], fn(\$p) => \$p['id'] == $P1))" "0"
igual  "Quién cobró: la app"                 "implode(',', array_column(array_filter(\$j['datos']['pagos'], fn(\$p) => \$p['id'] == $P2), 'cobro'))" "App · en línea"
prueba "Bitácora"                            200 GET  "/api/bitacora?tabla=pagos&registro_id=$P2" "$ADM"

echo "Lo pagaron en caja mientras la ficha seguía viva"
prueba "Ficha OXXO para la inscripción de Tomás" 201 POST /api/app/pagos-en-linea "$ROSA" "{\"claves\":[\"$INST\"]}"
P3=$(campo "['datos']['pago_id']")
prueba "Genera la ficha"                     200 POST "/api/app/pagos-en-linea/$P3/prueba" "$ROSA" '{"resultado":"oxxo"}'
prueba "El papá la paga en caja"             201 POST /api/caja/cobros "$ADM" "{\"responsable_id\":$RESP,\"metodo\":\"efectivo\",\"claves\":[\"$INST\"]}"
prueba "Y también paga la ficha"             200 POST "/api/app/pagos-en-linea/$P3/prueba" "$ROSA" '{"resultado":"pagar_ficha"}'
igual  "Aprobado, y lo repetido queda a su favor" "\$j['datos']['estado'] . ' ' . \$j['datos']['a_favor']" "aprobado 500.00"
prueba "Su saldo a favor"                    200 GET  /api/app/familia "$ROSA"
igual  "500 pesos"                           "\$j['datos']['saldo_favor'] >= 500 ? 'si' : 'no'" "si"

echo "Ficha que vence"
prueba "SPEI de la mensualidad de Tomás"     201 POST /api/app/pagos-en-linea "$ROSA" "{\"claves\":[\"$(curl -s "$API/api/app/familia" -H "Authorization: Bearer $ROSA" | php -r '$j=json_decode(stream_get_contents(STDIN),true); foreach($j["datos"]["adeudos"] as $l) if(str_starts_with($l["clave"],"mens:'$TOM':")) { echo $l["clave"]; break; }')\"]}"
P4=$(campo "['datos']['pago_id']")
prueba "Genera los datos de SPEI"            200 POST "/api/app/pagos-en-linea/$P4/prueba" "$ROSA" '{"resultado":"spei"}'
igual  "Transferencia"                       "['datos']['medio']" "bank_transfer"
prueba "Venció sin pagar"                    200 POST "/api/app/pagos-en-linea/$P4/prueba" "$ROSA" '{"resultado":"vencer"}'
igual  "Cancelado, puede generar otra"       "\$j['datos']['estado'] . ' ' . \$j['datos']['codigo_respuesta'] . ' ' . (\$j['datos']['permite_reintento'] ? 'si' : 'no')" "rechazado cancelado si"

echo "Otra mamá no ve lo de Rosa"
prueba "Alta de Iker con su papá"            201 POST /api/alumnos "$ADM" "{\"sucursal_id\":1,\"nombre\":\"Iker\",\"apellido_paterno\":\"Pago$R\",\"fecha_nacimiento\":\"2015-05-05\",\"curp\":\"$(curp 150505)\",\"foto\":\"$FOTO\",\"responsable\":{\"nombre\":\"Hugo\",\"apellido_paterno\":\"Pago$R\",\"telefono\":\"$TEL2\",\"parentesco\":\"padre\"}}"
IKER=$(campo "['datos']['id']"); RESP2=$(campo "['datos']['responsable_id']")
prueba "Acceso para el papá"                 201 POST "/api/alumnos/$IKER/app" "$ADM" "{\"para\":\"responsable\",\"responsable_id\":$RESP2}"
CH=$(campo "['datos']['codigo']")
prueba "Activa"                              200 POST /api/app/activar "" "{\"usuario\":\"$TEL2\",\"codigo\":\"$CH\",\"password\":\"Hugo2026!\"}"
HUGO=$(campo "['datos']['token']")
prueba "No ve el pago de Rosa"               404 GET  "/api/app/pagos-en-linea/$P2" "$HUGO"
prueba "No simula en el pago de Rosa"        404 POST "/api/app/pagos-en-linea/$P2/prueba" "$HUGO" '{"resultado":"aprobado"}'
prueba "No paga lo de Sofi"                  409 POST /api/app/pagos-en-linea "$HUGO" "{\"claves\":[\"$MENS\"]}"

echo "Avisos de Mercado Pago (webhook)"
prueba "Aviso sin firma, sin clave configurada: se ignora si no es pago" 200 POST /api/pagos-en-linea/aviso "" '{"type":"merchant_order","data":{"id":"1"}}'
if [ "$SECRETO" = "no" ]; then
  SEC="secreto-de-prueba-$R-0123456789abcdef"
  prueba "Clave de los avisos"               200 PUT  /api/pasarela "$ADM" "{\"webhook_secret\":\"$SEC\"}"
  TS=$(date +%s); RID="req-$R"
  FIRMA=$(php -r 'echo hash_hmac("sha256", "id:123;request-id:'"$RID"';ts:'"$TS"';", "'"$SEC"'");')
  prueba "Aviso con firma falsa"             401 POST "/api/pagos-en-linea/aviso?type=payment&data.id=123" "" '{"type":"payment","data":{"id":"123"}}' -H "x-signature: ts=$TS,v1=falsa" -H "x-request-id: $RID"
  prueba "Aviso sin firma"                   401 POST "/api/pagos-en-linea/aviso?type=payment&data.id=123" "" '{"type":"payment","data":{"id":"123"}}'
  prueba "Aviso con firma buena (en prueba no se consulta)" 200 POST "/api/pagos-en-linea/aviso?type=payment&data.id=123" "" '{"type":"payment","data":{"id":"123"}}' -H "x-signature: ts=$TS,v1=$FIRMA" -H "x-request-id: $RID"
  igual  "Ignorado (no está en modo real)"   "\$j['datos']['ignorado'] ? 'si' : 'no'" "si"
  prueba "Quita la clave de prueba"          200 PUT  /api/pasarela "$ADM" '{"webhook_secret":""}'
else echo "  (ya tienes clave de avisos: se saltan las pruebas de firma)"; fi
if [ "$TOKEN" = "no" ]; then
  prueba "Token de prueba (no es de verdad)" 200 PUT  /api/pasarela "$ADM" '{"access_token":"TEST-0000000000000000-000000-00000000000000000000000000000000-000000000","modo":"real"}'
  igual  "Se guarda oculto"                  "\$j['datos']['tiene_token'] && \$j['datos']['token_final'] === '0000' && !isset(\$j['datos']['access_token']) ? 'si' : 'no'" "si"
  prueba "En modo real ya no hay simulación" 409 POST "/api/app/pagos-en-linea/$P4/prueba" "$ROSA" '{"resultado":"aprobado"}'
  prueba "Borra el token de prueba"          200 PUT  /api/pasarela "$ADM" '{"modo":"prueba","access_token":""}'
else echo "  (ya tienes Access Token: no se toca)"; fi
prueba "Apagado"                             200 PUT  /api/pasarela "$ADM" '{"modo":"apagado"}'
prueba "Apagado: no deja pagar en línea"     409 POST /api/app/pagos-en-linea "$ROSA" '{"claves":["x"]}'

echo "Dejar todo como estaba"
prueba "Regresa al modo que tenía ($MODO)"   200 PUT  /api/pasarela "$ADM" "{\"modo\":\"$MODO\"}"
for a in $SOFI $TOM $IKER; do prueba "Baja del alumno de prueba $a" 200 PUT "/api/alumnos/$a/estado" "$ADM" '{"estado":"baja","motivo":"Prueba de pagos en línea"}'; done

echo; echo "Resultado: $pasa pasaron, $falla fallaron"; [ $falla -eq 0 ]
