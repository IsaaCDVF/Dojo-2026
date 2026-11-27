// Cuántos avisos sin leer tiene (para la campanita). Se pide como mucho cada 60 s aunque cambies de pantalla.
import { useEffect, useState } from 'react';
import { api } from './api';

let cache = { n: 0, cuando: 0, promesa: null };
const oyentes = new Set();
const avisar = () => oyentes.forEach((f) => f(cache.n));

export function refrescarCampanita(forzar = false) {
  if (!forzar && (cache.promesa || Date.now() - cache.cuando < 60000)) return;
  cache.promesa = api.get('/app/avisos').then((d) => { cache = { n: d.sin_leer || 0, cuando: Date.now(), promesa: null }; avisar(); })
    .catch(() => { cache.promesa = null; cache.cuando = Date.now(); });
}
export function ponerSinLeer(n) { cache = { ...cache, n, cuando: Date.now() }; avisar(); }

export function useSinLeer() {
  const [n, setN] = useState(cache.n);
  useEffect(() => { oyentes.add(setN); refrescarCampanita(); return () => oyentes.delete(setN); }, []);
  return n;
}
