// Economía compartida AUTORITATIVA (pura, sin red): lotes, franquicias, competencia, mercado vivo, deuda, rivales, turnos.
// La valida el servidor, no el cliente. Todo el dinero se mueve con _mov (queda en el libro p.c): nada se crea de la nada.
import { lotes, loteDe, trafico, distLotes, LOTE_INICIAL } from '../world/ciudad.js';
import { existe, PRECIOS, ESPECIALIDADES, PROVEEDORES, GIROS_F, TIPOS_EVENTO, ADELANTO, CONTRATO_TURNOS, eventosEntre, efectoLote, costoInsumos, rasgos, encaje, valorPercibido, perfilBarrio, barrioDeLote, textoEvento } from '../economia/mercado.js';
import { efectos, nodo, puedeNodo } from '../economia/ramas.js';
import { turnoRivales, sembrarRivales, limpiarNpc } from '../economia/rivales.js';
export const TURNO_MS = 10000, MAX_TURNOS = 30, MAX_FRANQ = 6, RADIO = 40, CUPO_MAX = 1500, MEJORA_MAX = 5;
export const MAX_OFFLINE = 360, INTERES = .012, PROMO_TURNOS = 6, PROMO_COSTO = .1, PROMO_BONO = .25, OFFLINE_ING = .7, SUELDO_GER = hab => 6 + 4 * hab;
const COLORES = ['#d9822b', '#2f6b5f', '#b8402f', '#8a6bb0', '#4a7fb0', '#d9b38c'];
export const precioLote = l => 300 + 120 * trafico(l);
export const costoMejora = (l, nivel) => Math.round(precioLote(l) * .5 * nivel);
export const valorVenta = (l, o) => Math.round(.7 * (precioLote(l) + o.invertido));
const fail = msg => ({ ok: false, msg });
const lim = (x, a, b) => Math.min(b, Math.max(a, x));
const entero = (x, a, b, d) => (Number.isFinite(x) ? Math.floor(lim(x, a, b)) : d);

