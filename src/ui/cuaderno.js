// Cuaderno del vagón del Escolar: una hoja a la derecha donde se anotan los números de
// tiza que el jugador fotografía.
// - anotar(i): aparece la hoja y el número se escribe a mano (trazo animado); se va sola.
// - fijar(true): queda a la vista como apoyo (al llegar al teclado de la puerta).
// - mostrar(ms): la muestra un rato sin anotar nada (al reintentar el vagón).
// Vive en el HUD; destroy() al salir de la escena.
import './cuaderno.css';

const ROMANOS = ['I', 'II', 'III'];

export function createCuaderno(root, { code, seen }) {
  const el = document.createElement('div');
  el.className = 'cuaderno';
  el.innerHTML = `<div class="cu-tit">Cuaderno</div>${ROMANOS.map((r, i) =>
    `<div class="cu-fila" data-i="${i}"><span class="cu-rom">${r}</span><span class="cu-num">${seen[i] ? code[i] : ''}</span></div>`).join('')}
    <div class="cu-pie">el orden lo marcan las rayitas</div>`;
  root.appendChild(el);

  let fijo = false;
  let hasta = 0;
  let timer = 0;

  function refrescar() {
    const ver = fijo || performance.now() < hasta;
    el.classList.toggle('on', ver);
    clearTimeout(timer);
    if (!fijo && ver) timer = setTimeout(refrescar, hasta - performance.now() + 20);
  }

  return {
    anotar(i) {
      const fila = el.querySelector(`.cu-fila[data-i="${i}"]`);
      const num = fila.querySelector('.cu-num');
      num.textContent = code[i];
      fila.classList.remove('nuevo');
      void fila.offsetWidth; // reinicia la animación
      fila.classList.add('nuevo');
      hasta = Math.max(hasta, performance.now() + 3600);
      refrescar();
    },
    mostrar(ms = 3000) {
      hasta = Math.max(hasta, performance.now() + ms);
      refrescar();
    },
    fijar(on) {
      if (fijo === on) return;
      fijo = on;
      el.classList.toggle('apoyo', on);
      refrescar();
    },
    destroy() {
      clearTimeout(timer);
      el.remove();
    },
  };
}
