import { pixelTexture, seeded } from './ps1.js';

// Texturas dibujadas a mano en canvas chicos. Se cachea solo el canvas;
// la textura se crea nueva cada vez porque la máquina de estados la libera.
const cache = new Map();

function canvas(key, w, h, draw) {
  if (!cache.has(key)) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    draw(g, w, h, seeded(key.length * 7919 + w));
    cache.set(key, c);
  }
  return cache.get(key);
}

function noise(g, w, h, rnd, alpha = 0.08, size = 1) {
  for (let y = 0; y < h; y += size) {
    for (let x = 0; x < w; x += size) {
      const v = rnd();
      g.fillStyle = v > 0.5 ? `rgba(255,255,255,${(v - 0.5) * alpha})` : `rgba(0,0,0,${(0.5 - v) * alpha * 1.6})`;
      g.fillRect(x, y, size, size);
    }
  }
}

const DRAW = {
  suelo: [32, 32, (g, w, h, rnd) => {
    g.fillStyle = '#3b3a3d';
    g.fillRect(0, 0, w, h);
    noise(g, w, h, rnd, 0.25);
    for (let y = 2; y < h; y += 8) {
      for (let x = (y / 8) % 2 ? 6 : 2; x < w; x += 8) {
        g.fillStyle = '#29282b';
        g.fillRect(x, y + 1, 3, 2);
        g.fillStyle = '#56545a';
        g.fillRect(x, y, 3, 1);
      }
    }
  }],
  pared: [32, 32, (g, w, h, rnd) => {
    g.fillStyle = '#c9c2a8';
    g.fillRect(0, 0, w, h);
    noise(g, w, h, rnd, 0.22);
    g.fillStyle = '#8d8671';
    g.fillRect(0, 0, 1, h);
    g.fillStyle = '#e2dcc6';
    g.fillRect(1, 0, 1, h);
    // mugre que baja
    for (let i = 0; i < 5; i++) {
      const x = Math.floor(rnd() * w);
      g.fillStyle = 'rgba(70,60,40,.18)';
      g.fillRect(x, Math.floor(rnd() * 10), 1, 8 + Math.floor(rnd() * 20));
    }
  }],
  techo: [32, 32, (g, w, h, rnd) => {
    g.fillStyle = '#b6b3a4';
    g.fillRect(0, 0, w, h);
    noise(g, w, h, rnd, 0.15);
    g.fillStyle = '#87847a';
    g.fillRect(0, h - 1, w, 1);
    for (let x = 3; x < w; x += 6) for (let y = 3; y < h; y += 6) {
      g.fillStyle = '#9d9a8d';
      g.fillRect(x, y, 1, 1);
    }
  }],
  asiento: [16, 16, (g, w, h, rnd) => {
    g.fillStyle = '#2a3566';
    g.fillRect(0, 0, w, h);
    const colors = ['#c23a33', '#e1b12c', '#4b8bd6'];
    for (let y = 0; y < h; y += 4) for (let x = (y / 4) % 2 ? 2 : 0; x < w; x += 4) {
      g.fillStyle = colors[Math.floor(rnd() * 3)];
      g.fillRect(x, y, 2, 1);
    }
    noise(g, w, h, rnd, 0.2);
  }],
  vidrio: [16, 16, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#16202a');
    grad.addColorStop(1, '#05080b');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(160,190,210,.18)';
    for (let i = 0; i < 6; i++) g.fillRect(4 + i, 12 - i * 2, 2, 2);
  }],
  tunel: [32, 32, (g, w, h, rnd) => {
    g.fillStyle = '#1a1917';
    g.fillRect(0, 0, w, h);
    noise(g, w, h, rnd, 0.5, 2);
    g.fillStyle = '#0d0c0b';
    g.fillRect(0, 10, w, 2);
    g.fillRect(0, 22, w, 1);
  }],
  puerta: [32, 64, (g, w, h, rnd) => {
    g.fillStyle = '#8f938f';
    g.fillRect(0, 0, w, h);
    noise(g, w, h, rnd, 0.18);
    g.fillStyle = '#0b1015';
    g.fillRect(5, 6, w - 10, 24);
    g.fillStyle = 'rgba(160,190,210,.25)';
    g.fillRect(8, 9, 3, 10);
    g.fillStyle = '#e1b12c';
    g.fillRect(0, 0, 2, h);
    g.fillStyle = '#111';
    for (let y = 2; y < h; y += 6) g.fillRect(0, y, 2, 3);
    g.fillStyle = '#5d605d';
    g.fillRect(w - 1, 0, 1, h);
  }],
  aviso: [64, 32, (g, w, h) => {
    g.fillStyle = '#eae3cf';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#2b2f6b';
    g.fillRect(0, 0, w, 9);
    g.fillStyle = '#fff';
    g.font = 'bold 8px monospace';
    g.fillText('¿SUEÑO?', 3, 8);
    g.fillStyle = '#222';
    g.font = '7px monospace';
    g.fillText('DUERME EN', 3, 18);
    g.fillText('TU CASA.', 3, 26);
    g.fillStyle = '#7a4fa0';
    g.beginPath();
    g.arc(50, 20, 8, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#eae3cf';
    g.beginPath();
    g.arc(53, 17, 7, 0, Math.PI * 2);
    g.fill();
  }],
  mapa: [128, 16, (g, w, h) => {
    g.fillStyle = '#eeeeea';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#c23a33';
    g.fillRect(6, 9, w - 12, 2);
    const names = ['PEGA', '', '', 'TÚNEL', '', '', 'CASA'];
    names.forEach((n, i) => {
      const x = 6 + i * ((w - 12) / (names.length - 1));
      g.fillStyle = '#fff';
      g.fillRect(x - 2, 7, 5, 5);
      g.fillStyle = '#c23a33';
      g.fillRect(x - 1, 8, 3, 3);
      if (n) {
        g.fillStyle = '#222';
        g.font = 'bold 6px monospace';
        g.fillText(n, Math.min(w - 22, Math.max(1, x - 8)), 6);
      }
    });
  }],
  borradoCara: [16, 16, (g, w, h, rnd) => {
    g.fillStyle = '#8d8e93';
    g.fillRect(0, 0, w, h);
    noise(g, w, h, rnd, 0.3);
    g.fillStyle = '#050505';
    g.fillRect(4, 6, 3, 3);
    g.fillRect(9, 6, 3, 3);
    g.fillRect(6, 11, 4, 4);
    g.fillStyle = '#3a3a3e';
    g.fillRect(4, 9, 3, 2);
    g.fillRect(9, 9, 3, 2);
  }],
};

