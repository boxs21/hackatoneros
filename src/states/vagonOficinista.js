// Extra · Vagón del Oficinista: el vagón que se repite (anomalías, estilo The Exit 8).
// Dueño: Camilo.
//
// Jugabilidad:
// - El vagón se repite. La primera vuelta siempre es normal: memorízalo.
// - Cada vuelta decides: si todo está normal, SIGUE hacia la puerta del fondo.
//   Si algo cambió, DATE VUELTA y sal por la puerta de atrás.
// - Acierto = una estación menos para Casa (letrero sobre la puerta del fondo).
//   Error = susto y vuelves a 0. Hay que acertar 3 seguidas.
// - Nuestro giro: algunas anomalías solo se ven con el flash, y en este vagón
//   también hay borrados sentados que se acercan con cada flash. Mirar cuesta.
// - Anomalía peligrosa: uno camina hacia ti a oscuras. Si te alcanza, error.
import * as THREE from 'three';
import { createBorrados, CATCH_RADIUS } from '../mechanics/borrados.js';
import { createFlash } from '../mechanics/flash.js';
import { basic, lambert, pixelTexture } from '../world/ps1.js';
import { textura, garabato } from '../world/texturas.js';
import { setupVagon, walkVagon } from '../world/vagonEscena.js';
import { createObjeto, createFigura, borradoGeometry } from '../world/figura.js';
import { PASAJEROS } from '../world/pasajeros.js';
import { createScare } from '../world/susto.js';

const GOAL = 3;
// Por dificultad: 0 obvias, 1 medias, 2 sutiles o con flash.
const POOL = [
  ['aviso', 'maletin', 'luces', 'puerta'],
  ['mapa', 'manillas', 'espaldas', 'acecho'],
  ['caras', 'tiza', 'avisoGrande', 'acecho'],
];
const NOMBRE = {
  aviso: 'los avisos decían otra cosa',
  maletin: 'el maletín en el asiento',
  luces: 'las luces estaban rojas',
  puerta: 'una puerta estaba abierta',
  mapa: 'CASA estaba tachada en el mapa',
  manillas: 'las manillas estaban todas inclinadas',
  espaldas: 'había un hombre de espaldas al fondo',
  acecho: 'algo venía caminando hacia ti',
  caras: 'había caras en las ventanas (con flash)',
  tiza: 'decía DATE VUELTA en el piso (con flash)',
  avisoGrande: 'un aviso era más grande',
};

let S = null;

