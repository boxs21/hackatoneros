// RECETAS DE SONIDO. Dueño: Andy.
// Todo el sonido del juego se genera con Web Audio, sin archivos.
// Si existe un archivo con el mismo nombre en public/audio/, el motor
// (audio.js) usa el archivo y esta receta queda como respaldo.
//
// Este archivo no importa nada: recibe el AudioContext y un nodo de salida.
//   golpes:  receta(ac, out, t, opts) -> duración en segundos
//   bucles:  receta(ac, out, t, opts) -> { stop(cuando) }
// Donde hay variantes (A, B, C), la elegida está en presets.js.

const bufs = new WeakMap();

// Ruido de 2 s, creado una sola vez por contexto.
export function ruido(ac, tipo = 'blanco') {
  let m = bufs.get(ac);
  if (!m) { m = {}; bufs.set(ac, m); }
  if (m[tipo]) return m[tipo];
  const n = Math.floor(ac.sampleRate * 2);
  const b = ac.createBuffer(1, n, ac.sampleRate);
  const d = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1;
    if (tipo === 'marron') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
  }
  m[tipo] = b;
  return b;
}

const rnd = (a, b) => a + Math.random() * (b - a);
const mtof = (m) => 440 * 2 ** ((m - 69) / 12);

function G(ac, dest, v = 1) { const g = ac.createGain(); g.gain.value = v; g.connect(dest); return g; }
function F(ac, dest, type, f, q = 0.7) {
  const x = ac.createBiquadFilter();
  x.type = type; x.frequency.value = f; x.Q.value = q; x.connect(dest);
  return x;
}
function P(ac, dest, pan) {
  if (!ac.createStereoPanner) return dest;
  const p = ac.createStereoPanner(); p.pan.value = pan; p.connect(dest);
  return p;
}
function O(ac, dest, type, f, t0, t1) {
  const o = ac.createOscillator();
  o.type = type; o.frequency.value = f; o.connect(dest); o.start(t0);
  if (t1 != null) o.stop(t1);
  return o;
}
function N(ac, dest, t0, t1, tipo = 'blanco', rate = 1) {
  const s = ac.createBufferSource();
  s.buffer = ruido(ac, tipo); s.loop = true; s.playbackRate.value = rate;
  s.connect(dest); s.start(t0, Math.random() * 1.5);
  if (t1 != null) s.stop(t1);
  return s;
}
// Envolvente: env(param, t, v0, [dt, valor, 'e' exponencial | 's' salto | lineal], ...)
function env(p, t, v0, ...segs) {
  p.setValueAtTime(v0, t);
  let x = t;
  for (const [dt, v, k] of segs) {
    x += dt;
    if (k === 'e') p.exponentialRampToValueAtTime(Math.max(v, 1e-4), x);
    else if (k === 's') p.setValueAtTime(v, x);
    else p.linearRampToValueAtTime(v, x);
  }
  return x;
}

// Golpe grave (bombo): seno que cae de f0 a f1.
function golpe(ac, out, t, { f0 = 120, f1 = 40, dur = 0.15, vol = 1 } = {}) {
  const g = G(ac, out, 0);
  env(g.gain, t, vol, [dur, 1e-4, 'e']);
  const o = O(ac, g, 'sine', f0, t, t + dur + 0.02);
  env(o.frequency, t, f0, [dur, f1, 'e']);
}
// Ráfaga de ruido filtrado.
function rafaga(ac, out, t, { dur = 0.03, vol = 1, tipo = 'bandpass', f = 3000, q = 1, noise = 'blanco', at = 0.002 } = {}) {
  const g = G(ac, out, 0);
  env(g.gain, t, 1e-4, [at, vol], [dur, 1e-4, 'e']);
  const fl = F(ac, g, tipo, f, q);
  N(ac, fl, t, t + at + dur + 0.02, noise);
  return fl;
}

