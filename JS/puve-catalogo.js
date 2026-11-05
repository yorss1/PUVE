/* PUVE - Catálogo para compartir (Inventario → Catálogo): lista de productos con precios (y fotos en el PDF) por categoría.
 * Se comparte como texto por WhatsApp o se descarga en PDF. Solo lee tus productos y fotos: no cambia nada.
 * Si el producto no tiene foto, en el PDF sale solo con su nombre y precio. El PDF incluye hasta 60 productos; el texto, hasta 150.
 */
(function(){
  'use strict';
  let enlace = { sb: null, negocio: async () => 'Mi negocio', dinero: (n) => '$' + Number(n).toFixed(2) };
  function h(tag, cls, txt, estilo){ const e = document.createElement(tag); if(cls) e.className = cls; if(txt != null) e.textContent = txt; if(estilo) e.style.cssText = estilo; return e; }
  function boton(txt, fn, cls, estilo){ const b = h('button', cls || 'texto', txt, 'width:auto; padding:7px 12px;' + (estilo || '')); b.type = 'button'; b.onclick = fn; return b; }
  function campo(et, el, ancho){ const w = h('label', null, et, 'display:flex; flex-direction:column; gap:4px; font-size:13px; font-weight:500;' + (ancho ? 'flex:1 1 ' + ancho + 'px;' : '')); w.appendChild(el); return w; }
  const msg = (z, t, ok) => { z.textContent = t; z.style.cssText = 'font-size:13px; margin:8px 0; color:' + (ok ? '#16a34a' : 'var(--error,#b91c1c)') + ';'; };
  const money = (n) => '$' + (Math.round(Number(n) * 100) / 100).toFixed(2);
  let raiz = null, cats = [], prods = [];
  async function cargar(){
    const [a, b] = await Promise.all([enlace.sb.from('categorias').select('id,nombre').order('nombre'), enlace.sb.from('productos').select('id,nombre,precio,stock,foto_path,categoria_id,tipo').eq('activo', true).order('nombre').limit(1000)]);
    if(a.error) throw a.error; if(b.error) throw b.error; cats = a.data || []; prods = b.data || [];
  }
  function elegidos(o){
    const nombreCat = (id) => (cats.find((c) => c.id === id) || {}).nombre || 'Otros';
    let l = prods.filter((p) => (!o.cat || p.categoria_id === o.cat) && (!o.existencia || p.tipo === 'servicio' || Number(p.stock) > 0) && (!o.fotos || p.foto_path));
    l = l.map((p) => Object.assign({ cat: nombreCat(p.categoria_id) }, p)); l.sort((x, y) => x.cat.localeCompare(y.cat) || x.nombre.localeCompare(y.nombre)); return l;
  }
  function texto(l, o, negocio){
    let t = '*' + (o.titulo || 'Catálogo') + ' · ' + negocio + '*\n', cat = null;
    l.slice(0, 150).forEach((p) => { if(p.cat !== cat){ cat = p.cat; t += '\n*' + cat + '*\n'; } t += '• ' + p.nombre + (o.precios ? ' — ' + money(p.precio) : '') + '\n'; });
    if(l.length > 150) t += '\n(y más productos…)\n'; if(o.contacto) t += '\nPedidos: ' + o.contacto; return t.trim();
  }
  async function imagen(path){
    try { const u = enlace.sb.storage.from('fotos-negocios').getPublicUrl(path).data.publicUrl, r = await fetch(u); if(!r.ok) return null; const b = await r.blob(), tipo = /png/i.test(b.type) ? 'PNG' : 'JPEG';
      const d = await new Promise((ok, no) => { const f = new FileReader(); f.onload = () => ok(f.result); f.onerror = no; f.readAsDataURL(b); }); return { d, tipo }; } catch(e){ return null; }
  }
  async function pdf(l, o, negocio, est){
    const J = window.jspdf && window.jspdf.jsPDF; if(!J) throw new Error('No se pudo cargar el generador de PDF. Revisa tu conexión.');
    const lim = l.slice(0, 60), doc = new J({ unit: 'mm', format: 'letter' }), W = 215.9, M = 12, cw = (W - M * 2 - 8) / 2, ch = 78, filas = 3; let n = 0;
    const cab = (pag) => { doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(0, 0, 0); doc.text(negocio, M, 14); doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.text((o.titulo || 'Catálogo') + (o.contacto ? ' · Pedidos: ' + o.contacto : ''), M, 20); doc.setFontSize(8); doc.setTextColor(120); doc.text('Página ' + pag, W - M, 14, { align: 'right' }); doc.setTextColor(0); };
    let pag = 1; cab(pag);
    for(let i = 0; i < lim.length; i++){
      const k = i % (2 * filas); if(i && k === 0){ doc.addPage(); pag++; cab(pag); }
      const x = M + (k % 2) * (cw + 8), y = 26 + Math.floor(k / 2) * (ch + 5); doc.setDrawColor(215); doc.roundedRect(x, y, cw, ch, 2, 2);
      est.textContent = 'Preparando… ' + (i + 1) + ' de ' + lim.length; const im = lim[i].foto_path ? await imagen(lim[i].foto_path) : null;
      if(im){ try { doc.addImage(im.d, im.tipo, x + 2, y + 2, cw - 4, 50, undefined, 'FAST'); } catch(e){} } else { doc.setFillColor(245); doc.rect(x + 2, y + 2, cw - 4, 50, 'F'); }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.splitTextToSize(lim[i].nombre, cw - 6).slice(0, 2).forEach((t, j) => doc.text(t, x + 3, y + 59 + j * 4.5));
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(110); doc.text(lim[i].cat, x + 3, y + ch - 3); doc.setTextColor(0);
      if(o.precios){ doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.text(money(lim[i].precio), x + cw - 3, y + ch - 3, { align: 'right' }); } n++;
    }
    doc.save('catalogo.pdf'); return n;
  }
  function abrir(){ raiz = raiz || document.getElementById('vistaInventarioCatalogo'); if(raiz) pintar(); }
  async function pintar(){
    raiz.textContent = ''; const caja = h('div', 'bloque-analitica'); caja.appendChild(h('h3', null, 'Catálogo para compartir')); const est = h('div'); caja.appendChild(est);
    try { await cargar(); } catch(e){ msg(est, 'No se pudo cargar: ' + (e.message || e)); raiz.appendChild(caja); return; }
    caja.appendChild(h('p', 'nota', 'Arma una lista de tus productos para mandarla por WhatsApp o descargarla en PDF con fotos. Si usas las categorías como ocasiones o líneas (cumpleaños, bodas, colección), puedes mandar cada una por separado.', 'margin:0 0 10px;'));
    const tit = h('input', 'input-mini'); tit.value = 'Catálogo'; tit.maxLength = 40; const con = h('input', 'input-mini'); con.placeholder = 'Tu WhatsApp o teléfono (opcional)'; con.maxLength = 30; try { con.value = localStorage.getItem('puve_catalogo_contacto') || ''; } catch(e){}
    const cat = h('select', 'input-mini'); const t0 = h('option', null, 'Todas las categorías'); t0.value = ''; cat.appendChild(t0); cats.forEach((c) => { const o = h('option', null, c.nombre); o.value = c.id; cat.appendChild(o); });
    const fila = h('div', null, null, 'display:flex; gap:10px; flex-wrap:wrap; margin-bottom:8px;'); [campo('Título', tit, 180), campo('Categoría', cat, 180), campo('Contacto', con, 200)].forEach((x) => fila.appendChild(x)); caja.appendChild(fila);
    const op = { precios: true, existencia: true, fotos: false }; const ck = (t, k) => { const l = h('label', null, null, 'display:flex; gap:8px; align-items:center; font-size:13px; margin:4px 0;'), c = h('input'); c.type = 'checkbox'; c.checked = op[k]; c.style.cssText = 'width:18px; height:18px; margin:0;'; c.onchange = () => { op[k] = c.checked; cuenta(); }; l.appendChild(c); l.appendChild(document.createTextNode(t)); caja.appendChild(l); };
    ck('Mostrar precios', 'precios'); ck('Solo lo que tengo en existencia (los servicios siempre salen)', 'existencia'); ck('Solo productos que tienen foto', 'fotos');
    const cn = h('p', 'nota', '', 'margin:8px 0;'); caja.appendChild(cn); const O = () => ({ titulo: tit.value.trim(), contacto: con.value.trim(), cat: cat.value, precios: op.precios, existencia: op.existencia, fotos: op.fotos });
    const cuenta = () => { const n = elegidos(O()).length; cn.textContent = n + (n === 1 ? ' producto en el catálogo' : ' productos en el catálogo') + (n > 60 ? ' (el PDF incluye los primeros 60)' : ''); }; cat.onchange = tit.oninput = cuenta; cuenta();
    con.onchange = () => { try { localStorage.setItem('puve_catalogo_contacto', con.value.trim()); } catch(e){} };
    const ac = h('div', null, null, 'display:flex; gap:8px; flex-wrap:wrap; margin-top:8px;');
    ac.appendChild(boton('Mandar por WhatsApp', async () => { const l = elegidos(O()); if(!l.length) return msg(est, 'No hay productos con esos filtros.'); window.open('https://wa.me/?text=' + encodeURIComponent(texto(l, O(), await enlace.negocio())), '_blank', 'noopener'); }));
    const bc = boton('Copiar texto', async () => { const l = elegidos(O()); if(!l.length) return msg(est, 'No hay productos con esos filtros.'); const t = texto(l, O(), await enlace.negocio()); try { await navigator.clipboard.writeText(t); bc.textContent = 'Copiado ✓'; } catch(e){ window.prompt('Copia el texto:', t); } }); ac.appendChild(bc);
    const bp = boton('Descargar PDF con fotos', async () => { const l = elegidos(O()); if(!l.length) return msg(est, 'No hay productos con esos filtros.'); bp.disabled = true; try { const n = await pdf(l, O(), await enlace.negocio(), est); msg(est, 'PDF listo con ' + n + ' productos.', true); } catch(e){ msg(est, e.message || String(e)); } bp.disabled = false; }, 'principal'); ac.appendChild(bp);
    caja.appendChild(ac); raiz.appendChild(caja);
  }
  window.PuveCatalogo = { enlazar(o){ enlace = Object.assign(enlace, o || {}); }, abrir, _texto: texto };
})();
