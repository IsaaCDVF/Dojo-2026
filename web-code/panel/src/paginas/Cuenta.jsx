import { useEffect, useState } from 'react';
import { NavLink, Navigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Building2, Check, HelpCircle, Keyboard, KeyRound, LifeBuoy, Monitor, Moon, Settings2, ShieldCheck, Smartphone, Sun, UserRound } from 'lucide-react';
import { api, formato } from '../api';
import { useSesion } from '../auth/Sesion';
import { useMarca } from '../marca/Marca';
import { IDIOMAS } from '../i18n';
import { Boton, Campo, Cargando, Chip, Encabezado, ErrorCaja, Selector, Tarjeta, useAvisos, useDatos } from '../ui';
import { FormContrasena } from './CambiarContrasena';
import { MENU } from '../layout/menu';

// Mi cuenta, por secciones (como las cuentas de Google o de cualquier sistema de empresa):
// datos personales, preferencias (idioma, tema y letra: para TODOS los roles), seguridad, atajos y ayuda.

const cx = (...c) => c.filter(Boolean).join(' ');
export const SECCIONES = [
  { id: 'perfil', icono: UserRound },
  { id: 'preferencias', icono: Settings2 },
  { id: 'seguridad', icono: ShieldCheck },
  { id: 'atajos', icono: Keyboard },
  { id: 'ayuda', icono: HelpCircle },
];

/** Atajos: g + letra lleva a la pantalla (solo las que tu rol puede abrir) */
export const IR_A = [['i', '/'], ['a', '/alumnos'], ['n', '/inscripcion'], ['c', '/caja'], ['v', '/avisos'], ['h', '/horarios'], ['s', '/asistencia'], ['e', '/examenes'], ['k', '/cuenta']];

function Opciones({ valor, opciones, onCambio, etiqueta }) {
  return (
    <div role="radiogroup" aria-label={etiqueta} className="inline-flex flex-wrap gap-1 rounded-full border border-line bg-inset p-1">
      {opciones.map((o) => (
        <button key={o.v} role="radio" aria-checked={valor === o.v} onClick={() => onCambio(o.v)}
          className={cx('inline-flex items-center gap-1.5 h-9 px-4 rounded-full text-sm font-semibold cursor-pointer transition-colors',
            valor === o.v ? 'bg-action text-on-action' : 'text-soft hover:text-text')}>
          {o.icono && <o.icono className="size-4" />}{o.t}
        </button>
      ))}
    </div>
  );
}

function Fila({ titulo, sub, children, accion }) {
  return (
    <div className="flex flex-wrap items-start gap-x-6 gap-y-3 py-5 first:pt-0 last:pb-0 border-b border-line last:border-0">
      <div className="w-full sm:w-56 shrink-0">
        <div className="font-semibold text-[15px]">{titulo}</div>
        {sub && <div className="text-[13px] text-muted mt-0.5">{sub}</div>}
      </div>
      <div className="flex-1 min-w-[240px]">{children}</div>
      {accion}
    </div>
  );
}