// Bucle: junta los nodos vivos y los temporizadores para poder cortarlos.
function bucle(ac, out, armar) {
  const salida = G(ac, out, 1);
  const vivos = [];
  const timers = new Set();
  let activo = true;
  const k = {
    salida,
    osc: (dest, type, f, t) => { const o = O(ac, dest, type, f, t); vivos.push(o); return o; },
    noise: (dest, t, tipo, rate) => { const s = N(ac, dest, t, null, tipo, rate); vivos.push(s); return s; },
    // Llama fn(tiempo) cada min..max segundos.
    cada(fn, min, max = min, primero = rnd(min, max)) {
      const tick = (espera) => {
        const id = setTimeout(() => {
          timers.delete(id);
          if (!activo) return;
          fn(ac.currentTime + 0.05);
          tick(rnd(min, max));
        }, espera * 1000);
        timers.add(id);
      };
      tick(primero);
    },
    // Ritmo exacto: agenda con anticipación para que no se atrase.
    ritmo(fn, periodo, t0) {
      let sig = t0;
      const llenar = () => {
        while (sig < ac.currentTime + 0.9) { fn(sig); sig += typeof periodo === 'function' ? periodo() : periodo; }
      };
      llenar();
      const id = setInterval(() => { if (activo) llenar(); }, 250);
      timers.add(id);
    },
  };
  armar(k);
  return {
    stop(cuando = ac.currentTime) {
      if (!activo) return;
      activo = false;
      timers.forEach((id) => { clearTimeout(id); clearInterval(id); });
      timers.clear();
      vivos.forEach((n) => n.stop(cuando));
      setTimeout(() => salida.disconnect(), Math.max(0, cuando - ac.currentTime) * 1000 + 80);
    },
  };
}

// Murmullo de gente: bandas de ruido con volumen que sube y baja como sílabas.
function murmullo(ac, k, t, { voces = 6, vol = 0.3, fmin = 300, fmax = 2400, pan = true, ritmo = [2.5, 6.5] } = {}) {
  for (let i = 0; i < voces; i++) {
    const dest = pan ? P(ac, k.salida, rnd(-0.9, 0.9)) : k.salida;
    const g = G(ac, dest, (vol / Math.sqrt(voces)) * rnd(0.6, 1));
    const am = G(ac, g, 0.5);
    k.osc(G(ac, am.gain, 0.5), 'sine', rnd(ritmo[0], ritmo[1]), t);
    k.osc(G(ac, am.gain, 0.3), 'sine', rnd(0.13, 0.5), t);
    const bp = F(ac, am, 'bandpass', rnd(fmin, fmax), 2.5);
    k.osc(G(ac, bp.frequency, 180), 'sine', rnd(0.3, 1.1), t);
    k.noise(bp, t, 'blanco', rnd(0.6, 1.2));
  }
}

// Sílaba con formantes de vocal. Base de las voces de relleno.
const VOCALES = { a: [750, 1250], e: [480, 1900], i: [300, 2300], o: [480, 900], u: [330, 800] };
function silaba(ac, out, t, { f = 160, vocal = 'a', dur = 0.18, vol = 0.5, cae = 0.94 } = {}) {
  const g = G(ac, out, 0);
  env(g.gain, t, 1e-4, [0.025, vol], [dur * 0.6, vol * 0.7], [dur * 0.4, 1e-4, 'e']);
  const [f1, f2] = VOCALES[vocal] ?? VOCALES.a;
  const a = F(ac, g, 'bandpass', f1, 7);
  const b = F(ac, G(ac, g, 0.6), 'bandpass', f2, 9);
  const o = ac.createOscillator();
  o.type = 'sawtooth';
  env(o.frequency, t, f, [dur + 0.03, f * cae]);
  o.connect(a); o.connect(b);
  o.start(t); o.stop(t + dur + 0.06);
  const soplo = G(ac, g, 0.05);
  N(ac, F(ac, soplo, 'bandpass', f2, 2), t, t + dur + 0.05);
}

// ---------------------------------------------------------------------------
// GOLPES (sfx)
// ---------------------------------------------------------------------------

