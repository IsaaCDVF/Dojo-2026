import { useState } from 'react';
import { Building2, Layers, Pencil, Plus, Power } from 'lucide-react';
import { api } from '../api';
import { useSesion } from '../auth/Sesion';
import { Boton, Campo, Cargando, Chip, Encabezado, ErrorCaja, Modal, Tarjeta, Vacio, useAvisos, useConfirmar, useDatos } from '../ui';

// Configuración: sucursales, disciplinas y grados (catálogos base)
const COLORES = { blanca: '#f4f4f5', amarilla: '#facc15', naranja: '#fb923c', verde: '#22c55e', azul: '#3b82f6', morada: '#a855f7', roja: '#ef4444', cafe: '#92400e', café: '#92400e', negra: '#111827' };
const colorCinta = (t) => { const k = Object.keys(COLORES).find((c) => (t || '').toLowerCase().includes(c)); return k ? COLORES[k] : 'var(--line-strong)'; };

function Sucursales() {
  const { tiene } = useSesion();
  const avisar = useAvisos();
  const confirmar = useConfirmar();
  const datos = useDatos(() => api.get('/sucursales'), []);
  const [form, setForm] = useState(null);
  const [err, setErr] = useState('');
  const [guardando, setGuardando] = useState(false);
  const puede = tiene('sucursales.gestionar');

  const guardar = async () => {
    setGuardando(true); setErr('');
    try {
      if (form.id) await api.put(`/sucursales/${form.id}`, { nombre: form.nombre });
      else await api.post('/sucursales', { clave: form.clave, nombre: form.nombre });
      avisar(form.id ? 'Sucursal actualizada' : `Sucursal ${form.nombre} creada`);
      setForm(null); datos.recargar();
    } catch (e) { setErr(e.message); } finally { setGuardando(false); }
  };
  const alternar = async (s) => {
    const activa = Number(s.activa);
    if (activa && !(await confirmar({ titulo: 'Desactivar sucursal', texto: `${s.nombre} dejará de aparecer para inscribir y cobrar. Su historial se conserva.`, aceptar: 'Desactivar', peligro: true }))) return;
    try { await api.put(`/sucursales/${s.id}`, { activa: activa ? 0 : 1 }); avisar(activa ? 'Sucursal desactivada' : 'Sucursal activada', 'info'); datos.recargar(); }
    catch (e) { avisar(e.message, 'error'); }
  };

  return (
    <Tarjeta titulo="Sucursales" subtitulo="La clave de 4 letras es el prefijo de matrículas y recibos" icono={Building2} cuerpo="p-0"
      acciones={puede && <Boton tam="sm" icono={Plus} onClick={() => { setForm({ clave: '', nombre: '' }); setErr(''); }}>Sucursal</Boton>}>
      <div className="px-5 pt-3"><ErrorCaja error={datos.error} reintentar={datos.recargar} /></div>
      {datos.cargando && !datos.datos ? <Cargando /> : (
        <ul className="divide-y divide-line">
          {(datos.datos || []).map((s) => (
            <li key={s.id} className="flex items-center gap-4 px-5 py-3.5">
              <span className="font-mono text-[13px] px-2 py-1 rounded bg-inset text-gold">{s.clave}</span>
              <div className="flex-1">
                <div className="font-medium">{s.nombre}</div>
                <div className="text-[12px] text-muted font-mono">Matrícula {s.clave}-{String(new Date().getFullYear()).slice(2)}-0001</div>
              </div>
              {Number(s.activa) ? <Chip tono="ok">Activa</Chip> : <Chip>Inactiva</Chip>}
              {puede && <div className="flex gap-1">
                <Boton variante="fantasma" tam="sm" icono={Pencil} onClick={() => { setForm({ ...s }); setErr(''); }}>Editar</Boton>
                <Boton variante="fantasma" tam="sm" icono={Power} onClick={() => alternar(s)}>{Number(s.activa) ? 'Desactivar' : 'Activar'}</Boton>
              </div>}
            </li>
          ))}
        </ul>
      )}
      <Modal abierto={!!form} onCerrar={() => setForm(null)} titulo={form?.id ? 'Editar sucursal' : 'Nueva sucursal'}
        subtitulo={form?.id ? 'La clave no se puede cambiar porque ya está en matrículas y recibos' : 'Hereda los parámetros y precios globales'}
        pie={<><Boton variante="secundario" onClick={() => setForm(null)}>Cancelar</Boton><Boton cargando={guardando} onClick={guardar}>Guardar</Boton></>}>
        {form && <div className="space-y-4">
          <Campo etiqueta="Clave (4 letras)" value={form.clave} disabled={!!form.id} maxLength={4}
            onChange={(e) => setForm({ ...form, clave: e.target.value.toUpperCase().replace(/[^A-Z]/g, '') })} placeholder="SURE" />
          <Campo etiqueta="Nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Sucursal Sur" />
          <ErrorCaja error={err && { message: err }} />
        </div>}
      </Modal>
    </Tarjeta>
  );
}

