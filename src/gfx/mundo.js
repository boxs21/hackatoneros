import * as THREE from 'three';
import { borradoGeometry } from '../world/figura.js';

// "El otro lado": lo que hay afuera cuando se corta la luz. El túnel ya no
// está; el vagón quedó detenido sobre un mar quieto, bajo un eclipse.
//  - cielo pintado: nubes en remolino, cortinas de pintura que caen del cenit
//  - el eclipse: disco negro con corona (es la fuente de los rayos de luz)
//  - el mar: espejo del cielo, con bruma en el horizonte
//  - la ciudad colgando: torres al revés, con ventanas encendidas
//  - los colosos: siluetas enormes en la bruma, mirando hacia el tren
//  - la vía: sigue de largo y sube en curva hacia el eclipse
//  - pétalos en el viento
// Nada de esto ilumina el interior: adentro sigue oscuro.
export const SOL = new THREE.Vector3(-.82, .2, -.45).normalize();

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

const DOMO_V = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = (projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0)).xyww;
}`;

const DOMO_F = /* glsl */ `
${U_GLSL}
varying vec3 vDir;
${RUIDO}
const float R = 0.085;
vec3 cielo(vec3 d) {
  float h = max(d.y, 0.0);
  vec3 col = mix(uHoriz, uMedio, smoothstep(0.0, 0.26, h));
  col = mix(col, uCenit, smoothstep(0.16, 0.8, h));
  float cs = dot(d, uSol);
  float ang = acos(clamp(cs, -1.0, 1.0));
  float cerca = pow(max(cs, 0.0), 4.0);

  // estrellas, arriba
  float az = atan(d.x, d.z);
  vec2 cir = normalize(d.xz + vec2(1e-5)); // rumbo sin costura (el ángulo salta en ±π)
  vec2 sp = vec2(az * 46.0, h * 70.0);
  float st = step(0.991, hash(floor(sp))) * smoothstep(0.22, 0.55, h);
  col += vec3(0.85, 0.92, 1.0) * st * (0.6 + 0.4 * sin(uTime * 2.0 + hash(floor(sp) + 3.0) * 40.0));

  // cortinas de pintura que caen del cenit, más vivas hacia el eclipse
  float tira = pow(smoothstep(0.5, 0.92, vnoise(cir * 10.0 + 4.0)), 2.0);
  float largo = 0.3 + 0.55 * vnoise(cir * 2.5 + 9.0 + uTime * 0.02);
  float cortina = tira * smoothstep(1.0 - largo, 1.0 - largo + 0.3, h);
  col += uCorona * cortina * (0.12 + 0.5 * cerca);

  // nubes en remolino, como pinceladas; el borde que mira al eclipse se enciende
  vec2 uv = d.xz / (h + 0.22);
  vec2 w = vec2(fbm(uv * 0.7 + uTime * 0.012), fbm(uv * 0.7 + 7.3 - uTime * 0.01));
  float n = fbm(uv * 1.1 + w * 1.7);
  float nube = smoothstep(0.42, 0.68, n) * smoothstep(0.0, 0.05, h);
  float borde = 1.0 - smoothstep(0.46, 0.66, n);
  vec3 cnube = mix(uCenit * 0.5 + uMedio * 0.14, uCorona * 1.3 + uHoriz * 0.8, max(cerca, 0.12) * (0.2 + 0.8 * borde));
  col = mix(col, cnube, nube * 0.93);

  // el eclipse: corona con hilos y disco negro
  vec3 ex = normalize(cross(uSol, vec3(0.0, 1.0, 0.0)));
  vec3 ey = cross(ex, uSol);
  float pa = atan(dot(d, ey), dot(d, ex));
  float hilos = 0.55 + 0.45 * vnoise(vec2(pa * 6.0, uTime * 0.15)) + 0.5 * pow(vnoise(vec2(pa * 21.0, 3.0 + uTime * 0.1)), 3.0);
  float fuera = max(ang - R, 0.0);
  col += uCorona * (exp(-fuera * 8.0) * hilos * 0.6 + exp(-fuera * 60.0) * 2.6);
  col = mix(vec3(0.0), col, smoothstep(R - 0.005, R, ang));

  // la cordillera: tres filas de cerros; la más lejana es la más alta y clara
  for (int k = 0; k < 3; k++) {
    float fk = float(k);
    float alto = (0.115 - 0.034 * fk) * (0.45 + 1.1 * fbm(cir * (2.6 + fk * 1.7) + fk * 13.0));
    float m = smoothstep(alto + 0.004, alto - 0.004, d.y);
    vec3 cerro = mix(mix(uHoriz, uMedio, 0.45) * 0.62, uCenit * 0.4 + uMedio * 0.1, fk * 0.5);
    cerro += uCorona * cerca * 0.35 * smoothstep(alto - 0.03, alto, d.y); // el filo que mira al eclipse
    col = mix(col, cerro, m);
  }
  return col;
}
void main() {
  vec3 d = normalize(vDir);
  vec3 col;
  if (d.y >= 0.0) {
    col = cielo(d);
  } else {
    // el mar: refleja el cielo con un oleaje lento
    float prof = -d.y;
    vec2 q = d.xz / (prof + 0.05) * 3.0;
    vec2 rip = vec2(vnoise(q + uTime * 0.2), vnoise(q + 5.0 - uTime * 0.17)) - 0.5;
    vec3 r = normalize(vec3(d.x + rip.x * 0.06, prof + abs(rip.y) * 0.02, d.z + rip.y * 0.06));
    col = cielo(r) * mix(0.8, 0.28, smoothstep(0.0, 0.6, prof));
  }
  col = mix(col, uHoriz * 1.15, exp(-abs(d.y) * 38.0) * 0.6);
  // se abre desde el eclipse hacia afuera
  float ang = acos(clamp(dot(d, uSol), -1.0, 1.0));
  col *= clamp(uAbre * 2.7 - ang * 0.55, 0.0, 1.0);
  gl_FragColor = vec4(col, 1.0);
}`;

// niebla del aire: lo lejano se funde con el color del horizonte
const AIRE = /* glsl */ `
vec3 aire(vec3 col, vec3 w) {
  float f = 1.0 - exp(-length(w - cameraPosition) * 0.007);
  vec3 lejos = mix(uHoriz, uMedio, smoothstep(-5.0, 45.0, w.y));
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
  vec3 col = uCenit * 0.35 + uMedio * 0.06;
  if (abs(vNl.y) < 0.5) {
    // ventanas: una grilla por cara, algunas encendidas
    float u = abs(vNl.x) > abs(vNl.z) ? vL.z : vL.x;
    vec2 g = vec2(u * 0.85, vL.y * 0.55);
    vec2 c = floor(g), f = fract(g);
    float on = step(0.8, hash(c + vSeed * 91.0));
    float parpadeo = 0.75 + 0.25 * sin(uTime * (0.4 + hash(c) * 1.3) + hash(c + 5.0) * 30.0);
    float marco = step(0.22, f.x) * step(f.x, 0.78) * step(0.2, f.y) * step(f.y, 0.7);
    col += vec3(1.0, 0.7, 0.36) * on * marco * parpadeo * 1.8;
  }
  col = aire(col, vW);
  // la base (arriba) se pierde entre las nubes
  col = mix(col, uMedio * 0.55 * uAbre * uAbre, smoothstep(46.0, 74.0, vW.y));
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
  vec3 col = uCenit * 0.1;
  // canto de luz: el eclipse los recorta por un lado
  col += uCorona * pow(max(dot(N, uSol), 0.0), 1.5) * 0.5;
  col += uHoriz * pow(1.0 - abs(dot(N, V)), 3.0) * 0.35;
  col = aire(col, vW);
  // los pies se deshacen en la bruma del mar
  col = mix(col, uHoriz * 1.1 * uAbre * uAbre, smoothstep(14.0, -6.0, vW.y));
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
  float luz = 0.22 + 1.5 * pow(max(dot(dir, uSol), 0.0), 3.0);
  vC = (aSeed.x < 0.6 ? carmin : marfil) * luz * uAbre * afuera * (1.0 - smoothstep(18.0, 26.0, dist));
  vC += uCorona * 0.25 * luz * uAbre * afuera * step(0.9, aSeed.y);
  vGiro = uTime * (1.0 + aSeed.y * 3.0) + aSeed.z * 6.28;
  gl_PointSize = clamp(uPx * 0.11 * (0.5 + aSeed.z) / dist, 1.5, 26.0);
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

  // cielo y mar
  const domo = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), new THREE.ShaderMaterial({
    uniforms: u, vertexShader: DOMO_V, fragmentShader: DOMO_F, side: THREE.BackSide, depthWrite: false,
  }));
  domo.frustumCulled = false;
  domo.renderOrder = 10; // al final de lo opaco: solo pinta donde se ve el cielo

  // la ciudad colgando
  const N_TORRES = 76;
  const torres = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, -.5, 0),
    new THREE.ShaderMaterial({ uniforms: u, vertexShader: TORRE_V, fragmentShader: TORRE_F }), N_TORRES);
  const o = new THREE.Object3D();
  for (let i = 0; i < N_TORRES; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 42 + rnd() * 100;
    const ancho = 4 + rnd() * 7;
    o.position.set(Math.cos(a) * r, 78, Math.sin(a) * r);
    o.rotation.set(0, rnd() * Math.PI, 0);
    o.scale.set(ancho, 22 + rnd() * 48 - r * .08, ancho * (.7 + rnd() * .6));
    o.updateMatrix();
    torres.setMatrixAt(i, o.matrix);
  }
  torres.frustumCulled = false;

  // los colosos
  const N_COLOSOS = 7;
  const colosos = new THREE.InstancedMesh(borradoGeometry(),
    new THREE.ShaderMaterial({ uniforms: u, vertexShader: COLOSO_V, fragmentShader: COLOSO_F }), N_COLOSOS);
  for (let i = 0; i < N_COLOSOS; i++) {
    // repartidos a los lados del tren (por las ventanas se mira hacia ±x)
    const lado = i % 2 ? 1 : -1;
    const a = (lado > 0 ? 0 : Math.PI) + (rnd() - .5) * 1.9;
    const r = 66 + rnd() * 44;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    o.position.set(x, -24 - rnd() * 8, z);
    o.rotation.set(0, Math.atan2(-x, -z), (rnd() - .5) * .08);
    o.scale.setScalar(30 + rnd() * 16);
    o.updateMatrix();
    colosos.setMatrixAt(i, o.matrix);
  }
  colosos.frustumCulled = false;

  // la vía que sube hacia el eclipse
  const curva = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -1, -13.5), new THREE.Vector3(0, -1, -30), new THREE.Vector3(-8, 1, -54),
    new THREE.Vector3(-30, 8, -74), new THREE.Vector3(-62, 20, -80), new THREE.Vector3(-98, 34, -70),
    new THREE.Vector3(-150, 52, -62),
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

  group.add(domo, torres, colosos, via, hojas);
  return { group, u, hojaU };
}
