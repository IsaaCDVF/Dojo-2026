import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, ImagePlus, Sparkles, AlertTriangle, Upload } from 'lucide-react';
import { api } from '../api';
import { useMarca } from '../marca/Marca';
import {
  analizarContenido, aPng, cargarImagen, componerIcono, componerLogo, detectarFondo, monocromo, quitarFondo, recortar, seVe, separar, acomodarHorizontal, visibleSobre,
} from '../marca/procesarLogo';
import { Boton, Modal, useAvisos } from '../ui';

// Asistente de logo: el cliente sube UNA imagen (la que tenga: cuadrada, con fondo negro o blanco, con mucho espacio)
// y el sistema prepara las 3 versiones. Muestra qué hizo y deja cambiar cada decisión antes de guardar.

const cx = (...c) => c.filter(Boolean).join(' ');
const OSCURO_TXT = '#111318';

export default function AsistenteLogo({ abierto, onCerrar, colorMenu, colorMarca }) {
  const { t } = useTranslation();
  const { setMarca, marca } = useMarca();
  const avisar = useAvisos();
  const ref = useRef(null);
  const [orig, setOrig] = useState(null);       // ImageData tal como llegó
  const [nombreArchivo, setNombreArchivo] = useState('');
  const [op, setOp] = useState(null);           // decisiones (se proponen solas al cargar)
  const [guardando, setGuardando] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);

  useEffect(() => { if (!abierto) { setOrig(null); setOp(null); } }, [abierto]);

  const fondo = useMemo(() => (orig ? detectarFondo(orig) : null), [orig]);

  // Logo limpio: sin fondo (si se pidió) y recortado
  const limpio = useMemo(() => {
    if (!orig || !op) return null;
    let d = orig;
    if (op.quitar && fondo?.tipo === 'color') d = quitarFondo(d, fondo.color, op.tolerancia);
    return op.recortar ? recortar(d) : d;
  }, [orig, op?.quitar, op?.tolerancia, op?.recortar, fondo]); // eslint-disable-line react-hooks/exhaustive-deps
  const partes = useMemo(() => (limpio ? separar(limpio) : null), [limpio]);
  const simbolo = partes?.simbolo || null;
  // Si viene apilado (símbolo arriba, texto abajo), se puede acomodar en horizontal para el menú
  const base = useMemo(() => {
    if (!limpio) return null;
    return op?.horizontal && partes?.orientacion === 'vertical' ? acomodarHorizontal(partes.simbolo, partes.texto) : limpio;
  }, [limpio, partes, op?.horizontal]);
  const info = useMemo(() => (base ? analizarContenido(base) : null), [base]);

  // Al cargar una imagen, el sistema propone todo
  async function elegir(archivo) {
    if (!archivo) return;
    if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(archivo.type)) { avisar(t('apariencia.asistente.formato'), 'error'); return; }
    if (archivo.size > 8 * 1024 * 1024) { avisar(t('apariencia.asistente.muyPesada'), 'error'); return; }
    try {
      const d = await cargarImagen(archivo);
      const f = detectarFondo(d);
      const limpio = recortar(f.tipo === 'color' ? quitarFondo(d, f.color, 48) : d);
      const inf = analizarContenido(limpio);
      const unColor = inf.saturacion < 0.22;
      const enClaro = visibleSobre(limpio, '#ffffff'); const enOscuro = visibleSobre(limpio, colorMenu);   // 0 a 1
      const sep = separar(limpio); const sim = sep?.simbolo;
      setOrig(d); setNombreArchivo(archivo.name);
      setOp({
        quitar: f.tipo === 'color', tolerancia: 48, recortar: true, horizontal: sep?.orientacion === 'vertical',
        claro: enClaro >= 0.75 ? 'original' : unColor ? 'negro' : 'placa',
        oscuro: enOscuro >= 0.75 ? 'original' : unColor ? 'blanco' : 'placa',
        iconoFuente: sim ? 'simbolo' : 'logo',
        iconoFondo: enClaro >= 0.75 && enOscuro >= 0.75 ? 'transparente' : inf.L < 0.4 ? 'blanco' : 'negro',
      });
    } catch (e) { avisar(e.message, 'error'); }
  }

  // Las 3 versiones como lienzos
  const lienzos = useMemo(() => {
    if (!base || !op) return null;
    const claro = op.claro === 'negro' ? componerLogo(monocromo(base, OSCURO_TXT)) : op.claro === 'placa' ? componerLogo(base, { placa: OSCURO_TXT }) : componerLogo(base);
    const oscuro = op.oscuro === 'blanco' ? componerLogo(monocromo(base, '#ffffff')) : op.oscuro === 'placa' ? componerLogo(base, { placa: '#ffffff' }) : componerLogo(base);
    const fuenteIcono = op.iconoFuente === 'simbolo' && simbolo ? simbolo : base;
    const fondoIcono = { transparente: null, blanco: '#ffffff', negro: OSCURO_TXT, marca: colorMarca }[op.iconoFondo];
    // Si el dibujo no se ve sobre el fondo del ícono, se pasa a blanco o negro
    let dibujo = fuenteIcono;
    if (fondoIcono) { const c = seVe(analizarContenido(fuenteIcono), fondoIcono); if (c < 2.2) dibujo = monocromo(fuenteIcono, seVe({ L: 1 }, fondoIcono) >= 3 ? '#ffffff' : OSCURO_TXT); }
    return { claro, oscuro, icono: componerIcono(dibujo, fondoIcono) };
  }, [base, op, simbolo, colorMarca]);
  const vistas = useMemo(() => (lienzos ? { claro: lienzos.claro.toDataURL(), oscuro: lienzos.oscuro.toDataURL(), icono: lienzos.icono.toDataURL() } : null), [lienzos]);

  const notas = [];
  if (fondo && op) {
    if (fondo.tipo === 'color') notas.push(op.quitar ? { ok: true, t: t('apariencia.asistente.fondoQuitado'), color: fondo.color } : { ok: false, t: t('apariencia.asistente.fondoConservado'), color: fondo.color });
    if (fondo.tipo === 'transparente') notas.push({ ok: true, t: t('apariencia.asistente.yaSinFondo') });
    if (fondo.tipo === 'mixto') notas.push({ ok: false, t: t('apariencia.asistente.fondoMixto') });
    if (op.recortar && limpio && (limpio.width < orig.width * 0.9 || limpio.height < orig.height * 0.9)) notas.push({ ok: true, t: t('apariencia.asistente.recortado', { a: `${orig.width}×${orig.height}`, b: `${limpio.width}×${limpio.height}` }) });
    if (op.oscuro !== 'original') notas.push({ ok: true, t: t(op.oscuro === 'blanco' ? 'apariencia.asistente.oscuroBlanco' : 'apariencia.asistente.oscuroPlaca') });
    if (op.claro !== 'original') notas.push({ ok: true, t: t(op.claro === 'negro' ? 'apariencia.asistente.claroNegro' : 'apariencia.asistente.claroPlaca') });
    if (op.horizontal && partes?.orientacion === 'vertical') notas.push({ ok: true, t: t('apariencia.asistente.acomodado') });
    if (simbolo && op.iconoFuente === 'simbolo') notas.push({ ok: true, t: t('apariencia.asistente.simbolo') });
  }
  // Qué parte del logo se distingue en cada fondo (con placa, blanco o negro siempre se ve)
  const vistoClaro = !base ? 0 : op?.claro === 'original' ? visibleSobre(base, '#ffffff') : 1;
  const vistoOscuro = !base ? 0 : op?.oscuro === 'original' ? visibleSobre(base, colorMenu) : 1;

  async function guardar() {
    setGuardando(true);
    try {
      let m = null;
      m = await api.put('/marca/imagen/logo', { imagen: aPng(lienzos.claro) });
      m = await api.put('/marca/imagen/logo_oscuro', { imagen: aPng(lienzos.oscuro) });
      m = await api.put('/marca/imagen/icono', { imagen: aPng(lienzos.icono, 512) });
      setMarca(m); avisar(t('apariencia.asistente.listo')); onCerrar();
    } catch (e) { avisar(e.message, 'error'); } finally { setGuardando(false); }
  }

  const poner = (k, v) => setOp((o) => ({ ...o, [k]: v }));

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo={t('apariencia.asistente.titulo')} subtitulo={nombreArchivo || t('apariencia.asistente.subtitulo')} ancho="max-w-5xl"
      pie={orig && <>
        <Boton variante="fantasma" icono={Upload} onClick={() => ref.current?.click()}>{t('apariencia.asistente.otra')}</Boton>
        <Boton onClick={guardar} cargando={guardando} icono={CheckCircle2}>{t('apariencia.asistente.usar')}</Boton>
      </>}>
      <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={(e) => { elegir(e.target.files?.[0]); e.target.value = ''; }} />
      {!orig ? (
        <button onClick={() => ref.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }} onDragLeave={() => setArrastrando(false)}
          onDrop={(e) => { e.preventDefault(); setArrastrando(false); elegir(e.dataTransfer.files?.[0]); }}
          className={cx('w-full rounded-[12px] border-2 border-dashed p-10 text-center cursor-pointer transition-colors', arrastrando ? 'border-action bg-action/8' : 'border-line-strong hover:border-action')}>
          <ImagePlus className="size-10 mx-auto text-action" />
          <div className="font-semibold mt-3">{t('apariencia.asistente.arrastra')}</div>
          <p className="text-sm text-muted mt-1 max-w-md mx-auto">{t('apariencia.asistente.explica')}</p>
          <p className="text-[12px] text-muted mt-3">PNG · JPG · WEBP · SVG</p>
        </button>
      ) : op && vistas && (
        <div className="grid lg:grid-cols-[290px_minmax(0,1fr)] gap-6">
          <div className="space-y-5">
            <div className="rounded-[10px] bg-inset p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-[13px] font-semibold"><Sparkles className="size-4 text-action" />{t('apariencia.asistente.loQueHicimos')}</div>
              {notas.map((n, i) => (
                <div key={i} className="flex items-start gap-2 text-[13px]">
                  {n.ok ? <CheckCircle2 className="size-4 text-ok shrink-0 mt-0.5" /> : <AlertTriangle className="size-4 text-warn shrink-0 mt-0.5" />}
                  <span>{n.color && <span className="inline-block size-3 rounded-sm align-middle mr-1 ring-1 ring-black/20" style={{ background: n.color }} />}{n.t}</span>
                </div>
              ))}
            </div>

            {fondo?.tipo === 'color' && (
              <Grupo titulo={t('apariencia.asistente.fondo')}>
                <Interruptor valor={op.quitar} onCambio={(v) => poner('quitar', v)} texto={t('apariencia.asistente.quitarFondo')} />
                {op.quitar && (
                  <label className="block mt-3 text-[12px] text-muted">{t('apariencia.asistente.tolerancia')}
                    <input type="range" min="12" max="120" value={op.tolerancia} onChange={(e) => poner('tolerancia', Number(e.target.value))} className="w-full accent-[var(--action)]" />
                  </label>
                )}
              </Grupo>
            )}
            <Grupo titulo={t('apariencia.asistente.espacio')}>
              <Interruptor valor={op.recortar} onCambio={(v) => poner('recortar', v)} texto={t('apariencia.asistente.recortar')} />
              {partes?.orientacion === 'vertical' && <div className="mt-3"><Interruptor valor={op.horizontal} onCambio={(v) => poner('horizontal', v)} texto={t('apariencia.asistente.horizontal')} /></div>}
            </Grupo>
            <Grupo titulo={t('apariencia.asistente.enOscuro')}>
              <Opcion valor={op.oscuro} onCambio={(v) => poner('oscuro', v)} opciones={[['original', t('apariencia.asistente.original')], ['blanco', t('apariencia.asistente.blanco')], ['placa', t('apariencia.asistente.placaClara')]]} />
            </Grupo>
            <Grupo titulo={t('apariencia.asistente.enClaro')}>
              <Opcion valor={op.claro} onCambio={(v) => poner('claro', v)} opciones={[['original', t('apariencia.asistente.original')], ['negro', t('apariencia.asistente.negro')], ['placa', t('apariencia.asistente.placaOscura')]]} />
            </Grupo>
            <Grupo titulo={t('apariencia.icono')}>
              {simbolo && <Opcion valor={op.iconoFuente} onCambio={(v) => poner('iconoFuente', v)} opciones={[['simbolo', t('apariencia.asistente.soloSimbolo')], ['logo', t('apariencia.asistente.logoCompleto')]]} />}
              <div className="flex gap-2 mt-2">
                {[['transparente', null], ['blanco', '#ffffff'], ['negro', OSCURO_TXT], ['marca', colorMarca]].map(([k, c]) => (
                  <button key={k} onClick={() => poner('iconoFondo', k)} aria-pressed={op.iconoFondo === k} title={t(`apariencia.asistente.fondo_${k}`)}
                    className={cx('size-9 rounded-md border-2 cursor-pointer', op.iconoFondo === k ? 'border-action' : 'border-line')}
                    style={{ background: c || 'repeating-conic-gradient(#cbd5e1 0 25%, #fff 0 50%) 0 0/12px 12px' }} />
                ))}
              </div>
            </Grupo>
          </div>

          <div className="space-y-4 min-w-0">
            <Vista titulo={t('apariencia.asistente.vistaMenu')} visible={vistoOscuro}>
              <div className="rounded-[10px] p-4 flex gap-4" style={{ background: colorMenu }}>
                <div className="w-48 space-y-2">
                  <img src={vistas.oscuro} alt="" className="h-9 max-w-full object-contain object-left" />
                  <div className="h-7 rounded-full mt-3" style={{ background: colorMarca }} />
                  <div className="h-2 w-24 rounded-full bg-white/20" /><div className="h-2 w-20 rounded-full bg-white/20" />
                </div>
                <div className="flex-1 grid place-items-center"><img src={vistas.oscuro} alt="" className="max-h-20 max-w-[90%] object-contain" /></div>
              </div>
            </Vista>
            <Vista titulo={t('apariencia.asistente.vistaClaro')} visible={vistoClaro}>
              <div className="rounded-[10px] p-4 bg-white text-[#0b1b33] flex items-center gap-5 border border-black/10">
                <img src={vistas.claro} alt="" className="h-12 max-w-[45%] object-contain object-left" />
                <div className="flex-1 text-[12px] text-black/55 border-l border-dashed border-black/20 pl-4">
                  <div className="font-mono font-semibold text-black/80">CENT-R26-000012</div>
                  <div>{marca.nombre} · Sucursal Centro</div>
                </div>
              </div>
            </Vista>
            <Vista titulo={t('apariencia.asistente.vistaIcono')}>
              <div className="flex flex-wrap items-end gap-5">
                <Tile src={vistas.icono} fondo="#ffffff" tam="size-20" etiqueta={t('apariencia.claro')} />
                <Tile src={vistas.icono} fondo={colorMenu} tam="size-20" etiqueta={t('apariencia.oscuro')} />
                <Tile src={vistas.icono} fondo="#e5e7eb" tam="size-12" redondo etiqueta={t('apariencia.asistente.celular')} />
                <div className="flex items-center gap-2 h-9 rounded-t-lg bg-[#dfe3ea] px-3 text-[12px] text-[#1f2937]">
                  <img src={vistas.icono} alt="" className="size-4 object-contain" />{marca.nombre}
                </div>
              </div>
            </Vista>
          </div>
        </div>
      )}
    </Modal>
  );
}

