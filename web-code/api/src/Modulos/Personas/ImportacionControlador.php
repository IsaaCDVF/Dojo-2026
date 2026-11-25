<?php
declare(strict_types=1);
namespace Dojo\Modulos\Personas;

use Dojo\Modulos\Bitacora\Bitacora;
use Dojo\Nucleo\{Db, ErrorApi, Folios, Peticion, Respuesta};
use Dojo\Nucleo\Middleware\Permiso;

/**
 * 2.6 Carga masiva de alumnos desde CSV (migrar a los alumnos que ya venían del sistema anterior).
 * Dos pasos: primero se revisa (sin guardar nada) y se ve el reporte de errores por renglón;
 * después se confirma y se importan solo los renglones válidos.
 * Cada carga queda en "importaciones" con lo que creó, para poder revertirla mientras esos alumnos
 * no tengan pagos, asistencias, inscripciones ni exámenes.
 */
final class ImportacionControlador
{
    public const MAX_FILAS = 2000;
    /** encabezado del CSV => campo; se aceptan sin acentos, con espacios y en mayúsculas */
    private const COLUMNAS = [
        'nombre' => 'nombre', 'apellido_paterno' => 'apellido_paterno', 'apellido_materno' => 'apellido_materno',
        'fecha_nacimiento' => 'fecha_nacimiento', 'fecha_de_nacimiento' => 'fecha_nacimiento', 'nacimiento' => 'fecha_nacimiento',
        'paterno' => 'apellido_paterno', 'materno' => 'apellido_materno', 'fecha_de_alta' => 'fecha_alta', 'alta' => 'fecha_alta',
        'correo_electronico' => 'email', 'celular' => 'telefono', 'telefono_responsable' => 'responsable_telefono', 'curp' => 'curp', 'sexo' => 'sexo', 'telefono' => 'telefono', 'email' => 'email', 'correo' => 'email',
        'fecha_alta' => 'fecha_alta', 'sucursal' => 'sucursal', 'disciplina' => 'disciplina', 'grado' => 'grado',
        'responsable_nombre' => 'responsable_nombre', 'responsable_apellido' => 'responsable_apellido', 'responsable_apellido_paterno' => 'responsable_apellido',
        'responsable_telefono' => 'responsable_telefono', 'responsable_parentesco' => 'responsable_parentesco', 'parentesco' => 'responsable_parentesco',
    ];
    private const OBLIGATORIAS = ['nombre', 'apellido_paterno', 'fecha_nacimiento', 'curp'];

