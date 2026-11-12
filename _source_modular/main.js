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