function Grupo({ titulo, children }) {
  return <div><div className="etiqueta mb-2">{titulo}</div>{children}</div>;
}
function Interruptor({ valor, onCambio, texto }) {
  return (
    <button role="switch" aria-checked={valor} onClick={() => onCambio(!valor)} className="flex items-center gap-3 text-sm text-left cursor-pointer">
      <span className={cx('relative shrink-0 w-10 h-6 rounded-full transition-colors', valor ? 'bg-action' : 'bg-line-strong')}>
        <span className={cx('absolute top-0.5 size-5 rounded-full bg-white shadow transition-all', valor ? 'left-[18px]' : 'left-0.5')} />
      </span>{texto}
    </button>
  );
}
function Opcion({ valor, onCambio, opciones }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-[10px] bg-inset p-1">
      {opciones.map(([v, texto]) => (
        <button key={v} onClick={() => onCambio(v)} aria-pressed={valor === v}
          className={cx('flex-1 h-8 px-2 rounded-md text-[13px] font-semibold cursor-pointer whitespace-nowrap', valor === v ? 'bg-action text-on-action' : 'text-soft hover:text-text')}>{texto}</button>
      ))}
    </div>
  );
}
function Vista({ titulo, visible, children }) {
  const { t } = useTranslation();
  const bien = visible === undefined || visible >= 0.75;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="etiqueta">{titulo}</span>
        {visible !== undefined && (
          <span className={cx('text-[12px] font-semibold inline-flex items-center gap-1', bien ? 'text-ok' : 'text-warn')}>
            {bien ? <CheckCircle2 className="size-3.5" /> : <AlertTriangle className="size-3.5" />}{bien ? t('apariencia.asistente.seVeBien') : t('apariencia.asistente.seVePoco')}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
function Tile({ src, fondo, tam, redondo, etiqueta }) {
  return (
    <div className="text-center">
      <div className="p-2 rounded-lg inline-block" style={{ background: fondo }}><img src={src} alt="" className={cx(tam, redondo ? 'rounded-[22%]' : 'rounded-md', 'object-contain')} /></div>
      <div className="text-[11px] text-muted mt-1">{etiqueta}</div>
    </div>
  );
}
