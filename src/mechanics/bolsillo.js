import * as THREE from 'three';
import { gastar, mostrarRegalos, tiene } from './regalos.js';

// Los regalos de la hora punta (mechanics/regalos.js) funcionando en cualquier vagón,
// igual que en el primero: así no "desaparecen" después de los borrados.
//   llavero    luz chica a tus pies (escolar)
//   completo   [E] lo tiras y los cercanos se van al olor (señora)
//   chocolate  te salva una vez cuando te agarran (vendedor, «pa'l susto»)
export function crearBolsillo(ctx) {
  mostrarRegalos(ctx);
  const llavero = new THREE.PointLight(0xbfe8ff, tiene(ctx, 'llavero') ? .55 : 0, 2.6, 1.5);
  ctx.stage.add(llavero);
  return {
    update(cam) {
      llavero.position.set(cam.position.x, .5, cam.position.z);
    },
    // Devuelve true si lo tiró.
    tirar(crowds, cam) {
      if (!tiene(ctx, 'completo')) return false;
      gastar(ctx, 'completo');
      for (const c of crowds) c.step(cam.position, -.6, 4);
      ctx.audio.sfx('paso', { cerca: true });
      ctx.hud.subtitle('Tiraste el completo. Algo se agacha a olerlo.', 2600);
      return true;
    },
    // Devuelve true si el chocolate te salvó (no te atraparon).
    salvar(crowds, cam, scene) {
      if (!tiene(ctx, 'chocolate')) return false;
      gastar(ctx, 'chocolate');
      for (const c of crowds) c.step(cam.position, -.9, 3);
      scene.overlay.u.uFlash.value = .9;
      ctx.audio.sfx('crujido');
      ctx.hud.subtitle('Algo te agarró… y te soltó. El chocolate se te cayó del bolsillo.', 3200);
      return true;
    },
  };
}
