import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, CheckCircle2, AlertTriangle, Home, ImagePlus, Paintbrush, Trash2, Users, Wallet, XCircle } from 'lucide-react';
import { api } from '../api';
import { useSesion } from '../auth/Sesion';
import { useMarca } from '../marca/Marca';
import { TEMAS, base, estiloVista, variables } from '../marca/temas';
import { FUENTES, fuenteDe } from '../marca/fuentes';
import { IDIOMAS } from '../i18n';
import { Boton, Campo, Encabezado, Isotipo, Selector, Tarjeta, Vacio, useAvisos } from '../ui';

// Configuración → Apariencia y marca. Lo que se edita se ve al instante en todo el panel (vista previa);
// se guarda con "Guardar cambios". Los logos se guardan en cuanto se suben.

const cx = (...c) => c.filter(Boolean).join(' ');
const CAMPOS = ['nombre', 'lema', 'tema', 'color_primario', 'color_fondo', 'fuente', 'idioma', 'moneda', 'zona_horaria', 'pais'];
const MONEDAS = ['MXN', 'USD', 'EUR', 'CAD', 'COP', 'ARS', 'CLP', 'PEN', 'GTQ'];
const PAISES = ['MX', 'US', 'CA', 'ES', 'CO', 'AR', 'CL', 'PE', 'GT', 'CR', 'DO', 'EC', 'PA', 'UY', 'BO', 'PY', 'SV', 'HN', 'NI', 'PR', 'BR', 'GB'];
const ZONAS_BASE = ['America/Mexico_City', 'America/Monterrey', 'America/Cancun', 'America/Chihuahua', 'America/Hermosillo', 'America/Mazatlan', 'America/Tijuana',
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Phoenix', 'America/Los_Angeles', 'America/Toronto', 'America/Bogota', 'America/Lima',
  'America/Santiago', 'America/Argentina/Buenos_Aires', 'America/Guatemala', 'America/Costa_Rica', 'America/Santo_Domingo', 'Europe/Madrid', 'Europe/London'];

