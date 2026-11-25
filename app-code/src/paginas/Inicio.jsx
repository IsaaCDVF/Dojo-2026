import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { AlertTriangle, CalendarClock, Check, Clock, QrCode, X } from 'lucide-react';
import { api, colorCinta, formato } from '../api';
import { Cabecera } from '../Marco';
import Avatar from '../Avatar';
import { Barra, Boton, Cargando, Chip, ErrorCaja, Hoja, Tarjeta, cx, useDatos } from '../ui';

// Inicio del alumno: saludo con su avatar, credencial QR, rumbo a la siguiente cinta y su semana.
export default function Inicio() {
  const { id } = useParams();
  const datos = useDatos(() => api.get(`/app/alumnos/${id}/inicio`), [id]);
  const [qr, setQr] = useState(false);
  const d = datos.datos;
  if (datos.cargando && !d) return <Cargando />;
  if (datos.error) return <><Cabecera titulo="Dojo OS" /><ErrorCaja error={datos.error} reintentar={datos.recargar} /></>;

  const hoy = new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'short' });
  const enCurso = d.clases_hoy.find((c) => c.estado !== 'terminada');
  const r = d.rumbo;
  return (
    <>
      <Cabecera titulo="Dojo OS" racha={d.racha} alumnoId={id} />
      <div className="space-y-4">
        <Tarjeta className="!p-0 overflow-hidden bg-gradient-to-br from-surface to-[#13306a]">
          <div className="flex items-center">
            <div className="flex-1 p-5 pr-0">
              <div className="etiqueta">{hoy}</div>
              <h2 className="text-[28px] font-black leading-tight mt-1">¡Hola, {d.alumno.nombre}!</h2>
              <p className="text-soft font-semibold mt-1.5 text-[15px]">
                {enCurso ? <>Hoy tienes <b className="text-white">{enCurso.disciplina}</b> a las <b className="text-white">{enCurso.hora_inicio}</b>{enCurso.registrada ? ' · ya registraste tu llegada' : ''}.</>
                  : d.proxima_clase ? <>Tu próxima clase es <b className="text-white">{d.proxima_clase.dia}</b> a las <b className="text-white">{d.proxima_clase.hora}</b>.</>
                    : 'Todavía no tienes clases asignadas.'}
              </p>
            </div>
            <Avatar equipo={d.equipo} cinta={d.grado?.color_cinta} fondo={false} animado saludo="¡Osu!" className="w-40 h-40 shrink-0" />
          </div>
        </Tarjeta>

        {d.pago.estado === 'vencido' && (
          <div className="rounded-3xl border-2 border-danger bg-danger/10 p-4 flex gap-3 anim-entrar">
            <AlertTriangle className="size-6 text-danger shrink-0" />
            <p className="font-bold text-[15px]">Hay un pago vencido ({d.pago.concepto}). La tableta no te dejará pasar a clase hasta que se pague en recepción.</p>
          </div>
        )}
        {d.pago.estado === 'por_pagar' && (
          <div className="rounded-3xl border-2 border-gold/50 bg-gold/10 p-4 flex gap-3 anim-entrar">
            <CalendarClock className="size-6 text-gold shrink-0" />
            <p className="font-bold text-[15px]">Tu {d.pago.concepto?.toLowerCase()} vence el {formato.fecha(d.pago.vence)}.</p>
          </div>
        )}

        <Boton icono={QrCode} onClick={() => setQr(true)} className="!min-h-16 text-[17px]">Mostrar mi QR</Boton>

        {r?.grado_objetivo && (
          <Tarjeta>
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-[19px] font-black">Rumbo a cinta {r.grado_objetivo.color_cinta?.toLowerCase() || r.grado_objetivo.nombre}</h3>
              {r.examen && <Chip tono="oro">{formato.fecha(r.examen.fecha)}</Chip>}
            </div>
            <div className="mt-4 space-y-4">
              <div>
                <div className="flex justify-between text-[14px] font-bold mb-1.5"><span className="text-soft">Meses en el grado</span><span>{Math.min(r.meses_en_grado, r.meses_requeridos)} de {r.meses_requeridos}</span></div>
                <Barra valor={r.meses_en_grado} max={r.meses_requeridos} />
              </div>
              <div>
                <div className="flex justify-between text-[14px] font-bold mb-1.5"><span className="text-soft">Asistencia</span><span>{r.asistencia} % · mín. {r.asistencia_requerida} %</span></div>
                <Barra valor={r.asistencia} tono={r.cumple_asistencia ? 'bg-action' : 'bg-gold'} />
              </div>
            </div>
            <Link to={`/a/${id}/examen`} className="block mt-5"><Boton tono="contorno" type="button">{r.examen?.solicitud ? 'Ver mi examen' : 'Quiero presentar'}</Boton></Link>
          </Tarjeta>
        )}

        <Tarjeta>
          <div className="flex items-center justify-between">
            <h3 className="text-[19px] font-black">Esta semana</h3>
            <span className="text-[14px] font-bold text-soft">{d.racha ? `${d.racha} clase${d.racha > 1 ? 's' : ''} seguida${d.racha > 1 ? 's' : ''}` : 'Empieza tu racha'}</span>
          </div>
          <div className="grid grid-cols-7 gap-1 mt-4">
            {d.semana.map((s) => <Dia key={s.fecha} s={s} />)}
          </div>
          <p className="text-[12px] text-muted font-semibold mt-3">Verde: a tiempo · Oro: con retardo · Rojo: faltaste</p>
        </Tarjeta>

        {d.clases_hoy.length > 0 && (
          <Tarjeta>
            <h3 className="text-[19px] font-black mb-3">Clases de hoy</h3>
            <ul className="space-y-2">
              {d.clases_hoy.map((c) => (
                <li key={c.horario_id} className="flex items-center gap-3 rounded-2xl bg-inset px-4 py-3">
                  <Clock className="size-5 text-action" />
                  <div className="flex-1 min-w-0"><div className="font-black">{c.hora_inicio} · {c.disciplina}</div><div className="text-[13px] text-muted font-semibold truncate">{c.nivel || 'General'} · {c.instructor}</div></div>
                  {c.registrada ? <Chip tono="ok">Llegaste {c.registrada}</Chip> : c.estado === 'terminada' ? <Chip>Terminó</Chip> : c.estado === 'en_curso' ? <Chip tono="accion">En curso</Chip> : null}
                </li>
              ))}
            </ul>
          </Tarjeta>
        )}
      </div>
      <Credencial abierta={qr} onCerrar={() => setQr(false)} a={d.alumno} grado={d.grado} />
    </>
  );
}

