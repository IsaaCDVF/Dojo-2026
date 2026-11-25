import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Check, Eye, Lock, Sparkles, Undo2 } from 'lucide-react';
import { api } from '../api';
import { Cabecera } from '../Marco';
import Avatar, { Insignia, PELOS, PIELES } from '../Avatar';
import { disciplinaDe } from '../avatar/esqueleto';
import { Cargando, ErrorCaja, Tarjeta, cx, useDatos } from '../ui';

// Mi avatar: se parece a ti (apariencia) y se viste con lo que ganas al subir de grado.
// Lo bloqueado se ve a color y se puede probar: el avatar cambia para que veas cómo te verías, pero no se guarda.
const PESTANAS = [
  { t: 'apariencia', n: 'Tú' }, { t: 'cabeza', n: 'Banda', opcional: true, cerca: true }, { t: 'torso', n: 'Dobok' },
  { t: 'mano', n: 'Guantes', opcional: true }, { t: 'pies', n: 'Pies', opcional: true }, { t: 'fondo', n: 'Fondo' },
];
const PEINADOS = [['corto', 'Corto'], ['rapado', 'Rapado'], ['despeinado', 'Picos'], ['rizado', 'Rizado'], ['coleta', 'Coleta'], ['chongo', 'Chongo'], ['largo', 'Largo']];
const COLORES = [['negro', 'Negro'], ['castano_oscuro', 'Castaño oscuro'], ['castano', 'Castaño'], ['rubio', 'Rubio'], ['pelirrojo', 'Pelirrojo'], ['canoso', 'Canoso'], ['azul', 'Azul'], ['rosa', 'Rosa']];
const VELLOS = [['ninguno', 'Sin vello'], ['bigote', 'Bigote'], ['candado', 'Candado'], ['barba', 'Barba']];
const COMPLEXIONES = [['delgada', 'Delgada'], ['media', 'Media'], ['robusta', 'Robusta']];

