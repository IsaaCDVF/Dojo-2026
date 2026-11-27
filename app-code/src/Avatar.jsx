import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { colorCinta } from './api';
import { POSES, disciplinaDe, mezclar, respirar } from './avatar/esqueleto';
import { Fondo } from './avatar/fondos.jsx';

// Avatar del alumno: el dibujo de frente de siempre, por piezas, con brazos y piernas que se mueven.
// - apariencia: {piel, peinado, color_pelo, vello, complexion, disciplina} → viene de la API
// - equipo: [{tipo, imagen}] accesorios puestos (banda-roja, dobok-negro, guantes-azules, protector-pie, fondo-…)
// - cinta: color del grado ("Amarilla avanzada"). No se elige: es la de su grado.
// - animado: rebota; interactivo: al tocarlo hace el siguiente movimiento de su disciplina;
//   accion: {id, n} hace ese movimiento cada vez que cambia n; demostracion: los hace solo cada pocos segundos.
// Las poses y movimientos están en src/avatar/esqueleto.js. Adrián puede cambiar los dibujos de cada pieza.

export const PIELES = { 1: '#fbd9bd', 2: '#f6c9a3', 3: '#d9a273', 4: '#b97f52', 5: '#8a5a39', 6: '#5f3d26' };
export const PELOS = {
  negro: '#2a1b14', castano_oscuro: '#3a2418', castano: '#6b432a', rubio: '#d1a85c',
  pelirrojo: '#b04a1f', canoso: '#bdb9b3', azul: '#2f5fd0', rosa: '#d965a5',
};
const BANDAS = { 'banda-blanca': '#f5f5f0', 'banda-roja': '#e23b3b', 'banda-azul': '#2f6fe4', 'banda-negra': '#1b1f2a', 'banda-dorada': '#f2b705' };
const GUANTES = { 'guantes-rojos': '#e23b3b', 'guantes-azules': '#2f6fe4' };
const DOBOK = {
  'dobok-blanco': { tela: '#f7f7f4', sombra: '#d9dde4', cuello: '#e3e7ee' },
  'dobok-cuello': { tela: '#f7f7f4', sombra: '#d9dde4', cuello: '#1b1f2a' },
  'dobok-negro': { tela: '#232838', sombra: '#171b27', cuello: '#0f121b' },
};
const ANCHO = { delgada: 0.9, media: 1, robusta: 1.12 };

/** Oscurece (f < 1) o aclara (f > 1) un color #rrggbb */
export function tono(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(f > 1 ? v + (255 - v) * (f - 1) : v * f))));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}
const dir = (a) => [Math.cos((a * Math.PI) / 180), Math.sin((a * Math.PI) / 180)];
const mas = (p, v, k) => [p[0] + v[0] * k, p[1] + v[1] * k];

