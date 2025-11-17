/* CYBERMAGNET — bg WebGL + particles + interactions
   script.js - versión con: particle tuning, electric pulse on cards,
   scanline (CSS), mag waves on logo hover (CSS + shader ripples), sound hum
*/

(() => {
  // Canvas elements
  const glCanvas = document.getElementById('bg-webgl-canvas');
  const ptsCanvas = document.getElementById('particles-canvas');

  // set sizes to cover window
  function resizeCanvases() {
    const w = window.innerWidth, h = window.innerHeight;
    // WebGL canvas
    glCanvas.width = w; glCanvas.height = h;
    glCanvas.style.width = w + 'px'; glCanvas.style.height = h + 'px';
    // particles canvas (2D)
    ptsCanvas.width = w; ptsCanvas.height = h;
    ptsCanvas.style.width = w + 'px'; ptsCanvas.style.height = h + 'px';
    if (gl) {
      gl.viewport(0,0,glCanvas.width,glCanvas.height);
    }
  }

  window.addEventListener('resize', resizeCanvases);

  /* -------------------------------
     WebGL setup (simple full-screen shader)
  ---------------------------------*/
  const gl = glCanvas.getContext('webgl', { antialias: true }) || glCanvas.getContext('experimental-webgl');

  if (!gl) {
    console.warn('WebGL not available — background shader disabled.');
  }

  function compileShader(src, type) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  const vSrc = `
    attribute vec2 a_position;
    varying vec2 v_uv;
    void main(){
      v_uv = a_position * 0.5 + 0.5;
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;

  const fSrc = `
    precision highp float;
    varying vec2 v_uv;
    uniform float u_time;
    uniform vec2 u_resolution;
    uniform int u_rippleCount;
    uniform vec3 u_ripples[8];

    float hash21(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    void main(){
      vec2 uv = v_uv;
      vec2 p = uv * u_resolution.xy / min(u_resolution.x, u_resolution.y);

      float t = u_time * 0.6;
      float w = 0.0;
      w += 0.20 * sin( (p.x * 0.6 + t*1.2) );
      w += 0.14 * sin( (p.y * 0.9 - t*0.8) * 1.3 );
      w += 0.10 * sin( (p.x*0.3 + p.y*0.5 + t*1.6) * 0.9 );

      float rippleEffect = 0.0;
      for (int i=0; i<8; i++){
        if (i >= u_rippleCount) break;
        vec3 r = u_ripples[i];
        vec2 center = r.xy;
        float s = r.z;
        vec2 d = uv - center;
        float dist = length(d);
        rippleEffect += s * exp(-3.0 * dist) * sin(20.0 * dist - 6.0 * u_time);
      }

      float intensity = 0.5 + 0.5 * sin(w * 2.0 + rippleEffect * 1.2);
      vec3 base = vec3(0.02, 0.06, 0.10);
      vec3 cyan = vec3(0.0, 0.95, 1.0);
      vec3 glow = mix(base, cyan, smoothstep(0.45, 0.75, intensity));
      float vig = 1.0 - smoothstep(0.4, 1.0, length((uv-0.5)*vec2(u_resolution.x/u_resolution.y,1.0)*0.9));
      vec3 col = glow * (0.6 + 0.6 * vig);
      float n = hash21(uv * (u_time * 0.3 + 17.0));
      col += 0.02 * vec3(n);
      col = pow(col, vec3(0.9));
      gl_FragColor = vec4(col, 1.0);
    }
  `;

  let program = null;
  let aPosLoc = null;
  let uTimeLoc = null;
  let uResLoc = null;
  let uRippleCountLoc = null;
  let uRipplesLoc = null;

  let rippleCenters = []; // {x,y,s,t}

  function initGL() {
    if (!gl) return;
    const vs = compileShader(vSrc, gl.VERTEX_SHADER);
    const fs = compileShader(fSrc, gl.FRAGMENT_SHADER);
    program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('GL Program link error', gl.getProgramInfoLog(program));
      return;
    }
    gl.useProgram(program);

    const quadVerts = new Float32Array([
      -1, -1,
      3, -1,
      -1, 3
    ]);
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, quadVerts, gl.STATIC_DRAW);
    aPosLoc = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(aPosLoc);
    gl.vertexAttribPointer(aPosLoc, 2, gl.FLOAT, false, 0, 0);

    uTimeLoc = gl.getUniformLocation(program, 'u_time');
    uResLoc = gl.getUniformLocation(program, 'u_resolution');
    uRippleCountLoc = gl.getUniformLocation(program, 'u_rippleCount');
    uRipplesLoc = gl.getUniformLocation(program, 'u_ripples');

    resizeCanvases();
  }

  if (gl) initGL();

  /* -------------------------------
     Particles (2D canvas) - electrons
     - improved: adjustable density, gentle attraction to hovered card
  ---------------------------------*/
  const ptsCtx = ptsCanvas.getContext('2d');

  // density control: scale factor (1 default) - you can change this at runtime
  let PARTICLE_SCALE = 1.0; // 0.5 .. 2.0
  const BASE_DENSITY = 12000; // divisor (lower -> more particles)
  let NUM_PARTICLES = Math.round((window.innerWidth * window.innerHeight) / BASE_DENSITY * PARTICLE_SCALE);
  const particles = [];

  // attraction state (when hovering cards)
  let attractPoint = null; // {x,y,strength,expires}
  let attractTimeout = null;

  function recalcNumParticles() {
    NUM_PARTICLES = Math.round((window.innerWidth * window.innerHeight) / BASE_DENSITY * PARTICLE_SCALE);
  }

  function initParticles() {
    particles.length = 0;
    recalcNumParticles();
    for (let i=0;i<NUM_PARTICLES;i++){
      particles.push({
        x: Math.random() * ptsCanvas.width,
        y: Math.random() * ptsCanvas.height,
        vx: (Math.random()-0.5) * 0.8,
        vy: (Math.random()-0.5) * 0.8,
        r: 0.6 + Math.random()*1.6,
        alpha: 0.03 + Math.random()*0.25
      });
    }
  }

  function renderParticles(dt, time) {
    ptsCtx.clearRect(0,0,ptsCanvas.width, ptsCanvas.height);
    // trail effect
    ptsCtx.fillStyle = 'rgba(0, 0, 0, 0.12)';
    ptsCtx.fillRect(0,0,ptsCanvas.width, ptsCanvas.height);

    ptsCtx.globalCompositeOperation = 'lighter';

    for (let p of particles) {
      // influence from global gentle flow
      const flowAmp = 1 + Math.sin(time*0.2)*0.4;
      p.x += p.vx * flowAmp;
      p.y += p.vy * flowAmp;

      // attraction towards point if present
      if (attractPoint) {
        const dx = attractPoint.x - p.x;
        const dy = attractPoint.y - p.y;
        const dist2 = dx*dx + dy*dy;
        // apply attraction if within influence radius
        const radius = Math.max(80, attractPoint.strength*220);
        if (dist2 < radius*radius) {
          const dist = Math.sqrt(dist2) + 0.0001;
          const force = (1 - (dist / radius)) * 0.6 * attractPoint.strength;
          p.vx += (dx/dist) * force * 0.08;
          p.vy += (dy/dist) * force * 0.08;
          // damp for stability
          p.vx *= 0.995;
          p.vy *= 0.995;
        }
      }

      // simple speed clamp
      const maxv = 1.6;
      if (p.vx > maxv) p.vx = maxv;
      if (p.vx < -maxv) p.vx = -maxv;
      if (p.vy > maxv) p.vy = maxv;
      if (p.vy < -maxv) p.vy = -maxv;

      // wrap
      if (p.x < -30) p.x = ptsCanvas.width + 30;
      if (p.x > ptsCanvas.width + 30) p.x = -30;
      if (p.y < -30) p.y = ptsCanvas.height + 30;
      if (p.y > ptsCanvas.height + 30) p.y = -30;

      // draw soft glow
      const g = ptsCtx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r*8);
      g.addColorStop(0, `rgba(0,230,255,${0.9 * p.alpha})`);
      g.addColorStop(0.25, `rgba(0,230,255,${0.22 * p.alpha})`);
      g.addColorStop(1, `rgba(0,230,255,0)`);
      ptsCtx.fillStyle = g;
      ptsCtx.beginPath();
      ptsCtx.arc(p.x, p.y, p.r*8, 0, Math.PI*2);
      ptsCtx.fill();
    }
    ptsCtx.globalCompositeOperation = 'source-over';
  }

  /* -------------------------------
     Interaction & ripples management
  ---------------------------------*/
  function addRipple(nx, ny, strength=1.0) {
    if (rippleCenters.length >= 8) rippleCenters.shift();
    rippleCenters.push({ x: nx, y: ny, s: strength, t: performance.now()/1000 });
  }

  function composeRipplesUniform() {
    const arr = new Float32Array(8 * 3);
    for (let i=0;i<8;i++){
      if (i < rippleCenters.length) {
        const c = rippleCenters[i];
        const age = (performance.now()/1000) - c.t;
        const strength = Math.max(0.0, c.s * Math.exp(-age * 0.9));
        arr[i*3+0] = c.x;
        arr[i*3+1] = c.y;
        arr[i*3+2] = strength;
      } else {
        arr[i*3+0]=arr[i*3+1]=arr[i*3+2]=0.0;
      }
    }
    return arr;
  }

  /* -------------------------------
     Hook interactions on cards/logos
  ---------------------------------*/
  const moduleCards = Array.from(document.querySelectorAll('.module-card'));
  const sndOpen = document.getElementById('snd-open');
  const sndClick = document.getElementById('snd-click');
  const sndHum = document.getElementById('snd-hum');

  function normalizedFromEvent(e) {
    const rect = document.documentElement.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    return { x, y };
  }

  moduleCards.forEach(card => {
    // on mouse move we create micro ripples + set attraction center
    card.addEventListener('mousemove', (ev) => {
      const n = normalizedFromEvent(ev);
      // small ripple
      addRipple(n.x, n.y, 0.14);
      // occasional clicky
      if (Math.random() < 0.02 && sndClick) { sndClick.currentTime = 0; sndClick.volume = 0.12; sndClick.play().catch(()=>{}); }

      // set attraction point for particles
      const rect = card.getBoundingClientRect();
      const px = ev.clientX;
      const py = ev.clientY;
      attractPoint = {
        x: px,
        y: py,
        strength: 1.0,
        expires: performance.now() + 600 // ms
      };

      // ensure hum is playing softly while hovering
      if (sndHum) {
        sndHum.volume = 0.06;
        if (sndHum.paused) {
          sndHum.play().catch(()=>{});
        }
      }
    });

    card.addEventListener('mouseenter', (ev) => {
      // visual electric pulse class
      card.classList.add('electric');
      // small ripple centered on card
      const r = card.getBoundingClientRect();
      const cx = (r.left + r.width/2) / window.innerWidth;
      const cy = (r.top + r.height/2) / window.innerHeight;
      addRipple(cx, cy, 0.6);
    });

    card.addEventListener('mouseleave', (ev) => {
      // remove electric pulse (after short fade)
      setTimeout(()=> card.classList.remove('electric'), 300);
      attractPoint = null;
      // fade out hum
      if (sndHum) {
        // gently fade down then pause
        let vol = sndHum.volume;
        const fade = setInterval(()=> {
          vol -= 0.01;
          if (vol <= 0.01) { sndHum.pause(); sndHum.currentTime = 0; clearInterval(fade); }
          else sndHum.volume = Math.max(0,vol);
        }, 40);
      }
    });

    card.addEventListener('click', (ev) => {
      const n = normalizedFromEvent(ev);
      addRipple(n.x, n.y, 1.0);
      if (sndOpen) { sndOpen.currentTime = 0; sndOpen.volume = 0.9; sndOpen.play().catch(()=>{}); }
      // visual "spike" pulse
      card.classList.add('electric');
      setTimeout(()=> card.classList.remove('electric'), 900);
    });

    // keyboard accessibility (enter key)
    card.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        const r = card.getBoundingClientRect();
        const cx = (r.left + r.width/2) / window.innerWidth;
        const cy = (r.top + r.height/2) / window.innerHeight;
        addRipple(cx, cy, 1.0);
        if (sndOpen) { sndOpen.currentTime = 0; sndOpen.volume = 0.9; sndOpen.play().catch(()=>{}); }
      }
    });
  });

  // Logo hover create stronger ripple into shader also
  const logoWraps = Array.from(document.querySelectorAll('.logo-wrap'));
  logoWraps.forEach(w => {
    w.addEventListener('mouseenter', (e) => {
      // compute center normalized
      const r = w.getBoundingClientRect();
      const cx = (r.left + r.width/2) / window.innerWidth;
      const cy = (r.top + r.height/2) / window.innerHeight;
      addRipple(cx, cy, 1.4);
      // subtle clicky + hum boost
      if (sndClick) { sndClick.currentTime = 0; sndClick.volume = 0.18; sndClick.play().catch(()=>{}); }
      if (sndHum) { sndHum.volume = 0.08; if (sndHum.paused) { sndHum.play().catch(()=>{}); } }
    });
    w.addEventListener('mouseleave', (e) => {
      // small ripple fade
      const r = w.getBoundingClientRect();
      const cx = (r.left + r.width/2) / window.innerWidth;
      const cy = (r.top + r.height/2) / window.innerHeight;
      addRipple(cx, cy, 0.4);
    });
  });

  /* -------------------------------
     UI Modal open buttons (keep your modal logic)
  ---------------------------------*/
  document.addEventListener('DOMContentLoaded', () => {
    const openButtons = document.querySelectorAll(".open-btn");
    const panel = document.getElementById("sim-panel");
    const closeBtn = document.getElementById("close-panel");
    const simTitle = document.getElementById("sim-title");
    const simBody = document.getElementById("sim-body");
    const modalLink = document.getElementById("modal-link");

    openButtons.forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault();
        const target = btn.dataset.target;
        const href = btn.href;
        panel.classList.remove("hidden");
        if (target === "bar") {
          simTitle.textContent = "Simulador: Imán de Barra";
          simBody.innerHTML = `
            <p>Explora el comportamiento del campo magnético generado por un imán de barra.</p>
            <p>Visualiza líneas de campo, limaduras, brújula y efectos interactivos.</p>
          `;
        } else if (target === "electro") {
          simTitle.textContent = "Simulador: Electroimán";
          simBody.innerHTML = `
            <p>Configura un electroimán realista con corriente DC/AC.</p>
            <p>Manipula espiras, núcleo, flujo y observa su campo en tiempo real.</p>
          `;
        }
        modalLink.href = href;
        // play open sound
        if (sndOpen) { sndOpen.currentTime = 0; sndOpen.volume = 0.9; sndOpen.play().catch(()=>{}); }
      });
    });

    closeBtn.addEventListener('click', () => {
      document.getElementById('sim-panel').classList.add('hidden');
    });
  });

  /* -------------------------------
     Animation loop
  ---------------------------------*/
  let last = performance.now()/1000;
  function animate() {
    const now = performance.now()/1000;
    const dt = now - last;
    last = now;

    // update GL shader uniforms and draw
    if (gl && program) {
      gl.useProgram(program);
      gl.uniform1f(uTimeLoc, now);
      gl.uniform2f(uResLoc, glCanvas.width, glCanvas.height);

      // cleanup rippleCenters older than 5s
      for (let i = rippleCenters.length - 1; i >= 0; i--) {
        const c = rippleCenters[i];
        const age = now - c.t;
        if (age > 5.5) rippleCenters.splice(i,1);
      }

      gl.uniform1i(uRippleCountLoc, rippleCenters.length);
      const arr = composeRipplesUniform();
      gl.uniform3fv(uRipplesLoc, arr);

      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    // update attractPoint expiry (clear if expired)
    if (attractPoint && attractPoint.expires && performance.now() > attractPoint.expires) {
      attractPoint = null;
    }

    // update particles
    renderParticles(dt, now);

    // schedule
    requestAnimationFrame(animate);
  }

  // init & start
  resizeCanvases();
  initParticles();
  requestAnimationFrame(animate);

  // re-init particles on major resize
  let resizeTimeout = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(()=> {
      initParticles();
    }, 200);
  });

  // exposed controls (optional) to tune density from console:
  window.CyberMagnet = {
    setParticleScale: (s) => { PARTICLE_SCALE = Math.max(0.25, Math.min(2.0, s)); initParticles(); },
    addManualRipple: (nx, ny, strength=1.0) => addRipple(nx, ny, strength)
  };

})();
