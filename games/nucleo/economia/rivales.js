// Rivales empresariales autónomos (PURO). Son jugadores del mismo mundo: usan las MISMAS reglas y operaciones que una persona
// (m._exec), con su propio capital. No reciben dinero de la nada: solo capital inicial y, tras retirarse, un único regreso con socios.
// Todas sus decisiones son deterministas (semilla + turno + id): recargar o simular offline no cambia el resultado.
import { lotes, trafico, distLotes, LOTE_INICIAL } from '../world/ciudad.js';
import { existe, azar, hash, efectoLote, eventosEntre, perfilBarrio, barrioDeLote, ESPECIALIDADES } from './mercado.js';

export const PERFILES = {
  agresivo: { n: 'Agresivo', d: 'Se expande rápido, se endeuda y compite de frente por tu zona.', cap: 1900, reserva: .15, intervalo: 6, enfria: 20, nivelMax: 3, prestamo: .75, minRoi: 3.5, nombres: ['Grupo Vórtice', 'Los Halcones'] },
  estratega: { n: 'Estratega', d: 'Busca zonas con poca competencia y se especializa.', cap: 2300, reserva: .4, intervalo: 8, enfria: 32, nivelMax: 4, prestamo: .4, minRoi: 5, nombres: ['Aurora Gourmet', 'Casa Montes'] },
  tradicionalista: { n: 'Tradicionalista', d: 'Crece despacio, consolida su zona y evita las deudas.', cap: 2100, reserva: .55, intervalo: 10, enfria: 40, nivelMax: 5, prestamo: 0, minRoi: 4.5, nombres: ['Doña Chela', 'La Fonda Vieja'] },
  oportunista: { n: 'Oportunista', d: 'Espera tus tropiezos: compra locales baratos y negocios en venta.', cap: 1700, reserva: .3, intervalo: 7, enfria: 30, nivelMax: 3, prestamo: .5, minRoi: 4.5, nombres: ['Inversiones Lira', 'Hermanos Lira'] },
};
const ORDEN = ['agresivo', 'estratega', 'tradicionalista', 'oportunista'];
const CAJA = 800, REGRESO = 900, MAX_REGRESOS = 2, DIAS_RETIRO = 90;
const humano = (m, cid) => { const p = m.j.get(cid); return !!p && !p.npc; };
const nuevoNpc = (perfil, prox) => ({ perfil, estado: 'activo', prox, mem: [], rencor: {}, retiradoT: 0, regresos: 0, vistos: [], ult: 0 });
export function limpiarNpc(n) {
  if (!n || !existe(PERFILES, n.perfil)) return null; const e = x => (Number.isFinite(x) ? Math.max(0, Math.min(1e9, Math.floor(x))) : 0);
  const r = nuevoNpc(n.perfil, e(n.prox)); r.estado = n.estado === 'retirado' ? 'retirado' : 'activo'; r.retiradoT = e(n.retiradoT); r.ult = e(n.ult); r.regresos = Math.min(MAX_REGRESOS, e(n.regresos));
  r.mem = (Array.isArray(n.mem) ? n.mem : []).slice(-12).filter(x => x && typeof x.k === 'string').map(x => ({ t: e(x.t), k: x.k.slice(0, 16), cid: typeof x.cid === 'string' ? x.cid.slice(0, 40) : undefined }));
  if (n.rencor && typeof n.rencor === 'object') for (const k of Object.keys(n.rencor).slice(0, 8)) r.rencor[k.slice(0, 40)] = Math.min(99, e(n.rencor[k]));
  r.vistos = (Array.isArray(n.vistos) ? n.vistos : []).slice(-60).filter(x => typeof x === 'string').map(x => x.slice(0, 12)); return r;
}
const giroRival = (m, p) => { const g = m.giro, o = g === 'restaurante' ? 'cafeteria' : 'restaurante'; const pf = p.npc.perfil;
  return pf === 'agresivo' ? o : pf === 'tradicionalista' ? 'restaurante' : pf === 'estratega' ? 'cafeteria' : (azar(m.seed, hash(p.cid), 9) < .5 ? 'restaurante' : 'cafeteria'); };
const articulo = g => (g === 'cafeteria' ? 'una cafetería' : 'un restaurante');

