import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Building2, CalendarDays, Check, Tags, UserCog, UserPlus, Users } from 'lucide-react';
import { api } from '../api';
import { NOMBRE_ROL } from '../auth/Sesion';
import { Boton, Campo, Cargando, Chip, ErrorCaja, Modal, Pasos, Selector, useDatos } from '../ui';
import { AccesoNuevo, CamposPersona, revisarPersona } from './Personal';

// Alta de sucursal en pasos: datos → domicilio → disciplinas → encargado → revisar.
// Todo se guarda junto al final (si algo falla no queda una sucursal a medias).

const cx = (...c) => c.filter(Boolean).join(' ');
const PASOS = ['Datos', 'Domicilio', 'Disciplinas', 'Encargado', 'Revisar'];
const DOM_VACIO = { calle: '', numero: '', colonia: '', cp: '', municipio: '', estado: '' };
const PERSONA_VACIA = { nombre: '', apellido_paterno: '', apellido_materno: '', fecha_nacimiento: '', sexo: '', email: '', telefono: '' };
const sinAcentos = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '');
/** "Sucursal Angelópolis" → "ANGE" */
const sugerirClave = (nombre) => {
  const palabras = sinAcentos(nombre).toUpperCase().replace(/[^A-Z ]/g, '').split(' ').filter((p) => p && !['SUCURSAL', 'DOJO', 'DE', 'LA', 'EL', 'LOS', 'LAS'].includes(p));
  return (palabras.join('')).slice(0, 4);
};
const domicilioTexto = (d) => d && [d.calle && `${d.calle}${d.numero ? ` ${d.numero}` : ''}`, d.colonia, d.cp && `CP ${d.cp}`, d.municipio, d.estado].filter(Boolean).join(', ');

/** Campos del domicilio (alta y edición) */
function CamposDomicilio({ valor, onCambio, errores = {} }) {
  const poner = (k) => (e) => onCambio({ ...valor, [k]: k === 'cp' ? e.target.value.replace(/\D/g, '').slice(0, 5) : e.target.value });
  return (
    <div className="grid sm:grid-cols-6 gap-4">
      <Campo className="sm:col-span-4" etiqueta="Calle" value={valor.calle} onChange={poner('calle')} maxLength={100} error={errores.calle} placeholder="Av. Reforma" />
      <Campo className="sm:col-span-2" etiqueta="Número" value={valor.numero} onChange={poner('numero')} maxLength={20} placeholder="120-B" />
      <Campo className="sm:col-span-4" etiqueta="Colonia" value={valor.colonia} onChange={poner('colonia')} maxLength={80} />
      <Campo className="sm:col-span-2" etiqueta="Código postal" inputMode="numeric" value={valor.cp} onChange={poner('cp')} error={errores.cp} placeholder="72000" />
      <Campo className="sm:col-span-3" etiqueta="Municipio" value={valor.municipio} onChange={poner('municipio')} maxLength={80} error={errores.municipio} />
      <Campo className="sm:col-span-3" etiqueta="Estado" value={valor.estado} onChange={poner('estado')} maxLength={60} error={errores.estado} placeholder="Puebla" />
    </div>
  );
}
function revisarDomicilio(d) {
  const e = {};
  if (!d.calle.trim()) e.calle = 'Escribe la calle';
  if (!/^\d{5}$/.test(d.cp)) e.cp = '5 dígitos';
  if (!d.municipio.trim()) e.municipio = 'Escribe el municipio';
  if (!d.estado.trim()) e.estado = 'Escribe el estado';
  return e;
}

