// Ciudades variadas (PURO, determinista: cada casilla es función de (semilla, x, y)). Semillas < 1000 = la «ciudad clásica» original (ciudad.js).
// Semillas >= 1000 usan este generador: distritos orgánicos (Voronoi), agua (mar, río, lagos) con puentes, plazas, mercados, campus, puertos,
// colinas, hitos (monumentos que atraen gente) y tráfico policéntrico. Reglas que NO se rompen (hay pruebas):
//  1) los pasillos (calles y banquetas, lx o ly en 5..10 de cada chunk) siempre se pueden caminar (el agua se salva con puentes);
//  2) cada lote conserva su formato de id y su puerta; el frente de la puerta siempre es caminable y conecta con la banqueta;
//  3) el lote inicial '0,0,01' siempre existe y la zona de inicio es seca.
export const CH = 16;
export const SEED_NUEVA = 1000;
const mez = (...n) => { let h = 2166136261; for (const v of n) { h = Math.imul(h ^ (v | 0), 16777619); h ^= h >>> 13; } return h >>> 0; };
const u = (...n) => mez(...n) / 4294967296;
const mod = (a, n) => ((a % n) + n) % n;
export const esNueva = seed => seed >= SEED_NUEVA;

// ---------- tipos de distrito ----------
// seg: mezcla de clientela (la usa el mercado); q: probabilidad de cada tipo de manzana; est: estilos de edificio; calle: casilla de la calzada
export const DISTRITOS = {
  centro: { n: 'Centro', afl: 9, calle: '.', glorieta: .35, alameda: false, suelo: 'o', seg: { trabajadores: .38, turistas: .18, premium: .18, familias: .1, estudiantes: .16 }, q: { edificio: .74, plaza: .18, parque: .08 }, est: { torre: .5, oficina: .3, tienda: .2 }, color: '#8a93a6' },
  historico: { n: 'Casco histórico', afl: 8, calle: 'e', glorieta: .3, alameda: false, suelo: 'e', seg: { turistas: .36, premium: .2, familias: .18, trabajadores: .16, estudiantes: .1 }, q: { edificio: .62, plaza: .28, mercado: .1 }, est: { colonial: .6, tienda: .25, casa: .15 }, color: '#c9985a' },
  residencial: { n: 'Colonia', afl: 5, calle: '.', glorieta: .05, alameda: true, suelo: 'g', seg: { familias: .46, trabajadores: .2, estudiantes: .14, premium: .1, turistas: .1 }, q: { edificio: .66, parque: .26, cancha: .05, solar: .03 }, est: { casa: .6, casa2: .2, tienda: .2 }, color: '#7fae6a' },
  parque: { n: 'Jardines', afl: 4, calle: '.', glorieta: 0, alameda: true, suelo: 'g', seg: { familias: .36, turistas: .24, estudiantes: .16, premium: .14, trabajadores: .1 }, q: { edificio: .12, parque: .5, lago: .22, plaza: .06, cancha: .1 }, est: { pabellon: 1 }, color: '#4f9a4a' },
  costa: { n: 'Malecón', afl: 7, calle: '.', glorieta: .1, alameda: false, suelo: 'a', seg: { turistas: .44, familias: .22, premium: .16, estudiantes: .1, trabajadores: .08 }, q: { edificio: .5, playa: .3, plaza: .1, parque: .1 }, est: { cabana: .5, hotel: .3, tienda: .2 }, color: '#e6d3a0' },
  puerto: { n: 'Puerto', afl: 6, calle: '.', glorieta: 0, alameda: false, suelo: 't', seg: { trabajadores: .5, turistas: .16, familias: .1, estudiantes: .1, premium: .14 }, q: { edificio: .45, solar: .35, plaza: .05, playa: .15 }, est: { bodega: .7, oficina: .3 }, color: '#5f7f9a' },
  industrial: { n: 'Zona fabril', afl: 5, calle: '.', glorieta: 0, alameda: false, suelo: 't', seg: { trabajadores: .6, estudiantes: .12, familias: .12, turistas: .06, premium: .1 }, q: { edificio: .55, solar: .35, parque: .1 }, est: { bodega: .75, fabrica: .25 }, color: '#7a7066' },
  campus: { n: 'Campus', afl: 7, calle: '.', glorieta: .15, alameda: true, suelo: 'g', seg: { estudiantes: .56, familias: .1, trabajadores: .14, turistas: .1, premium: .1 }, q: { edificio: .45, parque: .3, cancha: .15, plaza: .1 }, est: { aula: .6, oficina: .2, casa: .2 }, color: '#b86a5a' },
  mercado: { n: 'Mercado', afl: 8, calle: 'e', glorieta: .1, alameda: false, suelo: 'e', seg: { familias: .32, trabajadores: .24, turistas: .2, estudiantes: .14, premium: .1 }, q: { edificio: .35, mercado: .45, plaza: .2 }, est: { tienda: .6, colonial: .4 }, color: '#d9822b' },
  colina: { n: 'Colinas', afl: 3, calle: '.', glorieta: 0, alameda: false, suelo: 't', seg: { turistas: .3, premium: .24, familias: .2, estudiantes: .14, trabajadores: .12 }, q: { edificio: .3, colina: .55, parque: .15 }, est: { cabana: .4, casa: .6 }, color: '#8a7f6a' },
};
const HITOS = {
  centro: [['Torre del Reloj', 'reloj'], ['Ayuntamiento', 'reloj'], ['Estación Central', 'estacion'], ['Banco Nacional', 'biblioteca'], ['Palacio de Justicia', 'biblioteca'], ['Torre Mirador', 'mirador']],
  historico: [['Catedral', 'catedral'], ['Teatro Antiguo', 'catedral'], ['Palacio de Gobierno', 'reloj'], ['Convento', 'catedral'], ['Casa de la Cultura', 'biblioteca']],
  residencial: [['Iglesia del Barrio', 'catedral'], ['Escuela Vieja', 'reloj'], ['Casa del Pueblo', 'biblioteca'], ['Biblioteca Vecinal', 'biblioteca']],
  parque: [['Museo de Ciencias', 'biblioteca'], ['Pabellón de Música', 'biblioteca'], ['Invernadero', 'mirador'], ['Casa del Lago', 'estacion']],
  costa: [['Faro', 'faro'], ['Acuario', 'biblioteca'], ['Muelle de Pescadores', 'faro'], ['Club Náutico', 'estacion']],
  puerto: [['Aduana', 'estacion'], ['Lonja', 'estacion'], ['Astillero', 'fabrica_vieja'], ['Capitanía', 'reloj']],
  industrial: [['Fábrica Vieja', 'fabrica_vieja'], ['Estación de Carga', 'estacion'], ['Molino Grande', 'fabrica_vieja'], ['Siderúrgica', 'fabrica_vieja']],
  campus: [['Biblioteca Central', 'biblioteca'], ['Rectoría', 'reloj'], ['Auditorio', 'catedral'], ['Observatorio Universitario', 'mirador']],
  mercado: [['Mercado Central', 'mercado_central'], ['Gran Tianguis', 'mercado_central'], ['Mercado de Flores', 'mercado_central'], ['Lonja del Mercado', 'estacion']],
  colina: [['Mirador', 'mirador'], ['Observatorio', 'mirador'], ['Santuario', 'catedral'], ['Capilla del Cerro', 'catedral']],
};

