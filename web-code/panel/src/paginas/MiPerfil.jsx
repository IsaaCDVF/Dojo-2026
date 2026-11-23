import { useSesion, NOMBRE_ROL } from '../auth/Sesion';
import { Encabezado, Tarjeta } from '../ui';

export default function MiPerfil() {
  const { usuario, rol, roles } = useSesion();
  const actual = roles.find((r) => r.usuario_rol_id === rol?.usuario_rol_id);
  return (
    <>
      <Encabezado ruta="Cuenta" titulo={`Hola, ${usuario?.nombre || ''}`} />
      <Tarjeta titulo="Tus datos">
        <div className="space-y-1 text-sm">
          <div>Correo: <b>{usuario?.email}</b></div>
          <div>Rol activo: <b>{NOMBRE_ROL[rol?.nombre]}</b></div>
          <div>Sucursal: <b>{actual?.sucursal || 'Todas'}</b></div>
        </div>
      </Tarjeta>
    </>
  );
}