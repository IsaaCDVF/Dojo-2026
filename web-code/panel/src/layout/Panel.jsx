import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Building2, ChevronDown, Check, LogOut, Menu as MenuIcon, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSesion } from '../auth/Sesion';
import { useMarca } from '../marca/Marca';
import { BotonIcono, BotonTema, Logo, useAvisos } from '../ui';
import { api } from '../api';
import { MENU } from './menu';

const cx = (...c) => c.filter(Boolean).join(' ');

function Iniciales({ nombre }) {
  const ini = (nombre || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  return <span className="grid place-items-center size-9 rounded-full bg-gold/20 text-gold font-bold text-sm">{ini}</span>;
}

/** Selector de rol y sucursal (si la persona tiene varios roles) */
function SelectorRol() {
  const { rol, roles, elegirRol } = useSesion();
  const { t } = useTranslation();
  const avisar = useAvisos();
  const navegar = useNavigate();
  const [abierto, setAbierto] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const fuera = (e) => !ref.current?.contains(e.target) && setAbierto(false);
    document.addEventListener('mousedown', fuera);
    return () => document.removeEventListener('mousedown', fuera);
  }, []);
  if (!rol) return null;
  const varios = roles.length > 1;
  const cambiar = async (r) => {
    setAbierto(false);
    if (r.usuario_rol_id === rol.usuario_rol_id) return;
    try {
      await elegirRol(r.usuario_rol_id);
      avisar(r.sucursal ? t('panel.ahoraTrabajasEn', { rol: t(`roles.${r.rol}`), sucursal: r.sucursal }) : t('panel.ahoraTrabajas', { rol: t(`roles.${r.rol}`) }));
      navegar('/');
    } catch (e) { avisar(e.message, 'error'); }
  };
  const actual = roles.find((r) => r.usuario_rol_id === rol.usuario_rol_id);
  return (
    <div ref={ref} className="relative">
      <button disabled={!varios} onClick={() => setAbierto((a) => !a)}
        className={cx('flex items-center gap-2 h-9 pl-3 pr-2.5 rounded-full border border-line bg-inset text-sm whitespace-nowrap min-w-0', varios && 'cursor-pointer hover:border-line-strong')}>
        <Building2 className="size-4 text-action" />
        <span className="font-semibold truncate max-w-[8.5rem] sm:max-w-none">{actual?.sucursal || t('comun.todasSucursales')}</span>
        <span className="size-1.5 rounded-full bg-ok" />
        {varios && <ChevronDown className="size-4 text-muted" />}
      </button>
      {abierto && (
        <div className="absolute left-0 top-11 z-40 w-80 rounded-[10px] bg-surface border border-line-strong shadow-2xl p-1.5 anim-entrar">
          <div className="etiqueta px-3 pt-2 pb-1.5">{t('panel.trabajarComo')}</div>
          {roles.map((r) => (
            <button key={r.usuario_rol_id} onClick={() => cambiar(r)}
              className="w-full flex items-center gap-3 rounded-md px-3 py-2.5 text-left hover:bg-inset cursor-pointer">
              <div className="flex-1">
                <div className="font-semibold text-sm">{t(`roles.${r.rol}`)}</div>
                <div className="text-[13px] text-muted">{r.sucursal || t('comun.todasSucursales')}</div>
              </div>
              {r.usuario_rol_id === rol.usuario_rol_id && <Check className="size-4 text-action" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function EstadoApi() {
  const { t } = useTranslation();
  const [ok, setOk] = useState(null);
  useEffect(() => {
    let vivo = true;
    const revisar = () => api.get('/salud').then(() => vivo && setOk(true)).catch(() => vivo && setOk(false));
    revisar();
    const t = setInterval(revisar, 60000);
    return () => { vivo = false; clearInterval(t); };
  }, []);
  return (
    <span className="flex items-center gap-1.5">
      <span className={cx('size-1.5 rounded-full', ok === false ? 'bg-danger' : 'bg-ok')} />
      {ok === false ? t('comun.sinConexion') : t('comun.enLinea')}
    </span>
  );
}

export default function Panel() {
  const { usuario, rol, tiene, logout } = useSesion();
  const { t } = useTranslation();
  const { marca } = useMarca();
  const avisar = useAvisos();
  const navegar = useNavigate();
  const { pathname } = useLocation();
  const [menuMovil, setMenuMovil] = useState(false);
  useEffect(() => setMenuMovil(false), [pathname]);

  const opciones = MENU.filter((m) => !m.permisos.length || tiene(...m.permisos));
  const salir = async () => { await logout(); avisar(t('comun.sesionCerrada'), 'info'); navegar('/login'); };
  const nombre = usuario ? `${usuario.nombre} ${usuario.apellido_paterno}` : '';

  const lateral = (
    <aside className="flex flex-col h-full w-64 bg-sidebar text-white border-r border-white/5">
      <div className="px-5 h-16 flex items-center justify-between"><Logo oscuro />
        <BotonIcono icono={X} etiqueta={t('comun.cerrarMenu')} onClick={() => setMenuMovil(false)} className="lg:hidden !text-white/70" />
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
        {opciones.map((m) => (
          <NavLink key={m.a} to={m.a} end={!!m.exacto}
            className={({ isActive }) => cx('flex items-center gap-3 h-10 px-3 rounded-full text-[14px] font-medium transition-colors',
              isActive ? 'bg-action text-on-action font-semibold' : 'text-white/75 hover:text-white hover:bg-white/8')}>
            <m.icono className="size-[18px]" />
            <span className="flex-1">{t(m.t)}</span>
            {!m.listo && <span className="font-mono text-[9.5px] tracking-wider uppercase opacity-60">{t('comun.pronto')}</span>}
          </NavLink>
        ))}
      </nav>
      <div className="px-5 py-4 border-t border-white/8 text-[12px] text-white/55 flex justify-between">
        <span className="truncate" title={`v0.4 · ${marca.nombre}`}>v0.4{marca.nombre !== 'Dojo OS' ? ` · ${t('comun.hechoCon')}` : ' · Dojo OS'}</span><EstadoApi />
      </div>
    </aside>
  );

  return (
    <div className="h-full flex">
      <div className="hidden lg:block shrink-0">{lateral}</div>
      {menuMovil && (
        <div className="fixed inset-0 z-50 flex lg:hidden anim-aparecer" style={{ background: 'var(--overlay)' }} onClick={(e) => e.target === e.currentTarget && setMenuMovil(false)}>
          {lateral}
        </div>
      )}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 shrink-0 flex items-center gap-3 px-4 lg:px-8 border-b border-line bg-canvas/80 backdrop-blur sticky top-0 z-30">
          <BotonIcono icono={MenuIcon} etiqueta={t('comun.abrirMenu')} onClick={() => setMenuMovil(true)} className="lg:hidden" />
          <SelectorRol />
          <div className="flex-1" />
          <BotonTema />
          <div className="hidden sm:block text-right leading-tight ml-2">
            <div className="text-sm font-semibold">{nombre}</div>
            <div className="text-[12px] text-muted">{rol?.nombre ? t(`roles.${rol.nombre}`) : ''}</div>
          </div>
          <Iniciales nombre={nombre} />
          <BotonIcono icono={LogOut} etiqueta={t('comun.cerrarSesion')} onClick={salir} />
        </header>
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-[1280px] mx-auto px-4 lg:px-8 py-7"><Outlet /></div>
        </main>
      </div>
    </div>
  );
}
