import * as THREE from 'three';

// Disolución: gente que se deshace. Dos parches de material, sin geometría nueva:
//  - borrados (la multitud): gente a medio borrar. El cuerpo es tinta oscura,
//    le faltan pedazos (más en la cabeza, los hombros y las manos) y el borde
//    de lo que falta tiene un canto carmín y oro. El dibujo es fijo, sin tiempo:
//    durante el flash están quietos y nada en ellos se mueve. El canto solo
//    existe con el flash o con su imagen retenida (uRim), que solo se apaga.
//  - cuerpos (los pasajeros): cuando a uno lo sacan por la ventana se deshace
//    en ~0,3 s, con el borde encendido, mientras los pétalos toman su forma.

const RUIDO = /* glsl */ `
float gfxH3(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float gfxRuido(vec3 x) {
  vec3 i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(gfxH3(i), gfxH3(i + vec3(1, 0, 0)), f.x), mix(gfxH3(i + vec3(0, 1, 0)), gfxH3(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(gfxH3(i + vec3(0, 0, 1)), gfxH3(i + vec3(1, 0, 1)), f.x), mix(gfxH3(i + vec3(0, 1, 1)), gfxH3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}`;

// rim: { value } compartido con gfx.js (flash * .5 + imagen retenida * 1.6)
export function parcharBorrado(m, rim) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uRim = rim;
    sh.vertexShader = sh.vertexShader
      .replace('void main() {', 'varying vec3 vGfxL;\nvarying vec2 vGfxS;\nvoid main() {')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vGfxL = transformed;
        #ifdef USE_INSTANCING
          vGfxS = instanceMatrix[3].xz;
        #else
          vGfxS = modelMatrix[3].xz;
        #endif`);
    sh.fragmentShader = sh.fragmentShader
      .replace('void main() {', `uniform float uRim;\nvarying vec3 vGfxL;\nvarying vec2 vGfxS;\n${RUIDO}\nvoid main() {`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        // cuánto le falta a cada uno (fijo por persona: su sitio es la semilla)
        vec3 gfxQ = vGfxL + vec3(vGfxS * 1.37, 0.0);
        float gfxN = gfxRuido(gfxQ * vec3(7.0, 5.0, 7.0)) * 0.62 + gfxRuido(gfxQ * 17.0 + 3.1) * 0.38;
        float gfxE = 0.3 + 0.16 * fract(sin(dot(vGfxS, vec2(41.3, 17.9))) * 4375.85);
        // se borran desde arriba y desde las puntas: cabeza, hombros, manos
        gfxE += 0.2 * smoothstep(1.3, 1.95, vGfxL.y) + 0.14 * smoothstep(0.19, 0.29, abs(vGfxL.x)) * smoothstep(0.75, 0.55, vGfxL.y);
        gfxE -= 0.12 * smoothstep(1.0, 0.4, vGfxL.y) * step(abs(vGfxL.x), 0.19);
        if (gfxN < gfxE) discard;
        float gfxBorde = 1.0 - smoothstep(0.0, 0.085, gfxN - gfxE);
        // tinta: azul noche, casi negro; el flash la saca de la oscuridad sin volverla yeso
        diffuseColor.rgb = diffuseColor.rgb * vec3(0.2, 0.21, 0.3) + vec3(0.02, 0.018, 0.03);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        {
          float fr = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 2.4);
          totalEmissiveRadiance += vec3(1.0, 0.78, 0.46) * fr * uRim;
          // el borde de lo que falta arde: carmín por fuera, oro adentro
          vec3 brasa = mix(vec3(0.9, 0.08, 0.07), vec3(1.0, 0.7, 0.36), gfxBorde * gfxBorde);
          totalEmissiveRadiance += brasa * gfxBorde * min(uRim, 0.9) * 1.5; // tope: que arda, que no encandile
        }`);
  };
  m.customProgramCacheKey = () => 'gfx-borrado2';
  m.needsUpdate = true;
}

function parcharCuerpo(m, U) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uGfxBorra = U.uGfxBorra;
    sh.uniforms.uGfxCentro = U.uGfxCentro;
    sh.vertexShader = sh.vertexShader
      .replace('void main() {', 'varying vec3 vGfxW;\nvoid main() {')
      .replace('#include <project_vertex>', `#include <project_vertex>
        vGfxW = (modelMatrix * vec4(transformed, 1.0)).xyz;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('void main() {', `uniform float uGfxBorra;\nuniform vec3 uGfxCentro;\nvarying vec3 vGfxW;\n${RUIDO}\nvoid main() {`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float gfxBorde = 0.0;
        if (uGfxBorra > 0.0) {
          vec3 gfxQ = vGfxW - uGfxCentro;
          // se deshace de los pies hacia arriba y desde los bordes
          float gfxN = gfxRuido(gfxQ * 6.0) * 0.6 + gfxRuido(gfxQ * 18.0) * 0.4;
          gfxN += (gfxQ.y - 0.9) * 0.12;
          float gfxT = uGfxBorra * 1.3 - 0.12;
          if (gfxN < gfxT) discard;
          gfxBorde = 1.0 - smoothstep(0.0, 0.1, gfxN - gfxT);
        }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += mix(vec3(1.0, 0.14, 0.1), vec3(1.0, 0.8, 0.5), gfxBorde) * gfxBorde * 2.4 * (1.0 - 0.5 * uGfxBorra);`);
  };
  m.customProgramCacheKey = () => 'gfx-cuerpo';
  m.needsUpdate = true;
}

export function createDisolucion() {
  const cuerpos = new Map(); // grupo -> [uniformes de sus materiales]
  const activos = [];
  const DURA = .3;

  return {
    // Se llama la primera vez que se ve un cuerpo (antes de dibujarlo: sin tirones).
    preparar(body) {
      if (cuerpos.has(body)) return;
      const lista = [];
      body.traverse((o) => {
        if (!o.isMesh) return;
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          // solo materiales sin otro parche (el del hoyo, el de los borrados)
          if (!m?.isMeshStandardMaterial || (!m.userData.gfxCuerpo && m.customProgramCacheKey !== THREE.Material.prototype.customProgramCacheKey)) continue;
          if (!m.userData.gfxCuerpo) {
            m.userData.gfxCuerpo = { uGfxBorra: { value: 0 }, uGfxCentro: { value: new THREE.Vector3() } };
            parcharCuerpo(m, m.userData.gfxCuerpo);
          }
          lista.push(m.userData.gfxCuerpo);
        }
      });
      cuerpos.set(body, lista);
    },
    iniciar(body) {
      const lista = cuerpos.get(body);
      if (!lista || activos.some((a) => a.body === body)) return;
      activos.push({ body, lista, t: 0 });
    },
    update(dt) {
      for (let i = activos.length - 1; i >= 0; i--) {
        const a = activos[i];
        a.t += dt;
        const k = Math.min(1, a.t / DURA);
        for (const U of a.lista) {
          U.uGfxBorra.value = k * (2 - k);
          a.body.getWorldPosition(U.uGfxCentro.value);
        }
        if (k >= 1 || !a.body.visible) activos.splice(i, 1);
      }
    },
    limpiar() {
      cuerpos.clear();
      activos.length = 0;
    },
  };
}
