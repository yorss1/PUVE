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
  let enlace = { sb: null, qr: null, negocioId: () => '', esEncargado: () => false, alCambiar: () => {}, giro: () => '', productos: () => [], categorias: () => [], dinero: (n) => '$' + Number(n).toFixed(2) };
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


  // ---------- Regalo de cumpleaños ----------
  function cumple(z){
    z.appendChild(h('p', 'nota', 'Los cumpleaños que guardaste en Clientes → Fechas importantes, con un mensaje listo para mandar el regalo (por ejemplo un sello extra o un postre gratis). El regalo lo entregas tú en el mostrador.'));
    const dias = sel([['7', 'Próximos 7 días'], ['30', 'Próximos 30 días'], ['60', 'Próximos 60 días']], '30'), reg = input('un sello extra en tu tarjeta', 'Regalo', 60), zl = h('div'), f = h('div', null, null, 'display:flex; gap:10px; flex-wrap:wrap; margin-bottom:10px;'); f.appendChild(campo('Periodo', dias, 170)); f.appendChild(campo('Regalo', reg, 280)); z.appendChild(f); z.appendChild(zl);
    const MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']; let datos = [];
    const pinta = () => { zl.textContent = ''; const l = datos.filter((x) => /cumple/i.test(x.ocasion || '')); if(!l.length){ zl.appendChild(h('p', 'nota', 'No hay cumpleaños en ese periodo. Agrégalos en Clientes → Fechas importantes con la ocasión «Cumpleaños».')); return; }
      zl.appendChild(tabla(['Cliente', 'Fecha', ''], l.map((x) => [x.cliente, x.dia + ' de ' + MES[x.mes - 1], x.telefono ? boton('Mandar felicitación', () => wa(x.telefono, '¡Feliz cumpleaños, ' + (x.cliente || '') + '! 🎉 Pasa a vernos y te damos ' + (reg.value || 'un regalo') + '. Te esperamos.'), 'texto', 'padding:3px 8px;') : 'Sin teléfono']))); };
    const carga = async () => { zl.textContent = ''; zl.appendChild(h('p', 'nota', 'Cargando…')); try { datos = await rpc('clientes_fechas_proximas', { p_dias: Number(dias.value) }) || []; pinta(); } catch(e){ zl.textContent = ''; const m = h('div'); msg(m, errTxt(e)); zl.appendChild(m); } };
    dias.onchange = carga; reg.oninput = pinta; carga();
  }

  // ---------- Venta de masa ----------
  function masa(z){
    z.appendChild(h('p', 'nota', 'Cuántas tortillas salen de la masa que vendes y cuánto cobrar por kilo. No guarda nada.'));
    const kg = input('5', '', 5, 'number'), g = input('35', '', 3, 'number'), pk = input('18', '', 6, 'number'), mer = input('3', '', 3, 'number'), zl = h('div');
    const f = h('div', null, null, 'display:flex; gap:10px; flex-wrap:wrap; margin-bottom:10px;'); [campo('Kilos de masa', kg, 120), campo('Gramos por tortilla', g, 140), campo('Precio por kilo de masa', pk, 160), campo('Merma %', mer, 100)].forEach((x) => f.appendChild(x)); z.appendChild(f); z.appendChild(zl);
    const calc = () => { const k = N(kg.value), gr = Math.max(1, N(g.value)), m = Math.min(90, N(mer.value)) / 100; zl.textContent = ''; zl.appendChild(tabla(['Dato', 'Resultado'], [['Tortillas que salen', String(Math.floor(k * (1 - m) * 1000 / gr))], ['Tortillas por kilo de masa', String(Math.floor((1 - m) * 1000 / gr))], ['Cobro por ' + k + ' kg de masa', din(k * N(pk.value))], ['Equivale por tortilla a', din(N(pk.value) / Math.max(1, Math.floor((1 - m) * 1000 / gr)))]])); };
    [kg, g, pk, mer].forEach((e) => { e.oninput = calc; }); calc();
  }

  // ---------- Copias y páginas ----------
  function copias(z){
    z.appendChild(h('p', 'nota', 'Cobro de copias e impresiones: cuenta las páginas, aplica tarifa por tamaño y te sugiere blanco y negro o color según cuánta página lleva color. Los precios son tuyos; se recuerdan en este equipo.'));
    let g = {}; try { g = JSON.parse(localStorage.getItem('puve_copias') || '{}'); } catch(e){}
    const TAR = [['Carta', 1, 5], ['Oficio', 1.5, 6], ['Doble carta', 3, 12]], tam = sel(TAR.map((t, i) => [String(i), t[0]]), '0'), pag = input('10', '', 5, 'number'), cop = input('1', '', 4, 'number'), col = input('0', '', 3, 'number'), dob = sel([['1', 'Una cara'], ['2', 'Doble cara']], '1');
    const pb = input(g.pb != null ? g.pb : '', 'Blanco y negro', 6, 'number'), pc = input(g.pc != null ? g.pc : '', 'Color', 6, 'number'); pb.step = pc.step = '0.5';
    const f = h('div', null, null, 'display:flex; gap:10px; flex-wrap:wrap; margin-bottom:10px;'); [campo('Tamaño', tam, 140), campo('Páginas del documento', pag, 120), campo('Copias', cop, 90), campo('% de página con color', col, 120), campo('Cara', dob, 130), campo('Precio B/N por hoja (vacío = sugerido)', pb, 140), campo('Precio color por hoja', pc, 140)].forEach((x) => f.appendChild(x)); const zl = h('div'); z.appendChild(f); z.appendChild(zl);
    const calc = () => { const t = TAR[Number(tam.value)], pn = N(pag.value), c = Math.max(1, N(cop.value)), cara = Number(dob.value), hojas = Math.ceil(pn / cara) * c, caras = pn * c, pcol = Math.max(0, Math.min(100, N(col.value))), pBN = pb.value !== '' ? N(pb.value) : t[1], pCo = pc.value !== '' ? N(pc.value) : t[2], usaColor = pcol > 0;
      const sug = pcol === 0 ? 'Todo en blanco y negro.' : pcol <= 15 ? 'Lleva poco color (' + pcol + '%): cobra blanco y negro y avisa al cliente, o cobra color solo en las páginas que lo usan.' : 'Lleva bastante color (' + pcol + '%): conviene cobrar color.';
      zl.textContent = ''; const tot = caras * (usaColor ? pCo : pBN); zl.appendChild(tabla(['Dato', 'Resultado'], [['Caras a imprimir', String(caras)], ['Hojas de papel', String(hojas)], ['Cobro ' + (usaColor ? 'en color' : 'en blanco y negro'), din(tot)], ['Si fuera blanco y negro', din(caras * pBN)], ['Si fuera color', din(caras * pCo)]])); zl.appendChild(h('p', 'nota', sug)); try { localStorage.setItem('puve_copias', JSON.stringify({ pb: pb.value, pc: pc.value })); } catch(e){} };
    [tam, pag, cop, col, dob, pb, pc].forEach((e) => { e.oninput = calc; e.onchange = calc; }); calc();
  }

  // ---------- Plantillas de proyecto ----------
  const PROYECTOS = {
    pintar: ['Pintar una habitación', 'm² de pared', [['Pintura', 'pintura', 0.1, 'L'], ['Sellador', 'sellador', 0.08, 'L'], ['Brocha o rodillo', 'rodillo', 0.02, 'pza'], ['Cinta masking', 'cinta', 0.03, 'rollo'], ['Lija', 'lija', 0.05, 'pza']]],
    piso: ['Piso cerámico', 'm² de piso', [['Piso', 'piso', 1, 'm²'], ['Pegapiso', 'pegapiso', 0.2, 'saco'], ['Boquilla', 'boquilla', 0.1, 'kg'], ['Cruceta', 'cruceta', 8, 'pza']]],
    barda: ['Barda de block', 'm² de barda', [['Block', 'block', 12.5, 'pza'], ['Cemento', 'cemento', 0.25, 'saco'], ['Arena', 'arena', 0.04, 'm³'], ['Varilla', 'varilla', 1.2, 'pza']]],
    grifo: ['Cambio de llave o grifo', 'piezas', [['Llave o grifo', 'llave', 1, 'pza'], ['Cinta teflón', 'teflon', 1, 'rollo'], ['Mangueras', 'manguera', 2, 'pza']]],
    electrica: ['Contacto o apagador nuevo', 'piezas', [['Contacto o apagador', 'contacto', 1, 'pza'], ['Cable', 'cable', 4, 'm'], ['Cinta aislante', 'aislante', 0.2, 'rollo']]]
  };
  function proyecto(z){
    z.appendChild(h('p', 'nota', 'Elige el trabajo y la medida: te da una lista de materiales con desperdicio y busca cada uno en tu inventario (por nombre) para ver existencia y precio. Son cantidades de referencia; ajústalas con tu experiencia.'));
    const k = sel(Object.keys(PROYECTOS).map((x) => [x, PROYECTOS[x][0]]), 'pintar'), q = input('20', '', 6, 'number'), d = input('10', '', 3, 'number'), zl = h('div'), m = h('div', 'nota'), f = h('div', null, null, 'display:flex; gap:10px; flex-wrap:wrap; margin-bottom:10px;');
    const et = campo('Medida', q, 140); f.appendChild(campo('Trabajo', k, 240)); f.appendChild(et); f.appendChild(campo('Desperdicio %', d, 110)); z.appendChild(f); z.appendChild(m); z.appendChild(zl);
    const calc = () => { const P = PROYECTOS[k.value], cant = N(q.value), des = 1 + N(d.value) / 100, ps = lista(); m.textContent = 'Medida: ' + P[1]; let total = 0, falta = 0;
      const filas = P[2].map((x) => { const n = Math.round(cant * x[2] * des * 100) / 100, need = x[3] === 'pza' || x[3] === 'saco' || x[3] === 'rollo' ? Math.ceil(n) : n, p = ps.find((y) => norm(y.nombre).includes(x[1])); if(p){ total += need * N(p.precio); } else falta++; return [x[0], need + ' ' + x[3], p ? p.nombre : 'No lo encontré en tu inventario', p ? din(p.precio) : '—', p ? String(p.stock) : '—']; });
      zl.textContent = ''; zl.appendChild(tabla(['Material', 'Cantidad', 'Tu producto', 'Precio', 'Existencia'], filas)); zl.appendChild(h('p', null, 'Total aproximado con lo encontrado: ' + din(total) + (falta ? ' (' + falta + ' material(es) sin producto)' : ''), 'font-weight:600; margin-top:8px;')); };
    [k, q, d].forEach((e) => { e.oninput = calc; e.onchange = calc; }); calc();
  }

  // ---------- Arma tu caja ----------
  function caja(z){
    z.appendChild(h('p', 'nota', 'Arma una caja o canasta de regalo con productos de tu inventario, agrega caja, moño y mano de obra, y mira el precio y tu margen. Es un cálculo; para cobrarla usa un combo o captura el total.'));
    const q = input('', 'Buscar producto…', 40), s = sel([['', '— elige —']]), cn = input('1', '', 3, 'number'), items = [], ex = input('25', '', 6, 'number'), mg = input('30', '', 3, 'number'), zl = h('div'), zr = h('div');
    cn.style.width = '70px'; const f = h('div', null, null, 'display:flex; gap:10px; flex-wrap:wrap; align-items:flex-end; margin-bottom:10px;'); f.appendChild(campo('Buscar', q, 200)); f.appendChild(campo('Producto', s, 260)); f.appendChild(campo('Cantidad', cn, 90));
    const filtra = () => { const t = norm(q.value), l = lista().filter((p) => p.tipo !== 'servicio' && (!t || norm(p.nombre).includes(t))).slice(0, 40); s.textContent = ''; [['', '— elige —']].concat(l.map((p) => [p.id, p.nombre])).forEach(([v, tx]) => { const o = h('option', null, tx); o.value = v; s.appendChild(o); }); };
    const pinta = () => { zr.textContent = ''; let costo = 0, precio = 0; const filas = items.map((x, i) => { costo += x.p.costo != null ? N(x.p.costo) * x.n : 0; precio += N(x.p.precio) * x.n; return [x.p.nombre, String(x.n), din(N(x.p.precio) * x.n), boton('Quitar', () => { items.splice(i, 1); pinta(); }, 'texto', 'padding:2px 8px;')]; }); if(!items.length){ zr.appendChild(h('p', 'nota', 'Agrega productos a la caja.')); return; }
      zr.appendChild(tabla(['Producto', 'Cant.', 'Precio', ''], filas)); const base = costo + N(ex.value), venta = Math.max(precio + N(ex.value), mg.value ? base / (1 - Math.min(90, N(mg.value)) / 100) : 0);
      zr.appendChild(tabla(['Concepto', 'Monto'], [['Productos a precio de venta', din(precio)], ['Caja, moño y mano de obra', din(N(ex.value))], ['Costo de la caja (productos + extras)', din(base)], ['Precio sugerido con tu margen', din(Math.ceil(venta))]])); zr.appendChild(h('p', 'nota', 'El precio sugerido es el mayor entre vender cada producto a su precio más extras y el costo con tu margen.')); };
    f.appendChild(boton('Agregar', () => { const p = lista().find((x) => x.id === s.value); if(!p) return; const n = Math.max(1, Math.floor(N(cn.value)) || 1), e = items.find((x) => x.p.id === p.id); if(e) e.n += n; else items.push({ p, n }); pinta(); }, 'primario')); z.appendChild(f); const f2 = h('div', null, null, 'display:flex; gap:10px; flex-wrap:wrap; margin-bottom:10px;'); f2.appendChild(campo('Caja, moño y mano de obra $', ex, 160)); f2.appendChild(campo('Margen que quieres %', mg, 130)); z.appendChild(f2); z.appendChild(zr); q.oninput = filtra; ex.oninput = pinta; mg.oninput = pinta; filtra(); pinta();
  }

  // ---------- Cierre de vitrina ----------
  function vitrina(z){
    z.appendChild(h('p', 'nota', 'Cuenta lo que hay en la vitrina o en un mostrador al cerrar y compara con lo que dice PUVE. Muestra faltantes y sobrantes por pieza. No cambia tu existencia: si hay diferencias, las corriges tú en el producto.'));
    const cs = (() => { try { return enlace.categorias() || []; } catch(e){ return []; } })(), cat = sel([['', 'Todas las categorías']].concat(cs.map((c) => [c.id, c.nombre])), ''), zl = h('div'), res = h('div');
    z.appendChild(campo('Categoría o vitrina', cat, 260)); z.appendChild(zl); z.appendChild(res); let cont = {};
    const pinta = () => { zl.textContent = ''; const l = lista().filter((p) => p.tipo !== 'servicio' && (!cat.value || p.categoria_id === cat.value)).slice(0, 200); if(!l.length){ zl.appendChild(h('p', 'nota', 'No hay productos en esa categoría.')); return; }
      const w = h('div', 'envoltura-tabla'), t = h('table'), th = h('thead'), r0 = h('tr'); ['Producto', 'PUVE dice', 'Contaste'].forEach((c) => r0.appendChild(h('th', null, c))); th.appendChild(r0); t.appendChild(th); const tb = h('tbody');
      l.forEach((p) => { const tr = h('tr'); tr.appendChild(h('td', null, p.nombre)); tr.appendChild(h('td', null, String(p.stock))); const td = h('td'), i = input(cont[p.id] != null ? cont[p.id] : '', '', 6, 'number'); i.style.width = '80px'; i.oninput = () => { if(i.value === '') delete cont[p.id]; else cont[p.id] = N(i.value); }; td.appendChild(i); tr.appendChild(td); tb.appendChild(tr); }); t.appendChild(tb); w.appendChild(t); zl.appendChild(w);
      zl.appendChild(boton('Ver diferencias', () => { res.textContent = ''; const d = l.filter((p) => cont[p.id] != null && cont[p.id] !== N(p.stock)), sin = l.filter((p) => cont[p.id] == null).length;
        if(!Object.keys(cont).length){ msg(res, 'Captura lo que contaste.'); return; }
        res.appendChild(h('p', null, d.length ? d.length + ' pieza(s) con diferencia' + (sin ? ' · ' + sin + ' sin contar' : '') : 'Todo cuadra' + (sin ? ' (' + sin + ' sin contar)' : '') + '.', 'font-weight:600;'));
        if(d.length) res.appendChild(tabla(['Producto', 'PUVE', 'Contaste', 'Diferencia', 'Valor'], d.map((p) => { const df = cont[p.id] - N(p.stock); const r = [p.nombre, String(p.stock), String(cont[p.id]), (df > 0 ? '+' : '') + df + (df < 0 ? ' (falta)' : ' (sobra)'), din(Math.abs(df) * N(p.precio))]; r.marca = df < 0; return r; }))); }, 'primario', 'margin-top:10px;')); };
    cat.onchange = () => { cont = {}; res.textContent = ''; pinta(); }; pinta();
  }

  // ---------- Alta rápida de productos y servicios ----------
  const PRE = {
    cuidado: ['Cuidado personal', 'producto', [['Shampoo', 0], ['Jabón de tocador', 0], ['Pasta dental', 0], ['Cepillo dental', 0], ['Desodorante', 0], ['Papel higiénico (paquete)', 0], ['Toallas sanitarias', 0], ['Rastrillo desechable', 0], ['Crema corporal', 0], ['Protector solar', 0]]],
    alimento: ['Alimento y accesorios de mascotas', 'producto', [['Croquetas perro adulto (kg)', 0], ['Croquetas perro cachorro (kg)', 0], ['Croquetas gato adulto (kg)', 0], ['Alimento húmedo (lata)', 0], ['Arena para gato (bolsa)', 0], ['Premio o snack', 0], ['Collar', 0], ['Plato para alimento', 0]]],
    farmacia: ['Servicios de farmacia', 'servicio', [['Aplicación de inyección', 0], ['Toma de presión', 0], ['Prueba de glucosa', 0], ['Curación', 0], ['Consulta con médico', 0]]],
    empaque: ['Empaque como servicio', 'servicio', [['Empaque de regalo', 0], ['Moño y tarjeta', 0], ['Caja de regalo', 0], ['Envoltura especial', 0]]],
    expres: ['Servicio exprés', 'servicio', [['Servicio exprés (mismo día)', 0], ['Servicio urgente (en horas)', 0]]],
    prendas: ['Cobro por prenda', 'servicio', [['Camisa', 0], ['Pantalón', 0], ['Vestido', 0], ['Saco', 0], ['Falda', 0], ['Cobija', 0], ['Edredón', 0], ['Vestido de gala', 0]]]
  }, PRE_GIRO = { farmacias: 'cuidado', veterinarias: 'alimento', regalos: 'empaque', lavanderias: 'prendas', floristerias: 'empaque', talleres: 'expres' };
  function altaRapida(z){
    z.appendChild(h('p', 'nota', 'Crea de una vez varios productos o servicios típicos de tu giro. Tú pones el precio (y el costo si lo sabes); los que dejes sin precio no se crean. Los servicios no llevan existencia y no se repiten si ya los tienes.'));
    let g = ''; try { g = enlace.giro(); } catch(e){}
    const tipoSel = sel(Object.keys(PRE).map((k) => [k, PRE[k][0]]), PRE_GIRO[g] || 'cuidado'), zl = h('div'), m = h('div'); z.appendChild(campo('Qué quieres crear', tipoSel, 300)); z.appendChild(zl); z.appendChild(m);
    const pinta = () => { zl.textContent = ''; m.textContent = ''; const P = PRE[tipoSel.value], filas = [];
      const w = h('div', 'envoltura-tabla'), t = h('table'), th = h('thead'), r0 = h('tr'); ['Nombre', 'Precio $', 'Costo $'].forEach((c) => r0.appendChild(h('th', null, c))); th.appendChild(r0); t.appendChild(th); const tb = h('tbody');
      P[2].forEach((x) => { const tr = h('tr'), n = input(x[0], '', 60), p = input('', '0', 8, 'number'), c = input('', '0', 8, 'number'); n.value = x[0]; [p, c].forEach((e) => { e.style.width = '90px'; e.min = '0'; e.step = '0.5'; }); [n, p, c].forEach((e) => { const td = h('td'); td.appendChild(e); tr.appendChild(td); }); tb.appendChild(tr); filas.push({ n, p, c }); }); t.appendChild(tb); w.appendChild(t); zl.appendChild(w);
      const extra = input('', 'Otro nombre…', 60); zl.appendChild(h('div', null, null, 'height:6px')); zl.appendChild(boton('Crear los que tienen precio', async () => { const nv = [], ya = new Set(lista().map((p) => norm(p.nombre)));
        const todas = filas.map((f) => ({ n: f.n.value.trim(), p: N(f.p.value), c: N(f.c.value) })).filter((f) => f.n && f.p > 0); const dup = todas.filter((f) => ya.has(norm(f.n)));
        todas.filter((f) => !ya.has(norm(f.n))).forEach((f) => nv.push({ negocio_id: enlace.negocioId(), nombre: f.n.slice(0, 80), precio: f.p, costo: f.c, stock: P[1] === 'servicio' ? 999999 : 0, tipo: P[1] }));
        if(!enlace.esEncargado()){ msg(m, 'Solo el encargado puede crear productos.'); return; } if(!nv.length){ msg(m, todas.length ? 'Todos esos ya existen.' : 'Escribe el precio de al menos uno.'); return; }
        const r = await enlace.sb.from('productos').insert(nv); if(r.error){ msg(m, 'No se pudo crear: ' + r.error.message); return; } msg(m, nv.length + ' creado(s)' + (dup.length ? ' · ' + dup.length + ' ya existían' : '') + '. Ya están en tu inventario.', true); try { enlace.alCambiar(); } catch(e){} }, 'primario')); };
    tipoSel.onchange = pinta; pinta();
  }

  // ---------- Porción o muestra ----------
  function porcionMuestra(z){
    z.appendChild(h('p', 'nota', 'Vende una porción o muestra de un producto (por ejemplo un sobre de proteína o una muestra de perfume). Se crea como producto aparte, sin existencia propia: sigue descontando tú del producto original cuando lo uses. El costo se calcula dividiendo el del producto entre las porciones.'));
    const q = input('', 'Buscar producto…', 40), s = sel([['', '— elige —']]), np = input('10', '', 4, 'number'), pr = input('', 'Precio', 8, 'number'), nom = input('', 'Nombre de la porción', 60), m = h('div'), f = h('div', null, null, 'display:flex; gap:10px; flex-wrap:wrap; align-items:flex-end; margin-bottom:10px;');
    [campo('Buscar', q, 200), campo('Producto', s, 260), campo('Porciones por producto', np, 120), campo('Precio por porción $', pr, 120), campo('Nombre', nom, 220)].forEach((x) => f.appendChild(x)); z.appendChild(f);
    const filtra = () => { const t = norm(q.value), l = lista().filter((p) => p.tipo !== 'servicio' && (!t || norm(p.nombre).includes(t))).slice(0, 40); s.textContent = ''; [['', '— elige —']].concat(l.map((p) => [p.id, p.nombre])).forEach(([v, tx]) => { const o = h('option', null, tx); o.value = v; s.appendChild(o); }); };
    s.onchange = () => { const p = lista().find((x) => x.id === s.value); if(p){ nom.value = 'Porción de ' + p.nombre; if(!pr.value) pr.value = Math.ceil(N(p.precio) / Math.max(1, N(np.value)) * 1.3); } };
    z.appendChild(boton('Crear porción', async () => { const p = lista().find((x) => x.id === s.value); if(!p){ msg(m, 'Elige el producto.'); return; } if(!enlace.esEncargado()){ msg(m, 'Solo el encargado puede crear productos.'); return; } const n = Math.max(1, Math.floor(N(np.value))), precio = N(pr.value), nombre = nom.value.trim(); if(precio <= 0 || !nombre){ msg(m, 'Escribe nombre y precio.'); return; } if(lista().some((x) => norm(x.nombre) === norm(nombre))){ msg(m, 'Ya existe un producto con ese nombre.'); return; }
      const r = await enlace.sb.from('productos').insert({ negocio_id: enlace.negocioId(), nombre: nombre.slice(0, 80), precio: precio, costo: Math.round(N(p.costo) / n * 100) / 100, stock: 999999, tipo: 'servicio', categoria_id: p.categoria_id || null }); if(r.error){ msg(m, 'No se pudo crear: ' + r.error.message); return; } msg(m, 'Creada. Margen por porción: ' + din(precio - N(p.costo) / n) + '.', true); try { enlace.alCambiar(); } catch(e){} }, 'primario')); z.appendChild(m); q.oninput = filtra; filtra();
  }

  // ---------- Promoción de temporada ----------
  function promo(z){
    z.appendChild(h('p', 'nota', 'Pon un precio de promoción a toda una categoría para la temporada (usa el precio de liquidación de cada producto). Cuando termine la temporada, quita la promoción aquí mismo. PUVE no la quita solo.'));
    const cs = (() => { try { return enlace.categorias() || []; } catch(e){ return []; } })(), cat = sel(cs.map((c) => [c.id, c.nombre])), pc = sel([['10', '10% menos'], ['15', '15% menos'], ['20', '20% menos'], ['30', '30% menos'], ['40', '40% menos'], ['50', '50% menos']], '20'), zl = h('div'), m = h('div');
    const f = h('div', null, null, 'display:flex; gap:10px; flex-wrap:wrap; margin-bottom:10px;'); f.appendChild(campo('Categoría', cat, 240)); f.appendChild(campo('Rebaja', pc, 140)); z.appendChild(f); z.appendChild(zl); z.appendChild(m);
    const prods = () => lista().filter((p) => p.tipo !== 'extra' && p.categoria_id === cat.value);
    const pinta = () => { zl.textContent = ''; const l = prods(); if(!l.length){ zl.appendChild(h('p', 'nota', cs.length ? 'Esa categoría no tiene productos.' : 'Primero crea categorías.')); return; } const en = l.filter((p) => p.en_liquidacion).length, k = 1 - Number(pc.value) / 100;
      zl.appendChild(h('p', null, l.length + ' producto(s)' + (en ? ' · ' + en + ' ya en promoción' : ''), 'font-weight:600;')); zl.appendChild(tabla(['Producto', 'Precio', 'Con promoción'], l.slice(0, 15).map((p) => [p.nombre, din(p.precio), p.en_liquidacion ? 'Ya en promoción: ' + din(p.precio_liquidacion) : din(Math.round(N(p.precio) * k * 100) / 100)])));
      const cambia = async (activar) => { if(!enlace.esEncargado()){ msg(m, 'Solo el encargado puede cambiar precios.'); return; } if(!window.confirm((activar ? 'Poner promoción a ' : 'Quitar promoción de ') + l.length + ' producto(s)?')) return; msg(m, 'Guardando…', true); let fallos = 0;
        for(const p of l.slice(0, 300)){ const r = await enlace.sb.from('productos').update(activar ? { en_liquidacion: true, precio_liquidacion: Math.round(N(p.precio) * k * 100) / 100 } : { en_liquidacion: false, precio_liquidacion: null }).eq('id', p.id); if(r.error) fallos++; }
        msg(m, fallos ? fallos + ' no se pudieron cambiar.' : (activar ? 'Promoción activada.' : 'Promoción quitada.'), !fallos); try { enlace.alCambiar(); } catch(e){} };
      zl.appendChild(boton('Activar promoción', () => cambia(true), 'primario', 'margin:10px 8px 0 0;')); zl.appendChild(boton('Quitar promoción de la categoría', () => cambia(false), 'texto', 'margin-top:10px;')); };
    cat.onchange = pinta; pc.onchange = pinta; pinta();
  }

  // ---------- Pedido a proveedor ----------
  function pedidoProv(z){
    z.appendChild(h('p', 'nota', 'Arma tu lista de compra: lo que está en su mínimo o por agotarse según lo que vendes, con un aumento por temporada. El pedido lo mandas tú por WhatsApp o lo copias.'));
    const dd = input('15', '', 3, 'number'), up = input('0', '', 3, 'number'), zl = h('div'), f = h('div', null, null, 'display:flex; gap:10px; flex-wrap:wrap; margin-bottom:10px;'); [campo('Días que quieres cubrir', dd, 160), campo('Aumento por temporada %', up, 170)].forEach((x) => f.appendChild(x)); z.appendChild(f); z.appendChild(zl); let datos = null;
    const pinta = () => { zl.textContent = ''; if(!datos) return; const por = new Map(datos.map((x) => [x.producto_id, x])), cub = Math.max(1, N(dd.value)), k = 1 + N(up.value) / 100;
      const c = lista().filter((p) => p.tipo !== 'servicio' && p.tipo !== 'extra').map((p) => { const v = N((por.get(p.id) || {}).vendidas) / 60, nec = Math.ceil(Math.max(v * cub * k, N(p.stock_minimo) ) - N(p.stock)); return { p, nec, vel: v }; }).filter((x) => x.nec > 0 && (x.vel > 0 || N(x.p.stock_minimo) > 0)).sort((a, b) => b.nec * N(b.p.costo) - a.nec * N(a.p.costo)).slice(0, 60);
      if(!c.length){ zl.appendChild(h('p', 'nota', 'Nada por pedir con esos datos.')); return; } const tot = c.reduce((s, x) => s + x.nec * N(x.p.costo), 0);
      zl.appendChild(tabla(['Producto', 'Tienes', 'Pedir', 'Costo aprox.'], c.map((x) => [x.p.nombre, String(x.p.stock), String(x.nec), din(x.nec * N(x.p.costo))]))); zl.appendChild(h('p', null, 'Total aproximado: ' + din(tot), 'font-weight:600; margin-top:8px;'));
      const txt = 'Pedido:\n' + c.map((x) => '- ' + x.nec + ' × ' + x.p.nombre).join('\n'); zl.appendChild(boton('Copiar pedido', () => { try { navigator.clipboard.writeText(txt); } catch(e){} }, 'texto', 'margin:6px 8px 0 0;')); zl.appendChild(boton('Mandar por WhatsApp', () => wa('', txt), 'texto', 'margin-top:6px;')); };
    dd.oninput = pinta; up.oninput = pinta; zl.appendChild(h('p', 'nota', 'Calculando…'));
    rpc('rotacion_productos', { p_dias: 60 }).then((d) => { datos = d.items || []; pinta(); }).catch((e) => { zl.textContent = ''; const m = h('div'); msg(m, errTxt(e)); zl.appendChild(m); });
  }

  // ---------- Clientes frecuentes ----------
  function frecuentes(z){
    z.appendChild(h('p', 'nota', 'Tus clientes que más vuelven y cuánto compran. Solo cuentan las ventas donde elegiste al cliente en la caja. Puedes invitar a los que llevan tiempo sin venir; el mensaje lo envías tú.'));
    const per = sel([['30', 'Últimos 30 días'], ['90', 'Últimos 90 días'], ['180', 'Últimos 6 meses'], ['365', 'Último año']], '90'), zl = h('div'); z.appendChild(campo('Periodo', per, 190)); z.appendChild(zl);
    const carga = async () => { zl.textContent = ''; zl.appendChild(h('p', 'nota', 'Cargando…')); let d; try { d = await rpc('clientes_frecuentes', { p_dias: Number(per.value) }); } catch(e){ zl.textContent = ''; const m = h('div'); msg(m, String((e && e.message) || e).match(/does not exist|schema cache|Could not find/i) ? 'Falta ejecutar el script SQL 142 en Supabase.' : errTxt(e)); zl.appendChild(m); return; } zl.textContent = '';
      const it = d.items || []; if(!it.length){ zl.appendChild(h('p', 'nota', 'Todavía no hay ventas ligadas a clientes en este periodo.')); return; }
      const dias = (f) => Math.floor((Date.now() - new Date(f).getTime()) / 864e5);
      zl.appendChild(tabla(['Cliente', 'Visitas', 'Gastó', 'Última visita', ''], it.slice(0, 50).map((x) => { const da = dias(x.ultima); const f = [x.nombre || x.telefono || 'Cliente', String(x.visitas), din(x.total), da === 0 ? 'Hoy' : 'Hace ' + da + ' día(s)', x.telefono && da >= 14 ? boton('Invitar de vuelta', () => wa(x.telefono, 'Hola ' + (x.nombre || '') + ' 👋 hace tiempo que no te vemos. Te esperamos pronto, gracias por ser cliente frecuente.'), 'texto', 'padding:3px 8px;') : '']; f.marca = da >= 30; return f; })));
      zl.appendChild(h('p', 'nota', 'Las filas marcadas llevan más de 30 días sin venir.')); };
    per.onchange = carga; carga();
  }

  // ---------- Producto que gasta el servicio ----------
  function gastaServicio(z){
    z.appendChild(h('p', 'nota', 'Liga un servicio con el producto que gasta (por ejemplo, un tinte por cada tratamiento). Cada vez que cobres el servicio, la existencia del producto baja sola, sin llegar a menos de cero.'));
    const sv = sel([['', '— servicio —']]), pr = sel([['', '— producto que gasta —']]), ct = input('1', '', 6, 'number'), m = h('div'), zl = h('div'); ct.step = '0.05';
    const ps = () => lista(), serv = () => ps().filter((p) => p.tipo === 'servicio' && p.tipo !== 'extra'), prod = () => ps().filter((p) => p.tipo !== 'servicio' && p.tipo !== 'extra');
    const llena = () => { [[sv, serv(), '— servicio —'], [pr, prod(), '— producto que gasta —']].forEach(([s, l, t]) => { s.textContent = ''; [['', t]].concat(l.slice(0, 300).map((p) => [p.id, p.nombre])).forEach(([v, tx]) => { const o = h('option', null, tx); o.value = v; s.appendChild(o); }); }); };
    const f = h('div', null, null, 'display:flex; gap:10px; flex-wrap:wrap; align-items:flex-end; margin-bottom:10px;'); [campo('Servicio', sv, 240), campo('Producto', pr, 240), campo('Cantidad por servicio', ct, 140)].forEach((x) => f.appendChild(x));
    f.appendChild(boton('Ligar', async () => { if(!enlace.esEncargado()){ msg(m, 'Solo el encargado puede cambiar productos.'); return; } if(!sv.value || !pr.value){ msg(m, 'Elige el servicio y el producto.'); return; } const c = N(ct.value); if(c <= 0 || c > 1000){ msg(m, 'La cantidad debe ser mayor que 0.'); return; }
      const r = await enlace.sb.from('productos').update({ insumo_id: pr.value, insumo_cantidad: c }).eq('id', sv.value); if(r.error){ msg(m, 'No se pudo ligar: ' + (/insumo_id|column/i.test(r.error.message) ? 'falta el SQL 88 de papelería en Supabase.' : r.error.message)); return; } msg(m, 'Listo. Se aplica a las ventas nuevas.', true); try { enlace.alCambiar(); } catch(e){} setTimeout(lista2, 400); }, 'primario')); z.appendChild(f); z.appendChild(m); z.appendChild(zl);
    function lista2(){ zl.textContent = ''; const l = serv().filter((p) => p.insumo_id); if(!l.length){ zl.appendChild(h('p', 'nota', 'Todavía no hay servicios ligados a un producto.')); return; } const por = new Map(ps().map((p) => [p.id, p]));
      zl.appendChild(tabla(['Servicio', 'Gasta', 'Cantidad', ''], l.map((p) => [p.nombre, (por.get(p.insumo_id) || {}).nombre || '—', String(p.insumo_cantidad), boton('Quitar', async () => { const r = await enlace.sb.from('productos').update({ insumo_id: null, insumo_cantidad: 1 }).eq('id', p.id); if(r.error){ msg(m, r.error.message); return; } msg(m, 'Quitado.', true); try { enlace.alCambiar(); } catch(e){} setTimeout(lista2, 400); }, 'texto', 'padding:2px 8px;')]))); }
    llena(); lista2();
  }

  // ---------- Reservas y reseñas por QR (páginas públicas reservar.html y cotizacion.html, SQL 143) ----------
  const base = () => location.origin + location.pathname.replace(/[^/]*$/, '');
  const enlaceQR = (z, titulo, url) => { const c = h('div', null, null, 'display:flex; gap:12px; align-items:center; flex-wrap:wrap; padding:8px 0; border-top:1px solid var(--borde);'); try { if(enlace.qr){ const i = h('img'); i.src = enlace.qr(url, 120); i.alt = 'QR ' + titulo; i.style.cssText = 'width:96px; height:96px; background:#fff; padding:4px; border-radius:6px;'; c.appendChild(i); } } catch(e){} const t = h('div', null, null, 'flex:1 1 200px;'); t.appendChild(h('strong', null, titulo)); const u = h('div', 'nota', url, 'word-break:break-all; font-size:12px;'); t.appendChild(u); t.appendChild(boton('Copiar enlace', () => { try { navigator.clipboard.writeText(url); } catch(e){} u.textContent = 'Copiado: ' + url; }, 'texto', 'margin-top:4px; padding:3px 8px;')); c.appendChild(t); z.appendChild(c); };
  const falta143 = (e) => /does not exist|schema cache|Could not find/i.test((e && e.message) || '') ? 'Falta ejecutar el SQL 143 en Supabase (y desplegar la función pedido-qr).' : errTxt(e);
  const FECHA = (f) => new Date(f + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' });
  function reservas(z){
    z.appendChild(h('p', 'nota', 'Imprime o comparte estos códigos: el cliente deja su solicitud de reserva y tú la confirmas o cancelas aquí. No es una confirmación automática: tú le avisas por WhatsApp.'));
    const neg = (() => { try { return enlace.negocioId(); } catch(e){ return ''; } })(); [['Reservar mesa', 'mesa'], ['Reservar botella o mesa con servicio', 'botella'], ['Reservar cita', 'cita']].forEach(([t, k]) => enlaceQR(z, t, base() + 'reservar.html#n=' + neg + '&t=' + k));
    const zl = h('div', null, null, 'margin-top:14px;'), m = h('div'); z.appendChild(m); z.appendChild(zl);
    const carga = async () => { zl.textContent = ''; let l; try { l = await rpc('reservas_lista', { p_dias: 30 }); } catch(e){ msg(m, falta143(e)); return; } if(!l.length){ zl.appendChild(h('p', 'nota', 'No hay solicitudes de reserva.')); return; }
      const TIPO = { mesa: 'Mesa', botella: 'Botella', cita: 'Cita' }; zl.appendChild(h('h3', null, 'Solicitudes (' + l.length + ')', 'margin:6px 0;'));
      zl.appendChild(tabla(['Cuándo', 'Quién', 'Qué', ''], l.map((x) => { const ac = h('div', null, null, 'display:flex; gap:6px; flex-wrap:wrap;'); if(x.estado === 'pendiente') ac.appendChild(boton('Confirmar', async () => { try { await rpc('reserva_estado', { p_id: x.id, p_estado: 'confirmada' }); wa(x.telefono, 'Hola ' + x.nombre + ', tu reserva del ' + FECHA(x.fecha) + ' a las ' + x.hora + ' quedó confirmada. ¡Te esperamos!'); carga(); } catch(e){ msg(m, falta143(e)); } }, 'primario', 'padding:3px 8px;'));
        ac.appendChild(boton('Cancelar', async () => { if(!window.confirm('¿Cancelar la reserva de ' + x.nombre + '?')) return; try { await rpc('reserva_estado', { p_id: x.id, p_estado: 'cancelada' }); carga(); } catch(e){ msg(m, falta143(e)); } }, 'texto', 'padding:3px 8px;')); ac.appendChild(boton('WhatsApp', () => wa(x.telefono, 'Hola ' + x.nombre + ', sobre tu reserva del ' + FECHA(x.fecha) + ' a las ' + x.hora + ': '), 'texto', 'padding:3px 8px;'));
        const f = [FECHA(x.fecha) + ' ' + x.hora, x.nombre + ' · ' + x.telefono, (TIPO[x.tipo] || x.tipo) + ' · ' + x.personas + ' persona(s)' + (x.nota ? ' · ' + x.nota : '') + ' · ' + (x.estado === 'confirmada' ? 'Confirmada' : 'Pendiente'), ac]; f.marca = x.estado === 'pendiente'; return f; })));
      zl.appendChild(h('p', 'nota', 'Las filas marcadas esperan tu respuesta.')); };
    carga();
  }
  function resenas(z){
    z.appendChild(h('p', 'nota', 'Pon este código en la mesa o en el ticket. Lo que escriba el cliente llega solo a ti; no se publica en ningún lado.'));
    const neg = (() => { try { return enlace.negocioId(); } catch(e){ return ''; } })(); enlaceQR(z, 'Dejar una reseña privada', base() + 'reservar.html#n=' + neg + '&t=resena');
    const zl = h('div', null, null, 'margin-top:14px;'), m = h('div'); z.appendChild(m); z.appendChild(zl);
    const carga = async () => { zl.textContent = ''; let l; try { l = await rpc('resenas_lista'); } catch(e){ msg(m, falta143(e)); return; } if(!l.length){ zl.appendChild(h('p', 'nota', 'Todavía no hay reseñas.')); return; } const prom = l.reduce((s, x) => s + x.estrellas, 0) / l.length;
      zl.appendChild(h('p', null, l.length + ' reseña(s) · promedio ' + prom.toFixed(1) + ' de 5', 'font-weight:600;')); zl.appendChild(tabla(['Cuándo', 'Estrellas', 'Comentario', ''], l.map((x) => { const f = [new Date(x.creado_en).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }), '★'.repeat(x.estrellas) + '☆'.repeat(5 - x.estrellas), (x.comentario || '—') + (x.contacto ? ' · Contacto: ' + x.contacto : ''), boton(x.leida ? 'Marcar sin leer' : 'Marcar leída', async () => { try { await rpc('resena_leida', { p_id: x.id, p_leida: !x.leida }); carga(); } catch(e){ msg(m, falta143(e)); } }, 'texto', 'padding:2px 8px;')]; f.marca = !x.leida; return f; }))); zl.appendChild(h('p', 'nota', 'Las filas marcadas no las has leído.')); };
    carga();
  }
  function cotLink(z){
    z.appendChild(h('p', 'nota', 'Manda al cliente un enlace para ver su cotización y aceptarla o rechazarla desde su celular. Aquí ves en qué quedó. Las cotizaciones las creas en la sección de cotizaciones.'));
    const zl = h('div'), m = h('div'); z.appendChild(m); z.appendChild(zl); const neg = (() => { try { return enlace.negocioId(); } catch(e){ return ''; } })();
    (async () => { const r = await enlace.sb.from('cotizaciones').select('id,folio,cliente,telefono,total,estado,creado_en,vigencia_dias').order('creado_en', { ascending: false }).limit(40); if(r.error){ msg(m, errTxt(r.error)); return; } if(!r.data.length){ zl.appendChild(h('p', 'nota', 'Todavía no hay cotizaciones.')); return; }
      const ET = { enviada: 'Esperando respuesta', aceptada: 'Aceptada', rechazada: 'Rechazada' };
      zl.appendChild(tabla(['Folio', 'Cliente', 'Total', 'Estado', ''], r.data.map((c) => { const url = base() + 'cotizacion.html#n=' + neg + '&c=' + c.id, ac = h('div', null, null, 'display:flex; gap:6px; flex-wrap:wrap;'); ac.appendChild(boton('Copiar enlace', () => { try { navigator.clipboard.writeText(url); } catch(e){} msg(m, 'Enlace copiado.', true); }, 'texto', 'padding:3px 8px;')); if(c.telefono) ac.appendChild(boton('Mandar por WhatsApp', () => wa(c.telefono, 'Hola ' + c.cliente + ', aquí está tu cotización por ' + din(c.total) + '. Puedes verla y aceptarla aquí: ' + url), 'texto', 'padding:3px 8px;')); return [String(c.folio), c.cliente, din(c.total), ET[c.estado] || c.estado, ac]; }))); })();
  }

  // ---------- Bloquear horario en la agenda (SQL 144) ----------
  function bloqueos(z){
    z.appendChild(h('p', 'nota', 'Aparta un horario de un empleado o cajón (comida, descanso, mantenimiento) para que nadie pueda agendar ahí. Para registrar un cajón del taller, crea un empleado llamado «Cajón 1» sin comisión. El bloqueo se ve en la agenda como «Bloqueo».'));
    const emp = sel([['', '— elige —']]), fec = input('', '', 10, 'date'), hor = input('14:00', '', 5, 'time'), dur = sel([['30', '30 minutos'], ['60', '1 hora'], ['120', '2 horas'], ['240', '4 horas'], ['480', '8 horas']], '60'), mot = input('', 'Comida, mantenimiento…', 60), m = h('div'), zl = h('div');
    fec.value = hoy(); const f = h('div', null, null, 'display:flex; gap:10px; flex-wrap:wrap; align-items:flex-end; margin-bottom:10px;'); [campo('Empleado o cajón', emp, 200), campo('Día', fec, 150), campo('Hora', hor, 110), campo('Duración', dur, 140), campo('Motivo', mot, 200)].forEach((x) => f.appendChild(x));
    f.appendChild(boton('Bloquear', async () => { if(!emp.value){ msg(m, 'Elige el empleado.'); return; } if(!fec.value || !hor.value){ msg(m, 'Elige día y hora.'); return; } const ini = new Date(fec.value + 'T' + hor.value + ':00');
      try { await rpc('bloqueo_crear', { p_empleado: emp.value, p_inicio: ini.toISOString(), p_minutos: Number(dur.value), p_motivo: mot.value.trim() || null }); msg(m, 'Horario bloqueado.', true); carga(); } catch(e){ msg(m, /does not exist|schema cache|Could not find/i.test((e && e.message) || '') ? 'Falta ejecutar el SQL 144 en Supabase.' : errTxt(e)); } }, 'primario')); z.appendChild(f); z.appendChild(m); z.appendChild(zl);
    enlace.sb.from('empleados').select('id,nombre,activo').order('nombre').then((r) => { (r.data || []).filter((e) => e.activo).forEach((e) => { const o = h('option', null, e.nombre); o.value = e.id; emp.appendChild(o); }); });
    const carga = async () => { zl.textContent = ''; let l; try { l = await rpc('bloqueos_lista'); } catch(e){ return; } if(!l.length){ zl.appendChild(h('p', 'nota', 'No hay bloqueos próximos.')); return; }
      zl.appendChild(tabla(['Empleado', 'Cuándo', 'Motivo', ''], l.map((x) => [x.empleado, new Date(x.inicio).toLocaleString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + ' a ' + new Date(x.fin).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }), String(x.motivo).replace(/^Bloqueo:?\s*/, '') || '—', boton('Quitar', async () => { try { await rpc('bloqueo_quitar', { p_id: x.id }); carga(); } catch(e){ msg(m, errTxt(e)); } }, 'texto', 'padding:2px 8px;')]))); };
    carga();
  }

  // ---------- Unir PDFs e imágenes ----------
  function cargaPdfLib(){ return new Promise((ok, no) => { if(window.PDFLib) return ok(window.PDFLib); const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js'; s.onload = () => window.PDFLib ? ok(window.PDFLib) : no(new Error('No cargó')); s.onerror = () => no(new Error('No se pudo descargar la librería. Revisa tu internet.')); document.head.appendChild(s); }); }
  function unirPdf(z){
    z.appendChild(h('p', 'nota', 'Junta varios PDF y fotos (JPG o PNG) en un solo PDF, en el orden que elijas. Todo pasa en tu equipo; no se sube nada. Necesita internet la primera vez para cargar la librería.'));
    const arch = [], fi = input('', '', 0, 'file'), zl = h('div', null, null, 'margin:10px 0;'), m = h('div'); fi.accept = 'application/pdf,image/jpeg,image/png'; fi.multiple = true;
    const pinta = () => { zl.textContent = ''; arch.forEach((f, i) => { const r = h('div', null, null, 'display:flex; gap:6px; align-items:center; padding:5px 0; border-top:1px solid var(--borde);'); r.appendChild(h('span', null, (i + 1) + '. ' + f.name + ' (' + Math.max(1, Math.round(f.size / 1024)) + ' KB)', 'flex:1;')); r.appendChild(boton('↑', () => { if(i > 0){ [arch[i - 1], arch[i]] = [arch[i], arch[i - 1]]; pinta(); } }, 'texto', 'padding:1px 8px;')); r.appendChild(boton('↓', () => { if(i < arch.length - 1){ [arch[i + 1], arch[i]] = [arch[i], arch[i + 1]]; pinta(); } }, 'texto', 'padding:1px 8px;')); r.appendChild(boton('✕', () => { arch.splice(i, 1); pinta(); }, 'texto', 'padding:1px 8px;')); zl.appendChild(r); }); };
    fi.onchange = () => { Array.from(fi.files || []).forEach((f) => { if(arch.length >= 40) return; if(f.size > 25 * 1024 * 1024){ msg(m, f.name + ' pesa más de 25 MB y se omitió.'); return; } if(/^(application\/pdf|image\/(jpeg|png))$/.test(f.type)) arch.push(f); }); fi.value = ''; pinta(); };
    z.appendChild(campo('Agregar archivos', fi, 280)); z.appendChild(zl);
    z.appendChild(boton('Unir y descargar', async () => { if(arch.length < 1){ msg(m, 'Agrega al menos un archivo.'); return; } msg(m, 'Uniendo…', true); try { const L = await cargaPdfLib(), out = await L.PDFDocument.create();
      for(const f of arch){ const buf = await f.arrayBuffer(); if(f.type === 'application/pdf'){ const d = await L.PDFDocument.load(buf, { ignoreEncryption: false }); (await out.copyPages(d, d.getPageIndices())).forEach((p) => out.addPage(p)); } else { const im = f.type === 'image/png' ? await out.embedPng(buf) : await out.embedJpg(buf), W = 595, H = 842, k = Math.min(W / im.width, H / im.height, 1), pg = out.addPage([W, H]); pg.drawImage(im, { x: (W - im.width * k) / 2, y: (H - im.height * k) / 2, width: im.width * k, height: im.height * k }); } }
      const bytes = await out.save(), a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' })); a.download = 'unido.pdf'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); msg(m, 'Listo: ' + out.getPageCount() + ' página(s).', true);
    } catch(e){ msg(m, 'No se pudo unir: ' + ((e && e.message) || e) + (/encrypt/i.test((e && e.message) || '') ? ' (algún PDF tiene contraseña)' : '')); } }, 'primario')); z.appendChild(m);
  }

  const TABS = [['fiado', 'Corte de fiado', fiado], ['oferta', 'Oferta del día', oferta], ['temporada', 'Temporada', temporada], ['sustitutos', 'Sustitutos', sustitutos], ['vin', 'Decodificar VIN', vin], ['codigo', 'Datos por código de barras', codigo], ['credencial', 'Fotos credencial', credencial], ['escaner', 'Escáner a PDF', escaner], ['cumple', 'Regalo de cumpleaños', cumple], ['masa', 'Venta de masa', masa], ['copias', 'Copias e impresiones', copias], ['proyecto', 'Plantillas de proyecto', proyecto], ['caja', 'Arma tu caja', caja], ['vitrina', 'Cierre de vitrina', vitrina], ['alta', 'Alta rápida', altaRapida], ['porcion', 'Venta por porción', porcionMuestra], ['promo', 'Promoción de temporada', promo], ['pedido', 'Pedido a proveedor', pedidoProv], ['frecuentes', 'Clientes frecuentes', frecuentes], ['gasta', 'Producto que gasta el servicio', gastaServicio], ['reservas', 'Reservas por QR', reservas], ['resenas', 'Reseñas privadas', resenas], ['cotlink', 'Cotización por enlace', cotLink], ['bloqueos', 'Bloquear horario', bloqueos], ['unir', 'Unir PDFs e imágenes', unirPdf]];
  window.PuveHerr3 = { enlazar(o){ enlace = Object.assign(enlace, o || {}); }, pestanas: () => TABS.slice() };
  if(window.PuveHerr2 && PuveHerr2.registrar) TABS.forEach((t) => PuveHerr2.registrar(t[0], t[1], t[2]));
})();
