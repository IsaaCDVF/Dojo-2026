// Cliente único para hablar con la API. Todas las pantallas usan api.get/post/put.
// - Manda el token en "Authorization: Bearer ...".
// - Si la API responde 401 (sin sesión o sesión expirada) avisa con el evento "dojo:sesion-expirada".
// - Si responde 409 por falta de rol, avisa con "dojo:elegir-rol".
// - Cualquier error se lanza como ErrorApi con el mensaje que manda el servidor.

const CLAVE_TOKEN = 'dojo-token';

export class ErrorApi extends Error {
  constructor(mensaje, estado, detalle) {
    super(mensaje);
    this.estado = estado;
    this.detalle = detalle || {};
  }
}

function leer(almacen) {
  try { return almacen.getItem(CLAVE_TOKEN); } catch { return null; }
}

export const token = {
  get: () => leer(sessionStorage) || leer(localStorage),
  set(valor, recordar) {
    try {
      (recordar ? localStorage : sessionStorage).setItem(CLAVE_TOKEN, valor);
      (recordar ? sessionStorage : localStorage).removeItem(CLAVE_TOKEN);
    } catch { /* navegación privada: la sesión dura lo que la pestaña */ }
  },
  borrar() {
    try { sessionStorage.removeItem(CLAVE_TOKEN); localStorage.removeItem(CLAVE_TOKEN); } catch { /* nada */ }
  },
};

async function pedir(metodo, ruta, cuerpo) {
  const t = token.get();
  let resp;
  try {
    resp = await fetch('/api' + ruta, {
      method: metodo,
      headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
  } catch {
    throw new ErrorApi('No hay conexión con el servidor. Revisa que Docker esté levantado.', 0);
  }
  let json = null;
  try { json = await resp.json(); } catch { /* respuesta vacía o no JSON */ }
  if (!resp.ok || !json || json.ok === false) {
    const mensaje = json?.error || `Error ${resp.status}`;
    if (resp.status === 401 && t) window.dispatchEvent(new CustomEvent('dojo:sesion-expirada', { detail: mensaje }));
    if (resp.status === 409 && /rol/i.test(mensaje)) window.dispatchEvent(new CustomEvent('dojo:elegir-rol'));
    throw new ErrorApi(mensaje, resp.status, json?.detalle);
  }
  return json.datos;
}

/** Arma "?a=1&b=2" ignorando valores vacíos */
export function query(params) {
  const q = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') q.set(k, v); });
  const s = q.toString();
  return s ? '?' + s : '';
}

export const api = {
  get: (ruta, params) => pedir('GET', ruta + query(params)),
  post: (ruta, cuerpo) => pedir('POST', ruta, cuerpo ?? {}),
  put: (ruta, cuerpo) => pedir('PUT', ruta, cuerpo ?? {}),
  del: (ruta) => pedir('DELETE', ruta),
};

/** Formatos comunes */
export const formato = {
  dinero: (v) => v === null || v === undefined || v === '' ? '—'
    : Number(v).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }),
  // "2026-11-28" sola se leería como medianoche UTC (un día antes en México): se le agrega la hora local
  fecha: (v) => v ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(v) ? v + 'T00:00' : String(v).replace(' ', 'T')).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—',
  fechaHora: (v) => v ? new Date(String(v).replace(' ', 'T')).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—',
};

/** Descarga una imagen protegida (p. ej. la foto del alumno) y regresa una URL local para <img> */
export async function imagenProtegida(ruta) {
  const t = token.get();
  const r = await fetch('/api' + ruta, { headers: t ? { Authorization: 'Bearer ' + t } : {} });
  if (!r.ok) return null;
  return URL.createObjectURL(await r.blob());
}

export const DIAS = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
export const nombreCompleto = (p) => [p?.nombre, p?.apellido_paterno, p?.apellido_materno].filter(Boolean).join(' ');
