import * as THREE from 'three';
import { POLVO_V, POLVO_F, PETALO_V, PETALO_F } from './shaders.js';
import { LUZ } from './haces.js';

// Polvo y pétalos. Viven en su propio grupo (no en ctx.stage): son del motor
// gráfico, como la cámara, y se reutilizan entre momentos.
// Los pétalos tienen cuatro maneras de moverse (aVel.w):
//   sueltos (aNace < 0): se desprenden de los borrados cercanos, en bucle
//   0 caída: alguien se deshizo aquí; caen y quedan un rato en el piso
//   1 viento: la forma de alguien que se va por la ventana; suben con el cielo
//   2 entran: por la ventana rota, planean y se posan en el asiento o el piso
const POLVO = 900;
const SUELTOS = 420; // pétalos que se desprenden de los borrados cercanos
const RAFAGA = 720; // pétalos de las desapariciones (se reciclan en orden)
const ENTRAN = 480; // pétalos que entran por las ventanas rotas
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
  // uHaz: color de los haces del eclipse (ya multiplicado por su fuerza); el polvo
  // que cruza un haz brilla, el resto sigue a oscuras
  const polvoU = { ...comunes, uPx: { value: 500 }, uFoco: { value: 3 }, uCaja: { value: CAJA }, uHaz: { value: new THREE.Vector3() }, uLuz: { value: LUZ } };
  const polvo = new THREE.Points(polvoGeo, new THREE.ShaderMaterial({
    uniforms: polvoU, vertexShader: POLVO_V, fragmentShader: POLVO_F,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  polvo.frustumCulled = false;

  // --- pétalos ---
  const total = SUELTOS + RAFAGA + ENTRAN;
  const base = new THREE.PlaneGeometry(1, 1);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = base.index;
  geo.setAttribute('position', base.attributes.position);
  geo.instanceCount = total;
  const origen = new Float32Array(total * 3);
  const pseed = new Float32Array(total * 4);
  const nace = new Float32Array(total);
  const vel = new Float32Array(total * 4);
  for (let i = 0; i < total; i++) {
    origen[i * 3 + 1] = -50; // bajo el piso hasta que tengan dueño
    for (let k = 0; k < 4; k++) pseed[i * 4 + k] = rnd();
    nace[i] = i < SUELTOS ? -1 : 1e9;
  }
  const aOrigen = new THREE.InstancedBufferAttribute(origen, 3).setUsage(THREE.DynamicDrawUsage);
  const aNace = new THREE.InstancedBufferAttribute(nace, 1).setUsage(THREE.DynamicDrawUsage);
  const aVel = new THREE.InstancedBufferAttribute(vel, 4).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aOrigen', aOrigen);
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(pseed, 4));
  geo.setAttribute('aNace', aNace);
  geo.setAttribute('aVel', aVel);
  // uVentana: la luz de afuera (color del eclipse por cuánto se abrió el cielo)
  const petaloU = { ...comunes, uGlow: { value: 0 }, uVentana: { value: new THREE.Vector3() } };
  const petalos = new THREE.Mesh(geo, new THREE.ShaderMaterial({
    uniforms: petaloU, vertexShader: PETALO_V, fragmentShader: PETALO_F,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  }));
  petalos.frustumCulled = false;
  group.add(polvo, petalos);

  let cursor = 0;
  let cursorE = 0;
  const cerca = [];

  function subir() {
    for (const a of [aOrigen, aNace, aVel]) {
      a.clearUpdateRanges();
      a.needsUpdate = true;
    }
  }
  function poner(i, x, y, z, t, vx, vy, vz, modo) {
    origen[i * 3] = x;
    origen[i * 3 + 1] = y;
    origen[i * 3 + 2] = z;
    nace[i] = t;
    vel[i * 4] = vx;
    vel[i * 4 + 1] = vy;
    vel[i * 4 + 2] = vz;
    vel[i * 4 + 3] = modo;
  }
  function siguiente() {
    const i = SUELTOS + cursor;
    cursor = (cursor + 1) % RAFAGA;
    return i;
  }

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
        poner(siguiente(), p.x + (rnd() - .5) * .36, p.y + .25 + rnd() * 1.5, p.z + (rnd() - .5) * .3, t + rnd() * .5, 0, 0, 0, 0);
      }
      subir();
    },
    // La forma de alguien hecha pétalos (dentro de su caja), que el viento saca
    // por la ventana del lado s. Unos pocos caen adentro, junto al vidrio.
    figura(caja, s, cantidad = 260) {
      const t = comunes.uTime.value;
      const cx = (caja.min.x + caja.max.x) / 2;
      const cz = (caja.min.z + caja.max.z) / 2;
      const ax = Math.min(.35, (caja.max.x - caja.min.x) / 2);
      const az = Math.min(.35, (caja.max.z - caja.min.z) / 2);
      const y0 = caja.min.y;
      const alto = Math.max(.6, Math.min(2, caja.max.y - caja.min.y));
      for (let k = 0; k < cantidad; k++) {
        // repartidos como un cuerpo: más ancho en el torso, angosto arriba y abajo
        const h = rnd();
        const ancho = h > .82 ? .45 : h > .45 ? 1 : .6;
        const a = rnd() * Math.PI * 2;
        const r = Math.sqrt(rnd()) * ancho;
        const x = THREE.MathUtils.clamp(cx + Math.cos(a) * r * ax, -2.4, 2.4);
        const z = cz + Math.sin(a) * r * az;
        const y = y0 + h * alto;
        const cae = k % 7 === 0;
        if (cae) poner(siguiente(), x, y, z, t + rnd() * .2, 0, 0, 0, 0);
        else {
          poner(siguiente(), x, y, z, t + h * .18 + rnd() * .08, // se van de los pies a la cabeza
            s * (1.2 + rnd() * 2.6), .2 + rnd() * 1.1, (rnd() - .35) * 2.2 + 1.2, 1);
        }
      }
      subir();
    },
    // Pétalos que entran por un hoyo del lado s (centro del hoyo en x, y, z).
    // racha > 1: la ráfaga de recién roto, más rápida y hacia adentro.
    entrar(x, y, z, s, cantidad = 1, racha = 1) {
      const t = comunes.uTime.value;
      for (let k = 0; k < cantidad; k++) {
        const i = SUELTOS + RAFAGA + cursorE;
        cursorE = (cursorE + 1) % ENTRAN;
        poner(i, x - s * .05, y + (rnd() - .5) * .7, z + (rnd() - .5) * 1.1, t + (racha > 1 ? rnd() * .9 : 0),
          -s * (.5 + rnd() * 1.1) * racha, -.05 + rnd() * .3 * racha, (rnd() - .5) * .7 * racha + (racha - 1) * .5, 2);
      }
      subir();
    },
    limpiar() {
      for (let i = SUELTOS; i < total; i++) nace[i] = 1e9;
      aNace.clearUpdateRanges();
      aNace.needsUpdate = true;
      this.soltar();
    },
  };
}
