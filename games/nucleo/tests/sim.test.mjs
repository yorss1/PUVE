// Ejecutar: node games/nucleo/tests/sim.test.mjs
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { Sim } from '../game/sim.js';
const cargar = g => JSON.parse(readFileSync(new URL(`../config/${g}.json`, import.meta.url)));
let n = 0; const ok = (nombre, f) => { f(); n++; console.log('✓', nombre); };
const seed = () => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; };

for (const giro of ['restaurante', 'cafeteria']) {
  const cfg = cargar(giro);
  ok(`${giro}: mapa rectangular y con puerta, caja, refri, tablero y estaciones`, () => {
    assert.equal(new Set(cfg.mapa.map(r => r.length)).size, 1);
    const s = new Sim(cfg, null, seed());
    assert.ok(s.puerta && s.cajas.length && s.refris.length && s.tableros.length && s.est.length);
  });
  ok(`${giro}: todo asiento, estación, caja, refri y tablero es alcanzable desde la puerta`, () => {
    const s = new Sim(cfg, null, seed());
    for (const m of ['mesa1', 'mesa2', 'mesa3']) assert.ok(s._aplicar(cfg.mejoras.find(x => x.id === m)));
    for (const a of s.asientos()) assert.ok(s.ruta(s.puerta.x, s.puerta.y, [a]), 'asiento ' + a.x + ',' + a.y);
    for (const o of [...s.est, ...s.cajas, ...s.refris, ...s.tableros]) assert.ok(s.ruta(s.puerta.x, s.puerta.y, s.vecinos(o.x, o.y)), 'objeto ' + o.x + ',' + o.y);
  });
  ok(`${giro}: ciclo completo (pedido → preparar → servir → cobrar) con economía consistente`, () => {
    const s = new Sim(cfg, null, seed()); const d0 = s.d.dinero;
    let cobrado = 0;
    for (let i = 0; i < 60 * 120 && !cobrado; i++) {
      s.tick(1 / 60);
      const c = s.clientes.find(c => c.st === 'pide');
      if (c) { Object.assign(s.p, { x: c.seat.x + .5, y: c.seat.y + .5 }); s.accion(); }
      const e = s.est[0];
      if (s.tickets.some(t => t.estado === 'cola')) { Object.assign(s.p, { x: e.x + .5, y: e.y + 1.5 }); s.accion(); }
      if (s.tickets.some(t => t.estado === 'listo')) { Object.assign(s.p, { x: e.x + .5, y: e.y + 1.5 }); s.accion(); }
      const w = s.clientes.find(c => c.st === 'espera' && s.llevando === c.tk);
      if (w) { Object.assign(s.p, { x: w.seat.x + .5, y: w.seat.y + .5 }); s.accion(); }
      if (s.cuentas.length) { const r = s.cajas[0]; const monto = s.cuentas[0].monto; Object.assign(s.p, { x: r.x + .5, y: r.y + 1.5 }); s.accion(); cobrado = monto; assert.equal(s.cuentas.length, 0); }
    }
    assert.ok(cobrado > 0, 'se cobró una venta');
    assert.equal(s.d.dinero, d0 + cobrado);
    s.accion(); assert.equal(s.d.dinero, d0 + cobrado, 'cobrar dos veces no duplica');
  });
  ok(`${giro}: comprar valida dinero, nivel y duplicados; nunca saldo negativo`, () => {
    const s = new Sim(cfg, null, seed());
    assert.equal(s.comprar('emp1').ok, false);
    s.d.dinero = 1000; s.d.xp = 200;
    assert.equal(s.comprar('mesa1').ok, true); assert.equal(s.comprar('mesa1').ok, false);
    assert.ok(s.d.dinero >= 0);
    s.d.dinero = 0; assert.equal(s.comprar('mesa2').ok, false); assert.equal(s.d.dinero, 0);
  });
  ok(`${giro}: guardado → carga restaura estado y rechaza datos corruptos`, () => {
    const s = new Sim(cfg, null, seed()); s.d.dinero = 999; s.d.xp = 200; s.comprar('mesa1'); s.comprar('emp1');
    const raw = JSON.parse(JSON.stringify(s.serializar()));
    const r = new Sim(cfg, raw, seed());
    assert.equal(r.d.dinero, s.d.dinero - 0); assert.deepEqual(r.d.comp, s.d.comp); assert.equal(r.emps.length, 1);
    const mal = new Sim(cfg, { v: 1, d: { dinero: 'x', xp: -5, stock: 1e9, comp: ['nope', 'mesa1', 'mesa1'] } }, seed());
    assert.equal(mal.d.dinero, cfg.inicial.dinero); assert.equal(mal.d.stock, cfg.maxStock); assert.deepEqual(mal.d.comp, ['mesa1']);
    assert.equal(new Sim(cfg, { v: 99 }, seed()).d.dinero, cfg.inicial.dinero);
  });
  ok(`${giro}: ayudante atiende solo (sin intervención del jugador) y genera ingresos`, () => {
    const s = new Sim(cfg, null, seed()); s.d.dinero = 1000; s.d.xp = 200; s.comprar('emp1'); s.d.stock = 30;
    const caja = s.cajas[0]; let servidos = 0;
    for (let i = 0; i < 60 * 240; i++) {
      s.tick(1 / 60);
      const c = s.clientes.find(c => c.st === 'pide');
      if (c) { Object.assign(s.p, { x: c.seat.x + .5, y: c.seat.y + .5 }); s.accion(); }
      if (s.cuentas.length) { Object.assign(s.p, { x: caja.x + .5, y: caja.y + 1.5 }); s.accion(); servidos++; }
      assert.ok(s.d.stock >= 0 && s.d.dinero >= 0);
    }
    assert.ok(servidos >= 3, 'servidos=' + servidos);
  });
}
ok('pausa larga no salta la simulación (dt limitado)', () => { const s = new Sim(cargar('cafeteria'), null, seed()); s.tick(60); assert.ok(s.t <= .1 + 1e-9); });
console.log(`\n${n} pruebas OK`);
