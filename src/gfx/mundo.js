import * as THREE from 'three';
import { borradoGeometry } from '../world/figura.js';
import { crearCielo } from './cielo.js';

// "El otro lado": lo que hay afuera cuando se corta la luz. El túnel ya no
// está; el vagón quedó detenido sobre un mar quieto, bajo un eclipse.
//  - cielo pintado: nubes en remolino, cortinas de pintura que caen del cenit
//  - el eclipse: disco negro con corona (es la fuente de los rayos de luz)
//  - el mar: espejo del cielo, con bruma en el horizonte
//  - las agujas: una ciudad que cuelga del cielo, en silueta, con luces
//  - los colosos: siluetas enormes y lejanas, de pie en el mar, mirando al tren
//  - los faros: columnas de luz que suben del mar
//  - la carrocería: tapa negra por fuera del vagón, para que el cielo solo
//    entre por las ventanas (sin el túnel, las rendijas del techo brillaban)
//  - la vía: sigue de largo y sube en curva hacia el eclipse
//  - pétalos en el viento
// Nada de esto ilumina el interior: adentro sigue oscuro.
// adelante y a la izquierda (30°): desde donde partes cae en una ventana, no detrás
// de una puerta, y se va viendo por las siguientes al caminar por el pasillo
export const SOL = new THREE.Vector3(-.49, .12, -.85).normalize(); // bajo: desde el pasillo cae dentro de la ventana

const RUIDO = /* glsl */ `
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.03 + 11.7; a *= 0.5; }
  return s;
}`;

const U_GLSL = /* glsl */ `
uniform float uTime, uAbre;
uniform vec3 uCenit, uMedio, uHoriz, uCorona, uSol;`;

// niebla del aire: lo lejano se funde con el color del horizonte
const AIRE = /* glsl */ `
vec3 aire(vec3 col, vec3 w) {
  float f = 1.0 - exp(-length(w - cameraPosition) * 0.006);
  // lo lejano toma el tono del horizonte pero queda más oscuro que el cielo: silueta
  vec3 lejos = mix(uHoriz, uMedio, smoothstep(-5.0, 45.0, w.y)) * 0.32;
  return mix(col, lejos, f) * uAbre * uAbre;
}`;

const TORRE_V = /* glsl */ `
varying vec3 vW, vL, vNl;
varying float vSeed;
void main() {
  vec3 esc = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
  vL = position * esc;
  vNl = normal;
  vSeed = fract(instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.11);
  vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const TORRE_F = /* glsl */ `
