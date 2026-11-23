// 5 · Los borrados: 4 flashes, 4 desapariciones. Lo más importante del juego.
// Dueño: Camilo.
// Jugabilidad: el vagón está lleno de borrados que solo se ven con el flash.
// Flash = ves el camino, pero los cercanos dan un paso hacia ti. Memoriza y
// camina a oscuras hasta la puerta del fondo. Si tocas a uno, te atrapa.
import * as THREE from 'three';
import { createBorrados, CATCH_RADIUS } from '../mechanics/borrados.js';
import { createFlash } from '../mechanics/flash.js';
import { createPasajeros, desaparecer, updatePasajeros } from '../world/pasajeros.js';
import { setupVagon, walkVagon } from '../world/vagonEscena.js';
import { createScare, caughtFrame } from '../world/susto.js';
import { VAGON } from '../world/vagon.js';

const LINES = [
  'La mochila del escolar quedó en el suelo. Él no está.',
  'El maletín… ¿y el caballero?',
  '¿Señora? Su carro sigue ahí.',
  'Quedaste solo. La puerta del fondo: la luz roja.',
];

let S = null;

export default {
  id: 'borrados',
  next: 'vagonEscolar',
  hint: 'Flash, mira el hueco entre ellos y camina a oscuras. No abuses: cada flash los acerca.',
  autoAdvance: true,
  enter(ctx, data = {}) {
    const retry = data.retry || 0;
    ctx.audio.ambiente('tunel');
    const scene = setupVagon(ctx, { z: 11, ambient: .35, fogFar: 13 });
    const passengers = createPasajeros(ctx.stage);
    const crowd = createBorrados({ colliders: scene.colliders, seed: 7 });
    const scare = createScare();
    ctx.stage.add(crowd.mesh, scare.group);
    crowd.face(ctx.camera.position);

    S = { scene, passengers, crowd, scare, retry, vanished: 0, t: 0, bestZ: 11,
      caught: -1, done: false, doorMsg: -9, intro: retry ? 99 : 0, lastLie: -99, rule: null };
    if (ctx.demo) window.__S = S; // depurar (solo ?demo=1)

    if (retry) {
      // punto de control: los cuatro ya desaparecieron
      passengers.forEach((p) => { desaparecer(ctx.stage, p); crowd.convert(p.x, p.z); });
      S.vanished = passengers.length;
      crowd.face(ctx.camera.position);
      ctx.hud.subtitle(retry === 1 ? 'Otra vez. Flash, memoriza, camina a oscuras.' : 'Menos flashes. Más memoria.', 3000);
    }

    S.flash = createFlash({
      onFire(count) {
        const pos = ctx.camera.position;
        ctx.audio.sfx('flash');
        // El primer flash es gratis; después, cada uno los acerca.
        crowd.step(pos, count === 1 && !retry ? 0 : .25);
        // La foto miente (Fatal Frame): en la 3.ª foto, y después de vez en cuando,
        // sale alguien pegado a ti… y de verdad quedó uno a tu espalda.
        const lie = (count === 3 && !retry) || (count > 4 && Math.random() < .2 && S.t - S.lastLie > 10);
        scene.lie = lie;
        if (lie) {
          S.lastLie = S.t;
          crowd.spawnBehind(pos, ctx.camera.rotation.y);
          ctx.audio.sfx('crujido', { detras: true });
        }
        if (S.vanished < passengers.length) {
          const p = passengers[S.vanished];
          desaparecer(ctx.stage, p);
          crowd.convert(p.x, p.z);
          crowd.face(pos);
          ctx.audio.sfx('desaparece', { personaje: p.name });
          ctx.hud.subtitle(LINES[S.vanished], 3200);
          S.vanished += 1;
          ctx.progress();
        }
      },
    });
  },
  update(dt, ctx) {
    if (!S) return;
    const { scene, crowd, passengers, flash, scare } = S;
    const cam = ctx.camera;
    const now = performance.now();
    S.t += dt;

    // atrapado: susto corto y reinicio instantáneo
    if (S.caught >= 0) {
      S.caught += dt;
      const shown = caughtFrame(scene, scare, cam, dt, S.caught);
      scene.overlay.u.uDanger.value = 1;
      if (shown > .55 && !S.done) {
        S.done = true;
        ctx.restart({ retry: S.retry + 1 });
      }
      return;
    }

    // intro (solo la primera vez)
    if (S.intro < 99) {
      S.intro += dt;
      if (S.intro > .6 && S.intro - dt <= .6) ctx.hud.subtitle('Se cortó la luz. Ustedes cinco siguen aquí… ¿cierto?', 3400);
      if (S.intro > 4.2 && S.intro - dt <= 4.2 && !flash.count) ctx.hud.subtitle('[F] Flash del celular', 4000);
    }

    const blockers = scene.colliders.concat(passengers.filter((p) => !p.gone).map((p) => ({ x: p.x, z: p.z, r: .28 })));
    walkVagon(dt, ctx, { colliders: blockers });
    updatePasajeros(passengers, dt, cam);

    if (!S.done && ctx.input.pressed('KeyF')) flash.fire(now);
    const level = ctx.demo && window.__fdsHold ? 1 : flash.level(now);
    const glow = flash.glow(now);
    // proximidad: rojo, latido y estática en el celular aunque no los veas
    const d = crowd.nearest(cam.position);
    const danger = THREE.MathUtils.clamp((1.6 - d) / 1.1, 0, 1);
    scene.danger = danger;
    scene.light(level, dt, flash);
    crowd.show(level, glow);
    scene.overlay.u.uFlash.value = Math.max(0, 1 - flash.since(now) / .14) * .75;
    scene.overlay.u.uDanger.value += (danger - scene.overlay.u.uDanger.value) * Math.min(1, dt * 8);
    if (danger > .3 && Math.floor(S.t * 1.6) !== Math.floor((S.t - dt) * 1.6)) ctx.audio.sfx('latido', { volumen: danger });
    if (d < CATCH_RADIUS) {
      S.caught = 0;
      ctx.audio.sfx('atrapado');
      scare.show(crowd.nearestPerson(cam.position), cam);
      return;
    }

    // avanzar de verdad reinicia el reloj de pistas
    if (cam.position.z < S.bestZ - 2) {
      S.bestZ = cam.position.z;
      ctx.progress();
    }

    // Romper la regla (SCP-173), una sola vez: en el último tramo, uno se mueve
    // sin flash. Solo lo delatan los pasos, el rojo y la estática del celular.
    if (!S.rule && cam.position.z < -4.5) {
      const ahead = crowd.people
        .filter((p) => !p.hidden && p.kind === 'pasillo' && p.z < cam.position.z)
        .map((p) => [p, Math.hypot(p.x - cam.position.x, p.z - cam.position.z)])
        .filter(([, dist]) => dist < 5 && dist > 1.4)
        .sort((a, b) => a[1] - b[1])[0];
      S.rule = { p: ahead?.[0], left: ahead ? .9 : 0 };
      if (ahead) ctx.audio.sfx('paso', { cerca: true });
    }
    if (S.rule?.left > 0) {
      const step = dt * .75;
      S.rule.left = crowd.nudge(S.rule.p, cam.position, step) ? S.rule.left - step : 0;
    }

    // la puerta del fondo
    if (!S.done && cam.position.z < VAGON.endDoorZ + .7) {
      if (S.vanished >= passengers.length) {
        S.done = true;
        ctx.audio.sfx('puertas');
        ctx.next();
      } else if (S.t - S.doorMsg > 3) {
        S.doorMsg = S.t;
        ctx.hud.subtitle('La puerta no abre. Todavía no has visto lo suficiente. [F]', 2600);
      }
    }
  },
  exit() {
    S?.scene.dispose();
    S = null;
  },
};