/* ---------------- animación ---------------- */
function useMovimientos({ base, disciplina, animado, interactivo, accion, demostracion }) {
  const [, pintar] = useState(0);
  const st = useRef({ cuadros: [], desde: POSES[base], inicio: 0, texto: null, siguiente: 0, ultimo: POSES[base] });
  const vivo = animado || interactivo || demostracion || !!accion;
  const reducido = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const jugar = useCallback((mov) => {
    const s = st.current;
    if (!mov) return;
    s.desde = s.ultimo; s.inicio = performance.now();
    s.cuadros = mov.cuadros.map(([p, ms]) => ({ pose: POSES[p], ms }));
    s.texto = mov.texto || null;
    pintar((x) => x + 1);
  }, []);

  useEffect(() => {
    if (!vivo || reducido) return undefined;
    let id; const ciclo = () => { pintar((x) => x + 1); id = requestAnimationFrame(ciclo); };
    id = requestAnimationFrame(ciclo);
    return () => cancelAnimationFrame(id);
  }, [vivo, reducido]);

  useEffect(() => { if (accion?.id) jugar(disciplina.movimientos.find((m) => m.id === accion.id)); }, [accion?.n]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!demostracion) return undefined;
    let i = 0;
    const t = setInterval(() => { jugar(disciplina.movimientos[i % disciplina.movimientos.length]); i += 1; }, 2600);
    return () => clearInterval(t);
  }, [demostracion, disciplina, jugar]);

  const s = st.current; const ahora = performance.now();
  let pose = POSES[base]; let enMovimiento = false; let restante = ahora - s.inicio; let anterior = s.desde;
  for (const c of s.cuadros) {
    if (restante < c.ms) { const k = 1 - (1 - restante / c.ms) ** 3; pose = mezclar(anterior, c.pose, k); enMovimiento = true; break; }
    restante -= c.ms; anterior = c.pose;
  }
  if (!enMovimiento && s.cuadros.length) s.cuadros = [];
  if (vivo && !reducido && !enMovimiento) pose = respirar(pose, ahora / 1000);
  s.ultimo = pose;
  const tocar = interactivo ? () => { jugar(disciplina.movimientos[s.siguiente % disciplina.movimientos.length]); s.siguiente += 1; } : undefined;
  return { pose, texto: enMovimiento ? (s.texto || (pose.grito ? disciplina.grito : null)) : null, tocar, ahora };
}

