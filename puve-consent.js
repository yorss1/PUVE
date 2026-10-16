/* PUVE — Consentimiento de cookies, analítica con permiso y registro de aceptación legal.
   Reglas: (1) sin permiso NO hay identificador, NO hay eventos y NO se envía nada; (2) la decisión se puede cambiar cuando quiera
   (“Preferencias de cookies”); (3) si el navegador envía Global Privacy Control / No Rastrear, las analíticas quedan apagadas salvo
   que la persona las active ella misma; (4) la IP nunca la lee este script: la ve el servidor.
   Uso: <script src="puve-consent.js" data-pagina="landing|app" data-auto="landing" defer></script> */
(function(){
  'use strict';
  var SUPA = 'https://ckzueunptmlqmtypowmg.supabase.co', KEY = 'sb_publishable_jkE5ikAW_a0OfE2S-6u3VA_P8uEzUSp';
  var FN = SUPA + '/functions/v1/registrar-evento', VERSION_POLITICA = '1';
  var script = document.currentScript, PAGINA = (script && script.getAttribute('data-pagina')) || 'app', AUTO = script && script.getAttribute('data-auto');
  var BASE = (function(){ try { return new URL('.', script.src).href; } catch(e){ return location.origin + '/'; } })();
  var C_CONSENT = 'puve_consent', C_VID = 'puve_vid', LS_PEND = 'puve_acept_pend';

  // ---------- almacenamiento (cookie propia; localStorage de respaldo) ----------
  function getCookie(n){ var m = (document.cookie || '').match(new RegExp('(?:^|; )' + n + '=([^;]*)')); return m ? decodeURIComponent(m[1]) : null; }
  function setCookie(n, v, dias){ var s = n + '=' + encodeURIComponent(v) + '; Max-Age=' + Math.round(dias * 86400) + '; Path=/; SameSite=Lax' + (location.protocol === 'https:' ? '; Secure' : ''); document.cookie = s; }
  function delCookie(n){ document.cookie = n + '=; Max-Age=0; Path=/; SameSite=Lax'; try { localStorage.removeItem(n); } catch(e){} }
  function leer(n){ var v = getCookie(n); if(v) return v; try { return localStorage.getItem(n); } catch(e){ return null; } }
  function guardar(n, v, dias){ setCookie(n, v, dias); try { localStorage.setItem(n, v); } catch(e){} }
  function uuid(){ if(window.crypto && crypto.randomUUID) return crypto.randomUUID(); var b = new Uint8Array(16); crypto.getRandomValues(b); b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128; var h = Array.prototype.map.call(b, function(x){ return (x + 256).toString(16).slice(1); }).join(''); return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20); }
  function gpc(){ return navigator.globalPrivacyControl === true || navigator.doNotTrack === '1' || window.doNotTrack === '1'; }

  // ---------- estado de la decisión ----------
  var oyentes = [];
  function estado(){ var v = leer(C_CONSENT); if(v === VERSION_POLITICA + '.a') return 'aceptadas'; if(v === VERSION_POLITICA + '.n') return 'solo_necesarias'; return null; }
  function analiticaActiva(){ return estado() === 'aceptadas'; }
  function post(cuerpo, opts){
    opts = opts || {};
    var h = { 'Content-Type': 'application/json', 'apikey': KEY, 'Authorization': 'Bearer ' + (opts.token || KEY) };
    return fetch(FN, { method: 'POST', headers: h, body: JSON.stringify(cuerpo), keepalive: true }).then(function(r){ return { ok: r.ok, status: r.status }; }).catch(function(){ return { ok: false, status: 0 }; });
  }
  function decidir(decision){
    var acepta = decision === 'aceptadas', vid = null;
    if(acepta){ vid = leer(C_VID) || uuid(); guardar(C_VID, vid, 395); guardar(C_CONSENT, VERSION_POLITICA + '.a', 365); }
    else { delCookie(C_VID); try { sessionStorage.removeItem('puve_ses'); } catch(e){} guardar(C_CONSENT, VERSION_POLITICA + '.n', 365); cola.length = 0; }
    post({ accion: 'consentimiento', decision: decision, visitante: vid, version: VERSION_POLITICA, pagina: PAGINA, gpc: gpc() });   // se guarda la decisión (no la IP en claro)
    oyentes.forEach(function(f){ try { f(estado()); } catch(e){} });
    if(acepta) iniciarAnalitica();
  }

  // ---------- ventana de consentimiento ----------
  var cajaEl = null;
  function estilo(){
    if(document.getElementById('puve-consent-css')) return;
    var s = document.createElement('style'); s.id = 'puve-consent-css';
    s.textContent = '.pcs-fondo{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:2147483000;display:flex;align-items:flex-end;justify-content:center;padding:16px;font-family:Inter,system-ui,sans-serif}'
      + '@media(min-width:640px){.pcs-fondo{align-items:center}}'
      + '.pcs-caja{background:var(--superficie,#fff);color:var(--texto,#18181B);border:1px solid var(--borde,#E4E4E7);border-radius:20px;max-width:460px;width:100%;padding:22px 22px 18px;box-shadow:0 20px 60px rgba(0,0,0,.3)}'
      + '.pcs-caja h2{margin:0 0 8px;font-size:19px;letter-spacing:-.01em}.pcs-caja p{margin:0 0 10px;font-size:14px;line-height:1.5;color:var(--texto-suave,#52525B)}'
      + '.pcs-caja a{color:inherit;text-decoration:underline}.pcs-fila{display:flex;gap:10px;margin-top:14px;flex-wrap:wrap}'
      + '.pcs-fila button{flex:1;min-width:150px;padding:12px 14px;border-radius:12px;font:600 14px Inter,system-ui,sans-serif;cursor:pointer;border:1.5px solid var(--acento,#18181B)}'
      + '.pcs-a{background:var(--acento,#18181B);color:var(--texto-sobre-acento,#fff)}.pcs-b{background:transparent;color:var(--texto,#18181B)}'
      + '.pcs-fila button:focus-visible{outline:3px solid var(--foco,#2563EB);outline-offset:2px}';
    document.head.appendChild(s);
  }
  function mostrar(){
    if(cajaEl) return; estilo();
    var f = document.createElement('div'); f.className = 'pcs-fondo'; f.setAttribute('role', 'dialog'); f.setAttribute('aria-modal', 'true'); f.setAttribute('aria-labelledby', 'pcs-t');
    var c = document.createElement('div'); c.className = 'pcs-caja';
    var t = document.createElement('h2'); t.id = 'pcs-t'; t.textContent = 'Tu privacidad, tu decisión';
    var p1 = document.createElement('p'); p1.textContent = 'Usamos cookies necesarias para que PUVE funcione (por ejemplo, mantener tu sesión). Si nos das permiso, también usamos cookies de analítica propias para saber qué partes de la página se leen y dónde la gente se pierde, y así mejorar PUVE.';
    var p2 = document.createElement('p'); p2.appendChild(document.createTextNode('No vendemos datos ni usamos publicidad. Puedes cambiar tu decisión cuando quieras en “Preferencias de cookies”. '));
    var a = document.createElement('a'); a.href = BASE + 'docs_legales/politica-de-cookies.html'; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = 'Política de cookies'; p2.appendChild(a);
    var fila = document.createElement('div'); fila.className = 'pcs-fila';
    var b1 = document.createElement('button'); b1.type = 'button'; b1.className = 'pcs-b'; b1.textContent = 'Solo las necesarias';
    var b2 = document.createElement('button'); b2.type = 'button'; b2.className = 'pcs-a'; b2.textContent = 'Aceptar analítica';
    var cerrar = function(d){ document.removeEventListener('keydown', tecla, true); f.remove(); cajaEl = null; decidir(d); if(prev && prev.focus) try { prev.focus(); } catch(e){} };
    var prev = document.activeElement;
    b1.onclick = function(){ cerrar('solo_necesarias'); }; b2.onclick = function(){ cerrar('aceptadas'); };
    var tecla = function(e){ if(e.key === 'Escape'){ e.preventDefault(); cerrar('solo_necesarias'); } else if(e.key === 'Tab'){ var bs = [b1, b2, a], i = bs.indexOf(document.activeElement); e.preventDefault(); bs[(i + (e.shiftKey ? -1 : 1) + bs.length) % bs.length].focus(); } };
    document.addEventListener('keydown', tecla, true);
    fila.appendChild(b1); fila.appendChild(b2); [t, p1, p2, fila].forEach(function(x){ c.appendChild(x); }); f.appendChild(c); document.body.appendChild(f); cajaEl = f; b1.focus();
  }
  function abrir(){ mostrar(); }
  function alIniciar(){
    var e = estado();
    if(e === null){ if(gpc()) return; mostrar(); }        // GPC/No Rastrear: no se pregunta; queda apagado (se puede activar en “Preferencias”)
    else if(e === 'aceptadas') iniciarAnalitica();
  }

  // ---------- analítica (solo con permiso) ----------
  var cola = [], iniciada = false, sesion = null, temporizador = null, activoSeg = 0, scrollMax = 0, ultimaSeccion = null, vistos = {};
  function sesionId(){ if(sesion) return sesion; try { sesion = sessionStorage.getItem('puve_ses'); if(!sesion){ sesion = uuid(); sessionStorage.setItem('puve_ses', sesion); } } catch(e){ sesion = uuid(); } return sesion; }
  function utm(){
    var r = {}; try { var s = sessionStorage.getItem('puve_utm'); if(s) return JSON.parse(s);
      var q = new URLSearchParams(location.search); ['utm_source', 'utm_medium', 'utm_campaign'].forEach(function(k){ var v = q.get(k); if(v) r[k] = v.slice(0, 80); }); sessionStorage.setItem('puve_utm', JSON.stringify(r)); } catch(e){} return r;
  }
  function refHost(){ try { var h = new URL(document.referrer).hostname; return h && h !== location.hostname ? document.referrer : null; } catch(e){ return null; } }
  function dispositivo(){ var w = Math.min(screen.width || 0, window.innerWidth || 0) || window.innerWidth; return w < 640 ? 'movil' : w < 1024 ? 'tablet' : 'escritorio'; }
  function track(tipo, seccion, valor){
    if(!analiticaActiva()) return;
    cola.push({ t: tipo, pagina: PAGINA, seccion: seccion || null, valor: valor == null ? null : valor });
    if(cola.length >= 8) volcar(false); else if(!temporizador) temporizador = setTimeout(function(){ volcar(false); }, 4000);
  }
  function volcar(final){
    clearTimeout(temporizador); temporizador = null; if(!cola.length || !analiticaActiva()) { cola.length = 0; return; }
    var u = utm(), cuerpo = { accion: 'eventos', visitante: leer(C_VID), sesion: sesionId(), disp: dispositivo(), ref: refHost(), idioma: (navigator.language || '').slice(0, 15), utm_source: u.utm_source, utm_medium: u.utm_medium, utm_campaign: u.utm_campaign, eventos: cola.splice(0, 25) };
    if(!cuerpo.visitante) return;
    if(final && navigator.sendBeacon){ try { if(navigator.sendBeacon(FN + '?apikey=' + KEY, new Blob([JSON.stringify(cuerpo)], { type: 'text/plain;charset=UTF-8' }))) return; } catch(e){} }
    post(cuerpo);
  }
  function iniciarAnalitica(){
    if(iniciada || !analiticaActiva()) return; iniciada = true;
    var clave = 'puve_vista_' + PAGINA; try { if(!sessionStorage.getItem(clave)){ sessionStorage.setItem(clave, '1'); track('vista'); } } catch(e){ track('vista'); }
    if(AUTO === 'landing') autoLanding();
    document.addEventListener('visibilitychange', function(){ if(document.visibilityState === 'hidden') salir(); });
    window.addEventListener('pagehide', salir);
  }
  var saliendo = false;
  function salir(){ if(!analiticaActiva()) return; if(AUTO === 'landing' && !saliendo){ track('salida', ultimaSeccion, { seg: activoSeg, scroll: scrollMax }); saliendo = true; setTimeout(function(){ saliendo = false; }, 1500); } volcar(true); }
  function autoLanding(){
    var marcas = [25, 50, 75, 100], hechas = {}, ult = Date.now();
    ['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach(function(ev){ window.addEventListener(ev, function(){ ult = Date.now(); }, { passive: true }); });
    setInterval(function(){ if(document.visibilityState === 'visible' && Date.now() - ult < 30000 && activoSeg < 1800) activoSeg++; }, 1000);
    function onScroll(){ var h = document.documentElement, total = h.scrollHeight - h.clientHeight; if(total <= 0) return; var pct = Math.round(100 * (window.scrollY || h.scrollTop) / total); if(pct > scrollMax) scrollMax = pct;
      marcas.forEach(function(m){ if(scrollMax >= m && !hechas[m]){ hechas[m] = 1; track('scroll', null, { pct: m }); } }); }
    var esperando = false; window.addEventListener('scroll', function(){ if(esperando) return; esperando = true; setTimeout(function(){ esperando = false; onScroll(); }, 300); }, { passive: true });
    if('IntersectionObserver' in window){
      var temp = {}, io = new IntersectionObserver(function(es){ es.forEach(function(e){ var id = e.target.getAttribute('data-seccion');
        if(e.isIntersecting){ temp[id] = setTimeout(function(){ if(!vistos[id]){ vistos[id] = 1; track('seccion', id); } ultimaSeccion = id; }, 1000); } else { clearTimeout(temp[id]); } }); }, { threshold: 0.5 });
      [].forEach.call(document.querySelectorAll('[data-seccion]'), function(n){ io.observe(n); });
    }
    document.addEventListener('click', function(e){
      var n = e.target.closest && e.target.closest('[data-cta],[data-giro]'); if(!n) return;
      if(n.hasAttribute('data-cta')) track('cta', n.closest('[data-seccion]') ? n.closest('[data-seccion]').getAttribute('data-seccion') : null, { id: n.getAttribute('data-cta') });
      if(n.hasAttribute('data-giro')) track('giro', n.closest('[data-seccion]') ? n.closest('[data-seccion]').getAttribute('data-seccion') : null, { giro: n.getAttribute('data-giro') });
    }, true);
  }

  // ---------- evidencia legal de aceptación ----------
  function pendientes(){ try { return JSON.parse(localStorage.getItem(LS_PEND) || '[]'); } catch(e){ return []; } }
  function guardarPend(a){ try { localStorage.setItem(LS_PEND, JSON.stringify(a.slice(-5))); } catch(e){} }
  function enviarAceptacion(d){
    return post({ accion: 'aceptacion', user_id: d.user_id, email: d.email, nombre: d.nombre, tipo_cuenta: d.tipo_cuenta, documentos: d.documentos, texto: d.texto, mayor_de_edad: d.mayor_de_edad, metodo: d.metodo, pagina: d.pagina, visitante: d.visitante }, { token: d.token })
      .then(function(r){ return r.ok || (r.status >= 400 && r.status < 500 && r.status !== 429); });   // 4xx no se reintenta (no se puede verificar / datos inválidos)
  }
  function registrarAceptacion(d){
    d = d || {}; d.metodo = d.metodo || 'casilla'; d.pagina = (d.pagina || location.href).slice(0, 300); d.visitante = analiticaActiva() ? leer(C_VID) : null;
    d.documentos = d.documentos || [{ doc: 'terminos', version: d.version }, { doc: 'privacidad', version: d.version }];
    return enviarAceptacion(d).then(function(listo){ if(!listo){ var p = pendientes(); var copia = {}; for(var k in d) if(k !== 'token') copia[k] = d[k]; p.push(copia); guardarPend(p); } return listo; });
  }
  function reintentar(){ var p = pendientes(); if(!p.length) return; guardarPend([]); p.forEach(function(d){ enviarAceptacion(d).then(function(ok){ if(!ok){ var q = pendientes(); q.push(d); guardarPend(q); } }); }); }

  window.PuveConsent = { estado: estado, abrir: abrir, alCambiar: function(f){ oyentes.push(f); }, _decidir: decidir };
  window.PuveAnalitica = { track: track, activa: analiticaActiva };
  window.PuveLegal = { registrar: registrarAceptacion, reintentar: reintentar };
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', alIniciar); else alIniciar();
  setTimeout(reintentar, 3000);
  document.addEventListener('click', function(e){ var n = e.target.closest && e.target.closest('[data-puve-cookies]'); if(n){ e.preventDefault(); abrir(); } });
})();
