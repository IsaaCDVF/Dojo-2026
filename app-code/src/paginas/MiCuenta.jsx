import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, KeyRound, LogOut, MapPin, Moon, Phone, Smartphone, Sun, UserRound } from 'lucide-react';
import { api } from '../api';
import { useSesion } from '../sesion';
import { useMarca } from '../marca';
import { Cabecera } from '../Marco';
import { Boton, Cargando, Chip, Campo, ErrorCaja, Tarjeta, cx, useDatos } from '../ui';

// Mi cuenta: modo claro u oscuro, y los datos que la persona puede cambiar sin ir a recepción
// (teléfono, correo, domicilio y contraseña). Nombre, fecha de nacimiento y CURP los corrige recepción.

const MODOS = [['sistema', Smartphone, 'Como mi celular'], ['claro', Sun, 'Claro'], ['oscuro', Moon, 'Oscuro']];
const DOM_VACIO = { calle: '', numero: '', colonia: '', cp: '', municipio: '', estado: '' };

function Seccion({ icono: I, titulo, children, accion }) {
  return (
    <Tarjeta>
      <div className="flex items-center gap-2 mb-4"><I className="size-5 text-action" strokeWidth={2.6} /><h2 className="flex-1 text-[18px] font-black">{titulo}</h2>{accion}</div>
      {children}
    </Tarjeta>
  );
}

function Listo({ visible }) {
  return visible ? <span className="inline-flex items-center gap-1 text-ok font-black text-[13px] anim-aparecer"><Check className="size-4" strokeWidth={3} /> Guardado</span> : null;
}

