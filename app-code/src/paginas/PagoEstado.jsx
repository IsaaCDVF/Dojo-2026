import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Building2, CheckCircle2, Clock, CreditCard, ExternalLink, FlaskConical, PiggyBank, RotateCcw, Store, XCircle } from 'lucide-react';
import { api, formato } from '../api';
import { Cabecera } from '../Marco';
import { Boton, Cargando, Confeti, ErrorCaja, Tarjeta, cx, useDatos } from '../ui';

// Cómo va un pago en línea. Pregunta cada pocos segundos mientras esté pendiente (Mercado Pago puede tardar en avisar;
// una ficha de OXXO o SPEI se acredita cuando la pagan). En modo prueba muestra botones para simular cada resultado.

const MEDIO = { ticket: 'OXXO', bank_transfer: 'SPEI', credit_card: 'tarjeta de crédito', debit_card: 'tarjeta de débito', account_money: 'saldo de Mercado Pago' };

export default function PagoEstado() {
  const { id } = useParams();
  const [q] = useSearchParams();
  const navegar = useNavigate();
  const datos = useDatos(() => api.get(`/app/pagos-en-linea/${id}`), [id]);
  const [simulando, setSimulando] = useState('');
  const [error, setError] = useState(null);
  const p = datos.datos;
  const pendiente = p?.estado === 'pendiente' && p.vigente;

  useEffect(() => {
    if (!pendiente) return undefined;
    const t = setInterval(() => { if (document.visibilityState === 'visible') datos.recargar(); }, 5000);
    return () => clearInterval(t);
  }, [pendiente, datos.recargar]); // eslint-disable-line react-hooks/exhaustive-deps

  async function simular(resultado) {
    setSimulando(resultado); setError(null);
    try { await api.post(`/app/pagos-en-linea/${id}/prueba`, { resultado }); await datos.recargar(); } catch (e) { setError(e); } finally { setSimulando(''); }
  }

  if (datos.cargando && !p) return <><Cabecera titulo="Tu pago" /><Cargando /></>;
  if (datos.error) return <><Cabecera titulo="Tu pago" /><ErrorCaja error={datos.error} reintentar={datos.recargar} /></>;
  const prueba = p.origen === 'prueba' && p.modo === 'prueba';
  const ficha = pendiente && (p.medio === 'ticket' || p.medio === 'bank_transfer');
  const verFicha = q.get('ficha');

  return (
    <>
      <Cabecera titulo="Tu pago" />
      <div className="space-y-4">
        {p.estado === 'aprobado' && (
          <section className="rounded-3xl p-6 text-center bg-ok/12 border-2 border-ok/50 anim-entrar">
            <Confeti />
            <CheckCircle2 className="size-14 text-ok mx-auto" />
            <h2 className="text-[26px] font-black mt-2">¡Pago recibido!</h2>
            <p className="text-soft font-bold">{formato.dinero(p.total)}{p.medio ? ` con ${MEDIO[p.medio] || p.medio}` : ''}</p>
            <div className="font-mono font-bold text-muted mt-1">Recibo {p.folio}</div>
          </section>
        )}
        {p.estado === 'rechazado' && (
          <section className="rounded-3xl p-6 text-center bg-danger/10 border-2 border-danger/50 anim-entrar">
            <XCircle className="size-14 text-danger mx-auto" />
            <h2 className="text-[24px] font-black mt-2">{p.codigo_respuesta === 'cancelado' ? 'El pago se canceló' : 'No se pudo cobrar'}</h2>
            <p className="text-soft font-bold mt-1">{p.mensaje_usuario || 'Intenta con otro medio de pago o paga en recepción.'}</p>
          </section>
        )}
        {p.estado === 'pendiente' && !p.vigente && (
          <section className="rounded-3xl p-6 text-center bg-inset border-2 border-line anim-entrar">
            <Clock className="size-12 text-muted mx-auto" />
            <h2 className="text-[22px] font-black mt-2">Este pago ya no está activo</h2>
            <p className="text-soft font-bold mt-1">Se quedó sin terminar. Puedes generar uno nuevo.</p>
          </section>
        )}
        {pendiente && !ficha && (
          <section className="rounded-3xl p-6 text-center bg-gold/10 border-2 border-gold/50 anim-entrar">
            <CreditCard className="size-12 text-gold mx-auto" />
            <h2 className="text-[22px] font-black mt-2">{p.medio ? 'Estamos confirmando tu pago' : 'Termina tu pago'}</h2>
            <p className="text-soft font-bold mt-1">{formato.dinero(p.total)}{p.medio ? '. Esto se actualiza solo.' : ' en Mercado Pago: tarjeta, OXXO o SPEI.'}</p>
            {!prueba && !p.medio && p.url_pago && <a href={p.url_pago} className="block mt-4"><Boton tono="oro" icono={ExternalLink}>Ir a Mercado Pago</Boton></a>}
          </section>
        )}
        {ficha && (
          <section className="rounded-3xl p-6 bg-surface border-2 border-line anim-entrar">
            <div className="flex items-center gap-3">
              {p.medio === 'ticket' ? <Store className="size-9 text-gold" /> : <Building2 className="size-9 text-action" />}
              <div><h2 className="text-[20px] font-black">{p.medio === 'ticket' ? 'Paga en OXXO' : 'Paga por transferencia SPEI'}</h2>
                <p className="text-soft font-bold text-[14px]">{formato.dinero(p.total)}{p.expira ? ` · antes del ${formato.fecha(p.expira)}` : ''}</p></div>
            </div>
            <p className="text-[14px] font-semibold text-muted mt-3">{p.mensaje_usuario}</p>
            {prueba ? (verFicha && <FichaDePrueba p={p} />) : p.ficha_url && <a href={p.ficha_url} target="_blank" rel="noreferrer" className="block mt-4"><Boton tono="suave" icono={ExternalLink}>{p.medio === 'ticket' ? 'Ver ficha para el OXXO' : 'Ver datos para transferir'}</Boton></a>}
            {prueba && !verFicha && <Link to={`/pago/${id}?ficha=1`} className="block mt-4"><Boton tono="suave">Ver ficha (prueba)</Boton></Link>}
          </section>
        )}

        {prueba && pendiente && (
          <Tarjeta className="border-dashed !border-gold/60">
            <div className="flex items-center gap-2 font-black"><FlaskConical className="size-5 text-gold" />Modo prueba: no se cobra nada</div>
            <p className="text-[13px] text-muted font-semibold mt-1">Así se ve cada caso. Con Mercado Pago real esto lo decide el banco o la tienda.</p>
            <div className="grid grid-cols-2 gap-2 mt-3">
              {(ficha
                ? [['pagar_ficha', 'Ya pagué', 'accion'], ['vencer', 'Dejar que venza', 'suave']]
                : [['aprobado', 'Tarjeta aprobada', 'accion'], ['rechazado', 'Tarjeta rechazada', 'suave'], ['oxxo', 'Pagar en OXXO', 'suave'], ['spei', 'Transferencia SPEI', 'suave']]
              ).map(([k, t, tono]) => <Boton key={k} tono={tono} cargando={simulando === k} onClick={() => simular(k)} className="!min-h-12 !text-[13px] !px-2">{t}</Boton>)}
            </div>
          </Tarjeta>
        )}
        <Tarjeta>
          <div className="flex items-center justify-between"><h3 className="text-[17px] font-black">Detalle</h3><span className="font-black tabular-nums">{formato.dinero(p.total)}</span></div>
          <ul className="mt-2 divide-y-2 divide-line">
            {p.lineas.map((l, i) => (
              <li key={i} className="flex justify-between gap-3 py-2.5 text-[15px]"><div><div className="font-bold">{l.concepto}</div>{l.alumno && <div className="text-[13px] text-muted font-semibold">{l.alumno}</div>}</div><div className="font-bold tabular-nums">{formato.dinero(l.neto)}</div></li>
            ))}
          </ul>
          {Number(p.a_favor) > 0 && <p className="mt-3 flex items-center gap-2 text-[14px] font-bold text-violet"><PiggyBank className="size-5" />{formato.dinero(p.a_favor)} ya estaban pagados en recepción: te quedan como saldo a favor.</p>}
        </Tarjeta>

        <ErrorCaja error={error} />

        {(p.estado === 'rechazado' || (p.estado === 'pendiente' && !p.vigente)) && <Boton tono="oro" icono={RotateCcw} onClick={() => navegar('/pagar')}>Intentar de nuevo</Boton>}
        <Link to="/pagos" className={cx('block')}><Boton tono="contorno">{p.estado === 'aprobado' ? 'Ver mis recibos' : 'Volver a mis pagos'}</Boton></Link>
      </div>
    </>
  );
}

/** Ficha simulada (solo modo prueba), para enseñar cómo se ve */
function FichaDePrueba({ p }) {
  const ref = String(p.id).padStart(6, '0');
  return (
    <div className="mt-4 rounded-2xl bg-white text-[#011c42] p-4 text-center">
      <div className="text-[12px] font-black uppercase tracking-wide opacity-60">{p.medio === 'ticket' ? 'Referencia para el OXXO' : 'CLABE para transferir'}</div>
      <div className="font-mono text-[22px] font-black tracking-wider mt-1">{p.medio === 'ticket' ? `9800 0000 ${ref} 0042` : `6461 8000 0000 ${ref}`}</div>
      <div className="text-[13px] font-bold opacity-70 mt-1">Monto exacto: {formato.dinero(p.total)}</div>
      <div className="text-[11px] font-bold opacity-50 mt-2">FICHA DE PRUEBA · NO SIRVE PARA PAGAR</div>
    </div>
  );
}
