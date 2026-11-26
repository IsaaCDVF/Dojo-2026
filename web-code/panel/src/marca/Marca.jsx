import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, regional } from '../api';
import { useSesion } from '../auth/Sesion';
import { cambiarIdioma } from '../i18n';
import { css } from './temas';
import { fuenteDe } from './fuentes';
import { nombrePlano } from './NombreMarca';

// Marca de la empresa + preferencias del usuario, aplicadas a todo el panel:
// - tema de colores y letra → una hoja <style id="marca-tema"> encima de index.css
// - modo claro/oscuro → data-theme en <html> (según la preferencia: claro, oscuro o como el equipo)
// - tamaño de letra → zoom de la página; idioma → i18next; moneda e idioma → formatos de dinero y fecha
// Se guarda una copia en localStorage para que al abrir no se vea un instante el tema de fábrica.

const DE_FABRICA = {
  nombre: 'Dojo OS', lema: null, tema: 'oceano', color_primario: null, color_fondo: null, fuente: 'dm-sans', fuente_nombre: 'igual',
  idioma: 'es-MX', moneda: 'MXN', zona_horaria: 'America/Mexico_City', pais: 'MX', imagenes: { logo: null, logo_oscuro: null, icono: null },
};
const ZOOM = { normal: 1, grande: 1.1, muy_grande: 1.2 };
const Ctx = createContext(null);
export const useMarca = () => useContext(Ctx);

const leer = (k, def) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch { return def; } };
const guardarLocal = (k, v) => { try { localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); } catch { /* nada */ } };

export function MarcaProvider({ children }) {
  const { yo } = useSesion();
  const [marca, setMarca] = useState(() => leer('dojo-marca', DE_FABRICA));
  const [borrador, setBorrador] = useState(null);           // vista previa mientras se edita en Apariencia
  const [pref, setPref] = useState(() => leer('dojo-pref', { idioma: null, tema: null, letra: 'normal' }));
  const [modoSistema, setModoSistema] = useState(() => (window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'));

  const recargar = useCallback(async () => {
    const m = await api.get('/marca');
    setMarca(m); guardarLocal('dojo-marca', m);
    return m;
  }, []);
  useEffect(() => { recargar().catch(() => { /* sin API se queda la copia local */ }); }, [recargar]);

  // Al entrar, las preferencias vienen en /auth/yo
  useEffect(() => { if (yo?.preferencias) { setPref(yo.preferencias); guardarLocal('dojo-pref', yo.preferencias); } }, [yo]);

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: light)');
    if (!mq) return undefined;
    const cambio = (e) => setModoSistema(e.matches ? 'light' : 'dark');
    mq.addEventListener('change', cambio);
    return () => mq.removeEventListener('change', cambio);
  }, []);

  const activa = borrador ? { ...marca, ...borrador } : marca;
  const idioma = pref.idioma || activa.idioma;

  // Colores y letra
  useEffect(() => {
    const hoja = css(activa, fuenteDe(activa.fuente));
    let el = document.getElementById('marca-tema');
    if (!el) { el = document.createElement('style'); el.id = 'marca-tema'; document.head.appendChild(el); }
    el.textContent = hoja;
    if (!borrador) guardarLocal('dojo-marca-css', hoja);
  }, [activa.tema, activa.color_primario, activa.color_fondo, activa.fuente, borrador]); // eslint-disable-line react-hooks/exhaustive-deps

  // Nombre en la pestaña e ícono
  useEffect(() => {
    document.title = nombrePlano(activa.nombre) || 'Dojo OS';
    let link = document.querySelector('link[rel="icon"]');
    if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
    link.href = activa.imagenes?.icono || '/favicon.svg';
    link.type = activa.imagenes?.icono ? '' : 'image/svg+xml';
  }, [activa.nombre, activa.imagenes?.icono]);

  // Modo claro / oscuro: preferencia guardada, si no la del equipo; antes de entrar, el último que se usó aquí
  const modo = pref.tema === 'claro' ? 'light' : pref.tema === 'oscuro' ? 'dark'
    : pref.tema === 'sistema' ? modoSistema : (leer('dojo-tema-local', null) || document.documentElement.dataset.theme || 'dark');
  useEffect(() => { document.documentElement.dataset.theme = modo; guardarLocal('dojo-tema', modo); }, [modo]);

  // Letra e idioma
  useEffect(() => { document.documentElement.style.zoom = String(ZOOM[pref.letra] || 1); }, [pref.letra]);
  useEffect(() => { cambiarIdioma(idioma); regional.locale = idioma; regional.moneda = activa.moneda || 'MXN'; }, [idioma, activa.moneda]);

  const guardarPreferencias = useCallback(async (cambios) => {
    setPref((p) => { const n = { ...p, ...cambios }; guardarLocal('dojo-pref', n); return n; });
    if (yo) return api.put('/preferencias', cambios);
    return null;
  }, [yo]);

  /** Botón de sol/luna: cambia el modo y, si hay sesión, lo guarda como preferencia */
  const alternarModo = useCallback(() => {
    const nuevo = modo === 'dark' ? 'claro' : 'oscuro';
    guardarLocal('dojo-tema-local', JSON.stringify(nuevo === 'claro' ? 'light' : 'dark'));
    if (yo) guardarPreferencias({ tema: nuevo }).catch(() => {});
    else setPref((p) => ({ ...p, tema: nuevo }));
  }, [modo, yo, guardarPreferencias]);

  const valor = useMemo(() => ({
    marca: activa, guardada: marca, setMarca: (m) => { setMarca(m); guardarLocal('dojo-marca', m); },
    borrador, setBorrador, recargar, pref, guardarPreferencias, modo, alternarModo, idioma,
  }), [activa, marca, borrador, recargar, pref, guardarPreferencias, modo, alternarModo, idioma]);

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}
