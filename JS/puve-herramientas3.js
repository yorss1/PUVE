/* PUVE - Etapa 34. Más pestañas en Inventario → Herramientas → Más herramientas:
 *   · Corte de fiado: quién debe, cuánto cargó y abonó en la semana, y el mensaje de cobranza (lo envías tú). SQL 141.
 *   · Oferta del día: los productos que más tardan en venderse, con precio de oferta sugerido y cartel para imprimir. SQL 141.
 *   · Temporada: lo que vendiste en el mismo periodo del año pasado contra lo que tienes hoy, para resurtir. SQL 141.
 *   · Sustitutos: alternativas para un producto agotado (misma categoría, con existencia y precio parecido).
 *   · Decodificar VIN (servicio gratuito NHTSA vPIC) y datos por código de barras (Open Food Facts): consultan internet al presionar el botón.
 *   · Fotos credencial: recorta una foto y arma la hoja para imprimir.
 *   · Escáner: fotos con la cámara o imágenes del equipo, juntas en un PDF.
 * Nada de esto cambia tus productos, precios ni existencias.
 */
(function(){
  'use strict';
  let enlace = { sb: null, productos: () => [], categorias: () => [], dinero: (n) => '$' + Number(n).toFixed(2) };
  function h(tag, cls, txt, estilo){ const e = document.createElement(tag); if(cls) e.className = cls; if(txt != null) e.textContent = txt; if(estilo) e.style.cssText = estilo; return e; }
  function boton(txt, fn, cls, estilo){ const b = h('button', cls || 'texto', txt, 'width:auto; padding:7px 12px;' + (estilo || '')); b.type = 'button'; b.onclick = fn; return b; }
  function campo(et, el, ancho){ const w = h('label', null, et, 'display:flex; flex-direction:column; gap:4px; font-size:13px; font-weight:500;' + (ancho ? 'flex:1 1 ' + ancho + 'px;' : '')); w.appendChild(el); return w; }
  const input = (v, ph, max, tipo) => { const i = h('input', 'input-mini'); if(tipo) i.type = tipo; if(v != null && v !== '') i.value = v; if(ph) i.placeholder = ph; if(max) i.maxLength = max; return i; };
  const sel = (ops, v) => { const s = h('select', 'input-mini'); ops.forEach(([k, t]) => { const o = h('option', null, t); o.value = k; s.appendChild(o); }); if(v != null) s.value = v; return s; };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = (s) => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const N = (x) => Number(x) || 0;
  const din = (n) => enlace.dinero(N(n));
  const lista = () => { try { return (enlace.productos() || []).filter((p) => p.activo !== false); } catch(e){ return []; } };
  const msg = (z, t, ok) => { z.textContent = t; z.style.cssText = 'font-size:13px; margin:8px 0; color:' + (ok ? '#16a34a' : 'var(--error,#b91c1c)') + ';'; };
  const errTxt = (e) => { const m = (e && e.message) || String(e); return /does not exist|schema cache|Could not find/i.test(m) ? 'Falta ejecutar el script SQL 141 en Supabase.' : m; };
  async function rpc(f, a){ const r = await enlace.sb.rpc(f, a); if(r.error) throw r.error; return r.data; }
  function tabla(cols, filas){ const w = h('div', 'envoltura-tabla'), t = h('table'), th = h('thead'), r0 = h('tr'); cols.forEach((c) => r0.appendChild(h('th', null, c))); th.appendChild(r0); t.appendChild(th); const tb = h('tbody'); filas.forEach((f) => { const tr = h('tr'); (f.celdas || f).forEach((c, i) => { const td = h('td'); if(c instanceof Node) td.appendChild(c); else { td.textContent = c; if(i === 0) td.style.fontWeight = '600'; } if(f.marca) td.style.background = 'rgba(245,158,11,.15)'; tr.appendChild(td); }); tb.appendChild(tr); }); t.appendChild(tb); w.appendChild(t); return w; }
  function wa(tel, texto){ const d = String(tel || '').replace(/\D/g, ''), n = d.length === 10 ? '52' + d : d; window.open('https://wa.me/' + (n.length >= 11 ? n : '') + '?text=' + encodeURIComponent(texto), '_blank', 'noopener'); }
  const hoy = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
  const sumaDias = (f, n) => { const p = f.split('-').map(Number), d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + n)); return d.toISOString().slice(0, 10); };
  const restaAnio = (f) => { const p = f.split('-').map(Number); const d = new Date(Date.UTC(p[0] - 1, p[1] - 1, p[2])); return d.toISOString().slice(0, 10); };
  async function pedir(url, ms){ const c = window.AbortController ? new AbortController() : null, t = c ? setTimeout(() => c.abort(), ms || 12000) : null; try { const r = await fetch(url, { signal: c ? c.signal : undefined }); if(!r.ok) throw new Error('El servicio respondió ' + r.status); return await r.json(); } finally { if(t) clearTimeout(t); } }

  // ---------- Corte de fiado ----------
  function fiado(z){
    z.appendChild(h('p', 'nota', 'Quién te debe, cuánto se cargó y abonó en el periodo y cuándo fue su último abono. El mensaje de cobranza lo envías tú por WhatsApp.'));
    const per = sel([['7', 'Últimos 7 días'], ['14', 'Últimos 14 días'], ['30', 'Últimos 30 días']], '7'), zl = h('div'); z.appendChild(campo('Periodo', per, 180)); z.appendChild(zl);
    const carga = async () => { zl.textContent = ''; zl.appendChild(h('p', 'nota', 'Cargando…')); let d; try { d = await rpc('fiado_corte', { p_dias: Number(per.value) }); } catch(e){ zl.textContent = ''; const m = h('div'); msg(m, errTxt(e)); zl.appendChild(m); return; } zl.textContent = '';
      const it = d.items || []; if(!it.length){ zl.appendChild(h('p', 'nota', 'Nadie tiene saldo de fiado. 🎉')); return; } zl.appendChild(h('p', null, it.length + ' cliente(s) con saldo por ' + din(it.reduce((s, x) => s + N(x.saldo), 0)), 'font-weight:600;'));
      const dias = (f) => f ? Math.floor((Date.now() - new Date(f).getTime()) / 864e5) : null;
      zl.appendChild(tabla(['Cliente', 'Saldo', 'Cargó', 'Abonó', 'Último abono', ''], it.map((x) => { const da = dias(x.ultimo_abono), f = [x.nombre || x.telefono, din(x.saldo), din(x.cargos), din(x.abonos), da == null ? 'Nunca' : (da === 0 ? 'Hoy' : 'Hace ' + da + ' día(s)'), x.telefono ? boton('Cobrar por WhatsApp', () => wa(x.telefono, 'Hola ' + (x.nombre || '') + ', te compartimos tu corte de los últimos ' + d.dias + ' días: cargos ' + din(x.cargos) + ', abonos ' + din(x.abonos) + '. Tu saldo pendiente es de ' + din(x.saldo) + '. Gracias.'), 'texto', 'padding:3px 8px;') : '']; f.marca = (da == null || da > 30) && N(x.saldo) > 0; return f; })));
      zl.appendChild(h('p', 'nota', 'Las filas marcadas llevan más de 30 días sin abonar (o nunca han abonado).')); };
    per.onchange = carga; carga();
  }

  // ---------- Oferta del día ----------
  function oferta(z){
    z.appendChild(h('p', 'nota', 'Lo que más tarda en venderse: producto con existencia y poca salida en los últimos 60 días. Es una sugerencia; el precio de oferta lo cambias tú en el producto. Con el cartel imprimes las ofertas.'));
    const pc = sel([['10', '10% menos'], ['15', '15% menos'], ['20', '20% menos'], ['30', '30% menos']], '15'), nn = sel([['3', '3 productos'], ['5', '5 productos'], ['8', '8 productos']], '5'), zl = h('div'), fr = h('div', null, null, 'display:flex; gap:10px; flex-wrap:wrap; margin-bottom:10px;'); fr.appendChild(campo('Rebaja', pc, 130)); fr.appendChild(campo('Cuántos', nn, 140)); z.appendChild(fr); z.appendChild(zl);
    let datos = null; const pinta = () => { zl.textContent = ''; if(!datos) return; const por = new Map(datos.map((x) => [x.producto_id, x])), dd = 60;
      const c = lista().filter((p) => p.tipo !== 'servicio' && N(p.stock) > 0).map((p) => { const r = por.get(p.id) || {}, vel = N(r.vendidas) / dd; return { p, vendidas: N(r.vendidas), cobertura: vel > 0 ? N(p.stock) / vel : 9999, ultima: r.ultima_venta }; }).sort((a, b) => b.cobertura - a.cobertura || N(b.p.stock) - N(a.p.stock)).slice(0, Number(nn.value));
      if(!c.length){ zl.appendChild(h('p', 'nota', 'No hay productos con existencia.')); return; } const k = 1 - Number(pc.value) / 100;
      zl.appendChild(tabla(['Producto', 'Existencia', 'Vendidos (60 días)', 'Alcanza para', 'Precio', 'Oferta'], c.map((x) => [x.p.nombre, String(x.p.stock), String(x.vendidas), x.cobertura >= 9999 ? 'No se ha vendido' : Math.round(x.cobertura) + ' días', din(x.p.precio), din(Math.round(N(x.p.precio) * k * 100) / 100)])));
      zl.appendChild(boton('Imprimir cartel de ofertas', () => { const w = window.open('', '_blank'); if(!w){ window.alert('Permite ventanas emergentes para imprimir.'); return; } w.document.write('<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Ofertas del día</title><style>body{font-family:Arial,sans-serif;margin:30px;text-align:center}h1{font-size:44px;margin:0 0 20px}.f{display:flex;justify-content:space-between;font-size:28px;border-bottom:2px dashed #999;padding:10px 4px;text-align:left}s{color:#888;font-size:20px;margin-right:10px}b{font-size:34px}</style></head><body><h1>Ofertas del día</h1>' + c.map((x) => '<div class="f"><span>' + esc(x.p.nombre) + '</span><span><s>' + esc(din(x.p.precio)) + '</s><b>' + esc(din(Math.round(N(x.p.precio) * k * 100) / 100)) + '</b></span></div>').join('') + '<script>window.onload=function(){window.print()}<\/script></body></html>'); w.document.close(); }, 'primario', 'margin-top:10px;')); };
    pc.onchange = pinta; nn.onchange = pinta; zl.appendChild(h('p', 'nota', 'Calculando…'));
    rpc('rotacion_productos', { p_dias: 60 }).then((d) => { datos = d.items || []; pinta(); }).catch((e) => { zl.textContent = ''; const m = h('div'); msg(m, errTxt(e)); zl.appendChild(m); });
  }

  // ---------- Temporada (mismo periodo del año pasado) ----------
  function temporada(z){
    z.appendChild(h('p', 'nota', 'Mira lo que vendiste en un periodo del año pasado (por ejemplo el regreso a clases) y compáralo con lo que tienes hoy. Te sugiere cuánto resurtir, con el crecimiento que tú esperes.'));
    const t0 = hoy(), pre = sel([['prox', 'Próximos 30 días (año pasado)'], ['clases', 'Regreso a clases (agosto y septiembre)'], ['navidad', 'Navidad (diciembre)'], ['manual', 'Elegir fechas']], 'prox');
    const d1 = input(restaAnio(t0), '', 10, 'date'), d2 = input(restaAnio(sumaDias(t0, 30)), '', 10, 'date'), cr = input('10', '%', 3, 'number'); cr.style.width = '80px';
    const fr = h('div', null, null, 'display:flex; gap:10px; flex-wrap:wrap; align-items:flex-end; margin-bottom:10px;'); [campo('Periodo', pre, 230), campo('Desde (año pasado)', d1, 150), campo('Hasta', d2, 150), campo('Crecimiento esperado %', cr, 120)].forEach((x) => fr.appendChild(x)); const zl = h('div'); z.appendChild(fr); z.appendChild(zl);
    const anio = Number(t0.slice(0, 4)) - 1;
    pre.onchange = () => { if(pre.value === 'prox'){ d1.value = restaAnio(t0); d2.value = restaAnio(sumaDias(t0, 30)); } else if(pre.value === 'clases'){ d1.value = anio + '-08-01'; d2.value = anio + '-09-15'; } else if(pre.value === 'navidad'){ d1.value = anio + '-12-01'; d2.value = anio + '-12-31'; } carga(); };
    const carga = async () => { zl.textContent = ''; zl.appendChild(h('p', 'nota', 'Calculando…')); let d; try { d = await rpc('ventas_periodo', { p_desde: d1.value, p_hasta: d2.value }); } catch(e){ zl.textContent = ''; const m = h('div'); msg(m, errTxt(e)); zl.appendChild(m); return; } zl.textContent = '';
      const por = new Map(lista().map((p) => [p.id, p])), k = 1 + N(cr.value) / 100, f = (d || []).filter((x) => por.has(x.producto_id)); if(!f.length){ zl.appendChild(h('p', 'nota', 'No hay ventas registradas en ese periodo.')); return; }
      zl.appendChild(h('p', null, 'Ese periodo vendiste ' + f.reduce((s, x) => s + N(x.vendidas), 0).toLocaleString('es-MX', { maximumFractionDigits: 0 }) + ' piezas por ' + din(f.reduce((s, x) => s + N(x.importe), 0)) + '.', 'font-weight:600;'));
      zl.appendChild(tabla(['Producto', 'Vendiste', 'Tienes hoy', 'Resurtir sugerido'], f.slice(0, 40).map((x) => { const p = por.get(x.producto_id), nec = Math.max(0, Math.ceil(N(x.vendidas) * k - N(p.stock))); const r = [p.nombre, String(Math.round(N(x.vendidas) * 100) / 100), String(p.stock), nec > 0 ? String(nec) : 'Alcanza']; r.marca = nec > 0; return r; }))); zl.appendChild(h('p', 'nota', 'Se muestran los 40 que más vendieron. Las filas marcadas son las que te faltarían.')); };
    d1.onchange = carga; d2.onchange = carga; cr.oninput = carga; carga();
  }

  // ---------- Sustitutos ----------
  function sustitutos(z){
    z.appendChild(h('p', 'nota', 'Cuando falta un producto: te muestra qué más ofrecer, de la misma categoría, con existencia y precio parecido. Si en «Buscar y datos» le pusiste el dato «Sustitutos» con nombres, esos salen primero.'));
    const q = input('', 'Producto que se acabó…', 60), s = sel([['', '— elige —']]), zl = h('div'); const f = h('div', null, null, 'display:flex; gap:10px; flex-wrap:wrap; margin-bottom:10px;'); f.appendChild(campo('Buscar', q, 240)); f.appendChild(campo('Producto', s, 280)); z.appendChild(f); z.appendChild(zl);
    const filtra = () => { const t = norm(q.value), l = lista().filter((p) => p.tipo !== 'servicio' && (!t || norm(p.nombre).includes(t))).slice(0, 40); s.textContent = ''; [['', '— elige —']].concat(l.map((p) => [p.id, p.nombre + (N(p.stock) <= 0 ? ' (agotado)' : '')])).forEach(([k, tx]) => { const o = h('option', null, tx); o.value = k; s.appendChild(o); }); };
    const pinta = () => { zl.textContent = ''; const ps = lista(), p = ps.find((x) => x.id === s.value); if(!p) return; const nom = norm(String((p.datos || {}).Sustitutos || (p.datos || {}).sustitutos || '')).split(/[,;\n]+/).map((x) => x.trim()).filter(Boolean);
      const c = ps.filter((x) => x.id !== p.id && x.tipo !== 'servicio' && N(x.stock) > 0).map((x) => ({ x, esDato: nom.some((n) => norm(x.nombre).includes(n)), mismaCat: !!p.categoria_id && x.categoria_id === p.categoria_id, dist: Math.abs(N(x.precio) - N(p.precio)) })).filter((r) => r.esDato || r.mismaCat).sort((a, b) => (b.esDato - a.esDato) || a.dist - b.dist).slice(0, 8);
      if(!c.length){ zl.appendChild(h('p', 'nota', 'No encontré sustitutos con existencia. Revisa que el producto tenga categoría.')); return; } zl.appendChild(tabla(['Sustituto', 'Precio', 'Existencia', 'Por qué'], c.map((r) => [r.x.nombre, din(r.x.precio), String(r.x.stock), r.esDato ? 'Lo marcaste como sustituto' : 'Misma categoría, precio parecido']))); };
    q.oninput = () => { filtra(); pinta(); }; s.onchange = pinta; filtra();
  }

  // ---------- VIN ----------
  function vin(z){
    z.appendChild(h('p', 'nota', 'Escribe el VIN (17 caracteres) y se consulta el servicio gratuito NHTSA vPIC para obtener marca, modelo, año y motor. Necesita internet y funciona mejor con vehículos de Estados Unidos y los que se venden en México con VIN norteamericano; no encuentra todos.'));
    const v = input('', '1HGCM82633A004352', 17), zl = h('div'), f = h('div', null, null, 'display:flex; gap:10px; align-items:flex-end; flex-wrap:wrap;'); f.appendChild(campo('VIN', v, 280)); const m = h('div');
    f.appendChild(boton('Decodificar', async () => { zl.textContent = ''; const code = v.value.trim().toUpperCase(); if(!/^[A-HJ-NPR-Z0-9]{17}$/.test(code)){ msg(m, 'El VIN debe tener 17 caracteres, sin I, O ni Q.'); return; } msg(m, 'Consultando…', true);
      try { const d = await pedir('https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/' + encodeURIComponent(code) + '?format=json'); const r = d && d.Results && d.Results[0]; if(!r || !r.Make){ msg(m, 'No encontré datos para ese VIN.'); return; } m.textContent = '';
        const fila = [['Marca', r.Make], ['Modelo', r.Model], ['Año', r.ModelYear], ['Carrocería', r.BodyClass], ['Motor', [r.DisplacementL ? Number(r.DisplacementL).toFixed(1) + ' L' : '', r.EngineCylinders ? r.EngineCylinders + ' cil.' : '', r.FuelTypePrimary].filter(Boolean).join(' · ')], ['Tracción', r.DriveType], ['Transmisión', r.TransmissionStyle], ['País de planta', r.PlantCountry], ['Versión', r.Trim]].filter((x) => x[1] && String(x[1]).trim());
        zl.appendChild(tabla(['Dato', 'Valor'], fila)); const txt = [r.Make, r.Model, r.ModelYear].filter(Boolean).join(' '); zl.appendChild(boton('Copiar «' + txt + '»', () => { try { navigator.clipboard.writeText(txt); } catch(e){} msg(m, 'Copiado. Pégalo en «Por vehículo» para buscar refacciones.', true); }, 'texto', 'margin-top:8px;'));
      } catch(e){ msg(m, 'No se pudo consultar (' + ((e && e.name === 'AbortError') ? 'tardó demasiado' : (e && e.message) || 'sin conexión') + '). Revisa tu internet e intenta de nuevo.'); } }, 'primario')); z.appendChild(f); z.appendChild(m); z.appendChild(zl);
  }

  // ---------- Código de barras ----------
  function codigo(z){
    z.appendChild(h('p', 'nota', 'Escribe el código de barras de un producto de supermercado y se buscan su nombre, marca y contenido en Open Food Facts (base abierta). Necesita internet y no todos los productos mexicanos están. Luego copias el nombre al alta del producto.'));
    const c = input('', '7501055300013', 14), zl = h('div'), m = h('div'), f = h('div', null, null, 'display:flex; gap:10px; align-items:flex-end; flex-wrap:wrap;'); f.appendChild(campo('Código', c, 220));
    f.appendChild(boton('Buscar', async () => { zl.textContent = ''; const code = c.value.replace(/\D/g, ''); if(code.length < 8){ msg(m, 'Escribe el código completo (8 a 14 dígitos).'); return; } msg(m, 'Buscando…', true);
      try { const d = await pedir('https://world.openfoodfacts.org/api/v2/product/' + code + '.json?fields=product_name,product_name_es,brands,quantity,categories'); if(!d || d.status !== 1 || !d.product){ msg(m, 'No encontré ese código. Captura el producto a mano.'); return; } m.textContent = ''; const p = d.product, nombre = [p.product_name_es || p.product_name, p.brands ? p.brands.split(',')[0] : '', p.quantity].filter(Boolean).join(' · ');
        zl.appendChild(tabla(['Dato', 'Valor'], [['Nombre', p.product_name_es || p.product_name || '—'], ['Marca', p.brands || '—'], ['Contenido', p.quantity || '—'], ['Categorías', p.categories || '—']])); zl.appendChild(boton('Copiar nombre sugerido', () => { try { navigator.clipboard.writeText(nombre); } catch(e){} msg(m, 'Copiado: ' + nombre, true); }, 'texto', 'margin-top:8px;'));
      } catch(e){ msg(m, 'No se pudo consultar (' + ((e && e.name === 'AbortError') ? 'tardó demasiado' : (e && e.message) || 'sin conexión') + ').'); } }, 'primario')); z.appendChild(f); z.appendChild(m); z.appendChild(zl);
  }

  // ---------- Fotos credencial ----------
  const TAMS = { infantil: ['Infantil 2.5 × 3 cm', 2.5, 3], credencial: ['Credencial 3 × 4 cm', 3, 4], pasaporte: ['Pasaporte 3.5 × 4.5 cm', 3.5, 4.5], visa: ['Visa 5 × 5 cm', 5, 5] };
  function credencial(z){
    z.appendChild(h('p', 'nota', 'Elige la foto, acércala y muévela hasta que el rostro quede centrado, y se arma una hoja con varias copias lista para imprimir (a 300 puntos por pulgada). El recorte es manual: PUVE no detecta rostros.'));
    const fi = input('', '', 0, 'file'); fi.accept = 'image/*'; const tam = sel(Object.keys(TAMS).map((k) => [k, TAMS[k][0]]), 'credencial'), cop = input('6', '', 2, 'number'); cop.min = '1'; cop.max = '40'; cop.style.width = '70px';
    const zoom = input('100', '', 3, 'range'); zoom.min = '100'; zoom.max = '300'; const dx = input('0', '', 4, 'range'), dy = input('0', '', 4, 'range'); dx.min = dy.min = '-100'; dx.max = dy.max = '100';
    const fr = h('div', null, null, 'display:flex; gap:10px; flex-wrap:wrap; margin-bottom:10px;'); [campo('Foto', fi, 240), campo('Tamaño', tam, 220), campo('Copias', cop, 80)].forEach((x) => fr.appendChild(x)); const aj = h('div', null, null, 'display:flex; gap:10px; flex-wrap:wrap; margin-bottom:10px;'); [campo('Acercar', zoom, 160), campo('Izquierda ↔ derecha', dx, 160), campo('Arriba ↕ abajo', dy, 160)].forEach((x) => aj.appendChild(x));
    const cv = h('canvas'), m = h('div'); cv.style.cssText = 'border:1px solid var(--borde,#bbb); max-width:220px; width:100%; background:#fff;'; let img = null;
    const dibuja = (c, an, al, ppp) => { c.width = Math.round(an / 2.54 * ppp); c.height = Math.round(al / 2.54 * ppp); const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); if(!img) return; const z0 = Number(zoom.value) / 100, esc0 = Math.max(c.width / img.width, c.height / img.height) * z0, w = img.width * esc0, hh = img.height * esc0; const ox = (c.width - w) / 2 + Number(dx.value) / 100 * (w - c.width) / 2 * -1, oy = (c.height - hh) / 2 + Number(dy.value) / 100 * (hh - c.height) / 2 * -1; g.drawImage(img, ox, oy, w, hh); };
    const prev = () => { const t = TAMS[tam.value]; dibuja(cv, t[1], t[2], 120); };
    fi.onchange = () => { const f = fi.files && fi.files[0]; if(!f) return; if(f.size > 12 * 1024 * 1024){ msg(m, 'La foto pesa más de 12 MB.'); return; } const u = URL.createObjectURL(f), im = new Image(); im.onload = () => { img = im; URL.revokeObjectURL(u); m.textContent = ''; prev(); }; im.onerror = () => msg(m, 'No pude leer esa imagen.'); im.src = u; };
    [zoom, dx, dy].forEach((e) => { e.oninput = prev; }); tam.onchange = prev; prev();
    z.appendChild(fr); z.appendChild(aj); z.appendChild(cv); z.appendChild(h('div', null, null, 'height:8px'));
    z.appendChild(boton('Imprimir hoja', () => { if(!img){ msg(m, 'Elige una foto primero.'); return; } const t = TAMS[tam.value], c = document.createElement('canvas'); dibuja(c, t[1], t[2], 300); const u = c.toDataURL('image/jpeg', 0.92), n = Math.max(1, Math.min(40, Math.floor(Number(cop.value)) || 1)); const w = window.open('', '_blank'); if(!w){ msg(m, 'Permite ventanas emergentes.'); return; }
      w.document.write('<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Fotos</title><style>@page{size:letter;margin:10mm}body{margin:0}.g{display:flex;flex-wrap:wrap;gap:2mm}img{width:' + t[1] + 'cm;height:' + t[2] + 'cm;outline:.2mm dashed #aaa}</style></head><body><div class="g">' + new Array(n + 1).join('<img alt="" src="' + u + '">') + '</div><script>window.onload=function(){window.print()}<\/script></body></html>'); w.document.close(); msg(m, n + ' foto(s) enviadas a imprimir. En la impresión elige escala 100%.', true); }, 'primario')); z.appendChild(m);
  }

  // ---------- Escáner a PDF ----------
  function escaner(z){
    z.appendChild(h('p', 'nota', 'Toma fotos de documentos con la cámara (o elige imágenes del equipo), ordénalas y descarga un solo PDF. Pon el documento sobre una superficie plana y con buena luz. No recorta ni mejora la imagen.'));
    const pags = [], v = h('video'), cv = document.createElement('canvas'), zl = h('div', null, null, 'display:flex; gap:8px; flex-wrap:wrap; margin:10px 0;'), m = h('div'); v.setAttribute('playsinline', ''); v.muted = true; v.style.cssText = 'width:100%; max-width:420px; border-radius:10px; background:#000; display:none;'; let stream = null;
    const pinta = () => { zl.textContent = ''; pags.forEach((u, i) => { const c = h('div', null, null, 'width:96px; text-align:center; font-size:12px;'), im = h('img'); im.src = u; im.alt = 'Página ' + (i + 1); im.style.cssText = 'width:96px; height:120px; object-fit:cover; border:1px solid var(--borde,#bbb); border-radius:6px;'; c.appendChild(im); const f = h('div', null, null, 'display:flex; gap:2px; justify-content:center;'); f.appendChild(boton('←', () => { if(i > 0){ [pags[i - 1], pags[i]] = [pags[i], pags[i - 1]]; pinta(); } }, 'texto', 'padding:1px 6px;')); f.appendChild(boton('✕', () => { pags.splice(i, 1); pinta(); }, 'texto', 'padding:1px 6px;')); f.appendChild(boton('→', () => { if(i < pags.length - 1){ [pags[i + 1], pags[i]] = [pags[i], pags[i + 1]]; pinta(); } }, 'texto', 'padding:1px 6px;')); c.appendChild(f); zl.appendChild(c); }); };
    const para = () => { if(stream){ stream.getTracks().forEach((t) => t.stop()); stream = null; } v.style.display = 'none'; bC.textContent = 'Abrir cámara'; };
    const bC = boton('Abrir cámara', async () => { if(stream){ para(); return; } if(!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)){ msg(m, 'Este navegador no deja usar la cámara.'); return; } try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false }); v.srcObject = stream; v.style.display = 'block'; await v.play(); bC.textContent = 'Cerrar cámara'; m.textContent = ''; } catch(e){ msg(m, 'No se pudo abrir la cámara. Revisa el permiso del navegador.'); } }, 'primario');
    const bF = boton('Tomar foto', () => { if(!stream || !v.videoWidth){ msg(m, 'Abre la cámara primero.'); return; } const k = Math.min(1, 1600 / Math.max(v.videoWidth, v.videoHeight)); cv.width = Math.round(v.videoWidth * k); cv.height = Math.round(v.videoHeight * k); cv.getContext('2d').drawImage(v, 0, 0, cv.width, cv.height); pags.push(cv.toDataURL('image/jpeg', 0.8)); pinta(); msg(m, 'Página ' + pags.length + ' agregada.', true); });
    const fi = input('', '', 0, 'file'); fi.accept = 'image/*'; fi.multiple = true; fi.onchange = () => { Array.from(fi.files || []).slice(0, 30).forEach((f) => { if(f.size > 12 * 1024 * 1024) return; const u = URL.createObjectURL(f), im = new Image(); im.onload = () => { const k = Math.min(1, 1600 / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); pags.push(c.toDataURL('image/jpeg', 0.8)); URL.revokeObjectURL(u); pinta(); }; im.src = u; }); fi.value = ''; };
    const bP = boton('Descargar PDF', () => { if(!pags.length){ msg(m, 'Agrega al menos una página.'); return; } if(!(window.jspdf && window.jspdf.jsPDF)){ msg(m, 'No se cargó la librería de PDF. Revisa tu internet y recarga.'); return; } const { jsPDF } = window.jspdf, d = new jsPDF({ unit: 'mm', format: 'letter' }); pags.forEach((u, i) => { if(i) d.addPage(); const pr = d.getImageProperties(u), W = 195, H = 259, k = Math.min(W / pr.width, H / pr.height); d.addImage(u, 'JPEG', (215.9 - pr.width * k) / 2, 10, pr.width * k, pr.height * k); }); d.save('documento.pdf'); msg(m, 'PDF descargado (' + pags.length + ' página' + (pags.length === 1 ? '' : 's') + ').', true); }, 'primario');
    const bar = h('div', null, null, 'display:flex; gap:8px; flex-wrap:wrap; align-items:flex-end;'); bar.appendChild(bC); bar.appendChild(bF); bar.appendChild(campo('o elige imágenes', fi, 200)); bar.appendChild(bP); bar.appendChild(boton('Empezar de nuevo', () => { pags.length = 0; pinta(); })); z.appendChild(bar); z.appendChild(v); z.appendChild(m); z.appendChild(zl);
    const obs = new MutationObserver(() => { if(!document.body.contains(z)){ para(); obs.disconnect(); } }); obs.observe(document.body, { childList: true, subtree: true });
  }

  const TABS = [['fiado', 'Corte de fiado', fiado], ['oferta', 'Oferta del día', oferta], ['temporada', 'Temporada', temporada], ['sustitutos', 'Sustitutos', sustitutos], ['vin', 'Decodificar VIN', vin], ['codigo', 'Datos por código de barras', codigo], ['credencial', 'Fotos credencial', credencial], ['escaner', 'Escáner a PDF', escaner]];
  window.PuveHerr3 = { enlazar(o){ enlace = Object.assign(enlace, o || {}); }, pestanas: () => TABS.slice() };
  if(window.PuveHerr2 && PuveHerr2.registrar) TABS.forEach((t) => PuveHerr2.registrar(t[0], t[1], t[2]));
})();
