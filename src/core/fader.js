// Fundido a negro para transiciones y reinicio instantáneo.
// Total por defecto: 120 + 60 + 260 = 440 ms (la regla es menos de 1 s).
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export function createFader(el) {
  let busy = false;

  function to(opacity, ms) {
    el.style.transition = `opacity ${ms}ms linear`;
    el.style.opacity = String(opacity);
    return wait(ms);
  }

  return {
    get busy() { return busy; },
    // Pasa a negro, ejecuta fn con la pantalla tapada y vuelve.
    async blackout(fn, { out = 120, hold = 60, back = 260 } = {}) {
      if (busy) return false;
      busy = true;
      try {
        await to(1, out);
        fn();
        await wait(hold);
        await to(0, back);
      } finally {
        busy = false;
      }
      return true;
    },
    // Negro inmediato, sin fundido (el apagón).
    cut() { el.style.transition = 'none'; el.style.opacity = '1'; },
    clear(ms = 0) { return to(0, ms); },
  };
}
