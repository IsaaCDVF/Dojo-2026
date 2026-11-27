import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Copy, KeyRound, MessageCircle, Plus, Power, Search, ShieldCheck, Trash2, UserCog, UserPlus } from 'lucide-react';
import { api } from '../api';
import { NOMBRE_ROL, useSesion } from '../auth/Sesion';
import { Boton, BotonIcono, Campo, Cargando, Chip, Encabezado, ErrorCaja, Modal, Selector, Tarjeta, Vacio, useAvisos, useConfirmar, useDatos } from '../ui';

// Personal y accesos: quién entra al sistema, con qué rol y en qué sucursal.
// El súper admin da roles de admin de sucursal para abajo; el admin de sucursal, recepción, instructor y tableta en la suya.
// Al dar de alta se genera una contraseña temporal que la persona cambia la primera vez que entra.

const cx = (...c) => c.filter(Boolean).join(' ');
const VACIA = { nombre: '', apellido_paterno: '', apellido_materno: '', fecha_nacimiento: '', sexo: '', email: '', telefono: '' };
const nombreCompleto = (p) => [p.nombre, p.apellido_paterno, p.apellido_materno].filter(Boolean).join(' ');
const TONO_ROL = { super_admin: 'oro', admin_sucursal: 'accion', recepcion: 'info', instructor: 'ok', tableta: 'aviso' };

/** Campos de una persona del personal (los usa también el asistente de sucursal para el encargado) */
export function CamposPersona({ valor, onCambio, errores = {} }) {
  const poner = (k) => (e) => onCambio({ ...valor, [k]: e.target.value });
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <Campo etiqueta="Nombre(s)" value={valor.nombre} onChange={poner('nombre')} maxLength={60} error={errores.nombre} autoComplete="off" />
      <Campo etiqueta="Apellido paterno" value={valor.apellido_paterno} onChange={poner('apellido_paterno')} maxLength={60} error={errores.apellido_paterno} autoComplete="off" />
      <Campo etiqueta="Apellido materno (opcional)" value={valor.apellido_materno} onChange={poner('apellido_materno')} maxLength={60} autoComplete="off" />
      <Campo etiqueta="Fecha de nacimiento" type="date" value={valor.fecha_nacimiento} onChange={poner('fecha_nacimiento')} error={errores.fecha_nacimiento} />
      <Campo etiqueta="Correo (con este entra)" type="email" value={valor.email} onChange={poner('email')} error={errores.email} autoComplete="off" placeholder="nombre@correo.com" />
      <Campo etiqueta="WhatsApp (opcional)" inputMode="tel" value={valor.telefono} onChange={poner('telefono')} error={errores.telefono} placeholder="2221234567"
        ayuda="Para mandarle su contraseña temporal" />
    </div>
  );
}

/** Revisa en el navegador lo mismo que la API, para marcar el campo antes de enviar */
export function revisarPersona(p) {
  const e = {};
  if (!p.nombre.trim()) e.nombre = 'Escribe el nombre';
  if (!p.apellido_paterno.trim()) e.apellido_paterno = 'Escribe el apellido paterno';
  if (!p.fecha_nacimiento) e.fecha_nacimiento = 'Elige la fecha';
  if (!/^\S+@\S+\.\S+$/.test(p.email.trim())) e.email = 'Escribe un correo válido';
  if (p.telefono && p.telefono.replace(/\D/g, '').length !== 10) e.telefono = 'Debe tener 10 dígitos';
  return e;
}

/** Contraseña temporal recién creada: se ve una sola vez, con copiar y mandar por WhatsApp */
export function AccesoNuevo({ acceso, titulo = 'Acceso listo' }) {
  const avisar = useAvisos();
  const [copiado, setCopiado] = useState(false);
  if (!acceso) return null;
  const copiar = async () => {
    try { await navigator.clipboard.writeText(acceso.mensaje); setCopiado(true); avisar('Mensaje copiado'); } catch { avisar('No se pudo copiar', 'error'); }
  };
  const wa = acceso.telefono ? `https://wa.me/52${acceso.telefono}?text=${encodeURIComponent(acceso.mensaje)}` : null;
  return (
    <div className="rounded-[12px] border border-action/40 bg-action/8 p-4">
      <div className="flex items-center gap-2 font-semibold"><ShieldCheck className="size-4 text-action" /> {titulo}</div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 mt-3 text-[14px]">
        <dt className="text-muted">Correo</dt><dd className="font-medium break-all">{acceso.email}</dd>
        <dt className="text-muted">Contraseña temporal</dt><dd className="font-mono text-[17px] tracking-wider select-all">{acceso.password_temporal}</dd>
      </dl>
      <p className="text-[12px] text-muted mt-2">Solo se muestra esta vez. Al entrar, el sistema le pide crear su propia contraseña.</p>
      <div className="flex flex-wrap gap-2 mt-3">
        {wa && <a href={wa} target="_blank" rel="noreferrer"><Boton tam="sm" icono={MessageCircle} type="button">Mandar por WhatsApp</Boton></a>}
        <Boton tam="sm" variante="secundario" icono={copiado ? Check : Copy} onClick={copiar} type="button">{copiado ? 'Copiado' : 'Copiar mensaje'}</Boton>
      </div>
    </div>
  );
}

