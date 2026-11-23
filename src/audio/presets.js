// ELECCIONES DE SONIDO. Dueño: Andy.
// Variante elegida para cada sonido que tiene opciones (ver synth.js).
// Se eligen escuchando en la Cabina de sonido y se pegan aquí.
export const PRESETS = {
  flash: 'A',
  multitud: 'A',
  frenazo: 'B',
  susto: 'A',
  vagon: 'C',
  tunel: 'B',
  casa: 'A',
};

// Mezcla general. master es el volumen final; el resto, cada grupo.
export const MEZCLA = {
  master: 0.9,
  sfx: 0.9,
  voz: 1,
  ambiente: 0.55,
  musica: 0.6,
};

// true: todas las voces pasan por el filtro de radio (si las grabaciones no convencen).
export const VOZ_RADIO = false;
