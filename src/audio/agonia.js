// GRITOS DE VERDAD. Dueño: Andy.
// Una voz humana hecha con Web Audio: cuerdas (sierra + pulso) que pasan por tres
// formantes de vocal abierta, con lo que hace que un grito dé miedo y no risa:
//   - aspereza: el volumen tiembla a 40–75 Hz (la voz se rompe)
//   - quiebres: la nota se cae de golpe y vuelve (se le corta la voz)
//   - aire: jadeo antes, y el grito termina ahogado, no en un final limpio
// No es exagerado ni largo: es alguien con miedo que no alcanza a terminar.
//
//   ctx.audio.sfx('agonia', { personaje: 'Señora', fase: 'agarre' | 'golpe' | 'caida' })
//     agarre  lo agarran: jadeo, grito que sube y se quiebra, sollozo            (~1,5 s)
//     golpe   lo azotan: se le va el aire, un quejido corto y una bocanada        (~0,7 s)
//     caida   lo sacan por la ventana: el grito se aleja por el túnel y se apaga  (~1,7 s)
import { ruido } from './synth.js';

const rnd = (a, b) => a + Math.random() * (b - a);

// tono base y tamaño de la boca (los formantes suben en voces chicas)
const VOCES = {
  escolar: { f0: 430, boca: 1.22 },
  oficinista: { f0: 215, boca: 0.95 },
  senora: { f0: 330, boca: 1.1 },
  vendedor: { f0: 250, boca: 1 },
};

