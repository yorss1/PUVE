/* PUVE - Cuentas abiertas (menú "Cuentas"): una cuenta por mesa o por nombre; se agregan rondas y se cobra al final, completa o por productos.
 * Las rondas se guardan sin tocar inventario ni caja; al cobrar se arma una venta normal con los productos elegidos (un ticket por cobro).
 * Los datos entran y salen por funciones (cuenta_abrir, cuenta_agregar, cuenta_repetir_ronda, cuenta_cobrar...).
 */
(function(){
  'use strict';
  let enlace = { sb: null, negocioId: () => null, dinero: (n) => '$' + Number(n).toFixed(2) };
  function h(tag, cls, txt, estilo){ const e = document.createElement(tag); if(cls) e.className = cls; if(txt != null) e.textContent = txt; if(estilo) e.style.cssText = estilo; return e; }
  function boton(txt, fn, cls, estilo){ const b = h('button', cls || 'texto', txt, 'width:auto; padding:7px 12px;' + (estilo || '')); b.type = 'button'; b.onclick = fn; return b; }
  function campo(et, el, ancho){ const w = h('label', null, et, 'display:flex; flex-direction:column; gap:4px; font-size:13px; font-weight:500;' + (ancho ? 'flex:1 1 ' + ancho + 'px;' : '')); w.appendChild(el); return w; }
  const input = (v, ph, max, tipo) => { const i = h('input', 'input-mini'); if(tipo) i.type = tipo; if(v != null && v !== '') i.value = v; if(ph) i.placeholder = ph; if(max) i.maxLength = max; return i; };
  const sel = (ops) => { const s = h('select', 'input-mini'); ops.forEach(([v, t]) => { const o = h('option', null, t); o.value = v; s.appendChild(o); }); return s; };
  const num = (n) => Number(n).toLocaleString('es-MX', { maximumFractionDigits: 2 });
  const folio = (n) => 'C-' + String(n).padStart(3, '0');
  const msg = (z, t, ok) => { z.textContent = t; z.style.cssText = 'font-size:13px; margin:8px 0; color:' + (ok ? '#16a34a' : 'var(--error,#b91c1c)') + ';'; };
  function errTxt(e){ const m = (e && e.message) || String(e); return /does not exist|schema cache|Could not find/i.test(m) ? 'Falta ejecutar el script SQL 118 en Supabase.' : m; }
  async function rpc(f, a){ const r = await enlace.sb.rpc(f, a); if(r.error) throw r.error; return r.data; }
  let raiz = null, filtro = 'abiertas', productos = null, cats = [], nombreNeg = null;
  async function negocio(){ if(nombreNeg) return nombreNeg; try { const id = enlace.negocioId(); if(id){ const r = await enlace.sb.from('negocios').select('nombre').eq('id', id).maybeSingle(); if(r.data && r.data.nombre) nombreNeg = r.data.nombre; } } catch(e){} return nombreNeg || 'Mi negocio'; }
  async function catalogo(){ if(productos) return; const [a, b] = await Promise.all([enlace.sb.from('productos').select('id,nombre,precio,categoria_id').eq('activo', true).order('nombre').limit(600), enlace.sb.from('categorias').select('id,nombre').order('nombre')]); if(a.error) throw a.error; productos = a.data || []; cats = (b.data || []); }
  function abrir(){ raiz = raiz || document.getElementById('seccionCuentas'); if(raiz){ productos = null; lista(); } }

  async function lista(){
    raiz.textContent = ''; const cab = h('div', null, null, 'display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-bottom:12px;'); cab.appendChild(h('h2', null, 'Cuentas abiertas', 'margin:0; flex:1 1 auto;')); cab.appendChild(boton('+ Abrir cuenta', nueva, 'principal', 'padding:9px 14px;')); raiz.appendChild(cab);
    const barra = h('div', null, null, 'display:flex; gap:8px; margin-bottom:10px;'); [['abiertas', 'Abiertas'], ['cerradas', 'Cerradas hoy']].forEach(([v, t]) => barra.appendChild(boton(t, () => { filtro = v; lista(); }, 'texto' + (filtro === v ? ' activo' : '')))); raiz.appendChild(barra);
    const z = h('div'); raiz.appendChild(z);
    try { const d = await rpc('cuentas_lista', { p_estado: filtro }); if(!d.length){ z.appendChild(h('p', 'nota', filtro === 'abiertas' ? 'No hay cuentas abiertas.' : 'Hoy no se ha cerrado ninguna cuenta.')); return; }
      d.forEach((c) => { const t = h('div', null, null, 'border:1px solid var(--borde); border-radius:10px; padding:12px; margin-bottom:10px; cursor:pointer;'); t.tabIndex = 0; t.setAttribute('role', 'button'); const top = h('div', null, null, 'display:flex; justify-content:space-between; gap:8px;');
        top.appendChild(h('strong', null, folio(c.folio) + ' · ' + c.nombre + (c.mesa ? ' · Mesa ' + c.mesa : ''))); top.appendChild(h('strong', null, c.estado === 'abierta' ? num(c.pendiente).replace(/^/, '$') : c.estado === 'cancelada' ? 'Cancelada' : enlace.dinero(c.pagado))); t.appendChild(top);
        const falta = Number(c.minimo) - (Number(c.pendiente) + Number(c.pagado)); t.appendChild(h('div', 'nota', c.renglones + ' renglones' + (Number(c.pagado) > 0 && c.estado === 'abierta' ? ' · ya cobrado ' + enlace.dinero(c.pagado) : '') + (c.estado === 'abierta' && Number(c.minimo) > 0 && falta > 0 ? ' · faltan ' + enlace.dinero(falta) + ' para el consumo mínimo' : ''), c.estado === 'abierta' && falta > 0 && Number(c.minimo) > 0 ? 'color:#b45309;' : ''));
        t.onclick = () => detalle(c.id); t.onkeydown = (e) => { if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); detalle(c.id); } }; z.appendChild(t); });
    } catch(e){ msg(z, 'No se pudo cargar: ' + errTxt(e)); }
  }
  function nueva(){
    raiz.textContent = ''; raiz.appendChild(boton('← Volver', lista)); raiz.appendChild(h('h2', null, 'Abrir cuenta', 'margin:10px 0;'));
    const nom = input('', 'Mesa 4, Juan, Cumpleaños de Ana…', 60), mesa = input('', 'Opcional', 20), per = input('', '0', 4, 'number'), min = input('', '0', 8, 'number'); per.min = min.min = '0';
    const fr = h('div', null, null, 'display:flex; gap:10px; flex-wrap:wrap;'); [campo('Nombre de la cuenta', nom, 240), campo('Mesa', mesa, 100), campo('Personas (para cobrar cover)', per, 150), campo('Consumo mínimo $ (aviso)', min, 150)].forEach((x) => fr.appendChild(x)); raiz.appendChild(fr);
    raiz.appendChild(h('p', 'nota', 'El cover se cobra con un producto llamado «Cover» que debes tener en Productos con su precio. El consumo mínimo solo avisa: no cobra la diferencia solo.', 'margin:8px 0;'));
    const est = h('div'), gb = boton('Abrir', async () => { gb.disabled = true; try { const r = await rpc('cuenta_abrir', { p_nombre: nom.value.trim(), p_mesa: mesa.value.trim() || null, p_personas: Math.round(Number(per.value)) || 0, p_minimo: Number(min.value) || 0 }); detalle(r.id); } catch(e){ gb.disabled = false; msg(est, errTxt(e)); } }, 'principal', 'padding:9px 14px; margin-top:6px;'); raiz.appendChild(gb); raiz.appendChild(est);
  }
  async function detalle(id){
    raiz.textContent = ''; raiz.appendChild(boton('← Volver', lista)); const z = h('div'); raiz.appendChild(z);
    let d; try { d = await rpc('cuenta_detalle', { p_id: id }); await catalogo(); } catch(e){ msg(z, 'No se pudo cargar: ' + errTxt(e)); return; }
    const abierta = d.estado === 'abierta', pend = d.items.filter((i) => !i.pagado), totP = pend.reduce((s, i) => s + Number(i.precio) * Number(i.cantidad), 0), totPag = d.items.filter((i) => i.pagado).reduce((s, i) => s + Number(i.precio) * Number(i.cantidad), 0);
    z.appendChild(h('h2', null, folio(d.folio) + ' · ' + d.nombre + (d.mesa ? ' · Mesa ' + d.mesa : ''), 'margin:10px 0 4px;')); z.appendChild(h('div', 'nota', (abierta ? 'Abierta' : d.estado === 'cerrada' ? 'Cerrada' : 'Cancelada') + ' · por cobrar ' + enlace.dinero(totP) + (totPag > 0 ? ' · ya cobrado ' + enlace.dinero(totPag) : '')));
    if(abierta && Number(d.minimo) > 0 && totP + totPag < Number(d.minimo)) z.appendChild(h('div', 'nota', 'Consumo mínimo ' + enlace.dinero(d.minimo) + ': faltan ' + enlace.dinero(Number(d.minimo) - totP - totPag) + '. No se cobra solo.', 'color:#b45309; font-weight:600; margin-top:4px;'));
    const est = h('div'); z.appendChild(est); let recalcula = () => {};
    // --- agregar ronda ---
    if(abierta){
      const caja = h('div', 'bloque-analitica', null, 'margin:14px 0;'); caja.appendChild(h('h3', null, 'Agregar ronda')); const draft = {}; const q = input('', 'Buscar producto…', 30), cs = sel([['', 'Todas las categorías']].concat(cats.map((c) => [c.id, c.nombre])));
      const fb = h('div', null, null, 'display:flex; gap:8px; flex-wrap:wrap; margin-bottom:8px;'); fb.appendChild(q); fb.appendChild(cs); caja.appendChild(fb); const grid = h('div', null, null, 'display:grid; grid-template-columns:repeat(auto-fill,minmax(130px,1fr)); gap:6px; max-height:260px; overflow-y:auto;'); caja.appendChild(grid); const res = h('div', 'nota', '', 'margin-top:8px;'); caja.appendChild(res);
      const pintarG = () => { grid.textContent = ''; const t = q.value.trim().toLowerCase(); productos.filter((p) => (!cs.value || p.categoria_id === cs.value) && (!t || p.nombre.toLowerCase().includes(t))).slice(0, 80).forEach((p) => { const b = boton(p.nombre + ' · ' + enlace.dinero(p.precio) + (draft[p.id] ? '  ×' + draft[p.id] : ''), () => { draft[p.id] = (draft[p.id] || 0) + 1; pintarG(); resumen(); }, draft[p.id] ? 'principal' : 'texto', 'width:100%; text-align:left; min-height:44px; font-size:13px;'); grid.appendChild(b); }); };
      const resumen = () => { const k = Object.keys(draft); res.textContent = k.length ? k.map((id) => draft[id] + ' × ' + (productos.find((p) => p.id === id) || {}).nombre).join(' · ') : 'Toca los productos para armar la ronda.'; }; q.oninput = cs.onchange = pintarG; pintarG(); resumen();
      const ac = h('div', null, null, 'display:flex; gap:8px; flex-wrap:wrap; margin-top:8px;');
      const ba = boton('Agregar ronda a la cuenta', async () => { const k = Object.keys(draft); if(!k.length) return msg(est, 'Elige al menos un producto.'); ba.disabled = true; try { await rpc('cuenta_agregar', { p_cuenta: d.id, p_items: k.map((id) => ({ producto_id: id, cantidad: draft[id] })) }); detalle(d.id); } catch(e){ ba.disabled = false; msg(est, errTxt(e)); } }, 'principal');
      ac.appendChild(ba); ac.appendChild(boton('Limpiar', () => { Object.keys(draft).forEach((k) => delete draft[k]); pintarG(); resumen(); })); ac.appendChild(boton('Repetir la última ronda', async () => { try { await rpc('cuenta_repetir_ronda', { p_cuenta: d.id }); detalle(d.id); } catch(e){ msg(est, errTxt(e)); } })); caja.appendChild(ac); z.appendChild(caja);
    }
    // --- renglones por ronda ---
    z.appendChild(h('h3', null, 'Consumo')); const marcas = {}; if(!d.items.length) z.appendChild(h('p', 'nota', 'Todavía no hay consumo.'));
    let rondaAct = null; d.items.forEach((i) => { if(i.ronda !== rondaAct){ rondaAct = i.ronda; z.appendChild(h('div', 'nota', 'Ronda ' + i.ronda, 'margin-top:8px; font-weight:600;')); }
      const f = h('div', null, null, 'display:flex; gap:8px; align-items:center; padding:6px 0; border-top:1px solid var(--borde); font-size:14px;');
      if(abierta && !i.pagado){ const c = h('input'); c.type = 'checkbox'; c.checked = true; c.style.cssText = 'width:20px; height:20px; margin:0;'; c.setAttribute('aria-label', 'Cobrar ' + i.nombre); marcas[i.id] = c; c.onchange = () => recalcula(); f.appendChild(c); }
      f.appendChild(h('div', null, num(i.cantidad) + ' × ' + i.nombre + (i.pagado ? '  ✓ cobrado' : ''), 'flex:1;' + (i.pagado ? 'color:var(--texto-suave); text-decoration:line-through;' : ''))); f.appendChild(h('div', null, enlace.dinero(Number(i.precio) * Number(i.cantidad))));
      if(abierta && !i.pagado) f.appendChild(boton('Quitar', async () => { try { await rpc('cuenta_quitar_item', { p_item: i.id }); detalle(d.id); } catch(e){ msg(est, errTxt(e)); } })); z.appendChild(f); });
    if(abierta && pend.length){
      const caja = h('div', 'bloque-analitica', null, 'margin:14px 0;'); caja.appendChild(h('h3', null, 'Cobrar')); const tot = h('div', null, '', 'font-size:20px; font-weight:700; margin-bottom:8px;'); caja.appendChild(tot);
      const met = sel([['efectivo', 'Efectivo'], ['tarjeta', 'Tarjeta'], ['transferencia', 'Transferencia'], ['mixto', 'Mixto']]), pro = input('', '0', 8, 'number'), efe = input('', '', 8, 'number'), pm = sel([['efectivo', 'Propina en efectivo'], ['tarjeta', 'Propina en tarjeta'], ['transferencia', 'Propina por transferencia']]); pro.min = efe.min = '0'; pro.step = efe.step = 'any';
      const fe = campo('Efectivo recibido (mixto)', efe, 140); fe.style.display = 'none'; met.onchange = () => { fe.style.display = met.value === 'mixto' ? '' : 'none'; };
      const fr = h('div', null, null, 'display:flex; gap:10px; flex-wrap:wrap; align-items:end;'); [campo('Método', met, 150), fe, campo('Propina $ (opcional)', pro, 130), campo('Método de propina', pm, 170)].forEach((x) => fr.appendChild(x)); caja.appendChild(fr);
      const elegidos = () => pend.filter((i) => marcas[i.id] && marcas[i.id].checked); recalcula = function(){ const e = elegidos(); tot.textContent = e.length + (e.length === 1 ? ' renglón' : ' renglones') + ' · ' + enlace.dinero(e.reduce((s, i) => s + Number(i.precio) * Number(i.cantidad), 0)); }; recalcula();
      const ac = h('div', null, null, 'display:flex; gap:8px; flex-wrap:wrap; margin-top:10px;');
      const bc = boton('Cobrar lo marcado', async () => { const e = elegidos(); if(!e.length) return msg(est, 'Marca lo que se va a cobrar.'); bc.disabled = true; try { const r = await rpc('cuenta_cobrar', { p_cuenta: d.id, p_item_ids: e.map((i) => i.id), p_metodo: met.value, p_propina: Number(pro.value) || 0, p_propina_metodo: pm.value, p_monto_efectivo: met.value === 'mixto' ? (Number(efe.value) || 0) : null });
          ultimo = { items: e, total: r.total, propina: Number(pro.value) || 0 }; if(r.cerrada){ msg(est, 'Cuenta cerrada. Cobrado ' + enlace.dinero(r.total) + '.', true); setTimeout(() => detalle(d.id), 900); } else detalle(d.id, 'Cobrado ' + enlace.dinero(r.total) + '. Quedan renglones por cobrar.'); } catch(er){ bc.disabled = false; msg(est, errTxt(er)); } }, 'principal');
      ac.appendChild(bc); ac.appendChild(boton('Ticket PDF de lo marcado', () => ticket(d, elegidos(), Number(pro.value) || 0))); caja.appendChild(ac); z.appendChild(caja);
      z.appendChild(boton('Cancelar cuenta', async () => { if(!window.confirm('¿Cancelar esta cuenta? Solo se puede si no tiene cobros.')) return; try { await rpc('cuenta_cancelar', { p_cuenta: d.id }); lista(); } catch(e){ msg(est, errTxt(e)); } }, 'texto', 'margin-top:6px;'));
    } else if(abierta) z.appendChild(boton('Cerrar sin consumo (cancelar)', async () => { try { await rpc('cuenta_cancelar', { p_cuenta: d.id }); lista(); } catch(e){ msg(est, errTxt(e)); } }));
    if(arguments[1]) msg(est, arguments[1], true);
  }
  let ultimo = null;
  async function ticket(d, items, propina){
    if(!items.length) return alert('Marca los renglones del ticket.'); const J = window.jspdf && window.jspdf.jsPDF; if(!J) return alert('No se pudo generar el PDF. Revisa tu conexión.'); const nom = await negocio();
    const dib = (doc, medir) => { const W = 226, M = 14; let y = 24; const t = (x, o) => { o = o || {}; doc.setFont('helvetica', o.b ? 'bold' : 'normal'); doc.setFontSize(o.s || 8.5); doc.splitTextToSize(String(x), W - M * 2).forEach((l) => { if(!medir) doc.text(l, o.c ? W / 2 : M, y, o.c ? { align: 'center' } : undefined); y += (o.s || 8.5) + 3; }); };
      const par = (a, b, o) => { doc.setFont('helvetica', o && o.b ? 'bold' : 'normal'); doc.setFontSize(o && o.s || 8.5); if(!medir){ doc.text(a, M, y); doc.text(b, W - M, y, { align: 'right' }); } y += (o && o.s || 8.5) + 3; };
      t(nom, { b: 1, s: 12, c: 1 }); t('TICKET DE CUENTA', { b: 1, c: 1 }); t(folio(d.folio) + ' · ' + d.nombre + (d.mesa ? ' · Mesa ' + d.mesa : ''), { c: 1 }); t(new Date().toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }), { c: 1 }); y += 4;
      items.forEach((i) => par(num(i.cantidad) + ' × ' + i.nombre.slice(0, 22), enlace.dinero(Number(i.precio) * Number(i.cantidad)))); const sub = items.reduce((s, i) => s + Number(i.precio) * Number(i.cantidad), 0); y += 4;
      par('Subtotal', enlace.dinero(sub), { b: 1, s: 9.5 }); if(propina > 0){ par('Propina', enlace.dinero(propina)); par('Total con propina', enlace.dinero(sub + propina), { b: 1, s: 10.5 }); } y += 4; t('Gracias por tu visita. No es comprobante fiscal.', { s: 7, c: 1 }); return y + 14; };
    const alto = dib(new J({ unit: 'pt', format: [226, 900] }), true); const doc = new J({ unit: 'pt', format: [226, Math.max(200, alto)] }); dib(doc, false); doc.save('Ticket-' + folio(d.folio) + '.pdf');
  }
  window.PuveCuentas = { enlazar(o){ enlace = Object.assign(enlace, o || {}); }, abrir };
})();
