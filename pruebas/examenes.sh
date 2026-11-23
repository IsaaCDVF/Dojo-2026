#!/usr/bin/env bash
# Pruebas de la fase 5 · Exámenes (solicitud, plazo, autorización, pago, resultado, cancelación con saldo a favor).
# Uso: ./pruebas/examenes.sh [http://localhost:8080]. Crea sus propios datos: se puede correr varias veces.
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

LEJOS=$(date -d "+30 days" +%Y-%m-%d); CERCA=$(date -d "+2 days" +%Y-%m-%d)

prueba "Login súper admin"                 200 POST /api/auth/login "" '{"email":"admin@dojoos.mx","password":"Dojo2026!"}'
ADM=$(campo "['datos']['token']")
prueba "Precio del examen"                 201 POST /api/precios "$ADM" '{"concepto_id":3,"monto":"450"}'
prueba "Grados de Taekwondo"               200 GET  /api/disciplinas/1/grados "$ADM"
G1=$(campo "['datos'][0]['id']")
prueba "Horario de lunes en Centro"        200 GET  "/api/horarios?sucursal_id=1&dia=1" "$ADM"
HOR=$(campo "['datos'][0]['id']")

echo "Alumnos de prueba (Ana y Leo, hijos de Rosa)"
prueba "Alta de Ana"                       201 POST /api/alumnos "$ADM" "{\"sucursal_id\":1,\"nombre\":\"Ana\",\"apellido_paterno\":\"Exa$R\",\"fecha_nacimiento\":\"2015-05-10\",\"curp\":\"$(curp 150510)\",\"foto\":\"$FOTO\",\"responsable\":{\"nombre\":\"Rosa\",\"apellido_paterno\":\"Exa$R\",\"telefono\":\"2221234567\",\"parentesco\":\"madre\"}}"
A1=$(campo "['datos']['id']"); RESP=$(campo "['datos']['responsable_id']")
prueba "Alta de Leo"                       201 POST /api/alumnos "$ADM" "{\"sucursal_id\":1,\"nombre\":\"Leo\",\"apellido_paterno\":\"Exa$R\",\"fecha_nacimiento\":\"2017-02-03\",\"curp\":\"$(curp 170203)\",\"foto\":\"$FOTO\",\"responsable\":{\"id\":$RESP,\"parentesco\":\"madre\"}}"
A2=$(campo "['datos']['id']")
prueba "Alta de Mia (sin inscribir)"       201 POST /api/alumnos "$ADM" "{\"sucursal_id\":1,\"nombre\":\"Mia\",\"apellido_paterno\":\"Exa$R\",\"fecha_nacimiento\":\"2016-01-01\",\"curp\":\"$(curp 160101)\",\"foto\":\"$FOTO\",\"responsable\":{\"id\":$RESP,\"parentesco\":\"madre\"}}"
A3=$(campo "['datos']['id']")
prueba "Inscribe a Ana en 10 kup"          201 POST /api/inscripciones "$ADM" "{\"alumno_id\":$A1,\"horario_id\":$HOR,\"grado_id\":$G1,\"forzar\":true}"
prueba "Inscribe a Leo en 10 kup"          201 POST /api/inscripciones "$ADM" "{\"alumno_id\":$A2,\"horario_id\":$HOR,\"grado_id\":$G1,\"forzar\":true}"

echo "Programar fechas"
prueba "Sin disciplina"                    422 POST /api/examenes "$ADM" "{\"sucursal_id\":1,\"fecha\":\"$LEJOS 10:00\"}"
prueba "Fecha que ya pasó"                 422 POST /api/examenes "$ADM" '{"sucursal_id":1,"disciplina_id":1,"fecha":"2020-01-01 10:00"}'
prueba "Examen en 30 días"                 201 POST /api/examenes "$ADM" "{\"sucursal_id\":1,\"disciplina_id\":1,\"fecha\":\"$LEJOS 10:00\",\"sede\":\"Gimnasio $R\"}"
EX1=$(campo "['datos']['id']")
prueba "Examen en 2 días"                  201 POST /api/examenes "$ADM" "{\"sucursal_id\":1,\"disciplina_id\":1,\"fecha\":\"${CERCA}T12:00\"}"
EX2=$(campo "['datos']['id']")
prueba "Lista de exámenes"                 200 GET  "/api/examenes?sucursal_id=1&estado=programado" "$ADM"
igual  "Calcula la fecha límite"           "array_column(\$j['datos'], 'fecha_limite', 'id')[$EX1]" "$(date -d "$LEJOS -5 days" +%Y-%m-%d)"

