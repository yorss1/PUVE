/* PUVE IA · Diagnóstico general del negocio (Etapas 2 y 4 del plan de arquitectura, MD §21–27, §49–51; motor propio, SIN IA externa)
 * Responde «¿cómo está mi negocio?» sin una ruta fija: es una META más del orquestador (se registra, no se toca su ciclo) que junta lo que ya sabe medir
 * y lo convierte en tres cosas que el dueño puede usar:
 *   1) una PUNTUACIÓN por área (Ventas, Rentabilidad, Inventario, Operación, Crecimiento, Riesgo) donde cada número se puede EXPLICAR (qué sumó y qué restó),
 *   2) lo que va bien y lo que preocupa,
 *   3) PRIORIDADES jerarquizadas (CRÍTICO · ALTO · MEDIO · BAJO · OPORTUNIDAD) con el porqué y la acción: «si solo haces tres cosas, haz estas».
 * Reglas del MD que cumple: no inventa datos (si no hay con qué calificar un área, lo dice y no la puntúa), no manda el margen a quien no lo puede ver,
 * y no promete resultados. «Clientes» queda sin puntuar hasta que exista su herramienta (MD §25): se dice claramente.
 * Herramientas nuevas (solo lectura, con entrada validada, permisos, límites y traza, como todas): rentabilidad_productos (§23) y riesgo_inventario (§21, §24).
 * Se carga después de puve-ia-orquestador.js.
 */
