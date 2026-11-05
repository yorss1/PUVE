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
  function errTxt(e){ const m = (e && e.message) || String(e); return /does not exist|schema cache|Could not find/i.test(m) ? 'Falta ejecutar el script SQL 115 en Supabase.' : m; }
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
    [['abiertas', 'Abiertas'], ['garantias', 'Garantías vigentes'], ['todas', 'Todas']].forEach(([v, t]) => barra.appendChild(boton(t, () => { filtro = v; lista(); }, 'texto' + (filtro === v ? ' activo' : '')))); raiz.appendChild(barra);
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
        c.appendChild(h('div', 'nota', x.cliente + (x.identificador ? ' · ' + x.identificador : '') + (x.promesa && x.estado !== 'entregado' ? ' · prometida ' + fechaL(x.promesa) : '') + (x.vigente ? ' · garantía hasta ' + fechaL(x.garantia_hasta) : '')));
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
