/* PUVE - Publicidad en pedir.html (menú QR y seguimiento del pedido).
 * Una tarjeta discreta dentro de la página (nunca fija ni sobre el menú, sin ventanas). Si no hay anuncios vigentes no existe: no ocupa espacio.
 * Los anuncios los programa el superadmin (Superadmin → Publicidad, casilla «Menú QR»). Se consulta al servidor y se refresca cada minuto.
 * La página se repinta seguido (el seguimiento se actualiza solo): la lista y el anuncio en turno se guardan aquí para que no parpadee ni se cuente dos veces.
 * Vistas: se cuentan cuando el anuncio realmente se ve en pantalla (una vez cada 5 min por anuncio y dispositivo). Los videos van sin sonido y no se reproducen si el aparato pide ahorrar datos o movimiento.
 */
(function(){
  'use strict';
  var SUPA = '', KEY = '', lista = [], firma = '', idx = 0, bloques = [], timer = 0, vistos = {}, iniciado = false;
  var OK = /^[0-9a-f-]{36}\.(png|jpg|webp|gif|mp4|webm)$/, ID = /^[0-9a-f-]{36}$/;
  var quieto = function(){ try { return (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) || (navigator.connection && navigator.connection.saveData); } catch(e){ return false; } };
  var esVideo = function(f){ return /\.(mp4|webm)$/.test(f); };
  function estilo(){
    if(document.getElementById('pubp-css')) return; var s = document.createElement('style'); s.id = 'pubp-css';
    s.textContent = '.pubp{margin:16px 0;border:1px solid var(--b,rgba(0,0,0,.1));border-radius:20px;background:var(--v,rgba(255,255,255,.8));overflow:hidden}.pubp[hidden]{display:none}.pubp a,.pubp div.m{display:block;color:inherit}.pubp img,.pubp video{display:block;width:100%;height:auto;max-height:130px;object-fit:cover;background:var(--b,#eee)}.pubp small{display:block;padding:5px 12px 7px;font-size:10.5px;letter-spacing:.04em;text-transform:uppercase;color:var(--s,#888)}';
    document.head.appendChild(s);
  }
  function post(cuerpo){
    return fetch(SUPA + '/functions/v1/pedido-qr', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: KEY, Authorization: 'Bearer ' + KEY }, body: JSON.stringify(cuerpo) }).then(function(r){ return r.ok ? r.json() : null; }).catch(function(){ return null; });
  }
  function directo(){
    return fetch(SUPA + '/rest/v1/rpc/anuncios_activos', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: KEY }, body: JSON.stringify({ p_donde: 'pedir' }) }).then(function(r){ return r.ok ? r.json() : null; }).catch(function(){ return null; });
  }
  function contar(a, tipo){
    var k = a.id + tipo, t = vistos[k] || 0; if(Date.now() - t < 300000) return; vistos[k] = Date.now(); post({ accion: 'juego_anuncio_evento', id: a.id, tipo: tipo });
  }
  function archivoDe(a){ return a.archivo_movil || a.archivo; }   // pedir.html es de celular: se prefiere la versión para celular
  function pintar(b, a){
    b.textContent = ''; var f = archivoDe(a), url = SUPA + '/storage/v1/object/public/anuncios-juego/' + f, m;
    if(esVideo(f)){ if(quieto()){ quitar(a); return; } m = document.createElement('video'); m.src = url; m.muted = true; m.loop = true; m.autoplay = true; m.playsInline = true; m.setAttribute('playsinline', ''); m.preload = 'metadata'; if(m.play) m.play().catch(function(){}); }
    else { m = document.createElement('img'); m.src = url; m.alt = ''; m.decoding = 'async'; m.loading = 'lazy'; }
    m.onerror = function(){ quitar(a); };
    var cont = m;
    if(a.enlace){ cont = document.createElement('a'); cont.href = a.enlace; cont.target = '_blank'; cont.rel = 'noopener noreferrer sponsored nofollow'; cont.appendChild(m); cont.onclick = function(){ contar(a, 'clic'); }; }
    else { cont = document.createElement('div'); cont.className = 'm'; cont.appendChild(m); }
    var et = document.createElement('small'); et.textContent = 'Publicidad'; b.appendChild(cont); b.appendChild(et); b.hidden = false;
    // la vista cuenta solo si de verdad se ve
    if(window.IntersectionObserver){ var io = new IntersectionObserver(function(es){ if(es[0] && es[0].isIntersecting && es[0].intersectionRatio >= 0.5){ io.disconnect(); contar(a, 'vista'); } }, { threshold: [0.5] }); io.observe(b); } else contar(a, 'vista');
  }
  function quitar(a){ lista = lista.filter(function(x){ return x.id !== a.id; }); firma = ''; ciclo(); }
  function ciclo(){
    clearTimeout(timer); bloques = bloques.filter(function(b){ return b.isConnected; });
    if(!lista.length){ bloques.forEach(function(b){ b.hidden = true; b.textContent = ''; }); return; }
    var a = lista[idx % lista.length]; bloques.forEach(function(b){ pintar(b, a); });
    if(lista.length > 1 && bloques.length) timer = setTimeout(function(){ idx++; ciclo(); }, Math.max(5, Math.min(120, a.duracion || 10)) * 1000);
  }
  function refrescar(){
    if(document.hidden) return;
    post({ accion: 'anuncios' }).then(function(r){ return (r && Array.isArray(r.anuncios)) ? r : directo().then(function(d){ return Array.isArray(d) ? { anuncios: d } : null; }); }).then(function(r){
      if(!r) return;
      var n = r.anuncios.filter(function(a){ return a && ID.test(a.id) && OK.test(a.archivo) && (!a.archivo_movil || OK.test(a.archivo_movil)) && (a.tipo === 'imagen' || a.tipo === 'video') && (!a.enlace || /^https:\/\//.test(a.enlace)); });
      var f = n.map(function(a){ return a.id + a.archivo + (a.archivo_movil || '') + a.duracion; }).join('|'); if(f === firma) return;
      firma = f; lista = n; idx = 0; ciclo();
    });
  }
  window.PuvePubli = {
    iniciar: function(o){ if(iniciado || !o || !o.supa) return; iniciado = true; SUPA = o.supa; KEY = o.key; estilo(); refrescar(); setInterval(refrescar, 60000); },
    // Devuelve un contenedor para poner donde va la tarjeta; se llena solo (y al instante si ya hay lista guardada).
    montar: function(){ var b = document.createElement('div'); b.className = 'pubp'; b.hidden = true; b.setAttribute('role', 'complementary'); b.setAttribute('aria-label', 'Publicidad'); bloques.push(b); if(lista.length) setTimeout(function(){ if(b.isConnected) pintar(b, lista[idx % lista.length]); }, 0); return b; }
  };
})();
