import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, X } from 'lucide-react';

export const cx = (...c) => c.filter(Boolean).join(' ');

/** Botón "gordito" con sombra inferior: se hunde al tocarlo */
const TONOS = {
  accion: 'bg-action text-on-action [--sombra:var(--action-dark)]',
  oro: 'bg-gold text-[#2b1d00] [--sombra:var(--gold-dark)]',
  peligro: 'bg-danger text-white [--sombra:var(--danger-dark)]',
  contorno: 'bg-surface text-action border-2 border-action/70 [--sombra:#06182f]',
  suave: 'bg-inset text-text [--sombra:#06182f]',
};
export function Boton({ tono = 'accion', icono: Icono, cargando, children, className, ...p }) {
  return (
    <button {...p} disabled={p.disabled || cargando}
      className={cx('relieve w-full min-h-14 rounded-2xl px-5 font-black uppercase tracking-wide text-[15px] inline-flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50 disabled:pointer-events-none', TONOS[tono], className)}>
      {cargando ? <Loader2 className="size-5 animate-spin" /> : Icono && <Icono className="size-5" strokeWidth={2.6} />}
      {children}
    </button>
  );
}

export function Tarjeta({ children, className, ...p }) {
  return <section {...p} className={cx('rounded-3xl bg-surface border-2 border-line p-5 anim-entrar', className)}>{children}</section>;
}

export function Barra({ valor, max = 100, tono = 'bg-action' }) {
  const pct = Math.max(0, Math.min(100, max ? (valor * 100) / max : 0));
  return <div className="h-3 rounded-full bg-deep overflow-hidden"><div className={cx('h-full rounded-full transition-[width] duration-700', tono)} style={{ width: `${pct}%` }} /></div>;
}

const CHIPS = { ok: 'bg-ok/15 text-ok', oro: 'bg-gold/18 text-gold', peligro: 'bg-danger/18 text-danger', info: 'bg-inset text-soft', accion: 'bg-action/15 text-action' };
export function Chip({ tono = 'info', children, className }) {
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-3 py-1 text-[12px] font-extrabold whitespace-nowrap', CHIPS[tono], className)}>{children}</span>;
}

export function Cargando({ className }) {
  return <div className={cx('grid place-items-center py-20 text-muted', className)}><Loader2 className="size-7 animate-spin" /></div>;
}

export function ErrorCaja({ error, reintentar }) {
  if (!error) return null;
  return (
    <div className="rounded-2xl border-2 border-danger/50 bg-danger/10 px-4 py-3 text-[14px] text-danger font-bold anim-aparecer">
      {error.message || String(error)}
      {reintentar && <button onClick={reintentar} className="block mt-1 underline cursor-pointer">Reintentar</button>}
    </div>
  );
}

export function Campo({ etiqueta, className, ...p }) {
  return (
    <label className={cx('block', className)}>
      <span className="etiqueta block mb-1.5">{etiqueta}</span>
      <input {...p} className="w-full h-14 rounded-2xl bg-deep border-2 border-line px-4 text-[17px] font-bold outline-none focus:border-action placeholder:text-muted/60" />
    </label>
  );
}

/** Hoja que sube desde abajo (QR, recibos) */
export function Hoja({ abierta, onCerrar, titulo, children, clara = false }) {
  useEffect(() => {
    if (!abierta) return;
    const esc = (e) => e.key === 'Escape' && onCerrar?.();
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [abierta, onCerrar]);
  if (!abierta) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 anim-aparecer" onMouseDown={(e) => e.target === e.currentTarget && onCerrar?.()}>
      <div role="dialog" aria-label={titulo} className={cx('w-full max-w-md max-h-[92vh] overflow-y-auto rounded-t-[28px] p-5 seguro-abajo anim-subir', clara ? 'bg-white text-[#011c42]' : 'bg-surface')}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[20px] font-black">{titulo}</h2>
          <button onClick={onCerrar} aria-label="Cerrar" className={cx('grid place-items-center size-10 rounded-full cursor-pointer', clara ? 'bg-black/5' : 'bg-inset')}><X className="size-5" /></button>
        </div>
        {children}
      </div>
    </div>, document.body);
}

/** Confeti para festejar (solicitud enviada, grado nuevo) */
export function Confeti({ n = 70 }) {
  const piezas = useMemo(() => Array.from({ length: n }, (_, i) => ({
    i, x: Math.random() * 100, d: 1.8 + Math.random() * 2.2, r: Math.random() * 0.8,
    c: ['#34e8bb', '#f2a900', '#f58ad8', '#7b6cf6', '#ffffff', '#3b82f6'][i % 6], w: 6 + Math.random() * 6,
  })), [n]);
  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden" aria-hidden="true">
      {piezas.map((p) => <span key={p.i} className="absolute top-0 block rounded-[2px]" style={{ left: `${p.x}%`, width: p.w, height: p.w * 0.45, background: p.c, animation: `caer ${p.d}s ${p.r}s linear both` }} />)}
    </div>
  );
}

/** const { datos, cargando, error, recargar, setDatos } = useDatos(() => api.get('/ruta'), [deps]) */
export function useDatos(fn, deps = []) {
  const [e, setE] = useState({ datos: null, cargando: true, error: null });
  const ref = useRef(fn); ref.current = fn;
  const recargar = useCallback(async () => {
    setE((x) => ({ ...x, cargando: true, error: null }));
    try { setE({ datos: await ref.current(), cargando: false, error: null }); }
    catch (error) { setE((x) => ({ ...x, cargando: false, error })); }
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { recargar(); }, [recargar]);
  return { ...e, recargar, setDatos: (d) => setE((x) => ({ ...x, datos: typeof d === 'function' ? d(x.datos) : d })) };
}