// ---------- catálogo de ciudades ----------
export const CIUDADES = [
  { id: 'dorada', nombre: 'Villa Dorada', seed: 1000, desc: 'Una capital de todo un poco: centro animado, un río con puentes, mercados y colonias tranquilas.', centro: 'centro', rio: true, pesos: { centro: 1, historico: 2, residencial: 4, parque: 2, mercado: 2, campus: 1.5, industrial: 1, colina: 1 }, paleta: 'dorada' },
  { id: 'azul', nombre: 'Puerto Azul', seed: 1001, desc: 'Ciudad de mar: malecón, playas, muelles y bodegas. El océano cierra la ciudad por un lado.', centro: 'costa', mar: true, pesos: { costa: 4, puerto: 2.5, residencial: 3, mercado: 1.5, historico: 1, parque: 1, campus: .6, industrial: .8 }, paleta: 'azul' },
  { id: 'verde', nombre: 'Valle Verde', seed: 1002, desc: 'Ciudad jardín: parques con lagos, un río, campus y barrios arbolados. Poco tráfico, mucha familia.', centro: 'residencial', rio: true, lagos: true, pesos: { parque: 4, residencial: 4, campus: 2, mercado: 1, historico: .8, colina: 1.5, centro: .5 }, paleta: 'verde' },
  { id: 'colonial', nombre: 'San Mateo', seed: 1003, desc: 'Pueblo colonial de piedra y barro: plazas con fuentes, empedrado, mercados y turismo.', centro: 'historico', pesos: { historico: 4, mercado: 3, residencial: 3, parque: .8, colina: 1.5, campus: .6, industrial: .4 }, paleta: 'colonial' },
  { id: 'roca', nombre: 'Roca Alta', seed: 1004, desc: 'Ciudad minera de montaña: colinas rocosas, fábricas, bodegas y pocas casas. Tráfico bajo pero obrero.', centro: 'industrial', pesos: { colina: 4, industrial: 3.5, residencial: 2, mercado: 1, puerto: 0, historico: .8, campus: .4, parque: .4 }, paleta: 'roca' },
  { id: 'metro', nombre: 'Gran Metrópoli', seed: 1005, desc: 'Rascacielos, avenidas con glorietas, zona fabril y un río ancho. Mucho tráfico y mucha competencia.', centro: 'centro', rio: true, pesos: { centro: 4.5, industrial: 2, campus: 2, mercado: 2, residencial: 2.5, historico: 1, parque: 1, puerto: .0 }, paleta: 'metro' },
];
export const ciudadDe = seed => (esNueva(seed) ? CIUDADES.find(c => c.seed === seed) || { ...CIUDADES[mod(seed, CIUDADES.length)], seed } : null);
export const nombreCiudad = seed => (esNueva(seed) ? ciudadDe(seed).nombre : 'Ciudad clásica');

