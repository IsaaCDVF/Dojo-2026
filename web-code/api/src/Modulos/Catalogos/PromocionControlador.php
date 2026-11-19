<?php
declare(strict_types=1);
namespace Dojo\Modulos\Catalogos;

use Dojo\Modulos\Bitacora\Bitacora;
use Dojo\Nucleo\{Db, ErrorApi, Peticion, Respuesta};
use Dojo\Nucleo\Middleware\Permiso;

/**
 * Paquetes (con código, p. ej. NOV2026), convenios (con institución) y descuentos.
 * Cada promoción dice cuánto descuenta en cada concepto: porcentaje o monto fijo.
 */
final class PromocionControlador
{
    private const TIPOS = ['paquete', 'convenio', 'descuento'];

    /** GET /api/promociones?vigentes=1 — un rol de sucursal ve las suyas y las globales */
    public function listar(Peticion $req): void
    {
        $sql = 'SELECT p.id, p.nombre, p.tipo, p.codigo, p.institucion, p.sucursal_id, s.nombre AS sucursal,
                       p.vigente_desde, p.vigente_hasta, p.activa
                FROM promociones p LEFT JOIN sucursales s ON s.id = p.sucursal_id WHERE 1 = 1';
        $params = [];
        if (($s = Permiso::sucursalDe($req)) !== null) { $sql .= ' AND (p.sucursal_id = ? OR p.sucursal_id IS NULL)'; $params[] = $s; }
        if (!empty($req->query['vigentes'])) {
            $sql .= ' AND p.activa = 1 AND p.vigente_desde <= CURDATE() AND (p.vigente_hasta IS NULL OR p.vigente_hasta >= CURDATE())';
        }
        $lista = Db::todos($sql . ' ORDER BY p.vigente_desde DESC, p.id DESC', $params);
        foreach ($lista as &$p) {
            $p['conceptos'] = Db::todos('SELECT pc.concepto_id, c.nombre AS concepto, pc.tipo, pc.valor
                                         FROM promocion_conceptos pc JOIN conceptos c ON c.id = pc.concepto_id
                                         WHERE pc.promocion_id = ?', [$p['id']]);
        }
        Respuesta::ok($lista);
    }

    /**
     * POST /api/promociones
     * {nombre, tipo, codigo?, institucion?, sucursal_id?, vigente_desde, vigente_hasta?,
     *  conceptos: [{concepto_id, tipo: "porcentaje"|"monto", valor}]}
     */
    public function crear(Peticion $req): void
    {
        $d = $req->requeridos('nombre', 'tipo', 'vigente_desde');
        $c = $req->cuerpo;
        if (!in_array($d['tipo'], self::TIPOS, true)) throw new ErrorApi('Tipo no válido', 422, ['permitidos' => self::TIPOS]);

        $codigo = isset($c['codigo']) && trim($c['codigo']) !== '' ? strtoupper(trim($c['codigo'])) : null;
        $institucion = isset($c['institucion']) && trim($c['institucion']) !== '' ? trim($c['institucion']) : null;
        if ($d['tipo'] === 'paquete' && !$codigo) throw new ErrorApi('Un paquete necesita un código', 422);
        if ($d['tipo'] === 'convenio' && !$institucion) throw new ErrorApi('Un convenio necesita la institución', 422);
        if ($codigo && !preg_match('/^[A-Z0-9_-]{3,30}$/', $codigo)) throw new ErrorApi('El código solo lleva letras, números, - o _ (3 a 30)', 422);
        if ($codigo && Db::uno('SELECT 1 FROM promociones WHERE codigo = ?', [$codigo])) throw new ErrorApi('Ese código ya existe', 409);

        $desde = $this->fecha($d['vigente_desde'], 'vigente_desde');
        $hasta = isset($c['vigente_hasta']) && $c['vigente_hasta'] !== '' ? $this->fecha($c['vigente_hasta'], 'vigente_hasta') : null;
        if ($hasta && $hasta < $desde) throw new ErrorApi('vigente_hasta no puede ser antes de vigente_desde', 422);

        // Alcance: un administrador de sucursal solo crea promociones para su sucursal
        $sucursal = isset($c['sucursal_id']) ? (int) $c['sucursal_id'] : null;
        if (($propia = Permiso::sucursalDe($req)) !== null) {
            if ($sucursal !== null && $sucursal !== $propia) throw new ErrorApi('Solo puedes crear promociones para tu sucursal', 403);
            $sucursal = $propia;
        }

        $lineas = $c['conceptos'] ?? [];
        if (!is_array($lineas) || !$lineas) throw new ErrorApi('Indica al menos un concepto con su descuento', 422);
        $vistos = [];
        foreach ($lineas as $l) {
            $id = (int) ($l['concepto_id'] ?? 0);
            if (isset($vistos[$id])) throw new ErrorApi("El concepto $id está repetido", 422);
            $vistos[$id] = true;
            if (!Db::uno('SELECT 1 FROM conceptos WHERE id = ?', [$id])) throw new ErrorApi("El concepto $id no existe", 404);
            $tipo = $l['tipo'] ?? ''; $valor = $l['valor'] ?? null;
            if (!in_array($tipo, ['porcentaje', 'monto'], true) || !is_numeric($valor) || (float) $valor <= 0) {
                throw new ErrorApi('Cada concepto necesita tipo (porcentaje o monto) y un valor mayor que 0', 422);
            }
            if ($tipo === 'porcentaje' && (float) $valor > 100) throw new ErrorApi('Un porcentaje no puede pasar de 100', 422);
        }

        $id = Db::transaccion(function () use ($req, $d, $codigo, $institucion, $sucursal, $desde, $hasta, $lineas) {
            $id = Db::insertar(
                'INSERT INTO promociones (nombre, tipo, codigo, institucion, sucursal_id, vigente_desde, vigente_hasta)
                 VALUES (?, ?, ?, ?, ?, ?, ?)',
                [trim($d['nombre']), $d['tipo'], $codigo, $institucion, $sucursal, $desde, $hasta]);
            foreach ($lineas as $l) {
                Db::ejecutar('INSERT INTO promocion_conceptos (promocion_id, concepto_id, tipo, valor) VALUES (?, ?, ?, ?)',
                    [$id, (int) $l['concepto_id'], $l['tipo'], $l['valor']]);
            }
            Bitacora::alta($req, 'promociones', $id,
                ['nombre' => $d['nombre'], 'tipo' => $d['tipo'], 'codigo' => $codigo, 'vigente_desde' => $desde, 'vigente_hasta' => $hasta], $sucursal);
            return $id;
        });
        Respuesta::ok(['id' => $id, 'codigo' => $codigo], 201);
    }

    /** PUT /api/promociones/{id}/desactivar — baja lógica: la promoción queda en el historial */
    public function desactivar(Peticion $req): void
    {
        $id = $req->params['id'];
        $p = Db::uno('SELECT activa, sucursal_id FROM promociones WHERE id = ?', [$id]);
        if (!$p) throw new ErrorApi('Promoción no encontrada', 404);
        if (($propia = Permiso::sucursalDe($req)) !== null && (int) $p['sucursal_id'] !== $propia) {
            throw new ErrorApi('Esa promoción no es de tu sucursal', 403);
        }
        Db::transaccion(function () use ($req, $id, $p) {
            Db::ejecutar('UPDATE promociones SET activa = 0 WHERE id = ?', [$id]);
            Bitacora::cambio($req, 'promociones', $id, ['activa' => $p['activa']], ['activa' => 0],
                $p['sucursal_id'] === null ? null : (int) $p['sucursal_id']);
        });
        Respuesta::ok(['id' => $id, 'activa' => false]);
    }

    /** POST /api/cotizar  {sucursal_id?, codigo?, conceptos: [{concepto_id, cantidad?}]} — lo usará la inscripción (2.5) */
    public function cotizar(Peticion $req): void
    {
        $c = $req->cuerpo;
        $sucursal = Permiso::sucursalDe($req) ?? (isset($c['sucursal_id']) ? (int) $c['sucursal_id'] : null);
        $codigo = isset($c['codigo']) && trim($c['codigo']) !== '' ? trim($c['codigo']) : null;
        Respuesta::ok(Tarifas::cotizar(is_array($c['conceptos'] ?? null) ? $c['conceptos'] : [], $sucursal, $codigo));
    }

    private function fecha(string $f, string $campo): string
    {
        $d = \DateTime::createFromFormat('Y-m-d', $f);
        if (!$d || $d->format('Y-m-d') !== $f) throw new ErrorApi("$campo debe tener formato AAAA-MM-DD", 422);
        return $f;
    }
}
