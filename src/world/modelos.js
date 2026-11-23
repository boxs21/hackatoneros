import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { lambert } from './ps1.js';

// Modelos 3D de los 4 pasajeros (Quaternius, CC0; ver public/modelos/LEEME.txt).
// Se cargan apenas arranca el juego. Si un modelo no alcanzó a cargar o falla,
// el pasajero usa la figura de cubos de siempre (world/figura.js).
const ARCHIVO = { Escolar: 'escolar', Oficinista: 'oficinista', 'Señora': 'senora', Vendedor: 'vendedor' };
const IDLE = /\|(Idle|Man_Idle|Female_Idle)$/;

const cache = new Map();
const loader = new GLTFLoader();

export const modelosListos = Promise.all(Object.entries(ARCHIVO).map(async ([nombre, archivo]) => {
  try {
    const gltf = await loader.loadAsync(`${import.meta.env.BASE_URL}modelos/${archivo}.glb`);
    // Mismo look PS1 que el vagón: lambert con vértices que saltan y tramado.
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      const mats = (Array.isArray(o.material) ? o.material : [o.material]).map((m) =>
        lambert({ color: m.color ? m.color.clone() : new THREE.Color(0xffffff), map: m.map ?? null }));
      o.material = Array.isArray(o.material) ? mats : mats[0];
      o.frustumCulled = false; // las mallas con esqueleto calculan mal su caja
    });
    gltf.scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(gltf.scene);
    cache.set(nombre, {
      scene: gltf.scene,
      clip: gltf.animations.find((a) => IDLE.test(a.name)),
      clips: gltf.animations,
      alto: box.max.y - box.min.y,
      base: box.min.y,
    });
  } catch (err) {
    console.error(`[modelos] no se pudo cargar ${archivo}.glb`, err);
  }
}));

// Copia lista para poner en escena, parada en y=0 y de `alto` metros, con su animación de reposo.
// pose (opcional): otra animación por nombre (p. ej. /\|Death$/), detenida en su último cuadro.
export function modelo(nombre, alto = 1.7, { pose = null } = {}) {
  const m = cache.get(nombre);
  if (!m || !m.alto) return null;
  const obj = clone(m.scene);
  const s = alto / m.alto;
  obj.scale.multiplyScalar(s);
  obj.position.y = -m.base * s;
  let mixer = null;
  const fija = pose && m.clips?.find((a) => pose.test(a.name));
  if (fija) {
    // pose quieta (Renato: el vendedor muerto en el vagón del Escolar)
    mixer = new THREE.AnimationMixer(obj);
    const accion = mixer.clipAction(fija);
    accion.setLoop(THREE.LoopOnce, 1);
    accion.clampWhenFinished = true;
    accion.play();
    mixer.setTime(fija.duration);
    return { obj, mixer: null };
  }
  if (m.clip) {
    mixer = new THREE.AnimationMixer(obj);
    const accion = mixer.clipAction(m.clip);
    accion.play();
    accion.time = Math.random() * m.clip.duration; // que no respiren todos al mismo tiempo
  }
  return { obj, mixer };
}
