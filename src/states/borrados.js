// 5 · Los borrados: 4 flashes, 4 desapariciones. Lo más importante del juego.
// Dueño: Camilo.
// Jugabilidad: el vagón está lleno de borrados que solo se ven con el flash.
// Flash = ves el camino, pero los cercanos dan un paso hacia ti. Memoriza y
// camina a oscuras hasta la puerta del fondo. Si tocas a uno, te atrapa.
import * as THREE from 'three';
import { createBorrados, CATCH_RADIUS } from '../mechanics/borrados.js';
import { createFlash } from '../mechanics/flash.js';
import { gastar, mostrarRegalos, tiene } from '../mechanics/regalos.js';
import { createMuertes } from '../world/muerte.js';
import { createPasajeros, updatePasajeros } from '../world/pasajeros.js';
import { setupVagon, walkVagon } from '../world/vagonEscena.js';
import { createScare, caughtFrame } from '../world/susto.js';
import { VAGON } from '../world/vagon.js';

const FOV = 70; // el de siempre (main.js); las muertes lo cierran un rato
// Misión: sacarle una foto a cada sobreviviente. La foto que le apunta a uno lo condena.
const APUNTA = .38; // rad (~22°) desde el centro de la vista
const APUNTA_LEJOS = 10; // m
const mision = (n, total) => `Sácale una foto a cada sobreviviente (${n}/${total})`;
const _fwd = new THREE.Vector3();

let S = null;

