/* PUVE - Etapa 31. Libretas (Inventario → Herramientas → Libretas).
 * Una libreta es una lista de registros con estado, fecha, monto, campos propios y, si hace falta, abonos.
 * Cada giro ve las suyas: entregas y rutas, rentas, garantías con proveedor, núcleos, envases, eventos, recetas, hospedaje, etc.
 * Las plantillas (campos, estados, cálculos y mensajes) están en puve-libretas-plantillas.js; aquí solo está el motor.
 * Es un registro tuyo: PUVE no manda mensajes ni cobra sola, y no cambia existencias ni la caja. Datos: SQL 140.
 */
(function(){
  'use strict';
  let enlace = { sb: null, productos: () => [], esEncargado: () => false, dinero: (n) => '$' + Number(n).toFixed(2), giro: () => '' };
  const PLANTILLAS = [];
  function h(tag, cls, txt, estilo){ const e = document.createElement(tag); if(cls) e.className = cls; if(txt != null) e.textContent = txt; if(estilo) e.style.cssText = estilo; return e; }
  function boton(txt, fn, cls, estilo){ const b = h('button', cls || 'texto', txt, 'width:auto; padding:6px 10px;' + (estilo || '')); b.type = 'button'; b.onclick = fn; return b; }
  function campo(et, el, ancho){ const w = h('label', null, et, 'display:flex; flex-direction:column; gap:4px; font-size:13px; font-weight:500;' + (ancho ? 'flex:1 1 ' + ancho + 'px;' : '')); w.appendChild(el); return w; }
  const input = (v, ph, max, tipo) => { const i = h('input', 'input-mini'); if(tipo) i.type = tipo; if(v != null && v !== '') i.value = v; if(ph) i.placeholder = ph; if(max) i.maxLength = max; return i; };
  const sel = (ops, v) => { const s = h('select', 'input-mini'); ops.forEach((o) => { const x = h('option', null, Array.isArray(o) ? o[1] : o); x.value = Array.isArray(o) ? o[0] : o; s.appendChild(x); }); if(v != null) s.value = v; return s; };
  const msg = (z, t, ok) => { z.textContent = t; z.style.cssText = 'font-size:13px; margin:8px 0; color:' + (ok ? '#16a34a' : 'var(--error,#b91c1c)') + ';'; };
  const errTxt = (e) => { const m = (e && e.message) || String(e); return /does not exist|schema cache|Could not find/i.test(m) ? 'Falta ejecutar el script SQL 140 en Supabase.' : m; };
  async function rpc(f, a){ const r = await enlace.sb.rpc(f, a); if(r.error) throw r.error; return r.data; }
  const din = (n) => enlace.dinero(Number(n) || 0);
  const fmt = (n, d) => Number(n).toLocaleString('es-MX', { maximumFractionDigits: d == null ? 1 : d });
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const hoy = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
  const utc = (f) => { const p = String(f).slice(0, 10).split('-').map(Number); return Date.UTC(p[0], p[1] - 1, p[2]); };
  const dias = (a, b) => Math.round((utc(b) - utc(a)) / 864e5);
  const fechaL = (f) => { if(!f) return ''; const p = String(f).slice(0, 10).split('-'); return p[2] + '/' + p[1] + '/' + p[0]; };
  function wa(tel, texto){ const d = String(tel || '').replace(/\D/g, ''), n = d.length === 10 ? '52' + d : d; window.open('https://wa.me/' + (n.length >= 11 ? n : '') + '?text=' + encodeURIComponent(texto), '_blank', 'noopener'); }
  function imprimir(titulo, cuerpo){
    const w = window.open('', '_blank'); if(!w) { window.alert('Tu navegador bloqueó la ventana. Permite ventanas emergentes para imprimir.'); return; }
    w.document.write('<!doctype html><html lang="es"><head><meta charset="utf-8"><title>' + esc(titulo) + '</title><style>body{font-family:Georgia,serif;margin:28px;color:#111;line-height:1.5}h1{font-size:22px;margin:0 0 6px}h2{font-size:16px;margin:16px 0 4px}.tarjeta{border:2px solid #333;border-radius:10px;padding:26px;max-width:520px;margin:20px auto;text-align:center;font-size:18px}.fila{display:flex;gap:30px;margin-top:40px}.fila div{flex:1;border-top:1px solid #000;padding-top:4px;font-size:13px;text-align:center}table{border-collapse:collapse;width:100%}td{border-bottom:1px solid #ccc;padding:4px 6px;font-size:14px}td:first-child{color:#555;width:38%}img{max-width:260px;border-bottom:1px solid #000}.pie{margin-top:24px;font-size:12px;color:#555}</style></head><body>' + cuerpo + '<script>window.onload=function(){window.print()}<\/script></body></html>'); w.document.close();
  }
  const tablaDatos = (filas) => '<table>' + filas.filter((f) => f[1] != null && String(f[1]).trim() !== '').map((f) => '<tr><td>' + esc(f[0]) + '</td><td>' + esc(f[1]) + '</td></tr>').join('') + '</table>';

  // ---------- Firma en pantalla ----------
  function padFirma(){
    const w = h('div'), c = h('canvas'); c.width = 320; c.height = 110; c.style.cssText = 'border:1px solid var(--borde,#bbb); border-radius:8px; background:#fff; touch-action:none; max-width:100%;'; const g = c.getContext('2d'); g.lineWidth = 2; g.lineCap = 'round'; g.strokeStyle = '#111';
    let dib = false, hay = false; const pos = (e) => { const r = c.getBoundingClientRect(); return [(e.clientX - r.left) * c.width / r.width, (e.clientY - r.top) * c.height / r.height]; };
    c.onpointerdown = (e) => { dib = true; hay = true; const p = pos(e); g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(p[0] + .1, p[1] + .1); g.stroke(); try { c.setPointerCapture(e.pointerId); } catch(x){} };
    c.onpointermove = (e) => { if(!dib) return; const p = pos(e); g.lineTo(p[0], p[1]); g.stroke(); };
    c.onpointerup = c.onpointercancel = () => { dib = false; };
    w.appendChild(c); const b = boton('Borrar firma', () => { g.clearRect(0, 0, c.width, c.height); hay = false; }); b.style.marginTop = '4px'; w.appendChild(b);
    w.valor = () => hay ? c.toDataURL('image/png') : ''; w.poner = (u) => { if(!u) return; const im = new Image(); im.onload = () => { g.drawImage(im, 0, 0); hay = true; }; im.src = u; }; return w;
  }

  // ---------- Contexto para los cálculos ----------
  const ctxDe = (todos) => ({ hoy: hoy(), todos: todos || [], din, fmt, dias, fechaL });
  const estaAbierto = (t, r) => !t.cerrados || t.cerrados.indexOf(r.estado) < 0;

  // ---------- Índice ----------
  let tplActual = null, zonaRaiz = null;
  function abrir(z, id){
    zonaRaiz = z || zonaRaiz; if(!zonaRaiz) return; zonaRaiz.textContent = '';
    if(id){ const t = PLANTILLAS.find((x) => x.id === id); if(t){ lista(t); return; } }
    indice();
  }
  async function indice(){
    const z = zonaRaiz; z.textContent = ''; const g = (() => { try { return enlace.giro() || ''; } catch(e){ return ''; } })();
    z.appendChild(h('p', 'nota', 'Libretas: listas con estado para llevar el control de cosas que PUVE no maneja en la caja (entregas, rentas, garantías, eventos…). Son registros tuyos: no mueven existencias ni cobran. Los abonos que captures aquí no entran al corte de caja.'));
    let res = {}; try { res = await rpc('registros_resumen'); } catch(e){ const m = h('p'); msg(m, errTxt(e)); z.appendChild(m); }
    const mias = PLANTILLAS.filter((t) => t.giros === '*' || t.giros.indexOf(g) >= 0), otras = PLANTILLAS.filter((t) => mias.indexOf(t) < 0);
    const tarjeta = (t) => { const c = h('div', 'bloque-analitica', null, 'margin:8px 0; display:flex; gap:10px; align-items:center; flex-wrap:wrap;'), tx = h('div', null, null, 'flex:1 1 240px;'); tx.appendChild(h('strong', null, t.n)); tx.appendChild(h('div', 'nota', t.ayuda)); c.appendChild(tx); const n = res[t.id] || 0; c.appendChild(h('span', 'nota', n ? n + ' registro' + (n === 1 ? '' : 's') : 'Sin registros')); c.appendChild(boton('Abrir', () => lista(t))); return c; };
    if(mias.length){ z.appendChild(h('h3', null, 'Para tu giro')); mias.forEach((t) => z.appendChild(tarjeta(t))); } else z.appendChild(h('p', 'nota', 'Para tu giro todavía no hay libretas propias. Puedes abrir cualquiera de las de abajo.'));
    if(otras.length){ const d = h('details', null, null, 'margin-top:14px;'); d.appendChild(h('summary', null, 'Libretas de otros giros (' + otras.length + ')', 'cursor:pointer; font-weight:600;')); otras.forEach((t) => d.appendChild(tarjeta(t))); z.appendChild(d); }
  }

  // ---------- Lista de una libreta ----------
  let filtroEstado = '';
  async function lista(t, q){
    tplActual = t; const z = zonaRaiz; z.textContent = '';
    const cab = h('div', null, null, 'display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-bottom:8px;');
    cab.appendChild(boton('← Libretas', indice)); cab.appendChild(h('h3', null, t.n, 'margin:0; flex:1;')); cab.appendChild(boton('+ ' + t.s, () => formulario(t, null), 'primario')); z.appendChild(cab);
    z.appendChild(h('p', 'nota', t.ayuda + (t.limite ? ' ' + t.limite : '')));
    const bus = input(q || '', 'Buscar por nombre o dato…', 60, 'search'); bus.style.maxWidth = '320px'; bus.onchange = () => lista(t, bus.value.trim()); z.appendChild(bus);
    const zl = h('div', null, null, 'margin-top:10px;'); z.appendChild(zl); zl.appendChild(h('p', 'nota', 'Cargando…'));
    let datos; try { datos = await rpc('registros_lista', { p_tipo: t.id, p_estado: null, p_q: q || null }); } catch(e){ zl.textContent = ''; const m = h('p'); msg(m, errTxt(e)); zl.appendChild(m); return; }
    if(tplActual !== t) return; pintaLista(t, zl, datos || [], q);
  }
  function pintaLista(t, zl, todos, q){
    zl.textContent = ''; const ctx = ctxDe(todos);
    const cuenta = {}; todos.forEach((r) => { cuenta[r.estado] = (cuenta[r.estado] || 0) + 1; });
    const barra = h('div', null, null, 'display:flex; gap:6px; flex-wrap:wrap; margin-bottom:8px;');
    [['', 'Todos (' + todos.length + ')']].concat(t.estados.map((e) => [e, e + ' (' + (cuenta[e] || 0) + ')'])).forEach(([k, tx]) => { const b = boton(tx, () => { filtroEstado = k; pintaLista(t, zl, todos, q); }); b.style.fontWeight = filtroEstado === k ? '700' : '400'; barra.appendChild(b); }); zl.appendChild(barra);
    if(t.resumen){ let rs = []; try { rs = t.resumen(todos, ctx) || []; } catch(e){} if(rs.length){ const rb = h('div', 'bloque-analitica', null, 'margin-bottom:10px;'); rs.forEach((x) => rb.appendChild(h('div', null, x, 'font-size:13px; margin:2px 0;'))); zl.appendChild(rb); } }
    let vis = todos.filter((r) => !filtroEstado || r.estado === filtroEstado); if(t.orden) vis = vis.slice().sort((a, b) => t.orden(a, b));
    if(!vis.length){ zl.appendChild(h('p', 'nota', q ? 'No hay registros con esa búsqueda.' : 'Todavía no hay registros aquí.')); return; }
    vis.forEach((r) => zl.appendChild(fila(t, r, ctx, () => lista(t, q))));
  }
  function fila(t, r, ctx, recarga){
    const c = h('div', 'bloque-analitica', null, 'margin:8px 0;'), top = h('div', null, null, 'display:flex; gap:8px; align-items:baseline; flex-wrap:wrap;');
    top.appendChild(h('strong', null, r.titulo)); const fin = t.final && r.estado === t.final; top.appendChild(h('span', null, r.estado, 'font-size:12px; padding:2px 8px; border-radius:10px; border:1px solid ' + (fin ? '#16a34a' : 'var(--borde,#bbb)') + '; color:' + (fin ? '#16a34a' : 'inherit') + ';'));
    if(r.fecha) top.appendChild(h('span', 'nota', (t.fechaEt || 'Fecha') + ': ' + fechaL(r.fecha))); if(Number(r.monto) > 0) top.appendChild(h('span', 'nota', (t.montoEt || 'Monto') + ': ' + din(r.monto))); c.appendChild(top);
    const det = []; t.campos.forEach((f) => { const v = (r.datos || {})[f.k]; if(f.t !== 'firma' && v != null && String(v).trim() !== '') det.push(f.et + ': ' + v); }); if(r.datos && r.datos._final) det.push('Cerrado el ' + new Date(r.datos._final).toLocaleString('es-MX', { timeZone: 'America/Mexico_City', dateStyle: 'short', timeStyle: 'short' }));
    if((r.datos || {}).firma) det.push('Firmado en pantalla ✓'); if(det.length) c.appendChild(h('div', 'nota', det.join(' · '), 'margin-top:4px; white-space:pre-wrap;'));
    if(t.abonos){ const ab = Number(r.abonado) || 0, sal = Math.max(0, Number(r.monto) - ab); c.appendChild(h('div', null, 'Abonado ' + din(ab) + ' · ' + (Number(r.monto) > 0 ? 'Saldo ' + din(sal) : 'sin monto total'), 'font-size:13px; margin-top:4px;')); }
    let cal = null; if(t.calc){ try { cal = t.calc(r, ctx); } catch(e){ cal = null; } }
    if(cal){ (cal.lineas || []).forEach((x) => c.appendChild(h('div', null, x, 'font-size:13px; margin-top:2px;'))); if(cal.alerta) c.appendChild(h('div', null, '⚠ ' + cal.alerta, 'font-size:13px; margin-top:3px; color:#b45309; font-weight:600;')); }
    const ac = h('div', null, null, 'display:flex; gap:6px; flex-wrap:wrap; margin-top:8px; align-items:center;'), se = sel(t.estados, r.estado); se.style.width = 'auto';
    se.onchange = async () => { try { await guardar(t, r, { estado: se.value }); recarga(); } catch(e){ window.alert(errTxt(e)); se.value = r.estado; } }; ac.appendChild(se);
    if(t.toggle){ const otro = r.estado === t.toggle[0] ? t.toggle[1] : t.toggle[0]; ac.appendChild(boton(r.estado === t.toggle[0] ? t.toggle[2] : t.toggle[3], async () => { try { await guardar(t, r, { estado: otro }); recarga(); } catch(e){ window.alert(errTxt(e)); } })); }
    ac.appendChild(boton('Editar', () => formulario(t, r)));
    if(t.abonos) ac.appendChild(boton('Abonos', () => abonos(t, r, c, recarga)));
    const tel = (r.datos || {})[t.tel]; if(t.wa && tel) ac.appendChild(boton('WhatsApp', () => wa(tel, t.wa(r, ctx, enlace.dinero))));
    if(t.imprime) ac.appendChild(boton(t.imprimeEt || 'Imprimir', () => imprimir(r.titulo, t.imprime(r, { esc, tablaDatos, fechaL, din }))));
    if(t.repetir) ac.appendChild(boton('Repetir', async () => { try { const d = Object.assign({}, r.datos); delete d._final; delete d.recibio; await rpc('registro_guardar', { p_id: null, p_tipo: t.id, p_titulo: r.titulo, p_estado: t.estados[0], p_fecha: hoy(), p_monto: Number(r.monto) || 0, p_datos: d }); recarga(); } catch(e){ window.alert(errTxt(e)); } }));
    if(enlace.esEncargado()) ac.appendChild(boton('Borrar', async () => { if(!window.confirm('¿Borrar «' + r.titulo + '»? No se puede deshacer.')) return; try { await rpc('registro_eliminar', { p_id: r.id }); recarga(); } catch(e){ window.alert(errTxt(e)); } }));
    c.appendChild(ac); return c;
  }
  async function guardar(t, r, cambios){
    const datos = Object.assign({}, r.datos || {}); const estado = cambios.estado || r.estado;
    if(t.final){ if(estado === t.final) datos._final = new Date().toISOString(); else delete datos._final; }
    await rpc('registro_guardar', { p_id: r.id, p_tipo: t.id, p_titulo: r.titulo, p_estado: estado, p_fecha: r.fecha || null, p_monto: Number(r.monto) || 0, p_datos: datos });
  }

  // ---------- Abonos ----------
  async function abonos(t, r, c, recarga){
    let p = c.querySelector('.panel-abonos'); if(p){ p.remove(); return; }
    p = h('div', 'panel-abonos', null, 'margin-top:8px; padding:8px; border:1px dashed var(--borde,#bbb); border-radius:8px;'); c.appendChild(p);
    const msgz = h('div'), zl = h('div'); const mo = input('', '$', 10, 'number'), nt = input('', 'Nota (opcional)', 120); mo.min = '0.01'; mo.step = '0.01'; mo.style.width = '110px';
    const carga = async () => { zl.textContent = ''; try { (await rpc('registro_abonos_lista', { p_id: r.id })).forEach((a) => { const f = h('div', null, null, 'font-size:13px; display:flex; gap:8px; align-items:center;'); f.appendChild(h('span', null, new Date(a.creado_en).toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City' }) + ' · ' + din(a.monto) + (a.nota ? ' · ' + a.nota : ''))); if(enlace.esEncargado()) f.appendChild(boton('Quitar', async () => { if(!window.confirm('¿Quitar este abono?')) return; try { await rpc('registro_abono_eliminar', { p_id: a.id }); recarga(); } catch(e){ msg(msgz, errTxt(e)); } }, 'texto', 'padding:2px 6px;')); zl.appendChild(f); }); } catch(e){ msg(msgz, errTxt(e)); } };
    const fr = h('div', null, null, 'display:flex; gap:8px; flex-wrap:wrap; align-items:flex-end; margin-top:6px;'); fr.appendChild(campo('Abono $', mo, 110)); fr.appendChild(campo('Nota', nt, 180));
    fr.appendChild(boton('Registrar abono', async () => { const v = Number(mo.value); if(!(v > 0)){ msg(msgz, 'Escribe cuánto abonó.'); return; } try { await rpc('registro_abono_agregar', { p_id: r.id, p_monto: v, p_nota: nt.value.trim() || null }); recarga(); } catch(e){ msg(msgz, errTxt(e)); } }, 'primario'));
    p.appendChild(zl); p.appendChild(fr); p.appendChild(msgz); carga();
  }

  // ---------- Formulario ----------
  function formulario(t, r){
    const z = zonaRaiz; z.textContent = ''; const d = (r && r.datos) || {};
    z.appendChild(h('h3', null, (r ? 'Editar ' : 'Nuevo: ') + t.s.toLowerCase()));
    const ti = input(r ? r.titulo : '', t.tituloPh || '', 120); const fe = input(r ? (r.fecha || '') : (t.fechaHoy === false ? '' : hoy()), '', 10, 'date'), mo = input(r ? r.monto : '', '$', 12, 'number'); mo.min = '0'; mo.step = '0.01'; mo.style.width = '120px';
    const es = sel(t.estados, r ? r.estado : t.estados[0]); const fr = h('div', null, null, 'display:flex; gap:10px; flex-wrap:wrap; margin-bottom:10px;'); fr.appendChild(campo(t.tituloEt, ti, 240));
    if(t.fechaEt) fr.appendChild(campo(t.fechaEt, fe, 150)); if(t.montoEt) fr.appendChild(campo(t.montoEt, mo, 130)); fr.appendChild(campo('Estado', es, 150)); z.appendChild(fr);
    const ctl = {}, fc = h('div', null, null, 'display:flex; gap:10px; flex-wrap:wrap; margin-bottom:10px;');
    t.campos.forEach((f) => { let el; const v = d[f.k] != null ? d[f.k] : (f.v != null ? f.v : '');
      if(f.t === 'sel'){ el = sel(f.op, v || f.op[0]); } else if(f.t === 'area'){ el = h('textarea', 'input-mini'); el.rows = 3; el.maxLength = 600; el.value = v; el.style.width = '100%'; } else if(f.t === 'firma'){ el = padFirma(); el.poner(v); } else { el = input(v, f.ph || '', 120, f.t === 'num' ? 'number' : f.t === 'tel' ? 'tel' : f.t === 'fecha' ? 'date' : null); if(f.t === 'num'){ el.step = 'any'; el.min = '0'; el.inputMode = 'decimal'; el.style.width = '110px'; } }
      ctl[f.k] = el; fc.appendChild(campo(f.et, el, f.t === 'area' || f.t === 'firma' ? 320 : 170)); }); z.appendChild(fc);
    const m = h('div'), ac = h('div', null, null, 'display:flex; gap:8px;');
    ac.appendChild(boton('Guardar', async () => {
      const datos = Object.assign({}, d); let falta = '';
      t.campos.forEach((f) => { const el = ctl[f.k]; const v = f.t === 'firma' ? el.valor() : f.t === 'num' ? (el.value === '' ? '' : Number(el.value)) : el.value.trim(); if(v === '' || v == null) delete datos[f.k]; else datos[f.k] = v; if(f.req && (v === '' || v == null)) falta = f.et; });
      if(!ti.value.trim()){ msg(m, 'Escribe ' + t.tituloEt.toLowerCase() + '.'); return; } if(falta){ msg(m, 'Falta: ' + falta + '.'); return; }
      if(t.final){ if(es.value === t.final){ if(!datos._final) datos._final = new Date().toISOString(); } else delete datos._final; }
      try { await rpc('registro_guardar', { p_id: r ? r.id : null, p_tipo: t.id, p_titulo: ti.value.trim(), p_estado: es.value, p_fecha: t.fechaEt && fe.value ? fe.value : null, p_monto: t.montoEt ? (Number(mo.value) || 0) : 0, p_datos: datos }); lista(t); } catch(e){ msg(m, errTxt(e)); }
    }, 'primario')); ac.appendChild(boton('Cancelar', () => lista(t))); z.appendChild(ac); z.appendChild(m);
  }

  window.PuveLibretas = {
    enlazar(o){ enlace = Object.assign(enlace, o || {}); },
    registrar(arr){ (arr || []).forEach((t) => { const i = PLANTILLAS.findIndex((x) => x.id === t.id); if(i >= 0) PLANTILLAS[i] = t; else PLANTILLAS.push(t); }); },
    abrir, plantillas: () => PLANTILLAS.slice(), _h: { hoy, dias, fechaL, fmt }
  };
})();
