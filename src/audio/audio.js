// MOTOR DE AUDIO. Dueño: Andy.
// La interfaz es la acordada con el equipo: unlock, sfx, voz, ambiente,
// silencio, posicional, musica, stopAll. Los nombres y parámetros no cambian.
//
// Cada sonido sale de una receta en synth.js (generado por código).
// Si en public/audio/ hay un archivo con el mismo nombre (.ogg, .mp3, .wav
// o .m4a), se usa el archivo. Ver public/audio/LEEME.txt.
//
//   ctx.audio.sfx('flash', { cerca: 0.6 })          flash + la multitud (cerca: 0 a 1)
//   ctx.audio.sfx('frenazo' | 'puertas' | 'pitido' | 'empujon' | 'paso' | 'desaparece'
//                 | 'atrapado' | 'susto' | 'celular' | 'notificacion' | 'ui' | 'latido' | 'crujido' | 'anuncio'
//                 | 'vidrio' | 'grito' (opts.personaje: 'Escolar' | 'Oficinista' | 'Señora' | 'Vendedor'))
//   ctx.audio.voz('vendedor', 'a-luca', { radio, position })   -> { duracion, fin, stop }
//   ctx.audio.ambiente('anden' | 'vagon' | 'tunel' | 'casa' | 'multitud' | null)
//   ctx.audio.silencio()                              corte total y seco
//   ctx.audio.posicional('vendedor' | 'borrados', pos, { camera: ctx.camera })
//   ctx.audio.musica('casa' | 'menu' | null)        'menu' suena desde public/audio/musica/
import { receta, habla } from './synth.js';
import { PRESETS, MEZCLA, VOZ_RADIO } from './presets.js';

// Archivos presentes en public/audio/, por nombre sin extensión.
const urls = import.meta.glob('/public/audio/**/*.{ogg,mp3,wav,m4a}', { eager: true, query: '?url', import: 'default' });
const nombreDe = (ruta) => ruta.split('/').pop().replace(/\.\w+$/, '').toLowerCase();
const largos = ([ruta]) => ruta.includes('/musica/');
// Lo que está en public/audio/musica/ es largo: se reproduce directo, sin cargarlo entero en memoria.
const DIRECTO = new Map(Object.entries(urls).filter(largos).map(([ruta, url]) => [nombreDe(ruta), url]));
const ARCHIVOS = new Map(Object.entries(urls).filter((e) => !largos(e)).map(([ruta, url]) => [nombreDe(ruta), url]));
const buffers = new Map();

let ac = null;
let master = null;
let bus = null;
let cargando = null;
let oyente = null; // cámara que hace de oídos
let oyenteRaf = 0;

const activos = new Set(); // todo lo que suena ahora: { stop(fade) }
let ambActual = null;
let ambNombre = null;
let musActual = null;
let musNombre = null;
const avisados = new Set();

const slug = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function avisar(tipo, nombre) {
  const k = `${tipo}:${nombre}`;
  if (avisados.has(k)) return;
  avisados.add(k);
  console.warn(`[audio] no existe ${tipo} "${nombre}"`);
}

// Ejecuta fn en el primer click, toque o tecla (lo que el navegador acepta como gesto).
function alPrimerGesto(fn) {
  const una = () => { removeEventListener('pointerdown', una, true); removeEventListener('keydown', una, true); fn(); };
  addEventListener('pointerdown', una, true);
  addEventListener('keydown', una, true);
}

function armar() {
  // Si el contexto nace bloqueado, se despierta solo con el primer gesto.
  if (ac.state === 'suspended') alPrimerGesto(() => { ac.resume().catch((err) => console.error('[audio] resume', err)); });
  master = ac.createGain();
  master.gain.value = MEZCLA.master;
  master.connect(ac.destination);
  // Limitador: nada satura aunque se junten flash, multitud y susto.
  const lim = ac.createDynamicsCompressor();
  lim.threshold.value = -10;
  lim.knee.value = 6;
  lim.ratio.value = 12;
  lim.attack.value = 0.003;
  lim.release.value = 0.2;
  lim.connect(master);
  bus = {};
  for (const k of ['sfx', 'voz', 'ambiente', 'musica']) {
    bus[k] = ac.createGain();
    bus[k].gain.value = MEZCLA[k];
    bus[k].connect(lim);
  }
}

