import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, CreditCard, Receipt } from 'lucide-react';
import { api, formato } from '../api';
import { Cabecera } from '../Marco';
import { Boton, Cargando, Chip, ErrorCaja, Hoja, Tarjeta, useDatos } from '../ui';

// Pagos: lo pendiente, desglosado por alumno, y el historial con su recibo.
const METODO = { efectivo: 'Efectivo', transferencia: 'Transferencia', pasarela: 'En línea', saldo_favor: 'Saldo a favor' };

export default function Pagos() {
  const datos = useDatos(() => api.get('/app/familia'), []);
  const [recibo, setRecibo] = useState(null);
  const navegar = useNavigate();
  const d = datos.datos;
  if (datos.cargando && !d) return <Cargando />;
  if (datos.error) return <><Cabecera titulo="Pagos" /><ErrorCaja error={datos.error} reintentar={datos.recargar} /></>;

  return (
    <>
      <Cabecera titulo="Pagos" />
      <div className="space-y-4">
        <Tarjeta>
          <div className="flex items-center justify-between"><h3 className="text-[19px] font-black">Pendiente</h3><span className="text-[20px] font-black tabular-nums">{formato.dinero(d.total)}</span></div>
          {!d.adeudos.length && <p className="text-soft font-semibold mt-2">No debes nada. ¡Gracias!</p>}
          <ul className="mt-3 divide-y-2 divide-line">
            {d.adeudos.map((l) => (
              <li key={l.clave} className="flex items-center gap-3 py-3">
                <div className="flex-1 min-w-0">
                  <div className="font-black truncate">{l.concepto}{l.detalle ? ` · ${l.detalle}` : ''}</div>
                  <div className="text-[13px] text-muted font-semibold">{l.alumno} · vence {formato.fecha(l.vence)}</div>
                </div>
                <div className="text-right">
                  <div className="font-black tabular-nums">{formato.dinero(l.precio)}</div>
                  {l.en_linea ? <Chip tono="accion">En proceso</Chip> : l.estado === 'vencida' ? <Chip tono="peligro">Vencido</Chip> : <Chip tono="oro">Por pagar</Chip>}
                </div>
              </li>
            ))}
          </ul>
          {d.adeudos.length > 0 && d.pago_en_linea !== 'apagado' && <Boton tono="oro" icono={CreditCard} className="mt-3" onClick={() => navegar('/pagar')}>Pagar en línea</Boton>}
        </Tarjeta>

        <Tarjeta>
          <h3 className="text-[19px] font-black">Mis pagos</h3>
          {!d.pagos.length && <p className="text-soft font-semibold mt-2">Aquí verás tus recibos.</p>}
          <ul className="mt-2 divide-y-2 divide-line">
            {d.pagos.map((p) => (
              <li key={p.id}>
                <button onClick={() => (p.estado === 'pendiente' && Number(p.en_linea) ? navegar(`/pago/${p.id}`) : setRecibo(p.id))} className="w-full flex items-center gap-3 py-3 text-left cursor-pointer">
                  <span className="grid place-items-center size-11 rounded-2xl bg-inset shrink-0"><Receipt className="size-5 text-action" /></span>
                  <div className="flex-1 min-w-0"><div className="font-black">{formato.fecha(p.fecha)} · {METODO[p.metodo] || p.metodo}{p.medio === 'ticket' ? ' (OXXO)' : p.medio === 'bank_transfer' ? ' (SPEI)' : ''}</div><div className="text-[13px] text-muted font-mono font-semibold">{p.folio || 'Esperando el pago'}</div></div>
                  <div className="text-right"><div className="font-black tabular-nums">{formato.dinero(p.total)}</div>{p.estado === 'pendiente' ? <Chip tono="oro">Pendiente</Chip> : p.estado !== 'aprobado' && <Chip tono="peligro">{p.estado === 'reembolsado' ? 'Cancelado' : p.estado}</Chip>}</div>
                  <ChevronRight className="size-5 text-muted" />
                </button>
              </li>
            ))}
          </ul>
        </Tarjeta>
      </div>
      <Recibo id={recibo} onCerrar={() => setRecibo(null)} />
    </>
  );
}

function Recibo({ id, onCerrar }) {
  const datos = useDatos(() => (id ? api.get(`/app/pagos/${id}`) : Promise.resolve(null)), [id]);
  const r = datos.datos;
  return (
    <Hoja abierta={!!id} onCerrar={onCerrar} titulo="Recibo" clara>
      {datos.cargando || !r ? <Cargando className="!text-[#011c42]/50" /> : (
        <div>
          <div className="text-center border-b-2 border-dashed border-black/15 pb-4">
            <div className="font-black text-[18px]">Dojo OS · {r.sucursal}</div>
            <div className="font-mono font-bold opacity-70">{r.folio}</div>
            <div className="text-[14px] font-semibold opacity-70">{new Date(String(r.fecha).replace(' ', 'T')).toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' })}</div>
            {r.estado === 'reembolsado' && <div className="mt-2 inline-block rounded-full bg-red-100 text-red-700 px-3 py-1 text-[12px] font-black">CANCELADO</div>}
          </div>
          <ul className="py-3 space-y-2">
            {r.lineas.map((l, i) => (
              <li key={i} className="flex justify-between gap-3 text-[15px]">
                <div><div className="font-bold">{l.concepto}</div>{l.alumno && <div className="text-[13px] opacity-60 font-semibold">{l.alumno}</div>}{Number(l.descuento_aplicado) > 0 && <div className="text-[13px] text-emerald-700 font-bold">Descuento −{formato.dinero(l.descuento_aplicado)}</div>}</div>
                <div className="font-bold tabular-nums">{formato.dinero(l.monto_cobrado)}</div>
              </li>
            ))}
          </ul>
          <div className="border-t-2 border-dashed border-black/15 pt-3 space-y-1">
            {Number(r.saldo_usado) > 0 && <div className="flex justify-between font-bold opacity-70"><span>Saldo a favor usado</span><span>−{formato.dinero(r.saldo_usado)}</span></div>}
            <div className="flex justify-between text-[20px] font-black"><span>Pagado · {METODO[r.metodo] || r.metodo}</span><span>{formato.dinero(r.pagado)}</span></div>
          </div>
        </div>
      )}
    </Hoja>
  );
}
