import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Building2, Crown, GraduationCap, LogOut, ReceiptText, ShieldCheck, Tablet, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSesion } from '../auth/Sesion';
import { Boton, BotonTema, Logo, useAvisos } from '../ui';

const ICONO = { super_admin: Crown, admin_sucursal: ShieldCheck, recepcion: ReceiptText, instructor: GraduationCap, responsable: Users, alumno: Users, tableta: Tablet };
const CON_DESCRIPCION = ['super_admin', 'admin_sucursal', 'recepcion', 'instructor'];

// S-01c · Elegir rol y sucursal (cuando una persona tiene más de un rol)
export default function ElegirRol() {
  const { roles, usuario, elegirRol, logout } = useSesion();
  const { t } = useTranslation();
  const avisar = useAvisos();
  const navegar = useNavigate();
  const [eligiendo, setEligiendo] = useState(null);

  const elegir = async (r) => {
    setEligiendo(r.usuario_rol_id);
    try { await elegirRol(r.usuario_rol_id); navegar('/', { replace: true }); }
    catch (e) { avisar(e.message, 'error'); setEligiendo(null); }
  };

  return (
    <div className="min-h-full flex flex-col">
      <header className="flex items-center justify-between px-6 h-16 border-b border-line">
        <Logo />
        <div className="flex items-center gap-1">
          <BotonTema />
          <Boton variante="fantasma" tam="sm" icono={LogOut} onClick={async () => { await logout(); navegar('/login'); }}>{t('comun.salir')}</Boton>
        </div>
      </header>
      <main className="flex-1 grid place-items-center px-4 py-10">
        <div className="w-full max-w-2xl anim-entrar">
          <p className="etiqueta">{t('elegirRol.hola', { nombre: usuario?.nombre })}</p>
          <h1 className="text-[32px] mt-1">{t('elegirRol.titulo')}</h1>
          <p className="text-muted mt-1">{t('elegirRol.texto')}</p>
          <div className="grid sm:grid-cols-2 gap-3 mt-7">
            {roles.map((r) => {
              const I = ICONO[r.rol] || ShieldCheck;
              return (
                <button key={r.usuario_rol_id} onClick={() => elegir(r)} disabled={!!eligiendo}
                  className="group text-left bg-surface border border-line rounded-[12px] p-5 hover:border-action transition-colors cursor-pointer disabled:opacity-60">
                  <div className="flex items-start justify-between">
                    <span className="grid place-items-center size-10 rounded-full bg-inset text-action"><I className="size-5" /></span>
                    <ArrowRight className="size-5 text-muted group-hover:text-action group-hover:translate-x-0.5 transition" />
                  </div>
                  <div className="mt-4 font-semibold text-[17px]">{t(`roles.${r.rol}`)}</div>
                  <div className="flex items-center gap-1.5 text-sm text-soft mt-0.5"><Building2 className="size-3.5" />{r.sucursal || t('comun.todasSucursales')}</div>
                  {CON_DESCRIPCION.includes(r.rol) && <p className="text-[13px] text-muted mt-3">{t(`elegirRol.queHace.${r.rol}`)}</p>}
                  {eligiendo === r.usuario_rol_id && <p className="text-[13px] text-action mt-3">{t('elegirRol.entrando')}</p>}
                </button>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
