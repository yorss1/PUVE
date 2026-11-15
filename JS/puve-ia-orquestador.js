/* PUVE IA · Orquestador e investigación empresarial (Etapas 3 y 4 del plan de arquitectura; motor propio, SIN IA externa)
 * Lo que cambia frente a un «if por pregunta»: aquí NO hay una ruta fija para «¿por qué vendo menos?». Hay una META («explicar un cambio») y un ciclo:
 *   1) decide qué necesita saber y elige herramientas según lo que YA encontró (la ruta se arma sobre la marcha, y puede cambiar a mitad del camino),
 *   2) las ejecuta (hasta 3 a la vez), valida los resultados y los integra como HIPÓTESIS con una confianza calculada,
 *   3) se detiene cuando ya explicó lo suficiente (o cuando no hay datos, no hay cambio o el cambio cabe en lo normal) y
 *   4) responde separando HECHO · EVIDENCIA · HIPÓTESIS · RECOMENDACIÓN, sin convertir una hipótesis en hecho.
 * Ejemplos de bifurcación: si el cambio es «menos gente» revisa horas y días antes que productos; si es «cada quien gastó menos» empieza por productos y precios;
 * si un producto explica la baja, revisa el inventario para ver si simplemente se agotó; si el cambio cabe en lo normal de tus días, NO inventa una causa.
 * Solo lee (a través de las herramientas controladas). Cada paso queda registrado para poder contestar «¿cómo lo averiguaste?».
 * Se carga después de puve-ia-herramientas.js.
 */