// ---------- agua ----------
const rot = (seed, gx, gy, k) => { const d = mez(seed, k) % 4; return d === 0 ? [gx, gy] : d === 1 ? [gy, -gx] : d === 2 ? [-gx, -gy] : [-gy, gx]; };
export function profMar(seed, gx, gy) {                                                       // 0 en tierra; >0 = cuánto se ha entrado en el mar
  const C = ciudadDe(seed); if (!C || !C.mar || (Math.abs(gx) < 30 && Math.abs(gy) < 30)) return 0;
  const [uu, vv] = rot(seed, gx, gy, 1), borde = 54 + mez(seed, 2) % 14 + 5 * Math.sin(uu / 21 + u(seed, 3) * 6) + 2.5 * Math.sin(uu / 8.3 + u(seed, 4) * 6); return Math.max(0, vv - borde);
}
export function agua(seed, gx, gy) {
  const C = ciudadDe(seed); if (!C || !(C.mar || C.rio)) return false;
  if (Math.abs(gx) < 30 && Math.abs(gy) < 30) return false;                                  // la zona de inicio siempre es seca
  if (C.mar && profMar(seed, gx, gy) > 0) return true;
  if (C.rio) {
    const [uu, vv] = rot(seed, gx, gy, 5), centro = 46 + mez(seed, 6) % 22 + 11 * Math.sin(uu / 41 + u(seed, 7) * 6) + 4 * Math.sin(uu / 15 + u(seed, 8) * 6), ancho = (C.id === 'metro' ? 8 : 5) + 1.6 * Math.sin(uu / 27 + u(seed, 9) * 6);
    if (Math.abs(vv - centro) < ancho / 2) return true;
  }
  return false;
}
const cercaAgua = (seed, gx, gy, r) => { for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if ((dx || dy) && agua(seed, gx + dx, gy + dy)) return true; return false; };

