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

const RGM = window.RGM || {};
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
