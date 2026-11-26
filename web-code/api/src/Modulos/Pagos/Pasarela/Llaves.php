<?php
declare(strict_types=1);
namespace Dojo\Modulos\Pagos\Pasarela;

use Dojo\Nucleo\ErrorApi;

/**
 * Cifra las llaves de la pasarela antes de guardarlas en la base (si alguien saca un respaldo de la base,
 * no se lleva el Access Token). La llave de cifrado vive en web-code/api/almacen/llaves/pasarela.key,
 * que no se sube a git (almacen/ está en .gitignore) y no está en la base.
 * Si ese archivo se pierde, basta con volver a escribir las llaves en el panel.
 */
final class Llaves
{
    private static function llave(): string
    {
        $dir = dirname(__DIR__, 4) . '/almacen/llaves';
        if (!is_dir($dir)) @mkdir($dir, 0700, true);
        $f = "$dir/pasarela.key";
        if (!is_file($f)) {
            if (!is_writable($dir)) throw new ErrorApi('El servidor no puede escribir en web-code/api/almacen/llaves (revisa permisos)', 500);
            file_put_contents($f, base64_encode(random_bytes(SODIUM_CRYPTO_SECRETBOX_KEYBYTES)));
            @chmod($f, 0600);
        }
        $k = base64_decode(trim((string) file_get_contents($f)), true);
        if ($k === false || strlen($k) !== SODIUM_CRYPTO_SECRETBOX_KEYBYTES) throw new ErrorApi('La llave de cifrado de la pasarela está dañada', 500);
        return $k;
    }

    public static function cifrar(string $texto): string
    {
        $nonce = random_bytes(SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
        return base64_encode($nonce . sodium_crypto_secretbox($texto, $nonce, self::llave()));
    }

    /** null si no se puede descifrar (por ejemplo, se cambió la llave): hay que volver a capturarla */
    public static function descifrar(?string $cifrado): ?string
    {
        if (!$cifrado) return null;
        $b = base64_decode($cifrado, true);
        if ($b === false || strlen($b) <= SODIUM_CRYPTO_SECRETBOX_NONCEBYTES) return null;
        $t = sodium_crypto_secretbox_open(substr($b, SODIUM_CRYPTO_SECRETBOX_NONCEBYTES), substr($b, 0, SODIUM_CRYPTO_SECRETBOX_NONCEBYTES), self::llave());
        return $t === false ? null : $t;
    }
}
