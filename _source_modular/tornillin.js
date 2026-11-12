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

const RGM = window.RGM || {};
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
