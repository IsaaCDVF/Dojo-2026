<?php
declare(strict_types=1);
namespace Dojo\Modulos\Avisos;

use Dojo\Modulos\Catalogos\Tarifas;
use Dojo\Modulos\Pagos\EstadoCuenta;
use Dojo\Nucleo\{Db, Parametros};

/**
 * Motor de avisos automáticos. Revisa quién debe recibir qué y deja cada aviso en `notificaciones`:
 *  - canal "app": aparece en la campanita de la app y, si el celular lo permitió, llega como notificación (Web Push).
 *  - canal "whatsapp": queda en el panel (Avisos) para que recepción lo mande con un toque desde su WhatsApp.
 * Avisos: pago por vencer (dias_aviso_pago), pago vencido, días sin venir (dias_sin_asistir) y examen autorizado.
 * Cada aviso lleva una clave única (evento + de qué + a quién), así nunca se manda dos veces.
 *
 * No hay cron: se revisa sola cuando alguien usa el sistema (panel, app o la tableta, que pregunta cada 4 minutos),
 * como mucho una vez por hora y solo entre 8:00 y 21:00 para no despertar a nadie. "Revisar ahora" la fuerza.
 */
final class Avisos
{
    private const HORA_INICIO = 8, HORA_FIN = 21;

    /** Si ya toca revisar, lo hace después de responder (no hace esperar a nadie) */
    public static function siToca(): void
    {
        static $hecho = false;
        if ($hecho) return;
        $hecho = true;
        $h = (int) date('G');
        if ($h < self::HORA_INICIO || $h >= self::HORA_FIN) return;
        try {
            if (!Db::uno("SHOW TABLES LIKE 'sistema_estado'")) return;   // falta el parche de avisos
            $ultima = Db::uno('SELECT actualizado FROM sistema_estado WHERE clave = "avisos_revision"')['actualizado'] ?? null;
            if ($ultima && strtotime($ultima) > time() - 3600) return;
        } catch (\Throwable) { return; }
        register_shutdown_function(static function () {
            if (function_exists('fastcgi_finish_request')) fastcgi_finish_request();   // la respuesta ya se fue: esto corre "atrás"
            try { self::revisar(); } catch (\Throwable $e) { error_log('Avisos: ' . $e->getMessage()); }
        });
    }

    /** Revisa al terminar esta petición sin esperar la hora (p. ej. justo después de que el instructor autoriza un examen) */
    public static function ahora(): void
    {
        static $hecho = false;
        if ($hecho) return;
        $hecho = true;
        register_shutdown_function(static function () {
            if (function_exists('fastcgi_finish_request')) fastcgi_finish_request();
            try { self::revisar(30); } catch (\Throwable $e) { error_log('Avisos: ' . $e->getMessage()); }
        });
    }

    /**
     * Genera los avisos que toquen y manda las notificaciones pendientes. @return array conteos por evento
     * $espera: segundos para esperar si otra revisión está corriendo. La revisión automática de cada hora no espera (0);
     * "Revisar ahora" y la de "examen autorizado" sí esperan, para no perder lo que acaba de pasar.
     */
    public static function revisar(int $espera = 0): array
    {
        if (!(int) (Db::uno('SELECT GET_LOCK("dojo_avisos", ?) l', [$espera])['l'] ?? 0)) return ['ocupado' => true];
        try {
            Db::ejecutar('REPLACE INTO sistema_estado (clave, valor, actualizado) VALUES ("avisos_revision", NULL, NOW())');
            $n = ['pago_por_vencer' => 0, 'pago_vencido' => 0, 'ausencia' => 0, 'examen_autorizado' => 0];
            self::pagos($n);
            self::ausencias($n);
            self::examenes($n);
            $n['notificaciones_enviadas'] = self::enviarPush();
            return $n;
        } finally {
            Db::uno('SELECT RELEASE_LOCK("dojo_avisos")');
        }
    }

    /* ---------------- Eventos ---------------- */

