import * as THREE from 'three';
import { createVagon, VAGON } from './vagon.js';
import { createOverlay } from './overlay.js';
import { createCelular } from './celular.js';

// Arma el vagón a oscuras dentro de ctx.stage: luces de emergencia, niebla,
// la luz del flash (sale del celular) y la capa de pantalla.
export function setupVagon(ctx, { z = 11, yaw = 0, ambient = .05, fogFar = 11, tubeFlicker = false } = {}) {
  const { camera, stage, scene } = ctx;
  camera.rotation.order = 'YXZ';
  camera.position.set(0, 1.55, z);
  camera.rotation.set(0, yaw, 0);
  scene.background = new THREE.Color(0x000000);
  scene.fog = new THREE.Fog(0x000000, 1.2, fogFar);

  const vagon = createVagon({ tubeFlicker });
  const hemi = new THREE.HemisphereLight(0x8aa0c8, 0x2a2018, ambient);
  // rojo tenue en las puertas de los extremos: la única referencia en la oscuridad
  const exitLight = new THREE.PointLight(0xff3020, 1.6, 7, 1);
  exitLight.position.set(0, 2.3, VAGON.endDoorZ + .5);
  const backLight = new THREE.PointLight(0xff3020, .6, 5, 1);
  backLight.position.set(0, 2.3, VAGON.halfL - .5);
  // el flash: un cono fuerte + un relleno corto
  const spot = new THREE.SpotLight(0xfff6e8, 0, 18, .78, .55, 1);
  const fill = new THREE.PointLight(0xfff6e8, 0, 4, 1);
  stage.add(spot.target);
  // tubo que parpadea (si hay)
  const flickLight = new THREE.PointLight(0xd8f0ff, 0, 6, 1);
  flickLight.position.copy(vagon.flickPos).y -= .2;

  const overlay = createOverlay();
  const celular = createCelular();
  stage.add(celular.group, vagon.group, hemi, exitLight, backLight, spot, fill, flickLight, overlay.mesh);

  // Click en el canvas: capturar el mouse y desbloquear el audio (modo demo salta el inicio).
  const onDown = () => {
    ctx.input.lockPointer();
    ctx.audio.unlock?.().catch?.((err) => console.error('[audio] unlock', err));
  };
  ctx.canvas.addEventListener('mousedown', onDown);

  const fwd = new THREE.Vector3();
  let time = 0;
  return {
    vagon,
    overlay,
    colliders: vagon.colliders,
    // luz del flash: 0..1 (lo calcula mechanics/flash.js). flash = el de mechanics/flash.js
    light(level, dt, flash) {
      if (ctx.demo && window.__fdsHold) level = 1; // depurar: flash fijo (solo ?demo=1)
      time += dt;
      const now = performance.now();
      celular.update(camera, dt, flash ? { since: flash.since(now), ready: flash.ready, count: flash.count } : {});
      camera.getWorldDirection(fwd);
      spot.position.copy(celular.led);
      spot.target.position.copy(camera.position).addScaledVector(fwd, 5);
      fill.position.copy(camera.position);
      spot.intensity = level * 9;
      fill.intensity = level * 1.5;
      flickLight.intensity = vagon.update(dt) * 2.2;
      overlay.u.uTime.value = time;
    },
    dispose() {
      ctx.canvas.removeEventListener('mousedown', onDown);
    },
  };
}

// Caminar en primera persona dentro del pasillo, con choques contra barras y gente.
const STEP = { bob: 0 };
export function walkVagon(dt, { camera, input }, { colliders = [], speed = 2.3, minZ = -12.4, maxZ = 12.4 } = {}) {
  camera.rotation.order = 'YXZ';
  const turn = Number(input.down('ArrowLeft')) - Number(input.down('ArrowRight'));
  camera.rotation.y += turn * dt * 2.2 - input.mouse.dx * .0022;
  camera.rotation.x = THREE.MathUtils.clamp(camera.rotation.x - input.mouse.dy * .0022, -1.1, 1.1);

  const forward = Number(input.down('KeyW') || input.down('ArrowUp')) - Number(input.down('KeyS') || input.down('ArrowDown'));
  const right = Number(input.down('KeyD')) - Number(input.down('KeyA'));
  const len = Math.hypot(forward, right);
  const run = len ? speed * dt / len : 0;
  const yaw = camera.rotation.y;
  const ox = camera.position.x;
  const oz = camera.position.z;
  let x = ox + run * (right * Math.cos(yaw) - forward * Math.sin(yaw));
  let z = oz - run * (forward * Math.cos(yaw) + right * Math.sin(yaw));
  for (const c of colliders) {
    const dx = x - c.x;
    const dz = z - c.z;
    const d = Math.hypot(dx, dz);
    const min = c.r + .22;
    if (d < min && d > 1e-4) {
      x = c.x + dx / d * min;
      z = c.z + dz / d * min;
    }
  }
  x = THREE.MathUtils.clamp(x, -VAGON.aisle, VAGON.aisle);
  z = THREE.MathUtils.clamp(z, minZ, maxZ);
  camera.position.x = x;
  camera.position.z = z;
  const moved = Math.hypot(x - ox, z - oz);
  STEP.bob += moved * 5.5;
  const target = 1.55 + (moved > 1e-4 ? Math.sin(STEP.bob) * .035 : 0);
  camera.position.y += (target - camera.position.y) * Math.min(1, dt * 14);
  return moved;
}
