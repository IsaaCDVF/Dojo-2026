import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, BellOff, CheckCheck, Clock, History, MessageCircle, Search, Smartphone, Undo2 } from 'lucide-react';
import { api } from '../api';
import { useMarca } from '../marca/Marca';
import { Campo, Cargando, Chip, ErrorCaja, Selector, Tarjeta, Vacio, useAvisos, useDatos } from '../ui';
import { EVENTOS, ligaWhatsApp } from './Avisos';

// Historial de avisos: a quién se le avisó, de qué alumno, y cómo le llegó por cada camino
// (la app sale sola; el WhatsApp lo manda recepción o el admin con un toque). También va en la ficha del alumno.

const cx = (...c) => c.filter(Boolean).join(' ');
const hora = (f) => (f ? new Date(f.replace(' ', 'T')).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' }) : '');
export const cuando = (f) => {
  if (!f) return '';
  const d = new Date(f.replace(' ', 'T'));
  const hoy = new Date(); const ayer = new Date(Date.now() - 864e5);
  if (d.toDateString() === hoy.toDateString()) return `hoy ${hora(f)}`;
  if (d.toDateString() === ayer.toDateString()) return `ayer ${hora(f)}`;
  return `${d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })} ${hora(f)}`;
};
const YA_NO = { pago_por_vencer: 'ya pagó', pago_vencido: 'ya pagó', ausencia: 'ya vino a clase', examen_autorizado: 'el examen cambió' };
const TONO = { ok: 'text-ok', aviso: 'text-warn', mal: 'text-danger', nada: 'text-muted' };

/** Cómo le fue en la app → [tono, ícono, texto] */
function estadoApp(g) {
  const a = g.app;
  if (!a) return ['nada', BellOff, g.con_app ? 'App: no aplica' : 'App: no tiene la app'];
  const leido = a.leida ? ` · leído ${cuando(a.leida)}` : ' · sin leer';
  if (a.estado === 'programada') return ['nada', Clock, 'App: por salir'];
  if (a.estado === 'enviada') return ['ok', Smartphone, `App: llegó al celular ${cuando(a.fecha)}${leido}`];
  if (a.motivo === 'ya_no_aplica') return ['nada', BellOff, `App: no se mandó (${YA_NO[g.evento] || 'ya no aplicaba'})`];
  if (a.estado === 'fallida') return ['aviso', Bell, `App: no llegó al celular, quedó en la campanita${leido}`];
  return [a.leida ? 'ok' : 'nada', Bell, `App: solo en la campanita (no activó notificaciones)${leido}`];
}

/** Cómo le fue en WhatsApp → [tono, texto] */
function estadoWa(g) {
  const w = g.whatsapp;
  if (!w) return ['nada', g.es_alumno ? 'WhatsApp: va a quien paga' : 'WhatsApp: no tiene teléfono'];
  if (w.estado === 'programada') return ['aviso', 'WhatsApp: por mandar'];
  if (w.estado === 'enviada') return ['ok', `WhatsApp: lo mandó ${w.quien || 'recepción'} ${cuando(w.fecha)}`];
  if (w.motivo === 'recepcion') return ['nada', `WhatsApp: ${w.quien || 'recepción'} decidió no mandarlo`];
  if (w.motivo === 'vencido') return ['mal', 'WhatsApp: nadie lo mandó en 7 días'];
  return ['nada', `WhatsApp: no se mandó (${YA_NO[g.evento] || 'ya no aplicaba'})`];
}

function Fila({ g, compacta, onCambio }) {
  const avisar = useAvisos();
  const { marca } = useMarca();
  const [ocupado, setOcupado] = useState(false);
  const ev = EVENTOS[g.evento] || { t: g.evento, tono: 'info' };
  const [ta, IA, xa] = estadoApp(g);
  const [tw, xw] = estadoWa(g);
  const w = g.whatsapp;
  const marcar = async (estado, texto) => {
    setOcupado(true);
    try { await api.put(`/avisos/${w.id}`, { estado }); avisar(texto, 'info'); onCambio?.(); }
    catch (e) { avisar(e.message, 'error'); } finally { setOcupado(false); }
  };
  return (
    <li className={cx('px-5', compacta ? 'py-3' : 'py-3.5')}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-medium">{g.persona}</span>
        <Chip tono={ev.tono === 'peligro' ? 'peligro' : ev.tono === 'aviso' ? 'aviso' : ev.tono === 'ok' ? 'ok' : 'info'}>{ev.t}</Chip>
        <span className="text-[12px] text-muted">
          {g.alumnos?.length > 0 && !g.es_alumno ? `por ${g.alumnos.join(', ')} · ` : g.es_alumno ? 'al alumno · ' : ''}{cuando(g.fecha)}{!compacta && g.sucursal ? ` · ${g.sucursal}` : ''}
        </span>
        {!compacta && g.alumno_id && <Link to={`/alumnos/${g.alumno_id}`} className="text-[12px] text-muted underline hover:text-text">Ver alumno</Link>}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1 mt-1.5 text-[13px]">
        <span className={cx('inline-flex items-center gap-1.5', TONO[ta])}><IA className="size-3.5 shrink-0" />{xa}</span>
        <span className={cx('inline-flex items-center gap-1.5', TONO[tw])}>
          <MessageCircle className="size-3.5 shrink-0" />{xw}
          {w?.estado === 'programada' && onCambio && (
            <button disabled={ocupado} className="ml-1 underline font-medium cursor-pointer"
              onClick={() => { window.open(ligaWhatsApp(w.telefono, w.mensaje, marca?.pais), '_blank', 'noopener'); marcar('enviada', `${g.persona} queda como avisado por WhatsApp`); }}>Mandar ahora</button>
          )}
          {w?.estado === 'enviada' && onCambio && !compacta && (
            <button disabled={ocupado} title="Si al final no se mandó" className="ml-1 inline-flex items-center gap-0.5 text-muted hover:text-text cursor-pointer"
              onClick={() => marcar('programada', 'Regresó a "Por mandar"')}><Undo2 className="size-3" />deshacer</button>
          )}
        </span>
      </div>
      {!compacta && g.resumen && <p className="text-[13px] text-muted mt-1 line-clamp-1" title={g.resumen}>{g.resumen}</p>}
    </li>
  );
}

export function Historial({ sucursal }) {
  const [texto, setTexto] = useState('');
  const [buscar, setBuscar] = useState('');
  const [dias, setDias] = useState('7');
  const [evento, setEvento] = useState('');
  useEffect(() => { const t = setTimeout(() => setBuscar(texto.trim()), 300); return () => clearTimeout(t); }, [texto]);
  const d = useDatos(() => api.get('/avisos/historial', { dias, buscar, evento, sucursal_id: sucursal }), [dias, buscar, evento, sucursal]);
  const r = d.datos?.resumen;
  const lista = d.datos?.avisos || [];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Campo icono={Search} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar persona o alumno" className="flex-1 min-w-[220px]" type="search" />
        <Selector value={evento} onChange={(e) => setEvento(e.target.value)} className="w-48" aria-label="Tipo de aviso">
          <option value="">Todos los avisos</option>
          {Object.entries(EVENTOS).map(([k, e]) => <option key={k} value={k}>{e.t}</option>)}
        </Selector>
        <Selector value={dias} onChange={(e) => setDias(e.target.value)} className="w-40" aria-label="Periodo">
          <option value="1">Hoy</option><option value="7">Últimos 7 días</option><option value="30">Últimos 30 días</option><option value="90">Últimos 90 días</option>
        </Selector>
      </div>
      {r && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[['Avisos', r.avisos], ['Llegaron al celular', r.llegaron_celular], ['Leídos en la app', r.leidos], ['WhatsApp mandados', r.whatsapp_mandados]].map(([t, n]) => (
            <div key={t} className="rounded-[10px] bg-inset px-4 py-3"><div className="text-[13px] text-muted">{t}</div><div className="text-[24px] font-semibold">{n}</div></div>
          ))}
        </div>
      )}
      <Tarjeta cuerpo="p-0" titulo="Historial" icono={History}
        subtitulo={r?.whatsapp_por_mandar ? `${r.whatsapp_por_mandar} WhatsApp siguen por mandar` : 'La app avisa sola; el WhatsApp lo manda recepción o el admin con un toque'}>
        <div className="px-5 pt-3"><ErrorCaja error={d.error} reintentar={d.recargar} /></div>
        {d.cargando && !d.datos ? <Cargando /> : !lista.length ? (
          <Vacio icono={History} titulo={buscar ? 'Nadie coincide' : 'Sin avisos en estas fechas'} texto={buscar ? 'Prueba con otro nombre o más días.' : 'Cuando el sistema avise de pagos, faltas o exámenes, aparece aquí.'} />
        ) : <ul className="divide-y divide-line">{lista.map((g) => <Fila key={g.clave} g={g} onCambio={d.recargar} />)}</ul>}
      </Tarjeta>
    </div>
  );
}