    private static function pagos(array &$n): void
    {
        $pv = self::plantillas('pago_por_vencer'); $vc = self::plantillas('pago_vencido');
        if (!$pv && !$vc) return;
        $hoy = new \DateTimeImmutable('today');
        $resp = Db::todos('SELECT DISTINCT r.id, r.persona_id FROM responsables_pago r JOIN alumno_responsable ar ON ar.responsable_id = r.id AND ar.vigente_hasta IS NULL
                           JOIN alumnos a ON a.id = ar.alumno_id AND a.estado = "activo"');
        foreach ($resp as $r) {
            $edo = EstadoCuenta::de((int) $r['id'], null);
            $porPeriodo = [];
            foreach ($edo['adeudos'] as $l) {
                if (!$l['periodo'] || !empty($l['en_linea'])) continue;   // con una ficha de OXXO en proceso no se le insiste
                if (!str_starts_with($l['clave'], 'mens:') && !str_starts_with($l['clave'], 'rec:')) continue;
                $porPeriodo[$l['periodo']][] = $l;
            }
            ksort($porPeriodo);
            $vencidas = []; $porVencer = [];
            foreach ($porPeriodo as $periodo => $lineas) {
                $mens = array_values(array_filter($lineas, fn($l) => str_starts_with($l['clave'], 'mens:')));
                if (!$mens) continue;
                if (in_array('vencida', array_column($mens, 'estado'), true)) $vencidas[$periodo] = $lineas; else $porVencer[$periodo] = $lineas;
            }
            $suc = static fn(array $ls) => (int) (Db::uno('SELECT sucursal_id FROM alumnos WHERE id = ?', [$ls[0]['alumno_id']])['sucursal_id']);
            $vars = static function (array $grupos) {
                $todas = array_merge(...array_values($grupos));
                $mens = array_values(array_filter($todas, fn($l) => str_starts_with($l['clave'], 'mens:')));
                return ['alumno' => self::lista(array_unique(array_column($mens, 'alumno'))),
                        'periodo' => self::meses(array_keys($grupos)),
                        'monto' => self::dinero(array_sum(array_map(fn($l) => Tarifas::aCentavos((string) ($l['precio'] ?? 0)), $todas))),
                        'fecha' => self::fecha(min(array_column($mens, 'vence')))];
            };
            // Vencido: un solo aviso con todo lo que debe; sale otra vez solo cuando cambia el mes más viejo que debe
            if ($vencidas && $vc) {
                $primero = array_key_first($vencidas);
                $n['pago_vencido'] += self::crear('pago_vencido', "vc:{$r['id']}:$primero", (int) $r['persona_id'], $suc($vencidas[$primero]), $vars($vencidas), 'responsables_pago', (int) $r['id'], $vc, '/app/pagar');
            }
            // Si ya debe algo vencido no se le manda además "por vencer" (dos mensajes el mismo día cansan; el de vencido ya dice lo que debe)
            if (!$pv || $vencidas) continue;
            foreach ($porVencer as $periodo => $lineas) {
                $s = $suc($lineas);
                $vence = min(array_column(array_filter($lineas, fn($l) => str_starts_with($l['clave'], 'mens:')), 'vence'));
                $falta = (int) $hoy->diff(new \DateTimeImmutable($vence))->format('%r%a');
                $dias = array_map('intval', array_filter(array_map('trim', explode(',', (string) (Parametros::valor('dias_aviso_pago', $s) ?? '3,1'))), 'is_numeric'));
                sort($dias);
                // El aviso de "3 días" sale si faltan 3 o 2 días (por si ese día nadie abrió el sistema); el de "1 día", con 1 o 0
                $tramo = null;
                foreach ($dias as $d) if ($falta <= $d) { $tramo = $d; break; }
                if ($tramo === null || $falta < 0) continue;
                $n['pago_por_vencer'] += self::crear('pago_por_vencer', "pv:{$r['id']}:$periodo:$tramo", (int) $r['persona_id'], $s, $vars([$periodo => $lineas]), 'responsables_pago', (int) $r['id'], $pv, '/app/pagar');
            }
        }
    }

    private static function ausencias(array &$n): void
    {
        $pl = self::plantillas('ausencia');
        if (!$pl) return;
        $alumnos = Db::todos(
            'SELECT a.id, a.persona_id, a.sucursal_id, pe.nombre, s.nombre sucursal,
                    COALESCE((SELECT MAX(DATE(x.fecha_hora)) FROM asistencias x WHERE x.alumno_id = a.id),
                             (SELECT MIN(i.fecha_inicio) FROM inscripciones i WHERE i.alumno_id = a.id AND (i.fecha_fin IS NULL OR i.fecha_fin >= CURDATE()))) ultima
             FROM alumnos a JOIN personas pe ON pe.id = a.persona_id JOIN sucursales s ON s.id = a.sucursal_id
             WHERE a.estado = "activo" AND EXISTS (SELECT 1 FROM inscripciones i WHERE i.alumno_id = a.id AND i.fecha_inicio <= CURDATE() AND (i.fecha_fin IS NULL OR i.fecha_fin >= CURDATE()))');
        foreach ($alumnos as $a) {
            $lim = (int) (Parametros::valor('dias_sin_asistir', (int) $a['sucursal_id']) ?? 14);
            if ($lim <= 0 || !$a['ultima']) continue;
            $dias = (int) (new \DateTimeImmutable($a['ultima']))->diff(new \DateTimeImmutable('today'))->days;
            if ($dias < $lim) continue;
            $vars = ['alumno' => $a['nombre'], 'dias' => (string) $dias, 'sucursal' => $a['sucursal']];
            $base = "au:{$a['id']}:{$a['ultima']}";
            foreach (self::responsablesDe((int) $a['id']) as $rp) {
                $n['ausencia'] += self::crear('ausencia', "$base:{$rp}", $rp, (int) $a['sucursal_id'], $vars, 'alumnos', (int) $a['id'], $pl, '/app/');
            }
            // El alumno también lo ve en su app (sin WhatsApp: ese va a quien paga)
            if (!in_array((int) $a['persona_id'], self::responsablesDe((int) $a['id']), true)) {
                $n['ausencia'] += self::crear('ausencia', "$base:a", (int) $a['persona_id'], (int) $a['sucursal_id'], $vars, 'alumnos', (int) $a['id'], ['app' => $pl['app'] ?? null], "/app/a/{$a['id']}");
            }
        }
    }

    private static function examenes(array &$n): void
    {
        $pl = self::plantillas('examen_autorizado');
        if (!$pl) return;
        $cExa = EstadoCuenta::concepto('examen');
        foreach (Db::todos('SELECT s.id, s.alumno_id, a.persona_id, a.sucursal_id, pe.nombre, g.nombre grado, e.fecha, s.pago_detalle_id
                            FROM solicitudes_examen s JOIN alumnos a ON a.id = s.alumno_id JOIN personas pe ON pe.id = a.persona_id
                            JOIN grados g ON g.id = s.grado_objetivo_id JOIN examenes e ON e.id = s.examen_id
                            WHERE s.estado = "autorizada" AND s.fecha_resolucion >= NOW() - INTERVAL 7 DAY AND e.fecha >= CURDATE()
                              AND e.estado = "programado" AND a.estado = "activo"') as $s) {
            $precio = $cExa ? Tarifas::precioVigente((int) $cExa['id'], (int) $s['sucursal_id']) : null;
            $vars = ['alumno' => $s['nombre'], 'grado' => $s['grado'], 'fecha' => self::fecha(substr($s['fecha'], 0, 10)),
                     'monto' => $s['pago_detalle_id'] ? 'ya está pagado' : ($precio !== null ? self::dinero(Tarifas::aCentavos((string) $precio)) : 'el que te indique recepción')];
            $ruta = "/app/a/{$s['alumno_id']}/examen";
            $quienes = self::responsablesDe((int) $s['alumno_id']);
            foreach ($quienes as $rp) $n['examen_autorizado'] += self::crear('examen_autorizado', "ex:{$s['id']}:$rp", $rp, (int) $s['sucursal_id'], $vars, 'solicitudes_examen', (int) $s['id'], $pl, $ruta);
            if (!in_array((int) $s['persona_id'], $quienes, true)) {
                $n['examen_autorizado'] += self::crear('examen_autorizado', "ex:{$s['id']}:a", (int) $s['persona_id'], (int) $s['sucursal_id'], $vars, 'solicitudes_examen', (int) $s['id'], ['app' => $pl['app'] ?? null], $ruta);
            }
        }
    }

    /* ---------------- Crear y mandar ---------------- */

    /**
     * Deja el aviso en cada canal activo. App: solo si la persona tiene cuenta. WhatsApp: solo si tiene teléfono.
     * @return int cuántos avisos nuevos (0 si ya existían)
     */
    private static function crear(string $evento, string $clave, int $personaId, int $sucursalId, array $vars, string $refTabla, int $refId, array $plantillas, string $ruta): int
    {
        $p = Db::uno('SELECT pe.nombre, (SELECT c.valor FROM contactos c WHERE c.persona_id = pe.id AND c.tipo IN ("telefono","whatsapp") ORDER BY c.principal DESC LIMIT 1) tel,
                             EXISTS(SELECT 1 FROM usuarios u WHERE u.persona_id = pe.id AND u.activo = 1) con_app
                      FROM personas pe WHERE pe.id = ?', [$personaId]);
        if (!$p) return 0;
        $vars += ['nombre' => $p['nombre'], 'dojo' => self::dojo(), 'sucursal' => Db::uno('SELECT nombre FROM sucursales WHERE id = ?', [$sucursalId])['nombre'] ?? ''];
        $nuevos = 0;
        foreach (['app' => (bool) $p['con_app'], 'whatsapp' => (bool) $p['tel']] as $canal => $puede) {
            $pl = $plantillas[$canal] ?? null;
            if (!$puede || !$pl) continue;
            $nuevos += Db::ejecutar('INSERT IGNORE INTO notificaciones (clave, persona_id, sucursal_id, plantilla_id, titulo, telefono, mensaje, fecha_programada, estado, referencia_tabla, referencia_id)
                                     VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), "programada", ?, ?)',
                ["$clave:" . ($canal === 'app' ? 'app' : 'wa'), $personaId, $sucursalId, $pl['id'], $canal === 'app' ? mb_substr(self::llenar((string) $pl['titulo'], $vars), 0, 80) : null,
                 $canal === 'whatsapp' ? $p['tel'] : null, self::llenar($pl['cuerpo'], $vars) . ($canal === 'app' ? "\n[$ruta]" : ''), $refTabla, $refId]);
        }
        return $nuevos > 0 ? 1 : 0;
    }

    /** Manda por Web Push los avisos de la app que aún no salen. @return int cuántos llegaron al menos a un celular */
    public static function enviarPush(int $limite = 200): int
    {
        $ok = 0;
        foreach (Db::todos('SELECT n.id, n.clave, n.titulo, n.mensaje, n.persona_id FROM notificaciones n JOIN plantillas_notificacion p ON p.id = n.plantilla_id
                            WHERE p.canal = "app" AND n.estado = "programada" AND n.fecha_programada <= NOW() ORDER BY n.id LIMIT ' . $limite) as $nt) {
            $subs = Db::todos('SELECT s.* FROM push_suscripciones s JOIN usuarios u ON u.id = s.usuario_id WHERE u.persona_id = ? AND u.activo = 1 AND s.fallos < 20', [$nt['persona_id']]);
            if (!self::vigente($nt)) { Db::ejecutar('UPDATE notificaciones SET estado = "omitida", motivo = "ya_no_aplica", fecha_envio = NOW() WHERE id = ?', [$nt['id']]); continue; }
            [$texto, $ruta] = self::separarRuta($nt['mensaje']);
            $llego = false;
            foreach ($subs as $s) {
                $cod = WebPush::enviar($s, ['title' => $nt['titulo'] ?: self::dojo(), 'body' => $texto, 'url' => $ruta, 'tag' => 'aviso-' . $nt['id'], 'icon' => self::icono()]);
                if ($cod >= 200 && $cod < 300) $llego = true;
            }
            // Sin celular suscrito queda solo en la campanita de la app ("omitida" con motivo sin_celular)
            Db::ejecutar('UPDATE notificaciones SET estado = ?, motivo = ?, fecha_envio = NOW() WHERE id = ?',
                [$llego ? 'enviada' : ($subs ? 'fallida' : 'omitida'), $llego || $subs ? null : 'sin_celular', $nt['id']]);
            if ($llego) $ok++;
        }
        return $ok;
    }

    /**
     * ¿Sigue siendo cierto lo que dice el aviso? (si ya pagó, ya vino o ya no está autorizado, no se manda)
     * Lee la clave: vc|pv:{responsable}:{periodo} · au:{alumno}:{última fecha} · ex:{solicitud}
     */
    public static function vigente(array $n): bool
    {
        static $cuentas = [];
        $p = explode(':', (string) ($n['clave'] ?? ''));
        switch ($p[0]) {
            case 'vc': case 'pv':
                $cuentas[$p[1]] ??= EstadoCuenta::de((int) $p[1], null)['adeudos'];
                foreach ($cuentas[$p[1]] as $l) {
                    if ($l['periodo'] === $p[2] && str_starts_with($l['clave'], 'mens:') && empty($l['en_linea'])
                        && ($p[0] === 'vc' || $l['estado'] !== 'vencida')) return true;
                }
                return false;
            case 'au':
                $a = Db::uno('SELECT a.estado, (SELECT MAX(DATE(x.fecha_hora)) FROM asistencias x WHERE x.alumno_id = a.id) ultima FROM alumnos a WHERE a.id = ?', [(int) $p[1]]);
                return $a && $a['estado'] === 'activo' && (!$a['ultima'] || $a['ultima'] <= $p[2]);
            case 'ex':
                return (bool) Db::uno('SELECT 1 FROM solicitudes_examen s JOIN examenes e ON e.id = s.examen_id JOIN alumnos a ON a.id = s.alumno_id
                                       WHERE s.id = ? AND s.estado = "autorizada" AND e.estado = "programado" AND e.fecha >= CURDATE() AND a.estado = "activo"', [(int) $p[1]]);
        }
        return true;
    }

    /* ---------------- Ayudas ---------------- */

    /** @return array{app?: array, whatsapp?: array} plantillas activas del evento */
    private static function plantillas(string $evento): array
    {
        $r = [];
        foreach (Db::todos('SELECT id, canal, titulo, cuerpo FROM plantillas_notificacion WHERE evento = ? AND activa = 1 AND canal IN ("app","whatsapp")', [$evento]) as $p) $r[$p['canal']] = $p;
        return $r;
    }

    /** Personas que pagan por el alumno (responsables vigentes) */
    private static function responsablesDe(int $alumnoId): array
    {
        return array_map('intval', array_column(Db::todos('SELECT DISTINCT r.persona_id FROM alumno_responsable ar JOIN responsables_pago r ON r.id = ar.responsable_id
                                                           WHERE ar.alumno_id = ? AND ar.vigente_hasta IS NULL', [$alumnoId]), 'persona_id'));
    }

    public static function llenar(string $texto, array $vars): string
    {
        return preg_replace_callback('/\{(\w+)\}/', fn($m) => array_key_exists($m[1], $vars) ? (string) $vars[$m[1]] : $m[0], $texto);
    }

    /** "texto\n[/app/ruta]" → [texto, ruta] (la ruta viaja escondida al final del mensaje de la app) */
    public static function separarRuta(string $m): array
    {
        return preg_match('/^(.*)\n\[(\/[^\]]*)\]$/s', $m, $x) ? [$x[1], $x[2]] : [$m, '/app/'];
    }

    private static function dojo(): string
    {
        static $d = null;
        return $d ??= preg_replace('/\p{Mn}/u', '', \Dojo\Modulos\Sistema\MarcaControlador::datos()['nombre'] ?? 'tu dojo');
    }

    private static function icono(): ?string
    {
        static $i = false;
        if ($i === false) { $im = \Dojo\Modulos\Sistema\MarcaControlador::datos()['imagenes'] ?? []; $i = $im['icono'] ?? $im['logo'] ?? null; }
        return $i;
    }

    private static function dinero(int $centavos): string
    {
        return '$' . number_format($centavos / 100, 2);
    }

    private static function fecha(string $f): string
    {
        $d = new \DateTimeImmutable($f);
        $dias = ['', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
        $meses = ['', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
        return $dias[(int) $d->format('N')] . ' ' . (int) $d->format('j') . ' de ' . $meses[(int) $d->format('n')];
    }

    /** ["2026-10","2026-11"] → "octubre y noviembre 2026" */
    private static function meses(array $periodos): string
    {
        $porAnio = [];
        foreach ($periodos as $p) { [$a, $m] = explode('-', $p); $porAnio[$a][] = mb_strtolower(explode(' ', EstadoCuenta::mes($p))[0]); }
        return self::lista(array_map(fn($a, $ms) => self::lista($ms) . " $a", array_keys($porAnio), $porAnio));
    }

    private static function lista(array $nombres): string
    {
        $nombres = array_values($nombres);
        return count($nombres) <= 1 ? (string) ($nombres[0] ?? '') : implode(', ', array_slice($nombres, 0, -1)) . ' y ' . end($nombres);
    }
}
