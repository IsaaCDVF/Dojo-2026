import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, BellOff, BellRing, CalendarClock, CalendarX2, ChevronRight, Medal, Share, UserRoundX } from 'lucide-react';
import { api } from '../api';
import { Cabecera } from '../Marco';
import { ponerSinLeer } from '../campanita';
import { activar, desactivar, esIPhone, estado } from '../notificaciones';
import { Boton, Cargando, ErrorCaja, Tarjeta, cx, useDatos } from '../ui';

// La campanita: avisos de pagos, faltas y exámenes. Arriba, encender las notificaciones en este celular.

const ICONOS = {
  pago_vencido: [CalendarX2, 'bg-danger/15 text-danger'],
  pago_por_vencer: [CalendarClock, 'bg-gold/18 text-gold'],
  examen_autorizado: [Medal, 'bg-ok/15 text-ok'],
  ausencia: [UserRoundX, 'bg-action/15 text-action'],
};
const DESPUES = 'dojo-notificaciones-despues';
const cuando = (f) => {
  const d = new Date(String(f).replace(' ', 'T'));
  const dias = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 864e5);
  if (dias <= 0) return 'Hoy · ' + d.toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' });
  if (dias === 1) return 'Ayer';
  if (dias < 7) return `Hace ${dias} días`;
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
};

export function Notificaciones({ compacta = false }) {
  const [est, setEst] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(null);
  const [despues, setDespues] = useState(() => { try { return Number(localStorage.getItem(DESPUES)) > Date.now(); } catch { return false; } });
  useEffect(() => { estado().then(setEst).catch(() => setEst('no')); }, []);
  if (!est || est === 'no') return null;
  // En Familia solo se ofrece una vez (con "Ahora no" se esconde 30 días); en la campanita siempre se ve
  if (compacta && (est !== 'apagadas' || despues)) return null;
  const ahoraNo = () => { try { localStorage.setItem(DESPUES, String(Date.now() + 30 * 864e5)); } catch { /* nada */ } setDespues(true); };
  const encender = async () => { setOcupado(true); setError(null); try { setEst(await activar()); } catch (e) { setError(e); } finally { setOcupado(false); } };
  const apagar = async () => { setOcupado(true); try { setEst(await desactivar()); } finally { setOcupado(false); } };

  if (est === 'activas') return (
    <div className="flex items-center gap-3 rounded-2xl bg-ok/10 border-2 border-ok/30 px-4 py-3">
      <BellRing className="size-5 text-ok shrink-0" strokeWidth={2.6} />
      <p className="flex-1 text-[14px] font-bold">Te llegan como notificación en este celular.</p>
      <button onClick={apagar} disabled={ocupado} className="text-[13px] font-black text-muted underline cursor-pointer">Apagar</button>
    </div>
  );
  return (
    <Tarjeta className="space-y-3">
      <div className="flex items-start gap-3">
        <span className="grid place-items-center size-11 rounded-2xl bg-action/15 text-action shrink-0"><Bell className="size-6" strokeWidth={2.6} /></span>
        <div>
          <h2 className="text-[17px] font-black">Que te llegue al celular</h2>
          <p className="text-[14px] text-muted font-semibold">Te avisamos antes de que venza tu pago, cuando autoricen un examen y más. Sin abrir la app.</p>
        </div>
      </div>
      {est === 'https' ? (
        <p className="rounded-2xl bg-inset px-4 py-3 text-[14px] font-bold">
          Las notificaciones necesitan que la app se abra con una dirección segura (https). Mientras tanto, tus avisos siempre aparecen aquí en la campanita.
        </p>
      ) : est === 'instalar' ? (
        <p className="rounded-2xl bg-inset px-4 py-3 text-[14px] font-bold">
          En iPhone primero agrega la app a tu pantalla de inicio: toca <Share className="inline size-4 -mt-1" /> <b>Compartir</b> y luego <b>Agregar a inicio</b>. Ábrela desde ese ícono y vuelve aquí.
        </p>
      ) : est === 'bloqueadas' ? (
        <p className="rounded-2xl bg-inset px-4 py-3 text-[14px] font-bold">
          <BellOff className="inline size-4 -mt-1 mr-1" />Las notificaciones están bloqueadas para esta app. {esIPhone() ? 'Actívalas en Ajustes → Notificaciones.' : 'Actívalas en el candado junto a la dirección (o en Ajustes del celular → Apps → tu navegador).'}
        </p>
      ) : (
        <>
          <Boton icono={BellRing} cargando={ocupado} onClick={encender}>Activar notificaciones</Boton>
          {compacta && <button onClick={ahoraNo} className="w-full text-center text-[13px] font-black text-muted cursor-pointer">Ahora no</button>}
        </>
      )}
      <ErrorCaja error={error} />
    </Tarjeta>
  );
}

export default function Avisos() {
  const navegar = useNavigate();
  const d = useDatos(() => api.get('/app/avisos'), []);
  const [nuevos, setNuevos] = useState(null);
  const lista = d.datos?.avisos || [];
  // Al abrir la campanita se dan por leídos (se siguen viendo resaltados mientras estás aquí)
  useEffect(() => {
    if (!d.datos || nuevos) return;
    const ids = new Set(d.datos.avisos.filter((a) => !a.leida).map((a) => a.id));
    setNuevos(ids);
    ponerSinLeer(0);
    if (ids.size) api.post('/app/avisos/leidas').catch(() => {});
  }, [d.datos, nuevos]);

  return (
    <>
      <Cabecera titulo="Avisos" />
      <div className="space-y-4">
        <Notificaciones />
        <ErrorCaja error={d.error} reintentar={d.recargar} />
        {d.cargando && !d.datos ? <Cargando /> : !lista.length ? (
          <div className="text-center py-14 text-muted">
            <Bell className="size-12 mx-auto mb-3 opacity-50" />
            <p className="font-black text-[17px] text-text">Sin avisos por ahora</p>
            <p className="font-semibold text-[14px]">Aquí te avisamos de tus pagos, exámenes y clases.</p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {lista.map((a) => {
              const [I, color] = ICONOS[a.evento] || [Bell, 'bg-inset text-muted'];
              const nuevo = nuevos?.has(a.id);
              return (
                <li key={a.id}>
                  <button onClick={() => navegar(a.ruta || '/')} className={cx('w-full text-left flex gap-3 rounded-3xl border-2 p-4 cursor-pointer anim-entrar', nuevo ? 'border-action/60 bg-action/5' : 'border-line bg-surface')}>
                    <span className={cx('grid place-items-center size-11 rounded-2xl shrink-0', color)}><I className="size-6" strokeWidth={2.4} /></span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-2"><span className="flex-1 font-black text-[16px] leading-tight">{a.titulo}</span>{nuevo && <span className="size-2.5 rounded-full bg-action shrink-0" aria-label="Nuevo" />}</span>
                      <span className="block text-[14px] font-semibold text-muted mt-1">{a.mensaje}</span>
                      <span className="block text-[12px] font-bold text-muted/80 mt-1.5">{cuando(a.fecha)}</span>
                    </span>
                    <ChevronRight className="size-5 text-muted self-center shrink-0" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
