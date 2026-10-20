/**
 * ============================================================================
 * LA PELOTA VIAJERA - CONTROLADOR PRINCIPAL Y EVENTOS DE INTERFAZ
 * ============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  // Referencias a pantallas
  const screenProfile = document.getElementById('screenProfile');
  const screenGame = document.getElementById('screenGame');
  const screenReport = document.getElementById('screenReport');

  // Badge del header
  const currentKidBadge = document.getElementById('currentKidBadge');
  const badgeAvatar = document.getElementById('badgeAvatar');
  const badgeName = document.getElementById('badgeName');

  // Formulario de perfil
  const kidProfileForm = document.getElementById('kidProfileForm');
  const kidNameInput = document.getElementById('kidNameInput');
  const kidAgeSelect = document.getElementById('kidAgeSelect');
  const avatarButtons = document.querySelectorAll('.avatar-opt');
  const controlModeSelect = document.getElementById('controlModeSelect');
  const gameModeSelect = document.getElementById('gameModeSelect');
  const difficultySelect = document.getElementById('difficultySelect');
  let selectedAvatar = '👦';

  // Botones de cabecera
  const btnCameraToggle = document.getElementById('btnCameraToggle');
  const btnVoiceToggle = document.getElementById('btnVoiceToggle');
  const btnAudioToggle = document.getElementById('btnAudioToggle');
  const audioIcon = document.getElementById('audioIcon');
  const btnHelp = document.getElementById('btnHelp');

  // Elementos de la cámara interactiva
  const webcamVideo = document.getElementById('webcamVideo');
  const cameraOverlayCanvas = document.getElementById('cameraOverlayCanvas');
  const cameraPanelWrapper = document.getElementById('cameraPanelWrapper');

  // Modal de ayuda
  const helpModal = document.getElementById('helpModal');
  const btnCloseHelp = document.getElementById('btnCloseHelp');
  const btnAcceptHelp = document.getElementById('btnAcceptHelp');

  // Controles de juego
  const btnRepeatVoice = document.getElementById('btnRepeatInstruction');
  const btnEndEarly = document.getElementById('btnEndEarly');
  const dpadButtons = document.querySelectorAll('.dpad-btn');

  // Botones del reporte
  const btnPrintReport = document.getElementById('btnPrintReport');
  const btnPlayAgain = document.getElementById('btnPlayAgain');

  // Toast flotante
  const toastNotification = document.getElementById('toastNotification');

  function showToast(message, duration = 3000) {
    if (!toastNotification) return;
    toastNotification.textContent = message;
    toastNotification.style.display = 'block';
    setTimeout(() => {
      toastNotification.style.display = 'none';
    }, duration);
  }

  function showScreen(screen) {
    [screenProfile, screenGame, screenReport].forEach(s => {
      if (s) s.classList.remove('active');
    });
    if (screen) screen.classList.add('active');
  }

  // --- Inicializar Cámara y Callback de Movimiento Corporal ---
  if (window.cameraTracker && webcamVideo && cameraOverlayCanvas) {
    window.cameraTracker.init(webcamVideo, cameraOverlayCanvas);

    // Cuando el niño se mueve frente a la cámara en la dirección pedida
    window.cameraTracker.onDirectionDetected = (dir) => {
      showToast(`📹 ¡Cámara captó movimiento: ${dir.toUpperCase()}!`);
      window.gameEngine.handleUserMove(dir, 'camera');
    };
  }

  // --- Selección de Avatar ---
  avatarButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      avatarButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedAvatar = btn.dataset.avatar;
    });
  });

  // --- Inicio del Juego (Envío de Formulario) ---
  kidProfileForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = kidNameInput.value.trim() || 'Amiguito';
    const age = kidAgeSelect.value;
    const controlMode = controlModeSelect ? controlModeSelect.value : 'camera';
    const mode = gameModeSelect.value;
    const difficulty = difficultySelect.value;

    const profile = {
      name,
      age,
      avatar: selectedAvatar
    };

    // Actualizar badge superior
    if (badgeAvatar) badgeAvatar.textContent = profile.avatar;
    if (badgeName) badgeName.textContent = profile.name;
    if (currentKidBadge) currentKidBadge.style.display = 'flex';

    showScreen(screenGame);

    // Activar métodos de interacción según la preferencia
    if (controlMode === 'camera' || controlMode === 'hybrid') {
      if (cameraPanelWrapper) cameraPanelWrapper.style.display = 'flex';
      const camOk = await window.cameraTracker.start();
      if (camOk) {
        showToast('📹 ¡Cámara encendida! Ponte frente a la pantalla y muévete.', 4000);
      }
    } else {
      if (cameraPanelWrapper) cameraPanelWrapper.style.display = 'none';
      if (window.cameraTracker) window.cameraTracker.stop();
    }

    if (controlMode === 'voice' || controlMode === 'hybrid') {
      if (!window.speechService.voiceEnabled) {
        window.speechService.toggleMicrophone();
      }
    }

    // Inicializar motor de juego con dificultad y modo de control
    window.gameEngine.startSession(profile, mode, difficulty, controlMode);
  });

  // --- Callback de fin de juego -> Reporte ---
  window.gameEngine.onGameFinished = (sessionData) => {
    if (window.cameraTracker) {
      window.cameraTracker.stop();
    }
    showScreen(screenReport);
    window.reportGenerator.generate(sessionData);
  };

  // --- Botón de terminar anticipadamente ---
  btnEndEarly.addEventListener('click', () => {
    if (confirm('¿Deseas finalizar la sesión actual y ver el reporte de habilidades cognitivas?')) {
      window.gameEngine.finishSession();
    }
  });

  // --- Botón para volver a jugar ---
  btnPlayAgain.addEventListener('click', () => {
    if (window.cameraTracker) {
      window.cameraTracker.stop();
    }
    showScreen(screenProfile);
  });

  // --- Botón para Imprimir / Guardar en PDF ---
  btnPrintReport.addEventListener('click', () => {
    window.print();
  });

  // --- Repetir Instrucción ---
  btnRepeatVoice.addEventListener('click', () => {
    window.gameEngine.repeatCurrentInstruction();
  });

  // --- Integración de Comandos de Voz hacia el Juego ---
  window.speechService.onDirectionCommand = (dir, originalText) => {
    showToast(`🎙️ Voz reconocida: ${dir.toUpperCase()}`);
    window.gameEngine.handleUserMove(dir, 'voice');
  };

  // --- Toggle de Cámara desde el Header ---
  if (btnCameraToggle) {
    btnCameraToggle.addEventListener('click', async () => {
      if (!window.cameraTracker) return;
      if (window.cameraTracker.isActive) {
        window.cameraTracker.stop();
        showToast('📹 Cámara apagada');
      } else {
        const ok = await window.cameraTracker.start();
        if (ok) {
          showToast('📹 Cámara encendida y activa');
          if (cameraPanelWrapper) cameraPanelWrapper.style.display = 'flex';
        } else {
          showToast('⚠️ No se pudo acceder a la cámara');
        }
      }
    });
  }

  // --- Toggle de Tamaño del Espejo de Cámara ---
  const btnExpandCamera = document.getElementById('btnExpandCamera');
  if (btnExpandCamera && cameraPanelWrapper) {
    btnExpandCamera.addEventListener('click', () => {
      cameraPanelWrapper.classList.toggle('expanded');
      const isExpanded = cameraPanelWrapper.classList.contains('expanded');
      btnExpandCamera.textContent = isExpanded ? '🔍 Normal' : '🔍 Tamaño';
      showToast(isExpanded ? '✨ Espejo Mágico ampliado' : '✨ Espejo Mágico tamaño estándar');
    });
  }

  // --- Toggle de Micrófono desde el Header ---
  btnVoiceToggle.addEventListener('click', () => {
    const active = window.speechService.toggleMicrophone();
    if (active) {
      showToast('🎙️ Micrófono encendido. ¡Habla claro!');
    } else {
      showToast('🔇 Micrófono en pausa');
    }
  });

  // --- Toggle de Sonido ---
  btnAudioToggle.addEventListener('click', () => {
    const isMuted = !window.soundController.toggle();
    audioIcon.textContent = isMuted ? '🔇' : '🔊';
    showToast(isMuted ? 'Sonidos silenciados' : 'Sonidos activados');
  });

  // --- Manejo del D-PAD táctil ---
  dpadButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const dir = btn.dataset.dir;
      if (dir) {
        window.soundController.playHop();
        window.gameEngine.handleUserMove(dir, 'touch');
      }
    });
  });

  // --- Controles de Teclado (Flechas y WASD) ---
  window.addEventListener('keydown', (e) => {
    if (!screenGame.classList.contains('active')) return;

    let dir = null;
    switch (e.key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        dir = 'up';
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        dir = 'down';
        break;
      case 'ArrowLeft':
      case 'a':
      case 'A':
        dir = 'left';
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        dir = 'right';
        break;
    }

    if (dir) {
      e.preventDefault();
      window.soundController.playHop();
      window.gameEngine.handleUserMove(dir, 'keyboard');
    }
  });

  // --- Modal de Ayuda ---
  const toggleModal = (show) => {
    helpModal.style.display = show ? 'flex' : 'none';
  };

  btnHelp.addEventListener('click', () => toggleModal(true));
  btnCloseHelp.addEventListener('click', () => toggleModal(false));
  btnAcceptHelp.addEventListener('click', () => toggleModal(false));

  helpModal.addEventListener('click', (e) => {
    if (e.target === helpModal) toggleModal(false);
  });

  // --- Recalcular posición de la pelota al redimensionar ventana ---
  window.addEventListener('resize', () => {
    if (screenGame.classList.contains('active')) {
      window.gameEngine.positionBallOnCell(window.gameEngine.ballPos.r, window.gameEngine.ballPos.c);
    }
  });
});
