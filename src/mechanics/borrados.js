import * as THREE from 'three';
import { borradoGeometry } from '../world/figura.js';
import { lambert, seeded } from '../world/ps1.js';

// Los borrados: 300 siluetas grises que solo existen con luz.
// - "pasillo": bloquean el pasillo dejando un camino serpenteante. Si los tocas, te atrapan.
// - "lado": de pie frente a los asientos.
// - "afuera": pegados a las ventanas, mirando hacia adentro. Solo decoran.
// Cada flash los acerca al jugador (el dilema): ves el camino, pero se cierra.
export const CATCH_RADIUS = .42;

export function createBorrados({
  count = 300,
  seed = 7,
  zFrom = 3.5, // desde dónde empieza la multitud (hacia -z)
  zTo = -11.6,
  corridor = .72, // medio ancho del camino libre
  density = 1,
  colliders = [],
  reserve = 4, // espacios para los pasajeros que se convierten en borrados
  keepClear = [], // { x, z, r }: zonas donde no puede haber nadie (p. ej. frente a la tiza)
} = {}) {
  const rnd = seeded(seed);
  const phase = rnd() * Math.PI * 2;
  const pathX = (z) => .78 * Math.sin((zFrom - z) * .5 + phase) * Math.min(1, (zFrom - z) / 2.5);

  const people = []; // { x, z, kind, active, scale, lean, shade }
  const free = (x, z, min) => people.every((p) => Math.hypot(p.x - x, p.z - z) > min)
    && colliders.every((c) => Math.hypot(c.x - x, c.z - z) > c.r + .35)
    && keepClear.every((c) => Math.hypot(c.x - x, c.z - z) > c.r);

  // pasillo
  for (let z = zFrom; z > zTo; z -= .46) {
    for (let x = -1.25; x <= 1.26; x += .42) {
      if (rnd() > .78 * density) continue;
      const jx = THREE.MathUtils.clamp(x + (rnd() - .5) * .2, -1.3, 1.3);
      const jz = z + (rnd() - .5) * .2;
      if (Math.abs(jx - pathX(jz)) < corridor + CATCH_RADIUS * .6) continue;
      if (!free(jx, jz, .4)) continue;
      people.push({ x: jx, z: jz, kind: 'pasillo' });
    }
  }
  // frente a los asientos
  for (let i = 0; i < 46; i++) {
    const s = rnd() > .5 ? 1 : -1;
    const z = 12 - rnd() * 24;
    if (Math.abs(z - Math.round(z / 8) * 8) < .9) continue; // no en las puertas
    if (z > zFrom + 1) continue;
    if (free(s * 1.85, z, .45)) people.push({ x: s * 1.85, z, kind: 'lado' });
  }
  // reservados (pasajeros convertidos), escondidos al inicio
  for (let i = 0; i < reserve; i++) people.push({ x: 0, z: 0, kind: 'reserva', hidden: true });
  // afuera, pegados al vidrio
  while (people.length < count) {
    const s = rnd() > .5 ? 1 : -1;
    people.push({ x: s * (2.75 + rnd() * .9), z: 12.5 - rnd() * 25, kind: 'afuera' });
  }
  people.length = count;
  people.forEach((p) => {
    p.scale = .92 + rnd() * .2;
    p.lean = (rnd() - .5) * .16;
    p.shade = .36 + rnd() * .16;
  });

  const material = lambert({ color: 0xffffff, emissive: 0x000000 });
  const mesh = new THREE.InstancedMesh(borradoGeometry(), material, count);
  mesh.frustumCulled = false;
  mesh.visible = false;
  const color = new THREE.Color();
  people.forEach((p, i) => mesh.setColorAt(i, color.setScalar(p.shade)));

  const o = new THREE.Object3D();
  function place(px, pz) {
    people.forEach((p, i) => {
      if (p.hidden) {
        o.scale.setScalar(0);
      } else {
        o.scale.set(p.scale, p.scale * (1 + p.lean * .5), p.scale);
      }
      o.position.set(p.x, 0, p.z);
      o.rotation.set(0, Math.atan2(px - p.x, pz - p.z), p.lean);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }

  const moving = (p) => !p.hidden && (p.kind === 'pasillo' || p.kind === 'lado' || p.kind === 'reserva');

  return {
    mesh,
    people,
    pathX,
    // Un flash: los cercanos dan un paso hacia ti y te miran.
    step(player, amount = .3, radius = 6.5) {
      for (const p of people) {
        if (!moving(p)) continue;
        const dx = player.x - p.x;
        const dz = player.z - p.z;
        const d = Math.hypot(dx, dz);
        if (d > radius || d < 1e-3) continue;
        const s = Math.min(amount, d - .05);
        p.x = THREE.MathUtils.clamp(p.x + dx / d * s, -1.9, 1.9);
        p.z += dz / d * s;
      }
      place(player.x, player.z);
    },
    face(player) { place(player.x, player.z); },
    // "Detrás tuyo": uno de los de afuera aparece a tu espalda.
    spawnBehind(player, yaw, dist = .95) {
      const p = people.find((q) => q.kind === 'afuera');
      if (!p) return null;
      p.kind = 'pasillo';
      p.x = THREE.MathUtils.clamp(player.x + Math.sin(yaw) * dist, -1.3, 1.3);
      p.z = THREE.MathUtils.clamp(player.z + Math.cos(yaw) * dist, -12.3, 12.3);
      place(player.x, player.z);
      return p;
    },
    // Mover a uno solo, sin flash (romper la regla).
    nudge(p, player, amount, minDist = .75) {
      const dx = player.x - p.x;
      const dz = player.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d <= minDist) return false;
      const s = Math.min(amount, d - minDist);
      p.x += dx / d * s;
      p.z += dz / d * s;
      place(player.x, player.z);
      return true;
    },
    // Un pasajero se convierte en borrado donde estaba parado.
    convert(x, z) {
      const p = people.find((q) => q.kind === 'reserva' && q.hidden);
      if (!p) return;
      p.hidden = false;
      p.x = x;
      p.z = z;
    },
    nearest(player) {
      let best = Infinity;
      for (const p of people) {
        if (!moving(p)) continue;
        best = Math.min(best, Math.hypot(player.x - p.x, player.z - p.z));
      }
      return best;
    },
    nearestPerson(player) {
      let best = null;
      let bd = Infinity;
      for (const p of people) {
        if (!moving(p)) continue;
        const d = Math.hypot(player.x - p.x, player.z - p.z);
        if (d < bd) { bd = d; best = p; }
      }
      return best;
    },
    // Visibilidad: con luz se ven; después queda una imagen retenida que se apaga.
    show(level, glow) {
      mesh.visible = level > .02 || glow > .02;
      material.emissive.setRGB(.16 * glow, .17 * glow, .2 * glow);
    },
  };
}