async function cargar() {
  await Promise.all([...ARCHIVOS].map(async ([nombre, url]) => {
    try {
      const datos = await (await fetch(url)).arrayBuffer();
      buffers.set(nombre, await ac.decodeAudioData(datos));
    } catch (err) {
      console.error(`[audio] no se pudo cargar ${nombre}`, err);
    }
  }));
}

// Canal propio para cada sonido: se puede cortar sin tocar a los demás.
function canal(grupo, { volume = 1, pan = 0 } = {}) {
  const g = ac.createGain();
  g.gain.value = volume;
  if (pan && ac.createStereoPanner) {
    const p = ac.createStereoPanner();
    p.pan.value = pan;
    g.connect(p).connect(bus[grupo]);
  } else g.connect(bus[grupo]);
  return g;
}

function registrar(g, alParar) {
  let vivo = true;
  const h = {
    stop(fade = 0.02) {
      if (!vivo) return;
      vivo = false;
      activos.delete(h);
      const t = ac.currentTime;
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.linearRampToValueAtTime(0, t + fade);
      alParar?.(t + fade);
      setTimeout(() => g.disconnect(), fade * 1000 + 120);
    },
  };
  activos.add(h);
  return h;
}

function tocarBuffer(buf, dest, { rate = 1, loop = false, delay = 0 } = {}) {
  const s = ac.createBufferSource();
  s.buffer = buf;
  s.loop = loop;
  s.playbackRate.value = rate;
  s.connect(dest);
  s.start(ac.currentTime + delay);
  return s;
}

// Un golpe: archivo si existe, receta si no. Devuelve la duración o null.
function golpe(grupo, nombre, dest, opts) {
  const t = ac.currentTime + (opts.delay ?? 0);
  const buf = buffers.get(nombre);
  if (buf) {
    tocarBuffer(buf, dest, opts);
    return buf.duration / (opts.rate ?? 1);
  }
  const r = receta(grupo, nombre, PRESETS);
  return r ? r(ac, dest, t, opts) : null;
}

// Filtro de radio para las voces: banda angosta y un poco de saturación.
function radio(dest) {
  const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 420;
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2800;
  const ws = ac.createWaveShaper();
  const c = new Float32Array(257);
  for (let i = 0; i < 257; i++) { const x = i / 128 - 1; c[i] = Math.tanh(x * 3) * 0.8; }
  ws.curve = c;
  hp.connect(lp).connect(ws).connect(dest);
  return hp;
}

function espacial(dest, position, { refDistance = 1.5, maxDistance = 40, rolloff = 1.4 } = {}) {
  const p = ac.createPanner();
  p.panningModel = 'HRTF';
  p.distanceModel = 'inverse';
  p.refDistance = refDistance;
  p.maxDistance = maxDistance;
  p.rolloffFactor = rolloff;
  p.connect(dest);
  const mover = (v) => {
    if (!v) return;
    if (p.positionX) { p.positionX.value = v.x; p.positionY.value = v.y; p.positionZ.value = v.z; } else p.setPosition(v.x, v.y, v.z);
  };
  mover(position);
  return { nodo: p, mover };
}

// Los oídos siguen a la cámara mientras haya algo posicional sonando.
function seguirOyente() {
  if (oyenteRaf || !oyente) return;
  const paso = () => {
    oyenteRaf = 0;
    if (!ac || !oyente) return;
    const e = oyente.matrixWorld.elements;
    const l = ac.listener;
    if (l.positionX) {
      l.positionX.value = e[12]; l.positionY.value = e[13]; l.positionZ.value = e[14];
      l.forwardX.value = -e[8]; l.forwardY.value = -e[9]; l.forwardZ.value = -e[10];
      l.upX.value = e[4]; l.upY.value = e[5]; l.upZ.value = e[6];
    } else {
      l.setPosition(e[12], e[13], e[14]);
      l.setOrientation(-e[8], -e[9], -e[10], e[4], e[5], e[6]);
    }
    oyenteRaf = requestAnimationFrame(paso);
  };
  oyenteRaf = requestAnimationFrame(paso);
}

