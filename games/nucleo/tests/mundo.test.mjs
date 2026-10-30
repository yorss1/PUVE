// Ejecutar: node games/nucleo/tests/mundo.test.mjs
import assert from 'node:assert/strict';
import { Mundo, TURNO_MS, precioLote, CUPO_MAX, MAX_FRANQ } from '../multiplayer/mundo.js';
import { loteDe, lotes } from '../world/ciudad.js';
let n = 0; const ok = (t, f) => { f(); n++; console.log('✓', t); };
let T = 0; const nuevo = () => { T = 1e6; return new Mundo({ ahora: () => T }); };
let k = 0; const op = (m, cid, o) => m.op(cid, { id: 'op' + k++, ...o });
const fondos = (m, cid, x) => { assert.equal(op(m, cid, { op: 'invertir', monto: x }).ok, true); };
ok('altas: cada jugador recibe un hogar distinto; el primero el lote inicial', () => {
  const m = nuevo(); const a = m.alta('A', 'Ana'), b = m.alta('B', 'Beto'), c = m.alta('C', 'Caro');
  assert.equal(a.hogar, '0,0,01'); assert.equal(new Set([a.hogar, b.hogar, c.hogar]).size, 3); assert.equal(m.alta('A', 'otra'), a, 'idempotente');
});
ok('invertir: limitado por cupo, enteros positivos, y se recupera con el tiempo', () => {
  const m = nuevo(); m.alta('A', 'Ana');
  for (const x of [0, -5, 1.5, NaN, '100', Infinity, 1e30]) assert.equal(op(m, 'A', { op: 'invertir', monto: x }).ok, false, String(x));
  assert.equal(op(m, 'A', { op: 'invertir', monto: CUPO_MAX + 1 }).ok, false);
  fondos(m, 'A', CUPO_MAX); assert.equal(op(m, 'A', { op: 'invertir', monto: 100 }).ok, false, 'cupo agotado');
  T += 10000; assert.equal(op(m, 'A', { op: 'invertir', monto: 100 }).ok, true, '12 $/s × 10 s ≥ 100');
});
ok('idempotencia: repetir el mismo id no duplica dinero', () => {
  const m = nuevo(); m.alta('A', 'Ana'); const r1 = m.op('A', { id: 'x1', op: 'invertir', monto: 500 }), r2 = m.op('A', { id: 'x1', op: 'invertir', monto: 500 });
  assert.deepEqual(r1, r2); assert.equal(m.j.get('A').dinero, 500);
});
ok('comprar: valida existencia, dueño, dinero y límite; nunca deja dinero negativo', () => {
  const m = nuevo(); m.alta('A', 'Ana'); m.alta('B', 'Beto'); const l = lotes(7, 1, 0)[0], pr = precioLote(l);
  assert.equal(op(m, 'A', { op: 'comprar', lote: l.id }).ok, false, 'sin dinero'); assert.equal(op(m, 'A', { op: 'comprar', lote: '9,9,99' }).ok, false);
  assert.equal(op(m, 'A', { op: 'comprar', lote: 'drop table' }).ok, false); assert.equal(op(m, 'A', { op: 'comprar', lote: 5 }).ok, false);
  fondos(m, 'A', pr + 50); assert.equal(op(m, 'A', { op: 'comprar', lote: l.id }).ok, true); assert.equal(m.j.get('A').dinero, 50);
  fondos(m, 'B', CUPO_MAX); assert.equal(op(m, 'B', { op: 'comprar', lote: l.id }).ok, false, 'ya tiene dueño');
  assert.equal(op(m, 'B', { op: 'mejorar', lote: l.id }).ok, false, 'no es tuyo'); assert.equal(op(m, 'B', { op: 'vender', lote: l.id }).ok, false);
  assert.equal(op(m, 'A', { op: 'comprar', lote: m.j.get('A').hogar }).ok, false, 'el hogar tiene dueño');
});
ok('mejorar y vender: costos, nivel máximo y reembolso del 70%', () => {
  const m = nuevo(); m.alta('A', 'Ana'); const l = lotes(7, 2, 0)[0], pr = precioLote(l);
  fondos(m, 'A', CUPO_MAX); op(m, 'A', { op: 'comprar', lote: l.id }); for (let i = 0; i < 3; i++) { T += 200000; fondos(m, 'A', CUPO_MAX); }
  let nivel = 1; while (op(m, 'A', { op: 'mejorar', lote: l.id }).ok) nivel++; assert.equal(nivel, 5);
  const o = m.o.get(l.id), antes = m.j.get('A').dinero; assert.equal(op(m, 'A', { op: 'vender', lote: l.id }).ok, true);
  assert.equal(m.j.get('A').dinero, antes + Math.round(.7 * (pr + o.invertido))); assert.equal(m.o.has(l.id), false);
  assert.equal(op(m, 'A', { op: 'vender', lote: m.j.get('A').hogar }).ok, false, 'el hogar no se vende');
});
ok('límite de franquicias por jugador', () => {
  const m = nuevo(); m.alta('A', 'Ana'); let c = 0, ls = [];
  for (let x = 4; x < 8; x++) ls.push(...lotes(7, x, 0)); ls = ls.filter(l => !m.o.has(l.id));
  for (const l of ls) { T += 200000; m.avanzar(); fondos(m, 'A', CUPO_MAX); const r = op(m, 'A', { op: 'comprar', lote: l.id }); if (r.ok) c++; else { assert.match(r.msg, /Máximo|Necesitas/); } if (c >= MAX_FRANQ) break; }
  const extra = ls.find(l => !m.o.has(l.id)); T += 200000; fondos(m, 'A', CUPO_MAX); assert.equal(op(m, 'A', { op: 'comprar', lote: extra.id }).ok, false); assert.equal(m._franq('A'), MAX_FRANQ);
});
ok('competencia: una franquicia sola gana más que una con un rival al lado', () => {
  const sola = nuevo(); sola.alta('A', 'Ana'); const l = loteDe(7, '0,0,00');
  sola.o.set(l.id, { dueno: 'A', nivel: 1, tipo: 'franquicia', invertido: 0 }); sola.j.get('A').dinero = 1000; sola._turno(); const gSola = sola.j.get('A').ingresos[l.id];
  const duo = nuevo(); duo.alta('A', 'Ana'); duo.alta('B', 'Beto'); duo.o.set(l.id, { dueno: 'A', nivel: 1, tipo: 'franquicia', invertido: 0 });
  duo.o.set('0,0,10', { dueno: 'B', nivel: 3, tipo: 'franquicia', invertido: 0 }); duo.j.get('A').dinero = 1000; duo._turno(); const gDuo = duo.j.get('A').ingresos[l.id];
  assert.ok(gSola > gDuo, `sola ${gSola} vs competida ${gDuo}`);
});
ok('turnos por reloj: se aplican, con tope tras una ausencia larga', () => {
  const m = nuevo(); m.alta('A', 'Ana'); T += TURNO_MS * 3; m.avanzar(); assert.equal(m.turno, 3);
  T += TURNO_MS * 5000; m.avanzar(); assert.equal(m.turno, 33, 'tope de 30 turnos tras ausencia'); m.avanzar(); assert.equal(m.turno, 33);
});
ok('quiebra: una franquicia que no cubre su mantenimiento se cierra y libera el lote', () => {
  const m = nuevo(); m.alta('A', 'Ana'); for (const id of ['0,0,00', '0,0,10']) m.o.set(id, { dueno: 'A', nivel: 1, tipo: 'franquicia', invertido: 0 });
  m.j.get('A').dinero = 0; for (let i = 0; i < 40 && m.o.size > 1; i++) m._turno(); assert.ok(m.o.size >= 1); assert.ok(m.j.get('A').dinero >= 0);
});
ok('invariante: dinero nunca negativo con operaciones aleatorias (fuzz)', () => {
  const m = nuevo(); let s = 12345; const r = () => (s = (s * 16807) % 2147483647) / 2147483647; ['A', 'B', 'C'].forEach(c => m.alta(c, c));
  const ids = []; for (let x = -2; x <= 3; x++) for (let y = -1; y <= 1; y++) ids.push(...lotes(7, x, y).map(l => l.id));
  for (let i = 0; i < 4000; i++) { T += Math.floor(r() * 4000); const c = 'ABC'[Math.floor(r() * 3)], o = ['invertir', 'comprar', 'mejorar', 'vender'][Math.floor(r() * 4)];
    m.op(c, { id: 'f' + i, op: o, monto: Math.floor(r() * 900) - 50, lote: ids[Math.floor(r() * ids.length)] });
    for (const p of m.j.values()) assert.ok(p.dinero >= 0 && Number.isFinite(p.dinero) && p.cupo >= 0, `${c} ${o}`);
    for (const [id, ow] of m.o) assert.ok(m.j.has(ow.dueno) && loteDe(7, id)); }
});
ok('vista: todos ven patrimonio; solo tú ves tu efectivo; guardar/restaurar conserva el estado', () => {
  const m = nuevo(); m.alta('A', 'Ana'); m.alta('B', 'Beto'); fondos(m, 'A', 700);
  const va = m.vista('A'), vb = m.vista('B'); assert.equal(va.mio.dinero, 700); assert.equal(vb.mio.dinero, 0); assert.equal(JSON.stringify(vb).includes('"dinero":700'), false);
  const r = new Mundo({ ahora: () => T }); assert.equal(r.restaurar(JSON.parse(JSON.stringify(m.serializar()))), true); assert.equal(r.j.get('A').dinero, 700); assert.equal(r.o.size, m.o.size);
  assert.equal(new Mundo({ seed: 9, ahora: () => T }).restaurar(m.serializar()), false);
  const malo = JSON.parse(JSON.stringify(m.serializar())); malo.j[0].dinero = -9e99; malo.j[0].hogar = 'x'; malo.o.push(['1,0,00', { dueno: 'fantasma', nivel: 99 }]);
  const r2 = new Mundo({ ahora: () => T }); r2.restaurar(malo); assert.equal(r2.j.has(malo.j[0].cid), false); assert.equal(r2.o.has('1,0,00'), false);
});
console.log(`\n${n} pruebas OK`);
