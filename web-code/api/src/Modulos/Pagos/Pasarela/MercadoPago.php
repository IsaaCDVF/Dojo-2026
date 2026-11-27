<?php
declare(strict_types=1);
namespace Dojo\Modulos\Pagos\Pasarela;

use Dojo\Nucleo\ErrorApi;

/**
 * Cliente mínimo de la API de Mercado Pago (Checkout Pro con preferencias).
 * Docs: https://www.mercadopago.com.mx/developers/es/reference/online-payments/checkout-pro/overview
 */
final class MercadoPago
{
    private const API = 'https://api.mercadopago.com';

    public function __construct(private readonly string $token) {}

    /** POST /checkout/preferences → {id, init_point} */
    public function crearPreferencia(array $datos): array
    {
        return $this->pedir('POST', '/checkout/preferences', $datos);
    }

    /** GET /v1/payments/{id} */
    public function pago(string $id): array
    {
        return $this->pedir('GET', '/v1/payments/' . rawurlencode($id));
    }

    /** El pago más reciente con esa referencia (sirve cuando el aviso de Mercado Pago no puede llegar, p. ej. en local) */
    public function ultimoPorReferencia(string $ref): ?array
    {
        $r = $this->pedir('GET', '/v1/payments/search?' . http_build_query(['external_reference' => $ref, 'sort' => 'date_created', 'criteria' => 'desc', 'limit' => 1]));
        return $r['results'][0] ?? null;
    }

    /** GET /users/me — para probar que el Access Token sirve */
    public function cuenta(): array
    {
        return $this->pedir('GET', '/users/me');
    }

    /**
     * Valida la firma del aviso (webhook): x-signature = "ts=...,v1=..."; v1 = HMAC-SHA256(secreto, "id:{data.id};request-id:{x-request-id};ts:{ts};").
     * Si falta data.id o x-request-id, ese par no va en el texto firmado.
     */
    public static function firmaValida(?string $xSignature, ?string $xRequestId, ?string $dataId, string $secreto): bool
    {
        if (!$xSignature || $secreto === '') return false;
        $partes = [];
        foreach (explode(',', $xSignature) as $p) { [$k, $v] = array_pad(explode('=', trim($p), 2), 2, ''); $partes[$k] = $v; }
        if (empty($partes['ts']) || empty($partes['v1'])) return false;
        $id = $dataId !== null && $dataId !== '' ? (ctype_alnum($dataId) ? strtolower($dataId) : $dataId) : null;
        $manifiesto = ($id !== null ? "id:$id;" : '') . ($xRequestId ? "request-id:$xRequestId;" : '') . "ts:{$partes['ts']};";
        return hash_equals(hash_hmac('sha256', $manifiesto, $secreto), $partes['v1']);
    }

    private function pedir(string $metodo, string $ruta, ?array $cuerpo = null): array
    {
        $ch = curl_init(self::API . $ruta);
        $cab = ['Authorization: Bearer ' . $this->token, 'Accept: application/json'];
        if ($cuerpo !== null) { $cab[] = 'Content-Type: application/json'; $cab[] = 'X-Idempotency-Key: ' . bin2hex(random_bytes(16)); }
        curl_setopt_array($ch, [CURLOPT_CUSTOMREQUEST => $metodo, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 20, CURLOPT_CONNECTTIMEOUT => 8,
            CURLOPT_HTTPHEADER => $cab] + ($cuerpo !== null ? [CURLOPT_POSTFIELDS => json_encode($cuerpo, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)] : []));
        $res = curl_exec($ch);
        $cod = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        curl_close($ch);
        if ($res === false) throw new ErrorApi('No se pudo conectar con Mercado Pago' . ($err ? ": $err" : ''), 502);
        $j = json_decode((string) $res, true) ?? [];
        if ($cod === 401 || $cod === 403) throw new ErrorApi('Mercado Pago no aceptó el Access Token: revisa las llaves en Configuración → Pagos en línea', 502);
        if ($cod >= 400) throw new ErrorApi('Mercado Pago respondió con error: ' . ($j['message'] ?? "HTTP $cod"), 502);
        return $j;
    }
}
