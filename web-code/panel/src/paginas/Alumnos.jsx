import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FileSpreadsheet, Search, UserPlus, Users } from 'lucide-react';
import { api } from '../api';
import { useSesion } from '../auth/Sesion';
import { Boton, Campo, Cargando, Chip, Encabezado, ErrorCaja, FotoAlumno, Pestanas, Tabla, Tarjeta, Vacio, useDatos } from '../ui';

// Búsqueda de alumnos por nombre, matrícula, CURP o teléfono (RF-67)
export default function Alumnos() {
  const { tiene } = useSesion();
  const navegar = useNavigate();
  const [texto, setTexto] = useState('');
  const [buscar, setBuscar] = useState('');
  const [estado, setEstado] = useState('activo');
  useEffect(() => { const t = setTimeout(() => setBuscar(texto.trim()), 300); return () => clearTimeout(t); }, [texto]);
  const datos = useDatos(() => api.get('/alumnos', { buscar, estado }), [buscar, estado]);
  const nombre = (a) => [a.nombre, a.apellido_paterno, a.apellido_materno].filter(Boolean).join(' ');

  return (
    <>
      <Encabezado ruta="Personas" titulo="Alumnos" descripcion="Busca por nombre, matrícula, CURP o teléfono. La matrícula distingue a dos personas con el mismo nombre."
        acciones={<>
          {tiene('alumnos.importar') && <Link to="/alumnos/importar"><Boton variante="secundario" icono={FileSpreadsheet}>Importar CSV</Boton></Link>}
          {tiene('inscripciones.crear') && <Link to="/inscripcion"><Boton icono={UserPlus}>Inscribir alumno</Boton></Link>}
        </>} />
      <Tarjeta cuerpo="p-0">
        <div className="flex flex-wrap items-end gap-3 p-4 border-b border-line">
          <Campo className="flex-1 min-w-64" icono={Search} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Jorge Ramírez, CENT-26-0012, 2221234567…" autoFocus />
          <Pestanas valor={estado} onCambio={setEstado} opciones={[{ valor: 'activo', etiqueta: 'Activos' }, { valor: 'suspendido', etiqueta: 'Suspendidos' }, { valor: 'baja', etiqueta: 'Bajas' }, { valor: '', etiqueta: 'Todos' }]} />
        </div>
        <div className="px-4 pt-3"><ErrorCaja error={datos.error} reintentar={datos.recargar} /></div>
        {datos.cargando && !datos.datos ? <Cargando /> : (
          <Tabla filas={datos.datos} onFila={(a) => navegar(`/alumnos/${a.id}`)}
            vacio={<Vacio icono={Users} titulo={buscar ? 'Nadie coincide con la búsqueda' : 'Todavía no hay alumnos'}
              texto={buscar ? 'Prueba con la matrícula o el teléfono.' : 'Inscribe al primer alumno.'} />}
            columnas={[
              { k: 'nombre', t: 'Alumno', r: (a) => (
                <div className="flex items-center gap-3">
                  <FotoAlumno id={a.id} nombre={nombre(a)} tiene={a.tiene_foto} className="size-9" />
                  <div><div className="font-medium">{nombre(a)}</div><div className="text-[12px] text-muted">{a.edad} años · {a.sucursal}</div></div>
                </div>) },
              { k: 'matricula', t: 'Matrícula', r: (a) => <span className="font-mono text-[13px]">{a.matricula}</span> },
              { k: 'disciplinas', t: 'Disciplinas', r: (a) => a.disciplinas || <span className="text-muted">Sin horario</span> },
              { k: 'telefono', t: 'Teléfono', r: (a) => a.telefono ? <span className="font-mono text-[13px]">{a.telefono}</span> : '—' },
              { k: 'estado', t: 'Estado', r: (a) => <Chip tono={a.estado === 'activo' ? 'ok' : a.estado === 'baja' ? 'peligro' : 'aviso'}>{a.estado}</Chip> },
            ]} />
        )}
      </Tarjeta>
    </>
  );
}
