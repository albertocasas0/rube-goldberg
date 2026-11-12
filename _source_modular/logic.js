/* =========================================================================
   LOGIC — sección 10 (sistema de lógica / visual scripting) y las
   colisiones que disparan los `emitsEvent` de cada pieza (sección 6.2).

   Alcance de esta iteración: implementamos el MOTOR de eventos y wiring
   (LogicNode, sección 10.1) completo y funcional, pero sin el editor
   visual de nodos por arrastre (eso es UI pura) — los logicNodes de un
   Design se escriben en su JSON. El motor sí corre las reglas
   SI/ENTONCES reales sobre la simulación.
   ========================================================================= */

const RGM = window.RGM || {};
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
