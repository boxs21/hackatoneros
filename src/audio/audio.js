// INTERFAZ DE AUDIO. Dueño: Andy.
// Esta es solo la interfaz con implementaciones vacías, para que todos
// puedan llamarla desde ya. Andy reemplaza el cuerpo de cada función;
// los nombres y parámetros no se cambian sin avisar al equipo.
let ac = null;

export const audio = {
  // Se llama en el primer click (pantalla de inicio). Sin esto no suena nada.
  async unlock() {
    ac ??= new AudioContext();
    if (ac.state === 'suspended') await ac.resume();
  },
  get context() { return ac; },
  sfx(name, opts = {}) { console.debug('[audio] sfx', name, opts); },
  voz(personaje, frase, opts = {}) { console.debug('[audio] voz', personaje, frase, opts); },
  ambiente(name, opts = {}) { console.debug('[audio] ambiente', name, opts); },
  // Corte total y seco, sin fade (apagón).
  silencio() { console.debug('[audio] silencio'); },
  // Sonido en el espacio 3D. position: THREE.Vector3. Devuelve un control.
  posicional(name, position, opts = {}) {
    console.debug('[audio] posicional', name, position, opts);
    return { setPosition() {}, stop() {} };
  },
  musica(name, opts = {}) { console.debug('[audio] musica', name, opts); },
  stopAll() {},
};
