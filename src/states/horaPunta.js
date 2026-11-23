// 2 · Hora punta: la intro. Avanzar con W empujando a la multitud, conocer a los 4.
// Dueño: Camilo (diálogos: Renato, ambiente: Andy).
//
// Jugabilidad:
// - El vagón va lleno y con luz. Avanzas lento empujando (la gente se corre,
//   reclama y te frena).
// - Los diálogos van en una COLA: cada línea se muestra completa y en orden,
//   nunca se pisa ni se salta.
// - No puedes pasar a un pasajero hasta que termina de hablar (la multitud no
//   te deja), así que todos los textos aparecen sí o sí.
// - Mientras alguien habla, la cámara se gira suave hacia esa persona.
// - Al final: altavoz con interferencia, parpadeo de luces, frenazo y apagón.
import { createFlash } from '../mechanics/flash.js';
import { createMultitud } from '../mechanics/multitud.js';
import { createPasajeros, updatePasajeros } from '../world/pasajeros.js';
import { setupVagon, walkVagon } from '../world/vagonEscena.js';

// Textos provisorios (Renato los puede cambiar). Duración automática según largo.
const INTRO = [
  '18:04. Sales de la pega.',
  'El metro va lleno, como siempre. Solo quieres llegar a Casa.',
  '[W] Abrirte paso · [Mouse] Mirar',
];
const DIALOGOS = {
  Escolar: [
    'ESCOLAR: Disculpe… ¿este tren para en Casa?',
    'ESCOLAR: Mi mamá me dijo que no me bajara antes. Que contara las estaciones.',
  ],
  Oficinista: [
    'OFICINISTA (al teléfono): Sí, jefe… No, jefe, ya salí. Voy en el metro.',
    'OFICINISTA: Mañana a primera hora se lo mando. Sí. Sí, jefe.',
    'OFICINISTA: ¿Aló? ¿Jefe? …Se cortó.',
  ],
  Señora: [
    'SEÑORA: Ay, mijo, cuidado con el carro, que llevo los tomates.',
    'SEÑORA: Todos los días lo mismo… y nadie mira a nadie.',
  ],
  Vendedor: [
    'VENDEDOR: ¡A luca, a luca los chocolates! ¡Lleve, lleve!',
    'VENDEDOR: Usted tiene cara de cansado. Hágame caso…',
    'VENDEDOR: No se quede dormido en este tramo. Aquí la gente se pierde.',
  ],
};
// Respuestas del jugador (teclas 1–2) y lo que contesta cada pasajero.
// La elección queda en ctx.memoria[<pasajero>] para usarla en otras escenas.
const RESPUESTAS = {
  Escolar: [
    ['Sí, para en Casa. Yo también voy.', 'ESCOLAR: ¡Bacán! Entonces cuento con usted.'],
    ['No sé, pregúntale a otro.', 'ESCOLAR: Ah… ya. Sigo contando solo no más.'],
  ],
  Oficinista: [
    ['¿Todo bien?', 'OFICINISTA: Sí, sí… es que si mañana no llego a la hora, me echan.'],
    ['(No decir nada)', 'OFICINISTA: …Perdón. Hablo muy fuerte, ¿cierto?'],
  ],
  Señora: [
    ['Yo le ayudo con el carro.', 'SEÑORA: Ay, gracias, mijo. Ya no queda gente así.'],
    ['Permiso, voy apurado.', 'SEÑORA: Ya, ya… todos apurados.'],
  ],
  Vendedor: [
    ['Ya, deme uno.', 'VENDEDOR: Buena, caserito. Guárdelo, que el viaje es largo.'],
    ['No, gracias.', 'VENDEDOR: Usted se lo pierde… después no diga que no le ofrecí.'],
  ],
};
// Ingrediente obligatorio: «Queda una pura». El Escolar venía contando las estaciones.
const FINAL = [
  'ESCOLAR: ¡Queda una pura estación pa’ Casa!',
  'ALTAVOZ: Próxima estación… Ca… sa… —',
  'SEÑORA: ¿Qué fue eso?',
];
const RECLAMOS = ['¡Permiso!', '¡Oiga, no empuje!', 'Uf…', 'Córrase pa’ dentro…', '¡Ya po!', 'Con permiso, con permiso…'];
const MURMULLOS = ['…y llegué tarde otra vez…', '¿Alguien tiene hora?', '…mañana también, sí…', '…este tren va más lento que nunca…'];

const SPEED_FREE = 1.05;
const SPEED_PUSH = .5;
const TALK_RADIUS = 1.9;

const lineMs = (text) => Math.max(2600, 1300 + text.length * 55);

let S = null;

