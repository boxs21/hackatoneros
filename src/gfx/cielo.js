import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// El cielo y el mar del otro lado, con profundidad: antes era un domo en el
// infinito y al caminar los 26 m del vagón nada se movía afuera. Ahora cada
// capa está a una distancia de verdad (se calcula por rayos, en el shader):
//  - el mar es un plano 1,3 m bajo el piso: olas con escala, bruma y la estela del eclipse
//  - bancos de bruma sobre el agua, en dos hileras paralelas al tren (45 y 110 m)
//  - nubes bajas en un techo a 24 m y nubes altas más arriba
//  - postes de una catenaria vieja hundidos a 16 m, en silueta (y su reflejo)
//  - la cordillera en tres anillos (170, 300 y 520 m)
//  - faros a 400 m
// Al avanzar por el pasillo lo cercano corre y lo lejano casi no: paralaje.
// Las estrellas y el eclipse siguen en el infinito, como debe ser.
// Solo se sombrea donde se ve el cielo (las ventanas). Nada ilumina el interior.

export const MAR = -1.3; // altura del agua: los rieles (y = -1) quedan apenas sobre ella
const R_LUNA = 0.085; // radio del disco negro, en radianes
const D_LUNA = 185; // a qué distancia se para el disco que tapa los rayos (camera.far = 200)
// postes de la catenaria vieja, hundidos: la línea seguía por aquí antes del agua
const POSTE_X = 16; // a cada lado del tren
const POSTE_PASO = 18;
const POSTE_Z0 = -144;
const N_POSTES = 17; // por lado: de -144 a 144
const POSTE_ALTO = 5.6; // la punta, en altura de mundo

const RUIDO = /* glsl */ `
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float hash3(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.03 + 11.7; a *= 0.5; }
  return s;
}
float fbm3(vec2 p) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 3; i++) { s += a * vnoise(p); p = p * 2.03 + 11.7; a *= 0.5; }
  return s / 0.875;
}`;

const DOMO_V = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = (projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0)).xyww;
}`;

const DOMO_F = /* glsl */ `
uniform float uTime, uAbre;
uniform vec3 uCenit, uMedio, uHoriz, uCorona, uSol;
varying vec3 vDir;
${RUIDO}
const float R = ${R_LUNA.toFixed(3)};
const float MAR = ${MAR.toFixed(2)};
const float POSTE_X = ${POSTE_X.toFixed(1)}, POSTE_PASO = ${POSTE_PASO.toFixed(1)}, POSTE_Z0 = ${POSTE_Z0.toFixed(1)}, POSTE_ALTO = ${POSTE_ALTO.toFixed(1)};

// dónde un rayo cruza un cilindro vertical de radio rc centrado en el vagón
float cilindro(vec3 o, vec3 d, float rc) {
  vec2 c = o.xz, D = d.xz;
  float a = max(dot(D, D), 1e-6), b = dot(c, D), k = dot(c, c) - rc * rc;
  return (-b + sqrt(max(b * b - a * k, 0.0))) / a;
}

