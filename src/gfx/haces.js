import * as THREE from 'three';
import { SOL } from './mundo.js';

// Haces: la luz del eclipse entrando por las ventanas como volumen en el aire.
// No ilumina nada (no es una luz de three): es aire encendido que se suma al
// cuadro. Nace en el vidrio, baja en diagonal hacia el pasillo y se apaga antes
// de llegar al piso o al centro del pasillo, así que no revela nada.
//
// Cada haz es una caja oblicua: origen en la ventana, ancho a lo largo del
// vidrio, alto de la ventana y largo en la dirección de la luz. El fragmento
// camina el rayo de la cámara dentro de la caja y suma polvo encendido; el rayo
// se corta donde hay algo (profundidad de la escena), así lo de adelante tapa.
//
// Se dibuja aparte, a media resolución, y se suma al cuadro después del piso
// mojado: si fuera parte de la escena, el piso lo reflejaría y quedaría a la vista.
//
// Los hoyos de las ventanas rotas tienen su propio haz, más fuerte: la luz
// entra por la herida.

const PANOS = 8; // dos paños por tramo, un solo lado (el del eclipse)
const HOYOS = 4;
const TOTAL = PANOS + HOYOS;
const TRAMOS = [[-12.9, -8.75], [-7.25, -0.75], [0.75, 7.25], [8.75, 12.9]];
const MURO = 2.47; // cara interior del vidrio
const VID_Y = [1.38, 2.42];
const LARGO = 4.2;
// la luz viaja al revés del sol
export const LUZ = SOL.clone().negate();

