import { useMemo, useState } from 'react';
import { History, Pencil, SlidersHorizontal } from 'lucide-react';
import { api, formato } from '../api';
import { useSesion } from '../auth/Sesion';
import { Boton, Campo, Cargando, Chip, Encabezado, ErrorCaja, Modal, Pestanas, Tarjeta, useAvisos, useDatos } from '../ui';

// S-09 · Parámetros: valor vigente por sucursal, cambio con vigencia e historial
const GRUPOS = [
  { t: 'Asistencia', claves: ['minutos_retardo', 'retardos_por_falta', 'visitas_por_mes'] },
  { t: 'Exámenes y grados', claves: ['meses_minimos_grado', 'asistencia_minima_examen', 'dias_anticipacion_examen'] },
  { t: 'Cobranza', claves: ['dias_aviso_pago', 'dias_tolerancia_pago'] },
  { t: 'Seguridad', claves: ['minutos_inactividad_sesion', 'intentos_login'] },
];

function textoValor(p) {
  if (p.valor === null || p.valor === undefined) return '—';
  if (p.tipo_dato === 'porcentaje') return `${p.valor} %`;
  return p.unidad ? `${p.valor} ${p.unidad}` : p.valor;
}

export default function Parametros() {
  const { rol, tiene } = useSesion();
  const avisar = useAvisos();
  const global = rol?.alcance === 'global';
  const sucursales = useDatos(() => api.get('/sucursales'), []);
  const [suc, setSuc] = useState('');
  const sucursalVista = global ? suc : String(rol?.sucursal_id || '');
  const params = useDatos(() => api.get('/parametros', { sucursal_id: sucursalVista }), [sucursalVista]);
  const globales = useDatos(() => (global && suc ? api.get('/parametros') : Promise.resolve(null)), [global, suc]);

  const [editar, setEditar] = useState(null);
  const [valor, setValor] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [errorCampo, setErrorCampo] = useState('');
  const [historial, setHistorial] = useState(null);

  const valoresGlobales = useMemo(() => Object.fromEntries((globales.datos?.parametros || []).map((p) => [p.clave, p.valor])), [globales.datos]);
  const porClave = useMemo(() => Object.fromEntries((params.datos?.parametros || []).map((p) => [p.clave, p])), [params.datos]);
  const nombreSuc = (id) => sucursales.datos?.find((s) => String(s.id) === String(id))?.nombre;

  const abrir = (p) => { setEditar(p); setValor(p.valor ?? ''); setErrorCampo(''); };
  const guardar = async () => {
    setGuardando(true); setErrorCampo('');
    try {
      const r = await api.post('/parametros/valores', { clave: editar.clave, valor: String(valor).trim(), sucursal_id: suc || null });
      avisar(`${editar.descripcion}: ${r.anterior ?? '—'} → ${r.nuevo}`);
      setEditar(null); params.recargar(); globales.recargar();
    } catch (e) { setErrorCampo(e.message); } finally { setGuardando(false); }
  };
  const verHistorial = async (p) => {
    setHistorial({ p, filas: null });
    try { const d = await api.get('/parametros/historial', { clave: p.clave }); setHistorial({ p, filas: d.historial }); }
    catch (e) { avisar(e.message, 'error'); setHistorial(null); }
  };

  const opcionesSuc = [{ valor: '', etiqueta: 'Global' }, ...(sucursales.datos || []).map((s) => ({ valor: String(s.id), etiqueta: s.nombre }))];

  return (
    <>
      <Encabezado ruta="Configuración · Reglas del dojo" titulo="Parámetros"
        descripcion="Los valores que usa el sistema para retardos, exámenes y cobranza. Un cambio nunca borra el anterior: se cierra y queda en el historial." />

      {global ? (
        <Tarjeta className="mb-4" cuerpo="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="etiqueta">Ámbito</span>
            <Pestanas opciones={opcionesSuc} valor={suc} onCambio={setSuc} />
          </div>
          <p className="text-[13px] text-muted mt-3">
            {suc ? <>Viendo <b className="text-text">{nombreSuc(suc)}</b>. Un valor marcado como <Chip tono="accion">Ajustado</Chip> sustituye al global solo en esta sucursal.</>
              : 'Los valores globales aplican a todas las sucursales que no tengan uno propio.'}
          </p>
        </Tarjeta>
      ) : (
        <p className="text-sm text-muted mb-4">Valores vigentes en tu sucursal. Solo la dirección general puede cambiarlos.</p>
      )}

      <ErrorCaja error={params.error} reintentar={params.recargar} />
      {params.cargando && !params.datos ? <Cargando /> : (
        <div className="grid lg:grid-cols-2 gap-4">
          {GRUPOS.map((g) => (
            <Tarjeta key={g.t} titulo={g.t} icono={SlidersHorizontal} cuerpo="p-0">
              <ul className="divide-y divide-line">
                {g.claves.map((c) => porClave[c]).filter(Boolean).map((p) => {
                  const ajustado = global && suc && valoresGlobales[p.clave] !== undefined && valoresGlobales[p.clave] !== p.valor;
                  return (
                    <li key={p.clave} className="flex items-center gap-4 px-5 py-3.5">
                      <div className="flex-1 min-w-0">
                        <div className="text-[14px] font-medium">{p.descripcion}</div>
                        <div className="text-[12px] text-muted mt-0.5 flex flex-wrap items-center gap-2">
                          <span className="font-mono">{p.clave}</span>
                          {global && suc && (ajustado ? <Chip tono="accion">Ajustado · global {valoresGlobales[p.clave]}</Chip> : <Chip>Heredado del global</Chip>)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[17px] font-semibold whitespace-nowrap">{textoValor(p)}</div>
                      </div>
                      <div className="flex">
                        <Boton variante="fantasma" tam="sm" icono={History} onClick={() => verHistorial(p)} aria-label="Historial" />
                        {tiene('parametros.editar') && <Boton variante="secundario" tam="sm" icono={Pencil} onClick={() => abrir(p)}>Cambiar</Boton>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Tarjeta>
          ))}
        </div>
      )}

      <Modal abierto={!!editar} onCerrar={() => setEditar(null)} titulo={editar?.descripcion}
        subtitulo={suc ? `Solo para ${nombreSuc(suc)}` : 'Valor global (todas las sucursales)'}
        pie={<><Boton variante="secundario" onClick={() => setEditar(null)}>Cancelar</Boton><Boton cargando={guardando} onClick={guardar}>Guardar</Boton></>}>
        <div className="rounded-md bg-inset border border-line px-4 py-3 mb-4 text-sm">
          Valor actual: <b>{editar && textoValor(editar)}</b>
        </div>
        <Campo etiqueta={`Nuevo valor${editar?.unidad ? ` (${editar.unidad})` : ''}`} value={valor} onChange={(e) => setValor(e.target.value)}
          error={errorCampo} inputMode={editar?.tipo_dato === 'texto' ? 'text' : 'numeric'}
          ayuda={editar?.tipo_dato === 'texto' ? 'Varios valores separados por coma, p. ej. 3,1' : 'Número entero'}
          onKeyDown={(e) => e.key === 'Enter' && guardar()} />
        <p className="text-[13px] text-muted mt-4">El cambio aplica desde ahora. El valor anterior se cierra con la fecha de hoy y se registra en la bitácora.</p>
      </Modal>

      <Modal abierto={!!historial} onCerrar={() => setHistorial(null)} lateral titulo="Historial" subtitulo={historial?.p.descripcion}>
        {!historial?.filas ? <Cargando /> : (
          <ol className="relative border-l border-line ml-2 space-y-5">
            {historial.filas.map((h) => (
              <li key={h.id} className="pl-5 relative">
                <span className={`absolute -left-[5px] top-1.5 size-2.5 rounded-full ${h.vigente_hasta ? 'bg-line-strong' : 'bg-action'}`} />
                <div className="flex items-center gap-2">
                  <span className="text-[17px] font-semibold">{h.valor}</span>
                  {!h.vigente_hasta ? <Chip tono="ok">Vigente</Chip> : <Chip>Cerrado</Chip>}
                  <span className="text-[13px] text-muted">{h.sucursal || 'Global'}</span>
                </div>
                <div className="text-[13px] text-muted mt-0.5">
                  {formato.fechaHora(h.vigente_desde)} → {h.vigente_hasta ? formato.fechaHora(h.vigente_hasta) : 'hoy'} · {h.modificado_por}
                </div>
              </li>
            ))}
          </ol>
        )}
      </Modal>
    </>
  );
}
