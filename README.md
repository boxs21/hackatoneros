# Fin de Servicio

> *Sales de la pega. El metro se apaga. Solo puedes ver a la gente con el flash.*

Juego corto de terror suave en primera persona, ambientado en un vagón de metro de Santiago a la hora punta. Hecho en un día para la hackathon **Build Games with Codex** (Santiago, 23 de noviembre de 2026), parte del UDDevs Game Fest 2026.

**▶ Jugar en el navegador:** https://<USUARIO>.github.io/<REPO>/ <!-- TODO: reemplazar con el link real de GitHub Pages -->

---

## Descripción

Son las seis de la tarde. Sales de la pega y te subes a un metro lleno. Entre empujones conoces a cuatro pasajeros: un escolar, un oficinista que habla con su jefe, una señora que vuelve de la feria y un vendedor de chocolates.

De pronto el tren frena en el túnel y se apaga todo. Silencio. La multitud desapareció y solo quedan ustedes cinco. Pero no están solos: **la gente solo se ve con el flash del celular.** Y cada vez que lo usas, están más cerca.

- **Duración:** unos 5 minutos.
- **Género:** terror suave, exploración y puzzles cortos.
- **Plataforma:** navegador de escritorio (Chrome, Edge o Firefox recientes).
- **Idioma:** español de Chile.

### Lo central del juego

- **El flash es tu única forma de ver,** pero cada flash acerca a "los borrados". Cada vez que aprietas F decides cuánto riesgo tomar.
- **Los cuatro pasajeros desaparecen uno por uno, y lo ves tú,** flash a flash.
- **Lo que dejó cada uno es la clave para salir:** la mochila del escolar, la voz del vendedor en la oscuridad.
- **El sonido es parte de la mecánica:** el silencio después del apagón y el audio espacial que te guía en la oscuridad.

---

## Cómo ejecutarlo

### Opción 1: jugar en línea
Abre el link de GitHub Pages que está arriba. No hay que instalar nada.

### Opción 2: correrlo en tu computador