/** Tarjetas para elegir disciplinas */
function ElegirDisciplinas({ disciplinas, valor, onCambio }) {
  const alternar = (id) => onCambio(valor.includes(id) ? valor.filter((x) => x !== id) : [...valor, id]);
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {disciplinas.filter((d) => Number(d.activa)).map((d) => {
        const si = valor.includes(d.id);
        return (
          <button key={d.id} type="button" onClick={() => alternar(d.id)} aria-pressed={si}
            className={cx('flex items-center gap-3 rounded-[10px] border p-3 text-left cursor-pointer transition-colors', si ? 'border-action bg-action/8' : 'border-line hover:border-line-strong')}>
            <span className={cx('grid place-items-center size-5 rounded border', si ? 'bg-action border-action text-on-action' : 'border-line-strong')}>{si && <Check className="size-3.5" />}</span>
            <span className="flex-1"><span className="block font-medium">{d.nombre}</span><span className="text-[12px] text-muted">{d.grados} grados</span></span>
          </button>
        );
      })}
    </div>
  );
}

const PASO_DE_CAMPO = (c = '') => (['clave', 'nombre', 'telefono'].includes(c) ? 0 : c.startsWith('domicilio') ? 1 : c === 'disciplinas' ? 2 : 3);

export function NuevaSucursal({ abierto, onCerrar, onCreada }) {
  const disciplinas = useDatos(() => (abierto ? api.get('/disciplinas') : Promise.resolve([])), [abierto]);
  const personal = useDatos(() => (abierto ? api.get('/personal') : Promise.resolve([])), [abierto]);
  const [paso, setPaso] = useState(0);
  const [d, setD] = useState({ clave: '', nombre: '', telefono: '' });
  const [claveTocada, setClaveTocada] = useState(false);
  const [dom, setDom] = useState(DOM_VACIO);
  const [disc, setDisc] = useState([]);
  const [modo, setModo] = useState('nuevo');
  const [usuarioId, setUsuarioId] = useState('');
  const [persona, setPersona] = useState(PERSONA_VACIA);
  const [err, setErr] = useState({});
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [creada, setCreada] = useState(null);

  // Cada vez que se abre empieza en el paso 1
  useEffect(() => { if (abierto) { setPaso(0); setCreada(null); } }, [abierto]);
  const cerrar = () => {
    setD({ clave: '', nombre: '', telefono: '' }); setClaveTocada(false); setDom(DOM_VACIO); setDisc([]); setModo('nuevo'); setUsuarioId(''); setPersona(PERSONA_VACIA);
    setErr({}); setError(null); setCreada(null); setPaso(0); onCerrar();
  };
  const encargadoElegido = (personal.datos || []).find((p) => String(p.usuario_id) === String(usuarioId));

  function revisar(p) {
    const e = {};
    if (p === 0) {
      if (!d.nombre.trim()) e.nombre = 'Escribe el nombre';
      if (!/^[A-Z]{4}$/.test(d.clave)) e.clave = 'Exactamente 4 letras';
      if (d.telefono && d.telefono.replace(/\D/g, '').length !== 10) e.telefono = 'Debe tener 10 dígitos';
    }
    if (p === 1) Object.assign(e, revisarDomicilio(dom));
    if (p === 2 && !disc.length) e.disciplinas = 'Elige al menos una disciplina';
    if (p === 3) { if (modo === 'existente') { if (!usuarioId) e.encargado = 'Elige quién la va a administrar'; } else Object.assign(e, revisarPersona(persona)); }
    setErr(e);
    return !Object.keys(e).length;
  }
  const siguiente = () => { if (revisar(paso)) { setError(null); setPaso(paso + 1); } };

  async function crear() {
    for (let p = 0; p < 4; p += 1) if (!revisar(p)) { setPaso(p); return; }
    setGuardando(true); setError(null);
    try {
      const r = await api.post('/sucursales', {
        clave: d.clave, nombre: d.nombre.trim(), telefono: d.telefono, domicilio: dom, disciplinas: disc,
        encargado: modo === 'existente' ? { usuario_id: Number(usuarioId) } : { nuevo: persona },
      });
      setCreada(r); onCreada?.(r);
    } catch (ex) {
      const campo = ex.detalle?.campo;
      if (ex.estado === 409 && !campo) { setPaso(0); setErr({ clave: ex.message }); return; }
      if (campo) { setPaso(PASO_DE_CAMPO(campo)); setErr({ [campo.replace('domicilio.', '')]: ex.message, ...(campo === 'encargado' && { encargado: ex.message }) }); }
      setError(ex);
    } finally { setGuardando(false); }
  }

  const pie = creada
    ? <Boton onClick={cerrar}>Listo</Boton>
    : <>
        {paso > 0 && <Boton variante="secundario" icono={ArrowLeft} onClick={() => { setErr({}); setPaso(paso - 1); }} className="mr-auto">Atrás</Boton>}
        <Boton variante="secundario" onClick={cerrar}>Cancelar</Boton>
        {paso < 4 ? <Boton icono={ArrowRight} onClick={siguiente}>Siguiente</Boton> : <Boton icono={Building2} cargando={guardando} onClick={crear}>Crear sucursal</Boton>}
      </>;

  return (
    <Modal abierto={abierto} onCerrar={cerrar} ancho="max-w-3xl" titulo={creada ? `${creada.nombre} ya está lista` : 'Nueva sucursal'}
      subtitulo={creada ? `Matrículas desde ${creada.clave}-${String(new Date().getFullYear()).slice(2)}-0001` : 'Hereda los parámetros y precios globales; luego puedes ajustarlos.'} pie={pie}>
      {creada ? (
        <div className="space-y-5">
          {creada.encargado_nuevo
            ? <AccesoNuevo acceso={creada.encargado_nuevo} titulo={`Acceso de ${persona.nombre}, encargado de ${creada.nombre}`} />
            : <p className="text-[14px]">{encargadoElegido ? `${encargadoElegido.nombre} ${encargadoElegido.apellido_paterno}` : 'El encargado'} ya puede elegir esta sucursal al entrar.</p>}
          <div>
            <div className="etiqueta mb-2">Lo que sigue</div>
            <div className="grid sm:grid-cols-3 gap-2">
              <Link to="/configuracion/personal" onClick={cerrar} className="rounded-[10px] border border-line p-3 hover:border-action"><Users className="size-4 text-action" /><div className="font-medium mt-1">Su equipo</div><div className="text-[12px] text-muted">Recepción, instructores y la tableta</div></Link>
              <Link to="/horarios" onClick={cerrar} className="rounded-[10px] border border-line p-3 hover:border-action"><CalendarDays className="size-4 text-action" /><div className="font-medium mt-1">Horarios</div><div className="text-[12px] text-muted">Clases de cada disciplina</div></Link>
              <Link to="/tarifas" onClick={cerrar} className="rounded-[10px] border border-line p-3 hover:border-action"><Tags className="size-4 text-action" /><div className="font-medium mt-1">Precios</div><div className="text-[12px] text-muted">Si cobra distinto a las demás</div></Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <Pasos pasos={PASOS} actual={paso} onIr={(i) => { setErr({}); setPaso(i); }} />
          {paso === 0 && (
            <div className="grid sm:grid-cols-2 gap-4">
              <Campo className="sm:col-span-2" etiqueta="Nombre de la sucursal" value={d.nombre} maxLength={80} error={err.nombre} placeholder="Sucursal Angelópolis" autoFocus
                onChange={(e) => { const nombre = e.target.value; setD((x) => ({ ...x, nombre, clave: claveTocada ? x.clave : sugerirClave(nombre) })); }} />
              <Campo etiqueta="Clave (4 letras)" value={d.clave} maxLength={4} error={err.clave}
                ayuda={/^[A-Z]{4}$/.test(d.clave) ? `Matrículas y recibos: ${d.clave}-${String(new Date().getFullYear()).slice(2)}-0001. No se puede cambiar después.` : 'Prefijo de matrículas y recibos. No se puede cambiar después.'}
                onChange={(e) => { setClaveTocada(true); setD({ ...d, clave: sinAcentos(e.target.value).toUpperCase().replace(/[^A-Z]/g, '') }); }} />
              <Campo etiqueta="Teléfono de la sucursal" inputMode="tel" value={d.telefono} onChange={(e) => setD({ ...d, telefono: e.target.value })} error={err.telefono} placeholder="2221234567" />
            </div>
          )}
          {paso === 1 && <CamposDomicilio valor={dom} onCambio={setDom} errores={err} />}
          {paso === 2 && (
            disciplinas.cargando && !disciplinas.datos ? <Cargando /> : <div>
              <p className="text-[14px] text-muted mb-3">¿Qué se enseña en esta sucursal? Solo estas aparecen al hacer horarios e inscribir.</p>
              <ElegirDisciplinas disciplinas={disciplinas.datos || []} valor={disc} onCambio={setDisc} />
              {err.disciplinas && <p className="mt-2 text-[13px] text-danger">{err.disciplinas}</p>}
            </div>
          )}
          {paso === 3 && (
            <div className="space-y-4">
              <p className="text-[14px] text-muted">El encargado administra la sucursal: su personal, horarios, caja y exámenes. Ve solo esta sucursal.</p>
              <div className="grid sm:grid-cols-2 gap-2">
                {[['nuevo', UserPlus, 'Persona nueva', 'Se le crea su acceso con contraseña temporal'], ['existente', UserCog, 'Alguien del personal', 'Ya tiene cuenta; se le agrega este rol']].map(([k, I, t, s]) => (
                  <button key={k} type="button" onClick={() => { setModo(k); setErr({}); }} aria-pressed={modo === k}
                    className={cx('flex gap-3 rounded-[10px] border p-3 text-left cursor-pointer', modo === k ? 'border-action bg-action/8' : 'border-line hover:border-line-strong')}>
                    <I className="size-5 text-action shrink-0 mt-0.5" /><span><span className="block font-medium">{t}</span><span className="text-[12px] text-muted">{s}</span></span>
                  </button>
                ))}
              </div>
              {modo === 'nuevo' ? <CamposPersona valor={persona} onCambio={setPersona} errores={err} /> : (
                personal.cargando && !personal.datos ? <Cargando /> : (
                  <Selector etiqueta="Encargado" value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)} error={err.encargado}>
                    <option value="">Elige…</option>
                    {(personal.datos || []).filter((p) => p.activo && p.nivel < 5).map((p) => (
                      <option key={p.usuario_id} value={p.usuario_id}>{p.nombre} {p.apellido_paterno} — {p.roles.filter((r) => r.activo).map((r) => `${NOMBRE_ROL[r.rol]}${r.clave ? ` ${r.clave}` : ''}`).join(', ')}</option>
                    ))}
                  </Selector>
                )
              )}
              {err.encargado && modo === 'nuevo' && <p className="text-[13px] text-danger">{err.encargado}</p>}
            </div>
          )}
          {paso === 4 && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-[14px]">
              <dt className="text-muted">Sucursal</dt><dd><b>{d.nombre}</b> <Chip tono="oro" className="ml-1">{d.clave}</Chip></dd>
              <dt className="text-muted">Teléfono</dt><dd>{d.telefono || '—'}</dd>
              <dt className="text-muted">Domicilio</dt><dd>{domicilioTexto(dom)}</dd>
              <dt className="text-muted">Disciplinas</dt><dd className="flex flex-wrap gap-1.5">{(disciplinas.datos || []).filter((x) => disc.includes(x.id)).map((x) => <Chip key={x.id}>{x.nombre}</Chip>)}</dd>
              <dt className="text-muted">Encargado</dt>
              <dd>{modo === 'nuevo' ? <>{persona.nombre} {persona.apellido_paterno} · {persona.email} <span className="text-muted">(cuenta nueva)</span></> : encargadoElegido ? `${encargadoElegido.nombre} ${encargadoElegido.apellido_paterno} · ${encargadoElegido.email}` : '—'}</dd>
            </dl>
          )}
          <ErrorCaja error={error} />
        </div>
      )}
    </Modal>
  );
}

