import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, AtSign, Eye, EyeOff, Lock, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSesion } from '../auth/Sesion';
import { useMarca } from '../marca/Marca';
import { Boton, BotonTema, Campo, Isotipo } from '../ui';

// S-01a / S-01b · Inicio de sesión (con error en el mismo lugar, sin recargar)
export default function Login() {
  const { login, aviso } = useSesion();
  const { t } = useTranslation();
  const { marca, modo } = useMarca();
  const im = marca.imagenes || {};
  const logo = modo === 'dark' ? (im.logo_oscuro || im.logo) : (im.logo || im.logo_oscuro);
  const navegar = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [ver, setVer] = useState(false);
  const [recordar, setRecordar] = useState(false);
  const [error, setError] = useState('');
  const [errores, setErrores] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [sacudir, setSacudir] = useState(0);

  const enviar = async (e) => {
    e.preventDefault();
    const faltan = {};
    if (!email.trim()) faltan.email = t('login.faltaCorreo');
    else if (!/^\S+@\S+\.\S+$/.test(email)) faltan.email = t('login.correoInvalido');
    if (!password) faltan.password = t('login.faltaContrasena');
    setErrores(faltan);
    if (Object.keys(faltan).length) { setSacudir((n) => n + 1); return; }
    setEnviando(true); setError('');
    try {
      const r = await login(email.trim(), password, recordar);
      navegar(r.debe_elegir_rol ? '/elegir-rol' : '/', { replace: true });
    } catch (err) {
      setError(err.message); setSacudir((n) => n + 1);
    } finally { setEnviando(false); }
  };

  return (
    <div className="relative min-h-full flex flex-col overflow-hidden">
      {/* Aurora: solo decoración */}
      <div aria-hidden className="pointer-events-none absolute -right-40 top-0 h-full w-[70vw] opacity-60 blur-[70px]"
        style={{ background: 'radial-gradient(60% 50% at 70% 40%, color-mix(in srgb, var(--action) 55%, transparent) 0%, transparent 70%), radial-gradient(50% 60% at 40% 80%, color-mix(in srgb, var(--soft) 45%, transparent) 0%, transparent 70%), radial-gradient(40% 40% at 85% 85%, color-mix(in srgb, var(--gold) 35%, transparent) 0%, transparent 70%)' }} />
      <header className="relative flex items-center justify-between px-6 py-4">
        <span className="etiqueta">{marca.nombre} · {t('login.etiqueta')}</span>
        <BotonTema />
      </header>

      <main className="relative flex-1 grid place-items-center px-4 pb-10">
        <form key={sacudir} onSubmit={enviar} noValidate
          className={`w-full max-w-[420px] bg-surface/95 backdrop-blur border border-line rounded-[14px] shadow-2xl overflow-hidden ${sacudir ? 'anim-sacudir' : 'anim-entrar'}`}>
          <div className="h-1" style={{ background: 'linear-gradient(90deg, var(--soft), var(--action))' }} />
          <div className="px-8 pt-8 pb-7">
            <div className="flex flex-col items-center text-center">
              {logo
                ? <img src={logo} alt={marca.nombre} className="h-16 max-w-[240px] object-contain" />
                : <span className="grid place-items-center size-16 rounded-full bg-inset text-text">{im.icono ? <img src={im.icono} alt="" className="size-12 rounded-md object-contain" /> : <Isotipo className="size-12" />}</span>}
              {!logo && <h1 className="text-[28px] mt-3">{marca.nombre === 'Dojo OS' ? <>Dojo <span className="text-gold font-normal">OS</span></> : marca.nombre}</h1>}
              <p className={`text-muted text-sm ${logo ? 'mt-3' : ''}`}>{marca.lema || t('login.subtitulo')}</p>
            </div>

            {(error || aviso) && (
              <div role="alert" className={`mt-6 rounded-md px-4 py-3 text-sm border ${error ? 'bg-danger-bg text-danger border-danger/40' : 'bg-warn-bg text-warn border-warn/40'}`}>
                {error || aviso}
              </div>
            )}

            <div className="mt-6 space-y-4">
              <Campo etiqueta={t('login.correo')} icono={AtSign} type="email" autoComplete="username" placeholder="tu@correo.com"
                value={email} onChange={(e) => setEmail(e.target.value)} error={errores.email} />
              <Campo etiqueta={t('login.contrasena')} icono={Lock} type={ver ? 'text' : 'password'} autoComplete="current-password" placeholder="••••••••"
                value={password} onChange={(e) => setPassword(e.target.value)} error={errores.password}
                derecha={<button type="button" onClick={() => setVer((v) => !v)} className="text-muted hover:text-text cursor-pointer" aria-label={ver ? t('login.ocultarContrasena') : t('login.verContrasena')}>
                  {ver ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>} />
              <label className="flex items-center gap-2 text-sm text-soft cursor-pointer select-none">
                <input type="checkbox" checked={recordar} onChange={(e) => setRecordar(e.target.checked)} className="size-4 accent-[var(--action)]" />
                {t('login.recordar')}
              </label>
            </div>

            <Boton type="submit" tam="lg" cargando={enviando} className="w-full mt-6">
              {t('login.entrar')} {!enviando && <ArrowRight className="size-4" />}
            </Boton>
          </div>
          <div className="px-8 py-3.5 border-t border-line bg-inset/50 text-[12px] text-muted flex items-center justify-center gap-1.5">
            <ShieldCheck className="size-3.5 text-action" /> {t('login.cifrada')}
          </div>
        </form>
      </main>
      <footer className="relative px-6 py-4 text-[12px] text-muted">© 2026 {marca.nombre}{marca.nombre !== 'Dojo OS' && ` · ${t('comun.hechoCon')}`}</footer>
    </div>
  );
}
