// Shaders del modo pintura. Cada pasada es un triángulo a pantalla completa.

export const VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const COMUN = /* glsl */ `
varying vec2 vUv;
uniform float uNear, uFar;
float linZ(float d) {
  float z = d * 2.0 - 1.0;
  return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear));
}
float max3(vec3 c) { return max(c.r, max(c.g, c.b)); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}`;

// 1a · Dirección del trazo: tensor de estructura a media resolución. Guarda
// gx², gx·gy y gy² del brillo (ya comprimido, para que el cielo HDR no mande).
// El óleo lo lee suavizado y saca de ahí hacia dónde corre la pincelada.
export const TENSOR = /* glsl */ `
${COMUN}
uniform sampler2D tColor;
uniform vec2 uTexel; // texel de la imagen de origen (resolución completa)
float lum(vec2 uv) { vec3 c = texture2D(tColor, uv).rgb; return dot(c / (1.0 + max3(c)), vec3(0.3, 0.55, 0.15)); }
void main() {
  vec2 h = uTexel * 1.5; // muestras entre píxeles: el filtro lineal ya promedia
  float a = lum(vUv + vec2(-h.x, -h.y)), b = lum(vUv + vec2(0.0, -h.y)), c = lum(vUv + vec2(h.x, -h.y));
  float d = lum(vUv + vec2(-h.x, 0.0)), f = lum(vUv + vec2(h.x, 0.0));
  float g = lum(vUv + vec2(-h.x, h.y)), i = lum(vUv + vec2(0.0, h.y)), k = lum(vUv + vec2(h.x, h.y));
  float gx = (c + 2.0 * f + k) - (a + 2.0 * d + g);
  float gy = (g + 2.0 * i + k) - (a + 2.0 * b + c);
  gl_FragColor = vec4(gx * gx, gx * gy, gy * gy, 1.0);
}`;

