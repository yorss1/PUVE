# Juego de restaurante y cafetería (fase 2–3: prototipo jugable)

Dos puntos de entrada sobre un mismo motor: `restaurante.html` y `cafeteria.html`.
Lo específico de cada giro vive solo en `nucleo/config/<giro>.json` (mapa, platos, mejoras, ritmo de clientes).

## Ejecutar
- Servir la carpeta `games/` con cualquier servidor estático (`python3 -m http.server`) y abrir `/restaurante.html` o `/cafeteria.html`.
- Controles: WASD o flechas, `E`/Espacio para interactuar. En móvil: joystick y botón E.
- Diagnóstico: añadir `#debug=1` a la URL.

## Pruebas
Desde la carpeta `games/`:
- `node nucleo/tests/sim.test.mjs` (13) · `persistencia.test.mjs` (7) · `ciudad.test.mjs` (7) · `sala.test.mjs` (7) · `mundo.test.mjs` (11, incluye fuzz de 4000 operaciones) · `servidor.test.mjs` (8) · `ws.test.mjs` (6: servidor real con clientes WebSocket reales, incluye chat y sociedad) · `economia.test.mjs` (12) · `rivales.test.mjs` (10) · `fase2.test.mjs` (13, incluye equilibrio de giros) · `fase3.test.mjs` (13, incluye un fuzz de 3500 operaciones mezcladas) · `ciudades.test.mjs` (28: las 6 ciudades) · `chispa.test.mjs` (7: ritmo y propinas del local) · `vida.test.mjs` (15: sellos, repartos, chismes) · `paneles.test.mjs` (7: interfaz con DOM simulado, pulsa todos los botones). Todo junto: `for t in sim persistencia ciudad sala mundo servidor ws economia rivales fase2 fase3 paneles ciudades chispa vida; do node nucleo/tests/$t.test.mjs | tail -1; done`.
- Probado además en Chromium (PC y móvil vertical): tutorial, avatares, cuenta y migración, sprites con y sin archivos, ciudad, dos jugadores en navegadores independientes contra el servidor real (sala por QR, inversión, compra de lotes, competencia, rechazo de trampas, reconexión tras reiniciar el servidor) y salas de prueba entre pestañas. No se probó en teléfonos reales ni con Internet real (solo localhost).

## Sprites (arte)
Pon los PNG en `games/sprites/` con los nombres de `sprites/LISTA_SPRITES.md`. Lo que exista se usa; lo que falte se dibuja con el diseño por defecto. Valida nombres y tamaños con `node nucleo/herramientas/indexar_sprites.mjs`.

## Ciudad
Mundo infinito determinista (`world/ciudad.js`): calles, banquetas, edificios y parques. Tu negocio está en el chunk (0,0); sales por la puerta del local y vuelves por la puerta verde. Los chunks (16×16) se cargan con presupuesto por fotograma, se liberan con margen y se pre-renderizan una sola vez. Con el local fuera de pantalla su simulación queda en pausa.

## Jugar con amigos: servidor y franquicias
**Cómo se juega.** Cada jugador tiene su restaurante (se juega por dentro, como siempre). Con el dinero de tu restaurante pulsas **Franquicias → Invertir** y pasa a tu *cuenta de franquicias*. Con esa cuenta compras **lotes** de la ciudad (caminas hasta un edificio con franja amarilla y pulsas E), los mejoras (nivel 1–5) o los vendes (70%). Cada turno (10 s) tus franquicias generan ingresos según el **tráfico** del lote, su nivel y la **competencia** cercana (los restaurantes y franquicias de todos reparten los clientes de la zona); también pagan mantenimiento y, si no pueden pagarlo, quiebran y el lote queda libre. El **ranking** es por patrimonio (efectivo + valor de tus franquicias).

