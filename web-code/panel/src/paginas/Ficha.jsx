import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { ArrowLeft, CalendarCheck, CalendarPlus, IdCard, Mail, Phone, Printer, RefreshCw, UserCheck, UserX, Users } from 'lucide-react';
import { api, DIAS, formato, nombreCompleto } from '../api';
import { useSesion } from '../auth/Sesion';
import { Boton, Cargando, Chip, Cinta, ErrorCaja, FotoAlumno, Modal, Selector, Tarjeta, Vacio, useAvisos, useConfirmar, useDatos } from '../ui';
import { inscribir } from './inscribir';
import { MOTIVOS } from './Asistencia';

// S-05 · Ficha del alumno
function Credencial({ a }) {
  const [qr, setQr] = useState('');
  useEffect(() => { QRCode.toDataURL(a.codigo_qr, { margin: 1, width: 280, color: { dark: '#011c42', light: '#ffffff' } }).then(setQr); }, [a.codigo_qr]);
  return (
    <div className="imprimible rounded-[14px] overflow-hidden border border-line" id="credencial">
      <div className="px-4 py-3 text-white flex items-center justify-between" style={{ background: 'linear-gradient(120deg,#011c42,#0a2852 60%,#006aff)' }}>
        <span className="font-semibold">Dojo <span className="text-[#f2a900]">OS</span></span>
        <span className="font-mono text-[11px] tracking-wider opacity-80">CREDENCIAL</span>
      </div>
      <div className="bg-white text-[#0b1b33] p-4 flex gap-4 items-center">
        {qr ? <img src={qr} alt="Código QR de asistencia" className="size-32" /> : <div className="size-32 bg-gray-100" />}
        <div className="min-w-0">
          <div className="font-semibold leading-tight">{nombreCompleto(a)}</div>
          <div className="font-mono text-[13px] mt-1">{a.matricula}</div>
          <div className="text-[12px] text-gray-500 mt-1">{a.sucursal}</div>
          <div className="text-[11px] text-gray-500 mt-3">Muestra este código en la tableta al llegar a clase.</div>
        </div>
      </div>
    </div>
  );
}

function AgregarHorario({ a, onCerrar, onListo }) {
  const avisar = useAvisos();
  const confirmar = useConfirmar();
  const horarios = useDatos(() => api.get('/horarios', { sucursal_id: a.sucursal_id }), [a.sucursal_id]);
  const [horario, setHorario] = useState('');
  const [grado, setGrado] = useState('');
  const h = horarios.datos?.find((x) => String(x.id) === horario);
  const grados = useDatos(() => (h ? api.get(`/disciplinas/${h.disciplina_id}/grados`) : Promise.resolve([])), [h?.disciplina_id]);
  const yaTiene = h && a.grados.find((g) => g.disciplina_id === h.disciplina_id);
  const [guardando, setGuardando] = useState(false);
  const guardar = async () => {
    setGuardando(true);
    const r = await inscribir({ alumno_id: a.id, horario_id: Number(horario), grado_id: grado || undefined }, confirmar);
    setGuardando(false);
    if (r.ok) { avisar(`Inscrito en ${h.disciplina} · ${DIAS[h.dia_semana]} ${h.hora_inicio}`); onListo(); }
    else if (r.error) avisar(r.error, 'error');
  };
  return (
    <Modal abierto onCerrar={onCerrar} titulo="Agregar clase" subtitulo={`${nombreCompleto(a)} · ${a.sucursal}`}
      pie={<><Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton><Boton cargando={guardando} disabled={!horario} onClick={guardar}>Inscribir</Boton></>}>
      <div className="space-y-4">
        <Selector etiqueta="Clase" value={horario} onChange={(e) => { setHorario(e.target.value); setGrado(''); }}>
          <option value="">Elige una clase…</option>
          {(horarios.datos || []).map((x) => <option key={x.id} value={x.id}>{x.disciplina} · {DIAS[x.dia_semana]} {x.hora_inicio} · {x.nivel || 'Todos'}{x.cupo ? ` (${x.inscritos}/${x.cupo})` : ''}</option>)}
        </Selector>
        {h && !yaTiene && (
          <Selector etiqueta={`Grado en ${h.disciplina} (evaluación de ubicación)`} value={grado} onChange={(e) => setGrado(e.target.value)}>
            <option value="">Principiante (primer grado)</option>
            {(grados.datos || []).map((g) => <option key={g.id} value={g.id}>{g.nombre} · {g.color_cinta}</option>)}
          </Selector>
        )}
        {yaTiene && <p className="text-sm text-muted">Conserva su grado actual en {h.disciplina}: <b className="text-text">{yaTiene.nombre}</b>.</p>}
      </div>
    </Modal>
  );
}

