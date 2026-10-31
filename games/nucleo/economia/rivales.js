// Rivales empresariales autónomos (PURO). Son jugadores del mismo mundo: usan las MISMAS reglas y operaciones que una persona
// (m._exec), con su propio capital. No reciben dinero de la nada: solo capital inicial y, tras retirarse, un único regreso con socios.
// Todas sus decisiones son deterministas (semilla + turno + id): recargar o simular offline no cambia el resultado.
import { lotes, trafico, distLotes, LOTE_INICIAL } from '../world/ciudad.js';
import { capacidad, ofertasAbiertas } from '../multiplayer/contratos.js';
import { minimaPuja } from '../multiplayer/subastas.js';
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
const nuevoNpc = (perfil, prox) => ({ perfil, estado: 'activo', prox, mem: [], rencor: {}, retiradoT: 0, regresos: 0, vistos: [], ult: 0, aliados: {}, deben: {}, ultFusion: 0, ultRescate: 0 });
export function limpiarNpc(n) {
  if (!n || !existe(PERFILES, n.perfil)) return null; const e = x => (Number.isFinite(x) ? Math.max(0, Math.min(1e9, Math.floor(x))) : 0);
  const r = nuevoNpc(n.perfil, e(n.prox)); r.estado = ['retirado', 'fusionado'].includes(n.estado) ? n.estado : 'activo'; r.ultFusion = e(n.ultFusion); r.ultRescate = e(n.ultRescate); r.retiradoT = e(n.retiradoT); r.ult = e(n.ult); r.regresos = Math.min(MAX_REGRESOS, e(n.regresos));
  r.mem = (Array.isArray(n.mem) ? n.mem : []).slice(-12).filter(x => x && typeof x.k === 'string').map(x => ({ t: e(x.t), k: x.k.slice(0, 16), cid: typeof x.cid === 'string' ? x.cid.slice(0, 40) : undefined }));
  if (n.rencor && typeof n.rencor === 'object') for (const k of Object.keys(n.rencor).slice(0, 8)) r.rencor[k.slice(0, 40)] = Math.min(99, e(n.rencor[k]));
  for (const k of ['aliados', 'deben']) if (n[k] && typeof n[k] === 'object') for (const c of Object.keys(n[k]).slice(0, 8)) r[k][c.slice(0, 40)] = Math.min(1e7, e(n[k][c]));
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
    if (n.estado === 'fusionado') continue;
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
    if (o.dueno === p.cid || !humano(m, o.dueno) || n.vistos.includes(id) || n.aliados[o.dueno]) continue;
    if (mias.some(([mid]) => distLotes(m.lote(id), m.lote(mid)) <= 12)) { n.vistos.push(id); if (n.vistos.length > 60) n.vistos.shift(); n.rencor[o.dueno] = (n.rencor[o.dueno] || 0) + 1; n.mem.push({ t: m.turno, k: 'cerca', cid: o.dueno }); if (n.mem.length > 12) n.mem.shift(); }
  }
}
export function puntuar(m, p, c, ctx) {
  const n = p.npc, P = PERFILES[n.perfil], l = c.lote, id = barrioDeLote(l); let efl = ctx.efl.get(id); if (!efl) { efl = efectoLote(m.seed, l, m.turno, ctx.evs); ctx.efl.set(id, efl); }
  let comp = 0, cercaJ = 0, propiasCerca = 0, aliadoCerca = false;
  for (const [oid, o] of m.o) { if (oid === l.id) continue; const d = distLotes(l, m.lote(oid)); if (d <= 40) comp += o.tipo === 'hogar' ? 1.25 : 1 + .35 * (o.nivel - 1); if (o.dueno === p.cid) { if (d <= 28) propiasCerca++; } else if (humano(m, o.dueno) && d <= 16) { if (n.aliados[o.dueno]) aliadoCerca = true; else cercaJ += 1 + (n.rencor[o.dueno] || 0) * .5; } }
  const nivel = c.o ? c.o.nivel : 1, roi = 100 * trafico(l) * 16 * efl.dem / (1 + comp) * (1 + .5 * (nivel - 1)) / c.precio;
  let s = roi + azar(m.seed, m.turno, hash(p.cid), l.cx * 7 + l.cy) * .4;
  if (n.perfil === 'agresivo') s += 2.5 * Math.min(cercaJ, 3);
  else if (n.perfil === 'estratega') { if (comp === 0) s *= 1.4; if (efl.dem > 1.05) s *= 1.15; s *= cercaJ ? .7 : 1; }
  else if (n.perfil === 'tradicionalista') { if (propiasCerca) s *= 1.3; else if (mioCount(m, p)) s *= .5; }
  else s *= c.venta ? 1.6 : .65;
  if (aliadoCerca) s *= .4;                       // no compite contra quien lo rescató
  const minimo = n.perfil === 'oportunista' ? (c.venta ? P.minRoi * .7 : 8) : P.minRoi;
  return roi >= minimo ? s : -1;
}
const mioCount = (m, p) => propias(m, p).length;
export function candidatos(m, p, ctx) {
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
  const hum = [...m.j.values()].filter(q => !q.npc && !n.aliados[q.cid]), top = hum.sort((a, b) => m.patrimonio(b) - m.patrimonio(a))[0];
  for (const [id, o] of mias) {
    const l = m.lote(id); let cercaH = false, rivalesCerca = 0;
    for (const [oid, q] of m.o) { if (oid === id || q.dueno === p.cid) continue; const d = distLotes(l, m.lote(oid)); if (d <= 20) { rivalesCerca++; if (humano(m, q.dueno) && !n.aliados[q.dueno]) cercaH = true; } }
    if (n.perfil === 'agresivo') {
      if (cercaH && top && m.patrimonio(top) > m.patrimonio(p) * 1.15 && flujo > 0) { if (o.p > 1) m._exec(p, { op: 'ajustar', lote: id, precio: 1 }); if (p.dinero > minCaja * 1.5 && !(o.promo > T) && promoVale(m, p, id)) m._exec(p, { op: 'promocion', lote: id }); }
      else if (flujo < 0 && o.p < 2) m._exec(p, { op: 'ajustar', lote: id, precio: 2 });
    } else if (!o.esp && p.dinero > minCaja * 1.5 + 200 && (n.perfil === 'estratega' || n.perfil === 'tradicionalista')) {
      const dom = perfilBarrio(m.seed, barrioDeLote(l)).dom, esp = n.perfil === 'tradicionalista' ? 'calidad' : dom === 'estudiantes' || dom === 'trabajadores' ? 'rapidez' : dom === 'premium' || dom === 'turistas' ? 'exclusividad' : 'calidad';
      if (ESPECIALIDADES[esp]) m._exec(p, { op: 'ajustar', lote: id, esp });
    } else if (n.perfil === 'oportunista' && rivalesCerca >= 2 && !(o.promo > T) && p.dinero > minCaja * 1.5 + 100 && promoVale(m, p, id)) m._exec(p, { op: 'promocion', lote: id });
  }
  // devuelve el favor a quien lo rescató (una sola vez, con 15% de interés)
  for (const [cid, monto] of Object.entries(n.deben)) {
    const q = m.j.get(cid), pago = Math.round(monto * 1.15); if (!q) { delete n.deben[cid]; continue; }
    if (p.dinero >= minCaja * 2 + pago && p.deuda === 0) { m._mov(p, 'rescate', -pago); m._mov(q, 'rescate', pago); delete n.deben[cid]; m._noticia('rival', `${p.nombre} devolvió el favor a ${q.nombre} con intereses: la alianza sigue en pie.`); m._ev(q, `${p.nombre} te devolvió $${pago} por tu rescate`); }
  }
  fusionar(m, p, flujo, minCaja);
  // retiro de utilidades: los dueños no acumulan caja sin límite (sale del libro como 'retiro')
  const exceso = p.dinero - (minCaja * 3 + 1500); if (exceso > 100 && p.deuda === 0) m._mov(p, 'retiro', -Math.floor(exceso * .5));
  // contratos de catering: solo los que su cocina puede cumplir (cada perfil exige un margen distinto de capacidad)
  const margen = { agresivo: 1, estratega: 1.25, tradicionalista: 1.3, oportunista: 1.1 }[n.perfil];
  for (const [id, o] of mias) {
    if (m.cont.has(id)) continue; const cap = capacidad(o, ef), of = ofertasAbiertas(m).filter(x => cap >= x.req * margen && p.dinero >= x.deposito + minCaja).sort((a, b) => b.pago * b.plazo - a.pago * a.plazo)[0];
    if (of && m._exec(p, { op: 'contrato', oferta: of.id, lote: id }).ok) break;
  }
  // subastas abiertas: puja mientras el negocio siga rindiendo lo mínimo que exige su personalidad
  if (!hizo() && mias.length < m.maxFranq(p)) {
    const ctx = { evs: eventosEntre(m.seed, T), efl: new Map() };
    for (const sb of m.sub.values()) {
      if (sb.vendedor === p.cid || sb.mejor?.cid === p.cid) continue; const puja = minimaPuja(sb); if (p.dinero - puja < minCaja) continue;
      const o = m.o.get(sb.lote); if (puntuar(m, p, { lote: m.lote(sb.lote), precio: puja, venta: !!o, o: o || null }, ctx) > 0 && m._exec(p, { op: 'pujar', lote: sb.lote, monto: puja }).ok) { n.mem.push({ t: T, k: 'puja' }); break; }
    }
  }
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

// ---------- fusiones: un rival sólido absorbe a otro en apuros (negocios, caja y deuda) ----------
const FUSIONAN = ['estratega', 'tradicionalista', 'agresivo'];
function fusionar(m, p, flujo, minCaja) {
  const n = p.npc; if (!FUSIONAN.includes(n.perfil) || m._offline || m.turno - n.ultFusion < 80 || flujo <= 0 || p.dinero < minCaja * 3) return;
  if (azar(m.seed, m.turno, hash(p.cid), 11) > .3) return;
  const mias = propias(m, p); let mejor = null;
  for (const v of m.j.values()) {
    if (!v.npc || v === p || v.npc.estado !== 'activo') continue; const sus = propias(m, v); if (!sus.length || mias.length + sus.length > m.maxFranq(p)) continue;
    const fl = sus.reduce((a, [id]) => a + (v.ingresos[id] ?? 0), 0), lim = m.limiteDeuda(v), crisis = fl <= 0 || (lim > 0 && v.deuda / lim > .5); if (!crisis) continue;
    if (p.deuda + v.deuda > .8 * m.limiteDeuda(p)) continue; const valor = sus.reduce((a, [id, o]) => a + m.valor(id, o), 0); if (!mejor || valor > mejor.valor) mejor = { v, valor, sus };
  }
  if (!mejor) return;
  const { v, sus } = mejor; for (const [id, o] of sus) { o.dueno = p.cid; o.enVenta = null; const c = m.cont.get(id); if (c) c.cid = p.cid; }
  const d = v.dinero; if (d) { m._mov(v, 'fusion', -d); m._mov(p, 'fusion', d); } p.deuda += v.deuda; v.deuda = 0; v.ingresos = {};
  v.npc.estado = 'fusionado'; v.npc.regresos = MAX_REGRESOS; n.ultFusion = m.turno; n.mem.push({ t: m.turno, k: 'fusion', cid: v.cid });
  m._noticia('rival', `${p.nombre} absorbió a ${v.nombre} (${sus.length} franquicia${sus.length > 1 ? 's' : ''}) y asumió sus deudas.`);
}

// ---------- rescate: una persona ayuda a un rival en apuros y gana un aliado que luego le devuelve el favor ----------
export function opRescatar(m, p, msg) {
  const fail = t => ({ ok: false, msg: t }), v = typeof msg.rival === 'string' ? m.j.get(msg.rival) : null; if (!v?.npc || v.npc.estado !== 'activo') return fail('Ese rival no puede ser rescatado');
  const x = msg.monto; if (!Number.isSafeInteger(x) || x <= 0) return fail('Monto inválido'); const sus = propias(m, v), fl = sus.reduce((a, [id]) => a + (v.ingresos[id] ?? 0), 0), lim = m.limiteDeuda(v);
  if (v.deuda <= 0 || !(fl < 0 || (lim > 0 && v.deuda / lim > .5))) return fail(`${v.nombre} no está en apuros`); if (x > v.deuda) return fail(`Solo debe $${v.deuda}`); if (x > p.dinero) return fail('No te alcanza en tu cuenta de franquicias');
  if (v.npc.ultRescate > 0 && m.turno - v.npc.ultRescate < 30) return fail('Ya recibió ayuda hace poco');
  m._mov(p, 'rescate', -x); m._mov(v, 'rescate', x); m._mov(v, 'abono', -x); v.deuda -= x; const n = v.npc; n.ultRescate = Math.max(1, m.turno); n.aliados[p.cid] = (n.aliados[p.cid] || 0) + 1; n.deben[p.cid] = (n.deben[p.cid] || 0) + x; delete n.rencor[p.cid]; n.mem.push({ t: m.turno, k: 'rescate', cid: p.cid });
  m._noticia('rival', `${p.nombre} rescató a ${v.nombre} pagando $${x} de su deuda. ¿Nace una alianza?`); return { ok: true, msg: `${v.nombre} te lo agradece: no competirá contra ti y te devolverá el favor con intereses cuando se recupere.` };
}

// ---------- cuántos rivales hay ----------
const indice = cid => Number(String(cid).split(':')[2]);
export function quitarRival(m, p) {
  for (const [id, o] of [...m.o]) if (o.dueno === p.cid) { m.o.delete(id); m.cont.delete(id); }
  m._noticia('rival', `${p.nombre} cierra todos sus negocios y deja la ciudad.`); m.j.delete(p.cid);
}
export function ajustarRivales(m, n) {
  n = Math.max(0, Math.min(8, Math.floor(n) || 0)); sembrarRivales(m, n);
  for (const p of [...m.j.values()]) if (p.npc && indice(p.cid) >= n) quitarRival(m, p);
  return [...m.j.values()].filter(p => p.npc).length;
}
