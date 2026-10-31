// Contratos de catering (PURO, lógica del servidor): ofertas con plazo, pago por turno, depósito y penalización.
// Todos ven las mismas ofertas (se generan de seed+turno) y quien llega primero se las queda: se compite por ellas.
// El riesgo es real: el contrato reserva capacidad de cocina ANTES que los clientes habituales, así que uno grande puede saturar el local;
// si el local no puede cumplir se pierde el pago, se paga una multa y, al final, el depósito.
import { azar, hash } from '../economia/mercado.js';
export const VENTANA_C = 40, MAX_POR_JUGADOR = 2, OFERTAS_POR_VENTANA = 3, CUMPLIMIENTO = .9;
const CLIENTES = ['Oficinas Delta', 'Boda García', 'Congreso Médico', 'Feria del Libro', 'Club Deportivo', 'Colegio San Lucas', 'Productora Luna', 'Hotel Mirador', 'Cámara de Comercio'];
export const ventanaDe = turno => Math.floor(Math.max(0, turno) / VENTANA_C);
export function ofertasVentana(seed, w) {
  const r = [];
  for (let i = 0; i < OFERTAS_POR_VENTANA; i++) {
    const req = Math.round((.5 + (hash(seed, w, i, 1) % 16) * .1) * 10) / 10, plazo = 10 + hash(seed, w, i, 2) % 17, pago = Math.round(req * (80 + 60 * azar(seed, w, i, 3)));
    r.push({ id: `c${w}.${i}`, w, cliente: CLIENTES[hash(seed, w, i, 4) % CLIENTES.length], req, plazo, pago, deposito: Math.round(pago * plazo * .2), penal: Math.round(pago * .6), bono: Math.round(pago * plazo * .1) });
  }
  return r;
}
export const capacidad = (o, ef, hab = o.ger?.hab ?? 0) => 1.35 + .3 * ((o.nivel ?? 1) - 1) + ef.capF + .05 * hab;
export function ofertasAbiertas(m) {
  const tomadas = new Set([...m.cont.values()].map(c => c.oferta)); for (const h of m.hechas) tomadas.add(h);
  return ofertasVentana(m.seed, ventanaDe(m.turno)).filter(o => !tomadas.has(o.id));
}
export function opContrato(m, p, msg) {
  const o = typeof msg.lote === 'string' ? m.o.get(msg.lote) : null; if (!o || o.dueno !== p.cid || o.tipo !== 'franquicia') return { ok: false, msg: 'Esa franquicia no es tuya' };
  const of = ofertasAbiertas(m).find(x => x.id === msg.oferta); if (!of) return { ok: false, msg: 'Esa oferta ya no está disponible' };
  if (m.cont.has(msg.lote)) return { ok: false, msg: 'Esa franquicia ya tiene un contrato' };
  let propios = 0; for (const c of m.cont.values()) if (c.cid === p.cid) propios++; if (propios >= MAX_POR_JUGADOR) return { ok: false, msg: `Máximo ${MAX_POR_JUGADOR} contratos a la vez` };
  if (p.dinero < of.deposito) return { ok: false, msg: `Necesitas $${of.deposito} de depósito (se devuelve si cumples)` };
  m._mov(p, 'deposito', -of.deposito);
  m.cont.set(msg.lote, { oferta: of.id, cid: p.cid, lote: msg.lote, cliente: of.cliente, req: of.req, pago: of.pago, penal: of.penal, deposito: of.deposito, bono: of.bono, desde: m.turno, hasta: m.turno + of.plazo, ent: 0, n: 0 });
  m._ev(p, `Contrato con ${of.cliente} en ${msg.lote}`); m._noticia('mercado', `${p.nombre} firmó un contrato de catering con ${of.cliente}.`);
  return { ok: true, msg: `Contrato con ${of.cliente}: $${of.pago} por turno durante ${of.plazo} turnos. Exige ${Math.round(of.req * 100)}% de capacidad.` };
}
// Reserva de capacidad de un turno para el contrato de esa franquicia (la usa Mundo._calcular)
export function reservar(m, id, cap) { const c = m.cont.get(id); if (!c) return { take: 0, c: null, f: 0 }; const take = Math.min(c.req, Math.max(0, cap)); return { take, c, f: take / c.req }; }
// Fin de turno: anota lo entregado, cierra contratos vencidos y cancela los que perdieron a su dueño
export function liquidar(m, resultados) {
  for (const [id, c] of [...m.cont]) {
    const p = m.j.get(c.cid), o = m.o.get(id), r = resultados.get(id);
    if (!p || !o || o.dueno !== c.cid) { m.cont.delete(id); m.hechas.push(c.oferta); if (p) m._noticia('economia', `${p.nombre} pierde el contrato con ${c.cliente}: ya no controla esa franquicia.`, p.npc ? null : p.cid); continue; }
    if (r) { c.n++; c.ent += r.f; }
    if (m.turno < c.hasta) continue;
    const prom = c.n ? c.ent / c.n : 0; m.cont.delete(id); m.hechas.push(c.oferta); if (m.hechas.length > 200) m.hechas.shift();
    if (prom >= CUMPLIMIENTO) { m._mov(p, 'deposito', c.deposito); m._mov(p, 'contrato', c.bono); o.rep = Math.min(10, (o.rep ?? 5) + .5); m._noticia('mercado', `${p.nombre} cumplió su contrato con ${c.cliente}.`); m._ev(p, `Cumpliste con ${c.cliente}: depósito devuelto y bono de $${c.bono}`); }
    else { o.rep = Math.max(0, (o.rep ?? 5) - 1); m._noticia('economia', `${p.nombre} incumplió su contrato con ${c.cliente}.`); m._ev(p, `Incumpliste con ${c.cliente}: perdiste el depósito de $${c.deposito}`); }
  }
}
export const serializar = m => ({ cont: [...m.cont.values()], hechas: m.hechas.slice(-200) });
export function restaurar(m, d) {
  const n = (x, a, b, def) => (Number.isFinite(x) ? Math.min(b, Math.max(a, x)) : def); m.cont = new Map(); m.hechas = (Array.isArray(d?.hechas) ? d.hechas : []).filter(x => typeof x === 'string').slice(-200).map(x => x.slice(0, 16));
  for (const c of Array.isArray(d?.cont) ? d.cont : []) {
    if (!c || typeof c.lote !== 'string' || typeof c.cid !== 'string' || !m.o.has(c.lote) || m.o.get(c.lote).dueno !== c.cid) continue;
    m.cont.set(c.lote, { oferta: String(c.oferta).slice(0, 16), cid: c.cid, lote: c.lote, cliente: String(c.cliente).slice(0, 30), req: n(c.req, .1, 3, .5), pago: Math.floor(n(c.pago, 0, 1e6, 0)), penal: Math.floor(n(c.penal, 0, 1e6, 0)), deposito: Math.floor(n(c.deposito, 0, 1e7, 0)), bono: Math.floor(n(c.bono, 0, 1e7, 0)), desde: Math.floor(n(c.desde, 0, 1e9, 0)), hasta: Math.floor(n(c.hasta, 0, 1e9, 0)), ent: n(c.ent, 0, 1e6, 0), n: Math.floor(n(c.n, 0, 1e6, 0)) });
  }
}
export const vistaC = (m, cid) => ({ ofertas: ofertasAbiertas(m).map(o => ({ ...o })), mios: [...m.cont.values()].filter(c => c.cid === cid).map(c => ({ ...c, quedan: c.hasta - m.turno, prom: c.n ? Math.round(c.ent / c.n * 100) / 100 : null })), cierraEn: (ventanaDe(m.turno) + 1) * VENTANA_C - m.turno });
