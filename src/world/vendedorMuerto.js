import * as THREE from 'three';
import { modelo } from './modelos.js';
import { createFigura } from './figura.js';
import { lambert } from './ps1.js';
import { dar, tiene } from '../mechanics/regalos.js';

// EL VENDEDOR MUERTO Y SU MOCHILA (vagón del Escolar). Hecho por Renato.
// Al cambiar de vagón lo encuentras tirado en el piso, con su mochila al lado.
// Con E te agachas, abres la mochila (la tapa se levanta y se ven los chocolates),
// «Le quedaban 23 chocolates… sacaré solo uno, por si acaso.», sacas uno y es tu chocolate
// (te salva una vez, mechanics/bolsillo.js). La cámara se fija mientras tanto.

const RADIO = 1.5;
const AGACHADO = 1.0; // altura de la cámara al agacharse

// La mochila del Vendedor (también va en la banca del final, cerrada).
// Parada en el piso mirando hacia +z: cuerpo de lona, tapa redondeada con cierre
// que se abre desde atrás, bolsillo delantero, bolsillos laterales, tirantes y
// manilla. Con chocolates: 23 barras paradas adentro (el número 23).
export function crearMochilaVendedor({ conChocolates = true } = {}) {
  const g = new THREE.Group();
  const lona = lambert({ color: 0x3f5a35 });
  const lonaOsc = lambert({ color: 0x2f4428 });
  const correa = lambert({ color: 0x1b1d1f });
  const metal = lambert({ color: 0xc9ccd3 });
  const W = .34;
  const D = .2;
  const H = .34;
  const pieza = (geo, m, x, y, z, padre = g) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    padre.add(mesh);
    return mesh;
  };
  const caja = (w, h, d, m, x, y, z, padre) => pieza(new THREE.BoxGeometry(w, h, d), m, x, y, z, padre);
  // media caña a lo largo de x (para lo redondeado de arriba)
  const media = (r, largo, m, x, y, z, padre) => {
    const mesh = pieza(new THREE.CylinderGeometry(r, r, largo, 10, 1, false, 0, Math.PI), m, x, y, z, padre);
    mesh.rotation.z = Math.PI / 2;
    return mesh;
  };
  // cuerpo abierto arriba (para ver adentro al abrir): base y cuatro paredes
  caja(W + .01, .035, D + .01, lonaOsc, 0, .017, 0);
  caja(W, H, .02, lona, 0, H / 2, D / 2 - .01);
  caja(W, H, .02, lona, 0, H / 2, -D / 2 + .01);
  caja(.02, H, D, lona, -W / 2 + .01, H / 2, 0);
  caja(.02, H, D, lona, W / 2 - .01, H / 2, 0);
  // bolsillo delantero redondeado arriba, con su cierre
  caja(.26, .16, .06, lonaOsc, 0, .1, D / 2 + .03);
  media(.03, .26, lonaOsc, 0, .18, D / 2 + .03);
  caja(.24, .008, .008, correa, 0, .2, D / 2 + .052);
  caja(.02, .03, .006, metal, .1, .185, D / 2 + .058);
  // bolsillos laterales
  caja(.03, .13, .14, lonaOsc, -W / 2 - .015, .08, 0);
  caja(.03, .13, .14, lonaOsc, W / 2 + .015, .08, 0);
  // tirantes en la espalda
  for (const x of [-.09, .09]) {
    const t = caja(.045, .3, .02, correa, x, .19, -D / 2 - .02);
    t.rotation.x = .12;
  }
  // tapa: media caña con cierre al frente y manilla; gira desde la bisagra de atrás
  const bisagra = new THREE.Group();
  bisagra.position.set(0, H, -D / 2);
  media(D / 2, W, lambert({ color: 0x3f5a35, side: THREE.DoubleSide }), 0, 0, D / 2, bisagra); // doble cara: se ve abierta
  caja(W, .01, .01, correa, 0, .004, D, bisagra); // cierre
  caja(.022, .034, .006, metal, .08, -.012, D + .006, bisagra); // el tirador del cierre
  const manilla = pieza(new THREE.TorusGeometry(.035, .008, 4, 10, Math.PI), correa, 0, D / 2 - .005, D / 2 - .03, bisagra);
  manilla.rotation.y = Math.PI / 2;
  g.add(bisagra);

  const barras = [];
  if (conChocolates) {
    const envoltorio = lambert({ color: 0xe4322b });
    const franja = lambert({ color: 0xf2b705 });
    const barra = new THREE.BoxGeometry(.03, .2, .026);
    const franjaGeo = new THREE.BoxGeometry(.032, .04, .028);
    for (let i = 0; i < 23; i++) {
      const b = new THREE.Group();
      b.add(new THREE.Mesh(barra, envoltorio));
      const f = new THREE.Mesh(franjaGeo, franja);
      f.position.y = .04;
      b.add(f);
      b.position.set(-.13 + (i % 8) * .037, .2, -.05 + Math.floor(i / 8) * .05);
      g.add(b);
      barras.push(b);
    }
  }
  return { g, bisagra, barras };
}

