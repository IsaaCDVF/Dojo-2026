import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { colorCinta } from './api';
import { ETAPAS, COMPLEXION, POSES, articulaciones, disciplinaDe, mezclar, respirar } from './avatar/esqueleto';
import { Fondo } from './avatar/fondos.jsx';

// Avatar del alumno dibujado en SVG por piezas sobre un esqueleto animado (src/avatar/esqueleto.js).
// - apariencia: {piel, peinado, color_pelo, vello, complexion, etapa (nino|joven|adulto), disciplina} → viene de la API
// - equipo: [{tipo, imagen}] accesorios puestos (banda-roja, dobok-negro, guantes-azules, protector-pie, fondo-…)
// - cinta: color del grado ("Amarilla avanzada"). No se elige: es la de su grado.
// - animado: respira; interactivo: al tocarlo hace el siguiente movimiento de su disciplina;
//   accion: {id, n} hace ese movimiento cada vez que cambia n; demostracion: los hace solo cada pocos segundos.
// Adrián puede cambiar los dibujos de cada pieza sin tocar el esqueleto.

export const PIELES = { 1: '#f3d4b6', 2: '#e3b18b', 3: '#c98e63', 4: '#a8714a', 5: '#7d4f32', 6: '#563421' };
export const PELOS = {
  negro: '#1b1716', castano_oscuro: '#3b2519', castano: '#6b432a', rubio: '#c9a25e',
  pelirrojo: '#a4471f', canoso: '#bdb9b3', azul: '#2f5fd0', rosa: '#cf5f9c',
};
const BANDAS = { 'banda-blanca': '#f1f1ec', 'banda-roja': '#d63434', 'banda-azul': '#2f6fe4', 'banda-negra': '#1b1f2a', 'banda-dorada': '#e8ac0c' };
const GUANTES = { 'guantes-rojos': '#d63434', 'guantes-azules': '#2f6fe4' };
const TELAS = {
  'dobok-blanco': { tela: '#f2f2ee', cuello: '#f2f2ee' },
  'dobok-cuello': { tela: '#f2f2ee', cuello: '#16181f' },
  'dobok-negro': { tela: '#23283a', cuello: '#0f121b' },
};
const ESCALA = 1.1; // el cuerpo se dibuja un poco más grande que el lienzo base (crece desde el suelo)
const BASE = { piel: '2', peinado: 'corto', color_pelo: 'negro', vello: 'ninguno', complexion: 'media', etapa: 'adulto', disciplina: 'Taekwondo' };

/** Oscurece (f < 1) o aclara (f > 1) un color #rrggbb */
export function tono(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(f > 1 ? v + (255 - v) * (f - 1) : v * f))));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}
const linea = (a, b, w, color, extra) => <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={color} strokeWidth={w} strokeLinecap="round" {...extra} />;
const pts = (...p) => p.map((x) => `${x[0].toFixed(1)},${x[1].toFixed(1)}`).join(' ');
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

  // Pose de este momento
  const s = st.current; const ahora = performance.now();
  let pose = POSES[base]; let enMovimiento = false; let k = 0; let restante = ahora - s.inicio;
  let anterior = s.desde;
  for (const c of s.cuadros) {
    if (restante < c.ms) { k = restante / c.ms; k = 1 - (1 - k) ** 3; pose = mezclar(anterior, c.pose, k); enMovimiento = true; break; }
    restante -= c.ms; anterior = c.pose;
  }
  if (!enMovimiento) { if (s.cuadros.length) s.cuadros = []; pose = { ...POSES[base] }; }
  if (vivo && !reducido && !enMovimiento) pose = respirar(pose, ahora / 1000, disciplina.uniforme === 'box');
  s.ultimo = pose;
  const tocar = interactivo ? () => {
    s.siguiente = (s.siguiente + 1) % disciplina.movimientos.length;
    jugar(disciplina.movimientos[s.siguiente === 0 ? disciplina.movimientos.length - 1 : s.siguiente - 1]);
  } : undefined;
  return { pose, enMovimiento, texto: enMovimiento ? (s.texto || (pose.grito ? disciplina.grito : null)) : null, tocar, ahora };
}

