// Atajos de escena (rama de prueba): para no jugar todo cada vez.
//   Tab            abre o cierra el selector (después 1–9 o click)
//   [  y  ]        escena anterior / siguiente
//   ?escena=borrados   (o ?escena=5) parte directo en esa escena
const NOMBRES = {
  inicio: 'Menú',
  horaPunta: 'Hora punta',
  apagon: 'El apagón',
  losCinco: 'Los cinco',
  borrados: 'Los borrados',
  vagonEscolar: 'Vagón del escolar',
  vagonVendedor: 'Vagón del vendedor',
  final: 'Final',
  vagonOficinista: 'Vagón del oficinista',
};

export function createEscenas(ctx) {
  const ids = ctx.fsm.ids;
  const panel = document.createElement('div');
  panel.id = 'gfx-escenas';
  panel.innerHTML = `<p>Escenas</p>${ids.map((id, i) =>
    `<button type="button" data-id="${id}"><kbd>${i + 1}</kbd>${NOMBRES[id] || id}</button>`).join('')}
    <small>Tab cerrar · [ ] anterior / siguiente · G gráficos · V trazo</small>`;
  document.body.appendChild(panel);

  const abierto = () => panel.classList.contains('on');
  function mostrar(si) {
    panel.classList.toggle('on', si);
    if (si) {
      document.exitPointerLock?.();
      panel.querySelectorAll('button').forEach((b) => b.classList.toggle('ahora', b.dataset.id === ctx.fsm.current));
    }
  }
  function ir(id) {
    if (!ids.includes(id)) return;
    mostrar(false);
    ctx.go(id);
  }
  function mover(d) {
    const i = ids.indexOf(ctx.fsm.current);
    ir(ids[(i + d + ids.length) % ids.length]);
  }

  panel.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) ir(b.dataset.id);
  });
  // en captura: con el selector abierto, los números son solo para elegir escena
  addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code === 'Tab') {
      e.preventDefault();
      if (!e.repeat) mostrar(!abierto());
      return;
    }
    if (abierto()) {
      const m = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
      if (m || e.code === 'Escape') {
        e.stopImmediatePropagation();
        e.preventDefault();
        if (m) ir(ids[Number(m[1]) - 1]);
        else mostrar(false);
      }
      return;
    }
    if (e.repeat) return;
    if (e.code === 'BracketLeft') mover(-1);
    if (e.code === 'BracketRight') mover(1);
  }, true);

  // partir directo en una escena
  let pedida = new URLSearchParams(location.search).get('escena');
  try { // al cambiar de gráficos (G) se recarga y se vuelve a la misma escena
    const guardada = sessionStorage.getItem('fds:escena');
    sessionStorage.removeItem('fds:escena');
    if (guardada && guardada !== 'inicio') pedida = guardada;
  } catch (err) { console.error('[escenas] sesión', err); }
  if (pedida) {
    const id = ids.includes(pedida) ? pedida : ids[Number(pedida) - 1];
    if (id) setTimeout(() => ctx.go(id, {}, { fade: false }), 0);
    else console.error(`[escenas] no existe la escena "${pedida}". Opciones: ${ids.join(', ')}`);
  }
}
