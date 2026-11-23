import * as THREE from 'three';

// EL CELULAR DEL OFICINISTA EN TU MANO, EN 3D (hora punta). Dueño: Renato.
// Un celular de verdad en la escena, frente a la cámara (como world/celular.js),
// con la pantalla dibujada en un canvas chico que se anima:
//   subir()  -> lo levantas: tenía Codex abierto (logo oficial, public/codex.png)
//   marcar() -> cierras Codex (se va hacia arriba), tecleas y «Llamando… Mamá»
//   cortar() -> estática y «SIN SEÑAL» (se cortó con el altavoz)
//   sinBateria(alTerminar) -> TU celular al empezar: «Mamá», tocas llamar, pila
//     vacía en rojo, se apaga y lo guardas (createCelular3d(stage, { mio: true }))
// states/horaPunta.js lo crea y llama update(camara, dt) al final de cada frame.

const W = 72;
const H = 144;
const NUMERO = '984231704';
const TECLAS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', ''];

const logo = new Image();
logo.src = `${import.meta.env.BASE_URL}codex.png`;

export function createCelular3d(stage, { mio = false } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;

  // siempre encima de todo, sin niebla (como el celular de Camilo)
  const encima = (m, orden) => {
    m.depthTest = false;
    m.depthWrite = false;
    m.fog = false;
    return { m, orden };
  };
  const group = new THREE.Group();
  group.visible = false;
  const pieza = (geo, { m, orden }, x, y, z) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    mesh.renderOrder = orden;
    mesh.frustumCulled = false;
    group.add(mesh);
    return mesh;
  };
  const piel = encima(new THREE.MeshBasicMaterial({ color: 0x5a4234 }), 995);
  pieza(new THREE.BoxGeometry(.085, .06, .035), piel, .006, -.085, -.012); // mano
  pieza(new THREE.BoxGeometry(.022, .06, .02), piel, -.04, -.045, .004).rotation.z = -.5; // pulgar
  pieza(new THREE.BoxGeometry(.074, .148, .012), encima(new THREE.MeshBasicMaterial({ color: mio ? 0x1d2026 : 0x3a3f48 }), 996), 0, 0, 0);
  pieza(new THREE.PlaneGeometry(.064, .13), encima(new THREE.MeshBasicMaterial({ map: tex }), 997), 0, 0, .0065);
  stage.add(group);

  const abajo = new THREE.Vector3(.07, -.2, -.24);
  const arriba = new THREE.Vector3(.045, -.035, -.2);
  const off = new THREE.Vector3();
  const tilt = new THREE.Quaternion();
  const euler = new THREE.Euler();

  let modo = 'nada'; // codex | cerrar | marcar | llamando | cortado | mama | vacia | apagado
  let alTerminar = null;
  let t = 0; // tiempo en el modo actual
  let alto = 0; // 0 = abajo, 1 = arriba
  let meta = 0;
  let digitos = 0;
  let tick = -1;

  function barra(color = '#9aa3b5') {
    g.fillStyle = color;
    g.font = 'bold 8px monospace';
    g.textAlign = 'left';
    g.fillText('18:06', 4, 9);
    // una barra de señal: «ando con poca señal»
    for (let i = 0; i < 4; i++) {
      g.fillStyle = i === 0 ? (modo === 'cortado' ? '#e4322b' : '#eef1f6') : '#4a4f58';
      g.fillRect(W - 18 + i * 3, 9 - (i + 1) * 2, 2, (i + 1) * 2);
    }
  }

  function pantallaCodex(y = 0, s = 1) {
    g.fillStyle = '#f4f4f2';
    g.fillRect(0, y, W, H);
    const lado = 40 * s;
    if (logo.complete && logo.naturalWidth) g.drawImage(logo, (W - lado) / 2, y + 40 + (40 - lado) / 2, lado, lado);
    g.fillStyle = '#0b0b0b';
    g.font = 'bold 12px sans-serif';
    g.textAlign = 'center';
    g.fillText('Codex', W / 2, y + 100);
    g.font = '7px sans-serif';
    g.fillStyle = '#555';
    g.fillText('listo para ayudar', W / 2, y + 112);
  }

  function teclado() {
    g.fillStyle = '#0b0f14';
    g.fillRect(0, 0, W, H);
    barra();
    g.fillStyle = '#eef1f6';
    g.font = 'bold 10px monospace';
    g.textAlign = 'center';
    g.fillText(NUMERO.slice(0, digitos), W / 2, 30);
    const ultima = NUMERO[digitos - 1];
    TECLAS.forEach((k, i) => {
      if (!k) return;
      const x = 8 + (i % 3) * 20;
      const y = 40 + Math.floor(i / 3) * 20;
      const marcada = k === ultima && t * 14 % 1 < .6;
      g.fillStyle = marcada ? '#f2b705' : '#1d2430';
      g.fillRect(x, y, 16, 16);
      g.fillStyle = marcada ? '#0b0f14' : '#eef1f6';
      g.font = 'bold 9px monospace';
      g.fillText(k, x + 8, y + 12);
    });
    g.fillStyle = '#22a95a';
    g.fillRect(W / 2 - 8, H - 22, 16, 16);
  }

  function llamando() {
    g.fillStyle = '#0b0f14';
    g.fillRect(0, 0, W, H);
    barra();
    // ondas mientras suena
    for (let k = 0; k < 2; k++) {
      const f = (t * .8 + k * .5) % 1;
      g.strokeStyle = `rgba(142,123,166,${1 - f})`;
      g.lineWidth = 2;
      g.beginPath();
      g.arc(W / 2, 48, 13 + f * 16, 0, Math.PI * 2);
      g.stroke();
    }
    g.fillStyle = '#8e7ba6';
    g.beginPath();
    g.arc(W / 2, 48, 13, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fff';
    g.font = 'bold 14px sans-serif';
    g.textAlign = 'center';
    g.fillText('M', W / 2, 53);
    g.font = 'bold 11px sans-serif';
    g.fillText('Mamá', W / 2, 86);
    if (t % 1.3 < .9) {
      g.fillStyle = '#22a95a';
      g.font = '8px monospace';
      g.fillText('Llamando…', W / 2, 100);
    }
    g.fillStyle = '#e4322b';
    g.beginPath();
    g.arc(W / 2, H - 16, 8, 0, Math.PI * 2);
    g.fill();
  }

  function cortado() {
    const img = g.createImageData(W, H);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() < .5 ? 25 : 170;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    barra('#e4322b');
    g.fillStyle = '#000';
    g.fillRect(6, 62, W - 12, 18);
    g.strokeStyle = '#e4322b';
    g.lineWidth = 1;
    g.strokeRect(6.5, 62.5, W - 13, 17);
    if (t % .5 < .3) {
      g.fillStyle = '#ff5148';
      g.font = 'bold 9px monospace';
      g.textAlign = 'center';
      g.fillText('SIN SEÑAL', W / 2, 75);
    }
  }

  // tu celular: el contacto de tu mamá (en «tap» el botón verde se hunde)
  function contactoMama(tap) {
    g.fillStyle = '#0b0f14';
    g.fillRect(0, 0, W, H);
    barra();
    g.fillStyle = '#8e7ba6';
    g.beginPath();
    g.arc(W / 2, 46, 14, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fff';
    g.font = 'bold 14px sans-serif';
    g.textAlign = 'center';
    g.fillText('M', W / 2, 51);
    g.font = 'bold 11px sans-serif';
    g.fillText('Mamá', W / 2, 82);
    g.fillStyle = tap ? '#1a8447' : '#22a95a';
    g.beginPath();
    g.arc(W / 2, H - 26, tap ? 8 : 10, 0, Math.PI * 2);
    g.fill();
    if (tap) {
      // el pulgar encima del botón
      g.fillStyle = '#6b4f3e';
      g.fillRect(W / 2 - 6, H - 30, 14, 34);
    }
  }

  function pilaVacia() {
    g.fillStyle = '#000';
    g.fillRect(0, 0, W, H);
    if (t % .4 < .24) {
      g.strokeStyle = '#e4322b';
      g.lineWidth = 3;
      g.strokeRect(18, 60, 32, 18);
      g.fillStyle = '#e4322b';
      g.fillRect(51, 65, 4, 8);
      g.fillRect(22, 64, 3, 10);
    }
    g.fillStyle = '#e4322b';
    g.font = 'bold 8px monospace';
    g.textAlign = 'center';
    g.fillText('0%', W / 2, 94);
  }

  // se apaga: la imagen se cierra a una línea blanca y queda negra
  function apagando() {
    g.fillStyle = '#000';
    g.fillRect(0, 0, W, H);
    const k = Math.min(1, t / .3);
    if (k < 1) {
      g.fillStyle = '#fff';
      const h = Math.max(1, (1 - k) * 18);
      const w = k < .6 ? W : W * (1 - (k - .6) / .4);
      g.fillRect((W - w) / 2, H / 2 - h / 2, w, h);
    }
  }

  function dibujar() {
    if (modo === 'codex') {
      pantallaCodex();
      barra('#555');
    } else if (modo === 'cerrar') {
      // Codex se cierra: la app sube y se achica, y debajo aparece el teclado
      teclado();
      const k = Math.min(1, t / .45);
      pantallaCodex(-k * H * .9, 1 - k * .5);
    } else if (modo === 'marcar') teclado();
    else if (modo === 'llamando') llamando();
    else if (modo === 'cortado') cortado();
    else if (modo === 'mama') contactoMama(t > 1.1);
    else if (modo === 'vacia') pilaVacia();
    else if (modo === 'apagado') apagando();
    tex.needsUpdate = true;
  }

  function cambiar(m) {
    modo = m;
    t = 0;
    tick = -1; // redibujar ya
  }

  return {
    group,
    subir() {
      group.visible = true;
      meta = 1;
      cambiar('codex');
    },
    marcar() {
      group.visible = true;
      meta = 1;
      digitos = 0;
      cambiar('cerrar');
    },
    sinBateria(fin) {
      group.visible = true;
      meta = 1;
      alTerminar = fin || null;
      cambiar('mama');
    },
    get ocupado() { return modo === 'mama' || modo === 'vacia' || modo === 'apagado'; },
    cortar() {
      if (modo === 'nada') return;
      cambiar('cortado');
    },
    update(cam, dt) {
      if (!group.visible) return;
      t += dt;
      // cerrar Codex -> teclear -> llamando
      if (modo === 'cerrar' && t > .55) cambiar('marcar');
      if (modo === 'marcar') {
        const n = Math.min(NUMERO.length, Math.floor(t / .12));
        if (n > digitos) digitos = n;
        if (digitos >= NUMERO.length && t > NUMERO.length * .12 + .35) cambiar('llamando');
      }
      // tu celular sin batería: Mamá -> tocas llamar -> pila vacía -> se apaga -> lo guardas
      if (modo === 'mama' && t > 1.4) cambiar('vacia');
      if (modo === 'vacia' && t > 1.3) cambiar('apagado');
      if (modo === 'apagado' && t > .5) meta = 0;
      if (modo === 'apagado' && t > 1.1) {
        modo = 'nada';
        group.visible = false;
        alto = 0;
        const fin = alTerminar;
        alTerminar = null;
        fin?.();
        return;
      }
      alto += (meta - alto) * Math.min(1, dt * 7);
      off.lerpVectors(abajo, arriba, alto);
      if (modo === 'cortado') { off.x += (Math.random() - .5) * .003; off.y += (Math.random() - .5) * .003; }
      cam.updateMatrixWorld();
      group.position.copy(off).applyMatrix4(cam.matrixWorld);
      euler.set(.1, -.18, -.04);
      tilt.setFromEuler(euler);
      group.quaternion.copy(cam.quaternion).multiply(tilt);
      group.scale.setScalar(.8);
      // la pantalla se redibuja ~20 veces por segundo
      const k = Math.floor(t * 20);
      if (k !== tick) {
        tick = k;
        dibujar();
      }
    },
  };
}
