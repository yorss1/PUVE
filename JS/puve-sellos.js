/* PUVE - Tarjeta de sellos digital (por teléfono del cliente).
 * Caja: al consultar un teléfono se ve su tarjeta y se puede canjear el premio; al cobrar con teléfono se suma un sello.
 * Configuración → Funciones: el encargado la enciende y elige cuántos sellos, qué premio y desde qué monto de compra cuenta.
 * Todo pasa por funciones del servidor (sellos_*): la caja nunca escribe las tablas directo.
 */
(function(){
  'use strict';
  let enlace = { sb: null, aviso: (m) => alert(m), dinero: (n) => '$' + Number(n).toFixed(2) };
  let cfg = { activo: false, meta: 8, premio: 'Un producto gratis', minimo: 0 };

  function h(tag, cls, txt, estilo){ const e = document.createElement(tag); if(cls) e.className = cls; if(txt != null) e.textContent = txt; if(estilo) e.style.cssText = estilo; return e; }
  const soloDigitos = (t) => String(t || '').replace(/\D/g, '');
  function tarjetaTexto(sellos, meta){ let s = ''; for(let i = 0; i < meta; i++) s += i < sellos ? '●' : '○'; return s; }
  function telWhatsapp(t){ const d = soloDigitos(t); return d.length === 10 ? '52' + d : d; }
  async function rpc(nombre, args){
    const r = await enlace.sb.rpc(nombre, args || {});
    if(r.error){
      if(/does not exist|schema cache|Could not find/i.test(r.error.message || '')) throw new Error('Falta ejecutar el script SQL 105 en Supabase.');
      throw new Error(r.error.message);
    }
    return r.data;
  }

  async function cargar(){
    try { const d = await rpc('sellos_config_obtener'); if(d) cfg = Object.assign({ activo: false, meta: 8, premio: 'Un producto gratis', minimo: 0 }, d); }
    catch(e){ cfg.activo = false; }
    return cfg;
  }

  // ---------- caja: ver la tarjeta del cliente y canjear ----------
  async function consultar(telefono){
    const caja = document.getElementById('infoSellosCliente');
    if(!caja) return;
    caja.textContent = '';
    if(!cfg.activo || !soloDigitos(telefono)){ caja.classList.add('oculto'); return; }
    let d;
    try { d = await rpc('sellos_consultar', { p_telefono: telefono }); } catch(e){ caja.classList.remove('oculto'); caja.textContent = e.message; return; }
    caja.classList.remove('oculto');
    if(!d || !d.activo){ caja.classList.add('oculto'); return; }
    caja.appendChild(h('div', null, 'Tarjeta de sellos', 'font-weight:600; color:var(--texto);'));
    caja.appendChild(h('div', null, tarjetaTexto(d.sellos, d.meta) + '  ' + d.sellos + ' de ' + d.meta, 'font-size:18px; letter-spacing:2px; margin:2px 0;'));
    caja.appendChild(h('div', null, d.existe ? 'Cada compra' + (Number(d.minimo) > 0 ? ' de ' + enlace.dinero(d.minimo) + ' o más' : '') + ' suma un sello. Premio al completar: ' + d.premio + '.' : 'Cliente nuevo: con esta compra empieza su tarjeta.'));
    if(Number(d.premios) > 0){
      const f = h('div', null, null, 'margin-top:6px; padding:8px 10px; border-radius:10px; background:#dcfce7; color:#166534; display:flex; gap:8px; align-items:center; flex-wrap:wrap;');
      f.appendChild(h('b', null, d.premios === 1 ? 'Tiene 1 premio: ' + d.premio : 'Tiene ' + d.premios + ' premios: ' + d.premio));
      const b = h('button', 'principal', 'Entregar premio', 'width:auto; padding:6px 12px;'); b.type = 'button';
      b.onclick = async () => {
        if(!confirm('¿Entregar "' + d.premio + '" a este cliente? Cobra aparte lo que no incluya el premio.')) return;
        b.disabled = true;
        try { await rpc('sellos_canjear', { p_telefono: telefono }); enlace.aviso('Premio entregado.'); await consultar(telefono); } catch(e){ enlace.aviso(e.message); b.disabled = false; }
      };
      f.appendChild(b); caja.appendChild(f);
    }
    if(soloDigitos(telefono).length >= 10){
      const w = h('button', 'texto', 'Mandarle su tarjeta por WhatsApp', 'width:auto; padding:4px 0; margin-top:4px; font-size:12.5px;'); w.type = 'button';
      w.onclick = () => window.open('https://wa.me/' + telWhatsapp(telefono) + '?text=' + encodeURIComponent('Tu tarjeta de sellos: ' + tarjetaTexto(d.sellos, d.meta) + ' (' + d.sellos + ' de ' + d.meta + '). Premio: ' + d.premio + '. ¡Gracias por venir!'), '_blank', 'noopener');
      caja.appendChild(w);
    }
  }

  // Después de cobrar: suma el sello y lo dice en el mensaje de la venta
  async function trasVenta(ventaId, telefono, nombre){
    if(!cfg.activo || !ventaId || !soloDigitos(telefono)) return null;
    let d;
    try { d = await rpc('sellos_sumar', { p_venta: ventaId, p_telefono: telefono, p_nombre: nombre || null }); }
    catch(e){ avisarEnVenta('No se pudo sumar el sello: ' + e.message); return null; }
    if(!d) return null;
    if(d.sumado) avisarEnVenta(d.gano_premio ? '¡Completó su tarjeta! Premio: ' + d.premio + '.' : 'Sello ' + d.sellos + ' de ' + d.meta + '.');
    else if(d.motivo === 'minimo') avisarEnVenta('No suma sello: la compra debe ser de ' + enlace.dinero(d.minimo) + ' o más.');
    return d;
  }
  function avisarEnVenta(txt){
    const m = document.getElementById('mensajeVenta'); if(!m) return;
    m.textContent = (m.textContent ? m.textContent + ' ' : '') + txt; if(!m.classList.contains('mensaje')) m.className = 'mensaje exito';
  }

  // ---------- configuración (encargado) ----------
  async function montarConfig(cont){
    if(!cont) return;
    cont.textContent = '';
    await cargar();
    const fila = h('div', 'fila-config'), izq = h('div');
    izq.appendChild(h('div', null, 'Tarjeta de sellos', 'font-weight:600; font-size:14px;'));
    izq.appendChild(h('div', 'nota', 'Cada compra con el teléfono del cliente suma un sello. Al completar la tarjeta gana un premio.', 'margin:2px 0 0;'));
    const lab = h('label', 'interruptor'), chk = h('input'); chk.type = 'checkbox'; chk.checked = !!cfg.activo; lab.append(chk, h('span', 'deslizador'));
    fila.append(izq, lab); cont.appendChild(fila);
    const caja = h('div', null, null, 'margin:0 0 16px; padding:12px; border:1px solid var(--borde); border-radius:8px;');
    const rej = h('div', 'rejilla'); rej.style.gridTemplateColumns = '1fr 1fr';
    const campo = (et, tipo, val, extra) => { const w = h('div', 'campo'); w.appendChild(h('label', null, et)); const i = h('input'); i.type = tipo; i.value = val; if(extra) Object.assign(i, extra); w.appendChild(i); rej.appendChild(w); return i; };
    const meta = campo('Sellos para ganar el premio', 'number', cfg.meta, { min: 2, max: 30, step: 1 });
    const min = campo('Compra mínima para ganar sello ($)', 'number', cfg.minimo, { min: 0, step: 1 });
    const premio = campo('Premio', 'text', cfg.premio, { maxLength: 60, placeholder: 'Ej. Café gratis' }); premio.parentNode.style.gridColumn = '1 / -1';
    caja.appendChild(rej);
    const msg = h('p', 'nota', '', 'min-height:1.2em; margin:8px 0 0;'), res = h('div');
    const guardar = h('button', 'principal', 'Guardar', 'width:auto; margin-top:8px;'); guardar.type = 'button';
    async function enviar(){
      const m = parseInt(meta.value, 10), mn = Number(min.value || 0);
      if(!(m >= 2 && m <= 30)){ msg.textContent = 'Los sellos deben ser de 2 a 30.'; return false; }
      if(!premio.value.trim()){ msg.textContent = 'Escribe cuál es el premio.'; return false; }
      if(!(mn >= 0)){ msg.textContent = 'La compra mínima no es válida.'; return false; }
      try { await rpc('sellos_configurar', { p_activo: chk.checked, p_meta: m, p_premio: premio.value.trim(), p_minimo: mn }); } catch(e){ msg.textContent = e.message; return false; }
      cfg = { activo: chk.checked, meta: m, premio: premio.value.trim(), minimo: mn }; msg.textContent = 'Guardado.'; actualizarCaja(); resumen(res); return true;
    }
    guardar.onclick = async () => { guardar.disabled = true; try { await enviar(); } finally { guardar.disabled = false; } };
    chk.onchange = async () => { caja.style.display = chk.checked ? '' : 'none'; const ok = await enviar(); if(!ok && chk.checked){ /* deja abierto para corregir */ } };
    caja.append(guardar, msg, res); cont.appendChild(caja); caja.style.display = chk.checked ? '' : 'none';
    if(chk.checked) resumen(res);
  }
  async function resumen(cont){
    cont.textContent = '';
    let d; try { d = await rpc('sellos_resumen', { p_dias: 30 }); } catch(e){ return; }
    if(!d) return;
    const k = h('div', null, null, 'display:grid; grid-template-columns:repeat(auto-fit,minmax(120px,1fr)); gap:8px; margin-top:12px;');
    [[d.tarjetas, 'tarjetas'], [d.sellos, 'sellos en 30 días'], [d.premios_ganados, 'premios ganados'], [d.premios_canjeados, 'premios entregados'], [d.por_canjear, 'por entregar']].forEach((x) => {
      const c = h('div', null, null, 'padding:10px 12px; border:1px solid var(--borde); border-radius:12px;'); c.append(h('b', null, String(x[0] == null ? 0 : x[0]), 'display:block; font-size:20px;'), h('span', 'nota', x[1])); k.appendChild(c);
    });
    cont.appendChild(k);
  }
  // Muestra u oculta el bloque de cliente en la caja según la configuración (lo llama puve.html)
  function actualizarCaja(){ try { if(typeof aplicarConfiguracionUI === 'function') aplicarConfiguracionUI(); } catch(e){} }

  window.PuveSellos = {
    enlazar(o){ enlace = Object.assign(enlace, o || {}); },
    cargar, activo: () => !!cfg.activo, consultar, trasVenta, montarConfig,
    _: { tarjetaTexto, telWhatsapp }
  };
})();
