/* PUVE - Órdenes de servicio y garantías (menú "Órdenes"): reparaciones, servicios y garantías con folio, estado previo, avance y PDF.
 * Los datos entran y salen por funciones del servidor (orden_crear, orden_estado, ordenes_lista, orden_detalle).
 * No maneja dinero: el costo es informativo; el cobro se hace en la caja. El estado previo es texto (sin fotos).
 */
(function(){
  'use strict';
  let enlace = { sb: null, giro: () => null, negocioId: () => null, dinero: (n) => '$' + Number(n).toFixed(2) };
  const GIROS = {
    electronicos: { equipo: 'Equipo', id: 'IMEI o número de serie', previo: 'Estado al recibirlo (golpes, pantalla, accesorios que deja)', problema: 'Falla reportada', dias: 90 },
    talleres: { equipo: 'Vehículo (marca, modelo, año)', id: 'Placa', previo: 'Estado previo del vehículo (golpes, rayones, nivel de gasolina, objetos)', problema: 'Servicio solicitado o falla', dias: 30 },
    refaccionarias: { equipo: 'Pieza o vehículo', id: 'Placa, folio o serie', previo: 'Estado de la pieza al recibirla', problema: 'Defecto reportado', dias: 30 },
    lavanderias: { equipo: 'Prendas o bolsa (descripción)', id: 'Número de bolsa o ticket', previo: 'Daños o manchas previas que se reciben (para cuidar a ambas partes)', problema: 'Servicio solicitado (lavado, planchado, tintorería…)', dias: 0 },
    joyeria: { equipo: 'Pieza o reloj', id: 'Folio o serie', previo: 'Estado de la pieza al recibirla (rayones, piedras flojas)', problema: 'Trabajo solicitado', dias: 365 }
  };
  const cfg = () => GIROS[enlace.giro()] || { equipo: 'Equipo', id: 'Serie o identificador', previo: 'Estado al recibirlo', problema: 'Problema o servicio', dias: 30 };
  const TIPO = { reparacion: 'Reparación', servicio: 'Servicio', garantia: 'Garantía de venta' }, ESTADO = { recibido: 'Recibido', en_proceso: 'En proceso', listo: 'Listo para entregar', entregado: 'Entregado', cancelado: 'Cancelado' };
  function h(tag, cls, txt, estilo){ const e = document.createElement(tag); if(cls) e.className = cls; if(txt != null) e.textContent = txt; if(estilo) e.style.cssText = estilo; return e; }
  function boton(txt, fn, cls, estilo){ const b = h('button', cls || 'texto', txt, 'width:auto; padding:7px 12px;' + (estilo || '')); b.type = 'button'; b.onclick = fn; return b; }
  function campo(et, el, ancho){ const w = h('label', null, et, 'display:flex; flex-direction:column; gap:4px; font-size:13px; font-weight:500;' + (ancho ? 'flex:1 1 ' + ancho + 'px;' : '')); w.appendChild(el); return w; }
  const input = (v, ph, max, tipo) => { const i = h('input', 'input-mini'); if(tipo) i.type = tipo; if(v != null && v !== '') i.value = v; if(ph) i.placeholder = ph; if(max) i.maxLength = max; return i; };
  const area = (max) => { const a = h('textarea', 'input-mini'); a.rows = 2; a.maxLength = max; a.style.width = '100%'; return a; };
  const sel = (ops) => { const s = h('select', 'input-mini'); ops.forEach(([v, t]) => { const o = h('option', null, t); o.value = v; s.appendChild(o); }); return s; };
  const folio = (n) => 'O-' + String(n).padStart(4, '0');
  const fechaL = (f) => f ? new Date((String(f).length > 10 ? f : f + 'T12:00:00')).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  const msg = (z, t, ok) => { z.textContent = t; z.style.cssText = 'font-size:13px; margin:8px 0; color:' + (ok ? '#16a34a' : 'var(--error,#b91c1c)') + ';'; };
  function errTxt(e){ const m = (e && e.message) || String(e); return /does not exist|schema cache|Could not find/i.test(m) ? 'Falta ejecutar el script SQL 115 (y el 138 para técnico, cajón, renglones, inspección y eficiencia) en Supabase.' : m; }
  async function rpc(f, a){ const r = await enlace.sb.rpc(f, a); if(r.error) throw r.error; return r.data; }
  function wa(tel, texto){ const d = String(tel || '').replace(/\D/g, ''), n = d.length === 10 ? '52' + d : d; window.open('https://wa.me/' + (n.length >= 11 ? n : '') + '?text=' + encodeURIComponent(texto), '_blank', 'noopener'); }
  let raiz = null, filtro = 'abiertas', q = '', nombreNeg = null;
  async function negocio(){ if(nombreNeg) return nombreNeg; try { const id = enlace.negocioId(); if(id){ const r = await enlace.sb.from('negocios').select('nombre').eq('id', id).maybeSingle(); if(r.data && r.data.nombre) nombreNeg = r.data.nombre; } } catch(e){} return nombreNeg || 'Mi negocio'; }

  // PDF tipo ticket 80 mm: orden de recepción o certificado de garantía
  function dibujar(doc, d, nom, medir){
    const W = 226, M = 14, A = W - M * 2; let y = 24;
    const txt = (t, o) => { o = o || {}; doc.setFont('helvetica', o.b ? 'bold' : 'normal'); doc.setFontSize(o.s || 8.5); doc.splitTextToSize(String(t), A).forEach((l) => { if(!medir) doc.text(l, o.c ? W / 2 : M, y, o.c ? { align: 'center' } : undefined); y += (o.s || 8.5) + 3; }); };
    const raya = () => { if(!medir){ doc.setDrawColor(180); doc.line(M, y - 4, W - M, y - 4); } y += 4; };
    const gar = d.tipo === 'garantia' || (d.garantia_hasta && d.estado === 'entregado');
    txt(nom, { b: 1, s: 12, c: 1 }); txt(d.tipo === 'garantia' ? 'CERTIFICADO DE GARANTÍA' : gar ? 'COMPROBANTE DE ENTREGA Y GARANTÍA' : 'ORDEN DE ' + (d.tipo === 'servicio' ? 'SERVICIO' : 'REPARACIÓN'), { b: 1, c: 1 });
    txt(folio(d.folio) + ' · ' + fechaL(d.creado), { c: 1 }); raya();
    txt('Cliente: ' + d.cliente, { b: 1 }); if(d.telefono) txt('Tel: ' + d.telefono); txt((cfg().equipo.split(' (')[0]) + ': ' + d.equipo); if(d.identificador) txt('Serie/placa: ' + d.identificador); raya();
    if(d.problema) txt('Motivo: ' + d.problema); if(d.estado_previo && d.tipo !== 'garantia') txt('Estado al recibirlo: ' + d.estado_previo); if(d.promesa) txt('Fecha prometida: ' + fechaL(d.promesa));
    if(Number(d.costo) > 0) txt((d.tipo === 'garantia' ? 'Valor: ' : 'Costo: ') + enlace.dinero(d.costo), { b: 1 });
    if(d.garantia_hasta) txt('GARANTÍA: ' + d.garantia_dias + ' días, válida hasta el ' + fechaL(d.garantia_hasta), { b: 1 }); raya();
    txt(d.tipo === 'garantia' ? 'Presenta este documento para hacer válida la garantía. No cubre golpes, humedad ni mal uso.' : 'Presenta este folio para recoger. Revisa el equipo al recibirlo. No es comprobante fiscal.', { s: 7, c: 1 });
    return y + 14;
  }
  async function pdf(d){
    if(typeof window.jspdf === 'undefined'){ alert('No se pudo generar el PDF. Revisa tu conexión e inténtalo de nuevo.'); return; }
    const { jsPDF } = window.jspdf, nom = await negocio(), alto = dibujar(new jsPDF({ unit: 'pt', format: [226, 900] }), d, nom, true);
    const doc = new jsPDF({ unit: 'pt', format: [226, Math.max(200, alto)] }); dibujar(doc, d, nom, false); doc.save((d.tipo === 'garantia' ? 'Garantia-' : 'Orden-') + folio(d.folio) + '.pdf');
  }

  function abrir(){ raiz = raiz || document.getElementById('seccionOrdenes'); if(raiz) lista(); }
  async function lista(){
    raiz.textContent = ''; const cab = h('div', null, null, 'display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-bottom:12px;');
    cab.appendChild(h('h2', null, 'Órdenes y garantías', 'margin:0; flex:1 1 auto;')); cab.appendChild(boton('+ Nueva orden', () => nueva('reparacion'), 'principal', 'padding:9px 14px;')); cab.appendChild(boton('+ Garantía de venta', () => nueva('garantia'))); raiz.appendChild(cab);
    const barra = h('div', null, null, 'display:flex; gap:8px; flex-wrap:wrap; margin-bottom:10px;');
    [['abiertas', 'Abiertas'], ['garantias', 'Garantías vigentes'], ['todas', 'Todas']].forEach(([v, t]) => barra.appendChild(boton(t, () => { filtro = v; lista(); }, 'texto' + (filtro === v ? ' activo' : ''))));
    barra.appendChild(boton('Tablero y fila', tablero)); barra.appendChild(boton('Eficiencia', eficiencia)); raiz.appendChild(barra);
    const b = input(q, 'Buscar por cliente, equipo, serie, teléfono o folio…', 40); b.style.marginBottom = '10px'; let tm = 0; b.oninput = () => { clearTimeout(tm); tm = setTimeout(() => { q = b.value; cargar(z); }, 250); }; raiz.appendChild(b);
    const z = h('div'); raiz.appendChild(z); cargar(z);
  }
  async function cargar(z){
    z.textContent = '';
    try {
      const d = await rpc('ordenes_lista', { p_filtro: filtro, p_q: q || null }); if(!d.items.length){ z.appendChild(h('p', 'nota', q ? 'No encontré órdenes con esa búsqueda.' : 'No hay órdenes en esta vista.')); return; }
      d.items.forEach((x) => {
        const c = h('div', null, null, 'border:1px solid var(--borde); border-radius:10px; padding:12px; margin-bottom:10px; background:var(--superficie); cursor:pointer;'); c.tabIndex = 0; c.setAttribute('role', 'button');
        const t = h('div', null, null, 'display:flex; justify-content:space-between; gap:8px; flex-wrap:wrap;'); t.appendChild(h('strong', null, folio(x.folio) + ' · ' + x.equipo)); t.appendChild(h('span', 'nota', TIPO[x.tipo] + ' · ' + ESTADO[x.estado])); c.appendChild(t);
        c.appendChild(h('div', 'nota', x.cliente + (x.identificador ? ' · ' + x.identificador : '') + (x.promesa && x.estado !== 'entregado' ? ' · prometida ' + fechaL(x.promesa) : '') + (x.vigente ? ' · garantía hasta ' + fechaL(x.garantia_hasta) : '') + (x.tecnico ? ' · ' + x.tecnico : '') + (x.cajon ? ' · cajón ' + x.cajon : '')));
        c.onclick = () => detalle(x.id); c.onkeydown = (e) => { if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); detalle(x.id); } }; z.appendChild(c);
      });
    } catch(e){ msg(z, 'No se pudo cargar: ' + errTxt(e)); }
  }
  async function detalle(id){
    raiz.textContent = ''; raiz.appendChild(boton('← Volver', lista)); const z = h('div'); raiz.appendChild(z);
    let d; try { d = await rpc('orden_detalle', { p_id: id }); } catch(e){ msg(z, 'No se pudo cargar: ' + errTxt(e)); return; }
    z.appendChild(h('h2', null, folio(d.folio) + ' · ' + d.equipo, 'margin:10px 0 4px;')); z.appendChild(h('div', 'nota', TIPO[d.tipo] + ' · ' + ESTADO[d.estado] + ' · recibida ' + fechaL(d.creado)));
    [['Cliente', d.cliente + (d.telefono ? ' · ' + d.telefono : '')], [cfg().id, d.identificador], [cfg().problema, d.problema], ['Estado previo', d.estado_previo], ['Costo', Number(d.costo) > 0 ? enlace.dinero(d.costo) : null], ['Prometida', d.promesa ? fechaL(d.promesa) : null], ['Garantía', d.garantia_hasta ? d.garantia_dias + ' días, hasta ' + fechaL(d.garantia_hasta) : null], ['Notas', d.notas]]
      .filter((r) => r[1]).forEach((r) => { const f = h('div', null, null, 'font-size:14px; padding:3px 0;'); f.appendChild(h('strong', null, r[0] + ': ')); f.appendChild(document.createTextNode(r[1])); z.appendChild(f); });
    const ac = h('div', null, null, 'display:flex; gap:8px; flex-wrap:wrap; margin:12px 0;'); ac.appendChild(boton(d.tipo === 'garantia' ? 'Certificado PDF' : 'Orden / comprobante PDF', () => pdf(d)));
    if(d.estado === 'listo') ac.appendChild(boton('Avisar por WhatsApp', () => wa(d.telefono, 'Hola ' + d.cliente + ', tu ' + d.equipo + ' (folio ' + folio(d.folio) + ') ya está listo para recoger.' + (Number(d.costo) > 0 ? ' Total: ' + enlace.dinero(d.costo) + '.' : '')))); z.appendChild(ac);
    const est = h('div'); z.appendChild(est);
    if(d.tipo !== 'garantia') taller(z, d);
    if(!['entregado', 'cancelado'].includes(d.estado)){
      const caja = h('div', 'bloque-analitica', null, 'margin:10px 0;'); caja.appendChild(h('h3', null, 'Cambiar estado'));
      const s = sel(Object.keys(ESTADO).filter((k) => k !== d.estado && k !== 'recibido').map((k) => [k, ESTADO[k]])), nota = input('', 'Nota del avance (opcional)', 300), costo = input(Number(d.costo) > 0 ? d.costo : '', '', 10, 'number'), gar = input(d.garantia_dias || cfg().dias, '', 4, 'number');
      [costo, gar].forEach((i) => { i.min = '0'; i.step = 'any'; i.style.width = '110px'; }); const fg = campo('Días de garantía al entregar', gar, 150);
      const aj = () => { fg.style.display = s.value === 'entregado' ? '' : 'none'; }; s.onchange = aj; aj();
      const fr = h('div', null, null, 'display:flex; gap:10px; flex-wrap:wrap; align-items:end;'); [campo('Nuevo estado', s, 180), campo('Nota', nota, 220), campo('Costo final $', costo, 110), fg].forEach((x) => fr.appendChild(x)); caja.appendChild(fr);
      const gb = boton('Guardar cambio', async () => { gb.disabled = true; try { await rpc('orden_estado', { p_id: d.id, p_estado: s.value, p_nota: nota.value.trim() || null, p_costo: costo.value !== '' ? Number(costo.value) : null, p_garantia_dias: s.value === 'entregado' ? Math.round(Number(gar.value)) || 0 : null }); detalle(d.id); } catch(e){ gb.disabled = false; msg(est, errTxt(e)); } }, 'principal', 'margin-top:10px;');
      caja.appendChild(gb); z.appendChild(caja);
    }
    z.appendChild(h('h3', null, 'Historial')); d.historial.forEach((x) => z.appendChild(h('div', null, new Date(x.cuando).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }) + ' · ' + ESTADO[x.estado] + (x.nota ? ' · ' + x.nota : ''), 'font-size:14px; padding:4px 0; border-top:1px solid var(--borde);')));
  }
  // ---------- Taller (SQL 138) ----------
  const SEM = { ok: ['Bien', '#16a34a'], pronto: ['Atender pronto', '#d97706'], urgente: ['Urgente', '#dc2626'] };
  const PUNTOS = ['Frenos', 'Llantas', 'Suspensión', 'Aceite y filtros', 'Batería', 'Luces', 'Bandas y mangueras', 'Líquidos'];
  const hrs = (n) => (Math.round(Number(n) * 10) / 10) + ' h';
  const minTxt = (ms) => { const m = Math.max(0, Math.round(ms / 60000)); return m < 60 ? m + ' min' : Math.floor(m / 60) + ' h ' + (m % 60) + ' min'; };
  function taller(z, d){
    const cerrada = ['entregado', 'cancelado'].includes(d.estado), est = h('div');
    const caja = h('div', 'bloque-analitica', null, 'margin:10px 0;'); caja.appendChild(h('h3', null, 'Trabajo en el taller'));
    const tec = input(d.tecnico || '', 'Quién lo atiende', 60), caj = input(d.cajon || '', 'Ej. Cajón 2, Rampa A', 30), hor = input(d.horas_estimadas || '', 'Ej. 2.5', 6, 'number'); hor.min = '0'; hor.step = '0.25';
    const f = h('div', null, null, 'display:flex; gap:10px; flex-wrap:wrap;'); [campo('Técnico o mecánico', tec, 200), campo('Cajón o lugar', caj, 160), campo('Horas estimadas', hor, 120)].forEach((x) => f.appendChild(x)); caja.appendChild(f);
    if(d.inicio) caja.appendChild(h('div', 'nota', 'Empezó ' + new Date(d.inicio).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }) + (d.listo ? ' · quedó listo ' + new Date(d.listo).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }) + ' (' + minTxt(new Date(d.listo) - new Date(d.inicio)) + ')' : ''), 'margin-top:6px;'));
    // Inspección con semáforo
    caja.appendChild(h('h4', null, 'Inspección', 'margin:14px 0 4px;')); const zi = h('div'); caja.appendChild(zi); let ins = (d.inspeccion || []).map((x) => ({ punto: x.punto, estado: x.estado, nota: x.nota || '' }));
    const pintaIns = () => { zi.textContent = '';
      ins.forEach((x, i) => { const r = h('div', null, null, 'display:flex; gap:8px; flex-wrap:wrap; align-items:center; margin-bottom:6px;'), p = h('strong', null, x.punto, 'flex:1 1 130px;'), nt = input(x.nota, 'Nota (opcional)', 120); nt.style.flex = '2 1 160px'; nt.oninput = () => { x.nota = nt.value; }; nt.disabled = cerrada;
        const bs = h('div', null, null, 'display:flex; gap:4px;'); Object.entries(SEM).forEach(([k, [t, c]]) => { const b = h('button', null, t, 'border-radius:8px; padding:5px 9px; font-size:12.5px; cursor:pointer; border:2px solid ' + c + '; font-weight:700; ' + (x.estado === k ? 'background:' + c + '; color:#fff;' : 'background:transparent; color:' + c + ';')); b.type = 'button'; b.disabled = cerrada; b.setAttribute('aria-pressed', x.estado === k ? 'true' : 'false'); b.onclick = () => { x.estado = k; pintaIns(); }; bs.appendChild(b); });
        r.appendChild(p); r.appendChild(bs); r.appendChild(nt); if(!cerrada) r.appendChild(boton('Quitar', () => { ins.splice(i, 1); pintaIns(); })); zi.appendChild(r); });
      if(!cerrada){ const ya = new Set(ins.map((x) => x.punto)), ra = h('div', null, null, 'display:flex; gap:6px; flex-wrap:wrap; margin-top:4px;'); PUNTOS.filter((x) => !ya.has(x)).forEach((x) => ra.appendChild(boton('+ ' + x, () => { ins.push({ punto: x, estado: 'ok', nota: '' }); pintaIns(); }, 'texto', 'padding:3px 9px; font-size:12.5px;')));
        const otro = input('', 'Otro punto', 40); otro.style.width = '140px'; ra.appendChild(otro); ra.appendChild(boton('Agregar', () => { const v = otro.value.trim(); if(v && ins.length < 30 && !ya.has(v)){ ins.push({ punto: v, estado: 'ok', nota: '' }); pintaIns(); } }, 'texto', 'padding:3px 9px; font-size:12.5px;')); zi.appendChild(ra); }
      if(!ins.length && cerrada) zi.appendChild(h('p', 'nota', 'Sin inspección registrada.')); };
    pintaIns();
    if(!cerrada) caja.appendChild(boton('Guardar técnico, cajón e inspección', async () => { try { await rpc('orden_taller_guardar', { p_id: d.id, p_tecnico: tec.value.trim(), p_cajon: caj.value.trim(), p_horas: hor.value !== '' ? Number(hor.value) : null, p_inspeccion: ins.map((x) => ({ punto: x.punto, estado: x.estado, nota: x.nota.trim() })) }); msg(est, 'Guardado.', true); } catch(e){ msg(est, errTxt(e)); } }, 'principal', 'margin-top:10px;'));
    if(ins.some((x) => x.estado !== 'ok') ) caja.appendChild(boton('Enviar inspección por WhatsApp', () => wa(d.telefono, 'Hola ' + d.cliente + ', esto encontramos en tu ' + d.equipo + ' (folio ' + folio(d.folio) + '):\n' + ins.map((x) => '• ' + x.punto + ': ' + SEM[x.estado][0] + (x.nota ? ' (' + x.nota + ')' : '')).join('\n')), 'texto', 'margin:10px 0 0 8px;'));
    // Mano de obra y refacciones
    caja.appendChild(h('h4', null, 'Mano de obra y refacciones', 'margin:16px 0 4px;')); const L = d.lineas || []; let tmo = 0, trf = 0; L.forEach((l) => { const t = Number(l.cantidad) * Number(l.precio); if(l.tipo === 'mano_obra') tmo += t; else trf += t; });
    if(L.length){ const t = h('div', 'envoltura-tabla'), tb = h('table'), hd = h('tr'); ['Tipo', 'Concepto', 'Cant.', 'Precio', 'Importe', ''].forEach((c) => hd.appendChild(h('th', null, c))); const th = h('thead'); th.appendChild(hd); tb.appendChild(th); const bd = h('tbody');
      L.forEach((l) => { const tr = h('tr'); [l.tipo === 'mano_obra' ? 'Mano de obra' : 'Refacción', l.concepto + (l.producto ? ' (inventario: ' + l.producto + ')' : ''), String(Number(l.cantidad)), enlace.dinero(l.precio), enlace.dinero(Number(l.cantidad) * Number(l.precio))].forEach((c) => tr.appendChild(h('td', null, c))); const td = h('td'); if(!cerrada) td.appendChild(boton('Quitar', async () => { try { await rpc('orden_linea_quitar', { p_id: l.id }); detalle(d.id); } catch(e){ msg(est, errTxt(e)); } })); tr.appendChild(td); bd.appendChild(tr); }); tb.appendChild(bd); t.appendChild(tb); caja.appendChild(t);
      caja.appendChild(h('div', null, 'Mano de obra ' + enlace.dinero(tmo) + ' · Refacciones ' + enlace.dinero(trf) + ' · Total ' + enlace.dinero(tmo + trf), 'font-weight:700; margin-top:6px;')); }
    else caja.appendChild(h('p', 'nota', 'Todavía no hay renglones.'));
    if(!cerrada){ const tp = sel([['mano_obra', 'Mano de obra'], ['refaccion', 'Refacción']]), co = input('', 'Concepto', 120), ca = input('1', '', 8, 'number'), pr = input('', '$', 10, 'number'), pl = enlace.productos ? enlace.productos() : []; [ca, pr].forEach((i) => { i.min = '0'; i.step = 'any'; i.style.width = '90px'; });
      const lp = h('datalist'); lp.id = 'dlRefOrden'; pl.slice(0, 400).forEach((x) => { const o = h('option'); o.value = x.nombre; lp.appendChild(o); }); co.setAttribute('list', 'dlRefOrden'); co.onchange = () => { const x = pl.find((y) => y.nombre === co.value); if(x && !(Number(pr.value) > 0)) pr.value = x.precio; tp.value = x ? 'refaccion' : tp.value; };
      const fr = h('div', null, null, 'display:flex; gap:8px; flex-wrap:wrap; align-items:flex-end; margin-top:8px;'); [campo('Tipo', tp, 140), campo('Concepto o producto', co, 220), campo('Cantidad', ca, 90), campo('Precio $', pr, 100)].forEach((x) => fr.appendChild(x)); caja.appendChild(lp);
      fr.appendChild(boton('Agregar renglón', async () => { const x = pl.find((y) => y.nombre === co.value.trim()); try { await rpc('orden_linea_agregar', { p_orden: d.id, p_tipo: tp.value, p_concepto: co.value.trim(), p_cantidad: Number(ca.value), p_precio: Number(pr.value) || 0, p_producto: tp.value === 'refaccion' && x ? x.id : null }); detalle(d.id); } catch(e){ msg(est, errTxt(e)); } }, 'principal')); caja.appendChild(fr);
      if(L.length) caja.appendChild(boton('Usar el total como costo de la orden', async () => { try { await rpc('orden_usar_total', { p_id: d.id }); detalle(d.id); } catch(e){ msg(est, errTxt(e)); } }, 'texto', 'margin-top:8px;'));
      caja.appendChild(h('p', 'nota', 'Los renglones son informativos: no cobran ni descuentan existencias. El cobro y la salida del inventario se hacen en la caja.')); }
    caja.appendChild(est); z.appendChild(caja);
  }
  async function tablero(){
    raiz.textContent = ''; raiz.appendChild(boton('← Volver', lista)); raiz.appendChild(h('h2', null, 'Tablero y fila', 'margin:10px 0 4px;')); raiz.appendChild(h('p', 'nota', 'Órdenes abiertas por cajón y la fila de las que esperan turno (las «Recibido», de la más antigua a la más nueva). Asigna el cajón y el técnico dentro de cada orden.')); const z = h('div'); raiz.appendChild(z);
    let d; try { d = await rpc('ordenes_lista', { p_filtro: 'abiertas', p_q: null }); } catch(e){ msg(z, errTxt(e)); return; } const ahora = new Date(d.ahora || Date.now()).getTime(), it = d.items;
    if(!it.length){ z.appendChild(h('p', 'nota', 'No hay órdenes abiertas.')); return; }
    const fila = it.filter((x) => x.estado === 'recibido').sort((a, b) => new Date(a.creado_en) - new Date(b.creado_en)); z.appendChild(h('h3', null, 'Fila de espera (' + fila.length + ')', 'margin:10px 0 6px;'));
    if(!fila.length) z.appendChild(h('p', 'nota', 'Nadie espera turno.')); fila.forEach((x, i) => { const c = h('div', null, null, 'border:1px solid var(--borde); border-radius:10px; padding:8px 12px; margin-bottom:6px; cursor:pointer;'); c.appendChild(h('strong', null, (i + 1) + '. ' + folio(x.folio) + ' · ' + x.equipo)); c.appendChild(h('span', 'nota', ' — espera ' + minTxt(ahora - new Date(x.creado_en).getTime()) + (x.promesa ? ' · prometida ' + fechaL(x.promesa) : '')));  c.onclick = () => detalle(x.id); z.appendChild(c); });
    z.appendChild(h('h3', null, 'Por cajón', 'margin:16px 0 6px;')); const g = {}; it.filter((x) => x.estado !== 'recibido' || x.cajon).forEach((x) => { (g[x.cajon || 'Sin cajón'] = g[x.cajon || 'Sin cajón'] || []).push(x); });
    const claves = Object.keys(g).sort((a, b) => a === 'Sin cajón' ? 1 : b === 'Sin cajón' ? -1 : a.localeCompare(b, 'es', { numeric: true })); if(!claves.length) z.appendChild(h('p', 'nota', 'Ninguna orden en proceso.'));
    claves.forEach((k) => { const b = h('div', 'bloque-analitica', null, 'margin-bottom:10px;'); b.appendChild(h('h4', null, k, 'margin:0 0 6px;')); g[k].forEach((x) => { const r = h('div', null, null, 'display:flex; gap:8px; flex-wrap:wrap; justify-content:space-between; padding:4px 0; cursor:pointer; border-top:1px solid var(--borde);'); r.appendChild(h('span', null, folio(x.folio) + ' · ' + x.equipo + (x.tecnico ? ' · ' + x.tecnico : ''))); r.appendChild(h('span', 'nota', ESTADO[x.estado] + (x.inicio ? ' · lleva ' + minTxt(ahora - new Date(x.inicio).getTime()) + (x.horas_estimadas ? ' de ' + hrs(x.horas_estimadas) + ' estimadas' : '') : ''))); r.onclick = () => detalle(x.id); b.appendChild(r); }); z.appendChild(b); });
  }
  async function eficiencia(){
    raiz.textContent = ''; raiz.appendChild(boton('← Volver', lista)); raiz.appendChild(h('h2', null, 'Eficiencia del taller', 'margin:10px 0 4px;')); raiz.appendChild(h('p', 'nota', 'Por técnico: órdenes que quedaron listas en el periodo y cuánto tardaron, de «En proceso» a «Listo». Es tiempo de reloj, no horas trabajadas: si una orden esperó una pieza, cuenta. La eficiencia compara horas estimadas contra reales (100% = justo a tiempo, más es más rápido). Solo cuentan las órdenes con técnico y con horas estimadas.'));
    const per = sel([['30', 'Últimos 30 días'], ['90', 'Últimos 90 días'], ['180', 'Últimos 180 días']]), z = h('div'); raiz.appendChild(campo('Periodo', per, 180)); raiz.appendChild(z);
    const carga = async () => { z.textContent = ''; try { const l = await rpc('taller_eficiencia', { p_dias: Number(per.value) }); if(!l.length){ z.appendChild(h('p', 'nota', 'Todavía no hay órdenes terminadas con tiempos en este periodo.')); return; }
      const t = h('div', 'envoltura-tabla'), tb = h('table'), hd = h('tr'); ['Técnico', 'Órdenes', 'Horas por orden', 'Horas estimadas', 'Eficiencia', 'Mano de obra', 'Refacciones'].forEach((c) => hd.appendChild(h('th', null, c))); const th = h('thead'); th.appendChild(hd); tb.appendChild(th); const bd = h('tbody');
      l.forEach((x) => { const tr = h('tr'); [x.tecnico, String(x.ordenes), hrs(x.horas_reales), x.con_estimado ? hrs(x.horas_estimadas) + ' (' + x.con_estimado + ' órdenes)' : '—', x.eficiencia == null ? '—' : x.eficiencia + '%', enlace.dinero(x.mano_obra), enlace.dinero(x.refacciones)].forEach((c, i) => { const td = h('td', null, c); if(i === 0) td.style.fontWeight = '600'; tr.appendChild(td); }); bd.appendChild(tr); }); tb.appendChild(bd); t.appendChild(tb); z.appendChild(t); } catch(e){ msg(z, errTxt(e)); } };
    per.onchange = carga; carga();
  }
  function nueva(tipo){
    raiz.textContent = ''; raiz.appendChild(boton('← Volver', lista)); const c = cfg(), gar = tipo === 'garantia'; raiz.appendChild(h('h2', null, gar ? 'Registrar garantía de venta' : 'Nueva orden', 'margin:10px 0;'));
    const cli = input('', '', 80), tel = input('', 'Opcional', 20, 'tel'), eq = input('', '', 100), idn = input('', 'Opcional', 60), pr = area(500), ep = area(500), co = input('', '', 10, 'number'), pm = input('', '', 10, 'date'), gd = input(gar ? c.dias : '', '', 4, 'number'), nt = input('', 'Opcional', 500), ts = sel([['reparacion', 'Reparación'], ['servicio', 'Servicio']]);
    [co, gd].forEach((i) => { i.min = '0'; i.step = 'any'; });
    const fr = h('div', null, null, 'display:flex; gap:10px; flex-wrap:wrap; margin-bottom:10px;');
    [!gar && campo('Tipo', ts, 150), campo('Cliente', cli, 200), campo('Teléfono', tel, 140), campo(c.equipo, eq, 220), campo(c.id, idn, 180), campo(gar ? 'Valor de la venta $' : 'Costo estimado $', co, 120), !gar && campo('Fecha prometida', pm, 150), campo(gar ? 'Días de garantía' : 'Días de garantía al entregar', gd, 130), campo('Notas', nt, 220)].filter(Boolean).forEach((x) => fr.appendChild(x)); raiz.appendChild(fr);
    raiz.appendChild(campo(gar ? 'Qué cubre / observaciones' : c.problema, pr)); if(!gar) raiz.appendChild(campo(c.previo, ep));
    const est = h('div'), gb = boton('Guardar', async () => {
      gb.disabled = true; msg(est, 'Guardando…', true);
      try { const r = await rpc('orden_crear', { p_tipo: gar ? 'garantia' : ts.value, p_cliente: cli.value.trim(), p_telefono: tel.value.trim() || null, p_equipo: eq.value.trim(), p_identificador: idn.value.trim() || null, p_problema: pr.value.trim() || null, p_estado_previo: gar ? null : (ep.value.trim() || null),
          p_costo: Number(co.value) || 0, p_promesa: gar ? null : (pm.value || null), p_garantia_dias: Math.round(Number(gd.value)) || 0, p_notas: nt.value.trim() || null }); detalle(r.id); }
      catch(e){ gb.disabled = false; msg(est, errTxt(e)); }
    }, 'principal', 'padding:9px 14px; margin-top:10px;'); raiz.appendChild(gb); raiz.appendChild(est);
  }
  window.PuveOrdenes = { enlazar(o){ enlace = Object.assign(enlace, o || {}); }, abrir };
})();
