/**
 * ============================================================================
 * LA PELOTA VIAJERA - MOTOR DE JUEGO Y LÓGICA VISOESPACIAL
 * ============================================================================
 */

class BallAdventureGame {
  constructor() {
    this.gridSize = 4; // 3x3, 4x4 o 5x5 según dificultad
    this.ballPos = { r: 0, c: 0 };
    this.goalPos = { r: 3, c: 3 };
    this.obstacles = [];
    this.currentExpectedDir = null; // 'up', 'down', 'left', 'right'
    this.promptTime = 0;
    this.isWaitingInput = false;

    // Configuración de la sesión activa
    this.kidProfile = { name: 'Explorador', age: 5, avatar: '👦' };
    this.mode = 'adventure'; // 'adventure', 'memory', 'speed'
    this.difficulty = 'medium';
    this.controlMode = 'camera'; // 'camera', 'hybrid', 'voice', 'touch'
    this.maxMissions = 8;
    this.currentMission = 1;
    this.sessionStartTime = null;

    // Temporizador de turno activo según dificultad
    this.turnTimeLimitSeconds = 6;
    this.turnTimerInterval = null;
    this.timeRemaining = 6;

    // Estadísticas psicométricas
    this.stats = {
      score: 0,
      streak: 0,
      maxStreak: 0,
      reactionTimes: [],
      cameraHits: 0,
      cameraAttempts: 0,
      inputSources: { camera: 0, voice: 0, touch: 0 },
      directions: {
        up: { attempts: 0, hits: 0, errors: 0 },
        down: { attempts: 0, hits: 0, errors: 0 },
        left: { attempts: 0, hits: 0, errors: 0 },
        right: { attempts: 0, hits: 0, errors: 0 }
      },
      memoryHits: 0,
      memoryTotal: 0
    };

    // Para Modo Memoria
    this.memorySequence = [];
    this.memoryStepIndex = 0;

    // Callbacks
    this.onGameFinished = null; // (sessionData) => {}
  }

  /**
   * Inicia una nueva aventura con el perfil dado
   */
  startSession(profile, mode, difficulty, controlMode = 'camera') {
    this.kidProfile = profile;
    this.mode = mode;
    this.difficulty = difficulty;
    this.controlMode = controlMode;
    this.sessionStartTime = Date.now();
    this.currentMission = 1;

    // Configurar tracker de cámara
    if (window.cameraTracker) {
      window.cameraTracker.setDifficulty(difficulty);
    }

    // Configurar límites y tiempos según dificultad
    if (difficulty === 'easy') {
      this.gridSize = 3;
      this.maxMissions = 6;
      this.turnTimeLimitSeconds = 10;
    } else if (difficulty === 'medium') {
      this.gridSize = 4;
      this.maxMissions = 8;
      this.turnTimeLimitSeconds = 6;
    } else {
      this.gridSize = 5;
      this.maxMissions = 10;
      this.turnTimeLimitSeconds = 3.5;
    }

    // Reiniciar estadísticas
    this.stats = {
      score: 0,
      streak: 0,
      maxStreak: 0,
      reactionTimes: [],
      cameraHits: 0,
      cameraAttempts: 0,
      inputSources: { camera: 0, voice: 0, touch: 0 },
      directions: {
        up: { attempts: 0, hits: 0, errors: 0 },
        down: { attempts: 0, hits: 0, errors: 0 },
        left: { attempts: 0, hits: 0, errors: 0 },
        right: { attempts: 0, hits: 0, errors: 0 }
      },
      memoryHits: 0,
      memoryTotal: 0
    };

    this.updateHUD();
    this.setupMission();
  }

