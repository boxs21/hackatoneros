// "Fallar no duele": pista a los 30 s y avance automático a los 90 s
// sin progreso. El estado llama ctx.progress() cada vez que el jugador
// avanza de verdad (resolvió algo, llegó a un punto) y el reloj vuelve a 0.
export const HINT_AFTER = 30;
export const ADVANCE_AFTER = 90;

export function createHelp(ctx) {
  let idle = 0;
  let hinted = false;

  const reset = () => { idle = 0; hinted = false; };
  ctx.events.on('state:enter', reset);
  ctx.events.on('progress', reset);

  return {
    reset,
    update(dt) {
      const state = ctx.fsm.state;
      if (!state || ctx.paused) return;
      idle += dt;
      if (!hinted && state.hint && idle >= HINT_AFTER) {
        hinted = true;
        ctx.events.emit('hint', state.hint);
      }
      if (state.autoAdvance && state.next && idle >= ADVANCE_AFTER) {
        reset();
        ctx.go(state.next);
      }
    },
  };
}
