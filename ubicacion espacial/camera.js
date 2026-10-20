/**
 * ============================================================================
 * LA PELOTA VIAJERA - MOTOR DE VISIÓN COMPUTACIONAL E INTERACCIÓN CON CÁMARA
 * Sistema interactivo con Realidad Aumentada Infantil:
 * - Objetos mágicos flotantes (AR) que el niño "toca" con su cuerpo
 * - Polvo de estrellas y partículas que siguen el movimiento del niño
 * - Detección espacial de saltos, agacharse y lateralidad (izq/der)
 * - Efecto de espejo mágico calibrado a 60 FPS
 * ============================================================================
 */

class CameraMotionTracker {
  constructor() {
    this.video = null;
    this.canvas = null;
    this.ctx = null;
    this.overlayCanvas = null;
    this.overlayCtx = null;
    this.stream = null;

    this.isActive = false;
    this.expectedDirection = null; // 'up', 'down', 'left', 'right'
    this.difficulty = 'medium';     // 'easy', 'medium', 'hard'

    // Parámetros de resolución interna para análisis ultra-rápido a 60 FPS
    this.width = 160;
    this.height = 120;
    this.prevFrame = null;
    this.animFrameId = null;

    // Carga de energía y umbrales
    this.motionCharge = 0; // 0 a 100
    this.chargeThreshold = 100;
    this.cooldown = false;
    this.lastSoundThreshold = 0;

    // Sistema de partículas mágicas interactivas
    this.particles = [];
    this.maxParticles = 60;

    // Animación de pulso del objeto AR
    this.pulseAngle = 0;

    // Métricas para el reporte pedagógico
    this.stats = {
      cameraMovesAttempted: 0,
      cameraMovesSuccess: 0,
      movesByDir: {
        up: 0,
        down: 0,
        left: 0,
        right: 0
      }
    };

    // Callback al detectar objetivo alcanzado
    this.onDirectionDetected = null; // (direction) => {}
  }

  /**
   * Inicializa elementos del DOM para la cámara
   */
  init(videoEl, overlayCanvasEl) {
    this.video = videoEl;
    this.overlayCanvas = overlayCanvasEl;
    if (this.overlayCanvas) {
      this.overlayCtx = this.overlayCanvas.getContext('2d');
    }

    // Canvas oculto para procesamiento matemático a escala reducida
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
  }

