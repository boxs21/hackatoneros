import * as THREE from 'three';
import { lambert, pixelTexture, seeded } from './ps1.js';

// SANGRE. Manchas pegadas a las superficies del vagón: charcos que crecen,
// salpicaduras con gotas estiradas, chorreos que bajan por la pared, rastros de
// arrastre, manos en los vidrios y rocío fino en el techo.
// Ocho dibujos en una sola textura (atlas) y una malla instanciada por dibujo:
// se pueden poner cientos sin costo.
//
//   const sangre = createSangre(ctx.stage);
//   sangre.golpe(x, z);            // lo azotaron contra el piso aquí
//   sangre.ventana(lado, z);       // salió por la ventana de este lado (-1 / 1)
//   sangre.arrastre(x0, z0, x1, z1);
//   sangre.vestir(semilla);        // vagón ya ensangrentado (otros vagones)
//   sangre.update(dt);             // los charcos frescos siguen creciendo

const T = 48; // píxeles por dibujo
const COLS = 4;
const TIPOS = ['charco', 'salpica', 'chorreo', 'arrastre', 'mano', 'rocio', 'gotas', 'charco2'];
const CAP = 80; // manchas por dibujo

const OSCURA = '#2e0303'; // borde seco
const MEDIA = '#560505';
const FRESCA = '#7c0909';
const BRILLO = '#a8170f';

function mancha(g, cx, cy, r, rnd, color, chata = 1) {
  const n = 14;
  g.fillStyle = color;
  g.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = r * (.72 + rnd() * .5);
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr * chata;
    if (i) g.lineTo(x, y); else g.moveTo(x, y);
  }
  g.closePath();
  g.fill();
}

function gota(g, x, y, r, color) {
  g.fillStyle = color;
  g.fillRect(Math.round(x - r), Math.round(y - r), Math.max(1, Math.round(r * 2)), Math.max(1, Math.round(r * 2)));
}

