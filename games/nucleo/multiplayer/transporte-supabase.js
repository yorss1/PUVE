// Salas por INTERNET con Supabase Realtime (Broadcast). Mismo contrato que transporte-local: { enviar(msg), cerrar() } y hooks.onMsg(msg).
// El anfitrión corre la lógica de la sala (Servidor) en su navegador y los demás hablan con él por un canal; el estado de la sala se guarda en la base (alGuardar) para poder reanudarla.
// Límite honesto: el anfitrión es de confianza (como en el resto del juego, tu restaurante se simula en tu navegador); las salas son para jugar con amigos.
const canal = id => 'puvegame:srv:' + id;
export function hostSB(sb, servidor, cid, hooks, { alGuardar } = {}) {
  let ch = null, vGuardada = -1, tGuardada = 0;
  const entregar = sal => { for (const s of sal) { if (ch && s.para !== cid) ch.send({ type: 'broadcast', event: 's', payload: { para: s.para, msg: s.msg } }); if (s.para === cid || s.para === '*') hooks.onMsg(s.msg); } };
  const abrirCanal = () => {
    if (ch || !servidor.id) return;
    ch = sb.channel(canal(servidor.id), { config: { broadcast: { self: false } } });
    ch.on('broadcast', { event: 'c' }, ({ payload: m }) => { if (m && typeof m.cid === 'string' && m.cid !== cid) entregar(servidor.manejar(m.cid, m.msg)); });
    ch.subscribe(st => { hooks.onEstado?.(st === 'SUBSCRIBED' ? 'conectado' : st === 'CLOSED' || st === 'CHANNEL_ERROR' || st === 'TIMED_OUT' ? 'reconectando' : ''); });
  };
  const guardar = () => {   // estado de la sala a la base: al cambiar la economía y como mucho cada 15 s
    if (!alGuardar || !servidor.id) return; const ahora = Date.now();
    if (servidor.mundo.v === vGuardada || ahora - tGuardada < 15000) return;
    vGuardada = servidor.mundo.v; tGuardada = ahora; Promise.resolve(alGuardar(servidor.exportar())).catch(e => console.warn('No se pudo guardar la sala', e));
  };
  const iv = setInterval(() => { abrirCanal(); entregar(servidor.difundir()); guardar(); }, 100);
  return {
    enviar(msg) { entregar(servidor.manejar(cid, msg)); abrirCanal(); },
    cerrar() { clearInterval(iv); if (ch) { sb.removeChannel(ch); ch = null; } }
  };
}
export function invitadoSB(sb, salaId, cid, hooks) {
  let vivo = false, listo = false; const cola = [];
  const ch = sb.channel(canal(salaId), { config: { broadcast: { self: false } } });
  ch.on('broadcast', { event: 's' }, ({ payload: m }) => { if (m && (m.para === cid || m.para === '*')) { vivo = true; hooks.onEstado?.('conectado'); hooks.onMsg(m.msg); } });
  ch.subscribe(st => { if (st === 'SUBSCRIBED') { listo = true; while (cola.length) ch.send(cola.shift()); } else if (st === 'CLOSED' || st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') hooks.onEstado?.('reconectando'); });
  const t = setTimeout(() => { if (!vivo) hooks.onMsg({ t: 'resp', ok: false, msg: 'Nadie respondió: el anfitrión debe tener la sala abierta' }); }, 8000);
  return {
    enviar(msg) { const p = { type: 'broadcast', event: 'c', payload: { cid, msg } }; if (listo) ch.send(p); else if (msg.t !== 'mover' && cola.length < 20) cola.push(p); },
    cerrar() { clearTimeout(t); sb.removeChannel(ch); }
  };
}
