import { createContext, useContext, useEffect, useState } from 'react';
import { NombreMarca, nombrePlano } from './NombreMarca';

// Marca de la empresa en la app: nombre, logos y colores (los mismos temas del panel, ver
// web-code/panel/src/marca/temas.js). La app siempre es oscura: usa el color de acción y los fondos del tema.

const TEMAS = {
  oceano: { accion: '#34e8bb', fondo: ['#011c42', '#0a2852', '#10335f'], menu: '#00132e' },
  dojo: { accion: '#ef4444', fondo: ['#1f0d10', '#2c1418', '#3a1b20'], menu: '#160a0c' },
  bosque: { accion: '#4ade80', fondo: ['#0b2018', '#12301f', '#193d29'], menu: '#071610' },
  grafito: { accion: '#f2a900', fondo: ['#14161b', '#1e2128', '#272b33'], menu: '#0e1013' },
  ciruela: { accion: '#a78bfa', fondo: ['#1d1030', '#291843', '#352054'], menu: '#140a23' },
  atardecer: { accion: '#fb923c', fondo: ['#24130a', '#331d10', '#432716'], menu: '#1a0d06' },
};
const rgb = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const hex = (c) => '#' + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
const mezclar = (a, b, t) => { const x = rgb(a); const y = rgb(b); return hex(x.map((v, i) => v + (y[i] - v) * t)); };
const lum = (h) => rgb(h).map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }).reduce((s, c, i) => s + c * [0.2126, 0.7152, 0.0722][i], 0);
const contraste = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
function hsl(h) {
  const [r, g, b] = rgb(h).map((v) => v / 255); const mx = Math.max(r, g, b); const mn = Math.min(r, g, b); let hh = 0; let s = 0;
  if (mx !== mn) { const d = mx - mn; s = (mx + mn) / 2 > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); hh = (mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60; }
  return [hh, s * 100];
}
function deHsl(h, s, l) {
  s /= 100; l /= 100; const k = (n) => (n + h / 30) % 12; const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return hex([f(0) * 255, f(8) * 255, f(4) * 255]);
}
function base(m) {
  if (m.tema !== 'personalizado' && TEMAS[m.tema]) return TEMAS[m.tema];
  const accion = m.color_primario || TEMAS.oceano.accion;
  const [h, s] = hsl(m.color_fondo || accion); const sat = m.color_fondo ? Math.min(s, 70) : Math.min(s, 35);
  return { accion, fondo: [deHsl(h, sat, 11), deHsl(h, sat, 16), deHsl(h, sat, 21)], menu: deHsl(h, sat, 7) };
}
function aplicar(m) {
  const b = base(m);
  const texto = contraste(b.accion, '#ffffff') >= contraste(b.accion, '#0b1220') ? '#ffffff' : mezclar(b.accion, '#000000', 0.8);
  const v = { canvas: b.fondo[0], surface: b.fondo[1], inset: b.fondo[2], deep: b.menu, action: b.accion, 'action-dark': mezclar(b.accion, '#000000', 0.35), 'on-action': texto,
    muted: mezclar('#ffffff', b.fondo[0], 0.32), soft: mezclar('#ffffff', b.accion, 0.18) };
  let el = document.getElementById('marca-tema');
  if (!el) { el = document.createElement('style'); el.id = 'marca-tema'; document.head.appendChild(el); }
  el.textContent = `html:root{${Object.entries(v).map(([k, x]) => `--${k}:${x};`).join('')}}`;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', b.menu);
  document.title = nombrePlano(m.nombre) || 'Dojo OS';
  if (m.imagenes?.icono) document.querySelector('link[rel="icon"]')?.setAttribute('href', m.imagenes.icono);
}

const Ctx = createContext({ nombre: 'Dojo OS', imagenes: {} });
export const useMarca = () => useContext(Ctx);
export function MarcaProvider({ children }) {
  const [m, setM] = useState(() => { try { return JSON.parse(localStorage.getItem('dojo-app-marca')) || { nombre: 'Dojo OS', tema: 'oceano', imagenes: {} }; } catch { return { nombre: 'Dojo OS', tema: 'oceano', imagenes: {} }; } });
  useEffect(() => { aplicar(m); }, [m]);
  useEffect(() => {
    fetch('/api/marca').then((r) => r.json()).then((j) => { if (j.ok) { setM(j.datos); try { localStorage.setItem('dojo-app-marca', JSON.stringify(j.datos)); } catch { /* nada */ } } }).catch(() => {});
  }, []);
  return <Ctx.Provider value={m}>{children}</Ctx.Provider>;
}

/** Nombre de la empresa con su letra y decoraciones (o "Dojo OS" con su estilo) */
export function Nombre({ className = '' }) {
  const m = useMarca();
  return m.nombre === 'Dojo OS' ? <span className={className}>Dojo <span className="text-gold">OS</span></span>
    : <NombreMarca nombre={m.nombre} fuente={m.fuente_nombre} className={className} />;
}

/**
 * Portada del login: el símbolo grande y el nombre de la empresa con su letra.
 * Si solo subieron el logo ancho (que ya trae el nombre escrito) va ese solo; si es cuadrado, con el nombre abajo.
 */
export function MarcaPortada({ Isotipo }) {
  const m = useMarca(); const im = m.imagenes || {};
  const img = im.icono || im.logo_oscuro;
  const [ancho, setAncho] = useState(false);
  return (
    <div className="text-center anim-entrar">
      {img
        ? <img src={img} alt="" onLoad={(e) => setAncho(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight >= 1.8)}
            className={ancho ? 'h-20 max-w-[85%] mx-auto object-contain' : 'size-28 mx-auto object-contain rounded-[26px]'} />
        : <Isotipo className="size-24 mx-auto text-white" />}
      {(!img || !ancho) && <Nombre className="block text-[32px] font-black leading-tight mt-4" />}
      {m.lema && <p className="text-soft font-bold mt-1.5">{m.lema}</p>}
    </div>
  );
}
export function MarcaIcono({ Isotipo, className = 'size-9' }) {
  const im = useMarca().imagenes || {};
  return im.icono ? <img src={im.icono} alt="" className={`${className} rounded-lg object-contain`} /> : <Isotipo className={`${className} text-white`} />;
}
