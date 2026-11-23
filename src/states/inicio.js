// 1 · Pantalla de inicio. Dueño: Valentín (menú: Andy, en src/menu/).
// El primer gesto del jugador desbloquea el audio; "Comenzar" captura el mouse
// (los dos son requisitos del navegador) y pasa a hora punta.
import { abrirMenu } from '../menu/menu.js';

export default {
  id: 'inicio',
  next: 'horaPunta',
  enter(ctx) {
    this.menu = abrirMenu(ctx, { alComenzar: () => ctx.next() });
  },
  update() {},
  exit() {
    this.menu?.cerrar();
    this.menu = null;
  },
};
