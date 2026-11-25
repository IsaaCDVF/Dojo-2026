import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { useSesion } from '../sesion';
import { Isotipo } from '../Logo';
import Avatar from '../Avatar';
import { Boton, Campo, ErrorCaja } from '../ui';

// Entrar: el alumno con su matrícula, el responsable con su teléfono (o el correo si lo tiene).
export default function Entrar() {
  const { entrar, aviso } = useSesion();
  const navegar = useNavigate();
  const [usuario, setUsuario] = useState('');
  const [pass, setPass] = useState('');
  const [ver, setVer] = useState(false);
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e) {
    e.preventDefault(); setEnviando(true); setError(null);
    try { await entrar(usuario.trim(), pass); navegar('/', { replace: true }); }
    catch (err) { setError(err); } finally { setEnviando(false); }
  }

  return (
    <div className="min-h-full bg-canvas">
      <div className="mx-auto max-w-md px-5 pt-8 pb-10">
        <div className="flex items-center gap-2.5"><Isotipo className="size-10 text-white" /><span className="text-[22px] font-black">Dojo <span className="text-gold">OS</span></span></div>
        <div className="mt-6 mx-auto size-60 rounded-[36px] overflow-hidden border-2 border-line">
          <Avatar equipo={[{ tipo: 'cabeza', imagen: 'banda-roja' }, { tipo: 'fondo', imagen: 'fondo-atardecer' }]} cinta="Amarilla" className="size-full" animado saludo="¡Osu!" />
        </div>
        <h1 className="text-[30px] font-black leading-tight mt-6">Entra a tu dojo</h1>
        <p className="text-muted font-semibold mt-1">Tu credencial, tu camino de cintas y tu avatar.</p>
        <form onSubmit={enviar} className="mt-6 space-y-4">
          <Campo etiqueta="Matrícula o teléfono" value={usuario} onChange={(e) => setUsuario(e.target.value)} placeholder="CENT-26-0013 o 2221234567" autoComplete="username" autoCapitalize="characters" required />
          <div className="relative">
            <Campo etiqueta="Contraseña" type={ver ? 'text' : 'password'} value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="current-password" required />
            <button type="button" onClick={() => setVer(!ver)} aria-label={ver ? 'Ocultar' : 'Mostrar'} className="absolute right-3 bottom-3 grid place-items-center size-8 text-muted cursor-pointer">{ver ? <EyeOff className="size-5" /> : <Eye className="size-5" />}</button>
          </div>
          {aviso && !error && <p className="text-gold font-bold text-[14px]">{aviso}</p>}
          <ErrorCaja error={error} />
          <Boton type="submit" icono={LogIn} cargando={enviando}>Entrar</Boton>
        </form>
        <Link to="/activar" className="block mt-4"><Boton tono="contorno" type="button">Activar mi cuenta</Boton></Link>
        <p className="text-center text-[13px] text-muted font-semibold mt-6">El acceso a la app te lo da la recepción de tu dojo.<br />¿Olvidaste tu contraseña? Pide un código nuevo ahí.</p>
      </div>
    </div>
  );
}
