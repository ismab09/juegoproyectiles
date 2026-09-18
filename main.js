/**
 * main.js - Controlador principal de la aplicación Tiro Libre Cinemático
 * Conecta la simulación 3D, el motor de física, el sistema de audio, planetas/viento y la interfaz de usuario
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Inicializar Escena 3D
    const scene = new FootballScene('sceneContainer');

    // 2. Estado de la aplicación
    const state = {
        currentMode: 'top_corner', // 'top_corner', 'low_shot', 'wall_over', 'wall_under'
        distGoal: 22,             // Distancia en metros (16 a 35)
        distWall: 9.15,           // Distancia reglamentaria de la barrera
        vi: 22.0,                 // Velocidad inicial en m/s
        alphaDeg: 25,             // Ángulo de elevación en grados
        lateralAngleDeg: 4.5,     // Desvío horizontal hacia postes
        wallJumpMode: 'random',   // 'random', 'always', 'never'
        planet: 'earth',          // 'earth', 'moon', 'mars', 'jupiter'
        windX: 0,                 // Viento frontal / a favor (m/s)
        windZ: 0,                 // Viento lateral (m/s)
        soundEnabled: true,
        currentChallenge: null,
        activeTarget: { x: 2.8, y: 2.15, name: 'Ángulo Der.' }
    };

    // Elementos del DOM
    const ui = {
        // Modos
        modeBtns: document.querySelectorAll('.mode-tab'),
        // Distancia
        distSlider: document.getElementById('distSlider'),
        distValue: document.getElementById('distValue'),
        distLabelVal: document.getElementById('distLabelVal'),
        distPills: document.querySelectorAll('.dist-pill'),
        // Sliders de tiro
        viSlider: document.getElementById('viSlider'),
        viValue: document.getElementById('viValue'),
        alphaSlider: document.getElementById('alphaSlider'),
        alphaValue: document.getElementById('alphaValue'),
        latSlider: document.getElementById('latSlider'),
        latValue: document.getElementById('latValue'),
        targetPosLabel: document.getElementById('targetPosLabel'),
        // Planetas y Viento
        planetPills: document.querySelectorAll('.planet-pill'),
        planetVal: document.getElementById('planetVal'),
        windXSlider: document.getElementById('windXSlider'),
        windXValue: document.getElementById('windXValue'),
        windZSlider: document.getElementById('windZSlider'),
        windZValue: document.getElementById('windZValue'),
        boardGBadge: document.querySelector('.board-g-badge'),
        formulaBadgeYf: document.querySelector('.formula-badge[data-formula="yf"] .f-math'),
        formulaBadgeVfy: document.querySelector('.formula-badge[data-formula="vfy"] .f-math'),
        // Barrera
        wallJumpSelect: document.getElementById('wallJumpSelect'),
        wallJumpGroup: document.getElementById('wallJumpGroup'),
        // Botones de acción
        kickBtn: document.getElementById('kickBtn'),
        resetBtn: document.getElementById('resetBtn'),
        cameraBtns: document.querySelectorAll('.cam-btn'),
        soundToggle: document.getElementById('soundToggle'),
        // Desafío y Pizarra
        challengeTitle: document.getElementById('challengeTitle'),
        challengeBadge: document.getElementById('challengeBadge'),
        challengeQuestion: document.getElementById('challengeQuestion'),
        formulaCards: document.querySelectorAll('.formula-badge'),
        answerInput: document.getElementById('answerInput'),
        answerUnit: document.getElementById('answerUnit'),
        checkAnswerBtn: document.getElementById('checkAnswerBtn'),
        answerFeedback: document.getElementById('answerFeedback'),
        toggleStepsBtn: document.getElementById('toggleStepsBtn'),
        stepByStepBox: document.getElementById('stepByStepBox'),
        applyToBallBtn: document.getElementById('applyToBallBtn'),
        // Panel de Telemetría / Resultados
        telemetryVfx: document.getElementById('telemetryVfx'),
        telemetryVfy: document.getElementById('telemetryVfy'),
        telemetryTime: document.getElementById('telemetryTime'),
        telemetryYGoal: document.getElementById('telemetryYGoal'),
        telemetryYWall: document.getElementById('telemetryYWall'),
        wallTelemetryRow: document.getElementById('wallTelemetryRow'),
        // Notificación de Gol / Resultado
        resultBanner: document.getElementById('resultBanner'),
        resultTitle: document.getElementById('resultTitle'),
        resultDetail: document.getElementById('resultDetail')
    };

    // Inicializar Desafío para el modo actual
    function loadChallenge() {
        state.currentChallenge = Challenges.generateChallenge(state.currentMode, state.distGoal);
        const ch = state.currentChallenge;

        ui.challengeTitle.textContent = ch.title;
        ui.challengeBadge.textContent = ch.badge;
        ui.challengeQuestion.innerHTML = formatMarkdown(ch.question);
        ui.answerUnit.textContent = ch.unknownUnit;
        ui.answerInput.value = '';
        ui.answerFeedback.className = 'feedback-msg';
        ui.answerFeedback.textContent = '';
        ui.stepByStepBox.style.display = 'none';
        ui.toggleStepsBtn.textContent = '📖 Ver Paso a Paso';

        ui.stepByStepBox.innerHTML = ch.stepByStep.map(s => `<p>${formatMarkdown(s)}</p>`).join('');

        ui.formulaCards.forEach(card => {
            if (card.dataset.formula === ch.formulaId) {
                card.classList.add('highlighted');
            } else {
                card.classList.remove('highlighted');
            }
        });

        const hasWall = ch.wallActive;
        scene.setWallVisibility(hasWall);
        if (ui.wallJumpGroup) {
            ui.wallJumpGroup.style.display = hasWall ? 'flex' : 'none';
        }
        if (ui.wallTelemetryRow) {
            ui.wallTelemetryRow.style.display = hasWall ? 'flex' : 'none';
        }

        scene.setTargetMode(ch.targetType);

        // Actualizar desplazamiento táctico de la barrera
        scene.setWallLateralAim(state.lateralAngleDeg);

        updateTelemetryPreview();
    }

    function formatMarkdown(text) {
        return text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>');
    }

    function updateTelemetryPreview() {
        const vi = parseFloat(ui.viSlider.value);
        const alphaDeg = parseFloat(ui.alphaSlider.value);
        const alphaRad = Physics.degToRad(alphaDeg);

        const tGoal = Physics.getTimeForDistance(0, state.distGoal, vi, alphaRad);
        const vfx = Physics.getVfx(vi, alphaRad, tGoal);
        const vfy = Physics.getVfy(vi, alphaRad, tGoal);
        const yGoal = Physics.getYf(0.11, vi, alphaRad, tGoal);

        ui.telemetryVfx.textContent = `${vfx.toFixed(1)} m/s`;
        ui.telemetryTime.textContent = `${tGoal.toFixed(2)} s`;
        ui.telemetryVfy.textContent = `${vfy.toFixed(1)} m/s`;
        ui.telemetryYGoal.textContent = `${Math.max(0, yGoal).toFixed(2)} m`;

        if (state.currentChallenge && state.currentChallenge.wallActive) {
            const tWall = Physics.getTimeForDistance(0, state.distWall, vi, alphaRad);
            const yWall = Physics.getYf(0.11, vi, alphaRad, tWall);
            ui.telemetryYWall.textContent = `${Math.max(0, yWall).toFixed(2)} m`;
        }
    }

    function updatePlanetFormulas(planet) {
        if (ui.boardGBadge) {
            ui.boardGBadge.textContent = `g = ${planet.g} m/s² (½g = ${planet.halfG})`;
        }
        if (ui.formulaBadgeYf) {
            ui.formulaBadgeYf.textContent = `Yf = Yi + vi·sen(α)·t - ${planet.halfG}t²`;
        }
        if (ui.formulaBadgeVfy) {
            ui.formulaBadgeVfy.textContent = `Vfy = vi·sen(α) - ${planet.g}·t`;
        }
        if (ui.planetVal) {
            ui.planetVal.textContent = `${planet.name} (${planet.g} m/s²)`;
        }
    }

    // Disparar el tiro libre
    function performKick() {
        if (scene.isKicking) return;

        AudioFX.playWhistle();
        setTimeout(() => AudioFX.playKick(), 250);

        const vi = parseFloat(ui.viSlider.value);
        const alphaDeg = parseFloat(ui.alphaSlider.value);
        const alphaRad = Physics.degToRad(alphaDeg);
        const latDeg = parseFloat(ui.latSlider.value);
        const latRad = Physics.degToRad(latDeg);

        let willJump = false;
        if (state.currentChallenge.wallActive) {
            if (state.wallJumpMode === 'always') willJump = true;
            else if (state.wallJumpMode === 'never') willJump = false;
            else willJump = Math.random() >= 0.45;
        }

        // Evaluar resultado cinemático con gravedad, viento y posición de barrera
        const evalResult = Physics.evaluateShot({
            distGoal: state.distGoal,
            distWall: state.distWall,
            vi: vi,
            alphaDeg: alphaDeg,
            lateralAngleDeg: latDeg,
            wallJumps: willJump,
            wallActive: state.currentChallenge.wallActive,
            wallCenterZ: scene.wallLateralOffset
        });

        // Generar puntos 3D de la trayectoria cinemática con efectos de viento, pique y red
        const pts = Physics.generateFlightPoints(vi, alphaRad, latRad, evalResult);
        const duration = evalResult.tGoal || 1.2;

        setTimeout(() => AudioFX.playWhoosh(), 280);

        scene.startKick(pts, duration, evalResult, willJump);
    }

    scene.onShotComplete = (result) => {
        showResultBanner(result);

        // Mostrar gráficas después del tiro
        if (scene.flightPoints && scene.flightPoints.length > 0) {
            const vi = parseFloat(ui.viSlider.value);
            const alphaDeg = parseFloat(ui.alphaSlider.value);
            GraphSystem.drawGraphs(scene.flightPoints, { vi, alphaDeg });
            setTimeout(() => GraphSystem.show(), 800);
        }

        if (result.outcome && result.outcome.includes('GOAL')) {
            AudioFX.playGoal();
        } else if (result.outcome === 'SAVED') {
            AudioFX.playSave();
        } else if (result.outcome === 'CROSSBAR' || result.outcome === 'POST') {
            AudioFX.playCrossbar();
        } else if (result.outcome && result.outcome.startsWith('WALL_HIT')) {
            AudioFX.playWallHit();
        }
    };

    function showResultBanner(res) {
        ui.resultTitle.textContent = res.message;

        let detailText = `Llegada: t = ${res.tGoal ? res.tGoal.toFixed(2) + 's' : '--'} | Altura en línea de gol: ${res.yAtGoal ? res.yAtGoal.toFixed(2) + 'm' : '--'}`;
        if (res.wallCollision) {
            if (res.wallCollision.underJump) {
                detailText += ` | ¡Pasó a ${res.wallCollision.yAtWall.toFixed(2)}m bajo la barrera en el aire!`;
            } else if (res.wallCollision.overJump || res.wallCollision.overStanding) {
                detailText += ` | Superó la barrera a ${res.wallCollision.yAtWall.toFixed(2)}m de altura.`;
            }
        }
        ui.resultDetail.textContent = detailText;

        ui.resultBanner.className = 'result-banner show ' + (res.outcome.includes('GOAL') ? 'success' : res.outcome === 'CROSSBAR' || res.outcome === 'POST' ? 'warning' : 'danger');

        setTimeout(() => {
            ui.resultBanner.classList.remove('show');
        }, 5000);
    }

    // =========================================================================
    // Conectar Eventos de la Interfaz
    // =========================================================================

    // Cambio de modo
    ui.modeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            ui.modeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.currentMode = btn.dataset.mode;
            scene.resetBall();
            loadChallenge();
        });
    });

    // Control de distancia
    ui.distSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        state.distGoal = val;
        ui.distValue.textContent = `${val} m`;
        if (ui.distLabelVal) ui.distLabelVal.textContent = `${val} m`;
        scene.setDistance(val);
        loadChallenge();
    });

    ui.distPills.forEach(pill => {
        pill.addEventListener('click', () => {
            const val = parseInt(pill.dataset.dist);
            ui.distSlider.value = val;
            state.distGoal = val;
            ui.distValue.textContent = `${val} m`;
            if (ui.distLabelVal) ui.distLabelVal.textContent = `${val} m`;
            scene.setDistance(val);
            loadChallenge();
        });
    });

    const targetPills = document.querySelectorAll('.target-pill');
    targetPills.forEach(pill => {
        pill.addEventListener('click', () => {
            targetPills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            const tx = parseFloat(pill.dataset.tx);
            const ty = parseFloat(pill.dataset.ty);
            const name = pill.dataset.name || pill.textContent.trim();
            state.activeTarget = { x: tx, y: ty, name: name };
            
            // Actualizar diana en el espacio 3D sin recargar ni tocar el ejercicio de física
            scene.setTargetPosition(tx, ty);

            // Actualizar etiqueta con coordenadas precisas
            if (ui.targetPosLabel) {
                const signX = tx > 0 ? '+' : '';
                ui.targetPosLabel.textContent = `${name} (X: ${signX}${tx}m, Y: ${ty}m)`;
            }

            // Auto-ajustar ángulo lateral según la distancia actual al arco
            const latRad = Math.atan2(tx, state.distGoal);
            const latDeg = latRad * (180 / Math.PI);
            ui.latSlider.value = latDeg.toFixed(1);
            ui.latSlider.dispatchEvent(new Event('input'));
        });
    });

    // Selector de Planeta (Gravedad)
    ui.planetPills.forEach(pill => {
        pill.addEventListener('click', () => {
            ui.planetPills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            const planetKey = pill.dataset.planet;
            state.planet = planetKey;
            const pInfo = Physics.setPlanet(planetKey);
            updatePlanetFormulas(pInfo);
            updateTelemetryPreview();
        });
    });

    // Opciones de Viento
    ui.windXSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        state.windX = val;
        Physics.setWind(state.windX, state.windZ);
        let desc = 'Calma';
        if (val > 1) desc = 'A favor 💨';
        else if (val < -1) desc = 'En contra 💨';
        ui.windXValue.textContent = `${val > 0 ? '+' : ''}${val} m/s (${desc})`;
        updateTelemetryPreview();
    });

    ui.windZSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        state.windZ = val;
        Physics.setWind(state.windX, state.windZ);
        let desc = 'Calma';
        if (val > 1) desc = 'Hacia la derecha ➡️';
        else if (val < -1) desc = 'Hacia la izquierda ⬅️';
        ui.windZValue.textContent = `${val > 0 ? '+' : ''}${val} m/s (${desc})`;
        updateTelemetryPreview();
    });

    // Sliders de tiro
    ui.viSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        ui.viValue.textContent = `${val.toFixed(1)} m/s (${Math.round(val * 3.6)} km/h)`;
        updateTelemetryPreview();
    });

    ui.alphaSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        ui.alphaValue.textContent = `${val}°`;
        updateTelemetryPreview();
    });

    ui.latSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        state.lateralAngleDeg = val;
        let dir = 'Centro';
        if (val > 1.5) dir = 'Palo Derecho ➡️';
        else if (val < -1.5) dir = '⬅️ Palo Izquierdo';
        ui.latValue.textContent = `${val.toFixed(1)}° (${dir})`;

        // Desplazar táctica y geométricamente la barrera a la izquierda o derecha
        scene.setWallLateralAim(val);

        updateTelemetryPreview();
    });

    // Selector de salto de barrera
    if (ui.wallJumpSelect) {
        ui.wallJumpSelect.addEventListener('change', (e) => {
            state.wallJumpMode = e.target.value;
        });
    }

    // Botones de Ejecución
    ui.kickBtn.addEventListener('click', () => performKick());

    ui.resetBtn.addEventListener('click', () => {
        scene.resetBall();
        ui.resultBanner.classList.remove('show');
    });

    // Botones de Cámara
    ui.cameraBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            ui.cameraBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            scene.setCameraView(btn.dataset.cam);
        });
    });

    // Sonido
    ui.soundToggle.addEventListener('click', () => {
        state.soundEnabled = !state.soundEnabled;
        AudioFX.enabled = state.soundEnabled;
        ui.soundToggle.textContent = state.soundEnabled ? '🔊 Sonido: ON' : '🔇 Sonido: OFF';
        ui.soundToggle.classList.toggle('muted', !state.soundEnabled);
    });

    // Comprobación de respuesta del desafío educativo
    ui.checkAnswerBtn.addEventListener('click', () => {
        const userVal = parseFloat(ui.answerInput.value);
        if (isNaN(userVal)) {
            ui.answerFeedback.textContent = 'Ingresa un número válido.';
            ui.answerFeedback.className = 'feedback-msg error';
            return;
        }

        const ch = state.currentChallenge;
        const diff = Math.abs(userVal - ch.correctValue);
        if (diff <= ch.tolerance) {
            ui.answerFeedback.innerHTML = `¡Excelente! 🎉 Cálculo correcto (${ch.correctValue} ${ch.unknownUnit}). ¡Ahora prueba patear!`;
            ui.answerFeedback.className = 'feedback-msg success';
        } else {
            ui.answerFeedback.innerHTML = `Cerca, pero no es exacto. Tu valor: ${userVal}. Revisa las fórmulas o abre "Ver Paso a Paso".`;
            ui.answerFeedback.className = 'feedback-msg error';
        }
    });

    // Desplegar paso a paso
    ui.toggleStepsBtn.addEventListener('click', () => {
        const isHidden = ui.stepByStepBox.style.display === 'none';
        ui.stepByStepBox.style.display = isHidden ? 'block' : 'none';
        ui.toggleStepsBtn.textContent = isHidden ? '🙈 Ocultar Paso a Paso' : '📖 Ver Paso a Paso';
    });

    // Aplicar valores recomendados al balón (auto-calibrar según diana activa o desafío)
    ui.applyToBallBtn.addEventListener('click', () => {
        if (state.activeTarget) {
            const tx = state.activeTarget.x;
            const ty = state.activeTarget.y;
            const D = state.distGoal;
            const latDeg = Math.atan2(tx, D) * (180 / Math.PI);

            let chosenVi = 22.0;
            let chosenAlpha = 24;

            if (ty < 0.6) {
                // Tiro rasante
                chosenVi = Math.max(16, Math.min(32, 18 + (D - 16) * 0.5));
                chosenAlpha = Math.max(1, Math.min(5, Math.round(2 + (ty - 0.2) * 4)));
            } else if (ty > 2.0) {
                // Tiro al ángulo o travesaño
                chosenVi = Math.max(19, Math.min(30, 21 + (D - 20) * 0.45));
                for (let a = 15; a <= 36; a += 0.5) {
                    const aRad = Physics.degToRad(a);
                    const t = Physics.getTimeForDistance(0, D, chosenVi, aRad);
                    const y = Physics.getYf(0.11, chosenVi, aRad, t);
                    if (y >= ty - 0.12) {
                        chosenAlpha = Math.round(a);
                        break;
                    }
                }
            } else {
                // Altura media
                chosenVi = 20.0;
                chosenAlpha = 16;
            }

            ui.viSlider.value = chosenVi.toFixed(1);
            ui.viValue.textContent = `${chosenVi.toFixed(1)} m/s (${Math.round(chosenVi * 3.6)} km/h)`;
            ui.alphaSlider.value = chosenAlpha;
            ui.alphaValue.textContent = `${chosenAlpha}°`;
            ui.latSlider.value = latDeg.toFixed(1);
            let dir = 'Centro';
            if (latDeg > 1.5) dir = 'Palo Derecho ➡️';
            else if (latDeg < -1.5) dir = '⬅️ Palo Izquierdo';
            ui.latValue.textContent = `${latDeg.toFixed(1)}° (${dir})`;
            scene.setWallLateralAim(latDeg);
            updateTelemetryPreview();

            ui.answerFeedback.innerHTML = `✅ ¡Botín calibrado hacia <strong>${state.activeTarget.name}</strong> (${chosenVi.toFixed(1)} m/s, ${chosenAlpha}°, ${latDeg.toFixed(1)}°)! Pulsa <strong>¡PATEAR!</strong>`;
            ui.answerFeedback.className = 'feedback-msg success';
        } else {
            const rec = state.currentChallenge.recommendedParams;
            if (rec) {
                if (rec.vi !== undefined) {
                    ui.viSlider.value = rec.vi;
                    ui.viValue.textContent = `${rec.vi.toFixed(1)} m/s (${Math.round(rec.vi * 3.6)} km/h)`;
                }
                if (rec.alphaDeg !== undefined) {
                    ui.alphaSlider.value = rec.alphaDeg;
                    ui.alphaValue.textContent = `${rec.alphaDeg}°`;
                }
                if (rec.lateralAngleDeg !== undefined) {
                    ui.latSlider.value = rec.lateralAngleDeg;
                    let dir = 'Centro';
                    if (rec.lateralAngleDeg > 1.5) dir = 'Palo Derecho ➡️';
                    else if (rec.lateralAngleDeg < -1.5) dir = '⬅️ Palo Izquierdo';
                    ui.latValue.textContent = `${rec.lateralAngleDeg.toFixed(1)}° (${dir})`;
                    scene.setWallLateralAim(rec.lateralAngleDeg);
                }
                updateTelemetryPreview();

                ui.answerFeedback.innerHTML = `✅ ¡Parámetros cinemáticos cargados en el botín! Pulsa <strong>¡PATEAR!</strong>`;
                ui.answerFeedback.className = 'feedback-msg success';
            }
        }
    });

    // Cargar primer desafío al inicio
    loadChallenge();
});
