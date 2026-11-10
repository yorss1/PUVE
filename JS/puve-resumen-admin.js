/* PUVE - Resumen del SUPERADMIN (PUVE IA, uso exclusivo de PUVE)
 * Mismo estilo que el Resumen de los negocios, pero sobre la operación de PUVE: negocios, cobros, seguridad, bugs y soporte.
 * Solo lee. Se carga ÚNICAMENTE cuando entra el superadmin y vuelve a comprobar el permiso antes de cada respuesta.
 * La protección real está en la base de datos: las tablas y funciones que consulta (negocios, pagos_puve, logs_seguridad, bugs_puve,
 * admin_listar_conversaciones_soporte) solo responden a los administradores de PUVE; para cualquier otra cuenta devuelven vacío o error.
 */
(function(){
  'use strict';
  const R = window.PuveResumen;
  if(!R) return;
  const { norm, parseTiempo } = R.nucleo, carta = R.carta, A = R.ayudas;
  let enlace = {
    sb: null, esSuperadmin: () => false, negociosAdmins: async () => new Set(), calcularMontoEsperado: () => 0, periodoParaNegocio: () => '', dinero: (n) => '$' + Number(n || 0).toFixed(2)
  };
  const $d = (n) => enlace.dinero(n);
  const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const lista = A.lista, veces = A.veces;

  const DICC = [
    { id: 'resumen', claves: ['resumen', 'como va puve', 'como estamos', 'como va todo', 'como nos va', 'como nos fue', 'reporte', 'que tal', 'como va la plataforma', 'como esta puve'] },
    { id: 'negocios', claves: ['negocio', 'negocios', 'registrados', 'nuevos', 'altas', 'baneado', 'baneados', 'activos', 'planes', 'plan'] },
    { id: 'finanzas', claves: ['cobro', 'cobros', 'pago', 'pagos', 'pagado', 'pagaron', 'vencido', 'vencidos', 'atrasado', 'atrasados', 'no han pagado', 'quien debe', 'deben', 'ingresos', 'dinero', 'cobrar', 'cobrado', 'bloqueado', 'bloqueados', 'finanzas'] },
    { id: 'seguridad', claves: ['seguridad', 'ataque', 'ataques', 'intentos', 'sospechoso', 'sospechosos', 'login fallido', 'logins', 'peligro', 'hackeo', 'acceso'] },
    { id: 'bugs', claves: ['bug', 'bugs', 'error', 'errores', 'reporte de error', 'reportes', 'fallas', 'falla', 'sugerencias', 'sugerencia'] },
    { id: 'soporte', claves: ['soporte', 'mensajes', 'chats', 'chat', 'sin leer', 'conversaciones', 'atencion', 'me escribieron', 'quien me escribio'] },
    { id: 'dispositivos', claves: ['dispositivo', 'dispositivos', 'cajas', 'cajeros contratados'] },
    { id: 'ayuda', claves: ['ayuda', 'que puedes', 'que haces', 'que sabes', 'hola', 'buenas', 'buenos dias', 'buenas tardes', 'buenas noches'] }
  ];
  function detectar(t){
    const puntos = {};
    DICC.forEach((d) => d.claves.forEach((k) => {
      const nk = norm(k);
      if(new RegExp('(^| )' + escRe(nk)).test(t)) puntos[d.id] = (puntos[d.id] || 0) + Math.pow(nk.split(' ').length, 2);
    }));
    const orden = Object.keys(puntos).sort((a, b) => puntos[b] - puntos[a]);
    if(!orden.length) return [];
    let ids = orden.filter((i) => puntos[i] >= Math.max(1, puntos[orden[0]] * 0.6)).slice(0, 2);
    if(ids.includes('resumen')) return ['resumen'];
    if(ids.includes('ayuda') && ids.length > 1) ids = ids.filter((i) => i !== 'ayuda');
    return ids;
  }

  // ---------- datos ----------
  async function negociosYPagos(){
    const [n, p, admins] = await Promise.all([
      enlace.sb.from('negocios').select('id,nombre,dispositivos_permitidos,baneado,tipo_plan,bloqueado_por_pago,created_at'),
      enlace.sb.from('pagos_puve').select('negocio_id,periodo,monto_esperado,monto_pagado,fecha_pago'),
      enlace.negociosAdmins()
    ]);
    if(n.error) throw new Error(n.error.message);
    const todos = (n.data || []).filter((x) => !admins.has(x.id));
    return { todos, activos: todos.filter((x) => !x.baneado), baneados: todos.filter((x) => x.baneado), pagos: p.error ? [] : (p.data || []) };
  }
  function estadoCobros(d){
    const hoy = new Date(), pasoLimite = hoy.getDate() > 5;
    let esperado = 0, cobrado = 0, alCorriente = 0; const atrasados = [], pendientes = [];
    d.activos.forEach((n) => {
      const tipo = n.tipo_plan || 'mensual', per = enlace.periodoParaNegocio(tipo), pago = d.pagos.find((p) => p.negocio_id === n.id && p.periodo === per);
      const esp = (pago && !pago.fecha_pago && pago.monto_esperado != null) ? Number(pago.monto_esperado) : Number(enlace.calcularMontoEsperado(n.dispositivos_permitidos, tipo)) || 0;
      esperado += esp;
      if(pago && pago.fecha_pago){ cobrado += Number(pago.monto_pagado || esp); alCorriente++; }
      else if(n.bloqueado_por_pago || (tipo === 'mensual' && pasoLimite)) atrasados.push({ n, esp, bloqueado: !!n.bloqueado_por_pago });
      else pendientes.push({ n, esp });
    });
    return { esperado, cobrado, alCorriente, atrasados, pendientes };
  }
  async function traerLogs(desde){
    const r = await enlace.sb.from('logs_seguridad').select('tipo,negocio_id,creado_en').gte('creado_en', desde.toISOString()).order('creado_en', { ascending: false }).limit(1000);
    if(r.error) throw new Error(r.error.message);
    return r.data || [];
  }
  async function traerBugs(){
    const r = await enlace.sb.from('bugs_puve').select('titulo,estado,tipo,creado_en').order('creado_en', { ascending: false }).limit(300);
    if(r.error) throw new Error(r.error.message);
    return r.data || [];
  }
  async function traerSoporte(){
    try { const r = await enlace.sb.rpc('admin_listar_conversaciones_soporte'); return r.error ? null : (r.data || []); } catch(e){ return null; }
  }
  const TIPOS_LOG = { codigo_caja_invalido: 'códigos de caja incorrectos', acceso_negocio_baneado: 'intentos de entrar a negocios baneados', limite_dispositivos: 'intentos de pasar el límite de dispositivos', login_fallido: 'inicios de sesión fallidos' };

  // ---------- respuestas ----------
  async function cNegocios(t){
    const d = await negociosYPagos(), desde = t.explicito ? t.desde : parseTiempo('ultimos 7 dias').desde, et = t.explicito ? t.etiqueta : 'los últimos 7 días';
    const nuevos = d.todos.filter((n) => n.created_at && new Date(n.created_at) >= desde);
    const porPlan = {}; d.activos.forEach((n) => { const k = n.tipo_plan || 'mensual'; porPlan[k] = (porPlan[k] || 0) + 1; });
    const out = [carta('info', 'tienda', 'Negocios en PUVE', 'Hay ' + veces(d.activos.length, 'negocio activo', 'negocios activos') + (d.baneados.length ? ' y ' + veces(d.baneados.length, 'baneado', 'baneados') : '') + '.')];
    out.push(carta(nuevos.length ? 'bien' : 'neutro', 'tienda', 'Nuevos', nuevos.length ? 'Llegaron ' + veces(nuevos.length, 'negocio nuevo', 'negocios nuevos') + ' durante ' + et + ': ' + lista(nuevos.slice(0, 5).map((n) => n.nombre)) + (nuevos.length > 5 ? ' y ' + (nuevos.length - 5) + ' más' : '') + '.' : 'No llegaron negocios nuevos durante ' + et + '.', nuevos.length ? null : 'Si quieres más, revisa tus embajadores y la publicidad.'));
    if(Object.keys(porPlan).length) out.push(carta('info', 'grafica', 'Por tipo de plan', lista(Object.entries(porPlan).map(([k, v]) => v + ' ' + k)) + '.'));
    return out;
  }
  async function cFinanzas(){
    const d = await negociosYPagos(), c = estadoCobros(d), faltan = Math.max(0, c.esperado - c.cobrado), out = [];
    out.push(carta(faltan ? 'info' : 'bien', 'dinero', 'Cobros del periodo', 'Esperas cobrar ' + $d(c.esperado) + ' y ya cobraste ' + $d(c.cobrado) + (faltan ? '. Faltan ' + $d(faltan) + '.' : '. ¡Ya está todo cobrado!') + ' (Sin contar descuentos por referido.)'));
    if(c.atrasados.length) out.push(carta('alerta', 'alerta', 'Cobros atrasados', veces(c.atrasados.length, 'negocio va atrasado', 'negocios van atrasados') + ': ' + lista(c.atrasados.slice(0, 5).map((x) => x.n.nombre + (x.bloqueado ? ' (bloqueado)' : ''))) + (c.atrasados.length > 5 ? ' y ' + (c.atrasados.length - 5) + ' más' : '') + '.', 'Escríbeles hoy; si no responden, bloquea el acceso desde Finanzas.'));
    else out.push(carta('bien', 'dinero', 'Sin atrasos', 'Ningún negocio va atrasado con su pago.'));
    if(c.pendientes.length) out.push(carta('neutro', 'reloj', 'Por cobrar', veces(c.pendientes.length, 'negocio todavía no paga', 'negocios todavía no pagan') + ', pero aún están a tiempo.'));
    return out;
  }
  async function cSeguridad(t){
    const desde = t.explicito ? t.desde : new Date(Date.now() - 86400000), et = t.explicito ? t.etiqueta : 'las últimas 24 horas', logs = await traerLogs(desde);
    if(!logs.length) return [carta('bien', 'escudo', 'Seguridad tranquila', 'No hubo eventos raros en ' + et + '.')];
    const por = {}; logs.forEach((l) => { por[l.tipo] = (por[l.tipo] || 0) + 1; });
    const orden = Object.entries(por).sort((x, y) => y[1] - x[1]), out = [carta(logs.length > 25 ? 'alerta' : 'aviso', 'escudo', 'Eventos de seguridad', 'En ' + et + ' hubo ' + veces(logs.length, 'evento', 'eventos') + ': ' + lista(orden.map(([k, v]) => (TIPOS_LOG[k] || k) + ': ' + v)) + '.')];
    const porNeg = {}; logs.forEach((l) => { if(l.negocio_id) porNeg[l.negocio_id] = (porNeg[l.negocio_id] || 0) + 1; });
    const top = Object.entries(porNeg).sort((x, y) => y[1] - x[1])[0];
    if(top && top[1] >= 5){
      let nombre = 'un negocio'; try { const r = await enlace.sb.from('negocios').select('nombre').eq('id', top[0]).maybeSingle(); if(r.data) nombre = r.data.nombre; } catch(e){}
      out.push(carta('alerta', 'alerta', 'Revisa este negocio', nombre + ' concentra ' + veces(top[1], 'evento', 'eventos') + '.', 'Mira su detalle en Seguridad por si alguien está probando códigos.'));
    }
    return out;
  }
  async function cBugs(){
    const b = await traerBugs(), ab = b.filter((x) => x.estado === 'abierto'), pr = b.filter((x) => x.estado === 'en_progreso');
    if(!b.length) return [carta('bien', 'bug', 'Sin reportes', 'Nadie ha reportado bugs ni sugerencias.')];
    const out = [carta(ab.length ? 'aviso' : 'bien', 'bug', 'Bugs y sugerencias', veces(ab.length, 'reporte abierto', 'reportes abiertos') + ' y ' + veces(pr.length, 'en progreso', 'en progreso') + '.')];
    if(ab.length) out.push(carta('info', 'bug', 'Lo más reciente', lista(ab.slice(0, 3).map((x) => '"' + x.titulo + '"')) + '.', 'Atiende primero los más viejos para que nadie se quede esperando.'));
    return out;
  }
  async function cSoporte(){
    const s = await traerSoporte();
    if(s == null) return [carta('neutro', 'mensaje', 'Soporte', 'No pude leer los chats de soporte ahora mismo.')];
    const sin = s.filter((c) => Number(c.sin_leer) > 0), total = s.reduce((a, c) => a + Number(c.sin_leer || 0), 0);
    if(!sin.length) return [carta('bien', 'mensaje', 'Soporte al día', 'No tienes mensajes sin leer.')];
    return [carta('aviso', 'mensaje', 'Mensajes sin leer', 'Tienes ' + veces(total, 'mensaje', 'mensajes') + ' sin leer de ' + veces(sin.length, 'negocio', 'negocios') + ': ' + lista(sin.slice(0, 4).map((c) => c.negocio_nombre)) + '.', 'Contesta pronto: un negocio que recibe respuesta rápida se queda.')];
  }
  async function cDispositivos(){
    const d = await negociosYPagos(), total = d.activos.reduce((a, n) => a + Number(n.dispositivos_permitidos || 0), 0);
    return [carta('info', 'tienda', 'Dispositivos contratados', 'Entre los ' + veces(d.activos.length, 'negocio activo', 'negocios activos') + ' suman ' + veces(total, 'dispositivo', 'dispositivos') + '.')];
  }
  async function cResumen(t){
    const out = [], d = await negociosYPagos(), c = estadoCobros(d), logs = await traerLogs(new Date(Date.now() - 86400000)), bugs = await traerBugs().catch(() => []), sop = await traerSoporte();
    const sem = parseTiempo('ultimos 7 dias').desde, nuevos = d.todos.filter((n) => n.created_at && new Date(n.created_at) >= sem).length;
    out.push(carta('info', 'tienda', 'Negocios', 'Hay ' + veces(d.activos.length, 'negocio activo', 'negocios activos') + (d.baneados.length ? ' (' + veces(d.baneados.length, 'baneado', 'baneados') + ')' : '') + '. Esta semana llegaron ' + veces(nuevos, 'nuevo', 'nuevos') + '.'));
    out.push(carta('info', 'dinero', 'Dinero del periodo', 'Esperas ' + $d(c.esperado) + ' y ya cobraste ' + $d(c.cobrado) + '.'));
    out.push(c.atrasados.length ? carta('alerta', 'alerta', 'Cobros atrasados', veces(c.atrasados.length, 'negocio', 'negocios') + ': ' + lista(c.atrasados.slice(0, 4).map((x) => x.n.nombre)) + '.', 'Escríbeles hoy.') : carta('bien', 'dinero', 'Sin atrasos', 'Todos van al corriente con su pago.'));
    out.push(carta(logs.length > 25 ? 'alerta' : (logs.length ? 'aviso' : 'bien'), 'escudo', 'Seguridad (24 h)', logs.length ? veces(logs.length, 'evento raro', 'eventos raros') + ' en las últimas 24 horas.' : 'Sin eventos raros en las últimas 24 horas.'));
    const ab = bugs.filter((x) => x.estado === 'abierto').length;
    out.push(carta(ab ? 'aviso' : 'bien', 'bug', 'Bugs', ab ? veces(ab, 'reporte abierto', 'reportes abiertos') + '.' : 'No hay reportes abiertos.'));
    if(sop){ const n = sop.reduce((a, x) => a + Number(x.sin_leer || 0), 0); out.push(carta(n ? 'aviso' : 'bien', 'mensaje', 'Soporte', n ? 'Tienes ' + veces(n, 'mensaje', 'mensajes') + ' sin leer.' : 'Sin mensajes por leer.')); }
    return out;
  }
  async function cAyuda(){
    return [carta('info', 'foco', 'Resumen de PUVE (solo para ti)', 'Pregúntame por negocios, cobros, seguridad, bugs o soporte. Esta pantalla es de uso exclusivo del superadmin. Toca una de las preguntas de abajo para empezar.')];
  }
  const MANEJADORES = { resumen: cResumen, negocios: cNegocios, finanzas: cFinanzas, seguridad: cSeguridad, bugs: cBugs, soporte: cSoporte, dispositivos: cDispositivos, ayuda: cAyuda };

  async function responder(texto){
    if(!enlace.esSuperadmin()) return [carta('alerta', 'escudo', 'Sin permiso', 'Esta información es de uso exclusivo del superadmin de PUVE.')];
    const t0 = norm(texto), t = parseTiempo(texto), ids = detectar(t0);
    if(!ids.length) return [carta('neutro', 'foco', 'No te entendí bien', 'Prueba con: "¿cómo va PUVE hoy?", "¿quién no ha pagado?" o "¿hay algo raro en seguridad?".', null, ['¿Cómo va PUVE hoy?', '¿Quién no ha pagado?', '¿Hay algo raro en seguridad?'].map((x) => ({ texto: x, pregunta: x })))];
    const out = [];
    for(const id of ids){ out.push(...await MANEJADORES[id](t)); }
    return out;
  }

  let montado = null;
  window.PuveResumenAdmin = {
    enlazar(o){ enlace = Object.assign(enlace, o || {}); },
    responder,
    abrir(cont){
      if(!cont) return;
      if(!enlace.esSuperadmin()){ cont.textContent = ''; return; }
      if(montado === cont && cont.firstChild) return;
      montado = cont;
      R.crearChat(cont, { titulo: 'PUVE IA · Superadmin', subtitulo: 'Solo para el equipo de PUVE', placeholder: 'Ej: ¿quién no ha pagado?', chips: ['¿Cómo va PUVE hoy?', '¿Quién no ha pagado?', '¿Hay algo raro en seguridad?', 'Negocios nuevos esta semana', '¿Hay mensajes sin leer?'], saludo: cAyuda, responder });
    },
    cerrar(){ montado = null; }
  };
})();
