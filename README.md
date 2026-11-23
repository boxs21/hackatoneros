# Andén Cero

> *Sales de la pega. El metro se apaga. Solo puedes ver a la gente con el flash.*

**▶ Jugar en el navegador:** https://boxs21.github.io/hackatoneros/

## Descripción

Juego corto de terror en primera persona en un metro de Santiago a la hora punta. Hecho en un día para la hackatón **Build Games with Codex** (Santiago, 23 de noviembre de 2026), parte del UDDevs Game Fest 2026.

Son las 18:04. Sales de la pega y te subes a la **Línea 23** rumbo a Casa. Tu celular no tiene batería y el metro va lleno. Entre empujones conoces a cuatro pasajeros: un escolar, una señora que vuelve de la feria, un vendedor de chocolates y un oficinista que te presta su celular para llamar a tu mamá. Suena una vez… y el tren frena en el túnel. Se apaga todo. **A la gente solo se la ve con el flash del celular, y cada flash los acerca.** Uno a uno, los cuatro desaparecen, y lo que te dejó cada uno es lo que te ayuda a seguir.

**Qué hace el jugador:** avanza por los vagones a oscuras, usando el flash para ver sin dejar que los «borrados» lo toquen, resuelve un código escrito con tiza, cruza un vagón partido saltando entre pedazos y sigue la voz del vendedor en la oscuridad.

**Objetivo:** llegar a Casa.

| # | Momento | Qué haces |
| --- | --- | --- |
| 1 | Hora punta | Avanzas empujando a la multitud, conoces a los cuatro, les respondes y cada uno te da un objeto. |
| 2 | Apagón | Corte seco a negro y silencio. |
| 3 | Los cinco | Aprendes el flash: la segunda foto muestra a alguien que no debería estar. |
| 4 | Los borrados | Siluetas que solo se ven con el flash. Cada foto los acerca y se lleva a uno de los cuatro. |
| 5 | Vagón del Escolar | Un código de 3 números escrito con tiza, visible solo con el flash. Se anotan en tu cuaderno y los marcas en la puerta. |
| 6 | Vagón roto | No hay piso: saltas entre pedazos. Lo que alumbras con el flash queda marcado. |
| 7 | Vagón del Vendedor | Oscuridad total. Su voz te guía… hasta que el vagón se derrumba. |
| 8 | Despertar | Final abierto. |

- **Duración:** unos 5 a 7 minutos. **Plataforma:** navegador de escritorio (Chrome, Edge o Firefox). **Idioma:** español de Chile.
- **Advertencias:** usa destellos de luz (limitados a menos de 3 por segundo); si tienes sensibilidad a las luces intermitentes, juega con precaución. Hay sustos, oscuridad y muertes de personajes con algo de sangre en estilo PS1. Se recomienda jugar con audífonos.

## Cómo jugar o ejecutar

