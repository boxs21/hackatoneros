import * as THREE from 'three';
import { createFigura, createObjeto } from './figura.js';
import { modelo } from './modelos.js';

// Los cuatro, en el orden en que desaparecen.
export const PASAJEROS = [
  { name: 'Escolar', objeto: 'mochila', x: -.95, z: 8.6, look: { ropa: 0x2d3e6e, pantalon: 0x4b4f57, pelo: '#1d140f', extra: 'gorro', alto: .88 } },
  { name: 'Oficinista', objeto: 'maletin', x: 1.0, z: 7.2, look: { ropa: 0x3d4148, pantalon: 0x22252b, piel: '#b98b6c', extra: 'lentes' } },
  { name: 'Señora', objeto: 'carro', x: -1.0, z: 5.7, look: { ropa: 0x8e4f6b, pantalon: 0x3a2e3a, piel: '#d0a888', pelo: '#9a9690', extra: 'canas', alto: .93 } },
  { name: 'Vendedor', objeto: 'chocolates', x: 1.0, z: 4.3, look: { ropa: 0xb5642e, pantalon: 0x2c3340, piel: '#a87a5a', alto: 1.02 } },
];

// Dónde queda el objeto respecto al cuerpo (mano, espalda, al lado).
const HOLD = {
  mochila: [0, 1.02, -.17, 0],
  maletin: [.3, .62, .02, Math.PI / 2],
  carro: [.42, 0, .1, 0],
  chocolates: [0, 1.0, .26, 0],
};

// sin: nombres que no aparecen (p. ej. ['Vendedor']: después del apagón ya no está vivo).
export function createPasajeros(stage, { sin = [] } = {}) {
  return PASAJEROS.filter((p) => !sin.includes(p.name)).map((p) => {
    const fig = createFigura(p.look);
    // Modelo 3D de Andy (Quaternius) si ya cargó; si no, queda la figura de cubos.
    const md = modelo(p.name, 1.7);
    if (md) {
      fig.body.children.forEach((c) => { c.visible = false; });
      fig.body.add(md.obj);
    }
    const objeto = createObjeto(p.objeto);
    objeto.userData.tipo = p.objeto;
    const [hx, hy, hz, ry] = HOLD[p.objeto];
    objeto.position.set(hx, hy, hz);
    objeto.rotation.y = ry;
    fig.root.add(objeto);
    fig.root.position.set(p.x, 0, p.z);
    stage.add(fig.root);
    // Pose del brazo izquierdo (Renato): hablar por teléfono y pasarte el celular.
    // pose.telefono / pose.dar = 0..1 (objetivo); el estado los pone y aquí se suavizan.
    const huesos = md ? buscarHuesos(md.obj) : null;
    const celu = crearCelu();
    celu.visible = false;
    fig.root.add(celu);
    const pose = { telefono: 0, dar: 0, t: 0, d: 0, conCelular: true };
    return { ...p, ...fig, objeto, mixer: md?.mixer ?? null, gone: false, sway: Math.random() * 6, huesos, celu, pose };
  });
}

const tmp = new THREE.Vector3();

// --- Pose del brazo (Renato) ---------------------------------------------------
// Celular en la mano del Oficinista (izquierda, como dice DISENO.md).
// Solo lo usa en hora punta (vagón con luz y colores claros): carcasa negra y
// pantalla bien encendida por los dos lados, para que contraste y se vea.
const CELU_CUERPO = new THREE.BoxGeometry(.07, .145, .012);
const CELU_PANTALLA = new THREE.PlaneGeometry(.06, .125);
const CELU_MAT = new THREE.MeshBasicMaterial({ color: 0x111317 });
const CELU_LUZ = new THREE.MeshBasicMaterial({ color: 0x3f7fbf, side: THREE.DoubleSide }); // encendida pero no un foco
function crearCelu() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(CELU_CUERPO, CELU_MAT));
  const pantalla = new THREE.Mesh(CELU_PANTALLA, CELU_LUZ);
  pantalla.position.z = .0065;
  g.add(pantalla);
  const lente = new THREE.Mesh(new THREE.PlaneGeometry(.014, .014), new THREE.MeshBasicMaterial({ color: 0x15171b }));
  lente.position.set(-.018, .055, -.0065);
  lente.rotation.y = Math.PI;
  g.add(lente);
  g.scale.setScalar(1.35);
  return g;
}

function buscarHuesos(obj) {
  const h = {};
  obj.traverse((o) => {
    if (!o.isBone) return;
    const n = o.name.replace('.', ''); // GLTFLoader les saca el punto: UpperArm.L -> UpperArmL
    if (n === 'UpperArmL') h.brazo = o;
    else if (n === 'LowerArmL') h.antebrazo = o;
    else if (n === 'PalmL') h.mano = o;
    else if (n === 'Head') h.cabeza = o;
    else if (n === 'Neck') h.cuello = o;
  });
  return h.brazo && h.antebrazo && h.mano && h.cabeza && h.cuello ? h : null;
}

