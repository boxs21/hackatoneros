import * as THREE from 'three';
import './style.css';
import { createEvents } from './core/events.js';
import { createInput } from './core/input.js';
import { createFader } from './core/fader.js';
import { createStateMachine } from './core/stateMachine.js';
import { createHelp } from './core/help.js';
import { setupDemo, DEMO } from './core/demo.js';
import { createHud } from './ui/hud.js';
import { createMisiones } from './ui/misiones.js';
import { audio } from './audio/audio.js';
import { STATES } from './states/index.js';
import { createGfx } from './gfx/gfx.js'; // rama test-graficos: modo pintura (tecla G)

// Resolución interna estilo PS1; el CSS la escala con píxeles duros.
export const RES = { w: 320, h: 240 };

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.setSize(RES.w, RES.h, false);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05060a);
const camera = new THREE.PerspectiveCamera(70, RES.w / RES.h, 0.05, 200);

const events = createEvents();

// ctx: lo único que reciben los estados. Todo lo compartido pasa por aquí.
const ctx = {
  renderer, scene, camera, canvas, events, audio,
  input: createInput(canvas),
  fader: createFader(document.getElementById('fade')),
  hud: createHud(document.getElementById('hud'), { audio }),
  memoria: {}, // decisiones del jugador que otras escenas pueden leer (ej. memoria.vendedor = 'compro')
  stage: null, // THREE.Group del estado actual (lo maneja la máquina de estados)
  demo: DEMO,
  paused: false,
};

ctx.misiones = createMisiones(document.getElementById('hud'), events);
ctx.fsm = createStateMachine(ctx, STATES);

// Cambiar de momento. Por defecto con fundido corto; { fade: false } corta seco.
let pending = null;
ctx.go = async (id, data = {}, { fade = true } = {}) => {
  if (!fade) { ctx.fsm.enter(id, data); return; }
  if (ctx.fader.busy) { pending = [id, data]; return; }
  await ctx.fader.blackout(() => ctx.fsm.enter(id, data));
  if (pending) {
    const [pid, pdata] = pending;
    pending = null;
    ctx.go(pid, pdata);
  }
};
ctx.next = (data = {}) => {
  const next = ctx.fsm.state?.next;
  if (next) ctx.go(next, data);
};
// Reinicio instantáneo del momento actual (al ser atrapado, por ejemplo).
// data = punto de control opcional; sin data repite el mismo de la entrada.
ctx.restart = (data = ctx.fsm.data) => {
  events.emit('restart', ctx.fsm.current);
  ctx.go(ctx.fsm.current, data);
};
// Avisar que el jugador avanzó: reinicia el reloj de pista y avance automático.
ctx.progress = () => events.emit('progress');

// Cámara a su posición por defecto en cada momento nuevo.
events.on('state:enter', () => {
  camera.position.set(0, 1.6, 0);
  camera.rotation.set(0, 0, 0);
  camera.fov = 70;
  camera.updateProjectionMatrix();
  scene.fog = null;
  ctx.hud.clear();
});
events.on('hint', (text) => ctx.hud.hint(text));

const gfx = createGfx(ctx);
const help = createHelp(ctx);
const demo = setupDemo(ctx);
if (DEMO) window.ctx = ctx; // para depurar en la consola

let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  ctx.fsm.update(dt);
  help.update(dt);
  demo.update(dt);
  gfx.render(dt); // en modo PS1 es renderer.render(scene, camera)
  ctx.input.endFrame();
  requestAnimationFrame(frame);
}

ctx.fsm.enter('inicio');
requestAnimationFrame(frame);
