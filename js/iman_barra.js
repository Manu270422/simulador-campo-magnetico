// =================================
// Simulador: IMÁN DE BARRA (v5.0 - Pulido y Brújula Mejorada)
// Mejoras: Visualización de Densidad de Flujo (Grosor de Agujas), Brújula Pulida.
// =================================

// --- 1. CONFIGURACIÓN INICIAL ---
const invertPolarityBtn = document.getElementById("invertPolarity");
const intensitySlider = document.getElementById("intensity");
const resetBtn = document.getElementById("resetBtn");
const showFieldCheck = document.getElementById("showField");
const showCompassCheck = document.getElementById("showCompass");
const fieldMeterCheck = document.getElementById("fieldMeter");
const earthFieldCheck = document.getElementById("earthField");
const seeInsideCheck = document.getElementById("seeInside");
const showFilingsCheck = document.getElementById("showFilings");
const showCoilCheck = document.getElementById("showCoil");
const invertCoilBtn = document.getElementById("invertCoil");
const canvas = document.getElementById("sim-canvas");
const ctx = canvas.getContext("2d");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Audio
const clack = new Audio('assets/audio/clack.mp3');
const click = new Audio('assets/audio/click.mp3');
const hum = new Audio('assets/audio/hum.mp3');
hum.loop = true;

// Cargar la imagen del planeta
const earthImage = new Image();
earthImage.src = 'assets/planeta_tierra.png';
let earthImageLoaded = false;
earthImage.onload = () => { earthImageLoaded = true; };
earthImage.onerror = () => {
  console.error("¡Error! No se pudo cargar 'assets/planeta_tierra.png'. Se usará un color azul como fallback.");
};

