/**
 * challenges.js - Sistema de desafíos educativos de física cinemática
 * Genera problemas basados en las 4 fórmulas de proyectiles para cada uno de los 4 modos
 */

const Challenges = {
    // Definición de las 4 fórmulas para la pizarra interactiva
    formulas: [
        {
            id: 'vfx',
            latex: 'V_{fx} = v_i \\cdot \\cos(\\alpha)',
            text: 'Vfx = vi · cos(α)',
            name: 'Velocidad Horizontal Final',
            desc: 'Velocidad constante en el eje X (sin rozamiento).'
        },
        {
            id: 'xf',
            latex: 'X_f = X_i + v_i \\cdot \\cos(\\alpha) \\cdot t',
            text: 'Xf = xi + vi · cos(α) · t',
            name: 'Posición Horizontal Final',
            desc: 'Distancia recorrida en función del tiempo.'
        },
        {
            id: 'vfy',
            latex: 'V_{fy} = v_i \\cdot \\sin(\\alpha) - g \\cdot t',
            text: 'Vfy = vi · sen(α) - g · t',
            name: 'Velocidad Vertical Final',
            desc: 'Velocidad vertical afectada por la gravedad (g = 10 m/s²).'
        },
        {
            id: 'yf',
            latex: 'Y_f = Y_i + v_i \\cdot \\sin(\\alpha) \\cdot t - 5t^2',
            text: 'Yf = yi + vi · sen(α) · t - 5t²',
            name: 'Posición Vertical Final',
            desc: 'Altura del balón en cualquier instante (con ½g = 5).'
        }
    ],

    // Generar un desafío específico según el modo seleccionado
    generateChallenge: function(mode, distGoal) {
        const xi = 0;
        const yi = 0.11; // Balón sobre el césped
        const g = 10;
        const distWall = 9.15; // Distancia a la barrera

        if (mode === 'top_corner') {
            // MODO 1: TIRO AL ÁNGULO (TIRO OBLICUO)
            // Se busca clavar el balón a Yf = 2.20m (ángulo superior)
            const targetY = 2.20;
            const alphaDeg = 24 + Math.floor(Math.random() * 6); // 24° a 29°
            const alphaRad = Physics.degToRad(alphaDeg);

            // Calcular vi exacta analíticamente
            const viExact = Physics.solveViForTarget(xi, yi, distGoal, targetY, alphaRad);
            const viRounded = Math.round(viExact * 10) / 10;

            // Tiempo exacto
            const tGoal = distGoal / (viRounded * Math.cos(alphaRad));
            const tRounded = Math.round(tGoal * 100) / 100;

            const vfx = viRounded * Math.cos(alphaRad);
            const vfy = viRounded * Math.sin(alphaRad) - g * tRounded;

            return {
                mode: 'top_corner',
                title: '🎯 Desafío 1: Tiro al Ángulo (Tiro Oblicuo)',
                badge: 'Tiro Oblicuo',
                targetType: 'top_corner',
                wallActive: false,
                given: {
                    distGoal: distGoal,
                    targetY: targetY,
                    alphaDeg: alphaDeg,
                    time: tRounded,
                    g: 10
                },
                question: `El balón está a **${distGoal} m** del arco. Para clavar la pelota en el ángulo superior a una altura **Yf = ${targetY} m** en un tiempo de vuelo **t = ${tRounded} s** pateando con un ángulo **α = ${alphaDeg}°**, ¿cuál debe ser la **velocidad inicial (vi)**?`,
                formulaId: 'xf',
                formulaName: 'Xf = xi + vi · cos(α) · t  y  Yf = yi + vi · sen(α) · t - 5t²',
                unknownVar: 'vi',
                unknownUnit: 'm/s',
                correctValue: viRounded,
                tolerance: 0.8,
                recommendedParams: {
                    vi: viRounded,
                    alphaDeg: alphaDeg,
                    lateralAngleDeg: 6.8 // Hacia el palo derecho
                },
                stepByStep: [
                    `1. Usamos la fórmula horizontal: **Xf = xi + vi · cos(α) · t**`,
                    `2. Con xi = 0: **${distGoal} = vi · cos(${alphaDeg}°) · ${tRounded}**`,
                    `3. Calculamos cos(${alphaDeg}°) ≈ ${Math.cos(alphaRad).toFixed(3)}`,
                    `4. Despejamos vi: **vi = ${distGoal} / (${Math.cos(alphaRad).toFixed(3)} · ${tRounded})**`,
                    `5. Resultado: **vi ≈ ${viRounded} m/s** (~${Math.round(viRounded * 3.6)} km/h)`,
                    `6. Comprobamos la altura con la fórmula 4: **Yf = 0.11 + (${viRounded} · sen(${alphaDeg}°) · ${tRounded}) - 5 · (${tRounded})² ≈ ${targetY} m** ¡Al ángulo!`
                ]
            };

        } else if (mode === 'low_shot') {
            // MODO 2: TIRO POR ABAJO (TIRO HORIZONTAL / RASANTE)
            // Ángulo muy bajo (0° a 4°), tiro seco junto al palo
            const alphaDeg = 3;
            const alphaRad = Physics.degToRad(alphaDeg);
            const flightTime = Math.round((0.75 + (distGoal - 16) * 0.04) * 100) / 100;

            // Usando Xf = vi * cos(alpha) * t  => vi = Xf / (cos(alpha) * t)
            const viExact = distGoal / (Math.cos(alphaRad) * flightTime);
            const viRounded = Math.round(viExact * 10) / 10;

            const vfx = viRounded * Math.cos(alphaRad);
            const yGoal = Physics.getYf(yi, viRounded, alphaRad, flightTime);

            return {
                mode: 'low_shot',
                title: '⚡ Desafío 2: Tiro por Abajo (Tiro Horizontal / Rasante)',
                badge: 'Tiro Rasante',
                targetType: 'low_shot',
                wallActive: false,
                given: {
                    distGoal: distGoal,
                    alphaDeg: alphaDeg,
                    flightTime: flightTime,
                    g: 10
                },
                question: `Quieres que el remate viaje pegado al césped a una distancia de **${distGoal} m** en un tiempo récord de **${flightTime} s** con una elevación mínima de **α = ${alphaDeg}°**. ¿Qué **velocidad horizontal final Vfx** tendrá el tiro?`,
                formulaId: 'vfx',
                formulaName: 'Vfx = vi · cos(α)  y  Xf = xi + vi · cos(α) · t',
                unknownVar: 'Vfx',
                unknownUnit: 'm/s',
                correctValue: Math.round(vfx * 10) / 10,
                tolerance: 0.8,
                recommendedParams: {
                    vi: viRounded,
                    alphaDeg: alphaDeg,
                    lateralAngleDeg: -7.0 // Hacia el palo izquierdo rasante
                },
                stepByStep: [
                    `1. En el eje horizontal no hay aceleración (MRU): **Vfx = vi · cos(α)**`,
                    `2. Sabemos que **Xf = xi + Vfx · t**`,
                    `3. Despejamos Vfx: **Vfx = (Xf - xi) / t = ${distGoal} / ${flightTime}**`,
                    `4. Resultado: **Vfx ≈ ${(distGoal / flightTime).toFixed(2)} m/s**`,
                    `5. Dado que cos(${alphaDeg}°) ≈ 0.998, la velocidad inicial es **vi ≈ ${viRounded} m/s**.`
                ]
            };

        } else if (mode === 'wall_over') {
            // MODO 3: CON BARRERA - POR ARRIBA (TIRO PARABÓLICO SUPERANDO LA BARRERA)
            // Barrera a 9.15m. Altura parada = 1.85m. Si salta = 2.38m.
            const alphaDeg = 26 + Math.floor(Math.random() * 4); // 26° a 29°
            const alphaRad = Physics.degToRad(alphaDeg);

            // Queremos que pase la barrera a una altura cómoda (ej: 2.25m si parada, o 2.50m si salta)
            // y luego caiga dentro del arco (Ygoal entre 1.0m y 2.30m)
            const targetYGoal = 1.80;
            const viExact = Physics.solveViForTarget(xi, yi, distGoal, targetYGoal, alphaRad) || 21.0;
            const viRounded = Math.round(viExact * 10) / 10;

            const tWall = distWall / (viRounded * Math.cos(alphaRad));
            const tWallRound = Math.round(tWall * 100) / 100;
            const yWall = Physics.getYf(yi, viRounded, alphaRad, tWall);
            const yWallRound = Math.round(yWall * 100) / 100;

            return {
                mode: 'wall_over',
                title: '🛡️ Desafío 3: Con Barrera - Pasar por Arriba',
                badge: 'Superar la Barrera',
                targetType: 'top_corner',
                wallActive: true,
                wallJumpsRandom: true,
                given: {
                    distGoal: distGoal,
                    distWall: distWall,
                    vi: viRounded,
                    alphaDeg: alphaDeg,
                    timeToWall: tWallRound,
                    wallStandingHeight: 1.85,
                    wallJumpHeight: 2.38
                },
                question: `La barrera rival está a **${distWall} m** de distancia. Pateas con **vi = ${viRounded} m/s** y un ángulo **α = ${alphaDeg}°**. El balón tarda **${tWallRound} s** en alcanzar la barrera. ¿A qué altura **Yf** pasará sobre ellos? ¿Supera la barrera si se quedan parados (1.85 m)?`,
                formulaId: 'yf',
                formulaName: 'Yf = Yi + vi · sen(α) · t - 5t²',
                unknownVar: 'Yf',
                unknownUnit: 'm',
                correctValue: yWallRound,
                tolerance: 0.15,
                recommendedParams: {
                    vi: viRounded,
                    alphaDeg: alphaDeg,
                    lateralAngleDeg: 0.0
                },
                stepByStep: [
                    `1. Usamos la fórmula 4 de posición vertical: **Yf = Yi + vi · sen(α) · t - 5t²**`,
                    `2. Datos: Yi = 0.11 m, vi = ${viRounded} m/s, α = ${alphaDeg}°, t = ${tWallRound} s`,
                    `3. Calculamos: vi · sen(${alphaDeg}°) = ${viRounded} · ${Math.sin(alphaRad).toFixed(3)} ≈ ${(viRounded * Math.sin(alphaRad)).toFixed(2)} m/s`,
                    `4. Término lineal: ${(viRounded * Math.sin(alphaRad)).toFixed(2)} · ${tWallRound} ≈ ${(viRounded * Math.sin(alphaRad) * tWallRound).toFixed(2)} m`,
                    `5. Término de gravedad: 5 · (${tWallRound})² = 5 · ${(tWallRound * tWallRound).toFixed(3)} ≈ ${(5 * tWallRound * tWallRound).toFixed(2)} m`,
                    `6. Altura final: **Yf = 0.11 + ${(viRounded * Math.sin(alphaRad) * tWallRound).toFixed(2)} - ${(5 * tWallRound * tWallRound).toFixed(2)} = ${yWallRound} m**`,
                    `7. Conclusión: Como ${yWallRound} m > 1.85 m, supera la barrera parada. Si saltan (2.38 m), ¡se necesita precisión milimétrica!`
                ]
            };

        } else if (mode === 'wall_under') {
            // MODO 4: CON BARRERA - PASAR POR ABAJO AL SALTAR
            // Si la barrera salta, se abre un hueco inferior de 0.55m.
            // El tiro debe tener ángulo bajo (0° a 2°) para pasar con Y(Xwall) < 0.50m
            const alphaDeg = 1.5;
            const alphaRad = Physics.degToRad(alphaDeg);
            const vi = 24.0;

            const tWall = distWall / (vi * Math.cos(alphaRad));
            const tWallRound = Math.round(tWall * 100) / 100;
            const yWall = Physics.getYf(yi, vi, alphaRad, tWall);
            const yWallRound = Math.round(yWall * 100) / 100;

            return {
                mode: 'wall_under',
                title: '🪄 Desafío 4: Con Barrera - Pasar por Debajo al Saltar',
                badge: 'Tiro Subterráneo',
                targetType: 'low_shot',
                wallActive: true,
                wallJumpsRandom: true, // Salto aleatorio
                given: {
                    distGoal: distGoal,
                    distWall: distWall,
                    vi: vi,
                    alphaDeg: alphaDeg,
                    timeToWall: tWallRound,
                    jumpGap: 0.55
                },
                question: `Anticipas que la barrera va a saltar, abriendo un hueco inferior de **0.55 m**. Con **vi = ${vi} m/s** y **α = ${alphaDeg}°**, la pelota llega a la barrera en **t = ${tWallRound} s**. ¿Cuál será la altura **Yf** del balón al pasar por debajo?`,
                formulaId: 'yf',
                formulaName: 'Yf = Yi + vi · sen(α) · t - 5t²',
                unknownVar: 'Yf',
                unknownUnit: 'm',
                correctValue: yWallRound,
                tolerance: 0.12,
                recommendedParams: {
                    vi: vi,
                    alphaDeg: alphaDeg,
                    lateralAngleDeg: -2.5
                },
                stepByStep: [
                    `1. Usamos la fórmula 4: **Yf = Yi + vi · sen(α) · t - 5t²**`,
                    `2. Con Yi = 0.11 m, vi = ${vi} m/s, α = ${alphaDeg}°, t = ${tWallRound} s`,
                    `3. vi · sen(1.5°) · ${tWallRound} ≈ ${(vi * Math.sin(alphaRad) * tWallRound).toFixed(2)} m`,
                    `4. Gravedad: 5 · (${tWallRound})² ≈ ${(5 * tWallRound * tWallRound).toFixed(2)} m`,
                    `5. Altura: **Yf = 0.11 + ${(vi * Math.sin(alphaRad) * tWallRound).toFixed(2)} - ${(5 * tWallRound * tWallRound).toFixed(2)} = ${yWallRound} m**`,
                    `6. Dado que **${yWallRound} m < 0.55 m**, la pelota pasa limpia por debajo de los botines si saltan. Si no saltan, ¡chocará contra las piernas!`
                ]
            };
        }
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Challenges;
}