// 1b · Óleo: Kuwahara anisotrópico. Cuatro cuadrantes (9 muestras cada uno)
// girados según la dirección de la forma y estirados a lo largo de ella: la
// pincelada sigue los bordes en vez de escalonarlos, y cada lado de un borde
// se pinta por separado (el marco no se mezcla con el cielo). Nada de ruido
// pegado a la pantalla: el trazo sale solo de la imagen, así que al girar la
// cámara las pinceladas viajan con lo que pintan.
export const OLEO = /* glsl */ `
${COMUN}
uniform sampler2D tColor, tDepth, tTensor;
uniform vec2 uTexel, uTexelT;
uniform float uRadio, uAspect, uCerca, uEstira;
uniform vec3 uNiebla;
uniform float uNieblaAmb, uNieblaFlash, uDens, uBruma;
vec3 comp(vec3 c) { return c / (1.0 + max3(c)); }
void main() {
  float z = linZ(texture2D(tDepth, vUv).x);
  // de cerca, nítido: el óleo solo pinta lo que está lejos (y el cielo entero)
  // uCerca: cuánta pincelada queda de cerca (0 = nítido, 1 = todo óleo)
  float lejos = mix(uCerca, 1.0, smoothstep(3.0, 14.0, z));
  float rad = uRadio * lejos;
  vec3 r;
  if (rad < 0.3) {
    r = texture2D(tColor, vUv).rgb;
  } else {
  // tensor suavizado (cinco lecturas lineales cubren unos 9x9 píxeles)
  vec2 e = uTexelT * 1.5;
  vec3 T = texture2D(tTensor, vUv).xyz * 0.4
    + (texture2D(tTensor, vUv + vec2(e.x, e.y)).xyz + texture2D(tTensor, vUv - vec2(e.x, e.y)).xyz
     + texture2D(tTensor, vUv + vec2(e.x, -e.y)).xyz + texture2D(tTensor, vUv - vec2(e.x, -e.y)).xyz) * 0.15;
  float D = sqrt((T.x - T.z) * (T.x - T.z) + 4.0 * T.y * T.y);
  float l1 = 0.5 * (T.x + T.z + D), l2 = 0.5 * (T.x + T.z - D);
  vec2 t = vec2(l1 - T.x, -T.y); // a lo largo del borde (donde el color cambia menos)
  float lt = length(t);
  t = lt > 1e-8 ? t / lt : vec2(1.0, 0.0);
  // anisotropía: 0 en zonas planas (trazo redondo), 1 en un borde limpio.
  // El 0.0004 evita que un degradé casi plano decida la dirección y tirite.
  float A = (l1 - l2) / (l1 + l2 + 0.0004);
  float sa = 1.0 + A * uEstira;
  vec2 du = t * rad * 0.5 * sa * uTexel;               // a lo largo
  vec2 dv = vec2(-t.y, t.x) * rad * 0.5 / sa * uTexel; // a través
  vec3 m0 = vec3(0.0), m1 = vec3(0.0), m2 = vec3(0.0), m3 = vec3(0.0);
  vec3 s0 = vec3(0.0), s1 = vec3(0.0), s2 = vec3(0.0), s3 = vec3(0.0);
  for (int j = 0; j < 3; j++) {
    for (int i = 0; i < 3; i++) {
      vec2 ou = du * float(i), ov = dv * float(j);
      vec3 c;
      c = comp(texture2D(tColor, vUv - ou - ov).rgb); m0 += c; s0 += c * c;
      c = comp(texture2D(tColor, vUv + ou - ov).rgb); m1 += c; s1 += c * c;
      c = comp(texture2D(tColor, vUv - ou + ov).rgb); m2 += c; s2 += c * c;
      c = comp(texture2D(tColor, vUv + ou + ov).rgb); m3 += c; s3 += c * c;
    }
  }
  m0 /= 9.0; m1 /= 9.0; m2 /= 9.0; m3 /= 9.0;
  vec3 v0 = abs(s0 / 9.0 - m0 * m0), v1 = abs(s1 / 9.0 - m1 * m1);
  vec3 v2 = abs(s2 / 9.0 - m2 * m2), v3 = abs(s3 / 9.0 - m3 * m3);
  // mezcla suave: gana el cuadrante más parejo
  float w0 = 1.0 / (1.0 + pow(4000.0 * (v0.r + v0.g + v0.b), 3.0));
  float w1 = 1.0 / (1.0 + pow(4000.0 * (v1.r + v1.g + v1.b), 3.0));
  float w2 = 1.0 / (1.0 + pow(4000.0 * (v2.r + v2.g + v2.b), 3.0));
  float w3 = 1.0 / (1.0 + pow(4000.0 * (v3.r + v3.g + v3.b), 3.0));
  r = (m0 * w0 + m1 * w1 + m2 * w2 + m3 * w3) / (w0 + w1 + w2 + w3);
  r = r / max(1.0 - max3(r), 0.02);
  }
  // bruma de color: el aire del vagón tiene un tono por momento. Lo cercano
  // queda en silueta contra el fondo; el haz del flash la enciende.
  // la bruma es del aire del vagón: al cielo de afuera no lo toca
  float f = (1.0 - exp(-z * uDens)) * (1.0 - smoothstep(22.0, 40.0, z));
  vec3 tinte = uNiebla / max(max3(uNiebla), 0.001);
  float cono = smoothstep(0.62, 0.0, length((vUv - 0.5) * vec2(uAspect, 1.0)));
  vec3 haz = mix(vec3(1.0, 0.94, 0.82), tinte, 0.5) * uBruma * cono * uNieblaFlash;
  r = r * (1.0 - f * 0.4 * min(1.0, uNieblaAmb * 3.0)) + (uNiebla * uNieblaAmb + haz) * f;
  gl_FragColor = vec4(r, 1.0);
}`;

