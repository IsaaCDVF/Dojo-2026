<?php
declare(strict_types=1);
namespace Dojo\Modulos\Catalogos;

use Dojo\Nucleo\{Db, ErrorApi, Parametros, Peticion, Respuesta};
use Dojo\Nucleo\Middleware\Permiso;
use Dojo\Modulos\Bitacora\Bitacora;
final class ParametroControlador
{
    /** GET /api/parametros — valor que aplica hoy en la sucursal del rol activo. */
    public function vigentes(Peticion $req): void
    {
        $s = Permiso::sucursalDe($req) ?? (isset($req->query['sucursal_id']) ? (int) $req->query['sucursal_id'] : null);
        $lista = Db::todos('SELECT clave, descripcion, tipo_dato, unidad FROM parametros ORDER BY clave');
        foreach ($lista as &$p) $p['valor'] = Parametros::valor($p['clave'], $s);
        Respuesta::ok(['sucursal_id' => $s, 'parametros' => $lista]);
    }

    private function validarValor(string $tipo, string $valor): void 
    {
       $valido= match ($tipo) {
         'entero', 'minutos', 'dias' => ctype_digit($valor),
        'porcentaje'=> ctype_digit($valor) && (int)$valor <=100,
        'decimal'   => is_numeric($valor) && (float)$valor >= 0,
        'texto'     => trim($valor) !== '',
        default     => false,
       };
       if(!$valido){
         throw new ErrorApi("El valor '$valor' no es valido para un parametro de tipo $tipo", 422); 
       }
    }
    public function guardarValor(Peticion $req): void 
    {
        $d = $req->requeridos('clave', 'valor');
        $valor=(string) $d['valor'];
        $sucursal =$req->cuerpo['sucursal_id'] ?? null;
        $parametro = Db::uno('SELECT * FROM parametros WHERE clave = ?', [$d['clave']]);
        $disciplina = $req->cuerpo['disciplina_id'] ?? null;
        if(!$parametro){
            throw new ErrorApi("Parametro no encontrado", 404);
        }   
        $grado = $req->cuerpo['grado_id'] ?? null;
        $this->validarValor($parametro['tipo_dato'], $valor);
        $resultado = Db::transaccion(function () use ($req, $parametro, $valor, $sucursal, $disciplina, $grado) {

        
        $anterior = Db::uno(
            'SELECT id, valor FROM parametro_valores
            WHERE parametro_id = ? AND sucursal_id <=> ? AND disciplina_id <=> ? AND grado_id <=> ?
            AND vigente_hasta IS NULL',
            [$parametro['id'], $sucursal, $disciplina, $grado]);

        
        if ($anterior) {
            Db::ejecutar('UPDATE parametro_valores SET vigente_hasta = NOW() WHERE id = ?', [$anterior['id']]);
        } 
        
        $nuevoId = Db::insertar(
        'INSERT INTO parametro_valores
        (parametro_id, sucursal_id, disciplina_id, grado_id, valor, vigente_desde, modificado_por)
        VALUES (?, ?, ?, ?, ?, NOW(), ?)',
        [$parametro['id'], $sucursal, $disciplina, $grado, $valor, $req->ctx['usuario_id']]);
        
        if ($anterior) {
            Bitacora::cambio($req, 'parametro_valores', $nuevoId,
                ['valor' => $anterior['valor']], ['valor' => $valor], $sucursal);
        } else {
            Bitacora::alta($req, 'parametro_valores', $nuevoId, ['valor' => $valor], $sucursal);
        }
        
        return ['id' => $nuevoId, 'anterior' => $anterior['valor'] ?? null, 'nuevo' => $valor];
        });

        Respuesta::ok($resultado, 201);
        }

        
}
