// Extra · Vagón del Oficinista: el vagón roto (parkour). Dueño: Camilo.
//
// Jugabilidad:
// - El vagón se partió: no hay piso, abajo solo hay vías y una luz roja. Quedan
//   pedazos sueltos (piso, asientos, una puerta, maletas, un carro que flota).
// - [Espacio] salta. Está oscuro: los bordes amarillos casi no se ven.
// - "Desbloquear la visión": cada foto [F] deja iluminados para siempre los bordes
//   de los pedazos que tienes adelante (hasta REVELA m). Para ver los siguientes,
//   otra foto. El flash sigue siendo la mecánica, pero lo que ya viste no se pierde.
// - Screamer: la primera vez que pisas el pedazo SCREAMER, una cara se te tira encima
//   (no te atrapa, solo asusta).
// - Caer no duele: vuelves al último pedazo firme en un instante.
// - Si te quedas quieto mucho rato en un pedazo, algo sube del vacío a buscarte.
// - Al fondo, el maletín del Oficinista flota junto a la puerta. Sigue el Vendedor.
// Ver mechanics/parkour.js para el salto (con "coyote time" y "buffer", perdonador).
import * as THREE from 'three';
import { createFlash } from '../mechanics/flash.js';
import { createParkour } from '../mechanics/parkour.js';
import { crearBolsillo } from '../mechanics/bolsillo.js';
import { basic, lambert, seeded } from '../world/ps1.js';
import { textura } from '../world/texturas.js';
import { setupVagon } from '../world/vagonEscena.js';
import { createObjeto, borradoGeometry } from '../world/figura.js';
import { createScare, caughtFrame } from '../world/susto.js';

// [x, z, ancho, largo, altura del borde de arriba, tipo, opciones]
const PEDAZOS = [
  [0, 11.4, 4.6, 3.2, 0, 'piso', { inicio: true }],
  [-1.7, 8.4, .8, 1.5, .45, 'asiento'],
  [-.2, 6.7, 1.3, .9, .2, 'puerta'],
  [1.4, 5.0, 1.5, 1.4, -.1, 'piso'],
  [.3, 3.4, .8, .7, .62, 'maleta'],
  [-1.2, 1.8, 1.6, 1.4, .3, 'piso'],
  [.9, .1, .9, 1.3, .8, 'asiento'],
  [.2, -1.6, .8, .8, .55, 'carro', { dy: .22, speed: 1.1 }],
  [-1.1, -3.3, 1.5, 1.6, .1, 'piso'],
  [.9, -5.0, .8, .8, .55, 'maleta'],
  [-.6, -6.6, 1.4, 1.2, .25, 'piso'],
  [1.15, -8.3, .9, 1.4, .55, 'asiento'],
  [-.2, -9.9, 1.2, .9, .3, 'puerta'],
  [0, -11.8, 4.6, 2.2, 0, 'piso', { fin: true }],
];
const REVELA = 8; // m: hasta dónde deja iluminados los bordes cada foto
const CERCA = 1.5; // m: sin foto, el borde solo se ve si estás encima
const SCREAMER = 8; // índice en PEDAZOS: el piso de la mitad, después del carro que flota
const QUIETO = 7; // s quieto en un pedazo antes de que suba algo (tiempo para mirar y calcular)
const AGARRA = 11; // s quieto: te agarra

let S = null;

