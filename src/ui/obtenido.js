import './obtenido.css';
import { createObjeto3d, tipoDe } from './objeto3d.js';

// OBJETO OBTENIDO. Dueño: Renato.
// Cada vez que te dan algo (ctx.hud.obtenido(nombre, uso)) sale al centro de la
// pantalla: destello, rayos girando detrás, el objeto en 3D (ui/objeto3d.js)
// que entra girando y flota, «¡OBTUVISTE!», el nombre y para qué sirve. Se va solo.

// Sprites de 16x16 dibujados a mano. '.' = transparente.
const SPRITES = {
  completo: {
    pal: { w: '#f6f0dc', g: '#79b85a', G: '#4e8a3a', r: '#e4322b', R: '#a91f1a', s: '#b5532e', k: '#7a321b', b: '#e8b062', B: '#c98a3c', d: '#7a4f26' },
    px: [
      '................',
      '................',
      '................',
      '................',
      '....w..w..w..w..',
      '..wwwwwwwwwwwww.',
      '.gGgGgGgGgGgGgG.',
      '.rRrrRrrRrrRrrR.',
      'kssssssssssssssk',
      '.bbbbbbbbbbbbbb.',
      'bBbbbbbbbbbbbbBb',
      'bBBBBBBBBBBBBBBb',
      '.bBBBBBBBBBBBBb.',
      '..dddddddddddd..',
      '................',
      '................',
    ],
  },
  celular: {
    pal: { k: '#0b0c0f', c: '#2a2d33', s: '#1b2a3a', S: '#2f4a66', y: '#f2b705', w: '#eef1f6' },
    px: [
      '................',
      '....kkkkkkkkk...',
      '....kccccccck...',
      '....kcsssssck...',
      '....kcsSSssck...',
      '....kcsSsssck...',
      '....kcsssssck...',
      '....kcsyyysck...',
      '....kcsysssck...',
      '....kcsyyssck...',
      '....kcsysssck...',
      '....kcsssssck...',
      '....kccccccck...',
      '....kccwwccck...',
      '....kkkkkkkkk...',
      '................',
    ],
  },
  llavero: {
    pal: { m: '#c9ccd3', M: '#7d828c', b: '#2f7fe0', B: '#1d5aa6', y: '#fff3a8', Y: '#f2b705' },
    px: [
      '................',
      '...mmmm.........',
      '..m....m........',
      '..m....m........',
      '..m....m........',
      '...mmmm.........',
      '.....M..........',
      '.....MM.........',
      '......bbbbbb....',
      '......bBBBBByy..',
      '......bBBBBByYy.',
      '......bBBBBByy..',
      '......bbbbbb....',
      '................',
      '................',
      '................',
    ],
  },
  chocolate: {
    pal: { r: '#e4322b', R: '#a91f1a', y: '#f2b705', c: '#6b3a1f', C: '#4a2612', f: '#d9dde4' },
    px: [
      '................',
      '................',
      '................',
      '..ffcccccccccc..',
      '..fcCcCcCcCcCc..',
      '..ffcccccccccc..',
      '..rrrrrrrrrrrr..',
      '..rRRRRRRRRRRr..',
      '..rRyyyyyyyyRr..',
      '..rRyrrrrrryRr..',
      '..rRyyyyyyyyRr..',
      '..rRRRRRRRRRRr..',
      '..rrrrrrrrrrrr..',
      '................',
      '................',
      '................',
    ],
  },
  otro: {
    pal: { y: '#f2b705', Y: '#b98a00', k: '#0b0f14' },
    px: [
      '................',
      '................',
      '...yyyyyyyyyy...',
      '...yYYYYYYYYy...',
      '...yYYkkkkYYy...',
      '...yYkYYYYkYy...',
      '...yYYYYYkYYy...',
      '...yYYYYkYYYy...',
      '...yYYYkYYYYy...',
      '...yYYYYYYYYy...',
      '...yYYYkYYYYy...',
      '...yYYYYYYYYy...',
      '...yyyyyyyyyy...',
      '................',
      '................',
      '................',
    ],
  },
};

function spriteFor(nombre) {
  const n = String(nombre).toLowerCase();
  if (n.includes('completo')) return SPRITES.completo;
  if (n.includes('celular')) return SPRITES.celular;
  if (n.includes('llavero')) return SPRITES.llavero;
  if (n.includes('chocolate')) return SPRITES.chocolate;
  return SPRITES.otro;
}

function draw(g, { pal, px }) {
  g.clearRect(0, 0, 16, 16);
  px.forEach((row, y) => {
    for (let x = 0; x < 16; x++) {
      const c = pal[row[x]];
      if (!c) continue;
      g.fillStyle = c;
      g.fillRect(x, y, 1, 1);
    }
  });
}

export function createObtenido(root, { audio } = {}) {
  const el = document.createElement('div');
  el.className = 'ob';
  el.setAttribute('role', 'status');
  el.innerHTML = `
    <div class="ob-card">
      <div class="ob-icon"><i class="ob-rays"></i><canvas class="ob-3d"></canvas><canvas class="ob-2d" width="16" height="16"></canvas></div>
      <small class="ob-kicker">¡Obtuviste!</small>
      <b class="ob-name"></b>
      <span class="ob-use"></span>
    </div>`;
  root.append(el);
  const g = el.querySelector('.ob-2d').getContext('2d');
  // 3D si se puede; si WebGL falla, queda el sprite 2D de respaldo
  let obj3d = null;
  try {
    obj3d = createObjeto3d(el.querySelector('.ob-3d'));
    el.classList.add('tres');
  } catch (err) {
    console.error('[obtenido] 3D', err);
  }
  const nameEl = el.querySelector('.ob-name');
  const useEl = el.querySelector('.ob-use');
  let timer = 0;

  function hide() {
    clearTimeout(timer);
    obj3d?.stop();
    el.classList.remove('on', 'out');
  }

  return {
    show(nombre, uso = '', ms = 2800) {
      try {
        draw(g, spriteFor(nombre));
        nameEl.textContent = nombre;
        useEl.textContent = uso;
        useEl.hidden = !uso;
        hide();
        void el.offsetWidth; // reinicia la animación
        el.classList.add('on');
        obj3d?.show(tipoDe(nombre));
        audio?.sfx?.('ui');
        timer = setTimeout(() => {
          el.classList.add('out');
          timer = setTimeout(hide, 350);
        }, ms);
      } catch (err) {
        console.error('[obtenido]', err);
      }
    },
    hide,
  };
}
