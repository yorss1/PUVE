// Cliente de Supabase para las cuentas y las salas del juego. Se carga solo cuando hace falta (CDN fijado a una versión).
// Usa su PROPIO almacenamiento de sesión (puvegame-auth): entrar al juego NO inicia sesión en la app de PUVE ni al revés.
import { NUBE_CFG } from '../../nube-config.js';
const SRC = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.4/dist/umd/supabase.js';
let prom = null;
export function clienteSB() {
  if (!prom) prom = new Promise((ok, mal) => {
    const crear = () => ok(window.supabase.createClient(NUBE_CFG.url, NUBE_CFG.key, {
      auth: { storageKey: 'puvegame-auth', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      realtime: { params: { eventsPerSecond: 30 } }
    }));
    if (window.supabase?.createClient) return crear();
    const s = document.createElement('script'); s.src = SRC; s.onload = crear;
    s.onerror = () => { prom = null; mal(new Error('No se pudo cargar el servicio de cuentas')); };
    document.head.appendChild(s);
  });
  return prom;
}
