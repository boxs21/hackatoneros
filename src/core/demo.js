// Modo demo para presentar: agrega ?demo=1 a la URL.
//   1–8  saltar a cada momento      N  siguiente
//   R    reiniciar el momento        H  mostrar/ocultar este panel
export const DEMO = new URLSearchParams(location.search).has('demo');

export function setupDemo(ctx) {
  if (!DEMO) return { update() {} };

  const panel = document.createElement('div');
  panel.id = 'demo-hud';
  document.body.appendChild(panel);

  addEventListener('keydown', (e) => {
    const m = /^Digit([1-9])$/.exec(e.code);
    if (m) {
      const id = ctx.fsm.ids[Number(m[1]) - 1];
      if (id) ctx.go(id, {}, { fade: true });
      return;
    }
    if (e.code === 'KeyN') ctx.next();
    if (e.code === 'KeyR') ctx.restart();
    if (e.code === 'KeyH') panel.hidden = !panel.hidden;
  });

  let acc = 0;
  let frames = 0;
  let fps = 0;
  return {
    update(dt) {
      acc += dt;
      frames += 1;
      if (acc < 0.5) return;
      fps = Math.round(frames / acc);
      acc = 0;
      frames = 0;
      const i = ctx.fsm.ids.indexOf(ctx.fsm.current) + 1;
      panel.textContent =
        `DEMO · ${i} ${ctx.fsm.current} · ${ctx.fsm.timeInState.toFixed(0)} s · ${fps} fps\n` +
        `1–8 saltar · N siguiente · R reiniciar · H ocultar`;
    },
  };
}
