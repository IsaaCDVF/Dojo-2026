import { Cabecera } from '../Marco';
import { Tarjeta } from '../ui';

export default function SinAlumnos() {
  return (
    <>
      <Cabecera titulo="Dojo OS" />
      <Tarjeta className="text-center">
        <div className="text-[44px]">🥋</div>
        <h2 className="text-[20px] font-black mt-2">Tu cuenta no tiene alumnos</h2>
        <p className="text-muted font-semibold mt-1">Esta app es para alumnos y responsables de pago. Si eres del personal, usa el panel web.</p>
      </Tarjeta>
    </>
  );
}
