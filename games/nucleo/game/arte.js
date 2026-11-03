// Arte procedural de las ciudades nuevas (pixel art 16×16 por casilla, contorno oscuro y 2–3 tonos como el resto del juego).
// Sin DOM: todo se dibuja con R(color, x, y, w, h), así se puede probar en node y reutilizar en el mapa. Las paletas cambian por ciudad.
const OUT = '#2a1f1d';
const px = x => [1, 3, 5].map(i => parseInt(x.slice(i, i + 2), 16));
export const mix = (a, b, t) => { const A = px(a), B = px(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
const hz = (...n) => { let h = 2166136261; for (const v of n) { h = Math.imul(h ^ (v | 0), 16777619); h ^= h >>> 13; } return (h >>> 0) / 4294967296; };
const pick = (a, h) => a[Math.floor(h * a.length) % a.length];

// Paletas por ciudad: suelo, agua, calle y colores de edificios (muros, techos, acentos).
export const PALETAS = {
  dorada: { pasto: ['#4f8a3a', '#5f9c47', '#3f7430'], arena: ['#e6d3a0', '#d9c48a', '#f1e3b8'], tierra: ['#9a7b55', '#85694a', '#b08d63'], agua: ['#3b7fb8', '#5a9bd0', '#2c6699', '#cfeaf7'], acera: ['#b9a58a', '#a08a6e'], plaza: ['#d6c8ae', '#bfae92'], adoquin: ['#9a8d7d', '#7d7266'], asfalto: ['#3d3f46', '#34363d'], copa: ['#356b27', '#4f8a3a', '#6cae4f'],
    muros: ['#e8dcb8', '#f0e4c8', '#d9c9a0', '#f2d7b0', '#cfd8c4'], techos: ['#b8553f', '#a64a38', '#c46a45', '#8f4a3a'], acentos: ['#2f6b5f', '#b8402f', '#3a6aa0', '#d9822b'] },
  azul: { pasto: ['#5b9a4a', '#6cae58', '#4a8340'], arena: ['#f0e0b0', '#e3cf98', '#f8ecc8'], tierra: ['#a8875e', '#92734f', '#bd9a70'], agua: ['#2e9fd0', '#52bce6', '#1f7fae', '#e4f8ff'], acera: ['#d8d2c2', '#bdb6a4'], plaza: ['#e6ddc8', '#cfc5ac'], adoquin: ['#aaa296', '#8c857a'], asfalto: ['#44484f', '#3a3e45'], copa: ['#2f7a48', '#47a05d', '#74c57c'],
    muros: ['#f4f1e8', '#e4f0f4', '#fbe6c8', '#f7d4d0', '#d6ecf0'], techos: ['#3a78b8', '#c4543f', '#2f9a9a', '#e0a040'], acentos: ['#e07a3a', '#2f9a9a', '#d94a6a', '#3a78b8'] },
  verde: { pasto: ['#3f9a3f', '#55b04c', '#2f8034'], arena: ['#d8cf98', '#c7bd84', '#e8dfb0'], tierra: ['#8a7550', '#756243', '#a08a63'], agua: ['#3f9ab8', '#62b8d0', '#2e809a', '#d4f2f2'], acera: ['#bdb59a', '#a39a80'], plaza: ['#d0cfa8', '#b9b790'], adoquin: ['#968f78', '#7a745f'], asfalto: ['#40454a', '#363b40'], copa: ['#2a7a2f', '#3f9a3f', '#6cc060'],
    muros: ['#f0ecd0', '#e0ecc8', '#f4dcc0', '#d8e8d8', '#f6e4d0'], techos: ['#7a4a3a', '#a65a40', '#4a7a5a', '#8a5a48'], acentos: ['#4a8a4a', '#d9822b', '#7a5aa0', '#b8402f'] },
  colonial: { pasto: ['#9aa050', '#a9ae5c', '#868c42'], arena: ['#e8cf98', '#d9bd80', '#f4dfb0'], tierra: ['#b8865a', '#a0724a', '#cc9a6c'], agua: ['#4a98b0', '#6ab4c8', '#3a8098', '#d8f0f4'], acera: ['#d6b890', '#bf9e76'], plaza: ['#e6cfa6', '#cdb48a'], adoquin: ['#b08a68', '#8f6e50'], asfalto: ['#5a4a44', '#4d3f3a'], copa: ['#5a7a2f', '#7a9a3f', '#9ab85a'],
    muros: ['#f2d8a8', '#e8b890', '#f4e4c0', '#e0a070', '#f0c8a0'], techos: ['#b84a34', '#c8603c', '#a03a2c', '#d07848'], acentos: ['#2f7a8a', '#b8402f', '#d9a02b', '#3a5a9a'] },
  roca: { pasto: ['#5f7f4a', '#6f8f58', '#4d6a3c'], arena: ['#b8ad98', '#a39984', '#cdc4b0'], tierra: ['#7a6a58', '#665848', '#8f7e68'], agua: ['#4a7fa0', '#6a9ab8', '#3a6a88', '#d0e4ee'], acera: ['#9a9a98', '#80807e'], plaza: ['#b8b8b2', '#9e9e98'], adoquin: ['#8a8a86', '#6e6e6a'], asfalto: ['#44464a', '#3a3c40'], copa: ['#2f5a3a', '#3f7a4a', '#5a9a62'],
    muros: ['#b8b2a8', '#c8c0b0', '#a0a8b0', '#d0c4a8', '#9a948a'], techos: ['#5a5f6a', '#6a5a52', '#4a4f5a', '#7a6a5a'], acentos: ['#d9822b', '#b8402f', '#4a8aa0', '#e0c040'] },
  metro: { pasto: ['#4a8a46', '#5a9c54', '#3c7438'], arena: ['#d8cca0', '#c8bb8c', '#e8dcb4'], tierra: ['#8a7a64', '#756650', '#a08c74'], agua: ['#3a6fa8', '#5a8fc4', '#2a5788', '#cfe2f4'], acera: ['#c0bdb4', '#a6a39a'], plaza: ['#d8d6cc', '#bfbdb2'], adoquin: ['#9a988e', '#7f7d73'], asfalto: ['#34363c', '#2c2e34'], copa: ['#2f6a3a', '#45884c', '#68aa6a'],
    muros: ['#c4ccd8', '#aab4c4', '#dcdcd8', '#b8c4cc', '#9aa8bc'], techos: ['#6a7080', '#585e6c', '#7a8090', '#4a505e'], acentos: ['#3a8ad0', '#e0a030', '#d04a4a', '#40b0a0'] },
};
export const paleta = id => PALETAS[id] || PALETAS.dorada;

// ---------- suelos ----------
function puntos(R, c, gx, gy, x, y, n, claro, oscuro, k = 0) { for (let i = 0; i < n; i++) { const h = hz(gx, gy, i, k), h2 = hz(gx, gy, i, k + 7); R(h > .5 ? claro : oscuro, x + Math.floor(h * 14) + 1, y + Math.floor(h2 * 14) + 1, h2 > .7 ? 2 : 1, 1); } }
export function suelo(R, ch, x, y, gx, gy, P) {
  switch (ch) {
    case 'a': R(P.arena[0], x, y, 16, 16); puntos(R, 0, gx, gy, x, y, 9, P.arena[2], P.arena[1], 1); break;
    case 't': R(P.tierra[0], x, y, 16, 16); puntos(R, 0, gx, gy, x, y, 8, P.tierra[2], P.tierra[1], 2); if (hz(gx, gy, 3) > .86) R(P.tierra[1], x + 5, y + 6, 4, 3); break;
    case 'o': R(P.plaza[0], x, y, 16, 16); R(P.plaza[1], x, y + 7, 16, 1); R(P.plaza[1], x + ((gy & 1) ? 3 : 11), y, 1, 16); R(P.plaza[1], x, y + 15, 16, 1); R(mix(P.plaza[0], '#ffffff', .4), x + 1, y + 1, 5, 1); break;
    case 'e': R(P.adoquin[0], x, y, 16, 16); for (let r = 0; r < 4; r++) { const off = (r + gy) % 2 * 4; R(P.adoquin[1], x, y + r * 4 + 3, 16, 1); for (let c = 0; c < 4; c++) R(P.adoquin[1], x + ((c * 8 + off) % 16), y + r * 4, 1, 3); R(mix(P.adoquin[0], '#ffffff', .25), x + ((off + 2) % 14), y + r * 4 + 1, 3, 1); } break;
    case 'c': suelo(R, 'g', x, y, gx, gy, P); for (let i = 0; i < 4; i++) { const h = hz(gx, gy, i, 9); R(pick(['#f4d03f', '#e8588a', '#ffffff', '#c08af0'], hz(gx, gy, i, 5)), x + 2 + Math.floor(h * 11), y + 2 + Math.floor(hz(gx, gy, i, 6) * 11), 2, 2); } break;
    case 'x': R('#4b9a50', x, y, 16, 16); R('#43904a', x, y + ((gx + gy) % 2 ? 0 : 8), 16, 8); R('#e8f0e0', x, y + 7, 16, 1); R('#e8f0e0', x + 7, y, 1, 16); break;
    default: R(P.pasto[0], x, y, 16, 16); { const h = (gx * 31 + gy * 17) & 7; R(P.pasto[1], x + h, y + 3 + (h >> 1), 2, 2); R(P.pasto[1], x + 12 - h, y + 11, 2, 2); R(P.pasto[2], x + 3, y + 12 - (h >> 2), 2, 1); if (hz(gx, gy, 4) > .8) R(P.pasto[2], x + 9, y + 5, 1, 2); }
  }
}
const ES = (c, v) => v === c;
// ---------- agua y puentes (necesitan saber qué hay alrededor) ----------
export function aguaTile(R, x, y, gx, gy, P, vec, t = 0) {
  const [a, b, d, f] = P.agua; R(a, x, y, 16, 16);
  for (let r = 0; r < 4; r++) { const off = Math.floor(hz(gx, gy, r) * 8); R(b, x + off, y + r * 4 + 1, 5, 1); R(d, x + ((off + 8) % 12), y + r * 4 + 3, 4, 1); }
  const orilla = ch => ch !== 'w' && ch !== 'v';
  if (orilla(vec.N)) { R(f, x, y, 16, 1); R(b, x, y + 1, 16, 1); } if (orilla(vec.S)) { R(f, x, y + 15, 16, 1); R(b, x, y + 14, 16, 1); } if (orilla(vec.W)) { R(f, x, y, 1, 16); R(b, x + 1, y, 1, 16); } if (orilla(vec.E)) { R(f, x + 15, y, 1, 16); R(b, x + 14, y, 1, 16); }
}
export function puente(R, x, y, gx, gy, lx, ly, P) {
  aguaTile(R, x, y, gx, gy, P, { N: 'w', S: 'w', E: 'w', W: 'w' });
  const horiz = ly >= 6 && ly <= 9 && !(lx >= 6 && lx <= 9), vert = lx >= 6 && lx <= 9 && !(ly >= 6 && ly <= 9), m = '#a07a4a', m2 = '#85623a', m3 = '#c09a62';
  R(m, x, y, 16, 16); if (horiz) { for (let i = 0; i < 16; i += 4) { R(m2, x + i + 3, y, 1, 16); R(m3, x + i, y, 1, 16); } } else if (vert) { for (let i = 0; i < 16; i += 4) { R(m2, x, y + i + 3, 16, 1); R(m3, x, y + i, 16, 1); } } else { for (let i = 0; i < 16; i += 4) { R(m2, x, y + i + 3, 16, 1); R(m3, x, y + i, 16, 1); } }
  if (horiz && (ly === 5 || ly === 10)) { R(OUT, x, y + (ly === 5 ? 0 : 14), 16, 2); R('#7a5a38', x, y + (ly === 5 ? 2 : 13), 16, 1); } if (vert && (lx === 5 || lx === 10)) { R(OUT, x + (lx === 5 ? 0 : 14), y, 2, 16); R('#7a5a38', x + (lx === 5 ? 2 : 13), y, 1, 16); }
}
// ---------- objetos (se dibujan sobre un suelo) ----------
export function arbol(R, x, y, gx, gy, P, tipo = 'redondo') {
  const h = hz(gx, gy, 11), [c0, c1, c2] = P.copa, tr = '#5a3a22';
  R('#0003', x + 2, y + 12, 12, 3);
  if (tipo === 'pino') { R(tr, x + 7, y + 10, 2, 5); for (let i = 0; i < 4; i++) { const w = 4 + i * 3; R(OUT, x + 8 - (w >> 1) - 1, y + 2 + i * 3 - 1, w + 2, 4); R(i % 2 ? c0 : c1, x + 8 - (w >> 1), y + 2 + i * 3, w, 3); } R(c2, x + 7, y + 1, 2, 2); return; }
  R(tr, x + 7, y + 9, 2, 6); R(OUT, x + 1, y - 1 + (h > .5 ? 1 : 0), 14, 12); R(c0, x + 2, y + (h > .5 ? 1 : 0), 12, 10); R(c1, x + 3, y + 1 + (h > .5 ? 1 : 0), 7, 5); R(c2, x + 4, y + 2 + (h > .5 ? 1 : 0), 3, 2);
}
export function palmera(R, x, y, gx, gy, P) {
  R('#0003', x + 3, y + 13, 10, 2); R('#8a6a3a', x + 7, y + 5, 2, 10); R('#6a4a28', x + 8, y + 7, 1, 2); const v = '#3f9a4a', v2 = '#6cc060';
  R(OUT, x + 1, y + 2, 14, 4); R(v, x + 2, y + 3, 12, 2); R(v, x + 4, y + 1, 8, 2); R(v2, x + 3, y + 3, 4, 1); R(v, x + 1, y + 5, 3, 2); R(v, x + 12, y + 5, 3, 2); R('#8a5a2a', x + 7, y + 4, 2, 2);
}
export function sombrilla(R, x, y, gx, gy, P) { const c = pick(['#e8453c', '#f4d03f', '#3a8ad0', '#40b0a0', '#e8588a'], hz(gx, gy, 3)); R(P.arena[0], x, y, 16, 16); R('#0003', x + 3, y + 12, 10, 3); R('#8a6a3a', x + 7, y + 5, 2, 10); R(OUT, x + 1, y + 1, 14, 7); R(c, x + 2, y + 2, 12, 5); R('#ffffff', x + 4, y + 2, 3, 5); R('#ffffff', x + 10, y + 2, 3, 5); R(mix(c, '#000', .25), x + 2, y + 6, 12, 1); }
export function roca(R, x, y, gx, gy, P) { const h = hz(gx, gy, 5), c = P.acera[1] === '#80807e' ? '#8a8a86' : '#8f8a82'; R('#0003', x + 2, y + 12, 13, 3); R(OUT, x + 1, y + 3 + (h > .5 ? 2 : 0), 14, 11); R(c, x + 2, y + 4 + (h > .5 ? 2 : 0), 12, 9); R(mix(c, '#ffffff', .35), x + 3, y + 5 + (h > .5 ? 2 : 0), 6, 3); R(mix(c, '#000000', .3), x + 4, y + 11, 9, 2); R(mix(c, '#000000', .3), x + 10, y + 8, 3, 3); }
export function puesto(R, x, y, gx, gy, P) { const c1 = pick(['#e8453c', '#3a8ad0', '#40b0a0', '#e0a030', '#d94a9a'], hz(gx, gy, 6)); R('#0003', x + 1, y + 13, 14, 3); R('#7a5a38', x + 2, y + 7, 12, 8); R(OUT, x + 1, y + 6, 14, 1); for (let i = 0; i < 6; i++) R(i % 2 ? '#ffffff' : c1, x + 1 + i * 2 + (i > 2 ? 1 : 0), y + 2, 3, 5); R(OUT, x + 1, y + 1, 14, 1); R(OUT, x + 1, y + 7, 14, 1); R(pick(['#e8453c', '#f4d03f', '#7ac04a'], hz(gx, gy, 7)), x + 3, y + 9, 3, 3); R(pick(['#f4d03f', '#e0a030', '#c0602a'], hz(gx, gy, 8)), x + 8, y + 9, 3, 3); }
export function contenedor(R, x, y, gx, gy, P) { const c = pick(['#b8402f', '#3a6aa0', '#2f8a5a', '#d9822b', '#8a8a96'], hz(gx, gy, 9)); R('#0003', x + 1, y + 13, 15, 3); R(OUT, x, y + 2, 16, 12); R(c, x + 1, y + 3, 14, 10); for (let i = 0; i < 7; i++) R(mix(c, '#000', .28), x + 2 + i * 2, y + 4, 1, 8); R(mix(c, '#fff', .3), x + 1, y + 3, 14, 1); R('#2a1f1d66', x + 1, y + 12, 14, 1); }
export function fuente(R, x, y, gx, gy, P, t = 0) { R('#0003', x + 1, y + 13, 15, 3); R(OUT, x, y + 3, 16, 12); R('#c8bfae', x + 1, y + 4, 14, 10); R(P.agua[0], x + 2, y + 6, 12, 6); R(P.agua[1], x + 3, y + 7, 5, 1); R('#c8bfae', x + 6, y + 3, 4, 8); R(OUT, x + 6, y + 2, 4, 2); R(P.agua[3], x + 7, y + 1 + (t % 2), 2, 3); R(P.agua[3], x + 5, y + 4, 1, 2); R(P.agua[3], x + 10, y + 4, 1, 2); }
export function glorieta(R, x, y, qx, qy, P) {          // fuente grande de 2×2 casillas en el centro de un cruce
  for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) { const d = Math.hypot(qx * 16 + i - 15.5, qy * 16 + j - 15.5); let c = (i + j) % 7 === 0 ? P.asfalto[1] : P.asfalto[0]; if (d <= 15.5) c = d > 14 ? OUT : d > 11.2 ? (d > 12.6 ? '#e3dac4' : '#c8bfae') : d > 3 ? (d > 8 ? P.agua[0] : P.agua[1]) : d > 1.8 ? '#e3dac4' : P.agua[3]; if (d > 5 && d < 6.2 && (i + j) % 4 === 0) c = P.agua[3]; R(c, x + i, y + j, 1, 1); }
}
export function estatua(R, x, y, gx, gy, P) { R('#0003', x + 2, y + 13, 12, 3); R(OUT, x + 2, y + 9, 12, 6); R('#bdb7a8', x + 3, y + 10, 10, 4); R(OUT, x + 5, y + 1, 6, 9); R('#6a8a7a', x + 6, y + 2, 4, 7); R('#8aaa9a', x + 6, y + 2, 2, 3); R('#6a8a7a', x + 4, y + 4, 8, 2); }
export function banca(R, x, y, P) { R('#0003', x + 2, y + 12, 12, 3); R(OUT, x + 1, y + 5, 14, 8); R('#a8774a', x + 2, y + 6, 12, 3); R('#c9955c', x + 2, y + 6, 12, 1); R('#85583a', x + 2, y + 10, 12, 2); R(OUT, x + 2, y + 13, 2, 2); R(OUT, x + 12, y + 13, 2, 2); }
// ---------- calle ----------
export function calle(R, x, y, gx, gy, lx, ly, P, tipo) {
  if (tipo === 'e') return suelo(R, 'e', x, y, gx, gy, P);
  R(P.asfalto[0], x, y, 16, 16); puntos(R, 0, gx, gy, x, y, 5, P.asfalto[1], '#4a4d55', 3);
  if (lx === 7 && !(ly >= 6 && ly <= 9) && ly % 2 === 0) R('#d9c46a', x + 14, y + 3, 2, 10); if (ly === 7 && !(lx >= 6 && lx <= 9) && lx % 2 === 0) R('#d9c46a', x + 3, y + 14, 10, 2);
  if ((ly === 6 || ly === 9) && (lx < 6 || lx > 9) === false) { /* cruce */ }
  if (ly === 6 && lx >= 6 && lx <= 9 && false) R('#fff', x, y, 16, 2);
}
export function acera(R, x, y, gx, gy, P) { R(P.acera[0], x, y, 16, 16); R(P.acera[1], x, y + 15, 16, 1); R(P.acera[1], x + 7 + ((gx + gy) & 1) * 2, y, 1, 15); R(mix(P.acera[0], '#ffffff', .3), x + 1, y + 1, 5, 1); R(mix(P.acera[0], '#ffffff', .3), x + 9, y + 8, 5, 1); }
export function farola(R, x, y, P) { R('#0003', x + 4, y + 13, 9, 3); R(OUT, x + 7, y + 4, 2, 11); R('#3a3a42', x + 7, y + 5, 2, 10); R(OUT, x + 4, y, 8, 6); R('#ffd070', x + 5, y + 1, 6, 4); R('#fff0b0', x + 6, y + 1, 2, 2); }

// ================= EDIFICIOS (48×48 px = cuerpo de 3×3 casillas) =================
// Se dibujan en un sistema local 0..48 con el techo arriba y la fachada abajo (la puerta, abajo al centro). Si la puerta mira al norte se voltea verticalmente.
const caja = (R, x, y, w, h, c, borde = OUT) => { R(borde, x, y, w, h); R(c, x + 1, y + 1, w - 2, h - 2); R(mix(c, '#ffffff', .28), x + 1, y + 1, w - 2, 1); R(mix(c, '#000000', .22), x + 1, y + h - 2, w - 2, 1); };
const ventana = (R, x, y, w, h, marco, postigo) => { if (postigo) { R(postigo, x - 2, y, 2, h); R(postigo, x + w, y, 2, h); R(OUT, x - 2, y, 1, h); R(OUT, x + w + 1, y, 1, h); } R(OUT, x, y, w, h); R('#8fc8e4', x + 1, y + 1, w - 2, h - 2); R('#d8f0fa', x + 1, y + 1, 3, 2); R(marco, x + (w >> 1), y + 1, 1, h - 2); R(marco, x + 1, y + (h >> 1), w - 2, 1); R(mix(marco, '#000', .3), x, y + h, w, 1); };
function techo(R, tipo, c, P, k) {
  const osc = mix(c, '#000000', .28), cl = mix(c, '#ffffff', .25);
  switch (tipo) {
    case 'gable': caja(R, 1, 1, 46, 17, c); for (let r = 0; r < 3; r++) { R(osc, 2, 5 + r * 4, 44, 1); for (let i = 0; i < 8; i++) R(osc, 3 + i * 6 + (r % 2) * 3, 2 + r * 4, 1, 3); } R(cl, 2, 2, 44, 1); if (k > .4) { caja(R, 35, 2, 6, 8, '#8a6a5a'); R('#5a4038', 34, 1, 8, 2); } break;
    case 'flat': caja(R, 1, 3, 46, 15, '#a5abb4'); R('#c8ccd2', 2, 4, 44, 2); caja(R, 6, 8, 10, 6, '#cfd3d8'); R('#8a8e96', 9, 10, 4, 2); caja(R, 22, 9, 8, 5, '#cfd3d8'); if (k > .5) { R(OUT, 38, 0, 1, 8); R(OUT, 36, 2, 5, 1); R(OUT, 37, 4, 3, 1); } else caja(R, 34, 7, 9, 7, '#8a8e96'); break;
    case 'saw': R(OUT, 1, 6, 46, 12); for (let i = 0; i < 3; i++) { const x = 2 + i * 15; R(c, x, 8, 14, 9); R(OUT, x, 5, 1, 4); R(c, x + 1, 5, 3, 4); R('#9ad0e8', x + 5, 7, 8, 5); R(OUT, x + 4, 7, 1, 5); R(cl, x, 8, 14, 1); } break;
    case 'dome': caja(R, 6, 11, 36, 7, '#d8cfb8'); for (let r = 0; r < 10; r++) { const w = 34 - r * 3.2 | 0; R(OUT, 24 - (w >> 1) - 1, 10 - r, w + 2, 1); R(c, 24 - (w >> 1), 10 - r, w, 1); } R(cl, 14, 6, 6, 2); R(OUT, 23, 0, 2, 3); R('#e8c860', 23, 0, 2, 2); break;
    case 'thatch': caja(R, 1, 2, 46, 16, '#c9a45a'); for (let i = 0; i < 12; i++) R(mix('#c9a45a', '#000', .25), 3 + i * 4, 3, 1, 11); R('#e0c078', 2, 3, 44, 1); R('#8a6a30', 2, 16, 44, 2); for (let i = 0; i < 11; i++) R('#8a6a30', 3 + i * 4, 18, 2, 1); break;
    case 'barrel': caja(R, 1, 3, 46, 15, '#9aa4b0'); for (let i = 0; i < 23; i++) R(i % 2 ? '#7f8a98' : '#b6c0cc', 2 + i * 2, 4, 1, 13); R('#d4dce6', 2, 4, 44, 1); R(OUT, 40, 0, 4, 4); R('#555', 41, 1, 2, 2); break;
    case 'mansarda': caja(R, 1, 1, 46, 17, c); R(osc, 2, 7, 44, 1); R(osc, 2, 12, 44, 1); for (let i = 0; i < 4; i++) { caja(R, 5 + i * 11, 5, 8, 8, mix(c, '#fff', .1)); R('#8fc8e4', 7 + i * 11, 7, 4, 4); } R(cl, 2, 2, 44, 1); break;
  }
}
function fachada(R, tipo, c, ac, P, k) {
  caja(R, 1, 17, 46, 30, tipo === 'ladrillo' ? '#b0594a' : c);
  const marco = mix(c, '#ffffff', .55);
  switch (tipo) {
    case 'ventanas': for (const x of [5, 19, 33]) ventana(R, x, 21, 10, 9, '#ffffff', k > .5 ? ac : null); for (const x of [5, 33]) ventana(R, x, 35, 10, 8, '#ffffff', k > .5 ? ac : null); break;
    case 'ladrillo': for (let r = 0; r < 9; r++) { R('#8f4538', 2, 19 + r * 3, 44, 1); for (let i = 0; i < 8; i++) R('#8f4538', 3 + i * 6 + (r % 2) * 3, 17 + r * 3, 1, 3); } for (const x of [5, 19, 33]) ventana(R, x, 21, 10, 9, '#f4f0e0'); for (const x of [5, 33]) ventana(R, x, 35, 10, 8, '#f4f0e0'); break;
    case 'vidrio': caja(R, 3, 19, 42, 26, '#5a8ab8'); for (let i = 1; i < 7; i++) R('#3a6a98', 3 + i * 6, 20, 1, 24); for (let j = 1; j < 5; j++) R('#3a6a98', 4, 19 + j * 5, 40, 1); for (let i = 0; i < 6; i++) R('#a8d0f0', 5 + i * 7, 21 + (i % 3) * 5, 3, 3); R(mix(c, '#fff', .3), 1, 17, 46, 2); break;
    case 'arcos': for (const x of [4, 36]) { R('#3a2a26', x, 25, 8, 22); R('#3a2a26', x + 1, 23, 6, 2); R('#6a5248', x + 1, 26, 2, 18); } for (const x of [4, 36]) R(OUT, x - 1, 24, 10, 1); R('#3a2a26', 16, 21, 16, 26); R('#3a2a26', 18, 19, 12, 2); R(marco, 14, 17, 20, 2); for (const x of [1, 13, 34, 45]) R(mix(c, '#000', .15), x, 18, 2, 29); break;
    case 'liso': for (const x of [8, 32]) ventana(R, x, 24, 8, 8, '#ffffff'); break;
  }
}
function puerta(R, x, y, ac, k) { R('#0003', x - 1, y + 13, 12, 1); caja(R, x, y, 10, 14, ac); R(mix(ac, '#000', .35), x + 2, y + 2, 6, 5); R(mix(ac, '#ffffff', .3), x + 2, y + 2, 6, 1); R('#f0d060', x + 7, y + 8, 2, 2); R('#bdb7a8', x - 2, y + 13, 14, 1); }
function toldo(R, y, a, b) { R(OUT, 2, y, 44, 6); for (let i = 0; i < 11; i++) R(i % 2 ? '#fff6e8' : a, 3 + i * 4, y + 1, 4, 4); for (let i = 0; i < 11; i++) R(i % 2 ? '#fff6e8' : a, 3 + i * 4, y + 5, 4, 1); R('#0003', 3, y + 6, 42, 1); }
function balcon(R, y) { R(OUT, 3, y, 42, 1); for (let i = 0; i < 14; i++) R(OUT, 4 + i * 3, y, 1, 4); R(OUT, 3, y + 4, 42, 1); }
function letrero(R, x, y, w, ac) { caja(R, x, y, w, 7, '#f4ecd8'); R(ac, x + 2, y + 2, 4, 3); R('#8a7a6a', x + 8, y + 2, w - 12, 1); R('#8a7a6a', x + 8, y + 4, w - 16 > 0 ? w - 16 : 2, 1); }
function reloj(R, cx, cy) { R(OUT, cx - 5, cy - 5, 11, 11); R('#f8f4e8', cx - 4, cy - 4, 9, 9); R(OUT, cx, cy - 3, 1, 4); R(OUT, cx, cy, 3, 1); R('#c0392b', cx, cy, 1, 1); }
function ventanaRedonda(R, cx, cy, r) { R(OUT, cx - r, cy - r, 2 * r + 1, 2 * r + 1); R('#7ab0d8', cx - r + 1, cy - r + 1, 2 * r - 1, 2 * r - 1); R('#e8c860', cx, cy - r + 1, 1, 2 * r - 1); R('#e8c860', cx - r + 1, cy, 2 * r - 1, 1); R('#d02828', cx - 1, cy - 1, 3, 3); }

const ESTILOS = {
  casa: { t: 'gable', f: 'ventanas', e: [] }, casa2: { t: 'mansarda', f: 'ventanas', e: ['balcon'] }, tienda: { t: 'flat', f: 'ventanas', e: ['toldo', 'letrero'] }, colonial: { t: 'gable', f: 'arcos', e: ['balcon'] },
  torre: { t: 'flat', f: 'vidrio', e: [] }, oficina: { t: 'flat', f: 'vidrio', e: ['letrero'] }, pabellon: { t: 'dome', f: 'arcos', e: [] }, cabana: { t: 'thatch', f: 'liso', e: ['toldo'] },
  hotel: { t: 'flat', f: 'ventanas', e: ['balcon', 'letrero'] }, bodega: { t: 'barrel', f: 'liso', e: ['persiana'] }, fabrica: { t: 'saw', f: 'ladrillo', e: ['chimenea'] }, aula: { t: 'gable', f: 'ladrillo', e: ['reloj'] },
};
function hitoArte(R, a, P, ac, c, tc, k) {
  const wall = c;
  switch (a) {
    case 'reloj': techo(R, 'gable', tc, P, 0); caja(R, 15, 0, 18, 22, wall); R(tc, 14, 0, 20, 3); R(OUT, 23, 0, 2, 1); reloj(R, 24, 9); fachada(R, 'ventanas', wall, ac, P, .7); caja(R, 15, 17, 18, 5, wall); reloj(R, 24, 9); break;
    case 'catedral': fachada(R, 'ventanas', wall, ac, P, 0); for (const x of [2, 34]) { caja(R, x, 0, 12, 24, wall); R(tc, x - 1, 0, 14, 4); ventana(R, x + 3, 7, 6, 8, '#fff'); } caja(R, 14, 3, 20, 16, tc); ventanaRedonda(R, 24, 22, 4); fachada(R, 'arcos', wall, ac, P, 0); for (const x of [2, 34]) caja(R, x, 0, 12, 24, wall), R(tc, x - 1, 0, 14, 4), R(OUT, x + 5, 4, 2, 1), ventana(R, x + 3, 7, 6, 8, '#fff'); caja(R, 14, 2, 20, 17, wall); R(tc, 13, 1, 22, 4); R(OUT, 23, 0, 2, 2); ventanaRedonda(R, 24, 11, 5); break;
    case 'faro': fachada(R, 'liso', wall, ac, P, 0); for (let r = 0; r < 5; r++) { const w = 8 + r * 2, x = 24 - (w >> 1), y = 5 + r * 6; R(OUT, x - 1, y, w + 2, 7); R(r % 2 ? '#f4f0e8' : '#c8402f', x, y, w, 6); R('#0002', x + w - 2, y, 2, 6); } R(OUT, 17, 0, 14, 6); R('#f4e8a0', 18, 1, 12, 4); R('#fff8c0', 21, 1, 6, 3); R('#c8402f', 17, 0, 14, 1); R(OUT, 22, 6, 4, 1); break;
    case 'estacion': techo(R, 'barrel', tc, P, 0); caja(R, 14, 0, 20, 17, wall); R(tc, 13, 0, 22, 3); reloj(R, 24, 9); fachada(R, 'arcos', wall, ac, P, 0); caja(R, 14, 0, 20, 19, wall); R(tc, 13, 0, 22, 3); reloj(R, 24, 9); break;
    case 'biblioteca': fachada(R, 'liso', wall, ac, P, 0); for (let r = 0; r < 8; r++) { const w = 8 + r * 5; R(OUT, 24 - (w >> 1) - 1, r, w + 2, 1); R(mix(wall, '#ffffff', .15 + r * .02), 24 - (w >> 1), r, w, 1); } caja(R, 2, 8, 44, 9, wall); R(mix(wall, '#fff', .3), 4, 10, 40, 2); R(ac, 21, 3, 6, 3); for (const x of [4, 14, 33, 41]) { caja(R, x, 11, 3, 33, '#f4f0e8'); } R(OUT, 3, 44, 42, 2); R('#cfc8b4', 3, 45, 42, 2); ventana(R, 9, 22, 8, 9, '#fff'); ventana(R, 31, 22, 8, 9, '#fff'); break;
    case 'mercado_central': techo(R, 'barrel', tc, P, 0); fachada(R, 'arcos', wall, ac, P, 0); toldo(R, 22, '#e8453c'); toldo(R, 30, '#2f8a5a'); R(OUT, 22, 1, 4, 5); break;
    case 'mirador': fachada(R, 'liso', wall, ac, P, 0); caja(R, 8, 10, 32, 9, wall); techo(R, 'dome', '#8aa0b8', P, 0); R(OUT, 22, 2, 4, 6); R('#3a4a5a', 23, 3, 2, 4); break;
    case 'fabrica_vieja': techo(R, 'saw', tc, P, 0); fachada(R, 'ladrillo', wall, ac, P, 0); caja(R, 36, 0, 8, 22, '#a05040'); R('#7a3a30', 35, 0, 10, 3); R('#c8c0b8', 36, 0, 8, 1); R('#cfcfcf', 37, 0, 4, 2); break;
  }
}
export function edificio(R, x0, y0, o) {
  const P = o.pal, k = o.k, h = n => hz(k, n), rc = (c, x, y, w, hh) => { const x1 = Math.max(0, x), y1 = Math.max(0, y), x2 = Math.min(48, x + w), y2 = Math.min(48, y + hh); return x2 > x1 && y2 > y1 ? [c, x1, y1, x2 - x1, y2 - y1] : null; };   // recorta dentro de la caja de 48×48
  const R2 = (c, x, y, w, hh) => { const r = rc(c, x, y, w, hh); if (r) R(r[0], x0 + r[1], o.arriba ? y0 + 48 - r[2] - r[4] : y0 + r[2], r[3], r[4]); };
  const muro = pick(P.muros, h(1)), tc = pick(P.techos, h(2)), ac = pick(P.acentos, h(3)), S = ESTILOS[o.estilo] || ESTILOS.casa;
  R2('#0003', 1, 46, 47, 2);
  if (o.hito) { R2(mix(muro, '#fff', .1), 1, 17, 46, 30); hitoArte(R2, o.hito, P, ac, muro, tc, h(4)); } else { fachada(R2, S.f, muro, ac, P, h(4)); techo(R2, S.t, tc, P, h(5)); }
  const ex = o.hito ? [] : S.e;
  if (ex.includes('toldo')) toldo(R2, 31, ac, '#fff'); if (ex.includes('balcon')) balcon(R2, 29); if (ex.includes('letrero')) letrero(R2, 13, 19, 22, ac); if (ex.includes('reloj')) reloj(R2, 24, 10);
  if (ex.includes('chimenea')) { caja(R2, 36, 0, 7, 20, '#a05040'); R2('#7a3a30', 35, 0, 9, 2); R2('#d8d8d8', 37, 0, 4, 2); } if (ex.includes('persiana')) { caja(R2, 12, 24, 24, 23, '#aab4c0'); for (let i = 0; i < 7; i++) R2('#8a96a4', 13, 26 + i * 3, 22, 1); }
  puerta(R2, 19, 33, o.hito ? '#7a4a2a' : mix(ac, '#000', .15), h(6));
}