export default function Apariencia() {
  const { tiene } = useSesion();
  const { guardada, setMarca, setBorrador } = useMarca();
  const { t, i18n } = useTranslation();
  const avisar = useAvisos();
  const [f, setF] = useState(() => Object.fromEntries(CAMPOS.map((k) => [k, guardada[k] ?? ''])));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState({});

  const cambios = useMemo(() => {
    const c = {};
    CAMPOS.forEach((k) => { const v = f[k] === '' ? null : f[k]; if ((guardada[k] ?? null) !== v) c[k] = v; });
    return c;
  }, [f, guardada]);
  const sucio = Object.keys(cambios).length > 0;

  // Vista previa en vivo en todo el panel; al salir de la pantalla sin guardar, se descarta
  useEffect(() => { setBorrador(sucio ? cambios : null); }, [cambios, sucio, setBorrador]);
  useEffect(() => () => setBorrador(null), [setBorrador]);

  if (!tiene('marca.editar')) return <Tarjeta><Vacio titulo={t('apariencia.titulo')} texto="Solo la dirección general puede cambiar la marca." /></Tarjeta>;

  const poner = (k) => (e) => setF((x) => ({ ...x, [k]: e?.target ? e.target.value : e }));
  const elegirTema = (tema) => setF((x) => ({
    ...x, tema,
    color_primario: tema === 'personalizado' ? (x.color_primario || base({ ...guardada, ...x, tema: x.tema === 'personalizado' ? 'oceano' : x.tema }).accion) : x.color_primario,
  }));

  async function guardar() {
    setGuardando(true); setError({});
    try {
      const m = await api.put('/marca', cambios);
      setMarca(m); setBorrador(null);
      setF(Object.fromEntries(CAMPOS.map((k) => [k, m[k] ?? ''])));
      avisar(t('apariencia.listo'));
    } catch (e) {
      if (e.detalle?.campo) setError({ [e.detalle.campo]: e.message });
      avisar(e.message, 'error');
    } finally { setGuardando(false); }
  }
  const descartar = () => setF(Object.fromEntries(CAMPOS.map((k) => [k, guardada[k] ?? ''])));

  const marcaVista = { ...guardada, ...Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v === '' ? null : v])) };
  const vars = variables(marcaVista);
  const fuente = fuenteDe(marcaVista.fuente);
  const nombrePais = (c) => { try { return new Intl.DisplayNames([i18n.language], { type: 'region' }).of(c); } catch { return c; } };
  const nombreMoneda = (c) => { try { return new Intl.DisplayNames([i18n.language], { type: 'currency' }).of(c); } catch { return c; } };
  const zonas = [...new Set([...ZONAS_BASE, guardada.zona_horaria].filter(Boolean))];

  return (
    <>
      <Encabezado ruta={t('comun.sistema')} titulo={t('apariencia.titulo')} descripcion={t('apariencia.descripcion')} />
      <div className="grid xl:grid-cols-[minmax(0,1fr)_400px] gap-5 items-start pb-24">
        <div className="space-y-5 min-w-0">
          <Tarjeta titulo={t('apariencia.identidad')}>
            <div className="grid md:grid-cols-2 gap-4">
              <Campo etiqueta={t('apariencia.nombre')} value={f.nombre} onChange={poner('nombre')} maxLength={80} ayuda={t('apariencia.nombreAyuda')} error={error.nombre} />
              <Campo etiqueta={t('apariencia.lema')} value={f.lema || ''} onChange={poner('lema')} maxLength={120} placeholder={t('apariencia.lemaEjemplo')} error={error.lema} />
            </div>
          </Tarjeta>

          <Tarjeta titulo={t('apariencia.logos')} subtitulo={t('apariencia.formatos')}>
            <div className="grid md:grid-cols-3 gap-4">
              <Imagen tipo="logo" titulo={t('apariencia.logo')} ayuda={t('apariencia.logoAyuda')} fondo="#ffffff" />
              <Imagen tipo="logo_oscuro" titulo={t('apariencia.logoOscuro')} ayuda={t('apariencia.logoOscuroAyuda')} fondo={vars.fondoBarra} />
              <Imagen tipo="icono" titulo={t('apariencia.icono')} ayuda={t('apariencia.iconoAyuda')} fondo="var(--inset)" cuadrado />
            </div>
          </Tarjeta>

          <Tarjeta titulo={t('apariencia.colores')} subtitulo={t('apariencia.temasListos')}>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {Object.entries(TEMAS).map(([k, tema]) => (
                <TarjetaTema key={k} activo={f.tema === k} onClick={() => elegirTema(k)} nombre={tema.nombre} descripcion={tema.descripcion} b={tema} />
              ))}
              <TarjetaTema activo={f.tema === 'personalizado'} onClick={() => elegirTema('personalizado')} nombre={t('apariencia.personalizado')}
                descripcion={t('apariencia.personalizadoDesc')} b={base({ ...marcaVista, tema: 'personalizado' })} icono={Paintbrush} />
            </div>
            {f.tema === 'personalizado' && (
              <div className="grid md:grid-cols-2 gap-4 mt-5 anim-entrar">
                <SelectorColor etiqueta={t('apariencia.colorPrincipal')} ayuda={t('apariencia.colorPrincipalAyuda')} valor={f.color_primario || '#34e8bb'} onCambio={poner('color_primario')} error={error.color_primario} />
                <SelectorColor etiqueta={t('apariencia.colorFondo')} ayuda={t('apariencia.colorFondoAyuda')} valor={f.color_fondo || base(marcaVista).menu} onCambio={poner('color_fondo')} error={error.color_fondo} />
              </div>
            )}
            <div className="mt-5 rounded-[10px] border border-line p-4">
              <div className="text-[13px] font-semibold">{t('apariencia.contraste')}</div>
              <p className="text-[12px] text-muted mt-0.5">{t('apariencia.contrasteAyuda')}</p>
              <div className="grid sm:grid-cols-3 gap-2 mt-3">
                <Contraste etiqueta={t('apariencia.textoBotones')} valor={vars.revision.boton} minimo={3} />
                <Contraste etiqueta={t('apariencia.enlacesClaro')} valor={vars.revision.enlaceClaro} />
                <Contraste etiqueta={t('apariencia.enlacesOscuro')} valor={vars.revision.enlaceOscuro} />
              </div>
            </div>
          </Tarjeta>

          <Tarjeta titulo={t('apariencia.letra')}>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {Object.entries(FUENTES).map(([k, ft]) => (
                <button key={k} onClick={() => poner('fuente')(k)} aria-pressed={f.fuente === k}
                  className={cx('relative text-left rounded-[10px] border p-4 cursor-pointer transition-colors', f.fuente === k ? 'border-action bg-action/8' : 'border-line hover:border-line-strong')}>
                  {f.fuente === k && <Check className="absolute top-3 right-3 size-4 text-action" />}
                  <div className="text-[30px] leading-none" style={{ fontFamily: ft.titulos, fontWeight: ft.peso }}>Aa</div>
                  <div className="font-semibold text-sm mt-2" style={{ fontFamily: ft.cuerpo }}>{ft.nombre}</div>
                  <div className="text-[12px] text-muted" style={{ fontFamily: ft.cuerpo }}>{ft.estilo}</div>
                  <div className="text-[12px] text-soft mt-2 truncate" style={{ fontFamily: ft.cuerpo }}>{t('apariencia.ejemploLetra')}</div>
                </button>
              ))}
            </div>
          </Tarjeta>

          <Tarjeta titulo={t('apariencia.region')}>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Selector etiqueta={t('apariencia.idioma')} value={f.idioma} onChange={poner('idioma')}>
                  {IDIOMAS.map((l) => <option key={l} value={l}>{t(`idiomas.${l}`)}</option>)}
                </Selector>
                <p className="text-[12px] text-muted mt-1.5">{t('apariencia.idiomaAyuda')}</p>
              </div>
              <Selector etiqueta={t('apariencia.moneda')} value={f.moneda} onChange={poner('moneda')}>
                {MONEDAS.map((m) => <option key={m} value={m}>{m} · {nombreMoneda(m)}</option>)}
              </Selector>
              <Selector etiqueta={t('apariencia.zona')} value={f.zona_horaria} onChange={poner('zona_horaria')}>
                {zonas.map((z) => <option key={z} value={z}>{z.replace(/_/g, ' ')}</option>)}
              </Selector>
              <Selector etiqueta={t('apariencia.pais')} value={f.pais} onChange={poner('pais')}>
                {PAISES.map((p) => <option key={p} value={p}>{nombrePais(p)}</option>)}
              </Selector>
            </div>
          </Tarjeta>
        </div>

        <aside className="xl:sticky xl:top-20 space-y-3">
          <div className="etiqueta">{t('apariencia.vistaPrevia')}</div>
          <MiniPanel vars={vars.claro} fuente={fuente} marca={marcaVista} modo="light" etiqueta={t('apariencia.claro')} />
          <MiniPanel vars={vars.oscuro} fuente={fuente} marca={marcaVista} modo="dark" etiqueta={t('apariencia.oscuro')} />
        </aside>
      </div>

      {sucio && (
        <div className="fixed bottom-0 inset-x-0 lg:left-64 z-40 border-t border-line bg-surface/95 backdrop-blur anim-entrar">
          <div className="max-w-[1280px] mx-auto px-4 lg:px-8 h-16 flex items-center gap-3">
            <span className="size-2 rounded-full bg-warn" />
            <span className="text-sm font-semibold flex-1">{t('apariencia.sinGuardar')}</span>
            <Boton variante="fantasma" onClick={descartar}>{t('comun.descartar')}</Boton>
            <Boton onClick={guardar} cargando={guardando}>{t('comun.guardarCambios')}</Boton>
          </div>
        </div>
      )}
    </>
  );
}

