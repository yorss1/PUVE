// Ejecutar: node games/nucleo/tests/ws.test.mjs   (levanta un servidor real en un puerto libre y usa clientes WebSocket reales)
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import { mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { iniciar } from '../herramientas/servidor_nodo.mjs';
let n = 0; const ok = async (t, f) => { await f(); n++; console.log('✓', t); };
const dir = mkdtempSync(join(tmpdir(), 'puvegame-')); let S = await iniciar({ puerto: 0, datos: dir }); const URL_ = () => `ws://localhost:${S.puerto}/ws`;
const jid = () => [...crypto.getRandomValues(new Uint8Array(12))].map(b => b.toString(16).padStart(2, '0')).join('');
function cli(j = jid()) {
  const ws = new WebSocket(URL_()), buf = [], esp = []; let abierto;
  const listo = new Promise(r => (abierto = r));
  ws.onopen = () => { ws.send(JSON.stringify({ t: 'hola', jid: j })); abierto(); };
  ws.onmessage = e => { const m = JSON.parse(e.data); const i = esp.findIndex(x => x.f(m)); if (i >= 0) esp.splice(i, 1)[0].r(m); else buf.push(m); };
  return { ws, jid: j, listo, env: m => ws.send(JSON.stringify(m)),
    espera: (f, ms = 2000) => new Promise((r, x) => { const i = buf.findIndex(f); if (i >= 0) return r(buf.splice(i, 1)[0]); const o = { f, r }; esp.push(o); setTimeout(() => { const k = esp.indexOf(o); if (k >= 0) { esp.splice(k, 1); x(new Error('Sin respuesta')); } }, ms); }) };
}
const raw = (path, headers = {}) => new Promise(r => { const q = http.request({ port: S.puerto, path, headers: { Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Version': '13', 'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==', ...headers } }); q.on('response', x => r(x.statusCode)); q.on('upgrade', () => { r(101); q.destroy(); }); q.on('error', () => r(0)); q.end(); });
const get = path => new Promise(r => net.connect(S.puerto, 'localhost', function () { this.write(`GET ${path} HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n`); let d = ''; this.on('data', x => d += x); this.on('close', () => r(+d.slice(9, 12))); }));

await ok('dos jugadores por WebSocket real: sala, unirse, invertir, comprar y ver el mundo compartido', async () => {
  const A = cli(), B = cli(); await Promise.all([A.listo, B.listo]); const hA = await A.espera(m => m.t === 'hola'), hB = await B.espera(m => m.t === 'hola');
  assert.notEqual(hA.cid, hB.cid); assert.ok(!JSON.stringify(hA).includes(A.jid), 'el secreto no vuelve al cliente');
  A.env({ t: 'crear', giro: 'restaurante', nombre: 'Ana' }); const c = await A.espera(m => m.t === 'creada');
  B.env({ t: 'unir', sala: c.id, token: c.token, nombre: 'Beto' }); assert.equal((await B.espera(m => m.t === 'resp')).ok, true);
  A.env({ t: 'eco', id: 'a1', op: 'invertir', monto: 1500 }); assert.equal((await A.espera(m => m.t === 'res' && m.id === 'a1')).ok, true);
  A.env({ t: 'eco', id: 'a2', op: 'comprar', lote: '1,0,00' }); assert.equal((await A.espera(m => m.t === 'res' && m.id === 'a2')).ok, true);
  const mB = await B.espera(m => m.t === 'mundo' && m.lotes.length === 3); assert.equal(mB.jugadores.length, 2); assert.equal(mB.mio.dinero, 0);
  B.env({ t: 'eco', id: 'b1', op: 'vender', lote: '1,0,00' }); assert.equal((await B.espera(m => m.t === 'res' && m.id === 'b1')).ok, false);
  const snap = await B.espera(m => m.t === 'snap'); assert.equal(snap.snap.length, 2); A.ws.close(); B.ws.close();
});
await ok('suplantación imposible: el cid lo deriva el servidor; sin "hola" no hay acceso', async () => {
  const X = cli(); await X.listo; await X.espera(m => m.t === 'hola'); X.env({ t: 'crear', giro: 'restaurante', nombre: 'X', cid: 'otro', hostCid: 'otro' });
  const c = await X.espera(m => m.t === 'creada'); const Y = cli(); await Y.listo; await Y.espera(m => m.t === 'hola');
  Y.env({ t: 'eco', id: '1', op: 'invertir', monto: 100, cid: 'XX' }); await new Promise(r => setTimeout(r, 200));
  const room = S.salas.get(c.id); assert.equal(room.srv.mundo.j.size, 1); X.ws.close(); Y.ws.close();
  const Z = new WebSocket(URL_()); await new Promise(r => (Z.onopen = r)); const cerro = new Promise(r => (Z.onclose = e => r(e.code))); Z.send(JSON.stringify({ t: 'crear', giro: 'restaurante' })); assert.equal(await cerro, 1008);
});
await ok('abusos: mensaje gigante, JSON basura, jid inválido y origen ajeno', async () => {
  const G = new WebSocket(URL_()); await new Promise(r => (G.onopen = r)); const c1 = new Promise(r => (G.onclose = e => r(e.code))); G.send('x'.repeat(5000)); assert.equal(await c1, 1009);
  const H = cli(); await H.listo; H.ws.send('{no json'); H.ws.send('[]'); H.env({ t: 'eco' }); await new Promise(r => setTimeout(r, 150)); assert.equal(H.ws.readyState, 1, 'sigue viva tras basura'); H.ws.close();
  const J = new WebSocket(URL_()); await new Promise(r => (J.onopen = r)); const c2 = new Promise(r => (J.onclose = e => r(e.code))); J.send(JSON.stringify({ t: 'hola', jid: 'corto' })); assert.equal(await c2, 1008);
  assert.equal(await raw('/ws', { Origin: 'http://sitio-malo.example' }), 403); assert.equal(await raw('/ws', { Origin: `http://localhost:${S.puerto}`, Host: `localhost:${S.puerto}` }), 101); assert.equal(await raw('/otra'), 404);
});
await ok('estático: sirve el juego; bloquea tests, docs, datos y recorridos de directorio', async () => {
  assert.equal(await get('/restaurante.html'), 200); assert.equal(await get('/nucleo/game/main.js'), 200);
  for (const p of ['/nucleo/tests/sim.test.mjs', '/nucleo/docs/LEEME.md', '/nucleo/herramientas/servidor_nodo.mjs', '/nucleo/migrations/PROPUESTA_001_juego.sql', '/datos/x.json', '/..%2f..%2f..%2fetc%2fpasswd', '/%2e%2e/%2e%2e/etc/passwd', '/nucleo/game/main.js%00.png']) assert.ok([403, 404].includes(await get(p)), p);
});
await ok('persistencia: tras reiniciar el servidor, el jugador reconecta con su secreto y conserva dinero y lotes', async () => {
  const A = cli(); await A.listo; await A.espera(m => m.t === 'hola'); A.env({ t: 'crear', giro: 'cafeteria', nombre: 'Lola' }); const c = await A.espera(m => m.t === 'creada');
  A.env({ t: 'eco', id: 'p1', op: 'invertir', monto: 1400 }); await A.espera(m => m.t === 'res' && m.id === 'p1'); A.env({ t: 'eco', id: 'p2', op: 'comprar', lote: '1,0,00' }); await A.espera(m => m.t === 'res' && m.id === 'p2'); A.ws.close();
  await S.cerrar(); assert.ok(readdirSync(dir).some(f => f === c.id + '.json')); S = await iniciar({ puerto: 0, datos: dir });
  const B = cli(A.jid); await B.listo; await B.espera(m => m.t === 'hola'); B.env({ t: 'unir', sala: c.id, nombre: 'Lola' }); assert.equal((await B.espera(m => m.t === 'resp')).ok, true);
  const m = await B.espera(m => m.t === 'mundo'); assert.equal(m.mio.dinero, 1400 - 1260); assert.ok(m.lotes.some(l => l[0] === '1,0,00')); B.ws.close();
});
await S.cerrar(); rmSync(dir, { recursive: true, force: true });
console.log(`\n${n} pruebas OK`); process.exit(0);