export default {
  id: 'vagonOficinista',
  next: 'vagonVendedor',
  hint: 'Compara con el primer vagón. Si algo cambió: date vuelta y sal por atrás. Si no: sigue adelante.',
  autoAdvance: true,
  enter(ctx, data = {}) {
    const progress = data.progress || 0;
    const loop = data.loop || 0;
    const solved = data.solved || [];
    const wrongStreak = data.wrongStreak || 0;
    const scene = setupVagon(ctx, { z: 10.6, ambient: .5, lit: true, litColor: 0xd9f0c8, litPower: 1.3 });

    // los de siempre: sentados frente a las bancas, solo con flash (no son anomalía)
    const crowd = createBorrados({ colliders: scene.colliders, seed: 77, zFrom: 20, zTo: 21, ladoTries: 16, fillOutside: false, reserve: 0 });
    const scare = createScare();
    ctx.stage.add(crowd.mesh, scare.group);
    crowd.face(ctx.camera.position);

    // ¿hay anomalía en esta vuelta?
    let anomaly = null;
    if (loop > 0) {
      const tier = wrongStreak >= 3 ? 0 : Math.min(progress, 2);
      const fresh = POOL[tier].filter((a) => !solved.includes(a));
      const options = fresh.length ? fresh : POOL[tier];
      if (wrongStreak >= 3 || Math.random() < .6) anomaly = options[Math.floor(Math.random() * options.length)];
    }
    if (ctx.demo && data.force) anomaly = data.force; // depurar/presentar: forzar una anomalía (solo ?demo=1)

    S = { scene, crowd, scare, anomaly, progress, loop, solved, wrongStreak, t: 0, decided: false, wrongT: -1,
      flashOnly: [], extraCrowds: [], stalker: null, started: false, lines: [], lineAt: 0 };
    S.flash = createFlash({
      onFire(count) {
        ctx.audio.sfx('flash');
        const pos = ctx.camera.position;
        crowd.step(pos, count === 1 ? 0 : .3);
        for (const c of S.extraCrowds) c.step(pos, .3);
      },
    });

    // cartel de reglas (homenaje al aviso amarillo) y letrero de estaciones
    const rules = new THREE.Mesh(new THREE.PlaneGeometry(.5, .75), basic({ map: textura('reglas') }));
    rules.position.set(-2.42, 1.9, 9.3);
    rules.rotation.y = Math.PI / 2;
    ctx.stage.add(rules);
    ctx.stage.add(ledSign(GOAL - progress));

    applyAnomaly(ctx, S);

    // textos de la vuelta
    if (loop === 0) {
      S.lines = [
        [.6, 'Otro vagón. Vacío. La luz se ve… enferma.', 3200],
        [4.2, 'Lee el aviso amarillo de tu izquierda.', 3000],
        [7.6, 'Memoriza este vagón. Lo vas a volver a ver.', 3400],
      ];
    } else {
      ctx.hud.title(String(GOAL - progress), GOAL - progress === 1 ? 'estación para Casa' : 'estaciones para Casa');
      S.titleUntil = 1.6;
      if (data.msg) S.lines = [[.3, data.msg, 2800]];
    }
    ctx.progress();
  },
  update(dt, ctx) {
    if (!S) return;
    const { scene, crowd, flash, scare } = S;
    const cam = ctx.camera;
    const now = performance.now();
    S.t += dt;
    if (S.titleUntil && S.t > S.titleUntil) { S.titleUntil = 0; ctx.hud.title(''); }
    while (S.lines.length && S.t >= S.lines[0][0]) {
      const [, text, ms] = S.lines.shift();
      ctx.hud.subtitle(text, ms);
    }

    // error: susto y de vuelta a cero
    if (S.wrongT >= 0) {
      S.wrongT += dt;
      scare.update(dt, cam, S.wrongT);
      scene.light(S.wrongT < .12 ? 1 : Math.max(0, .5 - S.wrongT), dt);
      scene.overlay.u.uCaught.value = Math.min(1, S.wrongT * 4);
      if (S.wrongT > .6 && !S.decided) {
        S.decided = true;
        ctx.go(this.id, { progress: 0, loop: S.loop + 1, solved: S.solved, wrongStreak: S.wrongStreak + 1, msg: S.failMsg });
      }
      return;
    }

    walkVagon(dt, ctx, { colliders: scene.colliders.concat(S.blockers || []), speed: 2.0, minZ: -12.4, maxZ: 12.45 });
    if (cam.position.z < 9.6) S.started = true;

    if (!S.decided && ctx.input.pressed('KeyF')) flash.fire(now);
    const level = ctx.demo && window.__fdsHold ? 1 : flash.level(now);
    const glow = flash.glow(now);
    crowd.show(level, glow);
    for (const c of S.extraCrowds) c.show(level, glow);
    const chalk = Math.max(level, glow * .75);
    for (const m of S.flashOnly) m.material.opacity = chalk;

    // el que camina hacia ti (anomalía peligrosa)
    if (S.stalker && S.started && !S.decided) S.stalker.crowd.nudge(S.stalker.p, cam.position, dt * .55, 0);

    // peligro: radar del celular y viñeta
    let d = crowd.nearest(cam.position);
    for (const c of S.extraCrowds) d = Math.min(d, c.nearest(cam.position));
    scene.danger = THREE.MathUtils.clamp((1.6 - d) / 1.1, 0, 1);
    // el que te acecha se siente en el celular desde lejos (aviso justo)
    if (S.stalker) {
      const ds = S.stalker.crowd.nearest(cam.position);
      scene.danger = Math.max(scene.danger, THREE.MathUtils.clamp((6 - ds) / 5, 0, 1) * .85);
      if (ds < 6 && Math.floor(S.t * 1.4) !== Math.floor((S.t - dt) * 1.4)) ctx.audio.sfx('pasos', { cerca: ds < 3 });
    }
    scene.light(level, dt, flash);
    scene.overlay.u.uFlash.value = Math.max(0, 1 - flash.since(now) / .14) * .6;
    const danger = THREE.MathUtils.clamp((1.35 - d) / .9, 0, 1);
    scene.overlay.u.uDanger.value += (danger - scene.overlay.u.uDanger.value) * Math.min(1, dt * 8);
    if (d < CATCH_RADIUS && !S.decided) {
      fail(ctx, S.anomaly === 'acecho' ? 'Te alcanzó. Cuando algo viene hacia ti: date vuelta.' : 'Te atraparon. Cada flash los acerca.');
      return;
    }

    // la decisión
    if (S.decided) return;
    if (cam.position.z < -11.9) decide(ctx, false);
    else if (cam.position.z > 12.2 && S.t > 1.2) decide(ctx, true);
  },
  exit() {
    S?.scene.dispose();
    S = null;
  },
};

function decide(ctx, saidAnomaly) {
  const correct = saidAnomaly === Boolean(S.anomaly);
  if (!correct) {
    fail(ctx, S.anomaly ? `Había algo: ${NOMBRE[S.anomaly]}.` : 'No había nada raro.');
    return;
  }
  S.decided = true;
  ctx.audio.sfx('acierto');
  const progress = S.progress + 1;
  const solved = S.anomaly ? [...S.solved, S.anomaly] : S.solved;
  if (progress >= GOAL) {
    ctx.hud.subtitle('El vagón deja de repetirse. El Oficinista no volvió.', 3200);
    ctx.next();
    return;
  }
  const msg = S.anomaly ? `Bien visto: ${NOMBRE[S.anomaly]}.` : 'Todo estaba normal. Bien.';
  ctx.go('vagonOficinista', { progress, loop: S.loop + 1, solved, wrongStreak: 0, msg });
}

