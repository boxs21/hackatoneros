import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { lambert } from './ps1.js';
import { cara, textura } from './texturas.js';

// Cuerpos low-poly. El frente de la figura mira hacia +z.

const flat = (g) => {
  const n = g.index ? g.toNonIndexed() : g;
  if (n !== g) g.dispose();
  return n;
};

// Geometría única (para InstancedMesh): un borrado, alto y flaco, brazos colgando.
export function borradoGeometry() {
  const parts = [
    new THREE.BoxGeometry(.12, .86, .14).translate(-.09, .43, 0),
    new THREE.BoxGeometry(.12, .86, .14).translate(.09, .43, 0),
    new THREE.CylinderGeometry(.19, .15, .66, 6).scale(1, 1, .62).translate(0, 1.18, 0),
    new THREE.BoxGeometry(.08, .78, .09).rotateZ(.05).translate(-.25, 1.06, .02),
    new THREE.BoxGeometry(.08, .78, .09).rotateZ(-.05).translate(.25, 1.06, .02),
    new THREE.CylinderGeometry(.05, .06, .1, 5).translate(0, 1.55, 0),
    new THREE.IcosahedronGeometry(.15, 0).scale(.9, 1.25, 1).translate(0, 1.73, .02),
  ].map(flat);
  const g = mergeGeometries(parts);
  parts.forEach((p) => p.dispose());
  return g;
}

// Pasajero con ropa, cara y su objeto (que después queda en el piso).
export function createFigura({ ropa, pantalon = 0x26272b, piel = '#c49a7c', pelo = '#2a1d16', extra, alto = 1 }) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const m = (color) => lambert({ color });
  const add = (geo, mat, x, y, z) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    body.add(mesh);
    return mesh;
  };
  const tela = m(ropa);
  const pierna = m(pantalon);
  const pielMat = m(new THREE.Color(piel).getHex());
  add(new THREE.BoxGeometry(.13, .82, .15), pierna, -.09, .41, 0);
  add(new THREE.BoxGeometry(.13, .82, .15), pierna, .09, .41, 0);
  add(new THREE.CylinderGeometry(.21, .17, .64, 6).scale(1, 1, .65), tela, 0, 1.14, 0);
  const armL = add(new THREE.BoxGeometry(.09, .6, .1).translate(0, -.28, 0), tela, -.26, 1.42, 0);
  const armR = add(new THREE.BoxGeometry(.09, .6, .1).translate(0, -.28, 0), tela, .26, 1.42, 0);
  add(new THREE.BoxGeometry(.08, .1, .08), pielMat, 0, 1.5, 0);
  const faceMats = [pielMat, pielMat, lambert({ color: new THREE.Color(pelo).getHex() }), pielMat,
    lambert({ map: cara({ skin: piel, hair: pelo, extra }) }), lambert({ color: new THREE.Color(pelo).getHex() })];
  const head = add(new THREE.BoxGeometry(.2, .24, .21), faceMats, 0, 1.67, 0);
  body.scale.setScalar(alto);
  return { root, body, head, armL, armR };
}

// Objetos que deja cada pasajero.
export function createObjeto(tipo) {
  const g = new THREE.Group();
  const add = (geo, color, x, y, z, mat) => {
    const mesh = new THREE.Mesh(geo, mat || lambert({ color }));
    mesh.position.set(x, y, z);
    g.add(mesh);
    return mesh;
  };
  if (tipo === 'mochila') {
    add(new THREE.BoxGeometry(.3, .38, .15), 0x2e5aa8, 0, .19, 0);
    add(new THREE.BoxGeometry(.22, .16, .06), 0xe1b12c, 0, .12, .09);
    add(new THREE.BoxGeometry(.04, .3, .03), 0x1b1b1d, -.1, .2, -.09);
    add(new THREE.BoxGeometry(.04, .3, .03), 0x1b1b1d, .1, .2, -.09);
  } else if (tipo === 'maletin') {
    add(new THREE.BoxGeometry(.42, .3, .1), 0x3b2418, 0, .15, 0);
    add(new THREE.BoxGeometry(.14, .04, .03), 0x111111, 0, .32, 0);
    add(new THREE.BoxGeometry(.42, .02, .11), 0xb59a52, 0, .24, 0);
  } else if (tipo === 'carro') {
    add(new THREE.BoxGeometry(.36, .45, .28), 0, 0, .38, 0, lambert({ map: textura('asiento', 2, 2) }));
    add(new THREE.CylinderGeometry(.08, .08, .04, 6).rotateZ(Math.PI / 2), 0x111111, -.2, .08, -.08);
    add(new THREE.CylinderGeometry(.08, .08, .04, 6).rotateZ(Math.PI / 2), 0x111111, .2, .08, -.08);
    add(new THREE.BoxGeometry(.03, .5, .03), 0x999999, 0, .75, -.15);
    add(new THREE.BoxGeometry(.3, .03, .03), 0x999999, 0, 1, -.15);
    add(new THREE.IcosahedronGeometry(.08, 0), 0x3f8a2e, -.06, .66, .02);
    add(new THREE.IcosahedronGeometry(.07, 0), 0xd2481f, .08, .64, -.04);
    add(new THREE.BoxGeometry(.05, .18, .05), 0x58a63a, .02, .7, .06);
  } else if (tipo === 'chocolates') {
    add(new THREE.BoxGeometry(.46, .06, .3), 0x7a4a2a, 0, .03, 0);
    const colors = [0xc23a33, 0xe1b12c, 0x3f8ad6, 0x7a4fa0, 0xc23a33, 0xe1b12c];
    colors.forEach((c, i) => add(new THREE.BoxGeometry(.12, .05, .07), c, -.15 + (i % 3) * .15, .09, i < 3 ? -.07 : .07));
  }
  return g;
}
