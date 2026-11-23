// 1 · Pantalla de inicio. Dueño: Valentín (menú: Andy, en src/menu/).
// De fondo va el vagón de verdad, a oscuras: cada tanto un flash solo, y los
// borrados están un paso más cerca. Encima, el menú (letrero LED del tren).
// El primer gesto del jugador desbloquea el audio; "Comenzar" captura el mouse
// (los dos son requisitos del navegador) y pasa a hora punta.
import { abrirMenu } from '../menu/menu.js';
import { createBorrados } from '../mechanics/borrados.js';
import { createFlash } from '../mechanics/flash.js';
import { setupVagon } from '../world/vagonEscena.js';

const PRIMER_FLASH = 3.5; // s
const ENTRE_FLASHES = [6, 9]; // s, al azar: muy por debajo del límite de destellos
const FLASHES_POR_VUELTA = 7; // después la multitud vuelve al fondo

let S = null;

export default {
  id: 'inicio',
  next: 'horaPunta',
  enter(ctx) {
    const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const scene = setupVagon(ctx, { z: 11, ambient: .06, tubeFlicker: true });
    const armar = () => {
      const crowd = createBorrados({ colliders: scene.colliders, seed: 23, zFrom: 6.5 });
      ctx.stage.add(crowd.mesh);
      crowd.face(ctx.camera.position);
      return crowd;
    };
    S = { scene, crowd: armar(), t: 0, sig: quieto ? Infinity : PRIMER_FLASH, n: 0 };
    S.flash = createFlash({
      onFire: () => {
        S.n += 1;
        if (S.n > FLASHES_POR_VUELTA) {
          S.n = 1;
          ctx.stage.remove(S.crowd.mesh);
          S.crowd.mesh.geometry.dispose();
          S.crowd = armar();
        }
        S.crowd.step(ctx.camera.position, .55, 30);
        if (S.menu?.fase !== 'umbral') ctx.audio.sfx('flash', { volume: .3, cerca: Math.min(1, S.n / FLASHES_POR_VUELTA) });
      },
    });
    S.menu = abrirMenu(ctx, {
      alSalir: () => { S.sig = Infinity; S.flash.fire(); }, // un último flash antes de partir
      alComenzar: () => ctx.next(),
    });
  },
  update(dt, ctx) {
    if (!S) return;
    S.t += dt;
    if (S.t >= S.sig) {
      S.flash.fire();
      S.sig = S.t + ENTRE_FLASHES[0] + Math.random() * (ENTRE_FLASHES[1] - ENTRE_FLASHES[0]);
    }
    const fijo = ctx.demo && window.__fdsHold; // depurar: flash fijo (solo ?demo=1)
    const nivel = fijo ? 1 : S.flash.level(performance.now());
    S.crowd.mesh.visible = nivel > .02;
    // la cámara respira: mira apenas de un lado a otro
    ctx.camera.rotation.y = Math.sin(S.t * .17) * .07;
    ctx.camera.rotation.x = Math.sin(S.t * .11) * .015;
    S.scene.light(nivel, dt, S.flash);
  },
  exit() {
    S?.menu.cerrar();
    S?.scene.dispose();
    S = null;
  },
};
