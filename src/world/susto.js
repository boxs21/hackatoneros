import * as THREE from 'three';
import { borradoGeometry } from './figura.js';
import { lambert } from './ps1.js';
import { textura } from './texturas.js';

// El borrado que te atrapa: aparece encima tuyo con cara, medio segundo.
export function createScare() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(borradoGeometry(), lambert({ color: 0x8a8b90, emissive: 0x1a1a1e }));
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(.22, .26),
    lambert({ map: textura('borradoCara'), emissive: 0x111111 }),
  );
  face.position.set(0, 1.73, .15);
  group.add(body, face);
  group.visible = false;

  const fwd = new THREE.Vector3();
  return {
    group,
    show(person, cam) {
      if (person) person.hidden = true;
      group.visible = true;
      this.update(0, cam, 0);
    },
    update(dt, cam, t) {
      cam.getWorldDirection(fwd);
      fwd.y = 0;
      fwd.normalize();
      const dist = THREE.MathUtils.lerp(.95, .32, Math.min(1, t * 5));
      group.position.set(cam.position.x + fwd.x * dist, cam.position.y - 1.72, cam.position.z + fwd.z * dist);
      group.position.x += (Math.random() - .5) * .03;
      group.lookAt(cam.position.x, group.position.y, cam.position.z);
      group.rotation.z = Math.sin(t * 40) * .04;
    },
  };
}
