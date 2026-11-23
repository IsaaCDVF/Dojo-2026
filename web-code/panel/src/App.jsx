import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSesion } from './auth/Sesion';
import { Cargando } from './ui';
import Panel from './layout/Panel';
import Login from './paginas/Login';
import ElegirRol from './paginas/ElegirRol';
import Inicio from './paginas/Inicio';
import Pronto from './paginas/Pronto';
import Parametros from './paginas/Parametros';
import Bitacora from './paginas/Bitacora';
import Tarifas from './paginas/Tarifas';
import Configuracion from './paginas/Configuracion';
import Horarios from './paginas/Horarios';
import Alumnos from './paginas/Alumnos';
import Ficha from './paginas/Ficha';
import Inscripcion from './paginas/Inscripcion';
import MiPerfil from './paginas/MiPerfil';

/** Solo deja pasar si hay sesión y rol elegido */
function Protegida({ children }) {
  const { yo, rol, cargando } = useSesion();
  const loc = useLocation();
  if (cargando) return <Cargando className="h-full" texto="Abriendo Dojo OS…" />;
  if (!yo) return <Navigate to="/login" replace state={{ desde: loc.pathname }} />;
  if (!rol) return <Navigate to="/elegir-rol" replace />;
  return children;
}

export default function App() {
  const { yo, cargando } = useSesion();
  const navegar = useNavigate();
  useEffect(() => {
    const ir = () => navegar('/elegir-rol');
    window.addEventListener('dojo:elegir-rol', ir);
    return () => window.removeEventListener('dojo:elegir-rol', ir);
  }, [navegar]);

  return (
    <Routes>
      <Route path="/login" element={yo && !cargando ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/elegir-rol" element={yo ? <ElegirRol /> : <Navigate to="/login" replace />} />
      <Route element={<Protegida><Panel /></Protegida>}>
        <Route index element={<Inicio />} />
        <Route path="mi-perfil" element={<MiPerfil />} />
        <Route path="alumnos" element={<Alumnos />} />
        <Route path="alumnos/:id" element={<Ficha />} />
        <Route path="inscripcion" element={<Inscripcion />} />
        <Route path="caja" element={<Pronto titulo="Caja" descripcion="Cobro por responsable, recargos y corte de caja." />} />
        <Route path="horarios" element={<Horarios />} />
        <Route path="examenes" element={<Pronto titulo="Exámenes" descripcion="Fechas, solicitudes, excepciones y resultados." />} />
        <Route path="tarifas" element={<Tarifas />} />
        <Route path="parametros" element={<Parametros />} />
        <Route path="bitacora" element={<Bitacora />} />
        <Route path="configuracion" element={<Configuracion />} />
        <Route path="*" element={<Pronto titulo="Página no encontrada" />} />
      </Route>
    </Routes>
  );
}