// --- 2. ESTADO DEL SIMULADOR ---
let polarity = 1;
let intensity = 75;
let magnet = {
  x: canvas.width / 2 - 100,
  y: canvas.height / 2 - 25,
  width: 200,
  height: 50,
  cornerRadius: 10,
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
let earth = {
  x: canvas.width / 2,
  y: canvas.height / 2,
  radius: Math.min(canvas.width, canvas.height) * 0.35,
  dragging: false,
  offsetX: 0,
  offsetY: 0
};

// Estado del Motor Simple (Bobina)
let coilCurrent = 1; // 1 para ->, -1 para <-
let bobina = {
  x_base: canvas.width / 2,
  y_base: canvas.height * 0.2,
  x: canvas.width / 2,
  y: canvas.height * 0.2,
  width: 150,
  height: 70,
  mass: 1.0,
  y_vel: 0,
  y_accel: 0,
  dragging: false,
  offsetX: 0,
  offsetY: 0
};

// Constantes de la simulación de física (Resorte + Amortiguador)
const DT = 1 / 60;
const K_SPRING = 0.08;
const K_DAMPING = 0.15;
const K_FORCE_BASE = -80;
const MAX_ACCEL = 2000;
const MAX_VEL = 60;
const BY_CLAMP = 200;

// --- 3. EL "CEREBRO" (La Física) ---
function getMagneticFieldAt(x, y) {
  let Bx_total = 0;
  let By_total = 0;

  // --- Parte A: Campo del Imán (Dipolo Magnético Simplificado) ---
  if (!earthFieldCheck.checked) {
    // K_STRENGTH ajustada para que las agujas se vean bien
    const K_STRENGTH = 100000; 
    const strength = (intensity / 100) * K_STRENGTH * polarity;
    const poleN_x = magnet.x + magnet.width * 0.75;
    const poleS_x = magnet.x + magnet.width * 0.25;
    const pole_y = magnet.y + magnet.height / 2;

    // Polo Norte
    const dx_N = x - poleN_x;
    const dy_N = y - pole_y;
    let r_N_sq = dx_N * dx_N + dy_N * dy_N;
    r_N_sq = Math.max(r_N_sq, 100);
    const r_N = Math.sqrt(r_N_sq);
    const Bx_N = (strength * dx_N) / (r_N * r_N_sq);
    const By_N = (strength * dy_N) / (r_N * r_N_sq);

    // Polo Sur
    const dx_S = x - poleS_x;
    const dy_S = y - pole_y;
    let r_S_sq = dx_S * dx_S + dy_S * dy_S;
    r_S_sq = Math.max(r_S_sq, 100);
    const r_S = Math.sqrt(r_S_sq);
    const Bx_S = (-strength * dx_S) / (r_S * r_S_sq); // Polaridad opuesta al polo N
    const By_S = (-strength * dy_S) / (r_S * r_S_sq);

    Bx_total = Bx_N + Bx_S;
    By_total = By_N + By_S;
  }

  // --- Parte B: Campo de la Tierra ---
  // (Lógica de la Tierra se mantiene igual)
  if (earthFieldCheck.checked) {
    const K_EARTH_STRENGTH = 2000000;
    const poleDist = (earth.radius * 0.75);
    const earth_poleS_x = earth.x;
    const earth_poleS_y = earth.y - poleDist;
    const earth_poleN_x = earth.x;
    const earth_poleN_y = earth.y + poleDist;

    const dx_N = x - earth_poleN_x;
    const dy_N = y - earth_poleN_y;
    let r_N_sq = dx_N * dx_N + dy_N * dy_N;
    r_N_sq = Math.max(r_N_sq, 10000);
    const r_N = Math.sqrt(r_N_sq);
    const Bx_N_Earth = (K_EARTH_STRENGTH * dx_N) / (r_N * r_N_sq);
    const By_N_Earth = (K_EARTH_STRENGTH * dy_N) / (r_N * r_N_sq);

    const dx_S = x - earth_poleS_x;
    const dy_S = y - earth_poleS_y;
    let r_S_sq = dx_S * dx_S + dy_S * dy_S;
    r_S_sq = Math.max(r_S_sq, 10000);
    const r_S = Math.sqrt(r_S_sq);
    const Bx_S_Earth = (-K_EARTH_STRENGTH * dx_S) / (r_S * r_S_sq);
    const By_S_Earth = (-K_EARTH_STRENGTH * dy_S) / (r_S * r_S_sq);

    Bx_total = Bx_N_Earth + Bx_S_Earth;
    By_total = By_N_Earth + By_S_Earth;
  }

  // Protecciones finales: evitar NaN/Infinito y clamping
  if (!isFinite(Bx_total)) Bx_total = 0;
  if (!isFinite(By_total)) By_total = 0;

  // Limitar magnitud para evitar fuerzas extremas
  Bx_total = Math.max(-BY_CLAMP, Math.min(BY_CLAMP, Bx_total));
  By_total = Math.max(-BY_CLAMP, Math.min(BY_CLAMP, By_total));

  return { Bx: Bx_total, By: By_total };
}

// --- 4. FUNCIONES DE DIBUJO ---
// (drawRoundRect, drawGlossyRect, drawEarth, drawMagnet, drawCoil se mantienen iguales)
function drawRoundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.arcTo(x + width, y, x + width, y + radius, radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
  ctx.lineTo(x + radius, y + height);
  ctx.arcTo(x, y + height, x, y + height - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
}
function drawGlossyRect(ctx, x, y, width, height, radius, colorLight, colorDark, roundTop, roundBottom) {
  const gradient = ctx.createLinearGradient(x, y, x, y + height);
  gradient.addColorStop(0, colorLight);
  gradient.addColorStop(1, colorDark);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(x + (roundTop ? radius : 0), y);
  ctx.lineTo(x + width - (roundTop ? radius : 0), y);
  if (roundTop) ctx.arcTo(x + width, y, x + width, y + radius, radius);
  else ctx.lineTo(x + width, y);
  ctx.lineTo(x + width, y + height - (roundBottom ? radius : 0));
  if (roundBottom) ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
  else ctx.lineTo(x + width, y + height);
  ctx.lineTo(x + (roundBottom ? radius : 0), y + height);
  if (roundBottom) ctx.arcTo(x, y + height, x, y + height - radius, radius);
  else ctx.lineTo(x, y + height);
  ctx.lineTo(x, y + (roundTop ? radius : 0));
  if (roundTop) ctx.arcTo(x, y, x + radius, y, radius);
  else ctx.lineTo(x, y);
  ctx.closePath();
  ctx.fill();
  const glossGradient = ctx.createLinearGradient(x, y, x, y + height * 0.4);
  glossGradient.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
  glossGradient.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
  ctx.fillStyle = glossGradient;
  ctx.fill();
}
function drawEarth() {
  if (!earthFieldCheck.checked) return;
  const centerX = earth.x;
  const centerY = earth.y;
  const earthRadius = earth.radius;
  ctx.save();
  ctx.globalAlpha = 0.6;
  if (earthImageLoaded) {
    ctx.beginPath();
    ctx.arc(centerX, centerY, earthRadius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.save();
    ctx.clip();
    ctx.drawImage(earthImage, centerX - earthRadius, centerY - earthRadius, earthRadius * 2, earthRadius * 2);
    ctx.restore();
  } else {
    const earthGradient = ctx.createRadialGradient(centerX - earthRadius * 0.3, centerY - earthRadius * 0.3, earthRadius * 0.1, centerX, centerY, earthRadius);
    earthGradient.addColorStop(0, '#87CEEB');
    earthGradient.addColorStop(1, '#4682B4');
    ctx.fillStyle = earthGradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, earthRadius, 0, Math.PI * 2);
    ctx.fill();
  }
  const innerShadow = ctx.createRadialGradient(centerX, centerY, earthRadius * 0.9, centerX, centerY, earthRadius);
  innerShadow.addColorStop(0, 'rgba(0,0,0,0)');
  innerShadow.addColorStop(1, 'rgba(0,0,0,0.6)');
  ctx.fillStyle = innerShadow;
  ctx.beginPath();
  ctx.arc(centerX, centerY, earthRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1.0;
  ctx.translate(centerX, centerY);
  const earthMagnetWidth = 40;
  const earthMagnetHeight = earth.radius * 1.5;
  const earthMagnetRadius = 8;
  const earthMagnetX = -earthMagnetWidth / 2;
  const earthMagnetY = -earthMagnetHeight / 2;
  drawGlossyRect(ctx, earthMagnetX, earthMagnetY, earthMagnetWidth, earthMagnetHeight / 2, earthMagnetRadius, '#007bff', '#004899', true, false);
  drawGlossyRect(ctx, earthMagnetX, earthMagnetY + earthMagnetHeight / 2, earthMagnetWidth, earthMagnetHeight / 2, earthMagnetRadius, '#dc3545', '#8f1b2d', false, true);
  ctx.fillStyle = "white";
  ctx.font = "bold 20px Orbitron";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = 'rgba(0,0,0,0.7)';
  ctx.shadowBlur = 5;
  ctx.fillText("S", 0, -earthMagnetHeight * 0.25);
  ctx.fillText("N", 0, earthMagnetHeight * 0.25);
  ctx.restore();
}

function drawMagnet() {
  if (earthFieldCheck.checked) return;
  const x = magnet.x;
  const y = magnet.y;
  const width = magnet.width;
  const height = magnet.height;
  const radius = magnet.cornerRadius;
  ctx.save();
  ctx.shadowColor = (polarity === 1) ? 'rgba(220, 53, 69, 0.7)' : 'rgba(0, 123, 255, 0.7)';
  ctx.shadowBlur = 20;
  const poleS_colors = (polarity === 1) ? ['#007bff', '#004899'] : ['#dc3545', '#8f1b2d'];
  const poleN_colors = (polarity === 1) ? ['#dc3545', '#8f1b2d'] : ['#007bff', '#004899'];
  drawGlossyRect(ctx, x, y, width / 2, height, radius, poleS_colors[0], poleS_colors[1], true, true);
  drawGlossyRect(ctx, x + width / 2, y, width / 2, height, radius, poleN_colors[0], poleN_colors[1], true, true);
  ctx.restore();
  ctx.save();
  ctx.fillStyle = "white";
  ctx.font = "bold 28px Orbitron";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
  ctx.shadowBlur = 5;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 1;
  const sText = (polarity === 1) ? "S" : "N";
  const nText = (polarity === 1) ? "N" : "S";
  ctx.fillText(sText, x + width * 0.25, y + height / 2);
  ctx.fillText(nText, x + width * 0.75, y + height / 2);
  ctx.restore();
}

function drawCoil() {
  if (!showCoilCheck.checked) return;

  const x = bobina.x;
  const y = bobina.y;
  const width = bobina.width;
  const height = bobina.height;
  const battWidth = 40;
  const battHeight = 60;

  ctx.save();

  // 1. Dibujar Batería
  const battX = x - width / 2 - battWidth - 10;
  const battY = y - battHeight / 2;
  ctx.fillStyle = '#333';
  ctx.fillRect(battX, battY, battWidth, battHeight);
  // Polo Positivo (Rojo)
  ctx.fillStyle = '#dc3545';
  ctx.fillRect(battX, battY, battWidth, 15);
  ctx.fillStyle = 'white';
  ctx.font = 'bold 14px Inter';
  ctx.textAlign = 'center';
  ctx.fillText('+', battX + battWidth / 2, battY + 10);
  // Polo Negativo (Azul)
  ctx.fillStyle = '#007bff';
  ctx.fillRect(battX, battY + battHeight - 15, battWidth, 15);
  ctx.fillStyle = 'white';
  ctx.fillText('–', battX + battWidth / 2, battY + battHeight - 8);

  // 2. Dibujar Bobina (Rectángulo simple)
  ctx.strokeStyle = '#D2691E'; // Cobre
  ctx.lineWidth = 8;
  ctx.strokeRect(x - width / 2, y - height / 2, width, height);

  // 3. Dibujar Conexiones
  ctx.strokeStyle = '#555'; // Cable
  ctx.lineWidth = 4;
  // Conexión superior (Polo + o -)
  ctx.beginPath();
  ctx.moveTo(battX + battWidth, battY + 7.5);
  ctx.lineTo(x - width / 2, y - height / 2);
  ctx.stroke();
  // Conexión inferior (Polo - o +)
  ctx.beginPath();
  ctx.moveTo(battX + battWidth, battY + battHeight - 7.5);
  ctx.lineTo(x - width / 2, y + height / 2);
  ctx.stroke();

  // 4. Dibujar Flechas de Corriente
  ctx.fillStyle = 'white';
  ctx.font = 'bold 16px Inter';
  const arrowText = coilCurrent === 1 ? '→ I →' : '← I ←';
  const revArrowText = coilCurrent === 1 ? '← I ←' : '→ I →';
  ctx.fillText(arrowText, x, y - height / 2 - 10);
  ctx.fillText(revArrowText, x, y + height / 2 + 15);

  ctx.restore();
}

function drawIronFilings() {
  const gridSize = 15;
  const jitter = 10;
  const filingLength = 10;
  ctx.strokeStyle = "rgba(200, 200, 200, 0.7)";
  ctx.lineWidth = 1;

  for (let x = 0; x < canvas.width; x += gridSize) {
    for (let y = 0; y < canvas.height; y += gridSize) {
      if (!seeInsideCheck.checked &&
          x > magnet.x && x < magnet.x + magnet.width &&
          y > magnet.y && y < magnet.y + magnet.height) {
        continue;
      }
      const drawX = x + Math.random() * jitter - jitter / 2;
      const drawY = y + Math.random() * jitter - jitter / 2;
      const { Bx, By } = getMagneticFieldAt(drawX, drawY);
      const angle = Math.atan2(By, Bx);
      const magnitude = Math.sqrt(Bx*Bx + By*By);
      let opacity = Math.min(magnitude / (earthFieldCheck.checked ? 150 : 50), 1);
      opacity = Math.max(0.1, opacity);
      if (opacity < 0.1) continue;

      ctx.save();
      ctx.translate(drawX, drawY);
      ctx.rotate(angle);
      ctx.globalAlpha = opacity;
      ctx.beginPath();
      ctx.moveTo(-filingLength / 2, 0);
      ctx.lineTo(filingLength / 2, 0);
      ctx.stroke();
      ctx.restore();
    }
  }
}

// ¡MEJORADO! Visualización de Densidad con Agujas
function drawFieldNeedles() {
  const gridSize = 40; // Mayor densidad de agujas
  const baseLength = 15;
  const maxMagnitude = earthFieldCheck.checked ? 300 : 200; // Normalización

  for (let x = 0; x < canvas.width; x += gridSize) {
    for (let y = 0; y < canvas.height; y += gridSize) {
      
      // No dibujar dentro del imán principal si no se ve el interior
      if (!earthFieldCheck.checked) {
        if (!seeInsideCheck.checked &&
            x > magnet.x && x < magnet.x + magnet.width &&
            y > magnet.y && y < magnet.y + magnet.height) {
          continue;
        }
      }

      const { Bx, By } = getMagneticFieldAt(x, y);
      const magnitude = Math.sqrt(Bx * Bx + By * By);
      
      // Normalizar para obtener opacidad y grosor
      const normalizedMagnitude = Math.min(magnitude / maxMagnitude, 1);
      if (normalizedMagnitude < 0.05) continue; // No dibujar campos muy débiles

      const angle = Math.atan2(By, Bx);
      
      // Grosor y Opacidad escalan con la magnitud (DENSIDAD DE FLUJO)
      const needleWidth = 1 + normalizedMagnitude * 2.5; // De 1 a 3.5
      const opacity = normalizedMagnitude * 0.9;
      const needleLength = baseLength;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.globalAlpha = opacity;
      ctx.lineWidth = needleWidth;

      // Polo Norte de la aguja (Apuntando en dirección B, color Rojo/Sur-buscador)
      ctx.strokeStyle = "#dc3545"; 
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(needleLength, 0);
      ctx.stroke();

      // Polo Sur de la aguja (Opuesto, color Azul/Norte-buscador)
      ctx.strokeStyle = "#007bff";
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-needleLength, 0);
      ctx.stroke();

      // Punto central
      ctx.fillStyle = "white";
      ctx.beginPath();
      ctx.arc(0, 0, 1.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }
}


function drawFieldInside() {
  if (!seeInsideCheck.checked || earthFieldCheck.checked || showFilingsCheck.checked) return;
  const gridSize = 25;
  const needleLength = 10;
  const angle = (polarity === 1) ? 0 : Math.PI; // El campo es de S a N dentro del imán
  for (let x = magnet.x; x < magnet.x + magnet.width; x += gridSize) {
    for (let y = magnet.y; y < magnet.y + magnet.height; y += gridSize) {
      if (x < magnet.x + 10 || x > magnet.x + magnet.width - 10 ||
          y < magnet.y + 10 || y > magnet.y + magnet.height - 10) {
        continue;
      }
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = "#dc3545";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(needleLength, 0);
      ctx.stroke();
      ctx.strokeStyle = "#FFF";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-needleLength, 0);
      ctx.stroke();
      ctx.restore();
    }
  }
}

function drawEarthFieldInside() {
  if (!seeInsideCheck.checked || !earthFieldCheck.checked) return;
  const gridSize = 20;
  const needleLength = 8;
  const angle = Math.PI / 2;
  const earthMagnetWidth = 40;
  const earthMagnetHeight = earth.radius * 1.5;
  const earthMagnetX = earth.x - earthMagnetWidth / 2;
  const earthMagnetY = earth.y - earthMagnetHeight / 2;
  ctx.save();
  ctx.globalAlpha = 0.6;
  for (let x = earthMagnetX + 5; x < earthMagnetX + earthMagnetWidth - 5; x += gridSize) {
    for (let y = earthMagnetY + 5; y < earthMagnetY + earthMagnetHeight - 5; y += gridSize) {
      ctx.save();
      ctx.translate(x + (gridSize/2), y + (gridSize/2));
      ctx.rotate(angle);
      ctx.strokeStyle = "#dc3545";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(needleLength, 0);
      ctx.stroke();
      ctx.strokeStyle = "#FFF";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-needleLength, 0);
      ctx.stroke();
      ctx.restore();
    }
  }
  ctx.restore();
}

// ¡MEJORADO! Brújula Interactiva
function drawCompass() {
  if (!showCompassCheck.checked) return;
  const { Bx, By } = getMagneticFieldAt(compass.x, compass.y);
  const angle = Math.atan2(By, Bx); // Ángulo del campo B
  const magnitude = Math.sqrt(Bx * Bx + By * By);
  
  // Opacidad basada en la magnitud del campo
  let opacity = Math.min(magnitude / (earthFieldCheck.checked ? 200 : 100), 1);
  opacity = Math.max(0.2, opacity);

  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 15;
  ctx.translate(compass.x, compass.y);
  
  // 1. Base del Compás (Caja)
  const baseGradient = ctx.createRadialGradient(0, 0, compass.radius * 0.8, 0, 0, compass.radius);
  baseGradient.addColorStop(0, '#555');
  baseGradient.addColorStop(0.8, '#333');
  baseGradient.addColorStop(1, '#222');
  ctx.fillStyle = baseGradient;
  ctx.strokeStyle = "#999";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, compass.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // 2. Aguja del Compás
  ctx.save();
  ctx.rotate(angle); // Rotación según el campo magnético B
  ctx.globalAlpha = opacity;
  ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
  ctx.shadowBlur = 10;
  const needleLength = compass.radius * 0.9;
  const needleWidth = 5;

  // Extremo Norte (Polo Sur buscador, apunta a B) - Rojo
  ctx.fillStyle = '#dc3545';
  ctx.beginPath();
  ctx.moveTo(0, -needleWidth);
  ctx.lineTo(needleLength, 0);
  ctx.lineTo(0, needleWidth);
  ctx.closePath();
  ctx.fill();

  // Extremo Sur (Polo Norte buscador) - Azul
  ctx.fillStyle = '#007bff';
  ctx.beginPath();
  ctx.moveTo(0, needleWidth);
  ctx.lineTo(-needleLength, 0);
  ctx.lineTo(0, -needleWidth);
  ctx.closePath();
  ctx.fill();
  
  ctx.restore(); // Restaurar rotación

  // 3. Eje Central (Pivot)
  ctx.fillStyle = "#111";
  ctx.beginPath();
  ctx.arc(0, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  
  // 4. Letras de Orientación (Estáticas)
  ctx.fillStyle = "white";
  ctx.font = "bold 12px Inter";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = 'rgba(0, 0, 0, 1)';
  ctx.shadowBlur = 3;
  ctx.fillText("N", 0, -compass.radius * 0.7);
  ctx.fillText("S", 0, compass.radius * 0.7);
  ctx.fillText("E", compass.radius * 0.7, 0);
  ctx.fillText("O", -compass.radius * 0.7, 0);
  
  ctx.restore();
}

function drawFieldMeter() {
  if (!fieldMeterCheck.checked) return;
  const { Bx: Bx_raw, By: By_raw } = getMagneticFieldAt(fieldMeter.x, fieldMeter.y);
  // Se usa un factor de escala para que se asemeje a microTesla (uT) o algo legible.
  const SCALING_FACTOR = earthFieldCheck.checked ? 10 : 30; 
  const B_total = Math.sqrt(Bx_raw * Bx_raw + By_raw * By_raw) / SCALING_FACTOR;
  const Bx_display = Bx_raw / SCALING_FACTOR;
  const By_display = By_raw / SCALING_FACTOR;
  let angle_deg = Math.atan2(By_raw, Bx_raw) * (180 / Math.PI);
  
  ctx.save();
  ctx.translate(fieldMeter.x, fieldMeter.y);
  // ... (código de dibujo del medidor se mantiene igual)
  ctx.strokeStyle = "#00FFFF";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, -fieldMeter.radius);
  ctx.lineTo(0, fieldMeter.radius);
  ctx.moveTo(-fieldMeter.radius, 0);
  ctx.lineTo(fieldMeter.radius, 0);
  ctx.stroke();
  ctx.strokeStyle = "#00FFFF";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, fieldMeter.radius * 0.6, 0, Math.PI * 2);
  ctx.stroke();
  const text_B = `|B|: ${B_total.toFixed(2)} μT`;
  const text_Bx = `Bx: ${Bx_display.toFixed(2)} μT`;
  const text_By = `By: ${By_display.toFixed(2)} μT`;
  const text_Angle = `θ: ${angle_deg.toFixed(1)}°`;
  const texts = [text_B, text_Bx, text_By, text_Angle];
  const boxX = 20;
  const boxY = -50;
  const boxWidth = 120; // Más ancho para el texto
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
  drawRoundRect(ctx, boxX, boxY, boxWidth, boxHeight, 8);
  ctx.moveTo(boxX - 5, boxY + boxHeight / 2); // Línea que conecta con el sensor
  ctx.lineTo(boxX - 15, boxY + boxHeight / 2 - 10);
  ctx.lineTo(0, 0);
  ctx.lineTo(boxX - 5, boxY + boxHeight / 2);
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

// --- 5. EL "GAME LOOP" (Motor Principal) ---

// Cerebro del Motor (Física de Salto)
function updateCoilLogic() {
  if (!showCoilCheck.checked) return;

  if (!bobina.dragging) {
    let By_avg = getMagneticFieldAt(bobina.x, bobina.y).By;

    if (earthFieldCheck.checked) By_avg = 0;

    if (!isFinite(By_avg)) By_avg = 0;
    By_avg = Math.max(-BY_CLAMP, Math.min(BY_CLAMP, By_avg));

    const K_FORCE = K_FORCE_BASE * (intensity / 100);
    let lorentzForce = K_FORCE * coilCurrent * By_avg;

    const MAX_FORCE = 20000;
    if (!isFinite(lorentzForce)) lorentzForce = 0;
    lorentzForce = Math.max(-MAX_FORCE, Math.min(MAX_FORCE, lorentzForce));

    let springForce = -K_SPRING * (bobina.y - bobina.y_base);
    let dampingForce = -K_DAMPING * bobina.y_vel;

    let accel = (lorentzForce + springForce + dampingForce) / bobina.mass;

    if (!isFinite(accel)) accel = 0;
    accel = Math.max(-MAX_ACCEL, Math.min(MAX_ACCEL, accel));

    bobina.y_accel = accel;
    bobina.y_vel += bobina.y_accel * DT;

    bobina.y_vel = Math.max(-MAX_VEL, Math.min(MAX_VEL, bobina.y_vel));

    bobina.y += bobina.y_vel * DT * 60;

    const TOP = 50;
    const BOTTOM = canvas.height - 50;

    if (bobina.y < TOP) {
      bobina.y = TOP;
      bobina.y_vel = 0;
    }
    if (bobina.y > BOTTOM) {
      bobina.y = BOTTOM;
      bobina.y_vel = 0;
    }

  } else {
    bobina.y_base = bobina.y;
    bobina.y_vel = 0;
    bobina.y_accel = 0;
  }
}

function drawSimulator() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 1. Dibujar el campo (Agujas O Limaduras)
  if (showFieldCheck.checked) {
    if (showFilingsCheck.checked) {
      drawIronFilings(); // Modo Limaduras
    } else {
      drawFieldNeedles(); // Modo Agujas (Visualización de Densidad mejorada)
    }
  }

  // 2. Dibujar el Planeta
  if (earthFieldCheck.checked) {
    drawEarth();
  }

  // 3. Dibujar el Imán
  drawMagnet();

  // 4. Dibujar y Actualizar el Motor
  if (showCoilCheck.checked) {
    updateCoilLogic(); // Calcular física
    drawCoil(); // Dibujar
  }

  // 5. Dibujar campos internos
  drawFieldInside();
  drawEarthFieldInside();

  // 6. Dibujar Herramientas
  if (showCompassCheck.checked) {
    drawCompass();
  }
  if (fieldMeterCheck.checked) {
    drawFieldMeter();
  }

  requestAnimationFrame(drawSimulator);
}

// --- 6. EVENT LISTENERS (Conectando los botones) ---

invertPolarityBtn.addEventListener("click", () => {
  polarity *= -1;
  clack.play();
});

intensitySlider.addEventListener("input", (e) => {
  intensity = e.target.value;
});

// Lógica de UI inteligente
function updateFieldControls() {

  const isEarth = earthFieldCheck.checked;
  const isField = showFieldCheck.checked;
  const isFilings = showFilingsCheck.checked;
  
  // 1. Lógica para "Limaduras de Hierro"
  const canShowFilings = isField && !isEarth;
  showFilingsCheck.disabled = !canShowFilings;
  if (showFilingsCheck.labels && showFilingsCheck.labels[0]) {
    showFilingsCheck.labels[0].style.opacity = canShowFilings ? 1 : 0.5;
    showFilingsCheck.labels[0].style.cursor = canShowFilings ? "pointer" : "not-allowed";
  }
  if (!canShowFilings) showFilingsCheck.checked = false;

  // 2. Lógica para "Ver por dentro"
  const canSeeInside = !isFilings;
  seeInsideCheck.disabled = !canSeeInside;
  if (seeInsideCheck.labels && seeInsideCheck.labels[0]) {
    seeInsideCheck.labels[0].style.opacity = canSeeInside ? 1 : 0.5;
    seeInsideCheck.labels[0].style.cursor = canSeeInside ? "pointer" : "not-allowed";
  }
  if (!canSeeInside) seeInsideCheck.checked = false;

  // 3. Lógica para "Bobina (Motor)"
  const canShowCoil = !isEarth;
  showCoilCheck.disabled = !canShowCoil;
  if (showCoilCheck.labels && showCoilCheck.labels[0]) {
    showCoilCheck.labels[0].style.opacity = canShowCoil ? 1 : 0.5;
    showCoilCheck.labels[0].style.cursor = canShowCoil ? "pointer" : "not-allowed";
  }
  if (!canShowCoil) showCoilCheck.checked = false;
  
  // 4. Lógica de Audio (Hum)
  if (showCoilCheck.checked && !isEarth && intensity > 0) {
      hum.play();
  } else {
      hum.pause();
      hum.currentTime = 0;
  }
}

// Listener para el slider de intensidad (para el HUM del motor)
intensitySlider.addEventListener("input", updateFieldControls);
showFieldCheck.addEventListener("change", updateFieldControls);
showFilingsCheck.addEventListener("change", updateFieldControls);

// Lógica de PhET: "Tierra"
earthFieldCheck.addEventListener("change", () => {
  if (earthFieldCheck.checked) {
    invertPolarityBtn.disabled = true;
    intensitySlider.disabled = true;
    invertPolarityBtn.style.opacity = 0.5;
    invertPolarityBtn.style.cursor = "not-allowed";
    intensitySlider.style.opacity = 0.5;
    intensitySlider.style.cursor = "not-allowed";
  } else {
    invertPolarityBtn.disabled = false;
    intensitySlider.disabled = false;
    invertPolarityBtn.style.opacity = 1;
    invertPolarityBtn.style.cursor = "pointer";
    intensitySlider.style.opacity = 1;
    intensitySlider.style.cursor = "pointer";
  }
  updateFieldControls();
});

// Listeners para el Motor
showCoilCheck.addEventListener("change", () => {
  if (showCoilCheck.checked) {
    invertCoilBtn.classList.remove("hidden");
    bobina.y_base = Math.max(50, Math.min(canvas.height - 50, bobina.y_base));
  } else {
    invertCoilBtn.classList.add("hidden");
    bobina.y = bobina.y_base;
    bobina.y_vel = 0;
    bobina.y_accel = 0;
  }
  updateFieldControls();
});

invertCoilBtn.addEventListener("click", () => {
  coilCurrent *= -1; // Invertir corriente
  click.play();
});

// Reset / UI helpers
function resetSimulator() {
  polarity = 1;
  intensitySlider.value = 75;
  intensity = 75;
  showFieldCheck.checked = true;
  showCompassCheck.checked = true;
  fieldMeterCheck.checked = false;
  earthFieldCheck.checked = false;
  seeInsideCheck.checked = false;
  showFilingsCheck.checked = false;
  showCoilCheck.checked = false;

  magnet.x = canvas.width / 2 - magnet.width / 2;
  magnet.y = canvas.height / 2 - magnet.height / 2;
  compass.x = canvas.width * 0.75;
  compass.y = canvas.height * 0.75;
  fieldMeter.x = canvas.width * 0.25;
  fieldMeter.y = canvas.height * 0.75;
  earth.x = canvas.width / 2;
  earth.y = canvas.height / 2;
  earth.radius = Math.min(canvas.width, canvas.height) * 0.35;

  // Resetear bobina
  bobina.y_base = canvas.height * 0.2;
  bobina.y = bobina.y_base;
  bobina.y_vel = 0;
  bobina.y_accel = 0;
  bobina.x = canvas.width / 2;
  coilCurrent = 1;
  invertCoilBtn.classList.add("hidden");

  // Re-habilitar botones en reset
  const buttonsToEnable = [invertPolarityBtn, intensitySlider];
  buttonsToEnable.forEach(btn => {
      btn.disabled = false;
      btn.style.opacity = 1;
      btn.style.cursor = "pointer";
    });

  updateFieldControls();
}

resetBtn.addEventListener("click", () => {
  resetSimulator();
  clack.play();
});

window.addEventListener('resize', () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  // Ajustar elementos relativos
  bobina.x = canvas.width / 2;
  bobina.y_base = canvas.height * 0.2;
  if (!showCoilCheck.checked) bobina.y = bobina.y_base;
  earth.radius = Math.min(canvas.width, canvas.height) * 0.35;
  magnet.x = canvas.width / 2 - magnet.width / 2;
  magnet.y = canvas.height / 2 - magnet.height / 2;
  // Re-ajustar posición de herramientas si están fuera del canvas
  compass.x = Math.min(canvas.width - 50, Math.max(50, compass.x));
  compass.y = Math.min(canvas.height - 50, Math.max(50, compass.y));
  fieldMeter.x = Math.min(canvas.width - 50, Math.max(50, fieldMeter.x));
  fieldMeter.y = Math.min(canvas.height - 50, Math.max(50, fieldMeter.y));
  updateFieldControls();
});

