/* PUVE - Producción por tandas (Inventario → Producción): lo que se hornea, tortillea o rostiza, con turno, inventario y sugerencia del día.
 * Datos por funciones del servidor (produccion_registrar, produccion_hoy, produccion_sugerencia). La sugerencia usa las ventas del mismo día de la semana.
 * "Pan caliente / sale caliente" es un mensaje listo para mandar tú (WhatsApp o copiar); PUVE no avisa solo a tus clientes.
 */
(function(){
  'use strict';
  let enlace = { sb: null, giro: () => null };
  const TURNOS = { manana: 'Mañana', tarde: 'Tarde', noche: 'Noche' };
  function h(tag, cls, txt, estilo){ const e = document.createElement(tag); if(cls) e.className = cls; if(txt != null) e.textContent = txt; if(estilo) e.style.cssText = estilo; return e; }
  function boton(txt, fn, cls, estilo){ const b = h('button', cls || 'texto', txt, 'width:auto; padding:7px 12px;' + (estilo || '')); b.type = 'button'; b.onclick = fn; return b; }
  function campo(et, el, ancho){ const w = h('label', null, et, 'display:flex; flex-direction:column; gap:4px; font-size:13px; font-weight:500;' + (ancho ? 'flex:1 1 ' + ancho + 'px;' : '')); w.appendChild(el); return w; }
  const input = (v, ph, max, tipo) => { const i = h('input', 'input-mini'); if(tipo) i.type = tipo; if(v != null && v !== '') i.value = v; if(ph) i.placeholder = ph; if(max) i.maxLength = max; return i; };
  const sel = (ops) => { const s = h('select', 'input-mini'); ops.forEach(([v, t]) => { const o = h('option', null, t); o.value = v; s.appendChild(o); }); return s; };
  const fmt = (n) => Number(n).toLocaleString('es-MX', { maximumFractionDigits: 2 });
  const msg = (z, t, ok) => { z.textContent = t; z.style.cssText = 'font-size:13px; margin:8px 0; color:' + (ok ? '#16a34a' : 'var(--error,#b91c1c)') + ';'; };
  function errTxt(e){ const m = (e && e.message) || String(e); return /does not exist|schema cache|Could not find|es_combo/i.test(m) ? 'Falta ejecutar el script SQL 120 en Supabase.' : m; }
  async function rpc(f, a){ const r = await enlace.sb.rpc(f, a); if(r.error) throw r.error; return r.data; }
  const hace = (iso) => { const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000)); return m < 1 ? 'hace un momento' : m < 60 ? 'hace ' + m + ' min' : 'hace ' + Math.floor(m / 60) + ' h ' + (m % 60) + ' min'; };
  const turnoAhora = () => { const hh = new Date().getHours(); return hh < 12 ? 'manana' : hh < 19 ? 'tarde' : 'noche'; };
  let raiz = null;
  function abrir(){ raiz = raiz || document.getElementById('vistaInventarioProduccion'); if(raiz) pintar(); }
  async function pintar(pre){
    raiz.textContent = ''; const cab = h('div'); cab.appendChild(h('h3', null, 'Producción de hoy', 'margin:0 0 4px;')); cab.appendChild(h('p', 'nota', 'Anota cada tanda que sale (hornada, charola, tanda de tortilla o pollo): suma al inventario y queda por turno. Abajo ves cuánto sueles vender este mismo día de la semana.', 'margin:0 0 12px;')); raiz.appendChild(cab);
    const reg = h('div', 'bloque-analitica', null, 'margin-bottom:16px;'); reg.appendChild(h('h3', null, 'Registrar una tanda')); const q = input('', 'Busca el producto…', 40), res = h('div', null, null, 'display:flex; gap:6px; flex-wrap:wrap; margin:8px 0;'), f = h('div', null, null, 'display:none; gap:10px; flex-wrap:wrap; align-items:end;'), est = h('div'); let prod = pre || null, tm = 0;
    const cant = input('', '', 8, 'number'), turno = sel(Object.keys(TURNOS).map((k) => [k, TURNOS[k]])), nota = input('', 'Nota (opcional)', 200), sum = h('input'); cant.min = '0'; cant.step = 'any'; cant.style.width = '110px'; turno.value = turnoAhora(); sum.type = 'checkbox'; sum.checked = true; sum.style.cssText = 'width:18px; height:18px; margin:0;';
    const fs = h('label', null, null, 'display:flex; gap:8px; align-items:center; font-size:13px; flex:1 1 100%;'); fs.appendChild(sum); fs.appendChild(document.createTextNode('Sumar al inventario'));
    const bg = boton('Guardar tanda', async () => { if(!prod) return msg(est, 'Elige el producto.'); if(!(Number(cant.value) > 0)) return msg(est, 'Escribe cuántas salieron.'); bg.disabled = true; try { await rpc('produccion_registrar', { p_producto: prod.id, p_cantidad: Number(cant.value), p_turno: turno.value, p_nota: nota.value.trim() || null, p_sumar_stock: sum.checked }); pintar(); } catch(e){ bg.disabled = false; msg(est, errTxt(e)); } }, 'principal');
    [campo('Cantidad', cant), campo('Turno', turno, 120), nota].forEach((x) => f.appendChild(x)); f.appendChild(fs); f.appendChild(bg); if(prod){ q.value = prod.nombre; f.style.display = 'flex'; }
    q.oninput = () => { clearTimeout(tm); tm = setTimeout(async () => { res.textContent = ''; const t = q.value.replace(/[%_,()\\]/g, ' ').trim(); if(t.length < 2) return; const r = await enlace.sb.from('productos').select('id,nombre').eq('activo', true).eq('es_combo', false).neq('tipo', 'servicio').ilike('nombre', '%' + t + '%').order('nombre').limit(8); if(r.error){ msg(est, errTxt(r.error)); return; }
      if(!r.data.length) res.appendChild(h('span', 'nota', 'No encontré productos.')); r.data.forEach((p) => res.appendChild(boton(p.nombre, () => { prod = p; res.textContent = ''; q.value = p.nombre; f.style.display = 'flex'; cant.focus(); }))); }, 250); };
    [q, res, f, est].forEach((x) => reg.appendChild(x)); raiz.appendChild(reg);
    const z = h('div'); raiz.appendChild(z);
    try { const [hoy, sug] = await Promise.all([rpc('produccion_hoy'), rpc('produccion_sugerencia', { p_semanas: 6 })]);
      const b1 = h('div', 'bloque-analitica', null, 'margin-bottom:16px;'); b1.appendChild(h('h3', null, 'Plan de hoy: lo que sueles vender este día')); z.appendChild(b1);
      if(!sug.length) b1.appendChild(h('p', 'nota', 'Todavía no hay suficientes ventas de este día de la semana para sugerir.')); else { const w = h('div', 'envoltura-tabla'), t = h('table'), th = h('thead'), tr0 = h('tr'); ['Producto', 'Vendes (promedio)', 'Mejor día', 'Prepara', 'Hecho hoy', ''].forEach((c) => tr0.appendChild(h('th', null, c))); th.appendChild(tr0); t.appendChild(th); const tb = h('tbody'); t.appendChild(tb); w.appendChild(t); b1.appendChild(w);
        sug.forEach((x) => { const tr = h('tr'); tr.appendChild(h('td', null, x.producto, 'font-weight:600;')); tr.appendChild(h('td', null, fmt(x.promedio))); tr.appendChild(h('td', null, fmt(x.maximo))); tr.appendChild(h('td', null, fmt(x.sugerido), 'font-weight:700;')); tr.appendChild(h('td', null, fmt(x.hecho_hoy) + (Number(x.hecho_hoy) >= Number(x.sugerido) ? ' ✓' : ''))); const td = h('td'); td.appendChild(boton('Registrar', () => { pintar({ id: x.producto_id, nombre: x.producto }); window.scrollTo(0, 0); })); tr.appendChild(td); tb.appendChild(tr); });
        b1.appendChild(h('p', 'nota', 'Promedio de las últimas 6 semanas del mismo día, más 10% de margen. Es una ayuda: ajusta por clima, fiestas o temporada.', 'margin-top:6px;')); }
      const b2 = h('div', 'bloque-analitica'); b2.appendChild(h('h3', null, 'Tandas de hoy')); z.appendChild(b2);
      if(!hoy.tandas.length) b2.appendChild(h('p', 'nota', 'Aún no registras tandas hoy.')); else {
        const ult = hoy.tandas[0]; const ca = h('div', null, null, 'border:1px solid var(--borde); border-radius:10px; padding:10px 12px; margin-bottom:10px;'); ca.appendChild(h('strong', null, 'Última tanda: ' + fmt(ult.cantidad) + ' × ' + ult.producto + ' · ' + hace(ult.cuando)));
        const tx = '🔥 ¡Recién salido! ' + ult.producto + ' calientito. ¡Te esperamos!'; const ac = h('div', null, null, 'display:flex; gap:8px; margin-top:6px;'); ac.appendChild(boton('Mandar aviso «sale caliente»', () => window.open('https://wa.me/?text=' + encodeURIComponent(tx), '_blank', 'noopener')));
        const bc = boton('Copiar aviso', async () => { try { await navigator.clipboard.writeText(tx); bc.textContent = 'Copiado ✓'; } catch(e){ window.prompt('Copia el texto:', tx); } }); ac.appendChild(bc); ca.appendChild(ac); b2.appendChild(ca);
        Object.keys(TURNOS).forEach((k) => { const l = hoy.tandas.filter((t) => t.turno === k); if(!l.length) return; b2.appendChild(h('div', 'nota', TURNOS[k] + ' · ' + fmt(l.reduce((s, t) => s + Number(t.cantidad), 0)) + ' en total', 'font-weight:600; margin-top:8px;')); l.forEach((t) => b2.appendChild(h('div', null, new Date(t.cuando).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) + ' · ' + fmt(t.cantidad) + ' × ' + t.producto + (t.nota ? ' · ' + t.nota : ''), 'font-size:14px; padding:3px 0; border-top:1px solid var(--borde);'))); }); }
    } catch(e){ msg(z, 'No se pudo cargar: ' + errTxt(e)); }
  }
  window.PuveProduccion = { enlazar(o){ enlace = Object.assign(enlace, o || {}); }, abrir };
})();
