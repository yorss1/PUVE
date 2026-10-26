// Migra la partida local a una cuenta. Nunca sobrescribe en silencio y nunca borra la copia local.
import { limpiarPartida } from './contrato.js';
const igual = (a, b) => JSON.stringify([a.d, a.px, a.py]) === JSON.stringify([b.d, b.px, b.py]);
// resolver(local, cuenta) debe preguntar al usuario y devolver 'local' | 'cuenta' | 'cancelar'
export async function migrarLocalACuenta({ local, cuenta, giro, resolver }) {
  const l = await local.cargarPartida(giro);                                   // 1. validar estado local
  if (!l) return { ok: false, msg: 'No hay partida local válida para migrar' };
  const c = await cuenta.cargarPartida(giro);                                  // 4. ¿la cuenta ya tiene partida?
  let accion = 'transferida';
  if (c) {
    const r = await resolver(l, c);                                            // 5. conflicto: decide el usuario
    if (r === 'cancelar') return { ok: false, msg: 'Migración cancelada; no se cambió nada' };
    if (r === 'cuenta') return { ok: true, accion: 'conservada_cuenta', puedeBorrarLocal: false, msg: 'Se conservó la partida de la cuenta' };
    if (r !== 'local') return { ok: false, msg: 'Respuesta inválida' };
    if (cuenta.respaldar) await cuenta.respaldar(giro, c);                     // la que se reemplaza queda respaldada
    accion = 'reemplazada_con_respaldo';
  }
  await cuenta.guardarPartida(giro, l);                                        // 6. solo campos permitidos
  const v = await cuenta.cargarPartida(giro);                                  // 7. verificar
  if (!v || !igual(v, limpiarPartida(l))) return { ok: false, msg: 'La verificación falló; la copia local sigue intacta' };
  return { ok: true, accion, puedeBorrarLocal: true, msg: 'Progreso guardado en tu cuenta' };   // 8. borrar local solo con confirmación aparte
}