// 2 · Lente: oclusión en los rincones (a partir de la profundidad) y
// desenfoque con foco automático en el centro de la pantalla.
export const LENTE = /* glsl */ `
${COMUN}
uniform sampler2D tColor, tDepth, tFoco;
uniform vec2 uTexel, uTan;
uniform float uAo, uDof, uMaxBlur, uApertura, uSsr, uCamY;
uniform vec3 uUp; // "arriba" del mundo visto desde la cámara
vec3 viewPos(vec2 uv) {
  float z = linZ(texture2D(tDepth, uv).x);
  return vec3((uv * 2.0 - 1.0) * uTan * z, -z);
}
float coc(float z, float foco) { return clamp((1.0 / foco - 1.0 / z) * uApertura, -1.0, 1.0); }
void main() {
  vec3 col = texture2D(tColor, vUv).rgb;
  vec3 P = viewPos(vUv);
  float z = -P.z;
  // ruido de gradiente intercalado: se nota menos que el ruido blanco
  float n = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) * 6.2832;

  if (uDof > 0.0) {
    float foco = texture2D(tFoco, vec2(0.5)).r;
    float rc = abs(coc(z, foco)) * uMaxBlur;
    // ¿hay algo adelante y desenfocado cerca? Su borde se derrama sobre este
    // píxel aunque este esté nítido (un marco borroso contra el cielo).
    float rs = rc;
    for (int i = 0; i < 6; i++) {
      float a = float(i) * 1.0472;
      float pz = linZ(texture2D(tDepth, vUv + vec2(cos(a), sin(a)) * uMaxBlur * 0.6 * uTexel).x);
      if (pz < z - 0.15) rs = max(rs, abs(coc(pz, foco)) * uMaxBlur);
    }
    if (rs > 0.6) {
      // dos capas: el fondo (este píxel y lo que está a su altura o detrás,
      // que no puede meterse sobre algo más nítido que él) y lo de adelante,
      // que tapa en la medida en que su propio desenfoque alcanza este píxel.
      vec3 fondo = col, frente = vec3(0.0);
      float wf = 1.0, wd = 0.0;
      for (int i = 0; i < 16; i++) {
        float fi = float(i) + 0.5;
        float ri = sqrt(fi / 16.0) * rs;
        float a = fi * 2.39996;
        vec2 uv = vUv + vec2(cos(a), sin(a)) * ri * uTexel;
        float sz = linZ(texture2D(tDepth, uv).x);
        float sc = abs(coc(sz, foco)) * uMaxBlur;
        vec3 c = texture2D(tColor, uv).rgb;
        if (sz < z - 0.15) {
          float w = clamp(sc - ri + 0.5, 0.0, 1.0);
          frente += c * w;
          wd += w;
        } else {
          float w = clamp(min(sc, rc) - ri + 0.5, 0.0, 1.0);
          fondo += c * w;
          wf += w;
        }
      }
      col = mix(fondo / wf, frente / max(wd, 1e-4), clamp(wd / 16.0 * 1.6, 0.0, 1.0));
    }
  }

  vec3 N = normalize(cross(dFdx(P), dFdy(P)));

  // piso mojado: el suelo refleja lo que tiene encima (tubos, la luz roja, los
  // borrados encendidos por el flash). Se camina el rayo reflejado por la pantalla.
  if (uSsr > 0.0 && z < 30.0 && dot(N, uUp) > 0.9 && uCamY + dot(P, uUp) < 0.1) {
    vec3 V = normalize(P);
    vec3 Rf = reflect(V, uUp);
    vec3 q = P + uUp * 0.03;
    float paso = 0.12;
    vec2 hit = vec2(-1.0);
    for (int i = 0; i < 26; i++) {
      q += Rf * paso;
      paso *= 1.13;
      if (q.z > -0.05) break;
      vec2 uv = (q.xy / (-q.z) / uTan) * 0.5 + 0.5;
      if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) break;
      float dz = -q.z - linZ(texture2D(tDepth, uv).x);
      if (dz > 0.0 && dz < 0.5 + paso * 1.5) { hit = uv; break; }
    }
    if (hit.x >= 0.0) {
      float fr = 0.07 + 0.75 * pow(1.0 - max(dot(-V, uUp), 0.0), 3.0);
      vec2 e = smoothstep(0.0, 0.08, hit) * smoothstep(0.0, 0.08, 1.0 - hit);
      // charcos: no todo el piso brilla igual
      float charco = 0.45 + 0.55 * smoothstep(0.35, 0.7, vnoise((P.xy / max(z, 0.1) + vec2(uCamY)) * 3.0 + P.z * 0.7));
      col += texture2D(tColor, hit).rgb * fr * e.x * e.y * uSsr * charco;
    }
  }

  if (uAo > 0.0 && z < 40.0) {
    float occ = 0.0;
    for (int i = 0; i < 8; i++) {
      float fi = float(i) + 0.5;
      float a = fi * 2.39996 + n;
      float rr = sqrt(fi / 8.0) * 0.32 / z;
      vec3 v = viewPos(vUv + vec2(cos(a), sin(a)) * rr * vec2(uTexel.x / uTexel.y, 1.0) * 0.5) - P;
      float dd = dot(v, v);
      occ += max(dot(N, v) * inversesqrt(dd + 1e-5) - 0.12, 0.0) / (1.0 + dd * 9.0);
    }
    col *= 1.0 - clamp(occ / 8.0 * 2.0, 0.0, 1.0) * uAo;
  }
  gl_FragColor = vec4(col, 1.0);
}`;

