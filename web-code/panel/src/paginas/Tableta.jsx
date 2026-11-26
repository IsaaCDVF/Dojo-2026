import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Camera, CameraOff, Clock, Keyboard, LogOut, RefreshCw, SwitchCamera, Users } from 'lucide-react';
import { api, ErrorApi } from '../api';
import { useSesion } from '../auth/Sesion';
import { BotonIcono, BotonTema, Cargando, Cinta, ErrorCaja, FotoAlumno, Logo, Pestanas, useDatos } from '../ui';

// S-09 · Tableta de asistencia (BPMN-03). Por ahora corre en un celular: elige la clase y lee el QR de la credencial
// con la cámara. También acepta un lector de códigos USB o Bluetooth (escribe el código y un Enter).
// Si no hay cámara o el navegador no la deja usar (la página debe ser https), queda el campo para teclear el código.

const cx = (...c) => c.filter(Boolean).join(' ');
const GUARDA = 'dojo-tableta-sucursal';

export default function Tableta() {
  const { rol } = useSesion();
  const global = rol?.alcance === 'global';
  const [suc, setSuc] = useState(() => { try { return localStorage.getItem(GUARDA) || ''; } catch { return ''; } });
  const [clase, setClase] = useState(null);
  const sucursales = useDatos(() => (global ? api.get('/sucursales') : Promise.resolve([])), [global]);
  const sucursal = global ? (suc || String(sucursales.datos?.[0]?.id || '')) : String(rol?.sucursal_id || '');

  // La tableta se queda prendida todo el día: mantiene viva la sesión y la pantalla encendida
  useEffect(() => {
    const t = setInterval(() => api.get('/auth/yo').catch(() => {}), 4 * 60 * 1000);
    let lock = null;
    const pedir = () => navigator.wakeLock?.request('screen').then((l) => { lock = l; }).catch(() => {});
    pedir();
    const visible = () => document.visibilityState === 'visible' && pedir();
    document.addEventListener('visibilitychange', visible);
    return () => { clearInterval(t); lock?.release?.(); document.removeEventListener('visibilitychange', visible); };
  }, []);

  const elegirSucursal = (v) => { setSuc(v); try { localStorage.setItem(GUARDA, v); } catch { /* nada */ } };

  return (
    <div className="h-full flex flex-col bg-canvas">
      {clase
        ? <Escanear clase={clase} onSalir={() => setClase(null)} />
        : <ElegirClase sucursal={sucursal} global={global} sucursales={sucursales.datos || []} onSucursal={elegirSucursal} onElegir={setClase} />}
    </div>
  );
}

function Reloj() {
  const [ahora, setAhora] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setAhora(new Date()), 15000); return () => clearInterval(t); }, []);
  return <span className="font-mono text-[15px] tabular-nums">{ahora.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</span>;
}

