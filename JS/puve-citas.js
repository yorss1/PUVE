/* PUVE - Agenda extra (debajo de la agenda): recordatorio por WhatsApp, lista de espera, próxima cita sugerida y ocupación por hora.
 * Datos: tabla citas (lectura) y funciones del SQL 123. PUVE NO manda mensajes solo: abre WhatsApp con el texto escrito y tú lo envías.
 * La ocupación cuenta minutos con cita entre empleados activos y semanas; no usa horario laboral (usa las horas con citas).
 */
(function(){
  'use strict';
  let enlace = { sb: null, negocio: () => '' };
  const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  function h(tag, cls, txt, estilo){ const e = document.createElement(tag); if(cls) e.className = cls; if(txt != null) e.textContent = txt; if(estilo) e.style.cssText = estilo; return e; }
  function boton(txt, fn, cls, estilo){ const b = h('button', cls || 'texto', txt, 'width:auto; padding:7px 12px;' + (estilo || '')); b.type = 'button'; b.onclick = fn; return b; }
  function campo(et, el, ancho){ const w = h('label', null, et, 'display:flex; flex-direction:column; gap:4px; font-size:13px; font-weight:500;' + (ancho ? 'flex:1 1 ' + ancho + 'px;' : '')); w.appendChild(el); return w; }
  const input = (ph, max) => { const i = h('input', 'input-mini'); if(ph) i.placeholder = ph; if(max) i.maxLength = max; return i; };
  const sel = (ops) => { const s = h('select', 'input-mini'); ops.forEach(([v, t]) => { const o = h('option', null, t); o.value = v; s.appendChild(o); }); return s; };
  const msg = (z, t, ok) => { z.textContent = t; z.style.cssText = 'font-size:13px; margin:8px 0; color:' + (ok ? '#16a34a' : 'var(--error,#b91c1c)') + ';'; };
  function errTxt(e){ const m = (e && e.message) || String(e); return /does not exist|schema cache|Could not find/i.test(m) ? 'Falta ejecutar el script SQL 123 en Supabase.' : m; }
  async function rpc(f, a){ const r = await enlace.sb.rpc(f, a); if(r.error) throw r.error; return r.data; }
  const hora = (d) => new Date(d).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  const fechaCorta = (d) => new Date(d).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
  function wa(tel, texto){ let d = String(tel || '').replace(/\D/g, ''); if(d.length === 10) d = '52' + d; else if(d.length === 13 && d.startsWith('521')) d = '52' + d.slice(3); if(d.length < 11){ window.alert('El teléfono no parece válido para WhatsApp.'); return false; } window.open('https://wa.me/' + d + '?text=' + encodeURIComponent(texto), '_blank', 'noopener'); return true; }
  const nombreNeg = () => { try { return enlace.negocio() || ''; } catch(e){ return ''; } };
  let raiz = null, zona = null, tab = 'recordar';
  const TABS = [['recordar', 'Recordatorios'], ['espera', 'Lista de espera'], ['proxima', 'Próxima cita'], ['ocupacion', 'Ocupación']];
  function abrir(){ raiz = raiz || document.getElementById('agendaExtras'); if(!raiz) return; raiz.textContent = '';
    const bar = h('div', null, null, 'display:flex; gap:6px; flex-wrap:wrap; margin-bottom:10px;'); const bs = {};
    TABS.forEach(([k, t]) => { const b = boton(t, () => { tab = k; Object.keys(bs).forEach((x) => { bs[x].style.fontWeight = x === k ? '700' : '400'; }); pintar(); }); bs[k] = b; bar.appendChild(b); }); bs[tab].style.fontWeight = '700';
    raiz.appendChild(h('h3', null, 'Más para tu agenda', 'margin:0 0 8px;')); raiz.appendChild(bar); zona = h('div'); raiz.appendChild(zona); pintar(); }
  function pintar(){ zona.textContent = ''; ({ recordar, espera, proxima, ocupacion })[tab](zona); }

  async function recordar(z){
    const dia = sel([['0', 'Hoy'], ['1', 'Mañana']]); dia.value = '1'; z.appendChild(campo('Citas de', dia, 140)); const lz = h('div', null, null, 'margin-top:10px;'); z.appendChild(lz);
    const cargar = async () => { lz.textContent = ''; const a = new Date(); a.setHours(0, 0, 0, 0); a.setDate(a.getDate() + Number(dia.value)); const b = new Date(a); b.setDate(b.getDate() + 1);
      const r = await enlace.sb.from('citas').select('id,servicio_nombre,cliente_nombre,cliente_telefono,inicio,recordada_en').eq('estado', 'agendada').gte('inicio', a.toISOString()).lt('inicio', b.toISOString()).order('inicio');
      if(r.error){ msg(lz, errTxt(r.error)); return; } if(!r.data.length){ lz.appendChild(h('p', 'nota', 'No hay citas agendadas ese día.')); return; }
      r.data.forEach((c) => { const f = h('div', null, null, 'display:flex; gap:8px; align-items:center; flex-wrap:wrap; padding:7px 0; border-top:1px solid var(--borde);');
        f.appendChild(h('strong', null, hora(c.inicio) + ' · ' + c.cliente_nombre, 'flex:1 1 180px;')); f.appendChild(h('span', 'nota', c.servicio_nombre));
        if(!c.cliente_telefono) f.appendChild(h('span', 'nota', 'Sin teléfono')); else { const bt = boton(c.recordada_en ? 'Recordar otra vez' : 'Recordar por WhatsApp', async () => { const dtxt = Number(dia.value) === 0 ? 'hoy' : 'mañana'; const ok = wa(c.cliente_telefono, 'Hola ' + c.cliente_nombre + ' 👋 te recordamos tu cita de ' + c.servicio_nombre + ' ' + dtxt + ' a las ' + hora(c.inicio) + (nombreNeg() ? ' en ' + nombreNeg() : '') + '. ¿Nos confirmas tu asistencia?'); if(ok){ try { await rpc('cita_marcar_recordada', { p_id: c.id }); } catch(e){} bt.textContent = 'Recordada ✓'; } }); f.appendChild(bt); }
        if(c.recordada_en) f.appendChild(h('span', 'nota', 'Recordada ' + fechaCorta(c.recordada_en) + ' ' + hora(c.recordada_en))); lz.appendChild(f); }); };
    dia.onchange = cargar; await cargar();
  }

  async function espera(z){
    const nom = input('Nombre del cliente', 80), tel = input('Teléfono (10 dígitos)', 20), ser = input('Servicio que quiere', 120), pre = input('Prefiere (día, hora o persona)', 120), est = h('div');
    const f = h('div', null, null, 'display:flex; gap:10px; flex-wrap:wrap; align-items:end; margin-bottom:6px;'); [campo('Cliente', nom, 160), campo('Teléfono', tel, 140), campo('Servicio', ser, 160), campo('Preferencia', pre, 180)].forEach((x) => f.appendChild(x));
    f.appendChild(boton('Agregar a la espera', async () => { if(!nom.value.trim()) return msg(est, 'Escribe el nombre.'); try { await rpc('espera_agregar', { p_cliente: nom.value.trim(), p_telefono: tel.value.trim() || null, p_servicio: ser.value.trim() || null, p_preferencia: pre.value.trim() || null }); pintar(); } catch(e){ msg(est, errTxt(e)); } }, 'principal')); z.appendChild(f); z.appendChild(est);
    z.appendChild(h('p', 'nota', 'Cuando se libere un espacio, avisa al primero de la lista por WhatsApp (tú envías el mensaje).', 'margin:0 0 8px;'));
    try { const l = await rpc('espera_lista'); if(!l.length){ z.appendChild(h('p', 'nota', 'La lista de espera está vacía.')); return; }
      l.forEach((x, i) => { const r = h('div', null, null, 'display:flex; gap:8px; align-items:center; flex-wrap:wrap; padding:7px 0; border-top:1px solid var(--borde);');
        r.appendChild(h('strong', null, (i + 1) + '. ' + x.cliente, 'flex:1 1 160px;')); r.appendChild(h('span', 'nota', [x.servicio, x.preferencia, 'desde ' + fechaCorta(x.creado_en)].filter(Boolean).join(' · '))); if(x.estado === 'avisado') r.appendChild(h('span', null, 'Avisado', 'background:#fef3c7; color:#92400e; border-radius:6px; padding:2px 8px; font-size:12px; font-weight:700;'));
        if(x.telefono) r.appendChild(boton('Avisar por WhatsApp', async () => { if(wa(x.telefono, 'Hola ' + x.cliente + ' 👋 se liberó un espacio' + (x.servicio ? ' para ' + x.servicio : '') + (nombreNeg() ? ' en ' + nombreNeg() : '') + '. ¿Lo quieres? Respóndenos y te lo apartamos.')){ try { await rpc('espera_estado', { p_id: x.id, p_estado: 'avisado' }); } catch(e){} pintar(); } }));
        r.appendChild(boton('Ya se atendió', async () => { try { await rpc('espera_estado', { p_id: x.id, p_estado: 'atendido' }); pintar(); } catch(e){ msg(est, errTxt(e)); } })); r.appendChild(boton('Quitar', async () => { try { await rpc('espera_estado', { p_id: x.id, p_estado: 'quitado' }); pintar(); } catch(e){ msg(est, errTxt(e)); } })); z.appendChild(r); });
    } catch(e){ msg(z, errTxt(e)); }
  }

  async function proxima(z){
    const sem = sel([['3', '3 semanas'], ['4', '4 semanas'], ['6', '6 semanas'], ['8', '8 semanas']]); sem.value = '4'; z.appendChild(campo('Sin venir desde hace', sem, 160)); const lz = h('div', null, null, 'margin-top:10px;'); z.appendChild(lz);
    const cargar = async () => { lz.textContent = ''; try { const l = await rpc('citas_por_reagendar', { p_semanas: Number(sem.value) }); if(!l.length){ lz.appendChild(h('p', 'nota', 'Nadie por reagendar con esos filtros. Solo cuentan clientes con teléfono y citas marcadas como atendidas.')); return; }
      l.forEach((c) => { const r = h('div', null, null, 'display:flex; gap:8px; align-items:center; flex-wrap:wrap; padding:7px 0; border-top:1px solid var(--borde);'); r.appendChild(h('strong', null, c.cliente, 'flex:1 1 160px;')); r.appendChild(h('span', 'nota', c.servicio + ' · última vez ' + fechaCorta(c.ultima) + ' · ' + c.veces + (c.veces === 1 ? ' visita' : ' visitas')));
        r.appendChild(boton('Invitar por WhatsApp', () => { wa(c.telefono, 'Hola ' + c.cliente + ' 👋 ya toca tu próximo ' + c.servicio + (nombreNeg() ? ' en ' + nombreNeg() : '') + '. ¿Te agendamos esta semana?'); })); lz.appendChild(r); }); } catch(e){ msg(lz, errTxt(e)); } };
    sem.onchange = cargar; await cargar();
  }

  async function ocupacion(z){
    const per = sel([['28', 'Últimas 4 semanas'], ['56', 'Últimas 8 semanas']]); z.appendChild(campo('Periodo', per, 160)); const lz = h('div', null, null, 'margin-top:10px;'); z.appendChild(lz);
    const cargar = async () => { lz.textContent = ''; try { const r = await rpc('citas_ocupacion', { p_dias: Number(per.value) }); if(!r.celdas.length || !r.empleados){ lz.appendChild(h('p', 'nota', 'Todavía no hay citas en este periodo para medir la ocupación.')); return; }
      const mapa = {}; let hmin = 24, hmax = 0; r.celdas.forEach((c) => { mapa[c.dow + '-' + c.hora] = c.minutos; hmin = Math.min(hmin, c.hora); hmax = Math.max(hmax, c.hora); });
      const base = r.empleados * Math.max(1, Number(r.semanas)) * 60; const w = h('div', 'envoltura-tabla'), t = h('table'), th = h('thead'), tr0 = h('tr'); tr0.appendChild(h('th', null, 'Hora')); DIAS.forEach((d) => tr0.appendChild(h('th', null, d))); th.appendChild(tr0); t.appendChild(th); const tb = h('tbody');
      for(let hh = hmin; hh <= hmax; hh++){ const tr = h('tr'); tr.appendChild(h('td', null, String(hh).padStart(2, '0') + ':00', 'font-weight:600;')); for(let d = 1; d <= 7; d++){ const p = Math.min(100, Math.round(((mapa[d + '-' + hh] || 0) / base) * 100)); const td = h('td', null, p ? p + '%' : '·', 'text-align:center; background:rgba(37,99,235,' + (p / 130).toFixed(2) + ');'); tr.appendChild(td); } tb.appendChild(tr); }
      t.appendChild(tb); w.appendChild(t); lz.appendChild(w); lz.appendChild(h('p', 'nota', '% de la hora con cita, entre ' + r.empleados + ' empleado(s) activo(s) y el promedio por semana. Las horas flojas son buenas para promociones; las llenas, para pedir cita con anticipo.', 'margin-top:6px;')); } catch(e){ msg(lz, errTxt(e)); } };
    per.onchange = cargar; await cargar();
  }
  window.PuveCitas = { enlazar(o){ enlace = Object.assign(enlace, o || {}); }, abrir };
})();
