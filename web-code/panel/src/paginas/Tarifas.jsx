import { useMemo, useState } from 'react';
import { Ban, Calculator, History, Pencil, Plus, Tag, Tags, Trash2 } from 'lucide-react';
import { api, formato } from '../api';
import { useSesion } from '../auth/Sesion';
import { Boton, Campo, Cargando, Chip, Encabezado, ErrorCaja, Modal, Pestanas, Selector, Tabla, Tarjeta, Vacio, useAvisos, useConfirmar, useDatos } from '../ui';

// S-11 · Precios y promociones (tarea 2.3)
const TIPO_CONCEPTO = { mensualidad: 'Mensualidad', inscripcion: 'Inscripción', examen: 'Examen', pase_dia: 'Pase de un día', producto: 'Producto', recargo: 'Recargo' };
const TIPO_PROMO = { paquete: 'Paquete', convenio: 'Convenio', descuento: 'Descuento' };
const hoy = () => new Date().toISOString().slice(0, 10);

/* ---------- Precios ---------- */
function Precios({ sucursales }) {
  const { tiene, rol } = useSesion();
  const avisar = useAvisos();
  const global = rol?.alcance === 'global';
  const [suc, setSuc] = useState(global ? '' : String(rol?.sucursal_id || ''));
  const datos = useDatos(() => api.get('/precios', { sucursal_id: suc }), [suc]);
  const globales = useDatos(() => (suc ? api.get('/precios') : Promise.resolve(null)), [suc]);
  const precioGlobal = useMemo(() => Object.fromEntries((globales.datos?.conceptos || []).map((c) => [c.id, c.precio])), [globales.datos]);

  const [editar, setEditar] = useState(null);
  const [monto, setMonto] = useState('');
  const [err, setErr] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [hist, setHist] = useState(null);
  const [nuevo, setNuevo] = useState(null);

  const puede = tiene('precios.gestionar');
  const guardar = async () => {
    setGuardando(true); setErr('');
    try {
      const r = await api.post('/precios', { concepto_id: editar.id, monto, sucursal_id: suc || null });
      avisar(`${editar.nombre}: ${formato.dinero(r.anterior)} → ${formato.dinero(r.nuevo)}`);
      setEditar(null); datos.recargar(); globales.recargar();
    } catch (e) { setErr(e.message); } finally { setGuardando(false); }
  };
  const verHist = async (c) => {
    setHist({ c, filas: null });
    try { setHist({ c, filas: await api.get('/precios/historial', { concepto_id: c.id }) }); }
    catch (e) { avisar(e.message, 'error'); setHist(null); }
  };
  const crearConcepto = async () => {
    setGuardando(true); setErr('');
    try {
      const r = await api.post('/conceptos', { nombre: nuevo.nombre, tipo: nuevo.tipo });
      if (nuevo.monto) await api.post('/precios', { concepto_id: r.id, monto: nuevo.monto });
      avisar(`Concepto “${r.nombre}” agregado`); setNuevo(null); datos.recargar();
    } catch (e) { setErr(e.message); } finally { setGuardando(false); }
  };

  return (
    <Tarjeta titulo="Precios vigentes" subtitulo="Un precio de sucursal sustituye al global solo en esa sucursal" icono={Tag} cuerpo="p-0"
      acciones={puede && <Boton tam="sm" icono={Plus} onClick={() => { setNuevo({ nombre: '', tipo: 'producto', monto: '' }); setErr(''); }}>Concepto</Boton>}>
      {global && (
        <div className="px-5 py-3 border-b border-line">
          <Pestanas valor={suc} onCambio={setSuc} opciones={[{ valor: '', etiqueta: 'Global' }, ...(sucursales || []).map((s) => ({ valor: String(s.id), etiqueta: s.nombre }))]} />
        </div>
      )}
      <div className="px-5 pt-3"><ErrorCaja error={datos.error} reintentar={datos.recargar} /></div>
      {datos.cargando && !datos.datos ? <Cargando /> : (
        <Tabla filas={datos.datos?.conceptos}
          columnas={[
            { k: 'nombre', t: 'Concepto', r: (c) => <span className="font-medium">{c.nombre}</span> },
            { k: 'tipo', t: 'Tipo', r: (c) => <Chip>{TIPO_CONCEPTO[c.tipo] || c.tipo}</Chip> },
            { k: 'precio', t: 'Precio', derecha: true, r: (c) => (
              <div>
                <div className="font-semibold text-[15px]">{c.precio ? formato.dinero(c.precio) : <span className="text-warn text-[13px]">Sin precio</span>}</div>
                {suc && c.precio && precioGlobal[c.id] !== c.precio && <div className="text-[11.5px] text-action">propio · global {formato.dinero(precioGlobal[c.id])}</div>}
              </div>) },
            { k: 'acc', t: '', derecha: true, r: (c) => (
              <div className="flex justify-end gap-1">
                {puede && <Boton variante="fantasma" tam="sm" icono={History} onClick={() => verHist(c)} aria-label="Historial" />}
                {puede && <Boton variante="secundario" tam="sm" icono={Pencil} onClick={() => { setEditar(c); setMonto(c.precio || ''); setErr(''); }}>Precio</Boton>}
              </div>) },
          ]} />
      )}

      <Modal abierto={!!editar} onCerrar={() => setEditar(null)} titulo={`Precio de ${editar?.nombre || ''}`}
        subtitulo={suc ? `Solo para ${sucursales?.find((s) => String(s.id) === suc)?.nombre}` : 'Precio global'}
        pie={<><Boton variante="secundario" onClick={() => setEditar(null)}>Cancelar</Boton><Boton cargando={guardando} onClick={guardar}>Guardar precio</Boton></>}>
        <Campo etiqueta="Monto (MXN)" inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value.replace(/[^\d.]/g, ''))} error={err}
          derecha={<span className="text-muted text-sm">MXN</span>} onKeyDown={(e) => e.key === 'Enter' && guardar()}
          ayuda={editar?.precio ? `Actual: ${formato.dinero(editar.precio)}. Aplica desde hoy; los cobros anteriores conservan su precio.` : 'Aplica desde hoy.'} />
      </Modal>

      <Modal abierto={!!nuevo} onCerrar={() => setNuevo(null)} titulo="Nuevo concepto" subtitulo="Algo que el dojo cobra: uniforme, guantes, seminario…"
        pie={<><Boton variante="secundario" onClick={() => setNuevo(null)}>Cancelar</Boton><Boton cargando={guardando} onClick={crearConcepto} disabled={!nuevo?.nombre?.trim()}>Agregar</Boton></>}>
        {nuevo && <div className="space-y-4">
          <Campo etiqueta="Nombre" value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} placeholder="Uniforme de Taekwondo" />
          <Selector etiqueta="Tipo" value={nuevo.tipo} onChange={(e) => setNuevo({ ...nuevo, tipo: e.target.value })}>
            {Object.entries(TIPO_CONCEPTO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Selector>
          <Campo etiqueta="Precio global (opcional)" inputMode="decimal" value={nuevo.monto} onChange={(e) => setNuevo({ ...nuevo, monto: e.target.value.replace(/[^\d.]/g, '') })} derecha={<span className="text-muted text-sm">MXN</span>} />
          <ErrorCaja error={err && { message: err }} />
        </div>}
      </Modal>

      <Modal abierto={!!hist} onCerrar={() => setHist(null)} lateral titulo="Historial de precios" subtitulo={hist?.c.nombre}>
        {!hist?.filas ? <Cargando /> : !hist.filas.length ? <Vacio titulo="Sin precios registrados" /> : (
          <Tabla filas={hist.filas} columnas={[
            { k: 'monto', t: 'Monto', r: (h) => <b>{formato.dinero(h.monto)}</b> },
            { k: 'sucursal', t: 'Aplica en', r: (h) => h.sucursal || 'Global' },
            { k: 'vig', t: 'Vigencia', r: (h) => <span className="text-[13px]">{formato.fecha(h.vigente_desde)} → {h.vigente_hasta ? formato.fecha(h.vigente_hasta) : <Chip tono="ok">vigente</Chip>}</span> },
          ]} />
        )}
      </Modal>
    </Tarjeta>
  );
}