// Foco automático: 1x1 píxel que persigue la distancia del centro de la pantalla.
export const FOCO = /* glsl */ `
${COMUN}
uniform sampler2D tDepth, tPrev;
uniform float uK;
void main() {
  float z = 0.0;
  z += linZ(texture2D(tDepth, vec2(0.5, 0.5)).x) * 2.0;
  z += linZ(texture2D(tDepth, vec2(0.47, 0.5)).x);
  z += linZ(texture2D(tDepth, vec2(0.53, 0.5)).x);
  z += linZ(texture2D(tDepth, vec2(0.5, 0.45)).x);
  z += linZ(texture2D(tDepth, vec2(0.5, 0.55)).x);
  z = clamp(z / 6.0, 1.7, 16.0);
  float prev = texture2D(tPrev, vec2(0.5)).r;
  gl_FragColor = vec4(vec3(prev <= 0.0 ? z : mix(prev, z, uK)), 1.0);
}`;

// 3 · Bloom: lo más brillante (por canal, para que el rojo de la salida cuente),
// bajado en una cadena de mitades y vuelto a subir sumando.
export const BRILLO = /* glsl */ `
${COMUN}
uniform sampler2D tColor;
uniform vec2 uTexel;
uniform float uUmbral, uRodilla;
vec3 pre(vec2 uv) {
  vec3 c = min(texture2D(tColor, uv).rgb, vec3(9.0));
  float br = max3(c);
  float soft = clamp(br - uUmbral + uRodilla, 0.0, 2.0 * uRodilla);
  soft = soft * soft / (4.0 * uRodilla + 1e-4);
  return c * max(soft, br - uUmbral) / max(br, 1e-4);
}
void main() {
  vec2 h = uTexel * 0.5;
  vec3 c = pre(vUv + vec2(-h.x, -h.y)) + pre(vUv + vec2(h.x, -h.y)) + pre(vUv + vec2(-h.x, h.y)) + pre(vUv + vec2(h.x, h.y));
  gl_FragColor = vec4(c * 0.25, 1.0);
}`;

export const BAJAR = /* glsl */ `
varying vec2 vUv;
uniform sampler2D tColor;
uniform vec2 uTexel;
void main() {
  vec2 h = uTexel;
  vec3 c = texture2D(tColor, vUv).rgb * 4.0;
  c += texture2D(tColor, vUv + vec2(-h.x, -h.y)).rgb + texture2D(tColor, vUv + vec2(h.x, -h.y)).rgb;
  c += texture2D(tColor, vUv + vec2(-h.x, h.y)).rgb + texture2D(tColor, vUv + vec2(h.x, h.y)).rgb;
  gl_FragColor = vec4(c / 8.0, 1.0);
}`;

export const SUBIR = /* glsl */ `
varying vec2 vUv;
uniform sampler2D tColor;
uniform vec2 uTexel;
uniform float uPeso;
void main() {
  vec2 h = uTexel;
  vec3 c = texture2D(tColor, vUv + vec2(-h.x * 2.0, 0.0)).rgb + texture2D(tColor, vUv + vec2(h.x * 2.0, 0.0)).rgb;
  c += texture2D(tColor, vUv + vec2(0.0, -h.y * 2.0)).rgb + texture2D(tColor, vUv + vec2(0.0, h.y * 2.0)).rgb;
  c += (texture2D(tColor, vUv + vec2(-h.x, -h.y)).rgb + texture2D(tColor, vUv + vec2(h.x, -h.y)).rgb
    + texture2D(tColor, vUv + vec2(-h.x, h.y)).rgb + texture2D(tColor, vUv + vec2(h.x, h.y)).rgb) * 2.0;
  gl_FragColor = vec4(c / 12.0 * uPeso, 1.0);
}`;

