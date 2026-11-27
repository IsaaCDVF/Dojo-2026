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
import Cuenta from './paginas/Cuenta';
import Caja from './paginas/Caja';
import Examenes, { ExamenDetalle } from './paginas/Examenes';
import Asistencia from './paginas/Asistencia';
import Tableta from './paginas/Tableta';
import Importar from './paginas/Importar';
import Apariencia from './paginas/Apariencia';
import Personal from './paginas/Personal';
import CambiarContrasena from './paginas/CambiarContrasena';
import VincularTableta from './paginas/VincularTableta';
import Tabletas from './paginas/Tabletas';
import PagosEnLinea from './paginas/PagosEnLinea';
import Avisos from './paginas/Avisos';

/** La cuenta de la tableta (o del celular que hace de tableta) va directo a leer credenciales */
function InicioSegunRol() {
  const { rol } = useSesion();
  return rol?.nombre === 'tableta' ? <Navigate to="/tableta" replace /> : <Inicio />;
}

/** Solo deja pasar si hay sesión y rol elegido */
function Protegida({ children }) {
  const { yo, rol, cargando } = useSesion();
  const loc = useLocation();
  if (cargando) return <Cargando className="h-full" texto="Abriendo Dojo OS…" />;
  if (!yo) return <Navigate to="/login" replace state={{ desde: loc.pathname }} />;
  if (yo.usuario?.debe_cambiar_password) return <Navigate to="/cambiar-contrasena" replace />;
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
      <Route path="/cambiar-contrasena" element={yo ? (yo.usuario?.debe_cambiar_password ? <CambiarContrasena /> : <Navigate to="/" replace />) : <Navigate to="/login" replace />} />
      <Route path="/elegir-rol" element={yo ? <ElegirRol /> : <Navigate to="/login" replace />} />
      <Route path="/tableta/vincular" element={yo && !cargando ? <Navigate to="/tableta" replace /> : <VincularTableta />} />
      <Route path="/tableta" element={<Protegida><Tableta /></Protegida>} />
      <Route element={<Protegida><Panel /></Protegida>}>
        <Route index element={<InicioSegunRol />} />
        <Route path="mi-perfil" element={<Navigate to="/cuenta" replace />} />
        <Route path="cuenta" element={<Cuenta />} />
        <Route path="cuenta/:seccion" element={<Cuenta />} />
        <Route path="alumnos" element={<Alumnos />} />
        <Route path="alumnos/importar" element={<Importar />} />
        <Route path="alumnos/:id" element={<Ficha />} />
        <Route path="inscripcion" element={<Inscripcion />} />
        <Route path="caja" element={<Caja />} />
        <Route path="avisos" element={<Avisos />} />
        <Route path="horarios" element={<Horarios />} />
        <Route path="asistencia" element={<Asistencia />} />
        <Route path="examenes" element={<Examenes />} />
        <Route path="examenes/:id" element={<ExamenDetalle />} />
        <Route path="tarifas" element={<Tarifas />} />
        <Route path="parametros" element={<Parametros />} />
        <Route path="bitacora" element={<Bitacora />} />
        <Route path="configuracion" element={<Configuracion />} />
        <Route path="configuracion/apariencia" element={<Apariencia />} />
        <Route path="configuracion/personal" element={<Personal />} />
        <Route path="configuracion/tabletas" element={<Tabletas />} />
        <Route path="configuracion/pagos-en-linea" element={<PagosEnLinea />} />
        <Route path="*" element={<Pronto titulo="Página no encontrada" />} />
      </Route>
    </Routes>
  );
}
