import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Building2, CalendarCheck, CalendarDays, ClipboardList, Clock, FileSpreadsheet, Medal, SlidersHorizontal, Tags, UserPlus, Users, Wallet } from 'lucide-react';
import { useSesion, NOMBRE_ROL } from '../auth/Sesion';
import { api, formato, regional } from '../api';
import { Boton, Cargando, Chip, Encabezado, ErrorCaja, FotoAlumno, Kpi, Pestanas, Tarjeta, Vacio, useDatos } from '../ui';

// S-02 · Inicio: los números del día según el rol (GET /api/inicio). Cada bloque aparece solo si el rol tiene ese permiso.
const cx = (...c) => c.filter(Boolean).join(' ');

export default function Inicio() {
  const { usuario, rol, tiene } = useSesion();
  const global = rol?.alcance === 'global';
  const [suc, setSuc] = useState('');
  const sucursales = useDatos(() => (global ? api.get('/sucursales') : Promise.resolve([])), [global]);
  const datos = useDatos(() => api.get('/inicio', { sucursal_id: suc }), [rol?.usuario_rol_id, suc]);
  const bitacora = useDatos(() => (tiene('bitacora.ver') ? api.get('/bitacora') : Promise.resolve([])), [rol?.usuario_rol_id]);
  const d = datos.datos;
  const hoy = new Date().toLocaleDateString(regional.locale, { weekday: 'long', day: 'numeric', month: 'long' });

  const accesos = [
    { a: '/caja', t: 'Cobrar', icono: Wallet, p: ['pagos.cobrar'] },
    { a: '/inscripcion', t: 'Inscribir alumno', icono: UserPlus, p: ['inscripciones.crear'] },
    { a: '/asistencia', t: 'Pase de lista', icono: CalendarCheck, p: ['asistencia.validar', 'asistencia.manual'] },
    { a: '/examenes', t: 'Exámenes', icono: Medal, p: ['examenes.programar', 'examenes.validar', 'examenes.solicitar'] },
    { a: '/alumnos/importar', t: 'Importar alumnos', icono: FileSpreadsheet, p: ['alumnos.importar'] },
    { a: '/horarios', t: 'Horarios', icono: CalendarDays, p: ['horarios.gestionar'] },
    { a: '/tarifas', t: 'Precios y promociones', icono: Tags, p: ['precios.gestionar', 'promociones.gestionar'] },
    { a: '/parametros', t: 'Parámetros', icono: SlidersHorizontal, p: ['parametros.editar'] },
    { a: '/configuracion', t: 'Configuración', icono: Building2, p: ['sucursales.gestionar', 'disciplinas.gestionar'] },
  ].filter((x) => tiene(...x.p));

  const clases = d?.clases || [];
  const misClases = clases.filter((c) => c.mia);
  const verClases = misClases.length ? misClases : clases;

  return (
    <>
      <Encabezado ruta={hoy} titulo={`Hola, ${usuario?.nombre || ''}`}
        descripcion={`Trabajas como ${(NOMBRE_ROL[rol?.nombre] || '').toLowerCase()}${global ? ' con acceso a todas las sucursales' : ''}.`}
        acciones={global && <Pestanas valor={suc} onCambio={setSuc} opciones={[{ valor: '', etiqueta: 'Todas' }, ...(sucursales.datos || []).map((s) => ({ valor: String(s.id), etiqueta: s.nombre }))]} />} />
      <ErrorCaja error={datos.error} reintentar={datos.recargar} />
      {datos.cargando && !d ? <Cargando /> : d && (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-6 anim-entrar">
            {d.alumnos && <Kpi etiqueta="Alumnos activos" valor={Number(d.alumnos.activos || 0)} detalle={`${d.alumnos.nuevos_mes || 0} nuevos este mes`} icono={Users} />}
            {d.caja && <Link to="/caja?vista=corte"><Kpi etiqueta="Cobrado hoy" valor={formato.dinero(d.caja.cobrado)} detalle={`${d.caja.pagos} pago${Number(d.caja.pagos) !== 1 ? 's' : ''} · ver corte`} tono="ok" icono={Wallet} /></Link>}
            {d.vencidos && <Kpi etiqueta="Con pago vencido" valor={d.vencidos.alumnos} detalle={d.vencidos.alumnos ? 'no pasan en la tableta' : 'todos al corriente'} tono={d.vencidos.alumnos ? 'peligro' : 'ok'} icono={AlertTriangle} />}
            {d.asistencia && <Link to="/asistencia"><Kpi etiqueta="Asistencia hoy" valor={d.asistencia.registros} detalle={`${d.asistencia.rechazos} rechazo${Number(d.asistencia.rechazos) !== 1 ? 's' : ''} en la tableta`} tono="oro" icono={CalendarCheck} /></Link>}
            {!d.caja && d.examenes && <Link to="/examenes"><Kpi etiqueta="Por autorizar" valor={Number(d.examenes.por_autorizar || 0)} detalle="solicitudes de examen" tono="accion" icono={Medal} /></Link>}
          </div>

          {d.alumnos?.sin_foto > 0 && (
            <div className="flex items-center gap-3 rounded-md border border-gold/40 bg-gold/10 px-4 py-3 text-sm mb-4">
              <AlertTriangle className="size-4 text-gold shrink-0" />
              <span className="flex-1">{d.alumnos.sin_foto} alumno{d.alumnos.sin_foto !== 1 && 's'} activo{d.alumnos.sin_foto !== 1 && 's'} sin foto (normalmente los importados). Tómala desde su ficha.</span>
            </div>
          )}

          <div className="grid lg:grid-cols-[1fr_380px] gap-4">
            <div className="space-y-4 min-w-0">
              {d.clases && (
                <Tarjeta titulo={misClases.length ? 'Tus clases de hoy' : 'Clases de hoy'} subtitulo={`${verClases.length} clase${verClases.length !== 1 ? 's' : ''}`} icono={CalendarDays} cuerpo="p-0"
                  acciones={tiene('asistencia.validar', 'asistencia.manual') && <Link to="/asistencia" className="text-[13px] font-semibold text-link">Pase de lista</Link>}>
                  {!verClases.length ? <Vacio icono={Clock} titulo="Hoy no hay clases" /> : (
                    <ul className="divide-y divide-line">
                      {verClases.map((c) => {
                        const pct = Number(c.inscritos) ? Math.min(100, Math.round((c.asistieron * 100) / c.inscritos)) : 0;
                        return (
                          <li key={c.id} className={cx('flex items-center gap-4 px-5 py-3', c.estado === 'terminada' && 'opacity-60')}>
                            <span className="font-mono text-sm w-24 shrink-0">{c.hora_inicio}<span className="text-muted">–{c.hora_fin}</span></span>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">{c.disciplina} · {c.nivel || 'General'}</div>
                              <div className="text-[12px] text-muted truncate">{c.instructor}{global && !suc ? ` · ${c.sucursal}` : ''}</div>
                            </div>
                            <div className="w-28 hidden sm:block">
                              <div className="h-1.5 rounded-full bg-inset overflow-hidden"><div className="h-full bg-action" style={{ width: `${pct}%` }} /></div>
                              <div className="text-[11px] text-muted mt-1">{c.asistieron} de {c.inscritos}</div>
                            </div>
                            {c.estado === 'en_curso' ? <Chip tono="accion">En curso</Chip> : c.estado === 'proxima' ? <Chip>Próxima</Chip> : <Chip tono="info">Terminó</Chip>}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </Tarjeta>
              )}
              {d.vencidos && (
                <Tarjeta titulo="Pagos vencidos" subtitulo="Pasó la tolerancia: la tableta no los deja entrar" icono={AlertTriangle} cuerpo="p-0"
                  acciones={d.vencidos.alumnos > d.vencidos.lista.length && <span className="text-[13px] text-muted">Los {d.vencidos.lista.length} más atrasados</span>}>
                  {!d.vencidos.lista.length ? <Vacio icono={Wallet} titulo="Todos al corriente" /> : (
                    <ul className="divide-y divide-line">
                      {d.vencidos.lista.map((a) => (
                        <li key={a.id} className="flex items-center gap-3 px-5 py-3">
                          <FotoAlumno id={a.id} nombre={a.nombre} tiene={a.tiene_foto} className="size-9" />
                          <Link to={`/alumnos/${a.id}`} className="flex-1 min-w-0 hover:underline">
                            <div className="font-medium truncate">{a.nombre}</div>
                            <div className="text-[12px] text-muted">{a.meses} mes{a.meses > 1 ? 'es' : ''} · vencido desde {formato.fecha(a.vencida_desde)}</div>
                          </Link>
                          {tiene('pagos.cobrar') && <Link to={`/caja?alumno=${a.id}`}><Boton tam="sm" variante="secundario" icono={Wallet}>Cobrar</Boton></Link>}
                        </li>
                      ))}
                    </ul>
                  )}
                </Tarjeta>
              )}
            </div>

            <div className="space-y-4">
              {d.examenes && (
                <Tarjeta titulo="Exámenes" icono={Medal} acciones={<Link to="/examenes" className="text-[13px] font-semibold text-link">Ver todo</Link>}>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    {[['Por autorizar', d.examenes.por_autorizar, 'text-action'], ['Fuera de plazo', d.examenes.fuera_de_plazo, 'text-warn'], ['Sin pago', d.examenes.sin_pago, 'text-gold']].map(([t, v, c]) => (
                      <div key={t} className="rounded-md bg-inset py-2.5"><div className={cx('text-[22px] font-semibold', Number(v) ? c : 'text-muted')}>{Number(v || 0)}</div><div className="etiqueta !text-[10px]">{t}</div></div>
                    ))}
                  </div>
                  {d.examenes.proximos.length > 0 && (
                    <ul className="mt-4 space-y-2">
                      {d.examenes.proximos.map((e) => (
                        <li key={e.id}><Link to={`/examenes/${e.id}`} className="flex items-center gap-3 rounded-md border border-line px-3 py-2 hover:border-action">
                          <span className="font-mono text-[13px] w-16 shrink-0">{formato.fecha(e.fecha).slice(0, 6)}</span>
                          <span className="flex-1 min-w-0 text-sm truncate">{e.disciplina}{global && !suc ? ` · ${e.sucursal}` : ''}</span>
                          <Chip>{e.solicitudes}</Chip>
                        </Link></li>
                      ))}
                    </ul>
                  )}
                </Tarjeta>
              )}
              {accesos.length > 0 && (
                <Tarjeta titulo="Accesos rápidos" cuerpo="p-2">
                  {accesos.map((x) => (
                    <Link key={x.a} to={x.a} className="group flex items-center gap-3 rounded-md px-3 py-2.5 hover:bg-inset">
                      <x.icono className="size-4 text-action" /><span className="flex-1 text-sm font-medium">{x.t}</span>
                      <ArrowRight className="size-3.5 text-muted opacity-0 group-hover:opacity-100 transition" />
                    </Link>
                  ))}
                </Tarjeta>
              )}
              {tiene('bitacora.ver') && (
                <Tarjeta titulo="Últimos cambios" icono={ClipboardList} cuerpo="p-0" acciones={<Link to="/bitacora" className="text-[13px] font-semibold text-link">Bitácora</Link>}>
                  <ul className="divide-y divide-line">
                    {(bitacora.datos || []).slice(0, 5).map((b, i) => (
                      <li key={i} className="px-5 py-2.5 text-sm">
                        <div className="flex items-center gap-2">
                          <Chip tono={b.accion === 'alta' ? 'ok' : b.accion === 'baja' ? 'peligro' : 'info'}>{b.accion}</Chip>
                          <span className="font-mono text-[12px] text-muted truncate">{b.tabla}#{b.registro_id}</span>
                          <span className="ml-auto text-[12px] text-muted whitespace-nowrap">{formato.fechaHora(b.fecha_hora)}</span>
                        </div>
                      </li>
                    ))}
                    {!bitacora.cargando && !(bitacora.datos || []).length && <li className="px-5 py-6 text-sm text-muted">Sin cambios registrados.</li>}
                  </ul>
                </Tarjeta>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
