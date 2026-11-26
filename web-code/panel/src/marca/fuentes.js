// Tipos de letra que vienen dentro del sistema (no se descargan de Google: funcionan sin internet y sin rastreo).
// El navegador solo baja la que se usa.
const SISTEMA = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
export const FUENTES = {
  'dm-sans': { nombre: 'DM Sans + Inter', estilo: 'Moderna (la de siempre)', cuerpo: `'DM Sans Variable', ${SISTEMA}`, titulos: `'Inter Variable', ${SISTEMA}`, peso: 300 },
  inter: { nombre: 'Inter', estilo: 'Limpia y neutra', cuerpo: `'Inter Variable', ${SISTEMA}`, titulos: `'Inter Variable', ${SISTEMA}`, peso: 400 },
  nunito: { nombre: 'Nunito', estilo: 'Redondeada y amigable', cuerpo: `'Nunito Variable', ${SISTEMA}`, titulos: `'Nunito Variable', ${SISTEMA}`, peso: 700 },
  montserrat: { nombre: 'Montserrat', estilo: 'Geométrica y deportiva', cuerpo: `'Montserrat Variable', ${SISTEMA}`, titulos: `'Montserrat Variable', ${SISTEMA}`, peso: 600 },
  poppins: { nombre: 'Poppins', estilo: 'Geométrica y suave', cuerpo: `'Poppins', ${SISTEMA}`, titulos: `'Poppins', ${SISTEMA}`, peso: 500 },
  'source-sans': { nombre: 'Source Sans 3', estilo: 'Clara para leer mucho', cuerpo: `'Source Sans 3 Variable', ${SISTEMA}`, titulos: `'Source Sans 3 Variable', ${SISTEMA}`, peso: 600 },
  lora: { nombre: 'Lora + DM Sans', estilo: 'Clásica, con títulos con remate', cuerpo: `'DM Sans Variable', ${SISTEMA}`, titulos: `'Lora Variable', Georgia, serif`, peso: 500 },
  sistema: { nombre: 'La del sistema', estilo: 'La del Windows, Mac o celular', cuerpo: SISTEMA, titulos: SISTEMA, peso: 400 },
};
export const fuenteDe = (clave) => FUENTES[clave] || FUENTES['dm-sans'];