export default {
  id: 'horaPunta',
  next: 'apagon',
  hint: 'Avanza con W entre la gente. Busca a los cuatro pasajeros.',
  autoAdvance: true,
  enter(ctx) {
    const scene = setupVagon(ctx, { z: 12.2, ambient: 1.1, lit: true });
    const passengers = createPasajeros(ctx.stage);
    const crowd = createMultitud({
      colliders: scene.colliders,
      avoid: [{ x: 0, z: 12.2, r: .7 }, ...passengers.map((p) => ({ x: p.x, z: p.z, r: 1.0 }))],
    });
    ctx.stage.add(...crowd.meshes);

    S = {
      scene, passengers, crowd, t: 0,
      queue: [], lineEnd: 0, speaker: null,
      beat: 0, // índice del pasajero que toca conocer (4 = final)
      talking: false,
      lastComplain: -9, lastMurmur: 4, endAt: 0, ended: false, jolt: 0, flickerAt: [],
    };
    S.flash = createFlash({
      onFire() {
        ctx.audio.sfx('flash', { multitud: false });
        crowd.lookAt(ctx.camera.position);
        if (!S.queue.length && S.t >= S.lineEnd) say(ctx, '¡Oiga, sin flash!', 1600);
      },
    });
    ctx.hud.title('18:04', 'Hora punta');
    S.titleUntil = 2.4;
    INTRO.forEach((text) => S.queue.push({ text }));
    S.queue[0].delay = 2.6;
    ctx.audio.ambiente('vagon');
  },
  update(dt, ctx) {
    if (!S) return;
    const { scene, passengers, crowd, flash } = S;
    const cam = ctx.camera;
    const now = performance.now();
    S.t += dt;
    if (S.titleUntil && S.t > S.titleUntil) {
      S.titleUntil = 0;
      ctx.hud.title('');
    }

    // ---- final: frenazo, la gente se va hacia adelante, apagón
    if (S.endAt && S.t >= S.endAt) {
      if (!S.jolt) {
        S.jolt = S.t;
        scene.lurch = 1.4;
        ctx.audio.sfx('frenazo');
        for (const p of crowd.people) if (!p.seated) p.hz -= .4;
      }
      const k = S.t - S.jolt;
      cam.position.z -= dt * 1.4 * Math.max(0, 1 - k * 1.5);
      if (k > .7 && k < .78) ctx.fader.cut();
      if (k > .78 && k < .86) ctx.fader.clear(0);
      if (k > 1.05 && !S.ended) {
        S.ended = true;
        ctx.go(this.next, {}, { fade: false });
      }
      crowd.update(dt, cam.position);
      scene.light(0, dt, flash);
      return;
    }

    // ---- cola de diálogos: una línea a la vez, completa
    runQueue(ctx);

    // ---- moverse (lento; más lento empujando). No se puede pasar al que habla.
    const current = passengers[S.beat];
    const gate = current ? current.z + .35 : 2.4;
    const blockers = scene.colliders.concat(passengers.map((p) => ({ x: p.x, z: p.z, r: .2 })));
    const crowdInfo = crowd.update(dt, cam.position);
    // mientras habla un pasajero, escuchas (puedes mirar, no caminar)
    const listening = Boolean(S.speaker);
    const before = { x: cam.position.x, z: cam.position.z };
    walkVagon(dt, ctx, { colliders: blockers, speed: listening ? 0 : crowdInfo.pushing ? SPEED_PUSH : SPEED_FREE, minZ: gate });
    // destrabarse: si empujas y no avanzas, te deslizas hacia el centro del pasillo
    const pressing = ctx.input.down('KeyW') || ctx.input.down('ArrowUp');
    const movedNow = Math.hypot(cam.position.x - before.x, cam.position.z - before.z);
    S.stuck = pressing && !listening && movedNow < dt * .15 && cam.position.z > gate + .1 ? (S.stuck || 0) + dt : 0;
    if (S.stuck > .6) cam.position.x += (0 - cam.position.x) * Math.min(1, dt * 1.5);
    updatePasajeros(passengers, dt, cam);

    // mirar suave hacia quien habla (si el jugador no está moviendo el mouse)
    if (S.speaker && Math.abs(ctx.input.mouse.dx) < 1) {
      const dx = S.speaker.x - cam.position.x;
      const dz = S.speaker.z - cam.position.z;
      const yaw = Math.atan2(-dx, -dz);
      const diff = Math.atan2(Math.sin(yaw - cam.rotation.y), Math.cos(yaw - cam.rotation.y));
      cam.rotation.y += diff * Math.min(1, dt * 1.6);
      cam.rotation.x += (-.08 - cam.rotation.x) * Math.min(1, dt * 1.6);
    }

    // sin nadie hablando y caminando: la vista vuelve de a poco hacia el fondo del vagón
    const walking = ctx.input.down('KeyW') || ctx.input.down('ArrowUp');
    if (!S.speaker && walking && Math.abs(ctx.input.mouse.dx) < 1) {
      const diff = Math.atan2(Math.sin(-cam.rotation.y), Math.cos(-cam.rotation.y));
      cam.rotation.y += diff * Math.min(1, dt * .9);
    }

    if (ctx.input.pressed('KeyF')) flash.fire(now);
    scene.light(flash.level(now), dt, flash);
    scene.overlay.u.uFlash.value = Math.max(0, 1 - flash.since(now) / .14) * .6;

    // ---- conocer al pasajero que toca (en orden, por cercanía)
    const reached = current && (Math.hypot(current.x - cam.position.x, current.z - cam.position.z) < TALK_RADIUS
      || cam.position.z < current.z + 1.1);
    if (current && !S.talking && reached) {
      S.talking = true;
      S.queue = S.queue.filter((l) => !l.filler); // lo importante primero
      DIALOGOS[current.name].forEach((text, i) => S.queue.push({
        text,
        speaker: current,
        // la voz suena sola desde ctx.hud.subtitle (ui/voces.js)
        onEnd: i === DIALOGOS[current.name].length - 1 ? () => responder(ctx, current) : null,
      }));
      ctx.progress();
    }
    // si está pegado a la reja invisible esperando, que se note por qué
    if (current && !S.talking && cam.position.z <= gate + .05 && S.t > S.lineEnd && !S.queue.length) {
      say(ctx, '(No hay por dónde pasar. Mira a tu alrededor.)', 2200);
    }

    // ---- relleno: reclamos al empujar y murmullos (solo si no habla nadie)
    const quiet = !S.queue.length && S.t > S.lineEnd + .4 && S.beat < passengers.length;
    if (quiet && crowdInfo.shoved && S.t - S.lastComplain > 2.2) {
      S.lastComplain = S.t;
      say(ctx, RECLAMOS[Math.floor(Math.random() * RECLAMOS.length)], 1400);
      ctx.audio.sfx('empujon');
    } else if (quiet && S.t - S.lastMurmur > 7) {
      S.lastMurmur = S.t;
      say(ctx, MURMULLOS[Math.floor(Math.random() * MURMULLOS.length)], 2000);
    }

    // parpadeos programados (antes del frenazo)
    if (S.flickerAt.length && S.t >= S.flickerAt[0].t) {
      const { off } = S.flickerAt.shift();
      if (off) ctx.fader.cut(); else ctx.fader.clear(0);
    }

    // sacudones del tren para que se sienta en movimiento
    if (Math.floor(S.t / 11) !== Math.floor((S.t - dt) / 11)) scene.lurch = .5;
  },
  exit(ctx) {
    S?.scene.dispose();
    S = null;
    ctx.fader.clear(0);
  },
};

