// Ejecutar: node games/nucleo/tests/vida.test.mjs   (sellos, repartos, chismes)
import assert from 'node:assert/strict';
import { CIUDADES } from '../world/ciudades.js';
import { tile, esSolido, loteDe, LOTE_INICIAL } from '../world/ciudad.js';
import { sellosDe, visita, estadoPasaporte, ofertasReparto, entrega, chisme, direccion, pista, VEL, REP_CUBO, PREMIO_PASAPORTE } from '../world/vida.js';
let n = 0; const ok = (t, f) => { f(); n++; console.log('✓', t); };
ok('direcciones y pistas: ocho rumbos y distancia en cuadras', () => {
  assert.equal(direccion(1, 0), 'este'); assert.equal(direccion(0, 1), 'sur'); assert.equal(direccion(-1, 0), 'oeste'); assert.equal(direccion(0, -1), 'norte'); assert.equal(direccion(1, -1), 'noreste'); assert.equal(direccion(-1, 1), 'suroeste');
  assert.match(pista({ x: 0, y: 0 }, { x: 32, y: 0 }), /2 cuadras al este/); assert.match(pista({ x: 0, y: 0 }, { x: 1, y: 1 }), /1 cuadras/);
});
for (const C of CIUDADES) ok(`${C.nombre}: pasaporte con monumentos alcanzables, ordenados por cercanía`, () => {
  const s = sellosDe(C.seed); assert.ok(s.length >= 5 && s.length <= 8, 'hay sellos: ' + s.length); assert.equal(new Set(s.map(x => x.id)).size, s.length); for (let i = 1; i < s.length; i++) assert.ok(s[i].d >= s[i - 1].d);
  for (const x of s) { assert.ok(x.nombre && x.distrito && x.premio >= 46); assert.ok(!esSolido(tile(C.seed, Math.floor(x.frente.x), Math.floor(x.frente.y))), 'el frente se puede pisar'); assert.equal(visita(x, x.frente.x, x.frente.y), true); assert.equal(visita(x, x.frente.x + 5, x.frente.y), false); }
  assert.deepEqual(sellosDe(C.seed), s, 'determinista'); const e = estadoPasaporte(s, new Set(s.slice(0, 3).map(x => x.id))); assert.equal(e.ok, 3); assert.equal(e.completo, false); assert.equal(estadoPasaporte(s, new Set(s.map(x => x.id))).completo, true);
});
ok('la ciudad clásica no tiene monumentos y el pasaporte queda vacío', () => { assert.deepEqual(sellosDe(7), []); assert.equal(estadoPasaporte([], new Set()).completo, false); assert.ok(PREMIO_PASAPORTE > 0); });
for (const seed of [7, 1000, 1001, 1004, 1005]) ok(`repartos (semilla ${seed}): tres ofertas con riesgo creciente, destinos reales y tiempos justos`, () => {
  const d = { x: 8, y: 22 }, o = ofertasReparto(seed, 3, d); assert.ok(o.length >= 2 && o.length <= 3, 'ofertas: ' + o.length); assert.deepEqual(o, ofertasReparto(seed, 3, d)); assert.notDeepEqual(o.map(x => x.lote), ofertasReparto(seed, 4, d).map(x => x.lote), 'cambian cada tanda');
  for (const x of o) { assert.ok(loteDe(seed, x.lote), 'destino real'); assert.ok(!esSolido(tile(seed, Math.floor(x.frente.x), Math.floor(x.frente.y)))); assert.ok(x.limite > x.dist / VEL, 'se puede llegar: ' + x.limite + ' vs ' + (x.dist / VEL).toFixed(1)); assert.ok(x.limite < x.dist / VEL * 1.7 + 14, 'pero apretado'); assert.ok(x.pago >= 40); }
  for (let i = 1; i < o.length; i++) assert.ok(o[i].dist >= o[i - 1].dist, 'más lejos, más distancia'); assert.ok(o.at(-1).pago > o[0].pago, 'la oferta lejana paga más que la cercana'); assert.equal(new Set(o.map(x => x.lote)).size, o.length);
  const ids = new Set(); for (let c = 0; c < 20; c++) for (const x of ofertasReparto(seed, c, d)) ids.add(x.lote); assert.ok(ids.size > 12, 'hay variedad de destinos: ' + ids.size); assert.ok(REP_CUBO > 20);
});
ok('entrega: la propina premia sobrar tiempo y las tandas seguidas suben el pago (con tope)', () => {
  const of = { pago: 100, limite: 40 }; const t0 = entrega(of, 0, 0), t1 = entrega(of, 40, 0), t2 = entrega(of, 40, 3), t3 = entrega(of, 40, 99);
  assert.equal(t0.total, 100); assert.equal(t1.total, 160); assert.equal(t1.rapido, true); assert.equal(t0.rapido, false); assert.equal(t2.total, Math.round(160 * 1.3)); assert.equal(t3.total, Math.round(160 * 1.5), 'tope +50%'); assert.equal(entrega(of, -5, 0).total, 100, 'sin tiempo no hay propina negativa'); assert.ok(t1.xp > 0);
});
ok('chismes: usan datos reales del mundo, cambian con el distrito y a veces regalan una moneda', () => {
  const M = { mercado: { eventos: [{ n: 'Festival', barrio: 'Centro', estado: 'proximo', inicia: 4, quedan: 20 }] }, subastas: [{ ciudad: true, lote: '1,0,00', quedan: 5 }], noticias: [{ txt: 'Doña Chela abrió un restaurante.' }], jugadores: [{ nombre: 'Grupo Vórtice', apuros: true, retirado: false }] };
  const s = sellosDe(1000), base = { seed: 1000, mundo: M, pos: { x: 8, y: 22 }, sellos: s, hechos: new Set() }; const dichos = new Set(); let monedas = 0;
  for (let i = 0; i < 400; i++) { let k = 0; const r = chisme({ ...base, rnd: () => ((k = (k * 16807 + 12345 + i) % 2147483647) / 2147483647) }); assert.ok(r.txt.length > 10); dichos.add(r.txt.replace(/\d+/g, 'N')); if (r.moneda) { monedas++; assert.ok(r.moneda >= 12 && r.moneda < 40); } }
  const todo = [...dichos].join(' | '); assert.match(todo, /festival en Centro: empieza en N turnos/); assert.match(todo, /subastando el lote N,N,N/); assert.match(todo, /oña Chela/); assert.match(todo, /Vórtice anda ahogado/); assert.match(todo, /¿Ya conoces .+\? Está a unas N cuadras al /); assert.ok(s.some(x => todo.includes(x.nombre)), 'nombra un monumento real'); assert.ok(dichos.size > 8, 'variedad: ' + dichos.size); assert.ok(monedas > 5 && monedas < 120, 'monedas ocasionales: ' + monedas);
  assert.ok(chisme({ seed: 7, mundo: null, pos: { x: 0, y: 0 }, rnd: () => .5 }).txt.length > 10, 'funciona sin mundo ni sellos');
});
console.log(`\n${n} pruebas OK`);
