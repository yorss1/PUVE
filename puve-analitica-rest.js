/* PUVE - Análisis para restaurantes y cafeterías (Analítica → pestaña "Restaurante").
 * Ingeniería de menú · tiempos de servicio · horas pico y muertas · ventas por cajero.
 * Todo se calcula en el servidor (tiempos_servicio, ingenieria_menu, ventas_por_hora, ventas_por_cajero)
 * y solo lo puede pedir el encargado. Los gráficos usan Chart.js (ya cargado en la página).
 */
(function(){
  'use strict';
  let enlace = { sb: null, dinero: (n) => '$' + Number(n).toFixed(2) };
  let periodo = 30, umbral = 20, grafica = null;

  const CLASES = {
    estrella:     { et: 'Estrella',     color: '#16a34a', rec: 'Vende mucho y deja buen margen. Mantenla visible y no la rebajes.' },
    caballo:      { et: 'Caballo',      color: '#d97706', rec: 'Vende mucho pero deja poco. Prueba subirle un poco el precio o bajar su costo.' },
    rompecabezas: { et: 'Rompecabezas', color: '#2563eb', rec: 'Deja buen margen pero se pide poco. Destácala en el menú o recomiéndala.' },
    perro:        { et: 'Perro',        color: '#dc2626', rec: 'Vende poco y deja poco. Considera reemplazarla o quitarla del menú.' },
    sin_costo:    { et: 'Sin costo',    color: '#6b7280', rec: 'Arma su receta (Inventario → Recetas e insumos) para poder clasificarla.' }
  };
  const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'], DIAS_LARGO = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

  function h(tag, cls, txt, estilo){ const e = document.createElement(tag); if(cls) e.className = cls; if(txt != null) e.textContent = txt; if(estilo) e.style.cssText = estilo; return e; }
  const fmt = (n, d) => Number(n).toLocaleString('es-MX', { maximumFractionDigits: d == null ? 1 : d });
  const hora = (n) => String(n).padStart(2, '0') + ':00';
  function bloque(cont, titulo, nota){
    const b = h('div', 'bloque-analitica', null, 'margin-bottom:20px;'); b.appendChild(h('h3', null, titulo));
    if(nota) b.appendChild(h('p', 'nota', nota, 'margin:0 0 10px;')); cont.appendChild(b); return b;
  }
  function tabla(columnas){
    const wrap = h('div', 'envoltura-tabla'), t = h('table'), th = h('thead'), tr = h('tr');
    columnas.forEach((c) => tr.appendChild(h('th', null, c))); th.appendChild(tr); t.appendChild(th);
    const tb = h('tbody'); t.appendChild(tb); wrap.appendChild(t); return { wrap, tb };
  }
  const celda = (tr, txt, estilo) => { const td = h('td', null, txt, estilo); tr.appendChild(td); return td; };
  const tarjeta = (cont, valor, etq, color) => {
    const c = h('div', null, null, 'border:1px solid var(--borde,#ddd); border-radius:12px; padding:10px 14px; min-width:130px; flex:1;');
    c.appendChild(h('div', null, valor, 'font-size:22px; font-weight:800;' + (color ? 'color:' + color + ';' : ''))); c.appendChild(h('div', 'nota', etq, 'margin:0;')); cont.appendChild(c);
  };
  const error = (cont, m) => cont.appendChild(h('p', 'nota', 'No se pudo cargar: ' + m, 'color:var(--error,#b91c1c);'));

  // ---------------------------------------------------------------------
  async function pintar(cont){
    if(grafica){ try { grafica.destroy(); } catch(e){} grafica = null; }
    cont.textContent = '';
    const barra = h('div', null, null, 'display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-bottom:14px;');
    barra.appendChild(h('span', null, 'Periodo:', 'font-weight:600;'));
    const sel = h('select', 'input-mini', null, 'width:auto;');
    [[7, 'Últimos 7 días'], [30, 'Últimos 30 días'], [90, 'Últimos 90 días']].forEach(([v, t]) => { const o = h('option', null, t); o.value = v; sel.appendChild(o); });
    sel.value = String(periodo); sel.onchange = () => { periodo = parseInt(sel.value, 10); pintar(cont); };
    barra.appendChild(sel); cont.appendChild(barra);

    const secMenu = bloque(cont, 'Ingeniería de menú', 'Cruza lo que se vende con lo que deja cada platillo. Usa el costo de tu receta o, si no hay, el costo del producto.');
    const secTiempos = bloque(cont, 'Tiempos de servicio', 'Minutos desde que entra un pedido por QR hasta que cocina lo marca listo. Se llena desde que se activó esta función.');
    const secHoras = bloque(cont, 'Horas pico y horas muertas', 'Tickets por día y hora (hora de México). Las horas más bajas son tus mejores momentos para una promoción.');
    const secCajeros = bloque(cont, 'Ventas por cajero');
    const secPropinas = bloque(cont, 'Propinas', 'Se registran aparte de la venta (no suman a tus ingresos ni a tus impuestos). Se capturan al cobrar, en la pantalla de venta exitosa.');
    await Promise.all([menu(secMenu), tiempos(secTiempos), horas(secHoras), cajeros(secCajeros), propinas(secPropinas)]);
  }

  async function menu(sec){
    const { data, error: e } = await enlace.sb.rpc('ingenieria_menu', { p_dias: periodo });
    if(e){ error(sec, e.message); return; }
    const items = (data && data.items) || [];
    if(!items.length){ sec.appendChild(h('p', 'nota', 'Todavía no hay ventas de platillos en este periodo.')); return; }
    const cuenta = {}; items.forEach((i) => { cuenta[i.clase] = (cuenta[i.clase] || 0) + 1; });
    const chips = h('div', null, null, 'display:flex; gap:8px; flex-wrap:wrap; margin-bottom:10px;');
    Object.keys(CLASES).forEach((k) => { if(!cuenta[k]) return; const c = h('div', null, null, 'border:2px solid ' + CLASES[k].color + '; border-radius:10px; padding:6px 12px;'); c.appendChild(h('b', null, cuenta[k] + ' ', 'color:' + CLASES[k].color + ';')); c.appendChild(h('span', null, CLASES[k].et)); chips.appendChild(c); });
    sec.appendChild(chips);

    const clasif = items.filter((i) => i.clase !== 'sin_costo');
    if(window.Chart && clasif.length >= 2){
      const caja = h('div', null, null, 'position:relative; height:320px; margin-bottom:12px;'); const cv = h('canvas'); caja.appendChild(cv); sec.appendChild(caja);
      const maxX = Math.max.apply(null, clasif.map((i) => Number(i.unidades))) * 1.1, ys = clasif.map((i) => Number(i.margen_unit));
      const minY = Math.min(0, Math.min.apply(null, ys)) * 1.1, maxY = Math.max.apply(null, ys) * 1.15 || 1;
      const ds = Object.keys(CLASES).filter((k) => k !== 'sin_costo' && cuenta[k]).map((k) => ({
        label: CLASES[k].et, backgroundColor: CLASES[k].color, pointRadius: 6, pointHoverRadius: 8,
        data: clasif.filter((i) => i.clase === k).map((i) => ({ x: Number(i.unidades), y: Number(i.margen_unit), n: i.nombre }))
      }));
      ds.push({ label: 'Popularidad mínima', data: [{ x: Number(data.pop_umbral), y: minY }, { x: Number(data.pop_umbral), y: maxY }], showLine: true, pointRadius: 0, borderColor: '#9ca3af', borderDash: [6, 5], borderWidth: 1.5 });
      ds.push({ label: 'Margen promedio', data: [{ x: 0, y: Number(data.margen_prom) }, { x: maxX, y: Number(data.margen_prom) }], showLine: true, pointRadius: 0, borderColor: '#9ca3af', borderDash: [2, 4], borderWidth: 1.5 });
      grafica = new window.Chart(cv, { type: 'scatter', data: { datasets: ds }, options: {
        responsive: true, maintainAspectRatio: false,
        scales: { x: { title: { display: true, text: 'Unidades vendidas' }, min: 0, max: maxX }, y: { title: { display: true, text: 'Ganancia por unidad ($)' }, min: minY, max: maxY } },
        plugins: { tooltip: { callbacks: { label: (c) => (c.raw && c.raw.n ? c.raw.n + ': ' : '') + fmt(c.raw.x, 0) + ' vendidas · ' + enlace.dinero(c.raw.y) + ' c/u' } } } } });
    }

    const t = tabla(['Platillo', 'Vendidas', 'Ingresos', 'Ganancia c/u', 'Clase', 'Qué hacer']); sec.appendChild(t.wrap);
    items.forEach((i) => {
      const tr = h('tr'), c = CLASES[i.clase] || CLASES.sin_costo;
      const td = celda(tr, i.nombre, 'font-weight:600;'); if(i.categoria) td.appendChild(h('div', 'nota', i.categoria, 'margin:0;'));
      celda(tr, fmt(i.unidades, 1)); celda(tr, enlace.dinero(i.ingresos)); celda(tr, i.margen_unit == null ? '—' : enlace.dinero(i.margen_unit));
      celda(tr, c.et, 'font-weight:700; color:' + c.color + ';'); celda(tr, c.rec, 'font-size:12.5px;'); t.tb.appendChild(tr);
    });
    sec.appendChild(h('p', 'nota', 'Popular = vende al menos 70% de lo que vendería un platillo promedio (' + fmt(data.pop_umbral, 0) + ' unidades). Margen alto = igual o mayor al promedio (' + enlace.dinero(data.margen_prom) + ' por unidad).', 'margin:8px 0 0;'));
  }

  async function tiempos(sec){
    const sel = h('select', 'input-mini', null, 'width:auto; margin-bottom:10px;');
    [[15, 'Tardado si pasa de 15 min'], [20, 'Tardado si pasa de 20 min'], [30, 'Tardado si pasa de 30 min']].forEach(([v, t]) => { const o = h('option', null, t); o.value = v; sel.appendChild(o); });
    sel.value = String(umbral); sel.onchange = () => { umbral = parseInt(sel.value, 10); pintar(sec.parentNode); };
    sec.appendChild(sel);
    const { data, error: e } = await enlace.sb.rpc('tiempos_servicio', { p_dias: periodo, p_umbral_min: umbral });
    if(e){ error(sec, e.message); return; }
    const r = data && data.resumen;
    if(!r || !r.n){ sec.appendChild(h('p', 'nota', 'Aún no hay pedidos por QR terminados con tiempos registrados en este periodo.')); return; }
    const fila = h('div', null, null, 'display:flex; gap:10px; flex-wrap:wrap; margin-bottom:12px;');
    tarjeta(fila, String(r.n), 'Pedidos medidos'); tarjeta(fila, fmt(r.aceptar_min) + ' min', 'Para aceptar el pedido');
    tarjeta(fila, fmt(r.preparar_min) + ' min', 'De preparación'); tarjeta(fila, fmt(r.total_min) + ' min', 'Total hasta listo (promedio)');
    tarjeta(fila, fmt(r.p90_min) + ' min', '9 de cada 10 salen en menos de');
    tarjeta(fila, r.tardados + ' (' + fmt(r.tardados / r.n * 100, 0) + '%)', 'Pasaron de ' + r.umbral + ' min', r.tardados / r.n > 0.2 ? '#dc2626' : '');
    if(r.entrega_min != null) tarjeta(fila, fmt(r.entrega_min) + ' min', 'De listo a entregado');
    sec.appendChild(fila);
    const hs = data.horas || [];
    if(hs.length){
      const maxM = Math.max.apply(null, hs.map((x) => Number(x.total_min))) || 1;
      sec.appendChild(h('div', null, 'Minutos promedio por hora de pedido', 'font-weight:600; margin:6px 0;'));
      hs.forEach((x) => {
        const f = h('div', null, null, 'display:flex; align-items:center; gap:8px; margin:3px 0;');
        f.appendChild(h('span', null, hora(x.h), 'width:50px; font-variant-numeric:tabular-nums;'));
        const barra = h('div', null, null, 'height:16px; border-radius:4px; width:' + Math.max(4, Number(x.total_min) / maxM * 60) + '%; background:' + (Number(x.total_min) > umbral ? '#dc2626' : '#16a34a') + ';');
        f.appendChild(barra); f.appendChild(h('span', 'nota', fmt(x.total_min) + ' min · ' + x.n + ' pedidos', 'margin:0;')); sec.appendChild(f);
      });
    }
  }

  async function horas(sec){
    const { data, error: e } = await enlace.sb.rpc('ventas_por_hora', { p_dias: periodo });
    if(e){ error(sec, e.message); return; }
    const filas = data || [];
    if(!filas.length){ sec.appendChild(h('p', 'nota', 'Todavía no hay ventas en este periodo.')); return; }
    const m = {}; let hMin = 23, hMax = 0, maxT = 0; const porHora = {};
    filas.forEach((f) => { m[f.dow + '-' + f.h] = f; hMin = Math.min(hMin, f.h); hMax = Math.max(hMax, f.h); maxT = Math.max(maxT, f.tickets); porHora[f.h] = (porHora[f.h] || 0) + f.tickets; });
    const wrap = h('div', null, null, 'overflow-x:auto;'); const grid = h('div', null, null, 'display:grid; gap:2px; min-width:' + (60 + (hMax - hMin + 1) * 34) + 'px; grid-template-columns:50px repeat(' + (hMax - hMin + 1) + ', 1fr);');
    grid.appendChild(h('div'));
    for(let x = hMin; x <= hMax; x++) grid.appendChild(h('div', 'nota', String(x), 'text-align:center; margin:0; font-size:11px;'));
    DIAS.forEach((d, dow) => {
      grid.appendChild(h('div', 'nota', d, 'margin:0; align-self:center;'));
      for(let x = hMin; x <= hMax; x++){
        const f = m[dow + '-' + x], a = f ? 0.15 + 0.85 * (f.tickets / maxT) : 0.05;
        const c = h('div', null, f ? String(f.tickets) : '', 'height:28px; border-radius:4px; font-size:11px; display:flex; align-items:center; justify-content:center; color:' + (a > 0.55 ? '#fff' : 'inherit') + '; background:rgba(22,163,74,' + a + ');');
        c.title = DIAS_LARGO[dow] + ' ' + hora(x) + (f ? ': ' + f.tickets + ' tickets, ' + enlace.dinero(f.total) : ': sin ventas'); grid.appendChild(c);
      }
    });
    wrap.appendChild(grid); sec.appendChild(wrap);
    // Resumen en palabras
    let mejor = null; filas.forEach((f) => { if(!mejor || f.tickets > mejor.tickets) mejor = f; });
    sec.appendChild(h('p', null, 'Momento más fuerte: ' + DIAS_LARGO[mejor.dow] + ' a las ' + hora(mejor.h) + ' (' + mejor.tickets + ' tickets en el periodo).', 'margin:10px 0 4px; font-weight:600;'));
    const horasAct = []; for(let x = hMin; x <= hMax; x++) horasAct.push({ h: x, t: porHora[x] || 0 });
    if(horasAct.length >= 4){
      const bajas = horasAct.slice().sort((a, b) => a.t - b.t).slice(0, 3).sort((a, b) => a.h - b.h);
      sec.appendChild(h('p', null, 'Horas más bajas dentro de tu horario: ' + bajas.map((b) => hora(b.h) + ' (' + b.t + ' tickets)').join(', ') + '. Prueba una promoción en esas horas (2×1, combo, bebida a mitad de precio) y compara el periodo siguiente.', 'margin:0; font-weight:600; color:#b45309;'));
    }
  }

  async function cajeros(sec){
    const { data, error: e } = await enlace.sb.rpc('ventas_por_cajero', { p_dias: periodo });
    if(e){ error(sec, e.message); return; }
    const filas = data || [];
    if(!filas.length){ sec.appendChild(h('p', 'nota', 'Todavía no hay ventas en este periodo.')); return; }
    const t = tabla(['Cajero', 'Tickets', 'Vendido', 'Ticket promedio']); sec.appendChild(t.wrap);
    filas.forEach((f, i) => { const tr = h('tr'); celda(tr, (i + 1) + '. ' + f.nombre + (f.rol === 'admin' ? ' (encargado)' : ''), 'font-weight:600;'); celda(tr, String(f.tickets)); celda(tr, enlace.dinero(f.total)); celda(tr, enlace.dinero(f.ticket_promedio)); t.tb.appendChild(tr); });
  }

  async function propinas(sec){
    const { data, error: e } = await enlace.sb.rpc('propinas_resumen', { p_dias: periodo });
    if(e){ error(sec, e.message); return; }
    if(!data || !data.n){ sec.appendChild(h('p', 'nota', 'Todavía no hay propinas registradas en este periodo.')); return; }
    const fila = h('div', null, null, 'display:flex; gap:10px; flex-wrap:wrap; margin-bottom:12px;');
    tarjeta(fila, enlace.dinero(data.total), 'Propinas del periodo'); tarjeta(fila, String(data.n), 'Cuentas con propina');
    if(data.promedio_pct != null) tarjeta(fila, fmt(data.promedio_pct) + '%', 'Propina promedio sobre la cuenta'); sec.appendChild(fila);
    const t = tabla(['Cajero', 'Cuentas', 'Propinas']); sec.appendChild(t.wrap);
    (data.por_cajero || []).forEach((f) => { const tr = h('tr'); celda(tr, f.nombre, 'font-weight:600;'); celda(tr, String(f.n)); celda(tr, enlace.dinero(f.total)); t.tb.appendChild(tr); });
  }

  window.PuveAnaliticaRest = {
    enlazar(o){ enlace = Object.assign(enlace, o || {}); },
    abrir(){ const c = document.getElementById('vistaAnaliticaRestaurante'); if(c) return pintar(c); }
  };
})();
