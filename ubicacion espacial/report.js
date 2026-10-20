/**
 * ============================================================================
 * LA PELOTA VIAJERA - MOTOR DE EVALUACIÓN Y REPORTE COGNITIVO
 * Análisis pedagógico de orientación espacial, lateralidad y memoria de trabajo
 * ============================================================================
 */

class CognitiveReportGenerator {
  constructor() {
    this.storageKey = 'pelota_viajera_evaluaciones';
  }

  /**
   * Genera el informe psicopedagógico completo a partir de la sesión de juego
   */
  generate(sessionData) {
    const analysis = this.analyzeMetrics(sessionData);
    this.renderReport(sessionData, analysis);
    this.saveSession(sessionData, analysis);
    return analysis;
  }

  /**
   * Computa los indicadores y la inferencia diagnóstica
   */
  analyzeMetrics(data) {
    const stats = data.stats;
    const dirStats = stats.directions;

    // Métricas por eje
    const horizAttempts = (dirStats.left.attempts || 0) + (dirStats.right.attempts || 0);
    const horizHits = (dirStats.left.hits || 0) + (dirStats.right.hits || 0);
    const horizAccuracy = horizAttempts > 0 ? Math.round((horizHits / horizAttempts) * 100) : 100;

    const vertAttempts = (dirStats.up.attempts || 0) + (dirStats.down.attempts || 0);
    const vertHits = (dirStats.up.hits || 0) + (dirStats.down.hits || 0);
    const vertAccuracy = vertAttempts > 0 ? Math.round((vertHits / vertAttempts) * 100) : 100;

    // Tiempo de reacción promedio
    const avgReactionTime = stats.reactionTimes.length > 0 
      ? (stats.reactionTimes.reduce((a, b) => a + b, 0) / stats.reactionTimes.length) / 1000 
      : 1.5;

    // Memoria y atención
    const memoryAccuracy = stats.memoryTotal > 0
      ? Math.round((stats.memoryHits / stats.memoryTotal) * 100)
      : 100;

    // Métricas de cámara web / psicomotricidad corporal
    const cameraHits = stats.cameraHits || (window.cameraTracker ? window.cameraTracker.stats.cameraMovesSuccess : 0);
    const cameraAttempts = stats.cameraAttempts || (window.cameraTracker ? window.cameraTracker.stats.cameraMovesAttempted : 0);
    const cameraAccuracy = cameraAttempts > 0 ? Math.round((cameraHits / cameraAttempts) * 100) : 100;

    // Puntuación global ponderada (40% lateralidad, 30% verticalidad, 15% atención/memoria, 15% velocidad)
    const speedScore = Math.max(0, Math.min(100, Math.round(100 - (avgReactionTime - 1) * 20)));
    const globalScore = Math.round(
      (horizAccuracy * 0.40) + 
      (vertAccuracy * 0.30) + 
      (memoryAccuracy * 0.15) + 
      (speedScore * 0.15)
    );

    // Dictamen cualitativo y recomendaciones
    const diagnosis = this.synthesizeDiagnosis(data.kid, horizAccuracy, vertAccuracy, avgReactionTime, dirStats, cameraHits);
    const recommendations = this.generateRecommendations(data.kid, horizAccuracy, vertAccuracy, dirStats, cameraHits);

    return {
      horizAttempts,
      horizHits,
      horizAccuracy,
      vertAttempts,
      vertHits,
      vertAccuracy,
      avgReactionTime: avgReactionTime.toFixed(2),
      memoryAccuracy,
      cameraHits,
      cameraAttempts,
      cameraAccuracy,
      globalScore,
      diagnosis,
      recommendations
    };
  }

