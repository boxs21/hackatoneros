import * as THREE from 'three';
import { createVagon, VAGON } from './vagon.js';
import { createOverlay } from './overlay.js';
import { createCelular } from './celular.js';

// Arma el vagón a oscuras dentro de ctx.stage: luces de emergencia, niebla,
// la luz del flash (sale del celular) y la capa de pantalla.
// lit = true: hora punta, luces encendidas y el tren andando (luces del túnel pasan).
export function setupVagon(ctx, { z = 11, yaw = 0, ambient = .05, fogFar = 11, tubeFlicker = false, lit = false, litColor = 0xeef4ff, litPower = 2.2 } = {}) {
  const { camera, stage, scene } = ctx;
  camera.rotation.order = 'YXZ';
  camera.position.set(0, 1.55, z);
  camera.rotation.set(0, yaw, 0);
  scene.background = new THREE.Color(0x000000);
  scene.fog = lit ? new THREE.Fog(0x0d0e10, 8, 40) : new THREE.Fog(0x000000, 1.2, fogFar);

  const vagon = createVagon({ tubeFlicker, lit });
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

  // tren andando: luces del túnel que pasan por las ventanas, techo encendido
  const tunnelLights = [];
  if (lit) {
    hemi.color.setHex(litColor);
    hemi.groundColor.setHex(0x6a6054);
    exitLight.intensity = backLight.intensity = 0;
    for (const z of [-8, 0, 8]) {
      const l = new THREE.PointLight(litColor, litPower, 10, 1);
      l.position.set(0, 2.8, z);
      stage.add(l);
    }
    const mat = new THREE.MeshBasicMaterial({ color: 0xffe2a0 });
    const geo = new THREE.BoxGeometry(.1, .12, .9);
    for (let i = 0; i < 12; i++) {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(i % 2 ? 4.25 : -4.25, 2.1, -15 + i * 2.6);
      tunnelLights.push(m);
      stage.add(m);
    }
    overlay.u.uVig.value = .45;
  }

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
    celular, // para esconderlo mientras todavía no te lo dan (hora punta)
    colliders: vagon.colliders,
    danger: 0, // 0..1, lo pone el estado (radar del celular)
    lie: false, // la última foto muestra a alguien pegado a ti
    lurch: 0, // sacudón del tren (hora punta)
    // luz del flash: 0..1 (lo calcula mechanics/flash.js). flash = el de mechanics/flash.js
    light(level, dt, flash) {
      if (ctx.demo && window.__fdsHold) level = 1; // depurar: flash fijo (solo ?demo=1)
      time += dt;
      const now = performance.now();
      celular.update(camera, dt, flash
        ? { since: flash.since(now), ready: flash.ready, count: flash.count, danger: this.danger, lie: this.lie }
        : { danger: this.danger });
      camera.getWorldDirection(fwd);
      spot.position.copy(celular.led);
      spot.target.position.copy(camera.position).addScaledVector(fwd, 5);
      fill.position.copy(camera.position);
      spot.intensity = level * 7.5;
      fill.intensity = level * .5;
      flickLight.intensity = vagon.update(dt) * 2.2;
      // radar: el celular vibra (sonido de Andy) mientras más cerca, más seguido
      if (this.danger > .3) {
        this.buzzT = (this.buzzT || 0) - dt;
        if (this.buzzT <= 0) {
          ctx.audio.sfx('celular', { volume: .4 + this.danger * .6 });
          this.buzzT = 1.1 - this.danger * .6;
        }
      }
      overlay.u.uTime.value = time;
      if (lit) {
        for (const m of tunnelLights) {
          m.position.z += dt * 24;
          if (m.position.z > 16) m.position.z -= 31.2;
        }
        // vaivén del tren
        camera.rotation.z = Math.sin(time * 1.3) * .006 + Math.sin(time * 3.7) * .002 + this.lurch * .03;
        this.lurch *= Math.max(0, 1 - dt * 3);
      }
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
