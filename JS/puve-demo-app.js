/* PUVE - Demo de TODA la aplicación (puve.html?demo=1).
 * Reemplaza a Supabase por un servidor falso que vive solo en la pestaña: no usa cuenta, no llama a ninguna red y nada se guarda.
 * Entra como Encargado de "Taquería La Esquina" (restaurante) con ventas, insumos y recetas de ejemplo. Al cerrar la pestaña todo desaparece.
 * El almacenamiento del navegador también se sustituye por uno en memoria, para no tocar la sesión ni el caché de una cuenta real.
 */
(function(){
  'use strict';
  if(window.__puveDemoApp) return; window.__puveDemoApp = true;
  // ---- Almacenamiento en memoria (no toca el de la cuenta real) ----
  function memoria(){ const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; }, clear: () => { for(const k in m) delete m[k]; }, key: (i) => Object.keys(m)[i] || null, get length(){ return Object.keys(m).length; } }; }
  const tema = (() => { try { return localStorage.getItem('puve_tema_oscuro'); } catch(e){ return null; } })();
  try { Object.defineProperty(window, 'localStorage', { value: memoria(), configurable: true }); } catch(e){}
  try { if(tema) localStorage.setItem('puve_tema_oscuro', tema); } catch(e){}

  const NEG = 'demo-negocio', UID = 'demo-usuario', ahora = () => new Date().toISOString();
  let seq = 1; const uid = (p) => (p || 'd') + '-' + (seq++) + '-' + Math.random().toString(36).slice(2, 7);
  const dia = (n, h, m) => { const d = new Date(); d.setDate(d.getDate() - n); d.setHours(h, m || 0, 0, 0); return d.toISOString(); };

  // ---------------- Datos de ejemplo ----------------
  const T = {};
  T.negocios = [{ id: NEG, nombre: 'Taquería La Esquina', dispositivos_permitidos: 3, pedidos_qr_activo: true, baneado: false, bloqueado_por_pago: false, pais: 'México', estado: 'Ciudad de México', municipio: 'Cuauhtémoc', codigo_postal: '06700', rfc: '', razon_social: '', regimen_fiscal: '', creado_en: dia(40, 9),
    configuracion: { tipo_negocio: 'restaurante', subgiro: 'restaurantes', corte_caja: true, categorias: true, codigo_barras: true, devoluciones: true, clientes: true, recompensas: { activo: true, pesos_por_punto: 10, valor_punto: 0.5 } } }];
  const CAJERO = /[?&]rol=cajero(&|$)/.test(location.search);
  T.perfiles = [{ id: UID, nombre: 'Tú (demo)', rol: CAJERO ? 'vendedor' : 'admin', negocio_id: NEG }];
  const cats = ['Tacos', 'Antojitos', 'Bebidas', 'Postres'].map((n, i) => ({ id: 'cat-' + (i + 1), negocio_id: NEG, nombre: n }));
  T.categorias = cats;
  const prod = (n, cat, precio, costo, sku) => ({ id: uid('prod'), negocio_id: NEG, nombre: n, categoria_id: cats[cat].id, precio, costo, stock: 999, stock_minimo: 0, sku, tipo: 'producto', activo: true, unidad: 'pza', foto_path: null, creado_en: dia(30, 9), stock_86: null, franjas_menu: ['manana', 'tarde', 'noche'], fechas_menu: [], precio_auto: false, precio_extra: 0 });
  T.productos = [prod('Taco al pastor', 0, 25, 9, 'TAC-001'), prod('Orden de 5 tacos de bistec', 0, 110, 48, 'TAC-002'), prod('Quesadilla de queso Oaxaca', 1, 60, 22, 'ANT-001'), prod('Torta de milanesa', 1, 95, 40, 'ANT-002'), prod('Agua de jamaica', 2, 35, 6, 'BEB-001'), prod('Horchata', 2, 38, 8, 'BEB-002'), prod('Refresco', 2, 30, 17, 'BEB-003'), prod('Flan casero', 3, 45, 14, 'POS-001')];
  const P = (n) => T.productos.find((p) => p.nombre === n);
  const ins = (n, u, stock, costo, min, pz) => ({ id: uid('ins'), negocio_id: NEG, nombre: n, unidad: u, stock, costo_unitario: costo, stock_minimo: min, piezas_por_unidad: pz || null, activo: true });
  T.insumos = [ins('Tortilla de maíz', 'kg', 6, 24, 2, 28), ins('Carne al pastor', 'kg', 8, 190, 3), ins('Bistec de res', 'kg', 1.5, 210, 2), ins('Cebolla', 'kg', 4, 22, 1), ins('Cilantro', 'kg', 0.8, 60, 0.3), ins('Queso Oaxaca', 'kg', 3, 160, 1), ins('Tortilla de harina', 'kg', 2, 38, 1, 12)];
  const I = (n) => T.insumos.find((x) => x.nombre === n);
  T.recetas_lineas = []; const linea = (pn, inom, q) => T.recetas_lineas.push({ id: uid('rl'), negocio_id: NEG, producto_id: P(pn).id, insumo_id: I(inom).id, cantidad: q, costo_guardado: I(inom).costo_unitario, mostrar: true, quitable: true });
  linea('Taco al pastor', 'Tortilla de maíz', 0.0357); linea('Taco al pastor', 'Carne al pastor', 0.05); linea('Taco al pastor', 'Cebolla', 0.01); linea('Taco al pastor', 'Cilantro', 0.004);
  linea('Quesadilla de queso Oaxaca', 'Tortilla de harina', 0.083); linea('Quesadilla de queso Oaxaca', 'Queso Oaxaca', 0.1);
  T.insumos_movimientos = [];
  T.ventas = []; T.detalle_ventas = [];
  const metodos = ['efectivo', 'efectivo', 'tarjeta', 'efectivo', 'transferencia'];
  for(let d = 14; d >= 0; d--){ const n = 5 + ((d * 7) % 6); for(let k = 0; k < n; k++){
    const p1 = T.productos[(d + k) % 8], p2 = T.productos[(d * 3 + k * 2) % 8], c1 = 1 + (k % 3), c2 = 1 + ((d + k) % 2), id = uid('vta');
    T.ventas.push({ id, negocio_id: NEG, usuario_id: UID, total: p1.precio * c1 + p2.precio * c2, metodo_pago: metodos[(d + k) % 5], monto_efectivo: null, created_at: dia(d, 13 + (k % 6), (k * 11) % 60), folio: 'D' + String(1000 + T.ventas.length), cancelada: false, perfiles: { nombre: 'Tú (demo)', rol: 'admin' } });
    T.detalle_ventas.push({ id: uid('dv'), venta_id: id, negocio_id: NEG, producto_id: p1.id, producto_nombre: p1.nombre, nombre: p1.nombre, cantidad: c1, precio: p1.precio, costo: p1.costo, subtotal: p1.precio * c1 }, { id: uid('dv'), venta_id: id, negocio_id: NEG, producto_id: p2.id, producto_nombre: p2.nombre, nombre: p2.nombre, cantidad: c2, precio: p2.precio, costo: p2.costo, subtotal: p2.precio * c2 }); } }
  T.gastos = [{ id: uid('g'), negocio_id: NEG, concepto: 'Gas', monto: 480, categoria: 'Servicios', created_at: dia(3, 10), fecha: dia(3, 10).slice(0, 10) }, { id: uid('g'), negocio_id: NEG, concepto: 'Renta del local', monto: 6500, categoria: 'Renta', created_at: dia(10, 10), fecha: dia(10, 10).slice(0, 10) }];
  T.proveedores = [{ id: uid('pv'), negocio_id: NEG, nombre: 'Carnes Don Beto', telefono: '5555550101' }];
  ['configuracion_puve', 'pagos_puve', 'dispositivos', 'codigos_cajero', 'solicitudes_cajero_extra', 'reglas_horario', 'reglas_clima', 'empleados', 'avisos_puve', 'solicitudes_pago', 'solicitudes_cambio_plan', 'escaneos_remotos', 'controles_funciones_puve', 'bugs_puve', 'impresiones', 'historial_cobros_puve', 'devoluciones', 'cortes_caja', 'backups_registro', 'auditoria_carrito', 'administradores_puve', 'solicitudes_factura', 'presentaciones_producto', 'preguntas_sin_respuesta', 'precios_volumen', 'pedidos_qr', 'pedidos_prog', 'ordenes_compra', 'movimientos_inventario', 'logs_seguridad', 'grupos_opciones', 'opciones_producto', 'clientes'].forEach((t) => { if(!T[t]) T[t] = []; });
  T.configuracion_puve = [{ id: 1, precio_mensual_dispositivo: 250 }];
  T.dispositivos = [{ id: uid('dp'), negocio_id: NEG, identificador: 'demo', nombre: 'Este dispositivo (demo)', activo: true, creado_en: dia(5, 9) }];

  // ---------------- Consultas ----------------
  const sing = (t) => t.replace(/ies$/, 'y').replace(/s$/, '');
  const valor = (r, c) => c.split('.').reduce((a, k) => (a == null ? a : a[k]), r);
  function embeber(tabla, filas, sel){
    const re = /([a-z_]+)\s*(?:!\w+)?\s*\(/g; let m; const out = [];
    while((m = re.exec(sel || '')) !== null) if(T[m[1]]) out.push(m[1]);
    if(!out.length) return filas;
    return filas.map((r) => { const c = Object.assign({}, r); out.forEach((e) => { const fk = sing(e) + '_id';
      if(r[fk] !== undefined) c[e] = (T[e].find((x) => x.id === r[fk]) || null);
      else c[e] = T[e].filter((x) => x[sing(tabla) + '_id'] === r.id); }); return c; });
  }
  class Q {
    constructor(t){ this.t = t; this.op = 'select'; this.f = []; this.ord = []; this.lim = null; this.rng = null; this.uno = null; this.sel = '*'; this.dat = null; this.cont = null; this.cabeza = false; this.devolver = false; }
    select(c, o){ if(this.op !== 'select'){ this.devolver = true; } this.sel = c || '*'; if(o && o.count) this.cont = o.count; if(o && o.head) this.cabeza = true; return this; }
    insert(d){ this.op = 'insert'; this.dat = d; return this; } update(d){ this.op = 'update'; this.dat = d; return this; } upsert(d){ this.op = 'upsert'; this.dat = d; return this; } delete(){ this.op = 'delete'; return this; }
    eq(c, v){ this.f.push((r) => valor(r, c) === v); return this; } neq(c, v){ this.f.push((r) => valor(r, c) !== v); return this; }
    gt(c, v){ this.f.push((r) => valor(r, c) > v); return this; } gte(c, v){ this.f.push((r) => valor(r, c) >= v); return this; } lt(c, v){ this.f.push((r) => valor(r, c) < v); return this; } lte(c, v){ this.f.push((r) => valor(r, c) <= v); return this; }
    in(c, a){ this.f.push((r) => a.indexOf(valor(r, c)) !== -1); return this; } is(c, v){ this.f.push((r) => (valor(r, c) == null ? null : valor(r, c)) === v); return this; }
    not(c, o, v){ this.f.push((r) => o === 'is' ? (valor(r, c) == null ? null : valor(r, c)) !== v : valor(r, c) !== v); return this; }
    ilike(c, v){ const re = new RegExp(String(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*'), 'i'); this.f.push((r) => re.test(String(valor(r, c) == null ? '' : valor(r, c)))); return this; } like(c, v){ return this.ilike(c, v); }
    contains(c, v){ this.f.push((r) => Array.isArray(valor(r, c)) && [].concat(v).every((x) => valor(r, c).indexOf(x) !== -1)); return this; } or(){ return this; } match(o){ for(const k in o) this.eq(k, o[k]); return this; } filter(){ return this; } textSearch(){ return this; }
    order(c, o){ this.ord.push([c, !(o && o.ascending === false)]); return this; } limit(n){ this.lim = n; return this; } range(a, b){ this.rng = [a, b]; return this; }
    single(){ this.uno = 'single'; return this; } maybeSingle(){ this.uno = 'maybe'; return this; } abortSignal(){ return this; } csv(){ return this; }
    then(ok, mal){ return Promise.resolve().then(() => this.correr()).then(ok, mal); }
    correr(){
      const tabla = T[this.t] || (T[this.t] = []), fuente = (this.op === 'select' && this.sel.indexOf('(') >= 0) ? embeber(this.t, tabla, this.sel) : tabla;   // los filtros como ventas.created_at necesitan la relación ya incluida
      let filas = fuente.filter((r) => this.f.every((fn) => fn(r))), res;
      if(this.op === 'insert' || this.op === 'upsert'){
        const nuevos = [].concat(this.dat).map((d) => Object.assign({ id: uid(this.t), negocio_id: NEG, created_at: ahora(), creado_en: ahora() }, d));
        nuevos.forEach((n) => { const i = this.op === 'upsert' ? tabla.findIndex((x) => x.id === n.id) : -1; if(i >= 0) Object.assign(tabla[i], n); else tabla.push(n); }); res = nuevos;
        if(!this.devolver) return { data: null, error: null };
      } else if(this.op === 'update'){ filas.forEach((r) => Object.assign(r, this.dat)); res = filas; if(!this.devolver) return { data: null, error: null }; }
      else if(this.op === 'delete'){ filas.forEach((r) => { const i = tabla.indexOf(r); if(i >= 0) tabla.splice(i, 1); }); return { data: null, error: null }; }
      else res = filas;
      this.ord.slice().reverse().forEach(([c, asc]) => res = res.slice().sort((a, b) => { const x = valor(a, c), y = valor(b, c); return (x > y ? 1 : x < y ? -1 : 0) * (asc ? 1 : -1); }));
      const total = res.length; if(this.rng) res = res.slice(this.rng[0], this.rng[1] + 1); if(this.lim != null) res = res.slice(0, this.lim);
      if(fuente === tabla) res = embeber(this.t, res, this.sel);
      if(this.cabeza) return { data: null, count: total, error: null };
      if(this.uno){ if(res.length === 1 || (this.uno === 'maybe' && res.length <= 1)) return { data: res[0] || null, error: null }; return { data: null, error: this.uno === 'single' ? { code: 'PGRST116', message: 'No se encontró el registro' } : null }; }
      return { data: JSON.parse(JSON.stringify(res)), count: this.cont ? total : undefined, error: null };
    }
  }

  // ---------------- Funciones del servidor (RPC) ----------------
  const falla = (m) => ({ data: null, error: { message: m } });
  const costoReceta = (pid) => T.recetas_lineas.filter((r) => r.producto_id === pid).reduce((a, r) => a + r.cantidad * T.insumos.find((i) => i.id === r.insumo_id).costo_unitario, 0);
  let turno = null, sangrias = [];
  const R = {
    es_admin_puve: () => false, es_superadmin_puve: () => false, negocio_al_corriente: () => true, mi_aceptacion_legal_vigente: () => true, aplicar_cambio_plan_pendiente_si_toca: () => null,
    // Turno de caja del cajero (todo en memoria)
    mi_turno_caja_abierto: () => turno, mis_sangrias_turno_abierto: () => sangrias.slice(),
    abrir_turno_caja: (a) => { if(turno) return falla('Ya tienes un turno abierto'); const f = Number(a.p_fondo_inicial); if(!(f >= 0)) return falla('El fondo inicial no es válido'); turno = { id: uid('turno'), fondo_inicial: f, abierto_en: ahora() }; sangrias = []; return turno.id; },
    registrar_sangria_caja: (a) => { if(!turno) return falla('Abre tu turno primero'); const mo = Number(a.p_monto); if(!(mo > 0)) return falla('El monto no es válido'); sangrias.push({ id: uid('sg'), monto: mo, motivo: a.p_motivo || null, creado_en: ahora() }); return null; },
    registrar_corte_caja: (a) => { const desde = turno ? turno.abierto_en : dia(0, 0); const efec = T.ventas.filter((v) => v.created_at >= desde && v.created_at <= ahora() && (v.metodo_pago === 'efectivo' || v.metodo_pago === 'mixto')).reduce((x, v) => x + Number(v.monto_efectivo || v.total), 0);
      const ini = turno ? turno.fondo_inicial : Number(a.p_efectivo_inicial || 0), ret = turno ? sangrias.reduce((x, s) => x + s.monto, 0) : Number(a.p_retiros || 0), esperado = ini + efec - ret, dif = Math.round((Number(a.p_efectivo_contado) - esperado) * 100) / 100;
      const fila = { id: uid('corte'), negocio_id: NEG, desde, hasta: ahora(), efectivo_inicial: ini, retiros: ret, efectivo_contado: a.p_efectivo_contado, efectivo_esperado: esperado, diferencia: dif, creado_en: ahora(), perfiles: { nombre: 'Tú (demo)' } };
      T.cortes_caja.push(fila); T.cortes_caja_cajero = (T.cortes_caja_cajero || []).concat([fila]); turno = null; sangrias = []; return { diferencia: dif }; },
    minijuego_resumen: () => ({ pedidos: 112, jugaron: 38, segundos_promedio: 410 }),
    minijuego_espera_configurar: (a) => { T.negocios[0].configuracion.minijuego_espera = !!a.p_activo; return null; }, pedidos_qr_configurar: (a) => { T.negocios[0].pedidos_qr_activo = !!a.p_activo; return null; },
    registrar_dispositivo: () => null, registrar_actividad: () => null, registrar_log_seguridad: () => null, tengo_pin_autorizacion_puve: () => false,
    obtener_controles_funciones_puve: () => [], obtener_correos_empresa_puve: () => ({}), obtener_config_publica_puve: () => ({ precio_mensual_dispositivo: 250, comision_embajador_pesos: 0 }), mi_soporte_humano_sin_leer: () => 0, mi_soporte_humano: () => [], productos_mas_vendidos: () => T.productos.slice(0, 6).map((p) => ({ producto_id: p.id })),
    aplicar_promos_horario: () => 0, canal_tiempo_real: () => null, mi_descuento_referido: () => 0, obtener_mi_codigo_referido: () => 'TAQUERIA10', mi_resumen_referidos: () => ({ porcentaje: 20, meses_descuento: 3, descuento_anual: 600, dias_recompensa: 30, pendientes: 2, pagados: 1, dias_ganados: 30, gracia_hasta: null }), pap_config: () => ({}),
    registrar_venta: (a) => { const items = a.p_items || []; let total = 0; const id = uid('vta'); const det = [];
      for(const it of items){ const p = T.productos.find((x) => x.id === it.producto_id || x.id === it.id); if(!p) continue; const c = Number(it.cantidad) || 1; total += p.precio * c; det.push({ id: uid('dv'), venta_id: id, negocio_id: NEG, producto_id: p.id, producto_nombre: p.nombre, nombre: p.nombre, cantidad: c, precio: p.precio, costo: p.costo, subtotal: p.precio * c });
        T.recetas_lineas.filter((r) => r.producto_id === p.id).forEach((r) => { const i = T.insumos.find((x) => x.id === r.insumo_id); i.stock = Math.max(0, Math.round((i.stock - r.cantidad * c) * 1000) / 1000); }); }
      if(!det.length) return falla('El carrito está vacío'); T.ventas.push({ id, negocio_id: NEG, usuario_id: UID, total, metodo_pago: a.p_metodo_pago || 'efectivo', monto_efectivo: a.p_monto_efectivo || null, created_at: ahora(), folio: 'D' + (1000 + T.ventas.length), cancelada: false, perfiles: { nombre: 'Tú (demo)', rol: 'admin' } }); T.detalle_ventas.push(...det); return id; },
    registrar_ventas_lote: (a) => (a.p_ventas || []).map((v) => ({ id: v.id, ok: true })),
    recetas_costeo: () => { const ids = []; T.recetas_lineas.forEach((r) => { if(ids.indexOf(r.producto_id) < 0) ids.push(r.producto_id); });
      return ids.map((pid) => { const p = T.productos.find((x) => x.id === pid), ls = T.recetas_lineas.filter((r) => r.producto_id === pid);
        return { producto_id: pid, nombre: p.nombre, precio: p.precio, costo: Math.round(costoReceta(pid) * 100) / 100, costo_guardado: Math.round(ls.reduce((a, r) => a + r.cantidad * r.costo_guardado, 0) * 100) / 100,
          lineas: ls.map((r) => { const i = T.insumos.find((x) => x.id === r.insumo_id); return { insumo_id: i.id, nombre: i.nombre, unidad: i.unidad, cantidad: r.cantidad, costo_unitario: i.costo_unitario, costo_linea: Math.round(r.cantidad * i.costo_unitario * 100) / 100, mostrar: r.mostrar, quitable: r.quitable }; }) }; }); },
    insumo_guardar: (a) => { if(!String(a.p_nombre || '').trim()) return falla('El nombre debe tener de 1 a 60 letras'); if(T.insumos.some((i) => i.activo && i.nombre.toLowerCase() === a.p_nombre.trim().toLowerCase() && i.id !== a.p_id)) return falla('Ya tienes un insumo con ese nombre');
      if(a.p_id){ Object.assign(T.insumos.find((i) => i.id === a.p_id), { nombre: a.p_nombre.trim(), unidad: a.p_unidad, costo_unitario: a.p_costo, stock_minimo: a.p_minimo }); return a.p_id; }
      const n = { id: uid('ins'), negocio_id: NEG, nombre: a.p_nombre.trim(), unidad: a.p_unidad, stock: 0, costo_unitario: a.p_costo, stock_minimo: a.p_minimo || 0, piezas_por_unidad: null, activo: true }; T.insumos.push(n); return n.id; },
    insumo_piezas: (a) => { const i = T.insumos.find((x) => x.id === a.p_id); if(!i) return falla('Insumo no encontrado'); i.piezas_por_unidad = a.p_piezas; return null; },
    insumo_archivar: (a) => { const i = T.insumos.find((x) => x.id === a.p_id); if(i) i.activo = false; return null; },
    insumo_ajustar: (a) => { const i = T.insumos.find((x) => x.id === a.p_id); if(!i) return falla('Insumo no encontrado'); const q = Number(a.p_cantidad) || 0;
      if(a.p_tipo === 'entrada'){ if(a.p_costo != null && i.stock + q > 0) i.costo_unitario = Math.round((i.stock * i.costo_unitario + q * a.p_costo) / (i.stock + q) * 10000) / 10000; i.stock += q; } else if(a.p_tipo === 'merma') i.stock = Math.max(0, i.stock - q); else i.stock = q; return null; },
    receta_guardar: (a) => { T.recetas_lineas = T.recetas_lineas.filter((r) => r.producto_id !== a.p_producto);
      (a.p_lineas || []).forEach((l) => { const i = T.insumos.find((x) => x.id === l.insumo_id); if(!i) return; T.recetas_lineas.push({ id: uid('rl'), negocio_id: NEG, producto_id: a.p_producto, insumo_id: i.id, cantidad: l.cantidad, costo_guardado: i.costo_unitario, mostrar: l.mostrar !== false, quitable: l.quitable !== false }); }); return null; },
    receta_aceptar_costos: (a) => { T.recetas_lineas.filter((r) => r.producto_id === a.p_producto).forEach((r) => { r.costo_guardado = T.insumos.find((i) => i.id === r.insumo_id).costo_unitario; }); return null; },
    receta_precio_auto: (a) => { const p = T.productos.find((x) => x.id === a.p_producto), c = costoReceta(a.p_producto); if(a.p_auto && c <= 0) return falla('Para calcular el precio, los ingredientes necesitan un costo mayor a $0'); p.precio_auto = !!a.p_auto; p.precio_extra = a.p_extra; if(a.p_auto) p.precio = Math.round((c + a.p_extra) * 100) / 100; return null; },
    recetas_recalcular_precios: () => { let n = 0; T.productos.filter((p) => p.precio_auto).forEach((p) => { const c = costoReceta(p.id); if(c > 0){ const nv = Math.round((c + p.precio_extra) * 100) / 100; if(nv !== p.precio){ p.precio = nv; n++; } } }); return n; },
    caducidad_resumen: () => [], tiempos_servicio: () => [], ingenieria_menu: () => [], propinas_resumen: () => [],
    ventas_por_hora: () => { const h = {}; T.ventas.forEach((v) => { const k = new Date(v.created_at).getHours(); h[k] = h[k] || { hora: k, ventas: 0, total: 0 }; h[k].ventas++; h[k].total += v.total; }); return Object.values(h); },
    obtener_plano_salon: () => null, mis_qr_mesas: () => [], cocina_enlaces_listar: () => []
  };
  const rpc = (n, a) => Promise.resolve().then(() => { const f = R[n]; if(!f){ if(window.console) console.info('[demo] función sin simular:', n); return { data: null, error: null }; }
    const d = f(a || {}); return (d && d.error) ? d : { data: d === undefined ? null : d, error: null }; });

  // ---------------- Cliente falso ----------------
  const usuario = { id: UID, email: 'demo@puve.mx', user_metadata: { nombre: 'Tú (demo)' }, app_metadata: {} }, sesion = { access_token: 'demo', refresh_token: 'demo', user: usuario };
  const canal = () => { const c = { on: () => c, subscribe: () => c, unsubscribe: () => {}, send: () => Promise.resolve('ok') }; return c; };
  const cliente = {
    from: (t) => new Q(t), rpc,
    auth: { getSession: () => Promise.resolve({ data: { session: sesion }, error: null }), getUser: () => Promise.resolve({ data: { user: usuario }, error: null }),
      signOut: () => { try { (window.top || window).location.href = 'index.html'; } catch(e){ location.href = 'index.html'; } return Promise.resolve({ error: null }); }, setSession: () => Promise.resolve({ data: { session: sesion }, error: null }),
      signInWithPassword: () => Promise.resolve({ data: { session: sesion, user: usuario }, error: null }), signUp: () => Promise.resolve({ data: null, error: { message: 'Es una demo: crea tu cuenta real en puve.html.' } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }), refreshSession: () => Promise.resolve({ data: { session: sesion }, error: null }) },
    functions: { invoke: () => Promise.resolve({ data: null, error: { message: 'Esta función no está disponible en la demo.' } }) },
    storage: { from: () => ({ upload: () => Promise.resolve({ data: null, error: { message: 'Subir fotos no está disponible en la demo.' } }), getPublicUrl: () => ({ data: { publicUrl: '' } }), remove: () => Promise.resolve({ data: null, error: null }), createSignedUrl: () => Promise.resolve({ data: null, error: null }) }) },
    channel: canal, removeChannel: () => {}, removeAllChannels: () => {}
  };
  window.supabase = { createClient: () => cliente }; window.__puveDemoDatos = T;

  // ---------------- Arranque automático + franja de aviso ----------------
  document.addEventListener('DOMContentLoaded', () => {
    const b = document.createElement('div'); b.setAttribute('role', 'status');
    b.style.cssText = 'position:fixed; left:0; right:0; bottom:0; z-index:99999; background:#111; color:#fff; font:600 13px Inter,system-ui,sans-serif; padding:8px 12px calc(8px + env(safe-area-inset-bottom,0px)); display:flex; gap:10px; align-items:center; justify-content:center; flex-wrap:wrap; text-align:center;';
    const st = document.createElement('style'); st.textContent = '.pcs-fondo{display:none!important}'; document.head.appendChild(st);   // sin aviso de cookies en la demo
    b.innerHTML = '<span>DEMO · nada se guarda ni se envía</span><a href="puve.html?demo=1' + (CAJERO ? '' : '&rol=cajero') + '" style="color:#fff; text-decoration:underline;">' + (CAJERO ? 'Ver como Encargado' : 'Ver como Cajero (para vender)') + '</a><a href="puve.html#registro" target="_top" style="color:#111; background:#fff; padding:5px 12px; border-radius:999px; text-decoration:none;">Crear mi cuenta gratis</a>';
    let enMarco = false; try { enMarco = window.self !== window.top; } catch(e){ enMarco = true; }
    if(enMarco){ b.innerHTML = '<span>DEMO · nada se guarda ni se envía</span>'; b.style.padding = '6px 10px calc(6px + env(safe-area-inset-bottom,0px))'; b.style.fontSize = '12px'; }   // dentro del celular de la página: los botones ya están afuera
    document.body.appendChild(b); document.body.style.paddingBottom = enMarco ? '30px' : '48px';
    let intentos = 0; const t = setInterval(() => { intentos++;
      if(window.__usuarioSesionPendiente && typeof window.continuarSesion === 'function'){ clearInterval(t); try { window.continuarSesion(); } catch(e){ console.error(e); } }
      else if(intentos > 80) clearInterval(t); }, 150);
  });
})();