/** Cuadro de un tema: barra del menú, color de acción y fondos */
function TarjetaTema({ activo, onClick, nombre, descripcion, b, icono: Icono }) {
  return (
    <button onClick={onClick} aria-pressed={activo}
      className={cx('relative text-left rounded-[10px] border overflow-hidden cursor-pointer transition-colors', activo ? 'border-action ring-2 ring-action/30' : 'border-line hover:border-line-strong')}>
      <div className="flex h-16">
        <div className="w-1/4 p-2 space-y-1.5" style={{ background: b.menu }}>
          <div className="h-1.5 rounded-full bg-white/30" /><div className="h-1.5 rounded-full" style={{ background: b.accion }} /><div className="h-1.5 rounded-full bg-white/20" />
        </div>
        <div className="flex-1 p-2 flex flex-col justify-between" style={{ background: b.fondo[0] }}>
          <div className="h-5 rounded" style={{ background: b.fondo[1] }} />
          <div className="h-4 w-14 rounded-full self-end" style={{ background: b.accion }} />
        </div>
      </div>
      <div className="p-3">
        <div className="font-semibold text-sm flex items-center gap-1.5">{Icono && <Icono className="size-3.5 text-action" />}{nombre}</div>
        <div className="text-[12px] text-muted">{descripcion}</div>
      </div>
      {activo && <span className="absolute top-2 right-2 grid place-items-center size-6 rounded-full bg-action text-on-action"><Check className="size-3.5" strokeWidth={3} /></span>}
    </button>
  );
}

