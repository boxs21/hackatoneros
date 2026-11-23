// Modo gráfico. Rama de prueba (Andy): "pintura" = look pictórico tipo óleo
// (claroscuro, bloom, rayos de luz, pétalos); "ps1" = el look original 320x240.
//   ?gfx=ps1 | pintura      fuerza el modo
//   ?calidad=baja | media | alta | auto
//   tecla G: cambia de modo en vivo (reinicia el momento)
const params = new URLSearchParams(location.search);
const KEY = 'fds:gfx';

function leer(nombre, validos, porDefecto) {
  let v = params.get(nombre);
  if (!v) {
    try { v = localStorage.getItem(`${KEY}:${nombre}`); } catch (err) { console.error('[gfx] config', err); }
  }
  return validos.includes(v) ? v : porDefecto;
}

export const GFX = {
  modo: leer('gfx', ['pintura', 'ps1'], 'pintura'),
  calidad: leer('calidad', ['auto', 'baja', 'media', 'alta'], 'auto'),
  get on() { return this.modo === 'pintura'; },
  // menos movimiento de pantalla para quien lo pide en su sistema
  calma: matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
};

export function guardarGfx() {
  try {
    localStorage.setItem(`${KEY}:gfx`, GFX.modo);
    localStorage.setItem(`${KEY}:calidad`, GFX.calidad);
  } catch (err) { console.error('[gfx] config', err); }
}
