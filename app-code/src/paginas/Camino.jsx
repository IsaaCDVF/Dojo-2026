import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Check, Lock, Star, Trophy } from 'lucide-react';
import { api, colorCinta, formato } from '../api';
import { Cabecera } from '../Marco';
import Avatar from '../Avatar';
import { Cargando, ErrorCaja, Tarjeta, cx, useDatos } from '../ui';

// Mi camino: todas las cintas de la disciplina como un sendero. Las pasadas con palomita,
// la actual con estrella ("Estás aquí") y la siguiente con su fecha de examen.
export default function Camino() {
  const { id } = useParams();
  const datos = useDatos(() => api.get(`/app/alumnos/${id}/camino`), [id]);
  const [disc, setDisc] = useState(0);
  const actualRef = useRef(null);
  const d = datos.datos;
  useEffect(() => { actualRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, [d, disc]);
  if (datos.cargando && !d) return <Cargando />;
  if (datos.error) return <><Cabecera titulo="Mi camino" alumnoId={id} /><ErrorCaja error={datos.error} reintentar={datos.recargar} /></>;
  if (!d.disciplinas.length) return <><Cabecera titulo="Mi camino" alumnoId={id} /><Tarjeta className="text-center"><p className="font-bold">Todavía no tienes grado. Se asigna al inscribirte a una clase.</p></Tarjeta></>;

  const x = d.disciplinas[Math.min(disc, d.disciplinas.length - 1)];
  const actual = x.grados.find((g) => g.estado === 'actual');
  return (
    <>
      <Cabecera titulo="Mi camino" alumnoId={id} />
      {d.disciplinas.length > 1 && (
        <div className="flex gap-2 mb-4">
          {d.disciplinas.map((y, i) => (
            <button key={y.disciplina_id} onClick={() => setDisc(i)} className={cx('flex-1 h-12 rounded-2xl border-2 font-black cursor-pointer', i === disc ? 'border-action text-action bg-action/10' : 'border-line text-soft bg-surface')}>{y.disciplina}</button>
          ))}
        </div>
      )}
      <div className="rounded-3xl p-5 bg-gradient-to-r from-violet to-pink anim-entrar flex items-center gap-4">
        <div className="flex-1">
          <div className="etiqueta !text-white/80">Grado actual · {x.disciplina}</div>
          <div className="text-[22px] font-black leading-tight mt-1">{actual?.nombre}{actual?.color_cinta ? ` · Cinta ${actual.color_cinta.toLowerCase()}` : ''}</div>
        </div>
        <div className="text-right text-[13px] font-extrabold leading-tight">{x.examen ? <>Siguiente examen<br /><span className="text-[18px]">{formato.fecha(x.examen.fecha)}</span></> : 'Sin fecha de examen'}</div>
      </div>

      <ol className="relative mt-10 mb-6 space-y-10 overflow-x-clip py-2">
        {x.grados.map((g, i) => {
          const off = Math.round(Math.sin(i * 0.95) * 56);
          const esActual = g.estado === 'actual';
          return (
            <li key={g.id} ref={esActual ? actualRef : null} className="relative flex items-center justify-center" style={{ transform: `translateX(${off}px)` }}>
              {esActual && <span className="absolute -top-9 rounded-xl bg-white text-canvas px-3 py-1 text-[13px] font-black shadow anim-rebote">Estás aquí</span>}
              <Nodo g={g} examen={g.estado === 'siguiente' ? x.examen : null} avatar={esActual && <Avatar equipo={d.equipo} cinta={g.color_cinta} fondo={false} className="size-20" />} />
            </li>
          );
        })}
      </ol>
      <Tarjeta>
        <h3 className="text-[17px] font-black">¿Cómo subo de cinta?</h3>
        <p className="text-soft font-semibold text-[14px] mt-1">Cumple {x.rumbo.meses_requeridos} meses en tu grado y al menos {x.rumbo.asistencia_requerida} % de asistencia, solicita el examen y tu sensei lo autoriza. Cada cinta nueva te da una insignia y desbloquea cosas para tu avatar.</p>
      </Tarjeta>
    </>
  );
}

function Nodo({ g, examen, avatar }) {
  const base = 'relieve grid place-items-center rounded-full';
  const etiqueta = (
    <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 whitespace-nowrap">
      <div className={cx('font-black text-[15px]', g.estado === 'bloqueado' ? 'text-muted' : 'text-text')}>{g.nombre}</div>
      {g.estado === 'obtenido' && g.fecha && <div className="text-[12px] font-bold text-muted">{formato.fecha(g.fecha)}</div>}
      {g.estado === 'siguiente' && examen && <div className="text-[12px] font-black text-gold">Examen {formato.corta(examen.fecha)}</div>}
      {g.estado === 'siguiente' && !examen && <div className="text-[12px] font-bold text-muted">Siguiente</div>}
    </div>
  );
  if (g.estado === 'actual') return (
    <div className="relative">
      <div className={cx(base, 'size-24 bg-gold [--sombra:var(--gold-dark)] ring-[6px] ring-action/70 anim-latido')}><Star className="size-11 text-[#011c42] fill-[#011c42]" /></div>
      <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-2.5 w-12 rounded-full ring-1 ring-black/30" style={{ background: colorCinta(g.color_cinta) }} />
      {etiqueta}
      <div className="absolute right-full top-1/2 -translate-y-1/2 mr-2">{avatar}</div>
    </div>
  );
  return (
    <div className="relative">
      {g.estado === 'obtenido' && <div className={cx(base, 'size-[72px] bg-[#f3f1ea] [--sombra:#bdb8a8]')}><Check className="size-9 text-[#011c42]" strokeWidth={3.4} /></div>}
      {g.estado === 'siguiente' && <div className={cx(base, 'size-[76px] bg-[#22b573] [--sombra:#16794c]')}><Trophy className="size-9 text-[#062b1b]" strokeWidth={2.6} /></div>}
      {g.estado === 'bloqueado' && <div className={cx(base, 'size-[68px] bg-inset [--sombra:#06182f]')}><Lock className="size-7 text-muted" /></div>}
      <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-2 w-10 rounded-full ring-1 ring-black/30" style={{ background: colorCinta(g.color_cinta), opacity: g.estado === 'bloqueado' ? .35 : 1 }} />
      {etiqueta}
    </div>
  );
}
