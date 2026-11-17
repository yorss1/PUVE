/* PUVE IA · Conocimiento por giro: MOTOR (Etapa 7 del plan de arquitectura, MD §31; motor propio, SIN IA externa)
 * Usa los datos de puve-ia-giros-datos.js (los 29 giros) y los cruza con TUS números:
 *   · herramienta conocimiento_giro: indicadores de salud del giro medidos con tu inventario y tus ventas (inventario que dura más de lo que conviene en tu giro,
 *     caducidad próxima, dependencia de un solo producto), las próximas fechas fuertes y la temporada actual;
 *   · chat: «¿qué errores comete una taquería como la mía?», «¿qué debo cuidar en mi giro?», «¿qué fechas son fuertes para mi negocio?»… se contestan sin un tema nuevo
 *     (mismo tema «riesgo», con una redirección), así que no hay SQL nuevo; y el tema «riesgo» agrega al final lo propio de tu giro;
 *   · diagnóstico general: «Para tu giro», una prioridad si tu inventario dura mucho más de lo habitual en tu giro, y aviso de la próxima fecha fuerte.
 * Las fechas se leen de PuveDecisiones.calendario (fuente única con la pantalla Decisiones). Los umbrales son referencias generales, no reglas: se presentan así.
 * Se carga después de puve-ia-experimentos.js.
 */
