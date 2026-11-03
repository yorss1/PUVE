// Ejecutar: node games/nucleo/tests/ciudades.test.mjs   (ciudades variadas: invariantes, caminabilidad, variedad)
import assert from 'node:assert/strict';
import { tile, esSolido, lotes, loteDe, trafico, LOTE_INICIAL, CH, Chunks } from '../world/ciudad.js';
import { CIUDADES, esNueva, ciudadDe, distritoChunk, DISTRITOS, hitosCerca, agua, profMar, cuadrante, lugarEn, nombreCiudad } from '../world/ciudades.js';
import { perfilBarrio, eventosEntre, TIPOS_EVENTO } from '../economia/mercado.js';
import { Mundo, precioLote } from '../multiplayer/mundo.js';
let n = 0; const ok = (t, f) => { f(); n++; console.log('✓', t); };
const R = 7;                                                              // radio en chunks que se revisa
const walk = (seed, x, y) => !esSolido(tile(seed, x, y));

ok('catálogo: 6 ciudades con semilla propia, distintas entre sí y la clásica sigue siendo la de siempre', () => {
  assert.equal(CIUDADES.length, 6); assert.equal(new Set(CIUDADES.map(c => c.seed)).size, 6); assert.equal(new Set(CIUDADES.map(c => c.nombre)).size, 6);
  for (const c of CIUDADES) { assert.ok(esNueva(c.seed)); assert.equal(ciudadDe(c.seed).id, c.id); assert.ok(c.desc.length > 30); }
  assert.equal(esNueva(7), false); assert.equal(nombreCiudad(7), 'Ciudad clásica'); assert.equal(trafico(loteDe(7, '0,0,01')), 10); assert.equal(tile(7, 2, 12), 'p');
  const huella = s => { let h = 0; for (let gy = -40; gy < 40; gy++) for (let gx = -40; gx < 40; gx++) h = (h * 31 + tile(s, gx, gy).charCodeAt(0)) | 0; return h; };
  const hs = CIUDADES.map(c => huella(c.seed)); assert.equal(new Set(hs).size, 6, 'cada ciudad se ve distinta'); assert.equal(huella(7), huella(7));
});
for (const C of CIUDADES) {
  const S = C.seed;
  ok(`${C.nombre}: determinista, el inicio es seco y el lote inicial es un edificio válido`, () => {
    for (let i = 0; i < 400; i++) { const gx = (i * 37) % 300 - 150, gy = (i * 91) % 300 - 150; assert.equal(tile(S, gx, gy), tile(S, gx, gy)); }
    for (let gy = -28; gy <= 28; gy++) for (let gx = -28; gx <= 28; gx++) assert.equal(agua(S, gx, gy), false, 'zona de inicio seca');
    const l = loteDe(S, LOTE_INICIAL); assert.ok(l, 'existe el lote inicial'); assert.equal(l.hito, null); assert.equal(tile(S, l.puerta.x, l.puerta.y), 'p'); assert.equal(esNueva(l.seed), true);
    const a = new Chunks({ seed: S, radio: 1 }); a.forzar(8, 8); const b = new Chunks({ seed: S, radio: 1 }); b.forzar(8, 8); assert.deepEqual(a.obtener(0, 0).filas, b.obtener(0, 0).filas);
  });
  ok(`${C.nombre}: calles y banquetas siempre se pueden caminar (el agua tiene puentes) y cada lote es válido`, () => {
    let puentes = 0, lots = 0, ids = new Set();
    for (let cy = -R; cy <= R; cy++) for (let cx = -R; cx <= R; cx++) {
      for (let ly = 0; ly < CH; ly++) for (let lx = 0; lx < CH; lx++) {
        const ch = tile(S, cx * CH + lx, cy * CH + ly); if ((lx >= 5 && lx <= 10) || (ly >= 5 && ly <= 10)) { if (ch === 'v') puentes++; const calz = (lx >= 6 && lx <= 9) || (ly >= 6 && ly <= 9); const mar = ch === 'w' && profMar(S, cx * CH + lx, cy * CH + ly) > 7; if (!calz && !mar && ',lTv'.includes(ch) === false) assert.fail(`banqueta rara ${ch}`); if (calz && !mar && !'.evf'.includes(ch)) assert.fail(`calzada rara ${ch}`); if (esSolido(ch) && ch !== 'l' && ch !== 'T' && ch !== 'f' && !(ch === 'w' && profMar(S, cx * CH + lx, cy * CH + ly) > 7)) assert.fail(`pasillo bloqueado por ${ch} en ${cx * CH + lx},${cy * CH + ly}`); }
      }
      for (const l of lotes(S, cx, cy)) {
        lots++; assert.ok(!ids.has(l.id)); ids.add(l.id); assert.equal(loteDe(S, l.id).id, l.id); assert.equal(tile(S, l.puerta.x, l.puerta.y), 'p');
        const f = { x: Math.floor(l.frente.x), y: Math.floor(l.frente.y) }; assert.ok(walk(S, f.x, f.y), 'frente caminable ' + l.id); assert.notEqual(tile(S, f.x, f.y), 'w');
        const lyc = l.qy ? l.puerta.y - 2 : l.puerta.y + 2; assert.ok(walk(S, l.puerta.x, lyc), 'la banqueta frente a la puerta se puede pisar ' + l.id);
        for (let by = 0; by < 3; by++) for (let bx = -1; bx <= 1; bx++) assert.ok('Hp'.includes(tile(S, l.puerta.x + bx, l.qy ? l.puerta.y + by : l.puerta.y - by)), 'cuerpo del edificio ' + l.id);
        assert.ok(trafico(l) >= 1 && trafico(l) <= 14); assert.ok(precioLote(l) >= 420);
      }
    }
    assert.ok(lots > 300, 'hay lotes suficientes: ' + lots); if (C.rio || C.mar) assert.ok(puentes > 0, 'el agua se cruza con puentes o muelles');
  });
  ok(`${C.nombre}: todo lo que se puede comprar se puede alcanzar a pie desde el inicio`, () => {
    const lim = 5 * CH, ini = loteDe(S, LOTE_INICIAL), q = [[Math.floor(ini.frente.x), Math.floor(ini.frente.y)]], vis = new Set([q[0].join()]);
    for (let i = 0; i < q.length; i++) { const [x, y] = q[i]; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy, k = nx + ',' + ny; if (Math.abs(nx) > lim + 20 || Math.abs(ny) > lim + 20 || vis.has(k) || !walk(S, nx, ny)) continue; vis.add(k); q.push([nx, ny]); } }
    let total = 0, alcanzables = 0; for (let cy = -5; cy <= 4; cy++) for (let cx = -5; cx <= 4; cx++) for (const l of lotes(S, cx, cy)) { total++; if (vis.has(Math.floor(l.frente.x) + ',' + Math.floor(l.frente.y))) alcanzables++; }
    assert.equal(alcanzables, total, `${total - alcanzables} de ${total} lotes sin camino`);
  });
  ok(`${C.nombre}: es variada (varios distritos, tipos de casilla, hitos y tráfico desigual)`, () => {
    const tipos = new Set(), chars = new Set(), tr = []; let hitos = 0; const man = new Set();
    for (let cy = -R; cy <= R; cy++) for (let cx = -R; cx <= R; cx++) {
      tipos.add(distritoChunk(S, cx, cy).tipo); for (let qx = 0; qx < 2; qx++) for (let qy = 0; qy < 2; qy++) man.add(cuadrante(S, cx, cy, qx, qy).t);
      for (let ly = 0; ly < CH; ly += 2) for (let lx = 0; lx < CH; lx += 2) chars.add(tile(S, cx * CH + lx, cy * CH + ly)); for (const l of lotes(S, cx, cy)) { tr.push(trafico(l)); if (l.hito) hitos++; }
    }
    assert.ok(tipos.size >= 5, `distritos: ${[...tipos]}`); assert.ok(chars.size >= 12, `casillas: ${[...chars].join('')}`); assert.ok(man.size >= 5, `manzanas: ${[...man]}`); assert.ok(hitos >= 4, 'hitos: ' + hitos); assert.ok(Math.max(...tr) - Math.min(...tr) >= 5, 'tráfico desigual');
    assert.ok(DISTRITOS[distritoChunk(S, 0, 0).tipo], 'el centro tiene un tipo conocido'); assert.match(lugarEn(S, 8, 8), new RegExp(C.nombre));
  });
}
ok('agua: Puerto Azul tiene mar, Villa Dorada un río, Valle Verde lagos y las otras ciudades no se inundan', () => {
  const frac = seed => { let w = 0, t = 0; for (let gy = -200; gy <= 200; gy += 8) for (let gx = -200; gx <= 200; gx += 8) { t++; if (agua(seed, gx, gy)) w++; } return w / t; };
  assert.ok(frac(1001) > .15, 'mar'); assert.ok(frac(1000) > .006 && frac(1000) < .3, 'río: ' + frac(1000)); assert.ok(frac(1005) > frac(1000), 'el río de la metrópoli es más ancho'); assert.equal(frac(1003), 0); assert.equal(frac(1004), 0);
  let lagos = 0; for (let cy = -R; cy <= R; cy++) for (let cx = -R; cx <= R; cx++) for (let ly = 0; ly < CH; ly++) for (let lx = 0; lx < CH; lx++) if (tile(1002, cx * CH + lx, cy * CH + ly) === 'w') lagos++; assert.ok(lagos > 40, 'Valle Verde tiene lagos o río');
});
ok('mercado: los barrios heredan el carácter del distrito y hay eventos propios de cada zona', () => {
  const nombres = new Set(), dist = new Set(); for (const c of CIUDADES) for (let b = -3; b <= 3; b++) for (let a = -3; a <= 3; a++) { const p = perfilBarrio(c.seed, `${a},${b}`); nombres.add(p.nombre); dist.add(p.distrito); const s = Object.values(p.seg).reduce((x, y) => x + y, 0); assert.ok(Math.abs(s - 1) < 1e-9); assert.ok(p.nombre.length > 3); }
  assert.ok(nombres.size > 40 && dist.size >= 6); assert.equal(perfilBarrio(1000, '0,0').nombre, 'Centro');
  const campus = []; for (let b = -3; b <= 3; b++) for (let a = -3; a <= 3; a++) { const p = perfilBarrio(1000, `${a},${b}`); if (p.distrito === 'campus') campus.push(p); } if (campus.length) assert.equal(campus[0].dom, 'estudiantes', 'el campus es de estudiantes');
  const vistos = new Set(); for (const c of CIUDADES) for (let t = 0; t < 2500; t += 7) for (const e of eventosEntre(c.seed, t)) { vistos.add(e.tipo); if (TIPOS_EVENTO[e.tipo].distritos) assert.ok(TIPOS_EVENTO[e.tipo].distritos.includes(perfilBarrio(c.seed, e.barrio).distrito), `${e.tipo} en ${e.barrio}`); }
  assert.ok(['regata', 'feria_libro', 'tianguis', 'desfile', 'concierto'].filter(x => vistos.has(x)).length >= 3, 'aparecen eventos de distrito: ' + [...vistos]);
  const legado = new Set(); for (let t = 0; t < 3000; t += 7) for (const e of eventosEntre(7, t)) legado.add(e.tipo); assert.ok(![...legado].some(t => TIPOS_EVENTO[t].distritos), 'la ciudad clásica no cambia sus eventos');
});
ok('economía: un mundo en una ciudad nueva funciona (precios, rivales, subastas) y el tráfico fija el precio', () => {
  const c = { t: 1e6 }; const m = new Mundo({ ahora: () => c.t, seed: 1001 }); m.giro = 'restaurante'; m.alta('H', 'Yo'); m.sembrar(3); assert.equal(m.j.get('H').hogar, LOTE_INICIAL);
  for (let i = 0; i < 80; i++) { c.t += 10000; m.avanzar(); } for (const [id, o] of m.o) { const l = m.lote(id); assert.ok(l && l.seed === 1001, 'lote de la ciudad nueva'); assert.ok(precioLote(l) === 300 + 120 * trafico(l)); }
  for (const p of m.j.values()) assert.equal(Object.values(p.c).reduce((a, b) => a + b, 0), p.dinero); assert.ok([...m.o.values()].filter(o => o.tipo === 'franquicia').length >= 3, 'los rivales abren negocios en la ciudad nueva');
  const t0 = performance.now(); const ch = new Chunks({ seed: 1000, radio: 3 }); ch.forzar(0, 0); assert.ok(performance.now() - t0 < 1500, 'generar 49 chunks tarda poco: ' + (performance.now() - t0));
});
console.log(`\n${n} pruebas OK`);
