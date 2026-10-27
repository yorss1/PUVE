import { limpiarUsername } from '../persistence/cuenta-supabase.js';
// Formularios de la cuenta real (se dibujan dentro del panel "Cuenta y progreso"). Sin dependencias; todo con createElement.
const ESTILO = 'width:100%;padding:10px;margin:6px 0;font:inherit;box-sizing:border-box';
let modoAcceso = 'entrar';   // 'entrar' | 'crear'
const campo = (ph, tipo, auto) => { const i = document.createElement('input'); i.type = tipo; i.placeholder = ph; i.autocomplete = auto; i.style.cssText = ESTILO; return i; };
// El usuario solo admite minúsculas, números, punto y guion bajo: lo demás ni se puede escribir.
function campoUsuario(cuenta, estado) {
  const i = campo('Nombre de usuario (a-z, 0-9, . _)', 'text', 'off'); i.maxLength = 20; i.inputMode = 'text'; i.autocapitalize = 'none'; i.spellcheck = false;
  let t = 0, n = 0;
  i.oninput = () => {
    const v = limpiarUsername(i.value); if (v !== i.value) i.value = v;
    clearTimeout(t); estado.textContent = ''; estado.style.color = ''; if (v.length < 3) return;
    const mio = ++n; t = setTimeout(async () => { const r = await cuenta.disponible(v); if (mio !== n) return; estado.textContent = r.ok ? '✓ Disponible' : r.msg; estado.style.color = r.ok ? '#6fd36f' : '#ff8a80'; }, 400);
  };
  return i;
}
export function formAcceso(cuenta, { txt, btn, refrescar, enMarco }) {
  const msg = txt(''), nodos = [], correo = campo('Correo', 'email', 'email'), clave = campo('Contraseña (mínimo 8)', 'password', modoAcceso === 'crear' ? 'new-password' : 'current-password');
  const estadoUser = txt(''), usuario = modoAcceso === 'crear' ? campoUsuario(cuenta, estadoUser) : null;
  nodos.push(txt(modoAcceso === 'crear' ? 'Crea tu cuenta para guardar tu progreso en cualquier dispositivo y jugar con amigos.' : 'Entra para recuperar tu progreso en cualquier dispositivo y jugar con amigos.'));
  if (enMarco) nodos.push(txt('Para entrar con Google abre el juego en una pestaña nueva.'), (() => { const a = document.createElement('a'); a.href = location.pathname; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'Abrir el juego en una pestaña nueva'; a.style.cssText = 'display:block;margin:6px 0;color:inherit'; return a; })());
  else nodos.push(btn('Continuar con Google', async () => { msg.textContent = 'Abriendo Google…'; const r = await cuenta.google(); if (!r.ok) msg.textContent = r.msg; }));
  nodos.push(txt('— o con tu correo —'), correo);
  if (usuario) nodos.push(usuario, estadoUser);
  nodos.push(clave);
  nodos.push(btn(modoAcceso === 'crear' ? 'Crear cuenta' : 'Entrar', async () => {
    msg.textContent = 'Un momento…'; msg.style.color = '';
    const r = modoAcceso === 'crear' ? await cuenta.registrar({ email: correo.value, password: clave.value, username: usuario.value }) : await cuenta.entrar({ email: correo.value, password: clave.value });
    if (!r.ok) { msg.textContent = r.msg; msg.style.color = '#ff8a80'; return; }
    if (r.confirmar) { msg.textContent = r.msg; return; }
    refrescar();
  }));
  nodos.push(btn(modoAcceso === 'crear' ? 'Ya tengo cuenta' : 'No tengo cuenta: crear una', () => { modoAcceso = modoAcceso === 'crear' ? 'entrar' : 'crear'; refrescar(); }), msg);
  return nodos;
}
// Cuenta de Google (o confirmada por correo) que todavía no tiene usuario: debe elegir uno único.
export function formUsuario(cuenta, { txt, btn, refrescar }) {
  const msg = txt(''), estado = txt(''), i = campoUsuario(cuenta, estado);
  return [txt('Elige tu nombre de usuario. Será único y público en el juego: solo letras minúsculas, números, punto o guion bajo.'), i, estado,
    btn('Guardar usuario', async () => { const r = await cuenta.elegirUsername(i.value); if (!r.ok) { msg.textContent = r.msg; msg.style.color = '#ff8a80'; return; } refrescar(); }), msg];
}