// 4 · Rayos de luz: desde cada píxel se camina hacia las luces sumando brillo.
// Lo que tapa la luz (una silueta, una barra) corta el rayo: contraluz.
export const RAYOS = /* glsl */ `
${COMUN}
uniform sampler2D tBrillo, tDepth;
uniform vec3 uLuz[3];   // xy = posición en pantalla (uv), z = distancia
uniform vec3 uColor[3]; // color ya multiplicado por su peso
uniform float uAspect;
const int N = 18;
void main() {
  vec3 total = vec3(0.0);
  float jit = hash(gl_FragCoord.xy);
  for (int l = 0; l < 3; l++) {
    if (max3(uColor[l]) < 0.002) continue;
    vec2 paso = (vUv - uLuz[l].xy) * (0.92 / float(N));
    vec2 uv = vUv - paso * jit;
    float fuerza = 1.0;
    vec3 acc = vec3(0.0);
    for (int i = 0; i < N; i++) {
      uv -= paso;
      vec2 q = clamp(uv, 0.0, 1.0);
      vec2 dl = (uv - uLuz[l].xy) * vec2(uAspect, 1.0);
      float disco = smoothstep(0.11, 0.0, length(dl));
      float libre = step(uLuz[l].z - 0.35, linZ(texture2D(tDepth, q).x));
      acc += (uColor[l] * disco * libre * 2.2 + texture2D(tBrillo, q).rgb * 0.22 * max3(uColor[l])) * fuerza;
      fuerza *= 0.93;
    }
    total += acc / float(N);
  }
  gl_FragColor = vec4(min(total, vec3(6.0)), 1.0);
}`;

// 5 · Imagen retenida: lo que el flash mostró queda un instante en la retina.
export const RETINA = /* glsl */ `
varying vec2 vUv;
uniform sampler2D tColor, tPrev;
uniform float uDecae;
void main() {
  vec3 cur = min(texture2D(tColor, vUv).rgb, vec3(3.0));
  vec3 prev = texture2D(tPrev, vUv).rgb * uDecae;
  gl_FragColor = vec4(max(cur, prev), 1.0);
}`;

// 6 · Revelado final: aberración, bruma del flash, bloom, rayos, retina,
// curva de película, virado (sombras frías, luces doradas), tela y viñeta.
export const FINAL = /* glsl */ `
${COMUN}
uniform sampler2D tColor, tBloom, tRayos, tRetina, tDepth;
uniform float uTime, uAspect, uBloom, uRayos, uRetina, uExpo, uCA, uVirado, uLit, uBarras, uTela, uLavado, uRaya;
uniform vec3 uNiebla;
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
vec3 srgb(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
void main() {
  vec2 d = vUv - 0.5;
  float r2 = dot(d, d);
  vec3 col;
  col.r = texture2D(tColor, vUv + d * r2 * uCA).r;
  col.g = texture2D(tColor, vUv).g;
  col.b = texture2D(tColor, vUv - d * r2 * uCA).b;

  vec3 bloom = texture2D(tBloom, vUv).rgb;
  col += bloom * uBloom;
  col += texture2D(tRayos, vUv).rgb * uRayos;
  // destello de lente anamórfico: las luces fuertes se estiran en una raya fría
  vec3 raya = vec3(0.0);
  for (int i = 1; i <= 6; i++) {
    float o = float(i) * 0.02;
    raya += (texture2D(tBloom, vUv + vec2(o, 0.0)).rgb + texture2D(tBloom, vUv - vec2(o, 0.0)).rgb) * (1.0 - float(i) / 7.0);
  }
  col += raya / 6.0 * vec3(0.45, 0.7, 1.0) * uRaya;
  vec3 ret = texture2D(tRetina, vUv).rgb;
  col += max(ret - col * 1.4, 0.0) * uRetina * vec3(0.72, 0.86, 1.0);

  col = aces(col * uExpo);

  // virado: sombras hacia el azul petróleo, luces hacia el oro
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  vec3 fria = col * vec3(0.80, 1.0, 1.14) + vec3(0.0, 0.004, 0.010) * uLit;
  vec3 oro = col * vec3(1.12, 1.01, 0.80);
  col = mix(col, fria, (1.0 - smoothstep(0.0, 0.45, l)) * uVirado);
  col = mix(col, oro, smoothstep(0.4, 0.95, l) * uVirado);
  // lavado: todo el cuadro tira hacia el color del momento, menos las luces altas
  vec3 tinte = uNiebla / max(max3(uNiebla), 0.001);
  col = mix(col, l * mix(vec3(1.0), tinte, 0.85) * 1.5, uLavado * (1.0 - smoothstep(0.55, 1.0, l)));
  l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(l), col, 1.3);
  col = mix(col, col * col * (3.0 - 2.0 * col), 0.22);

  // tela: la trama del lienzo se nota en los tonos medios
  vec2 g = vUv * vec2(uAspect, 1.0);
  float tela = vnoise(g * vec2(520.0, 90.0)) * 0.5 + vnoise(g * vec2(90.0, 520.0)) * 0.5;
  float mancha = vnoise(g * 5.0 + 3.0);
  col *= 1.0 + ((tela - 0.5) * 0.06 + (mancha - 0.5) * 0.06) * uTela * smoothstep(0.0, 0.25, l);

  col *= 1.0 - smoothstep(0.25, 0.95, r2 * 2.6) * 0.55;
  col *= step(uBarras, vUv.y) * step(vUv.y, 1.0 - uBarras);
  // tramado contra el bandeado, ya en sRGB: medio escalón de 8 bits. Antes iba
  // en luz lineal y en las sombras la curva lo agrandaba unas 13 veces: lo oscuro hervía.
  vec3 s = srgb(max(col, 0.0));
  s += (hash(gl_FragCoord.xy + fract(uTime * 7.0) * 91.0) + hash(gl_FragCoord.yx + fract(uTime * 3.0) * 57.0) - 1.0) / 255.0;
  gl_FragColor = vec4(s, 1.0);
}`;

