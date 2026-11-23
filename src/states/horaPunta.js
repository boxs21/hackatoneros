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
import * as THREE from 'three';
import { createFlash } from '../mechanics/flash.js';
import { createMultitud } from '../mechanics/multitud.js';
import { REGALOS, dar, mostrarRegalos, tiene } from '../mechanics/regalos.js';
import { createPasajeros, updatePasajeros } from '../world/pasajeros.js';
import { setupVagon, walkVagon } from '../world/vagonEscena.js';

// Textos provisorios (Renato los puede cambiar). Duración automática según largo.
const INTRO = [
  '18:04. Sales de la pega. Solo quieres llegar a Casa.',
  'Sacas el celular para avisarle a tu mamá… Oh. Sin batería.',
  'Y en hora punta.',
];
// Orden en que los conoces. El Oficinista va al último: le pides su celular para
// llamar a tu mamá y, justo después, viene la catástrofe.
const ORDEN_CHARLA = ['Escolar', 'Señora', 'Vendedor', 'Oficinista'];
const DIALOGOS = {
  // Recortado para que la intro dure ~80 s: lo que se queda adelanta lo que viene.
  Escolar: [
    'ESCOLAR: Disculpe… ¿este tren para en Casa? Mi mamá me dijo que contara las estaciones.',
  ],
  Oficinista: [
    'OFICINISTA (al teléfono): Sí, jefe… mañana a primera hora se lo mando.',
    'OFICINISTA: ¿Aló? ¿Jefe? …Se cortó.',
  ],
  Señora: [
    'SEÑORA: Cuidado con el carro, mijo. Todos los días lo mismo… y nadie mira a nadie.',
  ],
  Vendedor: [
    'VENDEDOR: ¡A luca los chocolates! …No se quede dormido en este tramo. Aquí la gente se pierde.',
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
    ['Disculpe, ¿me presta el celular? Tengo que llamar a mi mamá.', 'OFICINISTA: Ya… pero rapidito, que ando con poca señal.'],
    ['¿Todo bien? …¿Y me presta el celular? Es pa’ llamar a mi mamá.', 'OFICINISTA: Si mañana no llego a la hora, me echan… Tome, llame no más.'],
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
// El altavoz no alcanza a terminar: a media frase se corta la voz y se va la luz.
const FINAL = [
  'Marcas el número de tu mamá. Suena una vez…',
  'ESCOLAR: ¡Queda una pura estación pa’ Casa!',
  'ALTAVOZ: Próxima estación… Baque—',
];
// Misión en pantalla (lista de Valentín, src/ui/misiones.js): a quién ir ahora.
const MISION = {
  Escolar: 'Acércate al escolar del gorro azul',
  Oficinista: 'Pídele el celular al oficinista para llamar a tu mamá',
  Señora: 'Acércate a la señora del carro de feria',
  Vendedor: 'Acércate al vendedor de chocolates',
};
// Apertura de cine: puertas que se cierran y la cámara gira hacia el pasillo.
const CINE = 3.8; // s sin control al empezar
// Segundos desde que empieza a sonar el altavoz hasta el frenazo. El corte seco
// llega 1,85 s después (final de hora punta + apagón): la voz alcanza a decir "Baque—".
const FRENAZO_TRAS_ALTAVOZ = 1.4;
const RECLAMOS = ['¡Permiso!', '¡Oiga, no empuje!', 'Uf…', 'Córrase pa’ dentro…', '¡Ya po!', 'Con permiso, con permiso…'];
const MURMULLOS = ['…y llegué tarde otra vez…', '¿Alguien tiene hora?', '…mañana también, sí…', '…este tren va más lento que nunca…'];

const SPEED_FREE = 1.3;
const SPEED_PUSH = .65;
const TALK_RADIUS = 1.9;

const lineMs = (text) => Math.max(2200, 900 + text.length * 50);

let S = null;

export default {
  id: 'horaPunta',
  next: 'apagon',
  hint: 'Avanza con W entre la gente. Busca a los cuatro pasajeros.',
  autoAdvance: true,
  enter(ctx) {
    const scene = setupVagon(ctx, { z: 12.2, ambient: 1.1, lit: true });
    // Los mismos cuatro, pero en el orden de la charla: el primero más cerca, el Oficinista al fondo.
    const creados = createPasajeros(ctx.stage);
    const lugares = creados.map((p) => ({ x: p.x, z: p.z })).sort((a, b) => b.z - a.z);
    const passengers = ORDEN_CHARLA.map((n) => creados.find((p) => p.name === n)).filter(Boolean);
    passengers.forEach((p, i) => {
      p.x = lugares[i].x;
      p.z = lugares[i].z;
      p.root.position.set(p.x, 0, p.z);
    });
    const crowd = createMultitud({
      colliders: scene.colliders,
      avoid: [
        { x: 0, z: 12.2, r: .7 },
        ...passengers.map((p) => ({ x: p.x, z: p.z, r: 1.0 })),
        // línea de visión despejada hacia la puerta que se cierra en la apertura
        ...[[.55, 11.2], [1.1, 10.3], [1.6, 9.4], [2.0, 8.6]].map(([x, z]) => ({ x, z, r: .55 })),
      ],
    });
    ctx.stage.add(...crowd.meshes);

    S = {
      scene, passengers, crowd, t: 0,
      queue: [], lineEnd: 0, speaker: null,
      beat: 0, // índice del pasajero que toca conocer (4 = final)
      talking: false,
      lastComplain: -9, lastMurmur: 4, endAt: 0, ended: false, jolt: 0, flickerAt: [],
    };
    if (ctx.demo) window.__S = S; // depurar (solo ?demo=1)
    // "!" ámbar sobre el pasajero al que hay que ir (se ve con los modelos 3D)
    const c = document.createElement('canvas');
    c.width = 8;
    c.height = 16;
    const g = c.getContext('2d');
    g.fillStyle = '#ffb800';
    g.fillRect(3, 1, 2, 9);
    g.fillRect(3, 12, 2, 2);
    const tex = new THREE.CanvasTexture(c);
    tex.magFilter = tex.minFilter = THREE.NearestFilter;
    S.marca = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, fog: false }));
    S.marca.scale.set(.2, .4, 1);
    S.marca.renderOrder = 990;
    S.marca.visible = false;
    ctx.stage.add(S.marca);
    S.flash = createFlash({
      onFire() {
        ctx.audio.sfx('flash', { multitud: false });
        crowd.lookAt(ctx.camera.position);
        if (!S.queue.length && S.t >= S.lineEnd) say(ctx, '¡Oiga, sin flash!', 1600);
      },
    });
    // apertura: mirando la puerta lateral abierta, que se cierra; después, el pasillo
    S.doorLeaves = scene.vagon.parts.leaves.filter((l) => l.dz === 8).map((l) => ({ ...l, z0: l.mesh.position.z }));
    for (const l of S.doorLeaves) l.mesh.position.z = l.z0 + l.k * .6;
    S.yawDoor = Math.atan2(-2.5, 4.2);
    ctx.camera.rotation.y = S.yawDoor;
    S.titleAt = 1.9;
    S.titleUntil = 4.4;
    // Partes sin nada: el celular (y lo demás) te lo van pasando los cuatro.
    mostrarRegalos(ctx, { reiniciar: true });
    // Antes del apagón se ve NORMAL: sin celular en la mano, sin flash y sin bordes
    // de cámara. La cámara del celular recién aparece después del apagón (Los cinco).
    scene.celular.group.visible = false;
    scene.overlay.u.uVig.value = 0;
    INTRO.forEach((text) => S.queue.push({ text }));
    S.queue[0].delay = CINE + .3;
    ctx.audio.ambiente('vagon');
  },
  update(dt, ctx) {
    if (!S) return;
    const { scene, passengers, crowd, flash } = S;
    const cam = ctx.camera;
    const now = performance.now();
    S.t += dt;
    if (S.titleAt && S.t > S.titleAt) {
      S.titleAt = 0;
      ctx.hud.title('18:04', 'Hora punta');
    }
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
      if (k > 1.05 && !S.ended) {
        S.ended = true;
        ctx.go(this.next, {}, { fade: false });
      }
      crowd.update(dt, cam.position);
      scene.light(0, dt, flash);
      return;
    }

    // ---- cola de diálogos: una línea a la vez, completa
    if (ctx.input.pressed('Space') || ctx.input.pressed('Enter')) skipLine(ctx);
    runQueue(ctx);

    // ---- moverse (lento; más lento empujando). No se puede pasar al que habla.
    const current = passengers[S.beat];
    const gate = current ? current.z + .35 : 2.4;
    const blockers = scene.colliders.concat(passengers.map((p) => ({ x: p.x, z: p.z, r: .2 })));
    const crowdInfo = crowd.update(dt, cam.position);
    // mientras habla un pasajero, escuchas (puedes mirar, no caminar)
    const listening = Boolean(S.speaker);
    const before = { x: cam.position.x, z: cam.position.z };
    if (S.t < CINE) {
      cinematicOpening(ctx, S);
    } else if (S.cinematic) {
      // momentos guiados (todos te miran, altavoz, frenazo): quieto, mirando el pasillo
      ease(cam, 0, 0, dt, 2.2);
    } else {
      walkVagon(dt, ctx, { colliders: blockers, speed: listening ? 0 : crowdInfo.pushing ? SPEED_PUSH : SPEED_FREE, minZ: gate });
    }
    // destrabarse: si empujas y no avanzas, te deslizas hacia el centro del pasillo
    const pressing = ctx.input.down('KeyW') || ctx.input.down('ArrowUp');
    const movedNow = Math.hypot(cam.position.x - before.x, cam.position.z - before.z);
    S.stuck = pressing && !listening && movedNow < dt * .15 && cam.position.z > gate + .1 ? (S.stuck || 0) + dt : 0;
    if (S.stuck > .6) cam.position.x += (0 - cam.position.x) * Math.min(1, dt * 1.5);
    updatePasajeros(passengers, dt, cam);

    // quien empieza a hablar queda encuadrado (1 s, aunque muevas el mouse)
    if (S.speaker && S.speaker !== S.lastSpeaker) S.lockUntil = S.t + 1;
    S.lastSpeaker = S.speaker;
    if (S.speaker && !S.cinematic && S.t < S.lockUntil) {
      ease(cam, Math.atan2(-(S.speaker.x - cam.position.x), -(S.speaker.z - cam.position.z)), -.08, dt, 4);
    }
    // el pasajero que toca te llama con la mano
    if (current && !S.talking && S.t > CINE) {
      const far = Math.hypot(current.x - cam.position.x, current.z - cam.position.z) > 2.3;
      const wave = far && S.t % 3.5 < 1.1;
      const target = wave ? -2.7 + Math.sin(S.t * 12) * .25 : 0;
      current.armR.rotation.x += (target - current.armR.rotation.x) * Math.min(1, dt * 8);
    }
    for (const p of passengers) if (p !== current || S.talking) p.armR.rotation.x *= Math.max(0, 1 - dt * 6);
    S.marca.visible = Boolean(current && !S.talking && S.t > CINE && !S.cinematic);
    if (S.marca.visible) S.marca.position.set(current.x, 2.08 + Math.sin(S.t * 4) * .04, current.z);
    // mirar suave hacia quien habla (si el jugador no está moviendo el mouse)
    if (S.speaker && !S.cinematic && Math.abs(ctx.input.mouse.dx) < 1) {
      const dx = S.speaker.x - cam.position.x;
      const dz = S.speaker.z - cam.position.z;
      const yaw = Math.atan2(-dx, -dz);
      const diff = Math.atan2(Math.sin(yaw - cam.rotation.y), Math.cos(yaw - cam.rotation.y));
      cam.rotation.y += diff * Math.min(1, dt * 1.6);
      cam.rotation.x += (-.08 - cam.rotation.x) * Math.min(1, dt * 1.6);
    }

    // sin nadie hablando y caminando: la vista vuelve de a poco hacia el fondo del vagón
    const walking = ctx.input.down('KeyW') || ctx.input.down('ArrowUp');
    if (!S.speaker && !S.cinematic && walking && Math.abs(ctx.input.mouse.dx) < 1) {
      const diff = Math.atan2(Math.sin(-cam.rotation.y), Math.cos(-cam.rotation.y));
      cam.rotation.y += diff * Math.min(1, dt * .9);
    }

    scene.light(flash.level(now), dt, flash); // sin flash en hora punta: se ve normal
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
    const quiet = !S.queue.length && !S.choosing && S.t > S.lineEnd + .4 && S.beat < passengers.length;
    if (quiet && crowdInfo.shoved && S.t - S.lastComplain > 2.2) {
      S.lastComplain = S.t;
      say(ctx, RECLAMOS[Math.floor(Math.random() * RECLAMOS.length)], 1400);
      ctx.audio.sfx('empujon');
    } else if (quiet && S.t - S.lastMurmur > 10) {
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
  if (text) ctx.hud.subtitle(text, ms); // texto vacío = silencio (pausa dramática)
  S.lineEnd = S.t + ms / 1000;
  S.curText = text;
}

