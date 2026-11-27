import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeftRight, Banknote, Calculator, CalendarClock, ChevronRight, CreditCard, Phone, QrCode, Receipt, Search, Ticket, UserRound, Wallet } from 'lucide-react';
import { api, formato, nombreCompleto } from '../api';
import { useSesion } from '../auth/Sesion';
import { Boton, Campo, Cargando, Chip, Encabezado, ErrorCaja, FotoAlumno, Kpi, Pestanas, Selector, Tabla, Tarjeta, Vacio, useAvisos, useDatos } from '../ui';
import Recibo, { METODOS } from './Recibo';
import CobroQr from './CobroQr';

// S-04 · Caja en mostrador (fase 4): busca la cuenta, marca lo que se paga, cobra e imprime el recibo.
// El servidor vuelve a calcular todos los montos: aquí solo se muestra lo que él responde en /caja/cotizar.
export default function Caja() {
  const { tiene } = useSesion();
  const [params, setParams] = useSearchParams();
  const vista = params.get('vista') === 'corte' && tiene('caja.corte') ? 'corte' : 'cobrar';
  const [recibo, setRecibo] = useState(null);
  const [version, setVersion] = useState(0);
  const cambiar = (k, v) => setParams((p) => { const n = new URLSearchParams(p); v ? n.set(k, v) : n.delete(k); return n; });

  return (
    <>
      <Encabezado ruta="Pagos" titulo="Caja"
        descripcion="Cobro en efectivo, transferencia o tarjeta (con un QR de Mercado Pago que la persona paga en su celular). Las mensualidades vencidas se cobran con su recargo. Lo que pagan desde la app aparece solo en el corte."
        acciones={tiene('caja.corte') && <Pestanas valor={vista} onCambio={(v) => cambiar('vista', v === 'corte' ? 'corte' : '')}
          opciones={[{ valor: 'cobrar', etiqueta: 'Cobrar' }, { valor: 'corte', etiqueta: 'Corte del día' }]} />} />
      {vista === 'corte'
        ? <Corte onRecibo={setRecibo} version={version} />
        : <Cobrar responsable={params.get('responsable')} alumno={params.get('alumno')} onElegir={(id) => setParams((p) => { const n = new URLSearchParams(p); n.delete('alumno'); id ? n.set('responsable', id) : n.delete('responsable'); return n; })} onRecibo={setRecibo} version={version} />}
      {recibo && <Recibo id={recibo} onCerrar={() => setRecibo(null)} onCambio={() => setVersion((v) => v + 1)} />}
    </>
  );
}

