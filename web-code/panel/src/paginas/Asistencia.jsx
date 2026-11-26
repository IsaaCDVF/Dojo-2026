import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCheck, ClipboardCheck, Clock, Tablet, Trash2, UserCheck, UserPlus, Users, XCircle } from 'lucide-react';
import { api, formato } from '../api';
import { useSesion } from '../auth/Sesion';
import { Boton, Campo, Cargando, Chip, Cinta, Encabezado, ErrorCaja, FotoAlumno, Kpi, Pestanas, Tabla, Tarjeta, Vacio, useAvisos, useConfirmar, useDatos } from '../ui';

// S-10 · Pase de lista del instructor (fase 3): quién llegó, retardos, visitas y rechazos de la tableta.
// Registra a mano a quien olvidó su credencial, quita registros equivocados y valida la lista del día.
export const MOTIVOS = { no_inscrito: 'No inscrito en la clase', adeudo: 'Pago vencido', visita_rechazada: 'Sin visitas disponibles', alumno_baja: 'Alumno no activo' };
const hoyTexto = () => new Date().toLocaleDateString('en-CA');
const cx = (...c) => c.filter(Boolean).join(' ');

export default function Asistencia() {
  const { rol, tiene } = useSesion();
  const global = rol?.alcance === 'global';
  const [fecha, setFecha] = useState(hoyTexto());
  const [suc, setSuc] = useState('');
  const [sel, setSel] = useState(null);
  const sucursales = useDatos(() => (global ? api.get('/sucursales') : Promise.resolve([])), [global]);
  const sucursal = global ? (suc || String(sucursales.datos?.[0]?.id || '')) : String(rol?.sucursal_id || '');
  const clases = useDatos(() => (sucursal ? api.get('/asistencias/clases', { sucursal_id: sucursal, fecha }) : Promise.resolve(null)), [sucursal, fecha]);
  const lista = clases.datos?.clases || [];

  // Por omisión: la clase del instructor que está en curso, o la primera suya, o la que está en curso
  useEffect(() => {
    if (!lista.length) { setSel(null); return; }
    if (sel && lista.some((c) => c.id === sel)) return;
    const pick = lista.find((c) => c.mia && c.estado === 'en_curso') || lista.find((c) => c.mia) || lista.find((c) => c.estado === 'en_curso') || lista[0];
    setSel(pick.id);
  }, [lista]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <Encabezado ruta="Operación · Clases" titulo="Asistencia"
        descripcion="Pase de lista por clase. La tableta registra con el QR; aquí se corrige y se valida."
        acciones={tiene('asistencia.registrar') && <Link to="/tableta"><Boton variante="secundario" icono={Tablet}>Abrir modo tableta</Boton></Link>} />
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <Campo etiqueta="Día" type="date" value={fecha} max={hoyTexto()} onChange={(e) => { setFecha(e.target.value || hoyTexto()); setSel(null); }} className="w-48" />
        {global && <Pestanas valor={sucursal} onCambio={(v) => { setSuc(v); setSel(null); }} opciones={(sucursales.datos || []).map((s) => ({ valor: String(s.id), etiqueta: s.nombre }))} />}
      </div>
      <ErrorCaja error={clases.error} reintentar={clases.recargar} />
      {clases.cargando && !clases.datos ? <Cargando /> : !lista.length ? (
        <Tarjeta><Vacio icono={Clock} titulo="No hay clases ese día" texto="Elige otro día o revisa los horarios de la sucursal." /></Tarjeta>
      ) : (
        <>
          <div className="flex gap-2 overflow-x-auto pb-2 mb-3 [scrollbar-width:thin]">
            {lista.map((c) => (
              <button key={c.id} onClick={() => setSel(c.id)}
                className={cx('shrink-0 text-left rounded-[10px] border px-4 py-3 min-w-48 transition-colors cursor-pointer',
                  sel === c.id ? 'border-action bg-action/10' : 'border-line bg-surface hover:border-line-strong')}>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono font-semibold">{c.hora_inicio}</span>
                  {c.estado === 'en_curso' && <Chip tono="accion">En curso</Chip>}
                  {c.mia && c.estado !== 'en_curso' && <Chip>Tuya</Chip>}
                </div>
                <div className="font-medium mt-1">{c.disciplina}</div>
                <div className="text-[12px] text-muted">{c.nivel || 'General'} · {c.asistieron}/{c.inscritos}</div>
              </button>
            ))}
          </div>
          {sel && <Lista key={`${sel}-${fecha}`} id={sel} fecha={fecha} onCambio={clases.recargar} />}
        </>
      )}
    </>
  );
}