/* ---------- Promociones ---------- */
function FormPromocion({ conceptos, sucursales, global, onCerrar, onCreada }) {
  const avisar = useAvisos();
  const [f, setF] = useState({ nombre: '', tipo: 'paquete', codigo: '', institucion: '', sucursal_id: '', vigente_desde: hoy(), vigente_hasta: '' });
  const [lineas, setLineas] = useState([{ concepto_id: '', tipo: 'porcentaje', valor: '' }]);
  const [err, setErr] = useState('');
  const [guardando, setGuardando] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const setLinea = (i, k, v) => setLineas(lineas.map((l, j) => (j === i ? { ...l, [k]: v } : l)));

  const guardar = async () => {
    setGuardando(true); setErr('');
    try {
      const cuerpo = { ...f, sucursal_id: f.sucursal_id || null, conceptos: lineas.filter((l) => l.concepto_id).map((l) => ({ ...l, concepto_id: Number(l.concepto_id) })) };
      const r = await api.post('/promociones', cuerpo);
      avisar(`Promoción “${f.nombre}” creada${r.codigo ? ' · código ' + r.codigo : ''}`);
      onCreada();
    } catch (e) { setErr(e.message); } finally { setGuardando(false); }
  };

  return (
    <Modal abierto onCerrar={onCerrar} lateral titulo="Nueva promoción" subtitulo="Paquete con código, convenio con una institución o descuento"
      pie={<><Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton><Boton cargando={guardando} onClick={guardar}>Guardar promoción</Boton></>}>
      <div className="space-y-5">
        <Campo etiqueta="Nombre" value={f.nombre} onChange={set('nombre')} placeholder="Paquete noviembre" />
        <div>
          <span className="etiqueta block mb-1.5">Tipo</span>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(TIPO_PROMO).map(([k, v]) => (
              <button key={k} type="button" onClick={() => setF({ ...f, tipo: k })}
                className={`rounded-[10px] border px-3 py-3 text-left cursor-pointer transition-colors ${f.tipo === k ? 'border-action bg-action/10' : 'border-line bg-inset hover:border-line-strong'}`}>
                <div className="font-semibold text-sm">{v}</div>
                <div className="text-[12px] text-muted">{k === 'paquete' ? 'Con código' : k === 'convenio' ? 'Escuela o empresa' : 'Familiar, especial'}</div>
              </button>
            ))}
          </div>
        </div>
        {f.tipo === 'paquete' && <Campo etiqueta="Código que da el cliente" value={f.codigo} onChange={(e) => setF({ ...f, codigo: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '') })} placeholder="NOV2026" ayuda="Letras, números, guion o guion bajo" />}
        {f.tipo === 'convenio' && <Campo etiqueta="Institución" value={f.institucion} onChange={set('institucion')} placeholder="Preparatoria 5 BUAP" />}
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Desde" type="date" value={f.vigente_desde} onChange={set('vigente_desde')} />
          <Campo etiqueta="Hasta (incluido)" type="date" value={f.vigente_hasta} onChange={set('vigente_hasta')} ayuda="Vacío = sin fecha de fin" />
        </div>
        {global && (
          <Selector etiqueta="Sucursal" value={f.sucursal_id} onChange={set('sucursal_id')}>
            <option value="">Todas las sucursales</option>
            {sucursales.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </Selector>
        )}
        <div>
          <span className="etiqueta block mb-2">Qué descuenta</span>
          <div className="space-y-2">
            {lineas.map((l, i) => (
              <div key={i} className="grid grid-cols-[1fr_110px_90px_36px] gap-2 items-center">
                <select value={l.concepto_id} onChange={(e) => setLinea(i, 'concepto_id', e.target.value)} className="h-10 rounded-md bg-inset border border-line px-2 text-sm">
                  <option value="">Concepto…</option>
                  {conceptos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
                <select value={l.tipo} onChange={(e) => setLinea(i, 'tipo', e.target.value)} className="h-10 rounded-md bg-inset border border-line px-2 text-sm">
                  <option value="porcentaje">%</option><option value="monto">$ fijo</option>
                </select>
                <input value={l.valor} inputMode="decimal" onChange={(e) => setLinea(i, 'valor', e.target.value.replace(/[^\d.]/g, ''))} placeholder={l.tipo === 'porcentaje' ? '50' : '200'}
                  className="h-10 rounded-md bg-inset border border-line px-3 text-sm text-right" />
                <button type="button" onClick={() => setLineas(lineas.filter((_, j) => j !== i))} disabled={lineas.length === 1} aria-label="Quitar"
                  className="grid place-items-center size-9 rounded-full text-muted hover:text-danger disabled:opacity-30 cursor-pointer"><Trash2 className="size-4" /></button>
              </div>
            ))}
          </div>
          <Boton variante="fantasma" tam="sm" icono={Plus} className="mt-2" onClick={() => setLineas([...lineas, { concepto_id: '', tipo: 'porcentaje', valor: '' }])}>Agregar concepto</Boton>
        </div>
        <ErrorCaja error={err && { message: err }} />
      </div>
    </Modal>
  );
}

