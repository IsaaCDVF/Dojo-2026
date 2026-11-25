#!/usr/bin/env bash
# Pruebas de 2.6 Carga masiva de alumnos (CSV) y del Inicio. Uso: ./pruebas/importacion.sh [http://localhost:8080]
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

D=/tmp/dojo-csv-$R; mkdir -p $D
# cuerpo JSON con el archivo: cuerpo ARCHIVO CONFIRMAR(0|1) [sucursal_id]
cuerpo() { php -r 'echo json_encode(["archivo"=>basename($argv[1]),"csv"=>file_get_contents($argv[1]),"confirmar"=>$argv[2]==="1"]+($argv[3]!==""?["sucursal_id"=>(int)$argv[3]]:[]));' -- "$1" "$2" "${3:-}"; }
HACE60=$(date -d '-60 days' +%d/%m/%Y)
C1=$(curp 900101); C2=$(curp 150202); C3=$(curp 170303); C4=$(curp 140404); C6=$C2; TEL="22277$(printf '%05d' $R)"

cat > $D/alumnos.csv <<CSV
nombre,apellido_paterno,apellido_materno,fecha_nacimiento,curp,sexo,telefono,fecha_alta,disciplina,grado,responsable_nombre,responsable_apellido,responsable_telefono,responsable_parentesco
Raúl,Imp$R,Soto,1990-01-01,$C1,H,222 555 0101,$HACE60,Taekwondo,Amarilla,,,,
Sara,Imp$R,Luna,2015-02-02,$C2,F,,,Taekwondo,,Marta,Imp$R,$TEL,madre
Tomás,Imp$R,Luna,2017-03-03,$C3,M,,,,,Marta,Imp$R,$TEL,madre
Iván,Imp$R,,2014-04-04,$C4,M,,,,,,,,
Error,Curp,,2000-01-01,ABC123,,,,,,,,,
Repetida,Imp$R,,2015-02-02,$C6,F,,,,,Marta,Imp$R,$TEL,madre
Ana,Imp$R,,2001-05-05,$(curp 010505),F,,,Sumo,,,,,
Beto,Imp$R,,31/02/2010,$(curp 100228),M,,,,,Luis,Imp$R,2225550000,padre
CSV

prueba "Login súper admin"                 200 POST /api/auth/login "" '{"email":"admin@dojoos.mx","password":"Dojo2026!"}'
ADM=$(campo "['datos']['token']")

echo "Revisión (sin guardar)"
prueba "Revisa el archivo"                 200 POST /api/alumnos/importar "$ADM" "$(cuerpo $D/alumnos.csv 0 1)"
igual  "8 renglones"                       "['datos']['filas']" "8"
igual  "3 válidos"                         "['datos']['validas']" "3"
igual  "5 con error"                       "['datos']['con_error']" "5"
igual  "Menor sin responsable (renglón 5)" "implode(',', array_column(array_filter(\$j['datos']['errores'], fn(\$e) => \$e['fila'] == 5), 'campo'))" "responsable_nombre"
igual  "CURP mal escrita (renglón 6)"      "implode(',', array_column(array_filter(\$j['datos']['errores'], fn(\$e) => \$e['fila'] == 6), 'campo'))" "curp"
igual  "CURP repetida (renglón 7)"         "str_contains(implode(',', array_column(array_filter(\$j['datos']['errores'], fn(\$e) => \$e['fila'] == 7), 'mensaje')), 'Repetida') ? 'si' : 'no'" "si"
igual  "Disciplina que no existe"          "implode(',', array_column(array_filter(\$j['datos']['errores'], fn(\$e) => \$e['fila'] == 8), 'campo'))" "disciplina"
igual  "31 de febrero no existe"           "implode(',', array_column(array_filter(\$j['datos']['errores'], fn(\$e) => \$e['fila'] == 9), 'campo'))" "fecha_nacimiento"
igual  "El adulto paga por sí mismo"       "\$j['datos']['muestra'][0]['responsable']" "Él mismo"
igual  "Grado por color de cinta"          "\$j['datos']['muestra'][0]['grado']" "Taekwondo · 8 kup"
prueba "No guardó nada"                    200 GET  "/api/alumnos?buscar=Imp$R&estado=" "$ADM"
igual  "Cero alumnos"                      "count(\$j['datos'])" "0"
printf 'nombre,curp\nX,Y\n' > $D/faltan.csv
prueba "Faltan columnas"                   422 POST /api/alumnos/importar "$ADM" "$(cuerpo $D/faltan.csv 0 1)"
printf 'nombre,apellido_paterno,fecha_nacimiento,curp\n' > $D/vacio.csv
prueba "Sin renglones"                     422 POST /api/alumnos/importar "$ADM" "$(cuerpo $D/vacio.csv 0 1)"
prueba "Rol global sin sucursal"           200 POST /api/alumnos/importar "$ADM" "$(cuerpo $D/alumnos.csv 0)"
igual  "Pide la sucursal"                  "count(array_filter(\$j['datos']['errores'], fn(\$e) => \$e['campo'] === 'sucursal'))" "8"

