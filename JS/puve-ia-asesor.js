/* PUVE IA · Asesor de crecimiento (motor propio, SIN IA externa: todo se calcula aquí con los datos de tu negocio)
 * Qué hace:
 *  · «¿Cómo hago crecer mi negocio?» → ideas ordenadas por lo que más conviene, cada una con SUS números, su cuenta y su supuesto.
 *  · «¿Estoy listo para abrir otra sucursal?» → revisa 6 señales de tu propio historial y dice si todavía no, casi o pinta bien (con lo que NO puede ver).
 *  · «Dame un plan para la semana» → las mejores ideas ordenadas en hoy / esta semana / este mes.
 *  · Sigue la conversación: «¿cómo hago la primera?», «¿por qué me recomiendas eso?», «dame otra idea» (recuerda cuál idea se estaba hablando).
 * Todo es estimación honesta: dice el supuesto detrás de cada cifra y nunca promete resultados. Solo lee: no cambia ventas, inventario ni precios.
 * Se carga después de puve-ia-amigo.js y se engancha con PuveResumen.registrarTemas / agregarRedireccion.
 */
(function(){
  'use strict';
  const R = window.PuveResumen;
  if(!R || !R.internos || !R.agregarRedireccion) return;
  const I = R.internos, { D, N, P, L, S, C, sug, lista, veces, fmt, $d, $r, esCajero, puedeCostos, mediana, estrellas, oportunidades, paraNoInvertir } = I;
  const H = {};
  const nombres = (arr) => lista(arr.map((x) => x.nombre));
  const pct = (n) => Math.round(n * 100) + '%';
  const dia = (d) => 'el ' + N.DIAS_BONITO[d];
  const hora = (h) => N.horaFuerteTexto(h);
  const suma = (arr, f) => arr.reduce((s, x) => s + (f(x) || 0), 0);
  const MIN_VENTAS = 10;          // con menos ventas en 30 días no se dan ideas con números
  const ocurrencias = (dow, dias) => { let n = 0; for(let k = 0; k < dias; k++) if(new Date(Date.now() - k * 86400000).getDay() === dow) n++; return n; };
  const VIGENCIA_MS = 5 * 60000;  // las ideas de una charla se recalculan cada 5 minutos

  // ---------- el estado de la charla: qué ideas se han mostrado y de cuál se está hablando ----------
  const memoria = (estado) => estado.asesor || (estado.asesor = { ideas: null, t: 0, mostradas: [], ultima: null });

  function textoImpacto(i){
    if(i.impacto == null) return '';
    const base = i.tipo === 'ventas' ? ' Podría sumar unos ' + $r(i.impacto) + ' en ventas al mes' : (i.tipo === 'dinero' ? ' Liberaría unos ' + $r(i.impacto) + ' para comprar lo que sí se vende' : ' Podría dejarte unos ' + $r(i.impacto) + ' más de ganancia al mes');
    return base + ' (si ' + i.supuesto + ').';
  }

  // ---------- generador de ideas: cada una nace de un dato real del negocio ----------
  async function generarIdeas(){
    const an = await D.analisis(), pd = await D.cargarPeriodo(N.ultimos(30), false), a = pd.act;
    if(an.ventas30 < MIN_VENTAS) return { pocos: true, ventas: an.ventas30 };
    const ideas = [], vendidos = an.lista.filter((x) => x.u30 > 0), est = estrellas(an, 1)[0] || null, costos = puedeCostos();
    const par = an.pares[0] ? { p: an.pares[0], a: an.lista.find((x) => x.nombre === an.pares[0].a), b: an.lista.find((x) => x.nombre === an.pares[0].b) } : null;
    const meter = (i) => ideas.push(Object.assign({ impacto: null, tipo: 'ganancia', supuesto: '', cuenta: '', medir: '', evidencia: [], cuando: 'semana' }, i));

    // 1) completar los costos (sin ellos casi nada de ganancia se puede calcular)
    if(costos){
      const faltan = vendidos.filter((x) => x.costo == null).sort((x, y) => y.ing30 - x.ing30);
      if(!an.hayCostos || faltan.length >= 3){
        meter({ id: 'costos', prio: 96, cuando: 'hoy', titulo: 'Anota el costo de tus productos',
          texto: (faltan.length === 1 ? 'Un producto que sí vendes no tiene costo' : faltan.length + ' productos que sí vendes no tienen costo') + ' (' + nombres(faltan.slice(0, 4)) + '). Sin eso no puedo decirte cuáles te dejan dinero ni qué precio subir: mis cuentas de ganancia salen incompletas.',
          pasos: [['Abre Productos', 'Empieza por estos: ' + nombres(faltan.slice(0, 5)) + '.'], ['Escribe cuánto te cuesta cada uno', 'Lo que pagaste por pieza (con flete si lo hay). Si no te acuerdas, usa la última nota o factura del proveedor.'], ['Vuelve a preguntarme', 'Con los costos puestos te doy ideas con ganancia real.']],
          primerPaso: 'Capturar el costo de ' + nombres(faltan.slice(0, 3)),
          medir: 'Cuando todos tengan costo, pregúntame «¿qué producto me deja más?».',
          evidencia: [['Vendidos sin costo', String(faltan.length), nombres(faltan.slice(0, 4))], ['Vendidos con costo', String(vendidos.length - faltan.length), '']] });
      }
    }

    // 2) productos que dejan buen dinero por pieza pero se venden poco
    if(costos && an.hayCostos){
      const opp = oportunidades(an, 2);
      if(opp.length){
        const objetivo = Math.max(5, mediana(vendidos.map((x) => x.u30))), extras = opp.map((x) => Math.max(3, Math.min(60, Math.round(objetivo - x.u30), Math.round(x.u30)))) /* como mucho, duplicar lo que ya vende */, imp = opp.reduce((s, x, k) => s + x.mUnit * extras[k], 0), comp = D['compañero'](an, opp[0].nombre);
        meter({ id: 'impulsar', prio: 85, tipo: 'ganancia', impacto: imp, titulo: 'Empuja ' + nombres(opp),
          texto: opp.map((x) => x.nombre + ' te deja ' + $d(x.mUnit) + ' por pieza y vendiste solo ' + fmt(x.u30)).join('; ') + '. Es dinero que se queda en la mesa por no empujarlo.',
          supuesto: 'logras vender ' + lista(opp.map((x, k) => extras[k] + ' de ' + x.nombre)) + ' más al mes',
          cuenta: opp.map((x, k) => extras[k] + ' piezas × ' + $d(x.mUnit)).join(' + ') + ' = ' + $r(imp) + ' al mes',
          pasos: [['Dale lugar', 'Ponlo a la vista o junto a la caja y ofrécelo al cobrar: «¿le agrego un ' + opp[0].nombre + '?»'], ['Júntalo con lo que ya se vende', comp ? 'Tu gente compra ' + opp[0].nombre + ' junto con ' + comp.con + ' (' + veces(comp.veces, 'vez', 'veces') + ' este mes). Ofréceles los dos.' : 'Ofrécelo junto con tu estrella' + (est ? ' (' + est.nombre + ')' : '') + '.'], ['Cuida que no se acabe', 'Revisa que tengas suficiente para toda la semana.']],
          primerPaso: 'Poner ' + opp[0].nombre + ' a la vista y ofrecerlo al cobrar',
          medicion: { k: 'unid', prods: opp.map((x) => x.nombre), base: { u: suma(opp, (x) => x.u30) / 30, i: suma(opp, (x) => x.ing30) / 30 } },
          medir: 'Cuenta las piezas de ' + nombres(opp) + ' que vendes en 2 semanas y compáralas con las ' + fmt(Math.round(suma(opp, (x) => x.u30) * 14 / 30)) + ' que vendías en un periodo igual.',
          evidencia: opp.map((x) => [x.nombre, $d(x.mUnit) + ' por pieza', 'vendiste ' + fmt(x.u30) + ' en 30 días']) });
      }
    }

    // 3) combo con lo que ya se compra junto
    if(par && par.a && par.b){
      const precio = Math.round((par.a.precio + par.b.precio) * 0.92), conCosto = costos && par.a.costo != null && par.b.costo != null, margen = conCosto ? precio - par.a.costo - par.b.costo : null;
      meter({ id: 'combo', prio: 78, tipo: 'ganancia', impacto: margen != null && margen > 0 ? margen * 10 : null, titulo: 'Arma el combo ' + par.a.nombre + ' + ' + par.b.nombre,
        texto: 'Este mes se compraron juntos ' + veces(par.p.n, 'vez', 'veces') + ': tu gente ya los quiere juntos. Un combo a ' + $r(precio) + ' (8% menos que por separado) hace que más gente lleve los dos.',
        supuesto: 'se venden 10 combos más al mes', cuenta: margen != null && margen > 0 ? '10 combos × ' + $d(margen) + ' que deja cada uno = ' + $r(margen * 10) + ' al mes' : '',
        pasos: [['Crea el combo', 'En Inventario → Combos agrega ' + par.a.nombre + ' y ' + par.b.nombre + ' con precio de ' + $r(precio) + '. Revisa que el precio quede arriba de tu costo.'], ['Avísalo al cobrar', 'A quien lleve uno de los dos: «lleva los dos por ' + $r(precio) + '».'], ['Revísalo a las dos semanas', 'Mira cuántos combos se vendieron y si subió la venta de cada producto.']],
        primerPaso: 'Crear el combo ' + par.a.nombre + ' + ' + par.b.nombre + ' en Inventario → Combos',
        medicion: { k: 'unid', prods: [par.a.nombre, par.b.nombre], base: { u: (par.a.u30 + par.b.u30) / 30, i: (par.a.ing30 + par.b.ing30) / 30 } },
        medir: 'Cuántos combos vendes en 2 semanas y si subieron las ventas de ' + par.a.nombre + ' y ' + par.b.nombre + '.',
        evidencia: [[par.a.nombre + ' + ' + par.b.nombre, veces(par.p.n, 'vez', 'veces') + ' juntos', 'en 30 días'], ['Precio por separado', $r(par.a.precio + par.b.precio), ''], ['Precio del combo', $r(precio), '8% menos']] });
    }

    // 4) hora floja contra hora fuerte
    const activas = []; for(let h = 0; h < 24; h++) if(a.nHora[h] >= 3) activas.push(h);
    if(activas.length >= 4){
      const pico = activas.reduce((m, h) => a.porHora[h] > a.porHora[m] ? h : m, activas[0]), valle = activas.filter((h) => h !== pico).reduce((m, h) => a.porHora[h] < a.porHora[m] ? h : m, activas.find((h) => h !== pico));
      if(a.porHora[valle] > 0 && a.porHora[pico] >= 3 * a.porHora[valle]){
        const v = a.porHora[valle];
        meter({ id: 'hora', prio: 65, tipo: 'ventas', impacto: v * 0.2, titulo: 'Llena tu hora floja: ' + hora(valle),
          texto: 'Tu hora más fuerte es ' + hora(pico) + ' (' + $r(a.porHora[pico]) + ' en 30 días) y ' + hora(valle) + ' vendes solo ' + $r(v) + '. Ya tienes el local abierto esa hora; vale la pena darle a la gente un motivo para venir.',
          supuesto: 'esa hora vende 20% más', cuenta: $r(v) + ' × 20% = ' + $r(v * 0.2) + ' más al mes',
          pasos: [['Elige una oferta chica', 'Un descuento o un extra solo en ese horario (10% o un complemento de regalo). Que no baje de tu costo.'], ['Avísalo', 'Un cartel en la entrada y un mensaje a tus clientes frecuentes.'], ['Programa el precio si tu giro lo permite', 'En Productos, «Promociones por horario» cambia el precio solo en los días y horas que elijas.']],
          primerPaso: 'Definir una oferta pequeña para ' + hora(valle),
          medicion: { k: 'hora', h: valle, base: { t: v / 30 } },
          medir: 'Compara cuánto vendes en ' + hora(valle) + ' durante 2 semanas contra los ' + $r(v * 14 / 30) + ' de siempre.',
          evidencia: [['Hora más fuerte', hora(pico), $r(a.porHora[pico]) + ' en 30 días'], ['Hora más floja', hora(valle), $r(v) + ' en 30 días']] });
      }
    }

    // 5) día flojo contra día fuerte
    const dias = a.porDia.map((t, d) => ({ d, t })).filter((x) => x.t > 0);
    if(dias.length >= 4){
      const mejor = dias.reduce((m, x) => x.t > m.t ? x : m), peor = dias.reduce((m, x) => x.t < m.t ? x : m);
      if(mejor.t >= 2 * peor.t){
        meter({ id: 'dia', prio: 55, tipo: 'ventas', impacto: peor.t * 0.2, cuando: 'mes', titulo: 'Levanta ' + dia(peor.d),
          texto: 'Tu mejor día es ' + dia(mejor.d) + ' (' + $r(mejor.t) + ' en 30 días) y ' + dia(peor.d) + ' apenas ' + $r(peor.t) + '. Ese día tiene espacio para crecer.',
          supuesto: 'ese día vende 20% más', cuenta: $r(peor.t) + ' × 20% = ' + $r(peor.t * 0.2) + ' más al mes',
          pasos: [['Dale una razón para venir', 'Una oferta o un producto especial solo ' + dia(peor.d) + '.'], ['Avísalo con tiempo', 'Mensaje o cartel desde ' + dia((peor.d + 5) % 7) + '.'], ['Si no cambia, úsalo para otra cosa', 'Un día que casi no vende puede servir para surtir, limpiar o descansar.']],
          primerPaso: 'Definir una oferta para ' + dia(peor.d),
          medicion: { k: 'dia', d: peor.d, base: { t: peor.t / Math.max(4, ocurrencias(peor.d, 30)) } },
          medir: 'Compara lo que vendes ' + dia(peor.d) + ' durante 4 semanas contra los ' + $r(peor.t / 4.3) + ' de un día así.',
          evidencia: [['Día más fuerte', N.DIAS_BONITO[mejor.d], $r(mejor.t)], ['Día más flojo', N.DIAS_BONITO[peor.d], $r(peor.t)]] });
      }
    }

    // 6) que cada cliente gaste un poco más
    if(a.n >= 20 && a.ticket > 0){
      meter({ id: 'ticket', prio: 50, tipo: 'ventas', impacto: a.total * 0.05, titulo: 'Sube lo que gasta cada cliente',
        texto: 'Cada venta te deja en promedio ' + $d(a.ticket) + '. Si cada cliente llevara 5% más (' + $d(a.ticket * 0.05) + ' más), serían unos ' + $r(a.total * 0.05) + ' más al mes sin necesitar más gente.',
        supuesto: 'cada venta sube 5%', cuenta: $r(a.total) + ' × 5% = ' + $r(a.total * 0.05) + ' al mes',
        pasos: [['Ofrece un complemento', par && par.a && par.b ? 'Cuando alguien lleve ' + par.a.nombre + ', ofrécele ' + par.b.nombre + '.' : 'Pregunta siempre «¿algo más?» con un complemento barato a la vista.'], ['Pon cosas chicas junto a la caja', 'Lo que se compra por impulso: dulces, botanas, accesorios baratos.'], ['Promo por monto', 'Un regalo o descuento al pasar de ' + $r(a.ticket * 1.2) + ' (tu ticket promedio más 20%).']],
        primerPaso: 'Ofrecer un complemento en cada cobro esta semana',
        medicion: { k: 'ticket', base: { t: a.ticket } },
        medir: 'Mira tu ticket promedio dentro de 2 semanas (hoy es ' + $d(a.ticket) + ').',
        evidencia: [['Ticket promedio', $d(a.ticket), 'en ' + veces(a.n, 'venta', 'ventas') + ' de 30 días'], ['Ventas de 30 días', $r(a.total), '']] });
    }

    // 7) subir un poco el precio de lo que se vende mucho y deja poco
    if(costos && an.hayCostos){
      const cand = an.lista.filter((x) => x.mPct != null && x.mPct < 0.2 && x.u30 >= 5).sort((x, y) => y.u30 - x.u30).slice(0, 3);
      if(cand.length){
        const aum = cand.map((x) => Math.max(1, Math.round(x.precioReal * 0.07))), imp = cand.reduce((s, x, k) => s + aum[k] * x.u30, 0);
        meter({ id: 'precios', prio: 82, tipo: 'ganancia', impacto: imp, titulo: 'Sube un poco el precio de lo que sale mucho y deja poco',
          texto: nombres(cand) + ': ' + (cand.length === 1 ? 'lo vendes' : 'los vendes') + ' bastante pero de cada $100 que cobras solo te quedan unos $' + Math.round(cand[0].mPct * 100) + '. Un aumento pequeño casi no se nota y sí se siente en tu ganancia.',
          supuesto: 'se vende igual que ahora', cuenta: cand.map((x, k) => '+' + $d(aum[k]) + ' × ' + fmt(x.u30) + ' piezas').join(' + ') + ' = ' + $r(imp) + ' al mes',
          pasos: [['Sube poco', cand.map((x, k) => x.nombre + ' de ' + $r(x.precioReal) + ' a ' + $r(x.precioReal + aum[k])).join('; ') + '.'], ['Pruébalo una semana', 'Mira si se sigue vendiendo parecido.'], ['Si baja mucho, regrésalo', 'Si las ventas caen más de lo que ganas por pieza, el aumento no conviene.']],
          primerPaso: 'Subir ' + cand[0].nombre + ' a ' + $r(cand[0].precioReal + aum[0]),
          medicion: { k: 'unid', prods: cand.map((x) => x.nombre), base: { u: suma(cand, (x) => x.u30) / 30, i: suma(cand, (x) => x.ing30) / 30, g: suma(cand, (x) => x.margen30) / 30 }, precio: true },
          medir: 'Compara las piezas de ' + cand[0].nombre + ' de esa semana contra tus ' + fmt(Math.round(cand[0].u30 / 4.3)) + ' de siempre.',
          evidencia: cand.map((x) => [x.nombre, $d(x.mUnit) + ' por pieza', 'te queda ' + pct(x.mPct) + ' de lo que cobras · ' + fmt(x.u30) + ' vendidas']) });
      }
    }

    // 8) dinero parado en mercancía lenta
    if(costos && an.hayCostos){
      const par2 = paraNoInvertir(an, 4), capital = suma(par2, (x) => x.capital);
      if(par2.length && capital >= 300){
        meter({ id: 'parado', prio: 72, tipo: 'dinero', impacto: capital, titulo: 'Libera el dinero que tienes parado',
          texto: 'Tienes ' + $r(capital) + ' guardados en mercancía que casi no se mueve (' + nombres(par2) + '). Ese dinero podría estar comprando lo que sí se vende.',
          supuesto: 'recuperas al menos lo que costó esa mercancía', cuenta: par2.map((x) => x.nombre + ' ' + $r(x.capital)).join(' + ') + ' = ' + $r(capital),
          pasos: [['Haz una oferta que no pierda', 'Pregúntame «¿qué oferta hago?» y te calculo un precio que no baje de tu costo.'], ['Júntalo con tu estrella', 'Un combo con lo que sí se vende ayuda a moverlo.'], ['No lo vuelvas a comprar hasta que salga', 'Así no sigues guardando dinero en estante.'], ['Reinvierte lo recuperado', 'Pregúntame «¿qué debo comprar?» y úsalo en lo que más sale.']],
          primerPaso: 'Hacer una oferta con ' + par2[0].nombre,
          medir: 'Cuánto de ese inventario se vende en 3 semanas y cuánto dinero recuperas.',
          evidencia: par2.map((x) => [x.nombre, $r(x.capital), 'te dura ' + (x.dias === Infinity ? 'más de un año' : 'unos ' + fmt(Math.round(x.dias)) + ' días') + ' al ritmo actual']) });
      }
    }

    // 9) depender de muy pocos productos
    const conVentas = an.lista.filter((x) => x.ing30 > 0).sort((x, y) => y.ing30 - x.ing30);
    if(an.ing30 > 0 && conVentas.length >= 6){
      const top3 = conVentas.slice(0, 3), share = suma(top3, (x) => x.ing30) / an.ing30;
      if(share >= 0.6){
        meter({ id: 'concentracion', prio: 45, cuando: 'mes', titulo: 'No dependas de tan pocos productos',
          texto: nombres(top3) + ' son el ' + pct(share) + ' de lo que vendes. Si uno falla, se acaba o alguien más lo vende más barato, tus ventas lo resienten.',
          pasos: [['Revisa que nunca se te acaben', 'Esos tres siempre deben tener existencia.'], ['Prueba uno o dos productos que los complementen', 'Poca inversión y a prueba por dos semanas.'], ['Mira de nuevo en un mes', 'Si los tres bajan de ' + pct(Math.max(0.4, share - 0.15)) + ' de tus ventas, vas diversificando.']],
          primerPaso: 'Confirmar que ' + top3[0].nombre + ' no se acabe',
          medir: 'Que el porcentaje de tus 3 productos más vendidos baje de ' + pct(share) + '.',
          evidencia: top3.map((x) => [x.nombre, $r(x.ing30), pct(x.ing30 / an.ing30) + ' de tus ventas']) });
      }
    }

    // 10) producto que viene subiendo
    const sube = an.lista.filter((x) => x.u30 >= 5 && x.tend >= 0.3).sort((x, y) => y.tend - x.tend)[0];
    if(sube){
      const urgente = sube.fisico && sube.dias < 14;
      meter({ id: 'subiendo', prio: urgente ? 92 : 62, cuando: urgente ? 'hoy' : 'semana', titulo: 'Aprovecha que ' + sube.nombre + ' viene subiendo',
        texto: sube.nombre + ' vendió ' + Math.round(sube.tend * 100) + '% más que el mes anterior (' + fmt(sube.uPrev) + ' → ' + fmt(sube.u30) + ' piezas).' + (urgente ? ' Con lo que tienes te dura unos ' + fmt(Math.round(sube.dias)) + ' días: conviene pedirlo ya.' : ' Si la gente lo está pidiendo más, dale lugar y no dejes que se acabe.'),
        pasos: [['Asegura que no se acabe', urgente ? 'Haz el pedido hoy; lo que se agota no se vende.' : 'Revisa que tengas para al menos dos semanas.'], ['Ponlo a la vista', 'Si ya lo piden más, que sea fácil de encontrar.'], ['Pruébale un combo', 'Júntalo con algo que se venda menos para arrastrarlo.']],
        primerPaso: urgente ? 'Pedir ' + sube.nombre + ' hoy' : 'Revisar el inventario de ' + sube.nombre,
        medir: 'Que ' + sube.nombre + ' siga arriba de ' + fmt(sube.u30) + ' piezas al mes y nunca llegue a cero en el inventario.',
        evidencia: [[sube.nombre, fmt(sube.uPrev) + ' → ' + fmt(sube.u30) + ' piezas', '+' + Math.round(sube.tend * 100) + '% contra el mes anterior']].concat(sube.fisico ? [['Inventario', fmt(sube.stock) + ' piezas', 'alcanza para unos ' + (sube.dias === Infinity ? 'muchos' : fmt(Math.round(sube.dias))) + ' días']] : []) });
    }

    // 11) probar un producto nuevo (la apuesta más segura es la que complementa a la estrella)
    if(est){
      const comp = D['compañero'](an, est.nombre);
      meter({ id: 'nuevo', prio: 30, cuando: 'mes', titulo: 'Prueba un producto nuevo, con poca inversión',
        texto: 'Tu estrella es ' + est.nombre + (comp ? ' y tu gente la compra junto con ' + comp.con : '') + '. Un producto que la complemente es la apuesta más segura para crecer: ya tienes clientes que la quieren.',
        pasos: [['Anota lo que te piden y no tienes', 'Durante una semana, en una libreta o en el celular. Lo que más se repita es tu candidato.'], ['Elige UNO que complemente a ' + est.nombre, 'Compra lo mínimo posible para probar.'], ['Dale dos semanas', 'Si no vende lo necesario para recuperar lo que invertiste, retíralo y prueba otro.']],
        primerPaso: 'Anotar durante una semana lo que te piden y no tienes',
        medir: 'Que en 2 semanas el producto nuevo venda al menos lo que costó la compra inicial.',
        evidencia: [['Tu producto estrella', est.nombre, fmt(est.u30) + ' vendidas en 30 días']].concat(comp ? [['Se compra junto con', comp.con, veces(comp.veces, 'vez', 'veces') + ' este mes']] : []) });
    }

    const puntaje = (i) => i.prio + (i.impacto ? Math.min(15, Math.log10(i.impacto + 1) * 4) : 0);
    ideas.sort((x, y) => puntaje(y) - puntaje(x));
    return { ideas, ventas: an.ventas30 };
  }
  async function obtener(st){
    if(!st.ideas || Date.now() - st.t > VIGENCIA_MS){ st.ideas = await generarIdeas(); st.t = Date.now(); st.mostradas = []; }
    return st.ideas;
  }
  const POCAS = (r) => [P('Todavía tengo pocas ventas para darte ideas con números (**' + r.ventas + '** en los últimos 30 días). Con menos de ' + MIN_VENTAS + ' ventas cualquier cifra sería inventada.'), P('Registra **todas** tus ventas en PUVE durante 2 o 4 semanas y vuelve a preguntarme: con tus propios datos te digo qué empujar, qué precio subir y a qué hora te conviene hacer ofertas.'), C([sug('¿Cómo está mi negocio?'), sug('¿Qué datos me faltan?')])];
  const SEGUIR = (...x) => C(x.map(sug));
  const MEM = () => window.PuveIaAsesorMemoria && window.PuveIaAsesorMemoria.activo() ? window.PuveIaAsesorMemoria : null;
  const visibles = async (r) => { const m = MEM(); return m ? await m.filtrar(r.ideas) : r.ideas; };

  // ---------- temas ----------
  H.crecer = async (c) => {
    const st = memoria(c.estado), r = await obtener(st);
    if(r.pocos) return POCAS(r);
    const vis = await visibles(r), m = MEM(), enc = m ? await m.encabezado() : [];
    if(!vis.length) return enc.concat([P(r.ideas.length ? 'Ya probaste, aplicaste o descartaste todas las ideas que veo con tus números de hoy. Pregúntame «¿cómo van mis ideas?» para ver qué resultado dieron.' : 'Con tus números de hoy no veo una mejora que valga la pena empujar: tu negocio va parejo. Si quieres, te digo si ya es buen momento para abrir otra sucursal o te armo un plan.'), SEGUIR(r.ideas.length ? '¿Cómo van mis ideas?' : '¿Estoy listo para abrir otra sucursal?', 'Dame un plan para la semana')]);
    const top = vis.slice(0, c.mas ? 5 : 3);
    st.mostradas = top.map((x) => x.id); st.ultima = top[0];
    return enc.concat([P('Esto es lo que yo haría para que tu negocio crezca, en este orden. **Cada idea sale de tus propios números**, no de una receta general:'),
      S('', top.map((i) => [i.titulo, i.texto + textoImpacto(i)])),
      P('Mi consejo: empieza solo con la primera y mídela dos semanas antes de hacer otra. Si pruebas todo a la vez, no sabrás qué funcionó.'),
      SEGUIR('¿Cómo hago la primera?', 'Dame otra idea', '¿Por qué me recomiendas eso?', '¿Estoy listo para abrir otra sucursal?')]);
  };

  H.otra_idea = async (c) => {
    const st = memoria(c.estado), r = await obtener(st);
    if(r.pocos) return POCAS(r);
    const sig = (await visibles(r)).find((i) => st.mostradas.indexOf(i.id) < 0);
    if(!sig) return [P('Esas son todas las ideas que veo con tus números de hoy. Cuando tengas más ventas, cambies precios o surtas, vuelve a preguntarme y las recalculo.'), SEGUIR('Dame un plan para la semana', '¿Estoy listo para abrir otra sucursal?')];
    st.mostradas.push(sig.id); st.ultima = sig;
    return [P('Otra idea que sale de tus números:'), S('', [[sig.titulo, sig.texto + textoImpacto(sig)]]), SEGUIR('¿Cómo hago esa?', 'Dame otra idea', '¿Por qué me recomiendas eso?')];
  };

  H.como_hacerlo = async (c) => {
    const st = memoria(c.estado), i = st.ultima;
    if(!i) return [P('¿De cuál idea quieres los pasos? Primero te puedo dar ideas para crecer con tus números y luego te digo cómo hacer la que elijas.'), SEGUIR('¿Cómo puedo hacer crecer mi negocio?')];
    return [P('Así pondrías en marcha **' + i.titulo + '**:'), S('', i.pasos), i.medir ? P('**Cómo saber si funcionó:** ' + i.medir) : null, MEM() ? SEGUIR('Voy a probarla', 'Dame otra idea', '¿Por qué me recomiendas eso?') : SEGUIR('Dame otra idea', '¿Por qué me recomiendas eso?', 'Dame un plan para la semana')].filter(Boolean);
  };

  H.porque_idea = async (c) => {
    const st = memoria(c.estado), i = st.ultima;
    if(!i) return [P('Cuéntame de cuál idea hablas. Si quieres, te doy ideas para crecer y de cada una te enseño los números en que se apoya.'), SEGUIR('¿Cómo puedo hacer crecer mi negocio?')];
    const out = [P('Te recomiendo **' + i.titulo + '** por esto, que sale de tus ventas de los últimos 30 días:')];
    if(i.evidencia.length) out.push(L('Tus números', i.evidencia));
    if(i.impacto != null && i.cuenta) out.push(P('**La cuenta:** ' + i.cuenta + '.'), P('Ojo: es una **estimación**, no una promesa. Solo se cumple si ' + i.supuesto + '. Por eso conviene probarla poco tiempo y medir el resultado.'));
    else out.push(P('No le puse una cifra de dinero porque no hay datos suficientes para hacerlo sin inventar. Lo que sí sé es lo que muestran los números de arriba.'));
    out.push(SEGUIR('¿Cómo hago la primera?', 'Dame otra idea'));
    return out;
  };

  H.plan_semana = async (c) => {
    const st = memoria(c.estado), r = await obtener(st);
    if(r.pocos) return POCAS(r);
    const vis = await visibles(r);
    if(!vis.length) return [P(r.ideas.length ? 'Ya tienes todas las ideas que veo en marcha o descartadas. Tu plan: termina de medirlas y pregúntame «¿cómo van mis ideas?».' : 'Hoy no veo mejoras urgentes, así que tu plan es simple: sigue registrando todas tus ventas y revísame cada semana para detectar cambios a tiempo.')];
    const orden = { hoy: 0, semana: 1, mes: 2 }, rot = { hoy: 'Hoy', semana: 'Esta semana', mes: 'Este mes' };
    const plan = vis.slice(0, 5).sort((x, y) => orden[x.cuando] - orden[y.cuando]);
    st.ultima = plan[0]; plan.forEach((i) => { if(st.mostradas.indexOf(i.id) < 0) st.mostradas.push(i.id); });
    return [P('Este es tu plan, de lo urgente a lo que puede esperar. Cada paso sale de tus números:'),
      S('', plan.map((i) => [rot[i.cuando] + ': ' + i.primerPaso, i.titulo + (i.impacto != null ? '.' + textoImpacto(i) : '.')])),
      P('No lo hagas todo junto: termina lo de **hoy**, mide dos semanas lo de **esta semana** y deja lo de **este mes** para después. Así sabes qué funcionó.'),
      SEGUIR('¿Cómo hago la primera?', 'Dame otra idea', '¿Por qué me recomiendas eso?')];
  };

  // ---------- ¿ya puedo abrir otra sucursal? ----------
  const aFecha = (f) => new Date(f + 'T00:00:00');
  H.sucursal = async () => {
    const an = await D.analisis(), diario = await D.diario(120);
    if(!diario.length || an.ventas30 < MIN_VENTAS) return POCAS({ ventas: an.ventas30 });
    const hoyF = D.fechaLocal(new Date()), hoy = aFecha(hoyF), primera = aFecha(diario[0].fecha), historia = Math.round((hoy - primera) / 86400000) + 1;
    const semanas = []; for(let w = 7; w >= 0; w--){ const fin = new Date(hoy.getTime() - w * 7 * 86400000), ini = new Date(fin.getTime() - 6 * 86400000); semanas.push(suma(diario.filter((x) => { const f = aFecha(x.fecha); return f >= ini && f <= fin; }), (x) => x.total)); }
    const prev4 = semanas.slice(0, 4).reduce((s, x) => s + x, 0), rec4 = semanas.slice(4).reduce((s, x) => s + x, 0), tend = historia >= 56 && prev4 > 0 ? rec4 / prev4 : null;
    const media = semanas.reduce((s, x) => s + x, 0) / 8, cv = historia >= 56 && media > 0 ? Math.sqrt(semanas.reduce((s, x) => s + Math.pow(x - media, 2), 0) / 8) / media : null;
    const conCosto = an.lista.filter((x) => x.costo != null && x.ing30 > 0), ingCosto = suma(conCosto, (x) => x.ing30), cobertura = an.ing30 > 0 ? ingCosto / an.ing30 : 0, mg = suma(conCosto, (x) => x.margen30);
    const gastos = await D.traerGastos(new Date(Date.now() - 30 * 86400000), new Date()), gt = gastos ? suma(gastos, (x) => Number(x.monto)) : null;
    const conv = an.lista.filter((x) => x.ing30 > 0).sort((x, y) => y.ing30 - x.ing30), share = an.ing30 > 0 && conv.length >= 4 ? suma(conv.slice(0, 3), (x) => x.ing30) / an.ing30 : null;
    const margenOk = puedeCostos() && an.hayCostos && cobertura >= 0.6 ? mg / ingCosto : null, utilidad = margenOk != null && gt != null && gt > 0 ? mg - gt : null;
    const checks = [
      { ok: historia >= 90, t: 'Historial suficiente', d: 'Llevas ' + veces(historia, 'día', 'días') + ' registrando ventas' + (historia >= 90 ? '.' : '; conviene tener al menos 90 para que los números no sean casualidad.') },
      { ok: cv == null ? null : cv < 0.3, t: 'Ventas estables', d: cv == null ? 'Aún no tengo semanas completas para medirlo.' : 'Tus ventas semanales varían ' + pct(cv) + ' alrededor del promedio' + (cv < 0.3 ? ': es un negocio predecible.' : ': todavía suben y bajan mucho.') },
      { ok: tend == null ? null : tend >= 0.97, t: 'Ventas que no caen', d: tend == null ? 'Aún no tengo 8 semanas para compararlas.' : 'Las últimas 4 semanas vendieron ' + (tend >= 1 ? pct(tend - 1) + ' más' : pct(1 - tend) + ' menos') + ' que las 4 anteriores.' },
      { ok: margenOk == null ? null : margenOk >= 0.25, t: 'Margen sano', d: margenOk == null ? (puedeCostos() ? 'Faltan costos en tus productos para calcularlo.' : 'Solo el encargado ve los costos.') : 'De cada $100 que vendes te quedan unos $' + Math.round(margenOk * 100) + ' antes de gastos' + (margenOk >= 0.25 ? '.' : '; es poco para sostener dos locales.') },
      { ok: utilidad == null ? null : utilidad > 0, t: 'Sobra dinero después de gastos', d: utilidad == null ? 'Necesito costos y gastos anotados para calcularlo.' : (utilidad > 0 ? 'En 30 días te sobraron unos ' + $r(utilidad) + ' después de gastos anotados.' : 'En 30 días tus gastos anotados (' + $r(gt) + ') superan lo que ganaste con tus ventas (' + $r(mg) + ').') },
      { ok: share == null ? null : share < 0.7, t: 'No dependes de pocos productos', d: share == null ? 'Aún no hay suficientes productos vendidos para medirlo.' : 'Tus 3 productos más vendidos son el ' + pct(share) + ' de tus ventas' + (share < 0.7 ? '.' : ': una segunda sucursal repetiría ese riesgo.') }
    ];
    const verif = checks.filter((x) => x.ok !== null), fallas = verif.filter((x) => !x.ok), duro = (tend != null && tend < 0.95) || (utilidad != null && utilidad <= 0);
    const veredicto = duro ? { t: 'Todavía no.', x: 'Hoy una segunda sucursal te estiraría más de lo que tu negocio actual puede sostener. Primero arregla lo marcado con ✖.' }
      : (!fallas.length && verif.length >= 4 ? { t: 'Pinta bien, con cuidado.', x: 'Las señales que puedo medir son buenas. Eso no basta: faltan cosas que yo no veo (abajo).' } : { t: 'Casi.', x: 'Vas por buen camino, pero aún hay señales por mejorar o que no puedo medir con tus datos.' });
    return [P('**' + veredicto.t + '** ' + veredicto.x),
      L('Revisé 6 señales de tu propio historial', checks.map((x) => [(x.ok === true ? '✔ ' : (x.ok === false ? '✖ ' : '? ')) + x.t, null, x.d])),
      P('**Lo que yo NO puedo ver:** la renta y la ubicación del local nuevo, quién lo atendería, cuánto dinero tienes ahorrado ni tus deudas. Una regla práctica es juntar, antes de abrir, al menos 3 meses de los gastos de la nueva sucursal. Es una guía general, no es asesoría financiera.'),
      S('Antes de abrir otro local, puedes crecer con menos riesgo', [['Alarga tu horario', 'Si tienes horas fuertes que hoy cierras, prueba abrir más en esas.'], ['Vende por pedido o a domicilio', 'Llega a más gente con el mismo local (en PUVE, el menú o catálogo por QR y WhatsApp).'], ['Prueba un puesto temporal', 'Un día de evento o un módulo te dice si hay demanda en otra zona sin firmar un contrato.']]),
      SEGUIR('¿Cómo puedo hacer crecer mi negocio?', 'Dame un plan para la semana')];
  };

  // ---------- se engancha al chat ----------
  const NUEVOS = ['crecer', 'sucursal', 'plan_semana', 'como_hacerlo', 'porque_idea', 'otra_idea'];
  NUEVOS.forEach((t) => N.SOLO_ENCARGADO.add(t));
  R.registrarTemas(H, { crecer: 'Ideas para crecer', sucursal: '¿Abrir otra sucursal?', plan_semana: 'Plan de la semana', como_hacerlo: '¿Cómo lo hago?', porque_idea: '¿Por qué me lo recomiendas?', otra_idea: 'Otra idea' },
    { crecer: 'Buscando oportunidades en tus números…', otra_idea: 'Buscando otra oportunidad…', sucursal: 'Revisando 6 señales de tu historial…', plan_semana: 'Armando tu plan…', como_hacerlo: 'Armando los pasos…', porque_idea: 'Juntando los números detrás de la idea…' });

  // «¿por qué?» y «¿cómo lo hago?» significan otra cosa cuando se estaba hablando de una idea
  R.agregarRedireccion((intent, ctx) => {
    const st = ctx.estado && ctx.estado.asesor; if(!st || !st.ultima) return null;
    const t = N.norm(ctx.texto || '');
    if(intent === 'por_que' && !/(venta|bajar|bajaron|baja\b|subir|subieron|sube\b|cayer|ganancia|gasto|inventario|cliente|ticket)/.test(t)) return 'porque_idea';
    if((intent === 'ayuda_app' || intent === 'que_hago' || intent === 'subir_ventas') && /\bcomo (lo|la|le|eso|esa|empiezo con|pongo|arranco|hago eso|hago esa)\b/.test(t)) return 'como_hacerlo';
    return null;
  });

  window.PuveIaAsesor = { generarIdeas, obtenerIdeas: async (estado) => (await obtener(memoria(estado))), memoria, internos: { textoImpacto, memoriaDe: memoria } };
})();
