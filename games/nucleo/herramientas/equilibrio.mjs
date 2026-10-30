// Mide el equilibrio entre giros con un jugador-bot que atiende lo mejor posible (teletransportándose: mide la capacidad del local, no el paseo).
// Uso: node games/nucleo/herramientas/equilibrio.mjs [minutos=12]
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Sim } from '../game/sim.js';
const cargar = g => JSON.parse(readFileSync(new URL(`../config/${g}.json`, import.meta.url)));
export function jugar(giro, minutos = 12, semilla = 7, { comprar = true } = {}) {
  let s0 = semilla; const rnd = () => (s0 = (s0 * 16807) % 2147483647) / 2147483647, s = new Sim(cargar(giro), null, rnd), dt = 1 / 30, ir = (o, dy = 1.5) => Object.assign(s.p, { x: o.x + .5, y: o.y + dy });
  const inicio = s.d.dinero, serie = [];
  for (let i = 0; i < minutos * 60 / dt; i++) {
    s.tick(dt);
    const c = s.clientes.find(c => c.st === 'pide'); if (c) { Object.assign(s.p, { x: c.seat.x + .5, y: c.seat.y + .5 }); s.accion(); }
    for (const e of s.est) { if (s.tickets.some(t => t.estado === 'listo' || (t.estado === 'cola' && !e.tk))) { ir(e); s.accion(); } }
    const w = s.clientes.find(c => c.st === 'espera' && s.llevando === c.tk); if (w) { Object.assign(s.p, { x: w.seat.x + .5, y: w.seat.y + .5 }); s.accion(); }
    if (s.cuentas.length) { ir(s.cajas[0]); s.accion(); }
    if (s.d.stock < 2 && s.d.dinero >= s.costoSurtir()) { ir(s.refris[0]); s.accion(); }
    if (comprar && i % 30 === 0) for (const m of s.cfg.mejoras) if (!s.d.comp.includes(m.id) && s.d.dinero >= m.costo * 1.6 && s.nivel >= (m.nivel || 1)) s.comprar(m.id);
    if (i % Math.round(60 / dt) === 0) serie.push(Math.round(s.d.dinero));
  }
  const st = s.d.st; return { giro, dinero: s.d.dinero - inicio, porMin: (s.d.dinero - inicio) / minutos, servidos: st.servidos, perdidos: st.perdidos, nivel: s.nivel, xp: s.d.xp, xpMin: s.d.xp / minutos, rep: +s.d.rep.toFixed(1), serie };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const min = Number(process.argv[2]) || 12;
  for (const comprar of [false, true]) {
    console.log(comprar ? '\n== con compras automáticas ==' : '== sin compras (capacidad base) ==');
    const r = ['restaurante', 'cafeteria'].map(g => jugar(g, min, 7, { comprar }));
    for (const x of r) console.log(`${x.giro.padEnd(12)} $/min ${x.porMin.toFixed(1).padStart(7)}  servidos ${String(x.servidos).padStart(4)}  perdidos ${String(x.perdidos).padStart(3)}  nivel ${x.nivel}  xp/min ${x.xpMin.toFixed(1)}  rep ${x.rep}`);
    console.log('razón cafetería/restaurante: $/min', (r[1].porMin / r[0].porMin).toFixed(2), ' xp/min', (r[1].xpMin / r[0].xpMin).toFixed(2));
  }
}
