// Audio sintetizado con WebAudio: sin archivos que descargar. Se activa con el primer gesto del usuario.
export function crearAudio(activo = true) {
  let ac = null, on = activo;
  const N = { ok: [[660, .08], [880, .1]], moneda: [[988, .06], [1319, .14]], pedido: [[523, .07]], error: [[196, .18]], nivel: [[523, .1], [659, .1], [784, .1], [1047, .2]] };
  return {
    on: () => on, alternar() { on = !on; },
    activar() { if (!ac) { const C = window.AudioContext || window.webkitAudioContext; if (C) ac = new C(); } if (ac && ac.state === 'suspended') ac.resume(); },
    tono(n) {
      if (!on || !ac) return; let t = ac.currentTime;
      for (const [f, d] of N[n] || []) { const o = ac.createOscillator(), g = ac.createGain(); o.type = 'square'; o.frequency.value = f; g.gain.setValueAtTime(.05, t); g.gain.exponentialRampToValueAtTime(.0001, t + d); o.connect(g).connect(ac.destination); o.start(t); o.stop(t + d); t += d; }
    }
  };
}
