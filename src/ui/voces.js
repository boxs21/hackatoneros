// Voces estilo murmullo (como Undertale o Animal Crossing): cada subtítulo suena
// con sílabas sin palabras, con el tono de quien habla. Lo genera el motor de Andy
// (habla() en src/audio/synth.js), así que no hay archivos de voz.
//   "ESCOLAR: Hola…"  -> tono del escolar     sin prefijo -> narrador (más bajo y suave)
const QUIEN = { ESCOLAR: 'escolar', OFICINISTA: 'oficinista', 'SEÑORA': 'senora', VENDEDOR: 'vendedor', ALTAVOZ: 'altavoz' };
const EXTRA = {
  narrador: { tono: 135, volume: 0.45 },
  altavoz: { tono: 105, volume: 0.8, radio: true },
};

export function murmullo(texto) {
  if (!texto || texto.includes('[')) return null; // instrucciones de teclas: sin voz
  const m = /^([A-ZÁÉÍÓÚÑ]+)[^:]*:\s*/.exec(texto);
  const personaje = (m && QUIEN[m[1]]) || 'narrador';
  const dicho = m && QUIEN[m[1]] ? texto.slice(m[0].length) : texto;
  const letras = dicho.replace(/\([^)]*\)/g, '').replace(/[^\p{L}\p{N}]/gu, '').length;
  if (!letras) return null;
  const silabas = Math.max(2, Math.min(16, Math.round(letras / 4.5)));
  return { personaje, opts: { silabas, ...EXTRA[personaje] } };
}
