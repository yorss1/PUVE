/* PUVE - Prepara hoy (Inventario → pestaña "Prepara hoy"; restaurantes, taquerías, pizzerías, bares y cafeterías).
 * Qué falta para hoy según lo vendido los mismos días de la semana · tacos (piezas) por orden · cuándo empezar a preparar · trompo y carne.
 * Los números salen del servidor (prepara_hoy, piezas_por_orden, ventas_por_hora, carga_registrar, cargas_resumen) y solo los pide el encargado.
 */
(function(){
  'use strict';
  let enlace = { sb: null, categorias: () => [], aviso: (m) => alert(m) };
  const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const ESTADOS = {
    agotado: { et: 'Se acabó', color: '#dc2626' }, critico: { et: 'No alcanza para hoy', color: '#dc2626' },
    justo: { et: 'Va justo', color: '#d97706' }, bien: { et: 'Alcanza', color: '#16a34a' }
  };

  function h(tag, cls, txt, estilo){ const e = document.createElement(tag); if(cls) e.className = cls; if(txt != null) e.textContent = txt; if(estilo) e.style.cssText = estilo; return e; }
  const fmt = (n, d) => Number(n).toLocaleString('es-MX', { maximumFractionDigits: d == null ? 2 : d });
  const num = (v) => { const n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : NaN; };
  const unidad = (u) => ({ kg: 'kg', g: 'g', l: 'litros', ml: 'ml', pza: 'piezas' }[u] || u);
  const hora12 = (n) => (n % 12 === 0 ? 12 : n % 12) + (n < 12 ? ' am' : ' pm');
  const alas = (n) => (n % 12 === 1 ? 'a la ' : 'a las ') + hora12(n), plural = (d) => /s$/.test(d) ? d : d + 's';
  function bloque(cont, titulo, nota){
    const b = h('div', 'bloque-analitica', null, 'margin-bottom:20px;'); b.appendChild(h('h3', null, titulo));
    if(nota) b.appendChild(h('p', 'nota', nota, 'margin:0 0 10px;')); cont.appendChild(b); return b;
  }
  function tabla(columnas){
    const wrap = h('div', 'envoltura-tabla'), t = h('table'), th = h('thead'), tr = h('tr');
    columnas.forEach((c) => tr.appendChild(h('th', null, c))); th.appendChild(tr); t.appendChild(th);
    const tb = h('tbody'); t.appendChild(tb); wrap.appendChild(t); return { wrap, tb };
  }
  const celda = (tr, txt, estilo) => { const td = h('td', null, txt, estilo); tr.appendChild(td); return td; };
  function boton(txt, fn, cls, estilo){
    const b = h('button', cls || 'texto', txt, 'width:auto; padding:7px 12px;' + (estilo || '')); b.type = 'button';
    b.onclick = async () => { b.disabled = true; try { await fn(); } catch(e){ enlace.aviso((e && e.message) || String(e)); } finally { b.disabled = false; } };
    return b;
  }
  async function pedir(nombre, args){
    const r = await enlace.sb.rpc(nombre, args || {});
    if(r.error){
      if(/does not exist|schema cache|Could not find/i.test(r.error.message || '')) throw new Error('Falta ejecutar el script SQL 104 en Supabase.');
      throw new Error(r.error.message);
    }
    return r.data;
  }
  // La lista de compras se copia o se manda por WhatsApp: sin guardar nada
  function textoCompras(datos){
    const faltan = (datos.insumos || []).filter((i) => i.estado !== 'bien' && Number(i.sugerido) > 0);
    if(!faltan.length) return '';
    return 'Para comprar hoy:\n' + faltan.map((i) => '- ' + i.nombre + ': ' + fmt(Math.ceil(Number(i.sugerido) * 10) / 10, 1) + ' ' + unidad(i.unidad)).join('\n');
  }

  // ---------- 1) qué falta para hoy ----------
  async function pintarHoy(cont){
    let d;
    try { d = await pedir('prepara_hoy', { p_semanas: 6 }); } catch(e){ cont.appendChild(h('p', 'nota', e.message, 'color:#b91c1c;')); return; }
    if(!d || !d.dias_con_datos){ bloque(cont, 'Qué preparar hoy', 'Todavía no hay ventas de las últimas semanas para calcularlo. Cuando tengas unos días de ventas con recetas armadas, aquí te digo qué prepararte y qué te falta.'); return; }
    const dia = DIAS[d.dow], b = bloque(cont, 'Qué preparar hoy · ' + dia,
      d.dias_mismo_dia > 0 ? 'Calculado con tus últimos ' + d.dias_mismo_dia + ' ' + (d.dias_mismo_dia === 1 ? dia : plural(dia)) + ' de venta. Es un estimado: ajústalo si hoy hay evento o llueve.' : 'Aún no tienes ' + plural(dia) + ' de venta; uso el promedio de todos tus días.');
    const ins = d.insumos || [], malos = ins.filter((i) => i.estado === 'agotado' || i.estado === 'critico');
    if(malos.length) b.appendChild(h('div', null, malos.length === 1 ? '1 insumo no alcanza para hoy.' : malos.length + ' insumos no alcanzan para hoy.', 'padding:10px 14px; border-radius:12px; background:#fee2e2; color:#991b1b; font-weight:600; margin-bottom:10px;'));
    if(!ins.length) b.appendChild(h('p', 'nota', 'No hay insumos con receta o con mínimo definido. Arma recetas en Recetas e insumos para ver aquí qué te falta.'));
    else {
      const t = tabla(['Insumo', 'Tengo', 'Gastarás hoy', 'Estado', 'Comprar']);
      ins.forEach((i) => {
        const tr = h('tr'), st = ESTADOS[i.estado] || ESTADOS.bien;
        celda(tr, i.nombre, 'font-weight:600;'); celda(tr, fmt(i.stock, 2) + ' ' + unidad(i.unidad));
        celda(tr, Number(i.uso_hoy) > 0 ? '≈ ' + fmt(i.uso_hoy, 2) + ' ' + unidad(i.unidad) : '—');
        const e = celda(tr, (!(Number(i.uso_hoy) > 0) && (i.estado === 'agotado' || i.estado === 'justo') ? 'Bajo mínimo' : st.et)); e.style.cssText = 'color:' + st.color + '; font-weight:600;';
        celda(tr, Number(i.sugerido) > 0 ? fmt(Math.ceil(Number(i.sugerido) * 10) / 10, 1) + ' ' + unidad(i.unidad) : '—');
        t.tb.appendChild(tr);
      });
      b.appendChild(t.wrap);
      const txt = textoCompras(d);
      if(txt){
        const f = h('div', null, null, 'display:flex; gap:8px; flex-wrap:wrap; margin-top:10px;');
        f.appendChild(boton('Copiar lista de compras', async () => { try { await navigator.clipboard.writeText(txt); enlace.aviso('Lista copiada.'); } catch(e){ prompt('Copia tu lista:', txt); } }, 'principal'));
        f.appendChild(boton('Mandar por WhatsApp', () => { window.open('https://wa.me/?text=' + encodeURIComponent(txt), '_blank', 'noopener'); }));
        b.appendChild(f);
      }
    }
    const pl = d.platillos || [];
    if(pl.length){
      const b2 = bloque(cont, 'Cuánto preparar de cada platillo', 'Lo que normalmente vendes en un ' + dia + '. Súmale un poco si quieres no quedarte corto.');
      const t = tabla(['Platillo', 'Se suele vender', 'Con 15% de colchón']);
      pl.slice(0, 20).forEach((p) => { const tr = h('tr'); celda(tr, p.nombre, 'font-weight:600;'); celda(tr, '≈ ' + fmt(p.esperado, 0)); celda(tr, String(Math.ceil(Number(p.esperado) * 1.15))); t.tb.appendChild(tr); });
      b2.appendChild(t.wrap);
    }
    return d;
  }

  // ---------- 2) cuándo empezar a preparar ----------
  async function pintarHorario(cont, dow){
    let filas;
    try { filas = await pedir('ventas_por_hora', { p_dias: 42 }); } catch(e){ return; }
    const hoy = (filas || []).filter((f) => Number(f.dow) === dow);
    if(!hoy.length) return;
    const orden = hoy.slice().sort((a, b) => Number(b.tickets) - Number(a.tickets)), pico = orden[0], total = hoy.reduce((s, f) => s + Number(f.tickets), 0);
    const b = bloque(cont, 'Cuándo empezar a preparar', 'Con tus ventas de las últimas 6 semanas, un ' + DIAS[dow] + '.');
    const horas = orden.slice(0, 3).map((f) => Number(f.h)).sort((a, c) => a - c);
    b.appendChild(h('p', null, 'Tu hora más fuerte es ' + alas(Number(pico.h)) + ' (' + Math.round(Number(pico.tickets) / total * 100) + '% de tus tickets del día).', 'margin:0 0 6px; font-weight:600;'));
    b.appendChild(h('p', 'nota', 'Ten todo listo (carne, salsas, masa, hielo) antes ' + (Math.max(0, horas[0] - 1) % 12 === 1 ? 'de la ' : 'de las ') + hora12(Math.max(0, horas[0] - 1)) + '. Tus 3 horas más movidas: ' + horas.map(hora12).join(', ') + '.'));
  }

  // ---------- 3) piezas por orden ----------
  async function pintarPiezas(cont){
    const b = bloque(cont, 'Piezas por orden', 'Cuántas piezas (tacos, rebanadas, bebidas…) pide cada cliente en un ticket. Sirve para armar combos y calcular cuánto preparar.');
    const f = h('div', null, null, 'display:flex; gap:8px; flex-wrap:wrap; align-items:center; margin-bottom:10px;');
    const cat = h('select'); cat.style.cssText = 'padding:8px 10px; border:1px solid var(--borde); border-radius:10px; background:var(--superficie); color:var(--texto); font:inherit; font-size:14px;';
    const o0 = h('option', null, 'Todos los productos'); o0.value = ''; cat.appendChild(o0);
    (enlace.categorias() || []).forEach((c) => { const o = h('option', null, c.nombre); o.value = c.id; cat.appendChild(o); });
    const dias = h('select'); dias.style.cssText = cat.style.cssText; [[7, 'Últimos 7 días'], [30, 'Últimos 30 días'], [90, 'Últimos 90 días']].forEach((x) => { const o = h('option', null, x[1]); o.value = x[0]; dias.appendChild(o); }); dias.value = '30';
    f.append(cat, dias); b.appendChild(f);
    const res = h('div'); b.appendChild(res);
    async function cargar(){
      res.textContent = ''; res.appendChild(h('p', 'nota', 'Calculando…'));
      let r; try { r = await pedir('piezas_por_orden', { p_dias: Number(dias.value), p_categoria: cat.value || null }); } catch(e){ res.textContent = ''; res.appendChild(h('p', 'nota', e.message, 'color:#b91c1c;')); return; }
      res.textContent = '';
      if(!r || !r.ordenes){ res.appendChild(h('p', 'nota', 'Sin ventas en ese periodo.')); return; }
      const k = h('div', null, null, 'display:grid; grid-template-columns:repeat(auto-fit,minmax(130px,1fr)); gap:10px; margin-bottom:12px;');
      [[fmt(r.promedio, 1), 'piezas por orden en promedio'], [fmt(r.mediana, 0), 'es lo más típico'], [fmt(r.ordenes, 0), 'órdenes revisadas']].forEach((x) => {
        const c = h('div', null, null, 'padding:12px 14px; border:1px solid var(--borde); border-radius:14px;'); c.append(h('b', null, x[0], 'display:block; font-size:24px;'), h('span', 'nota', x[1])); k.appendChild(c);
      });
      res.appendChild(k);
      const max = Math.max.apply(null, (r.buckets || []).map((x) => Number(x.ordenes)).concat([1]));
      (r.buckets || []).forEach((x) => {
        const fila = h('div', null, null, 'display:flex; align-items:center; gap:10px; margin:4px 0; font-size:13px;');
        fila.appendChild(h('span', null, (Number(x.n) >= 8 ? '8 o más' : x.n + (Number(x.n) === 1 ? ' pieza' : ' piezas')), 'width:70px; flex:none;'));
        const bar = h('div', null, null, 'flex:1; height:10px; border-radius:99px; background:var(--vid2); overflow:hidden;'); bar.appendChild(h('i', null, null, 'display:block; height:100%; width:' + Math.round(Number(x.ordenes) / max * 100) + '%; background:var(--acento);'));
        fila.append(bar, h('span', null, fmt(x.ordenes, 0) + ' órdenes', 'width:90px; text-align:right; flex:none;')); res.appendChild(fila);
      });
    }
    cat.onchange = cargar; dias.onchange = cargar; await cargar();
  }

  // ---------- 4) trompo y carne ----------
  async function pintarCarne(cont, insumosDisp){
    const b = bloque(cont, 'Trompo y carne del día', 'Anota cuánto cargaste al empezar y cuánto sobró al cerrar. Te digo si se gastó más de lo que vendiste (porciones grandes, merma, desperdicio).');
    let lista = insumosDisp || [];
    if(!lista.length){ try { const d = await pedir('prepara_hoy', { p_semanas: 6 }); lista = (d && d.insumos) || []; } catch(e){ b.appendChild(h('p', 'nota', e.message, 'color:#b91c1c;')); return; } }
    if(!lista.length){ b.appendChild(h('p', 'nota', 'Primero da de alta tus insumos (por ejemplo "Carne al pastor") en Recetas e insumos.')); return; }
    const f = h('div', null, null, 'display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:10px; align-items:end;');
    const sel = h('select'); sel.style.cssText = 'width:100%; padding:9px 11px; border:1px solid var(--borde); border-radius:10px; background:var(--superficie); color:var(--texto); font:inherit; font-size:14px;';
    lista.slice().sort((a, c) => String(a.nombre).localeCompare(c.nombre)).forEach((i) => { const o = h('option', null, i.nombre + ' (' + unidad(i.unidad) + ')'); o.value = i.insumo_id; sel.appendChild(o); });
    const campo = (et, ph) => { const w = h('div', 'campo'); w.appendChild(h('label', null, et)); const i = h('input'); i.type = 'text'; i.inputMode = 'decimal'; i.placeholder = ph; w.appendChild(i); return { w, i }; };
    const ins = h('div', 'campo'); ins.append(h('label', null, 'Insumo'), sel);
    const c1 = campo('Cargué hoy', 'Ej. 12'), c2 = campo('Sobró', 'Al cerrar');
    f.append(ins, c1.w, c2.w); b.appendChild(f);
    const acc = h('div', null, null, 'margin-top:10px;');
    acc.appendChild(boton('Guardar', async () => {
      const car = c1.i.value.trim() === '' ? null : num(c1.i.value), sob = c2.i.value.trim() === '' ? null : num(c2.i.value);
      if((car != null && !(car >= 0)) || (sob != null && !(sob >= 0)) || (car == null && sob == null)){ enlace.aviso('Escribe cuánto cargaste o cuánto sobró (un número, 0 o más).'); return; }
      await pedir('carga_registrar', { p_insumo: sel.value, p_cargado: car, p_sobrante: sob, p_nota: null });
      c1.i.value = ''; c2.i.value = ''; await historial();
    }, 'principal'));
    b.appendChild(acc);
    const hist = h('div', null, null, 'margin-top:14px;'); b.appendChild(hist);
    async function historial(){
      hist.textContent = '';
      let rows; try { rows = await pedir('cargas_resumen', { p_dias: 30 }); } catch(e){ hist.appendChild(h('p', 'nota', e.message, 'color:#b91c1c;')); return; }
      if(!rows || !rows.length){ hist.appendChild(h('p', 'nota', 'Aún no hay cargas registradas.')); return; }
      const t = tabla(['Día', 'Insumo', 'Cargué', 'Sobró', 'Se gastó', 'Según ventas', 'Diferencia']);
      rows.slice(0, 30).forEach((r) => {
        const tr = h('tr'), u = ' ' + unidad(r.unidad);
        celda(tr, String(r.dia).split('-').reverse().slice(0, 2).join('/')); celda(tr, r.nombre, 'font-weight:600;'); celda(tr, fmt(r.cargado, 2) + u);
        celda(tr, r.sobrante == null ? 'Falta anotar' : fmt(r.sobrante, 2) + u, r.sobrante == null ? 'color:#d97706;' : '');
        if(r.real == null){ celda(tr, '—'); celda(tr, fmt(r.teorico, 2) + u); celda(tr, '—'); }
        else {
          const dif = Number(r.real) - Number(r.teorico), pct = Number(r.teorico) > 0 ? dif / Number(r.teorico) * 100 : null;
          celda(tr, fmt(r.real, 2) + u); celda(tr, Number(r.teorico) > 0 ? fmt(r.teorico, 2) + u : 'Sin receta en lo vendido');
          const malo = pct != null && pct > 10, c = celda(tr, pct == null ? '—' : (dif > 0 ? '+' : '') + fmt(dif, 2) + u + ' (' + (pct > 0 ? '+' : '') + fmt(pct, 0) + '%)');
          c.style.cssText = 'font-weight:600; color:' + (malo ? '#dc2626' : '#16a34a') + ';';
        }
        t.tb.appendChild(tr);
      });
      hist.appendChild(t.wrap);
      hist.appendChild(h('p', 'nota', 'Rojo: se gastó más de 10% arriba de lo que dicen tus ventas y recetas. Revisa porciones, desperdicio o ventas sin cobrar.', 'margin-top:8px;'));
    }
    await historial();
  }

  async function abrir(cont){
    if(!cont) return;
    cont.textContent = '';
    cont.appendChild(h('p', 'nota', 'Cargando…'));
    const aqui = h('div');
    const d = await pintarHoy(aqui);
    if(d && d.dow != null) await pintarHorario(aqui, d.dow);
    await pintarPiezas(aqui);
    await pintarCarne(aqui, d && d.insumos);
    cont.textContent = ''; cont.appendChild(aqui);
  }

  window.PuvePrepara = {
    enlazar(o){ enlace = Object.assign(enlace, o || {}); },
    abrir(){ return abrir(document.getElementById('vistaInventarioPrepara')); }
  };
})();
