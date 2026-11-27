<?php
declare(strict_types=1);
namespace Dojo\Modulos\Avisos;

use Dojo\Modulos\Pagos\Pasarela\Llaves;
use Dojo\Nucleo\Db;

/**
 * Notificaciones al celular (Web Push) sin librerías externas:
 *  - Cifrado del mensaje: RFC 8291 (ECDH P-256 + HKDF) con "aes128gcm" (RFC 8188).
 *  - Firma del servidor: VAPID (RFC 8292), un JWT ES256.
 * Las llaves VAPID se crean solas la primera vez y la privada se guarda cifrada en sistema_estado.
 * Funciona en Chrome/Edge/Firefox (Android y compu) y en iPhone con la app agregada a la pantalla de inicio (iOS 16.4+).
 */
final class WebPush
{
    /** Prefijo DER de una llave pública EC P-256 (SubjectPublicKeyInfo) */
    private const SPKI_P256 = '3059301306072a8648ce3d020106082a8648ce3d030107034200';

    public static function b64u(string $b): string { return rtrim(strtr(base64_encode($b), '+/', '-_'), '='); }
    public static function deB64u(string $s): string { return (string) base64_decode(strtr($s, '-_', '+/') . str_repeat('=', (4 - strlen($s) % 4) % 4)); }

    /** Llave pública VAPID (para que el navegador se suscriba) */
    public static function llavePublica(): string
    {
        return self::vapid()['publica'];
    }

    /** @return array{publica: string, privada: \OpenSSLAsymmetricKey} */
    private static function vapid(): array
    {
        static $v = null;
        if ($v) return $v;
        $pub = Db::uno('SELECT valor FROM sistema_estado WHERE clave = "vapid_publica"')['valor'] ?? null;
        $priv = Llaves::descifrar(Db::uno('SELECT valor FROM sistema_estado WHERE clave = "vapid_privada"')['valor'] ?? null);
        if (!$pub || !$priv) {   // primera vez (o se perdió la llave de cifrado): se crean nuevas; los celulares se vuelven a suscribir solos
            $k = openssl_pkey_new(['private_key_type' => OPENSSL_KEYTYPE_EC, 'curve_name' => 'prime256v1']);
            openssl_pkey_export($k, $priv);
            $pub = self::b64u(self::puntoPublico($k));
            Db::ejecutar('REPLACE INTO sistema_estado (clave, valor, actualizado) VALUES ("vapid_publica", ?, NOW()), ("vapid_privada", ?, NOW())', [$pub, Llaves::cifrar($priv)]);
            Db::ejecutar('DELETE FROM push_suscripciones');
        }
        return $v = ['publica' => $pub, 'privada' => openssl_pkey_get_private($priv)];
    }

    /** Punto público sin comprimir (0x04 || X || Y, 65 bytes) */
    private static function puntoPublico(\OpenSSLAsymmetricKey $k): string
    {
        $d = openssl_pkey_get_details($k)['ec'];
        return "\x04" . str_pad($d['x'], 32, "\0", STR_PAD_LEFT) . str_pad($d['y'], 32, "\0", STR_PAD_LEFT);
    }

    private static function llaveDePunto(string $punto): \OpenSSLAsymmetricKey
    {
        $der = hex2bin(self::SPKI_P256) . $punto;
        return openssl_pkey_get_public("-----BEGIN PUBLIC KEY-----\n" . chunk_split(base64_encode($der), 64, "\n") . "-----END PUBLIC KEY-----\n");
    }

