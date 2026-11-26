<?php
declare(strict_types=1);
namespace Dojo\Modulos\Sistema;

use Dojo\Nucleo\{Db, ErrorApi, Peticion, Respuesta};

/** Preferencias de cada usuario: idioma (o el de la empresa), tema claro/oscuro/sistema y tamaño de letra */
final class PreferenciasControlador
{
    private const TEMAS = ['sistema', 'claro', 'oscuro'];
    private const LETRAS = ['normal', 'grande', 'muy_grande'];

    public static function de(int $usuarioId): array
    {
        return Db::uno('SELECT idioma, tema, letra FROM usuario_preferencias WHERE usuario_id = ?', [$usuarioId])
            ?? ['idioma' => null, 'tema' => 'sistema', 'letra' => 'normal'];
    }

    /** GET /api/preferencias */
    public function ver(Peticion $req): void
    {
        Respuesta::ok(self::de((int) $req->ctx['usuario_id']));
    }

    /** PUT /api/preferencias {idioma?, tema?, letra?} */
    public function guardar(Peticion $req): void
    {
        $uid = (int) $req->ctx['usuario_id'];
        $p = self::de($uid);
        $c = $req->cuerpo;
        if (array_key_exists('idioma', $c)) {
            if ($c['idioma'] !== null && !in_array($c['idioma'], MarcaControlador::IDIOMAS, true)) throw new ErrorApi('Ese idioma no está disponible', 422, ['campo' => 'idioma']);
            $p['idioma'] = $c['idioma'];
        }
        if (array_key_exists('tema', $c)) {
            if (!in_array($c['tema'], self::TEMAS, true)) throw new ErrorApi('Tema no válido', 422, ['campo' => 'tema']);
            $p['tema'] = $c['tema'];
        }
        if (array_key_exists('letra', $c)) {
            if (!in_array($c['letra'], self::LETRAS, true)) throw new ErrorApi('Tamaño de letra no válido', 422, ['campo' => 'letra']);
            $p['letra'] = $c['letra'];
        }
        Db::ejecutar('INSERT INTO usuario_preferencias (usuario_id, idioma, tema, letra) VALUES (?, ?, ?, ?)
                      ON DUPLICATE KEY UPDATE idioma = VALUES(idioma), tema = VALUES(tema), letra = VALUES(letra)', [$uid, $p['idioma'], $p['tema'], $p['letra']]);
        Respuesta::ok($p);
    }
}
