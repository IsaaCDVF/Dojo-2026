// Traducción del panel con i18next. Uso en un componente:
//   const { t } = useTranslation();   t('menu.alumnos')   t('perfil.hola', { nombre })
// Para agregar un idioma: copia en-US.js, tradúcelo y regístralo aquí y en la API (MarcaControlador::IDIOMAS).
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import es from './es-MX';
import en from './en-US';

export const IDIOMAS = ['es-MX', 'en-US'];

i18n.use(initReactI18next).init({
  resources: { 'es-MX': { translation: es }, 'en-US': { translation: en } },
  lng: (() => { try { return localStorage.getItem('dojo-idioma') || 'es-MX'; } catch { return 'es-MX'; } })(),
  fallbackLng: 'es-MX',
  interpolation: { escapeValue: false },   // React ya escapa
  returnNull: false,
});

export function cambiarIdioma(idioma) {
  const l = IDIOMAS.includes(idioma) ? idioma : 'es-MX';
  if (i18n.language !== l) i18n.changeLanguage(l);
  document.documentElement.lang = l.slice(0, 2);
  try { localStorage.setItem('dojo-idioma', l); } catch { /* nada */ }
}

export default i18n;
