// Ejecutar: node games/nucleo/tests/paneles.test.mjs   (humo de la interfaz con un DOM simulado: abre cada panel y pulsa todos los botones)
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { Sim } from '../game/sim.js';
import { Servidor } from '../multiplayer/servidor.js';
import { TURNO_MS } from '../multiplayer/mundo.js';
import { loteDe } from '../world/ciudad.js';
import { crearPaneles } from '../game/paneles.js';
let n = 0; const ok = async (t, f) => { await f(); n++; console.log('✓', t); };

class N { constructor(tag) { this.tag = tag; this.hijos = []; this.style = {}; this.className = ''; this.textContent = ''; this.disabled = false; this.classList = { add() {} }; }
  appendChild(c) { this.hijos.push(c); return c; } append(...c) { c.forEach(x => x && this.hijos.push(x)); } setAttribute() {} }
const el = (tag, cls, t) => { const e = new N(tag); if (cls) e.className = cls; if (t != null) e.textContent = t; return e; };
const texto = x => (x ? x.textContent + ' ' + x.hijos.map(texto).join(' ') : '');
const botones = (x, r = []) => { if (x.tag === 'button') r.push(x); x.hijos.forEach(h => botones(h, r)); return r; };

async function montar(giro = 'restaurante', existente = null) {
  let T = 1e6; const clk = { t: () => T }; const srv = existente || new Servidor({ ahora: clk.t, rivales: 3 }); if (!existente) srv.manejar('solo', { t: 'crear', giro, nombre: 'Ana' });
  const cfg = JSON.parse(readFileSync(new URL(`../config/${giro}.json`, import.meta.url))); const sim = new Sim(cfg, null, () => .5); sim.d.dinero = 3000; sim.d.xp = 600; sim.comprar('emp1'); sim.d.stock = 20;
  let k = 0, ultimo = null, cerrado = 0; const mundo = () => ({ ...srv.mundo.vista('solo') });
  const eco = async (op, extra = {}) => srv.manejar('solo', { t: 'eco', id: 'e' + k++, op, ...extra })[0].msg;
  const perfil = {}, ctx = { el, txt: (t, cls) => el('p', 'nota ' + (cls || ''), t), btn: (t, f, dis) => { const b = el('button', 'b', t); b.disabled = !!dis; b.onclick = f; return b; },
    sec: (t, ...h) => { const s = el('section'); if (t) s.appendChild(el('h3', '', t)); h.forEach(x => x && s.appendChild(x)); return s; }, stat: (l, v) => { const f = el('div'); f.append(el('span', '', l), el('b', '', v)); return f; }, chip: t => el('span', 'chip', t), icono: () => el('span'),
    abrir: (titulo, filas, o = {}) => { ultimo = { titulo, raiz: Object.assign(el('div'), { hijos: filas.filter(Boolean) }), o }; }, aviso() {}, audio: { tono() {} }, eco, sim, perfil, store: { guardarPerfil() {} }, guardar() {}, mundo, net: () => ({ cid: 'solo' }),
    volver() {}, loteDe: id => loteDe(7, id), panelLote() {}, cerrarTienda: () => { cerrado++; } };
  const P = crearPaneles(ctx); return { P, srv, sim, perfil, avanza: t => { T += t; srv.difundir(); }, panel: () => ultimo, cerrado: () => cerrado, eco };
}
const libro = p => Object.values(p.c).reduce((a, b) => a + b, 0);

