// Campaña, misiones y logros (PURO). Se evalúan sobre un objeto de estadísticas; no tocan la simulación.
//   stats = { nivel, rep, dinero, servidos, perdidos, racha, mejorRacha, semanas, empleados, gerenteLocal, ramasLocal,
//             franq, patrimonio, puesto, jugadores, ramasCadena, gerentesF, deuda, prestamosPagados, compradasVenta, quiebras, contratos }
export const SEMANA_S = 600;      // una «semana» de juego = 10 min dentro del local
export const ETAPAS = [
  { n: 1, t: 'Sobrevivir', d: 'Termina una semana sin quedarte sin efectivo ni ingredientes.', ok: s => s.semanas >= 1 },
  { n: 2, t: 'Hacerte un nombre', d: 'Sube de nivel y construye reputación.', ok: s => s.nivel >= 4 && s.servidos >= 40 },
  { n: 3, t: 'Dominar un barrio', d: 'Abre tu primera franquicia y gánate a la clientela de la zona.', ok: s => s.franq >= 1 && s.patrimonio >= 2500 },
  { n: 4, t: 'Construir una empresa', d: 'Varias sucursales, gerentes y una estrategia propia.', ok: s => s.franq >= 3 && s.gerentesF >= 1 },
  { n: 5, t: 'Legado', d: 'Lidera la ciudad.', ok: () => false },
];
export const etapaActual = s => { let i = 0; while (i < ETAPAS.length - 1 && ETAPAS[i].ok(s)) i++; return ETAPAS[i]; };
// Qué se desbloquea por etapa (se aplica en la interfaz; el servidor acepta todo y por eso no depende de esto)
export const DESBLOQUEOS = { especialidad: 2, proveedores: 2, contratos: 3, gerente: 3, ramasCadena: 3 };
export const desbloqueado = (etapa, id) => etapa >= (DESBLOQUEOS[id] ?? 1);