// Saltar diálogo: Espacio o Enter pasan a la siguiente línea. No se saltan las
// pausas en silencio, "todos te miran" ni el final (S.cinematic): son el susto.
function skipLine(ctx) {
  if (S.t < CINE || S.cinematic || !S.curText || S.t >= S.lineEnd) return;
  S.lineEnd = S.t - .25; // la cola sigue en este mismo cuadro
  if (!S.queue.length) ctx.hud.subtitle('', 1); // si no viene nada, cierra el subtítulo (y su voz)
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
  say(ctx, line.text, line.ms);
  if (line.speaker && !S.skipTold) {
    S.skipTold = true;
    ctx.hud.hint('[Espacio] saltar diálogo', 4500);
  }
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
  S.choosing = true; // mientras eliges, la multitud no murmura
  ctx.hud.elegir(opciones.map(([o]) => o), { ms: 6000 }).then((i) => {
    if (S !== yo) return; // se salió o reinició la escena mientras elegía
    S.choosing = false;
    ctx.memoria[pasajero.name] = i;
    S.queue.push({ text: opciones[i][1], speaker: pasajero });
    entregar(ctx, pasajero);
  });
}

// Cada pasajero te pasa algo que después sirve (mechanics/regalos.js). Estira el brazo,
// lo recibes y recién ahí se puede seguir.
function entregar(ctx, pasajero) {
  const r = REGALOS[pasajero.name];
  if (!r) { S.queue.push({ text: '…', onEnd: () => nextBeat(ctx) }); return; }
  S.queue.push({
    text: r.linea,
    speaker: pasajero,
    onStart: () => { pasajero.armR.rotation.x = -1.25; },
  });
  S.queue.push({
    text: '',
    ms: 2200,
    onStart: () => {
      pasajero.armR.rotation.x = 0;
      dar(ctx, pasajero.name);
      ctx.hud.obtenido(r.nombre, r.uso);
    },
    onEnd: () => nextBeat(ctx),
  });
}

