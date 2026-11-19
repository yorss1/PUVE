/* PUVE IA · Herramientas controladas (Etapas 1 y 2 del plan de arquitectura; motor propio, SIN IA externa)
 * Idea del MD §9–10: quien razona (el orquestador, y mañana cualquier otro razonador) NUNCA toca la base ni escribe SQL.
 * Solo puede llamar herramientas autorizadas, y cada herramienta tiene:
 *   · entrada validada (campos permitidos, tipos y rangos; lo que sobra o es raro se rechaza),   · permisos por rol,
 *   · límites (filas y tiempo),   · salida estructurada ({ok, datos, error, ms}),   · manejo de errores (nunca truena),   · trazabilidad (cada llamada queda en el registro).
 * Todas son de SOLO LECTURA y leen a través de PuveIaDatos (que respeta que el cajero solo vea sus propias ventas).
 * Se carga después de puve-resumen.js y puve-ia-razonamiento.js.
 */
(function(){
  'use strict';
  const R = window.PuveResumen, RZ = window.PuveIaRazonamiento;
  if(!R || !R.internos || !RZ) return;
  const I = R.internos, { D, N } = I, enlace = () => I.enlace();
  const ROLES = ['admin', 'analista', 'vendedor'], ADMIN = ['admin'], EQUIPO = ['admin', 'analista'];
  let TIEMPO_MS = 9000; const REG = new Map(), TRAZA = [];
  const DIA = 86400000, DIAS_SEM = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

  // ---------- registro y validación ----------
  function registrar(def){
    if(!def || !/^[a-z_]{3,40}$/.test(def.nombre || '') || typeof def.ejecutar !== 'function') throw new Error('Herramienta mal definida');
    if(!(def.permisos || ROLES).every((r) => ROLES.includes(r))) throw new Error('Rol desconocido en ' + def.nombre);
    REG.set(def.nombre, Object.assign({ descripcion: '', entrada: {}, permisos: ROLES.slice(), limite: { filas: 40 }, produce: [] }, def));
  }
  const esFecha = (d) => d instanceof Date && isFinite(d.getTime());
  function validar(esquema, args){
    args = args || {}; const valores = {}, errores = [];
    if(typeof args !== 'object' || Array.isArray(args)) return { errores: ['la entrada debe ser un objeto'] };
    Object.keys(args).forEach((k) => { if(!(k in esquema)) errores.push('campo no permitido: ' + k); });
    Object.keys(esquema).forEach((k) => {
      const e = esquema[k], v = args[k];
      if(v === undefined || v === null){ if(e.requerido) errores.push('falta ' + k); else if(e.defecto !== undefined) valores[k] = e.defecto; return; }
      if(e.tipo === 'numero'){ const n = Number(v); if(!isFinite(n) || (e.min != null && n < e.min) || (e.max != null && n > e.max)) errores.push(k + ' fuera de rango'); else valores[k] = n; }
      else if(e.tipo === 'texto'){ const s = String(v).replace(/[\u0000-\u001f]/g, ' ').trim(); if(!s || s.length > (e.max || 80)) errores.push(k + ' inválido'); else valores[k] = s; }
      else if(e.tipo === 'opcion'){ if(!e.valores.includes(v)) errores.push(k + ' debe ser uno de: ' + e.valores.join(', ')); else valores[k] = v; }
      else if(e.tipo === 'periodo'){
        if(!v || !esFecha(v.desde) || !esFecha(v.hasta) || !esFecha(v.prevDesde) || !esFecha(v.prevHasta) || v.hasta <= v.desde || v.prevHasta <= v.prevDesde || v.hasta - v.desde > 400 * DIA || v.prevHasta - v.prevDesde > 400 * DIA) errores.push(k + ' no es un periodo válido');
        else valores[k] = v;
      } else errores.push('tipo desconocido para ' + k);
    });
    return { valores, errores };
  }
  const recorta = (x, max, marca) => {   // límite de filas: recorta cualquier lista larga y avisa que se recortó
    if(Array.isArray(x)){ if(x.length > max){ marca.cortado = true; return x.slice(0, max).map((y) => recorta(y, max, marca)); } return x.map((y) => recorta(y, max, marca)); }
    if(x && typeof x === 'object' && !(x instanceof Date)){ const o = {}; Object.keys(x).forEach((k) => { o[k] = recorta(x[k], max, marca); }); return o; }
    return x;
  };
  const resumenArgs = (a) => { try { return JSON.stringify(a || {}, (k, v) => v instanceof Date ? v.toISOString().slice(0, 10) : v).slice(0, 140); } catch(e){ return '{}'; } };
  async function llamar(nombre, args, ctx){
    const t0 = Date.now(), def = REG.get(nombre), tr = { herramienta: nombre, args: resumenArgs(args), ok: false, ms: 0, error: null, t: t0 };
    let res;
    try {
      if(!def) res = { ok: false, tipo: 'desconocida', error: 'Esa herramienta no existe.' };
      else if(!def.permisos.includes(enlace().rol())) res = { ok: false, tipo: 'permiso', error: 'Esta consulta no está disponible para tu rol.' };
      else {
        const v = validar(def.entrada, args);
        if(v.errores.length) res = { ok: false, tipo: 'entrada', error: v.errores.join('; ') };
        else {
          let timer; const lento = new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('tardó demasiado')), TIEMPO_MS); });
          try { const datos = await Promise.race([def.ejecutar(v.valores, ctx || {}), lento]), marca = {}; res = { ok: true, datos: recorta(datos, def.limite.filas, marca), truncado: !!marca.cortado }; }
          finally { clearTimeout(timer); }
        }
      }
    } catch(e){ res = { ok: false, tipo: 'error', error: String((e && e.message) || e).slice(0, 120) }; }
    res.herramienta = nombre; res.ms = Date.now() - t0;
    tr.ok = res.ok; tr.ms = res.ms; tr.error = res.ok ? null : res.tipo + ': ' + res.error; TRAZA.push(tr); if(TRAZA.length > 200) TRAZA.shift();
    return res;
  }
  const catalogo = (rol) => [...REG.values()].filter((d) => d.permisos.includes(rol || enlace().rol())).map((d) => ({ nombre: d.nombre, descripcion: d.descripcion, produce: d.produce.slice() }));

  // ---------- utilidades de las herramientas ----------
  const diasDe = (desde, hasta) => Math.max(1, Math.round((Math.min(hasta.getTime(), Date.now()) - desde.getTime()) / DIA));
  const ocurrencias = (desde, hasta) => { const o = [0, 0, 0, 0, 0, 0, 0], fin = Math.min(hasta.getTime(), Date.now()); for(let t = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate()).getTime(); t < fin; t += DIA) o[new Date(t + 3600000).getDay()]++; return o; };
  const fila = (clave, etiqueta, act, ant, extra) => Object.assign({ clave, etiqueta, act, ant, delta: act - ant }, extra || {});
  const tope = (filas, n) => filas.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, n);

  // ---------- herramientas ----------
  const PERIODO = { tipo: 'periodo', requerido: true };
  registrar({
    nombre: 'comparar_periodos', descripcion: 'Compara ventas, operaciones y ticket de un periodo contra el anterior y los descompone', entrada: { periodo: PERIODO }, produce: ['cambio', 'descomposicion'],
    async ejecutar({ periodo: t }){
      const pc = await D.periodoCompleto(t), a = pc.act, b = pc.ant, dd = RZ.descomponer(b.n, b.ticket, a.n, a.ticket);
      const serie = await D.diario(60), hoy = new Date(), cal = [], ini = serie.length ? new Date(serie[0].fecha + 'T12:00:00') : hoy, mapa = new Map(serie.map((x) => [x.fecha, x.total]));
      for(let d = new Date(ini.getFullYear(), ini.getMonth(), ini.getDate()); d <= hoy; d.setDate(d.getDate() + 1)) cal.push(mapa.get(D.fechaLocal(d)) || 0);
      const hoyDia = cal.length ? cal.length - 1 : -1, totales = cal.slice(0, Math.max(0, hoyDia));   // sin el día en curso (está incompleto)
      return {
        act: { total: a.total, n: a.n, ticket: a.ticket, dias: diasDe(t.desde, t.hasta) }, ant: { total: b.total, n: b.n, ticket: b.ticket, dias: diasDe(t.prevDesde, t.prevHasta) },
        delta: { total: a.total - b.total, pct: b.total ? (a.total - b.total) / b.total : null, n: a.n - b.n, nPct: b.n ? (a.n - b.n) / b.n : null, ticket: a.ticket - b.ticket, ticketPct: b.ticket ? (a.ticket - b.ticket) / b.ticket : null },
        descomposicion: dd, sigmaDia: RZ.desv(totales), diasConDatos: serie.length, incompleto: t.hasta.getTime() > Date.now(),
        margen: enlace().rol() === 'admin' && (a.margen != null || b.margen != null) ? { act: a.margen, ant: b.margen } : null
      };
    }
  });
  registrar({
    nombre: 'ventas_por_dimension', descripcion: 'Cuánto del cambio de ventas explica cada producto, hora, día, forma de pago o cajero', produce: ['contribuciones'],
    entrada: { periodo: PERIODO, dimension: { tipo: 'opcion', requerido: true, valores: ['producto', 'hora', 'dia_semana', 'metodo_pago', 'cajero'] }, metrica: { tipo: 'opcion', valores: ['monto', 'margen'], defecto: 'monto' } },
    async ejecutar({ periodo: t, dimension, metrica }, ctx){
      const rol = enlace().rol();
      if((dimension === 'producto' || dimension === 'cajero') && !EQUIPO.includes(rol)) throw new Error('Esta dimensión no está disponible para tu rol');
      if(metrica === 'margen' && rol !== 'admin') throw new Error('El margen lo ve solo el encargado');
      const pc = await D.periodoCompleto(t), a = pc.act, b = pc.ant; let filas = [], extra = {}, base = 0;
      if(dimension === 'producto'){
        const nombres = new Set(Object.keys(a.productos).concat(Object.keys(b.productos)));
        const todas = [...nombres].map((nom) => {
          const x = a.productos[nom] || { cant: 0, monto: 0, margen: 0 }, y = b.productos[nom] || { cant: 0, monto: 0, margen: 0 }, m1 = metrica === 'margen' ? x.margen : x.monto, m0 = metrica === 'margen' ? y.margen : y.monto;
          const pu0 = y.cant ? y.monto / y.cant : 0, pu1 = x.cant ? x.monto / x.cant : 0, id = (x.id || y.id);
          let ePrecio = 0, eVol = m1 - m0;
          if(metrica === 'monto' && y.cant > 0 && x.cant > 0){ eVol = (x.cant - y.cant) * pu0; ePrecio = (pu1 - pu0) * x.cant; }
          return fila(nom, nom, m1, m0, { id, cantAct: x.cant, cantAnt: y.cant, precioAct: pu1, precioAnt: pu0, efectoPrecio: ePrecio, efectoVolumen: eVol, nuevo: !y.cant && x.cant > 0, perdido: y.cant > 0 && !x.cant });
        });
        base = todas.reduce((q, f) => q + Math.max(0, f.ant), 0); filas = todas.filter((f) => Math.abs(f.delta) > 0.005);
      } else if(dimension === 'hora'){
        for(let h = 0; h < 24; h++) if(a.porHora[h] || b.porHora[h]) filas.push(fila(String(h), String(h), a.porHora[h], b.porHora[h], { h, opsAct: a.nHora[h], opsAnt: b.nHora[h] }));
        base = filas.reduce((q, f) => q + Math.max(0, f.ant), 0); filas = filas.filter((f) => Math.abs(f.delta) > 0.005);
      } else if(dimension === 'dia_semana'){
        const oA = ocurrencias(t.desde, t.hasta), oB = ocurrencias(t.prevDesde, t.prevHasta);
        for(let d = 0; d < 7; d++) if(a.porDia[d] || b.porDia[d]) filas.push(fila(String(d), DIAS_SEM[d], a.porDia[d], b.porDia[d], { d, ocurrenciasAct: oA[d], ocurrenciasAnt: oB[d] }));
        extra = { calendarioDistinto: oA.some((x, d) => x !== oB[d]) }; base = filas.reduce((q, f) => q + Math.max(0, f.ant), 0);
      } else if(dimension === 'metodo_pago'){
        const ks = new Set(Object.keys(a.porMetodo).concat(Object.keys(b.porMetodo)));
        filas = [...ks].map((k) => fila(k, k, a.porMetodo[k] || 0, b.porMetodo[k] || 0)); base = filas.reduce((q, f) => q + Math.max(0, f.ant), 0); filas = filas.filter((f) => Math.abs(f.delta) > 0.005);
      } else {
        const ids = [...new Set(Object.keys(a.porCajero).concat(Object.keys(b.porCajero)))], nombres = await D.nombresUsuarios(ids);
        filas = ids.map((id) => fila(id, nombres[id] || 'Un cajero', (a.porCajero[id] || { total: 0 }).total, (b.porCajero[id] || { total: 0 }).total, { opsAct: (a.porCajero[id] || { n: 0 }).n, opsAnt: (b.porCajero[id] || { n: 0 }).n }));
        base = filas.reduce((q, f) => q + Math.max(0, f.ant), 0); filas = filas.filter((f) => Math.abs(f.delta) > 0.005);
      }
      const total = suma0(filas), baseTotal = base;
      return Object.assign({ dimension, metrica, totalDelta: total, baseTotal, filas: dimension === 'hora' ? filas : tope(filas, 12), filasTotales: filas.length }, extra);
    }
  });
  const suma0 = (filas) => filas.reduce((s, f) => s + f.delta, 0);
  registrar({
    nombre: 'analizar_inventario', descripcion: 'Productos agotados que se vendían, por agotarse, y mercancía parada', permisos: EQUIPO, produce: ['inventario'], entrada: {},
    async ejecutar(){
      const an = await D.analisis(), fis = an.lista.filter((x) => x.fisico);
      const agotados = fis.filter((x) => Number(x.stock) <= 0 && (x.uPrev > 0 || x.u30 > 0)).map((x) => ({ id: x.id, nombre: x.nombre, u30: x.u30, uPrev: x.uPrev, ventaDiaria: (x.ing30 || 0) / 30 }));
      const porAgotarse = fis.filter((x) => Number(x.stock) > 0 && x.u30 > 0 && x.dias != null && x.dias <= 3).map((x) => ({ id: x.id, nombre: x.nombre, dias: x.dias, stock: x.stock }));
      const parados = fis.filter((x) => x.u30 === 0 && Number(x.stock) > 0 && x.capital > 0).sort((p, q) => q.capital - p.capital).slice(0, 8).map((x) => ({ nombre: x.nombre, capital: x.capital }));
      return { agotados, porAgotarse, parados, capitalParado: parados.reduce((s, x) => s + x.capital, 0) };
    }
  });
  registrar({
    nombre: 'detectar_anomalias', descripcion: 'Días raros: sin ventas, muy bajos o muy altos', produce: ['anomalias'], entrada: { dias: { tipo: 'numero', min: 14, max: 90, defecto: 45 } },
    async ejecutar({ dias }){
      const d = await D.diario(dias), mapa = new Map(d.map((x) => [x.fecha, x.total])), serie = [], hoy = new Date(), hoyK = D.fechaLocal(hoy);
      if(!d.length) return { mediana: 0, sigma: 0, dias: [] };
      for(let f = new Date(d[0].fecha + 'T12:00:00'); D.fechaLocal(f) < hoyK; f.setDate(f.getDate() + 1)){ const k = D.fechaLocal(f); serie.push({ fecha: k, total: mapa.get(k) || 0 }); }
      return RZ.anomalias(serie, 3);
    }
  });
  registrar({
    nombre: 'detectar_tendencias', descripcion: 'Si las ventas semanales vienen subiendo, bajando o estables', produce: ['tendencia'], entrada: { semanas: { tipo: 'numero', min: 4, max: 12, defecto: 8 } },
    async ejecutar({ semanas }){
      const d = await D.diario(semanas * 7 + 7), hoy = new Date(), sem = [], primera = d.length ? d[0].fecha : null;
      for(let s = semanas; s >= 1; s--){
        const fin = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - (s - 1) * 7), ini = new Date(fin.getTime() - 7 * DIA), a = D.fechaLocal(ini), z = D.fechaLocal(fin);
        if(primera && a < primera && s > 1) continue;   // semanas anteriores al primer día con ventas (o a medias): no cuentan
        sem.push(d.filter((x) => x.fecha > a && x.fecha <= z).reduce((t, x) => t + x.total, 0));
      }
      const dif = sem.slice(1).map((v, i) => v - sem[i]); let consecutivas = 0; const sg = dif.length ? Math.sign(dif[dif.length - 1]) : 0;
      for(let i = dif.length - 1; i >= 0 && sg && Math.sign(dif[i]) === sg; i--) consecutivas++;
      return { semanas: sem, tendencia: sem.length >= 4 ? RZ.tendencia(sem) : null, consecutivas, signo: sg };
    }
  });
  registrar({
    nombre: 'calcular_margen', descripcion: 'Margen de ganancia del periodo contra el anterior', permisos: ADMIN, produce: ['margen'], entrada: { periodo: PERIODO },
    async ejecutar({ periodo: t }){
      const pc = await D.periodoCompleto(t), a = pc.act, b = pc.ant, cob = (r) => { const p = Object.values(r.productos), tot = p.reduce((s, x) => s + x.monto, 0), con = p.filter((x) => x.margen !== 0 || x.monto === 0).reduce((s, x) => s + x.monto, 0); return tot ? con / tot : 0; };
      return { act: { ventas: a.total, margen: a.margen, pct: a.margen != null && a.total ? a.margen / a.total : null, cobertura: cob(a) }, ant: { ventas: b.total, margen: b.margen, pct: b.margen != null && b.total ? b.margen / b.total : null, cobertura: cob(b) } };
    }
  });
  registrar({
    nombre: 'analizar_gastos', descripcion: 'Gastos del periodo contra el anterior, por categoría', permisos: ADMIN, produce: ['gastos'], entrada: { periodo: PERIODO },
    async ejecutar({ periodo: t }){
      const [g1, g0] = await Promise.all([D.traerGastos(t.desde, t.hasta), D.traerGastos(t.prevDesde, t.prevHasta)]);
      if(!g1 && !g0) return { disponible: false };
      const por = (g) => (g || []).reduce((o, x) => { const k = x.categoria || 'otros'; o[k] = (o[k] || 0) + (Number(x.monto) || 0); return o; }, {}), p1 = por(g1), p0 = por(g0), ks = new Set(Object.keys(p1).concat(Object.keys(p0)));
      return { disponible: true, act: Object.values(p1).reduce((s, x) => s + x, 0), ant: Object.values(p0).reduce((s, x) => s + x, 0), categorias: [...ks].map((k) => fila(k, k, p1[k] || 0, p0[k] || 0)).sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta)).slice(0, 8) };
    }
  });
  registrar({
    nombre: 'buscar_productos_relacionados', descripcion: 'Qué productos se compran junto con uno dado', permisos: EQUIPO, produce: ['relacionados'], entrada: { producto: { tipo: 'texto', requerido: true, max: 60 } },
    async ejecutar({ producto }){
      const an = await D.analisis(), nombre = N.norm(producto), pares = an.pares.filter((p) => N.norm(p.a) === nombre || N.norm(p.b) === nombre);
      return { producto, relacionados: pares.slice(0, 8).map((p) => ({ con: N.norm(p.a) === nombre ? p.b : p.a, veces: p.n })) };
    }
  });
  registrar({
    nombre: 'estado_negocio', descripcion: 'Foto rápida del negocio: cuántos datos hay para razonar con seguridad', produce: ['estado'], entrada: {},
    async ejecutar(){
      const an = await D.analisis(), d = await D.diario(30), rol = enlace().rol(), con = an.lista.filter((x) => x.costo != null && x.ing30 > 0), ing = an.lista.reduce((s, x) => s + (x.ing30 || 0), 0);
      return { rol, ventas30: an.ventas30, dias30: d.length, productosConVentas: an.lista.filter((x) => x.u30 > 0).length, ingresos30: an.ing30, coberturaCostos: ing ? con.reduce((s, x) => s + x.ing30, 0) / ing : 0, suficiente: an.ventas30 >= 10 && d.length >= 5, incompleto: !!(D.truncado && D.truncado()) };   // incompleto: hay tantas ventas que una lectura se cortó en el tope de páginas
    }
  });

  window.PuveIaHerramientas = { config(o){ if(o && o.tiempo > 0) TIEMPO_MS = o.tiempo; }, registrar, llamar, catalogo, trazas: () => TRAZA.slice(), limpiarTrazas: () => { TRAZA.length = 0; }, validar, internos: { REG, diasDe, ocurrencias } };
})();
