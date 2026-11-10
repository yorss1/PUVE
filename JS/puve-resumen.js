/* PUVE - Resumen (PUVE IA)
 * Un chat que contesta en palabras muy simples cómo va el negocio: ventas, ganancia, gastos, lo que más y menos se vende,
 * inventario, caducidades, horas fuertes, formas de pago, cajeros, clientes y recomendaciones.
 * NO usa modelos externos: entiende la pregunta con diccionarios de palabras (como Atención a cliente), lee los datos que PUVE ya
 * consulta en Analítica y arma las respuestas con frases según cada situación. Se muestran como tarjetitas (notificaciones).
 * Solo lee: no cambia ventas, inventario ni precios. La seguridad la dan las reglas de la base (RLS): cada quien solo recibe
 * lo de su negocio; el cajero solo ve lo suyo y nada de ganancias, gastos ni costos.
 */
(function(){
  'use strict';
  let enlace = {
    sb: null,
    dinero: (n) => '$' + Number(n || 0).toLocaleString('es-MX', { maximumFractionDigits: 2 }),
    productos: () => [], rol: () => null, usuarioId: () => null
  };
  const DIAS_SEM = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
  const DIAS_BONITO = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const NUMEROS = { una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12 };

  // ---------- utilidades ----------
  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9: -]/g, ' ').replace(/\s+/g, ' ').trim();
  const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pad = (n) => String(n).padStart(2, '0');
  const cap = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  const inicioDia = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const suma = (d, dias) => { const x = new Date(d); x.setDate(x.getDate() + dias); return x; };
  const conHora = (d, h, m) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m || 0);
  const fechaLocal = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const $d = (n) => enlace.dinero(n);
  const $r = (n) => enlace.dinero(Math.round(Number(n) || 0));
  const SIN_PREP = /^(hoy|ayer|antier|el (lunes|martes|miércoles|jueves|viernes|sábado|domingo|\d))/;
  const en = (t) => SIN_PREP.test(t.etiqueta) ? t.etiqueta : 'en ' + t.etiqueta;
  const de = (t) => SIN_PREP.test(t.etiqueta) && !/^el /.test(t.etiqueta) ? t.etiqueta : (/^el /.test(t.etiqueta) ? 'del ' + t.etiqueta.slice(3) : 'de ' + t.etiqueta);
  const fmt = (n) => { n = Number(n) || 0; return Number.isInteger(n) ? String(n) : n.toFixed(1); };
  const veces = (n, s, p) => n + ' ' + (n === 1 ? s : p);
  const lista = (a) => a.length <= 1 ? a.join('') : a.slice(0, -1).join(', ') + ' y ' + a[a.length - 1];
  const semilla = () => { const d = new Date(); return d.getFullYear() * 372 + d.getMonth() * 31 + d.getDate(); };
  const variante = (arr, extra) => arr[Math.abs(semilla() + (extra || 0)) % arr.length];
  const esCajero = () => enlace.rol() === 'vendedor';
  const puedeCostos = () => enlace.rol() === 'admin';
  const carta = (tono, icono, titulo, texto, consejo, acciones) => ({ tono, icono, titulo, texto, consejo: consejo || null, acciones: acciones || null });

  // ---------- horas en palabras ----------
  function horaT(h, m){ const b = h % 24 === 0 ? 12 : (h % 24 > 12 ? h % 24 - 12 : h % 24); return b + (m ? ':' + pad(m) : ''); }
  function perT(h){ h = h % 24; if(h === 12) return 'del día'; if(h === 0) return 'de la noche'; if(h < 12) return 'de la mañana'; return h < 19 ? 'de la tarde' : 'de la noche'; }
  function rangoTexto(hh){
    if(hh.nombre) return { manana: 'en la mañana', tarde: 'en la tarde', noche: 'en la noche' }[hh.nombre];
    const p1 = perT(hh.h1), p2 = perT(hh.h2), a = horaT(hh.h1, hh.m1), b = horaT(hh.h2, hh.m2);
    return p1 === p2 ? 'de ' + a + ' a ' + b + ' ' + p1 : 'de ' + a + ' ' + p1 + ' a ' + b + ' ' + p2;
  }
  function horaFuerteTexto(h){ return rangoTexto({ h1: h, m1: 0, h2: h + 1, m2: 0 }); }

  // ---------- entender el horario de la pregunta ----------
  function resolverHora(n, mer, global){
    n = Number(n);
    if(n >= 13) return n;
    const m = mer || global;
    if(m === 'am') return n === 12 ? 0 : n;
    if(m === 'pm') return n === 12 ? 12 : n + 12;
    if(n >= 1 && n <= 6) return n + 12;   // en una tienda "de 2 a 5" casi siempre es de la tarde
    return n;
  }
  function extraerHoras(t0){
    const t = t0.replace(/(^| )(una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)(?= |$)/g, (x, sp, w) => sp + NUMEROS[w]);
    const global = /(^| )(de|en|por|a) la (tarde|noche)/.test(t) ? 'pm' : (/(^| )(de|en|por) la manana/.test(t) ? 'am' : null);
    const mer = (s) => !s ? null : (s.charAt(0) === 'a' ? 'am' : 'pm');
    const NO = '(?!\\s*(?:dias|dia|semanas|semana|meses|mes|piezas|productos|pesos|ventas|articulos|veces|clientes|unidades))';
    let m = t.match(new RegExp('(?:^| )(?:de|desde|entre)\\s+(?:las |la )?(\\d{1,2})(?::(\\d{2}))?\\s*(am|pm|a m|p m)?(?:\\s*(?:horas|hrs|hs|h))?(?:\\s+(?:a|hasta|y)\\s+|\\s*-\\s*)(?:las |la )?(\\d{1,2})(?::(\\d{2}))?\\s*(am|pm|a m|p m)?' + NO));
    if(m){
      if(Number(m[1]) > 24 || Number(m[4]) > 24) return null;
      const gl = global || mer(m[6]) || mer(m[3]);
      const h1 = resolverHora(m[1], mer(m[3]), gl);
      let h2 = resolverHora(m[4], mer(m[6]), gl);
      if(h2 <= h1){ if(h2 < 12 && h2 + 12 > h1) h2 += 12; else h2 = Math.min(24, h1 + 1); }
      return { h1, m1: Number(m[2]) || 0, h2: Math.min(24, h2), m2: Number(m[5]) || 0 };
    }
    m = t.match(new RegExp('(?:^| )a las? (\\d{1,2})(?::(\\d{2}))?\\s*(am|pm|a m|p m)?' + NO));
    if(m && Number(m[1]) <= 24){
      const h = resolverHora(m[1], mer(m[3]), global), mm = Number(m[2]) || 0;
      return { h1: h, m1: mm, h2: Math.min(24, h + 1), m2: mm };
    }
    m = t.match(/(?:^| )(?:esta|en la|por la|de la) (manana|tarde|noche)(?: |$)/);
    if(m){ const r = { manana: [6, 12], tarde: [12, 19], noche: [19, 24] }[m[1]]; return { h1: r[0], m1: 0, h2: r[1], m2: 0, nombre: m[1] }; }
    return null;
  }

  function parseTiempo(texto, ahoraRef){
    const t = norm(texto), ahora = ahoraRef || new Date(), hoy0 = inicioDia(ahora);
    const r = { tipo: 'dia', explicito: false };
    let dia = null, diaEt = null, m;
    if(/(^| )(antier|anteayer)( |$)/.test(t)){ dia = suma(hoy0, -2); diaEt = 'antier'; }
    else if(/(^| )ayer( |$)/.test(t)){ dia = suma(hoy0, -1); diaEt = 'ayer'; }
    else if(/(^| )hoy( |$)/.test(t)){ dia = hoy0; diaEt = 'hoy'; }
    if(!dia && (m = t.match(/(?:^| )(domingo|lunes|martes|miercoles|jueves|viernes|sabado)(?: |$)/))){
      const idx = DIAS_SEM.indexOf(m[1]), dif = (hoy0.getDay() - idx + 7) % 7;
      dia = suma(hoy0, -dif); diaEt = dif === 0 ? 'hoy' : 'el ' + DIAS_BONITO[idx];
    }
    if(!dia && (m = t.match(new RegExp('(?:^| )(\\d{1,2}) de (' + MESES.join('|') + ')(?: |$)')))){
      const mes = MESES.indexOf(m[2]); let d = new Date(ahora.getFullYear(), mes, Number(m[1]));
      if(d > hoy0) d = new Date(ahora.getFullYear() - 1, mes, Number(m[1]));
      dia = d; diaEt = 'el ' + m[1] + ' de ' + m[2];
    }
    const lunesDe = (d) => suma(d, -((d.getDay() + 6) % 7));
    if(/semana pasada|semana anterior/.test(t)){
      const l = lunesDe(hoy0); Object.assign(r, { tipo: 'semana', desde: suma(l, -7), hasta: l, prevDesde: suma(l, -14), prevHasta: suma(l, -7), etiqueta: 'la semana pasada', etPrev: 'la semana anterior', explicito: true });
    } else if(/mes pasado|mes anterior/.test(t)){
      const i = new Date(ahora.getFullYear(), ahora.getMonth(), 1), d0 = new Date(i.getFullYear(), i.getMonth() - 1, 1);
      Object.assign(r, { tipo: 'mes', desde: d0, hasta: i, prevDesde: new Date(i.getFullYear(), i.getMonth() - 2, 1), prevHasta: d0, etiqueta: 'el mes pasado', etPrev: 'el mes anterior', explicito: true });
    } else if((m = t.match(/ultim[oa]s? (\d{1,3}) (dias|semanas|meses)/)) || /ultim[oa] (semana|mes)/.test(t)){
      let n, unidad;
      if(m){ n = Number(m[1]); unidad = m[2]; } else { unidad = /ultim[oa] semana/.test(t) ? 'semana' : 'mes'; n = 1; }
      const dias = Math.max(1, /dia/.test(unidad) ? n : (/seman/.test(unidad) ? n * 7 : n * 30));
      const desde = suma(hoy0, -(dias - 1));
      const nombre = n === 1 && !/dias/.test(unidad) ? (unidad === 'mes' || unidad === 'meses' ? 'el último mes' : 'la última semana') : 'los últimos ' + n + ' ' + ({ dias: 'días', semanas: 'semanas', meses: 'meses' }[unidad] || unidad);
      Object.assign(r, { tipo: 'dias', desde, hasta: ahora, prevDesde: suma(desde, -dias), prevHasta: desde, etiqueta: nombre, etPrev: 'el periodo anterior', explicito: true });
    } else if(/(^| )semana( |$)/.test(t)){
      const l = lunesDe(hoy0);
      Object.assign(r, { tipo: 'semana', desde: l, hasta: ahora, prevDesde: suma(l, -7), prevHasta: suma(ahora, -7), etiqueta: 'esta semana', etPrev: 'la semana pasada', explicito: true });
    } else if(/(^| )mes( |$)/.test(t)){
      const i = new Date(ahora.getFullYear(), ahora.getMonth(), 1), p0 = new Date(i.getFullYear(), i.getMonth() - 1, 1);
      Object.assign(r, { tipo: 'mes', desde: i, hasta: ahora, prevDesde: p0, prevHasta: new Date(Math.min(i.getTime(), new Date(p0.getFullYear(), p0.getMonth(), ahora.getDate(), ahora.getHours(), ahora.getMinutes()).getTime())), etiqueta: 'este mes', etPrev: 'el mes pasado', explicito: true });
    }
    if(r.tipo === 'dia'){
      const base = dia || hoy0, et = diaEt || 'hoy', hh = extraerHoras(t);
      if(hh){
        r.tipo = 'horas'; r.horas = hh; r.explicito = true;
        r.desde = conHora(base, hh.h1, hh.m1); r.hasta = hh.h2 >= 24 ? suma(base, 1) : conHora(base, hh.h2, hh.m2);
        r.prevDesde = suma(r.desde, -1); r.prevHasta = suma(r.hasta, -1);
        r.etiqueta = et + ' ' + rangoTexto(hh); r.etPrev = et === 'hoy' ? 'ayer en ese mismo horario' : 'el día anterior en ese mismo horario';
      } else if(base.getTime() === hoy0.getTime()){
        Object.assign(r, { desde: hoy0, hasta: ahora, prevDesde: suma(hoy0, -1), prevHasta: suma(ahora, -1), etiqueta: 'hoy', etPrev: 'ayer a esta misma hora' });
        if(dia) r.explicito = true;
      } else {
        Object.assign(r, { desde: base, hasta: suma(base, 1), prevDesde: suma(base, -1), prevHasta: base, etiqueta: et, etPrev: et === 'ayer' ? 'antier' : 'el día anterior', explicito: true });
      }
    }
    r.dias = Math.max(1, Math.round((r.hasta - r.desde) / 86400000));
    return r;
  }
  const ultimos = (n) => parseTiempo('ultimos ' + n + ' dias');

  // ---------- diccionario de preguntas (palabras que activan cada tema) ----------
  const DICC = [
    { id: 'salud', claves: ['salud', 'como esta mi negocio', 'como va mi negocio', 'como esta todo', 'como va todo', 'diagnostico', 'chequeo', 'voy bien', 'estoy bien', 'como estoy'] },
    { id: 'resumen', claves: ['resumen', 'como me fue', 'como me va', 'como nos fue', 'como nos va', 'como va el dia', 'que tal', 'dame todo', 'reporte', 'balance', 'del dia', 'como estuvo'] },
    { id: 'ventas', claves: ['vendi', 'vendimos', 'vendio', 'venta', 'ventas', 'vendo', 'ingreso', 'ingresos', 'entro', 'cobre', 'cobramos', 'llevo', 'facturado', 'cuanto dinero'] },
    { id: 'ganancia', claves: ['gane', 'ganancia', 'ganancias', 'ganando', 'utilidad', 'margen', 'me quedo', 'me queda de ganancia', 'rentable', 'saque'] },
    { id: 'gastos', claves: ['gaste', 'gasto', 'gastos', 'gastando', 'pague', 'egresos', 'renta', 'luz', 'sueldos'] },
    { id: 'top', claves: ['mas vendido', 'mas vendidos', 'que se vende mas', 'que mas se vende', 'lo que mas', 'mas sale', 'estrella', 'popular', 'populares', 'mas pedido', 'top', 'que vendo mas', 'que se vendio mas', 'mejores productos', 'que se vende'] },
    { id: 'lentos', claves: ['menos vendido', 'menos vendidos', 'no se vende', 'no se vendio', 'no sale', 'no se mueve', 'lento', 'lentos', 'parado', 'estancado', 'sin ventas', 'no vendo', 'que se vende menos', 'se vende menos', 'peores productos', 'sin salida'] },
    { id: 'stock', claves: ['stock', 'inventario', 'acab', 'se acaba', 'se acabo', 'se acabando', 'agotar', 'agotado', 'agotados', 'falta', 'faltan', 'quedan', 'queda', 'existencia', 'existencias', 'reponer', 'resurtir', 'surtir', 'comprar', 'por acabarse', 'poco', 'pocos'] },
    { id: 'riesgo', claves: ['caduc', 'vencer', 'vence', 'vencen', 'vencido', 'vencidos', 'merma', 'echar a perder', 'echando a perder', 'riesgo', 'perder', 'por vencer'] },
    { id: 'horas', claves: ['que hora', 'a que hora', 'hora pico', 'horas pico', 'mejor hora', 'peor hora', 'hora fuerte', 'horas fuertes', 'hora floja', 'horario', 'horarios', 'cuando vendo', 'cuando se vende', 'horas'] },
    { id: 'dias', claves: ['que dia', 'mejor dia', 'peor dia', 'dia de la semana', 'dias de la semana', 'dia vendo', 'dia se vende', 'dias vendo', 'dias fuertes', 'dia fuerte', 'dia flojo'] },
    { id: 'pagos', claves: ['efectivo', 'tarjeta', 'transferencia', 'forma de pago', 'formas de pago', 'como pagan', 'como me pagan', 'metodo de pago', 'metodos de pago', 'como cobro'] },
    { id: 'cajeros', claves: ['cajero', 'cajeros', 'quien vende', 'quien vendio', 'empleado', 'empleados', 'vendedor', 'vendedores', 'quien vende mas', 'mi equipo', 'personal'] },
    { id: 'clientes', claves: ['cliente', 'clientes', 'no regresan', 'no vuelven', 'dejaron de venir', 'fieles', 'frecuentes', 'que clientes'] },
    { id: 'consejo', claves: ['consejo', 'consejos', 'recomienda', 'recomiendas', 'recomendacion', 'recomendaciones', 'que hago', 'que puedo hacer', 'como vender mas', 'vender mas', 'ayudame a vender', 'sugerencia', 'sugerencias', 'oferta', 'promocion', 'mejorar', 'que me aconsejas', 'aconseja', 'que me conviene'] },
    { id: 'ayuda', claves: ['ayuda', 'que puedes', 'que haces', 'que sabes', 'como funciona', 'que te puedo preguntar', 'hola', 'buenas', 'buenos dias', 'buenas tardes', 'buenas noches', 'gracias'] }
  ];
  const SOLO_ENCARGADO = new Set(['salud', 'ganancia', 'gastos', 'cajeros', 'clientes', 'riesgo', 'lentos']);

  function detectar(t){
    const puntos = {};
    DICC.forEach((d) => d.claves.forEach((k) => {
      const nk = norm(k);
      if(new RegExp('(^| )' + escRe(nk)).test(t)) puntos[d.id] = (puntos[d.id] || 0) + Math.pow(nk.split(' ').length, 2);
    }));
    const orden = Object.keys(puntos).sort((a, b) => puntos[b] - puntos[a]);
    if(!orden.length) return [];
    const max = puntos[orden[0]];
    let ids = orden.filter((i) => puntos[i] >= Math.max(1, max * 0.6)).slice(0, 3);
    if(ids.includes('ayuda') && ids.length > 1) ids = ids.filter((i) => i !== 'ayuda');
    if(ids.includes('salud')) return ['salud'];
    if(ids.includes('resumen')) return ['resumen'];
    return ids;
  }

  const PALABRAS_VACIAS = new Set(['de', 'la', 'el', 'los', 'las', 'con', 'para', 'sin', 'del', 'por', 'una', 'uno', 'en']);
  function buscarProducto(t){
    let mejor = null;
    enlace.productos().forEach((p) => {
      const nombre = norm(p.nombre);
      if(nombre.length < 3) return;
      let puntaje = 0;
      if(new RegExp('(^| )' + escRe(nombre) + '( |$)').test(t)) puntaje = 10 + nombre.length;
      else {
        const fichas = nombre.split(' ').filter((w) => w.length >= 3 && !PALABRAS_VACIAS.has(w));
        if(!fichas.length) return;
        const hay = fichas.filter((w) => new RegExp('(^| )' + escRe(w) + '( |$|s |es )').test(t)).length;
        const frac = hay / fichas.length;
        if(frac >= 0.99 || (fichas.length >= 3 && frac >= 0.66)) puntaje = frac * 5 + fichas.join('').length / 20;
      }
      if(puntaje && (!mejor || puntaje > mejor.puntaje)) mejor = { p, puntaje };
    });
    return mejor ? mejor.p : null;
  }

  // ---------- datos (lo mismo que consulta Analítica, con el límite del cajero) ----------
  async function paginar(armar){
    const salida = [];
    for(let pag = 0; pag < 12; pag++){
      const { data, error } = await armar().range(pag * 1000, pag * 1000 + 999);
      if(error) throw new Error(error.message || 'Error de consulta');
      salida.push(...(data || []));
      if(!data || data.length < 1000) break;
    }
    return salida;
  }
  const traerVentas = (d, h) => paginar(() => {
    let q = enlace.sb.from('ventas').select('id,total,created_at,usuario_id,metodo_pago').gte('created_at', d.toISOString()).lt('created_at', h.toISOString())
      .order('created_at', { ascending: true }).order('id', { ascending: true });
    if(esCajero()) q = q.eq('usuario_id', enlace.usuarioId());
    return q;
  });
  const traerDetalle = (d, h) => paginar(() => {
    let q = enlace.sb.from('detalle_ventas').select('id,producto_id,producto_nombre,cantidad,subtotal,ventas!inner(created_at,usuario_id)')
      .gte('ventas.created_at', d.toISOString()).lt('ventas.created_at', h.toISOString()).order('id', { ascending: true });
    if(esCajero()) q = q.eq('ventas.usuario_id', enlace.usuarioId());
    return q;
  });
  async function traerGastos(d, h){
    if(!puedeCostos() || enlace.rol() !== 'admin') return null;
    const { data, error } = await enlace.sb.from('gastos').select('monto,fecha,categoria').gte('fecha', fechaLocal(d)).lte('fecha', fechaLocal(suma(h, 0)));
    if(error) return null;
    return data || [];
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
        if(p && p.costo != null && puedeCostos()){ const g = sub - Number(p.costo) * cant; o.margen += g; marg += g; hay = true; }
      });
      r.margen = hay ? marg : null;
    }
    return r;
  }

  const memoria = new Map();
  async function cargarPeriodo(t, conDetalle){
    const clave = [t.desde.getTime(), t.hasta.getTime(), conDetalle ? 1 : 0, esCajero() ? enlace.usuarioId() : 'a'].join('|'), hit = memoria.get(clave);
    if(hit && Date.now() - hit.t < 45000) return hit.d;
    const [v1, v0, d1] = await Promise.all([traerVentas(t.desde, t.hasta), traerVentas(t.prevDesde, t.prevHasta), conDetalle ? traerDetalle(t.desde, t.hasta) : Promise.resolve(null)]);
    const d = { act: calcular(v1, d1), ant: calcular(v0, null) };
    memoria.set(clave, { t: Date.now(), d });
    if(memoria.size > 30) memoria.delete(memoria.keys().next().value);
    return d;
  }
  // si hoy todavía no hay ventas y la persona no pidió un día en especial, se muestran los últimos 7 días
  async function periodo(ctx, conDetalle, defectoDias){
    let t = ctx.t, nota = null;
    if(!t.explicito && defectoDias){ t = ultimos(defectoDias); }
    let p = await cargarPeriodo(t, conDetalle);
    if(!ctx.t.explicito && !defectoDias && !p.act.n){
      t = ultimos(7); p = await cargarPeriodo(t, conDetalle); nota = 'Hoy todavía no hay ventas, así que te cuento de los últimos 7 días.';
    }
    return { p, t, nota };
  }

  // ---------- frases ----------
  function compara(act, prev, etPrev){
    if(!prev && !act) return { texto: '', tono: 'neutro' };
    if(!prev) return { texto: cap(etPrev) + ' no hubo ventas, así que vas mejor.', tono: 'bien' };
    const dif = act - prev, rel = dif / prev;
    if(Math.abs(rel) < 0.03) return { texto: 'Vas casi igual que ' + etPrev + '.', tono: 'neutro' };
    if(dif > 0) return { texto: variante(['Son ' + $d(dif) + ' más que ' + etPrev + '.', 'Eso es ' + $d(dif) + ' más que ' + etPrev + '.'], 1), tono: 'bien' };
    return { texto: variante(['Son ' + $d(-dif) + ' menos que ' + etPrev + '.', 'Eso es ' + $d(-dif) + ' menos que ' + etPrev + '.'], 1), tono: rel < -0.2 ? 'alerta' : 'aviso' };
  }
  const topProductos = (a, n) => Object.entries(a.productos).map(([nombre, v]) => Object.assign({ nombre }, v)).sort((x, y) => y.cant - x.cant).slice(0, n || 3);
  const esFisico = (p) => (p.tipo || 'producto') === 'producto' && Number(p.stock) < 900000;
  const stockBajo = () => enlace.productos().filter((p) => esFisico(p) && Number(p.stock) <= 5).sort((a, b) => Number(a.stock) - Number(b.stock));
  const NOMBRE_PAGO = { efectivo: 'efectivo', tarjeta: 'tarjeta', transferencia: 'transferencia', mixto: 'pagos combinados' };
  function porCaducar(){
    const hoy = inicioDia(new Date()).getTime();
    return enlace.productos().filter((p) => p.fecha_caducidad && esFisico(p) && Number(p.stock) > 0).map((p) => ({ p, dias: Math.ceil((new Date(p.fecha_caducidad + 'T00:00:00').getTime() - hoy) / 86400000) })).filter((x) => x.dias <= 7).sort((a, b) => a.dias - b.dias);
  }

  // ---------- recomendaciones ----------
  function consejos(a, b, t, gastos){
    const out = [], top = topProductos(a, 3), sem = semilla();
    if(b.total > 0 && a.total < b.total * 0.9){
      const nom = top[0] && top[0].nombre;
      out.push({ prio: 90, tono: 'alerta', titulo: 'Estás vendiendo menos', texto: cap(en(t)) + ' vendiste ' + $d(b.total - a.total) + ' menos que ' + t.etPrev + '.',
        consejo: nom ? variante(['Haz una oferta con ' + nom + ', que es lo que más sale: por ejemplo "llévate 2 y paga menos".', 'Avisa a tus clientes por WhatsApp de una promoción en ' + nom + '.', 'Pon ' + nom + ' bien a la vista y regala algo chico cuando se lleven 2.'], sem) : 'Prueba una oferta chica en tu producto más popular y avisa a tus clientes.' });
    }
    if(a.total > 0 && b.total > 0 && a.total > b.total * 1.1){
      out.push({ prio: 40, tono: 'bien', titulo: '¡Vas muy bien!', texto: 'Vendiste ' + $d(a.total - b.total) + ' más que ' + t.etPrev + '.', consejo: top[0] ? 'Cuida que no te falte ' + top[0].nombre + ' para seguir vendiendo así.' : 'Sigue así.' });
    }
    const bajos = stockBajo();
    top.forEach((x) => {
      const p = bajos.find((q) => norm(q.nombre) === norm(x.nombre));
      if(p) out.push({ prio: 95, tono: 'alerta', titulo: 'Se te está acabando lo que más vendes', texto: 'Te quedan solo ' + fmt(p.stock) + ' de ' + p.nombre + ', que es de lo que más sale.', consejo: esCajero() ? 'Avísale al encargado para que lo pida hoy.' : 'Cómpralo hoy para no perder ventas.' });
    });
    const cad = porCaducar();
    if(cad.length && !esCajero()) out.push({ prio: 85, tono: 'alerta', titulo: 'Hay productos por caducar', texto: lista(cad.slice(0, 3).map((x) => x.p.nombre)) + (cad.length > 3 ? ' y ' + (cad.length - 3) + ' más' : '') + ' ' + (cad.length === 1 ? 'está' : 'están') + ' por caducar.', consejo: cad.length === 1 ? 'Véndelo primero: ponlo en oferta o júntalo con algo que sí se venda.' : 'Véndelos primero: ponlos en oferta o júntalos con algo que sí se venda.' });
    if(puedeCostos()){
      if(a.margen != null && a.total > 0 && a.margen / a.total < 0.15) out.push({ prio: 70, tono: 'aviso', titulo: 'Te queda poca ganancia', texto: 'Por cada $100 que vendes, solo te quedan ' + $r(a.margen / a.total * 100) + ' de ganancia.', consejo: 'Revisa los precios de lo que más vendes: quizá puedes subirlos un poquito o buscar un proveedor más barato.' });
      if(gastos != null && a.margen != null && gastos > 0 && gastos > a.margen) out.push({ prio: 88, tono: 'alerta', titulo: 'Gastaste más de lo que ganaste', texto: 'Gastaste ' + $d(gastos) + ' y tu ganancia por ventas fue ' + $d(a.margen) + '.', consejo: 'Mira en qué estás gastando y recorta lo que no sea necesario.' });
      if(t.dias >= 7){
        const sinVender = enlace.productos().filter((p) => esFisico(p) && Number(p.stock) > 0 && !a.productos[p.nombre] && p.costo != null).sort((x, y) => Number(y.stock) * Number(y.costo) - Number(x.stock) * Number(x.costo)).slice(0, 3);
        if(sinVender.length) out.push({ prio: 60, tono: 'aviso', titulo: 'Dinero parado en el estante', texto: lista(sinVender.map((p) => p.nombre)) + ' no se ' + (sinVender.length === 1 ? 'vendió' : 'vendieron') + ' ' + en(t) + '.', consejo: sinVender.length === 1 ? 'Ponlo en oferta o júntalo en un combo con lo que sí se vende; así recuperas el dinero.' : 'Ponlos en oferta o júntalos en un combo con lo que sí se vende; así recuperas el dinero.' });
      }
    }
    if(a.n >= 10){
      const hs = a.porHora.map((v, h) => ({ h, v })).filter((x) => x.v > 0).sort((x, y) => y.v - x.v);
      if(hs.length >= 3) out.push({ prio: 30, tono: 'info', titulo: 'Tu hora fuerte', texto: 'Vendes más en el horario ' + horaFuerteTexto(hs[0].h) + '.', consejo: 'En esa hora ten listo lo que más vendes y, si puedes, una persona más en caja.' });
    }
    return out.sort((x, y) => y.prio - x.prio);
  }

  // ---------- respuestas por tema ----------
  const cuentaLista = (arr, f) => arr.map(f);

  async function hVentas(ctx){
    const { p, t, nota } = await periodo(ctx, false), a = p.act, b = p.ant;
    if(!a.n) return [carta('neutro', 'dinero', cap('Ventas ' + de(t)), esCajero() ? 'Todavía no tienes ventas en ese horario.' : 'Todavía no hay ventas en ese horario.', t.etiqueta === 'hoy' ? 'Cuando se haga la primera venta, aquí te cuento cómo vas.' : null)];
    const verbo = t.etiqueta === 'hoy' ? 'Llevas vendido' : 'Vendiste', c = compara(a.total, b.total, t.etPrev), cartas = [];
    if(nota) cartas.push(carta('info', 'reloj', 'Aviso', nota));
    cartas.push(carta(c.tono, 'dinero', cap('Ventas ' + de(t)), (verbo + ' ' + $d(a.total) + ' en ' + veces(a.n, 'venta', 'ventas') + '. ' + c.texto).trim()));
    let tk = 'Cada cliente te deja, en promedio, ' + $d(a.ticket) + '.';
    if(b.n){ const dif = a.ticket - b.ticket; tk += Math.abs(dif) < 0.5 ? ' Es casi igual que antes.' : (dif > 0 ? ' Antes dejaba ' + $d(b.ticket) + ': ¡ahora gastan más!' : ' Antes dejaba ' + $d(b.ticket) + ': ahora gastan un poco menos.'); }
    cartas.push(carta('neutro', 'persona', 'Lo que gasta cada cliente', tk));
    return cartas;
  }

  async function hGanancia(ctx){
    const { p, t } = await periodo(ctx, true), a = p.act;
    if(!a.n) return [carta('neutro', 'dinero', 'Ganancia ' + de(t), 'Todavía no hay ventas en ese periodo, así que no hay ganancia que contar.')];
    if(a.margen == null) return [carta('aviso', 'dinero', 'No pude calcular tu ganancia', 'Para saber cuánto ganas, PUVE necesita saber cuánto te cuesta cada producto.', 'Entra a Productos y anota el costo de cada uno.')];
    const cartas = [carta(a.margen >= 0 ? 'bien' : 'alerta', 'dinero', 'Tu ganancia ' + de(t), 'De ' + $d(a.total) + ' que vendiste, ' + $d(a.margen) + ' son ganancia (lo que queda después de pagar la mercancía). Por cada $100 que vendes, te quedan ' + $r(a.total ? a.margen / a.total * 100 : 0) + '.')];
    if(t.tipo === 'horas'){ cartas.push(carta('info', 'reloj', 'Sobre los gastos', 'Los gastos se anotan por día, no por hora. Pregúntame por el día completo para ver tu ganancia real.')); return cartas; }
    const g = await traerGastos(t.desde, t.hasta);
    if(g){
      const total = g.reduce((s, x) => s + Number(x.monto), 0), real = a.margen - total;
      cartas.push(carta(real >= 0 ? 'bien' : 'alerta', 'caja', 'Después de tus gastos', total ? 'Gastaste ' + $d(total) + ' en cosas del negocio. Tu ganancia real es ' + $d(real) + '.' : 'No anotaste gastos en ese periodo, así que tu ganancia real es ' + $d(real) + '.', real < 0 ? 'Estás gastando más de lo que ganas: revisa tus gastos.' : null));
    }
    return cartas;
  }

  async function hGastos(ctx){
    const t = ctx.t.tipo === 'horas' ? parseTiempo(ctx.t.etiqueta.split(' ')[0] === 'hoy' ? 'hoy' : 'ayer') : ctx.t;
    const g = await traerGastos(t.desde, t.hasta), gAnt = await traerGastos(t.prevDesde, t.prevHasta);
    if(g == null) return [carta('aviso', 'caja', 'No pude ver los gastos', 'Los gastos solo los ve el encargado del negocio.')];
    const total = g.reduce((s, x) => s + Number(x.monto), 0);
    if(!total) return [carta('neutro', 'caja', 'Gastos ' + de(t), 'No anotaste gastos en ese periodo.', 'Anota tus gastos (renta, luz, sueldos…) para saber tu ganancia de verdad.')];
    const por = {}; g.forEach((x) => { por[x.categoria] = (por[x.categoria] || 0) + Number(x.monto); });
    const orden = Object.entries(por).sort((x, y) => y[1] - x[1]).slice(0, 3), prev = (gAnt || []).reduce((s, x) => s + Number(x.monto), 0);
    const c = compara(total, prev, t.etPrev);
    return [carta(prev && total > prev * 1.1 ? 'aviso' : 'neutro', 'caja', 'Gastos ' + de(t), 'Gastaste ' + $d(total) + '. ' + (prev ? (total > prev ? 'Es ' + $d(total - prev) + ' más que ' + t.etPrev + '.' : (total < prev ? 'Es ' + $d(prev - total) + ' menos que ' + t.etPrev + '.' : 'Es igual que ' + t.etPrev + '.')) : '')),
      carta('info', 'grafica', 'En qué gastaste más', lista(orden.map(([k, v]) => k + ' (' + $d(v) + ')')) + '.', orden[0][1] > total * 0.5 ? 'Más de la mitad se fue en ' + orden[0][0] + ': revisa si puedes bajarlo.' : null)];
  }

  async function hTop(ctx){
    const { p, t, nota } = await periodo(ctx, true), a = p.act;
    if(!a.n) return [carta('neutro', 'estrella', 'Lo más vendido ' + de(t), 'Todavía no hay ventas en ese periodo.')];
    const top = topProductos(a, 3), cartas = [];
    if(nota) cartas.push(carta('info', 'reloj', 'Aviso', nota));
    cartas.push(carta('bien', 'estrella', 'Lo que más se vendió ' + en(t), top.map((x, i) => (['En primer lugar', 'Luego', 'Y después'][i]) + ' ' + x.nombre + ' (' + fmt(x.cant) + ' vendidos)').join('; ') + '.', 'Procura que nunca te falte ' + top[0].nombre + '.'));
    if(puedeCostos() && a.margen != null){
      const m = Object.entries(a.productos).map(([nombre, v]) => ({ nombre, margen: v.margen })).sort((x, y) => y.margen - x.margen)[0];
      if(m && m.margen > 0) cartas.push(carta('info', 'dinero', 'El que más ganancia te dejó', m.nombre + ' te dejó ' + $d(m.margen) + ' de ganancia.', m.nombre !== top[0].nombre ? 'No es el que más se vende, pero sí el que más te deja: ponlo más a la vista.' : null));
    }
    return cartas;
  }

  async function hLentos(ctx){
    const { p, t } = await periodo(ctx, true, 30), a = p.act;
    const sin = enlace.productos().filter((q) => esFisico(q) && Number(q.stock) > 0 && !a.productos[q.nombre]).slice(0, 40);
    const cartas = [];
    if(!sin.length) cartas.push(carta('bien', 'caja', 'Todo se está moviendo', cap(en(t)) + ' se vendió todo lo que tienes en existencia, o casi.'));
    else {
      const ord = sin.sort((x, y) => Number(y.stock) * Number(y.costo || 0) - Number(x.stock) * Number(x.costo || 0)).slice(0, 6);
      cartas.push(carta('aviso', 'caja', 'No se vendieron ' + en(t), lista(ord.map((q) => q.nombre)) + (sin.length > 6 ? ' y ' + (sin.length - 6) + ' más' : '') + '.', 'Ponlos en oferta, júntalos en un combo con lo que sí se vende o acomódalos en un lugar más visible.'));
    }
    const lentos = puedeCostos() ? await rpc('productos_lentos', { p_dias: 60 }) : null;
    if(lentos && lentos.n) cartas.push(carta('aviso', 'dinero', 'Dinero parado', 'Tienes ' + $d(lentos.capital) + ' guardados en ' + veces(lentos.n, 'producto', 'productos') + ' que no se vendieron en 60 días.', 'Entre más tiempo pasen, más difícil es recuperar ese dinero. Una oferta hoy es mejor que nada.'));
    const poco = Object.entries(a.productos).map(([nombre, v]) => ({ nombre, cant: v.cant })).sort((x, y) => x.cant - y.cant)[0];
    if(poco && sin.length) cartas.push(carta('info', 'grafica', 'De lo que sí se vendió', 'Lo que menos salió fue ' + poco.nombre + ' (' + fmt(poco.cant) + ' vendidos).'));
    return cartas;
  }

  async function rpc(nombre, args){
    try { const r = await enlace.sb.rpc(nombre, args); return r.error ? null : r.data; } catch(e){ return null; }
  }

  async function hStock(ctx){
    const prods = enlace.productos().filter(esFisico), agot = prods.filter((p) => Number(p.stock) <= 0), bajos = prods.filter((p) => Number(p.stock) > 0 && Number(p.stock) <= 5).sort((a, b) => Number(a.stock) - Number(b.stock));
    const cartas = [], av = esCajero() ? 'Avísale al encargado.' : null;
    if(!agot.length && !bajos.length) cartas.push(carta('bien', 'caja', 'Inventario en buen nivel', 'No tienes nada agotado ni a punto de acabarse. ¡Muy bien!'));
    if(agot.length) cartas.push(carta('alerta', 'alerta', 'Ya se acabó', lista(agot.slice(0, 8).map((p) => p.nombre)) + (agot.length > 8 ? ' y ' + (agot.length - 8) + ' más' : '') + '.', av || 'Si se vendían bien, cada día sin ellos pierdes ventas: pídelos pronto.'));
    if(bajos.length) cartas.push(carta('aviso', 'alerta', 'Te quedan pocos', lista(bajos.slice(0, 8).map((p) => p.nombre + ' (' + fmt(p.stock) + ')')) + (bajos.length > 8 ? ' y ' + (bajos.length - 8) + ' más' : '') + '.', av));
    if(puedeCostos() && (agot.length || bajos.length)){
      const rep = await rpc('reposicion_sugerida', { p_dias: 30, p_cobertura: 14 });
      if(rep && rep.length) cartas.push(carta('info', 'caja', 'Qué te conviene comprar', rep.slice(0, 5).map((x) => x.nombre + ': ' + fmt(x.sugerido) + (x.dias_alcanza != null ? ' (te alcanza para ' + fmt(x.dias_alcanza) + ' días)' : '')).join('; ') + '.', 'Con eso te alcanza para unas 2 semanas, según lo que vendes.'));
    }
    return cartas;
  }

  async function hRiesgo(){
    const cad = porCaducar(), cartas = [];
    if(!cad.length) cartas.push(carta('bien', 'caja', 'Nada por caducar', 'No tienes productos caducados ni por caducar en los próximos 7 días.'));
    else {
      const ya = cad.filter((x) => x.dias <= 0), pronto = cad.filter((x) => x.dias > 0);
      if(ya.length) cartas.push(carta('alerta', 'alerta', 'Ya caducaron', lista(ya.slice(0, 6).map((x) => x.p.nombre)) + '.', 'Sácalos de la venta para no tener problemas con tus clientes.'));
      if(pronto.length) cartas.push(carta('aviso', 'alerta', 'Van a caducar pronto', lista(pronto.slice(0, 6).map((x) => x.p.nombre + ' (en ' + veces(x.dias, 'día', 'días') + ')')) + '.', 'Véndelos primero: ponlos en oferta hoy o júntalos con algo que sí se vende.'));
    }
    const lentos = await rpc('productos_lentos', { p_dias: 60 });
    if(lentos && lentos.n) cartas.push(carta('aviso', 'dinero', 'También hay productos sin moverse', veces(lentos.n, 'producto', 'productos') + ' llevan 60 días sin venderse y tienen ' + $d(lentos.capital) + ' de dinero parado.', 'Haz una oferta para recuperar ese dinero.'));
    return cartas;
  }

  async function hHoras(ctx){
    const { p, t, nota } = await periodo(ctx, false, 30), a = p.act;
    if(a.n < 3) return [carta('neutro', 'reloj', 'Todavía hay pocos datos', 'Necesito unas cuantas ventas más para saber a qué hora vendes más.')];
    const hs = a.porHora.map((v, h) => ({ h, v })).filter((x) => x.v > 0), fuertes = hs.slice().sort((x, y) => y.v - x.v).slice(0, 3);
    const cartas = [carta('bien', 'reloj', 'Tus horas fuertes (' + t.etiqueta + ')', fuertes.map((x, i) => (i ? 'luego ' : 'Vendes más en el horario ') + horaFuerteTexto(x.h) + ' (' + $d(x.v) + ')').join('; ') + '.', 'En esas horas ten listo lo que más vendes y, si puedes, una persona más en caja.')];
    const ini = hs[0].h, fin = hs[hs.length - 1].h, flojas = hs.filter((x) => x.h >= ini && x.h <= fin).sort((x, y) => x.v - y.v).slice(0, 2);
    if(flojas.length && hs.length >= 5) cartas.push(carta('aviso', 'reloj', 'Tus horas flojas', 'Vendes menos en el horario ' + lista(flojas.map((x) => horaFuerteTexto(x.h))) + '.', 'Prueba una oferta relámpago en esas horas para llenarlas.'));
    return cartas;
  }

  async function hDias(ctx){
    const { p, t } = await periodo(ctx, false, 30), a = p.act;
    if(a.n < 5) return [carta('neutro', 'grafica', 'Todavía hay pocos datos', 'Necesito unas cuantas ventas más para saber qué día vendes más.')];
    const dd = a.porDia.map((v, d) => ({ d, v })).filter((x) => x.v > 0).sort((x, y) => y.v - x.v);
    return [carta('bien', 'grafica', 'Tus mejores días (' + t.etiqueta + ')', 'Vendes más el ' + DIAS_BONITO[dd[0].d] + ' (' + $d(dd[0].v) + ')' + (dd[1] ? ' y el ' + DIAS_BONITO[dd[1].d] + ' (' + $d(dd[1].v) + ')' : '') + '.'),
      dd.length > 2 ? carta('aviso', 'grafica', 'Tu día más flojo', 'El ' + DIAS_BONITO[dd[dd.length - 1].d] + ' es cuando menos vendes (' + $d(dd[dd.length - 1].v) + ').', 'Haz una promoción ese día para que se llene más.') : null].filter(Boolean);
  }

  async function hPagos(ctx){
    const { p, t, nota } = await periodo(ctx, false), a = p.act;
    if(!a.n) return [carta('neutro', 'tarjeta', 'Formas de pago ' + de(t), 'Todavía no hay ventas en ese periodo.')];
    const orden = Object.entries(a.porMetodo).sort((x, y) => y[1] - x[1]), cartas = [];
    if(nota) cartas.push(carta('info', 'reloj', 'Aviso', nota));
    cartas.push(carta('info', 'tarjeta', 'Cómo te pagan ' + en(t), 'De cada $100 que cobras: ' + lista(orden.map(([k, v]) => $r(v / a.total * 100) + ' son en ' + (NOMBRE_PAGO[k] || k))) + '.',
      orden[0][0] === 'efectivo' && orden[0][1] / a.total > 0.85 ? 'Casi todo es efectivo: ofrece también tarjeta o transferencia para no perder clientes que no traen cambio.' : null));
    return cartas;
  }

  async function hCajeros(ctx){
    const { p, t, nota } = await periodo(ctx, false), a = p.act;
    const ids = Object.keys(a.porCajero);
    if(!ids.length) return [carta('neutro', 'persona', 'Ventas por cajero', 'Todavía no hay ventas en ese periodo.')];
    let nombres = {};
    try { const r = await enlace.sb.from('perfiles').select('id,nombre').in('id', ids); (r.data || []).forEach((x) => { nombres[x.id] = x.nombre; }); } catch(e){}
    const orden = ids.map((id) => ({ nombre: nombres[id] || 'Un cajero', n: a.porCajero[id].n, total: a.porCajero[id].total })).sort((x, y) => y.total - x.total), cartas = [];
    if(nota) cartas.push(carta('info', 'reloj', 'Aviso', nota));
    cartas.push(carta('bien', 'persona', 'Quién vendió más ' + en(t), orden[0].nombre + ' vendió más: ' + $d(orden[0].total) + ' en ' + veces(orden[0].n, 'venta', 'ventas') + '.' + (orden.length > 1 ? ' Después ' + lista(orden.slice(1, 4).map((x) => x.nombre + ' (' + $d(x.total) + ')')) + '.' : '')));
    return cartas;
  }

  async function hClientes(){
    const d = await rpc('clientes_inactivos', { p_dias: 45 });
    if(d == null) return [carta('neutro', 'persona', 'Clientes', 'No pude revisar tus clientes. Para verlos, activa Clientes o Recompensas y registra el teléfono al cobrar.')];
    if(!d.length) return [carta('bien', 'persona', 'Tus clientes siguen viniendo', 'Ningún cliente frecuente lleva más de 45 días sin venir.')];
    return [carta('aviso', 'persona', 'Clientes que dejaron de venir', veces(d.length, 'cliente frecuente lleva', 'clientes frecuentes llevan') + ' más de 45 días sin venir. Los que más te compraban: ' + lista(d.slice(0, 3).map((x) => x.nombre + ' (' + $d(x.total) + ')')) + '.', 'Mándales un mensaje de WhatsApp con una promoción chica para que regresen.')];
  }

  async function hProducto(ctx){
    const prod = ctx.producto, t = ctx.t.explicito ? ctx.t : ultimos(30), dato = await cargarPeriodo(t, true), a = dato.act, v = a.productos[prod.nombre];
    const cartas = [], dias = Math.max(1, t.dias);
    if(!v) cartas.push(carta('neutro', 'caja', prod.nombre, 'De ' + prod.nombre + ' no se vendió nada ' + en(t) + '.'));
    else cartas.push(carta('bien', 'caja', prod.nombre, 'De ' + prod.nombre + ' vendiste ' + fmt(v.cant) + ' ' + en(t) + ' (' + $d(v.monto) + ').' + (puedeCostos() && v.margen ? ' Te dejó ' + $d(v.margen) + ' de ganancia.' : '')));
    if(esFisico(prod)){
      const st = Number(prod.stock), vd = v ? v.cant / dias : 0;
      let txt = st <= 0 ? 'Ya se acabó.' : 'Te quedan ' + fmt(st) + '.';
      if(st > 0 && vd > 0){ const al = Math.floor(st / vd); txt += al < 1 ? ' Al ritmo que lo vendes, no te alcanza ni para un día.' : ' Al ritmo que lo vendes, te alcanza para unos ' + veces(al, 'día', 'días') + '.'; }
      cartas.push(carta(st <= 0 ? 'alerta' : (st <= 5 ? 'aviso' : 'info'), 'caja', 'Cuánto tienes', txt, st <= 5 ? (esCajero() ? 'Avísale al encargado.' : 'Pídelo pronto para no quedarte sin él.') : null));
    }
    return cartas;
  }

  async function hConsejo(ctx){
    const t = ctx.t.explicito ? ctx.t : ultimos(14), dato = await cargarPeriodo(t, true), g = (t.tipo !== 'horas') ? await traerGastos(t.desde, t.hasta) : null;
    const c = consejos(dato.act, dato.ant, t, g ? g.reduce((s, x) => s + Number(x.monto), 0) : null).slice(0, 4);
    if(!c.length) return [carta('bien', 'foco', 'Todo va tranquilo', 'No veo nada urgente. Sigue así y revisa tu resumen todos los días.')];
    return c.map((x) => carta(x.tono, x.tono === 'bien' ? 'estrella' : 'foco', x.titulo, x.texto, x.consejo));
  }

  async function hResumen(ctx){
    const { p, t, nota } = await periodo(ctx, true), a = p.act, b = p.ant, cartas = [];
    if(!a.n) return [carta('neutro', 'dinero', cap('Resumen: ' + t.etiqueta), esCajero() ? 'Todavía no tienes ventas en ese periodo.' : 'Todavía no hay ventas en ese periodo.', 'Cuando haya ventas, aquí te cuento cómo va todo.')];
    if(nota) cartas.push(carta('info', 'reloj', 'Aviso', nota));
    const c = compara(a.total, b.total, t.etPrev);
    cartas.push(carta(c.tono, 'dinero', cap('Ventas ' + de(t)), ((t.etiqueta === 'hoy' ? 'Llevas vendido ' : 'Vendiste ') + $d(a.total) + ' en ' + veces(a.n, 'venta', 'ventas') + '. ' + c.texto).trim()));
    let gastos = null;
    if(puedeCostos() && a.margen != null){
      gastos = t.tipo === 'horas' ? null : await traerGastos(t.desde, t.hasta);
      const g = gastos ? gastos.reduce((s, x) => s + Number(x.monto), 0) : null;
      cartas.push(carta(a.margen >= 0 ? 'bien' : 'alerta', 'dinero', 'Tu ganancia', 'De lo que vendiste, ' + $d(a.margen) + ' son ganancia.' + (g != null ? (g ? ' Gastaste ' + $d(g) + ', así que tu ganancia real es ' + $d(a.margen - g) + '.' : ' No anotaste gastos.') : '')));
      gastos = g;
    }
    const top = topProductos(a, 1)[0];
    if(top) cartas.push(carta('info', 'estrella', 'Lo que más salió', top.nombre + ' fue lo más vendido: ' + fmt(top.cant) + ' vendidos.'));
    if(a.n >= 4 && t.tipo !== 'horas'){
      const hs = a.porHora.map((v, h) => ({ h, v })).sort((x, y) => y.v - x.v)[0];
      if(hs.v > 0) cartas.push(carta('info', 'reloj', 'Tu mejor hora', 'Vendiste más en el horario ' + horaFuerteTexto(hs.h) + ' (' + $d(hs.v) + ').'));
    }
    const pg = Object.entries(a.porMetodo).sort((x, y) => y[1] - x[1])[0];
    if(pg && Object.keys(a.porMetodo).length > 1) cartas.push(carta('info', 'tarjeta', 'Cómo te pagaron', 'Lo que más usaron fue ' + (NOMBRE_PAGO[pg[0]] || pg[0]) + ': ' + $r(pg[1] / a.total * 100) + ' de cada $100.'));
    const bajos = stockBajo();
    if(bajos.length) cartas.push(carta('aviso', 'alerta', 'Se te está acabando', lista(bajos.slice(0, 4).map((x) => x.nombre + ' (' + fmt(x.stock) + ')')) + (bajos.length > 4 ? ' y ' + (bajos.length - 4) + ' más' : '') + '.', esCajero() ? 'Avísale al encargado.' : null));
    const cs = consejos(a, b, t, gastos)[0];
    if(cs) cartas.push(carta(cs.tono === 'bien' ? 'bien' : 'info', 'foco', 'Lo que te recomiendo', cs.texto, cs.consejo));
    return cartas;
  }

  async function hSalud(ctx){
    const t = ctx.t.explicito ? ctx.t : ultimos(30), dato = await cargarPeriodo(t, true), a = dato.act, b = dato.ant;
    if(!a.n) return [carta('neutro', 'corazon', 'Salud de tu negocio', 'Todavía no hay ventas ' + en(t) + ' para revisar cómo vas.')];
    let puntos = 0; const cartas = [], c = compara(a.total, b.total, t.etPrev);
    puntos += c.tono === 'bien' ? 1 : (c.tono === 'alerta' ? -1.5 : (c.tono === 'aviso' ? -0.5 : 0));
    cartas.push(carta(c.tono, 'dinero', 'Ventas', cap(en(t)) + ' vendiste ' + $d(a.total) + '. ' + c.texto));
    let g = null;
    if(a.margen != null){
      const porCien = a.total ? a.margen / a.total * 100 : 0;
      puntos += porCien >= 25 ? 1 : (porCien < 12 ? -1 : 0);
      g = await traerGastos(t.desde, t.hasta);
      const gt = g ? g.reduce((s, x) => s + Number(x.monto), 0) : null, real = gt != null ? a.margen - gt : null;
      if(real != null && real < 0) puntos -= 1.5;
      cartas.push(carta(porCien >= 25 ? 'bien' : (porCien < 12 ? 'alerta' : 'aviso'), 'dinero', 'Ganancia', 'Por cada $100 que vendes, te quedan ' + $r(porCien) + '.' + (real != null ? ' Ya con gastos, tu ganancia real es ' + $d(real) + '.' : ''), porCien < 12 ? 'Es poquito: revisa tus precios o busca proveedores más baratos.' : null));
    }
    const fis = enlace.productos().filter(esFisico), apuros = fis.filter((p) => Number(p.stock) <= 5).length;
    if(fis.length){
      const fr = apuros / fis.length; puntos += fr > 0.3 ? -1 : 0;
      cartas.push(carta(fr > 0.3 ? 'alerta' : (apuros ? 'aviso' : 'bien'), 'caja', 'Inventario', apuros ? veces(apuros, 'producto está', 'productos están') + ' agotado' + (apuros === 1 ? '' : 's') + ' o por acabarse, de ' + fis.length + '.' : 'Todo tu inventario está en buen nivel.', fr > 0.3 ? 'Es mucho: haz una compra pronto.' : null));
    }
    const cad = porCaducar();
    if(cad.length){ puntos -= 0.5; cartas.push(carta('aviso', 'alerta', 'Caducidad', veces(cad.length, 'producto caduca', 'productos caducan') + ' en menos de 7 días.', 'Ponlos en oferta ya.')); }
    const nivel = puntos >= 2 ? ['bien', 'Tu negocio va muy bien.'] : (puntos >= 0.5 ? ['bien', 'Tu negocio va bien.'] : (puntos >= -0.5 ? ['aviso', 'Tu negocio va regular: hay cosas que mejorar.'] : ['alerta', 'Tu negocio necesita atención pronto.']));
    cartas.push(carta(nivel[0], 'corazon', 'En resumen', nivel[1]));
    const cs = consejos(a, b, t, g ? g.reduce((s, x) => s + Number(x.monto), 0) : null)[0];
    if(cs) cartas.push(carta('info', 'foco', 'Lo primero que te recomiendo', cs.texto, cs.consejo));
    return cartas;
  }

  async function hAyuda(ctx){
    const e = esCajero();
    return [carta('info', 'foco', 'Soy PUVE IA', 'Te cuento cómo va ' + (e ? 'tu turno' : 'tu negocio') + ' con palabras sencillas. Escríbeme como le hablarías a una persona: puedes preguntar por un día, o por un horario como "ayer de 2 a 5 de la tarde". Toca una de las preguntas de abajo para empezar.')];
  }
  async function hNoEntendi(){
    return [carta('neutro', 'foco', 'No te entendí bien', 'Prueba con otras palabras. Por ejemplo, así me puedes preguntar:', null, ['¿Cuánto vendí hoy?', 'Ventas de ayer de 2 a 5 de la tarde', '¿Qué se está acabando?', '¿Qué hago para vender más?'].map((x) => ({ texto: x, pregunta: x })))];
  }

  const MANEJADORES = { resumen: hResumen, ventas: hVentas, ganancia: hGanancia, gastos: hGastos, top: hTop, lentos: hLentos, stock: hStock, riesgo: hRiesgo, horas: hHoras, dias: hDias, pagos: hPagos, cajeros: hCajeros, clientes: hClientes, consejo: hConsejo, salud: hSalud, ayuda: hAyuda, producto: hProducto };

  async function responder(texto){
    const t0 = norm(texto), ctx = { t: parseTiempo(texto), texto: t0, producto: null };
    let ids = detectar(t0);
    if(ctx.t.tipo === 'horas' && !/(que hora|hora pico|mejor hora|peor hora|hora fuerte|hora floja)/.test(t0)) ids = ids.filter((i) => i !== 'horas');
    const prod = buscarProducto(t0);
    if(prod && (!ids.length || ids.every((i) => ['ventas', 'top', 'stock', 'lentos', 'resumen', 'consejo'].includes(i)))){ ctx.producto = prod; ids = ['producto']; }
    if(!ids.length){
      if(ctx.t.explicito) ids = [ctx.t.tipo === 'horas' ? 'ventas' : 'resumen'];
      else return hNoEntendi();
    }
    const cartas = [];
    if(esCajero() && ids.some((i) => SOLO_ENCARGADO.has(i))){
      cartas.push(carta('neutro', 'alerta', 'Eso lo ve el encargado', 'Esa información solo la puede ver el encargado del negocio. Yo te puedo contar de tus ventas, lo que más vendes y lo que se está acabando.'));
      ids = ids.filter((i) => !SOLO_ENCARGADO.has(i));
    }
    if(!puedeCostos() && !esCajero() && ids.some((i) => ['ganancia', 'gastos', 'riesgo', 'clientes'].includes(i))){
      cartas.push(carta('neutro', 'alerta', 'Eso no lo puedo mostrar', 'Los costos, gastos y clientes los ve solo el encargado del negocio.'));
      ids = ids.filter((i) => !['ganancia', 'gastos', 'riesgo', 'clientes'].includes(i));
    }
    for(const id of ids){ cartas.push(...await MANEJADORES[id](ctx)); }
    return cartas.length ? cartas : hNoEntendi();
  }

  // ---------- pantalla: chat con tarjetitas ----------
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const ICONOS = {
    dinero: 'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
    grafica: 'M18 20V10M12 20V4M6 20v-6',
    caja: 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16zM3.27 6.96 12 12.01l8.73-5.05M12 22.08V12',
    reloj: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 6v6l4 2',
    alerta: 'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01',
    estrella: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
    foco: 'M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.74V17h8v-2.26A7 7 0 0 0 12 2z',
    persona: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    tarjeta: 'M3 4h18a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM1 10h22',
    corazon: 'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z',
    escudo: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
    mensaje: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
    tienda: 'M3 9l1-5h16l1 5M3 9v11h18V9M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0',
    bug: 'M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6zM12 20v-9M9 7V6a3 3 0 1 1 6 0v1M2 13h4M18 13h4',
    enviar: 'M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z'
  };
  function el(tag, cls, txt){ const e = document.createElement(tag); if(cls) e.className = cls; if(txt != null) e.textContent = txt; return e; }
  function icono(nombre){
    const s = document.createElementNS(SVG_NS, 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor');
    s.setAttribute('stroke-width', '2'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round'); s.setAttribute('aria-hidden', 'true');
    const p = document.createElementNS(SVG_NS, 'path'); p.setAttribute('d', ICONOS[nombre] || ICONOS.foco); s.appendChild(p); return s;
  }
  const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

  function pintarCarta(c, enviar){
    const d = el('div', 'rs-card rs-' + (c.tono || 'neutro')); d.setAttribute('role', 'article');
    const cab = el('div', 'rs-cab'), ic = el('span', 'rs-ico'); ic.appendChild(icono(c.icono)); cab.appendChild(ic);
    cab.appendChild(el('span', 'rs-tit', c.titulo)); cab.appendChild(el('span', 'rs-ahora', 'ahora')); d.appendChild(cab);
    d.appendChild(el('p', 'rs-texto', c.texto));
    if(c.consejo){ const k = el('div', 'rs-consejo'); k.appendChild(el('span', 'rs-consejo-etq', 'Qué te recomiendo')); k.appendChild(el('span', null, c.consejo)); d.appendChild(k); }
    if(c.acciones && c.acciones.length){ const a = el('div', 'rs-acciones'); c.acciones.forEach((x) => { const b = el('button', 'rs-chip', x.texto); b.type = 'button'; b.onclick = () => enviar(x.pregunta); a.appendChild(b); }); d.appendChild(a); }
    return d;
  }

  function crearChat(cont, cfg){
    cont.textContent = '';
    const raiz = el('div', 'rs-chat'), cab = el('div', 'rs-chat-cab'), msgs = el('div', 'rs-mensajes'), chips = el('div', 'rs-chips'), form = el('form', 'rs-entrada');
    msgs.setAttribute('aria-live', 'polite');
    const tit = el('div', 'rs-chat-tit'); tit.appendChild(el('strong', null, cfg.titulo || 'PUVE IA')); tit.appendChild(el('span', 'rs-sub', cfg.subtitulo || 'Te cuento cómo va todo, en palabras fáciles'));
    const nuevo = el('button', 'rs-limpiar', 'Limpiar'); nuevo.type = 'button';
    cab.appendChild(tit); cab.appendChild(nuevo);
    const inp = el('input', 'rs-input'); inp.type = 'text'; inp.maxLength = 240; inp.placeholder = cfg.placeholder || 'Escribe tu pregunta…'; inp.setAttribute('aria-label', 'Tu pregunta'); inp.setAttribute('enterkeyhint', 'send'); inp.autocomplete = 'off';
    const bt = el('button', 'rs-enviar'); bt.type = 'submit'; bt.setAttribute('aria-label', 'Enviar pregunta'); bt.appendChild(icono('enviar'));
    form.appendChild(inp); form.appendChild(bt);
    (cfg.chips || []).forEach((x) => { const b = el('button', 'rs-chip', x); b.type = 'button'; b.onclick = () => enviar(x); chips.appendChild(b); });
    raiz.appendChild(cab); raiz.appendChild(msgs); if((cfg.chips || []).length) raiz.appendChild(chips); raiz.appendChild(form); cont.appendChild(raiz);
    let ocupado = false;
    const reducido = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    async function mostrarCartas(lista){
      let primera = null;
      for(const c of lista){
        const nodo = pintarCarta(c, enviar); msgs.appendChild(nodo);
        if(!primera) primera = nodo;
        if(!reducido) await dormir(320);
      }
      // al terminar, se deja a la vista el inicio de la respuesta para leerla de arriba hacia abajo
      if(primera) msgs.scrollTo({ top: Math.max(0, primera.offsetTop - 10), behavior: reducido ? 'auto' : 'smooth' });
    }
    async function enviar(texto){
      texto = String(texto || '').trim().slice(0, 240);
      if(!texto || ocupado) return;
      ocupado = true; inp.value = ''; bt.disabled = true;
      const u = el('div', 'rs-usuario', texto); msgs.appendChild(u); msgs.scrollTop = msgs.scrollHeight;
      const esc = el('div', 'rs-escribiendo'); for(let i = 0; i < 3; i++) esc.appendChild(el('span')); esc.setAttribute('aria-label', 'Pensando'); msgs.appendChild(esc); msgs.scrollTop = msgs.scrollHeight;
      let cartas;
      try {
        if(!navigator.onLine) throw new Error('sin conexión');
        cartas = await cfg.responder(texto);
      } catch(e){
        console.error(e);
        cartas = [carta('alerta', 'alerta', 'No pude consultarlo', navigator.onLine ? 'Algo falló al buscar la información. Inténtalo otra vez en un momento.' : 'No hay internet en este momento. Revisa tu conexión e inténtalo de nuevo.')];
      }
      esc.remove(); await mostrarCartas(cartas); ocupado = false; bt.disabled = false; inp.focus({ preventScroll: true });
    }
    async function iniciar(){ msgs.textContent = ''; if(cfg.saludo){ try { await mostrarCartas(await cfg.saludo()); } catch(e){ console.error(e); } } }
    form.addEventListener('submit', (ev) => { ev.preventDefault(); enviar(inp.value); });
    nuevo.onclick = () => { if(!ocupado) iniciar(); };
    iniciar();
    return { enviar, reiniciar: iniciar };
  }

  let montado = false;
  function abrir(){
    const cont = document.getElementById('resumenContenedor');
    if(!cont || !enlace.sb) return;
    if(montado && cont.firstChild) return;
    montado = true;
    const e = esCajero();
    crearChat(cont, {
      titulo: 'PUVE IA', subtitulo: e ? 'Tus ventas del turno, en palabras fáciles' : 'Cómo va tu negocio, en palabras fáciles',
      placeholder: e ? 'Ej: ¿cuánto llevo hoy?' : 'Ej: ventas de ayer de 2 a 5',
      chips: e ? ['¿Cuánto llevo vendido hoy?', '¿Qué he vendido más?', '¿Qué se está acabando?'] : ['¿Cómo me fue hoy?', 'Ventas de ayer', '¿Qué se me está acabando?', '¿Qué se vende más?', '¿A qué hora vendo más?', '¿Cómo está mi negocio?', '¿Qué hago para vender más?'],
      saludo: hAyuda, responder
    });
  }

  window.PuveResumen = {
    enlazar(o){ enlace = Object.assign(enlace, o || {}); },
    abrir,
    reiniciar(){ montado = false; memoria.clear(); },
    responder, crearChat, carta, nucleo: { norm, parseTiempo, extraerHoras, detectar, buscarProducto, compara, rangoTexto },
    ayudas: { cap, lista, veces, fmt, el, icono, dinero: (n) => $d(n) }
  };
})();