**Servidor para internet (sin dependencias):**
```
node nucleo/herramientas/servidor_nodo.mjs --puerto 8787 --datos ./datos
```
Sirve el juego y las salas (WebSocket en `/ws`) y guarda cada sala en `datos/` (sobrevive a reinicios; los jugadores reconectan solos). Ábrelo en `http://localhost:8787/restaurante.html`, menú ☰ → Multijugador → *Crear sala en el servidor*, y comparte el QR o el enlace. Para que tus amigos entren desde fuera, publica ese puerto detrás de **HTTPS** (proxy inverso o túnel, p. ej. Cloudflare Tunnel): el navegador usará `wss://` solo.
- Seguridad implementada: el servidor decide todo lo económico; cada jugador se identifica con un secreto (`jid`, nunca se difunde) del que el servidor deriva su id público; revisión de `Origin`; límites de tamaño de mensaje y de mensajes por segundo; operaciones idempotentes (reintentar no duplica); no sirve `tests/`, `docs/`, `datos/` ni `herramientas/`.
- **Límite honesto sobre el dinero:** tu restaurante se simula en tu navegador, así que el servidor no puede verificar cada venta. Lo que sí hace es limitar cuánto puedes **invertir**: un cupo de $1500 que se recupera a ~$12/s (+$4/s por franquicia). Con amigos funciona bien; no es anti-trampas contra alguien que modifique su navegador. Hacerlo a prueba de trampas exigiría que el servidor simule también cada restaurante.
- Pendiente: comprar/vender lotes entre jugadores (tratos, subastas), compra hostil, NPC, chat, panel de administración, límites por IP, HTTPS integrado (hoy va detrás de un proxy), `workers/sala-do.js` (alternativa Cloudflare, **boceto no probado**).

**Sala de prueba (sin servidor):** entre pestañas del mismo navegador (BroadcastChannel); la pestaña anfitriona hace de servidor y si se cierra la sala termina. Sirve para probar.

**QR e invitaciones:** `#sala=<id>.<token>&t=ws|loc`; el token vale 10 min y 3 usos, el anfitrión puede revocarlo con *Nueva invitación*, y se borra de la barra de direcciones al unirse. El QR reutiliza el generador de PUVE (sin dependencias).

**Modo individual:** también usa el mismo motor de franquicias con un servidor local (se guarda en este navegador), así que puedes jugar solo contra el "ritmo" de la ciudad y luego pasar a una sala.

## Fases 1 y 2: mercado vivo, rivales, personal, proveedores y progresión
Módulos nuevos en `nucleo/economia/` (puros, sin DOM ni red, probados con node) y `nucleo/game/paneles.js` (solo presentación).
- **`mercado.js`**: barrios de 2×2 chunks con mezcla de clientela (estudiantes, familias, oficinistas, turistas, exigentes), tendencia lenta por barrio, 8 tipos de evento (festival, obras, partido, lluvias, vacaciones, inflación, escasez, moda) **avisados 6 turnos antes**, especialidades, precios, proveedores y reputación. Todo sale de `(seed, turno)`: recargar nunca cambia el resultado.
- **`rivales.js`**: 4 personalidades (agresivo, estratega, tradicionalista, oportunista) que son jugadores normales del mismo mundo y usan las **mismas operaciones** (`mundo._exec`). Tienen capital propio, deuda con límite, memoria (quién abrió cerca, quién les compró), ritmo (enfriamiento entre compras), reacción de precios/promociones, venta en crisis, retiro y un único regreso con socios (máx. 2). No reciben dinero de la nada: solo capital inicial y el regreso; retiran utilidades para no acumular caja sin límite.
- **`ramas.js`**: 6 ramas × 2 mejoras; cada una tiene ventaja y desventaja, y algunas son incompatibles. Las `local` se pagan con el dinero del negocio (las aplica `sim.js`); las `cadena` con la cuenta de franquicias (las valida el servidor).
- **`progresion.js`**: campaña de 5 etapas, 15 misiones (inmediatas, de sesión y largo plazo) y 15 logros. Las etapas desbloquean funciones **en la interfaz** (especialidades, proveedores, contratos, gerentes, ramas de cadena); el servidor acepta todo, así que no depende de ellas.
- **`mundo.js`** ahora lleva un **libro de dinero** por jugador (`p.c`): todo movimiento pasa por `_mov` y siempre se cumple `dinero == suma del libro` (hay pruebas con fuzz). Nuevas operaciones validadas: `prestamo`, `abonar`, `proveedor` (con contrato), `rama`, `ajustar` (precio/especialidad/recortes), `promocion`, `gerente`, `listar`/`retirar` (poner en venta) y `comprar` un local en venta, `informe`.
- **Ausencias**: al importar un mundo guardado se simulan hasta `MAX_OFFLINE` = 360 turnos (1 h); tus franquicias rinden 30% menos sin supervisión, **nunca cierran ni se endeudan por inactividad**, los rivales compran como máximo 2 veces por rival y al volver aparece el panel «Mientras no estabas».
- **`sim.js`**: estadísticas (servidos, racha, semanas sin apuros), proveedor del local, empleados con habilidad, experiencia, ánimo y sueldo (renuncian si los pagas mal), capacitar, ascender a gerente (toma pedidos y cobra por ti mientras estás dentro), ramas locales, y `sim.mercado` (demanda e insumos que llegan del mundo).
- **Equilibrio**: `node nucleo/herramientas/equilibrio.mjs` juega ambos giros con un bot; la cafetería quedó a ±4% del restaurante (se ajustaron sus precios y XP en `config/cafeteria.json`). Lo protege una prueba.
- **Ajustes rápidos**: número de rivales del modo solo → `iniciarSolo()` en `main.js` (`new Servidor({ rivales: 3 })`, 0 = sin rivales); ritmo y capital → `PERFILES` en `rivales.js`; constantes económicas → inicio de `mundo.js`.
- Una sala con amigos **no** trae rivales por defecto (`new Servidor()`); se activan con `new Servidor({ rivales: n })`. Un mundo guardado antes de esta versión recibe sus rivales una sola vez al abrirlo (si el servidor se creó con `rivales > 0`).
- Compatibilidad: todos los campos nuevos son opcionales y se validan al cargar; una partida o mundo anterior sigue cargando (hay pruebas con formato viejo y con datos corruptos).
- **Service worker**: cada módulo nuevo debe estar en la lista de `sw.js` (ya añadidos; caché `puvegame-v9`).

