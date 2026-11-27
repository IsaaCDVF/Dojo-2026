import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CalendarCheck, Download, Table2, TrendingDown, TrendingUp, UserMinus, Users, Wallet } from 'lucide-react';
import { api, formato } from '../api';
import { useSesion } from '../auth/Sesion';
import { Cargando, Chip, Encabezado, ErrorCaja, Selector, Tarjeta, Vacio, useDatos } from '../ui';

// Reportes del dueño y los administradores: un mes y los 12 anteriores.
// Gráficas hechas a mano en SVG (sin librerías): barras delgadas, una sola escala, tooltip al pasar el mouse
// y tabla para quien no distingue colores o quiere copiar los números.

const cx = (...c) => c.filter(Boolean).join(' ');
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const mesCorto = (m) => `${MESES[Number(m.slice(5, 7)) - 1]}${m.slice(5, 7) === '01' ? ` ${m.slice(2, 4)}` : ''}`;
const mesLargo = (m) => new Date(`${m}-01T00:00`).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const METODOS = [['efectivo', 'Efectivo', 'var(--serie-1)'], ['transferencia', 'Transferencia', 'var(--serie-2)'], ['en_linea', 'En línea', 'var(--serie-3)']];
const dinero = (v) => formato.dinero(v);
const corto = (v) => { const n = Number(v); return n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}k` : `$${Math.round(n)}`; };

/** Escala "bonita" para el eje: 0 … tope redondo, con 4 marcas */
function escala(max) {
  if (max <= 0) return { tope: 1, marcas: [0] };
  const paso0 = max / 4; const p = 10 ** Math.floor(Math.log10(paso0));
  const paso = [1, 2, 2.5, 5, 10].map((k) => k * p).find((k) => k >= paso0);
  return { tope: paso * 4, marcas: [0, 1, 2, 3, 4].map((i) => i * paso) };
}

function Variacion({ ahora, antes, dinero: esDinero, invertir }) {
  if (antes === null || antes === undefined) return null;
  const a = Number(ahora); const b = Number(antes);
  if (!b) return <span className="text-[12px] text-muted">{a ? 'sin datos del mes anterior' : ''}</span>;
  const pct = Math.round(((a - b) / b) * 100);
  const bien = invertir ? pct <= 0 : pct >= 0;
  const I = pct >= 0 ? TrendingUp : TrendingDown;
  return <span className={cx('inline-flex items-center gap-1 text-[12px] font-semibold', pct === 0 ? 'text-muted' : bien ? 'text-ok' : 'text-danger')}>
    <I className="size-3.5" />{pct > 0 ? '+' : ''}{pct}% vs mes anterior{esDinero ? ` (${dinero(b)})` : ` (${b})`}</span>;
}

function Indicador({ icono: I, etiqueta, valor, children }) {
  return (
    <div className="bg-surface border border-line rounded-[10px] p-4">
      <div className="flex items-center justify-between"><span className="etiqueta">{etiqueta}</span><I className="size-4 text-muted" /></div>
      <div className="text-[28px] font-semibold tracking-tight mt-1">{valor}</div>
      <div className="min-h-5">{children}</div>
    </div>
  );
}

/**
 * Barras verticales (simples o apiladas). series: [[clave, etiqueta, color]]; datos: [{x, ...valores}].
 * Tooltip al pasar el mouse por toda la columna.
 */
/** Ancho real del contenedor: el SVG se dibuja a tamaño real para que la letra mida siempre lo mismo */
function useAncho() {
  const ref = useRef(null);
  const [w, setW] = useState(600);
  useEffect(() => {
    if (!ref.current) return undefined;
    const o = new ResizeObserver(([e]) => setW(Math.max(260, Math.round(e.contentRect.width))));
    o.observe(ref.current);
    return () => o.disconnect();
  }, []);
  return [ref, w];
}

function Barras({ datos, series, etiquetaX, formatoValor = (v) => v, alto = 220, resaltar }) {
  const [hover, setHover] = useState(null);
  const [ref, W] = useAncho();
  const H = alto; const izq = 46; const abajo = 26; const arriba = 10;
  const totales = datos.map((d) => series.reduce((s, [k]) => s + Number(d[k] || 0), 0));
  const { tope, marcas } = escala(Math.max(0, ...totales));
  const ancho = (W - izq) / datos.length;
  const barra = Math.min(28, ancho * 0.55);
  const y = (v) => arriba + (H - arriba - abajo) * (1 - v / tope);
  return (
    <div className="relative" ref={ref}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block" role="img" aria-label={`Gráfica de barras: ${series.map((s) => s[1]).join(', ')}`} onMouseLeave={() => setHover(null)}>
        {marcas.map((m) => (
          <g key={m}>
            <line x1={izq} x2={W} y1={y(m)} y2={y(m)} stroke="var(--line)" strokeWidth="1" />
            <text x={izq - 8} y={y(m) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">{formatoValor(m, true)}</text>
          </g>
        ))}
        {datos.map((d, i) => {
          const x = izq + ancho * i + (ancho - barra) / 2;
          let acum = 0;
          const tramos = series.map(([k, , color]) => { const v = Number(d[k] || 0); const t = { k, color, y0: y(acum), y1: y(acum + v), v }; acum += v; return t; }).filter((t) => t.v > 0);
          return (
            <g key={d.x} onMouseEnter={() => setHover(i)}>
              <rect x={izq + ancho * i} y={arriba} width={ancho} height={H - arriba - abajo} fill={hover === i ? 'var(--inset)' : 'transparent'} />
              {tramos.map((t, j) => {
                const ultimo = j === tramos.length - 1;
                const h = Math.max(0, t.y0 - t.y1 - (ultimo ? 0 : 2));   // 2 px de separación entre tramos
                const op = resaltar !== undefined && resaltar !== i ? 0.45 : 1;
                // El tramo de arriba lleva las esquinas redondeadas (4 px); los demás, cuadrados
                if (ultimo && t.y0 - t.y1 >= 4) {
                  return <path key={t.k} fill={t.color} opacity={op}
                    d={`M${x},${t.y0} V${t.y1 + 4} Q${x},${t.y1} ${x + 4},${t.y1} H${x + barra - 4} Q${x + barra},${t.y1} ${x + barra},${t.y1 + 4} V${t.y0} Z`} />;
                }
                return <rect key={t.k} x={x} y={ultimo ? t.y1 : t.y1 + 2} width={barra} height={Math.max(0.5, ultimo ? t.y0 - t.y1 : h)} fill={t.color} opacity={op} />;
              })}
              <text x={izq + ancho * i + ancho / 2} y={H - 8} textAnchor="middle" fontSize="11" fill={resaltar === i ? 'var(--text)' : 'var(--muted)'} fontWeight={resaltar === i ? 600 : 400}>{etiquetaX(d.x)}</text>
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div className="pointer-events-none absolute top-1 z-10 rounded-md border border-line-strong bg-surface shadow-lg px-3 py-2 text-[12px] min-w-36"
          style={{ left: `${Math.min(78, Math.max(4, ((izq + ancho * hover + ancho / 2) / W) * 100 - 10))}%` }}>
          <div className="font-semibold mb-1">{d0(datos[hover].titulo || datos[hover].x)}</div>
          {series.map(([k, t, color]) => (
            <div key={k} className="flex items-center justify-between gap-3"><span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-sm" style={{ background: color }} />{t}</span><span className="font-mono">{formatoValor(datos[hover][k] || 0)}</span></div>
          ))}
          {series.length > 1 && <div className="flex justify-between gap-3 border-t border-line mt-1 pt-1 font-semibold"><span>Total</span><span className="font-mono">{formatoValor(totales[hover])}</span></div>}
          {datos[hover].extra && <div className="text-muted mt-1">{datos[hover].extra}</div>}
        </div>
      )}
    </div>
  );
}
const d0 = (x) => (/^\d{4}-\d{2}$/.test(x) ? mesLargo(x) : x);

function Leyenda({ series }) {
  return <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-soft">{series.map(([k, t, c]) => <span key={k} className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: c }} />{t}</span>)}</div>;
}

/** Barras horizontales con el valor escrito (por concepto, deuda por antigüedad, sucursales) */
function Horizontales({ filas, formatoValor = dinero, color = 'var(--action)' }) {
  const max = Math.max(1, ...filas.map((f) => Number(f.valor)));
  return (
    <ul className="space-y-3">
      {filas.map((f) => (
        <li key={f.etiqueta}>
          <div className="flex justify-between gap-3 text-[13px] mb-1"><span className="truncate">{f.etiqueta}</span><span className="font-mono shrink-0">{formatoValor(f.valor)}{f.nota && <span className="text-muted font-sans"> · {f.nota}</span>}</span></div>
          <div className="h-2 rounded-full bg-inset overflow-hidden"><div className="h-full rounded-full" style={{ width: `${(Number(f.valor) / max) * 100}%`, background: f.color || color }} /></div>
        </li>
      ))}
    </ul>
  );
}

function descargarCsv(nombre, filas) {
  const csv = filas.map((f) => f.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  a.download = nombre; a.click(); URL.revokeObjectURL(a.href);
}

export default function Reportes() {
  const { rol } = useSesion();
  const global = rol?.alcance === 'global';
  const hoy = new Date().toISOString().slice(0, 7);
  const [mes, setMes] = useState(hoy);
  const [suc, setSuc] = useState('');
  const [tabla, setTabla] = useState(false);
  const sucursales = useDatos(() => (global ? api.get('/sucursales') : Promise.resolve([])), [global]);
  const d = useDatos(() => api.get('/reportes', { mes, sucursal_id: suc }), [mes, suc]);
  const r = d.datos;
  const opcionesMes = useMemo(() => Array.from({ length: 24 }, (_, i) => { const f = new Date(); f.setDate(1); f.setMonth(f.getMonth() - i); return f.toISOString().slice(0, 7); }), []);
  const iSel = r ? r.serie.length - 1 : undefined;
  const k = r?.kpi;
  const ingresosSerie = (r?.serie || []).map((s) => ({ x: s.mes, ...s, extra: `${s.cobros} cobro${s.cobros === 1 ? '' : 's'}` }));
  const alumnosSerie = (r?.serie || []).map((s) => ({ x: s.mes, activos: s.activos, extra: `+${s.altas} altas · −${s.bajas} bajas · ${s.asistencias} asistencias` }));

  const csv = () => descargarCsv(`reporte-${mes}.csv`, [
    ['Mes', 'Ingresos', 'Efectivo', 'Transferencia', 'En línea', 'Cobros', 'Alumnos activos', 'Altas', 'Bajas', 'Asistencias'],
    ...r.serie.map((s) => [s.mes, s.ingresos, s.efectivo, s.transferencia, s.en_linea, s.cobros, s.activos, s.altas, s.bajas, s.asistencias]),
  ]);

  return (
    <>
      <Encabezado ruta="Negocio" titulo="Reportes"
        descripcion="Cómo va el dojo: lo que entró, cuántos alumnos hay, quién debe y quién está por irse. Se calcula al momento con los cobros, altas, bajas y asistencias."
        acciones={r && <button onClick={csv} className="inline-flex items-center gap-2 h-10 px-4 rounded-full border border-line-strong text-sm font-semibold hover:bg-inset cursor-pointer"><Download className="size-4" />Descargar CSV</button>} />
      <div className="flex flex-wrap items-end gap-3 mb-5">
        <Selector etiqueta="Mes" value={mes} onChange={(e) => setMes(e.target.value)} className="w-52">
          {opcionesMes.map((m) => <option key={m} value={m}>{mesLargo(m)}</option>)}
        </Selector>
        {global && (
          <Selector etiqueta="Sucursal" value={suc} onChange={(e) => setSuc(e.target.value)} className="w-56">
            <option value="">Todas</option>
            {(sucursales.datos || []).map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </Selector>
        )}
      </div>
      <ErrorCaja error={d.error} reintentar={d.recargar} />
      {d.cargando && !r ? <Cargando texto="Calculando…" /> : r && (
        <div className={cx('space-y-4 transition-opacity', d.cargando && 'opacity-60')}>
          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <Indicador icono={Wallet} etiqueta={`Ingresos de ${mesLargo(r.mes).split(' ')[0]}`} valor={dinero(k.ingresos)}>
              <Variacion ahora={k.ingresos} antes={k.ingresos_anterior} dinero />
            </Indicador>
            <Indicador icono={Users} etiqueta="Alumnos activos" valor={k.activos}>
              <span className="text-[12px] text-muted">+{k.altas} altas · −{k.bajas} bajas en el mes</span>
            </Indicador>
            <Indicador icono={AlertTriangle} etiqueta="Vencido hoy" valor={dinero(k.vencido)}>
              <span className="text-[12px] text-muted">{k.cuentas_vencidas} cuenta{k.cuentas_vencidas === 1 ? '' : 's'} · <Link to="/caja" className="underline hover:text-text">cobrar en Caja</Link></span>
            </Indicador>
            <Indicador icono={CalendarCheck} etiqueta="Asistencias del mes" valor={k.asistencias}>
              <span className="text-[12px] text-muted">{k.asistencias_por_alumno} clases por alumno activo</span>
            </Indicador>
          </div>

          <Tarjeta titulo="Ingresos por mes" subtitulo={`Lo que entró (sin saldo a favor ni cancelados) · ticket promedio ${dinero(k.ticket_promedio)} en ${k.cobros} cobro${k.cobros === 1 ? '' : 's'}`}
            acciones={<button onClick={() => setTabla(!tabla)} className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-text cursor-pointer"><Table2 className="size-4" />{tabla ? 'Ver gráfica' : 'Ver tabla'}</button>}>
            {tabla ? (
              <div className="overflow-x-auto"><table className="w-full text-[13px]"><thead><tr className="text-left text-muted">
                <th className="py-1.5 font-medium">Mes</th>{METODOS.map(([, t]) => <th key={t} className="py-1.5 font-medium text-right">{t}</th>)}<th className="py-1.5 font-medium text-right">Total</th><th className="py-1.5 font-medium text-right">Cobros</th></tr></thead>
                <tbody>{r.serie.map((s) => <tr key={s.mes} className="border-t border-line"><td className="py-1.5">{mesLargo(s.mes)}</td>{METODOS.map(([m]) => <td key={m} className="py-1.5 text-right font-mono">{dinero(s[m])}</td>)}<td className="py-1.5 text-right font-mono font-semibold">{dinero(s.ingresos)}</td><td className="py-1.5 text-right">{s.cobros}</td></tr>)}</tbody>
              </table></div>
            ) : <>
              <Barras datos={ingresosSerie} series={METODOS} etiquetaX={mesCorto} formatoValor={(v, eje) => (eje ? corto(v) : dinero(v))} resaltar={iSel} />
              <div className="mt-2"><Leyenda series={METODOS} /></div>
            </>}
          </Tarjeta>

          <div className="grid lg:grid-cols-2 gap-4">
            <Tarjeta titulo="Alumnos activos" subtitulo="Al cierre de cada mes · pasa el mouse para ver altas, bajas y asistencias">
              <Barras datos={alumnosSerie} series={[['activos', 'Activos', 'var(--serie-1)']]} etiquetaX={mesCorto} formatoValor={(v) => Math.round(v)} alto={200} resaltar={iSel} />
            </Tarjeta>
            <Tarjeta titulo={`Lo vendido en ${mesLargo(r.mes).split(' ')[0]}`} subtitulo="Por concepto (incluye lo pagado con saldo a favor)">
              {!r.por_concepto.length ? <Vacio icono={Wallet} titulo="Sin cobros este mes" texto="Cuando cobres en Caja o paguen en línea aparece aquí." />
                : <Horizontales filas={r.por_concepto.map((c) => ({ etiqueta: c.concepto, valor: c.total, nota: `${c.lineas}` }))} />}
            </Tarjeta>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <Tarjeta titulo="Deuda vencida por antigüedad" subtitulo={`Hoy · ${r.deuda.cuentas} cuenta${r.deuda.cuentas === 1 ? '' : 's'} con algo vencido`}>
              {Number(k.vencido) === 0 ? <Vacio icono={Wallet} titulo="Nadie tiene pagos vencidos" texto="Todos están al corriente." /> : (
                <Horizontales filas={[{ etiqueta: 'Hasta 30 días', valor: r.deuda.d1_30 }, { etiqueta: '31 a 60 días', valor: r.deuda.d31_60 }, { etiqueta: 'Más de 60 días', valor: r.deuda.d61 }]} color="var(--danger)" />
              )}
              <p className="text-[12px] text-muted mt-4">Entre más vieja la deuda, más difícil cobrarla. La lista para cobrar está en <Link to="/caja" className="underline">Caja → Por cobrar</Link>.</p>
            </Tarjeta>
            <Tarjeta titulo="Asistencia por día" subtitulo={`${mesLargo(r.mes)} · ${k.asistencias} asistencias`}>
              <Barras datos={DIAS.map((x, i) => ({ x, titulo: x, asistencias: r.dias_semana[i] }))} series={[['asistencias', 'Asistencias', 'var(--serie-1)']]} etiquetaX={(x) => x} formatoValor={(v) => Math.round(v)} alto={180} />
            </Tarjeta>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <Tarjeta titulo="Alumnos en riesgo de irse" cuerpo="p-0" icono={UserMinus}
              subtitulo="Llevan días sin venir o deben algo vencido hace más de 30 días. Una llamada a tiempo los retiene.">
              {!r.riesgo.length ? <div className="p-5"><Vacio icono={Users} titulo="Nadie en riesgo" texto="Todos vienen y están al corriente." /></div> : (
                <ul className="divide-y divide-line">
                  {r.riesgo.map((a) => (
                    <li key={a.alumno_id}>
                      <Link to={`/alumnos/${a.alumno_id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 hover:bg-inset">
                        <span className="flex-1 min-w-[160px] font-medium">{a.nombre}{global && !suc && <span className="text-[12px] text-muted font-normal"> · {a.sucursal}</span>}</span>
                        {a.motivos.includes('sin_venir') && <Chip tono="aviso">{a.nunca_vino ? `No ha venido (${a.dias_sin_venir} días)` : `${a.dias_sin_venir} días sin venir`}</Chip>}
                        {a.motivos.includes('debe') && <Chip tono="peligro">Debe {dinero(a.debe)} · {a.dias_vencido} días</Chip>}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Tarjeta>
            <Tarjeta titulo="Clases con más asistencia" cuerpo="p-0" subtitulo={mesLargo(r.mes)}>
              {!r.clases.length ? <div className="p-5"><Vacio icono={CalendarCheck} titulo="Sin asistencias este mes" texto="Se registran cuando pasan su QR por la tableta." /></div> : (
                <table className="w-full text-[13px]">
                  <thead><tr className="text-left text-muted"><th className="px-5 py-2 font-medium">Clase</th><th className="py-2 font-medium text-right">Asistencias</th><th className="px-5 py-2 font-medium text-right">Inscritos</th></tr></thead>
                  <tbody>{r.clases.map((c) => (
                    <tr key={c.id} className="border-t border-line">
                      <td className="px-5 py-2"><div className="font-medium">{c.disciplina}{c.nivel ? ` · ${c.nivel}` : ''}</div><div className="text-[12px] text-muted">{DIAS[c.dia_semana - 1]} {c.hora}{global && !suc ? ` · ${c.sucursal}` : ''}</div></td>
                      <td className="py-2 text-right font-mono">{c.asistencias}</td><td className="px-5 py-2 text-right font-mono">{c.inscritos}</td>
                    </tr>))}</tbody>
                </table>
              )}
            </Tarjeta>
          </div>

          {r.por_sucursal.length > 1 && (
            <Tarjeta titulo="Por sucursal" subtitulo={mesLargo(r.mes)} cuerpo="p-0">
              <table className="w-full text-[13px]">
                <thead><tr className="text-left text-muted"><th className="px-5 py-2 font-medium">Sucursal</th><th className="py-2 font-medium text-right">Ingresos</th><th className="py-2 font-medium text-right">Activos</th><th className="px-5 py-2 font-medium text-right">Vencido hoy</th></tr></thead>
                <tbody>{r.por_sucursal.map((s) => (
                  <tr key={s.id} className="border-t border-line hover:bg-inset cursor-pointer" onClick={() => setSuc(String(s.id))}>
                    <td className="px-5 py-2.5 font-medium">{s.sucursal}</td><td className="py-2.5 text-right font-mono">{dinero(s.ingresos)}</td>
                    <td className="py-2.5 text-right font-mono">{s.activos}</td><td className={cx('px-5 py-2.5 text-right font-mono', Number(s.vencido) > 0 && 'text-danger')}>{dinero(s.vencido)}</td>
                  </tr>))}</tbody>
              </table>
            </Tarjeta>
          )}
        </div>
      )}
    </>
  );
}
