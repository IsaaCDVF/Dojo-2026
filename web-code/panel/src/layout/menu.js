import { BadgeDollarSign, CalendarCheck, CalendarDays, ClipboardList, Home, Medal, Settings, SlidersHorizontal, Tags, UserPlus, UserRound, Users, Wallet } from 'lucide-react';

// Menú lateral: cada opción aparece solo si el rol activo tiene alguno de sus permisos.
// listo: false = la pantalla todavía no está terminada (se muestra con la etiqueta "Pronto").
export const MENU = [
  { a: '/', t: 'Inicio', icono: Home, permisos: [], listo: true },
  { a: '/mi-perfil', t: 'Mi perfil', icono: UserRound, permisos: [], listo: true },
  { a: '/alumnos', t: 'Alumnos', icono: Users, permisos: ['alumnos.ver'], listo: true },
  { a: '/inscripcion', t: 'Inscripción', icono: UserPlus, permisos: ['inscripciones.crear'], listo: true },
  { a: '/caja', t: 'Caja', icono: Wallet, permisos: ['pagos.cobrar', 'caja.corte'], listo: true },
  { a: '/horarios', t: 'Horarios', icono: CalendarDays, permisos: ['horarios.gestionar', 'asistencia.validar'], listo: true },
  { a: '/asistencia', t: 'Asistencia', icono: CalendarCheck, permisos: ['asistencia.validar', 'asistencia.manual', 'asistencia.ver'], listo: true },
  { a: '/examenes', t: 'Exámenes', icono: Medal, permisos: ['examenes.programar', 'examenes.validar', 'examenes.solicitar'], listo: true },
  { a: '/tarifas', t: 'Precios y promociones', icono: Tags, permisos: ['precios.gestionar', 'promociones.gestionar'], listo: true },
  { a: '/parametros', t: 'Parámetros', icono: SlidersHorizontal, permisos: ['parametros.ver'], listo: true },
  { a: '/bitacora', t: 'Bitácora', icono: ClipboardList, permisos: ['bitacora.ver'], listo: true },
  { a: '/configuracion', t: 'Configuración', icono: Settings, permisos: ['sucursales.gestionar', 'disciplinas.gestionar'], listo: true },
];

export const iconos = { BadgeDollarSign };
