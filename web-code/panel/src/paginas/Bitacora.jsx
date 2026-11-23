import { useMemo, useState } from 'react';
import { ClipboardList, Search } from 'lucide-react';
import { api, formato } from '../api';
import { Campo, Cargando, Chip, Encabezado, ErrorCaja, Selector, Tabla, Tarjeta, Vacio, useDatos } from '../ui';

// S-12 · Bitácora de auditoría: quién cambió qué, cuándo y qué valor tenía antes
const TABLAS = ['', 'sucursales', 'disciplinas', 'grados', 'parametro_valores', 'conceptos', 'precios', 'promociones', 'alumnos', 'personas', 'inscripciones', 'horarios'];

export default function Bitacora() {
  const [tabla, setTabla] = useState('');
  const [registro, setRegistro] = useState('');
  const [texto, setTexto] = useState('');
  const datos = useDatos(() => api.get('/bitacora', { tabla, registro_id: registro }), [tabla, registro]);
  const filas = useMemo(() => {
    const t = texto.trim().toLowerCase();
    return (datos.datos || []).filter((b) => !t || [b.usuario, b.campo, b.valor_anterior, b.valor_nuevo].some((v) => String(v ?? '').toLowerCase().includes(t)));
  }, [datos.datos, texto]);

  return (
    <>
      <Encabezado ruta="Auditoría" titulo="Bitácora" descripcion="Cada alta, cambio o baja queda registrada con el usuario, la fecha y el valor anterior. No se puede editar ni borrar." />
      <Tarjeta cuerpo="p-0">
        <div className="grid sm:grid-cols-[200px_160px_1fr] gap-3 p-4 border-b border-line">
          <Selector etiqueta="Tabla" value={tabla} onChange={(e) => setTabla(e.target.value)}>
            {TABLAS.map((t) => <option key={t} value={t}>{t || 'Todas'}</option>)}
          </Selector>
          <Campo etiqueta="Registro #" inputMode="numeric" value={registro} onChange={(e) => setRegistro(e.target.value.replace(/\D/g, ''))} placeholder="Todos" />
          <Campo etiqueta="Buscar en resultados" icono={Search} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Usuario, campo o valor" />
        </div>
        <div className="p-4 pb-0"><ErrorCaja error={datos.error} reintentar={datos.recargar} /></div>
        {datos.cargando && !datos.datos ? <Cargando /> : (
          <Tabla clave="_" filas={filas.map((f, i) => ({ ...f, _: i }))}
            vacio={<Vacio icono={ClipboardList} titulo="Sin movimientos" texto="No hay cambios con esos filtros." />}
            columnas={[
              { k: 'fecha_hora', t: 'Fecha', r: (b) => <span className="whitespace-nowrap">{formato.fechaHora(b.fecha_hora)}</span> },
              { k: 'usuario', t: 'Usuario', r: (b) => <span className="text-soft">{b.usuario}</span> },
              { k: 'accion', t: 'Acción', r: (b) => <Chip tono={b.accion === 'alta' ? 'ok' : b.accion === 'baja' ? 'peligro' : 'info'}>{b.accion}</Chip> },
              { k: 'tabla', t: 'Registro', r: (b) => <span className="font-mono text-[12.5px]">{b.tabla}#{b.registro_id}</span> },
              { k: 'campo', t: 'Campo', r: (b) => b.campo || '—' },
              { k: 'cambio', t: 'Antes → después', r: (b) => (
                <span className="text-[13px]"><span className="text-muted line-through decoration-muted/50">{b.valor_anterior ?? '—'}</span> → <b>{b.valor_nuevo ?? '—'}</b></span>) },
            ]} />
        )}
        <div className="px-4 py-3 border-t border-line text-[12px] text-muted">Se muestran los últimos 200 movimientos.</div>
      </Tarjeta>
    </>
  );
}