## Fase 3: competir y cooperar (validación, contratos, subastas, sociedades, chat)
Módulos del servidor en `nucleo/multiplayer/` (puros, probados con node; los usa `mundo.js`) y la lógica de rivales en `economia/rivales.js`.
- **`validacion.js`** (validación del restaurante propio). El restaurante se simula en el navegador y no se puede reproducir en el servidor; lo que sí se hace es **acotarlo**: el cliente reporta cada 10 s totales acumulados (`ganado`, `xp`, `servidos`, `tiempo`, `semanas`) con la operación `local`, y el servidor solo acepta lo verosímil para el tiempo REAL transcurrido (`TASA_DINERO` 45 $/s, `TASA_XP` 10/s, `TASA_SERV` 2/s; el jugador-bot ideal de `equilibrio.mjs` logra ~20 $/s con todas las bonificaciones). `invertir` solo puede sacar dinero de las ganancias aceptadas (`credito`; hay 1,500 de partida). Lo que excede se descarta y suma una «sospecha». **No es antitrampa total** (alguien podría jugar «perfecto» al máximo ritmo permitido), pero acota el daño a un ritmo fijo. Se activa con `new Mundo({ estricto: true })`; el `Servidor` lo activa por defecto.
- **Etapas en el servidor**: con `estricto`, las funciones avanzadas (especialidades, proveedores, contratos con proveedor, gerentes, ramas de cadena) exigen la etapa de campaña calculada **solo con datos que el servidor conoce o ha acotado**. La interfaz muestra la etapa del servidor.
- **`contratos.js`** (catering): cada 40 turnos salen 3 ofertas iguales para todos (quien llega primero se la queda). Pagan por turno y piden **capacidad**; el contrato reserva cocina antes que los clientes habituales, así que uno grande puede saturar el local. Hay depósito (se devuelve si cumples ≥90%), multa por lo no entregado, bono al terminar y −1 de reputación si fallas. Los rivales también los toman según su perfil.
- **`subastas.js`**: un jugador puede subastar una franquicia; la ciudad subasta cada 50 turnos el lote libre con mejor relación tránsito/competencia. La puja se retiene (no se puede gastar dos veces), hay puja mínima (+5%), antisniping (+2 turnos, máx. 3 veces) y todo el mundo ve líder y cierre. Los rivales pujan si el negocio les sale rentable.
- **`sociedades.js`**: empresa con hasta 4 socios, caja compartida, franquicias, deuda y ramas propias (es un «jugador» más con cid `soc:N`). Roles (fundador, gerente, socio) y permisos (`operar`, `mejorar`, `comprar`, `vender`, `finanzas`) ajustables por el fundador. **Votación por mayoría** para préstamos, compras, ventas, repartos y disolución; historial de decisiones. Salir o disolver reparte en proporción a lo aportado. Se actúa en nombre de la sociedad añadiendo `soc: 'soc:N'` a la operación.
- **Rivales** (`rivales.js`): **fusiones** (un rival sólido absorbe a otro en apuros: negocios, caja y deuda), **rescate** (`rescatar`: pagas parte de la deuda de un rival en apuros; no competirá contra ti y te devuelve el favor +15% cuando se recupere) y número ajustable en caliente (`ajustarRivales`, 0–8; la sala y el modo solo lo ofrecen de 0 a 4).
- **Chat** (`servidor.js`): texto plano (200 caracteres, sin etiquetas), un mensaje cada 1.2 s, historial de 30 mensajes al entrar, el anfitrión puede silenciar o apagar el chat y cada jugador puede ocultar mensajes de alguien. **No hay filtro automático de palabras**: la moderación es del anfitrión. El historial viaja en `exportar()`.
- **Salas con rivales**: `crear` acepta `rivales` (0–4); `{ t: 'rivales', n }` lo cambia (solo anfitrión).
- **Ausencia del local** (`Sim.ausencia`): si tienes **gerente y personal**, tu local sigue abierto mientras estás en la calle o fuera del juego: el gerente toma pedidos, cobra y surte y el equipo cocina. Máximo 15 minutos, **la mitad de la ganancia** (`EFIC_AUSENCIA`) y la reputación no cae más de 1 punto. Sin gerente simplemente cierra.
- **Interfaz**: emblemas propios en el rótulo de cada lote (▲ agresivo, ◆ estratega, ■ tradicionalista, ● oportunista, ⚭ sociedad), marca verde en lotes en venta y destello amarillo en lotes en subasta; paneles de Contratos, Subastas, Sociedad, Chat y selector de rivales.
- **Mensajes nuevos al servidor**: `local`, `contrato`, `pujar`, `subastar`, `retirarSubasta`, `rescatar`, `soc_*`, `votar` (por `eco`), y `chat`, `chat_config`, `rivales` (directos). Las respuestas de moderación usan `t: 'aviso'`, no `resp` (un `resp` con error saca de la sala).

