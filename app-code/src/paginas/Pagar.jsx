import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, CreditCard, Loader2, Lock, Store } from 'lucide-react';
import { api, formato } from '../api';
import { Cabecera } from '../Marco';
import { Boton, Cargando, Chip, ErrorCaja, Tarjeta, cx, useDatos } from '../ui';

// Pagar en línea: elige qué pagar y sigue a Mercado Pago (tarjeta, OXXO, SPEI). En modo prueba se simula aquí mismo.
// Una mensualidad vencida va siempre con su recargo (así lo pide la caja también).

const recargoDe = (clave) => (clave.startsWith('mens:') ? 'rec:' + clave.slice(5) : null);

export default function Pagar() {
  const navegar = useNavigate();
  const datos = useDatos(() => api.get('/app/familia'), []);
  const d = datos.datos;
  const [marcadas, setMarcadas] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const libres = useMemo(() => (d?.adeudos || []).filter((l) => !l.en_linea), [d]);
  useEffect(() => { if (d && marcadas === null) setMarcadas(new Set(libres.map((l) => l.clave))); }, [d, libres, marcadas]);

  if (datos.cargando && !d) return <><Cabecera titulo="Pagar" /><Cargando /></>;
  if (datos.error) return <><Cabecera titulo="Pagar" /><ErrorCaja error={datos.error} reintentar={datos.recargar} /></>;
  if (!marcadas) return null;

  const enProceso = (d.adeudos || []).filter((l) => l.en_linea);
  const visibles = libres.filter((l) => !l.clave.startsWith('rec:'));
  const alternar = (l) => {
    const n = new Set(marcadas); const rec = recargoDe(l.clave);
    if (n.has(l.clave)) { n.delete(l.clave); if (rec) n.delete(rec); } else { n.add(l.clave); if (rec && libres.some((x) => x.clave === rec)) n.add(rec); }
    setMarcadas(n);
  };
  const total = libres.filter((l) => marcadas.has(l.clave)).reduce((s, l) => s + Number(l.precio || 0), 0);

  async function pagar() {
    setEnviando(true); setError(null);
    try {
      const r = await api.post('/app/pagos-en-linea', { claves: [...marcadas] });
      if (r.url.startsWith('/app/')) navegar(r.url.slice(4), { replace: true });
      else window.location.href = r.url;   // checkout de Mercado Pago
    } catch (e) {
      if (e.detalle?.pago_id) { navegar(`/pago/${e.detalle.pago_id}`); return; }
      setError(e); setEnviando(false);
    }
  }

  return (
    <>
      <Cabecera titulo="Pagar" />
      <div className="space-y-4">
        {d.pago_en_linea === 'apagado' ? (
          <Tarjeta className="flex items-center gap-3"><Store className="size-6 text-soft" /><p className="font-bold">El pago en línea no está activo. Paga en recepción{d.sucursal ? ` de ${d.sucursal}` : ''}.</p></Tarjeta>
        ) : (
          <>
            {enProceso.length > 0 && (
              <Tarjeta className="!p-4">
                <div className="font-black">Tienes un pago en proceso</div>
                <p className="text-[14px] text-soft font-semibold mt-1">{enProceso.filter((l) => !l.clave.startsWith('rec:')).map((l) => `${l.concepto}${l.detalle ? ` ${l.detalle}` : ''}`).join(', ')}</p>
                <Link to={`/pago/${enProceso[0].en_linea.pago_id}`} className="inline-block mt-2 font-black text-action">Ver ese pago</Link>
              </Tarjeta>
            )}
            <Tarjeta>
              <h3 className="text-[19px] font-black">¿Qué quieres pagar?</h3>
              {!visibles.length && <p className="text-soft font-semibold mt-2">No tienes nada pendiente. ¡Gracias!</p>}
              <ul className="mt-3 space-y-2">
                {visibles.map((l) => {
                  const on = marcadas.has(l.clave); const rec = libres.find((x) => x.clave === recargoDe(l.clave));
                  return (
                    <li key={l.clave}>
                      <button onClick={() => alternar(l)} aria-pressed={on} className={cx('w-full flex items-center gap-3 rounded-2xl border-2 p-3 text-left cursor-pointer', on ? 'border-action bg-action/10' : 'border-line')}>
                        <span className={cx('grid place-items-center size-7 rounded-lg border-2 shrink-0', on ? 'bg-action border-action text-on-action' : 'border-line-strong')}>{on && <Check className="size-4" strokeWidth={3.5} />}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-black truncate">{l.concepto}{l.detalle ? ` · ${l.detalle}` : ''}</div>
                          <div className="text-[13px] text-muted font-semibold">{l.alumno}{rec ? ` · + recargo ${formato.dinero(rec.precio)}` : ''}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-black tabular-nums">{formato.dinero(Number(l.precio || 0) + Number(rec?.precio || 0))}</div>
                          {l.estado === 'vencida' ? <Chip tono="peligro">Vencido</Chip> : <Chip tono="oro">Por pagar</Chip>}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Tarjeta>
            <ErrorCaja error={error} />
            {visibles.length > 0 && (
              <div className="space-y-3">
                <Boton tono="oro" icono={enviando ? Loader2 : CreditCard} cargando={enviando} disabled={!marcadas.size} onClick={pagar}>
                  Pagar {formato.dinero(total)}
                </Boton>
                <p className="text-center text-[13px] text-muted font-semibold flex items-center justify-center gap-1.5">
                  <Lock className="size-3.5" />{d.pago_en_linea === 'prueba' ? 'Modo prueba: no se cobra nada' : 'Con tarjeta, OXXO o SPEI en Mercado Pago'}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