/* ---------------- Paso 1: elegir la clase ---------------- */
function ElegirClase({ sucursal, global, sucursales, onSucursal, onElegir }) {
  const { logout, usuario } = useSesion();
  const datos = useDatos(() => (sucursal ? api.get('/asistencias/clases', { sucursal_id: sucursal }) : Promise.resolve(null)), [sucursal]);
  useEffect(() => { const t = setInterval(datos.recargar, 60000); return () => clearInterval(t); }, [datos.recargar]);
  const clases = datos.datos?.clases || [];
  const hoy = new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <>
      <header className="flex items-center gap-3 px-4 sm:px-6 h-16 border-b border-line shrink-0">
        <Logo subtitulo="Asistencia" />
        <div className="flex-1" />
        <Reloj />
        <BotonTema />
        <BotonIcono icono={LogOut} etiqueta={`Salir (${usuario?.email || ''})`} onClick={logout} />
      </header>
      <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 max-w-5xl w-full mx-auto">
        <div className="etiqueta mb-1">{hoy}</div>
        <h1 className="text-[28px] leading-tight mb-4">¿Qué clase empieza?</h1>
        {global && <Pestanas className="mb-4" valor={sucursal} onCambio={onSucursal} opciones={sucursales.map((s) => ({ valor: String(s.id), etiqueta: s.nombre }))} />}
        <ErrorCaja error={datos.error} reintentar={datos.recargar} />
        {datos.cargando && !datos.datos ? <Cargando /> : !clases.length ? (
          <div className="text-center py-16 text-muted">
            <Clock className="size-10 mx-auto mb-3 opacity-60" />
            <div className="font-semibold text-text">Hoy no hay clases en esta sucursal</div>
            <p className="text-sm mt-1">Las clases se dan de alta en Horarios.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {clases.map((c) => (
              <button key={c.id} disabled={c.estado === 'terminada'} onClick={() => onElegir(c)}
                className={cx('text-left rounded-[12px] border p-5 transition-colors cursor-pointer anim-entrar disabled:opacity-45 disabled:cursor-default',
                  c.estado === 'en_curso' ? 'border-action bg-action/10' : 'border-line bg-surface hover:border-action')}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-mono text-[26px] font-semibold leading-none">{c.hora_inicio}<span className="text-muted text-[16px]"> – {c.hora_fin}</span></div>
                    <div className="text-[18px] font-semibold mt-2">{c.disciplina}</div>
                    <div className="text-muted text-sm">{c.nivel || 'Clase general'} · {c.instructor}</div>
                  </div>
                  <span className={cx('rounded-full px-2.5 py-1 text-[12px] font-semibold whitespace-nowrap',
                    c.estado === 'en_curso' ? 'bg-action text-on-action' : c.estado === 'proxima' ? 'bg-inset text-soft' : 'bg-inset text-muted')}>
                    {c.estado === 'en_curso' ? 'En curso' : c.estado === 'proxima' ? 'Próxima' : 'Terminó'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[13px] text-muted mt-3"><Users className="size-3.5" />{c.asistieron} de {c.inscritos} registrados</div>
              </button>
            ))}
          </div>
        )}
      </main>
    </>
  );
}

/* ---------------- Paso 2: leer credenciales ---------------- */
const ESTILO = {
  bienvenido: { fondo: 'bg-[#0f7a4f]', titulo: '¡Bienvenido!' },
  retardo: { fondo: 'bg-[#b7791f]', titulo: 'Retardo' },
  negado: { fondo: 'bg-[#b42318]', titulo: 'Acceso negado' },
  repetida: { fondo: 'bg-[#1d4ed8]', titulo: 'Ya estabas registrado' },
  desconocido: { fondo: 'bg-[#3f3f46]', titulo: 'Código no reconocido' },
  error: { fondo: 'bg-[#3f3f46]', titulo: 'No se pudo registrar' },
};

function sonar(tipo) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const notas = tipo === 'bienvenido' ? [880, 1320] : tipo === 'retardo' ? [660, 660] : [220, 180];
    notas.forEach((f, i) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.frequency.value = f; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.18, ctx.currentTime + i * 0.16); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.16 + 0.14);
      o.start(ctx.currentTime + i * 0.16); o.stop(ctx.currentTime + i * 0.16 + 0.15);
    });
    setTimeout(() => ctx.close(), 800);
  } catch { /* sin audio */ }
  navigator.vibrate?.(tipo === 'bienvenido' ? 80 : [120, 60, 120]);
}

