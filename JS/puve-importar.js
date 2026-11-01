// Importar productos desde otro punto de venta (Excel, CSV...). Todo se lee en el navegador: el archivo no se sube a ningún lado,
// solo se guardan los productos ya revisados. Usa del sistema: sb, negocioId, productosCache, categoriasCache, cargarProductos,
// puedoEditarProductos, avisoSoloEncargado, enLinea, funcionPuveActiva y textoErrorProducto.
(function(){
  'use strict';
  var MAX_FILAS = 5000, MAX_BYTES = 8 * 1024 * 1024, LOTE = 200;
  var XLSX_URL = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';

  // ---------- lectura del archivo (funciones puras: se pueden probar sin pantalla) ----------
  function sinAcentos(t){ return String(t == null ? '' : t).normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function clave(t){ return sinAcentos(t).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }

  function decodificar(buf){
    var u8 = new Uint8Array(buf), texto;
    try { texto = new TextDecoder('utf-8', { fatal: true }).decode(u8); }
    catch(e){ texto = new TextDecoder('windows-1252').decode(u8); }   // los CSV de Excel en español suelen venir así
    return texto.replace(/^﻿/, '');
  }
  function separador(texto){
    var linea = '', dentro = false, i, c;
    for(i = 0; i < texto.length && linea.length < 4000; i++){ c = texto[i]; if(c === '"') dentro = !dentro; if(!dentro && (c === '\n' || c === '\r')) break; linea += c; }
    var mejor = ',', max = 0;
    [',', ';', '\t', '|'].forEach(function(s){ var n = 0, q = false; for(var j = 0; j < linea.length; j++){ if(linea[j] === '"') q = !q; else if(!q && linea[j] === s) n++; } if(n > max){ max = n; mejor = s; } });
    return mejor;
  }
  function leerCSV(texto){
    var sep = separador(texto), filas = [], fila = [], campo = '', q = false, i, c;
    for(i = 0; i < texto.length; i++){
      c = texto[i];
      if(q){ if(c === '"'){ if(texto[i + 1] === '"'){ campo += '"'; i++; } else q = false; } else campo += c; }
      else if(c === '"' && campo === '') q = true;
      else if(c === sep){ fila.push(campo); campo = ''; }
      else if(c === '\n' || c === '\r'){ if(c === '\r' && texto[i + 1] === '\n') i++; fila.push(campo); campo = ''; filas.push(fila); fila = []; }
      else campo += c;
    }
    if(campo !== '' || fila.length){ fila.push(campo); filas.push(fila); }
    return limpiarFilas(filas);
  }
  function limpiarFilas(filas){
    var vistas = filas.map(function(f){ return f.map(function(v){ return v == null ? '' : v; }); }).filter(function(f){ return f.some(function(v){ return String(v).trim() !== ''; }); });
    var ancho = vistas.reduce(function(m, f){ return Math.max(m, f.length); }, 0);
    return vistas.map(function(f){ while(f.length < ancho) f.push(''); return f; });
  }
  function aTexto(v){
    if(v == null) return '';
    if(v instanceof Date) return isNaN(v) ? '' : v.getFullYear() + '-' + String(v.getMonth() + 1).padStart(2, '0') + '-' + String(v.getDate()).padStart(2, '0');
    if(typeof v === 'number'){ var s = String(v); if(/e/i.test(s)) { try { s = BigInt(Math.round(v)).toString(); } catch(e){} } return s; }
    return String(v).trim();
  }

  function numero(v){   // "$1,234.50", "1.234,50", "12,5", "  7 " → número; vacío o texto raro → null
    if(typeof v === 'number') return isFinite(v) ? v : null;
    var s = String(v == null ? '' : v).replace(/[\s$€]|MXN|USD|mx|pesos?/gi, '');
    if(!s) return null;
    var neg = /^\(.*\)$/.test(s) || /^-/.test(s); s = s.replace(/[()\-]/g, '');
    if(!/^[0-9.,]+$/.test(s)) return null;
    var p = s.lastIndexOf('.'), c = s.lastIndexOf(',');
    if(p >= 0 && c >= 0){ s = p > c ? s.replace(/,/g, '') : s.replace(/\./g, '').replace(',', '.'); }
    else if(c >= 0){ s = /,\d{1,2}$/.test(s) && (s.match(/,/g) || []).length === 1 ? s.replace(',', '.') : s.replace(/,/g, ''); }
    else if(p >= 0 && (s.match(/\./g) || []).length > 1) s = s.replace(/\./g, '');
    var n = parseFloat(s); if(!isFinite(n)) return null;
    return neg ? -n : n;
  }
  function fecha(v){   // 2026-12-31 · 31/12/2026 · 31-12-26 · número de serie de Excel → "2026-12-31" o null
    var s = aTexto(v); if(!s) return null;
    var m = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
    if(!m){ var d = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2}|\d{4})$/); if(d) m = [0, d[3].length === 2 ? '20' + d[3] : d[3], d[2], d[1]]; }
    if(!m && /^\d{5}$/.test(s)){ var t = new Date(Math.round((Number(s) - 25569) * 86400000)); m = [0, t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()]; }
    if(!m) return null;
    var y = +m[1], mo = +m[2], da = +m[3], f = new Date(Date.UTC(y, mo - 1, da));
    if(y < 2000 || y > 2100 || f.getUTCMonth() !== mo - 1 || f.getUTCDate() !== da) return null;
    return y + '-' + String(mo).padStart(2, '0') + '-' + String(da).padStart(2, '0');
  }

  // Campos del sistema y los nombres con que suelen venir en otros puntos de venta
  var CAMPOS = [
    { id: 'nombre', etq: 'Nombre', req: true, sin: ['nombre', 'nombre del producto', 'producto', 'descripcion', 'descripcion del producto', 'articulo', 'concepto', 'item', 'name', 'title'] },
    { id: 'precio', etq: 'Precio de venta', req: true, sin: ['precio', 'precio venta', 'precio de venta', 'precio publico', 'precio al publico', 'pvp', 'precio 1', 'precio1', 'price', 'importe', 'p venta', 'pventa', 'venta', 'precio unitario', 'prec venta', 'precio normal'] },
    { id: 'sku', etq: 'Código de barras o SKU', sin: ['sku', 'codigo', 'codigo de barras', 'cod barras', 'codigo barras', 'barcode', 'ean', 'upc', 'clave', 'cod', 'referencia'] },
    { id: 'costo', etq: 'Costo', sin: ['costo', 'costo unitario', 'precio compra', 'precio de compra', 'ultimo costo', 'cost', 'costo promedio', 'p compra', 'pcompra', 'compra'] },
    { id: 'stock', etq: 'Existencias', sin: ['stock', 'existencia', 'existencias', 'inventario', 'cantidad', 'cant', 'qty', 'disponible', 'en existencia'] },
    { id: 'categoria', etq: 'Categoría', sin: ['categoria', 'departamento', 'depto', 'linea', 'familia', 'grupo', 'rubro', 'category', 'seccion'] },
    { id: 'caducidad', etq: 'Caducidad', sin: ['caducidad', 'fecha de caducidad', 'fecha caducidad', 'vencimiento', 'fecha de vencimiento', 'caduca', 'expira'] }
  ];
  function adivinarColumnas(encabezados){   // { nombre: 2, precio: 5, ... } con el índice de columna de cada campo, sin repetir columnas
    var claves = encabezados.map(clave), usadas = {}, res = {};
    function tomar(campo, i){ res[campo.id] = i; usadas[i] = true; }
    CAMPOS.forEach(function(c){ var i = claves.findIndex(function(k, j){ return !usadas[j] && c.sin.indexOf(k) >= 0; }); if(i >= 0) tomar(c, i); });
    CAMPOS.forEach(function(c){ if(res[c.id] != null) return; var i = claves.findIndex(function(k, j){ return !usadas[j] && k && c.sin.some(function(s){ return s.length > 3 && (k.indexOf(s) >= 0 || (k.length > 3 && s.indexOf(k) >= 0)); }); }); if(i >= 0) tomar(c, i); });
    return res;
  }

  // Revisa todas las filas con el mapa de columnas elegido. existentes: { porSku: Map, porNombre: Map } de productos que ya tiene el negocio.
  function revisar(filas, mapa, opc, existentes){
    var res = { nuevos: [], actualizar: [], omitidos: [], errores: [], avisos: 0 }, vistoSku = {}, vistoNom = {};
    filas.forEach(function(f, n){
      var linea = n + 2;   // la fila 1 del archivo son los títulos
      function v(id){ return mapa[id] == null ? '' : aTexto(f[mapa[id]]); }
      var nombre = v('nombre').replace(/\s+/g, ' ').trim(), sku = v('sku').replace(/^'/, '').trim();
      if(!nombre){ if(f.some(function(x){ return String(x).trim(); })) res.errores.push({ linea: linea, motivo: 'no tiene nombre' }); return; }
      var precio = mapa.precio == null ? null : numero(f[mapa.precio]);
      if(precio == null){ res.errores.push({ linea: linea, nombre: nombre, motivo: 'el precio está vacío o no se entiende' }); return; }
      if(precio < 0){ res.errores.push({ linea: linea, nombre: nombre, motivo: 'el precio es negativo' }); return; }
      var costo = mapa.costo == null ? null : numero(f[mapa.costo]), stock = mapa.stock == null ? null : numero(f[mapa.stock]);
      if(costo != null && costo < 0){ costo = 0; res.avisos++; }
      if(stock != null && stock < 0){ stock = 0; res.avisos++; }
      var cad = mapa.caducidad == null ? null : fecha(f[mapa.caducidad]);
      var reg = { nombre: nombre.slice(0, 160), sku: sku ? sku.slice(0, 80) : null, precio: Math.round(precio * 100) / 100, categoria: v('categoria').replace(/\s+/g, ' ').trim().slice(0, 60) || null, linea: linea };
      if(costo != null) reg.costo = Math.round(costo * 100) / 100;
      if(stock != null) reg.stock = Math.round(stock * 100) / 100;
      if(cad) reg.fecha_caducidad = cad;
      var ks = sku ? sku.toLowerCase() : '', kn = clave(nombre);
      if((ks && vistoSku[ks]) || (!ks && vistoNom[kn])){ res.omitidos.push({ linea: linea, nombre: nombre, motivo: 'repetido en el archivo' }); return; }
      if(ks) vistoSku[ks] = true; else vistoNom[kn] = true;
      var ya = (ks && existentes.porSku.get(ks)) || (!ks && existentes.porNombre.get(kn));
      if(ya){
        if(opc.repetidos === 'actualizar'){ reg.id = ya.id; res.actualizar.push(reg); }
        else res.omitidos.push({ linea: linea, nombre: nombre, motivo: 'ya lo tienes' });
        return;
      }
      res.nuevos.push(reg);
    });
    return res;
  }
  function indexarExistentes(lista){
    var porSku = new Map(), porNombre = new Map();
    (lista || []).forEach(function(p){ if(p.sku) porSku.set(String(p.sku).trim().toLowerCase(), p); porNombre.set(clave(p.nombre), p); });
    return { porSku: porSku, porNombre: porNombre };
  }
  function plantillaCSV(){
    return '﻿nombre,precio,costo,existencias,codigo,categoria,caducidad\r\nRefresco 600 ml,18.00,12.50,24,7501055300075,Bebidas,2027-03-31\r\nGalletas de avena,22.50,15,10,,Botanas,\r\nAgua 1 L,12,7,48,7501000000017,Bebidas,\r\n';
  }

  // ---------- pantalla ----------
  var E = null, estado = null;
  function el(tag, cls, txt){ var e = document.createElement(tag); if(cls) e.className = cls; if(txt != null) e.textContent = txt; return e; }
  function estilos(){
    if(document.getElementById('estiloImportar')) return;
    var s = document.createElement('style'); s.id = 'estiloImportar';
    s.textContent = [
      '#importarProd{position:fixed;inset:0;z-index:9500;background:var(--fondo);overflow-y:auto;overscroll-behavior:contain;display:none}',
      '#importarProd.activo{display:block}',
      '#importarProd .imp-cuerpo{max-width:900px;margin:0 auto;padding:18px 20px 40px}',
      '#importarProd .imp-zona{border:2px dashed var(--borde);border-radius:18px;padding:34px 20px;text-align:center;background:var(--vid2);cursor:pointer}',
      '#importarProd .imp-zona.sobre{border-color:var(--acento)}',
      '#importarProd .imp-zona b{display:block;font-size:16px;margin-bottom:6px}',
      '#importarProd .imp-zona span{color:var(--texto-suave);font-size:13.5px}',
      '#importarProd .imp-pasos{margin:0 0 18px;padding-left:20px;color:var(--texto-suave);font-size:14px;line-height:1.7}',
      '#importarProd h3{margin:26px 0 10px;font-size:15px}',
      '#importarProd .imp-map{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.3fr);gap:8px 12px;align-items:center}',
      '#importarProd .imp-map label{margin:0;font-size:14px}',
      '#importarProd .imp-map select{width:100%;padding:9px 11px;border:1px solid var(--borde);border-radius:10px;background:var(--superficie);color:var(--texto);font:inherit;font-size:14px}',
      '#importarProd .imp-opc{display:flex;flex-direction:column;gap:8px}',
      '#importarProd .imp-opc label{display:flex;gap:10px;align-items:flex-start;margin:0;padding:12px 14px;border:1px solid var(--borde);border-radius:14px;background:var(--vid2);cursor:pointer;font-size:14px}',
      '#importarProd .imp-opc input{width:18px;height:18px;margin:2px 0 0;flex:none}',
      '#importarProd .imp-opc small{display:block;color:var(--texto-suave);font-size:12.5px;margin-top:2px}',
      '#importarProd .imp-resumen{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px}',
      '#importarProd .imp-resumen div{padding:12px 14px;border:1px solid var(--borde);border-radius:14px;background:var(--vid2)}',
      '#importarProd .imp-resumen b{display:block;font-size:24px;font-variant-numeric:tabular-nums}',
      '#importarProd .imp-resumen span{font-size:12.5px;color:var(--texto-suave)}',
      '#importarProd .imp-tabla{overflow-x:auto;border:1px solid var(--borde);border-radius:14px}',
      '#importarProd table{width:100%;border-collapse:collapse;font-size:13px}',
      '#importarProd th,#importarProd td{padding:8px 10px;text-align:left;border-bottom:1px solid var(--borde);white-space:nowrap;max-width:240px;overflow:hidden;text-overflow:ellipsis}',
      '#importarProd .imp-lista{margin:8px 0 0;padding-left:18px;font-size:13px;color:var(--texto-suave);line-height:1.6}',
      '#importarProd .imp-barra{height:8px;border-radius:99px;background:var(--vid2);overflow:hidden;margin-top:14px}',
      '#importarProd .imp-barra i{display:block;height:100%;width:0;background:var(--acento);transition:width .2s}',
      '#importarProd .imp-acciones{display:flex;gap:10px;flex-wrap:wrap;margin-top:22px}',
      '#importarProd .imp-acciones button{padding:12px 18px}',
      'body.importar-abierto{overflow:hidden}',
      '@media (max-width:600px){#importarProd .imp-map{grid-template-columns:1fr}}'
    ].join('\n');
    document.head.appendChild(s);
  }
  function crear(){
    if(E) return;
    estilos();
    E = el('div'); E.id = 'importarProd'; E.setAttribute('role', 'dialog'); E.setAttribute('aria-modal', 'true'); E.setAttribute('aria-labelledby', 'tituloImportar');
    var cab = el('div', 'panel-form-cab'), t = el('h2', null, 'Importar productos'); t.id = 'tituloImportar';
    var x = el('button', 'panel-form-cerrar', '✕'); x.type = 'button'; x.setAttribute('aria-label', 'Cerrar'); x.onclick = cerrar;
    cab.append(t, x);
    var cuerpo = el('div', 'imp-cuerpo'), msg = el('div', 'mensaje'); msg.id = 'mensajeImportar'; var zona = el('div'); zona.id = 'zonaImportar';
    cuerpo.append(msg, zona); E.append(cab, cuerpo); document.body.appendChild(E);
    document.addEventListener('keydown', function(ev){ if(ev.key === 'Escape' && E.classList.contains('activo') && !(estado && estado.trabajando)) cerrar(); });
  }
  function aviso(txt, tipo){ var m = document.getElementById('mensajeImportar'); m.textContent = txt || ''; m.className = txt ? 'mensaje ' + (tipo || 'error') : 'mensaje'; if(txt) E.scrollTop = 0; }
  function cerrar(){ if(estado && estado.trabajando) return; E.classList.remove('activo'); document.body.classList.remove('importar-abierto'); estado = null; }

  function abrir(){
    if(typeof puedoEditarProductos === 'function' && !puedoEditarProductos()){ avisoSoloEncargado(); return; }
    if(typeof funcionPuveActiva === 'function' && !funcionPuveActiva('admin.guardar_producto')) return;
    crear(); estado = { trabajando: false }; E.classList.add('activo'); document.body.classList.add('importar-abierto'); E.scrollTop = 0; aviso('');
    pantallaArchivo();
  }

  function pantallaArchivo(){
    var z = document.getElementById('zonaImportar'); z.textContent = '';
    var pasos = el('ol', 'imp-pasos');
    ['En tu otro punto de venta, exporta tus productos a Excel o CSV (casi todos tienen esa opción en Productos o Inventario).', 'Súbelo aquí. Tú revisas qué columna es cuál y qué se va a crear antes de guardar nada.', 'Tus productos actuales no se borran.'].forEach(function(t){ pasos.appendChild(el('li', null, t)); });
    var zona = el('div', 'imp-zona'); zona.tabIndex = 0; zona.setAttribute('role', 'button');
    zona.append(el('b', null, 'Elige tu archivo o arrástralo aquí'), el('span', null, 'Excel (.xlsx, .xls), CSV, TXT u hoja de Google exportada · hasta ' + MAX_FILAS + ' productos'));
    var inp = el('input'); inp.type = 'file'; inp.accept = '.xlsx,.xls,.xlsm,.ods,.csv,.txt,.tsv'; inp.style.display = 'none';
    zona.onclick = function(){ inp.click(); }; zona.onkeydown = function(e){ if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); inp.click(); } };
    inp.onchange = function(){ if(inp.files[0]) leerArchivo(inp.files[0]); };
    ['dragover', 'dragenter'].forEach(function(ev){ zona.addEventListener(ev, function(e){ e.preventDefault(); zona.classList.add('sobre'); }); });
    ['dragleave', 'drop'].forEach(function(ev){ zona.addEventListener(ev, function(e){ e.preventDefault(); zona.classList.remove('sobre'); }); });
    zona.addEventListener('drop', function(e){ var f = e.dataTransfer && e.dataTransfer.files[0]; if(f) leerArchivo(f); });
    var pl = el('button', null, 'Descargar archivo de ejemplo'); pl.type = 'button'; pl.style.marginTop = '14px'; pl.onclick = bajarPlantilla;
    z.append(pasos, zona, inp, pl);
  }
  function bajarPlantilla(){
    var a = el('a'); a.href = URL.createObjectURL(new Blob([plantillaCSV()], { type: 'text/csv;charset=utf-8' })); a.download = 'productos-ejemplo.csv'; document.body.appendChild(a); a.click();
    setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  function cargarXLSX(){
    if(window.XLSX) return Promise.resolve(window.XLSX);
    return new Promise(function(ok, mal){ var s = document.createElement('script'); s.src = XLSX_URL; s.onload = function(){ window.XLSX ? ok(window.XLSX) : mal(new Error('x')); }; s.onerror = function(){ mal(new Error('x')); }; document.head.appendChild(s); });
  }
  function leerArchivo(file){
    aviso('');
    if(file.size > MAX_BYTES){ aviso('El archivo pesa más de 8 MB. Divídelo en partes más chicas.'); return; }
    var ext = (file.name.split('.').pop() || '').toLowerCase(), esHoja = ['xlsx', 'xls', 'xlsm', 'ods'].indexOf(ext) >= 0;
    var z = document.getElementById('zonaImportar'); z.textContent = ''; z.appendChild(el('p', null, 'Leyendo ' + file.name + '…'));
    var fr = new FileReader();
    fr.onerror = function(){ aviso('No se pudo leer el archivo.'); pantallaArchivo(); };
    fr.onload = function(){
      if(!esHoja){ try { listo(file.name, { 'Hoja': leerCSV(decodificar(fr.result)) }); } catch(e){ aviso('No se pudo entender el archivo.'); pantallaArchivo(); } return; }
      cargarXLSX().then(function(X){
        var libro = X.read(new Uint8Array(fr.result), { type: 'array', cellDates: true }), hojas = {};
        libro.SheetNames.forEach(function(n){ var f = limpiarFilas(X.utils.sheet_to_json(libro.Sheets[n], { header: 1, raw: true, defval: '' })); if(f.length) hojas[n] = f; });
        listo(file.name, hojas);
      }).catch(function(){ aviso('No se pudo abrir el Excel (necesita conexión para cargar el lector). Prueba guardándolo como CSV desde Excel y súbelo otra vez.'); pantallaArchivo(); });
    };
    fr.readAsArrayBuffer(file);
  }
  function listo(nombre, hojas){
    var nombres = Object.keys(hojas);
    if(!nombres.length || hojas[nombres[0]].length < 2){ aviso('El archivo está vacío o solo trae los títulos.'); pantallaArchivo(); return; }
    estado = { trabajando: false, archivo: nombre, hojas: hojas, hoja: nombres[0], opc: { repetidos: 'omitir' } };
    cambiarHoja(nombres[0]);
  }
  function cambiarHoja(h){
    var filas = estado.hojas[h]; estado.hoja = h; estado.enc = filas[0].map(function(v, i){ return aTexto(v) || 'Columna ' + (i + 1); });
    estado.filas = filas.slice(1); estado.mapa = adivinarColumnas(estado.enc); estado.cortado = estado.filas.length > MAX_FILAS;
    if(estado.cortado) estado.filas = estado.filas.slice(0, MAX_FILAS);
    pantallaRevision();
  }

  function pantallaRevision(){
    var z = document.getElementById('zonaImportar'); z.textContent = '';
    var cat = {}, existentes = indexarExistentes(typeof productosCache !== 'undefined' ? productosCache : []);
    z.appendChild(el('p', null, estado.archivo + ' · ' + estado.filas.length + ' filas' + (estado.cortado ? ' (solo se toman las primeras ' + MAX_FILAS + ')' : '')));
    var nombres = Object.keys(estado.hojas);
    if(nombres.length > 1){
      var sh = el('select'); nombres.forEach(function(n){ var o = el('option', null, n); o.value = n; sh.appendChild(o); }); sh.value = estado.hoja; sh.onchange = function(){ cambiarHoja(sh.value); };
      var lh = el('label', null, 'Hoja del Excel'); lh.style.display = 'block'; sh.style.cssText = 'width:100%;padding:9px 11px;margin:6px 0 4px;border:1px solid var(--borde);border-radius:10px;background:var(--superficie);color:var(--texto);font:inherit'; z.append(lh, sh);
    }
    z.appendChild(el('h3', null, '1. ¿Qué columna es cada dato?'));
    var mapa = el('div', 'imp-map');
    CAMPOS.forEach(function(c){
      var l = el('label', null, c.etq + (c.req ? ' *' : '')), s = el('select'), o0 = el('option', null, c.req ? 'Elige una columna' : 'No la tengo'); o0.value = ''; s.appendChild(o0);
      estado.enc.forEach(function(h, i){ var o = el('option', null, h); o.value = String(i); s.appendChild(o); });
      s.value = estado.mapa[c.id] == null ? '' : String(estado.mapa[c.id]);
      s.onchange = function(){ if(s.value === '') delete estado.mapa[c.id]; else estado.mapa[c.id] = +s.value; recalcular(); };
      mapa.append(l, s);
    });
    z.appendChild(mapa);
    z.appendChild(el('h3', null, '2. Si un producto ya lo tienes'));
    var op = el('div', 'imp-opc');
    [['omitir', 'Dejarlo como está', 'Solo se agregan los que no tienes. Se compara por código de barras, o por nombre si no trae código.'], ['actualizar', 'Actualizar sus datos', 'Se cambian precio, costo y existencias con lo que trae el archivo.']].forEach(function(d){
      var lab = el('label'), r = el('input'); r.type = 'radio'; r.name = 'impRep'; r.value = d[0]; r.checked = estado.opc.repetidos === d[0];
      r.onchange = function(){ estado.opc.repetidos = d[0]; recalcular(); };
      var tx = el('div'); tx.append(el('span', null, d[1]), el('small', null, d[2])); lab.append(r, tx); op.appendChild(lab);
    });
    z.appendChild(op);
    var rv = el('div'); rv.id = 'revisionImportar'; z.appendChild(rv);
    var ac = el('div', 'imp-acciones'), bi = el('button', 'principal', 'Importar'); bi.id = 'btnConfirmarImportar'; bi.type = 'button'; bi.onclick = confirmar;
    var bc = el('button', null, 'Cambiar de archivo'); bc.type = 'button'; bc.onclick = pantallaArchivo; ac.append(bi, bc); z.appendChild(ac);
    recalcular();
  }
  function recalcular(){
    var rv = document.getElementById('revisionImportar'), bi = document.getElementById('btnConfirmarImportar'); rv.textContent = '';
    var faltan = CAMPOS.filter(function(c){ return c.req && estado.mapa[c.id] == null; });
    if(faltan.length){ estado.res = null; bi.disabled = true; bi.textContent = 'Importar'; rv.appendChild(el('p', 'nota', 'Elige la columna de: ' + faltan.map(function(c){ return c.etq.toLowerCase(); }).join(' y ') + '.')); return; }
    var r = revisar(estado.filas, estado.mapa, estado.opc, indexarExistentes(typeof productosCache !== 'undefined' ? productosCache : [])); estado.res = r;
    rv.appendChild(el('h3', null, '3. Esto es lo que va a pasar'));
    var res = el('div', 'imp-resumen');
    [[r.nuevos.length, 'productos nuevos'], [r.actualizar.length, 'por actualizar'], [r.omitidos.length, 'se dejan igual'], [r.errores.length, 'con problema']].forEach(function(d){ var c = el('div'); c.append(el('b', null, String(d[0])), el('span', null, d[1])); res.appendChild(c); });
    rv.appendChild(res);
    var cats = {}; r.nuevos.concat(r.actualizar).forEach(function(p){ if(p.categoria) cats[clave(p.categoria)] = 1; });
    var nCats = Object.keys(cats).filter(function(k){ return !(typeof categoriasCache !== 'undefined' ? categoriasCache : []).some(function(c){ return clave(c.nombre) === k; }); }).length;
    if(nCats) rv.appendChild(el('p', 'nota', 'Se van a crear ' + nCats + ' categorías nuevas.'));
    if(r.avisos) rv.appendChild(el('p', 'nota', r.avisos + ' valores negativos de costo o existencias se dejaron en 0.'));
    if(r.errores.length){
      rv.appendChild(el('p', 'nota', 'Estas filas no se van a importar:'));
      var ul = el('ul', 'imp-lista'); r.errores.slice(0, 8).forEach(function(e){ ul.appendChild(el('li', null, 'Fila ' + e.linea + (e.nombre ? ' (' + e.nombre + ')' : '') + ': ' + e.motivo)); });
      if(r.errores.length > 8) ul.appendChild(el('li', null, 'y ' + (r.errores.length - 8) + ' más.'));
      rv.appendChild(ul);
    }
    var muestra = r.nuevos.concat(r.actualizar).slice(0, 6);
    if(muestra.length){
      rv.appendChild(el('h3', null, 'Así se verán los primeros'));
      var cols = [['nombre', 'Nombre'], ['precio', 'Precio'], ['costo', 'Costo'], ['stock', 'Existencias'], ['sku', 'Código'], ['categoria', 'Categoría']].filter(function(c){ return muestra.some(function(p){ return p[c[0]] != null && p[c[0]] !== ''; }); });
      var wrap = el('div', 'imp-tabla'), tb = el('table'), th = el('tr'); cols.forEach(function(c){ th.appendChild(el('th', null, c[1])); }); tb.appendChild(th);
      muestra.forEach(function(p){ var tr = el('tr'); cols.forEach(function(c){ var v = p[c[0]]; tr.appendChild(el('td', null, v == null ? '' : (c[0] === 'precio' || c[0] === 'costo') ? '$' + Number(v).toFixed(2) : String(v))); }); tb.appendChild(tr); });
      wrap.appendChild(tb); rv.appendChild(wrap);
    }
    var total = r.nuevos.length + r.actualizar.length; bi.disabled = !total;
    bi.textContent = total ? 'Importar ' + total + ' producto' + (total === 1 ? '' : 's') : 'No hay nada que importar';
  }

  // ---------- guardado ----------
  function textoErr(e){ return typeof textoErrorProducto === 'function' ? textoErrorProducto(e) : String((e && e.message) || e); }
  async function confirmar(){
    if(!estado || estado.trabajando || !estado.res) return;
    if(typeof enLinea !== 'undefined' && !enLinea){ aviso('Necesitas conexión para importar productos.'); return; }
    if(typeof puedoEditarProductos === 'function' && !puedoEditarProductos()){ avisoSoloEncargado(); return; }
    var r = estado.res, lista = r.nuevos.concat(r.actualizar), hechos = 0, fallos = [], bi = document.getElementById('btnConfirmarImportar');
    estado.trabajando = true; bi.disabled = true; aviso('');
    var z = document.getElementById('zonaImportar'), barra = el('div', 'imp-barra'), prog = el('i'), txt = el('p', 'nota', 'Preparando categorías…'); barra.appendChild(prog); z.append(txt, barra);
    function avanzar(){ prog.style.width = Math.round(hechos / lista.length * 100) + '%'; txt.textContent = 'Guardando… ' + hechos + ' de ' + lista.length; }
    try {
      // categorías: se reusan las que ya existen (sin importar mayúsculas ni acentos) y se crean las que faltan
      var porClave = new Map((typeof categoriasCache !== 'undefined' ? categoriasCache : []).map(function(c){ return [clave(c.nombre), c.id]; })), faltantes = new Map();
      lista.forEach(function(p){ if(p.categoria){ var k = clave(p.categoria); if(k && !porClave.has(k) && !faltantes.has(k)) faltantes.set(k, p.categoria); } });
      if(faltantes.size){
        var nuevas = Array.from(faltantes.values()).slice(0, 80).map(function(n){ return { negocio_id: negocioId, nombre: n }; });
        var rc = await sb.from('categorias').insert(nuevas).select('id, nombre');
        if(rc.error) throw new Error('No se pudieron crear las categorías: ' + rc.error.message);
        (rc.data || []).forEach(function(c){ porClave.set(clave(c.nombre), c.id); });
      }
      function registro(p, nuevo){
        var o = { precio: p.precio };
        if(nuevo){ o.negocio_id = negocioId; o.nombre = p.nombre; o.sku = p.sku; o.costo = p.costo != null ? p.costo : 0; o.stock = p.stock != null ? p.stock : 0; }
        else { if(p.costo != null) o.costo = p.costo; if(p.stock != null) o.stock = p.stock; if(p.sku) o.sku = p.sku; }
        if(p.fecha_caducidad) o.fecha_caducidad = p.fecha_caducidad;
        var k = p.categoria && clave(p.categoria); if(k && porClave.has(k)) o.categoria_id = porClave.get(k);
        return o;
      }
      avanzar();
      for(var i = 0; i < r.nuevos.length; i += LOTE){
        var trozo = r.nuevos.slice(i, i + LOTE), rows = trozo.map(function(p){ return registro(p, true); }), ri = await sb.from('productos').insert(rows);
        if(!ri.error) hechos += trozo.length;
        else for(var j = 0; j < trozo.length; j++){ var r1 = await sb.from('productos').insert(rows[j]); if(r1.error) fallos.push('Fila ' + trozo[j].linea + ' (' + trozo[j].nombre + '): ' + textoErr(r1.error)); else hechos++; }
        avanzar();
      }
      for(var k2 = 0; k2 < r.actualizar.length; k2 += 10){
        var grupo = r.actualizar.slice(k2, k2 + 10);
        var rs = await Promise.all(grupo.map(function(p){ return sb.from('productos').update(registro(p, false)).eq('id', p.id); }));
        rs.forEach(function(x, n){ if(x.error) fallos.push('Fila ' + grupo[n].linea + ' (' + grupo[n].nombre + '): ' + textoErr(x.error)); else hechos++; });
        avanzar();
      }
    } catch(e){ fallos.push(String((e && e.message) || e)); }
    estado.trabajando = false;
    if(typeof cargarProductos === 'function') { try { await cargarProductos(); } catch(e){} }
    terminar(hechos, fallos, r);
  }
  function terminar(hechos, fallos, r){
    var z = document.getElementById('zonaImportar'); z.textContent = '';
    z.appendChild(el('h3', null, hechos ? 'Listo, se importaron ' + hechos + ' producto' + (hechos === 1 ? '' : 's') : 'No se importó nada'));
    z.appendChild(el('p', null, r.nuevos.length + ' nuevos · ' + r.actualizar.length + ' actualizados' + (fallos.length ? ' · ' + fallos.length + ' con problema al guardar' : '') + '.'));
    if(fallos.length){ var ul = el('ul', 'imp-lista'); fallos.slice(0, 10).forEach(function(f){ ul.appendChild(el('li', null, f)); }); if(fallos.length > 10) ul.appendChild(el('li', null, 'y ' + (fallos.length - 10) + ' más.')); z.appendChild(ul); }
    var ac = el('div', 'imp-acciones'), b1 = el('button', 'principal', 'Ver mis productos'); b1.type = 'button'; b1.onclick = cerrar;
    var b2 = el('button', null, 'Importar otro archivo'); b2.type = 'button'; b2.onclick = pantallaArchivo; ac.append(b1, b2); z.appendChild(ac);
  }

  window.PuveImportar = { abrir: abrir, _: { leerCSV: leerCSV, numero: numero, fecha: fecha, adivinarColumnas: adivinarColumnas, revisar: revisar, indexarExistentes: indexarExistentes, clave: clave, plantillaCSV: plantillaCSV } };
})();
