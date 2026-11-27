import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, Plus, Power, Tablet, Wifi, WifiOff } from 'lucide-react';
import { api } from '../api';
import { Boton, Campo, Cargando, Chip, Encabezado, ErrorCaja, Modal, Selector, Tarjeta, Vacio, useAvisos, useConfirmar, useDatos } from '../ui';

// Tabletas de asistencia: se conectan con un código (sin correo ni contraseña) y se desconectan desde aquí.

const cx = (...c) => c.filter(Boolean).join(' ');
const haceCuanto = (f) => {
  if (!f) return 'Todavía no se usa';
  const min = Math.round((Date.now() - new Date(f.replace(' ', 'T')).getTime()) / 60000);
  if (min < 2) return 'Ahora mismo'; if (min < 60) return `Hace ${min} min`;
  const h = Math.round(min / 60); if (h < 24) return `Hace ${h} h`;
  return new Date(f.replace(' ', 'T')).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
};

function Conectar({ abierto, onCerrar, sucursales, onListo }) {
  const [f, setF] = useState({ codigo: '', nombre: '', sucursal_id: '' });
  const [err, setErr] = useState({}); const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const unica = sucursales.length === 1 ? String(sucursales[0].id) : '';
  const valor = { ...f, sucursal_id: f.sucursal_id || unica };
  const cerrar = () => { setF({ codigo: '', nombre: '', sucursal_id: '' }); setErr({}); setError(null); onCerrar(); };
  const url = `${window.location.origin}/tableta/vincular`;

  async function guardar() {
    const e = {};
    if (valor.codigo.replace(/\D/g, '').length !== 6) e.codigo = 'Son 6 números';
    if (!valor.nombre.trim()) e.nombre = 'Por ejemplo, Entrada Centro';
    if (!valor.sucursal_id) e.sucursal_id = 'Elige la sucursal';
    setErr(e); setError(null);
    if (Object.keys(e).length) return;
    setGuardando(true);
    try { const r = await api.post('/dispositivos', { ...valor, sucursal_id: Number(valor.sucursal_id) }); onListo(r); cerrar(); }
    catch (ex) { if (ex.detalle?.campo) setErr({ [ex.detalle.campo]: ex.message }); else setError(ex); }
    finally { setGuardando(false); }
  }

  return (
    <Modal abierto={abierto} onCerrar={cerrar} titulo="Conectar tableta" subtitulo="Sin correo ni contraseña: con el código que muestra la tableta"
      pie={<><Boton variante="secundario" onClick={cerrar}>Cancelar</Boton><Boton icono={Tablet} cargando={guardando} onClick={guardar}>Conectar</Boton></>}>
      <div className="space-y-5">
        <ol className="space-y-2 text-[14px]">
          <li><b>1.</b> En la tableta abre en el navegador: <code className="px-1.5 py-0.5 rounded bg-inset text-[13px] break-all select-all">{url}</code></li>
          <li><b>2.</b> Escribe aquí el código de 6 números que aparece.</li>
        </ol>
        <Campo etiqueta="Código" inputMode="numeric" value={valor.codigo} error={err.codigo} placeholder="123 456" autoComplete="off"
          onChange={(e) => setF({ ...f, codigo: e.target.value.replace(/[^\d ]/g, '').slice(0, 7) })} className="[&_input]:font-mono [&_input]:text-[22px] [&_input]:tracking-[.2em]" />
        <div className="grid sm:grid-cols-2 gap-4">
          <Campo etiqueta="Nombre" value={valor.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} error={err.nombre} maxLength={60} placeholder="Entrada Centro" />
          <Selector etiqueta="Sucursal" value={valor.sucursal_id} onChange={(e) => setF({ ...f, sucursal_id: e.target.value })} error={err.sucursal_id}>
            <option value="">Elige…</option>
            {sucursales.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </Selector>
        </div>
        <ErrorCaja error={error} />
      </div>
    </Modal>
  );
}

export default function Tabletas() {
  const avisar = useAvisos();
  const confirmar = useConfirmar();
  const datos = useDatos(() => api.get('/dispositivos'), []);
  const opciones = useDatos(() => api.get('/personal/opciones'), []);
  const [conectar, setConectar] = useState(false);
  const [renombrar, setRenombrar] = useState(null);
  const [verViejas, setVerViejas] = useState(false);
  const todas = datos.datos?.tabletas || [];
  const lista = todas.filter((t) => verViejas || t.activo);
  const desconectadas = todas.filter((t) => !t.activo).length;
  const viejas = datos.datos?.cuentas_con_correo || [];

  const desconectar = async (t) => {
    if (!(await confirmar({ titulo: `Desconectar ${t.nombre}`, texto: 'Se cierra su sesión al momento y ya no podrá registrar asistencia. Para volver a usarla se conecta con un código nuevo.', aceptar: 'Desconectar', peligro: true }))) return;
    try { await api.put(`/dispositivos/${t.id}`, { activo: 0 }); avisar('Tableta desconectada', 'info'); datos.recargar(); } catch (e) { avisar(e.message, 'error'); }
  };
  const guardarNombre = async () => {
    try { await api.put(`/dispositivos/${renombrar.id}`, { nombre: renombrar.nombre }); avisar('Nombre guardado'); setRenombrar(null); datos.recargar(); } catch (e) { avisar(e.message, 'error'); }
  };

  return (
    <>
      <Encabezado ruta="Configuración" titulo="Tabletas de asistencia"
        descripcion="La tableta (o un celular) de la entrada: el alumno acerca su QR y el sistema busca solo su clase. Se conecta con un código y se queda conectada hasta que la desconectes."
        acciones={<Boton icono={Plus} onClick={() => setConectar(true)} disabled={!opciones.datos}>Conectar tableta</Boton>} />
      <Tarjeta cuerpo="p-0" titulo="Tabletas" icono={Tablet}>
        <div className="px-5 pt-3"><ErrorCaja error={datos.error} reintentar={datos.recargar} /></div>
        {datos.cargando && !datos.datos ? <Cargando /> : !lista.length ? (
          <Vacio icono={Tablet} titulo="Ninguna tableta conectada" texto="Abre la página de conexión en la tableta de la entrada y escribe aquí su código." />
        ) : (
          <ul className="divide-y divide-line">
            {lista.map((t) => (
              <li key={t.id} className={cx('flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5', !t.activo && 'opacity-55')}>
                <span className={cx('grid place-items-center size-10 rounded-full', t.en_linea ? 'bg-ok-bg text-ok' : 'bg-inset text-muted')}>{t.en_linea ? <Wifi className="size-5" /> : <WifiOff className="size-5" />}</span>
                <div className="flex-1 min-w-[180px]">
                  <div className="font-medium">{t.nombre}</div>
                  <div className="text-[12px] text-muted">{t.sucursal} · conectada por {t.creado_por}</div>
                </div>
                <div className="text-[13px] text-muted w-40">{t.activo ? haceCuanto(t.ultima_vez) : 'Desconectada'}</div>
                {t.activo ? (t.en_linea ? <Chip tono="ok">En línea</Chip> : <Chip tono="aviso">Sin señal</Chip>) : <Chip>Desconectada</Chip>}
                {!!t.activo && <div className="flex gap-1">
                  <Boton variante="fantasma" tam="sm" icono={Pencil} onClick={() => setRenombrar({ id: t.id, nombre: t.nombre })}>Nombre</Boton>
                  <Boton variante="fantasma" tam="sm" icono={Power} onClick={() => desconectar(t)}>Desconectar</Boton>
                </div>}
              </li>
            ))}
          </ul>
        )}
        {desconectadas > 0 && (
          <div className="px-5 py-2.5 border-t border-line">
            <button onClick={() => setVerViejas(!verViejas)} className="text-[13px] text-muted hover:text-text cursor-pointer">{verViejas ? 'Ocultar las desconectadas' : `Ver las desconectadas (${desconectadas})`}</button>
          </div>
        )}
      </Tarjeta>
      {viejas.length > 0 && (
        <Tarjeta className="mt-4" titulo="Cuentas de tableta con correo" subtitulo="De antes de conectar con código. Se pueden seguir usando, pero conviene cambiarlas por una tableta conectada y desactivarlas.">
          <ul className="space-y-1.5 text-[14px]">
            {viejas.map((v) => <li key={v.usuario_id} className="flex flex-wrap gap-x-3"><span className="font-medium">{v.nombre}</span><span className="text-muted">{v.email} · {v.sucursal}</span></li>)}
          </ul>
          <Link to="/configuracion/personal" className="inline-block mt-3 text-[13px] text-action hover:underline">Desactivarlas en Personal y accesos</Link>
        </Tarjeta>
      )}
      <Tarjeta className="mt-4" titulo="Consejos para la entrada">
        <ul className="text-[14px] text-soft space-y-1.5 list-disc pl-5">
          <li>En la tableta, agrega la página a la pantalla de inicio (menú del navegador → "Agregar a pantalla de inicio"): se abre a pantalla completa.</li>
          <li>Fija la pantalla para que nadie salga a otras apps: en Android, "Fijar app"; en iPad, "Acceso guiado".</li>
          <li>Para usar la cámara la página debe abrir con https. Un lector de códigos USB o Bluetooth funciona siempre.</li>
          <li>Déjala conectada a la corriente: la pantalla se queda encendida mientras esté abierta.</li>
        </ul>
      </Tarjeta>
      <Conectar abierto={conectar} onCerrar={() => setConectar(false)} sucursales={opciones.datos?.sucursales || []} onListo={(r) => { avisar(`${r.nombre} quedó conectada`); datos.recargar(); }} />
      <Modal abierto={!!renombrar} onCerrar={() => setRenombrar(null)} titulo="Nombre de la tableta"
        pie={<><Boton variante="secundario" onClick={() => setRenombrar(null)}>Cancelar</Boton><Boton onClick={guardarNombre}>Guardar</Boton></>}>
        {renombrar && <Campo etiqueta="Nombre" value={renombrar.nombre} maxLength={60} onChange={(e) => setRenombrar({ ...renombrar, nombre: e.target.value })} />}
      </Modal>
    </>
  );
}
