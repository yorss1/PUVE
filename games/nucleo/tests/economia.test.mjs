// Ejecutar: node games/nucleo/tests/economia.test.mjs
import assert from 'node:assert/strict';
import { Mundo, TURNO_MS, MAX_OFFLINE, precioLote, costoMejora, valorVenta, CUPO_MAX, INTERES } from '../multiplayer/mundo.js';
import { Servidor } from '../multiplayer/servidor.js';
import { lotes, loteDe } from '../world/ciudad.js';
import { perfilBarrio, eventosEntre, efectoLote, encaje, rasgos, SEGMENTOS, ADELANTO, costoInsumos, PROVEEDORES, tendenciaBarrio } from '../economia/mercado.js';
import { efectos, puedeNodo, NODOS } from '../economia/ramas.js';
let n = 0; const ok = (t, f) => { f(); n++; console.log('✓', t); };
let T = 1e6, k = 0; const nuevo = () => { T = 1e6; return new Mundo({ ahora: () => T }); };
const op = (m, cid, o) => m.op(cid, { id: 'op' + k++, ...o });
const fondos = (m, cid, x) => { m._mov(m.j.get(cid), 'aporte', x); };
const libro = p => Object.values(p.c).reduce((a, b) => a + b, 0);
const franq = (m, cid, id, extra = {}) => { m.o.set(id, { ...m._franquicia(), dueno: cid, ...extra }); };

