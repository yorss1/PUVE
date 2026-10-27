// PUVE — Validación estricta de archivos de impresión (PDF / JPG / PNG). Módulo puro: lo usa la Edge Function y las pruebas de Node.
// Política: lista blanca. Ante la duda se RECHAZA. No es un antivirus: reduce la superficie de ataque (formatos, contenido activo,
// bombas de descompresión, políglotas) y nada de lo subido se ejecuta ni se muestra en el origen de PUVE.
export const MAX_BYTES = 25 * 1024 * 1024;   // por archivo (la validación necesita el archivo completo en memoria dentro de la Edge Function)
const MAX_LADO = 12000, MAX_PIXELES = 100e6, MAX_INFLADO = 48 * 1024 * 1024, MAX_PAGINAS = 2000;

const lat1 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return s; };
const rechazo = (motivo) => ({ ok: false, motivo });

// Nombres PDF con escapes #xx (ej. /#4aavaScript) -> se normalizan antes de buscar
const desescapar = (t) => t.replace(/#([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
// Tokens que ejecutan código, lanzan programas, abren adjuntos o activan decodificadores históricamente explotados
const LARGOS = /\/(javascript|launch|embeddedfile|embeddedfiles|richmedia|xfa|submitform|importdata|gotor|gotoe|rendition|jbig2decode|jpxdecode|asciihexdecode|ascii85decode|lzwdecode|runlengthdecode|crypt)(?![A-Za-z0-9])/i;
const CORTOS = /\/(js|aa)(?![A-Za-z0-9])/i;   // solo se buscan fuera de los streams binarios (en binario saltan por azar)


// /OpenAction es normal (los PDF oficiales la usan para abrir en la página 1 con cierto zoom). Lo peligroso es QUÉ acción ejecuta:
// JavaScript, Launch, GoToR, SubmitForm... ya se rechazan en cualquier parte del archivo. Aquí solo se acepta un destino (array),
// una referencia a otro objeto (cuyo contenido se revisa igual) o una acción GoTo; cualquier otro tipo de acción en línea se rechaza.
function revisarAcciones(t){
  const m = t.match(LARGOS); if(m) return 'tiene elementos no permitidos (' + m[1] + ')';
  const re = /\/OpenAction/gi; let x;
  while((x = re.exec(t)) !== null){
    const s = t.slice(x.index + 11, x.index + 11 + 400);
    if(/^\s*\[/.test(s) || /^\s*\d+\s+\d+\s+R(?![A-Za-z])/.test(s)) continue;
    if(/^\s*<</.test(s)){ const tipos = (s.match(/\/S\s*\/([A-Za-z0-9]+)/g) || []).map((v) => v.replace(/\/S\s*\//, '')); if(tipos.length && tipos.every((v) => v === 'GoTo')) continue; }
    return 'tiene una acción automática al abrirse (OpenAction)';
  }
  return null;
}

async function inflar(bytes, presupuesto){
  const ds = new DecompressionStream('deflate'), w = ds.writable.getWriter(), r = ds.readable.getReader();
  w.write(bytes).catch(() => {}); w.close().catch(() => {});
  const partes = []; let total = 0, error = false;
  try { for(;;){ const { value, done } = await r.read(); if(done) break; total += value.length; if(total > presupuesto){ try { await r.cancel(); } catch(_){} return { exceso: true }; } partes.push(value); } }
  catch(_) { error = true; }   // datos basura al final del stream: igual se revisa lo que sí se pudo descomprimir (un visor tolerante también lo leería)
  if(!total) return { error: true };
  const out = new Uint8Array(total); let o = 0; for(const p of partes){ out.set(p, o); o += p.length; }
  return { datos: out, total, parcial: error };
}

async function validarPdf(u8){
  if(!(u8[0] === 0x25 && u8[1] === 0x50 && u8[2] === 0x44 && u8[3] === 0x46 && u8[4] === 0x2d)) return rechazo('El PDF no es válido.');
  const crudo = lat1(u8), texto = desescapar(crudo);
  const m = revisarAcciones(texto);
  if(m) return rechazo('El PDF ' + m + '. Expórtalo de nuevo con "Imprimir → Guardar como PDF".');
  // Cifrado: los PDF oficiales suelen traer clave de propietario vacía (solo restringen copiar/editar) y se imprimen normal. Si NO usan
  // object streams se puede revisar igual (los nombres de las acciones nunca se cifran); con object streams el contenido queda oculto -> se rechaza.
  if(/\/Encrypt(?![A-Za-z0-9])/i.test(texto) && /\/ObjStm(?![A-Za-z0-9])/i.test(texto)) return rechazo('El PDF está protegido de una forma que no se puede revisar. Ábrelo y expórtalo con "Imprimir → Guardar como PDF".');
  if(/\/Filter\s*\[[^\]]*FlateDecode[^\]]*FlateDecode/i.test(texto)) return rechazo('El PDF usa compresión no permitida.');
  // Parte "legible" (sin los cuerpos binarios de los streams) para los tokens cortos y el conteo de páginas
  const esqueleto = texto.replace(/stream\r?\n[\s\S]*?endstream/g, 'stream endstream');
  if(CORTOS.test(esqueleto)) return rechazo('El PDF contiene acciones automáticas no permitidas.');
  let paginas = (esqueleto.match(/\/Type\s*\/Page(?![A-Za-z])/g) || []).length;
  // Se inflan TODOS los streams comprimidos (ahí pueden esconderse objetos) y se vuelve a buscar
  let presupuesto = MAX_INFLADO, intentos = 0, inicio = 0;
  const reStream = /stream\r?\n/g; reStream.lastIndex = 0; let ms;
  while((ms = reStream.exec(crudo)) !== null){
    if(++intentos > 20000) return rechazo('El PDF es demasiado complejo.');
    inicio = ms.index + ms[0].length; if(crudo.charCodeAt(inicio) !== 0x78) continue;   // zlib empieza con 0x78
    const fin = crudo.indexOf('endstream', inicio); if(fin < 0) continue;
    let fin2 = fin; while(fin2 > inicio && (u8[fin2 - 1] === 0x0a || u8[fin2 - 1] === 0x0d)) fin2--;
    const res = await inflar(u8.subarray(inicio, fin2), presupuesto);
    if(res.exceso) return rechazo('El PDF es demasiado complejo (posible bomba de descompresión).');
    if(!res.datos) continue;
    presupuesto -= res.total;
    const t = desescapar(lat1(res.datos));
    const mm = revisarAcciones(t); if(mm) return rechazo('El PDF ' + mm.replace('tiene', 'tiene (oculto)') + '.');
    if(/\/Type\s*\/ObjStm/.test(crudo.slice(Math.max(0, ms.index - 400), ms.index))){ if(CORTOS.test(t)) return rechazo('El PDF contiene acciones ocultas no permitidas.'); paginas += (t.match(/\/Type\s*\/Page(?![A-Za-z])/g) || []).length; }
  }
  return { ok: true, tipo: 'pdf', ext: 'pdf', mime: 'application/pdf', paginas: paginas > 0 ? Math.min(paginas, MAX_PAGINAS) : null };
}

function validarPng(u8){
  const firma = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]; if(u8.length < 33 || firma.some((b, i) => u8[i] !== b)) return rechazo('La imagen PNG no es válida.');
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength); let p = 8, primero = true, ancho = 0, alto = 0, fin = false;
  while(p + 12 <= u8.length){
    const len = dv.getUint32(p), tipo = String.fromCharCode(u8[p + 4], u8[p + 5], u8[p + 6], u8[p + 7]);
    if(!/^[A-Za-z]{4}$/.test(tipo) || p + 12 + len > u8.length) return rechazo('La imagen PNG está dañada.');
    if(primero){ if(tipo !== 'IHDR' || len !== 13) return rechazo('La imagen PNG está dañada.'); ancho = dv.getUint32(p + 8); alto = dv.getUint32(p + 12); primero = false; }
    p += 12 + len; if(tipo === 'IEND'){ fin = true; break; }
  }
  if(!fin || p !== u8.length) return rechazo('La imagen tiene datos extra o está dañada.');
  if(!ancho || !alto || ancho > MAX_LADO || alto > MAX_LADO || ancho * alto > MAX_PIXELES) return rechazo('La imagen es demasiado grande en píxeles.');
  return { ok: true, tipo: 'png', ext: 'png', mime: 'image/png', paginas: 1 };
}

function validarJpg(u8){
  if(u8.length < 4 || u8[0] !== 0xff || u8[1] !== 0xd8 || u8[2] !== 0xff) return rechazo('La imagen JPG no es válida.');
  let p = 2, ancho = 0, alto = 0, finSos = false;
  while(p + 4 <= u8.length && !finSos){
    if(u8[p] !== 0xff) return rechazo('La imagen JPG está dañada.');
    let mk = u8[p + 1]; while(mk === 0xff){ p++; mk = u8[p + 1]; }
    if(mk === 0xd9) break; if(mk === 0x01 || (mk >= 0xd0 && mk <= 0xd8)){ p += 2; continue; }
    const len = (u8[p + 2] << 8) | u8[p + 3]; if(len < 2 || p + 2 + len > u8.length) return rechazo('La imagen JPG está dañada.');
    if((mk >= 0xc0 && mk <= 0xcf) && mk !== 0xc4 && mk !== 0xc8 && mk !== 0xcc){ alto = (u8[p + 5] << 8) | u8[p + 6]; ancho = (u8[p + 7] << 8) | u8[p + 8]; }
    if(mk === 0xda){ finSos = true; p += 2 + len; break; }
    p += 2 + len;
  }
  if(!finSos) return rechazo('La imagen JPG está dañada.');
  // datos entropía hasta el EOI (FFD9) sin nada después
  let q = p; for(; q + 1 < u8.length; q++){ if(u8[q] === 0xff && u8[q + 1] !== 0x00 && !(u8[q + 1] >= 0xd0 && u8[q + 1] <= 0xd7) && u8[q + 1] !== 0xff){ break; } }
  if(!(u8[q] === 0xff && u8[q + 1] === 0xd9) || q + 2 !== u8.length) return rechazo('La imagen tiene datos extra o está dañada.');
  if(!ancho || !alto || ancho > MAX_LADO || alto > MAX_LADO || ancho * alto > MAX_PIXELES) return rechazo('La imagen es demasiado grande en píxeles.');
  return { ok: true, tipo: 'jpg', ext: 'jpg', mime: 'image/jpeg', paginas: 1 };
}

// Políglotas: imagen que además trae HTML/script/PDF incrustado
const POLIGLOTA = /<\s*(script|html|svg|iframe|\?php)|%PDF-|javascript:/i;

export async function validarArchivo(u8){
  if(!(u8 instanceof Uint8Array) || u8.length < 16) return rechazo('El archivo está vacío.');
  if(u8.length > MAX_BYTES) return rechazo('El archivo pesa más de ' + (MAX_BYTES / 1048576) + ' MB.');
  let r;
  if(u8[0] === 0x25) r = await validarPdf(u8);
  else if(u8[0] === 0x89) r = validarPng(u8);
  else if(u8[0] === 0xff) r = validarJpg(u8);
  else return rechazo('Solo se aceptan archivos PDF, JPG o PNG. Si es Word o PowerPoint, expórtalo a PDF.');
  if(r.ok && r.tipo !== 'pdf' && POLIGLOTA.test(lat1(u8))) return rechazo('La imagen contiene contenido oculto no permitido.');
  return r;
}

// Cuántas páginas se imprimen según un rango tipo "1-3, 5, 8-10". total = páginas del archivo (o null si no se sabe).
export function contarRango(texto, total){
  const t = String(texto || '').trim(); if(!t) return total || null;
  if(!/^[0-9,\s-]{1,40}$/.test(t)) return null;
  const set = new Set();
  for(const parte of t.split(',')){
    const m = parte.trim().match(/^(\d{1,4})(?:\s*-\s*(\d{1,4}))?$/); if(!m) return null;
    let a = +m[1], b = m[2] ? +m[2] : a; if(a < 1 || b < a || b - a > MAX_PAGINAS) return null;
    for(let i = a; i <= b && set.size <= MAX_PAGINAS; i++) if(!total || i <= total) set.add(i);
  }
  return set.size || null;
}
export function nombreSeguro(n){ return String(n || 'archivo').normalize('NFC').replace(/[^\p{L}\p{N} ._()-]/gu, '').replace(/\.{2,}/g, '.').replace(/^[. ]+/, '').trim().slice(0, 80) || 'archivo'; }
