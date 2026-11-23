import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CalendarCheck, CalendarPlus, CalendarX, Check, Clock, MapPin, Medal, Search, ShieldCheck, Wallet, X } from 'lucide-react';
import { api, formato, nombreCompleto } from '../api';
import { useSesion } from '../auth/Sesion';
import { AreaTexto, Boton, Campo, Cargando, Chip, Cinta, Encabezado, ErrorCaja, FotoAlumno, Modal, Pestanas, Selector, Tabla, Tarjeta, Vacio, useAvisos, useConfirmar, useDatos } from '../ui';

// S-07 Exámenes (admin), S-08 Autorizar (instructor) y S-18 Solicitud en mostrador (recepción) — fase 5.
export const ESTADOS = {
  enviada: ['Enviada', 'info'], fuera_de_plazo: ['Fuera de plazo', 'aviso'], por_autorizar: ['Por autorizar', 'accion'],
  autorizada: ['Autorizada', 'ok'], no_autorizada: ['No autorizada', 'peligro'], cancelada: ['Cancelada', 'info'],
  aprobada: ['Aprobó', 'ok'], reprobada: ['Reprobó', 'peligro'],
};
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const hoyTexto = () => new Date().toLocaleDateString('en-CA');

/* ================= Lista de fechas ================= */
export default function Examenes() {
  const { rol, tiene } = useSesion();
  const navegar = useNavigate();
  const global = rol?.alcance === 'global';
  const [estado, setEstado] = useState('programado');
  const [suc, setSuc] = useState('');
  const [programar, setProgramar] = useState(false);
  const sucursales = useDatos(() => (global ? api.get('/sucursales') : Promise.resolve([])), [global]);
  const datos = useDatos(() => api.get('/examenes', { estado, sucursal_id: suc }), [estado, suc]);

  return (
    <>
      <Encabezado ruta="Operación · Grados" titulo="Exámenes"
        descripcion="Cada sucursal programa sus fechas. Las solicitudes llegan del portal o del mostrador, el instructor las autoriza y se cobran en Caja."
        acciones={tiene('examenes.programar') && <Boton icono={CalendarPlus} onClick={() => setProgramar(true)}>Programar fecha</Boton>} />
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {global && <Pestanas valor={suc} onCambio={setSuc} opciones={[{ valor: '', etiqueta: 'Todas' }, ...(sucursales.datos || []).map((s) => ({ valor: String(s.id), etiqueta: s.nombre }))]} />}
        <Pestanas valor={estado} onCambio={setEstado} opciones={[{ valor: 'programado', etiqueta: 'Programados' }, { valor: 'realizado', etiqueta: 'Realizados' }, { valor: 'cancelado', etiqueta: 'Cancelados' }, { valor: '', etiqueta: 'Todos' }]} />
      </div>
      <ErrorCaja error={datos.error} reintentar={datos.recargar} />
      {datos.cargando && !datos.datos ? <Cargando /> : !datos.datos?.length ? (
        <Tarjeta><Vacio icono={Medal} titulo="No hay exámenes en esta vista" texto={tiene('examenes.programar') ? 'Programa la siguiente fecha de examen de la sucursal.' : 'Cuando la sucursal programe una fecha aparecerá aquí.'} /></Tarjeta>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {datos.datos.map((e) => <TarjetaExamen key={e.id} e={e} global={global && !suc} onClick={() => navegar(`/examenes/${e.id}`)} />)}
        </div>
      )}
      {programar && <Programar global={global} sucursales={sucursales.datos || []} onCerrar={() => setProgramar(false)} onListo={(id) => navegar(`/examenes/${id}`)} />}
    </>
  );
}

