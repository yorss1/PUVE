/* PUVE - Etapa 31. Inventario → Herramientas → Más herramientas:
 *   · Venta cruzada: qué productos suelen salir juntos en el mismo ticket (últimos 90 días). En la caja de abarrotes, licorerías y electrónicos
 *     sale una fila «Añade al ticket» con lo que más acompaña a lo que ya está en el carrito.
 *   · Comparar dos productos lado a lado (precio, existencia, ubicación y los datos propios de cada uno).
 *   · Por presupuesto: lo que hay en existencia dentro de un rango de precio.
 *   · Pantalla: lista grande de productos con precio para mostrar a los clientes (por categoría, se actualiza sola).
 *   · Etiquetas: imprime etiquetas con nombre, precio, ubicación y código.
 * Todo se calcula con tus productos y tus ventas. Venta cruzada usa el SQL 140.
 */
(function(){
  'use strict';
  let enlace = { sb: null, productos: () => [], categorias: () => [], esEncargado: () => false, dinero: (n) => '$' + Number(n).toFixed(2), giro: () => '', alActualizar: () => {} };
  function h(tag, cls, txt, estilo){ const e = document.createElement(tag); if(cls) e.className = cls; if(txt != null) e.textContent = txt; if(estilo) e.style.cssText = estilo; return e; }
  function boton(txt, fn, cls, estilo){ const b = h('button', cls || 'texto', txt, 'width:auto; padding:7px 12px;' + (estilo || '')); b.type = 'button'; b.onclick = fn; return b; }
  function campo(et, el, ancho){ const w = h('label', null, et, 'display:flex; flex-direction:column; gap:4px; font-size:13px; font-weight:500;' + (ancho ? 'flex:1 1 ' + ancho + 'px;' : '')); w.appendChild(el); return w; }
  const input = (v, ph, max, tipo) => { const i = h('input', 'input-mini'); if(tipo) i.type = tipo; if(v != null && v !== '') i.value = v; if(ph) i.placeholder = ph; if(max) i.maxLength = max; return i; };
  const sel = (ops, v) => { const s = h('select', 'input-mini'); ops.forEach(([k, t]) => { const o = h('option', null, t); o.value = k; s.appendChild(o); }); if(v != null) s.value = v; return s; };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = (s) => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const din = (n) => enlace.dinero(Number(n) || 0);
  const lista = () => { try { return (enlace.productos() || []).filter((p) => p.activo !== false); } catch(e){ return []; } };
  const catNombre = (id) => { const c = (enlace.categorias() || []).find((x) => x.id === id); return c ? c.nombre : ''; };
  const msg = (z, t, ok) => { z.textContent = t; z.style.cssText = 'font-size:13px; margin:8px 0; color:' + (ok ? '#16a34a' : 'var(--error,#b91c1c)') + ';'; };
  function tabla(cols, filas){ const w = h('div', 'envoltura-tabla'), t = h('table'), th = h('thead'), r0 = h('tr'); cols.forEach((c) => r0.appendChild(h('th', null, c))); th.appendChild(r0); t.appendChild(th); const tb = h('tbody'); filas.forEach((f) => { const tr = h('tr'); (f.celdas || f).forEach((c, i) => { const td = h('td'); if(c instanceof Node) td.appendChild(c); else { td.textContent = c; if(i === 0) td.style.fontWeight = '600'; } if(f.marca) td.style.background = 'rgba(245,158,11,.15)'; tr.appendChild(td); }); tb.appendChild(tr); }); t.appendChild(tb); w.appendChild(t); return w; }

  // ---------- Afinidad (venta cruzada) ----------
  let af = null, afCargando = false, afT = 0;
  async function cargarAfinidad(){
    if(afCargando || (af && Date.now() - afT < 600000)) return; afCargando = true;
    try { const r = await enlace.sb.rpc('afinidad_productos', { p_dias: 90, p_min: 3 }); if(r.error) throw r.error; const m = new Map(); (r.data || []).forEach((x) => { if(!m.has(x.a)) m.set(x.a, []); m.get(x.a).push({ b: x.b, n: x.juntos }); }); af = m; afT = Date.now(); try { enlace.alActualizar(); } catch(e){} }
    catch(e){ af = af || new Map(); afT = Date.now() - 540000; } finally { afCargando = false; }
  }
  const GIROS_CAJA = ['abarrotes', 'licorerias', 'electronicos'];
  // Productos que suelen acompañar a lo que hay en el carrito (en existencia y que aún no están). Sin datos devuelve [] y los carga de fondo.
  function sugerir(idsCarrito){
    let g = ''; try { g = enlace.giro(); } catch(e){} if(GIROS_CAJA.indexOf(g) < 0) return [];
    cargarAfinidad(); if(!af || !idsCarrito.length) return [];
    const en = new Set(idsCarrito), sc = new Map(); idsCarrito.forEach((id) => (af.get(id) || []).forEach((x) => { if(!en.has(x.b)) sc.set(x.b, (sc.get(x.b) || 0) + x.n); }));
    const por = new Map(lista().map((p) => [p.id, p])); return Array.from(sc.entries()).sort((a, b) => b[1] - a[1]).map((x) => por.get(x[0])).filter((p) => p && p.tipo !== 'servicio' && Number(p.stock) > 0).slice(0, 5);
  }
  function cruzada(z){
    z.appendChild(h('p', 'nota', 'Productos que se compran juntos: cuántos tickets de los últimos 90 días llevaron los dos (mínimo 3). En la caja de abarrotes, licorerías y electrónicos esto sale solo como «Añade al ticket».'));
    const zl = h('div'); z.appendChild(zl); zl.appendChild(h('p', 'nota', 'Calculando…'));
    enlace.sb.rpc('afinidad_productos', { p_dias: 90, p_min: 3 }).then((r) => {
      zl.textContent = ''; if(r.error){ const m = h('p'); msg(m, /does not exist|schema cache|Could not find/i.test(r.error.message) ? 'Falta ejecutar el script SQL 140 en Supabase.' : r.error.message); zl.appendChild(m); return; }
      const por = new Map(lista().map((p) => [p.id, p])), vistos = new Set(), filas = [];
      (r.data || []).forEach((x) => { const k = [x.a, x.b].sort().join('|'); if(vistos.has(k)) return; vistos.add(k); const A = por.get(x.a), B = por.get(x.b); if(A && B) filas.push([A.nombre + '  +  ' + B.nombre, String(x.juntos) + ' tickets']); });
      if(!filas.length){ zl.appendChild(h('p', 'nota', 'Todavía no hay suficientes ventas con dos o más productos para encontrar parejas.')); return; } zl.appendChild(tabla(['Pareja', 'Juntos'], filas.slice(0, 40)));
    });
  }

  // ---------- Comparar ----------
  function comparar(z){
    z.appendChild(h('p', 'nota', 'Elige dos productos para verlos lado a lado. Los datos propios (los que capturas en «Buscar y datos») también se comparan; las diferencias salen marcadas.'));
    const zl = h('div'), pick = (et) => { const q = input('', 'Escribe para buscar…', 40), s = sel([['', '— elige —']]), f = () => { const t = norm(q.value), l = lista().filter((p) => !t || norm(p.nombre + ' ' + (p.sku || '') + ' ' + (p.modelo || '')).includes(t)).slice(0, 25); s.textContent = ''; [['', '— elige —']].concat(l.map((p) => [p.id, p.nombre])).forEach(([k, tx]) => { const o = h('option', null, tx); o.value = k; s.appendChild(o); }); }; q.oninput = f; f(); s.onchange = pinta; const w = h('div', null, null, 'flex:1 1 240px; display:flex; flex-direction:column; gap:4px;'); w.appendChild(h('strong', null, et)); w.appendChild(q); w.appendChild(s); return { w, s }; };
    const A = pick('Producto 1'), B = pick('Producto 2'), fr = h('div', null, null, 'display:flex; gap:12px; flex-wrap:wrap; margin-bottom:10px;'); fr.appendChild(A.w); fr.appendChild(B.w); z.appendChild(fr); z.appendChild(zl);
    function pinta(){ zl.textContent = ''; const por = new Map(lista().map((p) => [p.id, p])), a = por.get(A.s.value), b = por.get(B.s.value); if(!a || !b) return;
      const da = a.datos || {}, db = b.datos || {}, filas = [], fila = (et, x, y) => { const f = [et, x == null || x === '' ? '—' : String(x), y == null || y === '' ? '—' : String(y)]; f.marca = String(f[1]) !== String(f[2]); filas.push(f); };
      fila('Precio', din(a.precio), din(b.precio)); fila('En existencia', a.stock, b.stock); fila('Categoría', catNombre(a.categoria_id), catNombre(b.categoria_id)); fila('Ubicación', a.ubicacion, b.ubicacion); fila('Modelo', a.modelo, b.modelo);
      Array.from(new Set(Object.keys(da).concat(Object.keys(db)))).sort((x, y) => x.localeCompare(y, 'es')).forEach((k) => fila(k, da[k], db[k]));
      zl.appendChild(tabla(['', a.nombre, b.nombre], filas)); const dp = Number(a.precio) - Number(b.precio); zl.appendChild(h('p', 'nota', dp === 0 ? 'Cuestan lo mismo.' : (dp > 0 ? a.nombre : b.nombre) + ' cuesta ' + din(Math.abs(dp)) + ' más.'));
    }
  }

  // ---------- Por presupuesto ----------
  function presupuesto(z){
    z.appendChild(h('p', 'nota', 'Para quien dice «tengo tanto para gastar»: lo que hay en existencia dentro de un rango de precio.'));
    const mn = input('', '$', 8, 'number'), mx = input('', '$', 8, 'number'), cat = sel([['', 'Todas las categorías']].concat((enlace.categorias() || []).map((c) => [c.id, c.nombre]))), q = input('', 'Buscar (opcional)', 40); mn.min = mx.min = '0'; mn.style.width = mx.style.width = '110px';
    const fr = h('div', null, null, 'display:flex; gap:10px; flex-wrap:wrap; margin-bottom:10px;'); [campo('Desde $', mn, 110), campo('Hasta $', mx, 110), campo('Categoría', cat, 180), campo('Buscar', q, 180)].forEach((x) => fr.appendChild(x)); const zl = h('div'); z.appendChild(fr); z.appendChild(zl);
    const pinta = () => { zl.textContent = ''; const a = Number(mn.value) || 0, b = mx.value === '' ? Infinity : Number(mx.value), t = norm(q.value);
      const l = lista().filter((p) => p.tipo !== 'servicio' && Number(p.stock) > 0 && Number(p.precio) >= a && Number(p.precio) <= b && (!cat.value || p.categoria_id === cat.value) && (!t || norm(p.nombre).includes(t))).sort((x, y) => Number(y.precio) - Number(x.precio));
      if(!l.length){ zl.appendChild(h('p', 'nota', 'No hay productos en existencia con ese rango.')); return; } zl.appendChild(h('p', 'nota', l.length + ' producto(s)' + (l.length > 60 ? ' (se muestran 60)' : ''))); zl.appendChild(tabla(['Producto', 'Precio', 'Existencia', 'Ubicación'], l.slice(0, 60).map((p) => [p.nombre, din(p.precio), String(p.stock), p.ubicacion || '—']))); };
    [mn, mx, q].forEach((e) => { e.oninput = pinta; }); cat.onchange = pinta; pinta();
  }

  // ---------- Pantalla ----------
  let timerPantalla = null;
  function pantalla(z){
    z.appendChild(h('p', 'nota', 'Lista grande para poner en una pantalla o tableta de cara al cliente: «Pan del día», «Sabores de hoy», lo que tengas. Muestra solo lo que hay en existencia y se actualiza sola cada 30 segundos.'));
    const ti = input('Hoy tenemos', '', 40), cat = sel([['', 'Todas las categorías']].concat((enlace.categorias() || []).map((c) => [c.id, c.nombre]))), pr = sel([['1', 'Con precio'], ['0', 'Sin precio']]), fr = h('div', null, null, 'display:flex; gap:10px; flex-wrap:wrap; margin-bottom:10px; align-items:flex-end;');
    [campo('Título', ti, 220), campo('Categoría', cat, 200), campo('Precio', pr, 120)].forEach((x) => fr.appendChild(x)); fr.appendChild(boton('Abrir pantalla', () => abre(ti.value.trim(), cat.value, pr.value === '1'), 'primario')); z.appendChild(fr);
  }
  function abre(titulo, catId, conPrecio){
    cierra(); const o = h('div', null, null, 'position:fixed; inset:0; z-index:99999; background:#111; color:#fff; overflow:auto; padding:3vh 4vw; font-family:inherit;'); o.id = 'puvePantalla';
    const x = boton('Cerrar ✕', cierra, 'texto', 'position:fixed; top:10px; right:14px; background:#333; color:#fff; border:0; border-radius:8px;'); const t = h('h1', null, titulo || '', 'font-size:6vh; margin:0 0 2vh;'), g = h('div', null, null, 'display:grid; grid-template-columns:repeat(auto-fill,minmax(38vw,1fr)); gap:1.5vh 3vw;');
    o.appendChild(x); o.appendChild(t); o.appendChild(g); document.body.appendChild(o);
    const pinta = () => { g.textContent = ''; const l = lista().filter((p) => p.tipo !== 'servicio' && Number(p.stock) > 0 && (!catId || p.categoria_id === catId)).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')); if(!l.length) g.appendChild(h('div', null, 'Por ahora no hay productos disponibles.', 'font-size:4vh; opacity:.7;')); l.forEach((p) => { const f = h('div', null, null, 'display:flex; justify-content:space-between; gap:2vw; font-size:4.2vh; border-bottom:1px solid #333; padding-bottom:.8vh;'); f.appendChild(h('span', null, p.nombre)); if(conPrecio) f.appendChild(h('strong', null, din(p.precio))); g.appendChild(f); }); };
    pinta(); timerPantalla = setInterval(() => { if(!document.getElementById('puvePantalla')) return cierra(); pinta(); }, 30000); try { if(o.requestFullscreen) o.requestFullscreen().catch(() => {}); } catch(e){}
  }
  function cierra(){ if(timerPantalla){ clearInterval(timerPantalla); timerPantalla = null; } const o = document.getElementById('puvePantalla'); if(o) o.remove(); try { if(document.fullscreenElement) document.exitFullscreen(); } catch(e){} }

  // ---------- Etiquetas ----------
  function etiquetas(z){
    z.appendChild(h('p', 'nota', 'Imprime etiquetas de estante con nombre, precio, ubicación y código. Marca los productos, elige qué lleva cada etiqueta y se abre la ventana de impresión.'));
    const q = input('', 'Buscar producto…', 40), cat = sel([['', 'Todas las categorías']].concat((enlace.categorias() || []).map((c) => [c.id, c.nombre]))), zl = h('div', null, null, 'max-height:320px; overflow:auto; margin:8px 0;'), marcados = new Set();
    const opc = {}, fo = h('div', null, null, 'display:flex; gap:14px; flex-wrap:wrap; margin:8px 0;'); [['precio', 'Precio', true], ['ubic', 'Ubicación', true], ['cod', 'Código', true]].forEach(([k, t, v]) => { const c = h('input'); c.type = 'checkbox'; c.checked = v; opc[k] = c; const l = h('label', null, null, 'display:flex; gap:5px; align-items:center; font-size:13px;'); l.appendChild(c); l.appendChild(document.createTextNode(t)); fo.appendChild(l); });
    const cp = input('1', '', 2, 'number'); cp.min = '1'; cp.max = '20'; cp.style.width = '70px';
    const pinta = () => { zl.textContent = ''; const t = norm(q.value), l = lista().filter((p) => p.tipo !== 'servicio' && (!cat.value || p.categoria_id === cat.value) && (!t || norm(p.nombre + ' ' + (p.sku || '') + ' ' + (p.ubicacion || '')).includes(t))).slice(0, 150);
      if(!l.length){ zl.appendChild(h('p', 'nota', 'No hay productos con ese filtro.')); return; } l.forEach((p) => { const f = h('label', null, null, 'display:flex; gap:8px; align-items:center; padding:3px 0; font-size:13px;'), c = h('input'); c.type = 'checkbox'; c.checked = marcados.has(p.id); c.onchange = () => { if(c.checked) marcados.add(p.id); else marcados.delete(p.id); }; f.appendChild(c); f.appendChild(document.createTextNode(p.nombre + ' · ' + din(p.precio) + (p.ubicacion ? ' · ' + p.ubicacion : ''))); zl.appendChild(f); }); };
    q.oninput = pinta; cat.onchange = pinta; const fr = h('div', null, null, 'display:flex; gap:10px; flex-wrap:wrap;'); fr.appendChild(campo('Buscar', q, 220)); fr.appendChild(campo('Categoría', cat, 200)); z.appendChild(fr); z.appendChild(zl); pinta(); z.appendChild(fo);
    const fc = h('div', null, null, 'display:flex; gap:10px; align-items:flex-end;'); fc.appendChild(campo('Copias de cada una', cp, 90)); const m = h('div');
    fc.appendChild(boton('Imprimir etiquetas', () => { const ps = lista().filter((p) => marcados.has(p.id)); if(!ps.length){ msg(m, 'Marca al menos un producto.'); return; } const n = Math.max(1, Math.min(20, Math.floor(Number(cp.value)) || 1)); const w = window.open('', '_blank'); if(!w){ msg(m, 'Tu navegador bloqueó la ventana: permite ventanas emergentes.'); return; }
      let c = ''; ps.forEach((p) => { for(let i = 0; i < n; i++) c += '<div class="e"><div class="n">' + esc(p.nombre) + '</div>' + (opc.precio.checked ? '<div class="p">' + esc(din(p.precio)) + '</div>' : '') + (opc.ubic.checked && p.ubicacion ? '<div class="u">Ubicación: ' + esc(p.ubicacion) + '</div>' : '') + (opc.cod.checked && p.sku ? '<div class="c">' + esc(p.sku) + '</div>' : '') + '</div>'; });
      w.document.write('<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Etiquetas</title><style>body{margin:10px;font-family:Arial,sans-serif}.g{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.e{border:1px dashed #888;padding:8px;text-align:center;break-inside:avoid;min-height:80px}.n{font-size:13px;font-weight:700}.p{font-size:24px;font-weight:800;margin:4px 0}.u,.c{font-size:11px;color:#444}</style></head><body><div class="g">' + c + '</div><script>window.onload=function(){window.print()}<\/script></body></html>'); w.document.close(); msg(m, ps.length * n + ' etiqueta(s) enviadas a imprimir.', true); }, 'primario')); z.appendChild(fc); z.appendChild(m);
  }

  // ---------- Raíz ----------
  let tab = 'cruzada';
  function abrir(z){
    z.textContent = ''; const bar = h('div', null, null, 'display:flex; gap:6px; flex-wrap:wrap; margin-bottom:12px;'), zz = h('div'), bs = {}, TABS = { cruzada, comparar, presupuesto, pantalla, etiquetas };
    [['cruzada', 'Venta cruzada'], ['comparar', 'Comparar dos productos'], ['presupuesto', 'Por presupuesto'], ['pantalla', 'Pantalla'], ['etiquetas', 'Etiquetas']].forEach(([k, t]) => { const b = boton(t, () => { tab = k; Object.keys(bs).forEach((x) => { bs[x].style.fontWeight = x === k ? '700' : '400'; }); zz.textContent = ''; TABS[k](zz); }); b.style.fontWeight = k === tab ? '700' : '400'; bs[k] = b; bar.appendChild(b); });
    z.appendChild(bar); z.appendChild(zz); TABS[tab](zz);
  }
  window.PuveHerr2 = { enlazar(o){ enlace = Object.assign(enlace, o || {}); }, abrir, sugerir };
})();
