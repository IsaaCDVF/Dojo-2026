import { useTranslation } from 'react-i18next';
import { useMarca } from '../marca/Marca';
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, Info, Loader2, Moon, Sun, X, XCircle } from 'lucide-react';

export { Isotipo, Logo, MarcaImpresa } from './Logo';

const cx = (...c) => c.filter(Boolean).join(' ');

/* ---------- Botones ---------- */
const VARIANTES = {
  primario: 'bg-action text-on-action hover:brightness-105 active:brightness-95 shadow-[0_0_0_1px_rgba(0,0,0,.04)]',
  secundario: 'bg-transparent text-text border border-line-strong hover:bg-inset',
  fantasma: 'bg-transparent text-muted hover:text-text hover:bg-inset',
  peligro: 'bg-danger-bg text-danger border border-danger/40 hover:bg-danger hover:text-white',
};
export function Boton({ variante = 'primario', tam = 'md', cargando, icono: Icono, children, className, ...props }) {
  const tams = { sm: 'h-8 px-3.5 text-[13px] gap-1.5', md: 'h-10 px-5 text-sm gap-2', lg: 'h-12 px-7 text-[15px] gap-2' };
  return (
    <button
      {...props}
      disabled={props.disabled || cargando}
      className={cx('inline-flex items-center justify-center rounded-full font-semibold transition-[filter,background,color,transform] duration-150 active:scale-[.98] disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap cursor-pointer',
        VARIANTES[variante], tams[tam], className)}
    >
      {cargando ? <Loader2 className="size-4 animate-spin" /> : Icono && <Icono className="size-4" />}
      {children}
    </button>
  );
}

export function BotonIcono({ icono: Icono, etiqueta, className, ...props }) {
  return (
    <button {...props} title={etiqueta} aria-label={etiqueta}
      className={cx('inline-grid place-items-center size-9 rounded-full text-muted hover:text-text hover:bg-inset transition-colors cursor-pointer', className)}>
      <Icono className="size-[18px]" />
    </button>
  );
}

/* ---------- Formularios ---------- */
export function Campo({ etiqueta, error, ayuda, icono: Icono, derecha, className, id, ...props }) {
  const auto = useId(); const idc = id || auto;
  return (
    <div className={className}>
      {etiqueta && <label htmlFor={idc} className="etiqueta block mb-1.5">{etiqueta}</label>}
      <div className={cx('flex items-center gap-2 h-11 rounded-md bg-inset border px-3 transition-colors focus-within:border-action',
        error ? 'border-danger' : 'border-line')}>
        {Icono && <Icono className="size-4 text-muted shrink-0" />}
        <input id={idc} {...props} aria-invalid={!!error}
          className="flex-1 min-w-0 bg-transparent outline-none text-[15px] text-text placeholder:text-muted/70" />
        {derecha}
      </div>
      {error ? <p className="mt-1.5 text-[13px] text-danger">{error}</p> : ayuda && <p className="mt-1.5 text-[13px] text-muted">{ayuda}</p>}
    </div>
  );
}

export function Selector({ etiqueta, error, children, className, id, ...props }) {
  const auto = useId(); const idc = id || auto;
  return (
    <div className={className}>
      {etiqueta && <label htmlFor={idc} className="etiqueta block mb-1.5">{etiqueta}</label>}
      <select id={idc} {...props}
        className={cx('w-full h-11 rounded-md bg-inset border px-3 text-[15px] text-text outline-none focus:border-action cursor-pointer',
          error ? 'border-danger' : 'border-line')}>
        {children}
      </select>
      {error && <p className="mt-1.5 text-[13px] text-danger">{error}</p>}
    </div>
  );
}

export function AreaTexto({ etiqueta, className, id, ...props }) {
  const auto = useId(); const idc = id || auto;
  return (
    <div className={className}>
      {etiqueta && <label htmlFor={idc} className="etiqueta block mb-1.5">{etiqueta}</label>}
      <textarea id={idc} {...props} className="w-full min-h-20 rounded-md bg-inset border border-line p-3 text-[15px] outline-none focus:border-action" />
    </div>
  );
}

