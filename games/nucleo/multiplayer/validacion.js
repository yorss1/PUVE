// Validación en servidor del restaurante propio y de las etapas de la campaña (PURO).
// El restaurante se simula en el navegador y no se puede reproducir en el servidor; lo que SÍ se puede es acotarlo:
// el cliente reporta totales acumulados y el servidor solo acepta lo que es verosímil para el tiempo REAL transcurrido
// (tasas máximas por segundo, holgadas frente a lo que logra un jugador ideal: ver herramientas/equilibrio.mjs).
// El dinero que sale del restaurante hacia las franquicias (`invertir`) solo puede venir de ganancias aceptadas: `credito`.
import { etapaActual, DESBLOQUEOS } from '../economia/progresion.js';
export const TASA_DINERO = 45, TASA_XP = 10, TASA_SERV = 2;     // máximos por segundo real (un jugador ideal logra ~10 $/s, ~1.5 xp/s, ~0.3 pedidos/s)
export const HOLGURA_S = 5, DT_MAX = 300, CREDITO_INICIAL = 1500, SEMANA_S = 600;
export const nuevoLoc = () => ({ ganado: 0, xp: 0, servidos: 0, tiempo: 0, semanas: 0, ts: null, credito: CREDITO_INICIAL, ult: { ganado: 0, xp: 0, servidos: 0, tiempo: 0, semanas: 0 }, sospechas: 0, reportes: 0 });
const cuenta = x => Number.isFinite(x) && x >= 0 && x <= 1e12;
export function limpiarLoc(l) {
  const r = nuevoLoc(); if (!l || typeof l !== 'object') return r; const n = (x, d = 0) => (cuenta(x) ? x : d);
  for (const k of ['ganado', 'xp', 'servidos', 'tiempo', 'semanas']) { r[k] = Math.floor(n(l[k])); r.ult[k] = Math.floor(n(l.ult?.[k])); }
  r.credito = Math.floor(n(l.credito, CREDITO_INICIAL)); r.sospechas = Math.floor(n(l.sospechas)); r.reportes = Math.floor(n(l.reportes)); r.ts = Number.isFinite(l.ts) ? l.ts : null; return r;
}
// op 'local': el cliente declara sus totales; devuelve lo aceptado
export function reportarLocal(m, p, msg) {
  const L = p.loc || (p.loc = nuevoLoc()), claim = {}, K = ['ganado', 'xp', 'servidos', 'tiempo', 'semanas'];
  for (const k of K) { if (!Number.isSafeInteger(msg[k]) || msg[k] < 0 || msg[k] > 1e12) return { ok: false, msg: 'Reporte inválido' }; claim[k] = msg[k]; }
  const ahora = m.ahora(); L.reportes++;
  if (L.ts == null) { L.ts = ahora; for (const k of K) L.ult[k] = claim[k]; return { ok: true, msg: 'Base registrada', aceptado: 0 }; }   // primer reporte: solo línea base
  const dt = Math.min(DT_MAX, Math.max(0, (ahora - L.ts) / 1000)) + HOLGURA_S; L.ts = ahora;
  const lim = { ganado: TASA_DINERO * dt, xp: TASA_XP * dt, servidos: TASA_SERV * dt, tiempo: dt, semanas: Math.ceil(dt / SEMANA_S) };
  let acepto = 0, sospecha = false;
  for (const k of K) {
    const d = claim[k] - L.ult[k]; L.ult[k] = claim[k];
    if (d <= 0) continue;                               // retroceso (partida distinta o reinicio): se vuelve a tomar como línea base, sin crédito
    const ok = Math.min(d, Math.floor(lim[k])); if (d > lim[k] * 1.5 + 50) sospecha = true;
    L[k] += ok; if (k === 'ganado') { L.credito += ok; acepto = ok; }
  }
  if (sospecha) L.sospechas++;
  return { ok: true, msg: sospecha ? 'Parte del reporte no es verosímil y se descartó' : 'Reporte aceptado', aceptado: acepto, sospecha };
}
export const nivelLocal = loc => 1 + Math.floor(loc.xp / 60);          // misma fórmula que Sim.nivel
// Etapa de campaña calculada SOLO con datos que el servidor conoce o ha acotado
export function etapaServidor(m, p) {
  const L = p.loc || nuevoLoc(); let gerentesF = 0; for (const o of m.o.values()) if (o.dueno === p.cid && o.tipo === 'franquicia' && o.ger) gerentesF++;
  return etapaActual({ semanas: L.semanas, nivel: nivelLocal(L), servidos: L.servidos, franq: m._franq(p.cid), patrimonio: m.patrimonio(p), gerentesF, puesto: 0, jugadores: 1, ramasCadena: p.ramas.length }).n;
}
const REQ = { ajustar: msg => (msg.esp ? 'especialidad' : null), proveedor: msg => (msg.contrato === true ? 'contratos' : msg.prov && msg.prov !== 'mercado' ? 'proveedores' : null), gerente: msg => (msg.accion === 'despedir' ? null : 'gerente'), rama: () => 'ramasCadena' };
// Puerta: devuelve un fallo si la operación exige una etapa que el jugador todavía no tiene
export function puerta(m, p, msg) {
  const f = REQ[msg.op]; const id = f ? f(msg) : null; if (!id) return null;
  const e = etapaServidor(m, p.soc ? m.j.get(p.soc.fundador) || p : p); if (e >= DESBLOQUEOS[id]) return null;
  return { ok: false, msg: `Se desbloquea en la etapa ${DESBLOQUEOS[id]} de la campaña (vas en la ${e})` };
}
