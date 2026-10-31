// Ejecutar: node games/nucleo/tests/fase3.test.mjs   (validación, contratos, subastas, sociedades, fusiones, rescates, chat, ausencia del local)
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { Mundo, TURNO_MS, precioLote } from '../multiplayer/mundo.js';
import { Servidor } from '../multiplayer/servidor.js';
import { Sim, EFIC_AUSENCIA } from '../game/sim.js';
import { loteDe } from '../world/ciudad.js';
import { TASA_DINERO, CREDITO_INICIAL } from '../multiplayer/validacion.js';
import { ofertasVentana, ventanaDe, VENTANA_C } from '../multiplayer/contratos.js';
import { SUB_TURNOS, minimaPuja } from '../multiplayer/subastas.js';
import { PERFILES, ajustarRivales } from '../economia/rivales.js';
let n = 0; const ok = (t, f) => { f(); n++; console.log('✓', t); };
const reloj = () => { const c = { t: 1e6 }; return c; };
const mundo = (o = {}) => { const c = reloj(); const m = new Mundo({ ahora: () => c.t, ...o }); m.c = c; return m; };
const avanza = (m, k) => { for (let i = 0; i < k; i++) { m.c.t += TURNO_MS; m.avanzar(); } };
const libro = p => Object.values(p.c).reduce((a, b) => a + b, 0);
let kk = 0; const op = (m, cid, o) => m.op(cid, { id: 'x' + kk++, ...o });
const fondos = (m, cid, x) => m._mov(m.j.get(cid), 'aporte', x);
const franq = (m, cid, id, extra = {}) => m.o.set(id, { ...m._franquicia(), dueno: cid, ...extra });
const totalDinero = m => [...m.j.values()].reduce((a, p) => a + p.dinero, 0);
const cfg = g => JSON.parse(readFileSync(new URL(`../config/${g}.json`, import.meta.url)));

