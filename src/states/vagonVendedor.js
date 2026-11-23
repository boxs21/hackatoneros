// 7 · Vagón del Vendedor: oscuridad total. Dueño: Valentín.
//
// Jugabilidad:
// - No se ve nada. Desde el fondo del vagón se escucha al Vendedor: «a luca… a luca…».
//   Su voz va adelante tuyo y te guía (audio espacial): con audífonos se sabe hacia dónde ir.
// - Dos caminos: seguir la voz a oscuras (lento y seguro) o usar el flash (ves, pero los acerca).
// - Aunque no hagas nada, los borrados se arriman de a poco: quedarse quieto no sirve.
// - [E] Completo italiano (regalo de la Señora): lo tiras y los borrados se van al olor.
// - El chocolate del Vendedor te salva una vez. Si te atrapan, reinicias el vagón en < 1 s.
// - Llegas a la puerta del fondo: la caja de chocolates en el piso. Sigue Casa.
import * as THREE from 'three';
import { createBorrados, CATCH_RADIUS } from '../mechanics/borrados.js';
import { createFlash } from '../mechanics/flash.js';
import { gastar, mostrarRegalos, tiene } from '../mechanics/regalos.js';
import { createObjeto } from '../world/figura.js';
import { createScare, caughtFrame } from '../world/susto.js';
import { VAGON } from '../world/vagon.js';
import { setupVagon, walkVagon } from '../world/vagonEscena.js';

const START_Z = 11.2;
const GOAL_Z = VAGON.endDoorZ + 1.1;
const GUIDE_AHEAD = 3.2; // la voz va esta distancia delante tuyo
const creepEvery = () => 5 + Math.random() * 4; // se arriman solos cada 5–9 s (irregular: no se aprende)

let S = null;