/* ---------------- Buscar la cuenta ---------------- */
function BuscarCuenta({ alumnoInicial, onElegir }) {
  const [texto, setTexto] = useState('');
  const [buscar, setBuscar] = useState('');
  const [alumno, setAlumno] = useState(alumnoInicial || null);
  useEffect(() => { const t = setTimeout(() => setBuscar(texto.trim()), 300); return () => clearTimeout(t); }, [texto]);
  const lista = useDatos(() => (buscar.length >= 2 ? api.get('/alumnos', { buscar, estado: '' }) : Promise.resolve(null)), [buscar]);
  const ficha = useDatos(() => (alumno ? api.get(`/alumnos/${alumno}`) : Promise.resolve(null)), [alumno]);

  // Si el alumno tiene un solo responsable, se abre su cuenta directo
  useEffect(() => { if (ficha.datos?.responsables?.length === 1) onElegir(String(ficha.datos.responsables[0].id)); }, [ficha.datos, onElegir]);

  return (
    <Tarjeta titulo="¿Quién paga?" subtitulo="Busca al alumno por nombre, matrícula o teléfono" icono={Search} className="max-w-2xl">
      <Campo icono={Search} value={texto} onChange={(e) => { setTexto(e.target.value); setAlumno(null); }} placeholder="Ana Pérez, CENT-26-0012, 2221234567…" autoFocus />
      <div className="mt-3"><ErrorCaja error={lista.error || ficha.error} /></div>
      {ficha.datos && ficha.datos.responsables.length > 1 && (
        <div className="mt-4 anim-entrar">
          <div className="etiqueta mb-2">{nombreCompleto(ficha.datos)} tiene varios responsables</div>
          <div className="grid sm:grid-cols-2 gap-2">
            {ficha.datos.responsables.map((r) => (
              <button key={r.id} onClick={() => onElegir(String(r.id))} className="text-left rounded-md border border-line hover:border-action p-3 cursor-pointer">
                <div className="font-semibold">{Number(r.es_el_mismo) ? 'Él mismo' : nombreCompleto(r)}</div>
                <div className="text-[13px] text-muted">{r.parentesco} · {r.telefono || 'sin teléfono'}</div>
              </button>
            ))}
          </div>
        </div>
      )}
      {!alumno && buscar.length >= 2 && (lista.cargando && !lista.datos ? <Cargando /> : lista.datos && (
        !lista.datos.length ? <Vacio icono={UserRound} titulo="Nadie coincide" texto="Prueba con la matrícula o el teléfono." /> : (
          <ul className="mt-3 divide-y divide-line border border-line rounded-md">
            {lista.datos.slice(0, 8).map((a) => (
              <li key={a.id}>
                <button onClick={() => setAlumno(a.id)} className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-inset cursor-pointer">
                  <FotoAlumno id={a.id} nombre={nombreCompleto(a)} tiene={a.tiene_foto} className="size-9" />
                  <div className="flex-1 min-w-0"><div className="font-medium truncate">{nombreCompleto(a)}</div><div className="text-[12px] text-muted">{a.disciplinas || 'Sin horario'}</div></div>
                  <span className="font-mono text-[12px] text-muted">{a.matricula}</span>
                </button>
              </li>
            ))}
          </ul>
        )))}
      {ficha.cargando && alumno && <Cargando texto="Abriendo cuenta…" />}
    </Tarjeta>
  );
}

/* ---------------- Cobrar ---------------- */
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const mes = (p) => `${MESES[Number(p.slice(5, 7)) - 1]} ${p.slice(0, 4)}`;
const TONO = { vencida: 'peligro', pendiente: 'aviso', por_vencer: 'info' };
const ESTADO = { vencida: 'Vencida', pendiente: 'Por pagar', por_vencer: 'Adelantado' };