**Requisitos:** [Node.js](https://nodejs.org/) 20 o superior y npm (viene con Node).

```bash
git clone https://github.com/<USUARIO>/<REPO>.git
cd <REPO>
npm install
npm run dev
```

Abre la dirección que aparece en la terminal (normalmente http://localhost:5173).

Para generar la versión de producción:

```bash
npm run build     # genera la carpeta dist/
npm run preview   # sirve dist/ en local para probarla
```

La carpeta `dist/` es la que se publica en GitHub Pages.

> **Importante:** haz click en la pantalla de inicio para empezar. Los navegadores no reproducen audio hasta que el jugador interactúa.

---

## Controles

| Acción | Tecla |
| --- | --- |
| Moverse | W A S D |
| Mirar | Mouse |
| **Flash** | **F** |
| Interactuar con objetos | E |
| Pausa / soltar el mouse | Esc |

Cada mecánica se explica en pantalla la primera vez que aparece. Si te quedas atascado, a los 30 segundos aparece una pista en el celular del juego, y a los 90 segundos el tren avanza solo.

### Modo demo (para presentar)

Agrega `?demo=1` al final de la URL. Con las teclas **1 a 8** saltas directo a cada momento del juego:

| Tecla | Momento |
| --- | --- |
| 1 | Pantalla de inicio |
| 2 | Hora punta |
| 3 | Apagón |
| 4 | Los cinco |
| 5 | Los borrados |
| 6 | Vagón del Escolar |
| 7 | Vagón del Vendedor |
| 8 | Final |

En modo demo también: **N** pasa al siguiente momento, **R** reinicia el actual y **H** oculta el panel.

---

## Advertencias

- **Destellos de luz:** el juego usa flashes blancos repetidos. Si tienes sensibilidad a las luces intermitentes (por ejemplo, epilepsia fotosensible), juega con precaución.
- **Terror suave:** hay sustos y oscuridad, pero no hay sangre ni violencia explícita. Los personajes desaparecen.
- **Se recomienda jugar con audífonos.**

## Privacidad: uso de la cámara

Al final, el juego puede pedir permiso para usar la webcam y mostrar una "selfie" dentro del juego.

- La imagen **se procesa solo en tu navegador.** No se guarda, no se sube a ningún servidor y no se envía a nadie.
- **Es opcional:** si no das permiso o no tienes cámara, el final usa una silueta y el juego funciona igual.

---

## Integrantes

| Nombre | Rol |
| --- | --- |
| Valentín Castro | Lead técnico: integración, flujo del juego, vagón del Vendedor y final |
| Camilo Bufadel | Vagón 3D, mecánica del flash, los borrados y vagón del Escolar |
| Renato <!-- TODO: apellido --> | Arte, personajes, interfaz del celular, textos y narrativa |
| Andy Villarroel | Música, diseño de sonido, voces y audio espacial |

---

## Tecnologías

- [Three.js](https://threejs.org/): gráficos 3D en el navegador.
- [Vite](https://vite.dev/): servidor de desarrollo y build.
- Web Audio API: sonido y audio espacial.
- JavaScript plano, sin frameworks.
- [Codex](https://openai.com/codex/): agente de programación usado para construir, probar e iterar el juego.

### Estructura del proyecto

```
src/
  main.js        Punto de entrada
  core/          Máquina de estados, eventos, modo demo, reinicio, ayudas
  states/        Un archivo por momento del juego
  mechanics/     Flash y borrados
  world/         Vagón, luces y personajes
  ui/            Celular, subtítulos y galería
  audio/         Gestor de sonido
public/
  audio/         Voces, efectos y música
```

---

## Cómo usamos Codex

Cada integrante trabajó con Codex en su propia parte del juego, con tareas cortas de 15 a 30 minutos. Las reglas que seguía el agente están en [`AGENTS.md`](AGENTS.md).

En [`CODEX_LOG.md`](CODEX_LOG.md) registramos las decisiones importantes: qué le pedimos, qué salió y qué decidimos con el resultado. Por ejemplo: *el primer flash duraba 300 ms y se veía todo; lo bajamos a 120 ms porque la tensión viene de no alcanzar a ver.* <!-- TODO: reemplazar por una decisión real del log -->

---

## Créditos y licencias

### Código
El código de este repositorio está bajo **licencia MIT** (ver [`LICENSE`](LICENSE)).

### Recursos propios
Todo lo que sigue fue creado por el equipo durante la hackathon y se publica bajo **[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.es)** (se puede usar citando a los autores):

- Voces de los personajes: grabadas por los integrantes del equipo.
- Efectos de sonido y ambiente: <!-- TODO: indicar si son grabaciones propias del metro o generados por código -->
- Música: compuesta por Andy Villarroel. <!-- TODO: confirmar -->
- Modelos, siluetas y texturas: creados con código (geometría de Three.js) por el equipo.

### Bibliotecas de terceros

| Recurso | Autor | Licencia |
| --- | --- | --- |
| [Three.js](https://github.com/mrdoob/three.js) | three.js authors | MIT |
| [Vite](https://github.com/vitejs/vite) | Vite contributors | MIT |
<!-- TODO: agregar fuentes, sonidos u otros recursos de terceros si se usaron, con autor, fuente y licencia -->

### Aviso
La "Línea 0" y las estaciones del juego son ficticias. El juego no usa logos, sonidos oficiales ni marcas de Metro de Santiago y no tiene relación con esa empresa.

---

## Declaración

Este proyecto se desarrolló durante la jornada del 23 de noviembre de 2026 en la hackathon Build Games with Codex (Aula Magna, Universidad del Desarrollo, Santiago de Chile).

---

## Solución de problemas

| Problema | Solución |
| --- | --- |
| No se escucha nada | Haz click en la pantalla de inicio; revisa que la pestaña no esté silenciada. |
| El mouse no mueve la cámara | Haz click dentro del juego para capturar el mouse. Esc lo suelta. |
| El juego va lento | Cierra otras pestañas. Prueba en Chrome o Edge. |
| La cámara no se activa | Es opcional: el final funciona sin ella. Revisa los permisos de cámara del navegador. |
| `npm install` falla | Revisa que tengas Node.js 20 o superior (`node -v`). |
