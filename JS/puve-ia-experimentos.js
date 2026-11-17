/* PUVE IA · Decisiones y experimentos: «¿funcionó el cambio de precio?» (Etapa 6 del plan de arquitectura, MD §14–15, §18, §45; motor propio, SIN IA externa)
 * Idea central: no hace falta que el dueño registre cada decisión. Un cambio de precio ya quedó escrito en las ventas (a cuánto se cobró cada producto cada día),
 * así que la IA lo DETECTA sola y mide el antes/después. No pide SQL nuevo.
 * Por qué es más fiable que comparar «antes» contra «ahora» a secas:
 *   · compara contra el RESTO DEL NEGOCIO en las mismas fechas (si todo subió por quincena, clima o fiestas, eso se descuenta: diferencia de diferencias),
 *   · usa semanas completas antes y después (mismos días de la semana, sin que un sábado de más infle el resultado),
 *   · mide la INCERTIDUMBRE con la variación real de tus días y devuelve un rango; «no se distingue del azar» es una respuesta válida,
 *   · la métrica principal es la ganancia (si hay costos y es el encargado), si no, las ventas; y dice cuando las métricas se contradicen (vendes menos piezas pero ganas más),
 *   · siempre aclara que una correlación no demuestra causalidad (§15).
 * Parte 1 (matemática pura): PuveIaExperimentos.cambioReciente / .comparar. Parte 2: herramienta evaluar_cambios_precio, tema «resultado_idea» y entrada al diagnóstico.
 * Se carga después de puve-ia-pronostico.js.
 */
