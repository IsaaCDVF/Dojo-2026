import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Historial } from './HistorialAvisos';
import { Link } from 'react-router-dom';
import { BellRing, CalendarClock, CalendarX2, Check, EyeOff, Medal, MessageCircle, Pencil, RefreshCw, Undo2, UserRoundX } from 'lucide-react';
import { api } from '../api';
import { useSesion } from '../auth/Sesion';
import { useMarca } from '../marca/Marca';
import { AreaTexto, Boton, Campo, Cargando, Chip, Encabezado, ErrorCaja, Modal, Pestanas, Selector, Tarjeta, Vacio, useAvisos, useDatos } from '../ui';

// Avisos automáticos. El sistema los arma solo (pagos, faltas, exámenes); recepción los manda por
// WhatsApp con un toque: se abre su WhatsApp con el mensaje ya escrito y solo le da "Enviar".

const cx = (...c) => c.filter(Boolean).join(' ');
export const EVENTOS = {
  pago_vencido: { t: 'Pago vencido', i: CalendarX2, tono: 'peligro' },
  pago_por_vencer: { t: 'Pago por vencer', i: CalendarClock, tono: 'aviso' },
  examen_autorizado: { t: 'Examen autorizado', i: Medal, tono: 'ok' },
  ausencia: { t: 'Días sin venir', i: UserRoundX, tono: 'info' },
};
const LADA = { MX: '52', US: '1', CA: '1', CO: '57', AR: '54', CL: '56', PE: '51', ES: '34', GT: '502', CR: '506', EC: '593', VE: '58', UY: '598', BO: '591', PY: '595', DO: '1', SV: '503', HN: '504', NI: '505', PA: '507' };
const VARIABLES = '{nombre} {alumno} {periodo} {monto} {fecha} {dias} {grado} {sucursal} {dojo}';

export const ligaWhatsApp = (tel, texto, pais = 'MX') => {
  const n = String(tel || '').replace(/\D/g, '');
  const lada = LADA[pais] || '52';
  return `https://wa.me/${n.length > 10 ? n : lada + n}?text=${encodeURIComponent(texto)}`;
};
const cuando = (f) => {
  if (!f) return '';
  const d = new Date(f.replace(' ', 'T'));
  const hoy = new Date(); const ayer = new Date(Date.now() - 864e5);
  const h = d.toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' });
  if (d.toDateString() === hoy.toDateString()) return `Hoy ${h}`;
  if (d.toDateString() === ayer.toDateString()) return `Ayer ${h}`;
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) + ' ' + h;
};

function Fila({ a, pais, vista, onCambio }) {
  const avisar = useAvisos();
  const [abierto, setAbierto] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const ev = EVENTOS[a.evento] || { t: a.evento, i: BellRing, tono: 'info' };
  const marcar = async (estado, texto) => {
    setOcupado(true);
    try { await api.put(`/avisos/${a.id}`, { estado }); if (texto) avisar(texto, 'info'); onCambio(); }
    catch (e) { avisar(e.message, 'error'); } finally { setOcupado(false); }
  };
  const mandar = () => {
    window.open(ligaWhatsApp(a.telefono, a.mensaje, pais), '_blank', 'noopener');
    marcar('enviada', `Listo: ${a.persona} queda como avisado. Si no se mandó, deshazlo en "Historial".`);
  };
  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <span className={cx('grid place-items-center size-10 rounded-full shrink-0',
          { peligro: 'bg-danger-bg text-danger', aviso: 'bg-warn-bg text-warn', ok: 'bg-ok-bg text-ok', info: 'bg-inset text-action' }[ev.tono])}><ev.i className="size-5" /></span>
        <div className="flex-1 min-w-[220px]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{a.persona}</span>
            <Chip tono={ev.tono === 'peligro' ? 'peligro' : ev.tono === 'aviso' ? 'aviso' : ev.tono === 'ok' ? 'ok' : 'info'}>{ev.t}</Chip>
            {a.sucursal && <span className="text-[12px] text-muted">{a.sucursal}</span>}
          </div>
          <div className="text-[12px] text-muted mt-0.5">
            WhatsApp {String(a.telefono || '').replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3')} · {vista === 'pendientes' ? cuando(a.fecha_programada) : `${a.estado === 'enviada' ? 'Enviado' : 'No se mandó'} ${cuando(a.fecha_envio)}${a.enviada_por ? ' por ' + a.enviada_por : ''}`}
            {a.alumno_id && <> · <Link to={`/alumnos/${a.alumno_id}`} className="underline hover:text-text">Ver alumno</Link></>}
          </div>
          <button onClick={() => setAbierto(!abierto)} className={cx('mt-2 text-left text-[14px] text-text/85 cursor-pointer hover:text-text', !abierto && 'line-clamp-2')} title={abierto ? 'Ocultar' : 'Ver el mensaje completo'}>
            {a.mensaje}
          </button>
        </div>
        <div className="flex gap-1.5 items-center">
          {vista === 'pendientes' ? (<>
            <Boton icono={MessageCircle} onClick={mandar} disabled={ocupado} className="!bg-[#25D366] !text-[#0b2e17] hover:!brightness-95">WhatsApp</Boton>
            <Boton variante="fantasma" tam="sm" icono={EyeOff} onClick={() => marcar('omitida', 'No se manda')} disabled={ocupado} title="Ya se le avisó de otra forma o no aplica">No mandar</Boton>
          </>) : (
            <Boton variante="fantasma" tam="sm" icono={Undo2} onClick={() => marcar('programada', 'Regresó a pendientes')} disabled={ocupado}>A pendientes</Boton>
          )}
        </div>
      </div>
    </li>
  );
}

