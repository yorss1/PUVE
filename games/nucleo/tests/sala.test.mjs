// Ejecutar: node games/nucleo/tests/sala.test.mjs
import assert from 'node:assert/strict';
import { Sala, limpiarNombre } from '../multiplayer/sala.js';
import { qrMatriz } from '../multiplayer/qr.js';
let n = 0; const ok = (t, f) => { f(); n++; console.log('✓', t); };
let t = 1000; const reloj = () => t; const nueva = (o = {}) => new Sala({ giro: 'restaurante', hostCid: 'H', nombreHost: 'Ana', ahora: reloj, ...o });
const mv = (seq, x, y, extra = {}) => ({ seq, x, y, dir: 1, modo: 'ciudad', look: { piel: 0, pelo: 1, ropa: 0, gorro: 0 }, ...extra });
ok('invitación: válida, usos limitados, expira y se puede revocar', () => {
  const s = nueva(), k = s.invitar({ ttlMs: 1000, usos: 2 });
  assert.equal(s.unir(k, 'A', 'Beto').ok, true); assert.equal(s.unir(k, 'B', 'Caro').ok, true); assert.equal(s.unir(k, 'C', 'Dani').ok, false, 'sin usos');
  const k2 = s.invitar({ ttlMs: 1000 }); t += 2000; assert.match(s.unir(k2, 'D', 'X').msg, /expiró/);
  const k3 = s.invitar(); assert.equal(s.revocar(k3), true); assert.match(s.unir(k3, 'E', 'Y').msg, /inválida/);
  assert.equal(s.unir('falso', 'F', 'Z').ok, false);
});
ok('capacidad máxima y reintento idempotente del mismo cliente', () => {
  const s = nueva({ cap: 2 }), k = s.invitar({ usos: 9 });
  assert.equal(s.unir(k, 'A', 'Beto').ok, true); assert.equal(s.unir(k, 'A', 'Beto').ok, true); assert.equal(s.miembros.size, 2);
  assert.match(s.unir(k, 'B', 'Caro').msg, /llena/);
});
ok('nombres saneados y únicos', () => {
  assert.equal(limpiarNombre('<b>Hola mundo</b>muy largo!!!'), 'bHola mundobmuy'); assert.equal(limpiarNombre('😀😀'), 'Invitado');
  const s = nueva(), k = s.invitar({ usos: 5 }); s.unir(k, 'A', 'Ana'); s.unir(k, 'B', 'ana');
  assert.deepEqual([...s.miembros.values()].map(m => m.nombre), ['Ana', 'Ana_2', 'ana_3']);
  assert.equal(new Set([...s.miembros.values()].map(m => m.nombre.toLowerCase())).size, 3);
});
ok('movimiento: secuencia, tasa, velocidad y datos fuera de rango', () => {
  const s = nueva(), k = s.invitar(); s.unir(k, 'A', 'Beto'); t = 10000;
  assert.equal(s.mover('A', mv(1, 5, 5)), true); t += 100;
  assert.equal(s.mover('A', mv(1, 5.4, 5)), false, 'misma secuencia');
  assert.equal(s.mover('A', mv(0, 5.4, 5)), false, 'secuencia vieja');
  assert.equal(s.mover('A', mv(2, 5.4, 5)), true);
  t += 100; assert.equal(s.mover('A', mv(3, 40, 5)), false, 'teletransporte rechazado'); assert.equal(s.miembros.get('A').x, 5.4);
  assert.equal(s.mover('A', mv(3, NaN, 5)), false); assert.equal(s.mover('A', mv(3, 5, 5, { modo: 'hack' })), false); assert.equal(s.mover('A', mv(3, 1e9, 5)), false);
  t += 100; assert.equal(s.mover('A', mv(3, 40, 5, { modo: 'interior' })), true, 'cambiar de escena sí permite cambiar de coordenadas');
  assert.equal(s.mover('ZZ', mv(1, 1, 1)), false, 'cliente desconocido');
});
ok('límite de mensajes por segundo (inundación)', () => {
  const s = nueva(), k = s.invitar(); s.unir(k, 'A', 'Beto'); t = 50000; let aceptados = 0;
  for (let i = 1; i <= 100; i++) if (s.mover('A', mv(i, 5, 5))) aceptados++;
  assert.ok(aceptados <= 21, 'aceptados=' + aceptados);
});
ok('look se acota; cerrar la sala expulsa y el host al salir la cierra', () => {
  const s = nueva(), k = s.invitar(); s.unir(k, 'A', 'Beto'); t = 90000; s.mover('A', mv(1, 5, 5, { look: { piel: 99, pelo: -3, ropa: 'x', gorro: 2 } }));
  assert.deepEqual(s.miembros.get('A').look, { piel: 0, pelo: 0, ropa: 0, gorro: 2 });
  s.salir('A'); assert.equal(s.miembros.size, 1); s.salir('H'); assert.equal(s.abierta, false); assert.equal(s.unir(k, 'Q', 'Q').ok, false);
});
ok('QR: matriz cuadrada para una invitación real y falla con textos demasiado largos', () => {
  const url = 'https://puve.yorss01.workers.dev/games/restaurante.html#sala=' + 'a1b2c3d4e5f6.' + '0123456789abcdef0123456789abcdef';
  const m = qrMatriz(url); assert.ok(m.length >= 25 && m.length <= 57 && m.every(r => r.length === m.length));
  assert.throws(() => qrMatriz('x'.repeat(400)), /demasiado largo/);
});
console.log(`\n${n} pruebas OK`);
