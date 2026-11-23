// Genera las voces de los personajes con la API de texto a voz de OpenAI.
// Uso:  node tools/voces.mjs            (solo las que faltan)
//       node tools/voces.mjs --todas    (regenera todas)
//       node tools/voces.mjs vendedor   (solo un personaje)
//
// La clave se lee de .env (OPENAI_API_KEY=sk-...). El .env NUNCA se sube al repo.
// Los archivos quedan en public/audio/ con el nombre que busca src/audio/audio.js:
//   voz-<personaje>-<slug del texto>.mp3   ->  ctx.audio.voz(personaje, texto)
// Si el texto de un diálogo cambia en el juego, hay que cambiarlo aquí también.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'audio');
const MODEL = 'gpt-4o-mini-tts';

// Mismo slug que src/audio/audio.js
const slug = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Lo que se dice en voz alta: sin "PERSONAJE:" ni acotaciones entre paréntesis.
const hablado = (t) => t.replace(/^[A-ZÁÉÍÓÚÑ ]+(\([^)]*\))?:\s*/, '').replace(/\([^)]*\)/g, '').trim();

const CHILE = 'Habla en español de Chile, con acento santiaguino natural y modismos chilenos. Nada de acento neutro ni español de España.';
const PERSONAJES = {
  escolar: { voz: 'shimmer', estilo: `${CHILE} Eres un niño de 11 años con uniforme de colegio, tímido y educado, un poco nervioso.` },
  oficinista: { voz: 'onyx', estilo: `${CHILE} Eres un oficinista de 40 años, agotado, sumiso con su jefe por teléfono, habla rápido y bajito.` },
  senora: { voz: 'sage', estilo: `${CHILE} Eres una señora de 65 años que vuelve de la feria, cariñosa pero quejumbrosa, voz cálida.` },
  vendedor: { voz: 'ash', estilo: `${CHILE} Eres un vendedor ambulante del metro, voz ronca y cantada, amable pero un poco inquietante.` },
  altavoz: { voz: 'echo', estilo: `${CHILE} Eres el altavoz del metro: voz monótona y formal de anuncio, como por parlante.` },
};

// [personaje, texto exacto que usa el juego, instrucción extra opcional]
const LINEAS = [
  ['escolar', 'ESCOLAR: Disculpe… ¿este tren para en Casa?'],
  ['escolar', 'ESCOLAR: Mi mamá me dijo que no me bajara antes. Que contara las estaciones.'],
  ['escolar', 'ESCOLAR: ¡Queda una pura estación pa’ Casa!', 'Contento y aliviado, como quien termina de contar.'],
  ['oficinista', 'OFICINISTA (al teléfono): Sí, jefe… No, jefe, ya salí. Voy en el metro.'],
  ['oficinista', 'OFICINISTA: Mañana a primera hora se lo mando. Sí. Sí, jefe.'],
  ['oficinista', 'OFICINISTA: ¿Aló? ¿Jefe? …Se cortó.'],
  ['senora', 'SEÑORA: Ay, mijo, cuidado con el carro, que llevo los tomates.'],
  ['senora', 'SEÑORA: Todos los días lo mismo… y nadie mira a nadie.'],
  ['senora', 'SEÑORA: ¿Qué fue eso?', 'Asustada, en voz baja.'],
  ['vendedor', 'VENDEDOR: ¡A luca, a luca los chocolates! ¡Lleve, lleve!'],
  ['vendedor', 'VENDEDOR: Usted tiene cara de cansado. Hágame caso…'],
  ['vendedor', 'VENDEDOR: No se quede dormido en este tramo. Aquí la gente se pierde.'],
  // Voz guía del vagón del Vendedor (en la oscuridad, la usa el audio espacial).
  ['vendedor', 'a-luca', 'Susurrado y lento, desde la oscuridad, repitiendo como un eco: «A luca… a luca… a luca los chocolates…»', 'A luca… a luca… a luca los chocolates…'],
  ['altavoz', 'ALTAVOZ: Próxima estación… Ca… sa… —', 'Con cortes, como si el parlante fallara al final.'],
];

function clave() {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
  const env = join(ROOT, '.env');
  if (existsSync(env)) {
    const m = readFileSync(env, 'utf8').match(/^OPENAI_API_KEY\s*=\s*["']?([^"'\s]+)/m);
    if (m) return m[1];
  }
  console.error('Falta OPENAI_API_KEY. Crea un archivo .env con: OPENAI_API_KEY=sk-...');
  process.exit(1);
}

const args = process.argv.slice(2);
const todas = args.includes('--todas');
const solo = args.filter((a) => !a.startsWith('--'));
const key = clave();
mkdirSync(OUT, { recursive: true });

let hechas = 0;
let fallas = 0;
for (const [personaje, texto, extra = '', decir] of LINEAS) {
  if (solo.length && !solo.includes(personaje)) continue;
  const archivo = join(OUT, `voz-${slug(personaje)}-${slug(texto)}.mp3`);
  if (!todas && existsSync(archivo)) continue;
  const p = PERSONAJES[personaje];
  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      voice: p.voz,
      input: decir ?? hablado(texto),
      instructions: `${p.estilo} ${extra}`.trim(),
      response_format: 'mp3',
    }),
  });
  if (!res.ok) {
    fallas += 1;
    console.error(`✗ ${personaje}: ${texto}\n  HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    if (res.status === 401) process.exit(1);
    continue;
  }
  writeFileSync(archivo, Buffer.from(await res.arrayBuffer()));
  hechas += 1;
  console.log(`✓ ${archivo.replace(ROOT + '/', '')}`);
}
console.log(`\nListo: ${hechas} voces nuevas${fallas ? `, ${fallas} con error` : ''}.`);
