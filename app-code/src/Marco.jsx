import { useEffect, useRef } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { ChevronLeft, Flame, Home, MapPin, Moon, Smile, Sun, Trophy, UserRound, Users, Wallet } from 'lucide-react';
import { api } from './api';
import { useSesion } from './sesion';
import { Isotipo } from './Logo';
import { MarcaIcono, Nombre, useMarca } from './marca';
import { cx } from './ui';

/** Columna de celular + barra de pestañas abajo. Las pestañas cambian si estás viendo a un alumno o a tu familia */
export default function Marco() {
  const { yo } = useSesion();
  const marca = useMarca();
  const loc = useLocation();
  // Al entrar se trae el modo que guardó en su cuenta (por si lo cambió en otro celular)
  const sincronizado = useRef(false);
  useEffect(() => {
    if (sincronizado.current) return; sincronizado.current = true;
    api.get('/preferencias').then((p) => { if (p?.tema && p.tema !== marca.tema) marca.ponerTema(p.tema, false); }).catch(() => {});
  }, [marca]);
  const m = loc.pathname.match(/^\/a\/(\d+)/);
  const tabs = m
    ? [
        { a: `/a/${m[1]}`, t: 'Inicio', i: Home, fin: true },
        { a: `/a/${m[1]}/camino`, t: 'Camino', i: MapPin },
        { a: `/a/${m[1]}/avatar`, t: 'Avatar', i: Smile },
        { a: `/a/${m[1]}/examen`, t: 'Examen', i: Trophy },
        ...(yo.es_responsable ? [{ a: '/familia', t: 'Familia', i: Users }] : []),
      ]
    : [
        ...(yo.alumno_id ? [{ a: `/a/${yo.alumno_id}`, t: 'Yo', i: Home }] : []),
        { a: '/familia', t: 'Familia', i: Users },
        { a: '/pagos', t: 'Pagos', i: Wallet },
      ];
  return (
    <div className="h-full bg-deep">
      <div className="mx-auto max-w-md min-h-full bg-canvas flex flex-col">
        <main className="flex-1 px-4 pt-3 pb-28 overflow-x-clip"><Outlet /></main>
        <nav className="fixed bottom-0 inset-x-0 z-40">
          <div className="mx-auto max-w-md bg-canvas/95 backdrop-blur border-t-2 border-line px-3 pt-2 seguro-abajo">
            <ul className="flex justify-around gap-1">
              {tabs.map((x) => (
                <li key={x.a} className="flex-1">
                  <NavLink to={x.a} end={x.fin} className={({ isActive }) => cx('flex flex-col items-center gap-1 rounded-2xl border-2 py-2 text-[11px] font-black uppercase tracking-wide transition-colors',
                    isActive ? 'border-action text-action bg-action/10' : 'border-transparent text-muted')}>
                    <x.i className="size-6" strokeWidth={2.4} />{x.t}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        </nav>
      </div>
    </div>
  );
}

/** Encabezado de cada pantalla: logo y título; racha a la derecha; "Mi familia" si un papá ve a su hijo */
export function Cabecera({ titulo, racha, alumnoId }) {
  const { yo } = useSesion();
  const marca = useMarca();
  const ajeno = alumnoId && yo.es_responsable && Number(alumnoId) !== yo.alumno_id;
  return (
    <header className="flex items-center gap-3 h-14 mb-3">
      {ajeno
        ? <Link to="/familia" className="grid place-items-center size-10 -ml-1 rounded-full bg-surface" aria-label="Mi familia"><ChevronLeft className="size-6" /></Link>
        : <MarcaIcono Isotipo={Isotipo} />}
      <h1 className="flex-1 text-[22px] font-black truncate">{titulo === 'Dojo OS' ? <Nombre /> : titulo}</h1>
      {racha > 0 && <span className="inline-flex items-center gap-1 font-black text-gold text-[18px]" title={`${racha} clases seguidas`}><Flame className="size-6 fill-gold" />{racha}</span>}
      <button onClick={() => marca.ponerTema(marca.modo === 'oscuro' ? 'claro' : 'oscuro')} aria-label={marca.modo === 'oscuro' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
        className="grid place-items-center size-10 rounded-full text-muted hover:text-text cursor-pointer">{marca.modo === 'oscuro' ? <Sun className="size-5" /> : <Moon className="size-5" />}</button>
      <Link to="/cuenta" aria-label="Mi cuenta" className="grid place-items-center size-10 -mr-1 rounded-full bg-surface border-2 border-line text-text"><UserRound className="size-5" /></Link>
    </header>
  );
}
