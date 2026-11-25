// Esqueleto del avatar: proporciones por edad, poses y movimientos de cada disciplina.
// El avatar se ve de perfil (3/4) mirando a la derecha. Cada pose son ángulos en grados, absolutos:
//   extremidades → 0 = hacia abajo, 90 = al frente, 180 = arriba, -90 = atrás
//   tronco (t)   → 0 = derecho, positivo = inclinado al frente;  cabeza (c) = giro extra sobre el tronco
//   bn / bf      → brazo cercano / lejano: [brazo, antebrazo]
//   pn / pf      → pierna cercana (la de adelante) / lejana: [muslo, pierna]
// Para agregar un movimiento basta con definir sus poses y la lista de cuadros [pose, milisegundos].

export const SUELO = 186;

export const ETAPAS = {
  adulto: { cabeza: 11.5, cuello: 4, tronco: 45, brazo: 27, antebrazo: 25, muslo: 37, pierna: 37, ancho: 27, grosor: 1, pie: 13 },
  joven: { cabeza: 12.3, cuello: 3.5, tronco: 41, brazo: 25, antebrazo: 23, muslo: 34, pierna: 34, ancho: 24.5, grosor: 0.93, pie: 12 },
  nino: { cabeza: 14, cuello: 3, tronco: 33, brazo: 20, antebrazo: 19, muslo: 26, pierna: 27, ancho: 22, grosor: 0.86, pie: 10.5 },
};
export const COMPLEXION = { delgada: 0.86, media: 1, robusta: 1.2 };

export const POSES = {
  guardia: { t: 5, c: -3, bn: [38, 158], bf: [12, 170], pn: [26, 4], pf: [-12, -32] },
  guardiaBox: { t: 11, c: 6, bn: [44, 166], bf: [24, 174], pn: [24, 0], pf: [-10, -30] },
  guardiaBjj: { t: 20, c: -10, bn: [58, 118], bf: [42, 112], pn: [34, -4], pf: [-14, -40] },
  firmes: { t: 0, c: 0, bn: [5, 2], bf: [-5, -3], pn: [4, 0], pf: [-4, 0] },
  reverencia: { t: 34, c: 10, bn: [12, 6], bf: [6, 2], pn: [4, 0], pf: [-4, 0] },
  // Taekwondo
  jirugi: { t: 13, c: -8, bn: [18, 166], bf: [88, 90], pn: [32, 6], pf: [-30, -34], grito: true, impacto: 'bf' },
  dollyoCarga: { t: -10, c: 6, bn: [46, 150], bf: [8, 166], pn: [96, -28], pf: [-4, -4] },
  dollyo: { t: -30, c: 22, bn: [62, 140], bf: [-28, 30], pn: [114, 106], pf: [-8, -6], grito: true, impacto: 'pn' },
  // Karate
  oizuki: { t: 7, c: -6, bn: [88, 90], bf: [-38, 84], pn: [42, 4], pf: [-44, -40], grito: true, impacto: 'bn' },
  maegeriCarga: { t: -4, c: 2, bn: [40, 156], bf: [-30, 84], pn: [94, -24], pf: [-4, -4] },
  maegeri: { t: -14, c: 12, bn: [40, 156], bf: [-32, 84], pn: [90, 86], pf: [-6, -4], grito: true, impacto: 'pn' },
  // Box
  jab: { t: 15, c: 4, bn: [87, 89], bf: [24, 174], pn: [24, 0], pf: [-16, -34], grito: true, impacto: 'bn' },
  uppercutCarga: { t: 20, c: 6, bn: [44, 166], bf: [10, 120], pn: [30, -6], pf: [-12, -34] },
  uppercut: { t: 4, c: -10, bn: [44, 166], bf: [58, 172], pn: [20, 2], pf: [-12, -26], grito: true, impacto: 'bf' },
  // Jiu-Jitsu
  derribo: { t: 62, c: -40, bn: [82, 72], bf: [72, 62], pn: [78, -8], pf: [-56, -72], grito: true },
  // Todas
  victoria: { t: -4, c: -14, bn: [162, 176], bf: [16, 166], pn: [16, 4], pf: [-8, -22], grito: true },
};

