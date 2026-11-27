import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Bell, Check, ChevronLeft, ChevronRight, HelpCircle, KeyRound, LogOut, MapPin, MessageCircle, Monitor, Moon, Palette, Phone, ShieldCheck, Smartphone, Sun } from 'lucide-react';
import { estado as estadoNotificaciones } from '../notificaciones';
import { api, formato } from '../api';
import { useSesion } from '../sesion';
import { useMarca } from '../marca';
import { Cabecera } from '../Marco';
import { Boton, Cargando, Chip, Campo, ErrorCaja, Tarjeta, cx, useDatos } from '../ui';

// Mi cuenta: un menú de opciones (como en cualquier app actual) y cada opción en su pantalla:
// datos de contacto, domicilio, seguridad (contraseña y celulares con sesión), apariencia, notificaciones y ayuda.
// Nombre, fecha de nacimiento y CURP los corrige recepción.

const MODOS = [['sistema', Smartphone, 'Como mi celular'], ['claro', Sun, 'Claro'], ['oscuro', Moon, 'Oscuro']];
const DOM_VACIO = { calle: '', numero: '', colonia: '', cp: '', municipio: '', estado: '' };

const MODO_TXT = { sistema: 'Como mi celular', claro: 'Claro', oscuro: 'Oscuro' };

/** Fila del menú: ícono, título, valor actual y flecha */
function Opcion({ a, icono: I, titulo, valor, onClick, peligro }) {
  const dentro = (
    <>
      <span className={cx('grid place-items-center size-10 rounded-2xl shrink-0', peligro ? 'bg-danger/12 text-danger' : 'bg-action/12 text-action')}><I className="size-5" strokeWidth={2.5} /></span>
      <span className={cx('flex-1 min-w-0 font-black text-[16px]', peligro && 'text-danger')}>{titulo}</span>
      {valor && <span className="text-[13px] font-bold text-muted truncate max-w-[40%]">{valor}</span>}
      {!peligro && <ChevronRight className="size-5 text-muted shrink-0" />}
    </>
  );
  const clase = 'w-full flex items-center gap-3 px-4 py-3.5 text-left cursor-pointer active:bg-inset';
  return <li>{a ? <Link to={a} className={clase}>{dentro}</Link> : <button onClick={onClick} className={clase}>{dentro}</button>}</li>;
}
function Grupo({ titulo, children }) {
  return (
    <section>
      <h2 className="etiqueta px-2 mb-2">{titulo}</h2>
      <ul className="rounded-3xl bg-surface border-2 border-line divide-y-2 divide-line overflow-hidden anim-entrar">{children}</ul>
    </section>
  );
}
function Sub({ titulo, children }) {
  return (
    <>
      <header className="flex items-center gap-2 h-14 mb-3">
        <Link to="/cuenta" aria-label="Mi cuenta" className="grid place-items-center size-10 -ml-1 rounded-full bg-surface"><ChevronLeft className="size-6" /></Link>
        <h1 className="flex-1 text-[22px] font-black truncate">{titulo}</h1>
      </header>
      <div className="space-y-4">{children}</div>
    </>
  );
}

