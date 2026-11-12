/* =========================================================================
   PIECES CATALOG — sección 6 (piezas) y sección 7 (inicio/fin).

   Alcance de esta iteración (acordado con el cliente): categorías
   Estructuras + Impulso + Interacción. El resto de las 33 piezas del
   documento (Movilidad, Destrucción, Especiales) queda pendiente, pero
   el schema ya soporta agregarlas sin cambios de arquitectura: basta con
   sumar entradas a PIECES_CATALOG.

   NOTA sobre unlockLevel: como todavía no implementamos el sistema de
   progresión/XP (sección 14), en el editor libre TODAS las piezas del
   catálogo están disponibles sin importar unlockLevel. El campo se deja
   presente en el schema para cuando se conecte PlayerProfile.level.
   ========================================================================= */

const RGM = window.RGM || {};
window.RGM = RGM;

RGM.FREE_MODE_IGNORE_UNLOCK = true;

RGM.PieceCategories = {
  estructuras: { label: "Estructuras", color: "var(--color-cat-estructuras)", hex: "#8D6E63", icon: "▭" },
  movilidad:   { label: "Movilidad",   color: "var(--color-cat-movilidad)",   hex: "#42A5F5", icon: "➤" },
  impulso:     { label: "Impulso",     color: "var(--color-cat-impulso)",     hex: "#FF7043", icon: "⚡" },
  interaccion: { label: "Interacción", color: "var(--color-cat-interaccion)", hex: "#AB47BC", icon: "🔘" },
  destruccion: { label: "Destrucción", color: "var(--color-cat-destruccion)", hex: "#EF5350", icon: "💥" },
  especiales:  { label: "Especiales",  color: "var(--color-cat-especiales)",  hex: "#26A69A", icon: "✦" },
};

