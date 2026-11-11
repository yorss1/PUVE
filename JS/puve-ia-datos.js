/* PUVE IA · Datos y análisis
 * Lee lo mismo que ya consulta Analítica (ventas, detalle de ventas, gastos, productos) y calcula lo que hace falta para dar
 * recomendaciones concretas: qué productos empujar, en cuáles no invertir, qué comprar, qué se compra junto, qué precio subir.
 * Solo lee. El cajero solo recibe sus propias ventas (filtro en la consulta y reglas de la base de datos).
 */
(function(){
  'use strict';
  let enlace = { sb: null, productos: () => [], rol: () => null, usuarioId: () => null };
  const suma = (d, dias) => { const x = new Date(d); x.setDate(x.getDate() + dias); return x; };
  const pad = (n) => String(n).padStart(2, '0');
  const fechaLocal = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const esCajero = () => enlace.rol() === 'vendedor';
  const puedeCostos = () => enlace.rol() === 'admin';
  const esFisico = (p) => (p.tipo || 'producto') === 'producto' && Number(p.stock) < 900000;

  async function paginar(armar){
    const salida = [];
    for(let pag = 0; pag < 14; pag++){
      const { data, error } = await armar().range(pag * 1000, pag * 1000 + 999);
      if(error) throw new Error(error.message || 'Error de consulta');
      salida.push(...(data || []));
      if(!data || data.length < 1000) break;
    }
    return salida;
  }
  const traerVentas = (d, h) => paginar(() => {
    let q = enlace.sb.from('ventas').select('id,total,created_at,usuario_id,metodo_pago').gte('created_at', d.toISOString()).lt('created_at', h.toISOString()).order('created_at', { ascending: true }).order('id', { ascending: true });
    if(esCajero()) q = q.eq('usuario_id', enlace.usuarioId());
    return q;
  });
  const traerDetalle = (d, h) => paginar(() => {
    let q = enlace.sb.from('detalle_ventas').select('id,venta_id,producto_id,producto_nombre,cantidad,subtotal,ventas!inner(created_at,usuario_id)').gte('ventas.created_at', d.toISOString()).lt('ventas.created_at', h.toISOString()).order('id', { ascending: true });
    if(esCajero()) q = q.eq('ventas.usuario_id', enlace.usuarioId());
    return q;
  });
  async function traerGastos(d, h){
    if(enlace.rol() !== 'admin') return null;
    const { data, error } = await enlace.sb.from('gastos').select('monto,fecha,categoria').gte('fecha', fechaLocal(d)).lte('fecha', fechaLocal(h));
    return error ? null : (data || []);
  }

  function calcular(ventas, detalle){
    const r = { n: ventas.length, total: 0, ticket: 0, porHora: new Array(24).fill(0), nHora: new Array(24).fill(0), porDia: new Array(7).fill(0), porMetodo: {}, porCajero: {}, productos: {}, margen: null };
    ventas.forEach((v) => {
      const tot = Number(v.total) || 0, f = new Date(v.created_at);
      r.total += tot; r.porHora[f.getHours()] += tot; r.nHora[f.getHours()]++; r.porDia[f.getDay()] += tot;
      const m = v.metodo_pago || 'efectivo'; r.porMetodo[m] = (r.porMetodo[m] || 0) + tot;
      if(v.usuario_id){ const c = r.porCajero[v.usuario_id] || (r.porCajero[v.usuario_id] = { n: 0, total: 0 }); c.n++; c.total += tot; }
    });
    r.ticket = r.n ? r.total / r.n : 0;
    if(detalle){
      const mapa = new Map(enlace.productos().map((p) => [p.id, p])); let marg = 0, hay = false;
      detalle.forEach((d) => {
        const nom = d.producto_nombre || 'Sin nombre', o = r.productos[nom] || (r.productos[nom] = { cant: 0, monto: 0, margen: 0, id: d.producto_id });
        const cant = Number(d.cantidad) || 0, sub = Number(d.subtotal) || 0; o.cant += cant; o.monto += sub;
        const p = mapa.get(d.producto_id);
        if(p && Number(p.costo) > 0 && puedeCostos()){ const g = sub - Number(p.costo) * cant; o.margen += g; marg += g; hay = true; }
      });
      r.margen = hay ? marg : null;
    }
    return r;
  }

  const memoria = new Map();
  function recordar(clave, ms, fn){
    const hit = memoria.get(clave);
    if(hit && Date.now() - hit.t < ms) return hit.d;
    const d = fn(); memoria.set(clave, { t: Date.now(), d });
    d.catch(() => memoria.delete(clave));
    if(memoria.size > 40) memoria.delete(memoria.keys().next().value);
    return d;
  }
  const quien = () => esCajero() ? enlace.usuarioId() : 'a';
  function cargarPeriodo(t, conDetalle){
    return recordar(['p', t.desde.getTime(), t.hasta.getTime(), conDetalle ? 1 : 0, quien()].join('|'), 45000, async () => {
      const [v1, v0, d1] = await Promise.all([traerVentas(t.desde, t.hasta), traerVentas(t.prevDesde, t.prevHasta), conDetalle ? traerDetalle(t.desde, t.hasta) : Promise.resolve(null)]);
      return { act: calcular(v1, d1), ant: calcular(v0, null), ventas: v1 };
    });
  }
  // igual pero también con el detalle del periodo anterior (para explicar por qué subieron o bajaron las ventas)
  function periodoCompleto(t){
    return recordar(['pc', t.desde.getTime(), t.hasta.getTime(), quien()].join('|'), 45000, async () => {
      const [v1, v0, d1, d0] = await Promise.all([traerVentas(t.desde, t.hasta), traerVentas(t.prevDesde, t.prevHasta), traerDetalle(t.desde, t.hasta), traerDetalle(t.prevDesde, t.prevHasta)]);
      return { act: calcular(v1, d1), ant: calcular(v0, d0), ventas: v1 };
    });
  }
  // ventas sumadas por día (para promedios, mejores días y proyecciones)
  function diario(dias){
    return recordar(['di', dias, quien()].join('|'), 300000, async () => {
      const ahora = new Date(), v = await traerVentas(suma(ahora, -dias), new Date(ahora.getTime() + 60000)), por = new Map();
      v.forEach((x) => { const k = fechaLocal(new Date(x.created_at)), o = por.get(k) || { fecha: k, total: 0, n: 0 }; o.total += Number(x.total) || 0; o.n++; por.set(k, o); });
      return [...por.values()].sort((a, b) => a.fecha < b.fecha ? -1 : 1);
    });
  }
  async function ultimaVenta(){
    let q = enlace.sb.from('ventas').select('created_at,total').order('created_at', { ascending: false }).limit(1);
    if(esCajero()) q = q.eq('usuario_id', enlace.usuarioId());
    const { data, error } = await q;
    return error || !data || !data.length ? null : data[0];
  }

  // ---------- análisis de productos (últimos 30 días contra los 30 anteriores) ----------
  function analisis(){
    return recordar(['a', quien()].join('|'), 120000, async () => {
      const ahora = new Date(), fin = new Date(ahora.getTime() + 60000), d30 = suma(ahora, -30), d60 = suma(ahora, -60);
      const detalle = await traerDetalle(d60, fin), prods = enlace.productos();
      const por = new Map(), ventasPor = new Map();
      detalle.forEach((d) => {
        const clave = d.producto_id || 'n:' + d.producto_nombre, f = new Date(d.ventas && d.ventas.created_at), en30 = f >= d30;
        const o = por.get(clave) || { u30: 0, uPrev: 0, ing30: 0, ultima: null }; const c = Number(d.cantidad) || 0;
        if(en30){ o.u30 += c; o.ing30 += Number(d.subtotal) || 0; } else o.uPrev += c;
        if(!o.ultima || f > o.ultima) o.ultima = f; por.set(clave, o);
        if(en30 && d.venta_id){ const s = ventasPor.get(d.venta_id) || new Set(); s.add(d.producto_nombre); ventasPor.set(d.venta_id, s); }
      });
      const lista = prods.filter((p) => p.activo !== false).map((p) => {
        const o = por.get(p.id) || { u30: 0, uPrev: 0, ing30: 0, ultima: null }, fisico = esFisico(p), costo = Number(p.costo) > 0 ? Number(p.costo) : null;
        const precioReal = o.u30 > 0 ? o.ing30 / o.u30 : (Number(p.precio) || 0), mUnit = costo != null && precioReal > 0 ? precioReal - costo : null;
        const vel = o.u30 / 30, stock = fisico ? Number(p.stock) : null;
        return { id: p.id, nombre: p.nombre, fisico, costo, precio: Number(p.precio) || 0, precioReal, stock, u30: o.u30, uPrev: o.uPrev, ing30: o.ing30, ultima: o.ultima,
          mUnit, mPct: mUnit != null && precioReal > 0 ? mUnit / precioReal : null, margen30: costo != null ? o.ing30 - costo * o.u30 : null, vel,
          dias: fisico ? (vel > 0 ? stock / vel : (stock > 0 ? Infinity : 0)) : null, capital: fisico && costo != null ? stock * costo : null,
          tend: o.uPrev > 0 ? (o.u30 - o.uPrev) / o.uPrev : (o.u30 > 0 ? 1 : 0) };
      });
      const pares = new Map();
      ventasPor.forEach((set) => { const a = [...set].sort(); for(let i = 0; i < a.length; i++) for(let j = i + 1; j < a.length; j++){ const k = a[i] + '\u0001' + a[j]; pares.set(k, (pares.get(k) || 0) + 1); } });
      const topPares = [...pares.entries()].filter(([, n]) => n >= 3).sort((x, y) => y[1] - x[1]).slice(0, 12).map(([k, n]) => { const [a, b] = k.split('\u0001'); return { a, b, n }; });
      return { lista, pares: topPares, hayCostos: lista.some((x) => x.costo != null), ing30: lista.reduce((s, x) => s + x.ing30, 0), ventas30: ventasPor.size };
    });
  }
  const compañero = (an, nombre) => { const x = an.pares.find((p) => p.a === nombre || p.b === nombre); return x ? { con: x.a === nombre ? x.b : x.a, veces: x.n } : null; };

  // ---------- cuánto se vende normalmente un día de la semana ----------
  function prediccion(diaSemana){
    return recordar(['pr', diaSemana, quien()].join('|'), 300000, async () => {
      const ahora = new Date(), ventas = await traerVentas(suma(ahora, -56), new Date(ahora.getTime() + 60000)), por = new Map();
      ventas.forEach((v) => { const f = new Date(v.created_at); if(f.getDay() !== diaSemana) return; const k = fechaLocal(f); por.set(k, (por.get(k) || 0) + (Number(v.total) || 0)); });
      const hoy = fechaLocal(ahora), dias = [...por.entries()].filter(([k]) => k !== hoy).map(([, v]) => v);
      if(!dias.length) return { n: 0 };
      const prom = dias.reduce((s, x) => s + x, 0) / dias.length;
      return { n: dias.length, prom, min: Math.min(...dias), max: Math.max(...dias) };
    });
  }

  window.PuveIaDatos = {
    enlazar(o){ enlace = Object.assign(enlace, o || {}); },
    reiniciar(){ memoria.clear(); },
    traerGastos, cargarPeriodo, periodoCompleto, diario, ultimaVenta, analisis, compañero, prediccion, calcular, esFisico, esCajero, puedeCostos, fechaLocal
  };
})();
