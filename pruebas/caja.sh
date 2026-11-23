#!/usr/bin/env bash
# Pruebas de la fase 4 · Caja en mostrador. Uso: ./pruebas/caja.sh [http://localhost:8080]
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

MES=$(date +%Y-%m)

prueba "Login súper admin"                 200 POST /api/auth/login "" '{"email":"admin@dojoos.mx","password":"Dojo2026!"}'
ADM=$(campo "['datos']['token']")
prueba "Precio del examen"                 201 POST /api/precios "$ADM" '{"concepto_id":3,"monto":"450"}'
prueba "Precio del recargo"                201 POST /api/precios "$ADM" '{"concepto_id":5,"monto":"100"}'

echo "Familia de prueba: Rosa paga por Ana y Leo"
prueba "Alta de Ana con su mamá"           201 POST /api/alumnos "$ADM" "{\"sucursal_id\":1,\"nombre\":\"Ana\",\"apellido_paterno\":\"Caja$R\",\"fecha_nacimiento\":\"2015-05-10\",\"curp\":\"$(curp 150510)\",\"foto\":\"$FOTO\",\"responsable\":{\"nombre\":\"Rosa\",\"apellido_paterno\":\"Caja$R\",\"telefono\":\"2221234567\",\"parentesco\":\"madre\"}}"
A1=$(campo "['datos']['id']"); RESP=$(campo "['datos']['responsable_id']")
prueba "Alta de Leo, hermano"              201 POST /api/alumnos "$ADM" "{\"sucursal_id\":1,\"nombre\":\"Leo\",\"apellido_paterno\":\"Caja$R\",\"fecha_nacimiento\":\"2017-02-03\",\"curp\":\"$(curp 170203)\",\"foto\":\"$FOTO\",\"responsable\":{\"id\":$RESP,\"parentesco\":\"madre\"}}"
A2=$(campo "['datos']['id']")

echo "Estado de cuenta"
prueba "Estado de cuenta de Rosa"          200 GET  "/api/caja/estado-cuenta/$RESP" "$ADM"
igual  "Dos alumnos a su cargo"            "count(\$j['datos']['alumnos'])" "2"
igual  "Debe inscripción y mes de cada uno" "count(\$j['datos']['adeudos'])" "4"
igual  "Mensualidad del mes en curso"      "implode(',', array_filter(array_column(\$j['datos']['adeudos'], 'clave'), fn(\$c) => str_starts_with(\$c, 'mens:$A1')))" "mens:$A1:$MES"
igual  "Sin saldo a favor"                 "['datos']['saldo_favor']" "0.00"
# Lo que debería cobrar el servidor por inscripción + mes de Ana
ESPERA=$(campo "number_format(array_sum(array_map(fn(\$l) => \$l['precio'], array_filter(\$j['datos']['adeudos'], fn(\$l) => \$l['alumno_id'] == $A1))), 2, '.', '')")
prueba "Responsable que no existe"         404 GET  "/api/caja/estado-cuenta/999999" "$ADM"

echo "Cobro"
prueba "Sin conceptos"                     422 POST /api/caja/cobros "$ADM" "{\"responsable_id\":$RESP,\"metodo\":\"efectivo\",\"claves\":[]}"
prueba "Tarjeta no se cobra en caja"       422 POST /api/caja/cobros "$ADM" "{\"responsable_id\":$RESP,\"metodo\":\"pasarela\",\"claves\":[\"insc:$A1\"]}"
prueba "Transferencia sin rastreo"         422 POST /api/caja/cobros "$ADM" "{\"responsable_id\":$RESP,\"metodo\":\"transferencia\",\"claves\":[\"insc:$A1\"]}"
prueba "Adeudo que no existe"              409 POST /api/caja/cobros "$ADM" "{\"responsable_id\":$RESP,\"metodo\":\"efectivo\",\"claves\":[\"mens:$A1:2001-01\"]}"
prueba "Cotiza el ticket sin guardar"      200 POST /api/caja/cotizar "$ADM" "{\"responsable_id\":$RESP,\"metodo\":\"efectivo\",\"claves\":[\"insc:$A1\",\"mens:$A1:$MES\"]}"
igual  "Total de la cotización"            "['datos']['a_pagar']" "$ESPERA"
prueba "Cobra inscripción y mes de Ana"    201 POST /api/caja/cobros "$ADM" "{\"responsable_id\":$RESP,\"metodo\":\"efectivo\",\"claves\":[\"insc:$A1\",\"mens:$A1:$MES\"],\"total\":\"1.00\"}"
PAGO=$(campo "['datos']['id']"); FOLIO=$(campo "['datos']['folio']")
igual  "El servidor calcula el total (ignora el de la pantalla)" "['datos']['total']" "$ESPERA"
[[ "$FOLIO" =~ ^CENT-R[0-9]{2}-[0-9]{6}$ ]] && { pasa=$((pasa+1)); echo "  ok   Recibo con folio ($FOLIO)"; } || { falla=$((falla+1)); echo "  FALLA folio $FOLIO"; }
prueba "Ya no debe eso"                    200 GET  "/api/caja/estado-cuenta/$RESP" "$ADM"
igual  "Quedan los dos de Leo"             "count(\$j['datos']['adeudos'])" "2"
igual  "Aparece en sus pagos"              "\$j['datos']['pagos'][0]['folio']" "$FOLIO"
prueba "Cobrar lo mismo otra vez"          409 POST /api/caja/cobros "$ADM" "{\"responsable_id\":$RESP,\"metodo\":\"efectivo\",\"claves\":[\"insc:$A1\"]}"
prueba "Transferencia de Leo"              201 POST /api/caja/cobros "$ADM" "{\"responsable_id\":$RESP,\"metodo\":\"transferencia\",\"referencia\":\"RAS$R\",\"claves\":[\"insc:$A2\"]}"
PAGO2=$(campo "['datos']['id']")