const flash = {
  // A · Obturador: dos clics secos de cámara.
  A(ac, out, t) {
    rafaga(ac, out, t, { tipo: 'highpass', f: 3500, dur: 0.012, vol: 0.65 });
    rafaga(ac, out, t + 0.055, { tipo: 'highpass', f: 2500, dur: 0.02, vol: 0.6 });
    const g = G(ac, out, 0);
    env(g.gain, t, 0.25, [0.015, 1e-4, 'e']);
    O(ac, g, 'sine', 1800, t, t + 0.03);
    return 0.15;
  },
  // B · Condensador: destello y un silbido de recarga que dura los 0,6 s de espera.
  B(ac, out, t) {
    rafaga(ac, out, t, { f: 4200, q: 0.8, dur: 0.05, vol: 1 });
    golpe(ac, out, t, { f0: 95, f1: 42, dur: 0.09, vol: 0.7 });
    const g = G(ac, out, 0);
    env(g.gain, t, 1e-4, [0.03, 0.1], [0.5, 0.045], [0.07, 1e-4, 'e']);
    const o = O(ac, g, 'sine', 2600, t, t + 0.62);
    env(o.frequency, t, 2600, [0.58, 9000, 'e']);
    return 0.62;
  },
  // C · Golpe: un bombo grave con cola oscura. Menos cámara, más susto.
  C(ac, out, t) {
    golpe(ac, out, t, { f0: 140, f1: 32, dur: 0.22, vol: 0.75 });
    rafaga(ac, out, t, { tipo: 'highpass', f: 5000, dur: 0.008, vol: 0.8 });
    rafaga(ac, out, t, { tipo: 'lowpass', f: 900, dur: 0.35, vol: 0.6, noise: 'marron', at: 0.01 });
    return 0.4;
  },
};

// La multitud que responde al flash. cerca: 0 (lejos) a 1 (encima).
const multitud = {
  // A · Susurro: muchas bocas soltando aire a destiempo.
  A(ac, out, t, { cerca = 0.3 } = {}) {
    const n = 5 + Math.round(cerca * 4);
    const v = 0.3 + cerca * 0.9;
    for (let i = 0; i < n; i++) {
      const f = rnd(700, 3300);
      const t0 = t + rnd(0, 0.12);
      const g = G(ac, P(ac, out, rnd(-0.9, 0.9)), 0);
      env(g.gain, t0, 1e-4, [rnd(0.05, 0.11), v * rnd(0.5, 1)], [rnd(0.35, 0.65), 1e-4, 'e']);
      const fl = F(ac, g, 'bandpass', f, 5);
      env(fl.frequency, t0, f, [0.5, f * 0.7]);
      N(ac, fl, t0, t0 + 1.1);
    }
    return 1.25;
  },
  // B · Ahogo: una inhalación que crece y se corta de golpe.
  B(ac, out, t, { cerca = 0.3 } = {}) {
    const v = 0.2 + cerca * 0.7;
    const g = G(ac, out, 0);
    env(g.gain, t, 1e-4, [0.32, v, 'e'], [0.004, 0, 's']);
    const bp = F(ac, g, 'bandpass', 400, 3);
    env(bp.frequency, t, 400, [0.32, 2600, 'e']);
    N(ac, bp, t, t + 0.36);
    const lp = F(ac, G(ac, g, 0.22), 'lowpass', 1200, 1);
    [1, 1.07, 1.26].forEach((r) => O(ac, lp, 'sawtooth', 180 * r, t, t + 0.36));
    return 0.36;
  },
  // C · Coro: voces desafinadas que sostienen una nota. De cerca, sube a grito.
  C(ac, out, t, { cerca = 0.3 } = {}) {
    const base = 196 * (1 + cerca * 0.5);
    const v = 0.22 + cerca * 0.5;
    [1, 1.059, 1.189, 1.335, 1.498, 1.782].forEach((r, i) => {
      const g = G(ac, P(ac, out, (i / 5) * 1.6 - 0.8), 0);
      env(g.gain, t, 1e-4, [0.04, v], [0.7, 1e-4, 'e']);
      const bp = F(ac, g, 'bandpass', 1100, 2);
      const o = O(ac, bp, 'triangle', base * r, t, t + 0.8);
      if (cerca > 0.75) env(o.frequency, t, base * r, [0.3, base * r * 1.3]);
      O(ac, G(ac, o.frequency, 6), 'sine', rnd(5, 7), t, t + 0.8);
    });
    return 0.8;
  },
};

