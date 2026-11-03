// Vida de la ciudad (PURO): exploración con sellos, pedidos a domicilio y chismes de los peatones. Todo determinista y probado en node.
import { esNueva, hitosCerca, DISTRITOS, distritoChunk, nombreCiudad, CH } from './ciudades.js';
import { lotes, loteDe, trafico } from './ciudad.js';
const mez = (...n) => { let h = 2166136261; for (const v of n) { h = Math.imul(h ^ (v | 0), 16777619); h ^= h >>> 13; } return h >>> 0; };
const tipoEn = (seed, gx, gy) => (esNueva(seed) ? distritoChunk(seed, Math.floor(gx / CH), Math.floor(gy / CH)).tipo : null);   // la ciudad clásica no tiene distritos
export const VEL = 4.6;                                                    // casillas por segundo del jugador en la calle
const DIRS = ['este', 'sureste', 'sur', 'suroeste', 'oeste', 'noroeste', 'norte', 'noreste'];
export const direccion = (dx, dy) => DIRS[Math.round((Math.atan2(dy, dx) / (Math.PI / 4) + 8)) % 8];
export function pista(desde, dest) { const d = Math.hypot(dest.x - desde.x, dest.y - desde.y), c = Math.max(1, Math.round(d / CH * 2) / 2); return `a unas ${c} cuadras al ${direccion(dest.x - desde.x, dest.y - desde.y)}`; }

// ---------- pasaporte: los 8 monumentos más cercanos al inicio ----------
export function sellosDe(seed, n = 8) {
  if (!esNueva(seed)) return [];
  const m = new Map(); for (let cy = -9; cy <= 9; cy += 3) for (let cx = -9; cx <= 9; cx += 3) for (const h of hitosCerca(seed, cx, cy)) m.set(h.id, h);
  return [...m.values()].map(h => ({ h, l: loteDe(seed, h.id) })).filter(x => x.l).map(({ h, l }) => ({ id: h.id, nombre: h.nombre, arte: h.arte, distrito: DISTRITOS[h.tipo].n, tipo: h.tipo, frente: { x: l.frente.x, y: l.frente.y }, d: Math.hypot(l.frente.x, l.frente.y), premio: 40 + 6 * trafico(l) }))
    .sort((a, b) => a.d - b.d || (a.id < b.id ? -1 : 1)).slice(0, n);
}
export const visita = (sello, px, py) => Math.hypot(px - sello.frente.x, py - sello.frente.y) <= 2.8;
export const PREMIO_PASAPORTE = 600;
export function estadoPasaporte(sellos, hechos) { const ok = sellos.filter(s => hechos.has(s.id)).length; return { ok, total: sellos.length, completo: sellos.length > 0 && ok === sellos.length }; }

// ---------- pedidos a domicilio ----------
export const REP_CUBO = 45;                                                // cada 45 s cambia la tanda de ofertas
const ANILLOS = [[20, 44, 'Cerquita'], [46, 80, 'Medio'], [84, 140, 'Lejos']];
export function ofertasReparto(seed, cubo, desde) {
  const out = [], cx0 = Math.floor(desde.x / CH), cy0 = Math.floor(desde.y / CH), cand = [];
  for (let cy = cy0 - 9; cy <= cy0 + 9; cy++) for (let cx = cx0 - 9; cx <= cx0 + 9; cx++) for (const l of lotes(seed, cx, cy)) cand.push({ l, d: Math.hypot(l.frente.x - desde.x, l.frente.y - desde.y) });
  const usados = new Set();
  ANILLOS.forEach(([a, b, nombre], i) => {
    const lista = cand.filter(c => c.d >= a && c.d <= b && !usados.has(c.l.id)).sort((p, q) => (p.l.id < q.l.id ? -1 : 1)); if (!lista.length) return;
    const { l, d } = lista[mez(seed, cubo, i, 7) % lista.length]; usados.add(l.id); const afl = 1 + (trafico(l) - 5) * .03, hito = l.hito?.nombre || null;
    out.push({ id: `r${cubo}.${i}`, nivel: nombre, lote: l.id, frente: { x: l.frente.x, y: l.frente.y }, dist: Math.round(d), limite: Math.round(d / (VEL * .7) + 10), pago: Math.round((30 + d * .9) * (hito ? 1.5 : 1) * afl), distrito: DISTRITOS[tipoEn(seed, l.cx * CH, l.cy * CH)]?.n || 'Ciudad', hito });
  });
  return out;
}
export function entrega(of, restante, racha) {                              // propina por sobrar tiempo y bono por tandas seguidas
  const k = Math.max(0, Math.min(1, restante / of.limite)), prop = Math.round(of.pago * .6 * k), mult = 1 + Math.min(.5, .1 * racha), total = Math.round((of.pago + prop) * mult);
  return { total, prop, mult, xp: Math.round(total / 5), rapido: k > .5 };
}

