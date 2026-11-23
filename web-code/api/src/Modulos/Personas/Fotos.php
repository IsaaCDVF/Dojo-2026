<?php
declare(strict_types=1);
namespace Dojo\Modulos\Personas;

use Dojo\Nucleo\ErrorApi;

/**
 * Fotos de alumnos. Llegan como data URL (data:image/jpeg;base64,...) dentro del JSON,
 * se validan (tipo real y tamaño) y se guardan en api/almacen/fotos/ con un nombre aleatorio.
 * La carpeta almacen/ está en .gitignore: son datos, no código.
 */
final class Fotos
{
    private const MAX_BYTES = 2 * 1024 * 1024;
    private const TIPOS = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];

    public static function dir(): string
    {
        $d = dirname(__DIR__, 3) . '/almacen/fotos';
        if (!is_dir($d)) @mkdir($d, 0775, true);
        if (!is_dir($d) || !is_writable($d)) {
            throw new ErrorApi('No se pudo guardar la foto: el servidor no puede escribir en web-code/api/almacen/fotos (revisa permisos)', 500);
        }
        return $d;
    }

    /** Guarda la foto y devuelve la ruta relativa (fotos/abc.jpg) que va en personas.foto */
    public static function guardar(string $dataUrl): string
    {
        if (!preg_match('#^data:(image/[a-z]+);base64,(.+)$#s', $dataUrl, $m)) throw new ErrorApi('La foto debe ser una imagen JPG, PNG o WEBP', 422);
        $bytes = base64_decode($m[2], true);
        if ($bytes === false) throw new ErrorApi('La foto llegó dañada', 422);
        if (strlen($bytes) > self::MAX_BYTES) throw new ErrorApi('La foto pesa más de 2 MB', 422);
        $real = (new \finfo(FILEINFO_MIME_TYPE))->buffer($bytes);
        if (!isset(self::TIPOS[$real])) throw new ErrorApi('La foto debe ser una imagen JPG, PNG o WEBP', 422);
        $nombre = bin2hex(random_bytes(12)) . '.' . self::TIPOS[$real];
        file_put_contents(self::dir() . '/' . $nombre, $bytes);
        return 'fotos/' . $nombre;
    }

    public static function enviar(?string $ruta): void
    {
        $archivo = $ruta ? dirname(__DIR__, 3) . '/almacen/' . basename(dirname($ruta)) . '/' . basename($ruta) : null;
        if (!$archivo || !is_file($archivo)) throw new ErrorApi('El alumno no tiene foto', 404);
        $ext = pathinfo($archivo, PATHINFO_EXTENSION);
        header('Content-Type: ' . (array_search($ext, self::TIPOS, true) ?: 'application/octet-stream'));
        header('Cache-Control: private, max-age=3600');
        readfile($archivo);
    }
}
