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

export function createPasajeros(stage) {
  return PASAJEROS.map((p) => {
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
    return { ...p, ...fig, objeto, mixer: md?.mixer ?? null, gone: false, sway: Math.random() * 6 };
  });
}

const tmp = new THREE.Vector3();

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
