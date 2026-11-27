<?php
declare(strict_types=1);
namespace Dojo\Modulos\Catalogos;

use Dojo\Modulos\Bitacora\Bitacora;
use Dojo\Modulos\Personal\PersonalControlador;
use Dojo\Nucleo\{Db, ErrorApi, Peticion, Respuesta};
use Dojo\Nucleo\Middleware\Permiso;

/**
 * Sucursales. Una sucursal nueva se da de alta completa en un solo paso (todo o nada):
 * clave, nombre, teléfono, domicilio, disciplinas que se dan ahí y su encargado (admin de sucursal),
 * que puede ser alguien del personal o una persona nueva (se le genera contraseña temporal).
 */
final class SucursalControlador
{
    private const DOMICILIO = ['calle', 'numero', 'colonia', 'cp', 'municipio', 'estado'];

    public function listar(Peticion $req): void
    {
        $s = Permiso::sucursalDe($req);
        $sql = 'SELECT s.id, s.clave, s.nombre, s.telefono, s.activa, d.municipio, d.estado,
                       (SELECT COUNT(*) FROM sucursal_disciplinas sd WHERE sd.sucursal_id = s.id) disciplinas,
                       (SELECT GROUP_CONCAT(CONCAT(pe.nombre, " ", pe.apellido_paterno) ORDER BY pe.nombre SEPARATOR ", ")
                          FROM usuario_roles ur JOIN roles r ON r.id = ur.rol_id AND r.nombre = "admin_sucursal"
                          JOIN usuarios u ON u.id = ur.usuario_id AND u.activo = 1 JOIN personas pe ON pe.id = u.persona_id
                         WHERE ur.sucursal_id = s.id AND ur.activo = 1) encargado
                FROM sucursales s LEFT JOIN domicilios d ON d.id = s.domicilio_id';
        Respuesta::ok($s === null ? Db::todos("$sql ORDER BY s.nombre") : Db::todos("$sql WHERE s.id = ?", [$s]));
    }

    /** GET /api/sucursales/{id} — con domicilio, disciplinas y personal */
    public function ver(Peticion $req): void
    {
        $id = (int) $req->params['id'];
        Permiso::exigirSucursal($req, $id);
        Respuesta::ok($this->detalle($id));
    }

    /**
     * POST /api/sucursales
     * {clave, nombre, telefono?, domicilio?:{calle, numero?, colonia?, cp, municipio, estado}, disciplinas?:[ids],
     *  encargado?: {usuario_id} | {nuevo: {nombre, apellido_paterno, apellido_materno?, fecha_nacimiento, email, telefono?}}}
     * El panel pide todo; la API acepta solo clave y nombre para no romper integraciones viejas.
     */
    public function crear(Peticion $req): void
    {
        $d = $req->requeridos('clave', 'nombre');
        $d['clave'] = strtoupper(trim((string) $d['clave']));
        $d['nombre'] = trim((string) $d['nombre']);
        if (!preg_match('/^[A-Z]{4}$/', $d['clave'])) throw new ErrorApi('La clave debe tener 4 letras', 422, ['campo' => 'clave']);
        if (mb_strlen($d['nombre']) > 80) throw new ErrorApi('El nombre es muy largo (máximo 80)', 422, ['campo' => 'nombre']);
        if (Db::uno('SELECT 1 FROM sucursales WHERE clave = ? OR nombre = ?', [$d['clave'], $d['nombre']])) {
            throw new ErrorApi('Ya existe una sucursal con esa clave o nombre', 409);
        }
        $c = $req->cuerpo;
        $tel = PersonalControlador::telefono($c['telefono'] ?? null);
        $dom = isset($c['domicilio']) && is_array($c['domicilio']) ? $this->domicilio($c['domicilio']) : null;
        $disc = $this->disciplinas($c['disciplinas'] ?? []);
        $enc = $c['encargado'] ?? null;
        if ($enc !== null && (!is_array($enc) || (empty($enc['usuario_id']) && empty($enc['nuevo'])))) {
            throw new ErrorApi('Elige al encargado o captura sus datos', 422, ['campo' => 'encargado']);
        }

        $res = Db::transaccion(function () use ($req, $d, $tel, $dom, $disc, $enc) {
            $domId = $dom ? Db::insertar('INSERT INTO domicilios (persona_id, calle, numero, colonia, cp, municipio, estado) VALUES (NULL, ?, ?, ?, ?, ?, ?)',
                [$dom['calle'], $dom['numero'], $dom['colonia'], $dom['cp'], $dom['municipio'], $dom['estado']]) : null;
            $id = Db::insertar('INSERT INTO sucursales (clave, nombre, telefono, domicilio_id) VALUES (?, ?, ?, ?)', [$d['clave'], $d['nombre'], $tel, $domId]);
            Bitacora::alta($req, 'sucursales', $id, $d + ['telefono' => $tel], $id);
            foreach ($disc as $di) Db::insertar('INSERT INTO sucursal_disciplinas (sucursal_id, disciplina_id) VALUES (?, ?)', [$id, $di]);
            if ($disc) Bitacora::alta($req, 'sucursal_disciplinas', $id, ['disciplinas' => implode(',', $disc)], $id);

            $acceso = null;
            if ($enc !== null) {
                $per = new PersonalControlador();
                $roles = $per->rolesPedidos($req, [['rol' => 'admin_sucursal', 'sucursal_id' => $id]], $id);
                if (!empty($enc['usuario_id'])) {
                    $uid = (int) $enc['usuario_id'];
                    $u = Db::uno('SELECT u.id, u.persona_id, u.activo FROM usuarios u WHERE u.id = ?', [$uid]);
                    if (!$u || !$u['activo']) throw new ErrorApi('Esa persona no existe o está desactivada', 404, ['campo' => 'encargado']);
                    $ur = Db::insertar('INSERT INTO usuario_roles (usuario_id, rol_id, sucursal_id) VALUES (?, ?, ?)', [$uid, $roles[0]['rol_id'], $id]);
                    Bitacora::alta($req, 'usuario_roles', $ur, ['usuario_id' => $uid, 'rol' => 'admin_sucursal', 'sucursal_id' => $id], $id);
                } else {
                    $acceso = PersonalControlador::darDeAlta($req, (array) $enc['nuevo'], $roles);
                }
            }
            return ['id' => $id, 'acceso' => $acceso];
        });
        Respuesta::ok(['id' => $res['id']] + $d + ['encargado_nuevo' => $res['acceso'], 'sucursal' => $this->detalle($res['id'])], 201);
    }