function TarjetaExamen({ e, global, onClick }) {
  const [f, h] = e.fecha.split(' ');
  const [, m, d] = f.split('-');
  const cerrado = hoyTexto() > e.fecha_limite;
  return (
    <button onClick={onClick} className="text-left bg-surface border border-line hover:border-action rounded-[10px] p-4 flex gap-4 transition-colors cursor-pointer anim-entrar">
      <div className="grid place-items-center w-14 h-16 rounded-md bg-inset shrink-0">
        <div className="text-center leading-none"><div className="text-[24px] font-semibold">{d}</div><div className="etiqueta mt-1">{MESES[Number(m) - 1]}</div></div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="font-semibold truncate">{e.disciplina}</div>
          {e.estado !== 'programado' && <Chip tono={e.estado === 'realizado' ? 'ok' : 'peligro'}>{e.estado}</Chip>}
        </div>
        <div className="text-[13px] text-muted flex flex-wrap gap-x-3">
          <span className="inline-flex items-center gap-1"><Clock className="size-3" />{h.slice(0, 5)}</span>
          {e.sede && <span className="inline-flex items-center gap-1 truncate"><MapPin className="size-3" />{e.sede}</span>}
          {global && <span>{e.sucursal}</span>}
        </div>
        {e.estado === 'programado' && <div className={'text-[12px] mt-1 ' + (cerrado ? 'text-warn' : 'text-muted')}>{cerrado ? 'Plazo cerrado' : 'Solicitudes hasta'} {formato.fecha(e.fecha_limite)}</div>}
        <div className="flex flex-wrap gap-1.5 mt-2">
          <Chip>{e.solicitudes} solicitud{Number(e.solicitudes) !== 1 && 'es'}</Chip>
          {Number(e.por_revisar) > 0 && <Chip tono="accion">{e.por_revisar} por revisar</Chip>}
          {Number(e.sin_pago) > 0 && <Chip tono="aviso">{e.sin_pago} sin pago</Chip>}
        </div>
      </div>
    </button>
  );
}

function Programar({ global, sucursales, onCerrar, onListo }) {
  const avisar = useAvisos();
  const disciplinas = useDatos(() => api.get('/disciplinas'), []);
  const [f, setF] = useState({ sucursal_id: '', disciplina_id: '', dia: '', hora: '10:00', sede: '' });
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const cambiar = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const activas = (disciplinas.datos || []).filter((d) => Number(d.activa));

  async function guardar(ev) {
    ev.preventDefault(); setEnviando(true); setError(null);
    try {
      const r = await api.post('/examenes', { sucursal_id: f.sucursal_id || sucursales[0]?.id, disciplina_id: f.disciplina_id || activas[0]?.id, fecha: `${f.dia} ${f.hora}`, sede: f.sede });
      avisar('Fecha de examen programada');
      onListo(r.id);
    } catch (e) { setError(e); } finally { setEnviando(false); }
  }

  return (
    <Modal abierto onCerrar={onCerrar} titulo="Programar fecha de examen" subtitulo="La fecha límite para solicitar se calcula con el parámetro de días de anticipación"
      pie={<><Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton><Boton form="programar" type="submit" cargando={enviando} disabled={!f.dia}>Programar</Boton></>}>
      <form id="programar" onSubmit={guardar} className="space-y-4">
        {global && <Selector etiqueta="Sucursal" value={f.sucursal_id} onChange={cambiar('sucursal_id')}>{sucursales.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}</Selector>}
        <Selector etiqueta="Disciplina" value={f.disciplina_id} onChange={cambiar('disciplina_id')}>{activas.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}</Selector>
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Día" type="date" min={hoyTexto()} value={f.dia} onChange={cambiar('dia')} required />
          <Campo etiqueta="Hora" type="time" value={f.hora} onChange={cambiar('hora')} required />
        </div>
        <Campo etiqueta="Sede" value={f.sede} onChange={cambiar('sede')} placeholder="Opcional: gimnasio, salón de la sucursal…" />
        <ErrorCaja error={error} />
      </form>
    </Modal>
  );
}

/* ================= Detalle de una fecha ================= */
const GRUPOS = {
  revisar: ['enviada', 'fuera_de_plazo', 'por_autorizar'],
  autorizadas: ['autorizada'],
  resultados: ['aprobada', 'reprobada'],
  cerradas: ['no_autorizada', 'cancelada'],
};

