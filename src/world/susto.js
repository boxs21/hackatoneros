import * as THREE from 'three';
import { borradoGeometry } from './figura.js';
import { lambert } from './ps1.js';
import { textura } from './texturas.js';

// El borrado que te atrapa. Tres variantes para que no sea siempre igual:
// - 'frente': aparece encima tuyo de frente.
// - 'atras':  la cámara se da vuelta sola y estaba detrás.
// - 'negro':  todo se va a negro un instante y aparece pegado a tu cara.
// update() devuelve { black } para la capa de pantalla (0..1).
// Seguridad: un solo destello por susto (el estado apaga la luz después).
export const VARIANTES = ['frente', 'atras', 'negro'];
// Se recuerda entre reinicios: cada vez que te atrapan es una variante distinta, en orden.
let nextVariant = 0;

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
  let variant = 'frente';
  let yaw0 = 0;
  return {
    group,
    get variant() { return variant; },
    show(person, cam, v) {
      if (person) person.hidden = true;
      variant = v || VARIANTES[nextVariant++ % VARIANTES.length];
      yaw0 = cam.rotation.y;
      group.visible = variant !== 'negro';
      this.update(0, cam, 0);
    },
    update(dt, cam, t) {
      let black = 0;
      let lunge = t;
      if (variant === 'atras') {
        // la cámara gira 180° en 0,22 s; recién ahí está ahí
        const k = Math.min(1, t / .22);
        cam.rotation.y = yaw0 + Math.PI * (1 - (1 - k) * (1 - k));
        group.visible = k >= 1;
        lunge = Math.max(0, t - .22);
      } else if (variant === 'negro') {
        black = t < .3 ? 1 : 0;
        group.visible = t >= .3;
        lunge = Math.max(0, t - .3) + .15;
      }
      cam.getWorldDirection(fwd);
      fwd.y = 0;
      fwd.normalize();
      const dist = THREE.MathUtils.lerp(.95, .32, Math.min(1, lunge * 5));
      group.position.set(cam.position.x + fwd.x * dist, cam.position.y - 1.72, cam.position.z + fwd.z * dist);
      group.position.x += (Math.random() - .5) * .03;
      group.lookAt(cam.position.x, group.position.y, cam.position.z);
      group.rotation.z = Math.sin(t * 40) * .04;
      return { black };
    },
  };
}

// Susto al ser atrapado: un solo destello cuando aparece la cara, y solo se apaga después.
export function caughtFrame(scene, scare, cam, dt, t) {
  const delay = scare.variant === 'atras' ? .22 : scare.variant === 'negro' ? .3 : 0;
  const { black } = scare.update(dt, cam, t);
  const k = t - delay;
  scene.light(k < 0 ? 0 : k < .12 ? 1 : Math.max(0, .5 - k), dt);
  scene.overlay.u.uBlack.value = black;
  scene.overlay.u.uCaught.value = k < 0 ? 0 : Math.min(1, k * 4);
  return k; // tiempo desde que apareció la cara
}
