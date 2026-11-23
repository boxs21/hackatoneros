// HUD. Dueño final del look: Renato (celular, subtítulos, galería).
// Los nombres de las funciones se mantienen; los estados las usan.
//   ctx.hud.title(texto, chico)       texto grande al centro ('' para ocultar)
//   ctx.hud.subtitle(texto, ms)       subtítulo abajo; suena solo con murmullo (ui/voces.js)
//   ctx.hud.hint(texto, ms)           pista como mensaje en el visor de cámara (core/help.js)
//   await ctx.hud.elegir(['Sí', 'No'], { ms })  -> índice elegido (teclas 1–3)
//   ctx.hud.obtenido('Celular', '[F] flash')  objeto obtenido al centro con su sprite
import { murmullo } from './voces.js';
import { createCamara } from './camara.js';
import { createSinBateria } from './sinBateria.js';
import { createObtenido } from './obtenido.js';
import { createLlamada } from './llamada.js';

export function createHud(root, { audio } = {}) {
  const title = el('div', 'hud-title');
  const sub = el('div', 'hud-sub');
  const choice = el('div', 'hud-choice');
  root.append(title, sub, choice);
  // Objeto obtenido: al centro, con su sprite (ui/obtenido.js).
  const item = createObtenido(root, { audio });
  // Visor de cámara a pantalla completa (DISENO.md). Las pistas entran ahí.
  const camara = createCamara(root);
  // Tu celular sin batería (hora punta): se anima solo cuando el subtítulo lo dice.
  const sinBateria = createSinBateria(root, { audio });
  // El celular del Oficinista y la llamada a tu mamá (hora punta), también por subtítulo.
  const llamada = createLlamada(root, { audio });

  let subTimer = 0;
  let voz = null;
  let cerrarEleccion = null;

  function callarVoz() {
    try { voz?.stop?.(); } catch (err) { console.error('[hud] voz', err); }
    voz = null;
  }

  return {
    title(text, small = '') {
      title.innerHTML = text ? `${esc(text)}${small ? `<small>${esc(small)}</small>` : ''}` : '';
    },
    // Devuelve la voz que suena (o null), por si la escena quiere esperar su fin.
    subtitle(text, ms = 3000) {
      sub.textContent = text;
      if (/sin bater[ií]a/i.test(text)) sinBateria.play();
      else if (/tiene c[aá]mara y flash/i.test(text)) llamada.recibir();
      else if (/marcas el n[uú]mero/i.test(text)) llamada.marcar();
      else if (/^ALTAVOZ: Pr[oó]xima estaci[oó]n/i.test(text)) llamada.cortar();
      sub.classList.add('on');
      clearTimeout(subTimer);
      subTimer = setTimeout(() => sub.classList.remove('on'), ms);
      callarVoz();
      const v = audio && murmullo(text);
      if (v) {
        try { voz = audio.voz(v.personaje, text, v.opts); } catch (err) { console.error('[hud] voz', err); }
      }
      return voz;
    },
    camara, // ctx.hud.camara.off() apaga la cámara (final), .notify(texto, { from })
    hint(text, ms = 6000) {
      camara.notify(text, { ms });
    },
    // Opciones para responder. Teclas 1, 2, 3 (o click). Sin respuesta en ms,
    // elige la última opción (callarse también es una respuesta).
    elegir(opciones, { ms = 9000 } = {}) {
      cerrarEleccion?.(opciones.length - 1);
      return new Promise((resolve) => {
        choice.innerHTML = opciones.map((o, i) =>
          `<button type="button" data-i="${i}"><kbd>${i + 1}</kbd>${esc(o)}</button>`).join('');
        choice.classList.add('on');
        const timer = setTimeout(() => fin(opciones.length - 1), ms);
        function onKey(e) {
          const m = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
          if (!m) return;
          // mientras se elige, los números son solo para responder (no saltan escenas del modo demo)
          e.preventDefault();
          e.stopImmediatePropagation();
          if (Number(m[1]) <= opciones.length) fin(Number(m[1]) - 1);
        }
        function onClick(e) {
          const b = e.target.closest('button[data-i]');
          if (b) fin(Number(b.dataset.i));
        }
        function fin(i) {
          clearTimeout(timer);
          removeEventListener('keydown', onKey, true);
          choice.removeEventListener('click', onClick);
          choice.classList.remove('on');
          cerrarEleccion = null;
          audio?.sfx?.('ui');
          resolve(i);
        }
        cerrarEleccion = fin;
        addEventListener('keydown', onKey, true);
        choice.addEventListener('click', onClick);
      });
    },
    // Aviso de objeto recibido: al centro, el sprite, «¡OBTUVISTE!», nombre y para qué sirve.
    obtenido(nombre, uso = '', ms = 2800) {
      item.show(nombre, uso, ms);
    },
    clear() {
      item.hide();
      title.innerHTML = '';
      sub.classList.remove('on');
      camara.clear();
      sinBateria.stop();
      llamada.stop();
      cerrarEleccion?.(0);
      callarVoz();
    },
  };
}

function el(tag, cls) {
  const n = document.createElement(tag);
  n.className = cls;
  return n;
}
function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}
