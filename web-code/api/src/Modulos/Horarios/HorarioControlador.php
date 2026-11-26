<?php
declare(strict_types=1);
namespace Dojo\Modulos\Horarios;

use Dojo\Modulos\Bitacora\Bitacora;
use Dojo\Nucleo\{Db, ErrorApi, Peticion, Respuesta};
use Dojo\Nucleo\Middleware\Permiso;

/**
 * 2.1 Horarios: clases por sucursal, disciplina, día, nivel e instructor.
 * Un horario tiene un rango de grados (grado_desde..grado_hasta); la tableta lo usa para
 * decir "No perteneces a esta clase" y la inscripción para avisar si el grado no entra.
 */
final class HorarioControlador
{
    private const SELECT = 'SELECT h.id, h.sucursal_id, s.nombre AS sucursal, h.disciplina_id, d.nombre AS disciplina,
            h.instructor_id, CONCAT(p.nombre, " ", p.apellido_paterno) AS instructor,
            h.dia_semana, TIME_FORMAT(h.hora_inicio, "%H:%i") AS hora_inicio, TIME_FORMAT(h.hora_fin, "%H:%i") AS hora_fin,
            h.cupo, h.nivel, h.grado_desde_id, gd.nombre AS grado_desde, h.grado_hasta_id, gh.nombre AS grado_hasta, h.activo,
            (SELECT COUNT(*) FROM inscripciones i JOIN alumnos a ON a.id = i.alumno_id
              WHERE i.horario_id = h.id AND (i.fecha_fin IS NULL OR i.fecha_fin >= CURDATE()) AND a.estado = "activo") AS inscritos
        FROM horarios h
        JOIN sucursales s ON s.id = h.sucursal_id
        JOIN disciplinas d ON d.id = h.disciplina_id
        JOIN instructores ins ON ins.id = h.instructor_id JOIN personas p ON p.id = ins.persona_id
        LEFT JOIN grados gd ON gd.id = h.grado_desde_id
        LEFT JOIN grados gh ON gh.id = h.grado_hasta_id';

    /** GET /api/horarios?sucursal_id=&disciplina_id=&dia=&inactivos=1 */
    public function listar(Peticion $req): void
    {
        $w = []; $p = [];
        $s = Permiso::sucursalDe($req) ?? (isset($req->query['sucursal_id']) && $req->query['sucursal_id'] !== '' ? (int) $req->query['sucursal_id'] : null);
        if ($s !== null) { $w[] = 'h.sucursal_id = ?'; $p[] = $s; }
        if (!empty($req->query['disciplina_id'])) { $w[] = 'h.disciplina_id = ?'; $p[] = (int) $req->query['disciplina_id']; }
        if (!empty($req->query['dia'])) { $w[] = 'h.dia_semana = ?'; $p[] = (int) $req->query['dia']; }
        if (empty($req->query['inactivos'])) $w[] = 'h.activo = 1';
        $sql = self::SELECT . ($w ? ' WHERE ' . implode(' AND ', $w) : '') . ' ORDER BY h.dia_semana, h.hora_inicio, d.nombre';
        Respuesta::ok(Db::todos($sql, $p));
    }