echo "Criterios y solicitud"
prueba "Criterios de Ana"                  200 GET  "/api/examenes/$EX1/criterios?alumno_id=$A1" "$ADM"
igual  "Presentaría 9 kup"                 "['datos']['grado_objetivo']['nombre']" "9 kup"
igual  "Está en plazo"                     "\$j['datos']['en_plazo'] ? 'si' : 'no'" "si"
igual  "Aún no cumple el tiempo en grado"  "\$j['datos']['cumple_meses'] ? 'si' : 'no'" "no"
prueba "Sin grado no puede solicitar"      422 POST "/api/examenes/$EX1/solicitudes" "$ADM" "{\"alumno_id\":$A3}"
prueba "Solicitud de Ana"                  201 POST "/api/examenes/$EX1/solicitudes" "$ADM" "{\"alumno_id\":$A1}"
S1=$(campo "['datos']['id']")
igual  "Pasa a autorización"               "['datos']['estado']" "por_autorizar"
igual  "Avisa que no cumple (validación blanda)" "count(\$j['datos']['avisos'])" "1"
prueba "Solicitud repetida"                409 POST "/api/examenes/$EX1/solicitudes" "$ADM" "{\"alumno_id\":$A1}"
prueba "Leo pide el examen cercano"        201 POST "/api/examenes/$EX2/solicitudes" "$ADM" "{\"alumno_id\":$A2}"
S2=$(campo "['datos']['id']")
igual  "Llega fuera de plazo"              "['datos']['estado']" "fuera_de_plazo"
prueba "Ana también pide el cercano"       201 POST "/api/examenes/$EX2/solicitudes" "$ADM" "{\"alumno_id\":$A1}"
S3=$(campo "['datos']['id']")

echo "Instructor y excepciones"
prueba "Login Laura"                       200 POST /api/auth/login "" '{"email":"laura@dojoos.mx","password":"Dojo2026!"}'
LAU=$(campo "['datos']['token']"); INST=$(campo "['datos']['roles'][1]['usuario_rol_id']")
prueba "Laura como instructora"            200 POST /api/auth/rol "$LAU" "{\"usuario_rol_id\":$INST}"
prueba "Instructor no programa fechas"     403 POST /api/examenes "$LAU" "{\"disciplina_id\":1,\"fecha\":\"$LEJOS 10:00\"}"
prueba "Instructor ve el examen"           200 GET  "/api/examenes/$EX1" "$LAU"
igual  "Una solicitud"                     "count(\$j['datos']['solicitudes'])" "1"
prueba "Fuera de plazo: primero el admin"  409 PUT  "/api/solicitudes-examen/$S2/validar" "$LAU" '{"decision":"autorizada"}'
prueba "Instructor no da excepciones"      403 PUT  "/api/solicitudes-examen/$S2/excepcion" "$LAU" '{"tipo":"fuera_de_plazo","decision":"autorizada","motivo":"x"}'
prueba "Excepción sin motivo"              422 PUT  "/api/solicitudes-examen/$S2/excepcion" "$ADM" '{"tipo":"fuera_de_plazo","decision":"autorizada"}'
prueba "Admin autoriza el plazo de Leo"    200 PUT  "/api/solicitudes-examen/$S2/excepcion" "$ADM" '{"tipo":"fuera_de_plazo","decision":"autorizada","motivo":"Estuvo enfermo"}'
prueba "Misma excepción dos veces"         409 PUT  "/api/solicitudes-examen/$S2/excepcion" "$ADM" '{"tipo":"fuera_de_plazo","decision":"autorizada","motivo":"otra"}'
prueba "Admin rechaza el plazo de Ana"     200 PUT  "/api/solicitudes-examen/$S3/excepcion" "$ADM" '{"tipo":"fuera_de_plazo","decision":"rechazada","motivo":"Las cintas ya se pidieron"}'
prueba "Rechazar sin observaciones"        422 PUT  "/api/solicitudes-examen/$S1/validar" "$LAU" '{"decision":"no_autorizada"}'
prueba "Laura autoriza a Ana"              200 PUT  "/api/solicitudes-examen/$S1/validar" "$LAU" '{"decision":"autorizada","observaciones":"Buena técnica"}'
prueba "Ya resuelta"                       409 PUT  "/api/solicitudes-examen/$S1/validar" "$LAU" '{"decision":"autorizada"}'
prueba "Laura autoriza a Leo"              200 PUT  "/api/solicitudes-examen/$S2/validar" "$LAU" '{"decision":"autorizada"}'

