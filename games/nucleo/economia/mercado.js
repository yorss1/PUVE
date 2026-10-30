// Mercado vivo, PURO y determinista (sin red ni reloj): barrios con su mezcla de clientela, tendencias lentas,
// eventos con aviso previo, especialidades y proveedores. Todo sale de (seed, turno): recargar nunca cambia el resultado.
const mez = (...n) => { let h = 2166136261; for (const v of n) { h = Math.imul(h ^ (v | 0), 16777619); h ^= h >>> 13; } return h >>> 0; };
export const azar = (...n) => mez(...n) / 4294967296;      // 0..1 determinista
export const hash = mez;
const lim = (x, a, b) => Math.min(b, Math.max(a, x));
export const existe = (obj, k) => typeof k === 'string' && Object.hasOwn(obj, k);   // seguro frente a claves como __proto__

// ---------- clientela: qué valora cada tipo de cliente (cada fila suma 1) ----------
export const SEGMENTOS = ['estudiantes', 'familias', 'trabajadores', 'turistas', 'premium'];
export const NOMBRE_SEG = { estudiantes: 'Estudiantes', familias: 'Familias', trabajadores: 'Oficinistas', turistas: 'Turistas', premium: 'Clientes exigentes' };
export const RASGOS = ['precio', 'rapidez', 'calidad', 'ambiente', 'variedad'];
export const PREF = {
  estudiantes: { precio: .5, rapidez: .2, calidad: .05, ambiente: .1, variedad: .15 },
  familias: { precio: .3, rapidez: .1, calidad: .2, ambiente: .15, variedad: .25 },
  trabajadores: { precio: .2, rapidez: .45, calidad: .2, ambiente: .05, variedad: .1 },
  turistas: { precio: .1, rapidez: .1, calidad: .2, ambiente: .3, variedad: .3 },
  premium: { precio: 0, rapidez: .1, calidad: .4, ambiente: .4, variedad: .1 },
};

// ---------- barrios: bloques de 2×2 chunks ----------
export const BARRIO_CH = 2;
export const barrioId = (cx, cy) => `${Math.floor(cx / BARRIO_CH)},${Math.floor(cy / BARRIO_CH)}`;
export const barrioDeLote = l => barrioId(l.cx, l.cy);
const NOMBRES = ['Jardines', 'Alameda', 'Mirador', 'Reforma', 'Estación', 'Universitaria', 'Portales', 'Lomas', 'Costera', 'Mercado', 'Fábricas', 'Bosque'];
const cache = new Map();
export function perfilBarrio(seed, id) {
  const k = seed + '|' + id; if (cache.has(k)) return cache.get(k);
  const [a, b] = id.split(',').map(Number), centro = a === 0 && b === 0;
  const w = SEGMENTOS.map((s, i) => .25 + azar(seed, a, b, 100 + i));
  if (centro) { w[2] *= 1.8; w[3] *= 1.5; }
  const t = w.reduce((x, y) => x + y, 0), seg = {}; SEGMENTOS.forEach((s, i) => { seg[s] = w[i] / t; });
  const dom = SEGMENTOS.reduce((m, s) => (seg[s] > seg[m] ? s : m), SEGMENTOS[0]);
  const dir = b < 0 ? ' Norte' : b > 0 ? ' Sur' : a < 0 ? ' Oeste' : a > 0 ? ' Este' : '';
  const r = { id, nombre: centro ? 'Centro' : NOMBRES[mez(seed, a, b, 1) % NOMBRES.length] + dir, seg, dom, periodo: 360 + mez(seed, a, b, 2) % 480, fase: azar(seed, a, b, 3) };
  cache.set(k, r); return r;
}
// Tendencia lenta del barrio: crece y se enfría en ciclos de cientos de turnos (0.84 – 1.16)
export const tendenciaBarrio = (seed, id, turno) => { const p = perfilBarrio(seed, id); return 1 + .16 * Math.sin(2 * Math.PI * (turno / p.periodo + p.fase)); };