function fail(ctx, msg) {
  S.wrongT = 0;
  S.failMsg = `${msg} Vuelves a empezar.`;
  ctx.audio.sfx('error');
  ctx.audio.sfx('atrapado');
  S.scare.show(null, ctx.camera);
}

// Letrero LED sobre la puerta del fondo: cuántas estaciones faltan.
function ledSign(left) {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 16;
  const g = c.getContext('2d');
  g.fillStyle = '#0a0705';
  g.fillRect(0, 0, 64, 16);
  g.fillStyle = '#ff9a1f';
  g.font = 'bold 9px monospace';
  g.fillText(left > 0 ? `CASA  -${left}` : 'CASA', 6, 12);
  for (let y = 0; y < 16; y += 2) {
    g.fillStyle = 'rgba(0,0,0,.35)';
    g.fillRect(0, y, 64, 1);
  }
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(.9, .22), basic({ map: pixelTexture(c) }));
  sign.position.set(0, 2.62, -12.85);
  return sign;
}

function applyAnomaly(ctx, S) {
  const { scene } = S;
  const P = scene.vagon.parts;
  const stage = ctx.stage;
  switch (S.anomaly) {
    case 'aviso': {
      const m = lambert({ map: textura('avisoMal') });
      P.ads.forEach((ad) => { ad.material = m; });
      break;
    }
    case 'avisoGrande': {
      const ad = P.ads[1 + Math.floor(Math.random() * (P.ads.length - 2))];
      ad.scale.set(1, 1.5, 1.5);
      break;
    }
    case 'mapa': {
      const m = lambert({ map: textura('mapaTachado') });
      P.maps.forEach((map) => { map.material = m; });
      break;
    }
    case 'luces': {
      P.mats.tubo.color.setHex(0xff5040);
      P.mats.emergencia.color.setHex(0xff1010);
      break;
    }
    case 'manillas': {
      const o = new THREE.Object3D();
      P.straps.list.forEach(([x, z], i) => {
        o.position.set(x, 2.2, z);
        o.rotation.set(0, Math.PI / 2, .55);
        o.updateMatrix();
        P.straps.strapMesh.setMatrixAt(i, o.matrix);
        P.straps.ringMesh.setMatrixAt(i, o.matrix);
      });
      P.straps.strapMesh.instanceMatrix.needsUpdate = P.straps.ringMesh.instanceMatrix.needsUpdate = true;
      break;
    }
    case 'maletin': {
      const m = createObjeto('maletin');
      m.position.set(-2.1, .52, 1.6);
      m.rotation.y = .3;
      stage.add(m);
      break;
    }
    case 'espaldas': {
      const look = PASAJEROS.find((p) => p.name === 'Oficinista').look;
      const fig = createFigura(look);
      fig.root.position.set(.75, 0, -10.6);
      fig.root.rotation.y = Math.PI; // de espaldas
      fig.head.rotation.x = .35; // cabeza gacha
      stage.add(fig.root);
      S.blockers = [{ x: .75, z: -10.6, r: .25 }];
      break;
    }
    case 'puerta': {
      for (const leaf of P.leaves) {
        if (leaf.dz === 0 && leaf.s === 1) leaf.mesh.position.z += leaf.k * .62;
      }
      // alguien parado afuera, en el túnel, mirando hacia adentro
      const fig = new THREE.Mesh(borradoGeometry(), basic({ color: 0x050505 }));
      fig.position.set(3.1, -.15, .1);
      fig.rotation.y = -Math.PI / 2;
      stage.add(fig);
      break;
    }
    case 'caras': {
      const faces = createBorrados({ seed: 5, zFrom: 20, zTo: 21, ladoTries: 0, reserve: 0, count: 70 });
      faces.face(ctx.camera.position);
      stage.add(faces.mesh);
      S.extraCrowds.push(faces);
      break;
    }
    case 'tiza': {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1.4, .7), basic({ map: garabato('DATE\nVUELTA'), transparent: true, opacity: 0, depthWrite: false }));
      m.position.set(0, .012, 2.4);
      m.rotation.set(-Math.PI / 2, 0, Math.PI);
      stage.add(m);
      S.flashOnly.push(m);
      break;
    }
    case 'acecho': {
      const stalker = createBorrados({ seed: 9, zFrom: 20, zTo: 21, ladoTries: 0, reserve: 1, fillOutside: false });
      stalker.convert(0, -11.6);
      stalker.face(ctx.camera.position);
      stage.add(stalker.mesh);
      S.extraCrowds.push(stalker);
      S.stalker = { crowd: stalker, p: stalker.people[0] };
      break;
    }
    default:
      break;
  }
}
