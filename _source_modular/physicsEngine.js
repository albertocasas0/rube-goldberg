/* =========================================================================
   PHYSICS ENGINE — creación de cuerpos Matter.js a partir de instancias
   de pieza (schema Design.pieces, sección 13.2) y render del canvas.

   Responsabilidad única de este archivo: traducir datos (piezas, start/end
   objects) a cuerpos físicos y dibujarlos. La lógica de eventos/colisiones
   (sección 10) vive en logic.js.
   ========================================================================= */

const RGM = window.RGM || {};
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
