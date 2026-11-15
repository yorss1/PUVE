/* PUVE IA · Simulador «¿y si…?» (Etapa 5; motor propio, SIN IA externa: todo se calcula aquí con los datos de tu negocio)
 * Qué hace:
 *  · «¿Y si subo 10% el refresco?», «¿y si lo dejo a $25?», «¿y si hago 2×1 en tacos?» → tres escenarios (peor caso razonable, probable, mejor caso), punto de equilibrio y lo que haría.
 *  · «¿Y si compro 100 de refresco?» → cuánto dinero queda parado y en cuántos días se vendería.   · «¿Y si quito las galletas?» → cuánto dejas de vender y de ganar.
 *  · «¿Y si contrato a alguien de 8 mil al mes?» → cuánto más tendrías que vender para pagarlo.     · «¿Y si abro una hora más / los domingos?» → rango de lo que podría sumar.
 *  · «¿Y si hago un combo de A y B?» → si el descuento se compensa.
 * Reglas: cada cifra trae su supuesto a la vista, nunca se presenta como promesa, separa HECHO (tus números) de HIPÓTESIS (lo que supone), dice qué tan confiable es
 * y, si falta un dato (cuánto pagarías, cuántas piezas), PREGUNTA en vez de inventarlo. Solo lee: no cambia ventas, inventario ni precios.
 * Lo que simula como idea medible («Voy a probarla») se guarda con los números de «antes» en la memoria del asesor y 14 días después se compara con lo que pasó.
 * Se carga antes de puve-ia-asesor-contexto.js y se engancha con PuveResumen.agregarPre / registrarTemas.
 */
