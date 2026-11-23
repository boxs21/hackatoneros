// Modo pintura (rama de prueba, Andy). Un cuadro al óleo en movimiento:
// claroscuro con sombras reales del flash, bloom, rayos de luz a contraluz,
// foco de cámara, polvo en el haz y pétalos que se desprenden de los borrados.
//
// No cambia ninguna regla del juego: lo oscuro sigue oscuro y los borrados
// solo se ven con luz. Todo se enchufa desde afuera: main.js llama a
// gfx.render(dt) y world/ps1.js pide los materiales a gfx/materiales.js.
// Tecla G: alterna con el look PS1 original. Se adapta sola al computador.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GFX, guardarGfx } from './config.js';
import * as SH from './shaders.js';
import { createParticulas } from './particulas.js';
import { createHaces } from './haces.js';
import { createDisolucion, parcharBorrado as parcheBorrado } from './disolucion.js';
import { createMundo, SOL } from './mundo.js';
import { createEscenas } from './escenas.js';
import { borradoGeometry } from '../world/figura.js';
import './gfx.css';

const PS1 = { w: 320, h: 240 };
const ASPECT = 16 / 9;
const NIVELES = {
  baja: { tope: 960, msaa: 0, radio: 2.2, dof: 0, ao: 0, ssr: 0, sombra: 512 },
  media: { tope: 1440, msaa: 2, radio: 2.8, dof: 0, ao: 0, ssr: 1, sombra: 1024 },
  alta: { tope: 1920, msaa: 4, radio: 3.2, dof: 0, ao: 1, ssr: 1, sombra: 2048 },
};
const ORDEN = ['baja', 'media', 'alta'];
// Trazo (tecla V): cuánto se parece a un cuadro. "mezcla" es el punto medio:
// pincelada suave de cerca y foco de cámara leve, sin perder la escena.
const TRAZOS = {
  nitido: { nombre: 'nítido', estira: 1, cerca: 0, dof: 0, apertura: 0, blur: 0, bloom: .34, ca: .004 },
  mezcla: { nombre: 'mezcla', estira: 1.4, cerca: .42, dof: 1, apertura: .34, blur: 3.6, bloom: .38, ca: .007 },
  oleo: { nombre: 'óleo', estira: 2.2, cerca: 1, dof: 1, apertura: .78, blur: 6.5, bloom: .44, ca: .012 },
};

// Un color dominante por momento (como los cuadros de una misma serie).
// niebla: color del aire · ambO/ambL: cuánto brilla a oscuras / con luz
// flash: cuánto la enciende el flash · dens: espesor · lavado: cuánto tiñe todo
const PALETAS = {
  base: { niebla: [.05, .14, .7], ambO: .012, ambL: .3, flash: .5, dens: .15, lavado: .2, // ultramar + el carmín de la salida
    cielo: { cenit: [.008, .02, .11], medio: [.11, .03, .24], horiz: [.8, .13, .1], corona: [1, .62, .3] } },
  // hora punta: luz de tubo fluorescente, aire limpio (el ámbar espeso parecía arena: es un metro)
  horaPunta: { niebla: [.62, .7, .8], ambO: .02, ambL: .1, flash: .3, dens: .035, lavado: .05 },
  vagonEscolar: { niebla: [0, .6, .68], ambO: .015, ambL: .3, flash: .5, dens: .15, lavado: .22, // turquesa
    cielo: { cenit: [0, .04, .08], medio: [0, .22, .28], horiz: [.12, .8, .72], corona: [1, .9, .6] } },
  vagonOficinista: { niebla: [.46, .14, .75], ambO: .015, ambL: .3, flash: .5, dens: .14, lavado: .22, // violeta
    cielo: { cenit: [.03, 0, .09], medio: [.26, .05, .42], horiz: [.95, .3, .55], corona: [1, .76, .9] } },
  // los que todavía no son vagón: su cielo queda listo (y se ve con ?mundo=feria / casa)
  vagonVendedor: { niebla: [.85, .42, .1], ambO: .012, ambL: .3, flash: .5, dens: .15, lavado: .2, // ámbar de feria + cobalto
    cielo: { cenit: [0, .025, .12], medio: [.3, .12, .04], horiz: [1, .5, .1], corona: [1, .84, .48] } },
  final: { niebla: [.9, .6, .55], ambO: .012, ambL: .3, flash: .5, dens: .13, lavado: .18, // alba: rosa y oro, con lavanda
    cielo: { cenit: [.07, .07, .22], medio: [.42, .22, .4], horiz: [1, .66, .48], corona: [1, .93, .78] } },
};

