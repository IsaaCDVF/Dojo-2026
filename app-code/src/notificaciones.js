// Notificaciones al celular (Web Push). Funciona en Android/compu (Chrome, Edge, Firefox) y en iPhone
// solo si la app está agregada a la pantalla de inicio (iOS 16.4 o más nuevo). Necesita https (o localhost).
import { api } from './api';

const SW = '/app/sw.js';
const deB64 = (s) => { const b = atob((s + '='.repeat((4 - (s.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(b, (c) => c.charCodeAt(0)); };
const mismaLlave = (a, b) => { if (!a || !b) return false; const x = new Uint8Array(a); return x.length === b.length && x.every((v, i) => v === b[i]); };

export const esIPhone = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const instalada = () => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
export const soportadas = () => window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

async function registro() {
  const r = await navigator.serviceWorker.register(SW, { scope: '/app/' });
  await navigator.serviceWorker.ready;
  return r;
}

/** 'activas' | 'apagadas' | 'bloqueadas' | 'instalar' (iPhone sin agregar a inicio) | 'https' (abierta sin https) | 'no' (el navegador no puede) */
export async function estado() {
  if (!window.isSecureContext) return 'https';
  if (!soportadas()) return esIPhone() && !instalada() ? 'instalar' : 'no';
  if (Notification.permission === 'denied') return 'bloqueadas';
  const r = await navigator.serviceWorker.getRegistration('/app/');
  const s = r && (await r.pushManager.getSubscription());
  return s && Notification.permission === 'granted' ? 'activas' : 'apagadas';
}

/** Pide permiso y suscribe este celular. Devuelve el estado final */
export async function activar() {
  if (!soportadas()) return estado();
  const permiso = await Notification.requestPermission();
  if (permiso !== 'granted') return permiso === 'denied' ? 'bloqueadas' : 'apagadas';
  await suscribir(await registro());
  return 'activas';
}

async function suscribir(r) {
  const { llave } = await api.get('/app/notificaciones');
  const clave = deB64(llave);
  let s = await r.pushManager.getSubscription();
  if (s && !mismaLlave(s.options?.applicationServerKey, clave)) { await s.unsubscribe(); s = null; }   // cambió la llave del servidor
  s ||= await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: clave });
  await api.post('/app/notificaciones', s.toJSON());
}

/** Al abrir la app: si ya dio permiso, se asegura de que el servidor tenga este celular (por si cambió de cuenta o de llave) */
export async function sincronizar() {
  try {
    if (!soportadas() || Notification.permission !== 'granted') return;
    await suscribir(await registro());
  } catch { /* sin notificaciones no pasa nada: siguen en la campanita */ }
}

/** Ya no quiere notificaciones en este celular (también al cerrar sesión, para que no le lleguen las de otra persona) */
export async function desactivar() {
  try {
    const r = soportadas() && (await navigator.serviceWorker.getRegistration('/app/'));
    const s = r && (await r.pushManager.getSubscription());
    if (!s) return 'apagadas';
    try { await api.post('/app/notificaciones/quitar', { endpoint: s.endpoint }); } catch { /* sin sesión: igual se quita del celular */ }
    await s.unsubscribe();
  } catch { /* nada */ }
  return 'apagadas';
}