function SelectorColor({ etiqueta, ayuda, valor, onCambio, error }) {
  const [texto, setTexto] = useState(valor);
  useEffect(() => setTexto(valor), [valor]);
  return (
    <div>
      <label className="etiqueta block mb-1.5">{etiqueta}</label>
      <div className="flex items-center gap-2">
        <input type="color" value={valor} onChange={(e) => onCambio(e.target.value)} className="h-11 w-14 rounded-md border border-line bg-inset cursor-pointer p-1" aria-label={etiqueta} />
        <input value={texto} onChange={(e) => { setTexto(e.target.value); if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) onCambio(e.target.value.toLowerCase()); }}
          className={cx('h-11 w-32 rounded-md bg-inset border px-3 font-mono text-[15px] uppercase outline-none focus:border-action', error ? 'border-danger' : 'border-line')} maxLength={7} />
      </div>
      <p className={cx('text-[12px] mt-1.5', error ? 'text-danger' : 'text-muted')}>{error || ayuda}</p>
    </div>
  );
}

function Contraste({ etiqueta, valor, minimo = 4.5 }) {
  const { t } = useTranslation();
  const bien = valor >= minimo; const justo = !bien && valor >= 3;
  const I = bien ? CheckCircle2 : justo ? AlertTriangle : XCircle;
  return (
    <div className="flex items-center gap-2 rounded-md bg-inset px-3 py-2">
      <I className={cx('size-4 shrink-0', bien ? 'text-ok' : justo ? 'text-warn' : 'text-danger')} />
      <div className="min-w-0">
        <div className="text-[12px] text-muted truncate">{etiqueta}</div>
        <div className="text-[13px] font-semibold">{valor.toFixed(1)}:1 · {bien ? t('apariencia.seLee') : justo ? t('apariencia.justo') : t('apariencia.pocoLegible')}</div>
      </div>
    </div>
  );
}

/** Subir, cambiar o quitar un logo. Se guarda al momento */
function Imagen({ tipo, titulo, ayuda, fondo, cuadrado }) {
  const { guardada, setMarca } = useMarca();
  const { t } = useTranslation();
  const avisar = useAvisos();
  const ref = useRef(null);
  const [subiendo, setSubiendo] = useState(false);
  const url = guardada.imagenes?.[tipo];

  const elegir = (e) => {
    const archivo = e.target.files?.[0]; e.target.value = '';
    if (!archivo) return;
    if (archivo.size > 512 * 1024) { avisar('La imagen pesa más de 512 KB', 'error'); return; }
    const lector = new FileReader();
    lector.onload = async () => {
      setSubiendo(true);
      try { setMarca(await api.put(`/marca/imagen/${tipo}`, { imagen: lector.result })); avisar(t('apariencia.imagenGuardada')); }
      catch (err) { avisar(err.message, 'error'); } finally { setSubiendo(false); }
    };
    lector.readAsDataURL(archivo);
  };
  const quitar = async () => {
    try { setMarca(await api.del(`/marca/imagen/${tipo}`)); } catch (err) { avisar(err.message, 'error'); }
  };

  return (
    <div className="rounded-[10px] border border-line p-3 flex flex-col">
      <div className={cx('grid place-items-center rounded-md border border-line overflow-hidden', cuadrado ? 'h-28' : 'h-28')} style={{ background: fondo }}>
        {url ? <img src={url} alt={titulo} className={cx('object-contain', cuadrado ? 'size-20 rounded-lg' : 'max-h-16 max-w-[85%]')} />
          : <span className={tipo === 'logo' ? 'text-[#0b1b33]' : 'text-white'}><Isotipo className="size-12 opacity-40" /></span>}
      </div>
      <div className="font-semibold text-sm mt-3">{titulo}</div>
      <p className="text-[12px] text-muted flex-1">{ayuda}</p>
      <div className="flex gap-2 mt-3">
        <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={elegir} className="hidden" />
        <Boton variante="secundario" tam="sm" icono={ImagePlus} cargando={subiendo} onClick={() => ref.current?.click()}>{url ? t('apariencia.cambiar') : t('apariencia.subir')}</Boton>
        {url && <Boton variante="fantasma" tam="sm" icono={Trash2} onClick={quitar}>{t('comun.quitar')}</Boton>}
      </div>
    </div>
  );
}

