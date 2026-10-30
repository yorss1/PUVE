// Simulación pura (sin DOM ni canvas): se prueba con node y no depende del render.
import { PROVEEDORES, existe, azar } from '../economia/mercado.js';
import { efectos, nodo, puedeNodo } from '../economia/ramas.js';
import { SEMANA_S } from '../economia/progresion.js';
export const V = 1;
const SOL = new Set('#tKRFxmvBp');
const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const num = (v, a, b, d) => (Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : d);
const NOMBRES_EMP = ['Lalo', 'Mari', 'Beto', 'Ana', 'Chuy', 'Rosa', 'Nico', 'Tere'];
export const ST0 = () => ({ servidos: 0, perdidos: 0, racha: 0, mejor: 0, tiempo: 0, semana: 0, semanas: 0, apuros: 0 });
export const espera = hab => 6 + 3 * hab;                 // sueldo por minuto que un empleado considera justo

export class Sim {
  constructor(cfg, save, rnd = Math.random) {
    this.cfg = cfg; this.rnd = rnd; this.t = 0; this.nid = 1; this.ver = 0;
    this.g = cfg.mapa.map(r => r.split(''));
    this.H = this.g.length; this.W = this.g[0].length;
    this.d = { dinero: cfg.inicial.dinero, xp: 0, rep: 5, stock: cfg.inicial.stock, comp: [], st: ST0(), prov: 'mercado', ramas: [] };
    this.ef = efectos([]); this.mercado = { dem: 1, ing: 1 }; this.avisos = []; this._min = 0; this._seg = 0; this._tc = 0; this._apuro = 0;
    this.tickets = []; this.clientes = []; this.emps = []; this.cuentas = []; this.libro = [];
    this.est = []; this.cajas = []; this.refris = []; this.tableros = [];
    this.llevando = null; this.spawn = 2; this.p = { x: 1.5, y: 1.5, dir: 1 }; this.puerta = null;
    this.g.forEach((row, y) => row.forEach((ch, x) => {
      if (ch === 'K') this.est.push({ x, y, tk: null, t: 0, res: null });
      if (ch === 'R') this.cajas.push({ x, y });
      if (ch === 'F') this.refris.push({ x, y });
      if (ch === 'B') this.tableros.push({ x, y });
      if (ch === 'D') this.puerta = { x, y };
      if (ch === '@') { this.p.x = x + .5; this.p.y = y + .5; row[x] = '.'; }
    }));
    if (save) this._cargar(save);
  }
  get nivel() { return 1 + Math.floor(this.d.xp / 60); }
  get gerente() { return this.emps.find(e => e.ger) || null; }
  get prov() { return PROVEEDORES[this.d.prov] || PROVEEDORES.mercado; }
  costoSurtir() { return Math.round(this.cfg.ing * 5 * this.prov.mult * this.mercado.ing * this.ef.ing); }
  plato(id) { return this.cfg.platos.find(p => p.id === id); }
  tk(id) { return this.tickets.find(t => t.id === id); }
  _log(tipo, monto) { this.libro.push({ t: +this.t.toFixed(1), tipo, monto, saldo: this.d.dinero }); if (this.libro.length > 100) this.libro.shift(); }

