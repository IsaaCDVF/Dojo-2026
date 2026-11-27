#!/usr/bin/env bash
# Pruebas de Reportes (ingresos, alumnos, deuda vencida, riesgo). Compara contra lo que ya había (funciona con tus datos).
# Uso: ./pruebas/reportes.sh [http://localhost:8080]. Crea sus alumnos y al final los da de baja.
API=${1:-http://localhost:8080}
pasa=0; falla=0
prueba() { local cod; cod=$(curl -s -o /tmp/r.json -w '%{http_code}' -X "$3" "$API$4" -H 'Content-Type: application/json' ${5:+-H "Authorization: Bearer $5"} ${6:+-d "$6"} "${@:7}")
  if [ "$cod" = "$2" ]; then pasa=$((pasa+1)); echo "  ok   $1 ($cod)"; else falla=$((falla+1)); echo "  FALLA $1: esperaba $2, llegó $cod → $(head -c 300 /tmp/r.json)"; fi; }
campo() { php -r '$j=json_decode(file_get_contents("/tmp/r.json"),true); $e=$argv[1]; echo eval("return ".($e[0]==="[" ? "\$j$e" : $e).";");' -- "$1"; }
igual() { local v; v=$(campo "$2"); if [ "$v" = "$3" ]; then pasa=$((pasa+1)); echo "  ok   $1 ($v)"; else falla=$((falla+1)); echo "  FALLA $1: esperaba $3, llegó $v"; fi; }
suma() { php -r 'printf("%.2f", $argv[1] + $argv[2]);' -- "$1" "$2"; }
L=BCDFGHJKLMNPQRSTVWXZ; c() { echo -n "${L:$((RANDOM%20)):1}"; }
curp() { echo "REPO$1HPL$(c)$(c)$(c)0$((RANDOM%10))"; }
FOTO='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
R=$RANDOM; MES=$(date +%Y-%m)
k() { echo "['datos']['kpi']['$1']"; }

prueba "Login súper admin"                   200 POST /api/auth/login "" '{"email":"admin@dojoos.mx","password":"Dojo2026!"}'; ADM=$(campo "['datos']['token']")
prueba "Login Laura (admin de Norte)"        200 POST /api/auth/login "" '{"email":"laura@dojoos.mx","password":"Dojo2026!"}'; LAU=$(campo "['datos']['token']")
ADMN=$(campo "array_column(\$j['datos']['roles'], 'usuario_rol_id', 'rol')['admin_sucursal']"); INSR=$(campo "array_column(\$j['datos']['roles'], 'usuario_rol_id', 'rol')['instructor']")
prueba "Laura como admin de Norte"           200 POST /api/auth/rol "$LAU" "{\"usuario_rol_id\":$ADMN}"
prueba "Login Laura (instructora)"           200 POST /api/auth/login "" '{"email":"laura@dojoos.mx","password":"Dojo2026!"}'; INS=$(campo "['datos']['token']")
prueba "Como instructora"                    200 POST /api/auth/rol "$INS" "{\"usuario_rol_id\":$INSR}"
for x in '1 650' '2 500' '5 100'; do set -- $x; prueba "Precio del concepto $1" 201 POST /api/precios "$ADM" "{\"concepto_id\":$1,\"monto\":\"$2\"}"; done
prueba "Sucursales"                          200 GET  /api/sucursales "$ADM"; CENT=$(campo "array_column(\$j['datos'], 'id', 'clave')['CENT']")

echo "Quién lo ve"
prueba "La instructora no"                   403 GET  /api/reportes "$INS"
prueba "Mes inválido"                        422 GET  "/api/reportes?mes=2026-13" "$ADM"
prueba "Mes del futuro: se queda en el actual" 200 GET "/api/reportes?mes=2099-01" "$ADM"
igual  "Mes actual"                          "['datos']['mes']" "$MES"
prueba "Laura ve solo Norte"                 200 GET  "/api/reportes?sucursal_id=$CENT" "$LAU"
igual  "Aunque pida Centro"                  "\$j['datos']['sucursal_id'] != $CENT ? 'si' : 'no'" "si"
igual  "Sin la tabla por sucursal"           "count(\$j['datos']['por_sucursal'])" "0"

echo "Cómo está antes"
prueba "Reporte de Centro"                   200 GET  "/api/reportes?sucursal_id=$CENT" "$ADM"
igual  "12 meses, el último es este"         "count(\$j['datos']['serie']) . ' ' . end(\$j['datos']['serie'])['mes']" "12 $MES"
I0=$(campo "$(k ingresos)"); E0=$(campo "end(\$j['datos']['serie'])['efectivo']"); A0=$(campo "$(k activos)"); ALT0=$(campo "$(k altas)"); B0=$(campo "$(k bajas)"); V0=$(campo "$(k vencido)")
INS0=$(campo "array_sum(array_column(array_filter(\$j['datos']['por_concepto'], fn(\$c) => \$c['concepto'] === 'Inscripción'), 'total'))")

echo "Un alumno nuevo y uno que debe"
prueba "Alta de Rita (hoy)"                  201 POST /api/alumnos "$ADM" "{\"sucursal_id\":$CENT,\"nombre\":\"Rita\",\"apellido_paterno\":\"Rep$R\",\"fecha_nacimiento\":\"2014-02-11\",\"curp\":\"$(curp 140211)\",\"foto\":\"$FOTO\",\"responsable\":{\"nombre\":\"Rosa\",\"apellido_paterno\":\"Rep$R\",\"telefono\":\"22211$(printf '%05d' $R)\",\"parentesco\":\"madre\"}}"
RITA=$(campo "['datos']['id']"); RR=$(campo "['datos']['responsable_id']")
prueba "Alta de Toño (hace 45 días, no ha pagado)" 201 POST /api/alumnos "$ADM" "{\"sucursal_id\":$CENT,\"nombre\":\"Toño\",\"apellido_paterno\":\"Rep$R\",\"fecha_nacimiento\":\"2013-02-11\",\"fecha_alta\":\"$(date -d '-45 days' +%F)\",\"curp\":\"$(curp 130211)\",\"foto\":\"$FOTO\",\"responsable\":{\"nombre\":\"Tere\",\"apellido_paterno\":\"Rep$R\",\"telefono\":\"22212$(printf '%05d' $R)\",\"parentesco\":\"madre\"}}"
TONO=$(campo "['datos']['id']"); RT=$(campo "['datos']['responsable_id']")
prueba "Lo vencido de Toño"                  200 GET  "/api/caja/estado-cuenta/$RT" "$ADM"
VT=$(campo "sprintf('%.2f', array_sum(array_map(fn(\$l) => (float) \$l['precio'], array_filter(\$j['datos']['adeudos'], fn(\$l) => \$l['estado'] === 'vencida'))))")
prueba "Reporte"                             200 GET  "/api/reportes?sucursal_id=$CENT" "$ADM"
igual  "Un activo más por Rita y otro por Toño" "$(k activos)" "$((A0+2))"
igual  "Rita cuenta como alta del mes"       "$(k altas)" "$((ALT0+1))"
igual  "Lo vencido sube lo que debe Toño"    "$(k vencido)" "$(suma $V0 $VT)"
igual  "Toño en riesgo: no ha venido y debe" "implode(',', array_merge(...array_map(fn(\$a) => \$a['motivos'], array_filter(\$j['datos']['riesgo'], fn(\$a) => \$a['alumno_id'] == $TONO))))" "sin_venir,debe"
igual  "Rita no (es nueva)"                  "count(array_filter(\$j['datos']['riesgo'], fn(\$a) => \$a['alumno_id'] == $RITA))" "0"

echo "Cobros"
prueba "Cobra la inscripción de Rita en efectivo" 201 POST /api/caja/cobros "$ADM" "{\"responsable_id\":$RR,\"metodo\":\"efectivo\",\"claves\":[\"insc:$RITA\"]}"
P1=$(campo "['datos']['id']")
prueba "Reporte"                             200 GET  "/api/reportes?sucursal_id=$CENT" "$ADM"
igual  "Ingresos del mes +500"               "$(k ingresos)" "$(suma $I0 500)"
igual  "En efectivo +500"                    "end(\$j['datos']['serie'])['efectivo']" "$(suma $E0 500)"
igual  "Inscripción +500 en lo vendido"      "sprintf('%.2f', array_sum(array_column(array_filter(\$j['datos']['por_concepto'], fn(\$c) => \$c['concepto'] === 'Inscripción'), 'total')))" "$(suma $INS0 500)"
prueba "Todas las sucursales"                200 GET  /api/reportes "$ADM"
igual  "La tabla por sucursal suma lo mismo que el total" "sprintf('%.2f', array_sum(array_column(\$j['datos']['por_sucursal'], 'ingresos'))) === \$j['datos']['kpi']['ingresos'] ? 'si' : 'no'" "si"
prueba "Se cancela el cobro"                 200 PUT  "/api/caja/pagos/$P1/cancelar" "$ADM" '{"motivo":"Prueba de reportes"}'
prueba "Reporte"                             200 GET  "/api/reportes?sucursal_id=$CENT" "$ADM"
igual  "Lo cancelado no cuenta"              "$(k ingresos)" "$I0"

echo "Bajas"
for a in $RITA $TONO; do prueba "Baja del alumno de prueba $a" 200 PUT "/api/alumnos/$a/estado" "$ADM" '{"estado":"baja","motivo":"Prueba de reportes"}'; done
prueba "Reporte"                             200 GET  "/api/reportes?sucursal_id=$CENT" "$ADM"
igual  "Dos bajas más en el mes"             "$(k bajas)" "$((B0+2))"
igual  "Activos como antes"                  "$(k activos)" "$A0"
igual  "Lo vencido como antes"               "$(k vencido)" "$V0"

echo; echo "Resultado: $pasa pasaron, $falla fallaron"; [ $falla -eq 0 ]