- **Enlace a la versión jugable:** https://boxs21.github.io/hackatoneros/ (no hay que instalar nada).
- **Requisitos:** cualquier sistema operativo con un navegador de escritorio reciente. Para correrlo en local: [Node.js](https://nodejs.org/) 20 o superior y npm.
- **Pasos o comandos de instalación:**
  ```bash
  git clone https://github.com/boxs21/hackatoneros.git
  cd hackatoneros
  npm install
  ```
- **Pasos o comandos para iniciar el juego:**
  ```bash
  npm run dev        # abre http://localhost:5173
  ```
  Versión de producción: `npm run build` y luego `npm run preview`. En el menú presiona una tecla y elige COMENZAR con Enter (el navegador necesita esa interacción para el audio). Si el juego va lento, presiona **G** para pasar al look PS1.

## Controles

- **Movimiento:** W A S D (o flechas) para moverse · mouse para mirar.
- **Acciones:** **F** foto con flash (desde que se corta la luz) · **E** usar o interactuar (teclado de la puerta, tirar el completo) · **Espacio** saltar (vagón roto) o pasar diálogo (también Enter) · **1 / 2** responder a los pasajeros · **Tab** ver las misiones · **G** modo pintura / look PS1 (**Mayús + G** calidad, **V** trazo).
- **Reiniciar o volver al menú:** si te atrapan, el vagón se reinicia solo. **Esc** suelta el mouse y pausa; **Esc** de nuevo vuelve al menú. En el menú, **ESCENAS** salta a cualquier momento. Para probar: `?demo=1` en la URL (teclas 1 a 9 saltan de escena, **N** siguiente, **R** reiniciar).

## Integrantes

- **Valentín Castro:** lead técnico. Estructura del proyecto, máquina de estados, modo demo y reinicio, HUD (misiones, respuestas, avisos de tecla, voces en murmullo, cuaderno), vagón del Vendedor, estación Casa, modelos 3D de los pasajeros en escena y logo de Codex.
- **Camilo Bufadel:** vagón 3D y look PS1, mecánica del flash y los borrados, hora punta, Los cinco, vagón del Escolar y vagón roto.
- **Renato Lenis:** visor de cámara, animaciones de la hora punta (sin batería, llamada), objetos obtenidos en 3D, el Oficinista en 3D y el calcetín con rombos.
- **Andy Villarroel:** motor de sonido generado por código, menú LED, regalos de los pasajeros, muertes, modo pintura, derrumbe del último vagón y el despertar.

## Trabajo con Codex

Cada integrante trabajó con Codex en su parte del juego, en tareas cortas de 15 a 30 minutos, siguiendo las reglas de [`AGENTS.md`](AGENTS.md) (stack sin frameworks, quién es dueño de cada carpeta, la forma de cada escena). En [`CODEX_LOG.md`](CODEX_LOG.md) registramos qué le pedimos, qué salió y qué decidimos. Algunos ejemplos:

- **Qué probamos:** un shader PS1 sin dependencias nuevas (vértices a 320x240 y tramado 4x4); analizar Iron Lung, Fatal Frame, Silent Hill y SCP-173 para sacar mecánicas (celular radar, la foto que miente, «romper la regla»), tomando ideas de diseño y no assets; un parkour con salto perdonador (coyote time y buffer) que un jugador automático cruzó sin caer.
- **Qué mejoramos al probar:** la hora punta pasó de ~111 s a ~75 s para que el susto llegue antes; cambiamos voces habladas por murmullos sin palabras con el tono de cada personaje; antes del apagón la vista es normal y la cámara aparece recién cuando se corta la luz; separamos sustos que se pisaban (la foto que miente ya no cae encima de una muerte); el vagón roto ahora deja marcado lo que alumbras; agregamos avisos de tecla que aparecen cuando la acción importa y un cuaderno que anota los números del código.
- **Seguridad:** el límite de destellos está en el código: aunque se apriete F sin parar, nunca hay más de 2 por segundo.

## Código de honor

Incorporamos los cinco ingredientes sorpresa durante la jornada del lunes 23 de noviembre de 2026.

- **Completo italiano:** la señora te lo regala en la hora punta («la palta y el tomate son de la feria»).
- **Guiño a 31 Minutos:** el escolar te regala su calcetín con rombos («¡Calcetín con rombos maaan!»). Hecho con geometría propia, sin arte oficial.
- **«Queda una pura»:** el escolar, que viene contando las estaciones, grita «¡Queda una pura estación pa' Casa!» justo antes del apagón.
- **El número 23:** el metro es la Línea 23 (menú, misiones y letreros).
- **Logo de Codex:** en el menú («HECHO CON CODEX») y en Créditos.
- **Ingrediente que cambia cómo se juega y su efecto:** el **completo italiano**. Con E lo tiras y los borrados que están cerca se van al olor y te dejan pasar.
- **Prototipo previo:** no llegamos con prototipo. Hoy construimos todo el juego.

## Materiales desarrollados previamente

Todo lo demás (código, sonido generado por código, texturas y objetos hechos con geometría) se creó durante la hackatón.

| Recurso | Autor | Enlace público | Licencia | Cambios realizados |
| --- | --- | --- | --- | --- |
| Three.js (biblioteca 3D) | three.js authors | https://github.com/mrdoob/three.js | MIT | Ninguno |
| Vite (servidor y build) | Vite contributors | https://github.com/vitejs/vite | MIT | Ninguno |
| Modelo «Man in Suit» (oficinista) | Quaternius | https://poly.pizza/m/mQnGoME1ez | CC0 1.0 | Materiales con look PS1 y escala |
| Modelo «Woman» (señora) | Quaternius | https://poly.pizza/m/AQsd9ngvKU | CC0 1.0 | Materiales con look PS1 y escala |
| Modelo «Woman Casual» | Quaternius | https://poly.pizza/m/jpKRgGDxhk | CC0 1.0 | Ninguno |
| Modelo «Hoodie Character» (escolar) | Quaternius | https://poly.pizza/m/gKLBoRsyKe | CC0 1.0 | Materiales con look PS1 y escala |
| Modelo «Casual Character» (vendedor) | Quaternius | https://poly.pizza/m/kZ3DmIoGip | CC0 1.0 | Materiales con look PS1 y escala |
| Fuente Cormorant Garamond (modo pintura) | Christian Thalmann | https://github.com/CatharsisFonts/Cormorant | SIL Open Font License 1.1 | Ninguno |
| Música del menú «Before the City Wakes» | Generada con IA: Gemini, de Google (pedida por Andy Villarroel) | https://gemini.google.com (el archivo trae la firma de procedencia C2PA de Google) | Uso según las condiciones de servicio de Gemini | Ninguno |
| Logo de Codex | OpenAI | https://hackathon.codexparatodos.com/logos/codex.png | Entregado por la organización de la hackatón | Pintado en blanco para verse sobre fondo oscuro |

La Línea 23, el Andén Cero y la estación Casa son ficticios. El juego no usa logos ni sonidos oficiales de Metro de Santiago y no tiene relación con esa empresa.

## Licencia

El código de este repositorio está bajo **licencia MIT** (ver [`LICENSE`](LICENSE)). Los recursos de terceros conservan sus propias licencias (ver la tabla de arriba).
