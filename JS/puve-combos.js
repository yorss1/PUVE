/* PUVE - Combos y paquetes (Inventario → Combos): un producto con precio fijo formado por otros productos.
 * Se vende en la caja como cualquier producto; al venderlo el servidor descuenta el inventario de cada componente.
 * Los datos entran y salen por funciones (combo_guardar, combo_desactivar, combos_lista). "2x1" = el mismo producto ×2 al precio de 1.
 */
(function(){
  'use strict';
  let enlace = { sb: null, giro: () => null, dinero: (n) => '$' + Number(n).toFixed(2) };
  const EJ = { taquerias: 'Combo 3 tacos + refresco', pizzerias: 'Pizza grande + bebida', abarrotes: 'Despensa básica', dulcerias: 'Bolsita surtida', fruterias: 'Caja surtida', pollerias: 'Paquete familiar', papelerias: 'Paquete escolar', suplementos: 'Combo proteína + shaker', heladerias: 'Paquete de cumpleaños', regalos: 'Caja de regalo', panaderia: 'Paquete de 6 piezas', restaurantes: 'Combo del día', cafeterias: 'Café + pan' };
  function h(tag, cls, txt, estilo){ const e = document.createElement(tag); if(cls) e.className = cls; if(txt != null) e.textContent = txt; if(estilo) e.style.cssText = estilo; return e; }
  function boton(txt, fn, cls, estilo){ const b = h('button', cls || 'texto', txt, 'width:auto; padding:7px 12px;' + (estilo || '')); b.type = 'button'; b.onclick = fn; return b; }
  function campo(et, el, ancho){ const w = h('label', null, et, 'display:flex; flex-direction:column; gap:4px; font-size:13px; font-weight:500;' + (ancho ? 'flex:1 1 ' + ancho + 'px;' : '')); w.appendChild(el); return w; }
  const input = (v, ph, max, tipo) => { const i = h('input', 'input-mini'); if(tipo) i.type = tipo; if(v != null && v !== '') i.value = v; if(ph) i.placeholder = ph; if(max) i.maxLength = max; return i; };
  const fmt = (n) => Number(n).toLocaleString('es-MX', { maximumFractionDigits: 3 });
  const msg = (z, t, ok) => { z.textContent = t; z.style.cssText = 'font-size:13px; margin:8px 0; color:' + (ok ? '#16a34a' : 'var(--error,#b91c1c)') + ';'; };
  function errTxt(e){ const m = (e && e.message) || String(e); return /does not exist|schema cache|Could not find|es_combo/i.test(m) ? 'Falta ejecutar el script SQL 117 en Supabase.' : m; }
  async function rpc(f, a){ const r = await enlace.sb.rpc(f, a); if(r.error) throw r.error; return r.data; }
  let raiz = null;
  function abrir(){ raiz = raiz || document.getElementById('vistaInventarioCombos'); if(raiz) lista(); }
  async function lista(){
    raiz.textContent = ''; const cab = h('div', null, null, 'display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-bottom:6px;'); cab.appendChild(h('h3', null, 'Combos y paquetes', 'margin:0; flex:1 1 auto;')); cab.appendChild(boton('+ Nuevo combo', () => editar(null), 'principal', 'padding:9px 14px;')); raiz.appendChild(cab);
    raiz.appendChild(h('p', 'nota', 'Un combo es un producto con precio fijo formado por otros. Aparece en la caja y se vende normal; al venderlo se descuenta el inventario de cada componente. Para un 2x1, haz un combo del mismo producto con cantidad 2 y ponle el precio de 1.', 'margin:0 0 12px;'));
    const z = h('div'); raiz.appendChild(z);
    try {
      const d = await rpc('combos_lista'); if(!d.length){ z.appendChild(h('p', 'nota', 'Todavía no tienes combos. Crea el primero con el botón de arriba.')); return; }
      d.forEach((c) => { const t = h('div', null, null, 'border:1px solid var(--borde); border-radius:10px; padding:12px; margin-bottom:10px;'), top = h('div', null, null, 'display:flex; justify-content:space-between; gap:8px; flex-wrap:wrap;');
        top.appendChild(h('strong', null, c.nombre)); top.appendChild(h('strong', null, enlace.dinero(c.precio))); t.appendChild(top);
        t.appendChild(h('div', 'nota', c.lineas.map((l) => fmt(l.cantidad) + ' × ' + l.nombre).join(' + ')));
        const ahorro = Number(c.costo_actual) > 0 ? Math.round((Number(c.precio) - Number(c.costo_actual)) / Number(c.precio) * 100) : null;
        t.appendChild(h('div', 'nota', (c.alcanza != null ? 'Alcanza para ' + fmt(c.alcanza) + (Number(c.alcanza) === 1 ? ' combo' : ' combos') : 'Sin límite de existencia') + (ahorro != null ? ' · margen ' + ahorro + '% sobre costo ' + enlace.dinero(c.costo_actual) : '') + (Number(c.costo_actual) !== Number(c.costo) ? ' · el costo guardado era ' + enlace.dinero(c.costo) + ' (guarda el combo para actualizarlo)' : '')));
        const ac = h('div', null, null, 'display:flex; gap:6px; margin-top:8px;'); ac.appendChild(boton('Editar', () => editar(c))); ac.appendChild(boton('Quitar', async () => { if(!window.confirm('¿Quitar «' + c.nombre + '»? Deja de aparecer en la caja.')) return; try { await rpc('combo_desactivar', { p_id: c.id }); lista(); } catch(e){ msg(z, errTxt(e)); } })); t.appendChild(ac); z.appendChild(t); });
    } catch(e){ msg(z, 'No se pudo cargar: ' + errTxt(e)); }
  }
  async function editar(c){
    raiz.textContent = ''; raiz.appendChild(boton('← Volver', lista)); raiz.appendChild(h('h3', null, c ? 'Editar combo' : 'Nuevo combo', 'margin:10px 0;'));
    const nom = input(c && c.nombre, EJ[enlace.giro()] || 'Nombre del combo', 80), pre = input(c && c.precio, '', 10, 'number'); pre.min = '0'; pre.step = 'any'; const cat = h('select', 'input-mini'); const o0 = h('option', null, 'Sin categoría'); o0.value = ''; cat.appendChild(o0);
    try { const r = await enlace.sb.from('categorias').select('id,nombre').order('nombre'); (r.data || []).forEach((k) => { const o = h('option', null, k.nombre); o.value = k.id; cat.appendChild(o); }); if(c && c.categoria_id) cat.value = c.categoria_id; } catch(e){}
    const fr = h('div', null, null, 'display:flex; gap:10px; flex-wrap:wrap; margin-bottom:10px;'); [campo('Nombre', nom, 240), campo('Precio del combo $', pre, 140), campo('Categoría', cat, 180)].forEach((x) => fr.appendChild(x)); raiz.appendChild(fr);
    const lineas = (c ? c.lineas : []).map((l) => ({ id: l.producto_id, nombre: l.nombre, cantidad: Number(l.cantidad) })); raiz.appendChild(h('strong', null, 'Qué lleva', 'font-size:14px;'));
    const q = input('', 'Busca un producto para agregarlo…', 40), res = h('div', null, null, 'display:flex; gap:6px; flex-wrap:wrap; margin:8px 0;'), zl = h('div'); let tm = 0; raiz.appendChild(q); raiz.appendChild(res); raiz.appendChild(zl);
    q.oninput = () => { clearTimeout(tm); tm = setTimeout(async () => { res.textContent = ''; const t = q.value.replace(/[%_,()\\]/g, ' ').trim(); if(t.length < 2) return;
      const r = await enlace.sb.from('productos').select('id,nombre,precio,es_combo').eq('activo', true).eq('es_combo', false).ilike('nombre', '%' + t + '%').order('nombre').limit(8); if(r.error){ msg(est, errTxt(r.error)); return; }
      if(!r.data.length) res.appendChild(h('span', 'nota', 'No encontré productos.')); r.data.forEach((p) => res.appendChild(boton(p.nombre + ' · ' + enlace.dinero(p.precio), () => { if(!lineas.some((l) => l.id === p.id)) lineas.push({ id: p.id, nombre: p.nombre, cantidad: 1 }); res.textContent = ''; q.value = ''; pintarL(); }))); }, 250); };
    function pintarL(){ zl.textContent = ''; if(!lineas.length) zl.appendChild(h('p', 'nota', 'Agrega al menos un producto.'));
      lineas.forEach((l, i) => { const f = h('div', null, null, 'display:flex; gap:8px; align-items:center; padding:6px 0; border-top:1px solid var(--borde);'); f.appendChild(h('div', null, l.nombre, 'flex:1; font-size:14px;'));
        const n = input(l.cantidad, '', 8, 'number'); n.min = '0'; n.step = 'any'; n.style.width = '90px'; n.setAttribute('aria-label', 'Cantidad de ' + l.nombre); n.onchange = () => { l.cantidad = Number(n.value) || 1; }; f.appendChild(n); f.appendChild(boton('Quitar', () => { lineas.splice(i, 1); pintarL(); })); zl.appendChild(f); }); }
    pintarL(); const est = h('div'), gb = boton('Guardar combo', async () => {
      gb.disabled = true; msg(est, 'Guardando…', true);
      try { await rpc('combo_guardar', { p_id: c ? c.id : null, p_nombre: nom.value.trim(), p_precio: Number(pre.value), p_categoria_id: cat.value || null, p_lineas: lineas.map((l) => ({ producto_id: l.id, cantidad: l.cantidad })) }); lista(); }
      catch(e){ gb.disabled = false; msg(est, errTxt(e)); }
    }, 'principal', 'padding:9px 14px; margin-top:10px;'); raiz.appendChild(gb); raiz.appendChild(est);
  }
  window.PuveCombos = { enlazar(o){ enlace = Object.assign(enlace, o || {}); }, abrir };
})();
