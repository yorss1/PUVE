/* PUVE - Cotizaciones: se arman desde el pedido actual (o con renglones libres), llevan folio consecutivo,
 * vigencia y estado, se descargan en PDF, se mandan por WhatsApp y se pueden cargar de nuevo al pedido para cobrarlas.
 * El folio y el total los calcula el servidor (cotizacion_guardar); el PDF se arma en la página con jsPDF.
 */
(function(){
  'use strict';
  let enlace = { sb: null, carrito: () => [], negocio: () => '', dinero: (n) => '$' + Number(n).toFixed(2), cargarAlCarrito: () => ({ ok: 0, omitidos: [] }), aviso: (m) => alert(m) };

  function h(tag, cls, txt, estilo){ const e = document.createElement(tag); if(cls) e.className = cls; if(txt != null) e.textContent = txt; if(estilo) e.style.cssText = estilo; return e; }
  const num = (v) => { const n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : NaN; };
  const redondear = (n) => Math.round(n * 100) / 100;
  const fmtCant = (n) => { n = Number(n); return Number.isInteger(n) ? String(n) : String(Math.round(n * 1000) / 1000); };
  const fecha = (iso) => new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  const vence = (c) => new Date(new Date(c.creado_en).getTime() + c.vigencia_dias * 86400000);
  const estadoDe = (c) => c.estado === 'enviada' && vence(c).getTime() < Date.now() ? 'vencida' : c.estado;
  const COLOR = { enviada: '#2563eb', aceptada: '#16a34a', rechazada: '#6b7280', vencida: '#dc2626' };

  function modal(titulo, ancho){
    const fondo = h('div', 'modal-puve-fondo'), caja = h('div', 'modal-puve'); caja.style.maxWidth = (ancho || 560) + 'px';
    fondo.appendChild(caja); fondo.onclick = (ev) => { if(ev.target === fondo) fondo.remove(); };
    caja.appendChild(h('h2', '', titulo, 'margin:0 0 8px;')); document.body.appendChild(fondo);
    return { caja, cerrar: () => fondo.remove() };
  }
  const boton = (txt, fn, cls, estilo) => {
    const b = h('button', cls || 'texto', txt, 'width:auto; padding:7px 12px;' + (estilo || '')); b.type = 'button';
    b.onclick = async () => { b.disabled = true; try { await fn(); } catch(e){ enlace.aviso((e && e.message) || String(e)); } finally { b.disabled = false; } };
    return b;
  };
  const campo = (caja, etq, tipo, valor, extra) => {
    const w = h('div', 'campo'); w.appendChild(h('label', null, etq)); const i = h('input'); i.type = tipo || 'text'; if(valor != null) i.value = valor; if(extra) Object.assign(i, extra); w.appendChild(i); caja.appendChild(w); return i;
  };

  // ---------------------------------------------------------------------
  // PDF
  // ---------------------------------------------------------------------
  function pdf(c){
    if(typeof window.jspdf === 'undefined'){ enlace.aviso('No se pudo generar el PDF. Revisa tu conexión e inténtalo de nuevo.'); return; }
    const { jsPDF } = window.jspdf, doc = new jsPDF({ unit: 'pt', format: 'letter' });
    const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), mg = 48;
    const NEGRO = [24, 24, 27], GRIS = [113, 113, 122], LINEA = [228, 228, 231];
    const negocio = enlace.negocio() || 'Cotización';
    doc.setFillColor.apply(doc, NEGRO); doc.rect(0, 0, W, 76, 'F');
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.text(negocio, mg, 46);
    doc.setFontSize(11); doc.text('COTIZACIÓN #' + String(c.folio).padStart(4, '0'), W - mg, 38, { align: 'right' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.text(fecha(c.creado_en), W - mg, 54, { align: 'right' });
    let y = 108; doc.setTextColor.apply(doc, NEGRO); doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text('Para: ' + c.cliente, mg, y);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor.apply(doc, GRIS);
    if(c.telefono) { doc.text('Tel. ' + c.telefono, mg, y + 15); }
    doc.text('Vigente hasta ' + fecha(vence(c)), W - mg, y, { align: 'right' }); y += 42;
    const cab = () => {
      doc.setDrawColor.apply(doc, LINEA); doc.setLineWidth(0.8); doc.line(mg, y + 6, W - mg, y + 6);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor.apply(doc, GRIS);
      doc.text('CANT.', mg, y); doc.text('DESCRIPCIÓN', mg + 60, y); doc.text('P. UNIT.', W - mg - 90, y, { align: 'right' }); doc.text('IMPORTE', W - mg, y, { align: 'right' }); y += 22;
    };
    cab(); doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    (c.items || []).forEach((i) => {
      const lineas = doc.splitTextToSize(String(i.nombre), W - mg * 2 - 190), alto = Math.max(1, lineas.length) * 13;
      if(y + alto > H - 120){ doc.addPage(); y = 60; cab(); doc.setFont('helvetica', 'normal'); doc.setFontSize(10); }
      doc.setTextColor.apply(doc, NEGRO); doc.text(fmtCant(i.cantidad), mg, y); doc.text(lineas, mg + 60, y);
      doc.text(enlace.dinero(i.precio), W - mg - 90, y, { align: 'right' }); doc.text(enlace.dinero(i.subtotal != null ? i.subtotal : i.cantidad * i.precio), W - mg, y, { align: 'right' });
      y += alto + 5;
    });
    if(y > H - 150){ doc.addPage(); y = 60; }
    doc.setDrawColor.apply(doc, LINEA); doc.line(mg, y, W - mg, y); y += 22;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor.apply(doc, NEGRO); doc.text('TOTAL', W - mg - 120, y, { align: 'right' }); doc.text(enlace.dinero(c.total), W - mg, y, { align: 'right' }); y += 28;
    if(c.notas){ doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor.apply(doc, GRIS); doc.text('Notas:', mg, y); y += 13; doc.setTextColor.apply(doc, NEGRO); doc.text(doc.splitTextToSize(String(c.notas), W - mg * 2), mg, y); }
    doc.setFontSize(8); doc.setTextColor.apply(doc, GRIS);
    doc.text('Precios en pesos mexicanos sujetos a cambio después de la vigencia. Documento informativo, no es un comprobante fiscal. Generado con PUVE.', mg, H - 30);
    doc.save('cotizacion-' + String(c.folio).padStart(4, '0') + '.pdf');
  }

  function whatsapp(c){
    const d = String(c.telefono || '').replace(/\D/g, ''), num52 = d.length === 10 ? '52' + d : (d.length === 13 && d.startsWith('521') ? '52' + d.slice(3) : d);
    if(num52.length < 11){ enlace.aviso('Esta cotización no tiene un teléfono válido para WhatsApp. Descarga el PDF y envíalo por el medio que prefieras.'); return; }
    const t = 'Hola ' + c.cliente + ', te comparto la cotización #' + String(c.folio).padStart(4, '0') + (enlace.negocio() ? ' de ' + enlace.negocio() : '') + ' por ' + enlace.dinero(c.total) + ', vigente hasta el ' + fecha(vence(c)) + '. Te mando el PDF por este medio. Quedo atento a tus comentarios.';
    window.open('https://wa.me/' + num52 + '?text=' + encodeURIComponent(t), '_blank', 'noopener');
  }

  // ---------------------------------------------------------------------
  // Nueva cotización
  // ---------------------------------------------------------------------
  function nueva(){
    const base = enlace.carrito().map((i) => ({ producto_id: i.id, nombre: i.nombre, cantidad: Number(i.cantidad), precio: Number(i.precio) }));
    const { caja, cerrar } = modal('Nueva cotización', 600);
    const lineas = base.slice();
    caja.appendChild(h('p', 'nota', 'Usa lo que tienes en el pedido y agrega conceptos libres (mano de obra, flete, instalación…). No descuenta existencias ni registra una venta.', 'margin:0 0 8px;'));
    const cli = campo(caja, 'Cliente', 'text', '', { maxLength: 80, placeholder: 'Nombre del cliente' });
    const tel = campo(caja, 'Teléfono (para WhatsApp)', 'tel', '', { maxLength: 20, placeholder: '10 dígitos' });
    const dias = campo(caja, 'Vigencia (días)', 'number', '15', { min: '1', max: '365' });
    const notas = campo(caja, 'Notas (opcional)', 'text', '', { maxLength: 300, placeholder: 'Ej. Entrega en 3 días hábiles' });
    const lista = h('div', null, null, 'margin:10px 0;'); caja.appendChild(lista);
    const total = h('div', null, null, 'font-size:20px; font-weight:800; margin:8px 0;'); caja.appendChild(total);
    const pintar = () => {
      lista.textContent = '';
      if(!lineas.length) lista.appendChild(h('p', 'nota', 'Aún no hay renglones. Agrega productos al pedido o un concepto libre abajo.'));
      lineas.forEach((l, idx) => {
        const f = h('div', null, null, 'display:flex; gap:8px; align-items:center; padding:5px 0; border-bottom:1px solid var(--borde,#ddd);');
        f.appendChild(h('span', null, fmtCant(l.cantidad) + ' × ' + l.nombre, 'flex:1;')); f.appendChild(h('span', null, enlace.dinero(redondear(l.cantidad * l.precio)), 'font-weight:600;'));
        f.appendChild(boton('Quitar', async () => { lineas.splice(idx, 1); pintar(); }, 'texto', 'color:#c0392b; padding:4px 8px;')); lista.appendChild(f);
      });
      total.textContent = 'Total ' + enlace.dinero(lineas.reduce((a, l) => a + redondear(l.cantidad * l.precio), 0));
    };
    const libre = h('div', null, null, 'display:flex; gap:6px; flex-wrap:wrap; align-items:center; margin:6px 0;');
    const ln = h('input', 'input-mini'); ln.placeholder = 'Concepto libre'; ln.maxLength = 120; ln.style.cssText = 'flex:1; min-width:150px;';
    const lc = h('input', 'input-mini'); lc.type = 'number'; lc.min = '0'; lc.step = 'any'; lc.placeholder = 'Cant.'; lc.value = '1'; lc.style.width = '70px';
    const lp = h('input', 'input-mini'); lp.type = 'number'; lp.min = '0'; lp.step = 'any'; lp.placeholder = 'Precio'; lp.style.width = '90px';
    libre.appendChild(ln); libre.appendChild(lc); libre.appendChild(lp);
    libre.appendChild(boton('+ Agregar', async () => {
      const c = num(lc.value), p = num(lp.value); if(!ln.value.trim() || !(c > 0) || isNaN(p) || p < 0){ enlace.aviso('Escribe el concepto, una cantidad mayor a 0 y el precio.'); return; }
      lineas.push({ producto_id: null, nombre: ln.value.trim(), cantidad: c, precio: p }); ln.value = ''; lp.value = ''; lc.value = '1'; pintar();
    })); caja.appendChild(libre);
    const msg = h('div', 'nota', '', 'color:var(--error,#b91c1c); margin:6px 0;'); caja.appendChild(msg);
    const guardar = async (despues) => {
      msg.textContent = '';
      if(!cli.value.trim()){ msg.textContent = 'Escribe el nombre del cliente.'; return; }
      if(!lineas.length){ msg.textContent = 'La cotización necesita al menos un renglón.'; return; }
      const { data, error } = await enlace.sb.rpc('cotizacion_guardar', { p_cliente: cli.value.trim(), p_telefono: tel.value.trim() || null, p_notas: notas.value.trim() || null, p_dias: parseInt(dias.value, 10) || 15, p_items: lineas });
      if(error){ msg.textContent = error.message; return; }
      const c = { id: data.id, folio: data.folio, total: data.total, creado_en: data.creado_en, cliente: cli.value.trim(), telefono: tel.value.trim(), notas: notas.value.trim(), vigencia_dias: parseInt(dias.value, 10) || 15,
        items: lineas.map((l) => ({ nombre: l.nombre, cantidad: l.cantidad, precio: redondear(l.precio), subtotal: redondear(l.cantidad * l.precio) })), estado: 'enviada' };
      cerrar(); if(despues === 'pdf') pdf(c); else whatsapp(c);
    };
    const f = h('div', null, null, 'display:flex; gap:8px; flex-wrap:wrap; margin-top:10px;');
    f.appendChild(boton('Cancelar', async () => cerrar()));
    f.appendChild(boton('Guardar y WhatsApp', () => guardar('wa')));
    f.appendChild(boton('Guardar y PDF', () => guardar('pdf'), 'principal')); caja.appendChild(f);
    pintar();
  }

  // ---------------------------------------------------------------------
  // Anteriores
  // ---------------------------------------------------------------------
  async function anteriores(){
    const { caja, cerrar } = modal('Cotizaciones', 760);
    const cuerpo = h('div'); caja.appendChild(cuerpo);
    const cargar = async () => {
      cuerpo.textContent = 'Cargando…';
      const { data, error } = await enlace.sb.from('cotizaciones').select('id,folio,cliente,telefono,notas,vigencia_dias,items,total,estado,creado_en').order('creado_en', { ascending: false }).limit(60);
      cuerpo.textContent = '';
      if(error){ cuerpo.appendChild(h('p', 'nota', 'No se pudo cargar: ' + error.message, 'color:var(--error,#b91c1c);')); return; }
      if(!(data || []).length){ cuerpo.appendChild(h('p', 'nota', 'Todavía no has hecho cotizaciones.')); return; }
      data.forEach((c) => {
        const est = estadoDe(c), fila = h('div', null, null, 'padding:10px 0; border-bottom:1px solid var(--borde,#ddd);');
        const cab = h('div', null, null, 'display:flex; justify-content:space-between; gap:8px; flex-wrap:wrap;');
        cab.appendChild(h('b', null, '#' + String(c.folio).padStart(4, '0') + ' · ' + c.cliente)); cab.appendChild(h('span', null, enlace.dinero(c.total), 'font-weight:700;')); fila.appendChild(cab);
        fila.appendChild(h('div', 'nota', fecha(c.creado_en) + ' · vigente hasta ' + fecha(vence(c)) + ' · ', 'margin:2px 0 6px;')).appendChild(h('b', null, est, 'color:' + COLOR[est] + '; text-transform:uppercase; font-size:11px;'));
        const ac = h('div', null, null, 'display:flex; gap:6px; flex-wrap:wrap;');
        ac.appendChild(boton('PDF', async () => pdf(c))); ac.appendChild(boton('WhatsApp', async () => whatsapp(c)));
        ac.appendChild(boton('Cargar al pedido', async () => {
          const r = enlace.cargarAlCarrito(c.items || []);
          let t = r.ok + ' renglón(es) cargado(s) al pedido.'; if(r.omitidos.length) t += ' No se cargaron: ' + r.omitidos.join(', ') + ' (conceptos libres o sin existencias).';
          cerrar(); enlace.aviso(t);
        }));
        if(est === 'enviada' || est === 'vencida'){
          ac.appendChild(boton('Marcar aceptada', async () => { const { error: e } = await enlace.sb.rpc('cotizacion_estado', { p_id: c.id, p_estado: 'aceptada' }); if(e) throw e; cargar(); }));
          ac.appendChild(boton('Rechazada', async () => { const { error: e } = await enlace.sb.rpc('cotizacion_estado', { p_id: c.id, p_estado: 'rechazada' }); if(e) throw e; cargar(); }));
        }
        fila.appendChild(ac); cuerpo.appendChild(fila);
      });
    };
    await cargar();
    const x = boton('Cerrar', async () => cerrar(), 'texto', 'width:100%; margin-top:10px;'); caja.appendChild(x);
  }

  window.PuveCotizaciones = {
    enlazar(o){ enlace = Object.assign(enlace, o || {}); },
    nueva, anteriores, _pdf: pdf
  };
})();
