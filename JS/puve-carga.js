/* PUVE - Esqueletos de carga y avisos de estado (conexión, servidor, tiempo agotado…).
 * Se usa en todas las páginas para que nunca quede una pantalla en blanco: mientras carga se ve un esqueleto con frases que
 * mantienen al tanto a la persona, y si algo falla se explica QUÉ pasó y CÓMO resolverlo, con botón para reintentar.
 * No depende de nada. Cada página conserva su estética con estas variables (todas opcionales, con respaldo neutro):
 *   --pc-fondo  --pc-borde  --pc-texto  --pc-suave  --pc-acento  --pc-sobre-acento
 * Atributos del <script>: data-banner="no" desactiva el aviso fijo de "Sin conexión" (para páginas que ya tienen el suyo).
 */
(function(){
  'use strict';
  if(window.PuveCarga) return;

  var CSS = [
    '.pc-sk{display:block;border-radius:12px;background:linear-gradient(90deg,rgba(127,127,127,.14) 25%,rgba(127,127,127,.27) 40%,rgba(127,127,127,.14) 60%);background-size:300% 100%;animation:pc-brillo 1.5s ease-in-out infinite}',
    '.pc-sk.pc-c{border-radius:50%}.pc-sk.pc-t{border-radius:8px;height:12px}',
    '@keyframes pc-brillo{0%{background-position:100% 0}100%{background-position:0 0}}',
    '@media (prefers-reduced-motion:reduce){.pc-sk{animation:none}.pc-giro{animation:none!important}}',
    '.pc-esq{display:flex;flex-direction:column;gap:12px}.pc-fila{display:flex;gap:12px;align-items:center}.pc-rejilla{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}',
    '.pc-tarjeta{padding:10px;border-radius:22px;border:1px solid var(--pc-borde,rgba(127,127,127,.25));display:flex;flex-direction:column;gap:8px}',
    '.pc-frase{text-align:center;font-size:14px;line-height:1.4;color:var(--pc-suave,inherit);opacity:.85;margin:14px auto 0;max-width:420px;min-height:2.8em}',
    '.pc-error{max-width:480px;margin:6vh auto;padding:24px 22px;border-radius:22px;border:1px solid var(--pc-borde,rgba(127,127,127,.3));background:var(--pc-fondo,transparent);color:var(--pc-texto,inherit);text-align:left;font-size:15px;line-height:1.45}',
    '.pc-error .pc-ico{width:44px;height:44px;border-radius:50%;display:grid;place-items:center;border:1px solid var(--pc-borde,rgba(127,127,127,.35));margin-bottom:12px}',
    '.pc-error h2{margin:0 0 6px;font-size:20px;line-height:1.2;font-weight:700}.pc-error p{margin:0 0 10px;color:var(--pc-suave,inherit)}',
    '.pc-error ul{margin:0 0 14px;padding-left:20px}.pc-error li{margin:0 0 5px}',
    '.pc-btns{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px}',
    '.pc-btns button{font:inherit;font-size:14px;font-weight:600;padding:11px 18px;border-radius:99px;cursor:pointer;border:1px solid var(--pc-borde,rgba(127,127,127,.4));background:transparent;color:inherit}',
    '.pc-btns button.pc-p{background:var(--pc-acento,#141414);color:var(--pc-sobre-acento,#fff);border-color:transparent}',
    '.pc-det{margin-top:12px;font-size:12px;color:var(--pc-suave,inherit)}.pc-det summary{cursor:pointer}.pc-det code{display:block;margin-top:6px;word-break:break-word;white-space:pre-wrap}',
    '.pc-banner{position:fixed;left:12px;right:12px;top:calc(10px + env(safe-area-inset-top));z-index:2147483000;margin:0 auto;max-width:560px;padding:11px 16px;border-radius:14px;font:600 14px/1.35 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;text-align:center;background:#7c2d12;color:#fff;box-shadow:0 8px 24px rgba(0,0,0,.25)}',
    '.pc-banner.pc-ok{background:#166534}',
    '.pc-giro{animation:pc-g 1s linear infinite}@keyframes pc-g{to{transform:rotate(360deg)}}'
  ].join('');
  function estilos(){
    if(document.getElementById('pc-css')) return;
    var s = document.createElement('style'); s.id = 'pc-css'; s.textContent = CSS; (document.head || document.documentElement).appendChild(s);
  }
  function mk(tag, cls, txt){ var e = document.createElement(tag); if(cls) e.className = cls; if(txt != null) e.textContent = txt; return e; }
  function sk(w, h, extra){ var e = mk('span', 'pc-sk' + (extra ? ' ' + extra : '')); if(w) e.style.width = w; if(h) e.style.height = h; return e; }

  // ---------- Diagnóstico: qué pasó y cómo resolverlo ----------
  // err: Error o texto; status: código HTTP (0 = no hubo respuesta). Devuelve { tipo, titulo, texto, pasos, reintentar, detalle }.
  function diagnosticar(err, status, opciones){
    opciones = opciones || {};
    var msg = String((err && err.message) || err || ''), st = Number(status) || 0, sinRed = typeof navigator !== 'undefined' && navigator.onLine === false, d;
    var detalle = [st ? 'Código: ' + st : 'Sin respuesta del servidor', msg ? 'Detalle: ' + msg.slice(0, 200) : '', 'Hora: ' + new Date().toLocaleTimeString('es-MX')].filter(Boolean).join('\n');
    if(opciones.script) d = { tipo: 'script', icono: '⚠', titulo: 'No se pudo cargar una parte de la página', texto: 'Un archivo necesario no se descargó, así que la página no puede funcionar completa.', pasos: ['Recarga la página.', 'Desactiva por un momento el bloqueador de anuncios o la VPN y vuelve a intentar.', 'Si estás en una red de empresa o escuela, pide que permitan cdn.jsdelivr.net y supabase.co.', 'Prueba con otra red, por ejemplo tus datos móviles.'], reintentar: true };
    else if(sinRed) d = { tipo: 'sin_conexion', icono: '⌁', titulo: 'Sin conexión a internet', texto: 'Tu dispositivo no tiene internet en este momento.', pasos: ['Revisa que el Wi‑Fi o los datos móviles estén encendidos.', 'Acércate al módem o cambia de red.', 'En cuanto regrese la conexión, esto se actualiza solo.'], reintentar: true };
    else if(st === 401 || st === 403) d = { tipo: 'sesion', icono: '🔒', titulo: 'Tu sesión ya no es válida', texto: 'Por seguridad la sesión venció o no tienes permiso para ver esto.', pasos: ['Vuelve a iniciar sesión.', 'Si ya lo hiciste, pide al encargado que revise tus permisos.'], reintentar: false };
    else if(st === 404) d = { tipo: 'no_encontrado', icono: '?', titulo: opciones.tituloNoEncontrado || 'No encontramos lo que buscas', texto: opciones.textoNoEncontrado || 'El enlace puede estar incompleto, vencido o desactivado.', pasos: ['Pide al negocio que te comparta el enlace o el QR de nuevo.', 'Si lo escribiste a mano, revisa que esté completo.'], reintentar: false };
    else if(st === 429) d = { tipo: 'saturado', icono: '⏳', titulo: 'Hay muchas consultas ahora', texto: 'El servicio recibió demasiadas peticiones seguidas y te pide una pausa corta.', pasos: ['Espera unos 30 segundos y reintenta.', 'Evita tocar el botón varias veces seguidas.'], reintentar: true };
    else if(st === 503 || st === 521 || st === 522 || st === 523 || st === 524) d = { tipo: 'servidor', icono: '⚙', titulo: 'El servicio está saturado o en mantenimiento', texto: 'No es tu internet: el servidor no pudo atender la petición (código ' + st + ').', pasos: ['Espera uno o dos minutos y reintenta.', 'Si atiendes clientes, anota los pedidos en papel y captúralos al regresar.', 'Si sigue igual después de 10 minutos, avisa a soporte de PUVE.'], reintentar: true };
    else if(st >= 500) d = { tipo: 'servidor', icono: '⚙', titulo: 'Problema en nuestro servidor', texto: 'El servicio respondió con un error (código ' + st + '). No es tu culpa ni de tu internet.', pasos: ['Espera uno o dos minutos y reintenta.', 'Si atiendes clientes, anota los pedidos en papel y captúralos al regresar.', 'Si persiste más de 10 minutos, avisa a soporte de PUVE.'], reintentar: true };
    else if(opciones.tiempo || /abort|timeout|timed out|tiempo/i.test(msg)) d = { tipo: 'tiempo', icono: '⏳', titulo: 'Está tardando demasiado', texto: 'La conexión es muy lenta y la respuesta no llegó a tiempo.', pasos: ['Reintenta en unos segundos.', 'Acércate al módem o cambia de red (Wi‑Fi o datos móviles).', 'Si sigue igual, el servicio puede estar saturado: espera un minuto.'], reintentar: true };
    else if(st === 0 || /failed to fetch|networkerror|load failed|network request/i.test(msg)) d = { tipo: 'red', icono: '⌁', titulo: 'No pudimos conectar con el servidor', texto: 'Tu internet parece funcionar, pero algo impidió llegar a PUVE.', pasos: ['Desactiva por un momento la VPN o el bloqueador de anuncios y reintenta.', 'Si estás en una red de empresa o escuela, pide que permitan supabase.co.', 'Prueba con otra red, por ejemplo tus datos móviles.'], reintentar: true };
    else d = { tipo: 'desconocido', icono: '!', titulo: 'Algo salió mal', texto: 'No pudimos cargar esto y no sabemos exactamente por qué.', pasos: ['Recarga la página.', 'Si sigue pasando, avisa a soporte de PUVE con los detalles técnicos de abajo.'], reintentar: true };
    d.detalle = detalle; return d;
  }

  // ---------- Esqueletos ----------
  function esqueleto(tipo, n){
    estilos(); var r = mk('div', 'pc-esq'); r.setAttribute('aria-hidden', 'true'); n = n || 4;
    if(tipo === 'menu'){
      var cab = mk('div', 'pc-fila'); cab.appendChild(sk('48px', '48px', 'pc-c')); var tt = mk('div'); tt.style.flex = '1'; tt.appendChild(sk('40%', '10px', 'pc-t')); tt.appendChild(mk('div')).style.height = '8px'; tt.appendChild(sk('70%', '20px')); cab.appendChild(tt); r.appendChild(cab);
      r.appendChild(sk('100%', '52px')); r.lastChild.style.borderRadius = '99px';
      var cs = mk('div', 'pc-fila'); cs.style.gap = '14px'; cs.style.overflow = 'hidden'; for(var i = 0; i < 5; i++){ var c = mk('div'); c.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:8px;flex:none'; c.appendChild(sk('64px', '64px', 'pc-c')); c.appendChild(sk('44px', '10px', 'pc-t')); cs.appendChild(c); } r.appendChild(cs);
      var g = mk('div', 'pc-rejilla'); for(var j = 0; j < n; j++){ var t = mk('div', 'pc-tarjeta'); t.appendChild(sk('100%', '0')); t.lastChild.style.aspectRatio = '1'; t.lastChild.style.borderRadius = '18px'; t.appendChild(sk('70%', '14px')); var f = mk('div', 'pc-fila'); f.style.justifyContent = 'space-between'; f.appendChild(sk('38%', '16px')); f.appendChild(sk('40px', '40px', 'pc-c')); t.appendChild(f); g.appendChild(t); } r.appendChild(g);
    } else if(tipo === 'seguimiento'){
      r.style.alignItems = 'center'; r.appendChild(sk('50%', '24px')); r.appendChild(sk('250px', '250px', 'pc-c')); r.lastChild.style.maxWidth = '68vw'; r.lastChild.style.maxHeight = '68vw'; r.appendChild(sk('100%', '110px'));
    } else if(tipo === 'columnas'){
      for(var k = 0; k < 2; k++){ var tj = mk('div', 'pc-tarjeta'); tj.style.borderRadius = '10px'; tj.appendChild(sk('45%', '16px')); tj.appendChild(sk('90%', '12px', 'pc-t')); tj.appendChild(sk('70%', '12px', 'pc-t')); tj.appendChild(sk('100%', '34px')); r.appendChild(tj); }
    } else if(tipo === 'app'){
      var barra = mk('div', 'pc-fila'); barra.appendChild(sk('44px', '44px', 'pc-c')); barra.appendChild(sk('90px', '24px')); r.appendChild(barra); r.appendChild(sk('55%', '30px'));
      var gg = mk('div', 'pc-rejilla'); for(var m = 0; m < 4; m++){ var tm = mk('div', 'pc-tarjeta'); tm.appendChild(sk('60%', '14px')); tm.appendChild(sk('100%', '70px')); gg.appendChild(tm); } r.appendChild(gg);
    } else {   // lista / tabla genérica
      for(var q = 0; q < n; q++){ var fl = mk('div', 'pc-fila'); fl.appendChild(sk('42px', '42px', 'pc-c')); var cl = mk('div'); cl.style.flex = '1'; cl.appendChild(sk('60%', '14px')); cl.appendChild(mk('div')).style.height = '7px'; cl.appendChild(sk('35%', '11px', 'pc-t')); fl.appendChild(cl); fl.appendChild(sk('56px', '20px')); r.appendChild(fl); }
    }
    return r;
  }
  function mostrarEsqueleto(cont, tipo, n){ cont.textContent = ''; var e = esqueleto(tipo, n); cont.appendChild(e); return e; }
  // Filas de esqueleto para un <tbody> (n filas, cols columnas)
  function filasTabla(tbody, cols, n){
    estilos(); tbody.textContent = '';
    for(var i = 0; i < (n || 5); i++){ var tr = document.createElement('tr'); tr.setAttribute('aria-hidden', 'true'); for(var c = 0; c < cols; c++){ var td = document.createElement('td'); td.appendChild(sk(c === 0 ? '80%' : '60%', '14px')); tr.appendChild(td); } tbody.appendChild(tr); }
  }

  // ---------- Tarjeta de error ----------
  // acciones: { reintentar: fn, recargar: true/false, textoReintentar }
  var errorActual = null;
  function error(cont, info, acciones){
    estilos(); acciones = acciones || {}; cont.textContent = '';
    var c = mk('div', 'pc-error'); c.setAttribute('role', 'alert');
    var ic = mk('div', 'pc-ico', info.icono || '!'); ic.setAttribute('aria-hidden', 'true'); c.appendChild(ic);
    c.appendChild(mk('h2', null, info.titulo)); c.appendChild(mk('p', null, info.texto));
    if(info.pasos && info.pasos.length){ c.appendChild(mk('p', null, 'Qué puedes hacer:')); var ul = mk('ul'); info.pasos.forEach(function(p){ ul.appendChild(mk('li', null, p)); }); c.appendChild(ul); }
    var b = mk('div', 'pc-btns');
    if(acciones.reintentar && info.reintentar !== false){ var r = mk('button', 'pc-p', acciones.textoReintentar || 'Reintentar'); r.type = 'button'; r.onclick = function(){ r.disabled = true; r.textContent = 'Reintentando…'; acciones.reintentar(); }; b.appendChild(r); }
    if(acciones.recargar !== false){ var rc = mk('button', acciones.reintentar ? '' : 'pc-p', 'Recargar la página'); rc.type = 'button'; rc.onclick = function(){ location.reload(); }; b.appendChild(rc); }
    c.appendChild(b);
    if(info.detalle){ var dt = mk('details', 'pc-det'); dt.appendChild(mk('summary', null, 'Detalles técnicos')); dt.appendChild(mk('code', null, info.detalle)); c.appendChild(dt); }
    cont.appendChild(c);
    errorActual = (acciones.reintentar && (info.tipo === 'sin_conexion' || info.tipo === 'red')) ? acciones.reintentar : null;   // al volver el internet se reintenta solo
    return c;
  }

  // ---------- Vigilar una carga: frases que mantienen al tanto y, si se agota el tiempo, el error ----------
  // Devuelve { listo(), fallo(err, status), frase(texto) }. cont debe contener el esqueleto (la frase se agrega debajo).
  function vigilar(cont, o){
    estilos(); o = o || {}; var f = mk('div', 'pc-frase'); f.setAttribute('role', 'status'); f.setAttribute('aria-live', 'polite'); f.textContent = o.inicio || 'Cargando…'; cont.appendChild(f);
    var ts = [], fin = false;
    var pasos = o.frases || [[5000, 'Esto está tardando más de lo normal. Seguimos intentando…'], [12000, 'Tu conexión parece lenta. Si puedes, cambia entre Wi‑Fi y datos móviles.']];
    pasos.forEach(function(p){ ts.push(setTimeout(function(){ if(!fin) f.textContent = p[1]; }, p[0])); });
    ts.push(setTimeout(function(){ if(!fin){ fin = true; var info = diagnosticar('timeout', 0, { tiempo: true }); error(cont, info, { reintentar: o.reintentar }); } }, o.limite || 25000));
    function limpiar(){ fin = true; ts.forEach(clearTimeout); }
    return {
      listo: function(){ limpiar(); if(f.parentNode) f.parentNode.removeChild(f); },
      fallo: function(err, status, extra){ limpiar(); error(cont, diagnosticar(err, status, extra), { reintentar: o.reintentar }); },
      frase: function(t){ if(!fin) f.textContent = t; }
    };
  }

  // ---------- Arranque de una app pesada: esqueleto a pantalla completa hasta que algo "listo" sea verdad ----------
  // o: { listoCuando: fn, reintentar: fn, requiere: ['supabase'], limite: ms }
  function arranque(el, o){
    estilos(); o = o || {}; var t0 = Date.now(), frase = el.querySelector('.pc-frase'), hecho = false;
    function terminar(){ hecho = true; clearInterval(iv); el.style.transition = 'opacity .25s'; el.style.opacity = '0'; setTimeout(function(){ if(el.parentNode) el.parentNode.removeChild(el); }, 280); }
    var iv = setInterval(function(){
      if(hecho) return; var dt = Date.now() - t0;
      try { if(o.listoCuando && o.listoCuando()) return terminar(); } catch(e){}
      if(dt > 4000 && frase) frase.textContent = 'Esto está tardando más de lo normal. Seguimos intentando…';
      if(dt > 12000 && frase) frase.textContent = 'Tu conexión parece lenta. Si puedes, cambia entre Wi‑Fi y datos móviles.';
      var faltan = (o.requiere || []).filter(function(n){ return !window[n]; });
      if(dt > 3500 && faltan.length){ clearInterval(iv); hecho = true; var cont = el.querySelector('.pc-cuerpo') || el; error(cont, diagnosticar('script', 0, { script: true }), { reintentar: function(){ location.reload(); } }); return; }
      if(dt > (o.limite || 30000)){ clearInterval(iv); hecho = true; var cont2 = el.querySelector('.pc-cuerpo') || el; error(cont2, diagnosticar('timeout', 0, { tiempo: true }), { reintentar: function(){ location.reload(); } }); }
    }, 150);
    return { terminar: terminar };
  }

  // ---------- Aviso fijo de conexión (se puede desactivar con data-banner="no") ----------
  var banner = null, tb = null;
  function mostrarBanner(txt, ok){
    estilos(); if(!banner){ banner = mk('div', 'pc-banner'); banner.setAttribute('role', 'status'); document.body.appendChild(banner); }
    banner.textContent = txt; banner.className = 'pc-banner' + (ok ? ' pc-ok' : ''); clearTimeout(tb);
    if(ok) tb = setTimeout(function(){ if(banner && banner.parentNode){ banner.parentNode.removeChild(banner); } banner = null; }, 2600);
  }
  var script = document.currentScript, conBanner = !(script && script.getAttribute('data-banner') === 'no');
  window.addEventListener('offline', function(){ if(conBanner && document.body) mostrarBanner('Sin conexión a internet. Algunas cosas no cargarán hasta que regrese.'); });
  window.addEventListener('online', function(){
    if(conBanner && document.body) mostrarBanner('Conexión restablecida', true);
    if(errorActual){ var f = errorActual; errorActual = null; try { f(); } catch(e){} }
  });
  if(conBanner){ var iniciar = function(){ if(navigator.onLine === false) mostrarBanner('Sin conexión a internet. Algunas cosas no cargarán hasta que regrese.'); }; if(document.body) iniciar(); else document.addEventListener('DOMContentLoaded', iniciar); }

  window.PuveCarga = { diagnosticar: diagnosticar, esqueleto: esqueleto, mostrarEsqueleto: mostrarEsqueleto, filasTabla: filasTabla, error: error, vigilar: vigilar, arranque: arranque, banner: mostrarBanner, estilos: estilos };
})();
