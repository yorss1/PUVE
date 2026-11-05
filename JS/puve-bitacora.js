/* PUVE - Bitácora de temperatura (Inventario → Bitácora): refrigeradores, congeladores y vitrinas con rango y lecturas del día.
 * PUVE no mide la temperatura ni manda alarmas: se anota la lectura y la pantalla avisa si salió del rango o si faltan lecturas del día.
 * Revisa con tu proveedor o la norma que te aplique qué rango usar: los de arranque son solo una sugerencia.
 */
(function(){
  'use strict';
  let enlace = { sb: null, giro: () => null };
  const SUG = { refrigerador: [0, 5], congelador: [-25, -18], vitrina: [0, 5], otro: [0, 10] };
  function h(tag, cls, txt, estilo){ const e = document.createElement(tag); if(cls) e.className = cls; if(txt != null) e.textContent = txt; if(estilo) e.style.cssText = estilo; return e; }
  function boton(txt, fn, cls, estilo){ const b = h('button', cls || 'texto', txt, 'width:auto; padding:7px 12px;' + (estilo || '')); b.type = 'button'; b.onclick = fn; return b; }
  function campo(et, el, ancho){ const w = h('label', null, et, 'display:flex; flex-direction:column; gap:4px; font-size:13px; font-weight:500;' + (ancho ? 'flex:1 1 ' + ancho + 'px;' : '')); w.appendChild(el); return w; }
  const input = (v, ph, max, tipo) => { const i = h('input', 'input-mini'); if(tipo) i.type = tipo; if(v != null && v !== '') i.value = v; if(ph) i.placeholder = ph; if(max) i.maxLength = max; return i; };
  const sel = (ops) => { const s = h('select', 'input-mini'); ops.forEach(([v, t]) => { const o = h('option', null, t); o.value = v; s.appendChild(o); }); return s; };
  const msg = (z, t, ok) => { z.textContent = t; z.style.cssText = 'font-size:13px; margin:8px 0; color:' + (ok ? '#16a34a' : 'var(--error,#b91c1c)') + ';'; };
  function errTxt(e){ const m = (e && e.message) || String(e); return /does not exist|schema cache|Could not find/i.test(m) ? 'Falta ejecutar el script SQL 119 en Supabase.' : m; }
  async function rpc(f, a){ const r = await enlace.sb.rpc(f, a); if(r.error) throw r.error; return r.data; }
  const TIPOS = [['refrigerador', 'Refrigerador'], ['congelador', 'Congelador'], ['vitrina', 'Vitrina refrigerada'], ['otro', 'Otro']];
  const hora = (iso) => new Date(iso).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
  let raiz = null;
  function abrir(){ raiz = raiz || document.getElementById('vistaInventarioBitacora'); if(raiz) lista(); }
  async function lista(){
    raiz.textContent = ''; const cab = h('div', null, null, 'display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-bottom:6px;'); cab.appendChild(h('h3', null, 'Bitácora de temperatura', 'margin:0; flex:1 1 auto;')); cab.appendChild(boton('+ Agregar equipo', () => editar(null), 'principal', 'padding:9px 14px;')); raiz.appendChild(cab);
    raiz.appendChild(h('p', 'nota', 'Anota la temperatura de tus refrigeradores y congeladores varias veces al día. PUVE avisa si una lectura sale del rango o si faltan lecturas de hoy; no mide ni manda alarmas por sí solo.', 'margin:0 0 12px;')); const z = h('div'); raiz.appendChild(z);
    try { const d = await rpc('bitacora_estado'); if(!d.length){ z.appendChild(h('p', 'nota', 'Todavía no hay equipos. Agrega el primero con el botón de arriba.')); return; }
      d.forEach((e) => { const c = h('div', null, null, 'border:1px solid ' + (e.ultima_fuera ? '#dc2626' : 'var(--borde)') + '; border-radius:10px; padding:12px; margin-bottom:10px;'), t = h('div', null, null, 'display:flex; justify-content:space-between; gap:8px; flex-wrap:wrap;');
        t.appendChild(h('strong', null, e.nombre)); t.appendChild(h('span', 'nota', 'Rango ' + e.min + ' a ' + e.max + ' °C')); c.appendChild(t);
        c.appendChild(h('div', null, e.ultima_temp == null ? 'Sin lecturas todavía' : 'Última lectura: ' + e.ultima_temp + ' °C · ' + hora(e.ultima_hora) + (e.ultima_fuera ? ' · FUERA DE RANGO' : ''), 'font-size:14px; margin-top:4px;' + (e.ultima_fuera ? 'color:#dc2626; font-weight:700;' : '')));
        const faltan = Math.max(0, e.esperadas - e.hoy); c.appendChild(h('div', 'nota', 'Hoy: ' + e.hoy + ' de ' + e.esperadas + ' lecturas' + (faltan ? ' · faltan ' + faltan : ' ✓') + (e.fuera_7d ? ' · ' + e.fuera_7d + ' fuera de rango en 7 días' : ''), faltan ? 'color:#b45309;' : ''));
        const f = h('div', null, null, 'display:flex; gap:8px; align-items:end; flex-wrap:wrap; margin-top:8px;'), te = input('', '°C', 6, 'number'), no = input('', 'Nota (opcional)', 200); te.step = '0.1'; te.style.width = '90px'; no.style.minWidth = '160px'; const es = h('div');
        f.appendChild(campo('Temperatura', te)); f.appendChild(no); f.appendChild(boton('Registrar', async () => { if(te.value === '') return msg(es, 'Escribe la temperatura.'); try { const r = await rpc('bitacora_registrar', { p_equipo: e.id, p_temperatura: Number(te.value), p_nota: no.value.trim() || null }); if(r.fuera_de_rango && !window.confirm('Lectura FUERA DE RANGO (' + r.min + ' a ' + r.max + ' °C). Quedó registrada. Revisa el equipo y el producto.')){} lista(); } catch(er){ msg(es, errTxt(er)); } }, 'principal')); c.appendChild(f); c.appendChild(es);
        const ac = h('div', null, null, 'display:flex; gap:6px; margin-top:8px;'); ac.appendChild(boton('Historial', () => historial(e))); ac.appendChild(boton('Editar', () => editar(e))); ac.appendChild(boton('Quitar', async () => { if(!window.confirm('¿Quitar «' + e.nombre + '»? El historial se conserva.')) return; try { await rpc('bitacora_equipo_archivar', { p_id: e.id }); lista(); } catch(er){ msg(es, errTxt(er)); } })); c.appendChild(ac); z.appendChild(c); });
    } catch(e){ msg(z, 'No se pudo cargar: ' + errTxt(e)); }
  }
  function editar(e){
    raiz.textContent = ''; raiz.appendChild(boton('← Volver', lista)); raiz.appendChild(h('h3', null, e ? 'Editar equipo' : 'Nuevo equipo', 'margin:10px 0;'));
    const nom = input(e && e.nombre, 'Refrigerador de lácteos', 60), tipo = sel(TIPOS), mn = input(e ? e.min : '', '', 6, 'number'), mx = input(e ? e.max : '', '', 6, 'number'), lec = input(e ? e.esperadas : 2, '', 2, 'number'); [mn, mx].forEach((i) => i.step = '0.1'); if(e) tipo.value = e.tipo;
    if(!e){ const ap = () => { const s = SUG[tipo.value]; mn.value = s[0]; mx.value = s[1]; }; tipo.onchange = ap; ap(); }
    const fr = h('div', null, null, 'display:flex; gap:10px; flex-wrap:wrap;'); [campo('Nombre', nom, 240), campo('Tipo', tipo, 170), campo('Mínimo °C', mn, 100), campo('Máximo °C', mx, 100), campo('Lecturas al día', lec, 110)].forEach((x) => fr.appendChild(x)); raiz.appendChild(fr);
    raiz.appendChild(h('p', 'nota', 'Los rangos de arranque son una sugerencia. Confirma con tu proveedor o la norma que te aplique cuál usar (por ejemplo, medicamentos o carnes).', 'margin:8px 0;'));
    const es = h('div'), gb = boton('Guardar', async () => { gb.disabled = true; try { await rpc('bitacora_equipo_guardar', { p_id: e ? e.id : null, p_nombre: nom.value.trim(), p_tipo: tipo.value, p_min: Number(mn.value), p_max: Number(mx.value), p_lecturas: Math.round(Number(lec.value)) || 2 }); lista(); } catch(er){ gb.disabled = false; msg(es, errTxt(er)); } }, 'principal'); raiz.appendChild(gb); raiz.appendChild(es);
  }
  async function historial(e){
    raiz.textContent = ''; raiz.appendChild(boton('← Volver', lista)); raiz.appendChild(h('h3', null, 'Historial · ' + e.nombre, 'margin:10px 0;')); const z = h('div'); raiz.appendChild(z);
    try { const d = await rpc('bitacora_historial', { p_equipo: e.id, p_dias: 30 }); if(!d.length){ z.appendChild(h('p', 'nota', 'Sin lecturas en los últimos 30 días.')); return; }
      const w = h('div', 'envoltura-tabla'), t = h('table'), th = h('thead'), tr0 = h('tr'); ['Fecha', '°C', 'Quién', 'Nota'].forEach((c) => tr0.appendChild(h('th', null, c))); th.appendChild(tr0); t.appendChild(th); const tb = h('tbody'); t.appendChild(tb); w.appendChild(t); z.appendChild(w);
      d.forEach((x) => { const tr = h('tr'); tr.appendChild(h('td', null, hora(x.cuando))); tr.appendChild(h('td', null, x.temp + (x.fuera ? ' ⚠' : ''), x.fuera ? 'color:#dc2626; font-weight:700;' : '')); tr.appendChild(h('td', null, x.quien || '')); tr.appendChild(h('td', null, x.nota || '')); tb.appendChild(tr); });
      z.appendChild(boton('Descargar CSV', () => { const q = (s) => '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"'; const csv = '\ufeffFecha,Temperatura,Fuera de rango,Quien,Nota\n' + d.map((x) => [q(hora(x.cuando)), x.temp, x.fuera ? 'sí' : 'no', q(x.quien), q(x.nota)].join(',')).join('\n'), a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = 'bitacora-' + e.nombre.replace(/[^\w]+/g, '-') + '.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }, 'texto', 'margin-top:10px;'));
    } catch(er){ msg(z, 'No se pudo cargar: ' + errTxt(er)); }
  }
  window.PuveBitacora = { enlazar(o){ enlace = Object.assign(enlace, o || {}); }, abrir };
})();
