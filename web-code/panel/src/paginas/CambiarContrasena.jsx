import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Eye, EyeOff, KeyRound, LogOut, X } from 'lucide-react';
import { api } from '../api';
import { useSesion } from '../auth/Sesion';
import { useMarca } from '../marca/Marca';
import { NombreMarca } from '../marca/NombreMarca';
import { Boton, Campo, ErrorCaja, useAvisos } from '../ui';

// Cambiar contraseña: obligatorio la primera vez (entró con una temporal) y disponible en Mi perfil.

const reglas = (n) => [
  ['Al menos 8 caracteres', n.length >= 8],
  ['Letras', /[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(n)],
  ['Números', /\d/.test(n)],
];

export function FormContrasena({ onListo, textoBoton = 'Cambiar contraseña', actualEtiqueta = 'Contraseña actual', enfocar = false }) {
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [otra, setOtra] = useState('');
  const [ver, setVer] = useState(false);
  const [error, setError] = useState(null);
  const [err, setErr] = useState({});
  const [enviando, setEnviando] = useState(false);
  const ok = reglas(nueva).every(([, v]) => v);

  async function enviar(e) {
    e.preventDefault();
    const x = {};
    if (!actual) x.actual = 'Escríbela';
    if (!ok) x.nueva = 'Revisa los requisitos';
    if (nueva !== otra) x.otra = 'No coincide con la nueva';
    setErr(x); setError(null);
    if (Object.keys(x).length) return;
    setEnviando(true);
    try { await api.put('/auth/contrasena', { actual, nueva }); setActual(''); setNueva(''); setOtra(''); onListo?.(); }
    catch (ex) { if (ex.detalle?.campo) setErr({ [ex.detalle.campo]: ex.message }); else setError(ex); }
    finally { setEnviando(false); }
  }
  const ojo = <button type="button" onClick={() => setVer(!ver)} aria-label={ver ? 'Ocultar' : 'Mostrar'} className="text-muted hover:text-text cursor-pointer">{ver ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>;

  return (
    <form onSubmit={enviar} noValidate className="space-y-4">
      <Campo etiqueta={actualEtiqueta} type={ver ? 'text' : 'password'} value={actual} onChange={(e) => setActual(e.target.value)} error={err.actual} autoComplete="current-password" autoFocus={enfocar} derecha={ojo} />
      <Campo etiqueta="Contraseña nueva" type={ver ? 'text' : 'password'} value={nueva} onChange={(e) => setNueva(e.target.value)} error={err.nueva} autoComplete="new-password" />
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] -mt-2">
        {reglas(nueva).map(([t, v]) => <li key={t} className={`flex items-center gap-1 ${v ? 'text-ok' : 'text-muted'}`}>{v ? <Check className="size-3.5" /> : <X className="size-3.5" />}{t}</li>)}
      </ul>
      <Campo etiqueta="Repite la nueva" type={ver ? 'text' : 'password'} value={otra} onChange={(e) => setOtra(e.target.value)} error={err.otra} autoComplete="new-password" />
      <ErrorCaja error={error} />
      <Boton type="submit" icono={KeyRound} cargando={enviando} className="w-full">{textoBoton}</Boton>
    </form>
  );
}

/** Pantalla completa: la primera vez que entra con la contraseña temporal */
export default function CambiarContrasena() {
  const { usuario, recargar, logout, rol } = useSesion();
  const { marca } = useMarca();
  const avisar = useAvisos();
  const navegar = useNavigate();
  const listo = async () => {
    avisar('¡Listo! Ya tienes tu propia contraseña');
    await recargar();
    navegar(rol ? '/' : '/elegir-rol', { replace: true });
  };
  return (
    <div className="min-h-full grid place-items-center px-4 py-10">
      <div className="w-full max-w-[440px] bg-surface border border-line rounded-[14px] shadow-2xl overflow-hidden anim-entrar">
        <div className="h-1" style={{ background: 'linear-gradient(90deg, var(--soft), var(--action))' }} />
        <div className="px-8 pt-7 pb-7">
          <div className="text-[13px] text-muted"><NombreMarca nombre={marca.nombre} fuente={marca.fuente_nombre} /></div>
          <h1 className="text-[24px] mt-1">Hola, {usuario?.nombre}</h1>
          <p className="text-muted text-sm mt-1 mb-6">Entraste con una contraseña temporal. Crea la tuya para seguir; solo tú la vas a saber.</p>
          <FormContrasena onListo={listo} textoBoton="Guardar y entrar" actualEtiqueta="Contraseña temporal" enfocar />
          <button type="button" onClick={async () => { await logout(); navegar('/login', { replace: true }); }}
            className="mt-4 w-full flex items-center justify-center gap-1.5 text-[13px] text-muted hover:text-text cursor-pointer"><LogOut className="size-3.5" /> Salir</button>
        </div>
      </div>
    </div>
  );
}