function chirrido(ac, out, t) {
  const D = 1.5;
  const g = G(ac, out, 0);
  env(g.gain, t, 1e-4, [0.12, 0.3], [0.63, 0.85], [0.5, 0.2], [0.25, 1e-4, 'e']);
  const bp = F(ac, g, 'bandpass', 3000, 1.2);
  [2130, 2970, 3740, 4410].forEach((f, i) => {
    const o = O(ac, G(ac, bp, 0.25), 'sawtooth', f, t, t + D);
    env(o.frequency, t, f * 1.06, [0.8, f], [0.7, f * 0.82]);
    O(ac, G(ac, o.frequency, 30), 'sine', 17 + i * 6, t, t + D);
  });
  N(ac, F(ac, G(ac, g, 0.3), 'highpass', 5000), t, t + D);
  const r = G(ac, out, 0);
  env(r.gain, t, 1e-4, [0.5, 0.8], [0.6, 0.3], [0.4, 1e-4, 'e']);
  N(ac, F(ac, r, 'lowpass', 150), t, t + D, 'marron');
  return D;
}

// El apagón corta a los 0,8 s: las dos variantes llegan a su punto más fuerte justo ahí.
const frenazo = {
  // A · Chirrido de fierro contra fierro.
  A: (ac, out, t) => chirrido(ac, out, t),
  // B · Chirrido, sacudón del vagón y motor que se muere.
  B(ac, out, t) {
    chirrido(ac, out, t);
    golpe(ac, out, t + 0.5, { f0: 70, f1: 30, dur: 0.3, vol: 1 });
    const g = G(ac, out, 0);
    env(g.gain, t, 0.3, [1.0, 0.2], [0.3, 1e-4, 'e']);
    const o = O(ac, F(ac, g, 'lowpass', 400), 'sawtooth', 110, t, t + 1.35);
    env(o.frequency, t, 110, [1.2, 28, 'e']);
    return 1.5;
  },
};

const susto = {
  // A · Golpe subgrave con una ráfaga de aire.
  A(ac, out, t) {
    golpe(ac, out, t, { f0: 80, f1: 28, dur: 0.6, vol: 1 });
    rafaga(ac, out, t, { f: 1800, q: 0.6, dur: 0.25, vol: 0.5, at: 0.005 });
    return 0.7;
  },
  // B · Cuerda rota: un racimo agudo que se desafina hacia abajo.
  B(ac, out, t) {
    const g = G(ac, out, 0);
    env(g.gain, t, 0.5, [0.5, 1e-4, 'e']);
    [1480, 1568, 2217].forEach((f) => {
      const o = O(ac, g, 'sawtooth', f, t, t + 0.55);
      env(o.frequency, t, f, [0.5, f * 0.8]);
    });
    golpe(ac, out, t, { f0: 60, f1: 30, dur: 0.3, vol: 0.8 });
    return 0.6;
  },
};