echo "Importar"
prueba "Importa los válidos"               201 POST /api/alumnos/importar "$ADM" "$(cuerpo $D/alumnos.csv 1 1)"
IMP=$(campo "['datos']['importacion_id']")
igual  "Tres creados"                      "['datos']['creados']" "3"
prueba "Ya están en el sistema"            200 GET  "/api/alumnos?buscar=Imp$R&estado=" "$ADM"
igual  "Tres alumnos"                      "count(\$j['datos'])" "3"
RAUL=$(campo "array_values(array_filter(\$j['datos'], fn(\$a) => \$a['nombre'] === 'Raúl'))[0]['id']")
SARA=$(campo "array_values(array_filter(\$j['datos'], fn(\$a) => \$a['nombre'] === 'Sara'))[0]['id']")
TOMAS=$(campo "array_values(array_filter(\$j['datos'], fn(\$a) => \$a['nombre'] === 'Tomás'))[0]['id']")
prueba "Ficha de Raúl"                     200 GET  "/api/alumnos/$RAUL" "$ADM"
igual  "Grado de migración"                "\$j['datos']['grados'][0]['origen'] . ' ' . \$j['datos']['grados'][0]['nombre']" "migracion 8 kup"
igual  "Fecha de alta del archivo"         "['datos']['fecha_alta']" "$(date -d '-60 days' +%Y-%m-%d)"
RESPR=$(campo "['datos']['responsables'][0]['id']")
prueba "Ficha de Sara"                     200 GET  "/api/alumnos/$SARA" "$ADM"
RS=$(campo "['datos']['responsables'][0]['id']")
prueba "Ficha de Tomás"                    200 GET  "/api/alumnos/$TOMAS" "$ADM"
igual  "Hermanos con la misma mamá"        "['datos']['responsables'][0]['id']" "$RS"
prueba "Raúl debe meses atrasados"         200 GET  "/api/caja/estado-cuenta/$RESPR" "$ADM"
igual  "Tiene mensualidad vencida"         "count(array_filter(\$j['datos']['adeudos'], fn(\$l) => \$l['estado'] === 'vencida')) > 0 ? 'si' : 'no'" "si"
prueba "El mismo archivo otra vez"         200 POST /api/alumnos/importar "$ADM" "$(cuerpo $D/alumnos.csv 0 1)"
igual  "Ya no hay válidos"                 "['datos']['validas']" "0"
prueba "Confirmar sin válidos"             422 POST /api/alumnos/importar "$ADM" "$(cuerpo $D/alumnos.csv 1 1)"

echo "Excel en español (punto y coma, encabezados con acentos) y responsable existente"
C9=$(curp 160909)
printf 'Nombre;Apellido Paterno;Fecha de nacimiento;CURP;Responsable nombre;Responsable apellido;Teléfono responsable;Parentesco\nLía;Imp%s;09/09/2016;%s;Marta;Imp%s;%s;madre\n' $R $C9 $R $TEL > $D/excel.csv
prueba "Revisa archivo de Excel"           200 POST /api/alumnos/importar "$ADM" "$(cuerpo $D/excel.csv 0 1)"
igual  "Válido"                            "['datos']['validas']" "1"
igual  "Reconoce a la mamá ya registrada"  "str_contains(\$j['datos']['muestra'][0]['responsable'], 'ya registrado') ? 'si' : 'no'" "si"
prueba "Importa a Lía"                     201 POST /api/alumnos/importar "$ADM" "$(cuerpo $D/excel.csv 1 1)"
IMP2=$(campo "['datos']['importacion_id']")

