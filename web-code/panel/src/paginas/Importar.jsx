import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, History, RotateCcw, Upload, Users } from 'lucide-react';
import { api, formato } from '../api';
import { useSesion } from '../auth/Sesion';
import { Boton, Cargando, Chip, Encabezado, ErrorCaja, Kpi, Selector, Tabla, Tarjeta, Vacio, useAvisos, useConfirmar, useDatos } from '../ui';

// 2.6 · Carga masiva de alumnos desde CSV (migración del sistema anterior).
// Paso 1: se revisa el archivo sin guardar nada y se ve el reporte por renglón. Paso 2: se importan los válidos.
const COLUMNAS = [
  ['nombre', true], ['apellido_paterno', true], ['apellido_materno'], ['fecha_nacimiento', true], ['curp', true], ['sexo'], ['telefono'], ['email'],
  ['fecha_alta'], ['disciplina'], ['grado'], ['responsable_nombre'], ['responsable_apellido'], ['responsable_telefono'], ['responsable_parentesco'],
];
const cx = (...c) => c.filter(Boolean).join(' ');

function plantilla(global) {
  const cols = [...COLUMNAS.map(([c]) => c), ...(global ? ['sucursal'] : [])];
  const filas = [
    ['Jorge', 'Ramírez', 'Soto', '1992-04-18', 'RASJ920418HPLMTR05', 'M', '2221234567', 'jorge@correo.com', '15/03/2025', 'Taekwondo', 'Verde', '', '', '', '', ...(global ? ['CENT'] : [])],
    ['Ana', 'López', 'Cruz', '2015-08-02', 'LOCA150802MPLPRN09', 'F', '', '', '2025-09-01', 'Taekwondo', '9 kup', 'Rosa', 'Cruz', '2227654321', 'madre', ...(global ? ['CENT'] : [])],
  ];
  const texto = '﻿' + [cols, ...filas].map((f) => f.join(',')).join('\r\n') + '\r\n';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([texto], { type: 'text/csv;charset=utf-8' }));
  a.download = 'plantilla_alumnos.csv'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Excel en español suele guardar el CSV en Windows-1252: si no es UTF-8 válido, se lee con esa codificación */
async function leerArchivo(f) {
  const buf = await f.arrayBuffer();
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch { return new TextDecoder('windows-1252').decode(buf); }
}