function Disciplinas() {
  const { tiene } = useSesion();
  const avisar = useAvisos();
  const datos = useDatos(() => api.get('/disciplinas'), []);
  const [abierta, setAbierta] = useState(null);
  const grados = useDatos(() => (abierta ? api.get(`/disciplinas/${abierta.id}/grados`) : Promise.resolve([])), [abierta?.id]);
  const [form, setForm] = useState(null);
  const [grado, setGrado] = useState(null);
  const [err, setErr] = useState('');
  const [guardando, setGuardando] = useState(false);

  const guardarDisc = async () => {
    setGuardando(true); setErr('');
    try {
      if (form.id) await api.put(`/disciplinas/${form.id}`, { nombre: form.nombre }); else await api.post('/disciplinas', { nombre: form.nombre });
      avisar(form.id ? 'Disciplina actualizada' : `Disciplina ${form.nombre} creada`); setForm(null); datos.recargar();
    } catch (e) { setErr(e.message); } finally { setGuardando(false); }
  };
  const guardarGrado = async () => {
    setGuardando(true); setErr('');
    try {
      await api.post(`/disciplinas/${abierta.id}/grados`, grado);
      avisar(`Grado ${grado.nombre} agregado`); setGrado(null); grados.recargar(); datos.recargar();
    } catch (e) { setErr(e.message); } finally { setGuardando(false); }
  };

  return (
    <div className="grid lg:grid-cols-[360px_1fr] gap-4">
      <Tarjeta titulo="Disciplinas" icono={Layers} cuerpo="p-2"
        acciones={tiene('disciplinas.gestionar') && <Boton tam="sm" icono={Plus} onClick={() => { setForm({ nombre: '' }); setErr(''); }}>Disciplina</Boton>}>
        {datos.cargando && !datos.datos ? <Cargando /> : (datos.datos || []).map((d) => (
          <button key={d.id} onClick={() => setAbierta(d)}
            className={`w-full flex items-center gap-3 rounded-md px-3 py-2.5 text-left cursor-pointer transition-colors ${abierta?.id === d.id ? 'bg-action/12 ring-1 ring-action' : 'hover:bg-inset'}`}>
            <span className="flex-1 font-medium">{d.nombre}</span>
            <span className="text-[12px] text-muted">{d.grados} grados</span>
            {!Number(d.activa) && <Chip>Inactiva</Chip>}
          </button>
        ))}
      </Tarjeta>

      <Tarjeta titulo={abierta ? `Grados de ${abierta.nombre}` : 'Grados'} subtitulo="En orden, del primero al último" cuerpo="p-0"
        acciones={abierta && <>
          {tiene('disciplinas.gestionar') && <Boton variante="secundario" tam="sm" icono={Pencil} onClick={() => { setForm({ ...abierta }); setErr(''); }}>Renombrar</Boton>}
          {tiene('grados.gestionar') && <Boton tam="sm" icono={Plus} onClick={() => { setGrado({ nombre: '', color_cinta: '' }); setErr(''); }}>Grado</Boton>}
        </>}>
        {!abierta ? <Vacio icono={Layers} titulo="Elige una disciplina" texto="Verás sus grados y cintas en orden." /> :
          grados.cargando && !grados.datos?.length ? <Cargando /> : !grados.datos?.length ? <Vacio titulo="Sin grados" texto="Agrega el primer grado de esta disciplina." /> : (
            <ol className="divide-y divide-line">
              {grados.datos.map((g) => (
                <li key={g.id} className="flex items-center gap-4 px-5 py-3">
                  <span className="w-6 text-right font-mono text-[12px] text-muted">{g.orden}</span>
                  <span className="h-2.5 w-10 rounded-full ring-1 ring-black/20" style={{ background: colorCinta(g.color_cinta) }} />
                  <span className="flex-1 font-medium">{g.nombre}</span>
                  <span className="text-[13px] text-muted">{g.color_cinta || '—'}</span>
                </li>
              ))}
            </ol>
          )}
      </Tarjeta>

      <Modal abierto={!!form} onCerrar={() => setForm(null)} titulo={form?.id ? 'Renombrar disciplina' : 'Nueva disciplina'}
        pie={<><Boton variante="secundario" onClick={() => setForm(null)}>Cancelar</Boton><Boton cargando={guardando} onClick={guardarDisc}>Guardar</Boton></>}>
        {form && <div className="space-y-4"><Campo etiqueta="Nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Kung Fu" /><ErrorCaja error={err && { message: err }} /></div>}
      </Modal>
      <Modal abierto={!!grado} onCerrar={() => setGrado(null)} titulo="Nuevo grado" subtitulo={`Se agrega al final de ${abierta?.nombre || ''}`}
        pie={<><Boton variante="secundario" onClick={() => setGrado(null)}>Cancelar</Boton><Boton cargando={guardando} onClick={guardarGrado}>Agregar</Boton></>}>
        {grado && <div className="space-y-4">
          <Campo etiqueta="Nombre" value={grado.nombre} onChange={(e) => setGrado({ ...grado, nombre: e.target.value })} placeholder="4 dan" />
          <Campo etiqueta="Color de cinta" value={grado.color_cinta} onChange={(e) => setGrado({ ...grado, color_cinta: e.target.value })} placeholder="Negra"
            derecha={<span className="h-2.5 w-8 rounded-full" style={{ background: colorCinta(grado.color_cinta) }} />} />
          <ErrorCaja error={err && { message: err }} />
        </div>}
      </Modal>
    </div>
  );
}

export default function Configuracion() {
  return (
    <>
      <Encabezado ruta="Configuración" titulo="Sucursales y disciplinas" descripcion="Los catálogos base del sistema. Dar de baja nunca borra: desactiva y conserva el historial." />
      <div className="space-y-4"><Sucursales /><Disciplinas /></div>
    </>
  );
}
