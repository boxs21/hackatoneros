// HUD PROVISORIO. Dueño final: Renato (celular, subtítulos, galería).
// Estas funciones son las que usan los estados; Renato puede cambiar
// cómo se ven, pero los nombres se mantienen.
export function createHud(root) {
  const title = el('div', 'hud-title');
  const sub = el('div', 'hud-sub');
  const hint = el('div', 'hud-hint');
  root.append(title, sub, hint);

  let subTimer = 0;
  let hintTimer = 0;

  return {
    // Texto grande centrado (título de momento). '' para ocultar.
    title(text, small = '') {
      title.innerHTML = text ? `${esc(text)}${small ? `<small>${esc(small)}</small>` : ''}` : '';
    },
    // Subtítulo de diálogo abajo. ms = cuánto dura.
    subtitle(text, ms = 3000) {
      sub.textContent = text;
      sub.classList.add('on');
      clearTimeout(subTimer);
      subTimer = setTimeout(() => sub.classList.remove('on'), ms);
    },
    // Pista en el celular (la dispara core/help.js a los 30 s).
    hint(text, ms = 6000) {
      hint.textContent = `📱 ${text}`;
      hint.classList.add('on');
      clearTimeout(hintTimer);
      hintTimer = setTimeout(() => hint.classList.remove('on'), ms);
    },
    clear() {
      title.innerHTML = '';
      sub.classList.remove('on');
      hint.classList.remove('on');
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
