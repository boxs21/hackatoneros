// 6 · Vagón del Escolar: código en las paredes, solo visible con el flash.
// Dueño: Camilo.
// Jugabilidad: el escolar rayó 3 números con tiza (las rayitas I, II, III marcan
// el orden) en paredes, piso o techo. Solo se ven con el flash, y el flash acerca
// a los borrados. El teclado está junto a la puerta del fondo: apunta y aprieta E
// (o click). Código malo = los borrados dan un paso.
import * as THREE from 'three';
import { createBorrados, CATCH_RADIUS } from '../mechanics/borrados.js';
import { createFlash } from '../mechanics/flash.js';
import { basic, pixelTexture } from '../world/ps1.js';
import { rayado, garabato, monito } from '../world/texturas.js';
import { setupVagon, walkVagon } from '../world/vagonEscena.js';
import { createObjeto } from '../world/figura.js';
import { createScare } from '../world/susto.js';
import { VAGON } from '../world/vagon.js';

const L = [0, Math.PI / 2, 0];
const R = [0, -Math.PI / 2, 0];
const FLOOR = [-Math.PI / 2, 0, 0];
const CEIL = [Math.PI / 2, 0, 0];
// Lugares posibles para rayar, en tres zonas (cerca, medio, lejos).
const SPOTS = [
  [[-2.42, 1.9, 5.2, L], [2.42, 1.9, 3.6, R], [.5, .012, 6.4, FLOOR], [-.3, 3.04, 4.2, CEIL], [2.42, 2.72, 9.6, R]],
  [[2.42, 1.9, -2.6, R], [-2.42, 1.9, -4.4, L], [-.4, .012, -1.8, FLOOR], [.2, 3.04, -5.4, CEIL], [-2.42, 1.0, 2.2, L]],
  [[-2.42, 1.9, -10.2, L], [2.42, 1.9, -9.8, R], [.4, .012, -10.6, FLOOR], [-.2, 3.04, -11.2, CEIL], [2.42, 2.72, -6.2, R]],
];
const DECOYS = ['¿DÓNDE\nESTÁN?', 'NO MIRES\nATRÁS', 'MAMÁ\nYA VOY', null, 'ESTOY\nAQUÍ'];
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', ''];

let S = null;

function keypadCanvas() {
  const c = document.createElement('canvas');
  c.width = 48;
  c.height = 72;
  return c;
}

function drawKeypad(S) {
  const g = S.pad.canvas.getContext('2d');
  g.fillStyle = '#20262a';
  g.fillRect(0, 0, 48, 72);
  g.fillStyle = S.pad.state === 'ok' ? '#0f3d1c' : S.pad.state === 'error' ? '#4a0d0d' : '#0b1a10';
  g.fillRect(4, 4, 40, 14);
  g.fillStyle = S.pad.state === 'error' ? '#ff5a4a' : '#5dff8a';
  g.font = 'bold 10px monospace';
  const text = S.pad.state === 'error' ? 'ERROR' : S.pad.state === 'ok' ? 'ABRE' : S.entered.padEnd(3, '_').split('').join(' ');
  g.fillText(text, 7, 15);
  KEYS.forEach((k, i) => {
    const x = 4 + (i % 3) * 14;
    const y = 22 + Math.floor(i / 3) * 12;
    if (!k) return;
    g.fillStyle = i === S.pad.hover ? '#f2b705' : '#5a6268';
    g.fillRect(x, y, 12, 10);
    g.fillStyle = i === S.pad.hover ? '#1a1400' : '#e8ece8';
    g.font = 'bold 8px monospace';
    g.fillText(k, x + 4, y + 8);
  });
  S.pad.tex.needsUpdate = true;
}

