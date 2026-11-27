import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ChevronRight, CreditCard, PiggyBank, Store } from 'lucide-react';
import { api, colorCinta, formato } from '../api';
import { Cabecera } from '../Marco';
import Avatar from '../Avatar';
import { Notificaciones } from './Avisos';
import { Boton, Cargando, Chip, ErrorCaja, Tarjeta, cx, useDatos } from '../ui';

// Mi familia (responsable de pago): cuánto debe, de quién, y la lista de sus alumnos.
const PAGO = { vencido: ['Vencido', 'peligro'], por_pagar: ['Por pagar', 'oro'], al_dia: ['Al día', 'ok'] };

export default function Familia() {
  const datos = useDatos(() => api.get('/app/familia'), []);
  const navegar = useNavigate();
  const d = datos.datos;
  if (datos.cargando && !d) return <Cargando />;
  if (datos.error) return <><Cabecera titulo="Mi familia" /><ErrorCaja error={datos.error} reintentar={datos.recargar} /></>;
  const debe = Number(d.total) > 0;
  const vencido = Number(d.vencido) > 0;

  return (
    <>
      <Cabecera titulo="Mi familia" />
      <div className="space-y-4">
        <Notificaciones compacta />
        <section className={cx('rounded-3xl p-5 border-2 anim-entrar', vencido ? 'bg-danger/12 border-danger' : debe ? 'bg-gold/10 border-gold/50' : 'bg-action/10 border-action/50')}>
          <div className="flex items-center gap-2 etiqueta">
            {vencido ? <AlertTriangle className="size-4 text-danger" /> : debe ? <CreditCard className="size-4 text-gold" /> : <CheckCircle2 className="size-4 text-action" />}
            {vencido ? `Pago vencido desde el ${formato.fecha(d.vencido_desde)}` : debe ? 'Por pagar' : 'Todo al día'}
          </div>
          <div className="text-[40px] font-black leading-none mt-2 tabular-nums">{formato.dinero(d.total)}</div>
          {debe && <p className="text-soft font-semibold mt-1 text-[14px]">{d.adeudos.length} concepto{d.adeudos.length > 1 ? 's' : ''} pendiente{d.adeudos.length > 1 ? 's' : ''}{vencido ? ' · mientras esté vencido, la tableta no deja pasar a clase' : ''}</p>}
          {!debe && d.proximo && <p className="text-soft font-semibold mt-1 text-[14px]">Siguiente: {d.proximo.concepto}{d.proximo.detalle ? ` · ${d.proximo.detalle}` : ''} el {formato.fecha(d.proximo.vence)} ({formato.dinero(d.proximo.precio)})</p>}
          {debe && (
            <div className="mt-4 space-y-3">
              {d.pago_en_linea !== 'apagado' && <Boton tono="oro" icono={CreditCard} onClick={() => navegar('/pagar')}>{d.adeudos.some((l) => l.en_linea) ? 'Ver mi pago en proceso' : 'Pagar en línea'}</Boton>}
              <div className="flex items-center gap-3 rounded-2xl bg-deep/60 px-4 py-3 text-[14px] font-bold"><Store className="size-5 text-soft shrink-0" />{d.pago_en_linea !== 'apagado' ? 'O paga' : 'Paga'} en recepción{d.sucursal ? ` de ${d.sucursal}` : ''}: efectivo o transferencia.</div>
            </div>
          )}
          <Link to="/pagos" className="mt-4 inline-flex items-center gap-1 font-black text-action">Ver detalle y recibos <ChevronRight className="size-5" /></Link>
        </section>

        {Number(d.saldo_favor) > 0 && (
          <Tarjeta className="flex items-center gap-3">
            <PiggyBank className="size-7 text-violet" />
            <div className="flex-1"><div className="font-black">Saldo a favor</div><div className="text-[13px] text-muted font-semibold">Se descuenta en tu siguiente pago</div></div>
            <div className="text-[20px] font-black">{formato.dinero(d.saldo_favor)}</div>
          </Tarjeta>
        )}

        <h2 className="text-[20px] font-black pt-2">Mis alumnos</h2>
        <ul className="space-y-3">
          {d.alumnos.map((a) => (
            <li key={a.id}>
              <Link to={`/a/${a.id}`} className="flex items-center gap-3 rounded-3xl bg-surface border-2 border-line p-3 anim-entrar active:scale-[.99] transition-transform">
                <div className="rounded-2xl bg-inset overflow-hidden shrink-0"><Avatar equipo={a.equipo} apariencia={a.apariencia} cinta={a.grado?.color_cinta} fondo={false} className="size-20" /></div>
                <div className="flex-1 min-w-0">
                  <div className="text-[18px] font-black truncate">{a.nombre} {a.apellido_paterno}</div>
                  {a.grado && <div className="flex items-center gap-2 text-[13px] font-bold text-soft mt-0.5"><span className="h-2.5 w-7 rounded-full ring-1 ring-black/30" style={{ background: colorCinta(a.grado.color_cinta) }} />{a.grado.disciplina} · {a.grado.nombre}</div>}
                  <div className="flex items-center gap-2 mt-2"><Chip tono={PAGO[a.estado_pago][1]}>{PAGO[a.estado_pago][0]}</Chip><span className="text-[12px] text-muted font-bold">{a.asistencia_mes} clase{a.asistencia_mes === 1 ? '' : 's'} este mes</span></div>
                </div>
                <ChevronRight className="size-6 text-muted" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
