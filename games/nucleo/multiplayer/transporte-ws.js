// Cliente WebSocket con reconexión automática. El servidor deriva tu id público a partir de `jid` (secreto que nunca se difunde).
export function conectarWS(url, jid, hooks) {
  let ws, cerrado = false, intento = 0; const cola = [];
  const abrir = () => {
    ws = new WebSocket(url);
    ws.onopen = () => { intento = 0; hooks.onEstado?.('conectado'); ws.send(JSON.stringify({ t: 'hola', jid })); };
    ws.onmessage = e => { try { hooks.onMsg(JSON.parse(e.data)); } catch (err) { console.warn('Mensaje inválido del servidor', err); } };
    ws.onclose = () => { if (cerrado) return; hooks.onEstado?.('reconectando'); setTimeout(abrir, Math.min(8000, 500 * 2 ** intento++)); };
  };
  abrir();
  return {
    enviar(m) { const s = JSON.stringify(m); if (ws.readyState === 1) { while (cola.length) ws.send(cola.shift()); ws.send(s); } else if (m.t !== 'mover' && cola.length < 50) cola.push(s); },
    cerrar() { cerrado = true; ws.close(); }
  };
}