(function(){
  'use strict';
  const DIA = 86400000, Z80 = 1.2816, MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const prom = (a) => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
  const desv = (a) => { if(a.length < 2) return 0; const m = prom(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) * (x - m), 0) / (a.length - 1)); };
  const mediana = (a) => { const s = a.slice().sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : 0; };
  const fl = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const dia12 = (k) => new Date(k + 'T12:00:00');
  const diaTxt = (k) => { const d = dia12(k); return d.getDate() + ' de ' + MESES[d.getMonth()]; };

  // ---------- el cambio de precio más reciente de un producto, a partir de sus días de venta [{k, pu, u}] ordenados por fecha ----------
  // Un cambio es válido si hay ≥4 días a cada lado, el precio de cada lado es estable (≥85% de los días a ±4% de su mediana) y la mediana se movió ≥3%.
  function cambioReciente(dias){
    const fuera = (a, m) => a.filter((x) => Math.abs(x.pu / m - 1) > 0.04).length, estable = (a, m) => a.length >= 4 && fuera(a, m) / a.length <= 0.15;
    const evaluar = (i) => {
      // «antes» = el tramo estable justo anterior al corte (hasta 14 días); se corta al encontrar dos días seguidos con otro precio, y un día suelto (descuento) se tolera
      const ref = mediana(dias.slice(Math.max(0, i - 4), i).map((x) => x.pu)), A = [], B = dias.slice(i); let racha = 0;
      for(let j = i - 1; j >= Math.max(0, i - 14); j--){ if(Math.abs(dias[j].pu / ref - 1) > 0.04){ racha++; if(racha >= 2) break; } else racha = 0; A.unshift(dias[j]); }
      while(A.length && Math.abs(A[0].pu / ref - 1) > 0.04) A.shift();
      if(A.length < 4 || B.length < 4) return null;
      const mA = mediana(A.map((x) => x.pu)), mB = mediana(B.map((x) => x.pu)), cambio = mB / mA - 1;
      if(!(mA > 0) || Math.abs(cambio) < 0.03 || !estable(A, mA) || !estable(B, mB)) return null;
      return { k: B[0].k, de: mA, a: mB, cambio, diasA: A.length, diasB: B.length, sucios: fuera(A, mA) + fuera(B, mB), i };
    };
    for(let i = dias.length - 4; i >= 4; i--){
      let mejor = evaluar(i); if(!mejor) continue;
      // el corte más tardío que pasa puede estar corrido unos días (la tolerancia deja pasar 1–2 días atípicos): se elige el más limpio entre los cercanos, para que el «antes» no incluya días con el precio nuevo
      for(let j = i - 1; j >= Math.max(4, i - 6); j--){ const c = evaluar(j); if(c && c.sucios < mejor.sucios) mejor = c; }
      return mejor;
    }
    return null;
  }
  // ---------- antes/después del producto frente al resto del negocio en las mismas fechas ----------
  // tA/tB: valores diarios del producto antes/después; cA/cB: lo mismo para el resto del negocio. Misma cantidad de semanas completas a cada lado.
  function comparar(tA, tB, cA, cB){
    const mA = prom(tA), mB = prom(tB), kA = prom(cA), kB = prom(cB);
    if(tA.length < 4 || tB.length < 4 || cA.length < 4 || cB.length < 4) return { calculable: false, motivo: 'pocos_dias' };
    if(!(kA > 0 && kB > 0)) return { calculable: false, motivo: 'sin_resto' };   // sin el resto del negocio no hay con qué descontar la temporada
    if(!(mA > 0)) return { calculable: false, motivo: 'antes_cero' };
    const control = kB / kA - 1;
    if(!(mB > 0)) return { calculable: true, antes: mA, despues: 0, cambio: -1, control, relativo: -1, ic: [-1, -1], z: -Infinity, claridad: 'clara' };   // dejó de venderse
    const cv = (a, m) => desv(a) / m, se = Math.sqrt(Math.pow(cv(tA, mA), 2) / tA.length + Math.pow(cv(tB, mB), 2) / tB.length + Math.pow(cv(cA, kA), 2) / cA.length + Math.pow(cv(cB, kB), 2) / cB.length);
    const l = Math.log((mB / mA) / (kB / kA)), z = se > 0 ? l / se : (l === 0 ? 0 : Math.sign(l) * Infinity), az = Math.abs(z);
    return { calculable: true, antes: mA, despues: mB, cambio: mB / mA - 1, control, relativo: Math.exp(l) - 1, ic: [Math.exp(l - Z80 * se) - 1, Math.exp(l + Z80 * se) - 1], z, se, claridad: az >= 1.96 ? 'clara' : (az >= 1.28 ? 'probable' : 'no distinguible del azar') };
  }
  const veredictoDe = (m) => !m || !m.calculable ? 'sin_datos' : (m.claridad === 'clara' ? (m.relativo > 0 ? 'favorable' : 'desfavorable') : (m.claridad === 'probable' ? (m.relativo > 0 ? 'tiende_favorable' : 'tiende_desfavorable') : 'sin_efecto'));
  window.PuveIaExperimentos = { cambioReciente, comparar, veredictoDe, diaTxt, internos: { Z80, fl } };

  // ---------- parte 2 ----------
  const R = window.PuveResumen, RZ = window.PuveIaRazonamiento, T = window.PuveIaHerramientas;
  if(!R || !R.internos || !RZ || !T || !R.registrarTemas) return;
  const I = R.internos, { D, N, P, L, C, sug, fmt, $r, $d } = I, enlace = () => I.enlace(), EQUIPO = ['admin', 'analista'];
  const pct = (x) => Math.round(Math.abs(x) * 100) + '%', sgn = (x) => (x >= 0 ? '+' : '−') + pct(x);
  const EX = window.PuveIaExperimentos;

  T.registrar({
    nombre: 'evaluar_cambios_precio', descripcion: 'Detecta cambios de precio en tus ventas y mide si funcionaron, contra el resto del negocio', permisos: EQUIPO, produce: ['experimento'], entrada: { producto: { tipo: 'texto', max: 60 } },
    async ejecutar({ producto }){
      const verMargen = enlace().rol() === 'admin', lin = await D.detalleLineas(90), prods = enlace().productos() || [], hoyF = fl(new Date()), costo = new Map(prods.map((p) => [p.id, Number(p.costo) > 0 ? Number(p.costo) : null]));
      const dias = new Map(), porProd = new Map();   // dias: fecha → {id → {u, ing}} ; porProd: id → [{k, pu, u}]
      lin.forEach((l) => { if(!(l.cant > 0) || !(l.sub >= 0) || !l.f || isNaN(l.f.getTime())) return; const k = fl(l.f); if(k >= hoyF) return;   // hoy no está completo
        const d = dias.get(k) || new Map(), o = d.get(l.id) || { u: 0, ing: 0, nombre: l.nombre }; o.u += l.cant; o.ing += l.sub; d.set(l.id, o); dias.set(k, d); });
      dias.forEach((d, k) => d.forEach((o, id) => { if(o.u > 0 && o.ing > 0){ const a = porProd.get(id) || []; a.push({ k, pu: o.ing / o.u, u: o.u, nombre: o.nombre }); porProd.set(id, a); } }));
      const q = producto ? N.norm(producto) : null, abiertas = [...dias.keys()].sort(), totalVentas = [...dias.values()].reduce((s, d) => s + [...d.values()].reduce((x, o) => x + o.ing, 0), 0), cambios = [];
      porProd.forEach((serie, id) => {
        const nombre = serie[0].nombre; if(q && !N.norm(nombre).includes(q)) return;
        serie.sort((a, b) => a.k < b.k ? -1 : 1); if(serie.length < 8) return;
        const c = cambioReciente(serie); if(!c) return;
        const dd = Math.round((dia12(hoyF) - dia12(c.k)) / DIA), semanas = Math.min(4, Math.floor(dd / 7)), base = { id, nombre, fecha: c.k, de: c.de, a: c.a, cambio: c.cambio, diasDesde: dd, semanas };
        if(semanas < 1) return cambios.push(Object.assign(base, { pronto: true, diasFaltan: 7 - dd }));
        const ini = new Date(dia12(c.k).getTime() - 7 * semanas * DIA), fin = new Date(dia12(c.k).getTime() + (7 * semanas - 1) * DIA), antes = [], despues = [];
        abiertas.forEach((k) => { const d = dia12(k); if(d >= ini && d < dia12(c.k)) antes.push(k); else if(d >= dia12(c.k) && d <= fin) despues.push(k); });
        if(antes.length < 4 || despues.length < 4) return cambios.push(Object.assign(base, { pocas: true }));
        const cu = costo.get(id), val = (k, f) => { const d = dias.get(k), o = d.get(id) || { u: 0, ing: 0 }, tot = { u: 0, ing: 0, mar: 0, cob: 0, ingC: 0 };
          d.forEach((x, j) => { if(j === id) return; tot.u += x.u; tot.ing += x.ing; const cj = costo.get(j); if(cj != null){ tot.mar += x.ing - x.u * cj; tot.ingC += x.ing; } }); return f(o, tot); };
        const serieDe = (ks, f) => ks.map((k) => val(k, f)), defs = [['unidades', (o, t) => [o.u, t.u]], ['ventas', (o, t) => [o.ing, t.ing]]];
        const metricas = [];
        defs.forEach(([nom, f]) => { const m = comparar(serieDe(antes, (o, t) => f(o, t)[0]), serieDe(despues, (o, t) => f(o, t)[0]), serieDe(antes, (o, t) => f(o, t)[1]), serieDe(despues, (o, t) => f(o, t)[1])); metricas.push(Object.assign({ k: nom }, m)); });
        // ganancia: solo el encargado, con costo del producto y costo conocido de al menos el 60% de lo que vende el resto
        const ingResto = [...antes, ...despues].reduce((s, k) => s + val(k, (o, t) => t.ing), 0), ingRestoC = [...antes, ...despues].reduce((s, k) => s + val(k, (o, t) => t.ingC), 0);
        if(verMargen && cu != null && ingResto > 0 && ingRestoC / ingResto >= 0.6){ const f = (o, t) => [o.ing - o.u * cu, t.mar]; metricas.push(Object.assign({ k: 'utilidad' }, comparar(serieDe(antes, (o, t) => f(o, t)[0]), serieDe(despues, (o, t) => f(o, t)[0]), serieDe(antes, (o, t) => f(o, t)[1]), serieDe(despues, (o, t) => f(o, t)[1])))); }
        const pu = metricas.find((m) => m.k === 'utilidad' && m.calculable), principal = pu ? 'utilidad' : 'ventas', mp = metricas.find((m) => m.k === principal);
        const peso = [...antes, ...despues].reduce((s, k) => s + val(k, (o) => o.ing), 0);   // cuánto del negocio es este producto en esas semanas
        cambios.push(Object.assign(base, { nAntes: antes.length, nDespues: despues.length, metricas, principal, veredicto: veredictoDe(mp), peso: ingResto + peso > 0 ? peso / (ingResto + peso) : 0 }));
      });
      const util = cambios.filter((c) => c.pronto || c.pocas || (c.peso || 0) >= 0.01).sort((a, b) => a.diasDesde - b.diasDesde).slice(0, 3);
      return { cambios: util, diasRevisados: abiertas.length, suficiente: abiertas.length >= 21 };
    }
  });

  // ---------- presentación del chat ----------
  const ETQ = { unidades: 'Piezas por día', ventas: 'Ventas por día', utilidad: 'Ganancia por día' }, ETQ2 = { unidades: 'las piezas vendidas', ventas: 'las ventas', utilidad: 'la ganancia' };
  const num = (k, x) => k === 'unidades' ? fmt(Math.round(x * 10) / 10) : $r(x);
  function bloques(c){
    const sube = c.a > c.de, o = [P('**' + c.nombre + '**: ' + (sube ? 'subiste' : 'bajaste') + ' el precio de **' + $d(c.de) + '** a **' + $d(c.a) + '** el ' + EX.diaTxt(c.fecha) + ' (hace ' + c.diasDesde + ' días).')];
    if(c.pronto) return o.concat([P('Todavía es pronto: necesito al menos 7 días completos con el precio nuevo para compararlo con la semana anterior y descontar lo que le pasó al resto de tu negocio. Pregúntame de nuevo en ' + c.diasFaltan + (c.diasFaltan === 1 ? ' día.' : ' días.'))]);
    if(c.pocas) return o.concat([P('No tengo suficientes días con ventas antes y después del cambio para compararlo sin inventar.')]);
    const mp = c.metricas.find((m) => m.k === c.principal), ok = c.metricas.filter((m) => m.calculable);
    o.push(P('Comparé ' + (c.semanas === 1 ? '1 semana completa' : c.semanas + ' semanas completas') + ' antes y ' + (c.semanas === 1 ? '1 después' : c.semanas + ' después') + ', y descuento lo que le pasó al resto de tu negocio en las mismas fechas.'));
    if(ok.length) o.push(L('Por día, antes → después', ok.map((m) => [ETQ[m.k], num(m.k, m.antes) + ' → ' + num(m.k, m.despues), sgn(m.cambio) + ' · resto del negocio ' + sgn(m.control) + ' · neto ' + sgn(m.relativo)])));
    if(!mp || !mp.calculable) return o.concat([P('No pude calcular el efecto con seguridad (' + ({ pocos_dias: 'pocos días', sin_resto: 'no hay resto del negocio con qué comparar', antes_cero: 'antes no se vendía' }[mp && mp.motivo] || 'faltan datos') + ').')]);
    const rango = sgn(mp.ic[0]) + ' a ' + sgn(mp.ic[1]), et = ETQ2[c.principal];
    const concl = { favorable: 'Conclusión: **favorable**. ' + et.charAt(0).toUpperCase() + et.slice(1) + ' subió ' + pct(mp.relativo) + ' más que en el resto de tu negocio (rango probable: ' + rango + ').',
      desfavorable: 'Conclusión: **desfavorable**. ' + et.charAt(0).toUpperCase() + et.slice(1) + ' bajó ' + pct(mp.relativo) + ' frente al resto de tu negocio (rango probable: ' + rango + ').',
      tiende_favorable: 'Tiende a ser **favorable**, pero todavía no es claro: ' + et + ' ' + sgn(mp.relativo) + ' frente al resto (rango probable: ' + rango + ', incluye el cero).',
      tiende_desfavorable: 'Tiende a ser **desfavorable**, pero todavía no es claro: ' + et + ' ' + sgn(mp.relativo) + ' frente al resto (rango probable: ' + rango + ', incluye el cero).',
      sin_efecto: 'No se distingue de lo normal: no veo un efecto claro del cambio en ' + et + ' (rango probable: ' + rango + '). Dale más semanas antes de decidir.' }[c.veredicto];
    o.push(P(concl));
    const un = c.metricas.find((m) => m.k === 'unidades' && m.calculable);
    if(un && c.principal !== 'unidades' && un.claridad !== 'no distinguible del azar' && Math.sign(un.relativo) !== Math.sign(mp.relativo)) o.push(P('Ojo con esto: ' + (un.relativo < 0 ? 'vendes menos piezas, pero cada una te deja más' : 'vendes más piezas, pero cada una te deja menos') + '.'));
    o.push(P('Una correlación no demuestra causalidad: pudo influir el clima, una fiesta u otro cambio. Compararlo con el resto de tu negocio ayuda a descontarlo, pero sigue siendo una pista, no una prueba.'));
    return o;
  }
  const previo = R.handler && R.handler('resultado_idea'), M = () => window.PuveIaAsesorMemoria;
  async function resultado(c){
    const rol = enlace().rol(); if(!EQUIPO.includes(rol)) return previo ? previo(c) : [P('Eso lo ve el encargado del negocio.')];
    const t = N.norm(c.texto || c.original || ''), pr = N.buscarProductos(c.original || c.texto || '', enlace().productos() || []).productos;
    let marcha = []; try { const m = M(); if(m && m.activo && m.activo()){ await m.cargar(); marcha = m.internos.enMarcha(); } } catch(e){ /* sin memoria, no pasa nada */ }
    const habla = /precio|subi|baje|cambi/.test(t) || pr.length > 0;
    if(marcha.length && !habla) return previo(c);
    const r = await T.llamar('evaluar_cambios_precio', pr.length ? { producto: pr[0].nombre } : {}, {});
    if(!r.ok) return previo ? previo(c) : [P('No pude revisar tus precios ahora.')];
    const cs = r.datos.cambios; EX.ultimo = { cambios: cs, cuando: Date.now() };   // lo lee puve-ia-resultados.js para recordar los resultados ya evaluados
    if(!cs.length){
      if(pr.length) return [P('No veo que hayas cambiado el precio de **' + pr[0].nombre + '** en los últimos 90 días: se ha cobrado parejo' + (r.datos.suficiente ? '.' : ', aunque tengo pocos días de ventas para asegurarlo.'))];
      return previo ? previo(c) : [P('No veo cambios de precio recientes en tus ventas.')];
    }
    const out = bloques(cs[0]), otros = cs.slice(1, 3).map((x) => sug('¿Funcionó el cambio de precio de ' + x.nombre + '?'));
    return out.concat([C(otros.concat([sug('¿Cómo voy con mi meta?')]).slice(0, 3))]);
  }
  R.registrarTemas({ resultado_idea: resultado }, {}, { resultado_idea: 'Revisando si funcionó…' });
  // el NLU manda a «precio_producto» todo lo que nombra un producto (o ni lo entiende): si además preguntan si un cambio de precio funcionó, un gancho PRE decide el tema
  // (la pregunta causal «¿por qué vendo menos desde que subí el precio?» se queda en su investigador, y «¿qué pasa si subo…?» en el simulador)
  if(R.agregarPre) R.agregarPre((texto) => {
    const t = N.norm(texto || ''); if(/\b(por que|porque|que pasa si|si subo|si bajo|conviene|deberia)\b/.test(t)) return null;
    const pregunta = /(funcion|sirvi|resultado|como me (fue|salio|va)|se nota|ya se noto|que paso|vendo (menos|mas|igual)|mejoro|empeoro|valio la pena)/.test(t), habla = /(cambio de precio|subi\b|subir|baje\b|bajar|aumente|aumento de precio|cambie el precio|rebaje|desde que (subi|baje|cambie))/.test(t);
    return pregunta && habla ? { intent: 'resultado_idea' } : null;
  });
  EX.bloques = bloques;
})();
