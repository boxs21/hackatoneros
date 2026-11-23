// Atajos de escena del modo pintura (rama de prueba).
// El selector de escenas vive en el menú (panel ESCENAS, src/menu/menu.js; Esc vuelve al menú).
// Aquí solo queda lo que sirve para probar gráficos sin pasar por él:
//   [  y  ]             escena anterior / siguiente
//   ?escena=borrados    (o ?escena=5) parte directo en esa escena
// Tab no se usa: es de la lista de misiones (src/ui/misiones.js).
export function createEscenas(ctx) {
  const ids = ctx.fsm.ids;
  function mover(d) {
    const i = ids.indexOf(ctx.fsm.current);
    ctx.go(ids[(i + d + ids.length) % ids.length]);
  }
  addEventListener('keydown', (e) => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code === 'BracketLeft') mover(-1);
    if (e.code === 'BracketRight') mover(1);
  });

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
