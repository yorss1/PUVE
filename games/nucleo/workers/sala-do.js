// BOCETO NO PROBADO Y NO DESPLEGADO (alternativa a herramientas/servidor_nodo.mjs): una sala en un Durable Object de Cloudflare.
// Reutiliza multiplayer/servidor.js tal cual. Pendiente antes de usarlo: Worker que enrute /ws?sala=<id> con env.SALAS.idFromName(id) y genere el id al crear,
// pruebas con clientes reales, revisión de costos/límites de Durable Objects (la difusión a 10 Hz es cara: usar una frecuencia menor) y autorización del propietario.
import { Servidor } from '../multiplayer/servidor.js';
const sha = async t => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)))].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 12);
export class SalaDO {
  constructor(state) { this.state = state; this.srv = new Servidor(); this.conns = new Set(); state.blockConcurrencyWhile(async () => { const d = await state.storage.get('sala'); if (d) this.srv.importar(d); }); }
  async fetch(req) {
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('Se esperaba WebSocket', { status: 426 });
    const [cliente, ws] = Object.values(new WebSocketPair()); ws.accept(); const c = { ws, cid: null }; this.conns.add(c);
    ws.addEventListener('message', async ev => {
      if (typeof ev.data !== 'string' || ev.data.length > 4096) return ws.close(1009);
      let m; try { m = JSON.parse(ev.data); } catch { return; }                               // JSON inválido: se ignora
      if (m?.t === 'hola') { if (typeof m.jid !== 'string' || !/^[0-9a-f]{16,64}$/.test(m.jid)) return ws.close(1008); c.cid = await sha(m.jid); return ws.send(JSON.stringify({ t: 'hola', cid: c.cid })); }
      if (!c.cid) return ws.close(1008);
      this._entregar(this.srv.manejar(c.cid, m)); if (m.t !== 'mover') await this.state.storage.put('sala', this.srv.exportar());
      await this.state.storage.setAlarm(Date.now() + 200);
    });
    ws.addEventListener('close', () => this.conns.delete(c));
    return new Response(null, { status: 101, webSocket: cliente });
  }
  async alarm() { if (!this.conns.size) return; this._entregar(this.srv.difundir()); await this.state.storage.setAlarm(Date.now() + 200); }
  _entregar(salidas) { for (const s of salidas) for (const c of this.conns) if (s.para === '*' || s.para === c.cid) c.ws.send(JSON.stringify(s.msg)); }
}