/* ---------------- dibujo ---------------- */
export default function Avatar({
  equipo = [], cinta, apariencia, className = 'size-40', fondo = true, animado = false, interactivo = false,
  accion, demostracion = false, saludo, mirar = 'derecha', encuadre = 'cuerpo', pose: poseFija,
}) {
  const id = useId().replace(/:/g, '');
  const ap = { ...BASE, ...(apariencia || {}) };
  const disc = disciplinaDe(ap.disciplina);
  const d0 = ETAPAS[ap.etapa] || ETAPAS.adulto;
  const comp = COMPLEXION[ap.complexion] || 1;
  const d = { ...d0, ancho: d0.ancho * comp, grosor: d0.grosor * (0.85 + comp * 0.15) };
  const { pose, texto, tocar, ahora } = useMovimientos({ base: poseFija || disc.base, disciplina: disc, animado, interactivo, accion, demostracion });
  const j = articulaciones(pose, d);
  const pieza = (tipo) => equipo.find((e) => e.tipo === tipo)?.imagen;

  const piel = PIELES[ap.piel] || PIELES[2];
  const pielSombra = tono(piel, 0.86);
  const pelo = PELOS[ap.color_pelo] || PELOS.negro;
  const uniforme = disc.uniforme;
  const tela = TELAS[pieza('torso')] || TELAS['dobok-blanco'];
  const boxeo = uniforme === 'box';
  const telaLejos = tono(tela.tela, 0.82);
  const cintaColor = colorCinta(cinta || 'blanca');
  const avanzada = (cinta || '').toLowerCase().includes('avanzada');
  const guante = boxeo ? (GUANTES[pieza('mano')] || '#c9272d') : GUANTES[pieza('mano')];
  const protector = pieza('pies') === 'protector-pie';
  const banda = BANDAS[pieza('cabeza')];
  const g = d.grosor;
  const ondea = Math.sin(ahora / 260) * 2.2;

  const short = boxeo ? (pieza('torso') === 'dobok-negro' ? '#1d2130' : '#b8262c') : null;
  const camiseta = boxeo ? (pieza('torso') === 'dobok-negro' ? '#1d2130' : '#f2f2ee') : null;

  // --- extremidades
  const pierna = (p, lejos) => {
    const pant = boxeo ? short : (lejos ? telaLejos : tela.tela);
    const p1 = j.cadera; const p2 = p.rodilla; const p3 = p.tobillo;
    const ancho = 14.5 * g * (0.9 + comp * 0.1);
    const pieDir = [Math.sin(((p.angulo + 90) * Math.PI) / 180), Math.cos(((p.angulo + 90) * Math.PI) / 180)];
    const punta = mas(p3, pieDir, d.pie);
    const colorPie = boxeo ? (lejos ? '#14161d' : '#22252e') : protector ? (lejos ? '#a3262c' : '#c62f36') : (lejos ? pielSombra : piel);
    return (
      <g>
        {boxeo ? (<>
          {linea(p2, p3, ancho * 0.72, lejos ? pielSombra : piel)}
          {linea(p1, mas(p1, [p2[0] - p1[0], p2[1] - p1[1]], 0.85), ancho * 1.12, pant)}
        </>) : (<>
          {linea(p1, p2, ancho, pant)}
          {linea(p2, mas(p2, [p3[0] - p2[0], p3[1] - p2[1]], 0.86), ancho * 0.9, pant)}
          {linea(mas(p2, [p3[0] - p2[0], p3[1] - p2[1]], 0.8), p3, ancho * 0.5, lejos ? pielSombra : piel)}
        </>)}
        {linea(p3, punta, 7 * g, colorPie)}
        {protector && !boxeo && linea(mas(p3, pieDir, d.pie * 0.25), mas(p3, pieDir, d.pie * 0.7), 2 * g, '#ffffff', { opacity: 0.7 })}
      </g>
    );
  };
  const brazo = (b, lejos) => {
    const manga = boxeo ? null : (lejos ? telaLejos : tela.tela);
    const ancho = 11 * g * (0.9 + comp * 0.1);
    const color = lejos ? pielSombra : piel;
    const hasta = uniforme === 'gi' && !guante ? 0.72 : 0.92;
    const radioMano = guante ? (boxeo ? 8.3 : 6.4) * g : 4.6 * g;
    return (
      <g>
        {boxeo ? (<>{linea(j.hombro, b.codo, ancho * 0.92, color)}{linea(b.codo, b.mano, ancho * 0.8, color)}</>) : (<>
          {linea(j.hombro, b.codo, ancho, manga)}
          {linea(b.codo, b.mano, ancho * 0.62, color)}
          {linea(b.codo, mas(b.codo, [b.mano[0] - b.codo[0], b.mano[1] - b.codo[1]], hasta), ancho * 0.92, manga)}
        </>)}
        {guante ? (<>
          <circle cx={b.mano[0]} cy={b.mano[1]} r={radioMano} fill={lejos ? tono(guante, 0.8) : guante} />
          <circle cx={b.mano[0] + radioMano * 0.25} cy={b.mano[1] - radioMano * 0.3} r={radioMano * 0.35} fill="#fff" opacity=".18" />
          {linea(mas(b.mano, [b.codo[0] - b.mano[0], b.codo[1] - b.mano[1]], 0.3), mas(b.mano, [b.codo[0] - b.mano[0], b.codo[1] - b.mano[1]], 0.36), ancho * 0.95, '#f2f2ee')}
        </>) : <circle cx={b.mano[0]} cy={b.mano[1]} r={radioMano} fill={color} />}
      </g>
    );
  };

  // --- tronco
  const { cadera: H, hombro: S, cuello: N, arriba: u, frente: f } = j;
  const W = d.ancho;
  const chaqueta = [
    mas(mas(H, u, -8 * g), f, 0.46 * W), mas(mas(H, u, d.tronco * 0.6), f, 0.52 * W), mas(mas(S, f, 0.36 * W), u, 3),
    mas(N, f, 0.12 * W), mas(N, f, -0.2 * W), mas(S, f, -0.46 * W), mas(H, f, -0.48 * W), mas(mas(H, u, -8 * g), f, -0.5 * W),
  ];
  const sombraEspalda = [mas(S, f, -0.46 * W), mas(H, f, -0.48 * W), mas(mas(H, u, -8 * g), f, -0.5 * W), mas(mas(H, u, -8 * g), f, -0.22 * W), mas(S, f, -0.2 * W)];
  const cinturaA = mas(mas(H, u, 2 * g), f, -0.5 * W); const cinturaB = mas(mas(H, u, 2 * g), f, 0.48 * W);
  const nudo = mas(mas(H, u, 2 * g), f, 0.42 * W);
  const colaCinta = (dx) => mas(mas(nudo, u, -13 * g), f, dx + ondea * 0.6);

  // --- cabeza (coordenadas locales: mirando a la derecha, centro 0,0)
  const r = d.cabeza;
  const adulto = ap.etapa !== 'nino';
  const kiai = !!pose.grito;
  const cabeza = (
    <g transform={`translate(${j.cabeza[0].toFixed(1)} ${j.cabeza[1].toFixed(1)}) rotate(${j.anguloCabeza.toFixed(1)})`}>
      <PeloAtras estilo={ap.peinado} r={r} color={pelo} ondea={ondea} />
      <ellipse cx="0" cy="0" rx={r * 0.95} ry={r * 1.02} fill={piel} />
      {adulto
        ? <path d={`M${-r * 0.4} ${r * 0.5} Q${r * 0.05} ${r * 1.12} ${r * 0.62} ${r * 1.02} Q${r * 0.95} ${r * 0.9} ${r * 0.96} ${r * 0.36} Z`} fill={piel} />
        : <path d={`M${-r * 0.3} ${r * 0.6} Q${r * 0.2} ${r * 1.08} ${r * 0.7} ${r * 0.86} Q${r * 0.95} ${r * 0.6} ${r * 0.9} ${r * 0.3} Z`} fill={piel} />}
      <ellipse cx={-r * 0.16} cy={r * 0.12} rx={r * 0.16} ry={r * 0.24} fill={pielSombra} />
      {/* ojos y cejas: mirada al frente, con decisión */}
      <ellipse cx={r * 0.43} cy={-r * 0.02} rx={r * 0.1} ry={kiai ? r * 0.09 : r * 0.13} fill="#1a1514" />
      <circle cx={r * 0.46} cy={-r * 0.07} r={r * 0.035} fill="#fff" opacity=".8" />
      <ellipse cx={r * 0.86} cy={-r * 0.03} rx={r * 0.06} ry={kiai ? r * 0.08 : r * 0.12} fill="#1a1514" />
      <path d={`M${r * 0.24} ${-r * 0.3} L${r * 0.6} ${kiai ? -r * 0.18 : -r * 0.22}`} stroke={tono(pelo, 0.75)} strokeWidth={r * 0.12} strokeLinecap="round" />
      <path d={`M${r * 0.78} ${kiai ? -r * 0.2 : -r * 0.24} L${r * 0.98} ${-r * 0.2}`} stroke={tono(pelo, 0.75)} strokeWidth={r * 0.1} strokeLinecap="round" />
      <path d={`M${r * 0.9} ${-r * 0.02} L${r * 1.07} ${r * 0.3} L${r * 0.9} ${r * 0.36}`} fill={piel} stroke={pielSombra} strokeWidth={r * 0.06} strokeLinejoin="round" />
      {kiai
        ? <ellipse cx={r * 0.72} cy={r * 0.64} rx={r * 0.15} ry={r * 0.13} fill="#3b1414" />
        : <path d={`M${r * 0.56} ${r * 0.62} L${r * 0.84} ${r * 0.6}`} stroke={tono(piel, 0.55)} strokeWidth={r * 0.07} strokeLinecap="round" />}
      {adulto && <Vello tipo={ap.vello} r={r} color={pelo} />}
      <PeloFrente estilo={ap.peinado} r={r} color={pelo} />
      {banda && (<>
        <path d={`M${-r * 0.96} ${-r * 0.34} Q0 ${-r * 0.56} ${r * 0.96} ${-r * 0.44}`} fill="none" stroke={banda} strokeWidth={r * 0.3} strokeLinecap="round" />
        <path d={`M${-r * 0.92} ${-r * 0.36} Q${-r * 1.5} ${-r * 0.3 + ondea} ${-r * 2.05} ${-r * 0.02 + ondea * 1.4}`} fill="none" stroke={banda} strokeWidth={r * 0.2} strokeLinecap="round" />
        <path d={`M${-r * 0.92} ${-r * 0.3} Q${-r * 1.35} ${r * 0.1 - ondea} ${-r * 1.8} ${r * 0.42 + ondea}`} fill="none" stroke={tono(banda, 0.85)} strokeWidth={r * 0.18} strokeLinecap="round" />
      </>)}
    </g>
  );

  // efecto de golpe
  const fin = pose.impacto === 'bf' ? j.bf.mano : pose.impacto === 'bn' ? j.bn.mano : pose.impacto === 'pn' ? mas(j.pn.tobillo, [0, 0], 0) : null;
  const espejo = mirar === 'izquierda';
  let vista = '0 0 200 200';
  if (encuadre === 'cabeza') {
    const t = r * 4.6 * ESCALA; const hx = 100 + (j.cabeza[0] - 100) * ESCALA; const hy = 186 + (j.cabeza[1] - 186) * ESCALA; const cx = espejo ? 200 - hx : hx;
    vista = `${(cx - t / 2).toFixed(1)} ${(hy - t / 2 + r * 0.3).toFixed(1)} ${t.toFixed(1)} ${t.toFixed(1)}`;
  }
  if (encuadre === 'figura') vista = '30 30 140 140';
  const globo = texto || saludo;
  const hxG = 100 + (j.cabeza[0] - 100) * ESCALA; const hyG = 186 + (j.cabeza[1] - 186) * ESCALA;
  const gx = Math.min(136, Math.max(4, espejo ? 200 - hxG - 40 : hxG - 6));

  return (
    <svg viewBox={vista} className={className} role="img" aria-label="Avatar" onClick={tocar}
      style={tocar ? { cursor: 'pointer', WebkitTapHighlightColor: 'transparent' } : undefined}>
      {fondo && <Fondo clave={pieza('fondo')} id={id} />}
      <g transform={`${espejo ? 'translate(200 0) scale(-1 1) ' : ''}translate(100 186) scale(${ESCALA}) translate(-100 -186)`}>
        <ellipse cx={H[0] + 4} cy="187.5" rx={30 * g} ry="4.5" fill="#000" opacity=".25" />
        {pierna(j.pf, true)}
        {brazo(j.bf, true)}
        {/* tronco */}
        {boxeo && <polygon points={pts(...chaqueta)} fill={piel} stroke={piel} strokeWidth="3" strokeLinejoin="round" />}
        {boxeo
          ? <polygon points={pts(chaqueta[0], chaqueta[1], mas(mas(S, f, 0.2 * W), u, -4), mas(S, f, -0.3 * W), chaqueta[6], chaqueta[7])} fill={camiseta} stroke={camiseta} strokeWidth="3" strokeLinejoin="round" />
          : <polygon points={pts(...chaqueta)} fill={tela.tela} stroke={tela.tela} strokeWidth="3" strokeLinejoin="round" />}
        {!boxeo && <polygon points={pts(...sombraEspalda)} fill="#000" opacity=".1" />}
        {uniforme === 'dobok' && <polyline points={pts(mas(N, f, -0.2 * W), mas(N, f, 0.12 * W), mas(mas(H, u, d.tronco * 0.5), f, 0.4 * W))} fill="none" stroke={tela.cuello === tela.tela ? tono(tela.tela, 0.82) : tela.cuello} strokeWidth={3.4 * g} strokeLinejoin="round" strokeLinecap="round" />}
        {uniforme === 'gi' && (<>
          <polyline points={pts(mas(N, f, -0.18 * W), mas(N, f, 0.14 * W), mas(mas(H, u, d.tronco * 0.25), f, 0.46 * W))} fill="none" stroke={tono(tela.tela, 0.8)} strokeWidth={4.6 * g} strokeLinejoin="round" strokeLinecap="round" />
          <polyline points={pts(mas(mas(N, u, -3), f, 0.1 * W), mas(mas(H, u, d.tronco * 0.45), f, 0.5 * W))} fill="none" stroke={tono(tela.tela, 0.9)} strokeWidth={2 * g} strokeLinecap="round" />
        </>)}
        {pierna(j.pn, false)}
        {!boxeo && (<>
          {linea(cinturaA, cinturaB, 6.4 * g, cintaColor, { strokeLinecap: 'butt' })}
          {avanzada && linea(cinturaA, cinturaB, 1.6 * g, '#000', { opacity: 0.35, strokeLinecap: 'butt' })}
          {linea(nudo, colaCinta(4), 4.6 * g, cintaColor)}
          {linea(nudo, colaCinta(-2), 4.6 * g, tono(cintaColor, 0.88))}
          <circle cx={nudo[0]} cy={nudo[1]} r={4 * g} fill={cintaColor} stroke="#00000030" strokeWidth=".8" />
        </>)}
        {boxeo && linea(mas(H, f, -0.5 * W), mas(H, f, 0.48 * W), 5 * g, tono(short, 1.25), { strokeLinecap: 'butt' })}
        {linea(mas(N, u, -2), mas(N, u, 4), 8 * g, pielSombra)}
        {cabeza}
        {brazo(j.bn, false)}
        {fin && <Impacto p={fin} />}
      </g>
      {globo && (
        <g className="anim-aparecer">
          <rect x={gx} y={Math.max(4, hyG - r * ESCALA - 36)} width="60" height="22" rx="11" fill="#fff" />
          <text x={gx + 30} y={Math.max(4, hyG - r * ESCALA - 36) + 15.5} textAnchor="middle" fontSize="11.5" fontWeight="900" fill="#011c42" fontFamily="Nunito Variable, sans-serif">{globo}</text>
        </g>
      )}
    </svg>
  );
}