## Fase 4: ciudades variadas y diversión («chispa»)
**Ciudades** (`world/ciudades.js`, `game/arte.js`, `game/mapa.js`). La ciudad original sigue siendo «Ciudad clásica» (semillas < 1000: no cambió nada y las partidas viejas la conservan). Las semillas ≥ 1000 usan un generador nuevo con **6 ciudades**: Villa Dorada (1000, un río con puentes), Puerto Azul (1001, mar, malecón, playas y muelles), Valle Verde (1002, parques con lagos y río), San Mateo (1003, colonial: empedrado, plazas y mercados), Roca Alta (1004, montaña minera: colinas, fábricas, contenedores) y Gran Metrópoli (1005, rascacielos, glorietas y río ancho). Un mundo nuevo empieza en Villa Dorada.
- **Distritos orgánicos** (Voronoi): centro, casco histórico, colonia, jardines, malecón, puerto, zona fabril, campus, mercado y colinas, cada uno con su suelo, calles (asfalto o empedrado), alamedas, glorietas, manzanas (plazas con fuente, mercados con puestos, canchas, lagos, playas con palmeras y sombrillas, solares, colinas con rocas) y **12 estilos de edificio** más **8 monumentos únicos** (faro, catedral, torre del reloj, estación, biblioteca, mercado central, mirador, fábrica vieja).
- **Agua**: mar, ríos y lagos. Los ríos se cruzan con puentes; frente al mar la calle termina en un muelle corto. Hay agua animada.
- **Reglas que se prueban** (28 pruebas): las calles y banquetas siempre se pueden caminar, todo lote tiene su puerta con frente caminable, todo lo que se puede comprar se alcanza a pie desde el inicio y la zona de inicio es seca.
- **Economía por ciudad**: el tráfico de cada lote sale de su distrito, la cercanía al centro y los monumentos; los barrios heredan la clientela del distrito (campus = estudiantes, malecón = turistas…) y hay **eventos propios de cada zona** (regata, feria del libro, tianguis, desfile, concierto) que solo existen en las ciudades nuevas.
- **Elegir ciudad**: menú «Ciudades» (vista previa de cada una; un mundo nuevo pide confirmación y reinicia franquicias y rivales, pero no tu restaurante) y `crear` acepta `ciudad` en las salas. El servidor anuncia su `seed` y los clientes cambian de ciudad solos.
**Diversión en el local** (`game/sim.js`, `game/chispa.js`): hora pico cada ~2 min (más clientes, bono si no pierdes a nadie), clientes con personalidad (⚡ apurado, 💰 generoso, 📝 crítico, ⭐ VIP), **plato en su punto** (recógelo en los primeros 2.5 s: perfecto; tras 8 s se quema), propina por rapidez, **racha** (+2.5% cada 3 clientes, tope +25%) y feedback: textos flotantes con fuente pixelada, chispas, monedas, banners, destellos, temblor leve y sonidos que suben de tono con la racha. Los bonos tienen tope: el jugador ideal gana ~2× el casual.
**Diversión en la calle** (`world/vida.js`): **Repartos** (3 pedidos de riesgo creciente con flecha, contador y propina por sobrar tiempo; entregas seguidas suben el pago hasta +50%), **Pasaporte** (sellos al acercarte a los 8 monumentos más cercanos; completarlo da dinero y un título), **peatones** que caminan por las banquetas y cruzan las calles, y al hablarles (E) cuentan **chismes con datos reales** del mundo (eventos próximos, subastas, noticias, rivales en apuros, pistas de monumentos) y a veces regalan una moneda. Hay un panel de **Mapa** y pistas de una sola vez que enseñan cada mecánica.