ok('mercado: determinista, barrios coherentes y los eventos se avisan antes de empezar', () => {
  const a = perfilBarrio(7, '1,-1'), b = perfilBarrio(7, '1,-1'); assert.deepEqual(a, b); assert.ok(Math.abs(SEGMENTOS.reduce((s, c) => s + a.seg[c], 0) - 1) < 1e-9);
  assert.notEqual(perfilBarrio(7, '0,0').nombre, perfilBarrio(7, '2,2').nombre === '' ? 'x' : perfilBarrio(7, '0,0').nombre + 'x'); assert.equal(perfilBarrio(7, '0,0').nombre, 'Centro');
  let vistos = 0; for (let t = 0; t < 1500; t++) for (const e of eventosEntre(7, t)) if (e.estado === 'activo' && e.desde === t) { vistos++; const antes = eventosEntre(7, t - ADELANTO).find(x => x.id === e.id); assert.ok(antes && antes.estado === 'proximo', 'aviso previo ' + e.tipo); }
  assert.ok(vistos > 10, 'hay eventos con frecuencia razonable: ' + vistos);
  for (let t = 0; t < 2000; t += 37) { const tn = tendenciaBarrio(7, '0,0', t); assert.ok(tn >= .84 && tn <= 1.16); }
  assert.deepEqual(eventosEntre(7, 345), eventosEntre(7, 345));
});
ok('clientela: los estudiantes buscan precio, los exigentes buscan calidad y ambiente', () => {
  const est = { estudiantes: 1, familias: 0, trabajadores: 0, turistas: 0, premium: 0 }, pre = { estudiantes: 0, familias: 0, trabajadores: 0, turistas: 0, premium: 1 };
  const barato = rasgos({ nivel: 1, p: 0 }), lujo = rasgos({ nivel: 1, p: 4, esp: 'exclusividad' });
  assert.ok(encaje(est, barato) > encaje(est, lujo), 'estudiantes prefieren lo barato'); assert.ok(encaje(pre, lujo) > encaje(pre, barato), 'exigentes prefieren lo exclusivo');
  assert.ok(Math.abs(encaje(est, rasgos({ nivel: 1 })) - 1) < 1e-9, 'un negocio neutral encaja 1');
});
ok('libro de dinero: con todas las operaciones, dinero == suma de movimientos y nunca es negativo (fuzz)', () => {
  const m = nuevo(); let s = 777; const r = () => (s = (s * 16807) % 2147483647) / 2147483647; ['A', 'B'].forEach(c => m.alta(c, c));
  const ids = []; for (let x = -2; x <= 2; x++) for (let y = -1; y <= 1; y++) ids.push(...lotes(7, x, y).map(l => l.id));
  const ops = ['invertir', 'comprar', 'mejorar', 'vender', 'prestamo', 'abonar', 'ajustar', 'promocion', 'listar', 'retirar', 'gerente', 'proveedor', 'rama'];
  for (let i = 0; i < 6000; i++) {
    T += Math.floor(r() * 5000); const c = 'AB'[Math.floor(r() * 2)], o = ops[Math.floor(r() * ops.length)];
    m.op(c, { id: 'f' + i, op: o, monto: Math.floor(r() * 900) - 50, lote: ids[Math.floor(r() * ids.length)], precio: Math.floor(r() * 6) - 1, esp: ['volumen', 'calidad', null, 'x'][Math.floor(r() * 4)], hab: 1 + Math.floor(r() * 5), accion: r() < .3 ? 'despedir' : 'contratar', prov: ['mercado', 'premium', 'express', 'zzz'][Math.floor(r() * 4)], contrato: r() < .5, id2: 1, recorte: r() < .5 });
    if (o === 'rama') m.op(c, { id: 'r' + i, op: 'rama', rama: NODOS[6 + Math.floor(r() * 6)].id });
    for (const p of m.j.values()) { assert.ok(p.dinero >= 0 && Number.isFinite(p.dinero) && p.deuda >= 0 && Number.isFinite(p.deuda), `${c} ${o}`); assert.equal(libro(p), p.dinero, `libro ${c} ${o}`); }
    for (const [id, ow] of m.o) assert.ok(m.j.has(ow.dueno) && loteDe(7, id));
  }
});
ok('préstamos: límite por patrimonio, interés cada turno, abonos y embargo si la deuda se descontrola', () => {
  const m = nuevo(); m.alta('A', 'Ana'); fondos(m, 'A', 1000); const p = m.j.get('A'), lim = m.limiteDeuda(p);
  assert.equal(op(m, 'A', { op: 'prestamo', monto: lim + 1 }).ok, false); assert.equal(op(m, 'A', { op: 'prestamo', monto: 0 }).ok, false); assert.equal(op(m, 'A', { op: 'prestamo', monto: 1.5 }).ok, false);
  assert.equal(op(m, 'A', { op: 'prestamo', monto: 400 }).ok, true); assert.equal(p.deuda, 400); assert.equal(p.dinero, 1400);
  m._turno(); assert.equal(p.deuda, 400); assert.equal(p.dinero, 1400 - Math.ceil(400 * INTERES), 'cobra interés');
  assert.equal(op(m, 'A', { op: 'abonar', monto: 401 }).ok, false); assert.equal(op(m, 'A', { op: 'abonar', monto: 400 }).ok, true); assert.equal(p.deuda, 0); assert.equal(p.st.pagados, 1);
  // embargo: deuda enorme sin efectivo para pagar intereses
  const e = nuevo(); e.alta('B', 'Beto'); const q = e.j.get('B'); franq(e, 'B', '1,0,00', { invertido: 0 }); q.deuda = 5000; q.dinero = 0; q.c = { inicial: 0 };
  for (let i = 0; i < 80 && e.o.has('1,0,00'); i++) e._turno(); assert.equal(e.o.has('1,0,00'), false, 'el banco liquidó'); assert.ok(q.dinero >= 0); assert.equal(libro(q), q.dinero);
});
ok('proveedores: el contrato fija el precio y protege de la escasez; sin contrato la escasez cuesta', () => {
  assert.ok(costoInsumos('mercado', 1.35, false) > costoInsumos('mercado', 1.35, true)); assert.ok(costoInsumos('express', 1.35, false) < costoInsumos('mercado', 1.35, false));
  assert.ok(Math.abs(costoInsumos('mercado', 1, false) - 1) < 1e-9, 'sin eventos el mercado local no cambia nada');
  const m = nuevo(); m.alta('A', 'Ana'); const p = m.j.get('A'); assert.equal(op(m, 'A', { op: 'proveedor', prov: 'zzz' }).ok, false);
  assert.equal(op(m, 'A', { op: 'proveedor', prov: 'premium', contrato: true }).ok, true); assert.equal(op(m, 'A', { op: 'proveedor', prov: 'mayorista' }).ok, false, 'contrato vigente');
  m.turno += 31; m._turno(); assert.equal(p.contrato, null, 'vence'); assert.equal(op(m, 'A', { op: 'proveedor', prov: 'mayorista' }).ok, true); assert.equal(p.prov, 'mayorista');
});
ok('política de la franquicia: precio, especialidad (cuesta), promoción y gerente tienen efectos y costos validados', () => {
  const m = nuevo(); m.alta('A', 'Ana'); fondos(m, 'A', 1500); const id = '0,0,00', l = loteDe(7, id), p = m.j.get('A'); franq(m, 'A', id);
  assert.equal(op(m, 'A', { op: 'ajustar', lote: id, precio: 9 }).ok, false); assert.equal(op(m, 'A', { op: 'ajustar', lote: id, esp: 'inventada' }).ok, false);
  const d0 = p.dinero; assert.equal(op(m, 'A', { op: 'ajustar', lote: id, precio: 3, esp: 'calidad' }).ok, true); assert.equal(p.dinero, d0 - Math.round(precioLote(l) * .15)); assert.equal(m.o.get(id).p, 3);
  assert.equal(op(m, 'A', { op: 'promocion', lote: id }).ok, true); assert.equal(op(m, 'A', { op: 'promocion', lote: id }).ok, false, 'ya hay una activa');
  assert.equal(op(m, 'A', { op: 'gerente', lote: id, hab: 7 }).ok, false); assert.equal(op(m, 'A', { op: 'gerente', lote: id, hab: 3 }).ok, true); assert.equal(op(m, 'A', { op: 'gerente', lote: id, hab: 3 }).ok, false);
  const sin = nuevo(); sin.alta('A', 'Ana'); franq(sin, 'A', id); sin.j.get('A').dinero = 1000; sin._turno(); const gSin = sin.j.get('A').ingresos[id];
  const con = nuevo(); con.alta('A', 'Ana'); franq(con, 'A', id, { ger: { hab: 4, sueldo: 22 } }); con.j.get('A').dinero = 1000; con._turno(); assert.ok(con.j.get('A').ingresos[id] !== gSin);
  const barata = nuevo(); barata.alta('A', 'Ana'); barata.alta('B', 'Beto'); franq(barata, 'A', id, { p: 0 }); franq(barata, 'B', '0,0,10', { p: 4 });
  for (const q of barata.j.values()) q.dinero = 2000; barata._turno(); assert.ok(barata.j.get('A').ingresos[id] > 0);
});
ok('reputación: precios abusivos sin valor la hunden; calidad y buen servicio la suben', () => {
  const m = nuevo(); m.alta('A', 'Ana'); m.alta('B', 'Beto'); franq(m, 'A', '0,0,00', { p: 4 }); franq(m, 'B', '1,0,00', { esp: 'calidad', p: 2, nivel: 3, ger: { hab: 4, sueldo: 22 } });
  for (const q of m.j.values()) q.dinero = 5000; for (let i = 0; i < 60; i++) m._turno();
  assert.ok(m.o.get('0,0,00').rep < 5, 'cara y sin valor: ' + m.o.get('0,0,00').rep); assert.ok(m.o.get('1,0,00').rep > 5.5, 'buena: ' + m.o.get('1,0,00').rep);
  const r = nuevo(); r.alta('A', 'Ana'); franq(r, 'A', '0,0,00', { recorte: true }); r.j.get('A').dinero = 5000; for (let i = 0; i < 60; i++) r._turno(); assert.ok(r.o.get('0,0,00').rep < 4.5, 'recortar gastos baja la reputación: ' + r.o.get('0,0,00').rep);
});
ok('ramas: ventajas con costo, incompatibles entre sí y validadas por el servidor', () => {
  const e = efectos(['fin_credito']); assert.equal(e.prestamo, 1.5); assert.equal(e.interes, 1.25); assert.equal(puedeNodo(['fin_credito'], 'fin_reserva') !== null, true);
  const m = nuevo(); m.alta('A', 'Ana'); fondos(m, 'A', 1500); assert.equal(op(m, 'A', { op: 'rama', rama: 'op_auto' }).ok, false, 'las de local no van aquí'); assert.equal(op(m, 'A', { op: 'rama', rama: 'nada' }).ok, false);
  const l0 = m.limiteDeuda(m.j.get('A')); assert.equal(op(m, 'A', { op: 'rama', rama: 'fin_credito' }).ok, true); assert.equal(op(m, 'A', { op: 'rama', rama: 'fin_credito' }).ok, false); assert.equal(op(m, 'A', { op: 'rama', rama: 'fin_reserva' }).ok, false);
  assert.ok(m.limiteDeuda(m.j.get('A')) > l0); assert.equal(op(m, 'A', { op: 'rama', rama: 'exp_franq' }).ok, true); assert.equal(m.maxFranq(m.j.get('A')), 8);
  for (const nd of NODOS) assert.ok(nd.pro && nd.contra && nd.costo > 0, 'cada mejora tiene ventaja y desventaja: ' + nd.id);
});
ok('compraventa: un local en venta lo compra otro jugador; el dinero solo se transfiere', () => {
  const m = nuevo(); m.alta('A', 'Ana'); m.alta('B', 'Beto'); fondos(m, 'A', 1500); fondos(m, 'B', 1500); const id = '1,0,00', total = () => [...m.j.values()].reduce((s, p) => s + p.dinero, 0);
  op(m, 'A', { op: 'comprar', lote: id }); assert.equal(op(m, 'B', { op: 'comprar', lote: id }).ok, false, 'no está en venta');
  assert.equal(op(m, 'A', { op: 'listar', lote: id, precio: 5 }).ok, false, 'precio fuera de rango'); assert.equal(op(m, 'A', { op: 'listar', lote: id }).ok, true);
  assert.equal(op(m, 'A', { op: 'comprar', lote: id }).ok, false, 'no puedes comprarte a ti'); const t0 = total(); const pr = m.o.get(id).enVenta;
  assert.equal(op(m, 'B', { op: 'comprar', lote: id }).ok, true); assert.equal(total(), t0, 'conservación'); assert.equal(m.o.get(id).dueno, 'B'); assert.equal(m.o.get(id).enVenta, null); assert.equal(m.j.get('B').st.compradasVenta, 1);
  assert.equal(op(m, 'B', { op: 'comprar', lote: id }).ok, false, 'sin doble compra'); assert.equal(m.j.get('A').dinero, 1500 - precioLote(loteDe(7, id)) + pr);
});
ok('persistencia: guardar/restaurar conserva todo y una partida anterior (sin campos nuevos) sigue cargando', () => {
  const m = nuevo(); m.alta('A', 'Ana'); fondos(m, 'A', 1500); franq(m, 'A', '1,0,00', { p: 3, esp: 'rapidez', rep: 6.5, ger: { hab: 3, sueldo: 18 } }); op(m, 'A', { op: 'prestamo', monto: 200 }); op(m, 'A', { op: 'proveedor', prov: 'express', contrato: true }); for (let i = 0; i < 5; i++) m._turno();
  const d = JSON.parse(JSON.stringify(m.serializar())), r = new Mundo({ ahora: () => T }); assert.equal(r.restaurar(d), true); assert.deepEqual(JSON.parse(JSON.stringify(r.serializar())), d);
  assert.equal(r.j.get('A').deuda, m.j.get('A').deuda); assert.equal(r.o.get('1,0,00').esp, 'rapidez'); assert.equal(libro(r.j.get('A')), r.j.get('A').dinero);
  const viejo = { seed: 7, v: 3, turno: 4, dt: 100, j: [{ cid: 'A', nombre: 'Ana', color: '#d9822b', dinero: 321, cupo: 1500, hogar: '0,0,01', eventos: [] }], o: [['0,0,01', { dueno: 'A', nivel: 1, tipo: 'hogar', invertido: 0 }], ['1,0,00', { dueno: 'A', nivel: 2, tipo: 'franquicia', invertido: 100 }]] };
  const v = new Mundo({ ahora: () => T }); assert.equal(v.restaurar(viejo), true); assert.equal(v.j.get('A').dinero, 321); assert.equal(v.o.get('1,0,00').p, 2); assert.equal(libro(v.j.get('A')), 321); v._turno();
  const malo = JSON.parse(JSON.stringify(d)); malo.j[0].deuda = -5; malo.j[0].prov = '__proto__'; malo.j[0].ramas = ['op_auto', 'x']; malo.o[1][1].p = 99; malo.o[1][1].esp = 'hack'; malo.o[1][1].enVenta = -3;
  const q = new Mundo({ ahora: () => T }); q.restaurar(malo); assert.equal(q.j.get('A').deuda, 0); assert.equal(q.j.get('A').prov, 'mercado'); assert.deepEqual(q.j.get('A').ramas, []); assert.equal(q.o.get('1,0,00').p, 4, 'se acota al rango'); assert.equal(q.o.get('1,0,00').esp, null); assert.equal(q.o.get('1,0,00').enVenta, null);
});
ok('ausencia: se simula con tope, no arruina a un jugador inactivo y deja un informe; recargar no cambia nada', () => {
  const m = nuevo(); m.alta('A', 'Ana'); fondos(m, 'A', 1500); franq(m, 'A', '0,0,00'); franq(m, 'A', '0,0,10'); m.j.get('A').dinero = 0; m.j.get('A').c = { inicial: 0 };
  const t0 = m.turno; assert.equal(m.ausencia(TURNO_MS * 3), null, 'menos de un minuto no cuenta'); assert.equal(m.turno, t0);
  const horas = 30 * 3600e3, nn = m.ausencia(horas); assert.equal(nn, MAX_OFFLINE, 'tope de turnos'); assert.equal(m.turno, t0 + MAX_OFFLINE);
  const p = m.j.get('A'), inf = p.informe; assert.ok(inf && inf.limitado === true && inf.turnos === MAX_OFFLINE); assert.ok(p.dinero >= 0 && libro(p) === p.dinero); assert.equal(m._franq('A'), 2, 'sus franquicias siguen abiertas');
  assert.equal(op(m, 'A', { op: 'informe' }).ok, true); assert.equal(p.informe, null);
  const a = nuevo(); a.alta('A', 'Ana'); fondos(a, 'A', 900); const s1 = JSON.parse(JSON.stringify(a.serializar())); const b = new Mundo({ ahora: () => T }); b.restaurar(s1); T += 2000; assert.deepEqual(JSON.parse(JSON.stringify(b.serializar())).j[0].dinero, 900);
});
ok('servidor: exporta con marca de tiempo y al importar aplica la ausencia una sola vez', () => {
  T = 1e6; const s = new Servidor({ ahora: () => T, rivales: 2 }); s.manejar('H', { t: 'crear', giro: 'restaurante', nombre: 'Ana' }); s.manejar('H', { t: 'eco', id: 'i1', op: 'invertir', monto: 1000 });
  assert.equal(s.mundo.j.size, 3, 'anfitrión + 2 rivales'); T += TURNO_MS * 20; s.difundir(); const d = JSON.parse(JSON.stringify(s.exportar())), t1 = d.mundo.turno;
  T += 3600e3; const r = new Servidor({ ahora: () => T }); assert.equal(r.importar(d), true); assert.ok(r.mundo.turno > t1 + 300 && r.mundo.turno <= t1 + MAX_OFFLINE, 'turnos: ' + r.mundo.turno); assert.ok(r.mundo.j.get('H').informe);
  const t2 = r.mundo.turno; r.difundir(); assert.ok(r.mundo.turno - t2 <= 1, 'no se repite');
  for (const p of r.mundo.j.values()) assert.equal(libro(p), p.dinero);
});
console.log(`\n${n} pruebas OK`);
