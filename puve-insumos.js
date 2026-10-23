/* PUVE - Insumos y recetas con costeo + semáforo de caducidad con rebaja automática.
 * Se dibuja dentro de la pestaña Inventario (#vistaInventarioRecetas y #vistaInventarioCaducidad).
 * Todo cambio pasa por funciones del servidor (insumo_guardar, insumo_ajustar, receta_guardar,
 * caducidad_aplicar_rebaja…) que validan que quien lo hace sea el encargado.
 */
(function(){
  'use strict';
  const MARGEN_MIN = 30;          // por debajo de este margen % se marca "Margen bajo"
  const ALZA_AVISO = 5;           // % de alza de costo que dispara el aviso
  const UNIDADES = [['kg', 'kg'], ['g', 'g'], ['l', 'litros'], ['ml', 'ml'], ['pza', 'piezas']];
  let enlace = { sb: null, productos: () => [], dinero: (n) => '$' + Number(n).toFixed(2), recargarProductos: () => {}, aviso: (m) => alert(m), irAInsumos: () => {} };
  let insumos = [], costeo = [], busca = '';

  function h(tag, cls, txt, estilo){ const e = document.createElement(tag); if(cls) e.className = cls; if(txt != null) e.textContent = txt; if(estilo) e.style.cssText = estilo; return e; }
  const num = (v) => { const n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : NaN; };
  const fmt = (n, d) => Number(n).toLocaleString('es-MX', { maximumFractionDigits: d == null ? 3 : d });
  const platillos = () => enlace.productos().filter((p) => (p.tipo || 'producto') === 'producto');
  function boton(txt, fn, cls, estilo){
    const b = h('button', cls || 'texto', txt, 'width:auto; padding:6px 10px;' + (estilo || '')); b.type = 'button';
    b.onclick = async () => { b.disabled = true; try { await fn(); } catch(e){ enlace.aviso((e && e.message) || String(e)); } finally { b.disabled = false; } };
    return b;
  }
  function modal(titulo, ancho){
    const fondo = h('div', 'modal-puve-fondo'), caja = h('div', 'modal-puve'); caja.style.maxWidth = (ancho || 520) + 'px';
    fondo.appendChild(caja); fondo.onclick = (ev) => { if(ev.target === fondo) fondo.remove(); };
    caja.appendChild(h('h2', '', titulo, 'margin:0 0 8px;')); document.body.appendChild(fondo);
    return { caja, cerrar: () => fondo.remove() };
  }
  const campo = (caja, etq, tipo, valor, extra) => {
    const w = h('div', 'campo'); w.appendChild(h('label', null, etq));
    const i = h('input'); i.type = tipo || 'text'; if(valor != null) i.value = valor; if(extra) Object.assign(i, extra); w.appendChild(i); caja.appendChild(w); return i;
  };
  function tabla(columnas){
    const wrap = h('div', 'envoltura-tabla'), t = h('table'), th = h('thead'), tr = h('tr');
    columnas.forEach((c) => tr.appendChild(h('th', null, c))); th.appendChild(tr); t.appendChild(th);
    const tb = h('tbody'); t.appendChild(tb); wrap.appendChild(t); return { wrap, tb };
  }
  const celda = (tr, txt, estilo) => { const td = h('td', null, txt, estilo); tr.appendChild(td); return td; };
  const unidadTxt = (u) => (UNIDADES.find((x) => x[0] === u) || [u, u])[1];

  // =====================================================================
  // Datos
  // =====================================================================
  async function cargarInsumos(){
    let r = await enlace.sb.from('insumos').select('id,nombre,unidad,stock,costo_unitario,stock_minimo,piezas_por_unidad').eq('activo', true).order('nombre');
    if(r.error) r = await enlace.sb.from('insumos').select('id,nombre,unidad,stock,costo_unitario,stock_minimo').eq('activo', true).order('nombre');   // aún sin SQL 100
    if(r.error) throw r.error; insumos = r.data || [];
  }
  async function cargarCosteo(){
    const { data, error } = await enlace.sb.rpc('recetas_costeo'); if(error) throw error; costeo = data || [];
  }

  // =====================================================================
  // Vista: Recetas e insumos
  // =====================================================================
  async function pintarRecetas(cont){
    cont.textContent = '';
    cont.appendChild(h('p', 'nota', 'Registra tus insumos (carne, tortillas, aceite…) con su costo. Arma la receta de cada platillo y PUVE descuenta los insumos al vender y te dice cuánto cuesta y cuánto ganas.', 'margin:0 0 12px;'));
    try { const rc = await enlace.sb.rpc('recetas_recalcular_precios'); if(!rc.error && Number(rc.data) > 0) await enlace.recargarProductos(); } catch(e){}   // precios automáticos al día
    try { await Promise.all([cargarInsumos(), cargarCosteo()]); }
    catch(e){ cont.appendChild(h('p', 'nota', 'No se pudo cargar: ' + ((e && e.message) || e), 'color:var(--error);')); return; }

    // ----- Insumos -----
    const bi = h('div', 'bloque-analitica', null, 'margin-bottom:20px;'); cont.appendChild(bi);
    bi.appendChild(h('h3', null, 'Insumos'));
    const bajos = insumos.filter((i) => Number(i.stock_minimo) > 0 && Number(i.stock) <= Number(i.stock_minimo));
    if(bajos.length) bi.appendChild(h('p', null, 'Por debajo del mínimo: ' + bajos.map((i) => i.nombre).join(', ') + '.', 'margin:0 0 10px; font-weight:600; color:var(--error);'));
    const t = tabla(['Insumo', 'Existencia (valor)', 'Costo por unidad', 'Mínimo', '']); bi.appendChild(t.wrap);
    if(!insumos.length){ const tr = h('tr'); const td = celda(tr, 'Todavía no tienes insumos. Agrega el primero abajo.'); td.colSpan = 5; td.className = 'nota'; t.tb.appendChild(tr); }
    insumos.forEach((i) => {
      const tr = h('tr'), bajo = Number(i.stock_minimo) > 0 && Number(i.stock) <= Number(i.stock_minimo);
      celda(tr, i.nombre, 'font-weight:600;'); celda(tr, fmt(i.stock) + ' ' + unidadTxt(i.unidad) + ' · vale ' + enlace.dinero(Number(i.stock) * Number(i.costo_unitario)), bajo ? 'color:var(--error); font-weight:700;' : '');
      celda(tr, enlace.dinero(i.costo_unitario) + ' / ' + unidadTxt(i.unidad)); celda(tr, Number(i.stock_minimo) ? fmt(i.stock_minimo) : '—');
      const ac = h('td', null, null, 'white-space:nowrap;');
      ac.appendChild(boton('Entrada', () => ajuste(i, 'entrada'))); ac.appendChild(boton('Merma', () => ajuste(i, 'merma')));
      ac.appendChild(boton('Contar', () => ajuste(i, 'conteo'))); ac.appendChild(boton('Editar', () => editarInsumo(i)));
      tr.appendChild(ac); t.tb.appendChild(tr);
    });
    const f = h('div', null, null, 'display:flex; gap:8px; flex-wrap:wrap; align-items:flex-end; margin-top:12px;');
    const nom = h('input', 'input-mini'); nom.placeholder = 'Nuevo insumo (ej. Carne de res)'; nom.maxLength = 60; nom.style.width = '230px';
    const uni = h('select', 'input-mini', null, 'width:auto;'); UNIDADES.forEach(([v, tx]) => { const o = h('option', null, tx); o.value = v; uni.appendChild(o); });
    const cos = h('input', 'input-mini'); cos.type = 'number'; cos.min = '0'; cos.step = 'any'; cos.placeholder = 'Costo por unidad'; cos.style.width = '140px';
    const min = h('input', 'input-mini'); min.type = 'number'; min.min = '0'; min.step = 'any'; min.placeholder = 'Mínimo'; min.style.width = '100px';
    f.appendChild(nom); f.appendChild(uni); f.appendChild(cos); f.appendChild(min);
    f.appendChild(boton('Agregar insumo', async () => {
      const c = num(cos.value), m = min.value === '' ? 0 : num(min.value);
      if(!nom.value.trim()) throw new Error('Escribe el nombre del insumo.'); if(isNaN(c)) throw new Error('Escribe el costo por unidad (puede ser 0 si aún no lo sabes).'); if(isNaN(m)) throw new Error('El mínimo no es válido.');
      const { error } = await enlace.sb.rpc('insumo_guardar', { p_id: null, p_nombre: nom.value.trim(), p_unidad: uni.value, p_costo: c, p_minimo: m });
      if(error) throw error; pintarRecetas(cont);
    }, 'principal'));
    bi.appendChild(f); calculadoraCosto(bi, () => uni.value, cos);
    bi.appendChild(h('p', 'nota', 'Costo por unidad = lo que te cuesta 1 kg, 1 litro o 1 pieza. Para subir existencias usa “Entrada”; el costo se promedia con lo que ya tenías.', 'margin:8px 0 0;'));

    // ----- Recetas y márgenes -----
    const br = h('div', 'bloque-analitica'); cont.appendChild(br);
    br.appendChild(h('h3', null, 'Recetas y márgenes'));
    const porId = {}; costeo.forEach((c) => { porId[c.producto_id] = c; });
    const alzas = costeo.filter((c) => Number(c.costo_guardado) > 0 && (Number(c.costo) / Number(c.costo_guardado) - 1) * 100 >= ALZA_AVISO);
    const bajoMargen = costeo.filter((c) => Number(c.precio) > 0 && (Number(c.precio) - Number(c.costo)) / Number(c.precio) * 100 < MARGEN_MIN);
    if(alzas.length) br.appendChild(h('p', null, 'Subió el costo de: ' + alzas.map((c) => c.nombre).join(', ') + '. Revisa tu precio.', 'margin:0 0 6px; font-weight:600; color:#b45309;'));
    if(bajoMargen.length) br.appendChild(h('p', null, 'Margen menor a ' + MARGEN_MIN + '%: ' + bajoMargen.map((c) => c.nombre).join(', ') + '.', 'margin:0 0 10px; font-weight:600; color:var(--error);'));
    const bus = h('input', 'input-mini'); bus.type = 'search'; bus.placeholder = 'Buscar platillo…'; bus.value = busca; bus.style.cssText = 'width:100%; margin:6px 0 10px;';
    br.appendChild(bus);
    const t2 = tabla(['Platillo', 'Precio', 'Costo', 'Ganas', 'Margen', '']); br.appendChild(t2.wrap);
    const pintarFilas = () => {
      t2.tb.textContent = ''; busca = bus.value.trim().toLowerCase();
      const lista = platillos().filter((p) => !busca || p.nombre.toLowerCase().indexOf(busca) !== -1)
        .sort((a, b) => (porId[b.id] ? 1 : 0) - (porId[a.id] ? 1 : 0) || a.nombre.localeCompare(b.nombre)).slice(0, 250);
      if(!lista.length){ const tr = h('tr'); const td = celda(tr, 'No hay platillos para mostrar.'); td.colSpan = 6; td.className = 'nota'; t2.tb.appendChild(tr); return; }
      lista.forEach((p) => {
        const c = porId[p.id], tr = h('tr'); celda(tr, p.nombre, 'font-weight:600;'); celda(tr, enlace.dinero(p.precio));
        if(!c){ celda(tr, '—'); celda(tr, '—'); const td = celda(tr, 'Sin receta', 'color:var(--texto-suave);'); td.colSpan = 1; }
        else {
          const costo = Number(c.costo), precio = Number(p.precio), gana = precio - costo, pct = precio > 0 ? gana / precio * 100 : 0;
          const alza = Number(c.costo_guardado) > 0 ? (costo / Number(c.costo_guardado) - 1) * 100 : 0;
          celda(tr, enlace.dinero(costo)); celda(tr, enlace.dinero(gana));
          const td = celda(tr, fmt(pct, 0) + '%', 'font-weight:700; color:' + (pct < MARGEN_MIN ? 'var(--error)' : 'var(--exito, #15803d)') + ';');
          if(alza >= ALZA_AVISO) td.appendChild(h('div', null, 'costo +' + fmt(alza, 0) + '%', 'font-size:11px; font-weight:600; color:#b45309;'));
        }
        const ac = h('td', null, null, 'white-space:nowrap;');
        ac.appendChild(boton(c ? 'Editar receta' : 'Armar receta', () => editorReceta(p, c, cont), c ? 'texto' : 'principal'));
        if(c && Number(c.costo_guardado) > 0 && (Number(c.costo) / Number(c.costo_guardado) - 1) * 100 >= ALZA_AVISO){
          ac.appendChild(boton('Ya lo vi', async () => { const { error } = await enlace.sb.rpc('receta_aceptar_costos', { p_producto: p.id }); if(error) throw error; pintarRecetas(cont); }));
        }
        tr.appendChild(ac); t2.tb.appendChild(tr);
      });
    };
    bus.oninput = pintarFilas; pintarFilas();
    br.appendChild(h('p', 'nota', 'Ganas = precio menos el costo de los ingredientes. Las ventas ya hechas antes de armar la receta no descuentan insumos.', 'margin:8px 0 0;'));
  }

  function ajuste(i, tipo){
    const tit = { entrada: 'Entrada de ' + i.nombre, merma: 'Merma de ' + i.nombre, conteo: 'Conteo de ' + i.nombre }[tipo];
    const { caja, cerrar } = modal(tit, 440);
    const aviso = { entrada: 'Suma a tu existencia. Si pones lo que pagaste por unidad, el costo se promedia.', merma: 'Resta lo que se tiró o se echó a perder.', conteo: 'Escribe lo que REALMENTE hay ahora. PUVE guarda la diferencia contra lo que decía el sistema (lo que faltó o sobró).' }[tipo];
    caja.appendChild(h('p', 'nota', aviso, 'margin:0 0 8px;'));
    caja.appendChild(h('p', 'nota', 'Hoy el sistema dice: ' + fmt(i.stock) + ' ' + unidadTxt(i.unidad), 'margin:0 0 8px; font-weight:600;'));
    const cant = campo(caja, (tipo === 'conteo' ? 'Existencia real' : 'Cantidad') + ' (' + unidadTxt(i.unidad) + ')', 'number', '', { min: '0', step: 'any' });
    const cos = tipo === 'entrada' ? campo(caja, 'Costo por ' + unidadTxt(i.unidad) + ' de esta compra (opcional)', 'number', '', { min: '0', step: 'any' }) : null;
    const nota = campo(caja, 'Nota (opcional)', 'text', '', { maxLength: 120 });
    const msg = h('div', 'nota', '', 'color:var(--error); margin:6px 0;'); caja.appendChild(msg);
    const fila = h('div', null, null, 'display:flex; gap:8px; margin-top:10px;');
    fila.appendChild(boton('Cancelar', async () => cerrar()));
    fila.appendChild(boton('Guardar', async () => {
      const c = num(cant.value); if(isNaN(c) || c < 0){ msg.textContent = 'Escribe una cantidad válida.'; return; }
      const k = cos && cos.value !== '' ? num(cos.value) : null; if(cos && cos.value !== '' && isNaN(k)){ msg.textContent = 'El costo no es válido.'; return; }
      const { error } = await enlace.sb.rpc('insumo_ajustar', { p_id: i.id, p_tipo: tipo, p_cantidad: c, p_costo: k, p_nota: nota.value.trim() || null });
      if(error){ msg.textContent = error.message; return; }
      cerrar(); pintarRecetas(document.getElementById('vistaInventarioRecetas'));
    }, 'principal'));
    caja.appendChild(fila);
  }
  function editarInsumo(i){
    const { caja, cerrar } = modal('Editar ' + i.nombre, 440);
    const nom = campo(caja, 'Nombre', 'text', i.nombre, { maxLength: 60 });
    const w = h('div', 'campo'); w.appendChild(h('label', null, 'Unidad')); const uni = h('select'); UNIDADES.forEach(([v, tx]) => { const o = h('option', null, tx); o.value = v; uni.appendChild(o); }); uni.value = i.unidad; w.appendChild(uni); caja.appendChild(w);
    const cos = campo(caja, 'Costo por unidad', 'number', i.costo_unitario, { min: '0', step: 'any' }); calculadoraCosto(caja, () => uni.value, cos);
    const min = campo(caja, 'Avisar cuando baje de', 'number', i.stock_minimo, { min: '0', step: 'any' });
    const msg = h('div', 'nota', '', 'color:var(--error); margin:6px 0;'); caja.appendChild(msg);
    const fila = h('div', null, null, 'display:flex; gap:8px; margin-top:10px; flex-wrap:wrap;');
    fila.appendChild(boton('Cancelar', async () => cerrar()));
    fila.appendChild(boton('Quitar insumo', async () => {
      if(!confirm('¿Quitar “' + i.nombre + '”? Ya no aparecerá en tu lista.')) return;
      const { error } = await enlace.sb.rpc('insumo_archivar', { p_id: i.id }); if(error){ msg.textContent = error.message; return; }
      cerrar(); pintarRecetas(document.getElementById('vistaInventarioRecetas'));
    }, 'texto', 'color:#c0392b;'));
    fila.appendChild(boton('Guardar', async () => {
      const c = num(cos.value), m = min.value === '' ? 0 : num(min.value); if(isNaN(c) || isNaN(m)){ msg.textContent = 'Revisa el costo y el mínimo.'; return; }
      const { error } = await enlace.sb.rpc('insumo_guardar', { p_id: i.id, p_nombre: nom.value.trim(), p_unidad: uni.value, p_costo: c, p_minimo: m });
      if(error){ msg.textContent = error.message; return; }
      cerrar(); pintarRecetas(document.getElementById('vistaInventarioRecetas'));
    }, 'principal'));
    caja.appendChild(fila);
  }

  // Cantidades escritas como las dice el chef: 0.1 · 1/10 · 100 g · 250 ml. Se convierten a la unidad del insumo.
  const A_BASE = { kg: ['kg', 1], g: ['kg', 0.001], gr: ['kg', 0.001], l: ['l', 1], lt: ['l', 1], ml: ['l', 0.001], pza: ['pza', 1], pzas: ['pza', 1], pieza: ['pza', 1], piezas: ['pza', 1] };
  const DE_BASE = { kg: ['kg', 1], g: ['kg', 0.001], l: ['l', 1], ml: ['l', 0.001], pza: ['pza', 1] };
  function parseCantidad(txt, unidad){
    const t = String(txt == null ? '' : txt).trim().toLowerCase().replace(',', '.'); if(!t) return NaN;
    const m = t.match(/^([0-9.\/ ]+?)\s*([a-z]+)?$/); if(!m) return NaN;
    const n = m[1].trim(); let v;
    if(n.indexOf('/') !== -1){ const p = n.split('/').map((x) => parseFloat(x)); if(p.length !== 2 || !isFinite(p[0]) || !isFinite(p[1]) || p[1] === 0) return NaN; v = p[0] / p[1]; }
    else v = parseFloat(n);
    if(!isFinite(v)) return NaN;
    if(m[2]){
      const de = A_BASE[m[2]], a = DE_BASE[unidad]; if(!de || !a || de[0] !== a[0]) return NaN;   // g/kg y ml/l solo con insumos de su misma familia
      v = v * de[1] / a[1];
    }
    return Math.round(v * 10000) / 10000;
  }
  // "Pagué $500 por 1 kg" → costo por unidad. Acepta 10, 10 kg, 500 g, 1/2…
  function calculadoraCosto(cont, getUnidad, cos){
    const SUAVE = 'font-size:12.5px; color:var(--texto-suave);';
    const f = h('div', null, null, 'display:flex; gap:8px; flex-wrap:wrap; align-items:center; margin:8px 0; ' + SUAVE);
    const pago = h('input', 'input-mini'); pago.type = 'number'; pago.min = '0'; pago.step = 'any'; pago.placeholder = 'Total pagado $'; pago.style.width = '130px';
    const cant = h('input', 'input-mini'); cant.type = 'text'; cant.inputMode = 'decimal'; cant.placeholder = 'Cantidad (10, 500 g)'; cant.style.width = '150px';
    const res = h('span', 'nota', '', SUAVE);
    f.appendChild(h('span', 'nota', '¿Lo compraste por paquete?', SUAVE)); f.appendChild(pago); f.appendChild(cant);
    f.appendChild(boton('Calcular costo por unidad', async () => {
      const p = num(pago.value), c = parseCantidad(cant.value, getUnidad());
      if(isNaN(p) || p < 0 || isNaN(c) || c <= 0){ res.textContent = 'Escribe lo que pagaste y la cantidad (ej. 500 y 1 kg).'; return; }
      const u = Math.round(p / c * 10000) / 10000; cos.value = String(u); res.textContent = 'Sale a ' + enlace.dinero(u) + ' por ' + unidadTxt(getUnidad()) + '.';
    }, 'editar'));
    f.appendChild(res); cont.appendChild(f);
  }
  // ---------------------------------------------------------------------
  // Armar receta (versión simple): escribes el ingrediente, cuánto usas y listo.
  //  - Si el ingrediente no existe se crea ahí mismo (sin ir a otra pantalla).
  //  - La cantidad es un número + unidad (g, kg, ml, litros o piezas). "1 pieza" se descuenta del kilo según cuántas piezas salen de 1 kg.
  //  - El precio se puede calcular solo: costo de la receta + tu ganancia / cargo por servicio. O dejas el tuyo.
  // ---------------------------------------------------------------------
  const B = { g: 0.001, kg: 1, ml: 0.001, l: 1 };
  const redondeo = (n) => Math.round(n * 100) / 100;
  const opcionesUnidad = (i) => i.unidad === 'pza' ? [['pza', 'piezas']] : ((i.unidad === 'kg' || i.unidad === 'g') ? [['g', 'gramos'], ['kg', 'kilos'], ['pieza', 'piezas']] : [['ml', 'ml'], ['l', 'litros'], ['pieza', 'piezas']]);
  const factorU = (i, u) => u === 'pieza' ? (Number(i.piezas_por_unidad) > 0 ? 1 / Number(i.piezas_por_unidad) : NaN) : (u === 'pza' ? 1 : B[u] / B[i.unidad]);
  function unidadInicial(i, base){   // cantidad guardada → número y unidad fáciles de leer (0.05 kg → 50 g)
    if(i.unidad === 'pza') return [String(base), 'pza'];
    const peso = i.unidad === 'kg' || i.unidad === 'g', grande = peso ? 'kg' : 'l', enGrande = base * B[i.unidad];
    return enGrande < 1 ? [String(Math.round(enGrande * 100000) / 100), peso ? 'g' : 'ml'] : [String(Math.round(enGrande * 1000) / 1000), grande];
  }
  async function leerModoPrecio(id){
    try { const { data, error } = await enlace.sb.from('productos').select('precio_auto,precio_extra').eq('id', id).maybeSingle(); return error ? {} : (data || {}); } catch(e){ return {}; }
  }
  async function guardarModoPrecio(id, m){
    let r = await enlace.sb.rpc('receta_precio_auto', { p_producto: id, p_auto: !!m.auto, p_extra: m.extra });
    if(r.error && /receta_precio_auto|function/i.test(r.error.message || '')){   // aún no ejecutaron el SQL 100: al menos se actualiza el precio
      r = m.auto ? await enlace.sb.from('productos').update({ precio: m.precio }).eq('id', id) : { error: null };
    }
    return r.error ? r.error.message : '';
  }

  function armarEditorLineas(caja, getPrecio, iniciales, opc){
    opc = opc || {};
    const SUAVE = 'font-size:12.5px; color:var(--texto-suave); line-height:1.45;';
    const dl = 'dl' + Math.random().toString(36).slice(2, 8);
    const vacia = () => ({ insumo_id: null, nombre: '', n: '', u: 'g', mostrar: true, quitable: true, nuevo: null });
    const lineas = (iniciales || []).map((l) => { const i = insumos.find((x) => x.id === l.insumo_id), [n, u] = i ? unidadInicial(i, Number(l.cantidad)) : [String(l.cantidad), 'pza'];
      return { insumo_id: l.insumo_id, nombre: i ? i.nombre : (l.nombre || ''), n, u, mostrar: l.mostrar !== false, quitable: l.quitable !== false && l.mostrar !== false, nuevo: null }; });
    if(opc.lineaInicial && !lineas.length) lineas.push(vacia());
    const lleno = (l) => l.insumo_id || l.nombre.trim() || String(l.n).trim();
    const insumoDe = (l) => insumos.find((x) => x.id === l.insumo_id);
    const cantidadDe = (l) => { const i = insumoDe(l), n = num(l.n); if(!i || isNaN(n) || n <= 0) return NaN; const f = factorU(i, l.u); return isNaN(f) ? NaN : Math.round(n * f * 10000) / 10000; };
    const costoDe = (l) => { const i = insumoDe(l), q = cantidadDe(l); return (i && !isNaN(q)) ? q * Number(i.costo_unitario) : 0; };
    const costoTotal = () => lineas.reduce((a, l) => a + costoDe(l), 0);
    const cambio = () => { if(opc.alCambiar) opc.alCambiar(); };
    const modo = { auto: opc.auto != null ? !!opc.auto : !(Number(getPrecio()) > 0), extra: 0 };
    let ultimoPrecio = null;
    { const t = costoTotal(), p = Number(getPrecio()) || 0; modo.extra = (opc.auto && opc.extra != null) ? Number(opc.extra) : (p > 0 && t > 0 ? Math.max(0, redondeo(p - t)) : 0); }

    const lista = h('div'), msg = h('div', 'nota', '', 'color:var(--error); margin:6px 0; font-size:12.5px;');
    const dlEl = h('datalist'); dlEl.id = dl;
    const resumen = h('div', null, null, 'margin:12px 0 8px; padding:12px 14px; border:1px solid var(--borde); border-radius:14px; font-size:13.5px;');
    const precioCaja = h('div', null, null, 'margin-top:6px;');
    caja.appendChild(h('p', 'nota', 'Escribe lo que lleva UNA porción y cuánto usas de cada cosa. Si el ingrediente no existe, lo creas aquí mismo.', 'margin:0 0 8px; ' + SUAVE));
    caja.appendChild(lista); caja.appendChild(dlEl);

    const refrescar = () => {
      const total = costoTotal(); let precio = Number(getPrecio()) || 0;
      if(modo.auto){
        if(ultimoPrecio !== null && precio !== ultimoPrecio){ modo.auto = false; pintarPrecio(); }   // tocó el precio a mano en el formulario
        else { precio = redondeo(total + modo.extra); if(precio !== ultimoPrecio && opc.setPrecio){ ultimoPrecio = precio; opc.setPrecio(precio); } else ultimoPrecio = precio; }
      }
      etiquetas.forEach(({ l, el }) => { const c = costoDe(l); el.textContent = c > 0 ? 'Cuesta ' + enlace.dinero(c) + (total > 0 ? ' · ' + fmt(c / total * 100, 0) + '% del costo' : '') : ''; });
      const gana = precio - total, pct = precio > 0 ? gana / precio * 100 : 0;
      resumen.textContent = modo.auto
        ? 'Ingredientes ' + enlace.dinero(total) + ' + tu ganancia ' + enlace.dinero(modo.extra) + ' = Precio de venta ' + enlace.dinero(precio)
        : 'Ingredientes ' + enlace.dinero(total) + ' · Tu precio ' + enlace.dinero(precio) + ' · Ganas ' + enlace.dinero(gana) + ' (' + fmt(pct, 0) + '%)' + (!modo.auto && total > 0 && pct < MARGEN_MIN ? ' — margen bajo' : '');
      resumen.style.fontWeight = '600'; resumen.style.color = (!modo.auto && total > 0 && pct < MARGEN_MIN) ? 'var(--error)' : '';
    };
    const etiquetas = [];
    function pintarPrecio(){
      precioCaja.textContent = '';
      const lb = h('label', null, null, 'display:flex; gap:8px; align-items:center; font-weight:600; font-size:14px; cursor:pointer;');
      const c = h('input'); c.type = 'checkbox'; c.checked = modo.auto; c.style.cssText = 'width:18px; height:18px; margin:0; flex:none;';
      c.onchange = () => { modo.auto = c.checked; ultimoPrecio = null; cambio(); pintarPrecio(); refrescar(); };
      lb.appendChild(c); lb.appendChild(document.createTextNode('Calcular el precio por mí')); precioCaja.appendChild(lb);
      precioCaja.appendChild(h('p', 'nota', modo.auto ? 'El precio sale de lo que cuestan los ingredientes más lo que tú quieras ganar. Si sube un ingrediente, el precio se actualiza solo.' : 'Se usará el precio que ya escribiste para este platillo.', 'margin:4px 0 6px 26px; ' + SUAVE));
      if(modo.auto){
        const f = h('div', null, null, 'display:flex; gap:8px; align-items:center; margin-left:26px; flex-wrap:wrap;');
        f.appendChild(h('span', 'nota', 'Mi ganancia o cargo por servicio: $', SUAVE));
        const e = h('input', 'input-mini'); e.type = 'number'; e.min = '0'; e.step = 'any'; e.inputMode = 'decimal'; e.value = modo.extra || ''; e.placeholder = '0'; e.style.width = '100px'; e.setAttribute('aria-label', 'Ganancia extra por servicio');
        e.oninput = () => { const v = num(e.value); modo.extra = isFinite(v) && v >= 0 ? v : 0; cambio(); refrescar(); };
        f.appendChild(e); precioCaja.appendChild(f);
      }
    }

    const pintar = () => {
      lista.textContent = ''; etiquetas.length = 0; dlEl.textContent = '';
      insumos.forEach((i) => { const o = h('option'); o.value = i.nombre; dlEl.appendChild(o); });
      lineas.forEach((l, idx) => {
        const caj = h('div', null, null, 'padding:10px 0; border-bottom:1px solid var(--borde);');
        const f1 = h('div', null, null, 'display:flex; gap:8px; align-items:center; flex-wrap:wrap;');
        const nom = h('input', 'input-mini'); nom.type = 'text'; nom.setAttribute('list', dl); nom.autocomplete = 'off'; nom.maxLength = 60; nom.value = l.nombre; nom.placeholder = 'Ingrediente (ej. Tortilla de maíz)'; nom.style.cssText = 'flex:1; min-width:180px;'; nom.setAttribute('aria-label', 'Ingrediente');
        nom.onchange = () => {
          l.nombre = nom.value.trim(); const i = insumos.find((x) => x.nombre.toLowerCase() === l.nombre.toLowerCase());
          if(i && lineas.some((x) => x !== l && x.insumo_id === i.id)){ msg.textContent = '“' + i.nombre + '” ya está en la receta.'; l.nombre = ''; l.insumo_id = null; }
          else { msg.textContent = ''; l.insumo_id = i ? i.id : null; if(i){ l.u = opcionesUnidad(i)[0][0]; l.nuevo = null; } else l.nuevo = l.nombre ? (l.nuevo || { u: 'kg', costo: '' }) : null; }
          cambio(); pintar();
        };
        f1.appendChild(nom); caj.appendChild(f1);
        const i = insumoDe(l);
        if(i){
          const f2 = h('div', null, null, 'display:flex; gap:8px; align-items:center; margin-top:8px; flex-wrap:wrap;');
          f2.appendChild(h('span', 'nota', 'Uso', SUAVE));
          const q = h('input', 'input-mini'); q.type = 'number'; q.min = '0'; q.step = 'any'; q.inputMode = 'decimal'; q.value = l.n; q.placeholder = 'Cantidad'; q.style.width = '100px'; q.setAttribute('aria-label', 'Cantidad que usa una porción');
          const u = h('select', 'input-mini', null, 'width:auto;'); opcionesUnidad(i).forEach(([v, tx]) => { const o = h('option', null, tx); o.value = v; u.appendChild(o); }); u.value = l.u;
          q.oninput = () => { l.n = q.value; cambio(); refrescar(); };
          u.onchange = () => { l.u = u.value; cambio(); pintar(); };
          f2.appendChild(q); f2.appendChild(u); f2.appendChild(h('span', 'nota', '(compras por ' + unidadTxt(i.unidad) + ' a ' + enlace.dinero(i.costo_unitario) + ')', SUAVE)); caj.appendChild(f2);
          if(l.u === 'pieza' && !(Number(i.piezas_por_unidad) > 0)){
            const f3 = h('div', null, null, 'display:flex; gap:8px; align-items:center; margin-top:8px; flex-wrap:wrap;');
            f3.appendChild(h('span', 'nota', '¿Cuántas piezas salen de 1 ' + unidadTxt(i.unidad) + ' de ' + i.nombre + '?', SUAVE));
            const pz = h('input', 'input-mini'); pz.type = 'number'; pz.min = '1'; pz.step = 'any'; pz.inputMode = 'decimal'; pz.placeholder = 'Ej. 28'; pz.style.width = '90px';
            f3.appendChild(pz);
            f3.appendChild(boton('Guardar', async () => {
              const v = num(pz.value); if(isNaN(v) || v <= 0){ msg.textContent = 'Escribe cuántas piezas salen (ej. 28 tortillas por kilo).'; return; }
              const { error } = await enlace.sb.rpc('insumo_piezas', { p_id: i.id, p_piezas: v }); if(error){ msg.textContent = /insumo_piezas|function/i.test(error.message) ? 'Falta ejecutar el SQL 100 en Supabase para usar piezas.' : error.message; return; }
              msg.textContent = ''; i.piezas_por_unidad = v; cambio(); pintar();
            }, 'editar')); caj.appendChild(f3);
          }
        } else if(l.nuevo){
          const nv = l.nuevo, f2 = h('div', null, null, 'margin-top:8px; padding:10px 12px; border:1px dashed var(--borde); border-radius:12px; display:flex; gap:8px; align-items:center; flex-wrap:wrap;');
          f2.appendChild(h('span', 'nota', '“' + l.nombre + '” es nuevo. Lo compro por', SUAVE));
          const u = h('select', 'input-mini', null, 'width:auto;'); [['kg', 'kilo'], ['l', 'litro'], ['pza', 'pieza']].forEach(([v, tx]) => { const o = h('option', null, tx); o.value = v; u.appendChild(o); }); u.value = nv.u; u.onchange = () => { nv.u = u.value; pintar(); };
          const c = h('input', 'input-mini'); c.type = 'number'; c.min = '0'; c.step = 'any'; c.inputMode = 'decimal'; c.value = nv.costo; c.placeholder = 'Costo $'; c.style.width = '100px'; c.oninput = () => { nv.costo = c.value; };
          f2.appendChild(u); f2.appendChild(h('span', 'nota', 'y me cuesta $', SUAVE)); f2.appendChild(c);
          f2.appendChild(boton('Crear ingrediente', async () => {
            const v = nv.costo === '' ? 0 : num(nv.costo); if(isNaN(v) || v < 0){ msg.textContent = 'El costo no es válido (puede ser 0 si aún no lo sabes).'; return; }
            const { data, error } = await enlace.sb.rpc('insumo_guardar', { p_id: null, p_nombre: l.nombre, p_unidad: nv.u, p_costo: v, p_minimo: 0 }); if(error){ msg.textContent = error.message; return; }
            await cargarInsumos(); l.insumo_id = data; l.nuevo = null; const ni = insumoDe(l); if(ni) l.u = opcionesUnidad(ni)[0][0]; msg.textContent = ''; cambio(); pintar();
          }, 'principal')); caj.appendChild(f2);
        }
        const costo = h('div', null, null, 'margin-top:4px; font-weight:600; font-size:13px;'); caj.appendChild(costo); etiquetas.push({ l, el: costo });
        const det = h('details', null, null, 'margin-top:4px;'); det.appendChild(h('summary', 'nota', 'Opciones del menú QR', 'cursor:pointer; ' + SUAVE));
        const cas = h('div', null, null, 'margin-top:6px; display:flex; flex-wrap:wrap; row-gap:6px;');
        const casilla = (txt, marcada, fn, off) => { const lb = h('label', 'nota', null, 'display:inline-flex; align-items:center; gap:6px; margin:0 14px 0 0; cursor:pointer; white-space:nowrap; ' + SUAVE + (off ? ' opacity:.5;' : '')); const c = h('input'); c.type = 'checkbox'; c.checked = marcada; c.disabled = !!off; c.style.cssText = 'width:18px; height:18px; margin:0; flex:none;'; c.onchange = () => fn(c.checked); lb.appendChild(c); lb.appendChild(document.createTextNode(txt)); return lb; };
        cas.appendChild(casilla('Mostrar al cliente', l.mostrar, (v) => { l.mostrar = v; if(!v) l.quitable = false; cambio(); pintar(); }));
        cas.appendChild(casilla('Obligatorio (no se puede quitar)', l.mostrar && !l.quitable, (v) => { l.quitable = !v; cambio(); }, !l.mostrar));
        det.appendChild(cas); caj.appendChild(det);
        caj.appendChild(boton('Quitar', async () => { lineas.splice(idx, 1); cambio(); pintar(); }, 'texto', 'color:#c0392b; padding:4px 0; margin-top:2px;'));
        lista.appendChild(caj);
      });
      if(!lineas.length) lista.appendChild(h('p', 'nota', 'Aún no tiene ingredientes.', SUAVE));
      refrescar();
    };
    caja.appendChild(boton('+ Agregar ingrediente', async () => { msg.textContent = ''; lineas.push(vacia()); cambio(); pintar(); }, 'editar'));
    caja.appendChild(resumen); caja.appendChild(precioCaja); caja.appendChild(msg);
    pintarPrecio(); pintar();
    return {
      msg, cantidad: () => lineas.filter(lleno).length, recalcular: refrescar,
      precioModo: () => ({ auto: modo.auto, extra: modo.extra, precio: redondeo(costoTotal() + modo.extra) }),
      error(){
        const act = lineas.filter(lleno), vistos = {};
        for(const l of act){
          if(!l.insumo_id) return l.nombre.trim() ? 'Termina de crear el ingrediente “' + l.nombre + '” (botón Crear ingrediente) o quita ese renglón.' : 'Elige el ingrediente de cada renglón o quita el que sobra.';
          if(vistos[l.insumo_id]) return 'Un ingrediente está repetido.'; vistos[l.insumo_id] = 1;
          const i = insumoDe(l), v = cantidadDe(l);
          if(l.u === 'pieza' && isNaN(factorU(i, 'pieza'))) return 'Indica cuántas piezas salen de 1 ' + unidadTxt(i.unidad) + ' de “' + i.nombre + '”.';
          if(isNaN(v) || v <= 0) return 'Escribe cuánto usas de “' + i.nombre + '” (un número mayor a 0).';
        }
        if(act.length && modo.auto && costoTotal() <= 0) return 'Tus ingredientes cuestan $0, así que el precio automático saldría en $0. Escribe el costo de cada ingrediente.';
        return '';
      },
      valores: () => lineas.filter(lleno).map((l) => ({ insumo_id: l.insumo_id, cantidad: cantidadDe(l), mostrar: !!l.mostrar, quitable: !!l.mostrar && !!l.quitable }))
    };
  }

  async function editorReceta(p, c, cont){
    await cargarInsumos().catch(() => {});
    const fl = await leerModoPrecio(p.id);
    const { caja, cerrar } = modal('Armar receta: ' + p.nombre, 620);
    const ed = armarEditorLineas(caja, () => Number(p.precio), c ? c.lineas : [], { lineaInicial: true, auto: fl.precio_auto, extra: fl.precio_extra });
    const fila = h('div', null, null, 'display:flex; gap:8px; margin-top:10px; flex-wrap:wrap;');
    fila.appendChild(boton('Cancelar', async () => cerrar()));
    if(c) fila.appendChild(boton('Quitar receta', async () => {
      if(!confirm('¿Quitar la receta de “' + p.nombre + '”? Dejará de descontar insumos.')) return;
      const { error } = await enlace.sb.rpc('receta_guardar', { p_producto: p.id, p_lineas: [] }); if(error){ ed.msg.textContent = error.message; return; }
      cerrar(); pintarRecetas(cont);
    }, 'texto', 'color:#c0392b;'));
    fila.appendChild(boton('Guardar receta', async () => {
      const e = ed.error(); if(e){ ed.msg.textContent = e; return; }
      const { error } = await enlace.sb.rpc('receta_guardar', { p_producto: p.id, p_lineas: ed.valores() });
      if(error){ ed.msg.textContent = error.message; return; }
      if(ed.cantidad()){ const er = await guardarModoPrecio(p.id, ed.precioModo()); if(er){ ed.msg.textContent = 'La receta se guardó, pero el precio no: ' + er; return; } }
      cerrar(); try { await enlace.recargarProductos(); } catch(x){} pintarRecetas(cont);
    }, 'principal'));
    caja.appendChild(fila);
  }

  // Receta dentro del formulario de Editar / Nuevo producto. Devuelve un control con sucio(), error() y guardar(idProducto).
  // Solo guarda la receta si el encargado la tocó (guardar la receta vuelve a tomar los costos actuales como referencia).
  async function montarRecetaProducto(cont, producto, getPrecio, alCambiar, vigente, setPrecio){
    cont.textContent = '';
    const ctl = { sucio: () => false, error: () => '', guardar: async () => '' };
    cont.appendChild(h('div', 'nota', 'Cargando ingredientes…', 'font-size:12.5px; color:var(--texto-suave); line-height:1.45;'));
    let fl = {};
    try { await Promise.all([cargarInsumos(), producto ? cargarCosteo() : Promise.resolve()]); if(producto) fl = await leerModoPrecio(producto.id); }
    catch(e){ cont.textContent = ''; cont.appendChild(h('p', 'nota', 'No se pudo cargar la receta: ' + ((e && e.message) || e), 'color:var(--error); font-size:12.5px;')); return ctl; }
    if(vigente && !vigente()) return ctl;   // se cerró o reabrió el formulario mientras cargaba
    cont.textContent = '';
    let sucio = false;
    const c = producto ? costeo.find((x) => x.producto_id === producto.id) : null;
    const ed = armarEditorLineas(cont, getPrecio, c ? c.lineas : [], { alCambiar: () => { sucio = true; if(alCambiar) alCambiar(); }, setPrecio, auto: producto ? fl.precio_auto : undefined, extra: fl.precio_extra });
    ctl.sucio = () => sucio; ctl.recalcular = ed.recalcular;
    ctl.error = () => sucio ? ed.error() : '';
    ctl.guardar = async (idProducto) => {
      if(!sucio) return '';
      const { error } = await enlace.sb.rpc('receta_guardar', { p_producto: idProducto, p_lineas: ed.valores() });
      if(error) return error.message;
      return ed.cantidad() ? await guardarModoPrecio(idProducto, ed.precioModo()) : '';
    };
    return ctl;
  }

  // =====================================================================
  // Vista: Caducidad
  // =====================================================================
  async function pintarCaducidad(cont){
    cont.textContent = '';
    cont.appendChild(h('p', 'nota', 'Lo que vence pronto, ordenado por fecha. Usa la fecha de caducidad que capturas en cada producto. Con la rebaja automática, lo que está por vencer baja de precio solo (en caja y en el menú en línea).', 'margin:0 0 12px;'));
    const { data, error } = await enlace.sb.rpc('caducidad_resumen');
    if(error){ cont.appendChild(h('p', 'nota', 'No se pudo cargar: ' + error.message, 'color:var(--error);')); return; }
    const filas = data || [];
    const cubeta = (d) => d < 0 ? 'vencido' : d <= 7 ? '7' : d <= 30 ? '30' : d <= 60 ? '60' : '90';
    const cuenta = { vencido: 0, '7': 0, '30': 0, '60': 0, '90': 0 }; filas.forEach((f) => { cuenta[cubeta(f.dias)]++; });
    const color = { vencido: '#991b1b', '7': '#dc2626', '30': '#d97706', '60': '#ca8a04', '90': '#4d7c0f' };
    const chips = h('div', null, null, 'display:flex; gap:8px; flex-wrap:wrap; margin-bottom:12px;');
    [['vencido', 'Vencidos'], ['7', 'Vencen en 7 días'], ['30', 'En 30 días'], ['60', 'En 60 días'], ['90', 'En 90 días']].forEach(([k, tx]) => {
      const c = h('div', null, null, 'border:2px solid ' + color[k] + '; border-radius:12px; padding:8px 14px; min-width:110px;');
      c.appendChild(h('div', null, String(cuenta[k]), 'font-size:22px; font-weight:800; color:' + color[k] + ';')); c.appendChild(h('div', 'nota', tx, 'margin:0;')); chips.appendChild(c);
    }); cont.appendChild(chips);

    const bloque = h('div', 'bloque-analitica', null, 'margin-bottom:16px;'); cont.appendChild(bloque);
    bloque.appendChild(h('h3', null, 'Rebaja automática por caducidad'));
    const f = h('div', null, null, 'display:flex; gap:8px; flex-wrap:wrap; align-items:center;');
    f.appendChild(h('span', null, 'Rebajar lo que vence en los próximos'));
    const dias = h('input', 'input-mini'); dias.type = 'number'; dias.min = '1'; dias.max = '90'; dias.value = '7'; dias.style.width = '70px';
    f.appendChild(dias); f.appendChild(h('span', null, 'días, un'));
    const pct = h('input', 'input-mini'); pct.type = 'number'; pct.min = '5'; pct.max = '80'; pct.value = '30'; pct.style.width = '70px'; f.appendChild(pct); f.appendChild(h('span', null, '%'));
    f.appendChild(boton('Aplicar rebaja', async () => {
      const d = parseInt(dias.value, 10), p = num(pct.value);
      if(!(d >= 1 && d <= 90) || !(p >= 5 && p <= 80)) throw new Error('Usa de 1 a 90 días y de 5% a 80% de descuento.');
      const n = filas.filter((x) => x.dias >= 0 && x.dias <= d && !x.en_liquidacion).length;
      if(!n){ enlace.aviso('No hay productos por rebajar en ese plazo (los que ya están en liquidación no se tocan).'); return; }
      if(!confirm('Se rebajarán ' + n + ' producto(s) un ' + p + '%. ¿Continuar?')) return;
      const { data: hechos, error: e } = await enlace.sb.rpc('caducidad_aplicar_rebaja', { p_dias: d, p_pct: p }); if(e) throw e;
      enlace.recargarProductos(); enlace.aviso('Listo: ' + hechos + ' producto(s) en liquidación.'); pintarCaducidad(cont);
    }, 'principal'));
    f.appendChild(boton('Quitar rebajas automáticas', async () => {
      if(!confirm('Los productos rebajados automáticamente volverán a su precio normal. ¿Continuar?')) return;
      const { data: n, error: e } = await enlace.sb.rpc('caducidad_quitar_rebajas_auto'); if(e) throw e;
      enlace.recargarProductos(); enlace.aviso('Listo: ' + n + ' producto(s) volvieron a su precio normal.'); pintarCaducidad(cont);
    }));
    bloque.appendChild(f);
    bloque.appendChild(h('p', 'nota', 'No toca lo que ya pusiste en liquidación a mano. Los vencidos no se rebajan: retíralos. Las fechas cuentan con la hora de México.', 'margin:8px 0 0;'));

    const t = tabla(['Producto', 'Existencia', 'Caduca', 'Días', 'Precio', 'Estado']); cont.appendChild(t.wrap);
    if(!filas.length){ const tr = h('tr'); const td = celda(tr, 'Nada vence en los próximos 90 días (o aún no capturas fechas de caducidad en tus productos).'); td.colSpan = 6; td.className = 'nota'; t.tb.appendChild(tr); }
    filas.forEach((x) => {
      const tr = h('tr'), k = cubeta(x.dias); celda(tr, x.nombre, 'font-weight:600;'); celda(tr, fmt(x.stock));
      celda(tr, new Date(x.fecha_caducidad + 'T12:00:00').toLocaleDateString('es-MX')); celda(tr, x.dias < 0 ? 'vencido hace ' + (-x.dias) : String(x.dias), 'font-weight:700; color:' + color[k] + ';');
      celda(tr, x.en_liquidacion && x.precio_liquidacion != null ? enlace.dinero(x.precio_liquidacion) + ' (antes ' + enlace.dinero(x.precio) + ')' : enlace.dinero(x.precio));
      celda(tr, x.dias < 0 ? 'Retirar' : x.en_liquidacion ? (x.auto ? 'Rebaja automática' : 'En liquidación') : '—', x.dias < 0 ? 'font-weight:700; color:' + color.vencido + ';' : ''); t.tb.appendChild(tr);
    });
  }

  window.PuveInsumos = {
    enlazar(o){ enlace = Object.assign(enlace, o || {}); },
    montarRecetaProducto,
    abrir(vista){
      if(vista === 'recetas') return pintarRecetas(document.getElementById('vistaInventarioRecetas'));
      if(vista === 'caducidad') return pintarCaducidad(document.getElementById('vistaInventarioCaducidad'));
    }
  };
})();
