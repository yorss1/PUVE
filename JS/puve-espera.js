/* PUVE - Ventas en espera (caja): deja el carrito guardado para atender al siguiente cliente y recupéralo después.
 * Se guarda solo en este navegador (hasta 8 ventas); no se envía al servidor ni aparta existencias. Al cobrar, el servidor revisa el inventario como siempre.
 */
(function(){
  'use strict';
  let enlace = { carrito: () => [], poner: () => {}, negocio: () => 'x', dinero: (n) => '$' + Number(n).toFixed(2), renderizar: () => {} };
  const clave = () => 'puve_espera_' + enlace.negocio();
  function leer(){ try { const a = JSON.parse(localStorage.getItem(clave()) || '[]'); return Array.isArray(a) ? a : []; } catch(e){ return []; } }
  function escribir(a){ try { localStorage.setItem(clave(), JSON.stringify(a.slice(0, 8))); return true; } catch(e){ return false; } }
  const total = (items) => items.reduce((s, i) => s + (Number(i.precio) || 0) * (Number(i.cantidad) || 0), 0);
  function h(tag, txt, estilo, cls){ const e = document.createElement(tag); if(txt != null) e.textContent = txt; if(estilo) e.style.cssText = estilo; if(cls) e.className = cls; return e; }
  function actualizar(){ const b = document.getElementById('btnVerEspera'); if(!b) return; const n = leer().length; b.textContent = n ? 'En espera (' + n + ')' : 'En espera'; b.style.display = n || (enlace.carrito() || []).length ? '' : 'none'; const p = document.getElementById('btnPonerEspera'); if(p) p.style.display = (enlace.carrito() || []).length ? '' : 'none'; }
  function poner(){
    const items = enlace.carrito() || []; if(!items.length) return; const a = leer(); if(a.length >= 8){ window.alert('Ya hay 8 ventas en espera. Recupera o borra alguna.'); return; }
    a.unshift({ t: Date.now(), items: JSON.parse(JSON.stringify(items)) }); if(!escribir(a)){ window.alert('Este navegador no deja guardar la venta en espera.'); return; } enlace.poner([]); actualizar();
  }
  function cerrar(){ const o = document.getElementById('puveEspera'); if(o) o.remove(); }
  function ver(){
    cerrar(); const o = h('div', null, 'position:fixed; inset:0; background:rgba(0,0,0,.45); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;'); o.id = 'puveEspera'; o.onclick = (e) => { if(e.target === o) cerrar(); };
    const c = h('div', null, 'background:var(--tarjeta,#fff); color:inherit; border-radius:14px; padding:18px; width:100%; max-width:420px; max-height:80vh; overflow:auto;'); o.appendChild(c); c.appendChild(h('h3', 'Ventas en espera', 'margin:0 0 8px;'));
    const a = leer(); if(!a.length) c.appendChild(h('p', 'No hay ventas en espera.', 'font-size:13px;'));
    a.forEach((v, i) => { const f = h('div', null, 'border:1px solid var(--borde,#ccc); border-radius:10px; padding:10px; margin:8px 0;'); const n = v.items.reduce((s, x) => s + (Number(x.cantidad) || 0), 0);
      f.appendChild(h('div', new Date(v.t).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) + ' · ' + v.items.length + ' producto(s) · ' + enlace.dinero(total(v.items)), 'font-weight:600;')); f.appendChild(h('div', v.items.slice(0, 4).map((x) => x.nombre).join(', ') + (v.items.length > 4 ? '…' : ''), 'font-size:12px; opacity:.75; margin:2px 0 6px;'));
      const r = h('button', 'Recuperar', 'width:auto; padding:6px 12px;', 'principal'); r.type = 'button'; r.onclick = () => { const act = enlace.carrito() || []; if(act.length && !window.confirm('Tu carrito actual se pondrá en espera para recuperar esta venta. ¿Continuar?')) return; const b2 = leer(); const [sel] = b2.splice(i, 1); if(act.length) b2.unshift({ t: Date.now(), items: JSON.parse(JSON.stringify(act)) }); escribir(b2); enlace.poner(sel.items); actualizar(); cerrar(); };
      const d = h('button', 'Borrar', 'width:auto; padding:6px 12px; margin-left:6px;', 'texto'); d.type = 'button'; d.onclick = () => { if(!window.confirm('¿Borrar esta venta en espera?')) return; const b2 = leer(); b2.splice(i, 1); escribir(b2); actualizar(); ver(); }; f.appendChild(r); f.appendChild(d); c.appendChild(f); });
    const x = h('button', 'Cerrar', 'width:auto; margin-top:6px;', 'texto'); x.type = 'button'; x.onclick = cerrar; c.appendChild(x); document.body.appendChild(o);
  }
  window.PuveEspera = { enlazar(o){ enlace = Object.assign(enlace, o || {}); actualizar(); }, poner, ver, actualizar };
})();
