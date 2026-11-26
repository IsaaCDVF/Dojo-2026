<?php
declare(strict_types=1);
namespace Dojo\Modulos\App;

use Dojo\Modulos\Bitacora\Bitacora;
use Dojo\Modulos\Personal\PersonalControlador;
use Dojo\Nucleo\{Db, ErrorApi, Peticion, Respuesta};

/**
 * Mi cuenta (app): la persona que entró actualiza sus propios datos de contacto sin ir a recepción.
 * - Teléfono (WhatsApp), correo y domicilio. Nombre, fecha de nacimiento y CURP los corrige recepción.
 * - Teléfono y correo sirven para entrar (el responsable entra con su teléfono): para cambiarlos se pide su contraseña.
 * - Todo queda en la bitácora con la sucursal del alumno, así recepción ve quién cambió qué.
 */
final class CuentaControlador
{
    private const DOMICILIO = ['calle', 'numero', 'colonia', 'cp', 'municipio', 'estado'];

    /** GET /api/app/cuenta */
    public function ver(Peticion $req): void
    {
        Respuesta::ok($this->datos((int) $req->ctx['usuario_id']));
    }

    /** PUT /api/app/cuenta {telefono?, email?, domicilio?:{calle, numero?, colonia?, cp, municipio, estado} | null, password?} */
    public function guardar(Peticion $req): void
    {
        $uid = (int) $req->ctx['usuario_id'];
        $d = $this->datos($uid);
        $pid = (int) $d['persona_id'];
        $c = $req->cuerpo;
        $cambios = [];

        if (array_key_exists('telefono', $c)) {
            $tel = PersonalControlador::telefono($c['telefono']);
            if ($tel !== $d['telefono']) {
                if (!$tel && $d['es_responsable']) throw new ErrorApi('Tu teléfono es tu usuario para entrar: no lo puedes dejar vacío', 422, ['campo' => 'telefono']);
                if ($tel && $d['es_responsable'] && Db::uno('SELECT 1 FROM contactos c JOIN usuarios u ON u.persona_id = c.persona_id JOIN responsables_pago r ON r.persona_id = c.persona_id
                                                             WHERE c.tipo IN ("telefono","whatsapp") AND c.valor = ? AND c.persona_id <> ?', [$tel, $pid])) {
                    throw new ErrorApi('Ese teléfono ya es el usuario de otra persona en la app', 409, ['campo' => 'telefono']);
                }
                $cambios['telefono'] = $tel;
            }
        }
        if (array_key_exists('email', $c)) {
            $mail = trim((string) $c['email']) === '' ? null : PersonalControlador::email($c['email']);
            if ($mail !== $d['email']) {
                if ($mail && Db::uno('SELECT 1 FROM usuarios WHERE email = ? AND id <> ?', [$mail, $uid])) throw new ErrorApi('Ese correo ya lo usa otra cuenta', 409, ['campo' => 'email']);
                $cambios['email'] = $mail;
            }
        }
        $dom = false;
        if (array_key_exists('domicilio', $c)) {
            $dom = $c['domicilio'] === null ? null : $this->domicilio((array) $c['domicilio']);
            if ($dom === $d['domicilio']) $dom = false;
        }
        if (!$cambios && $dom === false) throw new ErrorApi('Nada que cambiar', 422);

        // Lo que sirve para entrar se cambia solo con la contraseña (por si alguien agarra el celular con la sesión abierta)
        if ($cambios) {
            $hash = Db::uno('SELECT password_hash FROM usuarios WHERE id = ?', [$uid])['password_hash'];
            if (!password_verify((string) ($c['password'] ?? ''), $hash)) throw new ErrorApi('Escribe tu contraseña para cambiar tu teléfono o tu correo', 422, ['campo' => 'password']);
        }

        Db::transaccion(function () use ($req, $uid, $pid, $d, $cambios, $dom) {
            if (array_key_exists('telefono', $cambios)) {
                Db::ejecutar('DELETE FROM contactos WHERE persona_id = ? AND tipo IN ("telefono","whatsapp")', [$pid]);
                if ($cambios['telefono']) Db::insertar('INSERT INTO contactos (persona_id, tipo, valor, principal) VALUES (?, "whatsapp", ?, 1)', [$pid, $cambios['telefono']]);
                Bitacora::cambio($req, 'contactos', $pid, ['telefono' => $d['telefono']], ['telefono' => $cambios['telefono']]);
            }
            if (array_key_exists('email', $cambios)) {
                Db::ejecutar('DELETE FROM contactos WHERE persona_id = ? AND tipo = "email"', [$pid]);
                if ($cambios['email']) {
                    Db::insertar('INSERT INTO contactos (persona_id, tipo, valor, principal) VALUES (?, "email", ?, 0)', [$pid, $cambios['email']]);
                    Db::ejecutar('UPDATE usuarios SET email = ? WHERE id = ?', [$cambios['email'], $uid]);   // también entra con él
                } else {
                    Db::ejecutar('UPDATE usuarios SET email = ? WHERE id = ?', ["app-$pid@dojoos.local", $uid]);
                }
                Bitacora::cambio($req, 'contactos', $pid, ['email' => $d['email']], ['email' => $cambios['email']]);
            }
            if ($dom !== false) {
                $id = Db::uno('SELECT id FROM domicilios WHERE persona_id = ? ORDER BY id DESC LIMIT 1', [$pid])['id'] ?? null;
                if ($dom === null) { if ($id) Db::ejecutar('DELETE FROM domicilios WHERE id = ?', [$id]); }
                elseif ($id) Db::ejecutar('UPDATE domicilios SET calle = ?, numero = ?, colonia = ?, cp = ?, municipio = ?, estado = ? WHERE id = ?', [...array_values($dom), $id]);
                else Db::insertar('INSERT INTO domicilios (persona_id, calle, numero, colonia, cp, municipio, estado) VALUES (?, ?, ?, ?, ?, ?, ?)', [$pid, ...array_values($dom)]);
                $antes = ['domicilio' => self::texto($d['domicilio'])];
                Bitacora::cambio($req, 'domicilios', $pid, $antes, ['domicilio' => self::texto($dom)]);
            }
        });
        Respuesta::ok($this->datos($uid));
    }

    private function datos(int $uid): array
    {
        $u = Db::uno('SELECT u.id, u.persona_id, u.email usuario_email, pe.nombre, pe.apellido_paterno, pe.apellido_materno, pe.fecha_nacimiento, pe.curp,
                             (SELECT c.valor FROM contactos c WHERE c.persona_id = pe.id AND c.tipo IN ("telefono","whatsapp") ORDER BY c.principal DESC LIMIT 1) telefono,
                             (SELECT c.valor FROM contactos c WHERE c.persona_id = pe.id AND c.tipo = "email" LIMIT 1) email,
                             (SELECT a.matricula FROM alumnos a WHERE a.persona_id = pe.id AND a.estado <> "baja" LIMIT 1) matricula,
                             EXISTS(SELECT 1 FROM responsables_pago r WHERE r.persona_id = pe.id) es_responsable
                      FROM usuarios u JOIN personas pe ON pe.id = u.persona_id WHERE u.id = ?', [$uid]);
        if (!$u) throw new ErrorApi('Cuenta no encontrada', 404);
        $dom = Db::uno('SELECT calle, numero, colonia, cp, municipio, estado FROM domicilios WHERE persona_id = ? ORDER BY id DESC LIMIT 1', [$u['persona_id']]);
        // El correo que se muestra: el de contacto, o el de la cuenta si es real (no el interno app-N@dojoos.local)
        $email = $u['email'] ?? (str_ends_with((string) $u['usuario_email'], '@dojoos.local') ? null : $u['usuario_email']);
        return [
            'persona_id' => (int) $u['persona_id'], 'nombre' => $u['nombre'], 'apellido_paterno' => $u['apellido_paterno'], 'apellido_materno' => $u['apellido_materno'],
            'fecha_nacimiento' => $u['fecha_nacimiento'], 'curp' => $u['curp'], 'telefono' => $u['telefono'], 'email' => $email,
            'domicilio' => $dom ?: null, 'matricula' => $u['matricula'], 'es_responsable' => (bool) $u['es_responsable'],
            // Con qué entra a la app: el alumno con su matrícula, el responsable con su teléfono, y cualquiera con su correo
            'entra_con' => array_values(array_filter([$u['matricula'], $u['es_responsable'] ? $u['telefono'] : null, $email])),
        ];
    }

    private function domicilio(array $x): array
    {
        $d = [];
        foreach (self::DOMICILIO as $k) { $v = trim((string) ($x[$k] ?? '')); $d[$k] = $v === '' ? null : $v; }
        foreach (['calle' => 'la calle', 'cp' => 'el código postal', 'municipio' => 'el municipio', 'estado' => 'el estado'] as $k => $n) {
            if ($d[$k] === null) throw new ErrorApi("Falta $n", 422, ['campo' => "domicilio.$k"]);
        }
        if (!preg_match('/^\d{5}$/', $d['cp'])) throw new ErrorApi('El código postal debe tener 5 dígitos', 422, ['campo' => 'domicilio.cp']);
        foreach (['calle' => 100, 'numero' => 20, 'colonia' => 80, 'municipio' => 80, 'estado' => 60] as $k => $max) if ($d[$k] !== null) $d[$k] = mb_substr($d[$k], 0, $max);
        return $d;
    }

    private static function texto(?array $d): ?string
    {
        return $d ? implode(', ', array_filter([trim(($d['calle'] ?? '') . ' ' . ($d['numero'] ?? '')), $d['colonia'] ?? null, $d['cp'] ?? null, $d['municipio'] ?? null, $d['estado'] ?? null])) : null;
    }
}
