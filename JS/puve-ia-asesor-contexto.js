/* PUVE IA · Entiende la conversación (Etapa 4; motor propio, SIN IA externa)
 * Recuerda de qué productos habló la respuesta anterior y entiende referencias como la gente las dice:
 *   «¿y el segundo?», «¿y el último?», «¿y el otro?», «¿cuánto me deja ese?», «de esa, ¿cuánto queda?»  → detalle de ESE producto
 *   «compara el pastor con la quesadilla», «¿cuál vende más, A o B?», «compara el primero con el segundo»   → comparación de dos productos
 *   «top 3», «¿y los 5 primeros?», «los 8 más vendidos»                                                    → el mismo ranking con esa cantidad
 * La memoria vive solo en la conversación abierta (no se guarda en ningún lado). Si no está seguro de a qué te refieres, no adivina: sigue como antes.
 */
(function(){
  'use strict';
  const R = window.PuveResumen;
  if(!R || !R.internos || !R.agregarPre || !R.agregarPost) return;
  const I = R.internos, { D, N, P, L, C, sug, fmt, $d, $r, dias, en, puedeCostos } = I;
  const H = {};
  const MAX_REF = 10;
  const ORDINAL = { primer: 0, segund: 1, tercer: 2, cuart: 3, quint: 4, sext: 5, septim: 6, octav: 7, noven: 8, decim: 9 };
  const NUMERO = { un: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, doce: 12 };
  const nombresDe = () => (I.enlace().productos() || []);
  const norm = (s) => N.norm(s);
  const pct = (n) => Math.round(Math.abs(n) * 100) + '%';

  // ---------- recordar qué productos salieron en la última respuesta (en orden) ----------
  function productosDe(bloques, ctx){
    const mapa = new Map(nombresDe().map((p) => [norm(p.nombre), p])), vistos = [];
    const meter = (txt) => { const p = mapa.get(norm(txt)); if(p && !vistos.includes(p)) vistos.push(p); };
    (bloques || []).forEach((b) => {
      if(b.t === 'lista') b.filas.forEach((f) => meter(f[0]));
      else if(b.t === 'pasos') b.items.forEach((i) => meter(String(i[0]).replace(/^(pide|no compres más|compra|sube|baja)\s+/i, '')));
    });
    if(!vistos.length && ctx && ctx.productos && ctx.productos.length) ctx.productos.forEach((p) => { if(!vistos.includes(p)) vistos.push(p); });
    return vistos.slice(0, MAX_REF);
  }
  const SIN_CAMBIO = ['saludo', 'como_estas', 'identidad', 'capacidades', 'gracias', 'despedida', 'animo', 'motivacion', 'chiste', 'queja', 'afirmar', 'negar', 'repetir', 'mas_detalle', 'como_aprendes', 'fuera_tema', 'hora_fecha', 'calculo', 'cambio'];
  R.agregarPost((intent, ctx, bloques) => {
    const e = ctx.estado; if(!e) return;
    const ps = productosDe(bloques, ctx);
    // si se preguntó por UN producto de la lista anterior, la lista se conserva (para «y el último», «y el otro») y solo cambia el producto en foco
    if(intent === 'producto' && ps.length === 1 && e.ref && e.ref.lista.indexOf(ps[0]) >= 0){ e.ref.foco = ps[0]; return; }
    if(ps.length) e.ref = { lista: ps, foco: ctx.productos && ctx.productos.length === 1 ? ctx.productos[0] : (ps.length === 1 ? ps[0] : null), intent };
    else if(!SIN_CAMBIO.includes(intent)) e.ref = null;
  });

  // ---------- entender la referencia antes de clasificar ----------
  function porOrdinal(n, ref){
    const NO = '(?!\\s+(?:paso|dia|dias|mes|meses|semana|semanas|ano|vez|lugar|nivel|cliente|clientes|cajero|hora|trimestre|turno|pago|ticket|venta|ventas|mes))';
    const m = n.match(new RegExp('\\b(?:el|la|lo|del|al|los|las)\\s+(primer[oa]?|segund[oa]?|tercer[oa]?|cuart[oa]?|quint[oa]?|sext[oa]?|septim[oa]?|octav[oa]?|noven[oa]?|decim[oa]?|ultim[oa]?|anterior|siguiente|otr[oa])\\b' + NO)) || n.match(new RegExp('^y\\s+(primer[oa]?|segund[oa]?|tercer[oa]?|cuart[oa]?|quint[oa]?|ultim[oa]?|otr[oa])\\b' + NO));
    if(!m) return null;
    const w = m[1], l = ref.lista, f = ref.foco ? l.indexOf(ref.foco) : -1;
    let i = null;
    if(/^ultim/.test(w)) i = l.length - 1;
    else if(/^otr/.test(w)) i = f >= 0 ? (f + 1 < l.length ? f + 1 : null) : (l.length > 1 ? 1 : null);
    else if(w === 'anterior') i = f > 0 ? f - 1 : null;
    else if(w === 'siguiente') i = f >= 0 && f + 1 < l.length ? f + 1 : (f < 0 && l.length > 1 ? 1 : null);
    else { const k = Object.keys(ORDINAL).find((o) => w.indexOf(o) === 0); i = k ? ORDINAL[k] : null; }
    return i != null && i >= 0 && i < l.length ? l[i] : null;
  }
  // los productos en el orden en que la persona los nombró («compara refresco con tacos» → primero refresco)
  const enOrdenDeMencion = (ps, n) => ps.map((p) => ({ p, i: Math.min(...norm(p.nombre).split(' ').filter((w) => w.length >= 3).map((w) => { const k = n.indexOf(w.slice(0, 4)); return k < 0 ? 1e6 : k; }).concat([1e6])) })).sort((x, y) => x.i - y.i).map((x) => x.p);
  const pideDetalle = (n) => /(deja|ganan|ganancia|margen|utilidad|queda|quedan|stock|existencia|alcanza|vend|cuesta|precio|cobro|como va|como me va|tendencia|sube|baja)/.test(n);
  R.agregarPre((original, estado, pr, t) => {
    const n = norm(original), pal = n.split(' ').filter(Boolean), ref = estado && estado.ref;

    // 1) comparar dos productos: por nombre, o por posición en la lista anterior
    const quiereComparar = /\b(compara\w*|versus|vs|contra|cual (?:de los dos|de ellos|vende|se vende|deja|gana|conviene|es mejor)\w*|que (?:vende|se vende|deja) mas)\b/.test(n) || /\bcual\b.*\bo\b/.test(n);
    if(quiereComparar){
      if(pr.productos.length >= 2) return { intent: 'comparar_productos', productos: enOrdenDeMencion(pr.productos, n).slice(0, 2) };
      if(ref && ref.lista.length >= 2){
        const ords = [...n.matchAll(/\b(primer[oa]?|segund[oa]?|tercer[oa]?|cuart[oa]?|quint[oa]?|ultim[oa]?)\b/g)].map((m) => m[1]);
        const idx = ords.map((w) => /^ultim/.test(w) ? ref.lista.length - 1 : ORDINAL[Object.keys(ORDINAL).find((o) => w.indexOf(o) === 0)]).filter((i, k, a) => i != null && i < ref.lista.length && a.indexOf(i) === k);
        if(idx.length >= 2) return { intent: 'comparar_productos', productos: [ref.lista[idx[0]], ref.lista[idx[1]]] };
        if(/\b(los dos|los 2|ambos|los primeros|los dos primeros)\b/.test(n)) return { intent: 'comparar_productos', productos: ref.lista.slice(0, 2) };
        if(idx.length === 1 && ref.foco && ref.lista[idx[0]] !== ref.foco) return { intent: 'comparar_productos', productos: [ref.foco, ref.lista[idx[0]]] };
      }
    }

    // 2) top N: «top 3», «los 5 primeros», «los 8 más vendidos»
    const mt = n.match(/\b(?:top|los|las)\s+(\d+|un|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|doce)\b(?:\s+(primeros|primeras|mejores|peores|mas vendidos|menos vendidos|productos|que mas|que menos))?/);
    if(mt && (/\btop\b/.test(n) || mt[2]) && !pr.productos.length){
      const num = /^\d+$/.test(mt[1]) ? parseInt(mt[1], 10) : NUMERO[mt[1]];
      const peor = /(peores|menos vendidos|que menos|menos se vend|lentos)/.test(n);
      if(num >= 1 && num <= 12 && !/(cliente|cajero|empleado|dia|hora)/.test(n)) return { intent: peor ? 'lentos' : 'top', n: num };
    }

    // 3) un producto de la lista anterior: «¿y el segundo?», «¿y el último?», «¿y el otro?»
    if(ref && ref.lista.length && pal.length <= 9 && !pr.productos.length && !/que hago|por donde empiezo/.test(n)){
      const p = porOrdinal(n, ref);
      if(p) return { intent: 'producto', productos: [p] };
      // 4) «ese», «esa», «el mismo»: el producto del que se venía hablando
      if(/\b(ese|esa|el mismo|la misma|dicho)\b/.test(n) && pideDetalle(n)){
        const foco = ref.foco || ref.lista[0];
        if(foco) return { intent: /(cuesta|precio|cobro)/.test(n) ? 'precio_producto' : 'producto', productos: [foco] };
      }
    }
    return null;
  });

  // ---------- comparar dos productos ----------
  H.comparar_productos = async (c) => {
    const ps = (c.productos || []).slice(0, 2);
    if(ps.length < 2) return [P('¿Qué dos productos quieres comparar? Dime los nombres, por ejemplo: «compara el pastor con la quesadilla».')];
    const t = c.t && c.t.explicito ? c.t : N.ultimos(30), pd = await D.periodoCompleto(t), a = pd.act, b = pd.ant;
    const vista = (p) => { const x = a.productos[p.nombre] || { cant: 0, monto: 0, margen: 0 }, y = (b.productos || {})[p.nombre] || { cant: 0, monto: 0, margen: 0 }; return { p, cant: x.cant, monto: x.monto, margen: x.margen, antes: y.cant, porPieza: x.cant ? x.margen / x.cant : null, precio: x.cant ? x.monto / x.cant : Number(p.precio) || 0 }; };
    const [A, B] = ps.map(vista), costos = puedeCostos() && a.margen != null && (A.margen || B.margen);
    const fisico = (v) => D.esFisico(v.p), dur = (v) => { const vd = v.cant / Math.max(1, t.dias); return !fisico(v) ? null : (Number(v.p.stock) <= 0 ? 0 : (vd > 0 ? Number(v.p.stock) / vd : Infinity)); };
    const etiqueta = t.etiqueta || 'los últimos 30 días';
    if(!A.cant && !B.cant) return [P('Ni **' + A.p.nombre + '** ni **' + B.p.nombre + '** se vendieron ' + (t.explicito ? en(t) : 'en los últimos 30 días') + ', así que no hay con qué compararlos todavía.')];
    const filas = [], gana = (x, y, f) => x === y ? null : (x > y ? [A, B, f(A, B)] : [B, A, f(B, A)]);
    const g1 = gana(A.cant, B.cant, (w, l) => l.cant ? '+' + pct(w.cant / l.cant - 1) : 'el otro no vendió');
    filas.push(['Piezas vendidas', g1 ? g1[0].p.nombre : 'Empate', fmt(A.cant) + ' contra ' + fmt(B.cant) + (g1 ? ' (' + g1[2] + ')' : '')]);
    const g2 = gana(A.monto, B.monto, (w, l) => l.monto ? '+' + pct(w.monto / l.monto - 1) : '');
    filas.push(['Dinero que dejó en ventas', g2 ? g2[0].p.nombre : 'Empate', $r(A.monto) + ' contra ' + $r(B.monto)]);
    let g3 = null, g4 = null;
    if(costos){
      g3 = gana(A.margen, B.margen, () => ''); filas.push(['Ganancia total', g3 ? g3[0].p.nombre : 'Empate', $r(A.margen) + ' contra ' + $r(B.margen)]);
      if(A.porPieza != null && B.porPieza != null){ g4 = gana(A.porPieza, B.porPieza, () => ''); filas.push(['Ganancia por pieza', g4 ? g4[0].p.nombre : 'Empate', $d(A.porPieza) + ' contra ' + $d(B.porPieza)]); }
    }
    const tA = A.antes ? A.cant / A.antes - 1 : null, tB = B.antes ? B.cant / B.antes - 1 : null;
    if(tA != null || tB != null) filas.push(['Contra el periodo anterior', '', A.p.nombre + ': ' + (tA == null ? 'antes no se vendía' : (tA >= 0 ? '+' : '−') + pct(tA)) + ' · ' + B.p.nombre + ': ' + (tB == null ? 'antes no se vendía' : (tB >= 0 ? '+' : '−') + pct(tB))]);
    const dA = dur(A), dB = dur(B); if(dA != null || dB != null){ const txt = (d) => d == null ? 'no aplica' : (d === 0 ? 'agotado' : (d === Infinity ? 'sin ventas' : 'alcanza ' + dias(d))); filas.push(['Existencia', '', A.p.nombre + ': ' + txt(dA) + ' · ' + B.p.nombre + ': ' + txt(dB)]); }
    const out = [P('Comparé **' + A.p.nombre + '** contra **' + B.p.nombre + '** ' + (t.explicito ? en(t) : 'en los últimos 30 días') + ':'), L('Comparación', filas)];
    // conclusión en palabras claras
    const frases = [];
    if(g1) frases.push('**' + g1[0].p.nombre + '** se vende más' + (g1[1].cant ? ' (' + g1[2] + ' en piezas)' : ''));
    if(costos && g3 && g4 && g3[0] !== g4[0]) frases.push('pero **' + g4[0].p.nombre + '** te deja más ganancia por cada pieza (' + $d(g4[0].porPieza) + ' contra ' + $d(g4[1].porPieza) + ')');
    else if(costos && g3 && g1 && g3[0] !== g1[0]) frases.push('aunque **' + g3[0].p.nombre + '** te deja más ganancia total');
    out.push(P(frases.length ? frases.join(', ') + '.' : 'Se venden parecido.'));
    if(costos && g1 && g4 && g1[0] !== g4[0]) out.push(P('Lo que yo haría: ofrece **' + g4[0].p.nombre + '** junto con **' + g1[0].p.nombre + '** (un combo) para que el que se vende más arrastre al que deja más.'));
    else if(g1 && g1[1].cant === 0) out.push(P('**' + g1[1].p.nombre + '** no se vendió: revisa si está a la vista, si tiene buen precio o si ya no lo quieres tener.'));
    out.push(C([sug('¿Cómo puedo hacer crecer mi negocio?')]));
    return out;
  };
  R.registrarTemas(H, { comparar_productos: 'Comparar dos productos' }, { comparar_productos: 'Comparando los dos productos…' });
  window.PuveIaContexto = { internos: { productosDe, porOrdinal } };
})();
