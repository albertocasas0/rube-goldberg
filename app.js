const RGM = window.RGM || {};
window.RGM = RGM;

/* ===== constants.js ===== */
/* =========================================================================
   CONSTANTS — valores globales del motor.
   Los marcados [DEFINIDO EN ESTA ESPECIFICACIÓN] vienen tal cual del
   documento (sección 5); el resto son valores de layout que necesita
   el código para funcionar.
   ========================================================================= */

window.RGM = RGM;

RGM.Constants = (() => {

  // --- 0. Unidad de Grilla ---
  const UG_PX = 64; // 1 UG = 64px a resolución de referencia 1920x1080

  // --- Plano lógico (sección 4.4.2): 60 UG x 34 UG ---
  const PLAYFIELD_UG_W = 60;
  const PLAYFIELD_UG_H = 34;

  // --- 5. Sistema de física (parámetros exactos del documento) ---
  // Matter.js usa px/s^2 con escala propia; interpretamos "scale" del
  // documento como el multiplicador aplicado a la gravedad base 9.8.
  const PHYSICS = {
    gravity: { x: 0, y: 9.8, scale: 6.0 },
    velocityIterations: 8,
    positionIterations: 3,
    timestep: 1 / 60,
    defaultFriction: 0.3,
    defaultRestitution: 0.2,
    linearDamping: 0.01,
    angularDamping: 0.05,
  };

  // Matter.Engine.gravity.y espera una magnitud "por defecto ~1 = 9.8m/s^2
  // en su escala interna"; para respetar el gravity.y * scale del
  // documento sin reinventar unidades, componemos un solo factor:
  const MATTER_GRAVITY_Y = PHYSICS.gravity.y * PHYSICS.gravity.scale * 0.05;
  // (0.05 es un factor de conversión práctico UG<->Matter para que la
  // caída se sienta acorde a las 64px/UG definidas; documentado acá para
  // que el equipo de balance pueda recalibrarlo sin buscarlo en el código.)

  // --- Estados de la máquina de simulación (sección 11) ---
  const SIM_STATE = {
    IDLE: "IDLE",
    VALIDATING: "VALIDATING",
    BLOCKED: "BLOCKED",
    RUNNING: "RUNNING",
    PAUSED: "PAUSED",
    SUCCESS: "SUCCESS",
    FAILURE: "FAILURE",
  };

  // --- Estado de la escena (editor vs simulación) ---
  const SCENE = {
    EDITOR: "EDITOR",
    SIMULATION: "SIMULATION",
  };

  // --- Colisión: categorías Matter.js (bitmask) ---
  const COLLISION = {
    STATIC: 0x0001,
    DYNAMIC: 0x0002,
    SENSOR: 0x0004,
  };

  // --- Timeout de "fallo" si nada llega a la meta ---
  const FAILURE_TIMEOUT_MS = 15000;

  // --- Snapping (sección 4.4.2) ---
  const SNAP_DISTANCE_UG = 0.35;

  return {
    UG_PX,
    PLAYFIELD_UG_W,
    PLAYFIELD_UG_H,
    PHYSICS,
    MATTER_GRAVITY_Y,
    SIM_STATE,
    SCENE,
    COLLISION,
    FAILURE_TIMEOUT_MS,
    SNAP_DISTANCE_UG,
  };
})();

/* ===== materials.js ===== */
/* =========================================================================
   MATERIALS — sección 8. Valores textuales del documento fuente.
   Cada pieza física puede fabricarse en un material que sobreescribe sus
   propiedades físicas base.
   ========================================================================= */

window.RGM = RGM;

RGM.Materials = {
  madera:   { density: 0.6, friction: 0.4, restitution: 0.1,  breakThreshold: 25,  costMultiplier: 1.0, label: "Madera",   renderTint: "#A1887F", pattern: "grain" },
  metal:    { density: 2.5, friction: 0.3, restitution: 0.05, breakThreshold: 999, costMultiplier: 2.0, label: "Metal",    renderTint: "#90A4AE", pattern: "metallic" },
  goma:     { density: 1.1, friction: 0.9, restitution: 0.85, breakThreshold: 60,  costMultiplier: 1.3, label: "Goma",     renderTint: "#37474F", pattern: "dots" },
  hielo:    { density: 0.9, friction: 0.004, restitution: 0.15, breakThreshold: 15,  costMultiplier: 1.4, label: "Hielo",    renderTint: "#B3E5FC", pattern: "shine" },
  cristal:  { density: 1.2, friction: 0.2, restitution: 0.3,  breakThreshold: 5,   costMultiplier: 1.5, label: "Cristal",  renderTint: "#CFD8DC", pattern: "glass" },
  plastico: { density: 0.8, friction: 0.35, restitution: 0.4,  breakThreshold: 40,  costMultiplier: 0.8, label: "Plástico", renderTint: "#FFCC80", pattern: "flat" },
};

/**
 * Combina la config física base de una pieza con las propiedades del
 * material elegido. El material SOBREESCRIBE density/friction/restitution/
 * breakThreshold (regla textual de la sección 8).
 */
RGM.Materials.resolve = function (materialKey) {
  const mat = RGM.Materials[materialKey];
  if (!mat) {
    console.warn(`Material desconocido: ${materialKey}, uso plastico`);
    return RGM.Materials.plastico;
  }
  return mat;
};

/**
 * Dibuja una textura simple encima de una pieza ya rellena, para que el
 * material se distinga a simple vista además de por el tinte de color.
 * Se llama DESPUÉS de ctx.fill() con el path de la pieza todavía activo
 * como clip, centrado en (0,0) con ancho/alto en px ya escalados.
 */