/* ---------------- dibujo ---------------- */
export default function Avatar({
  equipo = [], cinta, apariencia, className = 'size-40', fondo = true, animado = false, interactivo = false,
  accion, demostracion = false, saludo, encuadre = 'cuerpo', pose: poseFija,
}) {
  const id = useId().replace(/:/g, '');
  const ap = apariencia || {};
  const disc = disciplinaDe(ap.disciplina);
  const { pose: P, texto, tocar, ahora } = useMovimientos({ base: poseFija || 'osu', disciplina: disc, animado, interactivo, accion, demostracion });
  const pieza = (tipo) => equipo.find((e) => e.tipo === tipo)?.imagen;

  const piel = PIELES[ap.piel] || PIELES[2];
  const pielSombra = tono(piel, 0.9);
  const pelo = PELOS[ap.color_pelo] || PELOS.negro;
  const boxeo = disc.uniforme === 'box';
  const dobok = DOBOK[pieza('torso')] || DOBOK['dobok-blanco'];
  const short = pieza('torso') === 'dobok-negro' ? '#1d2130' : '#c62f36';
  const banda = BANDAS[pieza('cabeza')];
  const guante = boxeo ? (GUANTES[pieza('mano')] || '#e23b3b') : GUANTES[pieza('mano')];
  const pies = pieza('pies');
  const cintaColor = colorCinta(cinta || 'blanca');
  const avanzada = (cinta || '').toLowerCase().includes('avanzada');
  const k = ANCHO[ap.complexion] || 1;
  const ondea = Math.sin(ahora / 240) * 2.5;

  // --- piernas (cadera fija; la pierna es [ángulo, largo])
  const pierna = (cadera, [a, l]) => {
    const d = dir(a); const fin = mas(cadera, d, l); const pie = mas(cadera, d, l + 2);
    const colorPie = boxeo ? '#22252e' : pies ? '#e23b3b' : piel;
    return (
      <g>
        {boxeo ? (<>
          <line x1={cadera[0]} y1={cadera[1]} x2={fin[0]} y2={fin[1]} stroke={piel} strokeWidth="17" />
          <line x1={cadera[0]} y1={cadera[1]} x2={mas(cadera, d, l * 0.55)[0]} y2={mas(cadera, d, l * 0.55)[1]} stroke={short} strokeWidth="22" />
        </>) : <line x1={cadera[0]} y1={cadera[1]} x2={fin[0]} y2={fin[1]} stroke={dobok.tela} strokeWidth="20" />}
        <ellipse cx={pie[0]} cy={pie[1]} rx="12" ry="6" fill={colorPie} transform={`rotate(${a - 90} ${pie[0]} ${pie[1]})`} />
        {pies && !boxeo && <rect x={pie[0] - 9} y={pie[1] - 6} width="18" height="4" rx="2" fill="#fff" opacity=".6" transform={`rotate(${a - 90} ${pie[0]} ${pie[1]})`} />}
      </g>
    );
  };
  // --- brazos (hombro fijo en el tronco)
  const brazo = (hombro, [a, l]) => {
    const d = dir(a); const fin = mas(hombro, d, l); const mano = mas(hombro, d, l + 4);
    return (
      <g>
        <path d={`M${hombro[0]} ${hombro[1]} L${fin[0]} ${fin[1]}`} stroke={boxeo ? piel : dobok.tela} strokeWidth="17" strokeLinecap="round" />
        {guante ? (<>
          <circle cx={mano[0]} cy={mano[1]} r="14" fill={guante} />
          <rect x={mano[0] - 7.5} y={mano[1] + 8} width="15" height="6" rx="3" fill="#fff" transform={`rotate(${a + 45} ${mano[0]} ${mano[1]})`} />
        </>) : (<>
          <circle cx={mano[0]} cy={mano[1]} r="10.5" fill={piel} />
          <path d={`M${mano[0] - 6} ${mano[1] - 4} h10`} stroke={pielSombra} strokeWidth="2" strokeLinecap="round" />
        </>)}
      </g>
    );
  };
  const hombroIzq = [100 - 30 * k, 122]; const hombroDer = [100 + 30 * k, 122];
  const finDe = (h, b, extra) => mas(h, dir(b[0]), b[1] + extra);
  const impacto = P.impacto === 'bd' ? finDe(hombroDer, P.bd, 6) : P.impacto === 'bi' ? finDe(hombroIzq, P.bi, 6)
    : P.impacto === 'pd' ? finDe([112, 158], P.pd, 4) : null;
  const kiai = !!P.grito; const cerrados = P.ojos === 'cerrados';

  const vista = encuadre === 'cabeza' ? '40 6 120 120' : '0 0 200 200';
  const globo = texto || saludo;

  return (
    <svg viewBox={vista} className={className} role="img" aria-label="Avatar" onClick={tocar}
      style={tocar ? { cursor: 'pointer', WebkitTapHighlightColor: 'transparent' } : undefined}>
      {fondo && <Fondo clave={pieza('fondo')} id={id} />}
      <ellipse cx="100" cy="193" rx="42" ry="5" fill="#000" opacity=".18" />
      <g transform={`translate(${P.x.toFixed(1)} ${P.y.toFixed(1)}) rotate(${P.giro.toFixed(1)} 88 186)`}>
        {pierna([88, 158], P.pi)}
        {pierna([112, 158], P.pd)}
        <g transform={`translate(0 ${P.alto.toFixed(1)})`}>
          {/* tronco con dobok (o camiseta en box) */}
          <g transform={`translate(100 0) scale(${k} 1) translate(-100 0)`}>
            <path d="M63 126 Q63 112 76 110 L124 110 Q137 112 137 126 L135 162 Q100 168 65 162Z" fill={boxeo ? (pieza('torso') === 'dobok-negro' ? '#1d2130' : '#f7f7f4') : dobok.tela} />
            <path d="M65 150 Q100 156 135 150 L135 162 Q100 168 65 162Z" fill={boxeo ? short : dobok.sombra} opacity={boxeo ? 1 : 0.6} />
            {boxeo
              ? <path d="M80 110 Q100 128 120 110" fill={piel} />
              : disc.uniforme === 'gi'
                ? <path d="M84 110 L110 152 M116 110 L98 134" fill="none" stroke={dobok.cuello === dobok.tela ? dobok.sombra : dobok.cuello} strokeWidth="6" strokeLinecap="round" />
                : <path d="M84 110 L100 140 L116 110" fill="none" stroke={dobok.cuello} strokeWidth="7" strokeLinejoin="round" />}
            {!boxeo && (<>
              <rect x="64" y="144" width="72" height="11" rx="4" fill={cintaColor} stroke="#00000022" />
              {avanzada && <rect x="64" y="148" width="72" height="3" fill="#00000030" />}
              <path d={`M96 152 L${88 + ondea * 0.4} 174 L${95 + ondea * 0.4} 175 L101 155Z M104 152 L${113 - ondea * 0.4} 173 L${106 - ondea * 0.4} 175 L99 155Z`} fill={cintaColor} stroke="#00000022" />
              <rect x="93" y="141" width="14" height="16" rx="4" fill={cintaColor} stroke="#00000033" />
            </>)}
          </g>
          {/* cabeza */}
          <g transform={`translate(0 ${P.cab.toFixed(1)}) rotate(${P.cabGiro.toFixed(1)} 100 110)`}>
            <rect x="92" y="100" width="16" height="14" rx="5" fill={pielSombra} />
            <PeloAtras estilo={ap.peinado} color={pelo} ondea={ondea} />
            <circle cx="57" cy="76" r="8" fill={pielSombra} /><circle cx="143" cy="76" r="8" fill={pielSombra} />
            <circle cx="100" cy="70" r="44" fill={piel} />
            <Pelo estilo={ap.peinado} color={pelo} />
            {banda && (<>
              <path d="M56.5 58 Q100 45 143.5 58 L143 69 Q100 56 57 69Z" fill={banda} stroke="#00000022" />
              <path d={`M141 60 Q160 ${50 + ondea} 176 ${56 + ondea} L170 ${63 + ondea} Q158 ${60 + ondea} 143 67Z M141 64 Q158 ${66 - ondea} 170 ${78 - ondea} L162 ${82 - ondea} Q154 ${72 - ondea} 142 69Z`} fill={banda} stroke="#00000022" />
            </>)}
            {/* cara */}
            {kiai
              ? <path d="M76 66 L91 72 M109 72 L124 66" stroke={pelo} strokeWidth="3.4" fill="none" strokeLinecap="round" />
              : <path d="M76 70 q8 -5 15 0 M109 70 q8 -5 15 0" stroke={pelo} strokeWidth="3.2" fill="none" strokeLinecap="round" />}
            {cerrados
              ? <path d="M79 82 q5 4 10 0 M111 82 q5 4 10 0" stroke="#1d1d27" strokeWidth="3" fill="none" strokeLinecap="round" />
              : (<>
                <ellipse cx="84" cy="81" rx="5.2" ry={kiai ? 5 : 6.6} fill="#1d1d27" /><circle cx="86" cy="78.5" r="1.9" fill="#fff" />
                <ellipse cx="116" cy="81" rx="5.2" ry={kiai ? 5 : 6.6} fill="#1d1d27" /><circle cx="118" cy="78.5" r="1.9" fill="#fff" />
              </>)}
            <ellipse cx="73" cy="93" rx="7" ry="4" fill="#f59fb1" opacity=".75" /><ellipse cx="127" cy="93" rx="7" ry="4" fill="#f59fb1" opacity=".75" />
            <Vello tipo={ap.etapa === 'nino' ? 'ninguno' : ap.vello} color={pelo} />
            {kiai
              ? (<><ellipse cx="100" cy="101" rx="9" ry="8" fill="#8b2f3b" /><ellipse cx="100" cy="105" rx="5" ry="3" fill="#f27a8a" /></>)
              : (<><path d="M89 95 Q100 108 111 95Z" fill="#8b2f3b" /><path d="M94 101 Q100 105 106 101 Q100 98 94 101Z" fill="#f27a8a" /></>)}
          </g>
          {brazo(hombroIzq, P.bi)}
          {brazo(hombroDer, P.bd)}
        </g>
        {impacto && <Impacto p={impacto} />}
      </g>
      {globo && (<>
        <rect x="128" y="8" width="64" height="26" rx="13" fill="#fff" />
        <path d="M140 32 L136 42 L150 33Z" fill="#fff" />
        <text x="160" y="25.5" textAnchor="middle" fontSize={globo.length > 7 ? 11 : 13} fontWeight="900" fill="#011c42" fontFamily="Nunito Variable, sans-serif">{globo}</text>
      </>)}
    </svg>
  );
}

