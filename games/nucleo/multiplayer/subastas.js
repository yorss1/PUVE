// Subastas de propiedades (PURO, lógica del servidor).
//  - Un jugador puede subastar una de sus franquicias (sigue produciendo para él hasta que cierre).
//  - La ciudad subasta periódicamente el mejor lote libre (el dinero de esas ventas sale del juego).
// La puja se retiene (custodia) en el momento de pujar: no se puede gastar dos veces ni quedar sin fondos al cerrar.
// Transparente: todos ven la puja líder, quién la hizo y cuándo cierra. Las pujas de último momento extienden el cierre (máx. 3 veces).
import { trafico, lotes, distLotes } from '../world/ciudad.js';
import { perfilBarrio, barrioDeLote } from '../economia/mercado.js';
export const SUB_TURNOS = 12, SNIPE = 2, MAX_EXT = 3, CIUDAD_CADA = 50, CIUDAD_BASE = .55, MIN_BASE = .4, MAX_BASE = 1.2;
const fail = msg => ({ ok: false, msg });
export const minimaPuja = s => (s.mejor ? Math.max(s.mejor.monto + 10, Math.ceil(s.mejor.monto * 1.05)) : s.base);
const valorBase = (m, id, o) => 300 + 120 * trafico(m.lote(id)) + (o?.invertido || 0);
export function opSubastar(m, p, msg) {
  const o = typeof msg.lote === 'string' ? m.o.get(msg.lote) : null; if (!o || o.dueno !== p.cid || o.tipo !== 'franquicia') return fail('Esa franquicia no es tuya');
  if (m.sub.has(msg.lote)) return fail('Ya está en subasta'); if (o.enVenta != null) return fail('Retírala de la venta antes de subastarla'); if (m.cont.has(msg.lote)) return fail('Termina primero tu contrato de catering');
  const ref = valorBase(m, msg.lote, o), base = msg.base == null ? Math.round(.6 * ref) : msg.base;
  if (!Number.isSafeInteger(base) || base < Math.round(MIN_BASE * ref) || base > Math.round(MAX_BASE * ref)) return fail(`Pon un precio base entre $${Math.round(MIN_BASE * ref)} y $${Math.round(MAX_BASE * ref)}`);
  m.sub.set(msg.lote, { lote: msg.lote, vendedor: p.cid, base, mejor: null, cierra: m.turno + SUB_TURNOS, ext: 0, ciudad: false });
  m._noticia('mercado', `${p.nombre} subasta una franquicia en ${perfilBarrio(m.seed, barrioDeLote(m.lote(msg.lote))).nombre} desde $${base}.`);
  return { ok: true, msg: `Subasta abierta desde $${base}. Cierra en ${SUB_TURNOS} turnos.` };
}
export function opRetirarSubasta(m, p, msg) {
  const s = m.sub.get(msg.lote); if (!s || s.vendedor !== p.cid) return fail('No es tu subasta'); if (s.mejor) return fail('Ya hay pujas: no se puede retirar');
  m.sub.delete(msg.lote); return { ok: true, msg: 'Subasta retirada' };
}
export function opPujar(m, p, msg) {
  const s = typeof msg.lote === 'string' ? m.sub.get(msg.lote) : null; if (!s) return fail('Ese lote no está en subasta'); if (s.vendedor === p.cid) return fail('No puedes pujar en tu propia subasta');
  const x = msg.monto; if (!Number.isSafeInteger(x) || x <= 0) return fail('Monto inválido'); const min = minimaPuja(s); if (x < min) return fail(`La puja mínima es $${min}`);
  if (m._franq(p.cid) >= m.maxFranq(p)) return fail(`Máximo ${m.maxFranq(p)} franquicias`);
  const mia = s.mejor?.cid === p.cid ? s.mejor.monto : 0; if (p.dinero + mia < x) return fail(`Necesitas $${x} en tu cuenta de franquicias`);
  if (s.mejor) { const prev = m.j.get(s.mejor.cid); if (prev) { m._mov(prev, 'puja', s.mejor.monto); if (prev.cid !== p.cid) m._ev(prev, `Te superaron en la subasta de ${s.lote} ($${x}). Se te devolvió tu puja.`); } }
  m._mov(p, 'puja', -x); s.mejor = { cid: p.cid, monto: x };
  if (s.cierra - m.turno <= SNIPE && s.ext < MAX_EXT) { s.cierra += SNIPE; s.ext++; }
  return { ok: true, msg: `Vas ganando con $${x}. Cierra en ${s.cierra - m.turno} turnos.` };
}
function cancelar(m, s, motivo) { if (s.mejor) { const w = m.j.get(s.mejor.cid); if (w) m._mov(w, 'puja', s.mejor.monto); } m.sub.delete(s.lote); if (motivo) m._noticia('mercado', motivo); }
export function turno(m) {
  for (const s of [...m.sub.values()]) {
    const o = m.o.get(s.lote), v = s.vendedor ? m.j.get(s.vendedor) : null;
    if (s.vendedor && (!o || o.dueno !== s.vendedor || !v)) { cancelar(m, s, 'Se canceló una subasta: el vendedor ya no controla la propiedad.'); continue; }
    if (!s.vendedor && o) { cancelar(m, s); continue; }
    if (m.turno < s.cierra) continue;
    const barrio = perfilBarrio(m.seed, barrioDeLote(m.lote(s.lote))).nombre;
    if (!s.mejor) { m.sub.delete(s.lote); m._noticia('mercado', s.vendedor ? `Nadie pujó por la franquicia de ${v.nombre} en ${barrio}.` : `Nadie pujó por el lote de la subasta de la ciudad en ${barrio}.`); continue; }
    const w = m.j.get(s.mejor.cid);
    if (w && w.npc && m._offline && (m._compras.get(w.cid) || 0) >= 2) { cancelar(m, s, 'Se canceló una subasta: el ganador ya había comprado lo máximo mientras no estabas.'); continue; }
    if (!w || m._franq(w.cid) >= m.maxFranq(w)) { cancelar(m, s, 'Se canceló una subasta: el ganador ya no puede abrir más franquicias.'); continue; }
    if (s.vendedor) { m._mov(v, 'venta', s.mejor.monto); Object.assign(o, { dueno: w.cid, enVenta: null, promo: 0, ger: null, recorte: false }); if (v.npc) v.npc.mem.push({ t: m.turno, k: 'vendi', cid: w.cid }); }
    else m.o.set(s.lote, { ...m._franquicia(null), dueno: w.cid });
    if (w.npc && m._offline) m._compras.set(w.cid, (m._compras.get(w.cid) || 0) + 1);
    m.sub.delete(s.lote); m._ev(w, `Ganaste la subasta de ${s.lote} por $${s.mejor.monto}`); if (!w.npc && !w.soc) w.st.compradasVenta++;
    m._noticia('mercado', `${w.nombre} ganó la subasta en ${barrio} por $${s.mejor.monto}${v ? ` (vendía ${v.nombre})` : ''}.`);
  }
  if (m.turno > 0 && m.turno % CIUDAD_CADA === 0 && ![...m.sub.values()].some(s => s.ciudad)) {   // subasta de la ciudad: el mejor lote libre
    let mejor = null, ms = -1;                      // el lote libre con mejor relación entre tránsito y competencia cercana
    for (let cy = -3; cy <= 3; cy++) for (let cx = -3; cx <= 3; cx++) for (const l of lotes(m.seed, cx, cy)) {
      if (m.o.has(l.id) || m.sub.has(l.id)) continue; let comp = 0; for (const id of m.o.keys()) if (distLotes(l, m.lote(id)) <= 40) comp++;
      const sc = trafico(l) / (1 + comp); if (sc > ms) { ms = sc; mejor = l; }
    }
    if (mejor) { const base = Math.round((300 + 120 * trafico(mejor)) * CIUDAD_BASE); m.sub.set(mejor.id, { lote: mejor.id, vendedor: null, base, mejor: null, cierra: m.turno + SUB_TURNOS, ext: 0, ciudad: true }); m._noticia('mercado', `Subasta de la ciudad: un lote con poca competencia en ${perfilBarrio(m.seed, barrioDeLote(mejor)).nombre} sale desde $${base}.`); }
  }
}
export const serializar = m => ({ sub: [...m.sub.values()] });
export function restaurar(m, d) {
  const n = (x, a, b, def) => (Number.isFinite(x) ? Math.min(b, Math.max(a, x)) : def); m.sub = new Map();
  for (const s of Array.isArray(d?.sub) ? d.sub : []) {
    if (!s || typeof s.lote !== 'string' || !m.lote(s.lote)) continue; const vend = typeof s.vendedor === 'string' ? s.vendedor : null;
    if (vend && (!m.j.has(vend) || m.o.get(s.lote)?.dueno !== vend)) continue; if (!vend && m.o.has(s.lote)) continue;
    const mejor = s.mejor && typeof s.mejor.cid === 'string' && m.j.has(s.mejor.cid) ? { cid: s.mejor.cid, monto: Math.floor(n(s.mejor.monto, 0, 1e9, 0)) } : null;
    m.sub.set(s.lote, { lote: s.lote, vendedor: vend, base: Math.floor(n(s.base, 1, 1e9, 1)), mejor, cierra: Math.floor(n(s.cierra, 0, 1e9, 0)), ext: Math.floor(n(s.ext, 0, MAX_EXT, 0)), ciudad: s.ciudad === true });
  }
}
export const vistaS = (m, cid) => [...m.sub.values()].map(s => ({ lote: s.lote, vendedor: s.vendedor ? m.j.get(s.vendedor)?.nombre || '?' : 'La ciudad', mio: s.vendedor === cid, ciudad: s.ciudad, base: s.base, minima: minimaPuja(s), mejor: s.mejor ? { nombre: m.j.get(s.mejor.cid)?.nombre || '?', monto: s.mejor.monto, tuya: s.mejor.cid === cid } : null, quedan: s.cierra - m.turno }));
