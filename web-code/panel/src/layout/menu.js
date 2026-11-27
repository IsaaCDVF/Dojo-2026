import { BadgeDollarSign, MessageCircle, CreditCard, Tablet, UserCog, CalendarCheck, CalendarDays, ClipboardList, Home, Medal, Palette, Settings, SlidersHorizontal, Tags, UserPlus, UserRound, Users, Wallet } from 'lucide-react';

// Menú lateral: cada opción aparece solo si el rol activo tiene alguno de sus permisos.
// t = clave de traducción (src/i18n). listo: false = la pantalla todavía no está terminada (se muestra con la etiqueta "Pronto").
export const MENU = [
  { a: '/', t: 'menu.inicio', icono: Home, permisos: [], listo: true, exacto: true },
  { a: '/alumnos', t: 'menu.alumnos', icono: Users, permisos: ['alumnos.ver'], listo: true },
  { a: '/inscripcion', t: 'menu.inscripcion', icono: UserPlus, permisos: ['inscripciones.crear'], listo: true },
  { a: '/caja', t: 'menu.caja', icono: Wallet, permisos: ['pagos.cobrar', 'caja.corte'], listo: true },
  { a: '/avisos', t: 'menu.avisos', icono: MessageCircle, permisos: ['avisos.enviar'], listo: true },
  { a: '/horarios', t: 'menu.horarios', icono: CalendarDays, permisos: ['horarios.gestionar', 'asistencia.validar'], listo: true },
  { a: '/asistencia', t: 'menu.asistencia', icono: CalendarCheck, permisos: ['asistencia.validar', 'asistencia.manual', 'asistencia.ver'], listo: true },
  { a: '/examenes', t: 'menu.examenes', icono: Medal, permisos: ['examenes.programar', 'examenes.validar', 'examenes.solicitar'], listo: true },
  { a: '/tarifas', t: 'menu.tarifas', icono: Tags, permisos: ['precios.gestionar', 'promociones.gestionar'], listo: true },
  { a: '/parametros', t: 'menu.parametros', icono: SlidersHorizontal, permisos: ['parametros.ver'], listo: true },
  { a: '/bitacora', t: 'menu.bitacora', icono: ClipboardList, permisos: ['bitacora.ver'], listo: true },
  { a: '/configuracion', t: 'menu.configuracion', icono: Settings, permisos: ['sucursales.gestionar', 'disciplinas.gestionar'], listo: true, exacto: true },
  { a: '/configuracion/personal', t: 'menu.personal', icono: UserCog, permisos: ['roles.asignar'], listo: true },
  { a: '/configuracion/tabletas', t: 'menu.tabletas', icono: Tablet, permisos: ['roles.asignar'], listo: true },
  { a: '/configuracion/pagos-en-linea', t: 'menu.pagosEnLinea', icono: CreditCard, permisos: ['pasarela.configurar'], listo: true },
  { a: '/configuracion/apariencia', t: 'menu.apariencia', icono: Palette, permisos: ['marca.editar'], listo: true },
];

export const iconos = { BadgeDollarSign };
