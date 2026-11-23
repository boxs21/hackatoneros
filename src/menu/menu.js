// MENÚ DE INICIO. Dueño: Andy.
// El menú se dibuja en un lienzo de 320x240, la misma grilla de píxeles del juego,
// encima del vagón 3D que arma states/inicio.js. El título es el letrero LED del
// tren (matriz de 5x7 puntos): "FIN DE SERVICIO" es lo que marca un tren que ya
// no lleva pasajeros.
//
//   const menu = abrirMenu(ctx, { alComenzar, alSalir });   // en enter() del estado inicio
//   menu.cerrar();                                          // en exit()
//
// La música intenta partir sola. Si el navegador la bloquea hasta el primer gesto
// del jugador, se ve "PRESIONA CUALQUIER TECLA" y entra en ese mismo instante.
import './menu.css';

const W = 320, H = 240;
const AMBAR = '#ffb000', AMBAR_APAGADO = '#2a1c04', TINTA = '#eef1f6', GRIS = '#8f98aa';

// Letra de matriz 5x7, la de los letreros de transporte. Cada fila es un número de 5 bits.
const F = {
  A: [14, 17, 17, 31, 17, 17, 17], B: [30, 17, 17, 30, 17, 17, 30], C: [14, 17, 16, 16, 16, 17, 14],
  D: [30, 17, 17, 17, 17, 17, 30], E: [31, 16, 16, 30, 16, 16, 31], F: [31, 16, 16, 30, 16, 16, 16],
  G: [14, 17, 16, 23, 17, 17, 14], H: [17, 17, 17, 31, 17, 17, 17], I: [14, 4, 4, 4, 4, 4, 14],
  J: [7, 2, 2, 2, 2, 18, 12], K: [17, 18, 20, 24, 20, 18, 17], L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17], N: [17, 25, 21, 19, 17, 17, 17], O: [14, 17, 17, 17, 17, 17, 14],
  P: [30, 17, 17, 30, 16, 16, 16], Q: [14, 17, 17, 17, 21, 18, 13], R: [30, 17, 17, 30, 20, 18, 17],
  S: [15, 16, 16, 14, 1, 1, 30], T: [31, 4, 4, 4, 4, 4, 4], U: [17, 17, 17, 17, 17, 17, 14],
  V: [17, 17, 17, 17, 17, 10, 4], W: [17, 17, 17, 21, 21, 27, 17], X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 10, 4, 4, 4, 4], Z: [31, 1, 2, 4, 8, 16, 31],
  0: [14, 17, 19, 21, 25, 17, 14], 1: [4, 12, 4, 4, 4, 4, 14], 2: [14, 17, 1, 2, 4, 8, 31],
  3: [31, 2, 4, 2, 1, 17, 14], 4: [2, 6, 10, 18, 31, 2, 2], 5: [31, 16, 30, 1, 1, 17, 14],
  6: [6, 8, 16, 30, 17, 17, 14], 7: [31, 1, 2, 4, 8, 8, 8], 8: [14, 17, 17, 14, 17, 17, 14],
  9: [14, 17, 17, 15, 1, 2, 12],
  '.': [0, 0, 0, 0, 0, 12, 12], ',': [0, 0, 0, 0, 12, 4, 8], ':': [0, 12, 12, 0, 12, 12, 0],
  '·': [0, 0, 0, 4, 0, 0, 0], '-': [0, 0, 0, 14, 0, 0, 0], '>': [16, 8, 4, 2, 4, 8, 16],
  '!': [4, 4, 4, 4, 4, 0, 4], '?': [14, 17, 1, 2, 4, 0, 4], '/': [1, 1, 2, 4, 8, 16, 16],
  '(': [4, 8, 8, 8, 8, 8, 4], ')': [4, 2, 2, 2, 2, 2, 4], '…': [0, 0, 0, 0, 0, 0, 21], ' ': [0, 0, 0, 0, 0, 0, 0],
};
const ACENTO = { '́': 6, '̃': 14 }; // tilde aguda y virgulilla, dos filas sobre la letra

