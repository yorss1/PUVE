// Ejecutar: node games/nucleo/tests/persistencia.test.mjs
import assert from 'node:assert/strict';
import { crearLocal } from '../persistence/local.js';
import { crearCuentaSimulada, validarNombre } from '../persistence/cuenta-simulada.js';
import { migrarLocalACuenta } from '../persistence/migracion.js';
import { crearAdaptadorSupabase } from '../adapters/supabase/adaptador.js';
const mem = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), m }; };
let n = 0; const ok = async (t, f) => { await f(); n++; console.log('✓', t); };
const partida = (din, xp = 10) => ({ v: 1, ts: 1, d: { dinero: din, xp, rep: 5, stock: 4, comp: ['mesa1'], extra: 'x' }, px: 3.5, py: 4.5, hack: 1 });

await ok('local: guarda con respaldo y descarta campos desconocidos', async () => {
  const l = crearLocal(mem()); await l.guardarPartida('restaurante', partida(100)); await l.guardarPartida('restaurante', partida(200));
  const s = await l.cargarPartida('restaurante'); assert.equal(s.d.dinero, 200); assert.equal(s.hack, undefined); assert.equal(s.d.extra, undefined);
});
await ok('local: si el guardado principal está corrupto usa el respaldo', async () => {
  const st = mem(), l = crearLocal(st); await l.guardarPartida('cafeteria', partida(100)); await l.guardarPartida('cafeteria', partida(200));
  st.setItem('puvegame:cafeteria:save', '{corrupto'); assert.equal((await l.cargarPartida('cafeteria')).d.dinero, 100);
});
await ok('cuenta: valida nombres y evita duplicados sin importar mayúsculas', async () => {
  assert.ok(validarNombre('a')); assert.ok(validarNombre('Admin')); assert.ok(validarNombre('mal nombre!')); assert.equal(validarNombre('Chef_01'), null);
  const c = crearCuentaSimulada(mem()); assert.equal(c.registrar('Chef_01').ok, true); assert.equal(c.registrar('chef_01').ok, false);
});
await ok('migración: sin partida en cuenta → transfiere, verifica y NO borra la local', async () => {
  const l = crearLocal(mem()), c = crearCuentaSimulada(mem()); c.registrar('Ana_1'); await l.guardarPartida('restaurante', partida(500));
  const r = await migrarLocalACuenta({ local: l, cuenta: c, giro: 'restaurante', resolver: () => assert.fail('no debe preguntar') });
  assert.equal(r.ok, true); assert.equal(r.puedeBorrarLocal, true); assert.equal((await c.cargarPartida('restaurante')).d.dinero, 500); assert.ok(await l.cargarPartida('restaurante'));
});
await ok('migración: conflicto → pregunta; "cuenta" y "cancelar" no cambian nada; "local" respalda', async () => {
  const l = crearLocal(mem()), c = crearCuentaSimulada(mem()); c.registrar('Ana_1');
  await l.guardarPartida('restaurante', partida(500)); await c.guardarPartida('restaurante', partida(900));
  let r = await migrarLocalACuenta({ local: l, cuenta: c, giro: 'restaurante', resolver: async () => 'cancelar' }); assert.equal(r.ok, false); assert.equal((await c.cargarPartida('restaurante')).d.dinero, 900);
  r = await migrarLocalACuenta({ local: l, cuenta: c, giro: 'restaurante', resolver: async () => 'cuenta' }); assert.equal(r.puedeBorrarLocal, false); assert.equal((await c.cargarPartida('restaurante')).d.dinero, 900);
  r = await migrarLocalACuenta({ local: l, cuenta: c, giro: 'restaurante', resolver: async () => 'local' });
  assert.equal(r.accion, 'reemplazada_con_respaldo'); assert.equal((await c.cargarPartida('restaurante')).d.dinero, 500); assert.equal(c.respaldos()[0].s.d.dinero, 900);
});
await ok('migración: sin partida local o con datos corruptos no hace nada', async () => {
  const l = crearLocal(mem()), c = crearCuentaSimulada(mem()); c.registrar('Ana_1');
  assert.equal((await migrarLocalACuenta({ local: l, cuenta: c, giro: 'cafeteria', resolver: () => 'local' })).ok, false); assert.equal(await c.cargarPartida('cafeteria'), null);
});
await ok('supabase: desactivado por defecto, no se puede activar sin cliente ni tablas', async () => {
  const a = crearAdaptadorSupabase(); await assert.rejects(async () => a.cargarPartida('restaurante'), /desactivada/);
  assert.throws(() => crearAdaptadorSupabase({ habilitado: true }), /Faltan cliente/);
});
console.log(`\n${n} pruebas OK`);
