// Sociedades (PURO, lógica del servidor): una empresa con varios propietarios. Es un «jugador» más del mundo (cid 'soc:N') con caja,
// franquicias, deuda y ramas propias; las personas actúan sobre ella con permisos y, en las decisiones importantes, con votación.
//  - Roles: fundador (todo), gerente (operar y mejorar), socio (operar). El fundador ajusta permisos de cada persona.
//  - Votación (mayoría simple de socios) para: préstamos, compra de propiedades, venta de sucursales, repartos y disolución.
//  - Caja compartida (aportes con reparto proporcional al salir o disolver) e historial de decisiones y aportaciones.
// Nada se crea ni se pierde: aportar, repartir y liquidar son movimientos del libro entre la persona y la sociedad.
import { LOTE_INICIAL } from '../world/ciudad.js';
export const PERMISOS = ['operar', 'mejorar', 'comprar', 'vender', 'finanzas'];
export const ROLES = { fundador: { operar: true, mejorar: true, comprar: true, vender: true, finanzas: true }, gerente: { operar: true, mejorar: true, comprar: false, vender: false, finanzas: false }, socio: { operar: true, mejorar: false, comprar: false, vender: false, finanzas: false } };
export const MAX_SOCIOS = 4, INVITA_TURNOS = 30, VOTO_TURNOS = 8, MAX_HIST = 40;
const OP_PERM = { ajustar: 'operar', promocion: 'operar', gerente: 'operar', contrato: 'operar', mejorar: 'mejorar', comprar: 'comprar', pujar: 'comprar', vender: 'vender', listar: 'vender', retirar: 'vender', subastar: 'vender', retirarSubasta: 'vender', prestamo: 'finanzas', rescatar: 'finanzas', abonar: 'finanzas', proveedor: 'finanzas', rama: 'finanzas' };
const VOTAN = new Set(['prestamo', 'comprar', 'vender', 'listar', 'subastar', 'rescatar']);
const CLAVES = ['op', 'rival', 'lote', 'monto', 'giro', 'precio', 'base', 'oferta', 'prov', 'contrato', 'esp', 'hab', 'accion', 'rama', 'recorte'];
const MG = ['soc_crear', 'soc_invitar', 'soc_aceptar', 'soc_rechazar', 'soc_permisos', 'soc_aportar', 'soc_salir', 'soc_disolver', 'soc_ceder', 'soc_repartir', 'votar'];
const fail = msg => ({ ok: false, msg });
export const esOpSoc = op => MG.includes(op);
export const permisos = s => Object.fromEntries(Object.entries(s.socios).map(([cid, x]) => [cid, { ...ROLES[x.rol], ...x.perm, ...(x.rol === 'fundador' ? ROLES.fundador : {}) }]));
const puede = (sp, cid, perm) => { const x = sp.soc.socios[cid]; return !!x && (x.rol === 'fundador' || (x.perm && perm in x.perm ? x.perm[perm] : ROLES[x.rol][perm])); };
export const socDe = (m, cid) => { for (const p of m.j.values()) if (p.soc && p.soc.socios[cid]) return p; return null; };
const nombreDe = (m, cid) => m.j.get(cid)?.nombre || '?';
const hist = (m, sp, cid, txt) => { sp.soc.hist.push({ t: m.turno, cid, txt: String(txt).slice(0, 140) }); if (sp.soc.hist.length > MAX_HIST) sp.soc.hist.shift(); };
const limpio = s => String(s ?? '').replace(/[^\p{L}\p{N} ._-]/gu, '').trim().slice(0, 16);
const humano = (m, cid) => { const p = m.j.get(cid); return !!p && !p.npc && !p.soc; };
const total = s => Object.values(s.socios).reduce((a, x) => a + x.aporte, 0);
function reparto(s, monto) {                       // proporcional a lo aportado (si nadie aportó, en partes iguales); el resto va al fundador
  const ids = Object.keys(s.socios), t = total(s), out = {}; let dado = 0;
  for (const cid of ids) { out[cid] = Math.floor(monto * (t > 0 ? s.socios[cid].aporte / t : 1 / ids.length)); dado += out[cid]; }
  out[s.fundador] = (out[s.fundador] || 0) + (monto - dado); return out;
}
export function exec(m, p, msg) {
  if (msg.op === 'soc_crear') {
    if (socDe(m, p.cid)) return fail('Ya perteneces a una sociedad'); const nombre = limpio(msg.nombre); if (nombre.length < 3) return fail('Ponle un nombre de al menos 3 letras');
    const cid = `soc:${m.nsoc++}`, sp = m._nuevo(cid, nombre, LOTE_INICIAL);
    sp.soc = { fundador: p.cid, socios: { [p.cid]: { rol: 'fundador', perm: {}, aporte: 0 } }, hist: [], props: [], inv: {}, nid: 1 }; hist(m, sp, p.cid, `${p.nombre} fundó la sociedad`);
    m._noticia('mercado', `${p.nombre} fundó la sociedad «${nombre}».`); return { ok: true, msg: `Sociedad «${nombre}» creada. Invita a tus amigos y aporta capital.`, soc: cid };
  }
  if (msg.op === 'soc_aceptar' || msg.op === 'soc_rechazar') {
    const sp = typeof msg.soc === 'string' ? m.j.get(msg.soc) : null; if (!sp?.soc || !(sp.soc.inv[p.cid] > m.turno)) return fail('Esa invitación ya no es válida');
    delete sp.soc.inv[p.cid]; if (msg.op === 'soc_rechazar') return { ok: true, msg: 'Invitación rechazada' };
    if (socDe(m, p.cid)) return fail('Ya perteneces a una sociedad'); if (Object.keys(sp.soc.socios).length >= MAX_SOCIOS) return fail('La sociedad está completa');
    sp.soc.socios[p.cid] = { rol: 'socio', perm: {}, aporte: 0 }; hist(m, sp, p.cid, `${p.nombre} se unió como socio`); return { ok: true, msg: `Te uniste a «${sp.nombre}»` };
  }
  const via = msg.soc !== undefined ? m.j.get(msg.soc) : socDe(m, p.cid);                       // sociedad sobre la que se actúa
  if (!via?.soc || !via.soc.socios[p.cid]) return fail('No perteneces a esa sociedad');
  const sp = via, s = sp.soc, yo = s.socios[p.cid], esF = p.cid === s.fundador, n = Object.keys(s.socios).length;
  switch (msg.op) {
    case 'soc_invitar': {
      if (!esF) return fail('Solo el fundador invita'); if (n >= MAX_SOCIOS) return fail('La sociedad está completa'); if (!humano(m, msg.cid) || socDe(m, msg.cid)) return fail('Esa persona no puede ser invitada');
      s.inv[msg.cid] = m.turno + INVITA_TURNOS; return { ok: true, msg: `Invitación enviada a ${nombreDe(m, msg.cid)}` };
    }
    case 'soc_permisos': {
      if (!esF) return fail('Solo el fundador cambia permisos'); const x = s.socios[msg.cid]; if (!x || msg.cid === s.fundador) return fail('Esa persona no es un socio editable');
      if (msg.rol !== undefined) { if (!['gerente', 'socio'].includes(msg.rol)) return fail('Rol inválido'); x.rol = msg.rol; x.perm = {}; }
      if (msg.perm && typeof msg.perm === 'object') for (const k of PERMISOS) if (typeof msg.perm[k] === 'boolean') x.perm[k] = msg.perm[k];
      hist(m, sp, p.cid, `${p.nombre} cambió los permisos de ${nombreDe(m, msg.cid)} (${x.rol})`); return { ok: true, msg: 'Permisos actualizados' };
    }
    case 'soc_ceder': { if (!esF) return fail('Solo el fundador cede el mando'); const x = s.socios[msg.cid]; if (!x || msg.cid === p.cid) return fail('Elige a otro socio'); x.rol = 'fundador'; x.perm = {}; yo.rol = 'gerente'; yo.perm = {}; s.fundador = msg.cid; hist(m, sp, p.cid, `${p.nombre} cedió el mando a ${nombreDe(m, msg.cid)}`); return { ok: true, msg: 'Mando cedido' }; }
    case 'soc_aportar': {
      const x = msg.monto; if (!Number.isSafeInteger(x) || x <= 0) return fail('Monto inválido'); if (x > p.dinero) return fail('No te alcanza en tu cuenta de franquicias');
      m._mov(p, 'socio', -x); m._mov(sp, 'aporte', x); yo.aporte += x; hist(m, sp, p.cid, `${p.nombre} aportó $${x}`); return { ok: true, msg: `Aportaste $${x} a la caja compartida` };
    }
    case 'soc_salir': {
      if (esF && n > 1) return fail('El fundador debe ceder el mando o disolver la sociedad'); const t = total(s) || 1, pago = Math.min(sp.dinero, Math.floor(sp.dinero * (yo.aporte / t)));
      if (n === 1) return disolver(m, sp, p.cid); m._mov(sp, 'reparto', -pago); m._mov(p, 'socio', pago); delete s.socios[p.cid]; hist(m, sp, p.cid, `${p.nombre} salió y recibió $${pago}`); return { ok: true, msg: `Saliste de «${sp.nombre}» con $${pago}` };
    }
    case 'soc_disolver': case 'soc_repartir': {
      if (!esF) return fail('Solo el fundador lo propone'); if (msg.op === 'soc_repartir' && (!Number.isSafeInteger(msg.monto) || msg.monto <= 0 || msg.monto > sp.dinero)) return fail('Monto inválido para repartir');
      if (n === 1) return msg.op === 'soc_disolver' ? disolver(m, sp, p.cid) : repartir(m, sp, p.cid, msg.monto);
      return proponer(m, sp, p, { op: msg.op, monto: msg.monto }, msg.op === 'soc_disolver' ? 'Disolver la sociedad' : `Repartir $${msg.monto} entre los socios`);
    }
    case 'votar': {
      const pr = s.props.find(x => x.id === msg.propuesta); if (!pr) return fail('Esa propuesta ya no existe'); if (typeof msg.voto !== 'boolean') return fail('Voto inválido'); if (pr.votos[p.cid] !== undefined) return fail('Ya votaste');
      pr.votos[p.cid] = msg.voto; return resolver(m, sp, pr) || { ok: true, msg: 'Voto registrado' };
    }
  }
  const perm = OP_PERM[msg.op]; if (!perm) return fail('Operación desconocida'); if (!puede(sp, p.cid, perm)) return fail(`No tienes permiso de «${perm}» en esta sociedad`);
  if (VOTAN.has(msg.op) && n > 1) { const o = {}; for (const k of CLAVES) if (msg[k] !== undefined && ['string', 'number', 'boolean'].includes(typeof msg[k])) o[k] = typeof msg[k] === 'string' ? msg[k].slice(0, 40) : msg[k]; return proponer(m, sp, p, o, `${p.nombre}: ${o.op}${o.lote ? ' ' + o.lote : ''}${o.monto ? ' $' + o.monto : ''}`); }
  const r = m._exec(sp, msg); if (r.ok && !['informe'].includes(msg.op)) hist(m, sp, p.cid, `${p.nombre}: ${msg.op}${msg.lote ? ' ' + msg.lote : ''} → ${r.msg}`); return r;
}
function proponer(m, sp, p, op, txt) {
  const s = sp.soc; if (s.props.length >= 6) return fail('Hay demasiadas propuestas abiertas'); const pr = { id: s.nid++, cid: p.cid, op, txt, votos: { [p.cid]: true }, cierra: m.turno + VOTO_TURNOS };
  s.props.push(pr); hist(m, sp, p.cid, `${p.nombre} propuso: ${txt}`); return resolver(m, sp, pr) || { ok: true, msg: `Propuesta enviada: ${txt}. Cierra en ${VOTO_TURNOS} turnos.`, propuesta: pr.id };
}
function resolver(m, sp, pr, vence = false) {       // mayoría simple de socios; devuelve el resultado si se decidió
  const s = sp.soc, n = Object.keys(s.socios).length, si = Object.values(pr.votos).filter(v => v).length, no = Object.values(pr.votos).filter(v => !v).length;
  const aprobada = si * 2 > n, rechazada = no * 2 >= n || (vence && !aprobada); if (!aprobada && !rechazada) return null;
  s.props = s.props.filter(x => x !== pr);
  if (rechazada) { hist(m, sp, pr.cid, `Propuesta rechazada${vence ? ' (sin mayoría a tiempo)' : ''}: ${pr.txt}`); return { ok: true, msg: 'La propuesta no obtuvo mayoría' }; }
  const r = pr.op.op === 'soc_disolver' ? disolver(m, sp, pr.cid) : pr.op.op === 'soc_repartir' ? repartir(m, sp, pr.cid, pr.op.monto) : m._exec(sp, pr.op);
  hist(m, sp, pr.cid, `Aprobada: ${pr.txt} → ${r.msg}`); return { ...r, aprobada: true };
}
function repartir(m, sp, cid, monto) {
  if (!(monto > 0) || monto > sp.dinero) return fail('La caja no alcanza'); const r = reparto(sp.soc, monto);
  for (const [c, x] of Object.entries(r)) { const q = m.j.get(c); if (q && x) { m._mov(sp, 'reparto', -x); m._mov(q, 'socio', x); } }
  hist(m, sp, cid, `Se repartieron $${monto} según lo aportado`); return { ok: true, msg: `Repartiste $${monto} entre los socios` };
}
function disolver(m, sp, cid) {                     // se liquida todo, se paga la deuda y el resto se reparte proporcionalmente
  for (const [id, o] of [...m.o]) if (o.dueno === sp.cid) { m._mov(sp, 'venta', m.valor(id, o)); m.o.delete(id); m.cont.delete(id); m.sub.delete(id); }
  if (sp.deuda > 0) { const x = Math.min(sp.deuda, sp.dinero); m._mov(sp, 'abono', -x); sp.deuda -= x; }
  const r = reparto(sp.soc, sp.dinero); for (const [c, x] of Object.entries(r)) { const q = m.j.get(c); if (q && x) { m._mov(sp, 'reparto', -x); m._mov(q, 'socio', x); } }
  m._noticia('mercado', `Se disolvió la sociedad «${sp.nombre}».`); m.j.delete(sp.cid); return { ok: true, msg: 'Sociedad disuelta: se repartió lo que quedó' };
}
export function turno(m) {
  for (const sp of [...m.j.values()]) {
    if (!sp.soc) continue; const s = sp.soc;
    for (const [cid, t] of Object.entries(s.inv)) if (t <= m.turno) delete s.inv[cid];
    for (const pr of [...s.props]) if (pr.cierra <= m.turno) resolver(m, sp, pr, true);
  }
}
export function limpiar(s) {
  if (!s || typeof s !== 'object' || typeof s.fundador !== 'string' || !s.socios || typeof s.socios !== 'object') return null;
  const n = (x, d = 0) => (Number.isFinite(x) ? Math.max(0, Math.min(1e12, Math.floor(x))) : d), r = { fundador: s.fundador.slice(0, 40), socios: {}, hist: [], props: [], inv: {}, nid: Math.max(1, n(s.nid, 1)) };
  for (const cid of Object.keys(s.socios).slice(0, MAX_SOCIOS)) { const x = s.socios[cid]; r.socios[cid.slice(0, 40)] = { rol: ['fundador', 'gerente', 'socio'].includes(x?.rol) ? x.rol : 'socio', perm: Object.fromEntries(PERMISOS.filter(k => typeof x?.perm?.[k] === 'boolean').map(k => [k, x.perm[k]])), aporte: n(x?.aporte) }; }
  for (const h of (Array.isArray(s.hist) ? s.hist : []).slice(-MAX_HIST)) if (h && typeof h.txt === 'string') r.hist.push({ t: n(h.t), cid: String(h.cid).slice(0, 40), txt: h.txt.slice(0, 140) });
  for (const pr of (Array.isArray(s.props) ? s.props : []).slice(0, 6)) if (pr && typeof pr.op === 'object' && pr.op) { const op = {}; for (const k of CLAVES.concat(['monto'])) if (['string', 'number', 'boolean'].includes(typeof pr.op[k])) op[k] = typeof pr.op[k] === 'string' ? pr.op[k].slice(0, 40) : pr.op[k]; r.props.push({ id: n(pr.id, 1), cid: String(pr.cid).slice(0, 40), op, txt: String(pr.txt).slice(0, 140), votos: Object.fromEntries(Object.entries(pr.votos || {}).filter(([, v]) => typeof v === 'boolean').slice(0, MAX_SOCIOS)), cierra: n(pr.cierra) }); }
  for (const cid of Object.keys(s.inv || {}).slice(0, 8)) r.inv[cid.slice(0, 40)] = n(s.inv[cid]);
  if (!r.socios[r.fundador]) { const k = Object.keys(r.socios)[0]; if (!k) return null; r.fundador = k; } r.socios[r.fundador].rol = 'fundador'; return r;
}
export const vistaSoc = (m, cid) => {
  const sp = socDe(m, cid), inv = [];
  for (const q of m.j.values()) if (q.soc?.inv[cid] > m.turno) inv.push({ soc: q.cid, nombre: q.nombre, de: nombreDe(m, q.soc.fundador), quedan: q.soc.inv[cid] - m.turno });
  if (!sp) return { invitaciones: inv, mia: null };
  const s = sp.soc, P = permisos(s);
  return { invitaciones: inv, mia: { id: sp.cid, nombre: sp.nombre, rol: s.socios[cid].rol, fundador: s.fundador, dinero: sp.dinero, deuda: sp.deuda, limite: m.limiteDeuda(sp), ingresos: { ...sp.ingresos }, prov: sp.prov, ramas: [...sp.ramas], contrato: sp.contrato && sp.contrato.hasta > m.turno ? { ...sp.contrato } : null, maxF: m.maxFranq(sp),
    socios: Object.entries(s.socios).map(([c, x]) => ({ cid: c, nombre: nombreDe(m, c), rol: x.rol, aporte: x.aporte, perm: P[c] })), invitados: Object.keys(s.inv).map(c => nombreDe(m, c)),
    props: s.props.map(pr => ({ id: pr.id, txt: pr.txt, autor: nombreDe(m, pr.cid), si: Object.values(pr.votos).filter(v => v).length, no: Object.values(pr.votos).filter(v => !v).length, yoVote: pr.votos[cid] ?? null, quedan: pr.cierra - m.turno })), hist: s.hist.slice(-15).reverse() } };
};
