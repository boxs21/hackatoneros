// Avisos de tecla según el momento: una tecla chica («[F] Saca una foto») que aparece
// solo cuando esa acción importa y SE QUEDA hasta que la haces. Después se va y no vuelve.
// Uno a la vez, nunca encima de las opciones de respuesta, nunca en el apagón ni en pausa.
//
// Cada paso: { teclas, texto, desde (s desde que empezó la escena o terminó el paso
// anterior), cuando(ctx) opcional, si(ctx) opcional (si no se cumple, se salta),
// hecho(ctx, s) opcional, dura (s) opcional: se va solo }.
import { tiene } from '../mechanics/regalos.js';

const F = (ctx) => ctx.input.pressed('KeyF');
const E = (ctx) => ctx.input.pressed('KeyE');
const conCompleto = (ctx) => tiene(ctx, 'completo');

const PASOS = {
  // horaPunta: los controles de movimiento los muestra la tarjeta del inicio (states/horaPunta.js)
  losCinco: [
    { teclas: ['F'], texto: 'Saca una foto con el celular', desde: 11.5, hecho: F },
  ],
  borrados: [
    { teclas: ['F'], texto: 'Foto: ves el camino… pero se acercan', desde: 4.6, hecho: F },
    { teclas: ['W'], texto: 'Camina a oscuras hacia la luz roja del fondo', desde: 1.5, dura: 6 },
    { teclas: ['E'], texto: 'Si se acercan, tira el completo', desde: 12, dura: 7, si: conCompleto, hecho: E },
  ],
  vagonEscolar: [
    { teclas: ['F'], texto: 'Los números de tiza solo se ven con el flash', desde: 6, hecho: F },
    { teclas: ['E'], texto: 'Apunta al teclado de la puerta y marca el código', cuando: (ctx) => ctx.camera.position.z < -9.2, hecho: E },
  ],
  vagonOficinista: [
    { teclas: ['Espacio'], texto: 'Saltar al siguiente pedazo', desde: 4.5, hecho: (ctx) => ctx.input.pressed('Space') },
    { teclas: ['F'], texto: 'Lo que alumbras queda marcado', desde: 1, hecho: F },
  ],
  vagonVendedor: [
    { teclas: [], texto: 'Sigue la voz «a luca…» (mejor con audífonos)', desde: 9, dura: 6 },
    { teclas: ['E'], texto: 'Si se acercan, tira el completo', desde: 8, dura: 7, si: conCompleto, hecho: E },
  ],
};

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function createTutorial(root, ctx) {
  const box = document.createElement('div');
  box.className = 'hud-tecla';
  box.setAttribute('role', 'status'); // (no aria-live: camara.css mueve esos cuadros a la izquierda)
  root.appendChild(box);

  let pasos = [];
  let i = 0;
  let espera = 0; // s desde la escena o desde el paso anterior
  let visible = 0; // s que lleva en pantalla el paso actual
  let mostrado = false;
  const s = { w: 0 };

  function pintar(paso) {
    const teclas = paso.teclas.map((t) => `<kbd>${esc(t)}</kbd>`).join('');
    box.innerHTML = `${teclas}<span>${esc(paso.texto)}</span>`;
  }
  function ocultar() {
    box.classList.remove('on');
    mostrado = false;
  }
  function siguiente() {
    ocultar();
    i += 1;
    espera = 0;
    visible = 0;
  }

  ctx.events.on('state:enter', (id) => {
    pasos = PASOS[id] || [];
    i = 0;
    espera = 0;
    visible = 0;
    s.w = 0;
    ocultar();
  });

  return {
    update(dt) {
      const paso = pasos[i];
      if (!paso) return;
      if (ctx.input.down('KeyW')) s.w += dt;
      if (paso.si && !paso.si(ctx)) { siguiente(); return; }
      espera += dt;
      const listo = espera >= (paso.desde ?? 0) && (!paso.cuando || paso.cuando(ctx));
      // si el jugador ya lo hizo antes de que apareciera, no hace falta enseñarlo
      if (paso.hecho?.(ctx, s)) { siguiente(); return; }
      if (!listo) return;
      const tapado = document.querySelector('.hud-choice.on') || Number(getComputedStyle(document.getElementById('fade')).opacity) > .5;
      if (tapado) { box.classList.remove('on'); return; }
      if (!mostrado) { pintar(paso); mostrado = true; }
      box.classList.add('on');
      visible += dt;
      if (paso.dura && visible >= paso.dura) siguiente();
    },
  };
}
