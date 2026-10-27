// Capa de presentación: render canvas pixel art, entrada, HUD y guardado local. La lógica vive en sim.js.
import { Sim } from './sim.js';
import { crearAudio } from './audio.js';
import { crearLocal } from '../persistence/local.js';
import { crearNube } from '../persistence/nube.js';
import { NUBE_CFG } from '../../nube-config.js';
import { crearCuentaSimulada } from '../persistence/cuenta-simulada.js';
import { migrarLocalACuenta } from '../persistence/migracion.js';
import { cargarSprites } from './sprites.js';
import { Chunks, tile, esSolido, NEGOCIO, CH, lotes, loteDe, trafico, LOTE_INICIAL } from '../world/ciudad.js';
import { Servidor } from '../multiplayer/servidor.js';
import { precioLote, costoMejora, MAX_FRANQ, RADIO, TURNO_MS } from '../multiplayer/mundo.js';
import { hostLocal, invitadoLocal } from '../multiplayer/transporte-local.js';
import { crearCuentaSupabase } from '../persistence/cuenta-supabase.js';
import { formAcceso, formUsuario } from '../ui/cuenta-ui.js';
import { hostSB, invitadoSB } from '../multiplayer/transporte-supabase.js';
import { iniciarAnuncios } from '../ui/anuncio.js';
import { conectarWS } from '../multiplayer/transporte-ws.js';
import { qrMatriz } from '../multiplayer/qr.js';

const GIROS = ['restaurante', 'cafeteria'];
const giro = document.querySelector('meta[name=puve-giro]')?.content;
const $ = id => document.getElementById(id);
const T = 16;
const P = { w1: '#9c6234', w2: '#8a5329', wl: '#c98a4b', wd: '#6e431f', wall: '#4a3228', wallT: '#6b4a36', dark: '#2a1d18', teal: '#2f6b5f', tealD: '#1f4a42', or: '#d9822b', cream: '#f2dfb8', red: '#b8402f', green: '#4f8a3a', st: '#8c8f92', stD: '#5d6165' };
const PIEL = ['#f1c39b', '#d9a27a', '#a8704a', '#7a4a2e'], PELO = ['#3b2a22', '#8a5329', '#d9a23a', '#1a1412'];
const ROPA = ['#4a7fb0', '#b8402f', '#8a6bb0', '#5a8a4a'];

function fallo(t) { document.body.innerHTML = `<p class="err">${t}</p>`; }

