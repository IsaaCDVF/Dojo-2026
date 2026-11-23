import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Clock, Plus, Power, Users } from 'lucide-react';
import { api, DIAS } from '../api';
import { useSesion } from '../auth/Sesion';
import { Boton, Campo, Cargando, Chip, Encabezado, ErrorCaja, FotoAlumno, Modal, Pestanas, Selector, Tarjeta, Vacio, useAvisos, useConfirmar, useDatos } from '../ui';

// S-06 · Horarios de la semana por sucursal (tarea 2.1)
const TONOS = ['#34e8bb', '#f2a900', '#a95af8', '#3b82f6', '#fb9ce5', '#22c55e', '#fb923c'];

function Ocupacion({ inscritos, cupo }) {
  if (!cupo) return <span className="text-[12px] text-muted">{inscritos} inscritos · sin cupo</span>;
  const pct = Math.min(100, Math.round((inscritos / cupo) * 100));
  const color = pct >= 100 ? 'bg-danger' : pct >= 85 ? 'bg-warn' : 'bg-action';
  return (
    <div>
      <div className="flex justify-between text-[12px] text-muted mb-1"><span>{inscritos} de {cupo}</span><span>{pct} %</span></div>
      <div className="h-1.5 rounded-full bg-inset overflow-hidden"><div className={`h-full ${color}`} style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

function FormHorario({ sucursal, disciplinas, onCerrar, onCreado }) {
  const avisar = useAvisos();
  const [f, setF] = useState({ disciplina_id: disciplinas[0]?.id || '', instructor_id: '', dia_semana: 1, hora_inicio: '17:00', hora_fin: '18:00', nivel: '', grado_desde_id: '', grado_hasta_id: '', cupo: '' });
  const instructores = useDatos(() => api.get('/instructores', { sucursal_id: sucursal }), [sucursal]);
  const grados = useDatos(() => (f.disciplina_id ? api.get(`/disciplinas/${f.disciplina_id}/grados`) : Promise.resolve([])), [f.disciplina_id]);
  const [err, setErr] = useState('');
  const [guardando, setGuardando] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const guardar = async () => {
    setGuardando(true); setErr('');
    try {
      await api.post('/horarios', { ...f, sucursal_id: sucursal, instructor_id: f.instructor_id || instructores.datos?.[0]?.id });
      avisar(`Clase del ${DIAS[f.dia_semana].toLowerCase()} ${f.hora_inicio} agregada`); onCreado();
    } catch (e) { setErr(e.message); } finally { setGuardando(false); }
  };
  return (
    <Modal abierto onCerrar={onCerrar} lateral titulo="Nueva clase" subtitulo="Se repite cada semana en el día y la hora que elijas"
      pie={<><Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton><Boton cargando={guardando} onClick={guardar}>Guardar clase</Boton></>}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Selector etiqueta="Disciplina" value={f.disciplina_id} onChange={(e) => setF({ ...f, disciplina_id: e.target.value, grado_desde_id: '', grado_hasta_id: '' })}>
            {disciplinas.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
          </Selector>
          <Selector etiqueta="Instructor" value={f.instructor_id} onChange={set('instructor_id')}>
            {(instructores.datos || []).map((i) => <option key={i.id} value={i.id}>{i.nombre}</option>)}
            {!instructores.datos?.length && <option value="">Sin instructores en la sucursal</option>}
          </Selector>
        </div>
        <div>
          <span className="etiqueta block mb-1.5">Día</span>
          <div className="grid grid-cols-7 gap-1">
            {DIAS.slice(1).map((d, i) => (
              <button key={d} type="button" onClick={() => setF({ ...f, dia_semana: i + 1 })}
                className={`h-10 rounded-md text-[13px] font-semibold border cursor-pointer ${f.dia_semana === i + 1 ? 'bg-action text-on-action border-action' : 'bg-inset border-line text-soft hover:border-line-strong'}`}>{d.slice(0, 3)}</button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Inicio" type="time" value={f.hora_inicio} onChange={set('hora_inicio')} />
          <Campo etiqueta="Fin" type="time" value={f.hora_fin} onChange={set('hora_fin')} />
        </div>
        <Campo etiqueta="Nivel (lo ve el alumno en la tableta)" value={f.nivel} onChange={set('nivel')} placeholder="Infantil principiantes" />
        <div className="grid grid-cols-2 gap-3">
          <Selector etiqueta="Desde el grado" value={f.grado_desde_id} onChange={set('grado_desde_id')}>
            <option value="">El primero</option>
            {(grados.datos || []).map((g) => <option key={g.id} value={g.id}>{g.nombre} · {g.color_cinta}</option>)}
          </Selector>
          <Selector etiqueta="Hasta el grado" value={f.grado_hasta_id} onChange={set('grado_hasta_id')}>
            <option value="">El último</option>
            {(grados.datos || []).map((g) => <option key={g.id} value={g.id}>{g.nombre} · {g.color_cinta}</option>)}
          </Selector>
        </div>
        <Campo etiqueta="Cupo (opcional)" inputMode="numeric" value={f.cupo} onChange={(e) => setF({ ...f, cupo: e.target.value.replace(/\D/g, '') })} placeholder="Sin límite" />
        <ErrorCaja error={err && { message: err }} />
      </div>
    </Modal>
  );
}

function DetalleHorario({ id, onCerrar, onCambio }) {
  const { tiene } = useSesion();
  const avisar = useAvisos();
  const confirmar = useConfirmar();
  const h = useDatos(() => api.get(`/horarios/${id}`), [id]);
  const desactivar = async () => {
    const n = h.datos.alumnos.length;
    if (!(await confirmar({ titulo: 'Desactivar clase', peligro: true, aceptar: 'Desactivar',
      texto: n ? `Hay ${n} alumnos inscritos. Sus inscripciones se conservan pero la clase ya no aparecerá en la tableta.` : 'La clase ya no aparecerá en la tableta ni para inscribir.' }))) return;
    try { await api.put(`/horarios/${id}/desactivar`, { forzar: true }); avisar('Clase desactivada', 'info'); onCambio(); }
    catch (e) { avisar(e.message, 'error'); }
  };
  const d = h.datos;
  return (
    <Modal abierto onCerrar={onCerrar} lateral titulo={d ? `${d.disciplina} · ${d.nivel || 'Todos los niveles'}` : 'Clase'}
      subtitulo={d && `${DIAS[d.dia_semana]} ${d.hora_inicio}–${d.hora_fin} · ${d.sucursal}`}
      pie={tiene('horarios.gestionar') && d && <Boton variante="peligro" icono={Power} onClick={desactivar}>Desactivar clase</Boton>}>
      {!d ? <Cargando /> : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-md bg-inset p-3"><div className="etiqueta">Instructor</div><div className="font-semibold mt-1">{d.instructor}</div></div>
            <div className="rounded-md bg-inset p-3"><div className="etiqueta">Grados</div><div className="font-semibold mt-1">{d.grado_desde || 'Inicio'} → {d.grado_hasta || 'Fin'}</div></div>
          </div>
          <Ocupacion inscritos={Number(d.inscritos)} cupo={d.cupo && Number(d.cupo)} />
          <div>
            <div className="etiqueta mb-2">Alumnos inscritos</div>
            {!d.alumnos.length ? <Vacio icono={Users} titulo="Todavía sin alumnos" /> : (
              <ul className="divide-y divide-line rounded-[10px] border border-line">
                {d.alumnos.map((a) => (
                  <li key={a.id}><Link to={`/alumnos/${a.id}`} className="flex items-center gap-3 px-3 py-2.5 hover:bg-inset">
                    <FotoAlumno id={a.id} nombre={a.nombre} className="size-8" texto="text-[11px]" />
                    <div className="flex-1"><div className="text-sm font-medium">{a.nombre}</div><div className="text-[12px] text-muted font-mono">{a.matricula}</div></div>
                    <Chip>{a.grado || '—'}</Chip>
                  </Link></li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function Horarios() {
  const { rol, tiene } = useSesion();
  const global = rol?.alcance === 'global';
  const sucursales = useDatos(() => api.get('/sucursales'), []);
  const disciplinas = useDatos(() => api.get('/disciplinas'), []);
  const [suc, setSuc] = useState('');
  const sucursal = global ? (suc || String(sucursales.datos?.[0]?.id || '')) : String(rol?.sucursal_id || '');
  const [disc, setDisc] = useState('');
  const datos = useDatos(() => (sucursal ? api.get('/horarios', { sucursal_id: sucursal, disciplina_id: disc }) : Promise.resolve([])), [sucursal, disc]);
  const [form, setForm] = useState(false);
  const [detalle, setDetalle] = useState(null);

  const tono = useMemo(() => Object.fromEntries((disciplinas.datos || []).map((d, i) => [d.id, TONOS[i % TONOS.length]])), [disciplinas.datos]);
  const porDia = useMemo(() => { const m = {}; (datos.datos || []).forEach((h) => (m[h.dia_semana] ||= []).push(h)); return m; }, [datos.datos]);
  const hoy = ((new Date().getDay() + 6) % 7) + 1;
  const activas = (disciplinas.datos || []).filter((d) => Number(d.activa));

  return (
    <>
      <Encabezado ruta="Operación · Clases" titulo="Horarios"
        descripcion="Las clases de cada semana. La tableta muestra estas clases para registrar asistencia."
        acciones={tiene('horarios.gestionar') && <Boton icono={Plus} onClick={() => setForm(true)} disabled={!sucursal}>Nueva clase</Boton>} />
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {global && <Pestanas valor={sucursal} onCambio={setSuc} opciones={(sucursales.datos || []).map((s) => ({ valor: String(s.id), etiqueta: s.nombre }))} />}
        <Pestanas valor={disc} onCambio={setDisc} opciones={[{ valor: '', etiqueta: 'Todas' }, ...activas.map((d) => ({ valor: String(d.id), etiqueta: d.nombre }))]} />
      </div>
      <ErrorCaja error={datos.error} reintentar={datos.recargar} />
      {datos.cargando && !datos.datos ? <Cargando /> : !datos.datos?.length ? (
        <Tarjeta><Vacio icono={CalendarDays} titulo="Sin clases programadas" texto="Agrega la primera clase de esta sucursal."
          accion={tiene('horarios.gestionar') && <Boton icono={Plus} onClick={() => setForm(true)}>Nueva clase</Boton>} /></Tarjeta>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
          {[1, 2, 3, 4, 5, 6, 7].map((dia) => (
            <div key={dia} className="min-w-0">
              <div className={`flex items-center justify-between px-1 mb-2 ${dia === hoy ? 'text-action' : ''}`}>
                <span className="etiqueta !text-current">{DIAS[dia]}</span>
                {dia === hoy && <Chip tono="accion">Hoy</Chip>}
              </div>
              <div className="space-y-2">
                {(porDia[dia] || []).map((h) => (
                  <button key={h.id} onClick={() => setDetalle(h.id)}
                    className="w-full text-left rounded-[10px] bg-surface border border-line hover:border-line-strong p-3 transition-colors cursor-pointer anim-entrar"
                    style={{ borderLeft: `3px solid ${tono[h.disciplina_id]}` }}>
                    <div className="flex items-center gap-1.5 text-[12px] text-muted"><Clock className="size-3" />{h.hora_inicio}–{h.hora_fin}</div>
                    <div className="font-semibold text-[14px] mt-1 leading-tight">{h.disciplina}</div>
                    <div className="text-[12.5px] text-soft">{h.nivel || 'Todos los niveles'}</div>
                    <div className="text-[12px] text-muted mt-1 truncate">{h.instructor}</div>
                    <div className="mt-2"><Ocupacion inscritos={Number(h.inscritos)} cupo={h.cupo && Number(h.cupo)} /></div>
                  </button>
                ))}
                {!porDia[dia] && <div className="rounded-[10px] border border-dashed border-line py-6 text-center text-[12px] text-muted">Sin clases</div>}
              </div>
            </div>
          ))}
        </div>
      )}
      {form && <FormHorario sucursal={sucursal} disciplinas={activas} onCerrar={() => setForm(false)} onCreado={() => { setForm(false); datos.recargar(); }} />}
      {detalle && <DetalleHorario id={detalle} onCerrar={() => setDetalle(null)} onCambio={() => { setDetalle(null); datos.recargar(); }} />}
    </>
  );
}
