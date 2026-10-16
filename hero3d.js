// PUVE — Escena 3D del encabezado (estilo "clay": formas suaves, colores pastel). three.js r160 desde CDN con versión fija.
// Si WebGL no está disponible o algo falla, la página sigue mostrando la ilustración estática (clase .sin-webgl).
export function construirEscena(THREE, RoundedBoxGeometry, RoomEnvironment, host, canvas, opciones) {
  const o = opciones || {};
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(o.dpr || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
  const mira = new THREE.Vector3(0.3, 2.3, 0);

  // ---- luces
  const hemi = new THREE.HemisphereLight(0xfff0f5, 0xc9a6e8, 0.7); scene.add(hemi);
  const sol = new THREE.DirectionalLight(0xffffff, 2.4); sol.position.set(5, 9, 8); sol.castShadow = true;
  sol.shadow.mapSize.set(1024, 1024); sol.shadow.camera.left = -9; sol.shadow.camera.right = 9; sol.shadow.camera.top = 9; sol.shadow.camera.bottom = -4;
  sol.shadow.camera.near = 1; sol.shadow.camera.far = 30; sol.shadow.bias = -0.0004; sol.shadow.radius = 6; scene.add(sol);
  const relleno = new THREE.PointLight(0xff9ec4, 18, 30, 2); relleno.position.set(-6, 3, 6); scene.add(relleno);

  const raiz = new THREE.Group(); scene.add(raiz);
  const flotantes = [];
  const mat = (color, rough, metal) => new THREE.MeshStandardMaterial({ color, roughness: rough == null ? 0.55 : rough, metalness: metal || 0 });
  const poner = (mesh, x, y, z, padre) => { mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; (padre || raiz).add(mesh); return mesh; };
  const caja = (w, h, d, color, r, rough) => new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 5, r == null ? 0.12 : r), mat(color, rough));
  const esfera = (r, color) => new THREE.Mesh(new THREE.SphereGeometry(r, 32, 24), mat(color, 0.5));
  const hueso = (a, b, r, color) => {   // cápsula entre dos puntos
    const dir = new THREE.Vector3().subVectors(b, a), len = dir.length();
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.001, len - 2 * r), 8, 16), mat(color, 0.55));
    m.position.copy(a).addScaledVector(dir, 0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    m.castShadow = m.receiveShadow = true; raiz.add(m); return m;
  };
  const flota = (mesh, amp, vel, fase, giro) => { flotantes.push({ mesh, y0: mesh.position.y, amp, vel, fase: fase || 0, giro: giro || 0 }); return mesh; };

  // ---- pared que recibe las sombras suaves
  const pared = new THREE.Mesh(new THREE.PlaneGeometry(40, 26), new THREE.ShadowMaterial({ opacity: 0.16 })); pared.position.set(0, 3, -2.4); pared.receiveShadow = true; scene.add(pared);

  // ---- escritorio (dos tonos como en la referencia)
  poner(caja(8.4, 2.4, 3.2, 0xb590dc, 0.2), 0, -1.2, 0);
  poner(caja(2.8, 2.4, 3.22, 0xc863e2, 0.2), 2.9, -1.2, 0);
  poner(caja(1.6, 0.14, 1.2, 0xe0a97c, 0.06), -2.2, -2.45, 1.8);   // cajón/bloque frontal

  // ---- monitor visto por detrás
  const monitor = new THREE.Group(); monitor.position.set(-2.1, 0, 0.2); monitor.rotation.y = -0.38; raiz.add(monitor);
  poner(caja(3.2, 2.35, 0.22, 0xe86bb5, 0.16), 0, 2.25, 0, monitor);
  poner(caja(2.7, 1.9, 0.06, 0xff9fcf, 0.1), 0.02, 2.28, 0.14, monitor);
  const soporte = poner(caja(0.5, 1.5, 0.2, 0xd44a72, 0.1), 0, 0.85, -0.12, monitor); soporte.rotation.x = -0.18;
  poner(caja(1.5, 0.14, 1.0, 0xd44a72, 0.07), 0, 0.07, 0.1, monitor);

  // ---- teclado
  poner(caja(2.1, 0.09, 0.62, 0x3b2a4f, 0.04), 1.45, 0.07, 1.0);

  // ---- personaje
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.95, 1.1, 10, 28), mat(0xf7a15b, 0.6)); torso.scale.set(1, 1, 0.82); poner(torso, 2.75, 1.25, 0);
  const cuello = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.2, 16, 40), mat(0xe98c47, 0.6)); cuello.rotation.x = Math.PI / 2; poner(cuello, 2.75, 2.25, 0.05);
  hueso(new THREE.Vector3(2.05, 1.7, 0.25), new THREE.Vector3(1.55, 0.45, 0.95), 0.3, 0xf7a15b);
  hueso(new THREE.Vector3(3.45, 1.7, 0.25), new THREE.Vector3(1.95, 0.45, 1.0), 0.3, 0xf7a15b);
  poner(esfera(0.3, 0xf3c5b5), 1.5, 0.32, 1.0); poner(esfera(0.3, 0xf3c5b5), 1.9, 0.32, 1.05);
  const cabeza = new THREE.Group(); cabeza.position.set(2.75, 3.3, 0.05); raiz.add(cabeza);
  poner(esfera(0.9, 0x7b3f35), 0, 0, 0, cabeza);
  const cara = esfera(0.62, 0xf7dccb); cara.scale.set(1, 0.8, 0.55); poner(cara, -0.1, -0.1, 0.62, cabeza);
  poner(esfera(0.065, 0x3a2420), -0.3, -0.02, 0.92, cabeza); poner(esfera(0.065, 0x3a2420), 0.12, -0.02, 0.92, cabeza);
  const boca = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.03, 8, 20, Math.PI), mat(0xb85c5c, 0.5)); boca.rotation.z = Math.PI; poner(boca, -0.1, -0.3, 0.93, cabeza);
  poner(esfera(0.2, 0xf7dccb), 0.92, -0.05, 0.05, cabeza);

  // ---- cactus
  const maceta = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.44, 0.62, 28), mat(0xfaf5f2, 0.5)); poner(maceta, -4.15, 0.32, 1.0);
  hueso(new THREE.Vector3(-4.15, 0.7, 1.0), new THREE.Vector3(-4.15, 1.7, 1.0), 0.24, 0x5fc39a);
  hueso(new THREE.Vector3(-4.15, 1.1, 1.0), new THREE.Vector3(-4.55, 1.45, 1.0), 0.14, 0x5fc39a);
  hueso(new THREE.Vector3(-4.15, 1.25, 1.0), new THREE.Vector3(-3.8, 1.55, 1.0), 0.14, 0x5fc39a);
  poner(esfera(0.1, 0xff8fb1), -4.15, 1.98, 1.0);

  // ---- panel pastel detrás del monitor (degradado rosa → amarillo)
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 128; const cx = cv.getContext('2d'); const gr = cx.createLinearGradient(0, 0, 0, 128);
  gr.addColorStop(0, '#ff9fb5'); gr.addColorStop(1, '#ffe08f'); cx.fillStyle = gr; cx.fillRect(0, 0, 64, 128);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const panel = new THREE.Mesh(new RoundedBoxGeometry(2.3, 2.1, 0.12, 4, 0.14), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 })); poner(panel, -0.1, 3.45, -1.3); panel.rotation.z = 0.04; flota(panel, 0.08, 0.7, 1);

  // ---- objetos flotantes
  const anillo = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.5, 28, 72), mat(0xf5a53b, 0.45)); poner(anillo, -5.3, 5.5, -0.6); anillo.rotation.set(0.9, 0.35, 0.2); flota(anillo, 0.12, 0.5, 0, 0.1);
  const brujula = new THREE.Group(); brujula.position.set(-0.5, 5.7, 0.4); brujula.rotation.set(0.5, -0.2, 0.25); raiz.add(brujula);
  const disco = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.24, 48), mat(0xfaf8ff, 0.4)); disco.rotation.x = Math.PI / 2; poner(disco, 0, 0, 0, brujula);
  const interior = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.26, 48), mat(0x7db7ff, 0.45)); interior.rotation.x = Math.PI / 2; poner(interior, 0, 0, 0.01, brujula);
  const aguja1 = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.8, 4), mat(0xe8494f, 0.5)); aguja1.rotation.z = -0.8; poner(aguja1, 0.18, 0.18, 0.2, brujula);
  const aguja2 = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.8, 4), mat(0xffffff, 0.5)); aguja2.rotation.z = Math.PI - 0.8; poner(aguja2, -0.18, -0.18, 0.2, brujula);
  flota(brujula, 0.15, 0.8, 2, 0.15);
  const forma = new THREE.Shape(); forma.moveTo(0, 0); forma.lineTo(0, 1.5); forma.lineTo(0.38, 1.15); forma.lineTo(0.68, 1.75); forma.lineTo(0.95, 1.62); forma.lineTo(0.66, 1.05); forma.lineTo(1.12, 1.05); forma.closePath();
  const cursor = new THREE.Mesh(new THREE.ExtrudeGeometry(forma, { depth: 0.16, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 3 }), mat(0xf6f4fb, 0.45)); poner(cursor, -3.2, 4.0, 0.9); cursor.rotation.set(0.1, 0.35, -0.45); flota(cursor, 0.15, 0.9, 3, 0.2);
  const cuboMenta = caja(0.8, 0.8, 0.8, 0x7fcfc0, 0.16); poner(cuboMenta, 5.2, 6.1, -0.8); cuboMenta.rotation.set(0.5, 0.6, 0.2); flota(cuboMenta, 0.15, 0.9, 4, 0.4);
  const cuboLila = caja(0.95, 0.95, 0.95, 0xa78bfa, 0.18); poner(cuboLila, 6.1, 4.5, 0.1); cuboLila.rotation.set(0.4, -0.5, 0.3); flota(cuboLila, 0.18, 0.7, 5, 0.3);
  const vidrio = new THREE.Mesh(new RoundedBoxGeometry(2.1, 2.6, 0.08, 4, 0.14), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, roughness: 0.15 })); poner(vidrio, 5.6, 2.9, -0.7); vidrio.rotation.z = -0.06; flota(vidrio, 0.1, 0.6, 6);
  const linea1 = caja(0.9, 0.07, 0.04, 0xff6b9a, 0.02); poner(linea1, 5.45, 3.15, -0.62); const linea2 = caja(1.2, 0.07, 0.04, 0xffb3c6, 0.02); poner(linea2, 5.55, 2.9, -0.62);
  const cuboFrente = caja(1.05, 1.05, 1.05, 0x72b9ae, 0.2); poner(cuboFrente, 3.3, -1.35, 1.9); cuboFrente.rotation.set(0.5, 0.7, 0.1); flota(cuboFrente, 0.08, 0.8, 7, 0.2);
  [[-5.9, 2.9, 0xf4a58a, 0.09], [1.0, 5.3, 0xff7fb0, 0.11], [-1.4, 1.95, 0xf4a58a, 0.07], [3.9, 4.3, 0xf4a58a, 0.08], [1.1, -1.7, 0x7c4dff, 0.1]].forEach((d, i) => { const e = esfera(d[3], d[2]); poner(e, d[0], d[1], 1.2); flota(e, 0.18, 1 + i * 0.15, i); });

  // ---- tamaño y cámara (se ajusta al ancho para que quepa todo)
  function ajustar() {
    const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight), aspecto = w / h;
    renderer.setSize(w, h, false); camera.aspect = aspecto;
    const dist = Math.max(15, 12.6 / (0.4987 * aspecto));   // 0.4987 = 2·tan(14°): ancho visible = 0.4987·dist·aspecto
    camera.position.set(mira.x, mira.y + 1.0, dist); camera.lookAt(mira); camera.updateProjectionMatrix();
  }
  ajustar();

  // ---- animación
  const puntero = { x: 0, y: 0 }; let raf = 0, corriendo = false, t0 = 0;
  function cuadro(ahora) {
    const t = (ahora - t0) / 1000;
    flotantes.forEach((f) => { f.mesh.position.y = f.y0 + Math.sin(t * f.vel + f.fase) * f.amp; if (f.giro) f.mesh.rotation.y += f.giro * 0.004; });
    cabeza.position.y = 3.3 + Math.sin(t * 1.4) * 0.04; cabeza.rotation.y = Math.sin(t * 0.6) * 0.08;
    raiz.rotation.y += (puntero.x * 0.2 - raiz.rotation.y) * 0.05; raiz.rotation.x += (-puntero.y * 0.08 - raiz.rotation.x) * 0.05;
    renderer.render(scene, camera);
    if (corriendo) raf = requestAnimationFrame(cuadro);
  }
  function iniciar() { if (corriendo || o.sinMovimiento) return; corriendo = true; t0 = performance.now(); raf = requestAnimationFrame(cuadro); }
  function detener() { corriendo = false; cancelAnimationFrame(raf); }
  host.addEventListener('pointermove', (e) => { const r = host.getBoundingClientRect(); puntero.x = ((e.clientX - r.left) / r.width - 0.5) * 2; puntero.y = ((e.clientY - r.top) / r.height - 0.5) * 2; }, { passive: true });
  host.addEventListener('pointerleave', () => { puntero.x = 0; puntero.y = 0; });
  if ('ResizeObserver' in window) new ResizeObserver(() => { ajustar(); if (!corriendo) renderer.render(scene, camera); }).observe(host);
  if ('IntersectionObserver' in window) new IntersectionObserver((es) => { es[0].isIntersecting && !document.hidden ? iniciar() : detener(); }, { threshold: 0.05 }).observe(host); else iniciar();
  document.addEventListener('visibilitychange', () => { if (document.hidden) detener(); else if (host.getBoundingClientRect().bottom > 0) iniciar(); });
  function tema(oscuro) { renderer.toneMappingExposure = oscuro ? 0.78 : 1.05; hemi.intensity = oscuro ? 0.35 : 0.7; sol.intensity = oscuro ? 1.5 : 2.4; relleno.intensity = oscuro ? 10 : 18; if (!corriendo) renderer.render(scene, camera); }
  cuadro(performance.now()); if (!o.sinMovimiento) iniciar();
  return { tema, detener, renderer };
}