function nextBeat(ctx) {
  S.beat += 1;
  S.talking = false;
  if (S.beat < S.passengers.length) {
    ctx.misiones?.set(MISION[S.passengers[S.beat].name]);
    return;
  }
  ctx.misiones?.set(null);
  // los cuatro: silencio y TODOS TE MIRAN (inquietante, sin golpe)
  S.queue.push({ text: '', ms: 700 });
  S.queue.push({
    text: '',
    ms: 2800,
    onStart: () => {
      S.cinematic = true; // desde aquí hasta el apagón, la cámara se encarga
      S.crowd.stare(true);
      ctx.audio.ambiente(null, { fade: .4 });
    },
    onEnd: () => {
      S.crowd.stare(false);
      ctx.audio.ambiente('vagon', { fade: .2 });
    },
  });
  // altavoz, parpadeo, alguien pregunta… y frenazo
  FINAL.forEach((text, i) => S.queue.push({
    text,
    speaker: i === 1 ? S.passengers.find((p) => p.name === 'Escolar') : null,
    // 0: la llamada a tu mamá (suena una vez). 2: el altavoz que se corta.
    onStart: i === 0 ? () => ctx.audio.sfx('celular') : i === 2 ? () => {
      // La campanilla la pone el motor de audio al mostrar el subtítulo del altavoz.
      // seguridad (DISENO.md): solo 2 bajones lentos, bien separados (< 3 destellos por segundo),
      // y caben antes del frenazo.
      const t = S.t + .25;
      S.flickerAt = [0, .18, .8, .98].map((d, k) => ({ t: t + d, off: k % 2 === 0 }));
      S.endAt = S.t + FRENAZO_TRAS_ALTAVOZ;
    } : null,
  }));
}


