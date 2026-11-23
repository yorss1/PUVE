/* PUVE IA · Motor de DECISIÓN: la ruta ÓPTIMA de crecimiento (Etapa 27; motor propio, SIN IA externa: todo se calcula aquí con los datos del negocio)
 * Qué hace: no da una lista de ideas; ELIGE entre ellas. Genera las acciones posibles con tus números (pedir lo que se acaba, subir un precio, empujar lo que deja
 * mucho, liberar dinero parado, recortar un gasto, negociar un costo, combos…), estima el efecto de cada una como un RANGO (no como una cifra), y busca la
 * combinación que maximiza el CRECIMIENTO GEOMÉTRICO esperado de tu ganancia mensual (criterio de Kelly: E[log(ganancia_t / ganancia_hoy)] descontado en el tiempo),
 * con tu capital y tu tiempo como límites. No es «la más rápida» (que apuesta todo a lo que rinde pronto) ni «la más segura» (que no arriesga nada): es la que más crece
 * a lo largo del horizonte, porque el logaritmo castiga el riesgo exactamente cuando amenaza tu crecimiento futuro.
 * Cómo: (1) muestras comunes de la incertidumbre (con un factor de mercado compartido: las acciones no son independientes); (2) búsqueda EXACTA entre todas las
 * combinaciones factibles (hasta 15 acciones; con más, ascenso local); (3) además calcula la ruta más rápida y la más segura para comparar; (4) ordena los pasos
 * por semanas respetando tu tiempo y lo que libera dinero primero; (5) dice hasta cuánto puede fallar cada estimación antes de que deje de convenir.
 * Reglas del MD §17–18: HECHO (tus números) · HIPÓTESIS (lo que supone cada acción, a la vista) · RECOMENDACIÓN. Nunca promete: da rangos y probabilidades.
 * Se carga después de puve-ia-asesor-contexto.js y se engancha con PuveResumen.registrarTemas. El núcleo (optimizar) es puro y se prueba solo (pruebas/prueba_decision.js).
 */
