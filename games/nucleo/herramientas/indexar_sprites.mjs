// Uso (desde games/):
//   node nucleo/herramientas/indexar_sprites.mjs                    → solo valida e informa (no cambia nada)
//   node nucleo/herramientas/indexar_sprites.mjs --escribir-indice   → además escribe sprites/indice.json (acelera la carga)
// OJO: si generas indice.json, vuelve a generarlo cada vez que agregues o quites sprites; si no, el juego ignorará los nuevos.
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
const M = JSON.parse(readFileSync('nucleo/config/sprites.json', 'utf8')).items, conocidos = new Map(M.map(i => [i.n, i]));
const dim = f => { const b = readFileSync(f); return b.toString('ascii', 1, 4) === 'PNG' ? [b.readUInt32BE(16), b.readUInt32BE(20)] : null; };
const presentes = [], avisos = [];
for (const c of ['comun', 'restaurante', 'cafeteria']) {
  if (!existsSync(`sprites/${c}`)) continue;
  for (const f of readdirSync(`sprites/${c}`)) {
    if (f.startsWith('.')) continue;
    const n = f.replace(/\.png$/, '');
    if (!f.endsWith('.png') || !conocidos.has(n)) { avisos.push(`❓ sprites/${c}/${f}: el juego no usa ese nombre (¿errata?)`); continue; }
    const d = dim(`sprites/${c}/${f}`);
    if (!d) { avisos.push(`❌ sprites/${c}/${f}: no es un PNG válido`); continue; }
    const it = conocidos.get(n), hoja = /^(piel|ropa|pelo|gorro|cliente_ropa|empleado_cuerpo)/.test(n);
    if (hoja && (d[0] !== 64 || d[1] !== 96)) { avisos.push(`❌ sprites/${c}/${f}: mide ${d[0]}x${d[1]} y debe medir 64x96 (se ignorará)`); continue; }
    if (!hoja && (d[0] % 16 || d[1] % 16)) avisos.push(`⚠️ sprites/${c}/${f}: mide ${d[0]}x${d[1]}; lo normal es múltiplo de 16 (recomendado ${it.w}x${it.h})`);
    presentes.push(`${c}/${f}`);
  }
}
if (process.argv.includes('--escribir-indice')) { writeFileSync('sprites/indice.json', JSON.stringify(presentes.sort(), null, 1)); console.log('Escrito sprites/indice.json (regenéralo si cambias los sprites)'); }
const hay = new Set(presentes.map(p => p.split('/')[1].replace('.png', '')));
const faltan = [...conocidos.keys()].filter(n => !hay.has(n));
console.log(`Sprites encontrados: ${presentes.length} · faltan (usarán el dibujo por defecto): ${faltan.length} de ${conocidos.size}`);
avisos.forEach(a => console.log(a));
if (faltan.length) console.log('Faltan:', faltan.join(', '));
