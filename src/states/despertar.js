// 9 · Despertar: después del derrumbe apareces en tu pieza, acostado. Final abierto.
// (Andy) Viene del Vagón del Vendedor: el blanco del destello se va de a poco.
//
// Estás en tu cama mirando el techo. Son las 18:04: no pasó ni un minuto. El celular
// vibra con fotos que no recuerdas. Sobre el plumón está el calcetín con rombos que
// te dio el Escolar. Se oye el altavoz del metro… y por un parpadeo de la lámpara,
// hay alguien a los pies de la cama. Negro. FIN DE SERVICIO.
import * as THREE from 'three';
import { borradoGeometry } from '../world/figura.js';
import { basic, lambert, pixelTexture, seeded } from '../world/ps1.js';
import { soltarDestello } from '../world/colapso.js';

const MIRA = { yaw: 0, pitch: .62 }; // acostado: el techo, el muro de los pies y tu cuerpo bajo el plumón
const VELADOR = { yaw: -1.2, pitch: -.2 };
const CALCETIN = { yaw: -.3, pitch: -.16 };
const PIES = { yaw: 0, pitch: .12 };

function lienzo(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h, seeded(w * 31 + h));
  return c;
}
const tex = (w, h, draw, rx = 1, ry = 1) => pixelTexture(lienzo(w, h, draw), rx, ry);

const grano = (g, w, h, rnd, a = .1) => {
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = rnd();
    g.fillStyle = v > .5 ? `rgba(255,255,255,${(v - .5) * a})` : `rgba(0,0,0,${(.5 - v) * a * 1.5})`;
    g.fillRect(x, y, 1, 1);
  }
};

