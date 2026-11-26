<?php
declare(strict_types=1);
namespace Dojo\Modulos\Sistema;

use Dojo\Modulos\Bitacora\Bitacora;
use Dojo\Nucleo\{Db, ErrorApi, Peticion, Respuesta};

/**
 * Marca blanca. Dojo OS se vende a varias empresas: cada una pone su nombre, logo, tema de colores,
 * tipo de letra, idioma y moneda. Todo vive en la base de datos (tabla marca, una fila), no en el código
 * ni en el .env, para que el mismo sistema sirva a cualquier cliente y el día de mañana pase a SaaS
 * cambiando la fila única por una por empresa.
 *
 * GET es pública: el login y la app la necesitan antes de que alguien entre.
 */
final class MarcaControlador
{
    public const TEMAS = ['oceano', 'dojo', 'bosque', 'grafito', 'ciruela', 'atardecer', 'personalizado'];
    public const FUENTES = ['dm-sans', 'inter', 'nunito', 'montserrat', 'poppins', 'source-sans', 'lora', 'sistema'];
    public const IDIOMAS = ['es-MX', 'en-US'];
    public const MONEDAS = ['MXN', 'USD', 'EUR', 'COP', 'ARS', 'CLP', 'PEN', 'GTQ', 'CAD'];
    private const IMAGENES = ['logo', 'logo_oscuro', 'icono'];
    private const MAX_BYTES = 512 * 1024;
    private const MIMES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

    /** GET /api/marca — lo que el panel y la app necesitan para verse como la empresa */
    public function ver(Peticion $req): void
    {
        Respuesta::ok(self::datos());
    }

    public static function datos(): array
    {
        $m = Db::uno('SELECT nombre, lema, tema, color_primario, color_fondo, fuente, idioma, moneda, zona_horaria, pais, actualizado FROM marca WHERE id = 1')
            ?? ['nombre' => 'Dojo OS', 'lema' => null, 'tema' => 'oceano', 'color_primario' => null, 'color_fondo' => null, 'fuente' => 'dm-sans',
                'idioma' => 'es-MX', 'moneda' => 'MXN', 'zona_horaria' => 'America/Mexico_City', 'pais' => 'MX', 'actualizado' => null];
        $imgs = Db::todos('SELECT tipo, UNIX_TIMESTAMP(actualizado) AS v FROM marca_imagenes');
        $m['imagenes'] = array_fill_keys(self::IMAGENES, null);
        foreach ($imgs as $i) $m['imagenes'][$i['tipo']] = "/api/marca/imagen/{$i['tipo']}?v={$i['v']}";
        return $m;
    }

    /** PUT /api/marca — cambia nombre, tema, letra y región (solo lo que se manda) */
    public function guardar(Peticion $req): void
    {
        $antes = Db::uno('SELECT nombre, lema, tema, color_primario, color_fondo, fuente, idioma, moneda, zona_horaria, pais FROM marca WHERE id = 1');
        $d = array_intersect_key($req->cuerpo, $antes);
        if (!$d) throw new ErrorApi('No hay nada que cambiar', 422);
        if (array_key_exists('nombre', $d)) {
            $d['nombre'] = trim((string) $d['nombre']);
            if ($d['nombre'] === '' || mb_strlen($d['nombre']) > 80) throw new ErrorApi('El nombre debe tener de 1 a 80 letras', 422, ['campo' => 'nombre']);
        }
        if (array_key_exists('lema', $d)) {
            $d['lema'] = trim((string) $d['lema']) ?: null;
            if ($d['lema'] && mb_strlen($d['lema']) > 120) throw new ErrorApi('El lema no puede pasar de 120 letras', 422, ['campo' => 'lema']);
        }
        $lista = ['tema' => self::TEMAS, 'fuente' => self::FUENTES, 'idioma' => self::IDIOMAS, 'moneda' => self::MONEDAS];
        foreach ($lista as $k => $ok) {
            if (array_key_exists($k, $d) && !in_array($d[$k], $ok, true)) throw new ErrorApi("Ese valor no existe para $k", 422, ['campo' => $k]);
        }
        foreach (['color_primario', 'color_fondo'] as $k) {
            if (array_key_exists($k, $d)) {
                $d[$k] = $d[$k] ? strtolower((string) $d[$k]) : null;
                if ($d[$k] !== null && !preg_match('/^#[0-9a-f]{6}$/', $d[$k])) throw new ErrorApi('El color debe ser #rrggbb', 422, ['campo' => $k]);
            }
        }
        $tema = $d['tema'] ?? $antes['tema'];
        if ($tema === 'personalizado' && !($d['color_primario'] ?? $antes['color_primario'])) {
            throw new ErrorApi('Con el tema personalizado elige al menos el color principal', 422, ['campo' => 'color_primario']);
        }
        if (array_key_exists('zona_horaria', $d) && !in_array($d['zona_horaria'], \DateTimeZone::listIdentifiers(), true)) {
            throw new ErrorApi('Zona horaria no válida', 422, ['campo' => 'zona_horaria']);
        }
        if (array_key_exists('pais', $d) && !preg_match('/^[A-Z]{2}$/', (string) $d['pais'])) throw new ErrorApi('País no válido', 422, ['campo' => 'pais']);
        $sets = implode(', ', array_map(fn($k) => "$k = ?", array_keys($d)));
        Db::transaccion(function () use ($req, $d, $sets, $antes) {
            Db::ejecutar("UPDATE marca SET $sets, actualizado_por = ? WHERE id = 1", [...array_values($d), $req->ctx['usuario_id']]);
            Bitacora::cambio($req, 'marca', 1, $antes, $d, null);
        });
        Respuesta::ok(self::datos());
    }

