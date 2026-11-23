import * as THREE from 'three';

// Estado de relleno: muestra el nombre del momento y un cubo de color
// para confirmar que el flujo funciona. Enter avanza al siguiente.
// Cada dueño reemplaza su archivo por la escena real.
export function placeholder({ id, title, sub = '', next, hint, autoAdvance = true, color = 0x888888 }) {
  let cube = null;
  return {
    id,
    next,
    hint,
    autoAdvance,
    enter(ctx) {
      ctx.hud.title(title, `${sub}${sub ? ' · ' : ''}[Enter] siguiente`);
      cube = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshLambertMaterial({ color }),
      );
      cube.position.set(0, 1.6, -3);
      ctx.stage.add(cube, new THREE.HemisphereLight(0xffffff, 0x222233, 1.2));
    },
    update(dt, ctx) {
      cube.rotation.y += dt;
      cube.rotation.x += dt * 0.4;
      if (ctx.input.pressed('Enter')) ctx.next();
    },
    exit(ctx) {
      ctx.hud.title('');
    },
  };
}