    /** PUT /api/sucursales/{id} {nombre?, activa?, telefono?, domicilio?, disciplinas?} — la clave no cambia (está en matrículas y recibos) */
    public function editar(Peticion $req): void
    {
        $id = (int) $req->params['id'];
        $antes = Db::uno('SELECT nombre, activa, telefono, domicilio_id FROM sucursales WHERE id = ?', [$id]);
        if (!$antes) throw new ErrorApi('Sucursal no encontrada', 404);
        $c = $req->cuerpo;
        $nuevo = array_intersect_key($c, ['nombre' => 1, 'activa' => 1]);
        if (isset($nuevo['activa'])) $nuevo['activa'] = (int) (bool) $nuevo['activa'];
        if (isset($nuevo['nombre'])) {
            $nuevo['nombre'] = trim((string) $nuevo['nombre']);
            if ($nuevo['nombre'] === '') throw new ErrorApi('El nombre no puede quedar vacío', 422, ['campo' => 'nombre']);
            if (Db::uno('SELECT 1 FROM sucursales WHERE nombre = ? AND id <> ?', [$nuevo['nombre'], $id])) throw new ErrorApi('Ya existe una sucursal con ese nombre', 409);
        }
        if (array_key_exists('telefono', $c)) $nuevo['telefono'] = PersonalControlador::telefono($c['telefono']);
        $dom = isset($c['domicilio']) && is_array($c['domicilio']) ? $this->domicilio($c['domicilio']) : null;
        $disc = array_key_exists('disciplinas', $c) ? $this->disciplinas($c['disciplinas']) : null;
        if (!$nuevo && !$dom && $disc === null) throw new ErrorApi('Nada que cambiar', 422);

        $cambios = Db::transaccion(function () use ($req, $id, $antes, $nuevo, $dom, $disc) {
            $n = 0;
            if ($nuevo) {
                $set = implode(', ', array_map(fn($k) => "$k = ?", array_keys($nuevo)));
                Db::ejecutar("UPDATE sucursales SET $set WHERE id = ?", [...array_values($nuevo), $id]);
                $n += Bitacora::cambio($req, 'sucursales', $id, $antes, $nuevo, $id);
            }
            if ($dom) {
                if ($antes['domicilio_id']) {
                    $previo = Db::uno('SELECT calle, numero, colonia, cp, municipio, estado FROM domicilios WHERE id = ?', [$antes['domicilio_id']]);
                    Db::ejecutar('UPDATE domicilios SET calle = ?, numero = ?, colonia = ?, cp = ?, municipio = ?, estado = ? WHERE id = ?',
                        [$dom['calle'], $dom['numero'], $dom['colonia'], $dom['cp'], $dom['municipio'], $dom['estado'], $antes['domicilio_id']]);
                    $n += Bitacora::cambio($req, 'domicilios', (int) $antes['domicilio_id'], $previo, $dom, $id);
                } else {
                    $did = Db::insertar('INSERT INTO domicilios (persona_id, calle, numero, colonia, cp, municipio, estado) VALUES (NULL, ?, ?, ?, ?, ?, ?)',
                        [$dom['calle'], $dom['numero'], $dom['colonia'], $dom['cp'], $dom['municipio'], $dom['estado']]);
                    Db::ejecutar('UPDATE sucursales SET domicilio_id = ? WHERE id = ?', [$did, $id]);
                    Bitacora::alta($req, 'domicilios', $did, $dom, $id); $n += count($dom);
                }
            }
            if ($disc !== null) {
                $hoy = array_map('intval', array_column(Db::todos('SELECT disciplina_id FROM sucursal_disciplinas WHERE sucursal_id = ?', [$id]), 'disciplina_id'));
                $quitar = array_diff($hoy, $disc); $poner = array_diff($disc, $hoy);
                foreach ($quitar as $q) {
                    $h = Db::uno('SELECT d.nombre FROM horarios h JOIN disciplinas d ON d.id = h.disciplina_id WHERE h.sucursal_id = ? AND h.disciplina_id = ? AND h.activo = 1 LIMIT 1', [$id, $q]);
                    if ($h) throw new ErrorApi("{$h['nombre']} tiene horarios activos en esta sucursal: desactívalos primero", 409, ['campo' => 'disciplinas']);
                    Db::ejecutar('DELETE FROM sucursal_disciplinas WHERE sucursal_id = ? AND disciplina_id = ?', [$id, $q]);
                }
                foreach ($poner as $p) Db::insertar('INSERT INTO sucursal_disciplinas (sucursal_id, disciplina_id) VALUES (?, ?)', [$id, $p]);
                if ($quitar || $poner) $n += Bitacora::cambio($req, 'sucursal_disciplinas', $id, ['disciplinas' => implode(',', $hoy)], ['disciplinas' => implode(',', $disc)], $id);
            }
            return $n;
        });
        Respuesta::ok(['id' => $id, 'campos_cambiados' => $cambios, 'sucursal' => $this->detalle($id)]);
    }