/** Disciplina → uniforme, pose base, grito y movimientos (los botones de Mi avatar) */
export const DISCIPLINAS = {
  Taekwondo: {
    uniforme: 'dobok', base: 'guardia', grito: '¡Kihap!',
    movimientos: [
      { id: 'jirugi', nombre: 'Jirugi', cuadros: [['jirugi', 120], ['jirugi', 180], ['guardia', 260]] },
      { id: 'dollyo', nombre: 'Dollyo chagi', cuadros: [['dollyoCarga', 170], ['dollyo', 120], ['dollyo', 260], ['dollyoCarga', 150], ['guardia', 280]] },
      { id: 'kyungrye', nombre: 'Kyungrye', texto: 'Kyungrye', cuadros: [['firmes', 260], ['reverencia', 380], ['reverencia', 420], ['firmes', 320], ['guardia', 320]] },
    ],
  },
  Karate: {
    uniforme: 'gi', base: 'guardia', grito: '¡Kiai!',
    movimientos: [
      { id: 'oizuki', nombre: 'Oi-zuki', cuadros: [['oizuki', 140], ['oizuki', 220], ['guardia', 280]] },
      { id: 'maegeri', nombre: 'Mae-geri', cuadros: [['maegeriCarga', 160], ['maegeri', 110], ['maegeri', 240], ['maegeriCarga', 140], ['guardia', 260]] },
      { id: 'rei', nombre: 'Rei', texto: 'Osu', cuadros: [['firmes', 260], ['reverencia', 380], ['reverencia', 420], ['firmes', 320], ['guardia', 320]] },
    ],
  },
  Box: {
    uniforme: 'box', base: 'guardiaBox', grito: '¡Pum!',
    movimientos: [
      { id: 'jab', nombre: 'Jab', cuadros: [['jab', 90], ['jab', 120], ['guardiaBox', 160], ['jab', 90], ['jab', 120], ['guardiaBox', 220]] },
      { id: 'uppercut', nombre: 'Uppercut', cuadros: [['uppercutCarga', 160], ['uppercut', 120], ['uppercut', 220], ['guardiaBox', 280]] },
      { id: 'victoria', nombre: 'Victoria', texto: '¡Sí!', cuadros: [['victoria', 260], ['victoria', 700], ['guardiaBox', 320]] },
    ],
  },
  'Jiu-Jitsu': {
    uniforme: 'gi', base: 'guardiaBjj', grito: '¡Oss!',
    movimientos: [
      { id: 'derribo', nombre: 'Derribo', cuadros: [['derribo', 240], ['derribo', 300], ['guardiaBjj', 320]] },
      { id: 'victoria', nombre: 'Victoria', texto: '¡Oss!', cuadros: [['victoria', 260], ['victoria', 700], ['guardiaBjj', 320]] },
      { id: 'saludo', nombre: 'Saludo', texto: 'Oss', cuadros: [['firmes', 260], ['reverencia', 380], ['reverencia', 420], ['firmes', 320], ['guardiaBjj', 320]] },
    ],
  },
};
export const disciplinaDe = (nombre) => DISCIPLINAS[nombre] || DISCIPLINAS.Taekwondo;

const rad = (g) => (g * Math.PI) / 180;
const abajo = (a, l) => [Math.sin(rad(a)) * l, Math.cos(rad(a)) * l];
const suma = (p, v, k = 1) => [p[0] + v[0] * k, p[1] + v[1] * k];

/** Mezcla dos poses (k de 0 a 1) */
export function mezclar(a, b, k) {
  const m = (x, y) => x + (y - x) * k;
  const par = (x, y) => [m(x[0], y[0]), m(x[1], y[1])];
  return { t: m(a.t, b.t), c: m(a.c, b.c), bn: par(a.bn, b.bn), bf: par(a.bf, b.bf), pn: par(a.pn, b.pn), pf: par(a.pf, b.pf),
    grito: k > 0.5 ? b.grito : a.grito, impacto: k > 0.8 ? b.impacto : null };
}

/** Respiración y rebote cuando está quieto */
export function respirar(p, seg, box) {
  const w = seg * (box ? 7 : 2.4); const s = Math.sin(w); const a = box ? 2.4 : 1;
  return { ...p, t: p.t + s * 1.4 * a, c: p.c - s * 0.8, bn: [p.bn[0] + s * 2.5 * a, p.bn[1] - s * 2 * a], bf: [p.bf[0] - s * 2 * a, p.bf[1] + s * 1.5 * a],
    pn: [p.pn[0] + s * 1.6 * a, p.pn[1] - s * 1.8 * a], pf: [p.pf[0] - s * 1.6 * a, p.pf[1] + s * 1.2 * a] };
}

/** Posición de cada articulación. La cadera baja o sube para que el pie más bajo quede en el suelo. */
export function articulaciones(pose, d, x = 94) {
  const rodN = abajo(pose.pn[0], d.muslo); const tobN = suma(rodN, abajo(pose.pn[1], d.pierna));
  const rodF = abajo(pose.pf[0], d.muslo); const tobF = suma(rodF, abajo(pose.pf[1], d.pierna));
  const y = SUELO - Math.max(tobN[1], tobF[1]) - 3.5 * d.grosor;
  const cadera = [x, y];
  const arriba = [Math.sin(rad(pose.t)), -Math.cos(rad(pose.t))];
  const frente = [Math.cos(rad(pose.t)), Math.sin(rad(pose.t))];
  const cuello = suma(cadera, arriba, d.tronco);
  const hombro = suma(cadera, arriba, d.tronco * 0.86);
  const ac = rad(pose.t + pose.c);
  const cabeza = suma(cuello, [Math.sin(ac), -Math.cos(ac)], d.cuello + d.cabeza * 0.92);
  const brazo = ([u, f]) => { const codo = suma(hombro, abajo(u, d.brazo)); return { codo, mano: suma(codo, abajo(f, d.antebrazo)) }; };
  return {
    cadera, cuello, hombro, cabeza, arriba, frente, anguloCabeza: pose.t + pose.c,
    bn: brazo(pose.bn), bf: brazo(pose.bf),
    pn: { rodilla: suma(cadera, rodN), tobillo: suma(cadera, tobN), angulo: pose.pn[1] },
    pf: { rodilla: suma(cadera, rodF), tobillo: suma(cadera, tobF), angulo: pose.pf[1] },
  };
}