  /**
   * Elabora el texto de dictamen neurocognitivo según la edad y patrón de respuestas
   */
  synthesizeDiagnosis(kid, horizAcc, vertAcc, reactionTime, dirStats, cameraHits = 0) {
    const age = parseInt(kid.age, 10);
    const paragraphs = [];

    // Párrafo 1: Desempeño en eje vertical vs horizontal
    if (vertAcc >= 85 && horizAcc >= 85) {
      paragraphs.push(
        `<strong>Dominio espacial sobresaliente:</strong> El/La explorador(a) ${kid.name} (${age} años) demuestra una excelente discriminación topológica tanto en el plano vertical (arriba/abajo: ${vertAcc}%) como en la lateralidad horizontal (izquierda/derecha: ${horizAcc}%). Integra adecuadamente las órdenes auditivas y visuales con la respuesta motriz solicitada.`
      );
    } else if (vertAcc >= 80 && horizAcc < 75) {
      paragraphs.push(
        `<strong>Lateralidad en consolidación progresiva:</strong> ${kid.name} evidencia un claro afianzamiento del eje céfalo-caudal (arriba/abajo: ${vertAcc}%), lo cual concuerda con las leyes del desarrollo psicomotor. Sin embargo, en el eje horizontal (izquierda/derecha: ${horizAcc}%), se observan vacilaciones típicas de los ${age} años, donde la dominancia lateral y el esquema corporal aún se encuentran en fase de definición.`
      );
    } else if (vertAcc < 70 && horizAcc < 70) {
      paragraphs.push(
        `<strong>Necesidad de afianzamiento sensorio-motriz:</strong> Se registran confusiones en ambos planos espaciales. Para la edad de ${age} años, es recomendable enriquecer las experiencias con el propio cuerpo antes de pasar a representaciones en pantalla plana o bidimensional.`
      );
    } else {
      paragraphs.push(
        `<strong>Rendimiento adaptativo favorable:</strong> ${kid.name} completó las misiones con buen nivel de perseverancia y autorregulación, respondiendo con interés a los estímulos sonoros y visuales de la pelota.`
      );
    }

    // Párrafo 2: Integración Psicomotriz por Cámara (si hubo uso)
    if (cameraHits > 0) {
      paragraphs.push(
        `<strong>Interacción Corporal por Cámara Web:</strong> Se registraron <strong>${cameraHits} respuestas motrices captadas por visión computacional</strong>. El niño logró coordinar su esquema corporal en el espacio físico tridimensional (saltar, agacharse, desplazarse a los lados) respondiendo a estímulos en pantalla, lo que fortalece la propiocepción y la coordinación motriz gruesa.`
      );
    }

    // Párrafo 3: Discriminación específica de Izquierda vs Derecha
    const leftAcc = dirStats.left.attempts > 0 ? Math.round((dirStats.left.hits / dirStats.left.attempts) * 100) : 100;
    const rightAcc = dirStats.right.attempts > 0 ? Math.round((dirStats.right.hits / dirStats.right.attempts) * 100) : 100;

    if (Math.abs(leftAcc - rightAcc) >= 30) {
      const preferred = leftAcc > rightAcc ? 'Izquierda' : 'Derecha';
      const challenged = leftAcc > rightAcc ? 'Derecha' : 'Izquierda';
      paragraphs.push(
        `<strong>Asimetría lateral identificada:</strong> Se observa mayor familiaridad y seguridad al responder hacia la <strong>${preferred}</strong> (${Math.max(leftAcc, rightAcc)}%) en comparación con la <strong>${challenged}</strong> (${Math.min(leftAcc, rightAcc)}%). Esto suele indicar una preferencia de mano/lado que sirve como anclaje espacial de referencia.`
      );
    }

    // Párrafo 4: Velocidad psicomotriz y atención sostenida
    let velText = '';
    if (reactionTime < 1.3) {
      velText = 'muy ágil y de rápida respuesta refleja.';
    } else if (reactionTime <= 2.5) {
      velText = 'óptimo y reflexivo, con adecuado control inhibitorio antes de pulsar o hablar.';
    } else {
      velText = 'más pausado, sugiriendo que requiere un tiempo adicional de decodificación auditiva o visual para orientarse.';
    }
    paragraphs.push(
      `<strong>Velocidad de procesamiento:</strong> El tiempo medio de reacción motriz fue de <strong>${reactionTime} segundos</strong>, lo cual se clasifica como ${velText}`
    );

    return paragraphs;
  }