// ---------- distritos (Voronoi con sitios con ruido, celdas de 3×3 chunks) ----------
const DC = 3, memo = { sitios: new Map(), chunk: new Map(), quad: new Map(), lotes: new Map(), hitos: new Map() };
const limpiar = m => { if (m.size > 6000) m.clear(); };
function sitio(seed, i, j) {
  const k = seed + ',' + i + ',' + j; let s = memo.sitios.get(k); if (s) return s;
  const C = ciudadDe(seed), sx = i * DC + .3 + 2.4 * u(seed, i, j, 11), sy = j * DC + .3 + 2.4 * u(seed, i, j, 12);
  let tipo; const d0 = Math.hypot(sx, sy);
  if (d0 < 2.4) tipo = C.centro;
  else {
    let pesos = { ...C.pesos }; if (d0 < 4.5) { pesos.centro = (pesos.centro || 0) + 1.2; pesos.historico = (pesos.historico || 0) + .8; } if (d0 > 7) { pesos.centro = (pesos.centro || 0) * .2; pesos.parque = (pesos.parque || 0) + .8; pesos.industrial = (pesos.industrial || 0) + .6; }
    const ent = Object.entries(pesos).filter(([, w]) => w > 0), tot = ent.reduce((a, [, w]) => a + w, 0); let r = u(seed, i, j, 13) * tot; tipo = ent[0][0]; for (const [t, w] of ent) { r -= w; if (r <= 0) { tipo = t; break; } }
    let mojado = false; for (const [dx, dy] of [[0, 0], [36, 0], [-36, 0], [0, 36], [0, -36], [26, 26], [-26, -26], [26, -26], [-26, 26]]) if (agua(seed, Math.round(sx * CH) + dx, Math.round(sy * CH) + dy)) { mojado = true; break; }
    if (mojado) { if (C.mar) { const o = ['costa', 'costa', 'puerto', 'residencial'], x = o[mez(seed, i, j, 14) % o.length]; tipo = x; } else if (tipo === 'industrial' || tipo === 'colina') tipo = 'residencial'; }
  }
  s = { i, j, sx, sy, tipo }; limpiar(memo.sitios); memo.sitios.set(k, s); return s;
}
export function distritoChunk(seed, cx, cy) {
  const k = seed + ',' + cx + ',' + cy; let r = memo.chunk.get(k); if (r) return r;
  const C = ciudadDe(seed); let tipo, site;
  if (Math.abs(cx) <= 1 && Math.abs(cy) <= 1) { tipo = C.centro; site = sitio(seed, 0, 0); }
  else {
    const i0 = Math.floor(cx / DC), j0 = Math.floor(cy / DC); let md = 1e9;
    for (let j = j0 - 1; j <= j0 + 1; j++) for (let i = i0 - 1; i <= i0 + 1; i++) { const s = sitio(seed, i, j), d = (s.sx - cx - .5) ** 2 + (s.sy - cy - .5) ** 2; if (d < md) { md = d; site = s; } }
    tipo = site.tipo;
  }
  r = { tipo, site: { i: site.i, j: site.j } }; limpiar(memo.chunk); memo.chunk.set(k, r); return r;
}

// ---------- hitos: un monumento por distrito (casi siempre) ----------
const SUF_HITO = ['', '', 'de San Pedro', 'del Sol', 'Real', 'de la Ribera', 'de la Luna', 'Grande', 'de San Mateo', 'del Carmen'];
export function hitosCerca(seed, cx, cy) {
  const k = seed + ',' + cx + ',' + cy; let r = memo.hitos.get(k); if (r) return r;
  r = []; const i0 = Math.floor(cx / DC), j0 = Math.floor(cy / DC);
  for (let j = j0 - 2; j <= j0 + 2; j++) for (let i = i0 - 2; i <= i0 + 2; i++) {
    const s = sitio(seed, i, j), lista = HITOS[s.tipo]; if (!lista || u(seed, i, j, 21) > .9) continue;
    const hcx = Math.floor(s.sx), hcy = Math.floor(s.sy); let q = mez(seed, i, j, 22) % 4; const qx = q >> 1, qy = q & 1;
    let qq = [qx, qy]; if (hcx === 0 && hcy === 0 && qx === 0 && qy === 1) qq = [1, 1];                       // el lote inicial nunca es un hito
    const [base, arte] = lista[mez(seed, i, j, 23) % lista.length], nombre = `${base} ${SUF_HITO[mez(seed, i, j, 24) % SUF_HITO.length]}`.trim();
    r.push({ cx: hcx, cy: hcy, qx: qq[0], qy: qq[1], tipo: s.tipo, nombre, arte, id: `${hcx},${hcy},${qq[0]}${qq[1]}` });
  }
  limpiar(memo.hitos); memo.hitos.set(k, r); return r;
}