const SFX = {
  flash,
  multitud,
  frenazo,
  susto,
  // Puertas del vagón: aire, deslizamiento y tope.
  puertas(ac, out, t) {
    rafaga(ac, out, t, { tipo: 'highpass', f: 3000, dur: 0.4, vol: 0.35, at: 0.02 });
    rafaga(ac, out, t + 0.15, { tipo: 'lowpass', f: 300, dur: 0.6, vol: 0.9, noise: 'marron', at: 0.1 });
    golpe(ac, out, t + 0.85, { f0: 110, f1: 50, dur: 0.12, vol: 0.9 });
    rafaga(ac, out, t + 0.85, { f: 900, dur: 0.04, vol: 0.4 });
    return 1.1;
  },
  // Aviso de cierre inventado (tres tonos). No es el de ningún metro real.
  pitido(ac, out, t) {
    [0, 0.22, 0.44].forEach((d) => {
      const g = G(ac, out, 0);
      env(g.gain, t + d, 1e-4, [0.01, 0.22], [0.1, 0.18], [0.05, 1e-4, 'e']);
      O(ac, F(ac, g, 'lowpass', 2400), 'triangle', 988, t + d, t + d + 0.2);
    });
    return 0.65;
  },
  // Choque con un pasajero: ropa y cuerpo.
  empujon(ac, out, t) {
    rafaga(ac, out, t, { tipo: 'lowpass', f: 700, dur: 0.08, vol: 0.9, noise: 'marron', at: 0.004 });
    golpe(ac, out, t, { f0: 130, f1: 70, dur: 0.07, vol: 0.5 });
    return 0.15;
  },
  paso(ac, out, t) {
    rafaga(ac, out, t, { tipo: 'lowpass', f: rnd(380, 520), dur: 0.06, vol: 0.6, noise: 'marron', at: 0.003 });
    rafaga(ac, out, t + 0.01, { f: 1600, dur: 0.02, vol: 0.08 });
    return 0.1;
  },
  // Un pasajero desaparece: el aire se cierra donde estaba.
  desaparece(ac, out, t) {
    const g = G(ac, out, 0);
    env(g.gain, t, 0.6, [0.22, 0.3], [0.03, 1e-4, 'e']);
    const bp = F(ac, g, 'bandpass', 3000, 4);
    env(bp.frequency, t, 3000, [0.25, 200, 'e']);
    N(ac, bp, t, t + 0.28);
    golpe(ac, out, t + 0.27, { f0: 55, f1: 30, dur: 0.35, vol: 0.5 });
    return 0.65;
  },
  // Te alcanzaron: racimo disonante que se corta en seco (después viene el reinicio).
  atrapado(ac, out, t) {
    const g = G(ac, out, 0);
    env(g.gain, t, 0.9, [0.28, 1], [0.004, 0, 's']);
    const lp = F(ac, g, 'lowpass', 2600, 2);
    [110, 116.5, 155.6, 233, 247].forEach((f) => {
      const o = O(ac, G(ac, lp, 0.3), 'sawtooth', f, t, t + 0.3);
      env(o.frequency, t, f, [0.28, f * 1.12]);
    });
    N(ac, F(ac, G(ac, g, 0.35), 'bandpass', 2200, 0.7), t, t + 0.3);
    return 0.3;
  },
  // Celular: vibración sobre plástico.
  celular(ac, out, t) {
    [0, 0.22].forEach((d) => {
      const g = G(ac, out, 0);
      env(g.gain, t + d, 1e-4, [0.01, 0.5], [0.12, 0.5], [0.02, 1e-4, 'e']);
      O(ac, F(ac, g, 'lowpass', 500), 'square', 142, t + d, t + d + 0.17);
      N(ac, F(ac, G(ac, g, 0.12), 'bandpass', 2400, 3), t + d, t + d + 0.17);
    });
    return 0.4;
  },
  // Pista nueva en el celular: dos notas cortas.
  notificacion(ac, out, t) {
    [[0, 1319], [0.09, 1760]].forEach(([d, f]) => {
      const g = G(ac, out, 0);
      env(g.gain, t + d, 1e-4, [0.005, 0.3], [0.35, 1e-4, 'e']);
      O(ac, g, 'sine', f, t + d, t + d + 0.4);
    });
    return 0.5;
  },
  ui(ac, out, t) {
    rafaga(ac, out, t, { tipo: 'highpass', f: 2800, dur: 0.01, vol: 0.4 });
    return 0.03;
  },
  latido(ac, out, t) {
    golpe(ac, out, t, { f0: 70, f1: 38, dur: 0.12, vol: 0.9 });
    golpe(ac, out, t + 0.24, { f0: 62, f1: 36, dur: 0.14, vol: 0.6 });
    return 0.45;
  },
  // Crujido de metal lejano (lo usa también el túnel).
  crujido(ac, out, t) {
    const f = rnd(380, 620);
    const g = G(ac, P(ac, out, rnd(-0.8, 0.8)), 0);
    env(g.gain, t, 1e-4, [0.08, 0.5], [0.5, 1e-4, 'e']);
    const o = O(ac, F(ac, g, 'bandpass', f, 12), 'sawtooth', f, t, t + 0.65);
    env(o.frequency, t, f, [0.6, f * 0.86]);
    return 0.65;
  },
};

