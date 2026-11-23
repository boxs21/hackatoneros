import * as THREE from 'three';
import { borradoGeometry } from './figura.js';
import { lambert, pixelTexture, seeded } from './ps1.js';
import { textura } from './texturas.js';

// Cómo se llevan a cada pasajero: un borrado lo agarra, lo levanta, lo azota
// y lo saca por la ventana. El vidrio revienta, queda el hoyo, la sangre y
// la luz del túnel entrando a ráfagas. Todo vive en ctx.stage.
//
//   const muertes = createMuertes(ctx);
//   muertes.start(pasajero, i);          // i = orden (0 Escolar … 3 Vendedor)
//   const m = muertes.update(dt, cam);   // { busy, lock, zoom, x, z }
//   muertes.yaRotas(pasajeros);          // punto de control: ventanas ya rotas

const WIN_Y = 1.9;
const WALL_X = 2.5;
const TRAMOS = [[-12.9, -8.75], [-7.25, -0.75], [0.75, 7.25], [8.75, 12.9]];
const ASTILLAS = 30; // por ventana
const MAX = 4;

// Cada uno muere distinto. golpes = segundos en que lo azotan contra el piso.
const VARIANTES = [
  { lanzar: .95, alto: .7, golpes: [] }, // Escolar: lo levantan del gorro y afuera
  { lanzar: 1.5, alto: .5, golpes: [.62] }, // Oficinista: un azote
  { lanzar: 1.55, alto: .15, golpes: [], arrastre: true }, // Señora: la arrastran por el piso
  { lanzar: 1.9, alto: .6, golpes: [.55, 1.1] }, // Vendedor: dos azotes
];
const ULTIMAS = [
  'ESCOLAR: ¡Oiga! ¡Oiga, ayúdem—',
  'OFICINISTA: ¡Mi celular! ¡Llame a alg—',
  'SEÑORA: ¡Mijo! ¡No me suelte, mij—',
  'VENDEDOR: ¡Apague esa cuestión! ¡Apáguel—',
];
const DESPUES = [
  'La mochila quedó en el piso. Su llavero sigue en tu bolsillo.',
  'El celular que tienes en la mano era de él.',
  'La estampita de la señora todavía está tibia.',
  'Quedaste solo. Cada flash los trajo. La puerta del fondo: la luz roja.',
];

// La ventana más cercana (z dentro de un tramo con vidrio).
function ventanaZ(z) {
  let best = 0;
  let bd = Infinity;
  for (const [a, b] of TRAMOS) {
    const c = THREE.MathUtils.clamp(z, a + .8, b - .8);
    if (Math.abs(c - z) < bd) { bd = Math.abs(c - z); best = c; }
  }
  return best;
}

function lienzo(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  draw(g, size, seeded(size * 31 + 5));
  return pixelTexture(c);
}

// Vidrio reventado: hoyo negro dentado, trizaduras y sangre corriendo hacia abajo.
function drawHoyo(g, n, rnd) {
  g.strokeStyle = '#dfeef2';
  g.lineWidth = 1;
  for (let i = 0; i < 14; i++) {
    const a = rnd() * Math.PI * 2;
    const r = n * (.32 + rnd() * .18);
    g.beginPath();
    g.moveTo(n / 2, n / 2);
    g.lineTo(n / 2 + Math.cos(a) * r, n / 2 + Math.sin(a) * r * .8);
    g.stroke();
  }
  g.fillStyle = '#020203';
  g.beginPath();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const r = n * (i % 2 ? .16 : .3) * (.8 + rnd() * .4);
    const x = n / 2 + Math.cos(a) * r;
    const y = n / 2 + Math.sin(a) * r * .8;
    if (i) g.lineTo(x, y); else g.moveTo(x, y);
  }
  g.closePath();
  g.fill();
  g.fillStyle = '#7a0c0c';
  for (let i = 0; i < 9; i++) {
    const x = Math.floor(n * (.25 + rnd() * .5));
    const y = Math.floor(n * (.5 + rnd() * .15));
    g.fillRect(x, y, 1 + Math.floor(rnd() * 2), Math.floor(n * (.15 + rnd() * .3)));
  }
}

function drawSangre(g, n, rnd) {
  for (let i = 0; i < 26; i++) {
    const a = rnd() * Math.PI * 2;
    const r = n * rnd() * rnd() * .48;
    const s = 1 + Math.floor(rnd() * (r < n * .15 ? 6 : 2));
    g.fillStyle = rnd() > .4 ? '#6e0a0a' : '#3d0606';
    g.fillRect(Math.floor(n / 2 + Math.cos(a) * r), Math.floor(n / 2 + Math.sin(a) * r), s, s);
  }
}

