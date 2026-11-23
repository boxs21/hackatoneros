# Fin de Servicio

> *Sales de la pega. El metro se apaga. Solo puedes ver a la gente con el flash.*

Juego corto de terror en primera persona, ambientado en un vagón de metro de Santiago a la hora punta. Hecho en un día para la hackatón **Build Games with Codex** (Santiago, 23 de noviembre de 2026), parte del UDDevs Game Fest 2026.

**▶ Jugar en el navegador:** https://boxs21.github.io/hackatoneros/

---

## Descripción

Son las 18:04. Sales de la pega y te subes a la **Línea 23** rumbo a Casa. Tu celular no tiene batería y el metro va lleno. Entre empujones conoces a cuatro pasajeros: un escolar, una señora que vuelve de la feria, un vendedor de chocolates y un oficinista que te presta su celular para llamar a tu mamá.

Suena una vez… y el tren frena en el túnel. Se apaga todo. **A la gente solo se la ve con el flash del celular, y cada flash los acerca.** Uno a uno, los cuatro desaparecen, y lo que te dejó cada uno es lo que te permite llegar a Casa.

**Objetivo:** cruzar los vagones hasta la estación Casa.

- **Duración:** unos 5 minutos.
- **Género:** terror, exploración y puzzles cortos.
- **Plataforma:** navegador de escritorio (Chrome, Edge o Firefox recientes).
- **Idioma:** español de Chile.

### El recorrido

| # | Momento | Qué haces |
| --- | --- | --- |
| 1 | Menú | Letrero LED del tren: «FIN DE SERVICIO · LÍNEA 23 · ÚLTIMO TREN». |
| 2 | Hora punta | Avanzas empujando a la multitud, conoces a los cuatro, les respondes y cada uno te da un objeto. |
| 3 | Apagón | Corte seco a negro y silencio. |
| 4 | Los cinco | Aprendes el flash: la segunda foto muestra a alguien que no debería estar. |
| 5 | Los borrados | El vagón está lleno de siluetas que solo se ven con el flash. Cada foto los acerca y se lleva a uno de los cuatro. |
| 6 | Vagón del Escolar | Un código de 3 números escrito con tiza, visible solo con el flash. Lo marcas en el teclado de la puerta. |
| 7 | Vagón roto | No hay piso: saltas entre pedazos del vagón. El flash muestra el camino por un instante. |
| 8 | Vagón del Vendedor | Oscuridad total. Su voz te guía desde adelante. |
| 9 | Estación Casa | El final. |

### Lo central del juego

- **El dilema del flash:** es tu única forma de ver, pero cada foto acerca a los borrados.
- **Los objetos de los pasajeros cambian la partida:** el celular del oficinista (flash), el calcetín con rombos del escolar (de la suerte, nuestro guiño a 31 Minutos), el chocolate del vendedor (te salva una vez) y el **completo italiano** de la señora (lo tiras y los borrados se van al olor).
- **El sonido es parte de la mecánica:** el silencio del apagón y la voz del vendedor que te guía en la oscuridad. Se recomienda jugar con audífonos.
- **Fallar no duele:** si te atrapan, reinicias el vagón en menos de un segundo; a los 30 s sin avanzar aparece una pista.

---

## Cómo jugar o ejecutar

### Opción 1: en línea
Abre https://boxs21.github.io/hackatoneros/ . No hay que instalar nada.

### Opción 2: en tu computador

