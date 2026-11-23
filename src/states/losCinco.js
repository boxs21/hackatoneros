// 4 · Los cinco: ~30 s de calma falsa a oscuras; tutorial del flash.
// Dueño: Valentín (v4). Implementado por Camilo con el vagón y el flash de Camilo.
//
// Después del apagón quedan los cinco. Conversan, el oficinista te recuerda (o te
// pasa) su celular y aprendes el flash con calma:
//   1.er flash: solo ustedes. Alivio.
//   2.º flash: alguien parado al fondo del vagón. "¿Quién está ahí atrás?"
//   3.er flash: ya no está… y empiezan los borrados (sin repetir su intro).
// Si no aprietas F, te lo recuerdan; a los 30 s, pista; a los 90 s, avance automático.
import { createBorrados } from '../mechanics/borrados.js';
import { createFlash } from '../mechanics/flash.js';
import { dar, mostrarRegalos, tiene } from '../mechanics/regalos.js';
import { createPasajeros, updatePasajeros } from '../world/pasajeros.js';
import { setupVagon, walkVagon } from '../world/vagonEscena.js';

const CHARLA = [
  [1.0, 'OFICINISTA: ¿Están todos bien?'],
  [3.6, 'SEÑORA: Ay, Dios mío… no se ve nada.'],
  [6.2, 'ESCOLAR: ¿Se cortó la luz en todo el metro?'],
  [8.8, 'OFICINISTA: Tranquilos. Esto pasa. En un rato parte.'],
];
const RECORDAR = 9; // s sin apretar F antes de recordarlo

let S = null;

export default {
  id: 'losCinco',
  next: 'borrados',
  hint: 'Aprieta F para usar el flash del celular.',
  autoAdvance: true,
  enter(ctx) {
    ctx.audio.ambiente('tunel');
    const scene = setupVagon(ctx, { z: 11, ambient: .35, fogFar: 13 });
    // el Vendedor ya no está: lo encuentras muerto en el vagón siguiente (world/vendedorMuerto.js)
    const passengers = createPasajeros(ctx.stage, { sin: ['Vendedor'] });
    mostrarRegalos(ctx);
    // el que está al fondo (solo se ve con el 2.º flash)
    const fondo = createBorrados({ seed: 4, zFrom: 20, zTo: 21, ladoTries: 0, reserve: 1, fillOutside: false });
    fondo.convert(-.6, 2.4); // ~9 m, al lado de la barra central para que no la tape
    fondo.face(ctx.camera.position);
    ctx.stage.add(fondo.mesh);

    S = { scene, passengers, fondo, t: 0, lines: [...CHARLA], step: 'charla', stepAt: 0, flashes: 0, ended: false };
    if (ctx.demo) window.__S = S;
    S.flash = createFlash({
      onFire(n) {
        ctx.audio.sfx('flash', { multitud: n === 2 });
        S.flashes = n;
        S.stepAt = S.t;
        ctx.progress();
        if (n === 1) S.step = 'alivio';
        else if (n === 2) S.step = 'fondo';
        else if (n >= 3 && S.step !== 'fin') S.step = 'fin';
      },
    });
  },
  update(dt, ctx) {
    if (!S) return;
    const { scene, passengers, fondo, flash } = S;
    const cam = ctx.camera;
    const now = performance.now();
    S.t += dt;

    // charla inicial
    while (S.lines.length && S.t >= S.lines[0][0]) ctx.hud.subtitle(S.lines.shift()[1], 2800);

    // guion del tutorial
    const desde = S.t - S.stepAt;
    if (S.step === 'charla' && S.t > 11.4) {
      if (tiene(ctx, 'celular')) {
        ctx.hud.subtitle('OFICINISTA: Usted tiene mi celular. Préndale el flash.', 3200);
      } else {
        dar(ctx, 'Oficinista');
        ctx.hud.subtitle('OFICINISTA: Tome, use mi celular. Tiene flash.', 3200);
      }
      ctx.misiones?.set('Usa el flash del celular [F]');
      S.step = 'esperaF';
      S.stepAt = S.t;
    } else if (S.step === 'esperaF' && desde > RECORDAR) {
      ctx.hud.subtitle('[F] Flash del celular', 3000);
      S.stepAt = S.t;
    } else if (S.step === 'alivio' && desde > .5 && !S.dijo1) {
      S.dijo1 = true;
      ctx.hud.subtitle('ESCOLAR: ¡Ahí están todos! Uf…', 2600);
    } else if (S.step === 'alivio' && desde > 3.4 && !S.pide2) {
      S.pide2 = true;
      ctx.hud.subtitle('OFICINISTA: Saque otra, pa’ ver el fondo.', 3000);
      ctx.misiones?.set('Saca otra foto [F]');
    } else if (S.step === 'fondo' && desde > 1.1 && !S.dijo2) {
      S.dijo2 = true;
      ctx.hud.subtitle('SEÑORA: ¿Quién está ahí atrás?', 2600);
    } else if (S.step === 'fondo' && desde > 4 && !S.pide3) {
      S.pide3 = true;
      ctx.hud.subtitle('SEÑORA: …Nadie se mueva. Saque otra, mijo.', 3000);
      ctx.misiones?.set('Saca otra foto [F]');
    } else if (S.step === 'fin' && desde > .6 && !S.dijo3) {
      S.dijo3 = true;
      ctx.hud.subtitle('ESCOLAR: ¿Dónde se fue?', 2200);
    } else if (S.step === 'fin' && desde > 2.4 && !S.ended) {
      S.ended = true;
      ctx.misiones?.set(null);
      ctx.next({ desdeCinco: true });
    }

    // moverse poco: estás con ellos
    // mientras los sobrevivientes conversan no puedes caminar (mirar sí)
    walkVagon(dt, ctx, { speed: S.step === 'charla' ? 0 : 1.4, minZ: 9.4, maxZ: 12.4, colliders: passengers.map((p) => ({ x: p.x, z: p.z, r: .25 })) });
    updatePasajeros(passengers, dt, cam);

    if (!S.ended && ctx.input.pressed('KeyF') && S.step !== 'charla') flash.fire(now);
    const level = ctx.demo && window.__fdsHold ? 1 : flash.level(now);
    const glow = flash.glow(now);
    scene.light(level, dt, flash);
    scene.overlay.u.uFlash.value = Math.max(0, 1 - flash.since(now) / .14) * .75;
    // el del fondo existe solo en el 2.º flash (y su imagen retenida)
    fondo.show(S.flashes === 2 ? level : 0, S.flashes === 2 ? glow : 0);
  },
  exit(ctx) {
    S?.scene.dispose();
    S = null;
    ctx.misiones?.set(null);
  },
};