for (const giro of ['restaurante', 'cafeteria']) await ok(`${giro}: cada panel se abre sin errores y muestra lo esencial`, async () => {
  const { P, srv, avanza, panel } = await montar(giro); await P.eco?.('x'); await srv.manejar('solo', { t: 'eco', id: 'i', op: 'invertir', monto: 1000 }); avanza(TURNO_MS * 12);
  P.panelEmpresa(); assert.match(texto(panel().raiz), /Etapa 1.*Sobrevivir/s); assert.match(texto(panel().raiz), /Logros/);
  P.panelMercado(); assert.match(texto(panel().raiz), /Tu barrio/); assert.match(texto(panel().raiz), /Rivales/); assert.match(texto(panel().raiz), /Agresivo|Estratega|Tradicionalista|Oportunista/);
  P.panelPersonal(); assert.match(texto(panel().raiz), /Habilidad/); P.panelProveedores(); assert.match(texto(panel().raiz), /Mayorista/); P.panelDesarrollo(); assert.match(texto(panel().raiz), /Cocina automatizada/);
  const fin = P.seccionFinanzas(() => {}); assert.match(texto(fin[0]), /Deuda/);
  assert.ok(P.stats().jugadores >= 4); assert.equal(P.etapa(), 1);
});
await ok('monkey: pulsar todos los botones habilitados de todos los paneles no rompe nada ni el libro de dinero', async () => {
  const { P, srv, sim, avanza, panel } = await montar(); await srv.manejar('solo', { t: 'eco', id: 'i', op: 'invertir', monto: 1500 }); avanza(TURNO_MS * 3);
  const lote = [...srv.mundo.o].find(([, o]) => o.dueno === 'solo' && o.tipo === 'hogar')[0]; void lote;
  const m = srv.mundo; const libre = '1,0,00'; assert.equal(m.op('solo', { id: 'c1', op: 'comprar', lote: libre }).ok, true);
  const abrirTodos = [() => P.panelEmpresa(), () => P.panelMercado(), () => P.panelPersonal(), () => P.panelProveedores(), () => P.panelDesarrollo(), () => P.panelGestion(libre)];
  for (let ronda = 0; ronda < 3; ronda++) for (const abre of abrirTodos) {
    abre(); const bs = botones(panel().raiz).filter(b => !b.disabled); for (const b of bs) { try { await b.onclick(); } catch (e) { assert.fail(`${panel().titulo} / "${b.textContent}": ${e.stack}`); } abre(); }
    avanza(TURNO_MS * 2); sim.d.dinero = Math.max(sim.d.dinero, 1000);
    for (const p of m.j.values()) { assert.equal(libro(p), p.dinero, `libro ${p.nombre} tras ${panel().titulo}`); assert.ok(p.dinero >= 0 && p.deuda >= 0); }
    assert.ok(sim.d.dinero >= 0 && sim.d.st.apuros >= 0);
  }
});
await ok('gestión de franquicia: los controles llegan al servidor y cambian el estado real', async () => {
  const { P, srv, panel } = await montar(); const m = srv.mundo; m._mov(m.j.get('solo'), 'aporte', 3000); assert.equal(m.op('solo', { id: 'c1', op: 'comprar', lote: '1,0,00' }).ok, true);
  P.panelGestion('1,0,00'); const clic = async t => { const b = botones(panel().raiz).find(x => x.textContent.startsWith(t) && !x.disabled); assert.ok(b, 'botón ' + t); await b.onclick(); P.panelGestion('1,0,00'); };
  await clic('+12%'); assert.equal(m.o.get('1,0,00').p, 3); await clic('Promoción'); assert.ok(m.o.get('1,0,00').promo > m.turno); await clic('Recortar'); assert.equal(m.o.get('1,0,00').recorte, true);
  await clic('Poner en venta'); assert.ok(m.o.get('1,0,00').enVenta > 0); await clic('Retirar de la venta'); assert.equal(m.o.get('1,0,00').enVenta, null);
  const g = botones(panel().raiz).find(x => /^Hab\. 3/.test(x.textContent)); assert.ok(g.disabled, 'el gerente exige la etapa 3 en la interfaz');
});
await ok('informe de regreso: aparece tras una ausencia y se cierra al leerlo', async () => {
  const { srv } = await montar(); await srv.manejar('solo', { t: 'eco', id: 'i', op: 'invertir', monto: 1500 }); srv.mundo.op('solo', { id: 'c', op: 'comprar', lote: '1,0,00' }); const d = JSON.parse(JSON.stringify(srv.exportar()));
  const s2 = new Servidor({ ahora: () => 1e6 + 2 * 3600e3 + 5e3, rivales: 3 }); assert.equal(s2.importar(d), true); assert.ok(s2.mundo.j.get('solo').informe);
  const { P, panel, cerrado } = await montar('restaurante', s2); P.panelInforme(); assert.equal(panel().titulo, 'Mientras no estabas'); assert.match(texto(panel().raiz), /Patrimonio/); assert.match(texto(panel().raiz), /Entendido/);
  const b = botones(panel().raiz).find(x => x.textContent === 'Entendido'); await b.onclick(); assert.equal(s2.mundo.j.get('solo').informe, null); assert.equal(cerrado(), 1);
  const sin = await montar(); sin.P.panelInforme(); assert.equal(sin.panel(), null, 'sin informe no abre nada');
});
console.log(`\n${n} pruebas OK`);