function Cobrar({ responsable, alumno, onElegir, onRecibo, version }) {
  const avisar = useAvisos();
  const edo = useDatos(() => (responsable ? api.get(`/caja/estado-cuenta/${responsable}`) : Promise.resolve(null)), [responsable, version]);
  const [marcadas, setMarcadas] = useState(new Set());
  const [metodo, setMetodo] = useState('efectivo');
  const [referencia, setReferencia] = useState('');
  const [codigo, setCodigo] = useState('');
  const [usarSaldo, setUsarSaldo] = useState(true);
  const [recibe, setRecibe] = useState('');
  const [cot, setCot] = useState({ datos: null, error: null, cargando: false });
  const [cobrando, setCobrando] = useState(false);
  const [error, setError] = useState(null);
  const [qr, setQr] = useState(null);
  const e = edo.datos;

  // Al abrir una cuenta se marca todo lo que ya toca pagar (lo adelantado se deja sin marcar)
  useEffect(() => {
    if (!e) return;
    setMarcadas(new Set(e.adeudos.filter((l) => l.estado !== 'por_vencer').map((l) => l.clave)));
    setError(null); setRecibe(''); setReferencia('');
  }, [e]);

  const porAlumno = useMemo(() => {
    const m = new Map();
    (e?.adeudos || []).forEach((l) => { if (!m.has(l.alumno_id)) m.set(l.alumno_id, { nombre: l.alumno, lineas: [] }); m.get(l.alumno_id).lineas.push(l); });
    return [...m.entries()];
  }, [e]);

  const claves = useMemo(() => [...marcadas], [marcadas]);
  const cuerpo = useMemo(() => ({ responsable_id: Number(responsable), metodo, referencia, codigo, usar_saldo: usarSaldo, claves }),
    [responsable, metodo, referencia, codigo, usarSaldo, claves]);

  // Cotización en el servidor (promoción y saldo a favor incluidos)
  useEffect(() => {
    if (!responsable || !claves.length) { setCot({ datos: null, error: null, cargando: false }); return; }
    setCot((c) => ({ ...c, cargando: true }));
    const t = setTimeout(() => {
      api.post('/caja/cotizar', { ...cuerpo, metodo: 'efectivo' })
        .then((datos) => setCot({ datos, error: null, cargando: false }))
        .catch((error) => setCot({ datos: null, error, cargando: false }));
    }, 250);
    return () => clearTimeout(t);
  }, [cuerpo, responsable, claves.length]);

  function alternar(l) {
    setMarcadas((s) => {
      const n = new Set(s);
      const rec = l.clave.startsWith('mens:') ? 'rec:' + l.clave.slice(5) : null;
      if (n.has(l.clave)) { n.delete(l.clave); if (rec) n.delete(rec); }
      else { n.add(l.clave); if (rec && e.adeudos.some((x) => x.clave === rec)) n.add(rec); }
      return n;
    });
  }

  async function cobrar() {
    setCobrando(true); setError(null);
    if (metodo === 'tarjeta' && Number(cot.datos?.a_pagar) > 0) {
      try { setQr(await api.post('/caja/cobro-qr', { responsable_id: Number(responsable), claves, codigo })); }
      catch (err) { setError(err); } finally { setCobrando(false); }
      return;
    }
    try {
      const r = await api.post('/caja/cobros', cuerpo);
      avisar(`Cobro registrado · recibo ${r.folio}`);
      onRecibo(r.id);
      edo.recargar();
    } catch (err) { setError(err); } finally { setCobrando(false); }
  }

  if (!responsable) return (
    <div className="space-y-4">
      <BuscarCuenta alumnoInicial={alumno} onElegir={onElegir} />
      <PorCobrar onElegir={onElegir} />
    </div>
  );
  if (edo.cargando && !e) return <Cargando texto="Calculando estado de cuenta…" />;
  if (edo.error) return <ErrorCaja error={edo.error} reintentar={edo.recargar} />;
  if (!e) return null;

  const r = e.responsable;
  const aPagar = cot.datos ? Number(cot.datos.a_pagar) : 0;
  const cambio = metodo === 'efectivo' && recibe !== '' ? Number(recibe) - aPagar : null;
  const conQr = e.cobro_qr && e.cobro_qr !== 'apagado';
  const falta = !claves.length || cot.cargando || !!cot.error || (metodo === 'transferencia' && !referencia.trim()) || (cambio !== null && cambio < 0);
  const totalQr = cot.datos ? Number(cot.datos.total) : 0;

  return (
    <div className="grid lg:grid-cols-[1fr_380px] gap-4 items-start">
      <div className="space-y-4 min-w-0">
        <Tarjeta cuerpo="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <span className="grid place-items-center size-11 rounded-full bg-inset text-action"><UserRound className="size-5" /></span>
            <div className="flex-1 min-w-0">
              <div className="etiqueta">Responsable de pago</div>
              <div className="text-[18px] font-semibold">{nombreCompleto(r)}</div>
              <div className="text-[13px] text-muted flex flex-wrap gap-x-3">
                {r.telefono && <span className="inline-flex items-center gap-1"><Phone className="size-3" /><span className="font-mono">{r.telefono}</span></span>}
                <span>{e.alumnos.length} alumno{e.alumnos.length !== 1 && 's'} a su cargo</span>
              </div>
            </div>
            {Number(e.saldo_favor) > 0 && <Chip tono="oro">Saldo a favor {formato.dinero(e.saldo_favor)}</Chip>}
            <Boton variante="secundario" tam="sm" icono={ArrowLeftRight} onClick={() => onElegir('')}>Otra cuenta</Boton>
          </div>
        </Tarjeta>

        {!e.adeudos.length ? (
          <Tarjeta><Vacio icono={Wallet} titulo="Está al corriente" texto="No hay mensualidades, inscripciones ni exámenes pendientes." /></Tarjeta>
        ) : porAlumno.map(([aid, g]) => (
          <Tarjeta key={aid} titulo={g.nombre} subtitulo={e.alumnos.find((a) => Number(a.id) === aid)?.matricula}
            acciones={<Link to={`/alumnos/${aid}`} className="text-[13px] text-link font-semibold">Ver ficha</Link>} cuerpo="p-0">
            <ul className="divide-y divide-line">
              {g.lineas.filter((l) => !l.clave.startsWith('rec:')).map((l) => {
                const rec = l.clave.startsWith('mens:') && g.lineas.find((x) => x.clave === 'rec:' + l.clave.slice(5));
                const on = marcadas.has(l.clave);
                return (
                  <li key={l.clave}>
                    <label className="flex items-start gap-3 px-5 py-3 cursor-pointer hover:bg-inset">
                      <input type="checkbox" checked={on} onChange={() => alternar(l)} className="mt-1 size-4 accent-[var(--action)]" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">{l.concepto}{l.detalle && <span className="text-muted font-normal"> · {l.detalle}</span>}</div>
                        <div className="text-[12px] text-muted flex flex-wrap items-center gap-2 mt-0.5">
                          <Chip tono={TONO[l.estado]}>{ESTADO[l.estado]}</Chip>
                          {l.vence && <span className="inline-flex items-center gap-1"><CalendarClock className="size-3" />{l.clave.startsWith('exa:') ? 'examen el' : 'vence'} {formato.fecha(l.vence)}</span>}
                          {rec && <span className="text-danger">+ recargo {formato.dinero(rec.precio)}</span>}
                          {l.en_linea && <Chip tono="accion">Pagando en línea{l.en_linea.medio === 'ticket' ? ' (OXXO)' : l.en_linea.medio === 'bank_transfer' ? ' (SPEI)' : ''}</Chip>}
                        </div>
                      </div>
                      <div className="text-right font-mono">
                        {l.precio ? formato.dinero(l.precio) : <Chip tono="peligro">Sin precio</Chip>}
                        {rec && <div className="text-[12px] text-danger">{formato.dinero(rec.precio)}</div>}
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>
          </Tarjeta>
        ))}

        <Tarjeta titulo="Pagos recientes" icono={Receipt} cuerpo="p-0">
          <Tabla filas={e.pagos} onFila={(p) => onRecibo(p.id)}
            vacio={<p className="px-5 py-4 text-sm text-muted">Todavía no hay pagos de esta cuenta.</p>}
            columnas={[
              { k: 'folio', t: 'Folio', r: (p) => <span className="font-mono text-[13px]">{p.folio}</span> },
              { k: 'fecha', t: 'Fecha', r: (p) => formato.fechaHora(p.fecha) },
              { k: 'metodo', t: 'Método', r: (p) => METODOS[p.metodo] },
              { k: 'estado', t: '', r: (p) => p.estado !== 'aprobado' && <Chip tono="peligro">Cancelado</Chip> },
              { k: 'total', t: 'Total', derecha: true, r: (p) => <span className="font-mono">{formato.dinero(p.total)}</span> },
            ]} />
        </Tarjeta>
      </div>

      {/* Ticket */}
      <Tarjeta titulo="Ticket" icono={Ticket} className="lg:sticky lg:top-4">
        {!claves.length ? <p className="text-sm text-muted">Marca lo que se va a pagar.</p> : (
          <ul className="space-y-1.5 text-sm">
            {(cot.datos?.lineas || []).map((l) => (
              <li key={l.clave} className="flex justify-between gap-3">
                <span className="min-w-0">
                  <span className="block truncate">{l.concepto}{l.periodo && <span className="text-muted"> · {mes(l.periodo)}</span>}</span>
                  {e.alumnos.length > 1 && <span className="block text-[12px] text-muted truncate">{e.alumnos.find((a) => Number(a.id) === l.alumno_id)?.nombre}</span>}
                </span>
                <span className="font-mono">{formato.dinero(l.total)}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 space-y-3">
          <Campo etiqueta="Código de promoción" value={codigo} onChange={(ev) => setCodigo(ev.target.value.toUpperCase())} placeholder="Opcional" className="[&_input]:font-mono" />
          {Number(e.saldo_favor) > 0 && (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={usarSaldo} onChange={(ev) => setUsarSaldo(ev.target.checked)} className="size-4 accent-[var(--action)]" />
              Usar saldo a favor ({formato.dinero(e.saldo_favor)})
            </label>
          )}
        </div>
        <ErrorCaja error={cot.error} />
        {cot.datos && (
          <dl className="mt-4 pt-3 border-t border-line space-y-1 text-sm font-mono">
            <div className="flex justify-between text-muted"><dt>Subtotal</dt><dd>{formato.dinero(cot.datos.subtotal)}</dd></div>
            {Number(cot.datos.descuento) > 0 && <div className="flex justify-between text-ok"><dt>{cot.datos.promocion?.nombre || 'Descuento'}</dt><dd>−{formato.dinero(cot.datos.descuento)}</dd></div>}
            {Number(cot.datos.saldo_usado) > 0 && <div className="flex justify-between text-gold"><dt>Saldo a favor</dt><dd>−{formato.dinero(cot.datos.saldo_usado)}</dd></div>}
            <div className="flex justify-between items-baseline pt-1"><dt className="font-sans font-semibold">A pagar</dt><dd className="text-[26px] font-semibold">{formato.dinero(cot.datos.a_pagar)}</dd></div>
          </dl>
        )}
        {aPagar > 0 && (
          <div className="mt-4 space-y-3">
            <Pestanas valor={metodo} onCambio={setMetodo} opciones={[{ valor: 'efectivo', etiqueta: 'Efectivo' }, { valor: 'transferencia', etiqueta: 'Transferencia' }, ...(conQr ? [{ valor: 'tarjeta', etiqueta: 'Tarjeta' }] : [])]} />
            {metodo === 'tarjeta'
              ? <p className="flex gap-2 text-[13px] text-muted"><QrCode className="size-4 shrink-0 mt-0.5" />Sale un QR: la persona lo escanea y paga con su tarjeta en Mercado Pago desde su celular.{Number(cot.datos?.saldo_usado) > 0 && ' El saldo a favor no se usa con tarjeta.'}{e.cobro_qr === 'prueba' && ' (Modo prueba: no se cobra nada.)'}</p>
              : metodo === 'efectivo'
              ? <Campo etiqueta="Recibe" type="number" min="0" step="0.5" value={recibe} onChange={(ev) => setRecibe(ev.target.value)} icono={Banknote}
                  ayuda={cambio !== null && (cambio >= 0 ? `Cambio: ${formato.dinero(cambio)}` : `Faltan ${formato.dinero(-cambio)}`)} error={cambio !== null && cambio < 0 ? `Faltan ${formato.dinero(-cambio)}` : null} />
              : <Campo etiqueta="Número de rastreo" value={referencia} onChange={(ev) => setReferencia(ev.target.value)} placeholder="Del comprobante de la transferencia" className="[&_input]:font-mono" />}
          </div>
        )}
        <div className="mt-4"><ErrorCaja error={error} /></div>
        <Boton className="w-full mt-3" tam="lg" icono={Calculator} cargando={cobrando} disabled={falta} onClick={cobrar}>
          {metodo === 'tarjeta' && aPagar > 0 ? `Cobrar ${formato.dinero(totalQr)} con QR` : cot.datos ? (aPagar > 0 ? `Cobrar ${formato.dinero(aPagar)}` : 'Aplicar saldo a favor') : 'Cobrar'}
        </Boton>
      </Tarjeta>
      <CobroQr pago={qr} telefono={r.telefono} nombre={nombreCompleto(r)} onCerrar={() => { setQr(null); edo.recargar(); }}
        onListo={(id) => { setQr(null); onRecibo(id); edo.recargar(); }} />
    </div>
  );
}

/* ---------------- Por cobrar (sin buscar uno por uno) ---------------- */
const POR_COBRAR = { vencido: ['Vencidos', 'peligro'], por_vencer: ['Vencen pronto', 'aviso'], pendiente: ['Por pagar', 'info'] };
function PorCobrar({ onElegir }) {
  const { rol } = useSesion();
  const global = rol?.alcance === 'global';
  const [filtro, setFiltro] = useState('vencido');
  const [suc, setSuc] = useState('');
  const sucursales = useDatos(() => (global ? api.get('/sucursales') : Promise.resolve([])), [global]);
  const d = useDatos(() => api.get('/caja/por-cobrar', { dias: 7, sucursal_id: suc }), [suc]);
  const conteo = d.datos?.conteo || {};
  const lista = (d.datos?.cuentas || []).filter((c) => filtro === 'todos' || c.estado === filtro);
  // Si no hay vencidos, abre en "Vencen pronto"
  useEffect(() => { if (d.datos && filtro === 'vencido' && !conteo.vencido) setFiltro(conteo.por_vencer ? 'por_vencer' : 'todos'); }, [d.datos]); // eslint-disable-line react-hooks/exhaustive-deps
  const cuando = (c) => (c.estado === 'vencido' ? `Vencido desde el ${formato.fecha(c.vencido_desde)}` : c.estado === 'por_vencer' ? `Vence el ${formato.fecha(c.vence)}` : 'Inscripción, examen o mes en curso');
  return (
    <Tarjeta titulo="Por cobrar" icono={Wallet} cuerpo="p-0"
      subtitulo={d.datos ? `${(d.datos.cuentas || []).length} cuenta${(d.datos.cuentas || []).length === 1 ? '' : 's'} con algo pendiente${Number(d.datos.total_vencido) > 0 ? ` · vencido: ${formato.dinero(d.datos.total_vencido)}` : ''}` : 'Quién debe o está por vencer'}
      acciones={global && (
        <Selector value={suc} onChange={(ev) => setSuc(ev.target.value)} className="w-48" aria-label="Sucursal">
          <option value="">Todas las sucursales</option>
          {(sucursales.datos || []).map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
        </Selector>
      )}>
      <div className="px-5 pt-4">
        <Pestanas valor={filtro} onCambio={setFiltro} opciones={[
          { valor: 'vencido', etiqueta: 'Vencidos', cuenta: conteo.vencido ?? 0 },
          { valor: 'por_vencer', etiqueta: 'Vencen en 7 días', cuenta: conteo.por_vencer ?? 0 },
          { valor: 'todos', etiqueta: 'Todos', cuenta: (d.datos?.cuentas || []).length }]} />
        <div className="mt-3"><ErrorCaja error={d.error} reintentar={d.recargar} /></div>
      </div>
      {d.cargando && !d.datos ? <Cargando texto="Revisando cuentas…" /> : !lista.length ? (
        <Vacio icono={Wallet} titulo={filtro === 'vencido' ? 'Nadie tiene pagos vencidos' : filtro === 'por_vencer' ? 'Nadie vence esta semana' : 'Todos están al corriente'} texto="Cuando alguien deba, aparece aquí para cobrarle con un clic." />
      ) : (
        <ul className="divide-y divide-line mt-3 border-t border-line">
          {lista.map((c) => (
            <li key={c.responsable_id}>
              <button onClick={() => onElegir(String(c.responsable_id))} className="w-full flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-left hover:bg-inset cursor-pointer">
                <div className="flex-1 min-w-[200px]">
                  <div className="font-medium">{c.nombre}</div>
                  <div className="text-[12px] text-muted truncate">{c.alumnos.join(', ')}{c.telefono && <> · <span className="font-mono">{c.telefono}</span></>}</div>
                </div>
                <div className="flex items-center gap-2 text-[13px]">
                  <Chip tono={POR_COBRAR[c.estado][1]}>{c.estado === 'vencido' && <AlertTriangle className="size-3" />}{cuando(c)}</Chip>
                  {c.en_linea && <Chip tono="accion"><CreditCard className="size-3" />Pagando en línea</Chip>}
                </div>
                <div className="w-28 text-right font-mono font-semibold">{formato.dinero(c.total)}</div>
                <ChevronRight className="size-4 text-muted" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Tarjeta>
  );
}

/* ---------------- Corte del día ---------------- */
function Corte({ onRecibo, version }) {
  const { rol } = useSesion();
  const global = rol?.alcance === 'global';
  const hoy = new Date().toLocaleDateString('en-CA');
  const [fecha, setFecha] = useState(hoy);
  const [suc, setSuc] = useState('');
  const sucursales = useDatos(() => (global ? api.get('/sucursales') : Promise.resolve([])), [global]);
  const c = useDatos(() => api.get('/caja/corte', { fecha, sucursal_id: suc }), [fecha, suc, version]);
  const d = c.datos;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Campo etiqueta="Fecha" type="date" value={fecha} max={hoy} onChange={(e) => setFecha(e.target.value || hoy)} className="w-48" />
        {global && (
          <Selector etiqueta="Sucursal" value={suc} onChange={(e) => setSuc(e.target.value)} className="w-56">
            <option value="">Todas</option>
            {(sucursales.datos || []).map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </Selector>
        )}
      </div>
      <ErrorCaja error={c.error} reintentar={c.recargar} />
      {c.cargando && !d ? <Cargando /> : d && (
        <>
          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <Kpi etiqueta="Total cobrado" valor={formato.dinero(d.total)} detalle={`${d.pagos.length - d.cancelados} pagos`} icono={Wallet} />
            <Kpi etiqueta="Efectivo en caja" valor={formato.dinero(d.por_metodo.efectivo)} tono="ok" icono={Banknote} />
            <Kpi etiqueta="Transferencias" valor={formato.dinero(d.por_metodo.transferencia)} detalle={Number(d.por_metodo.pasarela) > 0 ? `En línea ${formato.dinero(d.por_metodo.pasarela)}` : null} tono="accion" icono={ArrowLeftRight} />
            <Kpi etiqueta="Saldo a favor usado" valor={formato.dinero(d.por_metodo.saldo_favor)} detalle={d.cancelados ? `${d.cancelados} cancelado${d.cancelados > 1 ? 's' : ''}` : 'Sin cancelaciones'} tono={d.cancelados ? 'peligro' : 'oro'} icono={Receipt} />
          </div>
          <Tarjeta titulo="Movimientos" subtitulo="Haz clic en un pago para ver o imprimir el recibo" cuerpo="p-0">
            <Tabla filas={d.pagos} onFila={(p) => onRecibo(p.id)}
              vacio={<Vacio icono={Receipt} titulo="Sin cobros ese día" />}
              columnas={[
                { k: 'fecha', t: 'Hora', r: (p) => <span className="font-mono text-[13px]">{p.fecha.slice(11, 16)}</span> },
                { k: 'folio', t: 'Folio', r: (p) => <span className="font-mono text-[13px]">{p.folio}</span> },
                { k: 'responsable', t: 'Pagó' },
                ...(global && !suc ? [{ k: 'sucursal', t: 'Sucursal' }] : []),
                { k: 'metodo', t: 'Método', r: (p) => METODOS[p.metodo] },
                { k: 'cobro', t: 'Cobró', r: (p) => <span className="text-muted">{p.cobro}</span> },
                { k: 'estado', t: '', r: (p) => p.estado !== 'aprobado' && <Chip tono="peligro">Cancelado</Chip> },
                { k: 'total', t: 'Total', derecha: true, r: (p) => <span className={'font-mono ' + (p.estado !== 'aprobado' ? 'line-through text-muted' : '')}>{formato.dinero(p.total - p.saldo_usado)}</span> },
              ]} />
          </Tarjeta>
        </>
      )}
    </div>
  );
}