**Requisitos:** [Node.js](https://nodejs.org/) 20 o superior y npm (viene con Node). Cualquier sistema operativo.

```bash
git clone https://github.com/boxs21/hackatoneros.git
cd hackatoneros
npm install
npm run dev
```

Abre la dirección que aparece en la terminal (normalmente http://localhost:5173).

Versión de producción:

```bash
npm run build     # genera la carpeta dist/
npm run preview   # sirve dist/ en local para probarla
```

> **Importante:** en el menú presiona una tecla y elige COMENZAR con Enter. Los navegadores no reproducen audio hasta que el jugador interactúa.

---

## Controles

**Movimiento**
- **W A S D** (o flechas): moverse
- **Mouse:** mirar

**Acciones**
- **F:** flash del celular (desde que se corta la luz)
- **E:** usar o interactuar (teclado de la puerta, tirar el completo, recoger)
- **Espacio:** saltar (vagón roto) · saltar diálogo (hora punta, también con Enter)
- **1 / 2:** responder a los pasajeros
- **Tab:** ver la lista de misiones

**Reiniciar o volver al menú**
- Si te atrapan, el vagón se reinicia solo.
- **Esc:** suelta el mouse y pausa; **Esc** de nuevo vuelve al menú. Click para seguir jugando.
- En el menú: **flechas** y **Enter**. El panel **ESCENAS** salta directo a cualquier momento.

**Gráficos**
- **G:** alterna entre el modo pintura y el look PS1 · **Mayús + G:** calidad · **V:** tipo de trazo (en modo pintura)

### Para presentar o probar

- Agrega `?demo=1` a la URL: las teclas **1 a 9** saltan a cada momento (1 menú, 2 hora punta, 3 apagón, 4 los cinco, 5 borrados, 6 Escolar, 7 Vendedor, 8 final, 9 vagón roto), **N** pasa al siguiente, **R** reinicia el momento y **H** oculta el panel.
- `?escena=borrados` (o `?escena=5`) parte directo en esa escena; **[** y **]** van a la anterior y la siguiente.

---

## Advertencias

- **Destellos de luz:** el juego usa flashes blancos repetidos. Están limitados a menos de 3 por segundo, pero si tienes sensibilidad a las luces intermitentes (por ejemplo, epilepsia fotosensible), juega con precaución.
- **Terror:** hay sustos, oscuridad y muertes de personajes (un borrado los saca por la ventana del vagón), con algo de sangre en estilo PS1. No hay contenido explícito más allá de eso.
- **Se recomienda jugar con audífonos.**

---

## Integrantes

| Nombre | Aporte |
| --- | --- |
| Valentín Castro | Lead técnico: estructura del proyecto, máquina de estados, modo demo y reinicio, HUD (misiones, respuestas, avisos de objetos, voces en murmullo), vagón del Vendedor, final en estación Casa, modelos 3D de los pasajeros en escena, logo de Codex y guiño a 31 Minutos |
| Camilo Bufadel | Vagón 3D y look PS1, mecánica del flash y los borrados, hora punta, Los cinco, vagón del Escolar y vagón roto (parkour) |
| Renato Lenis | Arte, personajes, textos y narrativa |
| Andy Villarroel | Motor de sonido generado por código, música y voces, menú LED, regalos de los pasajeros, muertes de los borrados, modelos 3D y modo pintura |

---

## Trabajo con Codex

Cada integrante trabajó con Codex en su parte del juego, en tareas cortas de 15 a 30 minutos. Las reglas que seguía el agente están en [`AGENTS.md`](AGENTS.md): stack sin frameworks, quién es dueño de cada carpeta y la forma de cada escena.

En [`CODEX_LOG.md`](CODEX_LOG.md) registramos las decisiones: qué le pedimos, qué salió y qué decidimos. Algunos ejemplos:

- **Look PS1 sin dependencias nuevas:** Codex propuso un shader que lleva los vértices a 320x240 con tramado 4x4, inyectado en los materiales de Three.js. Decidimos que todo material del vagón pase por `world/ps1.js`.
- **Diseño a partir de otros juegos:** le pedimos analizar Iron Lung, Fatal Frame, Silent Hill, Alien: Isolation y SCP-173. Salieron el celular radar, la foto que miente y «romper la regla». Tomamos ideas de diseño, no assets.
- **Seguridad de destellos:** el límite va en el código. Aunque se apriete F sin parar, nunca hay más de 2 destellos por segundo.
- **Vagón roto:** reemplazamos el vagón de anomalías por un parkour con salto perdonador (coyote time y buffer). Un jugador automático lo cruzó sin caer, así que lo dejamos así.

### Lo que cambiamos al probar

- La hora punta duraba ~111 s; la recortamos a ~75 s para que el susto llegue antes.
- Probamos voces habladas y el equipo prefirió murmullos sin palabras (estilo Undertale), con el tono de cada personaje.
- En nuestras pruebas del vagón del Vendedor era fácil quedar atrapado; ahora hay menos borrados en el pasillo y cada reintento es un poco más fácil.
- Antes del apagón el celular ya estaba en la mano y quitaba sorpresa; ahora la hora punta se ve normal y la cámara aparece recién cuando se corta la luz.

---

## Código de honor

Incorporamos los cinco ingredientes sorpresa durante la jornada del lunes 23 de noviembre de 2026.

| Ingrediente | Dónde está |
| --- | --- |
| **Completo italiano** | La señora te lo regala en la hora punta («la palta y el tomate son de la feria»). |
| **Guiño a 31 Minutos** | En hora punta, el Escolar te regala su calcetín con rombos como agradecimiento («¡Calcetín con rombos maaan!»). Hecho con geometría propia, sin arte oficial. |
| **«Queda una pura»** | El escolar, que viene contando las estaciones, grita «¡Queda una pura estación pa' Casa!» justo antes del apagón. |
| **El número 23** | El metro es la Línea 23: está en el menú, en la lista de misiones y en el letrero de la estación Casa. |
| **Logo de Codex** | En el menú («HECHO CON CODEX») y en Créditos. |

- **Ingrediente que cambia cómo se juega y su efecto:** el **completo italiano**. Con E lo tiras y los borrados que están cerca se van al olor y te dejan pasar (en Los borrados y en el vagón del Vendedor).
- **Prototipo previo:** no llegamos con prototipo. Todo el juego se construyó durante la jornada.

---

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
| Música del menú «Before the City Wakes» | Por confirmar | Por confirmar | Por confirmar | Por confirmar |
| Logo de Codex | OpenAI | https://hackathon.codexparatodos.com/logos/codex.png | Entregado por la organización de la hackatón | Pintado en blanco para verse sobre fondo oscuro |

### Aviso

La Línea 23 y la estación Casa son ficticias. El juego no usa logos ni sonidos oficiales de Metro de Santiago y no tiene relación con esa empresa.

---

## Licencia

El código de este repositorio está bajo **licencia MIT** (ver [`LICENSE`](LICENSE)). Los recursos de terceros conservan sus propias licencias (ver la tabla de arriba).

---

## Solución de problemas

| Problema | Solución |
| --- | --- |
| No se escucha nada | Presiona una tecla en el menú; revisa que la pestaña no esté silenciada. |
| El mouse no mueve la cámara | Haz click dentro del juego para capturar el mouse. Esc lo suelta. |
| El juego va lento | Presiona G para volver al look PS1, o Mayús + G para bajar la calidad. Cierra otras pestañas. |
| `npm install` falla | Revisa que tengas Node.js 20 o superior (`node -v`). |