    private function detalle(int $id): array
    {
        $s = Db::uno('SELECT s.id, s.clave, s.nombre, s.telefono, s.activa, d.calle, d.numero, d.colonia, d.cp, d.municipio, d.estado
                      FROM sucursales s LEFT JOIN domicilios d ON d.id = s.domicilio_id WHERE s.id = ?', [$id]);
        if (!$s) throw new ErrorApi('Sucursal no encontrada', 404);
        $dom = array_intersect_key($s, array_flip(self::DOMICILIO));
        $s = array_diff_key($s, $dom);
        $s['domicilio'] = $dom['calle'] !== null ? $dom : null;
        $s['disciplinas'] = Db::todos('SELECT d.id, d.nombre FROM sucursal_disciplinas sd JOIN disciplinas d ON d.id = sd.disciplina_id WHERE sd.sucursal_id = ? ORDER BY d.nombre', [$id]);
        $s['personal'] = Db::todos('SELECT u.id usuario_id, CONCAT_WS(" ", pe.nombre, pe.apellido_paterno, pe.apellido_materno) nombre, r.nombre rol, u.debe_cambiar_password
                                    FROM usuario_roles ur JOIN roles r ON r.id = ur.rol_id AND r.alcance = "sucursal"
                                    JOIN usuarios u ON u.id = ur.usuario_id AND u.activo = 1 JOIN personas pe ON pe.id = u.persona_id
                                    WHERE ur.sucursal_id = ? AND ur.activo = 1 ORDER BY r.nivel DESC, pe.nombre', [$id]);
        return $s;
    }

    private function domicilio(array $x): array
    {
        $d = [];
        foreach (self::DOMICILIO as $k) { $v = trim((string) ($x[$k] ?? '')); $d[$k] = $v === '' ? null : $v; }
        foreach (['calle' => 'la calle', 'cp' => 'el código postal', 'municipio' => 'el municipio', 'estado' => 'el estado'] as $k => $n) {
            if ($d[$k] === null) throw new ErrorApi("Falta $n del domicilio", 422, ['campo' => "domicilio.$k"]);
        }
        if (!preg_match('/^\d{5}$/', $d['cp'])) throw new ErrorApi('El código postal debe tener 5 dígitos', 422, ['campo' => 'domicilio.cp']);
        foreach (['calle' => 100, 'numero' => 20, 'colonia' => 80, 'municipio' => 80, 'estado' => 60] as $k => $max) if ($d[$k] !== null) $d[$k] = mb_substr($d[$k], 0, $max);
        return $d;
    }

    private function disciplinas(mixed $lista): array
    {
        if (!is_array($lista)) throw new ErrorApi('Disciplinas: manda una lista', 422, ['campo' => 'disciplinas']);
        $ids = array_values(array_unique(array_map('intval', $lista)));
        foreach ($ids as $i) if (!Db::uno('SELECT 1 FROM disciplinas WHERE id = ? AND activa = 1', [$i])) throw new ErrorApi('Disciplina no encontrada o inactiva', 404, ['campo' => 'disciplinas']);
        return $ids;
    }
}
