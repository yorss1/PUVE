// Generador de QR de PUVE (modo byte, corrección L, versiones 1-10), sin librerías externas. Copiado de PUVE/pruebas/qr.js y empaquetado como módulo.
  // ===== Generador de QR (modo byte, corrección L, versiones 1-10) — sin librerías externas =====
  const QR_ECL = [[7,1],[10,1],[15,1],[20,1],[26,1],[18,2],[20,2],[24,2],[30,2],[18,4]];
  const QR_TOTAL = [26,44,70,100,134,172,196,242,292,346];
  const QR_ALIGN = [[],[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,26,46],[6,28,50]];
export function qrMatriz(texto){
    const bytes = Array.from(new TextEncoder().encode(texto));
    let v = 0;
    for(; v < 10; v++){ const dcw = QR_TOTAL[v] - QR_ECL[v][0] * QR_ECL[v][1]; if(4 + (v < 9 ? 8 : 16) + bytes.length * 8 <= dcw * 8) break; }
    if(v >= 10) throw new Error('El enlace es demasiado largo para el QR');
    const ver = v + 1, size = ver * 4 + 17, ecb = QR_ECL[v][0], nb = QR_ECL[v][1], total = QR_TOTAL[v], dcw = total - ecb * nb;
    const bits = []; const put = (val, len) => { for(let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    put(4, 4); put(bytes.length, ver < 10 ? 8 : 16); bytes.forEach(b => put(b, 8));
    put(0, Math.min(4, dcw * 8 - bits.length)); while(bits.length % 8) bits.push(0);
    for(let pad = 0xEC; bits.length < dcw * 8; pad ^= 0xEC ^ 0x11) put(pad, 8);
    const cw = []; for(let i = 0; i < bits.length; i += 8) cw.push(parseInt(bits.slice(i, i + 8).join(''), 2));
    const exp = [], log = []; let x = 1;
    for(let i = 0; i < 255; i++){ exp[i] = x; log[x] = i; x <<= 1; if(x & 256) x ^= 0x11D; } for(let i = 255; i < 512; i++) exp[i] = exp[i - 255];
    const mul = (a, b) => (a && b) ? exp[log[a] + log[b]] : 0;
    let gen = [1];
    for(let i = 0; i < ecb; i++){ const ng = new Array(gen.length + 1).fill(0); gen.forEach((c, j) => { ng[j] ^= c; ng[j + 1] ^= mul(c, exp[i]); }); gen = ng; }
    const shortN = nb - total % nb, shortLen = Math.floor(total / nb) - ecb, blocks = [], ecs = []; let pos = 0;
    for(let b = 0; b < nb; b++){
      const d = cw.slice(pos, pos + shortLen + (b < shortN ? 0 : 1)); pos += d.length; blocks.push(d);
      const rem = new Array(ecb).fill(0); d.forEach(byte => { const f = byte ^ rem.shift(); rem.push(0); for(let j = 0; j < ecb; j++) rem[j] ^= mul(gen[j + 1], f); }); ecs.push(rem);
    }
    const all = []; for(let i = 0; i <= shortLen; i++) blocks.forEach(b => { if(i < b.length) all.push(b[i]); }); for(let i = 0; i < ecb; i++) ecs.forEach(e => all.push(e[i]));
    const dbits = []; all.forEach(b => { for(let i = 7; i >= 0; i--) dbits.push((b >>> i) & 1); });
    const m = Array.from({ length: size }, () => new Array(size).fill(false)), fn = Array.from({ length: size }, () => new Array(size).fill(false));
    const setF = (xx, yy, d) => { if(xx >= 0 && xx < size && yy >= 0 && yy < size){ m[yy][xx] = d; fn[yy][xx] = true; } };
    for(let i = 0; i < size; i++){ setF(6, i, i % 2 === 0); setF(i, 6, i % 2 === 0); }
    [[3, 3], [size - 4, 3], [3, size - 4]].forEach(([cx, cy]) => { for(let dy = -4; dy <= 4; dy++) for(let dx = -4; dx <= 4; dx++){ const d = Math.max(Math.abs(dx), Math.abs(dy)); setF(cx + dx, cy + dy, d !== 2 && d !== 4); } });
    const ap = QR_ALIGN[v], last = ap.length - 1;
    ap.forEach((ax, i) => ap.forEach((ay, j) => { if((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return;
      for(let dy = -2; dy <= 2; dy++) for(let dx = -2; dx <= 2; dx++) setF(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1); }));
    const formato = (mask) => {
      const data = (1 << 3) | mask; let rem = data; for(let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      const f = ((data << 10) | rem) ^ 0x5412, bit = (i) => ((f >>> i) & 1) !== 0;
      for(let i = 0; i <= 5; i++) setF(8, i, bit(i)); setF(8, 7, bit(6)); setF(8, 8, bit(7)); setF(7, 8, bit(8)); for(let i = 9; i < 15; i++) setF(14 - i, 8, bit(i));
      for(let i = 0; i < 8; i++) setF(size - 1 - i, 8, bit(i)); for(let i = 8; i < 15; i++) setF(8, size - 15 + i, bit(i)); setF(8, size - 8, true);
    };
    formato(0);
    if(ver >= 7){ let rem = ver; for(let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25); const vb = (ver << 12) | rem;
      for(let i = 0; i < 18; i++){ const d = ((vb >>> i) & 1) !== 0, a = size - 11 + i % 3, b = Math.floor(i / 3); setF(a, b, d); setF(b, a, d); } }
    let k = 0;
    for(let right = size - 1; right >= 1; right -= 2){ if(right === 6) right = 5;
      for(let vert = 0; vert < size; vert++) for(let j = 0; j < 2; j++){ const xx = right - j, up = ((right + 1) & 2) === 0, yy = up ? size - 1 - vert : vert;
        if(!fn[yy][xx] && k < dbits.length){ m[yy][xx] = dbits[k] === 1; k++; } } }
    const masks = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x, y) => x % 3 === 0, (x, y) => (x + y) % 3 === 0, (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
      (x, y) => x * y % 2 + x * y % 3 === 0, (x, y) => (x * y % 2 + x * y % 3) % 2 === 0, (x, y) => ((x + y) % 2 + x * y % 3) % 2 === 0];
    const aplicar = (mk) => { for(let y = 0; y < size; y++) for(let xx = 0; xx < size; xx++) if(!fn[y][xx] && masks[mk](xx, y)) m[y][xx] = !m[y][xx]; };
    const penal = () => {
      let p = 0, oscuros = 0; const filas = m.map(r => r.map(c => c ? '1' : '0').join('')), cols = [];
      for(let xx = 0; xx < size; xx++){ let s = ''; for(let y = 0; y < size; y++) s += m[y][xx] ? '1' : '0'; cols.push(s); }
      filas.concat(cols).forEach(s => { (s.match(/0{5,}|1{5,}/g) || []).forEach(r => { p += r.length - 2; }); p += 40 * ((s.match(/(?=10111010000|00001011101)/g) || []).length); });
      for(let y = 0; y < size - 1; y++) for(let xx = 0; xx < size - 1; xx++){ const c = m[y][xx]; if(c === m[y][xx + 1] && c === m[y + 1][xx] && c === m[y + 1][xx + 1]) p += 3; }
      m.forEach(r => r.forEach(c => { if(c) oscuros++; })); p += 10 * Math.floor(Math.abs(oscuros * 100 / (size * size) - 50) / 5); return p;
    };
    let mejor = 0, mp = Infinity;
    for(let mk = 0; mk < 8; mk++){ aplicar(mk); formato(mk); const p = penal(); if(p < mp){ mp = p; mejor = mk; } aplicar(mk); }
    aplicar(mejor); formato(mejor); return m;
  }