export function ExamenDetalle() {
  const { id } = useParams();
  const { tiene } = useSesion();
  const avisar = useAvisos();
  const confirmar = useConfirmar();
  const datos = useDatos(() => api.get(`/examenes/${id}`), [id]);
  const [grupo, setGrupo] = useState('');
  const [accion, setAccion] = useState(null);
  const [solicitar, setSolicitar] = useState(false);
  const e = datos.datos;

  const cuentas = useMemo(() => Object.fromEntries(Object.entries(GRUPOS).map(([k, v]) => [k, (e?.solicitudes || []).filter((s) => v.includes(s.estado)).length])), [e]);
  const filas = (e?.solicitudes || []).filter((s) => !grupo || GRUPOS[grupo].includes(s.estado));

  async function resultado(s, r) {
    const ok = await confirmar({ titulo: r === 'aprobada' ? `¿${s.alumno} aprobó?` : `¿${s.alumno} reprobó?`, peligro: r === 'reprobada',
      texto: r === 'aprobada' ? `Sube a ${s.grado_objetivo} con fecha de hoy y queda en su historial de grados.` : 'Para volver a presentar tendrá que solicitar y pagar otro examen.',
      aceptar: r === 'aprobada' ? 'Sí, aprobó' : 'Sí, reprobó' });
    if (!ok) return;
    try { await api.put(`/solicitudes-examen/${s.id}/resultado`, { resultado: r }); avisar(r === 'aprobada' ? `${s.alumno} ahora es ${s.grado_objetivo}` : 'Resultado guardado'); datos.recargar(); }
    catch (err) { avisar(err.message, 'error'); }
  }

  async function cerrarFecha(estado) {
    const ok = await confirmar({ titulo: estado === 'realizado' ? '¿Marcar como realizado?' : '¿Cancelar la fecha?', peligro: estado === 'cancelado',
      texto: estado === 'realizado' ? 'Ya no se recibirán solicitudes. Todos los autorizados deben tener resultado.' : 'Ya no se recibirán solicitudes. Cancela antes las solicitudes pagadas para generar su saldo a favor.',
      aceptar: estado === 'realizado' ? 'Marcar realizado' : 'Cancelar fecha' });
    if (!ok) return;
    try { await api.put(`/examenes/${id}/estado`, { estado }); avisar('Fecha actualizada'); datos.recargar(); }
    catch (err) { avisar(err.message, 'error'); }
  }

  if (datos.cargando && !e) return <Cargando />;
  if (datos.error) return <ErrorCaja error={datos.error} reintentar={datos.recargar} />;
  const abierto = e.estado === 'programado';
  const excepcion = (s, tipo) => (s.excepciones || '').split(',').find((x) => x.startsWith(tipo + ':'))?.split(':')[1];

  return (
    <>
      <Encabezado ruta={<Link to="/examenes" className="hover:text-text">Exámenes</Link>}
        titulo={`${e.disciplina} · ${formato.fecha(e.fecha)}`}
        descripcion={`${e.fecha.slice(11, 16)} h · ${e.sede || e.sucursal} · solicitudes hasta el ${formato.fecha(e.fecha_limite)}`}
        acciones={abierto && <>
          {tiene('examenes.programar') && <Boton variante="secundario" icono={CalendarX} onClick={() => cerrarFecha('cancelado')}>Cancelar fecha</Boton>}
          {tiene('examenes.programar') && <Boton variante="secundario" icono={CalendarCheck} onClick={() => cerrarFecha('realizado')}>Marcar realizado</Boton>}
          {tiene('examenes.solicitar') && <Boton icono={Medal} onClick={() => setSolicitar(true)}>Registrar solicitud</Boton>}
        </>} />
      {e.estado !== 'programado' && <div className="mb-4"><Chip tono={e.estado === 'realizado' ? 'ok' : 'peligro'}>Fecha {e.estado}</Chip></div>}

      <Tarjeta cuerpo="p-0">
        <div className="p-4 border-b border-line">
          <Pestanas valor={grupo} onCambio={setGrupo} opciones={[
            { valor: '', etiqueta: 'Todas', cuenta: e.solicitudes.length }, { valor: 'revisar', etiqueta: 'Por revisar', cuenta: cuentas.revisar },
            { valor: 'autorizadas', etiqueta: 'Autorizadas', cuenta: cuentas.autorizadas }, { valor: 'resultados', etiqueta: 'Con resultado', cuenta: cuentas.resultados },
            { valor: 'cerradas', etiqueta: 'No autorizadas o canceladas', cuenta: cuentas.cerradas }]} />
        </div>
        <Tabla filas={filas} vacio={<Vacio icono={Medal} titulo="Sin solicitudes en esta vista" texto={abierto && tiene('examenes.solicitar') ? 'Registra la solicitud de un alumno desde el mostrador.' : null} />}
          columnas={[
            { k: 'alumno', t: 'Alumno', r: (s) => (
              <Link to={`/alumnos/${s.alumno_id}`} className="flex items-center gap-3 hover:underline">
                <FotoAlumno id={s.alumno_id} nombre={s.alumno} tiene={s.tiene_foto} className="size-9" />
                <div><div className="font-medium whitespace-nowrap">{s.alumno}</div><div className="font-mono text-[12px] text-muted whitespace-nowrap">{s.matricula}</div></div>
              </Link>) },
            { k: 'grado', t: 'Presenta', r: (s) => <span className="inline-flex items-center gap-2 whitespace-nowrap"><Cinta color={s.color_cinta} />{s.grado_objetivo}</span> },
            { k: 'criterios', t: 'Criterios', r: (s) => Number(s.cumplia_criterios) ? <Chip tono="ok">Cumple</Chip> : <Chip tono="aviso">No cumple</Chip> },
            { k: 'estado', t: 'Estado', r: (s) => (
              <div>
                <Chip tono={ESTADOS[s.estado][1]}>{ESTADOS[s.estado][0]}</Chip>
                {s.observaciones && <div className="text-[12px] text-muted mt-1 max-w-56">{s.observaciones}</div>}
              </div>) },
            { k: 'pago', t: 'Pago', r: (s) => s.estado === 'autorizada' || s.estado === 'aprobada' || s.estado === 'reprobada'
              ? (Number(s.pagado) ? <Chip tono="ok">Pagado</Chip> : excepcion(s, 'presentar_sin_pago') === 'autorizada' ? <Chip tono="oro">Sin pago · excepción</Chip> : <Chip tono="aviso">Pendiente</Chip>)
              : <span className="text-muted text-[12px]">{s.canal}</span> },
            { k: 'acciones', t: '', derecha: true, r: (s) => abierto && (
              <div className="flex flex-wrap justify-end gap-1.5">
                {s.estado === 'fuera_de_plazo' && tiene('examenes.excepcion') && <Boton tam="sm" variante="secundario" icono={ShieldCheck} onClick={() => setAccion({ tipo: 'plazo', s })}>Decidir plazo</Boton>}
                {s.estado === 'por_autorizar' && tiene('examenes.validar') && <>
                  <Boton tam="sm" icono={Check} onClick={() => setAccion({ tipo: 'validar', s, decision: 'autorizada' })}>Autorizar</Boton>
                  <Boton tam="sm" variante="secundario" icono={X} onClick={() => setAccion({ tipo: 'validar', s, decision: 'no_autorizada' })}>No</Boton>
                </>}
                {s.estado === 'autorizada' && !Number(s.pagado) && tiene('pagos.cobrar') && <Link to={`/caja?alumno=${s.alumno_id}`}><Boton tam="sm" variante="secundario" icono={Wallet}>Cobrar</Boton></Link>}
                {s.estado === 'autorizada' && !Number(s.pagado) && !excepcion(s, 'presentar_sin_pago') && tiene('examenes.excepcion') && <Boton tam="sm" variante="fantasma" onClick={() => setAccion({ tipo: 'sin_pago', s })}>Presentar sin pago</Boton>}
                {s.estado === 'autorizada' && (Number(s.pagado) || excepcion(s, 'presentar_sin_pago') === 'autorizada') && tiene('examenes.resultados') && <>
                  <Boton tam="sm" icono={Check} onClick={() => resultado(s, 'aprobada')}>Aprobó</Boton>
                  <Boton tam="sm" variante="secundario" onClick={() => resultado(s, 'reprobada')}>Reprobó</Boton>
                </>}
                {['enviada', 'fuera_de_plazo', 'por_autorizar', 'autorizada'].includes(s.estado) && tiene('examenes.programar', 'examenes.solicitar') && <Boton tam="sm" variante="fantasma" onClick={() => setAccion({ tipo: 'cancelar', s })}>Cancelar</Boton>}
              </div>) },
          ]} />
      </Tarjeta>

      {accion && <Accion accion={accion} onCerrar={() => setAccion(null)} onListo={() => { setAccion(null); datos.recargar(); }} />}
      {solicitar && <Solicitar examen={e} onCerrar={() => setSolicitar(false)} onListo={() => { setSolicitar(false); datos.recargar(); }} />}
    </>
  );
}