// ---------- manzanas (cuadrantes de 5×5) ----------
const elige = (obj, x) => { let a = 0; for (const [k, p] of Object.entries(obj)) { a += p; if (x < a) return k; } return Object.keys(obj)[0]; };
export function cuadrante(seed, cx, cy, qx, qy) {
  const k = seed + ',' + cx + ',' + cy + ',' + qx + qy; let r = memo.quad.get(k); if (r) return r;
  const D = distritoChunk(seed, cx, cy), T = DISTRITOS[D.tipo], x = u(seed, cx, cy, qx, qy, 31); let t, estilo = null, hito = null;
  if (cx === 0 && cy === 0) t = qx === 0 && qy === 1 ? 'edificio' : qx === 1 && qy === 0 ? 'plaza' : x < .75 ? 'edificio' : 'parque';
  else t = elige(T.q, x);
  const h = hitosCerca(seed, cx, cy).find(z => z.cx === cx && z.cy === cy && z.qx === qx && z.qy === qy); if (h) { t = 'edificio'; hito = h; estilo = 'hito'; }
  if (t === 'edificio' && !estilo) estilo = elige(T.est, u(seed, cx, cy, qx, qy, 32));
  if (t === 'edificio') {                                                                         // si el agua toca el edificio o su frente, el lote no existe: queda una ribera abierta
    const x0 = cx * CH + (qx ? 11 : 0), y0 = cy * CH + (qy ? 11 : 0); let mojado = false;
    for (let by = 0; by <= 4 && !mojado; by++) for (let bx = 0; bx <= 4; bx++) if (agua(seed, x0 + bx, y0 + by)) { mojado = true; break; }
    if (mojado) { t = 'ribera'; estilo = null; hito = null; }
  }
  r = { t, estilo, hito, distrito: D.tipo }; limpiar(memo.quad); memo.quad.set(k, r); return r;
}

// ---------- casillas ----------
// Caminables nuevas: a arena, e empedrado, o plaza, v puente, t tierra, c flores, x cancha. Sólidas nuevas: w agua, f fuente, r roca, k puesto, Y palmera, C contenedor, M estatua, u sombrilla, h seto.
function suelo(seed, T, gx, gy) {
  let s = T.suelo; const C = ciudadDe(seed);
  if (C.mar && s !== 'o' && s !== 'e' && cercaAgua(seed, gx, gy, 3)) s = 'a';
  return s === 'o' || s === 'e' ? s : s;
}
export function tileNuevo(seed, gx, gy) {
  const cx = Math.floor(gx / CH), cy = Math.floor(gy / CH), lx = mod(gx, CH), ly = mod(gy, CH), D = distritoChunk(seed, cx, cy), T = DISTRITOS[D.tipo], w = agua(seed, gx, gy);
  const corr = (lx >= 5 && lx <= 10) || (ly >= 5 && ly <= 10);
  if (corr) {
    if (w) return profMar(seed, gx, gy) > 7 ? 'w' : 'v';          // los puentes cruzan ríos; frente al mar la calle termina en un muelle corto
    const calzada = (lx >= 6 && lx <= 9) || (ly >= 6 && ly <= 9);
    if (calzada) { if (lx >= 7 && lx <= 8 && ly >= 7 && ly <= 8 && u(seed, cx, cy, 41) < T.glorieta) return 'f'; return T.calle; }
    if ((lx === 5 || lx === 10) && (ly === 5 || ly === 10)) return 'l';
    if (T.alameda && ((lx === 5 || lx === 10) && (ly === 0 || ly === 4 || ly === 11 || ly === 15) || (ly === 5 || ly === 10) && (lx === 0 || lx === 4 || lx === 11 || lx === 15)) && u(seed, gx, gy, 42) < .7) return 'T';
    return ',';
  }
  const qx = lx > 9 ? 1 : 0, qy = ly > 9 ? 1 : 0, bx = lx - (qx ? 11 : 0), by = ly - (qy ? 11 : 0), q = cuadrante(seed, cx, cy, qx, qy);
  if (w) return 'w';
  const base = suelo(seed, T, gx, gy), h = u(seed, gx, gy, 43), esc = (bx === 0 || bx === 4) && (by === 0 || by === 4), cen = bx === 2 && by === 2, puertaCol = bx === 2 && (by === 0 || by === 4);
  switch (q.t) {
    case 'edificio': {
      if (bx >= 1 && bx <= 3 && by >= 1 && by <= 3) return bx === 2 && by === (qy ? 1 : 3) ? 'p' : 'H';
      if (esc && !puertaCol) { const dd = T.alameda || D.tipo === 'residencial' ? .45 : D.tipo === 'centro' ? .15 : .25; if (h < dd) return 'T'; if (h < dd + .12) return base === 'g' ? 'c' : base; }
      return base;
    }
    case 'parque': {
      if (bx === 2 || by === 2) return 'o';
      return h < .3 ? 'T' : h < .38 ? 'b' : h < .52 ? 'c' : 'g';
    }
    case 'plaza': {
      if (cen) return D.tipo === 'historico' || D.tipo === 'mercado' ? 'M' : 'f';
      if ((bx === 1 || bx === 3) && (by === 1 || by === 3)) return 'b';
      if (esc && h < .6) return 'T';
      return 'o';
    }
    case 'lago': { const dx = (bx - 2) / 1.9, dy = (by - 2) / 1.7; if (dx * dx + dy * dy <= 1) return 'w'; return esc || h < .25 ? 'T' : h < .35 ? 'b' : 'g'; }
    case 'mercado': { if ((bx === 1 || bx === 3) && (by === 1 || by === 3) && h < .9) return 'k'; if (cen) return 'o'; return T.suelo === 'e' ? 'e' : 'o'; }
    case 'solar': { if (esc || puertaCol) return 't'; return h < .34 ? 'C' : h < .46 ? 'r' : 't'; }
    case 'cancha': return 'x';
    case 'colina': { if (bx === 2) return 't'; return h < .3 ? 'r' : h < .5 ? 'T' : 't'; }
    case 'playa': { if (bx === 2) return 'a'; return h < .16 ? 'Y' : h < .24 ? 'u' : 'a'; }
    default: /* ribera */ return h < .22 ? 'T' : h < .3 ? 'b' : 'g';
  }
}

