// Bus de eventos mínimo. Así los módulos se hablan sin importarse entre sí.
// Eventos estándar:
//   'state:enter' (id, data)   'state:exit' (id)
//   'hint' (texto)             'progress' ()
//   'flash' ()                 'restart' (id)
export function createEvents() {
  const map = new Map();
  return {
    on(name, fn) {
      if (!map.has(name)) map.set(name, new Set());
      map.get(name).add(fn);
      return () => map.get(name)?.delete(fn);
    },
    emit(name, ...args) {
      map.get(name)?.forEach((fn) => {
        try { fn(...args); } catch (err) { console.error(`[events] ${name}`, err); }
      });
    },
  };
}
