/**
 * ============================================================================
 * LA PELOTA VIAJERA - MOTOR DE VOZ (SÍNTESIS Y RECONOCIMIENTO)
 * ============================================================================
 */

class SpeechService {
  constructor() {
    this.synth = window.speechSynthesis || null;
    this.recognition = null;
    this.voiceEnabled = false;
    this.isListening = false;
    this.preferredVoice = null;
    this.onDirectionCommand = null; // Callback: (dir, text) => {}
    this.activeSafetyTimeout = null;

    this.initVoices();
    this.initRecognition();
  }

  initVoices() {
    if (!this.synth) return;

    const pickSpanishVoice = () => {
      try {
        const voices = this.synth.getVoices();
        if (!voices || voices.length === 0) return;

        // Priorizar voces en español naturales y amigables
        this.preferredVoice = voices.find(v => 
          (v.lang.startsWith('es') || v.lang.includes('ES') || v.lang.includes('MX') || v.lang.includes('CO')) &&
          (v.name.toLowerCase().includes('sabina') || v.name.toLowerCase().includes('monica') || 
           v.name.toLowerCase().includes('helena') || v.name.toLowerCase().includes('paulina') ||
           v.name.toLowerCase().includes('natural') || v.name.toLowerCase().includes('female'))
        ) || voices.find(v => v.lang.startsWith('es')) || voices[0];
      } catch (e) {
        console.warn('Error al buscar voces:', e);
      }
    };

    pickSpanishVoice();
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = pickSpanishVoice;
    }
  }

  /**
   * Bolita habla con una voz expresiva y cálida
   * Incluye temporizador de seguridad para evitar que la cola de voz se congele en Chrome/Edge
   */
  speak(text, onEnd = null) {
    if (this.activeSafetyTimeout) {
      clearTimeout(this.activeSafetyTimeout);
      this.activeSafetyTimeout = null;
    }

    if (!this.synth) {
      if (onEnd) onEnd();
      return;
    }

    // Cancelar cualquier locución anterior pendiente
    try {
      this.synth.cancel();
    } catch (e) {
      console.warn(e);
    }

    let endFired = false;
    const safeEnd = () => {
      if (endFired) return;
      endFired = true;
      if (this.activeSafetyTimeout) {
        clearTimeout(this.activeSafetyTimeout);
        this.activeSafetyTimeout = null;
      }
      const ballAvatar = document.getElementById('ballSpeakerAvatar');
      if (ballAvatar) ballAvatar.classList.remove('talking');
      if (onEnd) onEnd();
    };

    // Temporizador de seguridad: si SpeechSynthesis se queda colgado, continuar tras tiempo estimado
    const timeoutDuration = Math.max(3000, text.length * 130);
    this.activeSafetyTimeout = setTimeout(safeEnd, timeoutDuration);

    setTimeout(() => {
      try {
        if (this.synth.paused) {
          this.synth.resume();
        }

        const utterance = new SpeechSynthesisUtterance(text);
        if (this.preferredVoice) {
          utterance.voice = this.preferredVoice;
        }
        utterance.lang = 'es-ES';
        utterance.pitch = 1.25; // Tono alegre infantil
        utterance.rate = 0.95;  // Velocidad pausada y clara

        const ballAvatar = document.getElementById('ballSpeakerAvatar');
        if (ballAvatar) ballAvatar.classList.add('talking');

        utterance.onend = () => {
          safeEnd();
        };

        utterance.onerror = (e) => {
          console.warn('Evento error síntesis voz:', e);
          safeEnd();
        };

        this.synth.speak(utterance);
      } catch (err) {
        console.warn('Error al reproducir locución:', err);
        safeEnd();
      }
    }, 30);
  }

  stopSpeaking() {
    if (this.activeSafetyTimeout) {
      clearTimeout(this.activeSafetyTimeout);
      this.activeSafetyTimeout = null;
    }

    if (this.synth) {
      try {
        this.synth.cancel();
      } catch (e) {
        console.warn(e);
      }
      const ballAvatar = document.getElementById('ballSpeakerAvatar');
      if (ballAvatar) ballAvatar.classList.remove('talking');
    }
  }

  /**
   * Configurar el reconocimiento de voz para comandos del niño
   */
  initRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('SpeechRecognition no está disponible en este navegador.');
      return;
    }

    try {
      this.recognition = new SpeechRecognition();
      this.recognition.lang = 'es-ES';
      this.recognition.continuous = true;
      this.recognition.interimResults = false;
      this.recognition.maxAlternatives = 3;

      this.recognition.onstart = () => {
        this.isListening = true;
        this.updateMicUI(true);
      };

      this.recognition.onend = () => {
        // Si sigue activado por el usuario, reiniciar escucha continua
        if (this.voiceEnabled) {
          try {
            this.recognition.start();
          } catch (e) {
            this.isListening = false;
            this.updateMicUI(false);
          }
        } else {
          this.isListening = false;
          this.updateMicUI(false);
        }
      };

      this.recognition.onerror = (event) => {
        console.warn('Evento de reconocimiento de voz:', event.error);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          this.voiceEnabled = false;
          this.updateMicUI(false);
          this.showFeedback('⚠️ Micrófono bloqueado. Permite el acceso o usa la cámara y botones.');
        }
      };

      this.recognition.onresult = (event) => {
        const lastResult = event.results[event.results.length - 1];
        if (lastResult && lastResult.isFinal) {
          const transcript = lastResult[0].transcript.toLowerCase().trim();
          this.processVoiceCommand(transcript);
        }
      };
    } catch (e) {
      console.warn('No se pudo inicializar SpeechRecognition:', e);
    }
  }

  /**
   * Analiza la palabra hablada y mapea a dirección espacial
   */
  processVoiceCommand(phrase) {
    if (!phrase) return;

    // Normalizar tildes y caracteres especiales
    const clean = phrase.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    let direction = null;

    // Reconocimiento flexible adaptado al lenguaje infantil
    if (/\b(arriba|sube|subir|alto|arribita|salta|saltar|arriba)\b/.test(clean)) {
      direction = 'up';
    } else if (/\b(abajo|baja|bajar|bajo|abajito|agachate|agachar|agachate|piso|suelo)\b/.test(clean)) {
      direction = 'down';
    } else if (/\b(izquierda|izq|izquierdita)\b/.test(clean)) {
      direction = 'left';
    } else if (/\b(derecha|der|derechita)\b/.test(clean)) {
      direction = 'right';
    }

    const feedbackElement = document.getElementById('voiceHeardWord');
    if (feedbackElement) {
      feedbackElement.textContent = `Escuché: "${phrase.toUpperCase()}"`;
    }

    if (direction && this.onDirectionCommand) {
      this.onDirectionCommand(direction, phrase);
    }
  }

  toggleMicrophone() {
    if (!this.recognition) {
      alert('Tu navegador actual no soporta reconocimiento de voz continuo (recomendamos Google Chrome o Microsoft Edge). ¡Puedes usar la cámara o los botones!');
      return false;
    }

    this.voiceEnabled = !this.voiceEnabled;

    if (this.voiceEnabled) {
      try {
        this.recognition.start();
        this.updateMicUI(true);
        this.showFeedback('🎙️ Micrófono activado. ¡Di: Arriba, Abajo, Izquierda o Derecha!');
      } catch (e) {
        console.warn('No se pudo iniciar el micrófono:', e);
      }
    } else {
      try {
        this.recognition.stop();
        this.updateMicUI(false);
        this.showFeedback('🎙️ Micrófono desactivado.');
      } catch (e) {
        console.warn(e);
      }
    }

    return this.voiceEnabled;
  }

  updateMicUI(active) {
    const micDot = document.getElementById('micStatusDot');
    const feedbackBar = document.getElementById('voiceFeedbackBar');
    if (micDot) {
      micDot.className = `status-dot ${active ? 'on' : 'off'}`;
    }
    if (feedbackBar) {
      feedbackBar.style.display = active ? 'flex' : 'none';
    }
  }

  showFeedback(message) {
    const feedbackElement = document.getElementById('voiceHeardWord');
    if (feedbackElement) {
      feedbackElement.textContent = message;
    }
  }
}

// Instancia global
window.speechService = new SpeechService();