  // ---- guardado (validado; nunca se confía en el contenido) ----
  serializar() {
    const plantilla = this.emps.map(e => ({ mid: e.mid, n: e.n, hab: e.hab, exp: e.exp, sat: Math.round(e.sat), sueldo: e.sueldo, ger: !!e.ger }));
    return { v: V, ts: Date.now(), d: { ...this.d, comp: [...this.d.comp], st: { ...this.d.st }, ramas: [...this.d.ramas], plantilla }, px: this.p.x, py: this.p.y };
  }
  _cargar(s) {
    if (!s || s.v !== V || !s.d) return;
    this.d.dinero = Math.floor(num(s.d.dinero, 0, 1e9, this.d.dinero));
    this.d.xp = Math.floor(num(s.d.xp, 0, 1e9, 0));
    this.d.rep = num(s.d.rep, 0, 10, 5);
    this.d.stock = Math.floor(num(s.d.stock, 0, this.cfg.maxStock, this.d.stock));
    if (s.d.st && typeof s.d.st === 'object') for (const k of Object.keys(this.d.st)) this.d.st[k] = k === 'tiempo' || k === 'semana' ? num(s.d.st[k], 0, 1e9, 0) : Math.floor(num(s.d.st[k], 0, 1e9, 0));
    if (existe(PROVEEDORES, s.d.prov)) this.d.prov = s.d.prov;
    for (const id of Array.isArray(s.d.ramas) ? s.d.ramas : []) { const n = nodo(id); if (n && n.donde === 'local' && !puedeNodo(this.d.ramas, id)) this.d.ramas.push(id); }
    this.ef = efectos(this.d.ramas);
    for (const id of Array.isArray(s.d.comp) ? s.d.comp : []) {
      const m = this.cfg.mejoras.find(m => m.id === id);
      if (m && !this.d.comp.includes(id) && this._aplicar(m)) this.d.comp.push(id);
    }
    for (const e of Array.isArray(s.d.plantilla) ? s.d.plantilla : []) {   // atributos de cada empleado (se emparejan por la mejora que los contrató)
      const x = this.emps.find(q => q.mid === e?.mid); if (!x) continue;
      x.n = typeof e.n === 'string' && e.n ? e.n.slice(0, 16) : x.n; x.hab = Math.floor(num(e.hab, 1, 5, x.hab)); x.exp = Math.floor(num(e.exp, 0, 1e6, 0)); x.sat = num(e.sat, 0, 100, 70); x.sueldo = Math.floor(num(e.sueldo, 1, 99, espera(x.hab))); x.ger = e.ger === true;
    }
    if (this.gerente && this.emps.filter(e => e.ger).length > 1) for (const e of this.emps.slice(1)) e.ger = false;
    if (Number.isFinite(s.px) && Number.isFinite(s.py) && !this.solido(Math.floor(s.px), Math.floor(s.py))) { this.p.x = s.px; this.p.y = s.py; }
  }

