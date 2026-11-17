/* PUVE IA · Pronóstico con rango y motor de objetivos (Etapas 2 y 4 del plan de arquitectura, MD §16, §46, §47; motor propio, SIN IA externa)
 * Qué cambia frente a «promedio diario × días que faltan, ±12%»:
 *   · el pronóstico usa TU patrón por día de la semana (si los sábados vendes el doble, los sábados que faltan pesan el doble; si no abres los domingos, no los cuenta),
 *   · el RANGO sale de tus propios datos (qué tanto varía cada día de la semana), no de un porcentaje fijo: apunta a ~80% y es algo CONSERVADOR (en 1,200 negocios simulados contuvo el resultado 84% de las veces con cambios semanales de nivel, y 90% si los días son independientes),
 *   · la meta recibe un VEREDICTO (alcanzable · exigente · poco probable · sin datos suficientes), la BRECHA por día y ejemplos cuantificados para cerrarla,
 *   · nunca promete: dice qué supone (días independientes, sin clima ni fiestas) y marca poca confianza si hay pocos días de ventas.
 * Parte 1 (matemática pura, sin dependencias): PuveIaPronostico.mes / .rango. Se puede cargar en cualquier orden: asesor-memoria la usa si existe.
 * Parte 2 (necesita razonamiento y herramientas): herramientas pronosticar_ventas y progreso_meta, y el tema «prediccion» para periodos de varios días.
 * Se carga después de puve-ia-diagnostico.js.
 */
