// Mapa de la ciudad: 1 píxel por casilla. Sirve para el panel «Mapa» y para las vistas previas del selector de ciudades.
import { tile } from '../world/ciudad.js';
import { esNueva, CH, hitosCerca } from '../world/ciudades.js';
const COL = { '.': '#4a4d55', e: '#8a7d6d', ',': '#bba98e', l: '#bba98e', w: '#3b7fb8', v: '#a07a4a', g: '#4f8a3a', a: '#e6d3a0', t: '#9a7b55', o: '#d6c8ae', c: '#5f9c47', x: '#4b9a50', T: '#2f6b27', Y: '#3f9a4a', b: '#7a5a38', r: '#8a8a86', k: '#e0a030', C: '#b8402f', f: '#6fb0e0', M: '#8aaa9a', u: '#e8453c', H: '#c4553f', p: '#8f3f30', P: '#8f3f30', '#': '#2a1f1d' };
const cache = new Map();
export function baseMapa(seed, cx0, cy0, radio) {            // imagen base (sin propiedades); se recuerda para no recalcular
  const k = [seed, cx0, cy0, radio].join(); let im = cache.get(k); if (im) return im;
  const n = (2 * radio + 1) * CH, x0 = (cx0 - radio) * CH, y0 = (cy0 - radio) * CH; im = document.createElement('canvas'); im.width = im.height = n; const g = im.getContext('2d');
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { g.fillStyle = COL[tile(seed, x0 + x, y0 + y)] || '#888'; g.fillRect(x, y, 1, 1); }
  if (cache.size > 20) cache.clear(); cache.set(k, im); return im;
}
export function dibujarMapa(canvas, seed, cx0, cy0, radio, o = {}) {
  const base = baseMapa(seed, cx0, cy0, radio), n = base.width, g = canvas.getContext('2d'), x0 = (cx0 - radio) * CH, y0 = (cy0 - radio) * CH; canvas.width = canvas.height = n; g.drawImage(base, 0, 0);
  const P = (x, y) => [Math.round(x - x0), Math.round(y - y0)];
  for (const [id, d] of o.ocupa || []) { const [qx, qy] = [0, 0]; void qx; void qy; if (!d.puerta) continue; const [x, y] = P(d.puerta.x, d.puerta.y); g.fillStyle = d.color; g.fillRect(x - 2, y - 2, 5, 5); g.strokeStyle = '#000'; g.strokeRect(x - 2.5, y - 2.5, 5, 5); }
  if (esNueva(seed)) for (let cy = cy0 - radio; cy <= cy0 + radio; cy += 3) for (let cx = cx0 - radio; cx <= cx0 + radio; cx += 3) for (const h of hitosCerca(seed, cx, cy)) { const [x, y] = P(h.cx * CH + 8, h.cy * CH + 8); if (x > 0 && y > 0 && x < n && y < n) { g.fillStyle = '#fff'; g.fillRect(x - 2, y - 1, 5, 3); g.fillRect(x - 1, y - 2, 3, 5); g.fillStyle = '#ffd23f'; g.fillRect(x - 1, y - 1, 3, 3); } }
  if (o.destino) { const [x, y] = P(o.destino.x, o.destino.y); g.strokeStyle = '#ffd23f'; g.lineWidth = 2; g.strokeRect(x - 4, y - 4, 9, 9); }
  if (o.yo) { const [x, y] = P(o.yo.x, o.yo.y); g.fillStyle = '#ff3b30'; g.fillRect(x - 2, y - 2, 5, 5); g.strokeStyle = '#fff'; g.lineWidth = 1; g.strokeRect(x - 3.5, y - 3.5, 7, 7); }
  return canvas;
}
