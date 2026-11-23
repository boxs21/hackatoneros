// 3 · Apagón: frenazo, negro total y silencio seco. Dueño: Valentín (sonido: Andy).
// Corte instantáneo, sin fundido: el silencio es el arma principal.
const CUT_AT = 0.8; // s después del frenazo
const DARK_FOR = 3; // s de negro y silencio antes de "Los cinco"

let t = 0;
let cutDone = false;

export default {
  id: 'apagon',
  next: 'losCinco',
  autoAdvance: false,
  enter(ctx) {
    t = 0;
    cutDone = false;
    ctx.audio.sfx('frenazo');
  },
  update(dt, ctx) {
    t += dt;
    if (!cutDone && t > CUT_AT) {
      cutDone = true;
      ctx.fader.cut();
      ctx.audio.silencio();
    }
    if (t > CUT_AT + DARK_FOR) ctx.go(this.next, {}, { fade: false });
  },
  exit(ctx) {
    ctx.fader.clear(400);
  },
};
