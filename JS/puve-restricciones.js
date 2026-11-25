/* PUVE - Etapa 28.
 * Restricciones de venta configurables (alcohol, tabaco, lo que tú decidas) y verificación de edad en la caja.
 * Configuración → Funciones → «Restricciones de venta». Se guarda en la configuración del negocio (sin SQL nuevo).
 * Cada regla afecta a las categorías que elijas y puede: pedir confirmar la mayoría de edad, limitar horario y días, y cerrar fechas completas (ley seca).
 * IMPORTANTE: es un control de la CAJA, no del servidor. Ayuda a que el cajero no se salte la regla, pero no sustituye lo que pida la ley.
 */
(function(){
  'use strict';
  let enlace = { leer: () => null, guardar: async () => {}, categorias: () => [], productos: () => [], rol: () => 'admin', tienePin: () => false, pedirPin: null, avisar: () => {} };
  const TZ = 'America/Mexico_City', DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  function h(tag, cls, txt, estilo){ const e = document.createElement(tag); if(cls) e.className = cls; if(txt != null) e.textContent = txt; if(estilo) e.style.cssText = estilo; return e; }
  function boton(txt, fn, cls, estilo){ const b = h('button', cls || 'texto', txt, 'width:auto; padding:7px 12px;' + (estilo || '')); b.type = 'button'; b.onclick = fn; return b; }
  function campo(et, el, ancho){ const w = h('label', null, et, 'display:flex; flex-direction:column; gap:4px; font-size:13px; font-weight:500;' + (ancho ? 'flex:1 1 ' + ancho + 'px;' : '')); w.appendChild(el); return w; }
  const input = (v, ph, max, tipo) => { const i = h('input', 'input-mini'); if(tipo) i.type = tipo; if(v != null && v !== '') i.value = v; if(ph) i.placeholder = ph; if(max) i.maxLength = max; return i; };

  // ---------- Reglas ----------
  function reglas(){ const c = enlace.leer(); return c && Array.isArray(c.reglas) ? c.reglas : []; }
  function ahoraMX(){
    const p = {}; new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23' }).formatToParts(new Date()).forEach((x) => { p[x.type] = x.value; });
    return { fecha: p.year + '-' + p.month + '-' + p.day, min: Number(p.hour) * 60 + Number(p.minute), dia: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday) };
  }
  const aMin = (t) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(t || '')); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
  // Devuelve el motivo si la regla NO deja vender ahora, o null si sí deja.
  function motivoBloqueo(r, ahora){
    if(Array.isArray(r.fechas) && r.fechas.includes(ahora.fecha)) return r.nombre + ': hoy es una fecha sin venta.';
    if(Array.isArray(r.dias) && r.dias.length && !r.dias.includes(ahora.dia)) return r.nombre + ': hoy no está permitido vender (solo ' + r.dias.slice().sort().map((d) => DIAS[d]).join(', ') + ').';
    const d = aMin(r.desde), hh = aMin(r.hasta);
    if(d != null && hh != null && d !== hh){ const dentro = d < hh ? (ahora.min >= d && ahora.min < hh) : (ahora.min >= d || ahora.min < hh); if(!dentro) return r.nombre + ': fuera de horario (se vende de ' + r.desde + ' a ' + r.hasta + ').'; }
    return null;
  }
  function reglasDe(p){ return reglas().filter((r) => p && p.categoria_id && Array.isArray(r.categorias) && r.categorias.includes(p.categoria_id)); }

  // ---------- Ventanas ----------
  function aviso(titulo, texto, botones){
    const fondo = h('div', null, null, 'position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:100000; display:flex; align-items:center; justify-content:center; padding:16px;'), c = h('div', null, null, 'background:var(--tarjeta,#fff); color:var(--texto,#111); border-radius:14px; padding:20px; max-width:420px; width:100%; box-shadow:0 20px 50px rgba(0,0,0,.3);');
    c.setAttribute('role', 'dialog'); c.setAttribute('aria-modal', 'true'); c.appendChild(h('h3', null, titulo, 'margin:0 0 8px;')); c.appendChild(h('p', null, texto, 'margin:0 0 14px; line-height:1.4;'));
    const f = h('div', null, null, 'display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end;'); botones.forEach(([t, fn, cls]) => f.appendChild(boton(t, () => { fondo.remove(); if(fn) fn(); }, cls || 'texto'))); c.appendChild(f); fondo.appendChild(c); document.body.appendChild(fondo); const b0 = f.querySelector('button.principal') || f.querySelector('button'); if(b0) b0.focus(); return fondo;
  }

  // alAgregar: se llama al tocar un producto. Devuelve true si se hizo cargo (bloqueó o está preguntando) y la caja NO debe agregar todavía.
  let recordado = false;
  function alAgregar(p, continuar){
    const rs = reglasDe(p); if(!rs.length) return false; const ahora = ahoraMX(); rs.forEach((r) => { if(r.aviso) enlace.avisar(r.aviso); });
    for(const r of rs){ const m = motivoBloqueo(r, ahora); if(!m) continue;
      if(r.accion === 'avisar'){ enlace.avisar(m + ' Solo es un aviso.'); continue; }
      return bloquear(m, continuar); }
    if(rs.some((r) => r.edad) && !recordado){ recordado = true; enlace.avisar('Pide identificación: este producto es solo para mayores de ' + (Math.max.apply(null, rs.filter((r) => r.edad).map((r) => r.edad_min || 18))) + ' años.'); }
    return false;
  }
  function bloquear(motivo, continuar){
    if(enlace.rol() === 'admin'){ aviso('Fuera de la regla', motivo + ' Como encargado puedes continuar.', [['Cancelar'], ['Continuar de todos modos', () => continuar(), 'principal']]); return true; }
    if(enlace.tienePin() && enlace.pedirPin){ aviso('No se puede vender ahora', motivo + ' Pide al encargado que lo autorice con su PIN.', [['Cancelar'], ['Pedir autorización', () => enlace.pedirPin(motivo, () => continuar()), 'principal']]); return true; }
    aviso('No se puede vender ahora', motivo + ' Pídele al encargado que lo venda o que configure su PIN de autorización.', [['Entendido', null, 'principal']]); return true;
  }

  // alCobrar: revisa todo el carrito (cubre cualquier forma de haber agregado). Devuelve true si se hizo cargo y el cobro NO debe seguir todavía.
  function alCobrar(prods, continuar, sinAviso){
    const lista = prods.filter(Boolean); const ahora = ahoraMX(); let bloqueada = null, edad = 0, nombresEdad = [];
    if(!sinAviso){ const avs = []; lista.forEach((p) => reglasDe(p).forEach((r) => { if(r.aviso && avs.indexOf(r.aviso) < 0) avs.push(r.aviso); })); if(avs.length){ aviso('Antes de cobrar', avs.join(' '), [['Cancelar'], ['Listo, continuar', () => { if(alCobrar(prods, continuar, true) === false) continuar(); }, 'principal']]); return true; } }
    lista.forEach((p) => reglasDe(p).forEach((r) => { const m = motivoBloqueo(r, ahora); if(m && r.accion !== 'avisar' && !bloqueada) bloqueada = m; if(r.edad){ edad = Math.max(edad, r.edad_min || 18); if(!nombresEdad.includes(p.nombre)) nombresEdad.push(p.nombre); } }));
    const pedirEdad = () => { if(!edad){ continuar(); return; } aviso('Verifica la edad', 'La venta lleva ' + nombresEdad.slice(0, 3).join(', ') + (nombresEdad.length > 3 ? ' y ' + (nombresEdad.length - 3) + ' más' : '') + '. ¿Revisaste una identificación y el cliente tiene ' + edad + ' años o más?', [['No, cancelar'], ['Sí, es mayor de edad', () => { recordado = false; continuar(); }, 'principal']]); };
    if(!bloqueada){ if(!edad) return false; pedirEdad(); return true; }
    bloquear(bloqueada, pedirEdad); return true;
  }
  function nuevaVenta(){ recordado = false; }

  // ---------- Configuración ----------
  function montarConfig(div){
    if(!div) return; div.textContent = '';
    const caja = h('div', null, null, 'border:1px solid var(--borde); border-radius:10px; padding:14px; margin:8px 0 16px;');
    caja.appendChild(h('div', null, 'Restricciones de venta', 'font-weight:600; font-size:14px;')); caja.appendChild(h('div', 'nota', 'Para alcohol, tabaco o cualquier categoría con reglas: pide confirmar la mayoría de edad al cobrar y limita horario, días y fechas sin venta. Es un control de la caja, no del servidor: ayuda a que el cajero no se salte la regla, pero no sustituye lo que pida la ley.', 'margin:2px 0 10px;'));
    const cats = enlace.categorias() || []; let estado = reglas().map((r) => JSON.parse(JSON.stringify(r))); const zl = h('div'), est = h('div');
    caja.appendChild(zl); const ac = h('div', null, null, 'display:flex; gap:8px; flex-wrap:wrap; margin-top:8px;');
    ac.appendChild(boton('+ Alcohol', () => { estado.push({ nombre: 'Alcohol', categorias: [], edad: true, edad_min: 18, desde: '10:00', hasta: '22:00', dias: [], fechas: [], accion: 'bloquear' }); pinta(); }));
    ac.appendChild(boton('+ Tabaco', () => { estado.push({ nombre: 'Tabaco', categorias: [], edad: true, edad_min: 18, desde: '', hasta: '', dias: [], fechas: [], accion: 'bloquear' }); pinta(); }));
    ac.appendChild(boton('+ Receta médica', () => { estado.push({ nombre: 'Receta médica', categorias: [], edad: false, edad_min: 18, desde: '', hasta: '', dias: [], fechas: [], accion: 'avisar', aviso: 'Pide la receta médica antes de vender.' }); pinta(); }));
    ac.appendChild(boton('+ Otra regla', () => { estado.push({ nombre: 'Regla nueva', categorias: [], edad: false, edad_min: 18, desde: '', hasta: '', dias: [], fechas: [], accion: 'bloquear' }); pinta(); }));
    ac.appendChild(boton('Guardar reglas', async () => { if(estado.length > 8){ est.textContent = 'Máximo 8 reglas.'; return; } for(const r of estado){ if(!r.nombre.trim()){ est.textContent = 'Cada regla necesita un nombre.'; return; } if(!r.categorias.length){ est.textContent = 'La regla «' + r.nombre + '» no tiene categorías. Elige al menos una.'; return; } if((r.desde && !r.hasta) || (!r.desde && r.hasta)){ est.textContent = 'En «' + r.nombre + '» llena la hora de inicio y la de fin, o deja las dos vacías.'; return; } }
      try { await enlace.guardar({ reglas: estado.map((r) => ({ nombre: r.nombre.trim().slice(0, 40), categorias: r.categorias, edad: !!r.edad, edad_min: Math.min(Math.max(Number(r.edad_min) || 18, 1), 99), desde: r.desde || '', hasta: r.hasta || '', dias: r.dias, fechas: r.fechas.slice(0, 60), accion: r.accion === 'avisar' ? 'avisar' : 'bloquear', aviso: String(r.aviso || '').trim().slice(0, 140) })) }); est.textContent = 'Guardado.'; est.style.color = '#16a34a'; } catch(e){ est.textContent = 'No se pudo guardar: ' + ((e && e.message) || e); est.style.color = 'var(--error,#b91c1c)'; } }, 'principal'));
    caja.appendChild(ac); est.style.cssText = 'font-size:13px; margin:8px 0; color:var(--error,#b91c1c);'; caja.appendChild(est); div.appendChild(caja);
    function pinta(){
      zl.textContent = ''; if(!estado.length) zl.appendChild(h('p', 'nota', 'No hay reglas. Agrega una con los botones de abajo.'));
      if(!cats.length) zl.appendChild(h('p', 'nota', 'Primero crea categorías en Productos (por ejemplo «Cervezas» o «Cigarros»): las reglas se aplican por categoría.', 'color:var(--error,#b91c1c);'));
      estado.forEach((r, idx) => {
        const b = h('div', null, null, 'border:1px solid var(--borde); border-radius:10px; padding:10px 12px; margin-bottom:10px;'), nm = input(r.nombre, 'Nombre de la regla', 40); nm.oninput = () => { r.nombre = nm.value; };
        const top = h('div', null, null, 'display:flex; gap:8px; align-items:flex-end; flex-wrap:wrap;'); top.appendChild(campo('Nombre', nm, 200)); top.appendChild(boton('Quitar regla', () => { estado.splice(idx, 1); pinta(); })); b.appendChild(top);
        b.appendChild(h('div', 'nota', 'Categorías que cubre:', 'margin:8px 0 4px;')); const cc = h('div', null, null, 'display:flex; gap:10px; flex-wrap:wrap;'); cats.forEach((c) => { const l = h('label', null, null, 'display:flex; gap:5px; align-items:center; font-size:13.5px;'), k = h('input'); k.type = 'checkbox'; k.checked = r.categorias.includes(c.id); k.style.cssText = 'width:16px; height:16px; margin:0;'; k.onchange = () => { r.categorias = k.checked ? r.categorias.concat(c.id) : r.categorias.filter((x) => x !== c.id); }; l.appendChild(k); l.appendChild(h('span', null, c.nombre)); cc.appendChild(l); }); b.appendChild(cc);
        const le = h('label', null, null, 'display:flex; gap:8px; align-items:center; font-size:13.5px; margin-top:10px;'), ke = h('input'); ke.type = 'checkbox'; ke.checked = !!r.edad; ke.style.cssText = 'width:18px; height:18px; margin:0;'; const em = input(r.edad_min || 18, '', 2, 'number'); em.style.width = '64px'; em.min = '1'; em.max = '99'; em.oninput = () => { r.edad_min = Number(em.value) || 18; }; ke.onchange = () => { r.edad = ke.checked; }; le.appendChild(ke); le.appendChild(h('span', null, 'Al cobrar, preguntar si el cliente tiene al menos')); le.appendChild(em); le.appendChild(h('span', null, 'años')); b.appendChild(le);
        const d = input(r.desde, '', 5, 'time'), hh = input(r.hasta, '', 5, 'time'); d.oninput = () => { r.desde = d.value; }; hh.oninput = () => { r.hasta = hh.value; }; const fh = h('div', null, null, 'display:flex; gap:10px; flex-wrap:wrap; margin-top:10px;'); fh.appendChild(campo('Se puede vender desde (hora)', d, 160)); fh.appendChild(campo('hasta (hora)', hh, 130)); b.appendChild(fh); b.appendChild(h('div', 'nota', 'Deja las horas vacías si no hay límite. Si pones, por ejemplo, de 22:00 a 06:00, la regla cruza la medianoche. Hora de la Ciudad de México.'));
        b.appendChild(h('div', 'nota', 'Días en que SÍ se puede vender (ninguno marcado = todos):', 'margin:8px 0 4px;')); const dd = h('div', null, null, 'display:flex; gap:10px; flex-wrap:wrap;'); DIAS.forEach((n, i) => { const l = h('label', null, null, 'display:flex; gap:4px; align-items:center; font-size:13.5px;'), k = h('input'); k.type = 'checkbox'; k.checked = r.dias.includes(i); k.style.cssText = 'width:16px; height:16px; margin:0;'; k.onchange = () => { r.dias = k.checked ? r.dias.concat(i) : r.dias.filter((x) => x !== i); }; l.appendChild(k); l.appendChild(h('span', null, n)); dd.appendChild(l); }); b.appendChild(dd);
        b.appendChild(h('div', 'nota', 'Fechas sin venta (ley seca, elecciones):', 'margin:8px 0 4px;')); const zf = h('div', null, null, 'display:flex; gap:6px; flex-wrap:wrap; align-items:center;'); const pf = () => { zf.textContent = ''; r.fechas.slice().sort().forEach((f) => { const ch = h('span', null, null, 'display:inline-flex; gap:4px; align-items:center; background:#e2e8f0; color:#0f172a; border-radius:6px; padding:2px 8px; font-size:12.5px;'); ch.appendChild(h('span', null, f)); const x = h('button', null, '×', 'border:0; background:transparent; cursor:pointer; font-size:15px; padding:0 2px;'); x.type = 'button'; x.setAttribute('aria-label', 'Quitar ' + f); x.onclick = () => { r.fechas = r.fechas.filter((y) => y !== f); pf(); }; ch.appendChild(x); zf.appendChild(ch); });
          const fi = input('', '', 10, 'date'); zf.appendChild(fi); zf.appendChild(boton('Agregar fecha', () => { if(fi.value && !r.fechas.includes(fi.value)) { r.fechas.push(fi.value); pf(); } }, 'texto', 'padding:4px 10px;')); }; pf(); b.appendChild(zf);
        const ac2 = sel2(r); b.appendChild(campo('Si se intenta vender fuera de la regla', ac2, 300)); const av = input(r.aviso || '', 'Ej. Pide la receta médica', 140); av.oninput = () => { r.aviso = av.value; }; const fav = campo('Recordatorio en caja (opcional): se muestra al agregar y antes de cobrar', av, 300); fav.style.marginTop = '10px'; b.appendChild(fav); zl.appendChild(b);
      });
    }
    function sel2(r){ const s = h('select', 'input-mini'); [['bloquear', 'Bloquear (el cajero necesita el PIN del encargado)'], ['avisar', 'Solo avisar y dejar vender']].forEach(([v, t]) => { const o = h('option', null, t); o.value = v; s.appendChild(o); }); s.value = r.accion === 'avisar' ? 'avisar' : 'bloquear'; s.onchange = () => { r.accion = s.value; }; return s; }
    pinta();
  }

  window.PuveRestricciones = { enlazar(o){ enlace = Object.assign(enlace, o || {}); }, alAgregar, alCobrar, nuevaVenta, montarConfig, _motivoBloqueo: motivoBloqueo };
})();
