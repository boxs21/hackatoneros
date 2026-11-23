import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { lambert, seeded } from '../world/ps1.js';

// La multitud de la hora punta: gente de colores que se puede empujar.
// Cada persona tiene un "lugar" y vuelve a él como un resorte. Si la empujas
// se corre, pero hasta cierto punto: después te frena a ti.
const BODY_R = .27;
const PLAYER_R = .24;
const MAX_SHOVE = .42;

const flat = (g) => {
  const n = g.index ? g.toNonIndexed() : g;
  if (n !== g) g.dispose();
  return n;
};

function bodyGeometry() {
  const parts = [
    new THREE.BoxGeometry(.13, .82, .15).translate(-.09, .41, 0),
    new THREE.BoxGeometry(.13, .82, .15).translate(.09, .41, 0),
    new THREE.CylinderGeometry(.21, .17, .64, 6).scale(1, 1, .65).translate(0, 1.14, 0),
    new THREE.BoxGeometry(.09, .6, .1).translate(-.26, 1.13, 0),
    new THREE.BoxGeometry(.09, .6, .1).translate(.26, 1.13, 0),
  ].map(flat);
  const g = mergeGeometries(parts);
  parts.forEach((p) => p.dispose());
  return g;
}

const ROPA = [0x2b3444, 0x5a2a2a, 0x2f4a3a, 0x6b6b70, 0x1f1f24, 0x7a5a2a, 0x3a3a6a, 0x8a3a4a, 0x4a4a4a, 0x2a5a7a, 0x6a4a6a, 0xa0a090];
const PIEL = [0xc49a7c, 0xb98b6c, 0xd0a888, 0xa87a5a, 0x8a6048, 0xe0bc9c];

