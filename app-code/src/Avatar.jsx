import { useId } from 'react';
import { colorCinta } from './api';

// Avatar del alumno dibujado en SVG por piezas. Cada accesorio de la base (tabla accesorios, columna imagen)
// es una clave que aquí se convierte en dibujo: banda-roja, dobok-negro, guantes-azules, fondo-montana...
// La cinta no se elige: es la del grado actual. Adrián puede cambiar estas piezas por ilustraciones después.

const BANDAS = { 'banda-blanca': '#f5f5f0', 'banda-roja': '#e23b3b', 'banda-azul': '#2f6fe4', 'banda-negra': '#1b1f2a', 'banda-dorada': '#f2b705' };
const GUANTES = { 'guantes-rojos': '#e23b3b', 'guantes-azules': '#2f6fe4' };
const DOBOK = {
  'dobok-blanco': { tela: '#f7f7f4', sombra: '#d9dde4', cuello: '#e3e7ee' },
  'dobok-cuello': { tela: '#f7f7f4', sombra: '#d9dde4', cuello: '#1b1f2a' },
  'dobok-negro': { tela: '#232838', sombra: '#171b27', cuello: '#0f121b' },
};
const PIEL = '#f6c9a3'; const PIEL_SOMBRA = '#e8b18a'; const PELO = '#3a2418';