function Textos({ abierto, onCerrar }) {
  const avisar = useAvisos();
  const d = useDatos(() => (abierto ? api.get('/avisos/plantillas') : Promise.resolve(null)), [abierto]);
  const [edit, setEdit] = useState({});
  const [guardando, setGuardando] = useState(null);
  const lista = d.datos?.plantillas || [];
  const valor = (p, k) => (edit[p.id]?.[k] ?? p[k]);
  const poner = (p, k, v) => setEdit({ ...edit, [p.id]: { ...edit[p.id], [k]: v } });
  const guardar = async (p, extra) => {
    setGuardando(p.id);
    try { await api.put(`/avisos/plantillas/${p.id}`, extra || edit[p.id]); avisar('Aviso guardado'); setEdit((e) => { const n = { ...e }; delete n[p.id]; return n; }); d.recargar(); }
    catch (e) { avisar(e.message, 'error'); } finally { setGuardando(null); }
  };
  const par = d.datos?.parametros || {};
  return (
    <Modal abierto={abierto} onCerrar={onCerrar} lateral ancho="max-w-2xl" titulo="Textos de los avisos"
      subtitulo={`Puedes usar: ${VARIABLES}`} pie={<Boton variante="secundario" onClick={onCerrar}>Cerrar</Boton>}>
      {d.cargando && !d.datos ? <Cargando /> : (
        <div className="space-y-6">
          <p className="text-[13px] text-muted">
            Pago por vencer: {par.dias_aviso_pago || '3,1'} días antes · Días sin venir: {Number(par.dias_sin_asistir) > 0 ? `${par.dias_sin_asistir} días` : 'apagado'} · Celulares con notificaciones: {d.datos?.celulares_con_notificaciones ?? 0}.{' '}
            <Link to="/parametros" className="underline">Cambiar los días en Parámetros</Link>
          </p>
          {Object.entries(EVENTOS).map(([ev, info]) => (
            <section key={ev} className="space-y-3">
              <h3 className="flex items-center gap-2 font-semibold"><info.i className="size-4 text-muted" />{info.t}</h3>
              {lista.filter((p) => p.evento === ev).map((p) => {
                const cambiado = !!edit[p.id];
                return (
                  <div key={p.id} className={cx('rounded-[10px] border border-line p-3.5 space-y-2.5', !p.activa && 'opacity-60')}>
                    <div className="flex items-center gap-2">
                      <span className="etiqueta flex-1">{p.canal === 'app' ? 'Notificación en la app' : 'WhatsApp desde recepción'}</span>
                      <label className="inline-flex items-center gap-2 text-[13px] cursor-pointer">
                        <input type="checkbox" checked={p.activa} onChange={(e) => guardar(p, { activa: e.target.checked })} className="accent-[var(--action)] size-4" />
                        {p.activa ? 'Encendido' : 'Apagado'}
                      </label>
                    </div>
                    {p.canal === 'app' && <Campo etiqueta="Título" value={valor(p, 'titulo') || ''} maxLength={80} onChange={(e) => poner(p, 'titulo', e.target.value)} />}
                    <AreaTexto etiqueta="Mensaje" rows={p.canal === 'app' ? 2 : 3} value={valor(p, 'cuerpo')} maxLength={p.canal === 'app' ? 300 : 900} onChange={(e) => poner(p, 'cuerpo', e.target.value)} />
                    {cambiado && <div className="flex justify-end gap-2">
                      <Boton variante="fantasma" tam="sm" onClick={() => setEdit((e) => { const n = { ...e }; delete n[p.id]; return n; })}>Descartar</Boton>
                      <Boton tam="sm" icono={Check} cargando={guardando === p.id} onClick={() => guardar(p)}>Guardar</Boton>
                    </div>}
                  </div>
                );
              })}
            </section>
          ))}
          <ErrorCaja error={d.error} reintentar={d.recargar} />
        </div>
      )}
    </Modal>
  );
}