// ---------------------------------------------------------------------------
// AMBIENTES (bucles)
// ---------------------------------------------------------------------------

function clack(ac, out, t, vol = 0.5) {
  golpe(ac, out, t, { f0: 85, f1: 45, dur: 0.07, vol });
  golpe(ac, out, t + 0.14, { f0: 80, f1: 42, dur: 0.07, vol: vol * 0.8 });
  rafaga(ac, out, t, { f: 1200, dur: 0.03, vol: vol * 0.3 });
  rafaga(ac, out, t + 0.14, { f: 1100, dur: 0.03, vol: vol * 0.25 });
}

const vagon = {
  // A · Rieles: retumbo, golpes de riel a ritmo fijo y gente apretada.
  A(ac, out, t, { gente = true } = {}) {
    return bucle(ac, out, (k) => {
      k.noise(F(ac, G(ac, k.salida, 0.9), 'lowpass', 140), t, 'marron');
      const m = F(ac, G(ac, k.salida, 0.05), 'lowpass', 420);
      const o = k.osc(m, 'sawtooth', 92, t);
      k.osc(m, 'sawtooth', 184.6, t);
      k.osc(G(ac, o.frequency, 2), 'sine', 0.4, t);
      k.noise(F(ac, G(ac, k.salida, 0.03), 'bandpass', 1800, 0.5), t);
      k.ritmo((x) => clack(ac, k.salida, x, 0.5), 1.15, t + 0.3);
      if (gente) murmullo(ac, k, t, { voces: 6, vol: 0.28 });
    });
  },
  // B · Eléctrico: zumbido de motor al frente y rieles más espaciados.
  B(ac, out, t, { gente = true } = {}) {
    return bucle(ac, out, (k) => {
      k.noise(F(ac, G(ac, k.salida, 0.7), 'lowpass', 120), t, 'marron');
      const m = F(ac, G(ac, k.salida, 0.09), 'lowpass', 900);
      const o = k.osc(m, 'sawtooth', 220, t);
      k.osc(G(ac, m, 0.5), 'square', 440.8, t);
      k.osc(G(ac, o.frequency, 14), 'sine', 0.11, t);
      k.ritmo((x) => clack(ac, k.salida, x, 0.3), () => rnd(1.4, 1.9), t + 0.5);
      if (gente) murmullo(ac, k, t, { voces: 6, vol: 0.28 });
    });
  },
};

const tunel = {
  // A · Casi nada: aire grave apenas audible y un crujido lejano cada tanto.
  A(ac, out, t) {
    return bucle(ac, out, (k) => {
      k.noise(F(ac, G(ac, k.salida, 0.14), 'lowpass', 70), t, 'marron');
      k.cada((x) => SFX.crujido(ac, G(ac, k.salida, 0.07), x), 7, 15, rnd(5, 9));
    });
  },
  // B · Pitido de oídos: lo mismo, más un tono agudo que aparece y se va.
  B(ac, out, t) {
    return bucle(ac, out, (k) => {
      k.noise(F(ac, G(ac, k.salida, 0.14), 'lowpass', 70), t, 'marron');
      const g = G(ac, k.salida, 0);
      env(g.gain, t, 1e-4, [1.5, 0.012], [4, 0.008], [6, 1e-4, 'e']);
      k.osc(g, 'sine', 7300, t);
      k.cada((x) => SFX.crujido(ac, G(ac, k.salida, 0.07), x), 7, 15, rnd(6, 10));
    });
  },
};