const slug = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function agonia(ac, out, t, { personaje = '', fase = 'agarre' } = {}) {
  const { f0, boca } = VOCES[slug(personaje)] ?? { f0: 290, boca: 1.05 };
  const fin = { agarre: 1.55, golpe: 0.72, caida: 1.75 }[fase] ?? 1.55;

  const G = (dest, v = 0) => { const g = ac.createGain(); g.gain.value = v; g.connect(dest); return g; };
  const F = (dest, type, f, q) => {
    const x = ac.createBiquadFilter();
    x.type = type; x.frequency.value = f; x.Q.value = q; x.connect(dest);
    return x;
  };

  // salida de la fase: en la caída se va tapando (se aleja) y deja eco de túnel
  const salida = G(out, 1);
  const lejos = F(salida, 'lowpass', 9000, 0.6);
  if (fase === 'caida') {
    lejos.frequency.setValueAtTime(7000, t);
    lejos.frequency.exponentialRampToValueAtTime(520, t + fin);
    const eco = ac.createDelay(0.5);
    eco.delayTime.value = 0.19;
    const vuelta = G(eco, 0.42);
    lejos.connect(eco);
    eco.connect(vuelta);
    eco.connect(G(salida, 0.5));
  }

  // la voz: aspereza (AM rápida) -> formantes
  const voz = G(lejos, 0);
  const aspera = G(voz, 1);
  const tiembla = G(aspera.gain, 0);
  const am = ac.createOscillator();
  am.frequency.value = rnd(42, 74);
  am.connect(tiembla);
  am.start(t);
  am.stop(t + fin + 0.1);

  // vocal abierta "a" que se cierra a "o" cuando se ahoga
  const forma = [[850, 7, 1], [1280, 8, 0.75], [2900, 9, 0.42], [3900, 8, 0.2]].map(([f, q, v]) => {
    const b = F(G(aspera, v), 'bandpass', f * boca, q);
    return { b, f: f * boca };
  });
  const entrada = ac.createGain(); // todo lo que sale de la garganta entra por aquí a la boca
  forma.forEach(({ b }) => entrada.connect(b));

  // cuerdas: dos sierras desafinadas y un pulso; tiemblan como una garganta apretada
  const cuerdas = [];
  for (const [type, des, v] of [['sawtooth', 1, 0.6], ['sawtooth', 1.011, 0.45], ['square', 0.5, 0.18]]) {
    const o = ac.createOscillator();
    o.type = type;
    o.frequency.value = f0 * des;
    const g = G(entrada, v);
    o.connect(g);
    // temblor: uno lento (miedo) y uno rápido (la voz no aguanta)
    for (const [hz, hondo] of [[rnd(5.5, 7.5), 0.022], [rnd(21, 29), 0.016]]) {
      const l = ac.createOscillator();
      l.frequency.value = hz;
      const lg = ac.createGain();
      lg.gain.value = f0 * des * hondo;
      l.connect(lg).connect(o.frequency);
      l.start(t);
      l.stop(t + fin + 0.1);
    }
    o.start(t);
    o.stop(t + fin + 0.1);
    cuerdas.push({ o, des });
  }
  // aire: ruido por la misma boca, pero aparte de las cuerdas (para poder dejar solo el aire)
  const aire = ac.createGain();
  aire.gain.value = 0;
  forma.forEach(({ b }) => aire.connect(b));
  const sopl = ac.createBufferSource();
  sopl.buffer = ruido(ac);
  sopl.loop = true;
  sopl.connect(F(aire, 'highpass', 900, 0.5));
  sopl.start(t, Math.random());
  sopl.stop(t + fin + 0.1);

  // nota: lista de [cuándo, multiplicador de f0]; 'q' = quiebre (salto seco)
  const nota = (puntos) => {
    for (const { o, des } of cuerdas) {
      const p = o.frequency;
      puntos.forEach(([dt, m, q], i) => {
        const v = f0 * des * m;
        if (i === 0 || q) p.setValueAtTime(v, t + dt);
        else p.exponentialRampToValueAtTime(v, t + dt);
      });
    }
  };
  const vol = (param, puntos) => {
    puntos.forEach(([dt, v, q], i) => {
      const x = Math.max(v, 0.0001);
      if (i === 0 || q) param.setValueAtTime(x, t + dt);
      else param.exponentialRampToValueAtTime(x, t + dt);
    });
  };
  const cerrarBoca = (desde, hasta) => {
    // "a" -> "o": los dos primeros formantes bajan
    forma[0].b.frequency.setValueAtTime(forma[0].f, t + desde);
    forma[0].b.frequency.exponentialRampToValueAtTime(forma[0].f * 0.55, t + hasta);
    forma[1].b.frequency.setValueAtTime(forma[1].f, t + desde);
    forma[1].b.frequency.exponentialRampToValueAtTime(forma[1].f * 0.68, t + hasta);
  };

  if (fase === 'golpe') {
    // se le va el aire: un "ugh" que cae, y después la bocanada
    cerrarBoca(0, 0.2);
    nota([[0, 1.15], [0.07, 0.9], [0.24, 0.5]]);
    vol(voz.gain, [[0, 0.0001], [0.012, 0.9], [0.1, 0.55], [0.26, 0.0001], [0.4, 0.0001, 1], [0.5, 0.6], [0.7, 0.0001]]);
    vol(aire.gain, [[0, 0.7], [0.06, 0.25], [0.26, 0.05], [0.4, 0.05, 1], [0.5, 0.9], [0.7, 0.0001]]);
    vol(tiembla.gain, [[0, 0.5], [0.26, 0.2], [0.7, 0.2]]);
    vol(entrada.gain, [[0, 1], [0.39, 1], [0.4, 0.12, 1], [0.7, 0.12]]); // la bocanada es casi puro aire
  } else if (fase === 'caida') {
    // el grito largo que se aleja: sube, se quiebra dos veces y baja con el tren
    const q1 = rnd(0.42, 0.55);
    const q2 = rnd(0.85, 1.0);
    nota([[0, 1.2], [0.12, 1.75], [q1, 1.82], [q1 + 0.001, 1.28, 1], [q1 + 0.05, 1.7], [q2, 1.6], [q2 + 0.001, 1.15, 1], [q2 + 0.06, 1.45], [fin, 0.82]]);
    vol(voz.gain, [[0, 0.0001], [0.03, 0.95], [0.9, 0.7], [fin - 0.08, 0.08], [fin, 0.0001]]);
    vol(aire.gain, [[0, 0.15], [0.9, 0.3], [fin, 0.0001]]);
    vol(tiembla.gain, [[0, 0.3], [0.3, 0.62], [fin, 0.45]]);
    cerrarBoca(1.0, fin);
  } else {
    // agarre: toma aire de golpe, grita, se le quiebra, y queda sollozando
    const q = rnd(0.62, 0.76);
    nota([[0, 0.9], [0.2, 0.9], [0.21, 1.05, 1], [0.34, 1.62], [q, 1.72], [q + 0.001, 1.2, 1], [q + 0.06, 1.58], [1.02, 1.3], [1.03, 0.95, 1], [1.2, 0.8], [1.3, 1.0, 1], [1.5, 0.78]]);
    vol(voz.gain, [[0, 0.0001], [0.2, 0.0001], [0.21, 0.0001, 1], [0.25, 0.9], [0.95, 0.8], [1.02, 0.0001], [1.07, 0.0001, 1], [1.12, 0.3], [1.22, 0.0001], [1.3, 0.0001, 1], [1.35, 0.22], [1.5, 0.0001]]);
    // el jadeo de antes y los sollozos de después son aire
    vol(aire.gain, [[0, 0.0001], [0.16, 0.9], [0.2, 0.1], [0.95, 0.22], [1.02, 0.7], [1.08, 0.15], [1.26, 0.6], [1.32, 0.12], [1.5, 0.0001]]);
    vol(tiembla.gain, [[0, 0.2], [0.3, 0.55], [1.02, 0.6], [1.5, 0.3]]);
    cerrarBoca(0.95, 1.5);
  }

  setTimeout(() => { try { salida.disconnect(); } catch (err) { console.error('[agonia]', err); } }, (t - ac.currentTime + fin) * 1000 + 800);
  return fin + (fase === 'caida' ? 0.5 : 0.1);
}
