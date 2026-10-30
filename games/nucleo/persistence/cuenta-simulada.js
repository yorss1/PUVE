// Cuenta SIMULADA (solo este navegador, sin contraseña): permite probar registro, nombre único y migración sin tocar ninguna base real.
import { verificar, limpiarPartida } from './contrato.js';
const K = 'puvegame:sim:cuentas', RESERVADOS = ['admin', 'puve', 'soporte', 'moderador', 'sistema'];
export const validarNombre = n => (/^[A-Za-z0-9_]{3,16}$/.test(n) && !RESERVADOS.includes(n.toLowerCase())) ? null : 'Usa 3 a 16 letras, números o _ (nombre no permitido)';
export function crearCuentaSimulada(st = localStorage) {
  const db = () => { try { return JSON.parse(st.getItem(K)) || { usuarios: {}, sesion: null }; } catch (e) { console.warn('Cuentas ilegibles', e); return { usuarios: {}, sesion: null }; } };
  const gd = d => st.setItem(K, JSON.stringify(d));
  const yo = () => { const d = db(), u = d.sesion && d.usuarios[d.sesion]; if (!u) throw new Error('Sin sesión'); return [d, u]; };
  return verificar({
    nombre: 'cuenta-simulada',
    usuario() { const d = db(); return d.sesion ? d.usuarios[d.sesion].nombre : null; },
    registrar(nombre) { const e = validarNombre(nombre); if (e) return { ok: false, msg: e }; const d = db(), k = nombre.toLowerCase(); if (d.usuarios[k]) return { ok: false, msg: 'Ese nombre ya existe' }; d.usuarios[k] = { nombre, perfil: {}, partidas: {}, respaldos: [] }; d.sesion = k; gd(d); return { ok: true }; },
    entrar(nombre) { const d = db(), k = String(nombre).toLowerCase(); if (!d.usuarios[k]) return { ok: false, msg: 'Cuenta no encontrada' }; d.sesion = k; gd(d); return { ok: true }; },
    salir() { const d = db(); d.sesion = null; gd(d); },
    async obtenerPerfil() { return yo()[1].perfil; },
    async guardarPerfil(p) { const [d, u] = yo(); u.perfil = p; gd(d); },
    async cargarPartida(giro) { return limpiarPartida(yo()[1].partidas[giro]); },
    async guardarPartida(giro, s) { const [d, u] = yo(); u.partidas[giro] = limpiarPartida(s); gd(d); },
    async borrarPartida(giro) { const [d, u] = yo(); delete u.partidas[giro]; gd(d); },
    async registrarEvento() {},
    async respaldar(giro, s) { const [d, u] = yo(); u.respaldos.push({ giro, ts: Date.now(), s }); u.respaldos = u.respaldos.slice(-5); gd(d); },
    respaldos() { return yo()[1].respaldos; }
  });
}
