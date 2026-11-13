/* PUVE IA · Asesor — memoria del negocio (Etapa 2; motor propio, SIN IA externa)
 * Recuerda entre sesiones, en TU Supabase (tabla ia_asesor_memoria, SQL 134), solo dos cosas del negocio:
 *  · tu META de ventas (por mes o por día) → «¿cómo voy con mi meta?» con proyección honesta y lo que falta por día.
 *  · las IDEAS que decidiste probar, aplicar o descartar, con los números de «antes» → «¿funcionó lo que probé?» compara con lo que pasó después.
 * Las ideas descartadas o ya en marcha dejan de repetirse. Todo se puede borrar: «olvida mi meta», «descarta esa idea», «olvida todo lo de mi negocio».
 * Solo el encargado (admin) la usa. No guarda nada de clientes. Es una comparación, no una prueba: lo dice siempre (temporada, clima y otros cambios también influyen).
 * Si falta correr el SQL 134, sigue funcionando mientras la pantalla esté abierta y avisa que no podrá recordar para la próxima vez.
 */
(function(){
  'use strict';
  const R = window.PuveResumen, A = window.PuveIaAsesor;
  if(!R || !R.internos || !R.agregarRedireccion || !A) return;
  const I = R.internos, { D, N, P, L, C, sug, lista, veces, fmt, $d, $r, puedeCostos } = I;
  const H = {};
  const DIAS_MIN = 14;                       // antes de esto, un resultado sería casualidad
  const DIA_MS = 86400000;
  const pct = (n) => Math.round(Math.abs(n) * 100) + '%';
  const suma = (arr, f) => arr.reduce((s, x) => s + (f(x) || 0), 0);
  const sb = () => (I.enlace() || {}).sb;
  const SOLO_ENCARGADO = () => [P('Las metas y el seguimiento de ideas los maneja el encargado del negocio.')];
  const FALTA_SQL = /does not exist|schema cache|Could not find/i;

  // ---------- almacén (con copia en memoria para que responda rápido y siga funcionando si falla el guardado) ----------
  let cache = null, cargando = null, sinSql = false, usuario = undefined;
  const activo = () => puedeCostos() && !!sb();
  function revisarUsuario(){ const u = (I.enlace().usuarioId && I.enlace().usuarioId()) || null; if(u !== usuario){ usuario = u; cache = null; cargando = null; sinSql = false; } }
  async function cargar(){
    revisarUsuario();
    if(cache) return cache;
    if(cargando) return cargando;
    cargando = (async () => {
      let filas = [];
      try { const r = await sb().rpc('ia_asesor_mem_cargar'); if(r.error) throw r.error; filas = Array.isArray(r.data) ? r.data : []; sinSql = false; }
      catch(e){ if(FALTA_SQL.test((e && e.message) || '')) sinSql = true; }
      cache = filas; cargando = null; return cache;
    })();
    return cargando;
  }
  const fila = (tipo, clave) => (cache || []).find((f) => f.tipo === tipo && f.clave === clave) || null;
  async function guardar(tipo, clave, estado, datos){
    await cargar();
    const ahora = new Date().toISOString(), i = cache.findIndex((f) => f.tipo === tipo && f.clave === clave);
    const nueva = { tipo, clave, estado, datos, creado_en: i >= 0 ? cache[i].creado_en : ahora, actualizado_en: ahora };
    if(i >= 0) cache[i] = nueva; else cache.unshift(nueva);
    try { const r = await sb().rpc('ia_asesor_mem_guardar', { p_tipo: tipo, p_clave: clave, p_estado: estado, p_datos: datos }); if(r.error) throw r.error; return { ok: true }; }
    catch(e){ const m = String((e && e.message) || e); if(FALTA_SQL.test(m)) sinSql = true; return { ok: false, falta: FALTA_SQL.test(m), error: m }; }
  }
  async function borrar(tipo, clave){
    await cargar();
    cache = cache.filter((f) => tipo == null || !(f.tipo === tipo && f.clave === clave));
    try { const r = await sb().rpc('ia_asesor_mem_borrar', { p_tipo: tipo == null ? null : tipo, p_clave: clave == null ? null : clave }); if(r.error) throw r.error; return { ok: true }; }
    catch(e){ const m = String((e && e.message) || e); if(FALTA_SQL.test(m)) sinSql = true; return { ok: false, falta: FALTA_SQL.test(m), error: m }; }
  }
  const nota = (r) => r.ok ? [] : [P(r.falta ? 'Ojo: solo lo recordaré mientras esta pantalla siga abierta, porque falta correr el script SQL 134 en Supabase.' : 'Ojo: no pude guardarlo para la próxima vez (' + String(r.error).slice(0, 80) + '); lo recordaré solo mientras esta pantalla siga abierta.')];
  const hace = (iso) => { const d = Math.floor((Date.now() - new Date(iso).getTime()) / DIA_MS); return d <= 0 ? 'desde hoy' : (d === 1 ? 'desde ayer' : 'desde hace ' + d + ' días'); };
  const diasDesde = (iso) => Math.floor((Date.now() - new Date(iso).getTime()) / DIA_MS);
  const ESTADO = { probando: 'en prueba', aplicada: 'aplicada', descartada: 'descartada' };

  // ---------- meta ----------
  async function progresoMeta(f){
    const monto = Number(f.datos.monto) || 0, ahora = new Date(), d = await D.diario(40), hoyF = D.fechaLocal(ahora);
    const hoy = (d.find((x) => x.fecha === hoyF) || { total: 0 }).total;
    if(f.clave === 'ventas_dia'){
      const previos = d.filter((x) => x.fecha < hoyF).slice(-14), prom = previos.length ? suma(previos, (x) => x.total) / previos.length : 0, ult30 = d.filter((x) => x.fecha < hoyF).slice(-30), cumplio = ult30.filter((x) => x.total >= monto).length;
      return { tipo: 'dia', monto, llevo: hoy, falta: Math.max(0, monto - hoy), prom, cumplio, de: ult30.length };
    }
    const fi = D.fechaLocal(new Date(ahora.getFullYear(), ahora.getMonth(), 1)), delMes = d.filter((x) => x.fecha >= fi), llevo = suma(delMes, (x) => x.total), diasMes = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0).getDate(), pasados = ahora.getDate();
    const completos = delMes.filter((x) => x.fecha < hoyF), previos = d.filter((x) => x.fecha < hoyF).slice(-14);
    const ritmo = completos.length >= 3 ? suma(completos, (x) => x.total) / completos.length : (previos.length ? suma(previos, (x) => x.total) / previos.length : 0);
    const restantes = diasMes - pasados, proy = llevo + ritmo * restantes + Math.max(0, ritmo - hoy);
    return { tipo: 'mes', monto, llevo, falta: Math.max(0, monto - llevo), ritmo, proy, restantes: restantes + 1, necesito: Math.max(0, monto - llevo) / (restantes + 1) };
  }
  function bloquesMeta(g){
    if(g.tipo === 'dia'){
      const o = [P('**Meta diaria: ' + $r(g.monto) + '.** Hoy llevas **' + $r(g.llevo) + '**' + (g.falta > 0 ? ' y te faltan **' + $r(g.falta) + '**.' : ': ¡ya la lograste!')), ];
      if(g.prom) o.push(P('Tu promedio de los últimos días es ' + $r(g.prom) + ' (' + (g.prom >= g.monto ? 'ya está arriba de tu meta' : pct(1 - g.prom / g.monto) + ' abajo de tu meta') + ').' + (g.de ? ' La cumpliste ' + veces(g.cumplio, 'día', 'días') + ' de los últimos ' + g.de + '.' : '')));
      return o;
    }
    const o = [P('**Meta del mes: ' + $r(g.monto) + '.** Llevas **' + $r(g.llevo) + '**' + (g.falta > 0 ? ' y te faltan **' + $r(g.falta) + '**.' : ': ¡ya la lograste! Todo lo demás es ganancia extra.'))];
    if(g.falta > 0 && g.ritmo > 0){
      o.push(P('A tu ritmo de ' + $r(g.ritmo) + ' al día cerrarías cerca de **' + $r(g.proy) + '** (entre ' + $r(g.proy * 0.88) + ' y ' + $r(g.proy * 1.12) + '). ' + (g.proy >= g.monto ? 'Vas en camino.' : 'Te quedarías ' + $r(g.monto - g.proy) + ' corto.')));
      if(g.proy < g.monto) o.push(P('Para llegar necesitas vender unos **' + $r(g.necesito) + ' al día** lo que resta del mes (' + veces(g.restantes, 'día', 'días') + ' contando hoy).'));
    }
    return o;
  }
  const metas = () => (cache || []).filter((f) => f.tipo === 'meta');

  H.fijar_meta = async (c) => {
    if(!puedeCostos()) return SOLO_ENCARGADO();
    await cargar();
    const t = N.norm(c.texto), nums = N.numeros(c.texto).filter((x) => x >= 50);
    if(!nums.length) return [P('¿De cuánto es tu meta? Dime la cantidad, por ejemplo: «mi meta es vender 80 mil al mes» o «mi meta es 3 mil por día».'), C([sug('Mi meta es vender 80 mil al mes')])];
    const monto = Math.max(...nums), dia = /(por dia|diari|al dia|cada dia|hoy)/.test(t) && !/\bmes\b|mensual/.test(t), clave = dia ? 'ventas_dia' : 'ventas_mes';
    if(/semana|semanal/.test(t) && !/\bmes\b|mensual|diari|por dia/.test(t)) return [P('Guardo metas **por mes** o **por día**. Si tu meta de la semana es ' + $r(monto) + ', equivale a unos **' + $r(monto * 4.3) + ' al mes** o **' + $r(monto / 7) + ' por día**. Dime cuál de las dos quieres que guarde.'), C([sug('Mi meta es vender ' + Math.round(monto * 4.3 / 1000) + ' mil al mes'), sug('Mi meta es ' + Math.round(monto / 7) + ' por día')])];
    const previa = fila('meta', clave), d = await D.diario(40), completos = d.filter((x) => x.fecha < D.fechaLocal(new Date())).slice(-28), promDia = completos.length ? suma(completos, (x) => x.total) / completos.length : 0, actual = dia ? promDia : promDia * 30;
    const r = await guardar('meta', clave, 'activa', { monto, creada: new Date().toISOString() }), out = [P('Listo: guardé tu **meta ' + (dia ? 'diaria' : 'del mes') + ' de ' + $r(monto) + '**' + (previa ? ' (cambié la anterior de ' + $r(previa.datos.monto) + ').' : '.'))];
    if(actual > 0 && completos.length >= 7){
      const ratio = monto / actual;
      out.push(P(ratio > 1.5 ? 'Ojo: es una meta **ambiciosa**, ' + pct(ratio - 1) + ' arriba de tu ritmo actual (' + $r(actual) + (dia ? ' al día' : ' al mes') + '). Funciona mejor ir por etapas: por ejemplo ' + $r(actual * 1.2) + (dia ? ' al día' : ' este mes') + ' y subirla después.' : (ratio < 0.9 ? 'Ojo: tu ritmo actual (' + $r(actual) + (dia ? ' al día' : ' al mes') + ') ya está arriba de esa meta. ¿Seguro que no quieres una más alta?' : 'Es una meta **realista**: ' + (ratio >= 1 ? pct(ratio - 1) + ' arriba' : 'muy cerca') + ' de tu ritmo actual (' + $r(actual) + (dia ? ' al día' : ' al mes') + ').')));
    }
    const g = await progresoMeta(fila('meta', clave)); bloquesMeta(g).forEach((b) => out.push(b));
    return out.concat(nota(r), [C([sug('¿Cómo voy con mi meta?'), sug('¿Cómo puedo hacer crecer mi negocio?')])]);
  };

  H.avance_meta = async (c) => {
    if(!puedeCostos()) return SOLO_ENCARGADO();
    await cargar();
    const ms = metas();
    if(!ms.length) return [P('Todavía no tienes una meta guardada. Dime por ejemplo «mi meta es vender 80 mil al mes» o «mi meta es 3 mil por día» y te voy diciendo cómo vas.'), C([sug('Mi meta es vender 80 mil al mes')])].concat(sinSql ? [P('Aviso: para que la recuerde la próxima vez falta correr el script SQL 134 en Supabase.')] : []);
    const out = []; let brecha = false;
    for(const f of ms.sort((a, b) => a.clave < b.clave ? 1 : -1)){ const g = await progresoMeta(f); bloquesMeta(g).forEach((b) => out.push(b)); if(g.tipo === 'mes' && g.proy < g.monto) brecha = true; }
    if(brecha){
      try {
        const r = await A.obtenerIdeas(c.estado), vis = r && r.ideas ? await filtrar(r.ideas) : [], top = vis.filter((i) => i.impacto != null).slice(0, 2);
        if(top.length) out.push(P('Para cerrar esa brecha, lo que más pesa según tus números: ' + lista(top.map((i) => '**' + i.titulo + '**')) + '.'));
      } catch(e){ /* sin ideas, no pasa nada */ }
    }
    out.push(C([sug('¿Cómo puedo hacer crecer mi negocio?'), sug('Dame un plan para la semana')]));
    return out;
  };

  H.borrar_meta = async () => {
    if(!puedeCostos()) return SOLO_ENCARGADO();
    await cargar();
    const ms = metas(); if(!ms.length) return [P('No tengo ninguna meta guardada, así que no hay nada que borrar.')];
    let r = { ok: true }; for(const f of ms){ r = await borrar('meta', f.clave); }
    return [P('Listo, olvidé tu meta. Cuando quieras otra, dime por ejemplo «mi meta es vender 80 mil al mes».')].concat(nota(r));
  };

  // ---------- ideas: probar, descartar, medir ----------
  const describirBase = (m) => m.k === 'unid' ? veces(Math.round(m.base.u * 10) / 10, 'pieza', 'piezas') + ' por día y ' + $r(m.base.i) + ' de ventas por día de ' + lista(m.prods)
    : (m.k === 'hora' ? $r(m.base.t) + ' por día en esa hora' : (m.k === 'dia' ? $r(m.base.t) + ' ese día de la semana' : 'un ticket promedio de ' + $d(m.base.t)));

  H.idea_probar = async (c) => {
    if(!puedeCostos()) return SOLO_ENCARGADO();
    await cargar();
    const st = A.memoria(c.estado), i = st.ultima;
    if(!i) return [P('¿Cuál idea vas a probar? Primero te doy ideas con tus números y luego me dices con cuál empiezas.'), C([sug('¿Cómo puedo hacer crecer mi negocio?')])];
    const t = N.norm(c.texto), ya = /\bya\b.*\b(aplique|hice|probe|puse|subi|cambie|empece|estoy|lo estoy|la estoy)/.test(t), estado = ya ? 'aplicada' : 'probando', previa = fila('idea', 'idea:' + i.id);
    if(previa && (previa.estado === 'probando' || previa.estado === 'aplicada')) return [P('Esa ya la tengo anotada ' + hace(previa.datos.inicio) + '. Cuando lleve al menos ' + DIAS_MIN + ' días, pregúntame «¿funcionó?» y comparo los números.'), C([sug('¿Cómo van mis ideas?'), sug('Dame otra idea')])];
    const r = await guardar('idea', 'idea:' + i.id, estado, { titulo: String(i.titulo).slice(0, 120), inicio: new Date().toISOString(), medicion: i.medicion || null, medir: String(i.medir || '').slice(0, 300) });
    const out = [P('Anotado: **' + i.titulo + '** quedó **' + ESTADO[estado] + '** desde hoy.')];
    out.push(P(i.medicion ? 'Guardé tus números de «antes»: ' + describirBase(i.medicion) + '. En **' + DIAS_MIN + ' días** pregúntame «¿funcionó?» y los comparo con lo que pase.' : 'Esta idea no la puedo medir sola con tus ventas. Más adelante cuéntame cómo te fue y lo anoto.'));
    if(ya) out.push(P('Como ya la habías empezado, mis números de «antes» pueden incluir días con la idea: la comparación será menos precisa.'));
    return out.concat(nota(r), [C([sug('¿Cómo van mis ideas?'), sug('Dame otra idea')])]);
  };

  H.idea_descartar = async (c) => {
    if(!puedeCostos()) return SOLO_ENCARGADO();
    await cargar();
    const i = A.memoria(c.estado).ultima;
    if(!i) return [P('¿Cuál idea quieres descartar? Dime de cuál hablas o pídeme ideas y me dices cuál no te sirve.'), C([sug('¿Cómo puedo hacer crecer mi negocio?')])];
    const r = await guardar('idea', 'idea:' + i.id, 'descartada', { titulo: String(i.titulo).slice(0, 120), inicio: new Date().toISOString(), medicion: null, medir: '' });
    return [P('Hecho: descarté **' + i.titulo + '** y no te la vuelvo a sugerir. Si cambias de opinión, pregúntame «¿cómo van mis ideas?» y la reactivo.')].concat(nota(r), [C([sug('Dame otra idea'), sug('¿Cómo van mis ideas?')])]);
  };

  // lee cuánto cambió lo que se midió, contra los números de «antes»
  const cambio = (ahora, antes) => antes > 0 ? (ahora - antes) / antes : null;
  async function evaluar(f){
    const d = f.datos || {}, m = d.medicion, dias = diasDesde(d.inicio);
    if(!m) return { dias, medible: false };
    if(dias < DIAS_MIN) return { dias, pronto: true };
    const inicio = new Date(d.inicio), pd = await D.cargarPeriodo({ desde: inicio, hasta: new Date(Date.now() + 60000), prevDesde: new Date(inicio.getTime() - 30 * DIA_MS), prevHasta: inicio }, true), a = pd.act, nd = Math.max(1, dias);
    if(a.n < 10) return { dias, pocas: true };
    let filas = [], principal = null, etiqueta = '';
    if(m.k === 'unid'){
      const ps = m.prods.map((n) => a.productos[n] || { cant: 0, monto: 0, margen: 0 }), u = suma(ps, (x) => x.cant) / nd, i = suma(ps, (x) => x.monto) / nd, hayG = m.base.g != null && a.margen != null, g = hayG ? suma(ps, (x) => x.margen) / nd : null;
      const cu = cambio(u, m.base.u), ci = cambio(i, m.base.i), cg = hayG ? cambio(g, m.base.g) : null;
      filas.push(['Piezas por día', fmt(Math.round(u * 10) / 10), 'antes ' + fmt(Math.round(m.base.u * 10) / 10) + (cu == null ? '' : ' (' + (cu >= 0 ? '+' : '−') + pct(cu) + ')')]);
      filas.push(['Ventas por día', $r(i), 'antes ' + $r(m.base.i) + (ci == null ? '' : ' (' + (ci >= 0 ? '+' : '−') + pct(ci) + ')')]);
      if(hayG) filas.push(['Ganancia por día', $r(g), 'antes ' + $r(m.base.g) + (cg == null ? '' : ' (' + (cg >= 0 ? '+' : '−') + pct(cg) + ')')]);
      principal = m.precio ? (hayG ? cg : ci) : cu; etiqueta = m.precio ? (hayG ? 'la ganancia' : 'las ventas') : 'las piezas vendidas';
    } else if(m.k === 'hora'){
      const t = a.porHora[m.h] / nd, c1 = cambio(t, m.base.t); filas.push(['Ventas por día en esa hora', $r(t), 'antes ' + $r(m.base.t) + (c1 == null ? '' : ' (' + (c1 >= 0 ? '+' : '−') + pct(c1) + ')')]); principal = c1; etiqueta = 'las ventas de esa hora';
    } else if(m.k === 'dia'){
      let oc = 0; for(let k = 0; k < dias; k++) if(new Date(Date.now() - k * DIA_MS).getDay() === m.d) oc++;
      if(oc < 2) return { dias, pronto: true };
      const t = a.porDia[m.d] / oc, c1 = cambio(t, m.base.t); filas.push(['Ventas ese día de la semana', $r(t), 'antes ' + $r(m.base.t) + (c1 == null ? '' : ' (' + (c1 >= 0 ? '+' : '−') + pct(c1) + ')')]); principal = c1; etiqueta = 'las ventas de ese día';
    } else if(m.k === 'ticket'){
      const c1 = cambio(a.ticket, m.base.t); filas.push(['Ticket promedio', $d(a.ticket), 'antes ' + $d(m.base.t) + (c1 == null ? '' : ' (' + (c1 >= 0 ? '+' : '−') + pct(c1) + ')')]); principal = c1; etiqueta = 'lo que gasta cada cliente';
    } else return { dias, medible: false };
    const veredicto = principal == null ? 'sin datos' : (principal >= 0.1 ? 'subió' : (principal <= -0.1 ? 'bajó' : 'sin cambio claro'));
    return { dias, filas, veredicto, principal, etiqueta };
  }
  function bloquesEvaluacion(f, e){
    const o = [P('**' + f.datos.titulo + '** · ' + ESTADO[f.estado] + ' ' + hace(f.datos.inicio) + '.')];
    if(e.medible === false) return o.concat([P('Esta idea no la puedo medir sola con tus ventas. Cuéntame cómo te fue y lo anoto.')]);
    if(e.pronto) return o.concat([P('Todavía es pronto: lleva ' + veces(e.dias, 'día', 'días') + ' y necesito al menos ' + DIAS_MIN + ' para no confundir una buena o mala semana con el efecto de la idea. Pregúntame de nuevo en ' + veces(DIAS_MIN - e.dias, 'día', 'días') + '.')]);
    if(e.pocas) return o.concat([P('En estos días hubo muy pocas ventas (menos de 10) y con eso cualquier comparación sería inventada.')]);
    o.push(L('Antes y ahora', e.filas));
    const texto = { 'subió': 'Pinta **bien**: ' + e.etiqueta + ' subió ' + pct(e.principal) + '. Si te convence, déjala y busca la siguiente idea.', 'bajó': 'Pinta **mal**: ' + e.etiqueta + ' bajó ' + pct(e.principal) + '. Si fue por la idea, conviene regresar al estado anterior y probar otra.', 'sin cambio claro': 'No hay un cambio claro (menos de 10% en ' + e.etiqueta + '). Puedes darle unos días más o probar otra idea.', 'sin datos': 'No tengo con qué comparar.' }[e.veredicto];
    o.push(P(texto));
    o.push(P('Ojo: esto compara contra tus números de antes de empezar. También influyen la temporada, el clima y otros cambios, así que es una **pista, no una prueba**.'));
    return o;
  }
  const PALABRAS = [[/combo/, 'combo'], [/precio|subi|cobr/, 'precios'], [/oferta|promo|hora|horario/, 'hora'], [/\bdia\b|lunes|martes|miercoles|jueves|viernes|sabado|domingo/, 'dia'], [/ticket|cliente|gasta/, 'ticket'], [/empuj|impuls|producto/, 'impulsar']];
  const enMarcha = () => (cache || []).filter((f) => f.tipo === 'idea' && (f.estado === 'probando' || f.estado === 'aplicada'));

  H.resultado_idea = async (c) => {
    if(!puedeCostos()) return SOLO_ENCARGADO();
    await cargar();
    const marcha = enMarcha();
    if(!marcha.length) return [P('Todavía no tienes ninguna idea en prueba. Cuando elijas una, dime «voy a probarla» y guardo tus números de «antes» para poder comparar después.'), C([sug('¿Cómo puedo hacer crecer mi negocio?')])].concat(sinSql ? [P('Aviso: para que lo recuerde la próxima vez falta correr el script SQL 134 en Supabase.')] : []);
    const t = N.norm(c.texto), ult = A.memoria(c.estado).ultima;
    let f = null; const hit = PALABRAS.find(([re]) => re.test(t)); if(hit) f = marcha.find((x) => x.clave === 'idea:' + hit[1]) || null;
    if(!f && ult) f = marcha.find((x) => x.clave === 'idea:' + ult.id) || null;
    if(!f && marcha.length === 1) f = marcha[0];
    if(!f) return H.seguimiento(c);
    return bloquesEvaluacion(f, await evaluar(f)).concat([C([sug('¿Cómo van mis ideas?'), sug('Dame otra idea')])]);
  };

  H.seguimiento = async () => {
    if(!puedeCostos()) return SOLO_ENCARGADO();
    await cargar();
    const out = [], ms = metas(), ideas = (cache || []).filter((f) => f.tipo === 'idea');
    if(!ms.length && !ideas.length) return [P('Todavía no tengo nada guardado de tu negocio. Puedo recordar **tu meta de ventas** y **las ideas que decidas probar** (con los números de «antes» para medir si funcionaron).'), C([sug('Mi meta es vender 80 mil al mes'), sug('¿Cómo puedo hacer crecer mi negocio?')])].concat(sinSql ? [P('Aviso: para que lo recuerde de una vez para otra falta correr el script SQL 134 en Supabase.')] : []);
    if(ms.length) out.push(L('Tus metas', ms.map((f) => [f.clave === 'ventas_dia' ? 'Meta diaria' : 'Meta del mes', $r(f.datos.monto), 'guardada ' + hace(f.creado_en).replace('desde ', '')])));
    if(ideas.length){
      const filas = []; let evaluadas = 0;
      for(const f of ideas){
        let det = hace(f.datos.inicio);
        if((f.estado === 'probando' || f.estado === 'aplicada') && evaluadas < 3){ evaluadas++; const e = await evaluar(f); det += e.veredicto ? ' · ' + (e.veredicto === 'sin cambio claro' ? 'sin cambio claro' : e.etiqueta + ' ' + e.veredicto + ' ' + pct(e.principal)) : (e.pronto ? ' · aún es pronto (' + veces(DIAS_MIN - e.dias, 'día', 'días') + ' más)' : (e.medible === false ? ' · no medible sola' : '')); }
        filas.push([f.datos.titulo, ESTADO[f.estado] || f.estado, det]);
      }
      out.push(L('Tus ideas', filas));
    }
    out.push(P('Puedes pedirme «olvida mi meta», «descarta esa idea» o «olvida todo lo de mi negocio». Esto vive solo en tu cuenta de PUVE y no se comparte con nadie.'));
    out.push(C([sug('¿Funcionó lo que probé?'), sug('Dame otra idea')]));
    return out.concat(sinSql ? [P('Aviso: falta correr el script SQL 134 en Supabase; por ahora solo lo recuerdo mientras esta pantalla siga abierta.')] : []);
  };

  H.olvidar_memoria = async (c) => {
    if(!puedeCostos()) return SOLO_ENCARGADO();
    await cargar();
    const t = N.norm(c.texto);
    if(!/^si\b|\bconfirmo\b/.test(t)) return [P('Esto borra **tu meta** y el seguimiento de **todas tus ideas**, y no se puede deshacer. ¿Seguro?'), C([sug('Sí, olvida todo lo de mi negocio'), sug('No, déjalo')])];
    const n = (cache || []).length, r = await borrar(null, null);
    return [P(n ? 'Listo: olvidé tu meta y el seguimiento de tus ideas (' + veces(n, 'registro', 'registros') + '). Empezamos de cero.' : 'No tenía nada guardado, así que ya estás en cero.')].concat(nota(r));
  };

  // ---------- gancho hacia el asesor: qué ideas mostrar y qué recordar al empezar ----------
  async function filtrar(ideas){
    await cargar();
    return ideas.filter((i) => { const f = fila('idea', 'idea:' + i.id); return !f || f.estado === 'activa'; });
  }
  async function encabezado(){
    await cargar();
    const o = [], marcha = enMarcha(), ms = metas().filter((f) => f.clave === 'ventas_mes');
    if(ms.length){ try { const g = await progresoMeta(ms[0]); if(g.falta > 0 && g.ritmo > 0) o.push(P('Tu meta del mes es ' + $r(g.monto) + ' y a tu ritmo cerrarías cerca de ' + $r(g.proy) + (g.proy >= g.monto ? ': vas en camino.' : ': de eso justo hablan estas ideas.'))); } catch(e){} }
    if(marcha.length) o.push(P('Ya tienes en marcha: ' + lista(marcha.slice(0, 3).map((f) => '**' + f.datos.titulo + '** (' + hace(f.datos.inicio).replace('desde ', 'desde ') + ')')) + '. No te las repito.'));
    return o;
  }

  // ---------- se engancha al chat ----------
  const NUEVOS = ['fijar_meta', 'avance_meta', 'borrar_meta', 'idea_probar', 'idea_descartar', 'resultado_idea', 'seguimiento', 'olvidar_memoria'];
  NUEVOS.forEach((t) => N.SOLO_ENCARGADO.add(t));
  R.registrarTemas(H, { fijar_meta: 'Guardar mi meta', avance_meta: '¿Cómo voy con mi meta?', borrar_meta: 'Olvidar mi meta', idea_probar: 'Voy a probar la idea', idea_descartar: 'Descartar la idea', resultado_idea: '¿Funcionó lo que probé?', seguimiento: '¿Cómo van mis ideas?', olvidar_memoria: 'Olvidar todo lo del negocio' },
    { fijar_meta: 'Guardando tu meta…', avance_meta: 'Calculando cómo vas con tu meta…', borrar_meta: 'Borrando tu meta…', idea_probar: 'Anotando tus números de antes…', idea_descartar: 'Descartando la idea…', resultado_idea: 'Comparando antes y después…', seguimiento: 'Revisando lo que recuerdo de tu negocio…', olvidar_memoria: 'Revisando…' });

  // la pregunta de metas que ya existía («quiero vender 5 mil hoy») sigue igual; solo se desvía cuando claramente es guardar o consultar la meta guardada
  R.agregarRedireccion(async (intent, ctx) => {
    if(intent !== 'meta' || !activo()) return null;
    const t = N.norm(ctx.texto || ''), nums = N.numeros(ctx.texto || '').filter((x) => x >= 50);
    if(nums.length && /(guarda|recuerda|fija|establece|anota|registra|mi meta (es|del mes|mensual|diaria|semanal|de la semana)|mi objetivo|nueva meta|cambia mi meta|actualiza mi meta|pon mi meta)/.test(t)) return 'fijar_meta';
    if(!nums.length){ await cargar(); if(metas().length) return 'avance_meta'; }
    return null;
  });

  window.PuveIaAsesorMemoria = { activo, filtrar, encabezado, cargar, evaluar, internos: { progresoMeta, enMarcha, metas, reiniciar(){ cache = null; cargando = null; sinSql = false; usuario = undefined; } } };
})();