  /**
   * Configura una misión (tablero, meta y posición inicial de Bolita)
   */
  setupMission() {
    this.clearTurnTimer();
    this.obstacles = [];

    // Colocar a Bolita y la meta
    if (this.difficulty === 'easy') {
      this.ballPos = { r: this.gridSize - 1, c: 1 };
      this.goalPos = { r: 0, c: 1 };
    } else {
      this.ballPos = {
        r: Math.floor(Math.random() * this.gridSize),
        c: Math.floor(Math.random() * this.gridSize)
      };

      do {
        this.goalPos = {
          r: Math.floor(Math.random() * this.gridSize),
          c: Math.floor(Math.random() * this.gridSize)
        };
      } while (
        Math.abs(this.goalPos.r - this.ballPos.r) + Math.abs(this.goalPos.c - this.ballPos.c) < (this.gridSize - 1)
      );
    }

    // Obstáculos en dificultad difícil (rocas)
    if (this.difficulty === 'hard') {
      const obstacleCount = 2;
      for (let i = 0; i < obstacleCount; i++) {
        let obsR, obsC;
        let attempts = 0;
        do {
          obsR = Math.floor(Math.random() * this.gridSize);
          obsC = Math.floor(Math.random() * this.gridSize);
          attempts++;
        } while (
          attempts < 50 &&
          ((obsR === this.ballPos.r && obsC === this.ballPos.c) ||
           (obsR === this.goalPos.r && obsC === this.goalPos.c) ||
           this.obstacles.some(o => o.r === obsR && o.c === obsC))
        );

        if (attempts < 50) {
          this.obstacles.push({ r: obsR, c: obsC });
        }
      }
    }

    this.renderBoard();

    if (this.mode === 'adventure') {
      this.promptNextStepAdventure();
    } else if (this.mode === 'memory') {
      this.startMemoryMission();
    } else if (this.mode === 'speed') {
      this.promptNextStepSpeed();
    }
  }

  /**
   * Dibuja el tablero en el elemento HTML #gameBoard
   */
  renderBoard() {
    const boardEl = document.getElementById('gameBoard');
    if (!boardEl) return;

    boardEl.innerHTML = '';
    boardEl.style.gridTemplateColumns = `repeat(${this.gridSize}, 1fr)`;
    boardEl.style.gridTemplateRows = `repeat(${this.gridSize}, 1fr)`;

    // Adaptar clase de tamaño para dificultad difícil (5x5)
    boardEl.className = `game-board grid-${this.gridSize}x${this.gridSize}`;

    for (let r = 0; r < this.gridSize; r++) {
      for (let c = 0; c < this.gridSize; c++) {
        const cell = document.createElement('div');
        cell.className = 'board-cell';
        cell.dataset.row = r;
        cell.dataset.col = c;

        // Meta (Estrella)
        if (r === this.goalPos.r && c === this.goalPos.c) {
          cell.classList.add('target-goal');
          cell.title = '¡Meta: Estrella Dorada!';
        }

        // Obstáculo
        const isObs = this.obstacles.some(o => o.r === r && o.c === c);
        if (isObs) {
          cell.classList.add('obstacle');
        }

        boardEl.appendChild(cell);
      }
    }

    this.placeBallElement();
  }

  /**
   * Renderiza el elemento flotante de Bolita
   */
  placeBallElement() {
    const boardEl = document.getElementById('gameBoard');
    let ballEl = document.getElementById('travelingBallEl');

    if (!ballEl) {
      ballEl = document.createElement('div');
      ballEl.id = 'travelingBallEl';
      ballEl.className = 'traveling-ball';
      ballEl.innerHTML = `
        <div class="ball-inner-face">
          <span class="b-eye left"></span>
          <span class="b-eye right"></span>
          <span class="b-mouth"></span>
        </div>
      `;
      boardEl.appendChild(ballEl);
    }

    // Doble verificación en próximo frame para asegurar dimensiones correctas
    requestAnimationFrame(() => {
      this.positionBallOnCell(this.ballPos.r, this.ballPos.c);
    });
  }

  positionBallOnCell(r, c) {
    const boardEl = document.getElementById('gameBoard');
    const ballEl = document.getElementById('travelingBallEl');
    if (!boardEl || !ballEl) return;

    const targetCell = boardEl.querySelector(`[data-row="${r}"][data-col="${c}"]`);
    if (targetCell) {
      const cellRect = targetCell.getBoundingClientRect();
      const boardRect = boardEl.getBoundingClientRect();

      const ballW = ballEl.offsetWidth || 56;
      const ballH = ballEl.offsetHeight || 56;

      const offsetLeft = cellRect.left - boardRect.left + (cellRect.width - ballW) / 2;
      const offsetTop = cellRect.top - boardRect.top + (cellRect.height - ballH) / 2;

      ballEl.style.transform = `translate(${offsetLeft}px, ${offsetTop}px)`;
    }
  }

