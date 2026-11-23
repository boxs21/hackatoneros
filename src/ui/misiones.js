// Lista de misiones arriba a la derecha: discreta, para orientar sin romper la inmersión.
// - Al entrar a un momento se muestra completa unos segundos y después queda solo la misión actual.
// - Mantener Tab la muestra completa.
// - Se oculta en el inicio, el apagón y el final.
// Una escena puede cambiar el texto actual con ctx.misiones.set('…') o volver al de base con set(null).
const ORDEN = [
  ['horaPunta', 'Abrirte paso hasta el fondo del vagón'],
  ['losCinco', 'Quedarte con los otros cuatro'],
  ['borrados', 'Llegar a la luz roja del fondo a oscuras'],
  ['vagonEscolar', 'Encontrar los 3 números de tiza y marcarlos en la puerta'],
  ['vagonOficinista', 'Cruzar el vagón roto saltando entre los pedazos'],
  ['vagonVendedor', 'Seguir la voz del Vendedor'],
];
const OCULTO = new Set(['inicio', 'apagon', 'final']);

export function createMisiones(root, events) {
  const box = document.createElement('div');
  box.className = 'hud-misiones';
  box.setAttribute('aria-live', 'polite');
  root.appendChild(box);

  let actual = -1;
  let texto = null;
  let abierto = false;
  let timer = 0;

  function render() {
    if (actual < 0) { box.classList.remove('on'); return; }
    box.classList.add('on');
    box.classList.toggle('abierto', abierto);
    box.innerHTML = '<div class="mis-head">L23 → Casa</div>' + ORDEN.slice(0, actual + 1).map(([, t], i) => {
      const hecho = i < actual;
      return `<div class="mis ${hecho ? 'hecho' : 'ahora'}"><i></i>${hecho ? t : (texto ?? t)}</div>`;
    }).join('');
  }

  function abrir(ms = 5000) {
    abierto = true;
    render();
    clearTimeout(timer);
    timer = setTimeout(() => { abierto = false; render(); }, ms);
  }

  events.on('state:enter', (id) => {
    texto = null;
    actual = OCULTO.has(id) ? -1 : ORDEN.findIndex(([s]) => s === id);
    if (actual >= 0) abrir();
    else render();
  });

  addEventListener('keydown', (e) => {
    if (e.code !== 'Tab' || actual < 0) return;
    e.preventDefault();
    clearTimeout(timer);
    abierto = true;
    render();
  });
  addEventListener('keyup', (e) => {
    if (e.code !== 'Tab' || actual < 0) return;
    abierto = false;
    render();
  });

  return {
    set(t) {
      texto = t;
      if (actual >= 0) abrir(3500);
    },
  };
}