export function textura(name, rx = 1, ry = 1) {
  const [w, h, draw] = DRAW[name];
  return pixelTexture(canvas(name, w, h, draw), rx, ry);
}

// Cara de pasajero: piel, pelo y ojos en 16x16.
export function cara({ skin = '#c49a7c', hair = '#2a1d16', hairRows = 4, extra } = {}) {
  const key = `cara:${skin}:${hair}:${hairRows}:${extra || ''}`;
  return pixelTexture(canvas(key, 16, 16, (g, w, h, rnd) => {
    g.fillStyle = skin;
    g.fillRect(0, 0, w, h);
    noise(g, w, h, rnd, 0.15);
    g.fillStyle = hair;
    g.fillRect(0, 0, w, hairRows);
    g.fillStyle = '#1a1210';
    g.fillRect(4, 7, 2, 2);
    g.fillRect(10, 7, 2, 2);
    g.fillStyle = 'rgba(0,0,0,.25)';
    g.fillRect(7, 9, 2, 2);
    g.fillStyle = '#6b3b34';
    g.fillRect(6, 12, 4, 1);
    if (extra === 'lentes') {
      g.fillStyle = '#111';
      g.fillRect(3, 6, 4, 1);
      g.fillRect(9, 6, 4, 1);
      g.fillRect(7, 7, 2, 1);
    }
    if (extra === 'gorro') {
      g.fillStyle = '#2e5aa8';
      g.fillRect(0, 0, w, 5);
    }
    if (extra === 'canas') {
      g.fillStyle = '#c9c5bd';
      g.fillRect(0, 0, w, hairRows);
    }
  }));
}

// Rayado de tiza del Escolar: un dígito grande y marcas de orden (I, II, III).
export function rayado(digit, order) {
  const key = `rayado:${digit}:${order}`;
  return pixelTexture(canvas(key, 32, 32, (g, w, h, rnd) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#f3efe0';
    for (let i = 0; i < order; i++) g.fillRect(3 + i * 4, 3, 2, 8);
    g.font = 'bold 22px monospace';
    g.fillText(String(digit), 10, 29);
    // trazo tembloroso: borrar píxeles al azar
    for (let i = 0; i < 70; i++) g.clearRect(Math.floor(rnd() * w), Math.floor(rnd() * h), 1, 1);
  }));
}

export function garabato(text) {
  const key = `garabato:${text}`;
  return pixelTexture(canvas(key, 64, 32, (g, w, h, rnd) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#f3efe0';
    g.font = 'bold 9px monospace';
    const lines = text.split('\n');
    lines.forEach((l, i) => g.fillText(l, 2, 11 + i * 10));
    for (let i = 0; i < 90; i++) g.clearRect(Math.floor(rnd() * w), Math.floor(rnd() * h), 1, 1);
  }));
}

export function monito() {
  return pixelTexture(canvas('monito', 32, 32, (g) => {
    g.clearRect(0, 0, 32, 32);
    g.strokeStyle = '#f3efe0';
    g.lineWidth = 1.5;
    const stick = (x, s) => {
      g.beginPath();
      g.arc(x, 9, 3 * s, 0, Math.PI * 2);
      g.moveTo(x, 12); g.lineTo(x, 22);
      g.moveTo(x - 4, 15); g.lineTo(x + 4, 15);
      g.moveTo(x, 22); g.lineTo(x - 3, 29);
      g.moveTo(x, 22); g.lineTo(x + 3, 29);
      g.stroke();
    };
    stick(6, 1); stick(16, 1);
    g.setLineDash([2, 2]);
    stick(26, 1);
  }));
}
