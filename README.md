## Novedades — Celular y pantallas táctiles

- Control táctil: un dedo arrastra piezas y mueve el plano; dos dedos hacen zoom y mueven el plano. Con una pieza elegida, el dedo muestra el fantasma y se coloca al soltar.
- Barra inferior con 🧩 Piezas / ⚙️ Ajustes, rotar ⟲ ⟳, borrar 🗑️ y cancelar ✕ (reemplaza al teclado).
- El panel de piezas pasa a ser una hoja que sube desde abajo; la barra superior se desliza si no entra.
- Mouse y teclado siguen igual en PC.

## Novedades — Nivel Experto (lv6): una sola Máquina Rube Goldberg

El nivel **"Experto: Máquina Rube Goldberg"** (🏁 Niveles, dificultad 5) se rehízo por completo: ya no son carriles repetidos sino **una única máquina encadenada de 76 piezas**, con un solo **INICIO** (la Bola principal, arriba a la izquierda) y un solo **FINAL** (la Meta, abajo). Dura ~46 s y gana la bola principal al tocar la Meta.

Cada pieza se usa **al menos 3 veces** (salvo Inicio y Final, que son una sola; el Ratón y el Queso no se usan) y con tamaños ajustados (parámetro *Tamaño*) para que encajen:
- Botón ×5, Sensor ×5, Palanca ×5, Resorte ×3, Plataforma ×3, Polea ×3, Rampas ×13, Pisos ×17, Tacho ×3, Pared ×3, Dominó ×5, Bola chica/mediana/grande ×3 c/u.