function say(ctx, text, ms = lineMs(text)) {
  ctx.hud.subtitle(text, ms);
  S.lineEnd = S.t + ms / 1000;
}

function runQueue(ctx) {
  if (S.t < S.lineEnd + .25) return;
  if (S.pendingEnd) {
    const fn = S.pendingEnd;
    S.pendingEnd = null;
    fn();
  }
  const line = S.queue[0];
  if (!line) {
    S.speaker = null;
    return;
  }
  if (line.delay && S.t < line.delay) return;
  S.queue.shift();
  say(ctx, line.text);
  S.speaker = line.speaker || null;
  line.onStart?.();
  if (line.onEnd) S.pendingEnd = line.onEnd;
  ctx.progress();
}

// Después de que un pasajero habla, el jugador responde (1–2) y el pasajero contesta.
function responder(ctx, pasajero) {
  const opciones = RESPUESTAS[pasajero.name];
  if (!opciones) { nextBeat(ctx); return; }
  const yo = S;
  ctx.hud.elegir(opciones.map(([o]) => o)).then((i) => {
    if (S !== yo) return; // se salió o reinició la escena mientras elegía
    ctx.memoria[pasajero.name] = i;
    S.queue.push({ text: opciones[i][1], speaker: pasajero, onEnd: () => nextBeat(ctx) });
  });
}

function nextBeat(ctx) {
  S.beat += 1;
  S.talking = false;
  if (S.beat < S.passengers.length) return;
  // los cuatro: altavoz, parpadeo, alguien pregunta… y frenazo
  FINAL.forEach((text, i) => S.queue.push({
    text,
    speaker: i === 0 ? S.passengers.find((p) => p.name === 'Escolar') : i === 2 ? S.passengers.find((p) => p.name === 'Señora') : null,
    onStart: i === 1 ? () => {
      ctx.audio.sfx('pitido');
      const t = S.t + 1.6;
      S.flickerAt = [0, .08, .3, .36, .5, .56].map((d, k) => ({ t: t + d, off: k % 2 === 0 }));
    } : null,
    onEnd: i === FINAL.length - 1 ? () => { S.endAt = S.t + .6; } : null,
  }));
}