  /**
   * Comprueba si una dirección está bloqueada por obstáculos o bordes
   */
  isMoveBlocked(r, c, dir) {
    let nr = r;
    let nc = c;
    if (dir === 'up') nr--;
    if (dir === 'down') nr++;
    if (dir === 'left') nc--;
    if (dir === 'right') nc++;

    if (nr < 0 || nr >= this.gridSize || nc < 0 || nc >= this.gridSize) return true;
    return this.obstacles.some(o => o.r === nr && o.c === nc);
  }

  /**
   * Modo 1: Aventura Guiada
   * Calcula la dirección óptima evitando obstáculos
   */
  promptNextStepAdventure() {
    const diffR = this.goalPos.r - this.ballPos.r;
    const diffC = this.goalPos.c - this.ballPos.c;

    if (diffR === 0 && diffC === 0) {
      this.onGoalReached();
      return;
    }

    const preferredDirs = [];
    if (diffR > 0) preferredDirs.push('down');
    else if (diffR < 0) preferredDirs.push('up');

    if (diffC > 0) preferredDirs.push('right');
    else if (diffC < 0) preferredDirs.push('left');

    // Filtrar direcciones libres de obstáculos
    let validDirs = preferredDirs.filter(d => !this.isMoveBlocked(this.ballPos.r, this.ballPos.c, d));

    // Si los caminos directos están tapados por una roca, buscar desvío
    if (validDirs.length === 0) {
      const allDirs = ['up', 'down', 'left', 'right'];
      validDirs = allDirs.filter(d => !this.isMoveBlocked(this.ballPos.r, this.ballPos.c, d));
    }

    if (validDirs.length === 0) {
      // Caso extremo: totalmente rodeado; limpiar obstáculos para continuar
      this.obstacles = [];
      this.renderBoard();
      this.promptNextStepAdventure();
      return;
    }

    this.currentExpectedDir = validDirs[Math.floor(Math.random() * validDirs.length)];
    this.announceInstruction(this.currentExpectedDir);
  }

  /**
   * Modo 2: Secuencias de Memoria
   */
  startMemoryMission() {
    const seqLength = this.difficulty === 'easy' ? 2 : (this.difficulty === 'medium' ? 3 : 4);
    const dirs = ['up', 'down', 'left', 'right'];
    this.memorySequence = [];

    for (let i = 0; i < seqLength; i++) {
      this.memorySequence.push(dirs[Math.floor(Math.random() * dirs.length)]);
    }

    this.memoryStepIndex = 0;
    this.isWaitingInput = false;

    const dirSpanish = {
      up: 'ARRIBA',
      down: 'ABAJO',
      left: 'IZQUIERDA',
      right: 'DERECHA'
    };

    const seqTextSpoken = this.memorySequence.map((d, idx) => `Paso ${idx + 1}: ¡${dirSpanish[d]}!`).join(', ');
    const displayHtml = `Memoriza el camino secreto:<br> ${this.memorySequence.map(d => `<strong class="dir-highlight dir-${d}">${dirSpanish[d]}</strong>`).join(' ➔ ')}`;

    this.setInstructionUI(displayHtml, 'Secuencia de Memoria');
    window.soundController.playTurnBell();

    window.speechService.speak(
      `¡Atención amiguito! Memoriza mi camino: ${seqTextSpoken}. Ahora repítelo tú.`,
      () => {
        this.isWaitingInput = true;
        this.currentExpectedDir = this.memorySequence[0];
        this.promptTime = Date.now();
        this.startTurnTimer();
        this.setInstructionUI(
          `Tu turno: Ingresa el <strong>Paso 1</strong> de ${this.memorySequence.length}`,
          'Memoria de Trabajo'
        );
      }
    );
  }