/** En la ficha del alumno: sus avisos y los de quien paga por él (últimos 60 días) */
export function AvisosAlumno({ alumnoId, puedeMandar }) {
  const d = useDatos(() => api.get('/avisos/historial', { alumno_id: alumnoId, dias: 60 }), [alumnoId]);
  const lista = d.datos?.avisos || [];
  return (
    <Tarjeta titulo="Avisos" icono={CheckCheck} cuerpo="p-0" subtitulo="Lo que se le avisó a él y a quien paga, y cómo le llegó (60 días)">
      <div className="px-5 pt-3"><ErrorCaja error={d.error} reintentar={d.recargar} /></div>
      {d.cargando && !d.datos ? <Cargando /> : !lista.length
        ? <p className="px-5 pb-4 pt-1 text-[13px] text-muted">No se le ha mandado ningún aviso.</p>
        : <ul className="divide-y divide-line">{lista.slice(0, 8).map((g) => <Fila key={g.clave} g={g} compacta onCambio={puedeMandar ? d.recargar : undefined} />)}</ul>}
      {lista.length > 8 && <p className="px-5 py-2.5 border-t border-line text-[13px] text-muted">Y {lista.length - 8} más en <Link to="/avisos?vista=historial" className="underline">Avisos → Historial</Link>.</p>}
    </Tarjeta>
  );
}
