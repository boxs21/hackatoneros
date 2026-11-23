# AGENTS.md — Fin de Servicio

Reglas para Codex (y para cualquier agente) en este repo. Léelas antes de cada tarea.

## El juego
Terror suave en primera persona, unos 5 minutos, en un vagón de metro de Santiago.
Mecánica central: **el flash (F) es la única forma de ver, y cada flash acerca a "los borrados"**.
Textos en español de Chile. Navegador de escritorio.

## Stack (no cambiar)
- JavaScript plano con módulos ES. **Sin TypeScript, sin frameworks, sin React.**
- Three.js para 3D y Vite para desarrollo y build.
- Web Audio API para sonido.
- **No agregar dependencias nuevas** sin que el equipo lo apruebe.

## Comandos
- `npm run dev`: desarrollo en http://localhost:5173 (`?demo=1` para el modo demo).
- `npm run build`: **tiene que pasar sin errores antes de cada merge.**

## Arquitectura
- `src/main.js` arma el renderer (320x240, estilo PS1), la escena, la cámara y el `ctx`.
- `src/core/`: máquina de estados, eventos, entrada, fundido, ayudas y modo demo. **Dueño: Valentín.**
- `src/states/`: un archivo por momento. El orden está en `src/states/index.js` y es el orden de las teclas 1–8 del modo demo.
- Cada estado exporta `{ id, next, hint?, autoAdvance?, enter(ctx, data), update(dt, ctx), exit?(ctx) }`.
- **Todo lo 3D de un estado va dentro de `ctx.stage`.** La máquina de estados lo saca y lo libera al salir o reiniciar. No agregues cosas directo a `ctx.scene`.
- Para usar en los estados:
  - `ctx.next()` pasa al siguiente momento, `ctx.go(id, data, { fade })` va a uno específico.
  - `ctx.restart(data?)` reinicia el momento en menos de 1 s (cuando atrapan al jugador).
  - `ctx.progress()` avisa que el jugador avanzó y reinicia el reloj de pista (30 s) y de avance automático (90 s).
  - `ctx.input.down('KeyW')`, `ctx.input.pressed('KeyF')` y `ctx.input.mouse.dx/dy`. Usa siempre códigos `e.code`.
  - `ctx.audio.*` (interfaz en `src/audio/audio.js`) y `ctx.hud.title / subtitle / hint`.
  - **Voces:** todo `ctx.hud.subtitle(texto)` reproduce solo su voz si existe `public/audio/voz-<personaje>-<slug del texto>.mp3` ("ESCOLAR: …" → escolar; sin prefijo → narrador). No llames `ctx.audio.voz` para un subtítulo (sonaría doble). Para un texto nuevo: agrégalo en `tools/voces.mjs` y corre `node tools/voces.mjs` (necesita `.env` con `OPENAI_API_KEY`; el `.env` nunca se sube).
  - **Responder:** `const i = await ctx.hud.elegir(['Opción 1', 'Opción 2'])` → índice elegido (teclas 1–3; sin respuesta en 9 s elige la última). Guarda decisiones en `ctx.memoria`.
  - **Misiones:** la lista de arriba a la derecha avanza sola con cada momento (`src/ui/misiones.js`). `ctx.misiones.set('texto')` cambia la misión actual; `set(null)` vuelve a la de base.
  - `ctx.events.on/emit` para hablar entre módulos sin importarlos.

## Quién toca qué (para no pisarse en los merges)
| Carpeta o archivo | Dueño |
| --- | --- |
| `src/core/`, `src/main.js`, `states/inicio`, `apagon`, `losCinco`, `vagonVendedor`, `final` | Valentín |
| `src/mechanics/`, `src/world/`, `states/horaPunta`, `borrados`, `vagonEscolar` | Camilo |
| `src/ui/`, textos y diálogos, `README.md` | Renato |
| `src/audio/`, `public/audio/` | Andy |

Si una tarea necesita cambiar un archivo de otro dueño, **detente y avisa**; no lo cambies.

## Reglas de trabajo
- Tareas cortas: 15 a 30 minutos. Un cambio, una cosa.
- Corto y estable le gana a largo y roto. **Después de las 16:00 solo se arreglan bugs.**
- Rendimiento: 30 fps como mínimo en un notebook normal. Usa `InstancedMesh` para multitudes y no crees geometrías ni materiales dentro de `update`.
- Cero errores en la consola. Cada `try/catch` registra el error con `console.error`.
- Nada de pantallas de carga ni menús elaborados. Reiniciar tarda menos de 1 s.
- Sin claves, tokens ni contraseñas en el repo. La webcam se procesa solo en el navegador y nunca se sube.
- Nada de logos, sonidos oficiales ni marcas de Metro de Santiago.

## CODEX_LOG.md
Cuando una tarea implique una decisión (qué pediste, qué salió, qué decidieron), agrega **una línea** a `CODEX_LOG.md`.