## Reglas de datos importantes
- La cuenta solo recibe autoguardados tras una migración confirmada (vínculo por giro). Antes, nada se escribe en ella.
- La cuenta SIMULADA vive en este navegador y no tiene contraseña. No es seguridad real.
- Limitación conocida: la cuenta simulada guarda con "última escritura gana". La versión real debe usar el control de versión de `migrations/PROPUESTA_001_juego.sql`.
- `migrations/PROPUESTA_001_juego.sql` y `adapters/supabase/` NO están activos ni conectados.
- El QR reutiliza el generador propio de PUVE (`PUVE/pruebas/qr.js`), sin dependencias externas.

## Pendiente
- **Fase 4 del plan, lo que falta**: eventos especiales de temporada (estaciones), desafíos diarios, prestigio/reinicio y clasificaciones públicas.
- **Antitrampa total**: la validación del restaurante es por verosimilitud (ver arriba). Reproducir la simulación en el servidor sería lo único que lo cierra del todo.
- **Arte**: todo el arte nuevo (edificios, agua, objetos, emblemas, efectos) está dibujado por código con el estilo de los sprites, no es una hoja de sprites hecha a mano. Los rivales no tienen personaje que camine; los peatones usan los mismos sprites de clientes.
- **Peatones y repartos son locales** de cada jugador (no se comparten por la red); los sellos y el progreso de repartos viven en el perfil de este dispositivo.
- **Sociedades**: máximo 4 socios y una por persona; no se puede pujar «en nombre de la sociedad» desde la interfaz (la operación sí lo admite con `soc`).
- **Chat**: sin filtro automático de palabras ni reportes.
- **Fallo previo conocido** (ya estaba en el ZIP original): abrir un guardado de un giro con la clave del otro provoca «Maximum call stack size exceeded». No ocurre en el uso normal.
- **Sin probar en dispositivos reales**: rendimiento en móviles de gama baja, táctil real y WebSocket por internet (solo Chromium de escritorio con viewport de teléfono y el servidor Node local).
- Localización y accesibilidad completas.

## Pendiente (anterior)
Hoja de sprites real (ver lista); accesibilidad y localización completas; NPC y negocios ajenos en la ciudad; rendimiento en móviles reales.

## Parches propuestos para PUVE (NO aplicados)
- `pedir.html`: tabla `{restaurante:'games/restaurante.html', cafeteria:'games/cafeteria.html'}` según `menu.giro`; enlace con `target="_blank" rel="noopener"`.
- `.assetsignore`: añadir `games/nucleo/tests/`, `games/nucleo/docs/`, `games/nucleo/migrations/`, `games/nucleo/workers/` y `games/nucleo/herramientas/`.
- `robots.txt`: `Disallow: /games/` (opcional).
- `_headers`: sin cambios mientras no se incruste en iframe.
