/* PUVE - Restaurantes y cafeterías: dividir la cuenta, propinas y etiquetas de platillos (alérgenos).
 *  · Dividir la cuenta: cálculo en pantalla (no cambia la venta).
 *  · Propinas: se guardan APARTE de la venta con propina_registrar (no suman a ingresos ni impuestos).
 *  · Etiquetas: alérgenos, picante, vegetariano y vegano que se muestran en el menú QR (producto_etiquetas).
 */
(function(){
  'use strict';
  let enlace = { sb: null, productos: () => [], carrito: () => [], total: () => 0, dinero: (n) => '$' + Number(n).toFixed(2), aviso: (m) => alert(m) };

  const ETIQUETAS = [
    ['gluten', 'Gluten'], ['lacteos', 'Lácteos'], ['huevo', 'Huevo'], ['pescado', 'Pescado'], ['mariscos', 'Mariscos'], ['cacahuate', 'Cacahuate'],
    ['nueces', 'Nueces'], ['soya', 'Soya'], ['ajonjoli', 'Ajonjolí'], ['picante', 'Picante'], ['vegetariano', 'Vegetariano'], ['vegano', 'Vegano']
  ];
  const ALERGENOS = ETIQUETAS.slice(0, 9).map((e) => e[0]);

  function h(tag, cls, txt, estilo){ const e = document.createElement(tag); if(cls) e.className = cls; if(txt != null) e.textContent = txt; if(estilo) e.style.cssText = estilo; return e; }
  function modal(titulo, ancho){
    const fondo = h('div', 'modal-puve-fondo'), caja = h('div', 'modal-puve'); caja.style.maxWidth = (ancho || 480) + 'px';
    fondo.appendChild(caja); fondo.onclick = (ev) => { if(ev.target === fondo) fondo.remove(); };
    caja.appendChild(h('h2', '', titulo, 'margin:0 0 8px;')); document.body.appendChild(fondo);
    return { caja, cerrar: () => fondo.remove() };
  }
  const chip = (txt, activo, fn) => {
    const b = h('button', activo ? 'principal' : 'texto', txt, 'width:auto; padding:7px 13px; margin:0 6px 6px 0;'); b.type = 'button'; b.onclick = fn; return b;
  };
  const redondear = (n) => Math.round(n * 100) / 100;
  const num = (v) => { const n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : NaN; };

  // =====================================================================
  // Dividir la cuenta
  // =====================================================================
  function dividirCuenta(){
    const total = Number(enlace.total()) || 0;
    if(!(total > 0)){ enlace.aviso('Agrega productos al pedido para dividir la cuenta.'); return; }
    const { caja, cerrar } = modal('Dividir la cuenta', 420);
    caja.appendChild(h('p', 'nota', 'Calcula cuánto paga cada persona. No cambia la venta: cobras el total normal.', 'margin:0 0 10px;'));
    let personas = 2, pct = 0;
    const cuerpo = h('div'); caja.appendChild(cuerpo);
    const pintar = () => {
      cuerpo.textContent = '';
      const filaP = h('div', null, null, 'display:flex; align-items:center; gap:12px; margin-bottom:10px;');
      filaP.appendChild(h('span', null, 'Personas', 'font-weight:600;'));
      const menos = chip('−', false, () => { personas = Math.max(2, personas - 1); pintar(); }), mas = chip('+', false, () => { personas = Math.min(30, personas + 1); pintar(); });
      menos.style.margin = '0'; mas.style.margin = '0';
      filaP.appendChild(menos); filaP.appendChild(h('b', null, String(personas), 'font-size:20px; min-width:28px; text-align:center;')); filaP.appendChild(mas); cuerpo.appendChild(filaP);
      cuerpo.appendChild(h('div', null, 'Propina sugerida (opcional)', 'font-weight:600; margin-bottom:6px;'));
      const filaT = h('div'); [0, 10, 15, 20].forEach((p) => filaT.appendChild(chip(p ? p + '%' : 'Sin propina', pct === p, () => { pct = p; pintar(); }))); cuerpo.appendChild(filaT);
      const propina = redondear(total * pct / 100), conPropina = redondear(total + propina);
      const base = Math.floor(conPropina / personas * 100) / 100, resto = redondear(conPropina - base * personas);
      const centavosExtra = Math.round(resto * 100);
      const caja2 = h('div', null, null, 'margin-top:12px; padding:14px; border:1px solid var(--borde,#ddd); border-radius:12px;');
      caja2.appendChild(h('div', 'nota', 'Cuenta ' + enlace.dinero(total) + (pct ? ' + propina ' + enlace.dinero(propina) + ' = ' + enlace.dinero(conPropina) : ''), 'margin:0 0 6px;'));
      caja2.appendChild(h('div', null, enlace.dinero(centavosExtra ? base + 0.01 : base) + ' por persona', 'font-size:26px; font-weight:800;'));
      if(centavosExtra) caja2.appendChild(h('div', 'nota', 'Para cuadrar al centavo: ' + centavosExtra + ' persona(s) paga(n) ' + enlace.dinero(base + 0.01) + ' y las demás ' + enlace.dinero(base) + '.', 'margin:6px 0 0;'));
      cuerpo.appendChild(caja2);
      cuerpo.appendChild(h('p', 'nota', 'Si cada quien paga distinto, cobra por separado: agrega a cada persona sus productos y usa “Cobrar” una vez por cuenta.', 'margin:10px 0 0;'));
    };
    pintar();
    const cerrarBtn = h('button', 'texto', 'Cerrar', 'width:100%; margin-top:12px;'); cerrarBtn.type = 'button'; cerrarBtn.onclick = cerrar; caja.appendChild(cerrarBtn);
  }

  // =====================================================================
  // Propina de una venta ya cobrada (se pinta dentro del bloque de venta exitosa)
  // =====================================================================
  function montarPropina(contenedor, ventaId, total){
    if(!contenedor) return;
    contenedor.textContent = '';
    if(!ventaId || !(Number(total) > 0)){ contenedor.style.display = 'none'; return; }
    contenedor.style.display = '';
    contenedor.appendChild(h('div', null, 'Propina (opcional)', 'font-weight:600; margin-bottom:6px;'));
    contenedor.appendChild(h('div', 'nota', 'Se guarda aparte: no suma a tus ventas ni a tus impuestos.', 'margin:0 0 8px;'));
    const fila = h('div'); contenedor.appendChild(fila);
    const estado = h('div', 'nota', '', 'margin:6px 0 0;'); contenedor.appendChild(estado);
    let metodo = 'efectivo', seleccion = null;
    const guardar = async (monto) => {
      estado.textContent = 'Guardando…';
      const { error } = await enlace.sb.rpc('propina_registrar', { p_venta: ventaId, p_monto: monto, p_metodo: metodo });
      if(error){ estado.textContent = 'No se pudo guardar: ' + error.message; return; }
      estado.textContent = monto > 0 ? 'Propina guardada: ' + enlace.dinero(monto) + ' (' + metodo + ')' : 'Propina quitada.';
    };
    const pintar = () => {
      fila.textContent = '';
      [10, 15, 20].forEach((p) => fila.appendChild(chip(p + '% · ' + enlace.dinero(redondear(total * p / 100)), seleccion === p, async () => { seleccion = p; pintar(); await guardar(redondear(total * p / 100)); })));
      const otra = h('input', 'input-mini'); otra.type = 'number'; otra.min = '0'; otra.step = 'any'; otra.placeholder = 'Otra $'; otra.style.cssText = 'width:90px; margin:0 6px 6px 0;';
      const ok = chip('Guardar', false, async () => { const v = num(otra.value); if(isNaN(v) || v < 0){ estado.textContent = 'Escribe un monto válido.'; return; } seleccion = 'otra'; await guardar(redondear(v)); });
      fila.appendChild(otra); fila.appendChild(ok);
      const mt = h('select', 'input-mini', null, 'width:auto; margin:0 6px 6px 0;'); ['efectivo', 'tarjeta', 'transferencia'].forEach((m) => { const o = h('option', null, m); o.value = m; mt.appendChild(o); }); mt.value = metodo; mt.onchange = () => { metodo = mt.value; };
      fila.appendChild(mt);
    };
    pintar();
  }

  // =====================================================================
  // Etiquetas de platillos (encargado)
  // =====================================================================
  function editarEtiquetas(){
    const { caja, cerrar } = modal('Alérgenos y etiquetas del menú', 640);
    caja.appendChild(h('p', 'nota', 'Marca lo que contiene cada platillo. Se muestra en tu menú QR para que el cliente lo vea antes de pedir. Es una ayuda: confirma siempre con tu cocina, la información del cliente no sustituye tu responsabilidad.', 'margin:0 0 8px;'));
    const bus = h('input', 'input-mini'); bus.type = 'search'; bus.placeholder = 'Buscar platillo…'; bus.style.cssText = 'width:100%; margin-bottom:8px;'; caja.appendChild(bus);
    const lista = h('div', null, null, 'max-height:55vh; overflow-y:auto;'); caja.appendChild(lista);
    const estado = h('div', 'nota', '', 'margin:6px 0;'); caja.appendChild(estado);
    const platillos = enlace.productos().filter((p) => (p.tipo || 'producto') === 'producto').map((p) => ({ id: p.id, nombre: p.nombre, etiquetas: [] })).sort((a, b) => a.nombre.localeCompare(b.nombre));
    // Las etiquetas se leen aparte para no depender de ellas al cargar los productos
    enlace.sb.from('productos').select('id,etiquetas').then(({ data, error }) => {
      if(error){ estado.textContent = 'No se pudieron leer las etiquetas (¿ya ejecutaste el SQL 96?): ' + error.message; return; }
      const m = {}; (data || []).forEach((r) => { m[r.id] = r.etiquetas || []; }); platillos.forEach((p) => { p.etiquetas = m[p.id] || []; }); pintar();
    });
    const pintar = () => {
      lista.textContent = ''; const q = bus.value.trim().toLowerCase();
      platillos.filter((p) => !q || p.nombre.toLowerCase().indexOf(q) !== -1).slice(0, 200).forEach((p) => {
        const caj = h('div', null, null, 'padding:8px 0; border-bottom:1px solid var(--borde,#ddd);');
        caj.appendChild(h('div', null, p.nombre, 'font-weight:600; margin-bottom:6px;'));
        const fila = h('div');
        ETIQUETAS.forEach(([k, t]) => {
          const on = (p.etiquetas || []).indexOf(k) !== -1;
          const b = chip(t, on, async () => {
            const nuevas = on ? p.etiquetas.filter((x) => x !== k) : (p.etiquetas || []).concat([k]);
            estado.textContent = 'Guardando…';
            const { error } = await enlace.sb.rpc('producto_etiquetas', { p_id: p.id, p_etiquetas: nuevas });
            if(error){ estado.textContent = 'No se pudo guardar: ' + error.message; return; }
            p.etiquetas = nuevas; estado.textContent = 'Guardado.'; pintar();
          });
          b.style.fontSize = '12px'; b.style.padding = '4px 10px'; fila.appendChild(b);
        });
        caj.appendChild(fila); lista.appendChild(caj);
      });
      if(!lista.children.length) lista.appendChild(h('p', 'nota', 'No hay platillos para mostrar.'));
    };
    bus.oninput = pintar; pintar();
    const c = h('button', 'texto', 'Cerrar', 'width:100%; margin-top:10px;'); c.type = 'button'; c.onclick = () => { cerrar(); try { enlace.alCerrarEtiquetas && enlace.alCerrarEtiquetas(); } catch(e){} }; caja.appendChild(c);
  }

  window.PuveRestaurante = {
    enlazar(o){ enlace = Object.assign(enlace, o || {}); },
    dividirCuenta, montarPropina, editarEtiquetas,
    _ETIQUETAS: ETIQUETAS, _ALERGENOS: ALERGENOS
  };
})();