// Lógica de Arrastre
canvas.addEventListener("mousedown", (e) => {
  let didClickOnObject = false;

  const checkDrag = (obj, radius = 0) => {
      const dx = e.offsetX - obj.x;
      const dy = e.offsetY - obj.y;
      const effectiveRadius = radius > 0 ? radius : Math.max(obj.width, obj.height) / 2;
      
      let clicked = false;
      if (radius > 0) { // Círculos (Brújula, Medidor, Tierra)
          clicked = Math.sqrt(dx * dx + dy * dy) <= effectiveRadius;
      } else { // Rectángulos (Imán, Bobina)
          clicked = (e.offsetX >= obj.x - obj.width/2 && e.offsetX <= obj.x + obj.width/2 &&
                     e.offsetY >= obj.y - obj.height/2 && e.offsetY <= obj.y + obj.height/2);
      }
      
      if (clicked) {
          obj.dragging = true;
          obj.offsetX = e.offsetX - obj.x;
          obj.offsetY = e.offsetY - obj.y;
          return true;
      }
      return false;
  };
  
  // Priority 1: Tools
  if (showCompassCheck.checked && checkDrag(compass, compass.radius)) didClickOnObject = true;
  if (!didClickOnObject && fieldMeterCheck.checked && checkDrag(fieldMeter, fieldMeter.radius * 2)) didClickOnObject = true;
  
  // Priority 2: Coil (Motor)
  // Nota: La bobina usa sus coordenadas centrales, no la esquina superior izquierda
  if (!didClickOnObject && showCoilCheck.checked) {
      if (e.offsetX >= bobina.x - bobina.width / 2 && e.offsetX <= bobina.x + bobina.width / 2 &&
          e.offsetY >= bobina.y - bobina.height / 2 && e.offsetY <= bobina.y + bobina.height / 2) {
          bobina.dragging = true;
          bobina.offsetX = e.offsetX - bobina.x;
          bobina.offsetY = e.offsetY - bobina.y;
          didClickOnObject = true;
      }
  }

  // Priority 3: Earth/Magnet
  if (!didClickOnObject && earthFieldCheck.checked) {
      // Tierra es un círculo, re-evaluamos con radio
      const dx = e.offsetX - earth.x;
      const dy = e.offsetY - earth.y;
      if (Math.sqrt(dx * dx + dy * dy) <= earth.radius) {
          earth.dragging = true;
          earth.offsetX = e.offsetX - earth.x;
          earth.offsetY = e.offsetY - earth.y;
          didClickOnObject = true;
      }
  }

  if (!didClickOnObject && !earthFieldCheck.checked) {
    if (e.offsetX >= magnet.x && e.offsetX <= magnet.x + magnet.width &&
        e.offsetY >= magnet.y && e.offsetY <= magnet.y + magnet.height) {
      magnet.dragging = true;
      magnet.offsetX = e.offsetX - magnet.x;
      magnet.offsetY = e.offsetY - magnet.y;
      didClickOnObject = true;
    }
  }

  if (didClickOnObject) {
    canvas.style.cursor = "grabbing";
    click.play();
  }
});

