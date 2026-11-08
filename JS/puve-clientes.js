/* PUVE - Etapa 13.
 * Inventario → Clientes: Fechas (cumpleaños, aniversarios; módulo PuveGestion), Seguimientos (recompra o próximo servicio) y Lista de espera de producto.
 * Inventario → Reportes: Margen y rotación por marca, y Comisiones por vendedor (solo encargado).
 * Datos por funciones del SQL 128. PUVE NO manda mensajes solo: abre WhatsApp con el texto y tú lo envías.
 * Los seguimientos no se llenan solos desde la caja: se capturan aquí, y solo con la casilla «el cliente aceptó recibir avisos».
 */
(function(){
  'use strict';
  let enlace = { sb: null, dinero: (n) => '$' + Number(n).toFixed(2), negocio: () => '' };
  function h(tag, cls, txt, estilo){ const e = document.createElement(tag); if(cls) e.className = cls; if(txt != null) e.textContent = txt; if(estilo) e.style.cssText = estilo; return e; }
  function boton(txt, fn, cls, estilo){ const b = h('button', cls || 'texto', txt, 'width:auto; padding:7px 12px;' + (estilo || '')); b.type = 'button'; b.onclick = fn; return b; }
  function campo(et, el, ancho){ const w = h('label', null, et, 'display:flex; flex-direction:column; gap:4px; font-size:13px; font-weight:500;' + (ancho ? 'flex:1 1 ' + ancho + 'px;' : '')); w.appendChild(el); return w; }
  const input = (v, ph, max, tipo) => { const i = h('input', 'input-mini'); if(tipo) i.type = tipo; if(v != null && v !== '') i.value = v; if(ph) i.placeholder = ph; if(max) i.maxLength = max; return i; };
  const sel = (ops) => { const s = h('select', 'input-mini'); ops.forEach(([v, t]) => { const o = h('option', null, t); o.value = v; s.appendChild(o); }); return s; };
  const msg = (z, t, ok) => { z.textContent = t; z.style.cssText = 'font-size:13px; margin:8px 0; color:' + (ok ? '#16a34a' : 'var(--error,#b91c1c)') + ';'; };
  function errTxt(e){ const m = (e && e.message) || String(e); return /does not exist|schema cache|Could not find/i.test(m) ? 'Falta ejecutar el script SQL 128 en Supabase.' : m; }
  async function rpc(f, a){ const r = await enlace.sb.rpc(f, a); if(r.error) throw r.error; return r.data; }
  const din = (n) => enlace.dinero(Number(n) || 0);
  const fmt = (n) => Number(n).toLocaleString('es-MX', { maximumFractionDigits: 2 });
  const fechaCorta = (iso) => new Date(String(iso).slice(0, 10) + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
  const nombreNeg = () => { try { return enlace.negocio() || ''; } catch(e){ return ''; } };
  const hoyISO = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
  function wa(tel, texto){ let d = String(tel || '').replace(/\D/g, ''); if(d.length === 10) d = '52' + d; else if(d.length === 13 && d.startsWith('521')) d = '52' + d.slice(3); if(d.length < 11){ window.alert('El teléfono no parece válido para WhatsApp.'); return false; } window.open('https://wa.me/' + d + '?text=' + encodeURIComponent(texto), '_blank', 'noopener'); return true; }
  function tabla(cols, filas){ const w = h('div', 'envoltura-tabla'), t = h('table'), th = h('thead'), tr0 = h('tr'); cols.forEach((c) => tr0.appendChild(h('th', null, c))); th.appendChild(tr0); t.appendChild(th); const tb = h('tbody'); filas.forEach((f) => { const tr = h('tr'); f.forEach((c, i) => { const td = h('td'); if(c instanceof Node) td.appendChild(c); else { td.textContent = c; if(i === 0) td.style.fontWeight = '600'; } tr.appendChild(td); }); tb.appendChild(tr); }); t.appendChild(tb); w.appendChild(t); return w; }
  function subtabs(raiz, lista, actual, alElegir){
    const bar = h('div', null, null, 'display:flex; gap:6px; flex-wrap:wrap; margin-bottom:12px;'); const bs = {};
    lista.forEach(([k, t]) => { const b = boton(t, () => { Object.keys(bs).forEach((x) => { bs[x].style.fontWeight = x === k ? '700' : '400'; }); alElegir(k); }); b.style.fontWeight = k === actual ? '700' : '400'; bs[k] = b; bar.appendChild(b); }); raiz.appendChild(bar);
  }

  // ================= CLIENTES =================
  let rCli = null, tabCli = 'seguimientos', zCli = null;
  function abrir(){
    rCli = rCli || document.getElementById('vistaInventarioClientes'); if(!rCli) return; rCli.textContent = '';
    subtabs(rCli, [['seguimientos', 'Seguimientos'], ['espera', 'Lista de espera'], ['fechas', 'Fechas']], tabCli, (k) => { tabCli = k; pintaCli(); });
    zCli = h('div'); rCli.appendChild(zCli); pintaCli();
  }
  function pintaCli(){ zCli.textContent = ''; ({ seguimientos, espera, fechas })[tabCli](zCli); }
  function fechas(z){ if(window.PuveGestion) window.PuveGestion.fechas(z); }

  // ---- Seguimientos ----
  async function seguimientos(z){
    z.appendChild(h('p', 'nota', 'Programa el aviso para cuando a tu cliente se le acaba lo que compró (un bote, un alimento) o le toca su siguiente servicio. Solo con su permiso: marca la casilla. No se llena solo desde la caja.', 'margin:0 0 10px;'));
    const zf = h('div'), zl = h('div'); z.appendChild(zf); z.appendChild(zl);
    const nom = input('', 'Nombre', 80), tel = input('', 'Teléfono (10 dígitos)', 20, 'tel'), con = input('', 'Ej. Proteína 2 kg, cambio de aceite…', 120), fe = input(hoyISO(), '', 10, 'date'), di = input('30', '', 4, 'number'), nota = input('', 'Nota (opcional)', 120), est = h('div');
    fe.max = hoyISO(); di.min = '1'; di.max = '730'; di.style.width = '90px';
    const ck = h('input'); ck.type = 'checkbox'; ck.style.cssText = 'width:18px; height:18px; margin:0;'; const lk = h('label', null, null, 'display:flex; gap:8px; align-items:center; font-size:13.5px; margin-top:8px;'); lk.appendChild(ck); lk.appendChild(document.createTextNode('El cliente aceptó recibir este aviso por WhatsApp'));
    const rap = h('div', null, null, 'display:flex; gap:6px; flex-wrap:wrap; margin-top:4px;'); [30, 60, 90, 180].forEach((n) => rap.appendChild(boton(n + ' días', () => { di.value = String(n); }, 'texto', 'padding:4px 8px; font-size:12px;')));
    const fo = h('div', 'bloque-analitica', null, 'margin:6px 0 14px;'); fo.appendChild(h('h3', null, 'Nuevo seguimiento'));
    const f1 = h('div', null, null, 'display:flex; gap:10px; flex-wrap:wrap;'); [campo('Cliente', nom, 150), campo('Teléfono', tel, 140), campo('Qué compró o qué servicio', con, 240), campo('Fecha', fe, 130), campo('Se repite cada (días)', di, 120)].forEach((x) => f1.appendChild(x)); fo.appendChild(f1); fo.appendChild(rap); fo.appendChild(campo('Nota', nota, 260)); fo.appendChild(lk);
    fo.appendChild(boton('Guardar seguimiento', async () => { if(!nom.value.trim()) return msg(est, 'Escribe el nombre.'); if(!con.value.trim()) return msg(est, 'Escribe qué compró o qué servicio se hizo.'); if(!ck.checked) return msg(est, 'Marca que el cliente aceptó recibir avisos.');
      try { await rpc('seguimiento_guardar', { p_cliente: nom.value.trim(), p_telefono: tel.value.trim(), p_concepto: con.value.trim(), p_fecha: fe.value || hoyISO(), p_dias: Math.round(Number(di.value)) || 0, p_acepta: ck.checked, p_nota: nota.value.trim() || null }); pintaCli(); } catch(e){ msg(est, errTxt(e)); } }, 'principal', 'margin-top:10px;')); fo.appendChild(est); zf.appendChild(fo);
    const modo = sel([['7', 'Por avisar (próximos 7 días y vencidos)'], ['0', 'Solo vencidos y de hoy'], ['todos', 'Todos los activos']]); zl.appendChild(campo('Ver', modo, 260)); const lz = h('div', null, null, 'margin-top:8px;'); zl.appendChild(lz);
    const cargar = async () => { lz.textContent = ''; try { const l = await rpc('seguimientos_lista', { p_adelante: modo.value === 'todos' ? 0 : Number(modo.value), p_todos: modo.value === 'todos' });
      if(!l.length){ lz.appendChild(h('p', 'nota', 'No hay seguimientos para mostrar.')); return; }
      l.forEach((x) => { const r = h('div', null, null, 'border:1px solid var(--borde); border-radius:10px; padding:8px 12px; margin-bottom:8px;'); const t = h('div', null, null, 'display:flex; gap:8px; align-items:center; flex-wrap:wrap;');
        t.appendChild(h('strong', null, x.cliente + ' · ' + x.concepto)); const cuando = x.faltan < 0 ? 'Venció hace ' + (-x.faltan) + ' día' + (x.faltan === -1 ? '' : 's') : x.faltan === 0 ? 'Vence hoy' : 'Vence en ' + x.faltan + ' día' + (x.faltan === 1 ? '' : 's');
        t.appendChild(h('span', null, cuando, 'border-radius:6px; padding:2px 8px; font-size:12px; font-weight:700; background:' + (x.faltan <= 0 ? '#fee2e2' : x.faltan <= 7 ? '#fef3c7' : '#e2e8f0') + '; color:' + (x.faltan <= 0 ? '#991b1b' : x.faltan <= 7 ? '#92400e' : '#334155') + ';')); r.appendChild(t);
        r.appendChild(h('div', 'nota', 'Compra: ' + fechaCorta(x.fecha_base) + ' · cada ' + x.dias + ' días · toca el ' + fechaCorta(x.vence) + (x.ultimo_aviso ? ' · avisado el ' + fechaCorta(x.ultimo_aviso) : '') + (x.nota ? ' · ' + x.nota : ''), 'margin-top:3px;'));
        const ac = h('div', null, null, 'display:flex; gap:8px; margin-top:6px; flex-wrap:wrap;'); const e2 = h('div');
        ac.appendChild(boton('Avisar por WhatsApp', async () => { const n = nombreNeg(); if(wa(x.telefono, 'Hola ' + x.cliente + ' 👋' + (n ? ' de parte de ' + n + ':' : '') + ' ya toca renovar tu ' + x.concepto + '. ¿Te lo apartamos?')){ try { await rpc('seguimiento_accion', { p_id: x.id, p_accion: 'avisado' }); } catch(e){} cargar(); } }));
        ac.appendChild(boton('Volvió a comprar', async () => { try { await rpc('seguimiento_accion', { p_id: x.id, p_accion: 'volvio' }); cargar(); } catch(e){ msg(e2, errTxt(e)); } }));
        ac.appendChild(boton('Cerrar', async () => { if(!window.confirm('¿Dejar de dar seguimiento a ' + x.cliente + ' por «' + x.concepto + '»?')) return; try { await rpc('seguimiento_accion', { p_id: x.id, p_accion: 'cerrar' }); cargar(); } catch(e){ msg(e2, errTxt(e)); } }));
        r.appendChild(ac); r.appendChild(e2); lz.appendChild(r); }); } catch(e){ msg(lz, errTxt(e)); } };
    modo.onchange = cargar; await cargar();
  }

  // ---- Lista de espera de producto ----
  async function espera(z){
    z.appendChild(h('p', 'nota', '«Avísame cuando llegue»: anota qué espera tu cliente (una talla, un sabor, un modelo). Si lo ligas a un producto, PUVE marca «ya llegó» cuando tenga existencias.', 'margin:0 0 10px;'));
    let prod = null; const des = input('', 'Ej. Tenis negros talla 27', 120), nom = input('', 'Cliente', 80), tel = input('', 'Teléfono', 20, 'tel'), q = input('', 'Buscar el producto (opcional)…', 40), res = h('div', null, null, 'display:flex; gap:6px; flex-wrap:wrap; margin:6px 0;'), sl = h('div', 'nota'), est = h('div'); let tm = 0;
    const fo = h('div', 'bloque-analitica', null, 'margin:6px 0 14px;'); fo.appendChild(h('h3', null, 'Agregar a la espera')); const f1 = h('div', null, null, 'display:flex; gap:10px; flex-wrap:wrap;'); [campo('Qué espera', des, 240), campo('Cliente', nom, 150), campo('Teléfono', tel, 140)].forEach((x) => f1.appendChild(x)); fo.appendChild(f1);
    q.oninput = () => { clearTimeout(tm); tm = setTimeout(async () => { res.textContent = ''; const t = q.value.replace(/[%_,()\\]/g, ' ').trim(); if(t.length < 2) return; const r = await enlace.sb.from('productos').select('id,nombre').eq('activo', true).ilike('nombre', '%' + t + '%').order('nombre').limit(8); if(r.error){ msg(est, errTxt(r.error)); return; }
      r.data.forEach((p) => res.appendChild(boton(p.nombre, () => { prod = p; sl.textContent = 'Ligado a: ' + p.nombre; if(!des.value.trim()) des.value = p.nombre; res.textContent = ''; q.value = ''; }))); }, 250); };
    fo.appendChild(campo('Producto ligado', q, 260)); fo.appendChild(res); fo.appendChild(sl);
    fo.appendChild(boton('Agregar', async () => { if(!des.value.trim()) return msg(est, 'Escribe qué espera.'); if(!nom.value.trim()) return msg(est, 'Escribe el nombre.'); try { await rpc('espera_producto_agregar', { p_producto: prod ? prod.id : null, p_descripcion: des.value.trim(), p_cliente: nom.value.trim(), p_telefono: tel.value.trim() || null }); pintaCli(); } catch(e){ msg(est, errTxt(e)); } }, 'principal', 'margin-top:8px;')); fo.appendChild(est); z.appendChild(fo);
    try { const l = await rpc('espera_producto_lista'); if(!l.length){ z.appendChild(h('p', 'nota', 'La lista de espera está vacía.')); return; }
      l.forEach((x) => { const r = h('div', null, null, 'display:flex; gap:8px; align-items:center; flex-wrap:wrap; padding:7px 0; border-top:1px solid var(--borde);'); r.appendChild(h('strong', null, x.cliente + ' · ' + x.descripcion, 'flex:1 1 220px;'));
        if(x.ya_llego) r.appendChild(h('span', null, 'Ya llegó ✓', 'background:#dcfce7; color:#166534; border-radius:6px; padding:2px 8px; font-size:12px; font-weight:700;')); if(x.estado === 'avisado') r.appendChild(h('span', null, 'Avisado', 'background:#fef3c7; color:#92400e; border-radius:6px; padding:2px 8px; font-size:12px; font-weight:700;'));
        if(x.telefono) r.appendChild(boton('Avisar por WhatsApp', async () => { const n = nombreNeg(); if(wa(x.telefono, 'Hola ' + x.cliente + ' 👋 ya llegó lo que esperabas: ' + x.descripcion + (n ? ' (' + n + ')' : '') + '. ¿Te lo apartamos?')){ try { await rpc('espera_producto_estado', { p_id: x.id, p_estado: 'avisado' }); } catch(e){} pintaCli(); } }));
        r.appendChild(boton('Entregado', async () => { try { await rpc('espera_producto_estado', { p_id: x.id, p_estado: 'entregado' }); pintaCli(); } catch(e){ msg(est, errTxt(e)); } })); r.appendChild(boton('Quitar', async () => { try { await rpc('espera_producto_estado', { p_id: x.id, p_estado: 'quitado' }); pintaCli(); } catch(e){ msg(est, errTxt(e)); } })); z.appendChild(r); });
    } catch(e){ msg(z, errTxt(e)); }
  }

  // ================= REPORTES (encargado) =================
  let rRep = null, tabRep = 'marcas', zRep = null;
  function abrirReportes(){
    rRep = rRep || document.getElementById('vistaInventarioReportes'); if(!rRep) return; rRep.textContent = '';
    subtabs(rRep, [['marcas', 'Por marca'], ['comisiones', 'Comisiones']], tabRep, (k) => { tabRep = k; pintaRep(); });
    zRep = h('div'); rRep.appendChild(zRep); pintaRep();
  }
  function pintaRep(){ zRep.textContent = ''; ({ marcas, comisiones })[tabRep](zRep); }

  // ---- Margen y rotación por marca ----
  async function marcas(z){
    z.appendChild(h('p', 'nota', 'Asigna a cada producto su marca (o laboratorio, proveedor…) y compara qué marcas te dejan más ganancia y cuáles se quedan paradas. La utilidad se calcula con el costo actual de cada producto. Solo el encargado.', 'margin:0 0 10px;'));
    const per = sel([['30', 'Últimos 30 días'], ['90', 'Últimos 90 días'], ['180', 'Últimos 180 días'], ['365', 'Último año']]); per.value = '90'; z.appendChild(campo('Periodo', per, 160)); const zr = h('div', null, null, 'margin-top:10px;'); z.appendChild(zr); const za = h('div', null, null, 'margin-top:22px;'); z.appendChild(za);
    const cargar = async () => { zr.textContent = ''; try { const l = await rpc('marcas_resumen', { p_dias: Number(per.value) }); const conMarca = l.filter((x) => x.marca !== 'Sin marca').length;
      if(!conMarca) zr.appendChild(h('p', 'nota', 'Todavía no hay marcas asignadas. Asígnalas abajo y vuelve a esta tabla.'));
      zr.appendChild(tabla(['Marca', 'Productos', 'Vendido', 'Utilidad', 'Margen', 'Días de inventario', 'Stock a costo'], l.map((x) => [x.marca, String(x.productos), din(x.ventas), din(x.utilidad), x.margen == null ? '—' : x.margen + '%', x.dias_inventario == null ? 'Sin ventas' : fmt(x.dias_inventario) + ' d', din(x.valor_stock)])));
      zr.appendChild(h('p', 'nota', 'Días de inventario = cuánto te dura el stock actual al ritmo de venta del periodo (menos días = rota más rápido).', 'margin-top:6px;')); } catch(e){ msg(zr, errTxt(e)); } };
    per.onchange = cargar; cargar(); asignar(za, cargar);
  }
  async function asignar(z, alGuardar){
    z.appendChild(h('h3', null, 'Asignar marcas', 'margin:0 0 6px;')); const est = h('div'), zl = h('div'); let prods = [], cambios = {};
    const q = input('', 'Buscar producto…', 40), masiva = input('', 'Marca para los marcados', 60), dl = h('datalist'); dl.id = 'listaMarcasPuve';
    const barra = h('div', null, null, 'display:flex; gap:8px; flex-wrap:wrap; align-items:end;'); barra.appendChild(campo('Buscar', q, 160)); barra.appendChild(campo('Poner esta marca a los marcados', masiva, 200)); masiva.setAttribute('list', 'listaMarcasPuve'); z.appendChild(dl); z.appendChild(barra); z.appendChild(zl); z.appendChild(est);
    try { const r = await enlace.sb.from('productos').select('id,nombre,marca').eq('activo', true).eq('es_combo', false).neq('tipo', 'servicio').order('nombre').limit(1000); if(r.error) throw r.error; prods = r.data || []; } catch(e){ msg(est, /marca/.test(e.message || '') ? 'Falta ejecutar el script SQL 128 en Supabase.' : errTxt(e)); return; }
    [...new Set(prods.map((p) => p.marca).filter(Boolean))].sort().forEach((m) => { const o = h('option'); o.value = m; dl.appendChild(o); });
    const visibles = () => prods.filter((p) => !q.value.trim() || p.nombre.toLowerCase().includes(q.value.trim().toLowerCase()));
    const pinta = () => { zl.textContent = ''; const v = visibles().slice(0, 200); if(!v.length){ zl.appendChild(h('p', 'nota', 'No hay productos.')); return; }
      zl.appendChild(tabla(['', 'Producto', 'Marca'], v.map((p) => { const ck = h('input'); ck.type = 'checkbox'; ck.dataset.pid = p.id; ck.style.cssText = 'width:16px; height:16px;'; const i = input(cambios[p.id] !== undefined ? cambios[p.id] : (p.marca || ''), 'Sin marca', 60); i.setAttribute('list', 'listaMarcasPuve'); i.oninput = () => { cambios[p.id] = i.value; }; return [ck, p.nombre, i]; })));
      if(visibles().length > 200) zl.appendChild(h('p', 'nota', 'Se muestran los primeros 200; usa la búsqueda.')); };
    q.oninput = pinta; pinta();
    const ac = h('div', null, null, 'display:flex; gap:8px; margin-top:10px; flex-wrap:wrap;');
    ac.appendChild(boton('Aplicar a los marcados', () => { const m = masiva.value.trim(); if(!m) return msg(est, 'Escribe la marca.'); const ids = [...zl.querySelectorAll('input[data-pid]:checked')].map((x) => x.dataset.pid); if(!ids.length) return msg(est, 'Marca primero los productos.'); ids.forEach((id) => { cambios[id] = m; }); pinta(); msg(est, 'Listo: pulsa «Guardar marcas».', true); }));
    const gd = boton('Guardar marcas', async () => { const items = Object.keys(cambios).map((id) => ({ producto_id: id, marca: cambios[id] })); if(!items.length) return msg(est, 'No hay cambios.'); if(items.length > 300) return msg(est, 'Guarda de 300 en 300 productos como máximo.'); gd.disabled = true;
      try { const n = await rpc('marca_asignar', { p_items: items }); items.forEach((i) => { const p = prods.find((x) => x.id === i.producto_id); if(p) p.marca = i.marca.trim() || null; }); cambios = {}; gd.disabled = false; msg(est, n + ' producto(s) actualizados.', true); alGuardar(); } catch(e){ gd.disabled = false; msg(est, errTxt(e)); } }, 'principal');
    ac.appendChild(gd); z.appendChild(ac);
  }

  // ---- Comisiones ----
  async function comisiones(z){
    z.appendChild(h('p', 'nota', 'Ventas por persona en el periodo, menos las devoluciones de ese periodo sobre sus ventas. Pon el porcentaje de comisión y, si quieres, una meta mensual. Solo el encargado.', 'margin:0 0 10px;'));
    const per = sel([['mes', 'Este mes'], ['pasado', 'Mes pasado'], ['7', 'Últimos 7 días'], ['30', 'Últimos 30 días']]); z.appendChild(campo('Periodo', per, 160)); const zr = h('div', null, null, 'margin-top:10px;'); z.appendChild(zr);
    const rango = () => { const f = (d) => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); }, hoy = new Date();
      if(per.value === 'mes') return [f(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), f(hoy), true]; if(per.value === 'pasado') return [f(new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)), f(new Date(hoy.getFullYear(), hoy.getMonth(), 0)), true];
      const n = Number(per.value); return [f(new Date(hoy.getTime() - (n - 1) * 864e5)), f(hoy), false]; };
    const cargar = async () => { zr.textContent = ''; const [d, hh, esMes] = rango(); try { const l = await rpc('comisiones_resumen', { p_desde: d, p_hasta: hh }); if(!l.length){ zr.appendChild(h('p', 'nota', 'No hay personas con ventas para mostrar.')); return; }
      let total = 0; const filas = l.map((x) => { const pc = input(x.porcentaje, '0', 6, 'number'), mt = input(x.meta == null ? '' : x.meta, 'Meta', 10, 'number'); [pc, mt].forEach((i) => { i.min = '0'; i.step = '0.01'; i.style.width = '82px'; }); const com = h('span', null, din(x.comision)); total += Number(x.comision);
        const av = esMes && x.meta ? Math.round(Number(x.neto) / Number(x.meta) * 100) + '%' : '—'; const e2 = h('span', 'nota');
        const gd = boton('Guardar', async () => { try { await rpc('comision_config_guardar', { p_usuario: x.usuario_id, p_porcentaje: Number(pc.value) || 0, p_meta: mt.value === '' ? null : Number(mt.value) }); cargar(); } catch(e){ msg(e2, errTxt(e)); } }, 'texto', 'padding:4px 9px;');
        return [x.nombre + ' (' + x.rol + ')', String(x.tickets), din(x.ventas), din(x.devoluciones), din(x.neto), pc, mt, com, av, gd]; });
      zr.appendChild(tabla(['Persona', 'Tickets', 'Vendido', 'Devoluciones', 'Neto', '% comisión', 'Meta mensual', 'Comisión', 'Avance de meta', ''], filas));
      zr.appendChild(h('p', null, 'Comisiones del periodo: ' + din(total), 'font-weight:700; margin-top:8px;')); zr.appendChild(h('p', 'nota', 'El avance de meta solo se muestra con «Este mes» o «Mes pasado». Cambiar el porcentaje cambia el cálculo de todos los periodos, también los pasados.', 'margin-top:4px;')); } catch(e){ msg(zr, errTxt(e)); } };
    per.onchange = cargar; cargar();
  }

  window.PuveClientes = { enlazar(o){ enlace = Object.assign(enlace, o || {}); }, abrir, abrirReportes };
})();