${U_GLSL}
varying vec3 vW, vL, vNl;
varying float vSeed;
${RUIDO}
${AIRE}
void main() {
  vec3 col = uCenit * 0.18;
  col += uCorona * pow(max(dot(normalize(vNl), uSol), 0.0), 2.0) * 0.16; // el lado que mira al eclipse
  if (abs(vNl.y) < 0.8) {
    // luces: una grilla alrededor de la aguja, algunas encendidas
    vec2 g = vec2(atan(vL.z, vL.x) * 3.2, vL.y * 0.4);
    vec2 c = floor(g), f = fract(g);
    float on = step(0.8, hash(c + vSeed * 91.0));
    float parpadeo = 0.75 + 0.25 * sin(uTime * (0.4 + hash(c) * 1.3) + hash(c + 5.0) * 30.0);
    float marco = step(0.22, f.x) * step(f.x, 0.78) * step(0.2, f.y) * step(f.y, 0.7);
    col += vec3(1.0, 0.7, 0.36) * on * marco * parpadeo * 1.5;
  }
  col = aire(col, vW);
  // la base (arriba) se pierde entre las nubes
  col = mix(col, mix(uMedio, uCenit, 0.55) * 0.7 * uAbre * uAbre, smoothstep(58.0, 86.0, vW.y));
  gl_FragColor = vec4(col, 1.0);
}`;

const COLOSO_V = /* glsl */ `
varying vec3 vW, vN;
uniform float uTime;
void main() {
  vec3 p = position;
  // respiran: se mecen apenas desde los pies
  float s = fract(instanceMatrix[3].x * 0.13);
  p.x += sin(uTime * 0.22 + s * 6.28) * 0.012 * p.y;
  vec4 w = modelMatrix * instanceMatrix * vec4(p, 1.0);
  vW = w.xyz;
  vN = normalize(mat3(modelMatrix * instanceMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const COLOSO_F = /* glsl */ `
${U_GLSL}
varying vec3 vW, vN;
${AIRE}
void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(cameraPosition - vW);
  vec3 col = uCenit * 0.06;
  // canto de luz: el eclipse los recorta por un lado
  col += uCorona * pow(max(dot(N, uSol), 0.0), 1.5) * 0.5;
  col += uHoriz * pow(1.0 - abs(dot(N, V)), 3.0) * 0.35;
  col = aire(col, vW);
  // los pies se deshacen en la bruma del mar
  col = mix(col, uHoriz * 0.75 * uAbre * uAbre, smoothstep(7.0, -7.0, vW.y));
  gl_FragColor = vec4(col, 1.0);
}`;

const VIA_V = /* glsl */ `
varying vec2 vUv;
varying vec3 vW;
void main() {
  vUv = uv;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const VIA_F = /* glsl */ `
${U_GLSL}
uniform float uLargo;
varying vec2 vUv;
varying vec3 vW;
${AIRE}
void main() {
  float x = abs(vUv.x - 0.5);
  float riel = smoothstep(0.035, 0.015, abs(x - 0.3));
  float durmiente = step(fract(vUv.y * 1.5), 0.3) * step(x, 0.42);
  float a = max(riel, durmiente * 0.9);
  if (a < 0.05) discard;
  vec3 col = mix(uCenit * 0.3, uCorona * 1.6, riel);
  col = aire(col, vW);
  a *= smoothstep(0.0, 6.0, vUv.y) * (1.0 - smoothstep(uLargo - 60.0, uLargo, vUv.y));
  gl_FragColor = vec4(col, a);
}`;

const HOJA_V = /* glsl */ `
attribute vec3 aSeed;
uniform float uTime, uPx;
uniform vec3 uCaja;
varying vec3 vC;
varying float vGiro;
${U_GLSL.replace('uniform float uTime, uAbre;', 'uniform float uAbre;')}
void main() {
  vec3 p = position;
  // viento a lo largo del tren, con remolinos
  p.z += uTime * (1.2 + aSeed.x * 1.6);
  p.x += sin(uTime * 0.3 + aSeed.y * 6.28 + p.z * 0.08) * 1.6;
  p.y += sin(uTime * 0.23 + aSeed.z * 6.28) * 1.2 - uTime * 0.12 * aSeed.z;
  p = cameraPosition + mod(p - cameraPosition + uCaja * 0.5, uCaja) - uCaja * 0.5;
  vec4 mv = viewMatrix * vec4(p, 1.0);
  float dist = max(-mv.z, 0.1);
  float afuera = step(2.75, abs(p.x)); // nunca dentro del vagón
  vec3 carmin = vec3(0.85, 0.06, 0.1), marfil = vec3(1.0, 0.86, 0.8);
  vec3 dir = normalize(p - cameraPosition);
  float luz = 0.85 + 1.6 * pow(max(dot(dir, uSol), 0.0), 3.0); // con color propio: a contraluz parecían escombros
  vC = (aSeed.x < 0.6 ? carmin : marfil) * luz * uAbre * afuera * (1.0 - smoothstep(18.0, 26.0, dist));
  vC += uCorona * 0.25 * luz * uAbre * afuera * step(0.9, aSeed.y);
  vGiro = uTime * (1.0 + aSeed.y * 3.0) + aSeed.z * 6.28;
  gl_PointSize = clamp(uPx * 0.085 * (0.5 + aSeed.z) / dist, 1.5, 18.0);
  gl_Position = projectionMatrix * mv;
}`;

const HOJA_F = /* glsl */ `
varying vec3 vC;
varying float vGiro;
void main() {
  vec2 q = gl_PointCoord - 0.5;
  float cs = cos(vGiro), sn = sin(vGiro);
  q = vec2(q.x * cs - q.y * sn, q.x * sn + q.y * cs);
  q.y /= 0.35 + 0.65 * abs(sin(vGiro * 0.7));
  if (length(q * vec2(1.6, 1.0)) > 0.5 || dot(vC, vec3(1.0)) < 0.004) discard;
  gl_FragColor = vec4(vC, 1.0);
}`;

export function createMundo() {
  const group = new THREE.Group();
  group.name = 'gfx:mundo';
  const u = {
    uTime: { value: 0 },
    uAbre: { value: 0 },
    uCenit: { value: new THREE.Vector3(.01, .02, .1) },
    uMedio: { value: new THREE.Vector3(.1, .03, .22) },
    uHoriz: { value: new THREE.Vector3(.75, .12, .1) },
    uCorona: { value: new THREE.Vector3(1, .62, .3) },
    uSol: { value: SOL },
  };
  const rnd = (() => { let s = 23; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();

  // cielo y mar, con profundidad (cielo.js)
  const { domo, luna, postes } = crearCielo(u);

  // la ciudad colgando
  // agujas colgantes: anchas arriba, en punta hacia abajo. Lejos y nunca delante del eclipse.
  const N_TORRES = 46;
  const torres = new THREE.InstancedMesh(new THREE.CylinderGeometry(.5, .05, 1, 5, 1).translate(0, -.5, 0),
    new THREE.ShaderMaterial({ uniforms: u, vertexShader: TORRE_V, fragmentShader: TORRE_F }), N_TORRES);
  const o = new THREE.Object3D();
  const azSol = Math.atan2(SOL.z, SOL.x);
  for (let i = 0; i < N_TORRES; i++) {
    let a = rnd() * Math.PI * 2;
    while (Math.abs(Math.atan2(Math.sin(a - azSol), Math.cos(a - azSol))) < .62) a = rnd() * Math.PI * 2;
    const r = 82 + rnd() * 68;
    const ancho = 7 + rnd() * 9;
    o.position.set(Math.cos(a) * r, 88, Math.sin(a) * r);
    o.rotation.set(0, rnd() * Math.PI, 0);
    o.scale.set(ancho, 30 + rnd() * 40, ancho * (.8 + rnd() * .4));
    o.updateMatrix();
    torres.setMatrixAt(i, o.matrix);
  }
  torres.frustumCulled = false;

  // los colosos
  const N_COLOSOS = 5;
  // lejos y de cuerpo entero: la cintura a ras del mar, la cabeza bajo el borde de la ventana
  const DONDE = [-.95, -.4, .2, .78, Math.PI - .75];
  const colosos = new THREE.InstancedMesh(borradoGeometry(),
    new THREE.ShaderMaterial({ uniforms: u, vertexShader: COLOSO_V, fragmentShader: COLOSO_F }), N_COLOSOS);
  for (let i = 0; i < N_COLOSOS; i++) {
    // repartidos a los lados del tren (por las ventanas se mira hacia ±x)
    const a = DONDE[i] + (rnd() - .5) * .12;
    const r = 132 + rnd() * 26;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const escala = 31 + rnd() * 8;
    o.position.set(x, -.42 * 1.88 * escala, z);
    o.rotation.set(0, Math.atan2(-x, -z), (rnd() - .5) * .06);
    o.scale.setScalar(escala);
    o.updateMatrix();
    colosos.setMatrixAt(i, o.matrix);
  }
  colosos.frustumCulled = false;

  // la vía que sube hacia el eclipse
  const curva = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -1, -13.5), new THREE.Vector3(0, -1, -34), new THREE.Vector3(-4, 1, -62),
    new THREE.Vector3(-14, 6, -90), new THREE.Vector3(-32, 14, -114), new THREE.Vector3(-56, 24, -134),
    new THREE.Vector3(-84, 34, -148),
  ]);
  const SEG = 260;
  const pos = new Float32Array((SEG + 1) * 6);
  const uv = new Float32Array((SEG + 1) * 4);
  const idx = [];
  const p = new THREE.Vector3();
  const t = new THREE.Vector3();
  const lado = new THREE.Vector3();
  const prev = new THREE.Vector3();
  let largo = 0;
  for (let i = 0; i <= SEG; i++) {
    curva.getPointAt(i / SEG, p);
    curva.getTangentAt(i / SEG, t);
    if (i) largo += p.distanceTo(prev);
    prev.copy(p);
    lado.set(t.z, 0, -t.x).normalize().multiplyScalar(1.5);
    pos.set([p.x - lado.x, p.y, p.z - lado.z, p.x + lado.x, p.y, p.z + lado.z], i * 6);
    uv.set([0, largo, 1, largo], i * 4);
    if (i < SEG) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  }
  const viaGeo = new THREE.BufferGeometry();
  viaGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  viaGeo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  viaGeo.setIndex(idx);
  const via = new THREE.Mesh(viaGeo, new THREE.ShaderMaterial({
    uniforms: { ...u, uLargo: { value: largo } }, vertexShader: VIA_V, fragmentShader: VIA_F,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  }));
  via.frustumCulled = false;

  // pétalos en el viento
  const N_HOJAS = 1600;
  const caja = new THREE.Vector3(52, 22, 52);
  const hp = new Float32Array(N_HOJAS * 3);
  const hs = new Float32Array(N_HOJAS * 3);
  for (let i = 0; i < N_HOJAS; i++) {
    hp.set([(rnd() - .5) * caja.x, (rnd() - .5) * caja.y, (rnd() - .5) * caja.z], i * 3);
    hs.set([rnd(), rnd(), rnd()], i * 3);
  }
  const hojaGeo = new THREE.BufferGeometry();
  hojaGeo.setAttribute('position', new THREE.BufferAttribute(hp, 3));
  hojaGeo.setAttribute('aSeed', new THREE.BufferAttribute(hs, 3));
  const hojaU = { ...u, uPx: { value: 500 }, uCaja: { value: caja } };
  const hojas = new THREE.Points(hojaGeo, new THREE.ShaderMaterial({
    uniforms: hojaU, vertexShader: HOJA_V, fragmentShader: HOJA_F,
  }));
  hojas.frustumCulled = false;

  // carrocería: lo que antes tapaba el túnel. Negro puro, pegado por fuera.
  const negro = new THREE.MeshBasicMaterial({ color: 0x000000, fog: false });
  const tapa = (w, h, d, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), negro);
    m.position.set(x, y, z);
    group.add(m);
  };
  for (const s of [-1, 1]) {
    tapa(.1, 1.2, 26.6, s * 2.63, 3.04, 0); // sobre las ventanas, hasta el techo
    for (const dz of [-8, 0, 8]) tapa(.1, .34, 1.7, s * 2.63, 2.31, dz); // sobre cada puerta
    tapa(5.5, 3.9, .1, 0, 1.7, s * 13.14); // extremos
  }
  tapa(5.5, .1, 26.6, 0, 3.4, 0); // techo
  tapa(5.5, .1, 26.6, 0, -.2, 0); // bajo el piso

  group.add(domo, luna, postes, torres, colosos, via, hojas);
  return { group, u, hojaU };
}