function Perfil() {
  const { t } = useTranslation();
  const avisar = useAvisos();
  const { recargar } = useSesion();
  const d = useDatos(() => api.get('/auth/perfil'), []);
  const [f, setF] = useState(null);
  const [err, setErr] = useState({});
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);
  useEffect(() => { if (d.datos) setF({ email: d.datos.email, telefono: d.datos.telefono || '', password: '' }); }, [d.datos]);
  if (!d.datos || !f) return d.error ? <ErrorCaja error={d.error} reintentar={d.recargar} /> : <Cargando />;
  const p = d.datos;
  const cambioCorreo = f.email.trim().toLowerCase() !== p.email;
  const cambio = cambioCorreo || f.telefono.replace(/\D/g, '') !== (p.telefono || '');
  const guardar = async () => {
    setGuardando(true); setErr({}); setError(null);
    try {
      await api.put('/auth/perfil', { telefono: f.telefono, ...(cambioCorreo ? { email: f.email, password: f.password } : {}) });
      avisar(t('cuenta.perfil.guardado')); d.recargar(); recargar?.();
    } catch (e) { if (e.detalle?.campo) setErr({ [e.detalle.campo]: e.message }); else setError(e); }
    finally { setGuardando(false); }
  };
  return (
    <div className="space-y-4">
      <Tarjeta titulo={t('cuenta.menu.perfil')} subtitulo={t('cuenta.perfil.sub')}>
        <Fila titulo={t('cuenta.perfil.nombre')} sub={t('cuenta.perfil.nombreAyuda')}>
          <div className="text-[16px]">{[p.nombre, p.apellido_paterno, p.apellido_materno].filter(Boolean).join(' ')}</div>
        </Fila>
        <Fila titulo={t('cuenta.perfil.correo')} sub={t('cuenta.perfil.correoAyuda')}>
          <Campo type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} error={err.email} autoComplete="email" />
          {cambioCorreo && <Campo className="mt-3" etiqueta={t('cuenta.perfil.password')} ayuda={t('cuenta.perfil.passwordAyuda')} type="password" value={f.password}
            onChange={(e) => setF({ ...f, password: e.target.value })} error={err.password} autoComplete="current-password" />}
        </Fila>
        <Fila titulo={t('cuenta.perfil.telefono')} sub={t('cuenta.perfil.telefonoAyuda')}>
          <Campo inputMode="tel" value={f.telefono} onChange={(e) => setF({ ...f, telefono: e.target.value.replace(/[^\d ]/g, '').slice(0, 14) })} error={err.telefono} placeholder="222 123 4567" className="max-w-xs" autoComplete="tel" />
        </Fila>
        <ErrorCaja error={error} />
        {cambio && <div className="flex justify-end gap-2 mt-4">
          <Boton variante="secundario" onClick={() => setF({ email: p.email, telefono: p.telefono || '', password: '' })}>{t('comun.descartar')}</Boton>
          <Boton icono={Check} cargando={guardando} onClick={guardar}>{t('cuenta.perfil.guardar')}</Boton>
        </div>}
      </Tarjeta>
      <Tarjeta titulo={t('cuenta.perfil.accesos')} subtitulo={t('cuenta.perfil.accesosSub')} icono={Building2}>
        <ul className="flex flex-wrap gap-2">
          {p.roles.map((r) => <li key={r.usuario_rol_id}><Chip tono="accion">{t(`roles.${r.rol}`)} · {r.sucursal || t('comun.todasSucursales')}</Chip></li>)}
        </ul>
      </Tarjeta>
    </div>
  );
}

function Preferencias() {
  const { marca, pref, guardarPreferencias } = useMarca();
  const { t } = useTranslation();
  const avisar = useAvisos();
  const guardar = async (cambio) => {
    try { await guardarPreferencias(cambio); avisar(t('comun.guardado')); } catch (e) { avisar(e.message, 'error'); }
  };
  return (
    <Tarjeta titulo={t('perfil.preferencias')} subtitulo={t('perfil.preferenciasSub')}>
      <Fila titulo={t('perfil.idioma')}>
        <Selector value={pref.idioma || ''} onChange={(e) => guardar({ idioma: e.target.value || null })} className="max-w-xs" aria-label={t('perfil.idioma')}>
          <option value="">{t('perfil.idiomaEmpresa', { idioma: t(`idiomas.${marca.idioma}`) })}</option>
          {IDIOMAS.map((l) => <option key={l} value={l}>{t(`idiomas.${l}`)}</option>)}
        </Selector>
      </Fila>
      <Fila titulo={t('perfil.tema')}>
        <Opciones etiqueta={t('perfil.tema')} valor={pref.tema || 'sistema'} onCambio={(v) => guardar({ tema: v })}
          opciones={[{ v: 'sistema', t: t('perfil.temaSistema'), icono: Monitor }, { v: 'claro', t: t('perfil.temaClaro'), icono: Sun }, { v: 'oscuro', t: t('perfil.temaOscuro'), icono: Moon }]} />
      </Fila>
      <Fila titulo={t('perfil.letra')}>
        <Opciones etiqueta={t('perfil.letra')} valor={pref.letra || 'normal'} onCambio={(v) => guardar({ letra: v })}
          opciones={[{ v: 'normal', t: t('perfil.letraNormal') }, { v: 'grande', t: t('perfil.letraGrande') }, { v: 'muy_grande', t: t('perfil.letraMuyGrande') }]} />
      </Fila>
    </Tarjeta>
  );
}