    /** PUT /api/marca/imagen/{tipo} {imagen: dataURL} — logo, logo_oscuro o icono (PNG, JPG, WEBP o SVG, hasta 512 KB) */
    public function subirImagen(Peticion $req): void
    {
        $tipo = $this->tipo($req);
        $url = (string) ($req->cuerpo['imagen'] ?? '');
        if (!preg_match('#^data:([a-z+/.-]+);base64,(.+)$#s', $url, $m)) throw new ErrorApi('Manda la imagen como PNG, JPG, WEBP o SVG', 422);
        $bytes = base64_decode($m[2], true);
        if ($bytes === false || $bytes === '') throw new ErrorApi('La imagen llegó dañada', 422);
        if (strlen($bytes) > self::MAX_BYTES) throw new ErrorApi('La imagen pesa más de 512 KB', 422);
        $mime = (new \finfo(FILEINFO_MIME_TYPE))->buffer($bytes);
        if (in_array($mime, ['image/svg', 'text/xml', 'application/xml', 'text/plain'], true) && str_contains(substr($bytes, 0, 2000), '<svg')) $mime = 'image/svg+xml';
        if (!in_array($mime, self::MIMES, true)) throw new ErrorApi('Manda la imagen como PNG, JPG, WEBP o SVG', 422);
        // Un SVG puede traer código: se rechaza cualquier script, evento o recurso externo
        if ($mime === 'image/svg+xml' && preg_match('/<script|<foreignobject|\son[a-z]+\s*=|javascript:|<iframe|<embed|<object|xlink:href\s*=\s*["\']\s*(?!#)|href\s*=\s*["\']\s*(?!#|data:image)/i', $bytes)) {
            throw new ErrorApi('Ese SVG trae código o enlaces externos; expórtalo como SVG simple o como PNG', 422);
        }
        Db::transaccion(function () use ($req, $tipo, $mime, $bytes) {
            Db::ejecutar('REPLACE INTO marca_imagenes (tipo, mime, datos) VALUES (?, ?, ?)', [$tipo, $mime, $bytes]);
            Bitacora::alta($req, 'marca_imagenes', 1, ['imagen' => $tipo, 'tipo' => $mime, 'bytes' => strlen($bytes)], null);
        });
        Respuesta::ok(self::datos());
    }

    /** DELETE /api/marca/imagen/{tipo} — vuelve al logo de Dojo OS */
    public function quitarImagen(Peticion $req): void
    {
        $tipo = $this->tipo($req);
        Db::transaccion(function () use ($req, $tipo) {
            if (Db::ejecutar('DELETE FROM marca_imagenes WHERE tipo = ?', [$tipo])) Bitacora::baja($req, 'marca_imagenes', 1, null);
        });
        Respuesta::ok(self::datos());
    }

    /** GET /api/marca/imagen/{tipo} — pública (va en el login, la app y los recibos) */
    public function imagen(Peticion $req): void
    {
        $tipo = $this->tipo($req);
        $i = Db::uno('SELECT mime, datos FROM marca_imagenes WHERE tipo = ?', [$tipo]);
        if (!$i) throw new ErrorApi('No hay imagen', 404);
        header('Content-Type: ' . $i['mime']);
        header('Cache-Control: public, max-age=86400');
        header('X-Content-Type-Options: nosniff');
        header("Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; img-src data:");
        echo $i['datos'];
    }

    /** GET /api/marca/manifest/{app} — manifest de la PWA con el nombre y el ícono de la empresa (app o panel) */
    public function manifest(Peticion $req): void
    {
        $app = $req->params['app'] === 'app' ? 'app' : 'panel';
        $m = self::datos();
        $color = $m['tema'] === 'personalizado' && $m['color_fondo'] ? $m['color_fondo'] : (Temas::FONDOS[$m['tema']] ?? '#011c42');
        $ico = $m['imagenes']['icono'];
        $base = $app === 'app' ? '/app/' : '/';
        $iconos = $ico
            ? [['src' => $ico, 'sizes' => 'any', 'type' => Db::uno('SELECT mime FROM marca_imagenes WHERE tipo = "icono"')['mime'], 'purpose' => 'any']]
            : [['src' => '/app/icono-192.png', 'sizes' => '192x192', 'type' => 'image/png'], ['src' => '/app/icono-512.png', 'sizes' => '512x512', 'type' => 'image/png'],
               ['src' => '/app/icono-512.png', 'sizes' => '512x512', 'type' => 'image/png', 'purpose' => 'maskable']];
        header('Content-Type: application/manifest+json; charset=utf-8');
        header('Cache-Control: public, max-age=300');
        echo json_encode([
            'name' => $app === 'app' ? $m['nombre'] : $m['nombre'] . ' · Panel', 'short_name' => mb_substr($m['nombre'], 0, 12),
            'description' => $m['lema'] ?? '', 'lang' => $m['idioma'], 'start_url' => $base, 'scope' => $base,
            'display' => 'standalone', 'background_color' => $color, 'theme_color' => $color, 'icons' => $iconos,
        ] + ($app === 'app' ? ['orientation' => 'portrait'] : []), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    private function tipo(Peticion $req): string
    {
        $t = (string) $req->params['tipo'];
        if (!in_array($t, self::IMAGENES, true)) throw new ErrorApi('Imagen no válida: logo, logo_oscuro o icono', 404);
        return $t;
    }
}