function lotesLibres(m, radio) { const r = []; for (let cy = -radio; cy <= radio; cy++) for (let cx = -radio; cx <= radio; cx++) for (const l of lotes(m.seed, cx, cy)) if (!m.o.has(l.id)) r.push(l); return r; }
export function sembrarRivales(m, n) {
  const centro = m.lote(LOTE_INICIAL);
  for (let i = 0; i < Math.min(n, 8); i++) {
    const perfil = ORDEN[i % ORDEN.length], P = PERFILES[perfil], cid = `npc:${perfil}:${i}`; if (m.j.has(cid)) continue;
    let mejor = null, ms = -Infinity;
    for (const l of lotesLibres(m, 2)) {
      let comp = 0; for (const [id, o] of m.o) if (distLotes(l, m.lote(id)) <= 24) comp++;
      const d = distLotes(l, centro), r = azar(m.seed, hash(cid), l.cx, l.cy, 5) * .5;
      const s = perfil === 'agresivo' ? -Math.abs(d - 9) : perfil === 'estratega' ? (comp === 0 ? 6 : 0) + trafico(l) : perfil === 'tradicionalista' ? trafico(l) * 2 - comp : trafico(l) * 2 + r * 10 - Math.abs(d - 14) * .3;
      if (s + r > ms) { ms = s + r; mejor = l; }
    }
    if (!mejor) break;
    const p = m._nuevo(cid, P.nombres[(i / ORDEN.length | 0) % 2], mejor.id); p.npc = nuevoNpc(perfil, m.turno + 4 + 2 * i);
    m._mov(p, 'aporte', P.cap); m._exec(p, { op: 'comprar', lote: mejor.id, giro: giroRival(m, p) }); p.npc.ult = m.turno;
  }
}

