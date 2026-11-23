import './sinBateria.css';

// CELULAR SIN BATERÍA (hora punta). Dueño: Renato.
// «Sacas el celular para avisarle a tu mamá… Oh. Sin batería.»
// Sube tu celular desde abajo, aparece «Mamá», tocas llamar, la pila vacía
// parpadea en rojo, la pantalla se apaga y el celular baja. Unos 3,6 s.
// Lo dispara hud.subtitle() cuando el texto dice «sin batería».

const MS = 3600;

export function createSinBateria(root, { audio } = {}) {
  const el = document.createElement('div');
  el.className = 'sb';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `
    <div class="sb-phone">
      <div class="sb-screen">
        <div class="sb-call">
          <span class="sb-time">18:04</span>
          <span class="sb-avatar">M</span>
          <b>Mamá</b>
          <i class="sb-btn"></i>
        </div>
        <div class="sb-empty"><span class="sb-batt"><span></span></span><small>0%</small></div>
      </div>
      <i class="sb-thumb"></i>
    </div>`;
  root.append(el);

  let timers = [];
  function stop() {
    timers.forEach(clearTimeout);
    timers = [];
    el.className = 'sb';
  }
  function at(ms, fn) {
    timers.push(setTimeout(() => {
      try { fn(); } catch (err) { console.error('[sinBateria]', err); }
    }, ms));
  }

  return {
    play() {
      stop();
      void el.offsetWidth; // reinicia las animaciones
      el.classList.add('on'); // sube con la pantalla encendida: «Mamá»
      at(1150, () => { el.classList.add('tap'); audio?.sfx?.('ui'); }); // el dedo toca llamar
      at(1450, () => el.classList.add('empty')); // la pila vacía parpadea
      at(2650, () => el.classList.add('dead')); // se apaga
      at(3000, () => el.classList.add('down')); // y lo guardas
      at(MS, stop);
    },
    stop,
  };
}
