import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { CalendarDays, Check, Clock, MapPin, PartyPopper, Send, X } from 'lucide-react';
import { api, colorCinta, formato } from '../api';
import { Cabecera } from '../Marco';
import Avatar from '../Avatar';
import { Boton, Cargando, Chip, Confeti, ErrorCaja, Hoja, Tarjeta, cx, useDatos } from '../ui';

// Solicitar examen: fechas programadas de su sucursal, si cumple meses y asistencia, y el estado de su solicitud.
const ESTADO = {
  enviada: ['Enviada · espera a tu sensei', 'info'], fuera_de_plazo: ['Fuera de plazo · tu sensei decide', 'oro'],
  por_autorizar: ['Por autorizar', 'info'], autorizada: ['Autorizada', 'ok'], no_autorizada: ['No autorizada', 'peligro'],
  cancelada: ['Cancelada', 'info'], aprobada: ['¡Aprobada!', 'ok'], reprobada: ['No aprobada', 'peligro'],
};

export default function Examen() {
  const { id } = useParams();
  const datos = useDatos(() => api.get(`/app/alumnos/${id}/examenes`), [id]);
  const [enviando, setEnviando] = useState(null);
  const [error, setError] = useState(null);
  const [listo, setListo] = useState(null);
  const d = datos.datos;
  if (datos.cargando && !d) return <Cargando />;
  if (datos.error) return <><Cabecera titulo="Examen" alumnoId={id} /><ErrorCaja error={datos.error} reintentar={datos.recargar} /></>;

  async function solicitar(e) {
    setEnviando(e.id); setError(null);
    try { const r = await api.post(`/app/alumnos/${id}/examenes/${e.id}`, {}); setListo(r); datos.recargar(); }
    catch (x) { setError(x); } finally { setEnviando(null); }
  }

  return (
    <>
      <Cabecera titulo="Examen" alumnoId={id} />
      {!d.fechas.length && (
        <Tarjeta className="text-center">
          <CalendarDays className="size-10 mx-auto text-muted" />
          <h2 className="text-[19px] font-black mt-2">Aún no hay fechas de examen</h2>
          <p className="text-soft font-semibold mt-1">Cuando tu dojo programe uno aparecerá aquí para que lo solicites.</p>
        </Tarjeta>
      )}
      <div className="space-y-4">
        {d.fechas.map((e) => {
          const c = e.criterios; const s = e.solicitud;
          return (
            <Tarjeta key={e.id}>
              <div className="flex items-start gap-3">
                <div className="grid place-items-center w-16 rounded-2xl bg-gold/15 text-gold py-2 shrink-0">
                  <span className="text-[26px] font-black leading-none">{new Date(e.fecha.slice(0, 10) + 'T00:00').getDate()}</span>
                  <span className="text-[12px] font-black uppercase">{new Date(e.fecha.slice(0, 10) + 'T00:00').toLocaleDateString('es-MX', { month: 'short' }).replace('.', '')}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-[19px] font-black leading-tight">{e.disciplina}{c?.grado_objetivo ? ` · a ${c.grado_objetivo.nombre}` : ''}</h3>
                  <p className="text-soft font-semibold text-[14px] mt-0.5 flex items-center gap-1"><MapPin className="size-4" />{e.sede || e.sucursal} · {formato.hora(e.fecha) || ''}</p>
                  {c?.grado_objetivo && <span className="inline-block mt-2 h-2.5 w-14 rounded-full ring-1 ring-black/30" style={{ background: colorCinta(c.grado_objetivo.color_cinta) }} />}
                </div>
              </div>
              {e.no_disponible && <p className="mt-4 rounded-2xl bg-inset px-4 py-3 text-soft font-bold text-[14px]">{e.no_disponible}</p>}
              {c && (
                <ul className="mt-4 space-y-2">
                  <Requisito ok={c.cumple_meses} texto={c.cumple_meses ? `${c.meses_en_grado} meses en tu grado (mínimo ${c.meses_requeridos})` : `${c.meses_en_grado} de ${c.meses_requeridos} meses en tu grado`} />
                  <Requisito ok={c.cumple_asistencia} texto={`${c.asistencia} % de asistencia (mínimo ${c.asistencia_requerida} %)`} />
                  <Requisito ok={c.en_plazo} texto={c.en_plazo ? `Solicítalo antes del ${formato.fecha(c.fecha_limite)}` : `El plazo cerró el ${formato.fecha(c.fecha_limite)}`} />
                </ul>
              )}
              {s ? (
                <div className="mt-4 flex items-center justify-between gap-2 rounded-2xl bg-inset px-4 py-3">
                  <span className="font-bold text-[14px]">Tu solicitud</span>
                  <Chip tono={ESTADO[s.estado]?.[1]}>{ESTADO[s.estado]?.[0] || s.estado}</Chip>
                </div>
              ) : c && (
                <>
                  {!c.cumple && <p className="mt-4 text-[13px] text-gold font-bold">Puedes solicitarlo aunque te falte algo: tu sensei decide si te autoriza.</p>}
                  <Boton className="mt-4" tono={c.cumple && c.en_plazo ? 'accion' : 'contorno'} icono={Send} cargando={enviando === e.id} onClick={() => solicitar(e)}>Solicitar examen</Boton>
                </>
              )}
              {s?.estado === 'autorizada' && !Number(s.pagado) && d.precio && <p className="mt-3 text-[14px] font-bold text-gold">Paga el examen en recepción: {formato.dinero(d.precio)}.</p>}
              {s?.observaciones && <p className="mt-3 text-[14px] text-soft font-semibold">“{s.observaciones}”</p>}
            </Tarjeta>
          );
        })}
        <ErrorCaja error={error} />
        {d.precio && d.fechas.length > 0 && <p className="text-center text-[13px] text-muted font-semibold">Costo del examen: {formato.dinero(d.precio)} · se paga después de que tu sensei lo autorice.</p>}

        {d.historial.length > 0 && (
          <Tarjeta>
            <h3 className="text-[19px] font-black mb-3">Mis solicitudes</h3>
            <ul className="divide-y-2 divide-line">
              {d.historial.map((h) => (
                <li key={h.id} className="flex items-center gap-3 py-3">
                  <span className="h-3 w-8 rounded-full ring-1 ring-black/30 shrink-0" style={{ background: colorCinta(h.color_cinta) }} />
                  <div className="flex-1 min-w-0"><div className="font-black truncate">{h.grado_objetivo}</div><div className="text-[13px] text-muted font-semibold">{h.disciplina} · {formato.fecha(h.fecha)}</div></div>
                  <Chip tono={ESTADO[h.estado]?.[1]}>{ESTADO[h.estado]?.[0].split(' · ')[0] || h.estado}</Chip>
                </li>
              ))}
            </ul>
          </Tarjeta>
        )}
      </div>

      {listo && <Confeti />}
      <Hoja abierta={!!listo} onCerrar={() => setListo(null)} titulo="">
        {listo && (
          <div className="text-center pb-2">
            <Avatar equipo={d.equipo} apariencia={d.apariencia} cinta={listo.grado_objetivo?.color_cinta} fondo={false} animado interactivo saludo="¡Osu!" className="size-44 mx-auto" />
            <PartyPopper className="size-9 text-gold mx-auto mt-1" />
            <h2 className="text-[26px] font-black mt-2">¡Solicitud enviada!</h2>
            <p className="text-soft font-semibold mt-2">
              {listo.instructor ? <><b className="text-text">{listo.instructor}</b> la revisará</> : 'Tu sensei la revisará'} para tu examen del {formato.fechaLarga(listo.examen?.fecha)}.
            </p>
            {listo.avisos?.length > 0 && <ul className="mt-3 space-y-1 text-[14px] text-gold font-bold">{listo.avisos.map((a) => <li key={a}>{a}</li>)}</ul>}
            <Boton className="mt-6" onClick={() => setListo(null)}>¡Osu!</Boton>
          </div>
        )}
      </Hoja>
    </>
  );
}

function Requisito({ ok, texto }) {
  return (
    <li className="flex items-center gap-3 font-bold text-[15px]">
      <span className={cx('grid place-items-center size-7 rounded-full shrink-0', ok ? 'bg-action text-on-action' : 'bg-gold/20 text-gold')}>{ok ? <Check className="size-4" strokeWidth={3.4} /> : <Clock className="size-4" strokeWidth={3} />}</span>
      <span className={ok ? 'text-text' : 'text-soft'}>{texto}</span>
    </li>
  );
}