// Cambia un bucle (ambiente o música) con fundido cruzado.
function cambiarBucle(grupo, nombre, opts, actual) {
  const { volume = 1, fade = 0.8 } = opts;
  actual?.stop(fade);
  if (!nombre || nombre === 'nada') return null;
  const g = canal(grupo, { volume: 0 });
  const t = ac.currentTime;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(volume, t + Math.max(fade, 0.01));
  const buf = buffers.get(nombre);
  let parar;
  if (DIRECTO.has(nombre)) {
    const el = new Audio(DIRECTO.get(nombre));
    el.loop = opts.loop ?? true;
    ac.createMediaElementSource(el).connect(g);
    // Intenta sonar de inmediato. Si el navegador lo bloquea (aún no hubo gesto
    // del jugador), suena en el primer click o tecla, sin esperar nada más.
    el.play().catch((err) => {
      if (err?.name !== 'NotAllowedError') { console.error(`[audio] no se pudo reproducir ${nombre}`, err); return; }
      alPrimerGesto(() => { if (!el.dataset.fin) el.play().catch((e) => console.error(`[audio] no se pudo reproducir ${nombre}`, e)); });
    });
    const pausar = el.pause.bind(el);
    el.pause = () => { el.dataset.fin = '1'; pausar(); };
    parar = (cuando) => setTimeout(() => el.pause(), Math.max(0, cuando - ac.currentTime) * 1000 + 30);
  } else if (buf) {
    const s = tocarBuffer(buf, g, { loop: opts.loop ?? true });
    parar = (cuando) => s.stop(cuando);
  } else {
    const r = receta(grupo, nombre, PRESETS);
    if (!r) { avisar(grupo, nombre); g.disconnect(); return null; }
    const b = r(ac, g, t, opts);
    parar = (cuando) => b.stop(cuando);
  }
  return registrar(g, parar);
}

const NADA = { duracion: 0, fin: Promise.resolve(), stop() {}, setPosition() {} };

