// Lógica de sala AUTORITATIVA y pura (sin red ni DOM): sirve igual en el navegador, en Node o dentro de un Durable Object.
const hex = n => { const a = new Uint8Array(n); crypto.getRandomValues(a); return [...a].map(b => b.toString(16).padStart(2, '0')).join(''); };
export const limpiarNombre = n => String(n ?? '').normalize('NFKC').replace(/[^A-Za-z0-9_ ]/g, '').slice(0, 16).trim() || 'Invitado';
const MODOS = ['interior', 'ciudad'];
const ent = (v, a, b) => (Number.isInteger(v) && v >= a && v <= b ? v : 0);

export class Sala {
  constructor({ giro, hostCid, nombreHost, cap = 4, ahora = Date.now, rnd = hex }) {
    Object.assign(this, { giro, hostCid, cap, ahora, rnd, abierta: true });
    this.id = rnd(6); this.inv = new Map(); this.miembros = new Map(); this._alta(hostCid, nombreHost);
  }
  _alta(cid, nombre) {
    const base = limpiarNombre(nombre), usados = new Set([...this.miembros.values()].map(m => m.nombre.toLowerCase()));
    let n = base, i = 2; while (usados.has(n.toLowerCase())) n = base.slice(0, 13) + '_' + i++;
    const m = { cid, nombre: n, x: 0, y: 0, dir: 1, modo: 'interior', look: {}, seq: 0, t: 0, cred: 20 }; this.miembros.set(cid, m); return m;
  }
  invitar({ ttlMs = 600000, usos = 3 } = {}) { const t = this.rnd(16); this.inv.set(t, { exp: this.ahora() + ttlMs, usos }); return t; }
  revocar(t) { return this.inv.delete(t); }
  cerrar() { this.abierta = false; this.inv.clear(); this.miembros.clear(); }
  unir(token, cid, nombre) {
    if (!this.abierta) return { ok: false, msg: 'La sala está cerrada' };
    if (this.miembros.has(cid)) return { ok: true, miembro: this.miembros.get(cid) };            // reintento idempotente
    const i = this.inv.get(token);
    if (!i) return { ok: false, msg: 'Invitación inválida o revocada' };
    if (this.ahora() > i.exp) { this.inv.delete(token); return { ok: false, msg: 'La invitación expiró' }; }
    if (this.miembros.size >= this.cap) return { ok: false, msg: 'La sala está llena' };
    if (--i.usos <= 0) this.inv.delete(token);
    return { ok: true, miembro: this._alta(cid, nombre) };
  }
  salir(cid) { if (cid === this.hostCid) this.cerrar(); else this.miembros.delete(cid); }
  // Valida una intención de movimiento: secuencia creciente, límite de tasa, velocidad física y datos acotados.
  mover(cid, m) {
    const p = this.miembros.get(cid), ahora = this.ahora(); if (!p || !m) return false;
    if (!Number.isInteger(m.seq) || m.seq <= p.seq) return false;
    p.cred = Math.min(20, p.cred + (ahora - p.t) / 50); if (p.cred < 1) return false; p.cred -= 1;   // ~20 mensajes/s
    if (!Number.isFinite(m.x) || !Number.isFinite(m.y) || Math.abs(m.x) > 1e6 || Math.abs(m.y) > 1e6 || !MODOS.includes(m.modo)) return false;
    const dt = Math.max(.05, (ahora - p.t) / 1000);
    if (p.t && m.modo === p.modo && Math.hypot(m.x - p.x, m.y - p.y) > 6 * dt + 1) return false;       // 4.6 casillas/s + tolerancia
    const k = m.look || {};
    Object.assign(p, { x: m.x, y: m.y, dir: ent(m.dir, 0, 3), modo: m.modo, seq: m.seq, t: ahora, look: { piel: ent(k.piel, 0, 9), pelo: ent(k.pelo, 0, 9), ropa: ent(k.ropa, 0, 9), gorro: ent(k.gorro, 0, 9) } });
    return true;
  }
  snapshot() { return [...this.miembros.values()].map(({ cid, nombre, x, y, dir, modo, look }) => ({ cid, nombre, x, y, dir, modo, look })); }
}
