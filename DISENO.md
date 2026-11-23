# Dirección visual — Fin de Servicio

Decisiones de diseño ya tomadas, con los valores exactos para implementarlas.
Cada sección dice a quién le toca según `AGENTS.md`.

## Resumen

| Tema | Decisión | Dueño |
| --- | --- | --- |
| Línea | **Línea 23** (cumple el "23" obligatorio) | Renato, Camilo |
| Vagón | Acero azulado, piso negro, asientos rojo apagado | Camilo |
| Personajes | Modelos 3D de `public/modelos/`, con ropa de Santiago | Renato, Camilo |
| Imagen | 320×240 con tratamiento de cinta VHS | Valentín, Camilo |
| Flash | Luz cálida de 120 ms con estela de medio segundo | Camilo |
| Borrados | Siluetas negras con ojos blancos | Camilo |
| Celular | Toda la pantalla es el visor de la cámara | Renato |
| Letras | Letra de máquina en ámbar, tipo tablero de próximo tren | Renato |

## Línea 23

- El juego ocurre en la **Línea 23**, ficticia. Reemplaza a "Línea 0" en el README y los textos.
- Dónde se ve: bala amarilla con "23" en la pantalla de inicio, texto `LÍNEA 23 · ÚLTIMO TREN`, y un letrero colgante dentro del vagón (caja de 1,35 × 0,45 m a 2 m de altura) con la bala y "LÍNEA 23".
- Nada de logos, colores de línea ni señalética de Metro de Santiago.

## Vagón (Camilo)

Vagón de 20 m de largo, 2,6 m de ancho y 2,3 m de alto. Cámara a 1,6 m.

| Parte | Color |
| --- | --- |
| Paredes y techo | `#9aa3ad` |
| Piso | `#23272e` |
| Asientos | `#aa2d2d` |
| Base de asientos | `#15181d` |
| Barras y puertas | `#e0e4e8` |
| Luz del techo | `#e8f0ff` |
| Vidrios | `#05070a` |

- El rojo de los asientos va apagado a propósito: un rojo muy saturado bajo destellos es un riesgo para personas fotosensibles.
- Niebla negra (`FogExp2`, densidad 0,07 a oscuras) para que el fondo del vagón nunca se vea completo.

## Imagen (Valentín, Camilo)

Siempre 320×240 con `image-rendering: pixelated`. Encima, un pase de postproceso tipo VHS:

- El brillo queda nítido y **el color se corre en horizontal** (promedio de 5 muestras a ±1,5 y ±3 píxeles). No separar rojo y azul: eso es de lente, no de cinta.
- Líneas de barrido suaves: `c *= 0.95 + 0.05 * sin(gl_FragCoord.y * PI)`.
- Grano: ruido de ±4% por píxel, distinto en cada cuadro.

```glsl
float px = 1.0 / 320.0;
vec3 c = texture2D(t, uv).rgb;
vec3 croma = (texture2D(t, uv - vec2(px * 3.0, 0.0)).rgb + texture2D(t, uv - vec2(px * 1.5, 0.0)).rgb + c
            + texture2D(t, uv + vec2(px * 1.5, 0.0)).rgb + texture2D(t, uv + vec2(px * 3.0, 0.0)).rgb) / 5.0;
float y = dot(c, vec3(0.3, 0.59, 0.11));
float yc = dot(croma, vec3(0.3, 0.59, 0.11));
c = clamp(croma - yc + y, 0.0, 1.0);
c *= 0.95 + 0.05 * sin(gl_FragCoord.y * 3.14159);
c += (ruido(gl_FragCoord.xy + tiempo) - 0.5) * 0.08;
```

Si el pase VHS no alcanza a entrar, el respaldo es 320×240 sin postproceso.

## Flash (Camilo)

- Luz puntual pegada a la cámara: color `#fff1d6`, intensidad 3, alcance 11 m, caída 1,3.
- Dura **120 ms**. Espera mínima entre flashes: **0,6 s**.
- **Estela:** al terminar el flash, la última imagen queda encima y se desvanece en 0,55 s, con su color (un poco menos saturada), no en gris.

### Seguridad de los destellos (obligatorio)

El juego está hecho de destellos blancos a pantalla completa.

