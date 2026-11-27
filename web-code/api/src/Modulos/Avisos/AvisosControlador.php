<?php
declare(strict_types=1);
namespace Dojo\Modulos\Avisos;

use Dojo\Modulos\Bitacora\Bitacora;
use Dojo\Nucleo\{Db, ErrorApi, Peticion, Respuesta};
use Dojo\Nucleo\Middleware\Permiso;

/**
 * Avisos automáticos.
 *  Panel (recepción): la lista de WhatsApp del día, con el mensaje ya escrito; "Ya lo mandé" / "No mandar".
 *  Panel (admin): textos de cada aviso, encender/apagar y "Revisar ahora".
 *  App: la campanita (avisos de la persona que entró) y la suscripción del celular a las notificaciones.
 */
final class AvisosControlador
{
    private const EVENTOS = ['pago_por_vencer', 'pago_vencido', 'ausencia', 'examen_autorizado'];
    /** Un WhatsApp que nadie mandó en una semana ya no sirve: se deja de mostrar */
    private const DIAS_VIGENCIA_WA = 7;

    /* ======================= Panel ======================= */

    /** GET /api/avisos?vista=pendientes|enviados&sucursal_id= — lista de WhatsApp para recepción */
    public function listar(Peticion $req): void
    {
        $propia = Permiso::sucursalDe($req);
        $suc = $propia ?? (isset($req->query['sucursal_id']) && $req->query['sucursal_id'] !== '' ? (int) $req->query['sucursal_id'] : null);
        $vista = ($req->query['vista'] ?? 'pendientes') === 'enviados' ? 'enviados' : 'pendientes';
        $f = $suc ? ' AND n.sucursal_id = ' . (int) $suc : '';

        Db::ejecutar('UPDATE notificaciones n JOIN plantillas_notificacion p ON p.id = n.plantilla_id SET n.estado = "omitida", n.motivo = "vencido", n.fecha_envio = NOW()
                      WHERE p.canal = "whatsapp" AND n.estado = "programada" AND n.fecha_programada < NOW() - INTERVAL ' . self::DIAS_VIGENCIA_WA . ' DAY');
        $sql = 'SELECT n.id, n.clave, p.evento, n.persona_id, CONCAT(pe.nombre, " ", pe.apellido_paterno) persona, n.telefono, n.mensaje, n.fecha_programada,
                       n.estado, n.fecha_envio, n.referencia_tabla, n.referencia_id, s.nombre sucursal,
                       CONCAT(ue.nombre, " ", ue.apellido_paterno) enviada_por
                FROM notificaciones n JOIN plantillas_notificacion p ON p.id = n.plantilla_id JOIN personas pe ON pe.id = n.persona_id
                LEFT JOIN sucursales s ON s.id = n.sucursal_id
                LEFT JOIN usuarios u ON u.id = n.enviada_por LEFT JOIN personas ue ON ue.id = u.persona_id
                WHERE p.canal = "whatsapp"' . $f;
        if ($vista === 'pendientes') {
            $filas = Db::todos($sql . ' AND n.estado = "programada" ORDER BY FIELD(p.evento, "pago_vencido", "pago_por_vencer", "examen_autorizado", "ausencia"), n.fecha_programada');
            $quedan = [];
            foreach ($filas as $n) {
                // Si ya pagó / ya vino / ya no está autorizado desde que se generó, el aviso se quita solo
                if (Avisos::vigente($n)) { $quedan[] = $n; continue; }
                Db::ejecutar('UPDATE notificaciones SET estado = "omitida", motivo = "ya_no_aplica", fecha_envio = NOW() WHERE id = ? AND estado = "programada"', [$n['id']]);
            }
            $filas = $quedan;
        } else {
            $filas = Db::todos($sql . ' AND n.estado IN ("enviada","omitida") AND n.fecha_envio >= NOW() - INTERVAL 30 DAY ORDER BY n.fecha_envio DESC LIMIT 200');
        }
        $conteo = array_fill_keys(self::EVENTOS, 0);
        foreach ($filas as &$n) {
            if ($vista === 'pendientes') $conteo[$n['evento']] = ($conteo[$n['evento']] ?? 0) + 1;
            $n['alumno_id'] = $this->alumnoDe($n);
            unset($n['clave']);
        }
        $rev = Db::uno('SELECT actualizado FROM sistema_estado WHERE clave = "avisos_revision"');
        Respuesta::ok(['vista' => $vista, 'avisos' => $filas, 'conteo' => $conteo, 'ultima_revision' => $rev['actualizado'] ?? null]);
    }

    /**
     * GET /api/avisos/historial?dias=7&buscar=&evento=&sucursal_id=&alumno_id= — a quién se le avisó, de qué y por dónde.
     * Una fila por aviso (no por canal): cómo le fue en la app (llegó al celular, solo campanita, leído) y en WhatsApp
     * (lo mandó X, por mandar, no se mandó y por qué). alumno_id: los avisos de ese alumno o de quien paga por él (ficha).
     */
    public function historial(Peticion $req): void
    {
        $q = $req->query;
        // Sin un alumno en particular (la pantalla de Avisos) se necesita el permiso de avisos; en la ficha basta con ver alumnos
        if (empty($q['alumno_id']) && !Permiso::tiene($req, 'avisos.enviar')) throw new ErrorApi('No tienes permiso para ver los avisos', 403);
        $propia = Permiso::sucursalDe($req);
        $suc = $propia ?? (isset($q['sucursal_id']) && $q['sucursal_id'] !== '' ? (int) $q['sucursal_id'] : null);
        $dias = max(1, min(90, (int) ($q['dias'] ?? 7)));
        $w = ['n.clave IS NOT NULL', 'n.fecha_programada >= CURDATE() - INTERVAL ' . ($dias - 1) . ' DAY', 'p.canal IN ("app","whatsapp")'];
        $par = [];
        if ($suc) { $w[] = 'n.sucursal_id = ?'; $par[] = $suc; }
        if (!empty($q['evento']) && in_array($q['evento'], self::EVENTOS, true)) { $w[] = 'p.evento = ?'; $par[] = $q['evento']; }
        $alumnoSql = '(CASE n.referencia_tabla WHEN "alumnos" THEN n.referencia_id
                       WHEN "solicitudes_examen" THEN (SELECT se.alumno_id FROM solicitudes_examen se WHERE se.id = n.referencia_id) END)';
        if (!empty($q['alumno_id'])) {
            $aid = (int) $q['alumno_id'];
            $al = Db::uno('SELECT sucursal_id FROM alumnos WHERE id = ?', [$aid]);
            if (!$al) throw new ErrorApi('Alumno no encontrado', 404);
            Permiso::exigirSucursal($req, (int) $al['sucursal_id']);
            $w[] = "($alumnoSql = ? OR (n.referencia_tabla = 'responsables_pago' AND n.referencia_id IN (SELECT ar.responsable_id FROM alumno_responsable ar WHERE ar.alumno_id = ?)))";
            array_push($par, $aid, $aid);
        }
        $filas = Db::todos("SELECT n.id, n.clave, p.evento, p.canal, n.persona_id, CONCAT(pe.nombre, ' ', pe.apellido_paterno) persona, n.telefono, n.mensaje, n.titulo,
                                   n.fecha_programada, n.estado, n.motivo, n.fecha_envio, n.leida, n.referencia_tabla, n.referencia_id, s.nombre sucursal,
                                   CONCAT(ue.nombre, ' ', ue.apellido_paterno) quien, $alumnoSql alumno_id,
                                   EXISTS(SELECT 1 FROM usuarios u2 WHERE u2.persona_id = n.persona_id AND u2.activo = 1) con_app
                            FROM notificaciones n JOIN plantillas_notificacion p ON p.id = n.plantilla_id JOIN personas pe ON pe.id = n.persona_id
                            LEFT JOIN sucursales s ON s.id = n.sucursal_id LEFT JOIN usuarios u ON u.id = n.enviada_por LEFT JOIN personas ue ON ue.id = u.persona_id
                            WHERE " . implode(' AND ', $w) . ' ORDER BY n.fecha_programada DESC, n.id DESC LIMIT 1000', $par);

        // Agrupar los dos canales del mismo aviso (la clave termina en :app o :wa)
        $grupos = [];
        foreach ($filas as $f) {
            $base = preg_replace('/:(app|wa)$/', '', (string) $f['clave']);
            $g = &$grupos[$base];
            $g ??= ['clave' => $base, 'evento' => $f['evento'], 'persona_id' => (int) $f['persona_id'], 'persona' => $f['persona'], 'sucursal' => $f['sucursal'],
                    'fecha' => $f['fecha_programada'], 'alumno_id' => $f['alumno_id'] ? (int) $f['alumno_id'] : null, 'con_app' => (bool) $f['con_app'],
                    'es_alumno' => str_ends_with($base, ':a'), 'referencia_tabla' => $f['referencia_tabla'], 'referencia_id' => (int) $f['referencia_id'],
                    'resumen' => null, 'app' => null, 'whatsapp' => null];
            if ($f['canal'] === 'app') {
                [$texto] = Avisos::separarRuta((string) $f['mensaje']);
                $g['resumen'] = $texto;
                $g['app'] = ['id' => (int) $f['id'], 'estado' => $f['estado'], 'motivo' => $f['motivo'], 'fecha' => $f['fecha_envio'], 'leida' => $f['leida'], 'titulo' => $f['titulo']];
            } else {
                $g['resumen'] ??= $f['mensaje'];
                $g['whatsapp'] = ['id' => (int) $f['id'], 'estado' => $f['estado'], 'motivo' => $f['motivo'], 'fecha' => $f['fecha_envio'], 'quien' => $f['quien'], 'telefono' => $f['telefono'], 'mensaje' => $f['mensaje']];
            }
            if ($f['fecha_programada'] < $g['fecha']) $g['fecha'] = $f['fecha_programada'];
            unset($g);
        }
        // Nombres de los alumnos (de qué alumno es el aviso)
        $lista = array_values($grupos);
        foreach ($lista as &$g) {
            $g['alumnos'] = $g['alumno_id']
                ? array_column(Db::todos('SELECT CONCAT(pe.nombre, " ", pe.apellido_paterno) n FROM alumnos a JOIN personas pe ON pe.id = a.persona_id WHERE a.id = ?', [$g['alumno_id']]), 'n')
                : ($g['referencia_tabla'] === 'responsables_pago'
                    ? array_column(Db::todos('SELECT CONCAT(pe.nombre, " ", pe.apellido_paterno) n FROM alumno_responsable ar JOIN alumnos a ON a.id = ar.alumno_id JOIN personas pe ON pe.id = a.persona_id
                                              WHERE ar.responsable_id = ? AND ar.vigente_hasta IS NULL ORDER BY pe.nombre', [$g['referencia_id']]), 'n') : []);
            unset($g['referencia_tabla'], $g['referencia_id']);
        }
        unset($g);
        if (!empty($q['buscar'])) {
            $b = mb_strtolower(trim((string) $q['buscar']));
            $lista = array_values(array_filter($lista, fn($g) => str_contains(mb_strtolower($g['persona'] . ' ' . implode(' ', $g['alumnos'])), $b)));
        }
        $kpi = ['avisos' => count($lista), 'llegaron_celular' => 0, 'leidos' => 0, 'whatsapp_mandados' => 0, 'whatsapp_por_mandar' => 0];
        foreach ($lista as $g) {
            if (($g['app']['estado'] ?? '') === 'enviada') $kpi['llegaron_celular']++;
            if (!empty($g['app']['leida'])) $kpi['leidos']++;
            if (($g['whatsapp']['estado'] ?? '') === 'enviada') $kpi['whatsapp_mandados']++;
            if (($g['whatsapp']['estado'] ?? '') === 'programada') $kpi['whatsapp_por_mandar']++;
        }
        Respuesta::ok(['dias' => $dias, 'avisos' => array_slice($lista, 0, 300), 'resumen' => $kpi]);
    }

    /** PUT /api/avisos/{id} {estado: enviada|omitida|programada} — "Ya lo mandé", "No mandar" o deshacer */
    public function marcar(Peticion $req): void
    {
        $id = (int) $req->params['id'];
        $nuevo = (string) ($req->cuerpo['estado'] ?? '');
        if (!in_array($nuevo, ['enviada', 'omitida', 'programada'], true)) throw new ErrorApi('Estado no válido', 422, ['campo' => 'estado']);
        $n = Db::uno('SELECT n.id, n.estado, n.sucursal_id FROM notificaciones n JOIN plantillas_notificacion p ON p.id = n.plantilla_id WHERE n.id = ? AND p.canal = "whatsapp"', [$id]);
        if (!$n) throw new ErrorApi('Ese aviso no existe', 404);
        if ($n['sucursal_id']) Permiso::exigirSucursal($req, (int) $n['sucursal_id']);
        if ($n['estado'] === $nuevo) { Respuesta::ok(['id' => $id, 'estado' => $nuevo]); return; }
        Db::ejecutar('UPDATE notificaciones SET estado = ?, motivo = ?, fecha_envio = IF(? = "programada", NULL, NOW()), enviada_por = IF(? IN ("enviada","omitida"), ?, NULL) WHERE id = ?',
            [$nuevo, $nuevo === 'omitida' ? 'recepcion' : null, $nuevo, $nuevo, $req->ctx['usuario_id'], $id]);
        Bitacora::cambio($req, 'notificaciones', $id, ['estado' => $n['estado']], ['estado' => $nuevo], $n['sucursal_id'] ? (int) $n['sucursal_id'] : null);
        Respuesta::ok(['id' => $id, 'estado' => $nuevo]);
    }

    /** POST /api/avisos/revisar — busca avisos nuevos ya (sin esperar la hora) */
    public function revisar(Peticion $req): void
    {
        Respuesta::ok(Avisos::revisar(30));   // si la revisión automática está corriendo, espera a que termine
    }

    /** GET /api/avisos/plantillas — textos de cada aviso y su parámetro */
    public function plantillas(Peticion $req): void
    {
        $filas = Db::todos('SELECT id, evento, canal, titulo, cuerpo, activa FROM plantillas_notificacion WHERE evento IN ("' . implode('","', self::EVENTOS) . '") AND canal IN ("app","whatsapp")
                            ORDER BY FIELD(evento, "' . implode('","', self::EVENTOS) . '"), FIELD(canal, "app", "whatsapp")');
        foreach ($filas as &$f) $f['activa'] = (bool) $f['activa'];
        $push = (int) (Db::uno('SELECT COUNT(DISTINCT usuario_id) n FROM push_suscripciones')['n'] ?? 0);
        Respuesta::ok(['plantillas' => $filas, 'celulares_con_notificaciones' => $push,
            'parametros' => ['dias_aviso_pago' => \Dojo\Nucleo\Parametros::valor('dias_aviso_pago'), 'dias_sin_asistir' => \Dojo\Nucleo\Parametros::valor('dias_sin_asistir')]]);
    }

    /** PUT /api/avisos/plantillas/{id} {cuerpo?, titulo?, activa?} */
    public function guardarPlantilla(Peticion $req): void
    {
        $id = (int) $req->params['id'];
        $antes = Db::uno('SELECT evento, canal, titulo, cuerpo, activa FROM plantillas_notificacion WHERE id = ?', [$id]);
        if (!$antes) throw new ErrorApi('Ese aviso no existe', 404);
        $c = $req->cuerpo; $d = [];
        if (array_key_exists('cuerpo', $c)) {
            $t = trim((string) $c['cuerpo']);
            if (mb_strlen($t) < 10) throw new ErrorApi('Escribe el mensaje (mínimo 10 letras)', 422, ['campo' => 'cuerpo']);
            if (mb_strlen($t) > ($antes['canal'] === 'app' ? 300 : 900)) throw new ErrorApi('El mensaje es muy largo', 422, ['campo' => 'cuerpo']);
            if (preg_match_all('/\{(\w+)\}/', $t, $m)) {
                $malas = array_diff($m[1], ['nombre', 'alumno', 'periodo', 'monto', 'fecha', 'dias', 'grado', 'dojo', 'sucursal']);
                if ($malas) throw new ErrorApi('No conozco {' . implode('}, {', $malas) . '}', 422, ['campo' => 'cuerpo']);
            }
            $d['cuerpo'] = $t;
        }
        if (array_key_exists('titulo', $c) && $antes['canal'] === 'app') {
            $t = trim((string) $c['titulo']);
            if ($t === '' || mb_strlen($t) > 80) throw new ErrorApi('El título va de 1 a 80 letras', 422, ['campo' => 'titulo']);
            $d['titulo'] = $t;
        }
        if (array_key_exists('activa', $c)) $d['activa'] = $c['activa'] ? 1 : 0;
        if (!$d) throw new ErrorApi('Nada que cambiar', 422);
        Db::ejecutar('UPDATE plantillas_notificacion SET ' . implode(', ', array_map(fn($k) => "$k = ?", array_keys($d))) . ' WHERE id = ?', [...array_values($d), $id]);
        Bitacora::cambio($req, 'plantillas_notificacion', $id, array_intersect_key($antes, $d), $d);
        Respuesta::ok(['id' => $id] + $d);
    }

    /* ======================= App ======================= */

    /** GET /api/app/avisos — la campanita: avisos de la persona que entró (últimos 60 días) */
    public function bandeja(Peticion $req): void
    {
        $pid = $this->personaDe($req);
        $filas = Db::todos('SELECT n.id, p.evento, n.titulo, n.mensaje, n.fecha_programada fecha, n.leida FROM notificaciones n JOIN plantillas_notificacion p ON p.id = n.plantilla_id
                            WHERE n.persona_id = ? AND p.canal = "app" AND n.fecha_programada >= NOW() - INTERVAL 60 DAY AND (n.motivo IS NULL OR n.motivo <> "ya_no_aplica") ORDER BY n.fecha_programada DESC, n.id DESC LIMIT 50', [$pid]);
        $sin = 0;
        foreach ($filas as &$f) {
            [$f['mensaje'], $f['ruta']] = Avisos::separarRuta($f['mensaje']);
            $f['ruta'] = preg_replace('#^/app#', '', $f['ruta']) ?: '/';
            if (!$f['leida']) $sin++;
        }
        Respuesta::ok(['avisos' => $filas, 'sin_leer' => $sin]);
    }

    /** POST /api/app/avisos/leidas {ids?: int[]} — sin ids marca todas */
    public function leidas(Peticion $req): void
    {
        $pid = $this->personaDe($req);
        $ids = array_values(array_filter(array_map('intval', (array) ($req->cuerpo['ids'] ?? [])), fn($x) => $x > 0));
        $n = $ids
            ? Db::ejecutar('UPDATE notificaciones SET leida = NOW() WHERE leida IS NULL AND persona_id = ? AND id IN (' . implode(',', $ids) . ')', [$pid])
            : Db::ejecutar('UPDATE notificaciones n JOIN plantillas_notificacion p ON p.id = n.plantilla_id SET n.leida = NOW() WHERE n.leida IS NULL AND n.persona_id = ? AND p.canal = "app" AND (n.motivo IS NULL OR n.motivo <> "ya_no_aplica")', [$pid]);
        Respuesta::ok(['marcadas' => $n]);
    }

    /** GET /api/app/notificaciones — llave pública para suscribir el celular y si este usuario ya tiene alguno */
    public function llave(Peticion $req): void
    {
        $uid = (int) $req->ctx['usuario_id'];
        Respuesta::ok(['llave' => WebPush::llavePublica(),
                       'celulares' => (int) Db::uno('SELECT COUNT(*) n FROM push_suscripciones WHERE usuario_id = ?', [$uid])['n']]);
    }

    /** POST /api/app/notificaciones {endpoint, keys: {p256dh, auth}} — el celular aceptó recibir notificaciones */
    public function suscribir(Peticion $req): void
    {
        $c = $req->cuerpo;
        $ep = (string) ($c['endpoint'] ?? '');
        $p256 = (string) ($c['keys']['p256dh'] ?? ''); $auth = (string) ($c['keys']['auth'] ?? '');
        if (!preg_match('#^https://[^\s]{10,690}$#', $ep)) throw new ErrorApi('Suscripción no válida', 422, ['campo' => 'endpoint']);
        if (strlen(WebPush::deB64u($p256)) !== 65 || strlen(WebPush::deB64u($auth)) !== 16) throw new ErrorApi('Suscripción no válida', 422, ['campo' => 'keys']);
        $uid = (int) $req->ctx['usuario_id'];
        $ua = mb_substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 120) ?: null;
        Db::ejecutar('INSERT INTO push_suscripciones (usuario_id, endpoint, endpoint_hash, p256dh, auth, dispositivo) VALUES (?, ?, ?, ?, ?, ?)
                      ON DUPLICATE KEY UPDATE usuario_id = VALUES(usuario_id), p256dh = VALUES(p256dh), auth = VALUES(auth), dispositivo = VALUES(dispositivo), fallos = 0',
            [$uid, $ep, hash('sha256', $ep), $p256, $auth, $ua]);
        // Máximo 5 celulares por cuenta: se queda con los más recientes
        Db::ejecutar('DELETE FROM push_suscripciones WHERE usuario_id = ? AND id NOT IN (SELECT id FROM (SELECT id FROM push_suscripciones WHERE usuario_id = ? ORDER BY creada DESC, id DESC LIMIT 5) x)', [$uid, $uid]);
        Respuesta::ok(['suscrito' => true]);
    }

    /** POST /api/app/notificaciones/quitar {endpoint} — ya no quiere notificaciones en este celular */
    public function desuscribir(Peticion $req): void
    {
        $ep = (string) ($req->cuerpo['endpoint'] ?? '');
        $n = Db::ejecutar('DELETE FROM push_suscripciones WHERE usuario_id = ? AND endpoint_hash = ?', [(int) $req->ctx['usuario_id'], hash('sha256', $ep)]);
        Respuesta::ok(['quitadas' => $n]);
    }

    /* ======================= Ayudas ======================= */

    private function personaDe(Peticion $req): int
    {
        $u = Db::uno('SELECT persona_id FROM usuarios WHERE id = ?', [(int) $req->ctx['usuario_id']]);
        if (!$u) throw new ErrorApi('Sesión no válida', 401);
        return (int) $u['persona_id'];
    }

    /** Alumno del aviso (para abrir su ficha desde la lista) */
    private function alumnoDe(array $n): ?int
    {
        return match ($n['referencia_tabla']) {
            'alumnos' => (int) $n['referencia_id'],
            'solicitudes_examen' => (int) (Db::uno('SELECT alumno_id FROM solicitudes_examen WHERE id = ?', [$n['referencia_id']])['alumno_id'] ?? 0) ?: null,
            default => null,
        };
    }
}