// Girar la cámara suave hacia (yaw, pitch).
function ease(cam, yaw, pitch, dt, speed) {
  const diff = Math.atan2(Math.sin(yaw - cam.rotation.y), Math.cos(yaw - cam.rotation.y));
  cam.rotation.y += diff * Math.min(1, dt * speed);
  cam.rotation.x += (pitch - cam.rotation.x) * Math.min(1, dt * speed);
}

// Apertura: pitido de cierre, la puerta se cierra, la cámara gira hacia el pasillo lleno.
function cinematicOpening(ctx, S) {
  const cam = ctx.camera;
  const t = S.t;
  if (!S.openSfx && t > .15) { S.openSfx = 1; ctx.audio.sfx('pitido'); }
  if (S.openSfx === 1 && t > .9) { S.openSfx = 2; ctx.audio.sfx('puertas'); }
  const close = THREE.MathUtils.smoothstep(t, .9, 1.7);
  for (const l of S.doorLeaves) l.mesh.position.z = l.z0 + l.k * .6 * (1 - close);
  const pan = THREE.MathUtils.smoothstep(t, 1.9, CINE - .2);
  cam.rotation.set(-.02 * (1 - pan), S.yawDoor * (1 - pan), 0);
  if (t > CINE - .05 && !S.misionSet) {
    S.misionSet = true;
    ctx.misiones?.set(MISION[S.passengers[0].name]);
  }
}