function Escanear({ clase, onSalir }) {
  const [resultado, setResultado] = useState(null);
  const [recientes, setRecientes] = useState([]);
  const [contador, setContador] = useState(Number(clase.asistieron) || 0);
  const [teclear, setTeclear] = useState(false);
  const [codigo, setCodigo] = useState('');
  const ocupado = useRef(false);
  const ultimo = useRef({ codigo: '', t: 0 });

  const registrar = useCallback(async (texto) => {
    const c = (texto || '').trim();
    if (!c || ocupado.current) return;
    if (ultimo.current.codigo === c && Date.now() - ultimo.current.t < 5000) return;   // el mismo QR sigue frente a la cámara
    ultimo.current = { codigo: c, t: Date.now() };
    ocupado.current = true;
    let r;
    try {
      const d = await api.post('/asistencias/qr', { codigo: c, horario_id: clase.id });
      r = { tipo: d.resultado, alumno: d.alumno, avisos: d.avisos, mensaje: d.resultado === 'retardo' ? `${d.minutos_tarde} minutos tarde` : d.visita ? 'Visita de otra sucursal' : 'Buen entrenamiento' };
      setContador((n) => n + 1);
    } catch (e) {
      const det = e instanceof ErrorApi ? e.detalle : {};
      const tipo = det.resultado || (e.estado === 404 ? 'desconocido' : 'error');
      r = { tipo, alumno: det.alumno, avisos: det.avisos || [], mensaje: e.message };
    }
    sonar(r.tipo);
    setResultado(r);
    if (r.alumno) setRecientes((l) => [{ ...r, hora: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }), k: Date.now() }, ...l].slice(0, 6));
    setTimeout(() => { setResultado((x) => (x === r ? null : x)); ocupado.current = false; }, r.tipo === 'bienvenido' ? 2500 : 4500);
  }, [clase.id]);

  // Lector USB/Bluetooth: "teclea" el código muy rápido y termina con Enter
  useEffect(() => {
    let buf = ''; let t = 0;
    const tecla = (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (e.key === 'Enter') { if (buf.length >= 8) registrar(buf); buf = ''; return; }
      if (e.key.length === 1) { if (Date.now() - t > 120) buf = ''; buf += e.key; t = Date.now(); }
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [registrar]);

  const cerrar = () => { setResultado(null); ocupado.current = false; };

  return (
    <>
      <header className="flex items-center gap-3 px-3 sm:px-5 h-16 border-b border-line shrink-0">
        <BotonIcono icono={ArrowLeft} etiqueta="Cambiar de clase" onClick={onSalir} />
        <div className="min-w-0 flex-1">
          <div className="font-semibold truncate">{clase.disciplina} · <span className="font-mono">{clase.hora_inicio}</span></div>
          <div className="text-[12px] text-muted truncate">{clase.nivel || 'Clase general'} · {clase.instructor}</div>
        </div>
        <div className="text-right"><div className="font-mono text-[22px] font-semibold leading-none">{contador}</div><div className="etiqueta !text-[10px]">registrados</div></div>
        <Reloj />
      </header>
      <main className="flex-1 min-h-0 flex flex-col lg:flex-row gap-4 p-3 sm:p-5">
        <div className="flex-1 min-h-0 flex flex-col gap-3">
          <Camara activa={!resultado} onCodigo={registrar} />
          <div className="flex items-center gap-2">
            <button onClick={() => setTeclear((x) => !x)} className="inline-flex items-center gap-2 h-10 px-4 rounded-full border border-line text-sm text-muted hover:text-text cursor-pointer">
              <Keyboard className="size-4" />Teclear código
            </button>
            {teclear && (
              <form className="flex-1 flex gap-2" onSubmit={(e) => { e.preventDefault(); ultimo.current = { codigo: '', t: 0 }; registrar(codigo); setCodigo(''); }}>
                <input value={codigo} onChange={(e) => setCodigo(e.target.value)} autoFocus placeholder="Código de la credencial"
                  className="flex-1 min-w-0 h-10 rounded-full bg-inset border border-line px-4 font-mono text-sm outline-none focus:border-action" />
                <button className="h-10 px-4 rounded-full bg-action text-on-action font-semibold text-sm cursor-pointer">Registrar</button>
              </form>
            )}
          </div>
        </div>
        <aside className="lg:w-80 shrink-0">
          <div className="etiqueta mb-2">Últimos registros</div>
          {!recientes.length ? <p className="text-sm text-muted">Acerca la credencial del alumno a la cámara.</p> : (
            <ul className="space-y-2">
              {recientes.map((r) => (
                <li key={r.k} className="flex items-center gap-3 rounded-md bg-surface border border-line px-3 py-2 anim-entrar">
                  <FotoAlumno id={r.alumno.id} nombre={r.alumno.nombre} tiene={r.alumno.tiene_foto} className="size-9" />
                  <div className="flex-1 min-w-0"><div className="text-sm font-medium truncate">{r.alumno.nombre}</div><div className="text-[12px] text-muted">{r.hora} · {ESTILO[r.tipo].titulo}</div></div>
                  <span className={cx('size-2.5 rounded-full', ESTILO[r.tipo].fondo)} />
                </li>
              ))}
            </ul>
          )}
        </aside>
      </main>
      {resultado && <Resultado r={resultado} onCerrar={cerrar} />}
    </>
  );
}

function Resultado({ r, onCerrar }) {
  const e = ESTILO[r.tipo] || ESTILO.error;
  return (
    <button onClick={onCerrar} className={cx('fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 p-6 text-white text-center cursor-pointer anim-aparecer', e.fondo)}>
      {r.alumno && <FotoAlumno id={r.alumno.id} nombre={r.alumno.nombre} tiene={r.alumno.tiene_foto} className="size-36 sm:size-44 ring-4 ring-white/80" texto="text-5xl" />}
      <div>
        <div className="text-[34px] sm:text-[44px] font-semibold leading-tight">{e.titulo}</div>
        {r.alumno && <div className="text-[24px] sm:text-[30px] mt-1">{r.alumno.nombre}</div>}
        {r.alumno?.grado && <div className="inline-flex items-center gap-2 mt-2 text-white/90"><Cinta color={r.alumno.color_cinta} />{r.alumno.grado}</div>}
      </div>
      <div className="text-[18px] sm:text-[20px] max-w-xl text-white/95">{r.mensaje}</div>
      {r.avisos?.length > 0 && (
        <ul className="space-y-1.5 max-w-xl">
          {r.avisos.map((a) => <li key={a} className="rounded-full bg-black/20 px-4 py-1.5 text-[15px]">{a}</li>)}
        </ul>
      )}
      <div className="text-white/60 text-[13px] mt-2">Toca para continuar</div>
    </button>
  );
}

/* ---------------- Cámara y lectura del QR ---------------- */
function Camara({ activa, onCodigo }) {
  const video = useRef(null);
  const lienzo = useRef(null);
  const activaRef = useRef(activa); activaRef.current = activa;
  const [estado, setEstado] = useState('iniciando');   // iniciando | lista | sin_permiso | inseguro | sin_camara
  const [camaras, setCamaras] = useState([]);
  const [indice, setIndice] = useState(-1);             // -1 = la trasera por defecto
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let flujo = null; let vivo = true; let t = 0;
    async function arrancar() {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) { setEstado('inseguro'); return; }
      setEstado('iniciando');
      try {
        const video_ = indice >= 0 && camaras[indice] ? { deviceId: { exact: camaras[indice].deviceId } } : { facingMode: { ideal: 'environment' } };
        flujo = await navigator.mediaDevices.getUserMedia({ video: { ...video_, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
        if (!vivo) { flujo.getTracks().forEach((x) => x.stop()); return; }
        video.current.srcObject = flujo;
        await video.current.play();
        setEstado('lista');
        const lista = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
        if (vivo) setCamaras(lista);
      } catch (e) {
        setEstado(e?.name === 'NotAllowedError' ? 'sin_permiso' : 'sin_camara'); return;
      }
      // Lector: BarcodeDetector (Chrome en Android) o jsQR como respaldo (iPhone, Firefox)
      let detector = null;
      try { if ('BarcodeDetector' in window && (await window.BarcodeDetector.getSupportedFormats()).includes('qr_code')) detector = new window.BarcodeDetector({ formats: ['qr_code'] }); } catch { detector = null; }
      const jsQR = detector ? null : (await import('jsqr')).default;
      const leer = async () => {
        if (!vivo) return;
        const v = video.current;
        if (activaRef.current && v && v.readyState >= 2 && v.videoWidth) {
          try {
            let texto = null;
            if (detector) texto = (await detector.detect(v))[0]?.rawValue;
            else {
              const c = lienzo.current; const esc = Math.min(1, 640 / v.videoWidth);
              c.width = Math.round(v.videoWidth * esc); c.height = Math.round(v.videoHeight * esc);
              const ctx = c.getContext('2d', { willReadFrequently: true });
              ctx.drawImage(v, 0, 0, c.width, c.height);
              texto = jsQR(ctx.getImageData(0, 0, c.width, c.height).data, c.width, c.height, { inversionAttempts: 'dontInvert' })?.data;
            }
            if (texto) onCodigo(texto);
          } catch { /* cuadro ilegible: sigue */ }
        }
        t = setTimeout(leer, 180);
      };
      leer();
    }
    arrancar();
    return () => { vivo = false; clearTimeout(t); flujo?.getTracks().forEach((x) => x.stop()); };
  }, [indice, intento, onCodigo]); // eslint-disable-line react-hooks/exhaustive-deps

  const MENSAJE = {
    inseguro: ['La cámara necesita una página segura', 'En el celular abre el panel con https (npm run celular) o usa "Teclear código".'],
    sin_permiso: ['No hay permiso para usar la cámara', 'Permite la cámara en el candado de la barra de direcciones y vuelve a intentar.'],
    sin_camara: ['No se encontró una cámara', 'Conecta una cámara o un lector de códigos USB, o usa "Teclear código".'],
  };

  return (
    <div className="relative flex-1 min-h-[300px] rounded-[14px] overflow-hidden bg-black border border-line">
      <video ref={video} playsInline muted className={cx('absolute inset-0 size-full object-cover', estado !== 'lista' && 'opacity-0')} />
      <canvas ref={lienzo} className="hidden" />
      {estado === 'lista' && (
        <>
          <div className="absolute inset-0 grid place-items-center pointer-events-none">
            <div className="size-[min(62vw,280px)] rounded-[22px] border-4 border-white/85 shadow-[0_0_0_9999px_rgba(0,0,0,.35)]" />
          </div>
          <div className="absolute bottom-3 inset-x-0 text-center text-white text-sm font-semibold drop-shadow">Acerca la credencial dentro del cuadro</div>
          {camaras.length > 1 && (
            <button onClick={() => setIndice((i) => (i + 1) % camaras.length)} aria-label="Cambiar de cámara"
              className="absolute top-3 right-3 grid place-items-center size-11 rounded-full bg-black/55 text-white cursor-pointer"><SwitchCamera className="size-5" /></button>
          )}
        </>
      )}
      {estado === 'iniciando' && <div className="absolute inset-0 grid place-items-center text-white/80"><div className="flex items-center gap-2"><Camera className="size-5" />Encendiendo la cámara…</div></div>}
      {MENSAJE[estado] && (
        <div className="absolute inset-0 grid place-items-center p-6 text-center text-white">
          <div>
            <CameraOff className="size-10 mx-auto mb-3 opacity-70" />
            <div className="font-semibold text-[17px]">{MENSAJE[estado][0]}</div>
            <p className="text-white/70 text-sm mt-1 max-w-sm">{MENSAJE[estado][1]}</p>
            {estado !== 'inseguro' && <button onClick={() => setIntento((x) => x + 1)} className="mt-4 inline-flex items-center gap-2 h-10 px-4 rounded-full bg-white/15 hover:bg-white/25 cursor-pointer text-sm font-semibold"><RefreshCw className="size-4" />Reintentar</button>}
          </div>
        </div>
      )}
    </div>
  );
}
