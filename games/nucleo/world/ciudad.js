// Ciudad infinita determinista: cada casilla es función pura de (semilla, x, y). Los chunks (16x16) solo son una caché con carga progresiva.
export const CH = 16;
const SOLIDOS = new Set('#HTplb');
export const esSolido = ch => SOLIDOS.has(ch);
export const NEGOCIO = { puerta: { x: 2, y: 12 }, aparece: { x: 2.5, y: 11.2 } };   // lote inicial (chunk 0,0): hogar del primer jugador
const mod = (a, n) => ((a % n) + n) % n;
const mez = (...n) => { let h = 2166136261; for (const v of n) { h = Math.imul(h ^ (v | 0), 16777619); h ^= h >>> 13; } return h >>> 0; };

export function tile(seed, gx, gy) {
  const cx = Math.floor(gx / CH), cy = Math.floor(gy / CH), lx = mod(gx, CH), ly = mod(gy, CH);
  if ((lx >= 6 && lx <= 9) || (ly >= 6 && ly <= 9)) return '.';                                  // calles
  if (lx === 5 || lx === 10 || ly === 5 || ly === 10) return (lx === 5 || lx === 10) && (ly === 5 || ly === 10) ? 'l' : ',';   // banqueta / farola
  const qx = lx > 9 ? 1 : 0, qy = ly > 9 ? 1 : 0, bx = lx - (qx ? 11 : 0), by = ly - (qy ? 11 : 0);
  const inicial = cx === 0 && cy === 0 && qx === 0 && qy === 1;                                    // lote inicial: siempre es edificio
  const tipo = inicial ? 0 : mez(seed, cx, cy, qx, qy) % 4;                                       // 0-2 edificio, 3 parque
  if (tipo < 3) {
    if (bx >= 1 && bx <= 3 && by >= 1 && by <= 3) return bx === 2 && by === (qy ? 1 : 3) ? 'p' : 'H';
    return 'g';
  }
  const r = mez(seed, gx, gy) % 10;
  return r < 2 ? 'T' : r === 2 ? 'b' : 'g';
}
export function generarChunk(seed, cx, cy) {
  const filas = [];
  for (let ly = 0; ly < CH; ly++) { let f = ''; for (let lx = 0; lx < CH; lx++) f += tile(seed, cx * CH + lx, cy * CH + ly); filas.push(f); }
  return { cx, cy, filas };
}

// Gestor de chunks: estados pendiente → listo, presupuesto de carga por paso, liberación con histéresis y sin duplicados.
export class Chunks {
  constructor({ seed = 1, radio = 2, margen = 1, presupuesto = 2 } = {}) { Object.assign(this, { seed, radio, margen, presupuesto }); this.m = new Map(); this.cola = []; this.stats = { generados: 0, liberados: 0 }; this._c = null; }
  static clave(cx, cy) { return cx + ',' + cy; }
  actualizar(px, py) {
    const pcx = Math.floor(px / CH), pcy = Math.floor(py / CH);
    if (this._c && this._c[0] === pcx && this._c[1] === pcy) return;
    this._c = [pcx, pcy];
    for (let dy = -this.radio; dy <= this.radio; dy++) for (let dx = -this.radio; dx <= this.radio; dx++) {
      const k = Chunks.clave(pcx + dx, pcy + dy);
      if (!this.m.has(k)) { this.m.set(k, { cx: pcx + dx, cy: pcy + dy, estado: 'pendiente' }); this.cola.push(k); }
    }
    const lim = this.radio + this.margen, d = c => Math.max(Math.abs(c.cx - pcx), Math.abs(c.cy - pcy));
    for (const [k, c] of this.m) if (d(c) > lim) { this.m.delete(k); this.stats.liberados++; }
    this.cola = this.cola.filter(k => this.m.has(k)).sort((a, b) => d(this.m.get(a)) - d(this.m.get(b)));
  }
  paso(n = this.presupuesto) {
    let hechos = 0;
    while (n-- > 0 && this.cola.length) {
      const c = this.m.get(this.cola.shift()); if (!c || c.estado !== 'pendiente') continue;
      c.filas = generarChunk(this.seed, c.cx, c.cy).filas; c.estado = 'listo'; this.stats.generados++; hechos++;
    }
    return hechos;
  }
  forzar(px, py) { this._c = null; this.actualizar(px, py); while (this.paso(99)); }
  obtener(cx, cy) { const c = this.m.get(Chunks.clave(cx, cy)); return c && c.estado === 'listo' ? c : null; }
  tile(gx, gy) { const c = this.obtener(Math.floor(gx / CH), Math.floor(gy / CH)); return c ? c.filas[mod(gy, CH)][mod(gx, CH)] : '#'; }   // chunk sin cargar = muro
}

// ---- Lotes: cada edificio es una propiedad con puerta, frente y tráfico (base de la economía compartida) ----
export const LOTE_INICIAL = '0,0,01';
export function lotes(seed, cx, cy) {
  const r = [];
  for (const [qx, qy] of [[0, 1], [0, 0], [1, 0], [1, 1]]) {
    if (!(cx === 0 && cy === 0 && qx === 0 && qy === 1) && mez(seed, cx, cy, qx, qy) % 4 === 3) continue;   // parque: no es lote
    const x = cx * CH + (qx ? 11 : 0) + 2, y = cy * CH + (qy ? 11 : 0) + (qy ? 1 : 3);
    r.push({ id: `${cx},${cy},${qx}${qy}`, cx, cy, qx, qy, puerta: { x, y }, frente: { x: x + .5, y: y + (qy ? -.8 : 1.8) } });
  }
  return r;
}
export function loteDe(seed, id) {
  const m = /^(-?\d{1,4}),(-?\d{1,4}),([01])([01])$/.exec(String(id)); if (!m) return null;
  return lotes(seed, +m[1], +m[2]).find(l => l.id === id) || null;
}
export const trafico = l => Math.max(1, 10 - 2 * Math.max(Math.abs(l.cx), Math.abs(l.cy)));   // 10 en el centro, baja con la distancia
export const distLotes = (a, b) => Math.hypot(a.puerta.x - b.puerta.x, a.puerta.y - b.puerta.y);