export function crearVendedorMuerto(ctx, { x = .85, z = 9.0 } = {}) {
  const grupo = new THREE.Group();
  // el vendedor: su modelo con la animación de muerte, quieto en el piso
  const md = modelo('Vendedor', 1.7, { pose: /\|Death$/ });
  if (md) {
    grupo.add(md.obj);
  } else {
    // sin modelo: la figura de cubos, acostada
    const fig = createFigura({ ropa: 0xb5642e, pantalon: 0x2c3340, piel: '#a87a5a' });
    fig.root.rotation.x = -Math.PI / 2;
    fig.root.position.y = .15;
    grupo.add(fig.root);
  }
  grupo.position.set(x, 0, z);
  grupo.rotation.y = Math.PI * .8;
  const { g: mochila, bisagra, barras } = crearMochilaVendedor();
  mochila.position.set(x - .55, 0, z + .45);
  mochila.rotation.y = .5;
  // una luz de emergencia tenue encima, para que se alcance a ver
  const luz = new THREE.PointLight(0xffb070, .9, 3.2, 1.6);
  luz.position.set(x - .3, 1.6, z + .3);
  ctx.stage.add(grupo, mochila, luz);

  const centro = new THREE.Vector3();
  mochila.getWorldPosition(centro);
  centro.y = .2;
  const sacado = barras[barras.length - 1];
  const desde = sacado.position.clone();

  // si ya sacaste el chocolate (reintento), la mochila queda abierta y con 22
  let fase = tiene(ctx, 'chocolate') && ctx.memoria.chocolateDelVendedor ? 'hecho' : 'cerrada';
  if (fase === 'hecho') {
    bisagra.rotation.x = -2.1;
    sacado.visible = false;
  }
  let t = 0;
  let avisado = false;
  let base = null; // posición y altura de la cámara antes de agacharse
  const ease = (a) => a * a * (3 - 2 * a);

  return {
    get ocupado() { return fase === 'abriendo'; },
    get cerca() { return fase === 'cerrada' && base === null && this._cerca; },
    _cerca: false,
    update(dt, c) {
      const cam = c.camera;
      const d = Math.hypot(cam.position.x - centro.x, cam.position.z - centro.z);
      this._cerca = d < RADIO;
      if (fase === 'cerrada') {
        if (this._cerca && !avisado) {
          avisado = true;
          c.hud.subtitle('Es el vendedor de chocolates… Su mochila está a su lado. [E]', 3400);
        }
        if (this._cerca && c.input.pressed('KeyE')) {
          fase = 'abriendo';
          t = 0;
          base = { x: cam.position.x, y: cam.position.y, z: cam.position.z };
          c.progress?.();
        }
        return;
      }
      if (fase !== 'abriendo') return;
      t += dt;
      // te agachas y te quedas quieto mirando la mochila
      const baja = t < 2.9 ? ease(Math.min(1, t / .5)) : ease(Math.max(0, 1 - (t - 2.9) / .5));
      cam.position.set(base.x, base.y + (AGACHADO - base.y) * baja, base.z);
      const dx = centro.x - cam.position.x;
      const dz = centro.z - cam.position.z;
      const yaw = Math.atan2(-dx, -dz);
      const pitch = Math.atan2(centro.y - cam.position.y, Math.hypot(dx, dz));
      const k = Math.min(1, dt * 6);
      cam.rotation.order = 'YXZ';
      cam.rotation.y += Math.atan2(Math.sin(yaw - cam.rotation.y), Math.cos(yaw - cam.rotation.y)) * k;
      cam.rotation.x += (pitch - cam.rotation.x) * k;
      // la tapa se abre
      if (t > .4 && t < 1.3) {
        const a = ease((t - .4) / .9);
        bisagra.rotation.x = -2.1 * a;
        if (t - dt <= .4) c.audio.sfx('ui', { volume: .5 });
      }
      if (t > 1.2 && t - dt <= 1.2) c.hud.subtitle('Le quedaban 23 chocolates… sacaré solo uno, por si acaso.', 3400);
      // sacas uno: sube y se viene hacia ti
      if (t > 2.0 && t < 2.6) {
        const a = ease((t - 2.0) / .6);
        sacado.position.set(desde.x, desde.y + a * .35, desde.z + a * .15);
        sacado.rotation.z = a * .6;
      }
      if (t >= 2.6 && sacado.visible) {
        sacado.visible = false;
        dar(c, 'Vendedor');
        c.memoria.chocolateDelVendedor = true;
        c.hud.obtenido('Chocolate', 'te salva una vez');
      }
      if (t > 3.4) {
        fase = 'hecho';
        base = null;
      }
    },
  };
}
