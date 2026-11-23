// Ingrediente obligatorio: un guiño a 31 Minutos, reinterpretado a nuestra manera.
// Un calcetín con rombos olvidado en un asiento del metro. Si te acercas y apretas E,
// "habla" (con murmullo de títere) como cierto defensor de los derechos de los niños.
// Hecho por nosotros con geometría y una textura de rombos; sin arte oficial.
import * as THREE from 'three';
import { lambert, pixelTexture } from './ps1.js';

const LINEAS = [
  'CALCETÍN: ¡Calcetín con rombos maaan!… Ejem. Perdón. Soy un calcetín cualquiera.',
  'CALCETÍN: Pero escuche: todos los pasajeros tienen derecho a llegar a su casa.',
  'CALCETÍN: Y a usar el flash. Con cuidado, eso sí.',
];

function rombos() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  g.fillStyle = '#c8322b';
  g.fillRect(0, 0, 32, 32);
  const colores = ['#f2c230', '#2f6fd6'];
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      g.fillStyle = colores[(x + y) % 2];
      const cx = x * 8 + 4;
      const cy = y * 8 + 4;
      g.beginPath();
      g.moveTo(cx, cy - 4); g.lineTo(cx + 3, cy); g.lineTo(cx, cy + 4); g.lineTo(cx - 3, cy);
      g.closePath();
      g.fill();
    }
  }
  return pixelTexture(c);
}

export function crearCalcetin(ctx, { x, z, y = .52 }) {
  const grupo = new THREE.Group();
  const tela = lambert({ map: rombos() });
  // caña del calcetín, parada como títere, y la "boca" (el pie doblado)
  const cana = new THREE.Mesh(new THREE.CylinderGeometry(.06, .07, .3, 6), tela);
  cana.position.y = .15;
  const boca = new THREE.Mesh(new THREE.BoxGeometry(.13, .07, .17), tela);
  boca.position.set(0, .32, .04);
  const ojoMat = lambert({ color: 0xffffff });
  for (const ox of [-.03, .03]) {
    const ojo = new THREE.Mesh(new THREE.BoxGeometry(.025, .025, .01), ojoMat);
    ojo.position.set(ox, .37, .11);
    grupo.add(ojo);
  }
  grupo.add(cana, boca);
  grupo.position.set(x, y, z);
  grupo.rotation.y = -Math.PI / 2; // mira al pasillo
  ctx.stage.add(grupo);

  let aviso = false;
  let hablando = -1;
  let proxima = 0;
  let t = 0;
  return {
    grupo,
    update(dt, c) {
      t += dt;
      const cam = c.camera;
      const cerca = Math.hypot(cam.position.x - x, cam.position.z - z) < 1.6;
      if (cerca && !aviso && hablando < 0) {
        aviso = true;
        c.hud.subtitle('Hay un calcetín con rombos en el asiento. Parece que te mira. [E]', 2800);
      }
      if (cerca && hablando < 0 && c.input.pressed('KeyE')) {
        hablando = 0;
        proxima = t;
        c.memoria.calcetin = true;
        c.progress?.();
      }
      if (hablando >= 0 && hablando < LINEAS.length && t >= proxima) {
        c.hud.subtitle(LINEAS[hablando], 3000);
        hablando += 1;
        proxima = t + 3.1;
      }
      // abre y cierra la boca mientras habla
      const habla = hablando >= 0 && t < proxima;
      boca.rotation.x = habla ? -Math.abs(Math.sin(t * 14)) * .5 : 0;
      grupo.rotation.z = habla ? Math.sin(t * 7) * .06 : 0;
    },
  };
}
