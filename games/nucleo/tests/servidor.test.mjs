// Ejecutar: node games/nucleo/tests/servidor.test.mjs
import assert from 'node:assert/strict';
import { Servidor } from '../multiplayer/servidor.js';
let n = 0; const ok = (t, f) => { f(); n++; console.log('✓', t); };
let T = 1e6; const nuevo = () => { T = 1e6; const s = new Servidor({ ahora: () => T }); const r = s.manejar('H', { t: 'crear', giro: 'restaurante', nombre: 'Ana' }); return { s, token: r[0].msg.token }; };
const a = (r, tipo) => r.map(x => x.msg).find(m => m.t === tipo);
ok('crear → unir → ambos tienen hogar propio y ven el mismo mundo', () => {
  const { s, token } = nuevo(); const u = s.manejar('G', { t: 'unir', token, nombre: 'Beto' }); assert.equal(a(u, 'resp').ok, true);
  const d = s.difundir(); const mundoG = d.find(x => x.para === 'G' && x.msg.t === 'mundo').msg; assert.equal(mundoG.jugadores.length, 2);
  assert.notEqual(mundoG.mio.hogar, s.mundo.j.get('H').hogar); assert.equal(a(d, 'snap').snap.length, 2);
});
ok('seguridad: no se puede crear dos veces, giro inválido, ni operar sin estar en la sala', () => {
  const { s } = nuevo(); assert.equal(a(s.manejar('X', { t: 'crear', giro: 'restaurante' }), 'resp').ok, false);
  const v = new Servidor({ ahora: () => T }); assert.equal(a(v.manejar('H', { t: 'crear', giro: 'hack' }), 'resp').ok, false);
  assert.deepEqual(s.manejar('INTRUSO', { t: 'eco', id: '1', op: 'invertir', monto: 100 }), []); assert.equal(s.mundo.j.has('INTRUSO'), false);
  assert.equal(a(s.manejar('Z', { t: 'unir', token: 'falso', nombre: 'Z' }), 'resp').ok, false);
});
ok('solo el anfitrión invita; una nueva invitación revoca la anterior', () => {
  const { s, token } = nuevo(); s.manejar('G', { t: 'unir', token, nombre: 'Beto' });
  assert.equal(a(s.manejar('G', { t: 'invitar' }), 'resp').ok, false); const n2 = a(s.manejar('H', { t: 'invitar' }), 'creada').token; assert.notEqual(n2, token);
  assert.equal(a(s.manejar('Q', { t: 'unir', token, nombre: 'Q' }), 'resp').ok, false, 'la vieja ya no sirve'); assert.equal(a(s.manejar('Q', { t: 'unir', token: n2, nombre: 'Q' }), 'resp').ok, true);
});
ok('economía por el protocolo: invertir → comprar; la respuesta llega solo a quien la pidió', () => {
  const { s } = nuevo(); const r = s.manejar('H', { t: 'eco', id: 'a1', op: 'invertir', monto: 1500 }); assert.equal(r.length, 1); assert.equal(r[0].para, 'H'); assert.equal(r[0].msg.ok, true);
  const rc = s.manejar('H', { t: 'eco', id: 'a2', op: 'comprar', lote: '1,0,00' }); assert.equal(rc[0].msg.ok, true); assert.equal(s.mundo.o.get('1,0,00').dueno, 'H');
});
ok('mensajes basura no rompen el servidor ni el estado', () => {
  const { s } = nuevo(); for (const m of [null, undefined, 5, 'x', [], {}, { t: 5 }, { t: 'eco' }, { t: 'eco', id: 'z', op: {} }, { t: 'mover', x: 'a' }, { t: 'unir' }, { t: '__proto__' }]) assert.doesNotThrow(() => s.manejar('H', m));
  assert.equal(s.mundo.j.get('H').dinero, 0);
});
ok('un invitado no puede modificar lotes ajenos ni gastar dinero ajeno', () => {
  const { s, token } = nuevo(); s.manejar('G', { t: 'unir', token, nombre: 'Beto' }); s.manejar('H', { t: 'eco', id: '1', op: 'invertir', monto: 1500 }); s.manejar('H', { t: 'eco', id: '2', op: 'comprar', lote: '1,0,00' });
  for (const op of ['mejorar', 'vender', 'comprar']) assert.equal(a(s.manejar('G', { t: 'eco', id: 'g' + op, op, lote: '1,0,00' }), 'res').ok, false);
  assert.equal(s.mundo.o.get('1,0,00').dueno, 'H');
});
ok('el anfitrión cierra la sala: todos reciben "cerrada"', () => { const { s } = nuevo(); const r = s.manejar('H', { t: 'salir' }); assert.equal(a(r, 'cerrada').t, 'cerrada'); assert.deepEqual(s.difundir(), []); });
ok('exportar/importar conserva sala, jugadores y dinero; reconexión idempotente', () => {
  const { s, token } = nuevo(); s.manejar('G', { t: 'unir', token, nombre: 'Beto' }); s.manejar('G', { t: 'eco', id: '1', op: 'invertir', monto: 800 });
  const d = JSON.parse(JSON.stringify(s.exportar())); const r = new Servidor({ ahora: () => T }); assert.equal(r.importar(d), true);
  assert.equal(r.mundo.j.get('G').dinero, 800); assert.equal(a(r.manejar('G', { t: 'unir', nombre: 'Beto' }), 'resp').ok, true, 'reconectar sin token');
  assert.equal(new Servidor().importar({ id: 'zz', giro: 'x' }), false);
});
console.log(`\n${n} pruebas OK`);