canvas.addEventListener("mouseup", () => {
  magnet.dragging = false;
  compass.dragging = false;
  fieldMeter.dragging = false;
  earth.dragging = false;
  bobina.dragging = false;
  canvas.style.cursor = "grab";
});

canvas.addEventListener("mousemove", (e) => {
  if (magnet.dragging && !earthFieldCheck.checked) {
    magnet.x = e.offsetX - magnet.offsetX;
    magnet.y = e.offsetY - magnet.offsetY;
  } else if (earth.dragging) {
    earth.x = e.offsetX - earth.offsetX;
    earth.y = e.offsetY - earth.offsetY;
  } else if (compass.dragging) {
    compass.x = e.offsetX - compass.offsetX;
    compass.y = e.offsetY - compass.offsetY;
  } else if (fieldMeter.dragging) {
    fieldMeter.x = e.offsetX - fieldMeter.offsetX;
    fieldMeter.y = e.offsetY - fieldMeter.offsetY;
  } else if (bobina.dragging) {
    bobina.x = e.offsetX - bobina.offsetX;
    bobina.y = e.offsetY - bobina.offsetY;
    // Reseteamos velocidades para evitar "salto" al soltar
    bobina.y_vel = 0;
    bobina.y_accel = 0;
  }
});

// --- 7. ¡ARRANCAR EL MOTOR! ---
resetSimulator();
drawSimulator();