// piso de tablas
const TABLAS = (g, w, h, rnd) => {
  for (let x = 0; x < w; x += 8) {
    g.fillStyle = ['#5a3f2a', '#4d3523', '#634630', '#56391f'][Math.floor(rnd() * 4)];
    g.fillRect(x, 0, 8, h);
    g.fillStyle = '#2e1f14';
    g.fillRect(x, 0, 1, h);
    g.fillRect(x, Math.floor(rnd() * h), 8, 1); // junta
  }
  grano(g, w, h, rnd, .12);
};
// muro pintado
const MURO = (g, w, h, rnd) => {
  g.fillStyle = '#9c9686';
  g.fillRect(0, 0, w, h);
  grano(g, w, h, rnd, .09);
};
// plumón a rayas
const PLUMON = (g, w, h, rnd) => {
  g.fillStyle = '#2d3c63';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#3a4c7c';
  for (let y = 0; y < h; y += 8) g.fillRect(0, y, w, 3);
  g.fillStyle = '#22304f';
  for (let y = 5; y < h; y += 8) g.fillRect(0, y, w, 1);
  grano(g, w, h, rnd, .1);
};
// calcetín con rombos del Escolar (el mismo dibujo que el del regalo: rojo, rombos amarillos y azules)
const ROMBOS = (g) => {
  g.fillStyle = '#c8322b';
  g.fillRect(0, 0, 32, 32);
  const colores = ['#f2c230', '#2f6fd6'];
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
    g.fillStyle = colores[(i + j) % 2];
    const cx = i * 8 + 4;
    const cy = j * 8 + 4;
    g.beginPath();
    g.moveTo(cx, cy - 4); g.lineTo(cx + 3, cy); g.lineTo(cx, cy + 4); g.lineTo(cx - 3, cy);
    g.closePath();
    g.fill();
  }
};
// reloj de pared: 18:04
const RELOJ = (g, w, h) => {
  g.fillStyle = '#e9e5d8';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#1b1b1d';
  g.fillRect(0, 0, w, 1); g.fillRect(0, h - 1, w, 1); g.fillRect(0, 0, 1, h); g.fillRect(w - 1, 0, 1, h);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    g.fillRect(Math.round(w / 2 + Math.sin(a) * 12 - .5), Math.round(h / 2 - Math.cos(a) * 12 - .5), 1, 1);
  }
  const aguja = (ang, largo, ancho) => {
    g.strokeStyle = '#1b1b1d';
    g.lineWidth = ancho;
    g.beginPath();
    g.moveTo(w / 2, h / 2);
    g.lineTo(w / 2 + Math.sin(ang) * largo, h / 2 - Math.cos(ang) * largo);
    g.stroke();
  };
  aguja((6 + 4 / 60) / 12 * Math.PI * 2, 7, 2); // las 6 y algo
  aguja(4 / 60 * Math.PI * 2, 11, 1); // y 4
};
// afiche: un cerro de noche (nada de marcas)
const AFICHE = (g, w, h, rnd) => {
  g.fillStyle = '#18233f';
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 26; i++) { g.fillStyle = '#c9d4f0'; g.fillRect(Math.floor(rnd() * w), Math.floor(rnd() * h * .5), 1, 1); }
  g.fillStyle = '#0b1020';
  g.beginPath();
  g.moveTo(0, h); g.lineTo(0, h * .7); g.lineTo(w * .3, h * .45); g.lineTo(w * .55, h * .68); g.lineTo(w * .8, h * .5); g.lineTo(w, h * .66); g.lineTo(w, h);
  g.fill();
  g.fillStyle = '#e8dca8';
  g.fillRect(w - 9, 5, 4, 4);
};
// pantalla del celular: la hora y el aviso de fotos
const PANTALLA = (g) => {
  g.fillStyle = '#0b0f14';
  g.fillRect(0, 0, 32, 64);
  g.font = 'bold 9px monospace';
  g.textAlign = 'center';
  g.fillStyle = '#eef1f6';
  g.fillText('18:04', 16, 22);
  g.fillStyle = '#22a95a';
  g.fillRect(4, 34, 24, 10);
  g.fillStyle = '#0b0f14';
  g.font = 'bold 7px monospace';
  g.fillText('FOTOS', 16, 42);
};

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

    const caja = (w, h, d, mat, x, y, z, ry = 0) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      m.rotation.y = ry;
      stage.add(m);
      return m;
    };
    const c = (color, extra) => lambert({ color, ...extra });
    const muro = lambert({ map: tex(32, 32, MURO, 3, 2) });
    const madera = c(0x4a3524);
    const maderaClara = c(0x7a5a3a);
    const blanco = c(0xd9d5c8);
    const metal = c(0x9a9da0);

    // ---- la pieza: 3,6 x 3,4 m, techo a 2,4
    caja(3.6, .1, 3.4, lambert({ map: tex(32, 32, TABLAS, 4, 3) }), 0, -.05, -.3); // piso de tablas
    caja(3.6, .1, 3.4, c(0xc4c0b2), 0, 2.45, -.3); // techo
    caja(.1, 2.5, 3.4, muro, -1.8, 1.2, -.3);
    caja(.1, 2.5, 3.4, muro, 1.8, 1.2, -.3);
    caja(3.6, 2.5, .1, muro, 0, 1.2, 1.4); // muro de la cabecera
    // guardapolvo y cornisa
    for (const [w, d, x, z] of [[.03, 3.4, -1.74, -.3], [.03, 3.4, 1.74, -.3], [3.6, .03, 0, 1.34], [3.6, .03, 0, -1.94]]) {
      caja(w, .1, d, blanco, x, .05, z);
      caja(w, .05, d, blanco, x, 2.375, z);
    }
    // alfombra al lado de la cama
    caja(.8, .012, 1.3, c(0x6b2f2a), .98, .006, -.4);
    caja(.7, .014, 1.2, c(0x8a4a3a), .98, .007, -.4);

    // ---- muro de los pies: puerta entreabierta al pasillo negro, con marco y manilla
    caja(1.5, 2.5, .1, muro, -1.05, 1.2, -2);
    caja(1.2, 2.5, .1, muro, 1.2, 1.2, -2);
    caja(.9, .45, .1, muro, .15, 2.22, -2);
    caja(.9, 2.0, .04, basic({ color: 0x000000 }), .15, 1.0, -2.02);
    caja(.07, 2.06, .14, blanco, -.33, 1.03, -1.97);
    caja(.07, 2.06, .14, blanco, .63, 1.03, -1.97);
    caja(1.03, .07, .14, blanco, .15, 2.06, -1.97);
    caja(.05, 2.0, .86, maderaClara, -.2, 1.0, -1.56, .3); // la puerta, abierta hacia adentro
    caja(.03, .03, .1, metal, -.1, 1.0, -1.22, .3);
    // reloj al lado de la puerta: 18:04
    const reloj = new THREE.Mesh(new THREE.PlaneGeometry(.3, .3), lambert({ map: tex(32, 32, RELOJ) }));
    reloj.position.set(1.15, 1.95, -1.945);
    // afiche
    const afiche = new THREE.Mesh(new THREE.PlaneGeometry(.6, .82), lambert({ map: tex(32, 44, AFICHE) }));
    afiche.position.set(-1.05, 1.5, -1.945);
    caja(.66, .88, .02, c(0x1b1b1d), -1.05, 1.5, -1.955);

    // ---- cama: cabecera, base, colchón, almohada y tu cuerpo bajo el plumón
    caja(1.3, 1.0, .08, madera, 0, .5, 1.32); // cabecera
    caja(1.24, .3, 2.1, madera, 0, .15, .3);
    for (const x of [-.58, .58]) caja(.08, .5, .08, madera, x, .25, -.72); // patas de los pies
    caja(1.14, .16, 2.0, c(0xcfcbbe), 0, .38, .3); // colchón
    caja(.74, .11, .42, c(0xe8e4d8), 0, .5, 1.08); // almohada
    const plumon = lambert({ map: tex(32, 32, PLUMON, 1, 2) });
    const frazada = caja(1.12, .2, 1.5, plumon, 0, .5, -.02);
    caja(1.12, .03, .16, c(0x8f8c84), 0, .605, .6); // la sábana doblada sobre el plumón (baja y opaca: está pegada a tu cara)
    caja(.2, .1, 1.0, plumon, -.14, .62, -.2); // tus piernas
    caja(.2, .1, 1.0, plumon, .14, .62, -.2);
    caja(.36, .13, .2, plumon, 0, .64, -.74); // los pies

    // ---- ventana a la izquierda: marco, persiana con la luz de la calle y cortinas
    caja(.04, 1.1, 1.2, c(0x0d1322), -1.76, 1.5, -.4); // la noche
    for (let i = 0; i < 10; i++) caja(.03, .045, 1.14, basic({ color: i % 2 ? 0x7f95d8 : 0x232c44 }), -1.73, 1.02 + i * .105, -.4);
    for (const [h, d, y, z] of [[.06, 1.3, 2.08, -.4], [.06, 1.3, .92, -.4], [1.2, .06, 1.5, -1.03], [1.2, .06, 1.5, .23]]) caja(.08, h, d, blanco, -1.74, y, z);
    caja(.06, 1.5, .26, c(0x39425c), -1.7, 1.42, -1.16); // cortinas
    caja(.06, 1.5, .26, c(0x39425c), -1.7, 1.42, .36);
    caja(.04, .04, 1.9, metal, -1.7, 2.2, -.4);
    // la luz de la persiana cae en franjas sobre el muro de enfrente
    for (let i = 0; i < 5; i++) caja(.012, .05, .95, basic({ color: 0x3a4878 }), 1.745, 1.08 + i * .2, -.55);
    const calle = new THREE.PointLight(0x7f95d8, 1.9, 5.5, 1.2);
    calle.position.set(-1.35, 1.55, -.4);

    // ---- velador a la derecha: lámpara, vaso, celular cargando
    caja(.46, .5, .42, madera, .97, .25, .6);
    caja(.42, .02, .38, maderaClara, .97, .51, .6);
    caja(.36, .12, .02, maderaClara, .97, .36, .39); // cajón
    caja(.06, .02, .02, metal, .97, .36, .375);
    caja(.1, .03, .1, metal, 1.08, .535, .72); // lámpara: base, pie y pantalla
    caja(.02, .2, .02, metal, 1.08, .64, .72);
    caja(.17, .15, .17, c(0xd8cfae), 1.08, .8, .72);
    caja(.06, .1, .06, c(0x9fb6c4), .84, .57, .74); // vaso de agua
    caja(.075, .012, .15, c(0x2a2d33), .9, .527, .52); // celular
    const vidrio = new THREE.Mesh(new THREE.PlaneGeometry(.065, .13), basic({ map: tex(32, 64, PANTALLA), color: 0x000000 }));
    vidrio.rotation.x = -Math.PI / 2;
    vidrio.position.set(.9, .535, .52);
    caja(.01, .01, .3, c(0xe6e2d6), .9, .525, .38); // cable del cargador
    const brilloCel = new THREE.PointLight(0xbfd0ff, 0, 1.6, 1.5);
    brilloCel.position.set(.9, .72, .52);

    // ---- el resto de tu vida: escritorio, silla con la chaqueta, el bolso de la pega, repisa, ropero
    caja(1.0, .04, .5, maderaClara, 1.25, .74, -1.55); // escritorio
    for (const [x, z] of [[.8, -1.34], [1.7, -1.34], [.8, -1.76], [1.7, -1.76]]) caja(.04, .74, .04, madera, x, .37, z);
    caja(.42, .28, .03, c(0x101216), 1.3, .92, -1.72); // pantalla apagada
    caja(.06, .08, .06, c(0x101216), 1.3, .78, -1.72);
    caja(.3, .015, .11, c(0x1b1d22), 1.25, .768, -1.48); // teclado
    caja(.08, .1, .08, c(0x9a2f2a), .9, .81, -1.66); // tazón
    caja(.4, .04, .4, madera, 1.05, .45, -1.05, .5); // silla
    caja(.4, .5, .04, madera, .96, .7, -.88, .5);
    caja(.44, .34, .08, c(0x30343c), .95, .72, -.86, .5); // tu chaqueta colgada
    caja(.4, .28, .16, c(0x3b2418), 1.5, .14, -.75, -.3); // el bolso de la pega, donde lo dejaste
    caja(.14, .03, .02, c(0x111111), 1.5, .295, -.75, -.3);
    caja(.26, .1, .11, c(0x1b1b1d), .6, .05, -1.2, .3); // zapatos
    caja(.26, .1, .11, c(0x1b1b1d), .74, .05, -1.32, .1);
    caja(.2, .03, .9, maderaClara, 1.68, 1.6, .5); // repisa con libros
    [0x9a2f2a, 0x2f5d8a, 0xd9b44a, 0x3d6b45, 0x6b4a7a, 0xc9c5b8].forEach((color, i) =>
      caja(.15, .2 + (i % 3) * .03, .09 + (i % 2) * .02, c(color), 1.68, 1.72 + (i % 3) * .015, .14 + i * .13));
    caja(.6, 2.0, 1.0, madera, -1.45, 1.0, .82); // ropero
    caja(.02, 1.9, .47, maderaClara, -1.14, 1.0, .57);
    caja(.02, 1.9, .47, maderaClara, -1.14, 1.0, 1.07);
    caja(.03, .1, .02, metal, -1.12, 1.0, .78);
    caja(.03, .1, .02, metal, -1.12, 1.0, .86);

    // ---- lámpara del techo, apagada: cordón y pantalla
    caja(.015, .22, .015, c(0x1b1b1d), 0, 2.29, -.3);
    const foco = caja(.34, .16, .34, c(0x6b665a, { emissive: 0x000000 }), 0, 2.12, -.3);
    const luzFoco = new THREE.PointLight(0xfff0d0, 0, 6, 1);
    luzFoco.position.set(0, 1.95, -.3);

    // ---- el calcetín con rombos del Escolar, sobre el plumón, al alcance de tu mano
    const calcetin = new THREE.Group();
    const tela = lambert({ map: tex(32, 32, ROMBOS), emissive: 0x000000 });
    const cana = new THREE.Mesh(new THREE.CylinderGeometry(.045, .05, .22, 8), tela);
    cana.rotation.z = Math.PI / 2;
    const pie = new THREE.Mesh(new THREE.BoxGeometry(.1, .06, .15), tela);
    pie.position.set(-.12, 0, .05);
    pie.rotation.y = .5;
    const elastico = new THREE.Mesh(new THREE.CylinderGeometry(.052, .052, .04, 8), c(0xf6f0dc));
    elastico.rotation.z = Math.PI / 2;
    elastico.position.x = .12;
    calcetin.add(cana, pie, elastico);
    for (const dz of [.02, .08]) { // los ojos, como el del regalo
      const ojo = new THREE.Mesh(new THREE.BoxGeometry(.025, .008, .025), c(0xffffff));
      ojo.position.set(-.14, .034, dz);
      const pupila = new THREE.Mesh(new THREE.BoxGeometry(.011, .009, .011), c(0x0b0b0b));
      pupila.position.set(-.14, .036, dz);
      calcetin.add(ojo, pupila);
    }
    calcetin.position.set(.24, .66, .28);
    calcetin.rotation.y = .5;
    const luzCalcetin = new THREE.PointLight(0xffd9a0, 0, 1.3, 1.4);
    luzCalcetin.position.set(.24, .9, .34);

    // ---- alguien a los pies de la cama (solo se ve en el parpadeo)
    const alguien = new THREE.Mesh(borradoGeometry(), lambert({ color: 0x8a8b90, emissive: 0x0a0a0c }));
    alguien.position.set(.1, 0, -1.25);
    alguien.scale.setScalar(1.12);
    alguien.visible = false;
    const ambiente = new THREE.HemisphereLight(0x3d4a6b, 0x0c0a08, .5);
    stage.add(reloj, afiche, vidrio, calle, brilloCel, calcetin, luzCalcetin, luzFoco, alguien, ambiente);

    S = {
      t: 0, paso: 0, yaw: 0, pitch: MIRA.pitch, quieto: 0, destino: MIRA,
      vidrio, brilloCel, tela, luzCalcetin, foco, luzFoco, alguien, frazada,
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
      S.destino = CALCETIN;
      ctx.audio.sfx('notificacion', { volume: .4 });
      ctx.hud.subtitle('Sobre el plumón, un calcetín con rombos. El de la suerte. El que te dio el niño.', 4000);
    }
    if (t > 15.6) {
      const k = Math.min(1, (t - 15.6) * .5);
      S.luzCalcetin.intensity = k * .9;
      S.tela.emissive.setScalar(k * .12);
    }
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
      ctx.hud.title('ANDÉN CERO', 'Fin de servicio · ¿Llegaste a Casa? · Gracias por jugar · Hecho con Codex · [Enter] volver al menú');
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
    // respiras: la vista sube y baja apenas, y el plumón con ella
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
