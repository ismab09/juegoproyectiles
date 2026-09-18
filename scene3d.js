/**
 * scene3d.js - Renderizador 3D con Three.js para Tiro Libre Cinemático
 * Incluye:
 * 1. Futbolista pateador realista con animación de carrera e impacto de botín
 * 2. Balón realista con costuras de cuero, rotación y sombra dinámica sobre el césped
 * 3. Arquero Fernando Muslera con estirada / vuelo hacia los lados y retorno automático
 * 4. Barrera defensiva táctica que se desplaza lateralmente según el ángulo de tiro
 * 5. Cámara lateral (Gráfico X-Y) completamente horizontal a la altura mediana del tiro
 * 6. Tribuna retro con hinchada animada, banderas ondulantes y festejo de GOL
 */

class FootballScene {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.scene = null;
        this.camera = null;
        this.renderer = null;

        // Entidades principales
        this.ball = null;
        this.ballShadow = null;
        this.kicker = null;
        this.kickerLegR = null;
        this.kickerArmL = null;
        this.kickerArmR = null;
        this.wallGroup = null;
        this.wallPlayers = [];
        this.goalGroup = null;
        this.goalkeeper = null; // Fernando Muslera
        this.pitch = null;
        this.targetMarker = null;
        this.lowTargetMarker = null;
        this.trajectoryLine = null;
        this.sprayLines = [];

        // Elementos de la Tribuna Retro
        this.standsGroup = null;
        this.goalLinesGroup = null;
        this.spectators = [];
        this.flags = [];
        this.confettiParticles = [];
        this.confettiGroup = null;
        this.retroAdBoards = [];
        this.isCelebratingGoal = false;
        this.celebrationStartTime = 0;

        // Estado del tiro y animación
        this.ballPos = { x: 0, y: 0.11, z: 0 };
        this.distGoal = 22;   // Distancia al arco en metros
        this.distWall = 9.15; // Distancia reglamentaria de barrera
        this.wallLateralOffset = 0; // Desplazamiento táctico lateral de la barrera
        this.isKicking = false;
        this.kickProgress = 0;
        this.kickDuration = 1.0;
        this.flightPoints = [];
        this.cameraMode = 'player'; // 'player', 'follow', 'side', 'goal'

        // Control de cámara libre con click derecho en todas las vistas
        this.isRightDragging = false;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.cameraTarget = new THREE.Vector3(0, 1.25, -this.distGoal);
        this.orbitAngles = {
            theta: 0,
            phi: Math.PI / 2,
            radius: 20
        };
        this.fpsLook = {
            yaw: 0,
            pitch: 0
        };

        // Estado del arquero
        this.gkState = 'ready'; // 'ready', 'dive', 'resetting'
        this.gkTargetX = 0;
        this.gkTargetY = 0;
        this.gkTargetRotZ = 0;
        this.gkTargetRotX = 0;
        this.gkTargetRotY = 0;
        this.gkArmTargetL = null;
        this.gkArmTargetR = null;

        this.wallJumps = false;
        this.onShotComplete = null;
        this.activeShotResult = null;

