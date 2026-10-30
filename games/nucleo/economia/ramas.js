// Ramas de desarrollo: cada decisión da una ventaja y cuesta algo. No hay una ruta superior a todas.
//  donde 'local'  → se paga con el dinero de tu negocio y afecta a tu local (lo aplica la simulación del local)
//  donde 'cadena' → se paga con tu cuenta de franquicias y afecta a tus franquicias (la valida el servidor)
// Efectos: factores (mult) se multiplican; los aditivos se suman.
export const RAMAS = {
  operaciones: { n: 'Operaciones', d: 'Cómo se cocina y se atiende.' },
  personal: { n: 'Personal', d: 'Tu equipo: costo contra rendimiento.' },
  producto: { n: 'Producto y marca', d: 'Qué vendes y a qué precio.' },
  finanzas: { n: 'Finanzas', d: 'Crédito, intereses y reservas.' },
  expansion: { n: 'Expansión', d: 'Cuántas franquicias y a qué costo.' },
  reputacion: { n: 'Reputación e influencia', d: 'Tu nombre en la ciudad.' },
};
export const NODOS = [
  // --- locales (dinero del negocio) ---
  { id: 'op_auto', rama: 'operaciones', donde: 'local', n: 'Cocina automatizada', costo: 400, nivel: 3, pro: 'Cocinas 25% más rápido', contra: 'Platos menos artesanales: −0.04 de reputación por servicio', ef: { cocina: .75, repServ: -.04 }, excluye: ['op_flujo'] },
  { id: 'op_flujo', rama: 'operaciones', donde: 'local', n: 'Distribución eficiente', costo: 250, nivel: 2, pro: 'Los clientes esperan 25% más', contra: 'Cuesta $5 por minuto de operación', ef: { paciencia: 1.25, gasto: 5 }, excluye: ['op_auto'] },
  { id: 'per_equipo', rama: 'personal', donde: 'local', n: 'Equipo experimentado', costo: 300, nivel: 3, pro: 'Ayudantes con +1 de habilidad y mejor reputación', contra: 'Sueldos +15%', ef: { sueldos: 1.15, hab: 1, repServ: .03 }, excluye: ['per_barato'] },
  { id: 'per_barato', rama: 'personal', donde: 'local', n: 'Equipo económico', costo: 150, nivel: 2, pro: 'Sueldos −15%', contra: 'Ayudantes 10% más lentos', ef: { sueldos: .85, cocina: 1.1 }, excluye: ['per_equipo'] },
  { id: 'prod_calidad', rama: 'producto', donde: 'local', n: 'Cocina de autor', costo: 350, nivel: 3, pro: 'Platos +15% de precio y más reputación', contra: 'Ingredientes +20% más caros', ef: { precio: 1.15, ing: 1.2, repServ: .05 }, excluye: ['prod_volumen'] },
  { id: 'prod_volumen', rama: 'producto', donde: 'local', n: 'Cocina de volumen', costo: 250, nivel: 2, pro: '15% más clientes y 10% más XP', contra: 'Precios −8%', ef: { precio: .92, spawn: .85, xp: 1.1 }, excluye: ['prod_calidad'] },
  // --- de cadena (cuenta de franquicias) ---
  { id: 'fin_credito', rama: 'finanzas', donde: 'cadena', n: 'Línea de crédito amplia', costo: 300, pro: 'Límite de deuda +50%', contra: 'Intereses +25%', ef: { prestamo: 1.5, interes: 1.25 }, excluye: ['fin_reserva'] },
  { id: 'fin_reserva', rama: 'finanzas', donde: 'cadena', n: 'Política de reservas', costo: 250, pro: 'Intereses −30%', contra: 'Ingresos de franquicias −3% (capital inmovilizado)', ef: { interes: .7, ingF: .97 }, excluye: ['fin_credito'] },
  { id: 'exp_franq', rama: 'expansion', donde: 'cadena', n: 'Red de socios', costo: 500, pro: 'Hasta 2 franquicias más', contra: 'Mantenimiento +10%', ef: { maxF: 2, mantF: 1.1 }, excluye: [] },
  { id: 'exp_logistica', rama: 'expansion', donde: 'cadena', n: 'Logística propia', costo: 350, pro: 'Mantenimiento −15% y +10% de capacidad', contra: 'Mejorar franquicias cuesta 10% más', ef: { mantF: .85, capF: .1, mej: 1.1 }, excluye: [] },
  { id: 'rep_marca', rama: 'reputacion', donde: 'cadena', n: 'Campañas de marca', costo: 400, pro: 'Reputación objetivo +0.6 en tus franquicias', contra: 'Mantenimiento +5%', ef: { repF: .6, mantF: 1.05 }, excluye: [] },
  { id: 'rep_negocia', rama: 'reputacion', donde: 'cadena', n: 'Negociación dura', costo: 300, pro: 'Insumos 10% más baratos', contra: 'Reputación objetivo −0.2 (proveedores molestos)', ef: { insumos: .9, repF: -.2 }, excluye: [] },
];
export const nodo = id => NODOS.find(n => n.id === id) || null;
export const nodosDe = donde => NODOS.filter(n => n.donde === donde);
const MULT = ['cocina', 'paciencia', 'precio', 'spawn', 'sueldos', 'ing', 'xp', 'prestamo', 'interes', 'ingF', 'mantF', 'mej', 'insumos'];
export function efectos(ids) {
  const e = { cocina: 1, paciencia: 1, precio: 1, spawn: 1, sueldos: 1, ing: 1, xp: 1, prestamo: 1, interes: 1, ingF: 1, mantF: 1, mej: 1, insumos: 1, repServ: 0, gasto: 0, hab: 0, maxF: 0, capF: 0, repF: 0 };
  for (const id of ids || []) { const n = nodo(id); if (!n) continue; for (const k in n.ef) e[k] = MULT.includes(k) ? e[k] * n.ef[k] : e[k] + n.ef[k]; }
  return e;
}
// ¿Se puede adquirir? (no repetida y sin chocar con una rama excluyente)
export function puedeNodo(tengo, id) {
  const n = nodo(id); if (!n) return 'Mejora inexistente';
  if (tengo.includes(id)) return 'Ya la tienes';
  const x = n.excluye.find(e => tengo.includes(e)); if (x) return `Incompatible con «${nodo(x).n}»`;
  return null;
}