// o: desde dónde se mira (la cámara, o el punto del mar que refleja)
vec3 cielo(vec3 o, vec3 d) {
  float h = max(d.y, 0.0);
  vec3 col = mix(uHoriz, uMedio, smoothstep(0.0, 0.26, h));
  col = mix(col, uCenit, smoothstep(0.16, 0.8, h));
  float cs = dot(d, uSol);
  float ang = acos(clamp(cs, -1.0, 1.0));
  float cerca = pow(max(cs, 0.0), 4.0);
  vec2 cir = normalize(d.xz + vec2(1e-5));

  // estrellas, arriba: una por celda de una grilla 3D, sin costura en ningún rumbo
  vec3 sc = d * 64.0;
  vec3 ci = floor(sc);
  vec3 sp = ci + 0.5 + (vec3(hash3(ci + 1.7), hash3(ci + 3.1), hash3(ci + 5.3)) - 0.5) * 0.5;
  float st = step(0.93, hash3(ci)) * smoothstep(0.2, 0.05, length(sc - sp)) * smoothstep(0.2, 0.55, h);
  col += vec3(0.85, 0.92, 1.0) * st * (0.75 + 0.25 * sin(uTime * 0.7 + hash3(ci + 9.0) * 40.0));

  // cortinas de pintura que caen del cenit, más vivas hacia el eclipse
  float tira = pow(smoothstep(0.5, 0.92, vnoise(cir * 10.0 + 4.0)), 2.0);
  float largo = 0.3 + 0.55 * vnoise(cir * 2.5 + 9.0 + uTime * 0.02);
  float cortina = tira * smoothstep(1.0 - largo, 1.0 - largo + 0.3, h);
  col += uCorona * cortina * (0.12 + 0.5 * cerca);

  // nubes altas en remolino, como pinceladas; el borde que mira al eclipse se enciende.
  // Corren apenas al caminar (techo alto, ~60 m)
  vec2 uv = d.xz / (h + 0.22) + o.xz * (1.0 / 60.0);
  vec2 w = vec2(fbm(uv * 0.7 + uTime * 0.012), fbm3(uv * 0.7 + 7.3 - uTime * 0.01));
  float n = fbm(uv * 1.1 + w * 1.7);
  float nube = smoothstep(0.42, 0.68, n) * smoothstep(0.0, 0.05, h);
  float borde = 1.0 - smoothstep(0.46, 0.66, n);
  vec3 cnube = mix(uCenit * 0.5 + uMedio * 0.14, uCorona * 1.3 + uHoriz * 0.8, max(cerca, 0.12) * (0.2 + 0.8 * borde));
  col = mix(col, cnube, nube * 0.93);

  // el eclipse: corona con hilos, anillo fino y disco negro. Los hilos se leen
  // sobre el círculo (no con el ángulo, que salta en ±π)
  vec3 ex = normalize(cross(uSol, vec3(0.0, 1.0, 0.0)));
  vec3 ey = cross(ex, uSol);
  vec2 rumbo = normalize(vec2(dot(d, ex), dot(d, ey)) + vec2(1e-5));
  float hilos = 0.2 + 0.8 * pow(vnoise(rumbo * 6.0 + vec2(uTime * 0.15, 0.0)), 1.5)
    + 0.9 * pow(vnoise(rumbo * 21.0 + vec2(3.0, uTime * 0.1)), 3.0);
  float fuera = max(ang - R, 0.0);
  // anillo fino y no tan fuerte: si quema, el bloom rellena el disco y se lee como mancha
  col += uCorona * (exp(-fuera * 6.0) * hilos * 0.38 + exp(-fuera * 26.0) * hilos * 0.45 + exp(-fuera * 110.0) * 1.5);
  col = mix(vec3(0.0), col, smoothstep(R - 0.004, R, ang));

  // nubes bajas: un techo a 24 m sobre el agua, jirones que pasan delante de todo
  if (d.y > 0.015) {
    float t = (24.0 - o.y) / d.y;
    vec2 p = (o.xz + d.xz * t) * 0.018 + vec2(uTime * 0.006, 0.0);
    float nb = fbm3(p + 31.0);
    float jir = smoothstep(0.55, 0.78, nb) * (1.0 - smoothstep(160.0, 420.0, t));
    vec3 cb = mix(uMedio * 0.55 + uCenit * 0.3, uHoriz * 0.7 + uCorona * 0.5, cerca * 0.8 + 0.1);
    col = mix(col, cb, jir * 0.7);
  }

  // la cordillera: tres anillos; el más lejano es el más alto y claro
  for (int k = 0; k < 3; k++) {
    float fk = float(k);
    float rc = k == 0 ? 520.0 : (k == 1 ? 300.0 : 170.0);
    float t = cilindro(o, d, rc);
    vec3 p = o + d * t;
    vec2 donde = normalize(p.xz);
    float alto = (0.115 - 0.034 * fk) * (0.45 + 1.1 * fbm3(donde * (2.6 + fk * 1.7) + fk * 13.0)) * rc + MAR;
    float e = 0.004 * t;
    float m = smoothstep(alto + e, alto - e, p.y);
    vec3 cerro = mix(mix(uHoriz, uMedio, 0.45) * 0.62, uCenit * 0.4 + uMedio * 0.1, fk * 0.5);
    cerro += uCorona * cerca * 0.35 * smoothstep(alto - 0.03 * t, alto, p.y); // el filo que mira al eclipse
    col = mix(col, cerro, m);
  }

  // faros: columnas finas de luz que suben del mar, a 400 m, al lado contrario del eclipse
  for (int k = 0; k < 4; k++) {
    float fk = float(k);
    float t = 0.16 + fk * 0.33;
    vec2 hacia = normalize(vec2(cos(t), -sin(t)) * 400.0 - o.xz);
    float da = 1.0 - dot(cir, hacia);
    float pulso = 0.8 + 0.2 * sin(uTime * 0.8 + fk * 2.1);
    col += uCorona * (exp(-da * 30000.0) * 1.7 + exp(-da * 900.0) * 0.14) * exp(-h * (4.0 + fk * 1.5)) * pulso;
  }
  return col;
}

