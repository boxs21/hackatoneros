// DERRUMBE Y DESTELLO. Dueño: Andy.
// Dos golpes largos para el final (los usa world/colapso.js):
//   ctx.audio.sfx('derrumbe')   ~9 s: el vagón que se desarma. Rugido grave que crece,
//                               fierro que se queja y viento que entra cuando revientan los vidrios.
//   ctx.audio.sfx('flashbang')  ~6 s: el estallido y el pitido de oídos que queda.
import { ruido } from './synth.js';

const rnd = (a, b) => a + Math.random() * (b - a);

function nodos(ac) {
  const G = (dest, v = 0) => { const g = ac.createGain(); g.gain.value = v; g.connect(dest); return g; };
  const F = (dest, type, f, q = 0.7) => {
    const x = ac.createBiquadFilter();
    x.type = type; x.frequency.value = f; x.Q.value = q; x.connect(dest);
    return x;
  };
  const N = (dest, t0, t1, tipo = 'blanco') => {
    const s = ac.createBufferSource();
    s.buffer = ruido(ac, tipo); s.loop = true;
    s.connect(dest); s.start(t0, Math.random() * 1.5); s.stop(t1);
    return s;
  };
  return { G, F, N };
}

export function derrumbe(ac, salida, t) {
  const { G, F, N } = nodos(ac);
  const D = 9.2;
  // mezcla: medido offline llegaba a pico 1,13 sola y 1,47 con los golpes encima.
  // A 0,6 deja aire para los crujidos y los vidrios, que son el detalle.
  const out = G(salida, 0.6);
  // rugido: ruido marrón que crece, con un filtro que se abre
  const g = G(out, 0);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.25, t + 2.2);
  g.gain.exponentialRampToValueAtTime(0.75, t + 6.8);
  g.gain.exponentialRampToValueAtTime(0.0001, t + D);
  const lp = F(g, 'lowpass', 90, 0.9);
  lp.frequency.setValueAtTime(90, t);
  lp.frequency.exponentialRampToValueAtTime(420, t + 6.8);
  N(lp, t, t + D, 'marron');
  // el grave que se siente en el pecho (y su octava, para parlantes chicos)
  for (const [f, v] of [[34, 0.5], [51, 0.35], [68, 0.2]]) {
    const o = ac.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(f, t);
    o.frequency.linearRampToValueAtTime(f * 0.8, t + D);
    o.connect(G(g, v));
    o.start(t); o.stop(t + D);
  }
  // fierro que se queja: sierras graves que se doblan despacio
  for (let i = 0; i < 6; i++) {
    const t0 = t + 0.6 + i * 1.15 + rnd(0, 0.5);
    const dur = rnd(0.9, 1.8);
    const f = rnd(70, 190);
    const q = G(out, 0);
    q.gain.setValueAtTime(0.0001, t0);
    q.gain.linearRampToValueAtTime(0.1 + i * 0.03, t0 + dur * 0.4);
    q.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    const bp = F(q, 'bandpass', f * 4, 5);
    for (const des of [1, 1.013, 1.5]) {
      const o = ac.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f * des, t0);
      o.frequency.exponentialRampToValueAtTime(f * des * rnd(0.7, 1.35), t0 + dur);
      o.connect(bp);
      o.start(t0); o.stop(t0 + dur + 0.05);
    }
  }
  // viento: entra cuando revientan las ventanas y es todo lo que queda al caer
  const v = G(out, 0);
  v.gain.setValueAtTime(0.0001, t + 4.2);
  v.gain.exponentialRampToValueAtTime(0.3, t + 5.2);
  v.gain.exponentialRampToValueAtTime(0.6, t + 8.6);
  v.gain.exponentialRampToValueAtTime(0.0001, t + D);
  const bp = F(v, 'bandpass', 500, 0.8);
  bp.frequency.setValueAtTime(400, t + 4.2);
  bp.frequency.exponentialRampToValueAtTime(1700, t + 8.8);
  N(bp, t + 4.2, t + D);
  return D;
}

export function flashbang(ac, out, t) {
  const { G, F, N } = nodos(ac);
  const D = 6;
  // el golpe: ruido seco y un grave que cae
  const g = G(out, 0);
  // golpe a la mitad de lo que era: viene contra silencio total y con audífonos (pico medido 1,68)
  g.gain.setValueAtTime(0.5, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
  N(F(g, 'lowpass', 6000, 0.5), t, t + 0.4);
  const o = ac.createOscillator();
  o.frequency.setValueAtTime(120, t);
  o.frequency.exponentialRampToValueAtTime(28, t + 0.5);
  const og = G(out, 0);
  og.gain.setValueAtTime(0.45, t);
  og.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
  o.connect(og);
  o.start(t); o.stop(t + 0.65);
  // lo que queda: el pitido, que se va despacio
  const p = G(out, 0);
  p.gain.setValueAtTime(0.0001, t + 0.02);
  p.gain.linearRampToValueAtTime(0.085, t + 0.12);
  p.gain.exponentialRampToValueAtTime(0.02, t + 3);
  p.gain.exponentialRampToValueAtTime(0.0001, t + D);
  for (const f of [6830, 6871, 9120]) {
    const s = ac.createOscillator();
    s.frequency.value = f;
    s.connect(p);
    s.start(t); s.stop(t + D);
  }
  return D;
}
