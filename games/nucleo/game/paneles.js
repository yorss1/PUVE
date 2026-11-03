// Paneles de la Fase 1-2 (campaña, mercado, rivales, personal, proveedores, ramas, gestión de franquicias, informe de regreso).
// Solo presentación: toda la lógica vive en sim.js, mundo.js y economia/*. Recibe las piezas de menú de main.js por inyección.
import { precioLote, SUELDO_GER, PROMO_COSTO, PROMO_TURNOS, TURNO_MS } from '../multiplayer/mundo.js';
import { NOMBRE_SEG, SEGMENTOS, PROVEEDORES, ESPECIALIDADES, PRECIOS, NOMBRE_PRECIO, CONTRATO_TURNOS } from '../economia/mercado.js';
import { PERFILES } from '../economia/rivales.js';
import { capacidad } from '../multiplayer/contratos.js';
import { PERMISOS } from '../multiplayer/sociedades.js';
import { RAMAS, NODOS, puedeNodo } from '../economia/ramas.js';
import { ETAPAS, etapaActual, desbloqueado, DESBLOQUEOS, misionesActivas, reclamar, evaluarLogros, limpiarProg, LOGROS } from '../economia/progresion.js';
import { espera } from './sim.js';
import { CIUDADES, DISTRITOS } from '../world/ciudades.js';
import { pista, PREMIO_PASAPORTE, estadoPasaporte } from '../world/vida.js';