Cómo corre: la bola principal pisa un **Botón** → libera una **Bola grande** que tumba los **Dominós** hasta un **Sensor** → otra compuerta suelta la bola principal hacia una **Polea** que la sube → **Resortes** y **Plataformas** la elevan → una **Palanca** abre una compuerta → una bola ayudante frenada por una **Pared** pisa un **Botón** → un **Tacho** cae sobre una **Palanca** → compuerta → cadena de **Poleas** con bolas contrapeso y ayudantes → último **Tacho**/**Palanca** abre la compuerta final y la bola cae a la **Meta**.

Verificación: se probó quitando pieza por pieza; todas cambian el recorrido de la máquina o la frenan. Casos más flojos: los dominós del medio (la fila funciona como grupo: sin todos, o sin el primero/último, no gana) y la bolita chica de cada polea, que actúa de contrapeso.

En **Reconstruir** hay que rearmar las 76 piezas con sus parámetros (Tamaño, Material, Fuerza, Largo de soga, Sensibilidad) *y* los 13 vínculos Botón/Sensor/Palanca → compuerta. Si la réplica es idéntica da ★★★ (probado).

Cambios internos: los cooldowns de resorte/polea ahora usan el reloj de la simulación (no dependen de los FPS); la rotación se normaliza (345° = -15°); la réplica hereda el límite de tiempo del nivel.

---

## Novedades — Niveles armados + modo Reconstruir

Nuevo botón 🏁 **Niveles** en la barra superior. Hay 5 máquinas prearmadas (todas verificadas en simulación: se resuelven solas con las piezas por defecto):

| Nivel | Qué practica |
|---|---|
| Primera rodada | planos inclinados |
| Zigzag de rampas | rampas a izquierda/derecha |
| Salto con resorte | resorte + plataforma |
| Embocá el tacho | tacho como contenedor |
| Gran recorrido | todo lo anterior encadenado |

Cada nivel tiene dos botones:

- **Ver y probar**: abre una copia en el editor libre. La corrés con ▶, la modificás o la guardás con otro nombre.
- **Reconstruir** (GDD 4.6): 1) *Observación*: la máquina se muestra con cuenta regresiva y cámara que recorre las piezas (botón Saltar). 2) *Ocultamiento*: se desvanece en partículas (600 ms). 3) *Reconstrucción*: plano vacío; el panel de piezas muestra solo las del nivel, con cantidad restante (ej. `2/3`). Botón **Comparar** (cada 30 s) superpone la máquina original 4 s, pero cuesta 1 estrella. Al probar, se evalúa:
  - **Funcionamiento** (obligatorio): la bola llega a la meta.
  - **Posición**: pieza del mismo tipo a ≤ 0,5 UG y ≤ 20° de la original.
  - **Cantidad** de piezas usadas vs. originales.
  - **Estrellas (GDD 17.4)**: 0 = no funciona · 1 = funciona · 2 = funciona y ≥ 70 % bien ubicadas (±1 pieza) · 3 = funciona, error medio < 0,2 UG, todas ubicadas y misma cantidad.
  - Las estrellas se guardan en el navegador (`rgm_progress_v1`) y se muestran en la lista.

Pendiente de este modo: el criterio **Orden** de activación (requiere registrar eventos durante la simulación) y el modo Desafíos libre con `pieceLimits` configurables por el jugador.

Archivos: `levels.js` (nuevo, en `_source_modular/`), cambios en `ui.js` e `index.html`. Para agregar niveles, sumá una entrada a `LEVEL_DEFS` en `levels.js` (posiciones en múltiplos de 0,25 UG y rotaciones en múltiplos de 15° para que el jugador pueda replicarlas exactas).

---

# Máquina Rube Goldberg — Editor (adaptación web del GDD)

Reconstrucción completa en **HTML5 + Matter.js**, migrando el prototipo
anterior en Pygame/Pymunk para alinearse con el motor sugerido en
`GDD_Maquina_Rube_Goldberg_Especificacion_Tecnica.md`.

## Novedades de esta vuelta (respuesta a bugs/pedidos reportados)

**Paso 2 del plan acordado — ajustes a piezas que ya existían:**

- **Tamaño ajustable para Bola y Ratón**: nuevo slider "Tamaño" en el
  inspector (de 0.18 a 0.9 UG), aplicado tanto a la vista previa del
  editor como al cuerpo físico en la simulación. Cada bola/ratón puesto
  puede tener su propio tamaño. (De paso arreglé que los sliders del
  inspector usaban un paso fijo de 1 — habría hecho inservible un
  slider de rango fraccionario como este; ahora cada parámetro puede
  definir su propio paso.)
- **Hielo más dramático**: fricción bajada casi a cero (0.02 → 0.004) y
  un poco más de rebote, PERO además ahora un objeto en movimiento que
  toca hielo recibe un empujón real de velocidad (+18%) al primer
  contacto — porque bajar la fricción solo hace que frene menos, no que
  gane velocidad. Con cooldown para que no se acelere sin límite
  mientras se desliza por una superficie helada larga. Aplica a
  CUALQUIER pieza hecha de hielo (plataforma, rampa, pared, etc.).
- **Sensibilidad al choque en el Dominó**: nuevo slider (10–100%),
  igual en espíritu a la "Fuerza" del Resorte. Más sensibilidad = la
  pieza es más liviana = un golpe suave (ej. una bola chica) ya la
  tumba y la empuja más lejos. Está implementado de forma genérica:
  cualquier pieza a la que se le agregue un parámetro "sensibilidad" lo
  va a respetar sin cambios de código extra.

**Paso 1 del plan acordado — los dos bugs:**

- **Piezas "corridas" entre editor y simulación — encontrado y
  arreglado**: el sospechoso era la Rampa (la única pieza con forma de
  cuña triangular real). `Matter.Bodies.fromVertices` ubica el CENTRO
  DE MASA del triángulo en la posición que le pasás — y en un
  triángulo, el centro de masa no coincide con el centro del rectángulo
  que lo contiene (está corrido 1/6 del ancho y el alto). El editor
  dibujaba la pieza centrada en su rectángulo; la física la simulaba
  centrada en su centro de masa real. Esa diferencia de unos pocos
  píxeles era el "desfasaje". Ya está compensado — lo que ves en el
  editor ahora es exactamente donde termina en la simulación.
- **El Tacho de basura ahora es un contenedor de verdad**: antes era
  una caja sólida rectangular (por eso todo chocaba contra la "tapa" en
  vez de caer adentro — no tenía ningún hueco). Ahora es un cuerpo
  compuesto real: piso + dos paredes, sin tapa. Las cosas caen dentro
  de verdad, y como sigue siendo un solo objeto físico, un golpe
  lateral lo puede volcar — al volcarse, lo que tenía adentro deja de
  estar contenido y se derrama por física normal (sin código especial
  para eso: es una consecuencia natural de la forma). Cambié también su
  material por defecto de Metal a Plástico, porque de metal pesaba
  demasiado como para que un golpe lo tumbe de verdad.

- **Inicio y Meta ya no aparecen solos, y ya no son especiales**: antes
  eran campos aparte del diseño que siempre estaban presentes (con un
  selector propio en el panel). Ahora son piezas normales del catálogo
  (categoría "Especiales": Bola, Ratón, Meta, Queso) — un diseño nuevo
  arranca en blanco, y el jugador las coloca donde quiera, en la
  cantidad que quiera, exactamente igual que cualquier otra pieza
  (mismo click-para-elegir, mismo arrastre, mismo panel de inspector).
- **Las bolas/ratones "de más" ya no caen infinito**: al unificarlas con
  el objeto de Inicio bajo el mismo sistema, el chequeo de "se cayó del
  mapa" ahora corre sobre TODOS los objetos principales en juego, no
  solo sobre uno. El que se cae se saca de juego (desaparece del mundo
  físico) en vez de seguir cayendo para siempre fuera de cámara.
- **Perder ya no es "que se caiga uno"**: el circuito solo declara
  fallo cuando YA NO QUEDA ningún objeto principal en juego (todos se
  cayeron) o se agota el tiempo límite. Mientras quede al menos uno
  activo, la simulación sigue corriendo con normalidad.

- **Zoom liberado**: antes, al simular, la cámara forzaba el zoom a un
  valor fijo cada cuadro y peleaba contra la rueda del mouse — por eso
  quedaba "pegada" a la pelota sin dejar alejarse. Ahora la cámara solo
  sigue la POSICIÓN; el zoom lo manejás vos, en cualquier momento,
  incluso con la simulación corriendo.
- **Bolas y Tacho ahora son piezas de verdad, no variantes de Inicio/Meta**:
  antes eran alternativas al elegir qué objeto arranca o termina el
  circuito — mal entendido de mi parte. Ahora Bola chica/mediana/grande
  y Tacho de basura son piezas colocables normales, en una categoría
  nueva "Movilidad": las podés poner en el medio del recorrido para que
  la bola principal las choque y arranque una reacción en cadena, como
  en un Rube Goldberg real.
- **Polea rehecha: enganche en vivo, por peso real, con límite fijo**:
  versiones anteriores a esta armabas el enganche en el editor antes de
  simular, y además tenía bugs (los ganchos "caían solos", o cualquier
  toque hacía bajar el lado del todo sin importar el peso real). Ahora:
  - Los ganchos por sí solos no pesan nada — no se mueven bajo ninguna
    circunstancia si no hay nada tocándolos.
  - **Cualquier cosa que toque un gancho durante la simulación se pega
    ahí sola** (mientras ese gancho esté libre): una Bola, un Tacho, la
    pelota/ratón principal, lo que sea.
  - El lado que gana es el de **mayor peso real** (masa de verdad:
    tamaño × material, no solo "quién tocó primero"). El más liviano
    sube a la par.
  - **Al llegar al límite de la cuerda, queda fija ahí** — no sigue
    temblando ni se mueve más, salvo que el otro lado reciba algo de
    MÁS peso, en cuyo caso recién ahí se invierte.
  - Lo que esté pegado se suelta apenas toca otra cosa que no sea su
    propio gancho (una pared, el piso, otra pieza) — así la pelota
    principal puede "viajar" colgada de la polea un tramo y soltarse al
    llegar a otro punto del circuito, como un ascensor/contrapeso real.
  *Nota de alcance*: sigue sin ser un solver de polea "de libro" (Matter.js
  no trae uno nativo) — es una comparación directa de masa entre lo que
  hay enganchado en cada lado, no una simulación de tensión de cuerda
  con todos los matices de un motor con soporte nativo para poleas.

- **Bolas y ratones "principales" ilimitados**: además del Inicio real,
  ahora podés colocar tantas Bolas y Ratones como quieras desde el
  panel de piezas (categoría "Movilidad") — se colocan igual que
  cualquier otra pieza. Cada uno cuenta como objeto que puede llegar a
  la meta, igual que el del Inicio: alcanza con que UNO de todos ellos
  la toque para ganar.
- **Cámara panorámica con varios objetos en movimiento**: si más de una
  Bola/Ratón "principal" está en movimiento al mismo tiempo, la cámara
  se centra entre todos y abre el zoom lo necesario para que entren
  todos en pantalla (con margen de sobra). Con uno solo moviéndose,
  sigue igual que antes sin tocar el zoom — el ajuste panorámico solo
  entra cuando hace falta.

- **Cámara que sigue el recorrido**: al presionar "Probar diseño" la
  cámara ahora acompaña suavemente al objeto de inicio (bola/ratón)
  durante todo el recorrido, en vez de quedarse fija — ya no hace falta
  ver el circuito entero de entrada para poder seguirlo.
- **Más rango de zoom para alejar**: el límite mínimo de zoom bajó
  bastante, para poder ver circuitos largos completos si querés alejarte
  en vez de depender solo de la cámara que sigue.
- **Rampa a la izquierda / Rampa a la derecha**: ahora son dos piezas
  separadas (antes solo había una "Rampa recta" que había que rotar).
  Cada una es una cuña triangular espejada de la otra.
- **Dominó**: pieza de Estructuras que cae y empuja al siguiente en fila
  (a diferencia del resto de Estructuras, es dinámica: no se queda fija).
- **Resorte arreglado**: tenía un bug real — quedaba marcado como cuerpo
  que cae con la gravedad en vez de quedarse fijo, así que se caía del
  plano antes de que la pelota lo tocara. Además, el impulso ahora es
  una velocidad de lanzamiento directa (antes era una fuerza tan chica
  que no se notaba).
- **Materiales con variación real, visual y física**: cada material
  (Madera/Metal/Goma/Hielo/Cristal/Plástico) ahora se ve distinto (tinte
  + textura: vetas, brillo metálico, puntos de goma, destello de hielo)
  tanto en el editor como durante la simulación — antes el editor
  siempre pintaba el color de la categoría e ignoraba el material
  elegido. La física (fricción/rebote) ya estaba diferenciada por
  material desde antes, pero no se notaba porque nunca se veía cuál
  material tenía puesto cada pieza.
- **Botón y Sensor ahora hacen algo, y se VE**: desde el inspector de
  cada uno aparece "+ Vincular pieza" — click, y después click en la
  pieza del plano que querés controlar. El Botón la rota 180° a la
  derecha al presionarse; el Sensor 180° a la izquierda al detectar el
  paso de un objeto. La rotación es gradual (~0.7s), no instantánea —
  antes pasaba en un solo cuadro de física y era invisible al ojo,
  ahora se ve girar la pieza en tiempo real durante el recorrido. Se
  dibuja una línea punteada en el plano mostrando qué está vinculado
  con qué.
- **La Rampa recta ahora es una cuña triangular real**, no un rectángulo
  rotado. Motivo técnico: un rectángulo es simétrico, así que rotarlo
  180° no cambiaba nada — con la pieza asimétrica, la rotación del punto
  anterior sí cambia de verdad el recorrido de la pelota.
- **Inicio y Meta elegibles y arrastrables**: en el panel derecho hay un
  selector para elegir Bola o Ratón (inicio) y Meta o Queso (final), y
  ambos se pueden arrastrar directo en el plano a donde quieras — antes
  quedaban fijos en una posición default.
- **Guardar con nombre propio**: el botón 💾 ahora abre un diálogo para
  escribir el nombre antes de guardar, en vez de guardar todo bajo el
  mismo nombre genérico.
- **Taller y Fábrica habilitados**: ya no dicen "Próximamente" — se
  puede cambiar de fondo (por ahora es solo un cambio de paleta de
  color, todavía no hay arte específico para cada uno).

## Cómo correr

Solo hacen falta 2 archivos: **`index.html`** y **`app.js`** (todo el
CSS y todo el JS del proyecto están unificados en esos dos, a propósito,
para eliminar cualquier problema de rutas rotas o carpetas mal copiadas).

1. Poné `index.html` y `app.js` en la misma carpeta.
2. Doble click en `index.html`.
3. Necesita conexión a internet la primera vez, para bajar Matter.js
   (el motor de física) desde cdnjs.cloudflare.com.

Si tu navegador bloquea la carga de `app.js` al abrir `index.html`
directo desde el disco (pasa a veces en Chrome con rutas `file://`),
corré un servidor local simple desde la carpeta del proyecto:

```bash
python -m http.server 8000
# abrí http://localhost:8000 en el navegador
```

**Si algo falla al iniciar**, ahora el error se muestra directo en la
pantalla (texto en fondo oscuro, con el detalle técnico) en vez de
quedar oculto en la consola del navegador — copiá ese texto tal cual
para poder diagnosticarlo.

## Estructura del proyecto entregado

```
index.html            — TODO lo necesario para correr: HTML + CSS + carga de app.js
app.js                 — TODO el JavaScript del juego, en un solo archivo
README.md
_source_modular/        — el mismo código separado en sus módulos originales
                           (más fácil de editar/mantener a futuro; NO hace
                           falta para correr el juego, es solo referencia)
```

## Controles

| Acción | Cómo |
|---|---|
| Elegir pieza para colocar | Click en la celda del panel derecho |
| Colocar pieza | Click en el plano (con una pieza elegida) |
| Colocar varias sin reelegir | Mantené Shift al hacer click |
| Mover pieza ya colocada (incluye Inicio/Meta) | Arrastrarla |
| Vincular Botón/Sensor a una pieza | Seleccioná el Botón/Sensor → "+ Vincular pieza" → click en la pieza objetivo |
| Seleccionar pieza | Click sobre ella |
| Rotar (elegida o fantasma) | Q / E (pasos de 15°) |
| Quitar pieza seleccionada | Delete / Backspace, o botón en el inspector |
| Cancelar selección/fantasma | Escape |
| Paneo de cámara | Arrastrar sobre el plano vacío |
| Zoom | Rueda del mouse |
| Guardar | Ctrl+S o botón 💾 |

## Alcance de esta iteración vs. el documento completo

Este proyecto es **un subconjunto deliberado** del GDD completo (que
describe un juego comercial con progresión, XP, logros, i18n, sync a la
nube, etc.). Lo que se decidió construir ahora, y lo que queda pendiente:

### Implementado
- **Motor de física** (sección 5): Matter.js, timestep fijo, gravedad e
  iteraciones configurables desde `constants.js`.
- **Catálogo de piezas** (sección 6.2), categorías Estructuras + Impulso +
  Interacción: Plataforma, Piso, Pared, Rampa recta, Resorte, Palanca,
  Botón, Sensor. Cada una sigue el schema `Piece` exacto del documento.
- **Objetos de Inicio/Meta** (sección 7): Bola, Ratón, Meta y Queso —
  piezas normales del catálogo (categoría "Especiales"), no un campo
  aparte del diseño. Cantidad libre de cada una.
- **Sistema de materiales** (sección 8): los 6 materiales del documento,
  sobreescriben density/friction/restitution/breakThreshold.
- **Sistema de lógica** (sección 10): motor de eventos real
  (`onSensorActivated`, `onButtonPressed`, `onLeverActivated`,
  `onImpulseTriggered`) + `LogicNode` funcional (SI evento de pieza X,
  ENTONCES abrir/cerrar/encender pieza Y). Falta el editor visual de
  nodos por arrastre — los `logicNodes` de un diseño se escriben en su
  JSON directamente.
- **Editor de Construcción completo** (sección 4.4): barra superior,
  panel derecho con categorías + búsqueda + inspector, panel de
  inventario (en modo libre, ilimitado), plano con grilla, cámara con
  pan/zoom.
- **Máquina de estados de simulación** (sección 11): editar → validar →
  correr/pausa/cámara lenta/paso a paso → éxito/fallo, con timeout de
  fallo.
- **Validaciones automáticas** (sección 12): hay inicio, hay final,
  piezas/materiales válidos, superposición crítica entre piezas
  estáticas. La validación de "camino conectado" es una **heurística de
  proximidad** (advertencia, no bloqueante) — no reemplaza un chequeo
  físico real.
- **Asistente Tornillín** (sección 18): reglas para objeto atascado, sin
  camino detectado, inactividad del jugador, y éxito.
- **Guardado de diseños** (subconjunto de la sección 13.2 y 16):
  localStorage del navegador + exportar/importar como archivo `.json`.
  El formato ya es compatible con agregar compresión Base64 y QR después
  sin tocar el schema.

### Explícitamente fuera de alcance esta vez (a pedido, para no
### entregar 20 sistemas a medio hacer)
- Piezas de Movilidad, Destrucción y Especiales (quedan 25 de las 33 sin
  implementar; agregar una es solo sumar una entrada a `PIECES_CATALOG`).
- Sistema de progresión/XP, logros, perfil de jugador — por eso el modo
  libre ignora `unlockLevel` y el inventario es ilimitado.
- Modo Historia / niveles con objetivos y estrellas (sección 14).
- Compartir por código Base64 + QR (sección 16) — el JSON exportable ya
  cubre la necesidad inmediata de compartir un diseño.
- i18n, modo daltónico, ajustes de accesibilidad (sección 19-20).
- Sincronización a la nube — todo el guardado es local al navegador.
- Validación #6 (simulación headless previa) — sustituida por detección
  en vivo durante la corrida real (ver comentario en `validation.js`).

## Módulos fuente (dentro de `_source_modular/`)

`app.js` es la concatenación exacta de estos archivos, en este orden
(así están organizados para editar el código a futuro; si modificás
alguno, hay que volver a concatenarlos para regenerar `app.js`):

```
tokens.css        — paleta, tipografía, radios (sección 2 del GDD)
layout.css         — layout de las 4 regiones del editor
constants.js        — física (sección 5), UG, estados
materials.js         — sistema de materiales (sección 8)
pieces.js             — catálogo de piezas + start/end objects (6, 7)
design.js              — schema Design + guardado (13.2, 16 parcial)
validation.js           — validaciones automáticas (12)
physicsEngine.js         — fábricas de cuerpos Matter.js + render
logic.js                  — eventos de piezas + LogicNode (10)
tornillin.js                — asistente (18)
simulation.js                — máquina de estados (11)
ui.js                         — editor completo (4.4)
main.js                        — bootstrap
```

## Nota sobre el prototipo anterior en Python

La carpeta/entrega previa en Pygame + Pymunk queda obsoleta a partir de
esta iteración — todo el desarrollo sigue acá, en la versión web, que es
la que se acordó alinear con el motor sugerido por el documento.