function Promociones({ conceptos, sucursales }) {
  const { tiene, rol } = useSesion();
  const avisar = useAvisos();
  const confirmar = useConfirmar();
  const [filtro, setFiltro] = useState('vigentes');
  const datos = useDatos(() => api.get('/promociones', { vigentes: filtro === 'vigentes' ? 1 : '' }), [filtro]);
  const [form, setForm] = useState(false);
  const puede = tiene('promociones.gestionar');

  const desactivar = async (p) => {
    if (!(await confirmar({ titulo: 'Desactivar promoción', texto: `“${p.nombre}” dejará de aplicarse en cobros nuevos. Queda en el historial.`, aceptar: 'Desactivar', peligro: true }))) return;
    try { await api.put(`/promociones/${p.id}/desactivar`); avisar('Promoción desactivada', 'info'); datos.recargar(); }
    catch (e) { avisar(e.message, 'error'); }
  };
  const estado = (p) => {
    if (!Number(p.activa)) return <Chip>Desactivada</Chip>;
    const h = hoy();
    if (p.vigente_desde > h) return <Chip tono="info">Programada</Chip>;
    if (p.vigente_hasta && p.vigente_hasta < h) return <Chip tono="aviso">Vencida</Chip>;
    return <Chip tono="ok">Vigente</Chip>;
  };

  return (
    <Tarjeta titulo="Promociones y convenios" icono={Tags} cuerpo="p-0"
      acciones={<>
        <Pestanas valor={filtro} onCambio={setFiltro} opciones={[{ valor: 'vigentes', etiqueta: 'Vigentes' }, { valor: 'todas', etiqueta: 'Todas' }]} />
        {puede && <Boton tam="sm" icono={Plus} onClick={() => setForm(true)}>Promoción</Boton>}
      </>}>
      <div className="px-5 pt-3"><ErrorCaja error={datos.error} reintentar={datos.recargar} /></div>
      {datos.cargando && !datos.datos ? <Cargando /> : (
        <Tabla filas={datos.datos} vacio={<Vacio icono={Tags} titulo="Sin promociones" texto="Crea un paquete con código o un convenio con una escuela." />}
          columnas={[
            { k: 'nombre', t: 'Promoción', r: (p) => (
              <div><div className="font-medium">{p.nombre}</div><div className="text-[12px] text-muted">{p.institucion || (p.sucursal ? p.sucursal : 'Todas las sucursales')}</div></div>) },
            { k: 'tipo', t: 'Tipo', r: (p) => <Chip tono={p.tipo === 'convenio' ? 'oro' : 'accion'}>{TIPO_PROMO[p.tipo]}</Chip> },
            { k: 'codigo', t: 'Código', r: (p) => p.codigo ? <span className="font-mono text-[13px]">{p.codigo}</span> : <span className="text-muted">—</span> },
            { k: 'desc', t: 'Descuenta', r: (p) => <div className="text-[13px] space-y-0.5">{p.conceptos.map((c) => <div key={c.concepto_id}>{c.concepto}: <b>{c.tipo === 'porcentaje' ? `${Number(c.valor)} %` : formato.dinero(c.valor)}</b></div>)}</div> },
            { k: 'vig', t: 'Vigencia', r: (p) => <span className="text-[13px] whitespace-nowrap">{formato.fecha(p.vigente_desde)} → {p.vigente_hasta ? formato.fecha(p.vigente_hasta) : 'sin fin'}</span> },
            { k: 'estado', t: 'Estado', r: estado },
            { k: 'acc', t: '', derecha: true, r: (p) => puede && Number(p.activa) && (rol?.alcance === 'global' || p.sucursal_id) ? <Boton variante="fantasma" tam="sm" icono={Ban} onClick={() => desactivar(p)}>Desactivar</Boton> : null },
          ]} />
      )}
      {form && <FormPromocion conceptos={conceptos} sucursales={sucursales} global={rol?.alcance === 'global'} onCerrar={() => setForm(false)} onCreada={() => { setForm(false); datos.recargar(); }} />}
    </Tarjeta>
  );
}

