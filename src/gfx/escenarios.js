import * as THREE from 'three';
import { GFX } from './config.js';

// Escenarios del otro lado: lo que se ve por las ventanas cuando se corta la
// luz. El cielo y el mar son de todos (mundo.js); aquí va lo que se para
// encima, distinto en cada vagón. Todo se arma una sola vez al partir y solo
// se cambia qué grupo se ve: pasar de un vagón a otro no crea nada.
//
//  eclipse (inicio, borrados): los veladores, figuras altísimas con manto y
//      una puerta encendida en el pecho, inclinadas hacia el tren; la ciudad
//      que cuelga del cielo; un viaducto roto que no lleva a ninguna parte;
//      la vía que sube al eclipse; pétalos.
//  escolar (vagonEscolar): volantines amarrados al techo del vagón, barquitos
//      de papel gigantes en el mar y palotes de tiza del porte de torres
//      (alguien contó las estaciones). Papelitos en el viento.
//  feria (vagonVendedor): una feria a medio hundir, toldos con guirnaldas de
//      ampolletas que siguen prendidas. Chispas.
//  casa (final): palafitos con una ventana encendida y un muelle que se aleja.
//
// Para verlos desde cualquier vagón a oscuras: ?mundo=eclipse|escolar|feria|casa
// (o el id del momento: ?mundo=vagonVendedor).

// Qué mundo le toca a cada momento. Lo que no está aquí ve el eclipse.
const DE_MOMENTO = { vagonEscolar: 'escolar', vagonVendedor: 'feria', final: 'casa' };
// Con qué paleta de cielo se mira cada mundo forzado por ?mundo=
const PALETA_DE = { eclipse: 'borrados', escolar: 'vagonEscolar', feria: 'vagonVendedor', casa: 'final' };
// Lo que lleva el viento en cada mundo: dos colores, un acento y cuántos.
const VIENTO = {
  eclipse: { a: [.85, .06, .1], b: [1, .86, .8], c: [.95, .66, .28], n: 1600 }, // carmín, marfil, oro viejo
  escolar: { a: [1, .95, .86], b: [.9, .72, .36], c: [.55, 1, .92], n: 1100 }, // papel, oro, tiza turquesa
  feria: { a: [1, .55, .16], b: [1, .82, .5], c: [.35, .5, 1], n: 900 }, // chispas ámbar y una azul
  casa: { a: [1, .8, .78], b: [1, .94, .82], c: [.95, .7, .4], n: 700 }, // rosa, marfil, oro
};

function pedido() {
  const v = new URLSearchParams(location.search).get('mundo');
  if (!v) return null;
  if (PALETA_DE[v]) return v;
  if (v in DE_MOMENTO || ['inicio', 'borrados', 'apagon', 'losCinco'].includes(v)) return DE_MOMENTO[v] || 'eclipse';
  console.error(`[escenarios] no existe el mundo "${v}". Opciones: ${Object.keys(PALETA_DE).join(', ')}`);
  return null;
}

// las mismas uniformes que el cielo (copia propia: el cielo es de otro frente)
const U_E = /* glsl */ `
uniform float uTime, uAbre;
uniform vec3 uCenit, uMedio, uHoriz, uCorona, uSol;`;

const HASH = /* glsl */ `
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }`;

// niebla del aire: lo lejano se funde con el color del horizonte
const AIRE = /* glsl */ `
vec3 aire(vec3 col, vec3 w) {
  float f = 1.0 - exp(-length(w - cameraPosition) * 0.006);
  // lo lejano toma el tono del horizonte pero queda más oscuro que el cielo: silueta
  vec3 lejos = mix(uHoriz, uMedio, smoothstep(-5.0, 45.0, w.y)) * 0.32;
  return mix(col, lejos, f) * uAbre * uAbre;
}`;

// Un solo material para todas las piezas de todos los mundos: cambiar de
// vagón no compila nada. Cada vértice trae cómo pintarse:
//   aPinta.x ventanas (cuántas celdas de la grilla uv se encienden)
//   aPinta.y brasa (luz propia, tibia, que no parpadea)
//   aPinta.z canto (cuánto lo recorta el eclipse)
//   aPinta.w papel (a contraluz deja pasar la luz)
//   aMece   amplitud (m) y fase del vaivén
const SILUETA_V = /* glsl */ `
attribute vec4 aPinta;
attribute vec2 aMece;
uniform float uTime, uMece;
varying vec3 vW, vN;
varying vec2 vUv;
varying vec4 vPinta;
void main() {
  vec3 p = position;
  float a = aMece.x * uMece;
  p.x += sin(uTime * 0.21 + aMece.y) * a;
  p.z += sin(uTime * 0.16 + aMece.y * 1.7) * a * 0.6;
  vec4 w = modelMatrix * vec4(p, 1.0);
  vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  vUv = uv;
  vPinta = aPinta;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const SILUETA_F = /* glsl */ `
