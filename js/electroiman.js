// ===========================================
// Simulador: ELECTROIMÁN (v4.4 - Osciloscopio PRO)
// Mejoras by ChatGPT: Osciloscopio estilo "panel profesional"
// - Grid y marcas
// - Rastro (afterglow) con blending
// - Cursor de tiempo / punta roja
// - Retina-ready (devicePixelRatio)
// - Escalado automático por amplitude/frequency (según sliders)
// - Low-cost performance (buffer + redibujo ligero)
// Nota: conserva el resto de la lógica original (solenoide, sonidos, brújula).
// ===========================================

// --- 1. CONFIGURACIÓN INICIAL ---
const canvas = document.getElementById("sim-canvas-electro");
const ctx = canvas.getContext("2d");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Elementos de Control DC/AC
const dcButton = document.getElementById("dc-button");
const acButton = document.getElementById("ac-button");
const dcPowerPanel = document.getElementById("dc-power-panel");
const acPowerPanel = document.getElementById("ac-power-panel");
const dcVoltageSlider = document.getElementById("dc-voltage-slider");
const dcVoltageValue = document.getElementById("dc-voltage-value");

// Elementos de Control AC (OSCCILOSCOPIO)
const acGraphCanvas = document.getElementById("ac-graph-canvas");
const actx = acGraphCanvas.getContext("2d");
// We'll set size dynamically in setupACCanvas()

const acAmplitudeSlider = document.getElementById("ac-amplitude-slider");
const acAmplitudeValue = document.getElementById("ac-amplitude-value");
const acFrequencySlider = document.getElementById("ac-frequency-slider");
const acFrequencyValue = document.getElementById("ac-frequency-value");

// Elementos de Control Solenoide
const turnsSelect = document.getElementById("turns-select");
const showElectronsCheck = document.getElementById("showElectrons");
const showFieldCheck = document.getElementById("showField");
const showCoreCheck = document.getElementById("showCore");

// Herramientas
const showCompassCheck = document.getElementById("showCompass");
const fieldMeterCheck = document.getElementById("fieldMeter");
const resetBtn = document.getElementById("resetBtn");

// Elementos de Control Simulación
const pauseBtn = document.getElementById("pause-btn");
const playBtn = document.getElementById("play-btn");
const stepBtn = document.getElementById("step-btn");

// ¡NUEVO! Definición de los objetos de Audio
const audioClick = new Audio('assets/audio/click.mp3');
const audioClack = new Audio('assets/audio/clack.mp3');
const audioHum = new Audio('assets/audio/hum.mp3');
audioHum.loop = true;
audioHum.volume = 0.5;

// --- 2. ESTADO DEL SIMULADOR ---
let isAC = false;
let isPaused = true;
let V = 5;
let N_coils = 4;
let time = 0;
let hasCore = false;
let isHumming = false;

// Estado de AC
let amplitude = 5; // A
let frequency = 0.5; // Hz

// Posiciones
let solenoid = {
  x: canvas.width / 3,
  y: canvas.height / 2,
  radius: 60,
  length: 150,
  wireThickness: 15,
  dragging: false,
  offsetX: 0,
  offsetY: 0
};
let compass = {
  x: canvas.width * 0.75,
  y: canvas.height * 0.75,
  radius: 40,
  dragging: false,
  offsetX: 0,
  offsetY: 0
};
let fieldMeter = {
  x: canvas.width * 0.25,
  y: canvas.height * 0.75,
  radius: 12,
  dragging: false,
  offsetX: 0,
  offsetY: 0
};

// Objetos para la Grúa (Clips)
let paperClips = [];

// ---------------------------
// OSCILOSCOPIO PRO - CONFIG
// ---------------------------
let acConfig = {
  timeWindow: 2.0,       // seconds shown in the window
  widthCSS: 220,         // CSS pixels initial, will be scaled
  heightCSS: 120,        // CSS pixels initial
  dpr: Math.max(1, window.devicePixelRatio || 1),
  gridColor: 'rgba(120,160,180,0.12)',
  axisColor: 'rgba(255,255,255,0.18)',
  traceColor: '#66ff88',     // main trace color
  traceWidth: 2,
  glowAlpha: 0.12,           // afterglow alpha when drawing trail
  sweepColor: 'rgba(255,80,80,0.95)', // red cursor / point
  roundedRadius: 8,
  borderGradStart: '#07202A',
  borderGradEnd: '#041116'
};

// Buffer to store samples for the window (one value per horizontal pixel)
let sampleBuffer = [];
let sampleBufferInitialized = false;