export default function MiCuenta() {
  const { seccion } = useParams();
  const { salir } = useSesion();
  const marca = useMarca();
  const navegar = useNavigate();
  const datos = useDatos(() => api.get('/app/cuenta'), []);
  const [noti, setNoti] = useState(null);
  useEffect(() => { estadoNotificaciones().then(setNoti).catch(() => setNoti('no')); }, []);
  const d = datos.datos;

  if (seccion && !['datos', 'domicilio', 'seguridad', 'apariencia', 'ayuda'].includes(seccion)) return <Navigate to="/cuenta" replace />;
  if (datos.cargando && !d) return <><Cabecera titulo="Mi cuenta" /><Cargando /></>;
  if (datos.error) return <><Cabecera titulo="Mi cuenta" /><ErrorCaja error={datos.error} reintentar={datos.recargar} /></>;
  if (seccion === 'datos') return <Sub titulo="Teléfono y correo"><Contacto d={d} recargar={datos.recargar} /></Sub>;
  if (seccion === 'domicilio') return <Sub titulo="Domicilio"><Domicilio d={d} recargar={datos.recargar} /></Sub>;
  if (seccion === 'seguridad') return <Sub titulo="Seguridad"><Seguridad /></Sub>;
  if (seccion === 'apariencia') return <Sub titulo="Apariencia"><Apariencia /></Sub>;
  if (seccion === 'ayuda') return <Sub titulo="Ayuda"><Ayuda d={d} /></Sub>;

  const nombre = [d.nombre, d.apellido_paterno].filter(Boolean).join(' ');
  const ini = nombre.split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase();
  const notiTxt = { activas: 'Activadas', apagadas: 'Apagadas', bloqueadas: 'Bloqueadas', instalar: 'Agrega la app', https: 'Solo en la app', no: 'En la campanita' }[noti] || '';
  return (
    <>
      <Cabecera titulo="Mi cuenta" />
      <div className="space-y-6">
        <section className="flex items-center gap-4 px-1 anim-entrar">
          <span className="grid place-items-center size-16 rounded-full bg-gold/20 text-gold font-black text-[22px] shrink-0">{ini}</span>
          <div className="min-w-0">
            <div className="text-[22px] font-black leading-tight truncate">{nombre}</div>
            <div className="text-muted font-bold text-[14px]">{d.matricula ? `Matrícula ${d.matricula}` : d.es_responsable ? 'Responsable de pago' : ''}</div>
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5"><span className="text-[12px] font-bold text-muted">Entras con:</span>{d.entra_con.map((x) => <Chip key={x}>{x}</Chip>)}</div>
          </div>
        </section>
        <Grupo titulo="Tu cuenta">
          <Opcion a="/cuenta/datos" icono={Phone} titulo="Teléfono y correo" valor={d.telefono || d.email} />
          <Opcion a="/cuenta/domicilio" icono={MapPin} titulo="Domicilio" valor={d.domicilio ? d.domicilio.municipio : 'Sin capturar'} />
          <Opcion a="/cuenta/seguridad" icono={ShieldCheck} titulo="Seguridad" valor="Contraseña" />
        </Grupo>
        <Grupo titulo="La app">
          <Opcion a="/cuenta/apariencia" icono={Palette} titulo="Apariencia" valor={MODO_TXT[marca.tema]} />
          <Opcion a="/avisos" icono={Bell} titulo="Notificaciones" valor={notiTxt} />
        </Grupo>
        <Grupo titulo="Ayuda">
          <Opcion a="/cuenta/ayuda" icono={HelpCircle} titulo={d.sucursal ? `Contactar a ${d.sucursal.nombre}` : 'Ayuda'} />
        </Grupo>
        <ul className="rounded-3xl bg-surface border-2 border-line overflow-hidden">
          <Opcion icono={LogOut} titulo="Cerrar sesión" peligro onClick={async () => { await salir(); navegar('/entrar'); }} />
        </ul>
        <p className="text-center text-[12px] font-bold text-muted">Dojo OS · versión 0.5</p>
      </div>
    </>
  );
}

