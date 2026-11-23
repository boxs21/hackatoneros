// 8 · Final: estación Casa. Dueño: Valentín (v7).
//
// Se abren las puertas en Casa. Andén vacío, luz cálida y la música de Andy.
// En la banca están las cosas de los cuatro. Según lo que respondiste en hora
// punta (ctx.memoria), alguno se despide desde lejos. El celular se apaga:
// FIN DE SERVICIO. Enter (o 25 s) vuelve al menú.
import * as THREE from 'three';
import { createObjeto } from '../world/figura.js';
import { basic, lambert, pixelTexture } from '../world/ps1.js';

const DESPEDIDAS = {
  Escolar: ['ESCOLAR (lejos): ¡Llegamos! Conté todas.', null],
  Señora: ['SEÑORA (lejos): Gracias por el carro, mijo…', null],
  Oficinista: ['OFICINISTA (lejos): Dígale a mi jefe que llegué.', null],
  Vendedor: [null, 'VENDEDOR (lejos): Después no diga que no le ofrecí…'],
};

function letrero(texto, sub) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 48;
  const g = c.getContext('2d');
  g.fillStyle = '#0d2c5c';
  g.fillRect(0, 0, 128, 48);
  g.fillStyle = '#ffffff';
  g.font = 'bold 18px monospace';
  g.textAlign = 'center';
  g.fillText(texto, 64, 21);
  g.font = 'bold 12px monospace';
  g.fillStyle = '#f2b705';
  g.fillText(sub, 64, 40);
  return pixelTexture(c);
}

let S = null;

export default {
  id: 'final',
  next: 'inicio',
  autoAdvance: false,
  enter(ctx) {
    const { camera, stage } = ctx;
    camera.rotation.order = 'YXZ';
    camera.position.set(0, 1.55, 4.2);
    camera.rotation.set(-.05, 0, 0);
    ctx.scene.fog = new THREE.Fog(0x120d08, 4, 16);
    ctx.audio.ambiente(null);
    ctx.audio.musica('casa', { fade: 2 });

    // andén: piso, muro del fondo, línea amarilla y la banca
    const piso = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), lambert({ color: 0x5b554c }));
    piso.rotation.x = -Math.PI / 2;
    const muro = new THREE.Mesh(new THREE.PlaneGeometry(14, 5), lambert({ color: 0xcdbf9f }));
    muro.position.set(0, 2.5, -2.2);
    const borde = new THREE.Mesh(new THREE.PlaneGeometry(14, .25), lambert({ color: 0xe1b12c }));
    borde.rotation.x = -Math.PI / 2;
    borde.position.set(0, .01, 3.2);
    const cartel = new THREE.Mesh(new THREE.PlaneGeometry(2.4, .9), basic({ map: letrero('CASA', 'LÍNEA 23') }));
    cartel.position.set(0, 2.6, -2.15);
    const banca = new THREE.Group();
    const asiento = new THREE.Mesh(new THREE.BoxGeometry(3.2, .1, .5), lambert({ color: 0x8a5a33 }));
    asiento.position.y = .48;
    banca.add(asiento);
    for (const x of [-1.4, 1.4]) {
      const pata = new THREE.Mesh(new THREE.BoxGeometry(.08, .48, .45), lambert({ color: 0x333333 }));
      pata.position.set(x, .24, 0);
      banca.add(pata);
    }
    banca.position.set(0, 0, -1.2);
    // las cosas de los cuatro, en la banca y a sus pies
    const cosas = [['mochila', -1.1, .53, 0, 0], ['maletin', -.35, .53, 0, 0], ['chocolates', .45, .54, 0, .3], ['carro', 1.35, 0, .45, 0]];
    for (const [tipo, x, y, z, ry] of cosas) {
      const o = createObjeto(tipo);
      o.position.set(x, y, z - 1.2);
      o.rotation.y = ry;
      stage.add(o);
    }
    const calida = new THREE.PointLight(0xffc98a, 3.2, 9, 1.4);
    calida.position.set(0, 3, .5);
    const ambiente = new THREE.HemisphereLight(0xffe2b8, 0x221a12, .55);
    stage.add(piso, muro, borde, cartel, banca, calida, ambiente);

    // líneas: llegada, objetos, despedidas según lo que elegiste, y el celular que se apaga
    const lineas = [
      [1.2, 'Estación Casa. Las puertas se abren.'],
      [4.6, 'Nadie más se baja.'],
      [8.0, 'En la banca: la mochila, el maletín, la caja de chocolates. El carro de la feria.'],
    ];
    let t = 12;
    for (const [quien, [si, no]] of Object.entries(DESPEDIDAS)) {
      const eligio = ctx.memoria?.[quien];
      const linea = eligio === 0 ? si : eligio === 1 ? no : null;
      if (linea) { lineas.push([t, linea]); t += 3.4; }
    }
    lineas.push([t + .6, 'Tu celular vibra una vez. 1% de batería.']);
    S = { t: 0, lineas, apagar: t + 4.4, fin: false, volver: t + 4.4 + 14, calida };
  },
  update(dt, ctx) {
    if (!S) return;
    S.t += dt;
    const cam = ctx.camera;
    // la cámara avanza muy lento hacia la banca
    cam.position.z = Math.max(1.6, cam.position.z - dt * .08);
    while (S.lineas.length && S.t >= S.lineas[0][0]) ctx.hud.subtitle(S.lineas.shift()[1], 3200);

    if (!S.fin && S.t >= S.apagar) {
      S.fin = true;
      ctx.audio.sfx('celular');
      ctx.fader.cut(); // el celular se apaga: negro seco
      ctx.hud.title('FIN DE SERVICIO', 'Gracias por jugar · Hecho con Codex · [Enter] volver al menú');
    }
    if (S.fin && (ctx.input.pressed('Enter') || S.t >= S.volver)) {
      S.volver = Infinity;
      ctx.go('inicio');
    }
  },
  exit(ctx) {
    ctx.audio.musica(null, { fade: 1 });
    ctx.hud.title('');
    ctx.fader.clear(0);
    S = null;
  },
};
