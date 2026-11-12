/* =========================================================================
   UI — Editor de Construcción (sección 4.4) completo: cámara con pan/zoom,
   colocación y selección de piezas, panel de categorías + inspector,
   inventario, y los modales de guardar/abrir/resultados.
   ========================================================================= */

const RGM = window.RGM || {};
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