function Impacto({ p }) {
  return (
    <g stroke="#ffd34d" strokeWidth="3" strokeLinecap="round">
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
        const [c, s] = dir(a);
        return <line key={a} x1={p[0] + c * 15} y1={p[1] + s * 15} x2={p[0] + c * (a % 90 ? 21 : 26)} y2={p[1] + s * (a % 90 ? 21 : 26)} />;
      })}
    </g>
  );
}

/* ---------------- cabello y vello (sobre la cabeza de siempre: centro 100,70, radio 44) ---------------- */
const CASCO = 'M56 70 Q55 24 100 24 Q145 24 144 70 Q138 50 122 47 Q112 58 98 49 Q86 57 72 49 Q60 55 56 70Z';

function PeloAtras({ estilo, color, ondea }) {
  if (estilo === 'largo') return <path d="M58 60 Q44 112 60 132 L80 124 Q66 100 72 64Z M142 60 Q156 112 140 132 L120 124 Q134 100 128 64Z" fill={tono(color, 0.85)} />;
  if (estilo === 'coleta') return (<>
    <path d={`M132 36 Q178 ${40 + ondea} ${170 + ondea} ${96 + ondea} Q160 60 128 52Z`} fill={tono(color, 0.9)} />
    <circle cx="136" cy="42" r="5" fill="#e23b3b" />
  </>);
  if (estilo === 'chongo') return <circle cx="100" cy="24" r="17" fill={tono(color, 0.92)} />;
  return null;
}