export function createGfx(ctx) {
  const { renderer, scene, camera, canvas } = ctx;

  // ---------- pasadas a pantalla completa ----------
  const tri = new THREE.BufferGeometry();
  tri.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  tri.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));
  const quad = new THREE.Mesh(tri);
  quad.frustumCulled = false;
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const mat = (fragmentShader, uniforms, extra = {}) => new THREE.ShaderMaterial({
    vertexShader: SH.VERT, fragmentShader, uniforms, depthTest: false, depthWrite: false, ...extra,
  });
  function pasada(material, target) {
    quad.material = material;
    renderer.setRenderTarget(target);
    renderer.render(quad, quadCam);
  }

  const cam = { uNear: { value: .05 }, uFar: { value: 200 } };
  const U_NIEBLA = { value: new THREE.Vector3(.05, .14, .7) };
  const texel = () => ({ value: new THREE.Vector2() });
  const U = {
    oleo: { ...cam, tColor: { value: null }, tDepth: { value: null }, uTexel: texel(), tTensor: { value: null }, uTexelT: texel(), uRadio: { value: 3 }, uEstira: { value: 1.2 }, uCerca: { value: .42 }, uAspect: { value: ASPECT }, uNiebla: U_NIEBLA, uNieblaAmb: { value: 0 }, uNieblaFlash: { value: .5 }, uDens: { value: .15 }, uBruma: { value: 0 } },
    tensor: { ...cam, tColor: { value: null }, uTexel: texel() },
    ao: { ...cam, tColor: { value: null }, tDepth: { value: null }, tFoco: { value: null }, uTexel: texel(), uTan: { value: new THREE.Vector2() }, uAo: { value: .8 }, uDof: { value: 0 }, uMaxBlur: { value: 0 }, uApertura: { value: 0 }, uSsr: { value: 0 }, uCamY: { value: 1.55 }, uUp: { value: new THREE.Vector3(0, 1, 0) } },
    dof: { ...cam, tColor: { value: null }, tDepth: { value: null }, tFoco: { value: null }, uTexel: texel(), uTan: { value: new THREE.Vector2() }, uAo: { value: 0 }, uDof: { value: 1 }, uMaxBlur: { value: 5 }, uApertura: { value: .6 }, uSsr: { value: 0 }, uCamY: { value: 1.55 }, uUp: { value: new THREE.Vector3(0, 1, 0) } },
    foco: { ...cam, tDepth: { value: null }, tPrev: { value: null }, uK: { value: .1 } },
    brillo: { ...cam, tColor: { value: null }, uTexel: texel(), uUmbral: { value: .82 }, uRodilla: { value: .35 } },
    bajar: { tColor: { value: null }, uTexel: texel() },
    subir: { tColor: { value: null }, uTexel: texel(), uPeso: { value: 1 } },
    rayos: { ...cam, tBrillo: { value: null }, tDepth: { value: null }, uAspect: { value: ASPECT }, uLuz: { value: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()] }, uColor: { value: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()] } },
    retina: { tColor: { value: null }, tPrev: { value: null }, uDecae: { value: .9 } },
    final: { ...cam, tColor: { value: null }, tBloom: { value: null }, tRayos: { value: null }, tRetina: { value: null }, tDepth: { value: null }, uTime: { value: 0 }, uAspect: { value: ASPECT }, uBloom: { value: .5 }, uRayos: { value: .8 }, uRetina: { value: 0 }, uLavado: { value: .3 }, uRaya: { value: .2 }, uNiebla: U_NIEBLA, uExpo: { value: 1.25 }, uCA: { value: .012 }, uVirado: { value: .8 }, uLit: { value: 0 }, uBarras: { value: 0 }, uTela: { value: 1 } },
  };
  const M = {
    tensor: mat(SH.TENSOR, U.tensor),
    oleo: mat(SH.OLEO, U.oleo),
    ao: mat(SH.LENTE, U.ao),
    dof: mat(SH.LENTE, U.dof),
    foco: mat(SH.FOCO, U.foco),
    brillo: mat(SH.BRILLO, U.brillo),
    bajar: mat(SH.BAJAR, U.bajar),
    subir: mat(SH.SUBIR, U.subir, { blending: THREE.AdditiveBlending, transparent: true }),
    rayos: mat(SH.RAYOS, U.rayos),
    retina: mat(SH.RETINA, U.retina),
    final: mat(SH.FINAL, U.final),
  };

  // ---------- lienzos (render targets) ----------
  const hdr = { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
  const R = { escena: null, a: null, b: null, tensor: null, mips: [], rayos: null, retina: [], foco: [] };
  for (let i = 0; i < 2; i++) R.foco.push(new THREE.WebGLRenderTarget(1, 1, { ...hdr, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter }));
  let W = 0;
  let H = 0;
  let nivel = NIVELES.media;
  let nombreNivel = 'media';
  let escala = 1;

  function liberar() {
    R.escena?.depthTexture?.dispose();
    [R.escena, R.a, R.b, R.tensor, R.rayos, ...R.mips, ...R.retina].forEach((t) => t?.dispose());
    R.mips = [];
    R.retina = [];
  }
  function armar() {
    const ancho = Math.max(480, Math.min(nivel.tope, (canvas.clientWidth || 1280) * Math.min(devicePixelRatio || 1, 2)));
    const w = Math.round(ancho * escala / 2) * 2;
    const h = Math.round(w / ASPECT / 2) * 2;
    if (w === W && h === H && R.escena && R.escena.samples === nivel.msaa) return;
    W = w;
    H = h;
    liberar();
    renderer.setSize(W, H, false);
    const depth = new THREE.DepthTexture(W, H);
    R.escena = new THREE.WebGLRenderTarget(W, H, { ...hdr, depthBuffer: true, depthTexture: depth, samples: nivel.msaa });
    R.a = new THREE.WebGLRenderTarget(W, H, hdr);
    R.b = new THREE.WebGLRenderTarget(W, H, hdr);
    R.tensor = new THREE.WebGLRenderTarget(W >> 1, H >> 1, hdr); // dirección del trazo
    let mw = W >> 1;
    let mh = H >> 1;
    for (let i = 0; i < 5 && mh > 8; i++) {
      R.mips.push(new THREE.WebGLRenderTarget(mw, mh, hdr));
      mw >>= 1;
      mh >>= 1;
    }
    R.rayos = new THREE.WebGLRenderTarget(W >> 2, H >> 2, hdr);
    for (let i = 0; i < 2; i++) R.retina.push(new THREE.WebGLRenderTarget(W >> 2, H >> 2, hdr));
    U.oleo.uTexel.value.set(1 / W, 1 / H);
    U.oleo.uTexelT.value.set(1 / (W >> 1), 1 / (H >> 1));
    U.tensor.uTexel.value.set(1 / W, 1 / H);
    U.ao.uTexel.value.set(1 / W, 1 / H);
    U.dof.uTexel.value.set(1 / W, 1 / H);
    U.brillo.uTexel.value.set(1 / W, 1 / H);
  }

  // ---------- luz ambiente reflejada (para los fierros y el vidrio) ----------
  let entorno = null;
  function crearEntorno() {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    entorno = pmrem.fromScene(room, .04).texture;
    room.traverse((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
    pmrem.dispose();
  }

  // ---------- partículas ----------
  const part = createParticulas();
  part.group.visible = false;
  scene.add(part.group);
  // haces del eclipse por las ventanas y gente que se deshace
  const haces = createHaces(); // se dibujan aparte (ver "haces" en render)
  const disol = createDisolucion();

  let ms = 16; // milisegundos por frame (promedio)
  let reloj = 0;
  let espera = 0;

  // ---------- el otro lado (lo que se ve por las ventanas a oscuras) ----------
  const mundo = createMundo();
  mundo.group.visible = false;
  scene.add(mundo.group);
  let tunel = [];
  let abre = 0;
  let primeraVez = true; // la primera vez que se corta la luz, el cielo se abre lento
  let flashReciente = 0;
  let exteriorAhora = false;
  let hayPiso = false; // el vagón roto (Oficinista) no trae piso

  // ---------- qué hay en escena ----------
  const refGeo = borradoGeometry();
  const VERTS_BORRADO = refGeo.attributes.position.count;
  refGeo.dispose();
  const rim = { value: 0 };
  let vistos = new WeakSet();
  let cuerpos = new Map(); // grupos tipo "persona" -> visible en el frame anterior
  let stage = null;
  let flashSpot = null;
  let borrados = null;
  let overlayU = null;
  const luces = [];
  const v3 = new THREE.Vector3();

  function parcharOverlay(m) {
    // la capa de pantalla asume 320x240: centra la mira y corrige el aspecto
    m.uniforms.uGfxRes = { value: new THREE.Vector2(W, H) };
    m.fragmentShader = m.fragmentShader
      .replace('varying vec2 vUv;', 'varying vec2 vUv;\nuniform vec2 uGfxRes;')
      .replace('p.x *= 1.333;', 'p.x *= uGfxRes.x / uGfxRes.y;')
      .replace('gl_FragCoord.xy - vec2(160.0, 120.0)', 'gl_FragCoord.xy - uGfxRes * 0.5')
      .replace('max(px.x, px.y) < 1.5', 'max(px.x, px.y) < uGfxRes.y / 190.0')
      // sus colores están pensados para la pantalla; aquí se mezclan en luz lineal.
      // Su grano (cambia 24 veces por segundo) en luz lineal hierve en las sombras:
      // en el cuadro la textura la pone la tela del revelado, que no se mueve.
      .replace('over(c, a, vec3(g), 0.06);', 'over(c, a, vec3(g), 0.0);')
      .replace('gl_FragColor = vec4(a > 0.0 ? c / a : c, a);', 'gl_FragColor = vec4(pow(a > 0.0 ? c / a : c, vec3(2.2)), a);');
    m.needsUpdate = true;
    overlayU = m.uniforms;
  }
  function parcharBorrado(m) {
    // gente a medio borrar: tinta, pedazos que faltan y canto encendido (disolucion.js)
    parcheBorrado(m, rim);
  }

  // ventanas rotas y quién salió por ellas
  const hoyosVis = new Map(); // malla del hoyo -> visible en el frame anterior
  const hoyosLista = [0, 1, 2, 3].map(() => ({ x: 0, y: 0, z: 0, s: 1, acc: 0, edad: 0 }));
  let nHoyos = 0;
  const roturas = []; // hoyos que se abrieron en este frame
  const deshechos = new WeakSet(); // cuerpos que ya se fueron en pétalos
  let killer = null;
  let killerVis = false;
  const caja = new THREE.Box3();
  const esPersona = (o) => o.children[0].geometry?.parameters?.height === .82 && o.children[0].geometry.parameters.width === .13;

  function mirar(o) {
    // alguien desapareció: su cuerpo (un grupo de piezas) dejó de verse
    if (o.isGroup && o.children.length >= 5 && o.children[0].isMesh) {
      const antes = cuerpos.get(o);
      if (antes === undefined && esPersona(o)) disol.preparar(o);
      if (antes === true && !o.visible && !deshechos.has(o)) part.rafaga(o.getWorldPosition(v3));
      cuerpos.set(o, o.visible);
    }
    // el hoyo de una ventana rota: cuándo se abre y dónde quedó
    if (o.isMesh && o.geometry?.parameters?.width === 1.7 && o.material?.userData?.gfxHoyo) {
      const antes = hoyosVis.get(o);
      if (o.visible) {
        o.getWorldPosition(v3);
        if (antes === false) roturas.push(v3.clone()); // un evento, no cada frame
        if (nHoyos < hoyosLista.length) {
          const h = hoyosLista[nHoyos++];
          if (h.z !== v3.z || h.x !== v3.x) h.acc = h.edad = 0;
          h.x = v3.x; h.y = v3.y; h.z = v3.z; h.s = Math.sign(v3.x) || 1;
        }
      }
      hoyosVis.set(o, o.visible);
    }
    // el borrado que se los lleva: cuando termina, se deshace en pétalos
    if (o === killer) {
      if (killerVis && !o.visible) part.rafaga(o.getWorldPosition(v3), 90);
      killerVis = o.visible;
    }
    if (o.isPointLight) {
      luces.push(o);
      // la luz que entra por las ventanas rotas: afuera ya no hay túnel, hay eclipse
      if (exteriorAhora && o.color.getHex() !== 0xff3020 && o.userData.gfxHoyo !== false && (o.userData.gfxHoyo || o.color.getHex() === 0x9db8d8)) {
        o.userData.gfxHoyo = true;
        const c = mundo.u.uCorona.value;
        o.color.setRGB(c.x, c.y, c.z);
        // afuera no pasa el túnel: la luz entra pareja, sin ráfagas (nada parpadea)
        if (o.intensity > 0) o.intensity = .45;
      }
    }
    if (vistos.has(o)) return;
    vistos.add(o);
    if (o.isSpotLight) {
      flashSpot = o;
      o.castShadow = true;
      o.shadow.mapSize.setScalar(nivel.sombra);
      o.shadow.camera.near = .15;
      o.shadow.bias = -.0015;
      o.shadow.normalBias = .03;
      o.shadow.autoUpdate = false;
      return;
    }
    if (!o.isMesh) return;
    const m = o.material;
    if (!m) return;
    // el túnel de afuera (paredes, cables, piso): a oscuras se saca
    const gp = o.geometry?.parameters;
    if (gp && gp.width === 5 && gp.height === .15 && gp.depth === 26) hayPiso = true;
    if (gp && gp.depth && ((gp.width === .2 && gp.height === 6) || (gp.width === 9 && gp.depth === 30) || (gp.width === .08 && gp.depth === 2.6))) {
      tunel.push(o);
      return;
    }
    if (!Array.isArray(m) && m.depthTest === false) {
      // celular y capa de pantalla: se dibujan después, encima del cuadro
      o.layers.set(1);
      if (m.uniforms?.uDot) parcharOverlay(m);
      return;
    }
    const lista = Array.isArray(m) ? m : [m];
    if (!lista.some((x) => x.isMeshStandardMaterial)) return;
    if (lista[0].alphaTest === .5 && lista[0].polygonOffset && !lista[0].userData.gfxHoyo) {
      // ventana rota (world/muerte.js): el hoyo está pintado negro pensando en el túnel.
      // Aquí lo negro se recorta, para que por el hoyo se vea lo que hay afuera.
      lista[0].userData.gfxHoyo = true;
      lista[0].onBeforeCompile = (sh) => {
        sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>',
          '#include <map_fragment>\n  if (max(diffuseColor.r, max(diffuseColor.g, diffuseColor.b)) < 0.006) discard;');
      };
      lista[0].customProgramCacheKey = () => 'gfx-hoyo';
      lista[0].needsUpdate = true;
    }
    o.receiveShadow = true;
    o.castShadow = !lista[0].transparent;
    if (lista[0].transparent && gp?.width === .04 && lista[0].fog) {
      // vidrio de las ventanas: más limpio y sin niebla negra, para mirar hacia afuera
      lista[0].fog = false;
      lista[0].opacity = .2;
      lista[0].needsUpdate = true;
    }
    if (o.geometry?.attributes.position?.count === VERTS_BORRADO && lista[0].emissive) {
      // solo la multitud: el borrado del susto se ve de cerca y necesita su cara limpia
      if (o.isInstancedMesh) {
        parcharBorrado(lista[0]);
        borrados = o;
      } else if (o.parent?.children.length === 4 && o.parent.children[1].geometry?.type === 'PlaneGeometry') {
        // el que saca a la gente por la ventana (world/muerte.js) también está a medio borrar
        parcharBorrado(lista[0]);
        killer = o.parent;
      }
    }
  }

  function sincronizar() {
    if (ctx.stage !== stage) {
      stage = ctx.stage;
      vistos = new WeakSet();
      cuerpos = new Map();
      flashSpot = null;
      hayPiso = false;
      tunel = [];
      borrados = null;
      overlayU = null;
      part.limpiar();
      disol.limpiar();
      hoyosVis.clear();
      killer = null;
      killerVis = false;
      ms = 16; // armar un momento compila shaders: ese tirón no cuenta para medir
      reloj = -2;
      R.retina.forEach((t) => { renderer.setRenderTarget(t); renderer.clear(); });
    }
    luces.length = 0;
    nHoyos = 0;
    roturas.length = 0;
    stage?.traverse(mirar);
    for (const r of roturas) romperse(r);
  }

  // Se rompió un vidrio: el que va saliendo por ahí se deshace en pétalos que se
  // lleva el viento, con su forma, mientras su cuerpo se quema de los pies arriba.
  function romperse(p) {
    let victima = null;
    let mejor = 2.6;
    for (const [o, vis] of cuerpos) {
      if (!vis || deshechos.has(o) || !esPersona(o)) continue;
      const d = o.getWorldPosition(v3).distanceTo(p);
      if (d < mejor) { mejor = d; victima = o; }
    }
    if (!victima) return;
    deshechos.add(victima);
    disol.iniciar(victima);
    caja.setFromObject(victima);
    part.figura(caja, Math.sign(p.x) || 1, 420);
    // y por la herida entra la primera racha
    part.entrar(p.x, p.y, p.z, Math.sign(p.x) || 1, 90, 2.2);
  }

  // ---------- modo y calidad ----------
  const aviso = document.createElement('div');
  aviso.id = 'gfx-aviso';
  document.body.appendChild(aviso);
  let avisoT = 0;
  function avisar(texto) {
    aviso.textContent = texto;
    aviso.classList.add('on');
    clearTimeout(avisoT);
    avisoT = setTimeout(() => aviso.classList.remove('on'), 2200);
  }

  function elegirNivel(nombre) {
    nombreNivel = nombre;
    nivel = NIVELES[nombre];
    U.oleo.uRadio.value = nivel.radio;
    U.ao.uAo.value = nivel.ao * .8;
    U.ao.uSsr.value = nivel.ssr * .9;
    if (flashSpot && flashSpot.shadow.mapSize.x !== nivel.sombra) {
      flashSpot.shadow.mapSize.setScalar(nivel.sombra);
      flashSpot.shadow.map?.dispose();
      flashSpot.shadow.map = null;
    }
  }

  function aplicar() {
    document.body.classList.toggle('gfx', GFX.on);
    if (GFX.on) {
      if (!entorno) crearEntorno();
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      scene.environment = entorno;
      camera.aspect = ASPECT;
      elegirNivel(GFX.calidad === 'auto' ? ((navigator.hardwareConcurrency || 4) >= 8 ? 'alta' : 'media') : GFX.calidad);
      escala = 1;
      W = 0;
      armar();
    } else {
      renderer.shadowMap.enabled = false;
      scene.environment = null;
      camera.layers.set(0);
      camera.aspect = PS1.w / PS1.h;
      renderer.setRenderTarget(null);
      renderer.setSize(PS1.w, PS1.h, false);
      part.group.visible = false;
      mundo.group.visible = false;
      for (const t of tunel) t.visible = true;
    }
    camera.updateProjectionMatrix();
  }

  let trazo = TRAZOS[GFX.trazo];
  function elegirTrazo(nombre) {
    GFX.trazo = nombre;
    trazo = TRAZOS[nombre];
    U.oleo.uCerca.value = trazo.cerca;
    U.oleo.uEstira.value = trazo.estira;
    U.dof.uApertura.value = trazo.apertura;
    U.dof.uMaxBlur.value = trazo.blur;
  }
  elegirTrazo(GFX.trazo);
  function ciclarTrazo() {
    const lista = Object.keys(TRAZOS);
    elegirTrazo(lista[(lista.indexOf(GFX.trazo) + 1) % lista.length]);
    guardarGfx();
    avisar(`Trazo: ${trazo.nombre}`);
  }

  function alternar() {
    GFX.modo = GFX.on ? 'ps1' : 'pintura';
    guardarGfx();
    // Los materiales se crean al armar cada momento, y los de los modelos 3D al
    // cargar la página: lo limpio es recargar y volver a la misma escena.
    try { sessionStorage.setItem('fds:escena', ctx.fsm.current || 'inicio'); } catch (err) { console.error('[gfx] sesión', err); }
    location.reload();
  }
  function ciclarCalidad() {
    const lista = ['auto', ...ORDEN];
    GFX.calidad = lista[(lista.indexOf(GFX.calidad) + 1) % lista.length];
    guardarGfx();
    if (GFX.on) aplicar();
    avisar(`Calidad: ${GFX.calidad}`);
  }
  addEventListener('keydown', (e) => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code === 'KeyG') (e.shiftKey ? ciclarCalidad : alternar)();
    if (e.code === 'KeyV' && GFX.on) ciclarTrazo();
  });
  addEventListener('resize', () => { if (GFX.on) armar(); });

  // ---------- resolución que se adapta ----------
  function adaptar(dt) {
    ms += (dt * 1000 - ms) * .05;
    reloj += dt;
    espera -= dt;
    if (reloj < 1.5) return;
    reloj = 0;
    if (ms > 23) {
      if (escala > .56) escala = Math.max(.55, escala * .85);
      else if (GFX.calidad === 'auto' && nombreNivel !== 'baja') {
        elegirNivel(ORDEN[ORDEN.indexOf(nombreNivel) - 1]);
        escala = .8;
      } else return;
      espera = 10;
      armar();
    } else if (ms < 17.6 && escala < 1 && espera <= 0) {
      escala = Math.min(1, escala * 1.1);
      espera = 6;
      armar();
    }
  }

  // ---------- un frame ----------
  let tiempo = 0;
  let lit = 0;
  let flashAntes = 0;
  let focoI = 0;
  let retinaI = 0;
  const fwd = new THREE.Vector3();
  const giro = new THREE.Euler();

  function elegirLuces() {
    const L = U.rayos.uLuz.value;
    const C = U.rayos.uColor.value;
    const mejores = [];
    for (const l of luces) {
      if (l.intensity < .05) continue;
      l.getWorldPosition(v3);
      const dist = v3.distanceTo(camera.position);
      if (dist < .6) continue; // el relleno del flash va pegado a la cámara
      v3.applyMatrix4(camera.matrixWorldInverse);
      if (v3.z > -.3) continue;
      const z = -v3.z;
      v3.applyMatrix4(camera.projectionMatrix);
      const borde = Math.max(Math.abs(v3.x), Math.abs(v3.y));
      if (borde > 1.6) continue;
      const peso = Math.min(l.intensity, 2.5) / (1 + dist * .12) * (1 - THREE.MathUtils.smoothstep(borde, 1, 1.6));
      mejores.push({ x: v3.x * .5 + .5, y: v3.y * .5 + .5, z, peso, color: l.color });
    }
    if (abre > .05) {
      v3.copy(SOL).multiplyScalar(1000).add(camera.position).applyMatrix4(camera.matrixWorldInverse);
      if (v3.z < -1) {
        v3.applyMatrix4(camera.projectionMatrix);
        const borde = Math.max(Math.abs(v3.x), Math.abs(v3.y));
        const c = mundo.u.uCorona.value;
        // z = casi el fondo: solo el cielo deja pasar el rayo; marcos, barras y siluetas lo cortan
        if (borde < 1.8) mejores.push({ x: v3.x * .5 + .5, y: v3.y * .5 + .5, z: 190, peso: .85 * abre * (1 - THREE.MathUtils.smoothstep(borde, 1.1, 1.8)), color: { r: c.x, g: c.y, b: c.z } });
      }
    }
    mejores.sort((a, b) => b.peso - a.peso);
    for (let i = 0; i < 3; i++) {
      const b = mejores[i];
      if (b) {
        L[i].set(b.x, b.y, b.z);
        C[i].set(b.color.r, b.color.g, b.color.b).multiplyScalar(b.peso * .5);
      } else C[i].set(0, 0, 0);
    }
  }

  // Luz de afuera en el aire: haces por las ventanas, polvo que los cruza,
  // pétalos que entran por los hoyos. Solo con el cielo abierto.
  function afuera(dt, hay) {
    const fuerza = hay ? mundo.u.uAbre.value : 0;
    const c = mundo.u.uCorona.value;
    haces.mesh.visible = fuerza > .01;
    haces.u.uColor.value.copy(c);
    haces.u.uFuerza.value = fuerza * .6; // suaves: mirando a lo largo del pasillo se suman los 8 paños
    haces.hoyos(hoyosLista, hay ? nHoyos : 0);
    part.polvoU.uHaz.value.copy(c).multiplyScalar(fuerza * .9);
    part.petaloU.uVentana.value.copy(c).multiplyScalar(fuerza * 1.1);
    disol.update(dt);
    if (!hay) return;
    for (let i = 0; i < nHoyos; i++) {
      const h = hoyosLista[i];
      h.edad += dt; // su haz se enciende de a poco, nunca de golpe
      h.acc += dt * 3.5 * fuerza; // unos tres pétalos por segundo por hoyo
      while (h.acc >= 1) {
        h.acc -= 1;
        part.entrar(h.x, h.y, h.z, h.s);
      }
    }
  }

  function render(dt) {
    if (!GFX.on) {
      renderer.render(scene, camera);
      return;
    }
    adaptar(dt);
    tiempo += dt;
    sincronizar();

    const enVagon = !!flashSpot;
    const flash = flashSpot ? Math.min(1.2, flashSpot.intensity / 7.5) : 0;
    const glow = borrados ? Math.min(1, borrados.material.emissive.r / .16) : 0;
    const encendido = scene.fog && scene.fog.near > 4 ? 1 : 0;
    lit += (encendido - lit) * Math.min(1, dt * 4);
    if (camera.aspect !== ASPECT) { camera.aspect = ASPECT; camera.updateProjectionMatrix(); }
    camera.updateMatrixWorld();
    camera.getWorldDirection(fwd);

    // el otro lado: a oscuras no hay túnel, hay mundo
    const exterior = enVagon && !encendido;
    exteriorAhora = exterior;
    for (const t of tunel) t.visible = !exterior;
    if (exterior) {
      abre = Math.min(1, abre + dt / (primeraVez ? 5 : .7));
      if (abre >= 1) primeraVez = false;
    } else {
      abre = 0;
      if (encendido) primeraVez = true;
    }
    mundo.group.visible = abre > .001;
    mundo.tapaPiso.visible = hayPiso;
    mundo.foso.visible = !hayPiso;
    if (mundo.group.visible) {
      const esc = mundo.escenarios;
      // otro vagón, otro mundo: el cielo se vuelve a abrir desde el eclipse, ya con sus colores
      const otro = esc.elegir(ctx.fsm.current);
      if (otro) abre = 0;
      const c = (PALETAS[esc.paleta(ctx.fsm.current)] || PALETAS.base).cielo || PALETAS.base.cielo;
      const kc = otro ? 1 : Math.min(1, dt * 2);
      const mu = mundo.u;
      mu.uTime.value = tiempo;
      mu.uAbre.value = abre * abre * (3 - 2 * abre);
      mu.uCenit.value.lerp(v3.fromArray(c.cenit), kc);
      mu.uMedio.value.lerp(v3.fromArray(c.medio), kc);
      mu.uHoriz.value.lerp(v3.fromArray(c.horiz), kc);
      mu.uCorona.value.lerp(v3.fromArray(c.corona), kc);
      mundo.hojaU.uPx.value = H * camera.projectionMatrix.elements[5] * .5;
    }
    flashReciente = Math.max(Math.min(flash, 1), flashReciente - dt * 1.4);

    // luces y materiales
    if (flashSpot && flash > .01) flashSpot.shadow.needsUpdate = true;
    scene.environmentIntensity = .012 + lit * .3 + flash * .45;
    rim.value = flash * .5 + glow * 1.6;
    if (overlayU?.uGfxRes) overlayU.uGfxRes.value.set(W, H);

    // partículas
    part.group.visible = enVagon;
    if (enVagon) {
      part.u.uTime.value = tiempo;
      part.u.uFlash.value = flash;
      part.u.uAmb.value = lit * .16;
      part.u.uCam.value.copy(camera.position);
      part.u.uFwd.value.copy(fwd);
      part.polvoU.uPx.value = H * camera.projectionMatrix.elements[5] * .5;
      part.petaloU.uGlow.value = glow;
      if (borrados && flash > .5 && flashAntes <= .5) part.emitirDesde(borrados, camera);
    }
    flashAntes = flash;
    afuera(dt, enVagon && exterior);

    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    U.ao.uTan.value.set(tan * camera.aspect, tan);
    U.dof.uTan.value.set(tan * camera.aspect, tan);
    cam.uNear.value = camera.near;
    cam.uFar.value = camera.far;

    // pulso: la cámara respira apenas, como sostenida a mano (solo al dibujar;
    // después se deja como estaba para no tocar la lógica de los estados)
    giro.copy(camera.rotation);
    if (enVagon && !GFX.calma) {
      camera.rotation.x += Math.sin(tiempo * .9) * .0035 + Math.sin(tiempo * 2.3) * .0012;
      camera.rotation.y += Math.sin(tiempo * .6 + 1.3) * .003;
      camera.rotation.z += Math.sin(tiempo * .75 + .4) * .0025;
      camera.updateMatrixWorld();
    }

    // 1 · la escena (sin celular ni capa de pantalla)
    camera.layers.set(0);
    renderer.setRenderTarget(R.escena);
    renderer.render(scene, camera);
    const depth = R.escena.depthTexture;

    // foco automático
    U.foco.tDepth.value = depth;
    U.foco.tPrev.value = R.foco[focoI].texture;
    U.foco.uK.value = 1 - Math.exp(-dt * 5);
    focoI = 1 - focoI;
    pasada(M.foco, R.foco[focoI]);
    part.polvoU.uFoco.value = 3;

    // 2 · sombra en los rincones (antes del óleo, que le alisa el ruido), óleo y foco
    let fuente = R.escena.texture;
    if (nivel.ao || nivel.ssr) {
      U.ao.uUp.value.set(0, 1, 0).transformDirection(camera.matrixWorldInverse);
      U.ao.uCamY.value = camera.position.y;
      U.ao.tColor.value = fuente;
      U.ao.tDepth.value = depth;
      U.ao.tFoco.value = R.foco[focoI].texture;
      pasada(M.ao, R.b);
      fuente = R.b.texture;
    }
    U.tensor.tColor.value = fuente;
    pasada(M.tensor, R.tensor);
    U.oleo.tColor.value = fuente;
    U.oleo.tDepth.value = depth;
    U.oleo.tTensor.value = R.tensor.texture;
    pasada(M.oleo, R.a);
    let cuadro = R.a;
    if (trazo.dof && nombreNivel !== 'baja') { // el foco depende del trazo; en calidad baja se ahorra
      U.dof.tColor.value = R.a.texture;
      U.dof.tDepth.value = depth;
      U.dof.tFoco.value = R.foco[focoI].texture;
      pasada(M.dof, R.b);
      cuadro = R.b;
    }

    // haces del eclipse: después del piso mojado, para que no se reflejen en él
    if (haces.mesh.visible) haces.dibujar(renderer, camera, depth, cuadro);

    // 3 · celular y capa de pantalla, encima y nítidos
    camera.layers.set(1);
    const fondo = scene.background;
    scene.background = null;
    renderer.autoClear = false;
    renderer.setRenderTarget(cuadro);
    renderer.render(scene, camera);
    renderer.autoClear = true;
    scene.background = fondo;
    camera.layers.set(0);
    camera.rotation.copy(giro);
    camera.updateMatrixWorld();

    // 4 · bloom
    U.brillo.tColor.value = cuadro.texture;
    pasada(M.brillo, R.mips[0]);
    for (let i = 1; i < R.mips.length; i++) {
      U.bajar.tColor.value = R.mips[i - 1].texture;
      U.bajar.uTexel.value.set(1 / R.mips[i - 1].width, 1 / R.mips[i - 1].height);
      pasada(M.bajar, R.mips[i]);
    }

    // 5 · rayos (antes de subir el bloom: usa el brillo sin mezclar)
    elegirLuces();
    U.rayos.tBrillo.value = R.mips[1].texture;
    U.rayos.tDepth.value = depth;
    pasada(M.rayos, R.rayos);

    renderer.autoClear = false;
    for (let i = R.mips.length - 1; i > 0; i--) {
      U.subir.tColor.value = R.mips[i].texture;
      U.subir.uTexel.value.set(1 / R.mips[i].width, 1 / R.mips[i].height);
      U.subir.uPeso.value = 1;
      pasada(M.subir, R.mips[i - 1]);
    }
    renderer.autoClear = true;

    // 6 · imagen retenida
    U.retina.tColor.value = R.mips[0].texture;
    U.retina.tPrev.value = R.retina[retinaI].texture;
    U.retina.uDecae.value = Math.exp(-dt / .3);
    retinaI = 1 - retinaI;
    pasada(M.retina, R.retina[retinaI]);

    // 7 · revelado
    const F = U.final;
    F.tColor.value = cuadro.texture;
    F.tBloom.value = R.mips[0].texture;
    F.tRayos.value = R.rayos.texture;
    F.tRetina.value = R.retina[retinaI].texture;
    F.tDepth.value = depth;
    F.uTime.value = tiempo;
    F.uLit.value = lit;
    // paleta del momento, con paso suave entre una y otra
    const pal = PALETAS[ctx.fsm.current] || PALETAS.base;
    const k = Math.min(1, dt * 2.5);
    const O = U.oleo;
    U_NIEBLA.value.lerp(v3.set(pal.niebla[0], pal.niebla[1], pal.niebla[2]), k);
    O.uNieblaAmb.value += ((enVagon ? pal.ambO + (pal.ambL - pal.ambO) * lit : 0) - O.uNieblaAmb.value) * k;
    O.uNieblaFlash.value = pal.flash;
    O.uBruma.value = flash;
    O.uDens.value += (pal.dens - O.uDens.value) * k;
    F.uLavado.value += ((enVagon ? pal.lavado : 0) - F.uLavado.value) * k;
    // al ser atrapado el bloom baja: la cara del susto tiene que leerse
    F.uBloom.value = (trazo.bloom - lit * .14) * (1 - .75 * Math.min(1, overlayU?.uCaught?.value || 0));
    F.uRaya.value = .16 + (primeraVez ? Math.sin(Math.PI * abre) * .6 : 0); // el cielo se enciende con un destello
    F.uRayos.value = enVagon ? .38 + lit * .22 + Math.min(flash, 1) * .4 : 0;
    F.uExpo.value = 1.25 - lit * .15 - Math.min(flash, 1) * .5; // la cámara cierra el diafragma con el flash
    F.uVirado.value = .8 + lit * .3;
    U.brillo.uUmbral.value = .82 + lit * .25;
    F.uRetina.value = (1 - lit) * flashReciente * (GFX.calma ? .25 : .7); // solo después de un flash: girar no deja estela
    F.uCA.value = GFX.calma ? 0 : trazo.ca;
    F.uBarras.value = enVagon ? .055 : 0;
    pasada(M.final, null);
  }

  aplicar();
  const api = {
    render,
    alternar,
    get activo() { return GFX.on; },
    // para que un estado suelte pétalos donde quiera: ctx.gfx?.rafaga(posicion)
    rafaga(p, n) { if (GFX.on) part.rafaga(p, n); },
  };
  ctx.gfx = api;
  createEscenas(ctx);
  return api;
}
