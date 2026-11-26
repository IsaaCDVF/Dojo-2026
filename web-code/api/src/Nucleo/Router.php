<?php
declare(strict_types=1);
namespace Dojo\Nucleo;

use Dojo\Nucleo\Middleware\{Autenticacion, Permiso};

/**
 * Enrutador mínimo. Orden de cada petición:
 *   ruta -> Autenticacion (si la ruta no es pública) -> Permiso -> controlador
 */
final class Router
{
    private array $rutas = [];

    public function get(string $p, array $h, ?string $permiso): void  { $this->agregar('GET', $p, $h, $permiso); }
    public function post(string $p, array $h, ?string $permiso): void { $this->agregar('POST', $p, $h, $permiso); }
    public function put(string $p, array $h, ?string $permiso): void  { $this->agregar('PUT', $p, $h, $permiso); }
    public function delete(string $p, array $h, ?string $permiso): void { $this->agregar('DELETE', $p, $h, $permiso); }

    private function agregar(string $m, string $patron, array $h, ?string $permiso): void
    {
        // {id} = número; {tipo:texto} = palabra en minúsculas (logo, logo_oscuro, app…)
        $regex = '#^' . preg_replace(['#\{(\w+):texto\}#', '#\{(\w+)\}#'], ['(?P<$1>[a-z_]+)', '(?P<$1>[0-9]+)'], $patron) . '$#';
        $this->rutas[] = compact('m', 'regex', 'h', 'permiso');
    }

    public function despachar(Peticion $req): void
    {
        $metodoValido = false;
        foreach ($this->rutas as $r) {
            if (!preg_match($r['regex'], $req->ruta, $mm)) continue;
            $metodoValido = true;
            if ($r['m'] !== $req->metodo) continue;
            $req->params = array_map(fn($v) => ctype_digit($v) ? (int) $v : $v, array_filter($mm, 'is_string', ARRAY_FILTER_USE_KEY));
            if ($r['permiso'] !== null) {
                Autenticacion::verificar($req);
                if ($r['permiso'] !== '') Permiso::exigir($req, $r['permiso']);
            }
            [$clase, $metodo] = $r['h'];
            (new $clase())->$metodo($req);
            return;
        }
        throw new ErrorApi($metodoValido ? 'Método no permitido' : 'Ruta no encontrada', $metodoValido ? 405 : 404);
    }
}