    /** GET /api/horarios/{id} — con la lista de alumnos inscritos */
    public function ver(Peticion $req): void
    {
        $h = Db::uno(self::SELECT . ' WHERE h.id = ?', [$req->params['id']]);
        if (!$h) throw new ErrorApi('Horario no encontrado', 404);
        Permiso::exigirSucursal($req, (int) $h['sucursal_id']);
        $h['alumnos'] = Db::todos(
            'SELECT a.id, a.matricula, CONCAT(p.nombre, " ", p.apellido_paterno, IFNULL(CONCAT(" ", p.apellido_materno), "")) AS nombre, i.fecha_inicio,
                    (SELECT g.nombre FROM alumno_grados ag JOIN grados g ON g.id = ag.grado_id
                      WHERE ag.alumno_id = a.id AND g.disciplina_id = ? ORDER BY ag.fecha_obtencion DESC, ag.id DESC LIMIT 1) AS grado
             FROM inscripciones i JOIN alumnos a ON a.id = i.alumno_id JOIN personas p ON p.id = a.persona_id
             WHERE i.horario_id = ? AND (i.fecha_fin IS NULL OR i.fecha_fin >= CURDATE()) AND a.estado = "activo"
             ORDER BY p.nombre', [$h['disciplina_id'], $h['id']]);
        Respuesta::ok($h);
    }

    /** POST /api/horarios */
    public function crear(Peticion $req): void
    {
        $d = $req->requeridos('disciplina_id', 'instructor_id', 'dia_semana', 'hora_inicio', 'hora_fin');
        $c = $req->cuerpo;
        $sucursal = Permiso::sucursalDe($req) ?? (int) ($c['sucursal_id'] ?? 0);
        if (!$sucursal || !Db::uno('SELECT 1 FROM sucursales WHERE id = ? AND activa = 1', [$sucursal])) throw new ErrorApi('Elige una sucursal activa', 422);
        $dia = (int) $d['dia_semana'];
        if ($dia < 1 || $dia > 7) throw new ErrorApi('El día debe ser de 1 (lunes) a 7 (domingo)', 422);
        $ini = $this->hora($d['hora_inicio']); $fin = $this->hora($d['hora_fin']);
        if ($fin <= $ini) throw new ErrorApi('La hora de fin debe ser después de la de inicio', 422);
        $disc = (int) $d['disciplina_id'];
        if (!Db::uno('SELECT 1 FROM disciplinas WHERE id = ? AND activa = 1', [$disc])) throw new ErrorApi('Disciplina no encontrada o inactiva', 404);
        $inst = (int) $d['instructor_id'];
        if (!Db::uno('SELECT 1 FROM instructores WHERE id = ?', [$inst])) throw new ErrorApi('Instructor no encontrado', 404);

        $desde = !empty($c['grado_desde_id']) ? (int) $c['grado_desde_id'] : null;
        $hasta = !empty($c['grado_hasta_id']) ? (int) $c['grado_hasta_id'] : null;
        $orden = fn($g) => $g ? Db::uno('SELECT orden FROM grados WHERE id = ? AND disciplina_id = ?', [$g, $disc]) : ['orden' => null];
        $od = $orden($desde); $oh = $orden($hasta);
        if (!$od || !$oh) throw new ErrorApi('Los grados deben ser de la misma disciplina', 422);
        if ($desde && $hasta && $od['orden'] > $oh['orden']) throw new ErrorApi('El grado inicial del rango va después del final', 422);
        $cupo = isset($c['cupo']) && $c['cupo'] !== '' ? (int) $c['cupo'] : null;
        if ($cupo !== null && $cupo < 1) throw new ErrorApi('El cupo debe ser 1 o más', 422);

        $choque = Db::uno('SELECT h.id, s.nombre FROM horarios h JOIN sucursales s ON s.id = h.sucursal_id
                           WHERE h.instructor_id = ? AND h.dia_semana = ? AND h.activo = 1 AND h.hora_inicio < ? AND h.hora_fin > ?',
            [$inst, $dia, $fin, $ini]);
        if ($choque) throw new ErrorApi("El instructor ya tiene clase a esa hora en {$choque['nombre']}", 409);

        $nivel = isset($c['nivel']) && trim($c['nivel']) !== '' ? trim($c['nivel']) : null;
        $id = Db::transaccion(function () use ($req, $sucursal, $disc, $inst, $dia, $ini, $fin, $cupo, $nivel, $desde, $hasta) {
            $id = Db::insertar('INSERT INTO horarios (sucursal_id, disciplina_id, instructor_id, dia_semana, hora_inicio, hora_fin, cupo, nivel, grado_desde_id, grado_hasta_id)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [$sucursal, $disc, $inst, $dia, $ini, $fin, $cupo, $nivel, $desde, $hasta]);
            Bitacora::alta($req, 'horarios', $id, compact('disc', 'inst', 'dia', 'ini', 'fin', 'cupo', 'nivel'), $sucursal);
            return $id;
        });
        Respuesta::ok(Db::uno(self::SELECT . ' WHERE h.id = ?', [$id]), 201);
    }

    /** PUT /api/horarios/{id}/desactivar — no se borra: las asistencias lo siguen usando */
    public function desactivar(Peticion $req): void
    {
        $h = Db::uno('SELECT id, sucursal_id, activo FROM horarios WHERE id = ?', [$req->params['id']]);
        if (!$h) throw new ErrorApi('Horario no encontrado', 404);
        Permiso::exigirSucursal($req, (int) $h['sucursal_id']);
        $activos = (int) Db::uno('SELECT COUNT(*) n FROM inscripciones WHERE horario_id = ? AND (fecha_fin IS NULL OR fecha_fin >= CURDATE())', [$h['id']])['n'];
        if ($activos && empty($req->cuerpo['forzar'])) {
            throw new ErrorApi("Hay $activos alumnos inscritos en este horario; cámbialos de horario antes de desactivarlo", 409, ['inscritos' => $activos]);
        }
        Db::transaccion(function () use ($req, $h) {
            Db::ejecutar('UPDATE horarios SET activo = 0 WHERE id = ?', [$h['id']]);
            Bitacora::cambio($req, 'horarios', (int) $h['id'], ['activo' => $h['activo']], ['activo' => 0], (int) $h['sucursal_id']);
        });
        Respuesta::ok(['id' => (int) $h['id'], 'activo' => false]);
    }

    /** GET /api/instructores?sucursal_id= — instructores con rol en esa sucursal (o todos) */
    public function instructores(Peticion $req): void
    {
        $s = Permiso::sucursalDe($req) ?? (!empty($req->query['sucursal_id']) ? (int) $req->query['sucursal_id'] : null);
        $sql = 'SELECT DISTINCT ins.id, CONCAT(p.nombre, " ", p.apellido_paterno) AS nombre
                FROM instructores ins JOIN personas p ON p.id = ins.persona_id';
        $par = [];
        if ($s !== null) {
            $sql .= ' JOIN usuarios u ON u.persona_id = p.id AND u.activo = 1 JOIN usuario_roles ur ON ur.usuario_id = u.id AND ur.activo = 1
                      JOIN roles r ON r.id = ur.rol_id AND r.nombre = "instructor" WHERE ur.sucursal_id = ?';
            $par[] = $s;
        }
        Respuesta::ok(Db::todos($sql . ' ORDER BY nombre', $par));
    }

    private function hora(string $h): string
    {
        if (!preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', substr($h, 0, 5))) throw new ErrorApi("Hora no válida: $h (usa HH:MM)", 422);
        return substr($h, 0, 5) . ':00';
    }
}