(function(){
  'use strict';
  const DIA = 86400000, Z80 = 1.2816, DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const prom = (a) => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
  const desv = (a) => { if(a.length < 2) return 0; const m = prom(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) * (x - m), 0) / (a.length - 1)); };
  const erf = (x) => { const s = Math.sign(x), t = 1 / (1 + 0.3275911 * Math.abs(x)); return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)); };
  const cdf = (z) => 0.5 * (1 + erf(z / Math.SQRT2));
  const fl = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const plural = (d) => /s$/.test(d) ? d : d + 's';

  // ---------- el patrón de tus días: media y variación por día de la semana (últimas 8 semanas completas) ----------
  function perfil(serie, ahora){
    const hoyF = fl(ahora), comp = serie.filter((x) => x.fecha < hoyF && x.total >= 0).slice(-56), por = [[], [], [], [], [], [], []];
    comp.forEach((x) => por[new Date(x.fecha + 'T12:00:00').getDay()].push(x.total));
    const span = comp.length ? Math.round((new Date(comp[comp.length - 1].fecha + 'T12:00:00') - new Date(comp[0].fecha + 'T12:00:00')) / DIA) + 1 : 0, todos = comp.map((x) => x.total), gm = prom(todos), gs = desv(todos);
    // con 3 semanas o más de historia, un día de la semana sin una sola venta significa que ese día no abres
    const dow = por.map((v) => span >= 21 && !v.length ? { n: 0, m: 0, s: 0, cerrado: true } : (v.length >= 3 ? { n: v.length, m: prom(v), s: desv(v) } : { n: v.length, m: gm, s: gs, poco: true }));
    return { dow, nDias: comp.length, span, base: comp.length >= 42 ? 'alta' : (comp.length >= 21 ? 'media' : (comp.length >= 14 ? 'baja' : 'insuficiente')) };
  }
  // ---------- suma esperada de ventas desde hoy (lo que falte del día) hasta un día final, con su incertidumbre ----------
  function rango(serie, ahora, hasta, desde){   // desde (opcional): primer día del periodo; si es futuro, no cuenta lo que falta de hoy
    const P_ = perfil(serie, ahora), hoyF = fl(ahora), hoy = (serie.find((x) => x.fecha === hoyF) || { total: 0 }).total, fin = new Date(hasta.getFullYear(), hasta.getMonth(), hasta.getDate()), dias = [], h0 = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
    const ini = desde && desde > h0 ? new Date(desde.getFullYear(), desde.getMonth(), desde.getDate()) : h0;
    let mu = 0, v = 0;
    for(let d = new Date(ini); d <= fin; d.setDate(d.getDate() + 1)){
      const p = P_.dow[d.getDay()], esHoy = fl(d) === hoyF, e = esHoy ? Math.max(0, p.m - hoy) : p.m, peso = p.cerrado ? 0 : (esHoy ? (p.m > 0 ? Math.min(1, e / p.m) : 0) : 1);   // hoy cuenta solo por la parte del día que falta
      mu += e; v += p.s * p.s * (1 + 1 / Math.max(1, p.n)) * (esHoy ? peso : 1); dias.push({ fecha: fl(d), dow: d.getDay(), esperado: e, cerrado: !!p.cerrado, peso });
    }
    const nivel = 0.05 * mu; v += nivel * nivel;   // cada semana puede arrancar ~5% arriba o abajo (clima, quincena): se suma a la incertidumbre
    const sigma = Math.sqrt(v);
    return { mu, sigma, bajo: Math.max(0, mu - Z80 * sigma), alto: mu + Z80 * sigma, dias, perfil: P_, hoy };
  }
  const veredictoDe = (prob, base, falta) => falta <= 0 ? 'lograda' : (base === 'insuficiente' ? 'sin_sustento' : (prob >= 0.75 ? 'alcanzable' : (prob >= 0.35 ? 'exigente' : 'poco_probable')));
  // ---------- meta del mes: pronóstico, probabilidad aproximada, veredicto, brecha por día y ejemplos para cerrarla ----------
  function mes(o){
    const ahora = o.ahora || new Date(), r = rango(o.serie || [], ahora, new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0));
    if(!r.perfil.nDias) return null;
    const falta = Math.max(0, o.monto - o.llevo), abiertos = Math.max(0.5, r.dias.reduce((s, d) => s + d.peso, 0));
    const prob = falta <= 0 ? 1 : (r.sigma > 0 ? 1 - cdf((falta - r.mu) / r.sigma) : (r.mu >= falta ? 1 : 0));
    const necesito = falta / abiertos, ritmoEsperado = r.mu / abiertos, out = { esperado: o.llevo + r.mu, bajo: o.llevo + r.bajo, alto: o.llevo + r.alto, prob, falta, necesito, ritmoEsperado, brechaDia: Math.max(0, necesito - ritmoEsperado), abiertos, base: r.perfil.base, veredicto: veredictoDe(prob, r.perfil.base, falta), acciones: [] };
    if(falta > 0 && out.veredicto !== 'alcanzable' && out.veredicto !== 'sin_sustento'){
      const ab = r.perfil.dow.filter((p) => !p.cerrado && p.n >= 3), g = prom(ab.map((p) => p.m)), hoyF = fl(ahora); let flojo = null;
      r.perfil.dow.forEach((p, d) => { if(p.cerrado || p.n < 3 || p.m >= g * 0.8) return; const k = r.dias.filter((x) => x.dow === d && x.fecha !== hoyF).length, gain = k * (g - p.m); if(k >= 1 && (!flojo || gain > flojo.valor)) flojo = { tipo: 'dia', dia: DIAS[d], k, normal: g, valor: gain }; });
      if(flojo && flojo.valor >= 0.02 * o.monto) out.acciones.push(flojo);
      if(r.mu > 0) out.acciones.push({ tipo: 'ticket', valor: 0.05 * r.mu });
    }
    return out;
  }
  // texto de un ejemplo (dinero con el formateador de quien lo muestra)
  const textoAccion = (a, $) => a.tipo === 'dia' ? 'si tus ' + plural(a.dia) + ' (quedan ' + a.k + ') vendieran como un día normal (' + $(a.normal) + '), sumarías cerca de ' + $(a.valor) : 'si cada venta subiera 5% (un complemento al cobrar, un combo), serían cerca de ' + $(a.valor) + ' más';
  const verdictoTxt = (g, $) => {
    const nde = (p) => p < 0.05 ? 'casi nunca' : (p > 0.95 ? 'casi siempre' : Math.round(p * 10) + ' de cada 10 veces');
    if(g.veredicto === 'alcanzable') return 'Vas en camino: con este ritmo la meta es **alcanzable**.';
    if(g.veredicto === 'exigente') return 'La meta es **exigente**: se puede, pero no te sobra margen (con este ritmo la alcanzarías ' + nde(g.prob) + ', aproximado).';
    if(g.veredicto === 'poco_probable') return 'Con este ritmo la meta es **poco probable** (la alcanzarías ' + nde(g.prob) + ', aproximado). No es imposible, pero hay que cambiar algo.';
    if(g.veredicto === 'sin_sustento') return 'Todavía tengo pocos días de ventas para decirte si la meta es realista; con más días te lo afino.';
    return '';
  };
  window.PuveIaPronostico = { perfil, rango, mes, textoAccion, verdictoTxt, cdf, internos: { Z80, veredictoDe, fl } };

  // ---------- parte 2: herramientas y tema del chat ----------
  const R = window.PuveResumen, RZ = window.PuveIaRazonamiento, T = window.PuveIaHerramientas;
  if(!R || !R.internos || !RZ || !T || !R.registrarTemas) return;
  const I = R.internos, { D, N, P, L, C, sug, $r, en } = I, PF = window.PuveIaPronostico;
  const EQUIPO = ['admin', 'analista'], ADMIN = ['admin'];
  const confTxt = (b) => b === 'alta' ? 'buena' : (b === 'media' ? 'media' : 'baja');

  T.registrar({
    nombre: 'pronosticar_ventas', descripcion: 'Cuánto es probable que vendas en los próximos días, con un rango probable del 80%', permisos: EQUIPO, produce: ['pronostico'], entrada: { dias: { tipo: 'numero', min: 1, max: 31, defecto: 7 } },
    async ejecutar({ dias }){
      const ahora = new Date(), serie = await D.diario(60), hasta = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + dias - 1), r = rango(serie, ahora, hasta);
      return { dias, desde: fl(ahora), hasta: fl(hasta), esperado: r.mu, bajo: r.bajo, alto: r.alto, confianza: r.perfil.base, diasConDatos: r.perfil.nDias, porDia: r.dias.slice(0, 31).map((x) => ({ fecha: x.fecha, esperado: x.esperado, cerrado: x.cerrado })), suficiente: r.perfil.base !== 'insuficiente',
        supuestos: ['cada día de la semana se parece a sus últimas semanas', 'sin clima, quincena ni fiestas', 'los días varían de forma independiente'] };
    }
  });
  T.registrar({
    nombre: 'progreso_meta', descripcion: 'Cómo vas con la meta del mes que guardaste: pronóstico con rango, veredicto, brecha por día y ejemplos para cerrarla', permisos: ADMIN, produce: ['objetivo'], entrada: {},
    async ejecutar(){
      const M = window.PuveIaAsesorMemoria; if(!M || !M.activo || !M.activo()) return { hayMeta: false, sinMemoria: true };
      await M.cargar(); const f = M.internos.metas().find((x) => x.clave === 'ventas_mes'); if(!f) return { hayMeta: false, sinMemoria: M.sinSql() };
      const ahora = new Date(), serie = await D.diario(60), ini = fl(new Date(ahora.getFullYear(), ahora.getMonth(), 1)), llevo = serie.filter((x) => x.fecha >= ini).reduce((s, x) => s + x.total, 0), monto = Number(f.datos.monto) || 0;
      const p = mes({ serie, llevo, monto, ahora }); return p ? Object.assign({ hayMeta: true, monto, llevo }, p) : { hayMeta: true, monto, llevo, veredicto: 'sin_sustento', sinDatos: true };
    }
  });

  // «¿cuánto voy a vender esta semana / la próxima semana / este mes / en los próximos 15 días?»: el NLU solo entiende periodos «hasta hoy», así que el horizonte se lee del texto.
  // Un solo día (mañana, el sábado…) y todo lo demás siguen como estaban.
  const NUM = { dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, quince: 15, veinte: 20, treinta: 30 };
  function horizonte(texto, ahora, mesPorDefecto){
    const t = N.norm(texto), h0 = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()), mas = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n), lunes = mas(h0, -((h0.getDay() + 6) % 7)); let m;
    if(/(proxima|siguiente|que viene) semana/.test(t)){ const l = mas(lunes, 7); return { desde: l, hasta: mas(l, 6), etiqueta: 'la próxima semana' }; }
    if(/(proximo|siguiente|que viene) mes/.test(t)) return { desde: new Date(ahora.getFullYear(), ahora.getMonth() + 1, 1), hasta: new Date(ahora.getFullYear(), ahora.getMonth() + 2, 0), etiqueta: 'el próximo mes' };
    if((m = t.match(/(?:proximos|siguientes|proximas) (\d{1,2}|[a-z]+) dias/))){ const n = /^\d+$/.test(m[1]) ? Number(m[1]) : NUM[m[1]]; if(n >= 2 && n <= 31) return { desde: h0, hasta: mas(h0, n - 1), etiqueta: 'los próximos ' + n + ' días' }; }
    if(/(^| )(esta|la) semana( |$)/.test(t)) return { desde: lunes, hasta: mas(lunes, 6), etiqueta: 'esta semana' };
    if(/(^| )(este|el) mes( |$)|fin de mes|cierre del mes/.test(t) || mesPorDefecto) return { desde: new Date(ahora.getFullYear(), ahora.getMonth(), 1), hasta: new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0), etiqueta: 'este mes' };
    return null;
  }
  async function responderPronostico(c, previo, mesPorDefecto){
    const ahora = new Date(), rol = I.enlace().rol(), h = EQUIPO.includes(rol) ? horizonte(c.texto || '', ahora, mesPorDefecto) : null;
    if(!h) return previo ? previo(c) : [P('No pude calcular eso ahora.')];
    const serie = await D.diario(60), r = rango(serie, ahora, h.hasta, h.desde);
    if(r.perfil.base === 'insuficiente') return [P('Todavía tengo pocos días de ventas (' + r.perfil.nDias + ') para pronosticar ' + h.etiqueta + ' con seguridad. Con unas semanas más lo hago.')];
    const ini = fl(h.desde), hoyF = fl(ahora), ya = h.desde <= ahora ? serie.filter((x) => x.fecha >= ini && x.fecha <= hoyF).reduce((s, x) => s + x.total, 0) : 0, tot = ya + r.mu;
    const out = [P('Calculo que ' + h.etiqueta + ' venderás cerca de **' + $r(tot) + '**, con un rango probable de **' + $r(ya + r.bajo) + ' a ' + $r(ya + r.alto) + '**' + (ya > 0 ? ' (ya llevas ' + $r(ya) + ').' : '.'))];
    out.push(P('Lo calculé con cómo se han comportado tus últimos días de la semana (' + r.perfil.nDias + ' días de datos, confianza ' + confTxt(r.perfil.base) + '). Es un rango, no una promesa: no incluye clima, quincena ni fiestas.'));
    out.push(C([sug('¿Cómo voy con mi meta?'), sug('¿Por qué estoy vendiendo menos?')]));
    return out;
  }
  const previoPred = R.handler && R.handler('prediccion'), previoProy = R.handler && R.handler('proyeccion');
  R.registrarTemas({ prediccion: (c) => responderPronostico(c, previoPred, false), proyeccion: (c) => responderPronostico(c, previoProy, true) }, {}, {});
})();
