// Paneles de la Fase 1-2 (campaña, mercado, rivales, personal, proveedores, ramas, gestión de franquicias, informe de regreso).
// Solo presentación: toda la lógica vive en sim.js, mundo.js y economia/*. Recibe las piezas de menú de main.js por inyección.
import { precioLote, SUELDO_GER, PROMO_COSTO, PROMO_TURNOS, TURNO_MS } from '../multiplayer/mundo.js';
import { NOMBRE_SEG, SEGMENTOS, PROVEEDORES, ESPECIALIDADES, PRECIOS, NOMBRE_PRECIO, CONTRATO_TURNOS } from '../economia/mercado.js';
import { PERFILES } from '../economia/rivales.js';
import { RAMAS, NODOS, puedeNodo } from '../economia/ramas.js';
import { ETAPAS, etapaActual, desbloqueado, DESBLOQUEOS, misionesActivas, reclamar, evaluarLogros, limpiarProg, LOGROS } from '../economia/progresion.js';
import { espera } from './sim.js';

export function crearPaneles(c) {
  const { el, txt, btn, sec, stat, chip, icono, abrir, aviso, audio, eco, sim, perfil, store, guardar, mundo, net, volver } = c;
  const fila = (...h) => { const f = el('div', 'fila'); h.forEach(x => f.appendChild(x)); return f; };
  const barra = (v, max = 1, col = '#d9822b') => { const b = el('div'); b.style.cssText = 'height:6px;border-radius:3px;background:rgba(128,128,128,.25);overflow:hidden;margin:2px 0 6px'; const i = el('div'); i.style.cssText = `height:100%;width:${Math.round(Math.max(0, Math.min(1, v / max)) * 100)}%;background:${col}`; b.appendChild(i); return b; };
  const dinero = n => (n < 0 ? '−$' : '$') + Math.abs(Math.round(n)).toLocaleString('es');
  const cuando = n => `${n} turno${n === 1 ? '' : 's'} (${Math.round(n * TURNO_MS / 1000)} s)`;

  // ---------- estadísticas del jugador para campaña, misiones y logros ----------
  function stats() {
    const m = mundo(), mio = m?.mio, n = net(), d = sim.d, st = d.st, yo = m?.jugadores.find(j => j.cid === n?.cid), idx = m ? m.jugadores.findIndex(j => j.cid === n?.cid) : -1;
    return { nivel: sim.nivel, rep: d.rep, dinero: d.dinero, servidos: st.servidos, perdidos: st.perdidos, racha: st.racha, mejorRacha: st.mejor, semanas: st.semanas, empleados: sim.emps.length, gerenteLocal: !!sim.gerente, ramasLocal: d.ramas.length,
      franq: yo?.franq ?? 0, patrimonio: yo?.patrimonio ?? 0, puesto: idx + 1, jugadores: m ? m.jugadores.filter(j => !j.retirado).length : 1, ramasCadena: mio?.ramas.length ?? 0,
      gerentesF: m ? m.lotes.filter(l => l[1] === n?.cid && l[11] > 0).length : 0, deuda: mio?.deuda ?? 0, prestamosPagados: mio?.st.pagados ?? 0, compradasVenta: mio?.st.compradasVenta ?? 0, quiebras: mio?.st.quiebras ?? 0, contratos: mio?.st.contratos ?? 0 };
  }
  const etapa = () => etapaActual(stats()).n;
  const cerrojo = id => (desbloqueado(etapa(), id) ? '' : ` · Etapa ${DESBLOQUEOS[id]}`);
  function revisar() {                          // llamar de vez en cuando: otorga logros nuevos
    const r = evaluarLogros(stats(), perfil.prog); if (!r.nuevos.length) return;
    perfil.prog = r.prog; store.guardarPerfil(perfil); aviso('🏆 Logro: ' + r.nuevos[0]); audio.tono('moneda');
  }

  // ---------- Empresa: campaña, misiones y logros ----------
  function panelEmpresa(m = '') {
    const s = stats(), e = etapaActual(s), prog = limpiarProg(perfil.prog), msg = txt(m, 'msg'), filas = [];
    filas.push(sec(`Etapa ${e.n} de ${ETAPAS.length}: ${e.t}`, txt(e.d), fila(...ETAPAS.map(x => chip(String(x.n), x.n < e.n ? 'ok' : x.n === e.n ? '' : 'mute'))), prog.titulo ? stat('Título', prog.titulo) : null));
    const ms = misionesActivas(s, prog), H = { inmediato: 'Ahora', sesion: 'Esta sesión', largo: 'Largo plazo' };
    for (const h of ['inmediato', 'sesion', 'largo']) {
      const lst = ms.filter(x => x.h === h && !x.reclamada); if (!lst.length) continue;
      filas.push(sec(H[h], ...lst.flatMap(x => [stat(x.n, `${x.avance}/${x.meta}`), txt(x.desc), barra(x.avance, x.meta, x.hecha ? '#2f6b5f' : '#d9822b'),
        x.hecha ? btn(`Reclamar ${x.premio.dinero ? '+$' + x.premio.dinero : ''}${x.premio.titulo ? ' · «' + x.premio.titulo + '»' : ''}`, () => { const r = reclamar(stats(), perfil.prog, x.id); if (r.ok) { perfil.prog = r.prog; if (r.premio.dinero) sim.d.dinero += r.premio.dinero; store.guardarPerfil(perfil); guardar(); audio.tono('moneda'); } panelEmpresa(r.msg); }, false, 'primario') : null])));
    }
    const sig = ETAPAS[Math.min(e.n, ETAPAS.length - 1)];
    filas.push(sec('Se desbloquea por etapa', ...Object.entries(DESBLOQUEOS).map(([k, n]) => stat({ especialidad: 'Especialidades', proveedores: 'Proveedores y contratos', contratos: 'Contratos largos', gerente: 'Gerentes', ramasCadena: 'Ramas de cadena' }[k] || k, e.n >= n ? 'Listo' : `Etapa ${n}`))));
    filas.push(sec(`Logros (${prog.logros.length}/${LOGROS.length})`, ...LOGROS.map(([id, n, d]) => stat((prog.logros.includes(id) ? '🏆 ' : '· ') + n, prog.logros.includes(id) ? 'Logrado' : d))));
    abrir('Empresa', [...filas, msg], { atras: volver });
  }

  // ---------- Mercado y rivales ----------
  function panelMercado() {
    const m = mundo(), filas = [];
    if (!m?.mio) return abrir('Mercado', [txt('Conectando con el servidor…')], { atras: volver });
    const d = m.mio.demanda, b = d.barrio;
    filas.push(sec(`Tu barrio: ${b.nombre}`, txt(`Demanda ahora: ${Math.round(d.dem * 100)}% de lo normal. Insumos: ${Math.round(d.ing * 100)}% de su precio.${d.escasez ? ' ¡Hay escasez!' : ''}`),
      ...SEGMENTOS.map(sg => [stat(NOMBRE_SEG[sg], `${Math.round(b.seg[sg] * 100)}%`), barra(b.seg[sg], .5)]).flat(), txt('Cada tipo de cliente valora cosas distintas: unos buscan precio, otros rapidez, calidad o ambiente.')));
    const ev = m.mercado.eventos; filas.push(sec('Eventos', ...(ev.length ? ev.map(e => [stat(`${e.estado === 'proximo' ? '⏳ ' : '● '}${e.n}${e.barrio ? ' · ' + e.barrio : ''}`, e.estado === 'proximo' ? `en ${cuando(e.inicia)}` : `quedan ${cuando(e.quedan)}`), txt(e.txt)]).flat() : [txt('Sin eventos por ahora. Se avisan unos turnos antes de empezar.')])));
    const riv = m.jugadores.filter(j => j.npc);
    if (riv.length) filas.push(sec('Rivales', ...riv.map(j => { const P = PERFILES[j.perfil]; return [stat(`${j.nombre}${j.retirado ? ' (retirado)' : ''}`, `${dinero(j.patrimonio)} · ${j.franq} fr.`), txt(P ? `${P.n}: ${P.d}` : '')]; }).flat()));
    filas.push(sec('Noticias', ...(m.noticias.length ? [...m.noticias].reverse().map(n => txt(`T${n.t} · ${n.txt}`)) : [txt('Todavía no hay noticias.')])));
    abrir('Mercado', filas, { atras: volver });
  }

  // ---------- Personal del local ----------
  function panelPersonal(m = '') {
    const msg = txt(m, 'msg'), filas = [], g = sim.gerente, gating = desbloqueado(etapa(), 'gerente');
    const ir = f => () => { const r = f(); if (r.ok) { audio.tono('moneda'); guardar(); } else audio.tono('error'); panelPersonal(r.msg); };
    filas.push(sec('Tu equipo', chip(`Dinero: ${dinero(sim.d.dinero)}`, 'ok'), txt(g ? `Gerente: ${g.n}. Toma pedidos y cobra por ti.` : 'Contrata ayudantes en el tablero (Mejoras). Cada uno tiene habilidad, ánimo y un sueldo por minuto.')));
    if (!sim.emps.length) filas.push(txt('Aún no tienes empleados.'));
    for (const e of sim.emps) {
      const just = e.sueldo >= espera(e.hab) * (e.ger ? 1.6 : 1), cap = 50 * e.hab;
      filas.push(sec(`${e.ger ? '★ ' : ''}${e.n}${e.ger ? ' (gerente)' : ''}`, stat('Habilidad', `${'●'.repeat(e.hab)}${'○'.repeat(5 - e.hab)}`), stat('Ánimo', `${Math.round(e.sat)}%`), barra(e.sat, 100, e.sat < 40 ? '#b8402f' : '#2f6b5f'),
        stat('Sueldo por minuto', `$${e.sueldo}${just ? '' : ' (espera más)'}`), txt(e.sat < 40 ? 'Está molesto: trabaja más lento y puede renunciar.' : just ? 'Contento con su sueldo.' : 'Se siente mal pagado: su ánimo baja cada minuto.'),
        fila(btn('Subir sueldo', ir(() => sim.subirSueldo(e.id)), false, 'suave'), btn(`Capacitar $${cap}`, ir(() => sim.capacitar(e.id)), e.hab >= 5 || sim.d.dinero < cap, 'suave'), e.ger ? null : btn(`Gerente $100${cerrojo('gerente')}`, ir(() => sim.ascender(e.id)), !gating || !!g || e.hab < 3, 'primario'), btn('Despedir', ir(() => sim.despedir(e.id)), false, 'peligro'))));
    }
    abrir('Personal', [...filas, msg], { atras: volver });
  }

  // ---------- Proveedores y contratos ----------
  function panelProveedores(m = '') {
    const msg = txt(m, 'msg'), mu = mundo(), mio = mu?.mio, ok = desbloqueado(etapa(), 'proveedores'), okC = desbloqueado(etapa(), 'contratos'), filas = [];
    filas.push(sec('Para tu local', txt(`Costo de surtir ahora: $${sim.costoSurtir()}. Cambia con el proveedor, el mercado y tus mejoras.`),
      ...Object.entries(PROVEEDORES).map(([id, p]) => { const act = sim.d.prov === id, b = btn('', () => { const r = sim.cambiarProv(id); if (r.ok) guardar(); panelProveedores(r.msg); }, act || (id !== 'mercado' && !ok), act ? 'primario' : 'suave up'); b.append(el('span', '', p.n), el('span', '', act ? 'Actual' : id !== 'mercado' && !ok ? `Etapa ${DESBLOQUEOS.proveedores}` : 'Elegir')); return [b, txt(p.d)]; }).flat()));
    if (mio) {
      const con = mio.contrato;
      filas.push(sec('Para tus franquicias', txt('El contrato fija el precio y te protege de la escasez; no puedes cambiar de proveedor mientras dure. Sin contrato pagas lo que marque el mercado.'),
        con ? stat('Contrato vigente', `${PROVEEDORES[con.prov].n} · hasta el turno ${con.hasta}`) : stat('Proveedor actual', PROVEEDORES[mio.prov].n),
        ...Object.entries(PROVEEDORES).flatMap(([id, p]) => [stat(p.n, mio.prov === id ? 'Actual' : ''), fila(btn('Usar', async () => { const r = await eco('proveedor', { prov: id }); audio.tono(r.ok ? 'moneda' : 'error'); panelProveedores(r.msg); }, !!con || (id !== 'mercado' && !ok) || mio.prov === id, 'suave'),
          btn(`Contrato ${CONTRATO_TURNOS} turnos${cerrojo('contratos')}`, async () => { const r = await eco('proveedor', { prov: id, contrato: true }); audio.tono(r.ok ? 'moneda' : 'error'); panelProveedores(r.msg); }, !!con || !okC, 'primario'))])));
    }
    abrir('Proveedores', [...filas, msg], { atras: volver });
  }

  // ---------- Ramas de desarrollo ----------
  function panelDesarrollo(m = '') {
    const msg = txt(m, 'msg'), mu = mundo(), mio = mu?.mio, okC = desbloqueado(etapa(), 'ramasCadena'), filas = [txt('Cada mejora da una ventaja y cuesta algo. Algunas son incompatibles entre sí: elige tu estilo.')];
    for (const [rid, r] of Object.entries(RAMAS)) {
      const rows = NODOS.filter(n => n.rama === rid).flatMap(n => {
        const tengo = n.donde === 'local' ? sim.d.ramas : (mio?.ramas || []), ya = tengo.includes(n.id), bloq = puedeNodo(tengo, n.id), nv = n.donde === 'local' && sim.nivel < n.nivel, caja = n.donde === 'local' ? sim.d.dinero : (mio?.dinero ?? 0);
        const hacer = async () => { const res = n.donde === 'local' ? sim.comprarRama(n.id) : await eco('rama', { rama: n.id }); if (res.ok) { audio.tono('moneda'); if (n.donde === 'local') guardar(); } else audio.tono('error'); panelDesarrollo(res.msg); };
        return [stat(`${n.n} · ${n.donde === 'local' ? 'tu local' : 'franquicias'}`, ya ? 'Adquirida' : `$${n.costo}${nv ? ' · Nv ' + n.nivel : ''}`), txt(`＋ ${n.pro}`), txt(`− ${n.contra}`),
          ya ? null : btn(bloq && !ya ? bloq : n.donde === 'cadena' && !okC ? `Etapa ${DESBLOQUEOS.ramasCadena}` : 'Adquirir', hacer, !!bloq || nv || caja < n.costo || (n.donde === 'cadena' && (!okC || !mio)), 'suave')];
      });
      filas.push(sec(r.n, txt(r.d), ...rows));
    }
    abrir('Desarrollo', [...filas, msg], { atras: volver });
  }

  // ---------- Finanzas de la cadena (se añade al panel de Franquicias) ----------
  function seccionFinanzas(rehacer) {
    const mio = mundo()?.mio; if (!mio) return [];
    const msg = txt('', 'msg'), uso = mio.limite > 0 ? mio.deuda / mio.limite : 0;
    const op = (o, x) => async () => { const r = await eco(o, { monto: x }); msg.textContent = r.msg; audio.tono(r.ok ? 'moneda' : 'error'); if (r.ok) rehacer(); };
    return [sec('Finanzas', stat('Deuda', dinero(mio.deuda)), barra(uso, 1, uso > .8 ? '#b8402f' : '#d9822b'), stat('Crédito disponible', dinero(Math.max(0, mio.limite - mio.deuda))),
      txt('Los préstamos pagan interés cada turno. Si la deuda se dispara, el banco embarga tu franquicia más barata.'),
      fila(btn('Pedir $200', op('prestamo', 200), mio.limite - mio.deuda < 200, 'suave'), btn('Pedir $500', op('prestamo', 500), mio.limite - mio.deuda < 500, 'suave')),
      fila(btn('Abonar $200', op('abonar', Math.min(200, mio.deuda)), mio.deuda < 1 || mio.dinero < Math.min(200, mio.deuda), 'suave'), btn('Pagar todo', op('abonar', mio.deuda), mio.deuda < 1 || mio.dinero < mio.deuda, 'primario')), msg)];
  }

  // ---------- Gestión de una franquicia propia ----------
  function panelGestion(id) {
    const mu = mundo(), info = mu?.lotes.find(l => l[0] === id); if (!info || info[1] !== net()?.cid || info[3] !== 'f') return;
    const [, , nivel, , inv, p, esp, rep, venta, , promo, gh, rec] = info, pr = precioLote(c.loteDe(id)), mio = mu.mio, msg = txt('', 'msg'), okE = desbloqueado(etapa(), 'especialidad'), okG = desbloqueado(etapa(), 'gerente');
    const op = (o, x = {}) => async () => { const r = await eco(o, { lote: id, ...x }); msg.textContent = r.msg; audio.tono(r.ok ? 'moneda' : 'error'); };
    const filas = [sec('Estado', stat('Reputación', `${rep}/10`), barra(rep, 10, rep < 4 ? '#b8402f' : '#2f6b5f'), stat('Ingreso por turno', `$${mio.ingresos[id] ?? '…'}`), txt('La reputación sube con calidad y buen precio; baja con precios abusivos, recortes y escasez sin contrato.'))];
    filas.push(sec('Precio', stat('Actual', NOMBRE_PRECIO[p]), fila(...PRECIOS.map((x, i) => btn(`${Math.round((x - 1) * 100) >= 0 ? '+' : ''}${Math.round((x - 1) * 100)}%`, op('ajustar', { precio: i }), i === p, i === p ? 'primario' : 'suave'))), txt('Más barato atrae más clientes (sobre todo estudiantes); más caro deja más por cliente y atrae a los exigentes si hay calidad.')));
    filas.push(sec('Especialidad', stat('Actual', esp ? ESPECIALIDADES[esp].n : 'Ninguna'), ...Object.entries(ESPECIALIDADES).flatMap(([k, e]) => [btn(`${e.n}${esp === k ? ' ✓' : ` ($${Math.round(pr * .15)})${cerrojo('especialidad')}`}`, op('ajustar', { esp: k }), esp === k || !okE, 'suave'), txt(e.d)]), esp ? btn('Quitar especialidad', op('ajustar', { esp: null }), false, 'suave') : null));
    filas.push(sec('Operación', btn(promo ? 'Promoción activa' : `Promoción ($${Math.round(pr * PROMO_COSTO)}, ${PROMO_TURNOS} turnos)`, op('promocion'), !!promo, 'suave'), txt('Atrae 25% más clientes mientras dura. Solo vale la pena si el local ya rinde.'),
      btn(rec ? 'Recortes activos: volver a la normalidad' : 'Recortar gastos (−25% mantenimiento)', op('ajustar', { recorte: !rec }), false, rec ? 'primario' : 'suave'), txt('Ahorra hoy, pero la reputación se resiente poco a poco.')));
    filas.push(sec('Gerente', gh ? stat('Gerente', `Habilidad ${gh} · $${SUELDO_GER(gh)}/turno`) : txt(`Sin gerente${cerrojo('gerente')}. Mejora ingresos, reputación y capacidad, pero cobra cada turno.`), gh ? btn('Despedir gerente', op('gerente', { accion: 'despedir' }), false, 'peligro') : fila(...[2, 3, 4].map(h => btn(`Hab. ${h} · $${3 * SUELDO_GER(h)}`, op('gerente', { hab: h }), !okG, 'suave')))));
    filas.push(sec('Venta', venta != null ? stat('En venta por', dinero(venta)) : txt(`Si la pones en venta otro empresario puede comprarla. Valor sugerido: ${dinero(Math.round(.85 * (pr + inv)))}.`), btn(venta != null ? 'Retirar de la venta' : 'Poner en venta', op(venta != null ? 'retirar' : 'listar'), false, 'suave')));
    abrir('Gestión ' + id, [...filas, msg], { atras: () => c.panelLote(id), clave: 'Gestion' });
  }

  // ---------- Informe de regreso ----------
  function panelInforme() {
    const inf = mundo()?.mio?.informe; if (!inf) return;
    const cierra = async () => { await eco('informe'); c.cerrarTienda(); };
    const t = n => (n >= 0 ? '+' : '−') + '$' + Math.abs(Math.round(n)).toLocaleString('es');
    abrir('Mientras no estabas', [sec(`Pasaron unos ${inf.minutos} minutos`, txt(inf.limitado ? 'Fue mucho tiempo: se simuló solo la última hora para que no pierdas todo por una ausencia larga. Tus franquicias no cerraron por inactividad.' : 'Tus franquicias siguieron trabajando (con menos supervisión, rinden 30% menos).'),
      stat('Cuenta de franquicias', t(inf.dDinero)), stat('Patrimonio', t(inf.dPatrimonio)), inf.dDeuda ? stat('Deuda', t(inf.dDeuda)) : null, inf.enVenta ? stat('Locales en venta', String(inf.enVenta)) : null),
      inf.eventos.length ? sec('Ahora en la ciudad', ...inf.eventos.map(e => txt('● ' + e))) : null, sec('Lo más importante', ...(inf.noticias.length ? inf.noticias.map(n => txt('• ' + n)) : [txt('Fue tranquilo.')])), btn('Entendido', cierra, false, 'primario')], { atras: null, clave: 'Informe' });
  }
  return { stats, etapa, revisar, panelEmpresa, panelMercado, panelPersonal, panelProveedores, panelDesarrollo, seccionFinanzas, panelGestion, panelInforme, dinero };
}
