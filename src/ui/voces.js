// Qué subtítulos tienen voz grabada o generada en public/audio/.
// Un subtítulo "ESCOLAR: Hola" busca voz-escolar-<slug del texto completo>.
// Uno sin "PERSONAJE:" es del narrador (o de la multitud): voz-narrador-<slug>.
// Los archivos se generan con: node tools/voces.mjs
const archivos = import.meta.glob('/public/audio/voz-*.{ogg,mp3,wav,m4a}', { query: '?url', import: 'default' });
const HAY = new Set(Object.keys(archivos).map((r) => r.split('/').pop().replace(/\.\w+$/, '').toLowerCase()));

export const slug = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const QUIEN = { ESCOLAR: 'escolar', OFICINISTA: 'oficinista', 'SEÑORA': 'senora', VENDEDOR: 'vendedor', ALTAVOZ: 'altavoz' };

export function vozDe(texto) {
  if (!texto || texto.includes('[')) return null; // instrucciones de teclas: sin voz
  const m = /^([A-ZÁÉÍÓÚÑ]+)[\s(:]/.exec(texto);
  const personaje = (m && QUIEN[m[1]]) || 'narrador';
  if (!HAY.has(`voz-${personaje}-${slug(texto)}`)) {
    if (import.meta.env.DEV) console.debug('[voces] sin voz:', personaje, texto);
    return null;
  }
  return { personaje, frase: texto };
}