export default {
  id: 'vagonVendedor',
  next: 'final',
  hint: 'Cierra los ojos al flash: sigue la voz «a luca…». Si se acercan, tira el completo con E.',
  autoAdvance: true,
  enter(ctx, data = {}) {
    const retry = data.retry || 0;
    ctx.audio.ambiente('tunel');
    const scene = setupVagon(ctx, { z: START_Z, ambient: .015, fogFar: 7, tubeFlicker: false, sangre: 7 });
    const crowd = createBorrados({
      colliders: scene.colliders, seed: 41 + retry, zFrom: 7.5, density: Math.max(.15, .38 - retry * .08), corridor: 1.1, reserve: 0,
    });
    const scare = createScare();
    ctx.stage.add(crowd.mesh, scare.group);
    crowd.face(ctx.camera.position);
    mostrarRegalos(ctx);

    // Lo que queda del Vendedor: su caja de chocolates, junto a la puerta del fondo.
    const caja = createObjeto('chocolates');
    caja.position.set(.25, 0, VAGON.endDoorZ + .7);
    caja.rotation.y = .5;
    const brillo = new THREE.PointLight(0xffb36b, .35, 1.6, 1.5);
    brillo.position.set(.25, .4, VAGON.endDoorZ + .7);
    ctx.stage.add(caja, brillo);

    // El llavero del Escolar alumbra un poco tus pies (si lo tienes).
    const llavero = new THREE.PointLight(0xbfe8ff, tiene(ctx, 'llavero') ? .45 : 0, 2.2, 1.5);
    ctx.stage.add(llavero);

    const guia = new THREE.Vector3(0, 1.5, START_Z - GUIDE_AHEAD);
    const voz = ctx.audio.posicional('vendedor', guia, { camera: ctx.camera, volume: 1 });

    S = { atras: new THREE.Vector3(), detrasAt: 0, cortarAt: 0, scene, crowd, scare, retry, t: 0, caught: -1, done: false, leaveAt: 0, llavero, guia, voz,
      bestZ: START_Z, nextCreep: creepEvery(), intro: retry ? 99 : 0, flashes: 0 };
    S.flash = createFlash({
      onFire(count) {
        S.flashes = count;
        ctx.audio.sfx('flash');
        // Mirar cuesta: cada flash los trae más cerca.
        crowd.step(ctx.camera.position, count === 1 ? .15 : .35);
      },
    });
    if (retry) ctx.hud.subtitle(retry === 1 ? 'Otra vez. Escucha antes de mirar.' : 'La voz sigue ahí. Síguela.', 2800);
  },
  update(dt, ctx) {
    if (!S) return;
    const { scene, crowd, scare, flash } = S;
    const cam = ctx.camera;
    const now = performance.now();
    S.t += dt;

    if (S.caught >= 0) {
      S.caught += dt;
      const shown = caughtFrame(scene, scare, cam, dt, S.caught);
      if (shown > .55 && !S.done) {
        S.done = true;
        ctx.restart({ retry: S.retry + 1 });
      }
      return;
    }
    if (S.leaveAt && S.t > S.leaveAt) {
      S.leaveAt = 0;
      ctx.next();
      return;
    }

    if (S.intro < 99) {
      S.intro += dt;
      if (S.intro > .6 && S.intro - dt <= .6) ctx.hud.subtitle('Este vagón está a oscuras. Ni las ventanas.', 3000);
      if (S.intro > 4 && S.intro - dt <= 4) ctx.hud.subtitle('VENDEDOR: A luca… a luca los chocolates…', 3200);
      if (S.intro > 8 && S.intro - dt <= 8) ctx.hud.subtitle('Es su voz. Viene del fondo.', 2600);
    }

    if (!S.done) walkVagon(dt, ctx, { colliders: scene.colliders, speed: 1.9 });
    if (!S.done && ctx.input.pressed('KeyF')) flash.fire(now);
    const level = ctx.demo && window.__fdsHold ? 1 : flash.level(now);
    const glow = flash.glow(now);
    scene.light(level, dt, flash);
    crowd.show(level, glow);
    scene.overlay.u.uFlash.value = Math.max(0, 1 - flash.since(now) / .14) * .75;
    S.llavero.position.set(cam.position.x, .5, cam.position.z);

    // La voz guía: siempre un poco más adelante, hasta la puerta del fondo.
    if (!S.done) S.guia.set(Math.sin(S.t * .7) * .35, 1.5, Math.max(VAGON.endDoorZ + .4, cam.position.z - GUIDE_AHEAD));
    S.voz.setPosition?.(S.guia);
    // Golpe final: ya en la puerta, su voz suena justo detrás de ti… y se corta todo.
    if (S.detrasAt && S.t >= S.detrasAt) {
      S.detrasAt = 0;
      cam.getWorldDirection(S.atras);
      S.guia.copy(cam.position).addScaledVector(S.atras.setY(0).normalize(), -.55);
      S.guia.y = 1.5;
      ctx.audio.sfx('susto', { volume: .7 });
      ctx.hud.subtitle('VENDEDOR: …a luca, caserito.', 1800);
      S.cortarAt = S.t + 1.1;
    }
    if (S.cortarAt && S.t >= S.cortarAt) {
      S.cortarAt = 0;
      S.voz.stop?.(.05);
      ctx.fader.cut();
    }

    // Quedarse quieto no sirve: se arriman solos, de a poco.
    if (!S.done && S.t > S.nextCreep) {
      S.nextCreep = S.t + creepEvery();
      crowd.step(cam.position, .12);
      ctx.audio.sfx('crujido', { volume: .5 });
    }

    // Completo italiano de la Señora: se van al olor.
    if (!S.done && ctx.input.pressed('KeyE') && tiene(ctx, 'completo')) {
      gastar(ctx, 'completo');
      crowd.step(cam.position, -.9, 5);
      ctx.audio.sfx('paso', { cerca: true });
      ctx.hud.subtitle('Tiraste el completo. Se escucha cómo se lo pelean en la oscuridad.', 3000);
      ctx.progress();
    }

    // Peligro: viñeta roja y latido aunque no los veas.
    const d = crowd.nearest(cam.position);
    const danger = THREE.MathUtils.clamp((1.5 - d) / 1.0, 0, 1);
    scene.danger = danger;
    scene.overlay.u.uDanger.value += (danger - scene.overlay.u.uDanger.value) * Math.min(1, dt * 8);
    if (danger > .3 && Math.floor(S.t * 1.6) !== Math.floor((S.t - dt) * 1.6)) ctx.audio.sfx('latido', { volumen: danger });
    if (!S.done && d < CATCH_RADIUS) {
      if (tiene(ctx, 'chocolate')) {
        gastar(ctx, 'chocolate');
        crowd.step(cam.position, -.9, 3);
        scene.overlay.u.uFlash.value = .9;
        ctx.audio.sfx('crujido');
        ctx.hud.subtitle('Algo te agarró… y te soltó. El chocolate «pa’l susto» se te cayó.', 3200);
      } else {
        S.caught = 0;
        ctx.audio.sfx('atrapado');
        scare.show(crowd.nearestPerson(cam.position), cam);
        return;
      }
    }

    if (cam.position.z < S.bestZ - 2.5) {
      S.bestZ = cam.position.z;
      ctx.progress();
    }

    // Llegaste a la puerta del fondo.
    if (!S.done && cam.position.z < GOAL_Z) {
      S.done = true;
      ctx.audio.sfx('puertas');
      ctx.hud.subtitle(S.flashes === 0
        ? 'Sin un solo flash. La caja del Vendedor está en el piso. Él no.'
        : 'La caja del Vendedor está en el piso. Él no.', 3200);
      S.detrasAt = S.t + 2.4;
      S.leaveAt = S.t + 4.6;
    }
  },
  exit(ctx) {
    if (!S) return;
    S.voz?.stop?.(.1);
    S.scene.dispose();
    S = null;
  },
};
