/* PUVE - Etapa 28.
 * Inventario → Herramientas:
 *   · Buscar y datos: sinónimos, códigos extra (varios códigos / números de parte cruzados), ubicación y campos propios por producto (SQL 137).
 *     Lo que se captura aquí también lo encuentra el buscador de la caja y el lector de códigos.
 *   · Consigna: de quién es cada pieza, cuánto se queda la tienda y la liquidación por periodo (solo encargado).
 *   · Metales: precio por gramo que captura el dueño, calculadora y registro de compras de oro y plata usados.
 *   · Calculadoras: rendimiento por pieza (despiece), porciones por bote, asador, fiesta y costo por rebanada. No guardan nada.
 * PUVE no manda mensajes ni cobra solo: todo lo que sale de aquí lo decides y lo envías tú.
 */
(function(){
  'use strict';
  let enlace = { sb: null, productos: () => [], esEncargado: () => false, dinero: (n) => '$' + Number(n).toFixed(2), negocio: () => '' };
  function h(tag, cls, txt, estilo){ const e = document.createElement(tag); if(cls) e.className = cls; if(txt != null) e.textContent = txt; if(estilo) e.style.cssText = estilo; return e; }
  function boton(txt, fn, cls, estilo){ const b = h('button', cls || 'texto', txt, 'width:auto; padding:7px 12px;' + (estilo || '')); b.type = 'button'; b.onclick = fn; return b; }
  function campo(et, el, ancho){ const w = h('label', null, et, 'display:flex; flex-direction:column; gap:4px; font-size:13px; font-weight:500;' + (ancho ? 'flex:1 1 ' + ancho + 'px;' : '')); w.appendChild(el); return w; }
  const input = (v, ph, max, tipo) => { const i = h('input', 'input-mini'); if(tipo) i.type = tipo; if(v != null && v !== '') i.value = v; if(ph) i.placeholder = ph; if(max) i.maxLength = max; return i; };
  const num = (v, ph, min, paso) => { const i = input(v, ph, 12, 'number'); i.min = min == null ? '0' : String(min); i.step = paso || 'any'; i.inputMode = 'decimal'; return i; };
  const sel = (ops) => { const s = h('select', 'input-mini'); ops.forEach(([v, t]) => { const o = h('option', null, t); o.value = v; s.appendChild(o); }); return s; };
  const msg = (z, t, ok) => { z.textContent = t; z.style.cssText = 'font-size:13px; margin:8px 0; color:' + (ok ? '#16a34a' : 'var(--error,#b91c1c)') + ';'; };
  function errTxt(e){ const m = (e && e.message) || String(e); return /does not exist|schema cache|Could not find|consigna_|metal|producto_datos/i.test(m) && /does not exist|schema cache|Could not find/i.test(m) ? 'Falta ejecutar el script SQL 137 en Supabase.' : m; }
  async function rpc(f, a){ const r = await enlace.sb.rpc(f, a); if(r.error) throw r.error; return r.data; }
  const din = (n) => enlace.dinero(Number(n) || 0);
  const fmt = (n, d) => Number(n).toLocaleString('es-MX', { maximumFractionDigits: d == null ? 2 : d });
  const fechaCorta = (iso) => new Date(String(iso).slice(0, 10) + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
  const hoyISO = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
  const norm = (s) => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  function tabla(cols, filas){ const w = h('div', 'envoltura-tabla'), t = h('table'), th = h('thead'), tr0 = h('tr'); cols.forEach((c) => tr0.appendChild(h('th', null, c))); th.appendChild(tr0); t.appendChild(th); const tb = h('tbody'); filas.forEach((f) => { const tr = h('tr'); f.forEach((c, i) => { const td = h('td'); if(c instanceof Node) td.appendChild(c); else { td.textContent = c; if(i === 0) td.style.fontWeight = '600'; } tr.appendChild(td); }); tb.appendChild(tr); }); t.appendChild(tb); w.appendChild(t); return w; }
  function subtabs(raiz, lista, actual, alElegir){
    const bar = h('div', null, null, 'display:flex; gap:6px; flex-wrap:wrap; margin-bottom:12px;'); const bs = {};
    lista.forEach(([k, t]) => { const b = boton(t, () => { Object.keys(bs).forEach((x) => { bs[x].style.fontWeight = x === k ? '700' : '400'; }); alElegir(k); }); b.style.fontWeight = k === actual ? '700' : '400'; bs[k] = b; bar.appendChild(b); }); raiz.appendChild(bar);
  }
  const soloEncargado = (z) => { z.appendChild(h('p', 'nota', 'Esta parte es solo para el encargado.')); };
  function listaProductos(){ try { return enlace.productos() || []; } catch(e){ return []; } }
  function rangoPeriodo(v){
    const f = (d) => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); }, hoy = new Date();
    if(v === 'mes') return [f(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), f(hoy)];
    if(v === 'pasado') return [f(new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)), f(new Date(hoy.getFullYear(), hoy.getMonth(), 0))];
    const n = Number(v); return [f(new Date(hoy.getTime() - (n - 1) * 864e5)), f(hoy)];
  }

  // ================= RAÍZ =================
  let raiz = null, tab = 'buscar', zona = null;
  function abrir(){
    raiz = raiz || document.getElementById('vistaInventarioHerramientas'); if(!raiz) return; raiz.textContent = '';
    subtabs(raiz, [['buscar', 'Buscar y datos'], ['consigna', 'Consigna'], ['metales', 'Metales'], ['ropa', 'Ropa y calzado'], ['libretas', 'Libretas'], ['herr', 'Más herramientas'], ['calc', 'Calculadoras']], tab, (k) => { tab = k; pinta(); });
    zona = h('div'); raiz.appendChild(zona); pinta();
  }
  function pinta(){ zona.textContent = ''; ({ buscar, consigna, metales, ropa, libretas, herr, calc })[tab](zona); }
  function libretas(z){ if(window.PuveLibretas) PuveLibretas.abrir(z); else z.appendChild(h('p', 'nota', 'No se cargó el módulo de libretas.')); }
  function herr(z){ if(window.PuveHerr2) PuveHerr2.abrir(z); else z.appendChild(h('p', 'nota', 'No se cargó el módulo de herramientas.')); }
  function ropa(z){ if(window.PuveRopa) PuveRopa.abrir(z); else z.appendChild(h('p', 'nota', 'No se cargó el módulo de ropa.')); }

  // ================= BUSCAR Y DATOS =================
  const textoBusq = (p) => norm([p.nombre, p.sku, p.modelo, p.sinonimos, (p.codigos_extra || []).join(' '), p.ubicacion, Object.keys(p.datos || {}).join(' '), Object.values(p.datos || {}).join(' ')].join(' '));
  function buscar(z){
    z.appendChild(h('p', 'nota', 'Encuentra cualquier artículo por nombre, código, sinónimo, número de parte, ubicación o dato propio. Lo que captures en «Sinónimos» y «Códigos extra» también lo encuentra la caja (búsqueda y lector de códigos). Ejemplos: «llave de paso» = «válvula de esfera»; el número de parte de otra marca; «Pasillo 3, estante B».'));
    const q = input('', 'Busca: nombre, código, sinónimo, parte o ubicación…', 60), filtro = sel([['todos', 'Todos'], ['sinubic', 'Sin ubicación'], ['conubic', 'Con ubicación'], ['condatos', 'Con códigos, sinónimos o datos propios']]);
    const barra = h('div', null, null, 'display:flex; gap:10px; flex-wrap:wrap; margin-bottom:8px;'); barra.appendChild(campo('Buscar', q, 280)); barra.appendChild(campo('Ver', filtro, 200)); z.appendChild(barra);
    const marcados = new Set(), zm = h('div'), zl = h('div'), est = h('div');
    if(enlace.esEncargado()){
      const ub = input('', 'Ej. Pasillo 3, estante B', 60); const bm = h('div', null, null, 'display:flex; gap:8px; flex-wrap:wrap; align-items:flex-end; margin-bottom:8px;'); bm.appendChild(campo('Poner esta ubicación a los productos marcados', ub, 280));
      bm.appendChild(boton('Aplicar a los marcados', async () => { if(!marcados.size) return msg(est, 'Marca primero uno o más productos.'); try { await rpc('producto_datos_guardar', { p_items: Array.from(marcados).map((id) => ({ producto_id: id, ubicacion: ub.value.trim() })) }); listaProductos().forEach((p) => { if(marcados.has(p.id)) p.ubicacion = ub.value.trim() || null; }); marcados.clear(); msg(est, ub.value.trim() ? 'Ubicación guardada.' : 'Ubicación quitada.', true); pintaLista(); } catch(e){ msg(est, errTxt(e)); } }, 'principal'));
      bm.appendChild(h('span', 'nota', 'Hasta 100 por vez.')); z.appendChild(bm);
    }
    z.appendChild(est); z.appendChild(zm); z.appendChild(zl);
    function pintaLista(){
      zl.textContent = ''; const t = norm(q.value).split(/\s+/).filter(Boolean), todos = listaProductos().filter((p) => p.activo !== false && p.tipo !== 'servicio' && !p.es_combo);
      let l = todos.filter((p) => { const x = textoBusq(p); return t.every((k) => x.includes(k)); });
      if(filtro.value === 'sinubic') l = l.filter((p) => !p.ubicacion); else if(filtro.value === 'conubic') l = l.filter((p) => !!p.ubicacion);
      else if(filtro.value === 'condatos') l = l.filter((p) => (p.codigos_extra || []).length || p.sinonimos || Object.keys(p.datos || {}).length);
      if(!l.length){ zl.appendChild(h('p', 'nota', todos.length ? 'No hay productos que coincidan.' : 'Todavía no hay productos.')); return; }
      zl.appendChild(h('p', 'nota', l.length > 60 ? 'Mostrando 60 de ' + l.length + '. Escribe más para afinar.' : l.length + ' producto' + (l.length === 1 ? '' : 's') + '.'));
      l.slice(0, 60).forEach((p) => zl.appendChild(fila(p)));
    }
    function fila(p){
      const r = h('div', null, null, 'border:1px solid var(--borde); border-radius:10px; padding:8px 12px; margin-bottom:8px;'), top = h('div', null, null, 'display:flex; gap:8px; align-items:center; flex-wrap:wrap;');
      if(enlace.esEncargado()){ const ck = h('input'); ck.type = 'checkbox'; ck.checked = marcados.has(p.id); ck.style.cssText = 'width:18px; height:18px; margin:0;'; ck.setAttribute('aria-label', 'Marcar ' + p.nombre); ck.onchange = () => { if(ck.checked) marcados.add(p.id); else marcados.delete(p.id); }; top.appendChild(ck); }
      top.appendChild(h('strong', null, p.nombre, 'flex:1 1 180px;')); top.appendChild(h('span', 'nota', (p.sku ? 'Código ' + p.sku + ' · ' : '') + 'Existencia ' + fmt(p.stock, 3)));
      if(p.ubicacion) top.appendChild(h('span', null, '📍 ' + p.ubicacion, 'border-radius:6px; padding:2px 8px; font-size:12px; font-weight:700; background:#e2e8f0; color:#0f172a;'));
      const ed = h('div'); if(enlace.esEncargado()) top.appendChild(boton('Editar datos', () => { ed.textContent = ''; if(ed.dataset.abierto){ ed.dataset.abierto = ''; return; } ed.dataset.abierto = '1'; ed.appendChild(editor(p, () => { ed.textContent = ''; ed.dataset.abierto = ''; pintaLista(); })); }));
      r.appendChild(top);
      const det = []; if(p.sinonimos) det.push('También se busca como: ' + p.sinonimos); if((p.codigos_extra || []).length) det.push('Otros códigos: ' + p.codigos_extra.join(', ')); const dd = Object.entries(p.datos || {}); if(dd.length) det.push(dd.map(([k, v]) => k + ': ' + v).join(' · '));
      det.forEach((x) => r.appendChild(h('div', 'nota', x, 'margin-top:4px;'))); r.appendChild(ed); return r;
    }
    q.oninput = pintaLista; filtro.onchange = pintaLista; pintaLista();
  }
  function editor(p, alTerminar){
    const w = h('div', 'bloque-analitica', null, 'margin:8px 0;'), sn = input(p.sinonimos || '', 'Otras formas de pedirlo, separadas por coma', 300), co = input((p.codigos_extra || []).join(', '), 'Otro código de barras o número de parte, separados por coma', 400), ub = input(p.ubicacion || '', 'Ej. Pasillo 3, estante B', 60), est = h('div');
    const f1 = h('div', null, null, 'display:flex; gap:10px; flex-wrap:wrap;'); [campo('Sinónimos', sn, 260), campo('Códigos extra o números de parte (hasta 10)', co, 260), campo('Ubicación', ub, 180)].forEach((c) => f1.appendChild(c)); w.appendChild(f1);
    const usados = new Set(); listaProductos().forEach((x) => Object.keys(x.datos || {}).forEach((k) => usados.add(k))); const dl = h('datalist'); dl.id = 'dlDatosProd'; usados.forEach((k) => { const o = h('option'); o.value = k; dl.appendChild(o); }); w.appendChild(dl);
    w.appendChild(h('div', 'nota', 'Datos propios (hasta 10): por ejemplo «Medida: 1/2"», «Grado de alcohol: 40%», «Compatible con: Nissan Tsuru 2010».', 'margin:10px 0 4px;'));
    const zd = h('div'); w.appendChild(zd); const pares = [];
    const agrega = (k, v) => { if(pares.length >= 10) return; const a = input(k || '', 'Dato', 30), b = input(v || '', 'Valor', 120); a.setAttribute('list', 'dlDatosProd'); const fl = h('div', null, null, 'display:flex; gap:8px; margin-bottom:6px; flex-wrap:wrap;'); a.style.flex = '1 1 140px'; b.style.flex = '2 1 200px'; const par = { a, b, fl }; fl.appendChild(a); fl.appendChild(b); fl.appendChild(boton('Quitar', () => { fl.remove(); pares.splice(pares.indexOf(par), 1); })); pares.push(par); zd.appendChild(fl); };
    Object.entries(p.datos || {}).forEach(([k, v]) => agrega(k, v)); const masBtn = boton('+ Agregar dato', () => agrega('', '')); w.appendChild(masBtn);
    const ac = h('div', null, null, 'display:flex; gap:8px; margin-top:10px;');
    ac.appendChild(boton('Guardar', async () => {
      const datos = {}; for(const x of pares){ const k = x.a.value.trim(), v = x.b.value.trim(); if(!k && !v) continue; if(!k) return msg(est, 'Cada valor necesita su nombre de dato.'); if(datos[k] !== undefined) return msg(est, 'El dato «' + k + '» está repetido.'); datos[k] = v; }
      const codigos = co.value.split(',').map((s) => s.trim()).filter(Boolean);
      try { await rpc('producto_datos_guardar', { p_items: [{ producto_id: p.id, sinonimos: sn.value.trim(), codigos_extra: codigos, ubicacion: ub.value.trim(), datos }] });
        p.sinonimos = sn.value.trim() || null; p.codigos_extra = codigos.filter((c, i) => codigos.indexOf(c) === i); p.ubicacion = ub.value.trim() || null; p.datos = Object.fromEntries(Object.entries(datos).filter(([, v]) => v)); p.__q = undefined; alTerminar(); }
      catch(e){ msg(est, errTxt(e)); } }, 'principal'));
    ac.appendChild(boton('Cancelar', alTerminar)); w.appendChild(ac); w.appendChild(est); return w;
  }

  // ================= CONSIGNA =================
  let subCons = 'liquidacion';
  function consigna(z){
    if(!enlace.esEncargado()) return soloEncargado(z);
    z.appendChild(h('p', 'nota', 'Mercancía que no es tuya: la vendes y le pagas al dueño su parte. Marca de quién es cada pieza y cuánto se queda tu tienda (comisión %). La liquidación suma lo vendido en el periodo, resta las devoluciones y te dice cuánto le debes a cada consignador. PUVE no paga ni avisa solo: tú registras el pago cuando lo haces.'));
    const zz = h('div'); subtabs(z, [['liquidacion', 'Liquidación'], ['asignar', 'Asignar piezas']], subCons, (k) => { subCons = k; zz.textContent = ''; (k === 'asignar' ? asignar : liquidacion)(zz); }); z.appendChild(zz); (subCons === 'asignar' ? asignar : liquidacion)(zz);
  }
  function asignar(z){
    const q = input('', 'Busca productos…', 60), nom = input('', 'Nombre del consignador', 60), com = num('', '0 a 100', 0, 'any'), est = h('div'), zl = h('div'), marc = new Set();
    com.max = '100'; com.style.width = '120px'; const dl = h('datalist'); dl.id = 'dlConsignadores'; nom.setAttribute('list', 'dlConsignadores'); const nombres = new Set(); listaProductos().forEach((p) => { if(p.consignador) nombres.add(p.consignador); }); nombres.forEach((n) => { const o = h('option'); o.value = n; dl.appendChild(o); });
    const f = h('div', null, null, 'display:flex; gap:10px; flex-wrap:wrap; margin-bottom:8px; align-items:flex-end;'); [campo('Buscar', q, 240), campo('Consignador', nom, 200), campo('Comisión de tu tienda %', com, 130)].forEach((c) => f.appendChild(c)); z.appendChild(f); z.appendChild(dl);
    const guardar = async (quitar) => { if(!marc.size) return msg(est, 'Marca primero uno o más productos.'); if(!quitar){ if(!nom.value.trim()) return msg(est, 'Escribe el nombre del consignador.'); if(com.value === '' || Number(com.value) < 0 || Number(com.value) > 100) return msg(est, 'La comisión va de 0 a 100.'); }
      try { await rpc('consigna_asignar', { p_items: Array.from(marc).map((id) => ({ producto_id: id, consignador: quitar ? '' : nom.value.trim(), comision: quitar ? null : Number(com.value) })) });
        listaProductos().forEach((p) => { if(marc.has(p.id)){ p.consignador = quitar ? null : nom.value.trim(); p.consigna_comision = quitar ? null : Number(com.value); } }); msg(est, quitar ? 'Consigna quitada.' : 'Listo, ' + marc.size + ' pieza' + (marc.size === 1 ? '' : 's') + ' de ' + nom.value.trim() + '.', true); marc.clear(); pinta(); } catch(e){ msg(est, errTxt(e)); } };
    const ac = h('div', null, null, 'display:flex; gap:8px; margin-bottom:8px; flex-wrap:wrap;'); ac.appendChild(boton('Asignar a los marcados', () => guardar(false), 'principal')); ac.appendChild(boton('Quitar consigna a los marcados', () => guardar(true))); z.appendChild(ac); z.appendChild(est); z.appendChild(zl);
    function pinta(){ zl.textContent = ''; const t = norm(q.value).split(/\s+/).filter(Boolean); const l = listaProductos().filter((p) => p.activo !== false && p.tipo !== 'servicio' && !p.es_combo && t.every((k) => norm(p.nombre + ' ' + (p.sku || '') + ' ' + (p.consignador || '')).includes(k)));
      if(!l.length){ zl.appendChild(h('p', 'nota', 'No hay productos que coincidan.')); return; } if(l.length > 80) zl.appendChild(h('p', 'nota', 'Mostrando 80 de ' + l.length + '. Escribe más para afinar.'));
      l.slice(0, 80).forEach((p) => { const r = h('label', null, null, 'display:flex; gap:8px; align-items:center; border-bottom:1px solid var(--borde); padding:6px 4px; font-size:14px;'), ck = h('input'); ck.type = 'checkbox'; ck.checked = marc.has(p.id); ck.style.cssText = 'width:18px; height:18px; margin:0;'; ck.onchange = () => { if(ck.checked) marc.add(p.id); else marc.delete(p.id); };
        r.appendChild(ck); r.appendChild(h('span', null, p.nombre, 'flex:1;')); r.appendChild(h('span', 'nota', p.consignador ? p.consignador + ' · se queda la tienda ' + fmt(p.consigna_comision || 0) + '%' : 'Propia')); zl.appendChild(r); }); }
    q.oninput = pinta; pinta();
  }
  function liquidacion(z){
    const per = sel([['mes', 'Este mes'], ['pasado', 'Mes pasado'], ['30', 'Últimos 30 días'], ['90', 'Últimos 90 días']]); z.appendChild(campo('Periodo', per, 180)); const zr = h('div', null, null, 'margin-top:10px;'); z.appendChild(zr);
    const cargar = async () => { zr.textContent = ''; const [d, hh] = rangoPeriodo(per.value);
      try { const l = await rpc('consigna_liquidacion', { p_desde: d, p_hasta: hh });
        if(!l.length){ zr.appendChild(h('p', 'nota', 'Todavía no hay piezas en consigna. Márcalas en «Asignar piezas».')); return; }
        let debe = 0; const zd = h('div'); const filas = l.map((x) => { debe += Number(x.debe); const ac = h('div', null, null, 'display:flex; gap:6px; flex-wrap:wrap;');
          ac.appendChild(boton('Detalle', () => detalle(zd, x.consignador, d, hh))); ac.appendChild(boton('Registrar pago', () => pago(zd, x, d, hh, cargar)));
          return [x.consignador, String(x.piezas), fmt(x.unidades, 3), din(x.vendido), din(x.devuelto), din(x.neto), din(x.tienda), din(x.debe), x.ultimo_pago ? din(x.ultimo_pago.monto) + ' (hasta ' + fechaCorta(x.ultimo_pago.hasta) + ')' : '—', ac]; });
        zr.appendChild(tabla(['Consignador', 'Piezas', 'Vendidas', 'Vendido', 'Devuelto', 'Neto', 'Se queda la tienda', 'Se le debe', 'Último pago', ''], filas));
        zr.appendChild(h('p', null, 'Total que debes a consignadores en el periodo: ' + din(debe), 'font-weight:700; margin-top:8px;'));
        zr.appendChild(h('p', 'nota', 'La comisión es la que tiene cada producto hoy (no se guarda historial de comisiones). El periodo no descuenta pagos anteriores: si ya pagaste una parte, cambia el periodo para que empiece después. Las devoluciones se restan en el periodo en que se hicieron.')); zr.appendChild(zd);
      } catch(e){ msg(zr, errTxt(e)); } };
    per.onchange = cargar; cargar();
  }
  async function detalle(z, nombre, d, hh){
    z.textContent = ''; z.appendChild(h('h3', null, 'Detalle de ' + nombre, 'margin:14px 0 6px;'));
    try { const l = await rpc('consigna_detalle', { p_consignador: nombre, p_desde: d, p_hasta: hh }); z.appendChild(tabla(['Producto', 'Existencia', 'Vendidas', 'Vendido', 'Devuelto', 'Comisión tienda'], l.map((x) => [x.producto, fmt(x.stock, 3), fmt(x.unidades, 3), din(x.vendido), din(x.devuelto), fmt(x.comision) + '%']))); } catch(e){ msg(z, errTxt(e)); }
    try { const p = await rpc('consigna_pagos_lista', { p_consignador: nombre }); if(p.length){ z.appendChild(h('h3', null, 'Pagos registrados', 'margin:14px 0 6px;')); z.appendChild(tabla(['Fecha', 'Periodo', 'Monto', 'Nota'], p.map((x) => [fechaCorta(x.creado_en), fechaCorta(x.desde) + ' a ' + fechaCorta(x.hasta), din(x.monto), x.nota || '']))); } } catch(e){ /* sin pagos todavía */ }
  }
  function pago(z, x, d, hh, recarga){
    z.textContent = ''; const bx = h('div', 'bloque-analitica', null, 'margin:12px 0;'), mo = num(Number(x.debe) > 0 ? x.debe : '', '', 0, '0.01'), no = input('', 'Ej. Transferencia, efectivo', 200), est = h('div');
    bx.appendChild(h('h3', null, 'Registrar pago a ' + x.consignador)); bx.appendChild(h('p', 'nota', 'Periodo ' + fechaCorta(d) + ' a ' + fechaCorta(hh) + '. Esto solo deja constancia de que pagaste; no mueve dinero ni la caja.'));
    const f = h('div', null, null, 'display:flex; gap:10px; flex-wrap:wrap;'); f.appendChild(campo('Monto pagado $', mo, 140)); f.appendChild(campo('Nota (opcional)', no, 260)); bx.appendChild(f);
    bx.appendChild(boton('Guardar pago', async () => { if(mo.value === '' || Number(mo.value) < 0) return msg(est, 'Escribe el monto.'); try { await rpc('consigna_registrar_pago', { p_consignador: x.consignador, p_desde: d, p_hasta: hh, p_monto: Number(mo.value), p_nota: no.value.trim() }); recarga(); } catch(e){ msg(est, errTxt(e)); } }, 'principal', 'margin-top:8px;')); bx.appendChild(est); z.appendChild(bx);
  }

  // ================= METALES =================
  const METALES_SUGERIDOS = ['Oro 10k', 'Oro 14k', 'Oro 18k', 'Oro 24k', 'Plata .925', 'Plata .999'];
  async function metales(z){
    z.appendChild(h('p', 'nota', 'Tú capturas el precio por gramo de cada metal cuando cambia; PUVE no lo consulta en ningún servicio. Con él calculas el valor de una pieza y registras las compras de oro y plata usados.'));
    let precios = []; const zp = h('div'), zc = h('div'), zr = h('div'); z.appendChild(zp); z.appendChild(zc); z.appendChild(zr);
    async function cargaPrecios(){ try { precios = await rpc('metales_precios_lista'); } catch(e){ msg(zp, errTxt(e)); precios = []; } pintaPrecios(); pintaCompra(); }
    function pintaPrecios(){
      zp.textContent = ''; zp.appendChild(h('h3', null, 'Precio por gramo', 'margin:6px 0;'));
      if(enlace.esEncargado()){ const nm = input('', 'Metal, ej. Oro 14k', 30), pr = num('', '$ por gramo', 0, '0.01'), est = h('div'), sg = h('div', null, null, 'display:flex; gap:6px; flex-wrap:wrap; margin-bottom:6px;');
        METALES_SUGERIDOS.forEach((m) => sg.appendChild(boton(m, () => { nm.value = m; const ya = precios.find((p) => p.metal === m); pr.value = ya ? ya.precio_gramo : ''; pr.focus(); }, 'texto', 'padding:3px 10px; font-size:12.5px;'))); zp.appendChild(sg);
        const f = h('div', null, null, 'display:flex; gap:10px; flex-wrap:wrap; align-items:flex-end;'); f.appendChild(campo('Metal', nm, 180)); f.appendChild(campo('Precio por gramo $', pr, 150));
        f.appendChild(boton('Guardar precio', async () => { if(!nm.value.trim()) return msg(est, 'Escribe el metal.'); if(pr.value === '' || Number(pr.value) < 0) return msg(est, 'Escribe el precio por gramo.'); try { await rpc('metal_precio_guardar', { p_metal: nm.value.trim(), p_precio: Number(pr.value) }); cargaPrecios(); } catch(e){ msg(est, errTxt(e)); } }, 'principal')); zp.appendChild(f); zp.appendChild(est); }
      if(!precios.length){ zp.appendChild(h('p', 'nota', enlace.esEncargado() ? 'Todavía no hay precios. Elige un metal de arriba y escribe su precio.' : 'El encargado todavía no captura los precios.')); return; }
      zp.appendChild(tabla(['Metal', 'Precio por gramo', 'Actualizado', ''], precios.map((p) => [p.metal, din(p.precio_gramo), fechaCorta(p.actualizado_en), enlace.esEncargado() ? boton('Quitar', async () => { if(!window.confirm('¿Quitar el precio de ' + p.metal + '?')) return; try { await rpc('metal_precio_quitar', { p_metal: p.metal }); cargaPrecios(); } catch(e){ msg(zp, errTxt(e)); } }) : ''])));
    }
    function pintaCompra(){
      zc.textContent = ''; zc.appendChild(h('h3', null, 'Calculadora y compra de usados', 'margin:16px 0 6px;'));
      const opts = precios.map((p) => [p.metal, p.metal + ' · ' + din(p.precio_gramo) + '/g']).concat([['__otro__', 'Otro (escribo el precio)']]), me = sel(opts), ot = input('', 'Nombre del metal', 30), pg = num('', '', 0, '0.01'), peso = num('', 'Gramos', 0.001, '0.001'), pct = num('100', '', 0, 'any'), tot = num('', '', 0, '0.01'), res = h('div', 'nota', '', 'margin:6px 0;');
      pct.max = '100'; ot.style.display = 'none'; let totalManual = false;
      const base = () => { if(me.value === '__otro__') return Number(pg.value) || 0; const p = precios.find((x) => x.metal === me.value); return p ? Number(p.precio_gramo) : 0; };
      const calcula = () => { ot.style.display = me.value === '__otro__' ? '' : 'none'; pg.disabled = me.value !== '__otro__'; if(me.value !== '__otro__') pg.value = base() || ''; const v = (Number(peso.value) || 0) * base(), pc = Math.min(Math.max(Number(pct.value) || 0, 0), 100); res.textContent = peso.value && base() ? 'Valor de la pieza: ' + din(v) + ' · pagando ' + fmt(pc) + '%: ' + din(v * pc / 100) : ''; if(!totalManual) tot.value = peso.value && base() ? (Math.round(v * pc) / 100).toFixed(2) : ''; };
      [me, pg, peso, pct].forEach((e) => { e.oninput = calcula; e.onchange = calcula; }); tot.oninput = () => { totalManual = true; };
      const f1 = h('div', null, null, 'display:flex; gap:10px; flex-wrap:wrap;'); [campo('Metal', me, 220), campo('Nombre', ot, 140), campo('Precio por gramo $', pg, 140), campo('Peso en gramos', peso, 120), campo('% del valor que pagas', pct, 150)].forEach((c) => f1.appendChild(c)); zc.appendChild(f1); zc.appendChild(res);
      const ven = input('', 'Nombre de quien vende', 80), tel = input('', 'Teléfono (opcional)', 20, 'tel'), ide = sel([['', 'Identificación: tipo'], ['INE', 'INE'], ['Pasaporte', 'Pasaporte'], ['Licencia', 'Licencia de conducir'], ['Otra', 'Otra']]), pie = input('', 'Ej. Cadena con dije, 20 cm', 120), nota = input('', 'Nota (opcional)', 200), est = h('div');
      const f2 = h('div', null, null, 'display:flex; gap:10px; flex-wrap:wrap; margin-top:6px;'); [campo('Quien vende', ven, 200), campo('Teléfono', tel, 130), campo('Identificación mostrada', ide, 170), campo('Pieza', pie, 240), campo('Total pagado $', tot, 130), campo('Nota', nota, 200)].forEach((c) => f2.appendChild(c)); zc.appendChild(f2);
      zc.appendChild(h('p', 'nota', 'Guarda solo el tipo de identificación, nunca su número. Revisa con tu contador o autoridad local qué debes pedir y reportar al comprar oro o plata usados: PUVE solo deja el registro.'));
      zc.appendChild(boton('Registrar compra', async () => { const metal = me.value === '__otro__' ? ot.value.trim() : me.value; if(!metal) return msg(est, 'Elige o escribe el metal.'); if(!(Number(peso.value) > 0)) return msg(est, 'Escribe los gramos.'); if(!ven.value.trim()) return msg(est, 'Escribe quién vende.'); if(!pie.value.trim()) return msg(est, 'Describe la pieza.'); if(tot.value === '') return msg(est, 'Escribe el total pagado.');
        try { await rpc('compra_metal_registrar', { p_vendedor: ven.value.trim(), p_telefono: tel.value.trim(), p_identificacion: ide.value, p_pieza: pie.value.trim(), p_metal: metal, p_peso: Number(peso.value), p_precio_gramo: base(), p_total: Number(tot.value), p_nota: nota.value.trim() });
          msg(est, 'Compra registrada.', true); [ven, tel, pie, nota, peso].forEach((i) => { i.value = ''; }); ide.value = ''; totalManual = false; calcula(); cargaCompras(); } catch(e){ msg(est, errTxt(e)); } }, 'principal', 'margin-top:8px;')); zc.appendChild(est); calcula();
    }
    async function cargaCompras(){
      zr.textContent = ''; zr.appendChild(h('h3', null, 'Compras de los últimos 90 días', 'margin:16px 0 6px;'));
      try { const l = await rpc('compras_metal_lista', { p_dias: 90 }); if(!l.length){ zr.appendChild(h('p', 'nota', 'Todavía no hay compras registradas.')); return; }
        zr.appendChild(tabla(['Fecha', 'Vendedor', 'Pieza', 'Metal', 'Gramos', 'Precio/g', 'Total', 'Identificación'], l.map((x) => [fechaCorta(x.creado_en), x.vendedor, x.pieza, x.metal, fmt(x.peso_g, 3), din(x.precio_gramo), din(x.total), x.identificacion || '—'])));
        zr.appendChild(h('p', null, 'Total pagado: ' + din(l.reduce((s, x) => s + Number(x.total), 0)) + ' · ' + fmt(l.reduce((s, x) => s + Number(x.peso_g), 0), 3) + ' g', 'font-weight:700; margin-top:8px;')); } catch(e){ msg(zr, errTxt(e)); }
    }
    cargaPrecios(); cargaCompras();
  }

  // ================= CALCULADORAS =================
  let subCalc = 'rend';
  function calc(z){
    z.appendChild(h('p', 'nota', 'Calculadoras para planear precios y compras. No guardan nada ni cambian tu inventario: son cuentas rápidas con tus números. Los gramos por persona y demás datos de arranque son solo una referencia; cámbialos por lo que tú conoces de tu negocio.'));
    const zz = h('div'); const dibuja = (k) => { zz.textContent = ''; ({ rend: rendimiento, bote, asador, fiesta, rebanada, escala, caja2, kilo, porcion, dosis })[k](zz); };
    subtabs(z, [['rend', 'Rendimiento por pieza'], ['bote', 'Porciones por bote'], ['asador', 'Asador'], ['fiesta', 'Fiesta'], ['rebanada', 'Costo por rebanada'], ['escala', 'Escalar receta'], ['caja2', 'Compra por caja o reja'], ['kilo', 'Costo por kilo producido'], ['porcion', 'Precio por porción'], ['dosis', 'Dosis por peso']], subCalc, (k) => { subCalc = k; dibuja(k); }); z.appendChild(zz); dibuja(subCalc);
  }
  function caja(z, titulo, ayuda){ const b = h('div', 'bloque-analitica'); b.appendChild(h('h3', null, titulo)); if(ayuda) b.appendChild(h('p', 'nota', ayuda)); z.appendChild(b); return b; }
  function filaCampos(b, cs){ const f = h('div', null, null, 'display:flex; gap:10px; flex-wrap:wrap; margin-bottom:8px;'); cs.forEach((c) => f.appendChild(c)); b.appendChild(f); return f; }
  const salida = (b) => { const s = h('div', null, null, 'margin-top:10px;'); b.appendChild(s); return s; };
  const linea = (s, t, fuerte) => s.appendChild(h('div', fuerte ? null : 'nota', t, fuerte ? 'font-weight:700; margin:4px 0;' : 'margin:3px 0;'));

  function rendimiento(z){
    const b = caja(z, 'Rendimiento por pieza (despiece)', 'Compras una pieza entera (un res, un pollo, un lomo, un pescado) y la vendes en cortes. Captura cuánto compraste, cuánto pagaste y cuánto salió de cada corte: te dice la merma, cuánto te cuesta REALMENTE cada kilo vendible y tu margen por corte.');
    const kg = num('', 'kg', 0, '0.001'), costo = num('', '$', 0, '0.01'), met = sel([['peso', 'Por peso (todos cuestan igual por kilo)'], ['valor', 'Por valor de venta (el corte caro carga más costo)']]); filaCampos(b, [campo('Peso comprado (kg)', kg, 140), campo('Lo que pagaste $', costo, 140), campo('Cómo repartir el costo', met, 300)]);
    const zc = h('div'); b.appendChild(zc); const cortes = []; const s = salida(b);
    const nuevo = (n) => { const nm = input(n || '', 'Corte', 40), pk = num('', 'kg obtenidos', 0, '0.001'), pv = num('', '$ por kg', 0, '0.01'), fl = h('div', null, null, 'display:flex; gap:8px; margin-bottom:6px; flex-wrap:wrap;'); nm.style.flex = '2 1 160px'; pk.style.flex = '1 1 100px'; pv.style.flex = '1 1 100px'; const c = { nm, pk, pv, fl };
      [nm, pk, pv].forEach((e) => { e.oninput = calcula; }); fl.appendChild(nm); fl.appendChild(pk); fl.appendChild(pv); fl.appendChild(boton('Quitar', () => { fl.remove(); cortes.splice(cortes.indexOf(c), 1); calcula(); })); cortes.push(c); zc.appendChild(fl); };
    ['Corte 1', 'Corte 2', 'Corte 3'].forEach((n) => nuevo('')); b.insertBefore(boton('+ Agregar corte', () => { nuevo(''); }), s); [kg, costo].forEach((e) => { e.oninput = calcula; }); met.onchange = calcula;
    function calcula(){
      s.textContent = ''; const K = Number(kg.value) || 0, C = Number(costo.value) || 0, l = cortes.map((c) => ({ n: c.nm.value.trim() || 'Corte', k: Number(c.pk.value) || 0, p: Number(c.pv.value) || 0 })).filter((x) => x.k > 0);
      if(!(K > 0) || !l.length) { linea(s, 'Escribe el peso comprado y los kilos de al menos un corte.'); return; }
      const ap = l.reduce((t, x) => t + x.k, 0); if(ap > K + 1e-9){ linea(s, 'Los cortes suman ' + fmt(ap, 3) + ' kg y compraste ' + fmt(K, 3) + ' kg. Revisa los números.'); return; }
      const merma = K - ap; linea(s, 'Aprovechable: ' + fmt(ap, 3) + ' kg (' + fmt(ap / K * 100, 1) + '%) · Merma: ' + fmt(merma, 3) + ' kg (' + fmt(merma / K * 100, 1) + '%)', true);
      if(!(C > 0)){ linea(s, 'Escribe lo que pagaste para ver costos y márgenes.'); return; }
      linea(s, 'Costo real por kilo aprovechable: ' + din(C / ap) + ' (a ti te costó ' + din(C / K) + ' por kilo comprado)', true);
      const porValor = met.value === 'valor', sv = l.reduce((t, x) => t + x.k * x.p, 0); if(porValor && !(sv > 0)){ linea(s, 'Para repartir por valor escribe el precio por kilo de los cortes.'); return; }
      let ingreso = 0; const filas = l.map((x) => { const cu = porValor ? (x.p > 0 ? C * x.p / sv : 0) : C / ap, marg = x.p > 0 ? (x.p - cu) / x.p * 100 : null; ingreso += x.k * x.p; return [x.n, fmt(x.k, 3), fmt(x.k / K * 100, 1) + '%', din(cu), x.p > 0 ? din(x.p) : '—', marg == null ? '—' : fmt(marg, 1) + '%']; });
      s.appendChild(tabla(['Corte', 'Kg', '% de lo comprado', 'Costo por kg', 'Precio por kg', 'Margen'], filas));
      if(ingreso > 0) linea(s, 'Si vendes todo a esos precios: ' + din(ingreso) + ' · utilidad ' + din(ingreso - C) + ' (' + fmt((ingreso - C) / ingreso * 100, 1) + '%). Los cortes sin precio no suman.', true);
    }
    calcula();
  }
  function bote(z){
    const b = caja(z, 'Porciones por bote', 'Para helados, nieves y todo lo que se sirve con cucharón: cuántas bolas salen de un bote y cuánto te deja cada una.');
    const vol = num('', 'litros', 0, '0.01'), por = num('80', 'ml', 0, '1'), mer = num('5', '%', 0, 'any'), cb = num('', '$', 0, '0.01'), cc = num('', '$', 0, '0.01'), pb = num('', '$', 0, '0.01');
    filaCampos(b, [campo('Contenido del bote (litros)', vol, 150), campo('Tamaño de una bola (ml)', por, 140), campo('Se pierde (derrame, escarcha) %', mer, 170)]); filaCampos(b, [campo('Costo del bote $', cb, 140), campo('Costo del cono o vaso $ (opcional)', cc, 190), campo('Precio de venta por bola $', pb, 160)]);
    const s = salida(b); const calcula = () => { s.textContent = ''; const V = (Number(vol.value) || 0) * 1000, P = Number(por.value) || 0, M = Math.min(Number(mer.value) || 0, 99); if(!(V > 0 && P > 0)){ linea(s, 'Escribe el contenido del bote y el tamaño de la bola.'); return; }
      const bolas = Math.floor(V * (1 - M / 100) / P); linea(s, 'Salen ' + fmt(bolas, 0) + ' bolas por bote.', true); const C = Number(cb.value) || 0, K = Number(cc.value) || 0, PV = Number(pb.value) || 0; if(!(C > 0) || !bolas) return;
      const cu = C / bolas + K; linea(s, 'Costo por bola' + (K ? ' con cono o vaso' : '') + ': ' + din(cu), true); if(PV > 0){ linea(s, 'Ganas ' + din(PV - cu) + ' por bola (margen ' + fmt((PV - cu) / PV * 100, 1) + '%) · un bote deja ' + din(bolas * (PV - cu)) + (K ? ' si cada bola va en su propio cono o vaso.' : '.'), true); }
      else { linea(s, 'Para ganar 60% de margen cobrarías ' + din(cu / 0.4) + ' por bola.'); } };
    [vol, por, mer, cb, cc, pb].forEach((e) => { e.oninput = calcula; }); calcula();
  }
  function asador(z){
    const b = caja(z, 'Calculadora para el asador', 'Cuánta carne cruda comprar para una carne asada. El reparto entre cortes y los gramos por persona son de referencia: cámbialos.');
    const ad = num('', 'personas', 0, '1'), ni = num('0', 'niños', 0, '1'), ap = sel([['250', 'Ligero (250 g de carne cruda)'], ['350', 'Normal (350 g)'], ['500', 'Fuerte (500 g)']]), col = num('10', '%', 0, 'any'); ap.value = '350';
    filaCampos(b, [campo('Adultos', ad, 110), campo('Niños (comen la mitad)', ni, 150), campo('Qué tanto comen', ap, 230), campo('Colchón extra %', col, 120)]);
    b.appendChild(h('div', 'nota', 'Reparto por corte (el % debería sumar 100):', 'margin:6px 0;')); const zc = h('div'); b.appendChild(zc); const cs = [];
    [['Arrachera o diezmillo', 40], ['Costilla o chuleta de cerdo', 25], ['Pollo', 20], ['Chorizo y longaniza', 15]].forEach(([n, p]) => { const nm = input(n, 'Corte', 40), pc = num(p, '%', 0, 'any'), pk = num('', '$ por kg', 0, '0.01'), fl = h('div', null, null, 'display:flex; gap:8px; margin-bottom:6px; flex-wrap:wrap;'); nm.style.flex = '2 1 180px'; pc.style.flex = '1 1 80px'; pk.style.flex = '1 1 100px'; [nm, pc, pk].forEach((e) => { e.oninput = calcula; }); fl.appendChild(nm); fl.appendChild(pc); fl.appendChild(pk); zc.appendChild(fl); cs.push({ nm, pc, pk }); });
    const s = salida(b); function calcula(){ s.textContent = ''; const A = Number(ad.value) || 0, N = Number(ni.value) || 0; if(!(A + N > 0)){ linea(s, 'Escribe cuántas personas comen.'); return; }
      const base = (A + N * 0.5) * Number(ap.value) / 1000, tot = base * (1 + (Number(col.value) || 0) / 100), sp = cs.reduce((t, c) => t + (Number(c.pc.value) || 0), 0); linea(s, 'Compra ' + fmt(tot, 2) + ' kg de carne en total (' + fmt(base, 2) + ' kg + colchón).', true);
      if(Math.abs(sp - 100) > 0.01) linea(s, 'Ojo: el reparto suma ' + fmt(sp, 1) + '%, no 100%.'); let costo = 0, conPrecio = false;
      const filas = cs.filter((c) => Number(c.pc.value) > 0).map((c) => { const k = tot * Number(c.pc.value) / 100, pk = Number(c.pk.value) || 0; if(pk > 0){ costo += k * pk; conPrecio = true; } return [c.nm.value.trim() || 'Corte', fmt(k, 2) + ' kg', pk > 0 ? din(k * pk) : '—']; });
      s.appendChild(tabla(['Corte', 'Compra', 'Costo'], filas)); if(conPrecio) linea(s, 'Costo estimado de la carne: ' + din(costo) + ' (' + din(costo / (A + N)) + ' por persona).', true); }
    [ad, ni, ap, col].forEach((e) => { e.oninput = calcula; e.onchange = calcula; }); calcula();
  }
  function fiesta(z){
    const b = caja(z, 'Calculadora de fiesta', 'Para cotizar bolsitas de dulces y piñata: cuántas piezas, cuánto cuesta y cuánto cobrar.');
    const ni = num('', 'niños', 0, '1'), ex = num('10', '%', 0, 'any'), dp = num('15', 'piezas', 0, '1'), cd = num('', '$', 0, '0.01'), pi = num('1.5', 'kg', 0, 'any'), cp = num('', '$', 0, '0.01'), mg = num('40', '%', 0, 'any');
    filaCampos(b, [campo('Niños invitados', ni, 120), campo('Bolsitas de más %', ex, 130), campo('Dulces por bolsita', dp, 130), campo('Costo promedio por dulce $', cd, 170)]); filaCampos(b, [campo('Dulce para la piñata (kg)', pi, 150), campo('Costo del dulce de piñata por kg $', cp, 200), campo('Margen que quieres %', mg, 150)]);
    const s = salida(b); const calcula = () => { s.textContent = ''; const N = Number(ni.value) || 0; if(!(N > 0)){ linea(s, 'Escribe cuántos niños.'); return; }
      const bol = Math.ceil(N * (1 + (Number(ex.value) || 0) / 100)), pz = bol * (Number(dp.value) || 0); linea(s, bol + ' bolsitas · ' + fmt(pz, 0) + ' dulces' + (Number(pi.value) > 0 ? ' · ' + fmt(Number(pi.value), 2) + ' kg para la piñata' : '') + '.', true);
      const c1 = pz * (Number(cd.value) || 0), c2 = (Number(pi.value) || 0) * (Number(cp.value) || 0), C = c1 + c2; if(!(C > 0)) return; linea(s, 'Costo: bolsitas ' + din(c1) + (c2 ? ' + piñata ' + din(c2) : '') + ' = ' + din(C), true);
      const m = Math.min(Number(mg.value) || 0, 95), P = C / (1 - m / 100); linea(s, 'Para ganar ' + fmt(m, 0) + '% cobra ' + din(P) + ' en total (' + din(P / N) + ' por niño) · ganas ' + din(P - C) + '.', true); };
    [ni, ex, dp, cd, pi, cp, mg].forEach((e) => { e.oninput = calcula; }); calcula();
  }

  function escala(z){
    const b = caja(z, 'Escalar receta o insumos', 'Escribe tu receta, un ingrediente por renglón con la cantidad al inicio (ej. «500 g harina»). Dices para cuántos pasteles o tandas la quieres y te multiplica todo.');
    const tx = h('textarea', 'input-mini'); tx.rows = 6; tx.style.width = '100%'; tx.placeholder = '500 g harina\n250 g mantequilla\n4 huevos\n1/2 taza de leche'; const de = num('1', 'receta base rinde', 0, 'any'), pa = num('3', 'quiero hacer', 0, 'any'); filaCampos(b, [campo('Ingredientes', tx, 320), campo('La receta base rinde', de, 150), campo('Quiero hacer', pa, 120)]);
    const s = salida(b); const calcula = () => { s.textContent = ''; const d = Number(de.value) || 0, p = Number(pa.value) || 0; if(!(d > 0 && p > 0)){ linea(s, 'Escribe cuánto rinde la receta y cuánto quieres hacer.'); return; } const f = p / d; linea(s, 'Multiplicador: ×' + fmt(f, 2), true);
      tx.value.split('\n').map((x) => x.trim()).filter(Boolean).forEach((r) => { const m = r.match(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?)\s*(.*)$/); if(!m){ linea(s, r + ' (sin cantidad: sin cambios)'); return; } const c = m[1].trim(); let v; if(c.indexOf('/') >= 0){ const pp = c.split(/\s+/); v = pp.length === 2 ? Number(pp[0]) + eval2(pp[1]) : eval2(pp[0]); } else v = Number(c.replace(',', '.')); linea(s, fmt(v * f, 2) + ' ' + m[2]); }); };
    function eval2(q){ const a = q.split('/'); return Number(a[0]) / Number(a[1]); }
    [tx, de, pa].forEach((e) => { e.oninput = calcula; }); calcula();
  }
  function caja2(z){
    const b = caja(z, 'Compra por caja o reja', 'Compras por caja, reja o costal: calcula lo que te cuesta cada kilo vendible considerando lo que se echa a perder.');
    const pc = num('', '$', 0, '0.01'), kc = num('', 'kg', 0, 'any'), me = num('10', '%', 0, 'any'), mg = num('35', '%', 0, 'any'); filaCampos(b, [campo('Precio de la caja $', pc, 130), campo('Kilos por caja', kc, 110), campo('Merma esperada %', me, 130), campo('Margen que quieres %', mg, 140)]);
    const s = salida(b); const calcula = () => { s.textContent = ''; const P = Number(pc.value) || 0, K = Number(kc.value) || 0; if(!(P > 0 && K > 0)){ linea(s, 'Escribe el precio y los kilos de la caja.'); return; } const m = Math.min(Number(me.value) || 0, 90), util = K * (1 - m / 100), ck = P / K, real = P / util, g = Math.min(Number(mg.value) || 0, 95), pv = real / (1 - g / 100); linea(s, 'Costo por kilo comprado: ' + din(ck) + ' · costo por kilo vendible: ' + din(real), true); linea(s, 'De ' + fmt(K, 1) + ' kg salen ' + fmt(util, 1) + ' kg vendibles.'); linea(s, 'Para ganar ' + fmt(g, 0) + '% vende a ' + din(pv) + ' el kilo (redondeado a ' + din(Math.ceil(pv)) + ').', true); };
    [pc, kc, me, mg].forEach((e) => { e.oninput = calcula; }); calcula();
  }
  function kilo(z){
    const b = caja(z, 'Costo por kilo producido', 'Tortillerías, molinos y todo lo que se produce por kilos: suma lo que gastas en el periodo y divídelo entre los kilos producidos.');
    const ks = num('', 'kg producidos', 0, 'any'), g1 = num('', '$ maíz o materia prima', 0, '0.01'), g2 = num('', '$ gas, luz y agua', 0, '0.01'), g3 = num('', '$ sueldos', 0, '0.01'), g4 = num('', '$ otros', 0, '0.01'), pv = num('', '$ por kilo', 0, '0.01');
    filaCampos(b, [campo('Kilos producidos', ks, 120), campo('Materia prima $', g1, 130), campo('Gas, luz y agua $', g2, 130), campo('Sueldos $', g3, 120), campo('Otros $', g4, 110), campo('Tu precio por kilo $ (opcional)', pv, 170)]);
    const s = salida(b); const calcula = () => { s.textContent = ''; const K = Number(ks.value) || 0, T = (Number(g1.value) || 0) + (Number(g2.value) || 0) + (Number(g3.value) || 0) + (Number(g4.value) || 0); if(!(K > 0 && T > 0)){ linea(s, 'Escribe los kilos y al menos un gasto.'); return; } linea(s, 'Te cuesta ' + din(T / K) + ' cada kilo (gastos totales ' + din(T) + ').', true); [['Materia prima', g1], ['Gas, luz y agua', g2], ['Sueldos', g3], ['Otros', g4]].forEach(([t, e]) => { if(Number(e.value) > 0) linea(s, t + ': ' + din(Number(e.value) / K) + ' por kilo (' + fmt(Number(e.value) / T * 100, 0) + '%)'); }); const P = Number(pv.value) || 0; if(P > 0) linea(s, 'Con tu precio de ' + din(P) + ' ganas ' + din(P - T / K) + ' por kilo (' + fmt((P - T / K) / P * 100, 1) + '%).', true); };
    [ks, g1, g2, g3, g4, pv].forEach((e) => { e.oninput = calcula; }); calcula();
  }
  function porcion(z){
    const b = caja(z, 'Precio por porción', 'Suplementos, proteínas y cualquier producto que vendes por porción o muestra: pasa del precio del bote al precio de cada porción.');
    const pb = num('', '$', 0, '0.01'), cb = num('', '$ costo', 0, '0.01'), po = num('', 'porciones', 0, '1'), mg = num('40', '%', 0, 'any'); filaCampos(b, [campo('Precio del bote $', pb, 130), campo('Costo del bote $ (opcional)', cb, 160), campo('Porciones por bote', po, 120), campo('Margen para la porción %', mg, 150)]);
    const s = salida(b); const calcula = () => { s.textContent = ''; const P = Number(pb.value) || 0, R = Math.floor(Number(po.value) || 0); if(!(P > 0 && R > 0)){ linea(s, 'Escribe el precio y las porciones del bote.'); return; } linea(s, 'Cada porción equivale a ' + din(P / R) + ' del precio del bote.', true); const C = Number(cb.value) || 0; if(C > 0){ const m = Math.min(Number(mg.value) || 0, 95), pr = C / R / (1 - m / 100); linea(s, 'Costo por porción: ' + din(C / R) + '. Para ganar ' + fmt(m, 0) + '% cobra ' + din(pr) + ' (redondeado a ' + din(Math.ceil(pr)) + ').', true); linea(s, 'Vendiendo las ' + R + ' porciones a ese precio sacas ' + din(Math.ceil(pr) * R) + ' contra ' + din(P) + ' del bote.'); } };
    [pb, cb, po, mg].forEach((e) => { e.oninput = calcula; }); calcula();
  }
  function dosis(z){
    const b = caja(z, 'Dosis por peso', 'Cuenta de apoyo: dosis (mg por kg) × peso ÷ concentración del producto. La dosis la indica el veterinario o el instructivo del medicamento; esta calculadora no la recomienda ni la valida.');
    const pe = num('', 'kg', 0, 'any'), ds = num('', 'mg por kg', 0, 'any'), co = num('', 'mg por ml', 0, 'any'), tb = num('', 'mg por tableta', 0, 'any'); filaCampos(b, [campo('Peso de la mascota (kg)', pe, 150), campo('Dosis indicada (mg por kg)', ds, 170), campo('Concentración (mg por ml)', co, 170), campo('o mg por tableta', tb, 130)]);
    const s = salida(b); const calcula = () => { s.textContent = ''; const W = Number(pe.value) || 0, D = Number(ds.value) || 0; if(!(W > 0 && D > 0)){ linea(s, 'Escribe el peso y la dosis que indicó el veterinario.'); return; } const mg = W * D; linea(s, 'Dosis total: ' + fmt(mg, 2) + ' mg', true); if(Number(co.value) > 0) linea(s, 'Son ' + fmt(mg / Number(co.value), 2) + ' ml de un producto de ' + fmt(Number(co.value), 2) + ' mg/ml.', true); if(Number(tb.value) > 0) linea(s, 'Son ' + fmt(mg / Number(tb.value), 2) + ' tableta(s) de ' + fmt(Number(tb.value), 2) + ' mg (si no sale exacto, consulta al veterinario antes de partir).', true); linea(s, 'Confirma siempre con el veterinario o el instructivo antes de dar el medicamento.'); };
    [pe, ds, co, tb].forEach((e) => { e.oninput = calcula; }); calcula();
  }
  function rebanada(z){
    const b = caja(z, 'Costo por rebanada', 'Pasteles y postres: pasa del costo del pastel entero al precio de cada rebanada.');
    const ci = num('', '$', 0, '0.01'), ce = num('', '$', 0, '0.01'), nr = num('12', 'rebanadas', 1, '1'), mg = num('60', '%', 0, 'any'), pp = num('', '$', 0, '0.01'); filaCampos(b, [campo('Costo de ingredientes $', ci, 160), campo('Decoración, caja, gas, mano de obra $', ce, 230), campo('Rebanadas por pastel', nr, 140), campo('Margen que quieres %', mg, 150), campo('Precio del pastel entero $ (opcional)', pp, 200)]);
    const s = salida(b); const calcula = () => { s.textContent = ''; const C = (Number(ci.value) || 0) + (Number(ce.value) || 0), R = Math.floor(Number(nr.value) || 0); if(!(C > 0 && R > 0)){ linea(s, 'Escribe el costo y las rebanadas.'); return; }
      const cr = C / R, m = Math.min(Number(mg.value) || 0, 95), pr = cr / (1 - m / 100), red = Math.ceil(pr * 2) / 2; linea(s, 'Costo por rebanada: ' + din(cr), true); linea(s, 'Para ganar ' + fmt(m, 0) + '% cobra ' + din(pr) + ' por rebanada (redondeado a ' + din(red) + ').', true); linea(s, 'Un pastel entero a ese precio por rebanada saldría en ' + din(red * R) + '.');
      const P = Number(pp.value) || 0; if(P > 0){ linea(s, 'Con tu precio de ' + din(P) + ': ganas ' + din(P - C) + ' (margen ' + fmt((P - C) / P * 100, 1) + '%), y cada rebanada equivale a ' + din(P / R) + '. Vendiendo por rebanada a ' + din(red) + ' sacas ' + din(red * R - P) + ' más que entero.'); } };
    [ci, ce, nr, mg, pp].forEach((e) => { e.oninput = calcula; }); calcula();
  }

  window.PuveHerramientas = { enlazar(o){ enlace = Object.assign(enlace, o || {}); }, abrir };
})();