// ---------- chismes: los peatones saben cosas útiles ----------
const FRASES = {
  centro: ['Aquí todo el mundo come a la carrera: lo rápido gana.', 'Los oficinistas pagan bien si no los haces esperar.'], historico: ['Los turistas buscan sitios con historia y no regatean.', 'Dicen que la plaza se llena en los desfiles.'],
  residencial: ['Las familias de la colonia siempre piden postre.', 'Aquí se premia el buen trato más que el precio.'], parque: ['Los fines de semana el parque se llena de familias.', 'Un conciertito y todo esto se vuelve una fiesta.'],
  costa: ['En verano el malecón no da abasto.', '¿Has probado vender cerca de la playa? Los turistas ni miran el precio.'], puerto: ['Los estibadores comen rápido y mucho.', 'Cuando llega un barco, el muelle se llena.'],
  industrial: ['Los obreros salen todos a la misma hora: prepárate.', 'Aquí gana el que sirve más rápido.'], campus: ['Los estudiantes cuentan cada moneda… y se llevan a toda la banda.', 'En época de exámenes la biblioteca no cierra.'],
  mercado: ['Con los puestos cerca la competencia es dura, pero la gente abunda.', 'Los sábados el tianguis es otro mundo.'], colina: ['Pocos suben hasta acá, pero los que suben pagan lo que sea.', 'Desde el mirador se ve toda la ciudad.'],
};
export function chisme({ seed, mundo, pos, sellos = [], hechos = new Set(), rnd = Math.random }) {
  const c = [], M = mundo || {};
  for (const e of M.mercado?.eventos || []) c.push(`Dicen que hay ${e.n.toLowerCase()}${e.barrio ? ' en ' + e.barrio : ''}: ${e.estado === 'proximo' ? `empieza en ${e.inicia} turnos` : `quedan ${e.quedan} turnos`}.`);
  for (const s of M.subastas || []) c.push(s.ciudad ? `La ciudad está subastando el lote ${s.lote}. Cierra en ${s.quedan} turnos.` : `${s.vendedor} subasta su franquicia del lote ${s.lote}. Cierra en ${s.quedan} turnos.`);
  for (const n of (M.noticias || []).slice(-4)) c.push(`Escuché que ${n.txt.charAt(0).toLowerCase() + n.txt.slice(1)}`);
  for (const j of M.jugadores || []) if (j.apuros && !j.retirado) c.push(`${j.nombre} anda ahogado en deudas… quizá alguien le eche una mano.`);
  const falta = sellos.filter(s => !hechos.has(s.id)).sort((a, b) => Math.hypot(a.frente.x - pos.x, a.frente.y - pos.y) - Math.hypot(b.frente.x - pos.x, b.frente.y - pos.y))[0];
  if (falta) { c.push(`¿Ya conoces ${falta.nombre}? Está ${pista(pos, falta.frente)}.`); c.push(`Dicen que en ${falta.distrito} está ${falta.nombre}. Vale la pena el paseo.`); }
  const d = tipoEn(seed, pos.x, pos.y), fr = FRASES[d] || []; if (fr.length) c.push(fr[Math.floor(rnd() * fr.length)], fr[Math.floor(rnd() * fr.length)]);
  c.push(`Bienvenido a ${nombreCiudad(seed)}. Aquí se triunfa con paciencia y buen olfato.`);
  const txt = c[Math.floor(rnd() * c.length)];
  return rnd() < .1 ? { txt: '¡Se te cayó esto! Bueno… mejor dicho, se me cayó a mí. Quédatelo.', moneda: 12 + Math.floor(rnd() * 28) } : { txt };
}