  // ---- mundo ----
  solido(x, y) { return x < 0 || y < 0 || x >= this.W || y >= this.H || SOL.has(this.g[y][x]); }
  _choca(x, y, r) { return [[-r, -r], [r, -r], [-r, r], [r, r]].some(([ox, oy]) => this.solido(Math.floor(x + ox), Math.floor(y + oy))); }
  mover(e, dx, dy, r = .28) {
    if (!this._choca(e.x + dx, e.y, r)) e.x += dx;
    if (!this._choca(e.x, e.y + dy, r)) e.y += dy;
  }
  vecinos(x, y) { return D4.map(([dx, dy]) => ({ x: x + dx, y: y + dy })).filter(n => !this.solido(n.x, n.y)); }
  asientos() { const r = []; this.g.forEach((row, y) => row.forEach((c, x) => { if (c === 'c') r.push({ x, y }); })); return r; }
  ruta(ax, ay, metas) {
    const k = (x, y) => y * this.W + x, meta = new Set(metas.map(m => k(m.x, m.y)));
    const prev = new Map([[k(ax, ay), -1]]), q = [[ax, ay]];
    for (let i = 0; i < q.length; i++) {
      const [x, y] = q[i];
      if (meta.has(k(x, y))) { const r = []; let c = k(x, y); while (prev.get(c) !== -1) { r.unshift({ x: c % this.W, y: Math.floor(c / this.W) }); c = prev.get(c); } return r; }
      for (const [dx, dy] of D4) { const nx = x + dx, ny = y + dy, kk = k(nx, ny); if (this.solido(nx, ny) || prev.has(kk)) continue; prev.set(kk, k(x, y)); q.push([nx, ny]); }
    }
    return null;
  }
  seguir(e, dt, v) {
    const n = e.ruta[0]; if (!n) return true;
    const dx = n.x + .5 - e.x, dy = n.y + .5 - e.y, d = Math.hypot(dx, dy), s = v * dt;
    if (d <= s) { e.x = n.x + .5; e.y = n.y + .5; e.ruta.shift(); } else { e.x += dx / d * s; e.y += dy / d * s; }
    e.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 3 : 2) : (dy > 0 ? 1 : 0);
    return e.ruta.length === 0;
  }
  _cerca(e, x, y, r = 1.45) { return Math.hypot(e.x - x - .5, e.y - y - .5) <= r; }

  // ---- ciclo de simulación (paso fijo; el dt se limita para no saltar tras una pestaña suspendida) ----
  tick(dt, inp = { x: 0, y: 0 }) {
    dt = Math.min(dt, .1); this.t += dt; this._sistema(dt);
    const l = Math.hypot(inp.x, inp.y);
    if (l > .1) {
      const s = 4.6 * dt / Math.max(1, l);
      this.mover(this.p, inp.x * s, inp.y * s);
      this.p.dir = Math.abs(inp.x) > Math.abs(inp.y) ? (inp.x > 0 ? 3 : 2) : (inp.y > 0 ? 1 : 0); this.p.mov = true;
    } else this.p.mov = false;
    this.spawn -= dt;
    if (this.spawn <= 0) { this.spawn = this.cfg.clientes.cada * (1.3 - this.d.rep / 20) * this.ef.spawn / Math.min(2, Math.max(.5, this.mercado.dem)); this._spawn(); }
    for (const c of this.clientes) {
      if (c.st === 'ir') { if (this.seguir(c, dt, 2.6)) { c.st = 'pide'; c.dir = 1; } }
      else if (c.st === 'pide' || c.st === 'espera') { c.pac -= dt; if (c.pac <= 0) this._enojo(c); }
      else if (c.st === 'come') { c.tc -= dt; if (c.tc <= 0) this._pagar(c); }
      else if (c.st === 'sale' && this.seguir(c, dt, 2.6)) c.fin = true;
    }
    this.clientes = this.clientes.filter(c => !c.fin);
    for (const e of this.est) {
      if (!e.tk) continue; const t = this.tk(e.tk);
      if (!t) { e.tk = null; continue; }
      if (t.estado === 'cocinando') { e.t -= dt; if (e.t <= 0) t.estado = 'listo'; }
    }
    for (const e of this.emps) this._emp(e, dt);
  }
  _spawn() {
    const libres = this.asientos().filter(s => !this.clientes.some(c => c.st !== 'sale' && c.seat.x === s.x && c.seat.y === s.y));
    if (!libres.length || !this.puerta) return;
    const s = libres[Math.floor(this.rnd() * libres.length)], ruta = this.ruta(this.puerta.x, this.puerta.y, [s]);
    if (!ruta) return;
    const ps = this.cfg.platos.filter(p => p.nivel <= this.nivel), pl = ps[Math.floor(this.rnd() * ps.length)];
    this.clientes.push({ id: this.nid++, x: this.puerta.x + .5, y: this.puerta.y + .5, dir: 0, ruta, seat: s, st: 'ir', pac: this.cfg.clientes.paciencia * this.ef.paciencia, max: this.cfg.clientes.paciencia * this.ef.paciencia, plato: pl.id, tk: null, tc: 0, look: Math.floor(this.rnd() * 4) });
  }
  _salir(c) { c.st = 'sale'; c.ruta = this.ruta(Math.floor(c.x), Math.floor(c.y), [this.puerta]) || []; if (!c.ruta.length) c.fin = true; }
  _anular(c) {
    if (!c.tk) return;
    this.tickets = this.tickets.filter(t => t.id !== c.tk);
    for (const e of this.est) if (e.tk === c.tk) e.tk = null;
    if (this.llevando === c.tk) this.llevando = null;
    c.tk = null;
  }
  _enojo(c) { this.d.rep = Math.max(0, this.d.rep - .5); this.d.st.perdidos++; this.d.st.racha = 0; this._anular(c); this._salir(c); }
  _pagar(c) { const p = this.plato(c.plato), st = this.d.st; this.cuentas.push({ id: c.id, monto: Math.round(p.precio * this.ef.precio), xp: Math.round(p.xp * this.ef.xp) }); st.servidos++; st.racha++; st.mejor = Math.max(st.mejor, st.racha); this._anular(c); this._salir(c); }
  _entregar(c, t) { t.estado = 'entregado'; t.res = null; c.st = 'come'; c.tc = this.cfg.clientes.come; if (this.llevando === t.id) this.llevando = null; return { msg: 'Servido', fx: 'ok' }; }
  _cocinar(e, t, f = 1) { this.d.stock -= 1; e.tk = t.id; e.t = this.plato(t.plato).t * f * this.ef.cocina; e.res = null; t.estado = 'cocinando'; t.res = null; }
  _cobrar() {
    const lst = this.cuentas; this.cuentas = []; let m = 0, x = 0; const n0 = this.nivel;
    for (const c of lst) { m += c.monto; x += c.xp; }
    this.d.dinero += m; this.d.xp += x; this.d.rep = Math.min(10, this.d.rep + Math.max(.02, .1 + this.ef.repServ + (this.prov.cal - 1) * .5) * lst.length); this._log('cobro', m);
    return { msg: `+$${m}` + (this.nivel > n0 ? ` · ¡Nivel ${this.nivel}!` : ''), fx: 'moneda' };
  }

  // ---- acciones del jugador: _opcion decide qué hace E; accion la ejecuta (la pista del HUD usa la misma lógica) ----
  _opcion() {
    const p = this.p, cerca = o => this._cerca(p, o.x, o.y);
    if (this.llevando) {
      const t = this.tk(this.llevando), c = t && this.clientes.find(c => c.id === t.c && c.st === 'espera' && this._cerca(p, c.seat.x, c.seat.y));
      if (c) return { msg: 'Servir', run: () => this._entregar(c, t) };
    }
    const c = this.clientes.find(c => c.st === 'pide' && this._cerca(p, c.seat.x, c.seat.y));
    if (c) return { msg: 'Tomar pedido', run: () => { const t = { id: this.nid++, c: c.id, plato: c.plato, estado: 'cola', res: null }; this.tickets.push(t); c.tk = t.id; c.st = 'espera'; return { msg: 'Pedido: ' + this.plato(c.plato).n }; } };
    const e = this.est.find(cerca);
    if (e) {
      const t = e.tk && this.tk(e.tk);
      if (t && t.estado === 'listo') {
        if (this.llevando) return { msg: 'Ya llevas un plato' };
        if (t.res) return { msg: 'Un ayudante lo recogerá' };
        return { msg: 'Tomar plato', run: () => { e.tk = null; t.estado = 'llevado'; t.res = 'jugador'; this.llevando = t.id; return { msg: 'Llévalo al cliente' }; } };
      }
      if (!e.tk && !e.res) {
        const n = this.tickets.find(t => t.estado === 'cola' && !t.res);
        if (!n) return { msg: 'No hay pedidos en cola' };
        if (this.d.stock < 1) return { msg: 'Sin stock: surte en el refri' };
        return { msg: 'Preparar', run: () => { this._cocinar(e, n); return { msg: 'Preparando…' }; } };
      }
      return { msg: t && t.estado === 'cocinando' ? 'En preparación…' : 'Estación ocupada' };
    }
    if (this.cajas.some(cerca)) { const s = this.cuentas.reduce((a, c) => a + c.monto, 0); return s ? { msg: 'Cobrar $' + s, run: () => this._cobrar() } : { msg: 'Caja: nada por cobrar' }; }
    if (this.refris.some(cerca)) {
      const costo = this.costoSurtir();
      if (this.d.stock + 5 > this.cfg.maxStock) return { msg: 'Almacén lleno' };
      if (this.d.dinero < costo) return { msg: `Surtir cuesta $${costo}` };
      return { msg: `Surtir +5 ($${costo})`, run: () => { this.d.dinero -= costo; this.d.stock += 5; this._log('surtir', -costo); return { msg: '+5 ingredientes' }; } };
    }
    if (this.tableros.some(cerca)) return { msg: 'Mejoras', run: () => ({ tienda: true }) };
    return null;
  }
  pista() { const o = this._opcion(); return o ? o.msg : ''; }
  accion() { const o = this._opcion(); if (!o) return { msg: '' }; return o.run ? o.run() : { msg: o.msg }; }

  // ---- mejoras ----
  _aplicar(m) {
    if (m.efecto === 'mesa') {
      let ix = -1, iy = -1;
      outer: for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) if (this.g[y][x] === 'x') { ix = x; iy = y; break outer; }
      if (ix < 0) return false;
      this.g[iy][ix] = 't';
      for (const [dx, dy] of D4) if (this.g[iy + dy] && this.g[iy + dy][ix + dx] === 'y') this.g[iy + dy][ix + dx] = 'c';
      this.ver++; return true;
    }
    if (m.efecto === 'empleado') {
      if (this.emps.length >= this.cfg.maxEmp || !this.puerta) return false;
      this.emps.push({ id: this.nid++, x: this.puerta.x + .5, y: this.puerta.y - .5, dir: 1, ruta: [], tarea: null, lleva: null, mid: m.id, ...this._perfilEmp(m.id) }); return true;
    }
    return false;
  }
  comprar(id) {
    const m = this.cfg.mejoras.find(m => m.id === id);
    if (!m) return { ok: false, msg: 'Mejora inválida' };
    if (this.d.comp.includes(id)) return { ok: false, msg: 'Ya la tienes' };
    if (this.nivel < m.nivel) return { ok: false, msg: `Requiere nivel ${m.nivel}` };
    if (this.d.dinero < m.costo) return { ok: false, msg: 'Dinero insuficiente' };
    if (!this._aplicar(m)) return { ok: false, msg: 'No hay espacio disponible' };
    this.d.dinero -= m.costo; this.d.comp.push(id); this._log('mejora:' + id, -m.costo);
    return { ok: true, msg: m.n + ' comprado' };
  }

  // ---- empleados (máquina de estados con reservas para no duplicar trabajo ni quedarse atascados) ----
  _emp(e, dt) {
    if (e.lleva && !this.tk(e.lleva)) e.lleva = null;
    if (!e.tarea) { this._plan(e); if (!e.tarea) return; }
    const T = e.tarea;
    if (this.t - T.t0 > 20 || !this._valida(e, T)) return this._abort(e);
    if (this._cerca(e, T.x, T.y)) return this._act(e, T);
    if (this.seguir(e, dt, 2.4 + .1 * (e.hab || 2))) this._act(e, T);
  }
  _ir(e, T, metas) {
    const r = this.ruta(Math.floor(e.x), Math.floor(e.y), metas);
    if (!r) return this._liberar(e, T);
    e.ruta = r; T.t0 = this.t; e.tarea = T;
  }
  _plan(e) {
    if (e.lleva) {
      const t = this.tk(e.lleva), c = this.clientes.find(c => c.id === t.c && c.st === 'espera');
      if (!c) { e.lleva = null; return; }
      return this._ir(e, { k: 'entregar', x: c.seat.x, y: c.seat.y, cid: c.id }, this.vecinos(c.seat.x, c.seat.y));
    }
    const l = this.tickets.find(t => t.estado === 'listo' && !t.res), s0 = l && this.est.find(s => s.tk === l.id);
    if (l && s0) { l.res = e.id; return this._ir(e, { k: 'recoger', x: s0.x, y: s0.y, tk: l.id }, this.vecinos(s0.x, s0.y)); }
    const t = this.tickets.find(t => t.estado === 'cola' && !t.res), s = this.est.find(s => !s.tk && !s.res);
    if (t && s && this.d.stock > 0) { t.res = e.id; s.res = e.id; return this._ir(e, { k: 'cocinar', x: s.x, y: s.y, tk: t.id }, this.vecinos(s.x, s.y)); }
  }
  _liberar(e, T) {
    const t = T.tk && this.tk(T.tk); if (t && t.res === e.id) t.res = null;
    for (const s of this.est) if (s.res === e.id) s.res = null;
  }
  _abort(e) { if (e.tarea) this._liberar(e, e.tarea); e.tarea = null; e.ruta = []; }
  _valida(e, T) {
    const t = T.tk && this.tk(T.tk);
    if (T.k === 'recoger') return !!t && t.res === e.id;
    if (T.k === 'cocinar') return !!t && t.estado === 'cola' && t.res === e.id && this.d.stock > 0;
    const c = this.clientes.find(c => c.id === T.cid);
    return !!c && c.st === 'espera' && !!e.lleva;
  }
  _act(e, T) {
    if (!this._cerca(e, T.x, T.y)) return this._abort(e);
    const t = T.tk && this.tk(T.tk);
    if (T.k === 'recoger') {
      const s = this.est.find(s => s.tk === T.tk);
      if (s && t.estado === 'listo') { s.tk = null; t.estado = 'llevado'; e.lleva = t.id; } else return this._abort(e);
    } else if (T.k === 'cocinar') {
      this._cocinar(this.est.find(s => s.res === e.id), t, this._fEmp(e));
    } else {
      const c = this.clientes.find(c => c.id === T.cid);
      this._entregar(c, this.tk(e.lleva)); e.lleva = null;
    }
    e.tarea = null; e.ruta = []; this._exp(e);
  }

  // ---- Fase 2: mercado, personal, proveedores y ramas del local ----
  _aviso(t) { this.avisos.push(t); if (this.avisos.length > 20) this.avisos.shift(); }
  _perfilEmp(mid) {                     // atributos de un empleado nuevo: deterministas (no tocan this.rnd)
    const k = [...mid].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7), hab = Math.min(5, Math.max(1, 1 + Math.floor(azar(k, this.nid, Math.floor(this.d.xp)) * 3) + this.ef.hab));
    return { n: NOMBRES_EMP[Math.floor(azar(k, this.nid, 9) * NOMBRES_EMP.length)], hab, exp: 0, sat: 70, sueldo: espera(hab), ger: false };
  }
  _fEmp(e) { return Math.max(.9, 1.7 - .12 * (e.hab || 2)) * ((e.sat ?? 70) < 40 ? 1.25 : 1); }   // factor de tiempo al cocinar (menos es más rápido)
  _exp(e) { const U = [0, 20, 50, 100, 180]; e.exp = (e.exp || 0) + 1; if (e.hab < 5 && e.exp >= U[e.hab]) { e.hab++; this._aviso(`${e.n} mejoró su habilidad (ahora espera $${espera(e.hab)}/min)`); } }
  _sistema(dt) {
    const st = this.d.st; st.tiempo += dt; st.semana += dt; this._min += dt; this._seg += dt;
    if (st.semana >= SEMANA_S) { st.semana = 0; st.semanas++; this._aviso('¡Completaste una semana sin apuros!'); }
    if (this._min >= 60) { this._min -= 60; this._nomina(); }
    if (this._seg >= 1) {
      this._seg -= 1;
      if (this.d.stock < 1 && this.d.dinero < this.costoSurtir() && !this.cuentas.length && !this.tickets.some(t => t.estado === 'cola' || t.estado === 'cocinando' || t.estado === 'listo') && this.t - this._apuro > 30) {
        this._apuro = this.t; st.apuros++; st.semana = 0; this._aviso('Apuro: sin efectivo ni ingredientes. La semana vuelve a empezar.');
      }
    }
    const g = this.gerente;
    if (g) {                           // el gerente toma pedidos y cobra por ti (en abstracto: no camina)
      for (const c of this.clientes) if (c.st === 'pide' && c.max - c.pac > 2.5) { const t = { id: this.nid++, c: c.id, plato: c.plato, estado: 'cola', res: null }; this.tickets.push(t); c.tk = t.id; c.st = 'espera'; }
      if (this.cuentas.length && this.t - this._tc > 6) { this._tc = this.t; this._cobrar(); }
    }
  }
  _nomina() {
    const gasto = Math.round(this.ef.gasto); if (gasto > 0 && this.d.dinero >= gasto) { this.d.dinero -= gasto; this._log('gasto', -gasto); }
    for (const e of [...this.emps]) {
      const pago = Math.round(e.sueldo * this.ef.sueldos), justo = e.sueldo >= espera(e.hab) * (e.ger ? 1.6 : 1);
      if (this.d.dinero >= pago) { this.d.dinero -= pago; this._log('nomina', -pago); e.sat = Math.min(100, e.sat + (justo ? 3 : -4)); } else e.sat -= 15;
      if (e.sat <= 0) { this._baja(e); this._aviso(`${e.n} renunció (${pago > this.d.dinero ? 'no le pagaste' : 'sueldo injusto'}). Puedes contratar a otro.`); }
    }
  }
  _baja(e) { this._abort(e); this.emps = this.emps.filter(x => x !== e); this.d.comp = this.d.comp.filter(id => id !== e.mid); this.ver++; }
  _emp1(id) { return this.emps.find(e => e.id === id) || null; }
  subirSueldo(id) {
    const e = this._emp1(id); if (!e) return { ok: false, msg: 'Empleado inexistente' }; const tope = Math.round(espera(e.hab) * (e.ger ? 1.6 : 1) * 1.3);
    if (e.sueldo >= tope) return { ok: false, msg: 'Ya gana lo máximo razonable' }; e.sueldo = Math.min(tope, e.sueldo + 2); e.sat = Math.min(100, e.sat + 5); return { ok: true, msg: `${e.n} gana $${e.sueldo}/min` };
  }
  capacitar(id) {
    const e = this._emp1(id); if (!e) return { ok: false, msg: 'Empleado inexistente' }; if (e.hab >= 5) return { ok: false, msg: 'Ya es experto' };
    const c = 50 * e.hab; if (this.d.dinero < c) return { ok: false, msg: `Capacitar cuesta $${c}` };
    this.d.dinero -= c; this._log('capacitar', -c); e.hab++; return { ok: true, msg: `${e.n} subió a habilidad ${e.hab}. Ahora espera $${espera(e.hab)}/min: súbele el sueldo para que no se moleste.` };
  }
  ascender(id) {
    const e = this._emp1(id); if (!e) return { ok: false, msg: 'Empleado inexistente' }; if (this.gerente) return { ok: false, msg: 'Ya tienes un gerente' };
    if (e.hab < 3) return { ok: false, msg: 'Necesita habilidad 3 para ser gerente' }; if (this.d.dinero < 100) return { ok: false, msg: 'El ascenso cuesta $100' };
    this.d.dinero -= 100; this._log('ascenso', -100); e.ger = true; e.sueldo = Math.round(espera(e.hab) * 1.6); return { ok: true, msg: `${e.n} es el gerente: toma pedidos y cobra por ti. Gana $${e.sueldo}/min.` };
  }
  despedir(id) { const e = this._emp1(id); if (!e) return { ok: false, msg: 'Empleado inexistente' }; this._baja(e); return { ok: true, msg: `${e.n} dejó el equipo` }; }
  cambiarProv(id) {
    if (!existe(PROVEEDORES, id)) return { ok: false, msg: 'Proveedor inexistente' }; this.d.prov = id; return { ok: true, msg: `Compras con ${PROVEEDORES[id].n}` };
  }
  comprarRama(id) {
    const n = nodo(id); if (!n || n.donde !== 'local') return { ok: false, msg: 'Mejora inexistente' }; const e = puedeNodo(this.d.ramas, id); if (e) return { ok: false, msg: e };
    if (this.nivel < n.nivel) return { ok: false, msg: `Requiere nivel ${n.nivel}` }; if (this.d.dinero < n.costo) return { ok: false, msg: `Cuesta $${n.costo}` };
    this.d.dinero -= n.costo; this._log('rama:' + id, -n.costo); this.d.ramas.push(id); this.ef = efectos(this.d.ramas);
    if (n.ef.hab) for (const x of this.emps) x.hab = Math.min(5, x.hab + n.ef.hab);
    return { ok: true, msg: `${n.n}: ${n.pro}` };
  }
}
