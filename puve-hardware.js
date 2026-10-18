/* PUVE - Impresora térmica (ESC/POS), báscula (Web Serial) y etiquetas de peso (EAN-13 de uso interno).
 * Código propio, sin librerías ni servicios de pago. Usa APIs web estándar:
 *   Web Bluetooth / WebUSB / Web Serial (Chrome, Edge, Android; NO existen en iPhone ni Firefox).
 * Donde la API no existe, la impresión cae a la impresión del navegador (window.print) con formato de ticket.
 * La impresión directa y la báscula NO dependen de internet: sirven también cuando se va la conexión.
 */
(function(){
  'use strict';

  // ---------- almacenamiento local de preferencias ----------
  const ls = {
    get(k, d){ try { const v = localStorage.getItem(k); return v === null ? d : v; } catch(e){ return d; } },
    set(k, v){ try { localStorage.setItem(k, String(v)); } catch(e){} }
  };
  const K = { ancho: 'puve_imp_cols', auto: 'puve_imp_auto', cajon: 'puve_imp_cajon', tipo: 'puve_imp_tipo', baudImp: 'puve_imp_baud', baudBas: 'puve_bas_baud', unidBas: 'puve_bas_unidad' };

  let enlace = { productos: () => [], aviso: () => {}, dinero: (n) => '$' + Number(n).toFixed(2), negocio: () => '' };

  // =====================================================================
  // 1) Constructor de comandos ESC/POS
  // =====================================================================
  const TABLA_437 = { 'á': 0xA0, 'é': 0x82, 'í': 0xA1, 'ó': 0xA2, 'ú': 0xA3, 'ñ': 0xA4, 'Ñ': 0xA5, '¿': 0xA8, '¡': 0xAD, 'ü': 0x81, 'É': 0x90, 'Ü': 0x9A };
  // Solo se usan caracteres idénticos en CP437 y CP858 (los más comunes en impresoras térmicas);
  // las mayúsculas acentuadas (Á Í Ó Ú) se imprimen sin acento para no depender de la tabla de la impresora.
  function bytesTexto(s){
    const out = [];
    for(const ch of String(s == null ? '' : s)){
      const c = ch.codePointAt(0);
      if(c >= 32 && c < 127){ out.push(c); continue; }
      if(TABLA_437[ch] != null){ out.push(TABLA_437[ch]); continue; }
      if(ch === '\n'){ out.push(10); continue; }
      const base = ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if(base.length === 1 && base.charCodeAt(0) < 127 && base.charCodeAt(0) >= 32) out.push(base.charCodeAt(0));
      else if(ch === '€') out.push(69);
      else out.push(63);
    }
    return out;
  }

  function Ticket(cols){
    this.cols = cols || 32;
    this.b = [0x1B, 0x40, 0x1B, 0x74, 0x00];   // inicializar + tabla CP437
  }
  Ticket.prototype = {
    raw(arr){ this.b.push.apply(this.b, arr); return this; },
    texto(s){ this.raw(bytesTexto(s)); return this; },
    linea(s){ this.texto(s); this.b.push(10); return this; },
    alinear(n){ return this.raw([0x1B, 0x61, n]); },      // 0 izq, 1 centro, 2 der
    negrita(on){ return this.raw([0x1B, 0x45, on ? 1 : 0]); },
    tam(ancho, alto){ return this.raw([0x1D, 0x21, ((ancho - 1) << 4) | (alto - 1)]); },   // 1 a 4
    avanzar(n){ return this.raw([0x1B, 0x64, n]); },
    separador(ch){ return this.linea(new Array(this.cols + 1).join(ch || '-')); },
    par(izq, der){
      izq = String(izq); der = String(der);
      const libre = this.cols - der.length - 1;
      if(izq.length > libre) izq = izq.slice(0, Math.max(0, libre));
      return this.linea(izq + new Array(this.cols - izq.length - der.length + 1).join(' ') + der);
    },
    envolver(s, sangria){
      const sg = new Array((sangria || 0) + 1).join(' '), ancho = this.cols - sg.length;
      const pal = String(s).split(/\s+/); let l = '';
      pal.forEach(p => {
        while(p.length > ancho){ if(l){ this.linea(sg + l); l = ''; } this.linea(sg + p.slice(0, ancho)); p = p.slice(ancho); }
        if((l + ' ' + p).trim().length > ancho){ this.linea(sg + l); l = p; } else l = (l + ' ' + p).trim();
      });
      if(l) this.linea(sg + l);
      return this;
    },
    qr(datos, tamano){
      const d = bytesTexto(datos), n = d.length + 3;
      this.raw([0x1D, 0x28, 0x6B, 4, 0, 0x31, 0x41, 0x32, 0]);                      // modelo 2
      this.raw([0x1D, 0x28, 0x6B, 3, 0, 0x31, 0x43, tamano || 6]);                    // tamaño del módulo
      this.raw([0x1D, 0x28, 0x6B, 3, 0, 0x31, 0x45, 0x31]);                           // corrección M
      this.raw([0x1D, 0x28, 0x6B, n & 255, n >> 8, 0x31, 0x50, 0x30].concat(d));      // guardar
      this.raw([0x1D, 0x28, 0x6B, 3, 0, 0x31, 0x51, 0x30]);                           // imprimir
      return this;
    },
    ean13(codigo){
      this.raw([0x1D, 0x68, 70, 0x1D, 0x77, 2, 0x1D, 0x48, 2, 0x1D, 0x66, 0]);       // alto, ancho, texto abajo
      this.raw([0x1D, 0x6B, 0x43, 13].concat(bytesTexto(codigo)));
      this.b.push(10);
      return this;
    },
    cortar(){ return this.avanzar(3).raw([0x1D, 0x56, 0x42, 0x00]); },
    cajon(){ return this.raw([0x1B, 0x70, 0x00, 0x3C, 0x78]); },
    bytes(){ return new Uint8Array(this.b); }
  };

  const fmtCant = (n) => { n = Number(n); return Number.isInteger(n) ? String(n) : String(Math.round(n * 1000) / 1000); };
  const fechaMX = (d) => new Date(d).toLocaleString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const ETQ_METODO = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia', mixto: 'Mixto', credito: 'Crédito (fiado)' };

  function armarTicket(d, cols){
    const t = new Ticket(cols);
    const nom = d.negocio || 'Ticket'; t.alinear(1).negrita(true).tam(nom.length * 2 > t.cols ? 1 : 2, 2).envolver(nom, 0).tam(1, 1).negrita(false);
    t.linea(fechaMX(d.fecha)).alinear(0).separador('-');
    d.items.forEach(i => {
      t.envolver(i.nombre, 0);
      const unidad = i.unidad && i.unidad !== 'pieza' ? ' ' + i.unidad : '';
      t.par('  ' + fmtCant(i.cantidad) + unidad + ' x ' + enlace.dinero(i.precio), enlace.dinero(i.subtotal));
    });
    t.separador('-');
    t.negrita(true).tam(1, 2).par('TOTAL', enlace.dinero(d.total)).tam(1, 1).negrita(false);
    if(d.vale > 0) t.par('Vale aplicado', '-' + enlace.dinero(d.vale));
    t.linea('Pago: ' + (ETQ_METODO[d.metodo] || d.metodo || 'Efectivo'));
    if(d.enlace){ t.alinear(1).avanzar(1).linea('Tu ticket digital:').qr(d.enlace, cols >= 40 ? 6 : 5).avanzar(1); }
    t.alinear(1).linea('¡Gracias por tu compra!').alinear(0).cortar();
    if(ls.get(K.cajon, '0') === '1' && d.metodo !== 'tarjeta' && d.metodo !== 'transferencia' && d.metodo !== 'credito') t.cajon();
    return t.bytes();
  }

  function armarComanda(d, cols){
    const t = new Ticket(cols);
    t.alinear(1).negrita(true).tam(2, 2).linea(d.titulo || 'COMANDA').tam(1, 1).negrita(false);
    if(d.mesa) t.tam(2, 2).linea(String(d.mesa)).tam(1, 1);
    t.linea(fechaMX(d.fecha || new Date())).alinear(0).separador('=');
    d.items.forEach(i => {
      t.negrita(true).tam(1, 2).envolver(fmtCant(i.cantidad) + ' x ' + i.nombre, 0).tam(1, 1).negrita(false);
      if(i.nota) t.envolver('-> ' + i.nota, 2);
    });
    if(d.nota){ t.separador('-').envolver('NOTA: ' + d.nota, 0); }
    t.separador('=').cortar();
    return t.bytes();
  }

  // =====================================================================
  // 2) Transportes: Bluetooth (BLE), USB, Serie y respaldo del navegador
  // =====================================================================
  const SERVICIOS_BT = [
    '000018f0-0000-1000-8000-00805f9b34fb', 'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
    '49535343-fe7d-4ae5-8fa9-9fafd205e455', '0000ff00-0000-1000-8000-00805f9b34fb',
    '0000fee7-0000-1000-8000-00805f9b34fb', '0000ffe0-0000-1000-8000-00805f9b34fb',
    '0000ae30-0000-1000-8000-00805f9b34fb', '00001101-0000-1000-8000-00805f9b34fb'
  ];
  const Imp = { tipo: null, nombre: '', dev: null, car: null, ep: null, puerto: null, escritor: null };
  const dormir = (ms) => new Promise(r => setTimeout(r, ms));
  const soporte = {
    bt: () => !!(navigator.bluetooth && navigator.bluetooth.requestDevice),
    usb: () => !!(navigator.usb && navigator.usb.requestDevice),
    serie: () => !!(navigator.serial && navigator.serial.requestPort)
  };

  async function buscarCaracteristicaBT(dev){
    const srv = await dev.gatt.connect();
    const servicios = await srv.getPrimaryServices();
    for(const s of servicios){
      const cs = await s.getCharacteristics();
      const c = cs.find(x => x.properties.writeWithoutResponse) || cs.find(x => x.properties.write);
      if(c) return c;
    }
    throw new Error('Esta impresora Bluetooth no expone un canal de escritura compatible.');
  }
  async function conectarBT(){
    if(!soporte.bt()) throw new Error('Este navegador no permite Bluetooth. Usa Chrome en computadora o Android.');
    const dev = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: SERVICIOS_BT });
    const car = await buscarCaracteristicaBT(dev);
    Object.assign(Imp, { tipo: 'bt', nombre: dev.name || 'Impresora Bluetooth', dev, car });
    ls.set(K.tipo, 'bt');
  }
  async function conectarUSB(){
    if(!soporte.usb()) throw new Error('Este navegador no permite USB. Usa Chrome o Edge en computadora o Android.');
    const dev = await navigator.usb.requestDevice({ filters: [] });
    await abrirUSB(dev);
    ls.set(K.tipo, 'usb');
  }
  async function abrirUSB(dev){
    await dev.open();
    if(dev.configuration === null) await dev.selectConfiguration(1);
    let elegido = null;
    for(const itf of dev.configuration.interfaces){
      for(const alt of itf.alternates){
        const salida = alt.endpoints.find(e => e.direction === 'out' && e.type === 'bulk');
        if(salida && (alt.interfaceClass === 7 || !elegido)) elegido = { itf, alt, salida };
      }
    }
    if(!elegido) throw new Error('No encontré un canal de impresión en este dispositivo USB.');
    await dev.claimInterface(elegido.itf.interfaceNumber);
    if(elegido.alt.alternateSetting) await dev.selectAlternateInterface(elegido.itf.interfaceNumber, elegido.alt.alternateSetting);
    Object.assign(Imp, { tipo: 'usb', nombre: dev.productName || 'Impresora USB', dev, ep: elegido.salida.endpointNumber });
  }
  async function conectarSerieImp(){
    if(!soporte.serie()) throw new Error('Este navegador no permite puerto serie. Usa Chrome o Edge en computadora.');
    const puerto = await navigator.serial.requestPort();
    await puerto.open({ baudRate: Number(ls.get(K.baudImp, '9600')) || 9600 });
    Object.assign(Imp, { tipo: 'serie', nombre: 'Impresora por puerto serie', puerto, escritor: puerto.writable.getWriter() });
    ls.set(K.tipo, 'serie');
  }
  // Al abrir PUVE, si el navegador ya tenía permiso de una impresora USB, se reconecta sola (sin ventanas).
  async function reconectarUSB(){
    try {
      if(!soporte.usb() || ls.get(K.tipo, '') !== 'usb') return;
      const lista = await navigator.usb.getDevices();
      if(lista.length) await abrirUSB(lista[0]);
    } catch(e){ /* sin impresora a la vista: se conecta manualmente */ }
  }

  function conectada(){
    if(Imp.tipo === 'bt') return !!(Imp.dev && Imp.dev.gatt && Imp.dev.gatt.connected) || !!Imp.car;
    return !!Imp.tipo;
  }
  async function escribirBT(datos){
    if(!Imp.dev.gatt.connected) Imp.car = await buscarCaracteristicaBT(Imp.dev);
    const usarSinRespuesta = !!Imp.car.properties.writeWithoutResponse;
    let tam = 100;
    for(let i = 0; i < datos.length;){
      const trozo = datos.slice(i, i + tam);
      try { if(usarSinRespuesta) await Imp.car.writeValueWithoutResponse(trozo); else await Imp.car.writeValue(trozo); i += tam; await dormir(15); }
      catch(e){ if(tam > 20){ tam = 20; continue; } throw e; }
    }
  }
  async function enviarCrudo(datos){
    if(!conectada()) throw new Error('No hay impresora conectada.');
    if(Imp.tipo === 'bt') return escribirBT(datos);
    if(Imp.tipo === 'usb'){ for(let i = 0; i < datos.length; i += 4096) await Imp.dev.transferOut(Imp.ep, datos.slice(i, i + 4096)); return; }
    if(Imp.tipo === 'serie'){ await Imp.escritor.write(datos); return; }
  }
  async function desconectarImpresora(){
    try { if(Imp.tipo === 'bt' && Imp.dev.gatt.connected) Imp.dev.gatt.disconnect(); } catch(e){}
    try { if(Imp.tipo === 'usb') await Imp.dev.close(); } catch(e){}
    try { if(Imp.tipo === 'serie'){ Imp.escritor.releaseLock(); await Imp.puerto.close(); } } catch(e){}
    Object.assign(Imp, { tipo: null, nombre: '', dev: null, car: null, ep: null, puerto: null, escritor: null });
    ls.set(K.tipo, '');
  }

  // ---------- Respaldo: impresión del navegador con formato de ticket (sirve en iPhone y en cualquier impresora con controlador) ----------
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function imprimirHTML(cuerpo, ancho){
    const mm = ancho >= 40 ? 72 : 52;
    const w = window.open('', '_blank', 'width=420,height=640');
    if(!w){ throw new Error('El navegador bloqueó la ventana de impresión. Permite las ventanas emergentes para este sitio.'); }
    w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>Ticket</title><style>'
      + '@page{size:' + mm + 'mm auto;margin:2mm}body{font:12px/1.35 "Courier New",monospace;width:' + mm + 'mm;margin:0;color:#000}'
      + '.c{text-align:center}.p{display:flex;justify-content:space-between;gap:6px}.g{font-size:16px;font-weight:700}hr{border:0;border-top:1px dashed #000;margin:5px 0}svg{max-width:100%}'
      + '</style></head><body>' + cuerpo + '</body></html>');
    w.document.close();
    setTimeout(() => { try { w.focus(); w.print(); } catch(e){} setTimeout(() => { try { w.close(); } catch(e){} }, 600); }, 300);
  }
  function ticketHTML(d, ancho){
    let h = '<div class="c g">' + esc(d.negocio || 'Ticket') + '</div><div class="c">' + esc(fechaMX(d.fecha)) + '</div><hr>';
    d.items.forEach(i => {
      const u = i.unidad && i.unidad !== 'pieza' ? ' ' + esc(i.unidad) : '';
      h += '<div>' + esc(i.nombre) + '</div><div class="p"><span>&nbsp;&nbsp;' + fmtCant(i.cantidad) + u + ' x ' + esc(enlace.dinero(i.precio)) + '</span><span>' + esc(enlace.dinero(i.subtotal)) + '</span></div>';
    });
    h += '<hr><div class="p g"><span>TOTAL</span><span>' + esc(enlace.dinero(d.total)) + '</span></div>';
    if(d.vale > 0) h += '<div class="p"><span>Vale aplicado</span><span>-' + esc(enlace.dinero(d.vale)) + '</span></div>';
    h += '<div>Pago: ' + esc(ETQ_METODO[d.metodo] || d.metodo || 'Efectivo') + '</div>';
    if(d.enlace) h += '<div class="c" style="margin-top:6px">Tu ticket digital:<br>' + esc(d.enlace) + '</div>';
    h += '<div class="c" style="margin-top:6px">¡Gracias por tu compra!</div>';
    return h;
  }

  // =====================================================================
  // 3) Ventas: guardar la última, imprimir (directo o por navegador)
  // =====================================================================
  let ultima = null;
  const anchoCols = () => Number(ls.get(K.ancho, '32')) === 48 ? 48 : 32;

  async function imprimirDatos(d, opciones){
    opciones = opciones || {};
    const cols = anchoCols();
    if(conectada()){ await enviarCrudo(armarTicket(d, cols)); return 'directa'; }
    if(opciones.soloDirecta) throw new Error('Impresora no conectada. Conéctala en “Impresora y báscula”.');
    imprimirHTML(ticketHTML(d, cols), cols); return 'navegador';
  }
  function registrarVenta(v){
    ultima = {
      negocio: enlace.negocio(), fecha: new Date(), items: v.items, total: v.total, metodo: v.metodo, vale: v.vale || 0,
      enlace: v.ventaId ? (location.origin + location.pathname + '#ticket=' + v.ventaId) : null
    };
    if(ls.get(K.auto, '0') === '1'){
      imprimirDatos(ultima, { soloDirecta: true }).catch(e => enlace.aviso('No se pudo imprimir el ticket: ' + (e.message || e)));
    }
  }
  async function imprimirUltima(){
    if(!ultima){ enlace.aviso('Todavía no hay una venta para imprimir.'); return; }
    try { await imprimirDatos(ultima); } catch(e){ enlace.aviso('No se pudo imprimir: ' + (e.message || e)); }
  }
  async function imprimirComanda(d){
    const cols = anchoCols();
    try {
      if(conectada()){ await enviarCrudo(armarComanda(d, cols)); return; }
      let h = '<div class="c g">' + esc(d.titulo || 'COMANDA') + '</div>' + (d.mesa ? '<div class="c g">' + esc(d.mesa) + '</div>' : '') + '<div class="c">' + esc(fechaMX(d.fecha || new Date())) + '</div><hr>';
      d.items.forEach(i => { h += '<div class="g">' + fmtCant(i.cantidad) + ' x ' + esc(i.nombre) + '</div>' + (i.nota ? '<div>&nbsp;&nbsp;-&gt; ' + esc(i.nota) + '</div>' : ''); });
      if(d.nota) h += '<hr><div>NOTA: ' + esc(d.nota) + '</div>';
      imprimirHTML(h, cols);
    } catch(e){ enlace.aviso('No se pudo imprimir la comanda: ' + (e.message || e)); }
  }

  // =====================================================================
  // 4) Etiquetas de peso EAN-13 de uso interno
  //    Formato PUVE: 2 T PPPPP VVVVV C
  //      2      = prefijo de uso interno (rango reservado de GS1, no choca con productos de fábrica)
  //      T      = 0 → VVVVV son gramos · 1 → VVVVV son centavos de importe
  //      PPPPP  = PLU del producto (1 a 5 dígitos, se captura como código de barras / SKU)
  //      C      = dígito verificador EAN-13
  // =====================================================================
  function digitoEAN13(doce){
    let s = 0;
    for(let i = 0; i < 12; i++) s += Number(doce[i]) * (i % 2 ? 3 : 1);
    return String((10 - (s % 10)) % 10);
  }
  function esEtiquetaPeso(c){ c = String(c || '').trim(); return /^2[01]\d{11}$/.test(c) && digitoEAN13(c.slice(0, 12)) === c[12]; }
  function decodificarEtiquetaPeso(c){
    c = String(c || '').trim();
    if(!esEtiquetaPeso(c)) return null;
    return { tipo: c[1] === '0' ? 'peso' : 'importe', plu: parseInt(c.slice(2, 7), 10), valor: parseInt(c.slice(7, 12), 10) };
  }
  function crearEtiquetaPeso(plu, tipo, valor){
    plu = Math.floor(Number(plu)); valor = Math.round(Number(valor));
    if(!(plu >= 0 && plu <= 99999)) throw new Error('El PLU debe tener de 1 a 5 dígitos.');
    if(!(valor > 0 && valor <= 99999)) throw new Error(tipo === 'peso' ? 'El peso debe estar entre 1 g y 99,999 g.' : 'El importe debe estar entre $0.01 y $999.99.');
    const doce = '2' + (tipo === 'peso' ? '0' : '1') + String(plu).padStart(5, '0') + String(valor).padStart(5, '0');
    return doce + digitoEAN13(doce);
  }
  // Convierte kilos a la unidad del producto. Devuelve null si el producto no se vende por peso.
  function kgAUnidad(kg, unidad){
    const u = String(unidad || '').trim().toLowerCase();
    if(['kg', 'kilo', 'kilos', 'kilogramo', 'kilogramos'].includes(u)) return Math.round(kg * 1000) / 1000;
    if(['g', 'gr', 'gramo', 'gramos'].includes(u)) return Math.round(kg * 1000);
    if(['lb', 'libra', 'libras'].includes(u)) return Math.round(kg / 0.45359237 * 1000) / 1000;
    return null;
  }
  function etiquetaEscPos(d, cols){
    const t = new Ticket(cols);
    t.alinear(1).negrita(true).tam(1, 2).envolver(d.nombre, 0).tam(1, 1).negrita(false);
    t.linea(d.detalle);
    t.negrita(true).tam(2, 2).linea(enlace.dinero(d.importe)).tam(1, 1).negrita(false);
    t.ean13(d.codigo).avanzar(1).cortar();
    return t.bytes();
  }
  async function imprimirEtiquetaPeso(d){
    const cols = anchoCols();
    if(conectada()){ await enviarCrudo(etiquetaEscPos(d, cols)); return; }
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    if(typeof window.JsBarcode === 'function') window.JsBarcode(svg, d.codigo, { format: 'EAN13', height: 46, fontSize: 12, margin: 0 });
    const h = '<div class="c g">' + esc(d.nombre) + '</div><div class="c">' + esc(d.detalle) + '</div><div class="c g" style="font-size:22px">' + esc(enlace.dinero(d.importe)) + '</div><div class="c">' + svg.outerHTML + '</div>';
    imprimirHTML(h, cols);
  }

  // =====================================================================
  // 5) Báscula por Web Serial
  // =====================================================================
  const Bas = { puerto: null, lector: null, kg: null, estable: false, hist: [], oyentes: new Set(), activa: false };
  function aKg(valor, unidad){
    const u = String(unidad || ls.get(K.unidBas, 'kg')).toLowerCase();
    if(u === 'g') return valor / 1000;
    if(u === 'lb') return valor * 0.45359237;
    if(u === 'oz') return valor * 0.0283495231;
    return valor;
  }
  // Entiende formatos habituales: "ST,GS,  1.250kg", "+001.250 kg", "  0.500", "W: 1.234 kg", "\x02 1.234 \x03"
  function interpretarLineaBascula(linea){
    const txt = String(linea || '').replace(/[^\x20-\x7E]/g, ' ').trim();
    if(!txt) return null;
    const re = /([-+]?\d+(?:[.,]\d+)?)\s*(kg|g|lb|oz)?/gi;
    let m, mejor = null;
    while((m = re.exec(txt))){
      const num = parseFloat(m[1].replace(',', '.'));
      if(isNaN(num)) continue;
      if(m[2]){ mejor = { num, unidad: m[2].toLowerCase() }; break; }
      if(!mejor) mejor = { num, unidad: null };
    }
    if(!mejor) return null;
    const inestable = /(^|[,\s])(US|UNSTABLE)([,\s]|$)|\?/i.test(txt);
    const marcaEstable = /(^|[,\s])ST([,\s]|$)/i.test(txt);
    return { kg: Math.max(0, aKg(mejor.num, mejor.unidad)), marca: inestable ? 'inestable' : (marcaEstable ? 'estable' : null) };
  }
  function procesarLineaBascula(linea){
    const r = interpretarLineaBascula(linea); if(!r) return;
    Bas.hist.push(r.kg); if(Bas.hist.length > 4) Bas.hist.shift();
    Bas.kg = r.kg;
    Bas.estable = r.marca ? r.marca === 'estable' : (Bas.hist.length >= 3 && Bas.hist.slice(-3).every(v => Math.abs(v - r.kg) < 0.0005));
    Bas.oyentes.forEach(f => { try { f(Bas); } catch(e){} });
  }
  async function conectarBascula(){
    if(!soporte.serie()) throw new Error('Este navegador no permite puerto serie. Usa Chrome o Edge en computadora.');
    const puerto = await navigator.serial.requestPort();
    await puerto.open({ baudRate: Number(ls.get(K.baudBas, '9600')) || 9600 });
    Bas.puerto = puerto; Bas.activa = true; Bas.kg = null; Bas.hist = [];
    leerBascula();
  }
  async function leerBascula(){
    const dec = new TextDecoderStream();
    const cierre = Bas.puerto.readable.pipeTo(dec.writable).catch(() => {});
    Bas.lector = dec.readable.getReader();
    let buf = '';
    try {
      while(Bas.activa){
        const { value, done } = await Bas.lector.read();
        if(done) break;
        buf += value;
        const partes = buf.split(/[\r\n\x02\x03]+/); buf = partes.pop();
        partes.forEach(procesarLineaBascula);
        if(buf.length > 200) buf = '';
      }
    } catch(e){ /* báscula desconectada */ }
    Bas.activa = false; Bas.kg = null; Bas.estable = false;
    Bas.oyentes.forEach(f => { try { f(Bas); } catch(e){} });
    try { await cierre; } catch(e){}
  }
  async function desconectarBascula(){
    Bas.activa = false;
    try { if(Bas.lector) await Bas.lector.cancel(); } catch(e){}
    try { if(Bas.puerto) await Bas.puerto.close(); } catch(e){}
    Bas.puerto = null; Bas.lector = null; Bas.kg = null; Bas.estable = false;
    Bas.oyentes.forEach(f => { try { f(Bas); } catch(e){} });
  }

  // =====================================================================
  // 6) Interfaz
  // =====================================================================
  function h(tag, cls, txt, estilo){
    const e = document.createElement(tag);
    if(cls) e.className = cls; if(txt != null) e.textContent = txt; if(estilo) e.style.cssText = estilo;
    return e;
  }
  function boton(txt, fn, cls, estilo){
    const b = h('button', cls || 'texto', txt, 'width:auto;' + (estilo || '')); b.type = 'button';
    b.onclick = async () => { b.disabled = true; try { await fn(); } catch(e){ if(e && e.name !== 'NotFoundError' && e.name !== 'AbortError') alert(e.message || e); } finally { b.disabled = false; } };
    return b;
  }
  function modal(titulo, ancho){
    const fondo = h('div', 'modal-puve-fondo'), caja = h('div', 'modal-puve'); caja.style.maxWidth = (ancho || 460) + 'px'; caja.style.maxHeight = '88vh'; caja.style.overflowY = 'auto';
    fondo.appendChild(caja); fondo.onclick = (ev) => { if(ev.target === fondo) cerrar(); };
    const cerrar = () => { Bas.oyentes.delete(refrescoPanel); fondo.remove(); };
    caja.appendChild(h('h2', '', titulo, 'margin:0 0 6px;'));
    document.body.appendChild(fondo);
    return { caja, fondo, cerrar };
  }
  let refrescoPanel = () => {};
  const seccion = (caja, t) => caja.appendChild(h('div', 'cr-etq', t, 'margin-top:16px;'));
  const fila = (caja) => { const f = h('div', '', null, 'display:flex; gap:8px; flex-wrap:wrap; align-items:center; margin:6px 0;'); caja.appendChild(f); return f; };
  function casilla(caja, txt, clave, porDefecto){
    const l = h('label', 'nota', null, 'display:flex; gap:8px; align-items:center; margin:6px 0; cursor:pointer;');
    const c = h('input'); c.type = 'checkbox'; c.checked = ls.get(clave, porDefecto) === '1'; c.onchange = () => ls.set(clave, c.checked ? '1' : '0');
    l.appendChild(c); l.appendChild(h('span', '', txt)); caja.appendChild(l);
  }
  function selector(caja, clave, opciones, porDefecto){
    const s = h('select', 'input-mini', null, 'width:auto;');
    opciones.forEach(([v, t]) => { const o = h('option', '', t); o.value = v; s.appendChild(o); });
    s.value = ls.get(clave, porDefecto); s.onchange = () => ls.set(clave, s.value);
    return s;
  }

  function abrirPanel(){
    const { caja, cerrar } = modal('Impresora y báscula', 480);
    caja.appendChild(h('p', 'nota', 'Imprime tickets y etiquetas directo en una impresora térmica y lee el peso de una báscula. No necesita internet. Si tu navegador no lo permite (iPhone, Firefox), se usa la impresión normal del navegador.', 'margin:0 0 4px;'));

    seccion(caja, 'Impresora de tickets');
    const estadoImp = h('div', 'nota', null, 'margin:2px 0 6px; font-weight:600;');
    caja.appendChild(estadoImp);
    const f1 = fila(caja);
    const pintarImp = () => { estadoImp.textContent = conectada() ? 'Conectada: ' + Imp.nombre : 'Sin impresora conectada (se usará la impresión del navegador).'; };
    const tras = async (fn) => { await fn(); pintarImp(); };
    if(soporte.bt()) f1.appendChild(boton('Bluetooth', () => tras(conectarBT), 'principal'));
    if(soporte.usb()) f1.appendChild(boton('USB', () => tras(conectarUSB), 'principal'));
    if(soporte.serie()) f1.appendChild(boton('Puerto serie', () => tras(conectarSerieImp)));
    f1.appendChild(boton('Desconectar', () => tras(desconectarImpresora)));
    if(!soporte.bt() && !soporte.usb() && !soporte.serie()) caja.appendChild(h('p', 'nota', 'Este navegador no permite conexión directa. Usa Chrome o Edge para imprimir sin diálogo.', 'color:var(--alerta);'));
    const f2 = fila(caja);
    f2.appendChild(h('span', 'nota', 'Ancho del papel'));
    f2.appendChild(selector(caja, K.ancho, [['32', '58 mm'], ['48', '80 mm']], '32'));
    f2.appendChild(boton('Imprimir prueba', async () => {
      const d = { negocio: enlace.negocio() || 'PUVE', fecha: new Date(), items: [{ nombre: 'Producto de prueba (acentos: áéíóú ñ)', cantidad: 2, unidad: '', precio: 12.5, subtotal: 25 }], total: 25, metodo: 'efectivo', enlace: null };
      await imprimirDatos(d);
    }));
    casilla(caja, 'Imprimir el ticket automáticamente al cobrar (solo con impresora conectada)', K.auto, '0');
    casilla(caja, 'Abrir el cajón de dinero al cobrar en efectivo (cajón conectado a la impresora)', K.cajon, '0');
    const f3 = fila(caja); f3.appendChild(boton('Reimprimir último ticket', imprimirUltima));
    pintarImp();

    seccion(caja, 'Báscula');
    const vivo = h('div', '', '—', 'font-size:26px; font-weight:700; margin:4px 0;');
    const estadoBas = h('div', 'nota', null, 'margin:0 0 6px;');
    caja.appendChild(vivo); caja.appendChild(estadoBas);
    const f4 = fila(caja);
    refrescoPanel = () => {
      vivo.textContent = Bas.kg == null ? '—' : Bas.kg.toFixed(3) + ' kg';
      estadoBas.textContent = !Bas.activa ? 'Báscula desconectada.' : (Bas.kg == null ? 'Esperando datos de la báscula…' : (Bas.estable ? 'Peso estable' : 'Peso moviéndose…'));
    };
    Bas.oyentes.add(refrescoPanel);
    if(soporte.serie()){
      f4.appendChild(boton('Conectar báscula', async () => { await conectarBascula(); refrescoPanel(); }, 'principal'));
      f4.appendChild(boton('Desconectar', desconectarBascula));
      const f5 = fila(caja);
      f5.appendChild(h('span', 'nota', 'Velocidad'));
      f5.appendChild(selector(caja, K.baudBas, [['1200', '1200'], ['2400', '2400'], ['4800', '4800'], ['9600', '9600'], ['19200', '19200'], ['115200', '115200']], '9600'));
      f5.appendChild(h('span', 'nota', 'Unidad que manda'));
      f5.appendChild(selector(caja, K.unidBas, [['kg', 'kg'], ['g', 'g'], ['lb', 'lb']], 'kg'));
    } else caja.appendChild(h('p', 'nota', 'La báscula por puerto serie solo funciona en Chrome o Edge (computadora). Mientras tanto puedes capturar el peso a mano.'));
    refrescoPanel();

    seccion(caja, 'Etiqueta de peso (para caja con escáner)');
    caja.appendChild(h('p', 'nota', 'Pesa un producto, imprime su etiqueta y en caja se escanea: el sistema suma el producto con su peso exacto. El producto necesita un PLU (de 1 a 5 dígitos) capturado como su código de barras.', 'margin:0 0 6px;'));
    const productos = enlace.productos().filter(p => /^\d{1,5}$/.test(String(p.sku || '').trim()) && kgAUnidad(1, p.unidad) != null);
    if(!productos.length){
      caja.appendChild(h('p', 'nota', 'Aún no hay productos por peso con PLU. Edita un producto, ponle unidad “kg” (o g/lb) y un código de 1 a 5 dígitos.', 'color:var(--alerta);'));
    } else {
      const sel = h('select', 'input-mini', null, 'width:100%; margin:4px 0;');
      productos.forEach((p, i) => { const o = h('option', '', p.nombre + ' · PLU ' + parseInt(p.sku, 10) + ' · ' + enlace.dinero(p.precio) + '/' + (p.unidad || 'kg')); o.value = i; sel.appendChild(o); });
      caja.appendChild(sel);
      const f6 = fila(caja);
      const inp = h('input', 'input-mini'); inp.type = 'number'; inp.min = '0'; inp.step = 'any'; inp.placeholder = 'Peso en kg'; inp.style.width = '130px';
      f6.appendChild(inp);
      f6.appendChild(boton('Tomar de la báscula', () => { if(Bas.kg > 0) inp.value = Bas.kg.toFixed(3); else alert('La báscula no está leyendo un peso.'); }));
      const info = h('div', 'nota', null, 'margin:4px 0;'); caja.appendChild(info);
      const calcular = () => {
        const p = productos[Number(sel.value)], kg = parseFloat(inp.value);
        if(!(kg > 0)) return null;
        const cant = kgAUnidad(kg, p.unidad), importe = Math.round(cant * Number(p.precio) * 100) / 100;
        return { p, kg, cant, importe };
      };
      inp.oninput = sel.onchange = () => { const c = calcular(); info.textContent = c ? fmtCant(c.cant) + ' ' + (c.p.unidad || 'kg') + ' = ' + enlace.dinero(c.importe) : ''; };
      const f7 = fila(caja);
      f7.appendChild(boton('Imprimir etiqueta', async () => {
        const c = calcular(); if(!c){ alert('Escribe o toma el peso primero.'); return; }
        const gramos = Math.round(c.kg * 1000);
        const codigo = crearEtiquetaPeso(parseInt(c.p.sku, 10), 'peso', gramos);
        await imprimirEtiquetaPeso({ nombre: c.p.nombre, detalle: fmtCant(c.cant) + ' ' + (c.p.unidad || 'kg') + ' x ' + enlace.dinero(c.p.precio), importe: c.importe, codigo });
      }, 'principal'));
    }
    const cierre = boton('Cerrar', async () => cerrar(), 'texto', 'width:100%; margin-top:16px;'); caja.appendChild(cierre);
  }

  // Bloque “pesar” dentro de la hoja de cantidad de un producto a granel.
  function montarBascula(contenedor, unidad, alElegir){
    if(kgAUnidad(1, unidad) == null || !soporte.serie()) return;
    const caja = h('div', 'nota', null, 'margin:10px 0; padding:10px; border:1px solid var(--borde); border-radius:8px;');
    const vivo = h('div', '', '—', 'font-size:20px; font-weight:700;');
    const estado = h('div', 'nota');
    const f = h('div', '', null, 'display:flex; gap:8px; flex-wrap:wrap; margin-top:6px;');
    const usar = boton('Usar este peso', async () => { const v = kgAUnidad(Bas.kg, unidad); if(v > 0) alElegir(v); }, 'principal');
    const conectar = boton('Conectar báscula', async () => { await conectarBascula(); }, 'texto');
    const pintar = () => {
      const lee = Bas.activa;
      conectar.style.display = lee ? 'none' : '';
      usar.style.display = lee ? '' : 'none';
      vivo.textContent = !lee ? 'Báscula desconectada' : (Bas.kg == null ? '—' : fmtCant(kgAUnidad(Bas.kg, unidad)) + ' ' + unidad);
      estado.textContent = lee ? (Bas.kg == null ? 'Esperando datos…' : (Bas.estable ? 'Peso estable' : 'Peso moviéndose…')) : '';
      usar.disabled = !(Bas.estable && Bas.kg > 0);
    };
    Bas.oyentes.add(pintar);
    const obs = new MutationObserver(() => { if(!document.body.contains(caja)){ Bas.oyentes.delete(pintar); obs.disconnect(); } });
    obs.observe(document.body, { childList: true, subtree: true });
    f.appendChild(usar); f.appendChild(conectar);
    caja.appendChild(vivo); caja.appendChild(estado); caja.appendChild(f);
    contenedor.appendChild(caja); pintar();
  }

  window.PuveHW = {
    enlazar(o){ enlace = Object.assign(enlace, o || {}); reconectarUSB(); },
    abrirPanel, registrarVenta, imprimirUltima, imprimirComanda, montarBascula,
    esEtiquetaPeso, decodificarEtiquetaPeso, crearEtiquetaPeso, kgAUnidad,
    impresoraConectada: conectada,
    _prueba: { bytesTexto, armarTicket, armarComanda, interpretarLineaBascula, digitoEAN13, Ticket, etiquetaEscPos }
  };
})();
