// Ejecutar: node games/nucleo/tests/ciudad.test.mjs
import assert from 'node:assert/strict';
import { tile, generarChunk, Chunks, esSolido, NEGOCIO, CH, lotes, loteDe, trafico, LOTE_INICIAL } from '../world/ciudad.js';
let n = 0; const ok = (t, f) => { f(); n++; console.log('✓', t); };
ok('generación determinista y consistente entre chunk y casilla', () => {
  const a = generarChunk(7, -3, 5), b = generarChunk(7, -3, 5); assert.deepEqual(a, b);
  for (let y = 0; y < CH; y++) for (let x = 0; x < CH; x++) assert.equal(a.filas[y][x], tile(7, -3 * CH + x, 5 * CH + y));
  assert.notDeepEqual(generarChunk(7, 2, 2), generarChunk(8, 2, 2));
});
ok('lotes: ids únicos, cada puerta es una casilla "p" y su frente es caminable', () => {
  const ids = new Set(); for (let cy = -3; cy <= 3; cy++) for (let cx = -3; cx <= 3; cx++) for (const l of lotes(7, cx, cy)) {
    assert.ok(!ids.has(l.id)); ids.add(l.id); assert.equal(tile(7, l.puerta.x, l.puerta.y), 'p'); assert.equal(esSolido(tile(7, Math.floor(l.frente.x), Math.floor(l.frente.y))), false, l.id); assert.equal(loteDe(7, l.id).id, l.id); }
  assert.deepEqual(loteDe(7, LOTE_INICIAL).puerta, NEGOCIO.puerta); assert.equal(tile(7, Math.floor(NEGOCIO.aparece.x), Math.floor(NEGOCIO.aparece.y)), 'g');
  assert.equal(loteDe(7, '0,0,11'), null, 'un parque no es lote'); assert.equal(loteDe(7, 'basura'), null); assert.equal(trafico(loteDe(7, LOTE_INICIAL)), 10);
});
ok('calles y banquetas forman una red continua y alcanzable desde el negocio', () => {
  const ch = new Chunks({ seed: 7, radio: 3 }); ch.forzar(2.5, 11.5);
  const ini = [2, 11], vis = new Set([ini + ''] ), q = [ini]; let calles = 0;
  for (let i = 0; i < q.length && i < 20000; i++) { const [x, y] = q[i]; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy, k = nx + ',' + ny; if (vis.has(k) || esSolido(ch.tile(nx, ny))) continue; vis.add(k); q.push([nx, ny]); } }
  for (const [x, y] of q) if (ch.tile(x, y) === '.') calles++;
  assert.ok(calles > 200, 'calles alcanzables ' + calles);
  assert.ok(vis.has('23,7') && vis.has('7,23') && vis.has('-9,7'), 'cruces vecinos alcanzables');
});
ok('toda puerta ajena tiene casilla caminable al frente', () => {
  for (let y = -64; y < 64; y++) for (let x = -64; x < 64; x++) if (tile(3, x, y) === 'p') { const f = [tile(3, x, y + 1), tile(3, x, y - 1)]; assert.ok(f.some(c => !esSolido(c)), `puerta ${x},${y}`); }
});
ok('gestor: carga por presupuesto, sin duplicados, ordenado por cercanía', () => {
  const g = new Chunks({ seed: 7, radio: 2, presupuesto: 3 }); g.actualizar(8, 8);
  assert.equal(g.m.size, 25); assert.equal(g.paso(), 3);
  assert.equal(g.obtener(0, 0)?.estado, 'listo', 'el chunk del jugador se carga primero');
  g.actualizar(8, 8); g.actualizar(9, 9); assert.equal(g.m.size, 25, 'sin duplicados al repetir');
  while (g.paso()); assert.equal(g.stats.generados, 25);
});
ok('gestor: libera lejanos con histéresis y recarga al volver', () => {
  const g = new Chunks({ seed: 7, radio: 1, margen: 1 }); g.forzar(8, 8);
  g.forzar(8 + 16 * 2, 8); assert.equal(g.obtener(0, 0) !== null, true, 'dentro del margen se conserva');
  g.forzar(8 + 16 * 5, 8); assert.equal(g.obtener(0, 0), null, 'fuera del margen se libera'); assert.ok(g.stats.liberados > 0);
  g.forzar(8, 8); assert.equal(g.tile(2, 12), 'p');
});
ok('chunk sin cargar se comporta como muro (no se puede cruzar el vacío)', () => { const g = new Chunks({ seed: 7 }); assert.equal(esSolido(g.tile(500, 500)), true); });
console.log(`\n${n} pruebas OK`);