- La norma (WCAG 2.3.1, ITU-R BT.1702) permite como máximo 3 destellos por segundo. Con uno cada 0,6 s se cumple; **el límite va en el código, no en la buena voluntad del jugador**.
- Ráfagas largas también son riesgo: al **cuarto flash seguido** (menos de 1,5 s entre uno y otro) el flash se "recalienta" y la espera sube a **1,5 s**.
- La estela y el brillo de los ojos solo pueden apagarse; nunca volver a encenderse ni parpadear.
- Aviso en la pantalla de inicio: *"Este juego usa destellos de luz repetidos a pantalla completa."*
- Si alcanza el tiempo: opción de flash atenuado. Nunca escribir "seguro para epilepsia".

## Borrados (Camilo)

- Siluetas color `#0b0b0e`, usando los mismos cuerpos de `public/modelos/`, **de frente al jugador**.
- Dos ojos blancos (cajas de 4 × 3,5 cm) a la altura de la cara. No les afecta la niebla.
- Los ojos quedan brillando **0,35 s** después del flash y se apagan de forma pareja.
- **Quietos durante el flash; se mueven solo a oscuras.** Asusta más lo que se quedó quieto y ahora está más cerca. Entre flashes suena un roce (lo pone audio).
- Visibles solo durante el flash, salvo los ojos en ese resto de 0,35 s.

## Celular (Renato)

Toda la pantalla es el visor de la cámara del teléfono:

- Cuatro esquinas blancas a 4% del borde.
- Arriba: `● REC` en rojo `#ff5148`, la hora real y la batería.
- Abajo: `FLASH`, una barra que se rellena durante la espera (0,6 s, o 1,5 s si se recalentó) y la tecla `F`.
- Las pistas entran como aviso sobre el visor.
- Letra monoespaciada, mayúsculas, con sombra negra para que se lea sobre el flash.

## Letras (Renato)

- **Título:** letra de máquina (IBM Plex Mono 500 o similar), mayúsculas, espaciado amplio, color ámbar `#ffb800` con un brillo suave del mismo color.
- Sobre el título, en un recuadro ámbar: `LÍNEA 23 · ÚLTIMO TREN`.
- **Subtítulos:** misma letra, ámbar, mayúsculas, sobre una caja negra al 72%.
- Revisar que nada se corte en 1366×768.

## Personajes (Renato, Camilo)

Modelos en `public/modelos/` (ver su `LEEME.txt` para cargarlos). Los colores van por material, así que se cambian con `material.color`. Llevarlos a la altura indicada.

### Ropa por material

**Oficinista** — `oficinista.glb`, 1,76 m. Terno azul marino, camisa celeste, corbata burdeo.

| Material | Color |
| --- | --- |
| Shirt, Pants (terno) | `#1e2a44` |
| Details, TieTexture (camisa) | `#bfd7ea` |
| Skin | `#c99672` |
| Hair | `#17130f` |

Objetos: corbata burdeo `#7a1f2b`, credencial colgada (cinta azul `#1565c0`, tarjeta blanca), maletín café `#3d2716` en la mano derecha, celular en la izquierda.

**Señora** — `senora.glb`, 1,58 m. Chaleco de lana lila, pelo teñido cobrizo.

| Material | Color |
| --- | --- |
| Jacket | `#8e7ba6` |
| LightJacket | `#a593ba` |
| Shirt | `#ede6da` |
| Pants | `#3e3a44` |
| Skin | `#ddb08c` |
| Hair / HairBase | `#7a3b22` / `#5e2d1b` |

Objetos: carro de feria de dos ruedas con tela escocesa (azul `#2f4c8c`, rojo `#b5332e`, crema `#f1e9c9`), verduras verdes asomadas, y una bolsa con marraquetas `#d9a860`.

**Escolar** — `escolar.glb`, 1,5 m. Polerón azul marino de colegio, pantalón gris, zapatillas.

| Material | Color |
| --- | --- |
| Purple (polerón) | `#1f2a44` |
| LightBlue y la piel de `Casual_Legs` (pantalón largo) | `#6b6f76` |
| White | `#f2f2ee` |
| Skin | `#b07e5a` |
| Hair, Eyebrows | `#17130f` |