function Impacto({ p }) {
  return (
    <g stroke="#ffd34d" strokeWidth="2.2" strokeLinecap="round" opacity=".95">
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
        const c = Math.cos((a * Math.PI) / 180); const s = Math.sin((a * Math.PI) / 180);
        return <line key={a} x1={p[0] + c * 9} y1={p[1] + s * 9} x2={p[0] + c * (a % 90 ? 13 : 17)} y2={p[1] + s * (a % 90 ? 13 : 17)} />;
      })}
    </g>
  );
}

/* ---------------- cabello y vello (locales a la cabeza, mirando a la derecha) ---------------- */
function PeloAtras({ estilo, r, color, ondea }) {
  if (estilo === 'largo') return <path d={`M${-r * 0.85} ${-r * 0.7} Q${-r * 1.35} ${r * 0.5} ${-r * 1.05 + ondea * 0.3} ${r * 1.75} L${-r * 0.1} ${r * 1.5} Q${-r * 0.45} ${r * 0.6} ${-r * 0.2} ${-r * 0.2} Z`} fill={tono(color, 0.85)} />;
  if (estilo === 'coleta') return (<>
    <path d={`M${-r * 0.78} ${-r * 0.62} Q${-r * 1.9} ${-r * 0.5 + ondea} ${-r * 1.6 + ondea * 0.4} ${r * 0.95} Q${-r * 1.38} ${r * 0.2} ${-r * 0.7} ${-r * 0.18} Z`} fill={tono(color, 0.88)} />
    <circle cx={-r * 0.9} cy={-r * 0.48} r={r * 0.13} fill="#c62f36" />
  </>);
  if (estilo === 'chongo') return <circle cx={-r * 0.62} cy={-r * 0.92} r={r * 0.4} fill={tono(color, 0.9)} />;
  return null;
}