  /**
   * Genera recomendaciones pedagógicas aplicables en casa o escuela
   */
  generateRecommendations(kid, horizAcc, vertAcc, dirStats) {
    const list = [];
    const age = parseInt(kid.age, 10);

    // Recomendaciones según lateralidad
    if (horizAcc < 80) {
      list.push(
        `<strong>Técnica de la pulsera guía:</strong> Colocar una pulserita o cinta de color rojo en la muñeca derecha (o la mano dominante) de ${kid.name}. Servirá como ancla propioceptiva cuando deba identificar "derecha".`
      );
      list.push(
        `<strong>El juego del espejo corporal:</strong> Situarse frente a frente con el niño e imitar movimientos diciendo en voz alta: "mi mano derecha toca tu oreja izquierda". Ayuda a interiorizar la lateralidad cruzada y relativa.`
      );
    }

    // Recomendaciones para el eje vertical
    if (vertAcc < 80) {
      list.push(
        `<strong>Juegos de suelo y cielo:</strong> Realizar saltos tocando el suelo ("abajo") y estirándose como jirafas hacia el techo ("arriba") con canciones motrices.`
      );
    }

    // Recomendación general psicomotriz
    list.push(
      `<strong>Circuitos en el piso con cinta de papel:</strong> Dibujar flechas grandes en el pasillo de la casa o salón de clases para que ${kid.name} camine siguiendo las instrucciones auditivas de un adulto (ej: "camina 2 pasos a la izquierda").`
    );

    if (age <= 5) {
      list.push(
        `<strong>Refuerzo con objetos cotidianos:</strong> Pedirle que coloque objetos "arriba de la mesa", "debajo de la silla", "a la derecha del plato", verbalizando siempre el concepto espacial.`
      );
    } else {
      list.push(
        `<strong>Laberintos en papel y juegos de cuadrícula:</strong> Ejercitar laberintos con lápiz y papel o crucigramas visuales para fortalecer la orientación bidimensional de cara a la lectoescritura.`
      );
    }

    return list;
  }

  /**
   * Dibuja y actualiza la pantalla del reporte en el DOM
   */
  renderReport(sessionData, analysis) {
    const { kid, stats, durationFormatted } = sessionData;
    const now = new Date();
    const dateFormatted = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    // Datos generales
    document.getElementById('reportDate').textContent = `Fecha de evaluación: ${dateFormatted}`;
    document.getElementById('reportAvatar').textContent = kid.avatar || '👦';
    document.getElementById('reportKidName').textContent = kid.name || 'Amiguito';
    document.getElementById('reportKidAge').textContent = `${kid.age} años`;
    
    const modeNames = {
      adventure: '🗺️ Aventura Guiada',
      memory: '🧠 Secuencia y Memoria',
      speed: '⚡ Reacción Espacial Rápida'
    };
    document.getElementById('reportGameMode').textContent = modeNames[sessionData.mode] || sessionData.mode;

    const diffNames = {
      easy: 'Fácil (⭐)',
      medium: 'Normal (⭐⭐)',
      hard: 'Reto (⭐⭐⭐)'
    };
    document.getElementById('reportDifficulty').textContent = diffNames[sessionData.difficulty] || sessionData.difficulty;
    document.getElementById('reportDuration').textContent = durationFormatted;

    // Puntuación global
    document.getElementById('reportGlobalScore').textContent = `${analysis.globalScore}%`;

    // Barras y métricas
    const barH = document.getElementById('barHorizontal');
    barH.style.width = `${analysis.horizAccuracy}%`;
    document.getElementById('metricHorizontalText').textContent = `Acierto: ${analysis.horizAccuracy}%`;
    document.getElementById('metricHorizontalSub').textContent = `${analysis.horizHits} aciertos / ${analysis.horizAttempts} intentos`;

    const barV = document.getElementById('barVertical');
    barV.style.width = `${analysis.vertAccuracy}%`;
    document.getElementById('metricVerticalText').textContent = `Acierto: ${analysis.vertAccuracy}%`;
    document.getElementById('metricVerticalSub').textContent = `${analysis.vertHits} aciertos / ${analysis.vertAttempts} intentos`;

    document.getElementById('metricReactionTime').textContent = `${analysis.avgReactionTime} s`;
    const hintElem = document.getElementById('metricReactionHint');
    if (analysis.avgReactionTime < 1.4) {
      hintElem.textContent = 'Velocidad ágil y reactiva';
    } else if (analysis.avgReactionTime <= 2.3) {
      hintElem.textContent = 'Velocidad adecuada y controlada';
    } else {
      hintElem.textContent = 'Procesamiento pausado / reflexivo';
    }

    const barM = document.getElementById('barMemory');
    barM.style.width = `${analysis.memoryAccuracy}%`;
    document.getElementById('metricMemoryText').textContent = `Precisión: ${analysis.memoryAccuracy}%`;
    document.getElementById('metricMemorySub').textContent = `Racha máxima: ${stats.maxStreak} seguidos`;

    // Métrica de Cámara
    const camMovesElem = document.getElementById('metricCameraMoves');
    const camHintElem = document.getElementById('metricCameraHint');
    if (camMovesElem) {
      camMovesElem.textContent = `${analysis.cameraHits} aciertos`;
    }
    if (camHintElem) {
      camHintElem.textContent = analysis.cameraHits > 0 
        ? `${analysis.cameraHits} movimientos corporales captados con éxito por la webcam` 
        : 'Movimientos mediante voz o controles';
    }

    // Tabla de desglose de direcciones
    this.renderDirectionTable(stats.directions);

    // Dictamen pedagógico
    const pedContainer = document.getElementById('pedagogicalText');
    pedContainer.innerHTML = analysis.diagnosis.map(p => `<p>${p}</p>`).join('');

    // Recomendaciones
    const recContainer = document.getElementById('recommendationsList');
    recContainer.innerHTML = analysis.recommendations.map(r => `<li>${r}</li>`).join('');
  }

