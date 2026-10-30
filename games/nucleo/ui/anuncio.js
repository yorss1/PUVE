import { NUBE_CFG } from '../../nube-config.js';
// Tira de publicidad al fondo del juego (100% del ancho). Si no hay anuncios vigentes no existe: no ocupa espacio ni se ve.
// La lista viene de la base (los anuncios los programa el superadmin de PUVE: días, horario y duración); se vuelve a consultar cada minuto.
// Primero se pide a la Edge Function pedido-qr; si esa función no responde (por ejemplo no está desplegada), se pide directo a la base con la clave pública.
// Diagnóstico: abre el juego con ?ads=debug para ver arriba a la izquierda qué está pasando.
const OK_ARCHIVO = /^[0-9a-f-]{36}\.(png|jpg|webp|gif|mp4|webm)$/, vistos = new Map();
export function iniciarAnuncios({ demo = false } = {}) {
  if (demo || !NUBE_CFG.url) return;
  const el = document.createElement('div'); el.id = 'puvead'; el.hidden = true; el.setAttribute('role', 'complementary'); el.setAttribute('aria-label', 'Publicidad'); document.body.appendChild(el);
  const DEBUG = /[?&#]ads=debug/.test(location.href), dbg = {};
  const pintarDebug = () => {
    if (!DEBUG) return; let d = document.getElementById('puvead-debug');
    if (!d) { d = document.createElement('pre'); d.id = 'puvead-debug'; d.style.cssText = 'position:fixed;top:0;left:0;z-index:99;margin:0;padding:4px 6px;max-width:100%;white-space:pre-wrap;font:11px/1.3 monospace;color:#fff;background:#000c;pointer-events:none'; document.body.appendChild(d); }
    d.textContent = Object.entries(dbg).map(([k, v]) => k + ': ' + v).join('\n');
  };
  const base = NUBE_CFG.url + '/storage/v1/object/public/anuncios-juego/';
  let lista = [], firma = '', idx = 0, timer = 0;
  const mq = matchMedia('(max-width: 767px)'), esVideo = f => /\.(mp4|webm)$/.test(f), archivoDe = a => (mq.matches && a.archivo_movil) ? a.archivo_movil : a.archivo;   // en celular se usa la versión para celular si existe
  const api = body => fetch(NUBE_CFG.url + '/functions/v1/pedido-qr', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: NUBE_CFG.key, Authorization: 'Bearer ' + NUBE_CFG.key }, body: JSON.stringify(body) }).then(r => (r.ok ? r.json() : null)).catch(() => null);
  const directo = () => fetch(NUBE_CFG.url + '/rest/v1/rpc/juego_anuncios_activos', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: NUBE_CFG.key }, body: '{}' }).then(r => (r.ok ? r.json() : null)).catch(() => null);
  // Debe seguir siendo visible aunque el navegador tenga barras que cambian de tamaño (celulares, pestañas en carpeta, teclado): se pega al borde de lo que realmente se ve.
  const pegar = () => { const v = window.visualViewport; el.style.bottom = v ? Math.max(0, innerHeight - v.height - v.offsetTop) + 'px' : '0'; };
  window.visualViewport?.addEventListener('resize', pegar); window.visualViewport?.addEventListener('scroll', pegar); addEventListener('orientationchange', pegar);
  const fijar = () => { pegar(); document.documentElement.style.setProperty('--adh', (el.hidden ? 0 : el.offsetHeight) + 'px'); dispatchEvent(new Event('resize')); };
  function contar(a, tipo) { const k = a.id + tipo, t = vistos.get(k) || 0; if (Date.now() - t < 300000) return; vistos.set(k, Date.now()); api({ accion: 'juego_anuncio_evento', id: a.id, tipo }); }
  function mostrar(a) {
    el.textContent = '';
    const f = archivoDe(a), video = esVideo(f), m = document.createElement(video ? 'video' : 'img'), url = base + f;
    if (video) { m.src = url; m.muted = true; m.loop = true; m.autoplay = true; m.playsInline = true; m.setAttribute('playsinline', ''); m.preload = 'auto'; m.play?.().catch(() => {}); } else { m.src = url; m.alt = ''; m.decoding = 'async'; }
    dbg['mostrando'] = f + (video ? ' (video)' : ' (imagen)') + (mq.matches && a.archivo_movil ? ' [versión celular]' : ''); pintarDebug();
    m.onload = m.onloadeddata = () => { dbg['archivo'] = 'cargó OK'; pintarDebug(); fijar(); };
    m.onerror = () => { dbg['archivo'] = 'NO CARGÓ: ' + url; pintarDebug(); lista = lista.filter(x => x.id !== a.id); firma = ''; ciclo(); };
    let cont = m;
    if (a.enlace) { cont = document.createElement('a'); cont.href = a.enlace; cont.target = '_blank'; cont.rel = 'noopener noreferrer sponsored nofollow'; cont.appendChild(m); cont.onclick = () => contar(a, 'clic'); }
    const et = document.createElement('small'); et.textContent = 'Publicidad';
    el.append(cont, et); el.hidden = false; fijar(); contar(a, 'vista');
  }
  function ciclo() {
    clearTimeout(timer);
    if (!lista.length) { el.hidden = true; el.textContent = ''; fijar(); return; }
    const a = lista[idx % lista.length]; idx++; mostrar(a);
    if (lista.length > 1) timer = setTimeout(ciclo, Math.max(3, Math.min(300, a.duracion || 10)) * 1000);
  }
  async function refrescar() {
    let r = await api({ accion: 'juego_anuncios' }), via = 'función pedido-qr';
    if (!r || !Array.isArray(r.anuncios)) { const d = await directo(); r = d ? { anuncios: d } : null; via = 'directo a la base (la función no respondió)'; }
    if (!r) { dbg['consulta'] = 'ERROR: no hubo respuesta ni de la función ni de la base'; pintarDebug(); return; }
    const n = (Array.isArray(r.anuncios) ? r.anuncios : []).filter(a => a && /^[0-9a-f-]{36}$/.test(a.id) && OK_ARCHIVO.test(a.archivo) && (!a.archivo_movil || OK_ARCHIVO.test(a.archivo_movil)) && (a.tipo === 'imagen' || a.tipo === 'video') && (!a.enlace || /^https:\/\//.test(a.enlace)));
    dbg['consulta'] = 'OK por ' + via; dbg['vigentes ahora'] = n.length + (n.length ? '' : '  (ninguno está en horario ahora: revisa día, hora y zona horaria)'); pintarDebug();
    const f = n.map(a => a.id + a.archivo + (a.archivo_movil || '') + a.duracion).join('|'); if (f === firma) return;
    firma = f; lista = n; idx = 0; ciclo();
  }
  mq.addEventListener?.('change', () => { if (lista.length) { idx = Math.max(0, idx - 1); ciclo(); } });   // al girar el celular o cambiar de tamaño, cambia de versión
  refrescar(); setInterval(refrescar, 60000);
}
