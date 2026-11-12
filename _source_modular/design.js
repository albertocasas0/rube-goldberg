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

const RGM = window.RGM || {};
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