(function(){
  'use strict';
  const R = window.PuveResumen;
  if(!R || !R.internos || !R.agregarPre || !R.registrarTemas) return;
  const I = R.internos, { D, N, P, L, C, sug, lista, veces, fmt, $d, $r, dias, puedeCostos } = I;
  const H = {};
  const MIN_VENTAS = 10;        // con menos ventas en 30 días no se simula nada
  const MIN_U = 5;              // un producto con menos de 5 piezas en 30 días no alcanza para simular
  const PEND_MS = 3 * 60000;    // lo que el simulador preguntó se espera 3 minutos
  const suma = (a, f) => a.reduce((s, x) => s + (f(x) || 0), 0);
  const pct = (n) => Math.round(Math.abs(n) * 100) + '%';
  const pctS = (n) => Math.abs(n) > 0 && Math.abs(n) < 0.005 ? 'menos de 1%' : pct(n);
  const signo = (n) => n >= 0 ? '+' : '−';
  const dif = (n) => signo(Math.round(n)) + $r(Math.abs(n));
  const nom = (a) => lista(a.map((x) => x.nombre));
  const SEGUIR = (...x) => C(x.map(sug));
  const num = (n) => fmt(Math.round(n));

  // ---------- leer el texto: cifras, porcentajes y palabras ----------
  const PAL = { dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, quince: 15, veinte: 20, veinticinco: 25, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90, cien: 100, doscientos: 200, trescientos: 300, quinientos: 500 };
  const limpio = (s) => ' ' + String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/×/g, 'x').replace(/(\d),(\d{3})(?!\d)/g, '$1$2').replace(/(\d),(\d)/g, '$1.$2').replace(/[$¿?¡!;:()"«»,]/g, ' ').replace(/\s+/g, ' ') + ' ';
  function leer(texto){
    let t = limpio(texto).replace(/ q /g, ' que ').replace(/ xq /g, ' porque '), x2 = false, x3 = false;
    t = t.replace(/\b(2 ?x ?1|dos por uno|2 por 1)\b/g, () => { x2 = true; return ' '; }).replace(/\b(3 ?x ?2|tres por dos|3 por 2)\b/g, () => { x3 = true; return ' '; });
    t = t.replace(/\b(dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|quince|veinte|veinticinco|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa|cien|doscientos|trescientos|quinientos)\b/g, (w) => PAL[w])
      .replace(/\b(un|uno|una) (?=mil\b|hora|horas|empleado|cajero|mesero|persona|dia|mes|pieza|unidad)/g, '1 ');
    t = t.replace(/(\d+(?:\.\d+)?)\s*(?:mil|k)\b/g, (m, a) => String(parseFloat(a) * 1000));
    let p = null;
    t = t.replace(/(\d+(?:\.\d+)?)\s*(?:%|por ?ciento|porciento)/, (m, a) => { p = parseFloat(a); return ' '; });
    if(p == null && /\b(a la mitad|a mitad de precio|mitad de precio)\b/.test(t)) p = 50;
    if(p == null && x2) p = 50; if(p == null && x3) p = 100 / 3;
    return { t, pct: p, nums: [...t.matchAll(/\d+(?:\.\d+)?/g)].map((m) => parseFloat(m[0])), x2, x3 };
  }

  // ---------- qué clase de simulación es ----------
  const HIPOT = /\b(y si|que pasa si|que pasaria si|que pasara si|que tal si|si yo|simula\w*|simul\w+|supon\w*|imagina\w*|cuanto (?:ganaria|perderia|dejaria|me dejaria|venderia|me costaria|me quedaria)|como me iria|me conviene|conviene|valdria la pena|vale la pena)\b/;
  const SEG = /^ y (?:a|con|si fuera|si son|de|en) (?:un )?\d/;
  const UP = /\b(subo|subir|subirle|sube|subiendo|aumento|aumentar|aumentarle|aumentando|incremento|incrementar|levanto|encarezco|encarecer)\b/;
  const DOWN = /\b(bajo|bajar|bajarle|bajando|reduzco|reducir|rebajo|rebajar|rebajando|disminuyo|disminuir|abarato|abaratar)\b/;
  const DESC = /\b(descuento|descuentos|rebaja|rebajas|promocion|promociones|promo|oferta|ofertas|ofertar)\b/;
  const QUITAR = /\b(quito|quitar|quitando|elimino|eliminar|eliminando|saco|sacar|retiro|retirar|dejo de vender|dejar de vender|deje de vender|ya no vendo|descontinuo|descontinuar|borro|borrar|doy de baja|dar de baja)\b/;
  const COMPRAR = /\b(compro|comprar|comprando|pido|pedir|pidiendo|surto|surtir|abasto|abastecer|invierto|invertir|traigo|traer)\b/;
  const PERSONA = /\b(empleado|empleada|empleados|ayudante|mesero|mesera|cocinero|cocinera|cajero|cajera|personal|trabajador|trabajadora|vendedor|vendedora|persona|alguien|gente)\b/;
  const CONTRATAR = /\b(contrato|contratar|contratando|emplear|sumo|sumar|agrego|agregar|meto|meter|tomo|tomar|tener)\b/;
  const HORARIO = /\b(abro|abrir|abriendo|cierro|cerrar|cerrando|alargo|alargar|extiendo|extender|amplio|ampliar|trabajo|trabajar|atiendo|atender)\b/;
  const FRANJA = /\b(hora|horas|horario|temprano|tarde|noche|madrugada|domingo|domingos|lunes|martes|miercoles|jueves|viernes|sabado|sabados|festivos|dia|dias)\b/;
  const SUCURSAL = /\b(sucursal|sucursales|otro local|segundo local|otra tienda|franquicia|segundo negocio|otro negocio|otro punto)\b/;
  const DIAS = [['domingo', 0], ['lunes', 1], ['martes', 2], ['miercoles', 3], ['jueves', 4], ['viernes', 5], ['sabado', 6]];

  // devuelve null si NO es una simulación (así no le quita preguntas a los demás temas)
  function entender(texto, prods, sim, estado){
    const lx = leer(texto); let t = lx.t;
    if(SUCURSAL.test(t)) return null;
    const hip = HIPOT.test(t) || /^ si /.test(t), ult = sim && sim.ult, segCifra = !!(ult && SEG.test(t));
    let productos = (prods || []).slice(0, 8), seguimiento = false;
    if(!hip && !segCifra) return null;
    const hayVerbo = UP.test(t) || DOWN.test(t) || DESC.test(t) || QUITAR.test(t) || COMPRAR.test(t) || CONTRATAR.test(t) || HORARIO.test(t) || /\bcombo\b/.test(t) || lx.x2 || lx.x3;
    // «¿y a $24?», «¿y si es 5%?»: solo una cifra nueva sobre la última simulación de precio
    if(ult && ult.tipo === 'precio' && !hayVerbo && !productos.length && (lx.pct != null || lx.nums.length)){
      seguimiento = true; t = ' ' + (ult.dir === 'baja' ? 'bajo' : 'subo') + (ult.todos ? ' todos los precios ' : ' el precio ') + t; lx.t = t;
    }
    if(!productos.length && estado && estado.ref && window.PuveIaContexto && window.PuveIaContexto.internos){
      const ord = window.PuveIaContexto.internos.porOrdinal(N.norm(texto), estado.ref);
      if(ord) productos = [ord]; else if(/\b(ese|esa|el mismo|la misma)\b/.test(t) && (estado.ref.foco || estado.ref.lista[0])) productos = [estado.ref.foco || estado.ref.lista[0]];
    }
    const conUlt = () => { if(!productos.length && ult && ult.prods && ult.prods.length && !ult.todos) productos = ult.prods.slice(0, 8); return productos.length; };
    const base = { raw: String(texto || ''), t, pct: lx.pct, nums: lx.nums, x2: lx.x2, x3: lx.x3, seguimiento };
    if(/\bcombo\b/.test(t)) return Object.assign(base, { tipo: 'combo', productos });
    if(CONTRATAR.test(t) && PERSONA.test(t)) return Object.assign(base, { tipo: 'contratar', productos: [] });
    if(QUITAR.test(t)) return Object.assign(base, { tipo: 'quitar', productos: conUlt() ? productos : [], falta: conUlt() ? null : 'producto' });
    if(HORARIO.test(t) && FRANJA.test(t) && !productos.length) return Object.assign(base, { tipo: 'horario', productos: [] });
    if(COMPRAR.test(t) && conUlt()) return Object.assign(base, { tipo: 'compra', productos });
    const sube = UP.test(t), baja = DOWN.test(t) || DESC.test(t) || lx.x2 || lx.x3 || /\b(a la mitad|mitad de precio)\b/.test(t);
    if(!sube && !baja) return null;
    const rotulo = DESC.test(t) || lx.x2 || lx.x3 ? 'descuento' : 'precio', dir = sube && !baja ? 'sube' : 'baja';
    const todos = !productos.length && (/\bprecios\b/.test(t) || /\b(todo|toda|todos|todas)\b/.test(t)) && lx.pct != null;
    if(!todos && !conUlt()){ if(lx.pct == null && !lx.nums.length) return null; return Object.assign(base, { tipo: 'precio', productos: [], dir, rotulo, falta: 'producto' }); }
    return Object.assign(base, { tipo: 'precio', productos: todos ? [] : productos, todos, dir, rotulo });
  }

  // ---------- datos de apoyo ----------
  const hallar = (an, p) => an.lista.find((x) => x.id === p.id);
  function ratioMargen(an){   // de cada $1 que vendes, cuánto se queda antes de gastos (solo con los productos que tienen costo, y si cubren al menos la mitad de las ventas)
    const cc = an.lista.filter((x) => x.costo != null && x.ing30 > 0), ing = suma(cc, (x) => x.ing30);
    return ing > 0 && an.ing30 > 0 && ing / an.ing30 >= 0.5 ? suma(cc, (x) => x.margen30) / ing : null;
  }
  const CONF = {
    hipotesis: ['hipótesis', 'se apoya en supuestos generales, no en pruebas hechas en tu negocio.'],
    moderada: ['evidencia moderada', 'sale de tu propio historial, pero otras cosas también cambian con el tiempo.'],
    cuenta: ['la cuenta es exacta; que las ventas lleguen es una hipótesis', 'la aritmética sale de tus números, pero nadie puede asegurar cuánto venderás.']
  };
  const conf = (k, extra) => P('**Qué tan confiable es:** ' + CONF[k][0] + (CONF[k][0].length < 25 ? ' — ' + CONF[k][1] : '') + (extra ? ' ' + extra : ''));
  const POCAS = (n) => [P('Todavía tengo pocas ventas (**' + n + '** en los últimos 30 días) para simular algo con números. Con menos de ' + MIN_VENTAS + ' ventas cualquier cifra sería inventada.'), P('Registra todas tus ventas en PUVE durante 2 o 4 semanas y vuelve a preguntarme «¿y si…?».')];
  const preguntar = (sim, texto, falta, productos) => { sim.pend = { t: Date.now(), texto, falta, productos: productos || [] }; };

  // la idea simulada, lista para «Voy a probarla» (se mide sola con los mismos números de «antes» que las ideas del asesor)
  const hash = (s) => { let h = 5381; for(let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h.toString(36).slice(0, 8); };
  function ofrecerPrueba(estado, idea){
    const A = window.PuveIaAsesor, M = window.PuveIaAsesorMemoria;
    if(!idea.medicion || !A || !A.memoria || !M || !M.activo || !M.activo()) return false;
    A.memoria(estado).ultima = Object.assign({ impacto: null, tipo: 'ganancia', supuesto: '', cuenta: '', evidencia: [], cuando: 'semana', prio: 50 }, idea);
    return true;
  }
  const idePasos = (a, b, c) => [['Hazlo poco tiempo', a], ['Mídelo', b], ['Decide con números', c]];

  // ---------- ¿qué precio se ha cobrado y cuánto se vendió? (si hubo dos precios distintos, se ve cuánto reacciona la gente) ----------
  async function historiaPrecio(x){
    let lin; try { lin = await D.detalleLineas(60); } catch(e){ return null; }
    const por = new Map();
    lin.filter((l) => l.id === x.id && l.cant > 0 && l.sub > 0).forEach((l) => { const k = D.fechaLocal(l.f), o = por.get(k) || { u: 0, ing: 0 }; o.u += l.cant; o.ing += l.sub; por.set(k, o); });
    const niv = new Map();
    por.forEach((o) => { const pu = o.ing / o.u, k = Math.round(Math.log(pu) / Math.log(1.03)), n = niv.get(k) || { p: 0, dias: 0, u: 0 }; n.p += pu; n.dias++; n.u += o.u; niv.set(k, n); });
    const v = [...niv.values()].filter((n) => n.dias >= 6 && n.u >= 12).sort((a, b) => b.dias - a.dias).slice(0, 2);
    if(v.length < 2) return null;
    const [lo, hi] = v[0].p / v[0].dias <= v[1].p / v[1].dias ? [v[0], v[1]] : [v[1], v[0]], pLo = lo.p / lo.dias, pHi = hi.p / hi.dias;
    if(pHi / pLo - 1 < 0.04) return null;
    const qLo = lo.u / lo.dias, qHi = hi.u / hi.dias, eps = -((qHi - qLo) / qLo) / ((pHi - pLo) / pLo);
    return { eps: eps > 0.05 ? Math.min(3, eps) : null, pLo, pHi, qLo, qHi, diasLo: lo.dias, diasHi: hi.dias };
  }

  // «sube 10%», «a $25», «de 20 a 24», «5 pesos más»: cuánto cambia el precio (como proporción)
  function leerDelta(e, x){
    const p0 = x.precioReal, t = e.t, dentro = (p1) => p1 > 0.3 * p0 && p1 < 4 * p0, sg = e.dir === 'baja' ? -1 : 1;
    if(e.pct != null) return { delta: sg * e.pct / 100, nota: '' };
    let m = t.match(/\bde (\d+(?:\.\d+)?) a (\d+(?:\.\d+)?)\b/) || t.match(/\ba (\d+(?:\.\d+)?)\b/);
    if(m){ const p1 = parseFloat(m[m.length - 1]); if(dentro(p1)) return { delta: p1 / p0 - 1, nota: '' }; }
    if(e.nums.length){
      const n0 = e.nums[0];
      if(!/\b(pesos?|mas|menos)\b/.test(t) && dentro(n0) && n0 / p0 >= 0.5 && n0 / p0 <= 2) return { delta: n0 / p0 - 1, nota: '' };
      if(n0 > 0 && n0 < p0) return { delta: sg * n0 / p0, nota: '' };
    }
    return { delta: sg * 0.1, nota: 'Como no me dijiste cuánto, usé 10%. Dime «a $25» o «5%» si quieres otra cifra.' };
  }

  // ---------- 1) subir o bajar precio · descuento · 2×1 ----------
  async function simPrecio(e, an, c, sim){
    let items = e.todos ? an.lista.filter((x) => x.u30 > 0) : e.productos.map((p) => hallar(an, p)).filter(Boolean);
    const flojos = items.filter((x) => x.u30 < MIN_U); items = items.filter((x) => x.u30 >= MIN_U);
    if(!items.length) return [P((flojos.length ? '**' + nom(flojos) + '** casi no se ' + (flojos.length === 1 ? 'vende' : 'venden') + ' (menos de ' + MIN_U + ' piezas en 30 días)' : 'No encontré productos con ventas') + ': con tan pocas ventas cualquier simulación sería inventada. Elige uno que sí se mueva.'), SEGUIR('¿Cuáles son mis productos más vendidos?')];
    const unico = items.length === 1 && !e.todos ? items[0] : null;
    let delta, nota = '';
    if(unico) ({ delta, nota } = leerDelta(e, unico));
    else { delta = (e.dir === 'baja' ? -1 : 1) * (e.pct != null ? e.pct : 10) / 100; if(e.pct == null) nota = 'Como no me dijiste cuánto, usé 10%.'; }
    if(!isFinite(delta) || delta <= -0.9 || delta > 3) return [P('Esa cifra no me cuadra. Dime cuánto cambiarías el precio, por ejemplo «sube 10%» o «a $25».')];
    if(Math.abs(delta) < 0.005) return [P('Ese precio es casi igual al de hoy: no cambia nada.')];
    const sube = delta > 0, gIt = items.filter((x) => x.costo != null), ingG = suma(gIt, (x) => x.ing30), parcial = !!gIt.length && gIt.length < items.length, hayG = gIt.length > 0 && (unico ? true : ingG >= 0.5 * suma(items, (x) => x.ing30));
    const hist = unico ? await historiaPrecio(unico) : null, obs = hist && hist.eps != null ? hist.eps : null, bas = obs != null ? obs : 0.8;
    const ES = sube ? { cons: obs != null ? obs * 1.6 : 1.5, prob: bas, opt: obs != null ? obs * 0.4 : 0.3 } : { cons: obs != null ? obs * 0.4 : 0.3, prob: bas, opt: obs != null ? obs * 1.6 : 1.5 };
    const q0 = suma(items, (x) => x.u30), ing0 = suma(items, (x) => x.ing30), gan0 = hayG ? suma(gIt, (x) => x.margen30) : null;
    const proy = (eps, d) => { const f = Math.max(0, 1 - eps * d); let q = 0, ing = 0, gan = hayG ? 0 : null; items.forEach((x) => { const p1 = x.precioReal * (1 + d), q1 = x.u30 * f; q += q1; ing += q1 * p1; if(hayG && x.costo != null) gan += q1 * (p1 - x.costo); }); return { q, ing, gan, f }; };
    const esc = { cons: proy(ES.cons, delta), prob: proy(ES.prob, delta), opt: proy(ES.opt, delta) };
    const cambio = (s) => hayG ? s.gan - gan0 : s.ing - ing0;
    const fila = (rot, s) => [rot, dif(cambio(s)) + (hayG ? ' de ganancia al mes' : ' de ventas al mes'), 'vendes ' + signo(s.f - 1) + pct(s.f - 1) + ' de piezas (' + num(s.q) + ' al mes)'];
    // punto de equilibrio: cuántas piezas puedes perder (o necesitas ganar) para quedar igual que hoy
    let eq = null;
    if(hayG){ const den = suma(gIt, (x) => x.u30 * (x.precioReal * (1 + delta) - x.costo)); eq = den > 0 ? gan0 / den : Infinity; }
    const rot = e.rotulo === 'descuento', verbo = sube ? 'subir' : 'bajar';
    const accion = e.todos ? verbo + ' todos tus precios ' + pct(delta)
      : (unico ? (rot && !sube ? 'un descuento en ' : verbo + ' ') + unico.nombre + ' de ' + $d(unico.precioReal) + ' a ' + $d(unico.precioReal * (1 + delta)) + ' (' + signo(delta) + pct(delta) + ')' : verbo + ' el precio de ' + nom(items) + ' ' + pct(delta));
    const out = [P('Simulé **' + accion + '**' + (e.x2 ? ' (2×1 = pagar la mitad por pieza)' : (e.x3 ? ' (3×2 = pagar un tercio menos por pieza)' : '')) + '.')];
    out.push(P('**Hoy:** ' + (unico ? 'vendes ' + num(q0) + ' piezas al mes a ' + $d(unico.precioReal) + (hayG ? ' y cada una te deja ' + $d(unico.mUnit) + ' (' + $r(gan0) + ' al mes)' : '') : 'estos productos suman ' + num(q0) + ' piezas y ' + $r(ing0) + ' en ventas al mes' + (hayG ? ' y ' + $r(gan0) + ' de ganancia' : '')) + '.'));
    out.push(L('Lo que podría pasar en un mes', [fila('Peor caso razonable', esc.cons), fila('Lo más probable', esc.prob), fila('Mejor caso', esc.opt)]));
    if(hayG && parcial) out.push(P('La ganancia cuenta solo los productos que tienen costo anotado (' + gIt.length + ' de ' + items.length + ').'));
    if(!hayG) out.push(P('Sin el costo de ' + (unico ? 'este producto' : 'todos estos productos') + ' no puedo decirte si ganas más o menos, solo cómo cambiarían las ventas. Anótalo en Productos y repito la cuenta.'));
    else if(eq === Infinity) out.push(P('**Ojo:** con ese precio ' + (unico ? 'cada pieza' : 'las piezas') + ' quedarían por debajo de su costo: perderías dinero en cada venta, venda lo que venda.'));
    else if(sube) out.push(P('**Punto de equilibrio:** ganas lo mismo que hoy aunque pierdas **' + pct(1 - eq) + '** de las piezas; si pierdes menos, ganas más.'));
    else out.push(P('**Punto de equilibrio:** solo para ganar lo mismo que hoy necesitas vender **' + pct(eq - 1) + ' más** piezas (de ' + num(q0) + ' a ' + num(q0 * eq) + ' al mes).'));
    out.push(P('**Supuesto:** ' + (obs != null ? 'tu propio historial (' + (hist.diasLo + hist.diasHi) + ' días con ventas) sugiere que por cada 1% de precio las piezas cambian ' + (Math.round(obs * 10) / 10) + '%. ' : 'por cada 1% de precio, las piezas cambian ' + (Math.round(bas * 10) / 10) + '% (supuesto general; en el peor caso ' + (Math.round(ES.cons * 10) / 10) + '% y en el mejor ' + (Math.round(ES.opt * 10) / 10) + '%). ') + 'No considero que la gente cambie a otro producto ni que cambie la competencia.'));
    if(hist && obs == null) out.push(P('En tu historial cobraste ' + $d(hist.pLo) + ' y ' + $d(hist.pHi) + ' y se vendió parecido (' + (Math.round(hist.qLo * 10) / 10) + ' y ' + (Math.round(hist.qHi * 10) / 10) + ' piezas por día con venta), pero con eso solo no basta para concluir: por eso uso el supuesto general.'));
    out.push(conf(obs != null ? 'moderada' : 'hipotesis'));
    if(Math.abs(delta) > 0.3) out.push(P('**Cuidado:** es un cambio grande (más de 30%) y mis supuestos pierden precisión: la gente puede reaccionar muy distinto.'));
    // lo que yo haría
    if(hayG && eq !== Infinity){
      const ok = (s) => cambio(s) > 0, veredicto = ok(esc.cons) && ok(esc.prob) && ok(esc.opt) ? 'Sale a tu favor incluso en el peor caso razonable. Aun así, pruébalo poco tiempo y mídelo.'
        : (ok(esc.prob) ? 'Conviene probarlo con cuidado: gana si la gente reacciona poco y pierde si reacciona fuerte. Pruébalo 14 días y mide.'
        : (ok(esc.opt) ? 'Con lo más probable no ganas; solo funcionaría en el mejor caso. Yo no lo haría así.' : 'Con estos supuestos no te conviene. Yo no lo haría.'));
      out.push(P('**Lo que yo haría:** ' + veredicto));
    }
    if(nota) out.push(P(nota));
    if(c.mas){
      const filas = [-0.2, -0.1, -0.05, 0.05, 0.1, 0.15, 0.2].map((d) => { const s = proy(ES.prob, d); return [signo(d) + pct(d) + (unico ? ' (' + $d(unico.precioReal * (1 + d)) + ')' : ''), dif(cambio(s)) + (hayG ? ' de ganancia' : ' de ventas'), 'vendes ' + signo(s.f - 1) + pct(s.f - 1) + ' de piezas']; });
      out.push(L('Otros cambios de precio (caso probable)', filas), P('Son cambios pequeños. Fuera de ±20% el cálculo ya no es confiable.'));
    }
    // seguimiento de la conversación y «Voy a probarla»
    sim.ult = { tipo: 'precio', prods: e.todos ? [] : items.map((x) => ({ id: x.id, nombre: x.nombre })), todos: !!e.todos, dir: sube ? 'sube' : 'baja' };
    const puedeProbar = hayG && eq !== Infinity && cambio(esc.prob) > 0 && !e.todos && ofrecerPrueba(c.estado, {
      id: 'sim-p-' + hash(items.map((x) => x.id).join(',')) , titulo: (sube ? 'Subir ' : 'Bajar ') + nom(items) + (unico ? ' de ' + $d(unico.precioReal) + ' a ' + $d(unico.precioReal * (1 + delta)) : ' ' + pct(delta)), texto: 'Simulación de precio: ' + dif(cambio(esc.prob)) + ' al mes en el caso probable.',
      impacto: cambio(esc.prob) > 0 ? cambio(esc.prob) : null, cuenta: num(q0) + ' piezas al mes con el cambio de ' + signo(delta) + pct(delta) + ' en el precio y la reacción del caso probable', supuesto: 'la gente reacciona como en el caso probable',
      pasos: idePasos('Cambia el precio de ' + nom(items) + ' en PUVE y avísale a tu equipo.', 'Durante 14 días compara las piezas y la ganancia de ' + nom(items) + ' contra tus ' + num(q0 / 30 * 14) + ' piezas de un periodo igual.', 'Si las piezas bajan más de lo que ganas por pieza, regresa al precio anterior.'), primerPaso: 'Cambiar el precio de ' + nom(items),
      medicion: { k: 'unid', prods: items.map((x) => x.nombre), base: { u: q0 / 30, i: ing0 / 30, g: gan0 / 30 }, precio: true }, medir: 'Compara en 2 semanas las piezas, las ventas y la ganancia de ' + nom(items) + ' contra tus números de antes.' });
    const chips = []; if(puedeProbar) chips.push('Voy a probarla');
    if(unico){ const m = Math.round(Math.abs(delta) * 50); if(m >= 1) chips.push('¿Y si es ' + m + '%?'); const otro = Math.round(Math.abs(delta) * 200); if(otro <= 60) chips.push('¿Y si es ' + otro + '%?'); }
    chips.push('Dame más detalles');
    return out.concat([SEGUIR(...chips.slice(0, 4))]);
  }

  // ---------- 2) comprar mercancía ----------
  async function simCompra(e, an, c, sim){
    const x = hallar(an, e.productos[0]);
    if(!x) return [P('No encuentro ese producto en tu lista.')];
    if(!x.fisico) return [P('**' + x.nombre + '** no maneja existencia (es un platillo o servicio), así que no hay mercancía que comprar. Si quieres simular la compra de un insumo, dime cuál.')];
    let nums = e.nums.slice(), nuevo = null;
    const ma = e.t.match(/\b(?:a|cada uno a|c\/u)\s+(\d+(?:\.\d+)?)\b/);
    if(ma){ nuevo = parseFloat(ma[1]); const k = nums.indexOf(nuevo); if(k >= 0 && nums.length > 1) nums.splice(k, 1); else nuevo = null; }
    const cant = nums.length ? Math.round(nums[0]) : null;
    if(!cant || cant < 1 || cant > 1000000){
      preguntar(sim, e.raw, 'numero', e.productos);
      const mes = Math.max(5, Math.round(x.u30));
      return [P('¿Cuántas piezas de **' + x.nombre + '** pensabas comprar?' + (x.u30 > 0 ? ' Hoy vendes unas ' + num(x.u30) + ' al mes.' : '')), SEGUIR('¿Y si compro ' + Math.round(mes / 2) + ' de ' + x.nombre + '?', '¿Y si compro ' + mes + ' de ' + x.nombre + '?', '¿Y si compro ' + mes * 2 + ' de ' + x.nombre + '?')];
    }
    const costoBase = x.costo, costo = nuevo != null ? nuevo : (costoBase != null && e.pct != null && /\b(descuento|rebaja|mayoreo|me dan|me hacen)\b/.test(e.t) ? costoBase * (1 - e.pct / 100) : costoBase);
    const vel = x.u30 / 30, stock = Number(x.stock) || 0;
    const out = [P('Simulé **comprar ' + num(cant) + ' de ' + x.nombre + '**.')];
    out.push(P('**Hoy:** tienes ' + num(stock) + ' piezas' + (vel > 0 ? ' y vendes unas ' + (Math.round(vel * 10) / 10) + ' por día (' + num(x.u30) + ' al mes), así que alcanzan ' + dias(x.dias) + '.' : ' y en los últimos 30 días no vendiste ninguna.')));
    if(vel <= 0){ out.push(P('Como no se ha vendido, comprar más sería dinero parado' + (costo != null ? ': ' + $r(cant * costo) + ' en mercancía que no sabes cuándo se vende' : '') + '. No lo haría hasta que se mueva.')); sim.ult = { tipo: 'compra', prods: [{ id: x.id, nombre: x.nombre }] }; return out.concat([SEGUIR('¿Cuáles son mis productos más vendidos?')]); }
    const d = (v) => cant / (vel * v), total = (stock + cant) / vel;
    const filas = [['Después de comprar', num(stock + cant) + ' piezas', 'alcanzarían ' + dias(total)]];
    if(costo != null){ filas.push(['Inviertes', $r(cant * costo), num(cant) + ' × ' + $d(costo) + (nuevo != null ? ' (costo que me dijiste)' : (costo !== costoBase ? ' (con el descuento)' : ''))]); if(x.precioReal > 0) filas.push(['Ganancia al venderlas', $r(cant * (x.precioReal - costo)), $d(x.precioReal - costo) + ' por pieza']); }
    filas.push(['Para vender lo que compras', 'unos ' + Math.round(d(1)) + ' días', 'entre ' + Math.round(d(1.2)) + ' (si se vende más) y ' + Math.round(d(0.7)) + ' (si se vende menos)']);
    out.push(L('Lo que pasaría', filas));
    const dp = d(1), cap = costo != null ? cant * costo : null;
    if(cap != null && an.ing30 > 0) out.push(P('Ese dinero parado equivale a **' + pct(cap / an.ing30) + '** de lo que vendes en un mes.'));
    if(costoBase != null && costo != null && costo < costoBase) out.push(P('**Lo que ahorras con el descuento:** ' + $r(cant * (costoBase - costo)) + ' contra comprar al costo de hoy. Vale la pena solo si ese dinero parado ' + (dp > 60 ? 'no te hace falta durante **' + Math.round(dp) + ' días**, y es mucho tiempo' : 'no te hace falta durante unos ' + Math.round(dp) + ' días') + '.'));
    out.push(P('**Lo que yo haría:** ' + (dp <= 30 ? 'Pinta bien: lo venderías en menos de un mes.' : (dp <= 60 ? 'Es razonable, pero tendrás dinero parado cerca de ' + Math.round(dp) + ' días. Si te aprieta el flujo, compra la mitad.' : (dp <= 90 ? 'Es mucho tiempo con dinero parado (unos ' + Math.round(dp) + ' días). Yo compraría menos.' : 'No lo compraría de golpe: tardarías más de tres meses en venderlo (unos ' + Math.round(dp) + ' días).'))) + (x.dias != null && x.dias < 7 && stock <= 0 ? ' Además hoy estás agotado y estás perdiendo ventas.' : '')));
    if(x.costo == null && nuevo == null) out.push(P('No tiene costo anotado, así que no calculé dinero. Dime «a $12» o anótalo en Productos.'));
    out.push(conf(x.u30 >= 20 ? 'moderada' : 'hipotesis', x.u30 >= 20 ? '' : 'Vendes pocas piezas de este producto, así que el ritmo puede cambiar.'));
    out.push(P('**Supuesto:** el producto sigue vendiéndose al ritmo de los últimos 30 días. Si caduca o se echa a perder, no compres más de lo que vendes antes de que venza.'));
    sim.ult = { tipo: 'compra', prods: [{ id: x.id, nombre: x.nombre }] };
    return out.concat([SEGUIR('¿Y si compro ' + Math.max(1, Math.round(cant / 2)) + ' de ' + x.nombre + '?', 'Dame un plan para la semana')]);
  }

  // ---------- 3) quitar un producto ----------
  async function simQuitar(e, an, c, sim){
    const x = hallar(an, e.productos[0]);
    if(!x) return [P('No encuentro ese producto en tu lista.')];
    const ing = an.ing30, gT = suma(an.lista.filter((y) => y.costo != null), (y) => y.margen30), hayG = x.costo != null;
    const comp = an.pares.filter((p) => p.a === x.nombre || p.b === x.nombre).slice(0, 2).map((p) => ({ con: p.a === x.nombre ? p.b : p.a, n: p.n }));
    const out = [P('Simulé **quitar ' + x.nombre + '**.')];
    if(x.u30 === 0){ out.push(P('En los últimos 30 días no se vendió ninguna pieza: quitarlo no te cuesta ventas.' + (x.capital ? ' Además liberarías unos ' + $r(x.capital) + ' de mercancía parada (si la puedes regresar o venderla).' : ''))); sim.ult = { tipo: 'quitar', prods: [{ id: x.id, nombre: x.nombre }] }; return out.concat([SEGUIR('¿Cuáles son mis productos más lentos?')]); }
    out.push(P('**Hoy:** vendes ' + num(x.u30) + ' piezas al mes y deja ' + $r(x.ing30) + ' en ventas (' + pctS(ing > 0 ? x.ing30 / ing : 0) + ' del total)' + (hayG ? ' y ' + $r(x.margen30) + ' de ganancia' + (gT > 0 ? ' (' + pctS(x.margen30 / gT) + ' de tu ganancia)' : '') : '') + '.'));
    const gente = { cons: 0, prob: 0.2, opt: 0.4 };   // qué parte de quienes lo compraban se pasaría a otro producto
    const mgp = ratioMargen(an), fila = (rot, k) => { const rec = gente[k], v = x.ing30 * (1 - rec); return [rot, '−' + $r(v) + ' de ventas al mes', hayG ? (mgp != null ? '−' + $r(Math.max(0, x.margen30 - x.ing30 * rec * mgp)) + ' de ganancia' : '−' + $r(x.margen30) + ' de ganancia') + (rec ? ' · ' + pct(rec) + ' se pasa a otro producto' : ' · nadie lo sustituye') : (rec ? pct(rec) + ' se pasa a otro producto' : 'nadie lo sustituye')]; };
    out.push(L('Lo que podría pasar en un mes', [fila('Peor caso razonable', 'cons'), fila('Lo más probable', 'prob'), fila('Mejor caso', 'opt')]));
    if(comp.length) out.push(P('**Ojo:** se compra junto con ' + lista(comp.map((y) => '**' + y.con + '** (' + veces(y.n, 'vez', 'veces') + ' este mes)')) + '. Si lo quitas, esas compras podrían perderse también y no las conté arriba.'));
    if(x.capital) out.push(P('Liberarías unos ' + $r(x.capital) + ' de mercancía en existencia, si la puedes regresar o vender.'));
    const peso = ing > 0 ? x.ing30 / ing : 0;
    out.push(P('**Lo que yo haría:** ' + (peso < 0.02 && (!hayG || gT <= 0 || x.margen30 / gT < 0.02) && !comp.length ? 'Casi no pesa en tu negocio: quitarlo cuesta poco. Si además te estorba o caduca, es buena idea.' : (peso >= 0.1 ? 'Pesa bastante (' + pct(peso) + ' de tus ventas). No lo quitaría; si el problema es que deja poco, mejor revisa su precio.' : 'Pesa poco pero no nada. Antes de quitarlo, pruébalo sin empujarlo unas semanas y mira si lo extrañan' + (comp.length ? ', sobre todo por lo que se compra con él.' : '.')))));
    out.push(conf('moderada', 'Lo que se pasaría a otro producto es una hipótesis (20% y 40% son supuestos generales).'));
    sim.ult = { tipo: 'quitar', prods: [{ id: x.id, nombre: x.nombre }] };
    return out.concat([SEGUIR('¿Cuáles son mis productos más lentos?', '¿Qué producto me deja más?')]);
  }

  // ---------- 4) contratar a alguien ----------
  async function simContratar(e, an, c, sim){
    let costo = e.nums.find((n) => n >= 100) || null;
    if(costo){ if(/\b(diario|al dia|por dia|por jornada|diarios)\b/.test(e.t)) costo *= 30; else if(/\b(semana|semanal|semanales|a la semana)\b/.test(e.t)) costo *= 4.3; }
    if(!costo){ preguntar(sim, e.raw, 'numero'); return [P('¿Cuánto le pagarías al mes, con todo y prestaciones? Escribe solo la cifra, por ejemplo «8 mil».'), SEGUIR('¿Y si contrato a alguien de 6 mil al mes?', '¿Y si contrato a alguien de 8 mil al mes?', '¿Y si contrato a alguien de 10 mil al mes?')]; }
    const mg = ratioMargen(an), a = (await D.cargarPeriodo(N.ultimos(30), false)).act, dd = Math.max(1, (await D.diario(30)).length);
    const out = [P('Simulé **contratar a alguien por ' + $r(costo) + ' al mes**.')];
    if(mg == null || mg <= 0) return out.concat([P('Para decirte cuánto tendrías que vender para pagarlo necesito saber cuánto de cada venta te queda, y me faltan costos en tus productos. Anótalos en Productos y repito la cuenta.'), SEGUIR('¿Qué productos no tienen costo?')]);
    const necesita = costo / mg, extraDia = necesita / dd, tickets = a.ticket > 0 ? extraDia / a.ticket : null, pctV = an.ing30 > 0 ? necesita / an.ing30 : null;
    const gastos = await D.traerGastos(new Date(Date.now() - 30 * 86400000), new Date()), gt = gastos ? suma(gastos, (g) => Number(g.monto)) : null, gan = suma(an.lista.filter((x) => x.costo != null), (x) => x.margen30);
    out.push(P('**Hoy:** vendes ' + $r(an.ing30) + ' al mes y de cada $100 te quedan unos $' + Math.round(mg * 100) + ' antes de gastos.'));
    const filas = [['Ventas extra para pagarlo', $r(necesita) + ' al mes', 'costo ÷ ' + pct(mg) + ' que te queda de cada venta'], ['Por día', $r(extraDia), tickets != null ? 'unas ' + Math.max(1, Math.round(tickets)) + ' ventas más por día (ticket de ' + $d(a.ticket) + ')' : '']];
    if(pctV != null) filas.push(['Contra lo que vendes hoy', '+' + pct(pctV), 'tendrías que vender ' + pct(pctV) + ' más que ahora solo para empatar']);
    if(gt != null && gt > 0 && an.ing30 > 0 && suma(an.lista.filter((x) => x.costo != null && x.ing30 > 0), (x) => x.ing30) / an.ing30 >= 0.6) filas.push(['Si no vendes más', 'te quedarían ' + $r(gan - gt - costo) + ' al mes', 'hoy te quedan ' + $r(gan - gt) + ' después de gastos anotados']);
    out.push(L('La cuenta', filas));
    const q = pctV == null ? null : (pctV <= 0.05 ? 'alcanzable' : (pctV <= 0.15 ? 'exigente pero posible' : 'difícil de cubrir solo con tus ventas de hoy'));
    if(q) out.push(P('**Lo que yo haría:** pagarlo exige vender ' + pct(pctV) + ' más: parece **' + q + '**. Solo vale la pena si hoy **pierdes ventas por falta de manos** (filas largas, gente que se va, pedidos que no alcanzas a surtir). Si no, el sueldo sale de tu ganancia.'));
    out.push(P('**Lo que no veo:** si la persona también ahorra tu tiempo, baja errores o te deja abrir más horas, eso vale aunque no se vea en ventas.'));
    out.push(conf('cuenta'));
    sim.ult = { tipo: 'contratar' };
    return out.concat([SEGUIR('¿Y si abro una hora más?', 'Dame un plan para la semana')]);
  }

  // ---------- 5) abrir más horas o un día nuevo ----------
  const horaTxt = (h) => { const x = ((h % 24) + 24) % 24; return (x % 12 || 12) + (x < 12 ? ' a. m.' : ' p. m.'); };
  async function simHorario(e, an, c, sim){
    const pd = await D.cargarPeriodo(N.ultimos(30), false), a = pd.act, diario = await D.diario(30), da = Math.max(1, diario.length), mg = ratioMargen(an);
    const nMin = Math.max(3, Math.round(a.n * 0.02)), abiertas = []; for(let h = 0; h < 24; h++) if(a.nHora[h] >= nMin) abiertas.push(h);
    if(!abiertas.length) return POCAS(a.n);
    const primera = abiertas[0], ultima = abiertas[abiertas.length - 1], dm = DIAS.find((d) => new RegExp('\\b' + d[0] + 's?\\b').test(e.t));
    const nd = [0, 0, 0, 0, 0, 0, 0]; diario.forEach((d) => { nd[new Date(d.fecha + 'T00:00:00').getDay()]++; });
    const out = [], gan = (v) => mg != null ? 'unos ' + $r(v * mg) + ' de ganancia antes de gastos' : 'sin costos no calculo la ganancia';
    if(dm && !/\bhora/.test(e.t)){
      const prom = (d) => nd[d] ? a.porDia[d] / nd[d] : null, abiertos = DIAS.map((x) => x[1]).filter((d) => nd[d] > 0), flojo = abiertos.length ? Math.min(...abiertos.map(prom)) : null;
      const plural = { domingo: 'los domingos', lunes: 'los lunes', martes: 'los martes', miercoles: 'los miércoles', jueves: 'los jueves', viernes: 'los viernes', sabado: 'los sábados' }[dm[0]];
      out.push(P('Simulé **abrir ' + plural + '**.'));
      if(nd[dm[1]]) return out.concat([P('**Hoy:** ese día ya lo abres y vendes unos ' + $r(prom(dm[1])) + ' en promedio. Si quieres ampliar su horario, dime cuántas horas, por ejemplo «¿y si abro 2 horas más?».'), SEGUIR('¿Y si abro 2 horas más?')]);
      if(flojo == null) return POCAS(a.n);
      const veces4 = 4.3, F = { cons: 0.4, prob: 0.6, opt: 0.8 };
      out.push(P('**Hoy:** ese día no registras ventas. Tu día más flojo de los que abres vende unos **' + $r(flojo) + '**.'));
      out.push(L('Lo que podría sumar en un mes', [['Peor caso razonable', 'cons'], ['Lo más probable', 'prob'], ['Mejor caso', 'opt']].map(([rot, k]) => [rot, '+' + $r(flojo * F[k] * veces4) + ' de ventas al mes', gan(flojo * F[k] * veces4)])));
      out.push(P('**Supuesto:** un día nuevo vende entre 40% y 80% de lo que vende tu día más flojo (60% lo más probable) y lo abres ' + veces4 + ' veces al mes. No hay datos de ese día, por eso es una hipótesis.'));
      out.push(P('**Lo que yo haría:** pruébalo un par de semanas con poco gasto extra y compara. Solo conviene si lo que ganas ese día es más que lo que te cuesta abrirlo (sueldo extra, luz) y que lo que dejarías de descansar.'));
      out.push(conf('hipotesis')); sim.ult = { tipo: 'horario' };
      return out.concat([SEGUIR('¿Y si contrato a alguien de 8 mil al mes?', 'Dame un plan para la semana')]);
    }
    const hm = e.t.match(/(\d+(?:\.\d+)?)\s*horas?\b/), k = hm ? Math.max(1, Math.min(6, Math.round(parseFloat(hm[1])))) : 1, temprano = /\b(temprano|antes|madrugada|mas temprano)\b/.test(e.t);
    const ancla = temprano ? a.porHora[primera] : a.porHora[ultima], porDia = ancla / da, F = { cons: 0.3, prob: 0.55, opt: 0.8 };
    const hs = []; for(let j = 0; j < k; j++) hs.push(temprano ? primera - 1 - j : ultima + 1 + j);
    let sumaH = 0; for(let j = 0; j < k; j++) sumaH += Math.pow(0.8, j);
    const suma8 = (f) => porDia * f * sumaH;
    const mes = (f) => suma8(f) * da;
    out.push(P('Simulé **abrir ' + veces(k, 'hora', 'horas') + ' más ' + (temprano ? 'temprano' : 'tarde') + '** (' + (temprano ? 'desde las ' + horaTxt(hs[hs.length - 1]) : 'hasta las ' + horaTxt(hs[hs.length - 1] + 1)) + ').'));
    out.push(P('**Hoy:** abres de ' + horaTxt(primera) + ' a ' + horaTxt(ultima + 1) + ' y tu ' + (temprano ? 'primera' : 'última') + ' hora (' + horaTxt(temprano ? primera : ultima) + ') vende unos **' + $r(porDia) + '** por día abierto.'));
    out.push(L('Lo que podría sumar en un mes', [['Peor caso razonable', 'cons'], ['Lo más probable', 'prob'], ['Mejor caso', 'opt']].map(([rot, kk]) => [rot, '+' + $r(mes(F[kk])) + ' de ventas al mes', (mg != null ? 'unos ' + $r(mes(F[kk]) * mg) + ' de ganancia antes de gastos · ' : '') + 'unos ' + $r(suma8(F[kk])) + ' por día'])));
    const gd = mg != null ? suma8(F.prob) * mg : null;
    out.push(P('**Supuesto:** la hora que sumas vende entre 30% y 80% de lo que vende hoy tu ' + (temprano ? 'primera' : 'última') + ' hora (55% lo más probable)' + (k > 1 ? ' y cada hora siguiente 20% menos' : '') + ', y lo haces los ' + da + ' días que abriste este mes. No hay ventas de esas horas, por eso es una hipótesis.'));
    out.push(P('**Lo que yo haría:** ' + (gd != null ? 'esa hora te deja unos ' + $r(gd) + ' de ganancia por día antes de gastos. Si abrirla te cuesta más que eso (sueldo, luz, gas), **no conviene**; si te cuesta menos, pruébala 2 semanas y mide las ventas de esa hora.' : 'anota los costos de tus productos para que te diga cuánta ganancia deja esa hora. Mientras tanto, pruébala 2 semanas y mide sus ventas contra lo que te cuesta mantenerla abierta.')));
    out.push(conf('hipotesis'));
    sim.ult = { tipo: 'horario' };
    return out.concat([SEGUIR(temprano ? '¿Y si abro 2 horas más temprano?' : '¿Y si abro 2 horas más?', '¿Y si abro los domingos?', '¿Y si contrato a alguien de 8 mil al mes?')]);
  }

  // ---------- 6) combo ----------
  async function simCombo(e, an, c, sim){
    let A, B;
    const ps = e.productos.map((p) => hallar(an, p)).filter(Boolean);
    if(ps.length >= 2){ A = ps[0]; B = ps[1]; }
    else if(an.pares[0]){ A = an.lista.find((x) => x.nombre === an.pares[0].a); B = an.lista.find((x) => x.nombre === an.pares[0].b); }
    if(!A || !B){ preguntar(sim, e.raw, 'producto'); return [P('¿De qué dos productos sería el combo? Por ejemplo: «¿y si hago un combo de ' + (an.lista.filter((x) => x.u30 > 0)[0] || { nombre: 'tacos' }).nombre + ' y ' + (an.lista.filter((x) => x.u30 > 0)[1] || { nombre: 'refresco' }).nombre + '?»')]; }
    const d = (e.pct != null ? e.pct : 8) / 100, par = an.pares.find((p) => (p.a === A.nombre && p.b === B.nombre) || (p.a === B.nombre && p.b === A.nombre)), n = par ? par.n : 0;
    const sep = A.precioReal + B.precioReal, pc = sep * (1 - d), hayG = A.costo != null && B.costo != null;
    const out = [P('Simulé **combo ' + A.nombre + ' + ' + B.nombre + '** a ' + $r(pc) + ' (' + pct(d) + ' menos que los ' + $r(sep) + ' por separado).')];
    out.push(P('**Hoy:** este mes se compraron juntos ' + (n ? veces(n, 'vez', 'veces') : 'pocas veces (menos de 3)') + '; ' + A.nombre + ' vende ' + num(A.u30) + ' piezas y ' + B.nombre + ' ' + num(B.u30) + '.'));
    if(!hayG) return out.concat([P('Sin el costo de los dos productos no puedo decirte si el descuento se compensa. Anótalos en Productos y repito la cuenta.'), SEGUIR('¿Qué productos no tienen costo?')]);
    const mSep = (A.precioReal - A.costo) + (B.precioReal - B.costo), mC = pc - A.costo - B.costo, regala = sep * d;
    if(mC <= 0) return out.concat([P('**Ojo:** a ese precio el combo te deja ' + $d(mC) + ' por combo, o sea que vendes por debajo del costo. Con ese descuento no conviene.'), SEGUIR('Dame otra idea')]);
    const base = Math.max(n, 0), extraBase = Math.max(n, Math.round(0.1 * Math.min(A.u30, B.u30))), F = { cons: 0, prob: 0.25, opt: 0.6 };
    const g = (k) => -base * regala + Math.round(extraBase * F[k]) * mC;
    out.push(L('Lo que podría pasar en un mes', [['Peor caso razonable', 'cons', 'solo los que ya los compran juntos pasan al combo y nadie nuevo llega'], ['Lo más probable', 'prob', 'llegan combos nuevos equivalentes al 25% de los actuales'], ['Mejor caso', 'opt', 'llegan combos nuevos equivalentes al 60%']].map(([rot, k, det]) => [rot, dif(g(k)) + ' de ganancia al mes', det])));
    const eqN = mC > 0 ? base * regala / mC : null;
    out.push(P('**Punto de equilibrio:** cada combo que ya se compraba junto te cuesta ' + $d(regala) + ' de descuento y cada combo nuevo te deja ' + $d(mC) + '. ' + (eqN != null && base > 0 ? 'Necesitas **' + Math.ceil(eqN) + ' combos nuevos al mes** para empatar.' : 'Como casi no se compran juntos, casi todo lo que venda el combo sería ganancia nueva.')));
    out.push(P('**Supuesto:** los combos nuevos son ventas que no habrías hecho sin el combo; es una hipótesis.'));
    out.push(conf('hipotesis'));
    out.push(P('**Lo que yo haría:** ' + (g('prob') > 0 ? 'Pinta bien si lo ofreces al cobrar. Pruébalo 2 semanas y cuenta cuántos combos nuevos salen.' : 'Con lo más probable no ganas. Prueba un descuento menor o junta productos que ya se compren más juntos.')));
    sim.ult = { tipo: 'combo', prods: [{ id: A.id, nombre: A.nombre }, { id: B.id, nombre: B.nombre }] };
    const puede = g('prob') > 0 && ofrecerPrueba(c.estado, { id: 'sim-c-' + hash(A.id + '|' + B.id), titulo: 'Combo ' + A.nombre + ' + ' + B.nombre + ' a ' + $r(pc), texto: 'Simulación de combo.', impacto: g('prob'), cuenta: 'combos nuevos al ritmo del caso probable', supuesto: 'llegan combos nuevos', pasos: idePasos('Crea el combo en Inventario → Combos a ' + $r(pc) + '.', 'Cuenta cuántos combos nuevos se venden en 2 semanas.', 'Si no compensan el descuento, quítalo.'), primerPaso: 'Crear el combo', medicion: { k: 'unid', prods: [A.nombre, B.nombre], base: { u: (A.u30 + B.u30) / 30, i: (A.ing30 + B.ing30) / 30, g: (A.margen30 + B.margen30) / 30 }, precio: true }, medir: 'Compara en 2 semanas las piezas, ventas y ganancia de los dos productos contra tus números de antes.' });
    return out.concat([SEGUIR(...(puede ? ['Voy a probarla'] : []), 'Dame otra idea')]);
  }

  // ---------- el tema ----------
  const GUIA = async () => {
    let an = null; try { an = await D.analisis(); } catch(e){ an = null; }
    const v = an ? an.lista.filter((x) => x.u30 > 0).sort((a, b) => b.ing30 - a.ing30) : [], lentos = an ? an.lista.filter((x) => x.u30 > 0).sort((a, b) => a.u30 - b.u30) : [];
    const fis = v.find((x) => x.fisico), chips = [];
    if(v[0]) chips.push('¿Y si subo 10% el precio de ' + v[0].nombre + '?');
    if(fis) chips.push('¿Y si compro ' + Math.max(10, Math.round(fis.u30)) + ' de ' + fis.nombre + '?');
    if(v[1] || v[0]) chips.push('¿Y si hago 2×1 en ' + (v[1] || v[0]).nombre + '?');
    if(lentos[0]) chips.push('¿Y si quito ' + lentos[0].nombre + '?');
    chips.push('¿Y si abro una hora más?', '¿Y si contrato a alguien de 8 mil al mes?');
    return [P('Puedo simular un cambio **antes** de que lo hagas, con tus propios números: te doy un caso malo, uno probable y uno bueno, el punto de equilibrio y qué tan confiable es la cuenta. Pregúntame cosas como:'), SEGUIR(...chips.slice(0, 6)), P('No cambio nada en tu negocio: solo hago cuentas. Y si me falta un dato (cuánto pagarías, cuántas piezas), te lo pregunto.')];
  };
  H.simular = async (c) => {
    if(!puedeCostos()) return [P('Las simulaciones se apoyan en tus costos y tu ganancia, y esos los ve solo el encargado del negocio.')];
    const est = c.estado || {}, sim = est.sim || (est.sim = {}), txt = sim.texto || c.texto; sim.texto = null;
    const e = sim.e || entender(txt, c.productos || [], sim, est); sim.e = null;
    if(!e) return GUIA();
    let an; try { an = await D.analisis(); } catch(err){ return [P('No pude leer tus ventas ahora (' + String((err && err.message) || err).slice(0, 80) + '). Intenta de nuevo en un momento.')]; }
    if(an.ventas30 < MIN_VENTAS) return POCAS(an.ventas30);
    if(e.falta === 'producto' || (['precio', 'quitar', 'compra'].includes(e.tipo) && !e.productos.length && !e.todos)){
      preguntar(sim, e.raw, 'producto');
      const top = an.lista.filter((x) => x.u30 >= MIN_U).sort((a, b) => b.ing30 - a.ing30).slice(0, 3);
      return [P('¿De qué producto? Dime el nombre y hago la cuenta.'), top.length ? SEGUIR(...top.map((x) => x.nombre)) : null].filter(Boolean);
    }
    try { return await ({ precio: simPrecio, compra: simCompra, quitar: simQuitar, contratar: simContratar, horario: simHorario, combo: simCombo }[e.tipo])(e, an, c, sim); }
    catch(err){ return [P('No pude hacer esa cuenta ahora (' + String((err && err.message) || err).slice(0, 80) + '). Intenta de nuevo en un momento.')]; }
  };

  // ---------- se engancha al chat ----------
  N.SOLO_ENCARGADO.add('simular');
  R.registrarTemas(H, { simular: 'Simular un cambio (¿y si…?)' }, { simular: 'Haciendo las cuentas…' });
  R.agregarPre((original, estado, pr) => {
    const sim = estado.sim || (estado.sim = {}), pend = sim.pend; sim.pend = null;   // lo preguntado se usa una sola vez
    if(pend && Date.now() - pend.t < PEND_MS && limpio(original).trim().split(' ').length <= 12){
      const lx = leer(original), ok = pend.falta === 'producto' ? pr.productos.length > 0 : lx.nums.length > 0 || (lx.pct != null);
      if(ok){ sim.texto = pend.texto + ' ' + original; sim.e = null; return { intent: 'simular', productos: pr.productos.length ? pr.productos : pend.productos }; }
    }
    const e = entender(original, pr.productos, sim, estado);
    if(!e) return null;
    sim.texto = original; sim.e = e;
    return { intent: 'simular', productos: e.productos };
  });
  window.PuveIaSimulador = { leer, entender, internos: { historiaPrecio, ratioMargen, limpio } };
})();