function Contacto({ d, recargar }) {
  const [c, setC] = useState({ telefono: d.telefono || '', email: d.email || '', password: '' });
  const [err, setErr] = useState({}); const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(false); const [listo, setListo] = useState(false);
  const cambiaAcceso = c.telefono.replace(/\D/g, '') !== (d.telefono || '') || c.email.trim().toLowerCase() !== (d.email || '');
  async function guardar() {
    const e = {};
    if (c.telefono && c.telefono.replace(/\D/g, '').length !== 10) e.telefono = 'Debe tener 10 dígitos';
    if (d.es_responsable && !c.telefono.trim()) e.telefono = 'Es tu usuario para entrar: no lo dejes vacío';
    if (c.email && !/^\S+@\S+\.\S+$/.test(c.email.trim())) e.email = 'Ese correo no parece válido';
    if (cambiaAcceso && !c.password) e.password = 'Escribe tu contraseña para confirmar';
    setErr(e); setError(null);
    if (Object.keys(e).length) return;
    setOcupado(true);
    try { await api.put('/app/cuenta', { telefono: c.telefono, email: c.email, password: c.password }); setC((x) => ({ ...x, password: '' })); setListo(true); recargar(); }
    catch (ex) { if (ex.detalle?.campo) setErr({ [ex.detalle.campo]: ex.message }); else if (ex.message === 'Nada que cambiar') setListo(true); else setError(ex); }
    finally { setOcupado(false); }
  }
  return (
    <Tarjeta className="space-y-4">
      <Campo etiqueta="WhatsApp" inputMode="tel" value={c.telefono} onChange={(e) => { setC({ ...c, telefono: e.target.value }); setListo(false); }} error={err.telefono} placeholder="2221234567"
        ayuda={d.es_responsable ? 'Con este número entras a la app.' : 'Aquí te avisan de tus clases y pagos.'} />
      <Campo etiqueta="Correo" type="email" value={c.email} onChange={(e) => { setC({ ...c, email: e.target.value }); setListo(false); }} error={err.email} placeholder="tucorreo@ejemplo.com" ayuda="También puedes entrar con tu correo." />
      {cambiaAcceso && <Campo etiqueta="Tu contraseña (para confirmar que eres tú)" type="password" value={c.password} onChange={(e) => setC({ ...c, password: e.target.value })} error={err.password} autoComplete="current-password" />}
      <ErrorCaja error={error} />
      <Boton cargando={ocupado} onClick={guardar} icono={listo ? Check : undefined}>{listo ? 'Guardado' : 'Guardar'}</Boton>
      <p className="text-[12px] font-semibold text-muted">Para corregir tu nombre, fecha de nacimiento o CURP, pídelo en recepción.</p>
    </Tarjeta>
  );
}

function Domicilio({ d, recargar }) {
  const [dom, setDom] = useState(d.domicilio ? Object.fromEntries(Object.keys(DOM_VACIO).map((k) => [k, d.domicilio[k] || ''])) : DOM_VACIO);
  const [err, setErr] = useState({}); const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(false); const [listo, setListo] = useState(false);
  const poner = (k) => (e) => { setListo(false); setDom({ ...dom, [k]: k === 'cp' ? e.target.value.replace(/\D/g, '').slice(0, 5) : e.target.value }); };
  async function guardar() {
    const e = {};
    if (!dom.calle.trim()) e.calle = 'Escribe la calle';
    if (!/^\d{5}$/.test(dom.cp)) e.cp = '5 dígitos';
    if (!dom.municipio.trim()) e.municipio = 'Escribe el municipio';
    if (!dom.estado.trim()) e.estado = 'Escribe el estado';
    setErr(e); setError(null);
    if (Object.keys(e).length) return;
    setOcupado(true);
    try { await api.put('/app/cuenta', { domicilio: dom }); setListo(true); recargar(); }
    catch (ex) { const c = ex.detalle?.campo; if (c) setErr({ [c.replace('domicilio.', '')]: ex.message }); else if (ex.message === 'Nada que cambiar') setListo(true); else setError(ex); }
    finally { setOcupado(false); }
  }
  return (
    <Tarjeta>
      <div className="grid grid-cols-3 gap-3">
        <Campo className="col-span-2" etiqueta="Calle" value={dom.calle} onChange={poner('calle')} error={err.calle} />
        <Campo etiqueta="Número" value={dom.numero} onChange={poner('numero')} />
        <Campo className="col-span-2" etiqueta="Colonia" value={dom.colonia} onChange={poner('colonia')} />
        <Campo etiqueta="C.P." inputMode="numeric" value={dom.cp} onChange={poner('cp')} error={err.cp} />
        <Campo className="col-span-3" etiqueta="Municipio" value={dom.municipio} onChange={poner('municipio')} error={err.municipio} />
        <Campo className="col-span-3" etiqueta="Estado" value={dom.estado} onChange={poner('estado')} error={err.estado} placeholder="Puebla" />
      </div>
      <div className="mt-4 space-y-3"><ErrorCaja error={error} /><Boton cargando={ocupado} onClick={guardar} icono={listo ? Check : undefined}>{listo ? 'Guardado' : 'Guardar domicilio'}</Boton></div>
    </Tarjeta>
  );
}

