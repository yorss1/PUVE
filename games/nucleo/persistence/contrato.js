// Contrato de persistencia: el juego solo conoce estos métodos. Local, cuenta simulada y Supabase los implementan igual.
export const METODOS = ['obtenerPerfil', 'guardarPerfil', 'cargarPartida', 'guardarPartida', 'borrarPartida', 'registrarEvento'];
export function verificar(impl) { for (const m of METODOS) if (typeof impl[m] !== 'function') throw new Error('Falta ' + m); return impl; }
// Solo estos campos viajan entre almacenes; cualquier otro se descarta.
export function limpiarPartida(s) {
  if (!s || s.v !== 1 || !s.d || typeof s.d !== 'object') return null;
  const n = k => (Number.isFinite(s.d[k]) ? s.d[k] : 0);
  return { v: 1, ts: Number.isFinite(s.ts) ? s.ts : 0, d: { dinero: n('dinero'), xp: n('xp'), rep: n('rep'), stock: n('stock'), comp: Array.isArray(s.d.comp) ? s.d.comp.filter(x => typeof x === 'string').slice(0, 50) : [] }, px: Number.isFinite(s.px) ? s.px : 1.5, py: Number.isFinite(s.py) ? s.py : 1.5 };
}
