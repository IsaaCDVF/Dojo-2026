#!/usr/bin/env bash
# Pruebas de recepción en Caja: lista "Por cobrar" y cobro con tarjeta por QR de Mercado Pago (en modo prueba, no se cobra nada).
# Uso: ./pruebas/caja_qr.sh [http://localhost:8080]. Crea su propia recepcionista y alumnos; al final los desactiva/da de baja
# y deja Pagos en línea en el modo que tenías.
API=${1:-http://localhost:8080}
pasa=0; falla=0
prueba() { local cod; cod=$(curl -s -o /tmp/r.json -w '%{http_code}' -X "$3" "$API$4" -H 'Content-Type: application/json' ${5:+-H "Authorization: Bearer $5"} ${6:+-d "$6"} "${@:7}")
  if [ "$cod" = "$2" ]; then pasa=$((pasa+1)); echo "  ok   $1 ($cod)"; else falla=$((falla+1)); echo "  FALLA $1: esperaba $2, llegó $cod → $(head -c 300 /tmp/r.json)"; fi; }
campo() { php -r '$j=json_decode(file_get_contents("/tmp/r.json"),true); $e=$argv[1]; echo eval("return ".($e[0]==="[" ? "\$j$e" : $e).";");' -- "$1"; }
igual() { local v; v=$(campo "$2"); if [ "$v" = "$3" ]; then pasa=$((pasa+1)); echo "  ok   $1 ($v)"; else falla=$((falla+1)); echo "  FALLA $1: esperaba $3, llegó $v"; fi; }
L=BCDFGHJKLMNPQRSTVWXZ; c() { echo -n "${L:$((RANDOM%20)):1}"; }
curp() { echo "CAQR$1HPL$(c)$(c)$(c)0$((RANDOM%10))"; }
FOTO='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
R=$RANDOM; TC="22233$(printf '%05d' $R)"; TN="22244$(printf '%05d' $R)"; CORREO="recep$R@prueba.mx"
ALTA=$(date -d "-40 days" +%Y-%m-%d)
en() { echo "count(array_filter(\$j['datos']['cuentas'], fn(\$c) => \$c['telefono'] === '$1'))"; }

prueba "Login súper admin"                   200 POST /api/auth/login "" '{"email":"admin@dojoos.mx","password":"Dojo2026!"}'; ADM=$(campo "['datos']['token']")
prueba "Sucursales"                          200 GET  /api/sucursales "$ADM"
CENT=$(campo "array_column(\$j['datos'], 'id', 'clave')['CENT']"); NORT=$(campo "array_column(\$j['datos'], 'id', 'clave')['NORT']")
for x in '1 650' '2 500' '5 100'; do set -- $x; prueba "Precio del concepto $1" 201 POST /api/precios "$ADM" "{\"concepto_id\":$1,\"monto\":\"$2\"}"; done
prueba "Pagos en línea: cómo está"           200 GET  /api/pasarela "$ADM"; MODO=$(campo "['datos']['modo']")
prueba "Modo prueba"                         200 PUT  /api/pasarela "$ADM" '{"modo":"prueba"}'

echo "La recepcionista de Centro"
prueba "Alta de Rebeca (recepción Centro)"   201 POST /api/personal "$ADM" "{\"nombre\":\"Rebeca\",\"apellido_paterno\":\"Caja$R\",\"fecha_nacimiento\":\"1998-04-10\",\"email\":\"$CORREO\",\"roles\":[{\"rol\":\"recepcion\",\"sucursal_id\":$CENT}]}"
RID=$(campo "['datos']['usuario_id']"); TEMP=$(campo "['datos']['password_temporal']")
prueba "Entra con la temporal"               200 POST /api/auth/login "" "{\"email\":\"$CORREO\",\"password\":\"$TEMP\"}"; REC=$(campo "['datos']['token']")
prueba "Crea su contraseña"                  200 PUT  /api/auth/contrasena "$REC" "{\"actual\":\"$TEMP\",\"nueva\":\"Rebeca2026x\"}"
prueba "Entra"                               200 POST /api/auth/login "" "{\"email\":\"$CORREO\",\"password\":\"Rebeca2026x\"}"; REC=$(campo "['datos']['token']")
prueba "No ve las llaves de Mercado Pago"    403 GET  /api/pasarela "$REC"

echo "Quién debe"
prueba "Vale (Centro), vencida"              201 POST /api/alumnos "$ADM" "{\"sucursal_id\":$CENT,\"nombre\":\"Vale\",\"apellido_paterno\":\"Qr$R\",\"fecha_nacimiento\":\"2014-02-11\",\"fecha_alta\":\"$ALTA\",\"curp\":\"$(curp 140211)\",\"foto\":\"$FOTO\",\"responsable\":{\"nombre\":\"Clara\",\"apellido_paterno\":\"Qr$R\",\"telefono\":\"$TC\",\"parentesco\":\"madre\"}}"
VALE=$(campo "['datos']['id']"); RC=$(campo "['datos']['responsable_id']")
prueba "Nora (Norte), vencida"               201 POST /api/alumnos "$ADM" "{\"sucursal_id\":$NORT,\"nombre\":\"Nora\",\"apellido_paterno\":\"Qr$R\",\"fecha_nacimiento\":\"2014-03-11\",\"fecha_alta\":\"$ALTA\",\"curp\":\"$(curp 140311)\",\"foto\":\"$FOTO\",\"responsable\":{\"nombre\":\"Nadia\",\"apellido_paterno\":\"Qr$R\",\"telefono\":\"$TN\",\"parentesco\":\"madre\"}}"
NORA=$(campo "['datos']['id']"); RN=$(campo "['datos']['responsable_id']")
prueba "Por cobrar (recepción)"              200 GET  "/api/caja/por-cobrar?dias=7" "$REC"
igual  "Clara aparece"                       "$(en $TC)" "1"
igual  "Como vencida, con su total"          "implode(',', array_map(fn(\$c) => \$c['estado'] . ':' . (\$c['total'] > 0 ? 'debe' : 'no'), array_filter(\$j['datos']['cuentas'], fn(\$c) => \$c['telefono'] === '$TC')))" "vencido:debe"
igual  "Con el nombre de Vale"               "implode(',', array_merge(...array_map(fn(\$c) => \$c['alumnos'], array_filter(\$j['datos']['cuentas'], fn(\$c) => \$c['telefono'] === '$TC'))))" "Vale Qr$R"
igual  "No ve a Nadia (es de Norte)"         "$(en $TN)" "0"
igual  "Vencidos primero"                    "\$j['datos']['cuentas'][0]['estado']" "vencido"
prueba "El súper admin ve todas"             200 GET  /api/caja/por-cobrar "$ADM"
igual  "Nadia también"                       "$(en $TN)" "1"
prueba "Solo Norte"                          200 GET  "/api/caja/por-cobrar?sucursal_id=$NORT" "$ADM"
igual  "Sin Clara"                           "$(en $TC)" "0"

echo "Cobro con tarjeta (QR)"
prueba "Cuenta de Clara"                     200 GET  "/api/caja/estado-cuenta/$RC" "$REC"
igual  "Se puede cobrar con QR (prueba)"     "['datos']['cobro_qr']" "prueba"
CLAVES=$(campo "json_encode(array_column(\$j['datos']['adeudos'], 'clave'))")
MENS=$(campo "json_encode(array_values(array_filter(array_column(\$j['datos']['adeudos'], 'clave'), fn(\$k) => str_starts_with(\$k, 'mens:'))))")
prueba "Sin marcar nada"                     422 POST /api/caja/cobro-qr "$REC" "{\"responsable_id\":$RC,\"claves\":[]}"
prueba "Cuenta de otra sucursal"             409 POST /api/caja/cobro-qr "$REC" "{\"responsable_id\":$RN,\"claves\":[\"insc:$NORA\"]}"
prueba "QR por todo lo de Clara"             201 POST /api/caja/cobro-qr "$REC" "{\"responsable_id\":$RC,\"claves\":$CLAVES}"
Q1=$(campo "['datos']['pago_id']")
igual  "Modo prueba"                         "['datos']['origen']" "prueba"
igual  "Con total"                           "\$j['datos']['total'] > 0 ? 'si' : 'no'" "si"
prueba "Otra vez lo mismo: ya está en proceso" 409 POST /api/caja/cobro-qr "$REC" "{\"responsable_id\":$RC,\"claves\":$CLAVES}"
prueba "Cómo va"                             200 GET  "/api/caja/cobro-qr/$Q1" "$REC"
igual  "Esperando"                           "['datos']['estado']" "pendiente"
prueba "La cuenta lo marca en proceso"       200 GET  "/api/caja/estado-cuenta/$RC" "$REC"
igual  "Todas sus líneas"                    "count(array_filter(\$j['datos']['adeudos'], fn(\$l) => (\$l['en_linea']['pago_id'] ?? 0) == $Q1)) == count(\$j['datos']['adeudos']) ? 'si' : 'no'" "si"
prueba "Resultado inventado"                 422 POST "/api/caja/cobro-qr/$Q1/prueba" "$REC" '{"resultado":"oxxo"}'
prueba "Tarjeta rechazada"                   200 POST "/api/caja/cobro-qr/$Q1/prueba" "$REC" '{"resultado":"rechazado"}'
igual  "Rechazada con mensaje"               "\$j['datos']['estado'] . ':' . (\$j['datos']['mensaje_usuario'] ? 'msg' : '')" "rechazado:msg"
prueba "Intenta con otra tarjeta: pasa"      200 POST "/api/caja/cobro-qr/$Q1/prueba" "$REC" '{"resultado":"aprobado"}'
igual  "Pagado con folio"                    "\$j['datos']['estado'] . ':' . (preg_match('/-R\\d{2}-\\d{6}\$/', (string) \$j['datos']['folio']) ? 'folio' : 'sin')" "aprobado:folio"
prueba "El recibo dice QR en caja"           200 GET  "/api/caja/pagos/$Q1" "$REC"
igual  "Cobró"                               "str_starts_with(\$j['datos']['cobro'], 'QR en caja · $CORREO') ? 'si' : 'no'" "si"
prueba "Ya no debe nada"                     200 GET  "/api/caja/estado-cuenta/$RC" "$REC"
igual  "Sin adeudos"                         "count(\$j['datos']['adeudos'])" "0"
prueba "Por cobrar"                          200 GET  /api/caja/por-cobrar "$REC"
igual  "Clara ya no aparece"                 "$(en $TC)" "0"
prueba "Un cobro pagado no se cancela"       409 PUT  "/api/caja/cobro-qr/$Q1/cancelar" "$REC"
prueba "El corte lo cuenta"                  200 GET  /api/caja/corte "$ADM"
igual  "Aparece en el corte"                 "count(array_filter(\$j['datos']['pagos'], fn(\$p) => \$p['id'] == $Q1))" "1"

echo "Cancelar un QR"
prueba "Cuenta de Nadia (admin)"             200 GET  "/api/caja/estado-cuenta/$RN" "$ADM"
CN=$(campo "json_encode(array_values(array_filter(array_column(\$j['datos']['adeudos'], 'clave'), fn(\$k) => str_starts_with(\$k, 'mens:') || str_starts_with(\$k, 'rec:'))))")
prueba "QR para Nadia"                       201 POST /api/caja/cobro-qr "$ADM" "{\"responsable_id\":$RN,\"claves\":$CN}"; Q2=$(campo "['datos']['pago_id']")
prueba "Rebeca no ve cobros de Norte"        403 GET  "/api/caja/cobro-qr/$Q2" "$REC"
prueba "Un pago de la app no es de caja"     404 GET  /api/caja/cobro-qr/99999999 "$ADM"
prueba "Se arrepiente: cancelar"             200 PUT  "/api/caja/cobro-qr/$Q2/cancelar" "$ADM"
igual  "Cancelado"                           "\$j['datos']['estado'] . ':' . \$j['datos']['codigo_respuesta']" "rechazado:cancelado"
prueba "Ya no está en proceso"               200 GET  "/api/caja/estado-cuenta/$RN" "$ADM"
igual  "Sin pago en línea"                   "count(array_filter(\$j['datos']['adeudos'], fn(\$l) => !empty(\$l['en_linea'])))" "0"
prueba "Paga en efectivo"                    201 POST /api/caja/cobros "$ADM" "{\"responsable_id\":$RN,\"metodo\":\"efectivo\",\"claves\":$CN}"
prueba "El cancelado no sale en el corte"    200 GET  /api/caja/corte "$ADM"
igual  "No está"                             "count(array_filter(\$j['datos']['pagos'], fn(\$p) => \$p['id'] == $Q2))" "0"

echo "Con el cobro en línea apagado"
prueba "Apagado"                             200 PUT  /api/pasarela "$ADM" '{"modo":"apagado"}'
prueba "No genera QR"                        409 POST /api/caja/cobro-qr "$ADM" "{\"responsable_id\":$RN,\"claves\":[\"insc:$NORA\"]}"

echo "Dejar todo como estaba"
prueba "Regresa al modo que tenía ($MODO)"   200 PUT  /api/pasarela "$ADM" "{\"modo\":\"$MODO\"}"
for a in $VALE $NORA; do prueba "Baja del alumno de prueba $a" 200 PUT "/api/alumnos/$a/estado" "$ADM" '{"estado":"baja","motivo":"Prueba de caja con QR"}'; done
prueba "Desactiva a Rebeca"                  200 PUT  "/api/personal/$RID" "$ADM" '{"activo":0}'

echo; echo "Resultado: $pasa pasaron, $falla fallaron"; [ $falla -eq 0 ]
