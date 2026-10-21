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
    const { data, error } = await enlace.sb.from('insumos').select('id,nombre,unidad,stock,costo_unitario,stock_minimo').eq('activo', true).order('nombre');
    if(error) throw error; insumos = data || [];
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
    try { await Promise.all([cargarInsumos(), cargarCosteo()]); }
    catch(e){ cont.appendChild(h('p', 'nota', 'No se pudo cargar: ' + ((e && e.message) || e), 'color:var(--error);')); return; }

    // ----- Insumos -----
    const bi = h('div', 'bloque-analitica', null, 'margin-bottom:20px;'); cont.appendChild(bi);
    bi.appendChild(h('h3', null, 'Insumos'));
    const bajos = insumos.filter((i) => Number(i.stock_minimo) > 0 && Number(i.stock) <= Number(i.stock_minimo));
    if(bajos.length) bi.appendChild(h('p', null, 'Por debajo del mínimo: ' + bajos.map((i) => i.nombre).join(', ') + '.', 'margin:0 0 10px; font-weight:600; color:var(--error);'));
    const t = tabla(['Insumo', 'Existencia', 'Costo por unidad', 'Mínimo', '']); bi.appendChild(t.wrap);
    if(!insumos.length){ const tr = h('tr'); const td = celda(tr, 'Todavía no tienes insumos. Agrega el primero abajo.'); td.colSpan = 5; td.className = 'nota'; t.tb.appendChild(tr); }
    insumos.forEach((i) => {
      const tr = h('tr'), bajo = Number(i.stock_minimo) > 0 && Number(i.stock) <= Number(i.stock_minimo);
      celda(tr, i.nombre, 'font-weight:600;'); celda(tr, fmt(i.stock) + ' ' + unidadTxt(i.unidad), bajo ? 'color:var(--error); font-weight:700;' : '');
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
    bi.appendChild(f);
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
    const cos = campo(caja, 'Costo por unidad', 'number', i.costo_unitario, { min: '0', step: 'any' });
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

  // Editor de líneas de receta, reutilizable: lo usa el modal de Inventario → Recetas y el formulario de Editar producto.
  // Cada línea: insumo + cantidad por porción + dos casillas para el menú QR (lo ve el cliente / lo puede quitar).
  function armarEditorLineas(caja, getPrecio, iniciales, opc){
    opc = opc || {};
    const lineas = (iniciales || []).map((l) => ({ insumo_id: l.insumo_id, cantidad: String(l.cantidad), mostrar: l.mostrar !== false, quitable: l.quitable !== false && l.mostrar !== false }));
    const avisoCliente = h('p', 'nota', 'Marca qué ingredientes verá tu cliente en el menú QR y cuáles podrá quitar (por ejemplo “sin cebolla”). Lo que no marques (aceite, sal, empaques…) solo cuenta para el costo.', 'margin:0 0 8px; font-size:12.5px; color:var(--texto-suave); line-height:1.45;');
    const lista = h('div'); caja.appendChild(avisoCliente); caja.appendChild(lista);
    const msg = h('div', 'nota', '', 'color:var(--error); margin:6px 0; font-size:12.5px;');
    const resumen = h('div', null, null, 'margin:12px 0; padding:10px 14px; border:1px solid var(--borde); border-radius:14px; font-weight:600; font-size:13.5px;');
    const cambio = () => { if(opc.alCambiar) opc.alCambiar(); };
    const calcula = () => {
      let costo = 0; lineas.forEach((l) => { const i = insumos.find((x) => x.id === l.insumo_id), q = num(l.cantidad); if(i && !isNaN(q)) costo += q * Number(i.costo_unitario); });
      const precio = Number(getPrecio()) || 0, gana = precio - costo, pct = precio > 0 ? gana / precio * 100 : 0;
      resumen.textContent = 'Costo ' + enlace.dinero(costo) + ' · Precio ' + enlace.dinero(precio) + ' · Ganas ' + enlace.dinero(gana) + ' (' + fmt(pct, 0) + '%)' + (lineas.length && pct < MARGEN_MIN ? ' — margen bajo' : '');
      resumen.style.color = lineas.length && pct < MARGEN_MIN ? 'var(--error)' : '';
    };
    const casilla = (txt, marcada, fn, deshabilitada) => {
      const lb = h('label', 'nota', null, 'display:inline-flex; align-items:center; gap:6px; margin:0 14px 0 0; cursor:pointer; white-space:nowrap; font-size:12.5px; color:var(--texto-suave); line-height:1.45;' + (deshabilitada ? ' opacity:.5;' : ''));
      const c = h('input'); c.type = 'checkbox'; c.checked = marcada; c.disabled = !!deshabilitada; c.style.cssText = 'width:18px; height:18px; margin:0; padding:0; flex:none;'; c.onchange = () => fn(c.checked); lb.appendChild(c); lb.appendChild(document.createTextNode(txt)); return lb;
    };
    const pintar = () => {
      lista.textContent = '';
      lineas.forEach((l, idx) => {
        const caj = h('div', null, null, 'padding:8px 0; border-bottom:1px solid var(--borde);');
        const fila = h('div', null, null, 'display:flex; gap:8px; align-items:center; flex-wrap:wrap;');
        const sel = h('select', 'input-mini', null, 'flex:1; min-width:170px;');
        insumos.filter((i) => i.id === l.insumo_id || !lineas.some((x) => x.insumo_id === i.id)).forEach((i) => { const o = h('option', null, i.nombre + ' (' + unidadTxt(i.unidad) + ')'); o.value = i.id; sel.appendChild(o); });
        sel.value = l.insumo_id; sel.onchange = () => { l.insumo_id = sel.value; cambio(); pintar(); };
        const q = h('input', 'input-mini'); q.type = 'number'; q.min = '0'; q.step = 'any'; q.value = l.cantidad; q.placeholder = 'Cantidad'; q.style.width = '110px'; q.oninput = () => { l.cantidad = q.value; cambio(); calcula(); };
        const i = insumos.find((x) => x.id === l.insumo_id); const u = h('span', 'nota', i ? unidadTxt(i.unidad) : '', 'font-size:12.5px; color:var(--texto-suave); line-height:1.45;');
        const x = boton('Quitar', async () => { lineas.splice(idx, 1); cambio(); pintar(); }, 'texto', 'color:#c0392b; margin-left:auto; padding:4px 10px;');
        fila.appendChild(sel); fila.appendChild(q); fila.appendChild(u); caj.appendChild(fila);
        const cas = h('div', null, null, 'margin-top:8px; display:flex; align-items:center; flex-wrap:wrap; row-gap:6px;');
        cas.appendChild(casilla('Lo ve el cliente', l.mostrar, (v) => { l.mostrar = v; if(!v) l.quitable = false; cambio(); pintar(); }));
        cas.appendChild(casilla('Puede quitarlo', l.quitable, (v) => { l.quitable = v; cambio(); }, !l.mostrar));
        cas.appendChild(x); caj.appendChild(cas); lista.appendChild(caj);
      });
      if(!lineas.length) lista.appendChild(h('p', 'nota', 'Aún no tiene ingredientes.', 'font-size:12.5px; color:var(--texto-suave); line-height:1.45;'));
      calcula();
    };
    const bAdd = boton('+ Agregar ingrediente', async () => {
      const libre = insumos.find((i) => !lineas.some((x) => x.insumo_id === i.id)); if(!libre){ msg.textContent = 'Ya agregaste todos tus insumos.'; return; }
      msg.textContent = ''; lineas.push({ insumo_id: libre.id, cantidad: '', mostrar: true, quitable: true }); cambio(); pintar();
    }, 'editar');
    caja.appendChild(bAdd); caja.appendChild(resumen); caja.appendChild(msg);
    if(opc.lineaInicial && !lineas.length) lineas.push({ insumo_id: insumos[0].id, cantidad: '', mostrar: true, quitable: true });
    pintar();
    return {
      msg, cantidad: () => lineas.length,
      error(){ for(const l of lineas){ const q = num(l.cantidad); if(isNaN(q) || q <= 0) return 'Todas las cantidades de la receta deben ser mayores a 0.'; } return ''; },
      valores(){ return lineas.map((l) => ({ insumo_id: l.insumo_id, cantidad: num(l.cantidad), mostrar: !!l.mostrar, quitable: !!l.mostrar && !!l.quitable })); },
      recalcular: calcula
    };
  }

  function editorReceta(p, c, cont){
    if(!insumos.length){ enlace.aviso('Primero agrega al menos un insumo.'); return; }
    const { caja, cerrar } = modal('Receta: ' + p.nombre, 620);
    caja.appendChild(h('p', 'nota', 'Cantidad de cada insumo que lleva UNA porción. Al vender 3, se descuenta el triple.', 'margin:0 0 8px;'));
    const ed = armarEditorLineas(caja, () => Number(p.precio), c ? c.lineas : [], { lineaInicial: true });
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
      cerrar(); pintarRecetas(cont);
    }, 'principal'));
    caja.appendChild(fila);
  }

  // Receta dentro del formulario de Editar / Nuevo producto. Devuelve un control con sucio(), error() y guardar(idProducto).
  // Solo guarda la receta si el encargado la tocó (guardar la receta vuelve a tomar los costos actuales como referencia).
  async function montarRecetaProducto(cont, producto, getPrecio, alCambiar, vigente){
    cont.textContent = '';
    const ctl = { sucio: () => false, error: () => '', guardar: async () => '' };
    cont.appendChild(h('div', 'nota', 'Cargando insumos…', 'font-size:12.5px; color:var(--texto-suave); line-height:1.45;'));
    try { await Promise.all([cargarInsumos(), producto ? cargarCosteo() : Promise.resolve()]); }
    catch(e){ cont.textContent = ''; cont.appendChild(h('p', 'nota', 'No se pudo cargar la receta: ' + ((e && e.message) || e), 'color:var(--error); font-size:12.5px;')); return ctl; }
    if(vigente && !vigente()) return ctl;   // se cerró o reabrió el formulario mientras cargaba
    cont.textContent = '';
    if(!insumos.length){
      cont.appendChild(h('p', 'nota', 'Para armar la receta primero registra tus insumos (carne, tortillas, aceite…) con su costo.', 'margin:0 0 8px; font-size:12.5px; color:var(--texto-suave); line-height:1.45;'));
      cont.appendChild(boton('Ir a Recetas e insumos', async () => { enlace.irAInsumos(); }, 'editar'));
      return ctl;
    }
    let sucio = false;
    const c = producto ? costeo.find((x) => x.producto_id === producto.id) : null;
    const ed = armarEditorLineas(cont, getPrecio, c ? c.lineas : [], { alCambiar: () => { sucio = true; if(alCambiar) alCambiar(); } });
    ctl.sucio = () => sucio; ctl.recalcular = ed.recalcular;
    ctl.error = () => sucio ? ed.error() : '';
    ctl.guardar = async (idProducto) => {
      if(!sucio) return '';
      const { error } = await enlace.sb.rpc('receta_guardar', { p_producto: idProducto, p_lineas: ed.valores() });
      return error ? error.message : '';
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