const AMBIENTE = {
  vagon,
  tunel,
  // Andén lleno a las seis de la tarde.
  anden(ac, out, t) {
    return bucle(ac, out, (k) => {
      murmullo(ac, k, t, { voces: 10, vol: 0.5 });
      k.noise(F(ac, G(ac, k.salida, 0.3), 'lowpass', 110), t, 'marron');
      k.cada((x) => SFX.paso(ac, P(ac, G(ac, k.salida, 0.25), rnd(-0.8, 0.8)), x), 0.25, 0.8);
    });
  },
  // Solo gente, sin tren.
  multitud(ac, out, t) {
    return bucle(ac, out, (k) => murmullo(ac, k, t, { voces: 9, vol: 0.45 }));
  },
  // Estación Casa: aire quieto.
  casa(ac, out, t) {
    return bucle(ac, out, (k) => {
      const g = G(ac, k.salida, 0.035);
      k.osc(G(ac, g.gain, 0.012), 'sine', 0.09, t);
      k.noise(F(ac, g, 'bandpass', 420, 0.3), t);
    });
  },
};

// ---------------------------------------------------------------------------
// POSICIONALES (bucles mono; el motor los ubica en el espacio)
// ---------------------------------------------------------------------------

const POSICIONAL = {
  // Relleno hasta tener la voz grabada: tres sílabas cantadas, "a lu-ca".
  vendedor(ac, out, t, { cada = 2.8 } = {}) {
    return bucle(ac, out, (k) => {
      k.ritmo((x) => {
        const f = 150 * rnd(0.97, 1.03);
        silaba(ac, k.salida, x, { f: f * 1.1, vocal: 'a', dur: 0.15, vol: 0.5 });
        silaba(ac, k.salida, x + 0.26, { f: f * 1.32, vocal: 'u', dur: 0.2, vol: 0.55 });
        silaba(ac, k.salida, x + 0.5, { f, vocal: 'a', dur: 0.42, vol: 0.6, cae: 0.85 });
      }, cada, t + 0.1);
    });
  },
  // Los borrados respirando cerca.
  borrados(ac, out, t) {
    return bucle(ac, out, (k) => murmullo(ac, k, t, { voces: 4, vol: 0.5, fmin: 1500, fmax: 5000, pan: false, ritmo: [1.2, 3] }));
  },
};

// Voz de relleno cuando falta la grabación: sílabas sin palabras.
const TONOS = { escolar: 250, oficinista: 118, senora: 205, vendedor: 150 };
export function habla(ac, out, t, { personaje = '', silabas = 5, tono } = {}) {
  const f0 = tono ?? TONOS[personaje] ?? 160;
  const vs = Object.keys(VOCALES);
  let x = t;
  for (let i = 0; i < silabas; i++) {
    const dur = rnd(0.11, 0.2);
    silaba(ac, out, x, { f: f0 * (1.12 - (i / silabas) * 0.22) * rnd(0.96, 1.04), vocal: vs[Math.floor(rnd(0, vs.length))], dur, vol: 0.5 });
    x += dur + rnd(0.02, 0.09);
  }
  return x - t + 0.1;
}

// ---------------------------------------------------------------------------
// MÚSICA (solo Estación Casa; durante el terror no hay música)
// ---------------------------------------------------------------------------

// Motivo en La menor, compás de 3: Lam | Fa | Do | Sol | Lam | Fa | Mi | Lam.
const MELODIA = [
  [0, 76], [1, 69], [2, 72], [3, 77], [4, 69], [5, 72], [6, 76], [7, 67], [8, 72], [9, 74], [10, 67], [11, 71],
  [12, 72], [13, 76], [14, 81], [15, 79], [16, 77], [17, 72], [18, 71], [19, 76], [20, 68], [21, 69],
];
const BAJO = [45, 41, 48, 43, 45, 41, 40, 45];
const LARGO = 27; // tiempos: 8 compases y uno de respiro

