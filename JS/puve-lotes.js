/* PUVE - Lotes y caducidad con PEPS (Inventario → pestaña "Lotes").
 * Registrar entrada con lote y caducidad · semáforo por lote · "vende primero" · dar de baja (caducado, devuelto al proveedor, dañado).
 * Las cuentas salen del servidor (lote_registrar, lotes_estado, lote_dar_baja). Lo que "queda" de cada lote es una estimación PEPS: se supone que se vende primero lo que entró primero.
 */
(function(){
  'use strict';
  let enlace = { sb: null };
  const fmt = (n, d) => Number(n).toLocaleString('es-MX', { maximumFractionDigits: d == null ? 2 : d });
  function h(tag, cls, txt, estilo){ const e = document.createElement(tag); if(cls) e.className = cls; if(txt != null) e.textContent = txt; if(estilo) e.style.cssText = estilo; return e; }
  function boton(txt, fn, cls, estilo){ const b = h('button', cls || 'texto', txt, 'width:auto; padding:7px 12px;' + (estilo || '')); b.type = 'button'; b.onclick = fn; return b; }
  function campo(et, el, ancho){ const w = h('label', null, et, 'display:flex; flex-direction:column; gap:4px; font-size:13px; font-weight:500;' + (ancho ? 'flex:1 1 ' + ancho + 'px;' : '')); w.appendChild(el); return w; }
  const msg = (z, t, ok) => { z.textContent = t; z.style.cssText = 'font-size:13px; margin:8px 0; color:' + (ok ? '#16a34a' : 'var(--error,#b91c1c)') + ';'; };
  function errTxt(e){ const m = (e && e.message) || String(e); return /does not exist|schema cache|Could not find/i.test(m) ? 'Falta ejecutar el script SQL 112 en Supabase.' : m; }
  let filtro = 'todos', datos = null, raiz = null;

  // ---- Registrar entrada ----
  function formulario(cont, alGuardar){
    const caja = h('div', 'bloque-analitica', null, 'margin-bottom:18px;'); caja.appendChild(h('h3', null, 'Registrar entrada con lote'));
    caja.appendChild(h('p', 'nota', 'Cuando llegue mercancía que caduca, anota su lote y fecha. PUVE te avisa cuándo vence y qué conviene vender primero.', 'margin:0 0 10px;'));
    const q = h('input', 'input-mini'); q.placeholder = 'Busca el producto por nombre…'; q.maxLength = 40; q.autocomplete = 'off';
    const res = h('div', null, null, 'display:flex; gap:6px; flex-wrap:wrap; margin:8px 0;'), f = h('div', null, null, 'display:none; gap:10px; flex-wrap:wrap; align-items:end;'), est = h('div');
    let prod = null, tm = 0;
    q.oninput = () => { clearTimeout(tm); tm = setTimeout(async () => {
      res.textContent = ''; const t = q.value.replace(/[%_,()\\]/g, ' ').trim(); if(t.length < 2) return;
      const r = await enlace.sb.from('productos').select('id,nombre,stock').eq('activo', true).neq('tipo', 'servicio').ilike('nombre', '%' + t + '%').order('nombre').limit(8);
      if(r.error){ msg(est, errTxt(r.error)); return; }
      if(!r.data.length) res.appendChild(h('span', 'nota', 'No encontré productos con ese nombre.'));
      r.data.forEach((p) => res.appendChild(boton(p.nombre + ' (' + fmt(p.stock) + ')', () => { prod = p; res.textContent = ''; q.value = p.nombre; f.style.display = 'flex'; msg(est, ''); lote.focus(); })));
    }, 250); };
    const lote = h('input', 'input-mini'); lote.maxLength = 40; lote.placeholder = 'Ej. L2411A';
    const cant = h('input', 'input-mini'); cant.type = 'number'; cant.min = '0'; cant.step = 'any'; cant.style.width = '110px';
    const cad = h('input', 'input-mini'); cad.type = 'date';
    const sum = h('input'); sum.type = 'checkbox'; sum.checked = true; sum.style.cssText = 'width:18px; height:18px; margin:0;';
    const fs = h('label', null, null, 'display:flex; gap:8px; align-items:center; font-size:13px; flex:1 1 100%;'); fs.appendChild(sum); fs.appendChild(document.createTextNode('Sumar esta cantidad al inventario (quítalo si ya la habías registrado como compra)'));
    const bg = boton('Guardar lote', async () => {
      if(!prod) return msg(est, 'Elige primero el producto.');
      const n = Number(cant.value); if(!lote.value.trim() || !(n > 0) || !cad.value) return msg(est, 'Completa el lote, la cantidad y la fecha de caducidad.');
      bg.disabled = true; msg(est, 'Guardando…', true);
      const r = await enlace.sb.rpc('lote_registrar', { p_producto_id: prod.id, p_lote: lote.value.trim(), p_cantidad: n, p_caducidad: cad.value, p_sumar_stock: sum.checked });
      bg.disabled = false; if(r.error) return msg(est, errTxt(r.error));
      msg(est, 'Lote guardado ✓', true); lote.value = ''; cant.value = ''; cad.value = ''; prod = null; q.value = ''; f.style.display = 'none'; alGuardar();
    }, 'principal', 'padding:9px 14px;');
    [campo('Lote', lote, 140), campo('Cantidad', cant), campo('Caduca', cad)].forEach((c) => f.appendChild(c)); f.appendChild(fs); f.appendChild(bg);
    [q, res, f, est].forEach((e) => caja.appendChild(e)); cont.appendChild(caja);
  }

  // ---- Lista y semáforo ----
  const nivel = (d) => d < 0 ? 0 : d <= 7 ? 1 : d <= 30 ? 2 : 3;
  const COLOR = ['#dc2626', '#ea580c', '#ca8a04', '#16a34a'], ROT = ['Vencido', 'Vence en 7 días o menos', 'Vence en 30 días o menos', 'Con tiempo'];
  function lista(cont, d){
    const caja = h('div', 'bloque-analitica'); caja.appendChild(h('h3', null, 'Lotes con existencia'));
    const cuenta = [0, 0, 0, 0]; d.items.forEach((x) => cuenta[nivel(x.dias)]++);
    const barra = h('div', null, null, 'display:flex; gap:8px; flex-wrap:wrap; margin-bottom:10px;');
    [['todos', 'Todos (' + d.items.length + ')'], ['0', 'Vencidos (' + cuenta[0] + ')'], ['1', '7 días (' + cuenta[1] + ')'], ['2', '30 días (' + cuenta[2] + ')']].forEach(([v, t]) => barra.appendChild(boton(t, () => { filtro = v; pintarLista(); }, 'texto' + (filtro === v ? ' activo' : ''))));
    caja.appendChild(barra);
    const z = h('div'); caja.appendChild(z); cont.appendChild(caja);
    function pintarLista(){
      Array.prototype.forEach.call(barra.children, (b, i) => b.classList.toggle('activo', ['todos', '0', '1', '2'][i] === filtro));
      z.textContent = ''; const it = d.items.filter((x) => filtro === 'todos' || (filtro === '2' ? nivel(x.dias) <= 2 : nivel(x.dias) === Number(filtro)));
      if(!it.length){ z.appendChild(h('p', 'nota', d.items.length ? 'Nada en esta categoría.' : 'Todavía no hay lotes registrados con existencia. Registra el primero arriba.')); return; }
      const w = h('div', 'envoltura-tabla'), t = h('table'), th = h('thead'), tr0 = h('tr'); ['Producto', 'Lote', 'Quedan', 'Caduca', ''].forEach((c) => tr0.appendChild(h('th', null, c))); th.appendChild(tr0); t.appendChild(th);
      const tb = h('tbody'); t.appendChild(tb); w.appendChild(t); z.appendChild(w);
      it.forEach((x) => {
        const n = nivel(x.dias), tr = h('tr'); const td1 = h('td', null, null, 'font-weight:600;'); td1.appendChild(document.createTextNode(x.producto));
        if(x.vende_primero){ td1.appendChild(h('span', null, 'Vende primero', 'margin-left:8px; font-size:11px; font-weight:600; padding:2px 8px; border-radius:99px; background:#fef3c7; color:#92400e;')); }
        tr.appendChild(td1); tr.appendChild(h('td', null, x.lote)); tr.appendChild(h('td', null, fmt(x.restante, 3) + (Number(x.restante) < Number(x.cantidad) ? ' de ' + fmt(x.cantidad, 3) : '')));
        const tdc = h('td'); tdc.appendChild(h('span', null, '● ', 'color:' + COLOR[n] + ';')); tdc.appendChild(document.createTextNode(x.caducidad + ' · ' + (x.dias < 0 ? 'vencido hace ' + (-x.dias) + ' d' : x.dias === 0 ? 'vence hoy' : 'en ' + x.dias + ' d'))); tdc.title = ROT[n]; tr.appendChild(tdc);
        const ta = h('td'); ta.appendChild(boton('Dar de baja', () => bajar(ta, x))); tr.appendChild(ta); tb.appendChild(tr);
      });
      z.appendChild(h('p', 'nota', 'Lo que queda es una estimación: se supone que se vende primero lo que entró primero. Se corrige con los ajustes de inventario. La caducidad del producto se alinea con su lote más próximo.', 'margin-top:8px;'));
    }
    pintarLista();
  }
  function bajar(td, x){
    td.textContent = ''; const s = h('select', 'input-mini', null, 'width:auto;');
    [['caducado', 'Caducado'], ['devolucion_proveedor', 'Devuelto al proveedor'], ['danado', 'Dañado']].forEach(([v, t]) => { const o = h('option', null, t); o.value = v; s.appendChild(o); });
    const ok = boton('Confirmar', async () => {
      if(!window.confirm('¿Dar de baja ' + fmt(x.restante, 3) + ' de «' + x.producto + '» (lote ' + x.lote + ')? Se descuenta del inventario.')) return;
      ok.disabled = true; const r = await enlace.sb.rpc('lote_dar_baja', { p_lote_id: x.id, p_motivo: s.value });
      if(r.error){ ok.disabled = false; td.appendChild(h('div', 'nota', errTxt(r.error), 'color:var(--error,#b91c1c);')); return; } abrir();
    }, 'principal');
    td.append(s, ok, boton('Cancelar', () => abrir()));
  }
  async function abrir(){
    raiz = raiz || document.getElementById('vistaInventarioLotes'); if(!raiz) return; raiz.textContent = '';
    formulario(raiz, abrir); const z = h('div'); raiz.appendChild(z);
    try { const r = await enlace.sb.rpc('lotes_estado'); if(r.error) throw r.error; datos = r.data; lista(z, datos); } catch(e){ msg(z, 'No se pudo cargar: ' + errTxt(e)); }
  }
  window.PuveLotes = { enlazar(o){ enlace = Object.assign(enlace, o || {}); }, abrir };
})();
