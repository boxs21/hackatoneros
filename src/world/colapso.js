import * as THREE from 'three';
import { lambert } from './ps1.js';
import { walkVagon } from './vagonEscena.js';

// EL VAGÓN SE DESARMA. Último vagón: a mitad de camino todo empieza a temblar,
// las luces vuelven a tirones, se sueltan los fierros, revientan los vidrios, las
// puertas se van con el viento, el piso cede y caes al vacío. Termina en blanco.
//
//   const colapso = createColapso(ctx, scene, { crowd });
//   colapso.start();                              // una vez, al cruzar la mitad
//   if (colapso.update(dt, flash)) ctx.go(...)    // true cuando ya es todo blanco
//
// No crea nada después de createColapso: mueve lo que ya está en el vagón
// (world/vagon.js) y un puñado de astillas instanciadas.

const T_SUELTA = 2.2; // empiezan a caer cosas
const T_VIDRIOS = 4.4; // revientan las ventanas, se van las puertas
const T_CAE = 6.8; // el piso cede
const T_BLANCO = 9.0; // destello
const ASTILLAS = 280;
const G = 9.8;

// Blanco total sobre la pantalla (el destello). Lo suelta el estado siguiente.
export function destello() {
  let el = document.getElementById('destello');
  if (!el) {
    el = document.createElement('div');
    el.id = 'destello';
    el.style.cssText = 'position:absolute;inset:0;z-index:20;background:#fff;pointer-events:none;opacity:0;';
    document.getElementById('screen')?.appendChild(el);
  }
  el.style.transition = 'none';
  el.style.opacity = '1';
}
export function soltarDestello(ms = 3500) {
  const el = document.getElementById('destello');
  if (!el) return;
  // dos cuadros para que el navegador tome el cambio de transición
  requestAnimationFrame(() => requestAnimationFrame(() => {
    el.style.transition = `opacity ${ms}ms ease-out`;
    el.style.opacity = '0';
  }));
  setTimeout(() => el.remove(), ms + 400);
}