function cajita(ac, out, t, f, dur, v) {
  [[1, 1], [2, 0.35], [3.01, 0.12], [5.4, 0.05]].forEach(([r, a], i) => {
    const d = 1.7 / (1 + i * 0.6);
    const g = G(ac, out, 0);
    env(g.gain, t, 1e-4, [0.004, v * a], [d, 1e-4, 'e']);
    O(ac, g, 'sine', f * r, t, t + d + 0.05);
  });
}
function fieltro(ac, out, t, f, dur, v) {
  const d = dur * 1.5 + 1;
  const g = G(ac, out, 0);
  env(g.gain, t, 1e-4, [0.02, v], [d, 1e-4, 'e']);
  const lp = F(ac, g, 'lowpass', 1400);
  O(ac, lp, 'triangle', f, t, t + d + 0.05);
  O(ac, G(ac, lp, 0.15), 'sine', f * 2, t, t + d + 0.05);
}
function silbo(ac, out, t, f, dur, v) {
  const g = G(ac, out, 0);
  env(g.gain, t, 1e-4, [0.12, v], [Math.max(dur - 0.12, 0.05), v * 0.8], [0.3, 1e-4, 'e']);
  const o = O(ac, g, 'sine', f, t, t + dur + 0.35);
  O(ac, G(ac, o.frequency, f * 0.006), 'sine', 5, t, t + dur + 0.35);
  N(ac, F(ac, G(ac, g, 0.04), 'bandpass', f * 2, 8), t, t + dur + 0.35);
}

// Arma el eco y agenda las notas en bucle.
function tocar(ac, out, t, beat, notas) {
  return bucle(ac, out, (k) => {
    const eco = ac.createDelay(1);
    eco.delayTime.value = beat * 0.75;
    const vuelta = G(ac, F(ac, eco, 'lowpass', 2200), 0.33);
    eco.connect(vuelta);
    eco.connect(G(ac, k.salida, 0.3));
    const seco = G(ac, k.salida, 1);
    seco.connect(eco);
    let vueltaN = 0;
    k.ritmo((x) => {
      notas.forEach(([b, fn, m, d, v]) => fn(ac, seco, x + b * beat, mtof(m), d * beat, v));
      vueltaN += 1;
    }, LARGO * beat, t + 0.05);
  });
}

const casa = {
  // A · Cajita de música: la melodía completa, con eco.
  A(ac, out, t) {
    const n = MELODIA.map(([b, m]) => [b, cajita, m, 1, 0.22]);
    BAJO.forEach((m, i) => n.push([i * 3, fieltro, m, 3, 0.2]));
    return tocar(ac, out, t, 0.6, n);
  },
  // B · Piano apagado: más lento, solo los tiempos fuertes.
  B(ac, out, t) {
    const n = MELODIA.filter(([b]) => b % 3 !== 1).map(([b, m]) => [b, fieltro, m, 2, 0.24]);
    BAJO.forEach((m, i) => { n.push([i * 3, fieltro, m, 3, 0.24]); n.push([i * 3 + 1, fieltro, m + 7, 2, 0.1]); });
    return tocar(ac, out, t, 0.8, n);
  },
  // C · Silbido: una nota larga por compás, como alguien silbando en el andén vacío.
  C(ac, out, t) {
    const n = MELODIA.filter(([b]) => b % 3 === 0).map(([b, m]) => [b, silbo, m, 2.6, 0.16]);
    BAJO.forEach((m, i) => { n.push([i * 3, fieltro, m, 3, 0.18]); n.push([i * 3, fieltro, m + 12, 3, 0.07]); });
    return tocar(ac, out, t, 0.75, n);
  },
};

const MUSICA = { casa };

export const RECETAS = { sfx: SFX, ambiente: AMBIENTE, posicional: POSICIONAL, musica: MUSICA };

// Devuelve la receta con ese nombre; si tiene variantes, la elegida en presets.
export function receta(grupo, nombre, presets = {}) {
  const r = RECETAS[grupo]?.[nombre];
  if (!r) return null;
  if (typeof r === 'function') return r;
  return r[presets[nombre]] ?? r.A;
}