function Seguridad() {
  const [abierto, setAbierto] = useState(false);
  const [pass, setPass] = useState({ actual: '', nueva: '', otra: '' });
  const [err, setErr] = useState({}); const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(false); const [listo, setListo] = useState(false);
  const sesiones = useDatos(() => api.get('/auth/sesiones'), []);
  const otras = (sesiones.datos || []).filter((x) => !x.actual);
  async function cambiar() {
    const e = {};
    if (!pass.actual) e.actual = 'Escribe tu contraseña actual';
    if (pass.nueva.length < 8 || !/[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(pass.nueva) || !/\d/.test(pass.nueva)) e.nueva = 'Mínimo 8, con letras y números';
    if (pass.nueva !== pass.otra) e.otra = 'No coincide';
    setErr(e); setError(null);
    if (Object.keys(e).length) return;
    setOcupado(true);
    try { await api.put('/auth/contrasena', { actual: pass.actual, nueva: pass.nueva }); setPass({ actual: '', nueva: '', otra: '' }); setListo(true); setAbierto(false); sesiones.recargar(); }
    catch (ex) { if (ex.detalle?.campo) setErr({ [ex.detalle.campo]: ex.message }); else setError(ex); }
    finally { setOcupado(false); }
  }
  const cerrar = async (id) => { try { await api.post('/auth/sesiones/cerrar', id ? { id } : {}); sesiones.recargar(); } catch (ex) { setError(ex); } };
  return (
    <>
      <Tarjeta>
        <div className="flex items-center gap-3">
          <KeyRound className="size-5 text-action" strokeWidth={2.6} />
          <div className="flex-1"><div className="font-black text-[17px]">Contraseña</div><div className="text-[13px] font-semibold text-muted">{listo ? 'Cambiada. En tus otros celulares se cerró la sesión.' : 'Mínimo 8, con letras y números'}</div></div>
          {!abierto && <button onClick={() => { setAbierto(true); setListo(false); }} className="font-black text-action text-[15px] cursor-pointer">Cambiar</button>}
        </div>
        {abierto && (
          <div className="space-y-4 mt-4">
            <Campo etiqueta="Contraseña actual" type="password" value={pass.actual} onChange={(e) => setPass({ ...pass, actual: e.target.value })} error={err.actual} autoComplete="current-password" autoFocus />
            <Campo etiqueta="Nueva" type="password" value={pass.nueva} onChange={(e) => setPass({ ...pass, nueva: e.target.value })} error={err.nueva} autoComplete="new-password" />
            <Campo etiqueta="Repite la nueva" type="password" value={pass.otra} onChange={(e) => setPass({ ...pass, otra: e.target.value })} error={err.otra} autoComplete="new-password" />
            <ErrorCaja error={error} />
            <Boton cargando={ocupado} onClick={cambiar}>Cambiar contraseña</Boton>
            <button onClick={() => setAbierto(false)} className="w-full text-center text-[14px] font-black text-muted cursor-pointer">Cancelar</button>
          </div>
        )}
      </Tarjeta>
      <Tarjeta>
        <div className="font-black text-[17px]">Dónde tienes la sesión abierta</div>
        <p className="text-[13px] font-semibold text-muted mb-3">Si no reconoces un celular, ciérralo y cambia tu contraseña.</p>
        {!sesiones.datos ? <Cargando className="py-6" /> : (
          <ul className="space-y-2">
            {sesiones.datos.map((x) => (
              <li key={x.id} className="flex items-center gap-3 rounded-2xl bg-inset px-3 py-2.5">
                {/Android|iPhone|iPad/.test(x.equipo) ? <Smartphone className="size-5 text-muted" /> : <Monitor className="size-5 text-muted" />}
                <div className="flex-1 min-w-0"><div className="font-black text-[15px]">{x.equipo}{x.actual && <span className="text-ok"> · este</span>}</div>
                  <div className="text-[12px] font-bold text-muted">Último uso: {formato.fecha(x.ultima_actividad)} {formato.hora(x.ultima_actividad)}</div></div>
                {!x.actual && <button onClick={() => cerrar(x.id)} className="text-[13px] font-black text-danger cursor-pointer">Cerrar</button>}
              </li>
            ))}
          </ul>
        )}
        {otras.length > 1 && <Boton tono="suave" className="mt-3" onClick={() => cerrar(null)}>Cerrar en todos los demás</Boton>}
      </Tarjeta>
    </>
  );
}

function Apariencia() {
  const marca = useMarca();
  return (
    <Tarjeta>
      <div className="grid grid-cols-3 gap-2">
        {MODOS.map(([k, I, t]) => (
          <button key={k} onClick={() => marca.ponerTema(k)} aria-pressed={marca.tema === k}
            className={cx('relieve rounded-2xl border-2 py-3 px-2 flex flex-col items-center gap-1.5 font-black text-[13px] cursor-pointer',
              marca.tema === k ? 'border-action bg-action/10 text-action' : 'border-line bg-inset text-muted')}>
            <I className="size-6" strokeWidth={2.4} />{t}
          </button>
        ))}
      </div>
      <p className="text-[13px] font-semibold text-muted mt-3">{marca.tema === 'sistema' ? `Tu celular está en modo ${marca.modo}; la app cambia con él.` : 'Se queda así aunque cambies el modo de tu celular.'}</p>
      <p className="text-[13px] font-semibold text-muted mt-2">Los colores y el logo son los de {marca.nombre ? 'tu dojo' : 'la app'}.</p>
    </Tarjeta>
  );
}

function Ayuda({ d }) {
  const s = d.sucursal;
  const tel = s?.telefono ? String(s.telefono).replace(/\D/g, '') : null;
  return (
    <>
      {s && (
        <Tarjeta>
          <div className="font-black text-[18px]">{s.nombre}</div>
          {s.direccion && <p className="text-[14px] font-semibold text-muted mt-1 flex gap-1.5"><MapPin className="size-4 shrink-0 mt-0.5" />{s.direccion}</p>}
          {tel ? (
            <div className="grid grid-cols-2 gap-2 mt-4">
              <a href={`https://wa.me/52${tel}`} target="_blank" rel="noopener" className="relieve rounded-2xl bg-[#25D366] text-[#0b2e17] [--sombra:#1a9e4c] min-h-12 font-black inline-flex items-center justify-center gap-2"><MessageCircle className="size-5" />WhatsApp</a>
              <a href={`tel:${tel}`} className="relieve rounded-2xl bg-inset text-text [--sombra:var(--sombra-base)] min-h-12 font-black inline-flex items-center justify-center gap-2"><Phone className="size-5" />Llamar</a>
            </div>
          ) : <p className="text-[13px] font-semibold text-muted mt-3">Pregunta en recepción por su teléfono.</p>}
        </Tarjeta>
      )}
      <Tarjeta className="space-y-3">
        {[['¿Cómo entro a clase?', 'En Inicio toca "Mostrar mi QR" y acércalo a la tableta de la entrada.'],
          ['¿Cómo pago?', 'En Familia o Pagos ves lo que debes. Paga en recepción o en línea si tu dojo lo tiene activo.'],
          ['¿Cómo pido mi examen?', 'En Examen ves las fechas; pídelo antes de que cierre el plazo y espera la autorización de tu instructor.'],
          ['Olvidé mi contraseña', 'Pide en recepción un código nuevo para activar tu cuenta otra vez.']].map(([p, r]) => (
          <details key={p} className="group rounded-2xl bg-inset px-4 py-3">
            <summary className="font-black text-[15px] cursor-pointer list-none flex items-center justify-between">{p}<ChevronRight className="size-4 text-muted transition-transform group-open:rotate-90" /></summary>
            <p className="text-[14px] font-semibold text-muted mt-2">{r}</p>
          </details>
        ))}
      </Tarjeta>
    </>
  );
}