El modelo trae short: pintar del mismo gris la piel de la malla `Casual_Legs` lo convierte en pantalón largo.
Objetos: mochila negra con bolsillo rojo `#d83a2e`, audífonos negros.

**Vendedor** — `vendedor.glb`, 1,7 m. Polera, jeans y jockey. Ropa corriente, ni rota ni amenazante.

| Material | Color |
| --- | --- |
| LightBrown (polera) | `#3f5c4a` |
| Red_Dark, LightBlue (jeans) | `#35507a` |
| White | `#e6e6e6` |
| Skin / Skin_Darker | `#c99672` / `#b98562` |
| Hair, Eyebrows | `#2e2118` |

Objetos: jockey negro, caja de cartón `#b58a55` colgada al cuello con barras de colores planos (rojo, amarillo, morado, **sin marcas**), banano negro cruzado al pecho para el vuelto.

**Pasajera** — `mujer.glb`, relleno para la multitud. Polera blanca, jeans.

| Material | Color |
| --- | --- |
| Shirt | `#f2f2ee` |
| Pants | `#35507a` |
| Shoes | `#1a1a1a` |
| Skin | `#b07e5a` |
| Hair, HairBase | `#17130f` |

Objetos: mochila **adelante**, como en hora punta, y el **completo italiano** obligatorio en la mano: pan `#e0b878`, tomate `#c8372d`, palta `#8db04a`, mayonesa `#f6f1dc`, en ese orden de abajo hacia arriba.

### Multitud

- Piel, de clara a oscura: `#f0cdb0` `#ddb08c` `#c99672` `#b07e5a` `#8f623f` `#6b4630`. Mayoría en los tonos del medio.
- Pelo: negro `#17130f` y castaño oscuro `#2e2118` dominan; algo de castaño `#4a3324`, cano `#9a9a98` y teñido cobrizo `#7a3b22`.
- Ropa: mucho azul marino, negro, gris y jeans.

### Qué evitar

- Logos, tarjeta de pago azul, nombres de estaciones reales y marcas de chocolates.
- Atar el tono de piel al oficio del personaje.
- Poncho, chupalla o cualquier cosa de campo: es Santiago urbano.
- Uniforme escolar impecable con vestón y corbata: hoy es casi ceremonial.

## Fuentes

- Destellos: [WCAG 2.3.1](https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html), [ITU-R BT.1702-3](https://www.itu.int/dms_pubrec/itu-r/rec/bt/R-REC-BT.1702-3-202311-I!!PDF-E.pdf), [Xbox Accessibility Guideline 118](https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/118), [Game Accessibility Guidelines](https://gameaccessibilityguidelines.com/avoid-flickering-images-and-repetitive-patterns/).
- Estilo PS1 en Three.js: [Roman Liutikov](https://romanliutikov.com/blog/ps1-style-graphics-in-threejs), [David Colson](https://www.david-colson.com/2021/11/30/ps1-style-renderer.html), [psx-spx](https://psx-spx.consoledev.net/graphicsprocessingunitgpu/).
- Terror: [Frictional Games, cuatro formas de diseñar terror](https://gamedeveloper.com/design/four-ways-to-design-for-horror-from-i-amnesia-i-dev-frictional-games), [SCP: Containment Breach](https://fistfulofwits.com/2013/04/23/design-elements-in-horror-scp-containment-breach/), [terror de baja resolución (Fangoria)](https://www.fangoria.com/original/goreplay-inside-the-eerie-world-of-low-res-horror-gaming/).
- Santiago: [uniforme escolar chileno](https://es.wikipedia.org/wiki/Uniforme_escolar_chileno), [comercio ambulante en el metro (The Clinic)](https://www.theclinic.cl/2023/02/10/un-recorrido-por-el-descontrolado-comercio-ambulante-en-el-metro-de-santiago/), [cómo se visten los ejecutivos (Diario Financiero)](https://www.df.cl/tendencias/negocios-mundo/como-se-visten-los-ejecutivos-de-chile-y-latinoamerica), [completo](https://www.latercera.com/practico/noticia/todo-lo-que-hay-que-saber-para-preparar-buenos-y-verdaderos-completos/BWZCNIETDRAJNIK6I5C4Q7MZKE/).

Los colores exactos, el carro escocés, el chaleco lila y la ropa del vendedor son criterio del equipo: ninguna fuente los describe.
