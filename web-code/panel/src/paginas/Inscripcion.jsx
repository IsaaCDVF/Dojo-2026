import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Camera, CheckCircle2, Clock, Search, UserPlus, Users } from 'lucide-react';
import { api, DIAS, formato, nombreCompleto } from '../api';
import { useSesion } from '../auth/Sesion';
import { Boton, Campo, Cargando, Chip, Cinta, ErrorCaja, Pasos, Selector, Tarjeta, Vacio, useAvisos, useConfirmar, useDatos } from '../ui';
import { inscribir } from './inscribir';

// S-03 · Inscripción en 4 pasos: alumno → responsable de pago → clase → cuenta inicial
const PASOS = ['Alumno', 'Responsable', 'Clase', 'Cuenta'];
const CURP = /^[A-Z][AEIOUX][A-Z]{2}\d{6}[HMX][A-Z]{5}[A-Z\d]\d$/;
const edadDe = (f) => { if (!f) return null; const n = new Date(f + 'T00:00'); const h = new Date(); let e = h.getFullYear() - n.getFullYear(); if (h < new Date(h.getFullYear(), n.getMonth(), n.getDate())) e--; return e; };

/** Reduce la foto a 640 px JPG para que pese poco */
function reducirFoto(archivo) {
  return new Promise((ok, mal) => {
    const img = new Image();
    img.onload = () => {
      const lado = 640; const r = Math.min(1, lado / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      ok(c.toDataURL('image/jpeg', 0.85)); URL.revokeObjectURL(img.src);
    };
    img.onerror = () => mal(new Error('No se pudo leer la imagen'));
    img.src = URL.createObjectURL(archivo);
  });
}

function PasoAlumno({ a, setA, errores }) {
  const input = useRef(null);
  const set = (k) => (e) => setA({ ...a, [k]: e.target.value });
  const edad = edadDe(a.fecha_nacimiento);
  const elegirFoto = async (e) => { const f = e.target.files?.[0]; if (f) setA({ ...a, foto: await reducirFoto(f) }); };
  return (
    <div className="grid md:grid-cols-[200px_1fr] gap-6">
      <div>
        <span className="etiqueta block mb-1.5">Foto (obligatoria)</span>
        <button type="button" onClick={() => input.current?.click()}
          className={`relative grid place-items-center w-full aspect-square rounded-[12px] border-2 border-dashed overflow-hidden cursor-pointer transition-colors ${errores.foto ? 'border-danger' : 'border-line-strong hover:border-action'} bg-inset`}>
          {a.foto ? <img src={a.foto} alt="Foto del alumno" className="absolute inset-0 size-full object-cover" /> : (
            <span className="text-center text-muted text-sm px-4"><Camera className="size-7 mx-auto mb-2" />Tomar o subir foto</span>)}
        </button>
        <input ref={input} type="file" accept="image/*" capture="user" className="hidden" onChange={elegirFoto} />
        {a.foto && <button type="button" className="text-[13px] text-link mt-2 cursor-pointer" onClick={() => input.current?.click()}>Cambiar foto</button>}
        {errores.foto && <p className="text-[13px] text-danger mt-1.5">{errores.foto}</p>}
      </div>
      <div className="grid sm:grid-cols-3 gap-4 content-start">
        <Campo etiqueta="Nombre(s)" value={a.nombre} onChange={set('nombre')} error={errores.nombre} autoFocus />
        <Campo etiqueta="Apellido paterno" value={a.apellido_paterno} onChange={set('apellido_paterno')} error={errores.apellido_paterno} />
        <Campo etiqueta="Apellido materno" value={a.apellido_materno} onChange={set('apellido_materno')} />
        <Campo etiqueta="Fecha de nacimiento" type="date" value={a.fecha_nacimiento} onChange={set('fecha_nacimiento')} error={errores.fecha_nacimiento}
          ayuda={edad !== null && edad >= 0 ? `${edad} años${edad < 18 ? ' · menor de edad' : ''}` : undefined} />
        <Selector etiqueta="Sexo" value={a.sexo} onChange={set('sexo')}><option value="">Sin indicar</option><option value="F">Femenino</option><option value="M">Masculino</option><option value="X">No binario</option></Selector>
        <Campo etiqueta="CURP" value={a.curp} maxLength={18} onChange={(e) => setA({ ...a, curp: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })} error={errores.curp}
          derecha={<span className="font-mono text-[11px] text-muted">{a.curp.length}/18</span>} />
        <Campo etiqueta="Teléfono del alumno" inputMode="tel" value={a.telefono} onChange={set('telefono')} error={errores.telefono} placeholder="Opcional" />
        <Campo className="sm:col-span-2" etiqueta="Correo del alumno" type="email" value={a.email} onChange={set('email')} error={errores.email} placeholder="Opcional" />
      </div>
    </div>
  );
}

function PasoResponsable({ r, setR, edad, errores }) {
  const [q, setQ] = useState('');
  const [buscar, setBuscar] = useState('');
  useEffect(() => { const t = setTimeout(() => setBuscar(q.trim()), 300); return () => clearTimeout(t); }, [q]);
  const resultados = useDatos(() => (r.modo === 'existente' && buscar.length >= 2 ? api.get('/responsables', { buscar }) : Promise.resolve([])), [buscar, r.modo]);
  const set = (k) => (e) => setR({ ...r, [k]: e.target.value });
  const modos = [
    { m: 'nuevo', t: 'Nuevo responsable', d: 'Mamá, papá, tutor…', icono: UserPlus },
    { m: 'existente', t: 'Ya paga por otro alumno', d: 'Hermanos con la misma cuenta', icono: Users },
    ...(edad >= 18 ? [{ m: 'el_mismo', t: 'Paga él mismo', d: 'Alumno mayor de edad', icono: CheckCircle2 }] : []),
  ];
  return (
    <div className="space-y-5">
      <div className="grid sm:grid-cols-3 gap-2">
        {modos.map((o) => (
          <button key={o.m} type="button" onClick={() => setR({ ...r, modo: o.m })}
            className={`text-left rounded-[10px] border p-4 cursor-pointer transition-colors ${r.modo === o.m ? 'border-action bg-action/10' : 'border-line bg-inset hover:border-line-strong'}`}>
            <o.icono className="size-5 text-action mb-2" /><div className="font-semibold text-sm">{o.t}</div><div className="text-[12px] text-muted">{o.d}</div>
          </button>
        ))}
      </div>
      {edad !== null && edad < 18 && <p className="text-[13px] text-warn">El alumno es menor de edad: necesita un responsable de pago adulto.</p>}
      {r.modo === 'nuevo' && (
        <div className="grid sm:grid-cols-3 gap-4 anim-entrar">
          <Campo etiqueta="Nombre(s)" value={r.nombre} onChange={set('nombre')} error={errores.nombre} />
          <Campo etiqueta="Apellido paterno" value={r.apellido_paterno} onChange={set('apellido_paterno')} error={errores.apellido_paterno} />
          <Campo etiqueta="Apellido materno" value={r.apellido_materno} onChange={set('apellido_materno')} />
          <Campo etiqueta="Teléfono (10 dígitos)" inputMode="tel" value={r.telefono} onChange={set('telefono')} error={errores.telefono} />
          <Campo etiqueta="Correo (avisos y facturas)" type="email" value={r.email} onChange={set('email')} error={errores.email} />
          <Selector etiqueta="Parentesco" value={r.parentesco} onChange={set('parentesco')}>
            {['madre', 'padre', 'tutor', 'abuela', 'abuelo', 'tía', 'tío', 'esposa', 'esposo', 'otro'].map((p) => <option key={p}>{p}</option>)}
          </Selector>
        </div>
      )}
      {r.modo === 'existente' && (
        <div className="anim-entrar">
          <Campo icono={Search} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre o teléfono del responsable" error={errores.id} />
          <div className="mt-3 space-y-2">
            {resultados.cargando && buscar.length >= 2 && <Cargando texto="Buscando…" className="!py-4" />}
            {(resultados.datos || []).map((x) => (
              <button key={x.id} type="button" onClick={() => setR({ ...r, id: x.id, elegido: x })}
                className={`w-full flex items-center gap-3 rounded-[10px] border px-4 py-3 text-left cursor-pointer ${r.id === x.id ? 'border-action bg-action/10' : 'border-line hover:bg-inset'}`}>
                <div className="flex-1"><div className="font-medium">{nombreCompleto(x)}</div><div className="text-[12px] text-muted font-mono">{x.telefono || 'sin teléfono'}</div></div>
                <Chip>{x.alumnos_a_cargo} alumno{x.alumnos_a_cargo === '1' ? '' : 's'}</Chip>
              </button>
            ))}
            {buscar.length >= 2 && !resultados.cargando && !resultados.datos?.length && <p className="text-sm text-muted">Nadie coincide. Regístralo como nuevo responsable.</p>}
          </div>
          {r.id && <Selector className="mt-4 max-w-xs" etiqueta="Parentesco con el alumno" value={r.parentesco} onChange={set('parentesco')}>
            {['madre', 'padre', 'tutor', 'abuela', 'abuelo', 'tía', 'tío', 'esposa', 'esposo', 'otro'].map((p) => <option key={p}>{p}</option>)}
          </Selector>}
        </div>
      )}
      {r.modo === 'el_mismo' && <p className="text-sm text-soft anim-entrar">Los cobros y avisos de pago se harán a nombre del alumno.</p>}
    </div>
  );
}

function PasoClase({ c, setC, sucursal, errores }) {
  const disciplinas = useDatos(() => api.get('/disciplinas'), []);
  const activas = (disciplinas.datos || []).filter((d) => Number(d.activa));
  const disc = c.disciplina_id || String(activas[0]?.id || '');
  const horarios = useDatos(() => (disc && sucursal ? api.get('/horarios', { sucursal_id: sucursal, disciplina_id: disc }) : Promise.resolve([])), [disc, sucursal]);
  const grados = useDatos(() => (disc ? api.get(`/disciplinas/${disc}/grados`) : Promise.resolve([])), [disc]);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {activas.map((d) => (
          <button key={d.id} type="button" onClick={() => setC({ disciplina_id: String(d.id), horario_id: '', grado_id: '' })}
            className={`h-10 px-5 rounded-full border text-sm font-semibold cursor-pointer ${disc === String(d.id) ? 'bg-action text-on-action border-action' : 'border-line bg-inset text-soft hover:border-line-strong'}`}>{d.nombre}</button>
        ))}
      </div>
      <div>
        <span className="etiqueta block mb-2">Clase</span>
        {horarios.cargando ? <Cargando /> : !horarios.datos?.length ? <Vacio titulo="Sin clases de esta disciplina" texto="Agrégalas en Horarios." /> : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {horarios.datos.map((h) => {
              const lleno = h.cupo && Number(h.inscritos) >= Number(h.cupo);
              return (
                <button key={h.id} type="button" onClick={() => setC({ ...c, disciplina_id: disc, horario_id: String(h.id) })}
                  className={`text-left rounded-[10px] border p-3.5 cursor-pointer transition-colors ${c.horario_id === String(h.id) ? 'border-action bg-action/10' : 'border-line bg-inset/40 hover:border-line-strong'}`}>
                  <div className="flex items-center justify-between"><span className="font-semibold text-sm">{DIAS[h.dia_semana]}</span>{lleno ? <Chip tono="peligro">Llena</Chip> : h.cupo && <Chip>{h.inscritos}/{h.cupo}</Chip>}</div>
                  <div className="flex items-center gap-1.5 text-[13px] text-muted mt-0.5"><Clock className="size-3" />{h.hora_inicio}–{h.hora_fin}</div>
                  <div className="text-[13px] text-soft mt-1.5">{h.nivel || 'Todos los niveles'}</div>
                  <div className="text-[12px] text-muted">{h.grado_desde || 'Inicio'} → {h.grado_hasta || 'Fin'} · {h.instructor}</div>
                </button>
              );
            })}
          </div>
        )}
        {errores.horario_id && <p className="text-[13px] text-danger mt-2">{errores.horario_id}</p>}
      </div>
      <Selector className="max-w-sm" etiqueta="Grado (evaluación de ubicación)" value={c.grado_id} onChange={(e) => setC({ ...c, disciplina_id: disc, grado_id: e.target.value })}>
        <option value="">Principiante (primer grado)</option>
        {(grados.datos || []).map((g) => <option key={g.id} value={g.id}>{g.nombre} · {g.color_cinta}</option>)}
      </Selector>
      <p className="text-[13px] text-muted -mt-2">Si ya practicaba, el instructor indica su grado; si no, empieza en el primero.</p>
    </div>
  );
}

