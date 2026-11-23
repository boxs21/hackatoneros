// Modo gráfico. Rama de prueba (Andy): "pintura" = look pictórico tipo óleo
// (claroscuro, bloom, rayos de luz, pétalos); "ps1" = el look original 320x240.
//   ?gfx=ps1 | pintura      fuerza el modo
//   ?calidad=baja | media | alta | auto
//   ?trazo=nitido | mezcla | oleo   cuánta pincelada y desenfoque (tecla V)
//   tecla G: cambia de modo en vivo (reinicia el momento)
const params = new URLSearchParams(location.search);
const KEY = 'fds:gfx';

function leer(nombre, validos, porDefecto, clave = nombre) {
  let v = params.get(nombre);
  if (!v) {
    try { v = localStorage.getItem(`${KEY}:${clave}`); } catch (err) { console.error('[gfx] config', err); }
  }
  return validos.includes(v) ? v : porDefecto;
}

export const GFX = {
  modo: leer('gfx', ['pintura', 'ps1'], 'pintura'),
  calidad: leer('calidad', ['auto', 'baja', 'media', 'alta'], 'auto'),
  trazo: leer('trazo', ['nitido', 'mezcla', 'oleo'], 'oleo', 'trazo2'), // por defecto borroso, como cuadro
  get on() { return this.modo === 'pintura'; },
  // menos movimiento de pantalla para quien lo pide en su sistema
  calma: matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
};

export function guardarGfx() {
  try {
    localStorage.setItem(`${KEY}:gfx`, GFX.modo);
    localStorage.setItem(`${KEY}:calidad`, GFX.calidad);
    localStorage.setItem(`${KEY}:trazo2`, GFX.trazo);
  } catch (err) { console.error('[gfx] config', err); }
}
