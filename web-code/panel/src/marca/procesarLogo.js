// Procesa el logo que sube el cliente, en el navegador (no se instala nada en el servidor):
// 1. detecta si trae fondo (blanco, negro o de color) mirando el borde de la imagen y lo quita
// 2. recorta el espacio sobrante
// 3. revisa si se ve sobre fondo claro y sobre el menú oscuro; si no, propone versión en blanco/negro o con placa
// 4. busca el símbolo (lo que está separado del texto) para usarlo como ícono
// El resultado son 3 PNG: logo (fondo claro), logo_oscuro (fondo oscuro) e icono (512 × 512).

const MAX_LADO = 1200;

/* ---------- carga ---------- */
export function cargarImagen(archivo) {
  return new Promise((resolver, rechazar) => {
    const url = URL.createObjectURL(archivo);
    const img = new Image();
    img.onload = () => {
      let w = img.naturalWidth || 1000; let h = img.naturalHeight || 1000;
      const k = Math.min(1, MAX_LADO / Math.max(w, h)); w = Math.round(w * k); h = Math.round(h * k);
      if (archivo.type === 'image/svg+xml' && Math.max(w, h) < 600) { const s = 1000 / Math.max(w, h); w = Math.round(w * s); h = Math.round(h * s); }
      const c = lienzo(w, h); c.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolver(c.getContext('2d').getImageData(0, 0, w, h));
    };
    img.onerror = () => { URL.revokeObjectURL(url); rechazar(new Error('No se pudo leer la imagen. Usa PNG, JPG, WEBP o SVG.')); };
    img.src = url;
  });
}
export function lienzo(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
const copiar = (d) => new ImageData(new Uint8ClampedArray(d.data), d.width, d.height);

/* ---------- color ---------- */
const lumCanal = (v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const luminancia = (r, g, b) => 0.2126 * lumCanal(r) + 0.7152 * lumCanal(g) + 0.0722 * lumCanal(b);
export const hexARgb = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
export const rgbAHex = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
const contrasteL = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

/* ---------- análisis ---------- */
/** Mira el borde: ¿transparente?, ¿un solo color (fondo)? */
export function detectarFondo(d) {
  const { width: w, height: h, data } = d;
  const px = [];
  const tomar = (x, y) => { const i = (y * w + x) * 4; px.push([data[i], data[i + 1], data[i + 2], data[i + 3]]); };
  for (let x = 0; x < w; x += 1) { tomar(x, 0); tomar(x, 1); tomar(x, h - 1); tomar(x, h - 2); }
  for (let y = 0; y < h; y += 1) { tomar(0, y); tomar(1, y); tomar(w - 1, y); tomar(w - 2, y); }
  const transparentes = px.filter((p) => p[3] < 20).length / px.length;
  if (transparentes > 0.6) return { tipo: 'transparente' };
  const opacos = px.filter((p) => p[3] >= 20);
  const med = [0, 1, 2].map((k) => { const v = opacos.map((p) => p[k]).sort((a, b) => a - b); return v[Math.floor(v.length / 2)]; });
  const cerca = opacos.filter((p) => Math.hypot(p[0] - med[0], p[1] - med[1], p[2] - med[2]) < 40).length / opacos.length;
  if (cerca >= 0.85) return { tipo: 'color', color: rgbAHex(med) };
  return { tipo: 'mixto' };   // foto o degradado: no se quita
}

/** Color promedio y luminancia del contenido visible (para saber si se verá en claro y en oscuro) */
export function analizarContenido(d) {
  const { data } = d; let r = 0; let g = 0; let b = 0; let n = 0; let sat = 0; let L = 0;
  for (let i = 0; i < data.length; i += 16) {          // muestreo cada 4 píxeles
    const a = data[i + 3] / 255; if (a < 0.3) continue;
    r += data[i] * a; g += data[i + 1] * a; b += data[i + 2] * a; n += a;
    const mx = Math.max(data[i], data[i + 1], data[i + 2]); const mn = Math.min(data[i], data[i + 1], data[i + 2]);
    sat += (mx - mn) / 255 * a; L += luminancia(data[i], data[i + 1], data[i + 2]) * a;
  }
  if (!n) return { vacio: true, L: 0.5, saturacion: 0, color: '#808080' };
  return { vacio: false, L: L / n, saturacion: sat / n, color: rgbAHex([r / n, g / n, b / n]) };
}

/** Qué parte del logo se distingue sobre ese fondo (0 a 1), píxel por píxel: un logo rojo con letras amarillas
 *  sobre blanco se ve a medias aunque su color promedio sea claro */
export function visibleSobre(d, fondoHex) {
  const [fr, fg, fb] = hexARgb(fondoHex); const Lf = luminancia(fr, fg, fb); const p = d.data;
  let si = 0; let total = 0;
  for (let i = 0; i < p.length; i += 16) {
    const a = p[i + 3] / 255; if (a < 0.3) continue;
    total += a; if (contrasteL(luminancia(p[i], p[i + 1], p[i + 2]), Lf) >= 2.2) si += a;
  }
  return total ? si / total : 1;
}

/** ¿Cómo se ve sobre este fondo? (contraste aproximado del contenido contra el fondo) */
export function seVe(info, fondoHex) {
  const [r, g, b] = hexARgb(fondoHex);
  return contrasteL(info.L, luminancia(r, g, b));
}

/* ---------- transformaciones ---------- */
/** Quita el color de fondo en toda la imagen, con borde suave (tolerancia 10 a 120) */
export function quitarFondo(d, colorHex, tolerancia = 48) {
  const o = copiar(d); const p = o.data; const [br, bg, bb] = hexARgb(colorHex);
  for (let i = 0; i < p.length; i += 4) {
    const dist = Math.hypot(p[i] - br, p[i + 1] - bg, p[i + 2] - bb);
    if (dist < tolerancia) { p[i + 3] = 0; continue; }
    if (dist < tolerancia * 2) {
      const a = (dist - tolerancia) / tolerancia;          // 0..1: borde suave
      // quita el tinte del fondo en las orillas para que no quede un halo
      for (let k = 0; k < 3; k += 1) p[i + k] = Math.max(0, Math.min(255, (p[i + k] - [br, bg, bb][k] * (1 - a)) / a));
      p[i + 3] = Math.round(p[i + 3] * a);
    }
  }
  return o;
}

/** Recorta al contenido visible y deja un margen pequeño */
export function recortar(d, margen = 0.04) {
  const { width: w, height: h, data } = d;
  let x0 = w; let y0 = h; let x1 = -1; let y1 = -1;
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
    if (data[(y * w + x) * 4 + 3] > 16) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 < 0) return d;
  const m = Math.round(Math.max(x1 - x0, y1 - y0) * margen);
  return cortar(d, Math.max(0, x0 - m), Math.max(0, y0 - m), Math.min(w, x1 + m + 1), Math.min(h, y1 + m + 1));
}
function cortar(d, x0, y0, x1, y1) {
  const c = lienzo(d.width, d.height); c.getContext('2d').putImageData(d, 0, 0);
  return c.getContext('2d').getImageData(x0, y0, x1 - x0, y1 - y0);
}

/** Todo lo visible de un solo color (versión blanca para fondo oscuro, negra para fondo claro) */
export function monocromo(d, colorHex) {
  const o = copiar(d); const p = o.data; const [r, g, b] = hexARgb(colorHex);
  for (let i = 0; i < p.length; i += 4) { p[i] = r; p[i + 1] = g; p[i + 2] = b; }
  return o;
}

/**
 * Busca el símbolo: si el logo tiene el dibujo separado del texto por un espacio vacío
 * (a la izquierda en un logo horizontal, arriba en uno vertical), regresa solo el dibujo.
 */
export function buscarSimbolo(d) { return separar(d)?.simbolo || null; }

/** Separa símbolo y texto: { simbolo, texto, orientacion: 'horizontal' | 'vertical' } o null si no se puede */
export function separar(d) {
  const { width: w, height: h, data } = d;
  const lleno = (x, y) => data[(y * w + x) * 4 + 3] > 40;
  const intentar = (largo, ancho, ocupado) => {
    const occ = Array.from({ length: largo }, (_, i) => { for (let j = 0; j < ancho; j += 1) if (ocupado(i, j)) return true; return false; });
    const ini = occ.indexOf(true); const fin = occ.lastIndexOf(true); if (ini < 0) return null;
    let mejor = null; let corrida = 0;
    for (let i = ini; i <= fin; i += 1) {
      if (!occ[i]) { corrida += 1; continue; }
      if (corrida >= (fin - ini) * 0.025 && !mejor) mejor = i - corrida;   // primer hueco que valga la pena
      corrida = 0;
    }
    if (mejor === null) return null;
    return { desde: ini, hasta: mejor, parte: (mejor - ini) / (fin - ini) };
  };
  // horizontal: el símbolo a la izquierda ocupa menos de 60 %; vertical: el símbolo arriba puede ocupar hasta 85 %
  let horiz = intentar(w, h, (x, y) => lleno(x, y)); if (horiz && !(horiz.parte > 0.12 && horiz.parte < 0.6)) horiz = null;
  let vert = null;
  const partes = (s, o) => s && ({
    simbolo: recortar(o === 'h' ? cortar(d, s.desde, 0, s.hasta, h) : cortar(d, 0, s.desde, w, s.hasta), 0.02),
    texto: recortar(o === 'h' ? cortar(d, s.hasta, 0, w, h) : cortar(d, 0, s.hasta, w, h), 0.02),
    orientacion: o === 'h' ? 'horizontal' : 'vertical',
  });
  if (horiz && w >= h) return partes(horiz, 'h');
  vert = intentar(h, w, (y, x) => lleno(x, y)); if (vert && !(vert.parte > 0.25 && vert.parte < 0.85)) vert = null;
  if (vert) return partes(vert, 'v');
  if (horiz) return partes(horiz, 'h');
  return null;
}

/** Logo apilado (símbolo arriba, texto abajo) → horizontal (símbolo a la izquierda): se lee mejor en el menú */
export function acomodarHorizontal(simbolo, texto) {
  const H = 300; const ks = H / simbolo.height; const sw = Math.round(simbolo.width * ks);
  const th = Math.round(H * 0.5); const kt = th / texto.height; const tw = Math.round(texto.width * kt);
  const gap = Math.round(H * 0.14);
  const c = lienzo(sw + gap + tw, H); const x = c.getContext('2d'); x.imageSmoothingQuality = 'high';
  const a = lienzo(simbolo.width, simbolo.height); a.getContext('2d').putImageData(simbolo, 0, 0); x.drawImage(a, 0, 0, sw, H);
  const b = lienzo(texto.width, texto.height); b.getContext('2d').putImageData(texto, 0, 0); x.drawImage(b, sw + gap, (H - th) / 2, tw, th);
  return x.getImageData(0, 0, c.width, c.height);
}

/* ---------- salida ---------- */
/** Logo final en un lienzo: tal cual, o sobre una placa redondeada (para que se vea en cualquier fondo) */
export function componerLogo(d, { placa = null } = {}) {
  if (!placa) { const c = lienzo(d.width, d.height); c.getContext('2d').putImageData(d, 0, 0); return c; }
  const pad = Math.round(Math.max(d.width, d.height) * 0.08);
  const c = lienzo(d.width + pad * 2, d.height + pad * 2); const x = c.getContext('2d');
  x.fillStyle = placa; redondo(x, 0, 0, c.width, c.height, Math.min(c.width, c.height) * 0.22); x.fill();
  const t = lienzo(d.width, d.height); t.getContext('2d').putImageData(d, 0, 0); x.drawImage(t, pad, pad);
  return c;
}
/** Ícono cuadrado de 512: el símbolo (o el logo) centrado sobre el fondo elegido */
export function componerIcono(d, fondo = null) {
  const c = lienzo(512, 512); const x = c.getContext('2d');
  if (fondo) { x.fillStyle = fondo; x.fillRect(0, 0, 512, 512); }
  const t = lienzo(d.width, d.height); t.getContext('2d').putImageData(d, 0, 0);
  const caja = fondo ? 360 : 460; const k = Math.min(caja / d.width, caja / d.height);
  const w = d.width * k; const h = d.height * k;
  x.imageSmoothingQuality = 'high'; x.drawImage(t, (512 - w) / 2, (512 - h) / 2, w, h);
  return c;
}
function redondo(x, a, b, w, h, r) { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); }

/** PNG como dataURL, bajando el tamaño hasta que pese menos de 500 KB (el límite de la API es 512 KB) */
export function aPng(canvas, maxAncho = 1000) {
  let c = canvas;
  if (c.width > maxAncho) { const k = maxAncho / c.width; const r = lienzo(maxAncho, Math.round(c.height * k)); const x = r.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(c, 0, 0, r.width, r.height); c = r; }
  let url = c.toDataURL('image/png');
  while (url.length * 0.75 > 500 * 1024 && c.width > 200) {
    const r = lienzo(Math.round(c.width * 0.8), Math.round(c.height * 0.8)); r.getContext('2d').drawImage(c, 0, 0, r.width, r.height); c = r; url = c.toDataURL('image/png');
  }
  return url;
}
