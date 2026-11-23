import * as THREE from 'three';
import { pixelTexture } from './ps1.js';

// El celular en la mano (abajo a la derecha). Se ve siempre, encima de todo:
// - la pantalla muestra la cámara y el botón con la letra F
// - al disparar, sube, la pantalla se pone blanca y queda la "foto" un momento
// - mientras recarga, el botón se ve gris
// La luz del flash sale de su LED.
const W = 32;
const H = 64;

function pixelF(g, x, y, color) {
  g.fillStyle = color;
  g.fillRect(x, y, 1, 5);
  g.fillRect(x, y, 3, 1);
  g.fillRect(x, y + 2, 2, 1);
}

function drawScreen(g, { white, photo, ready, count }) {
  if (white) {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, W, H);
    return;
  }
  g.fillStyle = '#0b0f14';
  g.fillRect(0, 0, W, H);
  // barra de estado: hora y batería
  g.fillStyle = '#9aa3b5';
  g.fillRect(2, 2, 7, 2);
  g.fillRect(24, 2, 5, 2);
  g.fillStyle = count > 6 ? '#e4322b' : '#22a95a';
  g.fillRect(24, 2, Math.max(1, 5 - Math.floor(count / 3)), 2);
  // visor
  if (photo) {
    // la foto recién sacada: gente gris que no debería estar ahí
    g.fillStyle = '#2a2b2f';
    g.fillRect(3, 8, 26, 38);
    g.fillStyle = '#8d8e93';
    for (const [x, h] of [[6, 22], [12, 26], [18, 20], [23, 24]]) {
      g.fillRect(x, 44 - h, 3, h);
      g.fillRect(x, 44 - h - 3, 3, 3);
    }
    g.fillStyle = '#e4322b';
    g.fillRect(4, 9, 2, 2);
  } else {
    g.fillStyle = '#c9c2a8';
    const b = [[3, 8], [26, 8], [3, 43], [26, 43]];
    for (const [x, y] of b) {
      g.fillRect(x, y, 3, 1);
      g.fillRect(x + (x > 10 ? 2 : 0), y + (y > 20 ? -2 : 0), 1, 3);
    }
    g.fillRect(15, 25, 2, 2);
  }
  // botón de disparo con la F
  g.fillStyle = ready ? '#ffffff' : '#4a4f58';
  g.fillRect(11, 50, 10, 10);
  g.fillStyle = '#0b0f14';
  g.fillRect(12, 51, 8, 8);
  g.fillStyle = ready ? '#f2b705' : '#4a4f58';
  g.fillRect(13, 52, 6, 6);
  pixelF(g, 15, 53, '#0b0f14');
}

export function createCelular() {
  const group = new THREE.Group();
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d');
  const tex = pixelTexture(canvas);
  const top = (mat, order) => {
    mat.depthTest = false;
    mat.depthWrite = false;
    mat.fog = false;
    return [mat, order];
  };
  const part = (geo, [mat, order], x, y, z) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.renderOrder = order;
    m.frustumCulled = false;
    group.add(m);
    return m;
  };
  const skin = top(new THREE.MeshBasicMaterial({ color: 0x5a4234 }), 995);
  part(new THREE.BoxGeometry(.085, .06, .035), skin, .006, -.085, -.012);
  part(new THREE.BoxGeometry(.022, .06, .02), skin, -.04, -.045, .004).rotation.z = -.5;
  part(new THREE.BoxGeometry(.074, .148, .012), top(new THREE.MeshBasicMaterial({ color: 0x2a2d33 }), 996), 0, 0, 0);
  const screen = part(new THREE.PlaneGeometry(.064, .13), top(new THREE.MeshBasicMaterial({ map: tex }), 997), 0, 0, .0065);

  const offLow = new THREE.Vector3(.1, -.068, -.26);
  const offHigh = new THREE.Vector3(.06, -.03, -.24);
  const off = new THREE.Vector3();
  const tilt = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const led = new THREE.Vector3();
  let key = '';
  let shown = 0; // 0 = abajo, 1 = arriba

  return {
    group,
    led, // posición mundial del LED (para la luz)
    update(cam, dt, { since = 9, ready = true, count = 0 } = {}) {
      const target = since < .45 ? 1 : 0;
      shown += (target - shown) * Math.min(1, dt * (target ? 22 : 6));
      off.lerpVectors(offLow, offHigh, shown);
      cam.updateMatrixWorld();
      group.position.copy(off).applyMatrix4(cam.matrixWorld);
      euler.set(.18 - shown * .12, -.32 + shown * .22, -.06);
      tilt.setFromEuler(euler);
      group.quaternion.copy(cam.quaternion).multiply(tilt);
      group.scale.setScalar(.78);
      group.updateMatrixWorld();
      led.set(.02, .06, -.01).applyMatrix4(group.matrixWorld);

      const state = { white: since < .13, photo: since >= .13 && since < 1.8, ready, count };
      const k = `${state.white}|${state.photo}|${ready}|${Math.floor(count / 3)}`;
      if (k !== key) {
        key = k;
        drawScreen(g, state);
        tex.needsUpdate = true;
      }
    },
  };
}