export default function Avisos() {
  const { rol, tiene } = useSesion();
  const { marca } = useMarca();
  const avisar = useAvisos();
  const global = rol?.alcance === 'global';
  const [params, setParams] = useSearchParams();
  const vista = params.get('vista') === 'historial' ? 'historial' : 'pendientes';
  const setVista = (v) => setParams(v === 'historial' ? { vista: 'historial' } : {});
  const [filtro, setFiltro] = useState('');
  const [suc, setSuc] = useState('');
  const [textos, setTextos] = useState(false);
  const [revisando, setRevisando] = useState(false);
  const sucursales = useDatos(() => (global ? api.get('/sucursales') : Promise.resolve([])), [global]);
  const d = useDatos(() => api.get('/avisos', { vista: 'pendientes', sucursal_id: suc }), [suc]);
  const lista = (d.datos?.avisos || []).filter((a) => !filtro || a.evento === filtro);
  const conteo = d.datos?.conteo || {};
  const total = Object.values(conteo).reduce((s, n) => s + n, 0);

  const revisar = async () => {
    setRevisando(true);
    try {
      const r = await api.post('/avisos/revisar');
      const nuevos = ['pago_por_vencer', 'pago_vencido', 'ausencia', 'examen_autorizado'].reduce((s, k) => s + (r[k] || 0), 0);
      avisar(r.ocupado ? 'Ya se está revisando, intenta en un momento' : nuevos ? `${nuevos} aviso${nuevos === 1 ? '' : 's'} nuevo${nuevos === 1 ? '' : 's'}` : 'No hay avisos nuevos', r.ocupado ? 'aviso' : 'ok');
      d.recargar();
    } catch (e) { avisar(e.message, 'error'); } finally { setRevisando(false); }
  };

  return (
    <>
      <Encabezado ruta="Recepción" titulo="Avisos"
        descripcion="El sistema arma solo los avisos de pagos, faltas y exámenes y le llegan solos a quien tiene la app. El WhatsApp lo mandas tú con un toque: se abre tu WhatsApp con el mensaje escrito y solo das Enviar. En Historial ves a quién se le avisó y cómo le llegó."
        acciones={<>
          {tiene('avisos.configurar') && <Boton variante="secundario" icono={Pencil} onClick={() => setTextos(true)}>Textos</Boton>}
          <Boton variante="secundario" icono={RefreshCw} cargando={revisando} onClick={revisar}>Revisar ahora</Boton>
        </>} />

      <div className="flex flex-wrap items-end gap-3 mb-4">
        <Pestanas valor={vista} onCambio={(v) => { setVista(v); setFiltro(''); }}
          opciones={[{ valor: 'pendientes', etiqueta: 'Por mandar', cuenta: total }, { valor: 'historial', etiqueta: 'Historial' }]} />
        {global && (
          <Selector etiqueta="Sucursal" value={suc} onChange={(e) => setSuc(e.target.value)} className="w-56">
            <option value="">Todas</option>
            {(sucursales.datos || []).map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </Selector>
        )}
      </div>

{vista === 'historial' ? <Historial sucursal={suc} /> : <>
      {vista === 'pendientes' && total > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {Object.entries(EVENTOS).filter(([k]) => conteo[k]).map(([k, e]) => (
            <button key={k} onClick={() => setFiltro(filtro === k ? '' : k)}
              className={cx('inline-flex items-center gap-2 h-9 px-3.5 rounded-full border text-[13px] font-semibold cursor-pointer transition-colors',
                filtro === k ? 'border-action bg-action/10 text-action' : 'border-line bg-surface text-muted hover:text-text')}>
              <e.i className="size-4" />{e.t}<span className="opacity-70">{conteo[k]}</span>
            </button>
          ))}
        </div>
      )}

      <Tarjeta cuerpo="p-0" titulo="Por mandar" icono={MessageCircle}
        subtitulo={d.datos?.ultima_revision ? `Última revisión: ${cuando(d.datos.ultima_revision)}. Se revisa sola cada hora de 8:00 a 21:00 mientras alguien usa el sistema.` : 'Todavía no se revisa'}>
        <div className="px-5 pt-3"><ErrorCaja error={d.error} reintentar={d.recargar} /></div>
        {d.cargando && !d.datos ? <Cargando /> : !lista.length ? (
          <Vacio icono={Check} titulo="Nada por mandar" texto="Cuando alguien tenga un pago por vencer o vencido, lleve días sin venir o le autoricen su examen, aparece aquí. Lo que ya se avisó está en Historial." />
        ) : (
          <ul className="divide-y divide-line">
            {lista.map((a) => <Fila key={a.id} a={a} vista="pendientes" pais={marca?.pais} onCambio={d.recargar} />)}
          </ul>
        )}
      </Tarjeta>
      </>}
      <Textos abierto={textos} onCerrar={() => setTextos(false)} />
    </>
  );
}
