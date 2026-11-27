import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Building2, ChevronDown, Check, Keyboard, LogOut, Menu as MenuIcon, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSesion } from '../auth/Sesion';
import { useMarca } from '../marca/Marca';
import { BotonIcono, BotonTema, Logo, Modal, useAvisos, useTema } from '../ui';
import { api } from '../api';
import { MENU } from './menu';
import { IR_A, ListaAtajos, SECCIONES } from '../paginas/Cuenta';

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

/** Menú de la cuenta (arriba a la derecha): como en cualquier sistema actual, no un formulario de contraseña a la vista */
function MenuCuenta({ nombre, onAtajos, onSalir }) {
  const { usuario, rol, roles } = useSesion();
  const { t } = useTranslation();
  const [abierto, setAbierto] = useState(false);
  const ref = useRef(null);
  const { pathname } = useLocation();
  useEffect(() => setAbierto(false), [pathname]);
  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (e) => !ref.current?.contains(e.target) && setAbierto(false);
    const esc = (e) => e.key === 'Escape' && setAbierto(false);
    document.addEventListener('mousedown', fuera); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', esc); };
  }, [abierto]);
  const actual = roles.find((r) => r.usuario_rol_id === rol?.usuario_rol_id);
  const item = 'w-full flex items-center gap-3 rounded-md px-3 h-10 text-left text-[14px] hover:bg-inset cursor-pointer';
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setAbierto((a) => !a)} aria-haspopup="menu" aria-expanded={abierto} aria-label={t('cuenta.menu.abrir')}
        className="flex items-center gap-2.5 rounded-full pl-1 sm:pl-3 pr-1 h-11 hover:bg-inset cursor-pointer">
        <span className="hidden sm:block text-right leading-tight">
          <span className="block text-sm font-semibold">{nombre}</span>
          <span className="block text-[12px] text-muted">{rol?.nombre ? t(`roles.${rol.nombre}`) : ''}</span>
        </span>
        <Iniciales nombre={nombre} />
      </button>
      {abierto && (
        <div role="menu" className="absolute right-0 top-12 z-40 w-72 rounded-[12px] bg-surface border border-line-strong shadow-2xl p-1.5 anim-entrar">
          <div className="flex items-center gap-3 px-3 py-3">
            <Iniciales nombre={nombre} />
            <div className="min-w-0">
              <div className="font-semibold truncate">{nombre}</div>
              <div className="text-[12px] text-muted truncate">{usuario?.email}</div>
              <div className="text-[12px] text-muted truncate">{rol?.nombre ? t(`roles.${rol.nombre}`) : ''} · {actual?.sucursal || t('comun.todasSucursales')}</div>
            </div>
          </div>
          <div className="h-px bg-line my-1" />
          {SECCIONES.filter((x) => x.id !== 'atajos').map((x) => (
            <Link key={x.id} role="menuitem" to={x.id === 'perfil' ? '/cuenta' : `/cuenta/${x.id}`} className={item}>
              <x.icono className="size-[18px] text-muted" />{t(`cuenta.menu.${x.id}`)}
            </Link>
          ))}
          <button role="menuitem" onClick={() => { setAbierto(false); onAtajos(); }} className={item}>
            <Keyboard className="size-[18px] text-muted" /><span className="flex-1">{t('cuenta.menu.atajos')}</span><kbd className="font-mono text-[11px] text-muted">?</kbd>
          </button>
          <div className="h-px bg-line my-1" />
          <button role="menuitem" onClick={onSalir} className={cx(item, 'text-danger')}><LogOut className="size-[18px]" />{t('cuenta.menu.salir')}</button>
        </div>
      )}
    </div>
  );
}

/**
 * Atajos de teclado: ? (lista), / (buscador de la pantalla), T (claro/oscuro), G y una letra (ir a una pantalla).
 * No hacen nada mientras escribes en un campo.
 */
function useAtajos({ onAtajos, tiene }) {
  const navegar = useNavigate();
  const [, alternarTema] = useTema();
  useEffect(() => {
    let g = 0;
    const tecla = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target;
      if (el.closest?.('input, textarea, select, [contenteditable="true"]')) return;
      if (document.querySelector('[role="dialog"]') && e.key !== '?') return;
      const k = e.key.toLowerCase();
      if (g && Date.now() - g < 1200) {
        g = 0;
        const destino = IR_A.find(([l]) => l === k)?.[1];
        const m = MENU.find((x) => x.a === destino);
        if (destino && (destino === '/cuenta' || (m && (!m.permisos.length || tiene(...m.permisos))))) { e.preventDefault(); navegar(destino); }
        return;
      }
      if (k === 'g') { g = Date.now(); return; }
      if (e.key === '?') { e.preventDefault(); onAtajos(); return; }
      if (k === 't') { alternarTema(); return; }
      if (e.key === '/') {
        const campo = document.querySelector('main input[type="search"], main input:not([type="hidden"]):not([disabled]):not([type="checkbox"]):not([type="radio"])');
        if (campo) { e.preventDefault(); campo.focus(); }
      }
    };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, [navegar, onAtajos, tiene, alternarTema]);
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
  const [atajos, setAtajos] = useState(false);
  const abrirAtajos = useCallback(() => setAtajos(true), []);
  useAtajos({ onAtajos: abrirAtajos, tiene });

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
        <span className="truncate" title={`v0.5 · ${marca.nombre}`}>v0.5{marca.nombre !== 'Dojo OS' ? ` · ${t('comun.hechoCon')}` : ' · Dojo OS'}</span><EstadoApi />
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
          <MenuCuenta nombre={nombre} onAtajos={abrirAtajos} onSalir={salir} />
        </header>
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-[1280px] mx-auto px-4 lg:px-8 py-7"><Outlet /></div>
        </main>
        <Modal abierto={atajos} onCerrar={() => setAtajos(false)} titulo={t('cuenta.menu.atajos')} subtitulo={t('cuenta.atajos.sub')}>
          <ListaAtajos />
        </Modal>
      </div>
    </div>
  );
}
