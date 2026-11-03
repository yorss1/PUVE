// «Chispa»: efectos de feedback (textos flotantes con fuente pixelada de 3×5, chispas, monedas, destellos y temblor).
// Solo usa R(color, x, y, w, h), así se puede probar en node. Las coordenadas son del mundo (px); la pantalla se dibuja aparte.
const F = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111', F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010', U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010', Z: '111001010100111',
  0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110', 4: '101101111001001', 5: '111100110001110', 6: '011100111101111', 7: '111001010010010', 8: '111101111101111', 9: '111101111001110', '+': '000010111010000', '-': '000000111000000', $: '011110010011110', '!': '010010010000010', '.': '000000000000010', '%': '101001010100101', ' ': '000000000000000', '?': '110001010000010',
};
const norm = s => String(s).toUpperCase().replace(/[ÁÀÄ]/g, 'A').replace(/[ÉÈË]/g, 'E').replace(/[ÍÌÏ]/g, 'I').replace(/[ÓÒÖ]/g, 'O').replace(/[ÚÙÜ]/g, 'U').replace(/Ñ/g, 'N').replace(/[¡]/g, '!').replace(/[¿]/g, '?').replace(/[^A-Z0-9+\-$!.% ?]/g, '');
export const anchoTexto = (s, e = 1) => norm(s).length * 4 * e - (norm(s).length ? e : 0);
export function texto(R, s, x, y, color, e = 1, borde = '#2a1f1d') {
  const t = norm(s);
  for (const [col, dx, dy] of [[borde, 1, 0], [borde, -1, 0], [borde, 0, 1], [borde, 0, -1], [color, 0, 0]]) {
    let cx = x; for (const ch of t) { const g = F[ch] || F[' ']; for (let i = 0; i < 15; i++) if (g[i] === '1') R(col, cx + (i % 3) * e + dx, y + Math.floor(i / 3) * e + dy, e, e); cx += 4 * e; }
  }
}
export const COLORES = { oro: '#ffd23f', verde: '#7ae07a', rojo: '#ff6a5a', cian: '#7ae0f0', blanco: '#ffffff', naranja: '#ffa040', rosa: '#ff8ad0' };
export function crearFx(rnd = Math.random) {
  const tx = [], pt = [], pan = []; let flash = null, tiemblaT = 0, tiemblaM = 0;
  return {
    texto(x, y, s, color = COLORES.oro, e = 1, vida = 1.1) { tx.push({ x: x - anchoTexto(s, e) / 2, y, s, color, e, t: 0, vida }); if (tx.length > 40) tx.shift(); },
    chispas(x, y, n = 8, colores = [COLORES.oro, COLORES.blanco], v = 40) { for (let i = 0; i < n; i++) { const a = rnd() * 6.283, r = v * (.4 + rnd() * .8); pt.push({ x, y, vx: Math.cos(a) * r, vy: Math.sin(a) * r - 15, t: 0, vida: .35 + rnd() * .4, c: colores[i % colores.length], g: 90, w: rnd() < .3 ? 2 : 1 }); } if (pt.length > 220) pt.splice(0, pt.length - 220); },
    monedas(x, y, n = 6) { for (let i = 0; i < n; i++) pt.push({ x: x + (rnd() - .5) * 6, y, vx: (rnd() - .5) * 50, vy: -50 - rnd() * 50, t: 0, vida: .7 + rnd() * .3, c: i % 2 ? '#ffd23f' : '#f0a020', g: 200, w: 2 }); if (pt.length > 220) pt.splice(0, pt.length - 220); },
    humo(x, y) { pt.push({ x: x + (rnd() - .5) * 6, y, vx: (rnd() - .5) * 6, vy: -14 - rnd() * 8, t: 0, vida: .9, c: '#9a9a9a', g: -4, w: 2 }); if (pt.length > 220) pt.splice(0, pt.length - 220); },
    banner(s, color = COLORES.oro, vida = 1.8) { pan.push({ s, color, t: 0, vida }); if (pan.length > 3) pan.shift(); },
    destello(color = '#ffffff', a = .35, vida = .18) { flash = { color, a, t: 0, vida }; },
    tiembla(m = 2, t = .2) { tiemblaM = m; tiemblaT = t; },
    sacudida() { return tiemblaT > 0 ? { x: Math.round((rnd() - .5) * 2 * tiemblaM), y: Math.round((rnd() - .5) * 2 * tiemblaM) } : { x: 0, y: 0 }; },
    paso(dt) {
      for (const a of [tx, pt, pan]) for (let i = a.length - 1; i >= 0; i--) { const o = a[i]; o.t += dt; if (o.vx !== undefined) { o.x += o.vx * dt; o.y += o.vy * dt; o.vy += o.g * dt; } if (o.t >= o.vida) a.splice(i, 1); }
      if (flash && (flash.t += dt) >= flash.vida) flash = null; if (tiemblaT > 0) tiemblaT -= dt;
    },
    dibujar(R) {
      for (const p of pt) R(p.t > p.vida * .7 ? '#ffffff88' === p.c ? p.c : p.c : p.c, Math.round(p.x), Math.round(p.y), p.w, p.w);
      for (const o of tx) { const k = o.t / o.vida, sube = Math.round(k * 14), e = o.e; if (k < .85 || Math.floor(o.t * 20) % 2) texto(R, o.s, Math.round(o.x), Math.round(o.y) - sube, o.color, e); }
    },
    dibujarPantalla(R, w, h) {
      if (flash) R(flash.color + Math.round(flash.a * (1 - flash.t / flash.vida) * 255).toString(16).padStart(2, '0'), 0, 0, w, h);
      pan.forEach((b, i) => { const k = b.t / b.vida, e = 3, ancho = anchoTexto(b.s, e), y = Math.round(18 + i * 22 - (k > .8 ? (k - .8) * 60 : 0)), a = k < .1 ? k * 10 : 1; if (a > .3) { R('#2a1f1dcc', Math.round(w / 2 - ancho / 2) - 6, y - 4, ancho + 12, 7 * e + 3); texto(R, b.s, Math.round(w / 2 - ancho / 2), y, b.color, e); } });
    },
    cuenta: () => ({ textos: tx.length, particulas: pt.length, banners: pan.length, flash: !!flash }),
  };
}
// íconos de personalidad de cliente (5×5 px)
export const ICONOS = { apurado: ['00110', '01100', '00110', '00110', '01100'], generoso: ['01110', '10110', '10101', '11011', '01110'], critico: ['11110', '10010', '11110', '10010', '11110'], vip: ['00100', '11111', '01110', '01010', '10001'] };
export const COLOR_ICONO = { apurado: '#ffd23f', generoso: '#ffcc40', critico: '#f4f0e8', vip: '#ff8ad0' };
export function icono(R, tipo, x, y) { const g = ICONOS[tipo]; if (!g) return; R('#2a1f1d', x - 1, y - 1, 7, 7); g.forEach((f, j) => [...f].forEach((c, i) => { if (c === '1') R(COLOR_ICONO[tipo], x + i, y + j, 1, 1); })); }