const HAZ_V = /* glsl */ `
attribute vec3 aO, aU, aV, aW, aR0, aR1, aR2;
attribute float aI;
varying vec3 vP;
varying vec3 vO, vU, vV, vW, vR0, vR1, vR2;
varying float vI;
void main() {
  vec3 p = aO + position.x * aU + position.y * aV + position.z * aW;
  vP = p;
  vO = aO; vU = aU; vV = aV; vW = aW; vI = aI;
  vR0 = aR0; vR1 = aR1; vR2 = aR2;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;

const HAZ_F = /* glsl */ `
uniform vec3 uColor, uFwd;
uniform float uFuerza, uNear, uFar;
uniform vec2 uRes;
uniform sampler2D tDepth;
varying vec3 vP;
varying vec3 vO, vU, vV, vW, vR0, vR1, vR2;
varying float vI;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
void main() {
  if (vI < 0.001) discard;
  mat3 M = mat3(vU, vV, vW);
  mat3 Mi = transpose(mat3(vR0, vR1, vR2)); // la inversa, calculada en la CPU (filas)
  vec3 dir = normalize(vP - cameraPosition);
  vec3 lo = Mi * (cameraPosition - vO);
  vec3 ld = Mi * dir;
  // entrada y salida de la caja [0,1]³
  vec3 inv = 1.0 / ld;
  vec3 t0 = (vec3(0.0) - lo) * inv, t1 = (vec3(1.0) - lo) * inv;
  vec3 tmin = min(t0, t1), tmax = max(t0, t1);
  float ta = max(max(tmin.x, tmin.y), max(tmin.z, 0.0));
  float tb = min(tmax.x, min(tmax.y, tmax.z));
  // cada píxel tiene dos caras (entrada y salida): cuenta una sola. Si la cámara
  // está afuera, la de entrada; si está adentro, la única que hay (la de salida).
  float tEntra = max(max(tmin.x, tmin.y), tmin.z);
  float tAqui = length(vP - cameraPosition);
  if (tEntra > 0.0 && abs(tAqui - tEntra) > abs(tAqui - tb)) discard;
  // lo que está adelante corta el haz
  float dz = texture2D(tDepth, gl_FragCoord.xy / uRes).x * 2.0 - 1.0;
  float zv = 2.0 * uNear * uFar / (uFar + uNear - dz * (uFar - uNear));
  tb = min(tb, zv / max(dot(dir, uFwd), 0.05));
  if (tb <= ta) discard;
  const int N = 10;
  float paso = (tb - ta) / float(N);
  float jit = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  float largo = length(vW);
  float ancho = length(vU);
  float acc = 0.0;
  for (int i = 0; i < N; i++) {
    float t = ta + (float(i) + jit) * paso;
    vec3 q = lo + ld * t;
    vec3 w = vO + M * q;
    // bordes suaves del paño; vetas fijas (vidrio sucio, marcos), sin moverse
    float borde = smoothstep(0.0, 0.08, q.x) * smoothstep(1.0, 0.92, q.x) * smoothstep(0.0, 0.12, q.y) * smoothstep(1.0, 0.88, q.y);
    // rayos sueltos, no una cortina: el vidrio sucio deja pasar la luz a vetas
    float veta = 0.12 + 0.88 * smoothstep(0.42, 0.82, vnoise(vec2(q.x * ancho * 4.5, q.y * 1.2 + q.x * 3.0)));
    // nace en el vidrio y se apaga a lo largo del haz
    float largoF = smoothstep(0.0, 0.03, q.z) * pow(1.0 - q.z, 1.25);
    // nunca toca el piso ni el centro del pasillo
    float alto = smoothstep(0.95, 1.45, w.y);
    float pasillo = smoothstep(0.55, 1.35, abs(w.x));
    float adentro = step(abs(w.z), 12.85) * step(abs(w.x), 2.48);
    acc += borde * veta * largoF * alto * pasillo * adentro;
  }
  // distancia recorrida en metros (la caja no es unitaria)
  float metros = (tb - ta) * length(M * ld);
  float d = acc / float(N) * metros;
  // se satura suave: desde adentro del haz no se vuelve una niebla que lo tape todo
  vec3 c = uColor * (1.0 - exp(-d * uFuerza * vI)) * 0.2; // tope bajo: son aire, no una linterna
  gl_FragColor = vec4(c, 1.0);
}`;

export function createHaces() {
  const caja = new THREE.BoxGeometry(1, 1, 1).translate(.5, .5, .5);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = caja.index;
  geo.setAttribute('position', caja.attributes.position);
  const arr = (n) => new Float32Array(TOTAL * n);
  const A = { aO: arr(3), aU: arr(3), aV: arr(3), aW: arr(3), aR0: arr(3), aR1: arr(3), aR2: arr(3), aI: arr(1) };
  const m3 = new THREE.Matrix3();
  // filas de la inversa de [U V W] para el haz i (se llama solo al armar)
  function invertir(i) {
    const u = A.aU.subarray(i * 3, i * 3 + 3);
    const v = A.aV.subarray(i * 3, i * 3 + 3);
    const w = A.aW.subarray(i * 3, i * 3 + 3);
    m3.set(u[0], v[0], w[0], u[1], v[1], w[1], u[2], v[2], w[2]).invert();
    const e = m3.elements; // por columnas
    A.aR0.set([e[0], e[3], e[6]], i * 3);
    A.aR1.set([e[1], e[4], e[7]], i * 3);
    A.aR2.set([e[2], e[5], e[8]], i * 3);
  }
  const attr = {};
  for (const [k, a] of Object.entries(A)) {
    attr[k] = new THREE.InstancedBufferAttribute(a, a.length / TOTAL).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute(k, attr[k]);
  }

  // paños de ventana del lado del eclipse (x < 0), con los marcos del medio
  const lado = Math.sign(SOL.x) || -1;
  let i = 0;
  for (const [a, b] of TRAMOS) {
    const mid = (a + b) / 2;
    for (const [za, zb] of [[a + .1, mid - .06], [mid + .06, b - .1]]) {
      A.aO.set([lado * MURO, VID_Y[0], za], i * 3);
      A.aU.set([0, 0, zb - za], i * 3);
      A.aV.set([0, VID_Y[1] - VID_Y[0], 0], i * 3);
      A.aW.set([LUZ.x * LARGO, LUZ.y * LARGO, LUZ.z * LARGO], i * 3);
      A.aI[i] = .8 + .2 * ((i * 7) % 3) / 2; // no todos los vidrios igual de limpios
      invertir(i);
      i++;
    }
  }
  geo.instanceCount = PANOS;

  const u = {
    uColor: { value: new THREE.Vector3(1, .62, .3) },
    uFuerza: { value: 0 },
    uFwd: { value: new THREE.Vector3() },
    uNear: { value: .05 },
    uFar: { value: 200 },
    uRes: { value: new THREE.Vector2(1, 1) },
    tDepth: { value: null },
  };
  const mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({
    uniforms: u, vertexShader: HAZ_V, fragmentShader: HAZ_F,
    transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  }));
  mesh.frustumCulled = false;
  mesh.name = 'gfx:haces';
  mesh.visible = false;
  const escena = new THREE.Scene();
  escena.add(mesh);

  // lienzo propio a media resolución y la pasada que lo suma al cuadro
  const lienzo = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, depthBuffer: false });
  const tri = new THREE.BufferGeometry();
  tri.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  tri.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));
  const sumar = new THREE.Mesh(tri, new THREE.ShaderMaterial({
    uniforms: { tHaz: { value: lienzo.texture } },
    vertexShader: 'varying vec2 vUv;\nvoid main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: 'varying vec2 vUv;\nuniform sampler2D tHaz;\nvoid main() { gl_FragColor = vec4(texture2D(tHaz, vUv).rgb, 1.0); }',
    depthTest: false, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending,
  }));
  sumar.frustumCulled = false;
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const negro = new THREE.Color(0, 0, 0);
  const antes = new THREE.Color();

  const dirHoyo = new THREE.Vector3();
  const puestos = new Float64Array(HOYOS).fill(NaN); // z de cada hoyo ya armado
  return {
    mesh,
    u,
    // Dibuja los haces y los suma a "destino" (sin profundidad). depth: la de la escena.
    dibujar(renderer, camera, depth, destino) {
      const w = Math.max(2, destino.width >> 1);
      const h = Math.max(2, destino.height >> 1);
      if (lienzo.width !== w || lienzo.height !== h) lienzo.setSize(w, h);
      u.uRes.value.set(w, h);
      u.tDepth.value = depth;
      u.uNear.value = camera.near;
      u.uFar.value = camera.far;
      camera.getWorldDirection(u.uFwd.value);
      renderer.getClearColor(antes);
      const alfa = renderer.getClearAlpha();
      renderer.setClearColor(negro, 1);
      renderer.setRenderTarget(lienzo);
      renderer.clear();
      renderer.render(escena, camera);
      renderer.setClearColor(antes, alfa);
      const auto = renderer.autoClear;
      renderer.autoClear = false;
      renderer.setRenderTarget(destino);
      renderer.render(sumar, quadCam);
      renderer.autoClear = auto;
    },
    // Los hoyos de esta escena: [{ x, y, z, s, edad }]. Se llama cada frame, sin crear nada.
    hoyos(lista, n) {
      let cambio = geo.instanceCount !== PANOS + n;
      for (let k = 0; k < HOYOS; k++) {
        const j = PANOS + k;
        const h = k < n ? lista[k] : null;
        if (!h) { puestos[k] = NaN; continue; }
        // la luz de la herida aparece en segundo y medio, sin saltos
        const fuerte = 1.7 * THREE.MathUtils.smoothstep(h.edad, 0, 1.5);
        if (Math.abs(A.aI[j] - fuerte) > .005) {
          A.aI[j] = fuerte;
          cambio = true;
        }
        if (puestos[k] === h.z + h.s * 100) continue;
        puestos[k] = h.z + h.s * 100;
        // por el lado del eclipse entra el sol; por el otro, el resplandor del cielo
        if (h.s === lado) dirHoyo.copy(LUZ);
        else dirHoyo.set(-h.s * .78, -.32, .3).normalize();
        A.aO.set([h.s * MURO, h.y - .42, h.z - .5], j * 3);
        A.aU.set([0, 0, 1], j * 3);
        A.aV.set([0, .84, 0], j * 3);
        A.aW.set([dirHoyo.x * 2.4, dirHoyo.y * 2.4, dirHoyo.z * 2.4], j * 3);
        invertir(j);
        cambio = true;
      }
      if (cambio) {
        geo.instanceCount = PANOS + n;
        for (const a of Object.values(attr)) a.needsUpdate = true;
      }
    },
  };
}
