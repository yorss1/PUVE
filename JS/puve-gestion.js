/* PUVE - Etapa 12: Precios y margen en masa, Conteo cíclico, Fechas importantes de clientes (Inventario) y Capacidad de encargos (Encargos).
 * Datos por funciones del SQL 125. Precios y capacidad solo los cambia el administrador (lo valida el servidor).
 * El conteo es a ciegas: no muestra existencias a quien cuenta; el administrador ve después las diferencias.
 * La capacidad NO bloquea un encargo: solo avisa al elegir la fecha de entrega y se ve en el panel de Encargos.
 */
(function(){
  'use strict';
  let enlace = { sb: null, dinero: (n) => '$' + Number(n).toFixed(2), negocio: () => '', esAdmin: () => false };
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  function h(tag, cls, txt, estilo){ const e = document.createElement(tag); if(cls) e.className = cls; if(txt != null) e.textContent = txt; if(estilo) e.style.cssText = estilo; return e; }
  function boton(txt, fn, cls, estilo){ const b = h('button', cls || 'texto', txt, 'width:auto; padding:7px 12px;' + (estilo || '')); b.type = 'button'; b.onclick = fn; return b; }
  function campo(et, el, ancho){ const w = h('label', null, et, 'display:flex; flex-direction:column; gap:4px; font-size:13px; font-weight:500;' + (ancho ? 'flex:1 1 ' + ancho + 'px;' : '')); w.appendChild(el); return w; }
  const input = (v, ph, max, tipo) => { const i = h('input', 'input-mini'); if(tipo) i.type = tipo; if(v != null && v !== '') i.value = v; if(ph) i.placeholder = ph; if(max) i.maxLength = max; return i; };
  const sel = (ops) => { const s = h('select', 'input-mini'); ops.forEach(([v, t]) => { const o = h('option', null, t); o.value = v; s.appendChild(o); }); return s; };
  const msg = (z, t, ok) => { z.textContent = t; z.style.cssText = 'font-size:13px; margin:8px 0; color:' + (ok ? '#16a34a' : 'var(--error,#b91c1c)') + ';'; };
  function errTxt(e){ const m = (e && e.message) || String(e); return /does not exist|schema cache|Could not find/i.test(m) ? 'Falta ejecutar el script SQL 125 en Supabase.' : m; }
  async function rpc(f, a){ const r = await enlace.sb.rpc(f, a); if(r.error) throw r.error; return r.data; }
  const din = (n) => enlace.dinero(Number(n) || 0);
  const fmt = (n) => Number(n).toLocaleString('es-MX', { maximumFractionDigits: 2 });
  const fecha = (iso) => new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  const fechaDia = (iso) => { const d = new Date(String(iso).slice(0, 10) + 'T12:00:00'); return d.getDate() + ' ' + MESES[d.getMonth()].slice(0, 3); };
  function wa(tel, texto){ let d = String(tel || '').replace(/\D/g, ''); if(d.length === 10) d = '52' + d; else if(d.length === 13 && d.startsWith('521')) d = '52' + d.slice(3); if(d.length < 11){ window.alert('El teléfono no parece válido para WhatsApp.'); return false; } window.open('https://wa.me/' + d + '?text=' + encodeURIComponent(texto), '_blank', 'noopener'); return true; }
  function tabla(cols, filas){ const w = h('div', 'envoltura-tabla'), t = h('table'), th = h('thead'), tr0 = h('tr'); cols.forEach((c) => tr0.appendChild(h('th', null, c))); th.appendChild(tr0); t.appendChild(th); const tb = h('tbody'); filas.forEach((f) => { const tr = h('tr'); f.forEach((c, i) => { const td = h('td'); if(c instanceof Node) td.appendChild(c); else { td.textContent = c; if(i === 0) td.style.fontWeight = '600'; } tr.appendChild(td); }); tb.appendChild(tr); }); t.appendChild(tb); w.appendChild(t); return w; }

  // ================= PRECIOS Y MARGEN EN MASA =================
  let zPre = null, prods = [], cambios = {};
  async function precios(){
    zPre = zPre || document.getElementById('vistaInventarioPrecios'); if(!zPre) return; zPre.textContent = ''; cambios = {};
    zPre.appendChild(h('h3', null, 'Precios y margen', 'margin:0 0 4px;')); zPre.appendChild(h('p', 'nota', 'Cambia precios y costos de varios productos a la vez y ve cuánto ganas en cada uno. Solo el administrador puede guardar. Los productos con precio automático por receta no se modifican aquí.', 'margin:0 0 10px;'));
    const barra = h('div', null, null, 'display:flex; gap:8px; flex-wrap:wrap; align-items:end; margin-bottom:10px;'); zPre.appendChild(barra); const zl = h('div'); zPre.appendChild(zl); const est = h('div'); zPre.appendChild(est);
    try { const r = await enlace.sb.from('productos').select('id,nombre,precio,costo,precio_auto').eq('activo', true).eq('es_combo', false).neq('tipo', 'servicio').order('nombre').limit(1000); if(r.error) throw r.error; prods = r.data || []; } catch(e){ msg(est, errTxt(e)); return; }
    const q = input('', 'Buscar producto…', 40), pct = input('', 'Ej. 5 o -3', 6, 'number'), mar = input('', 'Ej. 30', 5, 'number'), red = sel([['0', 'Sin redondeo'], ['0.5', 'A $0.50'], ['1', 'A $1']]);
    pct.step = 'any'; mar.step = 'any';
    barra.appendChild(campo('Buscar', q, 150)); barra.appendChild(campo('Subir o bajar %', pct, 100)); barra.appendChild(campo('Margen objetivo %', mar, 100)); barra.appendChild(campo('Redondeo', red, 110));
    const redondea = (v) => { const r = Number(red.value); return r ? Math.round(v / r) * r : Math.round(v * 100) / 100; };
    const visibles = () => prods.filter((p) => !q.value.trim() || p.nombre.toLowerCase().includes(q.value.trim().toLowerCase()));
    const elegidos = () => { const c = zl.querySelectorAll('input[data-pid]:checked'); const ids = new Set([...c].map((x) => x.dataset.pid)); return ids.size ? visibles().filter((p) => ids.has(p.id)) : visibles(); };
    barra.appendChild(boton('Aplicar %', () => { const v = Number(pct.value); if(!pct.value || !isFinite(v)) return msg(est, 'Escribe el porcentaje.'); elegidos().forEach((p) => { if(!p.precio_auto) cambios[p.id] = Object.assign(cambios[p.id] || {}, { precio: redondea(Number(p.precio) * (1 + v / 100)) }); }); pintar(); msg(est, 'Revisa los precios y pulsa «Guardar cambios».', true); }));
    barra.appendChild(boton('Aplicar margen', () => { const m = Number(mar.value); if(!mar.value || !(m >= 0 && m < 95)) return msg(est, 'El margen debe estar entre 0 y 94.'); let n = 0; elegidos().forEach((p) => { const c = Number((cambios[p.id] && cambios[p.id].costo) ?? p.costo); if(p.precio_auto || !(c > 0)) return; cambios[p.id] = Object.assign(cambios[p.id] || {}, { precio: redondea(c / (1 - m / 100)) }); n++; }); pintar(); msg(est, n ? 'Precios sugeridos con margen del ' + m + '%. Revísalos y guarda.' : 'Ningún producto tiene costo capturado.', !!n); }));
    q.oninput = () => pintar();
    function pintar(){
      zl.textContent = ''; const v = visibles().slice(0, 300); if(!v.length){ zl.appendChild(h('p', 'nota', 'No hay productos.')); return; }
      const filas = v.map((p) => { const c = cambios[p.id] || {}, pr = c.precio ?? Number(p.precio), co = c.costo ?? Number(p.costo);
        const ck = h('input'); ck.type = 'checkbox'; ck.dataset.pid = p.id; ck.style.cssText = 'width:16px; height:16px;';
        const ip = input(pr, '', 9, 'number'), ic = input(co, '', 9, 'number'); [ip, ic].forEach((i) => { i.min = '0'; i.step = '0.01'; i.style.width = '84px'; }); if(p.precio_auto){ ip.disabled = true; }
        const m = h('span'); const calc = () => { const a = Number(ip.value) || 0, b = Number(ic.value) || 0; const ganancia = a - b; const mg = a > 0 && b > 0 ? Math.round((ganancia / a) * 100) : null; m.textContent = b > 0 ? din(ganancia) + ' · ' + mg + '%' : 'Sin costo'; m.style.color = mg == null ? 'var(--texto-suave,#64748b)' : (mg < 15 ? '#b91c1c' : (mg < 30 ? '#b45309' : '#15803d')); };
        calc(); ip.oninput = () => { cambios[p.id] = Object.assign(cambios[p.id] || {}, { precio: Number(ip.value) }); calc(); }; ic.oninput = () => { cambios[p.id] = Object.assign(cambios[p.id] || {}, { costo: Number(ic.value) }); calc(); };
        return [ck, p.nombre + (p.precio_auto ? ' (precio automático)' : ''), ic, ip, m]; });
      zl.appendChild(tabla(['', 'Producto', 'Costo', 'Precio', 'Ganancia y margen'], filas)); if(visibles().length > 300) zl.appendChild(h('p', 'nota', 'Se muestran los primeros 300; usa la búsqueda para acotar.'));
    }
    pintar();
    const ac = h('div', null, null, 'display:flex; gap:8px; margin-top:12px; flex-wrap:wrap;'); const hz = h('div');
    const gd = boton('Guardar cambios', async () => { const items = Object.keys(cambios).map((id) => { const p = prods.find((x) => x.id === id), c = cambios[id]; return { producto_id: id, precio: c.precio ?? Number(p.precio), costo: c.costo ?? Number(p.costo) }; }).filter((i) => i.precio >= 0);
      if(!items.length) return msg(est, 'No hay cambios por guardar.'); if(items.length > 200) return msg(est, 'Guarda de 200 en 200 productos como máximo.'); gd.disabled = true;
      try { const r = await rpc('precios_actualizar', { p_items: items }); msg(est, r.actualizados + ' producto(s) actualizados' + (r.omitidos ? ', ' + r.omitidos + ' sin cambio u omitidos' : '') + '.', true); gd.disabled = false; setTimeout(precios, 900); } catch(e){ gd.disabled = false; msg(est, errTxt(e)); } }, 'principal');
    ac.appendChild(gd); ac.appendChild(boton('Ver cambios recientes', async () => { hz.textContent = ''; try { const l = await rpc('precios_historial_lista', { p_limite: 40 }); if(!l.length){ hz.appendChild(h('p', 'nota', 'Sin cambios registrados (o solo el administrador los ve).')); return; } hz.appendChild(tabla(['Fecha', 'Producto', 'Precio', 'Costo'], l.map((x) => [fecha(x.cuando), x.producto, din(x.precio_anterior) + ' → ' + din(x.precio_nuevo), din(x.costo_anterior) + ' → ' + din(x.costo_nuevo)]))); } catch(e){ msg(hz, errTxt(e)); } }));
    zPre.appendChild(ac); zPre.appendChild(hz);
  }

  // ================= CONTEO CÍCLICO =================
  let zCon = null;
  async function conteo(){
    zCon = zCon || document.getElementById('vistaInventarioConteo'); if(!zCon) return; zCon.textContent = '';
    zCon.appendChild(h('h3', null, 'Conteo cíclico', 'margin:0 0 4px;')); zCon.appendChild(h('p', 'nota', 'Cuenta unos cuantos productos cada día en lugar de todo el inventario. Quien cuenta no ve las existencias; al guardar, el stock queda igual a lo contado y el administrador ve las diferencias.', 'margin:0 0 10px;'));
    const modo = sel([['mas_tiempo', 'Los que llevan más tiempo sin contar'], ['mas_vendidos', 'Los que más vendes (30 días)'], ['mayor_valor', 'Los de mayor valor en bodega'], ['azar', 'Al azar'], ['categoria', 'Una categoría']]), n = sel([['10', '10 productos'], ['15', '15 productos'], ['25', '25 productos'], ['40', '40 productos']]); n.value = '15';
    const cat = sel([['', 'Categoría…']]); cat.disabled = true; modo.onchange = () => { cat.disabled = modo.value !== 'categoria'; };
    try { const r = await enlace.sb.from('categorias').select('id,nombre').order('nombre'); (r.data || []).forEach((c) => { const o = h('option', null, c.nombre); o.value = c.id; cat.appendChild(o); }); } catch(e){}
    const barra = h('div', null, null, 'display:flex; gap:8px; flex-wrap:wrap; align-items:end;'); barra.appendChild(campo('Qué contar', modo, 220)); barra.appendChild(campo('Cuántos', n, 120)); barra.appendChild(campo('Categoría', cat, 150)); zCon.appendChild(barra);
    const est = h('div'), zl = h('div'), zh = h('div'); let alcance = '';
    barra.appendChild(boton('Empezar conteo', async () => { zl.textContent = ''; est.textContent = ''; if(modo.value === 'categoria' && !cat.value) return msg(est, 'Elige la categoría.');
      try { const l = await rpc('conteo_sugerido', { p_modo: modo.value, p_n: Number(n.value), p_categoria: modo.value === 'categoria' ? cat.value : null }); if(!l.length) return msg(est, 'No hay productos para contar con ese criterio.'); alcance = modo.options[modo.selectedIndex].text; const filas = l.map((x) => { const i = input('', 'Contado', 9, 'number'); i.min = '0'; i.step = 'any'; i.style.width = '100px'; i.dataset.pid = x.producto_id; return [x.nombre, i]; });
        zl.appendChild(tabla(['Producto', 'Cantidad que cuentas'], filas)); const gd = boton('Guardar conteo', async () => { const items = [...zl.querySelectorAll('input[data-pid]')].filter((i) => i.value !== '').map((i) => ({ producto_id: i.dataset.pid, contado: Number(i.value) })); if(!items.length) return msg(est, 'Escribe al menos una cantidad.'); const faltan = l.length - items.length; if(faltan && !window.confirm('Faltan ' + faltan + ' producto(s) sin contar; se omitirán. ¿Guardar?')) return;
          gd.disabled = true; try { const r = await rpc('conteo_ciclico_aplicar', { p_alcance: alcance.slice(0, 60), p_items: items }); zl.textContent = '';
            if(r.detalle){ msg(est, 'Conteo guardado: ' + r.productos + ' producto(s), ' + r.con_diferencia + ' con diferencia (' + din(r.dif_valor) + ' al costo).', true); if(r.detalle.length) zl.appendChild(tabla(['Producto', 'Sistema', 'Contado', 'Diferencia'], r.detalle.map((d) => [d.producto, fmt(d.sistema), fmt(d.contado), (d.diferencia > 0 ? '+' : '') + fmt(d.diferencia)]))); } else msg(est, 'Conteo guardado (' + r.productos + ' productos). Gracias.', true); historial(zh); } catch(e){ gd.disabled = false; msg(est, errTxt(e)); } }, 'principal', 'margin-top:10px;'); zl.appendChild(gd);
      } catch(e){ msg(est, errTxt(e)); } }, 'principal'));
    zCon.appendChild(est); zCon.appendChild(zl); zCon.appendChild(zh); historial(zh);
  }
  async function historial(z){
    z.textContent = ''; try { const l = await rpc('conteos_ciclicos_lista', { p_limite: 10 }); if(!l.length) return; z.appendChild(h('h3', null, 'Conteos anteriores', 'margin:20px 0 6px;'));
      l.forEach((c) => { const b = h('div', null, null, 'border:1px solid var(--borde); border-radius:10px; padding:8px 12px; margin-bottom:8px; font-size:14px;'); b.appendChild(h('strong', null, fecha(c.cuando) + ' · ' + c.alcance + ' · ' + c.productos + ' contados · ' + c.con_diferencia + ' con diferencia · ' + din(c.dif_valor)));
        if(c.detalle.length) b.appendChild(h('div', 'nota', c.detalle.map((d) => d.producto + ' (' + (d.diferencia > 0 ? '+' : '') + fmt(d.diferencia) + ')').join(' · '), 'margin-top:3px;')); z.appendChild(b); }); } catch(e){}
  }

  // ================= FECHAS IMPORTANTES DE CLIENTES =================
  let zFec = null;
  async function fechas(){
    zFec = zFec || document.getElementById('vistaInventarioFechas'); if(!zFec) return; zFec.textContent = '';
    zFec.appendChild(h('h3', null, 'Fechas importantes de tus clientes', 'margin:0 0 4px;')); zFec.appendChild(h('p', 'nota', 'Guarda cumpleaños, aniversarios y otras ocasiones. PUVE te muestra las que vienen y abre WhatsApp con el mensaje; tú lo envías. Guarda solo datos que el cliente te haya dado.', 'margin:0 0 10px;'));
    const zp = h('div'), zf = h('div'), zt = h('div'); zFec.appendChild(zp); zFec.appendChild(zf); zFec.appendChild(zt);
    const est = h('div'); const nom = input('', 'Nombre', 80), tel = input('', 'Teléfono', 20), oc = sel([['Cumpleaños', 'Cumpleaños'], ['Aniversario', 'Aniversario'], ['Día de las madres', 'Día de las madres'], ['__otra', 'Otra…']]), oc2 = input('', 'Ocasión', 60), mes = sel(MESES.map((m, i) => [String(i + 1), m])), dia = sel(Array.from({ length: 31 }, (_, i) => [String(i + 1), String(i + 1)])), nota = input('', 'Nota (ej. le gustan las rosas)', 120);
    oc2.style.display = 'none'; oc.onchange = () => { oc2.style.display = oc.value === '__otra' ? '' : 'none'; };
    const fo = h('div', 'bloque-analitica', null, 'margin:10px 0;'); fo.appendChild(h('h3', null, 'Agregar fecha')); const f1 = h('div', null, null, 'display:flex; gap:10px; flex-wrap:wrap;'); [campo('Cliente', nom, 160), campo('Teléfono', tel, 130), campo('Ocasión', oc, 150), campo('', oc2, 130), campo('Día', dia, 70), campo('Mes', mes, 110)].forEach((x) => f1.appendChild(x)); fo.appendChild(f1); fo.appendChild(campo('Nota', nota, 260));
    fo.appendChild(boton('Guardar fecha', async () => { if(!nom.value.trim()) return msg(est, 'Escribe el nombre.'); const ocasion = oc.value === '__otra' ? oc2.value.trim() : oc.value; if(!ocasion) return msg(est, 'Escribe la ocasión.');
      try { await rpc('cliente_fecha_guardar', { p_cliente: nom.value.trim(), p_telefono: tel.value.trim() || null, p_ocasion: ocasion, p_mes: Number(mes.value), p_dia: Number(dia.value), p_nota: nota.value.trim() || null }); fechas(); } catch(e){ msg(est, errTxt(e)); } }, 'principal', 'margin-top:10px;')); fo.appendChild(est); zf.appendChild(fo);
    try { const l = await rpc('clientes_fechas_proximas', { p_dias: 30 }); zp.appendChild(h('h3', null, 'Próximos 30 días', 'margin:8px 0 6px;')); if(!l.length) zp.appendChild(h('p', 'nota', 'No hay fechas en los próximos 30 días.'));
      l.forEach((x) => { const r = h('div', null, null, 'display:flex; gap:8px; align-items:center; flex-wrap:wrap; padding:7px 0; border-top:1px solid var(--borde);'); r.appendChild(h('strong', null, (x.faltan === 0 ? 'HOY' : x.faltan === 1 ? 'Mañana' : 'En ' + x.faltan + ' días') + ' · ' + x.cliente, 'flex:1 1 200px;')); r.appendChild(h('span', 'nota', x.ocasion + ' · ' + fechaDia(x.fecha) + (x.nota ? ' · ' + x.nota : '')));
        if(x.telefono) r.appendChild(boton('Mandar WhatsApp', () => { const n = enlace.negocio(); wa(x.telefono, x.faltan === 0 ? '¡Feliz ' + x.ocasion.toLowerCase() + ', ' + x.cliente + '! 🎉 Te desea todo el equipo' + (n ? ' de ' + n : '') + '.' : 'Hola ' + x.cliente + ' 👋 se acerca tu ' + x.ocasion.toLowerCase() + ' (' + fechaDia(x.fecha) + '). ¿Quieres que te preparemos algo' + (n ? ' en ' + n : '') + '?'); })); zp.appendChild(r); });
    } catch(e){ msg(zp, errTxt(e)); }
    try { const l = await rpc('clientes_fechas_todas'); if(l.length){ zt.appendChild(h('h3', null, 'Todas las fechas (' + l.length + ')', 'margin:18px 0 6px;')); zt.appendChild(tabla(['Cliente', 'Ocasión', 'Fecha', ''], l.map((x) => [x.cliente, x.ocasion, x.dia + ' de ' + MESES[x.mes - 1], boton('Borrar', async () => { if(!window.confirm('¿Borrar esta fecha de ' + x.cliente + '?')) return; try { await rpc('cliente_fecha_borrar', { p_id: x.id }); fechas(); } catch(e){ msg(est, errTxt(e)); } })]))); } } catch(e){}
  }

  // ================= CAPACIDAD DE ENCARGOS =================
  async function capacidad(z){
    z = z || document.getElementById('encargosCapacidad'); if(!z) return; z.textContent = '';
    const det = h('details', null, null, 'margin:0 0 12px; border:1px solid var(--borde); border-radius:10px; padding:8px 12px;'); det.appendChild(h('summary', null, 'Capacidad de encargos por día', 'cursor:pointer; font-weight:600;')); z.appendChild(det); const cuerpo = h('div', null, null, 'margin-top:8px;'); det.appendChild(cuerpo);
    try { const r = await rpc('encargos_capacidad_ver', { p_dias: 21 });
      cuerpo.appendChild(h('p', 'nota', 'Cuántos encargos abiertos puedes entregar por día. Es un aviso: no bloquea la captura. Los días de temporada alta (14 de febrero, 10 de mayo…) pueden tener su propio cupo.', 'margin:0 0 8px;'));
      const grid = h('div', null, null, 'display:flex; flex-wrap:wrap; gap:6px; margin-bottom:10px;');
      r.dias.forEach((d) => { const lleno = d.cupo != null && d.ocupados >= d.cupo, casi = d.cupo != null && !lleno && d.ocupados >= d.cupo * 0.8; const c = h('div', null, fechaDia(d.fecha) + ': ' + d.ocupados + (d.cupo != null ? '/' + d.cupo : ''), 'padding:5px 9px; border-radius:8px; font-size:12.5px; border:1px solid var(--borde); background:' + (lleno ? '#fee2e2' : casi ? '#fef3c7' : 'transparent') + '; color:' + (lleno ? '#991b1b' : casi ? '#92400e' : 'inherit') + ';'); if(d.nota) c.title = d.nota; grid.appendChild(c); }); cuerpo.appendChild(grid);
      if(!enlace.esAdmin()) return;
      const lim = input(r.por_dia, 'Sin límite', 4, 'number'); lim.min = '1'; lim.style.width = '110px'; cuerpo.appendChild(campo('Máximo de encargos por día (vacío = sin límite)', lim, 220));
      const esp = h('div', null, null, 'margin-top:8px;'); const filas = (r.cupos || []).map((c) => ({ fecha: String(c.fecha).slice(0, 10), cupo: c.cupo, nota: c.nota || '' }));
      const pintaEsp = () => { esp.textContent = ''; esp.appendChild(h('div', 'nota', 'Fechas especiales con su propio cupo:')); filas.forEach((f, i) => { const r1 = h('div', null, null, 'display:flex; gap:6px; margin:4px 0; flex-wrap:wrap; align-items:center;'); const a = input(f.fecha, '', 10, 'date'), b = input(f.cupo, 'Cupo', 4, 'number'), c = input(f.nota, 'Nota', 60); b.min = '0'; b.style.width = '80px'; a.onchange = () => { f.fecha = a.value; }; b.oninput = () => { f.cupo = Number(b.value); }; c.oninput = () => { f.nota = c.value; }; [a, b, c].forEach((x) => r1.appendChild(x)); r1.appendChild(boton('Quitar', () => { filas.splice(i, 1); pintaEsp(); })); esp.appendChild(r1); }); esp.appendChild(boton('+ Fecha especial', () => { filas.push({ fecha: '', cupo: 10, nota: '' }); pintaEsp(); })); };
      pintaEsp(); cuerpo.appendChild(esp); const est = h('div');
      cuerpo.appendChild(boton('Guardar capacidad', async () => { try { await rpc('encargos_capacidad_guardar', { p_por_dia: lim.value === '' ? null : Math.round(Number(lim.value)), p_cupos: filas.filter((f) => f.fecha).map((f) => ({ fecha: f.fecha, cupo: Math.round(Number(f.cupo)) || 0, nota: f.nota || null })) }); capacidad(z); } catch(e){ msg(est, errTxt(e)); } }, 'principal', 'margin-top:10px;')); cuerpo.appendChild(est);
    } catch(e){ msg(cuerpo, errTxt(e)); }
  }
  // Para el formulario de nuevo encargo: texto de aviso si esa fecha ya está llena o casi.
  async function avisoCapacidad(iso){
    if(!iso) return ''; try { const r = await rpc('encargos_capacidad_ver', { p_dias: 90 }); const d = r.dias.find((x) => String(x.fecha).slice(0, 10) === iso); if(!d || d.cupo == null) return '';
      if(d.ocupados >= d.cupo) return 'Ese día ya tiene ' + d.ocupados + ' encargos y el cupo es ' + d.cupo + '. Puedes guardarlo, pero ya estás al límite.'; if(d.ocupados >= d.cupo * 0.8) return 'Ese día lleva ' + d.ocupados + ' de ' + d.cupo + ' encargos.'; return ''; } catch(e){ return ''; }
  }
  window.PuveGestion = { enlazar(o){ enlace = Object.assign(enlace, o || {}); }, precios, conteo, fechas, capacidad, avisoCapacidad };
})();
