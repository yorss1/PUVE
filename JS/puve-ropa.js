/* PUVE - Etapa 30. Ropa y calzado (Inventario → Herramientas → Ropa y calzado):
 *   · Cuadrícula de tallas por color y guía de tallas por modelo (la guía también sale al elegir talla en la caja).
 *   · Curva rota: modelos con tallas agotadas mientras otras de su mismo color siguen en existencia.
 *   · Rotación por talla y por modelo.
 *   · Rebajas sugeridas por antigüedad (el encargado las aplica con un toque; usa la «liquidación» de cada producto).
 *   · Pedido sugerido por curva: reparte lo que se pide según lo que de verdad se vendió en cada talla y color.
 * Todo son sugerencias calculadas con tus ventas: PUVE no compra ni cambia precios sola. Datos: SQL 139.
 */
(function(){
  'use strict';
  let enlace = { sb: null, productos: () => [], esEncargado: () => false, dinero: (n) => '$' + Number(n).toFixed(2) };
  function h(tag, cls, txt, estilo){ const e = document.createElement(tag); if(cls) e.className = cls; if(txt != null) e.textContent = txt; if(estilo) e.style.cssText = estilo; return e; }
  function boton(txt, fn, cls, estilo){ const b = h('button', cls || 'texto', txt, 'width:auto; padding:7px 12px;' + (estilo || '')); b.type = 'button'; b.onclick = fn; return b; }
  function campo(et, el, ancho){ const w = h('label', null, et, 'display:flex; flex-direction:column; gap:4px; font-size:13px; font-weight:500;' + (ancho ? 'flex:1 1 ' + ancho + 'px;' : '')); w.appendChild(el); return w; }
  const input = (v, ph, max, tipo) => { const i = h('input', 'input-mini'); if(tipo) i.type = tipo; if(v != null && v !== '') i.value = v; if(ph) i.placeholder = ph; if(max) i.maxLength = max; return i; };
  const num = (v, min, paso) => { const i = input(v, '', 6, 'number'); i.min = String(min == null ? 0 : min); i.step = paso || 'any'; i.style.width = '90px'; return i; };
  const sel = (ops) => { const s = h('select', 'input-mini'); ops.forEach(([v, t]) => { const o = h('option', null, t); o.value = v; s.appendChild(o); }); return s; };
  const msg = (z, t, ok) => { z.textContent = t; z.style.cssText = 'font-size:13px; margin:8px 0; color:' + (ok ? '#16a34a' : 'var(--error,#b91c1c)') + ';'; };
  const errTxt = (e) => { const m = (e && e.message) || String(e); return /does not exist|schema cache|Could not find/i.test(m) ? 'Falta ejecutar el script SQL 139 en Supabase.' : m; };
  async function rpc(f, a){ const r = await enlace.sb.rpc(f, a); if(r.error) throw r.error; return r.data; }
  const din = (n) => enlace.dinero(Number(n) || 0);
  const fmt = (n, d) => Number(n).toLocaleString('es-MX', { maximumFractionDigits: d == null ? 1 : d });
  function tabla(cols, filas){ const w = h('div', 'envoltura-tabla'), t = h('table'), th = h('thead'), tr0 = h('tr'); cols.forEach((c) => tr0.appendChild(h('th', null, c))); th.appendChild(tr0); t.appendChild(th); const tb = h('tbody'); filas.forEach((f) => { const tr = h('tr'); f.forEach((c, i) => { const td = h('td'); if(c instanceof Node) td.appendChild(c); else { td.textContent = c; if(i === 0) td.style.fontWeight = '600'; } tr.appendChild(td); }); tb.appendChild(tr); }); t.appendChild(tb); w.appendChild(t); return w; }
  const LETRAS = ['XXS', 'XCH', 'XS', 'CH', 'S', 'MD', 'M', 'G', 'L', 'XL', 'XXL', '2XL', 'XXXL', '3XL', '4XL'];
  function ordenTalla(a, b){ const na = parseFloat(String(a).replace(',', '.')), nb = parseFloat(String(b).replace(',', '.')); if(!isNaN(na) && !isNaN(nb)) return na - nb; if(!isNaN(na)) return -1; if(!isNaN(nb)) return 1; const ia = LETRAS.indexOf(String(a).toUpperCase()), ib = LETRAS.indexOf(String(b).toUpperCase()); if(ia >= 0 && ib >= 0) return ia - ib; return String(a).localeCompare(String(b), 'es'); }
  const stockN = (p) => Math.max(0, Number(p.stock) || 0);
  const variantes = () => (enlace.productos() || []).filter((p) => p.modelo && p.activo !== false);
  function porModelo(lista){ const m = new Map(); lista.forEach((p) => { if(!m.has(p.modelo)) m.set(p.modelo, []); m.get(p.modelo).push(p); }); return m; }
  const precioVigente = (p) => (p.en_liquidacion && p.precio_liquidacion != null) ? Number(p.precio_liquidacion) : Number(p.precio);

  // ---------- Ventas por variante (una carga por periodo) ----------
  const cacheV = {};
  async function ventas(dias){
    if(cacheV[dias] && Date.now() - cacheV[dias].t < 60000) return cacheV[dias].m;
    const d = await rpc('ropa_ventas', { p_dias: dias }), m = new Map(); (d.items || []).forEach((x) => m.set(x.producto_id, x)); cacheV[dias] = { t: Date.now(), m }; return m;
  }

  // ---------- Guías de talla (para la caja) ----------
  let guias = null;
  async function cargarGuias(){ if(guias) return guias; guias = new Map(); try { (await rpc('guias_talla_lista')).forEach((g) => guias.set(g.modelo, g.texto)); } catch(e){ guias = null; } return guias || new Map(); }
  async function guiaDe(modelo){ try { const g = await cargarGuias(); return g.get(modelo) || null; } catch(e){ return null; } }

  // ---------- Raíz ----------
  let tab = 'cuadricula';
  function abrir(z){
    z.textContent = ''; z.appendChild(h('p', 'nota', 'Herramientas para ropa, calzado y accesorios. Cada talla y color es un producto con su modelo (se capturan en Productos). Todo lo que ves son cálculos con tus existencias y ventas: PUVE no compra ni cambia precios por su cuenta.'));
    const bar = h('div', null, null, 'display:flex; gap:6px; flex-wrap:wrap; margin-bottom:12px;'), zz = h('div'), bs = {};
    [['cuadricula', 'Tallas por color'], ['curva', 'Curva rota'], ['rotacion', 'Rotación'], ['rebajas', 'Rebajas'], ['pedido', 'Pedido por curva']].forEach(([k, t]) => { const b = boton(t, () => { tab = k; Object.keys(bs).forEach((x) => { bs[x].style.fontWeight = x === k ? '700' : '400'; }); zz.textContent = ''; ({ cuadricula, curva, rotacion, rebajas, pedido })[k](zz); }); b.style.fontWeight = k === tab ? '700' : '400'; bs[k] = b; bar.appendChild(b); });
    z.appendChild(bar); z.appendChild(zz); ({ cuadricula, curva, rotacion, rebajas, pedido })[tab](zz);
  }
  const sinVariantes = (z) => z.appendChild(h('p', 'nota', 'Todavía no hay productos con modelo, talla y color. Captúralos en Productos (campo «Modelo») para usar esto.'));

  // ---------- Cuadrícula ----------
  function cuadricula(z){
    const mods = porModelo(variantes()); if(!mods.size) return sinVariantes(z);
    const nombres = Array.from(mods.keys()).sort((a, b) => a.localeCompare(b, 'es')), q = input('', 'Busca un modelo…', 60), zl = h('div'); z.appendChild(campo('Modelo', q, 260)); z.appendChild(zl);
    const pinta = () => { zl.textContent = ''; const t = q.value.trim().toLowerCase(), l = nombres.filter((n) => n.toLowerCase().includes(t)).slice(0, 12); if(!l.length){ zl.appendChild(h('p', 'nota', 'No hay modelos con ese nombre.')); return; }
      l.forEach((m) => { const vs = mods.get(m), tallas = Array.from(new Set(vs.map((v) => v.talla || '—'))).sort(ordenTalla), colores = Array.from(new Set(vs.map((v) => v.color || 'Sin color'))).sort((a, b) => a.localeCompare(b, 'es'));
        const caja = h('div', 'bloque-analitica', null, 'margin:10px 0;'); caja.appendChild(h('h3', null, m, 'margin:0 0 6px;')); const tot = vs.reduce((s, v) => s + stockN(v), 0); caja.appendChild(h('div', 'nota', tot + ' pieza' + (tot === 1 ? '' : 's') + ' en total'));
        const w = h('div', 'envoltura-tabla'), tb = h('table'), th = h('thead'), r0 = h('tr'); r0.appendChild(h('th', null, 'Color')); tallas.forEach((x) => r0.appendChild(h('th', null, x))); r0.appendChild(h('th', null, 'Total')); th.appendChild(r0); tb.appendChild(th); const bd = h('tbody');
        colores.forEach((c) => { const tr = h('tr'); tr.appendChild(h('td', null, c, 'font-weight:600;')); let sc = 0; tallas.forEach((x) => { const v = vs.find((y) => (y.talla || '—') === x && (y.color || 'Sin color') === c), td = h('td'); if(!v){ td.textContent = '·'; td.style.color = '#94a3b8'; } else { const n = stockN(v); sc += n; td.textContent = String(n); td.style.cssText = 'text-align:center; font-weight:700; ' + (n === 0 ? 'background:#fee2e2; color:#991b1b;' : n <= 1 ? 'background:#fef3c7; color:#92400e;' : ''); } tr.appendChild(td); }); tr.appendChild(h('td', null, String(sc), 'font-weight:700; text-align:center;')); bd.appendChild(tr); });
        tb.appendChild(bd); w.appendChild(tb); caja.appendChild(w); caja.appendChild(h('div', 'nota', 'Rojo = agotada · amarillo = queda una · punto = esa combinación no existe.', 'margin-top:4px;')); guiaBloque(caja, m); zl.appendChild(caja); }); };
    q.oninput = pinta; pinta();
  }
  function guiaBloque(caja, modelo){
    const zg = h('div', null, null, 'margin-top:10px;'); caja.appendChild(zg);
    const pinta = async () => { zg.textContent = ''; const g = await cargarGuias(), txt = g.get(modelo) || ''; zg.appendChild(h('div', null, 'Guía de tallas', 'font-weight:600; font-size:13px;'));
      if(txt) zg.appendChild(h('div', 'nota', txt, 'white-space:pre-wrap;')); else zg.appendChild(h('div', 'nota', enlace.esEncargado() ? 'Todavía no tiene guía. Escribe, por ejemplo: «CH 90 cm de pecho · M 98 cm · G 106 cm. Si dudas, sube una talla.»' : 'Todavía no tiene guía.'));
      if(!enlace.esEncargado()) return; const ta = h('textarea', 'input-mini'); ta.rows = 3; ta.maxLength = 600; ta.style.width = '100%'; ta.value = txt; const est = h('div');
      zg.appendChild(ta); zg.appendChild(boton('Guardar guía', async () => { try { await rpc('guia_talla_guardar', { p_modelo: modelo, p_texto: ta.value.trim() }); const gg = await cargarGuias(); if(ta.value.trim()) gg.set(modelo, ta.value.trim()); else gg.delete(modelo); msg(est, 'Guardado. Se muestra al elegir talla en la caja.', true); } catch(e){ msg(est, errTxt(e)); } }, 'principal', 'margin-top:6px;')); zg.appendChild(est); };
    pinta();
  }

  // ---------- Curva rota ----------
  function curva(z){
    const mods = porModelo(variantes()); if(!mods.size) return sinVariantes(z);
    z.appendChild(h('p', 'nota', 'Una curva está rota cuando, en un color, ya se agotaron tallas pero otras siguen en existencia: el cliente llega, no encuentra su talla y se va. Solo cuenta las tallas que ya diste de alta para ese modelo; una talla que nunca registraste no se puede avisar.'));
    const filas = [];
    mods.forEach((vs, m) => { const tallas = Array.from(new Set(vs.map((v) => v.talla).filter(Boolean))).sort(ordenTalla), colores = Array.from(new Set(vs.map((v) => v.color || ''))); if(tallas.length < 2) return;
      colores.forEach((c) => { const del = vs.filter((v) => (v.color || '') === c), con = tallas.filter((t) => del.some((v) => v.talla === t && stockN(v) > 0)), sin = tallas.filter((t) => !con.includes(t)); if(!con.length || !sin.length) return;
        const idx = (t) => tallas.indexOf(t), medio = sin.filter((t) => idx(t) > idx(con[0]) && idx(t) < idx(con[con.length - 1])); const piezas = del.reduce((s, v) => s + stockN(v), 0);
        filas.push({ m, c, con, sin, medio, piezas }); }); });
    if(!filas.length){ z.appendChild(h('p', null, 'Ninguna curva rota: en cada modelo y color, o tienes todas las tallas o ninguna.', 'font-weight:600;')); return; }
    filas.sort((a, b) => b.medio.length - a.medio.length || b.sin.length / (b.sin.length + b.con.length) - a.sin.length / (a.sin.length + a.con.length));
    z.appendChild(h('p', null, filas.length + (filas.length === 1 ? ' combinación' : ' combinaciones') + ' con la curva rota.', 'font-weight:600;'));
    z.appendChild(tabla(['Modelo', 'Color', 'Quedan', 'Faltan', 'Piezas'], filas.map((f) => [f.m, f.c || '—', f.con.join(', '), f.sin.join(', ') + (f.medio.length ? '  (faltan tallas de en medio)' : ''), String(f.piezas)])));
    z.appendChild(h('p', 'nota', 'Las de «en medio» son las que más duelen: son las tallas que más se piden.'));
  }

  // ---------- Rotación ----------
  function rotacion(z){
    const vs = variantes(); if(!vs.length) return sinVariantes(z);
    const per = sel([['30', 'Últimos 30 días'], ['90', 'Últimos 90 días'], ['180', 'Últimos 180 días']]); per.value = '90'; z.appendChild(campo('Periodo', per, 180)); const zr = h('div', null, null, 'margin-top:10px;'); z.appendChild(zr);
    const carga = async () => { zr.textContent = ''; const dias = Number(per.value); let mv; try { mv = await ventas(dias); } catch(e){ msg(zr, errTxt(e)); return; }
      const g = new Map(), gm = new Map(); vs.forEach((p) => { const v = (mv.get(p.id) || {}).vendidas || 0, k = p.talla || '—'; const a = g.get(k) || { v: 0, s: 0 }; a.v += Number(v); a.s += stockN(p); g.set(k, a); const b = gm.get(p.modelo) || { v: 0, s: 0 }; b.v += Number(v); b.s += stockN(p); gm.set(p.modelo, b); });
      const tv = Array.from(g.values()).reduce((s, x) => s + x.v, 0); if(!tv){ zr.appendChild(h('p', 'nota', 'No hay ventas de estos productos en el periodo.')); return; }
      const semanas = (x) => x.v > 0 ? fmt(x.s / (x.v / (dias / 7)), 1) + ' sem.' : (x.s > 0 ? 'sin ventas' : '—');
      zr.appendChild(h('h3', null, 'Por talla', 'margin:6px 0;')); zr.appendChild(tabla(['Talla', 'Vendidas', '% de las ventas', 'Existencia', 'Alcanza para'], Array.from(g.entries()).sort((a, b) => ordenTalla(a[0], b[0])).map(([t, x]) => [t, fmt(x.v, 0), fmt(x.v / tv * 100, 0) + '%', fmt(x.s, 0), semanas(x)])));
      zr.appendChild(h('h3', null, 'Por modelo (los 15 que más venden)', 'margin:16px 0 6px;')); zr.appendChild(tabla(['Modelo', 'Vendidas', 'Existencia', 'Alcanza para'], Array.from(gm.entries()).sort((a, b) => b[1].v - a[1].v).slice(0, 15).map(([m, x]) => [m, fmt(x.v, 0), fmt(x.s, 0), semanas(x)])));
      zr.appendChild(h('p', 'nota', '«Alcanza para» = existencia entre lo que vendes por semana. Cuenta lo vendido, sin restar devoluciones.')); };
    per.onchange = carga; carga();
  }

  // ---------- Rebajas ----------
  function rebajas(z){
    const vs = variantes().filter((p) => stockN(p) > 0); if(!vs.length) return sinVariantes(z);
    z.appendChild(h('p', 'nota', 'Prendas que llevan mucho tiempo sin venderse. Elige desde cuántos días sin venta se rebaja y cuánto; PUVE propone el precio y tú decides. Al aplicar, la variante entra en «liquidación» con el precio nuevo (se ve en la caja y en el pedido en línea). Si nunca se ha vendido, cuenta desde que se dio de alta.'));
    const t = [[num(60, 1, '1'), num(10, 1, '1')], [num(90, 1, '1'), num(20, 1, '1')], [num(120, 1, '1'), num(30, 1, '1')]], f = h('div', null, null, 'display:flex; gap:10px; flex-wrap:wrap; align-items:flex-end; margin-bottom:8px;');
    t.forEach((x, i) => { f.appendChild(campo('Nivel ' + (i + 1) + ': días sin venta', x[0])); f.appendChild(campo('Rebaja %', x[1])); }); z.appendChild(f); const zr = h('div'), est = h('div'); z.appendChild(est); z.appendChild(zr);
    const sel_ = new Set(); let lista = [];
    const calcula = async () => { zr.textContent = ''; sel_.clear(); let mv; try { mv = await ventas(365); } catch(e){ msg(zr, errTxt(e)); return; }
      const niveles = t.map((x) => ({ d: Number(x[0].value) || 0, p: Math.min(Math.max(Number(x[1].value) || 0, 1), 90) })).filter((x) => x.d > 0).sort((a, b) => a.d - b.d); const ahora = Date.now(); lista = [];
      vs.forEach((p) => { const v = mv.get(p.id) || {}, ref = v.ultima_venta || p.created_at; if(!ref) return; const dias = Math.floor((ahora - new Date(ref).getTime()) / 864e5); let niv = null; niveles.forEach((n) => { if(dias >= n.d) niv = n; }); if(!niv) return;
        const base = Number(p.precio), nuevo = Math.floor(base * (1 - niv.p / 100)), actual = precioVigente(p); if(nuevo >= actual) return; lista.push({ p, dias, pct: niv.p, nuevo, actual, nunca: !v.ultima_venta, bajoCosto: Number(p.costo) > 0 && nuevo < Number(p.costo) }); });
      lista.sort((a, b) => b.dias - a.dias); if(!lista.length){ zr.appendChild(h('p', 'nota', 'Ninguna prenda cumple los niveles que elegiste (o ya tiene una rebaja igual o mayor).')); return; }
      zr.appendChild(h('p', null, lista.length + ' variante' + (lista.length === 1 ? '' : 's') + ' para rebajar.', 'font-weight:600;'));
      const filas = lista.slice(0, 150).map((x, i) => { const ck = h('input'); ck.type = 'checkbox'; ck.style.cssText = 'width:18px; height:18px;'; ck.disabled = !enlace.esEncargado(); ck.setAttribute('aria-label', 'Elegir ' + x.p.nombre); ck.onchange = () => { if(ck.checked) sel_.add(i); else sel_.delete(i); };
        return [ck, x.p.nombre, fmt(stockN(x.p), 0), x.dias + ' días' + (x.nunca ? ' (nunca vendida)' : ''), din(x.actual), x.pct + '% → ' + din(x.nuevo) + (x.bajoCosto ? ' ⚠ debajo del costo' : '')]; });
      zr.appendChild(tabla(['', 'Prenda', 'Piezas', 'Sin vender', 'Precio actual', 'Rebaja propuesta'], filas)); if(lista.length > 150) zr.appendChild(h('p', 'nota', 'Mostrando 150 de ' + lista.length + '.'));
      if(enlace.esEncargado()){ const ac = h('div', null, null, 'display:flex; gap:8px; margin-top:8px; flex-wrap:wrap;');
        ac.appendChild(boton('Marcar todas', () => { zr.querySelectorAll('tbody input[type=checkbox]').forEach((c, i) => { c.checked = true; sel_.add(i); }); }));
        ac.appendChild(boton('Aplicar rebaja a las marcadas', async () => { if(!sel_.size) return msg(est, 'Marca primero las prendas.'); const items = Array.from(sel_).slice(0, 100).map((i) => ({ producto_id: lista[i].p.id, precio: lista[i].nuevo })); if(!window.confirm('¿Aplicar rebaja a ' + items.length + ' variante' + (items.length === 1 ? '' : 's') + '?')) return;
          try { await rpc('ropa_rebaja_aplicar', { p_items: items }); items.forEach((it) => { const p = enlace.productos().find((x) => x.id === it.producto_id); if(p){ p.en_liquidacion = true; p.precio_liquidacion = it.precio; } }); msg(est, 'Rebaja aplicada a ' + items.length + '. Para quitarla, edita el producto y apaga la liquidación.', true); calcula(); } catch(e){ msg(est, errTxt(e)); } }, 'principal')); zr.appendChild(ac); } };
    t.forEach((x) => x.forEach((i) => { i.onchange = calcula; })); calcula();
  }

  // ---------- Pedido por curva ----------
  function pedido(z){
    const vs = variantes(); if(!vs.length) return sinVariantes(z);
    z.appendChild(h('p', 'nota', 'Cuánto pedir de cada talla y color para cubrir los días que elijas, según lo que de verdad se vendió. No pide lo que no se mueve.'));
    const per = sel([['60', 'Ventas de los últimos 60 días'], ['90', 'Ventas de los últimos 90 días'], ['180', 'Ventas de los últimos 180 días']]); per.value = '90'; const cob = num(30, 7, '1'), ck = h('input'); ck.type = 'checkbox'; ck.checked = true; ck.style.cssText = 'width:18px; height:18px;';
    const f = h('div', null, null, 'display:flex; gap:10px; flex-wrap:wrap; align-items:flex-end; margin-bottom:8px;'); f.appendChild(campo('Basado en', per, 230)); f.appendChild(campo('Cubrir (días)', cob)); const lc = h('label', null, null, 'display:flex; gap:6px; align-items:center; font-size:13px; padding-bottom:6px;'); lc.appendChild(ck); lc.appendChild(h('span', null, 'Completar la curva: al menos 1 pieza de cada talla en los modelos que sí se venden')); f.appendChild(lc); z.appendChild(f); const zr = h('div'); z.appendChild(zr);
    const carga = async () => { zr.textContent = ''; const dias = Number(per.value), C = Math.max(Number(cob.value) || 30, 1); let mv; try { mv = await ventas(dias); } catch(e){ msg(zr, errTxt(e)); return; }
      const out = []; porModelo(vs).forEach((lista, m) => { const vend = lista.reduce((s, p) => s + Number((mv.get(p.id) || {}).vendidas || 0), 0); if(vend <= 0) return; const items = [];
        lista.forEach((p) => { const v = Number((mv.get(p.id) || {}).vendidas || 0), need = Math.ceil(v / dias * C) - stockN(p); let q = Math.max(0, need); if(ck.checked && stockN(p) <= 0 && q < 1) q = 1; if(q > 0) items.push({ talla: p.talla || '—', color: p.color || '', q }); });
        if(items.length) out.push({ m, items: items.sort((a, b) => ordenTalla(a.talla, b.talla)), tot: items.reduce((s, x) => s + x.q, 0), vend }); });
      if(!out.length){ zr.appendChild(h('p', 'nota', 'Con estas cuentas no hace falta pedir nada, o todavía no hay ventas en el periodo.')); return; } out.sort((a, b) => b.vend - a.vend);
      zr.appendChild(h('p', null, out.reduce((s, x) => s + x.tot, 0) + ' piezas en ' + out.length + ' modelo' + (out.length === 1 ? '' : 's') + '.', 'font-weight:600;'));
      zr.appendChild(tabla(['Modelo', 'Vendidas', 'Pedir', 'Piezas'], out.map((x) => [x.m, fmt(x.vend, 0), x.items.map((i) => i.talla + (i.color ? ' ' + i.color : '') + ' ×' + i.q).join(' · '), String(x.tot)])));
      const texto = 'Pedido sugerido\n' + out.map((x) => x.m + ': ' + x.items.map((i) => i.talla + (i.color ? ' ' + i.color : '') + ' x' + i.q).join(', ')).join('\n'), est = h('div');
      zr.appendChild(boton('Copiar pedido', async () => { try { await navigator.clipboard.writeText(texto); msg(est, 'Copiado. Pégalo en WhatsApp o en tu correo al proveedor.', true); } catch(e){ msg(est, 'No se pudo copiar desde aquí. Selecciona la tabla y cópiala.'); } }, 'principal', 'margin-top:8px;')); zr.appendChild(est); };
    [per, cob, ck].forEach((e) => { e.onchange = carga; }); carga();
  }

  window.PuveRopa = { enlazar(o){ enlace = Object.assign(enlace, o || {}); }, abrir, guiaDe, _ordenTalla: ordenTalla };
})();
