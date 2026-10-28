/* PUVE - Plano del salón en SVG (dibujo + editor). Código propio, sin librerías.
 * Lo usan: el editor del encargado (puve.html) y la pantalla de cocina (cocina.html).
 *
 * Formato del plano (el servidor lo vuelve a validar y normalizar al guardar):
 *   { v:1, elementos:[ { id, tipo, x, y, w, h, rot, mesa, sillas, etq } ] }
 *   Lienzo virtual de 1000 x 640. (x, y) es el CENTRO del elemento.
 *   tipo: redonda | cuadrada | larga | barra (llevan "mesa") · cocina | puerta | bano | planta | columna (decoración)
 */
(function(){
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const W = 1000, H = 640;
  let uid = 0;

  const TIPOS = {
    redonda:  { nombre: 'Mesa redonda',  mesa: true,  w: 90,  h: 90,  sillas: 4 },
    cuadrada: { nombre: 'Mesa cuadrada', mesa: true,  w: 90,  h: 90,  sillas: 4 },
    larga:    { nombre: 'Mesa larga',    mesa: true,  w: 170, h: 80,  sillas: 6 },
    barra:    { nombre: 'Barra',         mesa: true,  w: 300, h: 60,  sillas: 6 },
    cocina:   { nombre: 'Cocina',        mesa: false, w: 220, h: 90,  sillas: 0, etq: 'COCINA' },
    puerta:   { nombre: 'Entrada',       mesa: false, w: 90,  h: 24,  sillas: 0, etq: 'ENTRADA' },
    bano:     { nombre: 'Baño',          mesa: false, w: 80,  h: 80,  sillas: 0, etq: 'WC' },
    planta:   { nombre: 'Planta',        mesa: false, w: 44,  h: 44,  sillas: 0 },
    columna:  { nombre: 'Columna',       mesa: false, w: 36,  h: 36,  sillas: 0 }
  };
  const ESTADO_COLOR = { por_confirmar: '#3b82f6', preparando: '#f59e0b', listo: '#22c55e', urgente: '#ef4444' };
  const PALETAS = {
    oscuro: { piso: '#1c2128', piso2: '#202730', pared: '#394150', texto: '#f3f4f6', sombra: 'rgba(0,0,0,.45)', silla: '#4b5563', sillaBorde: '#6b7280' },
    claro:  { piso: '#f4efe6', piso2: '#ece5d8', pared: '#a39682', texto: '#2b2118', sombra: 'rgba(60,40,20,.28)', silla: '#7b8794', sillaBorde: '#5b6571' }
  };

  const num = (v, lo, hi, d) => { v = Number(v); return isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };
  function s(tag, attrs, padre){
    const e = document.createElementNS(NS, tag);
    if(attrs) for(const k in attrs) if(attrs[k] != null) e.setAttribute(k, attrs[k]);
    if(padre) padre.appendChild(e);
    return e;
  }
  const esMesa = (e) => !!(TIPOS[e.tipo] && TIPOS[e.tipo].mesa);

  // Igual que el servidor: descarta lo inválido y limita los valores.
  function normalizar(plano){
    const out = [], usadas = {};
    ((plano && plano.elementos) || []).slice(0, 150).forEach((e) => {
      if(!e || !TIPOS[e.tipo]) return;
      const t = TIPOS[e.tipo];
      let mesa = null;
      if(t.mesa && /^[A-Za-z0-9 _-]{1,12}$/.test(String(e.mesa || ''))){ mesa = String(e.mesa); if(usadas[mesa]) mesa = null; else usadas[mesa] = 1; }
      out.push({
        id: 'e' + (out.length + 1), tipo: e.tipo,
        x: Math.round(num(e.x, 0, W, W / 2) * 10) / 10, y: Math.round(num(e.y, 0, H, H / 2) * 10) / 10,
        w: Math.round(num(e.w, 20, 400, t.w) * 10) / 10, h: Math.round(num(e.h, 16, 300, t.h) * 10) / 10,
        rot: Math.round(num(e.rot, 0, 359, 0)), mesa, sillas: Math.round(num(e.sillas, 0, 12, t.sillas)),
        etq: String(e.etq || '').replace(/[^A-Za-z0-9 áéíóúüñÁÉÍÓÚÜÑ._-]/g, '').slice(0, 20)
      });
    });
    return { v: 1, elementos: out };
  }

  // ---------- posiciones de las sillas (coordenadas locales, centro en 0,0) ----------
  function sillasPos(e){
    const n = e.sillas | 0, r = [];
    if(!n) return r;
    if(e.tipo === 'redonda'){
      const R = Math.min(e.w, e.h) / 2 + 13;
      for(let i = 0; i < n; i++){ const a = (2 * Math.PI * i / n) - Math.PI / 2; r.push({ x: R * Math.cos(a), y: R * Math.sin(a), rot: a * 180 / Math.PI + 90 }); }
    } else if(e.tipo === 'barra'){
      for(let i = 0; i < n; i++) r.push({ x: -e.w / 2 + e.w * (i + 0.5) / n, y: e.h / 2 + 15, rot: 0, banco: true });
    } else {
      const arriba = Math.ceil(n / 2), abajo = n - arriba;
      for(let i = 0; i < arriba; i++) r.push({ x: -e.w / 2 + e.w * (i + 0.5) / arriba, y: -e.h / 2 - 12, rot: 0 });
      for(let i = 0; i < abajo; i++) r.push({ x: -e.w / 2 + e.w * (i + 0.5) / abajo, y: e.h / 2 + 12, rot: 180 });
    }
    return r;
  }

  function defs(svg, pal, id){
    const d = s('defs', null, svg);
    const madera = s('linearGradient', { id: id + 'mad', x1: 0, y1: 0, x2: 1, y2: 1 }, d);
    s('stop', { offset: '0%', 'stop-color': '#d2a574' }, madera); s('stop', { offset: '55%', 'stop-color': '#b98650' }, madera); s('stop', { offset: '100%', 'stop-color': '#a06f3d' }, madera);
    const acero = s('linearGradient', { id: id + 'ace', x1: 0, y1: 0, x2: 0, y2: 1 }, d);
    s('stop', { offset: '0%', 'stop-color': '#d7dce2' }, acero); s('stop', { offset: '100%', 'stop-color': '#9aa3ad' }, acero);
    const tablones = s('pattern', { id: id + 'pis', width: 100, height: 40, patternUnits: 'userSpaceOnUse' }, d);
    s('rect', { width: 100, height: 40, fill: pal.piso }, tablones);
    s('rect', { width: 100, height: 20, fill: pal.piso2, opacity: '.55' }, tablones);
    s('path', { d: 'M0 .5H100M0 20.5H100M50 0V20M0 20V40M25 20V40M75 20V40', stroke: pal.pared, 'stroke-width': .5, opacity: '.35', fill: 'none' }, tablones);
    const st = s('style', null, d);
    st.textContent = '@keyframes puvePulso{0%,100%{opacity:1}50%{opacity:.25}}.pv-p{animation:puvePulso 1.1s ease-in-out infinite}@media (prefers-reduced-motion:reduce){.pv-p{animation:none}}';
  }

  function dibujarElemento(g, e, pal, id){
    const t = e.tipo, w = e.w, h = e.h;
    if(esMesa(e)){
      sillasPos(e).forEach((c) => {
        const sg = s('g', { transform: 'translate(' + c.x + ' ' + c.y + ') rotate(' + c.rot + ')' }, g);
        if(c.banco) s('circle', { r: 9, fill: pal.silla, stroke: pal.sillaBorde, 'stroke-width': 1.5 }, sg);
        else s('rect', { x: -13, y: -7, width: 26, height: 14, rx: 6, fill: pal.silla, stroke: pal.sillaBorde, 'stroke-width': 1.5 }, sg);
      });
      if(t === 'redonda'){
        s('circle', { r: Math.min(w, h) / 2 + 3, fill: pal.sombra, transform: 'translate(2 4)' }, g);
        s('circle', { r: Math.min(w, h) / 2, fill: 'url(#' + id + 'mad)', stroke: '#7a5430', 'stroke-width': 2 }, g);
        s('circle', { r: Math.min(w, h) / 2 - 7, fill: 'none', stroke: '#e6c598', 'stroke-width': 1, opacity: '.5' }, g);
      } else {
        s('rect', { x: -w / 2 + 2, y: -h / 2 + 4, width: w, height: h, rx: t === 'barra' ? 8 : 12, fill: pal.sombra }, g);
        s('rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx: t === 'barra' ? 8 : 12, fill: 'url(#' + id + 'mad)', stroke: '#7a5430', 'stroke-width': 2 }, g);
        s('rect', { x: -w / 2 + 6, y: -h / 2 + 6, width: w - 12, height: h - 12, rx: 8, fill: 'none', stroke: '#e6c598', 'stroke-width': 1, opacity: '.5' }, g);
      }
    } else if(t === 'cocina'){
      s('rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx: 6, fill: 'url(#' + id + 'ace)', stroke: '#6b7480', 'stroke-width': 2 }, g);
      [[-0.3, -0.18], [-0.1, -0.18], [-0.3, 0.2], [-0.1, 0.2]].forEach(([fx, fy]) => { s('circle', { cx: w * fx - 18, cy: h * fy, r: 10, fill: '#3a4048', stroke: '#1f2328', 'stroke-width': 2 }, g); s('circle', { cx: w * fx - 18, cy: h * fy, r: 4, fill: '#ef6a3a' }, g); });
      s('rect', { x: w * 0.12, y: -h / 2 + 10, width: w * 0.34, height: h - 20, rx: 4, fill: '#8d96a1', stroke: '#6b7480' }, g);
    } else if(t === 'puerta'){
      s('rect', { x: -w / 2, y: -h / 2, width: w, height: h, fill: pal.piso2, stroke: pal.pared, 'stroke-width': 2, 'stroke-dasharray': '6 4' }, g);
      s('path', { d: 'M' + (w / 2) + ' ' + (-h / 2) + ' A' + w + ' ' + w + ' 0 0 0 ' + (-w / 2) + ' ' + (-h / 2 - w) + ' L' + (-w / 2) + ' ' + (-h / 2), fill: 'none', stroke: pal.pared, 'stroke-width': 1.5, opacity: '.7' }, g);
    } else if(t === 'bano'){
      s('rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx: 8, fill: pal.piso2, stroke: pal.pared, 'stroke-width': 2 }, g);
    } else if(t === 'planta'){
      s('circle', { r: w / 2, fill: '#3f7d4e', stroke: '#2b5a37', 'stroke-width': 2 }, g);
      s('circle', { r: w / 3.2, fill: '#56a367' }, g); s('circle', { r: w / 7, fill: '#7cc58c' }, g);
    } else if(t === 'columna'){
      s('circle', { r: w / 2, fill: '#9aa3ad', stroke: '#6b7480', 'stroke-width': 2 }, g);
    }
  }

  /* dibujar(svg, plano, opciones)
   *   opciones.tema        'oscuro' | 'claro'
   *   opciones.estados     { "<mesa>": { estado, n, minutos, urgente } }   (solo para la pantalla de cocina)
   *   opciones.seleccion   mesa resaltada
   *   opciones.onMesa(mesa) clic en una mesa
   *   opciones.editor      { seleccionId, onPointerDown(id, ev) }  (modo editor)
   */
  function dibujar(svg, plano, o){
    o = o || {};
    const pal = PALETAS[o.tema === 'claro' ? 'claro' : 'oscuro'], id = 'pv' + (++uid) + '-';
    while(svg.firstChild) svg.removeChild(svg.firstChild);
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    defs(svg, pal, id);
    s('rect', { x: 0, y: 0, width: W, height: H, rx: 14, fill: 'url(#' + id + 'pis)' }, svg);
    s('rect', { x: 5, y: 5, width: W - 10, height: H - 10, rx: 12, fill: 'none', stroke: pal.pared, 'stroke-width': 10 }, svg);
    const els = (plano && plano.elementos) || [];
    // Primero lo que no es mesa (queda debajo), luego las mesas.
    els.slice().sort((a, b) => (esMesa(a) ? 1 : 0) - (esMesa(b) ? 1 : 0)).forEach((e) => {
      const grupo = s('g', { 'data-id': e.id });
      svg.appendChild(grupo);
      const rotado = s('g', { transform: 'translate(' + e.x + ' ' + e.y + ') rotate(' + (e.rot || 0) + ')' }, grupo);
      dibujarElemento(rotado, e, pal, id);
      const est = esMesa(e) && e.mesa && o.estados ? o.estados[e.mesa] : null;
      const color = est ? (est.urgente ? ESTADO_COLOR.urgente : ESTADO_COLOR[est.estado]) : null;
      if(color){
        const anillo = e.tipo === 'redonda'
          ? s('circle', { r: Math.min(e.w, e.h) / 2 + 5, fill: color, 'fill-opacity': .18, stroke: color, 'stroke-width': 6 }, rotado)
          : s('rect', { x: -e.w / 2 - 5, y: -e.h / 2 - 5, width: e.w + 10, height: e.h + 10, rx: 15, fill: color, 'fill-opacity': .18, stroke: color, 'stroke-width': 6 }, rotado);
        if(est.estado === 'por_confirmar' || est.urgente) anillo.setAttribute('class', 'pv-p');
      }
      if(o.seleccion && e.mesa && o.seleccion === e.mesa){
        const R = Math.max(e.w, e.h) / 2 + 22;
        s('rect', { x: e.x - R, y: e.y - R, width: R * 2, height: R * 2, rx: 18, fill: 'none', stroke: pal.texto, 'stroke-width': 3, 'stroke-dasharray': '8 6' }, grupo);
      }
      if(o.editor && o.editor.seleccionId === e.id){
        const R = Math.max(e.w, e.h) / 2 + 24;
        s('rect', { x: e.x - R, y: e.y - R, width: R * 2, height: R * 2, rx: 16, fill: 'none', stroke: '#3b82f6', 'stroke-width': 3, 'stroke-dasharray': '10 6' }, grupo);
      }
      // Texto sin girar, siempre legible
      const txt = s('g', { transform: 'translate(' + e.x + ' ' + e.y + ')', 'pointer-events': 'none' }, grupo);
      const rotulo = (t, y, tam, fill, peso) => { const x = s('text', { x: 0, y, 'text-anchor': 'middle', 'font-size': tam, 'font-weight': peso || 700, fill, 'font-family': 'system-ui,Segoe UI,Roboto,sans-serif', stroke: 'rgba(0,0,0,.55)', 'stroke-width': 3, 'paint-order': 'stroke' }, txt); x.textContent = t; return x; };
      if(esMesa(e)){
        const etiqueta = e.mesa ? e.mesa : (o.editor ? '?' : '');
        if(etiqueta) rotulo(etiqueta, est ? -2 : 8, etiqueta.length > 3 ? 18 : 26, '#fff');
        if(est){ rotulo(est.minutos + ' min', 20, 15, '#fff', 600); }
        if(est && est.n > 1){
          const R = Math.max(e.w, e.h) / 2 * 0.74;
          const b = s('g', { transform: 'translate(' + R + ' ' + (-R) + ')' }, txt);
          s('circle', { r: 13, fill: color, stroke: '#fff', 'stroke-width': 2 }, b);
          const bt = s('text', { x: 0, y: 5, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800, fill: '#fff', 'font-family': 'system-ui,sans-serif' }, b); bt.textContent = est.n;
        }
      } else if(e.etq){
        rotulo(e.etq, 5, e.tipo === 'puerta' ? 12 : 15, pal.texto, 700);
      }
      if(o.onMesa && esMesa(e) && e.mesa){ grupo.style.cursor = 'pointer'; grupo.addEventListener('click', () => o.onMesa(e.mesa)); }
      if(o.editor){ grupo.style.cursor = 'grab'; grupo.addEventListener('pointerdown', (ev) => o.editor.onPointerDown(e.id, ev)); }
    });
  }

  // =====================================================================
  // Editor
  // =====================================================================
  function h(tag, cls, txt, estilo){ const e = document.createElement(tag); if(cls) e.className = cls; if(txt != null) e.textContent = txt; if(estilo) e.style.cssText = estilo; return e; }

  /* editor(contenedor, plano, opciones)
   *   opciones.mesas       lista de mesas del negocio (['1','2',...,'BARRA'])
   *   opciones.alGuardar(plano) -> Promise (debe lanzar error si falla)
   *   opciones.tema
   */
  function editor(cont, planoInicial, o){
    o = o || {};
    let plano = normalizar(planoInicial && planoInicial.elementos ? planoInicial : { elementos: [] });
    let sel = null, historial = [], arrastre = null, sucio = false;
    const mesasLista = (o.mesas || []).map(String);

    cont.textContent = '';
    const barra = h('div', null, null, 'display:flex; flex-wrap:wrap; gap:6px; margin:6px 0;');
    const lienzo = h('div', null, null, 'border:1px solid var(--borde,#cfc7b8); border-radius:12px; overflow:hidden; background:#111; touch-action:none;');
    const svg = document.createElementNS(NS, 'svg'); svg.style.cssText = 'width:100%; display:block; touch-action:none; user-select:none;';
    lienzo.appendChild(svg);
    const props = h('div', null, null, 'display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin:8px 0; min-height:38px;');
    const estado = h('div', 'nota', '', 'margin:4px 0;');
    const acciones = h('div', null, null, 'display:flex; flex-wrap:wrap; gap:8px; margin-top:8px;');
    cont.appendChild(barra); cont.appendChild(lienzo); cont.appendChild(props); cont.appendChild(estado); cont.appendChild(acciones);

    const btn = (txt, fn, cls, padre) => { const b = h('button', cls || 'texto', txt, 'width:auto; padding:7px 12px;'); b.type = 'button'; b.onclick = fn; (padre || barra).appendChild(b); return b; };
    const foto = () => JSON.stringify(plano);
    const guardarHistorial = () => { historial.push(foto()); if(historial.length > 40) historial.shift(); sucio = true; };
    const porId = (id) => plano.elementos.find((e) => e.id === id);
    const usadas = () => plano.elementos.map((e) => e.mesa).filter(Boolean);
    const libres = () => mesasLista.filter((m) => usadas().indexOf(m) === -1);
    const renumerar = () => plano.elementos.forEach((e, i) => { const viejo = e.id; e.id = 'e' + (i + 1); if(sel === viejo) sel = e.id; });

    function redibujar(){
      dibujar(svg, plano, { tema: o.tema || 'oscuro', editor: { seleccionId: sel, onPointerDown: empezarArrastre } });
      pintarProps();
    }

    function agregar(tipo){
      guardarHistorial();
      const t = TIPOS[tipo], e = { id: 'n' + Date.now(), tipo, x: 500, y: 320, w: t.w, h: t.h, rot: 0, mesa: null, sillas: t.sillas, etq: t.etq || '' };
      if(t.mesa){ const l = libres(); e.mesa = tipo === 'barra' && libres().indexOf('BARRA') !== -1 ? 'BARRA' : (l.filter((m) => m !== 'BARRA')[0] || l[0] || null); }
      // evitar encimarse exactamente
      let k = 0; while(plano.elementos.some((x) => Math.abs(x.x - e.x) < 12 && Math.abs(x.y - e.y) < 12) && k < 20){ e.x += 24; e.y += 24; k++; }
      plano.elementos.push(e); renumerar(); sel = plano.elementos[plano.elementos.length - 1].id; redibujar();
    }
    function acomodarAuto(){
      const pend = libres().filter((m) => m !== 'BARRA'); if(!pend.length){ estado.textContent = 'Todas las mesas ya están en el plano.'; return; }
      guardarHistorial();
      const cols = 5, dx = 170, dy = 150, x0 = 130, y0 = 130;
      let n = plano.elementos.filter((e) => esMesa(e)).length;
      pend.forEach((m) => {
        const i = n++, t = TIPOS.cuadrada;
        plano.elementos.push({ id: 'n' + i, tipo: 'cuadrada', x: x0 + (i % cols) * dx, y: y0 + Math.floor(i / cols) * dy, w: t.w, h: t.h, rot: 0, mesa: m, sillas: 4, etq: '' });
      });
      renumerar(); redibujar(); estado.textContent = 'Acomodé ' + pend.length + ' mesa(s). Arrástralas a su lugar real.';
    }

    // ----- arrastre con Pointer Events (ratón, dedo o lápiz) -----
    function aCoord(ev){ const r = svg.getBoundingClientRect(); return { x: (ev.clientX - r.left) / r.width * W, y: (ev.clientY - r.top) / r.height * H }; }
    function empezarArrastre(id, ev){
      ev.preventDefault(); sel = id; const e = porId(id), p = aCoord(ev);
      arrastre = { id, dx: e.x - p.x, dy: e.y - p.y, movio: false };
      try { svg.setPointerCapture(ev.pointerId); } catch(x){}
      redibujar();
    }
    svg.addEventListener('pointermove', (ev) => {
      if(!arrastre) return;
      const e = porId(arrastre.id); if(!e) return; const p = aCoord(ev);
      if(!arrastre.movio){ guardarHistorial(); arrastre.movio = true; }
      e.x = Math.round(Math.min(W - 10, Math.max(10, p.x + arrastre.dx)) / 10) * 10;
      e.y = Math.round(Math.min(H - 10, Math.max(10, p.y + arrastre.dy)) / 10) * 10;
      redibujar();
    });
    const soltar = () => { arrastre = null; };
    svg.addEventListener('pointerup', soltar); svg.addEventListener('pointercancel', soltar);
    svg.addEventListener('pointerdown', (ev) => { if(ev.target === svg || (ev.target.tagName === 'rect' && !ev.target.closest('g[data-id]'))){ sel = null; redibujar(); } });

    // ----- propiedades del elemento seleccionado -----
    function pintarProps(){
      props.textContent = '';
      const e = sel && porId(sel);
      if(!e){ props.appendChild(h('span', 'nota', 'Toca o arrastra un elemento para moverlo. Selecciónalo para cambiar su mesa, tamaño o giro.')); return; }
      const t = TIPOS[e.tipo];
      props.appendChild(h('b', null, t.nombre, 'margin-right:4px;'));
      if(t.mesa){
        const selMesa = h('select', 'input-mini', null, 'width:auto;');
        const op0 = h('option', null, 'Sin mesa'); op0.value = ''; selMesa.appendChild(op0);
        mesasLista.filter((m) => m === e.mesa || usadas().indexOf(m) === -1).forEach((m) => { const op = h('option', null, m === 'BARRA' ? 'Barra (para llevar)' : 'Mesa ' + m); op.value = m; selMesa.appendChild(op); });
        selMesa.value = e.mesa || '';
        selMesa.onchange = () => { guardarHistorial(); e.mesa = selMesa.value || null; redibujar(); };
        props.appendChild(selMesa);
        const mas = (txt, fn) => { const b = h('button', 'texto', txt, 'width:auto; padding:6px 10px;'); b.type = 'button'; b.onclick = () => { guardarHistorial(); fn(); redibujar(); }; props.appendChild(b); };
        props.appendChild(h('span', 'nota', 'Sillas'));
        mas('−', () => { e.sillas = Math.max(0, e.sillas - 1); }); props.appendChild(h('b', null, String(e.sillas))); mas('+', () => { e.sillas = Math.min(12, e.sillas + 1); });
      } else if(e.tipo === 'cocina' || e.tipo === 'puerta' || e.tipo === 'bano'){
        const inp = h('input', 'input-mini', null, 'width:130px;'); inp.type = 'text'; inp.maxLength = 20; inp.value = e.etq || ''; inp.placeholder = 'Rótulo';
        inp.onchange = () => { guardarHistorial(); e.etq = inp.value.replace(/[^A-Za-z0-9 áéíóúüñÁÉÍÓÚÜÑ._-]/g, '').slice(0, 20); redibujar(); };
        props.appendChild(inp);
      }
      const tam = (txt, campo, d) => { const b = h('button', 'texto', txt, 'width:auto; padding:6px 10px;'); b.type = 'button'; b.onclick = () => { guardarHistorial(); e[campo] = Math.min(400, Math.max(20, e[campo] + d)); redibujar(); }; props.appendChild(b); };
      props.appendChild(h('span', 'nota', 'Ancho')); tam('−', 'w', -10); tam('+', 'w', 10);
      props.appendChild(h('span', 'nota', 'Alto')); tam('−', 'h', -10); tam('+', 'h', 10);
      const girar = h('button', 'texto', 'Girar', 'width:auto; padding:6px 10px;'); girar.type = 'button';
      girar.onclick = () => { guardarHistorial(); e.rot = (e.rot + 90) % 360; redibujar(); }; props.appendChild(girar);
      const dup = h('button', 'texto', 'Duplicar', 'width:auto; padding:6px 10px;'); dup.type = 'button';
      dup.onclick = () => { guardarHistorial(); const c = JSON.parse(JSON.stringify(e)); c.id = 'n' + Date.now(); c.x = Math.min(W - 10, c.x + 30); c.y = Math.min(H - 10, c.y + 30); if(TIPOS[c.tipo].mesa){ c.mesa = libres().filter((m) => m !== 'BARRA')[0] || null; } plano.elementos.push(c); renumerar(); sel = plano.elementos[plano.elementos.length - 1].id; redibujar(); };
      props.appendChild(dup);
      const del = h('button', 'texto', 'Eliminar', 'width:auto; padding:6px 10px; color:#c0392b;'); del.type = 'button';
      del.onclick = () => { guardarHistorial(); plano.elementos = plano.elementos.filter((x) => x.id !== e.id); sel = null; renumerar(); redibujar(); };
      props.appendChild(del);
    }

    // ----- barra de herramientas -----
    ['redonda', 'cuadrada', 'larga', 'barra', 'cocina', 'puerta', 'bano', 'planta', 'columna'].forEach((t) => btn('+ ' + TIPOS[t].nombre, () => agregar(t), 'texto'));
    btn('Acomodar mesas sin lugar', acomodarAuto, 'texto');
    btn('Deshacer', () => { const f = historial.pop(); if(f){ plano = JSON.parse(f); sel = null; redibujar(); } }, 'texto', acciones);
    btn('Vaciar plano', () => { if(!plano.elementos.length || confirm('¿Borrar todo el plano?')){ guardarHistorial(); plano = { v: 1, elementos: [] }; sel = null; redibujar(); } }, 'texto', acciones);
    const bGuardar = btn('Guardar plano', async () => {
      bGuardar.disabled = true; estado.textContent = 'Guardando…';
      try { const guardado = await o.alGuardar(normalizar(plano)); if(guardado && guardado.elementos){ plano = normalizar(guardado); } sucio = false; estado.textContent = 'Plano guardado.'; redibujar(); }
      catch(e){ estado.textContent = 'No se pudo guardar: ' + ((e && e.message) || e); }
      finally { bGuardar.disabled = false; }
    }, 'principal', acciones);

    document.addEventListener('keydown', function teclas(ev){
      if(!document.body.contains(cont)){ document.removeEventListener('keydown', teclas); return; }
      const e = sel && porId(sel); if(!e || /^(INPUT|SELECT|TEXTAREA)$/.test((ev.target.tagName || ''))) return;
      if(ev.key === 'Delete' || ev.key === 'Backspace'){ guardarHistorial(); plano.elementos = plano.elementos.filter((x) => x.id !== e.id); sel = null; renumerar(); redibujar(); ev.preventDefault(); return; }
      const paso = ev.shiftKey ? 50 : 10, mov = { ArrowLeft: [-paso, 0], ArrowRight: [paso, 0], ArrowUp: [0, -paso], ArrowDown: [0, paso] }[ev.key];
      if(mov){ guardarHistorial(); e.x = Math.min(W - 10, Math.max(10, e.x + mov[0])); e.y = Math.min(H - 10, Math.max(10, e.y + mov[1])); redibujar(); ev.preventDefault(); }
    });

    if(!plano.elementos.length && mesasLista.length) estado.textContent = 'Tu plano está vacío. Usa “Acomodar mesas sin lugar” para empezar y luego arrastra cada mesa a su lugar real.';
    redibujar();
    return { obtener: () => normalizar(plano), haySinGuardar: () => sucio };
  }

  window.PuvePlano = { dibujar, editor, normalizar, TIPOS, ancho: W, alto: H };
})();
