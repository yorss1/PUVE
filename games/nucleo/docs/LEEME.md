# Juego de restaurante y cafetería (fase 2–3: prototipo jugable)

Dos puntos de entrada sobre un mismo motor: `restaurante.html` y `cafeteria.html`.
Lo específico de cada giro vive solo en `nucleo/config/<giro>.json` (mapa, platos, mejoras, ritmo de clientes).

## Ejecutar
- Servir la carpeta `games/` con cualquier servidor estático (`python3 -m http.server`) y abrir `/restaurante.html` o `/cafeteria.html`.
- Controles: WASD o flechas, `E`/Espacio para interactuar. En móvil: joystick y botón E.
- Diagnóstico: añadir `#debug=1` a la URL.

## Pruebas
Desde la carpeta `games/`:
- `node nucleo/tests/sim.test.mjs` (13) · `persistencia.test.mjs` (7) · `ciudad.test.mjs` (7) · `sala.test.mjs` (7) · `mundo.test.mjs` (11, incluye fuzz de 4000 operaciones) · `servidor.test.mjs` (8) · `ws.test.mjs` (5: servidor real con clientes WebSocket reales).
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

## Reglas de datos importantes
- La cuenta solo recibe autoguardados tras una migración confirmada (vínculo por giro). Antes, nada se escribe en ella.
- La cuenta SIMULADA vive en este navegador y no tiene contraseña. No es seguridad real.
- Limitación conocida: la cuenta simulada guarda con "última escritura gana". La versión real debe usar el control de versión de `migrations/PROPUESTA_001_juego.sql`.
- `migrations/PROPUESTA_001_juego.sql` y `adapters/supabase/` NO están activos ni conectados.
- El QR reutiliza el generador propio de PUVE (`PUVE/pruebas/qr.js`), sin dependencias externas.

## Pendiente
Hoja de sprites real (ver lista); accesibilidad y localización completas; NPC y negocios ajenos en la ciudad; rendimiento en móviles reales.

## Parches propuestos para PUVE (NO aplicados)
- `pedir.html`: tabla `{restaurante:'games/restaurante.html', cafeteria:'games/cafeteria.html'}` según `menu.giro`; enlace con `target="_blank" rel="noopener"`.
- `.assetsignore`: añadir `games/nucleo/tests/`, `games/nucleo/docs/`, `games/nucleo/migrations/`, `games/nucleo/workers/` y `games/nucleo/herramientas/`.
- `robots.txt`: `Disallow: /games/` (opcional).
- `_headers`: sin cambios mientras no se incruste en iframe.
