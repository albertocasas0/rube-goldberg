/* =========================================================================
   CONSTANTS — valores globales del motor.
   Los marcados [DEFINIDO EN ESTA ESPECIFICACIÓN] vienen tal cual del
   documento (sección 5); el resto son valores de layout que necesita
   el código para funcionar.
   ========================================================================= */

const RGM = window.RGM || {};
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
