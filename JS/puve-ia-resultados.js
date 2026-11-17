/* PUVE IA · Lo que aprendes de TUS decisiones y lo que pides no ver (Etapas 6, 8 y 9 del plan de arquitectura, MD §14–15, §41–45; motor propio, SIN IA externa)
 * Necesita el SQL 135 (extiende la memoria del 134 con los tipos «experimento» y «preferencia»; mismas reglas: solo el encargado, límites, sin acceso directo a la tabla).
 *   · RECUERDA los resultados: cada cambio de precio ya evaluado (puve-ia-experimentos.js) se guarda con su veredicto y su rango (solo si ya pasaron 2 semanas completas;
 *     con 1 semana es demasiado preliminar). No guarda clientes ni texto libre: nombre corto del producto, precios, fecha, veredicto y cifras.
 *   · APRENDE de tu propio historial: «¿cómo me han ido mis cambios de precio?» resume cuántos funcionaron, cuántos no tuvieron efecto claro y cuántos salieron mal, separando
 *     subidas y bajadas. Con pocos casos dice que son pocos para sacar una regla. Aprende SOLO de tu negocio: no compara con otros negocios.
 *   · SILENCIA avisos: «no me avises de caducidades [por 7 días]» y «vuelve a avisarme de caducidades». Máximo 30 días; lo silenciado no se marca como «ya avisado»,
 *     así que al terminar el silencio sí se avisa.
 *   · TRANSPARENCIA: todo aparece en «¿qué recuerdas de mi negocio?» y se borra con «olvida todo lo de mi negocio» (que avisa qué se va a borrar).
 * Se carga después de puve-ia-giros.js.
 */