export default {
  id: 'vagonEscolar',
  next: 'vagonOficinista', // extra: el vagón que se repite; de ahí sigue al Vendedor
  hint: 'Hay 3 números de tiza (paredes, piso o techo); las rayitas marcan el orden. El teclado está junto a la puerta del fondo.',
  autoAdvance: true,
  enter(ctx, data = {}) {
    const retry = data.retry || 0;
    const code = data.code || Array.from({ length: 3 }, () => Math.floor(Math.random() * 10)).join('');
    const scene = setupVagon(ctx, { z: 11.2, ambient: .35, fogFar: 13, tubeFlicker: true });

    const pick = data.picks || SPOTS.map(() => Math.floor(Math.random() * 5));
    // nadie parado delante de los números de tiza
    const keepClear = SPOTS.map((zone, zi) => zone[pick[zi]])
      .map(([x, , z]) => ({ x: Math.sign(x) * Math.min(Math.abs(x), 1.85), z, r: 1.4 }));
    const crowd = createBorrados({ colliders: scene.colliders, seed: 21 + retry, zFrom: 6.5, density: .5, corridor: .9, reserve: 0, keepClear });
    const scare = createScare();
    ctx.stage.add(crowd.mesh, scare.group);
    crowd.face(ctx.camera.position);

    // la mochila del escolar al entrar
    const mochila = createObjeto('mochila');
    mochila.position.set(-.7, .08, 9.7);
    mochila.rotation.set(-Math.PI / 2, 0, .4);
    ctx.stage.add(mochila);

    // rayados de tiza: 3 con el código, el resto distractores
    const decals = [];
    const seen = data.seen ? [...data.seen] : [false, false, false];
    SPOTS.forEach((zone, zi) => {
      zone.forEach((spot, si) => {
        const isCode = si === pick[zi];
        const decoy = DECOYS[(si + zi) % DECOYS.length];
        const map = isCode ? rayado(code[zi], zi + 1) : decoy ? garabato(decoy) : monito();
        const w = isCode ? .95 : .9;
        const h = isCode ? .95 : decoy ? .45 : .7;
        const mat = basic({ map, transparent: true, opacity: 0, depthWrite: false });
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
        const [x, y, z, rot] = spot;
        mesh.position.set(x, y, z);
        mesh.rotation.set(...rot);
        ctx.stage.add(mesh);
        decals.push({ mesh, mat, code: isCode ? zi : -1 });
      });
    });

    // teclado junto a la puerta del fondo
    const canvas = keypadCanvas();
    const tex = pixelTexture(canvas);
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(.34, .51), basic({ map: tex }));
    panel.position.set(1.05, 1.35, VAGON.endDoorZ + .14);
    const glow = new THREE.PointLight(0x5dff8a, .5, 2.2, 1);
    glow.position.set(1.05, 1.35, VAGON.endDoorZ + .5);
    ctx.stage.add(panel, glow);

    const onDown = () => { if (document.pointerLockElement) S.click = true; };
    ctx.canvas.addEventListener('mousedown', onDown);

    S = { scene, crowd, scare, code, retry, decals, seen, pick, entered: '', t: 0, caught: -1, done: false,
      bestZ: 11.2, click: false, onDown, pad: { canvas, tex, panel, glow, hover: -1, state: '', stateT: 0 },
      ray: new THREE.Raycaster(), center: new THREE.Vector2(0, 0), frustum: new THREE.Frustum(), m: new THREE.Matrix4(),
      intro: retry ? 99 : 0, lastLie: -99 };
    drawKeypad(S);
    if (retry) ctx.hud.subtitle(`Cuaderno: ${notebook(S)}`, 3000);

    S.flash = createFlash({
      onFire(count) {
        ctx.audio.sfx('flash');
        crowd.step(ctx.camera.position, count === 1 ? 0 : .28);
        S.checkSeen = true;
        const lie = count === 4 || (count > 6 && Math.random() < .2 && S.t - S.lastLie > 10);
        scene.lie = lie;
        if (lie) {
          S.lastLie = S.t;
          crowd.spawnBehind(ctx.camera.position, ctx.camera.rotation.y);
          ctx.audio.sfx('respiracion', { detras: true });
        }
      },
    });
  },
  update(dt, ctx) {
    if (!S) return;
    const { scene, crowd, flash, scare, pad } = S;
    const cam = ctx.camera;
    const now = performance.now();
    S.t += dt;

    if (S.caught >= 0) {
      S.caught += dt;
      scare.update(dt, cam, S.caught);
      scene.light(S.caught < .12 ? 1 : Math.max(0, .5 - S.caught), dt);
      scene.overlay.u.uCaught.value = Math.min(1, S.caught * 4);
      if (S.caught > .55 && !S.done) {
        S.done = true;
        ctx.restart({ retry: S.retry + 1, code: S.code, seen: S.seen, picks: S.pick });
      }
      return;
    }

    if (S.leaveAt && S.t > S.leaveAt) {
      S.leaveAt = 0;
      ctx.next();
    }

    if (S.intro < 99) {
      S.intro += dt;
      if (S.intro > .5 && S.intro - dt <= .5) ctx.hud.subtitle('Otro vagón. Alguien rayó las paredes con tiza.', 3200);
      if (S.intro > 4 && S.intro - dt <= 4) ctx.hud.subtitle('La tiza solo se ve con el flash. [F]', 3200);
    }

    walkVagon(dt, ctx, { colliders: scene.colliders });
    if (!S.done && ctx.input.pressed('KeyF')) flash.fire(now);
    const level = ctx.demo && window.__fdsHold ? 1 : flash.level(now);
    const glow = flash.glow(now);
    const near = crowd.nearest(cam.position);
    scene.danger = THREE.MathUtils.clamp((1.6 - near) / 1.1, 0, 1);
    scene.light(level, dt, flash);
    crowd.show(level, glow);
    scene.overlay.u.uFlash.value = Math.max(0, 1 - flash.since(now) / .14) * .75;
    const chalk = Math.max(level, glow * .75);
    for (const d of S.decals) d.mat.opacity = chalk;

    // ¿qué números vio con este flash? Se anotan en el "cuaderno".
    if (S.checkSeen && level >= 1) {
      S.checkSeen = false;
      cam.updateMatrixWorld();
      S.m.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
      S.frustum.setFromProjectionMatrix(S.m);
      let found = false;
      for (const d of S.decals) {
        if (d.code < 0 || S.seen[d.code]) continue;
        if (cam.position.distanceTo(d.mesh.position) < 8.5 && S.frustum.containsPoint(d.mesh.position)) {
          S.seen[d.code] = true;
          found = true;
        }
      }
      if (found) {
        ctx.audio.sfx('anotar');
        ctx.hud.subtitle(`Cuaderno: ${notebook(S)}`, 3200);
        ctx.progress();
      }
    }

    // borrados
    const d = crowd.nearest(cam.position);
    const danger = THREE.MathUtils.clamp((1.35 - d) / .9, 0, 1); // viñeta roja: más cerca que el radar
    scene.overlay.u.uDanger.value += (danger - scene.overlay.u.uDanger.value) * Math.min(1, dt * 8);
    if (danger > .3 && Math.floor(S.t * 1.6) !== Math.floor((S.t - dt) * 1.6)) ctx.audio.sfx('latido', { volumen: danger });
    if (d < CATCH_RADIUS) {
      S.caught = 0;
      ctx.audio.sfx('atrapado');
      scare.show(crowd.nearestPerson(cam.position), cam);
      return;
    }
    if (cam.position.z < S.bestZ - 2.5) {
      S.bestZ = cam.position.z;
      ctx.progress();
    }

    // teclado: apuntar con la mira
    let hover = -1;
    if (cam.position.distanceTo(pad.panel.position) < 2.3 && !S.done) {
      S.ray.setFromCamera(S.center, cam);
      const hit = S.ray.intersectObject(pad.panel)[0];
      if (hit?.uv) {
        const px = hit.uv.x * 48;
        const py = (1 - hit.uv.y) * 72;
        const col = Math.floor((px - 4) / 14);
        const row = Math.floor((py - 22) / 12);
        if (col >= 0 && col < 3 && row >= 0 && row < 4 && (px - 4) % 14 < 12) hover = row * 3 + col;
        if (hover >= 0 && !KEYS[hover]) hover = -1;
      }
      scene.overlay.u.uDot.value = 1;
    } else {
      scene.overlay.u.uDot.value = 0;
    }
    if (pad.state && S.t - pad.stateT > .9 && pad.state === 'error') { pad.state = ''; S.entered = ''; drawKeypad(S); }
    if (hover !== pad.hover) { pad.hover = hover; drawKeypad(S); }
    const press = ctx.input.pressed('KeyE') || S.click;
    S.click = false;
    if (press && hover >= 0 && !pad.state) {
      ctx.audio.sfx('tecla');
      const k = KEYS[hover];
      if (k === 'C') S.entered = '';
      else S.entered += k;
      if (S.entered.length === 3) {
        pad.stateT = S.t;
        if (S.entered === S.code) {
          pad.state = 'ok';
          pad.glow.color.setHex(0x5dff8a);
          pad.glow.intensity = 2;
          S.done = true;
          ctx.audio.sfx('codigo_ok');
          ctx.audio.sfx('puerta');
          ctx.hud.subtitle('La puerta se abre.', 2000);
          S.leaveAt = S.t + .7;
        } else {
          pad.state = 'error';
          ctx.audio.sfx('codigo_mal');
          crowd.step(cam.position, .45, 12);
          crowd.show(1, 1);
          scene.light(.6, 0);
          ctx.hud.subtitle('Incorrecto. Algo se movió en la oscuridad.', 2600);
        }
      }
      drawKeypad(S);
    }
  },
  exit(ctx) {
    if (!S) return;
    S.scene.dispose();
    ctx.canvas.removeEventListener('mousedown', S.onDown);
    S = null;
  },
};

function notebook(S) {
  return ['I', 'II', 'III'].map((n, i) => `${n}: ${S.seen[i] ? S.code[i] : '?'}`).join('   ');
}
