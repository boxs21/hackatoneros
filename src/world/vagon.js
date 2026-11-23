import * as THREE from 'three';
import { lambert, basic } from './ps1.js';
import { textura } from './texturas.js';

// Vagón de metro: 5 m de ancho, 26 m de largo, 3,2 m de alto.
// Puertas laterales en z = -8, 0, 8; asientos longitudinales entre medio;
// túnel afuera de las ventanas. Devuelve colisiones para el jugador.
export const VAGON = {
  halfW: 2.5,
  halfL: 13,
  aisle: 1.32, // el jugador camina entre -aisle y +aisle
  doors: [-8, 0, 8],
  endDoorZ: -12.85,
};

const SEGMENTS = [[-12.9, -8.75], [-7.25, -0.75], [0.75, 7.25], [8.75, 12.9]];

export function createVagon({ tubeFlicker = false, lit = false } = {}) {
  const vagon = new THREE.Group();
  const colliders = []; // { x, z, r }

  const mats = {
    suelo: lambert({ map: textura('suelo', 4, 22) }),
    techo: lambert({ map: textura('techo', 3, 18) }),
    pared: lambert({ map: textura('pared', 6, 1) }),
    paredAlta: lambert({ map: textura('pared', 6, .5) }),
    asiento: lambert({ map: textura('asiento', 4, 1) }),
    respaldo: lambert({ map: textura('asiento', 4, .5) }),
    base: lambert({ color: 0x3c3f44 }),
    metal: lambert({ color: 0xb9bcbf }),
    marco: lambert({ color: 0x6e7274 }),
    goma: lambert({ color: 0x1b1b1d }),
    vidrio: lambert({ map: textura('vidrio'), transparent: true, opacity: .45, depthWrite: false }),
    tunel: lambert({ map: textura('tunel', 10, 2) }),
    puerta: lambert({ map: textura('puerta') }),
    aviso: lambert({ map: textura('aviso') }),
    mapa: lambert({ map: textura('mapa') }),
    tubo: lit ? basic({ color: 0xeef4ff }) : lambert({ color: 0x3a3a36, emissive: 0x000000 }),
    emergencia: basic({ color: 0x3df08a }),
    rojo: basic({ color: 0xff2a22 }),
  };

  function box(w, h, d, mat, x, y, z, parent = vagon) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }

  // piso, techo, curvas del techo
  box(5, .15, 26, mats.suelo, 0, -.075, 0);
  box(3.6, .12, 26, mats.techo, 0, 3.12, 0);
  for (const s of [-1, 1]) {
    const curve = box(.9, .1, 26, mats.techo, s * 2.12, 2.98, 0);
    curve.rotation.z = s * .45;
  }

  // paredes laterales, ventanas, asientos
  for (const s of [-1, 1]) {
    const wx = s * VAGON.halfW;
    for (const [a, b] of SEGMENTS) {
      const len = b - a;
      const mid = (a + b) / 2;
      box(.12, 1.35, len, mats.pared, wx, .675, mid);
      box(.12, .55, len, mats.paredAlta, wx, 2.72, mid);
      box(.04, 1.1, len, mats.vidrio, wx, 1.9, mid);
      // marcos de ventana
      for (const z of [a + .05, mid, b - .05]) box(.16, 1.1, .1, mats.marco, wx, 1.9, z);
      box(.18, .06, len, mats.marco, wx - s * .02, 1.36, mid);
      // aviso publicitario sobre la ventana
      if (len > 5) {
        const ad = box(.02, .4, .8, mats.aviso, wx - s * .07, 2.7, mid + 1.6);
        ad.rotation.y = s > 0 ? Math.PI : 0;
      }
      // banca
      const seatLen = len - .5;
      box(.55, .12, seatLen, mats.asiento, s * 2.16, .46, mid);
      box(.42, .4, seatLen, mats.base, s * 2.2, .2, mid);
      const back = box(.1, .5, seatLen, mats.respaldo, s * 2.4, .8, mid);
      back.rotation.z = s * -.12;
      // barras verticales en los extremos de la banca
      for (const z of [a + .4, b - .4]) {
        if (Math.abs(z) > 12.5) continue;
        box(.05, 3, .05, mats.metal, s * 1.86, 1.5, z);
      }
    }
    // puertas
    for (const dz of VAGON.doors) {
      for (const k of [-1, 1]) {
        const leaf = box(.06, 2.15, .74, mats.puerta, wx - s * .03, 1.08, dz + k * .37);
        leaf.scale.z = k; // espeja la franja amarilla hacia el centro
      }
      box(.14, 2.25, .08, mats.goma, wx - s * .02, 1.1, dz);
      box(.16, .14, 1.6, mats.marco, wx - s * .02, 2.22, dz);
      const map = box(.02, .14, 1.2, mats.mapa, wx - s * .1, 2.45, dz);
      map.rotation.y = s > 0 ? Math.PI : 0;
    }
    // túnel afuera
    box(.2, 6, 30, mats.tunel, s * 4.4, 1.5, 0);
    for (let z = -12; z <= 12; z += 3) box(.08, .08, 2.6, mats.goma, s * 4.25, 2.6 + (z % 2) * .1, z);
  }
  box(9, .1, 30, mats.goma, 0, -.6, 0);

  // barras horizontales del techo y manillas colgantes (instanciadas)
  const straps = [];
  for (const s of [-1, 1]) {
    box(.04, .04, 25.6, mats.metal, s * 1.15, 2.2, 0);
    for (let z = -12.4; z <= 12.4; z += .62) straps.push([s * 1.15, z]);
  }
  const strapGeo = new THREE.BoxGeometry(.03, .26, .05).translate(0, -.13, 0);
  const ringGeo = new THREE.TorusGeometry(.07, .015, 4, 6).translate(0, -.32, 0);
  const strapMesh = new THREE.InstancedMesh(strapGeo, mats.goma, straps.length);
  const ringMesh = new THREE.InstancedMesh(ringGeo, mats.goma, straps.length);
  const o = new THREE.Object3D();
  straps.forEach(([x, z], i) => {
    o.position.set(x, 2.2, z);
    o.rotation.set(0, Math.PI / 2, Math.sin(i * 3.1) * .08);
    o.updateMatrix();
    strapMesh.setMatrixAt(i, o.matrix);
    ringMesh.setMatrixAt(i, o.matrix);
  });
  vagon.add(strapMesh, ringMesh);

  // barras centrales en las zonas de puerta: obstáculos reales
  for (const dz of VAGON.doors) {
    box(.06, 3.1, .06, mats.metal, 0, 1.55, dz);
    colliders.push({ x: 0, z: dz, r: .22 });
  }

  // tubos fluorescentes (apagados) y luces de emergencia
  const tubes = [];
  for (const s of [-1, 1]) {
    for (let z = -11; z <= 11; z += 2.2) tubes.push(box(.22, .05, 1.6, mats.tubo, s * .75, 3.04, z));
  }
  for (let z = -10; z <= 10; z += 5) box(.12, .04, .12, mats.emergencia, 0, 3.05, z);

  // paredes de los extremos con puerta de intercomunicación
  for (const e of [-1, 1]) {
    const z = e * VAGON.halfL;
    box(1.7, 3.2, .12, mats.pared, -1.65, 1.6, z);
    box(1.7, 3.2, .12, mats.pared, 1.65, 1.6, z);
    box(1.6, 1, .12, mats.paredAlta, 0, 2.7, z);
    const door = box(1.55, 2.2, .06, mats.puerta, 0, 1.1, z - e * .02);
    if (e > 0) door.rotation.y = Math.PI;
    box(.3, .12, .05, mats.rojo, 0, 2.4, z - e * .08);
  }

  // Parpadeo opcional de un tubo (Escolar): devuelve un update.
  let flickT = 0;
  const flickTube = tubes[Math.floor(tubes.length * .35)];
  const flickMat = lambert({ color: 0x3a3a36, emissive: 0x000000 });
  if (tubeFlicker) flickTube.material = flickMat;

  return {
    group: vagon,
    colliders,
    update(dt) {
      if (!tubeFlicker) return 0;
      flickT += dt;
      const on = Math.sin(flickT * 23) > .6 && Math.sin(flickT * 1.3) > .85;
      flickMat.emissive.setHex(on ? 0xd8f0ff : 0x000000);
      return on ? 1 : 0;
    },
    flickPos: flickTube.position,
  };
}