(function(){
  'use strict';
  const R = window.PuveResumen, RZ = window.PuveIaRazonamiento, T = window.PuveIaHerramientas, O = window.PuveIaOrquestador;
  if(!R || !R.internos || !RZ || !T || !O || !R.registrarTemas) return;
  const I = R.internos, { D, N, P, L, S, C, sug, veces, fmt, $r, en } = I, enlace = () => I.enlace();
  const ADMIN = ['admin'], EQUIPO = ['admin', 'analista'], acota = RZ.acota;
  const pct = (x) => Math.round(x * 100) + '%';
  const sgn = (x) => (x >= 0 ? '+' : '−') + Math.abs(Math.round(x * 100)) + '%';
  const suma = (a, f) => a.reduce((s, x) => s + f(x), 0), din = (x) => (x < 0 ? '−' : '') + $r(Math.abs(x));   // «−$10,800», no «$-10,800»

  // ---------- herramienta: qué parte de tus ventas y de tu ganancia pone cada producto (vender mucho ≠ ganar mucho) ----------
  T.registrar({
    nombre: 'rentabilidad_productos', descripcion: 'Qué parte de tus ventas y de tu ganancia pone cada producto', permisos: ADMIN, produce: ['rentabilidad'], entrada: {},
    async ejecutar(){
      const an = await D.analisis(), con = an.lista.filter((x) => x.ing30 > 0), ventas = suma(con, (x) => x.ing30);
      const conCosto = con.filter((x) => x.margen30 != null), ventasC = suma(conCosto, (x) => x.ing30), utilidad = suma(conCosto, (x) => x.margen30);
      const cobertura = ventas ? ventasC / ventas : 0, compara = utilidad > 0 && cobertura >= 0.6;
      const filas = con.map((x) => ({ id: x.id, nombre: x.nombre, u30: x.u30, ventas: x.ing30, pVentas: ventas ? x.ing30 / ventas : 0, margen: x.margen30, mPct: x.mPct,
        pVentasC: x.margen30 != null && ventasC ? x.ing30 / ventasC : null, pUtilidad: compara && x.margen30 != null ? x.margen30 / utilidad : null })).sort((a, b) => b.ventas - a.ventas);
      // «vende mucho pero deja poco»: pone una parte grande de lo que vendes y una parte mucho menor de lo que ganas
      const pocoRinde = filas.filter((f) => f.pVentasC != null && f.pVentasC >= 0.15 && f.pUtilidad != null && f.pUtilidad <= f.pVentasC * 0.6).slice(0, 3);
      const joyas = filas.filter((f) => f.mPct != null && f.mPct >= 0.5 && f.pVentas <= 0.1 && f.u30 >= 3).sort((a, b) => b.mPct - a.mPct).slice(0, 3);
      return { ventas, utilidad: conCosto.length ? utilidad : null, cobertura, hayCostos: conCosto.length > 0, filas: filas.slice(0, 8), pocoRinde, joyas };
    }
  });

  // ---------- herramienta: riesgo compuesto de inventario (importancia × margen × rapidez × qué tan pronto se acaba), sobrestock, caducidad y dependencia ----------
  T.registrar({
    nombre: 'riesgo_inventario', descripcion: 'Qué producto importante se agota primero, qué sobra, qué caduca pronto y de qué dependes', permisos: EQUIPO, produce: ['riesgo_inventario'], entrada: {},
    async ejecutar(){
      const an = await D.analisis(), fis = an.lista.filter((x) => x.fisico), ing = an.ing30 || 0, velMax = Math.max(0, ...fis.map((x) => x.vel));
      const criticos = fis.filter((x) => x.vel > 0).map((x) => {
        const imp = ing ? x.ing30 / ing : 0, mar = x.mPct != null ? acota(x.mPct, 0, 1) : 0.3, dias = x.stock > 0 ? x.stock / x.vel : 0, disp = dias <= 0 ? 1 : acota(1 - dias / 14, 0, 1);
        const peso = 0.5 * acota(imp / 0.25, 0, 1) + 0.3 * acota(mar / 0.5, 0, 1) + 0.2 * (velMax ? x.vel / velMax : 0);   // índice 0–1: qué tanto duele que falte
        return { id: x.id, nombre: x.nombre, stock: x.stock, dias, importancia: imp, mPct: x.mPct, agotado: x.stock <= 0, riesgo: disp * peso };
      }).filter((x) => x.riesgo > 0).sort((a, b) => b.riesgo - a.riesgo).slice(0, 5);
      const sobre = fis.filter((x) => x.vel > 0 && x.stock > 0 && x.dias >= 45 && x.capital != null && x.capital > 0).sort((a, b) => b.capital - a.capital);
      const porVentas = an.lista.filter((x) => x.ing30 > 0).sort((a, b) => b.ing30 - a.ing30), parte = (x) => (x && ing ? x.ing30 / ing : 0);
      return { fisicos: fis.length, criticos, sobrestock: sobre.slice(0, 5).map((x) => ({ nombre: x.nombre, dias: x.dias, capital: x.capital })), capitalSobre: suma(sobre, (x) => x.capital),
        caducando: I.porCaducar().slice(0, 5).map((x) => ({ nombre: x.p.nombre, dias: x.dias })),
        concentracion: { top1: porVentas[0] ? { nombre: porVentas[0].nombre, parte: parte(porVentas[0]) } : null, top2: parte(porVentas[0]) + parte(porVentas[1]) } };
    }
  });

  // ---------- herramienta: patrones que el dueño no pidió (MD §20): día débil, horas que concentran ventas, productos que van juntos, ticket que sube con menos ventas ----------
  const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'], plural = (d) => /s$/.test(d) ? d : d + 's';
  T.registrar({
    nombre: 'detectar_patrones', descripcion: 'Patrones que el dueño no pidió: días débiles o fuertes, horas que concentran ventas, productos que van juntos', permisos: EQUIPO, produce: ['patrones'], entrada: { periodo: { tipo: 'periodo', requerido: true } },
    async ejecutar({ periodo: t }){
      const [pc, an, serie] = await Promise.all([D.periodoCompleto(t), D.analisis(), D.diario(56)]), a = pc.act, b = pc.ant, out = [], hoyK = D.fechaLocal(new Date());
      // día de la semana: solo si se aparta de tu promedio al menos 20% Y más que el ruido normal (error estándar), con 4 o más semanas de ese día
      const por = [[], [], [], [], [], [], []]; serie.filter((x) => x.fecha < hoyK).forEach((x) => por[new Date(x.fecha + 'T12:00:00').getDay()].push(x.total));
      const medias = por.map((v) => v.length >= 4 ? RZ.prom(v) : null), validas = medias.filter((x) => x != null);
      if(validas.length >= 5){ const g = RZ.prom(validas);
        medias.forEach((m, d) => { if(m == null || !g) return; const dif = (m - g) / g, ee = RZ.desv(por[d]) / Math.sqrt(por[d].length);
          if(Math.abs(dif) >= 0.2 && Math.abs(m - g) >= 1.5 * ee) out.push({ tipo: 'dia', dia: DIAS[d], dif, semanas: por[d].length, fuerza: acota(Math.abs(dif) / 0.5, 0, 1), confianza: acota(por[d].length / 8, 0, 1),
            titulo: 'Los ' + plural(DIAS[d]) + ' vendes ' + pct(Math.abs(dif)) + (dif < 0 ? ' menos' : ' más') + ' que tu promedio (' + veces(por[d].length, 'semana', 'semanas') + ' de datos)' }); }); }
      // horas: ¿tres horas seguidas concentran 40% o más de lo que vendes?
      const tot = a.porHora.reduce((x, y) => x + y, 0);
      if(tot > 0 && a.n >= 30){ let mejor = null; for(let h = 0; h <= 21; h++){ const sm = a.porHora[h] + a.porHora[h + 1] + a.porHora[h + 2]; if(!mejor || sm > mejor.sm) mejor = { h, sm }; }
        const parte = mejor.sm / tot, H12 = (h) => (h % 12 || 12) + (h < 12 ? ' a. m.' : ' p. m.');
        if(parte >= 0.4) out.push({ tipo: 'horas', ini: mejor.h, fin: mejor.h + 3, parte, fuerza: acota((parte - 0.3) / 0.4, 0, 1), confianza: acota(a.n / 100, 0, 1), titulo: 'El ' + pct(parte) + ' de tus ventas ocurre entre las ' + H12(mejor.h) + ' y las ' + H12(mejor.h + 3) }); }
      // pares: dos productos que aparecen juntos en una parte grande de TODAS tus ventas
      const par = an.pares.filter((p) => an.ventas30 && p.n >= 10 && p.n / an.ventas30 >= 0.25).sort((x, y) => y.n - x.n)[0];
      if(par){ const parte = par.n / an.ventas30; out.push({ tipo: 'par', a: par.a, b: par.b, parte, fuerza: acota(parte / 0.5, 0, 1), confianza: acota(par.n / 40, 0, 1), titulo: par.a + ' y ' + par.b + ' aparecen juntos en ' + pct(parte) + ' de tus ventas' }); }
      // ticket sube pero baja el número de ventas: el problema no es cuánto gasta cada quien
      if(a.n >= 20 && b.n >= 20 && b.ticket > 0){ const tp = (a.ticket - b.ticket) / b.ticket, np = (a.n - b.n) / b.n;
        if(tp >= 0.03 && np <= -0.03) out.push({ tipo: 'ticket_vs_ops', ticketPct: tp, opsPct: np, fuerza: acota(Math.abs(np) / 0.2, 0, 1), confianza: acota(Math.min(a.n, b.n) / 100, 0, 1), titulo: 'Tu ticket subió ' + pct(tp) + ' pero el número de ventas bajó ' + pct(Math.abs(np)) }); }
      return { patrones: out.sort((x, y) => y.fuerza * y.confianza - x.fuerza * x.confianza).slice(0, 5) };
    }
  });

  // ---------- puntuación (MD §50): cada número lleva sus motivos; si no hay con qué calificar, no se inventa ----------
  const nivelDe = (p, inv) => p == null ? 'sin datos' : ((inv ? 100 - p : p) >= 75 ? 'bien' : ((inv ? 100 - p : p) >= 50 ? 'regular' : 'atención'));
  function puntuar(m){
    const rol = m.ctx.rol, cmp = m.cmp, est = m.estado, g = m.gastos, tn = m.tend && m.tend.tendencia, rk = m.riesgo, iv = m.inv, out = [];
    const datos = !!(cmp && (est ? est.suficiente : true) && cmp.ant.n && cmp.act.n), mg = cmp && cmp.margen, cob = est ? est.coberturaCostos : (m.rent ? m.rent.cobertura : 0), ing = est ? est.ingresos30 : 0;
    const dim = (clave, etiqueta, puntos, motivos, extra) => { const p = puntos == null ? null : Math.round(acota(puntos, 0, 100)), inv = !!(extra && extra.invertida); out.push(Object.assign({ clave, etiqueta, puntos: p, nivel: nivelDe(p, inv), motivos }, extra || {})); };
    const capital = iv && rk ? (iv.capitalParado || 0) + (rk.capitalSobre || 0) : 0, rel = ing ? capital / ing : 0;
    // Ventas: base 70; el cambio contra el periodo anterior suma o resta (la mitad si cabe en lo normal de tus días)
    if(datos){ const p = cmp.delta.pct == null ? 0 : cmp.delta.pct, f = m.real && m.real.real ? 1 : 0.5; dim('ventas', 'Ventas', 70 + acota(p, -0.4, 0.25) * 100 * f, ['Vendiste ' + $r(cmp.act.total) + ', ' + sgn(p) + ' contra el periodo anterior' + (f < 1 ? ' (cabe en lo normal de tus días)' : '')]); }
    else dim('ventas', 'Ventas', null, ['Todavía no hay ventas suficientes para calificarlas']);
    // Rentabilidad: lo que te queda de cada $100 (90 puntos si es 40% o más), menos castigos si los gastos se comen la ganancia
    if(rol !== 'admin') dim('rentabilidad', 'Rentabilidad', null, ['El margen lo ve solo el encargado']);
    else if(datos && !est) dim('rentabilidad', 'Rentabilidad', null, ['No pude comprobar tus costos ahora']);
    else if(datos && mg && mg.act != null && cmp.act.total && cob >= 0.3){
      const mp = mg.act / cmp.act.total, mot = ['De cada $100 que vendes te quedan ' + $r(mp * 100)]; let pts = Math.min(95, mp / 0.4 * 90);   // tope antes de los castigos, para que no se pierdan
      if(g && g.disponible){ const util = mg.act - g.act; if(util < 0){ pts = Math.min(pts - 25, 35); mot.push('Con tus gastos (' + $r(g.act) + ') ya no te queda ganancia: ' + din(util)); } else if(g.act / cmp.act.total > 0.35){ pts -= 10; mot.push('Tus gastos son ' + pct(g.act / cmp.act.total) + ' de tus ventas'); } }
      if(cob < 0.8) mot.push('Solo tengo el costo de ' + pct(cob) + ' de tus ventas: la cifra es aproximada');
      dim('rentabilidad', 'Rentabilidad', pts, mot, { parcial: cob < 0.8 });
    } else dim('rentabilidad', 'Rentabilidad', null, [datos ? 'Me faltan los costos de tus productos para calcularla' : 'Todavía no hay ventas suficientes para calificarla']);
    // Inventario: empieza en 100; resta por agotados que sí se vendían, por agotarse, dinero parado y caducidad
    if(!iv || !rk) dim('inventario', 'Inventario', null, [rol === 'vendedor' ? 'No disponible para tu rol' : 'No pude revisar tu inventario']);
    else if(!rk.fisicos) dim('inventario', 'Inventario', null, ['Tu negocio no maneja existencias que calificar']);
    else {
      let pts = 100; const mot = [], ag = iv.agotados.length, pa = iv.porAgotarse.length, cad = rk.caducando.length;
      if(ag){ pts -= Math.min(48, ag * 12); mot.push(veces(ag, 'producto agotado', 'productos agotados') + ' que sí se vendía' + (ag === 1 ? '' : 'n')); }
      if(pa){ pts -= Math.min(24, pa * 6); mot.push(veces(pa, 'producto alcanza', 'productos alcanzan') + ' para 3 días o menos'); }
      if(rel > 0.25){ pts -= rel > 1 ? 25 : (rel > 0.5 ? 15 : 8); mot.push($r(capital) + ' parados en mercancía que no sale o que te sobra'); }
      if(cad){ pts -= Math.min(15, cad * 5); mot.push(veces(cad, 'producto caduca', 'productos caducan') + ' en menos de 7 días'); }
      dim('inventario', 'Inventario', pts, mot.length ? mot : ['Nada agotado ni por agotarse']);
    }
    // Operación: qué tan parejos son tus días (un día sin ventas o muy bajo resta)
    if(datos && m.anom){
      const desde = new Date(); desde.setDate(desde.getDate() - 30);
      const rec = m.anom.dias.filter((x) => new Date(x.fecha + 'T12:00:00') >= desde), sin = rec.filter((x) => x.tipo === 'sin_ventas').length, baj = rec.filter((x) => x.tipo === 'bajo').length, mot = [];
      if(sin) mot.push(veces(sin, 'día sin ventas', 'días sin ventas')); if(baj) mot.push(veces(baj, 'día muy por debajo de lo normal', 'días muy por debajo de lo normal'));
      dim('operacion', 'Operación', 100 - 15 * sin - 6 * baj, mot.length ? mot : ['Tus días son parejos: ninguno raro']);
    } else dim('operacion', 'Operación', null, ['Todavía no hay días suficientes para revisar tu regularidad']);
    // Crecimiento: base 55; la tendencia de las últimas semanas sube o baja la nota (la mitad si todavía no es clara)
    if(tn){ const f = tn.r2 >= 0.3 ? 1 : 0.5, mot = ['Tus ventas semanales vienen ' + (tn.direccion === 'baja' ? 'bajando' : (tn.direccion === 'sube' ? 'subiendo' : 'estables')) + (tn.direccion !== 'estable' ? ' (cerca de ' + Math.abs(Math.round(tn.pctPorPeriodo * 100)) + '% por semana)' : '')];
      if(f < 1) mot.push('la tendencia todavía no es clara'); dim('crecimiento', 'Crecimiento', 55 + acota(tn.pctPorPeriodo * 100 * 5, -40, 40) * f, mot); }
    else dim('crecimiento', 'Crecimiento', null, ['Todavía no hay semanas suficientes para ver tu tendencia']);
    // Clientes: aún no hay herramienta que los analice; se dice, no se inventa (MD §25, regla 7)
    dim('clientes', 'Clientes', null, ['Todavía no la calculo: me falta analizar tus clientes (cuántos vuelven y cada cuánto)']);
    // Riesgo (más alto = peor): base 10 y suma por dependencia, margen que cae, gastos que corren, producto clave por faltar, tendencia a la baja y dinero parado
    const completo = (m.pasos || []).every((x) => x.ok);   // si un paso falló, «no veo riesgos» sería una falsa tranquilidad: mejor no calificar
    if(datos && completo){
      let pts = 10; const mot = [], con = rk && rk.concentracion, c0 = rk && rk.criticos[0];
      if(con && con.top1){ if(con.top1.parte >= 0.4){ pts += 25; mot.push('Dependes mucho de ' + con.top1.nombre + ' (' + pct(con.top1.parte) + ' de tus ventas)'); } else if(con.top1.parte >= 0.3){ pts += 15; mot.push('Una parte grande de tus ventas es ' + con.top1.nombre + ' (' + pct(con.top1.parte) + ')'); } if(con.top2 >= 0.7){ pts += 10; mot.push('Tus dos productos más vendidos son el ' + pct(con.top2) + ' de tus ventas'); } }
      if(mg && mg.act != null && mg.ant != null && cmp.act.total && cmp.ant.total){ const caida = mg.ant / cmp.ant.total - mg.act / cmp.act.total; if(caida >= 0.03){ pts += 15; mot.push('Tu margen bajó ' + Math.round(caida * 100) + ' puntos'); } }
      if(g && g.disponible && g.ant > 0 && cmp.ant.total > 0){ const cg = (g.act - g.ant) / g.ant, cv = (cmp.act.total - cmp.ant.total) / cmp.ant.total; if(cg - cv >= 0.15){ pts += 15; mot.push('Tus gastos ' + sgn(cg) + ' mientras tus ventas ' + sgn(cv)); } }
      if(c0 && c0.importancia >= 0.1 && (c0.agotado || c0.dias <= 3)){ pts += 15; mot.push(c0.nombre + ' (' + pct(c0.importancia) + ' de tus ventas) ' + (c0.agotado ? 'está agotado' : 'se acaba en unos ' + Math.max(1, Math.round(c0.dias)) + ' días')); }
      if(tn && tn.direccion === 'baja' && tn.r2 >= 0.5 && m.tend.consecutivas >= 3){ pts += 15; mot.push('Tus ventas llevan varias semanas bajando'); }
      if(rel > 0.5){ pts += 10; mot.push('Mucho dinero parado en mercancía (' + $r(capital) + ')'); }
      dim('riesgo', 'Riesgo (más alto = peor)', pts, mot.length ? mot : ['No veo señales de riesgo importantes'], { invertida: true });
    } else dim('riesgo', 'Riesgo (más alto = peor)', null, [datos ? 'No pude revisar todo lo necesario para medirlo' : 'Todavía no hay datos suficientes para medirlo'], { invertida: true });
    const val = out.filter((x) => x.puntos != null).map((x) => x.invertida ? 100 - x.puntos : x.puntos);
    const global = val.length >= 3 ? (() => { const p = Math.round(val.reduce((s, x) => s + x, 0) / val.length); return { puntos: p, areas: val.length, veredicto: p >= 75 ? 'muy bien' : (p >= 60 ? 'bien' : (p >= 45 ? 'regular' : 'necesita atención pronto')) }; })() : null;   // el veredicto se ajusta en concluir() si hay algo CRÍTICO
    return { puntuaciones: out, global, capital, rel };
  }

  // ---------- prioridades (MD §27): nivel, porqué, acción, y con qué confianza se dice ----------
  const NV = { CRITICO: ['CRÍTICO', 5], ALTO: ['ALTO', 4], MEDIO: ['MEDIO', 3], BAJO: ['BAJO', 2], OPORTUNIDAD: ['OPORTUNIDAD', 1] };
  function priorizar(m, aux){
    const it = [], cmp = m.cmp, iv = m.inv, rk = m.riesgo, rent = m.rent, g = m.gastos, ing = m.estado ? m.estado.ingresos30 : 0, rol = m.ctx.rol;
    const add = (nivel, titulo, porque, accion, o) => it.push(Object.assign({ nivel: NV[nivel][0], peso: NV[nivel][1], titulo, porque, accion, impacto: 0, esfuerzo: 2, confianza: 0.8 }, o || {}));
    if(iv) iv.agotados.slice().sort((a, b) => b.ventaDiaria - a.ventaDiaria).slice(0, 2).forEach((x) => { const imp = ing ? x.ventaDiaria * 30 / ing : 0;
      add(imp >= 0.1 ? 'CRITICO' : 'ALTO', 'Resurte ' + x.nombre, 'Se vendía y hoy no hay: dejas de vender cerca de ' + $r(x.ventaDiaria) + ' al día', 'Pídelo hoy; cada día agotado es venta perdida.', { impacto: x.ventaDiaria * 30, esfuerzo: 1, confianza: 0.9 }); });
    if(rk) rk.criticos.filter((x) => !x.agotado && x.dias <= 3 && x.importancia >= 0.08).slice(0, 2).forEach((x) => add('ALTO', 'Pide ' + x.nombre + ' pronto', 'Es ' + pct(x.importancia) + ' de tus ventas y te alcanza para unos ' + Math.max(1, Math.round(x.dias)) + ' días', 'Haz el pedido antes de que se acabe.', { impacto: x.importancia * ing, esfuerzo: 1, confianza: 0.8 }));
    if(rk) rk.caducando.slice(0, 2).forEach((x) => add(x.dias <= 2 ? 'ALTO' : 'MEDIO', 'Mueve ' + x.nombre + ' antes de que caduque', x.dias <= 0 ? 'Ya caducó o caduca hoy' : 'Caduca en ' + veces(x.dias, 'día', 'días'), 'Ponlo en oferta o úsalo primero.', { impacto: 100, esfuerzo: 1, confianza: 0.95 }));
    if(cmp && m.real && m.real.real && cmp.delta.pct != null && cmp.delta.pct <= -0.1)
      add(cmp.delta.pct <= -0.25 ? 'CRITICO' : 'ALTO', 'Entiende por qué bajaron tus ventas', 'Bajaron ' + pct(Math.abs(cmp.delta.pct)) + ' contra el periodo anterior y no es ruido normal', 'Pregúntame «¿por qué estoy vendiendo menos?» y te digo dónde se concentra.', { impacto: Math.abs(cmp.delta.total), esfuerzo: 2, confianza: m.real.confianza, chip: '¿Por qué estoy vendiendo menos?' });
    else if(m.tend && m.tend.tendencia && m.tend.tendencia.direccion === 'baja' && m.tend.tendencia.r2 >= 0.5 && m.tend.consecutivas >= 3)
      add('ALTO', 'Frena la baja de varias semanas', 'Tus ventas semanales llevan varias semanas bajando', 'Revisa qué cambió hace unas semanas y prueba una acción chica.', { impacto: ing * 0.1, esfuerzo: 2, confianza: 0.6, chip: '¿Por qué estoy vendiendo menos?' });
    if(rol === 'admin' && cmp && cmp.margen && cmp.margen.act != null && g && g.disponible && cmp.margen.act - g.act < 0)
      add('CRITICO', 'Tus gastos ya se comen tu ganancia', 'Ganaste ' + $r(cmp.margen.act) + ' en productos y gastaste ' + $r(g.act), 'Revisa el gasto más grande y qué puedes recortar o aplazar.', { impacto: g.act - cmp.margen.act, esfuerzo: 2, confianza: 0.85 });
    else if(rol === 'admin' && g && g.disponible && g.ant > 0 && cmp && cmp.ant.total > 0 && (g.act - g.ant) / g.ant - (cmp.act.total - cmp.ant.total) / cmp.ant.total >= 0.15)
      add('MEDIO', 'Vigila tus gastos', 'Crecieron ' + sgn((g.act - g.ant) / g.ant) + ' mientras tus ventas ' + sgn((cmp.act.total - cmp.ant.total) / cmp.ant.total), 'Mira en qué categoría subieron.', { impacto: g.act - g.ant, esfuerzo: 2, confianza: 0.8 });
    if(rent) rent.pocoRinde.forEach((f) => add('MEDIO', f.nombre + ': vende mucho pero deja poco', 'Es el ' + pct(f.pVentasC) + ' de tus ventas y solo el ' + pct(f.pUtilidad) + ' de tu ganancia', 'Revisa su precio o su costo.', { impacto: ing * (f.pVentasC - f.pUtilidad) * 0.3, esfuerzo: 2, confianza: 0.75, chip: '¿Qué pasa si subo el precio de ' + f.nombre + '?' }));
    if(aux.rel > 0.25) add(aux.rel > 0.5 ? 'ALTO' : 'MEDIO', 'No compres más de lo que ya te sobra', 'Tienes ' + $r(aux.capital) + ' parados en mercancía que no sale o que te sobra', 'Haz una oferta para volverlo dinero y pospón esas compras.', { impacto: aux.capital * 0.3, esfuerzo: 2, confianza: 0.8, chip: '¿En qué no debería invertir?' });
    if(rk && rk.concentracion.top1 && rk.concentracion.top1.parte >= 0.4) add('MEDIO', 'No dependas de un solo producto', rk.concentracion.top1.nombre + ' es el ' + pct(rk.concentracion.top1.parte) + ' de tus ventas', 'Impulsa un segundo producto fuerte para repartir el riesgo.', { impacto: ing * 0.05, esfuerzo: 3, confianza: 0.7 });
    if(rol === 'admin' && m.estado && m.estado.suficiente && m.estado.coberturaCostos < 0.6) add('MEDIO', 'Anota el costo de tus productos', 'Solo tengo el costo de ' + pct(m.estado.coberturaCostos) + ' de lo que vendes', 'Con eso te calculo ganancia y rentabilidad con seguridad.', { impacto: ing * 0.05, esfuerzo: 2, confianza: 0.9 });
    if(aux.sinVentas) add('MEDIO', 'Revisa los días sin ventas', veces(aux.sinVentas, 'día', 'días') + ' sin ventas en el último mes', 'Si cerraste, es normal; si no, revisa qué falló ese día.', { impacto: aux.sinVentas * (m.anom ? m.anom.mediana : 0), esfuerzo: 1, confianza: 0.7 });
    if(rent) rent.joyas.slice(0, 1).forEach((f) => add('OPORTUNIDAD', 'Ofrece más ' + f.nombre, 'Te deja ' + pct(f.mPct) + ' de cada venta pero solo es el ' + pct(f.pVentas) + ' de lo que vendes', 'Ponlo a la vista y ofrécelo al cobrar.', { impacto: ing * 0.03, esfuerzo: 1, confianza: 0.65 }));
    (m.cambios || []).filter((x) => x.veredicto === 'desfavorable' || x.veredicto === 'tiende_desfavorable').forEach((x) => { const mp = x.metricas.find((y) => y.k === x.principal), et = x.principal === 'utilidad' ? 'la ganancia por día' : 'las ventas por día', fuerte = x.veredicto === 'desfavorable';
      add(fuerte ? 'ALTO' : 'MEDIO', 'Revisa tu cambio de precio de ' + x.nombre, 'Desde que lo cambiaste de $' + Math.round(x.de) + ' a $' + Math.round(x.a) + ', ' + et + ' va ' + pct(mp.relativo) + ' abajo frente al resto de tu negocio' + (fuerte ? '' : ' (todavía no es claro)'), 'Si fue por el precio, considera regresarlo y mídelo otra vez.', { impacto: ing * x.peso * Math.abs(mp.relativo), esfuerzo: 1, confianza: fuerte ? 0.75 : 0.5, chip: '¿Funcionó el cambio de precio de ' + x.nombre + '?' }); });
    const gi = m.giro;   // lo propio del giro (referencias generales, no reglas)
    if(gi){
      const di = gi.indicadores.find((x) => x.clave === 'dias' && x.estado === 'atencion');
      if(di) add('MEDIO', 'Tu inventario dura más de lo habitual en tu giro', veces(di.n, 'producto', 'productos') + ' (' + di.productos.map((x) => x.nombre + ' ~' + x.dias + ' días').join(', ') + ') con ' + $r(di.capital) + ' parados; en ' + gi.nombre.toLowerCase() + ' suele convenir menos de ' + di.referencia.replace('más de ', ''), 'Compra menos de esos y haz una oferta para volverlos dinero.', { impacto: di.capital * 0.3, esfuerzo: 2, confianza: 0.55 });
      const pf = gi.proximas.find((x) => x.dias <= 21);
      if(pf) add('OPORTUNIDAD', 'Prepárate para ' + pf.nombre, 'Es en ' + veces(pf.dias, 'día', 'días') + ' y es una fecha fuerte para ' + gi.nombre.toLowerCase(), 'Surte con tiempo lo que más sale en esa fecha; en Analítica → Decisiones → Fechas pico ves cómo te fue el año pasado.', { impacto: ing * 0.05, esfuerzo: 2, confianza: 0.6 });
    }
    const mt = m.meta;   // objetivo del mes (MD §16): solo si hay meta guardada y datos para opinar
    if(mt && mt.hayMeta && (mt.veredicto === 'poco_probable' || mt.veredicto === 'exigente')){
      const acc = mt.acciones && mt.acciones[0] && window.PuveIaPronostico ? 'Por ejemplo, ' + window.PuveIaPronostico.textoAccion(mt.acciones[0], $r) + '.' : 'Pregúntame «¿Cómo voy con mi meta?» y vemos cómo cerrar la brecha.';
      add(mt.veredicto === 'poco_probable' ? 'ALTO' : 'MEDIO', mt.veredicto === 'poco_probable' ? 'Tu meta del mes va lejos' : 'Tu meta del mes está ajustada', 'Llevas ' + $r(mt.llevo) + ' de ' + $r(mt.monto) + ' y a tu ritmo cerrarías cerca de ' + $r(mt.esperado), acc, { impacto: mt.falta, esfuerzo: 3, confianza: mt.base === 'alta' ? 0.8 : (mt.base === 'media' ? 0.65 : 0.5), chip: '¿Cómo voy con mi meta?' });
    }
    (m.pat || []).forEach((q) => {
      const agotImp = (iv ? iv.agotados : []).filter((x) => ing && x.ventaDiaria * 30 / ing >= 0.05);   // si se agotó algo importante, el ticket sube solo (desaparece lo barato) y NO conviene recomendar «traer más gente»
      if(q.tipo === 'ticket_vs_ops' && !agotImp.length) add('MEDIO', 'Tu reto es traer más gente, no subir el gasto por persona', q.titulo, 'Enfócate en atraer clientes (visibilidad, promoción, horario) más que en subir precios.', { impacto: ing * Math.abs(q.opsPct) * 0.3, esfuerzo: 3, confianza: Math.min(0.75, 0.4 + q.confianza * 0.35) });
      else if(q.tipo === 'dia' && q.dif < 0) add('OPORTUNIDAD', 'Anima tus ' + plural(q.dia), q.titulo, 'Prueba una promoción solo ese día durante unas semanas y mide si sube.', { impacto: ing * 0.04, esfuerzo: 2, confianza: Math.min(0.7, 0.3 + q.confianza * 0.4) });
    });
    return it.sort((a, b) => b.peso - a.peso || (b.impacto * b.confianza / b.esfuerzo) - (a.impacto * a.confianza / a.esfuerzo));
  }

  // ---------- la meta del orquestador ----------
  const META = {
    candidatas(mem){
      if(mem.parar) return [];
      const rol = mem.ctx.rol, t = mem.ctx.t, equipo = rol === 'admin' || rol === 'analista', admin = rol === 'admin', c = [];
      c.push({ id: 'estado', herramienta: 'estado_negocio', args: {}, porque: 'ver cuántos datos tengo para calificar con seguridad', prioridad: 10 });
      c.push({ id: 'cmp', herramienta: 'comparar_periodos', args: { periodo: t }, porque: 'comparar tus ventas contra el periodo anterior', prioridad: 9 });
      if(admin) c.push({ id: 'rent', herramienta: 'rentabilidad_productos', args: {}, porque: 'ver cuánto aporta cada producto a tus ventas y a tu ganancia', prioridad: 8 });
      if(equipo){ c.push({ id: 'riesgo', herramienta: 'riesgo_inventario', args: {}, porque: 'ver qué producto importante se acaba primero y de qué dependes', prioridad: 7 });
        c.push({ id: 'inv', herramienta: 'analizar_inventario', args: {}, porque: 'ver qué está agotado y cuánto dinero tienes parado', prioridad: 6 }); }
      if(admin) c.push({ id: 'gastos', herramienta: 'analizar_gastos', args: { periodo: t }, porque: 'ver si tus gastos van contra tus ventas', prioridad: 5 });
      c.push({ id: 'tend', herramienta: 'detectar_tendencias', args: { semanas: 8 }, porque: 'ver si tus ventas vienen subiendo o bajando', prioridad: 4 });
      c.push({ id: 'anom', herramienta: 'detectar_anomalias', args: { dias: 45 }, porque: 'buscar días raros', prioridad: 3 });
      if(admin && T.catalogo('admin').some((x) => x.nombre === 'progreso_meta')) c.push({ id: 'meta', herramienta: 'progreso_meta', args: {}, porque: 'ver cómo vas con la meta del mes que guardaste', prioridad: 1 });
      if(admin && T.catalogo('admin').some((x) => x.nombre === 'evaluar_cambios_precio')) c.push({ id: 'cambios', herramienta: 'evaluar_cambios_precio', args: {}, porque: 'ver si tus cambios de precio recientes funcionaron', prioridad: 0.5 });
      if(equipo && T.catalogo(rol).some((x) => x.nombre === 'conocimiento_giro')) c.push({ id: 'giro', herramienta: 'conocimiento_giro', args: {}, porque: 'revisar lo propio de tu giro', prioridad: 0.3 });
      if(equipo) c.push({ id: 'pat', herramienta: 'detectar_patrones', args: { periodo: t }, porque: 'buscar patrones que no me pediste (días, horas, productos que van juntos)', prioridad: 2 });
      return c;
    },
    integrar(mem, c, r){
      if(!r.ok){ mem.avisos.push('No pude revisar ' + c.porque.replace(/^(ver|comparar|buscar) /, '') + ' (' + r.error + ')'); return 'no disponible'; }
      const d = r.datos;
      if(c.id === 'estado'){ mem.estado = d; if(!d.suficiente) mem.parar = 'sin_datos'; return d.ventas30 + ' ventas en 30 días, ' + d.dias30 + ' días con ventas'; }
      if(c.id === 'cmp'){
        mem.cmp = d; mem.real = RZ.esReal({ totalAct: d.act.total, totalAnt: d.ant.total, diasAct: d.act.dias, diasAnt: d.ant.dias, sigmaDia: d.sigmaDia });
        if(d.incompleto){ mem.real.confianza *= 0.85; mem.avisos.push('El periodo todavía no termina, así que las cifras pueden moverse.'); }
        if(!d.ant.n || !d.act.n) mem.parar = 'sin_datos';
        return d.delta.pct != null ? sgn(d.delta.pct) + ' en ventas · ' + (mem.real.real ? 'cambio real' : 'cabe en lo normal') : 'sin periodo anterior con qué comparar';
      }
      if(c.id === 'rent'){ mem.rent = d; return d.pocoRinde.length ? d.pocoRinde.length + ' producto(s) venden más de lo que ganan' : 'tus ventas y tu ganancia van parejas'; }
      if(c.id === 'riesgo'){ mem.riesgo = d; const n = d.criticos.filter((x) => x.agotado || x.dias <= 3).length; return n ? n + ' producto(s) importantes por faltar' : 'nada importante por faltar'; }
      if(c.id === 'inv'){ mem.inv = d; return d.agotados.length + ' agotado(s), ' + d.porAgotarse.length + ' por agotarse'; }
      if(c.id === 'gastos'){ mem.gastos = d; return d.disponible ? 'gastos ' + $r(d.act) + ' contra ' + $r(d.ant) : 'sin gastos anotados'; }
      if(c.id === 'tend'){ mem.tend = d; return d.tendencia ? 'vienen ' + (d.tendencia.direccion === 'baja' ? 'bajando' : (d.tendencia.direccion === 'sube' ? 'subiendo' : 'estables')) : 'pocos datos'; }
      if(c.id === 'meta'){ mem.meta = d; return d.hayMeta ? 'meta de ' + $r(d.monto) + ': ' + (d.veredicto || 'sin datos').replace('_', ' ') : 'no hay meta guardada'; }
      if(c.id === 'cambios'){ mem.cambios = d.cambios; return d.cambios.length ? veces(d.cambios.length, 'cambio de precio detectado', 'cambios de precio detectados') : 'sin cambios de precio recientes'; }
      if(c.id === 'giro'){ mem.giro = d.sinGiro ? null : d; return d.sinGiro ? 'no sé de qué giro es tu negocio' : d.nombre + ': ' + veces(d.indicadores.filter((x) => x.estado === 'atencion').length, 'indicador', 'indicadores') + ' en atención'; }
      if(c.id === 'pat'){ mem.pat = d.patrones; return d.patrones.length ? d.patrones.length + ' patrón(es) encontrado(s)' : 'ningún patrón claro'; }
      if(c.id === 'anom'){ mem.anom = d; return d.dias.length ? d.dias.length + ' día(s) raros' : 'ningún día raro'; }
      return '';
    },
    suficiente(mem){ return !!mem.parar; },
    concluir(mem){
      const out = { meta: 'diagnostico_general', t: mem.ctx.t, pasos: mem.pasos, avisos: mem.avisos, rondas: mem.rondas, estado: 'ok', hipotesis: [], contexto: [], real: mem.real || null, puntuaciones: [], global: null, prioridades: [], patrones: [], objetivo: null, giro: null };
      if(mem.parar === 'sin_datos' || !mem.cmp){ out.estado = 'sin_datos'; return out; }
      const sc = puntuar(mem); out.puntuaciones = sc.puntuaciones; out.global = sc.global;
      const hoy = new Date(); hoy.setDate(hoy.getDate() - 30);
      const sinVentas = mem.anom ? mem.anom.dias.filter((x) => x.tipo === 'sin_ventas' && new Date(x.fecha + 'T12:00:00') >= hoy).length : 0;
      out.prioridades = priorizar(mem, { rel: sc.rel, capital: sc.capital, sinVentas });
      if(out.global && out.prioridades.some((p) => p.peso === 5)){   // un promedio no puede esconder una alerta crítica (MD §27)
        out.global.critico = true; if(out.global.veredicto === 'muy bien') out.global.veredicto = 'bien'; if(out.global.veredicto === 'bien') out.global.veredicto = 'bien en general, pero hay algo crítico que atender hoy';
        else out.global.veredicto += ', y hay algo crítico que atender hoy';
      }
      const cp = (mem.cambios || []).filter((x) => x.veredicto).map((x) => ({ x, m: x.metricas.find((y) => y.k === x.principal), et: x.principal === 'utilidad' ? 'la ganancia por día' : 'las ventas por día' }));
      const agotP = (mem.inv ? mem.inv.agotados : []).filter((x) => mem.estado && mem.estado.ingresos30 && x.ventaDiaria * 30 / mem.estado.ingresos30 >= 0.05);
      (mem.pat || []).forEach((q) => { if(q.tipo === 'ticket_vs_ops' && agotP.length && !/ojo:/.test(q.titulo)) q.titulo += ' (ojo: puede deberse a que se agotó ' + agotP[0].nombre + ')'; });
      out.patrones = cp.filter((y) => y.x.veredicto === 'favorable').map((y) => ({ tipo: 'cambio_precio', fuerza: 1, confianza: 0.8, titulo: 'Tu cambio de precio de ' + y.x.nombre + ' ($' + Math.round(y.x.de) + ' → $' + Math.round(y.x.a) + ') está funcionando: ' + y.et + ' subió ' + pct(y.m.relativo) + ' más que el resto de tu negocio' })).concat(mem.pat || []).slice(0, 3); out.objetivo = mem.meta && mem.meta.hayMeta && mem.meta.veredicto ? mem.meta : null; out.giro = mem.giro || null;
      out.incompleto = mem.pasos.some((x) => !x.ok);
      out.confianza = mem.real ? mem.real.confianza : 0;
      return out;
    }
  };
  O.registrarMeta('diagnostico_general', META);

  // ---------- presentación ----------
  function presentar(r){
    const t = r.t;
    if(r.estado === 'sin_datos') return [P('Todavía no tengo ventas suficientes ' + (t.explicito ? en(t) : 'en este periodo') + ' (o no hay con qué comparar) para calificar tu negocio con seguridad. Con unos días más de ventas registradas, lo hago.'), C([sug('¿Cuánto vendí?')])];
    const out = [], g = r.global;
    out.push(P(g ? 'Tu negocio va **' + g.veredicto + '** (' + g.puntos + '/100 en promedio de ' + g.areas + ' áreas' + (r.incompleto ? ', **calificación parcial: no pude revisar todo**' : '') + '), ' + en(t) + '.' : 'Todavía no puedo calificar tu negocio completo: me faltan datos en varias áreas.'));
    out.push(L('Puntuación por área', r.puntuaciones.filter((x) => x.puntos != null).map((x) => [x.etiqueta, x.puntos + '/100 · ' + x.nivel, x.motivos[0]])));
    if(r.objetivo){ const E = { alcanzable: 'alcanzable', exigente: 'exigente', poco_probable: 'poco probable', sin_sustento: 'todavía sin datos para opinar', lograda: '¡ya la lograste!' };
      out.push(P('**Meta del mes:** llevas ' + $r(r.objetivo.llevo) + ' de ' + $r(r.objetivo.monto) + (r.objetivo.bajo != null ? '; cierre probable entre ' + $r(r.objetivo.bajo) + ' y ' + $r(r.objetivo.alto) : '') + ' (' + (E[r.objetivo.veredicto] || '') + ').')); }
    if(r.giro){ const at = r.giro.indicadores.filter((x) => x.estado === 'atencion'), pf = r.giro.proximas[0];
      out.push(P('**Para tu giro (' + r.giro.nombre.toLowerCase() + '):** ' + (at.length ? at.map((x) => x.etiqueta.toLowerCase()).join('; ') + '.' : 'con lo que puedo medir, no veo alertas.') + (pf ? ' Próxima fecha fuerte: ' + pf.nombre + ' (en ' + veces(pf.dias, 'día', 'días') + ').' : '') + (r.giro.temporada ? ' ' + r.giro.temporada.n + ': ' + r.giro.temporada.tip : ''))); }
    const top = r.prioridades.slice(0, 3);
    if(top.length) out.push(P('**Si solo haces tres cosas, haz estas:**'), S('', top.map((x) => [x.titulo + ' · ' + x.nivel, x.porque + '. ' + x.accion])));
    else out.push(P(r.incompleto ? 'Con lo que pude revisar no veo nada urgente, pero **no pude revisar todo**: no lo des por cerrado, vuelve a preguntarme en un momento.' : 'No veo nada urgente: mantén lo que estás haciendo y revisa de nuevo en unos días.'));
    if(r.patrones.length) out.push(L('Algo que noté sin que me lo pidieras', r.patrones.map((q) => [q.titulo])));
    const faltan = r.puntuaciones.filter((x) => x.puntos == null);
    if(faltan.length) out.push(P('No califiqué: ' + faltan.map((x) => x.etiqueta.replace(/ \(.*\)/, '').toLowerCase()).join(', ') + '. ' + (faltan.some((x) => x.clave === 'clientes') ? 'Para clientes todavía no tengo cómo medirlo.' : 'Me faltan datos o permisos para esas áreas.')));
    r.avisos.forEach((x) => out.push(P('Nota: ' + x)));
    const chips = ['¿Cómo lo averiguaste?'], p0 = top.find((x) => x.chip); if(p0) chips.push(p0.chip); else chips.push('¿Qué me recomiendas hacer?');
    chips.push('Dame un plan para la semana'); out.push(C(chips.slice(0, 3).map(sug)));
    return out;
  }

  // ---------- temas del chat: «salud» (¿cómo está mi negocio?) y «¿cómo lo averiguaste?» que también explica cada puntuación ----------
  const previoSalud = R.handler && R.handler('salud'), previoComo = R.handler && R.handler('como_averiguaste');
  const H = {};
  H.salud = async (c) => {
    const rol = enlace().rol(); if(rol === 'vendedor' && previoSalud) return previoSalud(c);
    const t = c.t && c.t.explicito ? c.t : N.ultimos(30), est = c.estado || {};
    let res; try { res = await O.investigar('diagnostico_general', { t, rol }); } catch(e){ res = null; }
    if(!res) return previoSalud ? previoSalud(c) : [P('No pude revisar tu negocio ahora. Intenta de nuevo en un momento.')];
    est.nucleo = { ult: res, cuando: Date.now() };
    return presentar(res);
  };
  H.como_averiguaste = async (c) => {
    const base = previoComo ? await previoComo(c) : [], u = c.estado && c.estado.nucleo && c.estado.nucleo.ult;
    if(!u || u.meta !== 'diagnostico_general' || !u.puntuaciones.length) return base;
    base.push(L('Cómo calculé cada puntuación', u.puntuaciones.filter((x) => x.puntos != null).map((x) => [x.etiqueta, x.puntos + '/100', x.motivos.join('; ')])));
    base.push(P('Cada puntuación parte de una base y suma o resta por lo que encontré; no es una calificación inventada. Si falta información, el área queda sin calificar en vez de adivinarla.'));
    return base;
  };
  // «mis ventas bajaron pero mi ticket subió» (MD §56): se miran las TRES cifras (ventas, número de ventas y ticket) y se dice qué es lo más probable, como hipótesis
  const previoPorQue = R.handler && R.handler('por_que'), RE_TICKET = /(ticket|compra promedio|gasto (por|de cada) (cliente|persona)|cuanto gasta cada)/, RE_BAJAN = /(ventas?|vendo|vendi|ingresos?).*(baj|cay|menos|disminu)/, RE_SUBE = /(subi|sube|subio|aument|crec|mejor)/;
  H.por_que = async (c) => {
    const t = N.norm(c.texto || c.original || ''), rol = enlace().rol();
    if(!(RE_TICKET.test(t) && RE_BAJAN.test(t) && RE_SUBE.test(t)) || !EQUIPO.includes(rol)) return previoPorQue ? previoPorQue(c) : [P('No pude revisar eso ahora.')];
    const per = c.t && c.t.explicito ? c.t : N.ultimos(30), cm = await T.llamar('comparar_periodos', { periodo: per }, {}), iv = await T.llamar('analizar_inventario', {}, {});
    if(!cm.ok || !cm.datos.act.n || !cm.datos.ant.n) return [P('Todavía no tengo ventas suficientes ' + en(per) + ' y en el periodo anterior para comparar ventas, número de ventas y ticket.')];
    const a = cm.datos.act, b = cm.datos.ant, pv = a.total / b.total - 1, po = a.n / b.n - 1, ta = a.total / a.n, tb = b.total / b.n, pt = ta / tb - 1, sg = (x) => (x >= 0 ? '+' : '−') + Math.round(Math.abs(x) * 100) + '%', ing = a.total * 30 / (a.dias || 30);
    const ag = iv.ok ? iv.datos.agotados.filter((x) => ing && x.ventaDiaria * 30 / ing >= 0.05) : [], o = [P('**Lo que pasó** ' + en(per) + ': ventas ' + sg(pv) + ' (' + $r(b.total) + ' → ' + $r(a.total) + '), número de ventas ' + sg(po) + ' (' + fmt(b.n) + ' → ' + fmt(a.n) + ') y ticket promedio ' + sg(pt) + ' (' + $r(tb) + ' → ' + $r(ta) + ').')];
    if(pv < -0.03 && po <= -0.05 && pt >= 0.03){
      o.push(P('Con estas cifras, lo más probable es que **tu cambio venga de cuántas ventas haces, no de cuánto gasta cada quien**: cada cliente gasta más, pero hay menos clientes comprando. Es lo más probable con estos números, no una certeza.'));
      o.push(P(ag.length ? 'Ojo: se agotó **' + ag[0].nombre + '**. Cuando se acaba un producto barato el ticket sube solo y bajan las ventas, así que primero revisa eso antes de pensar en atraer más gente.' : 'Lo que conviene revisar es qué días u horas se movió menos gente. Pregúntame «¿en qué días vendo menos?».'));
    } else if(pv < -0.03 && pt < 0) o.push(P('Aquí el ticket **no** subió: bajó, y las ventas también. Con estos números cada cliente gasta menos' + (po <= -0.05 ? ' y además hay menos clientes' : '') + '.'));
    else if(pv < -0.03) o.push(P('El ticket subió, pero el número de ventas casi no cambió, así que la baja de ventas no se explica por menos clientes; conviene revisar qué productos se dejaron de vender.'));
    else o.push(P('Con estos números las ventas no bajaron de forma clara ' + en(per) + '.'));
    o.push(C([sug('¿Por qué estoy vendiendo menos?'), sug('¿Cómo está mi negocio?')])); return o;
  };
  R.registrarTemas({ salud: H.salud, como_averiguaste: H.como_averiguaste, por_que: H.por_que }, {}, { salud: 'Revisando todo tu negocio…' });
  window.PuveIaDiagnostico = { puntuar, priorizar, presentar, internos: { META, NV } };
})();
