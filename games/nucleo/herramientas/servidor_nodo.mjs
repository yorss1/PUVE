// Servidor de internet SIN dependencias: sirve el juego (estático) y las salas por WebSocket en /ws.
// Uso:  node nucleo/herramientas/servidor_nodo.mjs [--puerto 8787] [--datos ./datos]
// Para jugar por internet ponlo detrás de HTTPS (proxy inverso, Cloudflare Tunnel, etc.): el navegador usará wss:// automáticamente.
import http from 'node:http';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, statSync, renameSync } from 'node:fs';
import { resolve, join, extname, dirname, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Servidor } from '../multiplayer/servidor.js';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11', MAX_MSG = 4096, MAX_SALAS = 200, MAX_CONEX = 300;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const PRIVADO = /^\/(nucleo\/(tests|docs|migrations|workers|herramientas)(\/|$)|datos(\/|$)|\.)/;

export function iniciar({ puerto = 8787, raiz = resolve(dirname(fileURLToPath(import.meta.url)), '../..'), datos = resolve('datos'), ahora = Date.now } = {}) {
  mkdirSync(datos, { recursive: true });
  const salas = new Map(), sucio = new Set(), conexiones = new Set(), ultV = new Map();
  for (const f of readdirSync(datos)) if (/^[0-9a-f]{12}\.json$/.test(f)) {
    try { const s = new Servidor({ ahora }); if (s.importar(JSON.parse(readFileSync(join(datos, f), 'utf8')))) salas.set(s.id, { srv: s, conns: new Set() }); else console.warn('Sala ignorada (datos inválidos):', f); }
    catch (e) { console.warn('No se pudo leer', f, e.message); }
  }
  const servidor = http.createServer((req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end(); return; }
    let ruta; try { ruta = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400).end(); return; }
    if (ruta === '/') { res.writeHead(200, { 'Content-Type': MIME['.html'] }).end('<meta charset=utf-8><p><a href="/restaurante.html">Restaurante</a> · <a href="/cafeteria.html">Cafetería</a>'); return; }
    const f = resolve(raiz, '.' + ruta);
    if (!(f + sep).startsWith(raiz + sep) || PRIVADO.test(ruta) || ruta.includes('\0')) { res.writeHead(403).end('Prohibido'); return; }
    if (!MIME[extname(f)] || !existsSync(f) || !statSync(f).isFile()) { res.writeHead(404).end('No encontrado'); return; }
    res.writeHead(200, { 'Content-Type': MIME[extname(f)], 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' }); res.end(req.method === 'HEAD' ? undefined : readFileSync(f));
  });
  const enviar = (c, obj) => {
    const d = Buffer.from(JSON.stringify(obj)), n = d.length, h = n < 126 ? Buffer.from([0x81, n]) : Buffer.from([0x81, 126, n >> 8, n & 255]);
    try { c.socket.write(Buffer.concat([h, d])); } catch (e) { console.warn('Envío fallido', e.message); }
  };
  const cerrar = (c, codigo = 1000) => { if (c.cerrado) return; c.cerrado = true; try { c.socket.end(Buffer.from([0x88, 2, codigo >> 8, codigo & 255])); } catch (e) { console.warn(e.message); } c.socket.destroy(); };
  const entregar = (room, salidas) => { for (const s of salidas) for (const c of room.conns) if (s.para === '*' || s.para === c.cid) enviar(c, s.msg); };
  function mensaje(c, texto) {
    const t = ahora(); c.cred = Math.min(60, c.cred + (t - c.t) / 16); c.t = t; if (c.cred < 1) return; c.cred -= 1;     // ~60 mensajes/s
    let m; try { m = JSON.parse(texto); } catch { return; }
    if (!m || typeof m !== 'object' || typeof m.t !== 'string') return;
    if (m.t === 'hola') { if (typeof m.jid !== 'string' || !/^[0-9a-f]{16,64}$/.test(m.jid)) return cerrar(c, 1008); c.cid = createHash('sha256').update(m.jid).digest('hex').slice(0, 12); return enviar(c, { t: 'hola', cid: c.cid }); }
    if (!c.cid) return cerrar(c, 1008);                                       // el cid lo decide el servidor (derivado de un secreto): nunca el cliente
    if (m.t === 'crear') {
      if (c.sala || salas.size >= MAX_SALAS) return enviar(c, { t: 'resp', ok: false, msg: 'No se puede crear otra sala' });
      const srv = new Servidor({ ahora }), sal = srv.manejar(c.cid, m);
      if (srv.id) { const room = { srv, conns: new Set([c]) }; salas.set(srv.id, room); c.sala = srv.id; sucio.add(srv.id); entregar(room, sal); } else for (const s of sal) enviar(c, s.msg);
      return;
    }
    if (m.t === 'unir') {
      const room = typeof m.sala === 'string' && /^[0-9a-f]{12}$/.test(m.sala) ? salas.get(m.sala) : null;
      if (!room) return enviar(c, { t: 'resp', ok: false, msg: 'La sala no existe' });
      c.sala = m.sala; room.conns.add(c); sucio.add(m.sala); return entregar(room, room.srv.manejar(c.cid, m));
    }
    const room = c.sala && salas.get(c.sala); if (!room) return;
    if (m.t !== 'mover') sucio.add(c.sala);
    entregar(room, room.srv.manejar(c.cid, m));
  }
  function datosWS(c, chunk) {
    c.buf = Buffer.concat([c.buf, chunk]); if (c.buf.length > 2 * MAX_MSG + 16) return cerrar(c, 1009);
    for (;;) {
      const b = c.buf; if (b.length < 2) return;
      const fin = b[0] & 0x80, op = b[0] & 0x0f; let len = b[1] & 0x7f, off = 2;
      if (!(b[1] & 0x80)) return cerrar(c, 1002);                              // los clientes SIEMPRE enmascaran
      if (len === 126) { if (b.length < 4) return; len = b.readUInt16BE(2); off = 4; } else if (len === 127) return cerrar(c, 1009);
      if (len > MAX_MSG) return cerrar(c, 1009);
      if (b.length < off + 4 + len) return;
      const k = b.subarray(off, off + 4), d = Buffer.from(b.subarray(off + 4, off + 4 + len)); for (let i = 0; i < len; i++) d[i] ^= k[i & 3];
      c.buf = b.subarray(off + 4 + len);
      if (!fin || op === 0) return cerrar(c, 1003);                            // sin fragmentación
      if (op === 8) return cerrar(c, 1000);
      if (op === 9) { c.socket.write(Buffer.concat([Buffer.from([0x8a, len]), d])); continue; }
      if (op === 1) mensaje(c, d.toString('utf8')); else if (op !== 10) return cerrar(c, 1003);
    }
  }
  servidor.on('upgrade', (req, socket) => {
    const rechazar = (n, t) => { socket.end(`HTTP/1.1 ${n} ${t}\r\nConnection: close\r\n\r\n`); };
    let u; try { u = new URL(req.url, 'http://x'); } catch { return rechazar(400, 'Bad Request'); }
    const o = req.headers.origin; let okOrigen = true; if (o) { try { okOrigen = new URL(o).host === req.headers.host; } catch { okOrigen = false; } }
    if (u.pathname !== '/ws') return rechazar(404, 'Not Found');
    if (!okOrigen) return rechazar(403, 'Forbidden');                          // defensa contra sitios de terceros (CSWSH)
    const key = req.headers['sec-websocket-key'];
    if (!key || req.headers['sec-websocket-version'] !== '13') return rechazar(400, 'Bad Request');
    if (conexiones.size >= MAX_CONEX) return rechazar(503, 'Service Unavailable');
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${createHash('sha1').update(key + GUID).digest('base64')}\r\n\r\n`);
    const c = { socket, buf: Buffer.alloc(0), cid: null, sala: null, cred: 60, t: ahora(), cerrado: false }; conexiones.add(c);
    socket.on('data', ch => datosWS(c, ch));
    socket.on('close', () => { conexiones.delete(c); const r = c.sala && salas.get(c.sala); if (r) r.conns.delete(c); });
    socket.on('error', e => console.warn('Socket:', e.code || e.message));
  });
  const guardar = () => {
    for (const [id, room] of salas) { if (!sucio.has(id) && ultV.get(id) === room.srv.mundo.v) continue; const d = room.srv.exportar(); if (!d) continue;
      try { const f = join(datos, id + '.json'); writeFileSync(f + '.tmp', JSON.stringify(d)); renameSync(f + '.tmp', f); sucio.delete(id); ultV.set(id, room.srv.mundo.v); } catch (e) { console.error('No se pudo guardar la sala', id, e.message); } }
  };
  const tick = setInterval(() => { for (const room of salas.values()) if (room.conns.size) entregar(room, room.srv.difundir()); }, 100);
  const save = setInterval(guardar, 5000);
  return new Promise(ok => servidor.listen(puerto, () => ok({
    puerto: servidor.address().port, salas, conexiones,
    cerrar() { clearInterval(tick); clearInterval(save); guardar(); for (const c of [...conexiones]) cerrar(c, 1001); return new Promise(r => servidor.close(r)); }
  })));
}
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
  const s = await iniciar({ puerto: +arg('puerto', 8787), datos: resolve(arg('datos', 'datos')) });
  console.log(`Servidor listo: http://localhost:${s.puerto}/restaurante.html  (WebSocket en /ws; salas guardadas en ${arg('datos', 'datos')})`);
  process.on('SIGINT', async () => { await s.cerrar(); process.exit(0); });
}
