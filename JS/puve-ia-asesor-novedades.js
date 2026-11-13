/* PUVE IA · Asesor — te pone al día (Etapa 3; motor propio, SIN IA externa)
 * Al abrir el chat, si pasaron más de 3 horas desde tu última visita y hay algo que importa, PUVE IA habla primero: «Te pongo al día».
 * También responde a «¿qué hay de nuevo?», «ponme al día», «¿hay algo urgente?».
 * Qué revisa (solo con tus datos, comparando contra la última visita que anotó en tu Supabase, tabla ia_asesor_memoria, SQL 134):
 *  · productos que se AGOTARON o se están acabando desde la última vez · productos por CADUCAR en 7 días
 *  · ventas de AYER contra un mismo día de la semana normal (solo si es raro: -30% o +30%) · ventas desde tu última visita
 *  · ideas que probaste y ya pasaron 14 días (para medir si funcionaron) · tu meta del mes (si vas corto o ya la lograste)
 * No avisa dos veces lo mismo, no guarda nada de clientes (solo nombres de productos y fechas) y solo lo usa el encargado.
 * La primera vez solo anota la visita (no tiene con qué comparar); si pidieras «¿qué hay de nuevo?» te dice lo que hay hoy.
 */
(function(){
  'use strict';
  const R = window.PuveResumen, M = window.PuveIaAsesorMemoria;
  if(!R || !R.internos || !M || !window.PuveIaAsesor) return;
  const I = R.internos, { D, N, P, S, C, sug, lista, veces, $r, puedeCostos } = I;
  const H = {};
  const HORAS_MIN_AUTO = 3;        // antes de esto no se vuelve a avisar solo
  const PRIO_AUTO = 55;            // avisa solo si hay algo con al menos esta importancia
  const DIA_MS = 86400000;
  const pct = (n) => Math.round(Math.abs(n) * 100) + '%';
  const suma = (arr, f) => arr.reduce((s, x) => s + (f(x) || 0), 0);
  const corto = (n) => String(n || '').slice(0, 40);
  const SOLO_ENCARGADO = () => [P('Las novedades del negocio, con inventario y metas, las ve el encargado.')];
  const tiempo = (h) => h < 1 ? 'hace ' + Math.max(1, Math.round(h * 60)) + ' minutos' : (h < 24 ? 'hace ' + Math.round(h) + ' horas' : (h < 48 ? 'ayer' : 'hace ' + Math.floor(h / 24) + ' días'));

  // Junta lo que cambió. snap = la «última visita» guardada (o null la primera vez).
  async function calcular(snap){
    const ahora = new Date(), desde = snap ? new Date(snap.datos.en) : null, horas = desde ? (ahora - desde) / 3600000 : null, prev = (snap && snap.datos) || {};
    const an = await D.analisis(), d = await D.diario(40), hoyF = D.fechaLocal(ahora), items = [];
    const total = (f) => (d.find((x) => x.fecha === f) || { total: 0 }).total;

    // ventas desde la última visita (contra lo que sería normal para ese tiempo)
    if(desde && horas >= 2){
      const pd = await D.cargarPeriodo({ desde, hasta: new Date(ahora.getTime() + 60000), prevDesde: new Date(desde.getTime() - 30 * DIA_MS), prevHasta: desde }, false), a = pd.act;
      const ult28 = d.filter((x) => x.fecha < hoyF).slice(-28), tipicoDia = ult28.length >= 7 ? suma(ult28, (x) => x.total) / 28 : null, esperado = tipicoDia != null ? tipicoDia * horas / 24 : null;
      let texto = veces(a.n, 'venta', 'ventas') + ' por ' + $r(a.total), prio = 40, chip = null;
      if(esperado > 0 && horas >= 20){
        const r = a.total / esperado;
        if(r >= 1.25){ texto += ': ' + pct(r - 1) + ' más de lo normal para ese tiempo.'; prio = 60; }
        else if(r <= 0.75){ texto += ': ' + pct(1 - r) + ' menos de lo normal para ese tiempo.'; prio = 70; chip = '¿Por qué bajaron mis ventas?'; }
        else texto += ': dentro de lo normal.';
      } else texto += '.';
      items.push({ prio, titulo: 'Ventas desde tu última visita (' + tiempo(horas) + ')', texto, chip });
    }

    // ayer contra un mismo día de la semana normal (solo se avisa si es raro y solo una vez)
    const ayer = new Date(ahora); ayer.setDate(ayer.getDate() - 1); const ayerF = D.fechaLocal(ayer);
    if(prev.ayer !== ayerF){
      const antes = [7, 14, 21, 28].map((k) => { const x = new Date(ayer); x.setDate(x.getDate() - k); return total(D.fechaLocal(x)); }).filter((t) => t > 0);
      if(antes.length >= 3){
        const prom = suma(antes, (t) => t) / antes.length, y = total(ayerF), r = y / prom, dn = N.DIAS_BONITO[ayer.getDay()];
        if(r <= 0.7 || r >= 1.3) items.push({ prio: r <= 0.7 ? 80 : 55, titulo: 'Ayer ' + (r <= 0.7 ? 'vendiste menos de lo normal' : 'vendiste más de lo normal'),
          texto: y === 0 ? 'No registraste ventas ayer; un ' + dn + ' normal vendes unos ' + $r(prom) + '.' : 'Vendiste ' + $r(y) + ', ' + pct(r - 1) + (r < 1 ? ' menos' : ' más') + ' que un ' + dn + ' normal (' + $r(prom) + ').', chip: r <= 0.7 ? '¿Por qué bajaron mis ventas?' : '¿Cómo me fue ayer?' });
      }
    }

    // inventario: se agotó o se está acabando algo que sí vendes
    const bajos = an.lista.filter((x) => x.fisico && x.u30 > 0 && (x.stock <= 0 || x.dias <= 3)), yaBajos = new Set(prev.bajos || []), nuevos = bajos.filter((x) => !yaBajos.has(corto(x.nombre)));
    const agot = nuevos.filter((x) => x.stock <= 0), pocos = nuevos.filter((x) => x.stock > 0);
    if(agot.length) items.push({ prio: 90, titulo: agot.length === 1 ? 'Se agotó un producto que sí vendes' : 'Se agotaron ' + agot.length + ' productos que sí vendes', texto: lista(agot.slice(0, 4).map((x) => x.nombre)) + '. Lo que se agota no se vende.', chip: '¿Qué se me está acabando?' });
    if(pocos.length) items.push({ prio: 75, titulo: pocos.length === 1 ? 'Se te está acabando un producto' : 'Se te están acabando ' + pocos.length + ' productos', texto: pocos.slice(0, 4).map((x) => x.nombre + ' (alcanza para ~' + Math.max(1, Math.round(x.dias)) + (Math.round(x.dias) <= 1 ? ' día' : ' días') + ')').join(', ') + '.', chip: '¿Qué se me está acabando?' });

    // por caducar en 7 días
    const hoy0 = new Date(ahora); hoy0.setHours(0, 0, 0, 0);
    const cad = I.enlace().productos().filter((p) => p.fecha_caducidad && D.esFisico(p) && Number(p.stock) > 0).map((p) => ({ n: p.nombre, dias: Math.ceil((new Date(p.fecha_caducidad + 'T00:00:00').getTime() - hoy0.getTime()) / DIA_MS) })).filter((x) => x.dias <= 7).sort((x, y) => x.dias - y.dias);
    const yaCad = new Set(prev.caduc || []), nuevasC = cad.filter((x) => !yaCad.has(corto(x.n)));
    if(nuevasC.length) items.push({ prio: nuevasC.some((x) => x.dias <= 3) ? 85 : 60, titulo: nuevasC.length === 1 ? 'Un producto está por caducar' : nuevasC.length + ' productos están por caducar', texto: nuevasC.slice(0, 4).map((x) => x.n + (x.dias <= 0 ? ' (ya caducó)' : (x.dias === 1 ? ' (mañana)' : ' (en ' + x.dias + ' días)'))).join(', ') + '.', chip: '¿Qué está por caducar?' });

    // ideas que ya se pueden medir (una sola vez cada una)
    const avisadas = new Set(prev.avisadas || []), marcha = M.internos.enMarcha(), listas = marcha.filter((f) => Math.floor((ahora - new Date(f.datos.inicio)) / DIA_MS) >= 14 && !avisadas.has(f.clave));
    if(listas.length) items.push({ prio: 78, titulo: 'Ya puedes ver si funcionó lo que probaste', texto: 'Pasaron al menos 14 días de ' + lista(listas.slice(0, 2).map((f) => '«' + f.datos.titulo + '»')) + '. Pregúntame si funcionó y comparo antes y después.', chip: '¿Funcionó lo que probé?' });

    // meta del mes (una vez al día)
    const mm = M.internos.metas().find((f) => f.clave === 'ventas_mes'); let metaLograda = prev.metaLograda || null, metaAviso = prev.metaAviso || null;
    if(mm){
      const g = await M.internos.progresoMeta(mm), mes = hoyF.slice(0, 7);
      if(g.llevo >= g.monto){ if(metaLograda !== mes){ items.push({ prio: 60, titulo: '¡Lograste tu meta del mes!', texto: 'Llevas ' + $r(g.llevo) + ' de ' + $r(g.monto) + '. Lo que sigue ya es ganancia extra.', chip: null }); metaLograda = mes; } }
      else if(g.ritmo > 0 && g.proy < g.monto * 0.9 && ahora.getDate() >= 7 && metaAviso !== hoyF){ items.push({ prio: 65, titulo: 'Tu meta del mes va corta', texto: 'A tu ritmo cerrarías cerca de ' + $r(g.proy) + ', unos ' + $r(g.monto - g.proy) + ' abajo de tu meta de ' + $r(g.monto) + '. Necesitas vender unos ' + $r(g.necesito) + ' al día.', chip: '¿Cómo voy con mi meta?' }); metaAviso = hoyF; }
    }

    items.sort((x, y) => y.prio - x.prio);
    const keys = marcha.map((f) => f.clave);
    const nuevaSnap = { en: ahora.toISOString(), bajos: bajos.slice(0, 12).map((x) => corto(x.nombre)), caduc: cad.slice(0, 12).map((x) => corto(x.n)), avisadas: Array.from(new Set((prev.avisadas || []).concat(listas.map((f) => f.clave)))).filter((k) => keys.indexOf(k) >= 0).slice(0, 12), ayer: ayerF, metaLograda, metaAviso };
    return { items, horas, snap: nuevaSnap };
  }

  const guardarSnap = (datos) => M.guardar('visita', 'ultima', 'activa', datos);
  function bloques(r, max, intro){
    const top = r.items.slice(0, max), chips = [];
    top.forEach((i) => { if(i.chip && chips.indexOf(i.chip) < 0) chips.push(i.chip); });
    if(chips.length < 3) chips.push('¿Cómo puedo hacer crecer mi negocio?');
    return [P(intro), S('', top.map((i) => [i.titulo, i.texto])), C(chips.slice(0, 3).map(sug))];
  }

  // el asesor habla primero, solo si hay algo importante
  async function alAbrir(){
    if(!M.activo()) return null;
    await M.cargar();
    const snap = M.fila('visita', 'ultima');
    if(!snap){ const r = await calcular(null); await guardarSnap(r.snap); return null; }   // primera vez: solo anota
    if((Date.now() - new Date(snap.datos.en).getTime()) / 3600000 < HORAS_MIN_AUTO) return null;
    const r = await calcular(snap); await guardarSnap(r.snap);
    if(!r.items.some((i) => i.prio >= PRIO_AUTO)) return null;
    return { bloques: bloques(r, 4, '**Te pongo al día**, desde tu última visita (' + tiempo(r.horas) + '):') };
  }

  H.novedades = async () => {
    if(!puedeCostos()) return SOLO_ENCARGADO();
    await M.cargar();
    const snap = M.fila('visita', 'ultima'), r = await calcular(snap), r2 = await guardarSnap(r.snap);
    const nota = r2.ok ? [] : [P(r2.falta ? 'Aviso: para acordarme de tu última visita falta correr el script SQL 134 en Supabase.' : 'Aviso: no pude anotar esta visita para la próxima vez.')];
    if(!snap){
      if(!r.items.length) return [P('Es la primera vez que te pongo al día, así que no tengo con qué comparar. Hoy no veo nada urgente. Desde ahora anoto cuándo entras y cómo está tu inventario, y la próxima vez te cuento qué cambió.')].concat(nota);
      return bloques(r, 6, 'Es la primera vez que te pongo al día, así que te cuento lo que hay hoy. La próxima vez te diré qué cambió desde esta visita:').concat(nota);
    }
    if(!r.items.some((i) => i.prio >= PRIO_AUTO)) return [P('Todo tranquilo desde tu última visita (' + tiempo(r.horas) + '): no se agotó nada nuevo, nada está por caducar y no veo ventas raras. Te aviso cuando algo cambie.')].concat(r.items.length ? [S('', r.items.map((i) => [i.titulo, i.texto]))] : [], [C([sug('¿Cómo puedo hacer crecer mi negocio?'), sug('¿Cómo me fue hoy?')])], nota);
    return bloques(r, 6, '**Te pongo al día**, desde tu última visita (' + tiempo(r.horas) + '):').concat(nota);
  };

  N.SOLO_ENCARGADO.add('novedades');
  // «ponme al día» y «qué hay de nuevo» ya existían como resumen general: para el encargado ahora significan «qué cambió desde mi última visita»
  R.agregarRedireccion((intent, ctx) => (intent === 'resumen' && puedeCostos() && /(ponme al dia|ponme al corriente|que hay de nuevo|novedades|que me perdi|que paso mientras)/.test(N.norm(ctx.texto || ''))) ? 'novedades' : null);
  R.registrarTemas(H, { novedades: '¿Qué hay de nuevo?' }, { novedades: 'Revisando qué cambió desde tu última visita…' });

  window.PuveIaAsesorNovedades = { alAbrir, calcular, internos: { tiempo } };
})();
