// Carga de sprites PNG con respaldo automático: si un archivo no existe (o es inválido) el juego usa su dibujo por defecto.
// Búsqueda por nombre: sprites/<giro>/<nombre>.png y luego sprites/comun/<nombre>.png.
// La carga es en segundo plano (el juego arranca de inmediato) y con pocas peticiones simultáneas; `listo` se resuelve al terminar.
const HOJAS = /^(piel|ropa|pelo|gorro|cliente_ropa|empleado_cuerpo)/;
export function cargarSprites(giro, base = 'sprites', manifestoUrl = 'nucleo/config/sprites.json') {
  const mapa = new Map(), rechazados = [];
  const cargar = url => new Promise(res => { const im = new Image(); im.onload = () => res(im.naturalWidth > 0 ? im : null); im.onerror = () => res(null); im.src = url; });
  const listo = (async () => {
    let items = [], indice = null;
    try { const r = await fetch(manifestoUrl); if (r.ok) items = (await r.json()).items; } catch (e) { console.warn('Sin manifiesto de sprites', e); }
    try { const r = await fetch(`${base}/indice.json`); if (r.ok) indice = new Set(await r.json()); } catch (e) { console.warn('Sin índice de sprites (se probará cada nombre)', e); }
    const nombres = [...new Set(items.map(i => i.n))]; let k = 0;
    await Promise.all(Array.from({ length: 8 }, async () => {
      while (k < nombres.length) {
        const n = nombres[k++];
        for (const carpeta of [giro, 'comun']) {
          if (indice && !indice.has(`${carpeta}/${n}.png`)) continue;
          const im = await cargar(`${base}/${carpeta}/${n}.png`);
          if (!im) continue;
          if (HOJAS.test(n) && (im.naturalWidth !== 64 || im.naturalHeight !== 96)) { rechazados.push(`${carpeta}/${n}.png (${im.naturalWidth}x${im.naturalHeight}, se esperaba 64x96)`); continue; }
          mapa.set(n, im); break;
        }
      }
    }));
    if (rechazados.length) console.warn('Sprites ignorados por tamaño incorrecto:', rechazados);
    console.info(`Sprites: ${mapa.size} encontrados de ${nombres.length}; lo que falte usa el diseño por defecto. Los 404 de /sprites/ son normales hasta que agregues archivos (con indexar_sprites.mjs --escribir-indice se evitan).`);
  })();
  return { get: n => mapa.get(n) || null, tiene: n => mapa.has(n), listo, rechazados };
}