${U_E}
varying vec3 vW, vN;
varying vec2 vUv;
varying vec4 vPinta;
${HASH}
${AIRE}
void main() {
  vec3 N = normalize(vN);
  if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(cameraPosition - vW);
  vec3 col = uCenit * 0.07;
  // canto de luz: el eclipse los recorta por un lado
  // (solo en el borde: de frente quedan en sombra, para que se lean contra el cielo)
  float borde = pow(1.0 - abs(dot(N, V)), 2.0);
  col += uCorona * pow(max(dot(N, uSol), 0.0), 2.0) * (0.02 + 0.6 * borde) * vPinta.z;
  col += uHoriz * borde * borde * 0.25 * vPinta.z;
  // papel a contraluz: lo que queda entre el ojo y el eclipse se enciende tibio
  float contra = pow(max(dot(-V, uSol), 0.0), 3.0);
  col += (uCorona * 0.7 + uHoriz * 0.3) * vPinta.w * (0.015 + 0.5 * contra);
  if (vPinta.x > 0.0) {
    // ventanas en una grilla; de lejos se funden en un brillo parejo (no titilan al moverse)
    vec2 c = floor(vUv), f = fract(vUv);
    vec2 aa = fwidth(vUv);
    float on = step(1.0 - vPinta.x, hash(c));
    vec2 m = smoothstep(vec2(0.22, 0.2) - aa, vec2(0.22, 0.2) + aa, f) * smoothstep(vec2(0.78, 0.7) + aa, vec2(0.78, 0.7) - aa, f);
    float lejos = smoothstep(0.18, 0.45, max(aa.x, aa.y));
    float luz = mix(on * m.x * m.y, vPinta.x * 0.3, lejos);
    col += vec3(1.0, 0.7, 0.36) * luz * (1.3 + 0.12 * sin(uTime * 0.25 + hash(c + 5.0) * 30.0));
  }
  col += vec3(1.0, 0.68, 0.34) * vPinta.y * 2.2;
  col = aire(col, vW);
  // lo que toca el agua se deshace en la bruma; lo que sube se pierde en las nubes
  float bruma = smoothstep(3.0, -6.0, vW.y) * 0.85 * (1.0 - min(vPinta.y, 1.0));
  col = mix(col, uHoriz * 0.72 * uAbre * uAbre, bruma);
  col = mix(col, mix(uMedio, uCenit, 0.55) * 0.7 * uAbre * uAbre, smoothstep(62.0, 90.0, vW.y));
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
${U_E}
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
uniform float uTime, uAbre, uPx;
uniform vec3 uCaja, uSol, uCorona, uColA, uColB, uColC;
varying vec3 vC;
varying float vGiro;
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
  vec3 dir = normalize(p - cameraPosition);
  float luz = 0.85 + 1.6 * pow(max(dot(dir, uSol), 0.0), 3.0); // con color propio: a contraluz parecían escombros
  vec3 c = aSeed.x < 0.6 ? uColA : uColB;
  c = aSeed.y > 0.92 ? uColC : c;
  vC = c * luz * uAbre * afuera * (1.0 - smoothstep(18.0, 26.0, dist));
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

// ---------- un molde: junta muchas piezas en una sola geometría ----------
const _v = new THREE.Vector3();
const _n = new THREE.Vector3();
const _m3 = new THREE.Matrix3();
class Molde {
  constructor() {
    this.pos = [];
    this.nor = [];
    this.uv = [];
    this.pin = [];
    this.mec = [];
  }

  // pinta: [ventanas, brasa, canto, papel] · mece: metros arriba · alto: con qué
  // altura (local, desde "base") el vaivén llega entero; 0 = parejo
  poner(geo, m4, { pinta = [0, 0, 1, 0], mece = 0, fase = 0, alto = 0, base = 0, uv0 = [0, 0], uvEsc = [1, 1] } = {}) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (!g.attributes.normal) g.computeVertexNormals();
    const p = g.attributes.position;
    const n = g.attributes.normal;
    const t = g.attributes.uv;
    _m3.getNormalMatrix(m4);
    for (let i = 0; i < p.count; i++) {
      _v.fromBufferAttribute(p, i);
      const yl = _v.y - base;
      _v.applyMatrix4(m4);
      this.pos.push(_v.x, _v.y, _v.z);
      _n.fromBufferAttribute(n, i).applyMatrix3(_m3).normalize();
      this.nor.push(_n.x, _n.y, _n.z);
      this.uv.push(t ? t.getX(i) * uvEsc[0] + uv0[0] : 0, t ? t.getY(i) * uvEsc[1] + uv0[1] : 0);
      this.pin.push(pinta[0], pinta[1], pinta[2], pinta[3]);
      this.mec.push(alto ? mece * THREE.MathUtils.clamp(yl / alto, 0, 1) : mece, fase);
    }
    if (g !== geo) g.dispose();
  }

  geometria() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('aPinta', new THREE.Float32BufferAttribute(this.pin, 4));
    g.setAttribute('aMece', new THREE.Float32BufferAttribute(this.mec, 2));
    g.computeBoundingSphere();
    return g;
  }
}