export const audio = {
  // Se llama en el primer click (pantalla de inicio). Sin esto no suena nada.
  async unlock() {
    if (!ac) {
      ac = new AudioContext({ latencyHint: 'interactive' });
      armar();
      cargando = cargar();
    }
    // Nunca deja pegado el inicio: espera el permiso y las grabaciones 1,5 s como máximo.
    const listo = (ac.state === 'suspended' ? ac.resume() : Promise.resolve()).then(() => cargando);
    await Promise.race([listo, new Promise((r) => setTimeout(r, 1500))]);
  },
  get context() { return ac; },

  // Golpe de sonido. opts: volume, pan (-1 a 1), rate, delay (s).
  // 'flash' suma a la multitud: cerca (0 lejos, 1 encima), multitud: false para apagarla.
  sfx(name, opts = {}) {
    if (!ac) return NADA;
    const g = canal('sfx', opts);
    let dur = golpe('sfx', name, g, opts);
    if (dur == null) { avisar('sfx', name); g.disconnect(); return NADA; }
    if (name === 'flash' && opts.multitud !== false) {
      dur = Math.max(dur, golpe('sfx', 'multitud', g, { cerca: 0.25, ...opts }) ?? 0);
    }
    const h = registrar(g);
    setTimeout(() => h.stop(0.03), (dur + (opts.delay ?? 0)) * 1000 + 300);
    return h;
  },

  // Frase de un personaje: archivo voz-<personaje>-<frase>. Sin grabación suena un relleno.
  // opts: volume, radio (filtro), position (Vector3, la ubica en el espacio), silabas (relleno).
  // Devuelve { duracion, fin (promesa), stop }.
  voz(personaje, frase, opts = {}) {
    if (!ac) return NADA;
    // El altavoz del tren: suena una campanilla, la voz entra 1,1 s después y sale por radio.
    // Un subtítulo nuevo no lo calla: solo lo cortan silencio() o stopAll().
    const altavoz = slug(personaje) === 'altavoz';
    if (altavoz) {
      this.sfx('anuncio', { volume: 0.8 });
      opts = { radio: true, ...opts, delay: (opts.delay ?? 0) + 1.1 };
    }
    const g = canal('voz', opts);
    let dest = g;
    if (opts.position) { dest = espacial(g, opts.position, opts).nodo; seguirOyente(); }
    if (opts.radio ?? VOZ_RADIO) dest = radio(dest);
    const buf = buffers.get(`voz-${slug(personaje)}-${slug(frase)}`);
    let duracion;
    if (buf) {
      tocarBuffer(buf, dest, opts);
      duracion = buf.duration;
    } else {
      duracion = habla(ac, dest, ac.currentTime + (opts.delay ?? 0), { personaje: slug(personaje), ...opts });
    }
    const h = registrar(g);
    const fin = new Promise((r) => setTimeout(() => { h.stop(0.03); r(); }, (duracion + (opts.delay ?? 0)) * 1000 + 60));
    return { duracion: duracion + (opts.delay ?? 0), fin, stop: altavoz ? () => {} : h.stop };
  },

  // Fondo en bucle; cambia con fundido cruzado. null lo apaga. opts: volume, fade (s).
  ambiente(name, opts = {}) {
    if (!ac) return;
    if (name === ambNombre && ambActual) return;
    ambActual = cambiarBucle('ambiente', name, opts, ambActual);
    ambNombre = ambActual ? name : null;
  },

  // Corte total y seco, sin fade (apagón). Después de esto no queda nada sonando.
  silencio() {
    if (!ac) return;
    const t = ac.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(0, t);
    this.stopAll(0);
    master.gain.setValueAtTime(MEZCLA.master, t + 0.06);
  },

  // Sonido en el espacio 3D. position: THREE.Vector3. Devuelve { setPosition(v), stop(fade) }.
  // opts: camera (ctx.camera, hace de oídos), volume, refDistance, maxDistance, rolloff, cada (s, pausa del vendedor).
  posicional(name, position, opts = {}) {
    if (!ac) return NADA;
    if (opts.camera) oyente = opts.camera;
    const g = canal('sfx', opts);
    const e = espacial(g, position, opts);
    const buf = buffers.get(name) ?? (name === 'vendedor' ? buffers.get('voz-vendedor-a-luca') : null);
    let parar;
    if (buf) {
      const s = tocarBuffer(buf, e.nodo, { loop: opts.loop ?? true });
      parar = (cuando) => s.stop(cuando);
    } else {
      const r = receta('posicional', name, PRESETS) ?? receta('ambiente', name, PRESETS);
      if (!r) { avisar('posicional', name); g.disconnect(); return NADA; }
      const b = r(ac, e.nodo, ac.currentTime, opts);
      parar = (cuando) => b.stop(cuando);
    }
    seguirOyente();
    const h = registrar(g, parar);
    return { setPosition: e.mover, stop: h.stop };
  },

  // La cámara que hace de oídos. Alternativa a pasar { camera } en posicional.
  oyente(camera) { oyente = camera; if (ac) seguirOyente(); },

  // Música en bucle: 'casa' (generada) o un archivo de public/audio/musica/. null la apaga. opts: volume, fade (s).
  musica(name, opts = {}) {
    if (!ac) return;
    if (name === musNombre && musActual) return;
    musActual = cambiarBucle('musica', name, { fade: 1.5, ...opts }, musActual);
    musNombre = musActual ? name : null;
  },

  // Volumen final, de 0 a 1 (para ajustar en el escenario).
  volumen(v) {
    MEZCLA.master = v;
    if (ac) master.gain.setTargetAtTime(v, ac.currentTime, 0.02);
  },

  // Corta todo lo que suena. fade en segundos.
  stopAll(fade = 0.05) {
    if (!ac) return;
    [...activos].forEach((h) => h.stop(fade));
    ambActual = null; ambNombre = null;
    musActual = null; musNombre = null;
  },
};
