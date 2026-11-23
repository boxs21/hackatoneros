import './camara.css';
import {
  cam, onCamChange, notify, setBattery, setDrain, powerOff, powerOn, setForced, clearMsgs, markInScene,
} from './camaraState.js';

// VISOR DE CÁMARA. Dueño: Renato.
// Todo el juego se ve a través de una cámara de video: esquinas, ● REC con
// contador, batería, fecha y hora real, el flash (F) y las fotos sacadas.
// - Las escenas de Camilo le pasan su estado en cada frame con camaraFrame()
//   (desde world/celular.js): flash listo, foto recién sacada, radar, foto que miente.
// - Las pistas entran como mensaje en el visor (ctx.hud.hint / ctx.hud.camara.notify).
// - ctx.hud.camara.off() apaga la cámara (sin batería) para el final.

let instance = null;

// Lo llama world/celular.js en cada frame.
export function camaraFrame(state) {
  markInScene();
  instance?.frame(state);
}

const pad = (n) => String(n).padStart(2, '0');

export function createCamara(root) {
  const el = document.createElement('div');
  el.className = 'cam';
  el.innerHTML = `
    <canvas class="cam-static" width="80" height="60"></canvas>
    <div class="cam-osd">
      <i class="cam-corner tl"></i><i class="cam-corner tr"></i><i class="cam-corner bl"></i><i class="cam-corner br"></i>
      <div class="cam-tl"><span class="cam-rec"><b></b>REC</span><span class="cam-tc">00:00:00</span></div>
      <div class="cam-tr"><span class="cam-low">BATERÍA BAJA</span><span class="cam-pct"></span><span class="cam-batt"><span></span></span></div>
      <div class="cam-bl"><span class="cam-date"></span><span class="cam-time"></span></div>
      <div class="cam-br">
        <div class="cam-photo"><canvas width="64" height="48"></canvas><small></small></div>
        <span class="cam-shots"></span><span class="cam-fl">FLASH</span><span class="cam-bar"><i></i></span><span class="cam-flash">F</span>
      </div>
      <div class="cam-cross"></div>
      <div class="cam-warn">INTERFERENCIA</div>
    </div>
    <div class="cam-msgs"></div>
    <div class="cam-dead"><span>SIN BATERÍA</span></div>`;
  root.append(el);

  const $ = (s) => el.querySelector(s);
  const osd = $('.cam-osd');
  const tc = $('.cam-tc');
  const pctEl = $('.cam-pct');
  const battFill = $('.cam-batt span');
  const dateEl = $('.cam-date');
  const timeEl = $('.cam-time');
  const shotsEl = $('.cam-shots');
  const flashEl = $('.cam-flash');
  const barEl = $('.cam-bar i');
  const photoBox = $('.cam-photo');
  const photoCanvas = $('.cam-photo canvas');
  const photoLabel = $('.cam-photo small');
  const msgsEl = $('.cam-msgs');
  const staticCanvas = $('.cam-static');
  const sg = staticCanvas.getContext('2d');
  const noise = sg.createImageData(80, 60);

  let lastMsg = null;

  function render(c) {
    el.dataset.on = c.visible ? '1' : '0';
    el.dataset.power = c.power ? 'on' : 'off';
    const s = c.recSeconds;
    tc.textContent = `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
    pctEl.textContent = `${c.pct}%`;
    battFill.style.width = `${c.pct}%`;
    el.classList.toggle('low', c.pct <= 10);
    dateEl.textContent = c.date;
    timeEl.textContent = c.time;

    const top = c.msgs[0] || null;
    msgsEl.replaceChildren(...c.msgs.map((m) => {
      const box = document.createElement('div');
      box.className = `cam-msg${m.old ? ' old' : ''}${m === lastMsg ? ' seen' : ''}`;
      const b = document.createElement('b');
      b.textContent = `MENSAJE · ${m.from}`;
      const p = document.createElement('p');
      p.textContent = m.text;
      box.append(b, p);
      return box;
    }));
    lastMsg = top;
  }

  // Estado por frame que viene de las escenas de Camilo.
  let prev = { ready: null, hot: null, count: -1, photo: null, lie: null, bar: -1 };
  let noiseT = 0;
  let last = performance.now();
  function frame({ since = 9, ready = true, hot = false, count = 0, danger = 0, lie = false } = {}) {
    const now = performance.now();
    const dt = (now - last) / 1000;
    last = now;

    if (ready !== prev.ready) { flashEl.classList.toggle('wait', !ready); prev.ready = ready; }
    if (hot !== prev.hot) { el.classList.toggle('hot', hot); prev.hot = hot; }
    // barra de espera del flash: 0,6 s, o 1,5 s si se recalentó (DISENO.md)
    const bar = ready ? 100 : Math.round(Math.min(1, since / (hot ? 1.5 : 0.6)) * 100);
    if (bar !== prev.bar) { barEl.style.width = `${bar}%`; prev.bar = bar; }
    if (count !== prev.count) { shotsEl.textContent = `FOTOS ${count}`; prev.count = count; }

    const photo = since >= 0.13 && since < 1.8;
    if (photo !== prev.photo || (photo && lie !== prev.lie)) {
      if (photo) {
        drawPhoto(photoCanvas.getContext('2d'), lie);
        photoLabel.textContent = `FOTO ${count}`;
      }
      photoBox.classList.toggle('on', photo);
      prev.photo = photo;
      prev.lie = lie;
    }

    // radar: estática y temblor del visor mientras más cerca hay un borrado
    const d = danger > 0.03 ? danger : 0;
    el.style.setProperty('--danger', d.toFixed(2));
    el.classList.toggle('radar', d > 0.3);
    if (d) {
      noiseT += dt;
      if (noiseT > 1 / 18) {
        noiseT = 0;
        const px = noise.data;
        for (let i = 0; i < px.length; i += 4) {
          const v = Math.random() < 0.5 ? 20 : 160;
          px[i] = px[i + 1] = px[i + 2] = v;
          px[i + 3] = Math.random() < 0.12 + d * 0.23 ? 255 : 0;
        }
        sg.putImageData(noise, 0, 0);
      }
      const j = d * 0.35;
      osd.style.transform = `translate(${(Math.random() - 0.5) * j}cqh, ${(Math.random() - 0.5) * j}cqh)`;
    } else if (osd.style.transform) {
      osd.style.transform = '';
    }
  }

  onCamChange(render);
  render(cam);

  instance = {
    el,
    state: cam,
    frame,
    // Mostrar el visor en escenas sin cámara de Camilo (o esconderlo).
    show() { setForced(true); },
    hide() { setForced(false); },
    notify(text, opts) { notify(text, opts); },
    battery(n) { setBattery(n); },
    drain(on = true) { setDrain(on); },
    off() { powerOff(); },
    on() { powerOn(); },
    clear() { clearMsgs(); },
  };
  return instance;
}

// La foto recién sacada: gente gris que no debería estar ahí.
// Con lie (idea de Camilo), alguien pegado al lente con los ojos negros.
function drawPhoto(g, lie) {
  g.fillStyle = '#2a2b2f';
  g.fillRect(0, 0, 64, 48);
  g.fillStyle = '#8d8e93';
  for (const [x, h] of [[8, 26], [20, 30], [34, 24], [48, 28]]) {
    g.fillRect(x, 46 - h, 5, h);
    g.fillRect(x - 1, 46 - h - 6, 7, 6);
  }
  if (lie) {
    g.fillStyle = '#9a9ba0';
    g.fillRect(18, 4, 30, 44);
    g.fillRect(14, 14, 4, 34);
    g.fillStyle = '#050505';
    g.fillRect(22, 16, 7, 7);
    g.fillRect(37, 16, 7, 7);
    g.fillRect(28, 32, 10, 10);
  }
  g.fillStyle = '#e4322b';
  g.fillRect(3, 3, 3, 3);
}