/* ---------- Contenedores ---------- */
export function Tarjeta({ titulo, subtitulo, acciones, icono: Icono, children, className, cuerpo = 'p-5' }) {
  return (
    <section className={cx('bg-surface border border-line rounded-[10px]', className)}>
      {(titulo || acciones) && (
        <header className="flex items-start justify-between gap-4 px-5 pt-4 pb-3 border-b border-line">
          <div className="flex items-start gap-3 min-w-0">
            {Icono && <span className="mt-0.5 grid place-items-center size-8 rounded-md bg-inset text-action shrink-0"><Icono className="size-4" /></span>}
            <div className="min-w-0">
              <h3 className="font-semibold text-[15px]">{titulo}</h3>
              {subtitulo && <p className="text-[13px] text-muted mt-0.5">{subtitulo}</p>}
            </div>
          </div>
          {acciones && <div className="flex items-center gap-2 shrink-0">{acciones}</div>}
        </header>
      )}
      <div className={cuerpo}>{children}</div>
    </section>
  );
}

export function Encabezado({ ruta, titulo, descripcion, acciones }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6 anim-entrar">
      <div className="min-w-0">
        {ruta && <div className="etiqueta mb-2">{ruta}</div>}
        <h1 className="text-[30px] leading-tight">{titulo}</h1>
        {descripcion && <p className="text-muted mt-1 max-w-2xl">{descripcion}</p>}
      </div>
      {acciones && <div className="flex flex-wrap items-center gap-2">{acciones}</div>}
    </div>
  );
}

const TONOS_CHIP = {
  ok: 'bg-ok-bg text-ok', aviso: 'bg-warn-bg text-warn', peligro: 'bg-danger-bg text-danger',
  info: 'bg-inset text-soft', accion: 'bg-action/15 text-action', oro: 'bg-gold/15 text-gold',
};
export function Chip({ tono = 'info', children, className }) {
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-semibold whitespace-nowrap', TONOS_CHIP[tono], className)}>{children}</span>;
}

export function Kpi({ etiqueta, valor, detalle, tono = 'accion', icono: Icono }) {
  const borde = { accion: 'border-l-action', peligro: 'border-l-danger', ok: 'border-l-ok', oro: 'border-l-gold' }[tono];
  return (
    <div className={cx('bg-surface border border-line border-l-[3px] rounded-[10px] p-4', borde)}>
      <div className="flex items-start justify-between">
        <span className="etiqueta">{etiqueta}</span>
        {Icono && <Icono className="size-4 text-muted" />}
      </div>
      <div className="text-[30px] font-semibold tracking-tight mt-1">{valor}</div>
      {detalle && <div className="text-[13px] text-muted">{detalle}</div>}
    </div>
  );
}

export function Pestanas({ opciones, valor, onCambio, className }) {
  return (
    <div role="tablist" className={cx('inline-flex max-w-full overflow-x-auto [scrollbar-width:none] gap-1 p-1 rounded-full bg-inset border border-line', className)}>
      {opciones.map((o) => (
        <button key={o.valor} role="tab" aria-selected={valor === o.valor} onClick={() => onCambio(o.valor)}
          className={cx('shrink-0 whitespace-nowrap px-3.5 h-8 rounded-full text-[13px] font-semibold transition-colors cursor-pointer',
            valor === o.valor ? 'bg-action text-on-action' : 'text-muted hover:text-text')}>
          {o.etiqueta}{o.cuenta !== undefined && <span className="ml-1.5 opacity-70">{o.cuenta}</span>}
        </button>
      ))}
    </div>
  );
}

/* ---------- Estados ---------- */
export function Cargando({ texto = 'Cargando…', className }) {
  return <div className={cx('flex items-center justify-center gap-2 py-12 text-muted', className)}><Loader2 className="size-5 animate-spin" />{texto}</div>;
}

export function Vacio({ icono: Icono = Info, titulo, texto, accion }) {
  return (
    <div className="text-center py-12 px-6">
      <div className="mx-auto grid place-items-center size-12 rounded-full bg-inset text-muted mb-3"><Icono className="size-5" /></div>
      <div className="font-semibold">{titulo}</div>
      {texto && <p className="text-muted text-sm mt-1 max-w-sm mx-auto">{texto}</p>}
      {accion && <div className="mt-4">{accion}</div>}
    </div>
  );
}