  /**
   * Enciende la cámara web
   */
  async start() {
    if (this.isActive) return true;

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 320 },
          height: { ideal: 240 },
          facingMode: 'user'
        },
        audio: false
      });

      if (this.video) {
        this.video.srcObject = this.stream;
        await this.video.play();
      }

      this.isActive = true;
      this.prevFrame = null;
      this.motionCharge = 0;
      this.particles = [];
      this.updateStatusBadge(true, 'Cámara Activa - ¡Listo!');
      this.startProcessingLoop();
      return true;
    } catch (err) {
      console.warn('No se pudo acceder a la cámara:', err);
      this.isActive = false;
      this.updateStatusBadge(false, 'Cámara no disponible o permiso denegado');
      return false;
    }
  }

  /**
   * Apaga la cámara
   */
  stop() {
    this.isActive = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => {
        try {
          track.stop();
        } catch (e) {
          console.warn(e);
        }
      });
      this.stream = null;
    }

    if (this.video) {
      this.video.srcObject = null;
    }

    this.updateStatusBadge(false, 'Cámara Apagada');
    this.clearOverlay();
  }

  toggle() {
    if (this.isActive) {
      this.stop();
      return false;
    } else {
      return this.start();
    }
  }

  setDifficulty(diff) {
    this.difficulty = diff;
  }

  setExpectedDirection(dir) {
    this.expectedDirection = dir;
    this.motionCharge = 0;
    this.lastSoundThreshold = 0;
  }

  /**
   * Bucle de análisis y renderizado en tiempo real (60 FPS)
   */
  startProcessingLoop() {
    const loop = () => {
      if (!this.isActive) return;

      this.processFrame();
      this.updateParticles();
      this.drawOverlay();

      this.animFrameId = requestAnimationFrame(loop);
    };

    this.animFrameId = requestAnimationFrame(loop);
  }

  /**
   * Diferenciación de fotogramas, generación de partículas y cálculo de movimiento
   */
  processFrame() {
    if (!this.video || this.video.readyState !== 4) return;

    this.pulseAngle += 0.08;

    // Dibujar fotograma actual en canvas pequeño de análisis
    this.ctx.drawImage(this.video, 0, 0, this.width, this.height);
    let frame;
    try {
      frame = this.ctx.getImageData(0, 0, this.width, this.height);
    } catch (e) {
      return;
    }

    const data = frame.data;
    const length = data.length;

    // Convertir a escala de grises
    const currentGray = new Uint8Array(this.width * this.height);
    for (let i = 0, j = 0; i < length; i += 4, j++) {
      currentGray[j] = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
    }

    if (!this.prevFrame) {
      this.prevFrame = currentGray;
      return;
    }

    let motionTop = 0;
    let motionBottom = 0;
    let motionLeft = 0;  // Movimiento en la izquierda física del niño
    let motionRight = 0; // Movimiento en la derecha física del niño
    let totalMotion = 0;

    const diffThreshold = 22;
    const halfW = this.width / 2;
    const halfH = this.height / 2;

    const overlayW = this.overlayCanvas ? this.overlayCanvas.width : 320;
    const overlayH = this.overlayCanvas ? this.overlayCanvas.height : 240;
    const scaleX = overlayW / this.width;
    const scaleY = overlayH / this.height;

    // Analizar movimiento celda por celda (paso de muestreo 2 para alto rendimiento)
    for (let y = 0; y < this.height; y += 2) {
      for (let x = 0; x < this.width; x += 2) {
        const idx = y * this.width + x;
        const diff = Math.abs(currentGray[idx] - this.prevFrame[idx]);

        if (diff > diffThreshold) {
          totalMotion += diff;

          // Generar polvo de estrellas interactivo en puntos de movimiento
          if (Math.random() < 0.08 && this.particles.length < this.maxParticles) {
            // Mapear x espejo a coordenadas de pantalla
            const screenX = (this.width - x) * scaleX;
            const screenY = y * scaleY;
            this.spawnParticle(screenX, screenY);
          }

          // Zona superior (saltar o brazos arriba)
          if (y < halfH * 0.75) {
            motionTop += diff * 1.3;
          }
          // Zona inferior (agacharse)
          else if (y > halfH * 1.25) {
            motionBottom += diff * 1.3;
          }

          // Cuadrantes horizontales (ajustados a perspectiva en espejo del niño)
          // Si el niño se mueve a su derecha, en cámara cruda x es menor a halfW
          if (x < halfW * 0.8) {
            motionRight += diff * 1.2;
          } else if (x > halfW * 1.2) {
            motionLeft += diff * 1.2;
          }
        }
      }
    }

    this.prevFrame = currentGray;

    // Enfriamiento tras un acierto exitoso
    if (this.cooldown) return;

    // Evaluar la dirección que Bolita pidió
    if (this.expectedDirection) {
      let activeMotion = 0;

      switch (this.expectedDirection) {
        case 'up':
          activeMotion = motionTop;
          break;
        case 'down':
          activeMotion = motionBottom;
          break;
        case 'left':
          activeMotion = motionLeft;
          break;
        case 'right':
          activeMotion = motionRight;
          break;
      }

      // Sensibilidad según la dificultad seleccionada
      let gain = 0.12;
      let decay = 3.0;
      if (this.difficulty === 'easy') {
        gain = 0.18;  // Muy sensible y rápido de alcanzar
        decay = 1.8;
      } else if (this.difficulty === 'hard') {
        gain = 0.09;  // Requiere movimiento definido y sostenido
        decay = 4.5;
      }

      if (activeMotion > 350) {
        this.motionCharge = Math.min(this.chargeThreshold, this.motionCharge + (activeMotion * gain * 0.015));

        // Sonido de campana suave a intervalos de carga (30%, 65%, 90%)
        const currentTier = Math.floor(this.motionCharge / 30);
        if (currentTier > this.lastSoundThreshold && currentTier < 3) {
          this.lastSoundThreshold = currentTier;
          if (window.soundController) {
            window.soundController.playChargingChime(this.motionCharge / this.chargeThreshold);
          }
        }
      } else {
        this.motionCharge = Math.max(0, this.motionCharge - decay);
        if (this.motionCharge === 0) this.lastSoundThreshold = 0;
      }

      // ¡Objetivo alcanzado con movimiento corporal!
      if (this.motionCharge >= this.chargeThreshold) {
        this.handleMotionSuccess(this.expectedDirection);
      }
    }
  }

  /**
   * Genera una partícula de polvo de estrellas mágicas
   */
  spawnParticle(x, y, color = null) {
    const colors = ['#ffd43b', '#69db7c', '#4dabf7', '#ff922b', '#da77f2', '#ffffff'];
    this.particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 2.5,
      vy: (Math.random() - 0.5) * 2.5 - 0.5,
      size: Math.random() * 4 + 2,
      color: color || colors[Math.floor(Math.random() * colors.length)],
      alpha: 1.0,
      life: 1.0,
      decay: Math.random() * 0.04 + 0.02
    });
  }

  /**
   * Explosión de confeti y estrellas al tocar el objetivo AR
   */
  spawnBurst(x, y, color) {
    for (let i = 0; i < 24; i++) {
      const angle = (Math.PI * 2 * i) / 24;
      const speed = Math.random() * 5 + 3;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 6 + 3,
        color: color,
        alpha: 1.0,
        life: 1.0,
        decay: 0.025
      });
    }
  }

  updateParticles() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= p.decay;
      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  /**
   * Se completó el movimiento corporal pedido
   */
  handleMotionSuccess(direction) {
    this.cooldown = true;
    this.motionCharge = 0;
    this.lastSoundThreshold = 0;

    this.stats.cameraMovesAttempted++;
    this.stats.cameraMovesSuccess++;
    this.stats.movesByDir[direction] = (this.stats.movesByDir[direction] || 0) + 1;

    // Sonido de explosión mágica
    if (window.soundController) {
      window.soundController.playTargetPop();
    }

    // Efecto de explosión de confeti en el objeto AR
    const targetPos = this.getTargetPosition(direction);
    this.spawnBurst(targetPos.x, targetPos.y, targetPos.color);

    // Notificar al motor del juego
    if (this.onDirectionDetected) {
      this.onDirectionDetected(direction);
    }

    setTimeout(() => {
      this.cooldown = false;
    }, 750);
  }

  /**
   * Devuelve la posición central y color del objeto flotante según la dirección
   */
  getTargetPosition(dir) {
    const w = this.overlayCanvas ? this.overlayCanvas.width : 320;
    const h = this.overlayCanvas ? this.overlayCanvas.height : 240;

    switch (dir) {
      case 'up':
        return { x: w / 2, y: 38, color: '#4dabf7', icon: '⭐', label: '¡SALTA!' };
      case 'down':
        return { x: w / 2, y: h - 38, color: '#51cf66', icon: '🍀', label: '¡AGÁCHATE!' };
      case 'left':
        // A la izquierda del niño (en pantalla izquierda)
        return { x: 50, y: h / 2, color: '#ff922b', icon: '💎', label: '¡IZQUIERDA!' };
      case 'right':
        // A la derecha del niño (en pantalla derecha)
        return { x: w - 50, y: h / 2, color: '#9775fa', icon: '👑', label: '¡DERECHA!' };
      default:
        return { x: w / 2, y: h / 2, color: '#ffd43b', icon: '✨', label: '' };
    }
  }

  /**
   * Dibuja los gráficos interactivos de Realidad Aumentada (AR) sobre la cámara
   */
  drawOverlay() {
    if (!this.overlayCanvas || !this.overlayCtx) return;

    const ctx = this.overlayCtx;
    const w = this.overlayCanvas.width;
    const h = this.overlayCanvas.height;

    ctx.clearRect(0, 0, w, h);

    if (!this.isActive) return;

    // 1. Dibujar partículas de movimiento mágico (estrellitas)
    this.drawParticles(ctx);

    // 2. Si no hay dirección activa pero la cámara está lista, mostrar silueta guía
    if (!this.expectedDirection) {
      this.drawCenterGuide(ctx, w, h);
      return;
    }

    // 3. Dibujar ZONA OBJETIVO Y OBJETO FLOTANTE AR
    const pct = this.motionCharge / this.chargeThreshold;
    const target = this.getTargetPosition(this.expectedDirection);

    ctx.save();

    // Halo y zona translúcida
    ctx.fillStyle = this.getZoneFillGradient(ctx, this.expectedDirection, w, h, target.color, pct);
    this.fillZoneArea(ctx, this.expectedDirection, w, h);

    // Dibujar objeto flotante interactivo (estrella, resorte, gema o corona)
    this.drawInteractiveTargetItem(ctx, target, pct);

    // 4. Barra de energía de movimiento arcoíris en la parte inferior
    this.drawEnergyBar(ctx, w, h, target.color, pct);

    ctx.restore();
  }

  /**
   * Dibuja el objeto flotante que el niño debe "tocar" físicamente
   */
  drawInteractiveTargetItem(ctx, target, pct) {
    const pulse = Math.sin(this.pulseAngle) * 4;
    const scale = 1.0 + (pct * 0.35) + (pulse * 0.02);
    const radius = 26 * scale;

    ctx.save();
    ctx.translate(target.x, target.y);

    // Anillo exterior de progreso circular
    ctx.beginPath();
    ctx.arc(0, 0, radius + 8, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * pct), false);
    ctx.lineWidth = 6;
    ctx.strokeStyle = target.color;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Círculo de fondo con brillo
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.shadowColor = target.color;
    ctx.shadowBlur = 15;
    ctx.fill();

    // Borde brillante
    ctx.lineWidth = 3;
    ctx.strokeStyle = target.color;
    ctx.stroke();

    // Ícono central (emoticono infantil grande)
    ctx.font = `${Math.round(26 * scale)}px Fredoka, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowBlur = 0;
    ctx.fillText(target.icon, 0, 1);

    // Etiqueta de acción motivacional debajo del objeto
    ctx.font = 'bold 11px Fredoka, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = 4;
    ctx.fillText(target.label, 0, radius + 16);

    ctx.restore();
  }

  /**
   * Rellena el cuadrante correspondiente con color suave
   */
  fillZoneArea(ctx, dir, w, h) {
    if (dir === 'up') ctx.fillRect(0, 0, w, h * 0.34);
    else if (dir === 'down') ctx.fillRect(0, h * 0.66, w, h * 0.34);
    else if (dir === 'left') ctx.fillRect(0, 0, w * 0.36, h);
    else if (dir === 'right') ctx.fillRect(w * 0.64, 0, w * 0.36, h);
  }

  getZoneFillGradient(ctx, dir, w, h, color, pct) {
    const alpha = 0.12 + (pct * 0.32);
    return color.replace(')', `, ${alpha})`).replace('rgb', 'rgba').replace('#', (m) => {
      // Convertir hex a rgba
      const bigint = parseInt(color.slice(1), 16);
      const r = (bigint >> 16) & 255;
      const g = (bigint >> 8) & 255;
      const b = bigint & 255;
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    });
  }

  /**
   * Barra de energía con feedback visual
   */
  drawEnergyBar(ctx, w, h, color, pct) {
    if (this.motionCharge > 3) {
      const barW = w * 0.64;
      const barH = 14;
      const barX = (w - barW) / 2;
      const barY = h - 20;

      // Fondo
      ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
      ctx.beginPath();
      ctx.roundRect(barX, barY, barW, barH, 7);
      ctx.fill();

      // Relleno progresivo
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(barX, barY, barW * pct, barH, 7);
      ctx.fill();

      // Texto de porcentaje
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px Fredoka, sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowBlur = 0;
      ctx.fillText(`¡Toca el objetivo! ${Math.round(pct * 100)}%`, w / 2, barY + 10);
    }
  }

  /**
   * Dibuja las partículas mágicas en pantalla
   */
  drawParticles(ctx) {
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  /**
   * Silueta guía de bienvenida para centrar al niño frente a la webcam
   */
  drawCenterGuide(ctx, w, h) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);

    const cx = w / 2;
    const cy = h / 2 - 10;

    // Cabeza
    ctx.beginPath();
    ctx.arc(cx, cy - 25, 20, 0, Math.PI * 2);
    ctx.stroke();

    // Hombros / Cuerpo
    ctx.beginPath();
    ctx.arc(cx, cy + 30, 40, Math.PI, Math.PI * 2, false);
    ctx.stroke();

    ctx.font = 'bold 11px Fredoka, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 4;
    ctx.fillText('¡Ubícate frente a la cámara! 👋', cx, h - 22);

    ctx.restore();
  }

  clearOverlay() {
    if (this.overlayCanvas && this.overlayCtx) {
      this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
    }
  }

  updateStatusBadge(active, text) {
    const badge = document.getElementById('cameraStatusBadge');
    const camDot = document.getElementById('camStatusDot');
    if (badge) {
      badge.textContent = text;
      badge.className = `camera-status-badge ${active ? 'active' : 'inactive'}`;
    }
    if (camDot) {
      camDot.className = `status-dot ${active ? 'on' : 'off'}`;
    }
  }
}

// Instancia global
window.cameraTracker = new CameraMotionTracker();