function PeloFrente({ estilo, r, color }) {
  const brillo = tono(color, 1.25);
  const casco = `M${-r * 1.0} ${r * 0.25} C${-r * 1.16} ${-r * 1.0} ${r * 0.1} ${-r * 1.38} ${r * 0.78} ${-r * 0.92} C${r * 1.02} ${-r * 0.74} ${r * 1.02} ${-r * 0.48} ${r * 0.96} ${-r * 0.4} C${r * 0.6} ${-r * 0.54} ${r * 0.2} ${-r * 0.56} ${-r * 0.04} ${-r * 0.44} C${-r * 0.24} ${-r * 0.22} ${-r * 0.36} ${r * 0.04} ${-r * 0.42} ${r * 0.3} Z`;
  switch (estilo) {
    case 'rapado':
      return <path d={`M${-r * 0.96} ${r * 0.15} C${-r * 1.02} ${-r * 0.92} ${r * 0.2} ${-r * 1.26} ${r * 0.84} ${-r * 0.62} L${r * 0.6} ${-r * 0.5} C${r * 0.1} ${-r * 0.72} ${-r * 0.42} ${-r * 0.56} ${-r * 0.46} ${r * 0.12} Z`} fill={color} opacity=".55" />;
    case 'despeinado':
      return (<>
        <path d={casco} fill={color} />
        <path d={`M${-r * 0.95} ${-r * 0.3} L${-r * 1.25} ${-r * 0.75} L${-r * 0.78} ${-r * 0.72} L${-r * 0.85} ${-r * 1.2} L${-r * 0.35} ${-r * 0.98} L${-r * 0.2} ${-r * 1.45} L${r * 0.18} ${-r * 1.08} L${r * 0.52} ${-r * 1.38} L${r * 0.6} ${-r * 0.98} L${r * 1.12} ${-r * 0.98} L${r * 0.85} ${-r * 0.7} Z`} fill={color} />
        <path d={`M${-r * 0.2} ${-r * 1.0} L${r * 0.3} ${-r * 0.9}`} stroke={brillo} strokeWidth={r * 0.08} strokeLinecap="round" />
      </>);
    case 'rizado':
      return (<>
        <path d={casco} fill={color} />
        {[[-0.95, -0.15], [-0.98, -0.55], [-0.72, -0.9], [-0.32, -1.12], [0.12, -1.18], [0.52, -1.02], [0.82, -0.72], [-0.5, 0.15]].map(([x, y], i) => (
          <circle key={i} cx={r * x} cy={r * y} r={r * 0.3} fill={i % 2 ? color : tono(color, 1.1)} />
        ))}
      </>);
    case 'largo':
      return (<>
        <path d={casco} fill={color} />
        <path d={`M${r * 0.2} ${-r * 1.02} Q${r * 0.95} ${-r * 0.95} ${r * 0.92} ${-r * 0.2} Q${r * 0.6} ${-r * 0.55} ${r * 0.05} ${-r * 0.5} Z`} fill={color} />
        <path d={`M${-r * 0.3} ${-r * 1.0} Q${r * 0.2} ${-r * 1.12} ${r * 0.55} ${-r * 0.9}`} fill="none" stroke={brillo} strokeWidth={r * 0.08} strokeLinecap="round" />
      </>);
    default: // corto, coleta y chongo comparten el casco
      return (<>
        <path d={casco} fill={color} />
        <path d={`M${-r * 0.35} ${-r * 1.0} Q${r * 0.15} ${-r * 1.15} ${r * 0.55} ${-r * 0.9}`} fill="none" stroke={brillo} strokeWidth={r * 0.08} strokeLinecap="round" />
      </>);
  }
}

