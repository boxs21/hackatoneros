import * as THREE from 'three';
import { GFX } from '../gfx/config.js';
import { pintura, luz } from '../gfx/materiales.js';

// Look PS1: vértices que "saltan" a la grilla de 320x240, colores con pocos
// niveles y tramado (dithering) ordenado. Todo material del vagón pasa por aquí.
const SNAP = /* glsl */ `
#include <project_vertex>
{
  vec4 snapped = gl_Position;
  snapped.xyz /= snapped.w;
  snapped.xy = floor(snapped.xy * vec2(160.0, 120.0) + 0.5) / vec2(160.0, 120.0);
  snapped.xyz *= snapped.w;
  gl_Position = snapped;
}`;

const BAYER = /* glsl */ `
float ps1Bayer(vec2 p) {
  int x = int(mod(p.x, 4.0));
  int y = int(mod(p.y, 4.0));
  float m[16] = float[16](0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5.);
  return m[x + y * 4] / 16.0;
}
void main() {`;

const DITHER = /* glsl */ `
#include <dithering_fragment>
gl_FragColor.rgb = floor(gl_FragColor.rgb * 20.0 + ps1Bayer(gl_FragCoord.xy)) / 20.0;`;

export function ps1(material) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', SNAP);
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', BAYER)
      .replace('#include <dithering_fragment>', DITHER);
  };
  material.customProgramCacheKey = () => 'ps1';
  return material;
}

// rama test-graficos: en modo pintura los materiales los entrega src/gfx/materiales.js
export const lambert = (opts) => (GFX.on ? pintura(opts) : ps1(new THREE.MeshLambertMaterial(opts)));
export const basic = (opts) => (GFX.on ? luz(opts) : ps1(new THREE.MeshBasicMaterial(opts)));

// Texturas chicas, sin suavizado, como en la consola.
export function pixelTexture(canvas, rx = 1, ry = 1) {
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.magFilter = THREE.NearestFilter;
  map.minFilter = THREE.NearestFilter;
  map.generateMipmaps = false;
  if (GFX.on) { // píxeles nítidos de cerca, sin chispeo de lejos
    map.minFilter = THREE.LinearMipmapLinearFilter;
    map.generateMipmaps = true;
    map.anisotropy = 4;
  }
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(rx, ry);
  return map;
}

// Números pseudoaleatorios repetibles (misma semilla, mismo vagón).
export function seeded(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
