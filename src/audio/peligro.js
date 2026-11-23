// PELIGRO QUE SE OYE. Dueño: Andy.
// Una sola perilla, de 0 (solo) a 1 (lo tienes encima), y todo el cuerpo responde:
//   - corazón: de 58 a 160 pulsaciones, cada vez más fuerte; arriba de 0,85 se desordena
//   - respiración: de lenta a jadeo entrecortado, con un quejido al botar el aire
//   - susurros: bocas sin palabras que vienen DEL LADO donde está el más cercano
//   - grave del pecho: un zumbido bajo que crece (se siente más que se oye)
//   - pitido de oídos cuando ya es demasiado
//   - el mundo se apaga: el fondo se ensordece (lo hace audio.js con alMundo)
// El susto sube rápido y baja lento: el corazón no se calma de inmediato.
// Si nadie llama a nivel() por 0,3 s (cambio de escena, pausa), se apaga solo.
//
// Todo es Web Audio generado; los nodos largos se crean una vez. Lo único que se
// crea sobre la marcha son los golpes del corazón, desde un reloj propio (no en
// el update del juego).
import { ruido } from './synth.js';

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const rnd = (a, b) => a + Math.random() * (b - a);

export function crearPeligro(ac, salida, { alMundo } = {}) {
  const G = (dest, v = 0) => { const g = ac.createGain(); g.gain.value = v; g.connect(dest); return g; };
  const F = (dest, type, f, q = 0.7) => {
    const x = ac.createBiquadFilter();
    x.type = type; x.frequency.value = f; x.Q.value = q; x.connect(dest);
    return x;
  };
  const O = (dest, type, f) => { const o = ac.createOscillator(); o.type = type; o.frequency.value = f; o.connect(dest); o.start(); return o; };
  const N = (dest, tipo = 'blanco', rate = 1) => {
    const s = ac.createBufferSource();
    s.buffer = ruido(ac, tipo); s.loop = true; s.playbackRate.value = rate;
    s.connect(dest); s.start(0, Math.random() * 1.5);
    return s;
  };

  const NIVEL = 0.5; // mezcla: debajo del flash y del susto, que llegan juntos al limitador
  const out = G(salida, NIVEL);

  // corazón: cada golpe pasa por un filtro que se abre con el miedo
  const corazon = F(out, 'lowpass', 150, 0.8);

  // respiración: ruido por una "boca" (pasabanda) y un temblor que aparece arriba de 0,55
  const temblor = G(out, 1);
  const gResp = G(temblor, 0);
  const boca = F(gResp, 'bandpass', 900, 1.1);
  N(boca, 'blanco', 0.9);
  const hondo = G(temblor.gain, 0); // cuánto tiembla
  const lfo = O(hondo, 'sine', 11);
  // quejido: la voz que se escapa al botar el aire
  const gQuejido = G(out, 0);
  const garganta = F(gQuejido, 'bandpass', 520, 3);
  const cuerdas = O(garganta, 'sawtooth', 128);
  O(G(cuerdas.frequency, 4), 'sine', 5.3);

  // grave del pecho: dos senos casi iguales (baten) y ruido marrón
  const gGrave = G(out, 0);
  O(gGrave, 'sine', 41);
  O(gGrave, 'sine', 43.6);
  O(G(gGrave, 0.35), 'triangle', 82); // para que exista en parlantes de notebook
  N(F(G(gGrave, 0.6), 'lowpass', 90), 'marron');

  // pitido de oídos: sostenido (miedo alto) y el golpe que deja el flash de cerca
  const gPitido = G(out, 0);
  const gPitidoFlash = G(out, 0);
  for (const f of [7180, 7223, 9410]) { const o = O(gPitido, 'sine', f); o.connect(gPitidoFlash); }

  // susurros: ráfagas cortas de aire, desde el lado donde está el más cercano
  const gSusurros = G(out, 0);
  const lado = ac.createStereoPanner ? ac.createStereoPanner() : G(gSusurros, 1);
  if (ac.createStereoPanner) lado.connect(gSusurros);
  const nuca = F(lado, 'lowpass', 5200, 0.5); // detrás tuyo suena tapado
  const gRafaga = G(nuca, 0);
  const labios = F(gRafaga, 'bandpass', 2600, 3.5);
  N(labios, 'blanco', 1.3);

  let objetivo = 0; // lo que pide el juego
  let n = 0; // lo que siente el cuerpo
  let pan = 0;
  let detras = false;
  let ultima = -Infinity; // performance.now() de la última llamada a nivel()
  let antes = performance.now();
  let sigLatido = 0;
  let sigResp = 0;
  let sigSusurro = 0;
  let oleada = 0; // hasta cuándo los susurros responden al flash
  let mundo = -1;

  function latido(t, intervalo) {
    const vol = 0.2 + 0.95 * n;
    const golpe = (t0, f0, f1, v, dur) => {
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(v, t0 + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      g.connect(corazon);
      for (const [type, mult, amp] of [['sine', 1, 1], ['triangle', 2, 0.42]]) {
        const o = ac.createOscillator();
        o.type = type;
        o.frequency.setValueAtTime(f0 * mult, t0);
        o.frequency.exponentialRampToValueAtTime(f1 * mult, t0 + dur);
        const a = ac.createGain();
        a.gain.value = amp;
        o.connect(a).connect(g);
        o.start(t0);
        o.stop(t0 + dur + 0.03);
      }
      setTimeout(() => g.disconnect(), (t0 - ac.currentTime + dur) * 1000 + 250);
    };
    golpe(t, 66, 37, vol, 0.13);
    golpe(t + Math.min(0.3, intervalo * 0.36), 58, 34, vol * 0.62, 0.15);
  }

  function respirar(t, P) {
    const vol = 0.07 + 0.36 * n;
    const g = gResp.gain;
    const f = boca.frequency;
    // tomar aire: sube y se afina
    g.setValueAtTime(0.0001, t);
    g.linearRampToValueAtTime(vol, t + P * 0.3);
    g.linearRampToValueAtTime(vol * 0.12, t + P * 0.42);
    f.setValueAtTime(820, t);
    f.exponentialRampToValueAtTime(2000 + 700 * n, t + P * 0.36);
    // botarlo: más grave, más largo
    f.setValueAtTime(1150, t + P * 0.46);
    f.exponentialRampToValueAtTime(480, t + P * 0.95);
    g.linearRampToValueAtTime(vol * 0.85, t + P * 0.56);
    g.exponentialRampToValueAtTime(0.0001, t + P * 0.97);
    if (n > 0.7) {
      const q = 0.05 * (n - 0.7) / 0.3 * rnd(0.5, 1);
      gQuejido.gain.setValueAtTime(0.0001, t + P * 0.5);
      gQuejido.gain.linearRampToValueAtTime(q, t + P * 0.6);
      gQuejido.gain.exponentialRampToValueAtTime(0.0001, t + P * 0.9);
      cuerdas.frequency.setValueAtTime(rnd(150, 185), t + P * 0.5);
      cuerdas.frequency.exponentialRampToValueAtTime(rnd(108, 126), t + P * 0.9);
    }
  }

  function susurro(t, fuerza) {
    const dur = rnd(0.07, 0.26);
    labios.frequency.setValueAtTime(rnd(1700, 4300), t);
    gRafaga.gain.setValueAtTime(0.0001, t);
    gRafaga.gain.linearRampToValueAtTime(rnd(0.35, 1) * fuerza, t + dur * 0.3);
    gRafaga.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    return dur;
  }

  function quieto(t) {
    for (const p of [gResp.gain, gQuejido.gain, gRafaga.gain, gGrave.gain, gPitido.gain, gPitidoFlash.gain, gSusurros.gain, hondo.gain]) {
      p.cancelScheduledValues(t);
      p.setValueAtTime(0, t);
    }
    boca.frequency.cancelScheduledValues(t);
  }

  function tic() {
    const ahora = performance.now();
    const dt = Math.min(0.2, (ahora - antes) / 1000);
    antes = ahora;
    if (ac.state !== 'running') return;
    if (ahora - ultima > 300) objetivo = 0;
    n += (objetivo - n) * (1 - Math.exp(-dt / (objetivo > n ? 0.3 : 2.4)));
    const t = ac.currentTime;
    if (n < 0.004 && objetivo === 0) {
      if (n !== 0) { n = 0; quieto(t); }
      if (mundo !== 0) { mundo = 0; alMundo?.(0); }
      return;
    }
    // lo continuo
    corazon.frequency.setTargetAtTime(120 + 190 * n, t, 0.1);
    gGrave.gain.setTargetAtTime(0.36 * n ** 1.5, t, 0.2);
    gPitido.gain.setTargetAtTime(0.045 * (clamp((n - 0.55) / 0.45) ** 2), t, 0.25);
    gSusurros.gain.setTargetAtTime(0.5 * n ** 1.3, t, 0.12);
    hondo.gain.setTargetAtTime(0.6 * clamp((n - 0.55) / 0.45), t, 0.2);
    lfo.frequency.setTargetAtTime(9 + 6 * n, t, 0.3);
    if (lado.pan) lado.pan.setTargetAtTime(clamp(pan, -1, 1), t, 0.07);
    nuca.frequency.setTargetAtTime(detras ? 1300 : 5200, t, 0.1);
    if (Math.abs(n - mundo) > 0.01) { mundo = n; alMundo?.(n); }

    const hasta = t + 0.12;
    // corazón
    if (sigLatido < t - 0.5) sigLatido = t + 0.03;
    while (sigLatido < hasta) {
      const bpm = 58 + 102 * n ** 1.15;
      let intervalo = 60 / bpm;
      if (n > 0.85) intervalo *= rnd(0.86, 1.1); // se desordena
      if (n > 0.05) latido(Math.max(sigLatido, t + 0.005), intervalo);
      sigLatido += intervalo;
    }
    // respiración
    if (sigResp < t - 0.5) sigResp = t + 0.05;
    while (sigResp < hasta) {
      const P = Math.max(1.02, 4.4 - 3.5 * n) * rnd(0.94, 1.06);
      if (n > 0.1) respirar(Math.max(sigResp, t + 0.01), P);
      sigResp += P;
    }
    // susurros
    if (sigSusurro < t - 0.5) sigSusurro = t + 0.05;
    while (sigSusurro < hasta) {
      const enOleada = t < oleada;
      const dur = susurro(Math.max(sigSusurro, t + 0.01), enOleada ? 1.8 : 1);
      sigSusurro += dur + 0.02 + rnd(0.05, 0.5) * (enOleada ? 0.25 : 1.35 - n);
    }
  }
  const reloj = setInterval(tic, 40);

  return {
    // Lo llama el juego en cada cuadro. pan: -1 izquierda … 1 derecha; detras: está a tu espalda.
    nivel(v, opts = {}) {
      objetivo = clamp(Number(v) || 0);
      pan = opts.pan ?? 0;
      detras = Boolean(opts.detras);
      ultima = performance.now();
    },
    get valor() { return Math.max(n, objetivo); },
    get activa() { return performance.now() - ultima < 500; },
    // El flash de cerca: te deja un pitido, un golpe en el pecho y ELLOS contestan.
    destello(cerca) {
      if (ac.state !== 'running') return;
      const t = ac.currentTime;
      const c = clamp(cerca);
      if (c > 0.3) {
        gPitidoFlash.gain.cancelScheduledValues(t);
        gPitidoFlash.gain.setValueAtTime(0.0001, t);
        gPitidoFlash.gain.linearRampToValueAtTime(0.07 * c, t + 0.012);
        gPitidoFlash.gain.exponentialRampToValueAtTime(0.0001, t + 0.9 + 1.3 * c);
        oleada = t + 0.5 + c;
        n = Math.max(n, c * 0.75); // el flash te asusta a ti también
      }
      if (c > 0.55) {
        const g = ac.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.7 * c, t + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
        g.connect(out);
        const o = ac.createOscillator();
        o.frequency.setValueAtTime(90, t);
        o.frequency.exponentialRampToValueAtTime(30, t + 0.5);
        o.connect(g);
        o.start(t);
        o.stop(t + 0.65);
        setTimeout(() => g.disconnect(), 900);
      }
    },
    // Corte seco (apagón, cambio de escena).
    callar() {
      objetivo = 0;
      n = 0;
      ultima = -Infinity;
      oleada = 0;
      const t = ac.currentTime;
      quieto(t);
      out.gain.cancelScheduledValues(t);
      out.gain.setValueAtTime(0, t);
      out.gain.setValueAtTime(NIVEL, t + 0.35); // deja morir los golpes ya lanzados
      mundo = 0;
      alMundo?.(0);
    },
    destruir() { clearInterval(reloj); out.disconnect(); },
  };
}
