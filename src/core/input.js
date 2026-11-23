// Teclado + mouse. Usa siempre e.code (KeyW, KeyF, Digit1…), no e.key.
//   input.down('KeyW')     -> mantenida
//   input.pressed('KeyF')  -> apretada en este frame (solo una vez)
//   input.mouse.dx / dy    -> movimiento del mouse en este frame
export function createInput(target) {
  const held = new Set();
  const justPressed = new Set();
  const mouse = { dx: 0, dy: 0, locked: false };

  addEventListener('keydown', (e) => {
    if (!e.repeat) justPressed.add(e.code);
    held.add(e.code);
    if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
  });
  addEventListener('keyup', (e) => held.delete(e.code));
  addEventListener('blur', () => held.clear());

  addEventListener('mousemove', (e) => {
    if (!mouse.locked) return;
    mouse.dx += e.movementX;
    mouse.dy += e.movementY;
  });
  document.addEventListener('pointerlockchange', () => {
    mouse.locked = document.pointerLockElement === target;
  });

  return {
    mouse,
    down: (code) => held.has(code),
    pressed: (code) => justPressed.has(code),
    lockPointer() {
      if (!mouse.locked) target.requestPointerLock?.()?.catch?.(() => {});
    },
    // Lo llama main.js al final de cada frame.
    endFrame() {
      justPressed.clear();
      mouse.dx = 0;
      mouse.dy = 0;
    },
  };
}