ok('validación del restaurante: solo se puede invertir lo que el servidor aceptó como ganado', () => {
  const m = mundo({ estricto: true }); m.alta('A', 'Ana'); const p = m.j.get('A');
  const rep = (g, xp, s, t) => op(m, 'A', { op: 'local', ganado: g, xp, servidos: s, tiempo: t, semanas: 0 });
  assert.equal(op(m, 'A', { op: 'invertir', monto: CREDITO_INICIAL + 1 }).ok, false, 'más que el crédito inicial'); assert.equal(op(m, 'A', { op: 'invertir', monto: 1000 }).ok, true); assert.equal(p.loc.credito, CREDITO_INICIAL - 1000);
  assert.equal(rep(50000, 9000, 700, 4000).ok, true, 'la primera vez solo fija la línea base'); assert.equal(p.loc.credito, CREDITO_INICIAL - 1000, 'sin crédito por la base');
  m.c.t += 10000; assert.equal(rep(50000 + 99999999, 9999999, 99999, 99999).ok, true); const max = Math.floor(TASA_DINERO * 15);
  assert.ok(p.loc.ganado <= max, 'tope por tiempo real: ' + p.loc.ganado); assert.ok(p.loc.sospechas >= 1, 'se marca como sospechoso'); assert.ok(p.loc.credito <= CREDITO_INICIAL - 1000 + max);
  m.c.t += 10000; const antes = p.loc.credito; rep(50000 + 99999999 + 300, 9999999 + 30, 99999 + 3, 99999 + 10); assert.equal(p.loc.credito, antes + 300, 'un reporte verosímil sí se acepta');
  assert.equal(op(m, 'A', { op: 'local', ganado: -5, xp: 1, servidos: 1, tiempo: 1, semanas: 0 }).ok, false); assert.equal(op(m, 'A', { op: 'local', ganado: 1.5, xp: 1, servidos: 1, tiempo: 1, semanas: 0 }).ok, false);
  const c0 = p.loc.credito; m.c.t += 5000; rep(10, 10, 1, 1); assert.equal(p.loc.credito, c0, 'si el total retrocede no hay crédito'); assert.equal(libro(p), p.dinero);
  const lax = mundo(); lax.alta('B', 'Beto'); assert.equal(op(lax, 'B', { op: 'invertir', monto: 1500 }).ok, true, 'sin modo estricto el mundo se comporta como antes');
});
ok('etapas en el servidor: las funciones avanzadas exigen la etapa y se calcula con datos acotados', () => {
  const m = mundo({ estricto: true }); m.alta('A', 'Ana'); fondos(m, 'A', 3000); franq(m, 'A', '1,0,00'); const p = m.j.get('A');
  assert.match(op(m, 'A', { op: 'ajustar', lote: '1,0,00', esp: 'calidad' }).msg, /etapa 2/); assert.match(op(m, 'A', { op: 'proveedor', prov: 'premium' }).msg, /etapa 2/); assert.match(op(m, 'A', { op: 'gerente', lote: '1,0,00', hab: 3 }).msg, /etapa 3/); assert.match(op(m, 'A', { op: 'rama', rama: 'exp_franq' }).msg, /etapa 3/);
  assert.equal(op(m, 'A', { op: 'ajustar', lote: '1,0,00', precio: 1 }).ok, true, 'lo básico no se bloquea'); assert.equal(op(m, 'A', { op: 'proveedor', prov: 'mercado' }).ok, true);
  p.loc.semanas = 1; p.loc.servidos = 10; p.loc.xp = 0; assert.equal(op(m, 'A', { op: 'ajustar', lote: '1,0,00', esp: 'calidad' }).ok, true, 'etapa 2 alcanzada'); assert.equal(m.vista('A').mio.etapa, 2);
  assert.equal(op(m, 'A', { op: 'proveedor', prov: 'premium', contrato: true }).ok, false, 'los contratos piden etapa 3');
  const lib = mundo(); lib.alta('B', 'Beto'); fondos(lib, 'B', 3000); franq(lib, 'B', '1,0,00'); assert.equal(op(lib, 'B', { op: 'ajustar', lote: '1,0,00', esp: 'calidad' }).ok, true, 'sin modo estricto no hay puertas');
});
ok('contratos de catering: se compite por ellos, el riesgo es real y el depósito se devuelve solo si cumples', () => {
  const m = mundo(); m.alta('A', 'Ana'); m.alta('B', 'Beto'); for (const c of ['A', 'B']) fondos(m, c, 5000); franq(m, 'A', '1,0,00', { nivel: 4 }); franq(m, 'B', '2,0,00', { nivel: 4 }); franq(m, 'A', '3,0,00');
  const of = ofertasVentana(7, ventanaDe(m.turno)); assert.equal(of.length, 3); assert.deepEqual(of, ofertasVentana(7, 0), 'deterministas'); const v = m.vista('A').contratos; assert.equal(v.ofertas.length, 3);
  const chica = of.reduce((a, b) => (a.req < b.req ? a : b)); const d0 = m.j.get('A').dinero; assert.equal(op(m, 'A', { op: 'contrato', oferta: chica.id, lote: '1,0,00' }).ok, true); assert.equal(m.j.get('A').dinero, d0 - chica.deposito);
  assert.equal(op(m, 'B', { op: 'contrato', oferta: chica.id, lote: '2,0,00' }).ok, false, 'ya la tomó otro'); assert.equal(op(m, 'A', { op: 'contrato', oferta: of[0].id, lote: '1,0,00' }).ok, false, 'una franquicia, un contrato'); assert.equal(op(m, 'A', { op: 'contrato', oferta: 'zzz', lote: '3,0,00' }).ok, false);
  assert.equal(op(m, 'A', { op: 'contrato', oferta: chica.id, lote: '9,9,99' }).ok, false);
  const base = nuevo => { const x = mundo(); x.alta('A', 'Ana'); fondos(x, 'A', 9000); franq(x, 'A', '1,0,00', { nivel: nuevo }); return x; };
  const sin = base(4); for (let i = 0; i < 3; i++) sin._turno(); const gSin = sin.j.get('A').ingresos['1,0,00'];
  const con = base(4); const g = ofertasVentana(7, 0).sort((a, b) => a.req - b.req)[0]; assert.equal(op(con, 'A', { op: 'contrato', oferta: g.id, lote: '1,0,00' }).ok, true); for (let i = 0; i < 3; i++) con._turno(); assert.ok(con.j.get('A').c.contrato > 0, 'cobra el pago por turno'); assert.ok(con.j.get('A').ingresos['1,0,00'] !== gSin);
  const fin = base(4); const ch = ofertasVentana(7, 0).sort((a, b) => a.req - b.req)[0]; op(fin, 'A', { op: 'contrato', oferta: ch.id, lote: '1,0,00' }); const dep = fin.j.get('A').c.deposito; for (let i = 0; i < ch.plazo + 1; i++) fin._turno();
  assert.equal(fin.cont.size, 0, 'terminó'); assert.equal(fin.j.get('A').c.deposito, dep + ch.deposito, 'depósito devuelto'); assert.ok(fin.j.get('A').c.contrato >= ch.bono); assert.equal(libro(fin.j.get('A')), fin.j.get('A').dinero);
  const grande = of.reduce((a, b) => (a.req > b.req ? a : b)), mal = mundo(); mal.alta('A', 'Ana'); fondos(mal, 'A', 9000); franq(mal, 'A', '1,0,00', { nivel: 1 }); mal.j.get('A').c.multa = 0; const g2 = ofertasVentana(7, 0).sort((a, b) => b.req - a.req)[0];
  assert.ok(g2.req > 1.35, 'hay un contrato más grande que un local de nivel 1: ' + g2.req); assert.equal(op(mal, 'A', { op: 'contrato', oferta: g2.id, lote: '1,0,00' }).ok, true); const dep2 = mal.j.get('A').c.deposito;
  for (let i = 0; i < g2.plazo + 1; i++) mal._turno(); assert.ok(mal.j.get('A').c.multa < 0, 'multas por no cumplir'); assert.equal(mal.j.get('A').c.deposito, dep2, 'pierde el depósito'); assert.ok(mal.o.get('1,0,00').rep < 5, 'y reputación'); void grande;
  const ven = base(2); const o1 = ofertasVentana(7, 0)[0]; op(ven, 'A', { op: 'contrato', oferta: o1.id, lote: '1,0,00' }); ven.o.delete('1,0,00'); ven._turno(); assert.equal(ven.cont.size, 0, 'sin franquicia no hay contrato');
});
ok('subastas: pujas en custodia, mínimo de puja, antisniping, cierre y conservación del dinero', () => {
  const m = mundo(); for (const c of ['V', 'A', 'B']) m.alta(c, c); for (const c of ['V', 'A', 'B']) fondos(m, c, 4000); franq(m, 'V', '1,0,00', { invertido: 300 });
  assert.equal(op(m, 'V', { op: 'subastar', lote: '1,0,00', base: 5 }).ok, false, 'base fuera de rango'); assert.equal(op(m, 'A', { op: 'subastar', lote: '1,0,00' }).ok, false, 'no es suya'); assert.equal(op(m, 'V', { op: 'subastar', lote: '1,0,00' }).ok, true); assert.equal(op(m, 'V', { op: 'subastar', lote: '1,0,00' }).ok, false);
  const s = m.sub.get('1,0,00'); assert.equal(op(m, 'A', { op: 'comprar', lote: '1,0,00' }).ok, false, 'en subasta no se compra directo'); assert.equal(op(m, 'V', { op: 'vender', lote: '1,0,00' }).ok, false); assert.equal(op(m, 'V', { op: 'pujar', lote: '1,0,00', monto: s.base }).ok, false, 'no puja en la suya');
  assert.equal(op(m, 'A', { op: 'pujar', lote: '1,0,00', monto: s.base - 1 }).ok, false); const t0 = totalDinero(m), a0 = m.j.get('A').dinero; assert.equal(op(m, 'A', { op: 'pujar', lote: '1,0,00', monto: s.base }).ok, true); assert.equal(m.j.get('A').dinero, a0 - s.base, 'custodia'); assert.equal(totalDinero(m), t0 - s.base);
  assert.equal(op(m, 'B', { op: 'pujar', lote: '1,0,00', monto: s.base + 1 }).ok, false, 'incremento mínimo'); const min = minimaPuja(s); assert.equal(op(m, 'B', { op: 'pujar', lote: '1,0,00', monto: min }).ok, true); assert.equal(m.j.get('A').dinero, a0, 'al ser superado se le devuelve'); assert.equal(op(m, 'B', { op: 'pujar', lote: '1,0,00', monto: 999999 }).ok, false, 'sin fondos');
  while (s.cierra - m.turno > 1) m._turno(); const c0 = s.cierra; assert.equal(op(m, 'A', { op: 'pujar', lote: '1,0,00', monto: minimaPuja(s) }).ok, true); assert.equal(s.cierra, c0 + 2, 'antisniping');
  const final = s.mejor.monto, v0 = m.j.get('V').dinero; for (let i = 0; i < 6 && m.sub.has('1,0,00'); i++) m._turno(); assert.equal(m.sub.has('1,0,00'), false); assert.equal(m.o.get('1,0,00').dueno, 'A'); assert.ok(m.j.get('V').dinero >= v0 + final, 'el vendedor cobró');
  for (const p of m.j.values()) assert.equal(libro(p), p.dinero);
  const b = mundo(); b.alta('V', 'V'); franq(b, 'V', '1,0,00'); op(b, 'V', { op: 'subastar', lote: '1,0,00' }); assert.equal(op(b, 'V', { op: 'retirarSubasta', lote: '1,0,00' }).ok, true); assert.equal(b.sub.size, 0);
  const c = mundo(); c.alta('V', 'V'); franq(c, 'V', '1,0,00'); op(c, 'V', { op: 'subastar', lote: '1,0,00' }); for (let i = 0; i < SUB_TURNOS + 1; i++) c._turno(); assert.equal(c.o.get('1,0,00').dueno, 'V', 'sin pujas conserva su propiedad'); assert.equal(c.sub.size, 0);
});
ok('subasta de la ciudad: sale un lote libre cada cierto tiempo, el dinero sale del juego y se serializa', () => {
  const m = mundo(); m.alta('A', 'Ana'); fondos(m, 'A', 9000); avanza(m, 50); m._turno(); const s = [...m.sub.values()].find(x => x.ciudad); assert.ok(s, 'hay subasta de la ciudad'); assert.equal(m.o.has(s.lote), false); assert.equal(s.vendedor, null);
  assert.equal(op(m, 'A', { op: 'comprar', lote: s.lote }).ok, false); const d = JSON.parse(JSON.stringify(m.serializar())), r = new Mundo({ ahora: () => m.c.t }); r.restaurar(d); assert.equal(r.sub.size, m.sub.size);
  assert.equal(op(m, 'A', { op: 'pujar', lote: s.lote, monto: s.base }).ok, true); for (let i = 0; i < SUB_TURNOS + 6 && m.sub.has(s.lote); i++) m._turno(); assert.equal(m.o.get(s.lote)?.dueno, 'A'); assert.equal(libro(m.j.get('A')), m.j.get('A').dinero);
});
ok('sociedades: crear, invitar, aportar, permisos, votación, caja compartida e historial', () => {
  const m = mundo(); for (const c of ['A', 'B', 'C']) { m.alta(c, 'P' + c); fondos(m, c, 3000); }
  let r = op(m, 'A', { op: 'soc_crear', nombre: 'Los Tres' }); assert.equal(r.ok, true); const id = r.soc; assert.ok(/^soc:/.test(id)); assert.equal(op(m, 'A', { op: 'soc_crear', nombre: 'Otra' }).ok, false); assert.equal(op(m, 'B', { op: 'soc_crear', nombre: '' }).ok, false);
  assert.equal(op(m, 'B', { op: 'soc_invitar', cid: 'C' }).ok, false, 'solo el fundador'); assert.equal(op(m, 'A', { op: 'soc_invitar', cid: 'npc:x' }).ok, false); assert.equal(op(m, 'A', { op: 'soc_invitar', cid: 'B' }).ok, true);
  assert.equal(m.vista('B').sociedad.invitaciones.length, 1); assert.equal(op(m, 'B', { op: 'soc_aceptar', soc: id }).ok, true); op(m, 'A', { op: 'soc_invitar', cid: 'C' }); op(m, 'C', { op: 'soc_aceptar', soc: id });
  const sp = m.j.get(id), t0 = totalDinero(m); assert.equal(op(m, 'A', { op: 'soc_aportar', monto: 2000 }).ok, true); assert.equal(op(m, 'B', { op: 'soc_aportar', monto: 1000 }).ok, true); assert.equal(sp.dinero, 3000); assert.equal(totalDinero(m), t0, 'aportar solo mueve dinero');
  assert.match(op(m, 'B', { op: 'comprar', soc: id, lote: '1,0,00' }).msg, /permiso/); assert.equal(op(m, 'A', { op: 'soc_permisos', cid: 'B', perm: { comprar: true } }).ok, true);
  r = op(m, 'B', { op: 'comprar', soc: id, lote: '1,0,00' }); assert.equal(r.ok, true); assert.ok(r.propuesta, 'comprar exige votación'); assert.equal(m.o.has('1,0,00'), false, 'aún no se ejecuta');
  assert.equal(op(m, 'B', { op: 'votar', soc: id, propuesta: r.propuesta, voto: true }).ok, false, 'ya votó'); assert.equal(op(m, 'A', { op: 'votar', soc: id, propuesta: r.propuesta, voto: true }).aprobada, true); assert.equal(m.o.get('1,0,00').dueno, id, 'la sociedad es dueña');
  assert.equal(op(m, 'C', { op: 'ajustar', soc: id, lote: '1,0,00', precio: 1 }).ok, true, 'operar es de todos'); assert.equal(m.o.get('1,0,00').p, 1);
  const r2 = op(m, 'A', { op: 'prestamo', soc: id, monto: 100 }); assert.ok(r2.propuesta); op(m, 'B', { op: 'votar', soc: id, propuesta: r2.propuesta, voto: false }); assert.equal(sp.soc.props.length, 1, 'con 3 socios un solo no no basta'); op(m, 'C', { op: 'votar', soc: id, propuesta: r2.propuesta, voto: false }); assert.equal(sp.deuda, 0, 'rechazada'); assert.ok(m.vista('A').sociedad.mia.hist.some(h => /rechazada/.test(h.txt)));
  const v = m.vista('A').sociedad.mia; assert.equal(v.socios.length, 3); assert.ok(v.hist.length >= 5); assert.equal(m.vista('A').jugadores.find(j => j.cid === id).soc, true); assert.equal(m.vista('A').jugadores.filter(j => j.soc).length, 1);
  const p3 = op(m, 'A', { op: 'soc_disolver', soc: id }); assert.ok(p3.propuesta); op(m, 'B', { op: 'votar', soc: id, propuesta: p3.propuesta, voto: true }); assert.equal(m.j.has(id), false, 'disuelta'); assert.equal(m.o.has('1,0,00'), false);
  for (const p of m.j.values()) assert.equal(libro(p), p.dinero, p.nombre); assert.ok(m.j.get('A').dinero > 0);
});
ok('sociedades: salir paga lo proporcional, el fundador cede el mando, y nadie puede suplantar una sociedad', () => {
  const m = mundo(); for (const c of ['A', 'B']) { m.alta(c, c); fondos(m, c, 2000); } const id = op(m, 'A', { op: 'soc_crear', nombre: 'Duo' }).soc; op(m, 'A', { op: 'soc_invitar', cid: 'B' }); op(m, 'B', { op: 'soc_aceptar', soc: id });
  op(m, 'A', { op: 'soc_aportar', monto: 1500 }); op(m, 'B', { op: 'soc_aportar', monto: 500 }); assert.equal(op(m, 'A', { op: 'soc_salir' }).ok, false, 'el fundador no se va sin ceder el mando');
  const b0 = m.j.get('B').dinero; assert.equal(op(m, 'B', { op: 'soc_salir' }).ok, true); assert.equal(m.j.get('B').dinero, b0 + 500, 'recibe su parte'); assert.equal(m.j.get(id).dinero, 1500);
  assert.equal(m.alta('soc:77', 'x'), null); assert.equal(m.alta('npc:fake:1', 'x'), null); assert.equal(op(m, 'B', { op: 'ajustar', soc: id, lote: '1,0,00', precio: 1 }).ok, false, 'ya no es socio');
  op(m, 'A', { op: 'soc_invitar', cid: 'B' }); op(m, 'B', { op: 'soc_aceptar', soc: id }); assert.equal(op(m, 'A', { op: 'soc_ceder', cid: 'B' }).ok, true); assert.equal(op(m, 'A', { op: 'soc_invitar', cid: 'B' }).ok, false); assert.equal(m.vista('B').sociedad.mia.rol, 'fundador');
  const d = JSON.parse(JSON.stringify(m.serializar())), r = new Mundo({ ahora: () => m.c.t }); assert.equal(r.restaurar(d), true); assert.deepEqual(JSON.parse(JSON.stringify(r.serializar())), d); assert.equal(r.vista('A').sociedad.mia.fundador, 'B');
  const malo = JSON.parse(JSON.stringify(d)); malo.j.find(p => p.soc).soc.socios.fantasma = { rol: 'socio', perm: { hack: true, comprar: 'si' }, aporte: -5 }; const q = new Mundo({ ahora: () => m.c.t }); q.restaurar(malo); assert.equal(Object.keys(q.j.get(id).soc.socios).includes('fantasma'), false);
});
ok('fusiones y rescates: un rival sólido absorbe a otro en apuros; una persona puede rescatar y gana un aliado que devuelve el favor', () => {
  const m = mundo(); m.giro = 'restaurante'; m.alta('H', 'Yo'); m.sembrar(4); const r = [...m.j.values()].filter(p => p.npc), fuerte = r.find(p => p.npc.perfil === 'estratega'), debil = r.find(p => p.npc.perfil === 'oportunista');
  franq(m, debil.cid, '2,1,00'); debil.deuda = Math.floor(m.limiteDeuda(debil) * .7); fuerte.dinero += 6000; m._mov(fuerte, 'aporte', 0); fuerte.c.aporte += 6000; const lotesAntes = m._franq(fuerte.cid) + m._franq(debil.cid), dineroAntes = fuerte.dinero + debil.dinero;
  for (let i = 0; i < 400 && debil.npc.estado === 'activo'; i++) { fuerte.npc.prox = m.turno; for (const q of [fuerte]) q.ingresos[[...m.o].find(([, o]) => o.dueno === q.cid)[0]] = 50; debil.ingresos = {}; m._turno(); }
  assert.equal(debil.npc.estado, 'fusionado', 'fue absorbido'); assert.ok(m._franq(fuerte.cid) >= lotesAntes - 1 && m._franq(debil.cid) === 0); assert.ok(m.noticias.some(x => /absorbió/.test(x.txt))); assert.ok(m.vista('H').jugadores.find(j => j.cid === debil.cid).retirado); assert.equal(libro(fuerte), fuerte.dinero); assert.equal(libro(debil), debil.dinero); void dineroAntes;
  const m2 = mundo(); m2.giro = 'restaurante'; m2.alta('H', 'Yo'); m2.sembrar(2); fondos(m2, 'H', 3000); const v = [...m2.j.values()].find(p => p.npc), ley = v.npc; assert.equal(op(m2, 'H', { op: 'rescatar', rival: v.cid, monto: 100 }).ok, false, 'no está en apuros');
  v.deuda = Math.floor(m2.limiteDeuda(v) * .8); const d0 = v.deuda; assert.equal(op(m2, 'H', { op: 'rescatar', rival: v.cid, monto: d0 + 1 }).ok, false); const t0 = totalDinero(m2); assert.equal(op(m2, 'H', { op: 'rescatar', rival: v.cid, monto: 200 }).ok, true); assert.equal(v.deuda, d0 - 200); assert.equal(ley.aliados.H, 1); assert.equal(op(m2, 'H', { op: 'rescatar', rival: v.cid, monto: 100 }).ok, false, 'espera entre rescates');
  assert.equal(totalDinero(m2), t0 - 200, 'el dinero del rescate sale como abono de deuda'); v.deuda = 0; fondos(m2, v.cid, 9000 - v.dinero); const h0 = m2.j.get('H').dinero; ley.prox = m2.turno; m2._turno(); for (let i = 0; i < 12 && ley.deben.H; i++) { ley.prox = m2.turno; m2._turno(); }
  assert.equal(ley.deben.H, undefined, 'devolvió el favor'); assert.ok(m2.j.get('H').dinero >= h0 + 200 * 1.15 - 1); for (const p of m2.j.values()) assert.equal(libro(p), p.dinero);
});
ok('número de rivales: se pueden sumar y quitar en caliente sin dejar propiedades colgadas', () => {
  const m = mundo(); m.giro = 'restaurante'; m.alta('H', 'Yo'); m.sembrar(3); avanza(m, 60); assert.equal([...m.j.values()].filter(p => p.npc).length, 3); assert.equal(m.ajustarRivales(1), 1); assert.equal([...m.j.values()].filter(p => p.npc).length, 1);
  for (const [id, o] of m.o) assert.ok(m.j.has(o.dueno), 'sin dueños fantasma: ' + id); assert.equal(m.ajustarRivales(4), 4); assert.equal(m.ajustarRivales(0), 0); assert.equal([...m.j.values()].filter(p => p.npc).length, 0); assert.equal(m.ajustarRivales(99), 8); assert.equal(m.ajustarRivales(-3), 0);
  avanza(m, 30); for (const p of m.j.values()) assert.equal(libro(p), p.dinero);
});
ok('chat: llega a todos, tiene límite de ritmo y de longitud, el anfitrión modera y el historial sobrevive', () => {
  const c = reloj(); const s = new Servidor({ ahora: () => c.t }); s.manejar('H', { t: 'crear', giro: 'restaurante', nombre: 'Ana', rivales: 2 }); assert.equal(s.mundo.j.size, 3, 'rivales elegidos al crear'); const tok = s.sala.invitar(); const u = s.manejar('G', { t: 'unir', sala: s.sala.id, token: tok, nombre: 'Beto' });
  assert.ok(Array.isArray(u) && u.some(x => x.msg.t === 'chat_hist'), 'recibe el historial al entrar');
  let r = s.manejar('H', { t: 'chat', txt: '  Hola   <b>equipo</b>\n!  ' }); assert.equal(r[0].para, '*'); assert.equal(r[0].msg.m.txt, 'Hola b equipo /b !'); assert.equal(r[0].msg.m.nombre, 'Ana');
  r = s.manejar('H', { t: 'chat', txt: 'otra' }); assert.equal(r[0].msg.t, 'chat_err', 'ritmo'); c.t += 2000; r = s.manejar('H', { t: 'chat', txt: 'x'.repeat(500) }); assert.equal(r[0].msg.m.txt.length, 200);
  assert.deepEqual(s.manejar('H', { t: 'chat', txt: '   ' }), []); assert.deepEqual(s.manejar('Z', { t: 'chat', txt: 'hola' }), [], 'ajenos no hablan');
  assert.equal(s.manejar('G', { t: 'chat_config', activo: false })[0].msg.ok, false, 'solo el anfitrión modera'); s.manejar('H', { t: 'chat_config', silenciar: 'G' }); c.t += 2000; assert.match(s.manejar('G', { t: 'chat', txt: 'hola' })[0].msg.msg, /silenciado/);
  s.manejar('H', { t: 'chat_config', quitar: 'G' }); c.t += 2000; assert.equal(s.manejar('G', { t: 'chat', txt: 'ya puedo' })[0].msg.t, 'chat'); s.manejar('H', { t: 'chat_config', activo: false }); c.t += 2000; assert.match(s.manejar('H', { t: 'chat', txt: 'x' })[0].msg.msg, /desactiv/);
  s.manejar('H', { t: 'chat_config', activo: true }); const e = JSON.parse(JSON.stringify(s.exportar())), r2 = new Servidor({ ahora: () => c.t }); assert.equal(r2.importar(e), true); assert.ok(r2.chat.length >= 2); assert.equal(r2.chatOn, true);
  assert.match(s.manejar('G', { t: 'rivales', n: 1 })[0].msg.msg, /anfitrión/); assert.match(s.manejar('H', { t: 'rivales', n: 1 })[0].msg.msg, /1 rival/); assert.equal([...s.mundo.j.values()].filter(p => p.npc).length, 1); assert.equal(s.nRivales, 1);
});
ok('fuzz de todo junto: sociedades, subastas, contratos, rescates, préstamos y rivales mantienen todos los invariantes', () => {
  const m = mundo({ estricto: true }); m.giro = 'restaurante'; ['A', 'B', 'C'].forEach(c => m.alta(c, 'P' + c)); m.sembrar(3); for (const c of ['A', 'B', 'C']) fondos(m, c, 4000);
  let sd = 4242; const r = () => (sd = (sd * 16807) % 2147483647) / 2147483647; const ids = []; for (let x = -3; x <= 3; x++) for (let y = -2; y <= 2; y++) for (const sf of ['00', '01', '10']) { const l = loteDe(7, `${x},${y},${sf}`); if (l) ids.push(l.id); }
  const quienes = ['A', 'B', 'C'], soc = () => [...m.j.keys()].filter(k => k.startsWith('soc:')), rivs = () => [...m.j.keys()].filter(k => k.startsWith('npc:')); const L = () => ids[Math.floor(r() * ids.length)];
  const gen = () => { const c = quienes[Math.floor(r() * 3)], sid = soc()[0], via = sid && r() < .4 ? { soc: sid } : {}, k = Math.floor(r() * 24); const o = [
    { op: 'comprar', lote: L() }, { op: 'mejorar', lote: L() }, { op: 'vender', lote: L() }, { op: 'prestamo', monto: 50 + Math.floor(r() * 400) }, { op: 'abonar', monto: 20 + Math.floor(r() * 300) }, { op: 'subastar', lote: L(), base: 400 + Math.floor(r() * 900) },
    { op: 'pujar', lote: L(), monto: 300 + Math.floor(r() * 1500) }, { op: 'retirarSubasta', lote: L() }, { op: 'contrato', oferta: `c${m.turno / 40 | 0}.${Math.floor(r() * 3)}`, lote: L() }, { op: 'listar', lote: L() }, { op: 'retirar', lote: L() }, { op: 'ajustar', lote: L(), precio: Math.floor(r() * 5), recorte: r() < .5 },
    { op: 'promocion', lote: L() }, { op: 'gerente', lote: L(), hab: 2 + Math.floor(r() * 3), accion: r() < .3 ? 'despedir' : 'contratar' }, { op: 'rescatar', rival: rivs()[Math.floor(r() * 3)], monto: 30 + Math.floor(r() * 300) }, { op: 'soc_crear', nombre: 'Fuzz Co' },
    { op: 'soc_invitar', cid: quienes[Math.floor(r() * 3)] }, { op: 'soc_aceptar', soc: sid }, { op: 'soc_aportar', monto: 100 + Math.floor(r() * 800) }, { op: 'soc_salir' }, { op: 'votar', propuesta: 1 + Math.floor(r() * 5), voto: r() < .6 }, { op: 'soc_repartir', monto: 50 + Math.floor(r() * 400) },
    { op: 'soc_permisos', cid: quienes[Math.floor(r() * 3)], perm: { comprar: r() < .5, vender: r() < .5, finanzas: r() < .5 } }, { op: 'invertir', monto: 100 + Math.floor(r() * 600) }][k]; return [c, { id: 'z' + kk++, ...o, ...(['soc_crear', 'soc_invitar', 'soc_aceptar', 'soc_aportar', 'soc_salir', 'votar', 'soc_repartir', 'soc_permisos', 'invertir'].includes(o.op) ? (o.op === 'soc_aceptar' ? {} : {}) : via) }]; };
  for (let i = 0; i < 3500; i++) {
    m.c.t += Math.floor(r() * 4000); const [c, msg] = gen(); m.op(c, msg); if (i % 25 === 0) m.avanzar();
    for (const p of m.j.values()) { assert.ok(Number.isFinite(p.dinero) && p.dinero >= 0 && p.deuda >= 0 && Number.isFinite(p.deuda), `${p.nombre} ${msg.op} ${p.dinero} ${p.deuda}`); assert.equal(libro(p), p.dinero, `libro ${p.nombre} tras ${msg.op}`); }
    for (const [id, o] of m.o) assert.ok(m.j.has(o.dueno) && loteDe(7, id), 'dueño existente ' + id);
    for (const [id, s] of m.sub) { assert.ok(s.vendedor ? m.o.get(id)?.dueno === s.vendedor : !m.o.has(id), 'subasta coherente ' + id); if (s.mejor) assert.ok(m.j.has(s.mejor.cid)); }
    for (const [id, c2] of m.cont) assert.ok(m.o.get(id)?.dueno === c2.cid, 'contrato coherente ' + id);
    for (const p of m.j.values()) if (p.soc) { assert.ok(p.soc.socios[p.soc.fundador], 'la sociedad tiene fundador'); for (const k of Object.keys(p.soc.socios)) assert.ok(m.j.has(k)); }
  }
  assert.ok(m.noticias.length > 10); const d = JSON.parse(JSON.stringify(m.serializar())), q = new Mundo({ ahora: () => m.c.t, estricto: true }); assert.equal(q.restaurar(d), true); const sinT = x => { const y = JSON.parse(JSON.stringify(x)); for (const p of y.j) delete p.cupoT; return y; }; assert.deepEqual(sinT(q.serializar()), sinT(d), 'guardar/restaurar tras el fuzz');
  const usado = { sub: 0, cont: 0, soc: soc().length }; for (const x of m.noticias) { if (/subast/i.test(x.txt)) usado.sub++; if (/contrato/i.test(x.txt)) usado.cont++; } assert.ok(usado.sub > 0 && usado.cont > 0, JSON.stringify(usado));
});
for (const giro of ['restaurante', 'cafeteria']) ok(`${giro}: el local sigue abierto sin ti solo con gerente, con límites, y sin gerente cierra`, () => {
  const mk = () => { let s0 = 7; const rnd = () => (s0 = (s0 * 16807) % 2147483647) / 2147483647; const s = new Sim(cfg(giro), null, rnd); s.d.dinero = 3000; s.d.xp = 400; s.comprar('emp1'); s.comprar('emp2'); return s; };
  const s = mk(); assert.equal(s.ausencia(600), null, 'sin gerente cierra'); s.emps[0].hab = 3; assert.ok(s.ascender(s.emps[0].id).ok); s.d.stock = 5; const g0 = s.d.st.ganado, d0 = s.d.dinero, r = s.ausencia(600);
  assert.ok(r.servidos > 20 && r.dinero > 0, JSON.stringify(r)); assert.ok(r.dinero < r.servidos * 120, 'la mitad de lo ganado'); assert.ok(r.rep >= -1, 'la reputación cae como máximo 1'); assert.equal(s.d.st.ganado - g0 > 0, true);
  const ref = mk(); ref.emps[0].hab = 3; ref.ascender(ref.emps[0].id); ref.d.stock = 5; const d1 = ref.d.dinero; for (let t = 0; t < 600; t += .1) ref.tick(.1); const completo = ref.d.dinero - d1; assert.ok(Math.abs(r.dinero - Math.round(completo * EFIC_AUSENCIA)) <= 2, `${r.dinero} vs mitad de ${completo}`);
  assert.equal(s.ausencia(5), null, 'ausencias muy cortas no cuentan'); const largo = mk(); largo.emps[0].hab = 3; largo.ascender(largo.emps[0].id); assert.equal(largo.ausencia(99999).seg, 900, 'tope de 15 minutos'); assert.ok(d0 > 0);
});
console.log(`\n${n} pruebas OK`);
