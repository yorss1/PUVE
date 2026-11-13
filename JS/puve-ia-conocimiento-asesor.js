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
    'dame un plan para la semana', 'plan de la semana', 'plan de accion', 'dame un plan de accion', 'armame un plan', 'plan para este mes', 'que hago esta semana para mejorar', 'cual es el plan', 'plan para mejorar mi negocio', 'dame un plan paso a paso', 'hazme un plan',
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
    'por que me recomiendas eso', 'por que me dices eso', 'por que esa idea', 'en que te basas', 'en que datos te basas', 'por que crees que funcionaria', 'por que eso', 'con que numeros', 'con que cifras', 'que datos usaste', 'como calculaste eso',
    'como llegaste a eso', 'por que lo recomiendas', 'y eso por que', 'explicame por que me lo recomiendas', 'cuanto ganaria con eso', 'cuanto dejaria eso', 'cuanto podria ganar con eso', 'de donde sale ese numero', 'de donde sale esa cifra', 'en que numeros te apoyas', 'que supones para decir eso',
    'por que', 'y por que', 'por que dices eso', 'por que lo dices', 'por que me sugieres eso', 'por que esa y no otra', 'por que primero esa', 'por que esa primero', 'que evidencia tienes', 'demuestramelo', 'como llegaste a ese calculo', 'por que me aconsejas eso', 'en que se basa esa idea', 'que datos respaldan eso', 'cuanto dinero me dejaria esa idea',
    'y de cuanto seria la ganancia', 'cual es la ganancia de esa idea', 'que tan seguro es eso', 'es seguro que funciona', 'seguro que funciona esa idea'
  ]);

  // seguimiento: dame otra idea
  sumar('otra_idea', [
    'dame otra idea', 'otra idea', 'otra mas', 'dame otra', 'que otra idea tienes', 'hay mas ideas', 'mas ideas', 'y que otra cosa puedo hacer', 'alguna otra idea', 'otra opcion', 'y otra', 'que mas se te ocurre', 'siguiente idea', 'dame mas ideas', 'tienes mas ideas',
    'que mas puedo hacer', 'otra sugerencia', 'otra recomendacion', 'dame otra recomendacion', 'dame otra sugerencia', 'otra alternativa', 'dame otra alternativa', 'que otra opcion hay', 'y la siguiente', 'pasame la siguiente idea', 'cual sigue', 'muestrame otra idea',
    'dame una idea diferente', 'una idea distinta', 'algo diferente', 'que otras ideas hay', 'dame otras ideas', 'dime otra idea', 'otra idea mas', 'sigue con otra idea', 'dame la siguiente idea', 'tienes otra idea', 'quiero otra idea'
  ]);

  // ===== Etapa 2: memoria del negocio (metas e ideas que se prueban) =====
  sumar('fijar_meta', [].concat(
    X([['mi meta es', 'mi meta del mes es', 'mi meta mensual es', 'mi meta diaria es', 'mi objetivo es', 'guarda mi meta de', 'recuerda mi meta de', 'fija mi meta en', 'pon mi meta en', 'anota mi meta de', 'establece mi meta en', 'cambia mi meta a', 'actualiza mi meta a', 'mi nueva meta es', 'nueva meta de'], ['80 mil', '5 mil', '100 mil', '3000', '50 mil', '120 mil', '10 mil'], ['', 'al mes', 'por dia', 'diarios', 'mensuales']], 45),
    ['quiero vender 90 mil al mes', 'quiero llegar a 100 mil al mes', 'registra mi meta de ventas', 'mi meta es vender 80 mil al mes', 'guarda mi meta de 50 mil al mes', 'recuerda mi meta de 5 mil diarios', 'mi meta es 5 mil por dia', 'quiero vender 3 mil diarios', 'mi objetivo del mes es 70 mil', 'quiero que mi meta sea 60 mil al mes']));
  sumar('avance_meta', [
    'como voy con mi meta', 'como voy con la meta', 'voy bien con mi meta', 'cuanto me falta para la meta', 'como va mi meta', 'voy a llegar a mi meta', 'ya llegue a mi meta', 'alcanzo mi meta', 'que tal voy con mi meta', 'que tan lejos estoy de mi meta',
    'avance de mi meta', 'mi meta como va', 'estoy cerca de mi meta', 'cuanto llevo de mi meta', 'progreso de mi meta', 'voy a cumplir mi meta', 'cumplire mi meta este mes', 'como voy con mi meta del mes', 'cual es mi meta', 'recuerdas mi meta', 'voy a lograr mi meta',
    'como voy con mi objetivo', 'ya cumpli mi meta', 'estoy llegando a mi meta', 'que tan cerca estoy de mi meta'
  ]);
  sumar('borrar_meta', ['olvida mi meta', 'borra mi meta', 'quita mi meta', 'elimina mi meta', 'ya no quiero esa meta', 'cancela mi meta', 'borra la meta', 'quita la meta', 'deja de recordar mi meta', 'no quiero meta', 'olvida la meta', 'elimina la meta', 'ya no quiero tener meta', 'borra mis metas', 'olvida mis metas']);
  sumar('idea_probar', [
    'voy a probarla', 'la voy a probar', 'voy a probar esa idea', 'ya la aplique', 'ya lo hice', 'ya la hice', 'ya probe esa idea', 'ya empece con esa idea', 'la voy a aplicar', 'voy a aplicarla', 'voy a hacerla', 'me late voy a probarla', 'ya puse el combo', 'ya lo puse', 'empiezo con esa idea', 'empiezo hoy con esa',
    'ya empece', 'voy a empezar con esa idea', 'la pruebo esta semana', 'ya la estoy probando', 'ya estoy probando esa idea', 'ya lo estoy haciendo', 'anota que la voy a probar', 'registra que la probe', 'recuerda que la voy a probar', 'marca la idea como aplicada', 'la hice ayer', 'la aplique hoy',
    'voy a probar esa', 'esa si la voy a probar', 'esa si la hago', 'esa idea me gusto la voy a probar', 'ya subi el precio', 'ya hice el combo', 'ya hice la oferta', 'ya cambie el precio', 'empece a probarla', 'voy a empezar a probarla'
  ]);
  sumar('idea_descartar', [
    'descarta esa idea', 'esa idea no', 'no me sirve esa idea', 'no me convence esa idea', 'esa no me late', 'no la voy a hacer', 'no voy a hacer eso', 'esa no aplica en mi negocio', 'no aplica para mi negocio', 'no quiero hacer esa idea', 'esa idea no va conmigo', 'esa no es para mi', 'quita esa idea', 'borra esa idea',
    'ya no me muestres esa idea', 'no me vuelvas a sugerir eso', 'no me recomiendes eso otra vez', 'descartala', 'descarta la idea', 'no me interesa esa idea', 'esa no me conviene', 'no es viable esa idea', 'esa idea no me sirve', 'no quiero esa idea', 'olvida esa idea', 'esa no la quiero', 'no la quiero hacer'
  ]);
  sumar('resultado_idea', [
    'funciono lo que probe', 'funciono esa idea', 'funciono lo del combo', 'como me fue con la idea', 'como me fue con lo que probe', 'ya funciono', 'que resultado dio la idea', 'que resultado dio eso', 'sirvio la idea que probe', 'sirvio lo del combo', 'mejoraron mis ventas con la idea', 'fue buena idea lo que probe',
    'dio resultado la idea', 'dio resultado lo que probe', 'cual fue el resultado de la idea', 'resultado de la idea que probe', 'funciono el cambio de precio', 'funciono la oferta', 'funciono la promo', 'funciono lo del precio', 'funciono el combo', 'sirvio el combo', 'como salio la idea', 'ya se noto el cambio', 'se nota el cambio',
    'funciono lo que hice', 'sirvio lo que hice', 'que tal salio lo que probe', 'ya hay resultados de la idea', 'hubo resultados con la idea'
  ]);
  sumar('seguimiento', [
    'como van mis ideas', 'que ideas he probado', 'que ideas estoy probando', 'mi seguimiento', 'seguimiento de mis ideas', 'estado de mis ideas', 'como van las ideas que probe', 'que recuerdas de mi negocio', 'que tienes guardado de mi negocio', 'que memoria tienes de mi negocio', 'que has guardado de mi negocio', 'dime lo que recuerdas',
    'resumen de mis ideas', 'muestrame mis ideas', 'mis ideas en marcha', 'cuales ideas probe', 'lista de ideas que probe', 'que ideas descarte', 'que ideas he aplicado', 'avance de mis ideas', 'como van mis pruebas', 'que tienes anotado de mi negocio', 'que ideas llevo probadas', 'cuantas ideas he probado', 'que recuerdas de mis ideas'
  ]);
  sumar('olvidar_memoria', [
    'olvida todo lo de mi negocio', 'borra tu memoria de mi negocio', 'borra todo lo que recuerdas', 'olvida todo lo que sabes de mi negocio', 'borra todo lo que guardaste', 'elimina tu memoria', 'reinicia tu memoria', 'olvida mis metas e ideas', 'borra mis metas e ideas', 'si olvida todo lo de mi negocio',
    'si borra todo lo que recuerdas', 'si borra tu memoria de mi negocio', 'si olvida todo', 'si borra todo', 'borra todo lo de mi negocio', 'olvida todo lo que guardaste', 'elimina todo lo que recuerdas', 'quiero que olvides todo lo de mi negocio', 'borra la memoria del negocio', 'olvidalo todo'
  ]);

  // ===== Etapa 3: te pone al día (qué cambió desde tu última visita) =====
  sumar('novedades', [
    'que hay de nuevo', 'que paso mientras no estaba', 'novedades de mi negocio', 'algo que deba saber', 'que me perdi', 'hay algo urgente', 'alguna alerta', 'como amanecio mi negocio', 'hay novedades', 'dame las novedades',
    'que cambio desde ayer', 'que ha pasado en mi negocio', 'que ha cambiado desde mi ultima visita', 'alertas de mi negocio', 'hay algo que deba atender', 'que hay pendiente', 'mantenme informado', 'que paso desde la ultima vez',
    'desde la ultima vez que entre que paso', 'que paso desde mi ultima visita', 'que me perdi desde ayer', 'ponme al dia de mi negocio', 'dime las novedades', 'tienes novedades', 'hay algo nuevo en mi negocio', 'que novedades hay',
    'algo importante que deba saber', 'hay algo importante', 'que necesita mi atencion', 'que requiere mi atencion', 'avisame si hay algo', 'que pendientes tengo en el negocio', 'que paso desde que no entro', 'que paso mientras no entre'
  ]);
})();