// Helper: set up AC canvas size (retina-ready)
function setupACCanvas() {
  // optionally make width bigger depending on available space (or keep fixed)
  const cssW = acConfig.widthCSS;
  const cssH = acConfig.heightCSS;
  acGraphCanvas.style.width = cssW + "px";
  acGraphCanvas.style.height = cssH + "px";
  const dpr = acConfig.dpr = Math.max(1, window.devicePixelRatio || 1);
  acGraphCanvas.width = Math.round(cssW * dpr);
  acGraphCanvas.height = Math.round(cssH * dpr);
  actx.setTransform(dpr, 0, 0, dpr, 0, 0); // scale drawing to CSS pixels
  // init buffer length
  sampleBuffer = new Float32Array(cssW + 2);
  sampleBufferInitialized = true;
}
setupACCanvas();

// If the window resizes, keep oscilloscope consistent with CSS dims
window.addEventListener('resize', () => {
  // maintain the CSS size but refresh DPR in case of monitor change
  acConfig.dpr = Math.max(1, window.devicePixelRatio || 1);
  setupACCanvas();
});

// ---------------------------
// UTIL: get current (keeps your previous function behavior)
// ---------------------------
function getCurrent(t) {
  if (!isAC) {
    return V / 10;
  }
  const angularFrequency = 2 * Math.PI * frequency;
  return amplitude * Math.sin(angularFrequency * t);
}

// ---------------------------
// PHYSICS (kept same as before)
// ---------------------------
function getMagneticFieldAt(x, y, current) {
  const { x: sx, y: sy, length, radius } = solenoid;
  const halfL = length / 2;
  let K_STRENGTH = 200000;
  const PERMEABILITY_FACTOR = 1000;
  if (hasCore) {
    K_STRENGTH *= PERMEABILITY_FACTOR;
  }
  const I = current;
  if (x > sx - radius && x < sx + radius && y > sy - halfL && y < sy + halfL) {
    const B_mag = K_STRENGTH * N_coils * I / length;
    return { Bx: 0, By: -B_mag };
  }
  const magneticMoment = K_STRENGTH * N_coils * I * radius * radius * 0.5;
  const dz = y - sy;
  const dr = x - sx;
  let r_sq = dr * dr + dz * dz;
  r_sq = Math.max(r_sq, 2500);
  const r = Math.sqrt(r_sq);
  const Bx_dipole = (magneticMoment / r_sq) * (3 * dr * dz) / r;
  const By_dipole = (magneticMoment / r_sq) * (3 * dz * dz - r_sq) / r;
  return { Bx: Bx_dipole, By: By_dipole };
}

