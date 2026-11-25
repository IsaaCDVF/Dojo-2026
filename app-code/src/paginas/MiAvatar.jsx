import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { api } from '../api';
import { Cabecera } from '../Marco';
import Avatar, { Insignia } from '../Avatar';
import { Cargando, ErrorCaja, Tarjeta, cx, useDatos } from '../ui';

// Mi avatar: lo que se desbloquea al subir de cinta. Un accesorio de cada tipo; la cinta es la de su grado.
const TIPOS = [
  { t: 'cabeza', n: 'Banda', opcional: true }, { t: 'torso', n: 'Dobok' }, { t: 'mano', n: 'Guantes', opcional: true },
  { t: 'pies', n: 'Pies', opcional: true }, { t: 'fondo', n: 'Fondo' },
];

export default function MiAvatar() {
  const { id } = useParams();
  const datos = useDatos(() => api.get(`/app/alumnos/${id}/avatar`), [id]);
  const [tipo, setTipo] = useState('cabeza');
  const [aviso, setAviso] = useState(null);
  const [error, setError] = useState(null);
  const d = datos.datos;
  if (datos.cargando && !d) return <Cargando />;
  if (datos.error) return <><Cabecera titulo="Mi avatar" alumnoId={id} /><ErrorCaja error={datos.error} reintentar={datos.recargar} /></>;

  const equipo = d.equipo;
  const puesto = (t) => equipo.find((e) => e.tipo === t);
  const cat = TIPOS.find((x) => x.t === tipo);
  const items = d.accesorios.filter((a) => a.tipo === tipo);
  const ganadas = d.insignias.filter((i) => i.obtenida).length;

  async function poner(a) {
    if (a && !a.desbloqueado) { setAviso(`${a.nombre}: se desbloquea al llegar a ${a.grado}${a.color_cinta ? ` (cinta ${a.color_cinta.toLowerCase()})` : ''}`); return; }
    setAviso(null); setError(null);
    const nuevo = [...equipo.filter((e) => e.tipo !== tipo), ...(a ? [{ id: a.id, tipo: a.tipo, imagen: a.imagen }] : [])];
    const antes = equipo;
    datos.setDatos((x) => ({ ...x, equipo: nuevo }));
    try { await api.put(`/app/alumnos/${id}/avatar`, { equipo: nuevo.map((e) => e.id) }); }
    catch (e) { datos.setDatos((x) => ({ ...x, equipo: antes })); setError(e); }
  }

  return (
    <>
      <Cabecera titulo="Mi avatar" alumnoId={id} />
      <div className="mx-auto w-full max-w-80 aspect-square rounded-[32px] overflow-hidden border-2 border-line anim-entrar">
        <Avatar equipo={equipo} cinta={d.grado?.color_cinta} className="size-full" animado />
      </div>
      <div className="flex gap-2 overflow-x-auto mt-4 pb-1 [scrollbar-width:none]">
        {TIPOS.map((x) => (
          <button key={x.t} onClick={() => { setTipo(x.t); setAviso(null); }}
            className={cx('shrink-0 h-11 px-5 rounded-full border-2 font-black cursor-pointer', tipo === x.t ? 'bg-action text-on-action border-action' : 'border-line text-soft bg-surface')}>{x.n}</button>
        ))}
      </div>
      {aviso && <p className="mt-3 rounded-2xl bg-gold/12 border-2 border-gold/40 text-gold font-bold px-4 py-2.5 text-[14px] anim-aparecer">{aviso}</p>}
      <div className="mt-3"><ErrorCaja error={error} /></div>
      <div className="grid grid-cols-3 gap-3 mt-3">
        {items.map((a) => {
          const on = puesto(tipo)?.id === a.id;
          const vista = [...equipo.filter((e) => e.tipo !== tipo), { tipo: a.tipo, imagen: a.imagen }];
          return (
            <button key={a.id} onClick={() => poner(a)} aria-pressed={on}
              className={cx('relative rounded-2xl border-2 p-1.5 text-center cursor-pointer transition-colors', on ? 'border-action bg-action/10' : 'border-line bg-surface', !a.desbloqueado && 'opacity-60')}>
              <div className="rounded-xl overflow-hidden"><Avatar equipo={vista} cinta={d.grado?.color_cinta} fondo={tipo === 'fondo'} className={cx('w-full aspect-square', !a.desbloqueado && 'grayscale')} /></div>
              <div className="text-[12px] font-extrabold mt-1 leading-tight">{a.nombre}</div>
              {!a.desbloqueado && <div className="absolute inset-0 grid place-items-center"><span className="grid place-items-center size-10 rounded-full bg-deep/90"><Lock className="size-5 text-muted" /></span></div>}
              {!a.desbloqueado && <div className="text-[11px] font-bold text-muted">{a.grado}</div>}
            </button>
          );
        })}
        {cat.opcional && (
          <button onClick={() => poner(null)} aria-pressed={!puesto(tipo)}
            className={cx('rounded-2xl border-2 border-dashed p-3 grid place-items-center text-[13px] font-extrabold cursor-pointer', !puesto(tipo) ? 'border-action text-action' : 'border-line text-muted')}>
            Sin {cat.n.toLowerCase()}
          </button>
        )}
      </div>
      <Tarjeta className="mt-5">
        <div className="flex items-center justify-between"><h3 className="text-[19px] font-black">Mis insignias</h3><span className="font-bold text-soft">{ganadas} de {d.insignias.length}</span></div>
        <div className="grid grid-cols-4 gap-3 mt-4">
          {d.insignias.map((i) => (
            <div key={i.id} className="text-center" title={i.nombre}>
              <Insignia color={i.color_cinta} obtenida={i.obtenida} className="size-16 mx-auto" />
              <div className={cx('text-[11px] font-bold mt-1 leading-tight', i.obtenida ? 'text-soft' : 'text-muted/70')}>{i.grado}</div>
            </div>
          ))}
        </div>
      </Tarjeta>
    </>
  );
}