RGM.Materials.paintPattern = function (ctx, materialKey, w, h) {
  const mat = RGM.Materials[materialKey];
  if (!mat) return;
  ctx.save();
  ctx.clip();
  ctx.globalAlpha = 0.5;

  switch (mat.pattern) {
    case "grain": // madera: líneas horizontales onduladas suaves
      ctx.strokeStyle = "rgba(60,40,20,0.5)";
      ctx.lineWidth = Math.max(1, h * 0.06);
      for (let y = -h / 2 + h * 0.2; y < h / 2; y += h * 0.28) {
        ctx.beginPath();
        ctx.moveTo(-w / 2, y);
        ctx.quadraticCurveTo(0, y + h * 0.08, w / 2, y);
        ctx.stroke();
      }
      break;
    case "metallic": // metal: brillo diagonal
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.beginPath();
      ctx.moveTo(-w / 2, h * 0.1);
      ctx.lineTo(-w / 2 + w * 0.25, -h / 2);
      ctx.lineTo(-w / 2 + w * 0.4, -h / 2);
      ctx.lineTo(-w / 2 + w * 0.15, h * 0.1);
      ctx.closePath();
      ctx.fill();
      break;
    case "dots": // goma: puntos
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      const step = Math.max(6, Math.min(w, h) * 0.22);
      for (let y = -h / 2 + step / 2; y < h / 2; y += step) {
        for (let x = -w / 2 + step / 2; x < w / 2; x += step) {
          ctx.beginPath();
          ctx.arc(x, y, step * 0.15, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    case "shine": // hielo: destello + veta cristalina
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.lineWidth = Math.max(1, h * 0.05);
      ctx.beginPath();
      ctx.moveTo(-w / 3, -h / 3);
      ctx.lineTo(w / 4, h / 4);
      ctx.moveTo(-w / 4, h / 3);
      ctx.lineTo(w / 3, -h / 4);
      ctx.stroke();
      break;
    case "glass": // cristal: transparencia (se aplica fuera, acá solo brillo)
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.beginPath();
      ctx.ellipse(-w * 0.15, -h * 0.15, w * 0.18, h * 0.35, 0.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "flat": // plástico: sin textura, solo un leve brillo superior
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.fillRect(-w / 2, -h / 2, w, h * 0.25);
      break;
  }
  ctx.restore();
};

/* ===== pieces.js ===== */
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

/* ===== design.js ===== */
/* =========================================================================
   DESIGN — schema de la sección 13.2 y su persistencia.

   Alcance de esta iteración: guardado LOCAL (localStorage del navegador +
   exportación/importación de archivo .json), que es el subconjunto de la
   sección 16 (Sistema de Compartir) que se pidió para esta pasada. El
   formato comprimido Base64 en grupos "MRGB-XXXX-..." y el QR (16) quedan
   como trabajo futuro — el JSON ya es 100% compatible con ese paso
   posterior, no hace falta tocar el schema para agregarlo después.

   thumbnailUrl usa un data-URL (imagen embebida en el propio JSON) en vez
   de "local://thumbnails/uuid.png": es el equivalente real disponible en
   un navegador sin backend de archivos.
   ========================================================================= */

window.RGM = RGM;

RGM.Design = (() => {
  const STORAGE_KEY = "rgm_designs_v1";

  function uuidv4() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function createEmpty(name = "Mi máquina") {
    const now = new Date().toISOString();
    return {
      designId: uuidv4(),
      name,
      ownerId: "local-player",
      createdAt: now,
      updatedAt: now,
      background: "laboratorio",
      thumbnailUrl: null,
      complexityScore: 0,
      lastPlaytimeSec: 0,
      // Ya no hay un "objeto de inicio" ni "objeto final" por defecto:
      // el jugador coloca sus propias piezas de Inicio/Meta (categoría
      // "especiales" del catálogo) como cualquier otra pieza. Un diseño
      // recién creado empieza en blanco a propósito.
      pieces: [],
      logicNodes: [],
      pulleyAttachments: [], // qué pieza está enganchada a qué gancho de qué Polea
    };
  }

  function instanceId() {
    return "inst-" + Math.random().toString(36).slice(2, 10);
  }

  function addPieceInstance(design, pieceDef, position, rotationDeg, material) {
    const instance = {
      instanceId: instanceId(),
      pieceId: pieceDef.id,
      material: material || pieceDef.defaultMaterial,
      position: { x: position.x, y: position.y },
      rotationDeg: rotationDeg || 0,
      role: "none",
      paramOverrides: {},
      locked: false,
    };
    // valores default de configurableParams como paramOverrides iniciales
    for (const p of pieceDef.configurableParams || []) {
      instance.paramOverrides[p.key] = p.default;
    }
    design.pieces.push(instance);
    return instance;
  }

  function removePieceInstance(design, instanceIdToRemove) {
    design.pieces = design.pieces.filter((p) => p.instanceId !== instanceIdToRemove);
    design.logicNodes = design.logicNodes.filter(
      (n) =>
        n.sourcePieceId !== instanceIdToRemove &&
        (!n.action || n.action.targetPieceId !== instanceIdToRemove)
    );
    design.pulleyAttachments = (design.pulleyAttachments || []).filter(
      (a) => a.pulleyInstanceId !== instanceIdToRemove && a.targetInstanceId !== instanceIdToRemove
    );
  }

  // ---------------- Enganches de Polea (gancho izq/der -> pieza) --------

  function addPulleyAttachment(design, pulleyInstanceId, side, targetInstanceId) {
    design.pulleyAttachments = design.pulleyAttachments || [];
    // un gancho solo puede tener una pieza enganchada a la vez: si ya
    // había algo en ese lado, lo reemplaza
    design.pulleyAttachments = design.pulleyAttachments.filter(
      (a) => !(a.pulleyInstanceId === pulleyInstanceId && a.side === side)
    );
    // una pieza tampoco puede estar enganchada en dos lugares a la vez
    design.pulleyAttachments = design.pulleyAttachments.filter(
      (a) => a.targetInstanceId !== targetInstanceId
    );
    design.pulleyAttachments.push({
      id: instanceId(),
      pulleyInstanceId,
      side, // "left" | "right"
      targetInstanceId,
    });
  }

  function removePulleyAttachment(design, attachmentId) {
    design.pulleyAttachments = (design.pulleyAttachments || []).filter((a) => a.id !== attachmentId);
  }

  function getPulleyAttachments(design, pulleyInstanceId) {
    return (design.pulleyAttachments || []).filter((a) => a.pulleyInstanceId === pulleyInstanceId);
  }

  // ---------------- Vínculos lógicos (Botón/Sensor -> pieza objetivo) ----

  function addLogicLink(design, sourceInstanceId, event, targetInstanceId, command) {
    // evita duplicar el mismo vínculo si ya existe
    const exists = (design.logicNodes || []).some(
      (n) =>
        n.sourcePieceId === sourceInstanceId &&
        n.action &&
        n.action.targetPieceId === targetInstanceId &&
        n.condition &&
        n.condition.event === event
    );
    if (exists) return false;
    design.logicNodes.push({
      nodeId: instanceId(),
      sourcePieceId: sourceInstanceId,
      condition: { event },
      action: { targetPieceId: targetInstanceId, command },
    });
    return true;
  }

  function removeLogicLink(design, nodeId) {
    design.logicNodes = design.logicNodes.filter((n) => n.nodeId !== nodeId);
  }

  function getLinksFrom(design, sourceInstanceId) {
    return (design.logicNodes || []).filter((n) => n.sourcePieceId === sourceInstanceId);
  }

  // ---------------- Persistencia local ----------------

  function listSaved() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const all = raw ? JSON.parse(raw) : {};
      return Object.values(all).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    } catch (e) {
      console.error("Error leyendo diseños guardados:", e);
      return [];
    }
  }

  function save(design, thumbnailDataUrl) {
    design.updatedAt = new Date().toISOString();
    if (thumbnailDataUrl) design.thumbnailUrl = thumbnailDataUrl;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const all = raw ? JSON.parse(raw) : {};
      all[design.designId] = design;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
      return true;
    } catch (e) {
      console.error("Error guardando diseño (¿localStorage lleno o bloqueado?):", e);
      return false;
    }
  }

  function loadById(designId) {
    const raw = localStorage.getItem(STORAGE_KEY);
    const all = raw ? JSON.parse(raw) : {};
    return all[designId] || null;
  }

  function deleteById(designId) {
    const raw = localStorage.getItem(STORAGE_KEY);
    const all = raw ? JSON.parse(raw) : {};
    delete all[designId];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  }

  // ---------------- Exportar / importar archivo .json ----------------

  function exportToFile(design) {
    const blob = new Blob([JSON.stringify(design, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sanitizeFilename(design.name)}.rgm.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function sanitizeFilename(name) {
    return (name || "diseno").toLowerCase().replace(/[^a-z0-9]+/g, "_");
  }

  function importFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result);
          if (!parsed.pieces || !parsed.designId) {
            reject(new Error("El archivo no tiene el formato de un Design válido."));
            return;
          }
          resolve(parsed);
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  return {
    createEmpty,
    addPieceInstance,
    removePieceInstance,
    addLogicLink,
    removeLogicLink,
    getLinksFrom,
    addPulleyAttachment,
    removePulleyAttachment,
    getPulleyAttachments,
    listSaved,
    save,
    loadById,
    deleteById,
    exportToFile,
    importFromFile,
  };
})();

/* ===== validation.js ===== */
/* =========================================================================
   VALIDATION ENGINE — sección 12.

   Implementado de las 6 reglas del documento:
     1. Hay inicio                      -> error bloqueante
     2. Hay final                        -> error bloqueante
     3. Objetos conectados (heurística)  -> ADVERTENCIA, no bloqueante
        (bounding boxes en cadena; es una aproximación geométrica barata,
        no un cálculo físico real, así que puede haber falsos positivos
        con piezas que se tocan por impulso/salto en vez de contacto
        directo — por eso no bloquea, solo avisa)
     4. Piezas válidas (id + material)   -> error bloqueante
     5. Sin superposición crítica > 15%  -> error bloqueante (solo piezas
        estáticas entre sí)
     6. Trayectoria posible (headless)   -> NO implementada como pre-chequeo
        separado. Se sustituye por una detección equivalente en vivo
        durante la simulación real (regla `physics:objectStuck` de
        Tornillín, sección 18) — mismo objetivo (detectar que el objeto
        móvil quedó trabado), sin duplicar el costo de correr la física
        dos veces ni la complejidad de un segundo engine "headless".
   ========================================================================= */

window.RGM = RGM;

RGM.Validation = (() => {
  function validateDesign(design) {
    const errors = [];
    const warnings = [];

    // --- 4. Piezas válidas (armado primero: 1 y 2 lo necesitan) ---
    const boxes = []; // para las validaciones 1, 2, 3 y 5
    for (const inst of design.pieces) {
      const def = RGM.getPieceDef(inst.pieceId);
      if (!def) {
        errors.push(`Pieza desconocida en el diseño: "${inst.pieceId}".`);
        continue;
      }
      if (!def.allowedMaterials.includes(inst.material)) {
        errors.push(
          `"${def.name}" tiene un material no permitido: "${inst.material}".`
        );
      }
      boxes.push(aabbFor(inst, def));
    }

    // --- 1. Hay inicio / 2. Hay final --- (ahora son piezas normales
    // del catálogo, categoría "especiales", marcadas isMainObject /
    // isEndObject — el jugador las coloca, ya no aparecen solas)
    const mainBoxes = boxes.filter((b) => b.isMain);
    const endBoxes = boxes.filter((b) => b.isEnd);
    if (mainBoxes.length === 0) {
      errors.push("Falta al menos un objeto de Inicio (Bola o Ratón).");
    }
    if (endBoxes.length === 0) {
      errors.push("Falta al menos un objeto de Meta (Meta o Queso).");
    }

    // --- 5. Sin superposición crítica (>15% del área menor) entre piezas
    // estáticas SÓLIDAS (los sensores/triggers, como la Meta, no cuentan:
    // no bloquean nada físicamente, así que superponerse con otra pieza
    // ahí puede ser totalmente intencional) ---
    const solidBoxes = boxes.filter((b) => b.isStatic && !b.isTrigger);
    for (let i = 0; i < solidBoxes.length; i++) {
      for (let j = i + 1; j < solidBoxes.length; j++) {
        const overlapRatio = overlapAreaRatio(solidBoxes[i], solidBoxes[j]);
        if (overlapRatio > 0.15) {
          errors.push(
            `"${solidBoxes[i].name}" y "${solidBoxes[j].name}" se superponen demasiado (${Math.round(
              overlapRatio * 100
            )}%). Separalas para evitar que la física quede trabada.`
          );
        }
      }
    }

    // --- 3. Objetos conectados (heurística de cadena por proximidad),
    // ahora con posibles VARIOS orígenes (cada objeto de Inicio) y
    // VARIOS destinos (cada Meta) ---
    if (mainBoxes.length > 0 && endBoxes.length > 0) {
      const reachable = bfsReachable(mainBoxes, boxes, endBoxes);
      if (!reachable) {
        warnings.push(
          "No se detectó una cadena continua de piezas entre el inicio y la meta (puede que igual funcione si hay saltos/impulsos)."
        );
      }
    }

    return { ok: errors.length === 0, errors, warnings };
  }

  function aabbFor(inst, def) {
    // Bola/Ratón principal: si se ajustó el slider "Tamaño", el hitbox
    // real es ese, no el default del catálogo — importa para que la
    // heurística de "cadena conectada" no se confunda con un tamaño
    // viejo.
    const sizeUG = def.isMainObject
      ? (inst.paramOverrides && inst.paramOverrides.size) || def.footprintUG.w
      : RGM.getFootprint(inst, def).w;
    const heightUG = def.isMainObject ? sizeUG : RGM.getFootprint(inst, def).h;
    return {
      name: def.name,
      isStatic: def.bodyType === "static",
      isTrigger: !!(def.physics && def.physics.isTrigger),
      isMain: !!def.isMainObject,
      isEnd: !!def.isEndObject,
      cx: inst.position.x,
      cy: inst.position.y,
      hw: sizeUG / 2,
      hh: heightUG / 2,
    };
  }

  function overlapAreaRatio(a, b) {
    const overlapW = Math.max(
      0,
      Math.min(a.cx + a.hw, b.cx + b.hw) - Math.max(a.cx - a.hw, b.cx - b.hw)
    );
    const overlapH = Math.max(
      0,
      Math.min(a.cy + a.hh, b.cy + b.hh) - Math.max(a.cy - a.hh, b.cy - b.hh)
    );
    const overlapArea = overlapW * overlapH;
    if (overlapArea <= 0) return 0;
    const smallerArea = Math.min(4 * a.hw * a.hh, 4 * b.hw * b.hh);
    return overlapArea / smallerArea;
  }

  const PROXIMITY_MARGIN_UG = 0.6; // tolerancia para considerar "conectadas"

  function boxesNear(a, b) {
    return (
      Math.abs(a.cx - b.cx) <= a.hw + b.hw + PROXIMITY_MARGIN_UG &&
      Math.abs(a.cy - b.cy) <= a.hh + b.hh + PROXIMITY_MARGIN_UG
    );
  }

  function bfsReachable(startBoxes, pieceBoxes, endBoxes) {
    const visited = new Set(startBoxes);
    const queue = [...startBoxes];

    while (queue.length > 0) {
      const current = queue.shift();
      for (const end of endBoxes) {
        if (boxesNear(current, end)) return true;
      }
      for (const box of pieceBoxes) {
        if (visited.has(box)) continue;
        if (boxesNear(current, box)) {
          visited.add(box);
          queue.push(box);
        }
      }
    }
    return false;
  }

  return { validateDesign };
})();

/* ===== physicsEngine.js ===== */
/* =========================================================================
   PHYSICS ENGINE — creación de cuerpos Matter.js a partir de instancias
   de pieza (schema Design.pieces, sección 13.2) y render del canvas.

   Responsabilidad única de este archivo: traducir datos (piezas, start/end
   objects) a cuerpos físicos y dibujarlos. La lógica de eventos/colisiones
   (sección 10) vive en logic.js.
   ========================================================================= */

window.RGM = RGM;

RGM.PhysicsEngine = (() => {
  const C = RGM.Constants;

  function createEngine() {
    const engine = Matter.Engine.create();
    engine.gravity.x = C.PHYSICS.gravity.x;
    engine.gravity.y = C.MATTER_GRAVITY_Y;
    engine.positionIterations = C.PHYSICS.positionIterations;
    engine.velocityIterations = C.PHYSICS.velocityIterations;
    return engine;
  }

  function ugToPx(ug) {
    return ug * C.UG_PX;
  }

  /**
   * Crea el/los Matter.Body para una instancia de pieza colocada.
   * Devuelve { bodies: [...], constraints: [...] } (una Palanca agrega
   * un Constraint de pivote; el resto solo tiene un body).
   */
  function createPieceBody(instance, pieceDef, world) {
    const material = RGM.Materials.resolve(instance.material || pieceDef.defaultMaterial);
    const fp = RGM.getFootprint(instance, pieceDef);
    const wPx = ugToPx(fp.w);
    const hPx = ugToPx(fp.h);
    const xPx = ugToPx(instance.position.x);
    const yPx = ugToPx(instance.position.y);
    // Se normaliza a (-180, 180] para que 345° y -15° den EXACTAMENTE el mismo
    // ángulo en radianes (si no, el ruido de punto flotante cambia el resultado
    // de máquinas largas y una réplica "perfecta" podría no funcionar igual).
    let rotNorm = (((instance.rotationDeg || 0) % 360) + 360) % 360;
    if (rotNorm > 180) rotNorm -= 360;
    const angleRad = rotNorm * (Math.PI / 180);

    // --- Caso especial: Polea — no es un cuerpo de forma fija, es una
    // RUEDA fija en el aire con DOS GANCHOS dinámicos, uno de cada lado,
    // unidos por la misma cuerda de largo total fijo (sección 10 lo
    // resuelve, no hay joint de polea nativo en Matter.js).
    if (pieceDef.id === "pulley_01") {
      return createPulleyBody(instance, pieceDef, material, xPx, yPx);
    }

    // --- Caso especial: Tacho de basura — antes era una caja sólida
    // (por eso todo chocaba contra la "tapa" en vez de caer adentro).
    // Ahora es un cuerpo compuesto real: piso + dos paredes, SIN tapa,
    // así los objetos caen dentro de verdad. Al ser un solo cuerpo
    // dinámico, un golpe lateral lo puede volcar — y al volcarse, lo
    // que tenía adentro deja de estar contenido y se derrama solo, por
    // física normal, sin código extra para eso.
    if (pieceDef.id === "trash_can_01") {
      return createTrashCanBody(instance, pieceDef, material, xPx, yPx, angleRad);
    }

    // "Sensibilidad al choque" (ej. Dominó): si la pieza tiene ese
    // parámetro configurable, se escala su densidad — sensibilidad alta
    // = mucho más liviana = un golpe suave ya la mueve; baja = casi tan
    // pesada como su material real. Mapeo lineal: 10% -> ~91% de la
    // densidad original, 100% -> 10% de la densidad original.
    const sensParam = (pieceDef.configurableParams || []).find((p) => p.key === "sensibilidad");
    let densityMultiplier = 1;
    if (sensParam) {
      const sens =
        instance.paramOverrides && instance.paramOverrides.sensibilidad !== undefined
          ? instance.paramOverrides.sensibilidad
          : sensParam.default;
      densityMultiplier = 1 - (sens / 100) * 0.9;
    }

    const commonOpts = {
      friction: material.friction,
      restitution: material.restitution,
      density: Math.max(material.density * 0.001 * densityMultiplier, 0.00001), // Matter usa densidad muy chica por defecto
      // "dynamicOnContact" (ej. Resorte) NO es un cuerpo libre que cae con
      // la gravedad: se queda fijo en su lugar hasta que algo lo toca, y
      // ahí es el CÓDIGO (logic.js) el que reacciona, no la física sola.
      // Bug corregido: antes esto quedaba en `false`, así que el resorte
      // caía como cualquier objeto suelto antes de que la pelota llegara.
      isStatic: pieceDef.bodyType === "static" || pieceDef.bodyType === "dynamicOnContact",
      angle: angleRad,
      label: `piece:${pieceDef.id}`,
    };

    let body;
    let rampCentroidLocal = null;
    if (pieceDef.physics.collisionShape === "circle") {
      const r = Math.max(wPx, hPx) / 2;
      body = Matter.Bodies.circle(xPx, yPx, r, commonOpts);
    } else if (pieceDef.id === "ramp_straight_01" || pieceDef.id === "ramp_straight_02") {
      // Antes era un rectángulo delgado rotado (una rampa "de mentira":
      // rotarla 180° no cambiaba nada porque un rectángulo es simétrico).
      // Ahora es una cuña real (triángulo rectángulo). ramp_straight_01:
      // lado bajo a la izquierda, alto a la derecha. ramp_straight_02 es
      // su espejo: lado bajo a la derecha, alto a la izquierda.
      const verts =
        pieceDef.id === "ramp_straight_01"
          ? [
              { x: -wPx / 2, y: hPx / 2 },
              { x: wPx / 2, y: hPx / 2 },
              { x: wPx / 2, y: -hPx / 2 },
            ]
          : [
              { x: wPx / 2, y: hPx / 2 },
              { x: -wPx / 2, y: hPx / 2 },
              { x: -wPx / 2, y: -hPx / 2 },
            ];
      // BUG encontrado y arreglado: Matter.Bodies.fromVertices ubica el
      // CENTRO DE MASA real del triángulo en el (x,y) que le pasamos —
      // y en un triángulo, el centro de masa NO es el centro del
      // rectángulo que lo contiene (está corrido 1/6 del ancho/alto
      // hacia el lado más "lleno" de la figura). El editor, en cambio,
      // siempre dibujó la pieza centrada en su rectángulo. Esa diferencia
      // de unos pocos píxeles es lo que se veía como "la pieza se corrió"
      // al pasar de editar a simular. Se compensa desplazando el punto
      // que le pasamos a fromVertices exactamente lo contrario del
      // corrimiento del centroide, así el rectángulo visual (no el
      // centro de masa) es el que queda en la posición pedida.
      // El corrimiento del centroide también gira con la pieza: si la
      // rampa está rotada (ej. 180° como compuerta) hay que rotar ese
      // vector, si no el cuerpo físico queda desplazado respecto de lo
      // que se ve en el editor.
      const localOffX = (pieceDef.id === "ramp_straight_01" ? 1 : -1) * (wPx / 6);
      const localOffY = hPx / 6;
      rampCentroidLocal = { x: localOffX, y: localOffY };
      const cosA = Math.cos(angleRad);
      const sinA = Math.sin(angleRad);
      const centroidOffsetX = localOffX * cosA - localOffY * sinA;
      const centroidOffsetY = localOffX * sinA + localOffY * cosA;
      body = Matter.Bodies.fromVertices(
        xPx + centroidOffsetX,
        yPx + centroidOffsetY,
        [verts],
        commonOpts,
        true
      );
    } else {
      body = Matter.Bodies.rectangle(xPx, yPx, wPx, hPx, commonOpts);
    }

    if (pieceDef.physics.isTrigger) {
      body.isSensor = true;
    }

    body.rgm = {
      role: "piece",
      instanceId: instance.instanceId,
      pieceId: pieceDef.id,
      category: pieceDef.category,
      emitsEvent: pieceDef.emitsEvent,
      footprintUG: pieceDef.footprintUG,
      material: instance.material || pieceDef.defaultMaterial,
      materialKey: instance.material || pieceDef.defaultMaterial,
      breakThreshold: material.breakThreshold,
      configOverrides: instance.paramOverrides || {},
      renderTint: material.renderTint,
      wPx,
      hPx,
      // Para piezas cuyo cuerpo no está centrado en su rectángulo (cuñas):
      // centro del rectángulo + corrimiento local del centroide, así las
      // rotaciones de compuerta giran alrededor del centro de la pieza.
      rectCenter: rampCentroidLocal ? { x: xPx, y: yPx } : null,
      centroidLocal: rampCentroidLocal,
    };

    const result = { bodies: [body], constraints: [] };

    // --- Caso especial: Palanca (lever_01) — pivote en su centro ---
    if (pieceDef.id === "lever_01") {
      const pivot = Matter.Constraint.create({
        pointA: { x: xPx, y: yPx },
        bodyB: body,
        pointB: { x: 0, y: 0 },
        stiffness: 1,
        length: 0,
      });
      result.constraints.push(pivot);
    }

    return result;
  }

  const PULLEY_WHEEL_GAP_UG = 0.55; // separación horizontal entre los dos anclajes de la rueda

  function createPulleyBody(instance, pieceDef, material, wheelXPx, wheelYPx) {
    const ropeLengthUG = (instance.paramOverrides && instance.paramOverrides.ropeLength) || 4;
    const ropeLengthPx = ugToPx(ropeLengthUG);
    const gapPx = ugToPx(PULLEY_WHEEL_GAP_UG);
    const hookRadiusPx = ugToPx(0.18);

    const anchorLeft = { x: wheelXPx - gapPx, y: wheelYPx };
    const anchorRight = { x: wheelXPx + gapPx, y: wheelYPx };

    // En reposo (sin nada enganchado) la cuerda queda repartida mitad y
    // mitad — así al arrancar la simulación ya se ve balanceada.
    const halfPx = ropeLengthPx / 2;

    function makeHook(anchor, side) {
      const hook = Matter.Bodies.circle(anchor.x, anchor.y + halfPx, hookRadiusPx, {
        friction: material.friction,
        restitution: material.restitution,
        density: Math.max(material.density * 0.001, 0.0001),
        // El gancho SÍ es dinámico (puede moverse) pero su propia
        // gravedad se cancela cuadro a cuadro en logic.js — así por sí
        // solo pesa "cero" y no se mueve, pero en cuanto algo se le
        // engancha, el peso REAL de esa cosa (que sí tiene gravedad
        // normal) tira de él a través de esa unión, como una polea de
        // verdad. Ese es el arreglo al bug de "se mueve sola": antes su
        // propio peso ya lo hacía caer sin nada enganchado.
        label: `piece:${pieceDef.id}:${side}`,
      });
      hook.rgm = {
        role: "piece",
        instanceId: instance.instanceId,
        pieceId: pieceDef.id,
        category: pieceDef.category,
        emitsEvent: pieceDef.emitsEvent,
        footprintUG: pieceDef.footprintUG,
        material: instance.material || pieceDef.defaultMaterial,
        materialKey: instance.material || pieceDef.defaultMaterial,
        breakThreshold: material.breakThreshold,
        configOverrides: instance.paramOverrides || {},
        renderTint: material.renderTint,
        wPx: hookRadiusPx * 2,
        hPx: hookRadiusPx * 2,
        pulleySide: side,
        pulleyWheel: { x: wheelXPx, y: wheelYPx },
      };
      return hook;
    }

    const hookLeft = makeHook(anchorLeft, "left");
    const hookRight = makeHook(anchorRight, "right");

    return {
      bodies: [hookLeft, hookRight],
      constraints: [],
      pulleyMeta: {
        instanceId: instance.instanceId,
        hookLeft,
        hookRight,
        anchorLeft,
        anchorRight,
        wheel: { x: wheelXPx, y: wheelYPx },
        targetTotal: ropeLengthPx,
        hookRadiusPx,
      },
    };
  }

  const TRASH_WALL_THICKNESS_PX = 6;

  /**
   * Tacho de basura: cuerpo compuesto (piso + pared izq. + pared der.,
   * SIN tapa) en vez de una caja sólida. Las tres partes se arman en
   * coordenadas del MUNDO (ya con posición y ángulo aplicados) y después
   * se agrupan en un único Matter.Body — así físicamente es un solo
   * objeto (se puede golpear, empujar y volcar como uno), pero visual y
   * funcionalmente tiene un hueco real donde caen las cosas.
   */
  function createTrashCanBody(instance, pieceDef, material, xPx, yPx, angleRad) {
    const fp = RGM.getFootprint(instance, pieceDef);
    const wPx = ugToPx(fp.w);
    const hPx = ugToPx(fp.h);
    const t = TRASH_WALL_THICKNESS_PX;

    const partOpts = {
      friction: material.friction,
      restitution: material.restitution,
      density: Math.max(material.density * 0.001, 0.0001),
    };

    // Definidas ya en coordenadas del MUNDO (el hueco, sin nada arriba,
    // queda mirando hacia +Y local — es decir "hacia arriba" en la
    // orientación de reposo, que es exactamente donde tiene que estar
    // para que las cosas caigan adentro).
    const floor = Matter.Bodies.rectangle(xPx, yPx + hPx / 2 - t / 2, wPx, t, partOpts);
    const leftWall = Matter.Bodies.rectangle(xPx - wPx / 2 + t / 2, yPx, t, hPx, partOpts);
    const rightWall = Matter.Bodies.rectangle(xPx + wPx / 2 - t / 2, yPx, t, hPx, partOpts);

    const body = Matter.Body.create({
      parts: [floor, leftWall, rightWall],
      friction: material.friction,
      restitution: material.restitution,
      label: `piece:${pieceDef.id}`,
    });
    // Los parts ya se armaron en su posición final en el mundo; recién
    // ahora se rota el conjunto sobre su propio centro de masa real
    // (Matter ya lo calculó solo al agrupar los parts).
    if (angleRad) Matter.Body.setAngle(body, angleRad);

    body.rgm = {
      role: "piece",
      instanceId: instance.instanceId,
      pieceId: pieceDef.id,
      category: pieceDef.category,
      emitsEvent: pieceDef.emitsEvent,
      footprintUG: pieceDef.footprintUG,
      material: instance.material || pieceDef.defaultMaterial,
      materialKey: instance.material || pieceDef.defaultMaterial,
      breakThreshold: material.breakThreshold,
      configOverrides: instance.paramOverrides || {},
      renderTint: material.renderTint,
      isCompoundContainer: true, // el render genérico de polígono no sirve acá (ver drawContainerBody)
    };

    return { bodies: [body], constraints: [] };
  }

  /**
   * Bola/Ratón colocados como PIEZA normal del catálogo (`isMainObject:
   * true`). Ya no existe un "objeto de inicio" especial aparte — esta es
   * la única forma de crear un cuerpo con role:"start", y todo lo que ya
   * reacciona a ese rol (detección de meta, enganche de Polea, cámara
   * que sigue, fin de partida) los trata igual sin código aparte.
   */
  function createMainObjectPieceBody(instance, pieceDef) {
    const material = RGM.Materials.resolve(instance.material || pieceDef.defaultMaterial);
    // Tamaño ajustable (sección "Tamaño" del inspector): si el jugador
    // no lo tocó, usa el tamaño default del catálogo.
    const sizeUG =
      (instance.paramOverrides && instance.paramOverrides.size) || pieceDef.footprintUG.w;
    const r = ugToPx(sizeUG / 2);
    const body = Matter.Bodies.circle(ugToPx(instance.position.x), ugToPx(instance.position.y), r, {
      friction: material.friction + (pieceDef.frictionBoost || 0),
      restitution: material.restitution,
      density: Math.max(material.density * 0.001, 0.0001),
      label: `start:${pieceDef.id}:${instance.instanceId}`,
    });
    body.rgm = {
      role: "start",
      pieceId: pieceDef.id,
      instanceId: instance.instanceId,
      renderTint: "#FF6F00",
      icon: pieceDef.icon,
    };
    return body;
  }

  /**
   * Meta/Queso colocados como PIEZA normal del catálogo (`isEndObject:
   * true`) — mismo criterio que arriba, ya no hay un "objeto final"
   * especial aparte del catálogo.
   */
  function createEndObjectPieceBody(instance, pieceDef) {
    const r = ugToPx(pieceDef.footprintUG.w / 2);
    const body = Matter.Bodies.circle(ugToPx(instance.position.x), ugToPx(instance.position.y), r, {
      isStatic: true,
      isSensor: true,
      label: `end:${pieceDef.id}:${instance.instanceId}`,
    });
    body.rgm = {
      role: "end",
      pieceId: pieceDef.id,
      instanceId: instance.instanceId,
      renderTint: "#2E7D32",
      icon: pieceDef.icon,
    };
    return body;
  }

  /**
   * Dibuja todos los cuerpos del mundo en el canvas, con estética
   * "blueprint" (contornos claros sobre fondo azul) en vez de usar el
   * renderer default de Matter, para controlar el estilo definido en la
   * sección 2 del documento.
   */
  function renderBodies(ctx, bodies) {
    for (const body of bodies) {
      const rgm = body.rgm || {};
      ctx.save();

      if (rgm.isCompoundContainer) {
        drawContainerBody(ctx, body, rgm);
      } else if (body.circleRadius) {
        drawCircleBody(ctx, body, rgm);
      } else {
        drawPolyBody(ctx, body, rgm);
      }

      ctx.restore();
    }
  }

  /**
   * Dibuja cada "parte" del cuerpo compuesto por separado (piso + cada
   * pared), en vez de usar body.vertices general — que en un cuerpo
   * compuesto es el CONTORNO EXTERIOR combinado de todas las partes, y
   * eso rellenaría también el hueco de arriba como si fuera sólido.
   */
  function drawContainerBody(ctx, body, rgm) {
    const parts = body.parts.length > 1 ? body.parts.slice(1) : body.parts;
    for (const part of parts) {
      ctx.beginPath();
      ctx.moveTo(part.vertices[0].x, part.vertices[0].y);
      for (let i = 1; i < part.vertices.length; i++) {
        ctx.lineTo(part.vertices[i].x, part.vertices[i].y);
      }
      ctx.closePath();
      ctx.fillStyle = fillForBody(rgm);
      ctx.fill();
      if (rgm.materialKey) {
        const w = Math.hypot(part.vertices[1].x - part.vertices[0].x, part.vertices[1].y - part.vertices[0].y);
        const h = Math.hypot(part.vertices[2].x - part.vertices[1].x, part.vertices[2].y - part.vertices[1].y);
        RGM.Materials.paintPattern(ctx, rgm.materialKey, w, h);
      }
      ctx.strokeStyle = "rgba(0,0,0,0.25)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  function fillForBody(rgm) {
    if (rgm.role === "start") return rgm.renderTint;
    if (rgm.role === "end") return "transparent";
    const cat = RGM.PieceCategories[rgm.category];
    return rgm.renderTint || (cat ? cat.hex : "#888");
  }

  function drawCircleBody(ctx, body, rgm) {
    if (rgm.pieceId === "pulley_01" && rgm.pulleyWheel) {
      drawPulleyRopeAndWheel(ctx, body, rgm);
    }

    const { x, y } = body.position;
    ctx.translate(x, y);
    ctx.rotate(body.angle);

    if (rgm.role === "end") {
      drawEndMarker(ctx, rgm, body.circleRadius);
      return;
    }

    if (rgm.role === "start") {
      drawStartMarker(ctx, rgm, body.circleRadius);
      return;
    }

    if (rgm.pieceId === "sensor_01") {
      ctx.strokeStyle = "#AB47BC";
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.85;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(0, 0, body.circleRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      return;
    }

    ctx.beginPath();
    ctx.arc(0, 0, body.circleRadius, 0, Math.PI * 2);
    ctx.fillStyle = fillForBody(rgm);
    ctx.fill();
    if (rgm.materialKey) {
      RGM.Materials.paintPattern(ctx, rgm.materialKey, body.circleRadius * 2, body.circleRadius * 2);
    }
    if (rgm.pieceId !== "pulley_01") {
      // marca de rotación (no aporta nada en el gancho de la polea, que
      // no gira sobre sí mismo de forma relevante)
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(body.circleRadius, 0);
      ctx.stroke();
    }
  }

  function drawPulleyRopeAndWheel(ctx, body, rgm) {
    const w = rgm.pulleyWheel;
    ctx.save();
    ctx.strokeStyle = "#B0BEC5";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(w.x, w.y);
    ctx.lineTo(body.position.x, body.position.y);
    ctx.stroke();
    // la rueda se dibuja una sola vez (si no, quedaría duplicada: un
    // gancho a cada lado dispara este mismo dibujo)
    if (rgm.pulleySide === "left") {
      ctx.fillStyle = "#607D8B";
      ctx.beginPath();
      ctx.arc(w.x, w.y, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#37474F";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawStartMarker(ctx, rgm, r) {
    ctx.fillStyle = rgm.renderTint;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    if (rgm.icon) {
      ctx.font = `${Math.round(r * 1.6)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(rgm.icon, 0, 0);
    }
  }

  function drawEndMarker(ctx, rgm, r) {
    ctx.strokeStyle = "#2E7D32";
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    if (rgm.icon) {
      ctx.font = `${Math.round(r * 1.6)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(rgm.icon, 0, 0);
    } else {
      ctx.fillStyle = "#2E7D32";
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPolyBody(ctx, body, rgm) {
    const vertices = body.vertices;
    ctx.beginPath();
    ctx.moveTo(vertices[0].x, vertices[0].y);
    for (let i = 1; i < vertices.length; i++) {
      ctx.lineTo(vertices[i].x, vertices[i].y);
    }
    ctx.closePath();

    if (rgm.pieceId === "button_01") {
      ctx.fillStyle = body.rgm.pressed ? "#7B1FA2" : fillForBody(rgm);
    } else {
      ctx.fillStyle = fillForBody(rgm);
    }

    if (rgm.pieceId === "sensor_01") {
      ctx.globalAlpha = 0.4;
    }

    ctx.fill();

    // Textura de material: se dibuja en espacio LOCAL (centrado en el
    // cuerpo), así que se pinta con un path centrado, no con los
    // vértices absolutos ya rotados.
    if (rgm.materialKey && rgm.wPx && rgm.hPx) {
      ctx.save();
      ctx.translate(body.position.x, body.position.y);
      ctx.rotate(body.angle);
      ctx.beginPath();
      ctx.rect(-rgm.wPx / 2, -rgm.hPx / 2, rgm.wPx, rgm.hPx);
      RGM.Materials.paintPattern(ctx, rgm.materialKey, rgm.wPx, rgm.hPx);
      ctx.restore();
    }

    if (body.isStatic) {
      ctx.strokeStyle = "rgba(0,0,0,0.25)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    if (rgm.pieceId === "lever_01") {
      ctx.fillStyle = "#E0E0E0";
      ctx.beginPath();
      ctx.arc(body.position.x, body.position.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  return {
    createEngine,
    ugToPx,
    createPieceBody,
    createMainObjectPieceBody,
    createEndObjectPieceBody,
    renderBodies,
    drawStartMarker,
    drawEndMarker,
  };
})();

/* ===== logic.js ===== */
/* =========================================================================
   LOGIC — sección 10 (sistema de lógica / visual scripting) y las
   colisiones que disparan los `emitsEvent` de cada pieza (sección 6.2).

   Alcance de esta iteración: implementamos el MOTOR de eventos y wiring
   (LogicNode, sección 10.1) completo y funcional, pero sin el editor
   visual de nodos por arrastre (eso es UI pura) — los logicNodes de un
   Design se escriben en su JSON. El motor sí corre las reglas
   SI/ENTONCES reales sobre la simulación.
   ========================================================================= */

window.RGM = RGM;

// --- Bus de eventos simple (pub/sub) ---
RGM.Events = (() => {
  const listeners = {};
  return {
    on(event, cb) {
      (listeners[event] = listeners[event] || []).push(cb);
    },
    off(event, cb) {
      if (!listeners[event]) return;
      listeners[event] = listeners[event].filter((f) => f !== cb);
    },
    emit(event, payload) {
      (listeners[event] || []).forEach((cb) => cb(payload));
    },
    clear() {
      Object.keys(listeners).forEach((k) => delete listeners[k]);
    },
  };
})();

RGM.Logic = (() => {
  const IMPULSE_COOLDOWN_MS = 400;
  const ICE_BOOST_COOLDOWN_MS = 350;
  const ICE_BOOST_FACTOR = 1.18; // +18% de velocidad al primer contacto con hielo
  const LEVER_MAX_ANGLE = 0.61; // ~35°: tope mecánico de la palanca
  const LEVER_ACTIVATION_ANGLE = 0.26; // ~15° en radianes
  const ROTATION_DURATION_STEPS = 42; // ~0.7s de giro visible, no instantáneo

  let engine = null;
  let design = null;
  let bodiesByInstanceId = new Map();
  // Reloj de SIMULACIÓN (ms): avanza 1/60 s por paso físico. Los cooldowns lo
  // usan en vez del reloj real, para que el resultado no dependa de los FPS.
  let simClockMs = 0;
  function simNow() { return simClockMs; }
  let lastImpulseAt = new Map();
  let leverActivated = new Set();
  let triggerLatched = new Set(); // Botón/Sensor ya disparados (disparan UNA sola vez por simulación)
  let canFrames = new Map(); // "instanceId:bodyId" -> cuadros seguidos adentro del tacho
  let canFired = new Set();
  let activeRotations = new Map(); // bodyId -> { body, startAngle, endAngle, elapsedSteps }
  let pulleySystems = []; // [{ instanceId, hookLeft, hookRight, anchorLeft, anchorRight, targetTotal }]
  let hookAttachment = new Map(); // hookBody.id -> { constraint, bodyId }
  let attachedFromHook = new Map(); // bodyId -> hookBody.id (a qué gancho está pegado, si a alguno)
  let hookById = new Map(); // hookBody.id -> hookBody (para poder buscarlo por id)
  let reattachCooldown = new Map(); // "bodyId:hookId" -> timestamp hasta el que no puede re-engancharse ahí
  let onGoalReachedCb = null;

  const PULLEY_REATTACH_COOLDOWN_MS = 500;

  function install(matterEngine, currentDesign, bodyIndex, pulleySystemsList, callbacks) {
    engine = matterEngine;
    design = currentDesign;
    bodiesByInstanceId = bodyIndex; // Map<instanceId, Matter.Body>
    simClockMs = 0;
    lastImpulseAt = new Map();
    leverActivated = new Set();
    triggerLatched = new Set();
    canFrames = new Map();
    canFired = new Set();
    activeRotations = new Map();
    pulleySystems = pulleySystemsList || [];

    hookAttachment = new Map();
    attachedFromHook = new Map();
    hookById = new Map();
    reattachCooldown = new Map();
    for (const sys of pulleySystems) {
      hookById.set(sys.hookLeft.id, sys.hookLeft);
      hookById.set(sys.hookRight.id, sys.hookRight);
    }

    onGoalReachedCb = callbacks.onGoalReached;

    Matter.Events.on(engine, "collisionStart", handleCollisionStart);
    Matter.Events.on(engine, "collisionEnd", handleCollisionEnd);
    Matter.Events.on(engine, "afterUpdate", handleAfterUpdate);
  }

  function uninstall() {
    if (!engine) return;
    Matter.Events.off(engine, "collisionStart", handleCollisionStart);
    Matter.Events.off(engine, "collisionEnd", handleCollisionEnd);
    Matter.Events.off(engine, "afterUpdate", handleAfterUpdate);
    engine = null;
  }

  function handleCollisionStart(event) {
    for (const pair of event.pairs) {
      checkPair(pair.bodyA, pair.bodyB, true);
      checkPair(pair.bodyB, pair.bodyA, true);
      handlePulleyContact(pair.bodyA, pair.bodyB);
      handlePulleyContact(pair.bodyB, pair.bodyA);
    }
  }

  function handleCollisionEnd(event) {
    for (const pair of event.pairs) {
      checkPair(pair.bodyA, pair.bodyB, false);
      checkPair(pair.bodyB, pair.bodyA, false);
    }
  }

  function isHookBody(body) {
    return !!(body.rgm && body.rgm.pieceId === "pulley_01");
  }

  /**
   * Enganche/desenganche en vivo (sección pedida explícitamente): CUALQUIER
   * cosa que toque un gancho se pega ahí (mientras el gancho esté libre),
   * y lo que esté enganchado se suelta apenas toca otra cosa que no sea
   * su propio gancho.
   */
  function handlePulleyContact(a, b) {
    if (!a.rgm) return;

    if (isHookBody(a) && !isHookBody(b) && !b.isStatic) {
      tryAttachToHook(a, b);
    }

    maybeReleaseFromHook(a, b);
  }

  function tryAttachToHook(hook, body) {
    if (attachedFromHook.has(body.id)) return; // ya está enganchado en algún lado
    if (hookAttachment.has(hook.id)) return; // este gancho ya tiene algo

    const cdKey = body.id + ":" + hook.id;
    if (simNow() < (reattachCooldown.get(cdKey) || 0)) return;

    const gap =
      Matter.Vector.magnitude(Matter.Vector.sub(body.position, hook.position)) ||
      hook.circleRadius + (body.circleRadius || 15);
    const constraint = Matter.Constraint.create({
      bodyA: hook,
      bodyB: body,
      length: gap,
      stiffness: 1,
      label: "pulley-runtime-attach",
    });
    Matter.World.add(engine.world, constraint);
    hookAttachment.set(hook.id, { constraint, bodyId: body.id, body });
    attachedFromHook.set(body.id, hook.id);
  }

  function maybeReleaseFromHook(body, other) {
    const hookId = attachedFromHook.get(body.id);
    if (hookId === undefined) return;
    if (isHookBody(other) && other.id === hookId) return; // sigue tocando SU PROPIO gancho, no cuenta

    const info = hookAttachment.get(hookId);
    if (info) {
      Matter.World.remove(engine.world, info.constraint);
      hookAttachment.delete(hookId);
    }
    attachedFromHook.delete(body.id);
    reattachCooldown.set(body.id + ":" + hookId, simNow() + PULLEY_REATTACH_COOLDOWN_MS);
  }

  /**

   * a = cuerpo "pieza"/"end", b = el otro cuerpo involucrado en la colisión.
   */
  function checkPair(a, b, isStart) {
    if (!a.rgm) return;

    // --- Meta alcanzada (sección 7.2 "Meta") ---
    if (isStart && a.rgm.role === "end" && b.rgm && b.rgm.role === "start") {
      onGoalReachedCb && onGoalReachedCb();
      return;
    }

    if (a.rgm.role !== "piece") return;

    // --- Sensor (isTrigger, emitsEvent onSensorActivated) ---
    if (a.rgm.pieceId === "sensor_01" && isStart) {
      fireEvent("onSensorActivated", a.rgm.instanceId);
    }

    // --- Botón (isTrigger, presión visual + emitsEvent) ---
    if (a.rgm.pieceId === "button_01") {
      a.rgm.pressed = isStart;
      if (isStart) fireEvent("onButtonPressed", a.rgm.instanceId);
    }

    // --- Resorte: aplica impulso al contacto (con cooldown para no
    // "ametrallar" el mismo cuerpo con impulsos cada micro-paso físico).
    // Antes esto usaba applyForce() una sola vez, lo cual en Matter.js
    // es una fuerza que dura UN solo paso de física — el efecto era tan
    // chico que parecía que el resorte "no hacía nada". Ahora se le
    // asigna directamente una velocidad vertical, como un lanzamiento
    // real de resorte. ---
    if (a.rgm.pieceId === "spring_01" && isStart && b && !b.isStatic) {
      const now = simNow();
      const key = a.id + ":" + b.id;
      const last = lastImpulseAt.get(key) || 0;
      if (now - last > IMPULSE_COOLDOWN_MS) {
        lastImpulseAt.set(key, now);
        const forceParam =
          (a.rgm.configOverrides && a.rgm.configOverrides.force) ?? 45;
        // Escala práctica: 'force' del schema (10-100 N) -> velocidad de
        // lanzamiento. Rango amplio a propósito para que se note la
        // diferencia entre un resorte débil y uno fuerte.
        const launchSpeed = 8 + (forceParam / 100) * 32;
        Matter.Body.setVelocity(b, {
          x: b.velocity.x,
          y: -launchSpeed,
        });
        fireEvent("onImpulseTriggered", a.rgm.instanceId);
      }
    }

    // --- Hielo: además de la fricción casi nula (ya de por sí lo hace
    // resbalar más), le da un empujón de velocidad real al primer
    // contacto — para que se note que "agarra más velocidad" y no solo
    // "frena menos". Con cooldown para no acelerar sin límite mientras
    // se desliza pegado a una superficie helada larga. ---
    if (
      a.rgm.role === "piece" &&
      a.rgm.materialKey === "hielo" &&
      isStart &&
      b &&
      !b.isStatic
    ) {
      const now = simNow();
      const key = a.id + ":" + b.id + ":hielo";
      const last = lastImpulseAt.get(key) || 0;
      if (now - last > ICE_BOOST_COOLDOWN_MS) {
        lastImpulseAt.set(key, now);
        const speed = Matter.Vector.magnitude(b.velocity);
        if (speed > 0.3) {
          const boosted = Matter.Vector.mult(Matter.Vector.normalise(b.velocity), speed * ICE_BOOST_FACTOR);
          Matter.Body.setVelocity(b, boosted);
        }
      }
    }

    // La Polea ya no se maneja acá: el enganche/desenganche por contacto
    // vive en handlePulleyContact, y el acople de los dos lados en
    // updatePulleyCoupling — ambos abajo. Acá ya no hace falta nada para
    // ella.
  }

  const PULLEY_MASS_EPSILON = 0.02; // diferencia de masa mínima para considerar "un lado más pesado"
  const PULLEY_SPEED_PX = 3.2; // velocidad de desplazamiento por paso de física

  /**
   * Acople izquierda<->derecha de cada Polea, por PESO REAL (no por
   * velocidad): cada Polea guarda su propio estado persistente
   * (sys.dLeft = cuánta cuerda está del lado izquierdo ahora mismo).
   *
   *   - Se compara la masa real de lo enganchado en cada gancho
   *     (0 si no hay nada).
   *   - El lado más pesado gana y avanza hacia su límite (targetTotal);
   *     el otro cede lo mismo que el primero avanza (dRight = total -
   *     dLeft), así que SIEMPRE están perfectamente acoplados, sin
   *     necesidad de "corregir" nada por separado.
   *   - Si ya llegó al límite (dLeft === targetTotal o 0), se queda ahí
   *     quieta — solo vuelve a moverse si la comparación de masas se
   *     invierte (el otro lado recibe algo más pesado).
   *   - Si pesan igual (los dos vacíos, o el mismo peso de cada lado),
   *     no se mueve: se queda exactamente donde estaba.
   */
  function updatePulleyCoupling() {
    for (const sys of pulleySystems) {
      if (sys.dLeft === undefined) sys.dLeft = sys.targetTotal / 2;

      const leftInfo = hookAttachment.get(sys.hookLeft.id);
      const rightInfo = hookAttachment.get(sys.hookRight.id);
      const leftMass = leftInfo ? leftInfo.body.mass : 0;
      const rightMass = rightInfo ? rightInfo.body.mass : 0;
      const massDiff = leftMass - rightMass;

      if (massDiff > PULLEY_MASS_EPSILON) {
        sys.dLeft = Math.min(sys.targetTotal, sys.dLeft + PULLEY_SPEED_PX);
      } else if (massDiff < -PULLEY_MASS_EPSILON) {
        sys.dLeft = Math.max(0, sys.dLeft - PULLEY_SPEED_PX);
      }
      // si pesan igual (incluido 0 y 0), sys.dLeft no cambia: queda fija

      const dRight = sys.targetTotal - sys.dLeft;
      Matter.Body.setPosition(sys.hookLeft, { x: sys.anchorLeft.x, y: sys.anchorLeft.y + sys.dLeft });
      Matter.Body.setPosition(sys.hookRight, { x: sys.anchorRight.x, y: sys.anchorRight.y + dRight });
      Matter.Body.setVelocity(sys.hookLeft, { x: 0, y: 0 });
      Matter.Body.setVelocity(sys.hookRight, { x: 0, y: 0 });
    }
  }


  /**
   * Tacho de basura como DETECTOR: emite onBallCaught cuando algo (bola,
   * ratón, etc.) queda adentro de su hueco unos cuadros seguidos. Así el
   * tacho puede "atrapar" una bola y disparar una compuerta (pedido:
   * que cada pieza tenga una función real dentro de la máquina).
   */
  const CAN_CATCH_FRAMES = 15;
  function checkCans() {
    for (const [instanceId, can] of bodiesByInstanceId.entries()) {
      if (!can.rgm || can.rgm.pieceId !== "trash_can_01" || canFired.has(instanceId)) continue;
      if (!can.parts || can.parts.length < 4) continue;
      const floorPart = can.parts[1];
      const leftWall = can.parts[2];
      const rightWall = can.parts[3];
      const left = leftWall.bounds.max.x;
      const right = rightWall.bounds.min.x;
      const rim = Math.min(leftWall.bounds.min.y, rightWall.bounds.min.y);
      const bottom = floorPart.bounds.min.y;
      for (const b of Matter.Composite.allBodies(engine.world)) {
        if (b === can || b.isStatic || b.isSensor) continue;
        if (b.rgm && (b.rgm.pieceId === "pulley_01" || b.rgm.isCompoundContainer)) continue;
        const key = instanceId + ":" + b.id;
        const p = b.position;
        if (p.x > left && p.x < right && p.y > rim && p.y < bottom) {
          const n = (canFrames.get(key) || 0) + 1;
          canFrames.set(key, n);
          if (n >= CAN_CATCH_FRAMES) {
            canFired.add(instanceId);
            fireEvent("onBallCaught", instanceId);
            break;
          }
        } else if (canFrames.has(key)) {
          canFrames.delete(key);
        }
      }
    }
  }

  function handleAfterUpdate() {
    simClockMs += 1000 / 60;
    // --- Palanca: emite onLeverActivated la primera vez que bascula
    // más allá del umbral de activación ---
    for (const [instanceId, body] of bodiesByInstanceId.entries()) {
      if (!body.rgm || body.rgm.pieceId !== "lever_01") continue;
      // Topes de la palanca (como un sube y baja de verdad): no puede
      // pasar de ~35° para ningún lado, así no da vueltas completas.
      if (Math.abs(body.angle) > LEVER_MAX_ANGLE) {
        Matter.Body.setAngle(body, Math.sign(body.angle) * LEVER_MAX_ANGLE);
        Matter.Body.setAngularVelocity(body, 0);
      }
      if (Math.abs(body.angle) > LEVER_ACTIVATION_ANGLE && !leverActivated.has(instanceId)) {
        leverActivated.add(instanceId);
        fireEvent("onLeverActivated", instanceId);
      }
    }

    checkCans();
    advanceActiveRotations();
    updatePulleyCoupling();
  }
  /**
   * Avanza, un paso de física a la vez, cada rotación 180° disparada por
   * un Botón/Sensor. Antes esto era un único Matter.Body.rotate()
   * instantáneo: técnicamente "pasaba", pero en un solo cuadro — para el
   * ojo humano era indistinguible de que no pasara nada. Ahora interpola
   * el ángulo a lo largo de ROTATION_DURATION_STEPS pasos, así se ve
   * girar la pieza en cámara lenta durante el recorrido, como se pidió.
   */
  function advanceActiveRotations() {
    for (const [bodyId, rot] of activeRotations.entries()) {
      rot.elapsedSteps += 1;
      const t = Math.min(1, rot.elapsedSteps / ROTATION_DURATION_STEPS);
      // easing suave (ease-in-out) en vez de velocidad lineal constante,
      // para que arranque y frene con naturalidad
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const angle = rot.startAngle + (rot.endAngle - rot.startAngle) * eased;
      Matter.Body.setAngle(rot.body, angle);
      const rg = rot.body.rgm;
      if (rg && rg.centroidLocal && rg.rectCenter) {
        // las cuñas giran alrededor del centro de su rectángulo, no de su centroide
        const c = Math.cos(angle);
        const sn = Math.sin(angle);
        Matter.Body.setPosition(rot.body, {
          x: rg.rectCenter.x + rg.centroidLocal.x * c - rg.centroidLocal.y * sn,
          y: rg.rectCenter.y + rg.centroidLocal.x * sn + rg.centroidLocal.y * c,
        });
      }
      if (t >= 1) activeRotations.delete(bodyId);
    }
  }

  /**
   * Arranca el giro animado de 180° de una pieza, desde su ángulo actual
   * (si ya estaba girando, se reinicia desde donde esté en ese momento
   * — más simple y predecible que intentar "sumar" giros en el aire).
   */
  function startRotation180(body, direction) {
    activeRotations.set(body.id, {
      body,
      startAngle: body.angle,
      endAngle: body.angle + Math.PI * direction,
      elapsedSteps: 0,
    });
  }

  /**
   * Evalúa los LogicNode del Design activo (sección 10.1) que escuchan
   * `eventName` desde `sourceInstanceId`, y ejecuta su acción.
   */
  function fireEvent(eventName, sourceInstanceId) {
    // Botón y Sensor son de UN SOLO USO por simulación: así un rebote o un
    // roce doble (la bola vuelve a tocarlos, o los toca otra pieza) no
    // deshace la rotación que ya hicieron.
    if (eventName === "onButtonPressed" || eventName === "onSensorActivated") {
      if (triggerLatched.has(sourceInstanceId)) return;
      triggerLatched.add(sourceInstanceId);
    }
    RGM.Events.emit("piece:" + eventName, { sourceInstanceId, eventName });

    const nodes = (design.logicNodes || []).filter(
      (n) =>
        n.condition &&
        n.condition.event === eventName &&
        n.sourcePieceId === sourceInstanceId
    );

    for (const node of nodes) {
      runAction(node.action);
    }
  }

  function runAction(action) {
    if (!action) return;
    const targetBody = bodiesByInstanceId.get(action.targetPieceId);
    if (!targetBody) return;

    switch (action.command) {
      case "open":
        // Efecto genérico: la pieza deja de bloquear el paso (se vuelve
        // sensor), simulando una "puerta" abriéndose.
        targetBody.isSensor = true;
        targetBody.rgm.opened = true;
        break;
      case "close":
        targetBody.isSensor = false;
        targetBody.rgm.opened = false;
        break;
      case "powerOn":
        targetBody.rgm.poweredOn = true;
        break;
      case "powerOff":
        targetBody.rgm.poweredOn = false;
        break;
      case "rotate180cw":
      case "rotate180ccw":
        // Pedido explícito: el Botón rota las piezas vinculadas 180° a
        // la derecha, el Sensor 180° a la izquierda — DE FORMA VISIBLE Y
        // GRADUAL durante el recorrido (no de un salto instantáneo, que
        // en un solo cuadro de física es imperceptible para el ojo).
        // Una rotación de exactamente 180° es visualmente idéntica en un
        // rectángulo simétrico (por eso la Rampa ahora es una cuña
        // triangular, ver physicsEngine.js: en piezas asimétricas como
        // esa, este giro sí cambia el recorrido de la pelota).
        startRotation180(targetBody, action.command === "rotate180cw" ? 1 : -1);
        break;
      default:
        console.warn("Comando de LogicNode desconocido:", action.command);
    }

    RGM.Events.emit("logic:actionRan", action);
  }

  return { install, uninstall };
})();

/* ===== tornillin.js ===== */
/* =========================================================================
   TORNILLÍN — sección 18. Árbol de reglas determinístico (sin IA
   generativa), máximo un mensaje cada 8 segundos.

   Implementadas de la tabla del documento:
     - physics:objectStuck              -> sí
     - Validación 12.3 falla (sin camino) -> sí (reutiliza el warning de
       validation.js en vez de tener su propia detección duplicada)
     - Jugador inactivo >30s sin colocar piezas -> sí
     - Simulación exitosa               -> sí
     - physics:insufficientVelocity     -> NO implementada esta iteración
       (requiere modelar "velocidad mínima esperada" por tipo de rampa,
       que no está definido numéricamente en el documento; se deja el
       evento nombrado acá como TODO para cuando se agregue esa fórmula).
   ========================================================================= */

window.RGM = RGM;

RGM.Tornillin = (() => {
  const MIN_MS_BETWEEN_MESSAGES = 8000;
  const STUCK_THRESHOLD_MS = 2000;
  const STUCK_VELOCITY_EPSILON = 0.05;
  const INACTIVITY_THRESHOLD_MS = 30000;

  let lastMessageAt = 0;
  let bubbleEl = null;
  let stuckSince = null;
  let lastPieceCountAtActivity = 0;
  let lastActivityAt = Date.now();
  let inactivityWarned = false;

  const TIPS = [
    "Probá rotar las rampas con Q y E antes de soltarlas.",
    "Los materiales cambian cómo rebotan y resbalan las piezas — probá con Goma o Hielo.",
    "Podés arrastrar piezas desde el panel derecho directo al plano.",
    "Click derecho sobre una pieza para ver más opciones.",
  ];

  function init(bubbleElement) {
    bubbleEl = bubbleElement;
  }

  function say(message, emoji = "🔧") {
    const now = Date.now();
    if (now - lastMessageAt < MIN_MS_BETWEEN_MESSAGES) return;
    lastMessageAt = now;
    if (!bubbleEl) return;
    bubbleEl.querySelector(".avatar").textContent = emoji;
    bubbleEl.querySelector(".text").textContent = message;
    bubbleEl.classList.add("visible");
    clearTimeout(bubbleEl._hideTimer);
    bubbleEl._hideTimer = setTimeout(() => {
      bubbleEl.classList.remove("visible");
    }, 6000);
  }

  // --- physics:objectStuck ---
  function checkStuck(velocityMagnitude, hasWon) {
    if (hasWon) {
      stuckSince = null;
      return;
    }
    if (velocityMagnitude < STUCK_VELOCITY_EPSILON) {
      if (stuckSince === null) stuckSince = Date.now();
      else if (Date.now() - stuckSince > STUCK_THRESHOLD_MS) {
        say("Tu mecanismo parece estar bloqueado.", "😟");
        stuckSince = Date.now(); // evita re-disparar en loop apretado
      }
    } else {
      stuckSince = null;
    }
  }

  // --- Validación 12.3 (sin camino detectado) ---
  function onValidationWarnings(warnings) {
    const hasPathWarning = warnings.some((w) => w.includes("cadena continua"));
    if (hasPathWarning) {
      say("Quizás necesites un resorte o una rampa más para llegar a la meta.", "🤔");
    }
  }

  // --- Simulación exitosa ---
  function onSuccess() {
    say("¡Excelente máquina! Lo lograste.", "🎉");
  }

  // --- Inactividad >30s sin colocar piezas ---
  function notifyPiecePlaced(currentPieceCount) {
    lastPieceCountAtActivity = currentPieceCount;
    lastActivityAt = Date.now();
    inactivityWarned = false;
  }

  function tickInactivity(currentPieceCount) {
    if (currentPieceCount !== lastPieceCountAtActivity) {
      lastActivityAt = Date.now();
      lastPieceCountAtActivity = currentPieceCount;
      inactivityWarned = false;
      return;
    }
    if (!inactivityWarned && Date.now() - lastActivityAt > INACTIVITY_THRESHOLD_MS) {
      inactivityWarned = true;
      const tip = TIPS[Math.floor(Math.random() * TIPS.length)];
      say(tip, "💡");
    }
  }

  function resetForNewSimulation() {
    stuckSince = null;
  }

  return {
    init,
    say,
    checkStuck,
    onValidationWarnings,
    onSuccess,
    notifyPiecePlaced,
    tickInactivity,
    resetForNewSimulation,
  };
})();

/* ===== simulation.js ===== */
/* =========================================================================
   SIMULATION — máquina de estados de la sección 11.

   IDLE (editor) -> VALIDATING -> [BLOCKED | RUNNING] -> PAUSED <-> RUNNING
                                                        -> SUCCESS | FAILURE

   Controles implementados de la sección 11.2:
     - Pausar / Reanudar         -> sí
     - Reiniciar                 -> sí
     - Cámara lenta (0.5x)       -> sí
     - Avance por pasos (frame a frame) -> sí (solo mientras está en pausa)
     - Guardar reintento en historial -> NO implementado esta iteración
       (requiere el sistema de perfil/estadísticas del jugador, fuera de
       alcance; el hook queda marcado con TODO en onSimulationEnd).
   ========================================================================= */

window.RGM = RGM;

RGM.Simulation = (() => {
  const C = RGM.Constants;

  let engine = null;
  let runner = null;
  let state = C.SIM_STATE.IDLE;
  let speedMultiplier = 1.0;
  let stepOnce = false;
  let elapsedSimMs = 0;
  let bodyIndex = new Map(); // instanceId -> Matter.Body
  let allBodies = [];
  let mainBodies = []; // objetos "principales" activos (Inicio real + Bola/Ratón puestos como pieza)
  let onStateChange = null;
  let currentTimeoutMs = 0; // límite propio del diseño (0 = usar el global)
  let onFrame = null;

  function getState() {
    return state;
  }

  /**
   * Arma el mundo físico a partir de un Design válido y lo deja listo
   * para correr step a step.
   */
  function build(design, callbacks) {
    onStateChange = callbacks.onStateChange || (() => {});
    onFrame = callbacks.onFrame || (() => {});

    engine = RGM.PhysicsEngine.createEngine();
    bodyIndex = new Map();
    allBodies = [];
    mainBodies = [];
    elapsedSimMs = 0;
    currentTimeoutMs = design.timeoutMs || 0;
    speedMultiplier = 1.0;

    // Piezas colocadas. Ya no hay un "objeto de inicio" ni "objeto
    // final" aparte: Bola/Ratón (isMainObject) y Meta/Queso (isEndObject)
    // son piezas normales del catálogo que el jugador coloca — se
    // reconocen acá mismo, en el mismo recorrido que el resto.
    const pulleySystems = [];
    for (const inst of design.pieces) {
      const def = RGM.getPieceDef(inst.pieceId);
      if (!def) continue;

      if (def.isMainObject) {
        const mainBody = RGM.PhysicsEngine.createMainObjectPieceBody(inst, def);
        Matter.World.add(engine.world, mainBody);
        allBodies.push(mainBody);
        mainBodies.push(mainBody);
        bodyIndex.set(inst.instanceId, mainBody);
        continue;
      }

      if (def.isEndObject) {
        const endBody = RGM.PhysicsEngine.createEndObjectPieceBody(inst, def);
        Matter.World.add(engine.world, endBody);
        allBodies.push(endBody);
        bodyIndex.set(inst.instanceId, endBody);
        continue;
      }

      const result = RGM.PhysicsEngine.createPieceBody(inst, def);
      for (const b of result.bodies) {
        Matter.World.add(engine.world, b);
        allBodies.push(b);
        bodyIndex.set(inst.instanceId, b);
      }
      for (const c of result.constraints) {
        Matter.World.add(engine.world, c);
      }
      if (result.pulleyMeta) {
        pulleySystems.push(result.pulleyMeta);
      }
    }

    // Bordes del plano jugable (para no perseguir objetos al infinito)
    addPlayfieldBounds(design);

    // El enganche a los ganchos de la Polea ya NO se pre-arma acá: ahora
    // es en vivo, cuando algo los toca durante la simulación (ver
    // logic.js — handlePulleyContact). No hace falta nada más acá.

    RGM.Logic.install(engine, design, bodyIndex, pulleySystems, {
      onGoalReached: () => setState(C.SIM_STATE.SUCCESS),
    });

    setState(C.SIM_STATE.RUNNING);
  }


  function addPlayfieldBounds(design) {
    const wPx = RGM.PhysicsEngine.ugToPx(C.PLAYFIELD_UG_W);
    const hPx = RGM.PhysicsEngine.ugToPx(C.PLAYFIELD_UG_H);
    const thickness = 40;
    const floor = Matter.Bodies.rectangle(wPx / 2, hPx + thickness / 2, wPx * 2, thickness, {
      isStatic: true,
      label: "bounds:floor",
    });
    // El piso de límites es un poco más abajo del plano visible: si un
    // objeto llega hasta acá, es indudablemente un fallo (se "cayó del
    // mundo"), no una plataforma legítima del diseño.
    floor.position.y = hPx + 300;
    Matter.World.add(engine.world, floor);
    allBodies.push(floor);
  }

  function setState(next) {
    state = next;
    onStateChange(state);
  }

  function pause() {
    if (state === C.SIM_STATE.RUNNING) setState(C.SIM_STATE.PAUSED);
  }

  function resume() {
    if (state === C.SIM_STATE.PAUSED) setState(C.SIM_STATE.RUNNING);
  }

  function togglePause() {
    if (state === C.SIM_STATE.RUNNING) pause();
    else if (state === C.SIM_STATE.PAUSED) resume();
  }

  function setSlowMotion(enabled) {
    speedMultiplier = enabled ? 0.5 : 1.0;
  }

  function requestStep() {
    if (state === C.SIM_STATE.PAUSED) stepOnce = true;
  }

  function stop() {
    if (engine) {
      RGM.Logic.uninstall();
      Matter.World.clear(engine.world, false);
      Matter.Engine.clear(engine);
    }
    engine = null;
    allBodies = [];
    mainBodies = [];
    bodyIndex = new Map();
    setState(C.SIM_STATE.IDLE);
  }

  /**
   * Debe llamarse una vez por frame de render (requestAnimationFrame).
   * dtMs: milisegundos reales transcurridos desde el frame anterior.
   */
  function tick(dtMs) {
    if (!engine) return;

    const shouldStep =
      state === C.SIM_STATE.RUNNING || (state === C.SIM_STATE.PAUSED && stepOnce);

    if (shouldStep) {
      // Timestep fijo (mismo principio que discutimos en el prototipo
      // Python): siempre avanzamos en pasos de C.PHYSICS.timestep,
      // multiplicados por el multiplicador de velocidad (cámara lenta),
      // nunca directamente por dtMs.
      const fixedStepMs = C.PHYSICS.timestep * 1000 * speedMultiplier;
      Matter.Engine.update(engine, fixedStepMs);
      elapsedSimMs += fixedStepMs;
      stepOnce = false;

      checkFailureConditions();
    }

    onFrame(allBodies, state);
  }

  /**
   * A diferencia de antes (un solo objeto de inicio, cuya caída
   * significaba perder directo), ahora puede haber varios objetos
   * "principales" a la vez. Si UNO se cae del mapa, se lo saca de juego
   * sin más — el resto sigue corriendo con normalidad ("el juego sigue"
   * mientras quede al menos uno). Recién es FALLO cuando ya no queda
   * NINGUNO, o si se agota el tiempo límite general igualmente.
   */
  function checkFailureConditions() {
    if (state !== C.SIM_STATE.RUNNING) return;

    if (elapsedSimMs > (currentTimeoutMs || C.FAILURE_TIMEOUT_MS)) {
      setState(C.SIM_STATE.FAILURE);
      return;
    }

    const outOfBoundsY = RGM.PhysicsEngine.ugToPx(C.PLAYFIELD_UG_H) + 250;
    for (let i = mainBodies.length - 1; i >= 0; i--) {
      const body = mainBodies[i];
      if (body.position.y > outOfBoundsY) {
        Matter.World.remove(engine.world, body);
        const idx = allBodies.indexOf(body);
        if (idx !== -1) allBodies.splice(idx, 1);
        mainBodies.splice(i, 1);
      }
    }

    if (mainBodies.length === 0) {
      setState(C.SIM_STATE.FAILURE);
      return;
    }

    const maxV = mainBodies.reduce(
      (max, b) => Math.max(max, Matter.Vector.magnitude(b.velocity)),
      0
    );
    RGM.Tornillin.checkStuck(maxV, false);
  }

  function getStartBodyVelocity() {
    return mainBodies.reduce((max, b) => Math.max(max, Matter.Vector.magnitude(b.velocity)), 0);
  }

  return {
    getState,
    build,
    pause,
    resume,
    togglePause,
    setSlowMotion,
    requestStep,
    stop,
    tick,
    getStartBodyVelocity,
  };
})();

/* ===== levels.js ===== */
/* =========================================================================
   LEVELS — niveles armados (desafíos) que el jugador puede ver, probar y
   REPLICAR (Modo Reconstruir, GDD 4.6 / 4.7 / 13.3 / 15.1 / 17.4).

   Cada nivel trae una máquina completa (un Design normal, schema 13.2)
   que se sabe que funciona (se verifica en simulación headless antes de
   entregar). Con eso se pueden hacer dos cosas:
     - "Ver y probar": se abre una COPIA en el editor libre para jugar,
       modificar o guardar con otro nombre.
     - "Reconstruir": se muestra la máquina unos segundos, se oculta, y
       el jugador la rearma de memoria con las mismas piezas.

   Progreso (estrellas) en localStorage, clave rgm_progress_v1.
   ========================================================================= */

window.RGM = RGM;

RGM.Levels = (() => {
  const PROGRESS_KEY = "rgm_progress_v1";

  // Atajo para describir una pieza: [pieceId, x, y, rotDeg, extras]
  // extras: { material, params:{...} }
  function build(levelId, title, pieces, links, timeoutMs) {
    const design = RGM.Design.createEmpty(title);
    if (timeoutMs) design.timeoutMs = timeoutMs;
    design.designId = "level-" + levelId;
    design.ownerId = "system";
    pieces.forEach((p, i) => {
      const def = RGM.getPieceDef(p[0]);
      const inst = RGM.Design.addPieceInstance(
        design,
        def,
        { x: p[1], y: p[2] },
        p[3] || 0,
        p[4] && p[4].material
      );
      inst.instanceId = `${levelId}-p${i}`;
      if (p[4] && p[4].params) Object.assign(inst.paramOverrides, p[4].params);
    });
    (links || []).forEach((l, i) => {
      design.logicNodes.push({
        nodeId: `${levelId}-n${i}`,
        sourcePieceId: `${levelId}-p${l[0]}`,
        condition: { event: l[1] },
        action: { targetPieceId: `${levelId}-p${l[2]}`, command: l[3] },
      });
    });
    return design;
  }

  // ---------------------------------------------------------------------
  // Definición de niveles
  // ---------------------------------------------------------------------
  const LEVEL_DEFS = [
    {
      levelId: "lv1",
      title: "Primera rodada",
      description: "Una bola, dos planos inclinados y la meta. Lo básico.",
      difficulty: 1,
      previewDurationSec: 8,
      pieces: [
        ["main_ball_01", 10, 8],
        ["floor_01", 11, 8.5, 15],
        ["floor_01", 15, 12.5, -15],
        ["floor_01", 12, 16.5, 0],
        ["end_meta_01", 12.5, 16],
      ],
    },
    {
      levelId: "lv2",
      title: "Zigzag de rampas",
      description: "Rampas que van y vienen: la bola baja por todas hasta la meta.",
      difficulty: 1,
      previewDurationSec: 8,
      pieces: [
        ["main_ball_01", 6.5, 7.5],
        ["ramp_straight_02", 8, 8, 15],
        ["ramp_straight_01", 10, 12, -15],
        ["ramp_straight_02", 7.5, 16, 15],
        ["floor_01", 11.5, 19.5, 15],
        ["wall_01", 13.5, 18.25, 0],
        ["end_meta_01", 12.25, 19],
      ],
    },
    {
      levelId: "lv3",
      title: "Salto con resorte",
      description: "La bola baja, cae sobre el resorte, sale disparada al aire y tiene que aterrizar en la plataforma de la meta.",
      difficulty: 3,
      previewDurationSec: 10,
      pieces: [
        ["main_ball_01", 5, 6.5],
        ["floor_01", 6.5, 7.5, 15],
        ["spring_01", 9.5, 10.25, 0],
        ["floor_01", 9.5, 11, 0],
        ["platform_01", 11, 7, 0],
        ["wall_01", 12.25, 5.25, 0],
        ["end_meta_01", 11.5, 6.25],
      ],
    },
    {
      levelId: "lv4",
      title: "Embocá el tacho",
      description: "La bola sale de la rampa y tiene que caer justo dentro del tacho, donde está la meta.",
      difficulty: 2,
      previewDurationSec: 8,
      pieces: [
        ["main_ball_01", 5, 6.5],
        ["floor_01", 6, 7.25, 15],
        ["floor_01", 9.5, 12.5, 0],
        ["trash_can_01", 9, 12, 0],
        ["end_meta_01", 9, 12],
      ],
    },
    {
      levelId: "lv5",
      title: "Gran recorrido",
      description: "Rampa, resorte, salto, segunda rampa y el tacho final: una cadena completa.",
      difficulty: 4,
      previewDurationSec: 12,
      pieces: [
        ["main_ball_01", 5, 6.5],
        ["floor_01", 6.5, 7.5, 15],
        ["spring_01", 9.5, 10.25, 0],
        ["floor_01", 9.5, 11, 0],
        ["floor_01", 12, 7.5, 15],
        ["floor_01", 16, 12.5, 0],
        ["trash_can_01", 15, 12, 0],
        ["end_meta_01", 15, 12],
      ],
    },
    {
      levelId: "lv6",
      title: "Experto: Máquina Rube Goldberg",
      description: "Modo experto: UNA sola máquina Rube Goldberg encadenada, con un único INICIO (la bola principal) y un único FINAL (la meta, abajo). Usa todas las piezas del juego al menos 3 veces (salvo Ratón y Queso): el botón libera una bola grande que tumba los dominós hasta un sensor; la bola chica sube con la polea; los resortes y plataformas la elevan; las palancas, botones y sensores abren compuertas; los tachos caen sobre las palancas y las paredes frenan a las bolas ayudantes. Ganás cuando la bola principal toca la meta.",
      difficulty: 5,
      previewDurationSec: 60,
      timeoutMs: 120000,
      pieces: [
        ["main_ball_01", 1.0, 2.0, 0, {"params": {"size": 0.4}}],
        ["floor_01", 2.5, 3.0, 15],
        ["button_01", 3.5, 3.0, 15],
        ["spring_01", 5.0, 4.25, 0, {"params": {"force": 45}}],
        ["platform_01", 6.5, 1.5, 15],
        ["floor_01", 9.5, 2.25, 15],
        ["ramp_straight_02", 12.5, 5.5, 180],
        ["ramp_straight_02", 2.0, 7.5, 180],
        ["ball_large_01", 2.0, 6.75, 0, {"material": "metal"}],
        ["floor_01", 5.25, 9.5, 30],
        ["floor_01", 10.0, 11.5, 0, {"params": {"scale": 1.25}}],
        ["domino_01", 8.0, 11.0, 0, {"material": "cristal", "params": {"sensibilidad": 100, "scale": 1.0}}],
        ["domino_01", 8.5, 11.0, 0, {"material": "cristal", "params": {"sensibilidad": 100, "scale": 1.0}}],
        ["domino_01", 9.25, 11.0, 0, {"material": "cristal", "params": {"sensibilidad": 100, "scale": 1.0}}],
        ["domino_01", 9.75, 11.0, 0, {"material": "cristal", "params": {"sensibilidad": 100, "scale": 1.0}}],
        ["domino_01", 10.5, 11.0, 0, {"material": "cristal", "params": {"sensibilidad": 100, "scale": 1.0}}],
        ["sensor_01", 11.0, 10.0, 0, {"params": {"scale": 0.5}}],
        ["floor_01", 16.25, 7.5, 15],
        ["pulley_01", 19.0, 9.0, 0, {"params": {"ropeLength": 4}}],
        ["ball_small_01", 19.5, 11.0, 0],
        ["sensor_01", 19.5, 8.75, 0],
        ["floor_01", 18.0, 13.5, 15],
        ["ramp_straight_02", 22.0, 15.0, 180],
        ["lever_01", 24.0, 17.5, 0],
        ["floor_01", 26.75, 20.5, 15],
        ["spring_01", 29.25, 21.75, 0, {"params": {"force": 70}}],
        ["platform_01", 31.25, 15.75, 15],
        ["floor_01", 34.25, 16.5, 15],
        ["floor_01", 37.75, 18.0, 15],
        ["spring_01", 40.25, 19.25, 0, {"params": {"force": 70}}],
        ["platform_01", 42.25, 13.25, 15],
        ["floor_01", 45.25, 14.0, 15],
        ["lever_01", 48.0, 17.0, 0],
        ["floor_01", 50.5, 20.0, 15],
        ["sensor_01", 51.5, 19.75, 0],
        ["ramp_straight_02", 55.5, 15.5, 180],
        ["ball_medium_01", 55.5, 15.0, 0],
        ["floor_01", 57.5, 18.5, 15, {"params": {"scale": 0.5}}],
        ["wall_01", 59.25, 19.5, 0, {"params": {"scale": 0.75}}],
        ["button_01", 58.5, 20.5, 0],
        ["ramp_straight_01", 58.0, 26.0, 180],
        ["trash_can_01", 58.0, 25.25, 0],
        ["lever_01", 56.5, 30.5, 0],
        ["floor_01", 52.5, 24.5, -15],
        ["ramp_straight_01", 49.5, 27.5, 180],
        ["floor_01", 45.5, 29.5, -15],
        ["button_01", 44.0, 29.5, -15],
        ["ramp_straight_01", 41.0, 32.0, 180],
        ["ramp_straight_02", 38.5, 26.0, 180],
        ["trash_can_01", 38.5, 25.25, 0],
        ["lever_01", 39.75, 29.5, 0],
        ["ramp_straight_02", 33.0, 23.0, 180],
        ["ball_large_01", 33.0, 22.25, 0, {"material": "metal"}],
        ["pulley_01", 35.5, 24.5, 0, {"params": {"ropeLength": 6}}],
        ["ball_small_01", 36.0, 27.75, 0],
        ["sensor_01", 36.0, 24.25, 0, {"params": {"scale": 0.5}}],
        ["ramp_straight_02", 20.0, 25.5, 180],
        ["ball_medium_01", 20.0, 25.0, 0],
        ["floor_01", 22.0, 28.5, 15, {"params": {"scale": 0.75}}],
        ["wall_01", 24.25, 30.25, 0, {"params": {"scale": 0.75}}],
        ["button_01", 23.5, 30.75, 0],
        ["ramp_straight_02", 15.0, 23.0, 180],
        ["ball_large_01", 15.0, 22.25, 0, {"material": "metal"}],
        ["pulley_01", 17.5, 24.5, 0, {"params": {"ropeLength": 6}}],
        ["ball_small_01", 18.0, 27.75, 0],
        ["sensor_01", 18.0, 24.25, 0, {"params": {"scale": 0.5}}],
        ["ramp_straight_02", 8.0, 25.5, 180],
        ["ball_medium_01", 8.0, 25.0, 0],
        ["floor_01", 10.0, 28.5, 15, {"params": {"scale": 0.75}}],
        ["wall_01", 12.25, 30.25, 0, {"params": {"scale": 0.75}}],
        ["button_01", 11.5, 30.75, 0],
        ["ramp_straight_02", 3.5, 26.0, 180],
        ["trash_can_01", 3.5, 25.25, 0],
        ["lever_01", 4.75, 29.5, 0],
        ["floor_01", 38.0, 33.0, -15],
        ["end_meta_01", 36.25, 33.0, 0],
      ],
      links: [
        [2, "onButtonPressed", 7, "rotate180cw"],
        [16, "onSensorActivated", 6, "rotate180ccw"],
        [20, "onSensorActivated", 22, "rotate180ccw"],
        [34, "onSensorActivated", 35, "rotate180cw"],
        [39, "onButtonPressed", 40, "rotate180ccw"],
        [42, "onLeverActivated", 44, "rotate180ccw"],
        [50, "onLeverActivated", 47, "rotate180ccw"],
        [46, "onButtonPressed", 51, "rotate180cw"],
        [55, "onSensorActivated", 56, "rotate180cw"],
        [60, "onButtonPressed", 61, "rotate180cw"],
        [65, "onSensorActivated", 66, "rotate180cw"],
        [70, "onButtonPressed", 71, "rotate180cw"],
        [73, "onLeverActivated", 48, "rotate180cw"],
      ],
    },
  ];

  let cache = null;

  function getAll() {
    if (!cache) {
      cache = LEVEL_DEFS.map((d) => ({
        levelId: d.levelId,
        title: d.title,
        description: d.description,
        difficulty: d.difficulty,
        previewDurationSec: d.previewDurationSec,
        timeoutMs: d.timeoutMs || 0,
        design: build(d.levelId, d.title, d.pieces, d.links, d.timeoutMs),
      }));
    }
    return cache;
  }

  function getById(levelId) {
    return getAll().find((l) => l.levelId === levelId) || null;
  }

  // Copia profunda de la máquina del nivel (para no tocar el original).
  function cloneDesign(level, newName) {
    const copy = JSON.parse(JSON.stringify(level.design));
    copy.designId = RGM.Design.newId ? RGM.Design.newId() : "copy-" + Math.random().toString(36).slice(2, 10);
    copy.name = newName || level.title;
    copy.ownerId = "local-player";
    return copy;
  }

  // Piezas permitidas = las que usa la máquina original (pieceLimits, 13.3)
  function getPieceLimits(level) {
    const limits = {};
    for (const p of level.design.pieces) {
      limits[p.pieceId] = (limits[p.pieceId] || 0) + 1;
    }
    return limits;
  }

  // ---------------------------------------------------------------------
  // Progreso
  // ---------------------------------------------------------------------
  function loadProgress() {
    try {
      const raw = localStorage.getItem(PROGRESS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function getStars(levelId) {
    const p = loadProgress()[levelId];
    return p ? p.stars || 0 : 0;
  }

  // Guarda solo si mejora el récord.
  function saveStars(levelId, stars) {
    try {
      const all = loadProgress();
      const prev = all[levelId] ? all[levelId].stars || 0 : 0;
      all[levelId] = { stars: Math.max(prev, stars), updatedAt: new Date().toISOString() };
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(all));
    } catch (e) {
      console.warn("No se pudo guardar el progreso:", e);
    }
  }

  // ---------------------------------------------------------------------
  // Evaluación de la reconstrucción (GDD 4.6 + 17.4)
  // ---------------------------------------------------------------------
  const POSITION_TOLERANCE_UG = 0.5; // 4.6: posición válida si dista <= 0.5 UG
  const ROTATION_TOLERANCE_DEG = 20; // asunción: el GDD no fija tolerancia angular
  const STAR3_AVG_ERROR_UG = 0.2; // 17.4

  function angleDiff(a, b) {
    let d = Math.abs((((a - b) % 360) + 540) % 360 - 180);
    return d;
  }

  /**
   * Empareja cada pieza original con la pieza reconstruida más cercana del
   * mismo tipo (greedy, sin reutilizar). Devuelve el detalle para mostrar
   * en el resultado.
   */
  function evaluate(level, playerDesign, functioned, usedCompare) {
    const original = level.design.pieces;
    const mine = playerDesign.pieces.slice();
    const used = new Set();
    let matched = 0;
    let errSum = 0;
    const perPiece = [];

    for (const o of original) {
      let best = -1;
      let bestDist = Infinity;
      mine.forEach((m, idx) => {
        if (used.has(idx) || m.pieceId !== o.pieceId) return;
        const d = Math.hypot(m.position.x - o.position.x, m.position.y - o.position.y);
        if (d < bestDist) {
          bestDist = d;
          best = idx;
        }
      });
      let ok = false;
      if (best >= 0) {
        used.add(best);
        const m = mine[best];
        const rotErr = angleDiff(m.rotationDeg || 0, o.rotationDeg || 0);
        errSum += Math.min(bestDist, 2);
        ok = bestDist <= POSITION_TOLERANCE_UG && rotErr <= ROTATION_TOLERANCE_DEG;
      } else {
        errSum += 2; // pieza faltante: penalización máxima de 2 UG
      }
      if (ok) matched++;
      perPiece.push({ pieceId: o.pieceId, ok, dist: bestDist === Infinity ? null : bestDist });
    }

    const total = original.length;
    const avgError = total ? errSum / total : 0;
    const sameCount = playerDesign.pieces.length === total;
    const positionPct = total ? Math.round((matched / total) * 100) : 100;

    // Estrellas (17.4)
    let stars = 0;
    if (functioned) {
      stars = 1;
      const minor = positionPct >= 70 && Math.abs(playerDesign.pieces.length - total) <= 1;
      if (minor) stars = 2;
      if (avgError < STAR3_AVG_ERROR_UG && sameCount && matched === total) stars = 3;
      // Usar "Comparar" penaliza (4.6): se pierde una estrella (mínimo 1).
      if (usedCompare && stars > 1) stars -= 1;
    }

    return { stars, functioned, positionPct, matched, total, avgError, sameCount, usedCompare, perPiece };
  }

  return { getAll, getById, cloneDesign, getPieceLimits, getStars, saveStars, evaluate, POSITION_TOLERANCE_UG };
})();

/* ===== ui.js ===== */
/* =========================================================================
   UI — Editor de Construcción (sección 4.4) completo: cámara con pan/zoom,
   colocación y selección de piezas, panel de categorías + inspector,
   inventario, y los modales de guardar/abrir/resultados.
   ========================================================================= */

window.RGM = RGM;

RGM.UI = (() => {
  const C = RGM.Constants;
  const ROTATE_STEP_DEG = 15; // no está numerado en el documento; asunción razonable

  let canvas, ctx;
  let design = null;
  let scene = C.SCENE.EDITOR;

  // cámara
  let camera = { x: 0, y: 0, zoom: 1 };
  let isPanning = false;
  let panStart = null;

  // selección / colocación
  let ghostPieceDef = null;
  let ghostRotation = 0;
  let selectedInstance = null;
  let draggingInstance = null;
  let dragOffset = { x: 0, y: 0 };

  // modo "vincular pieza" para Botón/Sensor -> pieza objetivo (sección 10)
  let linkMode = null; // { sourceId, event, command, label }

  let currentBackground = "laboratorio";

  let activeCategory = "todas";
  let searchTerm = "";

  let dirty = false;
  let lastMouseScreen = null;

  // Modo Reconstruir (GDD 4.6). null = editor libre normal.
  // { level, phase: "observe"|"hide"|"build", phaseStart, phaseEnd,
  //   usedCompare, compareReadyAt, compareUntil, limits, tour }
  let challenge = null;
  let particles = [];
  let layerCanvas = null;
  let lastHudKey = "";
  const COMPARE_COOLDOWN_MS = 30000; // 4.6: "Comparar" disponible cada 30 s
  const COMPARE_SHOW_MS = 4000;
  const HIDE_MS = 600; // 4.6: fase de ocultamiento

  // --- elementos DOM cacheados ---
  let el = {};

  function init() {
    canvas = document.getElementById("game-canvas");
    ctx = canvas.getContext("2d");

    el = {
      designName: document.getElementById("design-name"),
      pieceGrid: document.getElementById("piece-grid"),
      pieceSearch: document.getElementById("piece-search"),
      categoryTabs: document.getElementById("category-tabs"),
      inspector: document.getElementById("inspector-panel"),
      rightPanel: document.getElementById("right-panel"),
      bottomBar: document.getElementById("bottombar"),
      inventoryDrawer: document.getElementById("inventory-drawer"),
      inventoryTableBody: document.querySelector("#inventory-table tbody"),
      stateBanner: document.getElementById("state-banner"),
      zoomIndicator: document.getElementById("zoom-indicator"),
      touchBar: document.getElementById("touch-bar"),
      touchSheet: document.getElementById("touch-sheet"),
      touchRotCcw: document.getElementById("touch-rot-ccw"),
      touchRotCw: document.getElementById("touch-rot-cw"),
      touchDelete: document.getElementById("touch-delete"),
      touchCancel: document.getElementById("touch-cancel"),
      modalRoot: document.getElementById("modal-root"),
      tornillinBubble: document.getElementById("tornillin-bubble"),
      btnNew: document.getElementById("btn-new"),
      btnOpen: document.getElementById("btn-open"),
      btnSave: document.getElementById("btn-save"),
      btnClear: document.getElementById("btn-clear"),
      btnExport: document.getElementById("btn-export"),
      btnImport: document.getElementById("btn-import"),
      btnImportFile: document.getElementById("btn-import-file"),
      btnInventory: document.getElementById("btn-inventory"),
      btnLevels: document.getElementById("btn-levels"),
      chHud: document.getElementById("challenge-hud"),
      chTitle: document.querySelector("#challenge-hud .ch-title"),
      chPhase: document.querySelector("#challenge-hud .ch-phase"),
      chCount: document.querySelector("#challenge-hud .ch-count"),
      chSkip: document.getElementById("ch-skip"),
      chCompare: document.getElementById("ch-compare"),
      chExit: document.getElementById("ch-exit"),
      btnTest: document.getElementById("btn-test"),
      btnPause: document.getElementById("btn-pause"),
      btnStep: document.getElementById("btn-step"),
      btnSlowmo: document.getElementById("btn-slowmo"),
      btnStop: document.getElementById("btn-stop"),
      bgThumbs: document.querySelectorAll(".bg-thumb"),
    };

    RGM.Tornillin.init(el.tornillinBubble);

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    design = RGM.Design.createEmpty();
    centerCameraOnPlayfield();

    bindTopBar();
    bindCanvasInteraction();
    bindKeyboard();
    bindTouchBar();
    bindBackgrounds();

    renderCategoryTabs();
    renderPieceGrid();
    renderInventory();
    updateDesignNameInput();

    requestAnimationFrame(loop);
  }

  function resizeCanvas() {
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
  }

  function centerCameraOnPlayfield() {
    // camera.x/y son el punto del MUNDO que queda en el centro de la
    // pantalla, no la esquina — el plano va de (0,0) a (W,H) en UG, así
    // que hay que apuntar al punto medio, no al origen.
    const wPx = RGM.PhysicsEngine.ugToPx(C.PLAYFIELD_UG_W);
    const hPx = RGM.PhysicsEngine.ugToPx(C.PLAYFIELD_UG_H);
    camera.zoom = Math.min(1, (canvas.width || 900) / wPx);
    camera.x = wPx / 2;
    camera.y = hPx / 2;
  }

  // ---------------------------------------------------------------------
  // Coordenadas: mundo (px de simulación) <-> pantalla (px de canvas)
  // ---------------------------------------------------------------------
  function worldToScreen(wx, wy) {
    return {
      x: (wx - camera.x) * camera.zoom + canvas.width / 2,
      y: (wy - camera.y) * camera.zoom + canvas.height / 2,
    };
  }

  function screenToWorld(sx, sy) {
    return {
      x: (sx - canvas.width / 2) / camera.zoom + camera.x,
      y: (sy - canvas.height / 2) / camera.zoom + camera.y,
    };
  }

  function screenToUG(sx, sy) {
    const w = screenToWorld(sx, sy);
    return { x: w.x / C.UG_PX, y: w.y / C.UG_PX };
  }

  function snapUG(v, step = 0.25) {
    return Math.round(v / step) * step;
  }

  // ---------------------------------------------------------------------
  // Top bar
  // ---------------------------------------------------------------------
  function bindTopBar() {
    el.designName.addEventListener("input", () => {
      design.name = el.designName.value;
      dirty = true;
    });

    el.btnNew.addEventListener("click", () => {
      if (dirty && !confirm("¿Descartar el diseño actual sin guardar?")) return;
      design = RGM.Design.createEmpty();
      selectedInstance = null;
      linkMode = null;
      dirty = false;
      onDesignSwitched();
    });

    el.btnSave.addEventListener("click", showSaveAsModal);

    el.btnOpen.addEventListener("click", openLoadModal);

    el.btnClear.addEventListener("click", () => {
      if (!confirm("¿Borrar todas las piezas colocadas?")) return;
      design.pieces = [];
      design.logicNodes = [];
      selectedInstance = null;
      showInspector(false);
      dirty = true;
      refreshPieceCounts();
    });

    el.btnExport.addEventListener("click", () => RGM.Design.exportToFile(design));

    el.btnImport.addEventListener("click", () => el.btnImportFile.click());
    el.btnImportFile.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        design = await RGM.Design.importFromFile(file);
        selectedInstance = null;
        linkMode = null;
        dirty = false;
        onDesignSwitched();
      } catch (err) {
        alert("No se pudo importar: " + err.message);
      }
      e.target.value = "";
    });

    el.btnInventory.addEventListener("click", () => {
      el.inventoryDrawer.classList.toggle("open");
    });

    el.btnTest.addEventListener("click", handleTestButton);
    el.btnLevels.addEventListener("click", showLevelsModal);
    el.chSkip.addEventListener("click", () => {
      if (challenge && challenge.phase === "observe") challenge.phaseEnd = Date.now();
    });
    el.chCompare.addEventListener("click", useCompare);
    el.chExit.addEventListener("click", () => {
      if (!challenge) return;
      const hasWork = challenge.phase === "build" && design.pieces.length > 0;
      if (hasWork && !confirm("¿Salir del desafío? Se pierde lo que reconstruiste.")) return;
      exitChallenge();
    });
    el.btnPause.addEventListener("click", () => RGM.Simulation.togglePause());
    el.btnStep.addEventListener("click", () => RGM.Simulation.requestStep());
    el.btnSlowmo.addEventListener("click", () => {
      const active = el.btnSlowmo.classList.toggle("primary");
      RGM.Simulation.setSlowMotion(active);
    });
    el.btnStop.addEventListener("click", stopSimulationBackToEditor);
  }

  function bindBackgrounds() {
    // Taller y Fábrica ya están habilitados (antes decían "Próximamente").
    // Sin arte propio todavía, cada fondo usa una paleta de color distinta
    // (ver applyBackgroundStyle) — mínimo viable para que la elección
    // realmente haga algo, no solo se vea.
    el.bgThumbs.forEach((thumbEl) => {
      thumbEl.classList.remove("locked");
      thumbEl.removeAttribute("title");
      thumbEl.addEventListener("click", () => {
        currentBackground = thumbEl.dataset.bg;
        design.background = currentBackground;
        el.bgThumbs.forEach((t) => t.classList.toggle("active", t === thumbEl));
        dirty = true;
      });
    });
  }

  const BACKGROUND_STYLES = {
    laboratorio: "#0B3D91",
    taller: "#4E2A1E",
    fabrica: "#37474F",
  };

  function applyBackgroundStyle() {
    return BACKGROUND_STYLES[currentBackground] || BACKGROUND_STYLES.laboratorio;
  }

  function flashTopbarButton(btn, ok) {
    const original = btn.style.background;
    btn.style.background = ok ? "#A5D6A7" : "#EF9A9A";
    setTimeout(() => (btn.style.background = original), 350);
  }

  function updateDesignNameInput() {
    el.designName.value = design.name;
  }

  function onDesignSwitched() {
    updateDesignNameInput();
    renderInventory();
    showInspector(false);
    currentBackground = design.background || "laboratorio";
    el.bgThumbs.forEach((t) => t.classList.toggle("active", t.dataset.bg === currentBackground));
  }

  function handleTestButton() {
    if (challengeLocked()) return;
    const result = RGM.Validation.validateDesign(design);
    if (!result.ok) {
      showErrorsModal(result.errors);
      return;
    }
    RGM.Tornillin.onValidationWarnings(result.warnings);
    startSimulation();
  }

  function startSimulation() {
    scene = C.SCENE.SIMULATION;
    setEditorChromeVisible(false);
    setSimControlsVisible(true);
    RGM.Tornillin.resetForNewSimulation();
    RGM.Simulation.build(design, {
      onStateChange: handleSimStateChange,
      onFrame: (bodies) => {
        RGM.SimulationBodiesRef = bodies;
      },
    });
    showStateBanner("SIMULANDO...", "");
  }

  function stopSimulationBackToEditor() {
    RGM.Simulation.stop();
    scene = C.SCENE.EDITOR;
    setEditorChromeVisible(true);
    setSimControlsVisible(false);
    hideStateBanner();
  }

  function handleSimStateChange(state) {
    if (challenge && challenge.phase === "build") {
      if (state === C.SIM_STATE.SUCCESS) {
        showStateBanner("¡FUNCIONA!", "success");
        RGM.Tornillin.onSuccess();
        setTimeout(() => showChallengeResult(true), 900);
      } else if (state === C.SIM_STATE.FAILURE) {
        showStateBanner("NO SE LOGRÓ...", "failure");
        setTimeout(() => showChallengeResult(false), 900);
      }
      return;
    }
    if (state === C.SIM_STATE.SUCCESS) {
      showStateBanner("¡GANASTE!", "success");
      RGM.Tornillin.onSuccess();
      setTimeout(() => showResultModal(true), 900);
    } else if (state === C.SIM_STATE.FAILURE) {
      showStateBanner("NO SE LOGRÓ...", "failure");
      setTimeout(() => showResultModal(false), 900);
    }
  }

  function setEditorChromeVisible(visible) {
    el.rightPanel.classList.toggle("hidden", !visible);
    el.touchBar.classList.toggle("hidden", !visible);
    if (!visible) setSheetOpen(false);
    el.bottomBar.classList.toggle("hidden", !visible);
    [el.btnNew, el.btnOpen, el.btnSave, el.btnClear, el.btnExport, el.btnImport, el.btnInventory, el.btnLevels].forEach(
      (b) => (b.style.display = visible ? "" : "none")
    );
    if (visible) applyChallengeChrome();
    resizeCanvas();
  }

  function setSimControlsVisible(visible) {
    [el.btnPause, el.btnStep, el.btnSlowmo, el.btnStop].forEach(
      (b) => (b.style.display = visible ? "" : "none")
    );
    el.btnTest.style.display = visible ? "none" : "";
  }

  function showStateBanner(text, cls) {
    el.stateBanner.textContent = text;
    el.stateBanner.className = cls || "";
    el.stateBanner.classList.remove("hidden");
  }

  function hideStateBanner() {
    el.stateBanner.classList.add("hidden");
  }

  // ---------------------------------------------------------------------
  // Modales
  // ---------------------------------------------------------------------
  function showSaveAsModal() {
    el.modalRoot.innerHTML = `
      <div class="modal-card">
        <h2>Guardar diseño</h2>
        <div class="field">
          <label>Nombre del diseño</label>
          <input type="text" id="save-as-name" value="${escapeHtml(design.name)}"
                 style="width:100%;padding:8px 10px;border:1px solid var(--color-ui-panel-border);border-radius:var(--radius-sm);font-size:14px;" />
        </div>
        <div class="modal-actions">
          <button class="btn btn-secondary" id="modal-cancel">Cancelar</button>
          <button class="btn btn-primary" id="modal-confirm-save">Guardar</button>
        </div>
      </div>`;
    el.modalRoot.classList.add("visible");
    const input = document.getElementById("save-as-name");
    input.focus();
    input.select();

    const confirmSave = () => {
      const name = input.value.trim();
      if (!name) {
        input.focus();
        return;
      }
      design.name = name;
      updateDesignNameInput();
      const thumb = generateThumbnail();
      const okSaved = RGM.Design.save(design, thumb);
      dirty = false;
      closeModal();
      flashTopbarButton(el.btnSave, okSaved);
    };

    document.getElementById("modal-confirm-save").addEventListener("click", confirmSave);
    document.getElementById("modal-cancel").addEventListener("click", closeModal);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") confirmSave();
    });
  }

  function showErrorsModal(errors) {
    el.modalRoot.innerHTML = `
      <div class="modal-card">
        <h2>No se puede probar todavía</h2>
        <ul class="error-list">${errors.map((e) => `<li>${escapeHtml(e)}</li>`).join("")}</ul>
        <div class="modal-actions">
          <button class="btn btn-primary" id="modal-close">Entendido</button>
        </div>
      </div>`;
    el.modalRoot.classList.add("visible");
    document.getElementById("modal-close").addEventListener("click", closeModal);
  }

  function showResultModal(success) {
    el.modalRoot.innerHTML = `
      <div class="modal-card">
        <h2>${success ? "¡Nivel completo!" : "No llegó a la meta"}</h2>
        <p>${
          success
            ? "Tu máquina funcionó de punta a punta."
            : "Revisá el mecanismo y probá de nuevo — a veces alcanza con mover una pieza unos centímetros."
        }</p>
        <div class="modal-actions">
          <button class="btn btn-secondary" id="modal-edit">Volver a editar</button>
          <button class="btn btn-primary" id="modal-retry">Reintentar</button>
        </div>
      </div>`;
    el.modalRoot.classList.add("visible");
    document.getElementById("modal-edit").addEventListener("click", () => {
      closeModal();
      stopSimulationBackToEditor();
    });
    document.getElementById("modal-retry").addEventListener("click", () => {
      closeModal();
      RGM.Simulation.stop();
      startSimulation();
    });
  }

  function openLoadModal() {
    const saved = RGM.Design.listSaved();
    const rows = saved
      .map(
        (d) => `
      <div style="width:100%;margin-bottom:8px;padding:12px;display:flex;justify-content:space-between;align-items:center;border:1px solid var(--color-ui-panel-border);border-radius:var(--radius-md);">
        <div>
          <strong>${escapeHtml(d.name)}</strong><br/>
          <span style="font-size:11px;color:#888;">${new Date(d.updatedAt).toLocaleString()}</span>
        </div>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-primary" data-load="${d.designId}">Abrir</button>
          <button class="btn btn-secondary" data-delete="${d.designId}">Eliminar</button>
        </div>
      </div>`
      )
      .join("");

    el.modalRoot.innerHTML = `
      <div class="modal-card" style="max-width:480px;width:90%;max-height:70vh;overflow-y:auto;">
        <h2>Mis diseños guardados</h2>
        ${saved.length ? rows : "<p>Todavía no guardaste ningún diseño.</p>"}
        <div class="modal-actions">
          <button class="btn btn-secondary" id="modal-close">Cerrar</button>
        </div>
      </div>`;
    el.modalRoot.classList.add("visible");
    document.getElementById("modal-close").addEventListener("click", closeModal);
    el.modalRoot.querySelectorAll("[data-load]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const loaded = RGM.Design.loadById(btn.dataset.load);
        if (loaded) {
          design = loaded;
          selectedInstance = null;
          linkMode = null;
          dirty = false;
          onDesignSwitched();
        }
        closeModal();
      });
    });
    el.modalRoot.querySelectorAll("[data-delete]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (confirm("¿Eliminar este diseño guardado?")) {
          RGM.Design.deleteById(btn.dataset.delete);
          openLoadModal(); // refresca la lista
        }
      });
    });
  }

  function closeModal() {
    el.modalRoot.classList.remove("visible");
    el.modalRoot.innerHTML = "";
  }

  function escapeHtml(str) {
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }

  function generateThumbnail() {
    try {
      const data = canvas.toDataURL("image/png");
      return data.length < 400000 ? data : null;
    } catch (e) {
      return null;
    }
  }

  // ---------------------------------------------------------------------
  // Panel derecho: categorías + grilla de piezas + búsqueda
  // ---------------------------------------------------------------------
  function renderCategoryTabs() {
    const usedCats = [...new Set(RGM.PIECES_CATALOG.map((p) => p.category))];
    const tabs = [{ key: "todas", icon: "▦", hex: "#666" }].concat(
      usedCats.map((key) => ({ key, icon: RGM.PieceCategories[key].icon, hex: RGM.PieceCategories[key].hex }))
    );
    el.categoryTabs.innerHTML = tabs
      .map(
        (t) => `<div class="category-tab${t.key === activeCategory ? " active" : ""}"
                     data-cat="${t.key}" style="background:${t.hex}22;color:${t.hex}">${t.icon}</div>`
      )
      .join("");
    el.categoryTabs.querySelectorAll(".category-tab").forEach((tabEl) => {
      tabEl.addEventListener("click", () => {
        activeCategory = tabEl.dataset.cat;
        renderCategoryTabs();
        renderPieceGrid();
      });
    });

    el.pieceSearch.oninput = () => {
      searchTerm = el.pieceSearch.value.toLowerCase();
      renderPieceGrid();
    };
  }

  function renderPieceGrid() {
    const limited = challenge && challenge.phase === "build";
    const filtered = RGM.PIECES_CATALOG.filter((p) => {
      const matchesCat = activeCategory === "todas" || p.category === activeCategory;
      const matchesSearch = !searchTerm || p.name.toLowerCase().includes(searchTerm);
      const allowed = !limited || challenge.limits[p.id] !== undefined;
      return matchesCat && matchesSearch && allowed;
    });

    el.pieceGrid.innerHTML = filtered
      .map((p) => {
        const cat = RGM.PieceCategories[p.category];
        const rem = limited ? remainingOf(p.id) : null;
        const countLabel = limited ? `${rem}/${challenge.limits[p.id]}` : "∞";
        return `
        <div class="piece-cell${ghostPieceDef && ghostPieceDef.id === p.id ? " selected" : ""}"
             data-piece-id="${p.id}" title="${escapeHtml(p.description)}"
             style="${limited && rem <= 0 ? "opacity:0.4;" : ""}">
          <div class="piece-icon" style="background:${cat.hex}">${p.icon.length <= 2 ? p.icon : "🧩"}</div>
          <div>${p.name}</div>
          <div class="piece-count">${countLabel}</div>
        </div>`;
      })
      .join("");

    el.pieceGrid.querySelectorAll(".piece-cell").forEach((cellEl) => {
      cellEl.addEventListener("click", () => {
        const def = RGM.getPieceDef(cellEl.dataset.pieceId);
        if (challenge && remainingOf(def.id) <= 0) return;
        ghostPieceDef = ghostPieceDef && ghostPieceDef.id === def.id ? null : def;
        selectedInstance = null;
        showInspector(false);
        ghostRotation = 0;
        renderPieceGrid();
        if (ghostPieceDef) setSheetOpen(false); // en celular: despejar el plano para colocar
      });
    });
  }

  // ---------------------------------------------------------------------
  // Inventario (sección 4.4.5) — modo libre: ilimitado
  // ---------------------------------------------------------------------
  function renderInventory() {
    if (challenge && challenge.phase === "build") {
      el.inventoryTableBody.innerHTML = Object.keys(challenge.limits)
        .map((id) => {
          const def = RGM.getPieceDef(id);
          return `<tr><td>${def ? def.name : id}</td><td>${remainingOf(id)}/${challenge.limits[id]}</td></tr>`;
        })
        .join("");
      return;
    }
    el.inventoryTableBody.innerHTML = RGM.PIECES_CATALOG.map(
      (p) => `<tr><td>${p.name}</td><td>∞</td></tr>`
    ).join("");
  }

  // ---------------------------------------------------------------------
  // Inspector de pieza seleccionada
  // ---------------------------------------------------------------------
  function showInspector(active) {
    el.inspector.classList.toggle("active", active);
    el.pieceGrid.style.display = active ? "none" : "";
    el.categoryTabs.style.display = active ? "none" : "";
    el.pieceSearch.style.display = active ? "none" : "";
  }

  function renderInspector() {
    if (!selectedInstance) {
      showInspector(false);
      return;
    }
    const def = RGM.getPieceDef(selectedInstance.pieceId);
    showInspector(true);

    const materialOptions = def.allowedMaterials
      .map(
        (m) =>
          `<option value="${m}" ${m === selectedInstance.material ? "selected" : ""}>${RGM.Materials[m].label}</option>`
      )
      .join("");

    const paramFields = (def.configurableParams || [])
      .map((p) => {
        // Diseños viejos guardados antes de que existiera este parámetro
        // no lo tienen: se cae al default en vez de mostrar "undefined".
        const current =
          selectedInstance.paramOverrides[p.key] !== undefined
            ? selectedInstance.paramOverrides[p.key]
            : p.default;
        const step = p.step || 1;
        return `
      <div class="field">
        <label>${p.label}: <span class="value-readout" id="param-readout-${p.key}">${current}${p.unit}</span></label>
        <input type="range" min="${p.min}" max="${p.max}" step="${step}"
               value="${current}" data-param="${p.key}" />
      </div>`;
      })
      .join("");

    const linkSection = renderLinkSectionHtml(def);
    const hooksSection =
      def.id === "pulley_01"
        ? `<div class="field" style="border-top:1px dashed var(--color-ui-panel-border);padding-top:10px;">
             <p style="font-size:11px;color:#9aa1ab;margin:0;">
               No hace falta enganchar nada acá: durante la simulación,
               cualquier pieza que toque un gancho se pega sola y tira de
               ese lado según su peso. Se suelta si después toca otra cosa.
             </p>
           </div>`
        : "";
    const rotationSection =
      def.id === "pulley_01"
        ? "" // los ganchos siempre cuelgan derecho; rotar la Polea no cambia nada
        : `
      <div class="field">
        <label>Rotación: <span class="value-readout">${Math.round(selectedInstance.rotationDeg)}°</span></label>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-secondary" id="inspector-rotate-ccw">⟲ Q</button>
          <button class="btn btn-secondary" id="inspector-rotate-cw">⟳ E</button>
        </div>
      </div>`;

    el.inspector.innerHTML = `
      <h4>${def.name}</h4>
      <p style="font-size:12px;color:#6b7280;margin-top:0;">${def.description}</p>
      <div class="field">
        <label>Material</label>
        <select id="inspector-material">${materialOptions}</select>
      </div>
      ${rotationSection}
      ${paramFields}
      ${linkSection}
      ${hooksSection}
      <button class="btn btn-secondary" id="inspector-delete" style="width:100%;margin-top:8px;background:#FFCDD2;">
        🗑 Quitar pieza
      </button>
    `;

    bindLinkSectionEvents(def);

    document.getElementById("inspector-material").addEventListener("change", (e) => {
      selectedInstance.material = e.target.value;
      dirty = true;
    });
    const rotCcw = document.getElementById("inspector-rotate-ccw");
    const rotCw = document.getElementById("inspector-rotate-cw");
    if (rotCcw) rotCcw.addEventListener("click", () => rotateInstance(selectedInstance, -ROTATE_STEP_DEG));
    if (rotCw) rotCw.addEventListener("click", () => rotateInstance(selectedInstance, ROTATE_STEP_DEG));
    document.getElementById("inspector-delete").addEventListener("click", () => {
      RGM.Design.removePieceInstance(design, selectedInstance.instanceId);
      selectedInstance = null;
      showInspector(false);
      dirty = true;
      refreshPieceCounts();
    });
    el.inspector.querySelectorAll("input[type=range]").forEach((input) => {
      input.addEventListener("input", () => {
        const key = input.dataset.param;
        selectedInstance.paramOverrides[key] = Number(input.value);
        const paramDef = def.configurableParams.find((p) => p.key === key);
        document.getElementById("param-readout-" + key).textContent =
          input.value + (paramDef.unit || "");
        dirty = true;
      });
    });
  }

  // --- Vínculos Botón/Sensor -> pieza objetivo (sección 10) ---
  const LINK_CONFIG = {
    button_01: { event: "onButtonPressed", command: "rotate180cw", label: "Botón (rota a la derecha)" },
    sensor_01: { event: "onSensorActivated", command: "rotate180ccw", label: "Sensor (rota a la izquierda)" },
    lever_01: { event: "onLeverActivated", command: "rotate180cw", label: "Palanca al bascular (rota a la derecha)" },
    trash_can_01: { event: "onBallCaught", command: "rotate180cw", label: "Tacho al atrapar una bola (rota a la derecha)" },
  };

  function renderLinkSectionHtml(def) {
    const cfg = LINK_CONFIG[def.id];
    if (!cfg) return "";

    const links = RGM.Design.getLinksFrom(design, selectedInstance.instanceId);
    const linkRows = links
      .map((n) => {
        const targetInst = design.pieces.find((p) => p.instanceId === n.action.targetPieceId);
        const targetDef = targetInst ? RGM.getPieceDef(targetInst.pieceId) : null;
        return `
        <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;padding:4px 0;">
          <span>→ ${targetDef ? targetDef.name : "(pieza eliminada)"}</span>
          <button class="btn btn-secondary" data-unlink="${n.nodeId}" style="padding:2px 8px;">✕</button>
        </div>`;
      })
      .join("");

    const isLinking =
      linkMode && linkMode.kind === "logicLink" && linkMode.sourceId === selectedInstance.instanceId;

    return `
      <div class="field" style="border-top:1px dashed var(--color-ui-panel-border);padding-top:10px;">
        <label>Piezas vinculadas (${cfg.label})</label>
        ${linkRows || '<p style="font-size:11px;color:#9aa1ab;">Ninguna todavía.</p>'}
        <button class="btn ${isLinking ? "btn-primary" : "btn-secondary"}" id="inspector-link-btn" style="width:100%;">
          ${isLinking ? "Click en la pieza objetivo... (Esc cancela)" : "+ Vincular pieza"}
        </button>
      </div>`;
  }

  function bindLinkSectionEvents(def) {
    const cfg = LINK_CONFIG[def.id];
    if (!cfg) return;

    el.inspector.querySelectorAll("[data-unlink]").forEach((btn) => {
      btn.addEventListener("click", () => {
        RGM.Design.removeLogicLink(design, btn.dataset.unlink);
        dirty = true;
        renderInspector();
      });
    });

    const linkBtn = document.getElementById("inspector-link-btn");
    if (!linkBtn) return;
    linkBtn.addEventListener("click", () => {
      const isLinking =
        linkMode && linkMode.kind === "logicLink" && linkMode.sourceId === selectedInstance.instanceId;
      linkMode = isLinking
        ? null
        : { kind: "logicLink", sourceId: selectedInstance.instanceId, event: cfg.event, command: cfg.command };
      renderInspector();
    });
  }

  function rotateInstance(instance, deltaDeg) {
    instance.rotationDeg = ((instance.rotationDeg || 0) + deltaDeg + 360) % 360;
    dirty = true;
    if (selectedInstance === instance) renderInspector();
  }

  // ---------------------------------------------------------------------
  // Interacción con el canvas
  // ---------------------------------------------------------------------
  function bindCanvasInteraction() {
    // Pointer Events: sirven para mouse, dedo y lápiz (el celular no tenía soporte)
    canvas.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  function onMouseDown(e) {
    if (scene !== C.SCENE.EDITOR) return;
    if (challengeLocked()) return;
    const rect = canvas.getBoundingClientRect();
    const ug = screenToUG(e.clientX - rect.left, e.clientY - rect.top);

    // --- Modo "vincular pieza" activo (Botón/Sensor -> pieza objetivo):
    // el próximo click sobre una pieza colocada crea el vínculo ---
    if (linkMode) {
      const hitForLink = hitTestInstance(ug);
      if (hitForLink && hitForLink.instanceId !== linkMode.sourceId) {
        RGM.Design.addLogicLink(
          design,
          linkMode.sourceId,
          linkMode.event,
          hitForLink.instanceId,
          linkMode.command
        );
        dirty = true;
      }
      linkMode = null;
      renderInspector();
      return;
    }

    if (ghostPieceDef) {
      placeGhostAt(ug, e.shiftKey);
      return;
    }

    const hit = hitTestInstance(ug);
    if (hit) {
      selectedInstance = hit;
      renderInspector();
      draggingInstance = hit;
      dragOffset = { x: ug.x - hit.position.x, y: ug.y - hit.position.y };
      return;
    }

    selectedInstance = null;
    showInspector(false);
    isPanning = true;
    panStart = { sx: e.clientX - rect.left, sy: e.clientY - rect.top, cx: camera.x, cy: camera.y };
  }

  function placeGhostAt(ug, keepArmed) {
    if (!ghostPieceDef) return;
    if (challenge && remainingOf(ghostPieceDef.id) <= 0) {
      RGM.Tornillin.say("Ya usaste todas las piezas de ese tipo en este desafío.", "⚠️");
      ghostPieceDef = null;
      refreshPieceCounts();
      return;
    }
    const inst = RGM.Design.addPieceInstance(
      design,
      ghostPieceDef,
      { x: snapUG(ug.x), y: snapUG(ug.y) },
      ghostRotation
    );
    dirty = true;
    RGM.Tornillin.notifyPiecePlaced(design.pieces.length);
    if (!keepArmed || (challenge && remainingOf(ghostPieceDef.id) <= 0)) {
      ghostPieceDef = null;
    }
    refreshPieceCounts();
    selectedInstance = inst;
    renderInspector();
  }

  // ---- Táctil: un dedo = lo mismo que el mouse; dos dedos = pellizcar para
  // zoom y mover el plano. Con una pieza elegida, el dedo muestra el
  // fantasma y la pieza se coloca al soltar (así se puede ajustar). ----
  const activePointers = new Map();
  let pinch = null;
  let ignoreSingleTouch = false;
  let touchPlacing = false;

  function pointerPos(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function onPointerDown(e) {
    if (e.pointerType !== "touch") {
      onMouseDown(e);
      return;
    }
    e.preventDefault();
    activePointers.set(e.pointerId, pointerPos(e));
    if (activePointers.size === 2) {
      draggingInstance = null;
      isPanning = false;
      panStart = null;
      touchPlacing = false;
      ignoreSingleTouch = true;
      if (challengeLocked()) return;
      const [a, b] = [...activePointers.values()];
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      pinch = {
        dist: Math.max(10, Math.hypot(a.x - b.x, a.y - b.y)),
        zoom: camera.zoom,
        worldMid: screenToWorld(mid.x, mid.y),
      };
      return;
    }
    if (activePointers.size > 2 || ignoreSingleTouch) return;
    if (ghostPieceDef && !linkMode && scene === C.SCENE.EDITOR && !challengeLocked()) {
      touchPlacing = true;
      lastMouseScreen = pointerPos(e);
      return;
    }
    onMouseDown(e);
  }

  function onPointerMove(e) {
    if (e.pointerType !== "touch") {
      onMouseMove(e);
      return;
    }
    if (!activePointers.has(e.pointerId)) return;
    activePointers.set(e.pointerId, pointerPos(e));
    if (pinch && activePointers.size >= 2) {
      const [a, b] = [...activePointers.values()];
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const dist = Math.max(10, Math.hypot(a.x - b.x, a.y - b.y));
      camera.zoom = Math.min(2.5, Math.max(0.08, pinch.zoom * (dist / pinch.dist)));
      // el punto del mundo bajo los dedos se mantiene bajo los dedos
      camera.x = pinch.worldMid.x - (mid.x - canvas.width / 2) / camera.zoom;
      camera.y = pinch.worldMid.y - (mid.y - canvas.height / 2) / camera.zoom;
      return;
    }
    if (ignoreSingleTouch) return;
    if (touchPlacing) {
      lastMouseScreen = pointerPos(e);
      return;
    }
    onMouseMove(e);
  }

  function onPointerUp(e) {
    if (e.pointerType !== "touch") {
      onMouseUp();
      return;
    }
    if (!activePointers.has(e.pointerId)) return;
    const wasSingle = activePointers.size === 1 && !ignoreSingleTouch;
    activePointers.delete(e.pointerId);
    if (activePointers.size < 2) pinch = null;
    if (activePointers.size === 0) ignoreSingleTouch = false;
    if (touchPlacing) {
      touchPlacing = false;
      if (wasSingle && e.type === "pointerup" && ghostPieceDef) {
        placeGhostAt(screenToUG(lastMouseScreen.x, lastMouseScreen.y), false);
      }
      return;
    }
    if (wasSingle) onMouseUp();
  }

  function onMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;
    lastMouseScreen = { x: offsetX, y: offsetY };

    if (draggingInstance) {
      const ug = screenToUG(offsetX, offsetY);
      draggingInstance.position.x = snapUG(ug.x - dragOffset.x);
      draggingInstance.position.y = snapUG(ug.y - dragOffset.y);
      dirty = true;
      return;
    }

    if (isPanning && panStart) {
      camera.x = panStart.cx - (offsetX - panStart.sx) / camera.zoom;
      camera.y = panStart.cy - (offsetY - panStart.sy) / camera.zoom;
    }
  }

  function onMouseUp() {
    isPanning = false;
    panStart = null;
    draggingInstance = null;
  }

  function onWheel(e) {
    e.preventDefault();
    if (challengeLocked()) return;
    const factor = e.deltaY < 0 ? 1.08 : 0.92;
    // Antes el mínimo era 0.3 (no se podía alejar lo suficiente para ver
    // un circuito largo). Bajado a 0.08 = se puede ver casi 12x más plano.
    camera.zoom = Math.min(2.5, Math.max(0.08, camera.zoom * factor));
  }

  function hitTestInstance(ugPoint) {
    // recorre en orden inverso (lo último colocado gana en superposición)
    for (let i = design.pieces.length - 1; i >= 0; i--) {
      const inst = design.pieces[i];
      const def = RGM.getPieceDef(inst.pieceId);
      if (!def) continue;
      // Bola/Ratón "principal": el tamaño real puede ser distinto del
      // default del catálogo si se ajustó el slider "Tamaño".
      const sizeUG = def.isMainObject
        ? (inst.paramOverrides && inst.paramOverrides.size) || def.footprintUG.w
        : RGM.getFootprint(inst, def).w;
      const heightUG = def.isMainObject ? sizeUG : RGM.getFootprint(inst, def).h;
      const hw = sizeUG / 2 + 0.15;
      const hh = heightUG / 2 + 0.15;
      if (
        Math.abs(ugPoint.x - inst.position.x) <= hw &&
        Math.abs(ugPoint.y - inst.position.y) <= hh
      ) {
        return inst;
      }
    }
    return null;
  }

  function rotateCurrent(delta) {
    if (ghostPieceDef) ghostRotation = (ghostRotation + delta + 360) % 360;
    else if (selectedInstance) rotateInstance(selectedInstance, delta);
  }

  function cancelCurrent() {
    ghostPieceDef = null;
    selectedInstance = null;
    linkMode = null;
    showInspector(false);
    renderPieceGrid();
  }

  function deleteSelected() {
    if (!selectedInstance) return;
    RGM.Design.removePieceInstance(design, selectedInstance.instanceId);
    selectedInstance = null;
    showInspector(false);
    dirty = true;
    refreshPieceCounts();
  }

  // ---- Barra táctil (celular): reemplaza al teclado y al panel fijo ----
  function setSheetOpen(open) {
    el.rightPanel.classList.toggle("sheet-open", open);
    el.touchBar.classList.toggle("up", open);
  }

  function bindTouchBar() {
    el.touchSheet.addEventListener("click", () => {
      setSheetOpen(!el.rightPanel.classList.contains("sheet-open"));
    });
    el.touchRotCcw.addEventListener("click", () => rotateCurrent(-ROTATE_STEP_DEG));
    el.touchRotCw.addEventListener("click", () => rotateCurrent(ROTATE_STEP_DEG));
    el.touchDelete.addEventListener("click", deleteSelected);
    el.touchCancel.addEventListener("click", cancelCurrent);
  }

  function updateTouchBar() {
    const label = selectedInstance ? "⚙️ Ajustes" : "🧩 Piezas";
    if (el.touchSheet.textContent !== label) el.touchSheet.textContent = label;
    el.touchDelete.disabled = !selectedInstance;
  }

  function bindKeyboard() {
    window.addEventListener("keydown", (e) => {
      if (e.target.tagName === "INPUT") return;

      if (e.ctrlKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (!challenge) el.btnSave.click();
        return;
      }

      if (scene !== C.SCENE.EDITOR) return;
      if (challengeLocked()) return;

      if (e.key.toLowerCase() === "q") {
        rotateCurrent(-ROTATE_STEP_DEG);
      } else if (e.key.toLowerCase() === "e") {
        rotateCurrent(ROTATE_STEP_DEG);
      } else if (e.key === "Escape") {
        cancelCurrent();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        deleteSelected();
      }
    });
  }

  // ---------------------------------------------------------------------
  // Render loop
  // ---------------------------------------------------------------------
  let lastTs = 0;

  function loop(ts) {
    lastTs = ts;

    if (scene === C.SCENE.SIMULATION) {
      RGM.Simulation.tick(16);
      followCameraOnStartObject();
    } else if (!challenge) {
      RGM.Tornillin.tickInactivity(design.pieces.length);
    }
    updateChallenge(Date.now());
    updateTouchBar();

    draw();
    requestAnimationFrame(loop);
  }

  const CAMERA_FOLLOW_LERP = 0.08; // 0-1: más alto = sigue más "pegado"
  const CAMERA_MOVING_THRESHOLD = 0.05; // por debajo de esto, se considera "quieto"
  const CAMERA_PANORAMIC_MARGIN_PX = 220; // aire extra alrededor cuando hay varios en cámara

  /**
   * Sigue a los objetos "principales" (Inicio real + cualquier Bola/Ratón
   * puesta como pieza) que estén EN MOVIMIENTO. Con uno solo moviéndose,
   * lo sigue normal sin tocar el zoom (el zoom lo maneja el jugador). Si
   * hay dos o más moviéndose a la vez, centra el punto medio entre todos
   * y abre el zoom lo necesario para que entren todos + un margen, para
   * una vista panorámica — sin pelear con el zoom manual el resto del
   * tiempo, solo en ese caso puntual.
   */
  function followCameraOnStartObject() {
    const bodies = RGM.SimulationBodiesRef || [];
    const startBodies = bodies.filter((b) => b.rgm && b.rgm.role === "start");
    const moving = startBodies.filter(
      (b) => Matter.Vector.magnitude(b.velocity) > CAMERA_MOVING_THRESHOLD
    );

    if (moving.length === 0) return; // nadie en movimiento: la cámara no toca nada

    if (moving.length === 1) {
      const b = moving[0];
      camera.x += (b.position.x - camera.x) * CAMERA_FOLLOW_LERP;
      camera.y += (b.position.y - camera.y) * CAMERA_FOLLOW_LERP;
      return;
    }

    const xs = moving.map((b) => b.position.x);
    const ys = moving.map((b) => b.position.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    camera.x += ((minX + maxX) / 2 - camera.x) * CAMERA_FOLLOW_LERP;
    camera.y += ((minY + maxY) / 2 - camera.y) * CAMERA_FOLLOW_LERP;

    const spanX = maxX - minX + CAMERA_PANORAMIC_MARGIN_PX * 2;
    const spanY = maxY - minY + CAMERA_PANORAMIC_MARGIN_PX * 2;
    const neededZoom = Math.max(0.1, Math.min(canvas.width / spanX, canvas.height / spanY, camera.zoom));
    camera.zoom += (neededZoom - camera.zoom) * CAMERA_FOLLOW_LERP;
  }


  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = applyBackgroundStyle();
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawGrid();

    if (scene === C.SCENE.SIMULATION) {
      drawSimulationBodies();
    } else if (challenge && challenge.phase === "hide") {
      // Fase 2 (4.6): la máquina se desvanece y se desarma en partículas.
      const prog = Math.min(1, (Date.now() - challenge.phaseStart) / HIDE_MS);
      drawPiecesWithAlpha(design.pieces, 1 - prog);
      drawParticles();
    } else {
      drawEditorPieces();
      drawCompareGhost();
      drawGhost();
    }

    el.zoomIndicator.textContent = `Zoom ${(camera.zoom * 100).toFixed(0)}%`;
  }

  function drawGrid() {
    const ug = C.UG_PX;
    const topLeft = screenToWorld(0, 0);
    const bottomRight = screenToWorld(canvas.width, canvas.height);

    const startX = Math.floor(topLeft.x / ug) * ug;
    const startY = Math.floor(topLeft.y / ug) * ug;

    ctx.lineWidth = 1;
    for (let x = startX; x <= bottomRight.x; x += ug) {
      const isMajor = Math.round(x / ug) % 4 === 0;
      ctx.strokeStyle = isMajor ? "#5B9BE0" : "#2F6FCB";
      ctx.globalAlpha = isMajor ? 0.5 : 0.25;
      const p1 = worldToScreen(x, topLeft.y);
      const p2 = worldToScreen(x, bottomRight.y);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
    for (let y = startY; y <= bottomRight.y; y += ug) {
      const isMajor = Math.round(y / ug) % 4 === 0;
      ctx.strokeStyle = isMajor ? "#5B9BE0" : "#2F6FCB";
      ctx.globalAlpha = isMajor ? 0.5 : 0.25;
      const p1 = worldToScreen(topLeft.x, y);
      const p2 = worldToScreen(bottomRight.x, y);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function applyCameraTransform() {
    ctx.setTransform(
      camera.zoom,
      0,
      0,
      camera.zoom,
      canvas.width / 2 - camera.x * camera.zoom,
      canvas.height / 2 - camera.y * camera.zoom
    );
  }

  function resetTransform() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function drawEditorPieces() {
    applyCameraTransform();
    for (const inst of design.pieces) {
      const def = RGM.getPieceDef(inst.pieceId);
      if (!def) continue;
      drawDesignPiece(inst, def, inst === selectedInstance);
    }

    drawLogicLinkLines();
    resetTransform();
  }

  function pieceCenterPx(instanceId) {
    const inst = design.pieces.find((p) => p.instanceId === instanceId);
    if (!inst) return null;
    return { x: inst.position.x * C.UG_PX, y: inst.position.y * C.UG_PX };
  }

  function drawLogicLinkLines() {
    // Línea punteada entre cada Botón/Sensor y las piezas que vincula,
    // para que se entienda de un vistazo qué activa qué (sección 10).
    for (const node of design.logicNodes || []) {
      const from = pieceCenterPx(node.sourcePieceId);
      const to = pieceCenterPx(node.action.targetPieceId);
      if (!from || !to) continue;
      ctx.save();
      ctx.strokeStyle = node.action.command === "rotate180cw" ? "#AB47BC" : "#7B1FA2";
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = 2 / camera.zoom;
      ctx.setLineDash([6 / camera.zoom, 5 / camera.zoom]);
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawDesignPiece(inst, def, isSelected) {
    const cat = RGM.PieceCategories[def.category];
    const x = inst.position.x * C.UG_PX;
    const y = inst.position.y * C.UG_PX;
    const fp = RGM.getFootprint(inst, def);
    const wPx = fp.w * C.UG_PX;
    const hPx = fp.h * C.UG_PX;
    const angleRad = (inst.rotationDeg || 0) * (Math.PI / 180);
    const materialKey = inst.material || def.defaultMaterial;

    if (def.id === "pulley_01") {
      drawPulleyPreview(inst, def, x, y, isSelected);
      return;
    }

    if (def.id === "trash_can_01") {
      drawTrashCanPreview(inst, def, x, y, wPx, hPx, angleRad, materialKey, isSelected);
      return;
    }

    if (def.isMainObject) {
      // Se dibuja como el objeto de Inicio (círculo naranja + ícono),
      // para que se note a simple vista que ESTA bola/ratón también
      // puede llegar a la meta — no es un obstáculo más. Usa el
      // tamaño configurado en el inspector, no el tamaño fijo del
      // catálogo (que es solo el valor default).
      const sizeUG = (inst.paramOverrides && inst.paramOverrides.size) || def.footprintUG.w;
      const sizePx = sizeUG * C.UG_PX;
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = "#FF6F00";
      ctx.beginPath();
      ctx.arc(0, 0, sizePx / 2, 0, Math.PI * 2);
      ctx.fill();
      if (isSelected) {
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 3 / camera.zoom;
        ctx.stroke();
      }
      ctx.font = `${Math.round(sizePx * 0.9)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(def.icon, 0, 0);
      ctx.restore();
      return;
    }

    if (def.isEndObject) {
      // Círculo verde punteado + ícono, igual al estilo de "meta" que ya
      // se usa durante la simulación (drawEndMarker en physicsEngine.js).
      ctx.save();
      ctx.translate(x, y);
      ctx.strokeStyle = "#2E7D32";
      ctx.lineWidth = 3 / camera.zoom;
      ctx.setLineDash([8 / camera.zoom, 6 / camera.zoom]);
      ctx.beginPath();
      ctx.arc(0, 0, wPx / 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      if (isSelected) {
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 2 / camera.zoom;
        ctx.beginPath();
        ctx.arc(0, 0, wPx / 2, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.font = `${Math.round(wPx * 0.9)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#2E7D32";
      ctx.fillText(def.icon, 0, 0);
      ctx.restore();
      return;
    }

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angleRad);

    ctx.beginPath();
    if (def.physics.collisionShape === "circle") {
      ctx.arc(0, 0, wPx / 2, 0, Math.PI * 2);
    } else if (def.id === "ramp_straight_01") {
      // misma cuña triangular que en physicsEngine.js — si no coinciden,
      // lo que ves en el editor no sería lo que corre en la simulación.
      ctx.moveTo(-wPx / 2, hPx / 2);
      ctx.lineTo(wPx / 2, hPx / 2);
      ctx.lineTo(wPx / 2, -hPx / 2);
      ctx.closePath();
    } else if (def.id === "ramp_straight_02") {
      // espejo de ramp_straight_01: lado bajo a la derecha, alto a la
      // izquierda.
      ctx.moveTo(wPx / 2, hPx / 2);
      ctx.lineTo(-wPx / 2, hPx / 2);
      ctx.lineTo(-wPx / 2, -hPx / 2);
      ctx.closePath();
    } else {
      ctx.rect(-wPx / 2, -hPx / 2, wPx, hPx);
    }

    ctx.globalAlpha = def.physics.isTrigger ? 0.45 : 1;
    ctx.fillStyle = cat.hex;
    ctx.fill();

    // Antes acá siempre quedaba el color de categoría nomás — el
    // material elegido no se veía para nada. Ahora se pinta encima el
    // tinte + la textura del material real de la instancia.
    RGM.Materials.paintPattern(ctx, materialKey, wPx, hPx);
    const mat = RGM.Materials.resolve(materialKey);
    ctx.globalAlpha = (def.physics.isTrigger ? 0.45 : 1) * 0.55;
    ctx.fillStyle = mat.renderTint;
    ctx.fill();
    ctx.globalAlpha = 1;

    if (isSelected) {
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 3 / camera.zoom;
      ctx.stroke();
    }

    if (def.id === "lever_01") {
      ctx.fillStyle = "#E0E0E0";
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    if (def.id === "button_01" || def.id === "sensor_01") {
      ctx.font = `${Math.round(Math.min(wPx, hPx) * 1.2)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#fff";
      ctx.fillText(def.id === "button_01" ? "⏺" : "◎", 0, 0);
    }

    ctx.restore();
  }

  const TRASH_WALL_THICKNESS_PX_UI = 6; // debe coincidir con physicsEngine.js

  function drawTrashCanPreview(inst, def, x, y, wPx, hPx, angleRad, materialKey, isSelected) {
    // Mismo layout que crea physicsEngine.js: piso + dos paredes, sin
    // tapa — así lo que ves acá es lo que corre en la simulación.
    const t = TRASH_WALL_THICKNESS_PX_UI;
    const mat = RGM.Materials.resolve(materialKey);

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angleRad);

    const parts = [
      { x: -wPx / 2, y: -hPx / 2 + t / 2, w: t, h: hPx }, // pared izq (centrada en su alto real)
      { x: wPx / 2 - t, y: -hPx / 2 + t / 2, w: t, h: hPx }, // pared der
      { x: -wPx / 2, y: hPx / 2 - t, w: wPx, h: t }, // piso
    ];
    // (los rects de canvas se dibujan desde la esquina, por eso las
    // paredes usan wPx/2 y no wPx/2 - t/2 como en physicsEngine.js,
    // que centra los rectángulos de Matter en su punto medio)

    for (const p of parts) {
      const cx = p.x + p.w / 2;
      const cy = p.y + p.h / 2;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.beginPath();
      ctx.rect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.fillStyle = mat.renderTint;
      ctx.fill();
      RGM.Materials.paintPattern(ctx, materialKey, p.w, p.h);
      ctx.strokeStyle = "rgba(0,0,0,0.25)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }

    if (isSelected) {
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 2 / camera.zoom;
      ctx.strokeRect(-wPx / 2, -hPx / 2, wPx, hPx);
    }

    ctx.restore();
  }

  function drawPulleyPreview(inst, def, x, y, isSelected) {
    // Vista previa en el editor: como la Polea todavía no tiene bodies
    // físicos acá (recién se arman al simular), se dibuja "en reposo",
    // repartida mitad y mitad entre los dos ganchos.
    const ropeLengthUG =
      (inst.paramOverrides && inst.paramOverrides.ropeLength) ||
      (def.configurableParams.find((p) => p.key === "ropeLength") || {}).default ||
      4;
    const ropeLengthPx = ropeLengthUG * C.UG_PX;
    const halfPx = ropeLengthPx / 2;
    const gapPx = 0.55 * C.UG_PX;
    const leftX = x - gapPx;
    const rightX = x + gapPx;
    const hookLeftY = y + halfPx;
    const hookRightY = y + halfPx;
    const tint = RGM.Materials.resolve(inst.material || def.defaultMaterial).renderTint;

    ctx.save();
    ctx.strokeStyle = "#B0BEC5";
    ctx.lineWidth = 2 / camera.zoom;
    ctx.beginPath();
    ctx.moveTo(leftX, y);
    ctx.lineTo(leftX, hookLeftY);
    ctx.moveTo(rightX, y);
    ctx.lineTo(rightX, hookRightY);
    ctx.stroke();

    // rueda
    ctx.fillStyle = "#607D8B";
    ctx.beginPath();
    ctx.arc(x, y, 9 / camera.zoom, 0, Math.PI * 2);
    ctx.fill();

    // ganchos
    drawHookDot(leftX, hookLeftY, tint, isSelected);
    drawHookDot(rightX, hookRightY, tint, isSelected);

    ctx.restore();
  }

  function drawHookDot(x, y, tint, isSelected) {
    ctx.fillStyle = tint;
    ctx.beginPath();
    ctx.arc(x, y, 10 / camera.zoom, 0, Math.PI * 2);
    ctx.fill();
    if (isSelected) {
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 2 / camera.zoom;
      ctx.beginPath();
      ctx.arc(x, y, 10 / camera.zoom, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawGhost() {
    if (!ghostPieceDef || !lastMouseScreen) return;
    const ug = screenToUG(lastMouseScreen.x, lastMouseScreen.y);
    const snapped = { x: snapUG(ug.x), y: snapUG(ug.y) };

    applyCameraTransform();
    ctx.globalAlpha = 0.55;
    drawDesignPiece({ position: snapped, rotationDeg: ghostRotation }, ghostPieceDef, false);
    ctx.globalAlpha = 1;
    resetTransform();
  }


  // ---------------------------------------------------------------------
  // NIVELES + MODO RECONSTRUIR (GDD 4.6 / 4.7 / 17.4)
  // ---------------------------------------------------------------------
  function challengeLocked() {
    return !!challenge && challenge.phase !== "build";
  }

  function usedOf(pieceId) {
    return design.pieces.filter((p) => p.pieceId === pieceId).length;
  }

  function remainingOf(pieceId) {
    if (!challenge || challenge.limits[pieceId] === undefined) return 0;
    return challenge.limits[pieceId] - usedOf(pieceId);
  }

  function refreshPieceCounts() {
    renderPieceGrid();
    if (challenge) renderInventory();
  }

  function confirmDiscardCurrent() {
    if (dirty && design.pieces.length && !confirm("¿Descartar el diseño actual sin guardar?")) return false;
    return true;
  }

  function showLevelsModal() {
    const levels = RGM.Levels.getAll();
    const rows = levels
      .map((lv) => {
        const stars = RGM.Levels.getStars(lv.levelId);
        return `
        <div class="level-row">
          <div>
            <div class="lv-title">${escapeHtml(lv.title)}</div>
            <div class="lv-meta">Dificultad ${"⚙".repeat(lv.difficulty)} · ${lv.design.pieces.length} piezas</div>
            <div style="font-size:12px;margin-top:4px;">${escapeHtml(lv.description)}</div>
          </div>
          <div style="text-align:right;">
            <div class="lv-stars">${"★".repeat(stars)}${"☆".repeat(3 - stars)}</div>
            <div class="lv-actions">
              <button class="btn btn-secondary" data-view="${lv.levelId}">Ver y probar</button>
              <button class="btn btn-primary" data-rebuild="${lv.levelId}">Reconstruir</button>
            </div>
          </div>
        </div>`;
      })
      .join("");

    el.modalRoot.innerHTML = `
      <div class="modal-card" style="max-width:640px;width:92%;max-height:80vh;overflow-y:auto;">
        <h2>Niveles armados</h2>
        <p style="font-size:13px;margin:0 0 10px;">
          <b>Ver y probar</b> abre una copia de la máquina en el editor para correrla o modificarla.
          <b>Reconstruir</b> te la muestra unos segundos, la oculta y tenés que rearmarla de memoria
          con las mismas piezas: ganás estrellas según qué tan bien la replicás.
        </p>
        ${rows}
        <div class="modal-actions">
          <button class="btn btn-secondary" id="modal-close">Cerrar</button>
        </div>
      </div>`;
    el.modalRoot.classList.add("visible");
    document.getElementById("modal-close").addEventListener("click", closeModal);
    el.modalRoot.querySelectorAll("[data-view]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (!confirmDiscardCurrent()) return;
        const lv = RGM.Levels.getById(btn.dataset.view);
        design = RGM.Levels.cloneDesign(lv, lv.title + " (copia)");
        selectedInstance = null;
        linkMode = null;
        dirty = false;
        onDesignSwitched();
        closeModal();
        RGM.Tornillin.say("Copia lista: apretá ▶ para ver cómo funciona, o movela a tu gusto.", "🏁");
      });
    });
    el.modalRoot.querySelectorAll("[data-rebuild]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (!confirmDiscardCurrent()) return;
        closeModal();
        startReconstruct(RGM.Levels.getById(btn.dataset.rebuild));
      });
    });
  }

  function fitViewFor(pieces) {
    if (!pieces.length) return { x: camera.x, y: camera.y, zoom: camera.zoom };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of pieces) {
      const def = RGM.getPieceDef(p.pieceId);
      const fpv = def ? RGM.getFootprint(p, def) : { w: 1, h: 1 };
      const w = fpv.w / 2 + 1;
      const h = fpv.h / 2 + 1;
      minX = Math.min(minX, p.position.x - w);
      maxX = Math.max(maxX, p.position.x + w);
      minY = Math.min(minY, p.position.y - h);
      maxY = Math.max(maxY, p.position.y + h);
    }
    const wPx = (maxX - minX) * C.UG_PX;
    const hPx = (maxY - minY) * C.UG_PX;
    // Se deja ~110 px libres arriba para el HUD del desafío.
    const HUD_SPACE = 110;
    const zoom = Math.max(0.08, Math.min(canvas.width / wPx, (canvas.height - HUD_SPACE) / hPx, 1.2));
    return {
      x: ((minX + maxX) / 2) * C.UG_PX,
      y: ((minY + maxY) / 2) * C.UG_PX - HUD_SPACE / 2 / zoom,
      zoom,
    };
  }

  function startReconstruct(level) {
    if (scene === C.SCENE.SIMULATION) stopSimulationBackToEditor();
    const now = Date.now();
    design = RGM.Levels.cloneDesign(level, level.title);
    const fit = fitViewFor(level.design.pieces);
    // Recorrido automático (4.6): vista general -> acercamientos a piezas
    // clave (en orden de la máquina) -> vista general otra vez.
    const pieces = level.design.pieces;
    const stops = [];
    const n = Math.min(4, pieces.length);
    for (let i = 0; i < n; i++) {
      const p = pieces[Math.round((i * (pieces.length - 1)) / Math.max(1, n - 1))];
      stops.push({ x: p.position.x * C.UG_PX, y: p.position.y * C.UG_PX, zoom: Math.min(1.1, fit.zoom * 2) });
    }
    challenge = {
      level,
      phase: "observe",
      phaseStart: now,
      phaseEnd: now + level.previewDurationSec * 1000,
      usedCompare: false,
      compareReadyAt: 0,
      compareUntil: 0,
      limits: RGM.Levels.getPieceLimits(level),
      fit,
      stops,
    };
    selectedInstance = null;
    ghostPieceDef = null;
    linkMode = null;
    dirty = false;
    particles = [];
    lastHudKey = "";
    onDesignSwitched();
    camera.x = fit.x;
    camera.y = fit.y;
    camera.zoom = fit.zoom;
    applyChallengeChrome();
    renderPieceGrid();
    renderInventory();
  }

  function exitChallenge() {
    challenge = null;
    particles = [];
    lastHudKey = "";
    design = RGM.Design.createEmpty();
    selectedInstance = null;
    ghostPieceDef = null;
    linkMode = null;
    dirty = false;
    if (scene === C.SCENE.SIMULATION) stopSimulationBackToEditor();
    onDesignSwitched();
    setEditorChromeVisible(true);
    renderPieceGrid();
    renderInventory();
    centerCameraOnPlayfield();
    el.chHud.classList.remove("visible");
  }

  // Muestra/oculta paneles y botones según la fase del desafío.
  function applyChallengeChrome() {
    el.designName.disabled = !!challenge;
    if (!challenge) {
      el.chHud.classList.remove("visible");
      return;
    }
    const building = challenge.phase === "build";
    el.rightPanel.classList.toggle("hidden", !building);
    el.touchBar.classList.toggle("hidden", !building);
    if (!building) setSheetOpen(false);
    el.bottomBar.classList.toggle("hidden", !building);
    [el.btnNew, el.btnOpen, el.btnSave, el.btnExport, el.btnImport, el.btnLevels].forEach(
      (b) => (b.style.display = "none")
    );
    el.btnClear.style.display = building ? "" : "none";
    el.btnInventory.style.display = building ? "" : "none";
    el.btnTest.style.display = building && scene === C.SCENE.EDITOR ? "" : "none";
    resizeCanvas();
  }

  function useCompare() {
    if (!challenge || challenge.phase !== "build") return;
    const now = Date.now();
    if (now < challenge.compareReadyAt) return;
    challenge.usedCompare = true;
    challenge.compareUntil = now + COMPARE_SHOW_MS;
    challenge.compareReadyAt = now + COMPARE_COOLDOWN_MS;
  }

  // Avanza las fases y mantiene el HUD / la cámara. Se llama cada frame.
  function updateChallenge(now) {
    if (!challenge) return;
    const lv = challenge.level;

    if (challenge.phase === "observe") {
      const total = challenge.phaseEnd - challenge.phaseStart;
      const t = Math.min(1, (now - challenge.phaseStart) / total);
      // Cámara: vista general (20%) -> acercamientos -> vista general (25%)
      let target = challenge.fit;
      if (t >= 0.2 && t < 0.75 && challenge.stops.length) {
        const idx = Math.min(challenge.stops.length - 1, Math.floor(((t - 0.2) / 0.55) * challenge.stops.length));
        target = challenge.stops[idx];
      }
      camera.x += (target.x - camera.x) * 0.06;
      camera.y += (target.y - camera.y) * 0.06;
      camera.zoom += (target.zoom - camera.zoom) * 0.06;
      if (now >= challenge.phaseEnd) {
        challenge.phase = "hide";
        challenge.phaseStart = now;
        spawnParticles(lv.design.pieces);
        applyChallengeChrome();
      }
    } else if (challenge.phase === "hide") {
      if (now - challenge.phaseStart >= HIDE_MS) {
        // Fase 3: plano vacío, empieza la reconstrucción.
        const bg = lv.design.background;
        design = RGM.Design.createEmpty(lv.title + " (réplica)");
        design.background = bg;
        if (lv.design.timeoutMs) design.timeoutMs = lv.design.timeoutMs; // misma duración máxima que la original
        particles = [];
        challenge.phase = "build";
        challenge.phaseStart = now;
        challenge.compareReadyAt = now + COMPARE_COOLDOWN_MS;
        onDesignSwitched();
        applyChallengeChrome(); // muestra paneles -> el canvas cambia de tamaño
        challenge.fit = fitViewFor(lv.design.pieces); // re-encuadra con el tamaño final
        camera.x = challenge.fit.x;
        camera.y = challenge.fit.y;
        camera.zoom = challenge.fit.zoom;
        renderPieceGrid();
        renderInventory();
        RGM.Tornillin.say("¡A reconstruir! Usá las mismas piezas en los mismos lugares.", "🧩");
      }
    }

    // HUD
    const showHud = scene === C.SCENE.EDITOR;
    let phaseText = "";
    let countText = "";
    let compareText = "";
    let compareDisabled = true;
    if (challenge.phase === "observe") {
      phaseText = "Memorizá la máquina";
      countText = String(Math.max(0, Math.ceil((challenge.phaseEnd - now) / 1000)));
    } else if (challenge.phase === "hide") {
      phaseText = "Desarmando…";
    } else {
      const wait = Math.ceil((challenge.compareReadyAt - now) / 1000);
      phaseText = `Reconstruí la máquina (${design.pieces.length}/${lv.design.pieces.length} piezas)`;
      compareDisabled = wait > 0;
      compareText = wait > 0 ? `Comparar (${wait}s)` : "Comparar (−1★)";
    }
    const key = [showHud, challenge.phase, phaseText, countText, compareText].join("|");
    if (key !== lastHudKey) {
      lastHudKey = key;
      el.chHud.classList.toggle("visible", showHud);
      el.chTitle.textContent = lv.title;
      el.chPhase.textContent = phaseText;
      el.chCount.textContent = countText;
      el.chCount.style.display = countText ? "" : "none";
      el.chSkip.style.display = challenge.phase === "observe" ? "" : "none";
      el.chCompare.style.display = challenge.phase === "build" ? "" : "none";
      el.chCompare.textContent = compareText;
      el.chCompare.disabled = compareDisabled;
    }
  }

  function spawnParticles(pieces) {
    particles = [];
    for (const p of pieces) {
      for (let i = 0; i < 6; i++) {
        particles.push({
          x: p.position.x * C.UG_PX + (Math.random() - 0.5) * 30,
          y: p.position.y * C.UG_PX + (Math.random() - 0.5) * 30,
          vx: (Math.random() - 0.5) * 3,
          vy: -Math.random() * 3,
          size: 3 + Math.random() * 4,
        });
      }
    }
  }

  function drawParticles() {
    if (!particles.length) return;
    const prog = Math.min(1, (Date.now() - challenge.phaseStart) / HIDE_MS);
    applyCameraTransform();
    ctx.fillStyle = "#CFE3FF";
    ctx.globalAlpha = Math.max(0, 1 - prog * 0.9);
    for (const q of particles) {
      q.x += q.vx;
      q.y += q.vy;
      q.vy += 0.18;
      ctx.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
    }
    ctx.globalAlpha = 1;
    resetTransform();
  }

  // Dibuja piezas en una capa aparte y la compone con transparencia
  // (drawDesignPiece fija su propio globalAlpha, por eso no alcanza con
  // setear ctx.globalAlpha antes de dibujar).
  function drawPiecesWithAlpha(pieces, alpha) {
    if (!layerCanvas) layerCanvas = document.createElement("canvas");
    if (layerCanvas.width !== canvas.width || layerCanvas.height !== canvas.height) {
      layerCanvas.width = canvas.width;
      layerCanvas.height = canvas.height;
    }
    const real = ctx;
    const lctx = layerCanvas.getContext("2d");
    lctx.setTransform(1, 0, 0, 1, 0, 0);
    lctx.clearRect(0, 0, layerCanvas.width, layerCanvas.height);
    ctx = lctx;
    applyCameraTransform();
    for (const inst of pieces) {
      const def = RGM.getPieceDef(inst.pieceId);
      if (def) drawDesignPiece(inst, def, false);
    }
    ctx = real;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = alpha;
    ctx.drawImage(layerCanvas, 0, 0);
    ctx.globalAlpha = 1;
  }

  function drawCompareGhost() {
    if (!challenge || challenge.phase !== "build") return;
    const left = challenge.compareUntil - Date.now();
    if (left <= 0) return;
    const fadeOut = Math.min(1, left / 600);
    drawPiecesWithAlpha(challenge.level.design.pieces, 0.5 * fadeOut);
  }

  function showChallengeResult(ok) {
    if (!challenge) return;
    const lv = challenge.level;
    const ev = RGM.Levels.evaluate(lv, design, ok, challenge.usedCompare);
    if (ok) RGM.Levels.saveStars(lv.levelId, ev.stars);

    const starsHtml = [0, 1, 2]
      .map((i) => `<span class="${i < ev.stars ? "" : "off"}">${i < ev.stars ? "★" : "☆"}</span>`)
      .join("");
    const missed = ev.perPiece
      .filter((r) => !r.ok)
      .map((r) => {
        const def = RGM.getPieceDef(r.pieceId);
        return def ? def.name : r.pieceId;
      });
    const missedUnique = [...new Set(missed)];

    const lines = [
      `${ok ? "✅" : "❌"} Funcionamiento: ${ok ? "la bola llegó a la meta" : "no llegó a la meta"}`,
      `${ev.matched === ev.total ? "✅" : "🔸"} Posición: ${ev.matched}/${ev.total} piezas bien ubicadas (${ev.positionPct}%), error medio ${ev.avgError.toFixed(2)} UG`,
      `${ev.sameCount ? "✅" : "🔸"} Cantidad: usaste ${design.pieces.length} piezas, la original tenía ${ev.total}`,
    ];
    if (ev.usedCompare) lines.push("🔸 Usaste «Comparar»: −1 estrella");
    const hint =
      missedUnique.length && ev.stars < 3
        ? `<p style="font-size:12px;margin:0 0 8px;">Para mejorar, revisá: ${missedUnique.map(escapeHtml).join(", ")}.</p>`
        : "";

    el.modalRoot.innerHTML = `
      <div class="modal-card" style="max-width:480px;width:90%;">
        <h2>${ok ? (ev.stars === 3 ? "¡Réplica perfecta!" : "¡Tu réplica funciona!") : "Tu réplica no llegó a la meta"}</h2>
        <div class="result-stars">${starsHtml}</div>
        <ul class="result-list" style="list-style:none;padding-left:0;">${lines.map((l) => `<li>${l}</li>`).join("")}</ul>
        ${hint}
        <div class="modal-actions">
          <button class="btn btn-secondary" id="ch-res-continue">Seguir reconstruyendo</button>
          <button class="btn btn-secondary" id="ch-res-retry">Ver de nuevo</button>
          <button class="btn btn-primary" id="ch-res-levels">Niveles</button>
        </div>
      </div>`;
    el.modalRoot.classList.add("visible");
    document.getElementById("ch-res-continue").addEventListener("click", () => {
      closeModal();
      stopSimulationBackToEditor();
    });
    document.getElementById("ch-res-retry").addEventListener("click", () => {
      closeModal();
      startReconstruct(lv);
    });
    document.getElementById("ch-res-levels").addEventListener("click", () => {
      closeModal();
      exitChallenge();
      showLevelsModal();
    });
  }

  function drawSimulationBodies() {
    applyCameraTransform();
    const bodies = RGM.SimulationBodiesRef || [];
    RGM.PhysicsEngine.renderBodies(ctx, bodies);
    resetTransform();
  }

  // Hook solo para pruebas automáticas (no lo usa el juego).
  return { init, _debug: () => ({ camera, design, challenge, scene, canvas }) };
})();

/* ===== main.js ===== */
/* =========================================================================
   MAIN — punto de entrada. Arranca la UI una vez que el DOM y Matter.js
   están listos.
   ========================================================================= */

window.addEventListener("DOMContentLoaded", () => {
  if (typeof Matter === "undefined") {
    document.body.innerHTML =
      '<div style="padding:40px;font-family:sans-serif;color:#c62828;">' +
      "No se pudo cargar Matter.js. Revisá tu conexión a internet " +
      "(este proyecto lo carga desde cdnjs.cloudflare.com) y recargá la página." +
      "</div>";
    return;
  }
  try {
    RGM.UI.init();
  } catch (err) {
    // Muestra el error DIRECTO en la página en vez de solo en la consola
    // del navegador (F12), para no depender de que alguien sepa abrir
    // las DevTools para reportar un problema.
    console.error(err);
    const box = document.createElement("div");
    box.style.cssText =
      "position:fixed;inset:0;background:#1B1F27;color:#fff;" +
      "font-family:monospace;padding:24px;overflow:auto;z-index:9999;";
    box.innerHTML =
      '<h2 style="color:#EF5350;margin-top:0;">Error al iniciar el editor</h2>' +
      "<p>Copiá este texto y mandalo para poder arreglarlo:</p>" +
      '<pre style="white-space:pre-wrap;background:#0B0F19;padding:12px;border-radius:8px;">' +
      (err && err.stack ? err.stack : String(err)) +
      "</pre>";
    document.body.appendChild(box);
  }
});