// Polvo en el aire: puntos que solo brillan dentro del haz del flash (o con el
// vagón encendido). Fuera de foco se agrandan, como en una foto.
// También brillan si cruzan un haz del eclipse (las ventanas del lado del sol):
// se proyecta la mota contra el vidrio siguiendo la luz y se mira si cae en un paño.
export const POLVO_V = /* glsl */ `
attribute vec3 aSeed;
uniform float uTime, uFlash, uAmb, uPx, uFoco;
uniform vec3 uCam, uFwd, uCaja, uHaz, uLuz;
varying vec3 vC;
float enHaz(vec3 p) {
  float lado = sign(-uLuz.x);
  float s = (p.x - lado * 2.47) / uLuz.x; // metros recorridos desde el vidrio
  if (s < 0.0 || s > 4.2) return 0.0;
  vec3 w = p - uLuz * s;
  float z = w.z;
  // tramos con vidrio y sus marcos (en los extremos y al medio)
  float pano = 0.0;
  if (z > -12.8 && z < -8.85) pano = min(min(abs(z + 12.8), abs(z + 10.825)), abs(z + 8.85));
  else if (z > -7.15 && z < -0.85) pano = min(min(abs(z + 7.15), abs(z + 4.0)), abs(z + 0.85));
  else if (z > 0.85 && z < 7.15) pano = min(min(abs(z - 0.85), abs(z - 4.0)), abs(z - 7.15));
  else if (z > 8.85 && z < 12.8) pano = min(min(abs(z - 8.85), abs(z - 10.825)), abs(z - 12.8));
  float dentro = smoothstep(0.05, 0.15, pano) * smoothstep(1.38, 1.5, w.y) * smoothstep(2.42, 2.3, w.y);
  return dentro * pow(1.0 - s / 4.2, 1.25) * smoothstep(0.95, 1.45, p.y) * smoothstep(0.55, 1.35, abs(p.x));
}
void main() {
  vec3 p = position;
  p.x += sin(uTime * 0.13 * (0.5 + aSeed.x) + aSeed.y * 6.28) * 0.3;
  p.y += uTime * 0.025 * (aSeed.z - 0.35);
  p.z += cos(uTime * 0.1 * (0.5 + aSeed.y) + aSeed.x * 6.28) * 0.3;
  p = uCam + mod(p - uCam + uCaja * 0.5, uCaja) - uCaja * 0.5;
  vec4 mv = viewMatrix * vec4(p, 1.0);
  float dist = max(-mv.z, 0.05);
  vec3 dir = normalize(p - uCam);
  float cono = smoothstep(0.7, 0.96, dot(dir, uFwd));
  float lit = uFlash * cono * 2.6 / (1.0 + dist * dist * 0.12) + uAmb * (0.5 + 0.5 * aSeed.z);
  float dentro = step(abs(p.x), 2.35) * step(0.1, p.y) * step(p.y, 3.0);
  float size = uPx * (0.008 + 0.05 * abs(1.0 / uFoco - 1.0 / dist)) / dist;
  size = clamp(size, 1.0, 26.0);
  float vis = dentro * smoothstep(0.2, 0.6, dist) * (1.0 - smoothstep(5.0, 7.5, dist)) * min(1.0, 9.0 / (size * size));
  // en el haz: solo una de cada tres motas, para que se vea polvo y no niebla
  float haz = max(uHaz.r, max(uHaz.g, uHaz.b)) > 0.001 ? enHaz(p) * step(0.66, aSeed.x) * 1.6 : 0.0;
  vC = (vec3(1.0, 0.93, 0.8) * lit + uHaz * haz) * vis;
  gl_PointSize = size;
  gl_Position = projectionMatrix * mv;
}`;