        this.init();
    }

    init() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;

        // 1. Escena 3D
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x061121);
        this.scene.fog = new THREE.FogExp2(0x061121, 0.014);

        // 2. Cámara
        this.camera = new THREE.PerspectiveCamera(54, width / height, 0.1, 160);
        this.setCameraView('player');

        // 3. Renderer WebGL
        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.container.appendChild(this.renderer.domElement);

        // 4. Iluminación de Estadio
        this.setupLighting();

        // 5. Césped y Campo
        this.createPitch();

        // 6. Arco Reglamentario
        this.createGoal();

        // 7. Tribuna Retro con Hinchada, Banderas y Confetti
        this.createRetroStands();

        // 8. Barrera de Jugadores Realista con Volumen
        this.createRealisticWall();

        // 9. Arquero Fernando Muslera Realista
        this.createMuslera();

        // 10. Futbolista Pateador Realista
        this.createKicker();

        // 11. Balón Realista con Costuras y Sombra Dinámica
        this.createBall();
        this.createTargetMarkers();

        // 12. Configurar vista inicial en 1ra persona (ocultando el modelo del jugador)
        this.setCameraView('player');

        // 13. Controles de Cámara Libre con Click Derecho y Zoom
        this.setupCameraControls();

        // Eventos de Redimensionamiento
        window.addEventListener('resize', () => this.onResize());

        // Bucle Principal de Renderizado
        this.animate = this.animate.bind(this);
        requestAnimationFrame(this.animate);
    }

    setupLighting() {
        const ambient = new THREE.AmbientLight(0xffffff, 0.65);
        this.scene.add(ambient);

        const mainLight = new THREE.DirectionalLight(0xfff8ee, 1.15);
        mainLight.position.set(12, 32, 22);
        mainLight.castShadow = true;
        mainLight.shadow.mapSize.width = 2048;
        mainLight.shadow.mapSize.height = 2048;
        mainLight.shadow.camera.near = 0.5;
        mainLight.shadow.camera.far = 85;
        mainLight.shadow.camera.left = -22;
        mainLight.shadow.camera.right = 22;
        mainLight.shadow.camera.top = 32;
        mainLight.shadow.camera.bottom = -12;
        this.scene.add(mainLight);

        const spotL = new THREE.SpotLight(0xa7f3d0, 0.7, 70, Math.PI / 3.5, 0.4);
        spotL.position.set(-18, 22, -this.distGoal + 6);
        spotL.target.position.set(0, 1.2, -this.distGoal);
        this.scene.add(spotL);
        this.scene.add(spotL.target);

        const spotR = new THREE.SpotLight(0xbae6fd, 0.7, 70, Math.PI / 3.5, 0.4);
        spotR.position.set(18, 22, -this.distGoal + 6);
        spotR.target.position.set(0, 1.2, -this.distGoal);
        this.scene.add(spotR);
        this.scene.add(spotR.target);
    }

    createPitch() {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        for (let y = 0; y < 512; y += 64) {
            ctx.fillStyle = (y / 64) % 2 === 0 ? '#1b4d24' : '#23612d';
            ctx.fillRect(0, y, 512, 64);
        }
        ctx.fillStyle = 'rgba(0,0,0,0.035)';
        for (let i = 0; i < 3500; i++) {
            ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 3);
        }

        const grassTex = new THREE.CanvasTexture(canvas);
        grassTex.wrapS = THREE.RepeatWrapping;
        grassTex.wrapT = THREE.RepeatWrapping;
        grassTex.repeat.set(8, 20);

        const pitchGeo = new THREE.PlaneGeometry(55, 90);
        const pitchMat = new THREE.MeshLambertMaterial({ map: grassTex, roughness: 0.85 });
        this.pitch = new THREE.Mesh(pitchGeo, pitchMat);
        this.pitch.rotation.x = -Math.PI / 2;
        this.pitch.position.set(0, 0, -20);
        this.pitch.receiveShadow = true;
        this.scene.add(this.pitch);

        this.createPitchLines();
    }

    createPitchLines() {
        const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        this.goalLinesGroup = new THREE.Group();

        const goalLine = new THREE.Mesh(new THREE.PlaneGeometry(24, 0.12), lineMat);
        goalLine.rotation.x = -Math.PI / 2;
        goalLine.position.set(0, 0.005, 0);
        this.goalLinesGroup.add(goalLine);

        // Área chica
        const areaChica = new THREE.Group();
        const acFront = new THREE.Mesh(new THREE.PlaneGeometry(18.32, 0.12), lineMat);
        acFront.rotation.x = -Math.PI / 2;
        acFront.position.set(0, 0.005, 5.5);
        areaChica.add(acFront);

        const acSideL = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 5.5), lineMat);
        acSideL.rotation.x = -Math.PI / 2;
        acSideL.position.set(-9.16, 0.005, 2.75);
        areaChica.add(acSideL);

        const acSideR = acSideL.clone();
        acSideR.position.x = 9.16;
        areaChica.add(acSideR);
        this.goalLinesGroup.add(areaChica);

        // Área grande
        const areaGrande = new THREE.Group();
        const agFront = new THREE.Mesh(new THREE.PlaneGeometry(36, 0.12), lineMat);
        agFront.rotation.x = -Math.PI / 2;
        agFront.position.set(0, 0.005, 16.5);
        areaGrande.add(agFront);

        const agSideL = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 16.5), lineMat);
        agSideL.rotation.x = -Math.PI / 2;
        agSideL.position.set(-18, 0.005, 8.25);
        areaGrande.add(agSideL);

        const agSideR = agSideL.clone();
        agSideR.position.x = 18;
        areaGrande.add(agSideR);
        this.goalLinesGroup.add(areaGrande);

        const penSpot = new THREE.Mesh(new THREE.CircleGeometry(0.2, 16), lineMat);
        penSpot.rotation.x = -Math.PI / 2;
        penSpot.position.set(0, 0.006, 11);
        this.goalLinesGroup.add(penSpot);

        this.goalLinesGroup.position.set(0, 0, -this.distGoal);
        this.scene.add(this.goalLinesGroup);

        const sprayBall = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.30, 24), new THREE.MeshBasicMaterial({ color: 0xe0f7fa, side: THREE.DoubleSide }));
        sprayBall.rotation.x = -Math.PI / 2;
        sprayBall.position.set(0, 0.006, 0);
        this.scene.add(sprayBall);

        const sprayWall = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.15), new THREE.MeshBasicMaterial({ color: 0xe0f7fa }));
        sprayWall.rotation.x = -Math.PI / 2;
        sprayWall.position.set(0, 0.006, -this.distWall);
        this.scene.add(sprayWall);
        this.sprayLines.push(sprayWall);
    }

    createGoal() {
        this.goalGroup = new THREE.Group();
        const postMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            metalness: 0.35,
            roughness: 0.18
        });

        const postRadius = 0.06;
        const goalWidth = 7.32;
        const goalHeight = 2.44;
        const goalDepth = 1.9;

        const postL = new THREE.Mesh(new THREE.CylinderGeometry(postRadius, postRadius, goalHeight, 20), postMat);
        postL.position.set(-goalWidth / 2, goalHeight / 2, 0);
        postL.castShadow = true;
        this.goalGroup.add(postL);

        const postR = postL.clone();
        postR.position.x = goalWidth / 2;
        this.goalGroup.add(postR);

        const crossbar = new THREE.Mesh(new THREE.CylinderGeometry(postRadius, postRadius, goalWidth + postRadius * 2, 20), postMat);
        crossbar.rotation.z = Math.PI / 2;
        crossbar.position.set(0, goalHeight, 0);
        crossbar.castShadow = true;
        this.goalGroup.add(crossbar);

        const netMat = new THREE.MeshBasicMaterial({
            color: 0xf1f5f9,
            wireframe: true,
            transparent: true,
            opacity: 0.38
        });

        const backNet = new THREE.Mesh(new THREE.PlaneGeometry(goalWidth, goalHeight, 24, 12), netMat);
        backNet.position.set(0, goalHeight / 2, -goalDepth);
        this.goalGroup.add(backNet);

        const topNet = new THREE.Mesh(new THREE.PlaneGeometry(goalWidth, goalDepth, 24, 8), netMat);
        topNet.rotation.x = Math.PI / 2;
        topNet.position.set(0, goalHeight, -goalDepth / 2);
        this.goalGroup.add(topNet);

        const sideNetL = new THREE.Mesh(new THREE.PlaneGeometry(goalDepth, goalHeight, 8, 12), netMat);
        sideNetL.rotation.y = Math.PI / 2;
        sideNetL.position.set(-goalWidth / 2, goalHeight / 2, -goalDepth / 2);
        this.goalGroup.add(sideNetL);

        const sideNetR = sideNetL.clone();
        sideNetR.position.x = goalWidth / 2;
        this.goalGroup.add(sideNetR);

        this.goalGroup.position.set(0, 0, -this.distGoal);
        this.scene.add(this.goalGroup);
    }

    // =========================================================================
    // TRIBUNA RETRO 90s
    // =========================================================================
    createRetroStands() {
        this.standsGroup = new THREE.Group();
        this.spectators = [];
        this.flags = [];

        const standMat = new THREE.MeshLambertMaterial({ color: 0x182234 });
        const stepMat1 = new THREE.MeshLambertMaterial({ color: 0x0284c7 });
        const stepMat2 = new THREE.MeshLambertMaterial({ color: 0x0f172a });

        // TRIBUNA NORTE (Fondo detrás del arco, se mueve según distancia de tiro)
        const numTiers = 7;
        for (let tier = 0; tier < numTiers; tier++) {
            const stepGeo = new THREE.BoxGeometry(72, 1.4, 2.2);
            const mat = tier % 2 === 0 ? stepMat1 : stepMat2;
            const step = new THREE.Mesh(stepGeo, mat);
            step.position.set(0, tier * 1.5 + 0.8, -8 - tier * 2.0);
            this.standsGroup.add(step);

            const railGeo = new THREE.CylinderGeometry(0.03, 0.03, 72, 16);
            const railMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.7 });
            const rail = new THREE.Mesh(railGeo, railMat);
            rail.rotation.z = Math.PI / 2;
            rail.position.set(0, tier * 1.5 + 1.8, -7.2 - tier * 2.0);
            this.standsGroup.add(rail);

            this.populateTierWithFans(tier, -8 - tier * 2.0, tier * 1.5 + 1.5);
        }

        const backWall = new THREE.Mesh(new THREE.BoxGeometry(76, 24, 4), standMat);
        backWall.position.set(0, 10, -25);
        this.standsGroup.add(backWall);

        const roofGeo = new THREE.BoxGeometry(76, 1.2, 18);
        const roofMat = new THREE.MeshLambertMaterial({ color: 0x0f172a });
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.set(0, 20, -15);
        this.standsGroup.add(roof);

        this.createRetroAdBoards();
        this.createSupporterFlags();
        this.createConfettiSystem();

        this.standsGroup.position.set(0, 0, -this.distGoal);
        this.scene.add(this.standsGroup);

        // Crear gradas alrededor de toda la cancha (Sur, Este, Oeste y torres de iluminación)
        this.createSurroundingStands();
    }

    buildFan(x, y, z, rotY, targetGroup) {
        const shirtColors = [0x38bdf8, 0xf8fafc, 0xef4444, 0xfacc15, 0x0284c7, 0x10b981, 0x9333ea];
        const skinColors = [0xf5d0b0, 0xd4a373, 0xaa7a50, 0x8a5a36];

        const fanGroup = new THREE.Group();

        const shirtColor = shirtColors[Math.floor(Math.random() * shirtColors.length)];
        const skinColor = skinColors[Math.floor(Math.random() * skinColors.length)];

        const bodyGeo = new THREE.BoxGeometry(0.48, 0.65, 0.32);
        const body = new THREE.Mesh(bodyGeo, new THREE.MeshLambertMaterial({ color: shirtColor }));
        body.position.set(0, 0.35, 0);
        fanGroup.add(body);

        const headGeo = new THREE.BoxGeometry(0.28, 0.30, 0.28);
        const head = new THREE.Mesh(headGeo, new THREE.MeshLambertMaterial({ color: skinColor }));
        head.position.set(0, 0.85, 0);
        fanGroup.add(head);

        const hairGeo = new THREE.BoxGeometry(0.30, 0.12, 0.30);
        const hairColor = Math.random() > 0.4 ? (Math.random() > 0.5 ? 0x221711 : 0x4a2c16) : shirtColor;
        const hair = new THREE.Mesh(hairGeo, new THREE.MeshLambertMaterial({ color: hairColor }));
        hair.position.set(0, 0.98, 0);
        fanGroup.add(hair);

        const armMat = new THREE.MeshLambertMaterial({ color: shirtColor });
        const armL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.45, 0.12), armMat);
        armL.position.set(-0.32, 0.45, 0.1);
        fanGroup.add(armL);

        const armR = armL.clone();
        armR.position.x = 0.32;
        fanGroup.add(armR);

        fanGroup.position.set(x, y, z);
        fanGroup.rotation.y = rotY || 0;

        targetGroup.add(fanGroup);

        this.spectators.push({
            group: fanGroup,
            armL: armL,
            armR: armR,
            baseY: y,
            phase: Math.random() * Math.PI * 2,
            speed: 3.5 + Math.random() * 2.0,
            jumpHeight: 0.45 + Math.random() * 0.4
        });
    }

    populateTierWithFans(tier, zPos, yPos) {
        const fansPerRow = 18;
        const spacingX = 3.6;
        const startX = -((fansPerRow - 1) * spacingX) / 2;

        for (let i = 0; i < fansPerRow; i++) {
            const posX = startX + i * spacingX + (Math.random() - 0.5) * 0.8;
            this.buildFan(posX, yPos, zPos, 0, this.standsGroup);
        }
    }

    createSurroundingStands() {
        this.surroundStandsGroup = new THREE.Group();

        const standMat = new THREE.MeshLambertMaterial({ color: 0x182234 });
        const stepMat1 = new THREE.MeshLambertMaterial({ color: 0x0284c7 });
        const stepMat2 = new THREE.MeshLambertMaterial({ color: 0x0f172a });

        // 1. TRIBUNA SUR (Detrás del futbolista, Z = 14 a 24, mirando al Norte hacia el arco)
        const numTiersSouth = 5;
        for (let tier = 0; tier < numTiersSouth; tier++) {
            const stepGeo = new THREE.BoxGeometry(68, 1.4, 2.2);
            const mat = tier % 2 === 0 ? stepMat1 : stepMat2;
            const step = new THREE.Mesh(stepGeo, mat);
            const zStep = 14 + tier * 2.0;
            const yStep = tier * 1.5 + 0.8;
            step.position.set(0, yStep, zStep);
            this.surroundStandsGroup.add(step);

            const railGeo = new THREE.CylinderGeometry(0.03, 0.03, 68, 16);
            const rail = new THREE.Mesh(railGeo, new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.7 }));
            rail.rotation.z = Math.PI / 2;
            rail.position.set(0, yStep + 1.0, zStep - 0.8);
            this.surroundStandsGroup.add(rail);

            const fansPerRow = 16;
            const spacingX = 3.8;
            const startX = -((fansPerRow - 1) * spacingX) / 2;
            for (let i = 0; i < fansPerRow; i++) {
                const posX = startX + i * spacingX + (Math.random() - 0.5) * 0.8;
                this.buildFan(posX, yStep + 0.7, zStep, Math.PI, this.surroundStandsGroup);
            }
        }
        const backWallSouth = new THREE.Mesh(new THREE.BoxGeometry(72, 18, 3), standMat);
        backWallSouth.position.set(0, 8, 25);
        this.surroundStandsGroup.add(backWallSouth);

        const roofSouth = new THREE.Mesh(new THREE.BoxGeometry(72, 1.2, 16), new THREE.MeshLambertMaterial({ color: 0x0f172a }));
        roofSouth.position.set(0, 17, 18);
        this.surroundStandsGroup.add(roofSouth);

        // 2. TRIBUNA ESTE (Lateral derecho, X = 25 a 35, Z de -48 a 16, mirando al Oeste)
        const numTiersSide = 5;
        for (let tier = 0; tier < numTiersSide; tier++) {
            const stepGeo = new THREE.BoxGeometry(2.2, 1.4, 66);
            const mat = tier % 2 === 0 ? stepMat1 : stepMat2;
            const step = new THREE.Mesh(stepGeo, mat);
            const xStep = 25 + tier * 2.0;
            const yStep = tier * 1.5 + 0.8;
            step.position.set(xStep, yStep, -16);
            this.surroundStandsGroup.add(step);

            const railGeo = new THREE.CylinderGeometry(0.03, 0.03, 66, 16);
            const rail = new THREE.Mesh(railGeo, new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.7 }));
            rail.position.set(xStep - 0.8, yStep + 1.0, -16);
            this.surroundStandsGroup.add(rail);

            const fansPerCol = 14;
            const spacingZ = 4.2;
            const startZ = -16 - ((fansPerCol - 1) * spacingZ) / 2;
            for (let i = 0; i < fansPerCol; i++) {
                const posZ = startZ + i * spacingZ + (Math.random() - 0.5) * 0.8;
                this.buildFan(xStep, yStep + 0.7, posZ, -Math.PI / 2, this.surroundStandsGroup);
            }
        }
        const backWallEast = new THREE.Mesh(new THREE.BoxGeometry(3, 18, 70), standMat);
        backWallEast.position.set(36, 8, -16);
        this.surroundStandsGroup.add(backWallEast);

        const roofEast = new THREE.Mesh(new THREE.BoxGeometry(16, 1.2, 70), new THREE.MeshLambertMaterial({ color: 0x0f172a }));
        roofEast.position.set(29, 17, -16);
        this.surroundStandsGroup.add(roofEast);

        // 3. TRIBUNA OESTE (Lateral izquierdo, X = -25 a -35, Z de -48 a 16, mirando al Este)
        for (let tier = 0; tier < numTiersSide; tier++) {
            const stepGeo = new THREE.BoxGeometry(2.2, 1.4, 66);
            const mat = tier % 2 === 0 ? stepMat1 : stepMat2;
            const step = new THREE.Mesh(stepGeo, mat);
            const xStep = -25 - tier * 2.0;
            const yStep = tier * 1.5 + 0.8;
            step.position.set(xStep, yStep, -16);
            this.surroundStandsGroup.add(step);

            const railGeo = new THREE.CylinderGeometry(0.03, 0.03, 66, 16);
            const rail = new THREE.Mesh(railGeo, new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.7 }));
            rail.position.set(xStep + 0.8, yStep + 1.0, -16);
            this.surroundStandsGroup.add(rail);

            const fansPerCol = 14;
            const spacingZ = 4.2;
            const startZ = -16 - ((fansPerCol - 1) * spacingZ) / 2;
            for (let i = 0; i < fansPerCol; i++) {
                const posZ = startZ + i * spacingZ + (Math.random() - 0.5) * 0.8;
                this.buildFan(xStep, yStep + 0.7, posZ, Math.PI / 2, this.surroundStandsGroup);
            }
        }
        const backWallWest = new THREE.Mesh(new THREE.BoxGeometry(3, 18, 70), standMat);
        backWallWest.position.set(-36, 8, -16);
        this.surroundStandsGroup.add(backWallWest);

        const roofWest = new THREE.Mesh(new THREE.BoxGeometry(16, 1.2, 70), new THREE.MeshLambertMaterial({ color: 0x0f172a }));
        roofWest.position.set(-29, 17, -16);
        this.surroundStandsGroup.add(roofWest);

        // 4. 4 TORRES DE ILUMINACIÓN DE ESTADIO (Floodlight Towers)
        this.createFloodlightTower(-25, -46, 0, -20);
        this.createFloodlightTower(25, -46, 0, -20);
        this.createFloodlightTower(-25, 14, 0, -10);
        this.createFloodlightTower(25, 14, 0, -10);

        this.scene.add(this.surroundStandsGroup);
    }

    createFloodlightTower(posX, posZ, targetX, targetZ) {
        const towerGroup = new THREE.Group();
        const metalMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.75, roughness: 0.35 });

        // Base de hormigón
        const base = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.2, 2.5), new THREE.MeshLambertMaterial({ color: 0x334155 }));
        base.position.set(0, 0.6, 0);
        towerGroup.add(base);

        // 4 Columnas principales de celosía
        const height = 21;
        for (let dx of [-0.65, 0.65]) {
            for (let dz of [-0.65, 0.65]) {
                const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, height, 8), metalMat);
                leg.position.set(dx, height / 2 + 1.2, dz);
                towerGroup.add(leg);
            }
        }

        // Travesaños horizontales de la torre
        for (let y = 4; y < height; y += 3.5) {
            const braceGeo = new THREE.BoxGeometry(1.4, 0.08, 1.4);
            const brace = new THREE.Mesh(braceGeo, metalMat);
            brace.position.set(0, y + 1.2, 0);
            towerGroup.add(brace);
        }

        // Plataforma superior
        const platform = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.4, 2.2), metalMat);
        platform.position.set(0, height + 1.4, 0);
        towerGroup.add(platform);

        // Panel de focos (Matriz 4x3 de lámparas reflectoras potentes)
        const panelMat = new THREE.MeshLambertMaterial({ color: 0x1e293b });
        const panel = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.2, 0.4), panelMat);
        panel.position.set(0, height + 2.6, 0);

        const lightMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 4; c++) {
                const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.22, 0.22, 12), lightMat);
                lamp.rotation.x = Math.PI / 2;
                lamp.position.set(-1.2 + c * 0.8, -0.6 + r * 0.6, 0.22);
                panel.add(lamp);
            }
        }

        // Orientar el panel de luz hacia el centro del campo
        const lookAngleY = Math.atan2(targetX - posX, -(targetZ - posZ));
        panel.rotation.y = lookAngleY;
        panel.rotation.x = 0.35;
        towerGroup.add(panel);

        towerGroup.position.set(posX, 0, posZ);
        this.surroundStandsGroup.add(towerGroup);
    }

    createRetroAdBoards() {
        const boardTexts = [
            '★ SUPER GOOOL 98 ★',
            '★ ¡¡VAMOS LA CELESTE!! ★',
            '★ RETRO ARCADE LEAGUE ★',
            '★ INSERT COIN TO PLAY ★'
        ];

        const startX = -24;

        boardTexts.forEach((txt, idx) => {
            const canvas = document.createElement('canvas');
            canvas.width = 512;
            canvas.height = 128;
            const ctx = canvas.getContext('2d');

            ctx.fillStyle = '#080e1a';
            ctx.fillRect(0, 0, 512, 128);

            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 8;
            ctx.strokeRect(4, 4, 504, 120);

            ctx.fillStyle = '#38bdf8';
            ctx.font = 'bold 34px "Courier New", monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(txt, 256, 64);

            const tex = new THREE.CanvasTexture(canvas);
            const mat = new THREE.MeshBasicMaterial({ map: tex });
            const board = new THREE.Mesh(new THREE.BoxGeometry(11, 1.3, 0.25), mat);
            board.position.set(startX + idx * 16, 0.65, -3.8);

            this.standsGroup.add(board);
            this.retroAdBoards.push({ mesh: board, canvas: canvas, ctx: ctx, text: txt });
        });
    }

    createSupporterFlags() {
        const flagConfigs = [
            { x: -18, y: 8, z: -16, colorA: '#38bdf8', colorB: '#ffffff', type: 'stripes' },
            { x: -8, y: 12, z: -20, colorA: '#ef4444', colorB: '#ffffff', type: 'checks' },
            { x: 8, y: 12, z: -20, colorA: '#0284c7', colorB: '#facc15', type: 'stripes' },
            { x: 18, y: 8, z: -16, colorA: '#10b981', colorB: '#ffffff', type: 'checks' }
        ];

        flagConfigs.forEach((cfg) => {
            const flagGeo = new THREE.PlaneGeometry(3.6, 2.2, 12, 8);

            const canvas = document.createElement('canvas');
            canvas.width = 256;
            canvas.height = 160;
            const ctx = canvas.getContext('2d');

            if (cfg.type === 'stripes') {
                ctx.fillStyle = cfg.colorA;
                ctx.fillRect(0, 0, 256, 160);
                ctx.fillStyle = cfg.colorB;
                ctx.fillRect(0, 55, 256, 50);
            } else {
                ctx.fillStyle = cfg.colorA;
                ctx.fillRect(0, 0, 256, 160);
                ctx.fillStyle = cfg.colorB;
                for (let r = 0; r < 4; r++) {
                    for (let c = 0; c < 6; c++) {
                        if ((r + c) % 2 === 0) ctx.fillRect(c * 42, r * 40, 42, 40);
                    }
                }
            }

            const tex = new THREE.CanvasTexture(canvas);
            const mat = new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide });
            const flag = new THREE.Mesh(flagGeo, mat);
            flag.position.set(cfg.x, cfg.y, cfg.z);

            const pole = new THREE.Mesh(
                new THREE.CylinderGeometry(0.04, 0.04, 4.5, 12),
                new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8 })
            );
            pole.position.set(cfg.x - 1.8, cfg.y - 0.8, cfg.z);

            this.standsGroup.add(flag);
            this.standsGroup.add(pole);

            this.flags.push({ mesh: flag, geo: flagGeo, phase: Math.random() * Math.PI });
        });
    }

    createConfettiSystem() {
        this.confettiGroup = new THREE.Group();
        this.confettiParticles = [];

        const colors = [0xf59e0b, 0xef4444, 0x38bdf8, 0x10b981, 0xa855f7, 0xffffff];
        const numParticles = 85;

        for (let i = 0; i < numParticles; i++) {
            const color = colors[Math.floor(Math.random() * colors.length)];
            const geo = new THREE.PlaneGeometry(0.25, 0.25);
            const mat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
            const particle = new THREE.Mesh(geo, mat);

            particle.position.set((Math.random() - 0.5) * 28, 1 + Math.random() * 8, -6 - Math.random() * 12);
            particle.visible = false;

            this.confettiGroup.add(particle);
            this.confettiParticles.push({
                mesh: particle,
                vx: (Math.random() - 0.5) * 0.15,
                vy: 0.15 + Math.random() * 0.35,
                vz: (Math.random() - 0.5) * 0.12,
                rotSpeedX: Math.random() * 0.2,
                rotSpeedY: Math.random() * 0.2,
                initialY: particle.position.y
            });
        }

        this.standsGroup.add(this.confettiGroup);
    }

    triggerGoalCelebration() {
        this.isCelebratingGoal = true;
        this.celebrationStartTime = performance.now();

        this.confettiParticles.forEach((p) => {
            p.mesh.visible = true;
            p.mesh.position.y = 2.0 + Math.random() * 4.0;
            p.vy = 0.25 + Math.random() * 0.4;
        });

        this.retroAdBoards.forEach((board) => {
            board.ctx.fillStyle = '#f59e0b';
            board.ctx.fillRect(0, 0, 512, 128);
            board.ctx.strokeStyle = '#ef4444';
            board.ctx.lineWidth = 10;
            board.ctx.strokeRect(5, 5, 502, 118);
            board.ctx.fillStyle = '#ffffff';
            board.ctx.font = '900 42px "Courier New", monospace';
            board.ctx.textAlign = 'center';
            board.ctx.fillText('★ ¡¡¡GOOOOOOL!!! ★', 256, 64);
            board.mesh.material.map.needsUpdate = true;
        });
    }

    stopGoalCelebration() {
        this.isCelebratingGoal = false;
        this.confettiParticles.forEach(p => p.mesh.visible = false);

        this.retroAdBoards.forEach((board) => {
            board.ctx.fillStyle = '#080e1a';
            board.ctx.fillRect(0, 0, 512, 128);
            board.ctx.strokeStyle = '#f59e0b';
            board.ctx.lineWidth = 8;
            board.ctx.strokeRect(4, 4, 504, 120);
            board.ctx.fillStyle = '#38bdf8';
            board.ctx.font = 'bold 34px "Courier New", monospace';
            board.ctx.textAlign = 'center';
            board.ctx.fillText(board.text, 256, 64);
            board.mesh.material.map.needsUpdate = true;
        });
    }

    // =========================================================================
    // BARRERA DEFENSIVA REALISTA Y TÁCTICA
    // =========================================================================
    createRealisticWall() {
        this.wallGroup = new THREE.Group();
        this.wallPlayers = [];

        const numPlayers = 4;
        const playerSpacing = 0.58;
        const startX = -((numPlayers - 1) * playerSpacing) / 2;

        for (let i = 0; i < numPlayers; i++) {
            const player = this.buildDetailedPlayer(i);
            player.position.set(startX + i * playerSpacing, 0, 0);
            this.wallGroup.add(player);
            this.wallPlayers.push(player);
        }

        this.wallGroup.position.set(0, 0, -this.distWall);
        this.scene.add(this.wallGroup);
    }

    // Ajuste táctico de la barrera según la dirección lateral del tiro
    setWallLateralAim(lateralAngleDeg) {
        // En fútbol profesional, la barrera cubre el poste hacia donde perfila el tirador
        const rad = (lateralAngleDeg * Math.PI) / 180;
        const offset = Math.tan(rad) * this.distWall * 0.72;
        this.wallLateralOffset = offset;

        if (this.wallGroup) {
            this.wallGroup.position.x = offset;
        }
        if (this.sprayLines[0]) {
            this.sprayLines[0].position.x = offset;
        }
    }

    buildDetailedPlayer(index) {
        const player = new THREE.Group();

        const playerProfiles = [
            { skin: 0xd4a373, hair: 0x1c1917, hairStyle: 'buzz', height: 1.88, num: '4' },
            { skin: 0x8a5a36, hair: 0x0f172a, hairStyle: 'fade', height: 1.86, num: '3' },
            { skin: 0xf5d0b0, hair: 0x3f2e20, hairStyle: 'headband', height: 1.85, num: '5' },
            { skin: 0xd4a373, hair: 0x271a0c, hairStyle: 'sidepart', height: 1.84, num: '2' }
        ];
        const prof = playerProfiles[index];

        const skinMat = new THREE.MeshLambertMaterial({ color: prof.skin });
        const jerseyMat = new THREE.MeshLambertMaterial({ color: 0xef4444 });
        const jerseyDarkMat = new THREE.MeshLambertMaterial({ color: 0xb91c1c });
        const shortsMat = new THREE.MeshLambertMaterial({ color: 0x1e293b });
        const socksMat = new THREE.MeshLambertMaterial({ color: 0xf8fafc });
        const bootsMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4 });

        // Botines
        const bootGeo = new THREE.BoxGeometry(0.13, 0.09, 0.25);
        const bootL = new THREE.Mesh(bootGeo, bootsMat);
        bootL.position.set(-0.13, 0.045, 0.04);
        bootL.castShadow = true;
        player.add(bootL);

        const bootR = bootL.clone();
        bootR.position.x = 0.13;
        player.add(bootR);

        // Pantorrillas
        const calfGeo = new THREE.CylinderGeometry(0.065, 0.052, 0.44, 14);
        const calfL = new THREE.Mesh(calfGeo, socksMat);
        calfL.position.set(-0.13, 0.28, 0);
        calfL.castShadow = true;
        player.add(calfL);

        const calfR = calfL.clone();
        calfR.position.x = 0.13;
        player.add(calfR);

        // Rodillas
        const kneeGeo = new THREE.SphereGeometry(0.068, 12, 12);
        const kneeL = new THREE.Mesh(kneeGeo, skinMat);
        kneeL.position.set(-0.13, 0.52, 0.01);
        player.add(kneeL);

        const kneeR = kneeL.clone();
        kneeR.position.x = 0.13;
        player.add(kneeR);

        // Muslos
        const thighGeo = new THREE.CylinderGeometry(0.088, 0.068, 0.38, 14);
        const thighL = new THREE.Mesh(thighGeo, skinMat);
        thighL.position.set(-0.13, 0.72, 0);
        thighL.castShadow = true;
        player.add(thighL);

        const thighR = thighL.clone();
        thighR.position.x = 0.13;
        player.add(thighR);

        // Shorts
        const shortsGeo = new THREE.BoxGeometry(0.44, 0.34, 0.28);
        const shorts = new THREE.Mesh(shortsGeo, shortsMat);
        shorts.position.set(0, 0.98, 0);
        shorts.castShadow = true;
        player.add(shorts);

        const waistGeo = new THREE.BoxGeometry(0.42, 0.06, 0.26);
        const waist = new THREE.Mesh(waistGeo, jerseyDarkMat);
        waist.position.set(0, 1.15, 0);
        player.add(waist);

        // Torso
        const torsoGeo = new THREE.BoxGeometry(0.46, 0.52, 0.28);
        const torso = new THREE.Mesh(torsoGeo, jerseyMat);
        torso.position.set(0, 1.41, 0);
        torso.castShadow = true;
        player.add(torso);

        const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.14, 12), skinMat);
        neck.position.set(0, 1.69, 0);
        player.add(neck);

        const shoulderL = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 12), jerseyMat);
        shoulderL.position.set(-0.25, 1.58, 0);
        player.add(shoulderL);

        const shoulderR = shoulderL.clone();
        shoulderR.position.x = 0.25;
        player.add(shoulderR);

        // Brazos cruzados
        const armCrossGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.44, 12);
        const armCross1 = new THREE.Mesh(armCrossGeo, jerseyMat);
        armCross1.rotation.z = Math.PI / 2.3;
        armCross1.position.set(-0.06, 1.25, 0.16);
        player.add(armCross1);

        const armCross2 = new THREE.Mesh(armCrossGeo, jerseyMat);
        armCross2.rotation.z = -Math.PI / 2.3;
        armCross2.position.set(0.06, 1.21, 0.18);
        player.add(armCross2);

        const handL = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 10), skinMat);
        handL.position.set(0.12, 1.15, 0.20);
        player.add(handL);

        const handR = handL.clone();
        handR.position.x = -0.12;
        player.add(handR);

        // Cabeza
        const headGeo = new THREE.SphereGeometry(0.12, 16, 16);
        const head = new THREE.Mesh(headGeo, skinMat);
        head.position.set(0, 1.77, 0);
        head.castShadow = true;
        player.add(head);

        const hairMat = new THREE.MeshLambertMaterial({ color: prof.hair });
        if (prof.hairStyle === 'headband') {
            const hairGeo = new THREE.SphereGeometry(0.126, 14, 14, 0, Math.PI * 2, 0, Math.PI / 1.7);
            const hair = new THREE.Mesh(hairGeo, hairMat);
            hair.position.set(0, 1.80, 0);
            player.add(hair);

            const band = new THREE.Mesh(new THREE.TorusGeometry(0.122, 0.018, 8, 24), new THREE.MeshBasicMaterial({ color: 0xffffff }));
            band.rotation.x = Math.PI / 2;
            band.position.set(0, 1.80, 0);
            player.add(band);
        } else if (prof.hairStyle === 'fade') {
            const hairGeo = new THREE.BoxGeometry(0.24, 0.08, 0.24);
            const hair = new THREE.Mesh(hairGeo, hairMat);
            hair.position.set(0, 1.87, 0);
            player.add(hair);
        } else {
            const hairGeo = new THREE.SphereGeometry(0.125, 14, 14, 0, Math.PI * 2, 0, Math.PI / 2);
            const hair = new THREE.Mesh(hairGeo, hairMat);
            hair.position.set(0, 1.81, 0);
            player.add(hair);
        }

        return player;
    }

    // =========================================================================
    // ARQUERO FERNANDO MUSLERA: MODELO REALISTA, VUELO LATERAL Y RETORNO
    // =========================================================================
    createMuslera() {
        this.goalkeeper = new THREE.Group();

        const jerseyNeonMat = new THREE.MeshLambertMaterial({ color: 0xf97316 });
        const jerseyTrimMat = new THREE.MeshLambertMaterial({ color: 0x0f172a });
        const skinMat = new THREE.MeshLambertMaterial({ color: 0xd4a373 });
        const glovePalmMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.8 });
        const gloveBackMat = new THREE.MeshLambertMaterial({ color: 0xef4444 });
        const hairMat = new THREE.MeshLambertMaterial({ color: 0x1c1917 });
        const shortsMat = new THREE.MeshLambertMaterial({ color: 0x1e293b });
        const socksMat = new THREE.MeshLambertMaterial({ color: 0xf97316 });
        const bootsMat = new THREE.MeshStandardMaterial({ color: 0x1e293b });

        // Piernas articuladas de Fernando Muslera para salto atlético
        this.gkLegL = new THREE.Group();
        this.gkLegL.position.set(-0.26, 0.95, 0);

        const thighL = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.075, 0.44, 14), skinMat);
        thighL.position.set(0, -0.22, 0);
        this.gkLegL.add(thighL);

        const padL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 0.12), jerseyTrimMat);
        padL.position.set(0, -0.42, 0.02);
        this.gkLegL.add(padL);

        const calfL = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.06, 0.44, 14), socksMat);
        calfL.position.set(0, -0.66, 0);
        this.gkLegL.add(calfL);

        const bootL = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.09, 0.26), bootsMat);
        bootL.position.set(0, -0.91, 0.04);
        this.gkLegL.add(bootL);

        this.goalkeeper.add(this.gkLegL);

        this.gkLegR = new THREE.Group();
        this.gkLegR.position.set(0.26, 0.95, 0);

        const thighR = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.075, 0.44, 14), skinMat);
        thighR.position.set(0, -0.22, 0);
        this.gkLegR.add(thighR);

        const padR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 0.12), jerseyTrimMat);
        padR.position.set(0, -0.42, 0.02);
        this.gkLegR.add(padR);

        const calfR = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.06, 0.44, 14), socksMat);
        calfR.position.set(0, -0.66, 0);
        this.gkLegR.add(calfR);

        const bootR = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.09, 0.26), bootsMat);
        bootR.position.set(0, -0.91, 0.04);
        this.gkLegR.add(bootR);

        this.goalkeeper.add(this.gkLegR);

        // Shorts
        const shorts = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.36, 0.32), shortsMat);
        shorts.position.set(0, 1.06, 0);
        shorts.castShadow = true;
        this.goalkeeper.add(shorts);

        // Torso Muslera
        const torsoGeo = new THREE.BoxGeometry(0.54, 0.58, 0.32);
        const torso = new THREE.Mesh(torsoGeo, jerseyNeonMat);
        torso.position.set(0, 1.48, 0.02);
        torso.castShadow = true;
        this.goalkeeper.add(torso);

        const sidePanelL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.56, 0.30), jerseyTrimMat);
        sidePanelL.position.set(-0.26, 1.48, 0.02);
        this.goalkeeper.add(sidePanelL);

        const sidePanelR = sidePanelL.clone();
        sidePanelR.position.x = 0.26;
        this.goalkeeper.add(sidePanelR);

        const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.14, 14), skinMat);
        neck.position.set(0, 1.80, 0.02);
        this.goalkeeper.add(neck);

        // Hombros
        const shoulderL = new THREE.Mesh(new THREE.SphereGeometry(0.105, 14, 14), jerseyNeonMat);
        shoulderL.position.set(-0.34, 1.68, 0.02);
        this.goalkeeper.add(shoulderL);

        const shoulderR = shoulderL.clone();
        shoulderR.position.x = 0.34;
        this.goalkeeper.add(shoulderR);

        // Brazos articulados con guantes integrados jerárquicamente
        this.gkArmBaseL = { z: 0.65, x: -0.25 };
        this.gkArmBaseR = { z: -0.65, x: -0.25 };

        // Brazo izquierdo (pivote en el hombro)
        this.gkArmL = new THREE.Group();
        this.gkArmL.position.set(-0.34, 1.68, 0.02);
        this.gkArmL.rotation.z = this.gkArmBaseL.z;
        this.gkArmL.rotation.x = this.gkArmBaseL.x;

        const armMeshL = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.058, 0.52, 12), jerseyNeonMat);
        armMeshL.position.set(0, -0.26, 0);
        this.gkArmL.add(armMeshL);

        const armBand = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.08, 12), new THREE.MeshBasicMaterial({ color: 0xfacc15 }));
        armBand.position.set(0, -0.12, 0);
        this.gkArmL.add(armBand);

        // Guante izquierdo unido al extremo del brazo (muñeca)
        const gloveLGroup = new THREE.Group();
        gloveLGroup.position.set(0, -0.54, 0);

        const glovePalmL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.18, 0.09), gloveBackMat);
        gloveLGroup.add(glovePalmL);

        const palmL = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.17), glovePalmMat);
        palmL.position.set(0, 0, 0.046);
        gloveLGroup.add(palmL);

        for (let f = 0; f < 4; f++) {
            const finger = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.018, 0.08, 8), gloveBackMat);
            finger.position.set(-0.045 + f * 0.03, -0.12, 0);
            gloveLGroup.add(finger);
        }
        const thumbL = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.018, 0.07, 8), gloveBackMat);
        thumbL.rotation.z = -Math.PI / 4;
        thumbL.position.set(0.08, -0.04, 0.02);
        gloveLGroup.add(thumbL);

        this.gkArmL.add(gloveLGroup);
        this.gkGloveL = gloveLGroup;
        this.goalkeeper.add(this.gkArmL);

        // Brazo derecho (pivote en el hombro)
        this.gkArmR = new THREE.Group();
        this.gkArmR.position.set(0.34, 1.68, 0.02);
        this.gkArmR.rotation.z = this.gkArmBaseR.z;
        this.gkArmR.rotation.x = this.gkArmBaseR.x;

        const armMeshR = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.058, 0.52, 12), jerseyNeonMat);
        armMeshR.position.set(0, -0.26, 0);
        this.gkArmR.add(armMeshR);

        // Guante derecho unido al extremo del brazo
        const gloveRGroup = new THREE.Group();
        gloveRGroup.position.set(0, -0.54, 0);

        const glovePalmR = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.18, 0.09), gloveBackMat);
        gloveRGroup.add(glovePalmR);

        const palmR = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.17), glovePalmMat);
        palmR.position.set(0, 0, 0.046);
        gloveRGroup.add(palmR);

        for (let f = 0; f < 4; f++) {
            const finger = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.018, 0.08, 8), gloveBackMat);
            finger.position.set(-0.045 + f * 0.03, -0.12, 0);
            gloveRGroup.add(finger);
        }
        const thumbR = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.018, 0.07, 8), gloveBackMat);
        thumbR.rotation.z = Math.PI / 4;
        thumbR.position.set(-0.08, -0.04, 0.02);
        gloveRGroup.add(thumbR);

        this.gkArmR.add(gloveRGroup);
        this.gkGloveR = gloveRGroup;
        this.goalkeeper.add(this.gkArmR);

        // Rostro y peinado característico de Muslera
        const headGeo = new THREE.SphereGeometry(0.125, 16, 16);
        const head = new THREE.Mesh(headGeo, skinMat);
        head.position.set(0, 1.88, 0.02);
        head.castShadow = true;
        this.goalkeeper.add(head);

        const hairGeo = new THREE.SphereGeometry(0.13, 14, 14, 0, Math.PI * 2, 0, Math.PI / 2.1);
        const hair = new THREE.Mesh(hairGeo, hairMat);
        hair.position.set(0, 1.91, 0.02);
        this.goalkeeper.add(hair);

        const beardGeo = new THREE.BoxGeometry(0.16, 0.08, 0.12);
        const beard = new THREE.Mesh(beardGeo, new THREE.MeshLambertMaterial({ color: 0x33261d }));
        beard.position.set(0, 1.81, 0.07);
        this.goalkeeper.add(beard);

        const nose = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.05, 6), skinMat);
        nose.rotation.x = -Math.PI / 2;
        nose.position.set(0, 1.87, 0.14);
        this.goalkeeper.add(nose);

        this.goalkeeper.position.set(0, 0, -this.distGoal + 0.35);
        this.scene.add(this.goalkeeper);
    }

    // =========================================================================
    // 10. FUTBOLISTA PATEADOR REALISTA JUNTO AL BALÓN
    // =========================================================================
    createKicker() {
        this.kicker = new THREE.Group();

        const skinMat = new THREE.MeshLambertMaterial({ color: 0xd4a373 });
        const jerseyMat = new THREE.MeshLambertMaterial({ color: 0x0284c7 }); // Celeste #10
        const shortsMat = new THREE.MeshLambertMaterial({ color: 0x0f172a }); // Pantalón oscuro
        const socksMat = new THREE.MeshLambertMaterial({ color: 0x38bdf8 });  // Medias celestes
        const bootsMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.35 }); // Botines dorados
        const lacesMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
        const studsMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8 });

        // Función constructora de botines profesionales que apuntan ADELANTE (hacia -Z, hacia el arco)
        function createSoccerBoot() {
            const boot = new THREE.Group();

            // Suela (se extiende de Z = +0.075 [talón] a Z = -0.175 [punta delantera])
            const sole = new THREE.Mesh(new THREE.BoxGeometry(0.125, 0.03, 0.25), bootsMat);
            sole.position.set(0, 0.015, -0.05);
            sole.castShadow = true;
            boot.add(sole);

            // Empeine y puntera afilada hacia -Z
            const vamp = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.065, 0.15), bootsMat);
            vamp.position.set(0, 0.05, -0.09);
            boot.add(vamp);

            // Talón y contrafuerte trasero
            const heel = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.10), bootsMat);
            heel.position.set(0, 0.06, 0.025);
            boot.add(heel);

            // Cordones blancos sobre el empeine
            const laces = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.015, 0.09), lacesMat);
            laces.position.set(0, 0.085, -0.08);
            boot.add(laces);

            // Tapones inferiores en la suela
            for (let s = -1; s <= 1; s += 2) {
                const studF = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.008, 0.02, 6), studsMat);
                studF.position.set(s * 0.04, -0.01, -0.14);
                boot.add(studF);

                const studM = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.008, 0.02, 6), studsMat);
                studM.position.set(s * 0.04, -0.01, -0.05);
                boot.add(studM);

                const studB = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.008, 0.02, 6), studsMat);
                studB.position.set(s * 0.04, -0.01, 0.04);
                boot.add(studB);
            }

            return boot;
        }

        // Pie de apoyo izquierdo plantado en el césped apuntando hacia el arco (-Z)
        this.plantFoot = createSoccerBoot();
        this.plantFoot.position.set(-0.35, 0, -0.02);
        this.kicker.add(this.plantFoot);

        // Pierna izquierda de apoyo firme
        const plantLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.056, 0.86, 14), socksMat);
        plantLeg.position.set(-0.35, 0.46, 0.0);
        plantLeg.rotation.z = -0.05;
        this.kicker.add(plantLeg);

        // Pierna derecha de golpeo articulada: CADERA + RODILLA para latigazo auténtico
        this.kickerLegR = new THREE.Group();
        this.kickerLegR.position.set(0.14, 0.90, 0); // Pivote en la cadera derecha

        // Muslo derecho
        const kickThigh = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.068, 0.44, 14), skinMat);
        kickThigh.position.set(0, -0.22, 0);
        this.kickerLegR.add(kickThigh);

        // Rodilla articulada (pivote a 0.44 m bajo la cadera)
        this.kickerKneeR = new THREE.Group();
        this.kickerKneeR.position.set(0, -0.44, 0);

        const kneeCap = new THREE.Mesh(new THREE.SphereGeometry(0.065, 12, 12), skinMat);
        kneeCap.position.set(0, 0, 0.01);
        this.kickerKneeR.add(kneeCap);

        // Pantorrilla con media celeste
        const kickCalf = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.054, 0.42, 14), socksMat);
        kickCalf.position.set(0, -0.21, 0);
        this.kickerKneeR.add(kickCalf);

        // Botín derecho de golpeo orientado hacia adelante (-Z), con empeine mirando al balón
        this.kickBoot = createSoccerBoot();
        this.kickBoot.position.set(0, -0.42, 0);
        this.kickBoot.rotation.y = -0.15; // Inclinación natural de golpeo con empeine
        this.kickerKneeR.add(this.kickBoot);

        this.kickerLegR.add(this.kickerKneeR);
        this.kicker.add(this.kickerLegR);

        // Torso articulado para inclinación atlética
        this.kickerTorso = new THREE.Group();
        this.kickerTorso.position.set(-0.10, 1.0, 0);

        // Shorts
        const shorts = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.32, 0.28), shortsMat);
        shorts.position.set(0, 0, 0.02);
        this.kickerTorso.add(shorts);

        // Torso celeste #10
        const torso = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.54, 0.28), jerseyMat);
        torso.position.set(0, 0.38, 0.02);
        torso.castShadow = true;
        this.kickerTorso.add(torso);

        // Cuello y cabeza mirando concentrado hacia la portería
        const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.12, 12), skinMat);
        neck.position.set(0, 0.68, 0.02);
        this.kickerTorso.add(neck);

        const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 16), skinMat);
        head.position.set(0, 0.78, 0.05);
        head.rotation.x = -0.12;
        this.kickerTorso.add(head);

        const hair = new THREE.Mesh(new THREE.SphereGeometry(0.125, 14, 14, 0, Math.PI * 2, 0, Math.PI / 2.1), new THREE.MeshLambertMaterial({ color: 0x1c1917 }));
        hair.position.set(0, 0.81, 0.05);
        this.kickerTorso.add(hair);

        this.kicker.add(this.kickerTorso);

        // Brazos para equilibrio atlético
        this.kickerArmL = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.48, 12), jerseyMat);
        this.kickerArmL.position.set(-0.38, 1.42, 0.08);
        this.kickerArmL.rotation.z = 0.55;
        this.kickerArmL.rotation.x = -0.35;
        this.kicker.add(this.kickerArmL);

        this.kickerArmR = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.48, 12), jerseyMat);
        this.kickerArmR.position.set(0.18, 1.42, -0.05);
        this.kickerArmR.rotation.z = -0.45;
        this.kickerArmR.rotation.x = 0;
        this.kicker.add(this.kickerArmR);

        // Ubicación del futbolista justo al lado y detrás del balón
        this.kicker.position.set(-0.06, 0, 0.42);
        this.scene.add(this.kicker);
    }

    // =========================================================================
    // 11. BALÓN REALISTA CON COSTURAS Y SOMBRA DINÁMICA
    // =========================================================================
    createBall() {
        const ballGeo = new THREE.SphereGeometry(0.11, 32, 32);

        // Textura procedural de alta definición de cuero con pentágonos y costuras 3D
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(0, 0, 512, 512);

        // Costuras en bajorrelieve
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 4;

        // Pentágonos clásicos Telstar con ribetes dorados
        const pentagons = [
            { x: 128, y: 128, r: 52 },
            { x: 384, y: 128, r: 52 },
            { x: 256, y: 320, r: 56 },
            { x: 80, y: 420, r: 44 },
            { x: 432, y: 420, r: 44 }
        ];

        pentagons.forEach((p) => {
            ctx.fillStyle = '#0f172a';
            ctx.beginPath();
            for (let a = 0; a < 5; a++) {
                const angle = (a * 2 * Math.PI) / 5 - Math.PI / 2;
                const px = p.x + p.r * Math.cos(angle);
                const py = p.y + p.r * Math.sin(angle);
                if (a === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();

            // Ribete dorado reflectante
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 3;
            ctx.stroke();
        });

        const ballTex = new THREE.CanvasTexture(canvas);
        const ballMat = new THREE.MeshStandardMaterial({
            map: ballTex,
            roughness: 0.28,
            metalness: 0.15
        });

        this.ball = new THREE.Mesh(ballGeo, ballMat);
        this.ball.position.set(0, 0.11, 0);
        this.ball.castShadow = true;
        this.scene.add(this.ball);

        // Sombra de contacto dinámica sobre el césped
        const shadowCanvas = document.createElement('canvas');
        shadowCanvas.width = 128;
        shadowCanvas.height = 128;
        const sCtx = shadowCanvas.getContext('2d');
        const grad = sCtx.createRadialGradient(64, 64, 10, 64, 64, 60);
        grad.addColorStop(0, 'rgba(0, 0, 0, 0.8)');
        grad.addColorStop(0.5, 'rgba(0, 0, 0, 0.4)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        sCtx.fillStyle = grad;
        sCtx.fillRect(0, 0, 128, 128);

        const shadowTex = new THREE.CanvasTexture(shadowCanvas);
        const shadowMat = new THREE.MeshBasicMaterial({
            map: shadowTex,
            transparent: true,
            opacity: 0.75,
            depthWrite: false
        });

        this.ballShadow = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.35), shadowMat);
        this.ballShadow.rotation.x = -Math.PI / 2;
        this.ballShadow.position.set(0, 0.006, 0);
        this.scene.add(this.ballShadow);
    }

    createTargetMarkers() {
        const targetGeo = new THREE.RingGeometry(0.25, 0.45, 32);
        const targetMat = new THREE.MeshBasicMaterial({
            color: 0xf59e0b,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.85
        });

        this.targetMarker = new THREE.Mesh(targetGeo, targetMat);
        this.targetMarker.position.set(2.8, 2.15, -this.distGoal + 0.05);
        this.scene.add(this.targetMarker);

        const lowTargetGeo = new THREE.RingGeometry(0.20, 0.35, 32);
        const lowTargetMat = new THREE.MeshBasicMaterial({
            color: 0x38bdf8,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.85
        });
        this.lowTargetMarker = new THREE.Mesh(lowTargetGeo, lowTargetMat);
        this.lowTargetMarker.position.set(-2.6, 0.35, -this.distGoal + 0.05);
        this.lowTargetMarker.visible = false;
        this.scene.add(this.lowTargetMarker);
    }

    setTargetMode(mode) {
        if (mode === 'top_corner') {
            this.targetMarker.visible = true;
            this.lowTargetMarker.visible = false;
        } else if (mode === 'low_shot') {
            this.targetMarker.visible = false;
            this.lowTargetMarker.visible = true;
        } else {
            this.targetMarker.visible = true;
            this.lowTargetMarker.visible = false;
        }
    }

    setTargetPosition(x, y) {
        if (this.targetMarker) {
            this.targetMarker.position.x = x;
            this.targetMarker.position.y = y;
            this.targetMarker.visible = true;
        }
        if (this.lowTargetMarker) {
            this.lowTargetMarker.visible = false; // Solo usamos la diana principal al moverla manualmente
        }
    }

    setDistance(newDist) {
        this.distGoal = newDist;
        this.distWall = 9.15;

        if (this.goalGroup) this.goalGroup.position.z = -this.distGoal;
        if (this.goalLinesGroup) this.goalLinesGroup.position.z = -this.distGoal;
        if (this.standsGroup) this.standsGroup.position.z = -this.distGoal;
        if (this.goalkeeper) this.goalkeeper.position.z = -this.distGoal + 0.35;
        if (this.targetMarker) this.targetMarker.position.z = -this.distGoal + 0.05;
        if (this.lowTargetMarker) this.lowTargetMarker.position.z = -this.distGoal + 0.05;

        if (this.wallGroup) this.wallGroup.position.z = -this.distWall;
        if (this.sprayLines[0]) this.sprayLines[0].position.z = -this.distWall;

        // Actualizar encuadre automático de la cámara según la distancia
        if (this.cameraMode === 'side' || this.cameraMode === 'goal' || this.cameraMode === 'player') {
            this.setCameraView(this.cameraMode);
        }

        this.resetBall();
    }

    setWallVisibility(visible) {
        if (this.wallGroup) this.wallGroup.visible = visible;
        if (this.sprayLines[0]) this.sprayLines[0].visible = visible;
    }

    // Calcula la distancia X lateral para que el pateador Y el arco SIEMPRE sean visibles en el gráfico X-Y (incluso a 35m)
    getSideCameraX() {
        const aspect = (this.camera && this.camera.aspect) ? this.camera.aspect : 1.25;
        const totalSpan = this.distGoal + 8.0; // Margen generoso para ver pateador (Z=0) y arco (Z=-distGoal) completos
        const fovHalf = ((this.camera ? this.camera.fov : 54) * Math.PI) / 360;
        const reqDist = (totalSpan / 2) / (Math.tan(fovHalf) * Math.max(0.85, aspect));
        return Math.max(24, reqDist * 1.08);
    }

    setCameraView(mode) {
        this.cameraMode = mode;
        this.camera.fov = 54;
        this.camera.updateProjectionMatrix();

        if (mode === 'player') {
            // Vista en 1ra persona desde los ojos del futbolista (el modelo del jugador se oculta)
            this.camera.position.set(0, 1.60, 0.45);
            this.cameraTarget.set(0, 1.25, -this.distGoal);
            this.camera.lookAt(this.cameraTarget);
            this.fpsLook.yaw = 0;
            this.fpsLook.pitch = 0;
            if (this.kicker) this.kicker.visible = false;
        } else {
            if (this.kicker) this.kicker.visible = true;

            if (mode === 'side') {
                // Perfil lateral cinemático completamente horizontal a la altura mediana del tiro
                // Calculado dinámicamente para que el arco SIEMPRE sea visible a cualquier distancia (hasta 35m)
                const sideX = this.getSideCameraX();
                const sideY = Math.max(1.8, 1.35 + this.distGoal * 0.035);
                const sideZ = -this.distGoal / 2;

                this.cameraTarget.set(0, 1.35, sideZ);
                this.camera.position.set(sideX, sideY, sideZ);
                this.camera.lookAt(this.cameraTarget);

                this.orbitAngles.radius = sideX;
                this.orbitAngles.theta = Math.PI / 2;
                this.orbitAngles.phi = Math.PI / 2;
            } else if (mode === 'goal') {
                // Vista desde el arco: ubicada para ver TODO EL MARCO DEL ARCO (ambos postes, travesaño, Muslera y cancha)
                const goalZ = -this.distGoal - 7.2;
                const goalY = 2.65;

                this.cameraTarget.set(0, 1.25, -this.distGoal);
                this.camera.position.set(0, goalY, goalZ);
                this.camera.lookAt(0, 1.20, 0); // Mirando a través de la red hacia el pateador

                this.orbitAngles.radius = 7.2;
                this.orbitAngles.theta = Math.PI;
                this.orbitAngles.phi = Math.PI / 2 - 0.20;
            } else if (mode === 'follow') {
                this.camera.position.set(0, 1.8, 3.5);
                this.cameraTarget.set(0, 1.2, -this.distGoal);
                this.camera.lookAt(this.cameraTarget);
                this.orbitAngles.radius = 6.0;
                this.orbitAngles.theta = 0;
                this.orbitAngles.phi = Math.PI / 2 - 0.15;
            }
        }
    }

    setupCameraControls() {
        const dom = this.renderer.domElement;

        // Desactivar menú contextual con click derecho para mover la cámara libremente
        dom.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            return false;
        });

        // Inicio de arrastre con Click Derecho (botón 2)
        dom.addEventListener('mousedown', (e) => {
            if (e.button === 2) {
                this.isRightDragging = true;
                this.dragStartX = e.clientX;
                this.dragStartY = e.clientY;
                dom.style.cursor = 'grab';
                e.preventDefault();
            }
        });

        // Arrastre con Click Derecho para mover la cámara libremente en todas las vistas
        window.addEventListener('mousemove', (e) => {
            if (!this.isRightDragging) return;

            const dx = e.clientX - this.dragStartX;
            const dy = e.clientY - this.dragStartY;
            this.dragStartX = e.clientX;
            this.dragStartY = e.clientY;

            this.handleCameraDrag(dx, dy, e.shiftKey);
        });

        // Fin de arrastre
        window.addEventListener('mouseup', (e) => {
            if (e.button === 2 && this.isRightDragging) {
                this.isRightDragging = false;
                dom.style.cursor = 'default';
            }
        });

        // Zoom con la rueda del mouse en todas las vistas
        dom.addEventListener('wheel', (e) => {
            e.preventDefault();
            this.handleCameraZoom(e.deltaY);
        }, { passive: false });
    }

    handleCameraDrag(dx, dy, isShift) {
        if (this.cameraMode === 'player') {
            // En 1ra persona: Giro de vista libre de la cabeza (Pitch y Yaw)
            const rotSpeed = 0.0035;
            this.fpsLook.yaw += dx * rotSpeed;
            this.fpsLook.pitch = Math.max(-Math.PI / 2.3, Math.min(Math.PI / 2.3, this.fpsLook.pitch - dy * rotSpeed));

            const lookDir = new THREE.Vector3(
                Math.sin(this.fpsLook.yaw) * Math.cos(this.fpsLook.pitch),
                Math.sin(this.fpsLook.pitch) + 0.02,
                -Math.cos(this.fpsLook.yaw) * Math.cos(this.fpsLook.pitch)
            );

            const targetPos = this.camera.position.clone().add(lookDir.multiplyScalar(25));
            this.camera.lookAt(targetPos);
        } else {
            if (isShift) {
                // Shift + Click derecho: Desplazamiento / Paneo en el plano de cámara
                const panSpeed = 0.035;
                const right = new THREE.Vector3();
                const up = new THREE.Vector3();
                this.camera.matrix.extractBasis(right, up, new THREE.Vector3());

                const moveVec = right.multiplyScalar(-dx * panSpeed).add(up.multiplyScalar(dy * panSpeed));
                this.camera.position.add(moveVec);
                this.cameraTarget.add(moveVec);
                this.camera.lookAt(this.cameraTarget);
            } else {
                // Click derecho: Órbita 3D libre alrededor de cameraTarget
                const orbitSpeed = 0.005;
                this.orbitAngles.theta -= dx * orbitSpeed;
                this.orbitAngles.phi = Math.max(0.08, Math.min(Math.PI - 0.08, this.orbitAngles.phi - dy * orbitSpeed));

                const r = this.orbitAngles.radius;
                const sinPhi = Math.sin(this.orbitAngles.phi);
                const cosPhi = Math.cos(this.orbitAngles.phi);
                const sinTheta = Math.sin(this.orbitAngles.theta);
                const cosTheta = Math.cos(this.orbitAngles.theta);

                this.camera.position.x = this.cameraTarget.x + r * sinPhi * sinTheta;
                this.camera.position.y = Math.max(0.25, this.cameraTarget.y + r * cosPhi);
                this.camera.position.z = this.cameraTarget.z + r * sinPhi * cosTheta;

                this.camera.lookAt(this.cameraTarget);
            }
        }
    }

    handleCameraZoom(deltaY) {
        const zoomFactor = deltaY > 0 ? 1.08 : 0.92;
        if (this.cameraMode === 'player') {
            // En 1ra persona: Zoom óptico / binocular (modificando FOV)
            this.camera.fov = Math.max(20, Math.min(80, this.camera.fov * (deltaY > 0 ? 1.05 : 0.95)));
            this.camera.updateProjectionMatrix();
        } else {
            // En vistas externas: Acercar o alejar el radio de la órbita
            this.orbitAngles.radius = Math.max(3.5, Math.min(95.0, this.orbitAngles.radius * zoomFactor));

            const r = this.orbitAngles.radius;
            const sinPhi = Math.sin(this.orbitAngles.phi);
            const cosPhi = Math.cos(this.orbitAngles.phi);
            const sinTheta = Math.sin(this.orbitAngles.theta);
            const cosTheta = Math.cos(this.orbitAngles.theta);

            this.camera.position.x = this.cameraTarget.x + r * sinPhi * sinTheta;
            this.camera.position.y = Math.max(0.25, this.cameraTarget.y + r * cosPhi);
            this.camera.position.z = this.cameraTarget.z + r * sinPhi * cosTheta;

            this.camera.lookAt(this.cameraTarget);
        }
    }

    resetBall() {
        this.isKicking = false;
        this.kickProgress = 0;
        this.ball.position.set(0, 0.11, 0);
        this.ball.rotation.set(0, 0, 0);

        if (this.ballShadow) {
            this.ballShadow.position.set(0, 0.006, 0);
            this.ballShadow.scale.set(1, 1, 1);
            this.ballShadow.material.opacity = 0.75;
        }

        if (this.kickerLegR) {
            this.kickerLegR.rotation.x = 0;
        }
        if (this.kickerKneeR) {
            this.kickerKneeR.rotation.x = 0;
        }
        if (this.kickerTorso) {
            this.kickerTorso.rotation.x = 0;
        }
        if (this.kickerArmL) {
            this.kickerArmL.rotation.z = 0.55;
            this.kickerArmL.rotation.x = -0.35;
        }
        if (this.kickerArmR) {
            this.kickerArmR.rotation.z = -0.45;
            this.kickerArmR.rotation.x = 0;
        }

        if (this.wallGroup) {
            this.wallGroup.position.y = 0;
        }

        // Retorno automático del golero Fernando Muslera a su posición inicial
        this.resetGoalkeeper();

        if (this.trajectoryLine) {
            this.scene.remove(this.trajectoryLine);
            this.trajectoryLine = null;
        }

        this.stopGoalCelebration();

        if (this.cameraMode === 'player') {
            this.setCameraView('player');
        }
    }

    resetGoalkeeper() {
        this.gkState = 'resetting';
        this.gkTargetX = 0;
        this.gkTargetY = 0;
        this.gkTargetRotZ = 0;
        this.gkTargetRotX = 0;
        this.gkTargetRotY = 0;
        this.gkArmTargetL = { z: 0.65, x: -0.25 };
        this.gkArmTargetR = { z: -0.65, x: -0.25 };
        this.gkLegTargetL = { z: 0 };
        this.gkLegTargetR = { z: 0 };
        if (this.gkGloveL) this.gkGloveL.position.z = 0;
        if (this.gkGloveR) this.gkGloveR.position.z = 0;
    }

    startKick(points, duration, shotEvaluation, willWallJump) {
        this.flightPoints = points;
        this.kickDuration = duration;
        this.activeShotResult = shotEvaluation;
        this.wallJumps = willWallJump;
        this.kickProgress = 0;
        this.isKicking = true;
        this.kickStartTime = performance.now();

        // Determinar estirada acrobática de Fernando Muslera evitando atravesar el balón en goles
        const zLanding = shotEvaluation.zAtGoal || 0;
        const yLanding = shotEvaluation.yAtGoal || 1.2;
        const isGoal = shotEvaluation.outcome && shotEvaluation.outcome.includes('GOAL');
        const isSaved = shotEvaluation.outcome === 'SAVED';

        this.gkState = 'dive';
        this.gkStartX = this.goalkeeper ? this.goalkeeper.position.x : 0;
        this.gkStartY = this.goalkeeper ? this.goalkeeper.position.y : 0;
        this.gkStartRotZ = this.goalkeeper ? this.goalkeeper.rotation.z : 0;
        this.gkTargetRotX = -0.22;
        this.gkTargetRotY = 0;
        this.gkArmTargetL = { z: 0.65, x: -0.25 };
        this.gkArmTargetR = { z: -0.65, x: -0.25 };
        this.gkLegTargetL = { z: 0 };
        this.gkLegTargetR = { z: 0 };

        if (isSaved) {
            // ATAJADA: Muslera se estira y sus guantes hacen contacto físico directo con el balón
            if (zLanding > 0.3) {
                // Vuelo hacia la derecha
                this.gkTargetX = zLanding - 0.70;
                this.gkTargetY = Math.max(-0.25, Math.min(yLanding - 0.60, 0.95));
                this.gkTargetRotZ = -1.25; // Inclinación horizontal atlética ~72°
                this.gkLeapHeight = Math.max(0.35, Math.min(yLanding * 0.45, 0.85));
                this.gkArmTargetL = { z: 1.85, x: -0.90 }; // Brazos extendidos al balón
                this.gkArmTargetR = { z: 2.15, x: -1.05 };
                this.gkLegTargetL = { z: -0.55 }; // Pierna de empuje extendida
                this.gkLegTargetR = { z: 0.35 };
            } else if (zLanding < -0.3) {
                // Vuelo hacia la izquierda
                this.gkTargetX = zLanding + 0.70;
                this.gkTargetY = Math.max(-0.25, Math.min(yLanding - 0.60, 0.95));
                this.gkTargetRotZ = 1.25; // Inclinación horizontal ~72°
                this.gkLeapHeight = Math.max(0.35, Math.min(yLanding * 0.45, 0.85));
                this.gkArmTargetL = { z: -2.15, x: -1.05 };
                this.gkArmTargetR = { z: -1.85, x: -0.90 };
                this.gkLegTargetL = { z: -0.35 };
                this.gkLegTargetR = { z: 0.55 };
            } else {
                // Balón centrado
                this.gkTargetX = zLanding;
                this.gkTargetY = Math.max(-0.20, Math.min(yLanding - 1.2, 0.60));
                this.gkTargetRotZ = 0;
                this.gkLeapHeight = yLanding > 1.8 ? 0.65 : 0.20;
                this.gkArmTargetL = { z: 0.20, x: -1.50 }; // Brazos arriba
                this.gkArmTargetR = { z: -0.20, x: -1.50 };
            }
        } else if (isGoal) {
            // ES GOL: Muslera se tira con todo su alcance pero NO LLEGA por 35 cm (no atraviesa el balón)
            if (zLanding > 0.3) {
                this.gkTargetX = Math.max(0, Math.min(zLanding - 1.25, 2.20));
                this.gkTargetY = Math.min(yLanding * 0.45, 0.60);
                this.gkTargetRotZ = -1.15;
                this.gkLeapHeight = 0.55;
                this.gkArmTargetL = { z: 1.75, x: -0.75 };
                this.gkArmTargetR = { z: 2.05, x: -0.85 };
                this.gkLegTargetL = { z: -0.45 };
                this.gkLegTargetR = { z: 0.25 };
            } else if (zLanding < -0.3) {
                this.gkTargetX = Math.min(0, Math.max(zLanding + 1.25, -2.20));
                this.gkTargetY = Math.min(yLanding * 0.45, 0.60);
                this.gkTargetRotZ = 1.15;
                this.gkLeapHeight = 0.55;
                this.gkArmTargetL = { z: -2.05, x: -0.85 };
                this.gkArmTargetR = { z: -1.75, x: -0.75 };
                this.gkLegTargetL = { z: -0.25 };
                this.gkLegTargetR = { z: 0.45 };
            } else {
                // Balón centrado: Muslera descolocado o se tira engañado
                this.gkTargetX = Math.random() > 0.5 ? 1.40 : -1.40;
                this.gkTargetY = -0.15;
                this.gkTargetRotZ = this.gkTargetX > 0 ? -0.85 : 0.85;
                this.gkLeapHeight = 0.25;
                this.gkArmTargetL = { z: 1.2, x: -0.5 };
                this.gkArmTargetR = { z: -1.2, x: -0.5 };
            }
        } else {
            // Tiro desviado, poste o travesaño
            this.gkTargetX = Math.min(Math.max(zLanding * 0.65, -2.3), 2.3);
            this.gkTargetY = yLanding > 1.4 ? 0.55 : -0.15;
            this.gkTargetRotZ = zLanding > 0 ? -0.85 : 0.85;
            this.gkLeapHeight = 0.40;
            this.gkArmTargetL = zLanding > 0 ? { z: 1.6, x: -0.6 } : { z: -0.5, x: -0.2 };
            this.gkArmTargetR = zLanding < 0 ? { z: -1.6, x: -0.6 } : { z: 0.5, x: -0.2 };
        }

        this.drawTrajectoryLine(points);
    }

    drawTrajectoryLine(points) {
        if (this.trajectoryLine) {
            this.scene.remove(this.trajectoryLine);
        }

        const curvePoints = points.map(p => new THREE.Vector3(p.z || 0, Math.max(0.1, p.y), -p.x));
        const geometry = new THREE.BufferGeometry().setFromPoints(curvePoints);
        const material = new THREE.LineBasicMaterial({
            color: 0x38bdf8,
            linewidth: 3,
            transparent: true,
            opacity: 0.65
        });

        this.trajectoryLine = new THREE.Line(geometry, material);
        this.scene.add(this.trajectoryLine);
    }

    animate() {
        requestAnimationFrame(this.animate);

        const now = performance.now();
        const secTime = now / 1000;

        // 1. Rotación suave de las dianas
        if (this.targetMarker && this.targetMarker.visible) {
            this.targetMarker.rotation.z += 0.02;
        }
        if (this.lowTargetMarker && this.lowTargetMarker.visible) {
            this.lowTargetMarker.rotation.z -= 0.02;
        }

        // 2. Banderas ondeantes
        if (this.flags.length > 0) {
            this.flags.forEach((f) => {
                const pos = f.geo.attributes.position;
                const waveSpeed = this.isCelebratingGoal ? 9.0 : 4.5;
                for (let i = 0; i < pos.count; i++) {
                    const vx = pos.getX(i);
                    const wave = Math.sin(vx * 2.0 + secTime * waveSpeed + f.phase) * (0.12 + Math.abs(vx) * 0.08);
                    pos.setZ(i, wave);
                }
                pos.needsUpdate = true;
            });
        }

        // 3. Hinchada animada
        if (this.spectators.length > 0) {
            const jumpMultiplier = this.isCelebratingGoal ? 1.8 : 0.25;
            const speedMultiplier = this.isCelebratingGoal ? 2.8 : 1.0;

            this.spectators.forEach((spec) => {
                const jump = Math.max(0, Math.sin(secTime * spec.speed * speedMultiplier + spec.phase));
                spec.group.position.y = spec.baseY + jump * spec.jumpHeight * jumpMultiplier;

                if (spec.armL && spec.armR) {
                    const armWave = Math.sin(secTime * 6.0 + spec.phase) * 0.35;
                    spec.armL.rotation.x = -Math.PI / 2 + armWave;
                    spec.armR.rotation.x = -Math.PI / 2 - armWave;
                }
            });
        }

        // 4. Confetti en festejo de gol
        if (this.isCelebratingGoal && this.confettiParticles.length > 0) {
            this.confettiParticles.forEach((p) => {
                if (p.mesh.visible) {
                    p.mesh.position.y -= 0.04;
                    p.mesh.position.x += p.vx;
                    p.mesh.position.z += p.vz;
                    p.mesh.rotation.x += p.rotSpeedX;
                    p.mesh.rotation.y += p.rotSpeedY;

                    if (p.mesh.position.y < 0.2) {
                        p.mesh.position.y = 8 + Math.random() * 4;
                    }
                }
            });
        }

        // 5. Animación del tiro: Carrera del pateador, vuelo del balón y estirada del arquero
        if (this.isKicking && this.flightPoints.length > 1) {
            const elapsed = (now - this.kickStartTime) / 1000;

            // Animación de patada del futbolista: golpeo con el EMPEINE hacia adelante (-Z)
            if (this.kickerLegR && elapsed <= 0.48) {
                if (elapsed < 0.16) {
                    // FASE 1: Armado hacia atrás (Backswing)
                    // En Three.js, rotación negativa en X mueve el muslo hacia +Z (hacia atrás)
                    const p = elapsed / 0.16;
                    this.kickerLegR.rotation.x = -p * 0.85; // Cadera hacia atrás
                    if (this.kickerKneeR) {
                        this.kickerKneeR.rotation.x = -p * 0.80; // Rodilla se flexiona hacia atrás
                    }
                    if (this.kickerTorso) {
                        this.kickerTorso.rotation.x = -p * 0.12; // Torso se inclina adelante
                    }
                    if (this.kickerArmL) {
                        this.kickerArmL.rotation.z = 0.55 + p * 0.35; // Brazo izq. abre para balance
                        this.kickerArmL.rotation.x = -0.35 + p * 0.40;
                    }
                    if (this.kickerArmR) {
                        this.kickerArmR.rotation.x = -p * 0.50; // Brazo der. va hacia atrás
                    }
                } else if (elapsed <= 0.36) {
                    // FASE 2: Latigazo y golpeo con el empeine hacia adelante (-Z hacia el arco)
                    const p = (elapsed - 0.16) / 0.20;
                    const pEase = Math.pow(p, 1.25);

                    // Cadera viaja desde -0.85 hasta +1.20 rad (bien adelante hacia el arco)
                    this.kickerLegR.rotation.x = -0.85 + pEase * 2.05;

                    // Extensión de la rodilla como un latigazo hacia adelante
                    if (this.kickerKneeR) {
                        if (p < 0.45) {
                            this.kickerKneeR.rotation.x = -0.80 + (p / 0.45) * 0.88;
                        } else {
                            this.kickerKneeR.rotation.x = 0.08 + Math.sin(p * Math.PI) * 0.15;
                        }
                    }
                    if (this.kickerTorso) {
                        this.kickerTorso.rotation.x = -0.12 + p * 0.20;
                    }
                    if (this.kickerArmL) {
                        this.kickerArmL.rotation.z = 0.90 - p * 0.35;
                        this.kickerArmL.rotation.x = 0.05 - p * 0.40;
                    }
                    if (this.kickerArmR) {
                        this.kickerArmR.rotation.x = -0.50 + p * 0.50;
                    }
                } else {
                    // FASE 3: Desaceleración y retorno
                    this.kickerLegR.rotation.x += (0 - this.kickerLegR.rotation.x) * 0.12;
                    if (this.kickerKneeR) {
                        this.kickerKneeR.rotation.x += (0 - this.kickerKneeR.rotation.x) * 0.12;
                    }
                    if (this.kickerTorso) {
                        this.kickerTorso.rotation.x += (0 - this.kickerTorso.rotation.x) * 0.10;
                    }
                }
            } else if (this.kickerLegR && elapsed > 0.48) {
                this.kickerLegR.rotation.x += (0 - this.kickerLegR.rotation.x) * 0.08;
                if (this.kickerKneeR) {
                    this.kickerKneeR.rotation.x += (0 - this.kickerKneeR.rotation.x) * 0.08;
                }
                if (this.kickerTorso) {
                    this.kickerTorso.rotation.x += (0 - this.kickerTorso.rotation.x) * 0.08;
                }
                if (this.kickerArmL) {
                    this.kickerArmL.rotation.z += (0.55 - this.kickerArmL.rotation.z) * 0.08;
                    this.kickerArmL.rotation.x += (-0.35 - this.kickerArmL.rotation.x) * 0.08;
                }
                if (this.kickerArmR) {
                    this.kickerArmR.rotation.x += (0 - this.kickerArmR.rotation.x) * 0.08;
                }
            }

            // Sincronización del balón: sale despedido exactamente con el impacto del botín
            const kickDelay = 0.18;
            const ballElapsed = Math.max(0, elapsed - kickDelay);
            const ballDuration = Math.max(0.1, this.kickDuration - kickDelay);
            const progress = Math.min(ballElapsed / ballDuration, 1.0);

            const index = Math.floor(progress * (this.flightPoints.length - 1));
            const currentPt = this.flightPoints[index];

            if (currentPt) {
                this.ball.position.z = -currentPt.x;
                this.ball.position.y = Math.max(0.11, currentPt.y);
                this.ball.position.x = currentPt.z || 0;

                // Sombra dinámica sobre el césped
                if (this.ballShadow) {
                    this.ballShadow.position.x = this.ball.position.x;
                    this.ballShadow.position.z = this.ball.position.z;
                    const h = currentPt.y;
                    this.ballShadow.material.opacity = Math.max(0.08, 0.70 - h * 0.18);
                    const s = Math.max(0.4, 1.0 - h * 0.12);
                    this.ballShadow.scale.set(s, s, 1);
                }

                // Rotación del balón sobre su eje al volar
                if (progress > 0) {
                    this.ball.rotation.x -= 0.32;
                    this.ball.rotation.y += 0.09;
                }

                // Salto de la barrera
                if (this.wallGroup && this.wallGroup.visible) {
                    const tWall = this.distWall / (this.flightPoints[this.flightPoints.length - 1].x / this.kickDuration);
                    if (this.wallJumps) {
                        const timeDiff = elapsed - (tWall - 0.22);
                        const jumpPeriod = 0.58;
                        if (timeDiff >= 0 && timeDiff <= jumpPeriod) {
                            const jumpNorm = timeDiff / jumpPeriod;
                            const jumpHeight = Math.sin(jumpNorm * Math.PI) * 0.58;
                            this.wallGroup.position.y = jumpHeight;
                        } else if (timeDiff > jumpPeriod) {
                            this.wallGroup.position.y = 0;
                        }
                    }
                }

                // Estirada lateral acrobática de Fernando Muslera hacia el palo con salto parabólico
                if (this.goalkeeper && progress > 0.20 && this.gkState === 'dive') {
                    const diveProg = Math.min(1.0, Math.max(0.0, (progress - 0.20) / 0.72));
                    const smoothDive = diveProg * diveProg * (3 - 2 * diveProg);
                    const leapArc = Math.sin(diveProg * Math.PI) * (this.gkLeapHeight || 0.45);

                    this.goalkeeper.position.x = this.gkStartX + (this.gkTargetX - this.gkStartX) * smoothDive;
                    this.goalkeeper.position.y = this.gkStartY + (this.gkTargetY - this.gkStartY) * smoothDive + leapArc;

                    this.goalkeeper.rotation.z = this.gkStartRotZ + (this.gkTargetRotZ - this.gkStartRotZ) * smoothDive;
                    this.goalkeeper.rotation.x = this.gkTargetRotX * smoothDive;
                    this.goalkeeper.rotation.y = (this.gkTargetRotY || 0) * smoothDive;

                    if (this.gkArmL && this.gkArmTargetL) {
                        this.gkArmL.rotation.z = this.gkArmBaseL.z + (this.gkArmTargetL.z - this.gkArmBaseL.z) * smoothDive;
                        this.gkArmL.rotation.x = this.gkArmBaseL.x + (this.gkArmTargetL.x - this.gkArmBaseL.x) * smoothDive;
                    }
                    if (this.gkArmR && this.gkArmTargetR) {
                        this.gkArmR.rotation.z = this.gkArmBaseR.z + (this.gkArmTargetR.z - this.gkArmBaseR.z) * smoothDive;
                        this.gkArmR.rotation.x = this.gkArmBaseR.x + (this.gkArmTargetR.x - this.gkArmBaseR.x) * smoothDive;
                    }

                    if (this.gkLegL && this.gkLegTargetL) {
                        this.gkLegL.rotation.z = 0 + this.gkLegTargetL.z * smoothDive;
                    }
                    if (this.gkLegR && this.gkLegTargetR) {
                        this.gkLegR.rotation.z = 0 + this.gkLegTargetR.z * smoothDive;
                    }

                    // Efecto de retroceso en los guantes al atajar
                    if (this.activeShotResult && this.activeShotResult.outcome === 'SAVED' && progress >= 0.88) {
                        const recoil = Math.sin((progress - 0.88) * 25) * 0.08;
                        if (this.gkGloveL) this.gkGloveL.position.z = recoil;
                        if (this.gkGloveR) this.gkGloveR.position.z = recoil;
                    }
                }

                // Cámara de seguimiento dinámico
                if (this.cameraMode === 'follow') {
                    this.camera.position.set(
                        this.ball.position.x * 0.6,
                        this.ball.position.y + 1.25,
                        this.ball.position.z + 3.2
                    );
                    this.camera.lookAt(this.ball.position.x, this.ball.position.y + 0.3, this.ball.position.z - 5);
                }

                // Fin del tiro
                if (progress >= 1.0) {
                    this.isKicking = false;

                    if (this.activeShotResult && this.activeShotResult.outcome.includes('GOAL')) {
                        this.triggerGoalCelebration();
                    }

                    if (this.onShotComplete) {
                        this.onShotComplete(this.activeShotResult);
                    }

                    // Programar retorno suave del arquero a su posición inicial tras la jugada
                    setTimeout(() => {
                        this.resetGoalkeeper();
                    }, 1600);
                }
            }
        }

        // Animación de retorno del arquero a su posición inicial
        if (this.gkState === 'resetting' && this.goalkeeper) {
            this.goalkeeper.position.x += (0 - this.goalkeeper.position.x) * 0.06;
            this.goalkeeper.position.y += (0 - this.goalkeeper.position.y) * 0.08;
            this.goalkeeper.rotation.z += (0 - this.goalkeeper.rotation.z) * 0.08;
            this.goalkeeper.rotation.x += (0 - this.goalkeeper.rotation.x) * 0.08;
            this.goalkeeper.rotation.y += (0 - this.goalkeeper.rotation.y) * 0.08;

            if (this.gkArmL) {
                this.gkArmL.rotation.z += (this.gkArmBaseL.z - this.gkArmL.rotation.z) * 0.08;
                this.gkArmL.rotation.x += (this.gkArmBaseL.x - this.gkArmL.rotation.x) * 0.08;
            }
            if (this.gkArmR) {
                this.gkArmR.rotation.z += (this.gkArmBaseR.z - this.gkArmR.rotation.z) * 0.08;
                this.gkArmR.rotation.x += (this.gkArmBaseR.x - this.gkArmR.rotation.x) * 0.08;
            }
            if (this.gkLegL) {
                this.gkLegL.rotation.z += (0 - this.gkLegL.rotation.z) * 0.08;
            }
            if (this.gkLegR) {
                this.gkLegR.rotation.z += (0 - this.gkLegR.rotation.z) * 0.08;
            }
            if (this.gkGloveL) {
                this.gkGloveL.position.z += (0 - this.gkGloveL.position.z) * 0.10;
            }
            if (this.gkGloveR) {
                this.gkGloveR.position.z += (0 - this.gkGloveR.position.z) * 0.10;
            }

            if (Math.abs(this.goalkeeper.position.x) < 0.02 && Math.abs(this.goalkeeper.rotation.z) < 0.02) {
                this.goalkeeper.position.x = 0;
                this.goalkeeper.position.y = 0;
                this.goalkeeper.rotation.z = 0;
                this.goalkeeper.rotation.x = 0;
                this.goalkeeper.rotation.y = 0;
                this.gkState = 'ready';
            }
        }

        this.renderer.render(this.scene, this.camera);
    }

    onResize() {
        if (!this.container || !this.renderer || !this.camera) return;
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);

        if (this.cameraMode === 'side') {
            this.setCameraView('side');
        }
    }
}
