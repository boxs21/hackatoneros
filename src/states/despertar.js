// 9 · Despertar: después del derrumbe apareces en tu pieza, acostado. Final abierto.
// (Andy) Viene del Vagón del Vendedor: el blanco del destello se va de a poco.
//
// Estás en tu cama mirando el techo. Son las 18:04: no pasó ni un minuto. El celular
// vibra con fotos que no recuerdas. En el velador hay un llavero con luz que no es
// tuyo. Se oye el altavoz del metro… y por un parpadeo de la lámpara, hay alguien a
// los pies de la cama. Negro. FIN DE SERVICIO.
import * as THREE from 'three';
import { borradoGeometry } from '../world/figura.js';
import { basic, lambert, pixelTexture } from '../world/ps1.js';
import { soltarDestello } from '../world/colapso.js';

const MIRA = { yaw: 0, pitch: .62 }; // acostado: el techo, el muro de los pies y tu cuerpo bajo la frazada
const VELADOR = { yaw: -1.2, pitch: -.2 };
const PIES = { yaw: 0, pitch: .12 };

function pantalla(lineas, fondo = '#0b0f14') {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = fondo;
  g.fillRect(0, 0, 32, 64);
  g.fillStyle = '#eef1f6';
  g.font = 'bold 9px monospace';
  g.textAlign = 'center';
  lineas.forEach(([texto, y, color]) => { g.fillStyle = color || '#eef1f6'; g.fillText(texto, 16, y); });
  return pixelTexture(c);
}

let S = null;