// ---------- lotes y tráfico ----------
export function lotesNuevos(seed, cx, cy) {
  const k = seed + ',' + cx + ',' + cy; let r = memo.lotes.get(k); if (r) return r; r = [];
  for (const [qx, qy] of [[0, 1], [0, 0], [1, 0], [1, 1]]) {
    const q = cuadrante(seed, cx, cy, qx, qy); if (q.t !== 'edificio') continue;
    const x = cx * CH + (qx ? 11 : 0) + 2, y = cy * CH + (qy ? 11 : 0) + (qy ? 1 : 3);
    r.push({ id: `${cx},${cy},${qx}${qy}`, seed, cx, cy, qx, qy, puerta: { x, y }, frente: { x: x + .5, y: y + (qy ? -.8 : 1.8) }, estilo: q.estilo, distrito: q.distrito, hito: q.hito ? { nombre: q.hito.nombre, arte: q.hito.arte } : null });
  }
  limpiar(memo.lotes); memo.lotes.set(k, r); return r;
}
export function traficoNuevo(seed, l) {
  const T = DISTRITOS[distritoChunk(seed, l.cx, l.cy).tipo], r = Math.hypot(l.cx, l.cy); let b = T.afl * .8 + Math.max(0, 3.2 - .45 * r);
  if (l.hito) b += 3; else { for (const h of hitosCerca(seed, l.cx, l.cy)) if (Math.hypot((h.cx - l.cx) * CH, (h.cy - l.cy) * CH) <= 34) { b += 1.4; break; } }
  return Math.max(1, Math.min(14, Math.round(b)));
}
export const infoCasilla = (seed, gx, gy) => { const cx = Math.floor(gx / CH), cy = Math.floor(gy / CH), lx = mod(gx, CH), ly = mod(gy, CH), qx = lx > 9 ? 1 : 0, qy = ly > 9 ? 1 : 0; return { cx, cy, lx, ly, qx, qy, bx: lx - (qx ? 11 : 0), by: ly - (qy ? 11 : 0), D: distritoChunk(seed, cx, cy), q: cuadrante(seed, cx, cy, qx, qy) }; };
export const lugarEn = (seed, gx, gy) => { const D = distritoChunk(seed, Math.floor(gx / CH), Math.floor(gy / CH)); return `${DISTRITOS[D.tipo].n} · ${nombreCiudad(seed)}`; };
