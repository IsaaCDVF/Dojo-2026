#!/usr/bin/env bash
# Pruebas de Personal y accesos, alta completa de sucursal y contraseña temporal.
# Uso: ./pruebas/personal.sh [http://localhost:8080]
# Se puede correr varias veces: usa correos y claves nuevos en cada corrida y al final desactiva lo que creó.
API=${1:-http://localhost:8080}
pasa=0; falla=0
prueba() { local cod; cod=$(curl -s -o /tmp/r.json -w '%{http_code}' -X "$3" "$API$4" -H 'Content-Type: application/json' ${5:+-H "Authorization: Bearer $5"} ${6:+-d "$6"})
  if [ "$cod" = "$2" ]; then pasa=$((pasa+1)); echo "  ok   $1 ($cod)"; else falla=$((falla+1)); echo "  FALLA $1: esperaba $2, llegó $cod → $(head -c 300 /tmp/r.json)"; fi; }
campo() { php -r '$j=json_decode(file_get_contents("/tmp/r.json"),true); $e=$argv[1]; echo eval("return ".($e[0]==="[" ? "\$j$e" : $e).";");' -- "$1"; }
igual() { local v; v=$(campo "$2"); if [ "$v" = "$3" ]; then pasa=$((pasa+1)); echo "  ok   $1 ($v)"; else falla=$((falla+1)); echo "  FALLA $1: esperaba $3, llegó $v"; fi; }
entra() { prueba "$1" "${4:-200}" POST /api/auth/login "" "{\"email\":\"$2\",\"password\":\"$3\"}"; }
N=$(date +%s)$RANDOM                                               # para correos únicos
CLAVE=$(php -r 'echo substr(str_shuffle(str_repeat("ABCDEFGHJKLMNPQRSTUVWXYZ", 4)), 0, 4);')
MARTA="marta.$N@prueba.mx"; JULIO="julio.$N@prueba.mx"

entra "Login súper admin" admin@dojoos.mx 'Dojo2026!'; ADM=$(campo "['datos']['token']")
entra "Login Laura" laura@dojoos.mx 'Dojo2026!'; LAU=$(campo "['datos']['token']")
prueba "Roles de Laura"                      200 GET  /api/auth/yo "$LAU"
ADMN=$(campo "array_column(\$j['datos']['roles'], 'usuario_rol_id', 'rol')['admin_sucursal']")
prueba "Laura como admin de Norte"           200 POST /api/auth/rol "$LAU" "{\"usuario_rol_id\":$ADMN}"
prueba "Sucursales"                          200 GET  /api/sucursales "$ADM"
CENT=$(campo "array_column(\$j['datos'], 'id', 'clave')['CENT']"); NORT=$(campo "array_column(\$j['datos'], 'id', 'clave')['NORT']")
prueba "Disciplinas"                         200 GET  /api/disciplinas "$ADM"
TKD=$(campo "array_column(\$j['datos'], 'id', 'nombre')['Taekwondo']"); KAR=$(campo "array_column(\$j['datos'], 'id', 'nombre')['Karate']")

echo "Qué puede dar cada quien"
prueba "Opciones del súper admin"            200 GET  /api/personal/opciones "$ADM"
igual  "Da admin, recepción, instructor y tableta" "implode(',', array_column(\$j['datos']['roles'], 'nombre'))" "admin_sucursal,recepcion,instructor,tableta"
prueba "Opciones de Laura (admin de Norte)"  200 GET  /api/personal/opciones "$LAU"
igual  "Da recepción, instructor y tableta"  "implode(',', array_column(\$j['datos']['roles'], 'nombre'))" "recepcion,instructor,tableta"
igual  "Solo en Norte"                       "implode(',', array_column(\$j['datos']['sucursales'], 'clave'))" "NORT"
prueba "Sin sesión"                          401 GET  /api/personal

echo "Alta de personal"
BASE="\"nombre\":\"Marta\",\"apellido_paterno\":\"Ruiz\",\"fecha_nacimiento\":\"1995-04-10\",\"email\":\"$MARTA\",\"telefono\":\"222 555 0101\""
prueba "Sin roles"                           422 POST /api/personal "$ADM" "{$BASE}"
prueba "No se crea otro súper admin"         403 POST /api/personal "$ADM" "{$BASE,\"roles\":[{\"rol\":\"super_admin\"}]}"
prueba "Rol de la app, no de personal"       422 POST /api/personal "$ADM" "{$BASE,\"roles\":[{\"rol\":\"alumno\",\"sucursal_id\":$CENT}]}"
prueba "Recepción sin sucursal"              422 POST /api/personal "$ADM" "{$BASE,\"roles\":[{\"rol\":\"recepcion\"}]}"
prueba "Correo mal escrito"                  422 POST /api/personal "$ADM" "{\"nombre\":\"Marta\",\"apellido_paterno\":\"Ruiz\",\"fecha_nacimiento\":\"1995-04-10\",\"email\":\"marta@\",\"roles\":[{\"rol\":\"recepcion\",\"sucursal_id\":$CENT}]}"
prueba "Teléfono incompleto"                 422 POST /api/personal "$ADM" "{\"nombre\":\"Marta\",\"apellido_paterno\":\"Ruiz\",\"fecha_nacimiento\":\"1995-04-10\",\"email\":\"$MARTA\",\"telefono\":\"2225\",\"roles\":[{\"rol\":\"recepcion\",\"sucursal_id\":$CENT}]}"
prueba "Menor de 16"                         422 POST /api/personal "$ADM" "{\"nombre\":\"Marta\",\"apellido_paterno\":\"Ruiz\",\"fecha_nacimiento\":\"2015-01-01\",\"email\":\"$MARTA\",\"roles\":[{\"rol\":\"recepcion\",\"sucursal_id\":$CENT}]}"
prueba "Laura no da recepción en Centro"     403 POST /api/personal "$LAU" "{$BASE,\"roles\":[{\"rol\":\"recepcion\",\"sucursal_id\":$CENT}]}"
prueba "Laura no da admin de sucursal"       403 POST /api/personal "$LAU" "{$BASE,\"roles\":[{\"rol\":\"admin_sucursal\",\"sucursal_id\":$NORT}]}"
prueba "Marta: recepción Centro e instructora Norte" 201 POST /api/personal "$ADM" "{$BASE,\"roles\":[{\"rol\":\"recepcion\",\"sucursal_id\":$CENT},{\"rol\":\"instructor\",\"sucursal_id\":$NORT}]}"
MID=$(campo "['datos']['usuario_id']"); TEMP=$(campo "['datos']['password_temporal']")
igual  "Contraseña temporal de 10"           "strlen(\$j['datos']['password_temporal'])" "10"
igual  "Mensaje para WhatsApp con la contraseña" "str_contains(\$j['datos']['mensaje'], \$j['datos']['password_temporal']) ? 'si' : 'no'" "si"
igual  "Teléfono limpio"                     "['datos']['telefono']" "2225550101"
igual  "Dos roles"                           "count(\$j['datos']['ficha']['roles'])" "2"
igual  "Debe cambiarla"                      "['datos']['ficha']['debe_cambiar_password']" "1"
prueba "Mismo correo otra vez"               409 POST /api/personal "$ADM" "{$BASE,\"roles\":[{\"rol\":\"recepcion\",\"sucursal_id\":$CENT}]}"
prueba "Instructores de Norte"               200 GET  "/api/instructores?sucursal_id=$NORT" "$ADM"
igual  "Marta ya puede dar clases"           "in_array('Marta', array_map(fn(\$i) => explode(' ', \$i['nombre'])[0], \$j['datos'])) ? 'si' : 'no'" "si"

echo "Primera vez que entra"
entra "Marta entra con la temporal" "$MARTA" "$TEMP"; MAR=$(campo "['datos']['token']")
igual  "Le pide cambiarla"                   "var_export(\$j['datos']['debe_cambiar_password'], true)" "true"
igual  "Tiene dos roles: elige"              "var_export(\$j['datos']['debe_elegir_rol'], true)" "true"
prueba "Sus roles"                           200 GET  /api/auth/yo "$MAR"
REC=$(campo "array_column(\$j['datos']['roles'], 'usuario_rol_id', 'rol')['recepcion']")
igual  "yo también lo dice"                  "['datos']['usuario']['debe_cambiar_password']" "1"
prueba "Elige recepción"                     200 POST /api/auth/rol "$MAR" "{\"usuario_rol_id\":$REC}"
prueba "Antes de cambiarla no ve alumnos"    403 GET  /api/alumnos "$MAR"
prueba "Contraseña actual equivocada"        422 PUT  /api/auth/contrasena "$MAR" '{"actual":"otra","nueva":"Marta2026x"}'
prueba "Nueva muy corta"                     422 PUT  /api/auth/contrasena "$MAR" "{\"actual\":\"$TEMP\",\"nueva\":\"abc1\"}"
prueba "Nueva sin números"                   422 PUT  /api/auth/contrasena "$MAR" "{\"actual\":\"$TEMP\",\"nueva\":\"solamenteletras\"}"
prueba "Igual a la temporal"                 422 PUT  /api/auth/contrasena "$MAR" "{\"actual\":\"$TEMP\",\"nueva\":\"$TEMP\"}"
prueba "La cambia"                           200 PUT  /api/auth/contrasena "$MAR" "{\"actual\":\"$TEMP\",\"nueva\":\"Marta2026x\"}"
prueba "Ya ve alumnos (misma sesión)"        200 GET  /api/alumnos "$MAR"
entra "La temporal ya no sirve" "$MARTA" "$TEMP" 401
entra "Entra con la suya" "$MARTA" "Marta2026x"
igual  "Ya no le pide cambiarla"             "var_export(\$j['datos']['debe_cambiar_password'], true)" "false"

echo "El admin de sucursal y su gente"
prueba "Personal de Norte (Laura)"           200 GET  /api/personal "$LAU"
igual  "Ve a Marta"                          "in_array($MID, array_column(\$j['datos'], 'usuario_id')) ? 'si' : 'no'" "si"
igual  "No ve al súper admin"                "in_array(1, array_column(\$j['datos'], 'usuario_id')) ? 'si' : 'no'" "no"
prueba "No abre la ficha del súper admin"    403 GET  /api/personal/1 "$LAU"
prueba "Ficha de Marta"                      200 GET  "/api/personal/$MID" "$LAU"
RCENT=$(campo "array_column(\$j['datos']['roles'], 'usuario_rol_id', 'rol')['recepcion']"); INORT=$(campo "array_column(\$j['datos']['roles'], 'usuario_rol_id', 'rol')['instructor']")
igual  "Solo puede quitar lo de Norte"       "implode(',', array_map(fn(\$r) => \$r['rol'] . ':' . (\$r['se_puede_quitar'] ? 'si' : 'no'), \$j['datos']['roles']))" "recepcion:no,instructor:si"
prueba "Laura no quita la recepción de Centro" 403 DELETE "/api/personal/$MID/roles/$RCENT" "$LAU"
prueba "Laura le da recepción en Norte"      201 POST "/api/personal/$MID/roles" "$LAU" "{\"rol\":\"recepcion\",\"sucursal_id\":$NORT}"
prueba "Otra vez el mismo rol"               409 POST "/api/personal/$MID/roles" "$LAU" "{\"rol\":\"recepcion\",\"sucursal_id\":$NORT}"
prueba "Laura le quita instructora en Norte" 200 DELETE "/api/personal/$MID/roles/$INORT" "$LAU"
igual  "Le quedan dos activos"               "count(array_filter(\$j['datos']['roles'], fn(\$r) => \$r['activo']))" "2"
prueba "Laura no se cambia a sí misma"       403 POST "/api/personal/2/roles" "$LAU" "{\"rol\":\"recepcion\",\"sucursal_id\":$NORT}"
prueba "Laura no desactiva al admin"         403 PUT  /api/personal/1 "$LAU" '{"activo":0}'

echo "Editar, restablecer y desactivar"
prueba "Corrige su apellido"                 200 PUT  "/api/personal/$MID" "$ADM" '{"apellido_materno":"Solís","telefono":"2225550199"}'
igual  "Quedó"                               "\$j['datos']['ficha']['apellido_materno'] . ' ' . \$j['datos']['ficha']['telefono']" "Solís 2225550199"
prueba "Nombre vacío"                        422 PUT  "/api/personal/$MID" "$ADM" '{"nombre":" "}'
prueba "Correo de otra persona"              409 PUT  "/api/personal/$MID" "$ADM" '{"email":"laura@dojoos.mx"}'
prueba "El súper admin no se desactiva solo" 403 PUT  /api/personal/1 "$ADM" '{"activo":0}'
prueba "Olvidó su contraseña"                200 POST "/api/personal/$MID/contrasena" "$ADM"
TEMP2=$(campo "['datos']['password_temporal']")
prueba "Su sesión se cerró"                  401 GET  /api/auth/yo "$MAR"
entra "La anterior ya no sirve" "$MARTA" "Marta2026x" 401
entra "Entra con la temporal nueva" "$MARTA" "$TEMP2"
igual  "Otra vez debe cambiarla"             "var_export(\$j['datos']['debe_cambiar_password'], true)" "true"
prueba "Se desactiva a Marta"                200 PUT  "/api/personal/$MID" "$ADM" '{"activo":0}'
entra "Desactivada no entra" "$MARTA" "$TEMP2" 401
prueba "Ya no sale en la lista"              200 GET  /api/personal "$ADM"
igual  "Sin Marta"                           "in_array($MID, array_column(\$j['datos'], 'usuario_id')) ? 'si' : 'no'" "no"
prueba "Con inactivos sí"                    200 GET  "/api/personal?inactivos=1" "$ADM"
igual  "Ahí está"                            "in_array($MID, array_column(\$j['datos'], 'usuario_id')) ? 'si' : 'no'" "si"

echo "Sucursal nueva completa"
DOM='"domicilio":{"calle":"Av. Reforma","numero":"120","colonia":"Centro","cp":"72000","municipio":"Puebla","estado":"Puebla"}'
JUL="\"nombre\":\"Julio\",\"apellido_paterno\":\"Paz\",\"fecha_nacimiento\":\"1988-09-02\",\"email\":\"$JULIO\",\"telefono\":\"2224440000\""
prueba "Laura no crea sucursales"            403 POST /api/sucursales "$LAU" "{\"clave\":\"$CLAVE\",\"nombre\":\"Sucursal $N\"}"
prueba "Domicilio sin código postal"         422 POST /api/sucursales "$ADM" "{\"clave\":\"$CLAVE\",\"nombre\":\"Sucursal $N\",\"domicilio\":{\"calle\":\"X\",\"municipio\":\"Puebla\",\"estado\":\"Puebla\"}}"
prueba "Código postal de 4"                  422 POST /api/sucursales "$ADM" "{\"clave\":\"$CLAVE\",\"nombre\":\"Sucursal $N\",\"domicilio\":{\"calle\":\"X\",\"cp\":\"7200\",\"municipio\":\"Puebla\",\"estado\":\"Puebla\"}}"
prueba "Disciplina que no existe"            404 POST /api/sucursales "$ADM" "{\"clave\":\"$CLAVE\",\"nombre\":\"Sucursal $N\",\"disciplinas\":[99999]}"
prueba "Teléfono de la sucursal incompleto"  422 POST /api/sucursales "$ADM" "{\"clave\":\"$CLAVE\",\"nombre\":\"Sucursal $N\",\"telefono\":\"123\"}"
prueba "Encargado sin datos"                 422 POST /api/sucursales "$ADM" "{\"clave\":\"$CLAVE\",\"nombre\":\"Sucursal $N\",\"encargado\":{}}"
prueba "Encargado con correo ya usado: no se crea nada" 409 POST /api/sucursales "$ADM" "{\"clave\":\"$CLAVE\",\"nombre\":\"Sucursal $N\",$DOM,\"encargado\":{\"nuevo\":{\"nombre\":\"Julio\",\"apellido_paterno\":\"Paz\",\"fecha_nacimiento\":\"1988-09-02\",\"email\":\"laura@dojoos.mx\"}}}"
prueba "Sucursales después del error"        200 GET  /api/sucursales "$ADM"
igual  "La sucursal no quedó a medias"       "in_array('$CLAVE', array_column(\$j['datos'], 'clave')) ? 'si' : 'no'" "no"
prueba "Sucursal completa con encargado nuevo" 201 POST /api/sucursales "$ADM" "{\"clave\":\"$CLAVE\",\"nombre\":\"Sucursal $N\",\"telefono\":\"2221112233\",$DOM,\"disciplinas\":[$TKD,$KAR],\"encargado\":{\"nuevo\":{$JUL}}}"
SID=$(campo "['datos']['id']"); JTEMP=$(campo "['datos']['encargado_nuevo']['password_temporal']")
igual  "Domicilio"                           "\$j['datos']['sucursal']['domicilio']['calle'] . ' ' . \$j['datos']['sucursal']['domicilio']['cp']" "Av. Reforma 72000"
igual  "Dos disciplinas"                     "count(\$j['datos']['sucursal']['disciplinas'])" "2"
igual  "Julio es el encargado"               "\$j['datos']['sucursal']['personal'][0]['nombre'] . ' ' . \$j['datos']['sucursal']['personal'][0]['rol']" "Julio Paz admin_sucursal"
igual  "Con su contraseña temporal"          "strlen(\$j['datos']['encargado_nuevo']['password_temporal'])" "10"
prueba "En la lista sale su encargado"       200 GET  /api/sucursales "$ADM"
igual  "Encargado y teléfono"                "implode(' ', array_map(fn(\$s) => \$s['encargado'] . ' ' . \$s['telefono'], array_filter(\$j['datos'], fn(\$s) => \$s['id'] == $SID)))" "Julio Paz 2221112233"
entra "Julio entra" "$JULIO" "$JTEMP"
igual  "Como admin de la sucursal nueva"     "\$j['datos']['roles'][0]['rol'] . ' ' . \$j['datos']['roles'][0]['sucursal_id']" "admin_sucursal $SID"
prueba "Clave repetida"                      409 POST /api/sucursales "$ADM" "{\"clave\":\"$CLAVE\",\"nombre\":\"Otra $N\"}"
prueba "Laura de encargada de otra sucursal" 201 POST /api/sucursales "$ADM" "{\"clave\":\"$(php -r 'echo substr(str_shuffle(str_repeat("ABCDEFGHJKLMNPQRSTUVWXYZ", 4)), 0, 4);')\",\"nombre\":\"Sucursal B $N\",$DOM,\"encargado\":{\"usuario_id\":2}}"
SID2=$(campo "['datos']['id']")
igual  "Sin contraseña nueva (ya tenía cuenta)" "var_export(\$j['datos']['encargado_nuevo'], true)" "NULL"

echo "Editar la sucursal"
prueba "Ficha de la sucursal"                200 GET  "/api/sucursales/$SID" "$ADM"
prueba "Cambia teléfono y disciplinas"       200 PUT  "/api/sucursales/$SID" "$ADM" "{\"telefono\":\"2229998877\",\"disciplinas\":[$TKD]}"
igual  "Solo Taekwondo"                      "implode(',', array_column(\$j['datos']['sucursal']['disciplinas'], 'nombre'))" "Taekwondo"
prueba "Corrige el domicilio"                200 PUT  "/api/sucursales/$SID" "$ADM" '{"domicilio":{"calle":"Av. Juárez","numero":"8","cp":"72010","municipio":"Puebla","estado":"Puebla"}}'
igual  "Domicilio nuevo"                     "['datos']['sucursal']['domicilio']['calle']" "Av. Juárez"
prueba "Centro no suelta Taekwondo (tiene horarios)" 409 PUT "/api/sucursales/$CENT" "$ADM" "{\"disciplinas\":[$KAR]}"
prueba "Laura no ve la ficha de Centro"      403 GET  "/api/sucursales/$CENT" "$LAU"

echo "Dejar todo como estaba"
prueba "Personal con inactivos"              200 GET  "/api/personal?inactivos=1&q=$N" "$ADM"
JID=$(campo "array_column(array_filter(\$j['datos'], fn(\$p) => \$p['email'] === '$JULIO'), 'usuario_id')[0] ?? 0")
prueba "Desactiva a Julio"                   200 PUT  "/api/personal/$JID" "$ADM" '{"activo":0}'
prueba "Desactiva la sucursal de prueba"     200 PUT  "/api/sucursales/$SID" "$ADM" '{"activa":0}'
prueba "Desactiva la sucursal B"             200 PUT  "/api/sucursales/$SID2" "$ADM" '{"activa":0}'
prueba "Ficha de Laura"                      200 GET  /api/personal/2 "$ADM"
LB=$(campo "array_column(array_filter(\$j['datos']['roles'], fn(\$r) => \$r['sucursal_id'] == $SID2 && \$r['activo']), 'usuario_rol_id')[0] ?? 0")
prueba "Laura deja la sucursal B"            200 DELETE "/api/personal/2/roles/$LB" "$ADM"

echo; echo "Resultado: $pasa pasaron, $falla fallaron"; [ $falla -eq 0 ]
