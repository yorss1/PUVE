/* PUVE - Bonos y membresías (menú "Bonos"): paquetes prepagados (sesiones, lavados, kilos) y membresías por vigencia.
 * Los datos entran y salen por funciones del servidor (prepago_crear, prepago_usar, prepago_renovar, prepagos_lista...).
 * Lo cobrado aquí NO entra solo al corte de caja; el descuento de una membresía lo da quien cobra (no se aplica solo en la caja).
 */
(function(){
  'use strict';
  let enlace = { sb: null, giro: () => null, dinero: (n) => '$' + Number(n).toFixed(2) };
  const P = (nombre, cant, unidad, extra) => Object.assign({ nombre, cant, unidad }, extra || {});
  const GIROS = {
    estetica: { bonos: [P('Bono de 5 sesiones', 5, 'sesiones'), P('Bono de 10 sesiones', 10, 'sesiones')], memb: [P('Membresía mensual', null, null, { meses: 1 })] },
    talleres: { bonos: [P('Paquete de 5 lavados', 5, 'lavados'), P('Paquete de 10 lavados', 10, 'lavados')], memb: [P('Membresía de lavado mensual', null, null, { meses: 1 })] },
    lavanderias: { bonos: [P('Paquete de 20 kilos', 20, 'kilos'), P('Paquete de 40 kilos', 40, 'kilos')], memb: [] },
    suplementos: { bonos: [], memb: [P('Membresía de descuento', null, null, { meses: 12, desc: 10 })] }
  };
  const cfg = () => GIROS[enlace.giro()] || { bonos: [P('Paquete de 10 usos', 10, 'usos')], memb: [P('Membresía mensual', null, null, { meses: 1 })] };
  function h(tag, cls, txt, estilo){ const e = document.createElement(tag); if(cls) e.className = cls; if(txt != null) e.textContent = txt; if(estilo) e.style.cssText = estilo; return e; }
  function boton(txt, fn, cls, estilo){ const b = h('button', cls || 'texto', txt, 'width:auto; padding:7px 12px;' + (estilo || '')); b.type = 'button'; b.onclick = fn; return b; }
  function campo(et, el, ancho){ const w = h('label', null, et, 'display:flex; flex-direction:column; gap:4px; font-size:13px; font-weight:500;' + (ancho ? 'flex:1 1 ' + ancho + 'px;' : '')); w.appendChild(el); return w; }
  const input = (v, ph, max, tipo) => { const i = h('input', 'input-mini'); if(tipo) i.type = tipo; if(v != null && v !== '') i.value = v; if(ph) i.placeholder = ph; if(max) i.maxLength = max; return i; };
  const sel = (ops) => { const s = h('select', 'input-mini'); ops.forEach(([v, t]) => { const o = h('option', null, t); o.value = v; s.appendChild(o); }); return s; };
  const fmt = (n) => Number(n).toLocaleString('es-MX', { maximumFractionDigits: 2 });
  const folio = (n) => 'P-' + String(n).padStart(4, '0');
  const fechaL = (f) => new Date(f + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
  const sumaMeses = (m) => { const d = new Date(); d.setMonth(d.getMonth() + m); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
  const msg = (z, t, ok) => { z.textContent = t; z.style.cssText = 'font-size:13px; margin:8px 0; color:' + (ok ? '#16a34a' : 'var(--error,#b91c1c);'); };
  function errTxt(e){ const m = (e && e.message) || String(e); return /does not exist|schema cache|Could not find/i.test(m) ? 'Falta ejecutar el script SQL 114 en Supabase.' : m; }
  async function rpc(f, a){ const r = await enlace.sb.rpc(f, a); if(r.error) throw r.error; return r.data; }
  function wa(tel, texto){ const d = String(tel || '').replace(/\D/g, ''), n = d.length === 10 ? '52' + d : d; window.open('https://wa.me/' + (n.length >= 11 ? n : '') + '?text=' + encodeURIComponent(texto), '_blank', 'noopener'); }
  let raiz = null, filtro = 'activos', q = '';

  function abrir(){ raiz = raiz || document.getElementById('seccionBonos'); if(raiz) lista(); }
  async function lista(){
    raiz.textContent = ''; const cab = h('div', null, null, 'display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-bottom:12px;');
    cab.appendChild(h('h2', null, 'Bonos y membresías', 'margin:0; flex:1 1 auto;')); cab.appendChild(boton('+ Nuevo', () => nuevo(), 'principal', 'padding:9px 14px;')); raiz.appendChild(cab);
    const barra = h('div', null, null, 'display:flex; gap:8px; flex-wrap:wrap; margin-bottom:10px;');
    [['activos', 'Activos'], ['por_vencer', 'Por vencer o por agotarse'], ['todos', 'Todos']].forEach(([v, t]) => barra.appendChild(boton(t, () => { filtro = v; lista(); }, 'texto' + (filtro === v ? ' activo' : '')))); raiz.appendChild(barra);
    const b = input(q, 'Buscar por cliente, teléfono, paquete o folio…', 40); b.style.marginBottom = '10px'; let tm = 0; b.oninput = () => { clearTimeout(tm); tm = setTimeout(() => { q = b.value; cargar(z); }, 250); }; raiz.appendChild(b);
    const z = h('div'); raiz.appendChild(z); cargar(z);
  }
  async function cargar(z){
    z.textContent = '';
    try {
      const d = await rpc('prepagos_lista', { p_q: q || null, p_filtro: filtro }), cob = d.cobrado_hoy || {}, tot = Object.keys(cob).reduce((s, k) => s + Number(cob[k]), 0);
      if(tot > 0) z.appendChild(h('div', 'nota', 'Cobrado hoy en bonos y membresías: ' + enlace.dinero(tot) + ' (' + Object.keys(cob).map((k) => k + ' ' + enlace.dinero(cob[k])).join(', ') + '). No entra solo al corte de caja.', 'margin-bottom:10px;'));
      if(!d.items.length){ z.appendChild(h('p', 'nota', q ? 'No encontré paquetes con esa búsqueda.' : 'Todavía no hay paquetes en esta vista.')); return; }
      d.items.forEach((x) => z.appendChild(tarjeta(x)));
    } catch(e){ msg(z, 'No se pudo cargar: ' + errTxt(e)); }
  }
  function tarjeta(x){
    const c = h('div', null, null, 'border:1px solid var(--borde); border-radius:10px; padding:12px; margin-bottom:10px; background:var(--superficie);');
    const t = h('div', null, null, 'display:flex; justify-content:space-between; gap:8px; flex-wrap:wrap;'); t.appendChild(h('strong', null, folio(x.folio) + ' · ' + x.cliente)); t.appendChild(h('span', 'nota', x.estado === 'activo' ? 'Activo' : x.estado.charAt(0).toUpperCase() + x.estado.slice(1), x.estado === 'activo' ? 'color:#16a34a;' : 'color:#dc2626;')); c.appendChild(t);
    c.appendChild(h('div', null, x.nombre + (x.descuento ? ' · ' + fmt(x.descuento) + '% de descuento' : ''), 'font-size:14px;'));
    const det = []; if(x.tipo === 'bono') det.push('Quedan ' + fmt(x.restante) + ' de ' + fmt(x.total) + ' ' + (x.unidad || 'usos')); else det.push('Visitas registradas: ' + fmt(x.usada));
    if(x.vence) det.push((x.dias < 0 ? 'venció el ' : 'vigente hasta el ') + fechaL(x.vence) + (x.dias >= 0 && x.dias <= 7 ? ' (en ' + x.dias + ' d)' : '')); if(x.telefono) det.push(x.telefono); c.appendChild(h('div', 'nota', det.join(' · ')));
    const ac = h('div', null, null, 'display:flex; gap:6px; flex-wrap:wrap; margin-top:8px;');
    if(x.estado === 'activo'){ ac.appendChild(boton(x.tipo === 'bono' ? 'Usar 1' : 'Registrar visita', () => usar(x, 1, c))); if(x.tipo === 'bono') ac.appendChild(boton('Usar otra cantidad…', () => { const v = Number(window.prompt('¿Cuántos ' + (x.unidad || 'usos') + ' usar?')); if(v > 0) usar(x, v, c); })); }
    if(x.estado !== 'cancelado') ac.appendChild(boton(x.tipo === 'bono' ? 'Recargar' : 'Renovar', () => renovar(x, c)));
    ac.appendChild(boton('WhatsApp', () => wa(x.telefono, 'Hola ' + x.cliente + ', te escribimos de parte de tu ' + x.nombre + ': ' + (x.tipo === 'bono' ? 'te quedan ' + fmt(x.restante) + ' ' + (x.unidad || 'usos') + '. ' : '') + (x.vence ? (x.dias < 0 ? 'Venció el ' : 'Vigente hasta el ') + fechaL(x.vence) + '. ' : '') + '¡Te esperamos!')));
    ac.appendChild(boton('Detalle', () => detalle(x.id))); if(x.estado !== 'cancelado') ac.appendChild(boton('Cancelar', async () => { if(!window.confirm('¿Cancelar ' + folio(x.folio) + '? Si ya cobraste, el reembolso lo manejas tú.')) return; try { await rpc('prepago_cancelar', { p_id: x.id }); lista(); } catch(e){ msg(est, errTxt(e)); } }));
    const est = h('div'); c.appendChild(ac); c.appendChild(est); return c;
  }
  async function usar(x, n, c){ const est = c.lastChild; try { const r = await rpc('prepago_usar', { p_id: x.id, p_cantidad: n, p_nota: null }); msg(est, r.restante != null ? 'Listo. Quedan ' + fmt(r.restante) + ' ' + (x.unidad || 'usos') + '.' : 'Visita registrada.', true); setTimeout(lista, 900); } catch(e){ msg(est, errTxt(e)); } }
  function renovar(x, c){
    const est = c.lastChild; est.textContent = ''; const f = h('div', null, null, 'display:flex; gap:8px; flex-wrap:wrap; align-items:end; margin-top:8px;');
    const ag = input('', '', 8, 'number'), me = input('', '', 3, 'number'), mo = input('0', '', 10, 'number'), mt = sel([['efectivo', 'Efectivo'], ['tarjeta', 'Tarjeta'], ['transferencia', 'Transferencia']]); [ag, me, mo].forEach((i) => { i.min = '0'; i.step = 'any'; i.style.width = '100px'; });
    if(x.tipo === 'bono') f.appendChild(campo('Agregar (' + (x.unidad || 'usos') + ')', ag)); f.appendChild(campo('Alargar (meses)', me)); f.appendChild(campo('Cobrado $', mo)); f.appendChild(campo('Método', mt));
    const ok = boton('Guardar', async () => { try { await rpc('prepago_renovar', { p_id: x.id, p_agregar: Number(ag.value) || 0, p_meses: Math.round(Number(me.value)) || 0, p_monto: Number(mo.value) || 0, p_metodo: mt.value }); lista(); } catch(e){ msg(est, errTxt(e)); } }, 'principal');
    f.appendChild(ok); est.appendChild(f);
  }
  async function detalle(id){
    raiz.textContent = ''; raiz.appendChild(boton('← Volver', lista)); const z = h('div'); raiz.appendChild(z);
    try { const d = await rpc('prepago_detalle', { p_id: id }); z.appendChild(h('h2', null, folio(d.folio) + ' · ' + d.cliente, 'margin:10px 0 4px;')); z.appendChild(h('div', 'nota', d.nombre + (d.vence ? ' · vence ' + fechaL(d.vence) : '') + (d.notas ? ' · ' + d.notas : '')));
      z.appendChild(h('h3', null, 'Usos (' + d.usos.length + ')')); if(!d.usos.length) z.appendChild(h('p', 'nota', 'Sin usos todavía.'));
      d.usos.forEach((u) => z.appendChild(h('div', null, new Date(u.cuando).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }) + ' · ' + fmt(u.cantidad) + (u.nota ? ' · ' + u.nota : ''), 'font-size:14px; padding:4px 0; border-top:1px solid var(--borde);')));
      z.appendChild(h('h3', null, 'Pagos')); if(!d.pagos.length) z.appendChild(h('p', 'nota', 'Sin pagos registrados.'));
      d.pagos.forEach((g) => z.appendChild(h('div', null, new Date(g.cuando).toLocaleDateString('es-MX') + ' · ' + (g.concepto === 'compra' ? 'Compra' : 'Renovación') + ' · ' + enlace.dinero(g.monto) + ' · ' + g.metodo, 'font-size:14px; padding:4px 0; border-top:1px solid var(--borde);')));
    } catch(e){ msg(z, 'No se pudo cargar: ' + errTxt(e)); }
  }
  function nuevo(){
    raiz.textContent = ''; raiz.appendChild(boton('← Volver', lista)); raiz.appendChild(h('h2', null, 'Nuevo bono o membresía', 'margin:10px 0;')); const c = cfg();
    const tipo = sel([['bono', 'Bono (paquete de usos)'], ['membresia', 'Membresía (por vigencia)']]), nom = input('', 'Nombre del paquete', 60), cli = input('', 'Nombre del cliente', 80), tel = input('', 'Opcional', 20, 'tel');
    const cant = input('', '', 8, 'number'), uni = input('', 'sesiones, lavados, kilos…', 15), des = input('', '', 5, 'number'), ven = input('', '', 10, 'date'), mon = input('0', '', 10, 'number'), met = sel([['efectivo', 'Efectivo'], ['tarjeta', 'Tarjeta'], ['transferencia', 'Transferencia']]), nts = input('', 'Opcional', 300);
    [cant, des, mon].forEach((i) => { i.min = '0'; i.step = 'any'; });
    const fc = campo('Cantidad', cant, 110), fu = campo('Unidad', uni, 150), fd = campo('Descuento % (opcional)', des, 150), fv = campo('Vence' , ven, 150);
    const pl = h('div', null, null, 'display:flex; gap:6px; flex-wrap:wrap; margin-bottom:10px;');
    c.bonos.forEach((p) => pl.appendChild(boton(p.nombre, () => { tipo.value = 'bono'; nom.value = p.nombre; cant.value = p.cant; uni.value = p.unidad; ajusta(); })));
    c.memb.forEach((p) => pl.appendChild(boton(p.nombre, () => { tipo.value = 'membresia'; nom.value = p.nombre; des.value = p.desc || ''; ven.value = sumaMeses(p.meses); ajusta(); })));
    if(pl.children.length){ raiz.appendChild(h('div', 'nota', 'Atajos para tu giro:')); raiz.appendChild(pl); }
    const ajusta = () => { const b = tipo.value === 'bono'; fc.style.display = fu.style.display = b ? '' : 'none'; fd.style.display = b ? 'none' : ''; fv.firstChild.textContent = b ? 'Vence (opcional)' : 'Vence'; }; tipo.onchange = ajusta; ajusta();
    const fr = h('div', null, null, 'display:flex; gap:10px; flex-wrap:wrap; margin-bottom:10px;'); [campo('Tipo', tipo, 200), campo('Nombre', nom, 220), campo('Cliente', cli, 200), campo('Teléfono', tel, 140), fc, fu, fd, fv, campo('Cobrado $', mon, 110), campo('Método', met, 140), campo('Notas', nts, 220)].forEach((x) => fr.appendChild(x)); raiz.appendChild(fr);
    const est = h('div'), gb = boton('Guardar', async () => {
      gb.disabled = true; msg(est, 'Guardando…', true);
      try { await rpc('prepago_crear', { p_tipo: tipo.value, p_nombre: nom.value.trim(), p_cliente: cli.value.trim(), p_telefono: tel.value.trim() || null, p_cantidad: tipo.value === 'bono' ? Number(cant.value) : null, p_unidad: tipo.value === 'bono' ? (uni.value.trim() || null) : null,
        p_descuento: tipo.value === 'membresia' && des.value !== '' ? Number(des.value) : null, p_monto: Number(mon.value) || 0, p_metodo: met.value, p_vence: ven.value || null, p_notas: nts.value.trim() || null }); lista(); }
      catch(e){ gb.disabled = false; msg(est, errTxt(e)); }
    }, 'principal', 'padding:9px 14px;'); raiz.appendChild(gb); raiz.appendChild(est);
  }
  window.PuvePrepagos = { enlazar(o){ enlace = Object.assign(enlace, o || {}); }, abrir };
})();