const DIBUJOS = {
  // charco: borde seco, centro fresco, un par de brillos
  charco(g, rnd) {
    mancha(g, 24, 24, 19, rnd, OSCURA);
    mancha(g, 24, 24, 16, rnd, MEDIA);
    mancha(g, 23, 25, 10, rnd, FRESCA);
    for (let i = 0; i < 3; i++) gota(g, 16 + rnd() * 14, 17 + rnd() * 12, .6, BRILLO);
    for (let i = 0; i < 7; i++) gota(g, 4 + rnd() * 40, 4 + rnd() * 40, .5 + rnd(), MEDIA);
  },
  // salpicadura: del centro salen gotas estiradas, más chicas mientras más lejos
  salpica(g, rnd) {
    mancha(g, 24, 24, 7, rnd, MEDIA);
    mancha(g, 24, 24, 4, rnd, FRESCA);
    for (let i = 0; i < 34; i++) {
      const a = rnd() * Math.PI * 2;
      const d = 6 + rnd() * 16;
      const largo = 1 + rnd() * 5 * (d / 22);
      g.strokeStyle = rnd() > .5 ? MEDIA : OSCURA;
      g.lineWidth = d < 12 ? 2 : 1;
      g.beginPath();
      g.moveTo(24 + Math.cos(a) * d, 24 + Math.sin(a) * d);
      g.lineTo(24 + Math.cos(a) * (d + largo), 24 + Math.sin(a) * (d + largo));
      g.stroke();
    }
  },
  // chorreo: arriba la mancha, hacia abajo hilos de distinto largo con una gota al final
  chorreo(g, rnd) {
    mancha(g, 24, 6, 9, rnd, MEDIA, .45);
    mancha(g, 24, 5, 15, rnd, OSCURA, .22);
    for (let i = 0; i < 9; i++) {
      const x = 5 + Math.floor(rnd() * 38);
      const largo = 8 + Math.floor(rnd() * 34);
      const ancho = rnd() > .7 ? 2 : 1;
      g.fillStyle = rnd() > .5 ? MEDIA : OSCURA;
      g.fillRect(x, 4, ancho, largo);
      gota(g, x + ancho / 2, 4 + largo, 1, FRESCA);
    }
  },
  // arrastre: alguien fue llevado por el piso. Líneas paralelas que se secan
  arrastre(g, rnd) {
    for (let y = 12; y < 36; y++) {
      if (rnd() > .78) continue;
      let x = Math.floor(rnd() * 5);
      const fin = 34 + Math.floor(rnd() * 13);
      g.fillStyle = y % 5 === 0 ? FRESCA : rnd() > .5 ? MEDIA : OSCURA;
      while (x < fin) {
        const tramo = 2 + Math.floor(rnd() * 9 * (1 - x / 60));
        g.fillRect(x, y, tramo, 1);
        x += tramo + (rnd() > .6 ? 1 + Math.floor(rnd() * 3 * (x / 24)) : 0);
      }
    }
    mancha(g, 7, 24, 7, rnd, MEDIA, 1.5);
  },
  // mano: palma, cinco dedos y el resbalón hacia abajo
  mano(g, rnd) {
    mancha(g, 24, 20, 7, rnd, MEDIA, 1.1);
    const dedos = [[13, 16, -1.9], [17, 10, -1.75], [23, 8, -1.57], [29, 10, -1.4], [34, 18, -.9]];
    for (const [x, y, a] of dedos) {
      const largo = 7 + rnd() * 3;
      g.strokeStyle = MEDIA;
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(a) * largo, y + Math.sin(a) * largo);
      g.stroke();
      // resbaló: cada dedo deja su línea
      g.fillStyle = OSCURA;
      g.fillRect(Math.round(x), Math.round(y), 1, 12 + Math.floor(rnd() * 18));
    }
    g.fillStyle = OSCURA;
    g.fillRect(21, 24, 6, 14 + Math.floor(rnd() * 8));
    gota(g, 24, 21, 1, FRESCA);
  },
  // rocío: puntos finos, lo que llega al techo
  rocio(g, rnd) {
    for (let i = 0; i < 110; i++) {
      const a = rnd() * Math.PI * 2;
      const d = rnd() * rnd() * 22;
      gota(g, 24 + Math.cos(a) * d, 24 + Math.sin(a) * d, d < 7 && rnd() > .6 ? 1 : .5, rnd() > .4 ? MEDIA : OSCURA);
    }
  },
  // gotas: el camino de alguien que iba goteando
  gotas(g, rnd) {
    for (let i = 0; i < 7; i++) {
      const x = 5 + i * 6 + rnd() * 3;
      const y = 22 + (rnd() - .5) * 10;
      const r = 1 + rnd() * 1.6;
      mancha(g, x, y, r + 1, rnd, OSCURA);
      mancha(g, x, y, r, rnd, MEDIA);
      for (let k = 0; k < 3; k++) gota(g, x + (rnd() - .5) * 8, y + (rnd() - .5) * 8, .5, OSCURA);
    }
  },
  // charco largo, con el resbalón de un zapato
  charco2(g, rnd) {
    mancha(g, 24, 26, 17, rnd, OSCURA, .6);
    mancha(g, 24, 26, 13, rnd, MEDIA, .55);
    mancha(g, 20, 27, 7, rnd, FRESCA, .6);
    g.fillStyle = OSCURA;
    for (let i = 0; i < 5; i++) g.fillRect(28 + i * 3, 8 + i, 2, 12 - i);
  },
};

let lienzo = null;
function atlas() {
  if (!lienzo) {
    lienzo = document.createElement('canvas');
    lienzo.width = T * COLS;
    lienzo.height = T * Math.ceil(TIPOS.length / COLS);
    const g = lienzo.getContext('2d');
    TIPOS.forEach((tipo, i) => {
      g.save();
      g.translate((i % COLS) * T, Math.floor(i / COLS) * T);
      g.beginPath();
      g.rect(1, 1, T - 2, T - 2); // margen: los dibujos vecinos no se pisan
      g.clip();
      DIBUJOS[tipo](g, seeded(977 + i * 131));
      g.restore();
    });
  }
  return pixelTexture(lienzo);
}

const PARED_X = 2.433; // justo delante de la pared (2,44) y del vidrio (2,48)