const M = (id, etapa, h, n, desc, meta, medir, premio) => ({ id, etapa, h, n, desc, meta, medir, premio });
export const MISIONES = [
  M('e1_racha', 1, 'inmediato', 'Racha limpia', 'Sirve 5 pedidos seguidos sin que se vaya nadie', 5, s => s.racha, { dinero: 40 }),
  M('e1_ayudante', 1, 'sesion', 'Primer ayudante', 'Contrata a tu primer ayudante', 1, s => s.empleados, { dinero: 60 }),
  M('e1_semana', 1, 'largo', 'La primera semana', 'Termina una semana sin quedarte sin efectivo ni ingredientes', 1, s => s.semanas, { dinero: 120, titulo: 'Sobreviviente' }),
  M('e2_racha', 2, 'inmediato', 'Servicio fluido', 'Sirve 12 pedidos seguidos', 12, s => s.racha, { dinero: 80 }),
  M('e2_rama', 2, 'sesion', 'Tu propio estilo', 'Adquiere una mejora de las ramas de desarrollo', 1, s => s.ramasLocal, { dinero: 100 }),
  M('e2_nivel', 2, 'largo', 'Nombre propio', 'Llega al nivel 4 y sirve 40 pedidos', 40, s => (s.nivel >= 4 ? s.servidos : 0), { dinero: 200, titulo: 'Cara conocida' }),
  M('e3_franq', 3, 'sesion', 'Primera sucursal', 'Abre tu primera franquicia', 1, s => s.franq, { dinero: 150 }),
  M('e3_pat', 3, 'inmediato', 'Capital en movimiento', 'Llega a $2,500 de patrimonio', 2500, s => s.patrimonio, { dinero: 120 }),
  M('e3_contrato', 3, 'largo', 'Proveedor de confianza', 'Firma un contrato con un proveedor', 1, s => s.contratos, { dinero: 200, titulo: 'Comprador astuto' }),
  M('e4_tres', 4, 'sesion', 'Cadena en crecimiento', 'Ten 3 franquicias abiertas', 3, s => s.franq, { dinero: 300 }),
  M('e4_ger', 4, 'inmediato', 'Delegar', 'Contrata a un gerente para una franquicia', 1, s => s.gerentesF, { dinero: 200 }),
  M('e4_pat', 4, 'largo', 'Empresa sólida', 'Llega a $8,000 de patrimonio', 8000, s => s.patrimonio, { dinero: 500, titulo: 'Empresario' }),
  M('e5_lider', 5, 'largo', 'El número uno', 'Ocupa el primer puesto del ranking con 3 o más franquicias', 1, s => (s.puesto === 1 && s.franq >= 3 && s.jugadores > 1 ? 1 : 0), { dinero: 1000, titulo: 'Magnate' }),
  M('e5_pat', 5, 'sesion', 'Imperio', 'Llega a $20,000 de patrimonio', 20000, s => s.patrimonio, { dinero: 800 }),
  M('e5_deuda', 5, 'inmediato', 'Sin deudas', 'Ten patrimonio de $10,000 sin deuda', 10000, s => (s.deuda === 0 ? s.patrimonio : 0), { dinero: 400 }),
];
export const LOGROS = [
  ['primer_cobro', 'Primera venta', 'Sirve tu primer pedido', s => s.servidos >= 1],
  ['cien', 'Local concurrido', 'Sirve 100 pedidos', s => s.servidos >= 100],
  ['quinientos', 'Institución', 'Sirve 500 pedidos', s => s.servidos >= 500],
  ['racha10', 'Sin un error', 'Racha de 10 pedidos', s => s.mejorRacha >= 10],
  ['semana', 'Semana redonda', 'Completa una semana sin apuros', s => s.semanas >= 1],
  ['nivel5', 'Veterano', 'Llega al nivel 5', s => s.nivel >= 5],
  ['nivel10', 'Maestro', 'Llega al nivel 10', s => s.nivel >= 10],
  ['franq1', 'Expansión', 'Abre una franquicia', s => s.franq >= 1],
  ['franq3', 'Cadena', 'Ten 3 franquicias', s => s.franq >= 3],
  ['gerente', 'Mano derecha', 'Contrata a un gerente', s => s.gerentesF >= 1 || s.gerenteLocal],
  ['ganga', 'Ojo de halcón', 'Compra un local que un rival puso en venta', s => s.compradasVenta >= 1],
  ['recuperacion', 'De las cenizas', 'Quiebra una franquicia y vuelve a tener 3', s => s.quiebras >= 1 && s.franq >= 3],
  ['saldada', 'Deuda saldada', 'Paga por completo un préstamo', s => s.prestamosPagados >= 1],
  ['lider', 'En la cima', 'Sé el primero del ranking frente a rivales', s => s.puesto === 1 && s.jugadores > 1 && s.franq >= 1],
  ['mil', 'Cinco cifras', 'Llega a $10,000 de patrimonio', s => s.patrimonio >= 10000],
];
const nuevoProg = () => ({ reclamadas: [], logros: [], titulo: '' });
export const limpiarProg = p => ({ reclamadas: (Array.isArray(p?.reclamadas) ? p.reclamadas : []).filter(x => MISIONES.some(m => m.id === x)), logros: (Array.isArray(p?.logros) ? p.logros : []).filter(x => LOGROS.some(l => l[0] === x)), titulo: typeof p?.titulo === 'string' ? p.titulo.slice(0, 24) : '' });
export const progresoMision = (m, s) => Math.min(m.meta, Math.max(0, Math.floor(m.medir(s) || 0)));
// Misiones de la etapa actual (y las anteriores sin reclamar), con su avance
export function misionesActivas(s, prog) {
  const e = etapaActual(s).n, p = limpiarProg(prog);
  return MISIONES.filter(m => m.etapa <= e && !(p.reclamadas.includes(m.id) && m.etapa < e)).map(m => { const av = progresoMision(m, s); return { ...m, avance: av, hecha: av >= m.meta, reclamada: p.reclamadas.includes(m.id) }; });
}
// Reclama la recompensa; devuelve el premio para que la interfaz lo aplique, y el progreso actualizado
export function reclamar(s, prog, id) {
  const p = limpiarProg(prog), m = MISIONES.find(x => x.id === id);
  if (!m) return { ok: false, msg: 'Misión inexistente', prog: p };
  if (p.reclamadas.includes(id)) return { ok: false, msg: 'Ya la reclamaste', prog: p };
  if (progresoMision(m, s) < m.meta) return { ok: false, msg: 'Aún no la completas', prog: p };
  p.reclamadas.push(id); if (m.premio.titulo) p.titulo = m.premio.titulo;
  return { ok: true, msg: `Recompensa: ${m.premio.dinero ? '+$' + m.premio.dinero : ''}${m.premio.titulo ? ` · Título «${m.premio.titulo}»` : ''}`, premio: m.premio, prog: p };
}
// Logros nuevos desde la última evaluación
export function evaluarLogros(s, prog) {
  const p = limpiarProg(prog), nuevos = [];
  for (const [id, n, , f] of LOGROS) if (!p.logros.includes(id) && f(s)) { p.logros.push(id); nuevos.push(n); }
  return { prog: p, nuevos };
}
