/**
 * physics.js - Motor cinemático de proyectiles para tiros libres
 * Fórmulas requeridas (con gravedad g configurable por planeta y viento):
 * 1) Vfx = vi * cos(alpha) + ax * t
 * 2) Xf = xi + vi * cos(alpha) * t + 1/2 * ax * t²
 * 3) Vfy = vi * sen(alpha) - g * t
 * 4) Yf = yi + vi * sen(alpha) * t - 1/2 * g * t²
 */

const Physics = {
    // Gravedad actual (por defecto Tierra g = 10 m/s²)
    g: 10,
    currentPlanet: 'earth',

    // Viento actual (m/s)
    wind: { x: 0, z: 0 },

    // Planetas disponibles con sus respectivas gravedades
    planets: {
        earth: { name: 'Tierra 🌍', g: 10, halfG: 5, desc: 'Gravedad estándar: 10 m/s² (½g = 5)' },
        moon: { name: 'Luna 🌕', g: 1.62, halfG: 0.81, desc: 'Gravedad lunar baja: 1.62 m/s² (½g = 0.81)' },
        mars: { name: 'Marte 🔴', g: 3.71, halfG: 1.85, desc: 'Gravedad marciana: 3.71 m/s² (½g = 1.85)' },
        jupiter: { name: 'Júpiter 🪐', g: 24.79, halfG: 12.4, desc: 'Gravedad extrema: 24.79 m/s² (½g = 12.4)' }
    },

    setPlanet: function(planetKey) {
        if (this.planets[planetKey]) {
            this.currentPlanet = planetKey;
            this.g = this.planets[planetKey].g;
            return this.planets[planetKey];
        }
        return this.planets.earth;
    },

    setWind: function(windX, windZ) {
        this.wind.x = parseFloat(windX) || 0;
        this.wind.z = parseFloat(windZ) || 0;
    },

    // Aceleración debida al viento (fricción proporcional aerodinámica en m/s²)
    getAx: function() {
        return this.wind.x * 0.35; // Viento frontal / a favor
    },

    getAz: function() {
        return this.wind.z * 0.35; // Viento lateral
    },

    // 1) Velocidad Horizontal Final
    getVfx: function(vi, alphaRad, t = 0) {
        return vi * Math.cos(alphaRad) + this.getAx() * t;
    },

    // 2) Posición Horizontal Final
    getXf: function(xi, vi, alphaRad, t) {
        return xi + vi * Math.cos(alphaRad) * t + 0.5 * this.getAx() * (t * t);
    },

    // Posición Lateral Z con viento
    getZf: function(zi, vi, alphaRad, latRad, t) {
        return zi + vi * Math.cos(alphaRad) * Math.sin(latRad) * t + 0.5 * this.getAz() * (t * t);
    },

    // 3) Velocidad Vertical Final
    getVfy: function(vi, alphaRad, t) {
        return vi * Math.sin(alphaRad) - this.g * t;
    },

    // 4) Posición Vertical Final (con 1/2 g)
    getYf: function(yi, vi, alphaRad, t) {
        return yi + vi * Math.sin(alphaRad) * t - 0.5 * this.g * (t * t);
    },

    degToRad: function(degrees) {
        return (degrees * Math.PI) / 180;
    },

    radToDeg: function(radians) {
        return (radians * 180) / Math.PI;
    },

    // Tiempo necesario para alcanzar la distancia horizontal Xf
    getTimeForDistance: function(xi, targetX, vi, alphaRad) {
        const vfx = vi * Math.cos(alphaRad);
        const ax = this.getAx();
        if (Math.abs(ax) < 0.001) {
            if (Math.abs(vfx) < 0.0001) return 0;
            return (targetX - xi) / vfx;
        }
        // Ecuación cuadrática: 0.5 * ax * t² + vfx * t - (targetX - xi) = 0
        const a = 0.5 * ax;
        const b = vfx;
        const c = -(targetX - xi);
        const disc = b * b - 4 * a * c;
        if (disc < 0) return 0;
        const t1 = (-b + Math.sqrt(disc)) / (2 * a);
        const t2 = (-b - Math.sqrt(disc)) / (2 * a);
        return t1 > 0 ? t1 : t2;
    },

    getMaxHeightTime: function(vi, alphaRad) {
        return (vi * Math.sin(alphaRad)) / this.g;
    },

    getMaxHeight: function(yi, vi, alphaRad) {
        const tPeak = this.getMaxHeightTime(vi, alphaRad);
        return this.getYf(yi, vi, alphaRad, tPeak);
    },

    solveViForTarget: function(xi, yi, targetX, targetY, alphaRad) {
        const dx = targetX - xi;
        const dy = targetY - yi;
        const cosA = Math.cos(alphaRad);
        const tanA = Math.tan(alphaRad);
        const halfG = 0.5 * this.g;

        const term = dx * tanA - dy;
        if (term <= 0) return null;

        const viSq = (halfG * dx * dx) / (cosA * cosA * term);
        return Math.sqrt(viSq);
    },

    // Generar puntos 3D cinemáticos con física de pique y red
    generateFlightPoints: function(vi, alphaRad, latRad, evalResult) {
        const duration = evalResult.tGoal || 1.2;
        const pts = [];
        const numSteps = 85;
        const vfyInitial = vi * Math.sin(alphaRad);
        const hasBounce = evalResult.bounced;
        const tGround = (vfyInitial > 0) ? (2 * vfyInitial) / this.g : 0;
        const e = 0.52;
        const vfyHit = vfyInitial - this.g * tGround;
        const vfyBounce = e * Math.abs(vfyHit);
        const xGround = (vfyInitial > 0) ? this.getXf(0, vi, alphaRad, tGround) : 0;
        const vfxBounce = 0.88 * vi * Math.cos(alphaRad);

        for (let i = 0; i <= numSteps; i++) {
            const t = (i / numSteps) * duration;
            let x, y, z;

            if (vfyInitial <= 0) {
                // Tiro rasante / horizontal: rueda y desliza por el césped
                x = this.getXf(0, vi, alphaRad, t);
                z = this.getZf(0, vi, alphaRad, latRad, t);
                y = 0.11;
            } else if (!hasBounce || t <= tGround) {
                x = this.getXf(0, vi, alphaRad, t);
                z = this.getZf(0, vi, alphaRad, latRad, t);
                y = Math.max(0.11, this.getYf(0.11, vi, alphaRad, t));
            } else {
                // Pique en el césped y continuación hacia el arco
                const dt = t - tGround;
                x = xGround + vfxBounce * dt + 0.5 * this.getAx() * (dt * dt);
                z = this.getZf(0, vi, alphaRad, latRad, t);
                const bounceY = 0.11 + vfyBounce * dt - 0.5 * this.g * (dt * dt);
                y = Math.max(0.11, bounceY);
            }

            pts.push({ t, x, y: Math.max(0.11, y), z });

            if (evalResult.outcome && evalResult.outcome.startsWith('WALL_HIT') && t >= evalResult.hitTime) {
                break;
            }
        }

        // Si fue gol, el balón cruza la línea y se adentra hasta inflar la red
        if (evalResult.outcome && evalResult.outcome.includes('GOAL') && pts.length > 0) {
            const lastPt = pts[pts.length - 1];
            for (let k = 1; k <= 9; k++) {
                const extraT = duration + k * 0.03;
                pts.push({
                    t: extraT,
                    x: lastPt.x + k * 0.09,
                    y: Math.max(0.11, lastPt.y - k * 0.035),
                    z: lastPt.z
                });
            }
        }

        // Si fue atajada, el balón sale desviado por los guantes hacia el tiro de esquina
        if (evalResult.outcome === 'SAVED' && pts.length > 0) {
            const lastPt = pts[pts.length - 1];
            const deflectDirZ = lastPt.z >= 0 ? 1 : -1;
            for (let k = 1; k <= 8; k++) {
                const extraT = duration + k * 0.04;
                pts.push({
                    t: extraT,
                    x: lastPt.x - k * 0.08,
                    y: Math.max(0.11, lastPt.y - k * 0.04),
                    z: lastPt.z + deflectDirZ * k * 0.12
                });
            }
        }

        // Si pegó en el poste o travesaño, rebote físico hacia la cancha
        if ((evalResult.outcome === 'POST' || evalResult.outcome === 'CROSSBAR') && pts.length > 0) {
            const lastPt = pts[pts.length - 1];
            const reboundZ = evalResult.outcome === 'POST' ? (lastPt.z > 0 ? -1 : 1) : 0;
            for (let k = 1; k <= 8; k++) {
                const extraT = duration + k * 0.04;
                pts.push({
                    t: extraT,
                    x: lastPt.x - k * 0.14,
                    y: Math.max(0.11, lastPt.y - k * 0.06),
                    z: lastPt.z + reboundZ * k * 0.05
                });
            }
        }

        return pts;
    },

    evaluateShot: function(params) {
        const {
            distGoal,
            distWall,
            vi,
            alphaDeg,
            lateralAngleDeg,
            wallJumps,
            wallActive,
            wallCenterZ = 0
        } = params;

        const alphaRad = this.degToRad(alphaDeg);
        const latRad = this.degToRad(lateralAngleDeg || 0);

        const GOAL_WIDTH = 7.32;
        const GOAL_HEIGHT = 2.44;
        const POST_HALF_WIDTH = GOAL_WIDTH / 2;

        const WALL_HALF_WIDTH = 1.25;
        const WALL_STANDING_HEIGHT = 1.85;
        const WALL_JUMP_HEIGHT = 2.40;
        const WALL_JUMP_GAP = 0.55;

        const xi = 0;
        const yi = 0.11;

        // 1. Evaluación en la Barrera
        let wallCollision = null;
        if (wallActive && distWall > 0 && distWall < distGoal) {
            const tWall = this.getTimeForDistance(xi, distWall, vi, alphaRad);
            const yAtWall = this.getYf(yi, vi, alphaRad, tWall);
            const zAtWall = this.getZf(0, vi, alphaRad, latRad, tWall);

            // Comparar posición relativa a la barrera (que se mueve lateralmente con wallCenterZ)
            const relWallZ = Math.abs(zAtWall - wallCenterZ);

            if (relWallZ <= WALL_HALF_WIDTH) {
                if (wallJumps) {
                    if (yAtWall < WALL_JUMP_GAP) {
                        wallCollision = {
                            hit: false,
                            underJump: true,
                            yAtWall,
                            tWall
                        };
                    } else if (yAtWall <= WALL_JUMP_HEIGHT) {
                        return {
                            outcome: 'WALL_HIT_AIR',
                            message: '¡Rebotó en la barrera saltando!',
                            yAtWall,
                            zAtWall,
                            tWall,
                            hitTime: tWall,
                            xHit: distWall,
                            yHit: yAtWall,
                            zHit: zAtWall
                        };
                    } else {
                        wallCollision = {
                            hit: false,
                            overJump: true,
                            yAtWall,
                            tWall
                        };
                    }
                } else {
                    if (yAtWall <= WALL_STANDING_HEIGHT) {
                        return {
                            outcome: 'WALL_HIT_GROUND',
                            message: '¡Rebotó en la barrera parada!',
                            yAtWall,
                            zAtWall,
                            tWall,
                            hitTime: tWall,
                            xHit: distWall,
                            yHit: yAtWall,
                            zHit: zAtWall
                        };
                    } else {
                        wallCollision = {
                            hit: false,
                            overStanding: true,
                            yAtWall,
                            tWall
                        };
                    }
                }
            }
        }

        // 2. Evaluación en la Línea de Gol (con física de pique / rebote en el césped)
        const vfyInitial = vi * Math.sin(alphaRad);
        let bounced = false;
        let tGoal = this.getTimeForDistance(xi, distGoal, vi, alphaRad);
        let yAtGoal = this.getYf(yi, vi, alphaRad, tGoal);
        let zAtGoal = this.getZf(0, vi, alphaRad, latRad, tGoal);

        // Comprobar si el balón rueda o toca el césped antes de la línea de gol
        if (vfyInitial <= 0) {
            bounced = true;
            const vfxGround = Math.max(1.0, 0.88 * vi * Math.cos(alphaRad));
            tGoal = distGoal / vfxGround;
            yAtGoal = 0.11;
            zAtGoal = this.getZf(0, vi, alphaRad, latRad, tGoal);
        } else {
            const tGround = (2 * vfyInitial) / this.g;
            const xGround = this.getXf(xi, vi, alphaRad, tGround);

            if (tGround > 0.05 && xGround < distGoal) {
                bounced = true;
                const e = 0.52; // Coeficiente de restitución del césped
                const vfyHit = vfyInitial - this.g * tGround;
                const vfyBounce = e * Math.abs(vfyHit);
                const vfxBounce = 0.88 * vi * Math.cos(alphaRad);

                const tRem = (distGoal - xGround) / Math.max(0.1, vfxBounce);
                tGoal = tGround + tRem;
                yAtGoal = Math.max(0.11, 0.11 + vfyBounce * tRem - 0.5 * this.g * (tRem * tRem));
                zAtGoal = this.getZf(0, vi, alphaRad, latRad, tGoal);
            }
        }

        // El balón nunca penetra el suelo
        yAtGoal = Math.max(0.11, yAtGoal);

        const vfx = this.getVfx(vi, alphaRad, tGoal);
        const vfy = this.getVfy(vi, alphaRad, tGoal);

        // Detección de travesaño y postes
        const isPost = Math.abs(Math.abs(zAtGoal) - POST_HALF_WIDTH) < 0.22 && yAtGoal >= 0 && yAtGoal <= GOAL_HEIGHT + 0.15;
        const isCrossbar = Math.abs(yAtGoal - GOAL_HEIGHT) < 0.22 && Math.abs(zAtGoal) <= POST_HALF_WIDTH + 0.15;

        if (isCrossbar) {
            return {
                outcome: 'CROSSBAR',
                message: '¡¡PEGÓ EN EL TRAVESAÑO!! ¡CLAAANG!',
                yAtGoal, zAtGoal, tGoal, vfx, vfy, wallCollision, bounced, gkReached: false
            };
        }

        if (isPost) {
            return {
                outcome: 'POST',
                message: '¡¡PEGÓ EN EL PALO VERTICAL!!',
                yAtGoal, zAtGoal, tGoal, vfx, vfy, wallCollision, bounced, gkReached: false
            };
        }

        // ¿El balón cruza el marco reglamentario del arco?
        const inGoalY = yAtGoal >= 0.06 && yAtGoal <= GOAL_HEIGHT;
        const inGoalZ = Math.abs(zAtGoal) < (POST_HALF_WIDTH - 0.08);

        if (inGoalY && inGoalZ) {
            const isTopCorner = (yAtGoal >= 1.88 && yAtGoal <= GOAL_HEIGHT) && (Math.abs(zAtGoal) >= 1.85);
            const isBottomCorner = (yAtGoal <= 0.65) && (Math.abs(zAtGoal) >= 1.85);
            const isUnderWallGoal = wallCollision && wallCollision.underJump;

            // Alcance físico del golero Muslera al estirarse
            // Si el tiro es muy esquinado, bombeado al ángulo, rasante al rincón o bajo la barrera, el arquero NO LLEGA
            const isOutOfReach = isTopCorner || isBottomCorner || isUnderWallGoal || (bounced && Math.abs(zAtGoal) > 1.15) || Math.abs(zAtGoal) > 2.05;

            if (!isOutOfReach) {
                // Muslera llega físicamente y ATAJA el tiro
                return {
                    outcome: 'SAVED',
                    message: bounced ? '¡¡ATAJADA DE MUSLERA ABAJO!! ¡Atrapó el balón picando!' : '¡¡MONUMENTAL ATAJADA DE MUSLERA!! ¡Desvió el remate!',
                    yAtGoal,
                    zAtGoal,
                    tGoal,
                    vfx,
                    vfy,
                    wallCollision,
                    bounced,
                    gkReached: true
                };
            }

            // Es GOL legítimo (el arquero se estira pero no llega)
            let outcome = 'GOAL';
            let message = '¡¡¡GOOOOOOOL!!! ⚽🔥';

            if (isTopCorner) {
                outcome = 'TOP_CORNER';
                message = '¡¡¡QUÉ GOLAZO AL ÁNGULO, IMPOSIBLE PARA EL ARQUERO!!! 🎯🔥';
            } else if (isUnderWallGoal) {
                outcome = 'UNDER_WALL_GOAL';
                message = '¡¡MAGIA PURA: GOLAZO POR DEBAJO DE LA BARRERA!! 🪄✨';
            } else if (bounced) {
                outcome = 'BOUNCE_GOAL';
                message = '¡¡GOLAZO PICANDO EN EL CÉSPED Y AL FONDO DE LA RED!! ⚡⚽';
            } else if (isBottomCorner) {
                outcome = 'BOTTOM_CORNER';
                message = '¡¡GOLAZO RASANTE ESQUINADO AL RINCÓN!! ⚡';
            }

            return {
                outcome,
                message,
                yAtGoal,
                zAtGoal,
                tGoal,
                vfx,
                vfy,
                wallCollision,
                bounced,
                gkReached: false
            };
        }

        // Se fue afuera
        let missMessage = '¡El remate se fue desviado!';
        if (yAtGoal > GOAL_HEIGHT) {
            missMessage = '¡Balón muy alto, por encima del travesaño!';
        } else if (Math.abs(zAtGoal) >= (POST_HALF_WIDTH - 0.08)) {
            missMessage = '¡Tiro ancho, rozando el palo exterior!';
        } else {
            missMessage = '¡El remate no tuvo dirección al arco!';
        }

        return {
            outcome: 'MISS',
            message: missMessage,
            yAtGoal,
            zAtGoal,
            tGoal,
            vfx,
            vfy,
            wallCollision,
            bounced,
            gkReached: false
        };
    },

    // Función auxiliar para obtener aceleración en X (viento)
    getAx: function() {
        return this.ax || 0;
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Physics;
}