const OPCIONES = [['comenzar', 'COMENZAR'], ['como', 'CÓMO SE JUEGA'], ['creditos', 'CRÉDITOS']];
const PANELES = {
  como: ['CÓMO SE JUEGA', '', 'W A S D   MOVERSE', 'MOUSE     MIRAR', 'F         FLASH PARA VER', 'E         TOMAR O USAR', 'ESC       PAUSA', '', 'CADA FLASH LOS ACERCA.'],
  creditos: ['CRÉDITOS', '', 'VALENTÍN CASTRO', 'CAMILO BUFADEL', 'RENATO LENIS', 'ANDY VILLARROEL', 'MÚSICA: BEFORE THE CITY WAKES', 'HECHO CON CODEX'],
};

export function abrirMenu(ctx, { alComenzar, alSalir } = {}) {
  const raiz = document.createElement('div');
  raiz.className = 'menu';
  raiz.dataset.fase = 'umbral';
  raiz.innerHTML = '<canvas class="menu-lienzo" width="320" height="240"></canvas><div class="menu-telon"></div>';
  ctx.canvas.parentElement.appendChild(raiz);
  const lienzo = raiz.querySelector('canvas');
  const g = lienzo.getContext('2d');
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Ingrediente obligatorio: el logo de Codex (oficial, public/codex.png).
  // Viene negro con fondo transparente: se pinta del color del texto para que se vea.
  const LOGO = 20;
  const logo = document.createElement('canvas');
  logo.width = logo.height = LOGO;
  let logoListo = false;
  {
    const img = new Image();
    img.onload = () => {
      const x = logo.getContext('2d');
      x.drawImage(img, 0, 0, LOGO, LOGO);
      x.globalCompositeOperation = 'source-in';
      x.fillStyle = TINTA;
      x.fillRect(0, 0, LOGO, LOGO);
      logoListo = true;
    };
    img.onerror = () => console.error('[menu] no se pudo cargar el logo de Codex');
    img.src = `${import.meta.env.BASE_URL}codex.png`;
  }

  let sel = 0, panel = null, vivo = true, raf = 0, reloj = 0, antes = performance.now(), entrada = 0;

  // --- Texto en matriz de puntos -------------------------------------------

  const ancho = (txt, e = 1) => [...txt.normalize('NFD')].filter((c) => !ACENTO[c]).length * 6 * e - e;

  // led: cada punto deja un borde apagado, como en un panel de verdad.
  function texto(x2d, txt, x, y, e = 1, color = TINTA, { led = false, sombra = true } = {}) {
    const lado = led ? e - 1 : e;
    const pintar = (dx, dy) => {
      let cx = x;
      for (const c of txt.normalize('NFD')) {
        if (ACENTO[c]) {
          const fila = ACENTO[c];
          for (let i = 0; i < 5; i++) if (fila & (16 >> i)) x2d.fillRect(cx - 6 * e + i * e + dx, y - 2 * e + dy, lado, lado);
          continue;
        }
        const glifo = F[c] ?? F['?'];
        for (let r = 0; r < 7; r++) for (let i = 0; i < 5; i++) if (glifo[r] & (16 >> i)) x2d.fillRect(cx + i * e + dx, y + r * e + dy, lado, lado);
        cx += 6 * e;
      }
    };
    if (sombra && !led) { x2d.fillStyle = '#000'; pintar(1, 1); }
    x2d.fillStyle = color;
    pintar(0, 0);
  }
  const centro = (txt, e) => Math.round((W - ancho(txt, e)) / 2);

  // El letrero se pinta una sola vez en dos capas: el panel con la matriz apagada
  // y los puntos encendidos con su resplandor.
  const TABLERO = { x: 12, y: 12, w: 296, h: 50 };
  const capa = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
  const panelApagado = capa();
  const puntos = capa();
  {
    const x = panelApagado.getContext('2d');
    x.fillStyle = '#050403'; x.fillRect(TABLERO.x, TABLERO.y, TABLERO.w, TABLERO.h);
    x.fillStyle = '#1c150b';
    x.fillRect(TABLERO.x, TABLERO.y, TABLERO.w, 1); x.fillRect(TABLERO.x, TABLERO.y + TABLERO.h - 1, TABLERO.w, 1);
    x.fillRect(TABLERO.x, TABLERO.y, 1, TABLERO.h); x.fillRect(TABLERO.x + TABLERO.w - 1, TABLERO.y, 1, TABLERO.h);
    x.fillStyle = AMBAR_APAGADO;
    for (let py = TABLERO.y + 6; py < TABLERO.y + 27; py += 3) for (let px = TABLERO.x + 5; px < TABLERO.x + TABLERO.w - 5; px += 3) x.fillRect(px, py, 2, 2);
    const p = puntos.getContext('2d');
    p.shadowColor = AMBAR; p.shadowBlur = 3;
    texto(p, 'FIN DE SERVICIO', TABLERO.x + 14, TABLERO.y + 6, 3, AMBAR, { led: true });
    p.shadowBlur = 0;
    texto(p, 'LÍNEA 23 · ÚLTIMO TREN', centro('LÍNEA 23 · ÚLTIMO TREN', 1), TABLERO.y + 37, 1, AMBAR, { sombra: false });
  }

  // --- Dibujo --------------------------------------------------------------

  const cajasOpciones = OPCIONES.map((_, i) => ({ x: 14, y: 128 + i * 22 - 4, w: 200, h: 22 }));
  const AVISO = 'ESTE JUEGO USA DESTELLOS DE LUZ REPETIDOS';

  function dibujar() {
    g.clearRect(0, 0, W, H);
    const fase = raiz.dataset.fase;
    g.globalAlpha = 1;
    g.drawImage(panelApagado, 0, 0);
    // El letrero falla apenas, como un panel viejo.
    g.globalAlpha = !quieto && Math.sin(reloj * 37) > 0.992 ? 0.5 : 1;
    g.drawImage(puntos, 0, 0);
    g.globalAlpha = 1;

    if (fase === 'umbral') {
      if (quieto || Math.sin(reloj * 3) > -0.2) texto(g, 'PRESIONA CUALQUIER TECLA', centro('PRESIONA CUALQUIER TECLA', 1), 150, 1, TINTA);
      return;
    }
    g.globalAlpha = Math.min(1, (reloj - entrada) / 0.6);
    texto(g, AVISO, centro(AVISO, 1), 68, 1, GRIS);
    texto(g, 'MÚSICA · BEFORE THE CITY WAKES', 14, 226, 1, GRIS);

    if (panel) {
      g.fillStyle = 'rgba(0, 0, 0, 0.8)'; g.fillRect(12, 92, 212, 118);
      g.fillStyle = AMBAR; g.fillRect(12, 92, 212, 1); g.fillRect(12, 92, 1, 118);
      PANELES[panel].forEach((linea, i) => texto(g, linea, 22, 102 + i * 11, 1, i === 0 ? AMBAR : TINTA));
      texto(g, 'ESC · VOLVER', 22, 198, 1, GRIS);
      if (panel === 'creditos' && logoListo) g.drawImage(logo, 196, 100);
    } else {
      OPCIONES.forEach(([, nombre], i) => {
        const activa = i === sel;
        const y = 128 + i * 22;
        if (activa && (quieto || Math.sin(reloj * 6) > -0.4)) texto(g, '>', 16, y, 2, AMBAR);
        texto(g, nombre, 34, y, 2, activa ? AMBAR : GRIS);
      });
      if (logoListo) {
        g.drawImage(logo, W - 14 - LOGO, 196);
        texto(g, 'HECHO CON CODEX', W - 14 - LOGO - 6 - ancho('HECHO CON CODEX'), 203, 1, GRIS);
      }
    }
    g.globalAlpha = 1;
  }

  function cuadro(ahora) {
    if (!vivo) return;
    reloj += Math.min((ahora - antes) / 1000, 0.05);
    antes = ahora;
    dibujar();
    raf = requestAnimationFrame(cuadro);
  }

  // --- Navegación ----------------------------------------------------------

  function marcar(i) {
    const n = (i + OPCIONES.length) % OPCIONES.length;
    if (n !== sel) ctx.audio.sfx('ui', { volume: 0.5 });
    sel = n;
  }
  function entrar() {
    if (raiz.dataset.fase !== 'umbral') return;
    raiz.dataset.fase = 'menu';
    entrada = reloj;
  }
  function elegir(id) {
    if (raiz.dataset.fase !== 'menu') return;
    ctx.audio.sfx('notificacion', { volume: 0.5 });
    if (id !== 'comenzar') { panel = id; return; }
    raiz.dataset.fase = 'saliendo';
    ctx.input.lockPointer(); // tiene que ir dentro del gesto del jugador
    ctx.audio.musica(null, { fade: 1.3 });
    alSalir?.();
    setTimeout(() => { if (vivo) alComenzar?.(); }, 1250);
  }
  function tecla(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (ctx.demo && /^(Digit\d|KeyN|KeyR|KeyH)$/.test(e.code)) return; // teclas del modo demo
    if (raiz.dataset.fase === 'umbral') { entrar(); return; }
    if (raiz.dataset.fase !== 'menu') return;
    if (panel) { if (['Escape', 'Enter', 'Space', 'Backspace'].includes(e.code)) { e.preventDefault(); panel = null; } return; }
    if (e.code === 'ArrowUp' || e.code === 'KeyW') { e.preventDefault(); marcar(sel - 1); }
    else if (e.code === 'ArrowDown' || e.code === 'KeyS') { e.preventDefault(); marcar(sel + 1); }
    else if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); elegir(OPCIONES[sel][0]); }
  }
  // Mouse: se traduce a la grilla de 320x240 para saber sobre qué opción está.
  function opcionEn(e) {
    const r = lienzo.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width * W, y = (e.clientY - r.top) / r.height * H;
    return cajasOpciones.findIndex((c) => x >= c.x && x < c.x + c.w && y >= c.y && y < c.y + c.h);
  }
  function click(e) {
    if (raiz.dataset.fase === 'umbral') { entrar(); return; }
    if (panel) { panel = null; return; }
    const i = opcionEn(e);
    if (i >= 0) { sel = i; elegir(OPCIONES[i][0]); }
  }
  function mover(e) {
    if (raiz.dataset.fase !== 'menu' || panel) { raiz.style.cursor = 'default'; return; }
    const i = opcionEn(e);
    raiz.style.cursor = i >= 0 ? 'pointer' : 'default';
    if (i >= 0) marcar(i);
  }

  addEventListener('keydown', tecla);
  raiz.addEventListener('click', click);
  raiz.addEventListener('pointermove', mover);

  // La música parte de inmediato; si el navegador la bloquea, el motor la lanza con el primer gesto.
  ctx.audio.unlock().catch((err) => console.error('[menu] audio', err));
  ctx.audio.musica('menu', { volume: 0.9, fade: 1.2 });
  // Si el navegador dejó sonar sin gesto, no hace falta el umbral.
  setTimeout(() => { if (vivo && ctx.audio.context?.state === 'running') entrar(); }, 350);

  raf = requestAnimationFrame(cuadro);

  return {
    get fase() { return raiz.dataset.fase; },
    cerrar() {
      if (!vivo) return;
      vivo = false;
      cancelAnimationFrame(raf);
      removeEventListener('keydown', tecla);
      ctx.audio.musica(null, { fade: 0.4 });
      raiz.remove();
    },
  };
}
