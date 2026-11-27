// Logo que siempre se ve: si la empresa subió un logo blanco (pensado para fondo oscuro) y alguien usa el modo claro,
// el logo se pinta en negro; y uno negro sobre fondo oscuro se pinta en blanco. Se mide en el navegador una sola vez
// por imagen (brillo promedio de lo que no es transparente). Un logo con fondo propio (sin transparencia) no se toca.
// Copia idéntica en app-code/src/logoLegible.jsx (y web-code/panel/src/marca/logoLegible.jsx).
import { useEffect, useState } from 'react';

const medidas = new Map();
function medir(src) {
  if (medidas.has(src)) return medidas.get(src);
  const p = new Promise((listo) => {
    const img = new Image();
    img.onload = () => {
      try {
        const n = 64; const c = document.createElement('canvas'); c.width = n; c.height = n;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, n, n);
        const d = ctx.getImageData(0, 0, n, n).data;
        let suma = 0; let llenos = 0; let vacios = 0;
        for (let i = 0; i < d.length; i += 4) {
          if (d[i + 3] < 40) { vacios++; continue; }
          suma += (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255; llenos++;
        }
        listo({ brillo: llenos ? suma / llenos : 0.5, transparente: vacios / (n * n) });
      } catch { listo(null); }
    };
    img.onerror = () => listo(null);
    img.src = src;
  });
  medidas.set(src, p);
  return p;
}

/** Filtro CSS para que el logo se vea sobre ese fondo (undefined = se deja como está) */
export function useFiltroLogo(src, fondoOscuro) {
  const [m, setM] = useState(null);
  useEffect(() => {
    let vivo = true;
    setM(null);
    if (src) medir(src).then((x) => vivo && setM(x));
    return () => { vivo = false; };
  }, [src]);
  if (!m || m.transparente < 0.05) return undefined;
  if (!fondoOscuro && m.brillo > 0.78) return 'brightness(0)';
  if (fondoOscuro && m.brillo < 0.22) return 'brightness(0) invert(1)';
  return undefined;
}

/** <img> que se ajusta solo al fondo */
export function ImgLogo({ src, fondoOscuro, style, ...props }) {
  const filtro = useFiltroLogo(src, fondoOscuro);
  return <img src={src} {...props} style={{ ...style, filter: filtro, transition: 'filter .2s' }} />;
}