const va = new THREE.Vector3();
const vb = new THREE.Vector3();
const vc = new THREE.Vector3();
const vd = new THREE.Vector3();
const lado = new THREE.Vector3();
const cabezaPos = new THREE.Vector3();
const frente = new THREE.Vector3();
const codo = new THREE.Vector3();
const manoObj = new THREE.Vector3();
const qd = new THREE.Quaternion();
const qw = new THREE.Quaternion();
const qp = new THREE.Quaternion();
const QI = new THREE.Quaternion();
const qt = new THREE.Quaternion();

// Gira un hueso (en el mundo) para que apunte de su base hacia `objetivo`.
function apuntar(hueso, hijo, objetivo, peso) {
  hueso.updateWorldMatrix(true, true);
  hueso.getWorldPosition(va);
  hijo.getWorldPosition(vb);
  vc.subVectors(vb, va).normalize();
  vd.subVectors(objetivo, va).normalize();
  qd.setFromUnitVectors(vc, vd);
  if (peso < 1) qd.copy(qt.copy(QI).slerp(qd, peso)); // (slerpQuaternions pisaría qd)
  hueso.getWorldQuaternion(qw).premultiply(qd);
  hueso.parent.getWorldQuaternion(qp).invert();
  hueso.quaternion.copy(qp.multiply(qw));
}

function posarBrazo(p, dt, camera) {
  const ps = p.pose;
  ps.t += (ps.telefono - ps.t) * Math.min(1, dt * 5);
  ps.d += (ps.dar - ps.d) * Math.min(1, dt * 5);
  const peso = Math.min(1, Math.max(ps.t, ps.d));
  p.celu.visible = ps.conCelular && peso > .5;
  if (peso < .01) return;
  const h = p.huesos;
  if (!h) {
    // figura de cubos (sin modelo): solo levanta el brazo
    p.armL.rotation.x = -(2.6 * ps.t * (1 - ps.d) + 1.35 * ps.d);
    return;
  }
  h.cuello.getWorldPosition(va);
  h.brazo.getWorldPosition(vb);
  lado.subVectors(vb, va).setY(0).normalize(); // hacia su izquierda
  frente.set(0, 0, 1).applyQuaternion(p.root.quaternion);
  h.cabeza.getWorldPosition(cabezaPos);
  // al teléfono: codo abajo y afuera, mano en la oreja
  codo.copy(vb).addScaledVector(lado, .12).addScaledVector(frente, .1).y -= .2;
  manoObj.copy(cabezaPos).addScaledVector(lado, .1).addScaledVector(frente, .03);
  // pasándote el celular: el brazo estirado hacia tu pecho
  if (ps.d > .01) {
    vd.copy(camera.position).y -= .35;
    vd.sub(vb).normalize();
    va.copy(vb).addScaledVector(vd, .26);
    codo.lerp(va, ps.d);
    va.copy(vb).addScaledVector(vd, .6);
    manoObj.lerp(va, ps.d);
  }
  apuntar(h.brazo, h.antebrazo, codo, peso);
  apuntar(h.antebrazo, h.mano, manoObj, peso);
  if (p.celu.visible) {
    // en la mano, un poco hacia afuera para que no quede metido en la cabeza
    // en la mano, junto a la oreja: un poco hacia afuera y arriba de la palma
    // para que no quede metido en la cabeza ni tapado por la mano
    h.mano.getWorldPosition(va);
    if (ps.d < .5) va.addScaledVector(lado, .035).y += .035;
    p.root.worldToLocal(p.celu.position.copy(va));
    // al teléfono: entre la cabeza y tú, para que no se vea de canto desde el frente
    // al pasártelo te muestra la pantalla; al teléfono, la pantalla va contra la cara
    // (girado un poco hacia ti para que se alcance a ver)
    if (ps.d > .5) p.celu.lookAt(camera.position);
    else p.celu.lookAt(vd.copy(cabezaPos).lerp(camera.position, .4));
  }
}

// Miran al jugador y respiran. Los que ya no están, no.
export function updatePasajeros(list, dt, camera) {
  for (const p of list) {
    if (p.gone) continue;
    p.mixer?.update(dt);
    p.sway += dt;
    tmp.copy(camera.position);
    const yaw = Math.atan2(tmp.x - p.root.position.x, tmp.z - p.root.position.z);
    const diff = Math.atan2(Math.sin(yaw - p.root.rotation.y), Math.cos(yaw - p.root.rotation.y));
    p.root.rotation.y += diff * Math.min(1, dt * 2);
    p.body.position.y = Math.sin(p.sway * 1.7) * .006;
    p.armL.rotation.x = Math.sin(p.sway * .9) * .05;
    p.head.rotation.x = Math.sin(p.sway * .6) * .04;
    if (p.pose) posarBrazo(p, dt, camera);
  }
}

// Desaparece: el cuerpo se va y el objeto cae al piso, donde estaba.
const CAIDO = { mochila: [.08, -Math.PI / 2, 0], maletin: [.05, -Math.PI / 2, 0], carro: [0, 0, -.12], chocolates: [0, 0, .18] };

export function desaparecer(stage, p) {
  p.gone = true;
  p.body.visible = false;
  stage.attach(p.objeto);
  const [y, rx, rz] = CAIDO[p.objeto.userData.tipo] || [0, 0, 0];
  p.objeto.position.y = y;
  p.objeto.rotation.x = rx;
  p.objeto.rotation.z = rz;
}
