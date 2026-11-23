// MENÚ DE INICIO. Dueño: Andy.
// Un cuadro oscuro con el 23 de la línea pintado en oro, que se va deshaciendo
// en el aire como los pasajeros del juego. La música es "Before the City Wakes".
//
//   const menu = abrirMenu(ctx, { alComenzar });   // en enter() del estado inicio
//   menu.cerrar();                                 // en exit()
//
// La música intenta partir sola. La mayoría de los navegadores la bloquea hasta
// el primer gesto del jugador: en ese caso se ve un umbral ("presiona cualquier
// tecla") y la música entra en ese mismo instante.
import './menu.css';

const OPCIONES = [
  ['comenzar', 'Comenzar'],
  ['como', 'Cómo se juega'],
  ['creditos', 'Créditos'],
];

const PANELES = {
  como: `
    <h2>Cómo se juega</h2>
    <dl>
      <dt>W A S D</dt><dd>Moverse</dd>
      <dt>Mouse</dt><dd>Mirar</dd>
      <dt>F</dt><dd>Flash: lo único que deja ver</dd>
      <dt>E</dt><dd>Tomar o usar</dd>
      <dt>Esc</dt><dd>Pausa</dd>
    </dl>
    <p>Cada flash los acerca. Úsalo igual.</p>`,
  creditos: `
    <h2>Créditos</h2>
    <dl>
      <dt>Valentín Castro</dt><dd>Dirección técnica y final</dd>
      <dt>Camilo Bufadel</dt><dd>Vagón, flash y borrados</dd>
      <dt>Renato Lenis</dt><dd>Arte, personajes y textos</dd>
      <dt>Andy Villarroel</dt><dd>Música, sonido y menú</dd>
    </dl>
    <p>Modelos de personajes: Quaternius (CC0). Tipografía: Cormorant Garamond (OFL).</p>`,
};

const azar = (a, b) => a + Math.random() * (b - a);
const TONOS = ['#e9c46a', '#f3e2b8', '#d9b673', '#f7efdc', '#c98a3a', '#b5332e'];

