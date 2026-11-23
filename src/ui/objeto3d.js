import * as THREE from 'three';

// OBJETO OBTENIDO EN 3D. Dueño: Renato.
// Un renderer chico (96x96, se escala pixelado como el juego) que solo dibuja
// mientras el aviso está en pantalla. Cada regalo es un modelo low-poly hecho
// con cajas y cilindros; se arman una vez y se reutilizan.
// Entra girando rápido y frena, flota y se inclina un poco.

const RES = 96;
const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .75, metalness: 0, flatShading: true, ...extra });

function box(w, h, d, m, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y, z);
  return mesh;
}

function completo() {
  const g = new THREE.Group();
  const pan = mat(0xe8b062);
  const panOsc = mat(0xc98a3c);
  g.add(box(1.7, .26, .56, panOsc, 0, 0, 0)); // base del pan
  const izq = box(1.7, .34, .18, pan, 0, .2, -.26);
  izq.rotation.x = -.35;
  const der = box(1.7, .34, .18, pan, 0, .2, .26);
  der.rotation.x = .35;
  g.add(izq, der);
  const vienesa = new THREE.Mesh(new THREE.CylinderGeometry(.13, .13, 1.86, 8), mat(0xb5532e));
  vienesa.rotation.z = Math.PI / 2;
  vienesa.position.y = .27;
  g.add(vienesa);
  const tomate = mat(0xe4322b);
  for (let i = 0; i < 6; i++) g.add(box(.2, .1, .26, tomate, -.62 + i * .25, .42, 0));
  g.add(box(1.5, .09, .3, mat(0x79b85a), 0, .51, 0)); // palta
  const mayo = mat(0xf6f0dc);
  for (let i = 0; i < 8; i++) g.add(box(.16, .06, .08, mayo, -.62 + i * .18, .58, i % 2 ? .07 : -.07)); // zigzag de mayo
  g.scale.setScalar(.95);
  return g;
}

function screenTexture() {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 64;
  const x = c.getContext('2d');
  x.fillStyle = '#0b0f14';
  x.fillRect(0, 0, 32, 64);
  x.fillStyle = '#9aa3b5';
  x.fillRect(3, 3, 8, 2);
  x.fillRect(23, 3, 6, 2);
  x.fillStyle = '#f2b705';
  x.fillRect(9, 24, 14, 14);
  x.fillStyle = '#0b0f14';
  x.fillRect(13, 27, 2, 8);
  x.fillRect(13, 27, 6, 2);
  x.fillRect(13, 30, 5, 2);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function celular() {
  const g = new THREE.Group();
  g.add(box(.66, 1.25, .1, mat(0x2a2d33)));
  const pantalla = new THREE.Mesh(new THREE.PlaneGeometry(.56, 1.08), new THREE.MeshBasicMaterial({ map: screenTexture() }));
  pantalla.position.z = .051;
  g.add(pantalla);
  const lente = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, .03, 8), mat(0x0b0c0f));
  lente.rotation.x = Math.PI / 2;
  lente.position.set(-.18, .48, -.06);
  g.add(lente, box(.08, .05, .02, mat(0xfff1d6, { emissive: 0xfff1d6, emissiveIntensity: .8 }), -.04, .48, -.06)); // flash
  return g;
}

function llavero() {
  const g = new THREE.Group();
  const metal = mat(0xc9ccd3, { metalness: .6, roughness: .35 });
  const argolla = new THREE.Mesh(new THREE.TorusGeometry(.3, .05, 6, 14), metal);
  argolla.position.set(-.35, .45, 0);
  g.add(argolla, box(.06, .22, .06, metal, -.12, .2, 0));
  const linterna = new THREE.Mesh(new THREE.CylinderGeometry(.16, .16, .72, 8), mat(0x2f7fe0));
  linterna.rotation.z = Math.PI / 2;
  linterna.position.set(.25, 0, 0);
  const punta = new THREE.Mesh(new THREE.CylinderGeometry(.19, .17, .1, 8), mat(0xfff3a8, { emissive: 0xf2b705, emissiveIntensity: 1.4 }));
  punta.rotation.z = Math.PI / 2;
  punta.position.set(.65, 0, 0);
  const luz = new THREE.PointLight(0xffe08a, 2.5, 3);
  luz.position.set(.9, 0, 0);
  g.add(linterna, punta, luz);
  return g;
}