function Fondo({ clave, id }) {
  switch (clave) {
    case 'fondo-atardecer':
      return (<>
        <defs><linearGradient id={`${id}a`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ff6f91" /><stop offset=".6" stopColor="#ffa45b" /><stop offset="1" stopColor="#ffd36b" /></linearGradient></defs>
        <rect width="200" height="200" fill={`url(#${id}a)`} />
        <circle cx="100" cy="132" r="58" fill="#fff2b3" opacity=".55" />
        <path d="M0 160 Q50 145 100 158 T200 152 V200 H0Z" fill="#7a3a52" opacity=".55" />
      </>);
    case 'fondo-montana':
      return (<>
        <defs><linearGradient id={`${id}m`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#4ea3ff" /><stop offset="1" stopColor="#c6e6ff" /></linearGradient></defs>
        <rect width="200" height="200" fill={`url(#${id}m)`} />
        <path d="M-10 170 L55 80 L95 135 L135 70 L210 170Z" fill="#35588f" />
        <path d="M55 80 L67 96 L58 93 L50 100 L45 94Z M135 70 L149 89 L139 86 L130 94 L124 86Z" fill="#fff" />
        <path d="M-10 175 Q100 150 210 175 V200 H-10Z" fill="#2b4d3f" />
      </>);
    case 'fondo-estrellas':
      return (<>
        <defs><linearGradient id={`${id}e`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#140a3a" /><stop offset="1" stopColor="#3d2a86" /></linearGradient></defs>
        <rect width="200" height="200" fill={`url(#${id}e)`} />
        {[[20, 25], [48, 60], [160, 30], [178, 78], [30, 120], [170, 132], [120, 18], [72, 22], [186, 175], [12, 180]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i % 3 ? 1.6 : 2.6} fill="#fff" opacity={i % 2 ? .7 : 1} />)}
        <circle cx="158" cy="44" r="14" fill="#ffe9a8" /><circle cx="164" cy="39" r="12" fill="#2a1c62" />
      </>);
    case 'fondo-dragon':
      return (<>
        <defs><radialGradient id={`${id}d`} cx=".5" cy=".7" r=".8"><stop offset="0" stopColor="#ff8a3d" /><stop offset=".5" stopColor="#b3202a" /><stop offset="1" stopColor="#3b0a10" /></radialGradient></defs>
        <rect width="200" height="200" fill={`url(#${id}d)`} />
        <path d="M14 150 C20 90 70 70 60 30 C90 60 100 30 96 8 C130 40 150 30 150 6 C180 50 186 100 186 150Z" fill="#ffb44d" opacity=".25" />
        <path d="M20 60 C60 20 110 70 150 40 C170 28 182 32 192 44" fill="none" stroke="#f2b705" strokeWidth="5" strokeLinecap="round" opacity=".8" />
        <circle cx="188" cy="42" r="4" fill="#f2b705" />
      </>);
    default: // tatami
      return (<>
        <rect width="200" height="200" fill="#163a6b" />
        <circle cx="100" cy="96" r="70" fill="#1f4c86" />
        <rect y="156" width="200" height="44" fill="#2f6b4f" />
        <path d="M0 156 H200 M66 156 V200 M134 156 V200 M0 178 H66 M134 178 H200" stroke="#255640" strokeWidth="3" />
      </>);
  }
}

/** equipo: [{tipo, imagen}] · cinta: nombre del color ("Amarilla") · animado: rebota suave */
export default function Avatar({ equipo = [], cinta, className = 'size-40', fondo = true, animado = false, saludo }) {
  const id = useId().replace(/:/g, '');
  const pieza = (tipo) => equipo.find((e) => e.tipo === tipo)?.imagen;
  const banda = BANDAS[pieza('cabeza')];
  const dobok = DOBOK[pieza('torso')] || DOBOK['dobok-blanco'];
  const guante = GUANTES[pieza('mano')];
  const pies = pieza('pies');
  const cintaColor = colorCinta(cinta || 'blanca');
  const avanzada = (cinta || '').toLowerCase().includes('avanzada');

  return (
    <svg viewBox="0 0 200 200" className={className} role="img" aria-label="Avatar">
      {fondo && <Fondo clave={pieza('fondo')} id={id} />}
      <g className={animado ? 'anim-rebote' : undefined} style={{ transformOrigin: '100px 190px' }}>
        <ellipse cx="100" cy="193" rx="42" ry="5" fill="#000" opacity=".18" />
        {/* piernas y pies */}
        <rect x="78" y="156" width="20" height="30" rx="8" fill={dobok.tela} />
        <rect x="102" y="156" width="20" height="30" rx="8" fill={dobok.tela} />
        <ellipse cx="87" cy="188" rx="12" ry="6" fill={pies ? '#e23b3b' : PIEL} />
        <ellipse cx="113" cy="188" rx="12" ry="6" fill={pies ? '#e23b3b' : PIEL} />
        {pies && <><rect x="78" y="182" width="18" height="4" rx="2" fill="#fff" opacity=".6" /><rect x="104" y="182" width="18" height="4" rx="2" fill="#fff" opacity=".6" /></>}
        {/* brazos arriba, celebrando */}
        <path d="M70 122 L48 100" stroke={dobok.tela} strokeWidth="17" strokeLinecap="round" />
        <path d="M130 122 L152 100" stroke={dobok.tela} strokeWidth="17" strokeLinecap="round" />
        {guante ? (<>
          <circle cx="45" cy="95" r="14" fill={guante} /><rect x="38" y="103" width="15" height="6" rx="3" fill="#fff" />
          <circle cx="155" cy="95" r="14" fill={guante} /><rect x="147" y="103" width="15" height="6" rx="3" fill="#fff" />
        </>) : (<>
          <circle cx="46" cy="96" r="10.5" fill={PIEL} /><path d="M40 92 h10" stroke={PIEL_SOMBRA} strokeWidth="2" strokeLinecap="round" />
          <circle cx="154" cy="96" r="10.5" fill={PIEL} /><path d="M150 92 h10" stroke={PIEL_SOMBRA} strokeWidth="2" strokeLinecap="round" />
        </>)}
        {/* torso con dobok */}
        <path d="M63 126 Q63 112 76 110 L124 110 Q137 112 137 126 L135 162 Q100 168 65 162Z" fill={dobok.tela} />
        <path d="M65 150 Q100 156 135 150 L135 162 Q100 168 65 162Z" fill={dobok.sombra} opacity=".6" />
        <path d="M84 110 L100 140 L116 110" fill="none" stroke={dobok.cuello} strokeWidth="7" strokeLinejoin="round" />
        {/* cinta del grado */}
        <rect x="64" y="144" width="72" height="11" rx="4" fill={cintaColor} stroke="#00000022" />
        {avanzada && <rect x="64" y="148" width="72" height="3" fill="#00000030" />}
        <path d="M96 152 L88 174 L95 175 L101 155Z M104 152 L113 173 L106 175 L99 155Z" fill={cintaColor} stroke="#00000022" />
        <rect x="93" y="141" width="14" height="16" rx="4" fill={cintaColor} stroke="#00000033" />
        {/* cabeza */}
        <rect x="92" y="100" width="16" height="14" rx="5" fill={PIEL_SOMBRA} />
        <circle cx="57" cy="76" r="8" fill={PIEL_SOMBRA} /><circle cx="143" cy="76" r="8" fill={PIEL_SOMBRA} />
        <circle cx="100" cy="70" r="44" fill={PIEL} />
        <path d="M56 70 Q55 24 100 24 Q145 24 144 70 Q138 50 122 47 Q112 58 98 49 Q86 57 72 49 Q60 55 56 70Z" fill={PELO} />
        {banda && (<>
          <path d="M56.5 58 Q100 45 143.5 58 L143 69 Q100 56 57 69Z" fill={banda} stroke="#00000022" />
          <path d="M141 60 Q160 50 176 56 L170 63 Q158 60 143 67Z M141 64 Q158 66 170 78 L162 82 Q154 72 142 69Z" fill={banda} stroke="#00000022" />
        </>)}
        {/* cara */}
        <path d="M76 70 q8 -5 15 0 M109 70 q8 -5 15 0" stroke={PELO} strokeWidth="3.2" fill="none" strokeLinecap="round" />
        <ellipse cx="84" cy="81" rx="5.2" ry="6.6" fill="#1d1d27" /><circle cx="86" cy="78.5" r="1.9" fill="#fff" />
        <ellipse cx="116" cy="81" rx="5.2" ry="6.6" fill="#1d1d27" /><circle cx="118" cy="78.5" r="1.9" fill="#fff" />
        <ellipse cx="73" cy="93" rx="7" ry="4" fill="#f59fb1" opacity=".75" /><ellipse cx="127" cy="93" rx="7" ry="4" fill="#f59fb1" opacity=".75" />
        <path d="M89 95 Q100 108 111 95Z" fill="#8b2f3b" /><path d="M94 101 Q100 105 106 101 Q100 98 94 101Z" fill="#f27a8a" />
      </g>
      {saludo && (<>
        <rect x="128" y="8" width="64" height="26" rx="13" fill="#fff" />
        <path d="M140 32 L136 42 L150 33Z" fill="#fff" />
        <text x="160" y="25.5" textAnchor="middle" fontSize="13" fontWeight="900" fill="#011c42" fontFamily="Nunito Variable, sans-serif">{saludo}</text>
      </>)}
    </svg>
  );
}

/** Medalla de un grado: con el color de su cinta si ya se ganó; gris con candado si no */
export function Insignia({ color, obtenida, className = 'size-14' }) {
  const c = colorCinta(color);
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <circle cx="32" cy="34" r="27" fill={obtenida ? '#c98600' : '#0b2347'} />
      <circle cx="32" cy="31" r="27" fill={obtenida ? '#f2a900' : '#163a6b'} />
      <circle cx="32" cy="31" r="20" fill={obtenida ? c : '#10335f'} stroke={obtenida ? '#ffffff88' : 'none'} strokeWidth="2" />
      {obtenida
        ? <path d="M32 19 l3.6 7.6 8.3 1 -6.1 5.7 1.6 8.2 -7.4 -4.1 -7.4 4.1 1.6 -8.2 -6.1 -5.7 8.3 -1Z" fill={['#f4f4f0', '#facc15'].includes(c) ? '#011c42' : '#fff'} />
        : <path d="M25 30 v-3 a7 7 0 0 1 14 0 v3 M23 30 h18 v12 h-18Z" fill="none" stroke="#5f7aa8" strokeWidth="3" strokeLinejoin="round" />}
    </svg>
  );
}
