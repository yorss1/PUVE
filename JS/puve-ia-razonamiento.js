/* PUVE IA · Motor de razonamiento empresarial (Etapa 4 del plan de arquitectura; motor propio, SIN IA externa)
 * Funciones puras (no leen datos, no tocan pantalla): reciben números que entregan las herramientas y devuelven conclusiones medibles.
 *  · ¿El cambio es real o cabe en lo normal de tus días?  (z contra la variación diaria; da una confianza 0–1)
 *  · Descomposición exacta: ventas = operaciones × ticket  →  cuánto del cambio es «menos gente» y cuánto «cada quien gastó menos».
 *  · Contribuciones: cuánto del cambio explica cada producto, hora, día, forma de pago o cajero (suman exactamente el cambio total).
 *  · Anomalías (días raros, días sin ventas) con estadística robusta, tendencias y confianza por conclusión.
 * Regla del MD §17–18: separar HECHO · EVIDENCIA · HIPÓTESIS · RECOMENDACIÓN, y no convertir una hipótesis en hecho:
 * una causa que no se puede comprobar con los datos (p. ej. «el precio causó la baja») nunca pasa de confianza baja (tope 40%).
 */
(function(){
  'use strict';
  const suma = (a, f) => a.reduce((s, x) => s + (f ? f(x) : x || 0), 0);
  const prom = (a) => a.length ? suma(a) / a.length : 0;
  const mediana = (a) => { if(!a.length) return 0; const s = a.slice().sort((x, y) => x - y), m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const desv = (a) => { if(a.length < 2) return 0; const m = prom(a); return Math.sqrt(suma(a, (x) => (x - m) * (x - m)) / (a.length - 1)); };
  const mad = (a) => { const m = mediana(a); return mediana(a.map((x) => Math.abs(x - m))); };
  const acota = (x, a, b) => Math.min(b, Math.max(a, x));
  // erf (Abramowitz-Stegun 7.1.26): suficiente para convertir un z en una confianza
  function erf(x){ const s = x < 0 ? -1 : 1, t = 1 / (1 + 0.3275911 * Math.abs(x)); const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return s * y; }
  const pDosColas = (z) => 1 - erf(Math.abs(z) / Math.SQRT2);

  // ¿el cambio de promedio diario cabe en lo normal? Devuelve z y una confianza (1 − p) de que el cambio sea real.
  function esReal(o){
    const dA = Math.max(1, o.diasAct), dB = Math.max(1, o.diasAnt), sigma = o.sigmaDia;
    const mA = o.totalAct / dA, mB = o.totalAnt / dB;
    if(!(sigma > 0)) return { z: Math.abs(mA - mB) > 0 ? 9 : 0, confianza: Math.abs(mA - mB) > 0 ? 0.99 : 0, real: Math.abs(mA - mB) > 0, sigmaDia: 0, normalPorDia: 0 };
    const z = (mA - mB) / (sigma * Math.sqrt(1 / dA + 1 / dB)), conf = acota(1 - pDosColas(z), 0, 0.999);
    return { z, confianza: conf, real: conf >= 0.8, sigmaDia: sigma, normalPorDia: sigma };
  }
  // ventas = operaciones × ticket → Δ = (n1−n0)·t0 + (t1−t0)·n1  (la suma da exactamente el cambio)
  function descomponer(n0, t0, n1, t1){
    const volumen = (n1 - n0) * t0, ticket = (t1 - t0) * n1, total = n1 * t1 - n0 * t0;
    return { volumen, ticket, total, dominante: Math.abs(volumen) >= Math.abs(ticket) ? 'volumen' : 'ticket', parteVolumen: total ? volumen / total : 0, parteTicket: total ? ticket / total : 0 };
  }
  // cuánto del cambio total explica cada parte (solo cuenta lo que va en la misma dirección que el total)
  const explica = (delta, total) => total && delta * total > 0 ? acota(Math.abs(delta) / Math.abs(total), 0, 1) : 0;
  function concentracion(filas, total, k){
    const mismas = filas.filter((f) => f.delta * total > 0).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    return { top: mismas.slice(0, k || 2), parte: total ? acota(suma(mismas.slice(0, k || 2), (f) => Math.abs(f.delta)) / Math.abs(total), 0, 1) : 0 };
  }
  // horas seguidas que se mueven en la misma dirección que el total → franjas («de 5 a 8 p. m.»)
  function franjas(filasHora, total){
    const max = Math.max(0, ...filasHora.map((f) => Math.abs(f.delta))), umbral = max * 0.25, out = []; let cur = null;
    filasHora.slice().sort((a, b) => a.h - b.h).forEach((f) => {
      const va = f.delta * total > 0 && Math.abs(f.delta) >= umbral && Math.abs(f.delta) > 0;
      if(va && cur && f.h === cur.fin + 1){ cur.fin = f.h; cur.delta += f.delta; }
      else if(va){ cur = { ini: f.h, fin: f.h, delta: f.delta }; out.push(cur); }
      else cur = null;
    });
    return out.map((b) => Object.assign(b, { parte: explica(b.delta, total) })).sort((a, b) => b.parte - a.parte);
  }
  // días raros (mediana y MAD: no se dejan engañar por un día extremo); los días sin ventas se marcan aparte
  function anomalias(serie, umbral){
    const v = serie.filter((x) => x.total > 0).map((x) => x.total), med = mediana(v), s = 1.4826 * mad(v) || desv(v) || 1, out = [];
    serie.forEach((x) => {
      if(x.total <= 0) out.push({ fecha: x.fecha, total: 0, esperado: med, z: -Infinity, tipo: 'sin_ventas' });
      else { const z = (x.total - med) / s; if(Math.abs(z) >= (umbral || 3)) out.push({ fecha: x.fecha, total: x.total, esperado: med, z, tipo: z > 0 ? 'alto' : 'bajo' }); }
    });
    return { mediana: med, sigma: s, dias: out };
  }
  // tendencia por mínimos cuadrados (pendiente por periodo y qué tan bien se ajusta)
  function tendencia(y){
    const n = y.length; if(n < 3) return null;
    const mx = (n - 1) / 2, my = prom(y); let sxy = 0, sxx = 0, syy = 0;
    y.forEach((v, i) => { sxy += (i - mx) * (v - my); sxx += (i - mx) * (i - mx); syy += (v - my) * (v - my); });
    const b = sxx ? sxy / sxx : 0, r2 = sxx && syy ? (sxy * sxy) / (sxx * syy) : 0;
    return { pendiente: b, pctPorPeriodo: my ? b / my : 0, r2, direccion: Math.abs(b) < 0.01 * (my || 1) || r2 < 0.3 ? 'estable' : (b > 0 ? 'sube' : 'baja'), media: my };
  }
  // confianza de una causa: ¿es real el cambio? × ¿cuánto del cambio explica? × ¿hay muestra suficiente? (con tope según qué tan comprobable es la causa)
  const TOPES = { hecho: 0.95, dato: 0.9, causal: 0.4 };   // «el precio causó la baja» no se puede comprobar sin una prueba: tope 40%
  function confianzaCausa(o){
    const real = acota(o.real, 0, 1), parte = acota(o.explica, 0, 1), muestra = acota(o.muestra == null ? 1 : o.muestra, 0, 1);
    return acota(Math.sqrt(real) * (0.4 + 0.6 * parte) * (0.5 + 0.5 * muestra), 0, TOPES[o.tipo || 'dato']);
  }
  const nivel = (c) => c >= 0.85 ? 'alta' : (c >= 0.65 ? 'media-alta' : (c >= 0.45 ? 'media' : (c >= 0.25 ? 'baja' : 'muy baja')));
  const muestraDe = (n) => acota(n / 30, 0, 1);

  window.PuveIaRazonamiento = { suma, prom, mediana, desv, mad, acota, erf, pDosColas, esReal, descomponer, explica, concentracion, franjas, anomalias, tendencia, confianzaCausa, nivel, muestraDe, TOPES };
})();
