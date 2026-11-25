<?php
declare(strict_types=1);
namespace Dojo\Modulos\App;

use Dojo\Modulos\Auth\AuthControlador;
use Dojo\Modulos\Bitacora\Bitacora;
use Dojo\Nucleo\{Db, ErrorApi, Peticion, Respuesta};
use Dojo\Nucleo\Middleware\Permiso;

/**
 * Acceso a la app móvil (decisión del cliente: el acceso lo da recepción, la app no tiene registro abierto).
 *  1. En la ficha del alumno, recepción da acceso al alumno o a su responsable de pago.
 *  2. Se crea el usuario (rol alumno o responsable) y un código de 6 dígitos que vence en 72 horas.
 *  3. Recepción lo manda por WhatsApp; en la app la persona pone su usuario, el código y su contraseña.
 * Usuario: el alumno usa su matrícula; el responsable, su teléfono. Dar acceso otra vez = nuevo código
 * (sirve para "olvidé mi contraseña").
 */
final class AccesoControlador
{
    private const HORAS = 72;
    private const MAX_INTENTOS = 5;

    /** GET /api/alumnos/{id}/app — quién de esta ficha tiene acceso a la app */
    public function estado(Peticion $req): void
    {
        $a = $this->alumno((int) $req->params['id'], $req);
        $lista = [$this->persona('alumno', (int) $a['persona_id'], $a['nombre'], $a['matricula'], null)];
        foreach (Db::todos('SELECT r.id, r.persona_id, CONCAT(pe.nombre, " ", pe.apellido_paterno) AS nombre, ar.parentesco,
                                   (SELECT c.valor FROM contactos c WHERE c.persona_id = pe.id AND c.tipo IN ("telefono","whatsapp") ORDER BY c.principal DESC LIMIT 1) AS telefono
                            FROM alumno_responsable ar JOIN responsables_pago r ON r.id = ar.responsable_id JOIN personas pe ON pe.id = r.persona_id
                            WHERE ar.alumno_id = ? AND ar.vigente_hasta IS NULL', [$a['id']]) as $r) {
            if ((int) $r['persona_id'] === (int) $a['persona_id']) { $lista[0]['tambien_responsable'] = true; continue; }
            $lista[] = $this->persona('responsable', (int) $r['persona_id'], $r['nombre'], $r['telefono'], (int) $r['id']) + ['parentesco' => $r['parentesco']];
        }
        Respuesta::ok($lista);
    }

    /** POST /api/alumnos/{id}/app {para: alumno|responsable, responsable_id?} → código de activación */
    public function dar(Peticion $req): void
    {
        $a = $this->alumno((int) $req->params['id'], $req);
        $para = $req->requeridos('para')['para'];
        if ($para === 'alumno') {
            if ($a['estado'] !== 'activo') throw new ErrorApi('El alumno no está activo', 409);
            $pid = (int) $a['persona_id']; $login = $a['matricula']; $rol = 'alumno';
            $tel = Db::uno('SELECT c.valor FROM contactos c WHERE c.persona_id = ? AND c.tipo IN ("telefono","whatsapp") ORDER BY c.principal DESC LIMIT 1', [$pid])['valor'] ?? null;
            // Un niño casi nunca tiene teléfono: el código se manda al WhatsApp de quien paga por él
            $tel ??= Db::uno('SELECT c.valor FROM alumno_responsable ar JOIN responsables_pago r ON r.id = ar.responsable_id
                              JOIN contactos c ON c.persona_id = r.persona_id AND c.tipo IN ("telefono","whatsapp")
                              WHERE ar.alumno_id = ? AND ar.vigente_hasta IS NULL ORDER BY c.principal DESC LIMIT 1', [$a['id']])['valor'] ?? null;
            // Si el alumno paga por sí mismo, también entra como responsable (ve sus pagos)
            $roles = Db::uno('SELECT 1 FROM responsables_pago r JOIN alumno_responsable ar ON ar.responsable_id = r.id AND ar.vigente_hasta IS NULL
                              WHERE r.persona_id = ? LIMIT 1', [$pid]) ? ['alumno', 'responsable'] : ['alumno'];
        } elseif ($para === 'responsable') {
            $rid = (int) ($req->cuerpo['responsable_id'] ?? 0);
            $r = Db::uno('SELECT r.persona_id FROM alumno_responsable ar JOIN responsables_pago r ON r.id = ar.responsable_id
                          WHERE ar.alumno_id = ? AND ar.responsable_id = ? AND ar.vigente_hasta IS NULL', [$a['id'], $rid]);
            if (!$r) throw new ErrorApi('Ese responsable no paga por este alumno', 422);
            $pid = (int) $r['persona_id']; $rol = 'responsable'; $roles = ['responsable'];
            $tel = Db::uno('SELECT c.valor FROM contactos c WHERE c.persona_id = ? AND c.tipo IN ("telefono","whatsapp") ORDER BY c.principal DESC LIMIT 1', [$pid])['valor'] ?? null;
            if (!$tel) throw new ErrorApi('El responsable no tiene teléfono: es su usuario para entrar a la app. Agrégalo primero.', 422);
            $login = $tel;
            if (Db::uno('SELECT 1 FROM contactos c JOIN usuarios u ON u.persona_id = c.persona_id JOIN responsables_pago r ON r.persona_id = c.persona_id
                         WHERE c.tipo IN ("telefono","whatsapp") AND c.valor = ? AND c.persona_id <> ?', [$tel, $pid])) {
                throw new ErrorApi('Ese teléfono ya es el usuario de otro responsable en la app', 409);
            }
        } else throw new ErrorApi('Indica si el acceso es para el alumno o para el responsable', 422);

        $codigo = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $res = Db::transaccion(function () use ($req, $a, $pid, $roles, $codigo, $login) {
            $u = Db::uno('SELECT id, password_hash FROM usuarios WHERE persona_id = ?', [$pid]);
            $nuevo = !$u;
            if ($nuevo) {
                // usuarios.email es obligatorio y único: el correo de la persona si no lo usa nadie, si no uno interno
                $mail = Db::uno('SELECT c.valor FROM contactos c WHERE c.persona_id = ? AND c.tipo = "email" LIMIT 1', [$pid])['valor'] ?? null;
                if (!$mail || Db::uno('SELECT 1 FROM usuarios WHERE email = ?', [strtolower($mail)])) $mail = "app-$pid@dojoos.local";
                $uid = Db::insertar('INSERT INTO usuarios (persona_id, email, password_hash) VALUES (?, ?, ?)',
                    [$pid, strtolower($mail), password_hash(bin2hex(random_bytes(16)), PASSWORD_DEFAULT)]);
            } else $uid = (int) $u['id'];
            foreach ($roles as $nombre) {
                if (!Db::uno('SELECT 1 FROM usuario_roles ur JOIN roles r ON r.id = ur.rol_id WHERE ur.usuario_id = ? AND r.nombre = ?', [$uid, $nombre])) {
                    Db::ejecutar('INSERT INTO usuario_roles (usuario_id, rol_id, sucursal_id) SELECT ?, id, ? FROM roles WHERE nombre = ?', [$uid, $a['sucursal_id'], $nombre]);
                } else {
                    Db::ejecutar('UPDATE usuario_roles ur JOIN roles r ON r.id = ur.rol_id SET ur.activo = 1 WHERE ur.usuario_id = ? AND r.nombre = ?', [$uid, $nombre]);
                }
            }
            Db::ejecutar('UPDATE activaciones SET expira = NOW() WHERE usuario_id = ? AND usada IS NULL AND expira > NOW()', [$uid]);
            Db::insertar('INSERT INTO activaciones (usuario_id, codigo_hash, expira, creada_por) VALUES (?, ?, NOW() + INTERVAL ' . self::HORAS . ' HOUR, ?)',
                [$uid, password_hash($codigo, PASSWORD_DEFAULT), $req->ctx['usuario_id']]);
            Bitacora::alta($req, 'activaciones', $uid, ['acceso_app' => $login, 'roles' => implode(',', $roles), 'usuario_nuevo' => $nuevo ? 'si' : 'no'], (int) $a['sucursal_id']);
            return $uid;
        });
        $nombre = Db::uno('SELECT nombre FROM personas WHERE id = ?', [$pid])['nombre'];
        $mensaje = "Hola $nombre, ya tienes acceso a la app de Dojo OS.\nUsuario: $login\nCódigo de activación: $codigo (vence en " . self::HORAS . " horas)\nAbre la app, toca \"Activar mi cuenta\" y crea tu contraseña.";
        Respuesta::ok(['usuario_id' => $res, 'para' => $para, 'rol' => $rol, 'usuario' => $login, 'codigo' => $codigo,
            'expira' => date('Y-m-d H:i', time() + self::HORAS * 3600), 'telefono' => $tel, 'mensaje' => $mensaje], 201);
    }

    /** POST /api/app/activar {usuario, codigo, password} — pública: la persona crea su contraseña y entra */
    public function activar(Peticion $req): void
    {
        $d = $req->requeridos('usuario', 'codigo', 'password');
        $pass = (string) $d['password'];
        if (mb_strlen($pass) < 8) throw new ErrorApi('La contraseña debe tener al menos 8 caracteres', 422, ['campo' => 'password']);
        $uid = AuthControlador::buscarUsuario((string) $d['usuario']);
        $act = $uid ? Db::uno('SELECT id, codigo_hash, intentos FROM activaciones WHERE usuario_id = ? AND usada IS NULL AND expira > NOW() ORDER BY id DESC LIMIT 1', [$uid]) : null;
        if (!$act) throw new ErrorApi('No hay un código vigente para ese usuario. Pide uno nuevo en recepción.', 422);
        if ((int) $act['intentos'] >= self::MAX_INTENTOS) throw new ErrorApi('El código se bloqueó por intentos fallidos. Pide uno nuevo en recepción.', 423);
        if (!password_verify(preg_replace('/\D/', '', (string) $d['codigo']), $act['codigo_hash'])) {
            Db::ejecutar('UPDATE activaciones SET intentos = intentos + 1 WHERE id = ?', [$act['id']]);
            throw new ErrorApi('El código no es correcto (' . (self::MAX_INTENTOS - (int) $act['intentos'] - 1) . ' intentos más)', 422, ['campo' => 'codigo']);
        }
        Db::transaccion(function () use ($uid, $act, $pass) {
            Db::ejecutar('UPDATE usuarios SET password_hash = ?, activo = 1, intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id = ?', [password_hash($pass, PASSWORD_DEFAULT), $uid]);
            Db::ejecutar('UPDATE activaciones SET usada = NOW() WHERE id = ?', [$act['id']]);
            Db::ejecutar('UPDATE sesiones SET revocada = NOW() WHERE usuario_id = ? AND revocada IS NULL', [$uid]);   // nueva contraseña: cierra otras sesiones
        });
        $token = bin2hex(random_bytes(32));
        Db::insertar('INSERT INTO sesiones (usuario_id, usuario_rol_id, token_hash, ip) VALUES (?, NULL, ?, ?)', [$uid, hash('sha256', $token), $req->ip]);
        Respuesta::ok(['token' => $token]);
    }

    private function persona(string $tipo, int $pid, string $nombre, ?string $login, ?int $rid): array
    {
        $u = Db::uno('SELECT u.id, (SELECT MAX(s.ultima_actividad) FROM sesiones s WHERE s.usuario_id = u.id) AS ultimo,
                             (SELECT a.expira FROM activaciones a WHERE a.usuario_id = u.id AND a.usada IS NULL AND a.expira > NOW() ORDER BY a.id DESC LIMIT 1) AS codigo_vence,
                             (SELECT COUNT(*) FROM activaciones a WHERE a.usuario_id = u.id AND a.usada IS NOT NULL) AS activado,
                             (SELECT GROUP_CONCAT(r.nombre) FROM usuario_roles ur JOIN roles r ON r.id = ur.rol_id WHERE ur.usuario_id = u.id AND ur.activo = 1) AS roles
                      FROM usuarios u WHERE u.persona_id = ?', [$pid]);
        $staff = $u && preg_match('/super_admin|admin_sucursal|recepcion|instructor/', (string) $u['roles']);
        $estado = !$u || !str_contains((string) $u['roles'], $tipo) ? 'sin_acceso' : ($u['codigo_vence'] ? 'codigo_enviado' : ((int) $u['activado'] || $staff ? 'activo' : 'sin_acceso'));
        return ['tipo' => $tipo, 'persona_id' => $pid, 'responsable_id' => $rid, 'nombre' => $nombre, 'usuario' => $login,
                'estado' => $estado, 'codigo_vence' => $u['codigo_vence'] ?? null, 'ultimo_acceso' => $u['ultimo'] ?? null];
    }

    private function alumno(int $id, Peticion $req): array
    {
        $a = Db::uno('SELECT a.id, a.persona_id, a.matricula, a.sucursal_id, a.estado, CONCAT(p.nombre, " ", p.apellido_paterno) AS nombre
                      FROM alumnos a JOIN personas p ON p.id = a.persona_id WHERE a.id = ?', [$id]);
        if (!$a) throw new ErrorApi('Alumno no encontrado', 404);
        Permiso::exigirSucursal($req, (int) $a['sucursal_id']);
        return $a;
    }
}
