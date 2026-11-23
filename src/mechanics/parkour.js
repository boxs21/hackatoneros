import * as THREE from 'three';

// Saltos en primera persona, simples y perdonadores.
// - Plataformas = cajas { minX, maxX, minZ, maxZ, top, h, dy? } (dy: se mueven en y).
// - Espacio salta. "Coyote time": puedes saltar un instante después de salir del borde.
//   "Buffer": si aprietas un poco antes de aterrizar, el salto se guarda.
// - Caer bajo FALL_Y = volver al último lugar firme.
export const EYE = 1.55;
const R = .22; // radio del jugador
const GRAVITY = 15;
const JUMP_V = 5.7; // ~1,08 m de altura
const SPEED = 3.0;
const AIR_CONTROL = 1; // control completo en el aire: perdona más
const COYOTE = .16;
const BUFFER = .14;
const FALL_Y = -2.6;
const STEP_UP = .32; // se sube solo a escalones bajos (como una vereda)

export function createParkour(ctx, platforms, { start, minX = -2.25, maxX = 2.25, minZ = -12.6, maxZ = 12.6 } = {}) {
  const cam = ctx.camera;
  // start = { x, z, plat }: dónde partes (sobre esa plataforma)
  const p = { x: start.x, z: start.z, y: start.plat.top, vy: 0 };
  let ground = start.plat;
  let lastGround = 0; // tiempo desde que tocaste suelo
  let jumpAsk = 9; // tiempo desde que pediste saltar
  let safe = { x: start.x, z: start.z, y: start.plat.top, plat: start.plat };
  let bob = 0;
  let t = 0;
  cam.rotation.order = 'YXZ';

  const over = (pl, x, z, m = R * 1.3) => x > pl.minX - m && x < pl.maxX + m && z > pl.minZ - m && z < pl.maxZ + m;

  // Volver al centro del último lugar firme (a su altura actual, por si se mueve).
  function respawn() {
    p.x = safe.x;
    p.z = safe.z;
    p.y = safe.plat ? safe.plat.top : safe.y;
    p.vy = 0;
    ground = safe.plat;
  }

  return {
    get player() { return p; },
    get grounded() { return Boolean(ground); },
    get ground() { return ground; },
    respawn,
    update(dt) {
      t += dt;
      const { input } = ctx;
      // mirar (igual que walkVagon)
      const turn = Number(input.down('ArrowLeft')) - Number(input.down('ArrowRight'));
      cam.rotation.y += turn * dt * 2.2 - input.mouse.dx * .0022;
      cam.rotation.x = THREE.MathUtils.clamp(cam.rotation.x - input.mouse.dy * .0022, -1.2, 1.1);

      // plataformas que se mueven (y llevan al jugador)
      for (const pl of platforms) {
        if (!pl.dy) continue;
        const prev = pl.top;
        pl.top = pl.baseTop + Math.sin(t * pl.speed + pl.phase) * pl.dy;
        if (ground === pl) p.y += pl.top - prev;
        pl.mesh.position.y = pl.top - pl.h / 2;
      }

      // caminar
      const fwd = Number(input.down('KeyW') || input.down('ArrowUp')) - Number(input.down('KeyS') || input.down('ArrowDown'));
      const right = Number(input.down('KeyD')) - Number(input.down('KeyA'));
      const len = Math.hypot(fwd, right);
      const sp = (ground ? SPEED : SPEED * AIR_CONTROL) * dt / Math.max(1, len);
      const yaw = cam.rotation.y;
      let nx = p.x + sp * (right * Math.cos(yaw) - fwd * Math.sin(yaw));
      let nz = p.z - sp * (fwd * Math.cos(yaw) + right * Math.sin(yaw));

      // costados de las plataformas: no se atraviesan (salvo escalones bajos)
      for (const pl of platforms) {
        const bottom = pl.top - pl.h;
        if (p.y >= pl.top - STEP_UP || p.y + 1.7 <= bottom) continue;
        if (!(nx > pl.minX - R && nx < pl.maxX + R && nz > pl.minZ - R && nz < pl.maxZ + R)) continue;
        const pushX = Math.min(Math.abs(nx - (pl.minX - R)), Math.abs(nx - (pl.maxX + R)));
        const pushZ = Math.min(Math.abs(nz - (pl.minZ - R)), Math.abs(nz - (pl.maxZ + R)));
        if (pushX < pushZ) nx = Math.abs(nx - (pl.minX - R)) < Math.abs(nx - (pl.maxX + R)) ? pl.minX - R : pl.maxX + R;
        else nz = Math.abs(nz - (pl.minZ - R)) < Math.abs(nz - (pl.maxZ + R)) ? pl.minZ - R : pl.maxZ + R;
      }
      nx = THREE.MathUtils.clamp(nx, minX, maxX);
      nz = THREE.MathUtils.clamp(nz, minZ, maxZ);
      const moved = Math.hypot(nx - p.x, nz - p.z);
      p.x = nx;
      p.z = nz;

      // saltar (con coyote y buffer)
      jumpAsk = input.pressed('Space') ? 0 : jumpAsk + dt;
      lastGround = ground ? 0 : lastGround + dt;
      let jumped = false;
      if (jumpAsk < BUFFER && lastGround < COYOTE) {
        p.vy = JUMP_V;
        ground = null;
        lastGround = COYOTE;
        jumpAsk = BUFFER;
        jumped = true;
        ctx.audio.sfx('paso', { volume: .35 });
      }

      // caer / aterrizar
      if (ground && !over(ground, p.x, p.z)) ground = null;
      // subir escalones bajos caminando
      if (ground) {
        for (const pl of platforms) {
          if (pl !== ground && pl.top > p.y && pl.top - p.y <= STEP_UP && over(pl, p.x, p.z, 0)) { ground = pl; p.y = pl.top; }
        }
      }
      let landed = false;
      if (!ground) {
        const prevY = p.y;
        p.vy -= GRAVITY * dt;
        p.y += p.vy * dt;
        if (p.vy <= 0) {
          let best = null;
          for (const pl of platforms) {
            if (prevY >= pl.top - .06 && p.y <= pl.top && over(pl, p.x, p.z)) {
              if (!best || pl.top > best.top) best = pl;
            }
          }
          if (best) {
            p.y = best.top;
            p.vy = 0;
            ground = best;
            landed = true;
            ctx.audio.sfx('paso', { volume: .45 });
            if (!best.unsafe) safe = { x: (best.minX + best.maxX) / 2, z: (best.minZ + best.maxZ) / 2, y: best.top, plat: best };
          }
        }
      }
      let fell = false;
      if (p.y < FALL_Y) {
        fell = true;
        respawn();
      }

      // cámara: ojos + balanceo al caminar en el suelo
      bob += ground ? moved * 5.5 : 0;
      cam.position.set(p.x, p.y + EYE + (ground && moved > 1e-4 ? Math.sin(bob) * .03 : 0), p.z);
      if (ground && moved > 1e-4) {
        this.stepDist = (this.stepDist || 0) + moved;
        if (this.stepDist > .72) { this.stepDist = 0; ctx.audio.sfx('paso', { volume: .28 }); }
      }
      return { fell, landed, jumped, grounded: Boolean(ground) };
    },
  };
}