async function iniciar() {
  if (!GIROS.includes(giro)) return fallo('Giro no reconocido. Abre el juego desde el menú del negocio.');
  let cfg;
  try { const r = await fetch(`nucleo/config/${giro}.json`); if (!r.ok) throw new Error(r.status); cfg = await r.json(); }
  catch (e) { console.error(e); return fallo('No se pudo cargar el juego. Revisa tu conexión e inténtalo de nuevo.'); }
  if (cfg.giro !== giro) return fallo('La configuración no coincide con el giro de esta página.');

  // Jugador público: la partida va al dispositivo y a la base de PUVE (sin cuenta). En la demo (?demo=1) no se toca la base.
  const QS = new URLSearchParams(location.search), local = crearLocal();
  const NUBE = (QS.get('demo') !== '1' && NUBE_CFG.url) ? { ...NUBE_CFG, negocio: /^[0-9a-f-]{36}$/i.test(QS.get('n') || '') ? QS.get('n') : null } : null;
  const store = NUBE ? crearNube(local, NUBE) : local;
  const cuenta = NUBE ? crearCuentaSupabase() : crearCuentaSimulada();   // cuenta real (Supabase) o simulada solo en la demo
  iniciarAnuncios({ demo: !NUBE });   // tira de publicidad al fondo; sin anuncios vigentes no se ve
  const perfil = await store.obtenerPerfil();
  let av; try { const r = await fetch('nucleo/config/avatares.json'); av = await r.json(); } catch (e) { console.error(e); av = { piel: [{ id: 0, c: PIEL[0], nv: 1 }], pelo: [{ id: 1, c: PELO[1], nv: 1 }], ropa: [{ id: 0, c: '#fff', nv: 1 }], gorro: [{ id: 0, n: 'Sin gorro', nv: 1 }] }; }
  const sim = new Sim(cfg, await store.cargarPartida(giro));
  const audio = crearAudio(!perfil.mute);
  const S = cargarSprites(giro);   // sprites PNG opcionales: lo que falte se dibuja con el diseño por defecto
  const nivelDisp = () => Math.max(perfil.nivelMax || 1, sim.nivel);
  perfil.look = perfil.look || { piel: 0, pelo: 1, ropa: 0, gorro: 0 };
  for (const c of ['piel', 'pelo', 'ropa', 'gorro']) { const o = av[c].find(o => o.id === perfil.look[c]); if (!o || o.nv > nivelDisp()) perfil.look[c] = av[c][0].id; }
  const cv = $('c'); let ctx = cv.getContext('2d');
  const R = (c, x, y, w, h) => { ctx.fillStyle = c; ctx.fillRect(x | 0, y | 0, w, h); };
  const spr = (n, px, py) => { const im = S.get(n); if (!im) return false; ctx.drawImage(im, px, py + T - im.height); return true; };

  function ajustar() {   // móvil vertical: cámara de 14 casillas de ancho que sigue al jugador y ocupa todo el ancho
    const coarse = matchMedia('(pointer:coarse)').matches, vert = innerHeight > innerWidth;
    cv.width = (coarse && vert ? 14 : sim.W) * T; cv.height = sim.H * T;
    const adh = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--adh')) || 0;   // alto de la tira de publicidad (0 si no hay)
    const S = coarse && vert ? (adh ? Math.min(innerWidth / cv.width, (innerHeight - 64 - 150 - adh) / cv.height) : innerWidth / cv.width) : Math.max(1, Math.floor(Math.min(innerWidth / cv.width, (innerHeight - 64 - adh - (coarse ? 150 : 0)) / cv.height)));
    cv.style.width = cv.width * S + 'px'; cv.style.height = cv.height * S + 'px';
  }
  addEventListener('resize', ajustar); addEventListener('orientationchange', ajustar); ajustar();

  // ---------- mosaicos (la capa estática se pre-renderiza y solo se redibuja si cambia el mapa) ----------
  function suelo(x, y) {
    const px = x * T, py = y * T, o = y % 2 ? 4 : 11;
    if (spr('suelo_madera', px, py)) return;
    R(P.w1, px, py, T, T); R(P.w2, px, py + 3, T, 1); R(P.w2, px, py + 11, T, 1); R(P.w2, px + o, py, 1, 3); R(P.w2, px + 15 - o, py + 8, 1, 3);
  }
  function mosaicoBase(ch, x, y) {
    const px = x * T, py = y * T;
    if (ch === '#') { R(P.wall, px, py, T, T); R(P.wallT, px, py, T, 3); R(P.dark, px, py + 13, T, 3); return; }
    suelo(x, y);
    if (ch === 'B') { R(P.wd, px + 1, py + 1, 14, 12); R('#1d2b27', px + 2, py + 2, 12, 10); R(P.cream, px + 4, py + 4, 8, 1); R(P.cream, px + 4, py + 7, 6, 1); R(P.or, px + 4, py + 9, 4, 1); }
    else if (ch === 't' || ch === 'x') { ctx.globalAlpha = ch === 'x' ? .4 : 1; R('#0004', px + 1, py + 13, 14, 2); R(P.wd, px, py + 2, T, 12); R(P.wl, px + 1, py + 3, 14, 9); R(P.cream, px + 5, py + 6, 6, 3); if (ch === 'x') { R('#e0c040', px + 6, py + 6, 4, 4); } ctx.globalAlpha = 1; }
    else if (ch === 'c') { R(P.tealD, px + 3, py + 2, 10, 4); R(P.teal, px + 3, py + 6, 10, 7); }
    else if (ch === 'R') { R(P.wd, px, py + 4, T, 12); R(P.wl, px, py + 4, T, 3); R(P.cream, px + 3, py + 1, 10, 7); R('#2f6b5f', px + 5, py + 2, 6, 3); R(P.or, px + 4, py + 10, 8, 2); }
    else if (ch === 'F') { R(P.stD, px + 1, py, 14, 16); R(P.st, px + 2, py + 1, 12, 14); R(P.stD, px + 2, py + 7, 12, 1); R(P.cream, px + 11, py + 3, 2, 3); R(P.cream, px + 11, py + 10, 2, 3); }
    else if (ch === 'p') { R(P.or, px + 4, py + 10, 8, 5); R(P.wd, px + 4, py + 14, 8, 1); R(P.green, px + 3, py + 3, 10, 8); R('#356b27', px + 5, py + 1, 6, 6); R('#6fae52', px + 6, py + 4, 2, 2); }
    else if (ch === 'm') { R(P.wd, px, py + 5, T, 11); R(P.wl, px, py + 3, T, 4); R(P.w2, px, py + 10, T, 1); }
    else if (ch === 'v') { R(P.wd, px, py + 4, T, 12); R('#a9d3d6', px + 1, py + 3, 14, 8); R('#7fb3b8', px + 1, py + 3, 14, 2); R(P.or, px + 3, py + 7, 3, 3); R('#e8a0b8', px + 8, py + 7, 3, 3); R(P.cream, px + 13, py + 8, 2, 2); }
    else if (ch === 'D') { R(P.red, px + 2, py + 2, 12, 12); R('#e0b050', px + 4, py + 4, 8, 1); }
    // 'K' se dibuja en la capa dinámica (muestra su estado)
  }
  const SPR = { '#': 'pared', t: 'mesa', x: 'mesa', c: 'silla', R: 'caja', F: 'refri', p: 'planta', m: 'mostrador', v: 'vitrina', B: 'tablero', D: 'puerta' };
  function mosaico(ch, x, y) {
    const n = SPR[ch];
    if (n && S.tiene(n)) { if (ch !== '#') suelo(x, y); if (ch === 'x') ctx.globalAlpha = .4; spr(n, x * T, y * T); ctx.globalAlpha = 1; return; }
    mosaicoBase(ch, x, y);
  }
  const fondo = document.createElement('canvas'); fondo.width = sim.W * T; fondo.height = sim.H * T;
  let verFondo = -1;
  function pintarFondo() {
    const g0 = ctx; ctx = fondo.getContext('2d');
    for (let y = 0; y < sim.H; y++) for (let x = 0; x < sim.W; x++) mosaico(sim.g[y][x] === 'K' ? '.' : sim.g[y][x], x, y);
    ctx = g0; verFondo = sim.ver;
  }

  function estacion(e) {
    const px = e.x * T, py = e.y * T, t = e.tk && sim.tk(e.tk), cafe = cfg.estacion === 'cafetera';
    if (S.tiene('estacion')) spr('estacion', px, py); else if (cafe) { R(P.dark, px + 1, py + 1, 14, 14); R(P.red, px + 1, py + 1, 14, 5); R(P.st, px + 3, py + 7, 10, 3); R('#3b2a22', px + 6, py + 10, 4, 4); R(P.cream, px + 7, py + 11, 2, 2); }
    else { R(P.stD, px, py + 1, T, 15); R(P.st, px + 1, py + 2, 14, 12); for (const [a, b] of [[3, 4], [9, 4], [3, 9], [9, 9]]) R(P.dark, px + a, py + b, 4, 3); R(P.red, px + 2, py + 14, 2, 1); R(P.red, px + 12, py + 14, 2, 1); }
    if (t && t.estado === 'cocinando') { R('#ffb040', px + 5, py + 1, 6, 2); const w = Math.floor(14 * (1 - e.t / (sim.plato(t.plato).t * 1.4))); R(P.dark, px + 1, py - 3, 14, 3); R(P.green, px + 2, py - 2, Math.max(0, Math.min(12, w)), 1); }
    if (t && t.estado === 'listo') { R(P.cream, px + 3, py - 1, 10, 3); R(sim.plato(t.plato).c, px + 5, py - 4, 6, 4); }
  }

  // ---------- personajes (sprites procedurales alineados con la hoja de referencia 03) ----------
  function personaSprite(e, o) {   // hoja 64x96: 4 columnas (quieto, paso1, paso2, sentado) x 4 filas (arriba, abajo, izquierda, derecha)
    const x = Math.round(e.x * T), y = Math.round(e.y * T + (o.sentado ? 3 : 6)), f = o.sentado ? 3 : o.mov ? 1 + (Math.floor(performance.now() / 140) % 2) : 0;
    R('#0004', x - 5, y, 10, 2);
    for (const n of o.capas) { const im = S.get(n); if (im) ctx.drawImage(im, f * 16, (e.dir ?? 1) * 24, 16, 24, x - 8, y - 22, 16, 24); }
  }
  function persona(e, o) {
    if (o.capas && S.tiene(o.capas[0])) return personaSprite(e, o);
    const x = Math.round(e.x * T), y = Math.round(e.y * T + (o.sentado ? 3 : 6)), p = o.mov ? Math.floor(performance.now() / 140) % 2 : 0;
    R('#0004', x - 5, y, 10, 2);
    if (!o.sentado) { R(o.pant || '#3d4d7a', x - 3, y - 4 + p, 3, 4 - p); R(o.pant || '#3d4d7a', x, y - 4 + (1 - p), 3, 4 - (1 - p)); R('#5a3a22', x - 3, y - 1 + p, 3, 1); R('#5a3a22', x, y - 1 + (1 - p), 3, 1); }
    R(o.ropa, x - 4, y - 10, 8, 7); if (o.del) R(o.del, x - 3, y - 8, 6, 5);
    R(o.ropa, x - 5, y - 9, 1, 5); R(o.ropa, x + 4, y - 9, 1, 5);
    R(o.piel, x - 3, y - 16, 6, 6); R(o.pelo, x - 3, y - 16, 6, 2); if (e.dir !== 0) { R(P.dark, x - 2, y - 13, 1, 1); R(P.dark, x + 1, y - 13, 1, 1); } else R(o.pelo, x - 3, y - 16, 6, 4);
    if (o.gorro === 2 || o.gorro === true) { R('#fff', x - 3, y - 19, 6, 3); R('#fff', x - 2, y - 20, 4, 1); } else if (o.gorro === 1) { R(P.red, x - 3, y - 18, 6, 2); R(P.red, x - 4, y - 16, 8, 1); }
  }
  const col = (c, id) => av[c].find(o => o.id === id)?.c;
  const capasJug = k => ['piel_' + k.piel, 'ropa_' + k.ropa, 'pelo_' + k.pelo, k.gorro ? 'gorro_' + k.gorro : null].filter(Boolean);
  const jug = () => ({ capas: capasJug(perfil.look), piel: col('piel', perfil.look.piel), pelo: col('pelo', perfil.look.pelo), ropa: col('ropa', perfil.look.ropa), del: P.or, gorro: perfil.look.gorro });
  function bocadillo(c) {
    const x = Math.round(c.x * T), y = Math.round(c.y * T) - 14;
    const gp = S.get('globo_pedido'), ge = S.get('globo_espera'), ic = S.get('plato_' + c.plato);
    if (c.st === 'pide' && gp) { ctx.drawImage(gp, x - (gp.width >> 1), y - gp.height); return; }
    if (c.st === 'espera' && ge) { ctx.drawImage(ge, x - (ge.width >> 1), y - ge.height); if (ic) ctx.drawImage(ic, x - (ic.width >> 1), y - ge.height + 2); const f = Math.max(0, c.pac / c.max); R(f > .5 ? P.green : f > .25 ? '#e0a030' : P.red, x - 4, y - 1, Math.round(8 * f), 1); return; }
    if (c.st === 'pide') { R('#fff', x - 4, y - 8, 8, 8); R(P.red, x - 1, y - 7, 2, 4); R(P.red, x - 1, y - 2, 2, 1); }
    else if (c.st === 'espera') { R('#fff', x - 5, y - 9, 10, 9); R(sim.plato(c.plato).c, x - 3, y - 8, 6, 5); const f = Math.max(0, c.pac / c.max); R(f > .5 ? P.green : f > .25 ? '#e0a030' : P.red, x - 4, y - 2, Math.round(8 * f), 1); }
  }

  function dibujarInterior() {
    if (verFondo !== sim.ver) pintarFondo();
    const cx = Math.max(0, Math.min(sim.W * T - cv.width, Math.round(sim.p.x * T - cv.width / 2)));
    ctx.save(); ctx.clearRect(0, 0, cv.width, cv.height); ctx.translate(-cx, 0);
    ctx.drawImage(fondo, 0, 0);
    for (const e of sim.est) estacion(e);
    const lista = [];
    for (const c of sim.clientes) lista.push([c.y + (c.st === 'come' || c.st === 'pide' || c.st === 'espera' ? .01 : 0), () => { persona(c, { capas: ['piel_' + (c.look % 4), 'cliente_ropa_' + (c.look % 4), 'pelo_' + ((c.look + 1) % 4)], piel: PIEL[c.look % 4], pelo: PELO[(c.look + 1) % 4], ropa: ROPA[c.look % 4], sentado: c.st !== 'ir' && c.st !== 'sale', mov: c.st === 'ir' || c.st === 'sale' }); bocadillo(c); if (c.st === 'come') R(P.cream, Math.round(c.x * T) - 3, Math.round(c.y * T) - 2, 6, 2); }]);
    for (const e of sim.emps) lista.push([e.y, () => { persona(e, { capas: ['empleado_cuerpo'], piel: PIEL[2], pelo: PELO[0], ropa: '#fff', del: P.teal, gorro: true, mov: e.ruta.length > 0 }); if (e.lleva) { const t = sim.tk(e.lleva); if (t) { R(P.cream, Math.round(e.x * T) - 3, Math.round(e.y * T) - 28, 6, 2); R(sim.plato(t.plato).c, Math.round(e.x * T) - 2, Math.round(e.y * T) - 31, 4, 3); } } }]);
    lista.push([sim.p.y, () => { persona(sim.p, { ...jug(), mov: sim.p.mov }); if (sim.llevando) { const t = sim.tk(sim.llevando); if (t) { R(P.cream, Math.round(sim.p.x * T) - 3, Math.round(sim.p.y * T) - 18, 6, 2); R(sim.plato(t.plato).c, Math.round(sim.p.x * T) - 2, Math.round(sim.p.y * T) - 21, 4, 3); } } }]);
    for (const r of remotosVisibles()) lista.push([r.y, () => dibRemoto(r)]);
    lista.sort((a, b) => a[0] - b[0]).forEach(l => l[1]());
    if (sim.cuentas.length) { const r = sim.cajas[0]; R('#e0c040', r.x * T + 6, r.y * T - 3 - (Math.floor(performance.now() / 300) % 2), 4, 4); }
    ctx.restore();
  }

  // ---------- entrada ----------
  const keys = new Set(); let pend = false, sv = { x: 0, y: 0 }, tiendaAbierta = false, panelActual = '';
  addEventListener('keydown', e => {
    if (e.code !== 'Escape' && e.target?.closest?.('input,textarea,select,[contenteditable]')) return;   // escribiendo en un formulario (usuario, correo, contraseña): el juego no debe interceptar teclas
    if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
    keys.add(e.code); if (!e.repeat && ['KeyE', 'Space', 'Enter'].includes(e.code)) pend = true;
    if (e.code === 'Escape') cerrarTienda();
    if (e.code === 'KeyM') (tiendaAbierta ? cerrarTienda : menu)();
  });
  addEventListener('keyup', e => keys.delete(e.code));
  addEventListener('blur', () => { keys.clear(); sv = { x: 0, y: 0 }; });
  const stick = $('stick'), knob = stick.firstElementChild;
  function mover(e) { const r = stick.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2), m = r.width / 2, l = Math.hypot(dx, dy) || 1, k = Math.min(1, l / m); sv = { x: dx / l * k, y: dy / l * k }; knob.style.transform = `translate(${sv.x * 36}px,${sv.y * 36}px)`; }
  stick.addEventListener('pointerdown', e => { stick.setPointerCapture(e.pointerId); mover(e); });
  stick.addEventListener('pointermove', e => { if (stick.hasPointerCapture(e.pointerId)) mover(e); });
  const soltar = () => { sv = { x: 0, y: 0 }; knob.style.transform = ''; };
  stick.addEventListener('pointerup', soltar); stick.addEventListener('pointercancel', soltar);
  $('act').addEventListener('pointerdown', e => { e.preventDefault(); pend = true; });
  const entrada = () => {
    const k = c => keys.has(c) ? 1 : 0;
    return { x: k('KeyD') + k('ArrowRight') - k('KeyA') - k('ArrowLeft') + sv.x, y: k('KeyS') + k('ArrowDown') - k('KeyW') - k('ArrowUp') + sv.y };
  };

  // ---------- HUD, avisos, tienda y guardado ----------
  let tAviso = 0;
  function aviso(t) { if (!t) return; const a = $('aviso'); a.textContent = t; a.classList.add('on'); clearTimeout(tAviso); tAviso = setTimeout(() => a.classList.remove('on'), 1600); }
  function hud() {
    $('h1').textContent = `${cfg.titulo} · Nv ${sim.nivel}`;
    $('h2').textContent = `$${sim.d.dinero}${mundo?.mio ? ' · F$' + mundo.mio.dinero : ''} · Stock ${sim.d.stock} · ${'★'.repeat(Math.round(sim.d.rep / 2))}${'☆'.repeat(5 - Math.round(sim.d.rep / 2))}${guardadoOk ? '' : ' · ¡sin guardar!'}`;
    $('pista').textContent = modo === 'ciudad' ? textoCiudad() : sim.pista() || (paso < 99 ? TXT[paso] : sim.llevando ? 'Lleva el plato al cliente' : objetivo());
  }
  function objetivo() {
    if (sim.clientes.some(c => c.st === 'pide')) return 'Un cliente quiere pedir: acércate a su silla';
    if (sim.tickets.some(t => t.estado === 'cola')) return 'Hay un pedido: ve a la ' + (cfg.estacion === 'cafetera' ? 'cafetera' : 'estufa');
    if (sim.cuentas.length) return 'Cobra en la caja';
    return 'Espera clientes · surte en el refri · mejora en el tablero';
  }
  const KEY_SOLO = `puvegame:mundo:solo:${giro}`;
  let guardadoOk = true, congelar = false;
  async function guardar() {
    if (congelar) return;
    try {
      const s = sim.serializar(); await store.guardarPartida(giro, s);
      // La cuenta solo recibe autoguardados tras vincular este giro con una migración confirmada: nunca pisa una partida remota sin preguntar.
      if (cuenta.usuario() && perfil.vinculo?.[giro] === cuenta.usuario()) { try { if (cuenta.autoguardar) cuenta.autoguardar(giro, s); else await cuenta.guardarPartida(giro, s); } catch (e) { console.warn('Cuenta', e.message); } }
      if (sim.nivel > (perfil.nivelMax || 1)) { perfil.nivelMax = sim.nivel; await store.guardarPerfil(perfil); }
      if (net?.modo === 'solo' && net.srv.mundo.v !== net.vGuardada) { localStorage.setItem(KEY_SOLO, JSON.stringify(net.srv.exportar())); net.vGuardada = net.srv.mundo.v; }
      guardadoOk = true;
    } catch (e) { console.error('No se pudo guardar', e); guardadoOk = false; }
  }
  function tienda() {
    const box = $('tienda'); box.hidden = false; tiendaAbierta = true; box.textContent = '';
    const w = document.createElement('div'), h = document.createElement('h2'), msg = document.createElement('p');
    h.textContent = `Mejoras · $${sim.d.dinero}`; w.appendChild(h);
    for (const m of cfg.mejoras) {
      const b = document.createElement('button'), ya = sim.d.comp.includes(m.id);
      b.type = 'button'; b.disabled = ya; b.textContent = `${m.n}  ${ya ? '✓' : '$' + m.costo + (sim.nivel < m.nivel ? ` (Nv ${m.nivel})` : '')}`;
      b.onclick = () => { const r = sim.comprar(m.id); if (r.ok) guardar(); tienda(); $('tienda').querySelector('p').textContent = r.msg; };
      w.appendChild(b);
    }
    const c = document.createElement('button'); c.type = 'button'; c.textContent = 'Cerrar'; c.onclick = cerrarTienda; w.appendChild(c); w.appendChild(msg); box.appendChild(w);
  }
  function cerrarTienda() { $('tienda').hidden = true; tiendaAbierta = false; panelActual = ''; }

  // ---------- ciudad por chunks: salir por la puerta del local; la entrada de tu negocio es la puerta verde ----------
  const chunks = new Chunks({ seed: 7, radio: 2, margen: 1, presupuesto: 2 });
  let modo = 'interior', enfriar = 0;   // enfriar: pausa tras cambiar de escena para no rebotar por la misma puerta
  const cp = { x: NEGOCIO.aparece.x, y: NEGOCIO.aparece.y, dir: 1, mov: false };
  const mundoC = { solido: (x, y) => { const ch = chunks.tile(x, y); return esSolido(ch) && !(ch === 'p' && esMiPuerta(x, y)); }, _choca: Sim.prototype._choca };   // solo tu propia puerta se puede cruzar
  chunks.forzar(cp.x, cp.y);
  S.listo.then(() => { sim.ver++; for (const c of chunks.m.values()) delete c.img; });   // al terminar la carga, repinta con los sprites encontrados
  const CS = { '.': 'calle', ',': 'acera', g: 'pasto', T: 'arbol', P: 'puerta_negocio', p: 'puerta_ajena', l: 'farola', b: 'banca' };
  function ciudadProc(ch, gx, gy, px, py, ar) {
    const lx = ((gx % CH) + CH) % CH, ly = ((gy % CH) + CH) % CH, h = (gx * 31 + gy * 17) & 7;
    if (ch === '.') { R('#3d3f46', px, py, T, T); if (lx === 7 && !(ly >= 6 && ly <= 9) && ly % 2 === 0) R('#d9c46a', px + 14, py + 3, 2, 10); if (ly === 7 && !(lx >= 6 && lx <= 9) && lx % 2 === 0) R('#d9c46a', px + 3, py + 14, 10, 2); return; }
    if (ch === ',' || ch === 'l') { R('#b9a58a', px, py, T, T); R('#a08a6e', px, py + 15, T, 1); }
    else if (ch === 'H' || ch === 'P' || ch === 'p') { if ('HPp'.includes(ar) || ch !== 'H') { R('#d8c3a0', px, py, T, T); if (ch === 'H' && (gx + gy) % 2) { R('#6fa3b8', px + 3, py + 4, 4, 5); R('#6fa3b8', px + 9, py + 4, 4, 5); } } else { R('#8a3b2f', px, py, T, T); R('#6e2a22', px, py + 13, T, 3); } }
    else { R('#4f8a3a', px, py, T, T); R('#5f9c47', px + h, py + 3 + (h >> 1), 2, 2); R('#5f9c47', px + 12 - h, py + 11, 2, 2); }
    if (ch === 'T') { R('#5a3a22', px + 7, py + 8, 2, 7); R('#356b27', px + 2, py + 1, 12, 9); R('#4f8a3a', px + 4, py + 3, 5, 3); }
    else if (ch === 'l') { R(P.dark, px + 7, py + 4, 2, 12); R('#ffd070', px + 5, py + 1, 6, 4); }
    else if (ch === 'b') { R(P.wd, px + 2, py + 8, 12, 3); R(P.wl, px + 2, py + 5, 12, 3); }
    else if (ch === 'P') { R(P.teal, px + 3, py + 2, 10, 14); R('#e0b050', px + 10, py + 9, 2, 2); R('#e0c040', px + 4, py, 8, 2); }
    else if (ch === 'p') { R(P.wd, px + 3, py + 4, 10, 12); R('#e0b050', px + 10, py + 9, 2, 2); }
  }
  function mosaicoCiudad(ch, gx, gy, px, py) {
    const ar = tile(chunks.seed, gx, gy - 1), n = ch === 'H' ? ('HPp'.includes(ar) ? 'edificio_muro' : 'edificio_techo') : CS[ch];
    if (n && S.tiene(n)) { if (ch === 'T' || ch === 'b') ciudadProc('g', gx, gy, px, py, ar); else if (ch === 'l') ciudadProc(',', gx, gy, px, py, ar); spr(n, px, py); return; }
    ciudadProc(ch, gx, gy, px, py, ar);
  }
  function pintarChunk(c) {
    const im = document.createElement('canvas'); im.width = im.height = CH * T; const g0 = ctx; ctx = im.getContext('2d');
    for (let ly = 0; ly < CH; ly++) for (let lx = 0; lx < CH; lx++) mosaicoCiudad(c.filas[ly][lx], c.cx * CH + lx, c.cy * CH + ly, lx * T, ly * T);
    ctx = g0; return im;
  }
  function pasoCiudad(dt, inp) {
    const l = Math.hypot(inp.x, inp.y);
    if (l > .1) { const k = 4.6 * dt / Math.max(1, l); Sim.prototype.mover.call(mundoC, cp, inp.x * k, inp.y * k); cp.dir = Math.abs(inp.x) > Math.abs(inp.y) ? (inp.x > 0 ? 3 : 2) : (inp.y > 0 ? 1 : 0); cp.mov = true; } else cp.mov = false;
    chunks.actualizar(cp.x, cp.y); chunks.paso();
    if (performance.now() > enfriar && esMiPuerta(Math.floor(cp.x), Math.floor(cp.y + .35))) entrarNegocio();
  }
  function entrarNegocio() { enfriar = performance.now() + 800; modo = 'interior'; sim.p.x = sim.puerta.x + .5; sim.p.y = sim.puerta.y - 1; sim.p.dir = 0; audio.tono('ok'); aviso('Entraste a tu ' + cfg.titulo.toLowerCase()); }
  function revisarPuerta() {   // la casilla de la puerta del local lleva a la calle; el tiempo de la simulación queda en pausa afuera
    if (performance.now() > enfriar && sim.g[Math.floor(sim.p.y + .35)]?.[Math.floor(sim.p.x)] === 'D') { guardar(); enfriar = performance.now() + 800; modo = 'ciudad'; const h = miHogar(); cp.x = h.frente.x; cp.y = h.frente.y; cp.dir = 1; chunks.forzar(cp.x, cp.y); }
  }
  function dibujarCiudad() {
    const cx0 = Math.round(cp.x * T - cv.width / 2), cy0 = Math.round(cp.y * T - cv.height / 2), tam = CH * T;
    ctx.save(); ctx.fillStyle = '#1d2b27'; ctx.fillRect(0, 0, cv.width, cv.height); ctx.translate(-cx0, -cy0);
    for (let cy = Math.floor(cy0 / tam); cy <= Math.floor((cy0 + cv.height) / tam); cy++) for (let cx = Math.floor(cx0 / tam); cx <= Math.floor((cx0 + cv.width) / tam); cx++) { const c = chunks.obtener(cx, cy); if (c) { if (!c.img) c.img = pintarChunk(c); ctx.drawImage(c.img, cx * tam, cy * tam); } }
    for (let cy = Math.floor(cy0 / tam); cy <= Math.floor((cy0 + cv.height) / tam); cy++) for (let cx = Math.floor(cx0 / tam); cx <= Math.floor((cx0 + cv.width) / tam); cx++) for (const l of lotesChunk(cx, cy)) {   // rótulos de propiedad
      const o = ocupa.get(l.id), px = l.puerta.x * T, py = l.puerta.y * T;
      if (!o) { R('#e0c040', px + 3, py, 10, 3); continue; }
      R(o.color, px, py, T, 3); R('#0006', px, py + 3, T, 1); if (o.tipo === 'f') { R('#fff', px + 6, py + 5, 4, 1); for (let i = 0; i < o.nivel; i++) R('#fff', px + 2 + i * 3, py + 7, 2, 2); }
      if (o.cid === net?.cid) R('#fff', px + 1, py + 1, 2, 1);
    }
    const lista = [[cp.y, () => persona(cp, { ...jug(), mov: cp.mov })]];
    for (const r of remotosVisibles()) lista.push([r.y, () => dibRemoto(r)]);
    lista.sort((a, b) => a[0] - b[0]).forEach(l => l[1]()); ctx.restore();
  }
  function dibujar() { if (modo === 'ciudad') dibujarCiudad(); else dibujarInterior(); }
  const textoCiudad = () => { const l = loteCerca(); return l ? 'E: lote ' + l.id + ' · ' + resumenLote(l) : 'Ciudad · tu ' + cfg.titulo.toLowerCase() + ' tiene el rótulo blanco' + (remotos.size ? ' · ' + [...remotos.values()].map(r => r.nombre).join(', ') : ''); };
  const lotesCache = new Map(), lotesChunk = (cx, cy) => { const k = cx + ',' + cy; let r = lotesCache.get(k); if (!r) { r = lotes(chunks.seed, cx, cy); if (lotesCache.size > 200) lotesCache.clear(); lotesCache.set(k, r); } return r; };
  const miHogar = () => loteDe(chunks.seed, mundo?.mio?.hogar || LOTE_INICIAL) || loteDe(chunks.seed, LOTE_INICIAL);
  const esMiPuerta = (gx, gy) => { const h = miHogar(); return gx === h.puerta.x && gy === h.puerta.y; };
  function loteCerca() {
    let mejor = null, md = 2.1; const pcx = Math.floor(cp.x / CH), pcy = Math.floor(cp.y / CH);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) for (const l of lotesChunk(pcx + dx, pcy + dy)) { const d = Math.hypot(cp.x - l.puerta.x - .5, cp.y - l.puerta.y - .5); if (d < md) { md = d; mejor = l; } }
    return mejor;
  }

  // ---------- servidor, salas y economía compartida (Monopoly de franquicias) ----------
  const remotos = new Map(), pendientes = new Map(), ocupa = new Map();
  let net = null, misSalas = null, netId = 0, seqLocal = 0, tRed = 0, mundo = null, estadoRed = '', panelLoteId = null;
  const hex = n => [...crypto.getRandomValues(new Uint8Array(n))].map(b => b.toString(16).padStart(2, '0')).join('');
  const jidWS = () => { let j = localStorage.getItem('puvegame:jid'); if (!/^[0-9a-f]{24}$/.test(j || '')) { j = hex(12); localStorage.setItem('puvegame:jid', j); } return j; };   // secreto: solo viaja al servidor
  const nombreLocal = () => cuenta.usuario() || 'Invitado';
  const remotosVisibles = () => [...remotos.values()].filter(r => r.modo === modo);
  const refrescar = nombre => { if (tiendaAbierta && panelActual === nombre) (nombre === 'Multijugador' ? panelMulti : nombre === 'Franquicias' ? panelFranq : () => panelLote(panelLoteId))(); };
  function dibRemoto(r) {
    const k = r.look || {};
    persona(r, { capas: capasJug(k), piel: col('piel', k.piel) || PIEL[0], pelo: col('pelo', k.pelo) || PELO[0], ropa: col('ropa', k.ropa) || '#fff', del: P.or, gorro: k.gorro, mov: r.mov });
    ctx.font = '6px ui-monospace,monospace'; ctx.textAlign = 'center'; const x = Math.round(r.x * T), y = Math.round(r.y * T) - 24;
    ctx.fillStyle = '#000'; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) ctx.fillText(r.nombre, x + dx, y + dy); ctx.fillStyle = '#fff'; ctx.fillText(r.nombre, x, y);
  }
  function aplicarSnap(snap) {
    const vivos = new Set();
    for (const s of snap) {
      if (s.cid === net.cid) continue; vivos.add(s.cid); let r = remotos.get(s.cid);
      if (!r) { r = { x: s.x, y: s.y }; remotos.set(s.cid, r); } if (r.modo !== s.modo) { r.x = s.x; r.y = s.y; }
      Object.assign(r, { tx: s.x, ty: s.y, dir: s.dir, modo: s.modo, look: s.look, nombre: s.nombre });
    }
    for (const k of [...remotos.keys()]) if (!vivos.has(k)) remotos.delete(k);
  }
  function red(dt) {
    if (!net || net.modo === 'solo') return;
    tRed -= dt;
    if (tRed <= 0) { tRed = .1; const p = modo === 'ciudad' ? cp : sim.p; net.conn.enviar({ t: 'mover', seq: ++seqLocal, modo, x: p.x, y: p.y, dir: p.dir, look: perfil.look }); aplicarSnap(net.snap); }
    for (const r of remotos.values()) { const dx = r.tx - r.x, dy = r.ty - r.y, k = Math.min(1, dt * 12); r.mov = Math.hypot(dx, dy) > .05; r.x += dx * k; r.y += dy * k; }
  }
  function alMensaje(id, m) {
    if (!net || net.id !== id || !m || typeof m.t !== 'string') return;
    if (m.t === 'hola') { net.cid = m.cid; net.alAbrir?.(); }
    else if (m.t === 'creada') { net.sala = { id: m.id, token: m.token }; net.url = location.origin + location.pathname + `#sala=${m.id}.${m.token}&t=${net.modo === 'ws' ? 'ws' : net.modo === 'sb' ? 'sb' : 'loc'}`; refrescar('Multijugador'); }
    else if (m.t === 'resp') { if (!m.ok) { aviso(m.msg); if (net.modo !== 'solo') salirRed(); } else if (m.giro !== giro) { aviso('Esa sala es de otro tipo de negocio'); salirRed(); } else if (net.modo !== 'solo') { net.sala = net.sala || { id: m.id }; aviso('Te uniste a la sala'); } refrescar('Multijugador'); }
    else if (m.t === 'snap') net.snap = m.snap;
    else if (m.t === 'mundo') { mundo = m; ocupa.clear(); const col = new Map(m.jugadores.map(j => [j.cid, j.color])); for (const [lid, dueno, nivel, tipo] of m.lotes) ocupa.set(lid, { cid: dueno, color: col.get(dueno) || '#888', nivel, tipo }); refrescar('Franquicias'); refrescar('Lote'); }
    else if (m.t === 'res') { const f = pendientes.get(m.id); if (f) { pendientes.delete(m.id); f(m); } }
    else if (m.t === 'cerrada') { aviso('La sala se cerró'); salirRed(); }
  }
  const hooks = id => ({ onMsg: m => alMensaje(id, m), onEstado: e => { if (net?.id === id) estadoRed = e === 'conectado' ? '' : e; } });
  function nuevaRed(extra) { cerrarConn(); mundo = null; remotos.clear(); ocupa.clear(); net = { id: ++netId, snap: [], ...extra }; return net; }
  function cerrarConn() { if (net) { net.conn?.cerrar(); net = null; } }
  function iniciarSolo() {
    const srv = new Servidor(); try { const g = localStorage.getItem(KEY_SOLO); if (g) srv.importar(JSON.parse(g)); } catch (e) { console.warn('Mundo solo ilegible; se crea uno nuevo', e); }
    const n = nuevaRed({ modo: 'solo', cid: 'solo', srv, vGuardada: -1 }); n.conn = hostLocal(srv, 'solo', hooks(n.id), { bc: false });
    n.conn.enviar(srv.sala ? { t: 'unir', nombre: nombreLocal() } : { t: 'crear', giro, nombre: nombreLocal() });
  }
  function salirRed(volverSolo = true) { if (!net) return; const modoAnt = net.modo; cerrarConn(); estadoRed = ''; if (volverSolo) { iniciarSolo(); if (modoAnt !== 'solo') aviso('Volviste a tu mundo individual'); } }
  const sbListo = () => {
    if (!cuenta.real || !cuenta.listo()) { aviso('Conectando con tu cuenta… intenta de nuevo en un momento'); return false; }
    if (!cuenta.sesion() || !cuenta.usuario()) { aviso('Inicia sesión en Cuenta y progreso para jugar por internet'); return false; }
    return true;
  };
  const guardarSalaDB = async e => { const { error } = await cuenta.cliente().rpc('juego_sala_guardar', { p_id: e.id, p_giro: giro, p_estado: e }); if (error) throw new Error(error.message); };
  function abrirMulti() { misSalas = null; panelMulti(); if (cuenta.real && cuenta.listo() && cuenta.usuario()) cargarMisSalas(); }
  async function cargarMisSalas() { try { const { data } = await cuenta.cliente().rpc('juego_mis_salas'); misSalas = (data || []).filter(x => x.giro === giro); } catch (e) { misSalas = []; } if (tiendaAbierta && panelActual === 'Multijugador') panelMulti(); }
  async function reanudarSala(id) {   // el anfitrión vuelve a abrir una sala guardada en la base
    if (!sbListo()) return;
    const { data, error } = await cuenta.cliente().rpc('juego_sala_cargar', { p_id: id }), srv = new Servidor();
    if (error || !data || data.hostCid !== cuenta.cid() || !srv.importar(data)) { aviso('No se pudo reanudar esa sala'); return; }
    const n = nuevaRed({ modo: 'sb', rol: 'host', sala: { id: srv.id, token: srv.token }, cid: cuenta.cid(), srv }), h = hooks(n.id);
    n.conn = hostSB(cuenta.cliente(), srv, n.cid, h, { alGuardar: guardarSalaDB }); n.conn.enviar({ t: 'invitar' }); panelMulti();
  }
  function crearSala(tipo) {
    if (tipo === 'sb' && !sbListo()) return;
    const n = nuevaRed({ modo: tipo, rol: 'host' }), h = hooks(n.id);
    if (tipo === 'loc') { n.cid = hex(8); n.srv = new Servidor(); n.conn = hostLocal(n.srv, n.cid, h); n.conn.enviar({ t: 'crear', giro, nombre: nombreLocal(), look: perfil.look }); }
    else if (tipo === 'sb') { n.cid = cuenta.cid(); n.srv = new Servidor(); n.conn = hostSB(cuenta.cliente(), n.srv, n.cid, h, { alGuardar: guardarSalaDB }); n.conn.enviar({ t: 'crear', giro, nombre: nombreLocal(), look: perfil.look }); }
    else { n.alAbrir = () => n.conn.enviar(n.sala ? { t: 'unir', sala: n.sala.id, nombre: nombreLocal() } : { t: 'crear', giro, nombre: nombreLocal() }); n.modo = 'ws'; n.conn = conectarWS((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws', jidWS(), h); }
    panelMulti();
  }
  function unirse(texto) {
    const m = String(texto).match(/sala=([0-9a-f]{12})\.([0-9a-f]{32})(?:&t=(ws|loc|sb))?/);
    if (!m) { aviso('Enlace de invitación inválido'); return false; }
    const tipo = m[3] === 'ws' ? 'ws' : m[3] === 'sb' ? 'sb' : 'loc';
    if (tipo === 'sb') { if (cuenta.real && !cuenta.listo()) { cuenta.iniciar().then(() => unirse(texto)).catch(() => aviso('No se pudo conectar con tu cuenta')); return true; } if (!sbListo()) return false; }
    const n = nuevaRed({ modo: tipo, rol: 'invitado', sala: { id: m[1], token: m[2] } }), h = hooks(n.id);
    if (tipo === 'loc') { n.cid = hex(8); n.conn = invitadoLocal(m[1], n.cid, h); n.conn.enviar({ t: 'unir', token: m[2], nombre: nombreLocal() }); }
    else if (tipo === 'sb') { n.cid = cuenta.cid(); n.conn = invitadoSB(cuenta.cliente(), m[1], n.cid, h); n.conn.enviar({ t: 'unir', token: m[2], nombre: nombreLocal() }); }
    else { n.alAbrir = () => n.conn.enviar({ t: 'unir', sala: m[1], token: m[2], nombre: nombreLocal() }); n.conn = conectarWS((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws', jidWS(), h); }
    return true;
  }
  // Operaciones económicas: el servidor decide. Se reintenta con el MISMO id (idempotente) para no duplicar efectos.
  function eco(op, extra = {}) {
    const id = hex(8);
    return new Promise(res => {
      let intentos = 0; const envia = () => { if (!net) return res({ ok: false, msg: 'Sin conexión' }); net.conn.enviar({ t: 'eco', id, op, ...extra }); };
      pendientes.set(id, r => { clearInterval(iv); res(r); });
      const iv = setInterval(() => { if (!pendientes.has(id)) return clearInterval(iv); if (++intentos > 3) { clearInterval(iv); pendientes.delete(id); res({ ok: false, sinRespuesta: true, msg: 'Sin respuesta del servidor; revisa tu cuenta de franquicias' }); } else envia(); }, 2500);
      envia();
    });
  }
  async function invertir(x) {
    x = Math.floor(Math.min(x, sim.d.dinero, mundo?.mio?.cupo ?? 0)); if (x < 1) return { ok: false, msg: sim.d.dinero < 1 ? 'Tu restaurante no tiene dinero' : 'Cupo de inversión agotado: espera unos segundos' };
    sim.d.dinero -= x; const r = await eco('invertir', { monto: x });            // se reserva primero; solo se devuelve ante rechazo definitivo
    if (!r.ok && !r.sinRespuesta) sim.d.dinero += x; guardar(); return r;
  }
  const resumenLote = l => { const o = ocupa.get(l.id); if (!o) return `libre · $${precioLote(l)}`; const j = mundo?.jugadores.find(j => j.cid === o.cid); return `${o.cid === net?.cid ? 'tuyo' : j?.nombre || 'otro'} · nv ${o.nivel}`; };
  function accionCiudad() { const l = loteCerca(); if (!l) return { msg: '' }; if (!mundo) return { msg: 'Conectando con el servidor…' }; panelLote(l); return { msg: '' }; }
  function panelLote(l) {
    if (typeof l === 'string') l = loteDe(chunks.seed, l); if (!l || !mundo) return cerrarTienda(); panelLoteId = l.id;
    const o = ocupa.get(l.id), mio = o && o.cid === net?.cid, msg = txt(''), info = mundo.lotes.find(x => x[0] === l.id), inv = info?.[4] || 0;
    let comp = 0; for (const [id] of ocupa) if (id !== l.id) { const q = loteDe(chunks.seed, id); if (q && Math.hypot(q.puerta.x - l.puerta.x, q.puerta.y - l.puerta.y) <= RADIO) comp++; }
    const filas = [txt(`Lote ${l.id} · tráfico ${trafico(l)}/10 · competidores cerca: ${comp}`), txt(`Tu cuenta de franquicias: $${mundo.mio.dinero}`)];
    const hacer = (op, ok) => async () => { const r = await eco(op, { lote: l.id }); msg.textContent = r.msg; if (r.ok) { audio.tono('moneda'); if (ok) ok(); } else audio.tono('error'); };
    if (!o) filas.push(txt(`Libre. Precio: $${precioLote(l)}`), btn(`Abrir franquicia ($${precioLote(l)})`, hacer('comprar'), mundo.mio.dinero < precioLote(l)));
    else if (o.tipo === 'h') filas.push(txt(mio ? 'Es tu restaurante (se juega por dentro y no se vende).' : `Restaurante de ${mundo.jugadores.find(j => j.cid === o.cid)?.nombre || 'otro jugador'}. Compite contigo por los clientes de la zona.`));
    else if (mio) { const c = costoMejora(l, o.nivel), g = Math.round(.7 * (precioLote(l) + inv)); filas.push(txt(`Tu franquicia · nivel ${o.nivel}/5 · rinde ${mundo.mio.ingresos[l.id] ?? '…'} por turno (${TURNO_MS / 1000} s)`), btn(o.nivel >= 5 ? 'Nivel máximo' : `Mejorar a nv ${o.nivel + 1} ($${c})`, hacer('mejorar'), o.nivel >= 5 || mundo.mio.dinero < c), btn(`Vender (+$${g})`, hacer('vender', cerrarTienda))); }
    else filas.push(txt(`Franquicia de ${mundo.jugadores.find(j => j.cid === o.cid)?.nombre || 'otro jugador'} · nivel ${o.nivel}. Aún no se puede comprar a otro jugador.`));
    filas.push(btn('Cerrar', cerrarTienda), msg); abrir('Lote', filas);
  }
  function panelFranq() {
    const msg = txt(''), m = mundo?.mio, filas = [];
    if (!m) { filas.push(txt('Conectando con el servidor…')); }
    else {
      filas.push(txt(`Cuenta de franquicias: $${m.dinero} · Cupo para invertir: $${m.cupo} · Turno ${mundo.turno} (cada ${TURNO_MS / 1000} s)`), txt(`Tu restaurante tiene $${sim.d.dinero}. Invierte para comprar lotes en la ciudad y compite con los demás.`));
      const ir = x => async () => { const r = await invertir(x); msg.textContent = r.msg; audio.tono(r.ok ? 'moneda' : 'error'); if (r.ok) panelFranq(); };
      const f = document.createElement('div'); f.className = 'fila'; f.append(btn('Invertir $100', ir(100)), btn('Invertir $500', ir(500)), btn('Todo lo posible', ir(1e9))); filas.push(f);
      filas.push(txt('Ranking por patrimonio:'), ...mundo.jugadores.map((j, i) => txt(`${i + 1}. ${j.nombre}${j.cid === net.cid ? ' (tú)' : ''} · $${j.patrimonio} · ${j.franq}/${MAX_FRANQ} franquicias`)));
      const mias = mundo.lotes.filter(l => l[1] === net.cid && l[3] === 'f'); filas.push(txt(mias.length ? 'Tus franquicias: ' + mias.map(l => `${l[0]} (nv ${l[2]}, ${m.ingresos[l[0]] ?? '…'}/turno)`).join(' · ') : 'Aún no tienes franquicias: camina por la ciudad y pulsa E frente a un lote libre (rótulo amarillo).'));
      if (m.eventos.length) filas.push(txt('Últimos eventos: ' + m.eventos.join(' · ')));
    }
    filas.push(btn('Volver', menu), msg); abrir('Franquicias', filas);
  }
  function panelMulti() {
    const msg = txt(''), filas = [txt('Juega con amigos en la misma ciudad: cada quien tiene su restaurante y compiten por lotes y clientes.')];
    if (estadoRed) filas.push(txt('Estado: ' + estadoRed));
    if (!net || net.modo === 'solo') {
      const web = location.protocol.startsWith('http'), i = document.createElement('input'); i.placeholder = 'Pega aquí el enlace de invitación'; i.style.cssText = 'width:100%;padding:10px;margin:6px 0;font:inherit';
      const real = !!cuenta.real, ok = real && cuenta.sesion() && cuenta.usuario();
      if (real) {
        filas.push(btn('Crear sala por internet', () => crearSala('sb'), !ok), txt(ok ? 'Tus amigos entran con el enlace o el QR; también necesitan su cuenta.' : 'Para jugar por internet inicia sesión en Cuenta y progreso.'));
        for (const x of (misSalas || [])) filas.push(btn('Reanudar mi sala ' + x.id.slice(0, 4) + '…', () => reanudarSala(x.id)));
      } else filas.push(btn('Crear sala en el servidor (internet)', () => crearSala('ws'), !web), txt(web ? 'Requiere abrir el juego desde el servidor: node nucleo/herramientas/servidor_nodo.mjs' : 'Abre el juego desde un servidor (http/https) para jugar por internet.'));
      filas.push(btn('Crear sala de prueba (solo este navegador)', () => crearSala('loc')), i, btn('Unirme', () => { if (unirse(i.value)) msg.textContent = 'Conectando…'; }));
    } else {
      const nombres = net.snap.map(m => m.nombre + (m.cid === net.cid ? ' (tú)' : '')).join(', ');
      filas.push(txt((net.rol === 'host' ? 'Sala creada' : 'Sala unida') + (net.modo === 'ws' || net.modo === 'sb' ? ' (internet)' : ' (solo este navegador)') + ' · jugadores: ' + (nombres || '…')));
      if (net.rol === 'host' && net.url) {
        const c = document.createElement('canvas'), mx = qrMatriz(net.url), q = 4, z = 4; c.width = c.height = (mx.length + 2 * q) * z; c.id = 'qr';
        c.style.cssText = 'display:block;margin:8px auto;width:min(240px,100%);image-rendering:pixelated;background:#fff';
        const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.fillStyle = '#000'; mx.forEach((f, y) => f.forEach((v, x) => { if (v) g.fillRect((x + q) * z, (y + q) * z, z, z); }));
        filas.push(c, txt('Escanéalo o comparte el enlace (vale 10 min y 3 usos):'), txt(net.url),
          btn('Copiar enlace', async () => { try { await navigator.clipboard.writeText(net.url); msg.textContent = 'Enlace copiado'; } catch (e) { console.warn(e); msg.textContent = 'No se pudo copiar: selecciónalo a mano'; } }),
          btn('Nueva invitación (revoca la anterior)', () => net.conn.enviar({ t: 'invitar' })), btn('Cerrar sala para todos', () => { const id = net.sala?.id, m = net.modo; net.conn.enviar({ t: 'salir' }); salirRed(); if (m === 'sb' && id) cuenta.cliente().rpc('juego_sala_cerrar', { p_id: id }); panelMulti(); }));
      }
      filas.push(btn(net.rol === 'host' ? (net.modo === 'sb' ? 'Salir (podrás reanudar la sala desde Multijugador)' : 'Salir (la sala sigue abierta en el servidor)') : 'Salir de la sala', () => { if (net.rol !== 'host') net.conn.enviar({ t: 'salir' }); salirRed(); panelMulti(); }));
    }
    filas.push(btn('Volver', menu), msg); abrir('Multijugador', filas);
  }

  // ---------- sonido, tutorial, personaje, cuenta ----------
  function sonido(r) {
    const m = r.msg || '';
    if (r.fx === 'moneda') audio.tono(/Nivel/.test(m) ? 'nivel' : 'moneda'); else if (r.fx === 'ok') audio.tono('ok');
    else if (/^Pedido/.test(m)) audio.tono('pedido'); else if (/Sin stock|cuesta|ocupada|Ya llevas|Almacén/.test(m)) audio.tono('error');
  }
  const TXT = ['Espera un cliente y acércate a su silla: E toma el pedido', 'Ve a la ' + (cfg.estacion === 'cafetera' ? 'cafetera' : 'estufa') + ' y pulsa E para preparar', 'Pulsa E junto al plato listo para tomarlo', 'Lleva el plato al cliente y pulsa E', 'Ve a la caja y pulsa E para cobrar'];
  let paso = perfil.tutorial ? 99 : 0;
  function tutorial(r) {
    const m = r.msg || '';
    if (paso === 0 && /^Pedido/.test(m)) paso = 1; else if (paso === 1 && m === 'Preparando…') paso = 2; else if (paso === 2 && m === 'Llévalo al cliente') paso = 3; else if (paso === 3 && m === 'Servido') paso = 4;
    else if (paso === 4 && r.fx === 'moneda') { paso = 99; perfil.tutorial = true; store.guardarPerfil(perfil); aviso('¡Tutorial completo!'); }
  }
  const abrir = (titulo, filas) => { const box = $('tienda'), w = document.createElement('div'), h = document.createElement('h2'); box.hidden = false; tiendaAbierta = true; box.textContent = ''; h.textContent = titulo; panelActual = titulo; w.appendChild(h); filas.forEach(f => w.appendChild(f)); box.appendChild(w); };
  const btn = (t, f, dis) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.disabled = !!dis; b.onclick = f; return b; };
  const txt = t => { const p = document.createElement('p'); p.textContent = t; return p; };
  function menu() {
    audio.activar();
    abrir('Menú', [btn('Personaje', personaje), btn('Franquicias', panelFranq), btn('Multijugador', abrirMulti), btn('Cuenta y progreso', panelCuenta), btn(audio.on() ? 'Sonido: sí' : 'Sonido: no', () => { audio.alternar(); perfil.mute = !audio.on(); store.guardarPerfil(perfil); menu(); }), btn('Repetir tutorial', () => { paso = 0; perfil.tutorial = false; store.guardarPerfil(perfil); cerrarTienda(); }), btn('Cerrar', cerrarTienda)]);
  }
  $('menu').onclick = () => (tiendaAbierta ? cerrarTienda() : menu());
  // Cuenta real: se conecta al abrir el juego (también procesa el regreso de Google) y refresca el panel abierto cuando cambia la sesión.
  const refrescarCuenta = () => { if (tiendaAbierta && panelActual === 'Cuenta y progreso') panelCuenta(); else if (tiendaAbierta && panelActual === 'Multijugador') panelMulti(); };
  cuenta.onCambio?.(refrescarCuenta);
  cuenta.iniciar?.().then(() => { if (cuenta.pendienteUsername()) { menu(); panelCuenta(); } }).catch(e => console.warn('Cuentas no disponibles', e.message));
  function personaje() {
    const prev = document.createElement('canvas'); prev.width = prev.height = 32; prev.style.cssText = 'width:128px;height:128px;image-rendering:pixelated;display:block;margin:0 auto 8px';
    const g0 = ctx; ctx = prev.getContext('2d'); persona({ x: 1, y: 1.6, dir: 1 }, { ...jug(), mov: false }); ctx = g0;
    const filas = [prev], nv = nivelDisp();
    for (const [c, et] of [['piel', 'Piel'], ['pelo', 'Cabello'], ['ropa', 'Camisa'], ['gorro', 'Gorro']]) {
      const f = document.createElement('div'); f.className = 'fila';
      av[c].forEach((o, i) => { const sel = perfil.look[c] === o.id, bloq = o.nv > nv; f.appendChild(btn(`${et} ${i + 1}${sel ? ' ✓' : bloq ? ' 🔒Nv' + o.nv : ''}`, () => { perfil.look[c] = o.id; store.guardarPerfil(perfil); personaje(); }, bloq)); });
      filas.push(f);
    }
    filas.push(btn('Volver', menu)); abrir('Personaje · Nv ' + nv, filas);
  }
  function panelCuenta() {
    if (!cuenta.real) return panelCuentaSesion();
    if (!cuenta.listo()) { abrir('Cuenta y progreso', [txt('Conectando con tu cuenta…'), btn('Volver', menu)]); return; }
    if (cuenta.usuario()) return panelCuentaSesion();
    const enMarco = (() => { try { return self !== top; } catch (e) { return true; } })(), o = { txt, btn, refrescar: panelCuenta, enMarco };
    const filas = cuenta.sesion() ? [txt('Sesión: ' + (cuenta.email() || 'Google')), ...formUsuario(cuenta, o), btn('Salir de la sesión', () => cuenta.salir())] : formAcceso(cuenta, o);
    filas.push(btn('Volver', menu)); abrir('Cuenta y progreso', filas);
  }
  async function panelCuentaSesion() {
    const u = cuenta.usuario(), msg = txt(''), filas = [txt('Puedes jugar sin cuenta. Para conservar tu progreso de forma recuperable entre dispositivos, crea una cuenta.'), txt(cuenta.real ? 'Tu progreso se guarda en tu cuenta de PUVE y lo recuperas en cualquier dispositivo.' + (cuenta.conflicto?.() ? ' ⚠ Tu cuenta tiene un guardado más nuevo hecho desde otro dispositivo: usa «Cargar la partida de la cuenta».' : '') : 'Cuenta SIMULADA: solo vive en este navegador. La real llegará con la integración autorizada.')];
    if (!u) {
      const i = document.createElement('input'); i.maxLength = 16; i.placeholder = 'Nombre de usuario'; i.autocomplete = 'off'; i.style.cssText = 'width:100%;padding:10px;margin:6px 0;font:inherit';
      const fin = r => { if (r.ok) panelCuenta(); else msg.textContent = r.msg; };
      filas.push(i, btn('Crear cuenta', () => fin(cuenta.registrar(i.value.trim()))), btn('Entrar', () => fin(cuenta.entrar(i.value.trim()))));
    } else {
      const nvl = s => 1 + Math.floor(s.d.xp / 60);
      filas.push(txt('Sesión: ' + u),
        btn('Conservar mi progreso en la cuenta', async () => { congelar = false; await store.guardarPartida(giro, sim.serializar()); const r = await migrarLocalACuenta({ local: store, cuenta, giro, resolver: async (l, c) => confirm(`La cuenta ya tiene una partida (Nv ${nvl(c)}, $${c.d.dinero}).\n\nAceptar: reemplazarla con la local (Nv ${nvl(l)}, $${l.d.dinero}); la de la cuenta se respalda.\nCancelar: conservar la de la cuenta.`) ? 'local' : 'cuenta' }); if (r.ok && r.puedeBorrarLocal) { perfil.vinculo = { ...perfil.vinculo, [giro]: u }; await store.guardarPerfil(perfil); } msg.textContent = r.msg; }),
        btn('Cargar la partida de la cuenta', async () => { const c = await cuenta.cargarPartida(giro); if (!c) { msg.textContent = 'La cuenta no tiene partida de este giro'; return; } if (confirm(`Esto reemplaza tu partida local (queda un respaldo). Cuenta: Nv ${nvl(c)}, $${c.d.dinero}. ¿Continuar?`)) { congelar = true; await store.guardarPartida(giro, c); perfil.vinculo = { ...perfil.vinculo, [giro]: u }; await store.guardarPerfil(perfil); location.reload(); } }),
        btn('Salir de la sesión', () => { cuenta.salir(); panelCuenta(); }));
    }
    filas.push(btn('Volver', menu), msg); abrir('Cuenta y progreso', filas);
  }

  // ---------- bucle: paso fijo 1/60 con límite de recuperación ----------
  let last = performance.now(), acc = 0, tH = 0, tG = 0, frames = 0, fps = 0, tF = 0;
  const debug = /[?&#]debug=1/.test(location.href);
  function frame(now) {
    const dt = Math.min(.25, (now - last) / 1000); last = now;
    if (!tiendaAbierta) {
      if (pend) { pend = false; audio.activar(); const r = modo === 'ciudad' ? accionCiudad() : sim.accion(); aviso(r.msg); sonido(r); tutorial(r); if (r.tienda) tienda(); else if (r.fx) guardar(); }
      acc += dt; while (acc >= 1 / 60) { if (modo === 'ciudad') pasoCiudad(1 / 60, entrada()); else { sim.tick(1 / 60, entrada()); revisarPuerta(); } acc -= 1 / 60; }
    } else pend = false;
    red(dt);   // la presencia en la sala sigue activa aunque haya un menú abierto
    dibujar();
    tH -= dt; if (tH <= 0) { tH = .15; hud(); if (debug) $('pista').textContent += ` · ${fps} fps · ${sim.clientes.length} cli`; }
    tG += dt; if (tG > 5) { tG = 0; guardar(); }
    frames++; tF += dt; if (tF >= 1) { fps = frames; frames = 0; tF = 0; }
    requestAnimationFrame(frame);
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) guardar(); else last = performance.now(); });
  addEventListener('pagehide', () => { guardar(); salirRed(false); });
  const mh = location.hash.match(/sala=[0-9a-f]{12}\.[0-9a-f]{32}(?:&t=(?:ws|loc|sb))?/);
  iniciarSolo();
  if (mh) { history.replaceState(null, '', location.pathname + location.search); unirse(mh[0]); }   // el token sale de la barra de direcciones
  requestAnimationFrame(frame);
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js', { scope: './' }).catch(e => console.warn('Sin modo offline:', e));
  window.__juego = sim; window.__ciudad = { chunks, cp, remotos, eco, invertir, ocupa, get modo() { return modo; }, get net() { return net; }, get mundo() { return mundo; } };   // útil para diagnóstico; no expone secretos
}
iniciar();
