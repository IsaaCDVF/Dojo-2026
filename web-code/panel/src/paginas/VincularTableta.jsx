import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, RefreshCw, Tablet } from 'lucide-react';
import { api, token } from '../api';
import { useSesion } from '../auth/Sesion';
import { useMarca } from '../marca/Marca';
import { NombreMarca } from '../marca/NombreMarca';
import { BotonTema, Isotipo } from '../ui';

// Conectar la tableta de la entrada sin correo ni contraseña (como conectar una tele a una app de video):
// la tableta muestra un código, el admin lo escribe en Configuración → Tabletas y la tableta entra sola.

export default function VincularTableta() {
  const { recargar } = useSesion();
  const { marca } = useMarca();
  const navegar = useNavigate();
  const [cod, setCod] = useState(null);       // {codigo, clave, expira_en}
  const [restan, setRestan] = useState(0);
  const [error, setError] = useState('');
  const [listo, setListo] = useState(null);
  const vivo = useRef(true);

  const pedir = useCallback(async () => {
    setError(''); setCod(null);
    try { const r = await api.post('/dispositivos/solicitar'); setCod(r); setRestan(r.expira_en); }
    catch (e) { setError(e.message); }
  }, []);
  useEffect(() => { vivo.current = true; pedir(); return () => { vivo.current = false; }; }, [pedir]);

  // Cuenta regresiva y pregunta cada 3 segundos si ya la conectaron
  useEffect(() => {
    if (!cod || listo) return undefined;
    const reloj = setInterval(() => setRestan((s) => Math.max(0, s - 1)), 1000);
    const preguntar = setInterval(async () => {
      try {
        const r = await api.post('/dispositivos/estado', { clave: cod.clave });
        if (!vivo.current) return;
        if (r.estado === 'vinculado') {
          token.set(r.token, true);           // se queda guardada en esta tableta
          setListo(r.dispositivo);
          setTimeout(async () => { await recargar(); navegar('/tableta', { replace: true }); }, 1800);
        } else if (r.estado === 'expirado') setCod((c) => (c ? { ...c, vencido: true } : c));
      } catch { /* sin red: vuelve a intentar */ }
    }, 3000);
    return () => { clearInterval(reloj); clearInterval(preguntar); };
  }, [cod, listo, recargar, navegar]);

  const vencido = cod && (cod.vencido || restan === 0);
  const im = marca.imagenes || {};
  return (
    <div className="min-h-full flex flex-col bg-canvas">
      <header className="flex items-center justify-between px-5 h-16">
        <button onClick={() => navegar('/login')} className="inline-flex items-center gap-2 text-sm text-muted hover:text-text cursor-pointer"><ArrowLeft className="size-4" />Iniciar sesión con correo</button>
        <BotonTema />
      </header>
      <main className="flex-1 grid place-items-center px-6 pb-12">
        <div className="w-full max-w-[560px] text-center">
          {im.icono ? <img src={im.icono} alt="" className="size-16 mx-auto rounded-2xl object-contain" /> : <Isotipo className="size-14 mx-auto" />}
          <div className="text-[15px] text-muted mt-2"><NombreMarca nombre={marca.nombre} fuente={marca.fuente_nombre} /></div>
          {listo ? (
            <div className="mt-8 anim-entrar">
              <div className="grid place-items-center size-16 mx-auto rounded-full bg-ok-bg text-ok"><Tablet className="size-8" /></div>
              <h1 className="text-[30px] mt-4">¡Conectada!</h1>
              <p className="text-muted mt-1">{listo.nombre} · {listo.sucursal}</p>
            </div>
          ) : (
            <>
              <h1 className="text-[28px] sm:text-[34px] leading-tight mt-6">Conecta esta tableta</h1>
              <p className="text-muted mt-2">En el panel entra a <b className="text-text">Configuración → Tabletas</b>, toca <b className="text-text">Conectar tableta</b> y escribe este código:</p>
              <div className="mt-8">
                {error ? <p className="text-danger">{error}</p> : !cod ? <Loader2 className="size-8 mx-auto animate-spin text-muted" /> : (
                  <div className={vencido ? 'opacity-30' : ''}>
                    <div className="font-mono text-[64px] sm:text-[84px] font-semibold tracking-[.18em] leading-none tabular-nums" aria-label={`Código ${cod.codigo.split('').join(' ')}`}>
                      {cod.codigo.slice(0, 3)}<span className="text-muted"> </span>{cod.codigo.slice(3)}
                    </div>
                    <div className="text-sm text-muted mt-4">{vencido ? 'Este código ya venció' : `Vence en ${Math.floor(restan / 60)}:${String(restan % 60).padStart(2, '0')}`}</div>
                  </div>
                )}
                {(vencido || error) && (
                  <button onClick={pedir} className="mt-5 inline-flex items-center gap-2 h-11 px-5 rounded-full bg-action text-on-action font-semibold cursor-pointer"><RefreshCw className="size-4" />Código nuevo</button>
                )}
              </div>
              <p className="text-[13px] text-muted mt-10">La tableta solo podrá registrar asistencia en la sucursal que elijas. Se queda conectada hasta que la desconecten desde el panel.</p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
