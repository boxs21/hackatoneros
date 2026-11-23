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

// Pausa: si el jugador suelta el mouse (Esc) o cambia de pestaña en medio del juego,
// todo se detiene (también el sonido) hasta que haga click. No aplica en el menú.
const SIN_PAUSA = new Set(['inicio']);
const pausa = document.createElement('div');
pausa.id = 'pausa';
pausa.innerHTML = '<b>PAUSA</b><span>Haz click para seguir</span>';
pausa.style.cssText = 'position:absolute;inset:0;z-index:30;display:none;place-content:center;gap:10px;'
  + 'text-align:center;background:rgba(0,0,0,.72);color:#ffb800;cursor:pointer;'
  + 'font:600 clamp(18px,3vw,34px)/1.2 ui-monospace,Menlo,monospace;letter-spacing:.12em;';
pausa.querySelector('span').style.cssText = 'font-size:.45em;color:#eef1f6;letter-spacing:.06em;';
document.getElementById('screen').appendChild(pausa);
let jugando = false; // ya capturó el mouse al menos una vez
function setPaused(v) {
  if (ctx.paused === v) return;
  ctx.paused = v;
  pausa.style.display = v ? 'grid' : 'none'; // (no usar hidden: el display del estilo le gana)
  const ac = ctx.audio.context;
  if (ac) (v ? ac.suspend() : ac.resume()).catch((err) => console.error('[pausa] audio', err));
}
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === canvas) { jugando = true; setPaused(false); return; }
  if (jugando && !SIN_PAUSA.has(ctx.fsm.current)) setPaused(true);
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && jugando && !SIN_PAUSA.has(ctx.fsm.current)) setPaused(true);
});
pausa.addEventListener('click', () => {
  ctx.input.lockPointer();
  setPaused(false); // si el navegador no devuelve el mouse, igual se sigue jugando (flechas)
});
events.on('state:enter', (id) => { if (SIN_PAUSA.has(id)) setPaused(false); });

const help = createHelp(ctx);
const demo = setupDemo(ctx);
if (DEMO) window.ctx = ctx; // para depurar en la consola

let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  if (!ctx.paused) {
    ctx.fsm.update(dt);
    help.update(dt);
  }
  demo.update(dt);
  renderer.render(scene, camera);
  ctx.input.endFrame();
  requestAnimationFrame(frame);
}

ctx.fsm.enter('inicio');
requestAnimationFrame(frame);