    /**
     * Cifra el mensaje para una suscripción (RFC 8291 + RFC 8188). $efimera y $sal solo se pasan en las pruebas (vectores del RFC).
     * @return string cuerpo listo para enviar (encabezado + texto cifrado)
     */
    public static function cifrar(string $texto, string $p256dh, string $auth, ?\OpenSSLAsymmetricKey $efimera = null, ?string $sal = null): string
    {
        $uaPub = self::deB64u($p256dh); $secretoAuth = self::deB64u($auth);
        $efimera ??= openssl_pkey_new(['private_key_type' => OPENSSL_KEYTYPE_EC, 'curve_name' => 'prime256v1']);
        $asPub = self::puntoPublico($efimera);
        $ecdh = openssl_pkey_derive(self::llaveDePunto($uaPub), $efimera, 32);
        $sal ??= random_bytes(16);
        // IKM = HKDF(auth, ecdh, "WebPush: info\0" || ua_public || as_public, 32)
        $prkKey = hash_hmac('sha256', $ecdh, $secretoAuth, true);
        $ikm = substr(hash_hmac('sha256', "WebPush: info\0" . $uaPub . $asPub . "\x01", $prkKey, true), 0, 32);
        $prk = hash_hmac('sha256', $ikm, $sal, true);
        $cek = substr(hash_hmac('sha256', "Content-Encoding: aes128gcm\0\x01", $prk, true), 0, 16);
        $nonce = substr(hash_hmac('sha256', "Content-Encoding: nonce\0\x01", $prk, true), 0, 12);
        $tag = '';
        $cifrado = openssl_encrypt($texto . "\x02", 'aes-128-gcm', $cek, OPENSSL_RAW_DATA, $nonce, $tag, '', 16);
        return $sal . pack('N', 4096) . chr(strlen($asPub)) . $asPub . $cifrado . $tag;
    }

    /** Llave EC P-256 a partir de su escalar privado y su punto público (solo para las pruebas con los vectores del RFC) */
    public static function llavePrivadaDe(string $d, string $punto): \OpenSSLAsymmetricKey
    {
        $der = hex2bin('30770201010420') . $d . hex2bin('a00a06082a8648ce3d030107a144034200') . $punto;
        return openssl_pkey_get_private("-----BEGIN EC PRIVATE KEY-----\n" . chunk_split(base64_encode($der), 64, "\n") . "-----END EC PRIVATE KEY-----\n");
    }

    /** JWT de VAPID para el servicio de notificaciones del navegador */
    private static function jwt(string $endpoint): string
    {
        $u = parse_url($endpoint);
        $aud = $u['scheme'] . '://' . $u['host'] . (isset($u['port']) ? ':' . $u['port'] : '');
        $cab = self::b64u(json_encode(['typ' => 'JWT', 'alg' => 'ES256']));
        $marca = Db::uno('SELECT url_publica FROM pasarela_config WHERE id = 1')['url_publica'] ?? null;
        $cuerpo = self::b64u(json_encode(['aud' => $aud, 'exp' => time() + 12 * 3600, 'sub' => $marca && str_starts_with($marca, 'https://') ? $marca : 'mailto:avisos@dojoos.mx']));
        openssl_sign("$cab.$cuerpo", $der, self::vapid()['privada'], OPENSSL_ALGO_SHA256);
        return "$cab.$cuerpo." . self::b64u(self::derARaw($der));
    }

    /** Firma ECDSA en DER → r||s de 64 bytes (lo que pide JWT ES256) */
    private static function derARaw(string $der): string
    {
        $p = 2; if (ord($der[1]) & 0x80) $p += ord($der[1]) & 0x7f;
        $lr = ord($der[$p + 1]); $r = substr($der, $p + 2, $lr); $p += 2 + $lr;
        $ls = ord($der[$p + 1]); $s = substr($der, $p + 2, $ls);
        $n = fn($x) => str_pad(ltrim($x, "\0"), 32, "\0", STR_PAD_LEFT);
        return $n($r) . $n($s);
    }

    /**
     * Manda una notificación a una suscripción. Devuelve el código HTTP (201 = entregada al servicio).
     * 404/410 = el celular ya no la acepta (se borra la suscripción).
     */
    public static function enviar(array $sus, array $datos): int
    {
        $cuerpo = self::cifrar(json_encode($datos, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), $sus['p256dh'], $sus['auth']);
        $ch = curl_init($sus['endpoint']);
        curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => $cuerpo, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10, CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_HTTPHEADER => ['Content-Type: application/octet-stream', 'Content-Encoding: aes128gcm', 'TTL: 86400', 'Urgency: normal',
                'Authorization: vapid t=' . self::jwt($sus['endpoint']) . ', k=' . self::llavePublica()]]);
        curl_exec($ch);
        $cod = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($cod === 404 || $cod === 410) Db::ejecutar('DELETE FROM push_suscripciones WHERE id = ?', [$sus['id']]);
        elseif ($cod >= 200 && $cod < 300) Db::ejecutar('UPDATE push_suscripciones SET ultima_ok = NOW(), fallos = 0 WHERE id = ?', [$sus['id']]);
        else Db::ejecutar('UPDATE push_suscripciones SET fallos = LEAST(fallos + 1, 100) WHERE id = ?', [$sus['id']]);
        return $cod;
    }
}
