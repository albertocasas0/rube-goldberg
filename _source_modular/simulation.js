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

const RGM = window.RGM || {};
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