export default function MiAvatar() {
  const { id } = useParams();
  const datos = useDatos(() => api.get(`/app/alumnos/${id}/avatar`), [id]);
  const [tipo, setTipo] = useState('apariencia');
  const [prueba, setPrueba] = useState({});         // tipo → accesorio bloqueado que se está probando
  const [ap, setAp] = useState(null);
  const [accion, setAccion] = useState(null);
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState(null);
  const espera = useRef(null);
  const d = datos.datos;
  useEffect(() => { if (d && !ap) setAp(d.apariencia); }, [d, ap]);
  if (datos.cargando && !d) return <Cargando />;
  if (datos.error) return <><Cabecera titulo="Mi avatar" alumnoId={id} /><ErrorCaja error={datos.error} reintentar={datos.recargar} /></>;

  const apariencia = ap || d.apariencia;
  const disc = disciplinaDe(apariencia.disciplina);
  const equipo = d.equipo;
  const enPrueba = Object.values(prueba);
  const vista = [...equipo.filter((e) => !prueba[e.tipo]), ...enPrueba.map((a) => ({ id: a.id, tipo: a.tipo, imagen: a.imagen }))];
  const puesto = (t) => equipo.find((e) => e.tipo === t);
  const pest = PESTANAS.find((x) => x.t === tipo);
  const items = d.accesorios.filter((a) => a.tipo === tipo);
  const ganadas = d.insignias.filter((i) => i.obtenida).length;
  const cinta = d.grado?.color_cinta;

  function avisoGuardado() { setGuardado(true); clearTimeout(espera.current?.ok); espera.current = { ...espera.current, ok: setTimeout(() => setGuardado(false), 1600) }; }

  async function poner(a) {
    setError(null);
    if (a && !a.desbloqueado) {           // probador: solo se ve, no se guarda
      setPrueba((p) => (p[a.tipo]?.id === a.id ? omitir(p, a.tipo) : { ...p, [a.tipo]: a }));
      return;
    }
    setPrueba((p) => omitir(p, tipo));
    const nuevo = [...equipo.filter((e) => e.tipo !== tipo), ...(a ? [{ id: a.id, tipo: a.tipo, imagen: a.imagen }] : [])];
    const antes = equipo;
    datos.setDatos((x) => ({ ...x, equipo: nuevo }));
    try { await api.put(`/app/alumnos/${id}/avatar`, { equipo: nuevo.map((e) => e.id) }); avisoGuardado(); }
    catch (e) { datos.setDatos((x) => ({ ...x, equipo: antes })); setError(e); }
  }

  function cambiar(k, v) {
    const nuevo = { ...apariencia, [k]: v };
    setAp(nuevo); setError(null);
    clearTimeout(espera.current?.put);
    espera.current = { ...espera.current, put: setTimeout(async () => {
      try { await api.put(`/app/alumnos/${id}/avatar`, { apariencia: { piel: nuevo.piel, peinado: nuevo.peinado, color_pelo: nuevo.color_pelo, vello: nuevo.vello, complexion: nuevo.complexion } }); avisoGuardado(); }
      catch (e) { setError(e); }
    }, 450) };
  }

  return (
    <>
      <Cabecera titulo="Mi avatar" alumnoId={id} />
      <div className="relative mx-auto w-full max-w-80 aspect-square rounded-[32px] overflow-hidden border-2 border-line anim-entrar">
        <Avatar equipo={vista} apariencia={apariencia} cinta={cinta} className="size-full" animado interactivo accion={accion} />
        {enPrueba.length > 0 && <span className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-gold text-[#2b1d00] px-3 py-1 text-[12px] font-black"><Eye className="size-3.5" />Vista previa</span>}
        {guardado && <span className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-action text-on-action px-3 py-1 text-[12px] font-black anim-aparecer"><Check className="size-3.5" strokeWidth={3} />Guardado</span>}
      </div>
      <p className="text-center text-[13px] text-muted font-semibold mt-2">Tócalo o elige un movimiento de {apariencia.disciplina || 'Taekwondo'}</p>
      <div className="flex gap-2 justify-center mt-2">
        {disc.movimientos.map((m) => (
          <button key={m.id} onClick={() => setAccion({ id: m.id, n: Date.now() })}
            className="relieve h-11 px-4 rounded-2xl bg-violet text-white font-black text-[14px] [--sombra:#4a3fb0] cursor-pointer">{m.nombre}</button>
        ))}
      </div>

      {enPrueba.length > 0 && (
        <div className="mt-4 rounded-3xl border-2 border-gold/60 bg-gold/10 p-4 anim-aparecer">
          <div className="flex items-start gap-3">
            <Sparkles className="size-6 text-gold shrink-0" />
            <div className="flex-1 text-[14px] font-bold">
              {enPrueba.map((a) => (
                <p key={a.id}>Así te verías con <b className="text-gold">{a.nombre}</b>. Se gana al llegar a <b>{a.grado}</b>{a.color_cinta ? ` (cinta ${a.color_cinta.toLowerCase()})` : ''}.</p>
              ))}
              <p className="text-soft mt-1">¡Sigue entrenando para que sea tuyo!</p>
            </div>
          </div>
          <button onClick={() => setPrueba({})} className="mt-3 inline-flex items-center gap-1.5 font-black text-gold cursor-pointer"><Undo2 className="size-4" />Quitar vista previa</button>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto mt-4 pb-1 -mx-4 px-4 [scrollbar-width:none]">
        {PESTANAS.map((x) => (
          <button key={x.t} onClick={() => setTipo(x.t)}
            className={cx('shrink-0 h-11 px-5 rounded-full border-2 font-black cursor-pointer', tipo === x.t ? 'bg-action text-on-action border-action' : 'border-line text-soft bg-surface')}>{x.n}</button>
        ))}
      </div>
      <div className="mt-3"><ErrorCaja error={error} /></div>

      {tipo === 'apariencia' ? (
        <div className="space-y-5 mt-3">
          <Seccion titulo="Tono de piel">
            <div className="flex gap-3 flex-wrap">
              {Object.entries(PIELES).map(([k, c]) => (
                <button key={k} onClick={() => cambiar('piel', k)} aria-label={`Piel ${k}`} aria-pressed={apariencia.piel === k}
                  className={cx('size-12 rounded-full border-4 cursor-pointer', apariencia.piel === k ? 'border-action' : 'border-transparent')} style={{ background: c }} />
              ))}
            </div>
          </Seccion>
          <Seccion titulo="Cabello">
            <div className="grid grid-cols-4 gap-2">
              {PEINADOS.map(([k, n]) => (
                <Opcion key={k} activo={apariencia.peinado === k} onClick={() => cambiar('peinado', k)} nombre={n}>
                  <Avatar apariencia={{ ...apariencia, peinado: k }} equipo={equipo.filter((e) => e.tipo !== 'cabeza')} cinta={cinta} fondo={false} encuadre="cabeza" className="w-full aspect-square" />
                </Opcion>
              ))}
            </div>
          </Seccion>
          <Seccion titulo="Color de cabello">
            <div className="flex gap-3 flex-wrap">
              {COLORES.map(([k, n]) => (
                <button key={k} onClick={() => cambiar('color_pelo', k)} aria-label={n} title={n} aria-pressed={apariencia.color_pelo === k}
                  className={cx('size-11 rounded-full border-4 cursor-pointer', apariencia.color_pelo === k ? 'border-action' : 'border-transparent')} style={{ background: PELOS[k] }} />
              ))}
            </div>
          </Seccion>
          {apariencia.etapa !== 'nino' && (
            <Seccion titulo="Vello facial">
              <div className="grid grid-cols-4 gap-2">
                {VELLOS.map(([k, n]) => (
                  <Opcion key={k} activo={apariencia.vello === k} onClick={() => cambiar('vello', k)} nombre={n}>
                    <Avatar apariencia={{ ...apariencia, vello: k }} equipo={equipo.filter((e) => e.tipo !== 'cabeza')} cinta={cinta} fondo={false} encuadre="cabeza" className="w-full aspect-square" />
                  </Opcion>
                ))}
              </div>
            </Seccion>
          )}
          <Seccion titulo="Complexión">
            <div className="grid grid-cols-3 gap-2">
              {COMPLEXIONES.map(([k, n]) => (
                <Opcion key={k} activo={apariencia.complexion === k} onClick={() => cambiar('complexion', k)} nombre={n}>
                  <Avatar apariencia={{ ...apariencia, complexion: k }} equipo={equipo} cinta={cinta} fondo={false} pose="firmes" className="w-full aspect-square" />
                </Opcion>
              ))}
            </div>
          </Seccion>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3 mt-3">
          {items.map((a) => {
            const on = puesto(tipo)?.id === a.id && !prueba[tipo];
            const probando = prueba[tipo]?.id === a.id;
            const v = [...equipo.filter((e) => e.tipo !== tipo), { tipo: a.tipo, imagen: a.imagen }];
            return (
              <button key={a.id} onClick={() => poner(a)} aria-pressed={on}
                className={cx('relative rounded-2xl border-2 p-1.5 text-center cursor-pointer transition-colors',
                  on ? 'border-action bg-action/10' : probando ? 'border-gold border-dashed bg-gold/10' : 'border-line bg-surface')}>
                <div className="rounded-xl overflow-hidden bg-inset">
                  <Avatar equipo={v} apariencia={apariencia} cinta={cinta} fondo={tipo === 'fondo'} encuadre={pest.cerca ? 'cabeza' : 'cuerpo'} className="w-full aspect-square" />
                </div>
                <div className="text-[12px] font-extrabold mt-1 leading-tight">{a.nombre}</div>
                {!a.desbloqueado && (<>
                  <span className="absolute top-2.5 right-2.5 grid place-items-center size-7 rounded-full bg-deep/90 ring-2 ring-gold/60"><Lock className="size-3.5 text-gold" strokeWidth={2.8} /></span>
                  <div className="text-[11px] font-bold text-gold">{probando ? 'Probándotelo' : `Se gana en ${a.grado}`}</div>
                </>)}
                {on && <span className="absolute top-2.5 right-2.5 grid place-items-center size-7 rounded-full bg-action"><Check className="size-4 text-on-action" strokeWidth={3} /></span>}
              </button>
            );
          })}
          {pest.opcional && (
            <button onClick={() => poner(null)} aria-pressed={!puesto(tipo)}
              className={cx('rounded-2xl border-2 border-dashed p-3 grid place-items-center text-[13px] font-extrabold cursor-pointer', !puesto(tipo) ? 'border-action text-action' : 'border-line text-muted')}>
              Sin {pest.n.toLowerCase()}
            </button>
          )}
        </div>
      )}

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

const omitir = (o, k) => { const x = { ...o }; delete x[k]; return x; };

function Seccion({ titulo, children }) {
  return <section><h3 className="etiqueta mb-2">{titulo}</h3>{children}</section>;
}

function Opcion({ activo, onClick, nombre, children }) {
  return (
    <button onClick={onClick} aria-pressed={activo}
      className={cx('rounded-2xl border-2 p-1 text-center cursor-pointer', activo ? 'border-action bg-action/10' : 'border-line bg-surface')}>
      <div className="rounded-xl overflow-hidden bg-inset">{children}</div>
      <div className="text-[11px] font-extrabold mt-1">{nombre}</div>
    </button>
  );
}