// ---------------------------------------------------------------------
// 6.2 Catálogo — cada objeto sigue EXACTAMENTE el schema `Piece` del
// documento. footprintUG y posiciones están en Unidades de Grilla.
// ---------------------------------------------------------------------
RGM.PIECES_CATALOG = [
  // ---------------- ESTRUCTURAS ----------------
  {
    id: "platform_01",
    name: "Plataforma",
    category: "estructuras",
    icon: "▭",
    footprintUG: { w: 2, h: 0.4 },
    anchorPoint: { x: 0.5, y: 1.0 },
    connectionPoints: [
      { id: "top", x: 0.5, y: 0.0, type: "support" },
    ],
    bodyType: "static",
    defaultMaterial: "madera",
    allowedMaterials: ["madera", "metal", "hielo", "plastico"],
    physics: { collisionShape: "box", isTrigger: false },
    configurableParams: [
      { key: "scale", label: "Tamaño", min: 0.5, max: 2, step: 0.25, default: 1, unit: "x" },
    ],
    emitsEvent: null,
    unlockLevel: 1,
    baseCost: 0,
    description: "Superficie plana de apoyo para otras piezas u objetos.",
  },
  {
    id: "floor_01",
    name: "Piso",
    category: "estructuras",
    icon: "▬",
    footprintUG: { w: 4, h: 0.4 },
    anchorPoint: { x: 0.5, y: 1.0 },
    connectionPoints: [{ id: "top", x: 0.5, y: 0.0, type: "support" }],
    bodyType: "static",
    defaultMaterial: "madera",
    allowedMaterials: ["madera", "metal", "hielo", "plastico"],
    physics: { collisionShape: "box", isTrigger: false },
    configurableParams: [
      { key: "scale", label: "Tamaño", min: 0.5, max: 2, step: 0.25, default: 1, unit: "x" },
    ],
    emitsEvent: null,
    unlockLevel: 1,
    baseCost: 0,
    description: "Base extendida para sostener tramos largos del recorrido.",
  },
  {
    id: "wall_01",
    name: "Pared",
    category: "estructuras",
    icon: "▮",
    footprintUG: { w: 0.4, h: 3 },
    anchorPoint: { x: 0.5, y: 1.0 },
    connectionPoints: [{ id: "top", x: 0.5, y: 0.0, type: "support" }],
    bodyType: "static",
    defaultMaterial: "madera",
    allowedMaterials: ["madera", "metal", "cristal"],
    physics: { collisionShape: "box", isTrigger: false },
    configurableParams: [
      { key: "scale", label: "Tamaño", min: 0.5, max: 2, step: 0.25, default: 1, unit: "x" },
    ],
    emitsEvent: null,
    unlockLevel: 1,
    baseCost: 0,
    description: "Barrera vertical, contiene o redirige objetos móviles.",
  },
  {
    id: "ramp_straight_01",
    name: "Rampa a izquierda",
    category: "estructuras",
    icon: "◺",
    footprintUG: { w: 4.2, h: 0.7 },
    // anchor a la izquierda-abajo: al rotar con Q/E, el extremo derecho
    // sube/baja alrededor del extremo izquierdo, como pide 4.4.2.
    anchorPoint: { x: 0.0, y: 1.5 },
    connectionPoints: [
      { id: "low-end", x: 0.0, y: 1.0, type: "support" },
      { id: "high-end", x: 1.0, y: 0.0, type: "support" },
    ],
    bodyType: "static",
    defaultMaterial: "madera",
    allowedMaterials: ["madera", "metal", "hielo", "goma", "plastico"],
    physics: { collisionShape: "box", isTrigger: false },
    configurableParams: [
      { key: "scale", label: "Tamaño", min: 0.5, max: 2, step: 0.25, default: 1, unit: "x" },
    ],
    emitsEvent: null,
    unlockLevel: 1,
    baseCost: 0,
    description: "Superficie inclinada derecha a izquierda, para dirigir objetos por gravedad.",
  },
  {
    id: "ramp_straight_02",
    name: "Rampa a derecha",
    category: "estructuras",
    icon: "◺",
    footprintUG: { w: 4.2, h: 0.7 },
    // anchor a la derecho-abajo: al rotar con Q/E, el extremo derecho
    anchorPoint: { x: 1.5, y: 0.0 },
    connectionPoints: [
      { id: "low-end", x: 1.0, y: 1.0, type: "support" },
      { id: "high-end", x: 0.0, y: 0.0, type: "support" },
    ],
    bodyType: "static",
    defaultMaterial: "madera",
    allowedMaterials: ["madera", "metal", "hielo", "goma", "plastico"],
    physics: { collisionShape: "box", isTrigger: false },
    configurableParams: [
      { key: "scale", label: "Tamaño", min: 0.5, max: 2, step: 0.25, default: 1, unit: "x" },
    ],
    emitsEvent: null,
    unlockLevel: 1,
    baseCost: 0,
    description: "Superficie inclinada izquierda a derecha, para dirigir objetos por gravedad.",
  },
  {
    id: "domino_01",
    name: "Dominó",
    category: "estructuras",
    icon: "▯",
    footprintUG: { w: 0.28, h: 1.1 },
    anchorPoint: { x: 0.5, y: 1.0 },
    connectionPoints: [],
    // A diferencia del resto de Estructuras, el Dominó es DINÁMICO a
    // propósito: tiene que poder caer y empujar al siguiente de la fila.
    bodyType: "dynamic",
    defaultMaterial: "madera",
    allowedMaterials: ["madera", "metal", "plastico", "cristal"],
    physics: { collisionShape: "box", isTrigger: false },
    configurableParams: [
      // Igual que la "Fuerza" del Resorte: un slider que ajusta cuánto
      // cuesta mover la pieza. Más sensibilidad = más liviana = un
      // golpe suave (ej. una bola chica) ya la tumba y la empuja lejos.
      { key: "sensibilidad", label: "Sensibilidad al choque", min: 10, max: 100, default: 50, unit: "%" },
      { key: "scale", label: "Tamaño", min: 0.5, max: 2, step: 0.25, default: 1, unit: "x" },
    ],
    emitsEvent: null,
    unlockLevel: 1,
    baseCost: 0,
    description: "Cae al recibir un empujón y puede tumbar al siguiente en fila. Ajustá la sensibilidad para que se mueva más fácil ante un golpe.",
  },

  // ---------------- IMPULSO ----------------
  {
    // Instancia literal del ejemplo de la sección 6.2 del documento.
    id: "spring_01",
    name: "Resorte",
    category: "impulso",
    icon: "spring.svg",
    footprintUG: { w: 1, h: 1 },
    anchorPoint: { x: 0.5, y: 1.0 },
    connectionPoints: [{ id: "top", x: 0.5, y: 0.0, type: "output" }],
    bodyType: "dynamicOnContact",
    defaultMaterial: "plastico",
    allowedMaterials: ["madera", "metal", "goma", "plastico"],
    physics: { collisionShape: "box", isTrigger: false },
    configurableParams: [
      { key: "force", label: "Fuerza de impulso", min: 10, max: 100, default: 45, unit: "N" },
      { key: "scale", label: "Tamaño", min: 0.5, max: 2, step: 0.25, default: 1, unit: "x" },
    ],
    emitsEvent: "onImpulseTriggered",
    unlockLevel: 5,
    baseCost: 0,
    description: "Impulsa objetos hacia arriba al recibir contacto.",
  },
  {
    id: "pulley_01",
    name: "Polea (dos ganchos)",
    category: "impulso",
    icon: "🪝",
    // Ahora SÍ tiene dos puntas de agarre, una a cada lado de la rueda,
    // unidas por una misma cuerda de largo fijo: lo que baja de un lado
    // sube del otro, como una polea de verdad. Cada gancho es un punto
    // donde podés enganchar OTRA pieza del circuito (una bola, un
    // Tacho...) para que actúe de contrapeso — ver el inspector de esta
    // pieza, sección "Ganchos". El acople izquierda/derecha se resuelve
    // en logic.js (no hay un joint de polea nativo en Matter.js, así que
    // se simula a mano, con un poco de amortiguación para que no tiemble
    // cuando está en reposo).
    footprintUG: { w: 1.4, h: 2.6 },
    anchorPoint: { x: 0.5, y: 0.0 },
    connectionPoints: [
      { id: "hook-left", x: 0.0, y: 1.0, type: "grip" },
      { id: "hook-right", x: 1.0, y: 1.0, type: "grip" },
    ],
    bodyType: "dynamic", // los GANCHOS son dinámicos; la rueda/anclaje es fija (ver physicsEngine.js)
    defaultMaterial: "metal",
    allowedMaterials: ["metal", "madera", "plastico"],
    physics: { collisionShape: "circle", isTrigger: false },
    configurableParams: [
      { key: "ropeLength", label: "Largo total de cuerda", min: 2, max: 8, default: 4, unit: " UG" },
    ],
    emitsEvent: null,
    unlockLevel: 1,
    baseCost: 0,
    description: "Dos ganchos unidos por una cuerda sobre una rueda: lo que baja de un lado sube del otro. Enganchá otras piezas para hacer contrapeso.",
  },

  // ---------------- ESPECIALES (objetos de Inicio y Meta — los coloca
  // el jugador, ya no aparecen solos por defecto) ----------------
  {
    id: "main_ball_01",
    name: "Bola",
    category: "especiales",
    icon: "⚪",
    footprintUG: { w: 0.44, h: 0.44 },
    anchorPoint: { x: 0.5, y: 0.5 },
    connectionPoints: [],
    bodyType: "dynamic",
    defaultMaterial: "madera",
    allowedMaterials: ["madera", "metal", "goma", "hielo", "cristal", "plastico"],
    physics: { collisionShape: "circle", isTrigger: false },
    configurableParams: [
      { key: "size", label: "Tamaño", min: 0.18, max: 0.9, step: 0.02, default: 0.44, unit: " UG" },
    ],
    emitsEvent: null,
    unlockLevel: 1,
    baseCost: 0,
    // Bandera especial: es un objeto "principal" — puede llegar a la
    // meta y la cámara la sigue mientras esté en movimiento. Poné
    // tantas como quieras; el circuito gana apenas UNA cualquiera llega.
    // Si una se cae del mapa, se la saca de juego pero el resto sigue
    // corriendo — no es game over automático.
    isMainObject: true,
    description: "Objeto de Inicio: hace falta al menos una para que el circuito funcione. Podés poner varias.",
  },
  {
    id: "main_mouse_01",
    name: "Ratón",
    category: "especiales",
    icon: "🐁",
    footprintUG: { w: 0.48, h: 0.48 },
    anchorPoint: { x: 0.5, y: 0.5 },
    connectionPoints: [],
    bodyType: "dynamic",
    defaultMaterial: "plastico",
    allowedMaterials: ["madera", "metal", "goma", "hielo", "cristal", "plastico"],
    physics: { collisionShape: "circle", isTrigger: false },
    configurableParams: [
      { key: "size", label: "Tamaño", min: 0.2, max: 0.9, step: 0.02, default: 0.48, unit: " UG" },
    ],
    emitsEvent: null,
    unlockLevel: 1,
    baseCost: 0,
    isMainObject: true,
    frictionBoost: 0.15,
    description: "Objeto de Inicio alternativo: hace falta al menos un objeto de Inicio (Bola o Ratón) para que el circuito funcione.",
  },
  {
    id: "end_meta_01",
    name: "Meta",
    category: "especiales",
    icon: "🎯",
    footprintUG: { w: 0.7, h: 0.7 },
    anchorPoint: { x: 0.5, y: 0.5 },
    connectionPoints: [],
    bodyType: "static",
    defaultMaterial: "plastico",
    allowedMaterials: ["plastico"],
    physics: { collisionShape: "circle", isTrigger: true },
    configurableParams: [],
    emitsEvent: null,
    unlockLevel: 1,
    baseCost: 0,
    isEndObject: true,
    description: "Objeto de Meta: hace falta al menos uno para que el circuito tenga final. Cualquier objeto de Inicio que lo toque gana.",
  },
  {
    id: "end_cheese_01",
    name: "Queso",
    category: "especiales",
    icon: "🧀",
    footprintUG: { w: 0.6, h: 0.6 },
    anchorPoint: { x: 0.5, y: 0.5 },
    connectionPoints: [],
    bodyType: "static",
    defaultMaterial: "plastico",
    allowedMaterials: ["plastico"],
    physics: { collisionShape: "circle", isTrigger: true },
    configurableParams: [],
    emitsEvent: null,
    unlockLevel: 1,
    baseCost: 0,
    isEndObject: true,
    description: "Meta alternativa (pensada para el Ratón, pero cualquier objeto de Inicio la puede tocar para ganar).",
  },

  // ---------------- MOVILIDAD (objetos que se empujan/chocan entre sí) ----------------
  {
    id: "ball_small_01",
    name: "Bola chica",
    category: "movilidad",
    icon: "⚪",
    footprintUG: { w: 0.34, h: 0.34 },
    anchorPoint: { x: 0.5, y: 0.5 },
    connectionPoints: [],
    bodyType: "dynamic",
    defaultMaterial: "madera",
    allowedMaterials: ["madera", "metal", "goma", "hielo", "cristal", "plastico"],
    physics: { collisionShape: "circle", isTrigger: false },
    configurableParams: [
      { key: "scale", label: "Tamaño", min: 0.5, max: 2, step: 0.25, default: 1, unit: "x" },
    ],
    emitsEvent: null,
    unlockLevel: 1,
    baseCost: 0,
    description: "Un objeto suelto más para la reacción en cadena: la bola principal la puede golpear y ponerla en movimiento.",
  },
  {
    id: "ball_medium_01",
    name: "Bola mediana",
    category: "movilidad",
    icon: "⚪",
    footprintUG: { w: 0.5, h: 0.5 },
    anchorPoint: { x: 0.5, y: 0.5 },
    connectionPoints: [],
    bodyType: "dynamic",
    defaultMaterial: "madera",
    allowedMaterials: ["madera", "metal", "goma", "hielo", "cristal", "plastico"],
    physics: { collisionShape: "circle", isTrigger: false },
    configurableParams: [
      { key: "scale", label: "Tamaño", min: 0.5, max: 2, step: 0.25, default: 1, unit: "x" },
    ],
    emitsEvent: null,
    unlockLevel: 1,
    baseCost: 0,
    description: "Más pesada que la chica: cuesta más moverla, pero pega más fuerte al chocar.",
  },
  {
    id: "ball_large_01",
    name: "Bola grande",
    category: "movilidad",
    icon: "⚪",
    footprintUG: { w: 0.75, h: 0.75 },
    anchorPoint: { x: 0.5, y: 0.5 },
    connectionPoints: [],
    bodyType: "dynamic",
    defaultMaterial: "metal",
    allowedMaterials: ["madera", "metal", "goma", "hielo", "cristal", "plastico"],
    physics: { collisionShape: "circle", isTrigger: false },
    configurableParams: [
      { key: "scale", label: "Tamaño", min: 0.5, max: 2, step: 0.25, default: 1, unit: "x" },
    ],
    emitsEvent: null,
    unlockLevel: 1,
    baseCost: 0,
    description: "Pesada — buena como contrapeso en la Polea, o para aplastar piezas livianas a su paso.",
  },
  {
    id: "trash_can_01",
    name: "Tacho de basura",
    category: "movilidad",
    icon: "🗑️",
    footprintUG: { w: 0.7, h: 0.9 },
    anchorPoint: { x: 0.5, y: 1.0 },
    connectionPoints: [],
    bodyType: "dynamic",
    // "plastico" por defecto (antes "metal"): un tacho de metal era
    // demasiado pesado como para que un golpe lateral lo vuelque de
    // verdad — con plástico sigue siendo sólido pero se puede tumbar.
    defaultMaterial: "plastico",
    allowedMaterials: ["plastico", "metal", "madera"],
    physics: { collisionShape: "box", isTrigger: false },
    configurableParams: [
      { key: "scale", label: "Tamaño", min: 0.5, max: 2, step: 0.25, default: 1, unit: "x" },
    ],
    emitsEvent: null,
    unlockLevel: 1,
    baseCost: 0,
    description: "Contenedor real (piso + paredes, sin tapa): las cosas caen dentro de verdad. Un golpe lateral lo puede volcar y derramar lo que tenía adentro — bueno para reacciones en cadena.",
  },

  // ---------------- INTERACCIÓN ----------------
  {
    id: "lever_01",
    name: "Palanca",
    category: "interaccion",
    icon: "⚖",
    footprintUG: { w: 2.2, h: 0.15 },
    anchorPoint: { x: 0.5, y: 0.5 },
    connectionPoints: [{ id: "pivot", x: 0.5, y: 0.5, type: "pivot" }],
    bodyType: "dynamic",
    defaultMaterial: "madera",
    allowedMaterials: ["madera", "metal", "plastico"],
    physics: { collisionShape: "box", isTrigger: false },
    configurableParams: [
      { key: "scale", label: "Tamaño", min: 0.5, max: 2, step: 0.25, default: 1, unit: "x" },
    ],
    emitsEvent: "onLeverActivated",
    unlockLevel: 1,
    baseCost: 0,
    description: "Bascula sobre su pivote central al recibir peso de un lado.",
  },
  {
    id: "button_01",
    name: "Botón",
    category: "interaccion",
    icon: "⏺",
    footprintUG: { w: 0.6, h: 0.25 },
    anchorPoint: { x: 0.5, y: 1.0 },
    connectionPoints: [{ id: "signal", x: 0.5, y: 0.0, type: "output" }],
    bodyType: "static",
    defaultMaterial: "plastico",
    allowedMaterials: ["madera", "metal", "goma", "plastico"],
    physics: { collisionShape: "box", isTrigger: true },
    configurableParams: [],
    emitsEvent: "onButtonPressed",
    unlockLevel: 1,
    baseCost: 0,
    description: "Se activa al recibir presión de un objeto en movimiento.",
  },
  {
    id: "sensor_01",
    name: "Sensor",
    category: "interaccion",
    icon: "◎",
    footprintUG: { w: 0.8, h: 0.8 },
    anchorPoint: { x: 0.5, y: 0.5 },
    connectionPoints: [{ id: "signal", x: 0.5, y: 0.0, type: "output" }],
    bodyType: "static",
    defaultMaterial: "plastico",
    allowedMaterials: ["plastico", "metal"],
    // Textual del documento: "un Sensor tiene isTrigger: true y
    // emitsEvent: onSensorActivated"
    physics: { collisionShape: "circle", isTrigger: true },
    configurableParams: [],
    emitsEvent: "onSensorActivated",
    unlockLevel: 25,
    baseCost: 0,
    description: "Detecta el paso de un objeto sin bloquear su avance.",
  },
];

// Tamaño real de una instancia en UG: el footprint del catálogo por el
// parámetro "Tamaño" (scale) que tenga configurado esa pieza.
RGM.getFootprint = function (inst, def) {
  const k = (inst && inst.paramOverrides && inst.paramOverrides.scale) || 1;
  return { w: def.footprintUG.w * k, h: def.footprintUG.h * k };
};

RGM.getPieceDef = function (pieceId) {
  return RGM.PIECES_CATALOG.find((p) => p.id === pieceId) || null;
};

// ---------------------------------------------------------------------
// Nota histórica: antes existía un sistema aparte de "objetos de inicio/
// final" (sección 7 del documento) con un único Start y un único End
// siempre presentes por defecto. A pedido del cliente, eso se eliminó:
// ahora Inicio y Meta son piezas normales del catálogo de arriba (los
// 4 items en categoría "especiales", con `isMainObject`/`isEndObject`),
// que el jugador coloca a mano, en la cantidad que quiera, igual que
// cualquier otra pieza.
// ---------------------------------------------------------------------
