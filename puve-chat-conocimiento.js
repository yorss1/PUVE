// =====================================================
// PUVE - Base de conocimiento del chatbot de Atencion a cliente
// =====================================================
// Este archivo define UNA sola variable global: BASE_CONOCIMIENTO_PUVE.
// No llama a ningun servidor ni a ninguna IA -- es una lista de
// preguntas posibles ("patrones": palabras o frases que se buscan
// dentro de lo que escribe el usuario) con su respuesta ya escrita.
// El emparejamiento (buscarRespuestaFAQ, dentro de index.html) ya no
// exige la frase exacta: si no encuentra el patron completo, cuenta
// cuantas palabras clave del patron aparecen en lo que escribio el
// usuario, así que preguntas formuladas distinto igual encuentran
// respuesta.
//
// Las preguntas que el bot NO logra responder se guardan solas en
// la tabla preguntas_sin_respuesta (Supabase) para revisarlas despues
// y agregarlas aqui -- así este archivo crece con el tiempo.
//
// PARA AGREGAR UNA PREGUNTA NUEVA:
//   Copia un objeto de abajo y agrega el tuyo al arreglo. No hace
//   falta tocar nada mas -- index.html ya lo carga automaticamente.
//   - "patrones": entre mas variantes (sinonimos, forma informal,
//     errores comunes de dedo) mejor detecta la pregunta.
//   - "respuesta": lo que contesta el bot.
//   - "seccion" (opcional): si la respuesta corresponde a una
//     pantalla concreta de PUVE, agrega su identificador aqui y el
//     bot ofrece un boton "Ir a [seccion] ->". Los identificadores
//     validos son: vender, productos, corte, devoluciones, gastos,
//     analitica, dispositivos, config, fiscal.

