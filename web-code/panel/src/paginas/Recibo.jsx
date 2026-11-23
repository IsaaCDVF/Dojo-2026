import { useState } from 'react';
import { Ban, Printer } from 'lucide-react';
import { api, formato } from '../api';
import { useSesion } from '../auth/Sesion';
import { AreaTexto, Boton, Cargando, Chip, ErrorCaja, Isotipo, Modal, useAvisos, useDatos } from '../ui';

export const METODOS = { efectivo: 'Efectivo', transferencia: 'Transferencia', pasarela: 'En línea', saldo_favor: 'Saldo a favor' };

/** Recibo imprimible de un pago (S-04). Desde aquí también se cancela, con motivo. */
export default function Recibo({ id, onCerrar, onCambio }) {
  const { tiene } = useSesion();
  const avisar = useAvisos();
  const datos = useDatos(() => api.get(`/caja/pagos/${id}`), [id]);
  const [cancelando, setCancelando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const p = datos.datos;

  async function cancelar() {
    setEnviando(true); setError(null);
    try {
      await api.put(`/caja/pagos/${id}/cancelar`, { motivo });
      avisar(`Recibo ${p.folio} cancelado: lo cobrado vuelve a quedar pendiente`, 'aviso');
      setCancelando(false); datos.recargar(); onCambio?.();
    } catch (e) { setError(e); } finally { setEnviando(false); }
  }

  return (
    <Modal abierto onCerrar={onCerrar} titulo="Recibo" subtitulo={p ? `${p.folio} · ${formato.fechaHora(p.fecha)}` : ''} ancho="max-w-md"
      pie={p && !cancelando && <>
        {tiene('pagos.cancelar') && p.estado === 'aprobado' && <Boton variante="peligro" icono={Ban} onClick={() => setCancelando(true)}>Cancelar pago</Boton>}
        <Boton variante="secundario" icono={Printer} onClick={() => window.print()}>Imprimir</Boton>
      </>}>
      {datos.cargando && !p ? <Cargando /> : <ErrorCaja error={datos.error} reintentar={datos.recargar} />}
      {p && (
        <>
          <div className="imprimible rounded-[10px] border border-line bg-white text-[#0b1220] p-5 font-[Inter] text-sm">
            <div className="flex items-start justify-between gap-4 pb-3 border-b border-dashed border-black/20">
              <div className="flex items-center gap-2">
                <Isotipo className="size-7 text-[#011c42]" />
                <div><div className="font-semibold">Dojo OS</div><div className="text-[12px] text-black/60">{p.sucursal}</div></div>
              </div>
              <div className="text-right">
                <div className="font-mono text-[13px] font-semibold">{p.folio}</div>
                <div className="text-[12px] text-black/60">{formato.fechaHora(p.fecha)}</div>
              </div>
            </div>
            <div className="py-3 border-b border-dashed border-black/20">
              <div className="text-[11px] uppercase tracking-wider text-black/50">Recibimos de</div>
              <div className="font-semibold">{p.responsable || 'Público en general'}</div>
            </div>
            <table className="w-full my-3">
              <tbody>
                {p.lineas.map((l) => (
                  <tr key={l.id} className="align-top">
                    <td className="py-1 pr-3">
                      <div>{l.concepto}</div>
                      {l.alumno && <div className="text-[12px] text-black/55">{l.alumno}</div>}
                      {Number(l.descuento_aplicado) > 0 && <div className="text-[12px] text-emerald-700">Descuento −{formato.dinero(l.descuento_aplicado)}</div>}
                    </td>
                    <td className="py-1 text-right font-mono whitespace-nowrap">{formato.dinero(l.monto_cobrado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <dl className="border-t border-dashed border-black/20 pt-3 space-y-1 font-mono text-[13px]">
              {Number(p.descuento) > 0 && <Fila t="Descuento" v={'−' + formato.dinero(p.descuento)} />}
              {Number(p.saldo_usado) > 0 && <Fila t="Saldo a favor" v={'−' + formato.dinero(p.saldo_usado)} />}
              <Fila t={`Pagado · ${METODOS[p.metodo]}`} v={formato.dinero(p.pagado)} fuerte />
              {p.referencia && <Fila t="Referencia" v={p.referencia} />}
            </dl>
            <div className="mt-4 text-[11px] text-black/50 text-center">Atendió {p.cobro || '—'} · Conserva este recibo</div>
            {p.estado !== 'aprobado' && <div className="mt-3 text-center font-semibold text-red-700 uppercase tracking-wider">Cancelado</div>}
          </div>
          {p.estado !== 'aprobado' && <div className="mt-3"><Chip tono="peligro">Este pago se canceló</Chip></div>}
          {cancelando && (
            <div className="mt-4 space-y-3 anim-entrar">
              <AreaTexto etiqueta="¿Por qué se cancela?" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej. se cobró a la familia equivocada" autoFocus />
              <p className="text-[13px] text-muted">Lo cobrado vuelve a quedar como adeudo y el movimiento queda en la bitácora.</p>
              <ErrorCaja error={error} />
              <div className="flex justify-end gap-2">
                <Boton variante="secundario" onClick={() => setCancelando(false)}>Regresar</Boton>
                <Boton variante="peligro" cargando={enviando} disabled={!motivo.trim()} onClick={cancelar}>Cancelar pago</Boton>
              </div>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}

function Fila({ t, v, fuerte }) {
  return <div className={'flex justify-between gap-4 ' + (fuerte ? 'text-[15px] font-semibold' : 'text-black/70')}><dt>{t}</dt><dd>{v}</dd></div>;
}