// ---------------------------
// DIBUJOS (mantengo tus funciones y las llamo)
// ---------------------------
function drawSolenoid(current) {
  const { x, y, length, radius, wireThickness } = solenoid;
  const halfL = length / 2;
  const direction = Math.sign(current) || 0;
  const absCurrent = Math.abs(current);
  const electronSpeed = absCurrent * 0.2;
  const N_total = 4;
  const N_active = N_coils;
  ctx.save();
  if (hasCore) {
    ctx.fillStyle = 'rgba(128, 128, 128, 0.9)';
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    const coreRadius = radius * 0.7;
    ctx.fillRect(x - coreRadius, y - halfL, coreRadius * 2, length);
    ctx.fillStyle = 'rgba(100, 100, 100, 0.9)';
    ctx.beginPath();
    ctx.ellipse(x, y - halfL, coreRadius, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x, y + halfL, coreRadius, 8, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = 'rgba(139, 69, 19, 0.7)';
    ctx.fillRect(x - radius, y - halfL, radius * 2, length);
    ctx.fillStyle = 'rgba(100, 50, 10, 0.8)';
    ctx.beginPath();
    ctx.ellipse(x, y - halfL, radius, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x, y + halfL, radius, 10, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const coil_spacing = length / (N_total + 1);
  for (let i = 0; i < N_active; i++) {
    const coilY = y - halfL + coil_spacing * (i + 1);
    const grad = ctx.createLinearGradient(x - radius, coilY - wireThickness / 2, x + radius, coilY + wireThickness / 2);
    grad.addColorStop(0, '#704214');
    grad.addColorStop(0.5, '#A0522D');
    grad.addColorStop(1, '#704214');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(x, coilY, radius, wireThickness / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    if (showElectronsCheck.checked && absCurrent > 0.05) {
      const electronRadius = 4;
      const electronColor = direction > 0 ? "#ff00ff" : "#00FFFF";
      ctx.fillStyle = electronColor;
      ctx.strokeStyle = "white";
      ctx.lineWidth = 1;
      const electronsPerCoil = 5;
      for (let j = 0; j < electronsPerCoil; j++) {
        const angleOffset = (time * electronSpeed * direction + j / electronsPerCoil) * 2 * Math.PI;
        const electronX = x + radius * 0.9 * Math.cos(angleOffset);
        const electronY = coilY + radius * 0.1 * Math.sin(angleOffset);
        ctx.beginPath();
        ctx.arc(electronX, electronY, electronRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "white";
        ctx.font = "bold 9px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("-", electronX, electronY);
      }
    }
  }
  ctx.restore();
}

function drawDCPower(current) {
  if (isAC) return;
  const { x: sx, y: sy, length, radius } = solenoid;
  const halfL = length / 2;
  const battWidth = 120;
  const battHeight = 40;
  const battYOffset = 50;
  const battX = sx - battWidth / 2;
  const battY = sy - halfL - battHeight - battYOffset;
  ctx.save();
  ctx.shadowColor = 'rgba(255, 255, 255, 0.4)';
  ctx.shadowBlur = 10;
  ctx.fillStyle = "#A0A0A0";
  ctx.fillRect(battX - 10, battY - 5, battWidth + 20, battHeight + 10);
  ctx.fillStyle = V > 0 ? "#ff8c00" : "#007bff";
  ctx.fillRect(battX, battY, 80, battHeight);
  ctx.fillStyle = V > 0 ? "#007bff" : "#ff8c00";
  ctx.fillRect(battX + 80, battY, 40, battHeight);
  ctx.fillStyle = "#ccc";
  ctx.fillRect(battX + 120, battY + 10, 10, 20);
  ctx.fillRect(battX - 10, battY + 10, 10, 20);
  ctx.fillStyle = "white";
  ctx.font = "bold 16px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`${Math.abs(V).toFixed(0)} V`, battX + 60, battY + 20);
  ctx.restore();
  const posColor = V > 0 ? "red" : "blue";
  const negColor = V > 0 ? "blue" : "red";
  const batConnectP = { x: battX + 125, y: battY + 20 };
  const batConnectN = { x: battX - 5, y: battY + 20 };
  const solenoidConnectP = { x: sx + radius, y: sy - halfL };
  const solenoidConnectN = { x: sx - radius, y: sy + halfL };
  ctx.lineWidth = solenoid.wireThickness;
  ctx.lineCap = "round";
  ctx.strokeStyle = posColor;
  ctx.beginPath();
  ctx.moveTo(batConnectP.x, batConnectP.y);
  ctx.bezierCurveTo(batConnectP.x, sy - halfL - 20, solenoidConnectP.x + 20, sy - halfL - 20, solenoidConnectP.x, solenoidConnectP.y);
  ctx.stroke();
  ctx.strokeStyle = negColor;
  ctx.beginPath();
  ctx.moveTo(batConnectN.x, batConnectN.y);
  ctx.bezierCurveTo(batConnectN.x, sy + halfL + 20, solenoidConnectN.x - 20, sy + halfL + 20, solenoidConnectN.x, solenoidConnectN.y);
  ctx.stroke();
}


// ---------------------------
// OSCILOSCOPIO: Dibujo profesional
// ---------------------------
function drawACGraph() {
  if (!isAC) return;

  if (!sampleBufferInitialized) setupACCanvas();

  const cssW = acConfig.widthCSS;
  const cssH = acConfig.heightCSS;
  const width = cssW;
  const height = cssH;
  const centerY = height / 2;

  // background panel (rounded)
  actx.clearRect(0, 0, width, height);
  // draw rounded background
  const r = acConfig.roundedRadius;
  actx.save();
  actx.beginPath();
  actx.moveTo(r, 0);
  actx.arcTo(width, 0, width, r, r);
  actx.arcTo(width, height, width - r, height, r);
  actx.arcTo(0, height, 0, height - r, r);
  actx.arcTo(0, 0, r, 0, r);
  actx.closePath();
  // gradient border / panel
  const bgGrad = actx.createLinearGradient(0, 0, 0, height);
  bgGrad.addColorStop(0, acConfig.borderGradStart);
  bgGrad.addColorStop(1, acConfig.borderGradEnd);
  actx.fillStyle = bgGrad;
  actx.fill();

  // inner drawing area (slightly inset)
  const inset = 8;
  const innerW = width - inset * 2;
  const innerH = height - inset * 2;
  const innerX = inset;
  const innerY = inset;

  // inner background (dark)
  actx.fillStyle = "#091214";
  roundRect(actx, innerX, innerY, innerW, innerH, 6, true, false);

  // draw grid lines (subtle)
  actx.strokeStyle = acConfig.gridColor;
  actx.lineWidth = 1;
  actx.save();
  actx.beginPath();
  const cols = 8;
  const rows = 4;
  for (let i = 0; i <= cols; i++) {
    const x = innerX + (i / cols) * innerW;
    actx.moveTo(x, innerY);
    actx.lineTo(x, innerY + innerH);
  }
  for (let j = 0; j <= rows; j++) {
    const y = innerY + (j / rows) * innerH;
    actx.moveTo(innerX, y);
    actx.lineTo(innerX + innerW, y);
  }
  actx.stroke();
  actx.restore();

  // axis line (middle)
  actx.strokeStyle = acConfig.axisColor;
  actx.lineWidth = 1;
  actx.beginPath();
  actx.moveTo(innerX, innerY + innerH / 2);
  actx.lineTo(innerX + innerW, innerY + innerH / 2);
  actx.stroke();

  // compute new sample for current time (sample rate = width / timeWindow)
  const timeWindow = acConfig.timeWindow; // seconds
  // Map time to x coordinate: t in [time-timeWindow, time] => x in [innerX, innerX+innerW]
  // We'll fill sampleBuffer using the formula I(t) evaluated at equispaced times across window
  const angularFrequency = 2 * Math.PI * frequency;

  // Fill buffer (we do this each frame; width small so it's fine)
  for (let px = 0; px < innerW; px++) {
    // t at this pixel
    const t_at_px = time - timeWindow * (1 - px / innerW);
    // sample value
    let sample;
    if (!isAC) sample = V / 10;
    else sample = amplitude * Math.sin(angularFrequency * t_at_px);
    sampleBuffer[px] = sample;
  }

  // draw trace with afterglow: draw many faint copies with decreasing alpha to simulate persistence
  // We'll draw the main trace plus a faded trail by drawing previous frames with slight offset using composite op
  // Simpler: we draw the trace once with a glow effect using shadow + stroke, then draw a faint filled trail behind.

  // draw faint filled area under trace (for richness)
  actx.save();
  actx.globalCompositeOperation = 'source-over';
  // build path
  actx.beginPath();
  for (let px = 0; px < innerW; px++) {
    const s = sampleBuffer[px];
    // normalize y: sample in [-amplitude, amplitude] -> map to innerH
    const normalized = (amplitude === 0) ? 0 : (s / amplitude);
    const y = innerY + innerH / 2 - normalized * (innerH * 0.42);
    const x = innerX + px;
    if (px === 0) actx.moveTo(x, y);
    else actx.lineTo(x, y);
  }
  // close path to bottom
  actx.lineTo(innerX + innerW, innerY + innerH);
  actx.lineTo(innerX, innerY + innerH);
  actx.closePath();
  const areaGrad = actx.createLinearGradient(innerX, innerY, innerX, innerY + innerH);
  areaGrad.addColorStop(0, 'rgba(100,255,160,0.035)');
  areaGrad.addColorStop(1, 'rgba(100,255,160,0.005)');
  actx.fillStyle = areaGrad;
  actx.fill();
  actx.restore();

  // main trace: use shadow + stroke for glow
  actx.save();
  actx.lineJoin = 'round';
  actx.lineCap = 'round';
  actx.strokeStyle = acConfig.traceColor;
  actx.lineWidth = acConfig.traceWidth;
  actx.shadowColor = acConfig.traceColor;
  actx.shadowBlur = 8;
  actx.beginPath();
  for (let px = 0; px < innerW; px++) {
    const s = sampleBuffer[px];
    const normalized = (amplitude === 0) ? 0 : (s / amplitude);
    const y = innerY + innerH / 2 - normalized * (innerH * 0.42);
    const x = innerX + px;
    if (px === 0) actx.moveTo(x, y);
    else actx.lineTo(x, y);
  }
  actx.stroke();
  actx.restore();

  // small faint trail: draw a translucent version slightly faded behind the main (gives persistence illusion)
  actx.save();
  actx.globalAlpha = 0.16;
  actx.beginPath();
  for (let px = 0; px < innerW; px++) {
    const s = sampleBuffer[Math.max(0, px - 8)]; // slight left shift
    const normalized = (amplitude === 0) ? 0 : (s / amplitude);
    const y = innerY + innerH / 2 - normalized * (innerH * 0.42);
    const x = innerX + px;
    if (px === 0) actx.moveTo(x, y);
    else actx.lineTo(x, y);
  }
  actx.lineWidth = 1.5;
  actx.strokeStyle = acConfig.traceColor;
  actx.stroke();
  actx.restore();

  // draw cursor at right edge (current time)
  const currentI = getCurrent(time);
  const normalizedI = (amplitude === 0) ? 0 : (currentI / amplitude);
  const cursorY = innerY + innerH / 2 - normalizedI * (innerH * 0.42);
  const cursorX = innerX + innerW;
  actx.save();
  actx.fillStyle = acConfig.sweepColor;
  actx.beginPath();
  actx.arc(cursorX, cursorY, 3.6, 0, Math.PI * 2);
  actx.fill();
  // vertical faint sweep line at right
  actx.globalAlpha = 0.12;
  actx.fillRect(cursorX - 1, innerY, 2, innerH);
  actx.restore();

  // draw small digital readout (top right)
  actx.save();
  actx.font = "bold 11px Arial";
  actx.fillStyle = "rgba(255,255,255,0.92)";
  actx.textAlign = "right";
  actx.fillText(`${currentI.toFixed(2)} A`, innerX + innerW - 6, innerY + 14);
  actx.restore();

  // draw axis ticks and amplitude labels on left
  actx.save();
  actx.fillStyle = "rgba(255,255,255,0.6)";
  actx.font = "10px Arial";
  actx.textAlign = "left";
  actx.fillText(`+${amplitude.toFixed(1)}A`, innerX + 6, innerY + 12);
  actx.fillText(`0.0A`, innerX + 6, innerY + innerH / 2 + 4);
  actx.fillText(`-${amplitude.toFixed(1)}A`, innerX + 6, innerY + innerH - 6);
  actx.restore();

  actx.restore(); // from the very first save
}

// small helper to draw rounded rect (with fill + optional stroke)
function roundRect(ctxX, x, y, w, h, r, fill, stroke) {
  if (typeof r === 'undefined') r = 5;
  if (typeof r === 'number') r = { tl: r, tr: r, br: r, bl: r };
  ctxX.beginPath();
  ctxX.moveTo(x + r.tl, y);
  ctxX.lineTo(x + w - r.tr, y);
  ctxX.quadraticCurveTo(x + w, y, x + w, y + r.tr);
  ctxX.lineTo(x + w, y + h - r.br);
  ctxX.quadraticCurveTo(x + w, y + h, x + w - r.br, y + h);
  ctxX.lineTo(x + r.bl, y + h);
  ctxX.quadraticCurveTo(x, y + h, x, y + h - r.bl);
  ctxX.lineTo(x, y + r.tl);
  ctxX.quadraticCurveTo(x, y, x + r.tl, y);
  ctxX.closePath();
  if (fill) ctxX.fill();
  if (stroke) ctxX.stroke();
}

// ---------------------------
// (Mantengo resto de funciones: drawPaperClips, drawField, drawCompass, drawFieldMeter...)
// Copié/pegado tus implementaciones previas para mantener todo igual.
// ---------------------------

function drawPaperClips() {
  paperClips.forEach(clip => {
    ctx.fillStyle = clip.isAttached ? '#CCCCCC' : '#AAAAAA';
    ctx.strokeStyle = '#555555';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.rect(clip.x - clip.width / 2, clip.y - clip.height / 2, clip.width, clip.height);
    ctx.fill();
    ctx.stroke();
  });
}

function drawField(current) {
  if (!showFieldCheck.checked) return;
  const gridSize = 50;
  const needleLength = 15;
  const absCurrent = Math.abs(current);
  for (let x = 0; x < canvas.width; x += gridSize) {
    for (let y = 0; y < canvas.height; y += gridSize) {
      if (x > solenoid.x - solenoid.radius && x < solenoid.x + solenoid.radius && y > solenoid.y - solenoid.length / 2 && y < solenoid.y + solenoid.length / 2) {
        continue;
      }
      const { Bx, By } = getMagneticFieldAt(x, y, current);
      const angle = Math.atan2(By, Bx);
      const magnitude = Math.sqrt(Bx * Bx + By * By);
      const opacityDivisor = hasCore ? 200000 : 200;
      let opacity = Math.min(magnitude / opacityDivisor, 1);
      opacity = opacity * Math.min(absCurrent / 5, 1);
      if (opacity < 0.05) continue;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.globalAlpha = opacity;
      ctx.strokeStyle = "#dc3545";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(needleLength, 0);
      ctx.stroke();
      ctx.strokeStyle = "#FFF";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-needleLength, 0);
      ctx.stroke();
      ctx.restore();
    }
  }
}

function drawCompass(current) {
  if (!showCompassCheck.checked) return;
  const { Bx, By } = getMagneticFieldAt(compass.x, compass.y, current);
  const angle = Math.atan2(By, Bx);
  const magnitude = Math.sqrt(Bx * Bx + By * By);
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 15;
  ctx.translate(compass.x, compass.y);
  const baseGradient = ctx.createRadialGradient(0, 0, compass.radius * 0.8, 0, 0, compass.radius);
  baseGradient.addColorStop(0, '#666');
  baseGradient.addColorStop(0.8, '#333');
  baseGradient.addColorStop(1, '#222');
  ctx.fillStyle = baseGradient;
  ctx.strokeStyle = "#CCC";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, compass.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.save();
  ctx.rotate(angle);
  const opacityDivisor = hasCore ? 200000 : 200;
  let opacity = Math.min(magnitude / opacityDivisor, 1);
  ctx.globalAlpha = opacity;
  ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
  ctx.shadowBlur = 10;
  const needleLength = compass.radius * 0.9;
  let gradN = ctx.createLinearGradient(0, -3, 0, 3);
  gradN.addColorStop(0, '#ff6b6b');
  gradN.addColorStop(1, '#dc3545');
  ctx.fillStyle = gradN;
  ctx.beginPath();
  ctx.moveTo(0, -5);
  ctx.lineTo(needleLength, 0);
  ctx.lineTo(0, 5);
  ctx.closePath();
  ctx.fill();
  let gradS = ctx.createLinearGradient(0, -3, 0, 3);
  gradS.addColorStop(0, '#FFFFFF');
  gradS.addColorStop(1, '#DDDDDD');
  ctx.fillStyle = gradS;
  ctx.beginPath();
  ctx.moveTo(0, 5);
  ctx.lineTo(-needleLength, 0);
  ctx.lineTo(0, -5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
}

function drawFieldMeter(current) {
  if (!fieldMeterCheck.checked) return;
  const { Bx: Bx_raw, By: By_raw } = getMagneticFieldAt(fieldMeter.x, fieldMeter.y, current);
  const SCALING_FACTOR = hasCore ? 60000 : 60;
  const B_total = Math.sqrt(Bx_raw * Bx_raw + By_raw * By_raw) / SCALING_FACTOR;
  const Bx_display = Bx_raw / SCALING_FACTOR;
  const By_display = By_raw / SCALING_FACTOR;
  let angle_deg = Math.atan2(By_raw, Bx_raw) * (180 / Math.PI);
  ctx.save();
  ctx.translate(fieldMeter.x, fieldMeter.y);
  ctx.strokeStyle = "#00FFFF";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, fieldMeter.radius * 0.6, 0, Math.PI * 2);
  ctx.stroke();
  const B_total_text = B_total > 100 ? B_total.toFixed(0) : B_total.toFixed(2);
  const Bx_text = Bx_display > 100 ? Bx_display.toFixed(0) : Bx_display.toFixed(2);
  const By_text = By_display > 100 ? By_display.toFixed(0) : By_display.toFixed(2);
  const texts = [`B: ${B_total_text} G`, `Bx: ${Bx_text} G`, `By: ${By_text} G`, `θ: ${angle_deg.toFixed(1)}°`];
  const boxX = 20;
  const boxY = -50;
  const boxWidth = 100;
  const boxHeight = 100;
  const lineHeight = 25;
  ctx.shadowColor = "black";
  ctx.shadowBlur = 10;
  const boxGrad = ctx.createLinearGradient(boxX, boxY, boxX, boxY + boxHeight);
  boxGrad.addColorStop(0, '#003d7a');
  boxGrad.addColorStop(1, '#001a36');
  ctx.fillStyle = boxGrad;
  ctx.strokeStyle = "#00FFFF";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(boxX, boxY);
  ctx.lineTo(boxX + boxWidth, boxY);
  ctx.lineTo(boxX + boxWidth, boxY + boxHeight);
  ctx.lineTo(boxX, boxY + boxHeight);
  ctx.lineTo(boxX, boxY);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "white";
  ctx.font = "bold 14px Inter";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "transparent";
  for (let i = 0; i < texts.length; i++) {
    ctx.fillText(texts[i], boxX + 10, boxY + (lineHeight * (i + 0.5)));
  }
  ctx.restore();
}

// ---------------------------
// Lógica de la Grúa y Sonido (mantengo tu implementación)
// ---------------------------
function updateCraneLogic(current) {
  const absCurrent = Math.abs(current);
  const isMagnetOn = !isAC && absCurrent > 0.1 && hasCore;
  const tipX = solenoid.x;
  const tipY = solenoid.y + solenoid.length / 2;
  const pickupRadius = solenoid.radius * 0.8;
  paperClips.forEach(clip => {
    if (clip.isAttached) {
      if (isMagnetOn) {
        clip.x = solenoid.x + clip.offsetX;
        clip.y = solenoid.y + clip.offsetY;
      } else {
        clip.isAttached = false;
        audioClack.currentTime = 0;
        audioClack.play();
      }
    } else {
      if (isMagnetOn) {
        const dx = tipX - clip.x;
        const dy = tipY - clip.y;
        if (Math.abs(dx) < pickupRadius && Math.abs(dy) < 20) {
          clip.isAttached = true;
          clip.offsetX = clip.x - solenoid.x;
          clip.offsetY = clip.y - solenoid.y;
          audioClack.currentTime = 0;
          audioClack.play();
        }
      }
    }
  });
}

function updateSoundLogic(current) {
  const absCurrent = Math.abs(current);
  const shouldHum = !isAC && absCurrent > 0.1 && hasCore;
  if (shouldHum && !isHumming) {
    audioHum.play();
    isHumming = true;
  } else if (!shouldHum && isHumming) {
    audioHum.pause();
    audioHum.currentTime = 0;
    isHumming = false;
  }
}

function playClickSound() {
  audioClick.currentTime = 0;
  audioClick.play();
}

// ---------------------------
// MAIN LOOP
// ---------------------------
function drawSimulator(timestamp) {
  const current = getCurrent(time);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (showFieldCheck.checked) {
    drawField(current);
  }

  drawSolenoid(current);
  drawPaperClips();

  // lógicas
  updateCraneLogic(current);
  updateSoundLogic(current);

  if (!isAC) {
    drawDCPower(current);
  } else {
    drawACGraph(); // nuestro osciloscopio PRO
  }

  if (showCompassCheck.checked) {
    drawCompass(current);
  }
  if (fieldMeterCheck.checked) {
    drawFieldMeter(current);
  }

  if (!isPaused) {
    // avance de tiempo: cuidamos dt en caso de salto
    time += 1 / 60;
  }

  requestAnimationFrame(drawSimulator);
}

// ---------------------------
// EVENT LISTENERS (Controles)
// ---------------------------

// a) Selector AC/DC
dcButton.addEventListener("click", () => {
  isAC = false;
  dcButton.classList.add("active-source");
  acButton.classList.remove("active-source");
  dcPowerPanel.style.display = "block";
  acPowerPanel.style.display = "none";
  isPaused = true;
  updateControlButtons();
  playClickSound();
  if (isHumming) {
    audioHum.pause();
    isHumming = false;
  }
});

acButton.addEventListener("click", () => {
  isAC = true;
  dcButton.classList.remove("active-source");
  acButton.classList.add("active-source");
  dcPowerPanel.style.display = "none";
  acPowerPanel.style.display = "block";
  time = 0;
  paperClips.forEach(clip => clip.isAttached = false);
  isPaused = true;
  updateControlButtons();
  playClickSound();
  if (isHumming) {
    audioHum.pause();
    isHumming = false;
  }
});

// b) Control DC
dcVoltageSlider.addEventListener("input", (e) => {
  V = Math.round(parseFloat(e.target.value));
  dcVoltageValue.textContent = V.toFixed(0);
});

// c) Controles AC
acAmplitudeSlider.addEventListener("input", (e) => {
  amplitude = parseFloat(e.target.value);
  acAmplitudeValue.textContent = `${amplitude.toFixed(1)} A`;
});

acFrequencySlider.addEventListener("input", (e) => {
  frequency = parseFloat(e.target.value);
  acFrequencyValue.textContent = `${frequency.toFixed(1)} Hz`;
});

// d) Control de Espiras (N)
turnsSelect.addEventListener("change", (e) => {
  N_coils = parseInt(e.target.value);
  playClickSound();
});

// e) Control del Núcleo de Hierro
showCoreCheck.addEventListener("change", (e) => {
  hasCore = e.target.checked;
  playClickSound();
});

// Listeners para los checkboxes (para el sonido de clic)
showElectronsCheck.addEventListener("change", playClickSound);
showFieldCheck.addEventListener("change", playClickSound);
showCompassCheck.addEventListener("change", playClickSound);
fieldMeterCheck.addEventListener("change", playClickSound);

// Función para (re)crear los clips
function initializeClips() {
  paperClips = [];
  paperClips.push({
    x: canvas.width * 0.4,
    y: canvas.height - 40,
    width: 40,
    height: 15,
    isAttached: false,
    offsetX: 0,
    offsetY: 0
  });
  paperClips.push({
    x: canvas.width * 0.6,
    y: canvas.height - 40,
    width: 40,
    height: 15,
    isAttached: false,
    offsetX: 0,
    offsetY: 0
  });
}

// f) Reset
function resetSimulator() {
  isAC = false;
  V = 5;
  N_coils = 4;
  time = 0;
  amplitude = 5;
  frequency = 0.5;
  hasCore = false;
  isPaused = true;

  dcVoltageSlider.value = V;
  dcVoltageValue.textContent = V.toFixed(0);
  acAmplitudeSlider.value = amplitude;
  acAmplitudeValue.textContent = `${amplitude.toFixed(1)} A`;
  acFrequencySlider.value = frequency;
  acFrequencyValue.textContent = `${frequency.toFixed(1)} Hz`;
  turnsSelect.value = N_coils;

  dcButton.click();

  solenoid.x = canvas.width / 3;
  solenoid.y = canvas.height / 2;
  compass.x = canvas.width * 0.75;
  compass.y = canvas.height * 0.75;
  fieldMeter.x = canvas.width * 0.25;
  fieldMeter.y = canvas.height * 0.75;

  showElectronsCheck.checked = true;
  showFieldCheck.checked = true;
  showCompassCheck.checked = true;
  fieldMeterCheck.checked = false;
  showCoreCheck.checked = false;

  initializeClips();

  if (isHumming) {
    audioHum.pause();
    isHumming = false;
  }
}
resetBtn.addEventListener("click", resetSimulator);

// g) Lógica de Arrastre
canvas.addEventListener("mousedown", (e) => {
  let didClickOnObject = false;
  const checkDrag = (obj, event) => {
    const dx = event.offsetX - obj.x;
    const dy = event.offsetY - obj.y;
    if (Math.sqrt(dx * dx + dy * dy) <= obj.radius * (obj === fieldMeter ? 2 : 1.5) ||
      (obj === solenoid && event.offsetX >= solenoid.x - solenoid.radius && event.offsetX <= solenoid.x + solenoid.radius &&
        event.offsetY >= solenoid.y - solenoid.length / 2 && event.offsetY <= solenoid.y + solenoid.length / 2)) {
      obj.dragging = true;
      obj.offsetX = event.offsetX - obj.x;
      obj.offsetY = event.offsetY - obj.y;
      return true;
    }
    return false;
  };
  if (showCompassCheck.checked && checkDrag(compass, e)) didClickOnObject = true;
  if (!didClickOnObject && fieldMeterCheck.checked && checkDrag(fieldMeter, e)) didClickOnObject = true;
  if (!didClickOnObject && checkDrag(solenoid, e)) didClickOnObject = true;
  if (didClickOnObject) {
    canvas.style.cursor = "grabbing";
  }
});
canvas.addEventListener("mouseup", () => {
  solenoid.dragging = false;
  compass.dragging = false;
  fieldMeter.dragging = false;
  canvas.style.cursor = "default";
});
canvas.addEventListener("mousemove", (e) => {
  if (solenoid.dragging) {
    solenoid.x = e.offsetX - solenoid.offsetX;
    solenoid.y = e.offsetY - solenoid.offsetY;
  } else if (compass.dragging) {
    compass.x = e.offsetX - compass.offsetX;
    compass.y = e.offsetY - compass.offsetY;
  } else if (fieldMeter.dragging) {
    fieldMeter.x = e.offsetX - fieldMeter.offsetX;
    fieldMeter.y = e.offsetY - fieldMeter.offsetY;
  }
});

// h) Ajuste de tamaño de ventana
window.addEventListener('resize', () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  // refresh oscilloscope canvas too
  setupACCanvas();
  resetSimulator();
});

// i) Lógica de Control de Tiempo (Pausa/Play/Step)
function updateControlButtons() {
  if (isPaused) {
    pauseBtn.classList.add("active-control");
    pauseBtn.classList.remove("inactive-control");
    playBtn.classList.remove("active-control");
    playBtn.classList.add("inactive-control");
    stepBtn.disabled = false;
    stepBtn.style.opacity = 1;
  } else {
    pauseBtn.classList.remove("active-control");
    pauseBtn.classList.add("inactive-control");
    playBtn.classList.add("active-control");
    playBtn.classList.remove("inactive-control");
    stepBtn.disabled = true;
    stepBtn.style.opacity = 0.5;
  }
}
pauseBtn.addEventListener("click", () => {
  isPaused = true;
  updateControlButtons();
  playClickSound();
});
playBtn.addEventListener("click", () => {
  isPaused = false;
  updateControlButtons();
  playClickSound();
});
stepBtn.addEventListener("click", () => {
  if (isPaused) {
    time += 1 / 60;
  }
  playClickSound();
});

// START
resetSimulator();
requestAnimationFrame(drawSimulator);
