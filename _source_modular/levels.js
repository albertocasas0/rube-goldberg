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

const RGM = window.RGM || {};
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