export default function Importar() {
  const { rol } = useSesion();
  const avisar = useAvisos();
  const confirmar = useConfirmar();
  const global = rol?.alcance === 'global';
  const sucursales = useDatos(() => (global ? api.get('/sucursales') : Promise.resolve([])), [global]);
  const historial = useDatos(() => api.get('/importaciones'), []);
  const [suc, setSuc] = useState('');
  const [archivo, setArchivo] = useState(null);       // {nombre, csv}
  const [reporte, setReporte] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState(null);
  const [trabajando, setTrabajando] = useState(false);
  const [encima, setEncima] = useState(false);
  const input = useRef(null);

  const enviar = (a, confirmarlo = false) => api.post('/alumnos/importar', { archivo: a.nombre, csv: a.csv, sucursal_id: suc || undefined, confirmar: confirmarlo });

  async function elegir(f) {
    if (!f) return;
    if (!/\.(csv|txt)$/i.test(f.name)) { setError(new Error('Sube un archivo .csv. En Excel: Archivo → Guardar como → CSV UTF-8.')); return; }
    setError(null); setReporte(null); setResultado(null); setTrabajando(true);
    try {
      const a = { nombre: f.name, csv: await leerArchivo(f) };
      setArchivo(a);
      setReporte(await enviar(a));
    } catch (e) { setError(e); } finally { setTrabajando(false); if (input.current) input.current.value = ''; }
  }

  async function revisarDeNuevo() {
    if (!archivo) return;
    setTrabajando(true); setError(null);
    try { setReporte(await enviar(archivo)); } catch (e) { setError(e); } finally { setTrabajando(false); }
  }

  async function importar() {
    const r = reporte;
    const ok = await confirmar({ titulo: `¿Importar ${r.validas} alumno${r.validas !== 1 ? 's' : ''}?`, aceptar: 'Importar',
      texto: `${r.con_error ? `Los ${r.con_error} renglones con error se omiten; corrígelos y súbelos después en otro archivo. ` : ''}Cada alumno recibe su matrícula y credencial. La foto se toma después en su ficha.` });
    if (!ok) return;
    setTrabajando(true); setError(null);
    try {
      const res = await enviar(archivo, true);
      setResultado(res); setReporte(null); setArchivo(null);
      avisar(`${res.creados} alumnos importados`); historial.recargar();
    } catch (e) { setError(e); } finally { setTrabajando(false); }
  }

  async function revertir(i) {
    const ok = await confirmar({ titulo: `¿Revertir la carga "${i.archivo}"?`, peligro: true, aceptar: 'Revertir',
      texto: `Se borran los ${i.alumnos} alumnos que creó y los responsables que ya no pagan por nadie. Solo se puede si ninguno tiene clases, pagos, asistencias o exámenes.` });
    if (!ok) return;
    try { const r = await api.put(`/importaciones/${i.id}/revertir`); avisar(`Carga revertida: ${r.alumnos_borrados} alumnos borrados`, 'aviso'); historial.recargar(); }
    catch (e) { avisar(e.message, 'error'); }
  }

  const r = reporte;
  return (
    <>
      <Encabezado ruta={<Link to="/alumnos" className="hover:text-text">Personas · Alumnos</Link>} titulo="Importar alumnos"
        descripcion="Para pasar a los alumnos que ya venían. Primero se revisa el archivo y ves los errores por renglón; nada se guarda hasta que confirmas."
        acciones={<Boton variante="secundario" icono={Download} onClick={() => plantilla(global)}>Descargar plantilla</Boton>} />

      <div className="grid xl:grid-cols-[1fr_360px] gap-4 items-start">
        <div className="space-y-4 min-w-0">
          {global && !resultado && (
            <Selector etiqueta="Sucursal de los alumnos (si el archivo no trae la columna sucursal)" value={suc} onChange={(e) => setSuc(e.target.value)} className="max-w-md">
              <option value="">La indica el archivo</option>
              {(sucursales.datos || []).map((s) => <option key={s.id} value={s.id}>{s.nombre} ({s.clave})</option>)}
            </Selector>
          )}
          {!r && !resultado && (
            <Tarjeta titulo="Sube el archivo" subtitulo="CSV guardado desde Excel o Google Sheets" icono={FileSpreadsheet}>
              <label onDragOver={(e) => { e.preventDefault(); setEncima(true); }} onDragLeave={() => setEncima(false)}
                onDrop={(e) => { e.preventDefault(); setEncima(false); elegir(e.dataTransfer.files[0]); }}
                className={cx('flex flex-col items-center justify-center gap-3 rounded-[12px] border-2 border-dashed px-6 py-12 text-center cursor-pointer transition-colors',
                  encima ? 'border-action bg-action/10' : 'border-line-strong hover:border-action')}>
                <input ref={input} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => elegir(e.target.files[0])} />
                {trabajando ? <Cargando texto="Revisando renglón por renglón…" className="py-0" /> : (
                  <>
                    <span className="grid place-items-center size-12 rounded-full bg-inset text-action"><Upload className="size-5" /></span>
                    <div className="font-semibold">Arrastra aquí el archivo o haz clic para elegirlo</div>
                    <div className="text-[13px] text-muted">Hasta 2,000 alumnos por archivo. Separado por comas o punto y coma.</div>
                  </>
                )}
              </label>
              <div className="mt-3"><ErrorCaja error={error} /></div>
            </Tarjeta>
          )}

          {r && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 anim-entrar">
                <Kpi etiqueta="Renglones" valor={r.filas} detalle={r.archivo} icono={FileSpreadsheet} />
                <Kpi etiqueta="Listos" valor={r.validas} detalle="se importarán" tono="ok" icono={CheckCircle2} />
                <Kpi etiqueta="Con error" valor={r.con_error} detalle={r.con_error ? 'se omiten' : 'ninguno'} tono={r.con_error ? 'peligro' : 'ok'} icono={AlertTriangle} />
                <Kpi etiqueta="Sin foto" valor={r.validas} detalle="se toma en su ficha" tono="oro" icono={Users} />
              </div>
              {r.errores.length > 0 && (
                <Tarjeta titulo="Renglones con error" subtitulo="El renglón 1 es el encabezado. Corrige el archivo y vuelve a subirlo, o importa solo los que están listos." icono={AlertTriangle} cuerpo="p-0">
                  <div className="max-h-96 overflow-y-auto">
                    <Tabla filas={r.errores.map((e, i) => ({ ...e, id: i }))} columnas={[
                      { k: 'fila', t: 'Renglón', r: (e) => <span className="font-mono">{e.fila}</span> },
                      { k: 'nombre', t: 'Alumno', r: (e) => e.nombre || <span className="text-muted">—</span> },
                      { k: 'campo', t: 'Columna', r: (e) => <span className="font-mono text-[13px]">{e.campo}</span> },
                      { k: 'mensaje', t: 'Problema', r: (e) => <span className="text-danger">{e.mensaje}</span> },
                    ]} />
                  </div>
                </Tarjeta>
              )}
              <Tarjeta titulo="Vista previa" subtitulo={`Primeros ${r.muestra.length} renglones`} cuerpo="p-0">
                <Tabla filas={r.muestra} clave="fila" columnas={[
                  { k: 'fila', t: '#', r: (m) => <span className="font-mono text-muted">{m.fila}</span> },
                  { k: 'nombre', t: 'Alumno', r: (m) => <div><div className="font-medium whitespace-nowrap">{m.nombre}</div><div className="font-mono text-[12px] text-muted">{m.curp}</div></div> },
                  { k: 'responsable', t: 'Paga', r: (m) => <span className="text-[13px]">{m.responsable}</span> },
                  { k: 'grado', t: 'Grado', r: (m) => m.grado || <span className="text-muted">—</span> },
                  { k: 'fecha_alta', t: 'Alta', r: (m) => <span className="whitespace-nowrap">{formato.fecha(m.fecha_alta)}</span> },
                  { k: 'ok', t: '', r: (m) => m.ok ? <Chip tono="ok">Listo</Chip> : <Chip tono="peligro">Con error</Chip> },
                ]} />
              </Tarjeta>
              <ErrorCaja error={error} />
              <div className="flex flex-wrap justify-end gap-2">
                <Boton variante="secundario" onClick={() => { setReporte(null); setArchivo(null); }}>Cambiar archivo</Boton>
                {global && <Boton variante="secundario" onClick={revisarDeNuevo} cargando={trabajando}>Revisar de nuevo</Boton>}
                <Boton icono={Upload} disabled={!r.validas} cargando={trabajando} onClick={importar}>Importar {r.validas} alumno{r.validas !== 1 && 's'}</Boton>
              </div>
            </>
          )}

          {resultado && (
            <Tarjeta>
              <div className="text-center py-6 anim-entrar">
                <CheckCircle2 className="size-12 text-ok mx-auto mb-3" />
                <h2 className="text-[24px]">{resultado.creados} alumnos importados</h2>
                <p className="text-muted mt-1">{resultado.con_error ? `${resultado.con_error} renglones con error no se importaron.` : 'Todos los renglones se importaron.'} Ya tienen matrícula y credencial; falta tomarles la foto.</p>
                <div className="flex justify-center gap-2 mt-5">
                  <Boton variante="secundario" onClick={() => setResultado(null)}>Importar otro archivo</Boton>
                  <Link to="/alumnos"><Boton icono={Users}>Ver alumnos</Boton></Link>
                </div>
              </div>
            </Tarjeta>
          )}
        </div>

        <div className="space-y-4">
          <Tarjeta titulo="Columnas" subtitulo="En negritas las obligatorias; el orden no importa">
            <div className="flex flex-wrap gap-1.5">
              {COLUMNAS.map(([c, ob]) => <span key={c} className={cx('font-mono text-[12px] rounded px-1.5 py-0.5 bg-inset', ob ? 'text-text font-semibold' : 'text-muted')}>{c}</span>)}
              {global && <span className="font-mono text-[12px] rounded px-1.5 py-0.5 bg-inset text-muted">sucursal</span>}
            </div>
            <ul className="text-[13px] text-muted mt-3 space-y-1.5 list-disc pl-4">
              <li>Fechas como <span className="font-mono">2025-03-15</span> o <span className="font-mono">15/03/2025</span>.</li>
              <li><b className="text-soft">fecha_alta</b> define su día de cobro; si se deja vacía es hoy.</li>
              <li>Grado por nombre (<span className="font-mono">8 kup</span>) o color de cinta (<span className="font-mono">Amarilla</span>).</li>
              <li>Menores de edad necesitan responsable. Hermanos con el mismo teléfono de responsable quedan con la misma persona.</li>
            </ul>
          </Tarjeta>
          <Tarjeta titulo="Cargas anteriores" icono={History} cuerpo="p-0">
            {historial.cargando && !historial.datos ? <Cargando /> : !historial.datos?.length ? <Vacio titulo="Sin cargas todavía" /> : (
              <ul className="divide-y divide-line">
                {historial.datos.map((i) => (
                  <li key={i.id} className="px-5 py-3 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate flex-1">{i.archivo}</span>
                      <Chip tono={i.estado === 'revertida' ? 'info' : i.estado === 'con_errores' ? 'aviso' : 'ok'}>{i.estado === 'con_errores' ? 'con errores' : i.estado}</Chip>
                    </div>
                    <div className="text-[12px] text-muted mt-0.5">{formato.fechaHora(i.fecha)} · {i.filas_ok} importados{Number(i.filas_error) ? ` · ${i.filas_error} con error` : ''}{i.sucursales ? ` · ${i.sucursales}` : ''}</div>
                    {i.estado !== 'revertida' && Number(i.alumnos) > 0 && (
                      <button onClick={() => revertir(i)} className="mt-1.5 inline-flex items-center gap-1 text-[12px] font-semibold text-muted hover:text-danger cursor-pointer"><RotateCcw className="size-3" />Revertir</button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Tarjeta>
        </div>
      </div>
    </>
  );
}
