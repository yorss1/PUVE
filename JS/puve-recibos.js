/* PUVE - Recibo de anticipo y abonos de un encargo/apartado: PDF tipo ticket (80 mm) y mensaje por WhatsApp.
 * Se usa desde Encargos (botones "Recibo PDF" y "WhatsApp"). Solo lee datos que la pantalla ya cargó: no cambia nada en la base.
 * Aviso impreso: no es comprobante fiscal.
 */
(function(){
  'use strict';
  let cfg = { sb: null, negocioId: () => null };
  let nombreNegocio = null;
  const dinero = (n) => '$' + (Math.round(Number(n) * 100) / 100).toFixed(2);
  const folio = (e) => 'E-' + String(e.num).padStart(4, '0');
  const fecha = (iso) => iso ? new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '';
  const fechaEntrega = (f) => f ? new Date(f + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }) : '';
  const METODO = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia' };
  async function negocio(){
    if(nombreNegocio) return nombreNegocio;
    try { const id = cfg.negocioId(); if(id){ const r = await cfg.sb.from('negocios').select('nombre').eq('id', id).maybeSingle(); if(r.data && r.data.nombre) nombreNegocio = r.data.nombre; } } catch(e){}
    return nombreNegocio || 'Mi negocio';
  }
  function datos(e){
    const total = Number(e.total_estimado), abonos = (e.encargo_abonos || []).slice().sort((a, b) => new Date(a.creado_en) - new Date(b.creado_en));
    const pagado = abonos.reduce((s, a) => s + Number(a.monto), 0);
    return { total, abonos, pagado, saldo: Math.max(0, total - pagado), items: (e.encargo_items || []).map((i) => (Math.round(Number(i.cantidad) * 1000) / 1000) + ' × ' + i.producto_nombre) };
  }
  // Dibuja el recibo; con medir=true solo calcula el alto necesario.
  function dibujar(doc, e, d, nom, medir){
    const W = 226, M = 14, A = W - M * 2; let y = 24;
    const txt = (t, o) => { o = o || {}; doc.setFont('helvetica', o.b ? 'bold' : 'normal'); doc.setFontSize(o.s || 8.5);
      const ls = doc.splitTextToSize(String(t), A); ls.forEach((l) => { if(!medir) doc.text(l, o.c ? W / 2 : M, y, o.c ? { align: 'center' } : undefined); y += (o.s || 8.5) + 3; }); };
    const par = (a, b, o) => { doc.setFont('helvetica', o && o.b ? 'bold' : 'normal'); doc.setFontSize(o && o.s || 8.5); if(!medir){ doc.text(a, M, y); doc.text(b, W - M, y, { align: 'right' }); } y += (o && o.s || 8.5) + 3; };
    const raya = () => { if(!medir){ doc.setDrawColor(180); doc.line(M, y - 4, W - M, y - 4); } y += 4; };
    txt(nom, { b: 1, s: 12, c: 1 }); txt('RECIBO DE ANTICIPO Y ABONOS', { b: 1, c: 1 }); txt(folio(e) + ' · emitido ' + fecha(new Date().toISOString()), { c: 1 }); raya();
    txt('Cliente: ' + e.cliente_nombre, { b: 1 }); if(e.cliente_telefono) txt('Tel: ' + e.cliente_telefono); if(e.fecha_entrega) txt('Entrega: ' + fechaEntrega(e.fecha_entrega)); raya();
    d.items.forEach((t) => txt(t)); if(!d.items.length) txt('(sin artículos)'); raya();
    par('Total', dinero(d.total), { b: 1, s: 9.5 });
    if(d.abonos.length){ txt('Pagos recibidos:', { b: 1 }); d.abonos.forEach((a) => par(fecha(a.creado_en) + ' ' + (METODO[a.metodo] || a.metodo), dinero(a.monto))); }
    par('Abonado', dinero(d.pagado)); par(d.saldo > 0 ? 'Saldo pendiente' : 'Liquidado', dinero(d.saldo), { b: 1, s: 10.5 }); raya();
    if(e.notas) txt('Nota: ' + e.notas);
    txt('Conserva este recibo para recoger tu pedido. No es comprobante fiscal.', { s: 7, c: 1 });
    return y + 14;
  }
  async function pdf(e){
    if(typeof window.jspdf === 'undefined'){ alert('No se pudo generar el PDF. Revisa tu conexión e inténtalo de nuevo.'); return; }
    const { jsPDF } = window.jspdf, d = datos(e), nom = await negocio();
    const alto = dibujar(new jsPDF({ unit: 'pt', format: [226, 900] }), e, d, nom, true);
    const doc = new jsPDF({ unit: 'pt', format: [226, Math.max(200, alto)] }); dibujar(doc, e, d, nom, false);
    doc.save('Recibo-' + folio(e) + '.pdf');
  }
  async function whatsapp(e){
    const d = datos(e), nom = await negocio();
    const lineas = ['*' + nom + '*', 'Recibo ' + folio(e), 'Cliente: ' + e.cliente_nombre, ''].concat(d.items.map((t) => '• ' + t), ['', 'Total: ' + dinero(d.total)]);
    d.abonos.forEach((a) => lineas.push('Pago ' + fecha(a.creado_en) + ' (' + (METODO[a.metodo] || a.metodo) + '): ' + dinero(a.monto)));
    lineas.push(d.saldo > 0 ? 'Saldo pendiente: ' + dinero(d.saldo) : '✅ Liquidado'); if(e.fecha_entrega) lineas.push('Entrega: ' + fechaEntrega(e.fecha_entrega)); lineas.push('', 'Gracias por tu preferencia.');
    const dig = String(e.cliente_telefono || '').replace(/\D/g, ''), n = dig.length === 10 ? '52' + dig : dig;
    window.open('https://wa.me/' + (n.length >= 11 ? n : '') + '?text=' + encodeURIComponent(lineas.join('\n')), '_blank', 'noopener');
  }
  window.PuveRecibos = { enlazar(o){ cfg = Object.assign(cfg, o || {}); }, pdf, whatsapp, _datos: datos };
})();
