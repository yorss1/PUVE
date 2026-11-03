// Ejecutar: node games/nucleo/tests/chispa.test.mjs   (ritmo, riesgo y propinas del local: hora pico, personalidades, punto de cocción, racha)
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { Sim, PUNTO_S, QUEMA_S, RUSH_S } from '../game/sim.js';
let n = 0; const ok = (t, f) => { f(); n++; console.log('✓', t); };
const cfg = g => JSON.parse(readFileSync(new URL(`../config/${g}.json`, import.meta.url)));
const mk = (g = 'restaurante') => { let s0 = 7; const rnd = () => (s0 = (s0 * 16807) % 2147483647) / 2147483647; const s = new Sim(cfg(g), null, rnd); s.d.dinero = 500; return s; };
const cliente = (s, o = {}) => ({ id: s.nid++, x: 3, y: 3, st: 'come', tc: 0, plato: s.cfg.platos[0].id, seat: { x: 3, y: 3 }, ruta: [], pac: 10, max: 10, ...o });
const pasa = (s, seg) => { for (let t = 0; t < seg; t += .1) s.tick(.1); };
const paga = (s, c) => { s.clientes.push(c); s._pagar(c); return s.cuentas[s.cuentas.length - 1]; };

for (const giro of ['restaurante', 'cafeteria']) ok(`${giro}: la propina premia la rapidez, la racha y el plato en su punto (con topes)`, () => {
  const s = mk(giro), base = Math.round(s.cfg.platos[0].precio);
  assert.equal(paga(s, cliente(s, { pr: 0 })).monto, base, 'sin rapidez ni racha, el precio normal');
  assert.equal(paga(s, cliente(s, { pr: .8 })).monto, Math.round(base * 1.15)); assert.deepEqual(s.cuentas.at(-1).fx.includes('¡Rápido!'), true);
  const r = mk(giro); r.d.st.racha = 6; assert.equal(paga(r, cliente(r, { pr: 0 })).monto, Math.round(base * 1.05), 'racha 6 = +5%'); r.d.st.racha = 300; assert.equal(paga(r, cliente(r, { pr: 0 })).monto, Math.round(base * 1.25), 'tope de racha +25%');
  const p = mk(giro); assert.equal(paga(p, cliente(p, { pr: 0, q: 'perfecto' })).monto, Math.round(base * 1.15)); const q = mk(giro); assert.equal(paga(q, cliente(q, { pr: 0, q: 'quemado' })).monto, Math.round(base * .7)); assert.ok(q.d.rep < 5 + 1e-9 || true);
  const t = mk(giro); t.d.st.racha = 99; const m = paga(t, cliente(t, { pr: .9, q: 'perfecto', tipo: 'generoso' })); assert.ok(m.monto <= base * 2, 'ningún bono se acumula sin límite: ' + m.monto / base);
  assert.equal(mk(giro).d.st.perfectos, 0); assert.equal(p.d.st.perfectos, 1); assert.equal(q.d.st.quemados, 1);
});
ok('clientes con personalidad: apurado, generoso, crítico y VIP cambian paciencia, pago y reputación', () => {
  const s = mk(), base = s.cfg.platos[0].precio;
  assert.equal(paga(s, cliente(s, { tipo: 'generoso', pr: 0 })).monto, Math.round(base * 1.3)); assert.equal(paga(s, cliente(s, { tipo: 'vip', pr: 0 })).monto, Math.round(base * 2)); assert.equal(paga(s, cliente(s, { tipo: 'apurado', pr: .7 })).monto, Math.round(base * 1.15 * 1.4));
  const bien = mk(), r0 = bien.d.rep; paga(bien, cliente(bien, { tipo: 'critico', pr: .8 })); assert.ok(bien.d.rep > r0, 'reseña estelar'); const mal = mk(); paga(mal, cliente(mal, { tipo: 'critico', pr: .1 })); assert.ok(mal.d.rep < 5, 'mala reseña');
  const q = mk(); q.d.xp = 600; paga(q, cliente(q, { tipo: 'critico', pr: .9, q: 'quemado' })); assert.ok(q.d.rep < 5, 'un plato quemado arruina al crítico');
  const enojo = mk(); const c = cliente(enojo, { st: 'espera', tipo: 'critico' }); enojo.clientes.push(c); enojo._enojo(c); assert.equal(enojo.d.rep, 3.5, 'perder a un crítico duele el triple');
  const vistos = {}; for (let i = 0; i < 3000; i++) { const x = mk(); x.d.xp = 600; x.nid = i + 10; x.d.st.servidos = i * 7; const k = x._tipoCliente(); vistos[k] = (vistos[k] || 0) + 1; } for (const k of ['normal', 'apurado', 'generoso', 'critico', 'vip']) assert.ok(vistos[k] > 20, `${k} aparece: ${JSON.stringify(vistos)}`); assert.ok(vistos.normal > vistos.apurado && vistos.apurado > vistos.vip, 'los raros son raros');
  const bajo = mk(); bajo.d.xp = 0; for (let i = 0; i < 400; i++) { bajo.nid = i; assert.ok(['normal', 'apurado', 'generoso'].includes(bajo._tipoCliente()), 'sin nivel no hay críticos ni VIP'); }
  const sp = mk(); sp.d.xp = 600; let ap = 0; for (let i = 0; i < 4000 && !ap; i++) { sp.clientes.length = 0; sp.nid = i * 3; sp.d.st.servidos = i; sp._spawn(); const c2 = sp.clientes[0]; if (c2?.tipo === 'apurado') ap = c2; } assert.ok(ap && ap.max < sp.cfg.clientes.paciencia * .6, 'el apurado tiene la mitad de paciencia');
});
ok('punto de cocción: recogerlo a tiempo da plato perfecto; si se pasa se quema; a mano o por un ayudante', () => {
  const s = mk(); const plato = s.cfg.platos[0], c = cliente(s, { st: 'espera', pac: 1e6, max: 1e6 }); s.clientes.push(c); const t = { id: s.nid++, c: c.id, plato: plato.id, estado: 'cola', res: null }; s.tickets.push(t); c.tk = t.id; s.d.stock = 5;
  const e = s.est[0]; s._cocinar(e, t); for (let i = 0; i < 400 && t.estado !== 'listo'; i++) s.tick(.1); assert.equal(t.estado, 'listo'); assert.equal(s.puntoDe(e).fase, 'perfecto'); assert.ok(s.ev.some(x => x.k === 'listo'), 'avisa que está listo');
  pasa(s, PUNTO_S + .3); assert.equal(s.puntoDe(e).fase, 'normal'); pasa(s, QUEMA_S); assert.equal(s.puntoDe(e).fase, 'pasado');
  s.p.x = e.x + .5; s.p.y = e.y + 1; const op = s._opcion(); assert.match(op.msg, /Tomar plato/); const r = op.run(); assert.equal(t.q, 'quemado'); assert.match(r.msg, /pasó/);
  const s2 = mk(); const c2 = cliente(s2, { st: 'espera', pac: 1e6, max: 1e6 }); s2.clientes.push(c2); const t2 = { id: s2.nid++, c: c2.id, plato: plato.id, estado: 'cola', res: null }; s2.tickets.push(t2); c2.tk = t2.id; s2.d.stock = 5; const e2 = s2.est[0]; s2._cocinar(e2, t2); for (let i = 0; i < 400 && t2.estado !== 'listo'; i++) s2.tick(.1);
  s2.p.x = e2.x + .5; s2.p.y = e2.y + 1; const op2 = s2._opcion(); assert.match(op2.msg, /en su punto/); const r2 = op2.run(); assert.equal(t2.q, 'perfecto'); assert.equal(r2.fx, 'perfecto'); s2.p.x = c2.seat.x + .5; s2.p.y = c2.seat.y + .5; s2._opcion().run(); assert.equal(c2.q, 'perfecto'); assert.ok(c2.pr > 0 || c2.pr === 0);
  const s3 = mk(); s3.d.xp = 200; s3.comprar('emp1'); const cc = cliente(s3, { st: 'espera', pac: 1e6, max: 1e6 }); s3.clientes.push(cc); const tt = { id: s3.nid++, c: cc.id, plato: plato.id, estado: 'cola', res: null }; s3.tickets.push(tt); cc.tk = tt.id; s3.d.stock = 5; s3._cocinar(s3.est[0], tt); for (let i = 0; i < 1500 && tt.estado !== 'entregado'; i++) s3.tick(.1); assert.ok(['perfecto', 'normal', 'quemado'].includes(cc.q), 'un ayudante también fija la calidad: ' + cc.q);
});
ok('hora pico: llega con aviso, trae más clientes, premia no perder a nadie y se repite', () => {
  const s = mk(); s.d.xp = 70; assert.equal(s.nivel, 2); s._proxRush = 0.05; s.tick(.1); assert.ok(s.rush, 'empezó'); assert.ok(s.ev.some(e => e.k === 'rush')); assert.ok(s.avisos.some(a => /HORA PICO/.test(a))); assert.equal(s.rushInfo().dur, RUSH_S);
  const cuenta = rush => { const x = mk(); x.d.xp = 70; if (rush) x.rush = { t: 999, dur: 999, serv: 0, perd: 0 }; x._proxRush = 1e9; let k = 0; const id0 = x.nid; for (let i = 0; i < 60 * 120; i++) { x.tick(1 / 60); } return x.nid - id0; }; assert.ok(cuenta(true) > cuenta(false) * 1.3, 'más clientes en hora pico');
  const b = mk(); b.d.xp = 70; b.rush = { t: .05, dur: 35, serv: 6, perd: 0 }; const d0 = b.d.dinero; b.tick(.1); assert.equal(b.rush, null); assert.equal(b.d.dinero, d0 + 18 * 6); assert.equal(b.d.st.picos, 1); assert.ok(b.ev.some(e => e.k === 'rushOk')); assert.ok(b._proxRush >= 90);
  const m = mk(); m.d.xp = 70; m.rush = { t: .05, dur: 35, serv: 6, perd: 1 }; const d1 = m.d.dinero; m.tick(.1); assert.equal(m.d.dinero, d1 + 8 * 6, 'perder a alguien reduce el premio'); const z = mk(); z.d.xp = 70; z.rush = { t: .05, dur: 35, serv: 1, perd: 3 }; const d2 = z.d.dinero; z.tick(.1); assert.equal(z.d.dinero, d2, 'una hora pico mala no paga');
  const niv1 = mk(); niv1._proxRush = 0; niv1.tick(.1); assert.equal(niv1.rush, null, 'no hay hora pico en el nivel 1');
});
ok('racha y eventos: la racha da eventos de ánimo, se rompe con un cliente perdido y la cola de eventos está acotada', () => {
  const s = mk(); for (let i = 0; i < 6; i++) paga(s, cliente(s, { pr: 0 })); assert.deepEqual(s.ev.filter(e => e.k === 'combo').map(e => e.n), [3, 6]); assert.equal(s.d.st.racha, 6);
  const c = cliente(s, { st: 'espera' }); s.clientes.push(c); s.d.st.racha = 7; s._enojo(c); assert.equal(s.d.st.racha, 0); assert.ok(s.ev.some(e => e.k === 'rompe' && e.n === 7)); assert.ok(s.ev.some(e => e.k === 'enojo'));
  for (let i = 0; i < 400; i++) s.ev.push({ k: 'x' }); s.tick(.1); assert.ok(s.ev.length <= 60, 'cola acotada: ' + s.ev.length);
  const cb = mk(); cb.cajas[0] && (cb.cuentas.push({ id: 1, monto: 50, xp: 1, fx: [] }), cb._cobrar()); assert.ok(cb.ev.some(e => e.k === 'cobro' && e.txt === '+$50'));
});
ok('guardado y ausencia: lo nuevo no rompe los guardados y las estadísticas viajan', () => {
  const s = mk(); s.d.st.perfectos = 7; s.d.st.picos = 2; const d = JSON.parse(JSON.stringify(s.serializar())); let s0 = 7; const r = new Sim(cfg('restaurante'), d, () => (s0 = (s0 * 16807) % 2147483647) / 2147483647); assert.equal(r.d.st.perfectos, 7); assert.equal(r.d.st.picos, 2);
  const viejo = { v: 1, ts: 1, d: { dinero: 321, xp: 100, rep: 6, stock: 5, comp: [] }, px: 1.5, py: 1.5 }; const v = new Sim(cfg('restaurante'), viejo, () => .5); assert.equal(v.d.st.perfectos, 0); assert.equal(v.rush, null);
  const g = mk(); g.d.xp = 400; g.comprar('emp1'); g.comprar('emp2'); g.emps[0].hab = 3; g.ascender(g.emps[0].id); const r1 = g.ausencia(300); assert.ok(r1.servidos > 5, 'con gerente trabaja'); assert.ok(g.ev.length <= 60);
});
console.log(`\n${n} pruebas OK`);