// geometría a mano: lista de triángulos [[x,y,z]x3]
function triangulos(lista) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(lista.flat(2), 3));
  g.computeVertexNormals();
  return g;
}

// tubo que se adelgaza de un extremo a otro (hilos, cables)
function hilo(curva, r0, r1, seg = 20) {
  const g = new THREE.TubeGeometry(curva, seg, 1, 3, false);
  const p = g.attributes.position;
  const c = new THREE.Vector3();
  for (let i = 0; i <= seg; i++) {
    curva.getPointAt(i / seg, c);
    const r = r0 + (r1 - r0) * (i / seg);
    for (let j = 0; j <= 3; j++) {
      const k = i * 4 + j;
      _v.fromBufferAttribute(p, k).sub(c).multiplyScalar(r).add(c);
      p.setXYZ(k, _v.x, _v.y, _v.z);
    }
  }
  g.computeVertexNormals();
  return g;
}

export function createEscenarios(u, padre, SOL) {
  const rnd = (() => { let s = 23; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  const entre = (a, b) => a + rnd() * (b - a);
  const o = new THREE.Object3D();
  o.rotation.order = 'YXZ'; // primero se inclina, después se gira hacia el tren
  const azSol = Math.atan2(SOL.z, SOL.x);
  // nada alto delante del eclipse (con margen: de cerca el ángulo cambia al caminar)
  const tapaSol = (a, r) => Math.abs(Math.atan2(Math.sin(a - azSol), Math.cos(a - azSol))) < .42 + 16 / r;
  const mirarTren = (x, z) => Math.atan2(-x, -z);
  const matriz = (x, y, z, rx, ry, rz, sx, sy = sx, sz = sx) => {
    o.position.set(x, y, z);
    o.rotation.set(rx, ry, rz);
    o.scale.set(sx, sy, sz);
    o.updateMatrix();
    return o.matrix.clone();
  };
  const tirar = [];
  const usar = (g) => { tirar.push(g); return g; };

  const mat = new THREE.ShaderMaterial({
    uniforms: { ...u, uMece: { value: GFX.calma ? .25 : 1 } },
    vertexShader: SILUETA_V,
    fragmentShader: SILUETA_F,
    side: THREE.DoubleSide,
  });
  const mundos = {};
  function mundo(id, molde, extra = []) {
    const g = new THREE.Group();
    g.name = `gfx:escenario:${id}`;
    const m = new THREE.Mesh(molde.geometria(), mat);
    m.frustumCulled = false;
    g.add(m, ...extra);
    g.visible = false;
    padre.add(g);
    mundos[id] = g;
  }

  // =========================================================== eclipse
  {
    const M = new Molde();

    // los veladores: manto hasta el agua, brazos más largos que el cuerpo,
    // capucha sin cara, un aro roto detrás de la cabeza y una puerta encendida
    // en el pecho (la estación a la que nunca llegaron). Alto local: 1.
    const manto = usar(new THREE.LatheGeometry([
      [.2, -.45], [.18, 0], [.13, .26], [.1, .45], [.11, .6], [.16, .69], [.12, .735], [.045, .76], [.03, .79], [0, .8],
    ].map(([r, y]) => new THREE.Vector2(r, y)), 8).scale(1, 1, .62));
    const brazo = usar(new THREE.CylinderGeometry(.03, .014, 1.12, 5).translate(0, -.56, 0));
    const capucha = usar(new THREE.ConeGeometry(.075, .21, 6).translate(0, .105, 0).scale(1, 1, .85));
    const aro = usar(new THREE.TorusGeometry(.16, .016, 4, 32, 5.2));
    const forma = new THREE.Shape();
    forma.moveTo(-.024, 0); forma.lineTo(.024, 0); forma.lineTo(.024, .05);
    forma.absarc(0, .05, .024, 0, Math.PI, false); forma.lineTo(-.024, 0);
    const puerta = usar(new THREE.ShapeGeometry(forma, 6));
    // [ángulo, radio, alto (m)]: cada uno a otra distancia, para que al caminar se crucen
    const VELADORES = [[-1.1, 80, 29], [-.38, 118, 42], [.22, 96, 35], [.8, 150, 54], [Math.PI - .75, 132, 48], [Math.PI + .42, 166, 60]];
    for (const [a0, r, alto] of VELADORES) {
      const a = a0 + entre(-.05, .05);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const ry = mirarTren(x, z);
      const y0 = -.06 * alto;
      const fase = rnd() * 6.28;
      const c = { mece: alto * .012, fase, alto: .84 };
      const base = matriz(x, y0, z, .05, ry, entre(-.025, .025), alto);
      M.poner(manto, base, { ...c, pinta: [0, 0, 1, 0] });
      for (const s of [-1, 1]) {
        o.position.set(s * .14, .7, .01).applyMatrix4(base);
        M.poner(brazo, matriz(o.position.x, o.position.y, o.position.z, .05, ry, s * .05, alto), { ...c, alto: 0, mece: alto * .009 * .9, pinta: [0, 0, .8, 0] });
      }
      // la cabeza inclinada hacia el tren
      o.position.set(0, .76, .02).applyMatrix4(base);
      const cab = matriz(o.position.x, o.position.y, o.position.z, .6, ry, 0, alto);
      M.poner(capucha, cab, { ...c, alto: 0, mece: alto * .012, pinta: [0, 0, 1.2, 0] });
      o.position.set(0, .86, -.07).applyMatrix4(base);
      M.poner(aro, matriz(o.position.x, o.position.y, o.position.z, .1, ry, rnd() * 6.28, alto), { ...c, alto: 0, mece: alto * .011, pinta: [0, 0, 1.6, .4] });
      o.position.set(0, .43, .064).applyMatrix4(base);
      M.poner(puerta, matriz(o.position.x, o.position.y, o.position.z, .05, ry, 0, alto), { ...c, alto: 0, mece: alto * .006, pinta: [0, .55, 0, 0] });
    }

    // la ciudad que cuelga: torres invertidas en gradas, con balcones y
    // ventanas, que terminan en una aguja. Alto local: 1 (de 0 hacia abajo).
    const GRADAS = [[.5, .16], [.42, .14], [.34, .13], [.25, .12], [.17, .1]];
    const piezas = [];
    let yy = 0;
    for (const [r, h] of GRADAS) {
      piezas.push({ g: usar(new THREE.CylinderGeometry(r, r * .93, h, 6, 1, true).translate(0, yy - h / 2, 0)), uvEsc: [24 * r, h * 26], ventanas: .22 });
      piezas.push({ g: usar(new THREE.CylinderGeometry(r * 1.16, r * 1.02, .012, 6).translate(0, yy - h - .006, 0)), ventanas: 0 });
      yy -= h + .012;
    }
    piezas.push({ g: usar(new THREE.ConeGeometry(.12, -yy * .55, 6).rotateX(Math.PI).translate(0, yy - (-yy * .55) / 2, 0)), ventanas: 0 });
    for (let i = 0; i < 26; i++) {
      let a = rnd() * Math.PI * 2;
      const r = entre(84, 170);
      while (tapaSol(a, r)) a = rnd() * Math.PI * 2;
      const largo = entre(48, 70);
      const ancho = entre(9, 16);
      const m4 = matriz(Math.cos(a) * r, 92, Math.sin(a) * r, 0, rnd() * Math.PI, 0, ancho, largo, ancho * entre(.8, 1.2));
      const uv0 = [Math.floor(rnd() * 900), Math.floor(rnd() * 900)];
      for (const p of piezas) M.poner(p.g, m4, { uv0, uvEsc: p.uvEsc || [1, 1], pinta: [p.ventanas, 0, .7, 0] });
    }

    // el viaducto roto: arcos que corren junto al tren y se cortan.
    // Uno cerca a la derecha (paralaje fuerte) y otro más lejos, en diagonal.
    const P = 3;
    const S = 13;
    const ALTO = 14;
    const ya = ALTO - 3.2 - S / 2;
    const arco = new THREE.Shape();
    arco.moveTo(0, -9); arco.lineTo(P, -9); arco.lineTo(P, ya);
    arco.absarc(P + S / 2, ya, S / 2, Math.PI, 0, true);
    arco.lineTo(P + S, -9); arco.lineTo(2 * P + S, -9); arco.lineTo(2 * P + S, ALTO); arco.lineTo(0, ALTO); arco.lineTo(0, -9);
    const arcoGeo = usar(new THREE.ExtrudeGeometry(arco, { depth: 3.4, bevelEnabled: false, curveSegments: 10 })
      .translate(-(2 * P + S) / 2, 0, -1.7).rotateY(Math.PI / 2));
    const VIADUCTOS = [
      { x: 58, z0: 34, giro: 0, esc: 1, faltan: [2], cae: 5, n: 7 },
      { x: 112, z0: 46, giro: -.32, esc: 1.5, faltan: [1, 4], cae: 3, n: 6 },
    ];
    for (const v of VIADUCTOS) {
      const paso = (S + P) * v.esc;
      for (let k = 0; k < v.n; k++) {
        if (v.faltan.includes(k)) continue;
        const d = k * paso;
        const x = v.x + Math.sin(v.giro) * -d;
        const z = v.z0 - Math.cos(v.giro) * d;
        const cae = k === v.cae;
        M.poner(arcoGeo, matriz(x, cae ? -5 * v.esc : 0, z, cae ? .14 : 0, v.giro, cae ? -.1 : 0, v.esc), { pinta: [0, 0, .9, 0] });
      }
    }

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
    mundo('eclipse', M, [via]);
  }

  // =========================================================== escolar
  {
    const M = new Molde();
    // volantín: rombo de papel apenas combado, con cola de moños
    const T = [0, .5, 0];
    const D = [.42, .06, 0];
    const B = [0, -.5, 0];
    const I = [-.42, .06, 0];
    const C = [0, .06, -.07];
    const tris = [[T, I, C], [T, C, D], [B, C, I], [B, D, C]];
    for (let k = 0; k < 9; k++) {
      const cx = Math.sin(k * .9) * .08 * (1 + k * .15);
      const cy = -.62 - k * .2;
      const s = .07 + k * .004;
      tris.push([[cx - s * 1.4, cy + s * .7, 0], [cx - s * 1.4, cy - s * .7, 0], [cx, cy, 0]]);
      tris.push([[cx + s * 1.4, cy + s * .7, 0], [cx, cy, 0], [cx + s * 1.4, cy - s * .7, 0]]);
      const nx = Math.sin((k + 1) * .9) * .08 * (1 + (k + 1) * .15);
      const ny = cy - .2;
      const px = k ? cx : 0;
      const py = k ? cy : -.5;
      tris.push([[px - .008, py, 0], [nx - .008, ny, 0], [nx + .008, ny, 0]], [[px - .008, py, 0], [nx + .008, ny, 0], [px + .008, py, 0]]);
    }
    const volantin = usar(triangulos(tris));
    // amarrados al techo de este vagón: los hilos bajan hacia el tren
    const VOLANTINES = [[.15, 60, 14], [-.5, 88, 10], [.62, 112, 16], [-1.1, 136, 8], [1.15, 74, 11], [Math.PI - .3, 70, 13], [Math.PI + .28, 96, 15], [Math.PI + .05, 140, 9], [Math.PI - 1.0, 100, 7], [Math.PI - .65, 150, 17]];
    for (const [a0, r, elev] of VOLANTINES) {
      const a = a0 + entre(-.06, .06);
      if (tapaSol(a, r)) continue;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const y = r * Math.tan(THREE.MathUtils.degToRad(elev)) + 1.55;
      const tam = entre(8, 12) * (r / 90);
      const fase = rnd() * 6.28;
      const vaiven = 1.2 + r * .012;
      M.poner(volantin, matriz(x, y, z, -.32, mirarTren(x, z), entre(-.3, .3), tam), { mece: vaiven, fase, pinta: [0, 0, .7, 1] });
      const s = Math.sign(x) || 1;
      const ancla = new THREE.Vector3(s * 2.8, 3.5, entre(-10, 10));
      const punta = new THREE.Vector3(x, y - tam * .12, z);
      const medio = ancla.clone().lerp(punta, .55);
      medio.y -= r * .05;
      const g = hilo(new THREE.QuadraticBezierCurve3(ancla, medio, punta), .02, .03 + r * .0022, 24);
      M.poner(g, new THREE.Matrix4(), { mece: vaiven, fase, alto: punta.y - ancla.y, base: ancla.y, pinta: [0, 0, .5, 0] });
      g.dispose();
    }

    // barquitos de papel del porte de una casa, quietos en el mar
    const L = .5;
    const casco = [
      [[-L, .25, .13], [-.3, 0, 0], [.3, 0, 0]], [[-L, .25, .13], [.3, 0, 0], [L, .25, .13]],
      [[-L, .25, -.13], [.3, 0, 0], [-.3, 0, 0]], [[-L, .25, -.13], [L, .25, -.13], [.3, 0, 0]],
      [[-L, .25, .13], [-L, .25, -.13], [-.3, 0, 0]], [[L, .25, .13], [.3, 0, 0], [L, .25, -.13]],
      [[-.3, .25, .03], [.3, .25, .03], [0, .64, 0]], [[-.3, .25, -.03], [0, .64, 0], [.3, .25, -.03]],
    ];
    const barco = usar(triangulos(casco));
    for (let i = 0; i < 13; i++) {
      let a = rnd() * Math.PI * 2;
      const r = entre(32, 160);
      while (tapaSol(a, r)) a = rnd() * Math.PI * 2;
      const tam = entre(6, 18) * Math.sqrt(r / 60);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      M.poner(barco, matriz(x, -1.2 - tam * .05, z, entre(-.06, .06), rnd() * Math.PI, entre(-.08, .08), tam), { mece: .25, fase: rnd() * 6.28, pinta: [0, 0, .9, .7] });
    }

    // palotes de tiza del porte de torres: I, II, III… alguien contó las estaciones
    const palo = usar(new THREE.BoxGeometry(1, 1, 1, 1, 4, 1).translate(0, .5, 0));
    const cruz = usar(new THREE.BoxGeometry(1, 1, 1));
    const PALOTES = [[-.7, 150, 3], [.45, 128, 5], [Math.PI - .2, 162, 2], [Math.PI + .38, 118, 4], [1.25, 96, 1]];
    for (const [a0, r, n] of PALOTES) {
      const a = a0 + entre(-.05, .05);
      if (tapaSol(a, r)) continue;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const ry = mirarTren(x, z);
      const alto = entre(26, 36) * (r / 130);
      const ancho = alto * .06;
      const ver = new THREE.Vector3(Math.cos(ry), 0, -Math.sin(ry)); // hacia el lado, visto desde el tren
      const cuantos = Math.min(n, 4);
      for (let k = 0; k < cuantos; k++) {
        const off = (k - (cuantos - 1) / 2) * ancho * 2.6;
        M.poner(palo, matriz(x + ver.x * off, -2, z + ver.z * off, 0, ry, entre(-.06, .06), ancho, alto + entre(-2, 2), ancho * .6), { pinta: [0, 0, .9, .35] });
      }
      if (n >= 5 || n === 4) {
        // el quinto cruza en diagonal
        M.poner(cruz, matriz(x, alto * .45, z, 0, ry, -1.05, ancho * .9, alto * .8, ancho * .5), { pinta: [0, 0, .9, .35] });
      }
    }
    mundo('escolar', M);
  }

  // =========================================================== feria
  {
    const M = new Molde();
    const poste = usar(new THREE.BoxGeometry(.05, 1.55, .05).translate(0, .225, 0));
    const techo = usar(new THREE.ConeGeometry(.95, .42, 4, 1, true).rotateY(Math.PI / 4).translate(0, 1.21, 0));
    const faldon = usar(new THREE.CylinderGeometry(.95, .95, .14, 4, 1, true).rotateY(Math.PI / 4).translate(0, .93, 0));
    const ampolleta = usar(new THREE.OctahedronGeometry(1, 0));
    const cable = (a, b, caida) => {
      const m = a.clone().lerp(b, .5);
      m.y -= caida;
      const curva = new THREE.QuadraticBezierCurve3(a, m, b);
      const g = hilo(curva, .035, .035, 12);
      M.poner(g, new THREE.Matrix4(), { pinta: [0, 0, .4, 0] });
      g.dispose();
      const n = Math.max(3, Math.round(a.distanceTo(b) / 2.4));
      for (let i = 1; i < n; i++) {
        curva.getPointAt(i / n, p0);
        M.poner(ampolleta, matriz(p0.x, p0.y - .3, p0.z, 0, 0, 0, .34), { pinta: [0, .9, 0, 0] });
      }
    };
    const p0 = new THREE.Vector3();
    const toldo = (x, z, tam, hunde, inclina) => {
      const ry = mirarTren(x, z) + entre(-.4, .4);
      const m4 = matriz(x, -hunde, z, inclina, ry, entre(-.08, .08) + inclina * .5, tam);
      for (const [px, pz] of [[-.6, -.6], [.6, -.6], [-.6, .6], [.6, .6]]) M.poner(poste, new THREE.Matrix4().makeTranslation(px, 0, pz).premultiply(m4), { pinta: [0, 0, .5, 0] });
      M.poner(techo, m4, { pinta: [0, 0, 1, .8] });
      M.poner(faldon, m4, { pinta: [0, 0, .8, .8] });
      // la ampolleta de abajo, que nadie apagó
      M.poner(ampolleta, new THREE.Matrix4().makeTranslation(0, .82, 0).premultiply(m4).multiply(new THREE.Matrix4().makeScale(.05, .05, .05)), { pinta: [0, .9, 0, 0] });
      return new THREE.Vector3(0, 1.0, 0).applyMatrix4(m4);
    };
    // dos calles de feria junto al tren, a distancias distintas, unidas por guirnaldas
    const CALLES = [
      { x: 30, z0: 46, n: 10, paso: 10, tam: [4.5, 6] },
      { x: 62, z0: 70, n: 9, paso: 17, tam: [7, 9] },
      { x: -38, z0: 60, n: 7, paso: 13, tam: [5, 7] },
    ];
    for (const c of CALLES) {
      let antes = null;
      for (let k = 0; k < c.n; k++) {
        const x = c.x + entre(-2.5, 2.5);
        const z = c.z0 - k * c.paso + entre(-1.5, 1.5);
        const a = Math.atan2(z, x);
        if (tapaSol(a, Math.hypot(x, z))) { antes = null; continue; }
        const hundido = rnd() < .25;
        const tope = toldo(x, z, entre(c.tam[0], c.tam[1]), hundido ? entre(1.5, 3) : entre(.2, .8), hundido ? entre(-.25, .25) : entre(-.05, .05));
        if (antes && rnd() < .85) cable(antes, tope, entre(.8, 2));
        antes = tope;
      }
    }
    // toldos sueltos mar adentro
    for (let i = 0; i < 12; i++) {
      let a = rnd() * Math.PI * 2;
      const r = entre(85, 170);
      while (tapaSol(a, r)) a = rnd() * Math.PI * 2;
      toldo(Math.cos(a) * r, Math.sin(a) * r, entre(8, 14), entre(0, 4), entre(-.2, .2));
    }
    mundo('feria', M);
  }

  // =========================================================== casa
  {
    const M = new Molde();
    const cuerpo = usar(new THREE.BoxGeometry(1, .72, .8).translate(0, 1.36, 0));
    const tri = new THREE.Shape();
    tri.moveTo(-.6, 0); tri.lineTo(.6, 0); tri.lineTo(0, .46); tri.lineTo(-.6, 0);
    const techo = usar(new THREE.ExtrudeGeometry(tri, { depth: .92, bevelEnabled: false }).translate(0, 1.72, -.46));
    const pilote = usar(new THREE.BoxGeometry(.07, 2.4, .07).translate(0, -.2, 0));
    const ventana = usar(new THREE.PlaneGeometry(.17, .19));
    const casa = (x, z, tam) => {
      const ry = mirarTren(x, z) + entre(-.35, .35);
      const m4 = matriz(x, -.9, z, 0, ry, entre(-.03, .03), tam);
      M.poner(cuerpo, m4, { pinta: [0, 0, .9, .15] });
      M.poner(techo, m4, { pinta: [0, 0, 1.1, 0] });
      for (const [px, pz] of [[-.42, -.32], [.42, -.32], [-.42, .32], [.42, .32]]) M.poner(pilote, new THREE.Matrix4().makeTranslation(px, 0, pz).premultiply(m4), { pinta: [0, 0, .5, 0] });
      // una ventana encendida, a veces dos (alguien espera)
      const n = rnd() < .3 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const vx = n === 1 ? entre(-.25, .25) : (i ? .26 : -.26);
        M.poner(ventana, new THREE.Matrix4().makeTranslation(vx, 1.4, .402).premultiply(m4), { pinta: [0, .75, 0, 0] });
      }
    };
    const CASAS = [[.35, 38, 4], [-.3, 56, 5], [.95, 74, 6], [-.95, 98, 7], [Math.PI - .4, 46, 4.5], [Math.PI + .85, 88, 7], [Math.PI - 1.1, 120, 9], [.6, 140, 10], [-.6, 168, 12], [Math.PI - .05, 150, 11]];
    for (const [a0, r, tam] of CASAS) {
      const a = a0 + entre(-.08, .08);
      if (tapaSol(a, r)) continue;
      casa(Math.cos(a) * r, Math.sin(a) * r, tam);
      // vecinas: un caserío
      if (r > 70) for (let k = 0; k < 2; k++) casa(Math.cos(a) * r + entre(-14, 14), Math.sin(a) * r + entre(-14, 14), tam * entre(.6, .9));
    }
    // un muelle de pilotes que sale del tren y se aleja mar adentro
    const muelle = usar(new THREE.BoxGeometry(.3, 2.6, .3).translate(0, .3, 0));
    for (let k = 0; k < 26; k++) {
      const d = 7 + k * 3.2;
      for (const dz of [-1.2, 1.2]) M.poner(muelle, matriz(d, -1, -16 + dz + k * .35, 0, 0, entre(-.08, .08), 1, 1 + entre(-.2, .2), 1), { pinta: [0, 0, .7, 0] });
    }
    mundo('casa', M);
  }

  tirar.forEach((g) => g.dispose());

  // ---------- lo que lleva el viento ----------
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
  const hojaU = {
    ...u, uPx: { value: 500 }, uCaja: { value: caja },
    uColA: { value: new THREE.Vector3() }, uColB: { value: new THREE.Vector3() }, uColC: { value: new THREE.Vector3() },
  };
  const hojas = new THREE.Points(hojaGeo, new THREE.ShaderMaterial({ uniforms: hojaU, vertexShader: HOJA_V, fragmentShader: HOJA_F }));
  hojas.frustumCulled = false;
  padre.add(hojas);

  // ---------- carrocería: lo que antes tapaba el túnel. Negro puro, pegado por fuera ----------
  const negro = new THREE.MeshBasicMaterial({ color: 0x000000, fog: false });
  const tapa = (w, h, d, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), negro);
    m.position.set(x, y, z);
    padre.add(m);
  };
  for (const s of [-1, 1]) {
    tapa(.1, 1.2, 26.6, s * 2.63, 3.04, 0); // sobre las ventanas, hasta el techo
    for (const dz of [-8, 0, 8]) tapa(.1, .34, 1.7, s * 2.63, 2.31, dz); // sobre cada puerta
    tapa(5.5, 3.9, .1, 0, 1.7, s * 13.14); // extremos
  }
  tapa(5.5, .1, 26.6, 0, 3.4, 0); // techo
  tapa(5.5, .1, 26.6, 0, -.2, 0); // bajo el piso

  // ---------- cuál se ve ----------
  const forzado = pedido();
  let actual = null;
  return {
    hojaU,
    // devuelve true si cambió de mundo (para volver a abrir el cielo)
    elegir(momento) {
      const id = forzado || DE_MOMENTO[momento] || 'eclipse';
      if (id === actual) return false;
      actual = id;
      for (const k in mundos) mundos[k].visible = k === id;
      const v = VIENTO[id];
      hojaU.uColA.value.fromArray(v.a);
      hojaU.uColB.value.fromArray(v.b);
      hojaU.uColC.value.fromArray(v.c);
      hojaGeo.setDrawRange(0, v.n);
      return true;
    },
    // qué paleta de cielo usar: la del momento, o la del mundo pedido por ?mundo=
    paleta(momento) { return forzado ? PALETA_DE[forzado] : momento; },
  };
}
