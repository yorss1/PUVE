/* PUVE IA · Resumen del SUPERADMIN (uso exclusivo de PUVE)
 * Mismo estilo que el Resumen de los negocios, pero sobre la operación de PUVE: negocios, cobros, seguridad, bugs, soporte y
 * lo que la IA va aprendiendo de los usuarios (para aprobar o rechazar frases nuevas).
 * Solo lee (salvo aprobar/rechazar frases). Se carga ÚNICAMENTE cuando entra el superadmin y vuelve a comprobar el permiso antes de cada respuesta.
 * La protección real está en la base de datos: negocios, pagos_puve, logs_seguridad, bugs_puve y las funciones admin_* solo responden a administradores de PUVE.
 */
(function(){
  'use strict';
  const R = window.PuveResumen, N = window.PuveIaNlu;
  if(!R || !N) return;
  const { P, L, C, sug, lista, veces } = R.ayudas, norm = N.norm;
  let enlace = { sb: null, esSuperadmin: () => false, negociosAdmins: async () => new Set(), calcularMontoEsperado: () => 0, periodoParaNegocio: () => '', dinero: (n) => '$' + Number(n || 0).toFixed(2) };
  const $d = (n) => enlace.dinero(n), escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const msg = (b) => [{ bloques: b, meta: null }];

  const DICC = [
    { id: 'resumen', claves: ['resumen', 'como va puve', 'como estamos', 'como va todo', 'como nos va', 'como nos fue', 'reporte', 'que tal', 'como va la plataforma', 'como esta puve', 'como va hoy'] },
    { id: 'negocios', claves: ['negocio', 'negocios', 'registrados', 'nuevos', 'altas', 'baneado', 'baneados', 'activos', 'planes', 'plan'] },
    { id: 'finanzas', claves: ['cobro', 'cobros', 'pago', 'pagos', 'pagado', 'pagaron', 'vencido', 'vencidos', 'atrasado', 'atrasados', 'no han pagado', 'quien debe', 'deben', 'ingresos', 'dinero', 'cobrar', 'cobrado', 'bloqueado', 'bloqueados', 'finanzas'] },
    { id: 'seguridad', claves: ['seguridad', 'ataque', 'ataques', 'intentos', 'sospechoso', 'sospechosos', 'login fallido', 'logins', 'peligro', 'hackeo', 'acceso', 'algo raro'] },
    { id: 'bugs', claves: ['bug', 'bugs', 'error', 'errores', 'reporte de error', 'reportes', 'fallas', 'falla', 'sugerencias', 'sugerencia'] },
    { id: 'soporte', claves: ['soporte', 'mensajes', 'chats', 'chat', 'sin leer', 'conversaciones', 'atencion', 'me escribieron', 'quien me escribio'] },
    { id: 'dispositivos', claves: ['dispositivo', 'dispositivos', 'cajas', 'cajeros contratados'] },
    { id: 'aprendizaje', claves: ['aprendiendo', 'aprendizaje', 'aprende', 'entrenar', 'entrenamiento', 'frases', 'no entendio', 'no entiende', 'preguntas nuevas', 'que preguntan', 'vocabulario'] },
    { id: 'ayuda', claves: ['ayuda', 'que puedes', 'que haces', 'que sabes', 'hola', 'buenas', 'buenos dias', 'buenas tardes', 'buenas noches'] }
  ];
  function detectar(t){
    const puntos = {};
    DICC.forEach((d) => d.claves.forEach((k) => { const nk = norm(k); if(new RegExp('(^| )' + escRe(nk)).test(t)) puntos[d.id] = (puntos[d.id] || 0) + Math.pow(nk.split(' ').length, 2); }));
    const orden = Object.keys(puntos).sort((a, b) => puntos[b] - puntos[a]);
    if(!orden.length) return [];
    let ids = orden.filter((i) => puntos[i] >= Math.max(1, puntos[orden[0]] * 0.6)).slice(0, 2);
    if(ids.includes('resumen')) return ['resumen'];
    if(ids.includes('ayuda') && ids.length > 1) ids = ids.filter((i) => i !== 'ayuda');
    return ids;
  }

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
    const hoy = new Date(), pasoLimite = hoy.getDate() > 5; let esperado = 0, cobrado = 0; const atrasados = [], pendientes = [];
    d.activos.forEach((n) => {
      const tipo = n.tipo_plan || 'mensual', per = enlace.periodoParaNegocio(tipo), pago = d.pagos.find((p) => p.negocio_id === n.id && p.periodo === per);
      const esp = (pago && !pago.fecha_pago && pago.monto_esperado != null) ? Number(pago.monto_esperado) : Number(enlace.calcularMontoEsperado(n.dispositivos_permitidos, tipo)) || 0;
      esperado += esp;
      if(pago && pago.fecha_pago) cobrado += Number(pago.monto_pagado || esp);
      else if(n.bloqueado_por_pago || (tipo === 'mensual' && pasoLimite)) atrasados.push({ n, esp, bloqueado: !!n.bloqueado_por_pago });
      else pendientes.push({ n, esp });
    });
    return { esperado, cobrado, atrasados, pendientes };
  }
  async function traerLogs(desde){ const r = await enlace.sb.from('logs_seguridad').select('tipo,negocio_id,creado_en').gte('creado_en', desde.toISOString()).order('creado_en', { ascending: false }).limit(1000); if(r.error) throw new Error(r.error.message); return r.data || []; }
  async function traerBugs(){ const r = await enlace.sb.from('bugs_puve').select('titulo,estado,tipo,creado_en').order('creado_en', { ascending: false }).limit(300); if(r.error) throw new Error(r.error.message); return r.data || []; }
  async function traerSoporte(){ try { const r = await enlace.sb.rpc('admin_listar_conversaciones_soporte'); return r.error ? null : (r.data || []); } catch(e){ return null; } }
  const TIPOS_LOG = { codigo_caja_invalido: 'códigos de caja incorrectos', acceso_negocio_baneado: 'intentos de entrar a negocios baneados', limite_dispositivos: 'intentos de pasar el límite de dispositivos', login_fallido: 'inicios de sesión fallidos' };

  const H = {};
  H.negocios = async (t) => {
    const d = await negociosYPagos(), desde = t.explicito ? t.desde : N.ultimos(7).desde, et = t.explicito ? t.etiqueta : 'los últimos 7 días';
    const nuevos = d.todos.filter((n) => n.created_at && new Date(n.created_at) >= desde), porPlan = {}; d.activos.forEach((n) => { const k = n.tipo_plan || 'mensual'; porPlan[k] = (porPlan[k] || 0) + 1; });
    const out = [P('Hay **' + veces(d.activos.length, 'negocio activo', 'negocios activos') + '**' + (d.baneados.length ? ' y ' + veces(d.baneados.length, 'baneado', 'baneados') : '') + '.')];
    out.push(P(nuevos.length ? 'Llegaron **' + veces(nuevos.length, 'negocio nuevo', 'negocios nuevos') + '** durante ' + et + ': ' + lista(nuevos.slice(0, 5).map((n) => n.nombre)) + (nuevos.length > 5 ? ' y ' + (nuevos.length - 5) + ' más' : '') + '.' : 'No llegaron negocios nuevos durante ' + et + '. Si quieres más, revisa tus embajadores y la publicidad.'));
    if(Object.keys(porPlan).length) out.push(L('Por tipo de plan', Object.entries(porPlan).map(([k, v]) => [k, String(v), ''])));
    return out;
  };
  H.finanzas = async () => {
    const d = await negociosYPagos(), c = estadoCobros(d), faltan = Math.max(0, c.esperado - c.cobrado), out = [];
    out.push(P('Esperas cobrar **' + $d(c.esperado) + '** y ya cobraste **' + $d(c.cobrado) + '**' + (faltan ? '. Faltan **' + $d(faltan) + '**.' : '. ¡Ya está todo cobrado!') + ' (Sin contar descuentos por referido.)'));
    if(c.atrasados.length) out.push(P('**' + veces(c.atrasados.length, 'negocio va atrasado', 'negocios van atrasados') + '**:'), L('', c.atrasados.slice(0, 6).map((x) => [x.n.nombre, $d(x.esp), x.bloqueado ? 'bloqueado' : 'atrasado'])), P('Escríbeles hoy; si no responden, bloquea el acceso desde Finanzas.'));
    else out.push(P('Ningún negocio va atrasado con su pago.'));
    if(c.pendientes.length) out.push(P(veces(c.pendientes.length, 'negocio todavía no paga', 'negocios todavía no pagan') + ', pero aún están a tiempo.'));
    return out;
  };
  H.seguridad = async (t) => {
    const desde = t.explicito ? t.desde : new Date(Date.now() - 86400000), et = t.explicito ? t.etiqueta : 'las últimas 24 horas', logs = await traerLogs(desde);
    if(!logs.length) return [P('Seguridad tranquila: no hubo eventos raros en ' + et + '.')];
    const por = {}; logs.forEach((l) => { por[l.tipo] = (por[l.tipo] || 0) + 1; });
    const out = [P('En ' + et + ' hubo **' + veces(logs.length, 'evento raro', 'eventos raros') + '**.'), L('', Object.entries(por).sort((x, y) => y[1] - x[1]).map(([k, v]) => [TIPOS_LOG[k] || k, String(v), '']))];
    const porNeg = {}; logs.forEach((l) => { if(l.negocio_id) porNeg[l.negocio_id] = (porNeg[l.negocio_id] || 0) + 1; });
    const top = Object.entries(porNeg).sort((x, y) => y[1] - x[1])[0];
    if(top && top[1] >= 5){ let nombre = 'un negocio'; try { const r = await enlace.sb.from('negocios').select('nombre').eq('id', top[0]).maybeSingle(); if(r.data) nombre = r.data.nombre; } catch(e){} out.push(P('Revisa a **' + nombre + '**: concentra ' + veces(top[1], 'evento', 'eventos') + '. Mira su detalle en Seguridad por si alguien está probando códigos.')); }
    return out;
  };
  H.bugs = async () => {
    const b = await traerBugs(), ab = b.filter((x) => x.estado === 'abierto'), pr = b.filter((x) => x.estado === 'en_progreso');
    if(!b.length) return [P('Nadie ha reportado bugs ni sugerencias.')];
    const out = [P('Hay **' + veces(ab.length, 'reporte abierto', 'reportes abiertos') + '** y ' + pr.length + ' en progreso.')];
    if(ab.length) out.push(L('Lo más reciente', ab.slice(0, 3).map((x) => [x.titulo, '', ''])), P('Atiende primero los más viejos para que nadie se quede esperando.'));
    return out;
  };
  H.soporte = async () => {
    const s = await traerSoporte();
    if(s == null) return [P('No pude leer los chats de soporte ahora mismo.')];
    const sin = s.filter((c) => Number(c.sin_leer) > 0), total = s.reduce((a, c) => a + Number(c.sin_leer || 0), 0);
    if(!sin.length) return [P('Soporte al día: no tienes mensajes sin leer.')];
    return [P('Tienes **' + veces(total, 'mensaje', 'mensajes') + '** sin leer de ' + veces(sin.length, 'negocio', 'negocios') + ': ' + lista(sin.slice(0, 4).map((c) => c.negocio_nombre)) + '.'), P('Contesta pronto: un negocio que recibe respuesta rápida se queda.')];
  };
  H.dispositivos = async () => { const d = await negociosYPagos(), total = d.activos.reduce((a, n) => a + Number(n.dispositivos_permitidos || 0), 0); return [P('Entre los ' + veces(d.activos.length, 'negocio activo', 'negocios activos') + ' suman **' + veces(total, 'dispositivo', 'dispositivos') + '** contratados.')]; };
  H.resumen = async () => {
    const d = await negociosYPagos(), c = estadoCobros(d), logs = await traerLogs(new Date(Date.now() - 86400000)), bugs = await traerBugs().catch(() => []), sop = await traerSoporte();
    const sem = N.ultimos(7).desde, nuevos = d.todos.filter((n) => n.created_at && new Date(n.created_at) >= sem).length, ab = bugs.filter((x) => x.estado === 'abierto').length, out = [];
    out.push(P('Hay **' + veces(d.activos.length, 'negocio activo', 'negocios activos') + '**' + (d.baneados.length ? ' (' + veces(d.baneados.length, 'baneado', 'baneados') + ')' : '') + '. Esta semana llegaron ' + veces(nuevos, 'nuevo', 'nuevos') + '.'));
    out.push(P('Esperas cobrar **' + $d(c.esperado) + '** y ya cobraste **' + $d(c.cobrado) + '**. ' + (c.atrasados.length ? veces(c.atrasados.length, 'negocio va atrasado', 'negocios van atrasados') + ': ' + lista(c.atrasados.slice(0, 4).map((x) => x.n.nombre)) + '. Escríbeles hoy.' : 'Todos van al corriente.')));
    const filas = [['Seguridad (24 h)', logs.length ? veces(logs.length, 'evento', 'eventos') : 'tranquila', ''], ['Bugs abiertos', String(ab), '']];
    if(sop) filas.push(['Mensajes sin leer', String(sop.reduce((a, x) => a + Number(x.sin_leer || 0), 0)), '']);
    out.push(L('', filas));
    return out;
  };
  // lo que la IA va aprendiendo: frases que no entendió y frases nuevas propuestas por los usuarios
  H.aprendizaje = async () => {
    const r = await enlace.sb.rpc('admin_ia_frases', { p_estado: 'pendiente' });
    if(r.error) return [P('No pude leer lo que la IA está aprendiendo. ¿Ya corriste el script SQL 131?')];
    const todas = r.data || [], sin = todas.filter((x) => x.intent === 'desconocido').slice(0, 5), nuevas = todas.filter((x) => x.intent !== 'desconocido').slice(0, 6), out = [];
    if(!todas.length) return [P('Por ahora no hay frases pendientes. Cuando los usuarios corrijan o no los entienda, aparecerán aquí.')];
    const recargar = async () => H.aprendizaje();
    const decidir = (id, estado, ok) => async () => { const x = await enlace.sb.rpc('admin_ia_decidir', { p_id: id, p_estado: estado }); return x.error ? msg([P('No se pudo guardar: ' + x.error.message)]) : msg([P(ok)]); };
    if(nuevas.length){
      out.push(P('Estas frases **' + 'las proponen los usuarios' + '** y aún no son vocabulario de todos (pasan solas cuando coinciden 3 negocios):'));
      nuevas.forEach((x) => { out.push(L('"' + x.frase + '"', [['Tema', x.intent, ''], ['Votos', x.votos_ok + ' sí · ' + x.votos_no + ' no', x.negocios + ' negocios']]), C([{ texto: 'Aprobar', fn: decidir(x.id, 'aprobada', 'Aprobada: ya la entienden todos los negocios.') }, { texto: 'Rechazar', fn: decidir(x.id, 'rechazada', 'Rechazada: no se usará.') }])); });
    }
    if(sin.length){
      out.push(P('Esto es lo que **no entendió**. Elige a qué tema pertenece y todos los negocios aprenderán:'));
      sin.forEach((x) => {
        const cl = N.clasificar(x.frase).lista.slice(0, 3).filter((c) => c.p > 0.08), asignar = (i) => async () => { const z = await enlace.sb.rpc('admin_ia_asignar', { p_id: x.id, p_intent: i }); return z.error ? msg([P('No se pudo guardar: ' + z.error.message)]) : msg([P('Listo: "' + x.frase + '" ahora cuenta como "' + i + '".')]); };
        out.push(L('"' + x.frase + '"', [['Veces', String(x.votos_no || 1), x.negocios + ' negocios']]), C(cl.map((c) => ({ texto: c.i, fn: asignar(c.i) })).concat([{ texto: 'Ignorar', fn: decidir(x.id, 'rechazada', 'Ignorada.') }])));
      });
    }
    return out;
  };
  H.ayuda = async () => [P('Soy PUVE IA, pero en versión **superadmin** (solo para el equipo de PUVE).'), P('Pregúntame por negocios, cobros, seguridad, bugs o soporte. También puedes ver **lo que la IA está aprendiendo** de los usuarios y aprobar o rechazar frases nuevas.')];

  async function responder(texto, estado, onPaso){
    if(!enlace.esSuperadmin()) return msg([P('Esta información es de uso exclusivo del superadmin de PUVE.')]);
    const t0 = norm(texto), t = N.parseTiempo(texto), ids = detectar(t0);
    if(!ids.length) return msg([P('No te entendí bien. Prueba con: "¿cómo va PUVE hoy?", "¿quién no ha pagado?", "¿hay algo raro en seguridad?" o "¿qué está aprendiendo la IA?".')]);
    const out = [];
    for(const id of ids){ if(onPaso) onPaso('Revisando ' + id + '…'); out.push({ bloques: await H[id](t), meta: null }); }
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
      R.crearChat(cont, { titulo: 'PUVE IA · Superadmin', subtitulo: 'Solo para el equipo de PUVE. ¿Qué quieres revisar?', placeholder: 'Ej: ¿quién no ha pagado?', aprende: false, chips: ['¿Cómo va PUVE hoy?', '¿Quién no ha pagado?', '¿Hay algo raro en seguridad?', '¿Qué está aprendiendo la IA?', '¿Hay mensajes sin leer?'],
        responder, ejecutar: async (i, ctx, estado) => msg(await H[i]({ explicito: false })) });
    },
    cerrar(){ montado = null; }
  };
})();
