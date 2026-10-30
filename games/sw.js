// Service worker del juego: alcance /games/ únicamente. No toca pedir.html, cocina.html, puve.html ni otros orígenes.
const C = 'puvegame-v9';
const NUCLEO = ['restaurante.html', 'cafeteria.html', 'nucleo/ui/juego.css', 'nucleo/game/main.js', 'nube-config.js', 'nucleo/persistence/nube.js', 'nucleo/persistence/sb.js', 'nucleo/persistence/cuenta-supabase.js', 'nucleo/multiplayer/transporte-supabase.js', 'nucleo/ui/cuenta-ui.js', 'nucleo/ui/anuncio.js', 'nucleo/game/sim.js', 'nucleo/game/audio.js', 'nucleo/game/sprites.js', 'nucleo/world/ciudad.js', 'nucleo/multiplayer/sala.js', 'nucleo/multiplayer/mundo.js', 'nucleo/game/paneles.js', 'nucleo/economia/mercado.js', 'nucleo/economia/rivales.js', 'nucleo/economia/ramas.js', 'nucleo/economia/progresion.js', 'nucleo/multiplayer/servidor.js', 'nucleo/multiplayer/transporte-ws.js', 'nucleo/multiplayer/transporte-local.js', 'nucleo/multiplayer/qr.js', 'nucleo/config/sprites.json', 'nucleo/persistence/contrato.js', 'nucleo/persistence/local.js', 'nucleo/persistence/cuenta-simulada.js', 'nucleo/persistence/migracion.js', 'nucleo/config/avatares.json', 'nucleo/config/restaurante.json', 'nucleo/config/cafeteria.json'];
self.addEventListener('install', e => e.waitUntil(caches.open(C).then(c => c.addAll(NUCLEO)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(n => n.startsWith('puvegame-') && n !== C).map(n => caches.delete(n)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || !u.pathname.startsWith(new URL('./', location).pathname)) return;
  e.respondWith(fetch(e.request).then(r => { if (r.ok) { const cp = r.clone(); caches.open(C).then(c => c.put(e.request, cp)); } return r; }).catch(() => caches.match(e.request)));
});
