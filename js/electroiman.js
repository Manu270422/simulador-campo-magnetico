// ===========================================
// Simulador: ELECTROIMÁN (v4.0 - Cumplimiento Requisitos Profesor)
// Mejoras: Espiras Max 4, Voltaje DC Entero, Animación Electrones Dinámica.
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

// Elementos de Control AC
const acGraphCanvas = document.getElementById("ac-graph-canvas");
const actx = acGraphCanvas.getContext("2d");
acGraphCanvas.width = 220; 
acGraphCanvas.height = 100;
const acAmplitudeSlider = document.getElementById("ac-amplitude-slider");
const acAmplitudeValue = document.getElementById("ac-amplitude-value");
const acFrequencySlider = document.getElementById("ac-frequency-slider");
const acFrequencyValue = document.getElementById("ac-frequency-value");

// Elementos de Control Solenoide (AJUSTADO)
const turnsSelect = document.getElementById("turns-select"); // Ahora es un SELECT
const showElectronsCheck = document.getElementById("showElectrons");
const showFieldCheck = document.getElementById("showField");

// Herramientas
const showCompassCheck = document.getElementById("showCompass");
const fieldMeterCheck = document.getElementById("fieldMeter");
const resetBtn = document.getElementById("resetBtn");

// Elementos de Control Simulación
const pauseBtn = document.getElementById("pause-btn");
const playBtn = document.getElementById("play-btn");
const stepBtn = document.getElementById("step-btn");


// --- 2. ESTADO DEL SIMULADOR ---
let isAC = false; 
let isPaused = true; 
let V = 5; // Voltaje DC
let N_coils = 4; // Número de espiras activas (de 1 a 4)
let time = 0; 

// Estado de AC
let amplitude = 5; 
let frequency = 0.5; 

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


// --- 3. FÍSICA Y CÁLCULO DE CORRIENTE ---

/**
 * Función CLAVE: Calcula la Corriente en el tiempo
 */
function getCurrent(t) {
    if (!isAC) {
        return V / 10; 
    } 
    const angularFrequency = 2 * Math.PI * frequency;
    return amplitude * Math.sin(angularFrequency * t);
}


/**
 * Calcula el Campo Magnético (B) de un Solenoide IDEAL en (x, y)
 * NOTA: Usa N_coils para el campo (proporcional al número de espiras reales)
 */
function getMagneticFieldAt(x, y, current) {
    const { x: sx, y: sy, length, radius } = solenoid;
    const halfL = length / 2;
    
    const K_STRENGTH = 200000; 
    const I = current;

    // --- Campo DENTRO del Solenoide ---
    if (x > sx - radius && x < sx + radius && y > sy - halfL && y < sy + halfL) {
        // Usa N_coils en el cálculo del campo magnético
        const B_mag = K_STRENGTH * N_coils * I / length;
        return {
            Bx: 0,
            By: -B_mag 
        };
    }
    
    // --- Campo FUERA del Solenoide (Aproximación de Dipolo) ---
    const magneticMoment = K_STRENGTH * N_coils * I * radius * radius * 0.5;
    
    const dz = y - sy;
    const dr = x - sx;
    let r_sq = dr * dr + dz * dz;
    r_sq = Math.max(r_sq, 2500); 
    const r = Math.sqrt(r_sq);
    
    const Bx_dipole = (magneticMoment / r_sq) * (3 * dr * dz) / r;
    const By_dipole = (magneticMoment / r_sq) * (3 * dz * dz - r_sq) / r;

    return {
        Bx: Bx_dipole,
        By: By_dipole
    };
}


// --- 4. FUNCIONES DE DIBUJO ---

/**
 * Dibuja el Solenoide, Núcleo y Electrones
 */
