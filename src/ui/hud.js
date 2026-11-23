// HUD. Dueño final del look: Renato (celular, subtítulos, galería).
// Los nombres de las funciones se mantienen; los estados las usan.
//   ctx.hud.title(texto, chico)       texto grande al centro ('' para ocultar)
//   ctx.hud.subtitle(texto, ms)       subtítulo abajo; si existe su voz, suena sola
//   ctx.hud.hint(texto, ms)           pista del celular (la dispara core/help.js)
//   await ctx.hud.elegir(['Sí', 'No'], { ms })  -> índice elegido (teclas 1–3)
import { vozDe } from './voces.js';

export function createHud(root, { audio } = {}) {
  const title = el('div', 'hud-title');
  const sub = el('div', 'hud-sub');
  const hint = el('div', 'hud-hint');
  const choice = el('div', 'hud-choice');
  root.append(title, sub, hint, choice);

  let subTimer = 0;
  let hintTimer = 0;
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
      sub.classList.add('on');
      clearTimeout(subTimer);
      subTimer = setTimeout(() => sub.classList.remove('on'), ms);
      callarVoz();
      const v = audio && vozDe(text);
      if (v) {
        try { voz = audio.voz(v.personaje, v.frase); } catch (err) { console.error('[hud] voz', err); }
      }
      return voz;
    },
    hint(text, ms = 6000) {
      hint.textContent = `📱 ${text}`;
      hint.classList.add('on');
      clearTimeout(hintTimer);
      hintTimer = setTimeout(() => hint.classList.remove('on'), ms);
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
    clear() {
      title.innerHTML = '';
      sub.classList.remove('on');
      hint.classList.remove('on');
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