(function(){
  'use strict';
  const R = window.PuveResumen, RZ = window.PuveIaRazonamiento, T = window.PuveIaHerramientas;
  if(!R || !R.internos || !RZ || !T || !R.registrarTemas) return;
  const I = R.internos, { N, P, L, C, sug, lista, veces, fmt, $d, $r, en } = I, enlace = () => I.enlace();
  const MAX_RONDAS = 4, EN_PARALELO = 3;
  const METAS = {};
  const registrarMeta = (nombre, def) => { METAS[nombre] = def; };

  // ---------- el ciclo general (sirve para cualquier meta) ----------
  async function investigar(nombre, ctx){
    const M = METAS[nombre]; if(!M) throw new Error('Meta desconocida: ' + nombre);
    const mem = { ctx, pasos: [], hechos: new Set(), hipotesis: [], avisos: [], resultados: {}, rondas: 0 };
    for(; mem.rondas < MAX_RONDAS; mem.rondas++){
      const cand = M.candidatas(mem).filter((c) => !mem.hechos.has(c.id)).sort((a, b) => b.prioridad - a.prioridad).slice(0, EN_PARALELO);
      if(!cand.length) break;
      const res = await Promise.all(cand.map((c) => T.llamar(c.herramienta, c.args, ctx)));
      cand.forEach((c, i) => { mem.hechos.add(c.id); mem.pasos.push({ id: c.id, herramienta: c.herramienta, porque: c.porque, ok: res[i].ok, ms: res[i].ms, error: res[i].ok ? null : res[i].error, resumen: '' }); mem.resultados[c.id] = res[i]; });
      cand.forEach((c, i) => { const paso = mem.pasos.find((p) => p.id === c.id); try { paso.resumen = M.integrar(mem, c, res[i]) || ''; } catch(e){ paso.ok = false; paso.error = 'no pude interpretar el resultado'; } });
      if(M.suficiente && M.suficiente(mem)) break;
    }
    return M.concluir(mem);
  }

  // ---------- meta: explicar un cambio (ventas, ganancia, ticket o clientes) ----------
  const DIM_ETQ = { hora: 'las horas', dia_semana: 'los días de la semana', producto: 'los productos', metodo_pago: 'las formas de pago', cajero: 'el equipo' };
  const H12 = (h) => { const x = ((h % 24) + 24) % 24; return (x % 12 || 12) + (x < 12 ? ' a. m.' : ' p. m.'); };
  const pc = (x) => (x >= 0 ? '+' : '−') + Math.abs(Math.round(x * 100)) + '%';
  const dinero = (x) => (x >= 0 ? '+' : '−') + $r(Math.abs(x));

  const META_EXPLICAR = {
    candidatas(mem){
      const { t, rol, metrica } = mem.ctx, cm = mem.cmp, c = [];
      if(!cm){
        c.push({ id: 'estado', herramienta: 'estado_negocio', args: {}, porque: 'ver cuántos datos tengo para razonar con seguridad', prioridad: 10 });
        c.push({ id: 'cmp', herramienta: 'comparar_periodos', args: { periodo: t }, porque: 'ver cuánto cambió y si es un cambio real o cabe en lo normal', prioridad: 9 });
        c.push({ id: 'anom', herramienta: 'detectar_anomalias', args: { dias: 45 }, porque: 'buscar días raros (por ejemplo un día sin ventas)', prioridad: 5 });
        return c;
      }
      if(mem.parar === 'ruido'){ if(!mem.hechos.has('tend')) c.push({ id: 'tend', herramienta: 'detectar_tendencias', args: { semanas: 8 }, porque: 'ver si las ventas vienen cambiando poco a poco', prioridad: 5 }); return c; }
      if(mem.parar) return c;
      const equipo = rol === 'admin' || rol === 'analista', diasP = cm.act.dias;
      const orden = mem.dominante === 'ticket' ? ['producto', 'metodo_pago', 'hora', 'dia_semana'] : ['hora', 'producto', 'dia_semana', 'metodo_pago', 'cajero'];
      let pr = 8;
      orden.forEach((d) => {
        if((d === 'producto' || d === 'cajero') && !equipo) return;
        if(d === 'dia_semana' && diasP < 5) return;
        const porque = mem.dominante === 'ticket' ? 'el cambio viene de cuánto gasta cada quien: ver ' + DIM_ETQ[d] : 'el cambio viene de la cantidad de ventas: ver ' + DIM_ETQ[d];
        c.push({ id: 'dim_' + d, herramienta: 'ventas_por_dimension', args: { periodo: t, dimension: d, metrica: metrica === 'ganancia' && d === 'producto' && rol === 'admin' ? 'margen' : 'monto' }, porque, prioridad: pr-- });
      });
      if(metrica === 'ganancia' && rol === 'admin'){
        c.push({ id: 'margen', herramienta: 'calcular_margen', args: { periodo: t }, porque: 'ver si cambió el margen de cada venta', prioridad: 9 });
        c.push({ id: 'gastos', herramienta: 'analizar_gastos', args: { periodo: t }, porque: 'ver si cambiaron los gastos', prioridad: 7 });
      }
      // si un producto explica buena parte de la baja, ¿será que se agotó?
      if(equipo && !mem.hechos.has('inv') && mem.hipotesis.some((h) => h.producto && h.parte >= 0.12 && mem.delta < 0)) c.push({ id: 'inv', herramienta: 'analizar_inventario', args: {}, porque: 'un producto explica parte de la baja: revisar si se agotó', prioridad: 10 });
      if(mem.rondas >= 1 && !mem.hechos.has('tend')) c.push({ id: 'tend', herramienta: 'detectar_tendencias', args: { semanas: 8 }, porque: 'separar un golpe de hoy de algo que ya venía pasando', prioridad: 3 });
      return c;
    },
    integrar(mem, c, r){
      if(!r.ok){ mem.avisos.push('No pude revisar ' + c.id + ' (' + r.error + ')'); return 'no disponible'; }
      const d = r.datos, cm = mem.cmp;
      if(c.id === 'estado'){ mem.estado = d; return d.ventas30 + ' ventas en 30 días, ' + d.dias30 + ' días con ventas'; }
      if(c.id === 'anom'){ mem.anom = d; return d.dias.length ? d.dias.length + ' día(s) raros' : 'ningún día raro'; }
      if(c.id === 'cmp'){
        mem.cmp = d; const { metrica } = mem.ctx, pick = (a, b) => metrica === 'operaciones' ? [a.n, b.n] : (metrica === 'ticket' ? [a.ticket, b.ticket] : [a.total, b.total]);
        let [v1, v0] = pick(d.act, d.ant);
        if(metrica === 'ganancia'){ if(d.margen && d.margen.act != null && d.margen.ant != null){ v1 = d.margen.act; v0 = d.margen.ant; } else { mem.ctx.metrica = 'ventas'; mem.avisos.push('No tengo costos suficientes para hablar de ganancia; hablo de ventas.'); [v1, v0] = [d.act.total, d.ant.total]; } }
        mem.v1 = v1; mem.v0 = v0; mem.delta = v1 - v0; mem.pct = v0 ? (v1 - v0) / v0 : null;
        const dd = d.descomposicion; mem.dominante = mem.ctx.metrica === 'operaciones' ? 'volumen' : (mem.ctx.metrica === 'ticket' ? 'ticket' : dd.dominante);
        mem.real = RZ.esReal({ totalAct: d.act.total, totalAnt: d.ant.total, diasAct: d.act.dias, diasAnt: d.ant.dias, sigmaDia: d.sigmaDia });
        if(d.incompleto){ mem.real.confianza *= 0.85; mem.avisos.push('El periodo todavía no termina, así que el cambio puede moverse.'); }
        mem.deltaMonto = mem.ctx.metrica === 'ganancia' ? mem.delta : d.act.total - d.ant.total;
        const sinDatos = !(mem.estado ? mem.estado.suficiente : true) || !d.ant.n || !d.act.n;
        if(sinDatos) mem.parar = 'sin_datos';
        else if(mem.pct != null && Math.abs(mem.pct) < 0.03) mem.parar = 'sin_cambio';
        else if(!mem.real.real) mem.parar = 'ruido';
        return pc(mem.pct || 0) + ' · ' + (mem.real.real ? 'cambio real' : 'cabe en lo normal') + ' · pesa más ' + (mem.dominante === 'volumen' ? 'la cantidad de ventas' : 'lo que gasta cada quien');
      }
      if(c.id === 'tend'){ mem.tend = d; return d.tendencia ? 'vienen ' + (d.tendencia.direccion === 'baja' ? 'bajando' : (d.tendencia.direccion === 'sube' ? 'subiendo' : 'estables')) : 'pocos datos'; }
      if(c.id === 'inv'){
        mem.inv = d; let n = 0;
        mem.hipotesis.forEach((h) => { const ag = h.producto && d.agotados.find((x) => x.id === h.producto); if(ag){ n++; Object.assign(h, { sub: 'agotado', tipo: 'dato', titulo: 'Se agotó **' + h.nombre + '**: se vendía y hoy no hay existencia', recomendacion: 'Resurte **' + h.nombre + '** cuanto antes: cada día agotado dejas de vender cerca de ' + $r(ag.ventaDiaria) + '.', confianza: RZ.confianzaCausa({ real: mem.real.confianza, explica: h.parte, muestra: muestra(mem), tipo: 'dato' }) }); } });
        return n ? n + ' producto(s) agotado(s)' : 'ninguno de ellos está agotado';
      }
      if(c.id === 'margen'){ mem.margen = d; return 'margen ' + (d.act.pct != null ? Math.round(d.act.pct * 100) + '%' : 'sin dato') + (d.ant.pct != null ? ' contra ' + Math.round(d.ant.pct * 100) + '%' : ''); }
      if(c.id === 'gastos'){
        mem.gastos = d; if(!d.disponible) return 'sin gastos anotados';
        if(mem.ctx.metrica === 'ganancia' && d.ant != null){ const dg = d.act - d.ant; if(dg > 0 && mem.delta < 0){ const parte = Math.min(1, dg / Math.abs(mem.delta)); if(parte >= 0.15){ const top = d.categorias.find((x) => x.delta > 0); mem.hipotesis.push(hipotesis(mem, { dim: 'gastos', sub: 'gastos', tipo: 'dato', parte, titulo: 'Subieron tus gastos ' + dinero(dg) + (top ? ' (sobre todo ' + top.etiqueta + ')' : ''), recomendacion: 'Revisa en qué subió el gasto' + (top ? ' (' + top.etiqueta + ')' : '') + ' y si es algo de una sola vez o se va a repetir.' })); } } }
        return 'gastos ' + $r(d.act) + ' contra ' + $r(d.ant);
      }
      if(c.id.indexOf('dim_') === 0){
        const dim = d.dimension, total = mem.deltaMonto, usable = mem.ctx.metrica === 'ganancia' && dim === 'producto' ? d.totalDelta : total, hs = hipDim(mem, dim, d, usable);
        mem.hipotesis.push(...hs);
        const mejor = hs.slice().sort((a, b) => b.parte - a.parte)[0];
        return mejor ? 'lo más claro: ' + quitarNegritas(mejor.titulo) + ' (explica ' + Math.round(mejor.parte * 100) + '%)' : 'el cambio está repartido, ninguna parte destaca';
      }
      return '';
    },
    suficiente(mem){
      if(mem.parar) return mem.parar !== 'ruido' || mem.hechos.has('tend');
      const vistas = [...mem.hechos].filter((x) => x.indexOf('dim_') === 0).length, mejor = mem.hipotesis.reduce((m, h) => Math.max(m, h.parte), 0), ci = mem.hipotesis.some((h) => h.parte >= 0.7 && h.confianza >= 0.6);
      return vistas >= 2 && ci && mejor >= 0.7 && (mem.hechos.has('inv') || !mem.hipotesis.some((h) => h.producto && h.parte >= 0.12) || mem.ctx.rol === 'vendedor');
    },
    concluir(mem){
      const { t, metrica } = mem.ctx, out = { meta: 'explicar_cambio', metrica, t, pasos: mem.pasos, avisos: mem.avisos, rondas: mem.rondas, estado: 'ok', hipotesis: [], evidencia: [], contexto: [], real: mem.real || null };
      if(!mem.cmp){ out.estado = 'sin_datos'; return out; }
      const d = mem.cmp; Object.assign(out, { v1: mem.v1, v0: mem.v0, delta: mem.delta, pct: mem.pct, dominante: mem.dominante, desc: d.descomposicion, cmp: d });
      out.evidencia = [['Ventas', $r(d.act.total), (d.delta.pct != null ? pc(d.delta.pct) : '') + ' (antes ' + $r(d.ant.total) + ')'], ['Operaciones', fmt(d.act.n), (d.delta.nPct != null ? pc(d.delta.nPct) : '') + ' (antes ' + fmt(d.ant.n) + ')'], ['Ticket promedio', $d(d.act.ticket), (d.delta.ticketPct != null ? pc(d.delta.ticketPct) : '') + ' (antes ' + $d(d.ant.ticket) + ')']];
      if(mem.parar){ out.estado = mem.parar; }
      const lim = mem.hipotesis.filter((h) => h.parte >= 0.08 || h.sub === 'agotado');
      // se quedan las mejores, sin repetir el mismo producto ni la misma dimensión más de dos veces
      const vistos = new Set(), cuenta = {};
      out.hipotesis = lim.sort((a, b) => b.confianza - a.confianza).filter((h) => { const k = h.producto || h.titulo; if(vistos.has(k)) return false; vistos.add(k); cuenta[h.dim] = (cuenta[h.dim] || 0) + 1; return cuenta[h.dim] <= 2; }).slice(0, 3);
      if(mem.tend && mem.tend.tendencia && mem.tend.tendencia.direccion !== 'estable' && mem.tend.tendencia.r2 >= 0.5 && mem.tend.consecutivas >= 3) out.contexto.push('Tus ventas semanales vienen ' + (mem.tend.tendencia.direccion === 'baja' ? 'bajando' : 'subiendo') + ' desde hace varias semanas (cerca de ' + Math.abs(Math.round(mem.tend.tendencia.pctPorPeriodo * 100)) + '% por semana): no es solo algo de este periodo.');
      if(mem.anom){ const raros = mem.anom.dias.filter((x) => x.tipo === 'sin_ventas' && new Date(x.fecha + 'T12:00:00') >= t.desde); if(raros.length && !out.hipotesis.some((h) => h.sub === 'dia_cero')) out.contexto.push('Hubo ' + veces(raros.length, 'día', 'días') + ' sin ventas dentro del periodo.'); }
      out.confianza = out.hipotesis.length ? out.hipotesis[0].confianza : 0;
      return out;
    }
  };
  registrarMeta('explicar_cambio', META_EXPLICAR);

  const quitarNegritas = (s) => String(s).replace(/\*\*/g, '');
  const muestra = (mem) => RZ.muestraDe((mem.cmp.act.n + mem.cmp.ant.n) / 2);
  function hipotesis(mem, o){
    const conf = RZ.confianzaCausa({ real: mem.real.confianza, explica: o.parte, muestra: muestra(mem), tipo: o.tipo || 'dato' });
    return Object.assign({ confianza: conf }, o);
  }
  // convierte lo que devolvió una dimensión en hipótesis (cada una con cuánto explica y qué recomendar)
  function hipDim(mem, dim, d, total){
    const out = [], baja = total < 0, filas = d.filas, rol = mem.ctx.rol, baseTot = d.baseTotal || 0;
    if(!total) return out;
    // una parte solo es pista si explica claramente MÁS de lo que pesaba antes (si el 100% de tus ventas es efectivo, «bajó el efectivo» no dice nada)
    const informa = (parte, ant) => !baseTot || parte / Math.max(0.02, Math.max(0, ant) / baseTot) >= 1.25;
    if(dim === 'producto'){
      filas.filter((f) => f.delta * total > 0).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 3).forEach((f) => {
        const parte = RZ.explica(f.delta, total); if(parte < 0.08 || !informa(parte, f.ant)) return;
        const base = { dim, producto: f.id || f.clave, nombre: f.etiqueta, parte };
        const cambioPrecio = f.precioAnt > 0 && f.precioAct > 0 && Math.abs(f.precioAct / f.precioAnt - 1) >= 0.03 && Math.abs(f.efectoPrecio) >= 0.4 * Math.abs(f.delta);
        if(f.perdido) out.push(hipotesis(mem, Object.assign(base, { sub: 'perdido', tipo: 'dato', titulo: baja ? 'Dejó de venderse **' + f.etiqueta + '** (' + dinero(f.delta) + ')' : '', recomendacion: 'Revisa por qué ya no se vende **' + f.etiqueta + '**: ¿lo quitaste, se agotó o dejó de ofrecerse?' })));
        else if(f.nuevo) out.push(hipotesis(mem, Object.assign(base, { sub: 'nuevo', tipo: 'dato', titulo: 'Empezó a venderse **' + f.etiqueta + '** (' + dinero(f.delta) + ')', recomendacion: 'Mantén **' + f.etiqueta + '** visible: es lo que más te está sumando.' })));
        else if(cambioPrecio) out.push(hipotesis(mem, Object.assign(base, { sub: 'precio', tipo: 'causal', precioAnt: f.precioAnt, precioAct: f.precioAct, titulo: 'El precio de **' + f.etiqueta + '** pasó de ' + $d(f.precioAnt) + ' a ' + $d(f.precioAct) + ' y se vendieron ' + (f.cantAct < f.cantAnt ? 'menos' : (f.cantAct > f.cantAnt ? 'más' : 'las mismas')) + ' piezas (' + dinero(f.delta) + ')', recomendacion: 'Pudo influir el precio de **' + f.etiqueta + '**, pero no puedo comprobarlo solo con las ventas. Puedes simular qué pasa si regresas a ' + $d(f.precioAnt) + ' o probarlo unos días.' })));
        else out.push(hipotesis(mem, Object.assign(base, { sub: 'volumen_producto', tipo: 'dato', titulo: 'Se vendió ' + (f.cantAct < f.cantAnt ? 'menos' : 'más') + ' **' + f.etiqueta + '** (' + (f.cantAct - f.cantAnt > 0 ? '+' : '') + fmt(f.cantAct - f.cantAnt) + ' piezas, ' + dinero(f.delta) + ')', recomendacion: (baja ? 'Dale un empujón a **' + f.etiqueta + '**: ponlo a la vista y ofrécelo al cobrar.' : 'Cuida que no te falte **' + f.etiqueta + '**.') })));
      });
    } else if(dim === 'hora'){
      RZ.franjas(filas, total).slice(0, 2).forEach((b) => { const antB = filas.filter((x) => x.h >= b.ini && x.h <= b.fin).reduce((x, y) => x + y.ant, 0); if(b.parte < 0.25 || b.fin - b.ini >= 6 || !informa(b.parte, antB)) return;   // si abarca casi todo el día no es una franja: es todo el día
       const ini = H12(b.ini), fin = H12(b.fin + 1); out.push(hipotesis(mem, { dim, sub: 'franja', tipo: 'dato', parte: b.parte, bloque: ini + ' a ' + fin, titulo: 'Entre las ' + ini + ' y las ' + fin + ' se vendió ' + $r(Math.abs(b.delta)) + (baja ? ' menos' : ' más'), recomendacion: baja ? 'Revisaría primero el horario de ' + ini + ' a ' + fin + ': ¿cerraste antes, faltó personal o cambió algo afuera (obra, clima, competencia)? Si no hay causa clara, prueba una oferta solo en esa franja.' : 'Aprovecha la franja de ' + ini + ' a ' + fin + ': asegúrate de tener personal y surtido.' })); });
    } else if(dim === 'dia_semana'){
      filas.filter((f) => f.delta * total > 0).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 1).forEach((f) => { const parte = RZ.explica(f.delta, total); if(parte < 0.35 || !informa(parte, f.ant)) return; const menos = f.ocurrenciasAct < f.ocurrenciasAnt; out.push(hipotesis(mem, { dim, sub: 'dia', tipo: menos ? 'hecho' : 'dato', parte, titulo: 'El ' + f.etiqueta + ' ' + (baja ? 'vendiste ' : 'vendiste ') + $r(Math.abs(f.delta)) + (baja ? ' menos' : ' más') + (menos ? ' (este periodo tuvo un ' + f.etiqueta + ' menos que el anterior)' : ''), recomendacion: menos ? 'Parte de la diferencia es de calendario: tuviste un ' + f.etiqueta + ' menos. Compara contra un periodo con los mismos días.' : 'Revisa qué pasó el ' + f.etiqueta + ': ¿abriste igual, hubo un evento o clima distinto?' })); });
    } else if(dim === 'metodo_pago'){
      filas.filter((f) => f.delta * total > 0).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 1).forEach((f) => { const parte = RZ.explica(f.delta, total); if(parte < 0.4 || filas.length < 2 || !informa(parte, f.ant)) return; out.push(hipotesis(mem, { dim, sub: 'pago', tipo: 'dato', parte, titulo: 'Cambió lo que cobras con **' + f.etiqueta + '** (' + dinero(f.delta) + ')', recomendacion: baja ? 'Revisa si falló algo con ' + f.etiqueta + ' (terminal, caja) o si tus clientes cambiaron de forma de pago.' : 'Más clientes pagan con ' + f.etiqueta + ': asegúrate de que siempre funcione.' })); });
    } else if(dim === 'cajero' && rol === 'admin'){
      filas.filter((f) => f.delta * total > 0).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 1).forEach((f) => { const parte = RZ.explica(f.delta, total); if(parte < 0.5 || filas.length < 2 || !informa(parte, f.ant)) return; out.push(hipotesis(mem, { dim, sub: 'cajero', tipo: 'dato', parte, titulo: 'Cambiaron las ventas de **' + f.etiqueta + '** (' + dinero(f.delta) + ', ' + fmt(f.opsAct) + ' ventas contra ' + fmt(f.opsAnt) + ')', recomendacion: 'Revisa si ' + f.etiqueta + ' tuvo menos turnos o cambió de horario; no es un reproche, solo explica el cambio.' })); });
    }
    return out.filter((h) => h.titulo);
  }

  // días sin ventas dentro del periodo: explican el cambio por sí solos (se agregan después de revisar anomalías)
  const _integrarBase = META_EXPLICAR.integrar;
  META_EXPLICAR.integrar = function(mem, c, r){
    const res = _integrarBase(mem, c, r);
    if(c.id === 'anom' && r.ok) mem.anomPendiente = true;
    if(mem.anomPendiente && mem.cmp && mem.deltaMonto && !mem.parar){
      mem.anomPendiente = false;
      const ceros = (mem.anom ? mem.anom.dias : []).filter((x) => x.tipo === 'sin_ventas' && new Date(x.fecha + 'T12:00:00') >= mem.ctx.t.desde && new Date(x.fecha + 'T12:00:00') < new Date(new Date().setHours(0, 0, 0, 0)));
      if(ceros.length && mem.deltaMonto < 0 && mem.ctx.metrica !== 'ticket'){
        const perdido = ceros.length * (mem.anom.mediana || 0), parte = Math.min(1, perdido / Math.abs(mem.deltaMonto));
        if(parte >= 0.15) mem.hipotesis.push(hipotesis(mem, { dim: 'dia_cero', sub: 'dia_cero', tipo: 'hecho', parte, titulo: 'No hubo ventas ' + (ceros.length === 1 ? 'el ' : 'los días ') + lista(ceros.map((x) => new Date(x.fecha + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric' }))) + ' (un día normal vende cerca de ' + $r(mem.anom.mediana) + ')', recomendacion: 'Si ese día cerraste, es normal; si no, revisa si hubo un problema con el sistema o con la apertura.' }));
      }
    }
    return res;
  };

  // ---------- presentación: HECHO · EVIDENCIA · HIPÓTESIS · RECOMENDACIÓN ----------
  const NOMBRE_METRICA = { ventas: 'tus ventas', ganancia: 'tu ganancia', ticket: 'tu ticket promedio', operaciones: 'tu número de ventas' };
  function presentar(r, c){
    const t = r.t, nm = NOMBRE_METRICA[r.metrica] || 'tus ventas', out = [];
    if(r.estado === 'sin_datos' || !r.cmp) return [P('Todavía no tengo ventas suficientes ' + (t.explicito ? en(t) : 'en este periodo') + ' (o no hay con qué comparar) para explicarte qué cambió con seguridad. Con unos días más de ventas registradas, lo hago.'), I.sug ? C([sug('¿Cuánto vendí?')]) : null].filter(Boolean);
    const sube = (r.delta || 0) > 0, pl = r.metrica === 'ventas', pctTxt = r.pct != null ? Math.abs(Math.round(r.pct * 100)) + '%' : '';
    if(r.estado === 'sin_cambio') return [P(nm.charAt(0).toUpperCase() + nm.slice(1) + (pl ? ' casi no cambiaron: ' : ' casi no cambió: ') + (r.metrica === 'ventas' || r.metrica === 'ganancia' ? $r(r.v1) + ' ' + en(t) + ' contra ' + $r(r.v0) + ' ' + t.etPrev : fmt(Math.round(r.v1 * 100) / 100) + ' contra ' + fmt(Math.round(r.v0 * 100) / 100) + ' antes') + '. **No veo nada raro.**')];
    const fmtV = (v) => r.metrica === 'operaciones' ? fmt(Math.round(v)) : $r(v);
    out.push(P('**Lo que pasó:** ' + nm + ' ' + (sube ? (pl ? '**subieron** ' : '**subió** ') : (pl ? '**bajaron** ' : '**bajó** ')) + pctTxt + ' ' + en(t) + ': de ' + fmtV(r.v0) + ' a ' + fmtV(r.v1) + '.'));
    if(r.estado === 'ruido'){
      out.push(P('Pero tus días normales cambian bastante (unos **±' + $r(r.real.normalPorDia) + '** de un día a otro), así que este cambio todavía cabe en lo normal. **No veo evidencia de que sea un cambio real**, por eso no voy a inventarte una causa.'));
      r.contexto.forEach((x) => out.push(P(x)));
      out.push(P('Si sigue así unos días más, lo vuelvo a revisar con más datos.'), C([sug('¿Cómo lo averiguaste?'), sug('¿Cómo van mis ventas esta semana?')]));
      return out;
    }
    out.push(L('Lo que encontré', r.evidencia));
    const hs = r.hipotesis;
    if(!hs.length){
      out.push(P('Busqué en productos, horas, días y formas de pago y el cambio está **repartido**: no hay una sola cosa que lo explique. ' + (r.dominante === 'volumen' ? 'Lo que sí se ve es que cambió la **cantidad de ventas**, no cuánto gasta cada cliente.' : 'Lo que sí se ve es que cambió **cuánto gasta cada cliente**, no cuántos vienen.')));
    } else {
      const h0 = hs[0], conf = RZ.nivel(h0.confianza);
      out.push(P('**Lo más probable** (confianza ' + conf + '): ' + h0.titulo + '. Eso explica cerca del **' + Math.round(h0.parte * 100) + '%** del cambio.'));
      if(hs.length > 1) out.push(L('También influye', hs.slice(1).map((h) => [quitarNegritas(h.titulo), Math.round(h.parte * 100) + '% del cambio', 'confianza ' + RZ.nivel(h.confianza)])));
      out.push(P('**Lo que yo haría:** ' + h0.recomendacion));
      if(h0.confianza < 0.45) out.push(P('Ojo: hay una señal, pero **todavía no hay suficiente evidencia para afirmar la causa**. Tómalo como una pista para revisar, no como un hecho.'));
    }
    r.contexto.forEach((x) => out.push(P(x)));
    r.avisos.forEach((x) => out.push(P('Nota: ' + x)));
    const chips = ['¿Cómo lo averiguaste?'], hp = hs.find((h) => h.sub === 'precio');
    if(hp) chips.push('¿Y si regreso ' + hp.nombre + ' a ' + $d(hp.precioAnt) + '?'); else chips.push('¿Qué me recomiendas hacer?');
    chips.push('Dame un plan para la semana');
    out.push(C(chips.slice(0, 3).map(sug)));
    return out;
  }

  // ---------- temas del chat ----------
  const H = {};
  const metricaDe = (texto) => { const t = N.norm(texto); return /(ganancia|utilidad|margen|gano menos|gane menos)/.test(t) ? 'ganancia' : (/(ticket|cada cliente|por cliente|promedio por venta)/.test(t) ? 'ticket' : (/(clientes|gente|personas|operaciones)/.test(t) ? 'operaciones' : 'ventas')); };
  H.por_que = async (c) => {
    const rol = enlace().rol(), t = c.t && c.t.explicito ? c.t : N.ultimos(7), est = c.estado || {};
    let metrica = metricaDe(c.texto); if(metrica === 'ganancia' && rol !== 'admin') metrica = 'ventas';
    let res; try { res = await investigar('explicar_cambio', { t, rol, metrica }); } catch(e){ res = null; }
    if(!res){ const previo = H.__previo; return previo ? previo(c) : [P('No pude investigar eso ahora. Intenta de nuevo en un momento.')]; }
    est.nucleo = { ult: res, cuando: Date.now() };
    return presentar(res, c);
  };
  H.como_averiguaste = async (c) => {
    const u = c.estado && c.estado.nucleo && c.estado.nucleo.ult;
    if(!u) return [P('Todavía no te he explicado nada que investigar. Pregúntame, por ejemplo, «¿por qué estoy vendiendo menos?» y luego me preguntas cómo lo averigüé.'), C([sug('¿Por qué estoy vendiendo menos?')])];
    const out = [P('Lo averigüé **revisando en este orden** (cada paso dependió de lo que encontré en el anterior):')];
    out.push(L('Lo que revisé', u.pasos.map((p, i) => [(i + 1) + '. ' + p.porque.charAt(0).toUpperCase() + p.porque.slice(1), p.ok ? 'listo' : 'no pude', p.ok ? p.resumen : p.error])));
    const f = [];
    if(u.real) f.push(['¿El cambio es real?', Math.round(u.real.confianza * 100) + '%', u.real.real ? 'se sale de lo normal de tus días' : 'cabe en lo normal de tus días']);
    u.hipotesis.forEach((h) => f.push([quitarNegritas(h.titulo).slice(0, 70), Math.round(h.confianza * 100) + '%', h.tipo === 'causal' ? 'tope 40%: no se puede comprobar la causa solo con ventas' : 'explica ' + Math.round(h.parte * 100) + '% del cambio']));
    if(f.length) out.push(L('Qué tan seguro estoy', f));
    out.push(P('Esos porcentajes son un **índice de confianza**, no una probabilidad exacta: combinan qué tan real es el cambio, cuánto explica cada causa y cuántas ventas hay. Todo se calculó con tus ventas de PUVE; no leí nada fuera de tu negocio ni cambié nada.'));
    return out;
  };

  const previo = R.handler && R.handler('por_que'); if(previo) H.__previo = previo;
  const Hreg = { por_que: H.por_que, como_averiguaste: H.como_averiguaste };
  R.registrarTemas(Hreg, { como_averiguaste: 'Cómo lo averigüé' }, { por_que: 'Investigando qué cambió…', como_averiguaste: 'Repasando los pasos…' });
  // justo después de una investigación, «¿en qué te basas?» o «¿de dónde sacas eso?» preguntan por los pasos (sin esto irían a «¿por qué me recomiendas eso?»)
  R.agregarPre && R.agregarPre((original, estado) => {
    const u = estado && estado.nucleo; if(!u || Date.now() - u.cuando > 10 * 60000) return null;
    return /(^| )(en que te basas|de donde sacas eso|de donde sacaste eso|en que datos te apoyas|en que te apoyas|que datos usaste|que datos usas)( |$)/.test(N.norm(original)) ? { intent: 'como_averiguaste' } : null;
  });
  window.PuveIaOrquestador = { investigar, registrarMeta, presentar, metas: () => Object.keys(METAS), internos: { METAS, metricaDe } };
})();
