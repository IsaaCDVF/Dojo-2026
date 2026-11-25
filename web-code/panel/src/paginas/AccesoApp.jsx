import { useState } from 'react';
import { Copy, MessageCircle, Smartphone } from 'lucide-react';
import { api, formato } from '../api';
import { useSesion } from '../auth/Sesion';
import { Boton, Chip, ErrorCaja, Modal, Tarjeta, useAvisos, useConfirmar, useDatos } from '../ui';

// Ficha del alumno · acceso a la app móvil. Lo da recepción: genera un código de 6 dígitos (72 h)
// que se manda por WhatsApp. Volver a dar acceso = código nuevo (sirve si olvidó su contraseña).
const ESTADO = { sin_acceso: ['Sin acceso', 'info'], codigo_enviado: ['Código enviado', 'aviso'], activo: ['Activo', 'ok'] };

export default function AccesoApp({ alumnoId }) {
  const { tiene } = useSesion();
  const avisar = useAvisos();
  const confirmar = useConfirmar();
  const datos = useDatos(() => api.get(`/alumnos/${alumnoId}/app`), [alumnoId]);
  const [enviando, setEnviando] = useState(null);
  const [codigo, setCodigo] = useState(null);
  const puede = tiene('alumnos.editar', 'responsables.gestionar');

  async function dar(p) {
    if (p.estado === 'activo' && !(await confirmar({ titulo: 'Nuevo código', texto: `${p.nombre} ya usa la app. Un código nuevo le permite crear otra contraseña (por ejemplo, si la olvidó). ¿Generarlo?`, aceptar: 'Generar código' }))) return;
    setEnviando(p.tipo + (p.responsable_id || ''));
    try {
      const r = await api.post(`/alumnos/${alumnoId}/app`, p.tipo === 'alumno' ? { para: 'alumno' } : { para: 'responsable', responsable_id: p.responsable_id });
      setCodigo({ ...r, nombre: p.nombre }); datos.recargar();
    } catch (e) { avisar(e.message, 'error'); } finally { setEnviando(null); }
  }

  const texto = codigo ? `${codigo.mensaje}\n${window.location.origin}/app/` : '';
  const tel = codigo?.telefono ? codigo.telefono.replace(/\D/g, '').slice(-10) : null;
  async function copiar() { try { await navigator.clipboard.writeText(texto); avisar('Mensaje copiado'); } catch { avisar('No se pudo copiar', 'error'); } }

  return (
    <Tarjeta titulo="App Dojo OS" subtitulo="Credencial, camino de cintas y pagos en el celular" icono={Smartphone}>
      <ErrorCaja error={datos.error} reintentar={datos.recargar} />
      <ul className="space-y-3">
        {(datos.datos || []).map((p) => (
          <li key={p.tipo + p.persona_id} className="text-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-semibold truncate">{p.nombre}</div>
                <div className="text-muted text-[12px]">{p.tipo === 'alumno' ? `Alumno${p.tambien_responsable ? ' · paga por sí mismo' : ''}` : `Responsable${p.parentesco ? ` · ${p.parentesco}` : ''}`}{p.usuario && <> · <span className="font-mono">{p.usuario}</span></>}</div>
              </div>
              <Chip tono={ESTADO[p.estado][1]}>{ESTADO[p.estado][0]}</Chip>
            </div>
            {p.estado === 'codigo_enviado' && <div className="text-[12px] text-muted mt-1">El código vence {formato.fechaHora(p.codigo_vence)}</div>}
            {p.estado === 'activo' && p.ultimo_acceso && <div className="text-[12px] text-muted mt-1">Último uso: {formato.fecha(p.ultimo_acceso)}</div>}
            {p.tipo === 'responsable' && !p.usuario && <div className="text-[12px] text-warn mt-1">Sin teléfono: agrégalo para darle acceso (es su usuario).</div>}
            {puede && (p.tipo === 'alumno' || p.usuario) && (
              <Boton variante={p.estado === 'sin_acceso' ? 'secundario' : 'fantasma'} tam="sm" className="mt-2" cargando={enviando === p.tipo + (p.responsable_id || '')} onClick={() => dar(p)}>
                {p.estado === 'sin_acceso' ? 'Dar acceso' : 'Nuevo código'}
              </Boton>
            )}
          </li>
        ))}
      </ul>
      <Modal abierto={!!codigo} onCerrar={() => setCodigo(null)} titulo="Acceso a la app" subtitulo={codigo?.nombre}
        pie={<>
          <Boton variante="secundario" icono={Copy} onClick={copiar}>Copiar mensaje</Boton>
          {tel && <a href={`https://wa.me/52${tel}?text=${encodeURIComponent(texto)}`} target="_blank" rel="noreferrer"><Boton icono={MessageCircle}>Enviar por WhatsApp</Boton></a>}
        </>}>
        {codigo && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-[10px] bg-inset p-3"><div className="etiqueta">Usuario</div><div className="font-mono font-semibold mt-1 break-all">{codigo.usuario}</div></div>
              <div className="rounded-[10px] bg-inset p-3"><div className="etiqueta">Código</div><div className="font-mono text-[24px] font-semibold tracking-[.2em] mt-0.5">{codigo.codigo}</div></div>
            </div>
            <p className="text-[13px] text-muted">Vence el {codigo.expira}. Solo se muestra esta vez; si se pierde, genera otro. {!tel && 'No hay teléfono registrado: cópialo y mándalo por otro medio.'}</p>
            <pre className="whitespace-pre-wrap rounded-[10px] border border-line p-3 text-[13px] font-sans">{texto}</pre>
          </div>
        )}
      </Modal>
    </Tarjeta>
  );
}
