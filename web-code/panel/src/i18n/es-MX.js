// Textos en español (México). Es el idioma base: si a otro idioma le falta una clave, se usa esta.
// Las pantallas que todavía no se pasan a claves siguen con su texto en español directo en el JSX.
export default {
  idiomas: { 'es-MX': 'Español (México)', 'en-US': 'English (US)' },
  comun: {
    guardar: 'Guardar', guardarCambios: 'Guardar cambios', descartar: 'Descartar', cancelar: 'Cancelar', quitar: 'Quitar', cerrar: 'Cerrar',
    salir: 'Salir', cargando: 'Cargando…', guardado: 'Cambios guardados', todasSucursales: 'Todas las sucursales', todas: 'Todas',
    enLinea: 'En línea', sinConexion: 'Sin conexión', modoClaro: 'Modo claro', modoOscuro: 'Modo oscuro', cerrarSesion: 'Cerrar sesión',
    abrirMenu: 'Abrir menú', cerrarMenu: 'Cerrar menú', sesionCerrada: 'Sesión cerrada', pronto: 'Pronto', cuenta: 'Cuenta', sistema: 'Sistema',
    hechoCon: 'con Dojo OS',
  },
  menu: {
    inicio: 'Inicio', miPerfil: 'Mi perfil', alumnos: 'Alumnos', inscripcion: 'Inscripción', caja: 'Caja', horarios: 'Horarios',
    asistencia: 'Asistencia', examenes: 'Exámenes', tarifas: 'Precios y promociones', parametros: 'Parámetros', bitacora: 'Bitácora',
    configuracion: 'Configuración', apariencia: 'Apariencia y marca',
  },
  roles: {
    super_admin: 'Súper administrador', admin_sucursal: 'Administrador de sucursal', recepcion: 'Recepción', instructor: 'Instructor',
    responsable: 'Responsable de pago', alumno: 'Alumno', tableta: 'Tableta de asistencia',
  },
  panel: { trabajarComo: 'Trabajar como', ahoraTrabajas: 'Ahora trabajas como {{rol}}', ahoraTrabajasEn: 'Ahora trabajas como {{rol}} en {{sucursal}}' },
  login: {
    etiqueta: 'Gestión multisucursal', subtitulo: 'Inicia sesión para entrar a tu sucursal', correo: 'Correo electrónico', contrasena: 'Contraseña',
    verContrasena: 'Ver contraseña', ocultarContrasena: 'Ocultar contraseña', recordar: 'Mantener la sesión en este equipo', entrar: 'Entrar',
    cifrada: 'Conexión cifrada · la sesión se cierra tras un tiempo sin uso', faltaCorreo: 'Escribe tu correo', correoInvalido: 'Ese correo no parece válido',
    faltaContrasena: 'Escribe tu contraseña',
  },
  elegirRol: {
    hola: 'Hola, {{nombre}}', titulo: '¿Con qué rol vas a trabajar?', entrando: 'Entrando…',
    texto: 'Tienes acceso en más de una sucursal o con más de un rol. Puedes cambiar después desde la barra de arriba.',
    queHace: {
      super_admin: 'Todas las sucursales: configuración, precios y parámetros', admin_sucursal: 'Horarios, exámenes, excepciones y reportes de la sucursal',
      recepcion: 'Inscribir, cobrar y registrar solicitudes de examen', instructor: 'Pase de lista, autorizar exámenes y capturar resultados',
    },
  },
  perfil: {
    hola: 'Hola, {{nombre}}', tusDatos: 'Tus datos', correo: 'Correo', rolActivo: 'Rol activo', sucursal: 'Sucursal',
    preferencias: 'Preferencias', preferenciasSub: 'Solo cambian cómo ves el sistema tú; no afectan a los demás',
    idioma: 'Idioma', idiomaEmpresa: 'El de la empresa ({{idioma}})', tema: 'Tema', temaSistema: 'Como mi equipo', temaClaro: 'Claro', temaOscuro: 'Oscuro',
    letra: 'Tamaño de letra', letraNormal: 'Normal', letraGrande: 'Grande', letraMuyGrande: 'Muy grande',
  },
  apariencia: {
    titulo: 'Apariencia y marca', descripcion: 'Así se ve el sistema para todos: panel, app de alumnos, recibos y credenciales.',
    identidad: 'Identidad', nombre: 'Nombre comercial', nombreAyuda: 'Aparece en el login, el menú, los recibos y la app',
    lema: 'Lema (opcional)', lemaEjemplo: 'Disciplina, respeto y constancia',
    logos: 'Logos', logo: 'Logo para fondo claro', logoOscuro: 'Logo para fondo oscuro', icono: 'Ícono cuadrado',
    logoAyuda: 'Login en modo claro, recibos y credenciales impresas', logoOscuroAyuda: 'El menú lateral (siempre es oscuro) y el login en modo oscuro',
    iconoAyuda: 'Pestaña del navegador y app instalada en el celular. Cuadrado, 512 × 512',
    subir: 'Subir', cambiar: 'Cambiar', formatos: 'PNG, SVG, JPG o WEBP · hasta 512 KB · fondo transparente de preferencia', imagenGuardada: 'Imagen guardada',
    colores: 'Colores', temasListos: 'Temas listos', personalizado: 'Personalizado', personalizadoDesc: 'Con los colores de tu marca',
    colorPrincipal: 'Color principal', colorPrincipalAyuda: 'Botones, menú activo y resaltados',
    colorFondo: 'Color de fondo', colorFondoAyuda: 'Tono del menú y del modo oscuro',
    contraste: 'Revisión de contraste', textoBotones: 'Texto en botones', enlacesClaro: 'Enlaces en modo claro', enlacesOscuro: 'Enlaces en modo oscuro',
    seLee: 'Se lee bien', justo: 'Justo', pocoLegible: 'Poco legible', contrasteAyuda: 'El sistema ajusta solo el color del texto y de los enlaces para que se lean.',
    letra: 'Tipo de letra', ejemploLetra: 'Ana Ramírez · 7 kup · $650.00',
    region: 'Región', idioma: 'Idioma por defecto', idiomaAyuda: 'Cada usuario puede elegir el suyo en Mi perfil', moneda: 'Moneda', zona: 'Zona horaria', pais: 'País',
    vistaPrevia: 'Vista previa', claro: 'Claro', oscuro: 'Oscuro', sinGuardar: 'Tienes cambios sin guardar', listo: 'Listo: así se ve ahora el sistema',
    ejemplo: { alumnos: 'Alumnos', cobrar: 'Cobrar', alDia: 'Al día', alumno: 'Ana Ramírez', grado: '7 kup', buscar: 'Buscar alumno…' },
  },
};
