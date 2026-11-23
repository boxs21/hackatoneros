import * as THREE from 'three';

// Materiales del modo pintura. Reemplazan a lambert()/basic() de world/ps1.js
// sin que los estados se enteren: mismas opciones, mismas propiedades
// (color, emissive, map, opacity) para que el código que las anima siga igual.
const c = new THREE.Color();
const hsl = { h: 0, s: 0, l: 0 };

export function pintura(opts = {}) {
  c.set(opts.color ?? 0xffffff).getHSL(hsl);
  // gris claro sin textura = fierro (barras, marcos): refleja el vagón
  const metal = !opts.map && opts.emissive === undefined && !opts.transparent
    && hsl.l > .35 && hsl.l < .9 && hsl.s < .06;
  const roughness = opts.transparent ? .12 : metal ? .42 : opts.map ? .74 : .62;
  return new THREE.MeshStandardMaterial({ ...opts, roughness, metalness: metal ? .9 : 0 });
}

// Lo que no recibe luz y es de color plano es una fuente de luz (tubos, salida,
// emergencia): se pasa de 1.0 para que el bloom y los rayos lo agarren.
export function luz(opts = {}) {
  const m = new THREE.MeshBasicMaterial(opts);
  if (!opts.map && !opts.transparent) m.color.multiplyScalar(2.4);
  return m;
}