export default {
  id: 'borrados',
  next: 'vagonEscolar',
  hint: 'Apúntale a cada sobreviviente y saca la foto. Después, camina a oscuras: cada flash los acerca.',
  autoAdvance: true,
  enter(ctx, data = {}) {
    const retry = data.retry || 0;
    ctx.audio.ambiente('tunel');
    const scene = setupVagon(ctx, { z: 11, ambient: .35, fogFar: 13 });
    const passengers = createPasajeros(ctx.stage);
    const crowd = createBorrados({ colliders: scene.colliders, seed: 7 });
    const scare = createScare();
    ctx.stage.add(crowd.mesh, scare.group);
    // Cómo se los llevan (world/muerte.js) y lo que te dejaron (mechanics/regalos.js).
    const muertes = createMuertes(ctx);
    mostrarRegalos(ctx);
    // El llavero del escolar: una luz chica que solo alcanza a tus pies.
    const llavero = new THREE.PointLight(0xbfe8ff, tiene(ctx, 'llavero') ? .55 : 0, 2.6, 1.5);
    ctx.stage.add(llavero);
    crowd.face(ctx.camera.position);

    S = { scene, passengers, crowd, scare, muertes, llavero, retry, vanished: 0, t: 0, bestZ: 11,
      caught: -1, done: false, doorMsg: -9, miedoDir: { pan: 0, detras: false }, intro: retry || data.desdeCinco ? 99 : 0, /* desde Los cinco ya conoces el flash */ lastLie: -99, rule: null };
    if (ctx.demo) window.__S = S; // depurar (solo ?demo=1)

    if (retry) {
      // punto de control: los cuatro ya desaparecieron
      muertes.yaRotas(passengers);
      passengers.forEach((p) => crowd.convert(p.x, p.z));
      S.vanished = passengers.length;
      crowd.face(ctx.camera.position);
      ctx.hud.subtitle(retry === 1 ? 'Otra vez. Flash, memoriza, camina a oscuras.' : 'Menos flashes. Más memoria.', 3000);
    }

    if (!retry) ctx.misiones?.set(mision(0, passengers.length));

    S.flash = createFlash({
      onFire(count) {
        const pos = ctx.camera.position;
        // desde la 2.ª foto los borrados se acercan: se dice una vez, cuando haya silencio
        if (count >= 2 && !S.cercaDicho) S.cercaPend = true;
        ctx.audio.sfx('flash');
        // El primer flash es gratis; después, cada uno los acerca.
        crowd.step(pos, count === 1 && !retry ? 0 : .25);
        // La foto miente (Fatal Frame): en la primera foto después de las 4 muertes
        // (cuando crees que quedaste solo), y después de vez en cuando, sale alguien
        // pegado a ti… y de verdad quedó uno a tu espalda. No va encima de una muerte.
        const primeraSolo = !retry && !S.mintio && S.vanished >= passengers.length && !muertes.busy;
        const lie = primeraSolo || (S.mintio && Math.random() < .2 && S.t - S.lastLie > 10);
        if (lie) S.mintio = true;
        scene.lie = lie;
        if (lie) {
          S.lastLie = S.t;
          crowd.spawnBehind(pos, ctx.camera.rotation.y);
          ctx.audio.sfx('crujido', { detras: true });
        }
        // La foto que le apunta a un sobreviviente lo trae: lo ves agarrarlo y sacarlo por la ventana.
        const p = S.vanished < passengers.length && !muertes.busy ? apuntado(ctx.camera, passengers) : null;
        if (p) {
          S.vanished += 1;
          muertes.start(p, passengers.indexOf(p), { ultimo: S.vanished >= passengers.length });
          crowd.convert(p.x, p.z);
          crowd.face(pos);
          ctx.misiones?.set(S.vanished >= passengers.length ? null : mision(S.vanished, passengers.length));
          ctx.progress();
        } else if (S.vanished < passengers.length && !muertes.busy && !S.vaciaDicha) {
          S.vaciaDicha = true;
          ctx.hud.subtitle('La foto salió sin nadie. Apúntales a los demás.', 2600);
        }
      },
    });
  },
  update(dt, ctx) {
    if (!S) return;
    const { scene, crowd, passengers, flash, scare, muertes, llavero } = S;
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
    }

    const blockers = scene.colliders.concat(passengers.filter((p) => !p.gone).map((p) => ({ x: p.x, z: p.z, r: .28 })));
    // mientras se llevan a alguien no puedes caminar y la vista se te va para allá
    const muerte = muertes.update(dt, cam);
    walkVagon(dt, ctx, { colliders: blockers, speed: muerte.lock ? 0 : 2.3 });
    if (muerte.lock) {
      const yaw = Math.atan2(-(muerte.x - cam.position.x), -(muerte.z - cam.position.z));
      const diff = Math.atan2(Math.sin(yaw - cam.rotation.y), Math.cos(yaw - cam.rotation.y));
      cam.rotation.y += diff * Math.min(1, dt * 7);
      cam.rotation.x += (.05 - cam.rotation.x) * Math.min(1, dt * 5);
    }
    // y se cierra sobre lo que pasa: mientras más lejos, más zoom (no puedes no mirar)
    const lejos = Math.hypot(muerte.x - cam.position.x, muerte.z - cam.position.z);
    const fov = muerte.zoom ? THREE.MathUtils.clamp(FOV * 2.4 / Math.max(lejos, .1), 26, FOV) : FOV;
    if (Math.abs(cam.fov - fov) > .05) {
      cam.fov += (fov - cam.fov) * Math.min(1, dt * (muerte.zoom ? 6 : 9));
      cam.updateProjectionMatrix();
    }
    updatePasajeros(passengers, dt, cam);
    // «se mueven con las fotos»: después de que termine la muerte y su texto
    if (S.cercaPend && !muertes.busy) {
      S.cercaAt ??= S.t + (S.vanished ? 2.4 : .9);
      if (S.t >= S.cercaAt) {
        S.cercaPend = false;
        S.cercaDicho = true;
        ctx.hud.subtitle('Entre foto y foto… se acercaron.', 2800);
      }
    }
    llavero.position.set(cam.position.x, .5, cam.position.z);

    // El completo italiano de la señora: lo tiras y los que están cerca se van al olor.
    if (!S.done && ctx.input.pressed('KeyE') && tiene(ctx, 'completo')) {
      gastar(ctx, 'completo');
      crowd.step(cam.position, -.6, 4);
      ctx.audio.sfx('paso', { cerca: true });
      ctx.hud.subtitle('Tiraste el completo. Algo se agacha a olerlo.', 2600);
    }

    if (!S.done && ctx.input.pressed('KeyF')) flash.fire(now);
    const level = ctx.demo && window.__fdsHold ? 1 : flash.level(now);
    const glow = flash.glow(now);
    // proximidad: rojo, latido y estática en el celular aunque no los veas
    const d = crowd.nearest(cam.position);
    const danger = THREE.MathUtils.clamp((1.6 - d) / 1.1, 0, 1);
    scene.danger = danger;
    // Para el oído el miedo empieza antes que el rojo (desde 5 m, suave) y trae dirección:
    // los susurros vienen del lado donde está el más cercano; a tu espalda suenan tapados.
    scene.miedo = Math.max(danger, .35 * THREE.MathUtils.clamp((5 - d) / 3.4, 0, 1));
    const cerca = crowd.nearestPerson(cam.position);
    if (cerca) {
      const dx = cerca.x - cam.position.x;
      const dz = cerca.z - cam.position.z;
      const yaw = cam.rotation.y;
      S.miedoDir.pan = (dx * Math.cos(yaw) - dz * Math.sin(yaw)) / Math.max(d, .2);
      S.miedoDir.detras = dx * Math.sin(yaw) + dz * Math.cos(yaw) > 0;
      scene.miedoDir = S.miedoDir;
    }
    scene.light(level, dt, flash);
    crowd.show(level, glow);
    scene.overlay.u.uFlash.value = Math.max(0, 1 - flash.since(now) / .14) * .75;
    scene.overlay.u.uDanger.value += (danger - scene.overlay.u.uDanger.value) * Math.min(1, dt * 8);
    if (danger > .3 && Math.floor(S.t * 1.6) !== Math.floor((S.t - dt) * 1.6)) ctx.audio.sfx('latido', { volumen: danger });
    if (d < CATCH_RADIUS && tiene(ctx, 'chocolate')) {
      // El chocolate del vendedor («pa'l susto»): te suelta una vez y los aleja.
      gastar(ctx, 'chocolate');
      crowd.step(cam.position, -.9, 3);
      scene.overlay.u.uFlash.value = .9;
      ctx.audio.sfx('crujido');
      ctx.hud.subtitle('Algo te agarró… y te soltó. El chocolate se te cayó del bolsillo.', 3200);
    } else if (d < CATCH_RADIUS) {
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
        ctx.hud.subtitle('La puerta no abre. Todavía faltan sobrevivientes en tus fotos.', 2600);
      }
    }
  },
  exit(ctx) {
    ctx.misiones?.set(null);
    ctx.camera.fov = FOV;
    ctx.camera.updateProjectionMatrix();
    S?.scene.dispose();
    S = null;
  },
};

// El sobreviviente más centrado en la foto (o nadie si no le apuntas a ninguno).
function apuntado(cam, passengers) {
  cam.getWorldDirection(_fwd);
  let mejor = null;
  let menor = APUNTA;
  for (const p of passengers) {
    if (p.gone) continue;
    const dx = p.x - cam.position.x;
    const dy = 1.3 - cam.position.y;
    const dz = p.z - cam.position.z;
    const d = Math.hypot(dx, dy, dz);
    if (d > APUNTA_LEJOS || d < .01) continue;
    const ang = Math.acos(THREE.MathUtils.clamp((dx * _fwd.x + dy * _fwd.y + dz * _fwd.z) / d, -1, 1));
    if (ang < menor) { menor = ang; mejor = p; }
  }
  return mejor;
}
