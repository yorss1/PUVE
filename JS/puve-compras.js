/* PUVE - Compras (Inventario → Compras) y resumen de mermas por causa (Inventario → Mermas y ajustes).
 * Datos por funciones del servidor del SQL 121: pedidos_recurrentes_*, proveedores_comparar, proveedor_historial_costo, mermas_resumen.
 * El pedido recurrente NO se genera solo: la pantalla avisa cuáles tocan hoy y se genera con un botón (queda como orden PENDIENTE; no mueve inventario).
 * El comparador usa solo órdenes de compra RECIBIDAS con costo capturado, y solo muestra productos comprados a 2 o más proveedores.
 */
(function(){
  'use strict';
  let enlace = { sb: null, dinero: (n) => '$' + Number(n).toFixed(2), recargarOrdenes: null };
  const DIAS = [[1, 'Lun'], [2, 'Mar'], [3, 'Mié'], [4, 'Jue'], [5, 'Vie'], [6, 'Sáb'], [7, 'Dom']];
  const CAUSAS = { caducado: 'Caducado', maduracion: 'Maduración', danado: 'Dañado o roto', derrame: 'Derrame', corte: 'Corte o limpieza', empaque: 'Empaque', robo: 'Faltante o robo', otro: 'Otra causa', sin_causa: 'Sin causa anotada' };
  function h(tag, cls, txt, estilo){ const e = document.createElement(tag); if(cls) e.className = cls; if(txt != null) e.textContent = txt; if(estilo) e.style.cssText = estilo; return e; }
  function boton(txt, fn, cls, estilo){ const b = h('button', cls || 'texto', txt, 'width:auto; padding:7px 12px;' + (estilo || '')); b.type = 'button'; b.onclick = fn; return b; }
  function campo(et, el, ancho){ const w = h('label', null, et, 'display:flex; flex-direction:column; gap:4px; font-size:13px; font-weight:500;' + (ancho ? 'flex:1 1 ' + ancho + 'px;' : '')); w.appendChild(el); return w; }
  const input = (v, ph, max, tipo) => { const i = h('input', 'input-mini'); if(tipo) i.type = tipo; if(v != null && v !== '') i.value = v; if(ph) i.placeholder = ph; if(max) i.maxLength = max; return i; };
  const sel = (ops) => { const s = h('select', 'input-mini'); ops.forEach(([v, t]) => { const o = h('option', null, t); o.value = v; s.appendChild(o); }); return s; };
  const fmt = (n) => Number(n).toLocaleString('es-MX', { maximumFractionDigits: 2 });
  const din = (n) => enlace.dinero(Number(n) || 0);
  const fecha = (iso) => new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  const msg = (z, t, ok) => { z.textContent = t; z.style.cssText = 'font-size:13px; margin:8px 0; color:' + (ok ? '#16a34a' : 'var(--error,#b91c1c)') + ';'; };
  function errTxt(e){ const m = (e && e.message) || String(e); return /does not exist|schema cache|Could not find/i.test(m) ? 'Falta ejecutar el script SQL 121 en Supabase.' : m; }
  async function rpc(f, a){ const r = await enlace.sb.rpc(f, a); if(r.error) throw r.error; return r.data; }
  function tabla(cols, filas){ const w = h('div', 'envoltura-tabla'), t = h('table'), th = h('thead'), tr0 = h('tr'); cols.forEach((c) => tr0.appendChild(h('th', null, c))); th.appendChild(tr0); t.appendChild(th); const tb = h('tbody'); filas.forEach((f) => { const tr = h('tr'); f.forEach((c, i) => { const td = h('td'); if(c instanceof Node) td.appendChild(c); else { td.textContent = c; if(i === 0) td.style.fontWeight = '600'; } tr.appendChild(td); }); tb.appendChild(tr); }); t.appendChild(tb); w.appendChild(t); return w; }

  // ---------- Resumen de mermas por causa ----------
  let rMermas = null;
  async function abrirMermas(){
    rMermas = rMermas || document.getElementById('bloqueMermasResumen'); if(!rMermas) return;
    pintarMermas(30);
  }
  async function pintarMermas(dias){
    rMermas.textContent = '';
    const cab = h('div', null, null, 'display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-bottom:8px;'); cab.appendChild(h('h3', null, 'Dónde se pierde el dinero', 'margin:0;'));
    const p = sel([['7', 'Últimos 7 días'], ['30', 'Últimos 30 días'], ['90', 'Últimos 90 días']]); p.value = String(dias); p.onchange = () => pintarMermas(Number(p.value)); cab.appendChild(p); rMermas.appendChild(cab);
    const z = h('div'); rMermas.appendChild(z);
    try {
      const r = await rpc('mermas_resumen', { p_dias: dias });
      if(!r.eventos){ z.appendChild(h('p', 'nota', 'No hay mermas registradas en este periodo. Cuando registres una, elige su causa para ver aquí en qué se te va.')); return; }
      z.appendChild(h('p', null, 'Perdiste ' + din(r.total_valor) + ' en ' + r.eventos + ' mermas (valor al costo).', 'font-weight:700; margin:0 0 8px;'));
      z.appendChild(tabla(['Causa', 'Veces', 'Valor'], r.por_causa.map((c) => [CAUSAS[c.causa] || c.causa, String(c.eventos), din(c.valor)])));
      z.appendChild(h('h4', null, 'Productos con más pérdida', 'margin:14px 0 6px;'));
      z.appendChild(tabla(['Producto', 'Cantidad', 'Valor'], r.por_producto.map((c) => [c.producto, fmt(c.piezas), din(c.valor)])));
      if(r.por_semana.length > 1){ z.appendChild(h('h4', null, 'Por semana', 'margin:14px 0 6px;')); z.appendChild(tabla(['Semana del', 'Veces', 'Valor'], r.por_semana.map((c) => [fecha(c.semana + 'T12:00:00'), String(c.eventos), din(c.valor)]))); }
      z.appendChild(h('p', 'nota', 'Las mermas anteriores a esta función aparecen como «Sin causa anotada» y se valoran con el costo actual del producto.', 'margin-top:8px;'));
    } catch(e){ msg(z, 'No se pudo cargar: ' + errTxt(e)); }
  }

  // ---------- Compras: pedidos recurrentes + comparador ----------
  let raiz = null;
  function abrir(){ raiz = raiz || document.getElementById('vistaInventarioCompras'); if(raiz) pintar(); }
  async function pintar(editar){
    raiz.textContent = '';
    raiz.appendChild(h('h3', null, 'Pedidos recurrentes al proveedor', 'margin:0 0 4px;'));
    raiz.appendChild(h('p', 'nota', 'Guarda tu pedido de siempre y los días en que lo haces. PUVE avisa cuáles tocan hoy y, con un toque, arma la orden de compra (queda pendiente: tú la mandas y la recibes). No se genera sola.', 'margin:0 0 10px;'));
    const zl = h('div'); raiz.appendChild(zl); const zf = h('div'); raiz.appendChild(zf);
    raiz.appendChild(h('h3', null, 'Comparador de proveedores', 'margin:22px 0 4px;'));
    const zc = h('div'); raiz.appendChild(zc);
    let provs = [];
    try { const r = await enlace.sb.from('proveedores').select('id,nombre').eq('activo', true).order('nombre'); if(r.error) throw r.error; provs = r.data || []; } catch(e){ msg(zl, errTxt(e)); }
    await lista(zl, zf, provs); formulario(zf, provs, editar); await comparador(zc, 180);
  }
  async function lista(z, zf, provs){
    z.textContent = '';
    try {
      const l = await rpc('pedidos_recurrentes_lista');
      if(!l.length){ z.appendChild(h('p', 'nota', 'Todavía no tienes pedidos recurrentes.')); return; }
      l.forEach((p) => {
        const c = h('div', null, null, 'border:1px solid var(--borde); border-radius:10px; padding:10px 12px; margin-bottom:10px;');
        const t = h('div', null, null, 'display:flex; gap:8px; align-items:center; flex-wrap:wrap;'); t.appendChild(h('strong', null, p.nombre)); if(p.proveedor) t.appendChild(h('span', 'nota', '· ' + p.proveedor));
        if(p.toca_hoy && !p.generado_hoy) t.appendChild(h('span', null, 'Toca hoy', 'background:#fef3c7; color:#92400e; border-radius:6px; padding:2px 8px; font-size:12px; font-weight:700;'));
        if(p.generado_hoy) t.appendChild(h('span', null, 'Orden generada hoy ✓', 'background:#dcfce7; color:#166534; border-radius:6px; padding:2px 8px; font-size:12px; font-weight:700;'));
        c.appendChild(t);
        c.appendChild(h('div', 'nota', 'Días: ' + (p.dias.map((d) => (DIAS.find((x) => x[0] === d) || [0, '?'])[1]).join(', ') || 'ninguno') + (p.ultima_orden ? ' · última orden: ' + fecha(p.ultima_orden + 'T12:00:00') : ''), 'margin-top:4px;'));
        c.appendChild(h('div', null, p.items.map((i) => fmt(i.cantidad) + ' × ' + i.producto).join(' · ') || 'Sin productos válidos', 'font-size:14px; margin-top:6px;'));
        const ac = h('div', null, null, 'display:flex; gap:8px; margin-top:8px; flex-wrap:wrap;'); const est = h('div');
        const bg = boton('Generar orden de compra', async () => { bg.disabled = true; try { await rpc('pedido_recurrente_generar', { p_id: p.id }); if(enlace.recargarOrdenes) enlace.recargarOrdenes(); await lista(z, zf, provs); const s = h('div'); z.insertBefore(s, z.firstChild); msg(s, 'Orden creada. Revísala en «Órdenes de compra».', true); } catch(e){ bg.disabled = false; msg(est, errTxt(e)); } }, 'principal'); if(p.generado_hoy) bg.disabled = true; ac.appendChild(bg);
        ac.appendChild(boton('Editar', () => { formulario(zf, provs, p); zf.scrollIntoView({ behavior: 'smooth' }); }));
        ac.appendChild(boton('Archivar', async () => { if(!window.confirm('¿Archivar «' + p.nombre + '»?')) return; try { await rpc('pedido_recurrente_archivar', { p_id: p.id }); await lista(z, zf, provs); } catch(e){ msg(est, errTxt(e)); } }));
        c.appendChild(ac); c.appendChild(est); z.appendChild(c);
      });
    } catch(e){ msg(z, 'No se pudo cargar: ' + errTxt(e)); }
  }
  function formulario(z, provs, ed){
    z.textContent = ''; const b = h('div', 'bloque-analitica', null, 'margin:8px 0 16px;'); b.appendChild(h('h3', null, ed ? 'Editar pedido recurrente' : 'Nuevo pedido recurrente'));
    const nom = input(ed ? ed.nombre : '', 'Ej. Pedido semanal de lácteos', 60), pv = sel([['', 'Sin proveedor'], ...provs.map((p) => [p.id, p.nombre])]); if(ed && ed.proveedor_id) pv.value = ed.proveedor_id;
    const fila = h('div', null, null, 'display:flex; gap:10px; flex-wrap:wrap;'); fila.appendChild(campo('Nombre', nom, 220)); fila.appendChild(campo('Proveedor', pv, 200)); b.appendChild(fila);
    const dd = h('div', null, null, 'display:flex; gap:6px; flex-wrap:wrap; margin:10px 0;'); const cks = DIAS.map(([n, t]) => { const l = h('label', null, null, 'display:flex; gap:4px; align-items:center; font-size:13px;'); const k = h('input'); k.type = 'checkbox'; k.value = n; k.style.cssText = 'width:16px; height:16px; margin:0;'; if(ed && ed.dias.includes(n)) k.checked = true; l.appendChild(k); l.appendChild(document.createTextNode(t)); dd.appendChild(l); return k; });
    b.appendChild(h('div', 'nota', 'Días en que haces este pedido:')); b.appendChild(dd);
    const items = ed ? ed.items.map((i) => ({ producto_id: i.producto_id, producto: i.producto, cantidad: i.cantidad })) : [];
    const q = input('', 'Busca un producto para agregar…', 40), res = h('div', null, null, 'display:flex; gap:6px; flex-wrap:wrap; margin:8px 0;'), ren = h('div'), est = h('div'); let tm = 0;
    const pintaItems = () => { ren.textContent = ''; items.forEach((it, i) => { const f = h('div', null, null, 'display:flex; gap:8px; align-items:center; padding:4px 0; border-top:1px solid var(--borde);'); f.appendChild(h('span', null, it.producto, 'flex:1;')); const c = input(it.cantidad, '', 8, 'number'); c.min = '0'; c.step = 'any'; c.style.width = '90px'; c.oninput = () => { it.cantidad = Number(c.value); }; f.appendChild(c); f.appendChild(boton('Quitar', () => { items.splice(i, 1); pintaItems(); })); ren.appendChild(f); }); };
    q.oninput = () => { clearTimeout(tm); tm = setTimeout(async () => { res.textContent = ''; const t = q.value.replace(/[%_,()\\]/g, ' ').trim(); if(t.length < 2) return; const r = await enlace.sb.from('productos').select('id,nombre').eq('activo', true).eq('es_combo', false).neq('tipo', 'servicio').ilike('nombre', '%' + t + '%').order('nombre').limit(8); if(r.error){ msg(est, errTxt(r.error)); return; }
      if(!r.data.length) res.appendChild(h('span', 'nota', 'No encontré productos.')); r.data.forEach((p) => res.appendChild(boton(p.nombre, () => { if(!items.some((x) => x.producto_id === p.id)) items.push({ producto_id: p.id, producto: p.nombre, cantidad: 1 }); res.textContent = ''; q.value = ''; pintaItems(); }))); }, 250); };
    pintaItems(); [q, res, ren].forEach((x) => b.appendChild(x));
    const ac = h('div', null, null, 'display:flex; gap:8px; margin-top:10px;');
    const gd = boton(ed ? 'Guardar cambios' : 'Guardar pedido', async () => { const dias = cks.filter((k) => k.checked).map((k) => Number(k.value)); if(!nom.value.trim()) return msg(est, 'Escribe un nombre.'); if(!items.length) return msg(est, 'Agrega al menos un producto.'); if(items.some((i) => !(Number(i.cantidad) > 0))) return msg(est, 'Cada cantidad debe ser mayor a 0.');
      gd.disabled = true; try { await rpc('pedido_recurrente_guardar', { p_id: ed ? ed.id : null, p_nombre: nom.value.trim(), p_proveedor: pv.value || null, p_dias: dias, p_items: items.map((i) => ({ producto_id: i.producto_id, cantidad: Number(i.cantidad) })) }); pintar(); } catch(e){ gd.disabled = false; msg(est, errTxt(e)); } }, 'principal');
    ac.appendChild(gd); if(ed) ac.appendChild(boton('Cancelar', () => pintar())); b.appendChild(ac); b.appendChild(est); z.appendChild(b);
  }
  async function comparador(z, dias){
    z.textContent = ''; const p = sel([['90', 'Últimos 90 días'], ['180', 'Últimos 180 días'], ['365', 'Último año']]); p.value = String(dias); p.onchange = () => comparador(z, Number(p.value)); z.appendChild(p);
    z.appendChild(h('p', 'nota', 'Compara lo que pagaste por el mismo producto a distintos proveedores, con tus órdenes de compra recibidas y con costo capturado. Solo salen productos comprados a 2 o más proveedores.', 'margin:6px 0 10px;'));
    const zz = h('div'); z.appendChild(zz); const zh = h('div'); z.appendChild(zh);
    try {
      const l = await rpc('proveedores_comparar', { p_dias: dias });
      if(!l.length){ zz.appendChild(h('p', 'nota', 'Aún no hay productos comprados a dos proveedores distintos en este periodo.')); return; }
      l.forEach((g) => { const c = h('div', null, null, 'border:1px solid var(--borde); border-radius:10px; padding:10px 12px; margin-bottom:10px;'); const t = h('div', null, null, 'display:flex; gap:8px; align-items:center; justify-content:space-between; flex-wrap:wrap;'); t.appendChild(h('strong', null, g.producto)); t.appendChild(boton('Ver historial de costo', () => historial(zh, g))); c.appendChild(t);
        const base = Number(g.proveedores[0].ultimo);
        c.appendChild(tabla(['Proveedor', 'Último costo', 'Promedio', 'Mínimo', 'Compras', 'Frente al más barato'], g.proveedores.map((x, i) => [x.proveedor, din(x.ultimo), din(x.promedio), din(x.minimo), String(x.compras), i === 0 ? 'Más barato ✓' : '+' + Math.round((Number(x.ultimo) / base - 1) * 100) + '%'])));
        zz.appendChild(c); });
    } catch(e){ msg(zz, 'No se pudo cargar: ' + errTxt(e)); }
  }
  async function historial(z, g){
    z.textContent = '';
    try { const l = await rpc('proveedor_historial_costo', { p_producto: g.producto_id, p_limite: 40 }); const c = h('div', 'bloque-analitica', null, 'margin:8px 0 16px;'); c.appendChild(h('h3', null, 'Historial de costo · ' + g.producto));
      c.appendChild(l.length ? tabla(['Fecha', 'Proveedor', 'Cantidad', 'Costo'], l.map((x) => [fecha(x.fecha), x.proveedor, fmt(x.cantidad), din(x.costo)])) : h('p', 'nota', 'Sin compras recibidas con costo.')); c.appendChild(boton('Cerrar', () => { z.textContent = ''; })); z.appendChild(c); z.scrollIntoView({ behavior: 'smooth' });
    } catch(e){ msg(z, 'No se pudo cargar: ' + errTxt(e)); }
  }
  window.PuveCompras = { enlazar(o){ enlace = Object.assign(enlace, o || {}); }, abrir, abrirMermas };
})();
