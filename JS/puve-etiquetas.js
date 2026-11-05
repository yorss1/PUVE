/* PUVE - Etiquetas de precio para cualquier giro (Inventario → Etiquetas): anaquel, pequeña, joyería u hoja carta (24 por hoja).
 * Lleva nombre, precio, precio por 100 g y por kilo (si el producto tiene peso o se vende por kilo) y código de barras EAN-13 (si el producto tiene uno válido).
 * Se arma en la página con jsPDF; solo lee tus productos: no cambia nada.
 */
(function(){
  'use strict';
  let enlace = { sb: null, dinero: (n) => '$' + Number(n).toFixed(2) };
  const EAN_L = ['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'], EAN_G = ['0100111','0110011','0011011','0100001','0011101','0111001','0000101','0010001','0001001','0010111'], EAN_PAR = ['LLLLLL','LLGLGG','LLGGLG','LLGGGL','LGLLGG','LGGLLG','LGGGLL','LGLGLG','LGLGGL','LGGLGL'];
  const dig = (d) => { let s = 0; for(let i = 0; i < 12; i++) s += Number(d[i]) * (i % 2 ? 3 : 1); return String((10 - s % 10) % 10); };
  const ean = (c) => /^\d{13}$/.test(c || '') && dig(c.slice(0, 12)) === c[12];
  function bits(c){ const par = EAN_PAR[Number(c[0])]; let b = '101'; for(let i = 1; i <= 6; i++) b += (par[i - 1] === 'L' ? EAN_L : EAN_G)[Number(c[i])]; b += '01010'; for(let i = 7; i <= 12; i++) b += EAN_L[Number(c[i])].split('').map((x) => x === '1' ? '0' : '1').join(''); return b + '101'; }
  const FORMATOS = { anaquel: { n: 'Anaquel 60 × 40 mm (rollo)', w: 60, h: 40, rollo: 1 }, pequena: { n: 'Pequeña 50 × 30 mm (rollo)', w: 50, h: 30, rollo: 1 }, joyeria: { n: 'Joyería 30 × 20 mm (rollo)', w: 30, h: 20, rollo: 1 }, carta: { n: 'Hoja carta: 24 por hoja (3 × 8)', w: 66, h: 33 } };
  function h(tag, cls, txt, estilo){ const e = document.createElement(tag); if(cls) e.className = cls; if(txt != null) e.textContent = txt; if(estilo) e.style.cssText = estilo; return e; }
  function boton(txt, fn, cls, estilo){ const b = h('button', cls || 'texto', txt, 'width:auto; padding:7px 12px;' + (estilo || '')); b.type = 'button'; b.onclick = fn; return b; }
  const msg = (z, t, ok) => { z.textContent = t; z.style.cssText = 'font-size:13px; margin:8px 0; color:' + (ok ? '#16a34a' : 'var(--error,#b91c1c)') + ';'; };
  const money = (n) => '$' + (Math.round(Number(n) * 100) / 100).toFixed(2);
  function precios(p){ // [por 100 g, por kg] o null
    const peso = Number(p.peso_unitario_g); if(peso > 0) return [Number(p.precio) / (peso / 100), Number(p.precio) / (peso / 1000)];
    if(String(p.unidad || '').toLowerCase().startsWith('kg') || /kilo/i.test(p.unidad || '')) return [Number(p.precio) / 10, Number(p.precio)]; return null;
  }
  function etiqueta(doc, x, y, f, p, o){
    const pad = Math.max(1.2, f.w * 0.035), s = f.w / 60; let cy = y + pad;
    doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'bold'); doc.setFontSize(Math.max(5.5, 8.5 * s)); const ls = doc.splitTextToSize(String(p.nombre), f.w - pad * 2).slice(0, 2);
    ls.forEach((l, i) => doc.text(l, x + pad, cy + (3 + i * 3.4) * Math.max(.7, s))); cy += (ls.length * 3.4 + 1.5) * Math.max(.7, s);
    doc.setFontSize(Math.max(9, 17 * s)); doc.text(money(p.precio), x + f.w - pad, cy + 6 * Math.max(.75, s), { align: 'right' });
    const pu = o.unitario ? precios(p) : null; doc.setFont('helvetica', 'normal'); doc.setFontSize(Math.max(5, 6.2 * s));
    if(pu) doc.text('100 g: ' + money(pu[0]) + ' · kg: ' + money(pu[1]), x + pad, cy + 5 * Math.max(.75, s) + 4 * Math.max(.75, s));
    if(o.barras && ean(p.sku) && f.h >= 28){ const b = bits(p.sku), mod = Math.min(0.33, (f.w - pad * 2 - 6) / b.length), x0 = x + (f.w - b.length * mod) / 2, alto = Math.min(10, f.h * 0.26), yb = y + f.h - alto - pad - 2.4;
      doc.setFillColor(0, 0, 0); for(let i = 0; i < b.length;){ if(b[i] === '1'){ let j = i; while(b[j] === '1') j++; doc.rect(x0 + i * mod, yb, (j - i) * mod, alto, 'F'); i = j; } else i++; } doc.setFontSize(5.5); doc.text(p.sku, x + f.w / 2, yb + alto + 2.2, { align: 'center' }); }
  }
  function generar(sel, fk, o){
    const J = window.jspdf && window.jspdf.jsPDF; if(!J) throw new Error('No se pudo cargar el generador de PDF. Revisa tu conexión.');
    const f = FORMATOS[fk], lista = []; sel.forEach((s) => { for(let i = 0; i < s.copias; i++) lista.push(s.p); }); if(!lista.length) throw new Error('Agrega al menos un producto.');
    if(f.rollo){ const doc = new J({ unit: 'mm', format: [f.w, f.h], orientation: f.w >= f.h ? 'landscape' : 'portrait' }); lista.forEach((p, i) => { if(i) doc.addPage([f.w, f.h], 'landscape'); etiqueta(doc, 0, 0, f, p, o); }); doc.save('etiquetas-precio.pdf'); }
    else { const doc = new J({ unit: 'mm', format: 'letter' }), mx = (215.9 - 3 * f.w) / 2, my = (279.4 - 8 * f.h) / 2; lista.forEach((p, i) => { const k = i % 24; if(i && k === 0) doc.addPage(); const x = mx + (k % 3) * f.w, y = my + Math.floor(k / 3) * f.h; doc.setDrawColor(210); doc.rect(x, y, f.w, f.h); etiqueta(doc, x, y, f, p, o); }); doc.save('etiquetas-precio.pdf'); }
    return lista.length;
  }
  let raiz = null, sel = [], formato = 'anaquel', op = { unitario: true, barras: true };
  function abrir(){ raiz = raiz || document.getElementById('vistaInventarioEtiquetas'); if(raiz) pintar(); }
  function pintar(){
    raiz.textContent = ''; const caja = h('div', 'bloque-analitica'); caja.appendChild(h('h3', null, 'Etiquetas de precio')); caja.appendChild(h('p', 'nota', 'Busca tus productos, elige cuántas etiquetas de cada uno y descarga el PDF listo para imprimir. El código de barras sale si el producto tiene un EAN-13 válido.', 'margin:0 0 10px;'));
    const q = h('input', 'input-mini'); q.placeholder = 'Busca el producto por nombre o código…'; q.maxLength = 40; const res = h('div', null, null, 'display:flex; gap:6px; flex-wrap:wrap; margin:8px 0;'), est = h('div'); let tm = 0;
    q.oninput = () => { clearTimeout(tm); tm = setTimeout(async () => { res.textContent = ''; const t = q.value.replace(/[%_,()\\]/g, ' ').trim(); if(t.length < 2) return;
      const r = await enlace.sb.from('productos').select('id,nombre,sku,precio,unidad,peso_unitario_g').eq('activo', true).or('nombre.ilike.%' + t + '%,sku.eq.' + t).order('nombre').limit(10); if(r.error){ msg(est, r.error.message); return; }
      if(!r.data.length) res.appendChild(h('span', 'nota', 'No encontré productos.')); r.data.forEach((p) => res.appendChild(boton(p.nombre + ' · ' + money(p.precio), () => { if(!sel.some((s) => s.p.id === p.id)) sel.push({ p, copias: 1 }); res.textContent = ''; q.value = ''; lista(); }))); }, 250); };
    caja.appendChild(q); caja.appendChild(res); const zl = h('div'); caja.appendChild(zl);
    function lista(){
      zl.textContent = ''; if(!sel.length){ zl.appendChild(h('p', 'nota', 'Aún no has agregado productos.')); return; }
      sel.forEach((s, i) => { const f = h('div', null, null, 'display:flex; gap:8px; align-items:center; padding:6px 0; border-top:1px solid var(--borde);'); f.appendChild(h('div', null, s.p.nombre + ' · ' + money(s.p.precio), 'flex:1; font-size:14px;'));
        const c = h('input', 'input-mini', null, 'width:80px;'); c.type = 'number'; c.min = '1'; c.max = '200'; c.value = s.copias; c.setAttribute('aria-label', 'Copias de ' + s.p.nombre); c.onchange = () => { s.copias = Math.max(1, Math.min(200, parseInt(c.value, 10) || 1)); c.value = s.copias; }; f.appendChild(c); f.appendChild(boton('Quitar', () => { sel.splice(i, 1); lista(); })); zl.appendChild(f); });
    }
    lista(); const fs = h('select', 'input-mini', null, 'width:auto; margin:10px 0;'); Object.keys(FORMATOS).forEach((k) => { const o = h('option', null, FORMATOS[k].n); o.value = k; fs.appendChild(o); }); fs.value = formato; fs.onchange = () => { formato = fs.value; }; caja.appendChild(fs);
    const ck = (txt, k) => { const l = h('label', null, null, 'display:flex; gap:8px; align-items:center; font-size:13px; margin:4px 0;'), c = h('input'); c.type = 'checkbox'; c.checked = op[k]; c.style.cssText = 'width:18px; height:18px; margin:0;'; c.onchange = () => { op[k] = c.checked; }; l.appendChild(c); l.appendChild(document.createTextNode(txt)); caja.appendChild(l); };
    ck('Mostrar precio por 100 g y por kilo (solo si el producto tiene peso o se vende por kilo)', 'unitario'); ck('Mostrar código de barras (si el producto tiene un EAN-13 válido)', 'barras');
    const gb = boton('Descargar PDF', () => { try { const n = generar(sel, formato, op); msg(est, n + (n === 1 ? ' etiqueta lista.' : ' etiquetas listas.'), true); } catch(e){ msg(est, e.message); } }, 'principal', 'padding:9px 14px; margin-top:10px;'); caja.appendChild(gb); caja.appendChild(est); raiz.appendChild(caja);
  }
  window.PuveEtiquetas = { enlazar(o){ enlace = Object.assign(enlace, o || {}); }, abrir, _gen: generar, _precios: precios };
})();