const DIA = {
  asistio: 'bg-action text-on-action', retardo: 'bg-gold text-[#2b1d00]', falta: 'bg-danger/80 text-white',
  hoy: 'border-2 border-dashed border-action text-action', proxima: 'bg-inset text-soft', sin_clase: 'bg-deep text-muted/60',
};
function Dia({ s }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className={cx('grid place-items-center size-10 rounded-full text-[13px] font-black', DIA[s.estado])}>
        {s.estado === 'asistio' || s.estado === 'retardo' ? <Check className="size-5" strokeWidth={3.4} /> : s.estado === 'falta' ? <X className="size-5" strokeWidth={3.4} /> : s.numero}
      </span>
      <span className={cx('text-[12px] font-bold', s.hoy ? 'text-action' : 'text-muted')}>{s.dia}</span>
    </div>
  );
}

/** QR grande para la tableta del dojo (mismo código que la credencial impresa) */
function Credencial({ abierta, onCerrar, a, grado }) {
  const [src, setSrc] = useState('');
  useEffect(() => { if (abierta) QRCode.toDataURL(a.codigo_qr, { margin: 1, width: 520, color: { dark: '#011c42', light: '#ffffff' } }).then(setSrc); }, [abierta, a.codigo_qr]);
  return (
    <Hoja abierta={abierta} onCerrar={onCerrar} titulo="Mi credencial" clara>
      <div className="text-center">
        <div className="rounded-3xl border-4 border-[#011c42] p-3 inline-block">{src ? <img src={src} alt="Código QR de asistencia" className="w-64 h-64 mx-auto" /> : <div className="w-64 h-64" />}</div>
        <div className="text-[24px] font-black mt-4">{a.nombre} {a.apellido_paterno}</div>
        <div className="font-mono font-bold text-[15px] opacity-70">{a.matricula} · {a.sucursal}</div>
        {grado && <div className="inline-flex items-center gap-2 mt-2 font-bold"><span className="inline-block h-3 w-9 rounded-full ring-1 ring-black/20" style={{ background: colorCinta(grado.color_cinta) }} />{grado.disciplina} · {grado.nombre}</div>}
        <p className="text-[13px] font-semibold opacity-60 mt-4">Acércalo a la cámara de la tableta del dojo. Sube el brillo de tu pantalla si no lo lee.</p>
      </div>
    </Hoja>
  );
}
