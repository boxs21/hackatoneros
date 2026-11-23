import * as THREE from 'three';
import { createEscenarios } from './escenarios.js';

// "El otro lado": lo que hay afuera cuando se corta la luz. El túnel ya no
// está; el vagón quedó detenido sobre un mar quieto, bajo un eclipse.
//  - cielo pintado: nubes en remolino, cortinas de pintura que caen del cenit
//  - el eclipse: disco negro con corona (es la fuente de los rayos de luz)
//  - el mar: espejo del cielo, con bruma en el horizonte
//  - los faros: columnas de luz que suben del mar
//  - lo que se para encima (distinto en cada vagón), la carrocería negra que
//    tapa las rendijas y lo que lleva el viento: escenarios.js
// Nada de esto ilumina el interior: adentro sigue oscuro.
// adelante y a la izquierda (30°): desde donde partes cae en una ventana, no detrás
// de una puerta, y se va viendo por las siguientes al caminar por el pasillo
export const SOL = new THREE.Vector3(-.49, .2, -.85).normalize();

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

  // faros: columnas finas de luz que suben del mar, al lado contrario del eclipse
  for (int k = 0; k < 4; k++) {
    float fk = float(k);
    float t = 0.16 + fk * 0.33;
    float da = 1.0 - dot(cir, vec2(cos(t), -sin(t)));
    float pulso = 0.8 + 0.2 * sin(uTime * 0.8 + fk * 2.1);
    col += uCorona * (exp(-da * 30000.0) * 1.7 + exp(-da * 900.0) * 0.14) * exp(-h * (4.0 + fk * 1.5)) * pulso;
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
  // cielo y mar
  const domo = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), new THREE.ShaderMaterial({
    uniforms: u, vertexShader: DOMO_V, fragmentShader: DOMO_F, side: THREE.BackSide, depthWrite: false,
  }));
  domo.frustumCulled = false;
  domo.renderOrder = 10; // al final de lo opaco: solo pinta donde se ve el cielo

  // lo que se para encima del mar, distinto en cada vagón, y la carrocería
  const escenarios = createEscenarios(u, group, SOL);

  group.add(domo);
  return { group, u, hojaU: escenarios.hojaU, escenarios };
}