export class Mundo {
  constructor({ seed = 7, ahora = Date.now } = {}) {
    Object.assign(this, { seed, ahora }); this.j = new Map(); this.o = new Map(); this.v = 0; this.turno = 0; this.t0 = ahora();
    this.noticias = []; this.nn = 1; this.giro = null; this._lc = new Map(); this._offline = false; this._compras = new Map();
  }
  lote(id) { let l = this._lc.get(id); if (l === undefined) { l = loteDe(this.seed, id); this._lc.set(id, l); } return l; }
  precio(l) { return precioLote(l); }
  costoMejora(l, nivel) { return costoMejora(l, nivel); }
  _ev(p, t) { p.eventos.push(t); if (p.eventos.length > 20) p.eventos.shift(); }
  _noticia(k, txt, para = null) { this.noticias.push({ id: this.nn++, t: this.turno, k, txt, para }); if (this.noticias.length > 80) this.noticias.shift(); }
  _franq(cid) { let n = 0; for (const o of this.o.values()) if (o.dueno === cid && o.tipo === 'franquicia') n++; return n; }
  _cupo(p) { const t = this.ahora(); p.cupo = Math.min(CUPO_MAX, p.cupo + Math.max(0, t - p.cupoT) / 1000 * (12 + 4 * this._franq(p.cid))); p.cupoT = t; }
  ef(p) { return efectos(p.ramas); }
  maxFranq(p) { return MAX_FRANQ + this.ef(p).maxF; }
  _mov(p, tipo, x) { x = Math.round(x); p.dinero += x; p.c[tipo] = (p.c[tipo] || 0) + x; return x; }   // ÚNICA forma de mover dinero
  _nuevo(cid, nombre, hogar) {
    const p = { cid, nombre, color: COLORES[this.j.size % COLORES.length], dinero: 0, cupo: CUPO_MAX, cupoT: this.ahora(), hogar, eventos: [], ingresos: {}, vistos: new Map(),
      deuda: 0, prov: 'mercado', contrato: null, ramas: [], st: { quiebras: 0, compradasVenta: 0, prestamos: 0, pagados: 0, contratos: 0 }, c: {}, informe: null, npc: null };
    this.j.set(cid, p); return p;
  }
  alta(cid, nombre) {
    if (this.j.has(cid)) return this.j.get(cid);
    let hogar = null;
    const libre = l => l && !this.o.has(l.id);
    if (libre(this.lote(LOTE_INICIAL))) hogar = this.lote(LOTE_INICIAL);
    for (let r = 0; r <= 4 && !hogar; r++) for (let cy = -r; cy <= r && !hogar; cy++) for (let cx = -r; cx <= r && !hogar; cx++)
      if (Math.max(Math.abs(cx), Math.abs(cy)) === r) hogar = lotes(this.seed, cx, cy).find(libre) || null;
    if (!hogar) return null;
    const p = this._nuevo(cid, nombre, hogar.id); this.o.set(hogar.id, { dueno: cid, nivel: 1, tipo: 'hogar', invertido: 0 }); this.v++; return p;
  }
  sembrar(n) { if (!(n > 0) || !this.j.size) return; sembrarRivales(this, n); this.v++; }   // rivales autónomos: se siembran tras el primer jugador
  _franquicia(giro) { return { dueno: null, nivel: 1, tipo: 'franquicia', invertido: 0, p: 2, esp: null, rep: 5, giro: existe(GIROS_F, giro) ? giro : null, recorte: false, ger: null, enVenta: null, promo: 0 }; }
  op(cid, m) {                                  // intención del cliente: idempotente por id, validada y atómica
    const p = this.j.get(cid); if (!p || !m || p.npc) return fail('Jugador desconocido');
    const id = String(m.id ?? ''); if (!id || id.length > 40) return fail('Operación inválida');
    if (p.vistos.has(id)) return p.vistos.get(id);
    this.avanzar();
    const r = this._exec(p, m); p.vistos.set(id, r); if (p.vistos.size > 200) p.vistos.delete(p.vistos.keys().next().value);
    if (r.ok) this.v++; return r;
  }
  limiteDeuda(p) { return Math.round((300 + .5 * Math.max(0, this.activos(p))) * this.ef(p).prestamo); }
  _exec(p, m) {
    const ef = this.ef(p);
    switch (m.op) {
      case 'invertir': {
        this._cupo(p); const x = m.monto;
        if (!Number.isSafeInteger(x) || x <= 0) return fail('Monto inválido');
        if (x > p.cupo) return { ok: false, msg: `Por ahora solo puedes invertir $${Math.floor(p.cupo)}`, max: Math.floor(p.cupo) };
        p.cupo -= x; this._mov(p, 'aporte', x); return { ok: true, msg: `Invertiste $${x}`, monto: x };
      }
      case 'prestamo': {
        const x = m.monto, tope = this.limiteDeuda(p) - p.deuda;
        if (!Number.isSafeInteger(x) || x <= 0) return fail('Monto inválido');
        if (x > tope) return fail(tope > 0 ? `Tu límite de crédito disponible es $${tope}` : 'Ya usaste todo tu crédito');
        this._mov(p, 'prestamo', x); p.deuda += x; p.st.prestamos++; return { ok: true, msg: `Préstamo de $${x} (interés ${(INTERES * ef.interes * 100).toFixed(1)}% por turno)` };
      }
      case 'abonar': {
        const x = m.monto;
        if (!Number.isSafeInteger(x) || x <= 0) return fail('Monto inválido'); if (p.deuda <= 0) return fail('No tienes deuda');
        if (x > p.deuda) return fail(`Solo debes $${p.deuda}`); if (x > p.dinero) return fail('No te alcanza en la cuenta de franquicias');
        this._mov(p, 'abono', -x); p.deuda -= x; if (p.deuda === 0) p.st.pagados++; return { ok: true, msg: p.deuda ? `Abonaste $${x}` : 'Deuda saldada' };
      }
      case 'proveedor': {
        if (!existe(PROVEEDORES, m.prov)) return fail('Proveedor inexistente'); const pr = PROVEEDORES[m.prov];
        if (p.contrato && p.contrato.hasta > this.turno) return fail(`Tu contrato con ${PROVEEDORES[p.contrato.prov].n} dura hasta el turno ${p.contrato.hasta}`);
        p.prov = m.prov; p.contrato = null;
        if (m.contrato === true) { p.contrato = { prov: m.prov, hasta: this.turno + CONTRATO_TURNOS }; p.st.contratos++; return { ok: true, msg: `Contrato con ${pr.n} por ${CONTRATO_TURNOS} turnos: precio fijo y protegido de la escasez` }; }
        return { ok: true, msg: `Ahora compras con ${pr.n}` };
      }
      case 'rama': {
        const n = typeof m.rama === 'string' ? nodo(m.rama) : null; if (!n || n.donde !== 'cadena') return fail('Mejora inexistente');
        const e = puedeNodo(p.ramas, n.id); if (e) return fail(e); if (p.dinero < n.costo) return fail(`Necesitas $${n.costo}`);
        this._mov(p, 'rama', -n.costo); p.ramas.push(n.id); return { ok: true, msg: `${n.n}: ${n.pro}. Contra: ${n.contra}` };
      }
      case 'informe': p.informe = null; return { ok: true, msg: 'Informe leído' };
    }
    const l = typeof m.lote === 'string' ? this.lote(m.lote) : null; if (!l) return fail('Lote inexistente');
    const o = this.o.get(l.id), pr = precioLote(l);
    if (m.op === 'comprar') {
      if (this._franq(p.cid) >= this.maxFranq(p)) return fail(`Máximo ${this.maxFranq(p)} franquicias`);
      if (o) {                                    // un local puesto en venta por su dueño
        if (o.tipo !== 'franquicia' || o.enVenta == null) return fail('Ese lote ya tiene dueño');
        if (o.dueno === p.cid) return fail('Ya es tuyo'); if (p.dinero < o.enVenta) return fail(`Necesitas $${o.enVenta} en tu cuenta de franquicias`);
        const vend = this.j.get(o.dueno), precio = o.enVenta; this._mov(p, 'compra', -precio); if (vend) { this._mov(vend, 'venta', precio); this._ev(vend, `Vendiste ${l.id} por $${precio}`); if (vend.npc) vend.npc.mem.push({ t: this.turno, k: 'vendi', cid: p.cid }); }
        Object.assign(o, { dueno: p.cid, enVenta: null, promo: 0, ger: null, recorte: false }); if (!p.npc) p.st.compradasVenta++;
        this._ev(p, `Compraste la franquicia ${l.id} por $${precio}`); this._noticia('mercado', `${p.nombre} compró una franquicia en ${perfilBarrio(this.seed, barrioDeLote(l)).nombre}${vend ? ` que vendía ${vend.nombre}` : ''}.`);
        return { ok: true, msg: 'Franquicia comprada' };
      }
      if (p.dinero < pr) return fail(`Necesitas $${pr} en tu cuenta de franquicias`);
      this._mov(p, 'compra', -pr); this.o.set(l.id, { ...this._franquicia(m.giro), dueno: p.cid }); this._ev(p, `Abriste una franquicia en ${l.id}`);
      return { ok: true, msg: 'Franquicia abierta' };
    }
    if (!o || o.dueno !== p.cid || o.tipo !== 'franquicia') return fail('Esa franquicia no es tuya');
    switch (m.op) {
      case 'mejorar': {
        if (o.nivel >= MEJORA_MAX) return fail('Ya está al máximo'); const c = Math.round(costoMejora(l, o.nivel) * ef.mej);
        if (p.dinero < c) return fail(`Necesitas $${c}`); this._mov(p, 'mejora', -c); o.invertido += c; o.nivel++; return { ok: true, msg: `Mejorada al nivel ${o.nivel}` };
      }
      case 'vender': { const g = valorVenta(l, o); this._mov(p, 'venta', g); this.o.delete(l.id); this._ev(p, `Vendiste ${l.id} por $${g}`); return { ok: true, msg: `Vendida por $${g}` }; }
      case 'listar': {
        const base = pr + o.invertido, x = m.precio == null ? Math.round(.85 * base) : m.precio;
        if (!Number.isSafeInteger(x) || x < Math.round(.5 * base) || x > Math.round(1.3 * base)) return fail(`Pide entre $${Math.round(.5 * base)} y $${Math.round(1.3 * base)}`);
        o.enVenta = x; return { ok: true, msg: `En venta por $${x}. Si nadie la compra sigue produciendo para ti.` };
      }
      case 'retirar': o.enVenta = null; return { ok: true, msg: 'Ya no está en venta' };
      case 'ajustar': {
        let costo = 0;
        if (m.precio !== undefined) { if (!Number.isInteger(m.precio) || m.precio < 0 || m.precio >= PRECIOS.length) return fail('Precio inválido'); }
        if (m.esp !== undefined && m.esp !== null && !existe(ESPECIALIDADES, m.esp)) return fail('Especialidad inexistente');
        if (m.recorte !== undefined && typeof m.recorte !== 'boolean') return fail('Valor inválido');
        if (m.esp && m.esp !== o.esp) costo = Math.round(pr * .15); if (p.dinero < costo) return fail(`Cambiar de especialidad cuesta $${costo}`);
        if (m.precio !== undefined) o.p = m.precio; if (m.recorte !== undefined) o.recorte = m.recorte;
        if (m.esp !== undefined) { if (costo) this._mov(p, 'mejora', -costo); o.esp = m.esp; if (costo) o.invertido += costo; }
        return { ok: true, msg: 'Política actualizada' + (costo ? ` (−$${costo})` : '') };
      }
      case 'promocion': {
        const c = Math.round(pr * PROMO_COSTO); if (o.promo > this.turno) return fail('Ya hay una promoción activa'); if (p.dinero < c) return fail(`Una promoción cuesta $${c}`);
        this._mov(p, 'promo', -c); o.promo = this.turno + PROMO_TURNOS; return { ok: true, msg: `Promoción por ${PROMO_TURNOS} turnos: atraes ${Math.round(PROMO_BONO * 100)}% más clientes` };
      }
      case 'gerente': {
        if (m.accion === 'despedir') { if (!o.ger) return fail('No hay gerente'); o.ger = null; return { ok: true, msg: 'Gerente despedido' }; }
        const hab = m.hab; if (![2, 3, 4].includes(hab)) return fail('Nivel de gerente inválido'); if (o.ger) return fail('Ya hay un gerente');
        const s = SUELDO_GER(hab), c = 3 * s; if (p.dinero < c) return fail(`Contratarlo cuesta $${c} (3 turnos de sueldo)`);
        this._mov(p, 'sueldo', -c); o.ger = { hab, sueldo: s }; return { ok: true, msg: `Gerente contratado: $${s} por turno` };
      }
    }
    return fail('Operación desconocida');
  }
  avanzar() {                                   // turnos por reloj; si hubo una ausencia larga solo se aplican MAX_TURNOS (sin acumulación infinita)
    const t = this.ahora(), n = Math.min(MAX_TURNOS, Math.floor((t - this.t0) / TURNO_MS));
    for (let i = 0; i < n; i++) this._turno();
    this.t0 = t - this.t0 > MAX_TURNOS * TURNO_MS ? t : this.t0 + n * TURNO_MS;
  }
  // ---- cálculo económico de una franquicia en este turno ----
  _atr(o, seg) {
    if (o.tipo === 'hogar') return 1.25;
    const d = this.j.get(o.dueno), prov = existe(PROVEEDORES, d?.prov) ? PROVEEDORES[d.prov] : PROVEEDORES.mercado;
    return (1 + .35 * (o.nivel - 1)) * encaje(seg, rasgos(o, prov)) * (o.promo > this.turno ? 1 + PROMO_BONO : 1);
  }
  _calcular(b, todos, p, ef, efl) {
    const o = b.o, prov = existe(PROVEEDORES, p.prov) ? PROVEEDORES[p.prov] : PROVEEDORES.mercado, contrato = !!(p.contrato && p.contrato.hasta > this.turno), hab = o.ger?.hab ?? 0;
    let suma = 0; for (const c of todos) if (distLotes(b.l, c.l) <= RADIO) suma += this._atr(c.o, efl.seg);
    const share = this._atr(o, efl.seg) / suma, pen = efl.escasez && !contrato ? 1 - prov.exp : 0;
    const cap = (1.35 + .3 * (o.nivel - 1) + ef.capF + .05 * hab) * (1 - .2 * pen), demanda = Math.min(efl.dem, cap), pm = PRECIOS[o.p ?? 2] ?? 1;
    let ing = trafico(b.l) * 16 * demanda * share * (1 + .5 * (o.nivel - 1)) * pm * ef.ingF * (1 + .07 * hab);
    if (this._offline && !p.npc) ing *= OFFLINE_ING;
    ing = Math.round(ing);
    const mant = Math.round(precioLote(b.l) * .01 * ef.mantF * (o.esp ? ESPECIALIDADES[o.esp].mant : 1) * (o.recorte ? .75 : 1));
    const ins = Math.round(ing * .3 * (costoInsumos(p.prov, efl.ing, contrato) * ef.insumos - 1)), ger = o.ger ? o.ger.sueldo : 0;
    // reputación: objetivo según valor percibido, personal, reputación de marca y problemas de abastecimiento
    const objetivo = lim(5 + .35 * (o.nivel - 1) + lim((valorPercibido(o, prov) - 1) * 3, -2, 2) + .15 * hab + ef.repF - (o.recorte ? 1.5 : 0) - pen, 0, 10);
    return { ing, mant, ins, ger, neto: ing - mant - ins - ger, objetivo };
  }
  _turno() {
    this.turno++; const T = this.turno, evs = eventosEntre(this.seed, T), todos = [...this.o].map(([id, o]) => ({ id, o, l: this.lote(id) })), efl = new Map(), efs = new Map();
    for (const e of evs) { if (e.estado === 'proximo' && e.inicia === ADELANTO) this._noticia('mercado', 'Se acerca: ' + textoEvento(this.seed, e)); else if (e.estado === 'activo' && e.desde === T) this._noticia('mercado', textoEvento(this.seed, e)); }
    for (const b of todos) {
      if (b.o.tipo !== 'franquicia') continue; const p = this.j.get(b.o.dueno); if (!p) continue;
      const ef = efs.get(p.cid) || efs.set(p.cid, this.ef(p)).get(p.cid), bid = barrioDeLote(b.l); let el = efl.get(bid); if (!el) { el = efectoLote(this.seed, b.l, T, evs); efl.set(bid, el); }
      const r = this._calcular(b, todos, p, ef, el), protegido = this._offline && !p.npc;
      if (p.dinero + r.neto < 0 && !protegido) { this.o.delete(b.id); delete p.ingresos[b.id]; p.st.quiebras++; this._ev(p, `Quiebra: se cerró la franquicia ${b.id}`); this._noticia('economia', `${p.nombre} cierra una franquicia en ${perfilBarrio(this.seed, bid).nombre}: no cubrió sus gastos.`, p.npc ? null : p.cid); continue; }
      let neto = r.neto; if (p.dinero + neto < 0) neto = -p.dinero;   // ausencia: se paga solo lo que alcanza, nunca se cierra ni se endeuda por inactividad
      this._mov(p, 'ingreso', r.ing); this._mov(p, 'mant', -r.mant); if (r.ins) this._mov(p, 'insumos', -r.ins); if (r.ger) this._mov(p, 'sueldo', -r.ger);
      if (neto !== r.neto) this._mov(p, 'ajuste', neto - r.neto);   // el ajuste solo devuelve lo que no se pudo pagar
      p.ingresos[b.id] = neto; b.o.rep = lim((b.o.rep ?? 5) + (r.objetivo - (b.o.rep ?? 5)) * .08, 0, 10);
    }
    for (const p of this.j.values()) {            // intereses y embargo
      if (p.contrato && p.contrato.hasta <= T) p.contrato = null;
      if (p.deuda <= 0) continue; const ef = efs.get(p.cid) || this.ef(p), i = Math.ceil(p.deuda * INTERES * ef.interes);
      if (p.dinero >= i) this._mov(p, 'interes', -i); else p.deuda += i;   // sin efectivo, el interés se capitaliza
      if (p.deuda > this.limiteDeuda(p) * 1.6 && !(this._offline && !p.npc)) this._embargo(p);
    }
    turnoRivales(this); this.v++;
  }
  _embargo(p) {                                 // deuda fuera de control: se liquida la franquicia de menor valor y se paga al banco
    let peor = null, vp = Infinity; for (const [id, o] of this.o) if (o.dueno === p.cid && o.tipo === 'franquicia') { const v = valorVenta(this.lote(id), o); if (v < vp) { vp = v; peor = id; } }
    if (!peor) return; this._mov(p, 'venta', vp); this.o.delete(peor); delete p.ingresos[peor];
    const x = Math.min(p.deuda, p.dinero); this._mov(p, 'abono', -x); p.deuda -= x; this._ev(p, `Embargo: el banco liquidó la franquicia ${peor}`);
    this._noticia('economia', `El banco embargó una franquicia de ${p.nombre} por exceso de deuda.`, p.npc ? null : p.cid);
  }
  // ---- ausencia: se simula con límites razonables y se deja un informe ----
  ausencia(ms) {
    const dt = Math.max(0, this.ahora() - this.t0), total = Math.max(0, ms) + (this.t0 > this.ahora() ? 0 : dt), n = Math.min(MAX_OFFLINE, Math.floor(total / TURNO_MS));
    if (n < 6) return null;
    const humanos = [...this.j.values()].filter(p => !p.npc), base = new Map(humanos.map(p => [p.cid, { dinero: p.dinero, pat: this.patrimonio(p), deuda: p.deuda }])), t0 = this.turno;
    this._offline = true; this._compras = new Map(); try { for (let i = 0; i < n; i++) this._turno(); } finally { this._offline = false; }
    this.t0 = n >= MAX_OFFLINE ? this.ahora() : this.ahora() - (total - n * TURNO_MS);
    const evs = eventosEntre(this.seed, this.turno).filter(e => e.estado === 'activo').map(e => TIPOS_EVENTO[e.tipo].n);
    let enVenta = 0; for (const o of this.o.values()) if (o.enVenta != null) enVenta++;
    for (const p of humanos) {
      const b = base.get(p.cid), mias = this.noticias.filter(x => x.t > t0 && (!x.para || x.para === p.cid)).slice(-8).map(x => x.txt);
      p.informe = { turnos: n, minutos: Math.round(n * TURNO_MS / 60000), dDinero: p.dinero - b.dinero, dPatrimonio: this.patrimonio(p) - b.pat, dDeuda: p.deuda - b.deuda, noticias: mias, eventos: evs, enVenta, limitado: total > MAX_OFFLINE * TURNO_MS };
    }
    this.v++; return n;
  }
  activos(p) { let s = p.dinero; for (const [id, o] of this.o) if (o.dueno === p.cid && o.tipo === 'franquicia') s += valorVenta(this.lote(id), o); return s; }
  patrimonio(p) { return this.activos(p) - p.deuda; }
  vista(cid) {                                  // lo que ve cada jugador: todos ven propiedades y patrimonio; solo tú ves tu efectivo y cupo
    const p = this.j.get(cid); if (p) this._cupo(p); const T = this.turno;
    const evs = eventosEntre(this.seed, T).map(e => ({ id: e.id, tipo: e.tipo, n: TIPOS_EVENTO[e.tipo].n, estado: e.estado, inicia: e.inicia, quedan: e.hasta - T, barrio: e.barrio ? perfilBarrio(this.seed, e.barrio).nombre : null, txt: textoEvento(this.seed, e) }));
    let mio = null;
    if (p) {
      const el = efectoLote(this.seed, this.lote(p.hogar), T), ef = this.ef(p);
      mio = { dinero: p.dinero, cupo: Math.floor(p.cupo), hogar: p.hogar, eventos: p.eventos.slice(-8), ingresos: p.ingresos, deuda: p.deuda, limite: this.limiteDeuda(p), prov: p.prov, contrato: p.contrato && p.contrato.hasta > T ? { ...p.contrato } : null,
        ramas: [...p.ramas], ef, maxF: this.maxFranq(p), st: { ...p.st }, c: { ...p.c }, informe: p.informe,
        demanda: { dem: el.dem, ing: el.ing, escasez: el.escasez, barrio: { nombre: el.barrio.nombre, seg: el.barrio.seg, dom: el.barrio.dom } } };
    }
    return { v: this.v, turno: T, msTurno: Math.max(0, TURNO_MS - (this.ahora() - this.t0)),
      jugadores: [...this.j.values()].map(q => ({ cid: q.cid, nombre: q.nombre, color: q.color, patrimonio: this.patrimonio(q), franq: this._franq(q.cid), npc: !!q.npc, perfil: q.npc?.perfil || null, retirado: q.npc?.estado === 'retirado' })).sort((a, b) => b.patrimonio - a.patrimonio),
      lotes: [...this.o].map(([id, o]) => [id, o.dueno, o.nivel, o.tipo === 'hogar' ? 'h' : 'f', o.invertido, o.p ?? 2, o.esp ?? null, Math.round((o.rep ?? 5) * 10) / 10, o.enVenta ?? null, o.giro ?? null, o.promo > T ? 1 : 0, o.ger ? o.ger.hab : 0, o.recorte ? 1 : 0]),
      mercado: { eventos: evs }, noticias: this.noticias.filter(x => !x.para || x.para === cid).slice(-12), mio };
  }
  serializar() {
    return { seed: this.seed, v: this.v, turno: this.turno, dt: this.ahora() - this.t0, nn: this.nn, noticias: this.noticias.slice(-40),
      j: [...this.j.values()].map(({ vistos, ...p }) => p), o: [...this.o] };
  }
  restaurar(d) {
    const n = (x, a, b, def) => (Number.isFinite(x) ? Math.min(b, Math.max(a, x)) : def);
    if (!d || d.seed !== this.seed) return false;
    this.v = n(d.v, 0, 1e12, 0); this.turno = n(d.turno, 0, 1e9, 0); this.t0 = this.ahora() - n(d.dt, 0, 1e12, 0); this.nn = n(d.nn, 1, 1e12, 1);
    this.noticias = (Array.isArray(d.noticias) ? d.noticias : []).slice(-40).filter(x => x && typeof x.txt === 'string').map(x => ({ id: n(x.id, 0, 1e12, 0), t: n(x.t, 0, 1e9, 0), k: String(x.k).slice(0, 12), txt: x.txt.slice(0, 200), para: typeof x.para === 'string' ? x.para : null }));
    for (const p of d.j || []) if (typeof p.cid === 'string' && loteDe(this.seed, p.hogar)) {
      const q = this._nuevo(p.cid, String(p.nombre).slice(0, 16), p.hogar); q.color = COLORES.includes(p.color) ? p.color : COLORES[0];
      q.dinero = Math.floor(n(p.dinero, 0, 1e12, 0)); q.cupo = n(p.cupo, 0, CUPO_MAX, CUPO_MAX); q.eventos = (p.eventos || []).slice(-20).map(String);
      q.deuda = Math.floor(n(p.deuda, 0, 1e12, 0)); q.prov = existe(PROVEEDORES, p.prov) ? p.prov : 'mercado'; q.contrato = p.contrato && existe(PROVEEDORES, p.contrato.prov) ? { prov: p.contrato.prov, hasta: Math.floor(n(p.contrato.hasta, 0, 1e9, 0)) } : null;
      q.ramas = (Array.isArray(p.ramas) ? p.ramas : []).filter(id => nodo(id)?.donde === 'cadena').slice(0, 12); for (const k in q.st) q.st[k] = Math.floor(n(p.st?.[k], 0, 1e9, 0));
      q.c = {}; if (p.c && typeof p.c === 'object') for (const k of Object.keys(p.c)) if (/^[a-z]{2,12}$/.test(k)) q.c[k] = Math.round(n(p.c[k], -1e13, 1e13, 0));
      if (!p.c) q.c = { inicial: q.dinero };   // partida anterior al libro: se parte del saldo actual
      for (const k of Object.keys(p.ingresos || {})) if (loteDe(this.seed, k)) q.ingresos[k] = Math.round(n(p.ingresos[k], -1e9, 1e9, 0));
      q.informe = p.informe && typeof p.informe === 'object' ? { turnos: n(p.informe.turnos, 0, 1e5, 0), minutos: n(p.informe.minutos, 0, 1e5, 0), dDinero: n(p.informe.dDinero, -1e12, 1e12, 0), dPatrimonio: n(p.informe.dPatrimonio, -1e12, 1e12, 0), dDeuda: n(p.informe.dDeuda, -1e12, 1e12, 0), noticias: (Array.isArray(p.informe.noticias) ? p.informe.noticias : []).slice(0, 10).map(x => String(x).slice(0, 200)), eventos: (Array.isArray(p.informe.eventos) ? p.informe.eventos : []).slice(0, 6).map(x => String(x).slice(0, 40)), enVenta: n(p.informe.enVenta, 0, 1e5, 0), limitado: !!p.informe.limitado } : null;
      q.npc = limpiarNpc(p.npc);
    }
    for (const [id, o] of d.o || []) if (loteDe(this.seed, id) && this.j.has(o.dueno)) {
      const f = o.tipo === 'hogar' ? null : this._franquicia(o.giro);
      this.o.set(id, { dueno: o.dueno, nivel: Math.floor(n(o.nivel, 1, MEJORA_MAX, 1)), tipo: o.tipo === 'hogar' ? 'hogar' : 'franquicia', invertido: Math.floor(n(o.invertido, 0, 1e9, 0)),
        ...(f ? { p: entero(o.p, 0, PRECIOS.length - 1, 2), esp: existe(ESPECIALIDADES, o.esp) ? o.esp : null, rep: n(o.rep, 0, 10, 5), giro: f.giro, recorte: o.recorte === true, ger: o.ger && [2, 3, 4].includes(o.ger.hab) ? { hab: o.ger.hab, sueldo: SUELDO_GER(o.ger.hab) } : null, enVenta: Number.isFinite(o.enVenta) && o.enVenta >= 0 ? Math.floor(o.enVenta) : null, promo: Math.floor(n(o.promo, 0, 1e9, 0)) } : {}) });
    }
    return true;
  }
}