function PasoCuenta({ cuenta, setCuenta, sucursal }) {
  const conceptos = useDatos(() => api.get('/conceptos'), []);
  const [res, setRes] = useState(null);
  const [err, setErr] = useState(null);
  const base = useMemo(() => (conceptos.datos || []).filter((x) => ['inscripcion', 'mensualidad'].includes(x.tipo)).map((x) => x.id), [conceptos.datos]);
  const productos = (conceptos.datos || []).filter((x) => x.tipo === 'producto');
  const lista = useMemo(() => [...base, ...cuenta.productos].map((id) => ({ concepto_id: Number(id) })), [base, cuenta.productos]);
  useEffect(() => {
    if (!lista.length) return;
    let vivo = true;
    const t = setTimeout(() => api.post('/cotizar', { sucursal_id: sucursal, codigo: cuenta.codigo, conceptos: lista })
      .then((r) => { if (vivo) { setRes(r); setErr(null); setCuenta((c) => ({ ...c, total: r.total })); } })
      .catch((e) => vivo && setErr(e)), 350);
    return () => { vivo = false; clearTimeout(t); };
  }, [lista, cuenta.codigo, sucursal, setCuenta]);
  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="space-y-4">
        <div>
          <span className="etiqueta block mb-2">Se cobra siempre</span>
          <div className="flex flex-wrap gap-2">{(conceptos.datos || []).filter((x) => base.includes(x.id)).map((x) => <Chip key={x.id} tono="accion">{x.nombre}</Chip>)}</div>
        </div>
        {!!productos.length && (
          <div>
            <span className="etiqueta block mb-2">Artículos (opcional)</span>
            <div className="rounded-[10px] border border-line divide-y divide-line">
              {productos.map((p) => (
                <label key={p.id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-inset">
                  <input type="checkbox" className="size-4 accent-[var(--action)]" checked={cuenta.productos.includes(p.id)}
                    onChange={(e) => setCuenta({ ...cuenta, productos: e.target.checked ? [...cuenta.productos, p.id] : cuenta.productos.filter((x) => x !== p.id) })} />
                  <span className="text-sm">{p.nombre}</span>
                </label>
              ))}
            </div>
          </div>
        )}
        <Campo etiqueta="Código de paquete o promoción" value={cuenta.codigo} onChange={(e) => setCuenta({ ...cuenta, codigo: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '') })} placeholder="NOV2026"
          error={err && cuenta.codigo ? err.message : undefined} ayuda="Si el código no existe o venció, se cobra a precio normal." />
      </div>
      <div className="rounded-[12px] border border-line bg-inset/40">
        <div className="px-4 py-3 border-b border-line flex items-center justify-between"><span className="font-semibold">Cuenta inicial</span>{res?.promocion && <Chip tono="accion">{res.promocion.nombre}</Chip>}</div>
        {!res ? (err && !cuenta.codigo ? <div className="p-4"><ErrorCaja error={err} /></div> : <Cargando />) : (
          <>
            <ul className="divide-y divide-line">
              {res.lineas.map((l) => (
                <li key={l.concepto_id} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <span className="flex-1">{l.concepto}</span>
                  {Number(l.descuento) > 0 && <span className="text-[12px] text-muted line-through">{formato.dinero(l.importe)}</span>}
                  <span className="font-semibold w-24 text-right">{formato.dinero(l.total)}</span>
                </li>
              ))}
            </ul>
            <div className="px-4 py-3 border-t border-line space-y-1 text-sm">
              {Number(res.descuento) > 0 && <div className="flex justify-between text-ok"><span>Ahorro</span><span>− {formato.dinero(res.descuento)}</span></div>}
              <div className="flex justify-between text-[22px] font-semibold"><span>Total</span><span>{formato.dinero(res.total)}</span></div>
              <p className="text-[12px] text-muted pt-1">El cobro se registra en Caja.</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const VACIO = { alumno: { nombre: '', apellido_paterno: '', apellido_materno: '', fecha_nacimiento: '', sexo: '', curp: '', telefono: '', email: '', foto: '' },
  resp: { modo: 'nuevo', nombre: '', apellido_paterno: '', apellido_materno: '', telefono: '', email: '', parentesco: 'madre', id: null },
  clase: { disciplina_id: '', horario_id: '', grado_id: '' }, cuenta: { productos: [], codigo: '', total: null } };

export default function Inscripcion() {
  const { rol } = useSesion();
  const avisar = useAvisos();
  const confirmar = useConfirmar();
  const sucursales = useDatos(() => api.get('/sucursales'), []);
  const [sucElegida, setSucElegida] = useState('');
  const sucursal = rol?.alcance === 'global' ? (sucElegida || String(sucursales.datos?.find((s) => Number(s.activa))?.id || '')) : String(rol?.sucursal_id || '');
  const [paso, setPaso] = useState(0);
  const [alumno, setAlumno] = useState(VACIO.alumno);
  const [resp, setResp] = useState(VACIO.resp);
  const [clase, setClase] = useState(VACIO.clase);
  const [cuenta, setCuenta] = useState(VACIO.cuenta);
  const [errores, setErrores] = useState({});
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [listo, setListo] = useState(null);
  const edad = edadDe(alumno.fecha_nacimiento);

  const validar = () => {
    const e = {};
    if (paso === 0) {
      if (!alumno.foto) e.foto = 'Toma o sube una foto';
      if (!alumno.nombre.trim()) e.nombre = 'Obligatorio';
      if (!alumno.apellido_paterno.trim()) e.apellido_paterno = 'Obligatorio';
      if (!alumno.fecha_nacimiento || edad === null || edad < 2 || edad > 100) e.fecha_nacimiento = 'Fecha no válida';
      if (!CURP.test(alumno.curp)) e.curp = 'Debe tener 18 caracteres con el formato de la CURP';
      if (alumno.telefono && alumno.telefono.replace(/\D/g, '').length !== 10) e.telefono = '10 dígitos';
      if (alumno.email && !/^\S+@\S+\.\S+$/.test(alumno.email)) e.email = 'Correo no válido';
    }
    if (paso === 1) {
      if (resp.modo === 'el_mismo' && edad < 18) e.modo = 'Menor de edad';
      if (resp.modo === 'existente' && !resp.id) e.id = 'Elige al responsable de la lista';
      if (resp.modo === 'nuevo') {
        if (!resp.nombre.trim()) e.nombre = 'Obligatorio';
        if (!resp.apellido_paterno.trim()) e.apellido_paterno = 'Obligatorio';
        if (resp.telefono.replace(/\D/g, '').length !== 10) e.telefono = '10 dígitos';
        if (resp.email && !/^\S+@\S+\.\S+$/.test(resp.email)) e.email = 'Correo no válido';
      }
    }
    if (paso === 2 && !clase.horario_id) e.horario_id = 'Elige una clase';
    setErrores(e);
    return !Object.keys(e).length;
  };
  const siguiente = () => { if (validar()) { setError(null); setPaso(paso + 1); } };
  useEffect(() => { if (resp.modo === 'el_mismo' && edad !== null && edad < 18) setResp((r) => ({ ...r, modo: 'nuevo' })); }, [edad, resp.modo]);

  const terminar = async () => {
    setGuardando(true); setError(null);
    try {
      const responsable = resp.modo === 'el_mismo' ? { el_mismo: true } : resp.modo === 'existente' ? { id: resp.id, parentesco: resp.parentesco }
        : { nombre: resp.nombre, apellido_paterno: resp.apellido_paterno, apellido_materno: resp.apellido_materno, telefono: resp.telefono, email: resp.email, parentesco: resp.parentesco };
      const a = await api.post('/alumnos', { ...alumno, sucursal_id: sucursal, responsable });
      const r = await inscribir({ alumno_id: a.id, horario_id: Number(clase.horario_id), grado_id: clase.grado_id || undefined }, confirmar);
      setListo({ ...a, inscrito: r.ok, aviso: r.ok ? null : (r.error || 'No se inscribió en la clase') });
      avisar(r.ok ? `${alumno.nombre} inscrito · matrícula ${a.matricula}` : `${alumno.nombre} quedó registrado, pero falta su clase`, r.ok ? 'ok' : 'aviso');
    } catch (e) {
      setError(e);
      if (e.detalle?.campo === 'curp' || e.detalle?.campo === 'fecha_nacimiento') { setErrores({ [e.detalle.campo]: e.message }); setPaso(0); }
      else if (e.detalle?.campo === 'responsable' || String(e.detalle?.faltan?.[0] || '').startsWith('responsable')) setPaso(1);
    } finally { setGuardando(false); }
  };
  const reiniciar = () => { setAlumno(VACIO.alumno); setResp(VACIO.resp); setClase(VACIO.clase); setCuenta(VACIO.cuenta); setErrores({}); setError(null); setListo(null); setPaso(0); };

  if (listo) return (
    <div className="max-w-lg mx-auto text-center py-10 anim-entrar">
      <div className="mx-auto grid place-items-center size-16 rounded-full bg-ok-bg text-ok mb-4"><CheckCircle2 className="size-8" /></div>
      <h1 className="text-[30px]">{listo.inscrito ? '¡Inscripción lista!' : 'Alumno registrado'}</h1>
      <p className="text-muted mt-1">{nombreCompleto(alumno)}</p>
      <div className="inline-block mt-5 rounded-[12px] border border-line bg-surface px-6 py-4">
        <div className="etiqueta">Matrícula</div><div className="font-mono text-[26px] text-gold mt-1">{listo.matricula}</div>
      </div>
      {listo.aviso && <p className="text-warn text-sm mt-4">{listo.aviso}. Agrégalo a una clase desde su ficha.</p>}
      {cuenta.total && <p className="text-soft mt-4">Total a cobrar en caja: <b>{formato.dinero(cuenta.total)}</b></p>}
      <div className="flex flex-wrap justify-center gap-2 mt-6">
        <Link to={`/alumnos/${listo.id}`}><Boton variante="secundario">Ver ficha y credencial</Boton></Link>
        <Boton icono={UserPlus} onClick={reiniciar}>Inscribir a otro</Boton>
      </div>
    </div>
  );

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
        <div><div className="etiqueta mb-2">Recepción</div><h1 className="text-[30px]">Inscribir alumno</h1></div>
        {rol?.alcance === 'global' && (
          <Selector className="w-64" etiqueta="Sucursal" value={sucursal} onChange={(e) => { setSucElegida(e.target.value); setClase(VACIO.clase); }}>
            {(sucursales.datos || []).filter((s) => Number(s.activa)).map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </Selector>
        )}
      </div>
      <Pasos pasos={PASOS} actual={paso} onIr={setPaso} />
      <Tarjeta className="mt-4" cuerpo="p-5 sm:p-6">
        <div key={paso} className="anim-entrar">
          {paso === 0 && <PasoAlumno a={alumno} setA={setAlumno} errores={errores} />}
          {paso === 1 && <PasoResponsable r={resp} setR={setResp} edad={edad} errores={errores} />}
          {paso === 2 && <PasoClase c={clase} setC={setClase} sucursal={sucursal} errores={errores} />}
          {paso === 3 && <PasoCuenta cuenta={cuenta} setCuenta={setCuenta} sucursal={sucursal} />}
        </div>
        {error && <div className="mt-5"><ErrorCaja error={error} /></div>}
        <div className="flex justify-between gap-2 mt-6 pt-5 border-t border-line">
          <Boton variante="secundario" icono={ArrowLeft} disabled={paso === 0} onClick={() => setPaso(paso - 1)}>Atrás</Boton>
          {paso < 3 ? <Boton onClick={siguiente}>Siguiente <ArrowRight className="size-4" /></Boton>
            : <Boton cargando={guardando} onClick={terminar} icono={CheckCircle2}>Inscribir</Boton>}
        </div>
      </Tarjeta>
    </>
  );
}
