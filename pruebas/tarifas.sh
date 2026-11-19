#!/usr/bin/env bash
# Pruebas de la tarea 2.3 Tarifas y promociones. Uso: ./pruebas/tarifas.sh [http://localhost:8080]
# Crea sus propios datos (concepto, precios y promociones con nombres al azar), así se puede correr varias veces.
API=${1:-http://localhost:8080}
pasa=0; falla=0
prueba() { local cod; cod=$(curl -s -o /tmp/r.json -w '%{http_code}' -X "$3" "$API$4" -H 'Content-Type: application/json' ${5:+-H "Authorization: Bearer $5"} ${6:+-d "$6"})
  if [ "$cod" = "$2" ]; then pasa=$((pasa+1)); echo "  ok   $1 ($cod)"; else falla=$((falla+1)); echo "  FALLA $1: esperaba $2, llegó $cod → $(cat /tmp/r.json)"; fi; }
campo() { php -r '$j=json_decode(file_get_contents("/tmp/r.json"),true); echo eval("return \$j$argv[1];");' -- "$1"; }
igual() { local v; v=$(campo "$2"); if [ "$v" = "$3" ]; then pasa=$((pasa+1)); echo "  ok   $1 ($v)"; else falla=$((falla+1)); echo "  FALLA $1: esperaba $3, llegó $v"; fi; }

R=$RANDOM; AYER=$(date -d yesterday +%F); MES=$(date -d '+30 days' +%F)
prueba "Login súper admin"                200 POST /api/auth/login "" '{"email":"admin@dojoos.mx","password":"Dojo2026!"}'
ADM=$(campo "['datos']['token']")

echo "Conceptos"
prueba "Alta de uniforme"                 201 POST /api/conceptos "$ADM" "{\"nombre\":\"Uniforme $R\",\"tipo\":\"producto\"}"
UNI=$(campo "['datos']['id']")
prueba "Concepto repetido"                409 POST /api/conceptos "$ADM" "{\"nombre\":\"Uniforme $R\",\"tipo\":\"producto\"}"
prueba "Tipo no válido"                   422 POST /api/conceptos "$ADM" '{"nombre":"X","tipo":"otro"}'

echo "Precios con vigencia"
prueba "Mensualidad global 600"           201 POST /api/precios "$ADM" '{"concepto_id":1,"monto":"600"}'
prueba "Mensualidad en Centro 650"        201 POST /api/precios "$ADM" '{"concepto_id":1,"monto":"650","sucursal_id":1}'
prueba "Inscripción global 500"           201 POST /api/precios "$ADM" '{"concepto_id":2,"monto":"500"}'
prueba "Uniforme 800"                     201 POST /api/precios "$ADM" "{\"concepto_id\":$UNI,\"monto\":\"800\"}"
prueba "Uniforme sube a 900"              201 POST /api/precios "$ADM" "{\"concepto_id\":$UNI,\"monto\":\"900\"}"
igual  "Regresa el precio anterior"       "['datos']['anterior']" "800.00"
prueba "Monto en cero"                    422 POST /api/precios "$ADM" '{"concepto_id":1,"monto":"0"}'
prueba "Concepto inexistente"             404 POST /api/precios "$ADM" '{"concepto_id":99999,"monto":"10"}'
prueba "Precios de Centro"                200 GET  "/api/precios?sucursal_id=1" "$ADM"
igual  "Centro usa su mensualidad"        "['datos']['conceptos'][array_search('1', array_column(\$j['datos']['conceptos'],'id'))]['precio']" "650.00"
prueba "Precios de Norte"                 200 GET  "/api/precios?sucursal_id=2" "$ADM"
igual  "Norte usa la global"              "['datos']['conceptos'][array_search('1', array_column(\$j['datos']['conceptos'],'id'))]['precio']" "600.00"
prueba "Historial del uniforme"           200 GET  "/api/precios/historial?concepto_id=$UNI" "$ADM"
igual  "El más nuevo va primero"          "['datos'][0]['monto']" "900.00"

echo "Promociones"
COD="NOV$R"
prueba "Paquete con código"               201 POST /api/promociones "$ADM" "{\"nombre\":\"Paquete $R\",\"tipo\":\"paquete\",\"codigo\":\"$COD\",\"vigente_desde\":\"$AYER\",\"vigente_hasta\":\"$MES\",\"conceptos\":[{\"concepto_id\":2,\"tipo\":\"porcentaje\",\"valor\":100},{\"concepto_id\":$UNI,\"tipo\":\"porcentaje\",\"valor\":50}]}"
PRO=$(campo "['datos']['id']")
prueba "Código repetido"                  409 POST /api/promociones "$ADM" "{\"nombre\":\"Otro\",\"tipo\":\"paquete\",\"codigo\":\"$COD\",\"vigente_desde\":\"$AYER\",\"conceptos\":[{\"concepto_id\":2,\"tipo\":\"porcentaje\",\"valor\":10}]}"
prueba "Paquete sin código"               422 POST /api/promociones "$ADM" "{\"nombre\":\"Otro\",\"tipo\":\"paquete\",\"vigente_desde\":\"$AYER\",\"conceptos\":[{\"concepto_id\":2,\"tipo\":\"porcentaje\",\"valor\":10}]}"
prueba "Convenio sin institución"         422 POST /api/promociones "$ADM" "{\"nombre\":\"Otro\",\"tipo\":\"convenio\",\"vigente_desde\":\"$AYER\",\"conceptos\":[{\"concepto_id\":1,\"tipo\":\"porcentaje\",\"valor\":10}]}"
prueba "Porcentaje mayor a 100"           422 POST /api/promociones "$ADM" "{\"nombre\":\"Otro\",\"tipo\":\"descuento\",\"vigente_desde\":\"$AYER\",\"conceptos\":[{\"concepto_id\":1,\"tipo\":\"porcentaje\",\"valor\":150}]}"
prueba "Fecha mal escrita"                422 POST /api/promociones "$ADM" '{"nombre":"Otro","tipo":"descuento","vigente_desde":"19/11/2026","conceptos":[{"concepto_id":1,"tipo":"monto","valor":50}]}'
prueba "Lista de vigentes"                200 GET  "/api/promociones?vigentes=1" "$ADM"

echo "Cotizar (inscripción + uniforme + mensualidad en Centro)"
CONC="[{\"concepto_id\":2},{\"concepto_id\":$UNI},{\"concepto_id\":1}]"
prueba "Sin código"                       200 POST /api/cotizar "$ADM" "{\"sucursal_id\":1,\"conceptos\":$CONC}"
igual  "Total sin descuento"              "['datos']['total']" "2050.00"
prueba "Con código $COD"                  200 POST /api/cotizar "$ADM" "{\"sucursal_id\":1,\"codigo\":\"$COD\",\"conceptos\":$CONC}"
igual  "Inscripción queda en 0"           "['datos']['lineas'][0]['total']" "0.00"
igual  "Uniforme al 50 %"                 "['datos']['lineas'][1]['total']" "450.00"
igual  "Total con descuento"              "['datos']['total']" "1100.00"
prueba "Código en minúsculas también"     200 POST /api/cotizar "$ADM" "{\"sucursal_id\":1,\"codigo\":\"$(echo $COD | tr A-Z a-z)\",\"conceptos\":$CONC}"
prueba "Código inexistente"               422 POST /api/cotizar "$ADM" "{\"sucursal_id\":1,\"codigo\":\"NOEXISTE\",\"conceptos\":$CONC}"
prueba "Desactivar el paquete"            200 PUT  "/api/promociones/$PRO/desactivar" "$ADM"
prueba "Código desactivado ya no aplica"  422 POST /api/cotizar "$ADM" "{\"sucursal_id\":1,\"codigo\":\"$COD\",\"conceptos\":$CONC}"

echo "Permisos y sucursal"
prueba "Login Laura"                      200 POST /api/auth/login "" '{"email":"laura@dojoos.mx","password":"Dojo2026!"}'
LAU=$(campo "['datos']['token']"); ADMN=$(campo "['datos']['roles'][0]['usuario_rol_id']"); INST=$(campo "['datos']['roles'][1]['usuario_rol_id']")
prueba "Laura como admin de Norte"        200 POST /api/auth/rol "$LAU" "{\"usuario_rol_id\":$ADMN}"
prueba "Admin de sucursal no pone precios" 403 POST /api/precios "$LAU" '{"concepto_id":1,"monto":"1"}'
prueba "Promoción para otra sucursal"     403 POST /api/promociones "$LAU" "{\"nombre\":\"N $R\",\"tipo\":\"descuento\",\"sucursal_id\":1,\"vigente_desde\":\"$AYER\",\"conceptos\":[{\"concepto_id\":1,\"tipo\":\"monto\",\"valor\":50}]}"
prueba "Promoción de su sucursal"         201 POST /api/promociones "$LAU" "{\"nombre\":\"N $R\",\"tipo\":\"descuento\",\"vigente_desde\":\"$AYER\",\"conceptos\":[{\"concepto_id\":1,\"tipo\":\"monto\",\"valor\":50}]}"
prueba "Laura como instructora"           200 POST /api/auth/rol "$LAU" "{\"usuario_rol_id\":$INST}"
prueba "Instructor no cotiza"             403 POST /api/cotizar "$LAU" "{\"conceptos\":$CONC}"

echo; echo "Resultado: $pasa pasaron, $falla fallaron"; [ $falla -eq 0 ]