/** Un solo formulario para las decisiones con texto: autorizar, excepción de plazo o de pago, cancelar */
function Accion({ accion, onCerrar, onListo }) {
  const avisar = useAvisos();
  const { tipo, s } = accion;
  const [decision, setDecision] = useState(accion.decision || 'autorizada');
  const [texto, setTexto] = useState('');
  const [motivo, setMotivo] = useState('a_peticion');
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const conf = {
    validar: { titulo: decision === 'autorizada' ? 'Autorizar examen' : 'No autorizar', etiqueta: decision === 'autorizada' ? 'Observaciones (opcional)' : 'Observaciones para el alumno (obligatorias)', obligatorio: decision !== 'autorizada',
      enviar: () => api.put(`/solicitudes-examen/${s.id}/validar`, { decision, observaciones: texto }), listo: decision === 'autorizada' ? 'Autorizado: ya se puede cobrar en Caja' : 'Solicitud no autorizada' },
    plazo: { titulo: 'Solicitud fuera de plazo', etiqueta: 'Motivo de la decisión', obligatorio: true, decidir: true,
      enviar: () => api.put(`/solicitudes-examen/${s.id}/excepcion`, { tipo: 'fuera_de_plazo', decision, motivo: texto }), listo: decision === 'autorizada' ? 'Plazo autorizado: pasa con el instructor' : 'Plazo rechazado' },
    sin_pago: { titulo: 'Presentar con pago pendiente', etiqueta: 'Motivo', obligatorio: true, decidir: true,
      enviar: () => api.put(`/solicitudes-examen/${s.id}/excepcion`, { tipo: 'presentar_sin_pago', decision, motivo: texto }), listo: 'Excepción guardada' },
    cancelar: { titulo: 'Cancelar solicitud', etiqueta: 'Detalle (opcional)', obligatorio: false,
      enviar: () => api.put(`/solicitudes-examen/${s.id}/cancelar`, { motivo, detalle: texto }), listo: null },
  }[tipo];

  async function enviar() {
    setEnviando(true); setError(null);
    try {
      const r = await conf.enviar();
      avisar(conf.listo || (r.saldo_favor ? `Cancelada. Queda saldo a favor de ${formato.dinero(r.saldo_favor)}` : 'Solicitud cancelada'), tipo === 'cancelar' && r.saldo_favor ? 'info' : 'ok');
      onListo();
    } catch (e) { setError(e); } finally { setEnviando(false); }
  }

  return (
    <Modal abierto onCerrar={onCerrar} titulo={conf.titulo} subtitulo={`${s.alumno} · ${s.grado_objetivo}`} ancho="max-w-md"
      pie={<><Boton variante="secundario" onClick={onCerrar}>Regresar</Boton>
        <Boton variante={(tipo === 'cancelar' || decision !== 'autorizada') ? 'peligro' : 'primario'} cargando={enviando} disabled={conf.obligatorio && !texto.trim()} onClick={enviar}>
          {tipo === 'cancelar' ? 'Cancelar solicitud' : decision === 'autorizada' ? 'Autorizar' : tipo === 'validar' ? 'No autorizar' : 'Rechazar'}
        </Boton></>}>
      <div className="space-y-4">
        {conf.decidir && <Pestanas valor={decision} onCambio={setDecision} opciones={[{ valor: 'autorizada', etiqueta: 'Autorizar' }, { valor: 'rechazada', etiqueta: 'Rechazar' }]} />}
        {tipo === 'cancelar' && (
          <>
            <Selector etiqueta="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)}>
              <option value="a_peticion">A petición del alumno o su familia</option>
              <option value="no_pago">No pagó a tiempo</option>
              <option value="no_se_presento">No se presentó</option>
              <option value="otro">Otro</option>
            </Selector>
            {Number(s.pagado) > 0 && <p className="text-[13px] text-gold">Ya estaba pagado: el monto quedará como saldo a favor del responsable.</p>}
          </>
        )}
        {tipo === 'plazo' && <p className="text-[13px] text-muted">Si se autoriza, la solicitud pasa al instructor. Ej. de rechazo: las cintas ya se pidieron.</p>}
        <AreaTexto etiqueta={conf.etiqueta} value={texto} onChange={(e) => setTexto(e.target.value)} autoFocus />
        <ErrorCaja error={error} />
      </div>
    </Modal>
  );
}