export function turnoRivales(m) {
  for (const p of m.j.values()) {
    const n = p.npc; if (!n) continue;
    if (n.estado === 'retirado') { if (n.regresos < MAX_REGRESOS && m.turno - n.retiradoT >= DIAS_RETIRO && azar(m.seed, m.turno, hash(p.cid), 7) < .1) regresar(m, p); continue; }
    if (m.turno < n.prox) continue;
    n.prox = m.turno + PERFILES[n.perfil].intervalo + hash(m.seed, m.turno, hash(p.cid)) % 3; decidir(m, p);
  }
}
function regresar(m, p) {
  const n = p.npc; m._mov(p, 'aporte', REGRESO); n.estado = 'activo'; n.prox = m.turno + 1; n.regresos++; if (n.regresos >= 2 || n.perfil !== 'agresivo') n.perfil = 'agresivo';
  m._noticia('rival', `${p.nombre} regresa con nuevos socios y busca revancha en otra zona de la ciudad.`);
}
// Una promoción solo se lanza si lo que atrae probablemente supera lo que cuesta
const promoVale = (m, p, id) => (p.ingresos[id] ?? 0) * 6 * .2 > Math.round(m.precio(m.lote(id)) * .1);
const propias = (m, p) => { const r = []; for (const [id, o] of m.o) if (o.dueno === p.cid && o.tipo === 'franquicia') r.push([id, o]); return r; };
function observar(m, p) {                       // memoria: quién abre cerca de mí
  const n = p.npc, mias = propias(m, p); if (!mias.length) return;
  for (const [id, o] of m.o) {
    if (o.dueno === p.cid || !humano(m, o.dueno) || n.vistos.includes(id)) continue;
    if (mias.some(([mid]) => distLotes(m.lote(id), m.lote(mid)) <= 12)) { n.vistos.push(id); if (n.vistos.length > 60) n.vistos.shift(); n.rencor[o.dueno] = (n.rencor[o.dueno] || 0) + 1; n.mem.push({ t: m.turno, k: 'cerca', cid: o.dueno }); if (n.mem.length > 12) n.mem.shift(); }
  }
}
function puntuar(m, p, c, ctx) {
  const n = p.npc, P = PERFILES[n.perfil], l = c.lote, id = barrioDeLote(l); let efl = ctx.efl.get(id); if (!efl) { efl = efectoLote(m.seed, l, m.turno, ctx.evs); ctx.efl.set(id, efl); }
  let comp = 0, cercaJ = 0, propiasCerca = 0;
  for (const [oid, o] of m.o) { if (oid === l.id) continue; const d = distLotes(l, m.lote(oid)); if (d <= 40) comp += o.tipo === 'hogar' ? 1.25 : 1 + .35 * (o.nivel - 1); if (o.dueno === p.cid) { if (d <= 28) propiasCerca++; } else if (humano(m, o.dueno) && d <= 16) cercaJ += 1 + (n.rencor[o.dueno] || 0) * .5; }
  const nivel = c.o ? c.o.nivel : 1, roi = 100 * trafico(l) * 16 * efl.dem / (1 + comp) * (1 + .5 * (nivel - 1)) / c.precio;
  let s = roi + azar(m.seed, m.turno, hash(p.cid), l.cx * 7 + l.cy) * .4;
  if (n.perfil === 'agresivo') s += 2.5 * Math.min(cercaJ, 3);
  else if (n.perfil === 'estratega') { if (comp === 0) s *= 1.4; if (efl.dem > 1.05) s *= 1.15; s *= cercaJ ? .7 : 1; }
  else if (n.perfil === 'tradicionalista') { if (propiasCerca) s *= 1.3; else if (mioCount(m, p)) s *= .5; }
  else s *= c.venta ? 1.6 : .65;
  const minimo = n.perfil === 'oportunista' ? (c.venta ? P.minRoi * .7 : 8) : P.minRoi;
  return roi >= minimo ? s : -1;
}
const mioCount = (m, p) => propias(m, p).length;
function candidatos(m, p, ctx) {
  const r = [];
  for (const [id, o] of m.o) if (o.enVenta != null && o.tipo === 'franquicia' && o.dueno !== p.cid) r.push({ lote: m.lote(id), precio: o.enVenta, venta: true, o });
  const libres = lotesLibres(m, 3);
  for (const l of libres) r.push({ lote: l, precio: m.precio(l), venta: false, o: null });
  for (const c of r) c.s = puntuar(m, p, c, ctx);
  return r.filter(c => c.s > 0).sort((a, b) => b.s - a.s || (a.lote.id < b.lote.id ? -1 : 1));
}
function decidir(m, p) {
  const n = p.npc, P = PERFILES[n.perfil], T = m.turno, ef = m.ef(p), mias = propias(m, p), minCaja = Math.round(P.reserva * CAJA), limite = m.limiteDeuda(p);
  const flujo = mias.reduce((s, [id]) => s + (p.ingresos[id] ?? 0), 0), carga = limite > 0 ? p.deuda / limite : 0;
  observar(m, p);
  const tope = m._offline ? 2 : 99, hizo = () => (m._compras.get(p.cid) || 0) >= tope, anota = () => m._compras.set(p.cid, (m._compras.get(p.cid) || 0) + 1);
  // 1) crisis: deuda alta o flujo negativo → vender para sobrevivir
  if (mias.length && (flujo < 0 || carga > .85 || (p.deuda > 0 && p.dinero < minCaja * .3))) {
    const peor = mias.map(([id, o]) => [id, o, p.ingresos[id] ?? 0]).sort((a, b) => a[2] - b[2])[0];
    if (peor[1].enVenta == null) { const r = m._exec(p, { op: 'listar', lote: peor[0] }); if (r.ok) { m._noticia('mercado', `${p.nombre} pone en venta una franquicia en ${perfilBarrio(m.seed, barrioDeLote(m.lote(peor[0]))).nombre} por $${peor[1].enVenta}: ¿oportunidad?`); n.mem.push({ t: T, k: 'crisis' }); } }
    else if (carga > 1.2) { m._exec(p, { op: 'vender', lote: peor[0] }); m._noticia('economia', `${p.nombre} liquida una franquicia para pagar deudas.`); }
    if (p.deuda > 0 && p.dinero > 0) m._exec(p, { op: 'abonar', monto: Math.min(p.deuda, p.dinero) });
    return;
  }
  // 2) pagar deuda con el excedente
  if (p.deuda > 0 && p.dinero > minCaja * 1.5) m._exec(p, { op: 'abonar', monto: Math.min(p.deuda, p.dinero - minCaja) });
  // 3) políticas de precio, promoción y especialidad
  const hum = [...m.j.values()].filter(q => !q.npc), top = hum.sort((a, b) => m.patrimonio(b) - m.patrimonio(a))[0];
  for (const [id, o] of mias) {
    const l = m.lote(id); let cercaH = false, rivalesCerca = 0;
    for (const [oid, q] of m.o) { if (oid === id || q.dueno === p.cid) continue; const d = distLotes(l, m.lote(oid)); if (d <= 20) { rivalesCerca++; if (humano(m, q.dueno)) cercaH = true; } }
    if (n.perfil === 'agresivo') {
      if (cercaH && top && m.patrimonio(top) > m.patrimonio(p) * 1.15 && flujo > 0) { if (o.p > 1) m._exec(p, { op: 'ajustar', lote: id, precio: 1 }); if (p.dinero > minCaja * 1.5 && !(o.promo > T) && promoVale(m, p, id)) m._exec(p, { op: 'promocion', lote: id }); }
      else if (flujo < 0 && o.p < 2) m._exec(p, { op: 'ajustar', lote: id, precio: 2 });
    } else if (!o.esp && p.dinero > minCaja * 1.5 + 200 && (n.perfil === 'estratega' || n.perfil === 'tradicionalista')) {
      const dom = perfilBarrio(m.seed, barrioDeLote(l)).dom, esp = n.perfil === 'tradicionalista' ? 'calidad' : dom === 'estudiantes' || dom === 'trabajadores' ? 'rapidez' : dom === 'premium' || dom === 'turistas' ? 'exclusividad' : 'calidad';
      if (ESPECIALIDADES[esp]) m._exec(p, { op: 'ajustar', lote: id, esp });
    } else if (n.perfil === 'oportunista' && rivalesCerca >= 2 && !(o.promo > T) && p.dinero > minCaja * 1.5 + 100 && promoVale(m, p, id)) m._exec(p, { op: 'promocion', lote: id });
  }
  // retiro de utilidades: los dueños no acumulan caja sin límite (sale del libro como 'retiro')
  const exceso = p.dinero - (minCaja * 3 + 1500); if (exceso > 100 && p.deuda === 0) m._mov(p, 'retiro', -Math.floor(exceso * .5));
  if (hizo()) return;
  // 4) expansión: el mejor lote o local en venta según la personalidad
  if (mias.length < m.maxFranq(p) && T - n.ult >= P.enfria) {
    const ctx = { evs: eventosEntre(m.seed, T), efl: new Map() }, best = candidatos(m, p, ctx)[0];
    if (best) {
      let falta = best.precio + Math.round(minCaja * .5) - p.dinero;
      if (falta > 0 && P.prestamo > 0 && (flujo > 0 || n.perfil === 'agresivo') && (n.perfil !== 'oportunista' || best.venta)) {
        const dispo = Math.floor(P.prestamo * limite) - p.deuda; if (dispo >= falta && falta >= 40) { const r = m._exec(p, { op: 'prestamo', monto: falta }); if (r.ok) falta = 0; }
      }
      if (falta <= 0) {
        const r = m._exec(p, { op: 'comprar', lote: best.lote.id, giro: giroRival(m, p) });
        if (r.ok) { anota(); n.ult = T; aviso(m, p, best); return; }
      }
    }
  }
  // 5) mejorar la franquicia con más potencial
  const cand = mias.filter(([, o]) => o.nivel < P.nivelMax).sort((a, b) => trafico(m.lote(b[0])) - trafico(m.lote(a[0])) || a[1].nivel - b[1].nivel)[0];
  if (cand) { const c = Math.round(m.costoMejora(m.lote(cand[0]), cand[1].nivel) * ef.mej); if (p.dinero >= c + minCaja && flujo > 0 && T - n.ult >= P.enfria / 2) { const r = m._exec(p, { op: 'mejorar', lote: cand[0] }); if (r.ok) { anota(); n.ult = T; return; } } }
  // 6) retirada: sin negocios y sin capital para abrir uno
  if (!mias.length && p.dinero < 480) { n.estado = 'retirado'; n.retiradoT = T; p.deuda = 0; m._noticia('rival', `${p.nombre} se retira del mercado tras quedarse sin negocios.`); n.mem.push({ t: T, k: 'retiro' }); }
}
function aviso(m, p, c) {
  const l = c.lote, b = perfilBarrio(m.seed, barrioDeLote(l)).nombre, g = m.o.get(l.id)?.giro;
  m._noticia('rival', c.venta ? `${p.nombre} aprovechó una oferta y compró una franquicia en ${b}.` : `${p.nombre} abrió ${articulo(g)} en ${b}.`);
  for (const q of m.j.values()) if (!q.npc) { let cerca = null; for (const [id, o] of m.o) if (o.dueno === q.cid && distLotes(l, m.lote(id)) <= 10) { cerca = o.tipo === 'hogar' ? 'tu local' : 'una de tus franquicias'; break; } if (cerca) m._noticia('rival', `¡${p.nombre} abrió ${articulo(g)} justo al lado de ${cerca}!`, q.cid); }
}
