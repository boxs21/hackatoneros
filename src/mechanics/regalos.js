// Lo que te entrega cada pasajero en hora punta y para qué sirve después.
// Queda en ctx.memoria.regalos = { celular: true, … } y se muestra arriba a la izquierda.
// Si se entra directo a una escena (modo demo), se asume que te dieron todo.
export const REGALOS = {
  Escolar: {
    id: 'llavero',
    nombre: 'Llavero con luz',
    de: 'del escolar',
    uso: 'alumbra tus pies a oscuras',
    linea: 'ESCOLAR: Tome, mi llavero con luz. Es pa’ no perderse… yo tengo otro.',
  },
  Oficinista: {
    id: 'celular',
    nombre: 'Celular',
    de: 'del oficinista',
    uso: '[F] flash',
    linea: 'OFICINISTA: ¿Me tiene el celular un ratito? Úselo no más, tiene linterna.',
  },
  Señora: {
    id: 'estampita',
    nombre: 'Estampita',
    de: 'de la señora',
    uso: 'te salva una vez',
    linea: 'SEÑORA: Llévese esta estampita, mijo. A mí siempre me ha cuidado.',
  },
  Vendedor: {
    id: 'chocolate',
    nombre: 'Chocolate',
    de: 'del vendedor',
    uso: '[E] tirarlo para que se alejen',
    linea: 'VENDEDOR: Tome igual, este va por la casa. Guárdelo pa’ cuando lo necesite.',
  },
};

const ORDEN = ['Oficinista', 'Escolar', 'Señora', 'Vendedor'];
const VISIBLE = new Set(['horaPunta', 'borrados']);
const TODOS = { celular: true, llavero: true, estampita: true, chocolate: true };

let box = null;
let usados = new Set();

function montar(ctx) {
  if (box) return;
  box = document.createElement('div');
  box.setAttribute('aria-live', 'polite');
  box.style.cssText = 'position:absolute;left:2.5%;top:3%;max-width:38%;'
    + 'font-size:clamp(10px,1.15vw,13px);line-height:1.4;color:rgba(235,238,245,.85);'
    + 'text-shadow:0 1px 3px #000;opacity:0;transition:opacity .4s;';
  document.getElementById('hud')?.appendChild(box);
  ctx.events.on('state:enter', (id) => {
    if (!VISIBLE.has(id)) box.style.opacity = '0';
  });
}

function pintar(ctx) {
  const tengo = ctx.memoria.regalos || {};
  box.textContent = '';
  for (const quien of ORDEN) {
    const r = REGALOS[quien];
    if (!tengo[r.id]) continue;
    const fila = document.createElement('div');
    const gastado = usados.has(r.id);
    fila.textContent = `▪ ${r.nombre} ${r.de} · ${r.uso}`;
    if (gastado) fila.style.cssText = 'opacity:.4;text-decoration:line-through;';
    box.appendChild(fila);
  }
  box.style.opacity = box.childElementCount ? '.85' : '0';
}

// Hora punta parte sin nada: reiniciar = true vacía los bolsillos.
export function mostrarRegalos(ctx, { reiniciar = false } = {}) {
  montar(ctx);
  if (reiniciar) ctx.memoria.regalos = {};
  else if (!ctx.memoria.regalos) ctx.memoria.regalos = { ...TODOS };
  usados = new Set();
  pintar(ctx);
}

export function dar(ctx, quien) {
  const r = REGALOS[quien];
  if (!r) return null;
  montar(ctx);
  ctx.memoria.regalos = { ...(ctx.memoria.regalos || {}), [r.id]: true };
  ctx.audio.sfx('notificacion');
  pintar(ctx);
  return r;
}

export const tiene = (ctx, id) => Boolean(ctx.memoria.regalos?.[id]) && !usados.has(id);

// Se gasta (por este intento): queda tachado en la lista.
export function gastar(ctx, id) {
  usados.add(id);
  if (box) pintar(ctx);
}