function Seguridad() {
  const { t } = useTranslation();
  const avisar = useAvisos();
  const [cambiar, setCambiar] = useState(false);
  const s = useDatos(() => api.get('/auth/sesiones'), []);
  const otras = (s.datos || []).filter((x) => !x.actual);
  const cerrar = async (id) => {
    try { const r = await api.post('/auth/sesiones/cerrar', id ? { id } : {}); avisar(t('cuenta.seguridad.cerradas', { count: r.cerradas }), 'info'); s.recargar(); }
    catch (e) { avisar(e.message, 'error'); }
  };
  return (
    <div className="space-y-4">
      <Tarjeta titulo={t('cuenta.menu.seguridad')} subtitulo={t('cuenta.seguridad.sub')}>
        <Fila titulo={t('cuenta.seguridad.contrasena')} sub={t('cuenta.seguridad.contrasenaSub')}
          accion={!cambiar && <Boton variante="secundario" icono={KeyRound} onClick={() => setCambiar(true)}>{t('cuenta.seguridad.cambiar')}</Boton>}>
          {cambiar ? (
            <div className="max-w-sm">
              <FormContrasena enfocar onListo={() => { avisar(t('cuenta.seguridad.lista')); setCambiar(false); s.recargar(); }} />
              <button onClick={() => setCambiar(false)} className="mt-3 text-[13px] text-muted hover:text-text cursor-pointer">{t('cuenta.seguridad.cancelar')}</button>
            </div>
          ) : <div className="tracking-[.3em] text-muted">••••••••</div>}
        </Fila>
      </Tarjeta>
      <Tarjeta titulo={t('cuenta.seguridad.sesiones')} subtitulo={t('cuenta.seguridad.sesionesSub')} cuerpo="p-0"
        acciones={otras.length > 0 && <Boton variante="secundario" tam="sm" onClick={() => cerrar(null)}>{t('cuenta.seguridad.cerrarOtras')}</Boton>}>
        <div className="px-5 pt-3"><ErrorCaja error={s.error} reintentar={s.recargar} /></div>
        {!s.datos ? <Cargando /> : (
          <ul className="divide-y divide-line">
            {s.datos.map((x) => (
              <li key={x.id} className="flex items-center gap-4 px-5 py-3.5">
                <span className="grid place-items-center size-10 rounded-full bg-inset text-muted">{/Android|iPhone|iPad/.test(x.equipo) ? <Smartphone className="size-5" /> : <Monitor className="size-5" />}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium flex items-center gap-2">{x.equipo}{x.actual && <Chip tono="ok">{t('cuenta.seguridad.esteEquipo')}</Chip>}</div>
                  <div className="text-[12px] text-muted">{x.ip ? `${x.ip} · ` : ''}{t('cuenta.seguridad.ultima', { f: formato.fechaHora(x.ultima_actividad) })}</div>
                </div>
                {!x.actual && <Boton variante="fantasma" tam="sm" onClick={() => cerrar(x.id)}>{t('cuenta.seguridad.cerrar')}</Boton>}
              </li>
            ))}
          </ul>
        )}
        {s.datos && !otras.length && <p className="px-5 pb-4 text-[13px] text-muted">{t('cuenta.seguridad.soloEsta')}</p>}
      </Tarjeta>
    </div>
  );
}

export function Tecla({ children }) {
  return <kbd className="inline-grid place-items-center min-w-7 h-7 px-2 rounded-md border border-line-strong border-b-2 bg-inset font-mono text-[12px] font-semibold">{children}</kbd>;
}