/** Editar: nombre, teléfono, domicilio y disciplinas; la clave no cambia. Muestra su personal. */
export function EditarSucursal({ id, onCerrar, onGuardada }) {
  const det = useDatos(() => (id ? api.get(`/sucursales/${id}`) : Promise.resolve(null)), [id]);
  const disciplinas = useDatos(() => (id ? api.get('/disciplinas') : Promise.resolve([])), [id]);
  const [f, setF] = useState(null);
  const [err, setErr] = useState({});
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);
  useEffect(() => {
    if (det.datos) setF({ nombre: det.datos.nombre, telefono: det.datos.telefono || '', dom: det.datos.domicilio ? Object.fromEntries(Object.keys(DOM_VACIO).map((k) => [k, det.datos.domicilio[k] || ''])) : DOM_VACIO, disc: det.datos.disciplinas.map((x) => x.id) });
  }, [det.datos]);
  const cerrar = () => { setF(null); setErr({}); setError(null); onCerrar(); };

  async function guardar() {
    const e = {};
    if (!f.nombre.trim()) e.nombre = 'Escribe el nombre';
    if (f.telefono && f.telefono.replace(/\D/g, '').length !== 10) e.telefono = 'Debe tener 10 dígitos';
    const tieneDom = Object.values(f.dom).some((v) => v.trim());
    if (tieneDom) Object.assign(e, revisarDomicilio(f.dom));
    if (!f.disc.length) e.disciplinas = 'Deja al menos una disciplina';
    setErr(e); setError(null);
    if (Object.keys(e).length) return;
    setGuardando(true);
    try {
      await api.put(`/sucursales/${id}`, { nombre: f.nombre.trim(), telefono: f.telefono, disciplinas: f.disc, ...(tieneDom && { domicilio: f.dom }) });
      onGuardada?.(); cerrar();
    } catch (ex) { setError(ex); } finally { setGuardando(false); }
  }

  const s = det.datos;
  return (
    <Modal abierto={!!id} onCerrar={cerrar} ancho="max-w-3xl" titulo={s ? `Editar ${s.nombre}` : 'Editar sucursal'}
      subtitulo={s && `Clave ${s.clave}: no se puede cambiar porque ya está en matrículas y recibos`}
      pie={<><Boton variante="secundario" onClick={cerrar}>Cancelar</Boton><Boton cargando={guardando} onClick={guardar} disabled={!f}>Guardar</Boton></>}>
      {!f ? <Cargando /> : (
        <div className="space-y-6">
          <div className="grid sm:grid-cols-2 gap-4">
            <Campo etiqueta="Nombre" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} error={err.nombre} maxLength={80} />
            <Campo etiqueta="Teléfono" value={f.telefono} onChange={(e) => setF({ ...f, telefono: e.target.value })} error={err.telefono} />
          </div>
          <div><div className="etiqueta mb-2">Domicilio</div><CamposDomicilio valor={f.dom} onCambio={(dom) => setF({ ...f, dom })} errores={err} /></div>
          <div>
            <div className="etiqueta mb-2">Disciplinas</div>
            <ElegirDisciplinas disciplinas={disciplinas.datos || []} valor={f.disc} onCambio={(disc) => setF({ ...f, disc })} />
            {err.disciplinas && <p className="mt-2 text-[13px] text-danger">{err.disciplinas}</p>}
          </div>
          <div>
            <div className="flex items-center justify-between mb-2"><div className="etiqueta">Personal</div><Link to="/configuracion/personal" className="text-[13px] text-action hover:underline">Administrar personal</Link></div>
            {s.personal.length ? (
              <ul className="flex flex-wrap gap-2">{s.personal.map((p) => <li key={`${p.usuario_id}-${p.rol}`}><Chip tono={p.rol === 'admin_sucursal' ? 'accion' : 'info'}>{p.nombre} · {NOMBRE_ROL[p.rol]}</Chip></li>)}</ul>
            ) : <p className="text-[14px] text-danger">Esta sucursal no tiene personal. Dale un encargado en Personal y accesos.</p>}
          </div>
          <ErrorCaja error={error} />
        </div>
      )}
    </Modal>
  );
}
