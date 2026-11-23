import * as THREE from 'three';

// Cada momento del juego es un estado (ver src/states/).
// Contrato de un estado:
//   {
//     id: 'horaPunta',
//     next: 'apagon',          // a dónde va ctx.next() y el avance automático
//     hint: 'Texto de pista',  // opcional, aparece a los 30 s sin progreso
//     autoAdvance: true,       // opcional, a los 90 s sin progreso pasa a next
//     enter(ctx, data) {},     // armar escena en ctx.stage
//     update(dt, ctx) {},
//     exit(ctx) {},            // opcional; ctx.stage se limpia solo
//   }
// Todo lo 3D del estado va dentro de ctx.stage: al salir o reiniciar
// se saca de la escena y se libera, así el reinicio queda limpio.
export function createStateMachine(ctx, states) {
  const byId = new Map(states.map((s) => [s.id, s]));
  let current = null;
  let currentData = {};
  let enteredAt = 0;

  function disposeStage() {
    const stage = ctx.stage;
    if (!stage) return;
    ctx.scene.remove(stage);
    stage.traverse((o) => {
      o.geometry?.dispose?.();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      mats.forEach((m) => { m.map?.dispose?.(); m.dispose?.(); });
    });
    ctx.stage = null;
  }

  function enter(id, data = {}) {
    const state = byId.get(id);
    if (!state) {
      console.error(`[fsm] estado desconocido: ${id}`);
      return;
    }
    if (current) {
      try { current.exit?.(ctx); } catch (err) { console.error(`[fsm] exit ${current.id}`, err); }
      ctx.events.emit('state:exit', current.id);
    }
    disposeStage();
    ctx.stage = new THREE.Group();
    ctx.stage.name = `stage:${id}`;
    ctx.scene.add(ctx.stage);

    current = state;
    currentData = data;
    enteredAt = performance.now();
    ctx.events.emit('state:enter', id, data);
    try { state.enter?.(ctx, data); } catch (err) { console.error(`[fsm] enter ${id}`, err); }
  }

  return {
    ids: states.map((s) => s.id),
    get current() { return current?.id ?? null; },
    get state() { return current; },
    get data() { return currentData; },
    get timeInState() { return (performance.now() - enteredAt) / 1000; },
    enter,
    update(dt) {
      if (!current?.update) return;
      try { current.update(dt, ctx); } catch (err) { console.error(`[fsm] update ${current.id}`, err); }
    },
  };
}
