/* PUVE - Zonas de reparto (Inventario → Reparto): costo de envío, tiempo estimado y pedido mínimo por zona.
 * Datos por funciones del SQL 124. «Calcular envío» arma el aviso para el cliente (copiar o WhatsApp); el envío se cobra en la caja como un producto normal (ej. «Envío»).
 * No usa mapas ni distancias y no asigna repartidores.
 */
(function(){
  'use strict';
  let enlace = { sb: null, dinero: (n) => '$' + Number(n).toFixed(2), negocio: () => '' };
  function h(tag, cls, txt, estilo){ const e = document.createElement(tag); if(cls) e.className = cls; if(txt != null) e.textContent = txt; if(estilo) e.style.cssText = estilo; return e; }
  function boton(txt, fn, cls, estilo){ const b = h('button', cls || 'texto', txt, 'width:auto; padding:7px 12px;' + (estilo || '')); b.type = 'button'; b.onclick = fn; return b; }
  function campo(et, el, ancho){ const w = h('label', null, et, 'display:flex; flex-direction:column; gap:4px; font-size:13px; font-weight:500;' + (ancho ? 'flex:1 1 ' + ancho + 'px;' : '')); w.appendChild(el); return w; }
  const input = (v, ph, max, tipo) => { const i = h('input', 'input-mini'); if(tipo) i.type = tipo; if(v != null && v !== '') i.value = v; if(ph) i.placeholder = ph; if(max) i.maxLength = max; return i; };
  const msg = (z, t, ok) => { z.textContent = t; z.style.cssText = 'font-size:13px; margin:8px 0; color:' + (ok ? '#16a34a' : 'var(--error,#b91c1c)') + ';'; };
  function errTxt(e){ const m = (e && e.message) || String(e); return /does not exist|schema cache|Could not find/i.test(m) ? 'Falta ejecutar el script SQL 124 en Supabase.' : m; }
  async function rpc(f, a){ const r = await enlace.sb.rpc(f, a); if(r.error) throw r.error; return r.data; }
  const din = (n) => enlace.dinero(Number(n) || 0);
  const aviso = (z) => 'Tu pedido a domicilio (zona ' + z.nombre + '): envío ' + (Number(z.costo) ? din(z.costo) : 'gratis') + ', llega en unos ' + z.minutos + ' min' + (Number(z.pedido_minimo) ? ', pedido mínimo ' + din(z.pedido_minimo) : '') + '.';
  let raiz = null;
  function abrir(){ raiz = raiz || document.getElementById('vistaInventarioReparto'); if(raiz) pintar(); }
  async function pintar(ed){
    raiz.textContent = ''; raiz.appendChild(h('h3', null, 'Zonas de reparto', 'margin:0 0 4px;')); raiz.appendChild(h('p', 'nota', 'Define cuánto cobras de envío, en cuánto llegas y desde qué monto repartes en cada zona. Úsalo para avisar al cliente; el envío lo cobras en la caja como un producto (por ejemplo «Envío»).', 'margin:0 0 10px;'));
    const z = h('div'); raiz.appendChild(z); const f = h('div'); raiz.appendChild(f); let l = [];
    try { l = await rpc('zonas_reparto_lista'); } catch(e){ msg(z, errTxt(e)); }
    if(!l.length) z.appendChild(h('p', 'nota', 'Todavía no tienes zonas.'));
    l.forEach((x) => { const c = h('div', null, null, 'border:1px solid var(--borde); border-radius:10px; padding:10px 12px; margin-bottom:8px;'); c.appendChild(h('strong', null, x.nombre + ' · envío ' + (Number(x.costo) ? din(x.costo) : 'gratis') + ' · ~' + x.minutos + ' min' + (Number(x.pedido_minimo) ? ' · mínimo ' + din(x.pedido_minimo) : '')));
      if(x.colonias) c.appendChild(h('div', 'nota', x.colonias, 'margin-top:3px;')); const ac = h('div', null, null, 'display:flex; gap:8px; margin-top:8px; flex-wrap:wrap;'); const bc = boton('Copiar aviso al cliente', async () => { try { await navigator.clipboard.writeText(aviso(x)); bc.textContent = 'Copiado ✓'; } catch(e){ window.prompt('Copia el texto:', aviso(x)); } }); ac.appendChild(bc);
      ac.appendChild(boton('Mandar por WhatsApp', () => window.open('https://wa.me/?text=' + encodeURIComponent(aviso(x)), '_blank', 'noopener'))); ac.appendChild(boton('Editar', () => { pintar(x); window.scrollTo(0, document.body.scrollHeight); }));
      ac.appendChild(boton('Archivar', async () => { if(!window.confirm('¿Archivar la zona «' + x.nombre + '»?')) return; try { await rpc('zona_reparto_archivar', { p_id: x.id }); pintar(); } catch(e){ msg(c, errTxt(e)); } })); c.appendChild(ac); z.appendChild(c); });
    if(l.length){ const bt = boton('Mandar todas las zonas por WhatsApp', () => { const t = (enlace.negocio() ? 'Reparto a domicilio de ' + enlace.negocio() + ':\n' : 'Reparto a domicilio:\n') + l.map((x) => '• ' + x.nombre + (x.colonias ? ' (' + x.colonias + ')' : '') + ': envío ' + (Number(x.costo) ? din(x.costo) : 'gratis') + ', ~' + x.minutos + ' min' + (Number(x.pedido_minimo) ? ', mínimo ' + din(x.pedido_minimo) : '')).join('\n'); window.open('https://wa.me/?text=' + encodeURIComponent(t), '_blank', 'noopener'); }); z.appendChild(bt); }
    const b = h('div', 'bloque-analitica', null, 'margin-top:16px;'); b.appendChild(h('h3', null, ed ? 'Editar zona' : 'Nueva zona'));
    const nom = input(ed ? ed.nombre : '', 'Ej. Centro', 60), col = input(ed ? ed.colonias : '', 'Colonias o calles (opcional)', 300), cos = input(ed ? ed.costo : '0', '', 8, 'number'), min = input(ed ? ed.minutos : '30', '', 4, 'number'), pm = input(ed ? ed.pedido_minimo : '0', '', 9, 'number'), est = h('div');
    [cos, pm].forEach((i) => { i.min = '0'; i.step = '0.01'; }); min.min = '1'; min.step = '1';
    const fi = h('div', null, null, 'display:flex; gap:10px; flex-wrap:wrap;'); [campo('Zona', nom, 160), campo('Colonias', col, 220), campo('Envío ($)', cos, 100), campo('Minutos', min, 90), campo('Pedido mínimo ($)', pm, 120)].forEach((x) => fi.appendChild(x)); b.appendChild(fi);
    const ac = h('div', null, null, 'display:flex; gap:8px; margin-top:10px;'); const gd = boton(ed ? 'Guardar cambios' : 'Guardar zona', async () => { if(!nom.value.trim()) return msg(est, 'Escribe el nombre de la zona.'); gd.disabled = true; try { await rpc('zona_reparto_guardar', { p_id: ed ? ed.id : null, p_nombre: nom.value.trim(), p_colonias: col.value.trim() || null, p_costo: Number(cos.value) || 0, p_minutos: Math.round(Number(min.value)) || 30, p_minimo: Number(pm.value) || 0 }); pintar(); } catch(e){ gd.disabled = false; msg(est, errTxt(e)); } }, 'principal');
    ac.appendChild(gd); if(ed) ac.appendChild(boton('Cancelar', () => pintar())); b.appendChild(ac); b.appendChild(est); f.appendChild(b);
  }
  window.PuveReparto = { enlazar(o){ enlace = Object.assign(enlace, o || {}); }, abrir };
})();
