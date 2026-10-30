// Ejecutar: node games/nucleo/tests/fase2.test.mjs   (mecánicas del local de la Fase 2 + progresión)
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { Sim, espera } from '../game/sim.js';
import { jugar } from '../herramientas/equilibrio.mjs';
import { limpiarPartida } from '../persistence/contrato.js';
import { etapaActual, misionesActivas, reclamar, evaluarLogros, limpiarProg, MISIONES, LOGROS, desbloqueado, SEMANA_S } from '../economia/progresion.js';
const cargar = g => JSON.parse(readFileSync(new URL(`../config/${g}.json`, import.meta.url)));
let n = 0; const ok = (t, f) => { f(); n++; console.log('✓', t); };
const seed = () => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
const sim = (g = 'restaurante', save = null) => new Sim(cargar(g), save, seed());
const conAyudante = () => { const s = sim(); s.d.dinero = 2000; s.d.xp = 200; assert.ok(s.comprar('emp1').ok); return s; };

for (const giro of ['restaurante', 'cafeteria']) {
  ok(`${giro}: proveedores y mercado cambian el costo de surtir; sin cambios queda igual que antes`, () => {
    const s = sim(giro), base = s.cfg.ing * 5; assert.equal(s.costoSurtir(), base);
    s.cambiarProv('mayorista'); assert.ok(s.costoSurtir() < base); s.cambiarProv('premium'); assert.ok(s.costoSurtir() > base); assert.equal(s.cambiarProv('__proto__').ok, false);
    s.cambiarProv('mercado'); s.mercado = { dem: 1, ing: 1.35 }; assert.ok(s.costoSurtir() > base, 'la escasez encarece');
  });
}
ok('demanda del mercado: con festival llegan más clientes, con obras menos', () => {
  const cuenta = dem => { const s = sim(); s.mercado = { dem, ing: 1 }; let c = 0; const ant = s.nid; for (let i = 0; i < 60 * 200; i++) { s.tick(1 / 60); s.clientes.forEach(x => { s.d.rep = 5; }); } return s.nid - ant; };
  const base = cuenta(1), fest = cuenta(1.6), obras = cuenta(.6); assert.ok(fest > base && base > obras, `${fest} > ${base} > ${obras}`);
});
ok('estadísticas: servidos, racha, mejor racha y pérdidas se cuentan; una semana sin apuros se completa', () => {
  const s = sim(); const c = { id: 1, plato: s.cfg.platos[0].id, st: 'come', tc: 0, seat: { x: 1, y: 1 }, x: 1, y: 1, ruta: [] }; s.clientes.push(c); s._pagar(c); s._pagar({ ...c, id: 2 }); assert.equal(s.d.st.servidos, 2); assert.equal(s.d.st.racha, 2);
  s._enojo({ id: 3, st: 'espera', tk: null, x: 1, y: 1, ruta: [] }); assert.equal(s.d.st.racha, 0); assert.equal(s.d.st.mejor, 2); assert.equal(s.d.st.perdidos, 1);
  const w = sim(); w.d.dinero = 5000; for (let i = 0; i < SEMANA_S * 10 + 20; i++) w.tick(.1); assert.equal(w.d.st.semanas, 1); assert.equal(w.d.st.apuros, 0);
  const a = sim(); a.d.dinero = 0; a.d.stock = 0; for (let i = 0; i < 400; i++) a.tick(.1); assert.ok(a.d.st.apuros >= 1, 'sin efectivo ni ingredientes es un apuro'); assert.equal(a.d.st.semana < 60, true);
});
ok('empleados: tienen atributos, cobran sueldo, se molestan si les pagas poco y renuncian', () => {
  const s = conAyudante(), e = s.emps[0]; assert.ok(e.n && e.hab >= 1 && e.hab <= 5 && e.sat === 70 && e.sueldo === espera(e.hab));
  const d0 = s.d.dinero; s._nomina(); assert.equal(s.d.dinero, d0 - e.sueldo); e.sueldo = 1; for (let i = 0; i < 40 && s.emps.length; i++) s._nomina(); assert.equal(s.emps.length, 0, 'renunció'); assert.equal(s.d.comp.includes('emp1'), false, 'la plaza queda libre');
  assert.ok(s.avisos.some(a => /renunció/.test(a))); s.d.dinero = 1000; assert.equal(s.comprar('emp1').ok, true, 'se puede contratar a otro');
  const p = conAyudante(); p.d.dinero = 0; for (let i = 0; i < 8 && p.emps.length; i++) p._nomina(); assert.equal(p.emps.length, 0, 'sin pagar también se van'); assert.ok(p.d.dinero >= 0);
});
ok('empleados: capacitar, subir sueldo, experiencia y ascenso a gerente con costos validados', () => {
  const s = conAyudante(), e = s.emps[0]; e.hab = 2; s.d.dinero = 500; const d0 = s.d.dinero; assert.equal(s.capacitar(e.id).ok, true); assert.equal(e.hab, 3); assert.equal(s.d.dinero, d0 - 100);
  assert.ok(e.sueldo < espera(e.hab), 'ahora está subpagado'); const sat = e.sat; s._nomina(); assert.ok(e.sat < sat); while (e.sueldo < espera(e.hab)) s.subirSueldo(e.id); s._nomina(); assert.ok(e.sat > 0);
  e.hab = 5; assert.equal(s.capacitar(e.id).ok, false); e.hab = 2; assert.equal(s.ascender(e.id).ok, false, 'necesita habilidad 3'); e.hab = 3; s.d.dinero = 50; assert.equal(s.ascender(e.id).ok, false); s.d.dinero = 500; assert.equal(s.ascender(e.id).ok, true);
  assert.equal(s.gerente, e); assert.equal(e.sueldo, Math.round(espera(3) * 1.6)); assert.equal(s.ascender(e.id).ok, false, 'ya hay gerente'); assert.equal(s.capacitar(999).ok, false);
  const x = conAyudante(), y = x.emps[0]; y.hab = 1; y.exp = 19; x._exp(y); assert.equal(y.hab, 2); assert.ok(x.avisos.some(a => /mejoró/.test(a)));
});
ok('gerente: toma pedidos y cobra solo (y sin gerente ni ayudantes nadie lo hace)', () => {
  const montar = conGer => {
    const s = sim(); s.d.dinero = 500; s.d.xp = 200; if (conGer) { s.comprar('emp1'); s.emps[0].hab = 3; assert.ok(s.ascender(s.emps[0].id).ok); s.emps[0].x = 99; s.emps[0].y = 99; s.emps.length = 1; s.est.forEach(e => { e.res = null; }); }
    s.t = 100; s.cuentas.push({ id: 7, monto: 40, xp: 1 }); s.d.stock = 10; const d0 = s.d.dinero;
    s.clientes.push({ id: 5, x: 3, y: 3, st: 'pide', pac: 3, max: 10, plato: s.cfg.platos[0].id, seat: { x: 3, y: 3 }, tk: null, ruta: [], tc: 0 });
    s._sistema(.1); return { s, d0 };
  };
  const { s, d0 } = montar(true); assert.equal(s.clientes[0].st, 'espera', 'tomó el pedido'); assert.equal(s.tickets.length, 1); assert.equal(s.cuentas.length, 0, 'cobró'); assert.equal(s.d.dinero, d0 + 40);
  const sin = montar(false); assert.equal(sin.s.clientes[0].st, 'pide'); assert.equal(sin.s.cuentas.length, 1); assert.equal(sin.s.d.dinero, sin.d0);
  const nuevo = montar(true).s; nuevo.clientes[0].pac = 9.5; nuevo.clientes[0].st = 'pide'; nuevo.clientes[0].tk = null; nuevo.tickets.length = 0; nuevo._sistema(.1); assert.equal(nuevo.clientes[0].st, 'pide', 'espera un momento antes de intervenir');
});
ok('ramas del local: efectos reales, requisitos, incompatibilidades y costo', () => {
  const s = sim(); s.d.dinero = 5000; s.d.xp = 400; assert.equal(s.comprarRama('fin_credito').ok, false, 'las de cadena no van aquí'); assert.equal(s.comprarRama('x').ok, false);
  const t0 = s.plato(s.cfg.platos[0].id).t; assert.equal(s.comprarRama('op_auto').ok, true); assert.equal(s.comprarRama('op_auto').ok, false); assert.equal(s.comprarRama('op_flujo').ok, false, 'incompatibles');
  const t = { id: 1, plato: s.cfg.platos[0].id, estado: 'cola' }; s.tickets.push(t); s._cocinar(s.est[0], t, 1); assert.ok(Math.abs(s.est[0].t - t0 * .75) < 1e-9, 'cocina 25% más rápido');
  const caro = sim(); caro.d.dinero = 5000; caro.d.xp = 400; caro.comprarRama('prod_calidad'); const c = { id: 1, plato: caro.cfg.platos[0].id, st: 'come', tc: 0, seat: { x: 1, y: 1 }, x: 1, y: 1, ruta: [] }; caro._pagar(c); assert.equal(caro.cuentas[0].monto, Math.round(caro.cfg.platos[0].precio * 1.15)); assert.ok(caro.costoSurtir() > caro.cfg.ing * 5, 'pero los ingredientes cuestan más');
  const pobre = sim(); pobre.d.dinero = 10; pobre.d.xp = 400; assert.equal(pobre.comprarRama('op_auto').ok, false); assert.equal(pobre.d.dinero, 10);
  const bajo = sim(); bajo.d.dinero = 5000; assert.equal(bajo.comprarRama('op_auto').ok, false, 'pide nivel');
  const g = sim(); g.d.dinero = 5000; g.d.xp = 400; g.comprarRama('op_flujo'); const d0 = g.d.dinero; g._nomina(); assert.equal(g.d.dinero, d0 - 5, 'su desventaja se paga cada minuto');
});
ok('guardado: lo nuevo viaja y se valida; una partida anterior sigue cargando', () => {
  const s = conAyudante(); s.d.xp = 400; s.cambiarProv('premium'); s.comprarRama('prod_calidad'); s.emps[0].hab = 4; s.emps[0].exp = 77; s.emps[0].sat = 55; s.emps[0].n = 'Rosa'; s.d.st.servidos = 12; s.d.st.mejor = 5;
  const raw = JSON.parse(JSON.stringify(s.serializar())), r = sim('restaurante', limpiarPartida(raw));
  assert.equal(r.d.prov, 'premium'); assert.deepEqual(r.d.ramas, ['prod_calidad']); assert.equal(r.ef.precio, 1.15); assert.equal(r.emps[0].n, 'Rosa'); assert.equal(r.emps[0].hab, 4); assert.equal(r.emps[0].exp, 77); assert.equal(r.emps[0].sat, 55); assert.equal(r.d.st.servidos, 12); assert.equal(r.d.st.mejor, 5);
  const viejo = { v: 1, ts: 1, d: { dinero: 321, xp: 100, rep: 6, stock: 5, comp: ['mesa1', 'emp1'] }, px: 1.5, py: 1.5 }, v = sim('restaurante', limpiarPartida(viejo));
  assert.equal(v.d.dinero, 321); assert.equal(v.emps.length, 1); assert.equal(v.d.prov, 'mercado'); assert.equal(v.d.st.servidos, 0); assert.ok(v.emps[0].hab >= 1);
  const malo = sim('restaurante', limpiarPartida({ v: 1, d: { dinero: 5, xp: 1, rep: 5, stock: 1, comp: ['emp1'], prov: '__proto__', ramas: ['op_auto', 'op_flujo', 'fin_credito', 'zzz', 'op_auto'], st: { servidos: -9, semana: 'x', hack: 1 }, plantilla: [{ mid: 'emp1', hab: 99, sat: -4, sueldo: 1e9, n: 'x'.repeat(99), ger: true }, { mid: 'emp2' }] } }));
  assert.equal(malo.d.prov, 'mercado'); assert.deepEqual(malo.d.ramas, ['op_auto']); assert.equal(malo.d.st.servidos, 0); assert.equal(malo.d.st.hack, undefined); assert.equal(malo.emps[0].hab, 5); assert.equal(malo.emps[0].sat, 0); assert.ok(malo.emps[0].sueldo <= 99 && malo.emps[0].n.length <= 16);
});
ok('equilibrio: con las mismas reglas, restaurante y cafetería rinden parecido (±12% en dinero y en XP por minuto)', () => {
  for (const comprar of [false, true]) { const r = jugar('restaurante', 8, 7, { comprar }), c = jugar('cafeteria', 8, 7, { comprar }); const d = c.porMin / r.porMin, x = c.xpMin / r.xpMin; assert.ok(d > .88 && d < 1.12, `dinero ${d.toFixed(2)}`); assert.ok(x > .88 && x < 1.12, `xp ${x.toFixed(2)}`); assert.ok(r.perdidos === 0 && c.perdidos === 0); }
});
const S = o => ({ nivel: 1, rep: 5, dinero: 0, servidos: 0, perdidos: 0, racha: 0, mejorRacha: 0, semanas: 0, empleados: 0, gerenteLocal: false, ramasLocal: 0, franq: 0, patrimonio: 0, puesto: 1, jugadores: 1, ramasCadena: 0, gerentesF: 0, deuda: 0, prestamosPagados: 0, compradasVenta: 0, quiebras: 0, contratos: 0, ...o });
ok('campaña: cinco etapas en orden, las funciones se desbloquean por etapa', () => {
  assert.equal(etapaActual(S()).n, 1); assert.equal(etapaActual(S({ semanas: 1 })).n, 2); assert.equal(etapaActual(S({ semanas: 1, nivel: 4, servidos: 40 })).n, 3);
  assert.equal(etapaActual(S({ semanas: 1, nivel: 4, servidos: 40, franq: 1, patrimonio: 2500 })).n, 4); assert.equal(etapaActual(S({ semanas: 1, nivel: 4, servidos: 40, franq: 3, patrimonio: 9000, gerentesF: 1 })).n, 5);
  assert.equal(etapaActual(S({ nivel: 9, servidos: 999, franq: 9, patrimonio: 99999 })).n, 1, 'no se salta etapas');
  assert.equal(desbloqueado(1, 'gerente'), false); assert.equal(desbloqueado(3, 'gerente'), true); assert.equal(desbloqueado(1, 'cosa'), true);
});
ok('misiones: inmediatas, de sesión y largas; se reclaman una sola vez y solo si están completas', () => {
  assert.ok(new Set(MISIONES.map(m => m.h)).size === 3, 'tres horizontes'); assert.equal(new Set(MISIONES.map(m => m.id)).size, MISIONES.length);
  let p = limpiarProg(null); const s = S({ racha: 3 }); assert.equal(reclamar(s, p, 'e1_racha').ok, false); assert.equal(reclamar(s, p, 'nada').ok, false);
  const s2 = S({ racha: 7 }), r = reclamar(s2, p, 'e1_racha'); assert.equal(r.ok, true); assert.equal(r.premio.dinero, 40); assert.equal(reclamar(s2, r.prog, 'e1_racha').ok, false, 'no se duplica');
  const act = misionesActivas(s2, r.prog); assert.ok(act.find(m => m.id === 'e1_racha').reclamada); assert.equal(act.find(m => m.id === 'e1_semana').avance, 0); assert.ok(act.every(m => m.avance <= m.meta));
  const tit = reclamar(S({ semanas: 2 }), r.prog, 'e1_semana'); assert.equal(tit.prog.titulo, 'Sobreviviente');
});
ok('logros: se otorgan una vez y los datos corruptos se limpian', () => {
  const a = evaluarLogros(S({ servidos: 120, mejorRacha: 11, franq: 1 }), null); assert.ok(a.nuevos.length >= 4); const b = evaluarLogros(S({ servidos: 120, mejorRacha: 11, franq: 1 }), a.prog); assert.equal(b.nuevos.length, 0);
  const l = limpiarProg({ reclamadas: ['e1_racha', 'zzz', 5], logros: ['cien', 'x'], titulo: 'x'.repeat(50) }); assert.deepEqual(l.reclamadas, ['e1_racha']); assert.deepEqual(l.logros, ['cien']); assert.equal(l.titulo.length, 24); assert.equal(LOGROS.length, new Set(LOGROS.map(x => x[0])).size);
});
console.log(`\n${n} pruebas OK`);