  /**
   * Modo 3: Reacción Espacial Rápida
   */
  promptNextStepSpeed() {
    const dirs = ['up', 'down', 'left', 'right'];
    this.currentExpectedDir = dirs[Math.floor(Math.random() * dirs.length)];
    this.announceInstruction(this.currentExpectedDir, '¡Rápido! ');
  }

  /**
   * Emite la instrucción con voz y banner visual
   */
  announceInstruction(dir, prefix = '') {
    this.clearTurnTimer();
    this.isWaitingInput = false;

    const names = {
      up: { es: 'ARRIBA', icon: '⬆️' },
      down: { es: 'ABAJO', icon: '⬇️' },
      left: { es: 'IZQUIERDA', icon: '⬅️' },
      right: { es: 'DERECHA', icon: '➡️' }
    };

    const targetInfo = names[dir];

    // Comunicar la dirección esperada a la cámara
    if (window.cameraTracker) {
      window.cameraTracker.setExpectedDirection(dir);
    }

    let phraseSpoken = '';
    if (this.controlMode === 'camera' || (window.cameraTracker && window.cameraTracker.isActive)) {
      const bodyActions = {
        up: '¡Salta hacia arriba o levanta tus manos!',
        down: '¡Agáchate hacia el suelo, hacia abajo!',
        left: '¡Muévete hacia tu izquierda!',
        right: '¡Muévete hacia tu derecha!'
      };
      phraseSpoken = `${prefix}${bodyActions[dir] || `¡Mueve tu cuerpo hacia ${targetInfo.es.toLowerCase()}!`}`;
    } else {
      phraseSpoken = `${prefix}¡Mueve la pelota hacia ${targetInfo.es.toLowerCase()}!`;
    }

    const phraseDisplay = `${prefix}¡Mueve a Bolita hacia <strong class="dir-highlight dir-${dir}">${targetInfo.icon} ${targetInfo.es}</strong>!`;

    this.setInstructionUI(phraseDisplay, 'Bolita te dice:');
    window.soundController.playTurnBell();

    window.speechService.speak(phraseSpoken, () => {
      this.isWaitingInput = true;
      this.promptTime = Date.now();
      this.startTurnTimer();
    });
  }

  /**
   * Temporizador activo por turno según la dificultad
   */
  startTurnTimer() {
    this.clearTurnTimer();
    this.timeRemaining = this.turnTimeLimitSeconds;
    this.updateTimerDisplay();

    this.turnTimerInterval = setInterval(() => {
      this.timeRemaining = Math.max(0, this.timeRemaining - 1);
      this.updateTimerDisplay();

      if (this.timeRemaining <= 0) {
        this.handleTurnTimeout();
      }
    }, 1000);
  }

  clearTurnTimer() {
    if (this.turnTimerInterval) {
      clearInterval(this.turnTimerInterval);
      this.turnTimerInterval = null;
    }
  }

  updateTimerDisplay() {
    const timerEl = document.getElementById('timerDisplay');
    if (timerEl) {
      timerEl.textContent = `${this.timeRemaining}s`;
    }
  }

  /**
   * Cuando se acaba el tiempo asignado al movimiento
   */
  handleTurnTimeout() {
    this.clearTurnTimer();
    if (!this.isWaitingInput || !this.currentExpectedDir) return;

    if (this.difficulty === 'easy') {
      // En modo fácil: recordatorio suave y reinicio de tiempo sin frustrar
      window.speechService.speak(`¡Vamos amiguito! Recuerda moverte hacia ${this.currentExpectedDir}. ¡Tú puedes!`, () => {
        this.promptTime = Date.now();
        this.isWaitingInput = true;
        this.startTurnTimer();
      });
    } else {
      // En modo normal o difícil: registrar vacilación y dar nueva oportunidad
      this.stats.directions[this.currentExpectedDir].errors++;
      this.stats.streak = 0;
      this.updateHUD();
      window.soundController.playGentleTryAgain();

      window.speechService.speak(`¡Se acabó el tiempo! Vamos a intentarlo de nuevo hacia ${this.currentExpectedDir}.`, () => {
        this.promptTime = Date.now();
        this.isWaitingInput = true;
        this.startTurnTimer();
      });
    }
  }

