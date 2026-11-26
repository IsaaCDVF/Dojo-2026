import { useTranslation } from 'react-i18next';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useSesion } from '../auth/Sesion';
import { useMarca } from '../marca/Marca';
import { IDIOMAS } from '../i18n';
import { Encabezado, Selector, Tarjeta, useAvisos } from '../ui';

const cx = (...c) => c.filter(Boolean).join(' ');

/** Botones de opción en fila (como los de las apps del celular) */
function Opciones({ valor, opciones, onCambio, etiqueta }) {
  return (
    <div role="radiogroup" aria-label={etiqueta} className="inline-flex flex-wrap gap-1 rounded-full border border-line bg-inset p-1">
      {opciones.map((o) => (
        <button key={o.v} role="radio" aria-checked={valor === o.v} onClick={() => onCambio(o.v)}
          className={cx('inline-flex items-center gap-1.5 h-9 px-4 rounded-full text-sm font-semibold cursor-pointer transition-colors',
            valor === o.v ? 'bg-action text-on-action' : 'text-soft hover:text-text')}>
          {o.icono && <o.icono className="size-4" />}{o.t}
        </button>
      ))}
    </div>
  );
}

export default function MiPerfil() {
  const { usuario, rol, roles } = useSesion();
  const { marca, pref, guardarPreferencias } = useMarca();
  const { t } = useTranslation();
  const avisar = useAvisos();
  const actual = roles.find((r) => r.usuario_rol_id === rol?.usuario_rol_id);
  const guardar = async (cambio) => {
    try { await guardarPreferencias(cambio); avisar(t('comun.guardado')); } catch (e) { avisar(e.message, 'error'); }
  };
  return (
    <>
      <Encabezado ruta={t('comun.cuenta')} titulo={t('perfil.hola', { nombre: usuario?.nombre || '' })} />
      <div className="grid lg:grid-cols-2 gap-4">
        <Tarjeta titulo={t('perfil.tusDatos')}>
          <div className="space-y-1 text-sm">
            <div>{t('perfil.correo')}: <b>{usuario?.email}</b></div>
            <div>{t('perfil.rolActivo')}: <b>{rol?.nombre ? t(`roles.${rol.nombre}`) : ''}</b></div>
            <div>{t('perfil.sucursal')}: <b>{actual?.sucursal || t('comun.todas')}</b></div>
          </div>
        </Tarjeta>
        <Tarjeta titulo={t('perfil.preferencias')} subtitulo={t('perfil.preferenciasSub')}>
          <div className="space-y-5">
            <Selector etiqueta={t('perfil.idioma')} value={pref.idioma || ''} onChange={(e) => guardar({ idioma: e.target.value || null })}>
              <option value="">{t('perfil.idiomaEmpresa', { idioma: t(`idiomas.${marca.idioma}`) })}</option>
              {IDIOMAS.map((l) => <option key={l} value={l}>{t(`idiomas.${l}`)}</option>)}
            </Selector>
            <div>
              <div className="text-[13px] font-semibold mb-1.5">{t('perfil.tema')}</div>
              <Opciones etiqueta={t('perfil.tema')} valor={pref.tema || 'sistema'} onCambio={(v) => guardar({ tema: v })}
                opciones={[{ v: 'sistema', t: t('perfil.temaSistema'), icono: Monitor }, { v: 'claro', t: t('perfil.temaClaro'), icono: Sun }, { v: 'oscuro', t: t('perfil.temaOscuro'), icono: Moon }]} />
            </div>
            <div>
              <div className="text-[13px] font-semibold mb-1.5">{t('perfil.letra')}</div>
              <Opciones etiqueta={t('perfil.letra')} valor={pref.letra || 'normal'} onCambio={(v) => guardar({ letra: v })}
                opciones={[{ v: 'normal', t: t('perfil.letraNormal') }, { v: 'grande', t: t('perfil.letraGrande') }, { v: 'muy_grande', t: t('perfil.letraMuyGrande') }]} />
            </div>
          </div>
        </Tarjeta>
      </div>
    </>
  );
}
