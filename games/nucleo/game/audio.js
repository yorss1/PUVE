// Audio sintetizado con WebAudio: sin archivos que descargar. Se activa con el primer gesto del usuario.
export function crearAudio(activo = true) {
  let ac = null, on = activo;
  const N = { ok: [[660, .08], [880, .1]], moneda: [[988, .06], [1319, .14]], pedido: [[523, .07]], error: [[196, .18]], nivel: [[523, .1], [659, .1], [784, .1], [1047, .2]], combo: [[523, .05], [659, .05], [784, .09]], perfecto: [[1319, .04], [1760, .04], [2093, .1]], rush: [[330, .1], [262, .1], [330, .1], [262, .2]], rushOk: [[523, .07], [659, .07], [784, .07], [1047, .07], [1319, .25]], rompe: [[392, .09], [330, .09], [247, .2]], listo: [[1568, .05]], enojo: [[150, .14]], sello: [[784, .07], [988, .07], [1175, .07], [1568, .22]], reparto: [[660, .05], [990, .09]], tictac: [[880, .03]] };
  return {
    on: () => on, alternar() { on = !on; },
    activar() { if (!ac) { const C = window.AudioContext || window.webkitAudioContext; if (C) ac = new C(); } if (ac && ac.state === 'suspended') ac.resume(); },
    tono(n, k = 0) {
      if (!on || !ac) return; let t = ac.currentTime, m = Math.pow(2, Math.max(0, Math.min(12, k)) / 12);   // k = semitonos: la racha sube el tono
      for (const [f, d] of N[n] || []) { const o = ac.createOscillator(), g = ac.createGain(); o.type = 'square'; o.frequency.value = f * m; g.gain.setValueAtTime(.05, t); g.gain.exponentialRampToValueAtTime(.0001, t + d); o.connect(g).connect(ac.destination); o.start(t); o.stop(t + d); t += d; }
    }
  };
}
