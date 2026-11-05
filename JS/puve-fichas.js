/* PUVE - Fichas con historial (menú "Fichas"): cliente, mascota, pieza o vehículo, con línea de tiempo de registros y próximos vencimientos.
 * Los datos salen y entran por funciones del servidor (ficha_guardar, fichas_buscar, ficha_detalle, ficha_evento_agregar, fichas_proximos...).
 * Los recordatorios por WhatsApp los manda quien atiende, a mano, a quien dio su teléfono.
 */
(function(){
  'use strict';
  let enlace = { sb: null, giro: () => null };
  const E = (t, o) => Object.assign({ t }, o || {});
  const GIROS = {
    estetica: { tipo: 'persona', et: 'Cliente', plural: 'Clientes', campos: ['Alergias', 'Color o tinte', 'Tipo de piel o cabello', 'Preferencias', 'Cumpleaños'], ev: [E('Servicio'), E('Producto vendido'), E('Nota')] },
    veterinarias: { tipo: 'mascota', et: 'Mascota', plural: 'Mascotas', campos: ['Especie', 'Raza', 'Sexo', 'Nacimiento', 'Dueño', 'Alergias'], ev: [E('Peso', { unidad: 'kg', valor: 1 }), E('Vacuna', { prox: 1 }), E('Desparasitación', { prox: 1 }), E('Consulta'), E('Nota')] },
    joyeria: { tipo: 'pieza', et: 'Pieza', plural: 'Piezas', campos: ['Material', 'Quilates o ley', 'Peso (g)', 'Proveedor', 'Costo', 'Certificado'], ev: [E('Nota'), E('Reparación'), E('Venta')] },
    refaccionarias: { tipo: 'vehiculo', et: 'Vehículo', plural: 'Vehículos', campos: ['Placa', 'Marca', 'Modelo', 'Año', 'Color', 'Kilometraje', 'Dueño'], ev: [E('Servicio', { prox: 1 }), E('Refacción'), E('Estado previo'), E('Nota')] },
    carnicerias: { tipo: 'persona', et: 'Cliente', plural: 'Clientes', campos: ['Cortes favoritos', 'Alergias o restricciones', 'Cómo lo prefiere'], ev: [E('Pedido'), E('Nota')] },
    regalos: { tipo: 'persona', et: 'Persona', plural: 'Personas', campos: ['Gustos', 'Talla', 'Presupuesto usual'], ev: [E('Ocasión', { prox: 1 }), E('Regalo'), E('Nota')] }
  };
  GIROS.talleres = Object.assign({}, GIROS.refaccionarias);
  const cfg = () => GIROS[enlace.giro()] || { tipo: 'persona', et: 'Cliente', plural: 'Clientes', campos: ['Preferencias', 'Alergias'], ev: [E('Nota')] };
  function h(tag, cls, txt, estilo){ const e = document.createElement(tag); if(cls) e.className = cls; if(txt != null) e.textContent = txt; if(estilo) e.style.cssText = estilo; return e; }
  function boton(txt, fn, cls, estilo){ const b = h('button', cls || 'texto', txt, 'width:auto; padding:7px 12px;' + (estilo || '')); b.type = 'button'; b.onclick = fn; return b; }
  function campo(et, el, ancho){ const w = h('label', null, et, 'display:flex; flex-direction:column; gap:4px; font-size:13px; font-weight:500;' + (ancho ? 'flex:1 1 ' + ancho + 'px;' : '')); w.appendChild(el); return w; }
  const input = (v, ph, max) => { const i = h('input', 'input-mini'); if(v) i.value = v; if(ph) i.placeholder = ph; i.maxLength = max || 200; return i; };
  const hoy = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const fechaLinda = (f) => new Date(f + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
  const msg = (z, t, ok) => { z.textContent = t; z.style.cssText = 'font-size:13px; margin:8px 0; color:' + (ok ? '#16a34a' : 'var(--error,#b91c1c)') + ';'; };
  function errTxt(e){ const m = (e && e.message) || String(e); return /does not exist|schema cache|Could not find/i.test(m) ? 'Falta ejecutar el script SQL 113 en Supabase.' : m; }
  async function rpc(f, a){ const r = await enlace.sb.rpc(f, a); if(r.error) throw r.error; return r.data; }
  function wa(tel, texto){ const d = String(tel || '').replace(/\D/g, ''), n = d.length === 10 ? '52' + d : d; window.open('https://wa.me/' + (n.length >= 11 ? n : '') + '?text=' + encodeURIComponent(texto), '_blank', 'noopener'); }
  let raiz = null, q = '', verArchivadas = false;

  async function abrir(){
    raiz = raiz || document.getElementById('seccionFichas'); if(!raiz) return; raiz.textContent = ''; lista();
  }
  // ---- Lista + pendientes ----
  async function lista(){
    raiz.textContent = ''; const c = cfg(), cab = h('div', null, null, 'display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-bottom:12px;');
    cab.appendChild(h('h2', null, 'Fichas · ' + c.plural, 'margin:0; flex:1 1 auto;')); cab.appendChild(boton('+ Nueva ' + c.et.toLowerCase(), () => editar(null), 'principal', 'padding:9px 14px;')); raiz.appendChild(cab);
    const buscar = input(q, 'Buscar por nombre, teléfono o dato…', 40); buscar.style.marginBottom = '10px'; raiz.appendChild(buscar);
    const pend = h('div'), z = h('div'); raiz.appendChild(pend); raiz.appendChild(z);
    let tm = 0; buscar.oninput = () => { clearTimeout(tm); tm = setTimeout(() => { q = buscar.value; cargarLista(z); }, 250); };
    const fa = h('label', null, null, 'display:flex; gap:8px; align-items:center; font-size:13px; margin:6px 0;'), ck = h('input'); ck.type = 'checkbox'; ck.checked = verArchivadas; ck.style.cssText = 'width:18px; height:18px; margin:0;'; ck.onchange = () => { verArchivadas = ck.checked; cargarLista(z); };
    fa.appendChild(ck); fa.appendChild(document.createTextNode('Ver archivadas')); raiz.appendChild(fa);
    pendientes(pend); cargarLista(z);
  }
  async function pendientes(z){
    try {
      const d = await rpc('fichas_proximos', { p_dias: 30 }); if(!d.length) return;
      const caja = h('div', 'bloque-analitica', null, 'margin-bottom:14px;'); caja.appendChild(h('h3', null, 'Pendientes (vencidos y próximos 30 días) · ' + d.length));
      d.slice(0, 15).forEach((x) => {
        const f = h('div', null, null, 'display:flex; gap:8px; align-items:center; justify-content:space-between; flex-wrap:wrap; padding:6px 0; border-top:1px solid var(--borde);'), t = h('div', null, null, 'flex:1 1 200px; font-size:14px;');
        t.appendChild(h('strong', null, x.evento + ' · ' + x.ficha)); t.appendChild(h('div', 'nota', fechaLinda(x.proxima) + (x.dias < 0 ? ' · vencido hace ' + (-x.dias) + ' d' : x.dias === 0 ? ' · hoy' : ' · en ' + x.dias + ' d') + (x.texto ? ' · ' + x.texto : ''), x.dias < 0 ? 'color:#dc2626;' : '')); f.appendChild(t);
        const ac = h('div', null, null, 'display:flex; gap:6px;'); ac.appendChild(boton('Abrir', () => detalle(x.ficha_id)));
        const tel = x.telefono || (x.campos && (x.campos['Teléfono'] || x.campos['Telefono']));
        if(tel) ac.appendChild(boton('WhatsApp', () => wa(tel, 'Hola, te recordamos ' + x.evento.toLowerCase() + ' de ' + x.ficha + (x.texto ? ' (' + x.texto + ')' : '') + ' para el ' + fechaLinda(x.proxima) + '. ¡Cualquier duda, aquí estamos!'))); f.appendChild(ac); caja.appendChild(f);
      });
      z.appendChild(caja);
    } catch(e){ if(/SQL 113/.test(errTxt(e))) msg(z, errTxt(e)); }
  }
  async function cargarLista(z){
    z.textContent = '';
    try {
      const d = await rpc('fichas_buscar', { p_tipo: null, p_q: q || null, p_archivadas: verArchivadas });
      if(!d.length){ z.appendChild(h('p', 'nota', q ? 'No encontré fichas con esa búsqueda.' : 'Todavía no hay fichas. Crea la primera con el botón de arriba.')); return; }
      d.forEach((x) => {
        const f = h('div', null, null, 'border:1px solid var(--borde); border-radius:10px; padding:10px 12px; margin-bottom:8px; cursor:pointer; background:var(--superficie);'); f.tabIndex = 0; f.setAttribute('role', 'button');
        f.appendChild(h('strong', null, x.nombre)); const sub = Object.keys(x.campos || {}).slice(0, 3).map((k) => k + ': ' + x.campos[k]).join(' · ');
        f.appendChild(h('div', 'nota', [x.telefono, sub].filter(Boolean).join(' · ') || 'Sin datos todavía')); f.appendChild(h('div', 'nota', x.eventos + (x.eventos === 1 ? ' registro' : ' registros') + (x.ultima ? ' · último ' + fechaLinda(x.ultima) : '')));
        f.onclick = () => detalle(x.id); f.onkeydown = (e) => { if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); detalle(x.id); } }; z.appendChild(f);
      });
    } catch(e){ msg(z, 'No se pudo cargar: ' + errTxt(e)); }
  }
  // ---- Crear / editar ----
  function editar(f){
    raiz.textContent = ''; const c = cfg(), campos = Object.assign({}, f && f.campos);
    raiz.appendChild(boton('← Volver', () => f ? detalle(f.id) : lista())); raiz.appendChild(h('h2', null, f ? 'Editar ficha' : 'Nueva ' + c.et.toLowerCase(), 'margin:10px 0;'));
    const nom = input(f && f.nombre, 'Nombre', 80), tel = input(f && f.telefono, 'Teléfono (opcional)', 20); tel.type = 'tel';
    const g = h('div', null, null, 'display:flex; gap:10px; flex-wrap:wrap; margin-bottom:10px;'); g.appendChild(campo('Nombre', nom, 220)); g.appendChild(campo('Teléfono', tel, 160)); raiz.appendChild(g);
    const dg = h('div', null, null, 'display:flex; gap:10px; flex-wrap:wrap;'); const filas = [];
    const nombres = c.campos.concat(Object.keys(campos).filter((k) => c.campos.indexOf(k) < 0));
    function fila(k, v){ const i = input(v, '', 200); filas.push([k, i]); dg.appendChild(campo(k, i, 200)); }
    nombres.forEach((k) => fila(k, campos[k])); raiz.appendChild(dg);
    const ex = h('div', null, null, 'display:flex; gap:8px; align-items:end; flex-wrap:wrap; margin:10px 0;'), nk = input('', 'Otro dato (ej. Alergia a…)', 40), nv = input('', 'Valor', 200);
    ex.appendChild(nk); ex.appendChild(nv); ex.appendChild(boton('Agregar dato', () => { const k = nk.value.trim(); if(!k) return; if(filas.some((x) => x[0] === k)) return; fila(k, nv.value); nk.value = ''; nv.value = ''; })); raiz.appendChild(ex);
    const notas = h('textarea', 'input-mini'); notas.rows = 3; notas.maxLength = 1000; notas.value = (f && f.notas) || ''; notas.style.width = '100%'; raiz.appendChild(campo('Notas', notas));
    const est = h('div'), gb = boton('Guardar ficha', async () => {
      if(!nom.value.trim()) return msg(est, 'Escribe el nombre.');
      const o = {}; filas.forEach(([k, i]) => { if(i.value.trim()) o[k] = i.value.trim(); }); gb.disabled = true; msg(est, 'Guardando…', true);
      try { const id = await rpc('ficha_guardar', { p_id: f ? f.id : null, p_tipo: f ? f.tipo : c.tipo, p_nombre: nom.value.trim(), p_telefono: tel.value.trim() || null, p_campos: o, p_notas: notas.value.trim() || null }); detalle(id); }
      catch(e){ gb.disabled = false; msg(est, errTxt(e)); }
    }, 'principal', 'padding:9px 14px; margin-top:10px;'); raiz.appendChild(gb); raiz.appendChild(est);
  }
  // ---- Detalle e historial ----
  function grafica(pts, unidad){
    if(pts.length < 2) return null; const W = 300, H = 70, xs = pts.map((p) => new Date(p.fecha).getTime()), ys = pts.map((p) => Number(p.valor)), x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    const px = (x) => x1 === x0 ? W / 2 : 8 + (x - x0) / (x1 - x0) * (W - 16), py = (y) => y1 === y0 ? H / 2 : H - 8 - (y - y0) / (y1 - y0) * (H - 16), ns = 'http://www.w3.org/2000/svg';
    const s = document.createElementNS(ns, 'svg'); s.setAttribute('viewBox', '0 0 ' + W + ' ' + H); s.setAttribute('role', 'img'); s.setAttribute('aria-label', 'Gráfica de ' + unidad); s.style.cssText = 'width:100%; max-width:340px; height:auto;';
    const pl = document.createElementNS(ns, 'polyline'); pl.setAttribute('points', pts.map((p, i) => px(xs[i]) + ',' + py(ys[i])).join(' ')); pl.setAttribute('fill', 'none'); pl.setAttribute('stroke', '#2563EB'); pl.setAttribute('stroke-width', '2'); s.appendChild(pl);
    pts.forEach((p, i) => { const c = document.createElementNS(ns, 'circle'); c.setAttribute('cx', px(xs[i])); c.setAttribute('cy', py(ys[i])); c.setAttribute('r', 3); c.setAttribute('fill', '#2563EB'); s.appendChild(c); }); return s;
  }
  async function detalle(id){
    raiz.textContent = ''; const z = h('div'); raiz.appendChild(z);
    let f; try { f = await rpc('ficha_detalle', { p_id: id }); } catch(e){ raiz.appendChild(boton('← Volver', lista)); msg(z, 'No se pudo cargar: ' + errTxt(e)); return; }
    const c = cfg(); z.appendChild(boton('← Volver', lista));
    const cab = h('div', null, null, 'display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin:10px 0;'); cab.appendChild(h('h2', null, f.nombre, 'margin:0; flex:1 1 auto;'));
    cab.appendChild(boton('Editar', () => editar(f))); cab.appendChild(boton(f.archivada ? 'Restaurar' : 'Archivar', async () => { try { await rpc('ficha_archivar', { p_id: f.id, p_archivada: !f.archivada }); lista(); } catch(e){ msg(est, errTxt(e)); } })); z.appendChild(cab);
    const est = h('div'); z.appendChild(est);
    if(f.telefono) z.appendChild(h('div', 'nota', 'Tel: ' + f.telefono));
    Object.keys(f.campos || {}).forEach((k) => { const r = h('div', null, null, 'font-size:14px; padding:3px 0;'); r.appendChild(h('strong', null, k + ': ')); r.appendChild(document.createTextNode(f.campos[k])); z.appendChild(r); });
    if(f.notas) z.appendChild(h('div', 'nota', 'Notas: ' + f.notas, 'margin-top:6px;'));
    // nuevo registro
    const caja = h('div', 'bloque-analitica', null, 'margin:16px 0;'); caja.appendChild(h('h3', null, 'Agregar registro'));
    const tipo = h('select', 'input-mini'); c.ev.forEach((e) => { const o = h('option', null, e.t); o.value = e.t; tipo.appendChild(o); });
    const fec = input(hoy(), '', 10); fec.type = 'date'; fec.max = hoy(); const tx = input('', 'Detalle (opcional)', 500), val = input('', '', 12); val.type = 'number'; val.step = 'any', val.style.width = '110px';
    const un = input('', 'unidad', 10); un.style.width = '80px'; const prox = input('', '', 10); prox.type = 'date';
    const fv = campo('Valor', val), fu = campo('Unidad', un), fp = campo('Próxima fecha (opcional)', prox, 160);
    const fr = h('div', null, null, 'display:flex; gap:10px; flex-wrap:wrap; align-items:end;'); [campo('Tipo', tipo, 150), campo('Fecha', fec, 140), campo('Detalle', tx, 220), fv, fu, fp].forEach((x) => fr.appendChild(x));
    const spec = () => c.ev.find((e) => e.t === tipo.value) || {}; const ajusta = () => { const s = spec(); fv.style.display = fu.style.display = s.valor ? '' : 'none'; if(s.unidad) un.value = s.unidad; }; tipo.onchange = ajusta; ajusta();
    const est2 = h('div'); const gb = boton('Guardar registro', async () => {
      const s = spec(); gb.disabled = true; msg(est2, 'Guardando…', true);
      try { await rpc('ficha_evento_agregar', { p_ficha_id: f.id, p_fecha: fec.value, p_tipo: tipo.value, p_texto: tx.value.trim() || null, p_valor: s.valor && val.value !== '' ? Number(val.value) : null, p_unidad: s.valor ? (un.value.trim() || null) : null, p_proxima: prox.value || null }); detalle(f.id); }
      catch(e){ gb.disabled = false; msg(est2, errTxt(e)); }
    }, 'principal', 'padding:9px 14px; margin-top:10px;'); caja.appendChild(fr); caja.appendChild(gb); caja.appendChild(est2); z.appendChild(caja);
    // peso
    const pesos = f.eventos.filter((e) => e.valor != null && e.tipo === 'Peso').reverse(); if(pesos.length >= 2){ const gr = grafica(pesos, pesos[0].unidad || 'kg'); if(gr){ const b = h('div', 'bloque-analitica', null, 'margin-bottom:14px;'); b.appendChild(h('h3', null, 'Historial de peso (' + (pesos[0].unidad || 'kg') + ')')); b.appendChild(gr); b.appendChild(h('p', 'nota', pesos.map((p) => fechaLinda(p.fecha) + ': ' + p.valor).slice(-6).join(' · '))); z.appendChild(b); } }
    // línea de tiempo
    z.appendChild(h('h3', null, 'Historial (' + f.eventos.length + ')'));
    if(!f.eventos.length) z.appendChild(h('p', 'nota', 'Aún no hay registros.'));
    f.eventos.forEach((e) => {
      const r = h('div', null, null, 'display:flex; gap:8px; justify-content:space-between; align-items:flex-start; padding:8px 0; border-top:1px solid var(--borde);'), t = h('div', null, null, 'font-size:14px; flex:1;');
      t.appendChild(h('strong', null, e.tipo)); t.appendChild(document.createTextNode(' · ' + fechaLinda(e.fecha) + (e.valor != null ? ' · ' + e.valor + ' ' + (e.unidad || '') : ''))); if(e.texto) t.appendChild(h('div', null, e.texto)); if(e.proxima) t.appendChild(h('div', 'nota', 'Próxima: ' + fechaLinda(e.proxima)));
      r.appendChild(t); r.appendChild(boton('Borrar', async () => { if(!window.confirm('¿Borrar este registro?')) return; try { await rpc('ficha_evento_borrar', { p_evento_id: e.id }); detalle(f.id); } catch(er){ msg(est, errTxt(er)); } })); z.appendChild(r);
    });
  }
  window.PuveFichas = { enlazar(o){ enlace = Object.assign(enlace, o || {}); }, abrir };
})();
