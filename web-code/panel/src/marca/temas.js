// Motor de temas. Cada tema dice el color de acción (botones, menú activo) y los fondos del modo oscuro
// y del menú lateral. A partir de eso se calcula todo lo demás, y el contraste del texto se revisa solo:
// si el cliente elige un color muy claro, el texto de los botones se pone oscuro (y al revés), y los enlaces
// se aclaran u oscurecen hasta que se lean bien (WCAG AA, 4.5:1).

/** Temas listos. "fondo" son los fondos del modo oscuro; el menú lateral usa "menu" en los dos modos */
export const TEMAS = {
  oceano: { nombre: 'Océano', descripcion: 'Azul marino y menta (el de siempre)', accion: '#34e8bb', fondo: ['#011c42', '#0a2852', '#10335f'], menu: '#00132e' },
  dojo: { nombre: 'Dojo', descripcion: 'Rojo intenso sobre vino', accion: '#ef4444', fondo: ['#1f0d10', '#2c1418', '#3a1b20'], menu: '#160a0c' },
  bosque: { nombre: 'Bosque', descripcion: 'Verde natural', accion: '#4ade80', fondo: ['#0b2018', '#12301f', '#193d29'], menu: '#071610' },
  grafito: { nombre: 'Grafito', descripcion: 'Gris oscuro con dorado', accion: '#f2a900', fondo: ['#14161b', '#1e2128', '#272b33'], menu: '#0e1013' },
  ciruela: { nombre: 'Ciruela', descripcion: 'Morado y lavanda', accion: '#a78bfa', fondo: ['#1d1030', '#291843', '#352054'], menu: '#140a23' },
  atardecer: { nombre: 'Atardecer', descripcion: 'Naranja sobre café', accion: '#fb923c', fondo: ['#24130a', '#331d10', '#432716'], menu: '#1a0d06' },
};

/* ---------- utilidades de color ---------- */
export const aRgb = (hex) => { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const aHex = (rgb) => '#' + rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
export const mezclar = (a, b, t) => { const x = aRgb(a); const y = aRgb(b); return aHex(x.map((v, i) => v + (y[i] - v) * t)); };
function luminancia(hex) {
  return aRgb(hex).map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; })
    .reduce((s, c, i) => s + c * [0.2126, 0.7152, 0.0722][i], 0);
}
/** Contraste entre dos colores (1 a 21). 4.5 = texto normal legible; 3 = texto grande o íconos */
export function contraste(a, b) { const [x, y] = [luminancia(a), luminancia(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); }
export function aHsl(hex) {
  const [r, g, b] = aRgb(hex).map((v) => v / 255); const max = Math.max(r, g, b); const min = Math.min(r, g, b);
  let h = 0; let s = 0; const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min; s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60;
  }
  return [h, s * 100, l * 100];
}
export function deHsl(h, s, l) {
  s /= 100; l /= 100; const k = (n) => (n + h / 30) % 12; const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return aHex([f(0) * 255, f(8) * 255, f(4) * 255]);
}
/** Aclara (hacia blanco) u oscurece (hacia negro) un color hasta lograr el contraste pedido contra un fondo */
function legible(color, fondo, minimo = 4.5) {
  const hacia = luminancia(fondo) < 0.2 ? '#ffffff' : '#000000';
  for (let t = 0; t <= 1.0001; t += 0.05) { const c = mezclar(color, hacia, t); if (contraste(c, fondo) >= minimo) return c; }
  return hacia;
}

/** Colores base del tema: los listos tal cual; el personalizado se calcula del color principal y del fondo */
export function base(marca) {
  if (marca.tema !== 'personalizado' && TEMAS[marca.tema]) return TEMAS[marca.tema];
  const accion = marca.color_primario || TEMAS.oceano.accion;
  const [h, s] = aHsl(marca.color_fondo || accion);
  const sat = marca.color_fondo ? Math.min(s, 70) : Math.min(s, 35);
  return { accion, fondo: [deHsl(h, sat, 11), deHsl(h, sat, 16), deHsl(h, sat, 21)], menu: deHsl(h, sat, 7) };
}

