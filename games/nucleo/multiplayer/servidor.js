// Servidor de sala NEUTRAL A LA RED: recibe mensajes (objetos) y devuelve salidas [{ para: cid|'*', msg }].
// Lo usan: el servidor Node (herramientas/servidor_nodo.mjs), la pestaña anfitriona (transporte local), el modo solo y el boceto de Durable Object.
import { Sala } from './sala.js';
import { Mundo } from './mundo.js';
const GIROS = ['restaurante', 'cafeteria'];
export class Servidor {
  constructor({ ahora = Date.now, rnd, rivales = 0 } = {}) { this.ahora = ahora; this.rnd = rnd; this.nRivales = Math.max(0, Math.min(8, Math.floor(rivales) || 0)); this.sala = null; this.mundo = new Mundo({ ahora }); this.enviado = new Map(); this.token = null; }
  get id() { return this.sala?.id ?? null; }
  _a(cid, msg) { return [{ para: cid, msg }]; }
  manejar(cid, m) {
    if (!m || typeof m !== 'object' || typeof m.t !== 'string') return [];
    const s = this.sala, host = s && cid === s.hostCid;
    switch (m.t) {
      case 'crear': {
        if (s) return this._a(cid, { t: 'resp', ok: false, msg: 'La sala ya existe' });
        if (!GIROS.includes(m.giro)) return this._a(cid, { t: 'resp', ok: false, msg: 'Giro inválido' });
        this.sala = new Sala({ giro: m.giro, hostCid: cid, nombreHost: m.nombre, ahora: this.ahora, rnd: this.rnd });
        this.mundo.alta(cid, this.sala.miembros.get(cid).nombre); this.mundo.giro = m.giro; this.mundo.sembrar(this.nRivales); this.token = this.sala.invitar();
        return this._a(cid, { t: 'creada', id: this.sala.id, token: this.token, giro: m.giro });
      }
      case 'unir': {
        if (!s) return this._a(cid, { t: 'resp', ok: false, msg: 'La sala no existe' });
        const r = s.unir(String(m.token ?? ''), cid, m.nombre);
        if (r.ok && !this.mundo.alta(cid, r.miembro.nombre)) { s.salir(cid); return this._a(cid, { t: 'resp', ok: false, msg: 'No hay lotes disponibles' }); }
        return this._a(cid, { t: 'resp', ok: r.ok, msg: r.msg, giro: s.giro, id: s.id });
      }
      case 'mover': if (s) s.mover(cid, m); return [];
      case 'eco': { if (!s || !s.miembros.has(cid)) return []; const r = this.mundo.op(cid, m); return this._a(cid, { t: 'res', id: m.id, ...r }); }
      case 'invitar': {
        if (!host) return this._a(cid, { t: 'resp', ok: false, msg: 'Solo el anfitrión invita' });
        if (this.token) s.revocar(this.token);
        this.token = s.invitar({ ttlMs: 600000, usos: 3 }); return this._a(cid, { t: 'creada', id: s.id, token: this.token, giro: s.giro });
      }
      case 'salir': if (s && s.miembros.has(cid)) { if (host) { s.cerrar(); return [{ para: '*', msg: { t: 'cerrada' } }]; } s.salir(cid); } return [];
      default: return [];
    }
  }
  difundir() {                                   // llamado ~10 Hz por el transporte: presencia siempre; economía solo al cambiar o cada 3 s
    const s = this.sala; if (!s || !s.abierta) return [];
    this.mundo.avanzar(); const out = [{ para: '*', msg: { t: 'snap', snap: s.snapshot() } }], ahora = this.ahora();
    for (const cid of s.miembros.keys()) {
      const e = this.enviado.get(cid);
      if (!e || e.v !== this.mundo.v || ahora - e.t > 3000) { this.enviado.set(cid, { v: this.mundo.v, t: ahora }); out.push({ para: cid, msg: { t: 'mundo', ...this.mundo.vista(cid) } }); }
    }
    return out;
  }
  exportar() { const s = this.sala; return s ? { id: s.id, giro: s.giro, hostCid: s.hostCid, miembros: [...s.miembros.values()].map(m => ({ cid: m.cid, nombre: m.nombre, look: m.look })), token: this.token, ts: this.ahora(), rivales: this.nRivales, mundo: this.mundo.serializar() } : null; }
  importar(d) {
    if (!d || !/^[0-9a-f]{12}$/.test(d.id) || !GIROS.includes(d.giro) || typeof d.hostCid !== 'string') return false;
    const s = new Sala({ giro: d.giro, hostCid: d.hostCid, nombreHost: 'x', ahora: this.ahora, rnd: this.rnd }); s.id = d.id; s.miembros.clear();
    for (const m of d.miembros || []) if (typeof m.cid === 'string') { s._alta(m.cid, m.nombre); s.miembros.get(m.cid).look = m.look && typeof m.look === 'object' ? m.look : {}; }
    if (!s.miembros.has(d.hostCid)) return false;
    this.sala = s; if (typeof d.token === 'string') { s.inv.set(d.token, { exp: this.ahora() + 600000, usos: 3 }); this.token = d.token; }
    if (!this.mundo.restaurar(d.mundo)) return false;
    this.mundo.giro = d.giro; if (Number.isFinite(d.rivales)) this.nRivales = Math.max(0, Math.min(8, Math.floor(d.rivales)));
    else if (this.nRivales > 0) this.mundo.sembrar(this.nRivales);   // mundo guardado antes de existir los rivales: se incorporan una sola vez
    if (Number.isFinite(d.ts) && this.ahora() - d.ts > 0) this.mundo.ausencia(this.ahora() - d.ts);   // tiempo fuera: se simula con límites y se deja un informe
    return true;
  }
}