export function ListaAtajos() {
  const { t } = useTranslation();
  const { tiene } = useSesion();
  const pantallas = IR_A.map(([k, a]) => [k, MENU.find((m) => m.a === a), a])
    .filter(([, m, a]) => a === '/cuenta' || (m && (!m.permisos.length || tiene(...m.permisos))));
  const fila = (teclas, texto) => (
    <li className="flex items-center justify-between gap-4 py-2.5">
      <span className="text-[14px]">{texto}</span>
      <span className="flex items-center gap-1.5 text-[12px] text-muted">{teclas}</span>
    </li>
  );
  return (
    <ul className="divide-y divide-line">
      {fila(<Tecla>?</Tecla>, t('cuenta.atajos.abrir'))}
      {fila(<Tecla>/</Tecla>, t('cuenta.atajos.buscar'))}
      {fila(<Tecla>T</Tecla>, t('cuenta.atajos.tema'))}
      {fila(<Tecla>Esc</Tecla>, t('cuenta.atajos.cerrar'))}
      {pantallas.map(([k, m]) => (
        <li key={k} className="flex items-center justify-between gap-4 py-2.5">
          <span className="text-[14px]">{t('cuenta.atajos.ir', { pantalla: m ? t(m.t) : t('cuenta.atajos.cuenta') })}</span>
          <span className="flex items-center gap-1.5 text-[12px] text-muted"><Tecla>G</Tecla>{t('cuenta.atajos.luego')}<Tecla>{k.toUpperCase()}</Tecla></span>
        </li>
      ))}
    </ul>
  );
}

function Ayuda() {
  const { t } = useTranslation();
  const { rol } = useSesion();
  const guia = t(`cuenta.ayuda.guias.${rol?.nombre || 'recepcion'}`, { returnObjects: true });
  return (
    <div className="space-y-4">
      <Tarjeta titulo={t('cuenta.ayuda.guia', { rol: rol?.nombre ? t(`roles.${rol.nombre}`) : '' })} subtitulo={t('cuenta.ayuda.sub')} icono={HelpCircle}>
        <ul className="space-y-2.5">
          {(Array.isArray(guia) ? guia : []).map((x) => <li key={x} className="flex gap-2.5 text-[14px]"><Check className="size-4 text-action shrink-0 mt-0.5" />{x}</li>)}
        </ul>
      </Tarjeta>
      <Tarjeta titulo={t('cuenta.ayuda.soporte')} icono={LifeBuoy}>
        <p className="text-[14px]">{t('cuenta.ayuda.soporteTexto')}</p>
        <p className="text-[12px] text-muted mt-4">{t('cuenta.ayuda.version')} 0.5 · Dojo OS</p>
      </Tarjeta>
    </div>
  );
}

export default function Cuenta() {
  const { seccion = 'perfil' } = useParams();
  const { t } = useTranslation();
  const { usuario } = useSesion();
  if (!SECCIONES.some((s) => s.id === seccion)) return <Navigate to="/cuenta" replace />;
  return (
    <>
      <Encabezado ruta={t('cuenta.titulo')} titulo={t(`cuenta.menu.${seccion}`)} descripcion={seccion === 'perfil' ? t('perfil.hola', { nombre: usuario?.nombre || '' }) + ' · ' + t('cuenta.sub') : null} />
      <div className="grid lg:grid-cols-[220px_1fr] gap-6 items-start">
        <nav className="flex lg:flex-col gap-1 overflow-x-auto [scrollbar-width:none] -mx-1 px-1 lg:sticky lg:top-4" aria-label={t('cuenta.titulo')}>
          {SECCIONES.map((s) => (
            <NavLink key={s.id} to={s.id === 'perfil' ? '/cuenta' : `/cuenta/${s.id}`} end
              className={({ isActive }) => cx('shrink-0 flex items-center gap-2.5 h-10 px-3.5 rounded-full text-[14px] font-medium whitespace-nowrap transition-colors',
                isActive ? 'bg-action/12 text-action font-semibold' : 'text-soft hover:text-text hover:bg-inset')}>
              <s.icono className="size-[18px]" />{t(`cuenta.menu.${s.id}`)}
            </NavLink>
          ))}
        </nav>
        <div className="min-w-0 max-w-3xl">
          {seccion === 'perfil' && <Perfil />}
          {seccion === 'preferencias' && <Preferencias />}
          {seccion === 'seguridad' && <Seguridad />}
          {seccion === 'atajos' && <Tarjeta titulo={t('cuenta.menu.atajos')} subtitulo={t('cuenta.atajos.sub')} icono={Keyboard}><ListaAtajos /></Tarjeta>}
          {seccion === 'ayuda' && <Ayuda />}
        </div>
      </div>
    </>
  );
}