export const EMBLEMA = { agresivo: '▲', estratega: '◆', tradicionalista: '■', oportunista: '●', soc: '⚭' };
export function crearPaneles(c) {
  const { el, txt, btn, sec, stat, chip, icono, abrir, aviso, audio, eco, sim, perfil, store, guardar, mundo, net, volver, enviar, chat, vida } = c;
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
  const etapa = () => mundo()?.mio?.etapa ?? etapaActual(stats()).n;          // la etapa que cuenta es la del servidor
  const miSoc = () => mundo()?.sociedad?.mia || null, cidMio = () => net()?.cid;
  const esMia = d => d === cidMio() || (!!miSoc() && d === miSoc().id);
  const extra = d => (miSoc() && d === miSoc().id ? { soc: d } : {});
  const cerrojo = id => (desbloqueado(etapa(), id) ? '' : ` · Etapa ${DESBLOQUEOS[id]}`);
  function revisar() {                          // llamar de vez en cuando: otorga logros nuevos
    const r = evaluarLogros(stats(), perfil.prog); if (!r.nuevos.length) return;
    perfil.prog = r.prog; store.guardarPerfil(perfil); aviso('🏆 Logro: ' + r.nuevos[0]); audio.tono('moneda');
  }

  // ---------- Empresa: campaña, misiones y logros ----------
  function panelEmpresa(m = '') {
    const s = stats(), srv = mundo()?.mio?.etapa, e = srv ? ETAPAS[srv - 1] : etapaActual(s), prog = limpiarProg(perfil.prog), msg = txt(m, 'msg'), filas = [];
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
    filas.push(sec('Rivales', ...(riv.length ? riv.map(j => { const P = PERFILES[j.perfil], r = txt('', 'msg'); return [stat(`${EMBLEMA[j.perfil] || ''} ${j.nombre}${j.retirado ? ' (fuera)' : ''}${j.aliado ? ' · aliado' : ''}`, `${dinero(j.patrimonio)} · ${j.franq} fr.`), txt(P ? `${P.n}: ${P.d}` : ''),
      j.apuros && !j.retirado ? btn(`Rescatar (debe ${dinero(j.deuda)}): pagar $${Math.min(200, j.deuda)}`, async () => { const x = await eco('rescatar', { rival: j.cid, monto: Math.min(200, j.deuda) }); r.textContent = x.msg; audio.tono(x.ok ? 'moneda' : 'error'); }, false, 'suave') : null, r]; }).flat() : [txt('No hay rivales controlados por la computadora.')]),
      txt('Los rivales en apuros pueden ser rescatados: te lo devuelven con intereses y dejan de competir contra ti.'), fila(...[0, 1, 2, 3, 4].map(n => btn(String(n), () => { enviar({ t: 'rivales', n }); aviso(n ? `Rivales: ${n}` : 'Sin rivales'); }, false, riv.filter(j => !j.retirado).length === n ? 'primario' : 'suave'))), txt('Cantidad de rivales (la decide el anfitrión).')));
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
    const mu = mundo(), info = mu?.lotes.find(l => l[0] === id); if (!info || !esMia(info[1]) || info[3] !== 'f') return; gestionId = id; const ex = extra(info[1]);
    const [, , nivel, , inv, p, esp, rep, venta, , promo, gh, rec] = info, pr = precioLote(c.loteDe(id)), mio = mu.mio, msg = txt('', 'msg'), okE = desbloqueado(etapa(), 'especialidad'), okG = desbloqueado(etapa(), 'gerente');
    const op = (o, x = {}) => async () => { const r = await eco(o, { lote: id, ...x, ...ex }); msg.textContent = r.msg; audio.tono(r.ok ? 'moneda' : 'error'); };
    const filas = [sec('Estado', stat('Reputación', `${rep}/10`), barra(rep, 10, rep < 4 ? '#b8402f' : '#2f6b5f'), stat('Ingreso por turno', `$${mio.ingresos[id] ?? '…'}`), txt('La reputación sube con calidad y buen precio; baja con precios abusivos, recortes y escasez sin contrato.'))];
    filas.push(sec('Precio', stat('Actual', NOMBRE_PRECIO[p]), fila(...PRECIOS.map((x, i) => btn(`${Math.round((x - 1) * 100) >= 0 ? '+' : ''}${Math.round((x - 1) * 100)}%`, op('ajustar', { precio: i }), i === p, i === p ? 'primario' : 'suave'))), txt('Más barato atrae más clientes (sobre todo estudiantes); más caro deja más por cliente y atrae a los exigentes si hay calidad.')));
    filas.push(sec('Especialidad', stat('Actual', esp ? ESPECIALIDADES[esp].n : 'Ninguna'), ...Object.entries(ESPECIALIDADES).flatMap(([k, e]) => [btn(`${e.n}${esp === k ? ' ✓' : ` ($${Math.round(pr * .15)})${cerrojo('especialidad')}`}`, op('ajustar', { esp: k }), esp === k || !okE, 'suave'), txt(e.d)]), esp ? btn('Quitar especialidad', op('ajustar', { esp: null }), false, 'suave') : null));
    filas.push(sec('Operación', btn(promo ? 'Promoción activa' : `Promoción ($${Math.round(pr * PROMO_COSTO)}, ${PROMO_TURNOS} turnos)`, op('promocion'), !!promo, 'suave'), txt('Atrae 25% más clientes mientras dura. Solo vale la pena si el local ya rinde.'),
      btn(rec ? 'Recortes activos: volver a la normalidad' : 'Recortar gastos (−25% mantenimiento)', op('ajustar', { recorte: !rec }), false, rec ? 'primario' : 'suave'), txt('Ahorra hoy, pero la reputación se resiente poco a poco.')));
    filas.push(sec('Gerente', gh ? stat('Gerente', `Habilidad ${gh} · $${SUELDO_GER(gh)}/turno`) : txt(`Sin gerente${cerrojo('gerente')}. Mejora ingresos, reputación y capacidad, pero cobra cada turno.`), gh ? btn('Despedir gerente', op('gerente', { accion: 'despedir' }), false, 'peligro') : fila(...[2, 3, 4].map(h => btn(`Hab. ${h} · $${3 * SUELDO_GER(h)}`, op('gerente', { hab: h }), !okG, 'suave')))));
    const sub = (mu.subastas || []).find(x => x.lote === id);
    filas.push(sec('Subasta', sub ? stat('En subasta', sub.mejor ? `$${sub.mejor.monto} (${sub.mejor.nombre})` : `desde $${sub.base}`) : txt(`Subastar deja que varios compitan por tu local: se queda con la mejor puja. Sugerido desde $${Math.round(.6 * (pr + inv))}.`), sub ? (sub.mejor ? txt('Ya hay pujas: no se puede retirar.') : btn('Retirar subasta', op('retirarSubasta'), false, 'suave')) : btn('Subastar (12 turnos)', op('subastar'), venta != null, 'primario'), btn('Contratos de catering…', () => panelContratos(), false, 'suave')));
    filas.push(sec('Venta', venta != null ? stat('En venta por', dinero(venta)) : txt(`Si la pones en venta otro empresario puede comprarla. Valor sugerido: ${dinero(Math.round(.85 * (pr + inv)))}.`), btn(venta != null ? 'Retirar de la venta' : 'Poner en venta', op(venta != null ? 'retirar' : 'listar'), false, 'suave')));
    abrir('Gestión ' + id, [...filas, msg], { atras: () => c.panelLote(id), clave: 'Gestion' });
  }

  let gestionId = null;
  // ---------- Contratos de catering ----------
  function panelContratos(m = '') {
    const mu = mundo(), C = mu?.contratos, mio = mu?.mio, msg = txt(m, 'msg'); if (!C || !mio) return abrir('Contratos', [txt('Conectando con el servidor…')], { atras: volver, clave: 'Contratos' });
    const cids = [cidMio(), miSoc()?.id].filter(Boolean), libres = mu.lotes.filter(l => cids.includes(l[1]) && l[3] === 'f' && !C.mios.some(c => c.lote === l[0]));
    const filas = [txt('Un contrato reserva capacidad de cocina antes que los clientes habituales: si es muy grande, tu local puede saturarse y perderás clientes. Si no cumples pierdes el depósito.')];
    filas.push(sec('Tus contratos', ...(C.mios.length ? C.mios.flatMap(c => [stat(`${c.cliente} · lote ${c.lote}`, `quedan ${c.quedan} turnos`), stat('Entrega promedio', c.prom == null ? 'aún sin datos' : `${Math.round(c.prom * 100)}%`), txt(`Paga $${c.pago}/turno · multa $${c.penal}/turno por lo no entregado · hay que llegar al 90%.`), barra(c.prom ?? 0, 1, (c.prom ?? 1) < .9 ? '#b8402f' : '#2f6b5f')]) : [txt('No tienes contratos activos.')])));
    filas.push(sec(`Ofertas (cambian en ${C.cierraEn} turnos)`, ...(C.ofertas.length ? C.ofertas.flatMap(o => [stat(o.cliente, `$${o.pago}/turno × ${o.plazo}`), txt(`Exige ${Math.round(o.req * 100)}% de capacidad · depósito $${o.deposito} (se devuelve) · bono $${o.bono}`),
      ...(libres.length ? libres.map(l => { const cap = capacidad({ nivel: l[2] }, mio.ef, l[11]); return btn(`Aceptar en ${l[0]} (capacidad ${Math.round(cap * 100)}%${cap < o.req ? ' ⚠' : ''})`, async () => { const r = await eco('contrato', { oferta: o.id, lote: l[0], ...extra(l[1]) }); audio.tono(r.ok ? 'moneda' : 'error'); panelContratos(r.msg); }, mio.dinero < o.deposito, cap < o.req ? 'suave' : 'primario'); }) : [txt('Necesitas una franquicia sin contrato.')])]) : [txt('No quedan ofertas por ahora.')])));
    abrir('Contratos', [...filas, msg], { atras: volver, clave: 'Contratos' });
  }
  // ---------- Subastas ----------
  function panelSubastas(m = '') {
    const mu = mundo(), msg = txt(m, 'msg'); if (!mu?.mio) return abrir('Subastas', [txt('Conectando con el servidor…')], { atras: volver, clave: 'Subastas' });
    const L = mu.subastas || [], filas = [txt('La puja se retiene al momento de pujar y se te devuelve si te superan. Una puja en los últimos 2 turnos extiende el cierre.')];
    if (!L.length) filas.push(txt('No hay subastas abiertas. La ciudad subasta un lote de alto tránsito cada cierto tiempo y los jugadores pueden subastar sus franquicias.'));
    for (const s of L) filas.push(sec(`Lote ${s.lote}${s.ciudad ? ' · Subasta de la ciudad' : ''}`, stat('Vende', s.vendedor), stat('Precio base', dinero(s.base)), stat('Puja líder', s.mejor ? `${s.mejor.nombre} ${dinero(s.mejor.monto)}${s.mejor.tuya ? ' (tú)' : ''}` : 'Sin pujas'), stat('Cierra en', cuando(s.quedan)),
      s.mio ? (s.mejor ? txt('Ya hay pujas: no se puede retirar.') : btn('Retirar subasta', async () => { const r = await eco('retirarSubasta', { lote: s.lote }); panelSubastas(r.msg); }, false, 'suave'))
        : fila(...[s.minima, Math.ceil(s.minima * 1.2)].map(x => btn(`Pujar ${dinero(x)}`, async () => { const r = await eco('pujar', { lote: s.lote, monto: x }); audio.tono(r.ok ? 'moneda' : 'error'); panelSubastas(r.msg); }, s.mejor?.tuya || mu.mio.dinero < x, 'primario')))));
    abrir('Subastas', [...filas, msg], { atras: volver, clave: 'Subastas' });
  }
  // ---------- Sociedad ----------
  function panelSociedad(m = '') {
    const mu = mundo(), SO = mu?.sociedad, msg = txt(m, 'msg'); if (!SO) return abrir('Sociedad', [txt('Conectando con el servidor…')], { atras: volver, clave: 'Sociedad' });
    const a = (op, x = {}, ok) => async () => { const r = await eco(op, x); audio.tono(r.ok ? 'moneda' : 'error'); panelSociedad(r.msg); if (r.ok && ok) ok(); }, filas = [], s = SO.mia, otros = mu.jugadores.filter(j => !j.npc && !j.soc && j.cid !== cidMio());
    for (const i of SO.invitaciones) filas.push(sec(`Invitación a «${i.nombre}»`, txt(`${i.de} te invita a su sociedad. Vence en ${i.quedan} turnos.`), fila(btn('Aceptar', a('soc_aceptar', { soc: i.soc }), false, 'primario'), btn('Rechazar', a('soc_rechazar', { soc: i.soc }), false, 'suave'))));
    if (!s) {
      const i = el('input', 'in'); i.placeholder = 'Nombre de la sociedad'; i.maxLength = 16; i.autocomplete = 'off';
      filas.push(sec('Sociedades', txt('Una sociedad es una empresa con varios dueños: caja compartida, franquicias comunes y decisiones por votación. Hace falta jugar con amigos en una sala.'), otros.length ? txt(`Amigos en la sala: ${otros.map(j => j.nombre).join(', ')}`) : txt('Ahora estás solo en tu mundo: crea una sala para invitar amigos.'), i, btn('Fundar sociedad', () => a('soc_crear', { nombre: i.value })(), false, 'primario')));
    } else {
      const esF = s.fundador === cidMio(), yo = s.socios.find(x => x.cid === cidMio());
      filas.push(sec(`${EMBLEMA.soc} ${s.nombre}`, stat('Tu papel', yo.rol), stat('Caja compartida', dinero(s.dinero)), stat('Deuda', dinero(s.deuda)), stat('Tu aporte', dinero(yo.aporte)),
        fila(btn('Aportar $200', a('soc_aportar', { monto: 200 }), (mu.mio.dinero < 200), 'primario'), btn('Aportar $1000', a('soc_aportar', { monto: 1000 }), mu.mio.dinero < 1000, 'primario')), txt('Compras, vende y opera en nombre de la sociedad desde el lote de cada franquicia (tu cuenta o la de la sociedad).')));
      filas.push(sec('Socios', ...s.socios.flatMap(x => [stat(`${x.nombre}${x.cid === cidMio() ? ' (tú)' : ''}`, `${x.rol} · aportó ${dinero(x.aporte)}`), txt('Puede: ' + (PERMISOS.filter(k => x.perm[k]).join(', ') || 'nada')),
        ...(esF && x.cid !== cidMio() ? [fila(btn(x.rol === 'gerente' ? 'Pasar a socio' : 'Hacer gerente', a('soc_permisos', { cid: x.cid, rol: x.rol === 'gerente' ? 'socio' : 'gerente' }), false, 'suave'), ...['comprar', 'vender', 'finanzas'].map(k => btn(`${x.perm[k] ? '✓' : '✗'} ${k}`, a('soc_permisos', { cid: x.cid, perm: { [k]: !x.perm[k] } }), false, 'suave')), btn('Ceder mando', a('soc_ceder', { cid: x.cid }), false, 'suave'))] : [])]),
        ...s.invitados.map(n => txt(`Invitado: ${n} (pendiente)`)), ...(esF ? otros.filter(j => !s.socios.some(x => x.cid === j.cid)).map(j => btn(`Invitar a ${j.nombre}`, a('soc_invitar', { cid: j.cid }), s.socios.length >= 4, 'suave')) : [])));
      filas.push(sec('Votaciones', ...(s.props.length ? s.props.flatMap(p => [stat(p.txt, `${p.si} sí · ${p.no} no`), txt(`Propuesta de ${p.autor}. Cierra en ${p.quedan} turnos.`), p.yoVote == null ? fila(btn('A favor', a('votar', { soc: s.id, propuesta: p.id, voto: true }), false, 'primario'), btn('En contra', a('votar', { soc: s.id, propuesta: p.id, voto: false }), false, 'peligro')) : txt(`Votaste ${p.yoVote ? 'a favor' : 'en contra'}.`)]) : [txt('No hay propuestas. Préstamos, compras, ventas, repartos y la disolución se votan (mayoría simple).')])));
      filas.push(sec('Historial', ...(s.hist.length ? s.hist.map(h => txt(`T${h.t} · ${h.txt}`)) : [txt('Sin movimientos todavía.')])));
      filas.push(sec('Administrar', ...(esF ? [btn('Repartir $500 de la caja', a('soc_repartir', { soc: s.id, monto: 500 }), s.dinero < 500, 'suave'), btn('Disolver sociedad', a('soc_disolver', { soc: s.id }), false, 'peligro'), txt('Se vende todo, se paga la deuda y lo que quede se reparte según lo aportado.')] : [btn('Salir de la sociedad', a('soc_salir'), false, 'peligro'), txt('Recibes la parte proporcional a lo que aportaste, de la caja.')])));
    }
    abrir('Sociedad', [...filas, msg], { atras: volver, clave: 'Sociedad' });
  }
  // ---------- Chat de la sala ----------
  function panelChat(m = '') {
    const C = chat(), msg = txt(m, 'msg'), lista = el('div'); lista.style.cssText = 'max-height:46vh;overflow:auto;display:flex;flex-direction:column;gap:4px';
    for (const x of C.msgs.filter(x => !C.mios.has(x.de))) { const f = el('p', 'nota'); f.textContent = `${x.nombre}: ${x.txt}`; lista.appendChild(f); }
    if (!C.msgs.length) lista.appendChild(txt('Aún no hay mensajes.'));
    const i = el('input', 'in'); i.placeholder = C.activo ? 'Escribe un mensaje…' : 'El anfitrión desactivó el chat'; i.maxLength = 200; i.autocomplete = 'off'; i.disabled = !C.activo;
    const enviarTxt = () => { if (i.value.trim()) { enviar({ t: 'chat', txt: i.value }); i.value = ''; } }; i.onkeydown = e => { if (e.key === 'Enter') enviarTxt(); };
    const filas = [sec('Mensajes', lista), sec('Escribir', i, btn('Enviar', enviarTxt, !C.activo, 'primario'), txt('Solo texto. Sé amable: el anfitrión puede silenciar a quien moleste y tú puedes ocultar mensajes de alguien.'))];
    if (C.host) filas.push(sec('Moderación', btn(C.activo ? 'Desactivar chat para todos' : 'Activar chat', () => enviar({ t: 'chat_config', activo: !C.activo }), false, 'suave'), ...C.jugadores.filter(p => p.cid !== cidMio()).map(p => btn(`${C.silenciados.includes(p.cid) ? 'Dejar hablar a' : 'Silenciar a'} ${p.nombre}`, () => enviar({ t: 'chat_config', ...(C.silenciados.includes(p.cid) ? { quitar: p.cid } : { silenciar: p.cid }) }), false, 'suave'))));
    filas.push(sec('Para ti', ...C.jugadores.filter(p => p.cid !== cidMio()).map(p => btn(`${C.mios.has(p.cid) ? 'Mostrar' : 'Ocultar'} mensajes de ${p.nombre}`, () => { C.mios.has(p.cid) ? C.mios.delete(p.cid) : C.mios.add(p.cid); panelChat(); }, false, 'suave'))));
    abrir('Chat', [...filas, msg], { atras: volver, clave: 'Chat' }); lista.scrollTop = lista.scrollHeight;
  }
  // ---------- Repartos ----------
  function panelRepartos(m = '') {
    const msg = txt(m, 'msg'), act = vida.actual(), afuera = vida.modo() === 'ciudad', filas = [];
    filas.push(sec('Pedidos a domicilio', txt('Sal a la calle con ingredientes en tu stock, elige un pedido y corre a entregarlo antes de que se enfríe. Cada entrega gasta 1 ingrediente; sobrar tiempo da propina y encadenar entregas sube el pago hasta +50%.'), stat('Ingredientes', String(sim.d.stock)), stat('Entregas seguidas', `${vida.racha()} (x${(1 + Math.min(.5, .1 * vida.racha())).toFixed(1)})`)));
    if (act) filas.push(sec('En camino', stat('Destino', act.of.hito || act.of.distrito), stat('Tiempo', `${Math.max(0, Math.ceil(act.t))} s`), stat('Paga', `$${act.of.pago}+`), btn('Cancelar (pierdes el ingrediente)', () => { vida.cancelar(); panelRepartos('Pedido cancelado'); }, false, 'peligro')));
    else {
      const of = vida.ofertas(); filas.push(...(of.length ? of.map(o => sec(`${o.nivel}: ${o.hito ? '★ ' + o.hito : o.distrito}`, stat('Distancia', `${o.dist} casillas`), stat('Tiempo', `${o.limite} s`), stat('Paga', `$${o.pago} + propina`), txt(`Rumbo ${pista(vida.pos(), o.frente)}.`),
        btn(afuera ? 'Aceptar y salir corriendo' : 'Sal a la calle primero', () => { const r = vida.aceptar(o); if (r.ok) c.cerrarTienda(); else panelRepartos(r.msg); }, !afuera || sim.d.stock < 1 || !!act, 'primario'))) : [txt('No hay pedidos por aquí. Camina a otra zona.')]), txt('Las ofertas cambian cada 45 segundos.'));
    }
    abrir('Repartos', [...filas, msg], { atras: volver, clave: 'Repartos' });
  }
  // ---------- Pasaporte ----------
  function panelPasaporte() {
    const { sellos, hechos } = vida.sellos(), e = estadoPasaporte(sellos, hechos), pos = vida.pos(), filas = [];
    if (!sellos.length) filas.push(sec('Pasaporte', txt('Esta ciudad no tiene monumentos que descubrir. Empieza un mundo nuevo en otra ciudad desde el menú «Ciudades».')));
    else {
      filas.push(sec(`Pasaporte · ${e.ok}/${e.total}`, barra(e.ok, e.total, '#7ae0f0'), txt(e.completo ? `¡Completo! Título: «${perfil.titulo || 'Explorador'}».` : `Visita los monumentos para sellar tu pasaporte. Cada uno da dinero y XP; completarlo da $${PREMIO_PASAPORTE} y un título. Acércate a su puerta para sellarlo.`)));
      for (const s of sellos) { const ya = hechos.has(s.id); filas.push(sec(`${ya ? '🛂 ' : '? '}${ya ? s.nombre : 'Monumento sin descubrir'}`, stat('Distrito', s.distrito), stat('Premio', `$${s.premio}`), txt(ya ? 'Sellado.' : `Pista: ${pista(pos, s.frente)}. Habla con los peatones o mira el mapa.`))); }
    }
    abrir('Pasaporte', filas, { atras: volver, clave: 'Pasaporte' });
  }
  // ---------- Mapa ----------
  function panelMapa() {
    const cv = el('canvas'); cv.style.cssText = 'width:100%;image-rendering:pixelated;border:2px solid #2a1f1d;background:#222'; const filas = [sec('Tu ciudad', cv, txt('Punto rojo: tú. Cuadros de colores: propiedades. Cruz blanca y dorada: monumentos. Azul: agua. Marcas amarillas: destino de tu reparto.'))];
    try { vida.mapa(cv, 7); } catch (e) { filas.push(txt('No se pudo dibujar el mapa.')); }
    const leyenda = Object.entries(DISTRITOS).map(([k, d]) => { const i = el('span'); i.style.cssText = `display:inline-block;width:10px;height:10px;background:${d.color};margin-right:6px;border:1px solid #000`; const f = el('div'); f.appendChild(i); f.appendChild(el('span', '', d.n)); return f; });
    if (vida.sellos().sellos.length) filas.push(sec('Distritos', ...leyenda));
    abrir('Mapa', filas, { atras: volver, clave: 'Mapa' });
  }
  // ---------- Ciudades ----------
  let confirmar = null;
  function panelCiudades(m = '') {
    const msg = txt(m, 'msg'), filas = [txt('Cada ciudad es distinta: otros distritos, agua, monumentos, clientela y eventos. Empezar un mundo nuevo reinicia tus franquicias y a los rivales; tu restaurante, tu dinero y tu progreso se conservan.')], aqui = vida.seed();
    const todas = [{ id: 'clasica', nombre: 'Ciudad clásica', seed: 7, desc: 'La ciudad original: una cuadrícula pareja. Sin monumentos ni agua.' }, ...CIUDADES];
    for (const C of todas) {
      const cv = el('canvas'); cv.style.cssText = 'width:100%;image-rendering:pixelated;border:2px solid #2a1f1d;background:#222'; try { vida.previa(cv, C.seed); } catch (e) { /* sin canvas */ }
      const here = C.seed === aqui, sure = confirmar === C.seed;
      filas.push(sec(C.nombre + (here ? ' · aquí' : ''), cv, txt(C.desc), btn(here ? 'Estás jugando aquí' : sure ? '¿Seguro? Toca otra vez para empezar' : 'Mundo nuevo aquí', () => { if (!vida.esSolo()) return panelCiudades('Solo puedes cambiar de ciudad en tu mundo solo (no dentro de una sala).'); if (!sure) { confirmar = C.seed; return panelCiudades(); } confirmar = null; vida.nuevoMundo(C.seed); }, here, sure ? 'peligro' : 'primario')));
    }
    abrir('Ciudades', [...filas, msg], { atras: volver, clave: 'Ciudades' });
  }
  // ---------- Informe de regreso ----------
  function panelInforme() {
    const inf = mundo()?.mio?.informe; if (!inf) return;
    const cierra = async () => { await eco('informe'); c.cerrarTienda(); };
    const t = n => (n >= 0 ? '+' : '−') + '$' + Math.abs(Math.round(n)).toLocaleString('es');
    abrir('Mientras no estabas', [sec(`Pasaron unos ${inf.minutos} minutos`, txt(inf.limitado ? 'Fue mucho tiempo: se simuló solo la última hora para que no pierdas todo por una ausencia larga. Tus franquicias no cerraron por inactividad.' : 'Tus franquicias siguieron trabajando (con menos supervisión, rinden 30% menos).'),
      stat('Cuenta de franquicias', t(inf.dDinero)), stat('Patrimonio', t(inf.dPatrimonio)), inf.dDeuda ? stat('Deuda', t(inf.dDeuda)) : null, inf.enVenta ? stat('Locales en venta', String(inf.enVenta)) : null),
      c.informeLocal ? sec('Tu local sin ti', txt(c.informeLocal)) : null, inf.eventos.length ? sec('Ahora en la ciudad', ...inf.eventos.map(e => txt('● ' + e))) : null, sec('Lo más importante', ...(inf.noticias.length ? inf.noticias.map(n => txt('• ' + n)) : [txt('Fue tranquilo.')])), btn('Entendido', cierra, false, 'primario')], { atras: null, clave: 'Informe' });
  }
  const rehacer = { Repartos: panelRepartos, Mercado: panelMercado, Contratos: panelContratos, Subastas: panelSubastas, Sociedad: panelSociedad, Chat: panelChat, Gestion: () => gestionId && panelGestion(gestionId) };
  const informeLocal = t => { c.informeLocal = t; };
  return { informeLocal, stats, etapa, revisar, rehacer, panelEmpresa, panelMercado, panelPersonal, panelProveedores, panelDesarrollo, seccionFinanzas, panelGestion, panelInforme, panelContratos, panelSubastas, panelSociedad, panelChat, panelRepartos, panelPasaporte, panelMapa, panelCiudades, dinero };
}