  setInstructionUI(htmlContent, title = 'Bolita te dice:') {
    const textEl = document.getElementById('instructionText');
    const titleEl = document.querySelector('.instruction-title');
    if (textEl) textEl.innerHTML = htmlContent;
    if (titleEl) titleEl.textContent = title;
  }

  /**
   * Repite la instrucción actual si el niño lo pide
   */
  repeatCurrentInstruction() {
    if (!this.currentExpectedDir) return;
    const names = {
      up: 'ARRIBA',
      down: 'ABAJO',
      left: 'IZQUIERDA',
      right: 'DERECHA'
    };
    if (this.controlMode === 'camera' || (window.cameraTracker && window.cameraTracker.isActive)) {
      const bodyActions = {
        up: '¡Salta o levanta tus manos hacia arriba!',
        down: '¡Agáchate hacia abajo!',
        left: '¡Muévete a tu izquierda!',
        right: '¡Muévete a tu derecha!'
      };
      window.speechService.speak(bodyActions[this.currentExpectedDir]);
    } else {
      window.speechService.speak(`¡Mueve la pelota hacia ${names[this.currentExpectedDir].toLowerCase()}!`);
    }
  }

  /**
   * Procesa la entrada del usuario (desde cámara, botón, voz o teclado)
   */
  handleUserMove(inputDir, source = 'manual') {
    if (!this.isWaitingInput || !this.currentExpectedDir) return;

    this.clearTurnTimer();
    const now = Date.now();
    const reactionTime = Math.max(200, now - this.promptTime);

    // Registro métrico por fuente de entrada
    if (source === 'camera') {
      this.stats.cameraAttempts++;
      this.stats.inputSources.camera++;
    } else if (source === 'voice') {
      this.stats.inputSources.voice++;
    } else {
      this.stats.inputSources.touch++;
    }

    // Registro métrico para la dirección solicitada
    const expDir = this.currentExpectedDir;
    this.stats.directions[expDir].attempts++;

    if (inputDir === expDir) {
      // ¡ACIERTO!
      this.stats.directions[expDir].hits++;
      if (source === 'camera') {
        this.stats.cameraHits++;
      }

      this.stats.reactionTimes.push(reactionTime);
      this.stats.streak++;
      if (this.stats.streak > this.stats.maxStreak) {
        this.stats.maxStreak = this.stats.streak;
      }
      this.stats.score += Math.max(10, Math.round(50 - (reactionTime / 100)));

      window.soundController.playSuccess();
      this.updateHUD();

      // Animación de salto de la pelota
      this.animateBallMove(inputDir, () => {
        if (this.mode === 'memory') {
          this.handleMemorySuccessStep();
        } else if (this.mode === 'speed') {
          this.handleSpeedSuccessStep();
        } else {
          // Aventura estándar
          this.promptNextStepAdventure();
        }
      });
    } else {
      // ERROR / CONFUSIÓN
      this.stats.directions[expDir].errors++;
      this.stats.streak = 0;
      this.updateHUD();

      window.soundController.playGentleTryAgain();

      const names = {
        up: 'Arriba',
        down: 'Abajo',
        left: 'Izquierda',
        right: 'Derecha'
      };

      const gentlePhrase = `¡Casi! Detecté ${names[inputDir] || inputDir}. Intenta hacia ${names[expDir]}. ¡Tú puedes!`;
      this.setInstructionUI(`¡Casi! Vamos de nuevo: <strong class="dir-highlight dir-${expDir}">${names[expDir]}</strong>`, '¡Ánimo!');
      window.speechService.speak(gentlePhrase, () => {
        this.promptTime = Date.now();
        this.isWaitingInput = true;
        this.startTurnTimer();
      });
    }
  }

