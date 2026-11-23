/* PUVE IA · Entender la pregunta (sin modelos externos)
 * - Clasificador que aprende (Naive Bayes sobre palabras y pares de palabras) con cientos de frases de ejemplo ya incluidas.
 * - Aprende de cada confirmación y corrección: lo que el usuario corrige se guarda para su negocio y, si varios negocios coinciden, se vuelve vocabulario de todos.
 * - Corrige errores de escritura ("bendi" → "vendí"), entiende horarios ("de 2 a 5 de la tarde"), nombres de productos y preguntas compuestas.
 * No guarda ni envía nada por sí mismo: el guardado lo hace puve-resumen.js con las funciones de la base de datos.
 */
(function(){
  'use strict';
  // abreviaturas de WhatsApp: «q», «xq», «pa», «cm», «porfa»… se leen como las palabras completas
  const ABREV = { q: 'que', k: 'que', xq: 'por que', pq: 'por que', porq: 'por que', xk: 'por que', pk: 'por que', pa: 'para', cm: 'como', cmo: 'como', cnto: 'cuanto', cuantoo: 'cuanto', tmb: 'tambien', tb: 'tambien', dnd: 'donde', xfa: 'por favor', pf: 'por favor', plis: 'por favor', pls: 'por favor', porfa: 'por favor', porfavor: 'por favor', d: 'de', x: 'por', grax: 'gracias', gracs: 'gracias', graciass: 'gracias',
    // faltas de ortografía muy comunes
    bendi: 'vendi', bendo: 'vendo', bendimos: 'vendimos', bendio: 'vendio', bender: 'vender', benta: 'venta', bentas: 'ventas', ke: 'que', qe: 'que', kuanto: 'cuanto', kien: 'quien', aora: 'ahora', haora: 'ahora', manna: 'manana', mnana: 'manana', maniana: 'manana' };
  const normBase = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9: ]/g, ' ').replace(/\s+/g, ' ').trim();
  const norm = (s) => normBase(s).split(' ').map((w) => ABREV[w] || w).join(' ');
  // muletillas de cortesía al principio o al final («oye», «me puedes decir», «por favor»…): no cambian lo que se pregunta
  const PREFIJO = /^(?:(?:oye|oiga|disculpa|disculpame|perdon|a ver|una pregunta|tengo una pregunta|una duda|jefe|jefa|patron|amigo|bro|hola|buenas|buen dia|buenas tardes|buenas noches|me puedes decir|me podrias decir|me puede decir|puedes decirme|podrias decirme|me dices|dime|ayudame|necesito saber|quiero saber|quisiera saber|me gustaria saber|por favor|puve|ia)\s+)+/;
  const SUFIJO = /(?:\s+(?:por favor|gracias|jefe|jefa|amigo|bro|puve))+$/;
  function sinRelleno(t){
    const r = t.replace(PREFIJO, '').replace(SUFIJO, '').trim();
    if(/^(muchas|mil|muchisimas)$/.test(r)) return t;                       // «muchas gracias» no es «muchas»
    if(r && !/^(?:por favor|gracias|jefe|jefa|amigo|bro|puve)$/.test(r)) return r;
    const m = t.match(/(hola|buenas tardes|buenas noches|buen dia|buenas|gracias)(?: por favor| jefe| jefa| amigo| bro| puve)*$/);   // todo era cortesía: se queda con el saludo o el agradecimiento
    return m ? m[1] : t;
  }
  const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pad = (n) => String(n).padStart(2, '0');

  // ---------- frases de ejemplo por tema ----------
  const K = window.PuveIaConocimiento || { EXTRA: {}, SINONIMOS: {}, MUY_VACIAS: '', FUERA_PALABRAS: '' };
  const SEMILLAS = {
    resumen: ['como me fue hoy', 'como me va', 'como nos fue ayer', 'dame un resumen', 'resumen del dia', 'como va el dia', 'como estuvo el dia', 'que tal el dia', 'como van las cosas', 'como va todo hoy', 'dime como voy', 'reporte del dia', 'como cerramos', 'como estuvo la semana', 'resumen de la semana', 'resumen del mes', 'como me fue esta semana', 'como voy este mes', 'que paso hoy', 'cuentame como va el negocio hoy', 'hazme un resumen', 'como me fue ayer'],
    ventas: ['cuanto vendi', 'cuanto he vendido hoy', 'cuanto llevo vendido', 'ventas de hoy', 'ventas de ayer', 'cuanto vendimos', 'cuanto dinero entro', 'cuanto entro hoy', 'cuanto cobre', 'cuantas ventas hice', 'cuantas ventas llevo', 'de 2 a 5 cuanto vendi', 'cuanto se vendio en la tarde', 'cuanto lleva la caja', 'total vendido', 'cuanto facture', 'ingresos de hoy', 'cuanto he sacado', 'cuantos clientes atendi', 'ticket promedio', 'cuanto gasta cada cliente', 'venta promedio', 'que tal las ventas', 'cuanto vendi esta semana', 'cuanto vendi el mes pasado', 'mis ventas', 'dime las ventas', 'cuanto me han pagado hoy', 'cuanto he cobrado', 'cuanto llevo en la caja', 'como estuvo la venta de ayer', 'cuanto hice hoy', 'cuanta lana hice hoy', 'cuanto dinero hice', 'ventas de la semana pasada', 'mis ventas de la semana', 'mis ventas del mes', 'mis ventas de la semana pasada', 'ventas del mes pasado'],
    ganancia: ['cuanto gane', 'cuanta ganancia llevo', 'cuanto me queda de ganancia', 'cuanto estoy ganando', 'mi ganancia de hoy', 'utilidad del mes', 'cuanto saque limpio', 'cuanto me quedo libre', 'estoy ganando bien', 'cuanto es mi margen', 'de lo que vendi cuanto es ganancia', 'ganancia neta', 'cuanto gane este mes', 'rentabilidad', 'cuanto me deja el negocio'],
    gastos: ['cuanto gaste', 'en que gaste', 'mis gastos del mes', 'cuanto he gastado', 'gastos de la semana', 'en que se me va el dinero', 'cuanto pague de renta', 'cuanto gasto en luz', 'cuanto pago de sueldos', 'a donde se va mi dinero', 'estoy gastando mucho', 'mis egresos', 'cuanto gaste en proveedores', 'categorias de gastos', 'cuanto pague de gastos', 'en que se me esta yendo la lana', 'cuanto llevo gastado', 'cuanto llevo gastado en el mes', 'cuanto he gastado en el negocio', 'en que estoy gastando', 'a donde se va la lana'],
    top: ['que se vende mas', 'cual es el producto mas vendido', 'lo que mas sale', 'productos mas vendidos', 'que es lo que mas vendo', 'cual es mi estrella', 'mejores productos', 'top de productos', 'que se vendio mas ayer', 'que es lo mas popular', 'que es lo que mas piden', 'mas vendido de la semana', 'que producto deja mas dinero', 'que me deja mas ganancia', 'que producto es el mejor', 'cual vendo mas'],
    lentos: ['que no se vende', 'que se vende menos', 'productos que no salen', 'que no se mueve', 'cosas paradas', 'productos estancados', 'que casi no vendo', 'lo que menos se vende', 'que no he vendido nada', 'que producto no sale', 'mercancia lenta', 'que se esta quedando sin vender', 'productos sin ventas', 'que no tiene salida', 'cual vendo menos', 'que articulos estan muertos', 'que productos estan muertos', 'que mercancia esta muerta', 'cosas que no se venden nada'],
    stock: ['que se me esta acabando', 'que me falta', 'que se acabo', 'que productos tengo bajos', 'que esta por agotarse', 'cuanto me queda de inventario', 'que hay poco', 'productos agotados', 'que tengo en cero', 'stock bajo', 'que me hace falta surtir', 'que ya no tengo', 'alerta de inventario', 'como esta mi inventario', 'que se va a acabar pronto', 'cuales estan por acabarse', 'que se acaba', 'que se me acaba', 'se me esta terminando algo', 'se esta terminando', 'ya se termino', 'algo por terminarse', 'que se me termino', 'que esta por terminarse', 'me falta algo'],
    comprar: ['que debo comprar', 'que tengo que pedir', 'que compro esta semana', 'que pido al proveedor', 'cuanto debo comprar', 'lista de compras', 'que debo surtir', 'que me conviene comprar', 'en que debo invertir', 'en que invierto', 'donde meto dinero', 'que debo resurtir', 'que necesito comprar para la semana', 'para que me alcance dos semanas que compro', 'cuanto necesito para surtir', 'en que me conviene invertir', 'que tengo que ir a comprar', 'que voy a comprar', 'que hay que comprar', 'donde me conviene meter dinero', 'donde meto mi dinero', 'que tengo que surtir'],
    no_invertir: ['en que no debo invertir', 'que no deberia comprar tanto', 'que no deberia tener tanta inversion', 'donde tengo dinero de mas', 'en que estoy invirtiendo de mas', 'que me sobra', 'que tengo de sobra', 'que compre de mas', 'que no me conviene comprar', 'en que no gastar tanto', 'que no debo volver a comprar', 'que tengo demasiado', 'que mercancia no necesito', 'donde esta atorado mi dinero', 'que dinero tengo parado', 'en que tengo mucho dinero invertido', 'que no vale la pena tener', 'que no deberia tener tanta inversion', 'en que estoy gastando de mas', 'en que gasto de mas en mercancia', 'donde estoy gastando de mas en inventario', 'que mercancia compre de mas'],
    recomendar_vender: ['que me recomiendas vender mas', 'que deberia vender mas', 'que debo promocionar', 'que me conviene vender', 'que producto debo impulsar', 'en que me enfoco', 'que producto me conviene empujar', 'que recomiendas vender', 'que ofrezco mas', 'cual producto me deja mas y vendo poco', 'que debo poner a la vista', 'que producto promociono', 'que oferta me recomiendas', 'que debo ofrecer a mis clientes', 'recomiendame productos para vender', 'que me recomiendas vender', 'que vendo mas para ganar mas', 'que le meto mas', 'que pongo en la vitrina', 'que pongo al frente', 'que exhibo mas', 'que le doy mas empuje', 'que debo vender mas para ganar mas'],
    subir_ventas: ['como vendo mas', 'como puedo vender mas', 'como subo mis ventas', 'que hago para vender mas', 'como aumento mis ventas', 'ideas para vender mas', 'como atraigo mas clientes', 'como mejoro mis ventas', 'que puedo hacer para que me compren mas', 'estrategias para vender mas', 'como hago crecer mi negocio', 'como levanto las ventas', 'estoy vendiendo poco que hago', 'que hago si no vendo', 'como consigo mas clientes'],
    precios: ['que precio le subo', 'debo subir precios', 'estoy cobrando muy barato', 'que productos dejan poca ganancia', 'a que le subo el precio', 'donde estoy ganando poco', 'que precio le pongo', 'productos con poco margen', 'mis precios estan bien', 'conviene subir el precio', 'cuales cuestan mas de lo que dejan'],
    equilibrio: ['cuanto necesito vender para no perder', 'punto de equilibrio', 'cuanto debo vender para cubrir gastos', 'cuanto me falta para cubrir mis gastos', 'ya cubri mis gastos', 'cuanto debo vender al dia', 'cuanto necesito vender para ganar', 'meta de ventas', 'ya salgo en ceros', 'cuanto necesito vender', 'cuanto me falta para pagar mis gastos', 'cuanto necesito para pagar mis gastos', 'cuanto debo vender para salir en tablas', 'salir en tablas', 'cubrir mis gastos'],
    prediccion: ['cuanto voy a vender manana', 'cuanto venderia un sabado', 'como me ira manana', 'cuanto vendo normalmente los lunes', 'cuanto vendo un dia normal', 'cuanto espero vender hoy', 'prediccion de ventas', 'cuanto voy a vender este fin de semana', 'estimado de ventas', 'que tanto voy a vender'],
    riesgo: ['que productos van a caducar', 'que caduca pronto', 'que se me va a echar a perder', 'que esta por vencer', 'que ya caduco', 'que esta vencido', 'productos por caducar', 'merma', 'que tengo que vender antes de que caduque', 'que productos estan en riesgo', 'fechas de caducidad', 'que se puede echar a perder'],
    horas: ['a que hora vendo mas', 'cual es mi hora pico', 'a que hora hay mas clientes', 'cuando vendo mas', 'mejor hora para vender', 'a que hora vendo menos', 'horas flojas', 'horarios fuertes', 'a que hora se llena', 'que horas son las mas fuertes', 'en que horario vendo mas', 'que hora vendo mas'],
    dias: ['que dia vendo mas', 'mejor dia de la semana', 'que dia vendo menos', 'dia mas flojo', 'dias fuertes', 'que dias se vende mas', 'cual es mi mejor dia', 'en que dia hay mas ventas', 'que dia me va mejor'],
    pagos: ['como me pagan', 'cuanto me pagan con tarjeta', 'cuanto es en efectivo', 'ventas con transferencia', 'formas de pago', 'cuanto entro por tarjeta', 'que metodo de pago usan mas', 'cuanto efectivo tengo', 'pagos con tarjeta y efectivo', 'como pagan mis clientes'],
    cajeros: ['quien vende mas', 'quien vendio mas hoy', 'ventas por cajero', 'como van mis empleados', 'cual cajero vende mas', 'quien es mi mejor vendedor', 'ranking de vendedores', 'cuanto vendio cada cajero', 'como va mi equipo', 'que empleado vende menos'],
    clientes: ['que clientes dejaron de venir', 'clientes que no regresan', 'clientes frecuentes', 'quienes son mis mejores clientes', 'clientes que no vuelven', 'a que clientes les escribo', 'clientes perdidos', 'quien dejo de comprar', 'mis clientes fieles', 'clientes inactivos'],
    producto: ['cuanto he vendido de xprod', 'cuanto me queda de xprod', 'como va xprod', 'ventas de xprod', 'cuanto vendi de xprod hoy', 'tengo xprod', 'cuanto xprod tengo', 'xprod se vende bien', 'cuanto me deja xprod', 'que tal xprod', 'dime de xprod', 'stock de xprod', 'cuantos xprod vendi', 'xprod'],
    salud: ['como esta mi negocio', 'como va mi negocio', 'salud de mi negocio', 'mi negocio va bien', 'voy bien', 'estoy bien', 'diagnostico del negocio', 'como estoy en general', 'revisa mi negocio', 'chequeo general', 'mi negocio esta sano', 'como ves mi negocio', 'vamos bien'],
    glosario: ['que es margen', 'que significa ganancia', 'que quiere decir ticket promedio', 'explicame que es inventario', 'que es el capital parado', 'que significa stock', 'que es la rotacion', 'que es costo', 'como se calcula la ganancia', 'no entiendo que es', 'que es punto de equilibrio', 'explicame mas facil', 'que significa eso', 'que quiere decir'],
    que_hago: ['que hago', 'que me recomiendas', 'que me aconsejas', 'dame un consejo', 'que deberia hacer hoy', 'por donde empiezo', 'que es lo mas urgente', 'que debo arreglar', 'que hago primero', 'que mejoro', 'dame recomendaciones', 'que me sugieres', 'que cosas debo cuidar', 'dame consejos', 'que me recomiendas hacer', 'que me recomiendas hoy', 'que me recomiendas ahora', 'que hago ahora', 'que hago hoy', 'que hago con mi negocio', 'recomiendame algo', 'dame una recomendacion', 'que me aconsejas hacer', 'que opinas'],
  };
  Object.keys(K.EXTRA).forEach((k) => { SEMILLAS[k] = (SEMILLAS[k] || []).concat(K.EXTRA[k]); });
  // corpus propio (puve-ia-corpus.js): más frases en muchos registros; solo se suman a temas que el NLU ya conoce y se ignora si el archivo no está
  const C = window.PuveIaCorpus || { ENTRENAMIENTO: {}, RUIDO: '', SINONIMOS: {} };
  Object.keys(C.ENTRENAMIENTO || {}).forEach((k) => { if(SEMILLAS[k]) SEMILLAS[k] = SEMILLAS[k].concat(C.ENTRENAMIENTO[k]); });
  const INTENTS = Object.keys(SEMILLAS);
  const SOLO_ENCARGADO = new Set(['ganancia', 'gastos', 'cajeros', 'clientes', 'riesgo', 'lentos', 'salud', 'no_invertir', 'comprar', 'precios', 'equilibrio', 'recomendar_vender', 'subir_ventas', 'valor_inventario', 'datos_faltantes', 'oferta', 'mejor_margen', 'ruta_optima']);

  // ---------- palabras ----------
  const VACIAS = new Set(['de', 'la', 'el', 'los', 'las', 'un', 'una', 'uno', 'unos', 'unas', 'del', 'al', 'en', 'mi', 'mis', 'tus', 'su', 'sus', 'me', 'se', 'lo', 'le', 'y', 'e', 'o', 'u', 'a', 'por', 'con', 'para', 'es', 'son', 'ser', 'esta', 'este', 'estos', 'esa', 'ese', 'hoy', 'ayer', 'antier', 'ahora', 'pasada', 'pasado', 'ultimos', 'ultimas', 'ultimo', 'ultima', 'entre', 'desde', 'hasta', 'ya', 'muy', 'favor', 'que', 'q', 'porfa', 'oye', 'bro', 'amigo', 'puve', 'ia']);
  K.MUY_VACIAS.split(' ').forEach((w) => { if(w) VACIAS.add(w); });
  String(C.RUIDO || '').split(' ').forEach((w) => { if(w) VACIAS.add(w); });
  const SIN = Object.assign({}, K.SINONIMOS, C.SINONIMOS || {}), FUERA = new Set(K.FUERA_PALABRAS.split(' ').filter(Boolean));
  const FAMILIAS = [[/^(cuantos|cuantas)$/, 'cuantos'], [/^(cuanto|cuanta)$/, 'cuanto'], [/^(vend|vent)/, 'vend'], [/^gan/, 'gana'], [/^gast/, 'gast'], [/^compr/, 'compr'], [/^(inver|invir|invie)/, 'inver'], [/^(inven)/, 'inven'], [/^(recom|recue)/, 'recom'], [/^acab/, 'acab'], [/^agot/, 'agot'], [/^(cadu|venci|venzo|vence)/, 'cadu'], [/^(promo|ofert)/, 'ofert'], [/^(cliente|client)/, 'clien'], [/^(pag|cobr)/, 'pago'], [/^(prec|cost)/, 'prec'], [/^(sobr|demas|exces)/, 'sobra']];
  function raiz(w){
    if(/\d/.test(w)) return '#';
    if(w.length <= 4) return w;
    for(const [re, r] of FAMILIAS) if(re.test(w)) return r;
    return w.slice(0, 5);
  }
  function distancia(a, b, tope){
    if(Math.abs(a.length - b.length) > tope) return tope + 1;
    let prev2 = null, prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for(let i = 1; i <= a.length; i++){
      const cur = [i]; let min = i;
      for(let j = 1; j <= b.length; j++){
        let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if(i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);   // dos letras cambiadas de lugar cuentan como un solo error
        cur[j] = v; if(v < min) min = v;
      }
      if(min > tope + 1) return tope + 1; prev2 = prev; prev = cur;
    }
    return prev[b.length];
  }

  // ---------- reglas que no necesitan aprender: crisis, cuentas, cambio y temas que no son del negocio ----------
  const ligero = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9%+*\/.,$\- ]/g, ' ').replace(/\s+/g, ' ').trim();
  const PALABRA_NUM = { un: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, quince: 15, veinte: 20, treinta: 30, cuarenta: 40, cincuenta: 50, cien: 100, ciento: 100, doscientos: 200, quinientos: 500 };
  function numeros(texto){
    let t = ligero(texto).replace(/(\d),(\d{3})(?!\d)/g, '$1$2').replace(/\$/g, ' ');
    t = t.replace(/\b(un|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|quince|veinte|treinta|cuarenta|cincuenta|cien|ciento|doscientos|quinientos) (mil|millon|millones)\b/g, (x, w, m) => String(PALABRA_NUM[w] * (m === 'mil' ? 1000 : 1000000)));
    const r = []; const re = /(\d+(?:\.\d+)?)(\s*(?:k\b|mil\b|millon(?:es)?\b))?/g; let m;
    while((m = re.exec(t))){ let v = parseFloat(m[1]); if(m[2]){ const u = m[2].trim(); v *= u === 'k' || u === 'mil' ? 1000 : 1000000; } r.push(v); }
    return r;
  }
  function reglas(texto){
    const t = ligero(texto), nums = numeros(texto), n = norm(texto);
    if(/(quitarme la vida|quitarse la vida|suicid|me quiero morir|quiero morir|quiero morirme|ya no quiero vivir|no quiero vivir|acabar con mi vida|terminar con mi vida|matarme|hacerme dano|lastimarme|no vale la pena vivir|desaparecer para siempre)/.test(n)) return { intent: 'crisis', p: 1 };
    if(/(cambio|regreso|devuelvo)/.test(n) && /(paga|pago|dio|pagan|recibi|billete| con )/.test(' ' + n + ' ') && nums.length >= 2) return { intent: 'cambio', p: 0.97 };
    if(nums.length >= 1 && (/\d\s*(%|por ciento)/.test(t) || /(descuento|rebaja|iva|propina|aumento|incremento|recargo)/.test(n))) return { intent: 'calculo', p: 0.97 };
    if(/\d\s*(\+|\*|\/|x|mas|menos|por|entre)\s*\d/.test(t) && t.split(' ').length <= 12) return { intent: 'calculo', p: 0.97 };
    if(nums.length >= 2 && /(suma|resta|multiplica|divide|cuanto es|cuanto son|cuanto da|total de|cuanto sale)/.test(n)) return { intent: 'calculo', p: 0.95 };
    // dinero o tiempo + «qué hago / qué me conviene / en qué lo invierto»: es pedir la mejor decisión (ruta óptima)
    if(/(^| )(tengo|cuento con|dispongo de|presupuesto de|invertir|puedo mover|con) \d/.test(n) && /(que hago|que me conviene|en que|como lo|como los|invert|usar|uso|decidir|conviene|que debo hacer)/.test(n)) return { intent: 'ruta_optima', p: 0.93 };
    // «cuánto vendió Luis» / «cuánto vendió Marta ayer»: la palabra después del verbo es un nombre (no un periodo): es de cajeros
    { const mc = n.match(/^(?:cuanto|que tanto) (?:ha )?(?:vendio|vende|hizo|facturo) ([a-z]+)( |$)/); if(mc && !/^(hoy|ayer|antier|anteayer|la|el|en|mi|mis|de|del|esta|este|todo|total|ya|tanto|cada|un|una|los|las|por|con|para|al|mas|menos|vendido|cobrado|hecho|ganado|de|a)$/.test(mc[1])) return { intent: 'cajeros', p: 0.93 }; }
    // pasado + día de la semana («cuánto vendí el sábado pasado») es una consulta de lo ya ocurrido, no una predicción
    const dsem = /(^| )(lunes|martes|miercoles|jueves|viernes|sabado|domingo)( |$)/.test(n), futuro = /(voy a|vamos a|vendere|ganare|gastare|crees|va a|vaya|proxim|pronostic|predic|estim|espero|manana|siguiente)/.test(n);
    if(dsem && !futuro){
      if(/(^| )(gane|ganamos|ganancia|utilidad|saque limpio)( |$)/.test(n)) return { intent: 'ganancia', p: 0.95 };
      if(/(^| )(gaste|gastamos|gastos|pague|pagamos)( |$)/.test(n)) return { intent: 'gastos', p: 0.95 };
      if(/(^| )(vendi|vendimos|vendio|hice|hicimos|facture|cobre|cobramos|entro|entraron|jale|ventas|venta|fue)( |$)/.test(n) || /(lunes|martes|miercoles|jueves|viernes|sabado|domingo) pasado/.test(n)) return { intent: 'ventas', p: 0.95 };
    }
    const f = n.split(' ').filter((w) => FUERA.has(w));
    if(f.length && !/(vend|vent|gan|gast|stock|inventar|client|negocio|produc|caja|corte|cajer|precio|merc)/.test(n)) return { intent: 'fuera_tema', p: 0.9 };
    return null;
  }

  // ---------- el modelo que aprende ----------
  const M = { cnt: {}, tot: {}, vocab: new Set(), palabras: new Set(), memoria: new Map(), frec: new Map(), V: 0 };
  INTENTS.concat(['desconocido']).forEach((i) => { M.cnt[i] = {}; M.tot[i] = 0; });
  // ---------- leer texto muy mal escrito ----------
  // 1) llave fonética del español: b=v, s=z=c(e,i), k=q=c(a,o,u), j=g(e,i), h muda, ll=y, letras repetidas cuentan una vez
  function fon(w){
    let r = w.replace(/ch/g, '#').replace(/h/g, '').replace(/#/g, 'ch');
    r = r.replace(/qu(?=[ei])/g, 'k').replace(/q/g, 'k').replace(/gu(?=[ei])/g, 'g').replace(/g(?=[ei])/g, 'j').replace(/c(?=[ei])/g, 's').replace(/c(?!h)/g, 'k').replace(/z/g, 's').replace(/v/g, 'b').replace(/w/g, 'u').replace(/ll/g, 'y').replace(/y$/g, 'i').replace(/(.)\1+/g, '$1');
    return r;
  }
  // 2) teclado QWERTY: una letra cambiada por la vecina («granfe» por «grande», «xomo» por «como») cuesta menos que una equivocación cualquiera
  const POS = {}; ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'].forEach((f, r) => [...f].forEach((c, k) => { POS[c] = [r, k + [0, 0.35, 0.8][r]]; }));
  const vecina = (a, b) => { const p = POS[a], q = POS[b]; return !!(p && q && Math.abs(p[0] - q[0]) <= 1 && Math.abs(p[1] - q[1]) <= 1.05); };
  const CONF = new Set(['bv', 'vb', 'sz', 'zs', 'sc', 'cs', 'zc', 'cz', 'ck', 'kc', 'qk', 'kq', 'gj', 'jg', 'yi', 'iy']);
  function distP(a, b, tope){
    if(Math.abs(a.length - b.length) > tope) return tope + 1;
    let prev2 = null, prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for(let i = 1; i <= a.length; i++){
      const cur = [i]; let min = i;
      for(let j = 1; j <= b.length; j++){
        const x = a[i - 1], y = b[j - 1], c = x === y ? 0 : (CONF.has(x + y) ? 0.3 : (vecina(x, y) ? 0.55 : 1));
        let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + c);
        if(i > 1 && j > 1 && x === b[j - 2] && a[i - 2] === y) v = Math.min(v, prev2[j - 2] + 1);
        cur[j] = v; if(v < min) min = v;
      }
      if(min > tope + 1) return tope + 1; prev2 = prev; prev = cur;
    }
    return prev[b.length];
  }
  // 3) el léxico contra el que se corrige: todo lo que el motor conoce (más las palabras de relleno), con su llave fonética y qué tan común es
  const EXTRA = new Set(String(K.PALABRAS_EXTRA || '').split(' ').filter(Boolean));
  let LEX = null, LEX_N = -1;
  function lexico(){
    const n = M.palabras.size + VACIAS.size + EXTRA.size;
    if(LEX && LEX_N === n) return LEX;
    LEX = []; LEX_N = n;
    M.palabras.forEach((w) => { if(w.length >= 2 && !/\d/.test(w)) LEX.push({ w, f: fon(w), frec: M.frec.get(w) || 1 }); });
    VACIAS.forEach((w) => { if(w.length >= 2 && !M.palabras.has(w)) LEX.push({ w, f: fon(w), frec: 40 }); });
    EXTRA.forEach((w) => { if(!M.palabras.has(w) && !VACIAS.has(w)) LEX.push({ w, f: fon(w), frec: 3 }); });
    return LEX;
  }
  const esqueleto = (f) => f.replace(/[aeiou]/g, '');
  // 4) palabras pegadas: «minegocio» → «mi negocio», «comome» → «como me», «utilidadde» → «utilidad de».
  //    Cada pedazo debe ser una palabra que el motor conoce; entre varias formas de partir gana la que usa palabras más comunes y menos pedazos.
  const CORTAS = new Set(['he', 'va', 've', 'ha', 'ir', 'da', 'di', 'es', 'ya', 'no', 'si', 'se', 'me', 'te', 'lo', 'la', 'le', 'mi', 'tu', 'su', 'de', 'en', 'el', 'al', 'un', 'ni', 'yo', 'un']);
  function frecDe(p){ return M.palabras.has(p) ? (M.frec.get(p) || 1) : (VACIAS.has(p) ? 40 : (EXTRA.has(p) ? 3 : 0)); }
  function partir(w){
    const bien = (p) => { p = ABREV[p] || p; return p.length >= 2 && frecDe(p) > 0 && (p.length >= 3 || CORTAS.has(p)); };
    let mejor = null;
    const probar = (partes0) => { if(!partes0.every(bien)) return; const partes = partes0.map((p) => ABREV[p] || p); const sc = partes.reduce((a, p) => a + Math.log10(frecDe(p) + 1) + 0.3 * p.length, 0) - 1.2 * (partes.length - 1); if(!mejor || sc > mejor.sc) mejor = { p: partes, sc }; };
    for(let a = 2; a <= w.length - 2; a++){
      probar([w.slice(0, a), w.slice(a)]);
      for(let b = a + 2; b <= w.length - 2; b++) probar([w.slice(0, a), w.slice(a, b), w.slice(b)]);
    }
    return mejor ? mejor.p : null;
  }
  function corregir(w){
    if(VACIAS.has(w) || M.palabras.has(w) || EXTRA.has(w) || /\d/.test(w) || w.length < 2) return [w];
    // el plural de una palabra conocida es una palabra conocida («primeros»), salvo la «s» de más al final («ventass»)
    if(w.length >= 4 && !/ss$/.test(w)){ const sg = w.endsWith('es') ? w.slice(0, -2) : w.slice(0, -1); if(w.endsWith('s') && (M.palabras.has(sg) || EXTRA.has(sg) || VACIAS.has(sg) || M.palabras.has(w.slice(0, -1)) || EXTRA.has(w.slice(0, -1)))) return [w]; }
    const n = w.length, fw = fon(w), ew = esqueleto(fw), tope = n <= 3 ? 0.6 : (n === 4 ? 1.1 : (n <= 7 ? 1.55 : 2.0));
    let mejor = null, mejorPts = 1e9, mejorD = 9;
    for(const v of lexico()){
      if(Math.abs(v.w.length - n) > tope + 1) continue;
      // suena igual (0.25) · mismas consonantes (0.5, «zber»→«saber») · una letra de diferencia al sonar (1.2) · o letras vecinas/confundibles/faltantes (distP)
      const fonico = v.f === fw ? 0.25 : (n >= 4 && ew.length >= 3 && v.w.length >= 4 && Math.abs(v.w.length - n) <= 1 && ew === esqueleto(v.f) && v.f[0] === fw[0] && v.f[v.f.length - 1] === fw[fw.length - 1] ? 0.5 : (n >= 4 && Math.abs(v.f.length - fw.length) <= 1 && distancia(fw, v.f, 1) <= 1 ? 1.2 : 9));
      const dist = Math.min(fonico, distP(w, v.w, tope));
      if(dist > tope) continue;
      const raw = distP(w, v.w, tope), pts = dist + (v.f === fw ? 0 : 0.3 * Math.min(raw, 3)) - 0.45 * Math.log10(v.frec);   // si suena exactamente igual, gana aunque se escriba distinto
      if(pts < mejorPts){ mejorPts = pts; mejor = v.w; mejorD = dist; }
    }
    // palabras pegadas: si hay una forma de partirla en palabras conocidas y no hay una corrección casi segura (suena igual / letra vecina), se parte
    const p = n >= 4 ? partir(w) : null;
    if(p && (!mejor || mejorD > 0.6)) return p;
    if(mejor) return [mejor];
    return [w];
  }
  function arreglarPalabras(ws){
    return ws.reduce((a, w) => a.concat(corregir(w)), []);
  }
  // cuántas palabras hubo que corregir o separar para entender el texto (para avisar «te entendí…» cuando fueron varias)
  function cambios(texto){
    return sinRelleno(normBase(texto)).split(' ').filter(Boolean).filter((w) => { if(ABREV[w]) return true; const r = corregir(w); return !(r.length === 1 && r[0] === w); }).length;
  }
  function caracteristicas(texto, sinArreglo){
    // «ayer» y compañía dicen CUÁNDO, no QUÉ se pregunta: «cuánto vendí ayer» es lo mismo que «cuánto vendí hoy» (el periodo lo entiende parseTiempo aparte)
    let base = sinRelleno(norm(texto)).replace(/\b(?:en la|por la|de la|esta|la) manana\b/g, ' ');
    const sinAyer = base.replace(/\b(?:de |del |en |por |desde )?(?:ayer|antier|anteayer|anoche)\b/g, ' ').replace(/\s+/g, ' ').trim();
    if(sinAyer.split(' ').filter(Boolean).length >= 2) base = sinAyer;
    let ws = base.split(' ').filter(Boolean);
    if(!sinArreglo) ws = arreglarPalabras(ws);
    ws = ws.map((w) => SIN[w] || w);
    const rs = ws.filter((w) => !VACIAS.has(w)).map(raiz).filter((r) => r !== '#');
    const f = rs.slice(); for(let i = 0; i < rs.length - 1; i++) f.push(rs[i] + '_' + rs[i + 1]);
    return f;
  }
  function entrenar(frase, intent, peso){
    if(!M.cnt[intent]) return;
    const w = peso || 1;
    norm(frase).split(' ').forEach((x) => { if(x && !VACIAS.has(x)){ M.palabras.add(x); M.frec.set(x, (M.frec.get(x) || 0) + w); } });
    caracteristicas(frase, true).forEach((f) => { M.cnt[intent][f] = (M.cnt[intent][f] || 0) + w; M.tot[intent] += w; if(!M.vocab.has(f)){ M.vocab.add(f); M.V++; } });
  }
  INTENTS.forEach((i) => SEMILLAS[i].forEach((f) => entrenar(f, i, 1)));
  // ---------- modelo generado (puve-ia-modelo.js; lo produce herramientas/generar_corpus.js) ----------
  // Guarda los CONTEOS de cientos de miles de frases generadas, no las frases. Cada tema recibe una masa igual a «lambda» veces la de sus frases reales:
  // más frases generadas = mejor estimación de cómo se dice, no más peso frente a lo que escribió la gente.
  // lambda 0.6: medido (ver PROGRESO_ARQUITECTURA_IA.md, décimo y undécimo paso). Con 1 el acierto sube 0.5 puntos pero con 1.5 se rompe «Ero zber d noz bentaz»: se deja lejos del borde
  const AJ = Object.assign({ lambda: 0.6, usarModelo: true, palabras: false, knn: 0, knnBeta: 12, rescate: true, rescateSim: 0.5, rescateMargen: 0.3, rescateCobertura: 0.9 }, window.PuveIaNluAjustes || {});
  function exportarModelo(){ return { cnt: JSON.parse(JSON.stringify(M.cnt)), tot: Object.assign({}, M.tot), palabras: Array.from(M.palabras) }; }
  function importarModelo(mod, lambda){
    if(!mod || !mod.cnt) return 0;
    const L = lambda == null ? AJ.lambda : lambda; let n = 0;
    Object.keys(mod.cnt).forEach((i) => {
      if(!M.cnt[i]) return;
      const g = mod.cnt[i]; let tg = 0; Object.keys(g).forEach((f) => { tg += g[f]; });
      if(!tg) return;
      const k = L * Math.max(M.tot[i], 1) / tg;
      Object.keys(g).forEach((f) => { M.cnt[i][f] = (M.cnt[i][f] || 0) + g[f] * k; if(!M.vocab.has(f)){ M.vocab.add(f); M.V++; } n++; });
      M.tot[i] += tg * k;
    });
    if(AJ.palabras) (mod.palabras || []).forEach((w) => { if(!M.palabras.has(w)){ M.palabras.add(w); if(!M.frec.has(w)) M.frec.set(w, 1); } });   // apagado por defecto: ampliar el léxico de corrección ortográfica empeoró las faltas extremas
    return n;
  }
  if(AJ.usarModelo && window.PuveIaModelo) importarModelo(window.PuveIaModelo);
  // si la pregunta es exactamente una frase de ejemplo que pertenece a un solo tema, es ese tema (sin dudas)
  const EXACTAS = new Map(), VISTAS = new Map();
  INTENTS.forEach((i) => SEMILLAS[i].forEach((f) => { const t = norm(f); if(!VISTAS.has(t)) VISTAS.set(t, new Set()); VISTAS.get(t).add(i); }));
  VISTAS.forEach((set, t) => { if(set.size === 1) EXACTAS.set(t, [...set][0]); });

  // ---------- segundo clasificador: parecido con frases conocidas (TF-IDF + coseno, vecino más cercano por tema) ----------
  // El Naive Bayes mira qué rasgos suelen aparecer en cada tema; este mira a qué frase conocida se parece más la pregunta. Se fusionan (producto de expertos):
  // cuando uno duda y el otro está seguro, gana el seguro. Se construye la primera vez que se usa (unos milisegundos).
  let KNN = null;
  function knnIndice(){
    if(KNN) return KNN;
    const docs = [], df = new Map();
    INTENTS.forEach((i) => SEMILLAS[i].forEach((f) => { const fs = new Set(caracteristicas(f, true).filter((x) => x.length > 2 || x.indexOf('_') >= 0)); if(!fs.size) return; docs.push({ i, f: fs }); fs.forEach((x) => df.set(x, (df.get(x) || 0) + 1)); }));
    const N = docs.length, idf = new Map(); df.forEach((c, x) => idf.set(x, Math.log((N + 1) / (c + 1)) + 1));
    const inv = new Map();
    docs.forEach((d, k) => { let n2 = 0; d.f.forEach((x) => { const w = idf.get(x); n2 += w * w; }); d.nrm = Math.sqrt(n2); d.f.forEach((x) => { (inv.get(x) || inv.set(x, []).get(x)).push([k, idf.get(x)]); }); });
    KNN = { docs, idf, inv }; return KNN;
  }
  function knnPuntajes(texto){
    const K = knnIndice(), q = new Set(caracteristicas(texto).filter((x) => K.idf.has(x))); if(!q.size) return null;
    let qn = 0; q.forEach((x) => { const w = K.idf.get(x); qn += w * w; }); qn = Math.sqrt(qn);
    const acum = new Map(); q.forEach((x) => { const w = K.idf.get(x); (K.inv.get(x) || []).forEach(([k, wd]) => { acum.set(k, (acum.get(k) || 0) + w * wd); }); });
    const mejor = {}; acum.forEach((dot, k) => { const d = K.docs[k], sim = dot / (qn * d.nrm); if(sim > (mejor[d.i] || 0)) mejor[d.i] = sim; });
    return mejor;
  }
  function clasificar(texto){
    const t0 = norm(texto), t = sinRelleno(t0);
    const def = t.match(/^(?:explicame )?(?:que es|que son|que significa|que quiere decir|que quieren decir)(?: el| la| los| las| un| una)? (?!lo\b|mi\b|mis\b|mas\b|menos\b|mejor\b|peor\b|que\b|el\b|la\b)([a-z]+)/);
    if(def) return { lista: [{ i: 'glosario', p: 0.97 }], conocida: true, nFeat: 99, cobertura: 1 };
    const corr = arreglarPalabras(t.split(' ')).join(' ');   // con los errores de dedo corregidos también puede ser una frase conocida
    const tm = [t0, t, corr].find((x) => M.memoria.has(x)) || null, te = [t0, t, corr].find((x) => EXACTAS.has(x)) || null;
    if(te && !tm) return { lista: [{ i: EXACTAS.get(te), p: 0.98 }], conocida: true, nFeat: 99, cobertura: 1 };
    if(tm) return { lista: [{ i: M.memoria.get(tm), p: 0.99 }], conocida: true, nFeat: 99, cobertura: 1 };
    const todas = caracteristicas(texto), f = todas.filter((x) => M.vocab.has(x)), uni = todas.filter((x) => x.indexOf('_') < 0 && (x.length > 2 || M.vocab.has(x))), cobertura = uni.length ? uni.filter((x) => M.vocab.has(x)).length / uni.length : 0;
    if(!f.length) return { lista: [], conocida: false, nFeat: 0, cobertura: 0 };
    const a = 0.08, ints = INTENTS.slice(), sc = ints.map((i) => { let s = 0; f.forEach((x) => { s += Math.log(((M.cnt[i][x] || 0) + a) / (M.tot[i] + a * M.V)); }); return s / Math.sqrt(f.length); });
    const mx = Math.max(...sc), ex = sc.map((s) => Math.exp((s - mx) * 1.6)), z = ex.reduce((x, y) => x + y, 0);
    let pr = ex.map((e) => e / z);
    if(AJ.knn > 0){
      const ks = knnPuntajes(texto);
      if(ks){ const lg = pr.map((p, k) => (1 - AJ.knn) * Math.log(p + 1e-9) + AJ.knn * AJ.knnBeta * (ks[ints[k]] || 0)), m2 = Math.max(...lg), e2 = lg.map((l) => Math.exp(l - m2)), z2 = e2.reduce((x, y) => x + y, 0); pr = e2.map((e) => e / z2); }
    }
    const lista = ints.map((i, k) => ({ i, p: pr[k] })).sort((x, y) => y.p - x.p).slice(0, 4), res = { lista, conocida: false, nFeat: f.length, cobertura };
    if(AJ.rescate && cobertura >= AJ.rescateCobertura){   // rescate: si el clasificador principal duda pero la pregunta se parece mucho a UNA frase conocida de un tema que él también ve entre sus 3 primeros, contesta ese
      const ks = knnPuntajes(texto);
      if(ks){ const o = Object.entries(ks).sort((x, y) => y[1] - x[1]); if(o[0] && o[0][1] >= AJ.rescateSim && o[0][1] - (o[1] ? o[1][1] : 0) >= AJ.rescateMargen && lista.slice(0, 3).some((x) => x.i === o[0][0])) res.parecido = { i: o[0][0], sim: o[0][1] }; }
    }
    return res;
  }

  // ¿Qué tan seguro hay que estar para contestar en vez de preguntar? Contesta si está claro (55%+ y le saca ventaja al segundo)
  // o si, aunque haya pocas pistas (texto muy mal escrito), la ventaja sobre el segundo es grande (40%+ y 30 puntos de ventaja).
  function decidir(cl){
    const r = decidirBase(cl);
    return r || (cl.parecido ? cl.parecido.i : null);
  }
  function decidirBase(cl){
    const top = cl.lista[0], sec = cl.lista[1];
    if(!top || cl.cobertura <= 0.5) return null;
    const margen = top.p - (sec ? sec.p : 0);
    if(top.p >= 0.55 && (margen >= 0.12 || cl.conocida)) return top.i;
    if(top.p >= 0.4 && margen >= 0.3) return top.i;
    return null;
  }

  // ---------- aprender ----------
  function aprender(frase, intent, peso){
    const t = norm(frase);
    if(!t || !M.cnt[intent] || intent === 'desconocido') return;
    entrenar(t, intent, peso || 3);
    M.memoria.set(t, intent);
  }
  function olvidar(frase, intent){
    const t = norm(frase);
    if(M.memoria.get(t) === intent) M.memoria.delete(t);
  }
  const MAPA_OLVIDO = {};   // (frases equivocadas) se descuentan un poco para no insistir en el error
  function castigar(frase, intent){
    if(!M.cnt[intent]) return;
    caracteristicas(frase, true).forEach((f) => { if(M.cnt[intent][f]) M.cnt[intent][f] = Math.max(0, M.cnt[intent][f] - 1.2); });
    olvidar(frase, intent);
  }
  // prepara una frase para guardarla: sin nombres de productos, sin números ni datos personales
  function sanear(texto, nombresProducto){
    let t = norm(texto);
    (nombresProducto || []).forEach((n) => { n = norm(n); if(n.length >= 3) t = t.replace(new RegExp('(^| )' + escRe(n) + '(?= |$)', 'g'), '$1xprod'); });
    t = t.replace(/\d+/g, ' ').replace(/\s+/g, ' ').trim();
    if(t.length < 3 || t.length > 90 || t.split(' ').length < 2 && t !== 'xprod') return '';
    return t;
  }

  // ---------- partir preguntas compuestas ("... y ...") ----------
  function dividir(texto){
    const t = norm(texto);
    const m = t.match(/^(.{8,}?)\s+(?:y|e|ademas|tambien|pero|luego)\s+((?:que|como|cuanto|cuanta|cuantos|cuantas|cual|cuales|en que|donde|no|a que|quien|cuando|dame|dime|ayudame)\b.{5,})$/);
    return m ? [m[1], m[2]] : [t];
  }

  // ---------- horarios ----------
  const DIAS_SEM = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
  const DIAS_BONITO = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const NUMEROS = { una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12 };
  const inicioDia = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const suma = (d, dias) => { const x = new Date(d); x.setDate(x.getDate() + dias); return x; };
  const conHora = (d, h, m) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m || 0);
  function horaT(h, m){ const b = h % 24 === 0 ? 12 : (h % 24 > 12 ? h % 24 - 12 : h % 24); return b + (m ? ':' + pad(m) : ''); }
  function perT(h){ h = h % 24; if(h === 12) return 'del día'; if(h === 0) return 'de la noche'; if(h < 12) return 'de la mañana'; return h < 19 ? 'de la tarde' : 'de la noche'; }
  function rangoTexto(hh){
    if(hh.nombre) return { manana: 'en la mañana', tarde: 'en la tarde', noche: 'en la noche' }[hh.nombre];
    const p1 = perT(hh.h1), p2 = perT(hh.h2), a = horaT(hh.h1, hh.m1), b = horaT(hh.h2, hh.m2);
    return p1 === p2 ? 'de ' + a + ' a ' + b + ' ' + p1 : 'de ' + a + ' ' + p1 + ' a ' + b + ' ' + p2;
  }
  const horaFuerteTexto = (h) => rangoTexto({ h1: h, m1: 0, h2: h + 1, m2: 0 });
  function resolverHora(n, mer, global){
    n = Number(n); if(n >= 13) return n;
    const m = mer || global;
    if(m === 'am') return n === 12 ? 0 : n;
    if(m === 'pm') return n === 12 ? 12 : n + 12;
    if(n >= 1 && n <= 6) return n + 12;
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
      const gl = global || mer(m[6]) || mer(m[3]), h1 = resolverHora(m[1], mer(m[3]), gl);
      let h2 = resolverHora(m[4], mer(m[6]), gl);
      if(h2 <= h1){ if(h2 < 12 && h2 + 12 > h1) h2 += 12; else h2 = Math.min(24, h1 + 1); }
      return { h1, m1: Number(m[2]) || 0, h2: Math.min(24, h2), m2: Number(m[5]) || 0 };
    }
    m = t.match(new RegExp('(?:^| )a las? (\\d{1,2})(?::(\\d{2}))?\\s*(am|pm|a m|p m)?' + NO));
    if(m && Number(m[1]) <= 24){ const h = resolverHora(m[1], mer(m[3]), global), mm = Number(m[2]) || 0; return { h1: h, m1: mm, h2: Math.min(24, h + 1), m2: mm }; }
    m = t.match(/(?:^| )(?:esta|en la|por la|de la) (manana|tarde|noche)(?: |$)/);
    if(m){ const r = { manana: [6, 12], tarde: [12, 19], noche: [19, 24] }[m[1]]; return { h1: r[0], m1: 0, h2: r[1], m2: 0, nombre: m[1] }; }
    return null;
  }
  function parseTiempo(texto, ahoraRef){
    let t = norm(texto); { const m0 = t.match(/^(.*?(?:este mes|esta semana|hoy|ayer|este ano|semana pasada|mes pasado)) (?:con|contra|vs|versus|comparad[oa] con|comparad[oa] contra|frente a) .*$/); if(m0) t = m0[1]; }   // «este mes con el mes pasado»: el periodo es el primero; el segundo ya es su comparación
    const ahora = ahoraRef || new Date(), hoy0 = inicioDia(ahora), r = { tipo: 'dia', explicito: false };
    let dia = null, diaEt = null, m;
    if(/(^| )(antier|anteayer)( |$)/.test(t)){ dia = suma(hoy0, -2); diaEt = 'antier'; }
    else if(/(^| )ayer( |$)/.test(t)){ dia = suma(hoy0, -1); diaEt = 'ayer'; }
    else if(/(^| )hoy( |$)/.test(t)){ dia = hoy0; diaEt = 'hoy'; }
    else if(/(^| )pasado manana( |$)/.test(t)){ dia = suma(hoy0, 2); diaEt = 'pasado mañana'; r.futuro = true; }
    else if(/(^| )manana( |$)/.test(t) && !/(esta|en la|por la|de la|la) manana/.test(t)){ dia = suma(hoy0, 1); diaEt = 'mañana'; r.futuro = true; }
    if(!dia && (m = t.match(/(?:^| )(domingo|lunes|martes|miercoles|jueves|viernes|sabado)(?: |$)/))){
      const idx = DIAS_SEM.indexOf(m[1]), dif = (hoy0.getDay() - idx + 7) % 7;
      dia = suma(hoy0, -dif); diaEt = dif === 0 ? 'hoy' : 'el ' + DIAS_BONITO[idx]; r.diaSemana = idx;
    }
    if(!dia && (m = t.match(new RegExp('(?:^| )(\\d{1,2}) de (' + MESES.join('|') + ')(?: |$)')))){
      const mes = MESES.indexOf(m[2]); let d = new Date(ahora.getFullYear(), mes, Number(m[1]));
      if(d > hoy0) d = new Date(ahora.getFullYear() - 1, mes, Number(m[1]));
      dia = d; diaEt = 'el ' + m[1] + ' de ' + m[2];
    }
    const lunesDe = (d) => suma(d, -((d.getDay() + 6) % 7));
    if(/semana pasada|semana anterior/.test(t)){ const l = lunesDe(hoy0); Object.assign(r, { tipo: 'semana', desde: suma(l, -7), hasta: l, prevDesde: suma(l, -14), prevHasta: suma(l, -7), etiqueta: 'la semana pasada', etPrev: 'la semana anterior', explicito: true }); }
    else if(/mes pasado|mes anterior/.test(t)){ const i = new Date(ahora.getFullYear(), ahora.getMonth(), 1), d0 = new Date(i.getFullYear(), i.getMonth() - 1, 1); Object.assign(r, { tipo: 'mes', desde: d0, hasta: i, prevDesde: new Date(i.getFullYear(), i.getMonth() - 2, 1), prevHasta: d0, etiqueta: 'el mes pasado', etPrev: 'el mes anterior', explicito: true }); }
    else if((m = t.match(/ultim[oa]s? (\d{1,3}) (dias|semanas|meses)/)) || /ultim[oa] (semana|mes)/.test(t)){
      let n, unidad; if(m){ n = Number(m[1]); unidad = m[2]; } else { unidad = /ultim[oa] semana/.test(t) ? 'semana' : 'mes'; n = 1; }
      const dias = Math.max(1, /dia/.test(unidad) ? n : (/seman/.test(unidad) ? n * 7 : n * 30)), desde = suma(hoy0, -(dias - 1));
      const nombre = n === 1 && !/dias/.test(unidad) ? (unidad === 'mes' ? 'el último mes' : 'la última semana') : 'los últimos ' + n + ' ' + ({ dias: 'días', semanas: 'semanas', meses: 'meses' }[unidad] || unidad);
      Object.assign(r, { tipo: 'dias', desde, hasta: ahora, prevDesde: suma(desde, -dias), prevHasta: desde, etiqueta: nombre, etPrev: 'el periodo anterior', explicito: true });
    } else if(/(^| )semana( |$)/.test(t)){ const l = lunesDe(hoy0); Object.assign(r, { tipo: 'semana', desde: l, hasta: ahora, prevDesde: suma(l, -7), prevHasta: suma(ahora, -7), etiqueta: 'esta semana', etPrev: 'la semana pasada', explicito: true }); }
    else if(/(^| )mes( |$)/.test(t)){ const i = new Date(ahora.getFullYear(), ahora.getMonth(), 1), p0 = new Date(i.getFullYear(), i.getMonth() - 1, 1); Object.assign(r, { tipo: 'mes', desde: i, hasta: ahora, prevDesde: p0, prevHasta: new Date(Math.min(i.getTime(), new Date(p0.getFullYear(), p0.getMonth(), ahora.getDate(), ahora.getHours(), ahora.getMinutes()).getTime())), etiqueta: 'este mes', etPrev: 'el mes pasado', explicito: true }); }
    if(r.tipo === 'dia'){
      const base = dia || hoy0, et = diaEt || 'hoy', hh = extraerHoras(t);
      if(hh){
        r.tipo = 'horas'; r.horas = hh; r.explicito = true; r.desde = conHora(base, hh.h1, hh.m1); r.hasta = hh.h2 >= 24 ? suma(base, 1) : conHora(base, hh.h2, hh.m2);
        r.prevDesde = suma(r.desde, -1); r.prevHasta = suma(r.hasta, -1); r.etiqueta = et + ' ' + rangoTexto(hh); r.etPrev = et === 'hoy' ? 'ayer en ese mismo horario' : 'el día anterior en ese mismo horario';
      } else if(base.getTime() === hoy0.getTime()){
        Object.assign(r, { desde: hoy0, hasta: ahora, prevDesde: suma(hoy0, -1), prevHasta: suma(ahora, -1), etiqueta: 'hoy', etPrev: 'ayer a esta misma hora' }); if(dia) r.explicito = true;
      } else {
        Object.assign(r, { desde: base, hasta: suma(base, 1), prevDesde: suma(base, -1), prevHasta: base, etiqueta: et, etPrev: et === 'ayer' ? 'antier' : 'el día anterior', explicito: true });
      }
    }
    r.dias = Math.max(1, Math.round((r.hasta - r.desde) / 86400000));
    return r;
  }
  const ultimos = (n) => parseTiempo('ultimos ' + n + ' dias');

  // ---------- productos mencionados (también con errores de escritura y por una sola palabra, como "tacos") ----------
  const PALABRAS_TIEMPO = new Set(['semana', 'mes', 'dia', 'dias', 'tarde', 'noche', 'manana', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo', 'horas', 'hora']);
  function buscarProductos(texto, productos){
    const t = norm(texto), ws = t.split(' ').filter((w) => w.length >= 3 && !VACIAS.has(w) && !PALABRAS_TIEMPO.has(w) && !/\d/.test(w));
    const enSemillas = (w) => { if(M.palabras.has(w)) return true; return false; };
    // 1) nombre completo
    let completos = (productos || []).filter((p) => { const n = norm(p.nombre); return n.length >= 3 && new RegExp('(^| )' + escRe(n) + '( |$)').test(t); });
    if(completos.length){ const mx = Math.max(...completos.map((p) => norm(p.nombre).length)); completos = completos.filter((p) => norm(p.nombre).length === mx); return { productos: completos.slice(0, 8), palabras: norm(completos[0].nombre).split(' ') }; }
    // 2) palabras sueltas que no son del vocabulario de preguntas
    const cand = ws.filter((w) => !enSemillas(w) || (productos || []).some((p) => norm(p.nombre).split(' ').includes(w) && w.length >= 4 && !M.cnt.producto[raiz(w)]));
    if(!cand.length) return { productos: [], palabras: [] };
    const puntaje = new Map(), usadas = new Set();
    (productos || []).forEach((p) => {
      const fichas = norm(p.nombre).split(' ').filter((w) => w.length >= 3 && !VACIAS.has(w)); let s = 0;
      cand.forEach((c) => { const ok = fichas.some((f) => f === c || (f.length >= 5 && c.length >= 5 && (f.slice(0, 5) === c.slice(0, 5) || distancia(f, c, 1) <= 1)) || (c.length >= 5 && f.length >= 5 && f.replace(/s$/, '') === c.replace(/s$/, ''))); if(ok){ s++; usadas.add(c); } });
      if(s) puntaje.set(p, s);
    });
    if(!puntaje.size) return { productos: [], palabras: [] };
    const mx = Math.max(...puntaje.values()), ganadores = [...puntaje.entries()].filter(([, s]) => s === mx).map(([p]) => p);
    if(ganadores.length > 8) return { productos: [], palabras: [] };
    return { productos: ganadores, palabras: [...usadas] };
  }
  // cambia los nombres de productos de la pregunta por "xprod" para que aprenda la forma de la pregunta, no el producto
  function enmascarar(texto, palabras){
    let t = norm(texto);
    (palabras || []).forEach((w) => { t = t.replace(new RegExp('(^| )' + escRe(w) + '(?= |$)', 'g'), '$1xprod'); });
    return t.replace(/(xprod ?)+/g, 'xprod ').trim();
  }

  window.PuveIaNlu = {
    INTENTS, SOLO_ENCARGADO, norm, decidir, cambios, _depurar: { fon, distP, lexico }, interpretar: (t) => arreglarPalabras(sinRelleno(norm(t)).split(' ')).join(' '), reglas, numeros, ligero, clasificar, aprender, castigar, olvidar, sanear, dividir, parseTiempo, ultimos, extraerHoras, buscarProductos, enmascarar, rangoTexto, horaFuerteTexto, DIAS_BONITO,
    exportarModelo, importarModelo, parecidos: knnPuntajes,
    cargarMemoria(lista, peso){ (lista || []).forEach((x) => { if(x && x.f && x.i) { entrenar(x.f, x.i, peso || 3); if((peso || 3) >= 3) M.memoria.set(norm(x.f), x.i); } }); },
    vacia: (t) => caracteristicas(t).filter((x) => x !== 'xprod').length === 0
  };
})();