// ---------- eventos del mercado ----------
export const VENTANA = 60, ADELANTO = 6;
export const TIPOS_EVENTO = {
  festival: { n: 'Festival', ambito: 'barrio', dem: 1.5, seg: { turistas: 1.6, familias: 1.3 }, ing: 1, dur: [10, 24], txt: b => `Festival en ${b}: llega mucha más gente. Los locales de nivel bajo no darán abasto.` },
  obras: { n: 'Obras', ambito: 'barrio', dem: .6, seg: {}, ing: 1, dur: [14, 30], txt: b => `Obras en ${b}: baja el tránsito de clientes.` },
  deportivo: { n: 'Evento deportivo', ambito: 'barrio', dem: 1.35, seg: { estudiantes: 1.4, trabajadores: 1.3 }, ing: 1, dur: [8, 16], txt: b => `Partido en ${b}: sube la demanda de comida rápida y barata.` },
  lluvia: { n: 'Temporada de lluvias', ambito: 'global', dem: .82, seg: { turistas: .7 }, ing: 1, dur: [12, 30], txt: () => 'Lluvias en toda la ciudad: sale menos gente, sobre todo turistas.' },
  vacaciones: { n: 'Vacaciones', ambito: 'global', dem: 1, seg: { estudiantes: .4, turistas: 1.7, trabajadores: .8 }, ing: 1, dur: [20, 40], txt: () => 'Vacaciones: menos estudiantes y oficinistas, más turistas.' },
  inflacion: { n: 'Inflación', ambito: 'global', dem: .95, seg: {}, ing: 1.12, dur: [30, 55], txt: () => 'Inflación: los insumos cuestan más y la gente gasta un poco menos.' },
  escasez: { n: 'Escasez de insumos', ambito: 'global', dem: 1, seg: {}, ing: 1.35, dur: [8, 20], txt: () => 'Escasez de insumos: sube su precio y a quien no tenga contrato le faltará producto.', protegible: true },
  tendencia: { n: 'Moda gastronómica', ambito: 'global', dem: 1.05, seg: { premium: 1.5, turistas: 1.2 }, ing: 1, dur: [14, 30], txt: () => 'Moda gastronómica: la clientela exigente busca calidad y ambiente.' },
};
const TIPOS = Object.keys(TIPOS_EVENTO);
function eventosVentana(seed, w) {
  const r = [];
  for (let k = 0; k < 2; k++) {
    if (azar(seed, w, k, 1) > (k ? .25 : .65)) continue;
    const tipo = TIPOS[mez(seed, w, k, 2) % TIPOS.length], T = TIPOS_EVENTO[tipo];
    const dur = T.dur[0] + mez(seed, w, k, 3) % (T.dur[1] - T.dur[0] + 1), desde = w * VENTANA + 8 + mez(seed, w, k, 4) % (VENTANA - 16);
    const barrio = T.ambito === 'barrio' ? (azar(seed, w, k, 5) < .3 ? '0,0' : `${mez(seed, w, k, 6) % 3 - 1},${mez(seed, w, k, 7) % 3 - 1}`) : null;
    r.push({ id: `${w}.${k}`, tipo, desde, hasta: desde + dur, barrio });
  }
  return r;
}
// Eventos activos y los que empiezan en ≤ ADELANTO turnos (se avisan antes para que quien se prepare gane ventaja).
export function eventosEntre(seed, turno) {
  const w = Math.floor(Math.max(0, turno) / VENTANA), out = [];
  for (const x of [...(w > 0 ? eventosVentana(seed, w - 1) : []), ...eventosVentana(seed, w)]) {
    if (x.hasta <= turno) continue;
    if (x.desde <= turno) out.push({ ...x, estado: 'activo', inicia: 0 });
    else if (x.desde - turno <= ADELANTO) out.push({ ...x, estado: 'proximo', inicia: x.desde - turno });
  }
  return out;
}
export const textoEvento = (seed, e) => TIPOS_EVENTO[e.tipo].txt(e.barrio ? perfilBarrio(seed, e.barrio).nombre : '');
// Efecto sobre un lote: demanda, mezcla de clientela, costo de insumos y si hay escasez
export function efectoLote(seed, l, turno, evs = eventosEntre(seed, turno)) {
  const id = barrioDeLote(l), b = perfilBarrio(seed, id); let dem = tendenciaBarrio(seed, id, turno), ing = 1, escasez = false; const mult = {}, lista = [];
  for (const e of evs) {
    if (e.estado !== 'activo') continue; const T = TIPOS_EVENTO[e.tipo]; if (T.ambito === 'barrio' && e.barrio !== id) continue;
    dem *= T.dem; ing *= T.ing; if (T.protegible) escasez = true; for (const s in T.seg) mult[s] = (mult[s] || 1) * T.seg[s]; lista.push(e);
  }
  let t = 0; const seg = {}; for (const s of SEGMENTOS) { seg[s] = b.seg[s] * (mult[s] || 1); t += seg[s]; } for (const s of SEGMENTOS) seg[s] /= t;
  return { dem, ing, escasez, seg, lista, barrio: b };
}

