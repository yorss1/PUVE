import { verificar, limpiarPartida } from './contrato.js';
import { clienteSB } from './sb.js';
// Cuenta REAL de jugador (Supabase Auth): correo y contraseña o Google. El usuario es único y solo admite a-z, 0-9, punto y guion bajo.
export const USERNAME_RE = /^[a-z0-9][a-z0-9._]{1,18}[a-z0-9]$/;
export const limpiarUsername = v => String(v ?? '').toLowerCase().replace(/[^a-z0-9._]/g, '').slice(0, 20);
export function validarUsername(u) {
  if (!u) return 'Escribe un nombre de usuario';
  if (u.length < 3) return 'Usa al menos 3 caracteres';
  if (!USERNAME_RE.test(u) || /[._]{2}/.test(u)) return 'Solo letras minúsculas, números, punto o guion bajo; no puede empezar ni terminar en punto o guion bajo ni repetirlos';
  return null;
}
const MOTIVOS = { en_uso: 'Ese usuario ya existe. Elige otro.', reservado: 'Ese usuario no está permitido. Elige otro.', formato: 'Solo letras minúsculas, números, punto o guion bajo (3 a 20 caracteres).' };
const ERR = { USERNAME_EN_USO: MOTIVOS.en_uso, USERNAME_RESERVADO: MOTIVOS.reservado, USERNAME_FORMATO: MOTIVOS.formato, YA_TIENE_USUARIO: 'Esta cuenta ya tiene usuario', SIN_SESION: 'Inicia sesión primero', SIN_USUARIO: 'Elige primero tu nombre de usuario', CONFLICTO_DE_VERSION: 'Tu cuenta tiene un guardado más nuevo hecho desde otro dispositivo', SALA_AJENA: 'Esa sala es de otro jugador', DEMASIADAS_SALAS: 'Ya tienes 5 salas guardadas: cierra alguna' };
export function mensajeError(e) {
  const m = String(e?.message || e || '');
  for (const k in ERR) if (m.includes(k)) return ERR[k];
  if (/Invalid login credentials/i.test(m)) return 'Correo o contraseña incorrectos';
  if (/already registered|already been registered/i.test(m)) return 'Ese correo ya tiene cuenta. Entra con él.';
  if (/Email not confirmed/i.test(m)) return 'Confirma tu correo (revisa tu bandeja) y vuelve a entrar';
  if (/Password should|weak password/i.test(m)) return 'La contraseña es muy débil (mínimo 8 caracteres)';
  if (/rate limit|too many/i.test(m)) return 'Demasiados intentos. Espera un momento.';
  if (/Database error saving new user/i.test(m)) return 'No se pudo crear la cuenta. Intenta de nuevo.';
  return 'No se pudo completar. Revisa tu conexión e inténtalo de nuevo.';
}
export function crearCuentaSupabase() {
  let sb = null, ses = null, perfil = null, listo = false, prom = null, conflicto = false;
  const oyentes = new Set(), ver = {}, pend = {}, ult = {}, timers = {};
  const avisar = () => oyentes.forEach(f => { try { f(); } catch (e) { console.warn(e); } });
  async function leerPerfil() {
    if (!ses) { perfil = null; return; }
    const { data } = await sb.rpc('juego_mi_perfil'); perfil = data || null;
    if (!perfil) {   // cuenta de correo recién confirmada: el usuario viene en los datos del registro
      const u = ses.user?.user_metadata?.username;
      if (typeof u === 'string' && !validarUsername(u)) { const r = await sb.rpc('juego_elegir_username', { p_username: u }); if (!r.error) perfil = { username: r.data || u }; }
    }
  }
  const salvaPartida = async (giro, s) => {
    const { data, error } = await sb.rpc('juego_guardar_partida', { p_giro: giro, p_datos: s, p_version_esperada: ver[giro] ?? null });
    if (error) { if (/CONFLICTO_DE_VERSION/.test(error.message)) conflicto = true; throw new Error(error.message); }
    ver[giro] = data; conflicto = false;
  };
  return verificar({
    nombre: 'cuenta-supabase', real: true,
    onCambio(f) { oyentes.add(f); return () => oyentes.delete(f); },
    iniciar() {
      return prom || (prom = (async () => {
        sb = await clienteSB(); const { data } = await sb.auth.getSession(); ses = data.session; await leerPerfil(); listo = true;
        sb.auth.onAuthStateChange((ev, s) => { ses = s; setTimeout(async () => { try { await leerPerfil(); } catch (e) { console.warn(e); } avisar(); }, 0); });
        avisar();
      })());
    },
    cliente: () => sb, listo: () => listo, sesion: () => !!ses, email: () => ses?.user?.email || '', uid: () => ses?.user?.id || null,
    usuario: () => perfil?.username || null, pendienteUsername: () => !!ses && !perfil, conflicto: () => conflicto,
    cid: () => (ses ? 'u' + ses.user.id.replace(/-/g, '').slice(0, 14) : null),   // id público estable dentro de las salas
    async disponible(u) {
      const e = validarUsername(u); if (e) return { ok: false, motivo: 'formato', msg: e };
      const { data, error } = await sb.rpc('juego_username_disponible', { p_username: u });
      if (error) return { ok: false, motivo: 'error', msg: mensajeError(error) };
      return data?.ok ? { ok: true } : { ok: false, motivo: data?.motivo, msg: MOTIVOS[data?.motivo] || MOTIVOS.formato };
    },
    async registrar({ email, password, username }) {
      const e = validarUsername(username); if (e) return { ok: false, msg: e };
      if (String(password || '').length < 8) return { ok: false, msg: 'La contraseña debe tener al menos 8 caracteres' };
      const d = await this.disponible(username); if (!d.ok) return { ok: false, msg: d.msg };
      const { data, error } = await sb.auth.signUp({ email: String(email).trim(), password, options: { data: { tipo_cuenta: 'jugador', username }, emailRedirectTo: location.origin + location.pathname } });
      if (error) return { ok: false, msg: mensajeError(error) };
      if (data.session) { ses = data.session; await leerPerfil(); avisar(); return { ok: true }; }
      return { ok: true, confirmar: true, msg: 'Te enviamos un correo para confirmar tu cuenta. Confírmalo y entra con tu correo y contraseña.' };
    },
    async entrar({ email, password }) {
      const { data, error } = await sb.auth.signInWithPassword({ email: String(email).trim(), password });
      if (error) return { ok: false, msg: mensajeError(error) };
      ses = data.session; await leerPerfil(); avisar(); return { ok: true };
    },
    async google() {
      const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname + location.search } });
      return error ? { ok: false, msg: mensajeError(error) } : { ok: true };
    },
    async elegirUsername(u) {
      const e = validarUsername(u); if (e) return { ok: false, msg: e };
      const { data, error } = await sb.rpc('juego_elegir_username', { p_username: u });
      if (error) return { ok: false, msg: mensajeError(error) };
      perfil = { username: data || u }; avisar(); return { ok: true };
    },
    async salir() { await sb.auth.signOut(); ses = null; perfil = null; conflicto = false; for (const k in ver) delete ver[k]; avisar(); },
    async obtenerPerfil() { return {}; }, async guardarPerfil() {}, async registrarEvento() {},
    async cargarPartida(giro) {
      const { data, error } = await sb.rpc('juego_cargar_partida', { p_giro: giro }); if (error) throw new Error(error.message);
      if (data?.version != null) ver[giro] = data.version; return limpiarPartida(data?.datos);
    },
    async guardarPartida(giro, s) { await salvaPartida(giro, s); },
    // Autoguardado: como mucho una vez cada 15 s (lo último siempre se guarda); la partida local se guarda aparte, a cada momento.
    autoguardar(giro, s) {
      pend[giro] = s; const falta = 15000 - (Date.now() - (ult[giro] || 0));
      const ir = () => { timers[giro] = 0; ult[giro] = Date.now(); const x = pend[giro]; salvaPartida(giro, x).catch(e => console.warn('Autoguardado en la cuenta', e.message)); };
      if (falta <= 0) ir(); else if (!timers[giro]) timers[giro] = setTimeout(ir, falta);
    },
    async borrarPartida(giro) { await sb.rpc('juego_borrar_partida', { p_giro: giro }); delete ver[giro]; },
    async respaldar(giro, s) { try { const k = 'puvegame:resp:' + this.uid(), a = JSON.parse(localStorage.getItem(k) || '[]'); a.push({ giro, ts: Date.now(), s }); localStorage.setItem(k, JSON.stringify(a.slice(-5))); } catch (e) { console.warn('Respaldo local', e); } }
  });
}
