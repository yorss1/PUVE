// Servidor de sala NEUTRAL A LA RED: recibe mensajes (objetos) y devuelve salidas [{ para: cid|'*', msg }].
// Lo usan: el servidor Node (herramientas/servidor_nodo.mjs), la pestaña anfitriona (transporte local), el modo solo y el boceto de Durable Object.
import { Sala } from './sala.js';
import { Mundo } from './mundo.js';
const GIROS = ['restaurante', 'cafeteria'];
export class Servidor {
  constructor({ ahora = Date.now, rnd, rivales = 0, estricto = true } = {}) { this.ahora = ahora; this.rnd = rnd; this.nRivales = Math.max(0, Math.min(8, Math.floor(rivales) || 0)); this.sala = null; this.mundo = new Mundo({ ahora, estricto }); this.enviado = new Map(); this.token = null;
    this.chat = []; this.chatOn = true; this.silenciados = new Set(); this.chatT = new Map(); this.nchat = 1; }
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
        if (Number.isFinite(m.rivales)) this.nRivales = Math.max(0, Math.min(4, Math.floor(m.rivales)));
        this.mundo.alta(cid, this.sala.miembros.get(cid).nombre); this.mundo.giro = m.giro; this.mundo.sembrar(this.nRivales); this.token = this.sala.invitar();
        return this._a(cid, { t: 'creada', id: this.sala.id, token: this.token, giro: m.giro });
      }
      case 'unir': {
        if (!s) return this._a(cid, { t: 'resp', ok: false, msg: 'La sala no existe' });
        const r = s.unir(String(m.token ?? ''), cid, m.nombre);
        if (r.ok && !this.mundo.alta(cid, r.miembro.nombre)) { s.salir(cid); return this._a(cid, { t: 'resp', ok: false, msg: 'No hay lotes disponibles' }); }
        return [{ para: cid, msg: { t: 'resp', ok: r.ok, msg: r.msg, giro: s.giro, id: s.id } }, ...(r.ok ? [{ para: cid, msg: { t: 'chat_hist', msgs: this.chat.slice(-30), activo: this.chatOn } }] : [])];
      }
      case 'mover': if (s) s.mover(cid, m); return [];
      case 'eco': { if (!s || !s.miembros.has(cid)) return []; const r = this.mundo.op(cid, m); return this._a(cid, { t: 'res', id: m.id, ...r }); }
      case 'invitar': {
        if (!host) return this._a(cid, { t: 'resp', ok: false, msg: 'Solo el anfitrión invita' });
        if (this.token) s.revocar(this.token);
        this.token = s.invitar({ ttlMs: 600000, usos: 3 }); return this._a(cid, { t: 'creada', id: s.id, token: this.token, giro: s.giro });
      }
      case 'chat': {                                // chat de sala: texto plano, con límite de ritmo; el anfitrión puede silenciar o apagarlo
        if (!s || !s.abierta || !s.miembros.has(cid)) return []; if (!this.chatOn) return this._a(cid, { t: 'chat_err', msg: 'El anfitrión desactivó el chat' }); if (this.silenciados.has(cid)) return this._a(cid, { t: 'chat_err', msg: 'Estás silenciado' });
        const txt = typeof m.txt === 'string' ? m.txt.replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200) : ''; if (!txt) return [];
        const t = this.ahora(), u = this.chatT.get(cid) || 0; if (t - u < 1200) return this._a(cid, { t: 'chat_err', msg: 'Más despacio' }); this.chatT.set(cid, t);
        const msg = { id: this.nchat++, de: cid, nombre: s.miembros.get(cid).nombre, txt, ts: t }; this.chat.push(msg); if (this.chat.length > 60) this.chat.shift(); return [{ para: '*', msg: { t: 'chat', m: msg } }];
      }
      case 'chat_config': {
        if (!host) return this._a(cid, { t: 'aviso', ok: false, msg: 'Solo el anfitrión modera el chat' });
        if (typeof m.activo === 'boolean') this.chatOn = m.activo; if (typeof m.silenciar === 'string' && s.miembros.has(m.silenciar) && m.silenciar !== cid) this.silenciados.add(m.silenciar); if (typeof m.quitar === 'string') this.silenciados.delete(m.quitar);
        return [{ para: '*', msg: { t: 'chat_cfg', activo: this.chatOn, silenciados: [...this.silenciados] } }];
      }
      case 'rivales': {                             // el anfitrión decide cuántos rivales controlados por la computadora hay (0–4)
        if (!host) return this._a(cid, { t: 'aviso', ok: false, msg: 'Solo el anfitrión cambia los rivales' }); if (!Number.isFinite(m.n)) return this._a(cid, { t: 'aviso', ok: false, msg: 'Número inválido' });
        this.nRivales = Math.max(0, Math.min(4, Math.floor(m.n))); const hay = this.mundo.ajustarRivales(this.nRivales); return this._a(cid, { t: 'aviso', ok: true, msg: hay ? `Ahora hay ${hay} rival${hay > 1 ? 'es' : ''}` : 'Sin rivales' });
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
  exportar() { const s = this.sala; return s ? { id: s.id, giro: s.giro, hostCid: s.hostCid, miembros: [...s.miembros.values()].map(m => ({ cid: m.cid, nombre: m.nombre, look: m.look })), token: this.token, ts: this.ahora(), rivales: this.nRivales, chat: { msgs: this.chat.slice(-40), on: this.chatOn, mud: [...this.silenciados], n: this.nchat }, mundo: this.mundo.serializar() } : null; }
  importar(d) {
    if (!d || !/^[0-9a-f]{12}$/.test(d.id) || !GIROS.includes(d.giro) || typeof d.hostCid !== 'string') return false;
    const s = new Sala({ giro: d.giro, hostCid: d.hostCid, nombreHost: 'x', ahora: this.ahora, rnd: this.rnd }); s.id = d.id; s.miembros.clear();
    for (const m of d.miembros || []) if (typeof m.cid === 'string') { s._alta(m.cid, m.nombre); s.miembros.get(m.cid).look = m.look && typeof m.look === 'object' ? m.look : {}; }
    if (!s.miembros.has(d.hostCid)) return false;
    this.sala = s; if (typeof d.token === 'string') { s.inv.set(d.token, { exp: this.ahora() + 600000, usos: 3 }); this.token = d.token; }
    if (!this.mundo.restaurar(d.mundo)) return false;
    if (d.chat && typeof d.chat === 'object') { this.chat = (Array.isArray(d.chat.msgs) ? d.chat.msgs : []).filter(x => x && typeof x.txt === 'string' && typeof x.de === 'string').slice(-40).map(x => ({ id: Number(x.id) || 0, de: x.de.slice(0, 40), nombre: String(x.nombre).slice(0, 16), txt: x.txt.slice(0, 200), ts: Number(x.ts) || 0 })); this.chatOn = d.chat.on !== false; this.silenciados = new Set((Array.isArray(d.chat.mud) ? d.chat.mud : []).filter(x => typeof x === 'string').slice(0, 8)); this.nchat = Math.max(1, Number(d.chat.n) || 1); }
    this.mundo.giro = d.giro; if (Number.isFinite(d.rivales)) this.nRivales = Math.max(0, Math.min(8, Math.floor(d.rivales)));
    else if (this.nRivales > 0) this.mundo.sembrar(this.nRivales);   // mundo guardado antes de existir los rivales: se incorporan una sola vez
    if (Number.isFinite(d.ts) && this.ahora() - d.ts > 0) this.mundo.ausencia(this.ahora() - d.ts);   // tiempo fuera: se simula con límites y se deja un informe
    return true;
  }
}