echo "Historial y revertir"
prueba "Historial de cargas"               200 GET  /api/importaciones "$ADM"
igual  "La carga con errores"              "array_column(\$j['datos'], 'estado', 'id')[$IMP]" "con_errores"
prueba "Grados de Taekwondo"               200 GET  /api/disciplinas/1/grados "$ADM"
G1=$(campo "['datos'][0]['id']")
prueba "Horario de lunes"                  200 GET  "/api/horarios?sucursal_id=1&dia=1" "$ADM"
HOR=$(campo "['datos'][0]['id']")
prueba "Sara se inscribe a una clase"      201 POST /api/inscripciones "$ADM" "{\"alumno_id\":$SARA,\"horario_id\":$HOR,\"grado_id\":$G1,\"forzar\":true}"
prueba "Ya no se puede revertir la carga"  409 PUT  "/api/importaciones/$IMP/revertir" "$ADM" '{}'
prueba "Login Laura"                       200 POST /api/auth/login "" '{"email":"laura@dojoos.mx","password":"Dojo2026!"}'
LAU=$(campo "['datos']['token']"); ADMN=$(campo "['datos']['roles'][0]['usuario_rol_id']")
prueba "Laura como admin de Norte"         200 POST /api/auth/rol "$LAU" "{\"usuario_rol_id\":$ADMN}"
prueba "No revierte cargas de Centro"      403 PUT  "/api/importaciones/$IMP2/revertir" "$LAU" '{}'
prueba "Revierte la carga de Lía"          200 PUT  "/api/importaciones/$IMP2/revertir" "$ADM" '{}'
prueba "Lía ya no existe"                  200 GET  "/api/alumnos?buscar=Imp$R&estado=" "$ADM"
igual  "Quedan Raúl, Sara y Tomás"         "count(\$j['datos'])" "3"
prueba "La mamá sigue (paga por Sara y Tomás)" 200 GET "/api/caja/estado-cuenta/$RS" "$ADM"
prueba "Revertir dos veces"                409 PUT  "/api/importaciones/$IMP2/revertir" "$ADM" '{}'

echo "Inicio"
prueba "Inicio del súper admin"            200 GET  /api/inicio "$ADM"
igual  "Trae alumnos, caja, exámenes y clases" "implode(',', array_intersect(['alumnos','caja','vencidos','examenes','clases'], array_keys(\$j['datos'])))" "alumnos,caja,vencidos,examenes,clases"
igual  "Raúl aparece con pago vencido"     "in_array($RAUL, array_column(\$j['datos']['vencidos']['lista'], 'id')) || \$j['datos']['vencidos']['alumnos'] > 8 ? 'si' : 'no'" "si"
prueba "Login Laura instructora"           200 POST /api/auth/login "" '{"email":"laura@dojoos.mx","password":"Dojo2026!"}'
LAU=$(campo "['datos']['token']"); INST=$(campo "['datos']['roles'][1]['usuario_rol_id']")
prueba "Laura como instructora"            200 POST /api/auth/rol "$LAU" "{\"usuario_rol_id\":$INST}"
prueba "Inicio de la instructora"          200 GET  /api/inicio "$LAU"
igual  "No ve caja"                        "isset(\$j['datos']['caja']) ? 'si' : 'no'" "no"
igual  "Sí ve exámenes y clases"           "isset(\$j['datos']['examenes'], \$j['datos']['clases']) ? 'si' : 'no'" "si"
prueba "Instructor no importa"             403 POST /api/alumnos/importar "$LAU" "$(cuerpo $D/alumnos.csv 0 1)"
rm -rf $D

echo; echo "Resultado: $pasa pasaron, $falla fallaron"; [ $falla -eq 0 ]
