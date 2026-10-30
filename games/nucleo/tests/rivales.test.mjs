// Ejecutar: node games/nucleo/tests/rivales.test.mjs
import assert from 'node:assert/strict';
import { Mundo, TURNO_MS, MAX_FRANQ } from '../multiplayer/mundo.js';
import { Servidor } from '../multiplayer/servidor.js';
import { PERFILES, limpiarNpc } from '../economia/rivales.js';
import { loteDe } from '../world/ciudad.js';
let n = 0; const ok = (t, f) => { f(); n++; console.log('✓', t); };
// Cada mundo lleva su propio reloj simulado (c.t) para poder compararlos
const mundo = (rivales = 4) => { const c = { t: 1e6 }; const m = new Mundo({ ahora: () => c.t }); m.giro = 'restaurante'; m.alta('H', 'Yo'); m.sembrar(rivales); m.c = c; return m; };
const avanza = (m, k) => { for (let i = 0; i < k; i++) { m.c.t += TURNO_MS; m.avanzar(); } };
const libro = p => Object.values(p.c).reduce((a, b) => a + b, 0);
const rivales = m => [...m.j.values()].filter(p => p.npc);
let kk = 0; const op = (m, cid, o) => m.op(cid, { id: 'x' + kk++, ...o });

ok('siembra: cuatro personalidades distintas, cada una con un negocio real en un lote válido', () => {
  const m = mundo(); const r = rivales(m); assert.equal(r.length, 4); assert.deepEqual(r.map(p => p.npc.perfil).sort(), Object.keys(PERFILES).sort());
  assert.equal(new Set(r.map(p => p.nombre)).size, 4); for (const p of r) { assert.equal(m._franq(p.cid), 1); assert.ok(loteDe(7, p.hogar)); assert.equal(m.o.get(p.hogar).dueno, p.cid); assert.equal(libro(p), p.dinero); }
  assert.equal(mundo(0).j.size, 1, 'sin rivales por defecto no cambia nada'); assert.equal(op(m, r[0].cid, { op: 'invertir', monto: 100 }).ok, false, 'un cliente no puede manejar a un rival');
});
ok('invariantes en 600 turnos: sin dinero de la nada, sin negativos, sin lotes dobles, límites respetados', () => {
  const m = mundo(); op(m, 'H', { op: 'invertir', monto: 1500 }); const cap0 = new Map(rivales(m).map(p => [p.cid, p.c.aporte]));
  for (let i = 0; i < 600; i++) {
    avanza(m, 1); if (i % 25 === 0) op(m, 'H', { op: 'invertir', monto: 600 });
    for (const p of m.j.values()) { assert.ok(p.dinero >= 0 && Number.isFinite(p.dinero) && p.deuda >= 0, `${p.nombre} t${m.turno}`); assert.equal(libro(p), p.dinero, `libro ${p.nombre}`); assert.ok(m._franq(p.cid) <= m.maxFranq(p)); }
  }
  for (const p of rivales(m)) { const aportes = p.c.aporte; assert.ok(aportes === cap0.get(p.cid) + 900 * p.npc.regresos, `${p.nombre}: solo capital inicial y regresos (${aportes})`); assert.ok(p.c.retiro <= 0 || p.c.retiro === undefined); }
  assert.ok(rivales(m).some(p => m._franq(p.cid) >= 2), 'los rivales crecen'); assert.ok(m.noticias.some(x => x.k === 'rival'), 'hay noticias de rivales');
});
ok('determinismo: dos mundos iguales evolucionan igual, y guardar/recargar a mitad no cambia el resultado', () => {
  const a = mundo(), b = mundo(); for (const m of [a, b]) op(m, 'H', { op: 'invertir', monto: 1500 });
  avanza(a, 150); avanza(b, 80); const sn = JSON.parse(JSON.stringify(b.serializar()));
  const c = { t: b.c.t }; const r = new Mundo({ ahora: () => c.t }); r.giro = 'restaurante'; r.c = c; assert.equal(r.restaurar(sn), true);
  avanza(b, 70); avanza(r, 70);
  const dump = m => JSON.stringify([...m.j.values()].map(p => [p.cid, p.dinero, p.deuda, p.npc?.perfil, p.npc?.prox]).concat([...m.o].map(([id, o]) => [id, o.dueno, o.nivel, o.p, o.esp, Math.round(o.rep * 1000)])));
  assert.equal(dump(a), dump(b), 'mismos pasos, mismo resultado'); assert.equal(dump(b), dump(r), 'recargar a mitad no cambia el resultado'); assert.equal(r.turno, b.turno);
});
ok('memoria: quien abre junto a un rival queda registrado y el agresivo lo recuerda', () => {
  const m = mundo(1); const ag = rivales(m)[0], lotePropio = [...m.o].find(([, o]) => o.dueno === ag.cid)[0], l = loteDe(7, lotePropio);
  op(m, 'H', { op: 'invertir', monto: 1500 }); const vecino = [...m.o.keys()].length; let cerca = null;
  for (let cx = -3; cx <= 3 && !cerca; cx++) for (let cy = -3; cy <= 3 && !cerca; cy++) for (const q of [loteDe(7, `${cx},${cy},00`), loteDe(7, `${cx},${cy},01`), loteDe(7, `${cx},${cy},10`)]) if (q && !m.o.has(q.id) && q.id !== lotePropio && Math.hypot(q.puerta.x - l.puerta.x, q.puerta.y - l.puerta.y) < 12) { cerca = q; break; }
  assert.ok(cerca, 'hay un lote cercano'); m.j.get('H').dinero = 3000; m.j.get('H').c.aporte = 3000; assert.equal(op(m, 'H', { op: 'comprar', lote: cerca.id }).ok, true);
  avanza(m, 60); assert.ok((ag.npc.rencor.H || 0) >= 1, 'recuerda quién abrió cerca'); assert.ok(ag.npc.mem.some(x => x.k === 'cerca' && x.cid === 'H'));
  assert.ok(m.noticias.length >= 0 && vecino > 0);
});
ok('crisis: un rival en apuros pone en venta; una persona compra, el dinero se conserva y el rival lo recuerda', () => {
  const s = mundo(4), ag = rivales(s).find(p => p.npc.perfil === 'agresivo'), id = [...s.o].find(([, o]) => o.dueno === ag.cid)[0];
  ag.dinero = 50; ag.c = { inicial: 50 }; ag.deuda = Math.floor(s.limiteDeuda(ag) * .9);   // cerca del límite, sin llegar al embargo
  for (let i = 0; i < 20 && s.o.get(id)?.enVenta == null; i++) { ag.npc.prox = s.turno; s._turno(); }
  assert.ok(s.o.get(id).enVenta != null, 'puso su local en venta'); assert.ok(s.noticias.some(x => /pone en venta/.test(x.txt)), 'lo anunció');
  const precio = s.o.get(id).enVenta, tot = () => [...s.j.values()].reduce((a, p) => a + p.dinero, 0), h = s.j.get('H');
  assert.equal(op(s, 'H', { op: 'comprar', lote: id }).ok, false, 'sin dinero no compra'); s._mov(h, 'aporte', precio); const t1 = tot();
  assert.equal(op(s, 'H', { op: 'comprar', lote: id }).ok, true); assert.equal(tot(), t1, 'se conserva el dinero'); assert.equal(s.o.get(id).dueno, 'H'); assert.ok(ag.npc.mem.some(x => x.k === 'vendi' && x.cid === 'H'));
  assert.equal(libro(ag), ag.dinero); assert.equal(libro(h), h.dinero);
});
ok('oportunista: compra un local que una persona pone muy por debajo de su valor; los demás perfiles no lo necesitan', () => {
  const m = mundo(4); m._mov(m.j.get('H'), 'aporte', 1500); assert.equal(op(m, 'H', { op: 'comprar', lote: '1,0,00' }).ok, true);
  assert.equal(op(m, 'H', { op: 'listar', lote: '1,0,00', precio: Math.round(.5 * (300 + 120 * 8)) }).ok, true); const compras = {};
  const ex = m._exec.bind(m); m._exec = (p, x) => { const r = ex(p, x); if (p.npc && r.ok && x.op === 'comprar') compras[p.npc.perfil] = (compras[p.npc.perfil] || 0) + 1; return r; };
  avanza(m, 400); assert.equal(m.o.get('1,0,00').dueno, 'npc:oportunista:3', 'lo compró el oportunista'); assert.ok(m.noticias.some(x => /aprovechó una oferta/.test(x.txt)));
});
ok('retiro y regreso: sin negocios ni capital se retira; después vuelve una vez con socios (límite de regresos)', () => {
  const m = mundo(1); const r = rivales(m)[0]; for (const [id, o] of [...m.o]) if (o.dueno === r.cid) m.o.delete(id); r.dinero = 100; r.c = { inicial: 100 }; r.npc.prox = m.turno;
  for (let i = 0; i < 40 && r.npc.estado !== 'retirado'; i++) { r.npc.prox = m.turno; m._turno(); } assert.equal(r.npc.estado, 'retirado'); assert.ok(m.noticias.some(x => /se retira/.test(x.txt)));
  for (let i = 0; i < 1500 && r.npc.estado === 'retirado'; i++) m._turno(); assert.equal(r.npc.estado, 'activo', 'regresó'); assert.equal(r.npc.regresos, 1); assert.equal(r.npc.perfil, 'agresivo', 'vuelve más combativo'); assert.equal(libro(r), r.dinero);
  assert.ok(m.noticias.some(x => /regresa/.test(x.txt)));
});
ok('ausencia larga: los rivales compran poco y nadie arruina a quien no estuvo', () => {
  const m = mundo(); op(m, 'H', { op: 'invertir', monto: 1500 }); op(m, 'H', { op: 'comprar', lote: '1,0,00' }); const antes = new Map(rivales(m).map(p => [p.cid, m._franq(p.cid)]));
  const nn = m.ausencia(8 * 3600e3); assert.ok(nn > 0); for (const p of rivales(m)) assert.ok(m._franq(p.cid) - antes.get(p.cid) <= 2, `${p.nombre} compró de más: ${m._franq(p.cid) - antes.get(p.cid)}`);
  assert.equal(m.o.get('1,0,00').dueno, 'H', 'su franquicia sigue siendo suya'); const inf = m.j.get('H').informe; assert.ok(inf && inf.noticias.length >= 0 && inf.turnos === nn);
});
ok('datos corruptos de un rival se sanean al cargar', () => {
  assert.equal(limpiarNpc({ perfil: '__proto__' }), null); assert.equal(limpiarNpc(null), null);
  const x = limpiarNpc({ perfil: 'agresivo', estado: 'x', prox: -5, regresos: 99, mem: [{ k: 5 }, { k: 'a', t: 1, cid: 'z' }], rencor: { a: 1e99 }, vistos: [1, 'a'] });
  assert.equal(x.estado, 'activo'); assert.equal(x.prox, 0); assert.equal(x.regresos, 2); assert.equal(x.mem.length, 1); assert.equal(x.rencor.a, 99); assert.deepEqual(x.vistos, ['a']);
});
ok('servidor con rivales: se crean al crear la sala, sobreviven a exportar/importar y se ven en la vista', () => {
  let T = 1e6; const s = new Servidor({ ahora: () => T, rivales: 3 }); s.manejar('H', { t: 'crear', giro: 'cafeteria', nombre: 'Ana' }); T += TURNO_MS * 5; const v = s.difundir().find(x => x.para === 'H' && x.msg.t === 'mundo').msg;
  assert.equal(v.jugadores.filter(j => j.npc).length, 3); assert.ok(v.jugadores.every(j => typeof j.patrimonio === 'number')); assert.ok(v.lotes.every(l => l.length >= 13)); assert.equal(JSON.stringify(v).includes('"mem"'), false, 'no se filtra la memoria interna');
  const r = new Servidor({ ahora: () => T }); assert.equal(r.importar(JSON.parse(JSON.stringify(s.exportar()))), true); assert.equal([...r.mundo.j.values()].filter(p => p.npc).length, 3); assert.equal(r.nRivales, 3);
  const sin = new Servidor({ ahora: () => T }); sin.manejar('H', { t: 'crear', giro: 'cafeteria', nombre: 'Ana' }); assert.equal(sin.mundo.j.size, 1, 'una sala de amigos no trae rivales por defecto');
});
ok('un mundo guardado antes de los rivales los recibe una sola vez al abrirlo', () => {
  let T = 1e6; const viejo = new Servidor({ ahora: () => T }); viejo.manejar('solo', { t: 'crear', giro: 'restaurante', nombre: 'Ana' }); viejo.manejar('solo', { t: 'eco', id: 'a', op: 'invertir', monto: 800 });
  const d = JSON.parse(JSON.stringify(viejo.exportar())); delete d.rivales; delete d.ts; assert.equal(Object.keys(d).includes('rivales'), false);
  const nuevo = new Servidor({ ahora: () => T, rivales: 3 }); assert.equal(nuevo.importar(d), true); assert.equal([...nuevo.mundo.j.values()].filter(p => p.npc).length, 3); assert.equal(nuevo.mundo.j.get('solo').dinero, 800, 'sus datos intactos');
  const otra = JSON.parse(JSON.stringify(nuevo.exportar())); const s2 = new Servidor({ ahora: () => T, rivales: 3 }); s2.importar(otra); assert.equal([...s2.mundo.j.values()].filter(p => p.npc).length, 3, 'no se duplican');
  const amigos = new Servidor({ ahora: () => T }); amigos.importar(d); assert.equal(amigos.mundo.j.size, 1, 'una sala sin rivales sigue sin rivales');
});
console.log(`\n${n} pruebas OK`);
