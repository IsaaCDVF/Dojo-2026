// Nombre comercial con su propia letra y sus decoraciones.
// Hay empresas con nombres "exóticos": una raya encima (ST̅O̅R̅E̅), subrayado o tachado. Escritas con caracteres
// combinables (U+0305, U+0332, U+0336…) cada letra lleva su pedacito de raya y, según la letra, salen cortadas.
// Aquí se detectan y se dibujan con CSS (text-decoration) para que la línea salga continua con cualquier letra.

export const FUENTES_NOMBRE = {
  igual: { nombre: 'La del sistema', estilo: 'Igual que el resto', css: null, peso: 700 },
  oswald: { nombre: 'Oswald', estilo: 'Condensada', css: "'Oswald Variable', 'Arial Narrow', sans-serif", peso: 600 },
  bebas: { nombre: 'Bebas Neue', estilo: 'Titular', css: "'Bebas Neue', 'Arial Narrow', sans-serif", peso: 400 },
  archivo: { nombre: 'Archivo Black', estilo: 'Gruesa', css: "'Archivo Black', 'Arial Black', sans-serif", peso: 400 },
  russo: { nombre: 'Russo One', estilo: 'Deportiva', css: "'Russo One', sans-serif", peso: 400 },
  playfair: { nombre: 'Playfair', estilo: 'Elegante', css: "'Playfair Display Variable', Georgia, serif", peso: 700 },
  marker: { nombre: 'Marker', estilo: 'Pincel', css: "'Permanent Marker', cursive", peso: 400 },
};

/** Marcas combinables que se convierten en línea continua */
export const DECORACIONES = {
  '̅': 'overline', '̄': 'overline', '̿': 'overline',
  '̲': 'underline', '̱': 'underline', '̳': 'underline',
  '̶': 'line-through', '̵': 'line-through',
};
const esMarca = (c) => /\p{M}/u.test(c);

/** "KEMMA ST̅O̅R̅E̅" → [{ t: 'KEMMA S', deco: '' }, { t: 'TORE', deco: 'overline' }] */
export function trozos(texto = '') {
  const c = Array.from(texto); const res = [];
  for (let i = 0; i < c.length;) {
    let letra = c[i]; i += 1; const decos = new Set();
    while (i < c.length && esMarca(c[i])) { if (DECORACIONES[c[i]]) decos.add(DECORACIONES[c[i]]); else letra += c[i]; i += 1; }
    const deco = [...decos].sort().join(' ');
    const ult = res[res.length - 1];
    // un espacio entre dos partes decoradas no corta la línea
    if (ult && (ult.deco === deco || (letra === ' ' && ult.deco))) ult.t += letra; else res.push({ t: letra, deco });
  }
  return res.map((r) => (r.deco && r.t.endsWith(' ') ? [{ ...r, t: r.t.trimEnd() }, { t: ' ', deco: '' }] : [r])).flat();
}

/** El nombre sin decoraciones (para la pestaña del navegador y lugares sin estilo) */
export const nombrePlano = (texto = '') => Array.from(texto).filter((c) => !DECORACIONES[c]).join('');

/** Pone o quita una decoración a un pedazo de texto: decorar('TORE', '̅') → 'T̅O̅R̅E̅' */
export function decorar(texto, marca) {
  const limpio = nombrePlano(texto);
  return marca ? Array.from(limpio).map((ch) => (/\s/.test(ch) || esMarca(ch) ? ch : ch + marca)).join('') : limpio;
}

export function NombreMarca({ nombre, fuente = 'igual', className = '', style }) {
  const f = FUENTES_NOMBRE[fuente] || FUENTES_NOMBRE.igual;
  const partes = trozos(nombre);
  // Las rayas quedan fuera del renglón y un contenedor que corta (truncate) las esconde: se les da aire arriba o abajo
  const arriba = partes.some((p) => p.deco.includes('overline')); const abajo = partes.some((p) => p.deco.includes('underline'));
  const aire = arriba || abajo
    ? { display: 'inline-block', maxWidth: '100%', paddingTop: arriba ? '0.22em' : undefined, paddingBottom: abajo ? '0.2em' : undefined, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'bottom' } : {};
  return (
    <span className={className} style={{ ...(f.css ? { fontFamily: f.css, fontWeight: f.peso, letterSpacing: fuente === 'bebas' ? '0.02em' : undefined } : {}), ...aire, ...style }}>
      {partes.map((p, i) => (p.deco
        ? <span key={i} style={{ textDecorationLine: p.deco, textDecorationThickness: '0.075em', textUnderlineOffset: '0.14em', textDecorationSkipInk: 'none' }}>{p.t}</span>
        : <span key={i}>{p.t}</span>))}
    </span>
  );
}
