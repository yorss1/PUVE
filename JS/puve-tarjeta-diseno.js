/* PUVE - Diseños de la tarjeta de sellos (SVG puro, sin librerías ni imágenes externas).
 * Lo usan: puve.html (editor y caja), tarjeta.html (la tarjeta del cliente) y tarjetas-galeria.html.
 * PuveTarjeta.svg({nombre, giro, diseno, meta, sellos, premios, premio, cara}) -> texto SVG (cara: 'frente' | 'dorso')
 * PuveTarjeta.png(svgTexto, ancho) -> Promise<Blob>   (para guardar o compartir la tarjeta como imagen)
 * Todo texto del negocio se escapa; las fuentes son del sistema para que la imagen exportada se vea igual en cualquier celular.
 */
(function(){
  'use strict';
  const W = 1000, H = 630;

  // ---------- Íconos (cuadrícula 24x24, trazo) ----------
  const ICONOS = {
    restaurante: '<path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10"/><path d="M17 21V3c-2.5 1.5-3.5 4.5-3.5 8H17"/>',
    taco: '<path d="M3 18a9 9 0 0 1 18 0z"/><path d="M7 14.5c1-2 3-3 5-3s4 1 5 3"/><path d="M9 6.5l.6 1.4M13 5l.2 1.5M16 7l1-1.2"/>',
    pizza: '<path d="M3 6c6-3 12-3 18 0L12 21z"/><circle cx="10" cy="9.5" r="1"/><circle cx="14.5" cy="10" r="1"/><circle cx="12" cy="14.5" r="1"/>',
    cerveza: '<path d="M5 8.5h10V19a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z"/><path d="M15 10.5h2.5a2 2 0 0 1 2 2v2.5a2 2 0 0 1-2 2H15"/><path d="M5 8.5c0-2 1.5-3 3-3 .8-1.3 3.2-1.3 4 0 1.5 0 3 1 3 3"/><path d="M8.5 12v5M11.5 12v5"/>',
    taza: '<path d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16"/><path d="M8 3c-1 1 1 2 0 3M12 3c-1 1 1 2 0 3"/>',
    helado: '<path d="M7 12l5 10 5-10"/><path d="M6.5 12a3 3 0 0 1 .5-5.5 5 5 0 0 1 10 0 3 3 0 0 1 .5 5.5z"/>',
    pan: '<path d="M4 11c0-3 3-5 8-5s8 2 8 5v1H4z"/><path d="M5 12v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/><path d="M9 8l-1 3M13 7.5l-1 3.5M17 8l-1 3"/>',
    canasta: '<path d="M3 9h18l-2 11H5z"/><path d="M8 9l3-6M16 9l-3-6"/><path d="M9 13v4M12 13v4M15 13v4"/>',
    botella: '<path d="M10 2h4v4l2 3v12a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V9l2-3z"/><path d="M8 13h8M8 17h8"/>',
    carne: '<path d="M5 10c0-3.5 4-5.5 8-4.5s7 4 6 8-5 7-9 6-5-3-5-9.5z"/><circle cx="14" cy="11.5" r="2.4"/>',
    dulce: '<circle cx="12" cy="12" r="4.5"/><path d="M7.7 9.2L3 6v12l4.7-3.2M16.3 9.2L21 6v12l-4.7-3.2"/><path d="M10 10.5l4 3"/>',
    queso: '<path d="M3 9l18-5v9a5 5 0 0 1-5 5H3z"/><circle cx="8" cy="14" r="1.3"/><circle cx="14" cy="11.5" r="1.1"/><circle cx="16" cy="15.5" r="1"/>',
    manzana: '<path d="M12 7.5c-2-2-7-1-7 5 0 5 3 8.5 5 8.5 1 0 1.5-.5 2-.5s1 .5 2 .5c2 0 5-3.500 5-8.500 0-6-5-7-7-5z"/><path d="M12 7.5c0-2 1-3.500 3-4"/>',
    pollo: '<path d="M20 8.500c0 4-3.500 7-7 6.500L10 12c-.500-3.500 2.500-7 6-7 2.500 0 4 1.500 4 3.500z"/><path d="M11 13.500l-4.500 4"/><circle cx="4.800" cy="17.300" r="1.600"/><circle cx="6.800" cy="19.600" r="1.600"/>',
    maiz: '<path d="M12 3c3 2 4 6 4 9s-1 6-4 9c-3-3-4-6-4-9s1-7 4-9z"/><path d="M8.5 9h7M8 13h8M9 17h6M12 3v18"/>',
    playera: '<path d="M8 3L3 6l2 4 3-1v12h8V9l3 1 2-4-5-3c0 2-2 3-4 3s-4-1-4-3z"/>',
    gema: '<path d="M7 4h10l4 5-9 11L3 9z"/><path d="M3 9h18M9.500 4L7 9l5 11 5-11-2.500-5"/>',
    martillo: '<path d="M4 20L13 11"/><path d="M9.500 6.500L13 3l7 7-3.500 3.500z"/>',
    celular: '<rect x="7" y="2.500" width="10" height="19" rx="2.200"/><path d="M10.500 18.500h3"/>',
    lapiz: '<path d="M4 20l1-4L16 5l3 3L8 19z"/><path d="M14 7l3 3M4 20l4-1"/>',
    engrane: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="6.500"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.900 4.900L7 7M17 17l2.100 2.100M19.100 4.900L17 7M7 17l-2.100 2.100"/>',
    flor: '<circle cx="12" cy="6.500" r="2.800"/><circle cx="17.500" cy="10.500" r="2.800"/><circle cx="15.400" cy="16.500" r="2.800"/><circle cx="8.600" cy="16.500" r="2.800"/><circle cx="6.500" cy="10.500" r="2.800"/><circle cx="12" cy="12" r="1.500"/>',
    regalo: '<rect x="3.500" y="9" width="17" height="11" rx="1"/><path d="M3 9h18v3H3zM12 9v11M12 9c-3-1-5-5-2.500-5.500S12 7 12 9zM12 9c3-1 5-5 2.500-5.500S12 7 12 9z"/>',
    pastilla: '<path d="M10.5 20.5a5 5 0 0 1-7-7l10-10a5 5 0 0 1 7 7z"/><path d="M8.5 8.5l7 7"/>',
    tijeras: '<circle cx="6" cy="6.500" r="2.700"/><circle cx="6" cy="17.500" r="2.700"/><path d="M8.200 8.200L20 19M8.200 15.800L20 5"/>',
    pesa: '<path d="M2.500 9.500v5M5.500 7v10M18.500 7v10M21.500 9.500v5M5.500 12h13"/>',
    huella: '<ellipse cx="12" cy="16" rx="4.500" ry="3.600"/><circle cx="5.500" cy="11" r="1.800"/><circle cx="9.500" cy="6.500" r="1.800"/><circle cx="14.500" cy="6.500" r="1.800"/><circle cx="18.500" cy="11" r="1.800"/>',
    auto: '<path d="M5 12l1.500-4.500A2 2 0 0 1 8.400 6h7.200a2 2 0 0 1 1.900 1.500L19 12"/><rect x="3" y="12" width="18" height="5.500" rx="2"/><path d="M6.500 17.500V19M17.500 17.500V19"/><path d="M6.500 14.800h1.500M16 14.800h1.500"/>',
    lavadora: '<rect x="4" y="3" width="16" height="18" rx="2"/><circle cx="12" cy="13" r="4.500"/><path d="M7 6.500h2M11 6.500h1"/><path d="M9.800 13c1-1 2 1 3 0s1.200 0 1.700 0"/>',
    estrella: '<path d="M12 3l2.700 5.600 6.100.9-4.400 4.300 1 6.100L12 17l-5.400 2.900 1-6.100L3.200 9.500l6.100-.9z"/>',
    corazon: '<path d="M12 20S3.500 14.500 3.500 8.800A4.600 4.600 0 0 1 12 6.500a4.600 4.600 0 0 1 8.500 2.300C20.500 14.500 12 20 12 20z"/>'
  };

  // ---------- Los 29 giros: ícono y diseño sugerido ----------
  // [nombre del giro, ícono, estilo, paleta, forma, lema]
  const GIROS = {
    restaurantes:  ['Restaurantes y fondas', 'restaurante', 'limpio', 'terracota', 'circulo', 'Sabor de casa en cada visita'],
    taquerias:     ['Taquerías', 'taco', 'retro', 'mostaza', 'escalop', 'Taco a taco te premiamos'],
    pizzerias:     ['Pizzerías y comida rápida', 'pizza', 'gotas', 'tomate', 'circulo', 'Cada rebanada cuenta'],
    bares:         ['Bares y cantinas', 'cerveza', 'oscuro', 'noche', 'circulo', 'Salud por tu próxima ronda'],
    cafeterias:    ['Cafeterías', 'taza', 'limpio', 'cafe', 'circulo', 'Arte en cada taza'],
    heladerias:    ['Heladerías y paleterías', 'helado', 'kawaii', 'rosa', 'punteado', 'Junta sellos, come helado'],
    panaderia:     ['Panadería y repostería', 'pan', 'minimo', 'grafito', 'cuadro', 'Pan calientito, premio seguro'],
    abarrotes:     ['Abarrotes y tiendas de conveniencia', 'canasta', 'ticket', 'mostaza', 'cuadro', 'Cada compra te acerca al premio'],
    licorerias:    ['Licorerías y cervecerías', 'botella', 'oscuro', 'vino', 'hexagono', 'Brindamos por tu lealtad'],
    carnicerias:   ['Carnicerías', 'carne', 'retro', 'tomate', 'escalop', 'Corte a corte, premio seguro'],
    dulcerias:     ['Dulcerías', 'dulce', 'kawaii', 'rosa', 'escalop', 'Endulzamos tus visitas'],
    cremerias:     ['Cremerías y salchichonerías', 'queso', 'limpio', 'mantequilla', 'circulo', 'Lo bueno se junta sello a sello'],
    fruterias:     ['Fruterías y verdulerías', 'manzana', 'gotas', 'fruta', 'circulo', 'Fresco hoy, premio mañana'],
    pollerias:     ['Pollerías y pescaderías', 'pollo', 'retro', 'mostaza', 'escalop', 'Pollo seguro, premio seguro'],
    tortillerias:  ['Tortillerías y molinos', 'maiz', 'minimo', 'maiz', 'circulo', 'Calientitas y con premio'],
    ropa:          ['Ropa y zapatos', 'playera', 'minimo', 'grafito', 'cuadro', 'Tu estilo, tu premio'],
    joyeria:       ['Joyería y relojería', 'gema', 'oscuro', 'oro', 'hexagono', 'Brilla con cada compra'],
    ferreteria:    ['Ferreterías y tlapalerías', 'martillo', 'ticket', 'mostaza', 'cuadro', 'Obra a obra, sello a sello'],
    electronicos:  ['Electrónicos y celulares', 'celular', 'oscuro', 'noche', 'cuadro', 'Conéctate con tus premios'],
    papelerias:    ['Papelerías y copias', 'lapiz', 'kawaii', 'cielo', 'punteado', 'Cada compra suma'],
    refaccionarias:['Refaccionarias', 'engrane', 'ticket', 'grafito', 'hexagono', 'Rueda con tus premios'],
    floristerias:  ['Florerías', 'flor', 'kawaii', 'rosa', 'escalop', 'Cada visita florece'],
    regalos:       ['Regalos y novedades', 'regalo', 'gotas', 'rosa', 'escalop', 'Un detalle por tu compra'],
    farmacias:     ['Farmacias', 'pastilla', 'limpio', 'cielo', 'circulo', 'Cuidamos tu salud y tu bolsillo'],
    estetica:      ['Estética, barbería y spa', 'tijeras', 'oscuro', 'vino', 'circulo', 'Tu imagen tiene premio'],
    suplementos:   ['Tiendas de suplementos', 'pesa', 'retro', 'grafito', 'hexagono', 'Rinde más, gana más'],
    veterinarias:  ['Veterinarias y mascotas', 'huella', 'kawaii', 'salvia', 'circulo', 'Tu mascota también gana'],
    talleres:      ['Talleres y lavado de autos', 'auto', 'ticket', 'noche', 'hexagono', 'Cuida tu auto, gana premios'],
    lavanderias:   ['Lavanderías y tintorerías', 'lavadora', 'gotas', 'cielo', 'circulo', 'Ropa limpia, premio seguro']
  };
  // Paleta: [fondo, tinta (texto), acento (sello lleno), claro (sello vacío / papel)]
  const PALETAS = {
    cafe: ['#f5e9d6', '#3d2b1f', '#a8512b', '#fffaf0'], matcha: ['#c6d65c', '#44521f', '#44521f', '#f3f0dc'],
    vino: ['#f7f1ee', '#4a0e1e', '#7a1631', '#ffffff'], bosque: ['#26352a', '#f2e6c9', '#c8573a', '#f2e6c9'],
    terracota: ['#f3e3d3', '#7a2e1d', '#c4553a', '#fff5ea'], salvia: ['#8fa98a', '#2f4a34', '#2f4a34', '#f4f1e1'],
    chocolate: ['#4a2f23', '#f4dcc0', '#e8a76b', '#6a4a3a'], noche: ['#14213d', '#fdf3dc', '#fca311', '#2b3a5e'],
    rosa: ['#fde2e4', '#6b2d3c', '#e5677f', '#ffffff'], mostaza: ['#f3c63f', '#2a2a2a', '#2a2a2a', '#fff3c4'],
    cielo: ['#d9ecf5', '#1d3f58', '#2f8fc4', '#ffffff'], grafito: ['#efefea', '#1b1b1b', '#e2552d', '#ffffff'],
    tomate: ['#fff1dc', '#7c1d12', '#d9381e', '#ffe3bd'], mantequilla: ['#fbf0c8', '#5b4310', '#d99a1f', '#fffbe6'],
    fruta: ['#fff4d6', '#2f5d1f', '#e4572e', '#ffffff'], maiz: ['#f6d86a', '#3a2a0a', '#3a2a0a', '#fff6cc'],
    oro: ['#17140f', '#f1dfae', '#d4af37', '#2a251b']
  };
  const ESTILOS = { limpio: 'Limpio', retro: 'Retro', oscuro: 'Elegante', gotas: 'Gotas', minimo: 'Minimal', kawaii: 'Tierno', ticket: 'Ticket' };
  const FORMAS = { circulo: 'Círculo', escalop: 'Flor', cuadro: 'Cuadro', hexagono: 'Hexágono', punteado: 'Punteado' };
  const HEX = /^#[0-9a-fA-F]{6}$/;

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (n) => Math.round(n * 10) / 10;

  function sugerido(giro){
    const g = GIROS[giro] || GIROS.restaurantes;
    return { estilo: g[2], paleta: PALETAS[g[3]].slice(), forma: g[4], icono: g[1], lema: g[5], nombre: '' };
  }
  // Acepta lo que venga (de la base o del formulario) y devuelve un diseño completo y seguro
  function normalizar(d, giro){
    const s = sugerido(giro), o = (d && typeof d === 'object') ? d : {};
    const pal = Array.isArray(o.paleta) && o.paleta.length === 4 && o.paleta.every((c) => HEX.test(String(c))) ? o.paleta.map(String) : s.paleta;
    return {
      estilo: ESTILOS[o.estilo] ? o.estilo : s.estilo, paleta: pal,
      forma: FORMAS[o.forma] ? o.forma : s.forma, icono: ICONOS[o.icono] ? o.icono : s.icono,
      lema: typeof o.lema === 'string' && o.lema.trim() ? o.lema.trim().slice(0, 40) : s.lema,
      nombre: typeof o.nombre === 'string' ? o.nombre.trim().slice(0, 24) : ''
    };
  }

  // ---------- Piezas de dibujo ----------
  let contador = 0;
  function icono(nombre, x, y, tam, color, grosor){
    return '<g transform="translate(' + num(x) + ' ' + num(y) + ') scale(' + num(tam / 24) + ')" fill="none" stroke="' + color + '" stroke-width="' + (grosor || 1.7) + '" stroke-linecap="round" stroke-linejoin="round">' + (ICONOS[nombre] || ICONOS.estrella) + '</g>';
  }
  function escalopPath(cx, cy, r){
    const n = 12, pts = [];
    for(let i = 0; i < 144; i++){ const a = i / 144 * Math.PI * 2, rr = r * (0.9 + 0.1 * Math.cos(a * n)); pts.push(num(cx + rr * Math.cos(a)) + ' ' + num(cy + rr * Math.sin(a))); }
    return 'M' + pts.join('L') + 'Z';
  }
  function forma(f, cx, cy, r, attrs){
    attrs = attrs || '';
    if(f === 'cuadro') return '<rect x="' + num(cx - r * .9) + '" y="' + num(cy - r * .9) + '" width="' + num(r * 1.8) + '" height="' + num(r * 1.8) + '" rx="' + num(r * .5) + '" ' + attrs + '/>';
    if(f === 'hexagono'){ const p = []; for(let i = 0; i < 6; i++){ const a = Math.PI / 6 + i * Math.PI / 3; p.push(num(cx + r * Math.cos(a)) + ',' + num(cy + r * Math.sin(a))); } return '<polygon points="' + p.join(' ') + '" stroke-linejoin="round" ' + attrs + '/>'; }
    if(f === 'escalop') return '<path d="' + escalopPath(cx, cy, r) + '" ' + attrs + '/>';
    if(f === 'punteado') return '<circle cx="' + num(cx) + '" cy="' + num(cy) + '" r="' + num(r) + '" stroke-dasharray="' + num(r * .22) + ' ' + num(r * .2) + '" stroke-linecap="round" ' + attrs + '/>';
    return '<circle cx="' + num(cx) + '" cy="' + num(cy) + '" r="' + num(r) + '" ' + attrs + '/>';
  }
  function ajustar(txt, ancho, max, factor){ return Math.max(14, Math.min(max, ancho / (Math.max(1, String(txt).length) * (factor || .58)))); }
  function hash(s){ let h = 2166136261; for(let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rejilla(n, a){
    let mejor = null;
    for(let filas = 1; filas <= 4; filas++){
      const cols = Math.ceil(n / filas), r = Math.min(a.w / cols, a.h / filas) / 2;
      if(!mejor || r > mejor.r + 0.5) mejor = { filas, cols, r };
    }
    const r = mejor.r, paso = Math.min(a.w / mejor.cols, a.h / mejor.filas), out = [];
    const ancho = paso * mejor.cols, alto = paso * mejor.filas, x0 = a.x + (a.w - ancho) / 2, y0 = a.y + (a.h - alto) / 2;
    for(let i = 0; i < n; i++){
      const f = Math.floor(i / mejor.cols), enFila = f === mejor.filas - 1 ? n - f * mejor.cols : mejor.cols, c = i - f * mejor.cols;
      const sobra = (mejor.cols - enFila) * paso / 2;
      out.push({ cx: x0 + sobra + paso * (c + .5), cy: y0 + paso * (f + .5), r: r * .86 });
    }
    return out;
  }
  const texto = (x, y, t, o) => '<text x="' + num(x) + '" y="' + num(y) + '" font-family="' + o.fam + '" font-size="' + num(o.size) + '" font-weight="' + (o.peso || 700) + '" fill="' + o.color + '" text-anchor="' + (o.ancla || 'start') + '"' +
    (o.estilo ? ' font-style="' + o.estilo + '"' : '') + (o.sp ? ' letter-spacing="' + o.sp + '"' : '') + (o.op != null ? ' opacity="' + o.op + '"' : '') + (o.rot ? ' transform="rotate(' + o.rot + ' ' + num(x) + ' ' + num(y) + ')"' : '') + '>' + esc(t) + '</text>';

  const FAM = {
    serif: "Georgia,'Times New Roman',serif", grueso: "'Arial Black',Impact,'Helvetica Neue',Arial,sans-serif",
    redondo: "'Trebuchet MS','Segoe UI',system-ui,sans-serif", suave: "'Arial Rounded MT Bold','Helvetica Neue',Arial,sans-serif",
    tierno: "'Comic Sans MS','Chalkboard SE','Marker Felt','Segoe Print',cursive", mono: "'Courier New',Courier,monospace"
  };

  // Un sello (lleno o vacío) con la política de cada estilo
  function sello(c, i, ctx, est){
    const lleno = i < ctx.sellos, f = ctx.forma, p = ctx.pal, ic = ctx.icono;
    let g = '';
    if(lleno){
      g += forma(f, c.cx, c.cy, c.r, 'fill="' + est.llenoFondo + '"' + (est.llenoBorde ? ' stroke="' + est.llenoBorde + '" stroke-width="5"' : ''));
      g += est.llenoCara ? cara(c.cx, c.cy, c.r, est.llenoIcono) : icono(ic, c.cx - c.r * .5, c.cy - c.r * .5, c.r, est.llenoIcono, 1.6);
    } else {
      g += forma(f, c.cx, c.cy, c.r, 'fill="' + (est.vacioFondo || 'none') + '"' + (est.vacioFondoOp ? ' fill-opacity="' + est.vacioFondoOp + '"' : '') + ' stroke="' + est.vacioBorde + '" stroke-width="' + (est.vacioGrosor || 4) + '" stroke-opacity="' + (est.vacioOp || 1) + '"');
      if(est.vacioIcono) g += '<g opacity="' + est.vacioIcono + '">' + icono(ic, c.cx - c.r * .45, c.cy - c.r * .45, c.r * .9, est.vacioBorde, 1.5) + '</g>';
      g += texto(c.cx, c.cy + c.r * .12, String(i + 1), { fam: FAM.redondo, size: c.r * .5, color: est.vacioBorde, ancla: 'middle', peso: 700, op: est.vacioIcono ? 0 : .35 });
    }
    return g;
  }
  function cara(cx, cy, r, color){
    const s = r * .3;
    return '<g fill="none" stroke="' + color + '" stroke-width="' + num(r * .08) + '" stroke-linecap="round"><path d="M' + num(cx - s * 1.2) + ' ' + num(cy - s * .2) + 'q' + num(s * .5) + ' ' + num(-s * .5) + ' ' + num(s) + ' 0M' + num(cx + s * .2) + ' ' + num(cy - s * .2) + 'q' + num(s * .5) + ' ' + num(-s * .5) + ' ' + num(s) + ' 0"/><path d="M' + num(cx - s * .6) + ' ' + num(cy + s * .6) + 'q' + num(s * .6) + ' ' + num(s * .5) + ' ' + num(s * 1.2) + ' 0"/></g>';
  }
  function pie(ctx, color, x, y, ancla, op){
    const t = ctx.meta + ' sellos = ' + ctx.premio;
    return texto(x, y, t.length > 52 ? t.slice(0, 51) + '…' : t, { fam: ctx.fam, size: 26, color, ancla, peso: 700, op, sp: 1 });
  }
  function cinta(ctx, color, fondo){
    if(!(ctx.premios > 0)) return '';
    const txt = ctx.premios > 1 ? ctx.premios + ' PREMIOS' : '¡PREMIO!';
    return '<g transform="translate(1000 0) rotate(45)"><rect x="-260" y="104" width="520" height="54" fill="' + color + '"/>' + texto(0, 141, txt, { fam: FAM.redondo, size: 30, color: fondo, ancla: 'middle', peso: 900, sp: 2 }) + '</g>';
  }

  // ---------- Estilos ----------
  const ESTILO = {
    limpio(x){
      const [f, t, a, c] = x.pal, nom = ajustar(x.nombre, 780, 104, .55);
      const frente = '<rect width="1000" height="630" fill="' + f + '"/><path d="M0 0H230A230 230 0 0 1 0 230z" fill="' + a + '"/><path d="M1000 630H770A230 230 0 0 1 1000 400z" fill="' + a + '"/>' +
        '<rect x="30" y="30" width="940" height="570" rx="26" fill="none" stroke="' + t + '" stroke-opacity=".22" stroke-width="3"/>' +
        '<circle cx="500" cy="180" r="84" fill="' + c + '" stroke="' + t + '" stroke-width="5"/>' + icono(x.icono, 440, 120, 120, t, 1.5) +
        texto(500, 372, x.nombre, { fam: FAM.serif, size: nom, color: t, ancla: 'middle', peso: 700 }) +
        '<path d="M380 410h240" stroke="' + a + '" stroke-width="4" stroke-linecap="round"/>' +
        texto(500, 462, x.lema.toUpperCase(), { fam: FAM.redondo, size: 24, color: t, ancla: 'middle', sp: 5, peso: 700, op: .85 });
      const g = rejilla(x.meta, { x: 70, y: 150, w: 860, h: 360 }), e = { llenoFondo: a, llenoIcono: f, vacioBorde: t, vacioOp: .8, vacioIcono: .3 };
      const dorso = '<rect width="1000" height="630" fill="' + c + '"/><rect x="0" y="0" width="1000" height="96" fill="' + f + '"/>' + icono(x.icono, 40, 22, 52, a, 1.6) +
        texto(110, 64, x.lema.toUpperCase(), { fam: FAM.redondo, size: 26, color: t, sp: 3, peso: 800 }) + cinta(x, a, f) +
        g.map((s, i) => sello(s, i, x, e)).join('') + pie(x, t, 500, 580, 'middle', .75);
      return { frente, dorso, e: typeof e === 'undefined' ? null : e };
    },
    retro(x){
      const [f, t, a, c] = x.pal, nom = ajustar(x.nombre.toUpperCase(), 820, 170, .7), nid = 'n' + x.uid;
      const fr = '<rect width="1000" height="630" fill="' + a + '"/><g transform="rotate(-8 500 315)">' +
        texto(40, 260, x.nombre.toUpperCase(), { fam: FAM.grueso, size: nom, color: c, peso: 900 }) +
        texto(40, 260 + nom * .92, x.nombre.toUpperCase(), { fam: FAM.grueso, size: nom, color: f, peso: 900, op: .9 }) + '</g>' +
        '<g transform="rotate(-4 220 520)"><rect x="40" y="480" width="' + num(Math.min(900, 60 + x.lema.length * 17)) + '" height="64" rx="32" fill="' + f + '"/>' + texto(72, 522, x.lema.toUpperCase(), { fam: FAM.redondo, size: 26, color: t, sp: 2, peso: 800 }) + '</g>' +
        '<circle cx="880" cy="110" r="70" fill="' + f + '"/>' + icono(x.icono, 835, 65, 90, t, 1.6);
      const g = rejilla(x.meta, { x: 50, y: 150, w: 900, h: 380 }), e = { llenoFondo: t, llenoIcono: c, vacioFondo: c, vacioBorde: c, vacioGrosor: 0, vacioIcono: .35 };
      const dorso = '<rect width="1000" height="630" fill="' + f + '"/><path d="M0 0H1000V110L0 150z" fill="' + a + '" />' +
        texto(40, 80, 'CLIENTE FRECUENTE', { fam: FAM.grueso, size: 44, color: c, peso: 900, rot: -2, sp: 1 }) + cinta(x, t, c) +
        g.map((s, i) => sello(s, i, x, Object.assign({}, e, { vacioBorde: t }))).join('') + pie(x, t, 40, 596, 'start', .9);
      return { frente: fr, dorso, e };
    },
    oscuro(x){
      const [f, t, a, c] = x.pal, nom = ajustar(x.nombre, 780, 98, .56);
      const marco = '<rect x="26" y="26" width="948" height="578" rx="22" fill="none" stroke="' + a + '" stroke-width="3"/><rect x="40" y="40" width="920" height="550" rx="14" fill="none" stroke="' + a + '" stroke-opacity=".45" stroke-width="1.5"/>';
      const frente = '<rect width="1000" height="630" fill="' + f + '"/>' + marco + icono(x.icono, 452, 96, 96, a, 1.3) +
        '<path d="M250 146h170M580 146h170" stroke="' + a + '" stroke-width="2"/><circle cx="500" cy="146" r="0"/>' +
        texto(500, 372, x.nombre, { fam: FAM.serif, size: nom, color: t, ancla: 'middle', peso: 400, estilo: 'italic' }) +
        texto(500, 440, x.lema.toUpperCase(), { fam: FAM.redondo, size: 22, color: a, ancla: 'middle', sp: 6, peso: 700 });
      const g = rejilla(x.meta, { x: 80, y: 140, w: 840, h: 370 }), e = { llenoFondo: a, llenoIcono: f, vacioBorde: a, vacioGrosor: 3, vacioOp: .75, vacioIcono: .28 };
      const dorso = '<rect width="1000" height="630" fill="' + f + '"/>' + marco + texto(500, 100, x.nombre, { fam: FAM.serif, size: 40, color: t, ancla: 'middle', estilo: 'italic', peso: 400 }) + cinta(x, a, f) +
        g.map((s, i) => sello(s, i, x, e)).join('') + pie(x, a, 500, 566, 'middle', .95);
      return { frente, dorso, e: typeof e === 'undefined' ? null : e };
    },
    gotas(x){
      const [f, t, a, c] = x.pal, nom = ajustar(x.nombre, 600, 100, .6);
      const gotas = (alto) => '<path d="M0 0H1000V' + alto + 'C960 ' + alto + ' 950 ' + (alto + 70) + ' 910 ' + (alto + 70) + 'S860 ' + alto + ' 800 ' + alto + 'S740 ' + (alto + 40) + ' 690 ' + (alto + 40) + 'S630 ' + alto + ' 560 ' + alto + 'S500 ' + (alto + 90) + ' 450 ' + (alto + 90) + 'S390 ' + alto + ' 330 ' + alto + 'S270 ' + (alto + 55) + ' 220 ' + (alto + 55) + 'S160 ' + alto + ' 100 ' + alto + 'S40 ' + (alto + 35) + ' 0 ' + alto + 'Z" fill="' + a + '"/>';
      const frente = '<rect width="1000" height="630" fill="' + c + '"/>' + gotas(150) + '<circle cx="840" cy="400" r="120" fill="' + a + '"/>' + icono(x.icono, 770, 330, 140, c, 1.5) +
                texto(60, 360, x.nombre, { fam: FAM.redondo, size: nom, color: t, peso: 900 }) + texto(62, 430, x.lema, { fam: FAM.redondo, size: 30, color: t, peso: 600, op: .85 });
      const g = rejilla(x.meta, { x: 60, y: 200, w: 880, h: 320 }), e = { llenoFondo: a, llenoIcono: c, vacioFondo: a, vacioFondoOp: .18, vacioBorde: t, vacioGrosor: 0, vacioIcono: .3 };
      const dorso = '<rect width="1000" height="630" fill="' + c + '"/>' + gotas(80) + texto(60, 56, 'TARJETA DE CLIENTE', { fam: FAM.redondo, size: 32, color: c, peso: 900, sp: 3 }) + cinta(x, t, c) +
        g.map((s, i) => sello(s, i, x, e)).join('') + pie(x, t, 500, 590, 'middle', .85);
      return { frente, dorso, e: typeof e === 'undefined' ? null : e };
    },
    minimo(x){
      const [f, t, a, c] = x.pal, nom = ajustar(x.nombre, 900, 190, .62);
      const frente = '<rect width="1000" height="630" fill="' + c + '"/>' + texto(50, 70, x.lema, { fam: FAM.redondo, size: 24, color: t, peso: 600, op: .8 }) +
        texto(950, 70, 'tarjeta de cliente', { fam: FAM.redondo, size: 24, color: t, ancla: 'end', peso: 600, op: .8 }) +
        texto(46, 400, x.nombre, { fam: FAM.suave, size: nom, color: t, peso: 900, sp: -3 }) +
        '<circle cx="840" cy="150" r="64" fill="' + a + '"/>' + icono(x.icono, 800, 110, 80, c, 1.6) + '<path d="M50 470h900" stroke="' + t + '" stroke-width="5" stroke-linecap="round"/>' +
        texto(50, 540, 'junta ' + x.meta + ' sellos y llévate: ' + x.premio, { fam: FAM.redondo, size: 28, color: t, peso: 600, op: .9 });
      const g = rejilla(x.meta, { x: 60, y: 150, w: 880, h: 370 });
      const dorso = '<rect width="1000" height="630" fill="' + c + '"/>' + texto(500, 84, 'tarjeta de cliente', { fam: FAM.tierno, size: 40, color: t, ancla: 'middle', peso: 400, estilo: 'italic' }) + cinta(x, a, c) +
        g.map((s, i) => {
          const l = i < x.sellos;
          return forma(x.forma === 'punteado' ? 'circulo' : x.forma, s.cx, s.cy, s.r, 'fill="' + (l ? f : 'none') + '" stroke="' + t + '" stroke-width="4"' + (l ? ' fill-opacity=".55"' : '')) +
            (l ? icono(x.icono, s.cx - s.r * .5, s.cy - s.r * .5, s.r, t, 1.4) : texto(s.cx, s.cy + s.r * .16, String(i + 1), { fam: FAM.tierno, size: s.r * .55, color: t, ancla: 'middle', peso: 400, op: .35 }));
        }).join('') + pie(x, t, 500, 590, 'middle', .8);
      return { frente, dorso, e: typeof e === 'undefined' ? null : e };
    },
    kawaii(x){
      const [f, t, a, c] = x.pal, nom = ajustar(x.nombre, 560, 92, .6);
      const mascota = '<g transform="translate(205 320)"><path d="M-95 -75L-110 -150L-40 -105zM95 -75L110 -150L40 -105z" fill="' + c + '" stroke="' + t + '" stroke-width="7" stroke-linejoin="round"/>' +
        '<ellipse cx="0" cy="0" rx="130" ry="112" fill="' + c + '" stroke="' + t + '" stroke-width="7"/>' +
        '<path d="M-62 -8q20 -26 40 0M22 -8q20 -26 40 0" fill="none" stroke="' + t + '" stroke-width="7" stroke-linecap="round"/><path d="M-26 28q26 26 52 0" fill="none" stroke="' + t + '" stroke-width="7" stroke-linecap="round"/>' +
        '<circle cx="-84" cy="26" r="14" fill="' + a + '" opacity=".55"/><circle cx="84" cy="26" r="14" fill="' + a + '" opacity=".55"/></g>';
      const frente = '<rect width="1000" height="630" fill="' + f + '"/>' + '<circle cx="880" cy="90" r="150" fill="' + c + '" opacity=".45"/><circle cx="60" cy="590" r="120" fill="' + c + '" opacity=".4"/>' + mascota +
        texto(380, 300, x.nombre, { fam: FAM.tierno, size: nom, color: t, peso: 900 }) + texto(382, 360, x.lema, { fam: FAM.tierno, size: 28, color: t, peso: 600, op: .85 }) +
        '<circle cx="830" cy="470" r="80" fill="' + a + '"/>' + icono(x.icono, 780, 420, 100, c, 1.6);
      const g = rejilla(x.meta, { x: 60, y: 170, w: 880, h: 340 }), e = { llenoFondo: t, llenoIcono: f, llenoCara: true, vacioFondo: c, vacioBorde: t, vacioGrosor: 3, vacioIcono: .4 };
      const dorso = '<rect width="1000" height="630" fill="' + f + '"/>' + texto(500, 96, 'TARJETA DE CLIENTE', { fam: FAM.tierno, size: 54, color: t, ancla: 'middle', peso: 900, rot: -3, sp: 2 }) +
        texto(500, 134, 'junta ' + x.meta + ' sellos y recibe un premio', { fam: FAM.tierno, size: 24, color: t, ancla: 'middle', peso: 600, op: .8 }) + cinta(x, a, f) +
        g.map((s, i) => sello(s, i, x, e)).join('') + pie(x, t, 500, 582, 'middle', .85);
      return { frente, dorso, e: typeof e === 'undefined' ? null : e };
    },
    ticket(x){
      const [f, t, a, c] = x.pal, nom = ajustar(x.nombre.toUpperCase(), 600, 92, .62), id = 'k' + x.uid;
      const muesca = '<mask id="' + id + '"><rect width="1000" height="630" fill="#fff"/><circle cx="0" cy="315" r="34" fill="#000"/><circle cx="1000" cy="315" r="34" fill="#000"/><circle cx="700" cy="0" r="22" fill="#000"/><circle cx="700" cy="630" r="22" fill="#000"/></mask>';
      const codigo = (() => { let h = hash(x.nombre + x.icono), b = '', px = 60; for(let i = 0; i < 46 && px < 600; i++){ h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; const w = 3 + (h % 5); b += '<rect x="' + px + '" y="520" width="' + w + '" height="64" fill="' + t + '"/>'; px += w + 3 + ((h >> 5) % 4); } return b; })();
      const frente = '<defs>' + muesca + '</defs><g mask="url(#' + id + ')"><rect width="1000" height="630" fill="' + f + '"/><rect x="700" width="300" height="630" fill="' + a + '"/></g>' +
        '<path d="M700 40V590" stroke="' + c + '" stroke-width="4" stroke-dasharray="14 12" opacity=".8"/>' +
        texto(60, 100, 'TICKET DE LEALTAD', { fam: FAM.mono, size: 26, color: t, sp: 4, peso: 700, op: .75 }) +
        texto(60, 300, x.nombre.toUpperCase(), { fam: FAM.mono, size: nom, color: t, peso: 700 }) + texto(60, 360, x.lema, { fam: FAM.mono, size: 28, color: t, peso: 400, op: .9 }) + codigo +
        icono(x.icono, 770, 190, 160, f, 1.4) + texto(850, 440, x.meta + ' SELLOS', { fam: FAM.mono, size: 34, color: f, ancla: 'middle', peso: 700 }) + texto(850, 480, '= PREMIO', { fam: FAM.mono, size: 30, color: f, ancla: 'middle', peso: 700 });
      const g = rejilla(x.meta, { x: 60, y: 130, w: 880, h: 390 }), e = { llenoFondo: t, llenoIcono: f, vacioFondo: c, vacioBorde: t, vacioGrosor: 3, vacioIcono: .3 };
      const dorso = '<defs>' + muesca + '</defs><g mask="url(#' + id + ')"><rect width="1000" height="630" fill="' + f + '"/></g>' +
        texto(60, 90, x.nombre.toUpperCase() + ' · ' + x.meta + ' SELLOS', { fam: FAM.mono, size: 28, color: t, sp: 2, peso: 700 }) + '<path d="M60 112H940" stroke="' + t + '" stroke-width="3" stroke-dasharray="4 10" stroke-linecap="round"/>' + cinta(x, a, f) +
        g.map((s, i) => sello(s, i, x, e)).join('') + pie(x, t, 60, 590, 'start', .85);
      return { frente, dorso, e: typeof e === 'undefined' ? null : e };
    }
  };

  // ---------- Imágenes para Google Wallet: banda (1032×336) y logo (660×660) con el mismo estilo de la tarjeta ----------
  const BANDA = {   // fondo, color del nombre, tipografía y adorno de cada estilo
    limpio: (p) => ({ bg: p[0], nom: p[1], fam: FAM.serif, peso: 700, ital: '', deco: '<path d="M0 0H150A150 150 0 0 1 0 150z" fill="' + p[2] + '"/>' }),
    retro: (p) => ({ bg: p[0], nom: p[1], fam: FAM.grueso, peso: 900, ital: '', up: true, deco: '<path d="M0 0H430L380 336H0z" fill="' + p[2] + '" opacity=".14"/>' }),
    oscuro: (p) => ({ bg: p[0], nom: p[1], fam: FAM.serif, peso: 400, ital: 'italic', deco: '<rect x="14" y="14" width="1004" height="308" rx="16" fill="none" stroke="' + p[2] + '" stroke-width="3"/><rect x="24" y="24" width="984" height="288" rx="10" fill="none" stroke="' + p[2] + '" stroke-opacity=".4" stroke-width="1.5"/>' }),
    gotas: (p) => ({ bg: p[3], nom: p[1], fam: FAM.redondo, peso: 900, ital: '', deco: '<path d="M0 0H1032V34C990 34 980 76 940 76S890 34 830 34S770 62 720 62S660 34 590 34S520 90 470 90S410 34 350 34S290 70 240 70S180 34 120 34S40 60 0 34Z" fill="' + p[2] + '"/>' }),
    minimo: (p) => ({ bg: p[3], nom: p[1], fam: FAM.suave, peso: 900, ital: '', deco: '<path d="M40 300H992" stroke="' + p[1] + '" stroke-width="5" stroke-linecap="round"/>' }),
    kawaii: (p) => ({ bg: p[0], nom: p[1], fam: FAM.tierno, peso: 900, ital: '', deco: '<circle cx="960" cy="40" r="110" fill="' + p[3] + '" opacity=".5"/><circle cx="30" cy="330" r="90" fill="' + p[3] + '" opacity=".45"/>' }),
    ticket: (p) => ({ bg: p[0], nom: p[1], fam: FAM.mono, peso: 700, ital: '', up: true, deco: '<path d="M410 18V318" stroke="' + p[2] + '" stroke-width="4" stroke-dasharray="12 10"/><circle cx="0" cy="168" r="24" fill="#fff" opacity="0"/>' })
  };
  function banda(x, estilo, par){
    const p = x.pal, b = BANDA[estilo](p), e = par.e || { llenoFondo: p[2], llenoIcono: p[0], vacioBorde: p[1], vacioGrosor: 4, vacioIcono: .3 };
    const nom = b.up ? x.nombre.toUpperCase() : x.nombre, tam = ajustar(nom, 340, 64, .6);
    const g = rejilla(x.meta, { x: 440, y: 28, w: 570, h: 280 });
    return { fondo: b.bg, svg: '<rect width="1032" height="336" fill="' + b.bg + '"/>' + b.deco +
      '<circle cx="205" cy="104" r="58" fill="' + p[2] + '"/>' + icono(x.icono, 165, 64, 80, b.bg, 1.7) +
      texto(205, 214, nom, { fam: b.fam, size: tam, color: b.nom, ancla: 'middle', peso: b.peso, estilo: b.ital || null }) +
      texto(205, 258, x.lema.length > 30 ? x.lema.slice(0, 29) + '…' : x.lema, { fam: FAM.redondo, size: 20, color: b.nom, ancla: 'middle', peso: 600, op: .8 }) +
      g.map((s, i) => sello(s, i, x, e)).join('') };
  }

  // ---------- API ----------
  function svg(o){
    o = o || {};
    const giro = GIROS[o.giro] ? o.giro : 'restaurantes', d = normalizar(o.diseno, giro);
    const meta = Math.max(2, Math.min(30, parseInt(o.meta, 10) || 8));
    const x = {
      uid: ++contador, pal: d.paleta, forma: d.forma, icono: d.icono, lema: d.lema, fam: FAM.redondo, meta,
      nombre: (d.nombre || String(o.nombre || '').trim() || 'Mi negocio').slice(0, 24),
      sellos: Math.max(0, Math.min(meta, parseInt(o.sellos, 10) || 0)), premios: Math.max(0, parseInt(o.premios, 10) || 0),
      premio: String(o.premio || 'Un premio').slice(0, 60)
    };
    const par = ESTILO[d.estilo](x), cid = 'c' + x.uid, nombreA = esc(x.nombre);
    if(o.cara === 'banda'){
      const b = banda(x, d.estilo, par);
      return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1032 336" style="width:100%;height:auto;display:block" role="img" aria-label="Tarjeta de ' + nombreA + '">' + b.svg + '</svg>';
    }
    if(o.cara === 'logo'){
      const p = x.pal;
      return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 660 660" style="width:100%;height:auto;display:block" role="img" aria-label="Logo de ' + nombreA + '"><rect width="660" height="660" fill="' + p[2] + '"/>' + icono(x.icono, 150, 150, 360, p[0], 1.5) + '</svg>';
    }
    const cara = o.cara === 'frente' ? par.frente : par.dorso;
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto;display:block" role="img" aria-label="Tarjeta de sellos de ' + nombreA + '">' +
      '<defs><clipPath id="' + cid + '"><rect width="' + W + '" height="' + H + '" rx="44"/></clipPath></defs><g clip-path="url(#' + cid + ')">' + cara + '</g></svg>';
  }
  // Color de fondo que usa la banda de Wallet (para pintar el resto de la tarjeta igual)
  function colorBanda(diseno, giro){ const d = normalizar(diseno, giro); return BANDA[d.estilo](d.paleta).bg; }
  function png(texto, ancho){
    return new Promise((res, rej) => {
      const vb = String(texto).match(/viewBox="0 0 (\d+) (\d+)"/), vw = vb ? +vb[1] : W, vh = vb ? +vb[2] : H;
      const fijo = String(texto).replace(/ style="[^"]*"/, '').replace('<svg ', '<svg width="' + vw + '" height="' + vh + '" '), img = new Image(), url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(fijo);
      img.onload = () => {
        const w = ancho || 1500, c = document.createElement('canvas'); c.width = w; c.height = Math.round(w * vh / vw);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        c.toBlob((b) => b ? res(b) : rej(new Error('No se pudo crear la imagen')), 'image/png');
      };
      img.onerror = () => rej(new Error('No se pudo dibujar la tarjeta'));
      img.src = url;
    });
  }

  window.PuveTarjeta = { svg, png, colorBanda, sugerido, normalizar, ICONOS, GIROS, PALETAS, ESTILOS, FORMAS, W, H };
})();