// bancos de bruma: hileras paralelas al tren, a ±D metros, bajas y con claros
vec3 banco(vec3 col, vec3 d, float D, float semilla, vec3 tono, float opaco) {
  float ax = abs(d.x);
  if (ax < 0.05) return col;
  float t = (sign(d.x) * D - cameraPosition.x) / d.x;
  vec3 p = cameraPosition + d * t;
  float alto = p.y - MAR;
  if (alto < 0.0) return col; // el agua está antes
  float tope = 4.0 + 18.0 * smoothstep(0.25, 0.75, fbm3(vec2(p.z * 0.03 + semilla, semilla)));
  float grupos = smoothstep(0.3, 0.55, vnoise(vec2(p.z * 0.028 + semilla * 3.0, sign(d.x) * 7.0)));
  float hebra = vnoise(vec2(p.z * 0.09 - uTime * 0.05, alto * 0.25 + semilla));
  float a = smoothstep(tope, tope * 0.45, alto) * grupos * (0.6 + 0.4 * hebra);
  a *= smoothstep(0.05, 0.3, ax) * (1.0 - smoothstep(180.0, 320.0, t)) * opaco;
  // el borde de arriba, el que mira al eclipse, se enciende
  float filo = smoothstep(tope * 0.5, tope * 0.95, alto) * pow(max(dot(d, uSol), 0.0), 2.0);
  return mix(col, tono + uCorona * filo * 0.5, a);
}