const BASE_CONOCIMIENTO_PUVE = [
  {
    "patrones": [
      "hola",
      "buenas",
      "buenos dias",
      "buenos días",
      "buenas tardes",
      "buenas noches",
      "hey",
      "ola",
      "saludos",
      "que tal",
      "qué tal",
      "buen dia",
      "buen día",
      "holaa",
      "holis"
    ],
    "respuesta": "¡Hola! Soy el asistente de PUVE. Pregúntame cómo usar alguna función, o usa los botones de abajo para reportar un problema o mandar una sugerencia."
  },
  {
    "patrones": [
      "gracias",
      "muchas gracias",
      "ok gracias",
      "perfecto gracias",
      "genial gracias",
      "excelente gracias",
      "mil gracias",
      "gracias por la ayuda"
    ],
    "respuesta": "De nada, aquí ando si necesitas algo más."
  },
  {
    "patrones": [
      "adios",
      "hasta luego",
      "nos vemos",
      "bye",
      "me voy",
      "hasta pronto"
    ],
    "respuesta": "¡Hasta luego! Vuelve cuando quieras."
  },
  {
    "patrones": [
      "quien eres",
      "eres un robot",
      "eres una ia",
      "eres humano",
      "con quien hablo",
      "eres inteligencia artificial",
      "eres chatgpt",
      "eres claude"
    ],
    "respuesta": "Soy el asistente de ayuda de PUVE: respondo con información ya preparada sobre el sistema, y puedo mandar tus reportes o sugerencias directo al equipo. No soy una inteligencia artificial generativa — mis respuestas están escritas de antemano para ser siempre precisas sobre cómo funciona PUVE."
  },
  {
    "patrones": [
      "ayuda",
      "necesito ayuda",
      "no se que hacer",
      "no sé qué hacer",
      "estoy perdido",
      "no entiendo nada",
      "me puedes ayudar",
      "me ayudas"
    ],
    "respuesta": "Cuéntame qué parte de PUVE te genera duda (ventas, corte de caja, productos, gastos, clientes, configuración...) y te explico paso a paso. También puedes usar los botones de abajo si prefieres reportar algo directamente."
  },
  {
    "patrones": [
      "que puedes hacer",
      "que sabes hacer",
      "en que me puedes ayudar",
      "para que sirves",
      "cuales son tus funciones"
    ],
    "respuesta": "Puedo explicarte cómo usar cualquier función de PUVE (ventas, corte de caja, productos, gastos, clientes, crédito, analítica, dispositivos, configuración, declaración SAT), y puedo mandar directo al equipo un problema que estés teniendo o una sugerencia de mejora."
  },
  {
    "patrones": [
      "crear cuenta",
      "registrarme",
      "como me registro",
      "cómo me registro",
      "abrir cuenta",
      "dar de alta mi negocio",
      "registrar mi negocio",
      "quiero registrarme"
    ],
    "respuesta": "Desde la pantalla de inicio toca \"Crear cuenta\", captura el nombre de tu negocio, tu correo y una contraseña. Con eso queda tu negocio dado de alta y tú como encargado."
  },
  {
    "patrones": [
      "iniciar sesion",
      "iniciar sesión",
      "no puedo entrar",
      "como entro",
      "cómo entro",
      "login no funciona",
      "no me deja iniciar sesion",
      "no me deja entrar",
      "no puedo iniciar sesion"
    ],
    "respuesta": "Si eres el encargado, entras con tu correo y contraseña. Si eres cajero, entras con el código de caja que te dio tu encargado (sin correo ni contraseña). Revisa que estés escribiendo el correo exacto con el que te registraste."
  },
  {
    "patrones": [
      "olvide mi contraseña",
      "olvidé mi contraseña",
      "recuperar contraseña",
      "reset de contraseña",
      "cambiar contraseña",
      "no recuerdo mi contraseña",
      "se me olvido la contraseña"
    ],
    "respuesta": "En la pantalla de inicio de sesión hay una opción \"¿Olvidaste tu contraseña?\" — te llega un correo para crear una nueva. Si no te llega, revisa spam o correo no deseado."
  },
  {
    "patrones": [
      "no me llega el correo de verificacion",
      "no me llega el correo",
      "revisar correo de confirmacion",
      "correo de bienvenida",
      "no me llega el correo de bienvenida"
    ],
    "respuesta": "Revisa tu carpeta de spam o correo no deseado — a veces el correo de verificación llega ahí. Si después de unos minutos sigue sin llegar, usa el chat para reportarlo y lo revisamos."
  },
  {
    "patrones": [
      "cambiar correo de la cuenta",
      "cambiar mi correo",
      "actualizar correo",
      "quiero cambiar mi correo electronico"
    ],
    "respuesta": "El cambio de correo de la cuenta principal lo maneja el equipo de soporte por seguridad — repórtalo con el botón de abajo y te ayudamos."
  },
  {
    "patrones": [
      "cambiar nombre del negocio",
      "como cambio el nombre de mi negocio",
      "cómo cambio el nombre de mi negocio",
      "editar nombre del negocio"
    ],
    "respuesta": "El nombre de tu negocio se cambia desde Configuración, en los datos generales.",
    "seccion": "config"
  },
  {
    "patrones": [
      "cerrar sesion",
      "cerrar sesión",
      "salir de la cuenta",
      "como me desconecto",
      "cómo me desconecto",
      "como salgo de la app",
      "cómo salgo de la app"
    ],
    "respuesta": "Para cerrar sesión, ve al menú de tu perfil (arriba a la derecha) y toca \"Cerrar sesión\"."
  },
  {
    "patrones": [
      "diferencia entre encargado y cajero",
      "roles",
      "permisos de cajero",
      "que puede ver el cajero",
      "qué puede ver el cajero",
      "que puede hacer el encargado",
      "qué puede hacer el encargado",
      "tipos de usuario",
      "roles del sistema"
    ],
    "respuesta": "El \"Encargado\" ve todo: Configuración, Analítica, Gastos, Declaración SAT y Dispositivos, y puede autorizar crédito. El \"Cajero\" solo ve Nueva venta, Productos, Corte de caja y, si están activas, Devoluciones — puede vender a crédito dentro del límite ya autorizado, pero no puede cambiar límites ni ver Analítica."
  },
  {
    "patrones": [
      "cuantos encargados puede tener un negocio",
      "cuántos encargados puede tener un negocio",
      "puedo tener dos administradores",
      "otro encargado",
      "agregar otro encargado"
    ],
    "respuesta": "Por ahora cada negocio tiene un solo correo de encargado (la cuenta con la que te registraste). Los cajeros adicionales se agregan como códigos de caja desde Dispositivos.",
    "seccion": "dispositivos"
  },
  {
    "patrones": [
      "puedo usar puve en varios dispositivos a la vez",
      "usar puve en dos celulares",
      "misma cuenta en dos dispositivos"
    ],
    "respuesta": "Sí, puedes iniciar sesión en varios dispositivos al mismo tiempo, hasta el límite que permita tu plan — lo ves en Dispositivos.",
    "seccion": "dispositivos"
  },
  {
    "patrones": [
      "funciona en iphone",
      "funciona en android",
      "en que celulares funciona",
      "en qué celulares funciona",
      "sirve en tablet",
      "se puede usar en computadora",
      "funciona en pc",
      "necesito descargar una app",
      "hay app para android",
      "hay app para iphone",
      "hay aplicacion movil",
      "hay app"
    ],
    "respuesta": "PUVE funciona directo desde el navegador (Chrome, Safari, etc.), sin necesidad de descargar nada — funciona en celular, tablet o computadora, sea Android, iPhone o Windows."
  },
  {
    "patrones": [
      "como actualizo la app",
      "necesito actualizar puve",
      "hay una nueva version"
    ],
    "respuesta": "No tienes que actualizar nada manualmente — al ser una app web, cada vez que la abres ya estás usando la versión más reciente."
  },
  {
    "patrones": [
      "cuanto cuesta puve",
      "cuánto cuesta puve",
      "precio del plan",
      "cuanto pago al mes",
      "cuánto pago al mes",
      "planes disponibles",
      "cuanto cuesta el plan",
      "cuánto cuesta el plan",
      "precios",
      "cuanto pago por cada cajero",
      "cuanto cobran",
      "cuanto cobran al mes",
      "cuanto cobran por puve",
      "precio de puve",
      "cuanto es la mensualidad"
    ],
    "respuesta": "El costo depende del plan y de cuántos dispositivos (cajas) necesites — lo ves reflejado en la sección Dispositivos y al momento de renovar tu plan.",
    "seccion": "dispositivos"
  },
  {
    "patrones": [
      "como pago mi plan",
      "cómo pago mi plan",
      "ya pague donde lo reporto",
      "ya pagué donde lo reporto",
      "ficha de deposito",
      "ficha de depósito",
      "como reporto mi pago",
      "cómo reporto mi pago",
      "marcar pago como enviado",
      "como realizo mis pagos",
      "como realizo el pago",
      "como efectuo mi pago",
      "forma de pago de puve",
      "metodo de pago del plan",
      "ya hice mi pago",
      "ya realice mi pago",
      "ya deposite",
      "ya transferi mi pago"
    ],
    "respuesta": "Cuando te toca renovar, PUVE te muestra los datos bancarios para hacer tu depósito o transferencia. Después de pagar, toca \"Ya realicé mi pago\" para marcarlo en revisión — en cuanto se confirme, tu cuenta se reactiva sola."
  },
  {
    "patrones": [
      "mi cuenta esta suspendida",
      "mi cuenta está suspendida",
      "no puedo usar puve",
      "cuenta bloqueada",
      "se vencio mi plan",
      "se venció mi plan",
      "no me deja vender por el plan",
      "cuenta suspendida por pago"
    ],
    "respuesta": "Si tu cuenta aparece suspendida es porque el pago del periodo actual no se ha confirmado. Revisa si ya reportaste tu pago; si no, hazlo desde el aviso que te muestra la app. Si ya pagaste y sigue bloqueada, repórtalo con el botón de abajo."
  },
  {
    "patrones": [
      "cuanto tarda en confirmarse mi pago",
      "cuánto tarda en confirmarse mi pago",
      "cuanto tarda en activarse mi cuenta",
      "cuánto tarda en activarse mi cuenta"
    ],
    "respuesta": "La confirmación depende de que el equipo de PUVE verifique el depósito en la cuenta bancaria — normalmente se revisa el mismo día hábil."
  },
  {
    "patrones": [
      "puedo cancelar mi plan",
      "como cancelo mi cuenta",
      "dar de baja mi negocio",
      "ya no quiero usar puve"
    ],
    "respuesta": "Si decides dejar de usar PUVE, simplemente no renuevas tu plan al vencerse — tus datos se conservan por un tiempo por si decides regresar. Si quieres darte de baja definitivamente, repórtalo con el botón de abajo."
  },
  {
    "patrones": [
      "cambiar de plan",
      "subir de plan",
      "necesito mas cajeros",
      "necesito más cajeros",
      "ampliar mi plan",
      "quiero mas cajeros",
      "quiero agregar mas cajeros a mi plan"
    ],
    "respuesta": "Para cambiar de plan o ampliar el número de dispositivos permitidos, repórtalo con el botón de abajo y el equipo te apoya con el cambio."
  },
  {
    "patrones": [
      "hacer una venta",
      "nueva venta",
      "como vendo",
      "cómo vendo",
      "como cobro",
      "cómo cobro",
      "cobrar un producto",
      "agregar producto al carrito",
      "carrito de venta",
      "como se vende",
      "cómo se vende",
      "proceso de venta",
      "pasos para vender",
      "como hago una venta",
      "como cobro una venta",
      "como cobro a un cliente"
    ],
    "respuesta": "Ve a \"Nueva venta\", busca el producto o escanéalo con la cámara para agregarlo al carrito, elige el método de pago y presiona Cobrar. Se genera un ticket con código QR para el cliente.",
    "seccion": "vender"
  },
  {
    "patrones": [
      "quitar producto del carrito",
      "borrar producto del carrito",
      "me equivoque al agregar un producto",
      "me equivoqué al agregar un producto",
      "cambiar cantidad en el carrito",
      "reducir cantidad en el carrito"
    ],
    "respuesta": "En el carrito de \"Nueva venta\", cada producto tiene controles para subir o bajar la cantidad, y una opción para quitarlo por completo si te equivocaste.",
    "seccion": "vender"
  },
  {
    "patrones": [
      "cancelar una venta",
      "deshacer una venta ya cobrada",
      "me equivoque al cobrar",
      "me equivoqué al cobrar",
      "venta duplicada",
      "anular una venta"
    ],
    "respuesta": "Una venta ya cobrada no se puede \"deshacer\" directamente — si el error ya se cobró, la forma correcta de corregirlo es con una Devolución (si el módulo está activo) o reportándolo con el botón de abajo si es un caso especial.",
    "seccion": "devoluciones"
  },
  {
    "patrones": [
      "buscar un producto en la venta",
      "no encuentro un producto al vender",
      "filtrar productos",
      "buscador de productos"
    ],
    "respuesta": "En \"Nueva venta\" hay una barra de búsqueda arriba de la lista de productos — escribe el nombre y se filtra al momento. Si tienes categorías activas, también puedes filtrar por categoría.",
    "seccion": "vender"
  },
  {
    "patrones": [
      "escanear codigo de barras",
      "escanear código de barras",
      "escaner",
      "escáner",
      "como escaneo",
      "cómo escaneo",
      "leer codigo de barras",
      "leer código de barras",
      "camara no funciona",
      "cámara no funciona",
      "no abre la camara",
      "no abre la cámara",
      "no reconoce el codigo de barras",
      "no reconoce el código de barras"
    ],
    "respuesta": "En \"Nueva venta\" toca el ícono de escáner y apunta la cámara al código de barras del producto. Si la cámara no abre, revisa que el navegador tenga permiso de cámara para este sitio (en la configuración del navegador o del celular). Si el código no se reconoce, puede que el producto no tenga ese código guardado — revísalo en Productos.",
    "seccion": "vender"
  },
  {
    "patrones": [
      "imprimir ticket",
      "el ticket no se imprime",
      "ticket en papel",
      "impresora de tickets"
    ],
    "respuesta": "PUVE genera el ticket como un documento digital con QR que el cliente escanea desde su celular — no está pensado para imprimirse en una impresora de tickets física."
  },
  {
    "patrones": [
      "ticket",
      "qr del ticket",
      "el cliente no ve su ticket",
      "como ve su ticket el cliente",
      "cómo ve su ticket el cliente",
      "que es el ticket digital",
      "qué es el ticket digital"
    ],
    "respuesta": "Cada venta genera un ticket digital con un código QR — el cliente lo escanea con su celular para ver el detalle de su compra, sin necesidad de imprimir nada."
  },
  {
    "patrones": [
      "aplicar descuento a un producto",
      "descuento manual",
      "2x1",
      "promocion",
      "promoción",
      "como doy un descuento",
      "cómo doy un descuento"
    ],
    "respuesta": "Por ahora PUVE no tiene un motor de descuentos manuales o promociones automáticas dentro del carrito — es una función que está en la lista para agregarse más adelante. Si te interesa, mándanos la idea con el botón de \"Enviar una sugerencia\"."
  },
  {
    "patrones": [
      "comprar sin registrarme como cliente",
      "venta rapida",
      "venta rápida",
      "venta sin cliente"
    ],
    "respuesta": "No hay problema — el teléfono del cliente es opcional en cada venta. Si no lo capturas, la venta se hace normal, solo que no queda ligada a recompensas ni a un historial de cliente.",
    "seccion": "vender"
  },
  {
    "patrones": [
      "metodos de pago",
      "métodos de pago",
      "formas de pago",
      "que metodos de pago hay",
      "qué métodos de pago hay",
      "puedo cobrar con tarjeta",
      "acepta transferencia",
      "como cobro con tarjeta",
      "cómo cobro con tarjeta"
    ],
    "respuesta": "Puedes cobrar en Efectivo, Tarjeta, Transferencia, Mixto (parte efectivo + parte no-efectivo) o Crédito (fiado, si tienes el Directorio de clientes activado). Se elige en el desplegable de \"Nueva venta\" antes de cobrar.",
    "seccion": "vender"
  },
  {
    "patrones": [
      "pago mixto",
      "venta mixta",
      "parte efectivo parte tarjeta",
      "medio efectivo medio tarjeta",
      "como funciona el pago mixto",
      "cómo funciona el pago mixto"
    ],
    "respuesta": "Al elegir \"Mixto\" como método de pago, te pide cuánto pagó el cliente en efectivo — el resto del total se registra automáticamente como tarjeta/transferencia. Eso mantiene correcto tu corte de caja.",
    "seccion": "vender"
  },
  {
    "patrones": [
      "cambiar el metodo de pago despues de cobrar",
      "cambiar el método de pago después de cobrar",
      "me equivoque de metodo de pago",
      "me equivoqué de método de pago",
      "marque efectivo pero fue tarjeta",
      "marqué efectivo pero fue tarjeta"
    ],
    "respuesta": "El método de pago no se puede editar una vez cobrada la venta. Si te equivocaste, repórtalo con el botón de abajo detallando el folio de la venta, para que el equipo te oriente sobre cómo corregirlo en tu corte."
  },
  {
    "patrones": [
      "cambiar divisa",
      "otra moneda",
      "cobrar en dolares",
      "cobrar en dólares",
      "pesos a dolares",
      "pesos a dólares",
      "tipo de cambio",
      "cliente extranjero",
      "cobrar en euros"
    ],
    "respuesta": "En \"Nueva venta\" hay un botón \"Cliente paga en otra moneda\" que solo te muestra el total convertido (USD, EUR, etc.) como referencia — el registro de la venta siempre queda en pesos mexicanos.",
    "seccion": "vender"
  },
  {
    "patrones": [
      "cuanto cobra puve de comision",
      "cuánto cobra puve de comisión",
      "hay comision por venta",
      "hay comisión por venta",
      "cobra comision por tarjeta",
      "cobra comisión por tarjeta"
    ],
    "respuesta": "PUVE no cobra comisión por tus ventas — solo el costo de tu plan mensual o anual. Si tu terminal bancaria cobra comisión por pagos con tarjeta, esa es aparte y depende de tu banco, no de PUVE."
  },
  {
    "patrones": [
      "vender a credito",
      "vender a crédito",
      "venta a credito",
      "venta a crédito",
      "fiado",
      "fiar",
      "vender fiado",
      "le puedo fiar",
      "venderle fiado a un cliente",
      "como se fia",
      "cómo se fía"
    ],
    "respuesta": "Para vender a crédito, el cliente necesita tener ya un límite de crédito autorizado (lo activa el encargado desde Analítica → Clientes). Con eso autorizado, elige \"Crédito\" como método de pago y captura el teléfono del cliente — el sistema valida que no exceda su límite disponible.",
    "seccion": "vender"
  },
  {
    "patrones": [
      "autorizar credito",
      "autorizar crédito",
      "limite de credito",
      "límite de crédito",
      "dar credito a un cliente",
      "dar crédito a un cliente",
      "activar credito",
      "activar crédito",
      "cuanto credito tiene",
      "cuánto crédito tiene",
      "poner limite de credito",
      "poner límite de crédito"
    ],
    "respuesta": "Solo el encargado puede autorizar crédito: ve a Analítica → pestaña Clientes, busca al cliente por teléfono y toca \"Crédito\" para ponerle un límite. Un cajero puede vender dentro de ese límite, pero no puede cambiarlo.",
    "seccion": "analitica"
  },
  {
    "patrones": [
      "cobrar abono",
      "abono a credito",
      "abono a crédito",
      "cliente vino a pagar",
      "pago de su deuda",
      "pago a cuenta",
      "cliente quiere abonar",
      "como registro un abono",
      "cómo registro un abono",
      "como abono a la deuda de un cliente",
      "abonar a la deuda",
      "registrar abono"
    ],
    "respuesta": "Desde Analítica → Clientes, si el cliente tiene saldo pendiente verás el botón \"Cobrar abono\" en su fila — captura cuánto paga y el método (efectivo, tarjeta o transferencia). Si es en efectivo, ese dinero se suma automáticamente al corte de caja.",
    "seccion": "analitica"
  },
  {
    "patrones": [
      "cliente no tiene credito autorizado",
      "cliente no tiene crédito autorizado",
      "no me deja vender a credito",
      "no me deja vender a crédito",
      "credito no disponible",
      "crédito no disponible"
    ],
    "respuesta": "Si el sistema no te deja vender a crédito a alguien, es porque ese cliente aún no tiene un límite de crédito autorizado, o la venta excede lo que le queda disponible — pide al encargado que revise su límite en Analítica → Clientes.",
    "seccion": "analitica"
  },
  {
    "patrones": [
      "cuanto debe un cliente",
      "cuánto debe un cliente",
      "saldo de un cliente",
      "ver deuda de un cliente",
      "estado de cuenta de un cliente"
    ],
    "respuesta": "En Analítica → Clientes ves el saldo actual de cada cliente con crédito autorizado, junto a su límite total.",
    "seccion": "analitica"
  },
  {
    "patrones": [
      "quitarle el credito a un cliente",
      "quitarle el crédito a un cliente",
      "bajar el limite de credito",
      "bajar el límite de crédito",
      "reducir credito de un cliente"
    ],
    "respuesta": "El encargado puede editar el límite de crédito de cualquier cliente en cualquier momento desde Analítica → Clientes, incluyendo bajarlo a cero para dejar de fiarle.",
    "seccion": "analitica"
  },
  {
    "patrones": [
      "que pasa si un cliente no paga",
      "qué pasa si un cliente no paga",
      "cliente no quiere pagar su deuda",
      "cartera vencida"
    ],
    "respuesta": "PUVE lleva el registro de cuánto debe cada cliente, pero el seguimiento de cobranza (llamadas, recordatorios) lo haces tú directamente con el cliente — el sistema solo te ayuda a saber exactamente cuánto te debe cada quien.",
    "seccion": "analitica"
  },
  {
    "patrones": [
      "recompensas",
      "puntos del cliente",
      "acumular puntos",
      "canjear puntos",
      "programa de lealtad",
      "que son las recompensas",
      "qué son las recompensas"
    ],
    "respuesta": "Si activas \"Recompensas\" en Configuración, cada venta puede capturar el teléfono del cliente para sumarle puntos automáticamente; él después puede canjearlos por descuento en una compra futura.",
    "seccion": "config"
  },
  {
    "patrones": [
      "cuanto vale un punto",
      "cuánto vale un punto",
      "como se calculan los puntos",
      "cómo se calculan los puntos",
      "pesos por punto"
    ],
    "respuesta": "Tú decides ambos valores al activar Recompensas: cuántos pesos de compra equivalen a un punto, y cuánto vale ese punto al momento de canjearlo.",
    "seccion": "config"
  },
  {
    "patrones": [
      "cliente sin telefono",
      "cliente sin teléfono",
      "cliente no quiere dar su telefono",
      "cliente no quiere dar su teléfono",
      "venta anonima",
      "venta anónima"
    ],
    "respuesta": "No hay problema — si el cliente no da su teléfono, simplemente dejas ese campo vacío y la venta se hace normal, solo que no acumula puntos ni queda ligada a su historial.",
    "seccion": "vender"
  },
  {
    "patrones": [
      "directorio de clientes",
      "historial de compras de un cliente",
      "base de clientes",
      "que es el directorio de clientes",
      "qué es el directorio de clientes",
      "como agrego un cliente",
      "agregar cliente",
      "registrar un cliente",
      "dar de alta un cliente",
      "donde veo mis clientes",
      "ver mis clientes"
    ],
    "respuesta": "El \"Directorio de clientes\" (Configuración) guarda nombre e historial por teléfono, y es lo que habilita las ventas a crédito. Se activa independientemente de Recompensas.",
    "seccion": "config"
  },
  {
    "patrones": [
      "ponerle nombre a un cliente",
      "editar nombre de cliente",
      "cliente sin nombre",
      "como le pongo nombre a un cliente",
      "cómo le pongo nombre a un cliente"
    ],
    "respuesta": "En Analítica → Clientes, toca la fila del cliente para ponerle o corregirle el nombre — solo necesitas su teléfono para encontrarlo.",
    "seccion": "analitica"
  },
  {
    "patrones": [
      "borrar un cliente del directorio",
      "eliminar cliente",
      "quitar cliente de la lista"
    ],
    "respuesta": "Por ahora no hay un botón para eliminar un cliente del directorio directamente — si necesitas que se elimine uno en particular, repórtalo con el botón de abajo.",
    "seccion": "analitica"
  },
  {
    "patrones": [
      "un cliente tiene dos telefonos",
      "un cliente tiene dos teléfonos",
      "cliente cambio de numero",
      "cliente cambió de número"
    ],
    "respuesta": "Como el directorio identifica a cada cliente por su número de teléfono, si cambia de número se creará como un cliente nuevo. No hay forma de \"fusionar\" dos números como un mismo cliente por ahora.",
    "seccion": "analitica"
  },
  {
    "patrones": [
      "agregar producto",
      "crear producto",
      "dar de alta un producto",
      "como agrego productos",
      "cómo agrego productos",
      "nuevo producto"
    ],
    "respuesta": "Ve a \"Productos\" y toca \"Agregar producto\": nombre, precio, costo, stock, y opcionalmente categoría y código de barras. También puedes agregar productos por voz con el ícono del micrófono.",
    "seccion": "productos"
  },
  {
    "patrones": [
      "agregar producto por voz",
      "producto por voz",
      "microfono para productos",
      "micrófono para productos",
      "dictar producto"
    ],
    "respuesta": "En \"Productos\" toca el ícono del micrófono y dicta el nombre y precio del producto — PUVE llena el formulario por ti para que solo confirmes.",
    "seccion": "productos"
  },
  {
    "patrones": [
      "editar producto",
      "cambiar precio",
      "modificar stock",
      "actualizar inventario",
      "subir precio",
      "bajar precio",
      "como cambio el precio",
      "cómo cambio el precio"
    ],
    "respuesta": "En \"Productos\", toca el producto que quieras editar para cambiar su precio, costo, stock o cualquier otro dato.",
    "seccion": "productos"
  },
  {
    "patrones": [
      "eliminar producto",
      "borrar producto",
      "quitar producto del catalogo",
      "quitar producto del catálogo"
    ],
    "respuesta": "Dentro de \"Productos\", abre el producto y usa la opción de eliminar. Si el producto ya tiene ventas registradas, igual puedes borrarlo del catálogo — sus ventas pasadas se conservan en tu historial.",
    "seccion": "productos"
  },
  {
    "patrones": [
      "categorias de productos",
      "categorías de productos",
      "usar categorias",
      "usar categorías",
      "organizar productos por categoria",
      "organizar productos por categoría",
      "crear categoria",
      "crear categoría"
    ],
    "respuesta": "Si activas \"Categorías\" en Configuración, puedes agrupar tus productos (por ejemplo Bebidas, Abarrotes) y filtrarlos así en \"Nueva venta\".",
    "seccion": "config"
  },
  {
    "patrones": [
      "costo del producto",
      "para que sirve el costo",
      "para qué sirve el costo",
      "diferencia entre precio y costo",
      "que es el costo de un producto",
      "qué es el costo de un producto"
    ],
    "respuesta": "El \"precio\" es lo que le cobras al cliente; el \"costo\" es lo que a ti te costó ese producto. La diferencia entre ambos es tu margen, y es la base para el margen bruto y la ganancia neta en Analítica.",
    "seccion": "productos"
  },
  {
    "patrones": [
      "producto sin stock",
      "producto agotado",
      "stock en cero",
      "como se ve un producto agotado",
      "cómo se ve un producto agotado"
    ],
    "respuesta": "Cuando un producto llega a cero de stock, PUVE no te deja agregarlo al carrito hasta que actualices su cantidad en Productos. Analítica también te puede mostrar los productos con stock bajo.",
    "seccion": "productos"
  },
  {
    "patrones": [
      "codigo de barras del producto",
      "código de barras del producto",
      "asignar codigo de barras",
      "asignar código de barras",
      "producto sin codigo de barras",
      "producto sin código de barras"
    ],
    "respuesta": "Al crear o editar un producto puedes capturar su código de barras manualmente o escanearlo directo con la cámara — es un campo opcional.",
    "seccion": "productos"
  },
  {
    "patrones": [
      "producto duplicado",
      "se me duplico un producto",
      "se me duplicó un producto",
      "dos productos iguales"
    ],
    "respuesta": "Si un producto quedó duplicado por error, puedes eliminar uno de los dos desde Productos — sus datos históricos de venta se conservan aunque borres el producto del catálogo.",
    "seccion": "productos"
  },
  {
    "patrones": [
      "cuantos productos puedo tener",
      "cuántos productos puedo tener",
      "limite de productos",
      "límite de productos"
    ],
    "respuesta": "No hay un límite fijo de cuántos productos puedes dar de alta en tu catálogo.",
    "seccion": "productos"
  },
  {
    "patrones": [
      "registrar entrada de mercancia",
      "registrar entrada de mercancía",
      "ingreso de mercancia",
      "ingreso de mercancía",
      "aumentar stock por compra",
      "proveedores"
    ],
    "respuesta": "Por ahora no hay un módulo dedicado a compras o entradas de mercancía de proveedores — solo puedes ajustar el stock manualmente al editar el producto. Si te sirve, mándanos la idea con \"Enviar una sugerencia\".",
    "seccion": "productos"
  },
  {
    "patrones": [
      "corte de caja",
      "cerrar caja",
      "cuadrar caja",
      "no cuadra la caja",
      "falta dinero en caja",
      "sobra dinero en caja",
      "arqueo",
      "que es el corte de caja",
      "qué es el corte de caja"
    ],
    "respuesta": "En \"Corte de caja\" capturas el efectivo inicial, los retiros, y cuentas el efectivo físico. El sistema calcula lo esperado sumando solo ventas en efectivo (más abonos de crédito cobrados en efectivo) — las ventas con tarjeta, transferencia o crédito no cuentan ahí. Si no cuadra, revisa si hubo una venta mal marcada como efectivo cuando en realidad fue tarjeta.",
    "seccion": "corte"
  },
  {
    "patrones": [
      "como se hace un corte de caja",
      "cómo se hace un corte de caja",
      "pasos para el corte de caja",
      "cuando hago el corte de caja",
      "cuándo hago el corte de caja"
    ],
    "respuesta": "Normalmente se hace al final de cada turno: captura el efectivo con el que abriste, cualquier retiro que hiciste durante el turno, y cuenta el efectivo físico que tienes ahora. PUVE calcula si cuadra, sobra o falta.",
    "seccion": "corte"
  },
  {
    "patrones": [
      "historial de cortes",
      "cortes anteriores",
      "ver cortes pasados",
      "cortes de caja de otros dias",
      "cortes de caja de otros días"
    ],
    "respuesta": "Dentro de \"Corte de caja\" hay una tabla con los cortes anteriores, mostrando esperado, contado, tarjeta, transferencia, abonos de crédito y el resultado (cuadrado, faltante o sobrante).",
    "seccion": "corte"
  },
  {
    "patrones": [
      "que son los retiros en el corte de caja",
      "qué son los retiros en el corte de caja",
      "para que sirve el campo de retiros",
      "para qué sirve el campo de retiros"
    ],
    "respuesta": "\"Retiros\" es cualquier efectivo que sacaste de la caja durante el turno (por ejemplo para pagarle a un proveedor de contado) — se resta del efectivo esperado para que el corte sea justo.",
    "seccion": "corte"
  },
  {
    "patrones": [
      "quien puede hacer el corte de caja",
      "quién puede hacer el corte de caja",
      "el cajero puede hacer corte",
      "quien puede hacer el corte"
    ],
    "respuesta": "Tanto el cajero como el encargado pueden hacer el corte de caja de su turno.",
    "seccion": "corte"
  },
  {
    "patrones": [
      "activar corte de caja",
      "no veo corte de caja",
      "desactivar corte de caja"
    ],
    "respuesta": "Corte de caja es un módulo que se activa o desactiva desde Configuración, igual que Devoluciones o Recompensas.",
    "seccion": "config"
  },
  {
    "patrones": [
      "diferencia entre retiro y gasto",
      "retiro vs gasto",
      "es lo mismo un retiro que un gasto"
    ],
    "respuesta": "No es lo mismo: un \"retiro\" es efectivo que sale de la caja durante el turno (por ejemplo para un pago urgente) y se registra en el Corte de caja; un \"gasto\" es un gasto operativo del negocio (renta, luz, sueldos) y se registra en la sección Gastos, aparte.",
    "seccion": "corte"
  },
  {
    "patrones": [
      "devolucion",
      "devolución",
      "cliente quiere devolver",
      "regreso un producto",
      "regresó un producto",
      "como hago una devolucion",
      "cómo hago una devolución",
      "devolver un producto"
    ],
    "respuesta": "Activa \"Devoluciones\" en Configuración. Luego, en la sección Devoluciones, buscas la venta original por su folio y marcas qué producto regresó el cliente — el inventario se ajusta solo.",
    "seccion": "devoluciones"
  },
  {
    "patrones": [
      "activar devoluciones",
      "no veo devoluciones",
      "donde esta devoluciones",
      "dónde está devoluciones"
    ],
    "respuesta": "Devoluciones es un módulo opcional: actívalo desde Configuración → \"Devoluciones\" y aparecerá en el menú.",
    "seccion": "config"
  },
  {
    "patrones": [
      "no encuentro el folio de la venta",
      "donde veo el folio de una venta",
      "dónde veo el folio de una venta",
      "perdio su ticket el cliente",
      "perdió su ticket el cliente"
    ],
    "respuesta": "El folio de cada venta aparece en su ticket digital. Si el cliente no lo tiene a la mano, puedes buscar la venta en el historial correspondiente para encontrar el folio."
  },
  {
    "patrones": [
      "devolucion parcial",
      "devolución parcial",
      "devolver solo un producto de varios"
    ],
    "respuesta": "Sí se puede: al buscar la venta original, eliges específicamente qué producto (y cuántas piezas) está devolviendo el cliente, no toda la venta completa.",
    "seccion": "devoluciones"
  },
  {
    "patrones": [
      "se regresa el dinero al hacer una devolucion",
      "se regresa el dinero al hacer una devolución",
      "como se le regresa el dinero al cliente",
      "cómo se le regresa el dinero al cliente"
    ],
    "respuesta": "PUVE ajusta el inventario y el registro de la venta automáticamente, pero la devolución física del dinero al cliente (efectivo, o reverso en su tarjeta) la haces tú directamente — eso depende de tu método de pago original y de tu terminal bancaria.",
    "seccion": "devoluciones"
  },
  {
    "patrones": [
      "gastos",
      "registrar un gasto",
      "pago de renta",
      "pago de luz",
      "sueldos",
      "gasto operativo",
      "como registro un gasto",
      "cómo registro un gasto"
    ],
    "respuesta": "En \"Gastos\" registras lo que sale de tu negocio aparte de las ventas: renta, luz, agua, internet, sueldos, proveedores, mantenimiento, impuestos u otros. Sin esto, Analítica solo mostraría ingresos brutos, no tu ganancia real.",
    "seccion": "gastos"
  },
  {
    "patrones": [
      "categorias de gastos",
      "categorías de gastos",
      "que tipos de gastos hay",
      "qué tipos de gastos hay",
      "clasificar un gasto"
    ],
    "respuesta": "Las categorías disponibles son: renta, luz, agua, internet, sueldos, proveedores, mantenimiento, impuestos y otros.",
    "seccion": "gastos"
  },
  {
    "patrones": [
      "editar un gasto",
      "borrar un gasto",
      "eliminar gasto",
      "me equivoque en un gasto",
      "me equivoqué en un gasto"
    ],
    "respuesta": "En \"Gastos\", cada gasto registrado tiene una opción para eliminarlo si te equivocaste — vuelve a capturarlo correctamente después.",
    "seccion": "gastos"
  },
  {
    "patrones": [
      "quien puede ver gastos",
      "quién puede ver gastos",
      "el cajero ve los gastos"
    ],
    "respuesta": "La sección Gastos solo la ve el encargado, no el cajero — es información financiera del negocio.",
    "seccion": "gastos"
  },
  {
    "patrones": [
      "gasto recurrente",
      "gasto que se repite cada mes",
      "programar un gasto fijo"
    ],
    "respuesta": "Por ahora cada gasto se registra manualmente cada vez, no hay una opción para programar gastos recurrentes automáticos. Si te interesa esa función, mándanos la idea con \"Enviar una sugerencia\".",
    "seccion": "gastos"
  },
  {
    "patrones": [
      "ganancia neta",
      "utilidad neta",
      "cuanto estoy ganando de verdad",
      "cuanto gane este mes",
      "cuanto vendi este mes",
      "ver mis ganancias",
      "cuánto estoy ganando de verdad",
      "margen",
      "que es la ganancia neta",
      "qué es la ganancia neta"
    ],
    "respuesta": "En Analítica verás \"Margen bruto\" (ingresos menos costo de producto) y \"Ganancia neta estimada\" (margen bruto menos tus gastos registrados) — esa segunda cifra es la que refleja tu ganancia real.",
    "seccion": "analitica"
  },
  {
    "patrones": [
      "analitica",
      "analítica",
      "que muestra analitica",
      "qué muestra analítica",
      "reportes de ventas",
      "ver mis ventas del mes",
      "productos mas vendidos",
      "productos más vendidos",
      "que es analitica",
      "qué es analítica",
      "donde veo mis ventas",
      "ver historial de ventas",
      "reporte de ventas",
      "ventas de hoy",
      "cuanto vendi hoy",
      "cuanto he vendido"
    ],
    "respuesta": "Analítica (solo para el encargado) muestra ventas, ingresos, ticket promedio, margen, gastos y ganancia neta del periodo, además de productos más vendidos, ventas por cajero y, si tienes Recompensas o el Directorio de clientes, una pestaña de Clientes.",
    "seccion": "analitica"
  },
  {
    "patrones": [
      "ventas por cajero",
      "saber quien vendio mas",
      "saber quién vendió más",
      "rendimiento de mis cajeros"
    ],
    "respuesta": "En Analítica puedes ver el desglose de ventas por cada cajero, para saber quién vendió más en el periodo que elijas.",
    "seccion": "analitica"
  },
  {
    "patrones": [
      "cambiar periodo de analitica",
      "cambiar periodo de analítica",
      "ver ventas de otro mes",
      "analitica de hoy",
      "analítica de hoy",
      "analitica de la semana",
      "analítica de la semana"
    ],
    "respuesta": "Arriba de Analítica hay un selector de periodo (hoy, semana, mes, o el rango que elijas) para ver los números de ese periodo específico.",
    "seccion": "analitica"
  },
  {
    "patrones": [
      "stock bajo",
      "que productos se me estan acabando",
      "qué productos se me están acabando",
      "alerta de inventario",
      "cuantas piezas me quedan",
      "cuanto stock tengo",
      "ver mi inventario",
      "como veo el stock",
      "como veo mi inventario",
      "cuantos productos me quedan"
    ],
    "respuesta": "Analítica incluye una vista de productos con stock bajo, para que sepas qué reponer antes de que se agote.",
    "seccion": "analitica"
  },
  {
    "patrones": [
      "ticket promedio",
      "que es el ticket promedio",
      "qué es el ticket promedio"
    ],
    "respuesta": "El \"ticket promedio\" es el resultado de dividir tus ingresos totales del periodo entre el número de ventas — te dice cuánto gasta en promedio cada cliente por visita.",
    "seccion": "analitica"
  },
  {
    "patrones": [
      "exportar reporte de ventas",
      "descargar reporte de analitica",
      "descargar reporte de analítica"
    ],
    "respuesta": "Por ahora Analítica se consulta directo en pantalla; la Declaración SAT sí se puede descargar en PDF. Si necesitas exportar los reportes de Analítica también, mándanos la sugerencia.",
    "seccion": "analitica"
  },
  {
    "patrones": [
      "declaracion sat",
      "declaración sat",
      "declaracion fiscal",
      "declaración fiscal",
      "iva",
      "isr",
      "para mi contador",
      "resumen fiscal",
      "que es la declaracion sat",
      "qué es la declaración sat"
    ],
    "respuesta": "La Declaración SAT arma un resumen de ingresos, devoluciones, costo de lo vendido, utilidad, gastos operativos, IVA e ISR estimado de un periodo — es un apoyo para tu contador, no sustituye la declaración oficial.",
    "seccion": "fiscal"
  },
  {
    "patrones": [
      "descargar declaracion en pdf",
      "descargar declaración en pdf",
      "exportar declaracion",
      "exportar declaración",
      "pdf de la declaracion",
      "pdf de la declaración",
      "descargar declaracion",
      "bajar declaracion",
      "imprimir declaracion"
    ],
    "respuesta": "Dentro de Declaración SAT hay un botón para descargar el resumen del periodo en PDF, listo para compartir con tu contador.",
    "seccion": "fiscal"
  },
  {
    "patrones": [
      "la declaracion sat sustituye al contador",
      "la declaración sat sustituye al contador",
      "puedo declarar directo con esto"
    ],
    "respuesta": "No — la Declaración SAT de PUVE es un resumen de apoyo calculado con tus propias ventas y gastos capturados; no sustituye la presentación oficial ante el SAT ni la revisión de tu contador. Siempre verifica los montos antes de usarlos.",
    "seccion": "fiscal"
  },
  {
    "patrones": [
      "como se calcula el iva en la declaracion",
      "cómo se calcula el iva en la declaración"
    ],
    "respuesta": "El IVA trasladado se calcula sobre tus ingresos totales del periodo, asumiendo la tasa general del 16% — siempre confírmalo con tu contador según tu régimen fiscal específico.",
    "seccion": "fiscal"
  },
  {
    "patrones": [
      "agregar cajero",
      "nuevo cajero",
      "codigo de caja",
      "código de caja",
      "dar acceso a un empleado",
      "como entra el cajero",
      "cómo entra el cajero",
      "crear codigo de caja",
      "crear código de caja"
    ],
    "respuesta": "En \"Dispositivos\" generas un código de caja: el cajero lo usa para entrar sin necesitar correo ni contraseña, con permisos limitados (solo Nueva venta, Productos, Corte de caja y Devoluciones si están activas).",
    "seccion": "dispositivos"
  },
  {
    "patrones": [
      "revocar cajero",
      "quitar acceso a un empleado",
      "bloquear cajero",
      "se fue un empleado",
      "despedi a un cajero",
      "despedí a un cajero"
    ],
    "respuesta": "En \"Dispositivos\" busca el código o dispositivo de ese cajero y toca revocar — se le cierra la sesión de inmediato en cualquier aparato donde estuviera conectado.",
    "seccion": "dispositivos"
  },
  {
    "patrones": [
      "cuantos dispositivos puedo tener",
      "cuántos dispositivos puedo tener",
      "limite de dispositivos",
      "límite de dispositivos",
      "limite del plan",
      "límite del plan",
      "cuantas cajas puedo tener",
      "cuántas cajas puedo tener",
      "cuantos cajeros puedo tener",
      "limite de cajeros",
      "cuantos cajeros puedo agregar"
    ],
    "respuesta": "El número de dispositivos que puedes tener activos depende de tu plan — lo ves en la sección Dispositivos, junto al botón para agregar uno nuevo.",
    "seccion": "dispositivos"
  },
  {
    "patrones": [
      "perdi el codigo de caja",
      "perdí el código de caja",
      "olvide el codigo de caja",
      "olvidé el código de caja",
      "el cajero perdio su codigo",
      "el cajero perdió su código"
    ],
    "respuesta": "El encargado puede ver o generar de nuevo los códigos de caja desde la sección Dispositivos.",
    "seccion": "dispositivos"
  },
  {
    "patrones": [
      "que es un dispositivo en puve",
      "qué es un dispositivo en puve",
      "dispositivo vs cajero",
      "que es un dispositivo"
    ],
    "respuesta": "Un \"dispositivo\" es cada aparato (celular, tablet, computadora) donde alguien inicia sesión para usar PUVE — tu plan incluye un número limitado de dispositivos activos al mismo tiempo.",
    "seccion": "dispositivos"
  },
  {
    "patrones": [
      "se me descompuso el celular",
      "cambiar de celular",
      "nuevo celular del cajero",
      "mi dispositivo se perdio",
      "mi dispositivo se perdió"
    ],
    "respuesta": "Si un dispositivo se pierde o se descompone, revócalo desde Dispositivos por seguridad y da de alta el nuevo — así evitas que alguien más pueda usar esa sesión.",
    "seccion": "dispositivos"
  },
  {
    "patrones": [
      "tipo de negocio",
      "preset de configuracion",
      "preset de configuración",
      "que me conviene activar",
      "qué me conviene activar",
      "configuracion recomendada",
      "configuración recomendada"
    ],
    "respuesta": "En Configuración puedes indicar a qué se dedica tu negocio y PUVE te sugiere qué módulos conviene activar — tú decides si aplicar la sugerencia o no.",
    "seccion": "config"
  },
  {
    "patrones": [
      "que modulos puedo activar",
      "qué módulos puedo activar",
      "funciones opcionales",
      "que se puede prender y apagar",
      "qué se puede prender y apagar"
    ],
    "respuesta": "Desde Configuración puedes prender o apagar: Corte de caja, Categorías, Código de barras, Devoluciones, Recompensas por teléfono, y Directorio de clientes y ventas a crédito.",
    "seccion": "config"
  },
  {
    "patrones": [
      "desactivar un modulo",
      "desactivar un módulo",
      "apagar una funcion",
      "apagar una función",
      "quitar devoluciones",
      "quitar recompensas"
    ],
    "respuesta": "Cualquier módulo opcional se puede apagar en cualquier momento desde Configuración — no se borra la información ya registrada, solo deja de aparecer en el menú.",
    "seccion": "config"
  },
  {
    "patrones": [
      "modo oscuro",
      "tema oscuro",
      "cambiar apariencia",
      "modo claro",
      "cambiar colores de la app"
    ],
    "respuesta": "Puedes cambiar entre modo claro y oscuro desde \"Apariencia\" — es un ajuste personal, solo afecta tu propio dispositivo."
  },
  {
    "patrones": [
      "sin internet",
      "modo offline",
      "no tengo conexion",
      "no tengo conexión",
      "se cayo el internet",
      "se cayó el internet",
      "vender sin internet",
      "funciona sin wifi"
    ],
    "respuesta": "PUVE sigue dejándote cobrar en Efectivo, Tarjeta, Transferencia o Mixto sin conexión — la venta se guarda localmente y se sincroniza sola en cuanto regrese el internet. Las ventas a Crédito y el canje de puntos sí necesitan conexión, porque hay que validar el límite del cliente en el servidor."
  },
  {
    "patrones": [
      "mis ventas no se sincronizan",
      "ventas pendientes de sincronizar",
      "se quedaron ventas guardadas"
    ],
    "respuesta": "Si hiciste ventas sin conexión, PUVE las guarda en tu dispositivo y las sube automáticamente en cuanto detecta internet de nuevo — no necesitas hacer nada manual, solo espera a que vuelva la conexión."
  },
  {
    "patrones": [
      "pantalla en blanco",
      "no carga la pagina",
      "no carga la página",
      "la app no abre",
      "se quedo cargando",
      "se quedó cargando"
    ],
    "respuesta": "Intenta recargar la página o cerrar y volver a abrir la app. Si sigue sin cargar después de eso, repórtalo con el botón de abajo, indicando en qué celular o navegador te pasa."
  },
  {
    "patrones": [
      "seguridad de mis datos",
      "mis datos estan seguros",
      "mis datos están seguros",
      "quien puede ver mi informacion",
      "quién puede ver mi información",
      "privacidad"
    ],
    "respuesta": "Cada negocio solo puede ver su propia información — ni otros negocios en PUVE ni personas fuera de tu equipo tienen acceso a tus ventas, productos o clientes."
  },
  {
    "patrones": [
      "puedo exportar mis datos",
      "descargar mi informacion",
      "descargar mi información",
      "respaldo de mis datos"
    ],
    "respuesta": "La Declaración SAT te permite exportar un resumen en PDF. Para una exportación más completa de tus datos, repórtalo como sugerencia con el botón de abajo y lo consideramos."
  },
  {
    "patrones": [
      "no me deja cobrar",
      "el boton de cobrar no funciona",
      "el botón de cobrar no funciona",
      "no se completa la venta",
      "no se completa la venta",
      "no puedo cobrar",
      "no puedo hacer una venta",
      "no puedo vender"
    ],
    "respuesta": "Revisa que tengas conexión a internet si el método es Crédito (ese sí la necesita), que el carrito no esté vacío, y que haya stock suficiente de cada producto. Si con eso sigue sin funcionar, repórtalo con el botón de abajo.",
    "seccion": "vender"
  },
  {
    "patrones": [
      "no aparece un producto",
      "no encuentro un producto que ya cree",
      "no encuentro un producto que ya creé",
      "producto desaparecio",
      "producto desapareció"
    ],
    "respuesta": "Verifica que el producto no haya quedado en una categoría distinta a la que estás filtrando, y que su stock no esté en cero (los productos agotados no aparecen en el carrito). Si sigue sin verse, revísalo directo en Productos.",
    "seccion": "productos"
  },
  {
    "patrones": [
      "el corte no cuadra nunca",
      "siempre me sale faltante",
      "siempre me sale sobrante"
    ],
    "respuesta": "Lo más común es que alguna venta se haya marcado con el método de pago equivocado (por ejemplo tarjeta marcada como efectivo). Revisa el detalle de ventas del periodo y compara los métodos contra lo que realmente cobraste.",
    "seccion": "corte"
  },
  {
    "patrones": [
      "error al guardar",
      "no se guardo mi cambio",
      "no se guardó mi cambio",
      "se perdio la informacion que capture",
      "se perdió la información que capturé"
    ],
    "respuesta": "Si un cambio no se guardó, probablemente hubo un corte de conexión justo en ese momento — inténtalo de nuevo. Si vuelve a fallar, repórtalo con el botón de abajo describiendo exactamente qué estabas haciendo."
  },
  {
    "patrones": [
      "la app va lenta",
      "todo va muy lento",
      "se tarda mucho en cargar"
    ],
    "respuesta": "Si notas la app lenta, revisa primero tu señal de internet — muchas de las pantallas necesitan conexión para traer información actualizada. Si tu conexión está bien y sigue lento, repórtalo con el botón de abajo."
  },
  {
    "patrones": [
      "se cerro mi sesion sola",
      "se cerró mi sesión sola",
      "me saco de la cuenta",
      "me sacó de la cuenta"
    ],
    "respuesta": "Esto puede pasar si otro dispositivo revocó tu acceso, si tu sesión expiró por inactividad, o si hubo un problema de conexión. Vuelve a iniciar sesión; si sigue pasando seguido, repórtalo con el botón de abajo."
  },
  {
    "patrones": [
      "numero equivocado en un pedido",
      "número equivocado en un pedido",
      "cantidad incorrecta en la venta"
    ],
    "respuesta": "Si notas una cantidad incorrecta antes de cobrar, corrígela directo en el carrito. Si ya se cobró, la forma correcta de corregirlo es con una Devolución del producto de más, o reportándolo con el botón de abajo.",
    "seccion": "vender"
  },
  {
    "patrones": [
      "como reporto un error",
      "cómo reporto un error",
      "donde reporto un problema",
      "dónde reporto un problema"
    ],
    "respuesta": "Puedes escribirlo aquí mismo describiendo qué pasó, o tocar el botón \"Reportar un problema\" de abajo para llenar un formulario corto — se guarda directo con tu equipo de soporte."
  },
  {
    "patrones": [
      "como mando una sugerencia",
      "cómo mando una sugerencia",
      "donde dejo una idea",
      "dónde dejo una idea",
      "quiero proponer algo"
    ],
    "respuesta": "Toca el botón \"Enviar una sugerencia\" de abajo, o escríbela aquí mismo — se guarda directo con el equipo para que la revisen."
  },
  {
    "patrones": [
      "prueba gratis",
      "periodo de prueba",
      "cuanto dura la prueba",
      "puedo probar puve gratis",
      "es gratis",
      "primer mes gratis",
      "dias gratis",
      "cuanto dura el periodo gratis"
    ],
    "respuesta": "Toda cuenta nueva incluye 15 días de prueba gratis, contados desde el día en que se crea. Al terminar, para seguir usando PUVE tienes que pagar tu plan; si no has pagado, el acceso se bloquea hasta que se confirme tu pago."
  },
  {
    "patrones": [
      "donde pongo mi rfc",
      "como pongo mi rfc",
      "capturar rfc",
      "datos fiscales",
      "regimen fiscal",
      "razon social",
      "donde capturo mis datos fiscales"
    ],
    "respuesta": "En Declaración SAT, arriba, están los \"Datos fiscales del negocio\": captura tu RFC, nombre o razón social y régimen fiscal, y toca \"Guardar datos fiscales\". Se imprimen en el PDF tal como los captures — PUVE no los valida contra el SAT.",
    "seccion": "fiscal"
  },
  {
    "patrones": [
      "codigo de invitacion",
      "codigo de referido",
      "como invito a otro negocio",
      "invita y gana",
      "como gano dias gratis",
      "recompensas por invitar",
      "como comparto mi codigo",
      "enlace de invitacion",
      "descuento por invitacion",
      "referidos",
      "donde esta mi codigo"
    ],
    "respuesta": "En Configuración → Invita y gana tienes tu código único (PUVE-XXXX) y un botón para compartirlo por WhatsApp. Cada negocio que se una con tu código paga $187.50 al mes durante sus primeros 3 meses (o $250 menos si elige el plan anual), y tú ganas 15 días gratis por cada invitado que pague su membresía. Ahí mismo ves cuántos invitados llevas y hasta cuándo tienes cubierto tu plan.",
    "seccion": "config"
  },
  {
    "patrones": [
      "que es un embajador",
      "como ser embajador",
      "quiero ser embajador",
      "gano comision por recomendar",
      "comision por traer clientes",
      "registrarme como embajador",
      "panel de embajador"
    ],
    "respuesta": "Un Embajador no tiene negocio en PUVE: solo recomienda el sistema y gana una comisión cuando un negocio se registra con su código y hace su primer pago (probar los 15 días gratis no cuenta). Para registrarte, en la pantalla de acceso toca \"Quiero ser Embajador\" — es un registro aparte, sin código de invitación. Ahí dentro tienes tu propio código, un botón para compartirlo por WhatsApp, y tus estadísticas: cuántos negocios has traído, cuántos ya pagaron, cuántos solo probaron y en qué zonas."
  }
];
