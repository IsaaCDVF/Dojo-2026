import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, PartyPopper } from 'lucide-react';
import { api } from '../api';
import Avatar, { PELOS, PIELES } from '../Avatar';
import { COLORES, COMPLEXIONES, PEINADOS, VELLOS } from '../avatar/opciones';
import { disciplinaDe } from '../avatar/esqueleto';
import { Boton, Cargando, Confeti, ErrorCaja, cx, useDatos } from '../ui';

// Primera vez en la app: el alumno arma su avatar para que se parezca a él (piel, cabello, color, vello y complexión).
// Se puede dejar para después; lo puede cambiar cuando quiera en Mi avatar → Tú.

export const clavePosponer = (id) => `dojo-avatar-despues-${id}`;

export default function CrearAvatar() {
  const { id } = useParams();
  const navegar = useNavigate();
  const datos = useDatos(() => api.get(`/app/alumnos/${id}/avatar`), [id]);
  const [ap, setAp] = useState(null);
  const [paso, setPaso] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const [mov, setMov] = useState(null);
  const d = datos.datos;
  useEffect(() => { if (d && !ap) setAp(d.apariencia); }, [d, ap]);
  if (datos.cargando && !d) return <Cargando className="h-full bg-canvas" />;
  if (datos.error) return <div className="p-5"><ErrorCaja error={datos.error} reintentar={datos.recargar} /></div>;
  if (!ap) return null;

  const nino = ap.etapa === 'nino';
  const pasos = ['piel', 'peinado', 'color', ...(nino ? [] : ['vello']), 'complexion', 'listo'];
  const actual = pasos[paso];
  const poner = (k, v) => { setAp((x) => ({ ...x, [k]: v })); setMov({ id: disciplinaDe(ap.disciplina).movimientos[0].id, n: Date.now() }); };
  const sinCabeza = d.equipo.filter((e) => e.tipo !== 'cabeza');
  const titulos = {
    piel: '¿Cuál es tu tono de piel?', peinado: 'Elige tu peinado', color: '¿De qué color es tu cabello?',
    vello: '¿Llevas barba o bigote?', complexion: '¿Cómo es tu complexión?', listo: `¡Así eres tú, ${d.alumno.nombre}!`,
  };

  async function terminar() {
    setGuardando(true); setError(null);
    try {
      await api.put(`/app/alumnos/${id}/avatar`, { apariencia: { piel: ap.piel, peinado: ap.peinado, color_pelo: ap.color_pelo, vello: ap.vello, complexion: ap.complexion } });
      navegar(`/a/${id}`, { replace: true });
    } catch (e) { setError(e); } finally { setGuardando(false); }
  }
  const despues = () => { try { localStorage.setItem(clavePosponer(id), '1'); } catch { /* nada */ } navegar(`/a/${id}`, { replace: true }); };

  return (
    <div className="min-h-full bg-canvas">
      <div className="mx-auto max-w-md px-5 pt-5 pb-10 flex flex-col min-h-full">
        <div className="flex items-center gap-3">
          {paso > 0 && actual !== 'listo'
            ? <button onClick={() => setPaso(paso - 1)} aria-label="Atrás" className="grid place-items-center size-10 rounded-full bg-surface cursor-pointer"><ArrowLeft className="size-5" /></button>
            : <span className="size-10" />}
          <div className="flex-1 flex gap-1.5">
            {pasos.map((p, i) => <span key={p} className={cx('h-2 flex-1 rounded-full transition-colors', i <= paso ? 'bg-action' : 'bg-inset')} />)}
          </div>
          {actual !== 'listo' ? <button onClick={despues} className="text-[13px] font-bold text-muted cursor-pointer">Después</button> : <span className="w-14" />}
        </div>

        {paso === 0 && <p className="text-center text-soft font-bold mt-5">Bienvenido a tu dojo. Antes de empezar, arma tu avatar para que se parezca a ti.</p>}
        <div className={cx('mx-auto rounded-[32px] overflow-hidden border-2 border-line mt-4', actual === 'listo' ? 'size-72' : 'size-52')}>
          <Avatar equipo={d.equipo} apariencia={ap} cinta={d.grado?.color_cinta} className="size-full" animado interactivo accion={mov} saludo={actual === 'listo' ? '¡Osu!' : undefined} />
        </div>
        <h1 className="text-[24px] font-black text-center mt-5">{titulos[actual]}</h1>

        <div className="mt-5 flex-1">
          {actual === 'piel' && (
            <div className="flex flex-wrap justify-center gap-3">
              {Object.entries(PIELES).map(([k, c]) => (
                <button key={k} onClick={() => poner('piel', k)} aria-label={`Tono ${k}`} aria-pressed={ap.piel === k}
                  className={cx('size-16 rounded-full border-4 cursor-pointer relieve', ap.piel === k ? 'border-action' : 'border-transparent')} style={{ background: c }} />
              ))}
            </div>
          )}
          {actual === 'peinado' && (
            <Rejilla>
              {PEINADOS.map(([k, n]) => (
                <Mosaico key={k} activo={ap.peinado === k} onClick={() => poner('peinado', k)} nombre={n}>
                  <Avatar apariencia={{ ...ap, peinado: k }} equipo={sinCabeza} cinta={d.grado?.color_cinta} fondo={false} encuadre="cabeza" className="w-full aspect-square" />
                </Mosaico>
              ))}
            </Rejilla>
          )}
          {actual === 'color' && (
            <div className="flex flex-wrap justify-center gap-3">
              {COLORES.map(([k, n]) => (
                <button key={k} onClick={() => poner('color_pelo', k)} aria-label={n} aria-pressed={ap.color_pelo === k}
                  className="text-center cursor-pointer">
                  <span className={cx('block size-14 rounded-full border-4 relieve', ap.color_pelo === k ? 'border-action' : 'border-transparent')} style={{ background: PELOS[k] }} />
                  <span className="text-[11px] font-bold text-muted">{n}</span>
                </button>
              ))}
            </div>
          )}
          {actual === 'vello' && (
            <Rejilla>
              {VELLOS.map(([k, n]) => (
                <Mosaico key={k} activo={ap.vello === k} onClick={() => poner('vello', k)} nombre={n}>
                  <Avatar apariencia={{ ...ap, vello: k }} equipo={sinCabeza} cinta={d.grado?.color_cinta} fondo={false} encuadre="cabeza" className="w-full aspect-square" />
                </Mosaico>
              ))}
            </Rejilla>
          )}
          {actual === 'complexion' && (
            <div className="grid grid-cols-3 gap-3">
              {COMPLEXIONES.map(([k, n]) => (
                <Mosaico key={k} activo={ap.complexion === k} onClick={() => poner('complexion', k)} nombre={n}>
                  <Avatar apariencia={{ ...ap, complexion: k }} equipo={d.equipo} cinta={d.grado?.color_cinta} fondo={false} pose="firmes" className="w-full aspect-square" />
                </Mosaico>
              ))}
            </div>
          )}
          {actual === 'listo' && (
            <div className="text-center">
              <Confeti />
              <PartyPopper className="size-8 text-gold mx-auto" />
              <p className="text-soft font-bold mt-2">Tócalo para verlo entrenar. Al subir de cinta vas a ganar bandas, doboks y fondos para él.</p>
              <ErrorCaja error={error} />
            </div>
          )}
        </div>

        <div className="mt-6">
          {actual === 'listo'
            ? <Boton icono={Check} cargando={guardando} onClick={terminar}>Entrar a mi dojo</Boton>
            : <Boton icono={ArrowRight} onClick={() => setPaso(paso + 1)}>Siguiente</Boton>}
        </div>
      </div>
    </div>
  );
}

function Rejilla({ children }) { return <div className="grid grid-cols-4 gap-2">{children}</div>; }
function Mosaico({ activo, onClick, nombre, children }) {
  return (
    <button onClick={onClick} aria-pressed={activo}
      className={cx('rounded-2xl border-2 p-1 text-center cursor-pointer', activo ? 'border-action bg-action/10' : 'border-line bg-surface')}>
      <div className="rounded-xl overflow-hidden bg-inset">{children}</div>
      <div className="text-[11px] font-extrabold mt-1">{nombre}</div>
    </button>
  );
}