/** Renglones rol + sucursal */
function Roles({ lista, onCambio, opciones }) {
  const poner = (i, k, v) => onCambio(lista.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  return (
    <div className="space-y-2">
      {lista.map((r, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
          <Selector etiqueta={i === 0 ? 'Rol' : undefined} value={r.rol} onChange={(e) => poner(i, 'rol', e.target.value)}>
            <option value="">Elige…</option>
            {opciones.roles.filter((o) => o.nombre !== 'tableta').map((o) => <option key={o.id} value={o.nombre}>{NOMBRE_ROL[o.nombre]}</option>)}
          </Selector>
          <Selector etiqueta={i === 0 ? 'Sucursal' : undefined} value={r.sucursal_id} onChange={(e) => poner(i, 'sucursal_id', e.target.value)}>
            <option value="">Elige…</option>
            {opciones.sucursales.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </Selector>
          <BotonIcono icono={Trash2} etiqueta="Quitar renglón" onClick={() => onCambio(lista.filter((_, j) => j !== i))} disabled={lista.length === 1} className="mb-1" />
        </div>
      ))}
      <Boton variante="fantasma" tam="sm" icono={Plus} type="button" onClick={() => onCambio([...lista, { rol: '', sucursal_id: opciones.sucursales.length === 1 ? String(opciones.sucursales[0].id) : '' }])}>
        Otro rol (por ejemplo, instructor en otra sucursal)
      </Boton>
    </div>
  );
}

function Alta({ abierto, onCerrar, opciones, onListo }) {
  const unica = opciones?.sucursales?.length === 1 ? String(opciones.sucursales[0].id) : '';
  const [p, setP] = useState(VACIA);
  const [roles, setRoles] = useState([{ rol: '', sucursal_id: unica }]);
  const [err, setErr] = useState({}); const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [acceso, setAcceso] = useState(null);
  const cerrar = () => { setP(VACIA); setRoles([{ rol: '', sucursal_id: unica }]); setErr({}); setError(null); setAcceso(null); onCerrar(); };

  async function guardar() {
    const e = revisarPersona(p);
    if (roles.some((r) => !r.rol || !r.sucursal_id)) e.roles = 'Elige el rol y la sucursal de cada renglón';
    setErr(e); setError(null);
    if (Object.keys(e).length) return;
    setGuardando(true);
    try {
      const r = await api.post('/personal', { ...p, roles: roles.map((x) => ({ rol: x.rol, sucursal_id: Number(x.sucursal_id) })) });
      setAcceso(r); onListo();
    } catch (ex) {
      const campo = ex.detalle?.campo;
      if (campo && campo !== 'roles') setErr({ [campo]: ex.message }); else setError(ex);
    } finally { setGuardando(false); }
  }

  return (
    <Modal abierto={abierto} onCerrar={cerrar} ancho="max-w-2xl" titulo={acceso ? `${p.nombre} ya tiene acceso` : 'Nueva persona'}
      subtitulo={acceso ? 'Pásale estos datos para que entre' : 'Sus datos y qué hace en cada sucursal'}
      pie={acceso ? <Boton onClick={cerrar}>Listo</Boton> : <><Boton variante="secundario" onClick={cerrar}>Cancelar</Boton><Boton icono={UserPlus} cargando={guardando} onClick={guardar}>Dar acceso</Boton></>}>
      {acceso ? <AccesoNuevo acceso={acceso} /> : opciones && (
        <div className="space-y-6">
          <CamposPersona valor={p} onCambio={setP} errores={err} />
          <div>
            <div className="etiqueta mb-2">Accesos</div>
            <Roles lista={roles} onCambio={setRoles} opciones={opciones} />
            {err.roles && <p className="mt-1.5 text-[13px] text-danger">{err.roles}</p>}
            <ul className="mt-3 text-[12px] text-muted space-y-0.5">
              {opciones.roles.filter((o) => o.nombre !== 'tableta').map((o) => <li key={o.id}><b className="text-soft">{NOMBRE_ROL[o.nombre]}:</b> {o.descripcion}</li>)}
              <li>La <b className="text-soft">tableta de la entrada</b> no es una persona: se conecta con un código en <Link to="/configuracion/tabletas" className="text-action hover:underline">Configuración → Tabletas</Link>.</li>
            </ul>
          </div>
          <ErrorCaja error={error} />
        </div>
      )}
    </Modal>
  );
}

function FichaPersona({ id, onCerrar, opciones, onCambio }) {
  const avisar = useAvisos();
  const confirmar = useConfirmar();
  const datos = useDatos(() => (id ? api.get(`/personal/${id}`) : Promise.resolve(null)), [id]);
  const [edit, setEdit] = useState(null);
  const [nuevoRol, setNuevoRol] = useState(null);
  const [acceso, setAcceso] = useState(null);
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const f = datos.datos;
  const cerrar = () => { setEdit(null); setNuevoRol(null); setAcceso(null); setError(null); onCerrar(); };
  const hecho = (msg) => { avisar(msg); datos.recargar(); onCambio(); };
  const correr = async (fn) => { setOcupado(true); setError(null); try { await fn(); } catch (e) { setError(e); } finally { setOcupado(false); } };

  const guardarDatos = () => correr(async () => {
    await api.put(`/personal/${id}`, { nombre: edit.nombre, apellido_paterno: edit.apellido_paterno, apellido_materno: edit.apellido_materno, email: edit.email, telefono: edit.telefono });
    setEdit(null); hecho('Datos guardados');
  });
  const darRol = () => correr(async () => {
    await api.post(`/personal/${id}/roles`, { rol: nuevoRol.rol, sucursal_id: Number(nuevoRol.sucursal_id) });
    setNuevoRol(null); hecho('Rol agregado');
  });
  const quitarRol = async (r) => {
    if (!(await confirmar({ titulo: 'Quitar acceso', texto: `${f.nombre} ya no podrá trabajar como ${NOMBRE_ROL[r.rol]} en ${r.sucursal}. Si tiene esa sesión abierta, se cierra.`, aceptar: 'Quitar', peligro: true }))) return;
    correr(async () => { await api.del(`/personal/${id}/roles/${r.usuario_rol_id}`); hecho('Acceso quitado'); });
  };
  const restablecer = async () => {
    if (!(await confirmar({ titulo: 'Contraseña temporal nueva', texto: `Se cierra su sesión y ${f.nombre} entra con una contraseña temporal que luego cambia.`, aceptar: 'Generar' }))) return;
    correr(async () => { setAcceso(await api.post(`/personal/${id}/contrasena`)); hecho('Contraseña temporal generada'); });
  };
  const alternar = async () => {
    const act = f.activo;
    if (act && !(await confirmar({ titulo: 'Desactivar', texto: `${f.nombre} ya no podrá entrar al sistema. Su historial se conserva y lo puedes volver a activar.`, aceptar: 'Desactivar', peligro: true }))) return;
    correr(async () => { await api.put(`/personal/${id}`, { activo: act ? 0 : 1 }); hecho(act ? 'Desactivado' : 'Activado de nuevo'); });
  };

  return (
    <Modal abierto={!!id} onCerrar={cerrar} lateral titulo={f ? nombreCompleto(f) : 'Persona'} subtitulo={f?.email}>
      {datos.cargando && !f ? <Cargando /> : datos.error ? <ErrorCaja error={datos.error} reintentar={datos.recargar} /> : f && (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            {f.activo ? <Chip tono="ok">Activo</Chip> : <Chip>Desactivado</Chip>}
            {!!f.debe_cambiar_password && <Chip tono="oro">Aún no cambia su contraseña temporal</Chip>}
            {!f.editable && <Chip>Solo lectura</Chip>}
          </div>
          <AccesoNuevo acceso={acceso} titulo="Contraseña temporal nueva" />

          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="etiqueta">Datos</h3>
              {f.editable && !edit && <Boton variante="fantasma" tam="sm" onClick={() => setEdit({ nombre: f.nombre, apellido_paterno: f.apellido_paterno, apellido_materno: f.apellido_materno || '', email: f.email, telefono: f.telefono || '' })}>Editar</Boton>}
            </div>
            {edit ? (
              <div className="space-y-3">
                <div className="grid sm:grid-cols-2 gap-3">
                  <Campo etiqueta="Nombre(s)" value={edit.nombre} onChange={(e) => setEdit({ ...edit, nombre: e.target.value })} />
                  <Campo etiqueta="Apellido paterno" value={edit.apellido_paterno} onChange={(e) => setEdit({ ...edit, apellido_paterno: e.target.value })} />
                  <Campo etiqueta="Apellido materno" value={edit.apellido_materno} onChange={(e) => setEdit({ ...edit, apellido_materno: e.target.value })} />
                  <Campo etiqueta="WhatsApp" value={edit.telefono} onChange={(e) => setEdit({ ...edit, telefono: e.target.value })} />
                </div>
                <Campo etiqueta="Correo" type="email" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} />
                <div className="flex gap-2 justify-end"><Boton variante="secundario" tam="sm" onClick={() => setEdit(null)}>Cancelar</Boton><Boton tam="sm" cargando={ocupado} onClick={guardarDatos}>Guardar</Boton></div>
              </div>
            ) : (
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[14px]">
                <dt className="text-muted">Correo</dt><dd className="break-all">{f.email}</dd>
                <dt className="text-muted">WhatsApp</dt><dd>{f.telefono || '—'}</dd>
                <dt className="text-muted">Última vez</dt><dd>{f.ultima_vez ? new Date(f.ultima_vez.replace(' ', 'T')).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }) : 'Todavía no entra'}</dd>
              </dl>
            )}
          </section>

          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="etiqueta">Accesos</h3>
              {f.editable && !nuevoRol && <Boton variante="fantasma" tam="sm" icono={Plus} onClick={() => setNuevoRol({ rol: '', sucursal_id: opciones?.sucursales?.length === 1 ? String(opciones.sucursales[0].id) : '' })}>Dar otro rol</Boton>}
            </div>
            <ul className="divide-y divide-line rounded-[10px] border border-line">
              {f.roles.filter((r) => r.activo).map((r) => (
                <li key={r.usuario_rol_id} className="flex items-center gap-3 px-3 py-2.5">
                  <Chip tono={TONO_ROL[r.rol]}>{NOMBRE_ROL[r.rol]}</Chip>
                  <span className="flex-1 text-[14px]">{r.sucursal || 'Todas las sucursales'}</span>
                  {f.editable && r.se_puede_quitar && <BotonIcono icono={Trash2} etiqueta="Quitar este acceso" onClick={() => quitarRol(r)} />}
                </li>
              ))}
              {!f.roles.some((r) => r.activo) && <li className="px-3 py-3 text-[14px] text-muted">Sin accesos activos: no puede entrar.</li>}
            </ul>
            {nuevoRol && opciones && (
              <div className="mt-3 grid grid-cols-[1fr_1fr] gap-2">
                <Selector value={nuevoRol.rol} onChange={(e) => setNuevoRol({ ...nuevoRol, rol: e.target.value })} aria-label="Rol">
                  <option value="">Rol…</option>
                  {opciones.roles.filter((o) => o.nombre !== 'tableta').map((o) => <option key={o.id} value={o.nombre}>{NOMBRE_ROL[o.nombre]}</option>)}
                </Selector>
                <Selector value={nuevoRol.sucursal_id} onChange={(e) => setNuevoRol({ ...nuevoRol, sucursal_id: e.target.value })} aria-label="Sucursal">
                  <option value="">Sucursal…</option>
                  {opciones.sucursales.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </Selector>
                <div className="col-span-2 flex justify-end gap-2">
                  <Boton variante="secundario" tam="sm" onClick={() => setNuevoRol(null)}>Cancelar</Boton>
                  <Boton tam="sm" cargando={ocupado} disabled={!nuevoRol.rol || !nuevoRol.sucursal_id} onClick={darRol}>Agregar</Boton>
                </div>
              </div>
            )}
            {f.roles.some((r) => !r.activo) && (
              <p className="text-[12px] text-muted mt-2">Antes: {f.roles.filter((r) => !r.activo).map((r) => `${NOMBRE_ROL[r.rol]} en ${r.sucursal || 'todas'}`).join(' · ')}</p>
            )}
          </section>

          <ErrorCaja error={error} />
          {f.editable && (
            <section className="flex flex-wrap gap-2 pt-2 border-t border-line">
              {!!f.activo && <Boton variante="secundario" tam="sm" icono={KeyRound} cargando={ocupado} onClick={restablecer}>Contraseña temporal nueva</Boton>}
              <Boton variante={f.activo ? 'peligro' : 'secundario'} tam="sm" icono={Power} onClick={alternar}>{f.activo ? 'Desactivar' : 'Activar de nuevo'}</Boton>
            </section>
          )}
        </div>
      )}
    </Modal>
  );
}