const FIJOS_OSCURO = {
  line: 'rgba(255,255,255,.10)', 'line-strong': 'rgba(255,255,255,.18)', text: '#ffffff', gold: '#f2a900',
  ok: '#4ade80', 'ok-bg': 'rgba(34,197,94,.16)', warn: '#fbbf24', 'warn-bg': 'rgba(245,158,11,.16)', danger: '#f87171', 'danger-bg': 'rgba(239,68,68,.16)',
  overlay: 'rgba(0,10,28,.66)',
};
const FIJOS_CLARO = {
  gold: '#f2a900', ok: '#15803d', 'ok-bg': '#dcfce7', warn: '#b45309', 'warn-bg': '#fef3c7', danger: '#b91c1c', 'danger-bg': '#fee2e2', overlay: 'rgba(1,28,66,.45)',
};

/** Todas las variables CSS para los dos modos + revisión de contraste (para mostrarla en Apariencia) */
export function variables(marca) {
  const b = base(marca);
  const [canvas, surface, inset] = b.fondo;
  const [h, s] = aHsl(canvas);
  const sat = Math.min(s, 40);
  const textoBoton = contraste(b.accion, '#ffffff') >= contraste(b.accion, '#0b1220') ? '#ffffff' : mezclar(b.accion, '#000000', 0.8);
  const oscuro = {
    ...FIJOS_OSCURO, canvas, surface, inset, sidebar: b.menu,
    muted: mezclar('#ffffff', canvas, 0.32), soft: mezclar('#ffffff', b.accion, 0.18),
    action: b.accion, 'on-action': textoBoton, link: legible(b.accion, surface),
  };
  const claro = {
    ...FIJOS_CLARO, canvas: deHsl(h, sat * 0.5, 96.5), surface: '#ffffff', inset: deHsl(h, sat * 0.5, 94), sidebar: b.menu,
    line: deHsl(h, sat * 0.4, 89), 'line-strong': deHsl(h, sat * 0.4, 82),
    text: deHsl(h, Math.max(sat, 30), 12), muted: deHsl(h, sat * 0.35, 40), soft: deHsl(h, Math.max(sat, 30), 28),
    action: b.accion, 'on-action': textoBoton, link: legible(b.accion, '#ffffff'),
  };
  const revision = {
    boton: contraste(b.accion, textoBoton),
    enlaceClaro: contraste(claro.link, '#ffffff'),
    enlaceOscuro: contraste(oscuro.link, surface),
    menu: contraste(b.accion, b.menu),
  };
  return { oscuro, claro, revision, fondoBarra: b.menu };
}

/** Hoja de estilos que se inyecta encima de index.css */
export function css(marca, fuente) {
  const { oscuro, claro } = variables(marca);
  const bloque = (v) => Object.entries(v).map(([k, x]) => `--${k}:${x};`).join('');
  // html:root pesa más que el :root de index.css, sin importar en qué orden cargue cada hoja
  return `html:root,html[data-theme="dark"]{${bloque(oscuro)}}html[data-theme="light"]{${bloque(claro)}}`
    + `html:root{--fuente:${fuente.cuerpo};--fuente-titulos:${fuente.titulos};--peso-titulos:${fuente.peso};}`;
}

/** Las mismas variables como estilo en línea (para las vistas previas de Apariencia) */
export function estiloVista(vars, fuente) {
  const o = {};
  Object.entries(vars).forEach(([k, v]) => { o[`--${k}`] = v; });
  if (fuente) Object.assign(o, { '--fuente': fuente.cuerpo, '--fuente-titulos': fuente.titulos, '--peso-titulos': fuente.peso, fontFamily: fuente.cuerpo });
  return o;
}