/** Panel en miniatura con los colores y la letra que se están eligiendo */
function MiniPanel({ vars, fuente, marca, modo, etiqueta }) {
  const { t } = useTranslation();
  const im = marca.imagenes || {};
  const logoMenu = im.logo_oscuro || im.logo;
  return (
    <div className="rounded-[12px] border border-line overflow-hidden shadow-xl" style={estiloVista(vars, fuente)}>
      <div className="flex h-[230px] text-[11px]" style={{ background: 'var(--canvas)', color: 'var(--text)' }}>
        <div className="w-[34%] p-2.5 space-y-1 text-white" style={{ background: 'var(--sidebar)' }}>
          <div className="flex items-center gap-1.5 h-7 mb-2 min-w-0">
            {logoMenu ? <img src={logoMenu} alt="" className="h-6 max-w-full object-contain" />
              : <>{im.icono ? <img src={im.icono} alt="" className="size-5 rounded object-contain" /> : <Isotipo className="size-5" />}<span className="font-semibold truncate">{marca.nombre}</span></>}
          </div>
          <div className="flex items-center gap-1.5 h-6 px-2 rounded-full text-white/70"><Home className="size-3" />{t('menu.inicio')}</div>
          <div className="flex items-center gap-1.5 h-6 px-2 rounded-full font-semibold" style={{ background: 'var(--action)', color: 'var(--on-action)' }}><Users className="size-3" />{t('apariencia.ejemplo.alumnos')}</div>
          <div className="flex items-center gap-1.5 h-6 px-2 rounded-full text-white/70"><Wallet className="size-3" />{t('menu.caja')}</div>
        </div>
        <div className="flex-1 p-3 min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--muted)' }}>{etiqueta}</span>
          </div>
          <div className="text-[19px] mt-1" style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 'var(--peso-titulos)' }}>{t('apariencia.ejemplo.alumnos')}</div>
          <div className="mt-2 rounded-md border p-2" style={{ background: 'var(--surface)', borderColor: 'var(--line)' }}>
            <div className="h-6 rounded border px-2 flex items-center" style={{ background: 'var(--inset)', borderColor: 'var(--line)', color: 'var(--muted)' }}>{t('apariencia.ejemplo.buscar')}</div>
            <div className="flex items-center justify-between mt-2 gap-2">
              <div className="min-w-0">
                <div className="font-semibold truncate" style={{ color: 'var(--link)' }}>{t('apariencia.ejemplo.alumno')}</div>
                <div style={{ color: 'var(--muted)' }}>{t('apariencia.ejemplo.grado')}</div>
              </div>
              <span className="rounded-full px-2 py-0.5 font-semibold whitespace-nowrap" style={{ background: 'var(--ok-bg)', color: 'var(--ok)' }}>{t('apariencia.ejemplo.alDia')}</span>
            </div>
          </div>
          <div className="flex justify-end mt-3">
            <span className="rounded-full px-3 py-1.5 font-semibold" style={{ background: 'var(--action)', color: 'var(--on-action)' }}>{t('apariencia.ejemplo.cobrar')}</span>
          </div>
        </div>
      </div>
      <span className="sr-only">{modo}</span>
    </div>
  );
}
