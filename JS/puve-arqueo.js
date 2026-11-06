/* PUVE - Arqueo por denominación (Corte de caja → «Contar por billetes y monedas»).
 * Ayuda a contar: cada billete y moneda con su cantidad, suma sola y llena «Efectivo contado». El conteo se guarda aparte (SQL 122) y el administrador lo ve junto al resultado del corte.
 * El corte sigue siendo a ciegas para el cajero: no ve esperado ni diferencia.
 */
(function(){
  'use strict';
  let enlace = { sb: null, dinero: (n) => '$' + Number(n).toFixed(2) };
  const DEN = [1000, 500, 200, 100, 50, 20, 10, 5, 2, 1, 0.5];
  function h(tag, cls, txt, estilo){ const e = document.createElement(tag); if(cls) e.className = cls; if(txt != null) e.textContent = txt; if(estilo) e.style.cssText = estilo; return e; }
  const etq = (d) => (d >= 20 ? 'Billete de ' : 'Moneda de ') + '$' + (d < 1 ? '0.50' : d);
  let cajas = {}, campo = null;
  const total = () => DEN.reduce((s, d) => s + d * (Number(cajas[d] && cajas[d].value) || 0), 0);
  function montar(cont, inputContado){
    if(!cont) return; campo = inputContado; cajas = {}; cont.textContent = '';
    const sw = h('label', null, null, 'display:flex; gap:8px; align-items:center; font-size:14px; margin-top:12px;'); const ck = h('input'); ck.type = 'checkbox'; ck.style.cssText = 'width:18px; height:18px; margin:0;'; sw.appendChild(ck); sw.appendChild(document.createTextNode('Contar por billetes y monedas')); cont.appendChild(sw);
    const cuerpo = h('div', null, null, 'display:none; margin-top:10px;'); cont.appendChild(cuerpo);
    const rej = h('div', null, null, 'display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:8px;'); cuerpo.appendChild(rej);
    const tot = h('div', null, null, 'font-weight:700; margin-top:10px;');
    const act = () => { const t = total(); tot.textContent = 'Suma contada: ' + enlace.dinero(t); if(campo){ campo.value = t ? String(Math.round(t * 100) / 100) : ''; campo.dispatchEvent(new Event('input', { bubbles: true })); } };
    DEN.forEach((d) => { const l = h('label', null, etq(d), 'display:flex; flex-direction:column; gap:3px; font-size:12px;'); const i = h('input', 'input-mini'); i.type = 'number'; i.min = '0'; i.step = '1'; i.inputMode = 'numeric'; i.placeholder = '0'; i.oninput = act; cajas[d] = i; l.appendChild(i); rej.appendChild(l); });
    cuerpo.appendChild(tot); cuerpo.appendChild(h('p', 'nota', 'Escribe cuántas piezas de cada una tienes. Si cambias «Efectivo contado» a mano, el desglose ya no se guarda.', 'margin:4px 0 0;'));
    ck.onchange = () => { cuerpo.style.display = ck.checked ? '' : 'none'; if(ck.checked) act(); };
  }
  // Devuelve {denominación: piezas} solo si el desglose se usó y su suma coincide con el efectivo contado; si no, null.
  function desglose(){
    if(!campo) return null; const t = total(); if(!(t > 0)) return null; if(Math.abs(t - (Number(campo.value) || 0)) > 0.01) return null;
    const o = {}; DEN.forEach((d) => { const n = Math.floor(Number(cajas[d].value) || 0); if(n > 0) o[String(d)] = n; }); return Object.keys(o).length ? o : null;
  }
  async function guardar(des){ if(!des) return; const t = Object.keys(des).reduce((s, k) => s + Number(k) * des[k], 0); const r = await enlace.sb.rpc('arqueo_guardar', { p_desglose: des, p_total: Math.round(t * 100) / 100 }); if(r.error) throw r.error; }
  async function lista(cont){
    if(!cont) return; cont.textContent = '';
    try { const r = await enlace.sb.rpc('arqueos_lista', { p_limite: 15 }); if(r.error) throw r.error; const l = r.data || []; if(!l.length) return;
      cont.appendChild(h('h3', null, 'Conteos por billetes y monedas', 'margin:20px 0 6px;'));
      l.forEach((a) => { const c = h('div', null, null, 'border:1px solid var(--borde); border-radius:10px; padding:8px 12px; margin-bottom:8px; font-size:14px;'); const dif = a.diferencia == null ? null : Number(a.diferencia);
        c.appendChild(h('strong', null, new Date(a.cuando).toLocaleString('es-MX') + ' · ' + (a.cajero || 'Cajero') + ' · contó ' + enlace.dinero(a.total) + (dif == null ? '' : ' · ' + (dif === 0 ? 'cuadra' : (dif > 0 ? 'sobra ' : 'falta ') + enlace.dinero(Math.abs(dif))))));
        c.appendChild(h('div', 'nota', Object.keys(a.desglose).sort((x, y) => y - x).map((k) => a.desglose[k] + ' × $' + k).join(' · '), 'margin-top:3px;')); cont.appendChild(c); });
    } catch(e){ /* sin SQL 122 o sin permiso: no se muestra nada */ }
  }
  window.PuveArqueo = { enlazar(o){ enlace = Object.assign(enlace, o || {}); }, montar, desglose, guardar, lista };
})();