(function(){
  'use strict';
  const R = window.PuveResumen, M = window.PuveIaAsesorMemoria, EX = window.PuveIaExperimentos;
  if(!R || !R.internos || !M || !EX || !R.registrarTemas) return;
  const I = R.internos, { N, P, L, C, sug, veces, $d } = I, DIA = 86400000;
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const fechaTxt = (d) => d.getDate() + ' de ' + MESES[d.getMonth()];
  const pct = (x) => Math.round(Math.abs(x) * 100) + '%', sgn = (x) => (x >= 0 ? '+' : '−') + pct(x);
  const TOPE_EXPERIMENTOS = 55;   // el servidor acepta 60; se borran los más viejos antes de llegar
  const ETQ = { favorable: 'Funcionó', tiende_favorable: 'Tiende a funcionar', sin_efecto: 'Sin efecto claro', tiende_desfavorable: 'Tiende a salir mal', desfavorable: 'Salió mal' };
  const NOTA_SQL = () => [P('No pude guardar esto para la próxima vez (lo más probable es que falte correr el script SQL 135 en Supabase). Lo que te dije arriba sigue valiendo.')];

  // ---------- recordar resultados ----------
  const claveExp = (c) => 'pp:' + String(c.id).replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 8) + ':' + String(c.fecha).replace(/-/g, '');   // ≤ 20 caracteres, solo [a-z0-9:]
  const r3 = (x) => Math.round(x * 1000) / 1000, r2 = (x) => Math.round(x * 100) / 100;
  function registroDe(c){ const mp = c.metricas.find((m) => m.k === c.principal) || {}; return { n: String(c.nombre).slice(0, 40), de: r2(c.de), a: r2(c.a), f: c.fecha, v: c.veredicto, p: c.principal, r: mp.relativo == null ? null : r3(mp.relativo), lo: mp.ic ? r3(mp.ic[0]) : null, hi: mp.ic ? r3(mp.ic[1]) : null, s: c.semanas, e: new Date().toISOString().slice(0, 10) }; }
  async function guardarResultados(cambios){
    if(!M.activo()) return { guardados: 0, fallo: false };
    await M.cargar(); let guardados = 0, fallo = false;
    for(const c of cambios){
      if(!c.veredicto || c.semanas < 2 || !c.metricas) continue;   // con 1 semana el resultado es muy preliminar
      const clave = claveExp(c), previo = M.fila('experimento', clave), reg = registroDe(c);
      if(previo && previo.datos.v === reg.v && previo.datos.s === reg.s) continue;   // ya estaba igual
      if(!previo){ const todas = M.filas('experimento'); if(todas.length >= TOPE_EXPERIMENTOS){ const vieja = todas.slice().sort((a, b) => new Date(a.actualizado_en) - new Date(b.actualizado_en))[0]; await M.borrar('experimento', vieja.clave); } }
      const r = await M.guardar('experimento', clave, 'evaluada', reg); if(r.ok) guardados++; else fallo = true;
    }
    return { guardados, fallo };
  }
  // el tema «resultado_idea» (¿funcionó el cambio de precio?) evalúa; aquí se recuerda lo evaluado, y se dice
  const previoRes = R.handler && R.handler('resultado_idea');
  async function resultado(c){
    const out = previoRes ? await previoRes(c) : [];
    if(!EX.ultimo || Date.now() - EX.ultimo.cuando > 15000 || !I.puedeCostos()) return out;
    const r = await guardarResultados(EX.ultimo.cambios); EX.ultimo = null;
    if(r.fallo) return out.concat(NOTA_SQL());
    return r.guardados ? out.concat([P('Guardé ' + (r.guardados === 1 ? 'este resultado' : 'estos ' + r.guardados + ' resultados') + ' para recordarlo y aprender de tus decisiones. Lo ves con «¿cómo me han ido mis cambios de precio?» y lo borras con «olvida todo lo de mi negocio».')]) : out;
  }

  // ---------- aprender de tu propio historial ----------
  function resumen(filas){
    const reg = filas.map((f) => f.datos).filter((d) => d && d.v), sube = reg.filter((d) => d.a > d.de), baja = reg.filter((d) => d.a < d.de);
    const cuenta = (a) => ({ n: a.length, ok: a.filter((d) => d.v === 'favorable' || d.v === 'tiende_favorable').length, mal: a.filter((d) => d.v === 'desfavorable' || d.v === 'tiende_desfavorable').length, nada: a.filter((d) => d.v === 'sin_efecto').length });
    return { total: reg.length, sube: cuenta(sube), baja: cuenta(baja) };
  }
  const frase = (et, c) => c.n ? 'De tus ' + c.n + ' ' + et + ': ' + veces(c.ok, 'funcionó', 'funcionaron') + ', ' + veces(c.nada, 'no tuvo efecto claro', 'no tuvieron efecto claro') + ' y ' + veces(c.mal, 'salió mal', 'salieron mal') + '.' : null;
  function leccion(c, etiqueta){
    if(c.n < 3) return null;
    const t = c.ok / c.n; return t >= 0.67 ? 'Tus ' + etiqueta + ' tienden a funcionarte, pero evalúa cada caso: el que viene puede ser distinto.' : (t <= 0.34 ? 'Tus ' + etiqueta + ' no han funcionado bien hasta ahora: antes de la próxima conviene probar con un cambio más chico o en un solo producto.' : 'Tus ' + etiqueta + ' han dado resultados mezclados: no hay una regla clara todavía.');
  }
  async function misResultados(){
    if(!I.puedeCostos()) return [P('Eso lo ve solo el encargado del negocio.')];
    await M.cargar(); const filas = M.filas('experimento').slice().sort((a, b) => (b.datos.f || '').localeCompare(a.datos.f || ''));
    if(!filas.length) return [P('Todavía no tengo resultados guardados. Cada vez que me preguntes si funcionó un cambio de precio (y ya hayan pasado 2 semanas completas), lo recuerdo para ir aprendiendo de tus decisiones.'), C([sug('¿Funcionó el cambio de precio?')])].concat(M.sinSql() ? [P('Aviso: para que lo recuerde de una vez para otra falta correr el script SQL 135 en Supabase.')] : []);
    const r = resumen(filas), out = [L('Tus cambios de precio evaluados', filas.slice(0, 8).map((f) => { const d = f.datos; return [d.n, $d(d.de) + ' → ' + $d(d.a) + ' (' + (d.f || '').slice(0, 10) + ')', (ETQ[d.v] || d.v) + (d.r == null ? '' : ' · ' + (d.p === 'utilidad' ? 'ganancia' : 'ventas') + ' ' + sgn(d.r))]; }))];
    [frase('subidas de precio', r.sube), frase('bajadas de precio', r.baja)].filter(Boolean).forEach((x) => out.push(P(x)));
    const l = leccion(r.sube, 'subidas de precio') || leccion(r.baja, 'bajadas de precio');
    out.push(P(l || 'Son pocos casos para sacar una regla; sigue evaluando tus cambios y te iré diciendo qué tiende a funcionarte.'));
    out.push(P('Aprendo solo de tu negocio: no lo comparo con otros. Puedes borrar todo con «olvida todo lo de mi negocio».'));
    return out;
  }

  // ---------- silenciar avisos ----------
  const CATS = [['caducidad', /caduc|vencer|vencim|venc/], ['inventario', /stock|inventario|agot|acab|existenc/], ['ayer', /\bayer\b/], ['ideas', /\bideas?\b|\bpruebas?\b/], ['meta', /\bmetas?\b/], ['ventas', /ventas?/]];
  const NOMBRE_CAT = { caducidad: 'caducidades', inventario: 'inventario (agotados y por agotarse)', ayer: 'cómo te fue ayer', ideas: 'las ideas que probaste', meta: 'tu meta', ventas: 'las ventas desde tu última visita' };
  const catDe = (t) => { const c = CATS.find(([, re]) => re.test(t)); return c ? c[0] : null; };
  const RE_SILENCIO = /\bno me (avises|digas|menciones|molestes|recuerdes|notifiques|des avisos?)\b/, RE_REACTIVAR = /\b(vuelve a avisarme|ya puedes avisarme|avisame otra vez|activa (los )?avisos?|reactiva (los )?avisos?)\b/;
  async function silenciar(c){
    if(!I.puedeCostos()) return [P('Eso lo ve solo el encargado del negocio.')];
    const t = N.norm(c.texto || c.original || ''), cat = catDe(t);
    if(!cat) return [P('Puedo dejar de avisarte de: **caducidades**, **inventario** (agotados), **cómo te fue ayer**, **las ideas que probaste**, **tu meta** o **las ventas desde tu última visita**. ¿De cuál?'), C([sug('No me avises de caducidades'), sug('No me avises de la meta'), sug('No me avises de ayer')])];
    const m = t.match(/por (\d{1,2}) (dias?|semanas?)/), dias = Math.min(30, Math.max(1, m ? Number(m[1]) * (/semana/.test(m[2]) ? 7 : 1) : 14)), hasta = new Date(Date.now() + dias * DIA);
    await M.cargar(); const r = await M.guardar('preferencia', 'silencio:' + cat, 'activa', { cat, hasta: hasta.toISOString(), desde: new Date().toISOString().slice(0, 10) });
    return [P('Listo: no te avisaré de **' + NOMBRE_CAT[cat] + '** durante ' + veces(dias, 'día', 'días') + ' (hasta el ' + fechaTxt(hasta) + '). Para reactivarlo, dime «vuelve a avisarme de ' + (cat === 'caducidad' ? 'caducidades' : cat) + '».' + (cat === 'inventario' ? ' Ojo: así tampoco te avisaré si algo se agota.' : '')), ...(r.ok ? [] : NOTA_SQL())];
  }
  async function reactivar(c){
    if(!I.puedeCostos()) return [P('Eso lo ve solo el encargado del negocio.')];
    const cat = catDe(N.norm(c.texto || c.original || '')); await M.cargar();
    if(!cat) return [P('¿De qué quieres que vuelva a avisarte?'), C([sug('Vuelve a avisarme de caducidades'), sug('Vuelve a avisarme de la meta')])];
    if(!M.fila('preferencia', 'silencio:' + cat)) return [P('No tenía silenciado ese aviso: te sigo avisando de **' + NOMBRE_CAT[cat] + '** como siempre.')];
    const r = await M.borrar('preferencia', 'silencio:' + cat);
    return [P('Listo: vuelvo a avisarte de **' + NOMBRE_CAT[cat] + '**.')].concat(r.ok ? [] : NOTA_SQL());
  }

  // ---------- transparencia: qué recuerdo y qué se borra ----------
  const vigentes = () => [...M.silenciados()];
  function previoDe(nombre){ return R.handler && R.handler(nombre); }
  const pSeg = previoDe('seguimiento'), pOlv = previoDe('olvidar_memoria'), pApr = previoDe('como_aprendes');
  async function seguimiento(c){
    const out = pSeg ? await pSeg(c) : []; if(!I.puedeCostos()) return out; await M.cargar();
    const ex = M.filas('experimento'), sil = vigentes(); if(!ex.length && !sil.length) return out;
    // si no había nada más guardado, el mensaje de «todavía no tengo nada» ya no es cierto: se quita
    const base = out.filter((b) => !(b && b.t === 'p' && /Todavía no tengo nada guardado/.test(b.x || '')));
    if(ex.length) base.push(P('Recuerdo el resultado de **' + veces(ex.length, 'cambio de precio', 'cambios de precio') + '** que ya evaluaste (pregúntame «¿cómo me han ido mis cambios de precio?»).'));
    if(sil.length) base.push(L('Avisos que silenciaste', sil.map((k) => { const f = M.fila('preferencia', 'silencio:' + k); return [NOMBRE_CAT[k] || k, 'hasta el ' + fechaTxt(new Date(f.datos.hasta))]; })));
    return base;
  }
  async function olvidar(c){
    if(!I.puedeCostos() || !pOlv) return pOlv ? pOlv(c) : [];
    await M.cargar(); const nEx = M.filas('experimento').length, nPr = M.filas('preferencia').length, confirma = /^si\b|\bconfirmo\b/.test(N.norm(c.texto || ''));
    const out = await pOlv(c); if(!nEx && !nPr) return out;
    const extra = [nEx ? veces(nEx, 'resultado de cambio de precio', 'resultados de cambios de precio') : null, nPr ? veces(nPr, 'preferencia de avisos', 'preferencias de avisos') : null].filter(Boolean).join(' y ');
    if(confirma) return out.concat([P('También olvidé ' + extra + '.')]);
    out.splice(1, 0, P('También se borran ' + extra + '.')); return out;
  }
  async function comoAprendes(c){
    const out = pApr ? await pApr(c) : []; if(!I.puedeCostos()) return out; await M.cargar(); const ex = M.filas('experimento'); if(!ex.length) return out;
    const r = resumen(ex); return out.concat([P('**Lo que he aprendido de tus decisiones:** evalué ' + veces(r.total, 'cambio de precio', 'cambios de precio') + ' tuyos (' + (r.sube.ok + r.baja.ok) + ' funcionaron). Lo aprendo solo de tu negocio, nunca de otros.')]);
  }

  R.registrarTemas({ resultado_idea: resultado, mis_resultados: misResultados, silenciar_aviso: silenciar, reactivar_aviso: reactivar, seguimiento, olvidar_memoria: olvidar, como_aprendes: comoAprendes }, {}, { mis_resultados: 'Revisando tus resultados…' });
  // ganchos PRE: estas frases no son de ningún tema que el NLU conozca, así que se decide el tema antes de clasificar
  const NO_RES = /\b(funcion|sirvi)/;
  if(R.agregarPre) R.agregarPre((texto) => { const t = N.norm(texto || '');
    if(RE_REACTIVAR.test(t)) return { intent: 'reactivar_aviso' };
    if(RE_SILENCIO.test(t) && (/\bno me (avises|notifiques|molestes|des avisos?)\b/.test(t) || catDe(t))) return { intent: 'silenciar_aviso' };   // «no me digas…» a secas es una muletilla: solo cuenta si nombra algo
    if(!NO_RES.test(t) && /(como me (han ido|fueron|salieron|van)|que (he|has|hemos) aprendido|resultados? de|historial de|cuantos de mis|cuales de mis).*(cambios? de precio|decisiones|experimentos|subidas? de precio|bajadas? de precio)|\bmis (cambios de precio|decisiones)\b.*(resultado|historial|aprend)/.test(t)) return { intent: 'mis_resultados' };
    return null; });
  window.PuveIaResultados = { guardarResultados, resumen, claveExp, registroDe, internos: { catDe, TOPE_EXPERIMENTOS } };
})();