export function abrirMenu(ctx, { alComenzar }) {
  const raiz = document.createElement('div');
  raiz.className = 'menu';
  raiz.dataset.fase = 'umbral';
  raiz.innerHTML = `
    <canvas class="menu-lienzo"></canvas>
    <div class="menu-cuerpo">
      <p class="menu-linea">Línea 23 · Último tren</p>
      <h1 class="menu-titulo">Fin de<br>Servicio</h1>
      <div class="menu-regla"></div>
      <nav class="menu-opciones">${OPCIONES.map(([id, texto]) => `<button type="button" data-op="${id}">${texto}</button>`).join('')}</nav>
      <section class="menu-panel" hidden></section>
    </div>
    <div class="menu-umbral">Presiona cualquier tecla</div>
    <p class="menu-aviso">Este juego usa destellos de luz repetidos a pantalla completa. Se recomiendan audífonos.</p>
    <p class="menu-pie">Música · Before the City Wakes</p>
    <div class="menu-telon"></div>`;
  ctx.canvas.parentElement.appendChild(raiz);

  const lienzo = raiz.querySelector('.menu-lienzo');
  const g = lienzo.getContext('2d');
  const nav = raiz.querySelector('.menu-opciones');
  const panel = raiz.querySelector('.menu-panel');
  const botones = [...nav.querySelectorAll('button')];
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let ancho = 0, alto = 0, fondo = null, numero = null, puntos = [], cajaNum = null;
  let particulas = [];
  let sel = 0, vivo = true, raf = 0, antes = performance.now(), reloj = 0, brillo = 0;

  // --- Pintura -------------------------------------------------------------

  // El fondo se pinta una sola vez: luz cálida detrás del número y pinceladas largas.
  function pintarFondo() {
    const c = document.createElement('canvas');
    c.width = ancho; c.height = alto;
    const x = c.getContext('2d');
    x.fillStyle = '#06070a'; x.fillRect(0, 0, ancho, alto);
    const luz = x.createRadialGradient(ancho * 0.76, alto * 0.44, 0, ancho * 0.76, alto * 0.44, alto * 0.75);
    luz.addColorStop(0, 'rgba(196, 140, 62, 0.34)');
    luz.addColorStop(0.35, 'rgba(120, 72, 38, 0.16)');
    luz.addColorStop(1, 'rgba(6, 7, 10, 0)');
    x.fillStyle = luz; x.fillRect(0, 0, ancho, alto);
    const frio = x.createRadialGradient(ancho * 0.1, alto * 0.95, 0, ancho * 0.1, alto * 0.95, alto * 0.8);
    frio.addColorStop(0, 'rgba(38, 62, 78, 0.3)');
    frio.addColorStop(1, 'rgba(6, 7, 10, 0)');
    x.fillStyle = frio; x.fillRect(0, 0, ancho, alto);
    // Pinceladas: trazos anchos y casi transparentes, como óleo raspado.
    x.lineCap = 'round';
    for (let i = 0; i < 90; i++) {
      const y = azar(0, alto), x0 = azar(-0.2, 0.9) * ancho, largo = azar(0.15, 0.6) * ancho;
      const calido = Math.random() < 0.55;
      x.strokeStyle = calido ? `rgba(190, 140, 70, ${azar(0.012, 0.05)})` : `rgba(70, 100, 120, ${azar(0.012, 0.045)})`;
      x.lineWidth = azar(0.004, 0.035) * alto;
      x.beginPath();
      x.moveTo(x0, y);
      x.bezierCurveTo(x0 + largo * 0.3, y + azar(-0.03, 0.03) * alto, x0 + largo * 0.7, y + azar(-0.03, 0.03) * alto, x0 + largo, y + azar(-0.02, 0.02) * alto);
      x.stroke();
    }
    const borde = x.createRadialGradient(ancho / 2, alto / 2, alto * 0.35, ancho / 2, alto / 2, alto * 0.95);
    borde.addColorStop(0, 'rgba(0, 0, 0, 0)');
    borde.addColorStop(1, 'rgba(0, 0, 0, 0.82)');
    x.fillStyle = borde; x.fillRect(0, 0, ancho, alto);
    return c;
  }

  // El 23 en oro. De arriba hacia abajo va apareciendo: la parte alta ya se fue.
  function pintarNumero() {
    const c = document.createElement('canvas');
    c.width = ancho; c.height = alto;
    const x = c.getContext('2d');
    const px = alto * 0.8;
    x.font = `400 ${px}px "Cormorant Garamond", Didot, Georgia, serif`;
    x.textAlign = 'center'; x.textBaseline = 'alphabetic';
    const cx = ancho * 0.76, base = alto * 0.7;
    const oro = x.createLinearGradient(0, base - px * 0.7, 0, base);
    oro.addColorStop(0, '#f6e7bd'); oro.addColorStop(0.5, '#d9b673'); oro.addColorStop(1, '#7c5a2a');
    x.fillStyle = oro;
    x.fillText('23', cx, base);
    // Puntos del trazo desde donde se sueltan las partículas (más arriba, más probable).
    const datos = x.getImageData(0, 0, ancho, alto).data;
    const lista = [];
    const paso = Math.max(2, Math.round(alto / 260));
    let minY = alto, maxY = 0;
    for (let y = 0; y < alto; y += paso) {
      for (let xx = 0; xx < ancho; xx += paso) {
        if (datos[(y * ancho + xx) * 4 + 3] > 150) { lista.push([xx, y]); if (y < minY) minY = y; if (y > maxY) maxY = y; }
      }
    }
    // Se borra hacia arriba con un degradado, como si ya se estuviera yendo.
    x.globalCompositeOperation = 'destination-in';
    const velo = x.createLinearGradient(0, minY, 0, maxY);
    velo.addColorStop(0, 'rgba(0, 0, 0, 0.05)'); velo.addColorStop(0.45, 'rgba(0, 0, 0, 0.75)'); velo.addColorStop(1, 'rgba(0, 0, 0, 1)');
    x.fillStyle = velo; x.fillRect(0, 0, ancho, alto);
    puntos = lista;
    cajaNum = { minY, maxY };
    return c;
  }

  function medir() {
    const r = raiz.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    ancho = Math.max(2, Math.round(r.width * dpr));
    alto = Math.max(2, Math.round(r.height * dpr));
    lienzo.width = ancho; lienzo.height = alto;
    fondo = pintarFondo();
    numero = pintarNumero();
    particulas = [];
    if (quieto) for (let i = 0; i < 140; i++) soltar(true);
  }

  // --- Partículas: el número se deshace ------------------------------------

  function soltar(yaEnVuelo = false) {
    if (!puntos.length) return;
    // Sesgo hacia la parte alta del número.
    let p = puntos[Math.floor(Math.random() * puntos.length)];
    for (let i = 0; i < 2; i++) { const q = puntos[Math.floor(Math.random() * puntos.length)]; if (q[1] < p[1]) p = q; }
    const vida = azar(4, 9);
    const m = {
      x: p[0], y: p[1], vx: azar(-0.05, -0.012) * alto, vy: azar(-0.06, -0.015) * alto,
      giro: azar(0, 6.28), vg: azar(-1.6, 1.6), fase: azar(0, 6.28),
      t: azar(0.0025, 0.0075) * alto, vida, edad: yaEnVuelo ? azar(0, vida) : 0,
      tono: TONOS[Math.floor(Math.random() * (Math.random() < 0.08 ? TONOS.length : TONOS.length - 1))],
    };
    if (yaEnVuelo) { m.x += m.vx * m.edad; m.y += m.vy * m.edad; }
    particulas.push(m);
  }

  function cuadro(ahora) {
    if (!vivo) return;
    const dt = Math.min((ahora - antes) / 1000, 0.05);
    antes = ahora; reloj += dt;
    g.globalAlpha = 1;
    g.drawImage(fondo, 0, 0);
    // El número respira: un resplandor que sube y baja muy lento.
    const pulso = 0.82 + 0.18 * Math.sin(reloj * 0.55) + brillo;
    g.globalAlpha = Math.min(1, pulso);
    g.shadowColor = 'rgba(233, 196, 106, 0.55)'; g.shadowBlur = alto * 0.035 * pulso;
    g.drawImage(numero, 0, 0);
    g.shadowBlur = 0;
    if (!quieto) {
      const meta = raiz.dataset.fase === 'saliendo' ? 26 : 5;
      for (let i = 0; i < meta; i++) if (particulas.length < 420 && Math.random() < 0.62) soltar();
    }
    for (let i = particulas.length - 1; i >= 0; i--) {
      const m = particulas[i];
      if (!quieto) {
        m.edad += dt;
        m.x += (m.vx + Math.sin(reloj * 0.7 + m.fase) * alto * 0.012) * dt;
        m.y += m.vy * dt;
        m.giro += m.vg * dt;
      }
      const k = m.edad / m.vida;
      if (k >= 1 || m.y < -20 || m.x < -20) { particulas.splice(i, 1); continue; }
      g.globalAlpha = Math.sin(Math.PI * Math.min(1, k * 1.15)) * 0.9;
      g.fillStyle = m.tono;
      g.save();
      g.translate(m.x, m.y); g.rotate(m.giro);
      g.beginPath();
      g.ellipse(0, 0, m.t * 1.7, m.t * (0.45 + 0.4 * Math.abs(Math.sin(m.giro * 1.3))), 0, 0, 6.2832);
      g.fill();
      g.restore();
    }
    g.globalAlpha = 1;
    if (brillo > 0) brillo = Math.max(0, brillo - dt * 0.5);
    raf = requestAnimationFrame(cuadro);
  }

  // --- Navegación ----------------------------------------------------------

  function marcar(i, conSonido = true) {
    const n = (i + botones.length) % botones.length;
    if (n !== sel && conSonido) ctx.audio.sfx('ui', { volume: 0.5 });
    sel = n;
    botones.forEach((b, k) => b.setAttribute('aria-current', k === sel));
  }
  function abrirPanel(id) {
    panel.innerHTML = `${PANELES[id]}<span class="menu-volver">Esc · Volver</span>`;
    panel.hidden = false; nav.hidden = true;
  }
  function cerrarPanel() { panel.hidden = true; nav.hidden = false; }

  function entrar() {
    if (raiz.dataset.fase !== 'umbral') return;
    raiz.dataset.fase = 'menu';
    brillo = 0.35;
    marcar(0, false);
  }

  function elegir(id) {
    if (raiz.dataset.fase !== 'menu') return;
    ctx.audio.sfx('notificacion', { volume: 0.5 });
    if (id !== 'comenzar') { abrirPanel(id); return; }
    raiz.dataset.fase = 'saliendo';
    brillo = 0.6;
    ctx.input.lockPointer(); // tiene que ir dentro del gesto del jugador
    ctx.audio.musica(null, { fade: 1.3 });
    setTimeout(() => { if (vivo) alComenzar(); }, 1250);
  }

  function tecla(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    // En modo demo, estas teclas son del panel de demo.
    if (ctx.demo && /^(Digit\d|KeyN|KeyR|KeyH)$/.test(e.code)) return;
    if (raiz.dataset.fase === 'umbral') { entrar(); return; }
    if (raiz.dataset.fase !== 'menu') return;
    if (!panel.hidden) { if (['Escape', 'Enter', 'Space', 'Backspace'].includes(e.code)) { e.preventDefault(); cerrarPanel(); } return; }
    if (e.code === 'ArrowUp' || e.code === 'KeyW') { e.preventDefault(); marcar(sel - 1); }
    else if (e.code === 'ArrowDown' || e.code === 'KeyS') { e.preventDefault(); marcar(sel + 1); }
    else if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); elegir(botones[sel].dataset.op); }
  }
  function click(e) {
    if (raiz.dataset.fase === 'umbral') { entrar(); return; }
    if (!panel.hidden) { cerrarPanel(); return; }
    const b = e.target.closest('button[data-op]');
    if (b) elegir(b.dataset.op);
  }
  function encima(e) {
    const b = e.target.closest('button[data-op]');
    if (b) marcar(botones.indexOf(b));
  }

  addEventListener('keydown', tecla);
  raiz.addEventListener('click', click);
  nav.addEventListener('pointerover', encima);
  const alCambiar = () => medir();
  addEventListener('resize', alCambiar);

  // La música parte de inmediato. Si el navegador la bloquea hasta el primer
  // gesto, el motor la lanza apenas llegue ese click o tecla.
  ctx.audio.unlock().catch((err) => console.error('[menu] audio', err));
  ctx.audio.musica('menu', { volume: 0.9, fade: 1.2 });
  // Si el navegador dejó sonar sin gesto, no hace falta el umbral.
  setTimeout(() => { if (vivo && ctx.audio.context?.state === 'running') entrar(); }, 350);

  medir();
  // Cuando llega la tipografía, el 23 se vuelve a pintar con su letra de verdad.
  document.fonts?.load?.('400 40px "Cormorant Garamond"').then(() => { if (vivo) medir(); }).catch((err) => console.error('[menu] fuente', err));
  raf = requestAnimationFrame(cuadro);

  return {
    cerrar() {
      if (!vivo) return;
      vivo = false;
      cancelAnimationFrame(raf);
      removeEventListener('keydown', tecla);
      removeEventListener('resize', alCambiar);
      ctx.audio.musica(null, { fade: 0.4 });
      raiz.remove();
    },
  };
}
