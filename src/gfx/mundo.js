import * as THREE from 'three';
import { crearCielo } from './cielo.js';
import { createEscenarios } from './escenarios.js';

// "El otro lado": lo que hay afuera cuando se corta la luz. El túnel ya no
// está; el vagón quedó detenido sobre un mar quieto, bajo un eclipse.
//  - cielo, eclipse, mar, bruma, nubes, cordillera y postes hundidos: cielo.js
//  - lo que se para encima del mar (distinto en cada vagón), la carrocería negra
//    que tapa las rendijas y lo que lleva el viento: escenarios.js
// Nada de esto ilumina el interior: adentro sigue oscuro.
// adelante y a la izquierda (30°): desde donde partes cae en una ventana, no detrás
// de una puerta, y se va viendo por las siguientes al caminar por el pasillo
export const SOL = new THREE.Vector3(-.49, .12, -.85).normalize(); // bajo: desde el pasillo cae dentro de la ventana

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
  // cielo y mar, la luna que tapa el eclipse (escribe profundidad) y los postes
  const { domo, luna, postes } = crearCielo(u);

  // lo que se para encima del mar, distinto en cada vagón, y la carrocería
  const escenarios = createEscenarios(u, group, SOL);

  group.add(domo, luna, postes);
  return { group, u, hojaU: escenarios.hojaU, escenarios, tapaPiso: escenarios.tapaPiso, foso: escenarios.foso };
}
