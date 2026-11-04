/* PUVE - Decisiones (Analítica → pestaña "Decisiones"; los 29 giros).
 * Qué reponer · productos estrella y margen por categoría (ABC) · lento movimiento · clientes que no regresan · mapa de horas.
 * Los números salen del servidor (reposicion_sugerida, analisis_abc, productos_lentos, clientes_inactivos, ventas_por_hora) y solo los pide el encargado.
 * Solo lee: no cambia ventas, inventario ni precios.
 */
(function(){
  'use strict';
  let enlace = { sb: null, dinero: (n) => '$' + Number(n).toFixed(2) };
  const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const fmt = (n, d) => Number(n).toLocaleString('es-MX', { maximumFractionDigits: d == null ? 2 : d });
  function h(tag, cls, txt, estilo){ const e = document.createElement(tag); if(cls) e.className = cls; if(txt != null) e.textContent = txt; if(estilo) e.style.cssText = estilo; return e; }
  function bloque(cont, titulo, nota){ const b = h('div', 'bloque-analitica', null, 'margin-bottom:20px;'); b.appendChild(h('h3', null, titulo)); if(nota) b.appendChild(h('p', 'nota', nota, 'margin:0 0 10px;')); cont.appendChild(b); return b; }
  function tabla(cols){ const w = h('div', 'envoltura-tabla'), t = h('table'), th = h('thead'), tr = h('tr'); cols.forEach((c) => tr.appendChild(h('th', null, c))); th.appendChild(tr); t.appendChild(th); const tb = h('tbody'); t.appendChild(tb); w.appendChild(t); return { wrap: w, tb }; }
  const celda = (tr, txt, estilo) => { const td = h('td', null, txt, estilo); tr.appendChild(td); return td; };
  const error = (c, m) => c.appendChild(h('p', 'nota', 'No se pudo cargar: ' + m, 'color:var(--error,#b91c1c);'));
  const vacio = (c, m) => c.appendChild(h('p', 'nota', m));
  function selector(cont, opciones, valor, fn){ const s = h('select', 'input-mini', null, 'width:auto; margin-bottom:10px;'); opciones.forEach(([v, t]) => { const o = h('option', null, t); o.value = v; s.appendChild(o); }); s.value = String(valor); s.onchange = () => fn(parseInt(s.value, 10)); cont.appendChild(s); return s; }
  function tarjetas(cont, lista){ const f = h('div', null, null, 'display:flex; gap:10px; flex-wrap:wrap; margin-bottom:12px;'); lista.forEach(([v, e]) => { const t = h('div', null, null, 'flex:1 1 140px; border:1px solid var(--borde); border-radius:8px; padding:10px 12px;'); t.appendChild(h('div', null, v, 'font-size:20px; font-weight:600;')); t.appendChild(h('div', null, e, 'font-size:12px; color:var(--texto-suave);')); f.appendChild(t); }); cont.appendChild(f); }
  function boton(txt, fn){ const b = h('button', 'texto', txt, 'width:auto; padding:7px 12px;'); b.type = 'button'; b.onclick = fn; return b; }
  async function rpc(nombre, args){
    const r = await enlace.sb.rpc(nombre, args);
    if(r.error){ if(/does not exist|schema cache|Could not find/i.test(r.error.message || '')) throw new Error('Falta ejecutar el script SQL 110 en Supabase.'); throw new Error(r.error.message); }
    return r.data;
  }
  async function carga(sec, fn){ const z = h('div'); sec.appendChild(z); try { await fn(z); } catch(e){ error(z, (e && e.message) || String(e)); } }
  async function copiar(txt, b){ try { await navigator.clipboard.writeText(txt); b.textContent = 'Copiado ✓'; } catch(e){ window.prompt('Copia el texto:', txt); } }

  // 1) Qué reponer
  function reponer(sec){
    let dias = 30, cob = 14;
    const barra = h('div', null, null, 'display:flex; gap:10px; flex-wrap:wrap; align-items:center;'), z = h('div');
    const go = () => carga(z, async (c) => {
      z.textContent = ''; const d = await rpc('reposicion_sugerida', { p_dias: dias, p_cobertura: cob });
      if(!d.length){ vacio(z, 'Nada urgente: con lo que vendes, todo te alcanza para ' + cob + ' días.'); return; }
      const t = tabla(['Producto', 'Tienes', 'Vendes al día', 'Te alcanza', 'Comprar']); z.appendChild(t.wrap);
      d.forEach((x) => { const tr = h('tr'); celda(tr, x.nombre + (x.categoria ? ' · ' + x.categoria : ''), 'font-weight:600;'); celda(tr, fmt(x.stock)); celda(tr, fmt(x.vende_dia)); celda(tr, x.dias_alcanza == null ? '—' : fmt(x.dias_alcanza, 1) + ' días', x.dias_alcanza != null && x.dias_alcanza < 3 ? 'color:#dc2626; font-weight:600;' : ''); celda(tr, fmt(x.sugerido, 0), 'font-weight:600;'); t.tb.appendChild(tr); });
      const lista = () => 'Lista de compras (alcanzar ' + cob + ' días)\n' + d.map((x) => '• ' + x.nombre + ': ' + fmt(x.sugerido, 0)).join('\n');
      const bb = h('div', null, null, 'display:flex; gap:8px; margin-top:10px;'); const bc = boton('Copiar lista', () => copiar(lista(), bc));
      bb.appendChild(bc); bb.appendChild(boton('Mandar por WhatsApp', () => window.open('https://wa.me/?text=' + encodeURIComponent(lista()), '_blank', 'noopener'))); z.appendChild(bb);
    });
    barra.appendChild(h('span', null, 'Según lo vendido en', 'font-size:13px;')); selector(barra, [[14, '14 días'], [30, '30 días'], [90, '90 días']], dias, (v) => { dias = v; go(); });
    barra.appendChild(h('span', null, 'quiero que me alcance', 'font-size:13px;')); selector(barra, [[7, '1 semana'], [14, '2 semanas'], [30, '1 mes']], cob, (v) => { cob = v; go(); });
    sec.appendChild(barra); sec.appendChild(z); go();
  }

  // 2) ABC y margen por categoría
  function abc(sec){
    let dias = 30; const z = h('div');
    const objetivo = Number(localStorage.getItem('puve_margen_obj')) || 0;
    const go = () => carga(z, async (c) => {
      z.textContent = ''; const d = await rpc('analisis_abc', { p_dias: dias });
      if(!d.n){ vacio(z, 'Todavía no hay ventas de productos en este periodo.'); return; }
      tarjetas(z, [[String(d.clases.A), 'Clase A (80% de lo que vendes)'], [String(d.clases.B), 'Clase B (siguiente 15%)'], [String(d.clases.C), 'Clase C (último 5%)'], [enlace.dinero(d.total), 'Vendido en el periodo']]);
      const t = tabla(['Clase', 'Producto', 'Unidades', 'Vendido', 'Margen']); z.appendChild(t.wrap);
      d.items.forEach((x) => { const tr = h('tr'); celda(tr, x.clase, 'font-weight:700; color:' + ({ A: '#16a34a', B: '#d97706', C: '#71717a' })[x.clase] + ';'); celda(tr, x.nombre, 'font-weight:600;'); celda(tr, fmt(x.unidades)); celda(tr, enlace.dinero(x.ingresos)); celda(tr, enlace.dinero(x.margen)); t.tb.appendChild(tr); });
      z.appendChild(h('p', 'nota', 'Se muestran los 60 que más venden. A = pocos productos que sostienen tu venta: que nunca falten. C = muchos que casi no mueven.', 'margin:6px 0 16px;'));
      z.appendChild(h('h3', null, 'Margen por categoría', 'font-size:14px; margin:0 0 6px;'));
      const fila = h('div', null, null, 'display:flex; gap:8px; align-items:center; margin-bottom:8px; font-size:13px;');
      fila.appendChild(h('span', null, 'Mi margen objetivo (%):')); const inp = h('input', 'input-mini', null, 'width:80px;'); inp.type = 'number'; inp.min = '0'; inp.max = '99'; inp.value = objetivo || '';
      inp.onchange = () => { try { localStorage.setItem('puve_margen_obj', String(Number(inp.value) || 0)); } catch(e){} go(); }; fila.appendChild(inp); fila.appendChild(h('span', null, '(se guarda solo en este dispositivo)', 'color:var(--texto-suave);')); z.appendChild(fila);
      const obj = Number(inp.value) || 0, t2 = tabla(['Categoría', 'Vendido', 'Margen', 'Margen %']); z.appendChild(t2.wrap);
      d.por_categoria.forEach((x) => { const bajo = obj > 0 && x.margen_pct != null && x.margen_pct < obj, tr = h('tr'); celda(tr, x.categoria, 'font-weight:600;'); celda(tr, enlace.dinero(x.ingresos)); celda(tr, enlace.dinero(x.margen)); celda(tr, x.margen_pct == null ? '—' : fmt(x.margen_pct, 1) + '%' + (bajo ? ' ↓ bajo tu objetivo' : ''), bajo ? 'color:#dc2626; font-weight:600;' : ''); t2.tb.appendChild(tr); });
      z.appendChild(h('p', 'nota', 'El margen usa el costo que capturaste en cada producto. Un producto sin costo cuenta como 100% de margen.', 'margin-top:6px;'));
    });
    selector(sec, [[7, 'Últimos 7 días'], [30, 'Últimos 30 días'], [90, 'Últimos 90 días']], dias, (v) => { dias = v; go(); }); sec.appendChild(z); go();
  }

  // 3) Lento movimiento
  function lentos(sec){
    let dias = 60; const z = h('div');
    const go = () => carga(z, async (c) => {
      z.textContent = ''; const d = await rpc('productos_lentos', { p_dias: dias });
      if(!d.n){ vacio(z, 'Todo lo que tienes en existencia se vendió al menos una vez en los últimos ' + dias + ' días.'); return; }
      tarjetas(z, [[String(d.n), 'Productos sin venta'], [enlace.dinero(d.capital), 'Dinero detenido en ellos (existencia × costo)']]);
      const t = tabla(['Producto', 'Existencia', 'Detenido', 'Última venta']); z.appendChild(t.wrap);
      d.items.forEach((x) => { const tr = h('tr'); celda(tr, x.nombre + (x.categoria ? ' · ' + x.categoria : ''), 'font-weight:600;'); celda(tr, fmt(x.stock)); celda(tr, enlace.dinero(x.capital)); celda(tr, x.ultima_venta || 'Nunca'); t.tb.appendChild(tr); });
      z.appendChild(h('p', 'nota', 'Se muestran los 100 con más dinero detenido. Ideas: ponlos en promoción, agrúpalos con un producto estrella o deja de comprarlos.', 'margin-top:6px;'));
    });
    sec.appendChild(h('span', null, 'Sin venta en los últimos ', 'font-size:13px;')); selector(sec, [[30, '30 días'], [60, '60 días'], [90, '90 días'], [180, '180 días']], dias, (v) => { dias = v; go(); }); sec.appendChild(z); go();
  }

  // 4) Clientes que no regresan
  function inactivos(sec){
    let dias = 45; const z = h('div');
    const go = () => carga(z, async (c) => {
      z.textContent = ''; const d = await rpc('clientes_inactivos', { p_dias: dias });
      if(!d.length){ vacio(z, 'No hay clientes identificados que lleven más de ' + dias + ' días sin venir (solo cuentan los que ya compraron 2 veces o más con su teléfono en la caja).'); return; }
      const t = tabla(['Cliente', 'Visitas', 'Ha gastado', 'Última vez', '']); z.appendChild(t.wrap);
      d.forEach((x) => {
        const tr = h('tr'); celda(tr, x.nombre || x.telefono, 'font-weight:600;'); celda(tr, String(x.visitas)); celda(tr, enlace.dinero(x.total)); celda(tr, 'hace ' + x.dias + ' días');
        const td = h('td'); const dig = String(x.telefono || '').replace(/\D/g, '');
        if(dig.length >= 10){ td.appendChild(boton('WhatsApp', () => { const n = dig.length === 10 ? '52' + dig : dig; window.open('https://wa.me/' + n + '?text=' + encodeURIComponent('Hola' + (x.nombre ? ' ' + x.nombre : '') + ', hace tiempo que no te vemos y nos encantaría verte de nuevo. ¡Te esperamos!'), '_blank', 'noopener'); })); }
        tr.appendChild(td); t.tb.appendChild(tr);
      });
      z.appendChild(h('p', 'nota', 'Tú mandas cada mensaje a mano. Solo escribe a quien te dio su teléfono para su tarjeta o sus puntos.', 'margin-top:6px;'));
    });
    sec.appendChild(h('span', null, 'Más de ', 'font-size:13px;')); selector(sec, [[30, '30 días'], [45, '45 días'], [60, '60 días'], [90, '90 días']], dias, (v) => { dias = v; go(); }); sec.appendChild(h('span', null, ' sin venir', 'font-size:13px; margin-left:6px;')); sec.appendChild(z); go();
  }

  // 5) Mapa de horas
  function horas(sec){
    carga(sec, async (z) => {
      const d = await rpc('ventas_por_hora', { p_dias: 28 });
      if(!d.length){ vacio(z, 'Todavía no hay ventas en los últimos 28 días.'); return; }
      const mapa = {}; let max = 1; d.forEach((x) => { mapa[x.dow + '-' + x.h] = x; if(x.tickets > max) max = x.tickets; });
      const hs = d.map((x) => x.h), h0 = Math.min.apply(null, hs), h1 = Math.max.apply(null, hs);
      const w = h('div', 'envoltura-tabla'), t = h('table', null, null, 'border-collapse:separate; border-spacing:2px;'), tr0 = h('tr'); tr0.appendChild(h('th')); for(let k = h0; k <= h1; k++) tr0.appendChild(h('th', null, String(k), 'font-size:11px; font-weight:500; text-align:center;')); t.appendChild(tr0);
      for(let dow = 0; dow < 7; dow++){ const tr = h('tr'); tr.appendChild(h('td', null, DIAS[dow], 'font-size:12px; font-weight:600;')); for(let k = h0; k <= h1; k++){ const f = mapa[dow + '-' + k], c = h('td', null, f ? String(f.tickets) : '', 'min-width:26px; height:26px; text-align:center; font-size:11px; border-radius:4px; background:' + (f ? 'rgba(37,99,235,' + (0.12 + 0.88 * f.tickets / max).toFixed(2) + ')' : 'var(--neutral-bg,#f4f4f5)') + ';' + (f && f.tickets / max > 0.55 ? 'color:#fff;' : '')); if(f) c.title = DIAS[dow] + ' ' + k + ' h: ' + f.tickets + ' tickets, ' + enlace.dinero(f.total); tr.appendChild(c); } t.appendChild(tr); }
      w.appendChild(t); z.appendChild(w); z.appendChild(h('p', 'nota', 'Tickets por día y hora en las últimas 4 semanas (hora de México). Lo oscuro es tu hora fuerte: ahí no debe faltar gente ni producto.', 'margin-top:6px;'));
    });
  }

  function pintar(cont){
    cont.textContent = '';
    reponer(bloque(cont, 'Qué reponer', 'Compara lo que tienes con lo que vendes al día y te dice cuánto comprar. Solo ve productos con ventas recientes.'));
    abc(bloque(cont, 'Productos estrella y margen (ABC)', 'Qué pocos productos sostienen tu venta y qué categorías te dejan más margen.'));
    lentos(bloque(cont, 'Lento movimiento', 'Productos con existencia que no se han vendido: dinero parado en tu estante.'));
    inactivos(bloque(cont, 'Clientes que no regresan', 'Tus clientes frecuentes que llevan tiempo sin venir.'));
    horas(bloque(cont, 'Mapa de horas', 'A qué hora y qué día se vende más.'));
  }
  window.PuveDecisiones = {
    enlazar(o){ enlace = Object.assign(enlace, o || {}); },
    abrir(){ const c = document.getElementById('vistaAnaliticaInteligencia'); if(c) return pintar(c); }
  };
})();