function Lista({ id, fecha, onCambio }) {
  const { tiene } = useSesion();
  const avisar = useAvisos();
  const confirmar = useConfirmar();
  const datos = useDatos(() => api.get(`/asistencias/clase/${id}`, { fecha }), [id, fecha]);
  const [filtro, setFiltro] = useState('');
  const [trabajando, setTrabajando] = useState(null);
  const d = datos.datos;
  const editable = fecha >= new Date(Date.now() - 7 * 864e5).toLocaleDateString('en-CA');
  const recargar = () => { datos.recargar(); onCambio?.(); };

  const filas = useMemo(() => (d?.alumnos || []).filter((a) =>
    !filtro || (filtro === 'vino' ? a.asistencia_id : filtro === 'falta' ? !a.asistencia_id : Number(a.retardo))), [d, filtro]);

  async function registrar(a, forzar = false) {
    setTrabajando(a.id);
    try {
      await api.post('/asistencias', { alumno_id: a.id, horario_id: id, fecha, forzar });
      avisar(`Asistencia de ${a.nombre} registrada`); recargar();
    } catch (e) {
      if (e.detalle?.se_puede_forzar && !forzar) {
        const ok = await confirmar({ titulo: '¿Registrar de todos modos?', texto: `${e.message} ${(e.detalle.avisos || []).join('. ')} Si lo registras, queda en la bitácora como excepción.`, aceptar: 'Registrar' });
        if (ok) { setTrabajando(null); return registrar(a, true); }
      } else avisar(e.message, 'error');
    } finally { setTrabajando(null); }
  }

  async function quitar(a) {
    const ok = await confirmar({ titulo: `¿Quitar la asistencia de ${a.nombre}?`, texto: 'Úsalo si se registró por error. Queda en la bitácora.', aceptar: 'Quitar', peligro: true });
    if (!ok) return;
    try { await api.del(`/asistencias/${a.asistencia_id}`); avisar('Registro eliminado', 'aviso'); recargar(); }
    catch (e) { avisar(e.message, 'error'); }
  }

  async function validar() {
    try { const r = await api.put(`/asistencias/clase/${id}/validar`, { fecha }); avisar(`Lista validada: ${r.validadas} registros`); recargar(); }
    catch (e) { avisar(e.message, 'error'); }
  }

  if (datos.cargando && !d) return <Cargando />;
  if (datos.error) return <ErrorCaja error={datos.error} reintentar={datos.recargar} />;
  const r = d.resumen;
  const faltan = r.inscritos - (d.alumnos || []).filter((a) => Number(a.inscrito) && a.asistencia_id).length;

  return (
    <div className="space-y-4 anim-entrar">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <Kpi etiqueta="Inscritos" valor={r.inscritos} icono={Users} />
        <Kpi etiqueta="Asistieron" valor={r.asistieron} detalle={faltan > 0 ? `${faltan} sin registrar` : 'Completa'} tono="ok" icono={UserCheck} />
        <Kpi etiqueta="Retardos" valor={r.retardos} detalle={`Después de ${d.minutos_retardo} min`} tono="oro" icono={Clock} />
        <Kpi etiqueta="Rechazos" valor={d.rechazos.length} detalle="Intentos en la tableta" tono={d.rechazos.length ? 'peligro' : 'accion'} icono={XCircle} />
      </div>

      <Tarjeta cuerpo="p-0" titulo={`${d.clase.disciplina} · ${d.clase.hora_inicio.slice(0, 5)}–${d.clase.hora_fin.slice(0, 5)}`}
        subtitulo={`${d.clase.nivel || 'Clase general'} · ${d.clase.instructor} · ${formato.fecha(fecha)}`}
        acciones={tiene('asistencia.validar') && r.asistieron > 0 && (r.sin_validar > 0
          ? <Boton tam="sm" icono={CheckCheck} onClick={validar}>Validar lista ({r.sin_validar})</Boton>
          : <Chip tono="ok">Lista validada</Chip>)}>
        <div className="px-4 py-3 border-b border-line">
          <Pestanas valor={filtro} onCambio={setFiltro} opciones={[{ valor: '', etiqueta: 'Todos' }, { valor: 'vino', etiqueta: 'Asistieron' }, { valor: 'falta', etiqueta: 'Sin registro' }, { valor: 'retardo', etiqueta: 'Retardos' }]} />
        </div>
        <Tabla filas={filas} vacio={<Vacio icono={ClipboardCheck} titulo="Nadie en esta vista" />}
          columnas={[
            { k: 'nombre', t: 'Alumno', r: (a) => (
              <Link to={`/alumnos/${a.id}`} className="flex items-center gap-3 hover:underline">
                <FotoAlumno id={a.id} nombre={a.nombre} tiene={a.tiene_foto} className="size-9" />
                <div><div className="font-medium whitespace-nowrap">{a.nombre}</div><div className="font-mono text-[12px] text-muted">{a.matricula}</div></div>
              </Link>) },
            { k: 'grado', t: 'Grado', r: (a) => a.grado ? <span className="inline-flex items-center gap-2 whitespace-nowrap"><Cinta color={a.color_cinta} />{a.grado}</span> : '—' },
            { k: 'estado', t: 'Asistencia', r: (a) => !a.asistencia_id ? <Chip tono="info">Sin registro</Chip> : (
              <span className="inline-flex items-center gap-2 whitespace-nowrap">
                <Chip tono={Number(a.retardo) ? 'aviso' : 'ok'}>{Number(a.retardo) ? 'Retardo' : 'Asistió'}</Chip>
                <span className="font-mono text-[13px]">{a.fecha_hora.slice(11, 16)}</span>
                {a.visita && <Chip tono="oro">Visita</Chip>}
              </span>) },
            { k: 'metodo', t: 'Cómo', r: (a) => a.asistencia_id ? <span className="text-muted text-[13px]">{a.metodo === 'qr' ? 'QR' : 'A mano'}{Number(a.validada_instructor) ? ' · validada' : ''}</span> : null },
            { k: 'acc', t: '', derecha: true, r: (a) => editable && (a.asistencia_id
              ? tiene('asistencia.validar') && <Boton tam="sm" variante="fantasma" icono={Trash2} onClick={() => quitar(a)}>Quitar</Boton>
              : tiene('asistencia.manual') && <Boton tam="sm" variante="secundario" icono={UserPlus} cargando={trabajando === a.id} onClick={() => registrar(a)}>Registrar</Boton>) },
          ]} />
      </Tarjeta>

      {d.rechazos.length > 0 && (
        <Tarjeta titulo="Rechazados por la tableta" subtitulo="Intentaron entrar y la tableta no los dejó" icono={XCircle} cuerpo="p-0">
          <ul className="divide-y divide-line">
            {d.rechazos.map((x) => (
              <li key={x.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                <span className="font-mono text-muted">{x.fecha_hora.slice(11, 16)}</span>
                <Link to={`/alumnos/${x.alumno_id}`} className="font-medium hover:underline flex-1">{x.nombre}</Link>
                <Chip tono="peligro">{MOTIVOS[x.motivo] || x.motivo}</Chip>
              </li>
            ))}
          </ul>
        </Tarjeta>
      )}
    </div>
  );
}