function drawSolenoid(current) {
    const { x, y, length, radius, wireThickness } = solenoid;
    const halfL = length / 2;
    const direction = Math.sign(current) || 0; 
    const absCurrent = Math.abs(current);
    // Controlar la velocidad de los electrones para que sea evidente
    const electronSpeed = absCurrent * 0.2; 
    
    // N_coils viene del selector (1 a 4)
    const N_total = 4; // Número MÁXIMO de espacios para dibujar
    const N_active = N_coils; // Número de espiras a dibujar

    ctx.save();
    
    // 1. Cuerpo del Solenoide (Núcleo)
    ctx.fillStyle = 'rgba(139, 69, 19, 0.7)'; 
    ctx.fillRect(x - radius, y - halfL, radius * 2, length);
    
    // Tapas
    ctx.fillStyle = 'rgba(100, 50, 10, 0.8)'; 
    ctx.beginPath();
    ctx.ellipse(x, y - halfL, radius, 10, 0, 0, Math.PI * 2); 
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x, y + halfL, radius, 10, 0, 0, Math.PI * 2); 
    ctx.fill();

    // 2. Dibujo de las Espiras (Máximo 4, distribuidas uniformemente)
    const coil_spacing = length / (N_total + 1); // Espaciado entre las 4 posibles espiras
    
    for (let i = 0; i < N_active; i++) {
        // Ajustar la posición Y de la espira para que se vea uniforme
        const coilY = y - halfL + coil_spacing * (i + 1); 

        const grad = ctx.createLinearGradient(x - radius, coilY - wireThickness / 2, x + radius, coilY + wireThickness / 2);
        grad.addColorStop(0, '#704214'); 
        grad.addColorStop(0.5, '#A0522D'); 
        grad.addColorStop(1, '#704214'); 
        ctx.fillStyle = grad;
        
        ctx.beginPath();
        ctx.ellipse(x, coilY, radius, wireThickness / 2, 0, 0, Math.PI * 2);
        ctx.fill();

        // 3. Dibujo de Electrones DENTRO DE CADA ESPIRA ACTIVA
        if (showElectronsCheck.checked && absCurrent > 0.05) {
            const electronRadius = 4;
            // Color de electrón basado en la dirección (Visual)
            const electronColor = direction > 0 ? "#ff00ff" : "#00FFFF"; 
            ctx.fillStyle = electronColor; 
            ctx.strokeStyle = "white";
            ctx.lineWidth = 1;

            // Dibuja 5 electrones por espira
            const electronsPerCoil = 5; 
            for (let j = 0; j < electronsPerCoil; j++) {
                // Utiliza la posición angular basada en el tiempo y el índice J
                const angleOffset = (time * electronSpeed * direction + j / electronsPerCoil) * 2 * Math.PI;
                
                const electronX = x + radius * 0.9 * Math.cos(angleOffset); 
                const electronY = coilY + radius * 0.1 * Math.sin(angleOffset); // Pequeña variación Y para efecto 3D
                
                ctx.beginPath();
                ctx.arc(electronX, electronY, electronRadius, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                
                // Signo (-)
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

/**
 * Dibuja la Fuente DC (Batería y Cables)
 */
function drawDCPower(current) {
    if (isAC) return; 
    
    const { x: sx, y: sy, length, radius } = solenoid;
    const halfL = length / 2;
    
    const battWidth = 120;
    const battHeight = 40;
    const battYOffset = 50;
    
    const battX = sx - battWidth / 2;
    const battY = sy - halfL - battHeight - battYOffset; 
    
    // --- 1. DIBUJO DE LA BATERÍA ---
    ctx.save();
    ctx.shadowColor = 'rgba(255, 255, 255, 0.4)';
    ctx.shadowBlur = 10;
    
    ctx.fillStyle = "#A0A0A0";
    ctx.fillRect(battX - 10, battY - 5, battWidth + 20, battHeight + 10);
    
    // Color según la polaridad actual (V > 0 o V < 0)
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
    // Muestra el voltaje SIN decimales
    ctx.fillText(`${Math.abs(V).toFixed(0)} V`, battX + 60, battY + 20); 

    ctx.restore();

    // --- 2. DIBUJO DE CABLES CONECTORES ---
    
    // Rojo: Polo Positivo / Azul: Polo Negativo
    const posColor = V > 0 ? "red" : "blue";
    const negColor = V > 0 ? "blue" : "red";

    const batConnectP = { x: battX + 125, y: battY + 20 }; 
    const batConnectN = { x: battX - 5, y: battY + 20 };   
    const solenoidConnectP = { x: sx + radius, y: sy - halfL }; 
    const solenoidConnectN = { x: sx - radius, y: sy + halfL }; 

    ctx.lineWidth = solenoid.wireThickness;
    ctx.lineCap = "round";

    // Cable Derecho (Positivo)
    ctx.strokeStyle = posColor;
    ctx.beginPath();
    ctx.moveTo(batConnectP.x, batConnectP.y);
    ctx.bezierCurveTo(batConnectP.x, sy - halfL - 20, solenoidConnectP.x + 20, sy - halfL - 20, solenoidConnectP.x, solenoidConnectP.y);
    ctx.stroke();

    // Cable Izquierdo (Negativo)
    ctx.strokeStyle = negColor;
    ctx.beginPath();
    ctx.moveTo(batConnectN.x, batConnectN.y);
    ctx.bezierCurveTo(batConnectN.x, sy + halfL + 20, solenoidConnectN.x - 20, sy + halfL + 20, solenoidConnectN.x, solenoidConnectN.y);
    ctx.stroke();
}

/**
 * Dibuja el Gráfico de Onda AC, Campo, Brújula y Medidor (sin cambios en la lógica)
 */
function drawACGraph() {
    if (!isAC) return; 

    actx.clearRect(0, 0, acGraphCanvas.width, acGraphCanvas.height);
    actx.fillStyle = "#333";
    actx.fillRect(0, 0, acGraphCanvas.width, acGraphCanvas.height);

    const width = acGraphCanvas.width;
    const height = acGraphCanvas.height;
    const centerY = height / 2;
    const scaleY = (height / 2) / amplitude;
    const timeScale = width / (1.5 / frequency); 

    // 1. Eje central (I=0)
    actx.strokeStyle = "rgba(255, 255, 255, 0.4)";
    actx.lineWidth = 1;
    actx.beginPath();
    actx.moveTo(0, centerY);
    actx.lineTo(width, centerY);
    actx.stroke();

    // 2. Dibujar la Onda Senoidal (I(t))
    actx.strokeStyle = "#00FF00"; 
    actx.lineWidth = 2;
    actx.beginPath();
    
    for (let x = 0; x < width; x++) {
        const t = (time - (width - x) / timeScale); 
        const I = getCurrent(t);
        const y = centerY - I * scaleY;
        
        if (x === 0) {
            actx.moveTo(x, y);
        } else {
            actx.lineTo(x, y);
        }
    }
    actx.stroke();

    // 3. Indicador de Tiempo Actual
    actx.fillStyle = "#FF0000"; 
    actx.beginPath();
    actx.arc(width - 5, centerY - getCurrent(time) * scaleY, 4, 0, Math.PI * 2);
    actx.fill();
}

// (Las funciones drawField, drawCompass, y drawFieldMeter se mantienen igual de la versión anterior)

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
      const magnitude = Math.sqrt(Bx*Bx + By*By);
      let opacity = Math.min(magnitude / 200, 1); 
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
    let opacity = Math.min(magnitude / 200, 1);
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
    const SCALING_FACTOR = 60; 
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
    const texts = [`B: ${B_total.toFixed(2)} G`, `Bx: ${Bx_display.toFixed(2)} G`, `By: ${By_display.toFixed(2)} G`, `θ: ${angle_deg.toFixed(1)}°`];
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

// --- 5. EL "GAME LOOP" (Motor Principal) ---
function drawSimulator(timestamp) {
    const current = getCurrent(time);
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#1a1a1a"; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (showFieldCheck.checked) {
        drawField(current); 
    }
    
    drawSolenoid(current);
    
    if (!isAC) {
        drawDCPower(current); 
    } else {
        drawACGraph();
    }
    
    if (showCompassCheck.checked) {
        drawCompass(current);
    }
    if (fieldMeterCheck.checked) {
        drawFieldMeter(current);
    }

    if (!isPaused) { 
        time += 1 / 60; 
    }
    
    requestAnimationFrame(drawSimulator);
}

// --- 6. EVENT LISTENERS (Controles) ---

// a) Selector AC/DC
dcButton.addEventListener("click", () => {
    isAC = false;
    dcButton.classList.add("active-source");
    acButton.classList.remove("active-source");
    dcPowerPanel.style.display = "block";
    acPowerPanel.style.display = "none";
    
    isPaused = true; 
    updateControlButtons();
});

acButton.addEventListener("click", () => {
    isAC = true;
    dcButton.classList.remove("active-source");
    acButton.classList.add("active-source");
    dcPowerPanel.style.display = "none";
    acPowerPanel.style.display = "block";
    time = 0; 
    
    isPaused = true;
    updateControlButtons();
});

// b) Control DC (AJUSTADO: Valores enteros)
dcVoltageSlider.addEventListener("input", (e) => {
    // Redondea el valor (ya viene como entero por el step="1" del HTML)
    V = Math.round(parseFloat(e.target.value));
    // Muestra el valor SIN decimales
    dcVoltageValue.textContent = V.toFixed(0);
});

// c) Controles AC (Sin cambios)
acAmplitudeSlider.addEventListener("input", (e) => {
    amplitude = parseFloat(e.target.value);
    acAmplitudeValue.textContent = `${amplitude.toFixed(1)} A`;
});

acFrequencySlider.addEventListener("input", (e) => {
    frequency = parseFloat(e.target.value);
    acFrequencyValue.textContent = `${frequency.toFixed(1)} Hz`;
});

// d) Control de Espiras (N) (AJUSTADO: Usando SELECT)
turnsSelect.addEventListener("change", (e) => {
    // Obtiene el valor como entero (1 a 4)
    N_coils = parseInt(e.target.value); 
});

// e) Reset 
function resetSimulator() {
    isAC = false;
    V = 5;
    N_coils = 4; // Vuelve a 4 espiras por defecto
    time = 0;
    amplitude = 5;
    frequency = 0.5;
    
    isPaused = true;

    // Resetear Controles
    dcVoltageSlider.value = V;
    dcVoltageValue.textContent = V.toFixed(0); // SIN decimal
    acAmplitudeSlider.value = amplitude;
    acAmplitudeValue.textContent = `${amplitude.toFixed(1)} A`;
    acFrequencySlider.value = frequency;
    acFrequencyValue.textContent = `${frequency.toFixed(1)} Hz`;
    turnsSelect.value = N_coils; // Setea el valor del select
    
    dcButton.click(); 

    // Resetear Posiciones
    solenoid.x = canvas.width / 3;
    solenoid.y = canvas.height / 2;
    compass.x = canvas.width * 0.75;
    compass.y = canvas.height * 0.75;
    fieldMeter.x = canvas.width * 0.25;
    fieldMeter.y = canvas.height * 0.75;
    
    // Resetear Checkboxes
    showElectronsCheck.checked = true;
    showFieldCheck.checked = true;
    showCompassCheck.checked = true;
    fieldMeterCheck.checked = false;
}

resetBtn.addEventListener("click", resetSimulator);


// f) Lógica de Arrastre (Sin cambios)
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


// g) Ajuste de tamaño de ventana (Sin cambios)
window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    resetSimulator(); 
});


// --- h) Lógica de Control de Tiempo (Pausa/Play/Step) (Sin cambios) ---

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
});

playBtn.addEventListener("click", () => {
    isPaused = false;
    updateControlButtons();
});

stepBtn.addEventListener("click", () => {
    if (isPaused) { 
        time += 1 / 60; 
    }
});


// --- 7. ¡ARRANCAR EL MOTOR! ---
resetSimulator(); 
drawSimulator();