(function(){
  'use strict';
  const OPC = { horizonte: 6, descuento: 0.015, costoCapital: 0.015, muestras: 160, rho: 0.3, rhoGrupo: 0.5, semilla: 20261120, piso: 0.05, maxExhaustivo: 14 };   // piso: caer a 5% de tu ganancia de hoy se trata como casi la ruina (log = -3): así una apuesta grande pero muy dispersa no se ve «buena» solo porque el lado malo se recorta
  const suma = (a, f) => a.reduce((s, x) => s + (f ? f(x) : x || 0), 0);
  const acota = (x, a, b) => Math.min(b, Math.max(a, x));
  function rng(seed){ let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function normal(r){ let u = 0; while(u === 0) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); }

  // ---------- 1) NÚCLEO: preparar muestras, evaluar combinaciones, buscar la óptima ----------
  // candidato: { id, grupo, efecto:{media,sd} (pesos/mes en régimen), inicio (días hasta rendir), duracion (meses, null = permanente), capital, recup (0..1 que vuelve), recDias,
  //              costoUnico, esfuerzo (h/sem), pFalla, perdidaFalla, conflicto:[ids], requiere:[ids], libera (pesos que libera) }
  // grupo: las acciones del mismo grupo (p. ej. todos los cambios de precio) comparten parte de su riesgo (si tus clientes resienten una alza, resienten todas) y
  // su evento de fallo; restr.maxGrupo limita cuántas haces a la vez (se cambia poco, se mide, se sigue).
  function perfil(c, H){
    const ini = (c.inicio || 0) / 30, fin = c.duracion == null ? Infinity : ini + c.duracion, p = new Float64Array(H);
    for(let t = 0; t < H; t++){ const a = Math.max(t, ini), b = Math.min(t + 1, fin); p[t] = acota(b - a, 0, 1); }
    return p;
  }
  function preparar(cands, B, opc){
    const H = opc.horizonte, S = opc.muestras, n = cands.length, r = rng(opc.semilla), zc = new Float64Array(S);
    for(let s = 0; s < S; s++) zc[s] = normal(r);
    const grupos = {}; cands.forEach((c) => { if(c.grupo && !grupos[c.grupo]) grupos[c.grupo] = { z: Float64Array.from({ length: S }, () => normal(r)), u: Float64Array.from({ length: S }, () => r()) }; });
    const w = new Float64Array(H); let sw = 0; for(let t = 0; t < H; t++){ w[t] = Math.pow(1 - opc.descuento, t); sw += w[t]; }
    const E = [], K = [], rg = opc.rhoGrupo == null ? 0.5 : opc.rhoGrupo;
    cands.forEach((c) => {
      const e = new Float64Array(S * H), k = new Float64Array(H), rp = perfil(c, H), G = c.grupo ? grupos[c.grupo] : null;
      for(let s = 0; s < S; s++){
        const zi = normal(r), ui = r(), z = G ? Math.sqrt(opc.rho) * zc[s] + Math.sqrt(rg) * G.z[s] + Math.sqrt(Math.max(0, 1 - opc.rho - rg)) * zi : Math.sqrt(opc.rho) * zc[s] + Math.sqrt(1 - opc.rho) * zi, u = G ? G.u[s] : ui;
        let ef = c.efecto.media + c.efecto.sd * z; if(c.pFalla && u < c.pFalla) ef = -Math.abs(c.efecto.media) * (c.perdidaFalla == null ? 0.5 : c.perdidaFalla);
        for(let t = 0; t < H; t++) e[s * H + t] = ef * rp[t];
      }
      const cap = c.capital || 0, rec = c.recup == null ? 1 : c.recup, dias = c.recDias || 30;
      for(let t = 0; t < H; t++) k[t] = cap * opc.costoCapital * (rec >= 1 ? Math.min(1, dias / 30) : 1);
      k[0] += cap * (1 - rec) + (c.costoUnico || 0);
      E.push(e); K.push(k);
    });
    return { H, S, n, B, w, sw, E, K, piso: opc.piso, ids: cands.map((c) => c.id) };
  }
  const agrega = (P, X, i, signo, f) => { const { H, S, E, K } = P, e = E[i], k = K[i], m = f == null ? 1 : f; for(let s = 0; s < S; s++){ const o = s * H; for(let t = 0; t < H; t++) X[o + t] += signo * (m * e[o + t] - k[t]); } };
  function Jlog(P, X){ const { H, S, B, w, sw, piso } = P; let acc = 0; for(let s = 0; s < S; s++){ const o = s * H; for(let t = 0; t < H; t++){ const v = 1 + X[o + t] / B; acc += w[t] * Math.log(v > piso ? v : piso); } } return acc / (S * sw); }
  function evaluar(P, set, mult){ const X = new Float64Array(P.S * P.H); set.forEach((i) => agrega(P, X, i, 1, mult && mult[i] != null ? mult[i] : 1)); return X; }
  const puntuaciones = {
    optimo: (P) => (X) => Jlog(P, X),
    rapido: (P) => (X) => { let a = 0; for(let s = 0; s < P.S; s++) for(let t = 0; t < Math.min(2, P.H); t++) a += X[s * P.H + t]; return a / P.S; },
    seguro: (P) => (X) => { const tot = []; for(let s = 0; s < P.S; s++){ let a = 0; for(let t = 0; t < P.H; t++) a += X[s * P.H + t]; tot.push(a); } tot.sort((x, y) => x - y); const k = Math.max(1, Math.floor(P.S * 0.1)); let c = 0; for(let q = 0; q < k; q++) c += tot[q]; return c / k; }
  };
  function factible(cands, set, restr){
    let cap = 0, lib = 0, esf = 0; const ids = new Set(set.map((i) => cands[i].id)), cuenta = {};
    for(const i of set){ const c = cands[i]; cap += c.capital || 0; lib += c.libera || 0; esf += c.esfuerzo || 0; if(c.grupo) cuenta[c.grupo] = (cuenta[c.grupo] || 0) + 1; for(const q of (c.requiere || [])) if(!ids.has(q)) return false; for(const q of (c.conflicto || [])) if(ids.has(q)) return false; }
    for(const g in cuenta) if(restr.maxGrupo && restr.maxGrupo[g] != null && cuenta[g] > restr.maxGrupo[g]) return false;
    return cap <= restr.capital + lib + 1e-9 && esf <= restr.esfuerzo + 1e-9;
  }
  const chocaCon = (cands, i, set) => set.some((j) => (cands[i].conflicto || []).indexOf(cands[j].id) >= 0 || (cands[j].conflicto || []).indexOf(cands[i].id) >= 0);
  // UNA pasada exacta por todas las combinaciones factibles evaluando varias puntuaciones a la vez: { nombre: función(X) }
  function buscarExacto(P, cands, restr, punts){
    const n = cands.length, X = new Float64Array(P.S * P.H), nombres = Object.keys(punts), mejor = {}; nombres.forEach((k) => { mejor[k] = { p: 0, set: [] }; });   // la combinación vacía vale 0
    const set = [], cuenta = {};
    (function rec(i, esf){
      if(i === n){ if(set.length && factible(cands, set, restr)){ nombres.forEach((k) => { const p = punts[k](X); if(p > mejor[k].p + 1e-12) mejor[k] = { p, set: set.slice() }; }); } return; }
      rec(i + 1, esf);
      const c = cands[i]; if(esf + (c.esfuerzo || 0) > restr.esfuerzo + 1e-9 || chocaCon(cands, i, set)) return;
      if(c.grupo && restr.maxGrupo && restr.maxGrupo[c.grupo] != null && (cuenta[c.grupo] || 0) + 1 > restr.maxGrupo[c.grupo]) return;
      set.push(i); if(c.grupo) cuenta[c.grupo] = (cuenta[c.grupo] || 0) + 1; agrega(P, X, i, 1); rec(i + 1, esf + (c.esfuerzo || 0)); agrega(P, X, i, -1); if(c.grupo) cuenta[c.grupo]--; set.pop();
    })(0, 0);
    return mejor;
  }
  // ascenso local iterado (más de maxExhaustivo acciones): mejora con movimientos (agregar con lo que requiere, quitar, intercambiar, pares), y luego sacude la mejor
  // (quita 2 al azar) y vuelve a mejorar varias veces con una semilla fija: así sale de mínimos locales sin salirse de lo determinista
  function buscarLocal(P, cands, restr, punt){
    const n = cands.length, idxDe = (id) => cands.findIndex((c) => c.id === id), val = (set) => (set.length ? punt(evaluar(P, set)) : 0), r = rng(97);
    const mejorar = (ini) => {
      let set = ini.slice(), p = val(set), mejora = true, guarda = 0;
      while(mejora && guarda++ < 60){
        mejora = false; let top = null;
        const prueba = (s2) => { if(!s2.length || !factible(cands, s2, restr)) return; const q = val(s2); if(q > p + 1e-12 && (!top || q > top.q)) top = { s2, q }; };
        for(let i = 0; i < n; i++){ if(set.indexOf(i) >= 0) continue; const g = [i].concat((cands[i].requiere || []).map(idxDe).filter((k) => k >= 0 && set.indexOf(k) < 0)); prueba(set.concat(g)); }
        for(let a = 0; a < set.length; a++){ const sin = set.filter((_, k) => k !== a); if(sin.length) prueba(sin); for(let i = 0; i < n; i++){ if(set.indexOf(i) >= 0) continue; prueba(sin.concat([i])); } }
        { const fuera = []; for(let i = 0; i < n; i++) if(set.indexOf(i) < 0) fuera.push(i);   // también pares (agregar dos, o quitar uno y poner dos), siempre: un par puede ganarle a cualquier movimiento simple
          for(let x = 0; x < fuera.length; x++) for(let y = x + 1; y < fuera.length; y++){ prueba(set.concat([fuera[x], fuera[y]])); for(let a = 0; a < set.length; a++) prueba(set.filter((_, k) => k !== a).concat([fuera[x], fuera[y]])); }
        }
        if(top){ set = top.s2; p = top.q; mejora = true; }
      }
      return { p, set };
    };
    const solo = cands.map((c, i) => ({ i, v: val([i]) })).sort((x, y) => y.v - x.v), inicios = [[]];
    [3, 5].forEach((k) => { const s0 = []; solo.forEach((x) => { if(s0.length < k && x.v > 0 && factible(cands, s0.concat([x.i]), Object.assign({}, restr, { capital: 1e15 }))) s0.push(x.i); }); if(s0.length && factible(cands, s0, restr)) inicios.push(s0); });
    let mejor = { p: 0, set: [] };
    inicios.forEach((ini) => { const m = mejorar(ini); if(m.p > mejor.p + 1e-12) mejor = m; });
    for(let k = 0; k < 14 && mejor.set.length > 1; k++){   // sacudidas
      const s0 = mejor.set.slice(); for(let q = 0; q < Math.min(2, s0.length - 1); q++) s0.splice(Math.floor(r() * s0.length), 1);
      const m = mejorar(s0); if(m.p > mejor.p + 1e-12) mejor = m;
    }
    return mejor;
  }
  function buscar(P, cands, restr, punts, exacto){
    if(exacto) return buscarExacto(P, cands, restr, punts);
    const o = {}; Object.keys(punts).forEach((k) => { o[k] = buscarLocal(P, cands, restr, punts[k]); }); return o;
  }
  function estadisticas(P, set){
    const X = evaluar(P, set), { S, H, B } = P, fin = [], tot = []; let c2 = 0;
    for(let s = 0; s < S; s++){ fin.push(X[s * H + H - 1]); let a = 0; for(let t = 0; t < H; t++){ a += X[s * H + t]; if(t < 2) c2 += X[s * H + t]; } tot.push(a); }
    const o = fin.slice().sort((x, y) => x - y), q = (f) => o[Math.min(S - 1, Math.floor(S * f))], mediaFin = suma(fin) / S;
    return { J: Jlog(P, X), mediaFinal: mediaFin, mejoraFinal: mediaFin / B, p10: q(0.1) / B, p50: q(0.5) / B, p90: q(0.9) / B, probPerdida: tot.filter((x) => x < 0).length / S, acum2m: c2 / S, acum: suma(tot) / S,
      crecimientoMensual: Math.pow(Math.max(0.2, 1 + mediaFin / B), 1 / H) - 1 };
  }
  function calendario(cands, set, esfSem){
    const prio = (c) => (c.libera || c.urgente ? 1e9 : 0) + (c.efecto.media * (c.duracion == null ? 6 : Math.min(6, c.duracion))) / ((c.esfuerzo || 0) + 0.5) / (1 + (c.inicio || 0) / 30);
    const items = set.map((i) => cands[i]).sort((a, b) => prio(b) - prio(a)), carga = [], sem = {}, ultGrupo = {};
    items.forEach((c) => {
      let w = 0; (c.requiere || []).forEach((q) => { if(sem[q] != null) w = Math.max(w, sem[q] + 1); });
      if(c.grupo && ultGrupo[c.grupo] != null) w = Math.max(w, ultGrupo[c.grupo] + 1);   // un cambio por semana dentro del mismo grupo: se mide antes de seguir
      const e = c.esfuerzo || 0; while((carga[w] || 0) + e > esfSem + 1e-9 && e <= esfSem) w++;
      carga[w] = (carga[w] || 0) + e; sem[c.id] = w; if(c.grupo) ultGrupo[c.grupo] = w;
    });
    return items.map((c) => ({ id: c.id, semana: sem[c.id] + 1 }));
  }
  function umbrales(P, cands, set){
    const out = {};
    set.forEach((i) => {
      const sin = set.filter((j) => j !== i), base = sin.length ? Jlog(P, evaluar(P, sin)) : 0; let lo = 0, hi = 1;
      const v = (f) => Jlog(P, evaluar(P, set, { [i]: f })) - base;
      if(v(1) <= 0){ out[cands[i].id] = 1; return; }
      if(v(0) >= 0){ out[cands[i].id] = 0; return; }
      for(let k = 0; k < 14; k++){ const m = (lo + hi) / 2; if(v(m) >= 0) hi = m; else lo = m; }
      out[cands[i].id] = hi;
    });
    return out;
  }
  function optimizar(cands, restr, opc){
    opc = Object.assign({}, OPC, opc || {}); restr = Object.assign({ capital: 0, esfuerzo: 6, B: 1000 }, restr || {});
    const B = Math.max(1, restr.B), n = cands.length, P = preparar(cands, B, opc), ex = opc.forzarLocal !== true && (n <= opc.maxExhaustivo || opc.forzarExhaustivo === true);
    const r0 = buscar(P, cands, restr, { opt: puntuaciones.optimo(P), rap: puntuaciones.rapido(P), seg: puntuaciones.seguro(P) }, ex), opt = r0.opt, rap = r0.rap, seg = r0.seg;
    const sol = (b) => ({ set: b.set, ids: b.set.map((i) => cands[i].id), stats: estadisticas(P, b.set) });
    const solo = cands.map((c, i) => Jlog(P, evaluar(P, [i])));
    const descartadas = [];
    cands.forEach((c, i) => {
      if(opt.set.indexOf(i) >= 0) return;
      const s2 = opt.set.concat([i]); let motivo, tipo;
      if(solo[i] <= 0){ tipo = 'pierde'; motivo = 'en promedio pierde dinero o el riesgo se come lo que deja'; }
      else if(chocaCon(cands, i, opt.set)){ const j = opt.set.find((q) => chocaCon(cands, i, [q])); tipo = 'choca'; motivo = 'choca con «' + (cands[j].titulo || cands[j].id) + '», que rinde más'; }
      else if(!factible(cands, s2, restr)){
        const esf = suma(s2, (q) => cands[q].esfuerzo || 0), cap = suma(s2, (q) => cands[q].capital || 0), lib = suma(s2, (q) => cands[q].libera || 0), cuenta = suma(s2, (q) => cands[q].grupo && cands[q].grupo === c.grupo ? 1 : 0);
        if(c.grupo && restr.maxGrupo && restr.maxGrupo[c.grupo] != null && cuenta > restr.maxGrupo[c.grupo]){ tipo = 'grupo'; motivo = 'ya tienes ' + restr.maxGrupo[c.grupo] + ' de este tipo en la ruta; hacer más a la vez junta el riesgo (si una falla, fallan todas)'; }
        else if(esf > restr.esfuerzo + 1e-9){ tipo = 'tiempo'; motivo = 'no te alcanza el tiempo (' + (Math.round(esf * 10) / 10) + ' h por semana contra ' + restr.esfuerzo + ')'; }
        else { tipo = 'capital'; motivo = 'no alcanza el dinero (haría falta ' + Math.round(cap - lib) + ' y hay ' + Math.round(restr.capital) + ')'; }
      } else { tipo = 'suma-poco'; motivo = 'sumarla empeora el crecimiento esperado: el riesgo pesa más que lo que deja'; }
      descartadas.push({ id: c.id, titulo: c.titulo, tipo, motivo, soloJ: solo[i], efecto: c.efecto });
    });
    const cal = calendario(cands, opt.set, restr.esfuerzo), um = umbrales(P, cands, opt.set), alt = {};
    [['mitad', 0.5], ['doble', 2]].forEach(([k, f]) => { const b = buscar(P, cands, Object.assign({}, restr, { capital: restr.capital * f }), { opt: puntuaciones.optimo(P) }, ex); alt[k] = b.opt.set.map((i) => cands[i].id); });
    return { B, opc, optima: sol(opt), rapida: sol(rap), segura: sol(seg), descartadas, calendario: cal, umbrales: um, alternativas: alt, solo: cands.map((c, i) => ({ id: c.id, J: solo[i] })) };
  }
  // fuerza bruta (para la prueba): la mejor combinación factible por la misma puntuación
  function fuerzaBruta(cands, restr, opc){
    opc = Object.assign({}, OPC, opc || {}); restr = Object.assign({ capital: 0, esfuerzo: 6, B: 1000 }, restr || {});
    const P = preparar(cands, Math.max(1, restr.B), opc), n = cands.length; let mejor = { p: 0, set: [] };
    for(let m = 1; m < (1 << n); m++){ const set = []; for(let i = 0; i < n; i++) if(m & (1 << i)) set.push(i); if(!factible(cands, set, restr)) continue; const p = Jlog(P, evaluar(P, set)); if(p > mejor.p + 1e-12) mejor = { p, set }; }
    return { p: mejor.p, ids: mejor.set.map((i) => cands[i].id) };
  }

  // ---------- 2) CANDIDATOS con los datos del negocio ----------
  const MIN_U = 15;
  function generar(an, act, gastos, ctx){
    ctx = ctx || {};
    const L = an.lista.filter((x) => x.fisico), conCosto = L.filter((x) => x.costo != null && x.costo > 0 && x.mUnit != null);
    const bruta = suma(conCosto, (x) => x.margen30 || 0), gastosMes = suma(gastos, (g) => Number(g.monto) || 0), B0 = bruta - gastosMes;
    const mPctGlobal = an.ing30 > 0 ? bruta / suma(conCosto, (x) => x.ing30 || 0) : 0.3;
    const cands = [], nom = (x) => x.nombre;
    // (1) pedir lo que se acaba antes de quedarte sin él
    conCosto.filter((x) => x.vel >= 0.5 && x.dias < 3.5 && x.mUnit > 0).forEach((x) => {
      const dQuiebre = acota(7 - x.dias, 0, 7) / 7 * 4, media = x.vel * x.mUnit * dQuiebre * 0.6, cap = Math.max(0, 10 - x.dias) * x.vel * x.costo;
      cands.push({ id: 'pedir:' + x.id, tipo: 'pedir', urgente: x.dias < 2, datos: x, producto: x.nombre, titulo: 'Pedir ' + nom(x), efecto: { media, sd: media * 0.6 }, inicio: 2, duracion: null, capital: cap, recup: 1, recDias: 10, esfuerzo: 0.5, pFalla: 0,
        supuesto: 'te dura ' + (Math.round(x.dias * 10) / 10) + ' días y vendes ' + (Math.round(x.vel * 10) / 10) + ' al día; sin pedirlo esperas ~' + (Math.round(dQuiebre * 10) / 10) + ' días sin él al mes y pierdes 6 de cada 10 de esas ventas' });
    });
    // (2) subir precio (5% y 10%) con la elasticidad de los productos que ya conoce el simulador: 0.8 ± 0.5 (mayor = más sensible)
    conCosto.filter((x) => x.u30 >= MIN_U && x.precioReal > 0).forEach((x) => {
      [0.05, 0.10].forEach((d) => {
        const P1 = x.precioReal * (1 + d), dg = (eps) => x.u30 * ((1 - eps * d) * (P1 - x.costo) - (x.precioReal - x.costo)), media = dg(0.8), sd = Math.abs(x.u30 * d * (P1 - x.costo)) * 0.5;
        cands.push({ id: 'precio:' + x.id + ':' + Math.round(d * 100), tipo: 'precio', grupo: 'precio', datos: x, d, producto: x.nombre, titulo: 'Subir ' + Math.round(d * 100) + '% el precio de ' + nom(x), efecto: { media, sd }, inicio: 7, duracion: null, capital: 0, esfuerzo: 0.2, pFalla: 0.08, perdidaFalla: 1,
          conflicto: ['precio:' + x.id + ':' + Math.round((d === 0.05 ? 0.10 : 0.05) * 100)], supuesto: 'de ' + ctx.d(x.precioReal) + ' a ' + ctx.d(P1) + '; por cada 1% de precio las piezas bajan ~0.8% (rango 0.3 a 1.3) y hay 8% de probabilidad de que tus clientes lo resientan' });
      });
    });
    // (3) empujar lo que deja mucho por pieza y se vende poco
    const us = conCosto.map((x) => x.u30).sort((a, b) => a - b), med = us.length ? us[Math.floor(us.length / 2)] : 0;
    conCosto.filter((x) => x.mPct >= 0.45 && x.u30 >= 3 && x.u30 < med).forEach((x) => {
      const extra = Math.max(x.u30 * 0.3, 3), media = extra * x.mUnit;
      cands.push({ id: 'empujar:' + x.id, tipo: 'empujar', datos: x, producto: x.nombre, titulo: 'Poner a la vista y ofrecer ' + nom(x), efecto: { media, sd: media * 0.8 }, inicio: 7, duracion: 4, capital: 0, esfuerzo: 1, pFalla: 0.25, perdidaFalla: 0,
        supuesto: 'deja ' + ctx.d(x.mUnit) + ' por pieza (' + Math.round(x.mPct * 100) + '% de margen) y vendes solo ' + Math.round(x.u30) + ' al mes; ofrecerlo suma ~30% más (rango amplio) y el efecto dura unos 4 meses si no lo sostienes' });
    });
    // (4) liberar dinero parado: lo que no se mueve (más de 90 días de existencia o sin ventas)
    L.filter((x) => x.stock > 0 && x.costo > 0 && (x.dias > 90 || x.u30 === 0)).forEach((x) => {
      const val = x.stock * x.costo, libera = val * 0.8;
      cands.push({ id: 'liquidar:' + x.id, tipo: 'liquidar', datos: x, producto: x.nombre, titulo: 'Liquidar ' + nom(x), efecto: { media: libera * 0.015, sd: libera * 0.01 }, inicio: 14, duracion: null, capital: 0, costoUnico: val * 0.2, libera, esfuerzo: 1, pFalla: 0.1, perdidaFalla: 1,
        supuesto: 'tienes ' + ctx.d(val) + ' parados (' + Math.round(x.stock) + ' piezas); rematándolo a ~80% de su costo liberas ' + ctx.d(libera) + ' y aceptas perder ' + ctx.d(val * 0.2) + ' una vez' });
    });
    // (5) promoción con descuento en el día más flojo: casi nunca conviene; se evalúa y se descarta con números
    const dias = act.porDia.map((v, d) => ({ d, v })).filter((x) => x.v > 0);
    if(dias.length >= 5){
      const pm = suma(dias, (x) => x.v) / dias.length, flojo = dias.slice().sort((a, b) => a.v - b.v)[0];
      if(flojo.v < pm * 0.85){
        const Dd = flojo.v / 4.3, m = mPctGlobal, f = (Lf) => 4.3 * Dd * ((1 + Lf) * (m - 0.10) - m), media = f(0.15), sd = Math.abs(4.3 * Dd * (m - 0.10)) * 0.10;
        cands.push({ id: 'promo:' + flojo.d, tipo: 'promo', titulo: 'Descuento de 10% los ' + ctx.dia(flojo.d) + ' (tu día más flojo)', efecto: { media, sd }, inicio: 7, duracion: 2, capital: 0, esfuerzo: 1, pFalla: 0.2, perdidaFalla: 0.5,
          supuesto: 'con ' + Math.round(m * 100) + '% de margen, regalar 10% obliga a vender ' + Math.round(0.10 / (m - 0.10) * 100) + '% más ese día solo para empatar; supuse +15% (rango 5% a 25%)' });
      }
    }
    // (6) venta sugerida / combos al cobrar
    if(an.ing30 > 0) cands.push({ id: 'ticket', tipo: 'ticket', datos: { ing: an.ing30, m: mPctGlobal }, titulo: 'Venta sugerida y combos al cobrar', efecto: { media: an.ing30 * mPctGlobal * 0.03 * 0.5, sd: an.ing30 * mPctGlobal * 0.03 * 0.35 }, inicio: 14, duracion: null, capital: 0, esfuerzo: 2, pFalla: 0.2, perdidaFalla: 0,
      supuesto: 'si la mitad de tus cobros suma un producto que sube 3% el ticket (rango amplio) y tu margen es ' + Math.round(mPctGlobal * 100) + '%' });
    // (7) recortar gastos que se pueden negociar
    const porCat = {}; gastos.forEach((g) => { porCat[g.categoria] = (porCat[g.categoria] || 0) + (Number(g.monto) || 0); });
    ['luz', 'agua', 'internet', 'publicidad', 'servicios', 'otros'].forEach((k) => { if((porCat[k] || 0) >= 500) cands.push({ id: 'recortar:' + k, tipo: 'recortar', datos: { cat: k, monto: porCat[k] }, titulo: 'Reducir el gasto de ' + k, efecto: { media: porCat[k] * 0.07, sd: porCat[k] * 0.05 }, inicio: 30, duracion: null, capital: 0, esfuerzo: 1, pFalla: 0.3, perdidaFalla: 0,
      supuesto: 'gastaste ' + ctx.d(porCat[k]) + ' en ' + k + ' en 30 días; revisar plan, consumo o proveedor suele bajarlo ~7%' }); });
    // (8) negociar el costo de lo que más compras
    conCosto.slice().sort((a, b) => b.u30 * b.costo - a.u30 * a.costo).slice(0, 3).filter((x) => x.u30 * x.costo >= 500).forEach((x) => {
      const m = x.u30 * x.costo * 0.03;
      cands.push({ id: 'negociar:' + x.id, tipo: 'negociar', datos: x, producto: x.nombre, titulo: 'Negociar el costo de ' + nom(x), efecto: { media: m, sd: m }, inicio: 14, duracion: null, capital: 0, esfuerzo: 1, pFalla: 0.4, perdidaFalla: 0,
        supuesto: 'compras ~' + ctx.d(x.u30 * x.costo) + ' al mes de esto; un 3% menos de costo vale ' + ctx.d(m) + ' y hay 40% de probabilidad de que no te lo den' });
    });
    return { cands, B: B0, bruta, gastosMes, mPctGlobal };
  }

  // ---------- 3) Texto de la respuesta ----------
  const R = window.PuveResumen;
  const API = { optimizar, fuerzaBruta, generar, OPC, rng, preparar, evaluar, Jlog, factible };
  window.PuveIaDecision = API;
  if(!R || !R.internos || !R.registrarTemas) return;
  const { enlace, D, N, P, L, C, sug, $d, $r, fmt, esCajero } = R.internos;
  const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const numero = (s, mil) => { s = String(s).replace(/,/g, ''); let v = parseFloat(s); if(!isFinite(v)) return null; if(mil) v *= 1000; return v; };
  function leerParametros(texto){
    const t = String(texto || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''), p = {};   // texto crudo (sin acentos): el NLU separa «3,000» en «3 000»
    let m = t.match(/(?:tengo|cuento con|dispongo de|presupuesto de|invertir|puedo mover|con)\s*\$?\s*([\d][\d.,]*)\s*(mil|k)?\b/);
    if(!m) m = t.match(/\$\s*([\d][\d.,]*)\s*(mil|k)?\b/);
    if(m){ const v = numero(m[1], !!m[2] || (/^\d{1,2}$/.test(m[1]) && /mil/.test(t.slice(t.indexOf(m[1]), t.indexOf(m[1]) + 12)))); if(v && v >= 100) p.capital = v; }
    const h = t.match(/(\d+(?:[.,]\d+)?)\s*horas?/); if(h){ const v = numero(h[1].replace(',', '.')); if(v && v > 0 && v <= 60) p.esfuerzo = v; }
    return p;
  }
  const pct = (x) => (x >= 0 ? '+' : '') + Math.round(x * 100) + '%';
  function ideaDe(c){
    const x = c.datos || {}, med = c.efecto.media, rango = $r(Math.max(0, med - 1.28 * c.efecto.sd)) + ' a ' + $r(med + 1.28 * c.efecto.sd);
    const i = { id: c.id, titulo: c.titulo, texto: c.supuesto, impacto: med, tipo: 'ganancia', cuando: 'semana', supuesto: c.supuesto, evidencia: [], pasos: [], medir: '', cuenta: '' };
    if(c.tipo === 'pedir'){
      const piezas = Math.max(1, Math.ceil(Math.max(0, 10 - x.dias) * x.vel));
      i.evidencia = [['Te quedan', fmt(x.stock) + ' piezas'], ['Vendes', fmt(Math.round(x.vel * 10) / 10) + ' al día'], ['Te dura', 'unos ' + (Math.round(x.dias * 10) / 10) + ' días'], ['Cada una te deja', $r(x.mUnit)]];
      i.cuenta = 'sin pedirlo esperas unos ' + (Math.round(acota(7 - x.dias, 0, 7) / 7 * 4 * 10) / 10) + ' días al mes sin él: ' + fmt(Math.round(x.vel * 10) / 10) + ' al día × ' + $r(x.mUnit) + ' por pieza × 60% que no vuelve = ' + $r(med) + ' al mes (rango ' + rango + ')';
      i.pasos = [['Cuenta lo que hay', 'Revisa en el estante cuántas te quedan de verdad.'], ['Pide para unos 10 días', 'Unas ' + piezas + ' piezas (vendes ~' + fmt(Math.round(x.vel * 10) / 10) + ' al día); te costarán ~' + $r(c.capital) + '.'], ['Anótalo en PUVE', 'Registra la compra para que tu inventario y tu costo queden al día.']];
      i.medir = 'En 2 semanas pregúntame «¿qué se me está acabando?»: no debería salir.'; i.cuando = 'hoy';
    } else if(c.tipo === 'precio'){
      const P1 = x.precioReal * (1 + c.d), perder = 1 - (x.precioReal - x.costo) / (P1 - x.costo);
      i.evidencia = [['Hoy cobras', $r(x.precioReal)], ['Te cuesta', $r(x.costo)], ['Vendes', Math.round(x.u30) + ' al mes'], ['Margen hoy', Math.round(x.mPct * 100) + '%']];
      i.cuenta = Math.round(x.u30) + ' al mes × [(1 − 0.8 × ' + Math.round(c.d * 100) + '%) × (' + $r(P1) + ' − ' + $r(x.costo) + ') − (' + $r(x.precioReal) + ' − ' + $r(x.costo) + ')] = ' + $r(med) + ' al mes (rango ' + rango + ')';
      i.pasos = [['Cámbialo en Productos', 'De ' + $r(x.precioReal) + ' a ' + $r(P1) + '. Solo este; no cambies otros el mismo día.'], ['No lo anuncies ni hagas oferta', 'Que se note lo menos posible; el cliente fiel casi no lo nota.'], ['Mide 2 semanas', 'Compara cuántas piezas vendes al día con las 2 semanas anteriores (hoy ~' + fmt(Math.round(x.u30 / 30 * 10) / 10) + ' al día).']];
      i.medir = 'Si las piezas por día bajan más de ' + Math.round(perder * 100) + '%, el cambio ya no te conviene: regresa el precio. Si bajan menos, déjalo.';
    } else if(c.tipo === 'empujar'){
      i.evidencia = [['Cada pieza te deja', $r(x.mUnit)], ['Margen', Math.round(x.mPct * 100) + '%'], ['Vendes', Math.round(x.u30) + ' al mes']];
      i.cuenta = 'si lo ofreces y sube ~30% (mínimo 3 piezas más): ' + fmt(Math.max(x.u30 * 0.3, 3)) + ' piezas × ' + $r(x.mUnit) + ' = ' + $r(med) + ' al mes (rango amplio: ' + rango + ')';
      i.pasos = [['Dale lugar', 'Ponlo a la vista o junto a la caja.'], ['Ofrécelo al cobrar', '«¿Le agrego ' + x.nombre + '?» a quien compra algo que combine.'], ['Sostenlo', 'Sin insistencia el efecto se apaga en unos 4 meses.']];
      i.medir = 'En 2 semanas compara cuántas vendes por semana contra las ' + Math.max(1, Math.round(x.u30 / 4.3)) + ' de hoy.';
    } else if(c.tipo === 'liquidar'){
      const val = x.stock * x.costo;
      i.evidencia = [['Tienes', fmt(x.stock) + ' piezas'], ['Dinero parado', $r(val)], ['Te dura', Math.round(x.dias) > 999 ? 'años' : 'unos ' + Math.round(x.dias) + ' días']];
      i.cuenta = 'rematarlo a ~80% de su costo libera ' + $r(c.libera) + ' y pierdes ' + $r(c.costoUnico) + ' una sola vez; ese dinero lo puedes usar en lo que sí se vende';
      i.pasos = [['Ponle precio de remate', 'Cerca de 80% de lo que te costó (' + $r(x.costo * 0.8) + ' por pieza).'], ['Sácalo a la vista', 'O júntalo como regalo con algo que sí se vende.'], ['Usa el dinero', 'Llévalo a lo que se te acaba, no a más de lo mismo.']];
      i.medir = 'Cuando se venda, pregúntame «¿cuánto vale mi inventario?»: debe bajar unos ' + $r(val) + '.';
    } else if(c.tipo === 'ticket'){
      i.evidencia = [['Vendiste (30 días)', $r(x.ing)], ['Tu margen', Math.round(x.m * 100) + '%']];
      i.cuenta = $r(x.ing) + ' × ' + Math.round(x.m * 100) + '% de margen × 3% de aumento en el ticket × 50% de cobros donde lo logres = ' + $r(med) + ' al mes (rango ' + rango + ')';
      i.pasos = [['Elige 2 combos', 'Dos productos que ya se compran juntos, con un precio ligeramente mejor que por separado.'], ['Entrena la frase', '«¿Le agrego …?» al cobrar, siempre la misma.'], ['Mide', 'Mira tu ticket promedio antes y después.']];
      i.medir = 'Pregúntame «¿cuál es mi ticket promedio?» hoy y en 2 semanas.';
    } else if(c.tipo === 'recortar'){
      i.evidencia = [['Gastaste en ' + x.cat, $r(x.monto) + ' en 30 días']];
      i.cuenta = $r(x.monto) + ' × 7% de ahorro posible = ' + $r(med) + ' al mes (rango ' + rango + ')';
      i.pasos = [['Revisa el recibo o contrato', 'Busca consumo de más, planes que no usas o un proveedor más barato.'], ['Pide una mejor opción', 'Compara al menos 2 precios.'], ['Anótalo', 'Registra el gasto nuevo para ver el cambio.']];
      i.medir = 'El mes que viene pregúntame «¿cuánto gasté en ' + x.cat + '?».'; i.cuando = 'mes';
    } else if(c.tipo === 'negociar'){
      i.evidencia = [['Compras al mes', $r(x.u30 * x.costo)], ['Cada pieza te cuesta', $r(x.costo)]];
      i.cuenta = $r(x.u30 * x.costo) + ' al mes × 3% menos de costo = ' + $r(med) + ' al mes; 4 de cada 10 veces no te lo darán, y está contado';
      i.pasos = [['Junta dos precios', 'Pide cotización a otro proveedor de lo mismo.'], ['Negocia con la cotización en mano', 'Pide el precio mejor o más volumen por el mismo precio.'], ['Actualiza el costo en PUVE', 'Para que tu margen real quede bien calculado.']];
      i.medir = 'Pregúntame «¿qué producto me deja más?» después del cambio de costo.';
    } else { i.pasos = [['Empieza chico', 'Prueba 2 semanas y mide.']]; i.cuenta = $r(med) + ' al mes en promedio (rango ' + rango + ')'; }
    i.primerPaso = i.pasos[0][0];
    return i;
  }
  async function ruta(c){
    const an = await D.analisis();
    if(!an.hayCostos) return [P('Para elegir el mejor camino necesito el **costo** de tus productos (así sé cuánto te deja cada uno). Anótalo en **Productos** y lo calculo.')];
    const pc = await D.periodoCompleto(N.ultimos(30)), act = pc.act, hoy = new Date(), ini = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 29);
    const gastos = (await D.traerGastos(ini, hoy)) || [];
    if(act.n < 30 || an.lista.filter((x) => x.u30 > 0).length < 5) return [P('Todavía tengo pocos datos para decidir con números (' + act.n + ' ventas en 30 días). Con unas semanas más de ventas puedo elegir el mejor camino; mientras, pregúntame **¿qué debo comprar?** o **¿qué se está acabando?**.')];
    const g = generar(an, act, gastos, { d: $r, dia: (d) => DIAS[d] }), par = leerParametros(c && c.texto);
    const Bef = Math.max(g.B, 0.08 * g.bruta, 1000), capDef = Math.max(1000, Math.round(Math.max(g.B, 0) / 100) * 100), capital = par.capital != null ? par.capital : capDef, esfuerzo = par.esfuerzo != null ? par.esfuerzo : 6;
    if(!g.cands.length) return [P('Con tus números de hoy no veo ninguna acción que valga la pena evaluar. Eso suele pasar cuando todo está en orden; sigue registrando y lo reviso en unos días.')];
    // pre-filtro: para la búsqueda exacta se quedan las 15 mejores por su valor solo (y siempre las que liberan dinero)
    const P0 = preparar(g.cands, Bef, OPC), J = {}; g.cands.forEach((cd, i) => { J[cd.id] = Jlog(P0, evaluar(P0, [i])); });
    const ord = g.cands.slice().sort((a, b) => J[b.id] - J[a.id]), vistoPrecio = new Set(); let nPrecio = 0;
    const buenos = ord.filter((x) => { if(J[x.id] <= 0) return false; if(x.tipo !== 'precio') return true; if(vistoPrecio.has(x.producto) || nPrecio >= 5) return false; vistoPrecio.add(x.producto); nPrecio++; return true; }).slice(0, 13), enab = g.cands.filter((x) => x.libera && buenos.indexOf(x) < 0 && J[x.id] > -0.05).slice(0, 2);
    const usar = buenos.concat(enab), fuera = g.cands.filter((x) => usar.indexOf(x) < 0);
    const res = optimizar(usar, { capital, esfuerzo, B: Bef, maxGrupo: { precio: 3 } }), titulo = (id) => (g.cands.find((x) => x.id === id) || {}).titulo || id, byId = (id) => g.cands.find((x) => x.id === id);
    res.descartadas = res.descartadas.concat(fuera.map((x) => (J[x.id] > 0 ? { id: x.id, titulo: x.titulo, tipo: 'suma-poco', motivo: 'rinde menos, por cada peso y hora que pide, que las que sí elegí', efecto: x.efecto, soloJ: J[x.id] } : { id: x.id, titulo: x.titulo, tipo: 'pierde', motivo: 'en promedio pierde dinero o el riesgo se come lo que deja', efecto: x.efecto, soloJ: J[x.id] })));
    const o = res.optima;
    const out = [P('Esta es la **ruta óptima**: la combinación que más hace crecer tu ganancia a largo plazo equilibrando lo que deja contra el riesgo. No es la más rápida ni la más segura.')];
    out.push(P('**Punto de partida:** hoy ganas unos **' + $r(g.B) + '** al mes (' + $r(g.bruta) + ' de ganancia en productos menos ' + $r(g.gastosMes) + ' de gastos, últimos 30 días)' + (g.B < Bef ? '; como es muy poco o negativo, calculé el crecimiento contra ' + $r(Bef) + '.' : '.') + ' Evalué **' + g.cands.length + ' acciones** con tus números y supuse que puedes mover **' + $r(capital) + '** y dedicar **' + fmt(esfuerzo) + ' horas por semana**' + (par.capital == null || par.esfuerzo == null ? ' (dime «tengo $10,000» o «3 horas» y lo recalculo).' : '.')));
    if(!o.set.length){
      out.push(P('Ninguna combinación mejora tu crecimiento esperado una vez descontado el riesgo. Lo más sensato hoy es **no mover nada grande** y seguir midiendo.'));
    } else {
      const pasos = res.calendario.map((x, k) => { const cd = byId(x.id), um = res.umbrales[x.id]; return [(k + 1) + '. ' + cd.titulo, 'semana ' + x.semana + (cd.capital ? ' · mueve ' + $r(cd.capital) : '') + (cd.libera ? ' · libera ' + $r(cd.libera) : ''),
        (cd.efecto.media >= 0 ? '+' : '') + $r(cd.efecto.media) + '/mes (rango ' + $r(Math.max(0, cd.efecto.media - 1.28 * cd.efecto.sd)) + ' a ' + $r(cd.efecto.media + 1.28 * cd.efecto.sd) + ')' + (um != null && um > 0.02 ? ' · sigue valiendo si rinde ≥ ' + Math.round(um * 100) + '% de eso' : '')]; });
      out.push(L('Tu ruta, en orden', pasos));
      out.push(P('**Qué esperar:** en 6 meses tu ganancia mensual subiría ~**' + pct(o.stats.mejoraFinal) + '** (con 80% de probabilidad entre ' + pct(o.stats.p10) + ' y ' + pct(o.stats.p90) + '), unos **' + Math.round(o.stats.crecimientoMensual * 1000) / 10 + '% más cada mes**. Probabilidad de que todo el plan te cueste más de lo que deje: **' + Math.round(o.stats.probPerdida * 100) + '%**.'));
      const r = res.rapida, s = res.segura, igual = (a, b) => a.length === b.length && a.every((x) => b.indexOf(x) >= 0);
      const lineas = [];
      if(!igual(r.ids, o.ids)) lineas.push('La **más rápida** (' + (r.ids.map(titulo).join(', ') || 'ninguna') + ') suma más en los primeros 2 meses (' + $r(r.stats.acum2m) + ' contra ' + $r(o.stats.acum2m) + '), pero termina en ' + pct(r.stats.mejoraFinal) + ' y con ' + Math.round(r.stats.probPerdida * 100) + '% de riesgo de pérdida.');
      if(!igual(s.ids, o.ids) && s.ids.length) lineas.push('La **más segura** (la que mejor protege lo peor que podría pasar: ' + (s.ids.length <= 3 ? s.ids.map(titulo).join(', ') : s.ids.length + ' acciones, como ' + s.ids.slice(0, 2).map(titulo).join(' y ')) + ') crece ' + pct(s.stats.mejoraFinal) + ' en 6 meses, menos que esta.');
      if(igual(r.ids, o.ids)) lineas.unshift('La que más suma pronto coincide con esta.');
      if(!s.ids.length) lineas.push('Y si quisiera cero riesgo, la única opción sería no mover nada: todo lo que crece trae algo de riesgo.');
      if(lineas.length) out.push(P('**Por qué esta y no otra:** ' + lineas.join(' ')));
      else out.push(P('**Por qué esta:** la más rápida y la más segura coinciden con ella: no hay que escoger entre ganar pronto y no arriesgar.'));
    }
    const des = res.descartadas.filter((x) => x.efecto && (x.tipo === 'pierde' || x.tipo === 'suma-poco' || x.tipo === 'choca')).sort((a, b) => Math.abs(b.efecto.media) - Math.abs(a.efecto.media)).slice(0, 3);
    if(des.length) out.push(L('Lo que evalué y NO te recomiendo', des.map((x) => [x.titulo, (x.efecto.media >= 0 ? '+' : '') + $r(x.efecto.media) + '/mes en promedio', x.motivo])));
    const flip = [], a = res.alternativas; const n0 = o.ids.join('|');
    if(a.mitad.join('|') !== n0) flip.push('con la mitad del dinero (' + $r(capital / 2) + ') la ruta cambia a: ' + (a.mitad.map(titulo).join(', ') || 'ninguna acción'));
    if(a.doble.join('|') !== n0) flip.push('con el doble (' + $r(capital * 2) + ') se suma: ' + (a.doble.filter((x) => o.ids.indexOf(x) < 0).map(titulo).join(', ') || 'nada nuevo'));
    if(flip.length) out.push(P('**Qué me haría cambiar de opinión:** ' + flip.join('; ') + '.'));
    out.push(P('Son estimaciones con rangos, no promesas: cada acción trae su supuesto (pídeme «¿por qué me recomiendas eso?»). Empieza por la primera, mídela 2 semanas y vuelve a preguntarme: con lo que pase, recalculo.'));
    out.push(C([sug('¿Cómo hago la primera?'), sug('¿Por qué me recomiendas eso?'), sug('Dame el plan de la semana')]));
    if(c && c.estado && res.calendario.length){ const m = c.estado.asesor || (c.estado.asesor = { ideas: null, t: 0, mostradas: [], ultima: null }), primera = byId(res.calendario[0].id); if(primera){ m.ultima = ideaDe(primera); if(m.mostradas.indexOf(primera.id) < 0) m.mostradas.push(primera.id); } }
    API.ultimo = { res, gen: g, capital, esfuerzo, Bef, usadas: usar };   // para la prueba: lo que se evaluó y eligió
    return out;
  }
  R.registrarTemas({ ruta_optima: ruta }, { ruta_optima: 'Mejor camino para crecer' });
})();
