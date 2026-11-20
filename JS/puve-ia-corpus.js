/* PUVE IA · Corpus de entrenamiento propio (sin modelos externos)
 * Frases de ejemplo escritas en muchos registros (chaca, fresa, formal, mayor, joven, dictado por voz, spanglish) para que el clasificador
 * de puve-ia-nlu.js entienda mejor cómo habla la gente. Se suman a las semillas del NLU; solo se aceptan temas que el NLU ya conoce.
 * Las frases de PRUEBA viven aparte (pruebas/corpus_prueba.js) y nunca se mezclan con estas.
 * Para agregar un tema o un registro: añade frases aquí y mide con `node pruebas/prueba_corpus.js` y `node pruebas/prueba_comprension_ampliada.js`
 * (regla aprendida: más frases no siempre mejora; solo se queda lo que se midió).
 * Lote 1: ventas, ganancia, gastos, top, stock, comprar (+ unos contraejemplos de clientes).
 */
(function(){
  'use strict';
  const ENTRENAMIENTO = {
    ventas: [
      // chaca
      'cuanto jale hoy', 'cuanto se hizo en la caja', 'cuanto cayo hoy de lana', 'que tanto se hizo hoy', 'cuanto se saco hoy', 'cuanto llevamos hoy carnal',
      'cuantos pesos entraron hoy', 'cuanta lana entro hoy', 'ya se hizo dinero hoy', 'cuanto se junto de lana hoy',
      // fresa
      'literal cuanto hemos vendido', 'o sea cuanto llevamos de ventas hoy', 'me puedes decir cuanto vendimos en el dia', 'como van las ventas el dia de hoy',
      'cuanto va el total de ventas', 'literal cuanto llevo vendido hoy',
      // formal
      'cual es el monto de ventas del dia', 'indiqueme las ventas acumuladas de la semana', 'total de ventas del mes en curso', 'requiero saber el total vendido ayer',
      'solicito el monto total vendido hoy', 'informeme el importe de ventas del dia',
      // mayor
      'dime cuanto hemos vendido hoy hijo', 'cuanto se vendio hoy en la tienda', 'a ver cuanto va vendido', 'cuanto se ha vendido en la semana', 'oiga cuanto lleva vendido hoy',
      // joven
      'cuanto llevamos de venta', 'q tal van las ventas', 'cuanto vendimos hoy bro', 'como van las ventas hoy', 'cuanto facturamos hoy',
      // voz / errores
      'cuanto vendi en lo que va del dia', 'cuanto he vendido en lo que va del mes', 'cuantas ventas llevamos esta semana', 'cuanto vendimos ayer en total', 'cuanto bendi hoy en la tienda',
      // spanglish
      'cuanto sales llevamos hoy', 'cuanto hicimos en ventas today', 'cuanto vendimos this week'
    ],
    ganancia: [
      'cuanto gane hoy limpio', 'cuanto me quedo de lo vendido', 'cuanto es lo que me queda libre hoy', 'que tanto estoy ganando', 'cuanto saque de utilidad esta semana',
      'cuanto me dejo el dia', 'cuanto me dejo el negocio este mes', 'cuanto gano de verdad', 'cuanta lana me quedo limpia', 'cuanto es mi ganancia real',
      'cuanto me queda de lo que vendi', 'y la ganancia como va', 'cuanto estoy sacando de ganancia', 'cual es mi utilidad', 'cuanto es mi utilidad neta del mes',
      'mi ganancia de la semana', 'cuanto fue la ganancia de ayer', 'indiqueme la utilidad del periodo', 'cual es el margen de ganancia del mes', 'me puedes decir cuanto estoy ganando',
      'cuanto profit llevo hoy', 'cuanto ganamos hoy bro', 'cuanto es lo que realmente me queda', 'ya descontando todo cuanto gano', 'cuanto me llevo a la bolsa hoy',
      'cuanto me deja lo de hoy', 'cuanto me toca de ganancia', 'cuanto ando ganando', 'estoy ganando o perdiendo', 'cuanto me quedo ya sin gastos',
      'cuanto ganamos esta semana', 'cuanto he ganado en el mes', 'cuanto me queda neto', 'cuanto me llevo limpio hoy', 'cual es mi profit del dia'
    ],
    gastos: [
      'cuanto he gastado este mes', 'cuanto solte de lana', 'en que me gasto la feria', 'cuanto llevo de gastos', 'en que se me va la lana del negocio', 'cuanto pague este mes en total',
      'mis gastos de la semana', 'cuanto gaste en la semana', 'cuales son mis gastos fijos', 'en que gasto mas', 'cuanto he pagado de luz y renta', 'cuanto gaste en mercancia',
      'cuanto he gastado en proveedores este mes', 'desglose de gastos del mes', 'relacion de egresos del periodo', 'muestrame los gastos del mes', 'cuanto llevo gastado hasta hoy',
      'cuanto ando gastando', 'a donde se me va el dinero', 'cuanto expenses llevo', 'cuanto he gastado bro', 'en que se me fue la plata este mes', 'cuanto me cuesta operar el negocio al mes',
      'cuanto pago de nomina', 'cuanto estoy gastando en insumos', 'mis gastos de ayer', 'cuanto gastamos hoy', 'que gastos tengo este mes', 'gastos totales',
      'cuanto he soltado en el mes', 'cuanto llevo desembolsado', 'cuanto se me fue en gastos', 'cuanto gaste en total'
    ],
    top: [
      'que es lo que mas se vende', 'cual es lo que mas jala', 'que es lo que mas se lleva la gente', 'mi producto estrella', 'cual es el mas vendido de la semana', 'que producto vende mas',
      'cual es mi best seller', 'cuales son mis 5 productos mas vendidos', 'top 3 de ventas', 'el que mas sale', 'que es lo que la gente mas compra', 'que se vende como pan caliente',
      'cual es el favorito de mis clientes', 'que es lo mas pedido', 'lo mas vendido del mes', 'ranking de productos', 'indiqueme los articulos de mayor venta', 'cual articulo tiene mayor rotacion',
      'que es lo que mas pega', 'cual es el que mas piden', 'que es lo mas buscado', 'que es lo que mas se me va', 'que producto es el rey', 'mis mejores productos de la semana',
      'cual es el numero uno en ventas', 'que es lo que mas compran aqui', 'los mas vendidos de hoy', 'cual es lo mas vendido', 'que es lo que mas sale de la tienda', 'cual es el producto mas popular',
      'q es lo q mas se vende', 'que es lo que mas se mueve', 'cual es el producto que mas se lleva la raza'
    ],
    stock: [
      'que se me esta acabando en la tienda', 'que ya casi no tengo', 'que me hace falta tener', 'que productos estan por agotarse', 'que ya se acabo en bodega', 'que tengo en ceros',
      'que se me esta terminando', 'que esta bajo de inventario', 'que ya no me queda', 'que cosas estan escasas', 'productos con poca existencia', 'cuales tienen existencia minima',
      'que articulos estan por acabarse', 'cuales ya se agotaron', 'que se agoto hoy', 'que productos estan low stock', 'que estoy corto de inventario', 'que ya no hay en la bodega',
      'que me falta en el almacen', 'que esta casi vacio', 'que productos estan en minimos', 'dime que se esta acabando', 'que se acabo hoy', 'revisa que esta bajo de existencia',
      'que ando escaso', 'en que estoy corto', 'cuales estan por quedarse sin existencia', 'que tengo poquito', 'que esta quedando poco', 'stock critico', 'productos en rojo',
      'que esta por quedarse sin existencia', 'que articulos ya no tengo', 'q se me esta acabando'
    ],
    // contraejemplos: «top» de CLIENTES no es «top» de productos (lo encontró la regresión de prueba_contexto)
    clientes: ['top 10 de mis clientes', 'ranking de mis clientes', 'mis 3 mejores clientes', 'lista de mis mejores clientes', 'cuales son mis clientes top'],
    comprar: [
      'que tengo que surtir esta semana', 'que me toca comprar', 'que le pido al proveedor', 'que compro hoy', 'que debo adquirir', 'que mercancia me conviene comprar',
      'que pido para la semana', 'que necesito pedir', 'que tengo que ordenar', 'dame mi lista para surtir', 'que me recomiendas comprar', 'que le hago pedido al proveedor',
      'recomiendame que mercancia comprar', 'cuales son las compras sugeridas', 'que debo resurtir ya', 'que hay que ir a surtir', 'que ocupo comprar', 'que ocupo surtir',
      'que ocupo pedir', 'que debo pedirle al proveedor', 'que tengo que ir a comprar al mayoreo', 'que compro para que no me falte', 'que debo ordenar', 'que pido primero',
      'que es urgente comprar', 'que compro bro', 'cuanto debo pedir de cada cosa', 'que debo comprar manana', 'que tengo que reponer', 'que tengo que reabastecer',
      'que hay que reponer', 'que me sugieres surtir', 'que ando necesitando comprar', 'lista de lo que debo comprar', 'que tengo que ordenar al proveedor'
    ]
  };

  // Palabras que no cambian lo que se pregunta (apelativos, muletillas y fórmulas de cortesía): el clasificador las ignora.
  const RUIDO = 'dime literal literalmente carnal compa compadre wey guey mijo mija hijo hija onda solicito deseo desearia requiero indiqueme indique informeme informarme conocer';

  // Jerga y spanglish → la palabra que ya entiende el clasificador (una sola palabra a la vez).
  const SINONIMOS = {
    lanita: 'dinero', lanota: 'dinero', pasta: 'dinero', morralla: 'dinero',
    sales: 'ventas', profit: 'ganancia', expenses: 'gastos', seller: 'vendido', best: 'mas', supplier: 'proveedor', low: 'poco',
    adquirir: 'comprar', adquisiciones: 'compras', adquisicion: 'compra', importe: 'total', monto: 'total',
    egresos: 'gastos', egreso: 'gasto', raza: 'cliente'
  };

  window.PuveIaCorpus = { ENTRENAMIENTO, RUIDO, SINONIMOS };
})();
