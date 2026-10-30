// Contrato de persistencia: el juego solo conoce estos métodos. Local, cuenta simulada y Supabase los implementan igual.
export const METODOS = ['obtenerPerfil', 'guardarPerfil', 'cargarPartida', 'guardarPartida', 'borrarPartida', 'registrarEvento'];
export function verificar(impl) { for (const m of METODOS) if (typeof impl[m] !== 'function') throw new Error('Falta ' + m); return impl; }
// Solo estos campos viajan entre almacenes; cualquier otro se descarta.
export function limpiarPartida(s) {
  if (!s || s.v !== 1 || !s.d || typeof s.d !== 'object') return null;
  const n = k => (Number.isFinite(s.d[k]) ? s.d[k] : 0);
  const d = { dinero: n('dinero'), xp: n('xp'), rep: n('rep'), stock: n('stock'), comp: Array.isArray(s.d.comp) ? s.d.comp.filter(x => typeof x === 'string').slice(0, 50) : [] };
  // Campos de la Fase 2 (opcionales: una partida anterior sigue siendo válida). Se acotan aquí y se validan otra vez al cargar en la simulación.
  const num = x => (Number.isFinite(x) ? x : 0), cad = (x, m) => (typeof x === 'string' ? x.slice(0, m) : '');
  if (s.d.st && typeof s.d.st === 'object') d.st = Object.fromEntries(Object.keys(s.d.st).slice(0, 12).filter(k => /^[a-z]{2,12}$/.test(k)).map(k => [k, num(s.d.st[k])]));
  if (typeof s.d.prov === 'string') d.prov = cad(s.d.prov, 20);
  if (Array.isArray(s.d.ramas)) d.ramas = s.d.ramas.filter(x => typeof x === 'string').map(x => x.slice(0, 20)).slice(0, 12);
  if (Array.isArray(s.d.plantilla)) d.plantilla = s.d.plantilla.slice(0, 6).filter(e => e && typeof e === 'object').map(e => ({ mid: cad(e.mid, 20), n: cad(e.n, 16), hab: num(e.hab), exp: num(e.exp), sat: num(e.sat), sueldo: num(e.sueldo), ger: e.ger === true }));
  return { v: 1, ts: Number.isFinite(s.ts) ? s.ts : 0, d, px: Number.isFinite(s.px) ? s.px : 1.5, py: Number.isFinite(s.py) ? s.py : 1.5 };
}