echo "Pago del examen"
prueba "Resultado sin pagar"               409 PUT  "/api/solicitudes-examen/$S1/resultado" "$LAU" '{"resultado":"aprobada"}'
prueba "El examen aparece en caja"         200 GET  "/api/caja/estado-cuenta/$RESP" "$ADM"
igual  "Dos exámenes por cobrar"           "count(array_filter(\$j['datos']['adeudos'], fn(\$l) => str_starts_with(\$l['clave'], 'exa:')))" "2"
prueba "Cobra el examen de Ana"            201 POST /api/caja/cobros "$ADM" "{\"responsable_id\":$RESP,\"metodo\":\"efectivo\",\"claves\":[\"exa:$S1\"]}"
prueba "Cobra el examen de Leo"            201 POST /api/caja/cobros "$ADM" "{\"responsable_id\":$RESP,\"metodo\":\"efectivo\",\"claves\":[\"exa:$S2\"]}"
PRECIO=$(campo "['datos']['total']")
prueba "Ya no se cobra otra vez"           409 POST /api/caja/cobros "$ADM" "{\"responsable_id\":$RESP,\"metodo\":\"efectivo\",\"claves\":[\"exa:$S1\"]}"

echo "Resultado y cancelación"
prueba "Ana aprueba"                       200 PUT  "/api/solicitudes-examen/$S1/resultado" "$LAU" '{"resultado":"aprobada"}'
prueba "Ahora es 9 kup"                    200 GET  "/api/examenes/$EX2/criterios?alumno_id=$A1" "$ADM"
igual  "Grado actual"                      "['datos']['grado_actual']['nombre']" "9 kup"
prueba "Leo cancela a petición"            200 PUT  "/api/solicitudes-examen/$S2/cancelar" "$ADM" '{"motivo":"a_peticion","detalle":"Viaje familiar"}'
igual  "Su pago queda como saldo a favor"  "['datos']['saldo_favor']" "$PRECIO"
prueba "Cancelar dos veces"                409 PUT  "/api/solicitudes-examen/$S2/cancelar" "$ADM" '{"motivo":"otro"}'
prueba "Rosa tiene saldo a favor"          200 GET  "/api/caja/estado-cuenta/$RESP" "$ADM"
igual  "Saldo"                             "['datos']['saldo_favor']" "$PRECIO"
MES=$(campo "implode('', array_filter(array_column(\$j['datos']['adeudos'], 'clave'), fn(\$c) => str_starts_with(\$c, 'mens:$A2:')))")
prueba "Paga el mes de Leo usando el saldo" 201 POST /api/caja/cobros "$ADM" "{\"responsable_id\":$RESP,\"metodo\":\"efectivo\",\"usar_saldo\":true,\"claves\":[\"$MES\"]}"
igual  "Se usó el saldo"                   "['datos']['saldo_usado']" "$PRECIO"
igual  "Paga solo la diferencia"           "number_format(\$j['datos']['total'] - \$j['datos']['saldo_usado'], 2, '.', '')" "$(campo "['datos']['a_pagar']")"
prueba "Saldo consumido"                   200 GET  "/api/caja/estado-cuenta/$RESP" "$ADM"
igual  "Sin saldo"                         "['datos']['saldo_favor']" "0.00"

echo "Cerrar fechas"
prueba "Examen 1 realizado"                200 PUT  "/api/examenes/$EX1/estado" "$ADM" '{"estado":"realizado"}'
prueba "Examen 2 cancelado"                200 PUT  "/api/examenes/$EX2/estado" "$ADM" '{"estado":"cancelado"}'
prueba "Ya no recibe solicitudes"          409 POST "/api/examenes/$EX2/solicitudes" "$ADM" "{\"alumno_id\":$A2}"
prueba "No se reabre"                      409 PUT  "/api/examenes/$EX2/estado" "$ADM" '{"estado":"realizado"}'

echo; echo "Resultado: $pasa pasaron, $falla fallaron"; [ $falla -eq 0 ]