export function createMuertes(ctx) {
  const stage = ctx.stage;
  const group = new THREE.Group();
  stage.add(group);

  // ---- el que mata: un borrado con los brazos estirados
  const killer = new THREE.Group();
  const gris = lambert({ color: 0x8a8b90, emissive: 0x1a1a1e });
  killer.add(new THREE.Mesh(borradoGeometry(), gris));
  const face = new THREE.Mesh(new THREE.PlaneGeometry(.22, .26), lambert({ map: textura('borradoCara'), emissive: 0x111111 }));
  face.position.set(0, 1.73, .15);
  killer.add(face);
  const brazoGeo = new THREE.BoxGeometry(.08, .7, .09).translate(0, -.35, 0);
  for (const s of [-1, 1]) {
    const brazo = new THREE.Mesh(brazoGeo, gris);
    brazo.position.set(s * .25, 1.44, .04);
    brazo.rotation.x = -1.9;
    killer.add(brazo);
  }
  killer.scale.setScalar(1.14);
  killer.visible = false;
  group.add(killer);

  // ---- luces (todas creadas de antemano: sumar luces después recompila los shaders)
  const strobe = new THREE.PointLight(0xdfeaff, 0, 9, 1);
  const hoyoLuz = { '-1': new THREE.PointLight(0x9db8d8, 0, 7, 1.2), 1: new THREE.PointLight(0x9db8d8, 0, 7, 1.2) };
  const hoyos = { '-1': [], 1: [] }; // z de las ventanas rotas por lado
  group.add(strobe, hoyoLuz[-1], hoyoLuz[1]);

  // ---- marcas: hoyo en el vidrio, sangre en el asiento y en el piso
  const decal = (map) => lambert({ map, alphaTest: .5, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  const hoyoMat = decal(lienzo(32, drawHoyo));
  const sangreMat = decal(lienzo(24, drawSangre));
  const hoyoGeo = new THREE.PlaneGeometry(1.7, 1.25);
  const manchaGeo = new THREE.PlaneGeometry(1, 1);
  const marcas = [];
  for (let i = 0; i < MAX; i++) {
    const hoyo = new THREE.Mesh(hoyoGeo, hoyoMat);
    const asiento = new THREE.Mesh(manchaGeo, sangreMat);
    const piso = new THREE.Mesh(manchaGeo, sangreMat);
    asiento.rotation.x = piso.rotation.x = -Math.PI / 2;
    hoyo.visible = asiento.visible = piso.visible = false;
    group.add(hoyo, asiento, piso);
    marcas.push({ hoyo, asiento, piso });
  }

  // ---- astillas de vidrio
  const tri = new THREE.BufferGeometry();
  tri.setAttribute('position', new THREE.Float32BufferAttribute([0, .07, 0, -.05, -.04, 0, .06, -.03, 0], 3));
  tri.computeVertexNormals();
  const vidrio = lambert({ color: 0xcfe6ee, emissive: 0x2a3438, side: THREE.DoubleSide });
  const astillas = new THREE.InstancedMesh(tri, vidrio, MAX * ASTILLAS);
  astillas.frustumCulled = false;
  const shards = [];
  const o = new THREE.Object3D();
  o.scale.setScalar(0);
  o.updateMatrix();
  for (let i = 0; i < MAX * ASTILLAS; i++) {
    shards.push({ p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Vector3(), w: new THREE.Vector3(), live: false, size: 1 });
    astillas.setMatrixAt(i, o.matrix);
  }
  group.add(astillas);
  let volando = 0;

  function poner(sh, i) {
    o.position.copy(sh.p);
    o.rotation.set(sh.r.x, sh.r.y, sh.r.z);
    o.scale.setScalar(sh.size);
    o.updateMatrix();
    astillas.setMatrixAt(i, o.matrix);
  }

  // Deja la ventana rota. quieto = sin vuelo de astillas (ya pasó: punto de control).
  function romper(i, s, wz, px, pz, quieto) {
    const m = marcas[i];
    m.hoyo.position.set(s * (WALL_X - .045), WIN_Y, wz);
    m.hoyo.rotation.y = -s * Math.PI / 2;
    m.hoyo.rotation.z = (i - 1.5) * .3;
    m.asiento.position.set(s * 2.16, .525, wz);
    m.asiento.scale.set(.55, 1.5, 1);
    m.asiento.rotation.z = i * 1.3;
    m.hoyo.visible = m.asiento.visible = true;
    m.piso.position.set(px, .012, pz);
    m.piso.scale.setScalar(1.1 + i * .15);
    m.piso.rotation.z = i * 2.1;
    m.piso.visible = true;
    hoyos[s].push(wz);
    const L = hoyoLuz[s];
    L.position.set(s * 1.9, WIN_Y, hoyos[s].reduce((a, b) => a + b, 0) / hoyos[s].length);
    for (let k = 0; k < ASTILLAS; k++) {
      const idx = i * ASTILLAS + k;
      const sh = shards[idx];
      const adentro = k % 3 === 0;
      sh.size = .6 + Math.random() * 1.3;
      sh.r.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      if (quieto) {
        // vidrio molido sobre el asiento y el piso
        const enAsiento = k % 2 === 0;
        sh.p.set(s * (enAsiento ? 1.95 + Math.random() * .4 : 1.1 + Math.random() * .7), enAsiento ? .535 : .02, wz + (Math.random() - .5) * 1.6);
        sh.r.x = Math.PI / 2;
        sh.r.y = 0;
        sh.live = false;
      } else {
        sh.p.set(s * (WALL_X - .1), WIN_Y + (Math.random() - .5) * .9, wz + (Math.random() - .5) * 1.2);
        sh.v.set(s * (adentro ? -(.6 + Math.random() * 2.8) : 1 + Math.random() * 3), .5 + Math.random() * 2.6, (Math.random() - .3) * 3);
        sh.w.set((Math.random() - .5) * 20, (Math.random() - .5) * 20, (Math.random() - .5) * 20);
        sh.live = true;
        volando += 1;
      }
      poner(sh, idx);
    }
    astillas.instanceMatrix.needsUpdate = true;
  }

  function moverAstillas(dt) {
    if (!volando) return;
    shards.forEach((sh, i) => {
      if (!sh.live) return;
      sh.v.y -= 9.8 * dt;
      sh.p.addScaledVector(sh.v, dt);
      sh.r.addScaledVector(sh.w, dt);
      const ax = Math.abs(sh.p.x);
      const piso = ax > WALL_X ? -3 : ax > 1.9 ? .535 : .02;
      if (sh.p.y <= piso) {
        sh.p.y = piso;
        sh.r.x = Math.PI / 2;
        sh.r.y = 0;
        sh.live = false;
        volando -= 1;
        if (piso < 0) sh.size = 0;
      }
      poner(sh, i);
    });
    astillas.instanceMatrix.needsUpdate = true;
  }

  // El objeto del pasajero cae donde estaba parado.
  const CAIDO = { mochila: [.08, -Math.PI / 2, 0], maletin: [.05, -Math.PI / 2, 0], carro: [0, 0, -.12], chocolates: [0, 0, .18] };
  function soltar(p) {
    stage.attach(p.objeto);
    const [y, rx, rz] = CAIDO[p.objeto.userData.tipo] || [0, 0, 0];
    p.objeto.position.y = y;
    p.objeto.rotation.x = rx;
    p.objeto.rotation.z = rz;
  }

  let cur = null;
  let tiempo = 0;
  let shake = 0;
  const info = { busy: false, lock: false, zoom: false, x: 0, z: 0 };
  const from = new THREE.Vector3();
  const to = new THREE.Vector3();

  return {
    get busy() { return Boolean(cur); },

    start(p, i) {
      if (cur) return false;
      const s = Math.sign(p.x) || 1;
      const v = VARIANTES[i % VARIANTES.length];
      cur = { p, i, s, v, t: 0, wz: ventanaZ(p.z), golpe: 0, lanzado: false, roto: false, fuera: false, dicho: false, pisoX: p.x, pisoZ: p.z };
      p.gone = true;
      soltar(p);
      killer.position.set(p.x - s * .42, 0, p.z);
      killer.rotation.set(0, s * Math.PI / 2, 0);
      killer.visible = true;
      strobe.position.set(p.x * .4, 2.75, p.z + .4);
      ctx.audio.sfx('susto', { volume: .8 });
      ctx.audio.sfx('grito', { personaje: p.name, delay: .12 });
      ctx.hud.subtitle(ULTIMAS[i] || '', 1500);
      shake = .5;
      return true;
    },

    // Punto de control: ya se los llevaron a todos. Ventanas rotas, sin repetir la escena.
    yaRotas(pasajeros) {
      pasajeros.forEach((p, i) => {
        const s = Math.sign(p.x) || 1;
        p.gone = true;
        p.body.visible = false;
        soltar(p);
        romper(i, s, ventanaZ(p.z), p.x, p.z, true);
      });
    },

    update(dt, cam) {
      tiempo += dt;
      // el túnel pasando por las ventanas rotas: ráfagas de luz fría
      for (const s of [-1, 1]) {
        const n = hoyos[s].length;
        hoyoLuz[s].intensity = n ? .3 + Math.pow(Math.max(0, Math.sin(tiempo * 4.2 + s)), 10) * (1.6 + n * .5) : 0;
      }
      moverAstillas(dt);
      shake *= Math.max(0, 1 - dt * 5);
      cam.rotation.z = shake > .004 ? Math.sin(tiempo * 61) * shake * .09 : 0;

      info.busy = Boolean(cur);
      info.lock = false;
      info.zoom = false;
      if (!cur) {
        strobe.intensity = 0;
        return info;
      }

      const c = cur;
      const { p, s, v } = c;
      c.t += dt;
      const t = c.t;
      const root = p.root;
      const tImpacto = v.lanzar + .2;
      info.lock = t < Math.min(1.1, v.lanzar);
      info.zoom = t < tImpacto + .25; // la vista se cierra sobre lo que pasa
      info.x = root.position.x;
      info.z = root.position.z;

      // los tubos chisporrotean: se alcanza a ver, pero a tirones
      const chispa = Math.sin(t * 37) > .1 || Math.sin(t * 13) > .7;
      const vida = THREE.MathUtils.clamp((tImpacto + .9 - t) / .4, 0, 1);
      strobe.intensity = (chispa ? 3.4 : .55) * vida;

      if (t < v.lanzar) {
        // agarrado: arriba, pataleando
        const sube = Math.min(1, t / .28);
        let y = v.alto * sube * (2 - sube);
        let tumbado = 0;
        for (const g of v.golpes) {
          const k = t - g;
          if (k > 0 && k < .5) {
            const baja = k < .12 ? k / .12 : 1 - (k - .12) / .38;
            y *= 1 - baja;
            tumbado = Math.max(tumbado, baja);
            if (k >= .12 && c.golpe < g) {
              c.golpe = g;
              shake = 1;
              c.pisoX = root.position.x;
              c.pisoZ = root.position.z;
              ctx.audio.sfx('empujon', { volume: 1 });
              ctx.audio.sfx('crujido');
              ctx.audio.sfx('grito', { personaje: p.name, volume: .7, delay: .05 });
            }
          }
        }
        if (v.arrastre) {
          // boca arriba por el piso, hacia la pared, estirando los brazos
          const k = THREE.MathUtils.clamp((t - .3) / (v.lanzar - .3), 0, 1);
          tumbado = Math.min(1, t / .3);
          root.position.x = THREE.MathUtils.lerp(p.x, s * 1.55, k * k);
          killer.position.x = root.position.x - s * .4;
          c.pisoX = (p.x + root.position.x) / 2;
        }
        root.position.y = y + Math.sin(t * 43) * .02;
        root.rotation.x = -1.45 * tumbado;
        root.rotation.z = Math.sin(t * 23) * .16 * (1 - tumbado);
        p.head.rotation.x = -.7 + Math.sin(t * 31) * .2;
        p.armL.rotation.x = -2.5 + Math.sin(t * 29) * .6;
        p.armR.rotation.x = -2.5 + Math.cos(t * 33) * .6;
        killer.rotation.z = Math.sin(t * 40) * .04;
      } else if (t < tImpacto) {
        // lanzado contra el vidrio
        if (!c.lanzado) {
          c.lanzado = true;
          from.copy(root.position);
          to.set(s * (WALL_X - .1), 1.0, c.wz);
        }
        const k = (t - v.lanzar) / .2;
        root.position.lerpVectors(from, to, k * k);
        root.rotation.x -= dt * 16;
        root.rotation.z += dt * 9 * s;
      } else {
        if (!c.roto) {
          c.roto = true;
          romper(c.i, s, c.wz, c.pisoX, c.pisoZ, false);
          shake = 1.4;
          ctx.audio.sfx('vidrio');
          ctx.audio.sfx('desaparece', { personaje: p.name, delay: .1 });
        }
        // afuera: el tren lo deja atrás de un tirón
        const k = t - tImpacto;
        if (k < .32) {
          root.position.x += s * dt * 9;
          root.position.z += dt * 34 * Math.min(1, k * 8);
          root.position.y -= dt * 1.5;
          root.rotation.x -= dt * 20;
        } else if (!c.fuera) {
          c.fuera = true;
          p.body.visible = false;
        }
        // el que lo hizo se da vuelta a mirarte
        const yaw = Math.atan2(cam.position.x - killer.position.x, cam.position.z - killer.position.z);
        const diff = Math.atan2(Math.sin(yaw - killer.rotation.y), Math.cos(yaw - killer.rotation.y));
        killer.rotation.y += diff * Math.min(1, dt * 5);
        killer.rotation.z = 0;
        if (k > .75 && !c.dicho) {
          c.dicho = true;
          ctx.hud.subtitle(DESPUES[c.i] || '', 3400);
        }
        if (k > 1.3) {
          killer.visible = false;
          strobe.intensity = 0;
          cur = null;
        }
      }
      return info;
    },
  };
}
