/* PUVE IA · Resumen (chat que explica el negocio como un amigo)
 * Entiende la pregunta (puve-ia-nlu.js), lee los datos (puve-ia-datos.js) y contesta con una recomendación concreta y palabras sencillas.
 * Aprende sola: cada "me sirvió" y cada corrección entrena el clasificador de ese negocio; si varios negocios coinciden, pasa a ser vocabulario de todos
 * (con el filtro de la base de datos, SQL 131). Sin modelos externos. Solo lee: no cambia ventas, inventario ni precios.
 */
(function(){
  'use strict';
  const N = window.PuveIaNlu, D = window.PuveIaDatos;
  let enlace = { sb: null, dinero: (n) => '$' + Number(n || 0).toLocaleString('es-MX', { maximumFractionDigits: 2 }), productos: () => [], rol: () => null, usuarioId: () => null };

  // ---------- utilidades de redacción ----------
  const $d = (n) => enlace.dinero(n), $r = (n) => enlace.dinero(Math.round(Number(n) || 0));
  const cap = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  const fmt = (n) => { n = Number(n) || 0; return Number.isInteger(n) ? String(n) : (Math.abs(n) < 10 ? n.toFixed(1) : String(Math.round(n))); };
  const veces = (n, s, p) => n + ' ' + (n === 1 ? s : p);
  const lista = (a) => a.length <= 1 ? a.join('') : a.slice(0, -1).join(', ') + ' y ' + a[a.length - 1];
  const semilla = () => { const d = new Date(); return d.getFullYear() * 372 + d.getMonth() * 31 + d.getDate(); };
  const variante = (arr, extra) => arr[Math.abs(semilla() + (extra || 0)) % arr.length];
  const esCajero = () => enlace.rol() === 'vendedor', puedeCostos = () => enlace.rol() === 'admin';
  const SIN_PREP = /^(hoy|ayer|antier|el (lunes|martes|miércoles|jueves|viernes|sábado|domingo|\d))/;
  const en = (t) => SIN_PREP.test(t.etiqueta) ? t.etiqueta : 'en ' + t.etiqueta;
  const dias = (d) => d < 1 ? 'menos de un día' : (d < 1.5 ? 'un día' : 'unos ' + Math.round(d) + ' días');
  // bloques de un mensaje: párrafo, lista, pasos y sugerencias
  const P = (x) => ({ t: 'p', x }), L = (titulo, filas) => ({ t: 'lista', titulo, filas }), S = (titulo, items) => ({ t: 'pasos', titulo, items }), C = (items) => ({ t: 'chips', items });
  const sug = (x) => ({ texto: x, pregunta: x });

  function compara(act, prev, etPrev){
    if(!prev && !act) return '';
    if(!prev) return cap(etPrev) + ' no hubo ventas, así que vas mejor.';
    const dif = act - prev, rel = dif / prev;
    if(Math.abs(rel) < 0.03) return 'Vas casi igual que ' + etPrev + '.';
    return dif > 0 ? variante(['Eso es ' + $d(dif) + ' más que ' + etPrev + '.', 'Son ' + $d(dif) + ' más que ' + etPrev + '.'], 1) : variante(['Eso es ' + $d(-dif) + ' menos que ' + etPrev + '.', 'Son ' + $d(-dif) + ' menos que ' + etPrev + '.'], 1);
  }
  const topProductos = (a, n) => Object.entries(a.productos).map(([nombre, v]) => Object.assign({ nombre }, v)).sort((x, y) => y.cant - x.cant).slice(0, n || 3);
  const stockBajo = () => enlace.productos().filter((p) => D.esFisico(p) && Number(p.stock) <= 5).sort((a, b) => Number(a.stock) - Number(b.stock));
  function porCaducar(){
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    return enlace.productos().filter((p) => p.fecha_caducidad && D.esFisico(p) && Number(p.stock) > 0).map((p) => ({ p, dias: Math.ceil((new Date(p.fecha_caducidad + 'T00:00:00').getTime() - hoy.getTime()) / 86400000) })).filter((x) => x.dias <= 7).sort((a, b) => a.dias - b.dias);
  }
  const NOMBRE_PAGO = { efectivo: 'efectivo', tarjeta: 'tarjeta', transferencia: 'transferencia', mixto: 'pagos combinados' };
  async function rpc(nombre, args){ try { const r = await enlace.sb.rpc(nombre, args); return r.error ? null : r.data; } catch(e){ return null; } }

  async function periodo(c, conDetalle, defectoDias){
    let t = c.t, nota = null;
    if(!t.explicito && defectoDias) t = N.ultimos(defectoDias);
    let p = await D.cargarPeriodo(t, conDetalle);
    if(!c.t.explicito && !defectoDias && !p.act.n){ t = N.ultimos(7); p = await D.cargarPeriodo(t, conDetalle); nota = 'Hoy todavía no hay ventas, así que te cuento de los últimos 7 días.'; }
    return { p, t, nota };
  }

  // ---------- análisis de productos ----------
  const mediana = (a) => { if(!a.length) return 0; const s = a.slice().sort((x, y) => x - y), m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const estrellas = (an, n) => an.lista.filter((x) => x.u30 > 0).sort((x, y) => (y.margen30 != null && x.margen30 != null ? y.margen30 - x.margen30 : y.ing30 - x.ing30)).slice(0, n);
  function oportunidades(an, n){
    if(!an.hayCostos) return [];
    const con = an.lista.filter((x) => x.mUnit != null && x.mUnit > 0 && x.u30 > 0), mU = mediana(con.map((x) => x.mUnit)), mV = mediana(con.map((x) => x.vel));
    const f = (x) => x.mUnit * (1 + Math.max(-0.5, Math.min(1, x.tend)));
    return con.filter((x) => x.mUnit >= mU && x.vel <= mV && (!x.fisico || x.stock > 0)).sort((x, y) => f(y) - f(x)).slice(0, n);
  }
  const subiendo = (an, n, fuera) => an.lista.filter((x) => x.u30 >= 5 && x.tend >= 0.3 && !(fuera || []).includes(x)).sort((x, y) => y.tend - x.tend).slice(0, n);
  const paraNoInvertir = (an, n) => an.lista.filter((x) => x.fisico && x.capital != null && x.stock > 0 && x.dias >= 45 && x.capital >= 30).sort((x, y) => y.capital - x.capital).slice(0, n);
  const sinSalida = (an, n) => an.lista.filter((x) => !x.fisico && x.u30 <= 1).sort((x, y) => x.u30 - y.u30).slice(0, n);
  function paraComprar(an, n, semanas){
    const sem = semanas || 2;
    return an.lista.filter((x) => x.fisico && x.vel > 0 && x.dias < 7 * sem).map((x) => { const q = Math.max(1, Math.ceil(x.vel * 7 * sem - x.stock)); return Object.assign({ q, gasto: x.costo != null ? q * x.costo : null }, x); })
      .sort((x, y) => (y.margen30 != null && x.margen30 != null ? y.margen30 - x.margen30 : y.ing30 - x.ing30)).slice(0, n);
  }
  const verPlural = (arr, s, p) => arr.length === 1 ? s : p;

  // ---------- plan de acción: lo más importante y concreto que haría un asesor ----------
  async function plan(){
    const an = await D.analisis(), t = N.ultimos(14), pd = await D.cargarPeriodo(t, false), a = pd.act, b = pd.ant, out = [];
    const est = estrellas(an, 3), opp = oportunidades(an, 3), parados = paraNoInvertir(an, 3), cad = porCaducar(), pr = an.pares[0];
    est.forEach((x) => { if(x.fisico && x.vel > 0 && x.dias <= 7) out.push({ prio: 95, tipo: 'cuidar', titulo: 'Pide ' + x.nombre + ' hoy', texto: 'Es de lo que más vendes y te quedan ' + fmt(x.stock) + ': con lo que vendes (unas ' + fmt(x.vel) + ' al día) te dura ' + dias(x.dias) + '.' }); });
    if(cad.length) out.push({ prio: 90, tipo: 'cuidar', titulo: 'Vende primero lo que caduca', texto: lista(cad.slice(0, 3).map((x) => x.p.nombre)) + ' ' + verPlural(cad, 'caduca', 'caducan') + ' pronto. Ponlo en oferta o júntalo con algo que sí se venda.' });
    if(b.total > 0 && a.total < b.total * 0.9) out.push({ prio: 80, tipo: 'vender', titulo: 'Estás vendiendo menos que antes', texto: 'En los últimos 14 días vendiste ' + $r(b.total - a.total) + ' menos que en los 14 de antes. ' + (opp[0] ? 'Un empujón a ' + opp[0].nombre + ' (te deja ' + $d(opp[0].mUnit) + ' cada uno) puede ayudar.' : (est[0] ? 'Haz una oferta con ' + est[0].nombre + '.' : '')) });
    if(an.hayCostos && puedeCostos()){
      const g = await D.traerGastos(new Date(Date.now() - 30 * 86400000), new Date()), mg = an.lista.reduce((s, x) => s + (x.margen30 || 0), 0), tg = g ? g.reduce((s, x) => s + Number(x.monto), 0) : 0;
      if(tg > 0 && tg > mg) out.push({ prio: 85, tipo: 'ahorrar', titulo: 'Tus gastos se comen tu ganancia', texto: 'En 30 días ganaste ' + $r(mg) + ' con tus ventas y gastaste ' + $r(tg) + '. Revisa en qué se va el dinero y recorta lo que no sea necesario.' });
    }
    parados.forEach((x, i) => { if(i < 2) out.push({ prio: 70 - i, tipo: 'ahorrar', titulo: 'No compres más ' + x.nombre, texto: 'Tienes ' + $r(x.capital) + ' guardados ahí y ' + (x.vel > 0 ? 'te alcanza para ' + dias(x.dias) : 'no se vendió nada en el mes') + '. Mejor ponlo en oferta y usa ese dinero en lo que sí sale.' }); });
    if(opp[0]){ const c = D.compañero(an, opp[0].nombre); out.push({ prio: 65, tipo: 'vender', titulo: 'Ofrece más ' + opp[0].nombre, texto: 'Te deja ' + $d(opp[0].mUnit) + ' por cada uno y solo vendiste ' + fmt(opp[0].u30) + ' en el mes. Ofrécelo al cobrar' + (c ? ' junto con ' + c.con : '') + '.' }); }
    if(pr) out.push({ prio: 55, tipo: 'vender', titulo: 'Arma un combo', texto: pr.a + ' y ' + pr.b + ' se compran juntos seguido (' + veces(pr.n, 'vez', 'veces') + ' este mes). Ármalos en combo con un precio especial.' });
    const bajos = an.lista.filter((x) => x.mPct != null && x.mPct < 0.15 && x.vel * 30 >= 20).sort((x, y) => y.u30 - x.u30);
    if(bajos[0]) out.push({ prio: 50, tipo: 'vender', titulo: 'Sube un poquito ' + bajos[0].nombre, texto: 'Lo vendes mucho (' + fmt(bajos[0].u30) + ' en el mes) pero solo te quedan ' + $d(bajos[0].mUnit) + ' por cada uno. Con $1 o $2 más, ganarías bastante más sin que casi se note.' });
    if(a.n >= 10){
      const hs = a.porHora.map((v, h) => ({ h, v })).filter((x) => x.v > 0), fu = hs.slice().sort((x, y) => y.v - x.v)[0], ini = hs[0].h, fin = hs[hs.length - 1].h, fl = hs.filter((x) => x.h >= ini && x.h <= fin).sort((x, y) => x.v - y.v)[0];
      if(fl && hs.length >= 5) out.push({ prio: 40, tipo: 'vender', titulo: 'Llena tu hora más floja', texto: 'Vendes menos en el horario ' + N.horaFuerteTexto(fl.h) + '. Prueba una oferta relámpago ahí.' });
      if(fu) out.push({ prio: 30, tipo: 'cuidar', titulo: 'Prepárate para tu hora fuerte', texto: 'Vendes más en el horario ' + N.horaFuerteTexto(fu.h) + '. Ten listo lo que más vendes y, si puedes, otra persona en caja.' });
    }
    return out.sort((x, y) => y.prio - x.prio);
  }

  // ---------- respuestas por tema (cada una devuelve bloques) ----------
  const H = {};
  H.ventas = async (c) => {
    const { p, t, nota } = await periodo(c, false), a = p.act, b = p.ant;
    if(!a.n) return [P(cap(en(t)) + ' todavía no ' + (esCajero() ? 'tienes' : 'hay') + ' ventas en ese horario.'), P(t.etiqueta === 'hoy' ? 'Cuando se haga la primera, aquí te cuento cómo vas.' : 'Prueba con otro día o con "esta semana".')];
    const out = []; if(nota) out.push(P(nota));
    out.push(P((t.etiqueta === 'hoy' ? 'Llevas vendido ' : cap(en(t)) + ' vendiste ') + '**' + $d(a.total) + '** en ' + veces(a.n, 'venta', 'ventas') + '. ' + compara(a.total, b.total, t.etPrev)));
    let tk = 'Cada cliente te deja en promedio **' + $d(a.ticket) + '**.';
    if(b.n){ const dif = a.ticket - b.ticket; tk += Math.abs(dif) < 0.5 ? ' Casi igual que antes.' : (dif > 0 ? ' Antes dejaba ' + $d(b.ticket) + ': ahora gastan más.' : ' Antes dejaba ' + $d(b.ticket) + ': ahora gastan un poco menos.'); }
    out.push(P(tk));
    if(!esCajero() && b.total > 0 && a.total < b.total * 0.9) out.push(P('Si quieres, te digo qué hacer para recuperarte.'), C([sug('¿Cómo puedo vender más?')]));
    return out;
  };
  H.ganancia = async (c) => {
    const { p, t } = await periodo(c, true), a = p.act;
    if(!a.n) return [P(cap(en(t)) + ' todavía no hay ventas, así que no hay ganancia que contar.')];
    if(a.margen == null) return [P('Para decirte cuánto ganas necesito saber cuánto te cuesta cada producto.'), P('Entra a **Productos** y anota el costo de cada uno. Con eso te calculo todo.')];
    const out = [P('De **' + $d(a.total) + '** que vendiste ' + en(t) + ', **' + $d(a.margen) + '** son ganancia. Es lo que te queda después de pagar la mercancía: por cada $100 que vendes, te quedan ' + $r(a.margen / a.total * 100) + '.')];
    if(t.tipo === 'horas'){ out.push(P('Los gastos se anotan por día, no por hora. Pregúntame por el día completo y te digo tu ganancia real.')); return out; }
    const g = await D.traerGastos(t.desde, t.hasta);
    if(g){ const tot = g.reduce((s, x) => s + Number(x.monto), 0), real = a.margen - tot; out.push(P(tot ? 'Gastaste **' + $d(tot) + '** en cosas del negocio, así que tu ganancia de verdad es **' + $d(real) + '**.' + (real < 0 ? ' Estás gastando más de lo que ganas: revisa tus gastos.' : '') : 'No anotaste gastos en ese periodo, así que tu ganancia real es **' + $d(real) + '**.')); }
    return out;
  };
  H.gastos = async (c) => {
    const t = c.t.tipo === 'horas' ? N.parseTiempo(/^hoy/.test(c.t.etiqueta) ? 'hoy' : 'ayer') : (c.t.explicito ? c.t : N.parseTiempo('este mes'));
    const g = await D.traerGastos(t.desde, t.hasta), gA = await D.traerGastos(t.prevDesde, t.prevHasta);
    if(g == null) return [P('Los gastos solo los ve el encargado del negocio.')];
    const total = g.reduce((s, x) => s + Number(x.monto), 0);
    if(!total) return [P('No anotaste gastos ' + en(t) + '.'), P('Anótalos (renta, luz, sueldos…) para saber tu ganancia de verdad.')];
    const por = {}; g.forEach((x) => { por[x.categoria] = (por[x.categoria] || 0) + Number(x.monto); });
    const orden = Object.entries(por).sort((x, y) => y[1] - x[1]).slice(0, 4), prev = (gA || []).reduce((s, x) => s + Number(x.monto), 0);
    const out = [P(cap(en(t)) + ' gastaste **' + $d(total) + '**. ' + (prev ? (total > prev ? 'Es ' + $d(total - prev) + ' más que ' + t.etPrev + '.' : (total < prev ? 'Es ' + $d(prev - total) + ' menos que ' + t.etPrev + '.' : 'Igual que ' + t.etPrev + '.')) : '')), L('En qué se fue', orden.map(([k, v]) => [cap(k), $d(v), Math.round(v / total * 100) + ' de cada 100 pesos']))];
    if(orden[0][1] > total * 0.5) out.push(P('Más de la mitad se va en **' + orden[0][0] + '**: ahí es donde más puedes ahorrar.'));
    return out;
  };
  H.top = async (c) => {
    const { p, t, nota } = await periodo(c, true), a = p.act;
    if(!a.n) return [P('Todavía no hay ventas ' + en(t) + ' para decirte qué se vende más.')];
    const top = topProductos(a, 4), out = []; if(nota) out.push(P(nota));
    out.push(P('Lo que más se vendió ' + en(t) + ' fue **' + top[0].nombre + '** (' + fmt(top[0].cant) + ').'), L('Los más vendidos', top.map((x) => [x.nombre, fmt(x.cant) + ' vendidos', puedeCostos() && x.margen ? 'te dejó ' + $d(x.margen) + ' de ganancia' : ''])));
    if(puedeCostos() && a.margen != null){ const m = Object.entries(a.productos).map(([nombre, v]) => ({ nombre, margen: v.margen })).sort((x, y) => y.margen - x.margen)[0]; if(m && m.margen > 0 && m.nombre !== top[0].nombre) out.push(P('El que más ganancia te dejó fue **' + m.nombre + '** (' + $d(m.margen) + '), aunque no es el que más sale: ponlo más a la vista.')); }
    out.push(P('Procura que nunca te falte ' + top[0].nombre + '.'));
    return out;
  };
  H.lentos = async (c) => {
    const { p, t } = await periodo(c, true, 30), a = p.act, sin = enlace.productos().filter((q) => D.esFisico(q) && Number(q.stock) > 0 && !a.productos[q.nombre]);
    if(!sin.length) return [P('Todo se está moviendo: ' + en(t) + ' se vendió casi todo lo que tienes.')];
    const ord = sin.sort((x, y) => Number(y.stock) * Number(y.costo || 0) - Number(x.stock) * Number(x.costo || 0)).slice(0, 6);
    const out = [P('Esto no se vendió ' + en(t) + ':'), L('', ord.map((q) => [q.nombre, 'tienes ' + fmt(q.stock), Number(q.costo) > 0 ? $r(q.stock * q.costo) + ' guardados' : '']))];
    if(sin.length > 6) out.push(P('Y ' + (sin.length - 6) + ' más.'));
    out.push(P('Mi consejo: ponlos en oferta, júntalos con algo que sí se vende o acomódalos en un lugar más visible. Y por ahora **no compres más** de estos.'), C([sug('¿En qué no debería invertir?')]));
    return out;
  };
  H.stock = async () => {
    const prods = enlace.productos().filter(D.esFisico), agot = prods.filter((p) => Number(p.stock) <= 0), bajos = prods.filter((p) => Number(p.stock) > 0 && Number(p.stock) <= 5).sort((a, b) => Number(a.stock) - Number(b.stock));
    if(!agot.length && !bajos.length) return [P('Tu inventario está bien: no tienes nada agotado ni a punto de acabarse.')];
    const out = [];
    if(agot.length) out.push(P('Ya se acabó: **' + lista(agot.slice(0, 8).map((p) => p.nombre)) + '**' + (agot.length > 8 ? ' y ' + (agot.length - 8) + ' más' : '') + '.'));
    if(bajos.length) out.push(P('Te quedan pocos de:'), L('', bajos.slice(0, 8).map((p) => [p.nombre, fmt(p.stock) + ' ' + (Number(p.stock) === 1 ? 'pieza' : 'piezas'), ''])));
    out.push(P(esCajero() ? 'Avísale al encargado para que los pida.' : 'Si quieres, te armo la lista de lo que te conviene comprar.'));
    if(!esCajero()) out.push(C([sug('¿Qué debo comprar?')]));
    return out;
  };
  H.comprar = async () => {
    const an = await D.analisis(), l2 = paraComprar(an, 8, 2);
    if(!an.ventas30) return [P('Todavía no tengo suficientes ventas para saber cuánto te conviene comprar.')];
    if(!l2.length) return [P('Por ahora no necesitas comprar nada urgente: con lo que vendes, todo te alcanza para más de 2 semanas.'), C([sug('¿En qué no debería invertir?')])];
    const total = l2.reduce((s, x) => s + (x.gasto || 0), 0);
    const out = [P('Para que te alcance **2 semanas**, esto es lo que yo compraría (primero lo que más te deja):'), L('Qué comprar', l2.map((x) => [x.nombre, 'unas ' + x.q + ' piezas', 'tienes ' + fmt(x.stock) + ' y vendes ~' + fmt(x.vel) + ' al día' + (x.gasto != null ? ' · ' + $r(x.gasto) : '')]))];
    if(total > 0) out.push(P('En total serían unos **' + $r(total) + '**.'));
    out.push(P('No metas dinero en lo que se vende lento: eso lo veo aparte si quieres.'), C([sug('¿En qué no debería invertir?')]));
    return out;
  };
  H.no_invertir = async () => {
    const an = await D.analisis();
    if(!an.ventas30) return [P('Todavía no tengo suficientes ventas para decirte en qué no invertir.')];
    const pa = paraNoInvertir(an, 5), plat = sinSalida(an, 4), out = [];
    if(pa.length){
      const total = an.lista.filter((x) => x.fisico && x.capital != null && x.stock > 0 && x.dias >= 45).reduce((s, x) => s + x.capital, 0);
      out.push(P('Esto es lo que yo **no volvería a comprar por ahora**, porque ya tienes de sobra:'), L('Dinero parado', pa.map((x) => [x.nombre, $r(x.capital), x.vel > 0 ? 'vendes ~' + fmt(x.vel * 30) + ' al mes y tienes ' + fmt(x.stock) + ': te dura ' + dias(x.dias) : 'tienes ' + fmt(x.stock) + ' y no se vendió ninguno este mes'])));
      out.push(P('En total hay unos **' + $r(total) + '** guardados en mercancía que sale despacio. Mi consejo: ponlos en oferta (2x1, o 10% menos) para volverlos dinero, y ese dinero úsalo en lo que sí se vende.'));
    }
    if(plat.length) out.push(P('También **' + lista(plat.map((x) => x.nombre)) + '** casi no se ' + (plat.length === 1 ? 'vende' : 'venden') + '. No gastes en ingredientes o material para ' + (plat.length === 1 ? 'él' : 'ellos') + ' hasta que se muevan.'));
    if(!pa.length && !plat.length) out.push(P('Buenas noticias: no veo mercancía parada de más. Todo lo que tienes se está moviendo.'));
    if(!an.hayCostos) out.push(P('Ojo: sin el costo de tus productos no puedo calcular cuánto dinero tienes parado. Anótalos en **Productos** y te lo afino.'));
    out.push(C([sug('¿Qué me recomiendas vender más?'), sug('¿Qué debo comprar?')]));
    return out;
  };
  H.recomendar_vender = async () => {
    const an = await D.analisis();
    if(!an.ventas30) return [P('Todavía no tengo suficientes ventas de los últimos 30 días para decirte qué empujar. Cuando tengas unas cuantas, te lo digo con seguridad.')];
    const est = estrellas(an, 3), opp = oportunidades(an, 3), sub = subiendo(an, 2, est.concat(opp)), out = [P('Viendo tus últimos 30 días, esto es lo que yo **empujaría para vender más**:')];
    if(est.length) out.push(L('Tus mejores: que nunca falten y ponlos al frente', est.map((x) => [x.nombre, x.margen30 != null ? $r(x.margen30) + ' de ganancia' : $r(x.ing30) + ' vendidos', 'vendiste ' + fmt(x.u30) + (x.fisico && x.vel > 0 && x.dias <= 7 ? ' · te quedan pocos' : '')])));
    if(opp.length) out.push(L('Dejan buen dinero pero se venden poco: ofrécelos más', opp.map((x) => { const c = D.compañero(an, x.nombre); return [x.nombre, '+' + $d(x.mUnit) + ' cada uno', 'solo vendiste ' + fmt(x.u30) + (c ? ' · ofrécelo junto con ' + c.con : '')]; })));
    if(sub.length) out.push(L('Vienen subiendo: aprovéchalos', sub.map((x) => [x.nombre, '+' + Math.round(x.tend * 100) + ' de cada 100', 'vendiste ' + fmt(x.u30) + ' este mes'])));
    out.push(P('**Cómo hacerlo fácil:** pon un letrerito en el mostrador, ofrécelos al cobrar ("¿le agrego uno?") o júntalos con tus mejores en un combo.'));
    if(!an.hayCostos) out.push(P('Ojo: no tengo el costo de tus productos, así que los ordené por lo que más se vende. Anótalo en **Productos** y te digo cuáles dejan más ganancia.'));
    out.push(C([sug('¿En qué no debería invertir?'), sug('¿Qué precio le subo?')]));
    return out;
  };
  H.subir_ventas = async () => {
    const pl = (await plan()).filter((x) => x.tipo === 'vender').slice(0, 4);
    if(!pl.length) return [P('Ahorita no veo un problema que arreglar: tus ventas van parejas. Para crecer, prueba un combo o una oferta en tu producto más vendido.'), C([sug('¿Qué me recomiendas vender más?')])];
    return [P('Para vender más, yo haría esto, en este orden:'), S('', pl.map((x) => [x.titulo, x.texto])), C([sug('¿Qué me recomiendas vender más?'), sug('¿Qué precio le subo?')])];
  };
  H.que_hago = async () => {
    const pl = (await plan()).slice(0, 4);
    if(!pl.length) return [P('Todo va tranquilo, no veo nada urgente. Sigue así y revísame cada día para que no se te pase nada.')];
    return [P('Esto es lo más importante que yo haría ahorita:'), S('', pl.map((x) => [x.titulo, x.texto])), C([sug('¿Cómo vendo más?'), sug('¿En qué no debería invertir?')])];
  };
  H.precios = async () => {
    const an = await D.analisis();
    if(!an.hayCostos) return [P('Para decirte qué precios subir necesito el costo de tus productos. Anótalo en **Productos** y lo calculo.')];
    const cand = an.lista.filter((x) => x.mPct != null && x.mPct < 0.2 && x.u30 >= 5).sort((x, y) => y.u30 - x.u30).slice(0, 4);
    if(!cand.length) return [P('Tus precios se ven sanos: no encuentro productos que vendas mucho y dejen muy poco.')];
    return [P('Estos los vendes bastante pero te dejan poquito por cada uno. Subirles un poco ayuda:'), L('Candidatos a subir', cand.map((x) => { const aum = Math.max(1, Math.round(x.precioReal * 0.07)); return [x.nombre, '+' + $d(aum), 'hoy te quedan ' + $d(x.mUnit) + ' por pieza; si se vende igual, ganas ~' + $r(aum * x.u30) + ' más al mes']; })), P('Pruébalo una semana y mira si se sigue vendiendo parecido. Si baja mucho, regrésalo.')];
  };
  H.equilibrio = async () => {
    const an = await D.analisis(), g = await D.traerGastos(new Date(Date.now() - 30 * 86400000), new Date());
    if(g == null) return [P('Esto solo lo ve el encargado del negocio.')];
    const gt = g.reduce((s, x) => s + Number(x.monto), 0), mg = an.lista.reduce((s, x) => s + (x.margen30 || 0), 0), ing = an.ing30;
    if(!gt) return [P('No tienes gastos anotados en los últimos 30 días, así que no puedo calcular cuánto necesitas vender para cubrirlos. Anótalos y te lo digo.')];
    if(!an.hayCostos || mg <= 0 || ing <= 0) return [P('Tus gastos del mes son **' + $r(gt) + '**. Para saber cuánto necesitas vender para cubrirlos, necesito el costo de tus productos.')];
    const pct = mg / ing, necesito = gt / pct, falta = Math.max(0, necesito - ing);
    return [P('Tus gastos de 30 días son **' + $r(gt) + '**. De cada $100 que vendes te quedan ' + $r(pct * 100) + ', así que necesitas vender unos **' + $r(necesito) + '** al mes (como **' + $r(necesito / 30) + '** al día) para cubrir todo sin perder.'), P(falta > 0 ? 'En los últimos 30 días vendiste ' + $r(ing) + ': te faltaron unos **' + $r(falta) + '** para llegar.' : 'En los últimos 30 días vendiste ' + $r(ing) + ': ya pasaste esa meta por unos **' + $r(ing - necesito) + '**. Todo lo de arriba es ganancia.')];
  };
  H.prediccion = async (c) => {
    const dia = c.t.futuro ? new Date(c.t.desde).getDay() : (c.t.diaSemana != null ? c.t.diaSemana : new Date().getDay()), pr = await D.prediccion(dia), nombre = N.DIAS_BONITO[dia];
    if(!pr.n) return [P('Todavía no tengo suficientes ' + nombre + 's para calcularlo. Con unas semanas de ventas ya te lo digo.')];
    return [P('Un ' + nombre + ' normal vendes alrededor de **' + $r(pr.prom) + '**. Los ' + nombre + 's de las últimas semanas fueron desde ' + $r(pr.min) + ' hasta ' + $r(pr.max) + '.'), P('Es solo un cálculo con tu historial: si hay lluvia, quincena o fiesta, puede cambiar.')];
  };
  H.horas = async (c) => {
    const { p, t } = await periodo(c, false, 30), a = p.act;
    if(a.n < 3) return [P('Todavía hay muy pocas ventas para saber a qué hora vendes más.')];
    const hs = a.porHora.map((v, h) => ({ h, v })).filter((x) => x.v > 0), fu = hs.slice().sort((x, y) => y.v - x.v).slice(0, 3), out = [P('Vendes más en el horario **' + N.horaFuerteTexto(fu[0].h) + '** (' + $r(fu[0].v) + ' en ' + t.etiqueta + ').'), L('Tus horas fuertes', fu.map((x) => [N.horaFuerteTexto(x.h), $r(x.v), '']))];
    const ini = hs[0].h, fin = hs[hs.length - 1].h, fl = hs.filter((x) => x.h >= ini && x.h <= fin).sort((x, y) => x.v - y.v).slice(0, 2);
    if(fl.length && hs.length >= 5) out.push(P('Tus horas más flojas son ' + lista(fl.map((x) => N.horaFuerteTexto(x.h))) + '. Ahí prueba una oferta relámpago.'));
    out.push(P('En tu hora fuerte ten listo lo que más vendes y, si puedes, otra persona en caja.'));
    return out;
  };
  H.dias = async (c) => {
    const { p, t } = await periodo(c, false, 30), a = p.act;
    if(a.n < 5) return [P('Todavía hay muy pocas ventas para saber qué día vendes más.')];
    const dd = a.porDia.map((v, d) => ({ d, v })).filter((x) => x.v > 0).sort((x, y) => y.v - x.v), out = [P('Tu mejor día es el **' + N.DIAS_BONITO[dd[0].d] + '** (' + $r(dd[0].v) + ' en ' + t.etiqueta + ')' + (dd[1] ? ' y después el ' + N.DIAS_BONITO[dd[1].d] + '.' : '.'))];
    if(dd.length > 2) out.push(P('El más flojo es el ' + N.DIAS_BONITO[dd[dd.length - 1].d] + ' (' + $r(dd[dd.length - 1].v) + '). Haz una promoción ese día para llenarlo.'));
    return out;
  };
  H.pagos = async (c) => {
    const { p, t, nota } = await periodo(c, false), a = p.act;
    if(!a.n) return [P('Todavía no hay ventas ' + en(t) + ' para ver cómo te pagan.')];
    const orden = Object.entries(a.porMetodo).sort((x, y) => y[1] - x[1]), out = []; if(nota) out.push(P(nota));
    out.push(P('De cada $100 que cobras ' + en(t) + ': ' + lista(orden.map(([k, v]) => '**' + $r(v / a.total * 100) + '** son en ' + (NOMBRE_PAGO[k] || k))) + '.'));
    if(orden[0][0] === 'efectivo' && orden[0][1] / a.total > 0.85) out.push(P('Casi todo es efectivo: ofrece también tarjeta o transferencia para no perder clientes que no traen cambio.'));
    return out;
  };
  H.cajeros = async (c) => {
    const { p, t, nota } = await periodo(c, false), a = p.act, ids = Object.keys(a.porCajero);
    if(!ids.length) return [P('Todavía no hay ventas ' + en(t) + ' para comparar a tu equipo.')];
    const nombres = {}; try { const r = await enlace.sb.from('perfiles').select('id,nombre').in('id', ids); (r.data || []).forEach((x) => { nombres[x.id] = x.nombre; }); } catch(e){}
    const orden = ids.map((id) => ({ nombre: nombres[id] || 'Un cajero', n: a.porCajero[id].n, total: a.porCajero[id].total })).sort((x, y) => y.total - x.total), out = []; if(nota) out.push(P(nota));
    out.push(P('**' + orden[0].nombre + '** vendió más ' + en(t) + ': ' + $r(orden[0].total) + ' en ' + veces(orden[0].n, 'venta', 'ventas') + '.'));
    if(orden.length > 1) out.push(L('Todo el equipo', orden.map((x) => [x.nombre, $r(x.total), veces(x.n, 'venta', 'ventas')])));
    return out;
  };
  H.clientes = async () => {
    const d = await rpc('clientes_inactivos', { p_dias: 45 });
    if(d == null) return [P('No pude revisar tus clientes. Para verlos, activa **Clientes** o **Recompensas** y registra el teléfono al cobrar.')];
    if(!d.length) return [P('Tus clientes siguen viniendo: ninguno de los frecuentes lleva más de 45 días sin venir.')];
    return [P(veces(d.length, 'cliente frecuente lleva', 'clientes frecuentes llevan') + ' más de 45 días sin venir. Los que más te compraban:'), L('Escríbeles', d.slice(0, 4).map((x) => [x.nombre, $r(x.total), x.visitas + ' visitas'])), P('Mándales un WhatsApp con una promoción chica para que regresen.')];
  };
  H.riesgo = async () => {
    const cad = porCaducar(), out = [];
    if(!cad.length) out.push(P('No tienes nada caducado ni por caducar en los próximos 7 días.'));
    else {
      const ya = cad.filter((x) => x.dias <= 0), pronto = cad.filter((x) => x.dias > 0);
      if(ya.length) out.push(P('Ya caducó: **' + lista(ya.slice(0, 6).map((x) => x.p.nombre)) + '**. Sácalo de la venta para no tener problemas con tus clientes.'));
      if(pronto.length) out.push(P('Va a caducar pronto:'), L('', pronto.slice(0, 6).map((x) => [x.p.nombre, 'en ' + veces(x.dias, 'día', 'días'), fmt(x.p.stock) + ' en existencia'])), P('Véndelo primero: ponlo en oferta hoy o júntalo con algo que sí se vende.'));
    }
    const lentos = await rpc('productos_lentos', { p_dias: 60 });
    if(lentos && lentos.n) out.push(P('Además, **' + veces(lentos.n, 'producto lleva', 'productos llevan') + '** 60 días sin venderse y tienen ' + $r(lentos.capital) + ' de dinero parado. Una oferta hoy es mejor que nada.'));
    return out;
  };
  H.producto = async (c) => {
    const ps = c.productos || [];
    if(!ps.length) return [P('¿De qué producto quieres saber? Dime el nombre y te cuento cuánto se vende y cuánto te queda.')];
    const t = c.t.explicito ? c.t : N.ultimos(30), dato = await D.cargarPeriodo(t, true), a = dato.act, ids = new Set(ps.map((x) => x.nombre)), vs = Object.entries(a.productos).filter(([n]) => ids.has(n)).map(([, v]) => v);
    const cant = vs.reduce((s, v) => s + v.cant, 0), monto = vs.reduce((s, v) => s + v.monto, 0), marg = vs.reduce((s, v) => s + v.margen, 0), nombre = ps.length === 1 ? ps[0].nombre : lista(ps.slice(0, 3).map((x) => x.nombre)) + (ps.length > 3 ? ' y otros' : ''), out = [];
    out.push(P(cant ? 'De **' + nombre + '** vendiste **' + fmt(cant) + '** ' + en(t) + ' (' + $d(monto) + ').' + (puedeCostos() && marg ? ' Te dejó ' + $d(marg) + ' de ganancia.' : '') : 'De ' + nombre + ' no se vendió nada ' + en(t) + '.'));
    const fis = ps.filter(D.esFisico);
    if(fis.length){
      const st = fis.reduce((s, x) => s + Number(x.stock), 0), vd = cant / Math.max(1, t.dias);
      let txt = st <= 0 ? 'Ya se acabó.' : 'Te quedan **' + fmt(st) + '**.';
      if(st > 0 && vd > 0) txt += ' Al ritmo que lo vendes te alcanza para ' + dias(st / vd) + '.';
      out.push(P(txt));
      if(st <= 5 || (vd > 0 && st / vd < 5)) out.push(P(esCajero() ? 'Avísale al encargado para que lo pida.' : 'Yo lo pediría pronto para no quedarte sin él.'));
    }
    return out;
  };
  H.salud = async (c) => {
    const t = c.t.explicito ? c.t : N.ultimos(30), dato = await D.cargarPeriodo(t, true), a = dato.act, b = dato.ant;
    if(!a.n) return [P('Todavía no hay ventas ' + en(t) + ' para revisar cómo va tu negocio.')];
    let pts = 0; const pu = [], rel = b.total ? (a.total - b.total) / b.total : 0;
    pts += rel > 0.03 ? 1 : (rel < -0.2 ? -1.5 : (rel < -0.03 ? -0.5 : 0));
    pu.push(['Ventas', $r(a.total), b.total ? (rel >= 0 ? 'subieron ' : 'bajaron ') + $r(Math.abs(a.total - b.total)) + ' contra ' + t.etPrev : '']);
    if(a.margen != null){
      const por = a.total ? a.margen / a.total * 100 : 0; pts += por >= 25 ? 1 : (por < 12 ? -1 : 0);
      const g = await D.traerGastos(t.desde, t.hasta), gTot = g ? g.reduce((s, x) => s + Number(x.monto), 0) : null; if(gTot != null && a.margen - gTot < 0) pts -= 1.5;
      pu.push(['Ganancia', $r(a.margen), 'de cada $100 te quedan ' + $r(por) + (gTot != null ? ' · ya con gastos: ' + $r(a.margen - gTot) : '')]);
    }
    const fis = enlace.productos().filter(D.esFisico), ap = fis.filter((x) => Number(x.stock) <= 5).length;
    if(fis.length){ if(ap / fis.length > 0.3) pts -= 1; pu.push(['Inventario', ap ? veces(ap, 'producto', 'productos') : 'bien', ap ? 'agotados o por acabarse, de ' + fis.length : 'nada se está acabando']); }
    const cad = porCaducar(); if(cad.length){ pts -= 0.5; pu.push(['Caducidad', veces(cad.length, 'producto', 'productos'), 'caducan en menos de 7 días']); }
    const veredicto = pts >= 2 ? 'Tu negocio va **muy bien**.' : (pts >= 0.5 ? 'Tu negocio va **bien**.' : (pts >= -0.5 ? 'Tu negocio va **regular**: hay cosas por mejorar.' : 'Tu negocio **necesita atención pronto**.'));
    const pl = (await plan())[0], out = [P(veredicto + ' Esto es lo que veo ' + en(t) + ':'), L('', pu)];
    if(pl) out.push(P('Lo primero que haría: **' + pl.titulo + '.** ' + pl.texto));
    out.push(C([sug('¿Qué me recomiendas hacer?')]));
    return out;
  };
  H.resumen = async (c) => {
    const { p, t, nota } = await periodo(c, true), a = p.act, b = p.ant;
    if(!a.n) return [P(cap(en(t)) + ' todavía no ' + (esCajero() ? 'tienes' : 'hay') + ' ventas.'), P('Cuando haya, aquí te cuento cómo va todo.')];
    const out = []; if(nota) out.push(P(nota));
    out.push(P((t.etiqueta === 'hoy' ? 'Hoy llevas ' : cap(en(t)) + ' vendiste ') + '**' + $d(a.total) + '** en ' + veces(a.n, 'venta', 'ventas') + '. ' + compara(a.total, b.total, t.etPrev)));
    const filas = [], top = topProductos(a, 1)[0];
    if(puedeCostos() && a.margen != null){ const gastos = t.tipo === 'horas' ? null : await D.traerGastos(t.desde, t.hasta), g = gastos ? gastos.reduce((s, x) => s + Number(x.monto), 0) : null; filas.push(['Te quedó de ganancia', $d(a.margen), g ? 'ya con gastos: ' + $d(a.margen - g) : '']); }
    if(top) filas.push(['Lo que más salió', top.nombre, fmt(top.cant) + ' vendidos']);
    if(a.n >= 4 && t.tipo !== 'horas'){ const hs = a.porHora.map((v, h) => ({ h, v })).sort((x, y) => y.v - x.v)[0]; if(hs.v > 0) filas.push(['Tu mejor hora', N.horaFuerteTexto(hs.h), $d(hs.v)]); }
    const pg = Object.entries(a.porMetodo).sort((x, y) => y[1] - x[1])[0]; if(pg && Object.keys(a.porMetodo).length > 1) filas.push(['Cómo te pagaron', 'más ' + (NOMBRE_PAGO[pg[0]] || pg[0]), $r(pg[1] / a.total * 100) + ' de cada $100']);
    if(filas.length) out.push(L('', filas));
    const bajos = stockBajo(); if(bajos.length) out.push(P('Ojo: se te está acabando **' + lista(bajos.slice(0, 4).map((x) => x.nombre)) + '**' + (bajos.length > 4 ? ' y ' + (bajos.length - 4) + ' más' : '') + '.' + (esCajero() ? ' Avísale al encargado.' : '')));
    if(!esCajero()){ const pl = (await plan())[0]; if(pl) out.push(P('Lo que yo haría ahora: **' + pl.titulo + '.** ' + pl.texto)); out.push(C([sug('¿Qué me recomiendas vender más?'), sug('¿En qué no debería invertir?')])); }
    return out;
  };
  const GLOSARIO = [
    [['ganancia', 'utilidad'], 'La ganancia es lo que te queda después de pagar lo que te costó la mercancía. Si compras algo en $10 y lo vendes en $15, tu ganancia es $5.'],
    [['margen'], 'El margen es qué parte del precio es ganancia. Si vendes algo en $100 y te quedan $30, tu margen es 30%: de cada $100, $30 son tuyos.'],
    [['ticket'], 'El ticket promedio es lo que gasta en promedio cada cliente cada vez que te compra. Si hoy vendiste $1,000 a 10 clientes, el ticket promedio es $100.'],
    [['inventario', 'stock', 'existencia'], 'El inventario (o stock) son las cosas que tienes guardadas para vender. Cuando "el stock está bajo" quiere decir que te quedan pocas piezas.'],
    [['parado', 'capital'], 'El dinero parado es el dinero que pusiste en mercancía que no se está vendiendo. Mientras esté en el estante no te sirve: ahí conviene hacer ofertas para volverlo dinero.'],
    [['rotacion', 'rota'], 'La rotación es qué tan rápido se vende un producto. Si algo "rota rápido", se vende y lo vuelves a comprar seguido; si rota lento, se queda mucho tiempo guardado.'],
    [['costo'], 'El costo es lo que a ti te costó cada producto (lo que le pagaste al proveedor). El precio es lo que le cobras a tu cliente. La diferencia es tu ganancia.'],
    [['equilibrio'], 'El punto de equilibrio es lo que necesitas vender para cubrir todos tus gastos. Abajo de esa cifra pierdes; arriba de ella ya estás ganando.'],
    [['merma', 'caducidad'], 'La merma es lo que pierdes porque se echó a perder, caducó o se rompió. Por eso conviene vender primero lo que caduca pronto.'],
    [['combo'], 'Un combo es vender dos o más productos juntos a un precio especial. Funciona bien con cosas que la gente ya compra junta.']
  ];
  H.glosario = async (c) => {
    const t = N.norm(c.texto), hit = GLOSARIO.find(([ks]) => ks.some((k) => t.indexOf(k) >= 0));
    if(hit) return [P(hit[1]), P('¿Quieres que te lo explique con tus números?'), C([sug('¿Cuánto gané este mes?')])];
    return [P('Te explico lo que no se entienda. Dime qué palabra quieres que te explique, por ejemplo:'), C(['ganancia', 'margen', 'ticket promedio', 'dinero parado', 'punto de equilibrio'].map((x) => sug('¿Qué es ' + x + '?')))];
  };
  H.ayuda = async (c) => { if(H.capacidades) return H.capacidades(c); return H.ayuda0(c); };
  H.ayuda0 = async (c) => {
    const t = N.norm(c.texto);
    if(/gracias|perfecto|listo|^ok$/.test(t)) return [P(variante(['¡Con gusto! Aquí estoy para lo que necesites.', 'De nada. Cuando quieras te cuento cómo va todo.'], 3))];
    const e = esCajero(), h = new Date().getHours(), saludo = h < 12 ? 'Buenos días' : (h < 19 ? 'Buenas tardes' : 'Buenas noches');
    return [P(saludo + '. Soy PUVE IA y te explico cómo va ' + (e ? 'tu turno' : 'tu negocio') + ' con palabras sencillas.'), P(e ? 'Pregúntame, por ejemplo, cuánto llevas vendido, qué has vendido más o qué se está acabando.' : 'Pregúntame lo que quieras, como le preguntarías a un amigo: cuánto vendiste, qué conviene vender más, en qué no gastar tanto, qué comprar… Y si no te entiendo, dímelo: **aprendo de cada corrección**.')];
  };

  // ---------- entender y responder ----------
  const ETIQUETA_TEMAS = { ventas: 'Cuánto vendí', resumen: 'Cómo me fue', ganancia: 'Cuánto gané', gastos: 'Mis gastos', top: 'Lo que más se vende', lentos: 'Lo que no se vende', stock: 'Lo que se acaba', comprar: 'Qué comprar', no_invertir: 'En qué no gastar', recomendar_vender: 'Qué vender más', subir_ventas: 'Cómo subir mis ventas', precios: 'Mis precios', horas: 'Mejores horas', pagos: 'Cómo me pagan', que_hago: 'Qué me recomiendas', salud: 'Cómo está mi negocio', contar_ventas: 'Cuántas ventas llevo', comparar: 'Comparar con antes', por_que: 'Por qué suben o bajan mis ventas', oferta: 'Ofertas y combos', mejor_margen: 'Qué deja más ganancia', meta: 'Mi meta de ventas', proyeccion: 'Cuánto voy a cerrar', ultima_venta: 'Mi última venta', valor_inventario: 'Cuánto vale mi inventario', promedio: 'Mi promedio de ventas', catalogo: 'Mis productos', ayuda_app: 'Cómo usar PUVE', calculo: 'Hacer una cuenta' };
  const COMUNES = ['ventas', 'resumen', 'ganancia', 'top', 'stock', 'comprar', 'recomendar_vender', 'que_hago'];
  const PASOS = { ventas: 'Revisando tus ventas…', resumen: 'Juntando tu resumen…', ganancia: 'Calculando tu ganancia…', gastos: 'Sumando tus gastos…', top: 'Viendo qué se vende más…', lentos: 'Buscando lo que no sale…', stock: 'Revisando tu inventario…', comprar: 'Calculando qué te conviene comprar…', no_invertir: 'Buscando dinero parado…', recomendar_vender: 'Viendo qué te deja más…', subir_ventas: 'Pensando cómo subir tus ventas…', precios: 'Revisando tus precios…', horas: 'Viendo tus horarios…', dias: 'Viendo tus mejores días…', pagos: 'Viendo cómo te pagan…', cajeros: 'Comparando a tu equipo…', clientes: 'Revisando tus clientes…', riesgo: 'Revisando caducidades…', producto: 'Buscando ese producto…', salud: 'Revisando tu negocio completo…', que_hago: 'Pensando qué te conviene hacer…', equilibrio: 'Haciendo cuentas…', prediccion: 'Mirando tu historial…', glosario: 'Buscando cómo explicártelo…' };
  const UMBRAL_CLARO = 0.55;
  const temasPara = () => Object.keys(ETIQUETA_TEMAS).filter((i) => !(esCajero() && N.SOLO_ENCARGADO.has(i)));

  // Un módulo puede cambiar el tema según lo que se venía platicando (p. ej. «¿por qué?» después de una idea suya).
  const REDIRECCIONES = [];
  async function ejecutar(intent, ctx){
    for(const f of REDIRECCIONES){ let n = null; try { n = f(intent, ctx); } catch(e){ n = null; } if(n && n !== intent){ intent = n; ctx.intent = n; break; } }
    if(esCajero() && N.SOLO_ENCARGADO.has(intent)) return [P('Eso lo ve solo el encargado del negocio. Yo te puedo contar de **tus ventas**, lo que más has vendido y lo que se está acabando.')];
    if(!puedeCostos() && !esCajero() && ['ganancia', 'gastos', 'riesgo', 'clientes', 'equilibrio', 'precios', 'no_invertir', 'comprar', 'valor_inventario', 'datos_faltantes', 'oferta', 'mejor_margen'].includes(intent)) return [P('Eso depende de costos y gastos, y solo los ve el encargado del negocio.')];
    return (H[intent] || H.ayuda)(ctx);
  }

  const CHARLA = new Set(['saludo', 'como_estas', 'identidad', 'capacidades', 'gracias', 'despedida', 'animo', 'motivacion', 'chiste', 'queja', 'afirmar', 'negar', 'repetir', 'mas_detalle', 'como_aprendes', 'fuera_tema', 'hora_fecha', 'calculo', 'cambio', 'ayuda', 'ayuda_app']);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  // si alguien escribe algo que apunta a hacerse daño, no se responde con números: se responde con cuidado
  H.crisis = () => [P('Lamento mucho que estés pasando por algo así de pesado. Lo que sientes importa más que cualquier venta o número.'), P('No tienes que cargarlo solo: platícalo hoy mismo con alguien de confianza (un familiar, un amigo) o con un profesional. Si sientes que puedes hacerte daño o estás en peligro ahora, llama de inmediato a tu número de emergencias (en México, el 911).'), P('En México también puedes llamar a la Línea de la Vida, gratis y las 24 horas: **800 911 2000**. Si estás en otro país, busca la línea de ayuda emocional de tu zona.'), P('Aquí sigo para lo que necesites, pero primero tú.')];

  async function responder(texto, estado, onPaso, nivel){
    estado = estado || {}; nivel = nivel || 0;
    const original = String(texto || '').slice(0, 400), rg = N.reglas(original);
    if(rg && rg.intent === 'crisis') return [{ bloques: H.crisis(), meta: null }];
    const pr = N.buscarProductos(original, enlace.productos()), masc = pr.productos.length ? N.enmascarar(original, pr.palabras) : N.norm(original);
    const t = N.parseTiempo(original), partes = rg ? [masc] : N.dividir(masc), mensajes = [], nombres = enlace.productos().map((x) => x.nombre);
    for(const parte of partes.slice(0, 3)){
      const cl = N.clasificar(parte), top = cl.lista[0], sec = cl.lista[1], frase = N.sanear(parte, nombres);
      let intent = rg ? rg.intent : (top && top.p >= UMBRAL_CLARO && (!sec || top.p - sec.p >= 0.12 || cl.conocida) && cl.cobertura > 0.5 ? top.i : null);
      // preguntas cortas de seguimiento: "¿y ayer?", "¿y de la semana pasada?", "¿y de la coca?"
      if(!intent && estado.ultimo && (N.vacia(parte) || cl.cobertura <= 0.5) && (t.explicito || pr.productos.length)) intent = pr.productos.length && ['ventas', 'stock', 'top'].includes(estado.ultimo.intent) ? 'producto' : estado.ultimo.intent;
      if(!intent && pr.productos.length && N.vacia(parte)) intent = 'producto';
      // "sí / dale" aceptan lo último que se ofreció; "repite" y "más detalle" vuelven a la pregunta anterior
      if(intent === 'afirmar' && estado.sugerida && nivel < 2) return responder(estado.sugerida, estado, onPaso, nivel + 1);
      if(intent === 'repetir' && estado.ultimaPregunta && nivel < 2) return responder(estado.ultimaPregunta, estado, onPaso, nivel + 1);
      if(intent === 'mas_detalle' && estado.ultimaPregunta && nivel < 2){ estado.mas = true; try { return await responder(estado.ultimaPregunta, estado, onPaso, nivel + 1); } finally { estado.mas = false; } }
      const ctx = { t, texto: original, productos: pr.productos, intent, estado, mas: !!estado.mas, candidatos: cl.lista.map((x) => x.i) };
      if(!intent){
        const c1 = top && top.p >= 0.25 && cl.cobertura > 0.3 ? top.i : null, c2 = sec && sec.p >= 0.18 && cl.cobertura > 0.3 ? sec.i : null;
        const opciones = [c1, c2].filter(Boolean).filter((i, k, a) => a.indexOf(i) === k).filter((i) => ETIQUETA_TEMAS[i] && !(esCajero() && N.SOLO_ENCARGADO.has(i)));
        const bl = opciones.length ? [P('Creo que me preguntas por una de estas cosas, ¿cuál es?'), C(opciones.map((i) => ({ texto: ETIQUETA_TEMAS[i], elegir: i })))] : [P('No te entendí bien. ¿Qué quieres saber?'), C(temasPara().slice(0, 6).map((i) => ({ texto: ETIQUETA_TEMAS[i], elegir: i })))];
        mensajes.push({ bloques: bl, meta: { aclarar: true, frase, parte, original, ctx } });
        registrarAprendizaje(frase, 'desconocido', false);
        continue;
      }
      if(onPaso && !CHARLA.has(intent)) onPaso(PASOS[intent] || 'Pensando…');
      const bloques = await ejecutar(intent, ctx), charla = CHARLA.has(intent);
      const fin = ctx.intent || intent; mensajes.push({ bloques, meta: { intent: fin, p: top ? top.p : 1, frase, parte, original, ctx, charla } });
      if(!charla){ estado.ultimo = { intent: fin, productos: pr.productos }; estado.ultimaPregunta = original; }
      const ch = bloques.filter((b) => b.t === 'chips')[0]; estado.sugerida = ch && ch.items[0] && ch.items[0].pregunta ? ch.items[0].pregunta : null;
    }
    return mensajes;
  }

  // ---------- aprender: cada "me sirvió" y cada corrección ----------
  const LLAVE = () => 'puve_ia_v1_' + (enlace.usuarioId() || 'x');
  let memLocal = [], servidorOk = true;
  function guardarLocal(){ try { localStorage.setItem(LLAVE(), JSON.stringify(memLocal.slice(-400))); } catch(e){} }
  async function cargarAprendizaje(){
    try { memLocal = JSON.parse(localStorage.getItem(LLAVE()) || '[]'); N.cargarMemoria(memLocal, 3); } catch(e){ memLocal = []; }
    const r = await rpc('ia_cargar_aprendizaje');
    if(r){ N.cargarMemoria(r.global, 2); N.cargarMemoria(r.propio, 3); } else servidorOk = false;
  }
  function registrarAprendizaje(frase, intent, ok){
    if(!frase) return;
    if(intent !== 'desconocido'){
      if(ok){ N.aprender(frase, intent, 3); memLocal = memLocal.filter((x) => x.f !== frase); memLocal.push({ f: frase, i: intent }); }
      else { N.castigar(frase, intent); memLocal = memLocal.filter((x) => !(x.f === frase && x.i === intent)); }
      guardarLocal();
    }
    if(servidorOk) rpc('ia_aprender', { p_frase: frase, p_intent: intent, p_ok: !!ok });
  }

  // ---------- pantalla: chat limpio con esfera, texto fluido y animaciones suaves ----------
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const ICONOS = { enviar: 'M12 19V5M5 12l7-7 7 7', mic: 'M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3zM19 11a7 7 0 0 1-14 0M12 18v4', nuevo: 'M12 5v14M5 12h14', si: 'M20 6 9 17l-5-5', no: 'M18 6 6 18M6 6l12 12' };
  function el(tag, cls, txt){ const e = document.createElement(tag); if(cls) e.className = cls; if(txt != null) e.textContent = txt; return e; }
  function icono(n){ const s = document.createElementNS(SVG_NS, 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '2'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round'); s.setAttribute('aria-hidden', 'true'); const p = document.createElementNS(SVG_NS, 'path'); p.setAttribute('d', ICONOS[n]); s.appendChild(p); return s; }
  function esfera(tam, cls){ const o = el('span', 'rs-orb' + (cls ? ' ' + cls : '')); o.style.setProperty('--s', tam + 'px'); ['b1', 'b2', 'b3'].forEach((c) => o.appendChild(el('i', c))); return o; }
  const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
  const reducido = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // texto con **negritas**; las cantidades en pesos "cuentan" hasta su valor
  function texto(cont, x){
    x.split(/(\*\*[^*]+\*\*)/).forEach((seg) => {
      if(!seg) return;
      if(seg.startsWith('**')){ const v = seg.slice(2, -2), b = el('b', null, v), m = v.match(/^\$([\d,]+(?:\.\d+)?)$/); if(m && !reducido()){ b.className = 'rs-num'; b.dataset.v = m[1].replace(/,/g, ''); b.textContent = enlace.dinero(0); } cont.appendChild(b); }
      else cont.appendChild(document.createTextNode(seg));
    });
  }
  function contar(raiz){
    raiz.querySelectorAll('.rs-num').forEach((b) => {
      const fin = Number(b.dataset.v), t0 = performance.now(), dur = 900;
      (function paso(t){ const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); b.textContent = enlace.dinero(fin * e); if(k < 1) requestAnimationFrame(paso); else b.textContent = enlace.dinero(fin); })(t0);
    });
  }

  function crearChat(cont, cfg){
    cont.textContent = '';
    const raiz = el('div', 'rs-chat rs-sin-charla'), top = el('div', 'rs-top'), vista = el('div', 'rs-vista'), msgs = el('div', 'rs-mensajes'), vacio = el('div', 'rs-vacio'), pie = el('div', 'rs-pie'), sugs = el('div', 'rs-sugs'), form = el('form', 'rs-compo');
    const estado = {};
    msgs.setAttribute('aria-live', 'polite');
    const tit = el('div', 'rs-top-tit'); tit.appendChild(esfera(26, 'rs-mini')); tit.appendChild(el('strong', null, cfg.titulo || 'PUVE IA'));
    const nuevo = el('button', 'rs-nueva'); nuevo.type = 'button'; nuevo.setAttribute('aria-label', 'Nueva charla'); nuevo.appendChild(icono('nuevo')); nuevo.appendChild(el('span', null, 'Nueva'));
    top.appendChild(tit); top.appendChild(nuevo);
    const h = new Date().getHours(), saludo = h < 12 ? 'Buenos días' : (h < 19 ? 'Buenas tardes' : 'Buenas noches');
    const orbe = el('div', 'rs-orbe'); orbe.appendChild(esfera(116, 'rs-grande'));
    vacio.appendChild(orbe); vacio.appendChild(el('h3', 'rs-saludo', saludo + '.')); vacio.appendChild(el('p', 'rs-saludo-2', cfg.subtitulo || '¿Qué quieres saber de tu negocio? Pregúntame con tus palabras.'));
    const inicio = el('div', 'rs-inicio-sugs'); (cfg.chips || []).slice(0, 4).forEach((x, i) => { const b = el('button', 'rs-pill', x); b.type = 'button'; b.style.setProperty('--d', (400 + i * 90) + 'ms'); b.onclick = () => enviar(x); inicio.appendChild(b); }); vacio.appendChild(inicio);
    vista.appendChild(vacio); vista.appendChild(msgs);
    (cfg.chips || []).forEach((x) => { const b = el('button', 'rs-pill', x); b.type = 'button'; b.onclick = () => enviar(x); sugs.appendChild(b); });
    const inp = el('input', 'rs-input'); inp.type = 'text'; inp.maxLength = 400; inp.placeholder = cfg.placeholder || 'Escribe tu pregunta…'; inp.autocomplete = 'off'; inp.setAttribute('aria-label', 'Tu pregunta'); inp.setAttribute('enterkeyhint', 'send');
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition, mic = el('button', 'rs-mic'); mic.type = 'button'; mic.setAttribute('aria-label', 'Hablar'); mic.appendChild(icono('mic'));
    const bt = el('button', 'rs-enviar'); bt.type = 'submit'; bt.setAttribute('aria-label', 'Enviar pregunta'); bt.appendChild(icono('enviar')); bt.disabled = true;
    form.appendChild(inp); if(SR) form.appendChild(mic); form.appendChild(bt);
    pie.appendChild(sugs); pie.appendChild(form);
    raiz.appendChild(top); raiz.appendChild(vista); raiz.appendChild(pie); cont.appendChild(raiz);
    let ocupado = false, escuchando = null;
    inp.addEventListener('input', () => { bt.disabled = !inp.value.trim() || ocupado; });
    if(SR){
      mic.onclick = () => {
        if(escuchando){ escuchando.stop(); return; }
        const r = new SR(); r.lang = 'es-MX'; r.interimResults = true; r.maxAlternatives = 1; escuchando = r; raiz.classList.add('rs-escucha');
        r.onresult = (ev) => { const tx = Array.from(ev.results).map((x) => x[0].transcript).join(' '); inp.value = tx; bt.disabled = !tx.trim() || ocupado; if(ev.results[ev.results.length - 1].isFinal) setTimeout(() => enviar(tx), 250); };
        r.onend = r.onerror = () => { escuchando = null; raiz.classList.remove('rs-escucha'); };
        try { r.start(); } catch(e){ escuchando = null; raiz.classList.remove('rs-escucha'); }
      };
    }
    const bajar = (suave) => vista.scrollTo({ top: vista.scrollHeight, behavior: suave && !reducido() ? 'smooth' : 'auto' });

    async function revelar(asist, bloques){
      let i = 0; const anim = !reducido();
      const nodo = (cls) => { const e = el('div', cls + (anim ? ' rs-in' : '')); e.style.setProperty('--d', (i++ * 110) + 'ms'); asist.appendChild(e); return e; };
      for(const b of bloques){
        if(b.t === 'p'){ texto(nodo('rs-p'), b.x); }
        else if(b.t === 'lista'){ const e = nodo('rs-lista'); if(b.titulo) e.appendChild(el('div', 'rs-lista-t', b.titulo)); b.filas.forEach((f) => { const r = el('div', 'rs-fila'), a = el('div', 'rs-fila-a'); a.appendChild(el('span', 'rs-fila-n', f[0])); if(f[1]) a.appendChild(el('span', 'rs-fila-v', f[1])); r.appendChild(a); if(f[2]) r.appendChild(el('div', 'rs-fila-m', f[2])); e.appendChild(r); }); }
        else if(b.t === 'pasos'){ const e = nodo('rs-pasos'); if(b.titulo) e.appendChild(el('div', 'rs-lista-t', b.titulo)); b.items.forEach((it, k) => { const r = el('div', 'rs-paso'); r.appendChild(el('span', 'rs-paso-n', String(k + 1))); const c = el('div', 'rs-paso-c'); c.appendChild(el('strong', null, it[0])); c.appendChild(el('span', null, it[1])); r.appendChild(c); e.appendChild(r); }); }
        else if(b.t === 'chips'){ const e = nodo('rs-chips-i'); b.items.forEach((x) => { const b2 = el('button', 'rs-pill', x.texto); b2.type = 'button'; b2.onclick = () => { if(x.elegir) elegir(x.elegir, asist); else if(x.fn) accion(x.fn); else enviar(x.pregunta); }; e.appendChild(b2); }); }
      }
      if(anim){ setTimeout(() => contar(asist), 150); await dormir(Math.min(i * 110 + 500, 1800)); } else contar(asist);
    }
    function opinion(asist, meta){
      if(!cfg.aprende || !meta || !meta.frase || meta.aclarar || meta.charla) return;
      const f = el('div', 'rs-op'); f.appendChild(el('span', 'rs-op-q', '¿Te sirvió?'));
      const si = el('button', 'rs-op-b'); si.type = 'button'; si.setAttribute('aria-label', 'Sí me sirvió'); si.appendChild(icono('si')); si.appendChild(el('span', null, 'Sí'));
      const no = el('button', 'rs-op-b'); no.type = 'button'; no.setAttribute('aria-label', 'No era lo que preguntaba'); no.appendChild(icono('no')); no.appendChild(el('span', null, 'No era eso'));
      si.onclick = () => { registrarAprendizaje(meta.frase, meta.intent, true); f.textContent = ''; f.appendChild(el('span', 'rs-op-g', 'Gracias, así aprendo.')); };
      no.onclick = () => {
        registrarAprendizaje(meta.frase, meta.intent, false); f.textContent = ''; f.appendChild(el('span', 'rs-op-q', '¿Qué querías saber?'));
        const g = el('div', 'rs-op-temas'); const orden = ((meta.ctx && meta.ctx.candidatos) || []).concat(COMUNES, temasPara()).filter((i, k, a) => a.indexOf(i) === k && i !== meta.intent && ETIQUETA_TEMAS[i] && !(esCajero() && N.SOLO_ENCARGADO.has(i))).slice(0, 10); orden.forEach((i) => { const b = el('button', 'rs-pill rs-pill-s', ETIQUETA_TEMAS[i]); b.type = 'button'; b.onclick = () => { f.textContent = ''; f.appendChild(el('span', 'rs-op-g', 'Gracias, lo voy a recordar.')); corregir(meta, i); }; g.appendChild(b); });
        const o = el('button', 'rs-pill rs-pill-s', 'Otra cosa'); o.type = 'button'; o.onclick = () => { f.textContent = ''; f.appendChild(el('span', 'rs-op-g', 'Escríbelo con otras palabras y lo aprendo.')); inp.focus(); }; g.appendChild(o); f.appendChild(g);
      };
      f.appendChild(si); f.appendChild(no); asist.appendChild(f);
    }
    async function corregir(meta, intent){ registrarAprendizaje(meta.frase, intent, true); pen.abrir(); const ms = await cfg.ejecutar(intent, meta.ctx, estado, (t) => pen.texto(t)); await dormir(reducido() ? 0 : 200); pen.cerrar(); await mostrar(ms); }
    async function elegir(intent, asist){
      const meta = asist && asist._meta; if(!meta) return;
      asist.querySelectorAll('.rs-chips-i button').forEach((b) => { b.disabled = true; });
      registrarAprendizaje(meta.frase, intent, true); pen.abrir(); const ms = await cfg.ejecutar(intent, meta.ctx, estado, (t) => pen.texto(t)); await dormir(reducido() ? 0 : 200); pen.cerrar(); await mostrar(ms);
    }
    async function accion(fn){ try { const r = await fn(); if(r && r.length) await mostrar(r); } catch(e){ console.error(e); } }

    // indicador de "pensando": esfera pequeña y frases que cambian suavemente
    const pen = { nodo: null, t: null,
      abrir(){ const n = el('div', 'rs-pensando'); n.appendChild(esfera(30, 'rs-pen-orb')); const t = el('span', 'rs-pen-t', 'Entendiendo tu pregunta…'); n.appendChild(t); this.nodo = n; this.t = t; msgs.appendChild(n); raiz.classList.add('rs-piensa'); bajar(true); },
      texto(x){ if(!this.t) return; const t = this.t; t.classList.add('rs-out'); setTimeout(() => { t.textContent = x; t.classList.remove('rs-out'); }, 160); },
      cerrar(){ raiz.classList.remove('rs-piensa'); if(this.nodo){ this.nodo.remove(); this.nodo = null; } } };

    async function mostrar(mensajes){
      let primero = true;
      for(const m of mensajes){
        const asist = el('div', 'rs-asist'); asist._meta = m.meta; msgs.appendChild(asist);
        if(primero){ vista.scrollTo({ top: Math.max(0, asist.offsetTop - 80), behavior: reducido() ? 'auto' : 'smooth' }); primero = false; }
        await revelar(asist, m.bloques); opinion(asist, m.meta);
      }
    }
    async function enviar(txt){
      txt = String(txt || '').trim().slice(0, 400);
      if(!txt || ocupado) return;
      ocupado = true; inp.value = ''; bt.disabled = true; raiz.classList.remove('rs-sin-charla'); raiz.classList.add('rs-con-charla');
      msgs.appendChild(el('div', 'rs-user', txt)); bajar(true); pen.abrir();
      let ms;
      try { if(!navigator.onLine) throw new Error('sin conexión'); ms = await cfg.responder(txt, estado, (t) => pen.texto(t)); }
      catch(e){ console.error(e); ms = [{ bloques: [P(navigator.onLine ? 'Algo falló al buscar la información. Inténtalo otra vez en un momento.' : 'No hay internet en este momento. Revisa tu conexión e inténtalo de nuevo.')], meta: null }]; }
      await dormir(reducido() ? 0 : 260); pen.cerrar(); await mostrar(ms);
      ocupado = false; bt.disabled = !inp.value.trim(); if(!reducido()) inp.focus({ preventScroll: true });
    }
    form.addEventListener('submit', (ev) => { ev.preventDefault(); enviar(inp.value); });
    nuevo.onclick = () => { if(ocupado) return; msgs.textContent = ''; Object.keys(estado).forEach((k) => delete estado[k]); raiz.classList.remove('rs-con-charla'); raiz.classList.add('rs-sin-charla'); };
    return { enviar };
  }

  let montado = false, aprendizajeListo = false;
  function abrir(){
    const cont = document.getElementById('resumenContenedor');
    if(!cont || !enlace.sb) return;
    if(montado && cont.firstChild) return;
    montado = true;
    if(!aprendizajeListo){ aprendizajeListo = true; cargarAprendizaje(); }
    const e = esCajero();
    crearChat(cont, {
      titulo: 'PUVE IA', subtitulo: e ? '¿Cómo va tu turno? Pregúntame con tus palabras.' : '¿Qué quieres saber de tu negocio? Pregúntame con tus palabras.',
      placeholder: e ? 'Pregunta lo que quieras…' : 'Escribe o di tu pregunta…', aprende: true,
      chips: e ? ['¿Cuánto llevo vendido hoy?', '¿Qué he vendido más?', '¿Qué se está acabando?'] : ['¿Cómo me fue hoy?', '¿Cómo puedo hacer crecer mi negocio?', '¿Qué me recomiendas vender más?', '¿En qué no debería invertir?', '¿Qué se me está acabando?', '¿Cómo está mi negocio?'],
      responder, ejecutar: async (intent, ctx, estado, onPaso) => { if(onPaso) onPaso(PASOS[intent] || 'Pensando…'); const bloques = await ejecutar(intent, ctx); estado.ultimo = { intent, productos: ctx.productos }; return [{ bloques, meta: { intent, p: 1, frase: N.sanear(ctx.texto, enlace.productos().map((x) => x.nombre)), ctx } }]; }
    });
  }

  window.PuveResumen = {
    enlazar(o){ enlace = Object.assign(enlace, o || {}); D.enlazar(enlace); },
    abrir, responder, ejecutar, agregarRedireccion(f){ if(typeof f === 'function') REDIRECCIONES.push(f); },
    reiniciar(){ montado = false; aprendizajeListo = false; D.reiniciar(); },
    crearChat, ayudas: { P, L, S, C, sug, cap, lista, veces, fmt, dinero: (n) => $d(n), el },
    registrar: registrarAprendizaje,
    registrarTemas(handlers, etiquetas, pasos){ Object.assign(H, handlers || {}); Object.assign(ETIQUETA_TEMAS, etiquetas || {}); Object.assign(PASOS, pasos || {}); },
    internos: { enlace: () => enlace, D, N, P, L, S, C, sug, cap, lista, veces, fmt, $d, $r, en, dias, compara, periodo, topProductos, esCajero, puedeCostos, stockBajo, estrellas, oportunidades, paraNoInvertir, plan, mediana, pick, porCaducar, variante }
  };
})();
