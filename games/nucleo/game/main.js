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
    const S = coarse && vert ? (adh ? Math.min(innerWidth / cv.width, (innerHeight - 64 - 150 - adh) / cv.height) : innerWidth / cv.width) : Math.max(1, Math.floor(Math.min(innerWidth / cv.width, (innerHeight - 64 - adh - (coarse && innerHeight >= 520 ? 150 : 0)) / cv.height)));
    cv.style.width = cv.width * S + 'px'; cv.style.height = cv.height * S + 'px';
  }
  addEventListener('resize', ajustar); addEventListener('orientationchange', ajustar); ajustar();
  const vv = window.visualViewport, vvh = () => document.documentElement.style.setProperty('--vvh', (vv ? vv.height : innerHeight) + 'px');   // los menús se miden contra lo que realmente se ve (barras del navegador, teclado)
  vv?.addEventListener('resize', vvh); addEventListener('resize', vvh); vvh();

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
    ctx.drawImage(fondo, 0, 0); camX = cx; camY = 0; ventanas();
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
  // ---------- piezas de los menús (todo se dibuja con estos bloques para que se vea igual en todo el juego) ----------
  const el = (tag, cls, t) => { const e = document.createElement(tag); if (cls) e.className = cls; if (t != null) e.textContent = t; return e; };
  const txt = (t, cls) => el('p', 'nota' + (cls ? ' ' + cls : ''), t);
  const btn = (t, f, dis, cls) => { const b = el('button', 'b' + (cls ? ' ' + cls : ''), t); b.type = 'button'; b.disabled = !!dis; b.onclick = f; return b; };
  const sec = (titulo, ...hijos) => { const s = el('section', 'sec'); if (titulo) s.appendChild(el('h3', '', titulo)); hijos.forEach(h => h && s.appendChild(h)); return s; };
  const stat = (l, v) => { const f = el('div', 'stat'); f.append(el('span', '', l), el('b', '', v)); return f; };
  const chip = (t, cls) => el('span', 'chip' + (cls ? ' ' + cls : ''), t);
  const TAM_SPR = { moneda: 8, globo_pedido: 12, globo_espera: 14, silla: 16, tablero: 16, caja: 16, refri: 16, mesa: 16 };
  function icono(n, texto) {   // icono pixel: un sprite del juego, un personaje armado por capas o un símbolo
    const i = el('span', 'ico');
    if (texto) { i.classList.add('txt'); i.textContent = texto; }
    else if (Array.isArray(n)) { i.classList.add('av'); i.style.setProperty('--im', n.map(c => `url(${new URL(`sprites/comun/${c}.png`, location.href).href})`).join(',')); }   // ruta completa: dentro de una variable CSS la ruta se mediría desde el .css
    else if (TAM_SPR[n]) { const w = TAM_SPR[n] * Math.max(1, Math.floor(36 / TAM_SPR[n])); i.style.backgroundImage = `url(sprites/comun/${n}.png)`; i.style.backgroundSize = `${w}px ${w}px`; }
    return i;
  }
  // Ventana de menú: título arriba (con ‹ atrás y X), contenido que se desplaza por dentro y nunca se sale de la pantalla.
  const abrir = (titulo, filas, { atras = menu, clave } = {}) => {
    const box = $('tienda'), mismo = tiendaAbierta && panelActual === (clave || titulo), pos = mismo ? box.querySelector('.pcuerpo')?.scrollTop : 0;
    const w = el('div', 'panel'), cab = el('div', 'pcab'), cu = el('div', 'pcuerpo');
    w.setAttribute('role', 'dialog'); w.setAttribute('aria-label', titulo);
    if (atras) { const a = btn('<', atras, false, 'mini suave'); a.setAttribute('aria-label', 'Atrás'); cab.appendChild(a); }
    const x = btn('X', cerrarTienda, false, 'mini peligro'); x.setAttribute('aria-label', 'Cerrar');
    cab.append(el('h2', '', titulo), x); filas.forEach(f => f && cu.appendChild(f)); w.append(cab, cu);
    box.textContent = ''; box.appendChild(w); box.hidden = false; tiendaAbierta = true; panelActual = clave || titulo; document.body.classList.add('menu-abierto'); cu.scrollTop = pos || 0;
  };
  function cerrarTienda() { $('tienda').hidden = true; tiendaAbierta = false; panelActual = ''; document.body.classList.remove('menu-abierto'); }

  function tienda(m = '') {   // mejoras del negocio (tablero)
    const msg = txt(m, 'msg'), estado = el('div', 'estado'), lista = [];
    estado.appendChild(chip('Tu dinero: $' + sim.d.dinero, 'ok'));
    for (const u of cfg.mejoras) {
      const ya = sim.d.comp.includes(u.id), b = btn('', () => { const r = sim.comprar(u.id); if (r.ok) guardar(); tienda(r.msg); }, ya, 'suave up');
      b.append(el('span', '', u.n), el('span', '', ya ? 'Comprada' : '$' + u.costo + (sim.nivel < u.nivel ? ` · Nv ${u.nivel}` : ''))); lista.push(b);
    }
    abrir('Mejoras', [estado, sec('Mejoras del negocio', txt('Compra mesas y ayudantes para atender a más clientes.'), ...lista), msg], { atras: null });
  }

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
    const cx0 = Math.round(cp.x * T - cv.width / 2), cy0 = Math.round(cp.y * T - cv.height / 2), tam = CH * T; camX = cx0; camY = cy0;
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
  // ---------- luz y ambiente según la hora real de quien juega (para probar otra hora: ?hora=21) ----------
  const hp = parseFloat(QS.get('hora')), HORA_FIJA = Number.isFinite(hp) ? ((hp % 24) + 24) % 24 : null;
  const horaActual = () => { if (HORA_FIJA != null) return HORA_FIJA; const d = new Date(); return d.getHours() + d.getMinutes() / 60; };
  // [hora, R, G, B, oscuridad, sol]: color del ambiente, cuánto oscurece y cuánto sol entra por las ventanas
  const CIELO = [[0, 16, 20, 56, .6, 0], [5, 22, 26, 66, .56, 0], [6.5, 140, 80, 90, .3, .15], [8, 255, 190, 120, .1, .6], [10, 255, 245, 225, 0, .9], [15, 255, 245, 225, 0, .9], [17.5, 255, 190, 110, .12, .6], [19, 210, 90, 70, .34, .2], [20.5, 30, 28, 72, .5, 0], [24, 16, 20, 56, .6, 0]];
  function cielo(h) { for (let i = 1; i < CIELO.length; i++) if (h <= CIELO[i][0]) { const a = CIELO[i - 1], b = CIELO[i], k = (h - a[0]) / (b[0] - a[0] || 1); return [1, 2, 3, 4, 5].map(j => a[j] + (b[j] - a[j]) * k); } return CIELO[0].slice(1); }
  const mezcla = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const luzC = document.createElement('canvas'), luzG = luzC.getContext('2d');
  let camX = 0, camY = 0, fijas = [], fijasVer = -1;
  const escalones = (g, x, y, r, n = 4) => { for (let i = 0; i < n; i++) { g.beginPath(); g.arc(x, y, r * (1 - i / n), 0, 6.3); g.fill(); } };   // la luz cae en escalones: se ve como pixel art
  function posVentanas() { const xs = [], g0 = sim.g[0]; for (const f of [.17, .56, .84]) { const x = Math.round(sim.W * f); if (g0[x] === '#' && g0[x - 1] === '#' && g0[x + 1] === '#') xs.push(x); } return xs; }
  function ventanas() {   // ventanas del muro de arriba: el cielo cambia con la hora
    const c = cielo(horaActual()), cristal = mezcla([18, 24, 58], mezcla([150, 205, 235], c.slice(0, 3), 1 - c[4]), Math.min(1, c[4] * 1.6));
    for (const x of posVentanas()) {
      const px = x * T; R(P.wd, px + 2, 1, 12, 11); R('rgb(' + cristal + ')', px + 3, 2, 10, 9);
      if (c[4] < .1) { R('#fff', px + 5, 4, 1, 1); R('#fff', px + 10, 3, 1, 1); R('#fff', px + 9, 8, 1, 1); } else R('#ffffff55', px + 4, 3, 3, 1);
      R(P.wd, px + 7, 2, 1, 9); R(P.wd, px + 3, 6, 10, 1); R(P.wl, px + 1, 11, 14, 2); R('#0003', px + 1, 13, 14, 1);
    }
  }
  function iluminar() {
    const W = cv.width, H = cv.height, h = horaActual(), c = cielo(h), osc = Math.min(.66, c[3] * 1.12), sol = c[4], ahora = performance.now(), interior = modo !== 'ciudad';
    const lampF = Math.max(0, Math.min(1, (osc - .04) / .3)), L = [];   // lampF: qué tan encendidas están las lámparas
    if (interior) {
      if (fijasVer !== sim.ver) { fijas = []; for (let y = 0; y < sim.H; y++) for (let x = 0; x < sim.W; x++) { const ch = sim.g[y][x]; if ('tRFvm'.includes(ch)) fijas.push({ ch, x, y }); } fijasVer = sim.ver; }
      for (const f of fijas) {
        const sx = f.x * T - camX, sy = f.y * T - camY; if (sx < -48 || sx > W + 48) continue;
        if (f.ch === 't') L.push({ x: sx + 8, y: sy + 8, r: 3.1 * T, c: [255, 176, 80], a: 1, lamp: true });
        else if (f.ch === 'R') L.push({ x: sx + 8, y: sy + 6, r: 1.8 * T, c: [190, 255, 200], a: .55 });
        else if (f.ch === 'F') L.push({ x: sx + 8, y: sy + 8, r: 1.7 * T, c: [170, 210, 255], a: .4 });
        else if (f.ch === 'v') L.push({ x: sx + 8, y: sy + 8, r: 1.9 * T, c: [255, 225, 160], a: .55 });
      }
      for (const e of sim.est) { const t = e.tk && sim.tk(e.tk), cocina = t && t.estado === 'cocinando', fl = 1 + .12 * Math.sin(ahora / 90 + e.x * 7); L.push({ x: e.x * T + 8 - camX, y: e.y * T + 8 - camY, r: (cocina ? 3.3 : 1.9) * T * fl, c: cocina ? [255, 140, 40] : [255, 205, 130], a: cocina ? 1.1 : .5 }); }
    } else {
      const gx0 = Math.floor(camX / T) - 1, gy0 = Math.floor(camY / T) - 1, gx1 = gx0 + Math.ceil(W / T) + 2, gy1 = gy0 + Math.ceil(H / T) + 2;
      for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) { if (chunks.tile(gx, gy) === 'l') L.push({ x: gx * T + 8 - camX, y: gy * T + 3 - camY, r: 4.4 * T, c: [255, 200, 110], a: 1, lamp: true }); }
    }
    ctx.save();
    // 1) reflejos y rayos de sol (suman luz antes de oscurecer)
    ctx.globalCompositeOperation = 'lighter';
    if (interior) {
      if (sol > .05) { const dx = (h - 12.5) * 5, a = sol * .11; for (const x of posVentanas()) { const px = x * T + 2 - camX; for (const [k, aa] of [[1, a], [.55, a * .8]]) { ctx.fillStyle = `rgba(255,236,170,${aa})`; ctx.beginPath(); const m = 6 - 6 * k + 0; ctx.moveTo(px + m, T); ctx.lineTo(px + 12 - m, T); ctx.lineTo(px + 12 - m + dx + 8, T + 66); ctx.lineTo(px + m + dx - 4, T + 66); ctx.fill(); } } }
      const pulso = (x, p) => .5 + .5 * Math.sin(ahora / 700 + x * 2.3 + p);
      for (const f of fijas) {
        const sx = f.x * T - camX, sy = f.y * T - camY; if (sx < -16 || sx > W) continue;
        if (f.ch === 't') { ctx.fillStyle = `rgba(255,238,190,${.16 + .1 * pulso(f.x, f.y)})`; ctx.fillRect(sx + 3, sy + 4, 7, 1); ctx.fillRect(sx + 3, sy + 5, 2, 1); }
        else if (f.ch === 'm') { ctx.fillStyle = 'rgba(255,238,190,.2)'; ctx.fillRect(sx, sy + 3, T, 1); }
        else if (f.ch === 'F') { ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(sx + 3, sy + 2, 1, 10); }
        else if (f.ch === 'v') { const q = ((ahora / 1000 + f.x) % 4) < .5 ? .65 : .22; ctx.fillStyle = `rgba(255,255,255,${q})`; ctx.fillRect(sx + 3, sy + 4, 1, 1); ctx.fillRect(sx + 4, sy + 5, 1, 1); ctx.fillRect(sx + 5, sy + 6, 1, 1); ctx.fillRect(sx + 9, sy + 4, 1, 1); }
      }
      for (const e of sim.est) { const t = e.tk && sim.tk(e.tk); if (t && t.estado === 'cocinando') { ctx.fillStyle = `rgba(255,150,50,${.3 + .2 * Math.sin(ahora / 80 + e.x)})`; ctx.fillRect(e.x * T + 4 - camX, e.y * T + 4 - camY, 8, 5); } }
    } else if (osc > .12) {   // ventanas encendidas de los edificios por la noche
      const gx0 = Math.floor(camX / T) - 1, gy0 = Math.floor(camY / T) - 1;
      ctx.fillStyle = `rgba(255,205,100,${.5 * lampF})`;
      for (let gy = gy0; gy <= gy0 + Math.ceil(H / T) + 2; gy++) for (let gx = gx0; gx <= gx0 + Math.ceil(W / T) + 2; gx++) { if (chunks.tile(gx, gy) === 'H' && (gx + gy) % 2 && 'HPp'.includes(chunks.tile(gx, gy - 1))) { const px = gx * T - camX, py = gy * T - camY; ctx.fillRect(px + 3, py + 4, 4, 5); ctx.fillRect(px + 9, py + 4, 4, 5); } }
    }
    // 2) oscuridad del ambiente, con huecos donde hay luz
    ctx.globalCompositeOperation = 'source-over';
    if (osc > .015) {
      if (luzC.width !== W || luzC.height !== H) { luzC.width = W; luzC.height = H; }
      luzG.globalCompositeOperation = 'source-over'; luzG.clearRect(0, 0, W, H); luzG.fillStyle = `rgba(${Math.round(c[0] * .35)},${Math.round(c[1] * .35)},${Math.round(c[2] * .5)},${osc})`; luzG.fillRect(0, 0, W, H);
      luzG.globalCompositeOperation = 'destination-out';
      for (const l of L) { const k = l.lamp ? lampF : 1; if (k <= .01) continue; luzG.fillStyle = `rgba(0,0,0,${Math.min(.34, .22 * l.a * k)})`; escalones(luzG, l.x, l.y, l.r); }
      ctx.drawImage(luzC, 0, 0);
    }
    // 3) brillo cálido de las luces
    ctx.globalCompositeOperation = 'lighter';
    for (const l of L) { const k = l.lamp ? lampF : (.35 + .65 * Math.min(1, osc / .3)); if (k <= .01) continue; ctx.fillStyle = `rgba(${l.c[0]},${l.c[1]},${l.c[2]},${.042 * l.a * k})`; escalones(ctx, l.x, l.y, l.r); }
    ctx.globalCompositeOperation = 'source-over';
    // 4) calidez general y viñeta
    ctx.fillStyle = 'rgba(255,170,90,.05)'; ctx.fillRect(0, 0, W, H);
    const v = ctx.createRadialGradient(W / 2, H / 2, H * .3, W / 2, H / 2, Math.hypot(W, H) * .55); v.addColorStop(0, 'rgba(18,8,4,0)'); v.addColorStop(1, `rgba(18,8,4,${.34 + osc * .25})`); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  function dibujar() { if (modo === 'ciudad') dibujarCiudad(); else dibujarInterior(); iluminar(); }
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
    const o = ocupa.get(l.id), mio = o && o.cid === net?.cid, msg = txt('', 'msg'), info = mundo.lotes.find(x => x[0] === l.id), inv = info?.[4] || 0;
    let comp = 0; for (const [id] of ocupa) if (id !== l.id) { const q = loteDe(chunks.seed, id); if (q && Math.hypot(q.puerta.x - l.puerta.x, q.puerta.y - l.puerta.y) <= RADIO) comp++; }
    const dueno = () => mundo.jugadores.find(j => j.cid === o.cid)?.nombre || 'otro jugador';
    const hacer = (op, ok) => async () => { const r = await eco(op, { lote: l.id }); msg.textContent = r.msg; if (r.ok) { audio.tono('moneda'); if (ok) ok(); } else audio.tono('error'); };
    const acc = [];
    if (!o) acc.push(txt(`Este lote está libre. Cuesta $${precioLote(l)}.`), btn(`Abrir franquicia ($${precioLote(l)})`, hacer('comprar'), mundo.mio.dinero < precioLote(l), 'primario'));
    else if (o.tipo === 'h') acc.push(txt(mio ? 'Este es tu restaurante. Se juega por dentro y no se puede vender.' : `Restaurante de ${dueno()}. Compite contigo por los clientes de la zona.`));
    else if (mio) { const c = costoMejora(l, o.nivel), g = Math.round(.7 * (precioLote(l) + inv)); acc.push(stat('Nivel', `${o.nivel}/5`), stat(`Ingreso cada turno (${TURNO_MS / 1000} s)`, `$${mundo.mio.ingresos[l.id] ?? '…'}`), btn(o.nivel >= 5 ? 'Nivel máximo' : `Mejorar a nivel ${o.nivel + 1} ($${c})`, hacer('mejorar'), o.nivel >= 5 || mundo.mio.dinero < c, 'primario'), btn(`Vender (recibes $${g})`, hacer('vender', cerrarTienda), false, 'peligro')); }
    else acc.push(txt(`Franquicia de ${dueno()} · nivel ${o.nivel}. Todavía no se puede comprar a otro jugador.`));
    abrir('Lote ' + l.id, [sec('Datos del lote', stat('Clientes que pasan', `${trafico(l)}/10`), stat('Competidores cerca', String(comp)), stat('Tu cuenta de franquicias', `$${mundo.mio.dinero}`)), sec(!o ? 'Disponible' : mio ? 'Tu franquicia' : 'Ocupado', ...acc), msg], { atras: null, clave: 'Lote' });
  }
  function panelFranq() {
    const msg = txt('', 'msg'), m = mundo?.mio, filas = [];
    if (!m) filas.push(txt('Conectando con el servidor…'));
    else {
      const ir = x => async () => { const r = await invertir(x); msg.textContent = r.msg; audio.tono(r.ok ? 'moneda' : 'error'); if (r.ok) panelFranq(); };
      filas.push(sec('Tu dinero', stat('Dinero de tu negocio', `$${sim.d.dinero}`), stat('Cuenta de franquicias', `$${m.dinero}`), stat('Cupo para invertir', `$${m.cupo}`)),
        sec('Invertir', txt('Pasa dinero de tu negocio a tu cuenta de franquicias para comprar lotes en la ciudad.'), (() => { const f = el('div', 'fila'); f.append(btn('$100', ir(100), false, 'primario'), btn('$500', ir(500), false, 'primario'), btn('Todo', ir(1e9), false, 'primario')); return f; })()),
        sec('Ranking', ...mundo.jugadores.map((j, i) => stat(`${i + 1}. ${j.nombre}${j.cid === net.cid ? ' (tú)' : ''}`, `$${j.patrimonio} · ${j.franq}/${MAX_FRANQ}`)), txt('Se ordena por patrimonio. A la derecha: dinero y franquicias abiertas.')));
      const mias = mundo.lotes.filter(l => l[1] === net.cid && l[3] === 'f');
      filas.push(sec('Tus franquicias', ...(mias.length ? mias.map(l => stat(`Lote ${l[0]} · nivel ${l[2]}`, `$${m.ingresos[l[0]] ?? '…'}/turno`)) : [txt('Aún no tienes. Sal a la ciudad y pulsa E frente a un lote libre (rótulo amarillo).')])));
      if (m.eventos.length) filas.push(sec('Últimos eventos', ...m.eventos.map(e => txt(e))));
      filas.push(txt(`Cada ${TURNO_MS / 1000} s hay un turno y se reparten las ganancias (turno ${mundo.turno}).`));
    }
    filas.push(msg); abrir('Franquicias', filas);
  }
  function panelMulti() {
    const msg = txt('', 'msg'), filas = [], real = !!cuenta.real, ok = real && cuenta.sesion() && cuenta.usuario(), enSala = net && net.modo !== 'solo', internet = net && (net.modo === 'ws' || net.modo === 'sb');
    const estado = el('div', 'estado'); estado.appendChild(chip(enSala ? (internet ? 'En una sala por internet' : 'En una sala de prueba') : 'Jugando solo', enSala ? 'ok' : '')); if (estadoRed) estado.appendChild(chip(estadoRed, 'warn')); filas.push(estado);
    if (!enSala) {
      filas.push(txt('Juega con amigos en la misma ciudad: cada quien tiene su negocio y compiten por lotes y clientes.'));
      const web = location.protocol.startsWith('http'), crear = [];
      if (real) crear.push(...(ok ? [txt('Crea una sala y comparte el enlace o el código QR. Tus amigos también necesitan su cuenta.'), btn('Crear sala por internet', () => crearSala('sb'), false, 'primario')] : [txt('Para jugar por internet primero inicia sesión.'), btn('Iniciar sesión', panelCuenta, false, 'primario')]));
      else crear.push(txt(web ? 'Requiere abrir el juego desde el servidor: node nucleo/herramientas/servidor_nodo.mjs' : 'Abre el juego desde un servidor (http/https) para jugar por internet.'), btn('Crear sala en el servidor', () => crearSala('ws'), !web, 'primario'));
      filas.push(sec('Crear una sala', ...crear));
      if (real && misSalas?.length) filas.push(sec('Mis salas guardadas', txt('Continúa una sala que creaste antes.'), ...misSalas.map(x => btn('Reanudar sala ' + x.id.slice(0, 4).toUpperCase(), () => reanudarSala(x.id), false, 'suave'))));
      const i = el('input', 'in'); i.placeholder = 'Pega aquí el enlace de invitación'; i.autocomplete = 'off';
      filas.push(sec('Unirme a una sala', txt('Pega el enlace que te mandó tu amigo.'), i, btn('Unirme', () => { if (unirse(i.value)) msg.textContent = 'Conectando…'; }, false, 'primario')));
      filas.push(sec('Modo de prueba', txt('Una sala que solo existe en este navegador, para probar con dos pestañas.'), btn('Crear sala de prueba', () => crearSala('loc'), false, 'suave')));
    } else {
      const jugadores = el('div', 'estado'); net.snap.forEach(p => jugadores.appendChild(chip(p.nombre + (p.cid === net.cid ? ' (tú)' : ''), p.cid === net.cid ? 'ok' : ''))); if (!net.snap.length) jugadores.appendChild(chip('Conectando…'));
      filas.push(sec('Tu sala', stat('Tipo', internet ? 'Por internet' : 'Solo este navegador'), stat('Tu papel', net.rol === 'host' ? 'Anfitrión' : 'Invitado'), txt('Jugadores:'), jugadores));
      if (net.rol === 'host' && net.url) {
        const c = el('canvas', 'qr'), mx = qrMatriz(net.url), q = 4, z = 4; c.width = c.height = (mx.length + 2 * q) * z; c.id = 'qr';
        c.style.cssText = 'display:block;margin:8px auto;width:min(240px,100%);image-rendering:pixelated;background:#fff';
        const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.fillStyle = '#000'; mx.forEach((f, y) => f.forEach((v, x) => { if (v) g.fillRect((x + q) * z, (y + q) * z, z, z); }));
        const enlace = el('input', 'in'); enlace.value = net.url; enlace.readOnly = true; enlace.onfocus = () => enlace.select();
        filas.push(sec('Invitar amigos', c, txt('Que escaneen el código o les compartes el enlace. Vale 10 minutos y 3 usos.'), enlace,
          btn('Copiar enlace', async () => { try { await navigator.clipboard.writeText(net.url); msg.textContent = 'Enlace copiado'; } catch (e) { console.warn(e); enlace.select(); msg.textContent = 'No se pudo copiar solo: ya quedó seleccionado, cópialo a mano'; } }, false, 'primario'),
          btn('Generar enlace nuevo', () => net.conn.enviar({ t: 'invitar' }), false, 'suave'), txt('El enlace anterior deja de funcionar.')));
      }
      const salir = btn('Salir de la sala', () => { if (net.rol !== 'host') net.conn.enviar({ t: 'salir' }); salirRed(); panelMulti(); }, false, 'suave');
      filas.push(sec('Terminar', salir, txt(net.rol !== 'host' ? 'Volverás a jugar solo.' : net.modo === 'sb' ? 'Podrás reanudarla después desde «Mis salas guardadas».' : 'La sala sigue abierta en el servidor.'),
        ...(net.rol === 'host' ? [btn('Cerrar sala para todos', () => { const id = net.sala?.id, m = net.modo; net.conn.enviar({ t: 'salir' }); salirRed(); if (m === 'sb' && id) cuenta.cliente().rpc('juego_sala_cerrar', { p_id: id }); panelMulti(); }, false, 'peligro')] : [])));
    }
    filas.push(msg); abrir('Multijugador', filas);
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
  function menu() {
    audio.activar();
    const it = (ic, t, d, f) => { const b = el('button', 'b mi'); b.type = 'button'; b.onclick = f; b.append(ic, el('span', 'mt', t), el('span', 'md', d)); return b; };
    abrir('Menú', [
      it(icono(capasJug(perfil.look)), 'Personaje', 'Cambia tu piel, cabello, camisa y gorro', personaje),
      it(icono('moneda'), 'Franquicias', 'Invierte y abre negocios en la ciudad', panelFranq),
      it(icono('globo_espera'), 'Multijugador', 'Juega con amigos por internet', abrirMulti),
      it(icono('tablero'), 'Cuenta y progreso', 'Guarda tu partida y sigue desde cualquier lugar', panelCuenta),
      it(icono(null, audio.on() ? '♪' : 'x'), 'Sonido: ' + (audio.on() ? 'activado' : 'apagado'), 'Toca para ' + (audio.on() ? 'apagarlo' : 'encenderlo'), () => { audio.alternar(); perfil.mute = !audio.on(); store.guardarPerfil(perfil); menu(); }),
      it(icono('globo_pedido'), 'Repetir tutorial', 'Vuelve a ver cómo se juega', () => { paso = 0; perfil.tutorial = false; store.guardarPerfil(perfil); cerrarTienda(); }),
      btn('Seguir jugando', cerrarTienda, false, 'primario')], { atras: null });
  }
  $('menu').onclick = () => (tiendaAbierta ? cerrarTienda() : menu());
  // Cuenta real: se conecta al abrir el juego (también procesa el regreso de Google) y refresca el panel abierto cuando cambia la sesión.
  const refrescarCuenta = () => { if (tiendaAbierta && panelActual === 'Cuenta y progreso') panelCuenta(); else if (tiendaAbierta && panelActual === 'Multijugador') panelMulti(); };
  cuenta.onCambio?.(refrescarCuenta);
  cuenta.iniciar?.().then(() => { if (cuenta.pendienteUsername()) { menu(); panelCuenta(); } }).catch(e => console.warn('Cuentas no disponibles', e.message));
  function personaje() {
    const prev = el('canvas', 'prev'); prev.width = prev.height = 32;
    const g0 = ctx; ctx = prev.getContext('2d'); persona({ x: 1, y: 1.6, dir: 1 }, { ...jug(), mov: false }); ctx = g0;
    const filas = [prev], nv = nivelDisp();
    for (const [c, et] of [['piel', 'Piel'], ['pelo', 'Cabello'], ['ropa', 'Camisa'], ['gorro', 'Gorro']]) {
      const f = el('div', 'fila');
      av[c].forEach((o, i) => {
        const sel = perfil.look[c] === o.id, bloq = o.nv > nv, b = btn('', () => { perfil.look[c] = o.id; store.guardarPerfil(perfil); personaje(); }, bloq, 'sw' + (sel ? ' sel' : ''));
        b.setAttribute('aria-label', `${et} ${i + 1}${sel ? ' (elegido)' : bloq ? ' (bloqueado hasta el nivel ' + o.nv + ')' : ''}`);
        if (c === 'gorro') b.textContent = o.id ? String(i) : 'Sin'; else { const m = el('i', 'muestra'); m.style.background = o.c; b.appendChild(m); }
        if (bloq) b.appendChild(el('small', '', 'Nv ' + o.nv)); f.appendChild(b);
      });
      filas.push(sec(et, f));
    }
    filas.push(txt(`Nivel ${nv}: al subir de nivel se desbloquean más colores y gorros.`)); abrir('Personaje', filas);
  }
  function panelCuenta() {
    if (!cuenta.real) return panelCuentaSesion();
    if (!cuenta.listo()) { abrir('Cuenta y progreso', [txt('Conectando con tu cuenta…')]); return; }
    if (cuenta.usuario()) return panelCuentaSesion();
    const enMarco = (() => { try { return self !== top; } catch (e) { return true; } })(), o = { txt, btn, sec, refrescar: panelCuenta, enMarco };
    const filas = cuenta.sesion() ? [sec('Elige tu usuario', chip('Sesión: ' + (cuenta.email() || 'Google'), 'ok'), ...formUsuario(cuenta, o)), btn('Salir de la sesión', () => cuenta.salir(), false, 'suave')] : formAcceso(cuenta, o);
    abrir('Cuenta y progreso', filas);
  }
  async function panelCuentaSesion() {
    const u = cuenta.usuario(), msg = txt('', 'msg'), filas = [];
    if (!u) {
      const i = el('input', 'in'); i.maxLength = 16; i.placeholder = 'Nombre de usuario'; i.autocomplete = 'off';
      const fin = r => { if (r.ok) panelCuenta(); else msg.textContent = r.msg; };
      filas.push(txt('Puedes jugar sin cuenta. Si creas una, tu progreso se queda guardado y lo recuperas en otro dispositivo.'), txt(cuenta.real ? '' : 'Cuenta de prueba: solo vive en este navegador.', 'warn'),
        sec('Tu cuenta', i, btn('Crear cuenta', () => fin(cuenta.registrar(i.value.trim())), false, 'primario'), btn('Entrar', () => fin(cuenta.entrar(i.value.trim())), false, 'suave')));
    } else {
      const nvl = s => 1 + Math.floor(s.d.xp / 60), conflicto = cuenta.real && cuenta.conflicto?.();
      filas.push(sec('Tu cuenta', chip('Usuario: ' + u, 'ok'), txt(cuenta.real ? 'Tu progreso se guarda en tu cuenta de PUVE y lo recuperas en cualquier dispositivo.' : 'Cuenta de prueba: solo vive en este navegador.')),
        conflicto ? txt('⚠ Tu cuenta tiene un guardado más nuevo, hecho desde otro dispositivo. Usa «Cargar la partida de mi cuenta».', 'warn') : null,
        sec('Guardado',
          btn('Guardar mi progreso en la cuenta', async () => { congelar = false; await store.guardarPartida(giro, sim.serializar()); const r = await migrarLocalACuenta({ local: store, cuenta, giro, resolver: async (l, c) => confirm(`La cuenta ya tiene una partida (Nv ${nvl(c)}, $${c.d.dinero}).\n\nAceptar: reemplazarla con la local (Nv ${nvl(l)}, $${l.d.dinero}); la de la cuenta se respalda.\nCancelar: conservar la de la cuenta.`) ? 'local' : 'cuenta' }); if (r.ok && r.puedeBorrarLocal) { perfil.vinculo = { ...perfil.vinculo, [giro]: u }; await store.guardarPerfil(perfil); } msg.textContent = r.msg; }, false, 'primario'),
          btn('Cargar la partida de mi cuenta', async () => { const c = await cuenta.cargarPartida(giro); if (!c) { msg.textContent = 'La cuenta no tiene partida de este negocio'; return; } if (confirm(`Esto reemplaza tu partida de este dispositivo (queda un respaldo). Cuenta: Nv ${nvl(c)}, $${c.d.dinero}. ¿Continuar?`)) { congelar = true; await store.guardarPartida(giro, c); perfil.vinculo = { ...perfil.vinculo, [giro]: u }; await store.guardarPerfil(perfil); location.reload(); } }, false, 'suave')),
        btn('Cerrar sesión', () => { cuenta.salir(); panelCuenta(); }, false, 'peligro'));
    }
    filas.push(msg); abrir('Cuenta y progreso', filas);
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
