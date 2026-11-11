/* PUVE IA · Plática de amigo y respuestas extra
 * Temas que no son un simple reporte: saludar, animar, explicar con otras palabras, hacer cuentas y calcular el cambio, y más análisis del negocio
 * (por qué suben o bajan las ventas, metas y proyección del día, ofertas con precio, inventario valorizado, qué productos dejan más…).
 * Se carga después de puve-resumen.js y se engancha con PuveResumen.registrarTemas. Solo lee datos; nunca cambia nada.
 */
(function(){
  'use strict';
  const R = window.PuveResumen, K = window.PuveIaConocimiento;
  if(!R || !R.internos || !K) return;
  const I = R.internos, { D, N, P, L, S, C, sug, cap, lista, veces, fmt, $d, $r, en, dias, compara, periodo, topProductos, esCajero, puedeCostos, estrellas, paraNoInvertir, mediana, pick } = I;
  const enlace = () => I.enlace();
  const H = {};
  const hora12 = (d) => d.toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' });
  const num = (n) => Number(n).toLocaleString('es-MX', { maximumFractionDigits: 2 });
  const esPesos = (t) => /(\$|pesos|peso|lana|feria|dinero|cobr|cuesta|precio|cuenta|total|cambio|paga)/.test(t);

  // ---------- plática ----------
  H.saludo = async () => {
    const h = new Date().getHours(), sal = h < 12 ? '¡Buenos días!' : (h < 19 ? '¡Buenas tardes!' : '¡Buenas noches!');
    const out = [P(pick([sal + ' ¿Cómo estás?', sal + ' Qué gusto verte por aquí.', '¡Hola! ' + sal.replace('¡', '').replace('!', '') + '.', sal + ' Aquí estoy para lo que necesites.']))];
    try {
      const p = await D.cargarPeriodo(N.parseTiempo('hoy'), false), a = p.act;
      out.push(P(a.n ? 'Por cierto, hoy llevas **' + $d(a.total) + '** en ' + veces(a.n, 'venta', 'ventas') + '. ' + compara(a.total, p.ant.total, 'ayer a esta misma hora') : 'Hoy todavía no hay ventas, pero el día apenas empieza.'));
    } catch(e){}
    out.push(P('¿En qué te ayudo?'));
    return out;
  };
  H.como_estas = async () => [P(pick(K.AMIGO.como_estas))];
  H.identidad = async () => [P(K.AMIGO.identidad[0]), C([sug('¿Qué puedes hacer?'), sug('¿Cómo aprendes?')])];
  H.capacidades = async () => {
    const e = esCajero();
    if(e) return [P('Soy PUVE IA y te cuento de **tus ventas**: cuánto llevas, qué has vendido más, a qué horas vendes y qué se está acabando. También te hago cuentas rápidas y te calculo el cambio.'), C([sug('¿Cuánto llevo vendido hoy?'), sug('¿Qué he vendido más?'), sug('¿Qué se está acabando?')])];
    return [P(K.AMIGO.capacidades[0]), C([sug('¿Cómo me fue hoy?'), sug('¿Qué me recomiendas vender más?'), sug('¿En qué no debería invertir?'), sug('¿Por qué bajaron mis ventas?')])];
  };
  H.gracias = async () => [P(pick(K.AMIGO.gracias))];
  H.despedida = async () => [P(pick(K.AMIGO.despedida))];
  H.motivacion = async () => [P(pick(K.AMIGO.motivacion))];
  H.chiste = async () => [P(pick(K.AMIGO.chiste)), C([sug('Cuéntame otro chiste')])];
  H.queja = async () => [P(pick(K.AMIGO.queja))];
  H.como_aprendes = async () => [P(K.AMIGO.como_aprendes[0])];
  H.fuera_tema = async () => [P(pick(K.AMIGO.fuera_tema)), C(esCajero() ? [sug('¿Cuánto llevo vendido hoy?')] : [sug('¿Cómo me fue hoy?'), sug('¿Qué me recomiendas hacer?')])];
  H.negar = async () => [P(pick(['Está bien. Si necesitas algo, aquí estoy.', 'Sin problema. Cuando quieras me preguntas.', 'Va, sin prisa. Aquí sigo para lo que se ofrezca.']))];
  H.afirmar = async () => [P(pick(['¡Va! ¿Qué quieres saber de tu negocio?', '¡Claro! Dime, ¿qué te cuento?'])), C(esCajero() ? [sug('¿Cuánto llevo vendido hoy?')] : [sug('¿Cómo me fue hoy?'), sug('¿Qué me recomiendas hacer?')])];
  H.repetir = async () => [P('Todavía no te he dicho nada que repetir. ¿Qué quieres saber?')];
  H.mas_detalle = async () => [P('Dime de qué quieres más detalle y te lo desgloso. Por ejemplo: "¿qué se vende más?" y luego "dame más detalles".')];
  H.hora_fecha = async () => { const d = new Date(); return [P('Son las **' + hora12(d) + '**. Hoy es ' + d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) + '.')]; };
  H.animo = async (c) => {
    const out = [P(pick(K.AMIGO.animo))];
    if(!esCajero()){
      try {
        const p = await D.cargarPeriodo(N.ultimos(7), false), a = p.act;
        if(a.n) out.push(P('Con calma, mira lo que sí veo: en los últimos 7 días vendiste **' + $r(a.total) + '** en ' + veces(a.n, 'venta', 'ventas') + '. ' + (p.ant.total && a.total >= p.ant.total ? 'Eso es más que la semana anterior; vas avanzando.' : 'Hay cosas por mejorar, pero tu negocio sigue vendiendo.')));
      } catch(e){}
      out.push(P('Si quieres, lo revisamos juntos paso a paso y vemos qué es lo más fácil de arreglar primero.'), C([sug('¿Cómo está mi negocio?'), sug('¿Qué me recomiendas hacer?')]));
    } else out.push(P('Un mal día pasa. Si quieres, te cuento cómo te fue en tus ventas de hoy.'), C([sug('¿Cuánto llevo vendido hoy?')]));
    return out;
  };

  // ---------- cuentas rápidas ----------
  const DENOM = [1000, 500, 200, 100, 50, 20, 10, 5, 2, 1];
  H.cambio = async (c) => {
    const nums = N.numeros(c.texto).filter((x) => x > 0).sort((a, b) => b - a);
    if(nums.length < 2) return [P('Dime con cuánto te paga el cliente y cuánto es la cuenta. Por ejemplo: "me paga con 500 y son 237".')];
    const pago = nums[0], cuenta = nums[1];
    if(pago < cuenta) return [P('Con ' + num(pago) + ' todavía no le alcanza: la cuenta es ' + num(cuenta) + ' y le faltan **' + $d(cuenta - pago) + '**.')];
    let cambio = Math.round((pago - cuenta) * 100) / 100, resto = Math.floor(cambio); const partes = [];
    DENOM.forEach((d) => { const n = Math.floor(resto / d); if(n > 0){ partes.push(n + ' de $' + d); resto -= n * d; } });
    const cent = Math.round((cambio - Math.floor(cambio)) * 100);
    return [P('Si te paga con **' + $d(pago) + '** y la cuenta es **' + $d(cuenta) + '**, le das de cambio **' + $d(cambio) + '**.'), partes.length ? P('Por ejemplo: ' + lista(partes) + (cent ? ' y ' + cent + ' centavos' : '') + '.') : P('Es puro cambio chico.')];
  };
  H.calculo = async (c) => {
    const t = N.ligero(c.texto).replace(/(\d),(\d{3})(?!\d)/g, '$1$2'), n = N.norm(c.texto), nums = N.numeros(c.texto), pm = t.match(/(\d+(?:\.\d+)?)\s*(?:%|por ciento)/), pct = pm ? parseFloat(pm[1]) : null, dinero = esPesos(t), f = (x) => dinero ? $d(x) : num(x);
    const baseNums = nums.filter((x, i) => !(pct != null && x === pct && nums.indexOf(x) === i));
    const base = baseNums.length ? baseNums[0] : null;
    if(/descuento|rebaja|desconta|le quito|quitar/.test(n) && pct != null && base != null){ const des = base * pct / 100; return [P('Con **' + num(pct) + '%** de descuento, ' + f(base) + ' queda en **' + f(base - des) + '**. El cliente se ahorra ' + f(des) + '.')]; }
    if(/iva/.test(n) && (base != null)){
      const p = pct != null ? pct : 16;
      if(/sin iva|antes de iva|incluye iva|ya trae iva|ya incluye/.test(n)){ const sin = base / (1 + p / 100); return [P('Si ' + f(base) + ' ya trae IVA de ' + num(p) + '%, el precio sin IVA es **' + f(sin) + '** y el IVA es ' + f(base - sin) + '.')]; }
      return [P('El IVA de ' + num(p) + '% sobre ' + f(base) + ' es **' + f(base * p / 100) + '**. Con IVA, el total es **' + f(base * (1 + p / 100)) + '**.')];
    }
    if(/propina/.test(n) && base != null){ const p = pct != null ? pct : 10; return [P('La propina de ' + num(p) + '% sobre ' + f(base) + ' es **' + f(base * p / 100) + '**, así que la cuenta con propina queda en **' + f(base * (1 + p / 100)) + '**.')]; }
    if(/(aumento|incremento|recargo|subir|subele|aumenta)/.test(n) && pct != null && base != null) return [P('Subiéndole ' + num(pct) + '% a ' + f(base) + ' queda en **' + f(base * (1 + pct / 100)) + '** (' + f(base * pct / 100) + ' más).')];
    if(pct != null && base != null) return [P('El **' + num(pct) + '%** de ' + f(base) + ' es **' + f(base * pct / 100) + '**.')];
    const op = t.match(/(\d+(?:\.\d+)?)\s*(\+|\*|\/|x|mas|menos|-|por|entre)\s*(\d+(?:\.\d+)?)/);
    if(op){
      const a = parseFloat(op[1]), b = parseFloat(op[3]), o = op[2]; let r, txt;
      if(o === '+' || o === 'mas'){ r = a + b; txt = f(a) + ' más ' + f(b); } else if(o === '-' || o === 'menos'){ r = a - b; txt = f(a) + ' menos ' + f(b); }
      else if(o === '*' || o === 'x' || o === 'por'){ r = a * b; txt = f(a) + ' por ' + num(b); } else { if(!b) return [P('No se puede dividir entre cero.')]; r = a / b; txt = f(a) + ' entre ' + num(b); }
      return [P(cap(txt) + ' es **' + f(r) + '**.')];
    }
    if(nums.length >= 2 && /suma|total/.test(n)) return [P('La suma de ' + lista(nums.map(f)) + ' es **' + f(nums.reduce((s, x) => s + x, 0)) + '**.')];
    if(nums.length >= 2 && /resta/.test(n)) return [P(f(nums[0]) + ' menos ' + f(nums[1]) + ' es **' + f(nums[0] - nums[1]) + '**.')];
    if(nums.length >= 2 && /multiplica/.test(n)) return [P(f(nums[0]) + ' por ' + num(nums[1]) + ' es **' + f(nums[0] * nums[1]) + '**.')];
    if(nums.length >= 2 && /divide/.test(n) && nums[1]) return [P(f(nums[0]) + ' entre ' + num(nums[1]) + ' es **' + f(nums[0] / nums[1]) + '**.')];
    return [P('Con gusto te hago la cuenta. Dímela con los números, por ejemplo: "cuánto es el 15% de 200", "300 más 450" o "200 con 10% de descuento".')];
  };

  // ---------- análisis extra ----------
  H.contar_ventas = async (c) => {
    const { p, t, nota } = await periodo(c, false), a = p.act, b = p.ant;
    if(!a.n) return [P(cap(en(t)) + ' todavía no ' + (esCajero() ? 'tienes' : 'hay') + ' ventas.')];
    const out = []; if(nota) out.push(P(nota));
    out.push(P((t.etiqueta === 'hoy' ? 'Llevas ' : cap(en(t)) + ' tuviste ') + '**' + veces(a.n, 'venta', 'ventas') + '** (' + veces(a.n, 'cliente atendido', 'clientes atendidos') + ').' + (b.n ? ' ' + cap(t.etPrev) + ' ' + (t.etiqueta === 'hoy' ? 'llevabas ' : 'hubo ') + b.n + '.' : '')));
    out.push(P('Cada una te deja en promedio **' + $d(a.ticket) + '**.'));
    return out;
  };
  H.catalogo = async (c) => {
    const ps = enlace().productos(), fis = ps.filter(D.esFisico), agot = fis.filter((x) => Number(x.stock) <= 0), t = N.norm(c.texto);
    if(!ps.length) return [P('Todavía no tienes productos registrados. Agrégalos en **Productos** y los cuento.')];
    if(/caro|barato/.test(t)){
      const caros = /caro/.test(t) && !/barato/.test(t), ord = ps.filter((x) => Number(x.precio) > 0).sort((a, b) => caros ? b.precio - a.precio : a.precio - b.precio).slice(0, 5);
      return [P('Tus productos más ' + (caros ? 'caros' : 'baratos') + ':'), L('', ord.map((x) => [x.nombre, $d(x.precio), '']))];
    }
    return [P('Tienes **' + veces(ps.length, 'producto', 'productos') + '** registrados' + (fis.length !== ps.length ? ' (' + fis.length + ' con inventario y ' + (ps.length - fis.length) + ' sin inventario, como platillos o servicios)' : '') + '.'), agot.length ? P(veces(agot.length, 'está agotado', 'están agotados') + ': ' + lista(agot.slice(0, 5).map((x) => x.nombre)) + (agot.length > 5 ? ' y ' + (agot.length - 5) + ' más' : '') + '.') : P('Ninguno está agotado.')];
  };
  H.precio_producto = async (c) => {
    const ps = c.productos || [];
    if(!ps.length) return [P('Dime de qué producto quieres saber el precio y te lo digo.')];
    return [P(ps.length === 1 ? '**' + ps[0].nombre + '** lo vendes en **' + $d(ps[0].precio) + '**.' : 'Esto encontré:'), L('', ps.slice(0, 8).map((x) => [x.nombre, $d(x.precio), puedeCostos() && Number(x.costo) > 0 ? 'te cuesta ' + $d(x.costo) + ' · ganas ' + $d(x.precio - x.costo) + ' por pieza (' + Math.round((x.precio - x.costo) / x.precio * 100) + ' de cada 100)' : '']))];
  };
  H.venta_mayor = async (c) => {
    const { p, t } = await periodo(c, false), v = p.ventas || [];
    if(!v.length) return [P(cap(en(t)) + ' todavía no hay ventas.')];
    const may = v.reduce((x, y) => Number(y.total) > Number(x.total) ? y : x), men = v.reduce((x, y) => Number(y.total) < Number(x.total) ? y : x);
    return [P('Tu venta más grande ' + en(t) + ' fue de **' + $d(may.total) + '** (a las ' + hora12(new Date(may.created_at)) + ').'), P('La más chica fue de ' + $d(men.total) + ' y el promedio es ' + $d(p.act.ticket) + '.'), P(Number(may.total) > p.act.ticket * 3 ? 'Esa venta fue más de 3 veces tu promedio: ¿qué se llevó el cliente? Ofrecerlo seguido te subiría el ticket.' : 'Tus ventas son bastante parejas.')];
  };
  H.promedio = async () => {
    const d = await D.diario(30), con = d.filter((x) => x.total > 0);
    if(con.length < 3) return [P('Todavía tengo pocos días de ventas para sacar un promedio. Con unos días más te lo digo.')];
    const prom = con.reduce((s, x) => s + x.total, 0) / con.length, tot = con.map((x) => x.total).sort((a, b) => a - b), bueno = tot[Math.floor(tot.length * 0.8)], flojo = tot[Math.floor(tot.length * 0.2)], hoy = D.fechaLocal(new Date()), de = d.find((x) => x.fecha === hoy);
    const out = [P('En los últimos 30 días vendes en promedio **' + $r(prom) + '** al día. Un día flojo ronda los ' + $r(flojo) + ' y uno bueno los ' + $r(bueno) + '.')];
    if(de) out.push(P('Hoy llevas **' + $r(de.total) + '**, que es ' + (de.total >= prom ? 'más' : 'menos') + ' de lo normal (' + Math.round(de.total / prom * 100) + ' de cada 100 de tu promedio), y todavía puede subir.'));
    return out;
  };
  H.comparar = async (c) => {
    const t = c.t, pc = await D.periodoCompleto(t), a = pc.act, b = pc.ant;
    if(!a.n && !b.n) return [P('No hay ventas en ninguno de los dos periodos para comparar.')];
    const dif = a.total - b.total, out = [P('Vendiste **' + $d(a.total) + '** ' + en(t) + ' contra **' + $d(b.total) + '** ' + t.etPrev + '. ' + (Math.abs(dif) < 1 ? 'Es prácticamente lo mismo.' : (dif > 0 ? 'Eso es **' + $d(dif) + ' más**' + (b.total ? ' (' + Math.round(dif / b.total * 100) + ' de cada 100)' : '') + '.' : 'Eso es **' + $d(-dif) + ' menos**' + (b.total ? ' (' + Math.round(-dif / b.total * 100) + ' de cada 100)' : '') + '.')))];
    out.push(P('Fueron ' + veces(a.n, 'venta', 'ventas') + ' contra ' + b.n + ', y cada cliente dejó ' + $d(a.ticket) + ' contra ' + $d(b.ticket) + '.'));
    if(!esCajero()){
      const m = movimientos(a, b), sube = m.filter((x) => x.dif > 0).slice(0, 3), baja = m.filter((x) => x.dif < 0).sort((x, y) => x.dif - y.dif).slice(0, 3);
      if(sube.length) out.push(L('Lo que más subió', sube.map((x) => [x.nombre, '+' + $r(x.dif), ''])));
      if(baja.length) out.push(L('Lo que más bajó', baja.map((x) => [x.nombre, $r(x.dif), ''])));
    }
    return out;
  };
  function movimientos(a, b){
    const nombres = new Set(Object.keys(a.productos).concat(Object.keys(b.productos)));
    return [...nombres].map((nombre) => ({ nombre, dif: ((a.productos[nombre] || {}).monto || 0) - ((b.productos[nombre] || {}).monto || 0), cant: ((a.productos[nombre] || {}).cant || 0) - ((b.productos[nombre] || {}).cant || 0) })).filter((x) => Math.abs(x.dif) > 0).sort((x, y) => Math.abs(y.dif) - Math.abs(x.dif));
  }
  H.por_que = async (c) => {
    const t = c.t.explicito ? c.t : N.ultimos(7), pc = await D.periodoCompleto(t), a = pc.act, b = pc.ant;
    if(!b.n && !a.n) return [P('Todavía no hay ventas suficientes para explicarte qué pasó.')];
    if(!b.n) return [P('Antes de ' + t.etiqueta + ' no hay ventas con qué comparar, así que no puedo decir qué cambió.')];
    const dif = a.total - b.total;
    if(Math.abs(dif) < b.total * 0.03) return [P('Tus ventas casi no cambiaron: **' + $d(a.total) + '** ' + en(t) + ' contra ' + $d(b.total) + ' ' + t.etPrev + '. No veo nada raro.')];
    const sube = dif > 0, efVol = (a.n - b.n) * b.ticket, efTick = (a.ticket - b.ticket) * a.n, out = [P('Tus ventas ' + (sube ? 'subieron' : 'bajaron') + ' **' + $r(Math.abs(dif)) + '** (de ' + $r(b.total) + ' a ' + $r(a.total) + ').')];
    const razones = [];
    if(Math.abs(efVol) >= Math.abs(efTick)) razones.push((sube ? 'Hubo más clientes' : 'Vino menos gente') + ': ' + a.n + ' ventas contra ' + b.n + ' (' + (a.n >= b.n ? '+' : '') + (a.n - b.n) + ').');
    else razones.push('Cada cliente ' + (sube ? 'gastó más' : 'gastó menos') + ': ' + $d(a.ticket) + ' contra ' + $d(b.ticket) + ' antes.');
    out.push(P('**Lo principal:** ' + razones[0]));
    if(!esCajero()){
      const m = movimientos(a, b), mov = (sube ? m.filter((x) => x.dif > 0) : m.filter((x) => x.dif < 0)).sort((x, y) => sube ? y.dif - x.dif : x.dif - y.dif).slice(0, 3);
      if(mov.length) out.push(L('Lo que más ' + (sube ? 'te subió' : 'te bajó'), mov.map((x) => [x.nombre, (x.dif > 0 ? '+' : '') + $r(x.dif), (x.cant > 0 ? '+' : '') + fmt(x.cant) + (Math.abs(x.cant) === 1 ? ' pieza' : ' piezas')])));
    }
    const faltaGente = Math.abs(efVol) >= Math.abs(efTick);
    out.push(P(sube ? 'Para mantenerlo: cuida que no te falte lo que más subió y avísale a tus clientes que sigues con buen surtido.' : (faltaGente ? 'Lo que yo haría: avisar a tus clientes (WhatsApp, redes) con una oferta en lo que más se vende, para que vuelva la gente.' : 'Lo que yo haría: ofrecer un extra al cobrar o armar un combo, para que cada cliente se lleve algo más.')), C([sug('¿Qué me recomiendas hacer?'), sug('¿Qué oferta hago?')]));
    return out;
  };
  H.mejor_periodo = async () => {
    const d = (await D.diario(90)).filter((x) => x.total > 0);
    if(d.length < 5) return [P('Todavía tengo pocos días de ventas para decirte cuál fue el mejor.')];
    const mejor = d.reduce((x, y) => y.total > x.total ? y : x), peor = d.reduce((x, y) => y.total < x.total ? y : x), prom = d.reduce((s, x) => s + x.total, 0) / d.length, f = (k) => new Date(k + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
    const sem = {}; d.forEach((x) => { const dt = new Date(x.fecha + 'T12:00:00'), lun = new Date(dt); lun.setDate(dt.getDate() - ((dt.getDay() + 6) % 7)); const k = D.fechaLocal(lun); sem[k] = (sem[k] || 0) + x.total; });
    const ms = Object.entries(sem).sort((a, b) => b[1] - a[1])[0];
    return [P('Tu mejor día en los últimos 90 fue el **' + f(mejor.fecha) + '**, con **' + $r(mejor.total) + '** (' + Math.round(mejor.total / prom * 10) / 10 + ' veces tu día normal).'), P('Tu mejor semana empezó el ' + f(ms[0]) + ': **' + $r(ms[1]) + '**. Tu día más flojo fue el ' + f(peor.fecha) + ' con ' + $r(peor.total) + '.'), P('Si recuerdas qué hiciste ese mejor día (oferta, fecha especial, clima), repítelo.')];
  };
  const finDeMes = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  async function ritmoHoy(){
    const ahora = new Date(), hoy = await D.cargarPeriodo(N.parseTiempo('hoy'), false), mes = await D.cargarPeriodo(N.ultimos(30), false), por = mes.act.porHora, tot = por.reduce((s, x) => s + x, 0);
    const h = ahora.getHours() + ahora.getMinutes() / 60; let acum = 0; for(let i = 0; i < 24; i++){ if(i + 1 <= h) acum += por[i]; else if(i < h) acum += por[i] * (h - i); }
    return { llevo: hoy.act.total, n: hoy.act.n, ticket: hoy.act.ticket || mes.act.ticket, parte: tot ? acum / tot : 0 };
  }
  H.proyeccion = async (c) => {
    const t = N.norm(c.texto);
    if(/mes/.test(t)){
      const ahora = new Date(), d = await D.diario(31), mtd = d.filter((x) => x.fecha.slice(0, 7) === D.fechaLocal(ahora).slice(0, 7)).reduce((s, x) => s + x.total, 0), dia = ahora.getDate(), tot = finDeMes(ahora);
      if(dia < 3) return [P('Apenas va empezando el mes; con un par de días más te lo calculo mejor.')];
      return [P('Llevas **' + $r(mtd) + '** en ' + dia + ' días. Al mismo paso, cerrarías el mes cerca de **' + $r(mtd / dia * tot) + '**.'), P('Es un cálculo simple (promedio por día × días del mes); si tus fines de semana venden más, el cierre real puede ser mayor.')];
    }
    const r = await ritmoHoy();
    if(!r.n) return [P('Hoy todavía no hay ventas, así que no puedo proyectar. Cuando haya algunas, te digo cómo cerrarías.')];
    if(r.parte < 0.08) return [P('Es muy temprano para proyectar con seguridad: llevas **' + $r(r.llevo) + '**. Más tarde te digo cómo vas a cerrar.')];
    const proy = r.llevo / r.parte;
    return [P('Llevas **' + $r(r.llevo) + '** y normalmente a esta hora ya se ha vendido como el ' + Math.round(r.parte * 100) + '% del día. A este ritmo cerrarías cerca de **' + $r(proy) + '** (entre ' + $r(proy * 0.85) + ' y ' + $r(proy * 1.15) + ').'), P('Es una estimación con tus horarios de los últimos 30 días; si cambia la hora fuerte, cambia el resultado.')];
  };
  H.meta = async (c) => {
    const t = N.norm(c.texto), nums = N.numeros(c.texto).filter((x) => x >= 50), alcance = /mes/.test(t) ? 'mes' : (/semana/.test(t) ? 'semana' : 'hoy'), ahora = new Date();
    const d = await D.diario(40), prom = d.length ? d.reduce((s, x) => s + x.total, 0) / d.length : 0;
    if(!nums.length) return [P('¿De cuánto quieres tu meta? Dime la cantidad, por ejemplo: "quiero vender 5 mil hoy" o "mi meta del mes es 80 mil".'), prom ? P('Como referencia, tu día normal ronda los **' + $r(prom) + '**; una meta realista sería un 10% o 15% más: unos **' + $r(prom * 1.12) + '** al día.') : P('Con unos días más de ventas te propongo una meta realista.')];
    const meta = Math.max(...nums);
    if(alcance === 'hoy'){
      const r = await ritmoHoy(), falta = meta - r.llevo;
      if(falta <= 0) return [P('¡Ya la lograste! Llevas **' + $r(r.llevo) + '** y tu meta era ' + $r(meta) + '. Todo lo que vendas ahora es de más.')];
      const out = [P('Llevas **' + $r(r.llevo) + '** y te faltan **' + $r(falta) + '** para llegar a ' + $r(meta) + '.')];
      if(r.ticket) out.push(P('Eso son unas **' + Math.ceil(falta / r.ticket) + ' ventas más** como las que haces normalmente (' + $d(r.ticket) + ' cada una).'));
      if(r.parte >= 0.08 && r.n) out.push(P('Al ritmo de hoy cerrarías cerca de ' + $r(r.llevo / r.parte) + ': ' + (r.llevo / r.parte >= meta ? 'vas en camino.' : 'te quedarías corto, así que conviene un empujón (oferta o combo) en la tarde.')));
      return out;
    }
    if(alcance === 'semana'){
      const lun = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - ((ahora.getDay() + 6) % 7)), llevo = d.filter((x) => x.fecha >= D.fechaLocal(lun)).reduce((s, x) => s + x.total, 0), restan = 7 - ((ahora.getDay() + 6) % 7), falta = meta - llevo;
      return [P(falta <= 0 ? '¡Ya cumpliste tu meta de la semana! Llevas **' + $r(llevo) + '**.' : 'Llevas **' + $r(llevo) + '** esta semana y te faltan **' + $r(falta) + '**. Quedan ' + restan + ' días contando hoy: necesitas unos **' + $r(falta / restan) + '** al día' + (prom ? ' (tu promedio es ' + $r(prom) + ')' : '') + '.')];
    }
    const ini = D.fechaLocal(new Date(ahora.getFullYear(), ahora.getMonth(), 1)), llevo = d.filter((x) => x.fecha >= ini).reduce((s, x) => s + x.total, 0), restan = finDeMes(ahora) - ahora.getDate() + 1, falta = meta - llevo;
    return [P(falta <= 0 ? '¡Ya cumpliste tu meta del mes! Llevas **' + $r(llevo) + '**.' : 'Llevas **' + $r(llevo) + '** este mes y te faltan **' + $r(falta) + '**. Quedan ' + restan + ' días contando hoy: necesitas unos **' + $r(falta / restan) + '** al día' + (prom ? ' (tu promedio es ' + $r(prom) + ')' : '') + '.' + (prom && falta / restan > prom * 1.3 ? ' Es bastante más de lo normal: quizá conviene una meta un poco menor o una promoción fuerte.' : ''))];
  };
  H.ultima_venta = async () => {
    const v = await D.ultimaVenta();
    if(!v) return [P('Todavía no hay ventas registradas.')];
    const f = new Date(v.created_at), min = Math.round((Date.now() - f.getTime()) / 60000), hace = min < 1 ? 'hace un momento' : (min < 60 ? 'hace ' + veces(min, 'minuto', 'minutos') : (min < 1440 ? 'hace ' + veces(Math.round(min / 60), 'hora', 'horas') : 'hace ' + veces(Math.round(min / 1440), 'día', 'días')));
    return [P('Tu última venta fue **' + hace + '** (' + (min < 1440 ? hora12(f) : f.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })) + ') por **' + $d(v.total) + '**.'), min > 180 && min < 600 ? P('Llevas varias horas sin vender: quizá sea buen momento para avisar de una oferta.') : P('')].filter((b) => b.x !== '');
  };
  H.valor_inventario = async () => {
    const ps = enlace().productos().filter(D.esFisico), con = ps.filter((x) => Number(x.costo) > 0 && Number(x.stock) > 0), sin = ps.filter((x) => !(Number(x.costo) > 0)).length;
    if(!con.length) return [P('Para decirte cuánto vale tu inventario necesito el costo de tus productos. Anótalo en **Productos** y lo calculo.')];
    const costo = con.reduce((s, x) => s + x.stock * x.costo, 0), venta = con.reduce((s, x) => s + x.stock * (Number(x.precio) || 0), 0), top = con.slice().sort((a, b) => b.stock * b.costo - a.stock * a.costo).slice(0, 4);
    return [P('Tu mercancía vale **' + $r(costo) + '** a precio de costo (lo que pagaste), y si la vendieras toda a tu precio normal serían unos **' + $r(venta) + '**. Son ' + veces(con.length, 'producto', 'productos') + ' con existencia.'), L('Donde más dinero tienes guardado', top.map((x) => [x.nombre, $r(x.stock * x.costo), fmt(x.stock) + ' piezas'])), sin ? P('Ojo: ' + veces(sin, 'producto no tiene', 'productos no tienen') + ' costo anotado, así que el total real es un poco mayor.') : P('Todo tu inventario tiene costo anotado, así que la cifra es completa.')];
  };
  H.datos_faltantes = async () => {
    const ps = enlace().productos(), sinCosto = ps.filter((x) => !(Number(x.costo) > 0)), sinPrecio = ps.filter((x) => !(Number(x.precio) > 0)), out = [];
    if(!sinCosto.length && !sinPrecio.length) return [P('Tu catálogo está completo: todos tus productos tienen costo y precio. Por eso mis cálculos de ganancia son confiables.')];
    if(sinCosto.length) out.push(P('**' + veces(sinCosto.length, 'producto no tiene', 'productos no tienen') + ' costo**: ' + lista(sinCosto.slice(0, 6).map((x) => x.nombre)) + (sinCosto.length > 6 ? ' y ' + (sinCosto.length - 6) + ' más' : '') + '. Sin el costo no puedo calcular tu ganancia ni decirte qué conviene vender.'));
    if(sinPrecio.length) out.push(P('**' + veces(sinPrecio.length, 'producto no tiene', 'productos no tienen') + ' precio**: ' + lista(sinPrecio.slice(0, 6).map((x) => x.nombre)) + '.'));
    out.push(P('Entra a **Productos**, anótalos, y mis respuestas serán mucho más precisas.'));
    return out;
  };
  H.oferta = async () => {
    const an = await D.analisis();
    if(!an.ventas30) return [P('Todavía no tengo suficientes ventas para sugerirte ofertas con números. Dime qué producto quieres mover y te ayudo con la cuenta.')];
    const out = [], parados = paraNoInvertir(an, 3);
    if(parados.length) out.push(P('Para **sacar mercancía parada** sin perder dinero, yo haría esto:'), L('Ofertas que te convienen', parados.map((x) => { const nuevo = Math.max(Math.ceil(x.costo * 1.1), Math.round(x.precio * 0.85)); return [x.nombre, '$' + nuevo + ' (antes $' + Math.round(x.precio) + ')', 'aún te quedan ' + $d(nuevo - x.costo) + ' por pieza · liberarías ' + $r(x.capital) + ' guardados']; })));
    const pr = an.pares.slice(0, 2).map((p) => { const a = an.lista.find((x) => x.nombre === p.a), b = an.lista.find((x) => x.nombre === p.b); return a && b ? { a, b, n: p.n, precio: Math.round((a.precio + b.precio) * 0.92) } : null; }).filter(Boolean);
    if(pr.length) out.push(L('Combos que ya compra tu gente junta', pr.map((x) => [x.a.nombre + ' + ' + x.b.nombre, '$' + x.precio, 'se compraron juntos ' + x.n + ' veces este mes · con 8% menos que por separado']))), out.push(P('Un combo funciona porque la gente ya quiere ambas cosas; solo le das un motivo para llevárselas juntas.'));
    if(!out.length) out.push(P('No veo mercancía parada ni pares que se compren juntos, así que no necesitas una oferta para sacar nada. Si quieres subir ventas, puedo sugerirte qué producto empujar.'), C([sug('¿Qué me recomiendas vender más?')]));
    else out.push(P('Antes de lanzar cualquier oferta, revisa que el precio nuevo siga arriba de tu costo.'));
    return out;
  };
  H.mejor_margen = async () => {
    const an = await D.analisis();
    if(!an.hayCostos) return [P('Para decirte qué te deja más necesito el costo de tus productos. Anótalo en **Productos** y lo calculo.')];
    const con = an.lista.filter((x) => x.mUnit != null && x.mUnit > 0), porPieza = con.slice().sort((a, b) => b.mUnit - a.mUnit).slice(0, 5), porCiento = con.filter((x) => x.u30 >= 3).sort((a, b) => b.mPct - a.mPct).slice(0, 3);
    return [P('Estos son los que **más te dejan por cada pieza**:'), L('', porPieza.map((x) => [x.nombre, $d(x.mUnit), 'vendiste ' + fmt(x.u30) + ' este mes'])), porCiento.length ? P('Y en proporción (de cada $100 que cobras, cuánto es ganancia), los mejores son ' + lista(porCiento.map((x) => x.nombre + ' (' + Math.round(x.mPct * 100) + ')')) + '.') : P(''), P('Los que dejan mucho y se venden poco son tu mejor oportunidad: ofrécelos más.')].filter((b) => b.t !== 'p' || b.x !== '');
  };
  H.ayuda_app = async (c) => {
    const e = enlace(); let r = null;
    try { r = e.faq ? e.faq(c.texto) : null; } catch(err){}
    if(r && r.respuesta){
      const out = r.respuesta.split(/\n+/).filter(Boolean).map((x) => P(x));
      if(r.seccion && e.irA) out.push(C([{ texto: 'Llévame ahí', fn: async () => { e.irA(r.seccion); return null; } }]));
      return out;
    }
    if(r && r.accion && e.irA) return [P('Eso suena a un problema o una idea para el equipo de PUVE. Cuéntalo desde **Soporte** y lo revisan.'), C([{ texto: 'Ir a Soporte', fn: async () => { e.irA('soporte'); return null; } }])];
    if(e.faqNoSabe) try { e.faqNoSabe(c.texto); } catch(err){}
    return [P('Todavía no sé cómo se hace eso en PUVE; ya lo anoté para aprenderlo. Mientras, puedes escribirle al equipo desde **Soporte** y te ayudan.')];
  };

  const ETIQUETAS = {};
  const PASOS = { por_que: 'Comparando para ver qué cambió…', comparar: 'Comparando los dos periodos…', meta: 'Haciendo las cuentas de tu meta…', proyeccion: 'Calculando cómo vas a cerrar…', oferta: 'Armando ofertas con tus números…', mejor_margen: 'Viendo qué te deja más…', valor_inventario: 'Sumando tu inventario…', mejor_periodo: 'Buscando tu mejor día…', promedio: 'Sacando tu promedio…', ultima_venta: 'Buscando tu última venta…', contar_ventas: 'Contando tus ventas…', venta_mayor: 'Buscando tus ventas más grandes…' };
  R.registrarTemas(H, ETIQUETAS, PASOS);
})();
