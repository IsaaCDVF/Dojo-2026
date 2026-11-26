<?php
declare(strict_types=1);
namespace Dojo\Modulos\Personas;

use Dojo\Modulos\Bitacora\Bitacora;
use Dojo\Nucleo\{Db, ErrorApi, Folios, Peticion, Respuesta};
use Dojo\Nucleo\Middleware\Permiso;

/**
 * 2.4 Personas: alumnos y responsables de pago.
 * Una persona es una sola fila en personas aunque sea alumno, responsable e instructor a la vez.
 */
final class AlumnoControlador
{
    private const CURP = '/^[A-Z][AEIOUX][A-Z]{2}\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])[HMX](AS|BC|BS|CC|CL|CM|CS|CH|DF|DG|GT|GR|HG|JC|MC|MN|MS|NT|NL|OC|PL|QT|QR|SP|SL|SR|TC|TS|TL|VZ|YN|ZS|NE)[B-DF-HJ-NP-TV-Z]{3}[A-Z\d]\d$/';

    /** GET /api/alumnos?buscar=&estado=activo — por nombre, matrícula, CURP o teléfono */
    public function buscar(Peticion $req): void
    {
        $w = ['1 = 1']; $p = [];
        if (($s = Permiso::sucursalDe($req)) !== null) { $w[] = 'a.sucursal_id = ?'; $p[] = $s; }
        elseif (!empty($req->query['sucursal_id'])) { $w[] = 'a.sucursal_id = ?'; $p[] = (int) $req->query['sucursal_id']; }
        if (!empty($req->query['estado'])) { $w[] = 'a.estado = ?'; $p[] = $req->query['estado']; }
        $q = trim((string) ($req->query['buscar'] ?? ''));
        if ($q !== '') {
            $like = '%' . str_replace(['%', '_'], ['\%', '\_'], $q) . '%';
            $w[] = '(CONCAT_WS(" ", pe.nombre, pe.apellido_paterno, pe.apellido_materno) LIKE ? OR a.matricula LIKE ? OR pe.curp LIKE ?
                     OR EXISTS (SELECT 1 FROM contactos c WHERE c.persona_id = pe.id AND c.valor LIKE ?))';
            array_push($p, $like, $like, $like, $like);
        }
        Respuesta::ok(Db::todos(
            'SELECT a.id, a.matricula, a.estado, a.fecha_alta, s.nombre AS sucursal, pe.nombre, pe.apellido_paterno, pe.apellido_materno,
                    pe.fecha_nacimiento, TIMESTAMPDIFF(YEAR, pe.fecha_nacimiento, CURDATE()) AS edad, (pe.foto IS NOT NULL) AS tiene_foto,
                    (SELECT c.valor FROM contactos c WHERE c.persona_id = pe.id AND c.tipo IN ("telefono","whatsapp") ORDER BY c.principal DESC LIMIT 1) AS telefono,
                    (SELECT GROUP_CONCAT(DISTINCT d.nombre ORDER BY d.nombre SEPARATOR ", ") FROM inscripciones i JOIN horarios h ON h.id = i.horario_id
                      JOIN disciplinas d ON d.id = h.disciplina_id WHERE i.alumno_id = a.id AND (i.fecha_fin IS NULL OR i.fecha_fin >= CURDATE())) AS disciplinas
             FROM alumnos a JOIN personas pe ON pe.id = a.persona_id JOIN sucursales s ON s.id = a.sucursal_id
             WHERE ' . implode(' AND ', $w) . ' ORDER BY pe.nombre, pe.apellido_paterno LIMIT 100', $p));
    }

    /** GET /api/alumnos/{id} — ficha completa */
    public function ver(Peticion $req): void
    {
        $a = Db::uno('SELECT a.id, a.matricula, a.estado, a.fecha_alta, a.codigo_qr, a.sucursal_id, s.nombre AS sucursal, a.persona_id,
                             pe.nombre, pe.apellido_paterno, pe.apellido_materno, pe.fecha_nacimiento, pe.sexo, pe.curp, (pe.foto IS NOT NULL) AS tiene_foto,
                             TIMESTAMPDIFF(YEAR, pe.fecha_nacimiento, CURDATE()) AS edad
                      FROM alumnos a JOIN personas pe ON pe.id = a.persona_id JOIN sucursales s ON s.id = a.sucursal_id WHERE a.id = ?', [$req->params['id']]);
        if (!$a) throw new ErrorApi('Alumno no encontrado', 404);
        Permiso::exigirSucursal($req, (int) $a['sucursal_id']);
        $a['contactos'] = Db::todos('SELECT id, tipo, valor, principal FROM contactos WHERE persona_id = ? ORDER BY principal DESC, id', [$a['persona_id']]);
        $a['responsables'] = Db::todos(
            'SELECT r.id, ar.parentesco, ar.vigente_desde, pe.nombre, pe.apellido_paterno, pe.apellido_materno, (r.persona_id = ?) AS es_el_mismo,
                    (SELECT c.valor FROM contactos c WHERE c.persona_id = pe.id AND c.tipo IN ("telefono","whatsapp") ORDER BY c.principal DESC LIMIT 1) AS telefono,
                    (SELECT c.valor FROM contactos c WHERE c.persona_id = pe.id AND c.tipo = "email" LIMIT 1) AS email,
                    (SELECT COUNT(*) FROM alumno_responsable x WHERE x.responsable_id = r.id AND x.vigente_hasta IS NULL) AS alumnos_a_cargo
             FROM alumno_responsable ar JOIN responsables_pago r ON r.id = ar.responsable_id JOIN personas pe ON pe.id = r.persona_id
             WHERE ar.alumno_id = ? AND ar.vigente_hasta IS NULL', [$a['persona_id'], $a['id']]);
        $a['inscripciones'] = Db::todos(
            'SELECT i.id, i.fecha_inicio, i.fecha_fin, h.id AS horario_id, d.id AS disciplina_id, d.nombre AS disciplina, h.dia_semana, h.nivel,
                    TIME_FORMAT(h.hora_inicio, "%H:%i") AS hora_inicio, TIME_FORMAT(h.hora_fin, "%H:%i") AS hora_fin, s.nombre AS sucursal,
                    CONCAT(p.nombre, " ", p.apellido_paterno) AS instructor
             FROM inscripciones i JOIN horarios h ON h.id = i.horario_id JOIN disciplinas d ON d.id = h.disciplina_id
             JOIN sucursales s ON s.id = h.sucursal_id JOIN instructores ins ON ins.id = h.instructor_id JOIN personas p ON p.id = ins.persona_id
             WHERE i.alumno_id = ? ORDER BY (i.fecha_fin IS NULL OR i.fecha_fin >= CURDATE()) DESC, i.fecha_inicio DESC', [$a['id']]);
        $a['grados'] = Db::todos(
            'SELECT ag.id, ag.fecha_obtencion, ag.origen, g.id AS grado_id, g.nombre, g.color_cinta, g.orden, d.nombre AS disciplina, d.id AS disciplina_id
             FROM alumno_grados ag JOIN grados g ON g.id = ag.grado_id JOIN disciplinas d ON d.id = g.disciplina_id
             WHERE ag.alumno_id = ? ORDER BY ag.fecha_obtencion DESC, ag.id DESC', [$a['id']]);
        Respuesta::ok($a);
    }

    /** GET /api/alumnos/{id}/foto */
    public function foto(Peticion $req): void
    {
        $a = Db::uno('SELECT a.sucursal_id, pe.foto FROM alumnos a JOIN personas pe ON pe.id = a.persona_id WHERE a.id = ?', [$req->params['id']]);
        if (!$a) throw new ErrorApi('Alumno no encontrado', 404);
        Permiso::exigirSucursal($req, (int) $a['sucursal_id']);
        Fotos::enviar($a['foto']);
    }

    /**
     * POST /api/alumnos
     * {nombre, apellido_paterno, apellido_materno?, fecha_nacimiento, sexo?, curp, foto (data URL),
     *  telefono?, email?, sucursal_id?, responsable: {id} | {el_mismo: true} | {nombre, apellido_paterno, apellido_materno?, telefono, email?, parentesco}}
     */
    public function crear(Peticion $req): void
    {
        $d = $req->requeridos('nombre', 'apellido_paterno', 'fecha_nacimiento', 'curp', 'foto');
        $c = $req->cuerpo;
        $sucursal = Permiso::sucursalDe($req) ?? (int) ($c['sucursal_id'] ?? 0);
        if (!$sucursal || !Db::uno('SELECT 1 FROM sucursales WHERE id = ? AND activa = 1', [$sucursal])) throw new ErrorApi('Elige la sucursal del alumno', 422);

        $curp = strtoupper(trim($d['curp']));
        if (!preg_match(self::CURP, $curp)) throw new ErrorApi('La CURP no tiene un formato válido', 422, ['campo' => 'curp']);
        if (Db::uno('SELECT 1 FROM personas WHERE curp = ?', [$curp])) throw new ErrorApi('Ya existe una persona con esa CURP', 409, ['campo' => 'curp']);
        $nac = \DateTime::createFromFormat('Y-m-d', $d['fecha_nacimiento']);
        if (!$nac || $nac->format('Y-m-d') !== $d['fecha_nacimiento'] || $nac > new \DateTime() || $nac < new \DateTime('-100 years')) {
            throw new ErrorApi('Fecha de nacimiento no válida', 422, ['campo' => 'fecha_nacimiento']);
        }
        $edad = $nac->diff(new \DateTime())->y;

        // Fecha de alta distinta de hoy: solo al migrar alumnos que ya venían (permiso alumnos.importar).
        // De ella sale el día fijo de cobro de la mensualidad (RN-34).
        $alta = date('Y-m-d');
        if (!empty($c['fecha_alta']) && $c['fecha_alta'] !== $alta) {
            Permiso::exigir($req, 'alumnos.importar');
            $fa = \DateTime::createFromFormat('Y-m-d', (string) $c['fecha_alta']);
            if (!$fa || $fa->format('Y-m-d') !== $c['fecha_alta'] || $fa > new \DateTime() || $fa < new \DateTime('-10 years')) {
                throw new ErrorApi('Fecha de alta no válida', 422, ['campo' => 'fecha_alta']);
            }
            $alta = $fa->format('Y-m-d');
        }
        $sexo = in_array($c['sexo'] ?? null, ['F', 'M', 'X'], true) ? $c['sexo'] : null;
        $tel = $this->telefono($c['telefono'] ?? null);
        $email = $this->email($c['email'] ?? null);

        $r = $c['responsable'] ?? null;
        if (!is_array($r)) throw new ErrorApi('Indica quién paga: un responsable existente, uno nuevo o el mismo alumno', 422, ['campo' => 'responsable']);
        if (!empty($r['el_mismo']) && $edad < 18) throw new ErrorApi('Un menor de edad necesita un responsable de pago adulto', 422, ['campo' => 'responsable']);
        if (!empty($r['id']) && !Db::uno('SELECT 1 FROM responsables_pago WHERE id = ?', [(int) $r['id']])) throw new ErrorApi('Responsable no encontrado', 404);
        if (empty($r['id']) && empty($r['el_mismo'])) {
            foreach (['nombre', 'apellido_paterno', 'telefono', 'parentesco'] as $k) {
                if (empty(trim((string) ($r[$k] ?? '')))) throw new ErrorApi('Faltan datos del responsable de pago', 422, ['faltan' => ['responsable.' . $k]]);
            }
            $r['telefono'] = $this->telefono($r['telefono']);
            $r['email'] = $this->email($r['email'] ?? null);
        }
        $foto = Fotos::guardar($d['foto']);

        $res = Db::transaccion(function () use ($req, $d, $c, $curp, $sexo, $tel, $email, $sucursal, $foto, $r, $alta) {
            $pid = Db::insertar('INSERT INTO personas (nombre, apellido_paterno, apellido_materno, fecha_nacimiento, sexo, curp, foto) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [trim($d['nombre']), trim($d['apellido_paterno']), trim((string) ($c['apellido_materno'] ?? '')) ?: null, $d['fecha_nacimiento'], $sexo, $curp, $foto]);
            if ($tel) Db::ejecutar('INSERT INTO contactos (persona_id, tipo, valor, principal) VALUES (?, "telefono", ?, 1)', [$pid, $tel]);
            if ($email) Db::ejecutar('INSERT INTO contactos (persona_id, tipo, valor, principal) VALUES (?, "email", ?, 0)', [$pid, $email]);
            $matricula = Folios::siguiente($sucursal, 'matricula');
            $aid = Db::insertar('INSERT INTO alumnos (matricula, persona_id, sucursal_id, fecha_alta, codigo_qr) VALUES (?, ?, ?, ?, ?)',
                [$matricula, $pid, $sucursal, $alta, bin2hex(random_bytes(16))]);

            if (!empty($r['id'])) { $rid = (int) $r['id']; $parentesco = trim((string) ($r['parentesco'] ?? 'responsable')) ?: 'responsable'; }
            elseif (!empty($r['el_mismo'])) { $rid = Db::insertar('INSERT INTO responsables_pago (persona_id) VALUES (?)', [$pid]); $parentesco = 'él mismo'; }
            else {
                $rp = Db::insertar('INSERT INTO personas (nombre, apellido_paterno, apellido_materno, fecha_nacimiento) VALUES (?, ?, ?, ?)',
                    [trim($r['nombre']), trim($r['apellido_paterno']), trim((string) ($r['apellido_materno'] ?? '')) ?: null, $r['fecha_nacimiento'] ?? '1900-01-01']);
                Db::ejecutar('INSERT INTO contactos (persona_id, tipo, valor, principal) VALUES (?, "telefono", ?, 1)', [$rp, $r['telefono']]);
                if ($r['email']) Db::ejecutar('INSERT INTO contactos (persona_id, tipo, valor, principal) VALUES (?, "email", ?, 0)', [$rp, $r['email']]);
                $rid = Db::insertar('INSERT INTO responsables_pago (persona_id) VALUES (?)', [$rp]);
                $parentesco = trim($r['parentesco']);
                Bitacora::alta($req, 'responsables_pago', $rid, ['nombre' => $r['nombre'] . ' ' . $r['apellido_paterno']], $sucursal);
            }
            Db::ejecutar('INSERT INTO alumno_responsable (alumno_id, responsable_id, parentesco, vigente_desde) VALUES (?, ?, ?, CURDATE())', [$aid, $rid, $parentesco]);
            Bitacora::alta($req, 'alumnos', $aid, ['matricula' => $matricula, 'nombre' => $d['nombre'] . ' ' . $d['apellido_paterno'], 'curp' => $curp], $sucursal);
            return ['id' => $aid, 'matricula' => $matricula, 'responsable_id' => $rid];
        });
        Respuesta::ok($res, 201);
    }

    /** PUT /api/alumnos/{id}/estado  {estado: activo|baja|suspendido, motivo?} */
    public function cambiarEstado(Peticion $req): void
    {
        $estado = $req->requeridos('estado')['estado'];
        if (!in_array($estado, ['activo', 'baja', 'suspendido'], true)) throw new ErrorApi('Estado no válido', 422);
        $a = Db::uno('SELECT id, sucursal_id, estado FROM alumnos WHERE id = ?', [$req->params['id']]);
        if (!$a) throw new ErrorApi('Alumno no encontrado', 404);
        Permiso::exigirSucursal($req, (int) $a['sucursal_id']);
        if ($a['estado'] === $estado) throw new ErrorApi("El alumno ya está en estado $estado", 409);
        Db::transaccion(function () use ($req, $a, $estado) {
            Db::ejecutar('UPDATE alumnos SET estado = ? WHERE id = ?', [$estado, $a['id']]);
            if ($estado === 'baja') Db::ejecutar('UPDATE inscripciones SET fecha_fin = CURDATE() WHERE alumno_id = ? AND (fecha_fin IS NULL OR fecha_fin > CURDATE())', [$a['id']]);
            Bitacora::cambio($req, 'alumnos', (int) $a['id'], ['estado' => $a['estado']], ['estado' => $estado], (int) $a['sucursal_id']);
        });
        Respuesta::ok(['id' => (int) $a['id'], 'estado' => $estado]);
    }

    /** GET /api/responsables?buscar= */
    public function responsables(Peticion $req): void
    {
        $q = trim((string) ($req->query['buscar'] ?? ''));
        if (mb_strlen($q) < 2) { Respuesta::ok([]); return; }
        $like = '%' . str_replace(['%', '_'], ['\%', '\_'], $q) . '%';
        Respuesta::ok(Db::todos(
            'SELECT r.id, pe.nombre, pe.apellido_paterno, pe.apellido_materno,
                    (SELECT c.valor FROM contactos c WHERE c.persona_id = pe.id AND c.tipo IN ("telefono","whatsapp") ORDER BY c.principal DESC LIMIT 1) AS telefono,
                    (SELECT COUNT(*) FROM alumno_responsable x WHERE x.responsable_id = r.id AND x.vigente_hasta IS NULL) AS alumnos_a_cargo
             FROM responsables_pago r JOIN personas pe ON pe.id = r.persona_id
             WHERE CONCAT_WS(" ", pe.nombre, pe.apellido_paterno, pe.apellido_materno) LIKE ?
                OR EXISTS (SELECT 1 FROM contactos c WHERE c.persona_id = pe.id AND c.valor LIKE ?)
             ORDER BY pe.nombre LIMIT 20', [$like, $like]));
    }

    private function telefono(?string $t): ?string
    {
        if ($t === null || trim($t) === '') return null;
        $n = preg_replace('/\D/', '', $t);
        if (strlen($n) !== 10) throw new ErrorApi('El teléfono debe tener 10 dígitos', 422, ['campo' => 'telefono']);
        return $n;
    }

    private function email(?string $e): ?string
    {
        if ($e === null || trim($e) === '') return null;
        if (!filter_var(trim($e), FILTER_VALIDATE_EMAIL)) throw new ErrorApi('El correo no es válido', 422, ['campo' => 'email']);
        return strtolower(trim($e));
    }
}
