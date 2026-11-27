// Poses y movimientos del avatar (el dibujo de frente de siempre, con brazos y piernas que se mueven).
// Brazos y piernas: [ángulo, largo]. Ángulo en grados: 0 = derecha, 90 = abajo, 180 = izquierda, -90 = arriba.
//   bd / bi → brazo derecho / izquierdo (como se ve en pantalla); pd / pi → pierna derecha / izquierda
// Cuerpo: x, y (se mueve todo), giro (se inclina sobre el pie izquierdo), alto (baja el tronco y la cabeza),
//   cab (baja solo la cabeza), cabGiro; grito = cara de kiai; impacto = dónde sale el destello; ojos: 'cerrados'.
// Para agregar un movimiento: define sus poses y la lista de cuadros [pose, milisegundos].

const BASE = { x: 0, y: 0, giro: 0, alto: 0, cab: 0, cabGiro: 0, bd: [-45, 31], bi: [-135, 31], pd: [90, 28], pi: [90, 28] };
const GUARDIA = { bd: [200, 15], bi: [-20, 15] };
const p = (x) => ({ ...BASE, ...x });

export const POSES = {
  osu: p({}),
  guardia: p({ ...GUARDIA }),
  golpeDer: p({ x: 4, giro: 3, cabGiro: 4, bd: [-2, 56], bi: [-20, 15], grito: true, impacto: 'bd' }),
  golpeIzq: p({ x: -4, giro: -3, cabGiro: -4, bi: [182, 56], bd: [200, 15], grito: true, impacto: 'bi' }),
  patadaCarga: p({ x: -3, giro: -5, ...GUARDIA, pd: [15, 20] }),
  patada: p({ x: -10, y: -4, giro: -13, cabGiro: 6, bd: [200, 15], bi: [-150, 26], pd: [-12, 54], grito: true, impacto: 'pd' }),
  frenteCarga: p({ x: -2, giro: -3, ...GUARDIA, pd: [30, 18] }),
  frente: p({ x: -6, giro: -6, ...GUARDIA, pd: [8, 48], grito: true, impacto: 'pd' }),
  firmes: p({ bd: [82, 27], bi: [98, 27] }),
  reverencia: p({ alto: 8, cab: 14, bd: [84, 25], bi: [96, 25], ojos: 'cerrados' }),
  agachado: p({ y: 8, alto: 4, bd: [112, 16], bi: [-20, 15] }),
  uppercut: p({ y: -8, giro: 2, bd: [-58, 52], bi: [-20, 15], grito: true, impacto: 'bd' }),
  victoria: p({ y: -16, bd: [-52, 37], bi: [-128, 37], grito: true }),
  derribo: p({ y: 12, alto: 8, cab: 3, bd: [22, 42], bi: [158, 42], pd: [62, 30], pi: [118, 30], grito: true }),
};

const SALUDO = (ultima) => [['firmes', 240], ['reverencia', 360], ['reverencia', 420], ['firmes', 300], [ultima, 300]];

/** Disciplina → uniforme, grito y movimientos (los botones de Mi avatar) */
export const DISCIPLINAS = {
  Taekwondo: {
    uniforme: 'dobok', grito: '¡Kihap!',
    movimientos: [
      { id: 'jirugi', nombre: 'Jirugi', cuadros: [['guardia', 140], ['golpeDer', 110], ['golpeDer', 200], ['guardia', 180], ['osu', 260]] },
      { id: 'dollyo', nombre: 'Dollyo chagi', cuadros: [['patadaCarga', 170], ['patada', 120], ['patada', 260], ['patadaCarga', 150], ['osu', 300]] },
      { id: 'kyungrye', nombre: 'Kyungrye', texto: 'Kyungrye', cuadros: SALUDO('osu') },
    ],
  },
  Karate: {
    uniforme: 'gi', grito: '¡Kiai!',
    movimientos: [
      { id: 'oizuki', nombre: 'Oi-zuki', cuadros: [['guardia', 140], ['golpeIzq', 110], ['golpeIzq', 200], ['guardia', 180], ['osu', 260]] },
      { id: 'maegeri', nombre: 'Mae-geri', cuadros: [['frenteCarga', 160], ['frente', 110], ['frente', 240], ['frenteCarga', 140], ['osu', 280]] },
      { id: 'rei', nombre: 'Rei', texto: 'Osu', cuadros: SALUDO('osu') },
    ],
  },
  Box: {
    uniforme: 'box', grito: '¡Pum!',
    movimientos: [
      { id: 'jab', nombre: 'Jab', cuadros: [['guardia', 140], ['golpeIzq', 90], ['guardia', 120], ['golpeDer', 90], ['golpeDer', 120], ['guardia', 160], ['osu', 240]] },
      { id: 'uppercut', nombre: 'Uppercut', cuadros: [['agachado', 180], ['uppercut', 110], ['uppercut', 240], ['osu', 300]] },
      { id: 'victoria', nombre: 'Victoria', texto: '¡Sí!', cuadros: [['agachado', 160], ['victoria', 200], ['victoria', 500], ['osu', 300]] },
    ],
  },
  'Jiu-Jitsu': {
    uniforme: 'gi', grito: '¡Oss!',
    movimientos: [
      { id: 'derribo', nombre: 'Derribo', cuadros: [['derribo', 240], ['derribo', 320], ['osu', 320]] },
      { id: 'victoria', nombre: 'Victoria', texto: '¡Oss!', cuadros: [['agachado', 160], ['victoria', 200], ['victoria', 500], ['osu', 300]] },
      { id: 'saludo', nombre: 'Saludo', texto: 'Oss', cuadros: SALUDO('osu') },
    ],
  },
};
export const disciplinaDe = (nombre) => DISCIPLINAS[nombre] || DISCIPLINAS.Taekwondo;

/** Mezcla dos poses (k de 0 a 1) */
export function mezclar(a, b, k) {
  const m = (x, y) => x + (y - x) * k;
  const r = {};
  for (const c of Object.keys(BASE)) r[c] = Array.isArray(a[c]) ? [m(a[c][0], b[c][0]), m(a[c][1], b[c][1])] : m(a[c], b[c]);
  r.grito = k > 0.5 ? b.grito : a.grito;
  r.ojos = k > 0.5 ? b.ojos : a.ojos;
  r.impacto = k > 0.8 ? b.impacto : null;
  return r;
}

/** Rebote suave cuando está quieto (como antes) */
export function respirar(pose, seg) {
  const s = Math.sin(seg * 3.2);
  return { ...pose, y: pose.y + Math.abs(s) * -3, bd: [pose.bd[0] - s * 4, pose.bd[1]], bi: [pose.bi[0] + s * 4, pose.bi[1]] };
}
