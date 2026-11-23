// El flash del celular. F dispara; 120 ms de luz plena y un apagado rápido.
// level(now) da 0..1 para la luz; glow(now) es la "imagen retenida" que dura
// un poco más y deja ver dónde estaban los borrados.
//
// Seguridad (DISENO.md, obligatorio): como máximo 3 destellos por segundo
// (espera mínima 0,6 s) y, al 4.º flash seguido (menos de 1,5 s entre uno y
// otro), el flash se "recalienta" y la espera sube a 1,5 s. El límite está en
// el código, no en la buena voluntad del jugador.
export const COOLDOWN = 600;
export const OVERHEAT_COOLDOWN = 1500;
const STREAK_GAP = 1500;
const STREAK_LIMIT = 4;

export function createFlash({ onFire, duration = 120, cooldown = COOLDOWN } = {}) {
  let lastFlash = -Infinity;
  let count = 0;
  let streak = 0;
  let wait = cooldown;

  return {
    get count() { return count; },
    get ready() { return performance.now() - lastFlash >= wait; },
    get overheated() { return wait > cooldown && performance.now() - lastFlash < wait; },
    fire(now = performance.now()) {
      if (now - lastFlash < wait) return false;
      streak = now - lastFlash < STREAK_GAP ? streak + 1 : 1;
      wait = streak >= STREAK_LIMIT ? OVERHEAT_COOLDOWN : cooldown;
      if (streak >= STREAK_LIMIT) streak = 0;
      lastFlash = now;
      count += 1;
      onFire?.(count);
      return true;
    },
    isVisible(now = performance.now()) {
      return now - lastFlash < duration;
    },
    level(now = performance.now()) {
      const t = now - lastFlash;
      if (t < duration) return 1;
      return Math.max(0, Math.exp(-(t - duration) / 55) - .02);
    },
    glow(now = performance.now()) {
      const t = (now - lastFlash) / 1000;
      return t < 0 ? 0 : Math.max(0, 1 - t / 1.1);
    },
    since(now = performance.now()) {
      return (now - lastFlash) / 1000;
    },
  };
}