function Pelo({ estilo, color }) {
  switch (estilo) {
    case 'rapado':
      return <path d="M57 62 Q60 27 100 26 Q140 27 143 62 Q132 44 100 42 Q68 44 57 62Z" fill={color} opacity=".6" />;
    case 'despeinado':
      return (<>
        <path d="M60 52 L54 24 L74 36 L80 12 L94 30 L104 8 L112 30 L126 14 L127 36 L148 26 L140 54Z" fill={color} />
        <path d={CASCO} fill={color} />
      </>);
    case 'rizado':
      return (<>
        <path d={CASCO} fill={color} />
        {[[60, 50], [66, 36], [78, 27], [92, 22], [108, 22], [122, 27], [134, 36], [140, 50]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="11" fill={i % 2 ? color : tono(color, 1.12)} />)}
      </>);
    case 'largo':
      return <path d="M56 74 Q53 24 100 24 Q147 24 144 74 Q140 52 126 46 Q114 60 100 50 Q84 62 70 48 Q60 56 56 74Z" fill={color} />;
    default: // corto (el de siempre), coleta y chongo
      return <path d={CASCO} fill={color} />;
  }
}

function Vello({ tipo, color }) {
  const bigote = <path d="M86 93 Q100 85 114 93 Q107 91 100 93 Q93 91 86 93Z" fill={color} stroke={color} strokeWidth="2.5" strokeLinejoin="round" />;
  if (tipo === 'bigote') return bigote;
  if (tipo === 'candado') return (<>{bigote}<path d="M91 108 Q100 120 109 108 Q100 112 91 108Z" fill={color} stroke={color} strokeWidth="2" /></>);
  if (tipo === 'barba') return (<>
    <path d="M58 82 Q62 118 100 116 Q138 118 142 82 Q134 104 114 104 Q100 98 86 104 Q66 104 58 82Z" fill={color} />
    {bigote}
  </>);
  return null;
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
