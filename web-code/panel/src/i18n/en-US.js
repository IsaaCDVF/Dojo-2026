// English (US). Keep the same keys as es-MX.js; anything missing falls back to Spanish.
export default {
  idiomas: { 'es-MX': 'Español (México)', 'en-US': 'English (US)' },
  comun: {
    guardar: 'Save', guardarCambios: 'Save changes', descartar: 'Discard', cancelar: 'Cancel', quitar: 'Remove', cerrar: 'Close',
    salir: 'Sign out', cargando: 'Loading…', guardado: 'Changes saved', todasSucursales: 'All locations', todas: 'All',
    enLinea: 'Online', sinConexion: 'Offline', modoClaro: 'Light mode', modoOscuro: 'Dark mode', cerrarSesion: 'Sign out',
    abrirMenu: 'Open menu', cerrarMenu: 'Close menu', sesionCerrada: 'Signed out', pronto: 'Soon', cuenta: 'Account', sistema: 'System',
    hechoCon: 'with Dojo OS',
  },
  menu: {
    inicio: 'Home', miPerfil: 'My profile', alumnos: 'Students', inscripcion: 'Enrollment', caja: 'Front desk', horarios: 'Schedule',
    asistencia: 'Attendance', examenes: 'Belt testing', tarifas: 'Pricing & promotions', parametros: 'Settings', bitacora: 'Audit log',
    configuracion: 'Setup', apariencia: 'Branding & appearance',
  },
  roles: {
    super_admin: 'Owner', admin_sucursal: 'Location manager', recepcion: 'Front desk', instructor: 'Instructor',
    responsable: 'Account holder', alumno: 'Student', tableta: 'Check-in tablet',
  },
  panel: { trabajarComo: 'Work as', ahoraTrabajas: 'You are now working as {{rol}}', ahoraTrabajasEn: 'You are now working as {{rol}} at {{sucursal}}' },
  login: {
    etiqueta: 'Multi-location management', subtitulo: 'Sign in to your location', correo: 'Email', contrasena: 'Password',
    verContrasena: 'Show password', ocultarContrasena: 'Hide password', recordar: 'Keep me signed in on this device', entrar: 'Sign in',
    cifrada: 'Encrypted connection · you are signed out after a while without activity', faltaCorreo: 'Enter your email', correoInvalido: 'That email does not look right',
    faltaContrasena: 'Enter your password',
  },
  elegirRol: {
    hola: 'Hi, {{nombre}}', titulo: 'Which role will you work as?', entrando: 'Signing in…',
    texto: 'You have access to more than one location or role. You can switch later from the top bar.',
    queHace: {
      super_admin: 'Every location: setup, pricing and settings', admin_sucursal: 'Schedule, testing, exceptions and location reports',
      recepcion: 'Enroll, take payments and register testing requests', instructor: 'Take attendance, approve testing and record results',
    },
  },
  perfil: {
    hola: 'Hi, {{nombre}}', tusDatos: 'Your details', correo: 'Email', rolActivo: 'Current role', sucursal: 'Location',
    preferencias: 'Preferences', preferenciasSub: 'These only change how you see the system; nobody else is affected',
    idioma: 'Language', idiomaEmpresa: 'Business default ({{idioma}})', tema: 'Theme', temaSistema: 'Match my device', temaClaro: 'Light', temaOscuro: 'Dark',
    letra: 'Text size', letraNormal: 'Normal', letraGrande: 'Large', letraMuyGrande: 'Extra large',
  },
  apariencia: {
    titulo: 'Branding & appearance', descripcion: 'This is how everyone sees the system: dashboard, student app, receipts and ID cards.',
    identidad: 'Identity', nombre: 'Business name', nombreAyuda: 'Shown on sign-in, the menu, receipts and the app',
    lema: 'Tagline (optional)', lemaEjemplo: 'Discipline, respect and perseverance',
    logos: 'Logos', logo: 'Logo for light backgrounds', logoOscuro: 'Logo for dark backgrounds', icono: 'Square icon',
    logoAyuda: 'Sign-in in light mode, receipts and printed ID cards', logoOscuroAyuda: 'The side menu (always dark) and sign-in in dark mode',
    iconoAyuda: 'Browser tab and the app installed on phones. Square, 512 × 512',
    subir: 'Upload', cambiar: 'Change', formatos: 'PNG, SVG, JPG or WEBP · up to 512 KB · transparent background preferred', imagenGuardada: 'Image saved',
    colores: 'Colors', temasListos: 'Ready-made themes', personalizado: 'Custom', personalizadoDesc: 'With your brand colors',
    colorPrincipal: 'Main color', colorPrincipalAyuda: 'Buttons, active menu and highlights',
    colorFondo: 'Background color', colorFondoAyuda: 'Tint of the menu and dark mode',
    contraste: 'Contrast check', textoBotones: 'Button text', enlacesClaro: 'Links in light mode', enlacesOscuro: 'Links in dark mode',
    seLee: 'Easy to read', justo: 'Borderline', pocoLegible: 'Hard to read', contrasteAyuda: 'The system adjusts text and link colors automatically so they stay readable.',
    letra: 'Font', ejemploLetra: 'Ana Ramírez · Yellow belt · $65.00',
    region: 'Region', idioma: 'Default language', idiomaAyuda: 'Each user can pick their own in My profile', moneda: 'Currency', zona: 'Time zone', pais: 'Country',
    vistaPrevia: 'Preview', claro: 'Light', oscuro: 'Dark', sinGuardar: 'You have unsaved changes', listo: 'Done: this is how the system looks now',
    ejemplo: { alumnos: 'Students', cobrar: 'Take payment', alDia: 'Paid up', alumno: 'Ana Ramírez', grado: 'Yellow belt', buscar: 'Search student…' },
  },
};