    /**
     * POST /api/alumnos/importar {archivo, csv, sucursal_id?, confirmar?}
     * Sin confirmar: reporte (filas, válidas, errores por renglón, muestra). Con confirmar: importa las válidas.
     */
    public function importar(Peticion $req): void
    {
        $d = $req->requeridos('csv');
        $archivo = mb_substr(trim((string) ($req->cuerpo['archivo'] ?? 'alumnos.csv')), 0, 200) ?: 'alumnos.csv';
        $sucRol = Permiso::sucursalDe($req);
        $sucPorDefecto = $sucRol ?? (!empty($req->cuerpo['sucursal_id']) ? (int) $req->cuerpo['sucursal_id'] : null);

        [$filas, $faltan] = $this->leer((string) $d['csv']);
        if ($faltan) throw new ErrorApi('Al archivo le faltan columnas obligatorias: ' . implode(', ', $faltan) . '. Descarga la plantilla.', 422, ['faltan' => $faltan]);
        if (!$filas) throw new ErrorApi('El archivo no tiene renglones con datos', 422);
        if (count($filas) > self::MAX_FILAS) throw new ErrorApi('Máximo ' . self::MAX_FILAS . ' alumnos por archivo; divídelo en partes', 422);

        $plan = $this->revisar($filas, $sucRol, $sucPorDefecto);
        $validas = array_values(array_filter($plan, fn($p) => !$p['errores']));
        $errores = [];
        foreach ($plan as $p) foreach ($p['errores'] as $e) $errores[] = ['fila' => $p['fila'], 'campo' => $e[0], 'mensaje' => $e[1], 'nombre' => $p['nombre_completo']];
        $resumen = ['archivo' => $archivo, 'filas' => count($plan), 'validas' => count($validas), 'con_error' => count($plan) - count($validas),
                    'sin_foto' => count($validas), 'errores' => array_slice($errores, 0, 500),
                    'muestra' => array_map(fn($p) => $this->vista($p), array_slice($plan, 0, 25))];

        if (empty($req->cuerpo['confirmar'])) { Respuesta::ok($resumen); return; }
        if (!$validas) throw new ErrorApi('No hay renglones válidos para importar', 422, $resumen);

        $res = Db::transaccion(function () use ($req, $validas, $plan, $archivo) {
            $imp = Db::insertar('INSERT INTO importaciones (usuario_id, tipo, entidad, formato, archivo, filas_ok, filas_error, estado) VALUES (?, "importacion", "alumnos", "csv", ?, ?, ?, "procesando")',
                [$req->ctx['usuario_id'], $archivo, count($validas), count($plan) - count($validas)]);
            $nuevosResp = [];   // teléfono => id de responsable creado en esta carga (hermanos)
            $creados = 0;
            foreach ($validas as $p) {
                $pid = Db::insertar('INSERT INTO personas (nombre, apellido_paterno, apellido_materno, fecha_nacimiento, sexo, curp) VALUES (?, ?, ?, ?, ?, ?)',
                    [$p['nombre'], $p['apellido_paterno'], $p['apellido_materno'], $p['fecha_nacimiento'], $p['sexo'], $p['curp']]);
                if ($p['telefono']) Db::ejecutar('INSERT INTO contactos (persona_id, tipo, valor, principal) VALUES (?, "telefono", ?, 1)', [$pid, $p['telefono']]);
                if ($p['email']) Db::ejecutar('INSERT INTO contactos (persona_id, tipo, valor, principal) VALUES (?, "email", ?, 0)', [$pid, $p['email']]);
                $matricula = Folios::siguiente($p['sucursal_id'], 'matricula');
                $aid = Db::insertar('INSERT INTO alumnos (matricula, persona_id, sucursal_id, fecha_alta, codigo_qr) VALUES (?, ?, ?, ?, ?)',
                    [$matricula, $pid, $p['sucursal_id'], $p['fecha_alta'], bin2hex(random_bytes(16))]);
                Db::ejecutar('INSERT INTO importacion_registros (importacion_id, tabla, registro_id) VALUES (?, "alumnos", ?)', [$imp, $aid]);

                $r = $p['responsable'];
                if ($r['tipo'] === 'el_mismo') {
                    $rid = Db::insertar('INSERT INTO responsables_pago (persona_id) VALUES (?)', [$pid]);
                    Db::ejecutar('INSERT INTO importacion_registros (importacion_id, tabla, registro_id) VALUES (?, "responsables_pago", ?)', [$imp, $rid]);
                } elseif ($r['tipo'] === 'existente') {
                    $rid = $r['id'];
                } elseif (isset($nuevosResp[$r['telefono']])) {
                    $rid = $nuevosResp[$r['telefono']];
                } else {
                    $rp = Db::insertar('INSERT INTO personas (nombre, apellido_paterno, fecha_nacimiento) VALUES (?, ?, "1900-01-01")', [$r['nombre'], $r['apellido']]);
                    Db::ejecutar('INSERT INTO contactos (persona_id, tipo, valor, principal) VALUES (?, "telefono", ?, 1)', [$rp, $r['telefono']]);
                    $rid = Db::insertar('INSERT INTO responsables_pago (persona_id) VALUES (?)', [$rp]);
                    Db::ejecutar('INSERT INTO importacion_registros (importacion_id, tabla, registro_id) VALUES (?, "responsables_pago", ?)', [$imp, $rid]);
                    $nuevosResp[$r['telefono']] = $rid;
                }
                Db::ejecutar('INSERT INTO alumno_responsable (alumno_id, responsable_id, parentesco, vigente_desde) VALUES (?, ?, ?, ?)',
                    [$aid, $rid, $r['parentesco'], $p['fecha_alta']]);
                if ($p['grado_id']) {
                    Db::ejecutar('INSERT INTO alumno_grados (alumno_id, grado_id, fecha_obtencion, origen) VALUES (?, ?, ?, "migracion")', [$aid, $p['grado_id'], $p['fecha_alta']]);
                }
                $creados++;
            }
            Db::ejecutar('UPDATE importaciones SET estado = ? WHERE id = ?', [count($validas) === count($plan) ? 'completada' : 'con_errores', $imp]);
            Bitacora::alta($req, 'importaciones', $imp, ['archivo' => $archivo, 'alumnos' => $creados, 'renglones_con_error' => count($plan) - count($validas)]);
            return ['importacion_id' => $imp, 'creados' => $creados];
        });
        Respuesta::ok($res + $resumen, 201);
    }

