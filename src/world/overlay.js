import * as THREE from 'three';

// Capa de pantalla completa (vive en ctx.stage, así se limpia sola):
// viñeta, grano, destello blanco del flash, peligro en rojo y mira.
export function createOverlay() {
  const uniforms = {
    uTime: { value: 0 },
    uFlash: { value: 0 },
    uDanger: { value: 0 },
    uCaught: { value: 0 },
    uDot: { value: 0 },
    uVig: { value: .75 },
    uBlack: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uFlash, uDanger, uCaught, uDot, uVig, uBlack;
      varying vec2 vUv;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void over(inout vec3 c, inout float a, vec3 nc, float na) {
        c = nc * na + c * (1.0 - na);
        a = na + a * (1.0 - na);
      }
      void main() {
        vec2 p = vUv - 0.5;
        p.x *= 1.333;
        float r = length(p);
        vec3 c = vec3(0.0);
        float a = 0.0;
        over(c, a, vec3(0.0), smoothstep(0.32, 0.85, r) * uVig);
        float g = hash(floor(gl_FragCoord.xy) + floor(uTime * 24.0));
        over(c, a, vec3(g), 0.06);
        float beat = 0.65 + 0.35 * sin(uTime * 7.0);
        over(c, a, vec3(0.45, 0.0, 0.02), uDanger * beat * smoothstep(0.12, 0.7, r));
        over(c, a, vec3(1.0, 0.98, 0.92), uFlash * (0.55 + 0.45 * (1.0 - r)));
        over(c, a, vec3(0.5, 0.0, 0.0), uCaught * 0.55);
        over(c, a, vec3(0.0), uBlack);
        vec2 px = abs(gl_FragCoord.xy - vec2(160.0, 120.0));
        if (max(px.x, px.y) < 1.5) over(c, a, vec3(1.0), uDot * 0.9);
        gl_FragColor = vec4(a > 0.0 ? c / a : c, a);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 999;
  return { mesh, u: uniforms };
}
