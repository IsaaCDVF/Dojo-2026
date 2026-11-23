import { useEffect, useState } from 'react';
import { imagenProtegida } from '../api';

const cx = (...c) => c.filter(Boolean).join(' ');

/** Foto del alumno (se pide con el token) o sus iniciales si no hay */
export function FotoAlumno({ id, nombre, tiene = true, className = 'size-10', texto = 'text-sm' }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let vivo = true; let u = null;
    if (id && Number(tiene)) imagenProtegida(`/alumnos/${id}/foto`).then((x) => { u = x; if (vivo) setUrl(x); });
    return () => { vivo = false; if (u) URL.revokeObjectURL(u); };
  }, [id, tiene]);
  const ini = (nombre || '?').split(' ').filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  return url
    ? <img src={url} alt={nombre} className={cx('rounded-full object-cover bg-inset shrink-0', className)} />
    : <span className={cx('grid place-items-center rounded-full bg-gold/18 text-gold font-bold shrink-0', className, texto)}>{ini}</span>;
}