/* ---------- Simulador de cotización ---------- */
function Cotizar({ conceptos, sucursales }) {
  const { rol } = useSesion();
  const [sel, setSel] = useState({});
  const [codigo, setCodigo] = useState('');
  const [suc, setSuc] = useState(String(rol?.sucursal_id || sucursales?.[0]?.id || ''));
  const [res, setRes] = useState(null);
  const [err, setErr] = useState(null);
  const [cargando, setCargando] = useState(false);
  const elegidos = Object.entries(sel).filter(([, n]) => n > 0).map(([id, n]) => ({ concepto_id: Number(id), cantidad: n }));
  const calcular = async () => {
    setCargando(true); setErr(null);
    try { setRes(await api.post('/cotizar', { sucursal_id: suc || null, codigo, conceptos: elegidos })); }
    catch (e) { setErr(e); setRes(null); } finally { setCargando(false); }
  };
  return (
    <Tarjeta titulo="Simulador de cuenta" subtitulo="Calcula lo que pagaría alguien con un código de promoción. Es lo que usará la inscripción." icono={Calculator}>
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          {rol?.alcance === 'global' && (
            <Selector etiqueta="Sucursal" value={suc} onChange={(e) => setSuc(e.target.value)}>
              {(sucursales || []).map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </Selector>
          )}
          <div>
            <span className="etiqueta block mb-2">Conceptos</span>
            <div className="rounded-[10px] border border-line divide-y divide-line max-h-72 overflow-y-auto">
              {conceptos.map((c) => (
                <label key={c.id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-inset">
                  <input type="checkbox" className="size-4 accent-[var(--action)]" checked={!!sel[c.id]} onChange={(e) => setSel({ ...sel, [c.id]: e.target.checked ? 1 : 0 })} />
                  <span className="flex-1 text-sm">{c.nombre}</span>
                  {sel[c.id] > 0 && c.tipo === 'producto' && (
                    <input type="number" min="1" value={sel[c.id]} onChange={(e) => setSel({ ...sel, [c.id]: Math.max(1, Number(e.target.value)) })} className="w-14 h-8 rounded bg-inset border border-line px-2 text-sm" />
                  )}
                </label>
              ))}
            </div>
          </div>
          <Campo etiqueta="Código de promoción (opcional)" value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} placeholder="NOV2026" />
          <Boton icono={Calculator} cargando={cargando} disabled={!elegidos.length} onClick={calcular}>Calcular</Boton>
        </div>
        <div>
          <ErrorCaja error={err} />
          {!res && !err && <Vacio icono={Calculator} titulo="Elige conceptos y calcula" texto="Verás el precio, el descuento y el total de cada línea." />}
          {res && (
            <div className="rounded-[10px] border border-line bg-inset/40 anim-entrar">
              {res.promocion && <div className="px-4 py-3 border-b border-line text-sm">Promoción aplicada: <Chip tono="accion">{res.promocion.nombre}</Chip></div>}
              <ul className="divide-y divide-line">
                {res.lineas.map((l) => (
                  <li key={l.concepto_id} className="flex items-start gap-3 px-4 py-3 text-sm">
                    <div className="flex-1"><div className="font-medium">{l.concepto}{l.cantidad > 1 && ` × ${l.cantidad}`}</div>
                      {Number(l.descuento) > 0 && <div className="text-[12px] text-ok">− {formato.dinero(l.descuento)}</div>}</div>
                    <div className="text-right">
                      {Number(l.descuento) > 0 && <div className="text-[12px] text-muted line-through">{formato.dinero(l.importe)}</div>}
                      <div className="font-semibold">{formato.dinero(l.total)}</div>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="px-4 py-3 border-t border-line text-sm space-y-1">
                <div className="flex justify-between text-muted"><span>Subtotal</span><span>{formato.dinero(res.subtotal)}</span></div>
                <div className="flex justify-between text-ok"><span>Descuento</span><span>− {formato.dinero(res.descuento)}</span></div>
                <div className="flex justify-between text-[20px] font-semibold pt-1"><span>Total</span><span>{formato.dinero(res.total)}</span></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Tarjeta>
  );
}

export default function Tarifas() {
  const { tiene } = useSesion();
  const [pest, setPest] = useState('precios');
  const sucursales = useDatos(() => api.get('/sucursales'), []);
  const conceptos = useDatos(() => api.get('/conceptos'), [pest]);
  const opciones = [
    { valor: 'precios', etiqueta: 'Precios' },
    { valor: 'promociones', etiqueta: 'Promociones' },
    ...(tiene('inscripciones.crear') ? [{ valor: 'cotizar', etiqueta: 'Simulador' }] : []),
  ];
  return (
    <>
      <Encabezado ruta="Catálogos · Comercial" titulo="Precios y promociones"
        descripcion="Lo que cobra el dojo, sus precios por sucursal y los descuentos que se aplican al inscribir o cobrar." />
      <Pestanas className="mb-4" valor={pest} onCambio={setPest} opciones={opciones} />
      {pest === 'precios' && <Precios sucursales={sucursales.datos} />}
      {pest === 'promociones' && <Promociones conceptos={conceptos.datos || []} sucursales={sucursales.datos || []} />}
      {pest === 'cotizar' && <Cotizar conceptos={conceptos.datos || []} sucursales={sucursales.datos} />}
    </>
  );
}