void main() {
  vec3 d = normalize(vDir);
  vec3 o = cameraPosition;
  float cs = dot(d, uSol);
  float cerca = pow(max(cs, 0.0), 4.0);
  vec3 col;
  float tm = d.y < -0.0005 ? (o.y - MAR) / -d.y : 1e6;
  if (tm < cilindro(o, d, 170.0)) {
    // el mar: un plano de verdad bajo el tren. Mar de fondo largo y lento más
    // ondas chicas; el detalle se apaga a lo lejos para que no brille al moverse
    vec3 pm = o + d * tm;
    vec2 q = pm.xz;
    float lod = exp(-tm / 55.0);
    vec2 g = vec2(0.0);
    vec2 k1 = vec2(0.55, 0.42), k2 = vec2(-0.31, 0.9), k3 = vec2(1.3, -0.7);
    g += k1 * cos(dot(k1, q) + uTime * 0.45) * 0.09;
    g += k2 * cos(dot(k2, q) - uTime * 0.6) * 0.055;
    g += k3 * cos(dot(k3, q) + uTime * 0.8) * 0.02 * lod;
    vec2 qr = q * 1.4 + vec2(uTime * 0.12, -uTime * 0.09);
    float r0 = vnoise(qr);
    g += (vec2(vnoise(qr + vec2(0.35, 0.0)), vnoise(qr + vec2(0.0, 0.35))) - r0) * 0.5 * lod;
    vec3 nrm = normalize(vec3(-g.x, 1.0, -g.y));
    vec3 r = reflect(d, nrm);
    r.y = abs(r.y) + 0.002;
    float fres = 0.08 + 0.92 * pow(1.0 - max(dot(-d, nrm), 0.0), 5.0);
    vec3 hondo = uCenit * 0.5 + uMedio * 0.12;
    vec3 refl = cielo(pm, r) * 0.9;
    // los postes también se reflejan: dos manchas oscuras que tiemblan con el agua
    float tp = (sign(r.x) * POSTE_X - pm.x) / (r.x + sign(r.x) * 1e-4);
    vec3 pp = pm + r * tp;
    float kz = abs(fract((pp.z - POSTE_Z0) / POSTE_PASO + 0.5) - 0.5) * POSTE_PASO;
    float poste = step(0.0, tp) * step(pp.y, POSTE_ALTO) * smoothstep(0.32, 0.18, kz);
    refl = mix(refl, uCenit * 0.15, poste * 0.85);
    col = mix(hondo, refl, fres);
    // la estela del eclipse: una columna de destellos bajo él, que se ensancha hacia el tren
    vec2 haciaSol = normalize(uSol.xz);
    float lat = 1.0 - dot(normalize(d.xz), haciaSol);
    float glint = pow(max(dot(r, uSol), 0.0), 90.0);
    col += uCorona * (glint * 1.6 + exp(-lat * 900.0) * 0.35 * smoothstep(0.0, 0.08, -d.y + 0.01)) * step(0.0, dot(d.xz, haciaSol));
    // bruma sobre el agua: lo lejano se funde con el horizonte
    col = mix(col, uHoriz * 1.05 + uCorona * cerca * 0.3, 1.0 - exp(-tm * 0.006));
  } else {
    col = cielo(o, d);
    col = mix(col, uHoriz * 1.15, exp(-abs(d.y) * 38.0) * 0.5);
  }
  // bruma entre el tren y el horizonte: dos hileras, la cercana más oscura (silueta)
  col = banco(col, d, 110.0, 4.0, uHoriz * 0.9 + uMedio * 0.3 + uCorona * cerca * 0.25, 0.6);
  col = banco(col, d, 45.0, 17.0, uMedio * 0.7 + uCenit * 0.8 + uHoriz * 0.18, 0.72);
  // se abre desde el eclipse hacia afuera
  float ang = acos(clamp(cs, -1.0, 1.0));
  col *= clamp(uAbre * 2.7 - ang * 0.55, 0.0, 1.0);
  gl_FragColor = vec4(col, 1.0);
}`;

// La luna del eclipse: un disco negro de verdad, lejos pero dentro de camera.far.
// Escribe profundidad, así la pasada de rayos ve que algo tapa la luz y el
// disco queda negro (antes los rayos le sumaban una mancha blanca encima).
const LUNA_V = /* glsl */ `
uniform vec3 uSol;
void main() {
  vec3 w = cameraPosition + uSol * ${D_LUNA.toFixed(1)} + position;
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
}`;
const LUNA_F = /* glsl */ `
void main() { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); }`;

const POSTE_V = /* glsl */ `
varying vec3 vW, vN;
void main() {
  vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vN = normalize(mat3(modelMatrix * instanceMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const POSTE_F = /* glsl */ `
uniform float uAbre;
uniform vec3 uCenit, uMedio, uHoriz, uCorona, uSol;
varying vec3 vW, vN;
void main() {
  if (vW.y < ${MAR.toFixed(2)}) discard; // lo que está bajo el agua no se ve
  vec3 N = normalize(vN);
  // silueta: casi negro, con el canto que mira al eclipse encendido
  vec3 col = uCenit * 0.12 + uCorona * pow(max(dot(N, uSol), 0.0), 2.0) * 0.35;
  // línea de agua: un poco de bruma pegada abajo
  col = mix(col, uHoriz * 0.5, smoothstep(0.9, 0.0, vW.y - ${MAR.toFixed(2)}) * 0.6);
  // a lo lejos se funden con el aire
  float f = 1.0 - exp(-length(vW - cameraPosition) * 0.012);
  col = mix(col, uHoriz * 0.55 + uMedio * 0.2, f);
  gl_FragColor = vec4(col * uAbre * uAbre, 1.0);
}`;

function crearPostes(u) {
  // poste (un cajón alto) y su brazo hacia la vía, en una sola geometría
  const largo = POSTE_ALTO - MAR + 2; // nace 2 m bajo el agua
  const palo = new THREE.BoxGeometry(.32, largo, .32).translate(0, largo / 2, 0);
  const brazo = new THREE.BoxGeometry(2.4, .16, .16).translate(-1.2, largo - .45, 0);
  const geo = mergeGeometries([palo, brazo]);
  palo.dispose();
  brazo.dispose();
  const postes = new THREE.InstancedMesh(geo, new THREE.ShaderMaterial({
    uniforms: u, vertexShader: POSTE_V, fragmentShader: POSTE_F,
  }), N_POSTES * 2);
  const o = new THREE.Object3D();
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  let i = 0;
  for (const lado of [-1, 1]) {
    for (let k = 0; k < N_POSTES; k++) {
      const quebrado = rnd() < .2; // algunos quedaron cortados
      const alto = quebrado ? .55 + rnd() * .2 : .94 + rnd() * .1;
      o.position.set(lado * POSTE_X, MAR - 2, POSTE_Z0 + k * POSTE_PASO);
      // el brazo apunta a la vía; algunos se ladean, cansados
      o.rotation.set((rnd() - .5) * .08, lado > 0 ? 0 : Math.PI, (rnd() - .5) * .14);
      o.scale.set(1, alto, 1);
      o.updateMatrix();
      postes.setMatrixAt(i++, o.matrix);
    }
  }
  postes.frustumCulled = false;
  return postes;
}

export function crearCielo(u) {
  const domo = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), new THREE.ShaderMaterial({
    uniforms: u, vertexShader: DOMO_V, fragmentShader: DOMO_F, side: THREE.BackSide, depthWrite: false,
  }));
  domo.frustumCulled = false;
  domo.renderOrder = 10; // al final de lo opaco: solo pinta donde se ve el cielo

  // un poco más chico que el disco pintado: el borde suave lo pone el domo
  const radio = D_LUNA * Math.tan(R_LUNA - .006);
  const luna = new THREE.Mesh(new THREE.SphereGeometry(radio, 32, 16), new THREE.ShaderMaterial({
    uniforms: { uSol: u.uSol }, vertexShader: LUNA_V, fragmentShader: LUNA_F,
  }));
  luna.frustumCulled = false;
  luna.renderOrder = 9;
  return { domo, luna, postes: crearPostes(u) };
}
