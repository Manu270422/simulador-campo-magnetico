// ================================
// Simulador: IMÁN DE BARRA (v3.6 - Agujas Internas en Imán de Tierra)
// ================================

// --- 1. CONFIGURACIÓN INICIAL ---
const invertPolarityBtn = document.getElementById("invertPolarity");
const intensitySlider = document.getElementById("intensity");
const resetBtn = document.getElementById("resetBtn");
const showFieldCheck = document.getElementById("showField");
const showCompassCheck = document.getElementById("showCompass");
const fieldMeterCheck = document.getElementById("fieldMeter");
const earthFieldCheck = document.getElementById("earthField");
const seeInsideCheck = document.getElementById("seeInside");
const canvas = document.getElementById("sim-canvas");
const ctx = canvas.getContext("2d");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Cargar la imagen del planeta
const earthImage = new Image();
earthImage.src = 'assets/planeta_tierra.png'; 
let earthImageLoaded = false;
earthImage.onload = () => {
  earthImageLoaded = true;
};
earthImage.onerror = () => {
  console.error("¡Error! No se pudo cargar 'assets/planeta_tierra.png'. Asegúrate de que el archivo exista. Se usará un color azul como fallback.");
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

// --- 3. EL "CEREBRO" (La Física) ---
// (Física v2.3 - Recta y funcional)
function getMagneticFieldAt(x, y) {

  let Bx_total = 0;
  let By_total = 0;

  // --- Parte A: Campo del Imán (si la Tierra NO está activa) ---
  if (!earthFieldCheck.checked) {
    const K_STRENGTH = 100000; 
    const strength = (intensity / 100) * K_STRENGTH * polarity;

    const poleN_x = magnet.x + magnet.width * 0.75;
    const poleS_x = magnet.x + magnet.width * 0.25;
    const pole_y = magnet.y + magnet.height / 2; 

    const dx_N = x - poleN_x;
    const dy_N = y - pole_y;
    let r_N_sq = dx_N * dx_N + dy_N * dy_N;
    r_N_sq = Math.max(r_N_sq, (magnet.height / 2) * (magnet.height / 2)); 
    const r_N = Math.sqrt(r_N_sq);
    
    const Bx_N = (strength * dx_N) / (r_N * r_N_sq);
    const By_N = (strength * dy_N) / (r_N * r_N_sq);

    const dx_S = x - poleS_x;
    
    // ¡¡¡AQUÍ ESTABA EL BUG v3.1!!!
    const dy_S = y - pole_y; // Corregido (antes 'poleS_y')

    let r_S_sq = dx_S * dx_S + dy_S * dy_S;
    r_S_sq = Math.max(r_S_sq, (magnet.height / 2) * (magnet.height / 2)); 
    const r_S = Math.sqrt(r_S_sq);

    const Bx_S = (-strength * dx_S) / (r_S * r_S_sq);
    const By_S = (-strength * dy_S) / (r_S * r_S_sq);
    
    Bx_total = Bx_N + Bx_S;
    By_total = By_N + By_S;
  }
  
  // --- Parte B: Campo de la Tierra (si está ACTIVA) ---
  if (earthFieldCheck.checked) {
    const K_EARTH_STRENGTH = 2000000; // 2e6
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
  
  return {
    Bx: Bx_total,
    By: By_total
  };
}

// --- 4. FUNCIONES DE DIBUJO (Diseño v2.0) ---

// (Helper) Función para dibujar rectángulos redondeados
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

/** * Función drawEarth ACTUALIZADA (v3.3)
 * Ahora con transparencia Fija para ver el campo magnético.
 */
function drawEarth() {
  if (!earthFieldCheck.checked) return;

  const centerX = earth.x;
  const centerY = earth.y;
  const earthRadius = earth.radius; 

  ctx.save();
  
  // === CAMBIO CLAVE: Transparencia FIJA (para ver el campo detrás) ===
  // Un valor de 0.5 a 0.7 funciona bien. 0.6 es un buen balance.
  ctx.globalAlpha = 0.6; 
  
  // 1. Dibujar la IMAGEN DEL PLANETA
  if (earthImageLoaded) {
    ctx.beginPath();
    ctx.arc(centerX, centerY, earthRadius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.save(); 
    ctx.clip(); 
    
    ctx.drawImage(
      earthImage, 
      centerX - earthRadius, 
      centerY - earthRadius, 
      earthRadius * 2, 
      earthRadius * 2
    );
    ctx.restore(); 
    
  } else {
    // Fallback
    const earthGradient = ctx.createRadialGradient(
      centerX - earthRadius * 0.3, centerY - earthRadius * 0.3, earthRadius * 0.1, 
      centerX, centerY, earthRadius
    );
    earthGradient.addColorStop(0, '#87CEEB'); 
    earthGradient.addColorStop(1, '#4682B4'); 
    ctx.fillStyle = earthGradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, earthRadius, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // 2. Sombra interna (también transparente)
  const innerShadow = ctx.createRadialGradient(
    centerX, centerY, earthRadius * 0.9,
    centerX, centerY, earthRadius
  );
  innerShadow.addColorStop(0, 'rgba(0,0,0,0)');
  innerShadow.addColorStop(1, 'rgba(0,0,0,0.6)');
  ctx.fillStyle = innerShadow;
  ctx.beginPath();
  ctx.arc(centerX, centerY, earthRadius, 0, Math.PI * 2);
  ctx.fill();

  // 3. Resetear alpha para el imán (este debe ser SÓLIDO)
  ctx.globalAlpha = 1.0; 

  // 4. Dibujar el imán interno (Recto)
  ctx.translate(centerX, centerY);
  
  const earthMagnetWidth = 40;
  const earthMagnetHeight = earth.radius * 1.5; 
  const earthMagnetRadius = 8;
  
  const earthMagnetX = -earthMagnetWidth / 2;
  const earthMagnetY = -earthMagnetHeight / 2;
  
  drawGlossyRect(ctx, earthMagnetX, earthMagnetY, earthMagnetWidth, earthMagnetHeight / 2, earthMagnetRadius, '#007bff', '#004899', true, false);
  drawGlossyRect(ctx, earthMagnetX, earthMagnetY + earthMagnetHeight / 2, earthMagnetWidth, earthMagnetHeight / 2, earthMagnetRadius, '#dc3545', '#8f1b2d', false, true);

  // Letras S y N
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

// (Helper) Función para dibujar rectángulos "Glossy"
function drawGlossyRect(ctx, x, y, width, height, radius, colorLight, colorDark, roundTop, roundBottom) {
  // (Esta función no necesita cambios)
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

// Dibujo del Imán (v3.5 - Línea Divisoria Interna)
// (v3.0) Oculto si la Tierra está activa
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
  
  // Dibuja las dos mitades del imán
  drawGlossyRect(ctx, x, y, width / 2, height, radius, poleS_colors[0], poleS_colors[1], true, true);
  drawGlossyRect(ctx, x + width / 2, y, width / 2, height, radius, poleN_colors[0], poleN_colors[1], true, true);

  // Línea divisoria interna (si aplica)
  // Ya no es necesaria aquí, ya que el request era para la Tierra.
  // Pero si se quiere mantener para el imán de barra, este es el lugar para ajustarla.
  /*
  const innerLineX = x + width * 0.5 + 4; 
  const lineWidth = 2;
  ctx.fillStyle = poleN_colors[1];
  ctx.fillRect(innerLineX - lineWidth / 2, y, lineWidth, height); 
  const glossMid = ctx.createLinearGradient(innerLineX - lineWidth / 2, y, innerLineX - lineWidth / 2, y + height * 0.4);
  glossMid.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
  glossMid.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
  ctx.fillStyle = glossMid;
  ctx.fillRect(innerLineX - lineWidth / 2, y, lineWidth, height * 0.4);
  */

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

// Dibujo del Campo Externo
// ¡ACTUALIZADO! (v3.4 - Lógica de Agujas dentro/fuera para imán de barra)
function drawField() {
  // Esta función es SÓLO para el campo EXTERNO
  if (!showFieldCheck.checked) return; 

  const gridSize = 50; 
  const needleLength = 15; 

  for (let x = 0; x < canvas.width; x += gridSize) {
    for (let y = 0; y < canvas.height; y += gridSize) {
      
      // Ocultar agujas dentro del Imán de Barra (si no es el campo de la Tierra)
      if (!earthFieldCheck.checked) {
        if (x > magnet.x && x < magnet.x + magnet.width &&
            y > magnet.y && y < magnet.y + magnet.height) {
          continue; 
        }
      }

      // Ocultar agujas dentro del Planeta (solo el imán interno de la Tierra)
      if (earthFieldCheck.checked) {
        const dx = x - earth.x;
        const dy = y - earth.y;
        
        // ¡SÍ ocultar dentro del imán interno de la Tierra si 'seeInsideCheck' está activo!
        const earthMagnetWidth = 40;
        const earthMagnetHeight = earth.radius * 1.5; 
        const earthMagnetX = earth.x - earthMagnetWidth / 2;
        const earthMagnetY = earth.y - earthMagnetHeight / 2;

        if (x > earthMagnetX && x < earthMagnetX + earthMagnetWidth &&
            y > earthMagnetY && y < earthMagnetY + earthMagnetHeight &&
            seeInsideCheck.checked) { // Solo ocultar si 'ver por dentro' está activo
            continue; 
        }
      }

      const { Bx, By } = getMagneticFieldAt(x, y);
      const angle = Math.atan2(By, Bx); 
      const magnitude = Math.sqrt(Bx*Bx + By*By);

      let opacity;
      if (earthFieldCheck.checked) {
        opacity = Math.min(magnitude / 200, 1); 
        opacity = Math.max(0.2, opacity); 
      } else {
        opacity = Math.min(magnitude / 100, 1); 
      }
      
      if (opacity < 0.05 && !earthFieldCheck.checked) continue;

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

// Dibujo del Campo Interno (Imán de Barra)
// ¡ACTUALIZADO! (v3.2 - Lógica PhET)
function drawFieldInside() {
  // Esta función es SÓLO para el campo INTERNO del imán de barra
  if (!seeInsideCheck.checked || earthFieldCheck.checked) return;

  const gridSize = 25; 
  const needleLength = 10; 
  const angle = (polarity === 1) ? 0 : Math.PI; 
  
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

// Dibuja las agujas dentro del imán de la TIERRA
// ¡ACTUALIZADO! (v3.6 - Agujas dentro de la barra del imán terrestre)
function drawEarthFieldInside() {
  // Esta función es SÓLO para el campo INTERNO de la Tierra
  if (!seeInsideCheck.checked || !earthFieldCheck.checked) return;
  
  // Parámetros para la cuadrícula y las agujas
  const gridSize = 20; // Hacemos las agujas un poco más pequeñas y más densas
  const needleLength = 8; // Longitud de la aguja

  // El campo va de S (arriba) a N (abajo) dentro del imán.
  // Una aguja horizontal (0 grados) se rotaría 90 grados (Math.PI / 2) para ser vertical.
  // Queremos que el polo norte de la aguja (rojo) apunte hacia el polo norte magnético (abajo en la imagen).
  // Así que la rotación debe ser Math.PI / 2.
  const angle = Math.PI / 2; 
  
  // Obtener las dimensiones del imán interno de la Tierra
  const earthMagnetWidth = 40;
  const earthMagnetHeight = earth.radius * 1.5; 
  const earthMagnetX = earth.x - earthMagnetWidth / 2;
  const earthMagnetY = earth.y - earthMagnetHeight / 2;

  ctx.save();
  ctx.globalAlpha = 0.6; 

  // Iterar SOLO dentro de los límites del imán interno de la Tierra
  for (let x = earthMagnetX + 5; x < earthMagnetX + earthMagnetWidth - 5; x += gridSize) { // margen de 5px
    for (let y = earthMagnetY + 5; y < earthMagnetY + earthMagnetHeight - 5; y += gridSize) { // margen de 5px
      
      ctx.save(); 
      // Centrar en el punto (x, y) de la cuadrícula
      ctx.translate(x + (gridSize/2), y + (gridSize/2)); 
      ctx.rotate(angle); 
      
      // La punta ROJA (Norte) del campo DEBE apuntar hacia el polo Norte magnético
      // que está en el sur geográfico (hacia abajo en la imagen).
      // Después de rotar PI/2, esto significa que el rojo se dibuja en +X.
      ctx.strokeStyle = "#dc3545"; // Rojo para el Norte
      ctx.lineWidth = 2; 
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(needleLength, 0); // Punta roja
      ctx.stroke();
      
      // La punta BLANCA (Sur) del campo DEBE apuntar hacia el polo Sur magnético
      // que está en el norte geográfico (hacia arriba en la imagen).
      // Después de rotar PI/2, esto significa que el blanco se dibuja en -X.
      ctx.strokeStyle = "#FFF"; // Blanco para el Sur
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-needleLength, 0); // Punta blanca
      ctx.stroke();
      
      ctx.restore(); 
    }
  }
  ctx.restore();
}


// Dibujo de la Brújula (v2.3)
function drawCompass() {
  // (Esta función no necesita cambios)
  if (!showCompassCheck.checked) return; 

  const { Bx, By } = getMagneticFieldAt(compass.x, compass.y);
  const angle = Math.atan2(By, Bx);
  const magnitude = Math.sqrt(Bx * Bx + By * By);
  
  let opacity;
  if (earthFieldCheck.checked) {
    opacity = Math.min(magnitude / 200, 1);
    opacity = Math.max(0.5, opacity);
  } else {
    opacity = Math.min(magnitude / 100, 1);
    opacity = Math.max(0.2, opacity); 
  }

  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 15;
  ctx.translate(compass.x, compass.y); 

  // Base
  const baseGradient = ctx.createRadialGradient(
    0, 0, compass.radius * 0.8, 
    0, 0, compass.radius
  );
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
  
  // Puntos cardinales
  ctx.fillStyle = "#FFF";
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
  
  // Aguja
  ctx.save();
  ctx.translate(compass.x, compass.y); 
  ctx.rotate(angle); 
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
  
  // Pivote
  ctx.save();
  ctx.translate(compass.x, compass.y);
  ctx.fillStyle = "#222";
  ctx.beginPath();
  ctx.arc(0, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Dibujo del Medidor (v2.0)
function drawFieldMeter() {
  if (!fieldMeterCheck.checked) return; 

  const { Bx: Bx_raw, By: By_raw } = getMagneticFieldAt(fieldMeter.x, fieldMeter.y);
  
  const SCALING_FACTOR = earthFieldCheck.checked ? 30 : 60; 

  const B_total = Math.sqrt(Bx_raw * Bx_raw + By_raw * By_raw) / SCALING_FACTOR;
  const Bx_display = Bx_raw / SCALING_FACTOR;
  const By_display = By_raw / SCALING_FACTOR;
  let angle_deg = Math.atan2(By_raw, Bx_raw) * (180 / Math.PI);
  
  ctx.save();
  ctx.translate(fieldMeter.x, fieldMeter.y); 

  // Icono
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

  // Texto
  const text_B = `B: ${B_total.toFixed(2)} G`;
  const text_Bx = `Bx: ${Bx_display.toFixed(2)} G`;
  const text_By = `By: ${By_display.toFixed(2)} G`;
  const text_Angle = `θ: ${angle_deg.toFixed(1)}°`; 

  const texts = [text_B, text_Bx, text_By, text_Angle];

  // Caja
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
  ctx.moveTo(boxX - 5, boxY);
  ctx.lineTo(boxX - 15, boxY - 10);
  ctx.lineTo(0, 0); 
  ctx.lineTo(boxX - 5, boxY);
  ctx.fill();
  ctx.stroke();

  // Texto
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
/** * Función drawSimulator ACTUALIZADA (v3.3)
 * El campo externo (agujas) se dibuja ANTES que la Tierra
 * para que la Tierra transparente se pinte ENCIMA.
 */
function drawSimulator() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#1a1a1a"; 
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 1. Dibujar el campo EXTERNO (¡PRIMERO!)
  // Las agujas de campo deben ir ABAJO para que la Tierra transparente las cubra.
  if (showFieldCheck.checked) {
    drawField(); 
  }
  
  // 2. Dibujar el Planeta (si está activo) - AHORA CON TRANSPARENCIA
  if (earthFieldCheck.checked) {
    drawEarth();
  }
  
  // 3. Dibujar el Imán (si está activo)
  drawMagnet(); 

  // 4. Dibujar el campo INTERNO (Imán de Barra)
  // (Este SÍ depende de 'seeInsideCheck')
  drawFieldInside(); 
  
  // 5. Dibujar el campo INTERNO (Tierra)
  // (Este SÍ depende de 'seeInsideCheck' y se dibuja DENTRO del imán)
  drawEarthFieldInside();
  
  // 6. Dibujar Herramientas (encima de todo)
  if (showCompassCheck.checked) {
    drawCompass();
  }
  if (fieldMeterCheck.checked) {
    drawFieldMeter();
  }

  requestAnimationFrame(drawSimulator);
}


// --- 6. EVENT LISTENERS (Conectando los botones) ---
// ¡ACTUALIZADO! (v3.2 - Lógica PhET Correcta)
invertPolarityBtn.addEventListener("click", () => {
  polarity *= -1; 
});

intensitySlider.addEventListener("input", (e) => {
  intensity = e.target.value; 
});

// Lógica de PhET: "Tierra" y "Ver por dentro"
earthFieldCheck.addEventListener("change", () => {
  // Cuando "Tierra" se activa...
  if (earthFieldCheck.checked) {
    // 1. Deshabilitar los controles del Imán
    invertPolarityBtn.disabled = true;
    intensitySlider.disabled = true;
    
    // 2. Aplicar estilos de deshabilitado
    invertPolarityBtn.style.opacity = 0.5;
    invertPolarityBtn.style.cursor = "not-allowed";
    intensitySlider.style.opacity = 0.5;
    intensitySlider.style.cursor = "not-allowed";
    
  } else {
    // Cuando "Tierra" se desactiva...
    // 1. Habilitar todo de nuevo
    invertPolarityBtn.disabled = false;
    intensitySlider.disabled = false;
    
    // 2. Quitar estilos de deshabilitado
    invertPolarityBtn.style.opacity = 1;
    invertPolarityBtn.style.cursor = "pointer";
    intensitySlider.style.opacity = 1;
    intensitySlider.style.cursor = "pointer";
  }
});


function resetSimulator() {
  polarity = 1;
  intensitySlider.value = 75;
  intensity = 75;
  showFieldCheck.checked = true;
  showCompassCheck.checked = true;
  fieldMeterCheck.checked = false;
  earthFieldCheck.checked = false; 
  seeInsideCheck.checked = false; 
  
  magnet.x = canvas.width / 2 - magnet.width / 2;
  magnet.y = canvas.height / 2 - magnet.height / 2;
  
  compass.x = canvas.width * 0.75;
  compass.y = canvas.height * 0.75;

  fieldMeter.x = canvas.width * 0.25;
  fieldMeter.y = canvas.height * 0.75;
  
  earth.x = canvas.width / 2;
  earth.y = canvas.height / 2;
  earth.radius = Math.min(canvas.width, canvas.height) * 0.35;
  
  // Re-habilitar botones en reset
  const buttonsToEnable = [invertPolarityBtn, intensitySlider];
  buttonsToEnable.forEach(btn => {
      btn.disabled = false;
      btn.style.opacity = 1;
      btn.style.cursor = "pointer";
    });
    
  seeInsideCheck.disabled = false;
  seeInsideCheck.labels[0].style.opacity = 1;
  seeInsideCheck.labels[0].style.cursor = "pointer";
}

resetBtn.addEventListener("click", resetSimulator);

window.addEventListener('resize', () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  resetSimulator(); 
});


// (v2.3) Lógica de Arrastre para TIERRA
canvas.addEventListener("mousedown", (e) => {
  let didClickOnObject = false; 

  // Prioridad 1: Brújula
  if (showCompassCheck.checked) {
    const dx = e.offsetX - compass.x;
    const dy = e.offsetY - compass.y;
    if (Math.sqrt(dx * dx + dy * dy) <= compass.radius) {
      compass.dragging = true;
      compass.offsetX = e.offsetX - compass.x;
      compass.offsetY = e.offsetY - compass.y;
      didClickOnObject = true;
    }
  }

  // Prioridad 2: Medidor
  if (!didClickOnObject && fieldMeterCheck.checked) {
    const dx = e.offsetX - fieldMeter.x;
    const dy = e.offsetY - fieldMeter.y;
    if (Math.sqrt(dx * dx + dy * dy) <= fieldMeter.radius * 2) { 
      fieldMeter.dragging = true;
      fieldMeter.offsetX = e.offsetX - fieldMeter.x;
      fieldMeter.offsetY = e.offsetY - fieldMeter.y;
      didClickOnObject = true;
    }
  }
  
  // Prioridad 3: Tierra (si está activa)
  if (!didClickOnObject && earthFieldCheck.checked) {
    const dx = e.offsetX - earth.x;
    const dy = e.offsetY - earth.y;
    if (Math.sqrt(dx * dx + dy * dy) <= earth.radius) {
      earth.dragging = true;
      earth.offsetX = e.offsetX - earth.x;
      earth.offsetY = e.offsetY - earth.y;
      didClickOnObject = true;
    }
  }

  // Prioridad 4: Imán (si la Tierra NO está activa)
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
  }
});

canvas.addEventListener("mouseup", () => {
  magnet.dragging = false;
  compass.dragging = false;
  fieldMeter.dragging = false; 
  earth.dragging = false; 
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
    compass.x = e.offsetX - compass.x;
    compass.y = e.offsetY - compass.y;
  } else if (fieldMeter.dragging) { 
    fieldMeter.x = e.offsetX - fieldMeter.x;
    fieldMeter.y = e.offsetY - fieldMeter.y;
  }
});


// --- 7. ¡ARRANCAR EL MOTOR! ---
resetSimulator(); 
drawSimulator();