export function ErrorCaja({ error, reintentar }) {
  if (!error) return null;
  return (
    <div className="flex items-start gap-3 rounded-md border border-danger/40 bg-danger-bg text-danger px-4 py-3 text-sm anim-aparecer">
      <XCircle className="size-4 mt-0.5 shrink-0" />
      <div className="flex-1">{error.message || String(error)}</div>
      {reintentar && <button onClick={reintentar} className="font-semibold underline cursor-pointer">Reintentar</button>}
    </div>
  );
}

/* ---------- Modal y panel lateral ---------- */
export function Modal({ abierto, onCerrar, titulo, subtitulo, children, pie, lateral = false, ancho = 'max-w-lg' }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!abierto) return;
    const esc = (e) => e.key === 'Escape' && onCerrar?.();
    document.addEventListener('keydown', esc);
    const prev = document.activeElement;
    setTimeout(() => ref.current?.querySelector('input,select,textarea,button')?.focus(), 30);
    return () => { document.removeEventListener('keydown', esc); prev?.focus?.(); };
  }, [abierto, onCerrar]);
  if (!abierto) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex anim-aparecer" style={{ background: 'var(--overlay)' }} onMouseDown={(e) => e.target === e.currentTarget && onCerrar?.()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={titulo}
        className={cx('bg-surface border-line flex flex-col shadow-2xl',
          lateral ? 'ml-auto h-full w-full max-w-xl border-l anim-entrar' : cx('m-auto w-[calc(100%-32px)] rounded-[12px] border max-h-[90vh] anim-entrar', ancho))}>
        <header className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-line">
          <div>
            <h2 className="text-[20px] !font-normal">{titulo}</h2>
            {subtitulo && <p className="text-[13px] text-muted mt-0.5">{subtitulo}</p>}
          </div>
          <BotonIcono icono={X} etiqueta="Cerrar" onClick={onCerrar} />
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {pie && <footer className="flex justify-end gap-2 px-6 py-4 border-t border-line">{pie}</footer>}
      </div>
    </div>,
    document.body,
  );
}

/* ---------- Confirmación ---------- */
const ConfirmarCtx = createContext(null);
export const useConfirmar = () => useContext(ConfirmarCtx);
export function ConfirmarProvider({ children }) {
  const [p, setP] = useState(null);
  const confirmar = useCallback((opciones) => new Promise((resolve) => setP({ ...opciones, resolve })), []);
  const cerrar = (r) => { p?.resolve(r); setP(null); };
  return (
    <ConfirmarCtx.Provider value={confirmar}>
      {children}
      <Modal abierto={!!p} onCerrar={() => cerrar(false)} titulo={p?.titulo || '¿Confirmas?'} ancho="max-w-md"
        pie={<>
          <Boton variante="secundario" onClick={() => cerrar(false)}>Cancelar</Boton>
          <Boton variante={p?.peligro ? 'peligro' : 'primario'} onClick={() => cerrar(true)}>{p?.aceptar || 'Confirmar'}</Boton>
        </>}>
        <p className="text-soft">{p?.texto}</p>
      </Modal>
    </ConfirmarCtx.Provider>
  );
}

/* ---------- Avisos (toasts) ---------- */
const AvisosCtx = createContext(null);
export const useAvisos = () => useContext(AvisosCtx);
export function AvisosProvider({ children }) {
  const [lista, setLista] = useState([]);
  const quitar = useCallback((id) => setLista((l) => l.filter((a) => a.id !== id)), []);
  const avisar = useCallback((texto, tipo = 'ok') => {
    const id = Math.random().toString(36).slice(2);
    setLista((l) => [...l.slice(-3), { id, texto, tipo }]);
    setTimeout(() => quitar(id), tipo === 'error' ? 6500 : 4000);
  }, [quitar]);
  const ICON = { ok: CheckCircle2, error: XCircle, aviso: AlertTriangle, info: Info };
  const COLOR = { ok: 'text-ok', error: 'text-danger', aviso: 'text-warn', info: 'text-action' };
  return (
    <AvisosCtx.Provider value={avisar}>
      {children}
      {createPortal(
        <div className="fixed z-[60] bottom-4 right-4 left-4 sm:left-auto flex flex-col gap-2 sm:w-96" aria-live="polite">
          {lista.map((a) => { const I = ICON[a.tipo]; return (
            <div key={a.id} className="flex items-start gap-3 rounded-[10px] bg-surface border border-line-strong shadow-xl px-4 py-3 anim-entrar">
              <I className={cx('size-5 shrink-0 mt-px', COLOR[a.tipo])} />
              <p className="flex-1 text-sm">{a.texto}</p>
              <button onClick={() => quitar(a.id)} className="text-muted hover:text-text cursor-pointer" aria-label="Cerrar aviso"><X className="size-4" /></button>
            </div>); })}
        </div>, document.body)}
    </AvisosCtx.Provider>
  );
}

