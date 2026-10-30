// Transportes SIN red de internet: modo solo (servidor dentro de la página) y salas de prueba entre pestañas (BroadcastChannel).
// Contrato común con el transporte WebSocket: { enviar(msg), cerrar() } y hooks.onMsg(msg).
export function hostLocal(servidor, cid, hooks, { bc = true } = {}) {
  const canal = bc ? () => new BroadcastChannel('puvegame:srv:' + servidor.id) : null; let ch = null;
  const entregar = sal => { for (const s of sal) { if (ch && s.para !== cid) ch.postMessage({ t: 's', para: s.para, msg: s.msg }); if (s.para === cid || s.para === '*') hooks.onMsg(s.msg); } };   // primero se avisa a los demás: el hook puede cerrar el canal
  const abrirCanal = () => { if (ch || !canal || !servidor.id) return; ch = canal(); ch.onmessage = e => { const m = e.data; if (m?.t === 'c' && typeof m.cid === 'string' && m.cid !== cid) entregar(servidor.manejar(m.cid, m.msg)); }; };
  const iv = setInterval(() => { abrirCanal(); entregar(servidor.difundir()); }, 100);
  return { enviar(msg) { entregar(servidor.manejar(cid, msg)); abrirCanal(); }, cerrar() { clearInterval(iv); ch?.close(); ch = null; } };
}
export function invitadoLocal(salaId, cid, hooks) {
  const ch = new BroadcastChannel('puvegame:srv:' + salaId); let vivo = false;
  ch.onmessage = e => { const m = e.data; if (m?.t === 's' && (m.para === cid || m.para === '*')) { vivo = true; hooks.onMsg(m.msg); } };
  const t = setTimeout(() => { if (!vivo) hooks.onMsg({ t: 'resp', ok: false, msg: 'Nadie respondió: el anfitrión debe tener la sala abierta en este navegador' }); }, 2500);
  return { enviar: msg => ch.postMessage({ t: 'c', cid, msg }), cerrar() { clearTimeout(t); ch.close(); } };
}
