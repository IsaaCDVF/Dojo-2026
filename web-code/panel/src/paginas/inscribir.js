import { api } from '../api';

/**
 * Inscribe a un alumno en un horario. Si la API avisa (409 con se_puede_forzar: clase llena
 * o grado fuera de rango), pregunta y reintenta con forzar=true; la excepción queda en la bitácora.
 * Devuelve { ok, datos } o { ok: false, error } o { ok: false, cancelado: true }.
 */
export async function inscribir(cuerpo, confirmar) {
  try {
    return { ok: true, datos: await api.post('/inscripciones', cuerpo) };
  } catch (e) {
    if (e.estado === 409 && e.detalle?.se_puede_forzar) {
      const si = await confirmar({
        titulo: 'Esta inscripción necesita autorización',
        texto: `${e.message}. ¿Inscribir de todos modos? La excepción quedará registrada en la bitácora con tu usuario.`,
        aceptar: 'Inscribir de todos modos',
      });
      if (!si) return { ok: false, cancelado: true };
      try { return { ok: true, datos: await api.post('/inscripciones', { ...cuerpo, forzar: true }) }; }
      catch (e2) { return { ok: false, error: e2.message }; }
    }
    return { ok: false, error: e.message };
  }
}
