import { limpiarPartida } from './contrato.js';
// Jugador INVITADO (sin cuenta): la partida se guarda en el dispositivo (como siempre) y además en la base de PUVE, a través de la Edge Function pública "pedido-qr".
// El dispositivo crea un secreto aleatorio; la base solo guarda su huella. Si la red falla, el juego sigue normal con lo guardado en el dispositivo.
export function crearNube(local, cfg) {
  const LS_ID = 'puvegame:jid', t0 = Date.now();
  let subido = 0, pendiente = null, giroAct = null, ultimo = 0, trailing = 0, reloj = 0;
  const jid = () => {
    let j = null; try { j = localStorage.getItem(LS_ID); } catch (e) { /* sin almacenamiento */ }
    if (!/^[0-9a-f]{24}$/.test(j || '')) { const a = new Uint8Array(12); crypto.getRandomValues(a); j = Array.from(a, x => x.toString(16).padStart(2, '0')).join(''); try { localStorage.setItem(LS_ID, j); } catch (e) { /* se vuelve a crear la próxima vez */ } }
    return j;
  };
  async function api(body, { espera = 4000, final = false } = {}) {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), espera);
    try {
      const r = await fetch(cfg.url + '/functions/v1/pedido-qr', { method: 'POST', keepalive: final, signal: ctl.signal, headers: { 'Content-Type': 'application/json', apikey: cfg.key, Authorization: 'Bearer ' + cfg.key }, body: JSON.stringify({ ...body, dispositivo: jid() }) });
      return r.ok ? await r.json().catch(() => null) : null;
    } catch (e) { return null; } finally { clearTimeout(t); }
  }
  function enviar(final = false) {
    if (!giroAct) return; ultimo = Date.now();
    if (pendiente && pendiente.ts > subido) { subido = pendiente.ts; api({ accion: 'juego_guardar', giro: giroAct, partida: pendiente }, { final }); }
    api({ accion: 'juego_sesion', giro: giroAct, segundos: Math.round((Date.now() - t0) / 1000), negocio: cfg.negocio || undefined }, { final });
  }
  addEventListener('pagehide', () => enviar(true));
  document.addEventListener('visibilitychange', () => { if (document.hidden) enviar(true); });
  return {
    ...local,
    async cargarPartida(giro) {
      giroAct = giro; if (!reloj) reloj = setInterval(() => enviar(false), 30000);
      const loc = await local.cargarPartida(giro), r = await api({ accion: 'juego_cargar', giro }, { espera: 2500 }), nube = limpiarPartida(r && r.partida);
      if (nube && (!loc || nube.ts > (loc.ts || 0))) { await local.guardarPartida(giro, nube); subido = nube.ts; enviar(false); return nube; }   // la de la base es más nueva
      subido = nube ? nube.ts : 0; if (loc) pendiente = loc; enviar(false); return loc;   // la del dispositivo es más nueva (o no hay otra): se sube sola
    },
    async guardarPartida(giro, s) {
      await local.guardarPartida(giro, s); giroAct = giro; pendiente = s;
      if (Date.now() - ultimo > 20000) enviar(false); else if (!trailing) trailing = setTimeout(() => { trailing = 0; enviar(false); }, 20000);
    }
  };
}