export function createColapso(ctx, scene, { crowd } = {}) {
  const stage = ctx.stage;
  const cam = ctx.camera;
  const vagon = scene.vagon.group;
  const parts = scene.vagon.parts;
  const rnd = (a, b) => a + Math.random() * (b - a);

  // ---- qué se puede soltar: se reconoce por su forma (así no hay que tocar vagon.js)
  const palos = [];
  const vidrios = [];
  for (const o of vagon.children) {
    const p = o.geometry?.parameters;
    if (!o.isMesh || !p) continue;
    if (o.material === parts.mats.vidrio) vidrios.push({ mesh: o, largo: p.depth, t0: 0, roto: false });
    else if (p.height >= 3 && p.width <= .07) {
      const a = rnd(0, Math.PI * 2);
      palos.push({
        mesh: o, alto: p.height, base: new THREE.Vector3(o.position.x, 0, o.position.z),
        eje: new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), ang: 0, vel: 0, t0: 0, listo: false,
      });
    }
  }
  const sueltos = [...parts.tubes, ...parts.ads, ...parts.maps].map((mesh) => ({
    mesh, vy: 0, giro: new THREE.Vector3(rnd(-3, 3), rnd(-2, 2), rnd(-3, 3)), t0: 0, piso: false,
  }));
  const hojas = parts.leaves.map((l) => ({ ...l, t0: 0, v: 0 }));

  // el orden en que se desarma: desde donde estás hacia los extremos
  const porCercania = (z) => Math.abs(z - cam.position.z);
  function programar() {
    palos.forEach((p) => { p.t0 = T_SUELTA + porCercania(p.base.z) * .16 + rnd(0, .5); });
    sueltos.forEach((s) => { s.t0 = T_SUELTA - .6 + porCercania(s.mesh.position.z) * .14 + rnd(0, .9); });
    vidrios.forEach((v) => { v.t0 = T_VIDRIOS + porCercania(v.mesh.position.z) * .1 + rnd(0, .5); });
    hojas.forEach((h) => { h.t0 = T_VIDRIOS + .3 + porCercania(h.dz) * .08 + rnd(0, .4); });
  }

  // ---- luces que vuelven a tirones (creadas de antemano)
  const luces = [-7, 0, 7].map((dz) => {
    const l = new THREE.PointLight(0xf2f6ff, 0, 11, 1);
    l.userData.dz = dz;
    stage.add(l);
    return l;
  });

  // ---- astillas
  const tri = new THREE.BufferGeometry();
  tri.setAttribute('position', new THREE.Float32BufferAttribute([0, .08, 0, -.06, -.05, 0, .07, -.04, 0], 3));
  tri.computeVertexNormals();
  const astillas = new THREE.InstancedMesh(tri, lambert({ color: 0xcfe6ee, emissive: 0x2a3438, side: THREE.DoubleSide }), ASTILLAS);
  astillas.frustumCulled = false;
  astillas.count = 0;
  stage.add(astillas);
  const sh = [];
  const o = new THREE.Object3D();
  for (let i = 0; i < ASTILLAS; i++) sh.push({ p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Vector3(), w: new THREE.Vector3(), s: 1 });
  let usadas = 0;

  function reventar(v) {
    v.roto = true;
    v.mesh.visible = false;
    const s = Math.sign(v.mesh.position.x) || 1;
    const n = Math.min(34, ASTILLAS - usadas);
    for (let k = 0; k < n; k++) {
      const a = sh[usadas++];
      a.p.set(s * 2.42, 1.9 + rnd(-.5, .5), v.mesh.position.z + rnd(-.5, .5) * v.largo);
      a.v.set(-s * rnd(.5, 5), rnd(0, 3), rnd(-2, 2));
      a.w.set(rnd(-14, 14), rnd(-14, 14), rnd(-14, 14));
      a.r.set(rnd(0, 6), rnd(0, 6), rnd(0, 6));
      a.s = rnd(.6, 1.9);
    }
    astillas.count = usadas;
  }

  // manillas: se balancean cada vez más
  const tiras = parts.straps;
  function manillas(t, fuerza) {
    tiras.list.forEach(([x, z], i) => {
      o.position.set(x, 2.2, z);
      o.rotation.set(Math.sin(t * 7.3 + i * 1.7) * fuerza * .5, Math.PI / 2, Math.sin(t * 9 + i * 2.3) * fuerza);
      o.scale.setScalar(1);
      o.updateMatrix();
      tiras.strapMesh.setMatrixAt(i, o.matrix);
      tiras.ringMesh.setMatrixAt(i, o.matrix);
    });
    tiras.strapMesh.instanceMatrix.needsUpdate = true;
    tiras.ringMesh.instanceMatrix.needsUpdate = true;
  }

  const q = new THREE.Quaternion();
  const arriba = new THREE.Vector3();
  let t = -1; // < 0: todavía no parte
  let ruido = 0; // próximo crujido
  let golpes = 0;
  let cristales = 0;
  let ultimoVidrio = -9;
  let vy = 0; // caída de la cámara
  let yaw0 = 0;
  let dicho = 0;
  let blanco = false;

  const decir = (n, texto, ms) => { if (dicho < n) { dicho = n; ctx.hud.subtitle(texto, ms); } };

  return {
    get activo() { return t >= 0; },
    start() {
      if (t >= 0) return;
      t = 0;
      yaw0 = cam.rotation.y;
      programar();
      ctx.audio.sfx('frenazo', { volume: .7 });
      ctx.audio.sfx('derrumbe');
      ctx.misiones?.set('Afírmate');
    },

    // Devuelve true cuando ya terminó (todo blanco): el estado cambia de escena.
    update(dt, flash) {
      if (t < 0) return false;
      t += dt;
      const now = performance.now();
      const k = Math.min(1, t / T_CAE); // 0 a 1 hasta que cede el piso
      const cae = t >= T_CAE;

      // caminar: cada vez cuesta más; cuando cede el piso ya no hay control
      if (!cae) {
        walkVagon(dt, ctx, { colliders: scene.colliders, speed: 1.6 * (1 - k * .8) });
        cam.position.x += Math.sin(t * 3.1) * dt * k * .9; // el piso te bota de lado
      }

      // temblor: giro y posición
      const sac = cae ? .5 : .08 + k * k * .9;
      cam.rotation.z = (Math.sin(t * 47) * .5 + Math.sin(t * 29.3) * .5) * sac * .09 + Math.sin(t * 1.9) * k * .12;
      cam.position.y += (Math.random() - .5) * sac * .05;
      // el vagón se va de lado
      vagon.rotation.z = Math.sin(t * 2.3) * k * k * .07;
      vagon.position.y = Math.sin(t * 31) * k * .02;

      // las luces vuelven a tirones: blanco y rojo de emergencia
      const on = Math.sin(t * 41) > .2 || Math.sin(t * 13.7) > .75;
      const roja = Math.sin(t * 5.3) > .3;
      for (const l of luces) {
        l.position.set(0, 2.7, cam.position.z + l.userData.dz);
        l.color.setHex(roja ? 0xff2a1a : 0xf2f6ff);
        l.intensity = on ? (1.2 + k * 3.2) * (cae ? .5 : 1) : .05;
      }
      parts.mats.tubo.emissive?.setHex(on && !roja ? 0xd8f0ff : 0x000000);
      manillas(t, .15 + k * 1.1);

      // peligro que se oye: sube hasta el tope
      scene.danger = Math.min(1, .35 + k * .8);
      scene.miedo = cae ? .3 : scene.danger; // al caer baja: el derrumbe ya llena todo y el corazón se oye solo
      scene.overlay.u.uDanger.value = Math.min(1, k * 1.1);
      scene.light(flash ? flash.level(now) : 0, dt, flash);
      crowd?.show(cae ? 0 : 1, cae ? 0 : 1); // ahora se ven: están todos mirándote

      // crujidos y golpes, cada vez más seguidos
      ruido -= dt;
      if (ruido <= 0 && !cae) {
        ruido = rnd(.12, .7) * (1.2 - k);
        ctx.audio.sfx(Math.random() > .5 ? 'crujido' : 'empujon', { volume: .3 + k * .3, pan: rnd(-.9, .9) });
      }

      // fierros que se sueltan
      for (const p of palos) {
        if (t < p.t0 || p.listo) continue;
        p.vel += dt * 5 * Math.sin(p.ang + .1);
        p.ang += p.vel * dt;
        if (p.ang >= 1.46) {
          p.ang = 1.46;
          p.listo = true;
          if (golpes++ < 9) ctx.audio.sfx('empujon', { volume: .6, pan: Math.sign(p.base.x) * .6 });
        }
        q.setFromAxisAngle(p.eje, p.ang);
        p.mesh.quaternion.copy(q);
        p.mesh.position.copy(arriba.set(0, p.alto / 2, 0).applyQuaternion(q)).add(p.base);
      }
      // tubos, avisos y mapas que caen
      for (const s of sueltos) {
        if (t < s.t0 || s.piso) continue;
        s.vy -= G * dt;
        s.mesh.position.y += s.vy * dt;
        s.mesh.rotation.x += s.giro.x * dt;
        s.mesh.rotation.z += s.giro.z * dt;
        if (s.mesh.position.y <= .06 && !cae) { s.mesh.position.y = .06; s.piso = true; }
      }
      // ventanas
      for (const v of vidrios) {
        if (v.roto || t < v.t0) continue;
        reventar(v);
        // el sonido, a 0,5 y nunca dos dentro de 0,3 s (los vidrios se ven todos; se oyen espaciados)
        if (cristales < 6 && t - ultimoVidrio > .3) {
          cristales += 1;
          ultimoVidrio = t;
          ctx.audio.sfx('vidrio', { volume: .5, pan: Math.sign(v.mesh.position.x) * .7 });
        }
      }
      // puertas: se las lleva el viento
      for (const h of hojas) {
        if (t < h.t0) continue;
        h.v += dt * 14;
        h.mesh.position.x += h.s * h.v * dt;
        h.mesh.position.z += h.v * dt * .6;
        h.mesh.rotation.y += dt * 3 * h.k;
      }
      // astillas
      for (let i = 0; i < usadas; i++) {
        const a = sh[i];
        if (cae) a.v.y = Math.max(a.v.y - G * dt * .2, vy * .92); // caen contigo: flotan a tu alrededor
        else a.v.y -= G * dt;
        a.p.addScaledVector(a.v, dt);
        a.r.addScaledVector(a.w, dt);
        if (!cae && a.p.y < .02) { a.p.y = .02; a.v.set(0, 0, 0); a.w.set(0, 0, 0); }
        o.position.copy(a.p);
        o.rotation.set(a.r.x, a.r.y, a.r.z);
        o.scale.setScalar(a.s);
        o.updateMatrix();
        astillas.setMatrixAt(i, o.matrix);
      }
      if (usadas) astillas.instanceMatrix.needsUpdate = true;

      // lo que se dice
      if (t > .4) decir(1, 'El tren frena. Aquí no hay estación.', 2400);
      if (t > T_SUELTA + .4) decir(2, 'VENDEDOR: Le dije que no se quedara dormi—', 2000);
      if (t > T_VIDRIOS + .5) decir(3, 'Todos te están mirando.', 1800);

      // el piso cede: caes, y el vagón se queda arriba
      if (cae) {
        const c = t - T_CAE;
        if (dicho < 4) {
          dicho = 4;
          ctx.audio.sfx('frenazo', { volume: .6 });
          ctx.audio.sfx('vidrio', { volume: .5 });
          ctx.hud.subtitle('', 10);
        }
        vy -= G * dt * 1.15;
        cam.position.y += vy * dt;
        cam.rotation.x += (1.15 - cam.rotation.x) * Math.min(1, dt * 1.6); // miras hacia arriba: el vagón se aleja
        cam.rotation.y = yaw0 + c * .35;
        vagon.rotation.x = -c * .1;
        vagon.rotation.z += c * dt * .25;
        scene.overlay.u.uVig.value = Math.min(1.4, .75 + c * .35);
        // el blanco entra de a poco antes del golpe
        scene.overlay.u.uFlash.value = Math.max(scene.overlay.u.uFlash.value, Math.max(0, (t - (T_BLANCO - .5)) / .5));
      }

      if (t >= T_BLANCO && !blanco) {
        blanco = true;
        destello();
        ctx.audio.silencio();
        ctx.audio.sfx('flashbang', { delay: .08 });
        cam.rotation.z = 0;
        return true;
      }
      return false;
    },
  };
}
