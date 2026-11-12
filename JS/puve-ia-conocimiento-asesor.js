/* PUVE IA · Conocimiento del asesor de crecimiento (motor propio, sin IA externa)
 * Solo datos: frases de ejemplo de cómo habla la gente cuando quiere crecer, expandirse, pedir un plan o seguir platicando sobre una idea.
 * Se carga DESPUÉS de puve-ia-conocimiento.js y ANTES de puve-ia-nlu.js, que las mezcla con las demás frases.
 * Para enseñarle una forma nueva de decir algo, agrega la frase aquí (o apruébala desde Admin → Resumen → «¿Qué está aprendiendo la IA?»).
 */
(function(){
  'use strict';
  const K = window.PuveIaConocimiento;
  if(!K || !K.EXTRA) return;
  const X = K.X, E = K.EXTRA;
  const sumar = (tema, frases) => { E[tema] = (E[tema] || []).concat(frases); };

  // ¿cómo hago crecer mi negocio? (ideas y ruta de crecimiento con los datos del negocio)
  sumar('crecer', [].concat(
    X([['como puedo', 'como logro', 'como le hago para', 'que hago para', 'quiero', 'necesito', 'ayudame a', 'dame ideas para', 'ideas para', 'que puedo hacer para'], ['hacer crecer', 'crecer', 'expandir', 'expandirme', 'agrandar', 'hacer mas grande'], ['mi negocio', 'el negocio', 'mi tienda', 'mi local', 'mi empresa', '']], 40),
    ['ideas de expansion', 'ideas para expandir mi negocio', 'plan de crecimiento', 'ruta de crecimiento', 'como expandir mi negocio', 'quiero que mi negocio crezca', 'como hago que mi negocio crezca', 'como crezco', 'como puedo crecer', 'como hago crecer mi negocio',
      'estrategia para crecer', 'que puedo hacer para crecer', 'ideas para crecer', 'ayudame a crecer', 'como escalar mi negocio', 'como hago para crecer', 'que debo hacer para que mi negocio crezca', 'nuevas ideas para mi negocio', 'dame ideas nuevas para mi negocio',
      'que mas puedo hacer para ganar mas', 'como aumento mi ganancia', 'ideas para ganar mas', 'como ganar mas dinero con mi negocio', 'como hago mas grande mi negocio', 'quiero expandirme', 'quiero crecer', 'quiero hacer crecer mi negocio', 'como llevo mi negocio al siguiente nivel',
      'siguiente nivel para mi negocio', 'como hago que mi negocio sea mas rentable', 'como hago mas rentable mi negocio', 'ideas de negocio para mi tienda', 'que ideas tienes para mi negocio', 'que me aconsejas para crecer', 'como puedo expandirme', 'que oportunidades de crecimiento tengo',
      'donde puedo crecer', 'en que puedo crecer', 'que oportunidades ves en mi negocio', 'como hago para que mi negocio vaya mejor', 'ruta para crecer', 'dame un plan de crecimiento', 'hazme un plan de crecimiento', 'asesorame para crecer', 'asesoria para crecer', 'quiero ideas de expansion'
    ]));

  // ¿ya puedo abrir otra sucursal?
  sumar('sucursal', [
    'quiero abrir otra sucursal', 'debo abrir otra sucursal', 'estoy listo para abrir otra sucursal', 'ya puedo abrir otro local', 'conviene abrir otra sucursal', 'abrir una segunda sucursal', 'abrir un segundo local', 'expandirme a otra sucursal', 'abrir otra tienda',
    'es buen momento para expandirme', 'es momento de abrir otro local', 'puedo abrir otra sucursal', 'estoy listo para expandirme', 'ya es hora de abrir otra sucursal', 'me conviene abrir otro local', 'abro otra sucursal', 'abro otro local', 'es buena idea abrir otra sucursal',
    'tengo para abrir otra sucursal', 'mi negocio aguanta otra sucursal', 'mi negocio esta listo para otra sucursal', 'estoy para abrir otra sucursal', 'cuando abro otra sucursal', 'cuando puedo abrir otro local', 'debo abrir otro local', 'conviene abrir otro local', 'abrir una sucursal nueva',
    'ya toca abrir otra sucursal', 'quiero abrir un segundo negocio', 'quiero abrir otro punto de venta', 'es tiempo de abrir otra sucursal', 'estoy listo para una segunda sucursal', 'diagnostico para abrir una sucursal', 'mi negocio da para otra sucursal', 'franquicia mi negocio', 'convertir mi negocio en franquicia'
  ]);

  // plan de la semana / plan de acción
  sumar('plan_semana', [
    'dame un plan para la semana', 'plan de la semana', 'que hago esta semana', 'plan de accion', 'dame un plan de accion', 'armame un plan', 'plan para este mes', 'que hago esta semana para mejorar', 'cual es el plan', 'plan para mejorar mi negocio', 'dame un plan paso a paso', 'hazme un plan',
    'plan semanal', 'plan de trabajo para la semana', 'que hago hoy esta semana y este mes', 'dame un plan para este mes', 'armame un plan de accion', 'quiero un plan', 'necesito un plan', 'preparame un plan', 'plan para mi negocio', 'cual es mi plan de accion', 'ponme tareas para la semana',
    'que tareas tengo esta semana', 'dame tareas para mejorar mi negocio', 'organizame la semana', 'planeame la semana', 'que debo hacer esta semana', 'agenda de mejoras', 'lista de pendientes para mejorar', 'checklist para mejorar mi negocio', 'ordena las ideas en un plan', 'convierte eso en un plan', 'ponlo en un plan'
  ]);

  // seguimiento de la idea que acaba de dar: ¿cómo la hago?
  sumar('como_hacerlo', [
    'como lo hago', 'como hago eso', 'como lo pongo en practica', 'como empiezo con eso', 'como empiezo con la primera', 'como hago la primera', 'como hago la primera idea', 'como lo implemento', 'como lo aplico', 'explicame como hacerlo', 'dime como hacerlo', 'paso a paso',
    'como se hace eso', 'y como lo hago', 'y eso como lo hago', 'como pongo eso en marcha', 'que pasos sigo', 'como la hago', 'como lo llevo a cabo', 'como lo hago en puve', 'como hago eso en puve', 'como le hago con eso', 'como arranco con eso', 'como arranco con la primera', 'dime los pasos',
    'cuales son los pasos', 'dame los pasos', 'que hago primero con eso', 'como le empiezo', 'y como empiezo con esa idea', 'como pongo en marcha esa idea', 'ensename como hacerlo', 'como lo realizo', 'como ejecuto esa idea', 'detalla los pasos', 'dame el paso a paso', 'como lo configuro',
    'como hago la idea', 'como hago esa idea', 'y como se hace', 'como lo hacemos', 'como empiezo con esa'
  ]);

  // seguimiento: ¿por qué me dices eso? / ¿en qué datos te basas?
  sumar('porque_idea', [
    'por que me recomiendas eso', 'por que me dices eso', 'por que esa idea', 'en que te basas', 'en que datos te basas', 'de donde sacas eso', 'por que crees que funcionaria', 'por que eso', 'como sabes eso', 'con que numeros', 'con que cifras', 'que datos usaste', 'como calculaste eso',
    'como llegaste a eso', 'por que lo recomiendas', 'y eso por que', 'explicame por que me lo recomiendas', 'cuanto ganaria con eso', 'cuanto dejaria eso', 'cuanto podria ganar con eso', 'de donde sale ese numero', 'de donde sale esa cifra', 'en que numeros te apoyas', 'que supones para decir eso',
    'por que', 'y por que', 'por que dices eso', 'por que lo dices', 'por que me sugieres eso', 'por que esa y no otra', 'por que primero esa', 'por que esa primero', 'que evidencia tienes', 'demuestramelo', 'como llegaste a ese calculo', 'por que me aconsejas eso', 'en que se basa esa idea', 'que datos respaldan eso', 'cuanto dinero me dejaria esa idea',
    'y de cuanto seria la ganancia', 'cual es la ganancia de esa idea', 'que tan seguro es eso', 'es seguro que funciona', 'seguro que funciona esa idea'
  ]);

  // seguimiento: dame otra idea
  sumar('otra_idea', [
    'dame otra idea', 'otra idea', 'otra mas', 'dame otra', 'que otra idea tienes', 'hay mas ideas', 'mas ideas', 'y que otra cosa puedo hacer', 'alguna otra idea', 'otra opcion', 'y otra', 'que mas se te ocurre', 'siguiente idea', 'dame mas ideas', 'tienes mas ideas',
    'que mas puedo hacer', 'y que mas', 'otra sugerencia', 'otra recomendacion', 'dame otra recomendacion', 'dame otra sugerencia', 'otra alternativa', 'dame otra alternativa', 'que otra opcion hay', 'y la siguiente', 'pasame la siguiente idea', 'cual sigue', 'muestrame otra idea',
    'dame una idea diferente', 'una idea distinta', 'algo diferente', 'que otras ideas hay', 'dame otras ideas', 'dime otra idea', 'otra idea mas', 'sigue con otra idea', 'dame la siguiente idea', 'tienes otra idea', 'quiero otra idea'
  ]);
})();