export default {
  id: 'vagonOficinista',
  next: 'vagonVendedor',
  hint: 'Saca una foto [F] hacia adelante: los pedazos que alumbras quedan marcados. Salta con Espacio.',
  autoAdvance: true,
  enter(ctx, data = {}) {
    ctx.audio.ambiente('tunel');
    const scene = setupVagon(ctx, { z: 11, ambient: .1, fogFar: 16, roto: true });
    const stage = ctx.stage;
    const mats = scene.vagon.parts.mats;

    // ---- el vacío: vías abajo y luz roja que sube
    const vias = new THREE.Group();
    const piedra = lambert({ map: textura('tunel', 2, 10) });
    const riel = lambert({ color: 0x55504a });
    vias.add(new THREE.Mesh(new THREE.BoxGeometry(5, .2, 30), piedra));
    for (const x of [-.7, .7]) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(.08, .12, 30), riel);
      r.position.set(x, .16, 0);
      vias.add(r);
    }
    vias.position.y = -5;
    stage.add(vias);
    for (const z of [8, 0, -8]) {
      const l = new THREE.PointLight(0xff2a14, 3, 9, 1.2);
      l.position.set(0, -3.5, z);
      stage.add(l);
    }

    // ---- los pedazos
    const rnd = seeded(13);
    const platforms = PEDAZOS.map(([x, z, w, d, top, tipo, opt = {}]) => {
      const h = tipo === 'piso' ? .2 : tipo === 'maleta' ? .5 : tipo === 'carro' ? .3 : .15;
      const mat = tipo === 'asiento' ? mats.asiento : tipo === 'puerta' ? mats.puerta
        : tipo === 'maleta' ? lambert({ color: [0x3b2418, 0x2d3e6e, 0x5a2a2a][Math.floor(rnd() * 3)] }) : mats.suelo;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      mesh.position.set(x, top - h / 2, z);
      // roto y torcido (solo se ve: el choque usa la caja recta, así nadie se resbala)
      if (!opt.inicio && !opt.fin) mesh.rotation.set((rnd() - .5) * .08, (rnd() - .5) * .25, (rnd() - .5) * .08);
      stage.add(mesh);
      // borde amarillo de seguridad: se ve de cerca (o con el flash)
      const edgeMat = basic({ color: 0xf2b705, transparent: true, opacity: 0, fog: false, depthWrite: false });
      for (const [ex, ez, ew, ed] of [[0, -d / 2, w, .04], [0, d / 2, w, .04], [-w / 2, 0, .04, d], [w / 2, 0, .04, d]]) {
        const e = new THREE.Mesh(new THREE.BoxGeometry(ew, .02, ed), edgeMat);
        e.position.set(ex, h / 2 + .012, ez);
        mesh.add(e);
      }
      if (tipo === 'asiento') {
        const back = new THREE.Mesh(new THREE.BoxGeometry(w * .2, .45, d), mats.respaldo);
        back.position.set(x > 0 ? w * .4 : -w * .4, .28, 0);
        mesh.add(back);
      }
      if (tipo === 'carro') {
        const carro = createObjeto('carro');
        carro.position.set(0, -h / 2 - .02, 0);
        carro.scale.setScalar(1.3);
        mesh.add(carro);
      }
      return {
        minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, top, h, mesh, edgeMat,
        cx: x, cz: z, baseTop: top, dy: opt.dy || 0, speed: opt.speed || 1, phase: rnd() * 6, inicio: opt.inicio, fin: opt.fin,
      };
    });

    // ---- cosas raras: hojas flotando quietas, manillas hacia arriba, reloj al revés, maletín
    const hoja = lambert({ color: 0xbdb8aa, side: THREE.DoubleSide }); // solo se ven con luz
    for (let i = 0; i < 34; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(.21, .29), hoja);
      m.position.set((rnd() - .5) * 4.2, .4 + rnd() * 2.4, 12 - rnd() * 24);
      m.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
      stage.add(m);
    }
    const P = scene.vagon.parts;
    const o = new THREE.Object3D();
    P.straps.list.forEach(([x, z], i) => {
      o.position.set(x, 2.2, z);
      o.rotation.set(0, Math.PI / 2, Math.PI + Math.sin(i * 1.7) * .3); // cuelgan hacia arriba
      o.updateMatrix();
      P.straps.strapMesh.setMatrixAt(i, o.matrix);
      P.straps.ringMesh.setMatrixAt(i, o.matrix);
    });
    P.straps.strapMesh.instanceMatrix.needsUpdate = P.straps.ringMesh.instanceMatrix.needsUpdate = true;
    const reloj = createReloj();
    reloj.group.position.set(-1.5, 2.3, -12.86);
    stage.add(reloj.group);
    const maletin = createObjeto('maletin');
    maletin.position.set(.6, 1.2, -12.2);
    stage.add(maletin);

    // ---- lo que sube del vacío si te quedas quieto
    const mano = new THREE.Group();
    mano.add(new THREE.Mesh(borradoGeometry(), basic({ color: 0x0b0b0e })));
    const eyeMat = basic({ color: 0xffffff, fog: false });
    for (const ex of [-.05, .05]) {
      const eye = new THREE.Mesh(new THREE.BoxGeometry(.04, .035, .01), eyeMat);
      eye.position.set(ex, 1.75, .16);
      mano.add(eye);
    }
    mano.visible = false;
    const scare = createScare();
    stage.add(mano, scare.group);

    const parkour = createParkour(ctx, platforms, { start: { x: 0, z: 11.2, plat: platforms[0] } });
    S = { scene, platforms, parkour, reloj, maletin, mano, scare, t: 0, still: 0, stillOn: null, falls: data.falls || 0,
      caught: -1, done: false, leaveAt: 0, blackT: 0, bestZ: 11 };
    if (ctx.demo) window.__S = S;
    S.bolsillo = crearBolsillo(ctx);
    S.mira = new THREE.Vector3();
    S.flash = createFlash({ onFire() { ctx.audio.sfx('flash', { multitud: false }); S.revelar = true; } });
    S.screamT = -1;
    ctx.misiones?.set('Cruza el vagón roto saltando [Espacio]');
    S.lines = [
      [.6, 'El vagón se partió. Abajo no hay piso… solo las vías.', 3200],
      [4.2, '[Espacio] saltar · [F] lo que alumbras queda a la vista', 4200],
    ];
  },
  update(dt, ctx) {
    if (!S) return;
    const { scene, platforms, parkour, flash, mano, scare } = S;
    const cam = ctx.camera;
    const now = performance.now();
    S.t += dt;
    while (S.lines.length && S.t >= S.lines[0][0]) {
      const [, text, ms] = S.lines.shift();
      ctx.hud.subtitle(text, ms);
    }

    // screamer: una cara se te tira encima; no te atrapa, sigues donde estabas
    if (S.screamT >= 0) {
      S.screamT += dt;
      const shown = caughtFrame(scene, scare, cam, dt, S.screamT);
      if (shown > .55) {
        S.screamT = -1;
        scare.group.visible = false;
        scene.overlay.u.uCaught.value = 0;
        scene.overlay.u.uBlack.value = 0;
        ctx.hud.subtitle('…¿Qué fue eso?', 2000);
      }
      return;
    }

    // te agarró lo que subió: susto y vuelves al último pedazo firme
    if (S.caught >= 0) {
      S.caught += dt;
      const shown = caughtFrame(scene, scare, cam, dt, S.caught);
      if (shown > .5) {
        S.caught = -1;
        scare.group.visible = false;
        scene.overlay.u.uCaught.value = 0;
        scene.overlay.u.uBlack.value = 0;
        mano.visible = false;
        S.still = 0;
        parkour.respawn();
        parkour.update(0);
      }
      return;
    }

    const r = parkour.update(S.done ? 0 : dt);
    S.bolsillo.update(cam);
    if (S.done && S.leaveAt && S.t > S.leaveAt) { S.leaveAt = 0; ctx.next(); }

    // caer: negro un instante y de vuelta al último pedazo firme
    if (r.fell) {
      S.falls += 1;
      S.blackT = .35;
      S.still = 0;
      mano.visible = false;
      ctx.audio.sfx('crujido');
      if (S.falls === 2) ctx.hud.subtitle('Usa el flash [F] antes de saltar: así ves dónde caer.', 3600);
      ctx.progress();
    }
    S.blackT = Math.max(0, S.blackT - dt);
    scene.overlay.u.uBlack.value = S.blackT / .35;

    // flash y bordes: de cerca se ven siempre; con el flash, todos
    if (!S.done && ctx.input.pressed('KeyF')) flash.fire(now);
    const level = ctx.demo && window.__fdsHold ? 1 : flash.level(now);
    const glow = flash.glow(now);
    scene.light(level, dt, flash);
    scene.overlay.u.uFlash.value = Math.max(0, 1 - flash.since(now) / .14) * .6;
    // la foto "desbloquea" lo que tienes adelante: esos bordes quedan iluminados
    if (S.revelar && level >= 1) {
      S.revelar = false;
      cam.getWorldDirection(S.mira);
      for (const pl of platforms) {
        const dx = pl.cx - cam.position.x;
        const dz = pl.cz - cam.position.z;
        const d = Math.hypot(dx, dz);
        if (d < REVELA && (d < 1.5 || (dx * S.mira.x + dz * S.mira.z) / d > .35)) pl.visto = true;
      }
    }
    for (const pl of platforms) {
      const d = Math.hypot(pl.cx - cam.position.x, pl.cz - cam.position.z);
      const cerca = THREE.MathUtils.clamp((CERCA - d) / .8, 0, 1);
      pl.edgeMat.opacity = Math.max(pl.visto ? .85 : 0, cerca, level, glow * .8);
    }
    // screamer: la primera vez que aterrizas en ese pedazo
    if (!S.screamed && parkour.grounded && parkour.ground === platforms[SCREAMER]) {
      S.screamed = true;
      S.screamT = 0;
      scare.show(null, cam, 'negro');
      ctx.audio.sfx('susto', { volume: 1 });
      ctx.audio.sfx('atrapado');
    }
    S.reloj.update(dt);
    S.maletin.rotation.y += dt * .4;
    S.maletin.position.y = 1.2 + Math.sin(S.t * .9) * .08;

    // progreso real (reinicia la pista de los 30 s)
    if (parkour.grounded && parkour.player.z < S.bestZ - 1.5) {
      S.bestZ = parkour.player.z;
      ctx.progress();
    }

    // quedarse quieto en un pedazo: algo sube del vacío
    const g = parkour.ground;
    if (g && !g.inicio && !g.fin && g === S.stillOn) S.still += dt;
    else { S.still = 0; S.stillOn = g; mano.visible = false; }
    if (S.still > QUIETO && g) {
      const k = Math.min(1, (S.still - QUIETO) / (AGARRA - QUIETO));
      if (!mano.visible) {
        mano.visible = true;
        const side = g.cx > 0 ? 1 : -1;
        mano.userData.x = THREE.MathUtils.clamp(g.cx - side * ((g.maxX - g.minX) * .5 + .35), -2.1, 2.1);
        mano.userData.z = THREE.MathUtils.clamp(cam.position.z, g.minZ, g.maxZ);
        ctx.audio.sfx('crujido');
        ctx.hud.subtitle('Algo sube desde las vías…', 2200);
      }
      mano.position.set(mano.userData.x, g.top - 2.2 + k * 1.9, mano.userData.z);
      mano.lookAt(cam.position.x, mano.position.y, cam.position.z);
      scene.danger = k;
      if (S.still >= AGARRA) {
        S.still = 0;
        if (!S.bolsillo.salvar([], cam, scene)) {
          S.caught = 0;
          ctx.audio.sfx('atrapado');
          scare.show(null, cam);
        } else {
          mano.visible = false;
        }
      }
    } else {
      scene.danger = 0;
    }

    // llegar al fondo
    if (!S.done && g?.fin) {
      S.done = true;
      ctx.audio.sfx('notificacion');
      ctx.hud.subtitle('Su maletín flota junto a la puerta. El oficinista no está.', 3200);
      S.leaveAt = S.t + 1.8;
      ctx.misiones?.set(null);
    }
  },
  exit(ctx) {
    S?.scene.dispose();
    S = null;
    ctx.misiones?.set(null);
  },
};

// Reloj de pared que corre hacia atrás.
function createReloj() {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 32;
  const g = c.getContext('2d');
  g.fillStyle = '#e8e4d6';
  g.beginPath();
  g.arc(16, 16, 15, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#222';
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2;
    g.fillRect(16 + Math.sin(a) * 12 - 1, 16 - Math.cos(a) * 12 - 1, 2, 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = tex.minFilter = THREE.NearestFilter;
  const group = new THREE.Group();
  group.add(new THREE.Mesh(new THREE.PlaneGeometry(.5, .5), basic({ map: tex, transparent: true })));
  const manoMat = basic({ color: 0x111111 });
  const minutero = new THREE.Mesh(new THREE.BoxGeometry(.015, .2, .01).translate(0, .1, 0), manoMat);
  const horario = new THREE.Mesh(new THREE.BoxGeometry(.02, .13, .01).translate(0, .065, 0), manoMat);
  minutero.position.z = horario.position.z = .01;
  group.add(minutero, horario);
  return {
    group,
    update(dt) {
      minutero.rotation.z += dt * 2.4; // hacia atrás
      horario.rotation.z += dt * .2;
    },
  };
}