export default function Ficha() {
  const { id } = useParams();
  const { tiene } = useSesion();
  const avisar = useAvisos();
  const confirmar = useConfirmar();
  const datos = useDatos(() => api.get(`/alumnos/${id}`), [id]);
  const [agregar, setAgregar] = useState(false);
  const [cred, setCred] = useState(false);
  const a = datos.datos;

  if (datos.error) return <ErrorCaja error={datos.error} reintentar={datos.recargar} />;
  if (!a) return <Cargando />;

  const vigentes = a.inscripciones.filter((i) => !i.fecha_fin || i.fecha_fin >= new Date().toISOString().slice(0, 10));
  const actualPorDisc = Object.values(a.grados.reduce((m, g) => (m[g.disciplina_id] ||= g, m), {}));

  const cambiarEstado = async (estado) => {
    const textos = { baja: 'Se terminan sus clases y deja de poder registrar asistencia. Su historial se conserva.', suspendido: 'No podrá registrar asistencia hasta reactivarlo.', activo: 'Vuelve a poder registrar asistencia. Si estaba dado de baja, inscríbelo de nuevo en sus clases.' };
    if (!(await confirmar({ titulo: estado === 'activo' ? 'Reactivar alumno' : estado === 'baja' ? 'Dar de baja' : 'Suspender', texto: textos[estado], peligro: estado !== 'activo', aceptar: 'Confirmar' }))) return;
    try { await api.put(`/alumnos/${a.id}/estado`, { estado }); avisar('Estado actualizado'); datos.recargar(); }
    catch (e) { avisar(e.message, 'error'); }
  };
  const terminar = async (i) => {
    if (!(await confirmar({ titulo: 'Quitar de la clase', texto: `${i.disciplina} · ${DIAS[i.dia_semana]} ${i.hora_inicio}. La inscripción termina hoy y queda en el historial.`, aceptar: 'Quitar', peligro: true }))) return;
    try { await api.put(`/inscripciones/${i.id}/terminar`); avisar('Inscripción terminada', 'info'); datos.recargar(); }
    catch (e) { avisar(e.message, 'error'); }
  };
  const regenerar = async () => {
    if (!(await confirmar({ titulo: '¿Generar una credencial nueva?', texto: 'El QR anterior dejará de funcionar en la tableta. Úsalo si la credencial se perdió.', aceptar: 'Generar', peligro: true }))) return;
    try { await api.put(`/alumnos/${a.id}/qr`); avisar('Credencial nueva: imprímela y entrégasela'); datos.recargar(); }
    catch (e) { avisar(e.message, 'error'); }
  };

  return (
    <>
      <Link to="/alumnos" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text mb-4"><ArrowLeft className="size-4" />Alumnos</Link>
      <section className="bg-surface border border-line rounded-[12px] p-5 sm:p-6 flex flex-wrap items-center gap-5 mb-4 anim-entrar">
        <FotoAlumno id={a.id} nombre={nombreCompleto(a)} tiene={a.tiene_foto} className="size-24" texto="text-2xl" />
        <div className="flex-1 min-w-60">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[28px] leading-tight">{nombreCompleto(a)}</h1>
            <Chip tono={a.estado === 'activo' ? 'ok' : a.estado === 'baja' ? 'peligro' : 'aviso'}>{a.estado}</Chip>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-soft mt-1.5">
            <span className="font-mono text-gold">{a.matricula}</span>
            <span>{a.edad} años</span><span>{a.sucursal}</span>
            <span className="font-mono text-[13px] text-muted">{a.curp}</span>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            {actualPorDisc.map((g) => <span key={g.disciplina_id} className="inline-flex items-center gap-2 rounded-full bg-inset px-3 py-1 text-[13px]"><Cinta color={g.color_cinta} className="!w-5" />{g.disciplina}: <b>{g.nombre}</b></span>)}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Boton variante="secundario" icono={IdCard} onClick={() => setCred(true)}>Credencial</Boton>
          {tiene('inscripciones.crear') && a.estado === 'activo' && <Boton icono={CalendarPlus} onClick={() => setAgregar(true)}>Agregar clase</Boton>}
        </div>
      </section>

      <div className="grid lg:grid-cols-[1fr_360px] gap-4">
        <div className="space-y-4">
          <Tarjeta titulo="Clases" subtitulo="Horarios en los que está inscrito" cuerpo="p-0">
            {!a.inscripciones.length ? <Vacio titulo="Sin clases" texto="Agrégalo a un horario para que pueda registrar asistencia." /> : (
              <ul className="divide-y divide-line">
                {a.inscripciones.map((i) => {
                  const vig = vigentes.includes(i);
                  return (
                    <li key={i.id} className={`flex items-center gap-4 px-5 py-3.5 ${vig ? '' : 'opacity-55'}`}>
                      <div className="w-24 shrink-0"><div className="text-sm font-semibold">{DIAS[i.dia_semana]}</div><div className="text-[13px] text-muted">{i.hora_inicio}–{i.hora_fin}</div></div>
                      <div className="flex-1"><div className="font-medium">{i.disciplina} · {i.nivel || 'Todos los niveles'}</div><div className="text-[12px] text-muted">{i.instructor} · desde {formato.fecha(i.fecha_inicio)}</div></div>
                      {vig ? (tiene('inscripciones.crear') && <Boton variante="fantasma" tam="sm" onClick={() => terminar(i)}>Quitar</Boton>) : <Chip>Terminó {formato.fecha(i.fecha_fin)}</Chip>}
                    </li>
                  );
                })}
              </ul>
            )}
          </Tarjeta>
          <Tarjeta titulo="Historial de grados" cuerpo="p-0">
            {!a.grados.length ? <Vacio titulo="Sin grados registrados" /> : (
              <ul className="divide-y divide-line">
                {a.grados.map((g) => (
                  <li key={g.id} className="flex items-center gap-4 px-5 py-3">
                    <Cinta color={g.color_cinta} />
                    <div className="flex-1"><span className="font-medium">{g.nombre}</span> <span className="text-muted text-sm">· {g.disciplina}</span></div>
                    <Chip tono={g.origen === 'examen' ? 'oro' : 'info'}>{g.origen === 'ubicacion' ? 'Ubicación' : g.origen === 'examen' ? 'Examen' : 'Migración'}</Chip>
                    <span className="text-[13px] text-muted w-24 text-right">{formato.fecha(g.fecha_obtencion)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Tarjeta>
          {tiene('asistencia.ver', 'asistencia.validar', 'alumnos.ver') && <AsistenciaAlumno id={a.id} />}
        </div>
        <div className="space-y-4">
          <Tarjeta titulo="Responsable de pago" icono={Users}>
            {a.responsables.map((r) => (
              <div key={r.id} className="text-sm">
                <div className="font-semibold">{Number(r.es_el_mismo) ? 'Él mismo' : nombreCompleto(r)}</div>
                <div className="text-muted">{r.parentesco}{Number(r.alumnos_a_cargo) > 1 && ` · paga por ${r.alumnos_a_cargo} alumnos`}</div>
                {r.telefono && <div className="flex items-center gap-2 mt-2"><Phone className="size-3.5 text-muted" /><span className="font-mono">{r.telefono}</span></div>}
                {r.email && <div className="flex items-center gap-2 mt-1"><Mail className="size-3.5 text-muted" />{r.email}</div>}
                {tiene('pagos.cobrar') && <Link to={`/caja?responsable=${r.id}`} className="inline-block mt-2 text-[13px] font-semibold text-link">Estado de cuenta y cobro →</Link>}
              </div>
            ))}
          </Tarjeta>
          <Tarjeta titulo="Contacto del alumno">
            {!a.contactos.length ? <p className="text-sm text-muted">Sin datos de contacto propios.</p> : a.contactos.map((c) => (
              <div key={c.id} className="flex items-center gap-2 text-sm py-1">{c.tipo === 'email' ? <Mail className="size-3.5 text-muted" /> : <Phone className="size-3.5 text-muted" />}<span className={c.tipo !== 'email' ? 'font-mono' : ''}>{c.valor}</span></div>
            ))}
            <div className="text-[12px] text-muted mt-3">Alta: {formato.fecha(a.fecha_alta)}</div>
          </Tarjeta>
          {tiene('alumnos.baja') && (
            <Tarjeta titulo="Estado">
              <div className="flex flex-wrap gap-2">
                {a.estado !== 'activo' && <Boton variante="secundario" tam="sm" icono={UserCheck} onClick={() => cambiarEstado('activo')}>Reactivar</Boton>}
                {a.estado === 'activo' && <Boton variante="secundario" tam="sm" onClick={() => cambiarEstado('suspendido')}>Suspender</Boton>}
                {a.estado !== 'baja' && <Boton variante="peligro" tam="sm" icono={UserX} onClick={() => cambiarEstado('baja')}>Dar de baja</Boton>}
              </div>
            </Tarjeta>
          )}
        </div>
      </div>
      {agregar && <AgregarHorario a={a} onCerrar={() => setAgregar(false)} onListo={() => { setAgregar(false); datos.recargar(); }} />}
      <Modal abierto={cred} onCerrar={() => setCred(false)} titulo="Credencial" subtitulo="El QR es el mismo para todas sus disciplinas"
        pie={<>
          {tiene('alumnos.editar') && <Boton variante="fantasma" icono={RefreshCw} onClick={regenerar}>Nueva credencial</Boton>}
          <Boton variante="secundario" icono={Printer} onClick={() => window.print()}>Imprimir</Boton>
        </>}>
        <Credencial a={a} />
      </Modal>
    </>
  );
}

/** Asistencia de los últimos 90 días: retardos, faltas por retardo, visitas y rechazos de la tableta */
function AsistenciaAlumno({ id }) {
  const datos = useDatos(() => api.get(`/alumnos/${id}/asistencia`), [id]);
  const d = datos.datos;
  return (
    <Tarjeta titulo="Asistencia" subtitulo="Últimos 90 días" icono={CalendarCheck} cuerpo="p-0">
      {datos.cargando && !d ? <Cargando /> : datos.error ? <div className="p-4"><ErrorCaja error={datos.error} /></div> : (
        <>
          <div className="grid grid-cols-4 divide-x divide-line border-b border-line text-center">
            {[['Clases', d.resumen.asistencias], ['Retardos', d.resumen.retardos], ['Faltas por retardo', d.resumen.faltas_por_retardo], ['Visitas del mes', d.resumen.visitas_mes]].map(([t, v]) => (
              <div key={t} className="py-3 px-1"><div className="text-[22px] font-semibold">{v}</div><div className="etiqueta !text-[10px]">{t}</div></div>
            ))}
          </div>
          {!d.asistencias.length && !d.rechazos.length ? <Vacio titulo="Sin registros" texto="Aparecen cuando pasa su credencial por la tableta." /> : (
            <ul className="divide-y divide-line max-h-80 overflow-y-auto">
              {d.rechazos.slice(0, 3).map((r) => (
                <li key={r.fecha_hora} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                  <span className="font-mono text-[13px] text-muted w-32 shrink-0 whitespace-nowrap">{formato.fechaHora(r.fecha_hora)}</span>
                  <span className="flex-1">{r.disciplina}</span><Chip tono="peligro">{MOTIVOS[r.motivo] || r.motivo}</Chip>
                </li>
              ))}
              {d.asistencias.map((s) => (
                <li key={s.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                  <span className="font-mono text-[13px] text-muted w-32 shrink-0 whitespace-nowrap">{formato.fechaHora(s.fecha_hora)}</span>
                  <span className="flex-1">{s.disciplina}{s.visita && <span className="text-muted"> · {s.sucursal}</span>}</span>
                  {s.visita && <Chip tono="oro">Visita</Chip>}
                  <Chip tono={s.retardo ? 'aviso' : 'ok'}>{s.retardo ? `Retardo ${s.minutos_tarde} min` : 'A tiempo'}</Chip>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Tarjeta>
  );
}