export const POLVO_F = /* glsl */ `
varying vec3 vC;
void main() {
  float r = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.32, r) * (0.75 + 0.25 * smoothstep(0.2, 0.45, r));
  gl_FragColor = vec4(vC * a, 1.0);
}`;

// Pétalos: lo que queda de un borrado. Se desprenden de las siluetas (los que
// tienen aNace < 0, en bucle) o nacen donde alguien desapareció (aVel.w = modo:
// 0 caen, 1 se los lleva el viento por la ventana, 2 entran por la ventana rota).
// Los sueltos nunca brillan solos: solo con el flash o con la imagen retenida.
// Los demás, además, toman la luz de afuera cuando pasan junto a las ventanas
// (en el aire; posados en el piso quedan a oscuras).
export const PETALO_V = /* glsl */ `
attribute vec3 aOrigen;
attribute vec4 aSeed;
attribute float aNace;
attribute vec4 aVel;
uniform float uTime, uFlash, uGlow, uAmb;
uniform vec3 uCam, uFwd, uVentana;
varying vec3 vColor;
varying vec2 vQ;
varying float vA;
void main() {
  vec3 p = aOrigen;
  float vida, alpha;
  if (aNace < 0.0) {
    vida = fract(uTime * (0.10 + 0.08 * aSeed.x) + aSeed.y);
    p += vec3(
      sin(aSeed.z * 6.28 + vida * 5.0) * 0.22 * vida + (aSeed.w - 0.5) * 0.7 * vida,
      vida * (0.35 + 0.7 * aSeed.x),
      cos(aSeed.y * 6.28 + vida * 4.0) * 0.22 * vida + (aSeed.z - 0.5) * 0.7 * vida);
    alpha = sin(3.14159 * vida);
  } else if (aVel.w < 0.5) {
    float t = uTime - aNace;
    vida = clamp(t / (5.0 + 4.0 * aSeed.x), 0.0, 1.0);
    float abre = 1.0 - exp(-t * 1.6);
    p.xz += (aSeed.zy - 0.5) * 1.5 * abre + vec2(sin(t * 0.9 + aSeed.x * 6.28), cos(t * 0.7 + aSeed.w * 6.28)) * 0.1 * (1.0 - vida);
    p.y = max(0.02, p.y + 0.25 * aSeed.w * abre - vida * vida * (p.y + 0.3));
    alpha = smoothstep(0.0, 0.03, vida) * (1.0 - smoothstep(22.0, 30.0, t));
  } else {
    float t = max(uTime - aNace, 0.0);
    float k = aVel.w < 1.5 ? 0.8 : 1.5; // roce del aire
    p += aVel.xyz * (1.0 - exp(-t * k)) / k;
    float giroA = min(t, 1.5);
    p.xz += vec2(sin(t * 0.9 + aSeed.x * 6.28), cos(t * 0.7 + aSeed.w * 6.28)) * 0.14 * giroA;
    if (aVel.w < 1.5) {
      // viento: suben despacio y se van con el cielo
      p.y += t * (0.1 + 0.22 * aSeed.z);
      p.z += t * (0.25 + 0.3 * aSeed.y);
      vida = 0.5;
      alpha = step(-0.4, uTime - aNace) * (1.0 - smoothstep(5.0, 8.0 + 4.0 * aSeed.y, t)); // quietos con su forma hasta que el viento los toma
    } else {
      // entran: planean y se posan en el asiento o en el piso
      float ax = abs(p.x);
      float suelo = ax > 1.93 && ax < 2.44 ? 0.53 : 0.02;
      p.y = max(suelo, p.y - t * (0.14 + 0.12 * aSeed.z));
      vida = p.y <= suelo + 0.001 ? 1.0 : 0.5;
      alpha = smoothstep(0.0, 0.5, t) * (1.0 - smoothstep(24.0, 32.0, t));
    }
  }
  vec4 mv = viewMatrix * vec4(p, 1.0);
  float dist = max(-mv.z, 0.05);
  float giro = uTime * (0.8 + 2.4 * aSeed.z) * (1.0 - step(0.999, vida) * step(0.0, aNace)) + aSeed.y * 6.28;
  vec2 q = position.xy * vec2(1.0, 0.5 + 0.5 * sin(giro * 1.7));
  float cs = cos(giro), sn = sin(giro);
  q = vec2(q.x * cs - q.y * sn, q.x * sn + q.y * cs);
  mv.xy += q * 0.085 * (0.55 + 0.8 * aSeed.w) * (aVel.w > 1.5 ? 1.5 : aVel.w > 0.5 ? 1.8 : 1.0);
  vec3 dir = normalize(p - uCam);
  float cono = smoothstep(0.62, 0.95, dot(dir, uFwd));
  float lit = uFlash * cono * 3.2 / (1.0 + dist * dist * 0.1) + uGlow * 0.9 * step(aNace, 0.0) + uAmb;
  vec3 carmin = vec3(0.95, 0.07, 0.11), marfil = vec3(1.0, 0.86, 0.80), oro = vec3(1.0, 0.72, 0.30);
  vec3 c = aSeed.x < 0.55 ? carmin : aSeed.x < 0.86 ? marfil : oro;
  // la luz de afuera: junto al vidrio y en el aire; del otro lado, a contraluz
  float ax = abs(p.x);
  float ventana = step(0.0, aNace) * (smoothstep(1.5, 2.45, ax) * smoothstep(0.95, 1.45, p.y) + smoothstep(2.45, 2.8, ax) * 1.4);
  if (aVel.w > 0.5 && aVel.w < 1.5) {
    // la forma de alguien: junto al vidrio a cualquier altura, y nace ardiendo
    // (una brasa que solo se apaga, nunca vuelve a encenderse)
    ventana = max(ventana, smoothstep(1.4, 2.3, ax));
    float t = max(uTime - aNace, 0.0);
    lit += 1.6 * exp(-t * 0.9) * (0.6 + 0.4 * aSeed.z);
  }
  if (aVel.w > 1.5) lit += 0.7 * exp(-max(uTime - aNace, 0.0) * 0.45); // traen luz de afuera; se les apaga al posarse
  vColor = c * lit + (c * 0.7 + vec3(0.3, 0.22, 0.12)) * uVentana * ventana;
  vA = alpha;
  vQ = position.xy;
  gl_Position = projectionMatrix * mv;
}`;

export const PETALO_F = /* glsl */ `
varying vec3 vColor;
varying vec2 vQ;
varying float vA;
void main() {
  // forma de pétalo: una gota
  vec2 q = vQ * 2.0;
  float f = length(vec2(q.x * (1.3 + q.y * 0.5), q.y));
  float a = smoothstep(1.0, 0.8, f) * vA;
  if (a < 0.02) discard;
  // opacos: a oscuras son negro sobre negro; con luz tapan lo que hay detrás
  gl_FragColor = vec4(vColor * (0.55 + 0.45 * smoothstep(1.0, 0.0, f)), a);
}`;