/** S-18 · Recepción registra la solicitud: busca al alumno y ve si cumple los criterios antes de enviarla */
function Solicitar({ examen, onCerrar, onListo }) {
  const avisar = useAvisos();
  const [texto, setTexto] = useState('');
  const [buscar, setBuscar] = useState('');
  const [alumno, setAlumno] = useState(null);
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  useEffect(() => { const t = setTimeout(() => setBuscar(texto.trim()), 300); return () => clearTimeout(t); }, [texto]);
  const lista = useDatos(() => (buscar.length >= 2 ? api.get('/alumnos', { buscar, sucursal_id: examen.sucursal_id }) : Promise.resolve(null)), [buscar]);
  const crit = useDatos(() => (alumno ? api.get(`/examenes/${examen.id}/criterios`, { alumno_id: alumno.id }) : Promise.resolve(null)), [alumno]);
  const c = crit.datos;

  async function enviar() {
    setEnviando(true); setError(null);
    try {
      const r = await api.post(`/examenes/${examen.id}/solicitudes`, { alumno_id: alumno.id });
      avisar(r.estado === 'fuera_de_plazo' ? 'Registrada fuera de plazo: la debe autorizar el administrador' : 'Solicitud enviada al instructor', r.avisos.length ? 'aviso' : 'ok');
      onListo();
    } catch (e) { setError(e); } finally { setEnviando(false); }
  }

  return (
    <Modal abierto lateral onCerrar={onCerrar} titulo="Registrar solicitud" subtitulo={`${examen.disciplina} · ${formato.fecha(examen.fecha)}`}
      pie={<><Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton><Boton icono={Medal} cargando={enviando} disabled={!c} onClick={enviar}>Enviar solicitud</Boton></>}>
      <div className="space-y-4">
        <Campo icono={Search} value={texto} onChange={(e) => { setTexto(e.target.value); setAlumno(null); }} placeholder="Nombre o matrícula del alumno" autoFocus />
        {!alumno && lista.datos && (
          !lista.datos.length ? <p className="text-sm text-muted">Nadie coincide en esta sucursal.</p> : (
            <ul className="divide-y divide-line border border-line rounded-md">
              {lista.datos.slice(0, 8).map((a) => (
                <li key={a.id}><button onClick={() => setAlumno(a)} className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-inset cursor-pointer">
                  <FotoAlumno id={a.id} nombre={nombreCompleto(a)} tiene={a.tiene_foto} className="size-8" />
                  <span className="flex-1 truncate">{nombreCompleto(a)}</span><span className="font-mono text-[12px] text-muted">{a.matricula}</span>
                </button></li>
              ))}
            </ul>))}
        {alumno && (
          <div className="anim-entrar">
            <div className="flex items-center gap-3 mb-4">
              <FotoAlumno id={alumno.id} nombre={nombreCompleto(alumno)} tiene={alumno.tiene_foto} className="size-12" />
              <div><div className="font-semibold">{nombreCompleto(alumno)}</div><div className="font-mono text-[12px] text-muted">{alumno.matricula}</div></div>
            </div>
            {crit.cargando ? <Cargando texto="Revisando criterios…" /> : <ErrorCaja error={crit.error} />}
            {c && (
              <div className="space-y-3">
                <div className="flex items-center gap-3 rounded-md border border-line p-3">
                  <div className="flex-1"><div className="etiqueta">Grado actual</div><div className="font-semibold">{c.grado_actual.nombre}</div></div>
                  <span className="text-muted">→</span>
                  <div className="flex-1"><div className="etiqueta">Presentaría</div><div className="font-semibold inline-flex items-center gap-2"><Cinta color={c.grado_objetivo.color_cinta} />{c.grado_objetivo.nombre}</div></div>
                </div>
                <Criterio ok={c.cumple_meses} t="Tiempo en el grado" v={`${c.meses_en_grado} de ${c.meses_requeridos} meses`} />
                <Criterio ok={c.cumple_asistencia} t="Asistencia desde su último grado" v={`${c.asistencia}% (mínimo ${c.asistencia_requerida}%)`} />
                <Criterio ok={c.en_plazo} t="Plazo" v={c.en_plazo ? `a tiempo (hasta ${formato.fecha(c.fecha_limite)})` : `cerró el ${formato.fecha(c.fecha_limite)}: la autoriza el administrador`} />
                {!c.cumple && <p className="text-[13px] text-warn">No cumple todos los criterios. Se puede enviar: el instructor decide si lo autoriza.</p>}
              </div>
            )}
          </div>
        )}
        <ErrorCaja error={error} />
      </div>
    </Modal>
  );
}

function Criterio({ ok, t, v }) {
  return (
    <div className="flex items-start gap-3 text-sm">
      <span className={'grid place-items-center size-6 rounded-full shrink-0 ' + (ok ? 'bg-ok-bg text-ok' : 'bg-warn-bg text-warn')}>{ok ? <Check className="size-3.5" /> : <X className="size-3.5" />}</span>
      <div><div className="font-medium">{t}</div><div className="text-muted">{v}</div></div>
    </div>
  );
}