export default {
  id: 'despertar',
  next: 'inicio',
  autoAdvance: false,
  enter(ctx) {
    const { camera, stage } = ctx;
    camera.rotation.order = 'YXZ';
    camera.position.set(0, .72, .95);
    camera.rotation.set(MIRA.pitch, 0, 0);
    ctx.scene.fog = new THREE.Fog(0x05070c, 3, 9);
    soltarDestello(4200); // el blanco del destello se va de a poco

    const caja = (w, h, d, mat, x, y, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      stage.add(m);
      return m;
    };
    const muro = lambert({ color: 0x8f8a7c });
    const madera = lambert({ color: 0x4a3524 });
    // pieza: 3,6 x 3,4 m, techo a 2,4
    caja(3.6, .1, 3.4, lambert({ color: 0x3b3128 }), 0, -.05, -.3); // piso
    caja(3.6, .1, 3.4, lambert({ color: 0xb9b5a6 }), 0, 2.45, -.3); // techo
    caja(.1, 2.5, 3.4, muro, -1.8, 1.2, -.3);
    caja(.1, 2.5, 3.4, muro, 1.8, 1.2, -.3);
    caja(3.6, 2.5, .1, muro, 0, 1.2, 1.4); // cabecera
    // muro de los pies, con la puerta entreabierta (hueco negro)
    caja(1.5, 2.5, .1, muro, -1.05, 1.2, -2);
    caja(1.2, 2.5, .1, muro, 1.2, 1.2, -2);
    caja(.9, .45, .1, muro, .15, 2.22, -2);
    caja(.9, 2.0, .04, basic({ color: 0x000000 }), .15, 1.0, -2.02);
    const puerta = caja(.06, 2.0, .8, madera, -.3, 1.0, -1.62); // abierta hacia adentro
    puerta.rotation.y = .25;
    // cama: base, colchón, almohada y tu cuerpo bajo la frazada
    caja(1.2, .3, 2.1, madera, 0, .15, .3);
    caja(1.1, .16, 2.0, lambert({ color: 0xc9c5b8 }), 0, .38, .3);
    caja(.7, .1, .4, lambert({ color: 0xe6e2d6 }), 0, .5, 1.1);
    const frazada = caja(1.0, .2, 1.45, lambert({ color: 0x2b3a5e }), 0, .5, -.05);
    caja(.3, .12, .2, lambert({ color: 0x2b3a5e }), 0, .62, -.72); // los pies
    // ventana a la izquierda: persiana con luz de la calle
    for (let i = 0; i < 9; i++) caja(.02, .05, 1.0, basic({ color: i % 2 ? 0x6f7fa8 : 0x1a2233 }), -1.74, 1.05 + i * .1, -.4);
    const calle = new THREE.PointLight(0x7f95d8, 1.6, 5, 1.2);
    calle.position.set(-1.4, 1.5, -.4);
    // velador a la derecha (del que está acostado mirando a los pies: +x)
    caja(.45, .5, .4, madera, .95, .25, .6);
    const celular = caja(.075, .012, .15, lambert({ color: 0x2a2d33 }), .88, .507, .55);
    const vidrio = new THREE.Mesh(new THREE.PlaneGeometry(.065, .13), basic({ map: pantalla([['18:04', 22]]), color: 0x000000 }));
    vidrio.rotation.x = -Math.PI / 2;
    vidrio.position.set(.88, .515, .55);
    const brilloCel = new THREE.PointLight(0xbfd0ff, 0, 1.6, 1.5);
    brilloCel.position.set(.88, .7, .55);
    // el llavero del Escolar
    const llavero = caja(.03, .02, .06, lambert({ color: 0x2e5aa8, emissive: 0x000000 }), 1.05, .51, .68);
    const luzLlavero = new THREE.PointLight(0x9fe0ff, 0, 1.4, 1.5);
    luzLlavero.position.set(1.05, .6, .68);
    // lámpara del techo, apagada
    const foco = caja(.3, .06, .3, lambert({ color: 0x55524a, emissive: 0x000000 }), 0, 2.37, -.3);
    const luzFoco = new THREE.PointLight(0xfff0d0, 0, 6, 1);
    luzFoco.position.set(0, 2.2, -.3);
    // alguien a los pies de la cama (solo se ve en el parpadeo)
    const alguien = new THREE.Mesh(borradoGeometry(), lambert({ color: 0x8a8b90, emissive: 0x0a0a0c }));
    alguien.position.set(.1, 0, -1.25);
    alguien.scale.setScalar(1.12);
    alguien.visible = false;
    const ambiente = new THREE.HemisphereLight(0x3d4a6b, 0x0c0a08, .5);
    stage.add(vidrio, calle, brilloCel, luzLlavero, luzFoco, alguien, ambiente);

    S = {
      t: 0, paso: 0, yaw: 0, pitch: MIRA.pitch, quieto: 0, destino: MIRA,
      vidrio, brilloCel, llavero, luzLlavero, foco, luzFoco, alguien, frazada,
      fin: false, volver: Infinity,
    };
  },
  update(dt, ctx) {
    if (!S) return;
    S.t += dt;
    const t = S.t;
    const cam = ctx.camera;
    const una = (n) => { if (S.paso >= n) return false; S.paso = n; return true; };

    if (t > 1.6 && una(1)) ctx.audio.ambiente('casa', { volume: .5, fade: 3 });
    if (t > 3.4 && una(2)) ctx.hud.subtitle('Tu pieza. Tu cama.', 3000);
    if (t > 7.2 && una(3)) ctx.hud.subtitle('18:04. No pasó ni un minuto.', 3200);
    if (t > 11.2 && una(4)) {
      ctx.audio.sfx('celular');
      S.vidrio.material.color.setHex(0xffffff);
      S.brilloCel.intensity = .9;
      S.destino = VELADOR;
      ctx.hud.subtitle('El celular vibra en el velador: fotos nuevas. No recuerdas haberlas sacado.', 3800);
    }
    if (t > 15.6 && una(5)) {
      S.llavero.material.emissive.setHex(0x9fe0ff);
      ctx.audio.sfx('notificacion', { volume: .4 });
      ctx.hud.subtitle('Al lado hay un llavero con luz. No es tuyo.', 3600);
    }
    if (t > 15.6) S.luzLlavero.intensity = Math.min(.8, (t - 15.6) * .5) * (.85 + Math.sin(t * 9) * .15);
    if (t > 20 && una(6)) {
      S.destino = PIES;
      ctx.hud.subtitle('ALTAVOZ: Próxima estación…', 3000); // la campanilla la pone el motor de audio
    }
    // la lámpara parpadea sola: hay alguien a los pies de la cama
    if (t > 22.6 && t < 23.25) {
      const on = Math.sin((t - 22.6) * 60) > -.2;
      S.luzFoco.intensity = on ? 2.4 : 0;
      S.foco.material.emissive.setHex(on ? 0xfff0d0 : 0x000000);
      S.alguien.visible = true;
      if (una(7)) ctx.audio.sfx('susto', { volume: .55 });
    }
    if (t >= 23.25 && !S.fin) {
      S.fin = true;
      S.volver = t + 16;
      ctx.audio.silencio();
      ctx.fader.cut();
      ctx.hud.title('FIN DE SERVICIO', '¿Llegaste a Casa? · Gracias por jugar · Hecho con Codex · [Enter] volver al menú');
    }
    if (S.fin) {
      if (ctx.input.pressed('Enter') || t >= S.volver) { S.volver = Infinity; ctx.go('inicio'); }
      return;
    }

    // mirar: el mouse manda, con tope (estás acostado). Si lo sueltas, la vista va sola a lo que importa.
    const mx = ctx.input.mouse.dx;
    const my = ctx.input.mouse.dy;
    if (Math.abs(mx) + Math.abs(my) > .5) {
      S.quieto = 0;
      S.yaw = THREE.MathUtils.clamp(S.yaw - mx * .0018, -1.35, 1.35);
      S.pitch = THREE.MathUtils.clamp(S.pitch - my * .0018, -.4, 1.4);
    } else {
      S.quieto += dt;
      if (S.quieto > .7) {
        const k = Math.min(1, dt * 1.1);
        S.yaw += (S.destino.yaw - S.yaw) * k;
        S.pitch += (S.destino.pitch - S.pitch) * k;
      }
    }
    // respiras: la vista sube y baja apenas, y la frazada con ella
    const aire = Math.sin(t * 1.5);
    cam.rotation.set(S.pitch + aire * .008, S.yaw, 0);
    cam.position.y = .72 + aire * .006;
    S.frazada.scale.y = 1 + aire * .03;
  },
  exit(ctx) {
    ctx.audio.ambiente(null, { fade: .6 });
    ctx.hud.title('');
    ctx.fader.clear(0);
    soltarDestello(0);
    S = null;
  },
};
