/* PUVE - Modo demostración. Simula un negocio de comida SOLO en el navegador de quien prueba: no usa cuenta, no llama a ningún servidor
 * y no envía nada a nadie. Lo usan pedir.html y cocina.html cuando se abren con ?demo=1, y la demo de index.html.
 * El estado (pedidos, agotados) se guarda en localStorage con una sola llave, así el menú del cliente y la pantalla de cocina
 * "ven lo mismo" aunque estén en pestañas o marcos distintos: el cliente pide, la cocina lo ve, la cocina lo marca listo y el cliente lo ve avanzar.
 * Las fotos son dibujos con emoji generados aquí mismo (sin imágenes externas).
 */
(function(){
  'use strict';
  if(window.PuveDemo) return;
  var KEY = 'puve_demo_v1', MEM = null;

  // ---------- Menú de ejemplo (mismo formato que entrega menu_publico_qr) ----------
  var C = { tacos: 'd0000001-0000-4000-8000-000000000001', antojitos: 'd0000001-0000-4000-8000-000000000002', bebidas: 'd0000001-0000-4000-8000-000000000003', postres: 'd0000001-0000-4000-8000-000000000004' };
  var I = function(n, q){ return { n: n, q: q !== false }; };   // ingrediente: q = el cliente puede quitarlo
  var MENU = {
    negocio: 'Taquería La Esquina', favicon: null, giro: 'restaurante', demo: true,
    categorias: [{ id: C.tacos, nombre: 'Tacos' }, { id: C.antojitos, nombre: 'Antojitos' }, { id: C.bebidas, nombre: 'Bebidas' }, { id: C.postres, nombre: 'Postres' }],
    grupos: [
      { id: 'd0000002-0000-4000-8000-000000000001', nombre: 'Tamaño', tipo: 'uno', requerido: true, categoria_id: C.bebidas, opciones: [{ id: 'd0000003-0000-4000-8000-000000000001', nombre: 'Chico', extra: 0 }, { id: 'd0000003-0000-4000-8000-000000000002', nombre: 'Mediano', extra: 10 }, { id: 'd0000003-0000-4000-8000-000000000003', nombre: 'Grande', extra: 20 }] },
      { id: 'd0000002-0000-4000-8000-000000000002', nombre: 'Extras', tipo: 'varios', requerido: false, categoria_id: null, opciones: [{ id: 'd0000003-0000-4000-8000-000000000011', nombre: 'Queso extra', extra: 15 }, { id: 'd0000003-0000-4000-8000-000000000012', nombre: 'Aguacate', extra: 12 }, { id: 'd0000003-0000-4000-8000-000000000013', nombre: 'Salsa extra', extra: 5 }] }
    ],
    productos: [
      { id: 'd0000004-0000-4000-8000-000000000001', nombre: 'Taco al pastor', categoria_id: C.tacos, foto: 'demo:taco', etiquetas: ['picante'], precio: 25, ingredientes: [I('Tortilla de maíz', false), I('Carne al pastor', false), I('Piña'), I('Cebolla'), I('Cilantro'), I('Salsa roja')] },
      { id: 'd0000004-0000-4000-8000-000000000002', nombre: 'Orden de 5 tacos de bistec', categoria_id: C.tacos, foto: 'demo:carne', etiquetas: [], precio: 110, ingredientes: [I('Tortilla de maíz', false), I('Bistec', false), I('Cebolla'), I('Cilantro'), I('Limón'), I('Salsa verde')] },
      { id: 'd0000004-0000-4000-8000-000000000003', nombre: 'Quesadilla de queso Oaxaca', categoria_id: C.antojitos, foto: 'demo:queso', etiquetas: ['lacteos', 'gluten', 'vegetariano'], precio: 60, ingredientes: [I('Tortilla de harina', false), I('Queso Oaxaca', false), I('Salsa roja'), I('Crema')] },
      { id: 'd0000004-0000-4000-8000-000000000004', nombre: 'Torta de milanesa', categoria_id: C.antojitos, foto: 'demo:torta', etiquetas: ['gluten', 'huevo'], precio: 95, ingredientes: [I('Pan telera', false), I('Milanesa de res', false), I('Aguacate'), I('Jitomate'), I('Lechuga'), I('Mayonesa'), I('Frijoles')] },
      { id: 'd0000004-0000-4000-8000-000000000005', nombre: 'Agua de jamaica', categoria_id: C.bebidas, foto: 'demo:jamaica', etiquetas: ['vegano'], precio: 35, ingredientes: [] },
      { id: 'd0000004-0000-4000-8000-000000000006', nombre: 'Horchata', categoria_id: C.bebidas, foto: 'demo:horchata', etiquetas: ['lacteos'], precio: 38, ingredientes: [] },
      { id: 'd0000004-0000-4000-8000-000000000007', nombre: 'Flan casero', categoria_id: C.postres, foto: 'demo:flan', etiquetas: ['lacteos', 'huevo'], precio: 45, ingredientes: [] },
      { id: 'd0000004-0000-4000-8000-000000000008', nombre: 'Sopa del día', categoria_id: C.antojitos, foto: null, etiquetas: [], precio: 55, ingredientes: [] }
    ]
  };
  var EMOJI = { taco: '🌮', carne: '🥩', queso: '🧀', torta: '🥪', jamaica: '🍹', horchata: '🥛', flan: '🍮' };
  // Dibujo cuadrado con un emoji grande sobre un fondo cálido (así el color dominante sale del platillo, no del fondo)
  function foto(clave){
    var e = EMOJI[clave] || '🍽️';
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="480" viewBox="0 0 480 480"><defs><radialGradient id="g" cx="50%" cy="42%" r="65%"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#efe7dc"/></radialGradient></defs><rect width="480" height="480" fill="url(#g)"/><ellipse cx="240" cy="396" rx="118" ry="15" fill="rgba(0,0,0,.08)"/><text x="240" y="305" font-size="270" text-anchor="middle" font-family="Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif">' + e + '</text></svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }
  var OPCIONES = {}; MENU.grupos.forEach(function(g){ g.opciones.forEach(function(o){ OPCIONES[o.id] = { g: g, o: o }; }); });
  var PRODUCTOS = {}; MENU.productos.forEach(function(p){ PRODUCTOS[p.id] = p; });
  var CATEGORIA = {}; MENU.categorias.forEach(function(c){ CATEGORIA[c.id] = c.nombre; });

  // ---------- Estado compartido ----------
  var iso = function(t){ return new Date(t == null ? Date.now() : t).toISOString(); };
  function leer(){
    try { var t = localStorage.getItem(KEY); if(t){ var s = JSON.parse(t); if(s && Array.isArray(s.pedidos)) return s; } } catch(e){}
    return MEM || sembrar();
  }
  function guardar(s){ MEM = s; try { localStorage.setItem(KEY, JSON.stringify(s)); } catch(e){} return s; }
  function item(pid, cant, ops, quitar){
    var p = PRODUCTOS[pid], o = (ops || []).map(function(id){ return { g: OPCIONES[id].g.nombre, o: OPCIONES[id].o.nombre, x: OPCIONES[id].o.extra }; }).concat((quitar || []).map(function(n){ return { g: 'Sin', o: n, x: 0 }; }));
    var pu = Number(p.precio) + o.reduce(function(a, x){ return a + Number(x.x || 0); }, 0);
    return { cantidad: cant, nombre: p.nombre, categoria: CATEGORIA[p.categoria_id] || '', precio: pu, opciones: o };
  }
  function sembrar(){   // dos pedidos de ejemplo para que la cocina no se vea vacía la primera vez
    var t = Date.now(), s = { n: 2, agotados: {}, visto: 0, pedidos: [
      { id: 'demo-1', codigo: 'demo1', mesa: '2', alias: null, nota: null, estado: 'preparando', minutos: 15, creado_en: iso(t - 6 * 60000), actualizado_en: iso(t - 5 * 60000), auto: false, items: [item('d0000004-0000-4000-8000-000000000001', 3, [], ['Cebolla']), item('d0000004-0000-4000-8000-000000000005', 1, ['d0000003-0000-4000-8000-000000000002'], [])] },
      { id: 'demo-2', codigo: 'demo2', mesa: '7', alias: null, nota: 'Sin picante, por favor', estado: 'por_confirmar', minutos: null, creado_en: iso(t - 60000), actualizado_en: iso(t - 60000), auto: false, items: [item('d0000004-0000-4000-8000-000000000003', 1, ['d0000003-0000-4000-8000-000000000011'], [])] }
    ] };
    return guardar(s);
  }
  function reiniciar(){ MEM = null; try { localStorage.removeItem(KEY); } catch(e){} return sembrar(); }
  function total(p){ return p.items.reduce(function(a, i){ return a + i.cantidad * i.precio; }, 0); }

  // Si nadie está atendiendo en la cocina, el pedido del cliente avanza solo (para que la demo no se quede esperando).
  function avanzar(s){
    var cambio = false, t = Date.now(), cocinaActiva = s.visto && t - s.visto < 12000;
    s.pedidos.forEach(function(p){
      if(!p.auto || cocinaActiva || p.estado === 'entregado' || p.estado === 'cancelado') return;
      var edad = t - new Date(p.creado_en).getTime(), objetivo = edad > 45000 ? 'entregado' : edad > 24000 ? 'listo' : edad > 6000 ? 'preparando' : 'por_confirmar';
      if(objetivo !== p.estado){ p.estado = objetivo; p.actualizado_en = iso(t); if(objetivo === 'preparando') p.minutos = 10; cambio = true; }
    });
    if(cambio) guardar(s); return s;
  }

  // ---------- API del cliente (reemplaza a la función pedido-qr) ----------
  var R = function(d, status){ return Promise.resolve({ ok: !status || status < 400, status: status || 200, d: d }); };
  function pedirApi(b){
    var s = avanzar(leer());
    if(b.accion === 'menu'){
      var m = JSON.parse(JSON.stringify(MENU)); m.productos = m.productos.filter(function(p){ return !s.agotados[p.id]; }); m.productos.forEach(function(p){ if(p.foto) p.foto = p.foto; }); return R(m);
    }
    if(b.accion === 'crear'){
      var items = []; (b.items || []).forEach(function(l){ if(PRODUCTOS[l.producto_id]) items.push(item(l.producto_id, Math.max(1, Math.min(20, Number(l.cantidad) || 1)), (l.opciones || []).filter(function(id){ return OPCIONES[id]; }), (l.quitar || []).slice(0, 10))); });
      if(!items.length) return R({ error: 'Tu pedido está vacío.' }, 400);
      s.n++; var p = { id: 'demo-' + s.n, codigo: 'demo' + s.n + 'x' + Math.floor(Math.random() * 1e6), mesa: String(b.mesa || '5').slice(0, 12), alias: b.alias ? String(b.alias).slice(0, 30) : null, nota: b.nota ? String(b.nota).slice(0, 200) : null, estado: 'por_confirmar', minutos: null, creado_en: iso(), actualizado_en: iso(), auto: true, items: items };
      s.pedidos.push(p); guardar(s); return R({ codigo: p.codigo, total: total(p) });
    }
    if(b.accion === 'estado'){
      var q = s.pedidos.filter(function(x){ return x.codigo === b.codigo; })[0]; if(!q) return R({ error: 'No encontrado' }, 404);
      return R({ estado: q.estado, alias: q.alias, mesa: q.mesa, minutos: q.minutos, actualizado_en: q.actualizado_en, total: total(q), items: q.items.map(function(i){ return { cantidad: i.cantidad, nombre: i.nombre, precio: i.precio, opciones: i.opciones }; }) });
    }
    return R({ error: 'Acción no válida' }, 400);
  }

  // ---------- API de la cocina (reemplaza a cocina-pedidos) ----------
  function cocinaApi(b){
    var s = leer(); if(b.accion === 'listar'){ s.visto = Date.now(); guardar(s); } s = avanzar(s);
    if(b.accion === 'listar'){
      return R({ ahora: iso(), negocio: MENU.negocio, plano: null, canal: null, pedidos: s.pedidos.filter(function(p){ return p.estado === 'por_confirmar' || p.estado === 'preparando' || p.estado === 'listo'; }).map(function(p){ return { id: p.id, mesa: p.mesa, alias: p.alias, estado: p.estado, creado_en: p.creado_en, actualizado_en: p.actualizado_en, minutos: p.minutos, nota: p.nota, items: p.items }; }) });
    }
    if(b.accion === 'estado'){
      var p = s.pedidos.filter(function(x){ return x.id === b.id; })[0]; if(!p) return R({ error: 'No encontrado' }, 404);
      if(['preparando', 'listo', 'entregado', 'cancelado'].indexOf(b.estado) === -1) return R({ error: 'Estado no válido' }, 400);
      p.estado = b.estado; p.actualizado_en = iso(); if(b.minutos) p.minutos = Number(b.minutos); p.auto = false; guardar(s); return R({ ok: true });
    }
    if(b.accion === 'menu') return R({ menu: MENU.productos.map(function(p){ return { id: p.id, nombre: p.nombre, categoria: CATEGORIA[p.categoria_id] || '', agotado: !!s.agotados[p.id] }; }) });
    if(b.accion === 'agotar'){ if(b.agotado) s.agotados[b.id] = true; else delete s.agotados[b.id]; guardar(s); return R({ ok: true }); }
    return R({ error: 'Acción no válida' }, 400);
  }

  function suscribir(fn){ window.addEventListener('storage', function(e){ if(e.key === KEY) fn(); }); }
  window.PuveDemo = { menu: MENU, foto: foto, pedirApi: pedirApi, cocinaApi: cocinaApi, reiniciar: reiniciar, suscribir: suscribir, llave: KEY };
})();