function chocolate() {
  const g = new THREE.Group();
  const choco = mat(0x6b3a1f);
  g.add(box(1.3, .2, .66, choco));
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) g.add(box(.24, .06, .26, mat(0x7d4626), -.5 + i * .3, .13, -.15 + j * .3)); // cuadritos a la vista
  g.add(box(.78, .24, .7, mat(0xe4322b), .28, 0, 0)); // envoltorio
  g.add(box(.79, .25, .2, mat(0xf2b705), .28, 0, 0)); // franja amarilla
  g.add(box(.06, .23, .69, mat(0xd9dde4, { metalness: .7, roughness: .3 }), -.13, 0, 0)); // papel plateado
  return g;
}

function otro() {
  const g = new THREE.Group();
  g.add(box(.8, .8, .8, mat(0xf2b705)));
  return g;
}

const FABRICA = { completo, celular, llavero, chocolate, otro };

export function tipoDe(nombre) {
  const n = String(nombre).toLowerCase();
  for (const k of ['completo', 'celular', 'llavero', 'chocolate']) if (n.includes(k)) return k;
  return 'otro';
}

export function createObjeto3d(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
  renderer.setPixelRatio(1);
  renderer.setSize(RES, RES, false);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, .1, 20);
  camera.position.set(0, .9, 3.3);
  camera.lookAt(0, .05, 0);
  scene.add(new THREE.HemisphereLight(0xfff4e0, 0x1a1f2e, 1.4));
  const key = new THREE.DirectionalLight(0xfff1d6, 2.4);
  key.position.set(2, 3, 3);
  const rim = new THREE.DirectionalLight(0x8fb4ff, 1.6);
  rim.position.set(-3, 1, -2);
  scene.add(key, rim);

  const pivot = new THREE.Group();
  scene.add(pivot);
  const cache = {};
  let actual = null;
  let raf = 0;
  let t = 0;
  let last = 0;
  let inclinacion = 0;
  // cuánto se inclina cada uno hacia la cámara para que se vea lo importante
  const INCLINA = { completo: .35, chocolate: .55, celular: 0, llavero: .1, otro: .3 };

  function loop(now) {
    const dt = Math.min(.05, (now - last) / 1000 || 0);
    last = now;
    t += dt;
    try {
      // entra desde chico girando rápido y frena; después flota
      const pop = Math.min(1, t / .35);
      const s = pop < 1 ? 1.15 * (1 - (1 - pop) ** 3) : 1 + (Math.max(0, .15 - (t - .35) * .5));
      pivot.scale.setScalar(s);
      // dos vueltas rápidas que frenan mirando al frente, y después se balancea
      pivot.rotation.y = -1.2 + (Math.PI * 4 + 1.2) * (1 - Math.exp(-t * 3)) + Math.sin(t * 1.3) * .5 * Math.min(1, t);
      pivot.rotation.x = inclinacion + Math.sin(t * 1.7) * .08;
      pivot.position.y = Math.sin(t * 2.2) * .07;
      renderer.render(scene, camera);
    } catch (err) {
      console.error('[objeto3d]', err);
      return;
    }
    raf = requestAnimationFrame(loop);
  }

  return {
    show(tipo) {
      if (actual) pivot.remove(actual);
      actual = cache[tipo] ||= (FABRICA[tipo] || otro)();
      pivot.add(actual);
      pivot.rotation.set(0, -1.2, 0);
      inclinacion = INCLINA[tipo] ?? .2;
      t = 0;
      last = performance.now();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(loop);
    },
    stop() {
      cancelAnimationFrame(raf);
      raf = 0;
    },
  };
}