(function(){
  'use strict';
  const G = window.PuveIaGirosDatos, R = window.PuveResumen, RZ = window.PuveIaRazonamiento, T = window.PuveIaHerramientas;
  if(!G || !R || !R.internos || !RZ || !T || !R.registrarTemas) return;
  const DIA = 86400000, I = R.internos, { D, N, P, L, C, sug, veces, $r } = I, enlace = () => I.enlace(), EQUIPO = ['admin', 'analista'];
  const pct = (x) => Math.round(x * 100) + '%';

  // ---------- parte pura: calendario y temporadas de un giro ----------
  const cal = () => window.PuveDecisiones && window.PuveDecisiones.calendario;
  function idsFechas(id){ const c = cal(), g = G[id]; if(!c) return []; return c.POR_GIRO[id] || (g ? g.fechas || [] : c.BASE); }
  function proximas(id, hoy, dias){
    const c = cal(); if(!c) return []; const h0 = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()), lim = new Date(h0.getTime() + dias * DIA), out = [];
    idsFechas(id).forEach((k) => { if(!c.FECHAS[k]) return; [h0.getFullYear(), h0.getFullYear() + 1].forEach((y) => { const d = c.FECHAS[k][1](y); if(d >= h0 && d <= lim) out.push({ k, nombre: c.FECHAS[k][0], fecha: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'), dias: Math.round((d - h0) / DIA) }); }); });
    return out.sort((a, b) => a.dias - b.dias);
  }
  const temporada = (id, hoy) => { const g = G[id]; return g && (g.t || []).find((x) => x.ms.includes(hoy.getMonth() + 1)) || null; };
  window.PuveIaGiros = { datos: G, idsFechas, proximas, temporada };

  // ---------- herramienta: indicadores de salud de tu giro medidos con tus datos ----------
  T.registrar({
    nombre: 'conocimiento_giro', descripcion: 'Lo propio de tu giro y cómo vas tú: inventario, caducidad, dependencia, fechas fuertes y temporada', permisos: EQUIPO, produce: ['giro'], entrada: {},
    async ejecutar(){
      const id = enlace().giro && enlace().giro(), g = id && G[id]; if(!g) return { sinGiro: true, id: id || null };
      const an = await D.analisis(), s = g.s || {}, ind = [], hoy = new Date(), ing = an.ing30 || 0;
      if(s.dias){ const largos = an.lista.filter((x) => x.fisico && x.vel > 0 && x.stock > 0 && x.dias > s.dias).sort((a, b) => (b.capital || 0) - (a.capital || 0)), cap = largos.reduce((t, x) => t + (x.capital || 0), 0);
        ind.push({ clave: 'dias', etiqueta: 'Inventario que dura más de lo habitual en tu giro', referencia: 'más de ' + veces(s.dias, 'día', 'días') + ' de existencia', estado: largos.length ? 'atencion' : 'bien', n: largos.length, capital: cap, productos: largos.slice(0, 3).map((x) => ({ nombre: x.nombre, dias: Math.round(x.dias) })) }); }
      if(s.cad){ const c = I.porCaducar(); ind.push({ clave: 'cad', etiqueta: 'Productos que caducan en menos de 7 días', referencia: 'en tu giro conviene que sea cero', estado: c.length ? 'atencion' : 'bien', n: c.length, productos: c.slice(0, 3).map((x) => ({ nombre: x.p.nombre, dias: x.dias })) }); }
      if(s.conc && ing > 0){ const top = an.lista.filter((x) => x.ing30 > 0).sort((a, b) => b.ing30 - a.ing30)[0], parte = top ? top.ing30 / ing : 0;
        ind.push({ clave: 'conc', etiqueta: 'Qué tanto depende tu venta de un solo producto', referencia: 'en tu giro conviene que uno solo no pase de ' + pct(s.conc), estado: parte > s.conc ? 'atencion' : 'bien', parte, producto: top ? top.nombre : null }); }
      return { id, nombre: g.n, indicadores: ind, proximas: proximas(id, hoy, 45), temporada: temporada(id, hoy), referencia: true };
    }
  });

  // ---------- presentación ----------
  const lista = (t, a) => L(t, a.map((x) => [x]));
  const enfoqueDe = (t) => /error|equivoc|mal hech|fall/.test(t) ? 'errores' : (/riesgo|cuidar|peligro|problema/.test(t) ? 'riesgos' : (/fecha|temporada|estacion|epoca|cuando se vende mas|cuando vendo mas/.test(t) ? 'fechas' : (/estrategia|funciona|que hago|que puedo hacer|como vender mas|crecer/.test(t) ? 'estrategias' : (/oportunidad/.test(t) ? 'oportunidades' : (/metrica|numero|indicador|medir|que debo ver/.test(t) ? 'metricas' : (/producto/.test(t) ? 'productos' : 'resumen'))))));
  function bloquesGiro(id, datos, enfoque){
    const g = G[id], o = [], hoy = new Date(), pr = (datos && datos.proximas) || proximas(id, hoy, 90), tp = (datos && datos.temporada) || temporada(id, hoy);
    const fechasTxt = pr.slice(0, 4).map((x) => x.nombre + ' · ' + (x.dias === 0 ? 'hoy' : 'en ' + veces(x.dias, 'día', 'días')));
    const el = { errores: () => o.push(P('Los errores que más se repiten en **' + g.n.toLowerCase() + '**:'), lista('Errores frecuentes', g.x)), riesgos: () => o.push(P('Lo que más conviene cuidar en **' + g.n.toLowerCase() + '**:'), lista('Riesgos frecuentes', g.r)),
      estrategias: () => o.push(P('Lo que suele funcionar en **' + g.n.toLowerCase() + '**:'), lista('Estrategias', g.e)), oportunidades: () => o.push(P('Oportunidades comunes en **' + g.n.toLowerCase() + '**:'), lista('Oportunidades', g.o)),
      metricas: () => o.push(P('Los números que más importan en **' + g.n.toLowerCase() + '**:'), lista('Métricas clave', g.m)), productos: () => o.push(P('Productos típicos de **' + g.n.toLowerCase() + '**:'), lista('Productos típicos', g.p)),
      fechas: () => { if(fechasTxt.length) o.push(P('Fechas fuertes para **' + g.n.toLowerCase() + '** en los próximos meses:'), lista('Fechas', fechasTxt)); else o.push(P('No veo fechas fuertes marcadas para **' + g.n.toLowerCase() + '** en los próximos 3 meses.')); if(tp) o.push(P('**' + tp.n + ':** ' + tp.tip)); else if(!fechasTxt.length) o.push(P('Tu giro no depende tanto de fechas del año: lo importante es la constancia semanal.')); } };
    if(enfoque !== 'resumen'){ el[enfoque](); }
    else { o.push(P('Para **' + g.n.toLowerCase() + '**, esto es lo que conviene tener presente:')); o.push(lista('Lo que más conviene cuidar', g.r.slice(0, 3))); o.push(lista('Errores que se repiten', g.x.slice(0, 3))); if(fechasTxt.length) o.push(lista('Próximas fechas fuertes', fechasTxt.slice(0, 3))); if(tp) o.push(P('**' + tp.n + ':** ' + tp.tip)); }
    const ind = datos && datos.indicadores || [], at = ind.filter((x) => x.estado === 'atencion');
    if(enfoque === 'resumen' || enfoque === 'riesgos'){ if(ind.length) o.push(at.length ? L('Cómo vas tú en eso (referencia general, no regla)', at.map((x) => [x.etiqueta, x.clave === 'conc' ? x.producto + ' · ' + pct(x.parte) : veces(x.n, 'producto', 'productos'), x.referencia])) : P('Con lo que puedo medir de tu giro no veo señales de alerta ahora (referencia general, no regla).')); }
    o.push(P('Es conocimiento general de negocios como el tuyo, no una garantía: tu zona y tus clientes pueden ser distintos.'));
    o.push(C([sug('¿Qué errores comete mi giro?'), sug('¿Qué fechas son fuertes para mi giro?'), sug('¿Qué estrategias funcionan en mi giro?')].filter((x, i) => ['errores', 'fechas', 'estrategias'][i] !== enfoque).slice(0, 3)));
    return o;
  }
  window.PuveIaGiros.bloques = bloquesGiro;

  // ---------- chat: mismo tema «riesgo» (sin tema nuevo ni SQL); la redirección manda aquí las preguntas sobre el giro ----------
  const previoRiesgo = R.handler && R.handler('riesgo');
  const consultaGiro = (t) => /(mi giro|mi tipo de negocio|mi ramo|mi rubro|negocios? (como el mio|de mi tipo|como el de nosotros)|como la mia|como el mio|en mi negocio los errores)/.test(t) || /(errores (frecuentes|comunes|tipicos)|que errores (comete|cometen|tiene|tienen|hay)|que debo cuidar|fechas (importantes|fuertes)|temporadas? (fuertes?|altas?)|estacionalidad|epoca de mas ventas)/.test(t);
  async function riesgo(c){
    const rol = enlace().rol(), id = enlace().giro && enlace().giro(), t = N.norm(c.texto || c.original || ''), g = id && G[id];
    if(consultaGiro(t)){
      if(!g) return [P('Todavía no sé de qué giro es tu negocio. Puedes elegirlo en Configuración → Tipo de negocio y con eso te hablo de lo propio de tu giro.')];
      let datos = null; if(EQUIPO.includes(rol)){ const r = await T.llamar('conocimiento_giro', {}, {}); datos = r.ok && !r.datos.sinGiro ? r.datos : null; }
      return bloquesGiro(id, datos, enfoqueDe(t));
    }
    const base = previoRiesgo ? await previoRiesgo(c) : []; if(!g || !EQUIPO.includes(rol)) return base;
    const r = await T.llamar('conocimiento_giro', {}, {}); if(!r.ok || r.datos.sinGiro) return base;
    const at = r.datos.indicadores.filter((x) => x.estado === 'atencion');
    return base.concat([P('**Lo propio de tu giro (' + G[id].n.toLowerCase() + '):** ' + (at.length ? at.map((x) => x.etiqueta.toLowerCase()).join('; ') + '.' : 'con lo que puedo medir, no veo alertas de tu giro ahora.') + ' Un riesgo que se repite: ' + G[id].r[0].toLowerCase() + '.'), C([sug('¿Qué errores comete mi giro?'), sug('¿Qué fechas son fuertes para mi giro?')])]);
  }
  R.registrarTemas({ riesgo }, {}, {});
  // El NLU reparte estas preguntas en temas muy distintos (ayuda_app, mejor_periodo, seguimiento, o ni las entiende): un gancho PRE decide el tema ANTES de clasificar.
  // Se protege lo que el dueño ya hace con otros temas (metas, ideas, simulador, olvidar memoria, causas) para no secuestrar sus preguntas.
  const OTRA_COSA = /\b(meta|objetivo|olvida|borra|simul|que pasa si|si subo|si bajo|probar|idea|por que|porque)\b/;
  if(R.agregarPre) R.agregarPre((texto) => { const t = N.norm(texto || ''); if(OTRA_COSA.test(t)) return null;
    if(consultaGiro(t) || /\briesgos? (tiene|hay en|tengo en) (mi )?(negocio|tienda)\b/.test(t)) return { intent: 'riesgo' }; return null; });
})();
