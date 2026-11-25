// Cliente de la API para la app. El token se guarda en el teléfono (localStorage): la sesión de la app
// dura días (parámetro dias_sesion_app), no minutos como la del personal.
const CLAVE = 'dojo-app-token';

export class ErrorApi extends Error {
  constructor(mensaje, estado, detalle) { super(mensaje); this.estado = estado; this.detalle = detalle || {}; }
}

export const token = {
  get: () => { try { return localStorage.getItem(CLAVE); } catch { return null; } },
  set: (t) => { try { localStorage.setItem(CLAVE, t); } catch { /* nada */ } },
  borrar: () => { try { localStorage.removeItem(CLAVE); } catch { /* nada */ } },
};

async function pedir(metodo, ruta, cuerpo) {
  const t = token.get();
  let r;
  try {
    r = await fetch('/api' + ruta, { method: metodo, headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) });
  } catch { throw new ErrorApi('Sin conexión. Revisa tu internet.', 0); }
  let j = null;
  try { j = await r.json(); } catch { /* vacío */ }
  if (!r.ok || !j || j.ok === false) {
    if (r.status === 401 && t) window.dispatchEvent(new CustomEvent('dojo:salir', { detail: j?.error }));
    throw new ErrorApi(j?.error || `Error ${r.status}`, r.status, j?.detalle);
  }
  return j.datos;
}

export const api = {
  get: (ruta) => pedir('GET', ruta),
  post: (ruta, cuerpo) => pedir('POST', ruta, cuerpo ?? {}),
  put: (ruta, cuerpo) => pedir('PUT', ruta, cuerpo ?? {}),
};

const fechaDe = (v) => new Date(/^\d{4}-\d{2}-\d{2}$/.test(v) ? v + 'T00:00' : String(v).replace(' ', 'T'));
export const formato = {
  dinero: (v) => (v === null || v === undefined || v === '' ? '—' : Number(v).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })),
  fecha: (v) => (v ? fechaDe(v).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) : '—'),
  fechaLarga: (v) => (v ? fechaDe(v).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }) : '—'),
  corta: (v) => (v ? fechaDe(v).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit' }) : '—'),
  hora: (v) => (v ? String(v).slice(11, 16) : ''),
};

/** Color de cinta por su nombre ("Amarilla avanzada" → amarillo) */
const COLORES = { blanca: '#f4f4f0', amarilla: '#facc15', naranja: '#fb923c', verde: '#22c55e', azul: '#3b82f6', morada: '#a855f7', roja: '#ef4444', cafe: '#92400e', café: '#92400e', negra: '#151a24' };
export const colorCinta = (t) => { const k = Object.keys(COLORES).find((c) => (t || '').toLowerCase().includes(c)); return k ? COLORES[k] : '#94a3b8'; };
export const nombreCinta = (t) => (t ? t.toLowerCase() : '');