// ---------- el negocio: precios, especialidades, giro, proveedor ----------
export const PRECIOS = [.8, .9, 1, 1.12, 1.25];
export const NOMBRE_PRECIO = ['Muy barato (−20%)', 'Barato (−10%)', 'Normal', 'Alto (+12%)', 'Premium (+25%)'];
export const ESPECIALIDADES = {
  volumen: { n: 'Volumen', d: 'Más clientes y rapidez; calidad y ambiente más pobres', dr: { precio: .1, rapidez: .1, calidad: -.1, ambiente: -.05 }, mant: .95 },
  calidad: { n: 'Calidad', d: 'Mejor comida y ambiente; algo más lento y caro de mantener', dr: { calidad: .2, ambiente: .05, rapidez: -.05 }, mant: 1.15 },
  rapidez: { n: 'Rapidez', d: 'Atiende rápido, con menos variedad', dr: { rapidez: .25, variedad: -.1 }, mant: 1.1 },
  exclusividad: { n: 'Exclusividad', d: 'Atrae a clientes exigentes; espanta a quien busca precio', dr: { ambiente: .25, calidad: .15, precio: -.2, variedad: -.1 }, mant: 1.3 },
};
export const GIROS_F = { restaurante: { dr: { variedad: .1, ambiente: .05, rapidez: -.05 } }, cafeteria: { dr: { rapidez: .12, precio: .05, variedad: -.08 } } };
export const PROVEEDORES = {
  mercado: { n: 'Mercado local', mult: 1, cal: 1, d: 'Precio normal, calidad normal. Sin ventajas ni riesgos.', exp: 0 },
  mayorista: { n: 'Mayorista', mult: .88, cal: .92, d: 'Insumos 12% más baratos, calidad algo menor.', exp: 0 },
  premium: { n: 'Proveedor premium', mult: 1.22, cal: 1.15, d: 'Insumos 22% más caros, mejor calidad y reputación.', exp: 0 },
  express: { n: 'Entrega exprés', mult: 1.12, cal: 1, d: 'Cuesta 12% más, pero la escasez te afecta la mitad.', exp: .5 },
};
export const CONTRATO_TURNOS = 30, CONTRATO_DTO = .96;
// Multiplicador efectivo de costo de insumos: con contrato queda fijo; sin contrato sube con la inflación/escasez (el exprés lo amortigua)
export function costoInsumos(provId, ev = 1, contrato = false) {
  const pr = existe(PROVEEDORES, provId) ? PROVEEDORES[provId] : PROVEEDORES.mercado;
  if (contrato) return pr.mult * CONTRATO_DTO;
  return pr.mult * (1 + (ev - 1) * (1 - pr.exp));
}
const ajusta = (r, dr) => { for (const k in dr) r[k] += dr[k]; };
export function rasgos(o, prov = PROVEEDORES.mercado) {
  const n = (o.nivel ?? 1) - 1, rep = o.rep ?? 5, hab = o.ger?.hab ?? 0, pm = PRECIOS[o.p ?? 2] ?? 1;
  const r = { precio: pm ** -1.4, rapidez: 1 + .06 * n + .03 * hab, calidad: 1 + .08 * (rep - 5) + .04 * n + (prov.cal - 1) + .02 * hab, ambiente: 1 + .08 * n, variedad: 1 + .05 * n };
  if (existe(ESPECIALIDADES, o.esp)) ajusta(r, ESPECIALIDADES[o.esp].dr);
  if (existe(GIROS_F, o.giro)) ajusta(r, GIROS_F[o.giro].dr);
  return r;
}
// Qué tanto encaja un negocio con la clientela de un lote (1 = neutral)
export function encaje(seg, r) {
  let s = 0; for (const c of SEGMENTOS) { let f = 1; for (const k of RASGOS) f += PREF[c][k] * (r[k] - 1); s += seg[c] * f; }
  return lim(s, .35, 2);
}
// Valor percibido: calidad (sin la propia reputación) frente al precio; mueve la reputación a largo plazo
export function valorPercibido(o, prov = PROVEEDORES.mercado) {
  const n = (o.nivel ?? 1) - 1, hab = o.ger?.hab ?? 0, pm = PRECIOS[o.p ?? 2] ?? 1; let q = 1 + .04 * n + (prov.cal - 1) + .02 * hab;
  if (existe(ESPECIALIDADES, o.esp)) q += ESPECIALIDADES[o.esp].dr.calidad || 0;
  return q / pm;
}