export function createSangre(stage, { cap = CAP } = {}) {
  const group = new THREE.Group();
  stage.add(group);
  const material = lambert({ map: atlas(), alphaTest: .5, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  const filas = Math.ceil(TIPOS.length / COLS);
  const mallas = {};
  TIPOS.forEach((tipo, i) => {
    const geo = new THREE.PlaneGeometry(1, 1);
    const uv = geo.attributes.uv;
    const col = i % COLS;
    const fila = Math.floor(i / COLS);
    for (let k = 0; k < uv.count; k++) {
      uv.setXY(k, (col + uv.getX(k)) / COLS, 1 - (fila + 1 - uv.getY(k)) / filas);
    }
    const mesh = new THREE.InstancedMesh(geo, material, cap);
    mesh.count = 0;
    mesh.frustumCulled = false;
    group.add(mesh);
    mallas[tipo] = mesh;
  });

  const o = new THREE.Object3D();
  const frescos = []; // charcos que todavía crecen
  let total = 0;
  const rnd = Math.random;

  function escribir(m) {
    o.position.set(m.x, m.y, m.z);
    o.rotation.set(m.rx, m.ry, m.rz);
    const k = m.k ?? 1;
    o.scale.set(m.sx * k, m.sy * k, 1);
    o.updateMatrix();
    const mesh = mallas[m.tipo];
    mesh.setMatrixAt(m.i, o.matrix);
    mesh.instanceMatrix.needsUpdate = true;
  }

  function poner(tipo, x, y, z, rx, ry, rz, sx, sy, crece = 0) {
    const mesh = mallas[tipo];
    if (mesh.count >= cap) return null;
    const m = { tipo, i: mesh.count, x, y, z, rx, ry, rz, sx, sy, k: crece ? .35 : 1, crece };
    mesh.count += 1;
    total += 1;
    escribir(m);
    if (crece) frescos.push(m);
    return m;
  }

  // Cada mancha un pelo más arriba que la anterior: las que se pisan no parpadean.
  const capa = () => (total % 40) * .0005;
  const piso = (tipo, x, z, tam = 1, giro = rnd() * 6.28, crece = 0) =>
    poner(tipo, x, .012 + capa(), z, -Math.PI / 2, 0, giro, tam, tam, crece);
  const asiento = (tipo, s, z, tam = .5, giro = rnd() * 6.28) =>
    poner(tipo, s * 2.16, .527 + capa(), z, -Math.PI / 2, 0, giro, Math.min(tam, .54), tam);
  const pared = (tipo, s, y, z, ancho = 1, alto = ancho, giro = 0) =>
    poner(tipo, s * (PARED_X - capa()), y, z, 0, -s * Math.PI / 2, giro, ancho, alto);
  const techo = (tipo, x, z, tam = 1, giro = rnd() * 6.28) =>
    poner(tipo, x, 3.055 - capa(), z, Math.PI / 2, 0, giro, tam, tam);

  const api = {
    group,
    piso, asiento, pared, techo,

    // Lo azotaron contra el piso: charco que crece, salpicadura alrededor y rocío.
    golpe(x, z, fuerza = 1) {
      piso('charco', x, z, .75 * fuerza, undefined, .28);
      piso('salpica', x + (rnd() - .5) * .3, z + (rnd() - .5) * .3, 1.5 * fuerza);
      piso('salpica', x + (rnd() - .5) * .9, z + (rnd() - .5) * .9, .9);
      piso('rocio', x + (rnd() - .5) * 1.2, z + (rnd() - .5) * 1.2, 1.4);
      const s = Math.sign(x) || 1;
      asiento('rocio', s, z + (rnd() - .5) * .6, .5);
      techo('rocio', x * .7, z, 1.1);
    },

    // Lo llevan por el piso de (x0, z0) a (x1, z1).
    arrastre(x0, z0, x1, z1) {
      const largo = Math.hypot(x1 - x0, z1 - z0);
      const pasos = Math.max(1, Math.round(largo / .5));
      const giro = Math.atan2(-(z1 - z0), x1 - x0);
      for (let i = 0; i < pasos; i++) {
        const k = (i + .5) / pasos;
        piso('arrastre', x0 + (x1 - x0) * k, z0 + (z1 - z0) * k, .75, giro + (rnd() - .5) * .15);
      }
      piso('gotas', x0, z0, .7, giro);
    },

    // Salió por la ventana del lado s: el vidrio, la pared, el asiento y el techo quedan marcados.
    ventana(s, z) {
      pared('salpica', s, 1.92, z + .15, 1.9, 1.5, rnd() * 6.28);
      pared('salpica', s, 2.25, z - .7, 1.1, 1.1, rnd() * 6.28);
      pared('rocio', s, 2.72, z, 1.6, .55);
      pared('chorreo', s, 1.0, z - .25, 1.1, .8);
      pared('chorreo', s, 1.02, z + .6, .7, .75);
      // se agarró del marco: dos manos que resbalan
      pared('mano', s, 1.78, z - 1.02, .34, .5, s * .25);
      pared('mano', s, 1.62, z + 1.0, .32, .5, -s * .4);
      asiento('charco', s, z, .7);
      asiento('salpica', s, z + .7, .8);
      asiento('gotas', s, z - .8, .6);
      techo('salpica', s * 1.5, z, 1.3);
      techo('rocio', s * .9, z + .4, 1.5);
      piso('charco2', s * 1.55, z, .8, 0, .2);
      piso('gotas', s * 1.0, z + .2, .8, s > 0 ? 0 : Math.PI);
      piso('rocio', s * .7, z - .3, 1.3);
    },

    // Un vagón por el que ya pasaron: sangre vieja por todas partes.
    // piso: false para vagones sin piso firme (el vagón roto).
    vestir(semilla = 1, { piso: conPiso = true, cuanto = 1 } = {}) {
      const r = seeded(semilla * 7919 + 13);
      const lado = () => (r() > .5 ? 1 : -1);
      // z dentro de un tramo con ventana (no en las puertas)
      const zVentana = () => {
        const tramos = [[-12, -9.4], [-6.6, -1.4], [1.4, 6.6], [9.4, 12]];
        const [a, b] = tramos[Math.floor(r() * tramos.length)];
        return a + r() * (b - a);
      };
      const zPuerta = () => [-8, 0, 8][Math.floor(r() * 3)] + (r() - .5) * 1.1;
      const n = (base) => Math.round(base * cuanto);
      if (conPiso) {
        for (let i = 0; i < n(9); i++) piso(r() > .5 ? 'charco' : 'charco2', (r() - .5) * 2.3, -11.5 + r() * 22.5, .6 + r() * .9, r() * 6.28);
        for (let i = 0; i < n(7); i++) piso('salpica', (r() - .5) * 2.4, -11.5 + r() * 22.5, .9 + r() * 1.1, r() * 6.28);
        for (let i = 0; i < n(10); i++) piso('gotas', (r() - .5) * 2.2, -11.5 + r() * 22.5, .6 + r() * .4, r() * 6.28);
        // a alguien lo llevaron hasta la puerta
        for (let i = 0; i < n(4); i++) {
          const s = lado();
          const z = zPuerta();
          api.arrastreSembrado(r, (r() - .5) * .8, z + (r() - .5) * 3, s * 2.1, z);
          pared('mano', s, 1.2 + r() * .5, z + (r() - .5) * .5, .34, .5, (r() - .5) * .8);
        }
      }
      for (let i = 0; i < n(14); i++) pared('mano', lado(), 1.5 + r() * .75, r() > .3 ? zVentana() : zPuerta(), .3 + r() * .08, .46 + r() * .1, (r() - .5) * 1.1);
      for (let i = 0; i < n(10); i++) pared('chorreo', lado(), .98 + r() * .1, zVentana(), .7 + r() * .6, .7 + r() * .2);
      for (let i = 0; i < n(9); i++) pared('salpica', lado(), 1.7 + r() * .7, zVentana(), 1 + r() * 1, 1 + r() * .6, r() * 6.28);
      for (let i = 0; i < n(6); i++) pared('rocio', lado(), 2.72, zVentana(), 1.4, .55);
      for (let i = 0; i < n(7); i++) techo(r() > .5 ? 'salpica' : 'rocio', (r() - .5) * 3, -11 + r() * 22, 1 + r() * .8, r() * 6.28);
      if (conPiso) for (let i = 0; i < n(8); i++) asiento(r() > .5 ? 'charco' : 'salpica', lado(), zVentana(), .5 + r() * .4, r() * 6.28);
      return api;
    },

    arrastreSembrado(r, x0, z0, x1, z1) {
      const pasos = Math.max(1, Math.round(Math.hypot(x1 - x0, z1 - z0) / .5));
      const giro = Math.atan2(-(z1 - z0), x1 - x0);
      for (let i = 0; i < pasos; i++) {
        const k = (i + .5) / pasos;
        piso('arrastre', x0 + (x1 - x0) * k, z0 + (z1 - z0) * k, .75, giro + (r() - .5) * .15);
      }
    },

    // Los charcos frescos siguen abriéndose unos segundos.
    update(dt) {
      for (let i = frescos.length - 1; i >= 0; i--) {
        const m = frescos[i];
        m.k = Math.min(1.45, m.k + dt * m.crece);
        escribir(m);
        if (m.k >= 1.45) frescos.splice(i, 1);
      }
    },
  };
  return api;
}
