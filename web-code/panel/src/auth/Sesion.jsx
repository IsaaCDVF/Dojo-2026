import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, token } from '../api';

// Contexto de sesión: quién entró, con qué rol y qué permisos tiene.
// Las pantallas preguntan con tiene('pagos.cobrar') para mostrar u ocultar botones;
// la API vuelve a validar cada permiso en el servidor, esto es solo para la interfaz.

const Ctx = createContext(null);
export const useSesion = () => useContext(Ctx);

export function SesionProvider({ children }) {
  const [yo, setYo] = useState(null);          // respuesta de /auth/yo
  const [cargando, setCargando] = useState(!!token.get());
  const [aviso, setAviso] = useState('');      // mensaje para la pantalla de login (p. ej. sesión expirada)

  const cargarYo = useCallback(async () => {
    const datos = await api.get('/auth/yo');
    setYo(datos);
    return datos;
  }, []);

  useEffect(() => {
    if (!token.get()) return;
    cargarYo().catch(() => { token.borrar(); setYo(null); }).finally(() => setCargando(false));
  }, [cargarYo]);

  useEffect(() => {
    const expirar = (e) => { token.borrar(); setYo(null); setAviso(e.detail || 'Tu sesión terminó. Inicia sesión de nuevo.'); };
    window.addEventListener('dojo:sesion-expirada', expirar);
    return () => window.removeEventListener('dojo:sesion-expirada', expirar);
  }, []);

  const login = useCallback(async (email, password, recordar) => {
    const datos = await api.post('/auth/login', { email, password });
    token.set(datos.token, recordar);
    setAviso('');
    const info = await cargarYo();
    return { ...datos, yo: info };
  }, [cargarYo]);

  const elegirRol = useCallback(async (usuarioRolId) => {
    await api.post('/auth/rol', { usuario_rol_id: usuarioRolId });
    return cargarYo();
  }, [cargarYo]);

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout'); } catch { /* aunque falle, cerramos localmente */ }
    token.borrar();
    setYo(null);
  }, []);

  const valor = useMemo(() => {
    const permisos = new Set(yo?.permisos || []);
    return {
      yo, cargando, aviso, setAviso,
      rol: yo?.rol_activo || null,
      roles: yo?.roles || [],
      usuario: yo?.usuario || null,
      tiene: (...claves) => claves.some((c) => permisos.has(c)),
      login, elegirRol, logout, recargar: cargarYo,
    };
  }, [yo, cargando, aviso, login, elegirRol, logout, cargarYo]);

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

/** Nombres legibles de los roles */
export const NOMBRE_ROL = {
  super_admin: 'Súper administrador',
  admin_sucursal: 'Administrador de sucursal',
  recepcion: 'Recepción',
  instructor: 'Instructor',
  responsable: 'Responsable de pago',
  alumno: 'Alumno',
  tableta: 'Tableta de asistencia',
};
