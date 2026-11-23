// 1 · Pantalla de inicio. Dueño: Valentín (look: Renato).
// El primer click desbloquea el audio y captura el mouse (requisito del navegador).
export default {
  id: 'inicio',
  next: 'horaPunta',
  enter(ctx) {
    ctx.hud.title('FIN DE SERVICIO', 'Haz click para empezar · se recomiendan audífonos');
    this.onClick = async () => {
      await ctx.audio.unlock();
      ctx.input.lockPointer();
      ctx.next();
    };
    ctx.canvas.addEventListener('click', this.onClick, { once: true });
  },
  update() {},
  exit(ctx) {
    ctx.canvas.removeEventListener('click', this.onClick);
    ctx.hud.title('');
  },
};
