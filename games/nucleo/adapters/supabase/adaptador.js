// Adaptador de Supabase: DESACTIVADO. No contiene URL ni claves y no se importa desde el juego.
// Para activarlo, el propietario debe autorizar las migraciones, inyectar un cliente con la clave pública y confirmar los nombres de tabla.
import { verificar } from '../../persistence/contrato.js';
export function crearAdaptadorSupabase({ cliente, tablas, habilitado = false } = {}) {
  const off = () => { throw new Error('Integración con Supabase desactivada'); };
  if (!habilitado) return verificar({ nombre: 'supabase-desactivado', obtenerPerfil: off, guardarPerfil: off, cargarPartida: off, guardarPartida: off, borrarPartida: off, registrarEvento: off });
  if (!cliente || !tablas?.perfiles || !tablas?.partidas || !tablas?.eventos) throw new Error('Faltan cliente o nombres de tabla (contrato por verificar con el propietario)');
  const u = async () => { const { data, error } = await cliente.auth.getUser(); if (error || !data?.user) throw new Error('Sin sesión'); return data.user.id; };
  return verificar({
    nombre: 'supabase',
    async obtenerPerfil() { const { data, error } = await cliente.from(tablas.perfiles).select('*').eq('user_id', await u()).maybeSingle(); if (error) throw error; return data || {}; },
    async guardarPerfil(p) { const { error } = await cliente.from(tablas.perfiles).upsert({ ...p, user_id: await u() }); if (error) throw error; },
    async cargarPartida(giro) { const { data, error } = await cliente.from(tablas.partidas).select('datos').eq('user_id', await u()).eq('giro', giro).maybeSingle(); if (error) throw error; return data?.datos ?? null; },
    // La escritura real debe hacerse con la función transaccional de la migración (control de versión optimista), no con upsert directo.
    async guardarPartida(giro, s) { const { error } = await cliente.rpc(tablas.rpcGuardar, { p_giro: giro, p_datos: s, p_version_esperada: s.ts }); if (error) throw error; },
    async borrarPartida(giro) { const { error } = await cliente.from(tablas.partidas).delete().eq('user_id', await u()).eq('giro', giro); if (error) throw error; },
    async registrarEvento(giro, ev) { const { error } = await cliente.from(tablas.eventos).insert({ ...ev, giro, user_id: await u() }); if (error) throw error; }
  });
}
