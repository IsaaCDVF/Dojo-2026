import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useSesion } from './sesion';
import { Cargando } from './ui';
import Marco from './Marco';
import Entrar from './paginas/Entrar';
import Activar from './paginas/Activar';
import Inicio from './paginas/Inicio';
import Camino from './paginas/Camino';
import MiAvatar from './paginas/MiAvatar';
import Examen from './paginas/Examen';
import Familia from './paginas/Familia';
import Pagos from './paginas/Pagos';
import SinAlumnos from './paginas/SinAlumnos';
import CrearAvatar from './paginas/CrearAvatar';
import MiCuenta from './paginas/MiCuenta';
import Pagar from './paginas/Pagar';
import PagoEstado from './paginas/PagoEstado';
import Avisos from './paginas/Avisos';

function Protegida({ children }) {
  const { yo, cargando } = useSesion();
  const loc = useLocation();
  if (cargando) return <Cargando className="h-full bg-canvas" />;
  if (!yo) return <Navigate to="/entrar" replace state={{ desde: loc.pathname }} />;
  return children;
}

/** Al abrir la app: el alumno va a su inicio; el responsable (que no entrena) a su familia */
function Raiz() {
  const { yo } = useSesion();
  if (yo.alumno_id) return <Navigate to={`/a/${yo.alumno_id}`} replace />;
  if (yo.es_responsable) return <Navigate to="/familia" replace />;
  return <SinAlumnos />;
}

export default function App() {
  const { yo, cargando } = useSesion();
  return (
    <Routes>
      <Route path="/entrar" element={yo && !cargando ? <Navigate to="/" replace /> : <Entrar />} />
      <Route path="/activar" element={yo && !cargando ? <Navigate to="/" replace /> : <Activar />} />
      <Route path="/a/:id/crear-avatar" element={<Protegida><CrearAvatar /></Protegida>} />
      <Route element={<Protegida><Marco /></Protegida>}>
        <Route index element={<Raiz />} />
        <Route path="a/:id" element={<Inicio />} />
        <Route path="a/:id/camino" element={<Camino />} />
        <Route path="a/:id/avatar" element={<MiAvatar />} />
        <Route path="a/:id/examen" element={<Examen />} />
        <Route path="familia" element={<Familia />} />
        <Route path="pagos" element={<Pagos />} />
        <Route path="cuenta" element={<MiCuenta />} />
        <Route path="cuenta/:seccion" element={<MiCuenta />} />
        <Route path="pagar" element={<Pagar />} />
        <Route path="pago/:id" element={<PagoEstado />} />
        <Route path="avisos" element={<Avisos />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