  /**
   * Renderiza las filas de la tabla de direcciones
   */
  renderDirectionTable(dirs) {
    const tbody = document.getElementById('directionTableBody');
    tbody.innerHTML = '';

    const dirDefs = [
      { key: 'up', name: '⬆️ ARRIBA', desc: 'Eje vertical superior' },
      { key: 'down', name: '⬇️ ABAJO', desc: 'Eje vertical inferior' },
      { key: 'left', name: '⬅️ IZQUIERDA', desc: 'Lateralidad izquierda' },
      { key: 'right', name: '➡️ DERECHA', desc: 'Lateralidad derecha' }
    ];

    dirDefs.forEach(d => {
      const data = dirs[d.key] || { attempts: 0, hits: 0, errors: 0 };
      const pct = data.attempts > 0 ? Math.round((data.hits / data.attempts) * 100) : 100;

      let badgeClass = 'badge-success';
      let diagnosisTag = 'Dominado';
      if (pct < 60) {
        badgeClass = 'badge-danger';
        diagnosisTag = 'Requiere refuerzo';
      } else if (pct < 85) {
        badgeClass = 'badge-warning';
        diagnosisTag = 'En consolidación';
      }

      const row = document.createElement('tr');
      row.innerHTML = `
        <td><strong>${d.name}</strong><br><small style="color:#868e96;">${d.desc}</small></td>
        <td>${data.attempts}</td>
        <td><strong style="color:#2b8a3e;">${data.hits}</strong></td>
        <td><strong style="color:#c92a2a;">${data.errors}</strong></td>
        <td><strong>${pct}%</strong></td>
        <td><span class="badge-status ${badgeClass}">${diagnosisTag}</span></td>
      `;
      tbody.appendChild(row);
    });
  }

  /**
   * Guarda la sesión en LocalStorage para historial de consultas
   */
  saveSession(sessionData, analysis) {
    try {
      const raw = localStorage.getItem(this.storageKey);
      const history = raw ? JSON.parse(raw) : [];
      history.unshift({
        date: new Date().toISOString(),
        kid: sessionData.kid,
        score: analysis.globalScore,
        mode: sessionData.mode
      });
      // Mantener últimas 20 sesiones
      localStorage.setItem(this.storageKey, JSON.stringify(history.slice(0, 20)));
    } catch (e) {
      console.warn('No se pudo guardar en LocalStorage:', e);
    }
  }
}

// Instancia global
window.reportGenerator = new CognitiveReportGenerator();
