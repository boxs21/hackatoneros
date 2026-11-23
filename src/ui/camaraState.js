import { audio } from '../audio/audio.js';

// ESTADO DE LA CÁMARA. Dueño: Renato.
// El jugador mira el juego a través de una cámara (visor a pantalla completa,
// ui/camara.js). Aquí vive lo que la cámara sabe: batería, hora, mensajes
// (pistas) y si está "en uso" en la escena.

const BATTERY_START = 23; // %
const BATTERY_END = 2; // % al llegar al final
const DRAIN_SECONDS = 330; // 5:30, lo que dura el Plan A
const MAX_MSGS = 2;

const timeFmt = new Intl.DateTimeFormat('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false });
const dateFmt = new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });

export const cam = {
  battery: BATTERY_START,
  power: true,
  draining: true,
  msgs: [], // { from, text, old } — el más nuevo primero
  time: '',
  date: '',
  recSeconds: 0, // contador del REC (solo corre mientras la cámara está en uso)
  version: 0,
  seenInScene: 0,
  forced: false, // un estado pidió mostrar el visor aunque no haya escena de Camilo
  get inScene() { return performance.now() - this.seenInScene < 400; },
  get visible() { return this.power && (this.inScene || this.forced); },
  get pct() { return this.power ? Math.max(1, Math.ceil(this.battery)) : 0; },
};

const listeners = new Set();
export function onCamChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function changed() {
  cam.version++;
  for (const fn of listeners) {
    try { fn(cam); } catch (err) { console.error('[camara] listener', err); }
  }
}

// La escena de Camilo avisa en cada frame que la cámara está en uso.
export function markInScene() {
  const had = cam.inScene;
  cam.seenInScene = performance.now();
  if (!had) changed();
}

const timers = new WeakMap();
export function notify(text, { from = 'Desconocido', ms = 6000 } = {}) {
  if (!cam.power) return;
  cam.msgs.forEach((m) => { m.old = true; });
  const m = { from, text, old: false };
  cam.msgs.unshift(m);
  cam.msgs.length = Math.min(cam.msgs.length, MAX_MSGS);
  try {
    audio.sfx('notificacion', { pan: 0.2 });
  } catch (err) {
    console.error('[camara] sonido', err);
  }
  changed();
  timers.set(m, setTimeout(() => {
    cam.msgs = cam.msgs.filter((x) => x !== m);
    changed();
  }, ms));
}

export function setBattery(n) { cam.battery = Math.min(100, Math.max(0, n)); changed(); }
export function setDrain(on) { cam.draining = on; }
export function powerOff() { cam.power = false; cam.battery = 0; changed(); }
export function powerOn() { cam.power = true; if (cam.battery < 1) cam.battery = 1; changed(); }
export function setForced(on) { cam.forced = on; changed(); }
export function clearMsgs() {
  cam.msgs.forEach((m) => clearTimeout(timers.get(m)));
  cam.msgs = [];
  changed();
}

function readClock() {
  const now = new Date();
  const t = timeFmt.format(now);
  const d = dateFmt.format(now).replace(/[.,]/g, '').toUpperCase();
  if (t === cam.time && d === cam.date) return false;
  cam.time = t;
  cam.date = d;
  return true;
}
readClock();

let wasInScene = false;
setInterval(() => {
  try {
    let dirty = readClock();
    if (cam.visible) {
      cam.recSeconds++;
      dirty = true;
      if (cam.draining) {
        cam.battery = Math.max(BATTERY_END, cam.battery - (BATTERY_START - BATTERY_END) / DRAIN_SECONDS);
      }
    }
    if (cam.inScene !== wasInScene) { wasInScene = cam.inScene; dirty = true; }
    if (dirty) changed();
  } catch (err) {
    console.error('[camara] tick', err);
  }
}, 1000);
