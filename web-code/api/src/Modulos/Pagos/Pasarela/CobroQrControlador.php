<?php
declare(strict_types=1);
namespace Dojo\Modulos\Pagos\Pasarela;

use Dojo\Modulos\Bitacora\Bitacora;
use Dojo\Nucleo\{Db, ErrorApi, Peticion, Respuesta};
use Dojo\Nucleo\Middleware\Permiso;

/**
 * Cobro con QR en caja: la persona está en el mostrador y quiere pagar con tarjeta.
 * Recepción marca qué se paga → se crea el cobro de Mercado Pago (solo tarjeta o saldo MP) → la pantalla muestra un QR →
 * la persona lo escanea con su celular y paga ahí → la caja ve "Pagado" sola y abre el recibo.
 * Recepción no ve ni toca las llaves de Mercado Pago (siguen siendo del súper admin).
 */
final class CobroQrControlador
{
    /** POST /api/caja/cobro-qr {responsable_id, claves, codigo?} → {pago_id, url, origen, total} */
    public function crear(Peticion $req): void
    {
        $cfg = Db::uno('SELECT * FROM pasarela_config WHERE id = 1');
        if (($cfg['modo'] ?? 'apagado') === 'apagado') throw new ErrorApi('El cobro con Mercado Pago está apagado. Lo enciende el súper admin en Configuración → Pagos en línea.', 409);
        $d = $req->requeridos('responsable_id');
        $claves = array_values(array_unique(array_map('strval', (array) ($req->cuerpo['claves'] ?? []))));
        if (!$claves) throw new ErrorApi('Marca lo que se va a pagar', 422);
        $codigo = isset($req->cuerpo['codigo']) && trim((string) $req->cuerpo['codigo']) !== '' ? trim((string) $req->cuerpo['codigo']) : null;
        Respuesta::ok(PagoEnLineaControlador::iniciar($req, $cfg, (int) $d['responsable_id'], $claves, Permiso::sucursalDe($req), $codigo, 'caja'), 201);
    }

    /** GET /api/caja/cobro-qr/{id} — la pantalla pregunta cada pocos segundos si ya pagó */
    public function ver(Peticion $req): void
    {
        $pl = $this->deCaja($req);
        PagoEnLineaControlador::consultar($pl, $req->ip);
        Respuesta::ok(PagoEnLineaControlador::estado((int) $pl['pago_id']));
    }

    /** POST /api/caja/cobro-qr/{id}/prueba {resultado: aprobado|rechazado} — solo en modo prueba (no hay QR de verdad) */
    public function prueba(Peticion $req): void
    {
        $pl = $this->deCaja($req);
        $res = (string) ($req->cuerpo['resultado'] ?? '');
        if (!in_array($res, ['aprobado', 'rechazado'], true)) throw new ErrorApi('Resultado de prueba no válido', 422);
        PagoEnLineaControlador::simular($pl, $res, $req->ip);
        Respuesta::ok(PagoEnLineaControlador::estado((int) $pl['pago_id']));
    }

    /** PUT /api/caja/cobro-qr/{id}/cancelar — la persona se arrepintió o pagará de otra forma */
    public function cancelar(Peticion $req): void
    {
        $pl = $this->deCaja($req);
        PagoEnLineaControlador::consultar($pl, $req->ip);   // por si justo acaba de pagar
        $p = Db::uno('SELECT estado FROM pagos WHERE id = ?', [$pl['pago_id']]);
        if ($p['estado'] === 'aprobado') throw new ErrorApi('Ya está pagado: no se puede cancelar desde aquí', 409, ['estado' => 'aprobado']);
        if ($p['estado'] === 'pendiente') {
            // Si de todos modos llega a pagar después, Mercado Pago avisa y el pago se aplica (el dinero no se pierde)
            Db::ejecutar('UPDATE pagos SET estado = "rechazado", codigo_respuesta = "cancelado" WHERE id = ? AND estado = "pendiente"', [$pl['pago_id']]);
            Bitacora::cambio($req, 'pagos', (int) $pl['pago_id'], ['estado' => 'pendiente'], ['estado' => 'cancelado en caja'], (int) $pl['sucursal_id']);
        }
        Respuesta::ok(PagoEnLineaControlador::estado((int) $pl['pago_id']));
    }

    /** Solo cobros con QR de la caja, y de la sucursal de quien pregunta */
    private function deCaja(Peticion $req): array
    {
        $pl = Db::uno('SELECT pl.*, p.estado, p.codigo_respuesta, p.responsable_id, p.sucursal_id FROM pagos_en_linea pl JOIN pagos p ON p.id = pl.pago_id WHERE pl.pago_id = ? AND pl.canal = "caja"',
            [(int) $req->params['id']]);
        if (!$pl) throw new ErrorApi('Cobro no encontrado', 404);
        Permiso::exigirSucursal($req, (int) $pl['sucursal_id']);
        return $pl;
    }
}
