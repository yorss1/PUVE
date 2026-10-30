import { verificar, limpiarPartida } from './contrato.js';
const P = 'puvegame:';
export function crearLocal(st = localStorage) {
  const leer = k => { try { return JSON.parse(st.getItem(k)); } catch (e) { console.warn('Dato ilegible', k, e); return null; } };
  return verificar({
    nombre: 'local',
    async obtenerPerfil() { return leer(P + 'perfil') || {}; },
    async guardarPerfil(p) { st.setItem(P + 'perfil', JSON.stringify(p)); },
    async cargarPartida(giro) { return limpiarPartida(leer(`${P}${giro}:save`)) || limpiarPartida(leer(`${P}${giro}:save.bak`)); },
    async guardarPartida(giro, s) { const k = `${P}${giro}:save`, prev = st.getItem(k); if (prev) st.setItem(k + '.bak', prev); st.setItem(k, JSON.stringify(s)); },
    async borrarPartida(giro) { st.removeItem(`${P}${giro}:save`); st.removeItem(`${P}${giro}:save.bak`); },
    async registrarEvento(giro, ev) { const k = `${P}${giro}:libro`, l = leer(k) || []; l.push(ev); st.setItem(k, JSON.stringify(l.slice(-100))); }
  });
}