export function createMultitud({ seed = 3, zFrom = 11.6, zTo = 1.2, avoid = [], colliders = [] } = {}) {
  const rnd = seeded(seed);
  const people = [];
  const free = (x, z, min) => people.every((p) => Math.hypot(p.hx - x, p.hz - z) > min)
    && avoid.every((a) => Math.hypot(a.x - x, a.z - z) > a.r)
    && colliders.every((c) => Math.hypot(c.x - x, c.z - z) > c.r + .3);

  // de pie en el pasillo (apretados)
  for (let z = zFrom; z > zTo; z -= .5) {
    for (let x = -1.15; x <= 1.16; x += .5) {
      const jx = x + (rnd() - .5) * .22;
      const jz = z + (rnd() - .5) * .22;
      if (rnd() > .82 || !free(jx, jz, .5)) continue;
      people.push({ hx: jx, hz: jz, seated: false });
    }
  }
  // sentados en las bancas (no estorban, pero llenan)
  for (let z = 12.3; z > -12.3; z -= .62) {
    if (Math.abs(z - Math.round(z / 8) * 8) < .9) continue;
    for (const s of [-1, 1]) if (rnd() < .8) people.push({ hx: s * 2.12, hz: z + (rnd() - .5) * .1, seated: true });
  }
  // más gente de pie lejos, hacia adelante (relleno visual)
  for (let z = zTo; z > -12; z -= .7) {
    for (let x = -1.1; x <= 1.1; x += .55) if (rnd() < .55 && free(x, z, .45)) people.push({ hx: x + (rnd() - .5) * .2, hz: z, seated: false });
  }

  people.forEach((p) => {
    p.x = p.hx;
    p.z = p.hz;
    p.yaw = (rnd() - .5) * Math.PI * 2;
    p.phase = rnd() * 10;
    p.scale = .9 + rnd() * .2;
    p.ropa = ROPA[Math.floor(rnd() * ROPA.length)];
    p.piel = PIEL[Math.floor(rnd() * PIEL.length)];
    p.annoyed = 0;
  });

  const n = people.length;
  const body = new THREE.InstancedMesh(bodyGeometry(), lambert({ color: 0xffffff }), n);
  const head = new THREE.InstancedMesh(new THREE.BoxGeometry(.2, .24, .21).translate(0, 1.67, 0), lambert({ color: 0xffffff }), n);
  const hair = new THREE.InstancedMesh(new THREE.BoxGeometry(.21, .07, .22).translate(0, 1.8, -.005), lambert({ color: 0xffffff }), n);
  const c = new THREE.Color();
  people.forEach((p, i) => {
    body.setColorAt(i, c.setHex(p.ropa));
    head.setColorAt(i, c.setHex(p.piel));
    hair.setColorAt(i, c.setHex(rnd() < .2 ? 0x9a9690 : rnd() < .5 ? 0x2a1d16 : 0x14110f));
  });
  for (const m of [body, head, hair]) m.frustumCulled = false;

  const o = new THREE.Object3D();
  function place(time) {
    people.forEach((p, i) => {
      const sway = Math.sin(time * 1.3 + p.phase) * .025;
      const y = p.seated ? -.36 : 0;
      o.position.set(p.x, y, p.z);
      o.rotation.set(0, p.yaw, sway + p.annoyed * .1);
      o.scale.set(p.scale, p.seated ? p.scale * .99 : p.scale, p.scale);
      o.updateMatrix();
      body.setMatrixAt(i, o.matrix);
      head.setMatrixAt(i, o.matrix);
      hair.setMatrixAt(i, o.matrix);
    });
    body.instanceMatrix.needsUpdate = head.instanceMatrix.needsUpdate = hair.instanceMatrix.needsUpdate = true;
  }
  place(0);

  let time = 0;
  return {
    meshes: [body, head, hair],
    people,
    // Empuje: corre a la gente que te toca y te devuelve lo que no se pudo correr.
    // Devuelve cuánta gente estás empujando (para frenar al jugador y quejarse).
    update(dt, player, facing) {
      time += dt;
      let pushing = 0;
      let shoved = null;
      for (const p of people) {
        if (p.seated) continue;
        // resorte hacia su lugar
        p.x += (p.hx - p.x) * Math.min(1, dt * 1.2);
        p.z += (p.hz - p.z) * Math.min(1, dt * 1.2);
        p.annoyed = Math.max(0, p.annoyed - dt);
        const dx = p.x - player.x;
        const dz = p.z - player.z;
        const d = Math.hypot(dx, dz);
        const min = BODY_R + PLAYER_R;
        if (d >= min || d < 1e-4) continue;
        pushing += 1;
        const over = min - d;
        const ux = dx / d;
        const uz = dz / d;
        // la persona se corre (hacia el lado más que hacia adelante: abre paso)
        const side = Math.sign(ux || (p.hx > 0 ? 1 : -1));
        p.x += (ux * .5 + side * .5) * over;
        p.z += uz * over * .6;
        const ox = p.x - p.hx;
        const oz = p.z - p.hz;
        const off = Math.hypot(ox, oz);
        if (off > MAX_SHOVE) {
          p.x = p.hx + ox / off * MAX_SHOVE;
          p.z = p.hz + oz / off * MAX_SHOVE;
        }
        p.x = THREE.MathUtils.clamp(p.x, -1.5, 1.5);
        // lo que no se corrió te empuja a ti
        const d2 = Math.hypot(p.x - player.x, p.z - player.z);
        if (d2 < min && d2 > 1e-4) {
          player.x -= (p.x - player.x) / d2 * (min - d2);
          player.z -= (p.z - player.z) / d2 * (min - d2);
        }
        if (p.annoyed <= 0) shoved = p;
        p.annoyed = 1.2;
        // te miran feo
        p.yaw = Math.atan2(player.x - p.x, player.z - p.z);
      }
      place(time);
      return { pushing, shoved };
    },
    // mirar hacia algo (p. ej. al jugador que sacó una foto)
    lookAt(target, radius = 4) {
      for (const p of people) {
        if (Math.hypot(p.x - target.x, p.z - target.z) < radius) p.yaw = Math.atan2(target.x - p.x, target.z - p.z);
      }
    },
  };
}
