import * as THREE from 'three';
import { POLVO_V, POLVO_F, PETALO_V, PETALO_F } from './shaders.js';

// Polvo y pétalos. Viven en su propio grupo (no en ctx.stage): son del motor
// gráfico, como la cámara, y se reutilizan entre momentos.
const POLVO = 900;
const SUELTOS = 420; // pétalos que se desprenden de los borrados cercanos
const RAFAGA = 360; // pétalos de las desapariciones (se reciclan en orden)
const EMISORES = 40;
const CAJA = new THREE.Vector3(7, 3.2, 9);

export function createParticulas() {
  const group = new THREE.Group();
  group.name = 'gfx:particulas';
  const rnd = Math.random;

  // --- polvo ---
  const pos = new Float32Array(POLVO * 3);
  const seed = new Float32Array(POLVO * 3);
  for (let i = 0; i < POLVO; i++) {
    pos[i * 3] = (rnd() - .5) * CAJA.x;
    pos[i * 3 + 1] = rnd() * CAJA.y;
    pos[i * 3 + 2] = (rnd() - .5) * CAJA.z;
    seed[i * 3] = rnd();
    seed[i * 3 + 1] = rnd();
    seed[i * 3 + 2] = rnd();
  }
  const polvoGeo = new THREE.BufferGeometry();
  polvoGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  polvoGeo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 3));
  const comunes = {
    uTime: { value: 0 },
    uFlash: { value: 0 },
    uAmb: { value: 0 },
    uCam: { value: new THREE.Vector3() },
    uFwd: { value: new THREE.Vector3(0, 0, -1) },
  };
  const polvoU = { ...comunes, uPx: { value: 500 }, uFoco: { value: 3 }, uCaja: { value: CAJA } };
  const polvo = new THREE.Points(polvoGeo, new THREE.ShaderMaterial({
    uniforms: polvoU, vertexShader: POLVO_V, fragmentShader: POLVO_F,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  polvo.frustumCulled = false;

  // --- pétalos ---
  const total = SUELTOS + RAFAGA;
  const base = new THREE.PlaneGeometry(1, 1);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = base.index;
  geo.setAttribute('position', base.attributes.position);
  geo.instanceCount = total;
  const origen = new Float32Array(total * 3);
  const pseed = new Float32Array(total * 4);
  const nace = new Float32Array(total);
  for (let i = 0; i < total; i++) {
    origen[i * 3 + 1] = -50; // bajo el piso hasta que tengan dueño
    for (let k = 0; k < 4; k++) pseed[i * 4 + k] = rnd();
    nace[i] = i < SUELTOS ? -1 : 1e9;
  }
  const aOrigen = new THREE.InstancedBufferAttribute(origen, 3).setUsage(THREE.DynamicDrawUsage);
  const aNace = new THREE.InstancedBufferAttribute(nace, 1).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aOrigen', aOrigen);
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(pseed, 4));
  geo.setAttribute('aNace', aNace);
  const petaloU = { ...comunes, uGlow: { value: 0 } };
  const petalos = new THREE.Mesh(geo, new THREE.ShaderMaterial({
    uniforms: petaloU, vertexShader: PETALO_V, fragmentShader: PETALO_F,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  }));
  petalos.frustumCulled = false;
  group.add(polvo, petalos);

  let cursor = 0;
  const cerca = [];

  return {
    group,
    u: comunes,
    polvoU,
    petaloU,
    // Reparte los pétalos sueltos entre los borrados más cercanos (se llama al
    // disparar el flash, no en cada frame, para que no salten de dueño).
    emitirDesde(mesh, cam) {
      const m = mesh.instanceMatrix.array;
      cerca.length = 0;
      for (let i = 0; i < mesh.count; i++) {
        if (m[i * 16] === 0) continue; // escondido (escala 0)
        const x = m[i * 16 + 12];
        const z = m[i * 16 + 14];
        const d = Math.hypot(x - cam.position.x, z - cam.position.z);
        if (d < 8) cerca.push([d, x, z, m[i * 16 + 5]]);
      }
      cerca.sort((a, b) => a[0] - b[0]);
      const n = Math.min(cerca.length, EMISORES);
      for (let i = 0; i < SUELTOS; i++) {
        if (!n) { origen[i * 3 + 1] = -50; continue; }
        const [, x, z, alto] = cerca[i % n];
        origen[i * 3] = x + (pseed[i * 4 + 2] - .5) * .34;
        origen[i * 3 + 1] = (.45 + pseed[i * 4 + 3] * 1.35) * alto;
        origen[i * 3 + 2] = z + (pseed[i * 4 + 1] - .5) * .3;
      }
      aOrigen.clearUpdateRanges();
      aOrigen.addUpdateRange(0, SUELTOS * 3);
      aOrigen.needsUpdate = true;
    },
    soltar() {
      for (let i = 0; i < SUELTOS; i++) origen[i * 3 + 1] = -50;
      aOrigen.clearUpdateRanges();
      aOrigen.needsUpdate = true;
    },
    // Alguien se deshizo aquí: sus pétalos caen y quedan un rato en el piso.
    rafaga(p, cantidad = 120) {
      const t = comunes.uTime.value;
      for (let k = 0; k < cantidad; k++) {
        const i = SUELTOS + cursor;
        cursor = (cursor + 1) % RAFAGA;
        origen[i * 3] = p.x + (rnd() - .5) * .36;
        origen[i * 3 + 1] = p.y + .25 + rnd() * 1.5;
        origen[i * 3 + 2] = p.z + (rnd() - .5) * .3;
        nace[i] = t + rnd() * .5;
      }
      aOrigen.clearUpdateRanges();
      aNace.clearUpdateRanges();
      aOrigen.needsUpdate = true;
      aNace.needsUpdate = true;
    },
    limpiar() {
      for (let i = SUELTOS; i < total; i++) nace[i] = 1e9;
      aNace.clearUpdateRanges();
      aNace.needsUpdate = true;
      this.soltar();
    },
  };
}