echo "Recibo y corte"
prueba "Recibo"                            200 GET  "/api/caja/pagos/$PAGO" "$ADM"
igual  "Dos líneas"                        "count(\$j['datos']['lineas'])" "2"
igual  "Total del recibo"                  "['datos']['total']" "$ESPERA"
prueba "Recibo que no existe"              404 GET  "/api/caja/pagos/999999" "$ADM"
prueba "Corte de hoy"                      200 GET  "/api/caja/corte?sucursal_id=1" "$ADM"
igual  "El pago está en el corte"          "in_array('$FOLIO', array_column(\$j['datos']['pagos'], 'folio')) ? 'si' : 'no'" "si"
igual  "Efectivo + transferencia = total"  "abs(\$j['datos']['total'] - \$j['datos']['por_metodo']['efectivo'] - \$j['datos']['por_metodo']['transferencia'] - \$j['datos']['por_metodo']['pasarela']) < 0.005 ? 'si' : 'no'" "si"
prueba "Fecha mal escrita"                 422 GET  "/api/caja/corte?fecha=ayer" "$ADM"

echo "Permisos por rol y sucursal"
prueba "Login Laura"                       200 POST /api/auth/login "" '{"email":"laura@dojoos.mx","password":"Dojo2026!"}'
LAU=$(campo "['datos']['token']"); ADMN=$(campo "['datos']['roles'][0]['usuario_rol_id']"); INST=$(campo "['datos']['roles'][1]['usuario_rol_id']")
prueba "Laura como instructora"            200 POST /api/auth/rol "$LAU" "{\"usuario_rol_id\":$INST}"
prueba "Instructor no cobra"               403 POST /api/caja/cobros "$LAU" "{\"responsable_id\":$RESP,\"metodo\":\"efectivo\",\"claves\":[\"mens:$A2:$MES\"]}"
prueba "Instructor no hace corte"          403 GET  /api/caja/corte "$LAU"
prueba "Laura como admin de Norte"         200 POST /api/auth/rol "$LAU" "{\"usuario_rol_id\":$ADMN}"
prueba "No ve recibos de Centro"           403 GET  "/api/caja/pagos/$PAGO" "$LAU"
prueba "Estado de cuenta: solo su sucursal" 200 GET "/api/caja/estado-cuenta/$RESP" "$LAU"
igual  "Ningún adeudo de Centro"           "count(\$j['datos']['adeudos'])" "0"
prueba "No cancela pagos de Centro"        403 PUT  "/api/caja/pagos/$PAGO/cancelar" "$LAU" '{"motivo":"prueba"}'

echo "Cancelación"
prueba "Cancelar sin motivo"               422 PUT  "/api/caja/pagos/$PAGO/cancelar" "$ADM" '{}'
prueba "Cancela el pago de Ana"            200 PUT  "/api/caja/pagos/$PAGO/cancelar" "$ADM" '{"motivo":"Se cobró de más"}'
prueba "Cancelar dos veces"                409 PUT  "/api/caja/pagos/$PAGO/cancelar" "$ADM" '{"motivo":"otra vez"}'
prueba "Vuelve a deber lo de Ana"          200 GET  "/api/caja/estado-cuenta/$RESP" "$ADM"
igual  "Tres adeudos otra vez"             "count(\$j['datos']['adeudos'])" "3"
prueba "Corte marca el cancelado"          200 GET  "/api/caja/corte?sucursal_id=1" "$ADM"
igual  "Cancelado en el corte"             "\$j['datos']['cancelados'] >= 1 ? 'si' : 'no'" "si"
prueba "Recibo cancelado sigue visible"    200 GET  "/api/caja/pagos/$PAGO" "$ADM"
igual  "Estado del recibo"                 "['datos']['estado']" "reembolsado"
prueba "Ana pasa a baja"                   200 PUT  "/api/alumnos/$A1/estado" "$ADM" '{"estado":"baja"}'
prueba "De baja ya no genera mensualidad"  200 GET  "/api/caja/estado-cuenta/$RESP" "$ADM"
igual  "Solo queda el mes de Leo"          "count(\$j['datos']['adeudos'])" "1"

echo; echo "Resultado: $pasa pasaron, $falla fallaron"; [ $falla -eq 0 ]