export default function Personal() {
  const { rol } = useSesion();
  const [q, setQ] = useState('');
  const [sucursal, setSucursal] = useState('');
  const [inactivos, setInactivos] = useState(false);
  const [alta, setAlta] = useState(false);
  const [abierta, setAbierta] = useState(null);
  const opciones = useDatos(() => api.get('/personal/opciones'), []);
  const lista = useDatos(() => api.get('/personal', { sucursal_id: sucursal, inactivos: inactivos ? 1 : '' }), [sucursal, inactivos]);
  const filas = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (lista.datos || []).filter((p) => !t || `${nombreCompleto(p)} ${p.email}`.toLowerCase().includes(t));
  }, [lista.datos, q]);
  const global = rol?.alcance === 'global';

  return (
    <>
      <Encabezado ruta="Configuración" titulo="Personal y accesos"
        descripcion={global ? 'Quién entra al sistema, con qué rol y en qué sucursal. Puedes dar a una persona roles distintos en varias sucursales.' : 'Recepción, instructores y tabletas de tu sucursal.'}
        acciones={<Boton icono={UserPlus} onClick={() => setAlta(true)} disabled={!opciones.datos}>Persona</Boton>} />
      <Tarjeta cuerpo="p-0" titulo="Personal" icono={UserCog}
        acciones={<div className="flex flex-wrap items-center gap-2">
          <div className="w-56"><Campo icono={Search} placeholder="Buscar nombre o correo" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar" /></div>
          {global && <div className="w-48"><Selector value={sucursal} onChange={(e) => setSucursal(e.target.value)} aria-label="Sucursal">
            <option value="">Todas las sucursales</option>
            {(opciones.datos?.sucursales || []).map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </Selector></div>}
          <label className="flex items-center gap-2 text-[13px] text-muted cursor-pointer"><input type="checkbox" checked={inactivos} onChange={(e) => setInactivos(e.target.checked)} /> Ver desactivados</label>
        </div>}>
        <div className="px-5 pt-3"><ErrorCaja error={lista.error || opciones.error} reintentar={lista.recargar} /></div>
        {lista.cargando && !lista.datos ? <Cargando /> : !filas.length ? <Vacio icono={UserCog} titulo="Nadie por aquí" texto="Da de alta a tu equipo con el botón Persona." /> : (
          <ul className="divide-y divide-line">
            {filas.map((p) => (
              <li key={p.usuario_id}>
                <button onClick={() => setAbierta(p.usuario_id)} className={cx('w-full flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5 text-left hover:bg-inset cursor-pointer', !p.activo && 'opacity-60')}>
                  <span className="grid place-items-center size-9 rounded-full bg-action/12 text-action font-semibold text-[13px] shrink-0">{p.nombre[0]}{p.apellido_paterno[0]}</span>
                  <div className="flex-1 min-w-[180px]">
                    <div className="font-medium">{nombreCompleto(p)}</div>
                    <div className="text-[12px] text-muted break-all">{p.email}</div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-w-[520px]">
                    {p.roles.filter((r) => r.activo).map((r) => <Chip key={r.usuario_rol_id} tono={TONO_ROL[r.rol]}>{NOMBRE_ROL[r.rol]}{r.clave ? ` · ${r.clave}` : ''}</Chip>)}
                  </div>
                  <div className="w-40 text-right">
                    {!p.activo ? <Chip>Desactivado</Chip> : p.debe_cambiar_password ? <Chip tono="oro">Contraseña temporal</Chip> : <span className="text-[12px] text-muted">{p.ultima_vez ? 'Activo' : 'Todavía no entra'}</span>}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>
      <Alta abierto={alta} onCerrar={() => setAlta(false)} opciones={opciones.datos} onListo={lista.recargar} />
      <FichaPersona id={abierta} onCerrar={() => setAbierta(null)} opciones={opciones.datos} onCambio={lista.recargar} />
    </>
  );
}
