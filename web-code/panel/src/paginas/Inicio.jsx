import { Link } from 'react-router-dom';
import { ArrowRight, Building2, CalendarDays, ClipboardList, Clock, SlidersHorizontal, Tags, UserPlus, Users } from 'lucide-react';
import { useSesion, NOMBRE_ROL } from '../auth/Sesion';
import { api, DIAS, formato } from '../api';
import { Chip, Encabezado, Kpi, Tarjeta, useDatos } from '../ui';

// S-02 · Inicio. Por ahora muestra lo que ya tiene API; los indicadores de alumnos,
// adeudos y asistencias se conectan cuando estén esos módulos.
export default function Inicio() {
  const { usuario, rol, tiene } = useSesion();
  const sucursales = useDatos(() => api.get('/sucursales'), []);
  const diaHoy = ((new Date().getDay() + 6) % 7) + 1;
  const alumnos = useDatos(() => (tiene('alumnos.ver') ? api.get('/alumnos', { estado: 'activo' }) : Promise.resolve(null)), [rol?.usuario_rol_id]);
  const clases = useDatos(() => (tiene('horarios.ver') ? api.get('/horarios', { dia: diaHoy }) : Promise.resolve([])), [rol?.usuario_rol_id]);
  const bitacora = useDatos(() => (tiene('bitacora.ver') ? api.get('/bitacora') : Promise.resolve([])), [rol?.usuario_rol_id]);
  const hoy = new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });

  const accesos = [
    { a: '/inscripcion', t: 'Inscribir alumno', d: 'Datos, responsable, clase y cuenta inicial', icono: UserPlus, p: ['inscripciones.crear'] },
    { a: '/alumnos', t: 'Alumnos', d: 'Buscar por nombre, matrícula o teléfono', icono: Users, p: ['alumnos.ver'] },
    { a: '/horarios', t: 'Horarios', d: 'Clases de la semana e inscritos', icono: CalendarDays, p: ['horarios.gestionar', 'asistencia.validar'] },
    { a: '/parametros', t: 'Parámetros', d: 'Retardos, tolerancias y reglas por sucursal', icono: SlidersHorizontal, p: ['parametros.ver'] },
    { a: '/tarifas', t: 'Precios y promociones', d: 'Precios vigentes, paquetes y convenios', icono: Tags, p: ['precios.gestionar', 'promociones.gestionar'] },
    { a: '/bitacora', t: 'Bitácora', d: 'Quién cambió qué y cuándo', icono: ClipboardList, p: ['bitacora.ver'] },
    { a: '/configuracion', t: 'Configuración', d: 'Sucursales, disciplinas y grados', icono: Building2, p: ['sucursales.gestionar', 'disciplinas.gestionar'] },
  ].filter((x) => tiene(...x.p));

  return (
    <>
      <Encabezado ruta={hoy} titulo={`Hola, ${usuario?.nombre || ''}`}
        descripcion={`Estás trabajando como ${(NOMBRE_ROL[rol?.nombre] || '').toLowerCase()}${rol?.sucursal_id ? '' : ' con acceso a todas las sucursales'}.`} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6 anim-entrar">
        <Kpi etiqueta="Sucursales" valor={sucursales.datos?.length ?? '—'} detalle="activas en el sistema" icono={Building2} />
        <Kpi etiqueta="Alumnos activos" valor={alumnos.datos ? `${alumnos.datos.length}${alumnos.datos.length === 100 ? '+' : ''}` : '—'} detalle={rol?.sucursal_id ? 'en tu sucursal' : 'en todas las sucursales'} tono="ok" icono={Users} />
        <Kpi etiqueta="Con adeudo" valor="—" detalle="se conecta con caja" tono="peligro" />
        <Kpi etiqueta="Clases hoy" valor={clases.datos?.length ?? '—'} detalle={DIAS[diaHoy]} tono="oro" icono={CalendarDays} />
      </div>

      <div className="grid lg:grid-cols-[1fr_380px] gap-4">
        <Tarjeta titulo="Accesos rápidos" subtitulo="Lo que puedes hacer con tu rol">
          {accesos.length ? (
            <div className="grid sm:grid-cols-2 gap-3">
              {accesos.map((x) => (
                <Link key={x.a} to={x.a} className="group flex items-start gap-3 rounded-[10px] border border-line bg-inset/40 p-4 hover:border-action transition-colors">
                  <span className="grid place-items-center size-9 rounded-md bg-inset text-action shrink-0"><x.icono className="size-4" /></span>
                  <div className="flex-1">
                    <div className="font-semibold flex items-center gap-1">{x.t}<ArrowRight className="size-3.5 opacity-0 group-hover:opacity-100 transition" /></div>
                    <div className="text-[13px] text-muted">{x.d}</div>
                  </div>
                </Link>
              ))}
            </div>
          ) : <p className="text-muted text-sm">Tu rol todavía no tiene pantallas disponibles en el panel.</p>}
        </Tarjeta>

        <div className="space-y-4">
        {!!clases.datos?.length && (
          <Tarjeta titulo="Clases de hoy" subtitulo={DIAS[diaHoy]} cuerpo="p-0" acciones={<Link to="/horarios" className="text-[13px] font-semibold text-link">Horarios</Link>}>
            <ul className="divide-y divide-line">
              {clases.datos.slice(0, 5).map((h) => (
                <li key={h.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                  <span className="flex items-center gap-1 text-muted w-24 shrink-0"><Clock className="size-3" />{h.hora_inicio}</span>
                  <div className="flex-1 min-w-0"><div className="font-medium truncate">{h.disciplina} · {h.nivel || 'Todos'}</div><div className="text-[12px] text-muted truncate">{h.instructor}{!rol?.sucursal_id && ` · ${h.sucursal}`}</div></div>
                  <Chip>{h.inscritos}{h.cupo ? `/${h.cupo}` : ''}</Chip>
                </li>
              ))}
            </ul>
          </Tarjeta>
        )}
        {tiene('bitacora.ver') && (
          <Tarjeta titulo="Últimos cambios" subtitulo="Bitácora de auditoría" cuerpo="p-0"
            acciones={<Link to="/bitacora" className="text-[13px] font-semibold text-link">Ver todo</Link>}>
            <ul className="divide-y divide-line">
              {(bitacora.datos || []).slice(0, 6).map((b, i) => (
                <li key={i} className="px-5 py-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Chip tono={b.accion === 'alta' ? 'ok' : b.accion === 'baja' ? 'peligro' : 'info'}>{b.accion}</Chip>
                    <span className="font-mono text-[12px] text-muted">{b.tabla}#{b.registro_id}</span>
                    <span className="ml-auto text-[12px] text-muted">{formato.fechaHora(b.fecha_hora)}</span>
                  </div>
                  <div className="text-[13px] text-soft mt-1 truncate">{b.campo}: {b.valor_anterior ?? '—'} → {b.valor_nuevo ?? '—'}</div>
                </li>
              ))}
              {!bitacora.cargando && !(bitacora.datos || []).length && <li className="px-5 py-6 text-sm text-muted">Sin cambios registrados.</li>}
            </ul>
          </Tarjeta>
        )}
        </div>
      </div>
    </>
  );
}