    /** GET /api/importaciones — historial de cargas */
    public function listar(Peticion $req): void
    {
        $s = Permiso::sucursalDe($req);
        $lista = Db::todos(
            'SELECT i.id, i.archivo, i.fecha, i.filas_ok, i.filas_error, i.estado, u.email AS usuario,
                    (SELECT COUNT(*) FROM importacion_registros r WHERE r.importacion_id = i.id AND r.tabla = "alumnos") AS alumnos,
                    (SELECT GROUP_CONCAT(DISTINCT s.nombre) FROM importacion_registros r JOIN alumnos a ON a.id = r.registro_id JOIN sucursales s ON s.id = a.sucursal_id
                      WHERE r.importacion_id = i.id AND r.tabla = "alumnos") AS sucursales
             FROM importaciones i JOIN usuarios u ON u.id = i.usuario_id
             WHERE i.entidad = "alumnos"' . ($s ? ' AND EXISTS (SELECT 1 FROM importacion_registros r JOIN alumnos a ON a.id = r.registro_id
                                                   WHERE r.importacion_id = i.id AND r.tabla = "alumnos" AND a.sucursal_id = ?)' : '') . '
             ORDER BY i.id DESC LIMIT 50', $s ? [$s] : []);
        Respuesta::ok($lista);
    }

    /** PUT /api/importaciones/{id}/revertir — borra lo que creó una carga, si nadie lo ha usado todavía */
    public function revertir(Peticion $req): void
    {
        $imp = Db::uno('SELECT id, estado, archivo FROM importaciones WHERE id = ? AND entidad = "alumnos"', [$req->params['id']]);
        if (!$imp) throw new ErrorApi('Importación no encontrada', 404);
        if ($imp['estado'] === 'revertida') throw new ErrorApi('Esa carga ya se revirtió', 409);
        $alumnos = array_map('intval', array_column(Db::todos('SELECT registro_id FROM importacion_registros WHERE importacion_id = ? AND tabla = "alumnos"', [$imp['id']]), 'registro_id'));
        $resp = array_map('intval', array_column(Db::todos('SELECT registro_id FROM importacion_registros WHERE importacion_id = ? AND tabla = "responsables_pago"', [$imp['id']]), 'registro_id'));
        $s = Permiso::sucursalDe($req);
        if ($s !== null && $alumnos && Db::uno('SELECT 1 FROM alumnos WHERE id IN (' . implode(',', $alumnos) . ') AND sucursal_id <> ?', [$s])) {
            throw new ErrorApi('Esa carga incluye alumnos de otra sucursal', 403);
        }
        if ($alumnos) {
            $in = implode(',', $alumnos);
            $usados = Db::todos("SELECT a.matricula, CONCAT(p.nombre, ' ', p.apellido_paterno) AS nombre FROM alumnos a JOIN personas p ON p.id = a.persona_id
                WHERE a.id IN ($in) AND (EXISTS (SELECT 1 FROM inscripciones x WHERE x.alumno_id = a.id) OR EXISTS (SELECT 1 FROM asistencias x WHERE x.alumno_id = a.id)
                  OR EXISTS (SELECT 1 FROM pago_detalles x WHERE x.alumno_id = a.id) OR EXISTS (SELECT 1 FROM solicitudes_examen x WHERE x.alumno_id = a.id)
                  OR EXISTS (SELECT 1 FROM accesos_rechazados x WHERE x.alumno_id = a.id)
                  OR EXISTS (SELECT 1 FROM alumno_grados x WHERE x.alumno_id = a.id AND x.origen <> 'migracion')) LIMIT 10");
            if ($usados) throw new ErrorApi('No se puede revertir: ' . count($usados) . ' alumno(s) ya tienen clases, pagos, asistencias o exámenes (' .
                implode(', ', array_map(fn($u) => $u['matricula'], $usados)) . ')', 409, ['usados' => $usados]);
        }
        Db::transaccion(function () use ($req, $imp, $alumnos, $resp) {
            if ($alumnos) {
                $in = implode(',', $alumnos);
                $personas = array_column(Db::todos("SELECT persona_id FROM alumnos WHERE id IN ($in)"), 'persona_id');
                Db::ejecutar("DELETE FROM alumno_grados WHERE alumno_id IN ($in)");
                Db::ejecutar("DELETE FROM alumno_responsable WHERE alumno_id IN ($in)");
                Db::ejecutar("DELETE FROM alumnos WHERE id IN ($in)");
            }
            // Responsables creados por la carga que ya no pagan por nadie
            foreach ($resp as $rid) {
                if (Db::uno('SELECT 1 FROM alumno_responsable WHERE responsable_id = ?', [$rid])) continue;
                if (Db::uno('SELECT 1 FROM pagos WHERE responsable_id = ?', [$rid])) continue;
                $p = Db::uno('SELECT persona_id FROM responsables_pago WHERE id = ?', [$rid]);
                Db::ejecutar('DELETE FROM responsables_pago WHERE id = ?', [$rid]);
                if ($p && !Db::uno('SELECT 1 FROM alumnos WHERE persona_id = ?', [$p['persona_id']]) && !Db::uno('SELECT 1 FROM usuarios WHERE persona_id = ?', [$p['persona_id']])) {
                    $personas[] = $p['persona_id'];
                }
            }
            foreach (array_unique($personas ?? []) as $pid) {
                if (Db::uno('SELECT 1 FROM alumnos WHERE persona_id = ?', [$pid]) || Db::uno('SELECT 1 FROM responsables_pago WHERE persona_id = ?', [$pid])) continue;
                Db::ejecutar('DELETE FROM contactos WHERE persona_id = ?', [$pid]);
                Db::ejecutar('DELETE FROM personas WHERE id = ?', [$pid]);
            }
            Db::ejecutar('UPDATE importaciones SET estado = "revertida" WHERE id = ?', [$imp['id']]);
            Bitacora::cambio($req, 'importaciones', (int) $imp['id'], ['estado' => $imp['estado']], ['estado' => 'revertida']);
        });
        Respuesta::ok(['id' => (int) $imp['id'], 'estado' => 'revertida', 'alumnos_borrados' => count($alumnos)]);
    }

    /* ---------------- lectura y reglas ---------------- */

    /** @return array{0: array, 1: array} filas (con su número de renglón) y columnas obligatorias que faltan */
    private function leer(string $csv): array
    {
        if (!mb_check_encoding($csv, 'UTF-8')) $csv = mb_convert_encoding($csv, 'UTF-8', 'Windows-1252');
        $csv = preg_replace('/^\xEF\xBB\xBF/', '', $csv);
        $lineas = preg_split('/\r\n|\n|\r/', $csv);
        while ($lineas && trim((string) end($lineas)) === '') array_pop($lineas);
        if (!$lineas) return [[], self::OBLIGATORIAS];
        $sep = substr_count($lineas[0], ';') > substr_count($lineas[0], ',') ? ';' : (substr_count($lineas[0], "\t") > substr_count($lineas[0], ',') ? "\t" : ',');
        $mapa = [];
        foreach (str_getcsv($lineas[0], $sep) as $i => $h) {
            $k = strtolower(trim(strtr($h, ['á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'Á' => 'a', 'É' => 'e', 'Í' => 'i', 'Ó' => 'o', 'Ú' => 'u', 'ñ' => 'n'])));
            $k = preg_replace('/[^a-z]+/', '_', $k);
            $k = trim($k, '_');
            if (isset(self::COLUMNAS[$k])) $mapa[$i] = self::COLUMNAS[$k];
        }
        $faltan = array_values(array_diff(self::OBLIGATORIAS, $mapa));
        $filas = [];
        foreach (array_slice($lineas, 1) as $n => $l) {
            if (trim(str_replace($sep, '', $l)) === '') continue;
            $v = str_getcsv($l, $sep);
            $f = ['_fila' => $n + 2];
            foreach ($mapa as $i => $campo) $f[$campo] = trim((string) ($v[$i] ?? ''));
            $filas[] = $f;
        }
        return [$filas, $faltan];
    }

    private function revisar(array $filas, ?int $sucRol, ?int $sucPorDefecto): array
    {
        $sucursales = [];
        foreach (Db::todos('SELECT id, clave, nombre FROM sucursales WHERE activa = 1') as $s) {
            $sucursales[strtolower($s['clave'])] = (int) $s['id']; $sucursales[strtolower($s['nombre'])] = (int) $s['id'];
        }
        $disciplinas = [];
        foreach (Db::todos('SELECT id, nombre FROM disciplinas WHERE activa = 1') as $x) $disciplinas[mb_strtolower($x['nombre'])] = (int) $x['id'];
        $curps = []; $plan = [];
        foreach ($filas as $f) {
            $e = [];
            $p = ['fila' => $f['_fila'], 'nombre' => $f['nombre'] ?? '', 'apellido_paterno' => $f['apellido_paterno'] ?? '',
                  'apellido_materno' => ($f['apellido_materno'] ?? '') ?: null, 'nombre_completo' => trim(($f['nombre'] ?? '') . ' ' . ($f['apellido_paterno'] ?? ''))];
            foreach (self::OBLIGATORIAS as $k) if (($f[$k] ?? '') === '') $e[] = [$k, 'Falta el dato'];

            $p['curp'] = strtoupper($f['curp'] ?? '');
            if ($p['curp'] !== '') {
                if (!preg_match(AlumnoControlador::CURP, $p['curp'])) $e[] = ['curp', 'Formato de CURP no válido'];
                elseif (isset($curps[$p['curp']])) $e[] = ['curp', 'Repetida en el renglón ' . $curps[$p['curp']]];
                elseif (Db::uno('SELECT 1 FROM personas WHERE curp = ?', [$p['curp']])) $e[] = ['curp', 'Ya existe en el sistema'];
                $curps[$p['curp']] ??= $f['_fila'];
            }
            $p['fecha_nacimiento'] = $this->fecha($f['fecha_nacimiento'] ?? '');
            if (($f['fecha_nacimiento'] ?? '') !== '' && (!$p['fecha_nacimiento'] || $p['fecha_nacimiento'] > date('Y-m-d') || $p['fecha_nacimiento'] < date('Y-m-d', strtotime('-100 years')))) {
                $e[] = ['fecha_nacimiento', 'Fecha no válida (usa AAAA-MM-DD o DD/MM/AAAA)'];
            }
            $p['fecha_alta'] = ($f['fecha_alta'] ?? '') === '' ? date('Y-m-d') : $this->fecha($f['fecha_alta']);
            if (!$p['fecha_alta'] || $p['fecha_alta'] > date('Y-m-d') || $p['fecha_alta'] < date('Y-m-d', strtotime('-10 years'))) { $e[] = ['fecha_alta', 'Fecha de alta no válida']; $p['fecha_alta'] = date('Y-m-d'); }
            $sx = strtoupper(substr($f['sexo'] ?? '', 0, 1));
            $p['sexo'] = in_array($sx, ['F', 'M', 'X'], true) ? $sx : ($sx === 'H' ? 'M' : null);
            $p['telefono'] = $this->tel($f['telefono'] ?? '', 'telefono', $e);
            $p['email'] = null;
            if (($f['email'] ?? '') !== '') { if (filter_var($f['email'], FILTER_VALIDATE_EMAIL)) $p['email'] = strtolower($f['email']); else $e[] = ['email', 'Correo no válido']; }

            // Sucursal: la del rol; un rol global la toma de la columna o de la elegida en pantalla
            $p['sucursal_id'] = $sucRol;
            if ($sucRol === null) {
                $col = strtolower($f['sucursal'] ?? '');
                $p['sucursal_id'] = $col !== '' ? ($sucursales[$col] ?? null) : $sucPorDefecto;
                if (!$p['sucursal_id']) $e[] = ['sucursal', $col !== '' ? "No existe la sucursal \"{$f['sucursal']}\"" : 'Elige la sucursal o agrega la columna sucursal'];
            }

            // Grado (opcional): disciplina + grado por nombre o por color de cinta; sin grado = el primero
            $p['grado_id'] = null; $p['grado'] = null;
            if (($f['disciplina'] ?? '') !== '') {
                $did = $disciplinas[mb_strtolower($f['disciplina'])] ?? null;
                if (!$did) $e[] = ['disciplina', "No existe la disciplina \"{$f['disciplina']}\""];
                else {
                    $g = ($f['grado'] ?? '') === ''
                        ? Db::uno('SELECT id, nombre FROM grados WHERE disciplina_id = ? AND activo = 1 ORDER BY orden LIMIT 1', [$did])
                        : Db::uno('SELECT id, nombre FROM grados WHERE disciplina_id = ? AND activo = 1 AND (LOWER(nombre) = LOWER(?) OR LOWER(color_cinta) = LOWER(?)) ORDER BY orden LIMIT 1', [$did, $f['grado'], $f['grado']]);
                    if (!$g) $e[] = ['grado', ($f['grado'] ?? '') === '' ? "{$f['disciplina']} todavía no tiene grados dados de alta (Configuración)" : "No existe el grado \"{$f['grado']}\" en {$f['disciplina']}"];
                    else { $p['grado_id'] = (int) $g['id']; $p['grado'] = $f['disciplina'] . ' · ' . $g['nombre']; }
                }
            } elseif (($f['grado'] ?? '') !== '') $e[] = ['disciplina', 'Indica la disciplina del grado'];

            // Responsable: existente (por teléfono), nuevo, o él mismo si es adulto y no se indicó
            $edad = $p['fecha_nacimiento'] ? (new \DateTime($p['fecha_nacimiento']))->diff(new \DateTime())->y : 0;
            $rn = $f['responsable_nombre'] ?? '';
            if ($rn === '') {
                if ($p['fecha_nacimiento'] && $edad < 18) $e[] = ['responsable_nombre', "Es menor de edad ($edad años): necesita un responsable de pago"];
                $p['responsable'] = ['tipo' => 'el_mismo', 'parentesco' => 'él mismo'];
            } else {
                $rt = $this->tel($f['responsable_telefono'] ?? '', 'responsable_telefono', $e);
                if (!$rt && ($f['responsable_telefono'] ?? '') === '') $e[] = ['responsable_telefono', 'Falta el teléfono del responsable'];
                if (($f['responsable_apellido'] ?? '') === '') $e[] = ['responsable_apellido', 'Falta el apellido del responsable'];
                $exist = $rt ? Db::uno('SELECT r.id, CONCAT(pe.nombre, " ", pe.apellido_paterno) AS nombre FROM responsables_pago r JOIN personas pe ON pe.id = r.persona_id
                                        JOIN contactos c ON c.persona_id = pe.id AND c.tipo IN ("telefono","whatsapp") WHERE c.valor = ? ORDER BY r.id LIMIT 1', [$rt]) : null;
                $par = ($f['responsable_parentesco'] ?? '') ?: 'responsable';
                $p['responsable'] = $exist
                    ? ['tipo' => 'existente', 'id' => (int) $exist['id'], 'nombre' => $exist['nombre'], 'parentesco' => $par]
                    : ['tipo' => 'nuevo', 'nombre' => $rn, 'apellido' => $f['responsable_apellido'] ?? '', 'telefono' => $rt, 'parentesco' => $par];
            }
            $p['errores'] = $e;
            $plan[] = $p;
        }
        return $plan;
    }

    private function vista(array $p): array
    {
        $r = $p['responsable'];
        return ['fila' => $p['fila'], 'nombre' => trim($p['nombre_completo'] . ' ' . ($p['apellido_materno'] ?? '')), 'curp' => $p['curp'],
                'fecha_alta' => $p['fecha_alta'], 'grado' => $p['grado'], 'ok' => !$p['errores'],
                'responsable' => $r['tipo'] === 'el_mismo' ? 'Él mismo' : ($r['tipo'] === 'existente' ? "{$r['nombre']} (ya registrado)" : trim("{$r['nombre']} {$r['apellido']} (nuevo)"))];
    }

    private function fecha(string $f): ?string
    {
        $f = trim($f);
        if (preg_match('/^(\d{4})-(\d{1,2})-(\d{1,2})$/', $f, $m)) [$a, $me, $d] = [$m[1], $m[2], $m[3]];
        elseif (preg_match('#^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$#', $f, $m)) [$a, $me, $d] = [$m[3], $m[2], $m[1]];
        else return null;
        return checkdate((int) $me, (int) $d, (int) $a) ? sprintf('%04d-%02d-%02d', $a, $me, $d) : null;
    }

    private function tel(string $t, string $campo, array &$e): ?string
    {
        if (trim($t) === '') return null;
        $n = preg_replace('/\D/', '', $t);
        if (strlen($n) === 12 && str_starts_with($n, '52')) $n = substr($n, 2);
        if (strlen($n) !== 10) { $e[] = [$campo, 'El teléfono debe tener 10 dígitos']; return null; }
        return $n;
    }
}