  /**
   * Mueve físicamente a Bolita por la cuadrícula respetando límites y obstáculos
   */
  animateBallMove(dir, onDone) {
    this.isWaitingInput = false;

    let targetR = this.ballPos.r;
    let targetC = this.ballPos.c;

    if (dir === 'up') targetR = Math.max(0, this.ballPos.r - 1);
    else if (dir === 'down') targetR = Math.min(this.gridSize - 1, this.ballPos.r + 1);
    else if (dir === 'left') targetC = Math.max(0, this.ballPos.c - 1);
    else if (dir === 'right') targetC = Math.min(this.gridSize - 1, this.ballPos.c + 1);

    // Si no está bloqueado por obstáculo, avanzar
    const hitObs = this.obstacles.some(o => o.r === targetR && o.c === targetC);
    if (!hitObs) {
      this.ballPos.r = targetR;
      this.ballPos.c = targetC;
    }

    const ballEl = document.getElementById('travelingBallEl');
    if (ballEl) {
      ballEl.classList.add('jumping');
      this.positionBallOnCell(this.ballPos.r, this.ballPos.c);

      setTimeout(() => {
        ballEl.classList.remove('jumping');
        if (onDone) onDone();
      }, 350);
    } else {
      if (onDone) onDone();
    }
  }

  handleMemorySuccessStep() {
    this.memoryStepIndex++;
    if (this.memoryStepIndex >= this.memorySequence.length) {
      // Secuencia completa con éxito
      this.stats.memoryHits++;
      this.stats.memoryTotal++;
      this.onGoalReached();
    } else {
      // Siguiente paso de la secuencia
      this.currentExpectedDir = this.memorySequence[this.memoryStepIndex];
      this.setInstructionUI(
        `¡Bien! Ahora el <strong>Paso ${this.memoryStepIndex + 1}</strong> de ${this.memorySequence.length}`,
        'Secuencia de Memoria'
      );
      this.promptTime = Date.now();
      this.isWaitingInput = true;
      this.startTurnTimer();
    }
  }

  handleSpeedSuccessStep() {
    this.currentMission++;
    if (this.currentMission > this.maxMissions) {
      this.finishSession();
    } else {
      this.updateHUD();
      setTimeout(() => {
        this.promptNextStepSpeed();
      }, 500);
    }
  }

  /**
   * Cuando Bolita alcanza la estrella meta
   */
  onGoalReached() {
    this.clearTurnTimer();
    window.soundController.playFanfare();

    const ballEl = document.getElementById('travelingBallEl');
    if (ballEl) ballEl.classList.add('celebrating');

    this.stats.score += 100;
    this.updateHUD();

    this.setInstructionUI('⭐ ¡EXTRAORDINARIO! ¡Alcanzamos la estrella dorada! ⭐', '¡Misión Cumplida!');

    window.speechService.speak('¡Bravo amiguito! ¡Conseguimos la estrella dorada!', () => {
      setTimeout(() => {
        if (ballEl) ballEl.classList.remove('celebrating');
        this.currentMission++;

        if (this.currentMission > this.maxMissions) {
          this.finishSession();
        } else {
          this.setupMission();
        }
      }, 1000);
    });
  }

  /**
   * Actualiza el marcador superior (puntos, misión, racha)
   */
  updateHUD() {
    const scoreEl = document.getElementById('scoreDisplay');
    const missionEl = document.getElementById('missionDisplay');
    const streakEl = document.getElementById('streakDisplay');

    if (scoreEl) scoreEl.textContent = this.stats.score;
    if (missionEl) missionEl.textContent = `${this.currentMission} / ${this.maxMissions}`;
    if (streakEl) streakEl.textContent = `🔥 ${this.stats.streak}`;
  }

  /**
   * Finaliza la sesión y genera el reporte
   */
  finishSession() {
    this.clearTurnTimer();
    this.isWaitingInput = false;
    window.speechService.stopSpeaking();

    const durationSeconds = Math.max(1, Math.round((Date.now() - this.sessionStartTime) / 1000));
    const mins = Math.floor(durationSeconds / 60);
    const secs = durationSeconds % 60;
    const durationFormatted = `${mins} min ${secs} seg`;

    const sessionData = {
      kid: this.kidProfile,
      mode: this.mode,
      difficulty: this.difficulty,
      controlMode: this.controlMode,
      durationSeconds,
      durationFormatted,
      stats: this.stats
    };

    if (this.onGameFinished) {
      this.onGameFinished(sessionData);
    }
  }
}

// Instancia global
window.gameEngine = new BallAdventureGame();
