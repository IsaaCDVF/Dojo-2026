import { Hammer } from 'lucide-react';
import { Encabezado, Tarjeta, Vacio } from '../ui';

// Pantallas que todavía no están terminadas
export default function Pronto({ titulo, descripcion }) {
  return (
    <>
      <Encabezado titulo={titulo} descripcion={descripcion} />
      <Tarjeta><Vacio icono={Hammer} titulo="Esta pantalla está en construcción" texto="La API y el diseño ya están planeados; se conecta en los próximos días." /></Tarjeta>
    </>
  );
}
