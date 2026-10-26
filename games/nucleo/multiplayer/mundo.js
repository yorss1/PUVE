// Economía compartida AUTORITATIVA (pura, sin red): lotes, franquicias, competencia, turnos, quiebra. La valida el servidor, no el cliente.
import { lotes, loteDe, trafico, distLotes, LOTE_INICIAL } from '../world/ciudad.js';
export const TURNO_MS = 10000, MAX_TURNOS = 30, MAX_FRANQ = 6, RADIO = 40, CUPO_MAX = 1500, MEJORA_MAX = 5;
const COLORES = ['#d9822b', '#2f6b5f', '#b8402f', '#8a6bb0', '#4a7fb0', '#d9b38c'];
export const precioLote = l => 300 + 120 * trafico(l);
export const costoMejora = (l, nivel) => Math.round(precioLote(l) * .5 * nivel);
export const valorVenta = (l, o) => Math.round(.7 * (precioLote(l) + o.invertido));
const atractivo = o => (o.tipo === 'hogar' ? 1.25 : 1 + .35 * (o.nivel - 1));
const fail = msg => ({ ok: false, msg });

export class Mundo {
  constructor({ seed = 7, ahora = Date.now } = {}) { Object.assign(this, { seed, ahora }); this.j = new Map(); this.o = new Map(); this.v = 0; this.turno = 0; this.t0 = ahora(); }
  _ev(p, t) { p.eventos.push(t); if (p.eventos.length > 20) p.eventos.shift(); }
  _franq(cid) { let n = 0; for (const o of this.o.values()) if (o.dueno === cid && o.tipo === 'franquicia') n++; return n; }
  _cupo(p) { const t = this.ahora(); p.cupo = Math.min(CUPO_MAX, p.cupo + Math.max(0, t - p.cupoT) / 1000 * (12 + 4 * this._franq(p.cid))); p.cupoT = t; }
  alta(cid, nombre) {
    if (this.j.has(cid)) return this.j.get(cid);
    let hogar = null;
    const libre = l => l && !this.o.has(l.id);
    if (libre(loteDe(this.seed, LOTE_INICIAL))) hogar = loteDe(this.seed, LOTE_INICIAL);
    for (let r = 0; r <= 4 && !hogar; r++) for (let cy = -r; cy <= r && !hogar; cy++) for (let cx = -r; cx <= r && !hogar; cx++)
      if (Math.max(Math.abs(cx), Math.abs(cy)) === r) hogar = lotes(this.seed, cx, cy).find(libre) || null;
    if (!hogar) return null;
    const p = { cid, nombre, color: COLORES[this.j.size % COLORES.length], dinero: 0, cupo: CUPO_MAX, cupoT: this.ahora(), hogar: hogar.id, eventos: [], ingresos: {}, vistos: new Map() };
    this.j.set(cid, p); this.o.set(hogar.id, { dueno: cid, nivel: 1, tipo: 'hogar', invertido: 0 }); this.v++; return p;
  }
  op(cid, m) {                                  // intención del cliente: idempotente por id, validada y atómica
    const p = this.j.get(cid); if (!p || !m) return fail('Jugador desconocido');
    const id = String(m.id ?? ''); if (!id || id.length > 40) return fail('Operación inválida');
    if (p.vistos.has(id)) return p.vistos.get(id);
    this.avanzar();
    const r = this._exec(p, m); p.vistos.set(id, r); if (p.vistos.size > 200) p.vistos.delete(p.vistos.keys().next().value);
    if (r.ok) this.v++; return r;
  }
  _exec(p, m) {
    if (m.op === 'invertir') {
      this._cupo(p); const x = m.monto;
      if (!Number.isSafeInteger(x) || x <= 0) return fail('Monto inválido');
      if (x > p.cupo) return { ok: false, msg: `Por ahora solo puedes invertir $${Math.floor(p.cupo)}`, max: Math.floor(p.cupo) };
      p.cupo -= x; p.dinero += x; return { ok: true, msg: `Invertiste $${x}`, monto: x };
    }
    const l = typeof m.lote === 'string' ? loteDe(this.seed, m.lote) : null; if (!l) return fail('Lote inexistente');
    const o = this.o.get(l.id), pr = precioLote(l);
    if (m.op === 'comprar') {
      if (o) return fail('Ese lote ya tiene dueño'); if (this._franq(p.cid) >= MAX_FRANQ) return fail(`Máximo ${MAX_FRANQ} franquicias`);
      if (p.dinero < pr) return fail(`Necesitas $${pr} en tu cuenta de franquicias`);
      p.dinero -= pr; this.o.set(l.id, { dueno: p.cid, nivel: 1, tipo: 'franquicia', invertido: 0 }); this._ev(p, `Abriste una franquicia en ${l.id}`); return { ok: true, msg: 'Franquicia abierta' };
    }
    if (!o || o.dueno !== p.cid || o.tipo !== 'franquicia') return fail('Esa franquicia no es tuya');
    if (m.op === 'mejorar') {
      if (o.nivel >= MEJORA_MAX) return fail('Ya está al máximo'); const c = costoMejora(l, o.nivel);
      if (p.dinero < c) return fail(`Necesitas $${c}`); p.dinero -= c; o.invertido += c; o.nivel++; return { ok: true, msg: `Mejorada al nivel ${o.nivel}` };
    }
    if (m.op === 'vender') { const g = valorVenta(l, o); p.dinero += g; this.o.delete(l.id); this._ev(p, `Vendiste ${l.id} por $${g}`); return { ok: true, msg: `Vendida por $${g}` }; }
    return fail('Operación desconocida');
  }
  avanzar() {                                   // turnos por reloj; si hubo una ausencia larga solo se aplican MAX_TURNOS (sin acumulación infinita)
    const t = this.ahora(), n = Math.min(MAX_TURNOS, Math.floor((t - this.t0) / TURNO_MS));
    for (let i = 0; i < n; i++) this._turno();
    this.t0 = t - this.t0 > MAX_TURNOS * TURNO_MS ? t : this.t0 + n * TURNO_MS;
  }
  _turno() {
    this.turno++; const todos = [...this.o].map(([id, o]) => ({ id, o, l: loteDe(this.seed, id) }));
    for (const b of todos) {
      if (b.o.tipo !== 'franquicia') continue; const p = this.j.get(b.o.dueno); if (!p) continue;
      let suma = 0; for (const c of todos) if (distLotes(b.l, c.l) <= RADIO) suma += atractivo(c.o);
      const ing = Math.round(trafico(b.l) * 16 * (atractivo(b.o) / suma) * (1 + .5 * (b.o.nivel - 1))), mant = Math.round(precioLote(b.l) * .01);
      if (p.dinero + ing < mant) { this.o.delete(b.id); delete p.ingresos[b.id]; this._ev(p, `Quiebra: se cerró la franquicia ${b.id}`); continue; }
      p.dinero += ing - mant; p.ingresos[b.id] = ing - mant;
    }
    this.v++;
  }
  patrimonio(p) { let s = p.dinero; for (const [id, o] of this.o) if (o.dueno === p.cid && o.tipo === 'franquicia') s += valorVenta(loteDe(this.seed, id), o); return s; }
  vista(cid) {                                  // lo que ve cada jugador: todos ven propiedades y patrimonio; solo tú ves tu efectivo y cupo
    const p = this.j.get(cid); if (p) this._cupo(p);
    return { v: this.v, turno: this.turno, msTurno: Math.max(0, TURNO_MS - (this.ahora() - this.t0)),
      jugadores: [...this.j.values()].map(q => ({ cid: q.cid, nombre: q.nombre, color: q.color, patrimonio: this.patrimonio(q), franq: this._franq(q.cid) })).sort((a, b) => b.patrimonio - a.patrimonio),
      lotes: [...this.o].map(([id, o]) => [id, o.dueno, o.nivel, o.tipo === 'hogar' ? 'h' : 'f', o.invertido]),
      mio: p ? { dinero: p.dinero, cupo: Math.floor(p.cupo), hogar: p.hogar, eventos: p.eventos.slice(-8), ingresos: p.ingresos } : null };
  }
  serializar() { return { seed: this.seed, v: this.v, turno: this.turno, dt: this.ahora() - this.t0, j: [...this.j.values()].map(({ vistos, ...p }) => p), o: [...this.o] }; }
  restaurar(d) {
    const n = (x, a, b, def) => (Number.isFinite(x) ? Math.min(b, Math.max(a, x)) : def);
    if (!d || d.seed !== this.seed) return false;
    this.v = n(d.v, 0, 1e12, 0); this.turno = n(d.turno, 0, 1e9, 0); this.t0 = this.ahora() - n(d.dt, 0, 1e12, 0);
    for (const p of d.j || []) if (typeof p.cid === 'string' && loteDe(this.seed, p.hogar)) this.j.set(p.cid, { cid: p.cid, nombre: String(p.nombre).slice(0, 16), color: COLORES.includes(p.color) ? p.color : COLORES[0], dinero: Math.floor(n(p.dinero, 0, 1e12, 0)), cupo: n(p.cupo, 0, CUPO_MAX, CUPO_MAX), cupoT: this.ahora(), hogar: p.hogar, eventos: (p.eventos || []).slice(-20).map(String), ingresos: {}, vistos: new Map() });
    for (const [id, o] of d.o || []) if (loteDe(this.seed, id) && this.j.has(o.dueno)) this.o.set(id, { dueno: o.dueno, nivel: Math.floor(n(o.nivel, 1, MEJORA_MAX, 1)), tipo: o.tipo === 'hogar' ? 'hogar' : 'franquicia', invertido: Math.floor(n(o.invertido, 0, 1e9, 0)) });
    return true;
  }
}
