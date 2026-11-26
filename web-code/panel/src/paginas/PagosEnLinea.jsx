import { useEffect, useState } from 'react';
import { Check, CircleOff, Copy, CreditCard, ExternalLink, FlaskConical, KeyRound, Link2, PlugZap, ShieldCheck, TriangleAlert } from 'lucide-react';
import { api, formato } from '../api';
import { Boton, Campo, Cargando, Chip, Encabezado, ErrorCaja, Tarjeta, useAvisos, useDatos } from '../ui';

// Configuración → Pagos en línea: conectar la cuenta de Mercado Pago de la empresa.
// Las llaves se guardan cifradas en la base y nunca se vuelven a mostrar; no hay que tocar el .env.

const cx = (...c) => c.filter(Boolean).join(' ');
const MODOS = [
  ['apagado', CircleOff, 'Apagado', 'En la app solo dice "paga en recepción".'],
  ['prueba', FlaskConical, 'Modo prueba', 'Se simula el pago dentro del sistema. No se cobra nada: sirve para enseñar y probar.'],
  ['real', CreditCard, 'Cobrar con Mercado Pago', 'Tarjeta, OXXO, SPEI y saldo de Mercado Pago. El dinero llega a tu cuenta de Mercado Pago.'],
];

export default function PagosEnLinea() {
  const avisar = useAvisos();
  const datos = useDatos(() => api.get('/pasarela'), []);
  const d = datos.datos;
  const [f, setF] = useState({ public_key: '', access_token: '', webhook_secret: '', url_publica: '' });
  const [err, setErr] = useState({}); const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(''); const [prueba, setPrueba] = useState(null);
  useEffect(() => { if (d) setF((x) => ({ ...x, public_key: d.public_key || '', url_publica: d.url_publica || '' })); }, [d]);

  async function guardar(cuerpo, que) {
    setGuardando(que); setErr({}); setError(null);
    try { await api.put('/pasarela', cuerpo); avisar('Guardado'); setF((x) => ({ ...x, access_token: '', webhook_secret: '' })); datos.recargar(); }
    catch (ex) { if (ex.detalle?.campo) setErr({ [ex.detalle.campo]: ex.message }); else setError(ex); }
    finally { setGuardando(''); }
  }
  const guardarLlaves = () => {
    const c = { public_key: f.public_key, url_publica: f.url_publica };
    if (f.access_token) c.access_token = f.access_token;
    if (f.webhook_secret) c.webhook_secret = f.webhook_secret;
    guardar(c, 'llaves');
  };
  async function probar() {
    setGuardando('probar'); setPrueba(null);
    try { setPrueba({ ok: true, ...(await api.post('/pasarela/probar')) }); } catch (ex) { setPrueba({ ok: false, mensaje: ex.message }); } finally { setGuardando(''); }
  }
  const copiar = async (t) => { try { await navigator.clipboard.writeText(t); avisar('Copiado'); } catch { /* nada */ } };

  if (datos.cargando && !d) return <Cargando />;
  return (
    <>
      <Encabezado ruta="Configuración" titulo="Pagos en línea"
        descripcion="Que los papás paguen desde la app con tarjeta, OXXO o SPEI. Cada pago llega con su recibo y aparece en el corte de caja como “En línea”." />
      <ErrorCaja error={datos.error} reintentar={datos.recargar} />
      {d && (
        <div className="space-y-4">
          <Tarjeta titulo="¿Cómo cobra la app?" icono={PlugZap}
            acciones={Number(d.pagos_hoy?.n) > 0 && <Chip tono="ok">Hoy: {d.pagos_hoy.n} pago{d.pagos_hoy.n === '1' ? '' : 's'} · {formato.dinero(d.pagos_hoy.total)}</Chip>}>
            <div className="grid md:grid-cols-3 gap-3">
              {MODOS.map(([k, I, t, s]) => (
                <button key={k} onClick={() => guardar({ modo: k }, 'modo')} disabled={!!guardando} aria-pressed={d.modo === k}
                  className={cx('text-left rounded-[12px] border p-4 cursor-pointer transition-colors', d.modo === k ? 'border-action bg-action/8' : 'border-line hover:border-line-strong')}>
                  <div className="flex items-center gap-2 font-semibold"><I className="size-5 text-action" />{t}{d.modo === k && <Check className="size-4 ml-auto text-action" />}</div>
                  <p className="text-[13px] text-muted mt-1.5">{s}</p>
                </button>
              ))}
            </div>
            {err.access_token && !f.access_token && <p className="text-[13px] text-danger mt-3">{err.access_token}</p>}
            {d.modo === 'real' && d.token_de_prueba && <p className="text-[13px] text-warn mt-3 flex items-center gap-1.5"><TriangleAlert className="size-4" />El Access Token es de prueba (TEST-): los pagos no son reales.</p>}
          </Tarjeta>

          <div className="grid lg:grid-cols-[1fr_380px] gap-4 items-start">
            <Tarjeta titulo="Tu cuenta de Mercado Pago" icono={KeyRound} subtitulo="Las llaves se guardan cifradas y no se vuelven a mostrar">
              <div className="space-y-4">
                <Campo etiqueta="Access Token" type="password" value={f.access_token} onChange={(e) => setF({ ...f, access_token: e.target.value })} error={err.access_token} autoComplete="off"
                  placeholder={d.tiene_token ? `Guardado (termina en ${d.token_final}). Escribe otro solo para cambiarlo.` : 'APP_USR-...'}
                  ayuda={d.token_ilegible ? 'No se pudo leer el que estaba guardado (cambió la llave del servidor): vuelve a pegarlo.' : 'Credenciales de producción → Access Token.'} />
                <Campo etiqueta="Public Key" value={f.public_key} onChange={(e) => setF({ ...f, public_key: e.target.value })} error={err.public_key} placeholder="APP_USR-..." autoComplete="off" />
                <Campo etiqueta="Dirección pública del sistema" value={f.url_publica} onChange={(e) => setF({ ...f, url_publica: e.target.value })} error={err.url_publica} placeholder="https://midojo.com"
                  ayuda="Con https, al terminar de pagar regresan solos a la app y Mercado Pago avisa al instante. Sin ella también funciona: la app pregunta al volver." />
                <Campo etiqueta="Clave secreta de los avisos (webhooks)" type="password" value={f.webhook_secret} onChange={(e) => setF({ ...f, webhook_secret: e.target.value })} error={err.webhook_secret} autoComplete="off"
                  placeholder={d.tiene_secreto ? 'Guardada. Escribe otra solo para cambiarla.' : 'La que te da Mercado Pago al configurar los avisos'} />
                {d.url_aviso && (
                  <div className="rounded-md bg-inset px-3 py-2.5 text-[13px]">
                    <div className="etiqueta mb-1">URL para los avisos (pégala en Mercado Pago)</div>
                    <div className="flex items-center gap-2"><code className="flex-1 break-all">{d.url_aviso}</code><button onClick={() => copiar(d.url_aviso)} className="text-muted hover:text-text cursor-pointer" aria-label="Copiar"><Copy className="size-4" /></button></div>
                    {!d.https && <p className="text-warn mt-1.5">Mercado Pago solo manda avisos a direcciones https.</p>}
                  </div>
                )}
                <ErrorCaja error={error} />
                <div className="flex flex-wrap gap-2">
                  <Boton icono={ShieldCheck} cargando={guardando === 'llaves'} onClick={guardarLlaves}>Guardar</Boton>
                  <Boton variante="secundario" icono={Link2} cargando={guardando === 'probar'} onClick={probar} disabled={!d.tiene_token}>Probar conexión</Boton>
                </div>
                {prueba && (prueba.ok
                  ? <p className="text-[14px] text-ok flex items-center gap-1.5"><Check className="size-4" />Conectado a la cuenta {prueba.cuenta}{prueba.correo ? ` (${prueba.correo})` : ''}.{prueba.aviso && <span className="text-warn"> {prueba.aviso}</span>}</p>
                  : <p className="text-[14px] text-danger">{prueba.mensaje}</p>)}
              </div>
            </Tarjeta>

            <Tarjeta titulo="Cómo conectar Mercado Pago">
              <ol className="text-[14px] space-y-2.5 list-decimal pl-5 text-soft">
                <li>Entra a <a href="https://www.mercadopago.com.mx/developers/panel/app" target="_blank" rel="noreferrer" className="text-action hover:underline inline-flex items-center gap-1">Tus integraciones <ExternalLink className="size-3" /></a> con la cuenta de la empresa y crea una aplicación (tipo “Pagos online”, Checkout Pro).</li>
                <li>En <b>Credenciales de producción</b> copia el <b>Access Token</b> y la <b>Public Key</b> y pégalos aquí.</li>
                <li>Si el sistema ya tiene dirección con https, en <b>Webhooks</b> pega la URL de avisos, marca el evento <b>Pagos</b> y copia aquí la clave secreta.</li>
                <li>Toca <b>Probar conexión</b>. Para practicar sin cobrar usa primero el <b>Modo prueba</b> (o credenciales de prueba de Mercado Pago).</li>
                <li>Cuando todo esté bien, elige <b>Cobrar con Mercado Pago</b>.</li>
              </ol>
              <p className="text-[12px] text-muted mt-3">Mercado Pago cobra su comisión por cada pago; el dinero llega a tu cuenta de Mercado Pago y de ahí lo pasas a tu banco.</p>
            </Tarjeta>
          </div>
        </div>
      )}
    </>
  );
}