function Vello({ tipo, r, color }) {
  const bigote = <path d={`M${r * 0.5} ${r * 0.5} Q${r * 0.72} ${r * 0.4} ${r * 0.98} ${r * 0.48} L${r * 0.96} ${r * 0.56} Q${r * 0.72} ${r * 0.5} ${r * 0.52} ${r * 0.6} Z`} fill={color} />;
  if (tipo === 'bigote') return bigote;
  if (tipo === 'candado') return (<>{bigote}<path d={`M${r * 0.48} ${r * 0.72} Q${r * 0.7} ${r * 1.12} ${r * 0.9} ${r * 0.72} Q${r * 0.7} ${r * 0.82} ${r * 0.48} ${r * 0.72} Z`} fill={color} /></>);
  if (tipo === 'barba') return (<>
    <path d={`M${-r * 0.08} ${r * 0.1} L${-r * 0.42} ${r * 0.5} Q${r * 0.05} ${r * 1.2} ${r * 0.64} ${r * 1.08} Q${r * 1.0} ${r * 0.92} ${r * 0.98} ${r * 0.58} L${r * 0.84} ${r * 0.7} Q${r * 0.66} ${r * 0.8} ${r * 0.5} ${r * 0.7} Q${r * 0.2} ${r * 0.62} ${r * 0.08} ${r * 0.18} Z`} fill={color} opacity=".95" />
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
