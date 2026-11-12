/* =========================================================================
   MATERIALS — sección 8. Valores textuales del documento fuente.
   Cada pieza física puede fabricarse en un material que sobreescribe sus
   propiedades físicas base.
   ========================================================================= */

const RGM = window.RGM || {};
window.RGM = RGM;

RGM.Materials = {
  madera:   { density: 0.6, friction: 0.4, restitution: 0.1,  breakThreshold: 25,  costMultiplier: 1.0, label: "Madera",   renderTint: "#A1887F", pattern: "grain" },
  metal:    { density: 2.5, friction: 0.3, restitution: 0.05, breakThreshold: 999, costMultiplier: 2.0, label: "Metal",    renderTint: "#90A4AE", pattern: "metallic" },
  goma:     { density: 1.1, friction: 0.9, restitution: 0.85, breakThreshold: 60,  costMultiplier: 1.3, label: "Goma",     renderTint: "#37474F", pattern: "dots" },
  hielo:    { density: 0.9, friction: 0.004, restitution: 0.15, breakThreshold: 15,  costMultiplier: 1.4, label: "Hielo",    renderTint: "#B3E5FC", pattern: "shine" },
  cristal:  { density: 1.2, friction: 0.2, restitution: 0.3,  breakThreshold: 5,   costMultiplier: 1.5, label: "Cristal",  renderTint: "#CFD8DC", pattern: "glass" },
  plastico: { density: 0.8, friction: 0.35, restitution: 0.4,  breakThreshold: 40,  costMultiplier: 0.8, label: "Plástico", renderTint: "#FFCC80", pattern: "flat" },
};

/**
 * Combina la config física base de una pieza con las propiedades del
 * material elegido. El material SOBREESCRIBE density/friction/restitution/
 * breakThreshold (regla textual de la sección 8).
 */
RGM.Materials.resolve = function (materialKey) {
  const mat = RGM.Materials[materialKey];
  if (!mat) {
    console.warn(`Material desconocido: ${materialKey}, uso plastico`);
    return RGM.Materials.plastico;
  }
  return mat;
};

/**
 * Dibuja una textura simple encima de una pieza ya rellena, para que el
 * material se distinga a simple vista además de por el tinte de color.
 * Se llama DESPUÉS de ctx.fill() con el path de la pieza todavía activo
 * como clip, centrado en (0,0) con ancho/alto en px ya escalados.
 */
RGM.Materials.paintPattern = function (ctx, materialKey, w, h) {
  const mat = RGM.Materials[materialKey];
  if (!mat) return;
  ctx.save();
  ctx.clip();
  ctx.globalAlpha = 0.5;

  switch (mat.pattern) {
    case "grain": // madera: líneas horizontales onduladas suaves
      ctx.strokeStyle = "rgba(60,40,20,0.5)";
      ctx.lineWidth = Math.max(1, h * 0.06);
      for (let y = -h / 2 + h * 0.2; y < h / 2; y += h * 0.28) {
        ctx.beginPath();
        ctx.moveTo(-w / 2, y);
        ctx.quadraticCurveTo(0, y + h * 0.08, w / 2, y);
        ctx.stroke();
      }
      break;
    case "metallic": // metal: brillo diagonal
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.beginPath();
      ctx.moveTo(-w / 2, h * 0.1);
      ctx.lineTo(-w / 2 + w * 0.25, -h / 2);
      ctx.lineTo(-w / 2 + w * 0.4, -h / 2);
      ctx.lineTo(-w / 2 + w * 0.15, h * 0.1);
      ctx.closePath();
      ctx.fill();
      break;
    case "dots": // goma: puntos
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      const step = Math.max(6, Math.min(w, h) * 0.22);
      for (let y = -h / 2 + step / 2; y < h / 2; y += step) {
        for (let x = -w / 2 + step / 2; x < w / 2; x += step) {
          ctx.beginPath();
          ctx.arc(x, y, step * 0.15, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    case "shine": // hielo: destello + veta cristalina
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.lineWidth = Math.max(1, h * 0.05);
      ctx.beginPath();
      ctx.moveTo(-w / 3, -h / 3);
      ctx.lineTo(w / 4, h / 4);
      ctx.moveTo(-w / 4, h / 3);
      ctx.lineTo(w / 3, -h / 4);
      ctx.stroke();
      break;
    case "glass": // cristal: transparencia (se aplica fuera, acá solo brillo)
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.beginPath();
      ctx.ellipse(-w * 0.15, -h * 0.15, w * 0.18, h * 0.35, 0.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "flat": // plástico: sin textura, solo un leve brillo superior
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.fillRect(-w / 2, -h / 2, w, h * 0.25);
      break;
  }
  ctx.restore();
};