export default function MiCuenta() {
  const { salir } = useSesion();
  const marca = useMarca();
  const navegar = useNavigate();
  const datos = useDatos(() => api.get('/app/cuenta'), []);
  const d = datos.datos;
  const [contacto, setContacto] = useState(null);
  const [dom, setDom] = useState(DOM_VACIO);
  const [pass, setPass] = useState({ actual: '', nueva: '', otra: '' });
  const [err, setErr] = useState({});
  const [error, setError] = useState({});
  const [ocupado, setOcupado] = useState('');
  const [listo, setListo] = useState('');

  useEffect(() => {
    if (!d) return;
    setContacto({ telefono: d.telefono || '', email: d.email || '', password: '' });
    setDom(d.domicilio ? Object.fromEntries(Object.keys(DOM_VACIO).map((k) => [k, d.domicilio[k] || ''])) : DOM_VACIO);
  }, [d]);
  const avisar = (k) => { setListo(k); setTimeout(() => setListo((x) => (x === k ? '' : x)), 2500); };

  if (datos.cargando && !d) return <><Cabecera titulo="Mi cuenta" /><Cargando /></>;
  if (datos.error) return <><Cabecera titulo="Mi cuenta" /><ErrorCaja error={datos.error} reintentar={datos.recargar} /></>;
  if (!contacto) return null;

  const cambiaAcceso = contacto.telefono.replace(/\D/g, '') !== (d.telefono || '') || contacto.email.trim().toLowerCase() !== (d.email || '');
  async function guardar(seccion, cuerpo, revisar) {
    const e = revisar(); setErr(e); setError((x) => ({ ...x, [seccion]: null }));
    if (Object.keys(e).length) return;
    setOcupado(seccion);
    try {
      const r = await api.put('/app/cuenta', cuerpo);
      datos.recargar(); avisar(seccion);
      return r;
    } catch (ex) {
      const c = ex.detalle?.campo;
      if (c) setErr({ [c.replace('domicilio.', '')]: ex.message }); else if (ex.message === 'Nada que cambiar') avisar(seccion);
      else setError((x) => ({ ...x, [seccion]: ex }));
    } finally { setOcupado(''); }
  }
  const guardarContacto = () => guardar('contacto', { telefono: contacto.telefono, email: contacto.email, password: contacto.password }, () => {
    const e = {};
    if (contacto.telefono && contacto.telefono.replace(/\D/g, '').length !== 10) e.telefono = 'Debe tener 10 dígitos';
    if (d.es_responsable && !contacto.telefono.trim()) e.telefono = 'Es tu usuario para entrar: no lo dejes vacío';
    if (contacto.email && !/^\S+@\S+\.\S+$/.test(contacto.email.trim())) e.email = 'Ese correo no parece válido';
    if (cambiaAcceso && !contacto.password) e.password = 'Escribe tu contraseña para confirmar';
    return e;
  });
  const guardarDomicilio = () => guardar('domicilio', { domicilio: dom }, () => {
    const e = {};
    if (!dom.calle.trim()) e.calle = 'Escribe la calle';
    if (!/^\d{5}$/.test(dom.cp)) e.cp = '5 dígitos';
    if (!dom.municipio.trim()) e.municipio = 'Escribe el municipio';
    if (!dom.estado.trim()) e.estado = 'Escribe el estado';
    return e;
  });
  async function cambiarPass() {
    const e = {};
    if (!pass.actual) e.actual = 'Escribe tu contraseña actual';
    if (pass.nueva.length < 8 || !/[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(pass.nueva) || !/\d/.test(pass.nueva)) e.nueva = 'Mínimo 8, con letras y números';
    if (pass.nueva !== pass.otra) e.otra = 'No coincide';
    setErr(e); setError((x) => ({ ...x, pass: null }));
    if (Object.keys(e).length) return;
    setOcupado('pass');
    try { await api.put('/auth/contrasena', { actual: pass.actual, nueva: pass.nueva }); setPass({ actual: '', nueva: '', otra: '' }); avisar('pass'); }
    catch (ex) { if (ex.detalle?.campo) setErr({ [ex.detalle.campo]: ex.message }); else setError((x) => ({ ...x, pass: ex })); }
    finally { setOcupado(''); }
  }
  const ponerDom = (k) => (e) => setDom({ ...dom, [k]: k === 'cp' ? e.target.value.replace(/\D/g, '').slice(0, 5) : e.target.value });

  return (
    <>
      <Cabecera titulo="Mi cuenta" />
      <div className="space-y-4">
        <Seccion icono={marca.modo === 'claro' ? Sun : Moon} titulo="Apariencia">
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
        </Seccion>

        <Seccion icono={UserRound} titulo="Mis datos">
          <div className="text-[20px] font-black leading-tight">{[d.nombre, d.apellido_paterno, d.apellido_materno].filter(Boolean).join(' ')}</div>
          {d.matricula && <div className="text-muted font-bold mt-0.5">Matrícula {d.matricula}</div>}
          <div className="flex flex-wrap items-center gap-1.5 mt-3"><span className="text-[13px] font-bold text-muted">Entras con:</span>{d.entra_con.map((x) => <Chip key={x}>{x}</Chip>)}</div>
          <p className="text-[12px] font-semibold text-muted mt-3">Para corregir tu nombre, fecha de nacimiento o CURP, pídelo en recepción.</p>
        </Seccion>

        <Seccion icono={Phone} titulo="Teléfono y correo" accion={<Listo visible={listo === 'contacto'} />}>
          <div className="space-y-4">
            <Campo etiqueta="WhatsApp" inputMode="tel" value={contacto.telefono} onChange={(e) => setContacto({ ...contacto, telefono: e.target.value })} error={err.telefono} placeholder="2221234567"
              ayuda={d.es_responsable ? 'Con este número entras a la app.' : 'Aquí te avisan de tus clases y pagos.'} />
            <Campo etiqueta="Correo" type="email" value={contacto.email} onChange={(e) => setContacto({ ...contacto, email: e.target.value })} error={err.email} placeholder="tucorreo@ejemplo.com" ayuda="También puedes entrar con tu correo." />
            {cambiaAcceso && <Campo etiqueta="Tu contraseña (para confirmar que eres tú)" type="password" value={contacto.password} onChange={(e) => setContacto({ ...contacto, password: e.target.value })} error={err.password} autoComplete="current-password" />}
            <ErrorCaja error={error.contacto} />
            <Boton tono="suave" cargando={ocupado === 'contacto'} onClick={guardarContacto}>Guardar</Boton>
          </div>
        </Seccion>

        <Seccion icono={MapPin} titulo="Domicilio" accion={<Listo visible={listo === 'domicilio'} />}>
          <div className="grid grid-cols-3 gap-3">
            <Campo className="col-span-2" etiqueta="Calle" value={dom.calle} onChange={ponerDom('calle')} error={err.calle} />
            <Campo etiqueta="Número" value={dom.numero} onChange={ponerDom('numero')} />
            <Campo className="col-span-2" etiqueta="Colonia" value={dom.colonia} onChange={ponerDom('colonia')} />
            <Campo etiqueta="C.P." inputMode="numeric" value={dom.cp} onChange={ponerDom('cp')} error={err.cp} />
            <Campo className="col-span-3" etiqueta="Municipio" value={dom.municipio} onChange={ponerDom('municipio')} error={err.municipio} />
            <Campo className="col-span-3" etiqueta="Estado" value={dom.estado} onChange={ponerDom('estado')} error={err.estado} placeholder="Puebla" />
          </div>
          <div className="mt-4 space-y-3"><ErrorCaja error={error.domicilio} /><Boton tono="suave" cargando={ocupado === 'domicilio'} onClick={guardarDomicilio}>Guardar domicilio</Boton></div>
        </Seccion>

        <Seccion icono={KeyRound} titulo="Contraseña" accion={<Listo visible={listo === 'pass'} />}>
          <div className="space-y-4">
            <Campo etiqueta="Contraseña actual" type="password" value={pass.actual} onChange={(e) => setPass({ ...pass, actual: e.target.value })} error={err.actual} autoComplete="current-password" />
            <Campo etiqueta="Nueva" type="password" value={pass.nueva} onChange={(e) => setPass({ ...pass, nueva: e.target.value })} error={err.nueva} autoComplete="new-password" ayuda="Mínimo 8, con letras y números." />
            <Campo etiqueta="Repite la nueva" type="password" value={pass.otra} onChange={(e) => setPass({ ...pass, otra: e.target.value })} error={err.otra} autoComplete="new-password" />
            <ErrorCaja error={error.pass} />
            <Boton tono="suave" cargando={ocupado === 'pass'} onClick={cambiarPass}>Cambiar contraseña</Boton>
            {listo === 'pass' && <p className="text-[13px] font-semibold text-muted">Listo. Si tenías la app abierta en otro celular, ahí se cerró.</p>}
          </div>
        </Seccion>

        <Boton tono="contorno" icono={LogOut} onClick={async () => { await salir(); navegar('/entrar'); }}>Salir</Boton>
      </div>
    </>
  );
}
