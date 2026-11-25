import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, KeyRound } from 'lucide-react';
import { useSesion } from '../sesion';
import { Boton, Campo, ErrorCaja } from '../ui';

// Activar la cuenta con el código que mandó recepción por WhatsApp y crear la contraseña.
export default function Activar() {
  const { activar } = useSesion();
  const navegar = useNavigate();
  const [f, setF] = useState({ usuario: '', codigo: '', pass: '', pass2: '' });
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const cambiar = (k) => (e) => setF((x) => ({ ...x, [k]: k === 'codigo' ? e.target.value.replace(/\D/g, '').slice(0, 6) : e.target.value }));

  async function enviar(e) {
    e.preventDefault();
    if (f.pass !== f.pass2) { setError(new Error('Las contraseñas no son iguales')); return; }
    setEnviando(true); setError(null);
    try { await activar(f.usuario.trim(), f.codigo, f.pass); navegar('/', { replace: true }); }
    catch (err) { setError(err); } finally { setEnviando(false); }
  }

  return (
    <div className="min-h-full bg-canvas">
      <div className="mx-auto max-w-md px-5 pt-5 pb-10">
        <Link to="/entrar" className="inline-grid place-items-center size-11 rounded-full bg-surface" aria-label="Regresar"><ChevronLeft className="size-6" /></Link>
        <div className="mt-6 grid place-items-center size-16 rounded-3xl bg-gold/15 text-gold"><KeyRound className="size-8" strokeWidth={2.4} /></div>
        <h1 className="text-[30px] font-black leading-tight mt-4">Activa tu cuenta</h1>
        <p className="text-muted font-semibold mt-1">Usa el código de 6 números que te mandó la recepción de tu dojo por WhatsApp. Vence en 72 horas.</p>
        <form onSubmit={enviar} className="mt-6 space-y-4">
          <Campo etiqueta="Matrícula o teléfono" value={f.usuario} onChange={cambiar('usuario')} placeholder="CENT-26-0013 o 2221234567" autoComplete="username" required />
          <label className="block">
            <span className="etiqueta block mb-1.5">Código de activación</span>
            <input value={f.codigo} onChange={cambiar('codigo')} inputMode="numeric" autoComplete="one-time-code" placeholder="••••••" required
              className="w-full h-16 rounded-2xl bg-deep border-2 border-line px-4 text-center text-[30px] font-black tracking-[.5em] outline-none focus:border-gold" />
          </label>
          <Campo etiqueta="Crea tu contraseña (mínimo 8)" type="password" value={f.pass} onChange={cambiar('pass')} autoComplete="new-password" minLength={8} required />
          <Campo etiqueta="Repítela" type="password" value={f.pass2} onChange={cambiar('pass2')} autoComplete="new-password" minLength={8} required />
          <ErrorCaja error={error} />
          <Boton type="submit" tono="oro" cargando={enviando} disabled={f.codigo.length !== 6}>Activar y entrar</Boton>
        </form>
      </div>
    </div>
  );
}