/* ---------- Tema oscuro / claro (lo maneja la marca: src/marca/Marca.jsx) ---------- */
export function useTema() {
  const { modo, alternarModo } = useMarca();
  return [modo, alternarModo];
}
export function BotonTema({ className }) {
  const [tema, cambiar] = useTema();
  const { t } = useTranslation();
  return <BotonIcono icono={tema === 'dark' ? Sun : Moon} etiqueta={tema === 'dark' ? t('comun.modoClaro') : t('comun.modoOscuro')} onClick={cambiar} className={className} />;
}

/* ---------- Tabla ---------- */
export function Tabla({ columnas, filas, clave = 'id', vacio, onFila }) {
  if (!filas?.length) return vacio || null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line">
            {columnas.map((c) => <th key={c.k} className={cx('etiqueta font-normal text-left py-2.5 px-4 whitespace-nowrap', c.derecha && 'text-right')}>{c.t}</th>)}
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <tr key={f[clave] ?? i} onClick={onFila ? () => onFila(f) : undefined}
              className={cx('border-b border-line last:border-0 transition-colors', onFila && 'cursor-pointer hover:bg-inset')}>
              {columnas.map((c) => <td key={c.k} className={cx('py-3 px-4 align-middle', c.derecha && 'text-right', c.clase)}>{c.r ? c.r(f) : f[c.k]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Carga de datos ---------- */
/** const { datos, cargando, error, recargar } = useDatos(() => api.get('/ruta'), [dependencias]) */
export function useDatos(funcion, deps = []) {
  const [estado, setEstado] = useState({ datos: null, cargando: true, error: null });
  const ref = useRef(funcion); ref.current = funcion;
  const recargar = useCallback(async () => {
    setEstado((e) => ({ ...e, cargando: true, error: null }));
    try { const datos = await ref.current(); setEstado({ datos, cargando: false, error: null }); }
    catch (error) { setEstado((e) => ({ ...e, cargando: false, error })); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { recargar(); }, [recargar]);
  return { ...estado, recargar };
}

export { FotoAlumno } from './Foto';

/** Barra de pasos para formularios largos (inscripción) */
export function Pasos({ pasos, actual, onIr }) {
  return (
    <ol className="flex flex-wrap items-center gap-2">
      {pasos.map((p, i) => {
        const hecho = i < actual; const act = i === actual;
        return (
          <li key={p} className="flex items-center gap-2">
            <button type="button" disabled={!hecho} onClick={() => hecho && onIr?.(i)}
              className={cx('flex items-center gap-2 h-9 pl-1.5 pr-3.5 rounded-full text-[13px] font-semibold border transition-colors',
                act ? 'border-action bg-action/12 text-text' : hecho ? 'border-line text-soft hover:border-action cursor-pointer' : 'border-line text-muted')}>
              <span className={cx('grid place-items-center size-6 rounded-full text-[12px]', act || hecho ? 'bg-action text-on-action' : 'bg-inset text-muted')}>{hecho ? '✓' : i + 1}</span>
              {p}
            </button>
            {i < pasos.length - 1 && <span className="w-4 h-px bg-line-strong hidden sm:block" />}
          </li>
        );
      })}
    </ol>
  );
}

/** Cinta de color (grados) */
const COLORES_CINTA = { blanca: '#f4f4f5', amarilla: '#facc15', naranja: '#fb923c', verde: '#22c55e', azul: '#3b82f6', morada: '#a855f7', roja: '#ef4444', cafe: '#92400e', café: '#92400e', negra: '#111827' };
export const colorCinta = (t) => { const k = Object.keys(COLORES_CINTA).find((c) => (t || '').toLowerCase().includes(c)); return k ? COLORES_CINTA[k] : 'var(--line-strong)'; };
export function Cinta({ color, className }) {
  return <span className={cx('inline-block h-2.5 w-8 rounded-full ring-1 ring-black/25', className)} style={{ background: colorCinta(color) }} />;
}
