// El flash del celular. F dispara; 120 ms de luz plena y un apagado rápido.
// level(now) da 0..1 para la luz; glow(now) es la "imagen retenida" que dura
// un poco más y deja ver dónde estaban los borrados.
export function createFlash({ onFire, duration = 120, cooldown = 600 } = {}) {
  let lastFlash = -Infinity;
  let count = 0;

  return {
    get count() { return count; },
    get ready() { return performance.now() - lastFlash >= cooldown; },
    fire(now = performance.now()) {
      if (now - lastFlash < cooldown) return false;
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
