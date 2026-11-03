/* PUVE - Tarjeta de sellos digital (por teléfono del cliente).
 * Caja: al consultar un teléfono se ve su tarjeta y se puede canjear el premio; al cobrar con teléfono se suma un sello.
 * Configuración → Funciones: el encargado la enciende y elige cuántos sellos, qué premio y desde qué monto de compra cuenta.
 * Todo pasa por funciones del servidor (sellos_*): la caja nunca escribe las tablas directo.
 */
(function(){
  'use strict';
  let enlace = { sb: null, aviso: (m) => alert(m), dinero: (n) => '$' + Number(n).toFixed(2) };
  let cfg = { activo: false, meta: 8, premio: 'Un producto gratis', minimo: 0, diseno: {}, negocio: '', subgiro: '', giro: '' };
  let walletDisponible = true;   // se apaga solo si el servidor dice que no hay Google Wallet configurado
  const GIRO_POR_FAMILIA = { restaurante: 'restaurantes', cafeteria: 'cafeterias', tienda: 'abarrotes', ropa: 'ropa', ferreteria: 'ferreteria', papeleria: 'papelerias', farmacia: 'farmacias', servicios: 'estetica' };
  const giroActual = () => (window.PuveTarjeta && PuveTarjeta.GIROS[cfg.subgiro]) ? cfg.subgiro : (GIRO_POR_FAMILIA[cfg.giro] || 'restaurantes');
  function svgTarjeta(cara, sellos, premios, extra){
    if(!window.PuveTarjeta) return '';
    return PuveTarjeta.svg(Object.assign({ nombre: cfg.negocio, giro: giroActual(), diseno: cfg.diseno, meta: cfg.meta, sellos: sellos || 0, premios: premios || 0, premio: cfg.premio, cara }, extra || {}));
  }
  const enlaceTarjeta = (token) => location.origin + '/tarjeta.html?t=' + token;
  function textoWhatsapp(token, nombre){
    return (nombre ? 'Hola ' + String(nombre).split(' ')[0] + ', ' : 'Hola, ') + 'esta es tu tarjeta de sellos de ' + (cfg.diseno && cfg.diseno.nombre || cfg.negocio || 'nuestro negocio') + ': ' + enlaceTarjeta(token) +
      '\nGuárdala: se actualiza sola con cada compra. Con ' + cfg.meta + ' sellos ganas: ' + cfg.premio + '.';
  }

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
    try { const d = await rpc('sellos_config_obtener'); if(d) cfg = Object.assign({ activo: false, meta: 8, premio: 'Un producto gratis', minimo: 0, diseno: {}, negocio: '', subgiro: '', giro: '' }, d); }
    catch(e){ cfg.activo = false; }
    escucharLector();
    return cfg;
  }

  // ---------- caja: identificar al cliente con el QR de su tarjeta (Google Wallet, pantalla del celular o lector USB) ----------
  const tokenDe = (txt) => { const m = String(txt || '').match(/(?:[?&#]t=|^)([0-9a-f]{32})(?![0-9a-f])/i); return m ? m[1].toLowerCase() : null; };
  async function identificarToken(token){
    let d;
    try { d = await rpc('sellos_por_token', { p_token: token }); } catch(e){ enlace.aviso(/does not exist|schema cache/i.test(e.message) ? 'Falta ejecutar el script SQL 107 en Supabase.' : e.message); return false; }
    if(!d){ enlace.aviso('Esta tarjeta no es de tu negocio o ya no está activa.'); return false; }
    const bloque = document.getElementById('bloqueClienteVenta'); if(bloque) bloque.classList.remove('oculto');
    const tel = document.getElementById('recompensaTelefono'), nom = document.getElementById('clienteNombreVenta');
    if(tel) tel.value = d.telefono;
    if(nom && d.nombre){ nom.classList.remove('oculto'); nom.value = d.nombre; }
    if(typeof consultarPuntosCliente === 'function') { try { consultarPuntosCliente(); } catch(e){} } else consultar(d.telefono);
    return true;
  }
  function escanear(){
    if(typeof enlace.escanear !== 'function' || !enlace.escaner || !enlace.escaner()){
      // Sin cámara: el lector USB escribe el código en el campo del teléfono y el cliente se identifica solo
      const tel = document.getElementById('recompensaTelefono'); if(tel){ tel.value = ''; tel.focus(); tel.placeholder = 'Lee el QR con tu lector USB…'; }
      enlace.aviso('Este equipo no tiene lector de cámara. Con un lector USB, apúntalo al QR de la tarjeta (el cursor ya está en el campo). También puedes escribir el teléfono del cliente.'); return;
    }
    enlace.escanear((texto) => { const tk = tokenDe(texto); if(!tk){ enlace.aviso('Ese código no es una tarjeta de sellos.'); return; } identificarToken(tk); });
  }
  let escuchando = false;
  function escucharLector(){
    if(escuchando) return; const tel = document.getElementById('recompensaTelefono'); if(!tel) return; escuchando = true;
    tel.addEventListener('input', () => { const tk = tokenDe(tel.value); if(tk && /tarjeta|t=/i.test(tel.value) || (tk && tel.value.trim().length === 32)){ tel.value = ''; identificarToken(tk); } });
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
    caja.appendChild(h('div', null, 'Tarjeta de sellos' + (d.nombre ? ' de ' + d.nombre : ''), 'font-weight:600; color:var(--texto);'));
    if(window.PuveTarjeta){ const mini = h('div', null, null, 'max-width:300px; margin:6px 0; line-height:0; border-radius:14px; overflow:hidden; box-shadow:0 4px 14px rgba(0,0,0,.18);'); mini.innerHTML = svgTarjeta('dorso', d.sellos, d.premios); caja.appendChild(mini); }
    caja.appendChild(h('div', null, d.sellos + ' de ' + d.meta, 'font-size:16px; font-weight:600; margin:2px 0;'));
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
    if(d.existe) botonesEnvio(caja, telefono, d.nombre, d.sellos, d.premios);
  }
  // Mandar la tarjeta del cliente: enlace por WhatsApp (se actualiza sola) o imagen con el menú de compartir del celular
  async function botonesEnvio(cont, telefono, nombre, sellos, premios){
    let token = null;
    try { token = await rpc('sellos_enlace', { p_telefono: telefono }); } catch(e){ return; }
    if(!token) return;
    const fila = h('div', null, null, 'display:flex; gap:8px; flex-wrap:wrap; margin-top:6px;');
    if(soloDigitos(telefono).length >= 10){
      const w = h('button', 'principal', 'Mandar su tarjeta por WhatsApp', 'width:auto; padding:6px 12px; font-size:13px;'); w.type = 'button';
      w.onclick = () => window.open('https://wa.me/' + telWhatsapp(telefono) + '?text=' + encodeURIComponent(textoWhatsapp(token, nombre)), '_blank', 'noopener');
      fila.appendChild(w);
    }
    const c = h('button', 'texto', 'Copiar enlace', 'width:auto; padding:6px 4px; font-size:13px;'); c.type = 'button';
    c.onclick = async () => { try { await navigator.clipboard.writeText(enlaceTarjeta(token)); enlace.aviso('Enlace copiado.'); } catch(e){ enlace.aviso(enlaceTarjeta(token)); } };
    fila.appendChild(c);
    if(window.PuveTarjeta && navigator.canShare){
      const im = h('button', 'texto', 'Compartir imagen', 'width:auto; padding:6px 4px; font-size:13px;'); im.type = 'button';
      im.onclick = async () => {
        try {
          const blob = await PuveTarjeta.png(svgTarjeta('dorso', sellos, premios), 1200), f = new File([blob], 'tarjeta.png', { type: 'image/png' });
          if(navigator.canShare({ files: [f] })) await navigator.share({ files: [f], text: textoWhatsapp(token, nombre) }); else enlace.aviso('Tu navegador no deja compartir imágenes: usa el enlace.');
        } catch(e){ if(e && e.name !== 'AbortError') enlace.aviso('No se pudo compartir la imagen.'); }
      };
      fila.appendChild(im);
    }
    cont.appendChild(fila);
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
    if(d.sumado || d.motivo === 'minimo'){
      // Botón para mandarle su tarjeta (con su diseño) y aviso a Google Wallet si ya la guardó ahí
      try {
        const token = await rpc('sellos_enlace', { p_telefono: telefono });
        if(token){
          const m = document.getElementById('mensajeVenta');
          if(m && m.parentNode){
            let z = document.getElementById('accionSellosVenta'); if(z) z.remove();
            z = h('div', null, null, 'margin-top:6px;'); z.id = 'accionSellosVenta'; m.parentNode.insertBefore(z, m.nextSibling);
            botonesEnvio(z, telefono, nombre, d.sellos, d.premios);
          }
          avisarWallet(token);
        }
      } catch(e){}
    }
    return d;
  }
  // Mejor esfuerzo: si el negocio activó Google Wallet y el cliente ya guardó su tarjeta, se actualiza su conteo
  async function avisarWallet(token){
    if(!walletDisponible || !enlace.sb || !enlace.sb.functions) return;
    try {
      const r = await enlace.sb.functions.invoke('wallet-tarjeta', { body: { accion: 'actualizar', token } });
      if(r.error && r.error.context && r.error.context.status === 501) walletDisponible = false;
    } catch(e){}
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
    const PT = window.PuveTarjeta;
    const fila = h('div', 'fila-config'), izq = h('div');
    izq.appendChild(h('div', null, 'Tarjeta de sellos', 'font-weight:600; font-size:14px;'));
    izq.appendChild(h('div', 'nota', 'Cada compra con el teléfono del cliente suma un sello. Al completar la tarjeta gana un premio. Sirve para cualquier giro.', 'margin:2px 0 0;'));
    const lab = h('label', 'interruptor'), chk = h('input'); chk.type = 'checkbox'; chk.checked = !!cfg.activo; lab.append(chk, h('span', 'deslizador'));
    fila.append(izq, lab); cont.appendChild(fila);
    const caja = h('div', null, null, 'margin:0 0 16px; padding:12px; border:1px solid var(--borde); border-radius:8px;');
    const rej = h('div', 'rejilla'); rej.style.gridTemplateColumns = '1fr 1fr';
    const campo = (et, tipo, val, extra, padre) => { const w = h('div', 'campo'); w.appendChild(h('label', null, et)); const i = h('input'); i.type = tipo; i.value = val; if(extra) Object.assign(i, extra); w.appendChild(i); (padre || rej).appendChild(w); return i; };
    const meta = campo('Sellos para ganar el premio', 'number', cfg.meta, { min: 2, max: 30, step: 1 });
    const min = campo('Compra mínima para ganar sello ($)', 'number', cfg.minimo, { min: 0, step: 1 });
    const premio = campo('Premio', 'text', cfg.premio, { maxLength: 60, placeholder: 'Ej. Café gratis' }); premio.parentNode.style.gridColumn = '1 / -1';
    caja.appendChild(rej);

    // ----- Diseño de la tarjeta -----
    let dis = PT ? PT.normalizar(cfg.diseno, giroActual()) : null;
    const prev = h('div', null, null, 'display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:10px; margin:14px 0 8px;');
    const chip = (txt, on, fn) => { const b = h('button', null, txt, 'width:auto; padding:5px 11px; border-radius:999px; font-size:13px; border:1px solid var(--borde); background:' + (on ? 'var(--acento,#18181B)' : 'transparent') + '; color:' + (on ? 'var(--texto-sobre-acento,#fff)' : 'inherit') + ';'); b.type = 'button'; b.onclick = fn; return b; };
    const sec = (tit) => { const d = h('div', null, null, 'margin:12px 0 0;'); d.appendChild(h('div', null, tit, 'font-size:13px; font-weight:600; margin-bottom:6px;')); return d; };
    const panel = h('div');
    function dibujar(){
      if(!PT) return;
      const m = Math.max(2, Math.min(30, parseInt(meta.value, 10) || cfg.meta)), pr = premio.value.trim() || cfg.premio, k = Math.min(3, m - 1);
      const base = { nombre: cfg.negocio, giro: giroActual(), diseno: dis, meta: m, sellos: k, premios: 0, premio: pr };
      prev.innerHTML = '';
      ['frente', 'dorso'].forEach((c) => { const e = h('div', null, null, 'line-height:0; border-radius:16px; overflow:hidden; box-shadow:0 4px 14px rgba(0,0,0,.18);'); e.innerHTML = PT.svg(Object.assign({}, base, { cara: c })); prev.appendChild(e); });
    }
    function armarPanel(){
      panel.textContent = '';
      if(!PT){ return; }
      let s = sec('Estilo'); const f1 = h('div', null, null, 'display:flex; gap:6px; flex-wrap:wrap;');
      Object.keys(PT.ESTILOS).forEach((k) => f1.appendChild(chip(PT.ESTILOS[k], dis.estilo === k, () => { dis.estilo = k; armarPanel(); dibujar(); }))); s.appendChild(f1); panel.appendChild(s);
      s = sec('Colores'); const f2 = h('div', null, null, 'display:flex; gap:8px; flex-wrap:wrap; align-items:center;');
      Object.keys(PT.PALETAS).forEach((k) => {
        const p = PT.PALETAS[k], on = p.every((c, i) => c.toLowerCase() === String(dis.paleta[i]).toLowerCase());
        const b = h('button', null, null, 'width:44px; height:30px; padding:0; border-radius:8px; overflow:hidden; display:flex; border:2px solid ' + (on ? 'var(--acento,#18181B)' : 'var(--borde)') + ';'); b.type = 'button'; b.title = k; b.setAttribute('aria-label', 'Colores ' + k);
        [0, 2, 1].forEach((i) => b.appendChild(h('span', null, null, 'flex:1; background:' + p[i] + ';')));
        b.onclick = () => { dis.paleta = p.slice(); armarPanel(); dibujar(); }; f2.appendChild(b);
      });
      s.appendChild(f2);
      const f3 = h('div', null, null, 'display:flex; gap:12px; flex-wrap:wrap; margin-top:8px;');
      ['Fondo', 'Texto', 'Sellos', 'Detalle'].forEach((et, i) => {
        const w = h('label', null, null, 'display:flex; align-items:center; gap:6px; font-size:12.5px;'); const c = h('input'); c.type = 'color'; c.value = dis.paleta[i]; c.style.cssText = 'width:34px; height:28px; padding:0; border:1px solid var(--borde); border-radius:6px; background:none;';
        c.oninput = () => { dis.paleta[i] = c.value; dibujar(); }; w.append(c, document.createTextNode(et)); f3.appendChild(w);
      });
      s.appendChild(f3); panel.appendChild(s);
      s = sec('Forma del sello'); const f4 = h('div', null, null, 'display:flex; gap:6px; flex-wrap:wrap;');
      Object.keys(PT.FORMAS).forEach((k) => f4.appendChild(chip(PT.FORMAS[k], dis.forma === k, () => { dis.forma = k; armarPanel(); dibujar(); }))); s.appendChild(f4); panel.appendChild(s);
      s = sec('Ícono del sello'); const f5 = h('div', null, null, 'display:flex; gap:6px; flex-wrap:wrap;');
      Object.keys(PT.ICONOS).forEach((k) => {
        const on = dis.icono === k, b = h('button', null, null, 'width:40px; height:40px; padding:6px; border-radius:10px; border:2px solid ' + (on ? 'var(--acento,#18181B)' : 'var(--borde)') + '; background:transparent; color:inherit;'); b.type = 'button'; b.title = k; b.setAttribute('aria-label', 'Ícono ' + k);
        b.innerHTML = '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + PT.ICONOS[k] + '</svg>';
        b.onclick = () => { dis.icono = k; armarPanel(); dibujar(); }; f5.appendChild(b);
      });
      s.appendChild(f5); panel.appendChild(s);
      const r2 = h('div', 'rejilla'); r2.style.cssText = 'grid-template-columns:1fr 1fr; margin-top:12px;';
      const lema = campo('Frase de la tarjeta', 'text', dis.lema, { maxLength: 40 }, r2), nom = campo('Nombre en la tarjeta', 'text', dis.nombre || cfg.negocio || '', { maxLength: 24, placeholder: cfg.negocio || 'Mi negocio' }, r2);
      lema.oninput = () => { dis.lema = lema.value; dibujar(); };
      nom.oninput = () => { dis.nombre = nom.value; dibujar(); };
      panel.appendChild(r2);
      const rs = h('button', 'texto', 'Volver al diseño sugerido para mi giro', 'width:auto; padding:6px 0; font-size:13px;'); rs.type = 'button';
      rs.onclick = () => { dis = PT.normalizar({}, giroActual()); armarPanel(); dibujar(); }; panel.appendChild(rs);
    }
    if(PT){ caja.appendChild(h('div', null, 'Diseño de la tarjeta', 'font-weight:600; font-size:14px; margin-top:16px;')); caja.appendChild(h('div', 'nota', 'Así la ve tu cliente al abrir su enlace. Ya viene un diseño pensado para tu giro; cámbialo si quieres.', 'margin:2px 0 0;')); caja.appendChild(prev); caja.appendChild(panel); armarPanel(); dibujar(); meta.addEventListener('input', dibujar); premio.addEventListener('input', dibujar); }

    const wal = h('p', 'nota', '', 'margin:10px 0 0;'); caja.appendChild(wal); estadoWallet(wal);
    const msg = h('p', 'nota', '', 'min-height:1.2em; margin:8px 0 0;'), res = h('div');
    const guardar = h('button', 'principal', 'Guardar', 'width:auto; margin-top:8px;'); guardar.type = 'button';
    async function enviar(){
      const m = parseInt(meta.value, 10), mn = Number(min.value || 0);
      if(!(m >= 2 && m <= 30)){ msg.textContent = 'Los sellos deben ser de 2 a 30.'; return false; }
      if(!premio.value.trim()){ msg.textContent = 'Escribe cuál es el premio.'; return false; }
      if(!(mn >= 0)){ msg.textContent = 'La compra mínima no es válida.'; return false; }
      try {
        await rpc('sellos_configurar', { p_activo: chk.checked, p_meta: m, p_premio: premio.value.trim(), p_minimo: mn });
        if(dis) await rpc('sellos_diseno_guardar', { p_diseno: dis });
      } catch(e){ msg.textContent = /does not exist|105|106/.test(e.message) ? 'Falta ejecutar el script SQL 106 en Supabase.' : e.message; return false; }
      cfg = Object.assign({}, cfg, { activo: chk.checked, meta: m, premio: premio.value.trim(), minimo: mn, diseno: dis || cfg.diseno }); msg.textContent = 'Guardado.'; actualizarCaja(); resumen(res); return true;
    }
    guardar.onclick = async () => { guardar.disabled = true; try { await enviar(); } finally { guardar.disabled = false; } };
    chk.onchange = async () => { caja.style.display = chk.checked ? '' : 'none'; await enviar(); };
    caja.append(guardar, msg, res); cont.appendChild(caja); caja.style.display = chk.checked ? '' : 'none';
    if(chk.checked) resumen(res);
  }
  // ¿Ya está conectado Google Wallet? Sin eso, el cliente no ve el botón «Agregar a Google Wallet» (la tarjeta, el QR y el enlace funcionan igual)
  async function estadoWallet(el){
    el.textContent = '';
    try {
      const r = await enlace.sb.functions.invoke('wallet-tarjeta', { body: { accion: 'estado' } });
      const ok = r && r.data && r.data.configurado === true;
      el.textContent = ok ? 'Google Wallet: conectado. Tus clientes verán el botón «Agregar a Google Wallet».' : 'Google Wallet: todavía no está conectado, por eso tus clientes no ven ese botón. Su tarjeta, su QR y su enlace ya funcionan sin Wallet. Para conectarlo sigue la GUIA_GOOGLE_WALLET.md.';
    } catch(e){ el.textContent = 'Google Wallet: todavía no está conectado (la función wallet-tarjeta no está desplegada). La tarjeta, el QR y el enlace funcionan sin Wallet.'; }
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
    cargar, activo: () => !!cfg.activo, consultar, trasVenta, montarConfig, escanear, identificarToken,
    _: { tarjetaTexto, telWhatsapp, tokenDe }
  };
})();
