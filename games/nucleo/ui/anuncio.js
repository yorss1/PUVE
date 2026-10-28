import { NUBE_CFG } from '../../nube-config.js';
// Tira de publicidad al fondo del juego (100% del ancho). Si no hay anuncios vigentes no existe: no ocupa espacio ni se ve.
// La lista viene de la base (los anuncios los programa el superadmin de PUVE: días, horario y duración); se vuelve a consultar cada minuto.
const OK_ARCHIVO = /^[0-9a-f-]{36}\.(png|jpg|webp|gif|mp4|webm)$/, vistos = new Map();
export function iniciarAnuncios({ demo = false } = {}) {
  if (demo || !NUBE_CFG.url) return;
  const el = document.createElement('div'); el.id = 'puvead'; el.hidden = true; el.setAttribute('role', 'complementary'); el.setAttribute('aria-label', 'Publicidad'); document.body.appendChild(el);
  const base = NUBE_CFG.url + '/storage/v1/object/public/anuncios-juego/';
  let lista = [], firma = '', idx = 0, timer = 0;
  const mq = matchMedia('(max-width: 767px)'), esVideo = f => /\.(mp4|webm)$/.test(f), archivoDe = a => (mq.matches && a.archivo_movil) ? a.archivo_movil : a.archivo;   // en celular se usa la versión para celular si existe
  const api = body => fetch(NUBE_CFG.url + '/functions/v1/pedido-qr', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: NUBE_CFG.key, Authorization: 'Bearer ' + NUBE_CFG.key }, body: JSON.stringify(body) }).then(r => (r.ok ? r.json() : null)).catch(() => null);
  const fijar = () => { document.documentElement.style.setProperty('--adh', (el.hidden ? 0 : el.offsetHeight) + 'px'); dispatchEvent(new Event('resize')); };
  function contar(a, tipo) { const k = a.id + tipo, t = vistos.get(k) || 0; if (Date.now() - t < 300000) return; vistos.set(k, Date.now()); api({ accion: 'juego_anuncio_evento', id: a.id, tipo }); }
  function mostrar(a) {
    el.textContent = '';
    const f = archivoDe(a), video = esVideo(f), m = document.createElement(video ? 'video' : 'img'), url = base + f;
    if (video) { m.src = url; m.muted = true; m.loop = true; m.autoplay = true; m.playsInline = true; m.setAttribute('playsinline', ''); m.preload = 'auto'; m.play?.().catch(() => {}); } else { m.src = url; m.alt = ''; m.decoding = 'async'; }
    m.onload = m.onloadeddata = fijar; m.onerror = () => { lista = lista.filter(x => x.id !== a.id); firma = ''; ciclo(); };
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
    const r = await api({ accion: 'juego_anuncios' }); if (!r) return;
    const n = (Array.isArray(r.anuncios) ? r.anuncios : []).filter(a => a && /^[0-9a-f-]{36}$/.test(a.id) && OK_ARCHIVO.test(a.archivo) && (!a.archivo_movil || OK_ARCHIVO.test(a.archivo_movil)) && (a.tipo === 'imagen' || a.tipo === 'video') && (!a.enlace || /^https:\/\//.test(a.enlace)));
    const f = n.map(a => a.id + a.archivo + (a.archivo_movil || '') + a.duracion).join('|'); if (f === firma) return;
    firma = f; lista = n; idx = 0; ciclo();
  }
  mq.addEventListener?.('change', () => { if (lista.length) { idx = Math.max(0, idx - 1); ciclo(); } });   // al girar el celular o cambiar de tamaño, cambia de versión
  refrescar(); setInterval(refrescar, 60000);
}
