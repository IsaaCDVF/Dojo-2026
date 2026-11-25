import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, token } from './api';

// Quién abrió la app: su persona, si es alumno, si es responsable y qué alumnos puede ver.
const Ctx = createContext(null);
export const useSesion = () => useContext(Ctx);

export function SesionProvider({ children }) {
  const [yo, setYo] = useState(null);
  const [cargando, setCargando] = useState(!!token.get());
  const [aviso, setAviso] = useState('');

  const cargar = useCallback(async () => { const d = await api.get('/app/yo'); setYo(d); return d; }, []);

  useEffect(() => {
    if (!token.get()) return;
    cargar().catch(() => { token.borrar(); setYo(null); }).finally(() => setCargando(false));
  }, [cargar]);

  useEffect(() => {
    const salir = (e) => { token.borrar(); setYo(null); setAviso(e.detail || 'Tu sesión terminó. Entra de nuevo.'); };
    window.addEventListener('dojo:salir', salir);
    return () => window.removeEventListener('dojo:salir', salir);
  }, []);

  const entrar = useCallback(async (usuario, password) => {
    const d = await api.post('/auth/login', { email: usuario, password });
    token.set(d.token); setAviso('');
    return cargar();
  }, [cargar]);

  const activar = useCallback(async (usuario, codigo, password) => {
    const d = await api.post('/app/activar', { usuario, codigo, password });
    token.set(d.token); setAviso('');
    return cargar();
  }, [cargar]);

  const salir = useCallback(async () => {
    try { await api.post('/auth/logout'); } catch { /* aunque falle */ }
    token.borrar(); setYo(null);
  }, []);

  const valor = useMemo(() => ({ yo, cargando, aviso, entrar, activar, salir, recargar: cargar }), [yo, cargando, aviso, entrar, activar, salir, cargar]);
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}
