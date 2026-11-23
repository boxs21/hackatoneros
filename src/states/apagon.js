// 3 · Apagón: frenazo, negro total y silencio seco. Dueño: Valentín (sonido: Andy).
// Corte instantáneo, sin fundido: el silencio es el arma principal.
const CUT_AT = 0.8; // s después del frenazo
const DARK_FOR = 4.2; // s de negro y silencio antes de "Los cinco"
const PIENSA_AT = 1.6; // s después del corte: el jugador se da cuenta de que necesita la cámara

let t = 0;
let cutDone = false;
let penso = false;

export default {
  id: 'apagon',
  next: 'losCinco',
  autoAdvance: false,
  enter(ctx) {
    t = 0;
    cutDone = false;
    penso = false;
    ctx.audio.sfx('frenazo');
  },
  update(dt, ctx) {
    t += dt;
    if (!cutDone && t > CUT_AT) {
      cutDone = true;
      ctx.fader.cut();
      ctx.audio.silencio();
    }
    if (cutDone && !penso && t > CUT_AT + PIENSA_AT) {
      penso = true;
      ctx.hud.subtitle('¿Qué rayos…? No veo nada. Necesito mi cámara.', 2600);
    }
    if (t > CUT_AT + DARK_FOR) ctx.go(this.next, {}, { fade: false });
  },
  exit(ctx) {
    ctx.fader.clear(400);
  },
};
