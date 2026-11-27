import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { CheckCircle2, Copy, CreditCard, Loader2, MessageCircle, XCircle } from 'lucide-react';
import { api, formato } from '../api';
import { useMarca } from '../marca/Marca';
import { Boton, ErrorCaja, Modal, useAvisos, useConfirmar } from '../ui';
import { ligaWhatsApp } from './Avisos';

// Cobro con tarjeta en mostrador: Mercado Pago genera el cobro, aquí se muestra como QR,
// la persona lo escanea con su celular y paga. La pantalla pregunta sola cada 3 s y abre el recibo.

export default function CobroQr({ pago, telefono, nombre, onListo, onCerrar }) {
  const avisar = useAvisos();
  const confirmar = useConfirmar();
  const { marca } = useMarca();
  const [qr, setQr] = useState(null);
  const [edo, setEdo] = useState(null);
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const listo = useRef(false);
  const liga = pago ? new URL(pago.url, window.location.origin).href : '';

  useEffect(() => { if (liga) QRCode.toDataURL(liga, { margin: 1, width: 320, color: { dark: '#011c42', light: '#ffffff' } }).then(setQr); }, [liga]);

  // Pregunta cada 3 segundos cómo va
  useEffect(() => {
    if (!pago) return undefined;
    listo.current = false;
    let vivo = true;
    const revisar = async () => {
      try {
        const e = await api.get(`/caja/cobro-qr/${pago.pago_id}`);
        if (!vivo) return;
        setEdo(e); setError(null);
        if (e.estado === 'aprobado' && !listo.current) { listo.current = true; avisar(`Pagado con tarjeta · recibo ${e.folio}`); setTimeout(() => onListo(e.id), 1200); }
      } catch (ex) { if (vivo) setError(ex); }
    };
    revisar();
    const t = setInterval(revisar, 3000);
    return () => { vivo = false; clearInterval(t); };
  }, [pago, avisar, onListo]);

  const simular = async (resultado) => {
    setOcupado(true);
    try { setEdo(await api.post(`/caja/cobro-qr/${pago.pago_id}/prueba`, { resultado })); } catch (e) { setError(e); } finally { setOcupado(false); }
  };
  const cancelar = async () => {
    if (edo?.estado !== 'rechazado' && !(await confirmar({ titulo: 'Cancelar el cobro con tarjeta', texto: 'El QR deja de servir. Si la persona ya estaba pagando en su celular y termina, el pago igual se registra.', aceptar: 'Cancelar cobro', peligro: true }))) return;
    setOcupado(true);
    try { await api.put(`/caja/cobro-qr/${pago.pago_id}/cancelar`); avisar('Cobro con tarjeta cancelado', 'info'); onCerrar(true); }
    catch (e) { if (e.detalle?.estado === 'aprobado') setEdo((x) => ({ ...x, estado: 'aprobado' })); setError(e); }
    finally { setOcupado(false); }
  };
  const copiar = async () => { try { await navigator.clipboard.writeText(liga); avisar('Liga copiada'); } catch { avisar('No se pudo copiar', 'error'); } };

  const estado = edo?.estado || 'pendiente';
  const prueba = pago?.origen === 'prueba';
  return (
    <Modal abierto={!!pago} onCerrar={() => (estado === 'aprobado' ? onListo(edo.id) : onCerrar(false))} titulo="Cobrar con tarjeta"
      subtitulo={`${nombre} · ${formato.dinero(pago?.total)}`}
      pie={estado === 'aprobado' ? <Boton onClick={() => onListo(edo.id)}>Ver recibo</Boton> : <>
        <Boton variante="secundario" onClick={() => onCerrar(false)} title="El cobro sigue vivo; aparece como 'Pagando en línea'">Seguir después</Boton>
        <Boton variante="peligro" cargando={ocupado} onClick={cancelar}>Cancelar cobro</Boton>
      </>}>
      {estado === 'aprobado' ? (
        <div className="text-center py-6 anim-entrar">
          <CheckCircle2 className="size-16 text-ok mx-auto" />
          <div className="text-[22px] font-semibold mt-3">¡Pagado!</div>
          <div className="text-muted mt-1">Recibo {edo.folio} · {formato.dinero(edo.total)}</div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid place-items-center">
            <div className="rounded-xl bg-white p-3 shadow-sm border border-line">{qr ? <img src={qr} alt="QR para pagar con Mercado Pago" className="size-64" /> : <div className="size-64 grid place-items-center"><Loader2 className="size-8 animate-spin text-muted" /></div>}</div>
          </div>
          <ol className="text-[14px] space-y-1 max-w-sm mx-auto">
            <li><b>1.</b> Que abra la cámara de su celular y escanee el código.</li>
            <li><b>2.</b> Paga {formato.dinero(pago?.total)} con su tarjeta en Mercado Pago.</li>
            <li><b>3.</b> Aquí aparece "Pagado" solo y se abre el recibo.</li>
          </ol>
          <div className={`flex items-center justify-center gap-2 text-[14px] font-medium ${estado === 'rechazado' ? 'text-danger' : 'text-muted'}`}>
            {estado === 'rechazado' ? <XCircle className="size-4" /> : <Loader2 className="size-4 animate-spin" />}
            {estado === 'rechazado' ? (edo?.mensaje_usuario || 'El banco rechazó la tarjeta') + (prueba ? '' : '. Puede intentar con otra en su celular.') : 'Esperando el pago…'}
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Boton variante="fantasma" tam="sm" icono={Copy} onClick={copiar}>Copiar liga</Boton>
            {telefono && <Boton variante="fantasma" tam="sm" icono={MessageCircle} onClick={() => window.open(ligaWhatsApp(telefono, `Hola ${nombre.split(' ')[0]}, aquí puedes pagar ${formato.dinero(pago.total)} con tu tarjeta: ${liga}`, marca?.pais), '_blank', 'noopener')}>Mandar por WhatsApp</Boton>}
          </div>
          {prueba && (
            <div className="rounded-lg border border-dashed border-line-strong p-3 space-y-2">
              <div className="flex items-center gap-2 text-[13px] text-muted"><CreditCard className="size-4" />Modo prueba: no se cobra nada. Simula lo que haría la persona:</div>
              <div className="flex flex-wrap gap-2">
                <Boton tam="sm" cargando={ocupado} onClick={() => simular('aprobado')}>Pagó con tarjeta</Boton>
                <Boton tam="sm" variante="secundario" disabled={ocupado} onClick={() => simular('rechazado')}>Tarjeta rechazada</Boton>
              </div>
            </div>
          )}
          <ErrorCaja error={error} />
        </div>
      )}
    </Modal>
  );
}
