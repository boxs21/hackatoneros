import './llamada.css';

// EL CELULAR DEL OFICINISTA Y LA LLAMADA A TU MAMÁ (hora punta). Dueño: Renato.
// Sigue el guion de states/horaPunta.js; lo disparan los subtítulos (ui/hud.js):
//  1. «Tome. Tiene cámara y flash…»  -> recibir(): su mano te pasa el celular.
//  2. «Marcas el número de tu mamá…» -> marcar(): tecleas, «Llamando… Mamá».
//  3. «ALTAVOZ: Próxima estación…»   -> cortar(): estática, «SIN SEÑAL».
// El apagón (cambio de estado) lo apaga todo con hud.clear() -> stop().

const NUMERO = '+56 9 8423 1704';

export function createLlamada(root, { audio } = {}) {
  const el = document.createElement('div');
  el.className = 'll';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `
    <div class="ll-phone">
      <i class="ll-sleeve"></i>
      <div class="ll-screen">
        <div class="ll-bar"><span>18:06</span><span class="ll-signal"><i></i><i></i><i></i><i></i></span></div>
        <div class="ll-home"><b>18:06</b><small>LÍNEA 23 · RUMBO A CASA</small></div>
        <div class="ll-call">
          <span class="ll-avatar">M<i></i><i></i></span>
          <b>Mamá</b>
          <span class="ll-num"></span>
          <span class="ll-state"></span>
          <i class="ll-hang"></i>
        </div>
        <div class="ll-lost"><canvas width="40" height="64"></canvas><b>SIN SEÑAL</b></div>
      </div>
    </div>`;
  root.append(el);
  const num = el.querySelector('.ll-num');
  const state = el.querySelector('.ll-state');
  const noise = el.querySelector('.ll-lost canvas').getContext('2d');
  const img = noise.createImageData(40, 64);

  let timers = [];
  let raf = 0;
  const at = (ms, fn) => timers.push(setTimeout(() => {
    try { fn(); } catch (err) { console.error('[llamada]', err); }
  }, ms));

  function stop() {
    timers.forEach(clearTimeout);
    timers = [];
    cancelAnimationFrame(raf);
    raf = 0;
    el.className = 'll';
  }
  function mode(...cls) {
    el.className = `ll ${cls.join(' ')}`;
  }
  function staticLoop() {
    const px = img.data;
    for (let i = 0; i < px.length; i += 4) {
      const v = Math.random() < .5 ? 25 : 190;
      px[i] = px[i + 1] = px[i + 2] = v;
      px[i + 3] = 255;
    }
    noise.putImageData(img, 0, 0);
    raf = requestAnimationFrame(staticLoop);
  }

  return {
    // 1. La mano del Oficinista entra por la izquierda y te deja el celular.
    recibir() {
      stop();
      void el.offsetWidth;
      mode('give');
      at(1300, () => mode('give', 'mine')); // ya es tuyo: su mano se va
      at(3300, () => mode('mine', 'down')); // lo bajas mientras sale el aviso
      at(3900, stop);
    },
    // 2. Lo subes, marcas y queda llamando hasta que algo lo corte.
    marcar() {
      stop();
      num.textContent = '';
      state.textContent = '';
      void el.offsetWidth;
      mode('mine', 'up', 'dial');
      let n = 0;
      const tecla = () => {
        n += 1;
        num.textContent = NUMERO.slice(0, n);
        if (NUMERO[n - 1] !== ' ') audio?.sfx?.('ui', { volume: .25 });
        if (n < NUMERO.length) at(70, tecla);
        else at(250, () => { state.textContent = 'Llamando…'; mode('mine', 'up', 'dial', 'ring'); });
      };
      at(450, tecla);
      at(20000, stop); // por si nada lo corta
    },
    // 3. El altavoz se corta y la llamada también.
    cortar() {
      if (!el.classList.contains('up')) return; // solo si estaba llamando
      timers.forEach(clearTimeout);
      timers = [];
      mode('mine', 'up', 'lost');
      staticLoop();
      at(20000, stop);
    },
    stop,
  };
}
