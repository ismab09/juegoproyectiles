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
        this.webglAvailable = this.checkWebGLSupport();

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
        this.trajectoryLine = null;
        this.sprayLines = [];
        this.goalkeeperHitboxes = [];
        this.previousBallPosition = new THREE.Vector3();
        this.goalkeeperRebound = null;
        this.shotSamples = [];

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
        this.goalZ = -35;     // Línea de fondo fija del estadio
        this.shotZ = this.goalZ + this.distGoal;
        this.distWall = 9.15; // Distancia reglamentaria de barrera
        this.wallLateralOffset = 0; // Desplazamiento táctico lateral de la barrera
        this.isKicking = false;
        this.kickProgress = 0;
        this.kickDuration = 1.0;
        this.flightPoints = [];
        this.cameraMode = 'player'; // 'player', 'follow', 'side', 'goal'
        this.targetMode = 'top_corner';

        // Control de cámara libre con click derecho en todas las vistas
        this.isRightDragging = false;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.cameraTarget = new THREE.Vector3(0, 1.25, this.goalZ);
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
        this.shotCompleted = true;

        this.init();
        this.container.__scene = this;
        window.__scene = this;
    }

    checkWebGLSupport() {
        if (!window.WebGLRenderingContext) return false;

        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            return !!gl;
        } catch (error) {
            return false;
        }
    }

    showWebGLFallback() {
        if (!this.container) return;

        this.container.innerHTML = `
            <div class="webgl-warning">
                <strong>WebGL no disponible</strong>
                <span>El navegador actual no puede abrir la escena 3D. Prueba en un navegador con aceleración gráfica.</span>
            </div>
        `;
    }

    init() {
        if (!this.webglAvailable) {
            this.showWebGLFallback();
            return;
        }

        const width = this.container.clientWidth;
        const height = this.container.clientHeight;

        // 1. Escena 3D
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x061121);
        this.scene.fog = new THREE.FogExp2(0x061121, 0.014);

        // 2. Cámara
        this.camera = new THREE.PerspectiveCamera(54, width / height, 0.05, 500);
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
        this.scene.background = new THREE.Color(0x101e32);
        this.scene.fog = new THREE.FogExp2(0x101e32, 0.004);
        this.scene.add(new THREE.AmbientLight(0xffffff, 0.54));
        this.scene.add(new THREE.HemisphereLight(0xdceeff, 0x255b32, 0.72));
        const sun = new THREE.DirectionalLight(0xfff4dc, 0.9);
        sun.position.set(-22, 38, 18);
        sun.castShadow = true;
        sun.shadow.mapSize.set(2048, 2048);
        Object.assign(sun.shadow.camera, { left: -42, right: 42, top: 42, bottom: -42, far: 120 });
        this.scene.add(sun);
        for (const x of [-48, 48]) for (const z of [-56, 36]) {
            const light = new THREE.SpotLight(0xe7f1ff, 1.8, 130, 0.66, 0.65);
            light.position.set(x, 28, z);
            light.target.position.set(0, 0, -12);
            this.scene.add(light, light.target);
        }
    }

    createPitch() {
        // World coordinates: ball (0, 0, 0), attack toward -Z; stadium stays fixed.
        // The selected goal and its penalty markings are the only moving pitch objects.
        const canvas = document.createElement('canvas');
        canvas.width = 512; canvas.height = 1024;
        const ctx = canvas.getContext('2d');
        for (let i = 0; i < 10; i++) {
            ctx.fillStyle = i % 2 ? '#287a40' : '#2b8144';
            ctx.fillRect(0, i * 102.4, 512, 103);
        }
        let seed = 413;
        const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
        for (let i = 0; i < 11000; i++) {
            ctx.fillStyle = random() > 0.5 ? 'rgba(255,255,255,.035)' : 'rgba(0,0,0,.035)';
            ctx.fillRect(random() * 512, random() * 1024, 1, 3);
        }
        const grass = new THREE.CanvasTexture(canvas);
        grass.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
        this.pitch = new THREE.Mesh(new THREE.PlaneGeometry(64, 82), new THREE.MeshStandardMaterial({ map: grass, roughness: 1 }));
        this.pitch.rotation.x = -Math.PI / 2;
        this.pitch.position.set(0, 0, 1);
        this.pitch.receiveShadow = true;
        this.scene.add(this.pitch);
        const apron = new THREE.Mesh(new THREE.PlaneGeometry(76, 94), new THREE.MeshStandardMaterial({ color: 0x264b38, roughness: 1 }));
        apron.rotation.x = -Math.PI / 2; apron.position.set(0, -0.025, 1);
        this.scene.add(apron);
        this.createPitchLines();
    }

    createPitchLines() {
        const white = new THREE.MeshBasicMaterial({ color: 0xf4f5e9, side: THREE.DoubleSide });
        const put = (group, x1, z1, x2, z2, width = 0.11) => {
            const dx = x2 - x1, dz = z2 - z1;
            const m = new THREE.Mesh(new THREE.PlaneGeometry(Math.hypot(dx, dz), width), white);
            m.rotation.set(-Math.PI / 2, 0, -Math.atan2(dz, dx));
            m.position.set((x1 + x2) / 2, 0.018, (z1 + z2) / 2);
            group.add(m);
        };
        const fixed = new THREE.Group();
        // Stable outer field, opposite penalty area, halfway line and circle.
        for (const [a,b,c,d] of [[32,this.goalZ,32,42],[32,42,-32,42],[-32,42,-32,this.goalZ],[-32,1,32,1]]) put(fixed,a,b,c,d);
        const circle = new THREE.Mesh(new THREE.RingGeometry(9.10,9.21,96),white);
        circle.rotation.x = -Math.PI/2; circle.position.set(0,0.018,1); fixed.add(circle);
        this.scene.add(fixed);
        this.goalLinesGroup = new THREE.Group();
        const box = (w,d) => {
            put(this.goalLinesGroup,-w/2,0,-w/2,d);
            put(this.goalLinesGroup,-w/2,d,w/2,d);
            put(this.goalLinesGroup,w/2,d,w/2,0);
        };
        put(this.goalLinesGroup,-32,0,32,0);
        box(18.32,5.5); box(40.32,16.5);
        const dot = new THREE.Mesh(new THREE.CircleGeometry(.16,24),white);
        dot.rotation.x=-Math.PI/2; dot.position.set(0,.02,11); this.goalLinesGroup.add(dot);
        const arcPoints=[];
        for(let i=0;i<=48;i++) {
            const a=Math.acos((16.5-11)/9.15)+i*(Math.PI-2*Math.acos((16.5-11)/9.15))/48;
            arcPoints.push(new THREE.Vector3(Math.cos(a)*9.15,.025,11+Math.sin(a)*9.15));
        }
        this.goalLinesGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(arcPoints),new THREE.LineBasicMaterial({color:0xffffff})));
        this.goalLinesGroup.position.z=this.goalZ;
        this.scene.add(this.goalLinesGroup);
        const spray = new THREE.Mesh(new THREE.PlaneGeometry(3.4,.09),white);
        spray.rotation.x=-Math.PI/2; spray.position.set(0,.025,this.shotZ-this.distWall);
        this.scene.add(spray); this.sprayLines.push(spray);
        this.ballSpray = new THREE.Mesh(new THREE.RingGeometry(.24,.31,32),white);
        this.ballSpray.rotation.x=-Math.PI/2;
        this.ballSpray.position.set(0,.026,this.shotZ);
        this.scene.add(this.ballSpray);
    }

    createGoal() {
        this.goalGroup = new THREE.Group();
        const frame = new THREE.MeshStandardMaterial({color:0xfafcff,metalness:.55,roughness:.24});
        const beam=(a,b,r=.055)=>{
            const d=new THREE.Vector3().subVectors(b,a);
            const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,d.length(),12),frame);
            mesh.position.copy(a).add(b).multiplyScalar(.5);
            mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());
            mesh.castShadow=true; this.goalGroup.add(mesh);
        };
        const v=(x,y,z)=>new THREE.Vector3(x,y,z);
        for(const x of [-3.66,3.66]) {
            beam(v(x,0,0),v(x,2.44,0),.065);
            beam(v(x,2.44,0),v(x,2.26,-2.1),.035);
            beam(v(x,2.26,-2.1),v(x,0,-2.1),.03);
            beam(v(x,0,0),v(x,0,-2.1),.025);
        }
        beam(v(-3.66,2.44,0),v(3.66,2.44,0),.065);
        beam(v(-3.66,2.26,-2.1),v(3.66,2.26,-2.1),.035);
        beam(v(-3.66,0,-2.1),v(3.66,0,-2.1),.025);
        const net=[];
        const segment=(a,b)=>net.push(...a,...b);
        for(let x=-3.66;x<=3.67;x+=.305) {
            segment([x,0,-2.1],[x,2.26,-2.1]);
            segment([x,2.44,0],[x,2.26,-2.1]);
        }
        for(let y=0;y<=2.27;y+=.305) segment([-3.66,y,-2.1],[3.66,y,-2.1]);
        for(let z=0;z>=-2.11;z-=.3) {
            const top=2.44+z*.18/2.1;
            segment([-3.66,top,z],[3.66,top,z]);
            for(const x of [-3.66,3.66]) segment([x,0,z],[x,top,z]);
        }
        for(let y=.305;y<2.3;y+=.305) for(const x of [-3.66,3.66]) segment([x,y,0],[x,y,-2.1]);
        const geometry=new THREE.BufferGeometry(); geometry.setAttribute('position',new THREE.Float32BufferAttribute(net,3));
        this.goalGroup.add(new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:0xe9f1f3,transparent:true,opacity:.48,depthWrite:false})));
        this.goalGroup.position.z=this.goalZ;
        this.scene.add(this.goalGroup);
    }

    createRetroStands() {
        this.standsGroup=new THREE.Group();
        this.scene.add(this.standsGroup);
        this.spectators=[]; this.flags=[]; this.retroAdBoards=[];
        const concrete=new THREE.MeshStandardMaterial({color:0x526174,roughness:1,side:THREE.DoubleSide});
        const riser=new THREE.MeshStandardMaterial({color:0x293b51,roughness:1,side:THREE.DoubleSide});
        const roofMat=new THREE.MeshStandardMaterial({color:0x263649,metalness:.35,roughness:.72,side:THREE.DoubleSide});
        const trim=new THREE.MeshStandardMaterial({color:0x8da6b4,metalness:.4,roughness:.55});
        const corners=[[-43,-44],[43,-44],[43,40],[-43,40]];
        const tier=(side,level)=>{
            const end=side==='north'||side==='south';
            const sign=side==='north'?-1:side==='south'?1:side==='west'?-1:1;
            const first=end?(side==='north'?-48:48):sign*42;
            const length=end?88:98;
            const start=end?-44:-50;
            const rows=level===0?10:8;
            const origin=level===0?1.4:9.5;
            const run=level===0?1.18:1.4;
            const rise=level===0?.65:.78;
            for(let row=0;row<rows;row++) {
                const near=first+sign*(row*run+(level===0?0:3));
                const far=near+sign*run;
                const y=origin+row*rise;
                const a=end?[start,near]:[near,start];
                const b=end?[start+length,near]:[near,start+length];
                const c=end?[start+length,far]:[far,start+length];
                const d=end?[start,far]:[far,start];
                const floor=new THREE.BufferGeometry();
                floor.setAttribute('position',new THREE.Float32BufferAttribute([a[0],y,a[1],b[0],y,b[1],c[0],y,c[1],a[0],y,a[1],c[0],y,c[1],d[0],y,d[1]],3));
                floor.computeVertexNormals(); this.standsGroup.add(new THREE.Mesh(floor,concrete));
                const edge=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(a[0],y,a[1]),new THREE.Vector3(b[0],y,b[1])]);
                this.standsGroup.add(new THREE.Line(edge,new THREE.LineBasicMaterial({color:0xa7b4c3})));
                this.addCrowdRow(end,side,near,y+.42,start,length,row+level*10);
            }
            // Narrow roof strip over the rear rows; open central pitch.
            const outer=first+sign*(rows*run+7);
            const inner=first+sign*(rows*run-5);
            const roof=new THREE.Mesh(new THREE.PlaneGeometry(end?length:Math.abs(outer-inner),end?Math.abs(outer-inner):length),roofMat);
            roof.rotation.x=-Math.PI/2;
            roof.position.set(end?0:(outer+inner)/2,21,end?(outer+inner)/2:-12);
            this.standsGroup.add(roof);
            const support=new THREE.Mesh(new THREE.CylinderGeometry(.08,.08,end?length:length,8),trim);
            if(end) support.rotation.z=Math.PI/2;
            else support.rotation.x=Math.PI/2;
            support.position.set(end?0:outer,20.8,end?outer:-12);
            this.standsGroup.add(support);
        };
        for(const side of ['north','south','west','east']) { tier(side,0); tier(side,1); }
        // Corner wedges join the four stands without closing the view with walls.
        for(const [x,z] of corners) {
            for(let row=0;row<10;row++) {
                const y=1.4+row*.65, dx=Math.sign(x)*(row*1.15), dz=Math.sign(z+12)*(row*1.15);
                const pts=[x+dx,z,x,z+dz,x+dx+Math.sign(x)*1.1,z,x,z+dz+Math.sign(z+12)*1.1];
                const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute([pts[0],y,pts[1],pts[2],y,pts[3],pts[4],y+.4,pts[5],pts[2],y,pts[3],pts[4],y+.4,pts[5],pts[6],y+.4,pts[7]],3));
                g.computeVertexNormals(); this.standsGroup.add(new THREE.Mesh(g,concrete));
            }
        }
        this.createRetroAdBoards();
        this.createConfettiSystem();
        for(const x of [-45,45]) for(const z of [-45,40]) this.createFloodlightTower(x,z,0,-12);
        this.createExteriorFacade();
    }

    createExteriorFacade() {
        const facade = new THREE.Group();
        facade.name = 'Exterior facade';
        this.exteriorFacadeGroup = facade;
        this.scene.add(facade);

        const panels = [0x394451, 0x46525e, 0x303d4a].map(color =>
            new THREE.MeshStandardMaterial({ color, metalness: 0.55, roughness: 0.53, side: THREE.DoubleSide })
        );
        const ribs = new THREE.LineBasicMaterial({ color: 0x8394a1, transparent: true, opacity: 0.62 });
        const roofMaterial = new THREE.MeshStandardMaterial({
            color: 0x293947, metalness: 0.62, roughness: 0.44, side: THREE.DoubleSide
        });

        // Chamfered outline: the upper edge meets the canopy. The lower edge
        // leans outward, always away from the seats and the playing surface.
        const outline = [
            [-55, -69], [55, -69], [63, -61], [63, 61],
            [55, 69], [-55, 69], [-63, 61], [-63, -61]
        ];
        const lower = ([x, z]) => [x + Math.sign(x) * (Math.abs(x) > 55 ? 3.2 : 0),
            z + Math.sign(z) * (Math.abs(z) > 61 ? 3.2 : 0)];
        const quad = (a, b, c, d, material) => {
            const g = new THREE.BufferGeometry();
            g.setAttribute('position', new THREE.Float32BufferAttribute([
                ...a, ...b, ...c, ...a, ...c, ...d
            ], 3));
            g.computeVertexNormals();
            const mesh = new THREE.Mesh(g, material);
            facade.add(mesh);
            return mesh;
        };
        const seamPoints = [];
        outline.forEach((a, side) => {
            const b = outline[(side + 1) % outline.length];
            const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
            const count = Math.ceil(length / 5);
            for (let i = 0; i < count; i++) {
                const t0 = i / count, t1 = (i + 1) / count;
                const p = [a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0];
                const q = [a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1];
                const p0 = lower(p), q0 = lower(q);
                quad([p0[0], 0, p0[1]], [q0[0], 0, q0[1]],
                    [q[0], 21, q[1]], [p[0], 21, p[1]], panels[(side + i) % panels.length]);
                seamPoints.push(p0[0], 0, p0[1], p[0], 21, p[1]);
                for (const y of [6, 14, 20.7]) {
                    const f = y / 21;
                    seamPoints.push(
                        p0[0] + (p[0] - p0[0]) * f, y, p0[1] + (p[1] - p0[1]) * f,
                        q0[0] + (q[0] - q0[0]) * f, y, q0[1] + (q[1] - q0[1]) * f
                    );
                }
            }
        });
        const seams = new THREE.BufferGeometry();
        seams.setAttribute('position', new THREE.Float32BufferAttribute(seamPoints, 3));
        facade.add(new THREE.LineSegments(seams, ribs));

        // Short roof links and corner caps close the silhouette without
        // extending over the pitch or changing the existing stand geometry.
        quad([-55, 21, -69], [55, 21, -69], [55, 21, -66], [-55, 21, -66], roofMaterial);
        quad([-55, 21, 66], [55, 21, 66], [55, 21, 69], [-55, 21, 69], roofMaterial);
        quad([60, 21, -61], [63, 21, -61], [63, 21, 61], [60, 21, 61], roofMaterial);
        quad([-63, 21, -61], [-60, 21, -61], [-60, 21, 61], [-63, 21, 61], roofMaterial);
        for (const signX of [-1, 1]) for (const north of [true, false]) {
            const minX = signX < 0 ? -63 : 44, maxX = signX < 0 ? -44 : 63;
            const minZ = north ? -69 : 37, maxZ = north ? -50 : 69;
            quad([minX, 21.04, minZ], [maxX, 21.04, minZ],
                [maxX, 21.04, maxZ], [minX, 21.04, maxZ], roofMaterial);
        }
    }

    addCrowdRow(end,side,near,y,start,length,row) {
        const palette=[0xd9e4ec,0x58a5ce,0x183b68,0xe5c450,0xc24843,0x2d714f,0x9aa4ab];
        const count=Math.floor(length/.65);
        const bodies=new THREE.InstancedMesh(new THREE.SphereGeometry(.24,6,5),new THREE.MeshLambertMaterial({color:0xffffff}),count);
        const heads=new THREE.InstancedMesh(new THREE.SphereGeometry(.13,6,5),new THREE.MeshLambertMaterial({color:0xd0ae8b}),count);
        // Three r128 culls instanced meshes using the source geometry's bounds,
        // which do not enclose spectators translated to distant stands.
        bodies.frustumCulled=false;
        heads.frustumCulled=false;
        const dummy=new THREE.Object3D();
        for(let i=0;i<count;i++) {
            const t=start+.38+i*.65;
            dummy.position.set(end?t:near,y,end?near:t);
            dummy.scale.set(1,.9,1); dummy.updateMatrix(); bodies.setMatrixAt(i,dummy.matrix);
            bodies.setColorAt(i,new THREE.Color(palette[(i*13+row*7+Math.floor(i/11))%palette.length]));
            dummy.position.y=y+.32; dummy.scale.set(1,1,1); dummy.updateMatrix(); heads.setMatrixAt(i,dummy.matrix);
        }
        this.standsGroup.add(bodies,heads);
    }

    createFloodlightTower(x,z) {
        const metal=new THREE.MeshStandardMaterial({color:0x7892a4,metalness:.5,roughness:.5});
        const pole=new THREE.Mesh(new THREE.CylinderGeometry(.16,.24,27,10),metal);
        pole.position.set(x,13.5,z); this.standsGroup.add(pole);
        const panel=new THREE.Mesh(new THREE.PlaneGeometry(4,1.4),new THREE.MeshBasicMaterial({color:0xf8f7db,side:THREE.DoubleSide}));
        panel.position.set(x,27,z); panel.lookAt(0,4,-12); this.standsGroup.add(panel);
    }

    createRetroAdBoards() {
        const labels=['NOVA SPORT','AURORA','PULSO','FUTURA'];
        const board=(x,z,w,rotation,label)=>{
            const canvas=document.createElement('canvas'); canvas.width=512;canvas.height=96;
            const ctx=canvas.getContext('2d'); ctx.fillStyle='#10233b';ctx.fillRect(0,0,512,96);
            ctx.fillStyle='#7fd4f1';ctx.font='bold 40px Arial';ctx.textAlign='center';ctx.fillText(label,256,62);
            const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,1.05),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(canvas),side:THREE.DoubleSide}));
            mesh.position.set(x,.75,z);mesh.rotation.y=rotation;this.standsGroup.add(mesh);
            this.retroAdBoards.push({mesh,canvas,ctx,text:label});
        };
        for(let i=0;i<4;i++) { board(-30+i*20,-41,19,0,labels[i]);board(-30+i*20,45,19,0,labels[(i+2)%4]); }
        for(let i=0;i<5;i++) {board(-39,-38+i*19,18,Math.PI/2,labels[i%4]);board(39,-38+i*19,18,Math.PI/2,labels[(i+1)%4]);}
    }

    createConfettiSystem() {
        this.confettiGroup=new THREE.Group();this.standsGroup.add(this.confettiGroup);
        this.confettiParticles=[];
        for(let i=0;i<70;i++) {
            const mesh=new THREE.Mesh(new THREE.PlaneGeometry(.2,.2),new THREE.MeshBasicMaterial({color:[0xffffff,0x59bdec,0xf0cd61][i%3],side:THREE.DoubleSide}));
            mesh.position.set((Math.random()-.5)*26,3+Math.random()*8,this.goalZ-3);
            mesh.visible=false;this.confettiGroup.add(mesh);
            this.confettiParticles.push({mesh,vx:(Math.random()-.5)*.08,vz:(Math.random()-.5)*.08,rotSpeedX:.04,rotSpeedY:.05});
        }
    }

    triggerGoalCelebration() { this.isCelebratingGoal=true;this.celebrationStartTime=performance.now();this.confettiParticles.forEach(p=>p.mesh.visible=true); }
    stopGoalCelebration() { this.isCelebratingGoal=false;this.confettiParticles.forEach(p=>p.mesh.visible=false); }

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

        this.wallGroup.position.set(0, 0, this.shotZ-this.distWall);
        this.scene.add(this.wallGroup);
    }

    // Ajuste táctico de la barrera según la dirección lateral del tiro
    setWallLateralAim(lateralAngleDeg) {
        const safeAngle = Number.isFinite(lateralAngleDeg) ? lateralAngleDeg : 0;
        const rad = (safeAngle * Math.PI) / 180;
        const offset = Number.isFinite(Math.tan(rad) * this.distWall * 0.72) ? Math.tan(rad) * this.distWall * 0.72 : 0;
        this.wallLateralOffset = offset;

        if (this.wallGroup) {
            this.wallGroup.position.x = offset;
        }
        if (this.sprayLines.length > 0) {
            this.sprayLines.forEach((spray) => {
                if (spray) spray.position.x = offset;
            });
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
        this.goalkeeper.name = 'goalkeeperRoot';
        const kit = new THREE.MeshStandardMaterial({ color: 0x38a7d1, roughness: 0.72 });
        const trim = new THREE.MeshStandardMaterial({ color: 0x18354e, roughness: 0.76 });
        const shorts = new THREE.MeshStandardMaterial({ color: 0x101820, roughness: 0.82 });
        const skin = new THREE.MeshStandardMaterial({ color: 0xc99068, roughness: 0.9 });
        const gloves = new THREE.MeshStandardMaterial({ color: 0xd8f1ff, roughness: 0.55 });
        const boots = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.7 });
        const segment = (joint, length, top, bottom, material) => {
            const mesh = new THREE.Mesh(new THREE.CylinderGeometry(bottom, top, length, 14), material);
            mesh.position.y = -length / 2; mesh.castShadow = true; joint.add(mesh); return mesh;
        };
        this.gkPelvis = new THREE.Group(); this.gkPelvis.position.y = 1.02; this.goalkeeper.add(this.gkPelvis);
        const pelvisMesh = new THREE.Mesh(new THREE.CylinderGeometry(.22, .25, .25, 14), shorts); pelvisMesh.scale.z=.72; this.gkPelvis.add(pelvisMesh);
        const leg = (side) => {
            const thigh = new THREE.Group(); thigh.position.set(side*.17,-.08,0); segment(thigh,.47,.105,.085,shorts);
            const knee = new THREE.Group(); knee.position.y=-.47; segment(knee,.48,.082,.065,trim); thigh.add(knee);
            const foot = new THREE.Group(); foot.position.y=-.48; const shoe=new THREE.Mesh(new THREE.SphereGeometry(.1,12,8),boots); shoe.scale.set(.78,.55,1.65); shoe.position.z=-.08; foot.add(shoe); knee.add(foot);
            this.gkPelvis.add(thigh); return {thigh,knee,foot};
        };
        const leftLeg=leg(-1), rightLeg=leg(1);
        this.gkLegL=leftLeg.thigh; this.gkKneeL=leftLeg.knee; this.gkFootL=leftLeg.foot;
        this.gkLegR=rightLeg.thigh; this.gkKneeR=rightLeg.knee; this.gkFootR=rightLeg.foot;
        this.gkTorso=new THREE.Group(); this.gkTorso.position.y=1.00; this.goalkeeper.add(this.gkTorso);
        const torsoMesh=new THREE.Mesh(new THREE.CylinderGeometry(.285,.215,.58,18),kit); torsoMesh.position.y=.29; torsoMesh.scale.z=.72; torsoMesh.castShadow=true; this.gkTorso.add(torsoMesh);
        const head=new THREE.Group(); head.position.y=.73; const face=new THREE.Mesh(new THREE.SphereGeometry(.135,18,16),skin); face.scale.y=1.12; head.add(face); this.gkTorso.add(head); this.gkHead=head;
        const arm=(side)=>{
            const upper=new THREE.Group(); upper.position.set(side*.30,.51,0); segment(upper,.31,.07,.06,kit);
            const fore=new THREE.Group(); fore.position.y=-.31; segment(fore,.31,.06,.052,skin); upper.add(fore);
            const glove=new THREE.Group(); glove.position.y=-.32; const palm=new THREE.Mesh(new THREE.SphereGeometry(.105,12,10),gloves); palm.scale.set(.9,1.15,.48); glove.add(palm); fore.add(glove);
            this.gkTorso.add(upper); return {upper,fore,glove};
        };
        const leftArm=arm(-1), rightArm=arm(1);
        this.gkArmL=leftArm.upper; this.gkForearmL=leftArm.fore; this.gkGloveL=leftArm.glove;
        this.gkArmR=rightArm.upper; this.gkForearmR=rightArm.fore; this.gkGloveR=rightArm.glove;
        this.gkArmBaseL={z:.55,x:-.10}; this.gkArmBaseR={z:-.55,x:-.10};
        this.goalkeeper.position.set(0,0,this.goalZ+.35); this.scene.add(this.goalkeeper);
        this.setGoalkeeperNeutralPose();
        this.createGoalkeeperHitboxes();
    }

    setGoalkeeperNeutralPose() {
        if (!this.goalkeeper) return;
        this.restoreGoalkeeperLimbs();
        this.goalkeeper.position.set(0,0,this.goalZ+.35); this.goalkeeper.rotation.set(0,0,0);
        this.gkPelvis.position.set(0,1.02,0); this.gkPelvis.rotation.set(.08,0,0);
        this.gkTorso.position.set(0,1.00,0); this.gkTorso.rotation.set(.13,0,0);
        this.gkLegL.rotation.set(-.10,0,.10); this.gkLegR.rotation.set(-.10,0,-.10);
        this.gkKneeL.rotation.set(.22,0,0); this.gkKneeR.rotation.set(.22,0,0);
        this.gkArmL.rotation.set(-.10,0,.55); this.gkArmR.rotation.set(-.10,0,-.55);
        this.gkForearmL.rotation.set(0,0,-.20); this.gkForearmR.rotation.set(0,0,.20);
        this.gkGloveL.rotation.set(0,0,0); this.gkGloveR.rotation.set(0,0,0);
        this.gkGloveL.position.set(0,-.32,0); this.gkGloveR.position.set(0,-.32,0);
    }

    restoreGoalkeeperLimbs() {
        const limbs = [
            this.gkArmL, this.gkForearmL, this.gkGloveL,
            this.gkArmR, this.gkForearmR, this.gkGloveR,
            this.gkLegL, this.gkKneeL, this.gkFootL,
            this.gkLegR, this.gkKneeR, this.gkFootR,
            this.gkPelvis, this.gkTorso, this.gkHead
        ];
        limbs.forEach((limb) => {
            if (!limb) return;
            limb.visible = true;
            if (Math.abs(limb.scale.x) < 0.001 || Math.abs(limb.scale.y) < 0.001 || Math.abs(limb.scale.z) < 0.001) {
                limb.scale.set(1, 1, 1);
            }
            limb.traverse(child => { child.visible = true; });
        });
    }

    evaluateGoalkeeperReach(predictedX, predictedY, arrivalTime) {
        const lateral=Math.abs(predictedX), time=Math.max(.2,arrivalTime||1);
        const reaction=.20, moveTime=Math.max(0,time-reaction);
        const bodyReach=THREE.MathUtils.clamp(moveTime*1.65,.18,1.65);
        const armReach=.67, availableReach=bodyReach+armReach+.14;
        const verticalReach=1.90+THREE.MathUtils.clamp(moveTime*.48,.08,.52);
        const normalized=Math.pow(lateral/availableReach,2)+Math.pow(Math.max(0,predictedY-1.25)/Math.max(.4,verticalReach-1.25),2);
        let kind='STAND_SAVE';
        if(lateral>.42){ const side=predictedX>0?'RIGHT':'LEFT'; kind=(predictedY<.75?'LOW_DIVE_':predictedY<1.9?'MID_DIVE_':'HIGH_DIVE_')+side; }
        return {reachable:lateral<=2.8&&predictedY<=2.5&&normalized<=1.12,saveType:kind,requiredReach:lateral,availableReach,bodyReach,predictedX,predictedY,arrivalTime:time};
    }

    planGoalkeeperSave(result) {
        const x=result?.zAtGoal||0,y=result?.yAtGoal||1.2,t=result?.tGoal||this.kickDuration||1;
        const plan=this.evaluateGoalkeeperReach(x,y,t);
        if(result?.outcome==='POST'||result?.outcome==='CROSSBAR'||result?.outcome==='MISS'||result?.outcome?.startsWith('WALL_HIT')) plan.reachable=false;
        this.gkPlan=plan; this.gkState='reacting'; return plan;
    }

    applyGoalkeeperPose(progress) {
        const p=this.gkPlan; if(!p||!this.goalkeeper)return;
        this.restoreGoalkeeperLimbs();
        const e=progress*progress*(3-2*progress), side=Math.sign(p.predictedX)||1;
        const stand=p.saveType==='STAND_SAVE', low=p.saveType.startsWith('LOW'), high=p.saveType.startsWith('HIGH');
        const bodyX=stand?p.predictedX*.35:side*Math.min(p.bodyReach,Math.max(.25,Math.abs(p.predictedX)-.55));
        const lift=stand?Math.max(-.16,Math.min(.18,p.predictedY-1.25)):(low?-.22:high?Math.min(.58,p.predictedY-1.7):.12);
        this.goalkeeper.position.x=bodyX*e; this.goalkeeper.position.y=lift*e;
        this.gkPelvis.position.y=1.02+(low?-.18:high?.16:0)*e; this.gkPelvis.rotation.x=.08+(low?.28:-.05)*e;
        this.gkTorso.rotation.z=(-side*(stand?.08:low?.38:high?.48:.34))*e; this.gkTorso.rotation.x=.13+(low?.20:high?-.10:.02)*e;
        this.gkLegL.rotation.z=.10+(side>0?-.22:.45)*e; this.gkLegR.rotation.z=-.10+(side>0?-.45:.22)*e;
        this.gkKneeL.rotation.x=.22+(low?.50:.12)*e; this.gkKneeR.rotation.x=.22+(low?.50:.12)*e;
        const primary=side>0?this.gkArmR:this.gkArmL, secondary=side>0?this.gkArmL:this.gkArmR;
        const primaryFore=side>0?this.gkForearmR:this.gkForearmL, secondaryFore=side>0?this.gkForearmL:this.gkForearmR;
        const shoulderX=bodyX+side*.30, shoulderY=.96+.51+lift;
        const dx=p.predictedX-shoulderX,dy=p.predictedY-shoulderY;
        const aim=THREE.MathUtils.clamp(Math.atan2(dx,-dy),-1.62,1.62);
        primary.rotation.z=THREE.MathUtils.lerp(side>0?-.55:.55,aim,e); primary.rotation.x=THREE.MathUtils.lerp(-.10,-.28,e);
        primaryFore.rotation.z=THREE.MathUtils.lerp(side>0?.20:-.20,0,e);
        secondary.rotation.z=THREE.MathUtils.lerp(side>0?.55:-.55,aim*.72,e); secondaryFore.rotation.z=THREE.MathUtils.lerp(side>0?-.20:.20,0,e);
    }

    createGoalkeeperHitboxes() {
        const addSphere = (parent, position, radius, name) => {
            const anchor = new THREE.Object3D();
            anchor.position.copy(position);
            parent.add(anchor);
            this.goalkeeperHitboxes.push({ anchor, radius, name, center: new THREE.Vector3() });
        };
        // Orden de prioridad: primero las partes que realmente realizan la atajada.
        addSphere(this.gkGloveL, new THREE.Vector3(), 0.14, 'guante izquierdo');
        addSphere(this.gkGloveR, new THREE.Vector3(), 0.14, 'guante derecho');
        addSphere(this.gkArmL, new THREE.Vector3(0, -0.27, 0), 0.10, 'brazo izquierdo');
        addSphere(this.gkArmR, new THREE.Vector3(0, -0.27, 0), 0.10, 'brazo derecho');
        addSphere(this.goalkeeper, new THREE.Vector3(0, 2.12, 0.02), 0.15, 'cabeza');
        addSphere(this.goalkeeper, new THREE.Vector3(0, 1.52, 0.03), 0.24, 'torso');
        addSphere(this.gkLegL, new THREE.Vector3(0, -0.45, 0), 0.13, 'pierna izquierda');
        addSphere(this.gkLegR, new THREE.Vector3(0, -0.45, 0), 0.13, 'pierna derecha');
    }

    checkGoalkeeperCollision(ballPosition, ballRadius = 0.11) {
        if (!this.goalkeeper || !this.goalkeeperHitboxes.length) return null;
        if (Math.abs(ballPosition.z - this.goalZ) >= 1.2) return null;
        // Límite humano aproximado: fuera de este volumen el arquero no llega.
        if (Math.abs(ballPosition.x) > 2.75 || ballPosition.y > 2.50) return null;
        this.goalkeeper.updateMatrixWorld(true);
        const start = this.previousBallPosition || ballPosition;
        const segment = ballPosition.clone().sub(start);
        const lengthSq = segment.lengthSq();
        for (const hitbox of this.goalkeeperHitboxes) {
            hitbox.anchor.getWorldPosition(hitbox.center);
            const t = lengthSq > 0 ? THREE.MathUtils.clamp(hitbox.center.clone().sub(start).dot(segment) / lengthSq, 0, 1) : 0;
            const closest = start.clone().addScaledVector(segment, t);
            if (closest.distanceToSquared(hitbox.center) <= Math.pow(hitbox.radius + ballRadius, 2)) {
                // El torso solo bloquea remates que realmente pasan por el cuerpo.
                if (hitbox.name === 'torso' && Math.abs(closest.x - hitbox.center.x) > 0.26) continue;
                return { name: hitbox.name, center: hitbox.center.clone(), contact: closest };
            }
        }
        return null;
    }

    buildShotSamples(points) {
        return points.map((point, index) => {
            const previous = points[Math.max(0, index - 1)];
            const next = points[Math.min(points.length - 1, index + 1)];
            const dt = Math.max(0.001, next.t - previous.t);
            const vx = (next.x - previous.x) / dt;
            const vy = (next.y - previous.y) / dt;
            let ax = 0, ay = 0;
            if (index > 0 && index < points.length - 1) {
                const dt1 = Math.max(0.001, point.t - previous.t);
                const dt2 = Math.max(0.001, next.t - point.t);
                ax = ((next.x - point.x) / dt2 - (point.x - previous.x) / dt1) / ((dt1 + dt2) / 2);
                ay = ((next.y - point.y) / dt2 - (point.y - previous.y) / dt1) / ((dt1 + dt2) / 2);
            }
            return { t: point.t, x: point.x, y: point.y, vx, vy, ax, ay };
        });
    }

    registerGoalkeeperImpact(hit, currentPt, elapsed) {
        console.log('ATAJADA', {
            parte: hit.name,
            pelota: this.ball.position.clone(),
            centroHitbox: hit.center.clone()
        });
        const away = this.ball.position.clone().sub(hit.center).normalize();
        if (away.lengthSq() === 0) away.set(this.ball.position.x >= 0 ? 1 : -1, 0.35, 0.45);
        away.y = Math.max(0.25, away.y);
        away.z = Math.max(0.3, away.z);
        away.normalize();
        this.ball.position.copy(hit.contact).addScaledVector(away, 0.13);
        this.goalkeeperRebound = { startTime: performance.now(), start: this.ball.position.clone(), velocity: away.multiplyScalar(3.2), duration: 0.65 };
        this.isKicking = false;
        this.activeShotResult = { ...this.activeShotResult, outcome: 'SAVED', message: `¡Atajada con ${hit.name}!`, goalkeeperCollision: true, impactPart: hit.name, tGoal: currentPt.t ?? elapsed, yAtGoal: this.ball.position.y, zAtGoal: this.ball.position.x };
        const impactTime = currentPt.t ?? elapsed;
        this.shotSamples = this.shotSamples.filter(sample => sample.t <= impactTime);
        const last = this.shotSamples[this.shotSamples.length - 1] || { x: currentPt.x, y: currentPt.y };
        for (let i = 1; i <= 10; i++) {
            const t = i * this.goalkeeperRebound.duration / 10;
            this.shotSamples.push({ t: impactTime + t, x: last.x - this.goalkeeperRebound.velocity.z * t, y: Math.max(0.11, last.y + this.goalkeeperRebound.velocity.y * t - 4.9 * t * t), vx: -this.goalkeeperRebound.velocity.z, vy: this.goalkeeperRebound.velocity.y - 9.8 * t, ax: 0, ay: -9.8 });
        }
    }

createKicker() {
        this.kicker=new THREE.Group(); this.kicker.name='kickerRoot';
        const skin=new THREE.MeshStandardMaterial({color:0xc99068,roughness:.9}), jersey=new THREE.MeshStandardMaterial({color:0x0284c7,roughness:.72});
        const shorts=new THREE.MeshStandardMaterial({color:0x111827,roughness:.8}), socks=new THREE.MeshStandardMaterial({color:0x38bdf8,roughness:.78}), boots=new THREE.MeshStandardMaterial({color:0xeab308,roughness:.55});
        const seg=(joint,len,a,b,mat)=>{const m=new THREE.Mesh(new THREE.CylinderGeometry(b,a,len,14),mat);m.position.y=-len/2;m.castShadow=true;joint.add(m);};
        this.kickerPelvis=new THREE.Group();this.kickerPelvis.position.y=.91;this.kicker.add(this.kickerPelvis);const pm=new THREE.Mesh(new THREE.CylinderGeometry(.20,.23,.24,14),shorts);pm.scale.z=.7;this.kickerPelvis.add(pm);
        const leg=side=>{const thigh=new THREE.Group();thigh.position.set(side*.15,-.06,0);seg(thigh,.43,.09,.075,skin);const shin=new THREE.Group();shin.position.y=-.43;seg(shin,.44,.072,.055,socks);thigh.add(shin);const foot=new THREE.Group();foot.position.y=-.44;const shoe=new THREE.Mesh(new THREE.SphereGeometry(.09,12,8),boots);shoe.scale.set(.78,.55,1.7);shoe.position.z=-.08;foot.add(shoe);shin.add(foot);this.kickerPelvis.add(thigh);return{thigh,shin,foot};};
        const ll=leg(-1),rl=leg(1);this.kickerLegL=ll.thigh;this.kickerKneeL=ll.shin;this.plantFoot=ll.foot;this.kickerLegR=rl.thigh;this.kickerKneeR=rl.shin;this.kickBoot=rl.foot;
        this.kickerTorso=new THREE.Group();this.kickerTorso.position.y=.96;this.kicker.add(this.kickerTorso);const tm=new THREE.Mesh(new THREE.CylinderGeometry(.245,.18,.55,18),jersey);tm.position.y=.275;tm.scale.z=.72;tm.castShadow=true;this.kickerTorso.add(tm);
        const head=new THREE.Group();head.position.y=.70;const face=new THREE.Mesh(new THREE.SphereGeometry(.13,18,16),skin);face.scale.y=1.1;head.add(face);this.kickerTorso.add(head);
        const arm=side=>{const upper=new THREE.Group();upper.position.set(side*.27,.48,0);seg(upper,.29,.062,.052,jersey);const fore=new THREE.Group();fore.position.y=-.29;seg(fore,.28,.052,.042,skin);upper.add(fore);this.kickerTorso.add(upper);return{upper,fore};};
        const la=arm(-1),ra=arm(1);this.kickerArmL=la.upper;this.kickerForearmL=la.fore;this.kickerArmR=ra.upper;this.kickerForearmR=ra.fore;
        this.kicker.position.set(-.18,0,this.shotZ+.55);this.scene.add(this.kicker);this.resetKickerPose();
    }

    resetKickerPose() {
        if(!this.kicker)return;this.kicker.rotation.set(0,0,0);this.kickerPelvis.rotation.set(0,0,0);this.kickerTorso.rotation.set(.06,0,-.05);
        this.kickerLegL.rotation.set(-.05,0,-.04);this.kickerKneeL.rotation.set(.10,0,0);this.kickerLegR.rotation.set(.08,0,.04);this.kickerKneeR.rotation.set(.08,0,0);
        this.kickerArmL.rotation.set(-.08,0,.42);this.kickerArmR.rotation.set(.05,0,-.38);this.kickerForearmL.rotation.set(0,0,-.18);this.kickerForearmR.rotation.set(0,0,.18);
    }

    animateKicker(elapsed) {
        const smooth=t=>THREE.MathUtils.clamp(t,0,1)**2*(3-2*THREE.MathUtils.clamp(t,0,1));
        if(elapsed<.10)return;
        if(elapsed<.24){const p=smooth((elapsed-.10)/.14);this.kickerLegR.rotation.x=THREE.MathUtils.lerp(.08,-.82,p);this.kickerKneeR.rotation.x=THREE.MathUtils.lerp(.08,1.12,p);this.kickerTorso.rotation.x=.06+.12*p;this.kickerTorso.rotation.y=-.12*p;this.kickerArmL.rotation.z=.42+.36*p;this.kickerArmR.rotation.z=-.38-.26*p;}
        else if(elapsed<.38){const p=smooth((elapsed-.24)/.14);this.kickerLegR.rotation.x=THREE.MathUtils.lerp(-.82,1.02,p);this.kickerKneeR.rotation.x=THREE.MathUtils.lerp(1.12,.04,p);this.kickerPelvis.rotation.y=.20*p;this.kickerTorso.rotation.y=THREE.MathUtils.lerp(-.12,.18,p);}
        else if(elapsed<.62){const p=smooth((elapsed-.38)/.24);this.kickerLegR.rotation.x=THREE.MathUtils.lerp(1.02,.48,p);this.kickerKneeR.rotation.x=.04+.22*p;this.kickerTorso.rotation.x=THREE.MathUtils.lerp(.18,.08,p);this.kickerArmL.rotation.z=THREE.MathUtils.lerp(.78,.35,p);this.kickerArmR.rotation.z=THREE.MathUtils.lerp(-.64,-.24,p);}
        else {const p=smooth((elapsed-.62)/.55);this.kickerLegR.rotation.x=THREE.MathUtils.lerp(.48,.08,p);this.kickerKneeR.rotation.x=THREE.MathUtils.lerp(.26,.08,p);this.kickerPelvis.rotation.y=THREE.MathUtils.lerp(.20,0,p);this.kickerTorso.rotation.set(THREE.MathUtils.lerp(.08,.06,p),THREE.MathUtils.lerp(.18,0,p),-.05);this.kickerArmL.rotation.z=THREE.MathUtils.lerp(.35,.42,p);this.kickerArmR.rotation.z=THREE.MathUtils.lerp(-.24,-.38,p);}
    }

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
        this.ball.position.set(0, 0.11, this.shotZ);
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
        this.ballShadow.position.set(0, 0.006, this.shotZ);
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
        this.targetMarker.position.set(2.8, 2.15, this.goalZ + 0.05);
        this.targetMarker.visible = true;
        this.scene.add(this.targetMarker);
    }

    setTargetMode(mode) {
        this.targetMode = (mode === 'low_shot') ? 'low_shot' : 'top_corner';
        if (this.targetMarker) {
            this.targetMarker.visible = true;
        }
    }

    setTargetPosition(x, y) {
        if (!this.targetMarker) return;

        this.targetMarker.position.set(x, y, this.goalZ + 0.05);
        this.targetMarker.visible = true;
    }

    setDistance(newDist) {
        this.distGoal = newDist;
        this.distWall = 9.15;
        this.shotZ = this.goalZ + this.distGoal;
        if (this.kicker) this.kicker.position.z = this.shotZ + 0.42;
        if (this.wallGroup) this.wallGroup.position.z = this.shotZ - this.distWall;
        if (this.sprayLines[0]) this.sprayLines[0].position.z = this.shotZ - this.distWall;
        if (this.ballSpray) this.ballSpray.position.z = this.shotZ;

        // Actualizar encuadre automático de la cámara según la distancia
        if (this.cameraMode === 'side' || this.cameraMode === 'goal' || this.cameraMode === 'player' || this.cameraMode === 'follow') {
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
            this.camera.position.set(0, 1.7, this.shotZ + 3.4);
            this.cameraTarget.set(0, 1.25, this.goalZ);
            this.camera.lookAt(this.cameraTarget);
            this.fpsLook.yaw = 0;
            this.fpsLook.pitch = 0;
            if (this.kicker) this.kicker.visible = true;
        } else {
            if (this.kicker) this.kicker.visible = true;

            if (mode === 'side') {
                // Perfil lateral cinemático completamente horizontal a la altura mediana del tiro
                // Calculado dinámicamente para que el arco SIEMPRE sea visible a cualquier distancia (hasta 35m)
                const sideX = this.getSideCameraX();
                const sideY = Math.max(1.8, 1.35 + this.distGoal * 0.035);
                const sideZ = (this.shotZ + this.goalZ) / 2;

                this.cameraTarget.set(0, 1.35, sideZ);
                this.camera.position.set(sideX, sideY, sideZ);
                this.camera.lookAt(this.cameraTarget);

                this.orbitAngles.radius = sideX;
                this.orbitAngles.theta = Math.PI / 2;
                this.orbitAngles.phi = Math.PI / 2;
            } else if (mode === 'goal') {
                // Vista desde el arco: ubicada para ver TODO EL MARCO DEL ARCO (ambos postes, travesaño, Muslera y cancha)
                const goalZ = this.goalZ - 3.5;
                const goalY = 1.75;

                this.cameraTarget.set(0, 1.20, this.shotZ);
                this.camera.position.set(0, goalY, goalZ);
                this.camera.lookAt(this.cameraTarget);

                const offset = new THREE.Spherical().setFromVector3(this.camera.position.clone().sub(this.cameraTarget));
                this.orbitAngles.radius = offset.radius;
                this.orbitAngles.theta = offset.theta;
                this.orbitAngles.phi = offset.phi;
            } else if (mode === 'follow') {
                this.camera.position.set(0, 1.8, this.shotZ + 3.5);
                this.cameraTarget.set(0, 1.2, this.goalZ);
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
                const panSpeed = 0.035;
                const right = new THREE.Vector3();
                const up = new THREE.Vector3();
                this.camera.matrix.extractBasis(right, up, new THREE.Vector3());

                const moveVec = right.multiplyScalar(-dx * panSpeed).add(up.multiplyScalar(dy * panSpeed));
                this.camera.position.add(moveVec);
                this.cameraTarget.add(moveVec);
                this.camera.lookAt(this.cameraTarget);
            } else {
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
        if (this.cameraMode === 'player') {
            this.camera.fov = Math.max(20, Math.min(80, this.camera.fov * (deltaY > 0 ? 1.05 : 0.95)));
            this.camera.updateProjectionMatrix();
            return;
        }

        const fromTarget = this.camera.position.clone().sub(this.cameraTarget);
        const currentDistance = this.camera.position.distanceTo(this.cameraTarget);
        const direction = currentDistance > 0 ? fromTarget.normalize() : new THREE.Vector3(0, 1, 0);
        const zoomFactor = deltaY > 0 ? 1.10 : 0.90;
        const minDistance = this.cameraMode === 'goal' ? 2.7 : 3.2;
        const maxDistance = Math.min(240, this.camera.far - 120);
        const nextDistance = THREE.MathUtils.clamp(currentDistance * zoomFactor, minDistance, maxDistance);

        this.camera.position.copy(this.cameraTarget).add(direction.multiplyScalar(nextDistance));
        this.orbitAngles.radius = nextDistance;

        const offset = this.camera.position.clone().sub(this.cameraTarget);
        const spherical = new THREE.Spherical().setFromVector3(offset);
        this.orbitAngles.theta = spherical.theta;
        this.orbitAngles.phi = spherical.phi;

        this.camera.lookAt(this.cameraTarget);
    }

    resetBall() {
        this.isKicking = false;
        this.shotCompleted = true;
        this.goalkeeperRebound = null;
        this.kickProgress = 0;
        this.ball.position.set(0, 0.11, this.shotZ);
        this.previousBallPosition.copy(this.ball.position);
        this.ball.rotation.set(0, 0, 0);

        if (this.ballShadow) {
            this.ballShadow.position.set(0, 0.006, this.shotZ);
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
        this.gkState = 'ready';
        this.gkTargetX = 0;
        this.gkTargetY = 0;
        this.gkTargetRotZ = 0;
        this.gkTargetRotX = 0;
        this.gkTargetRotY = 0;
        this.gkArmTargetL = { z: 0.65, x: -0.25 };
        this.gkArmTargetR = { z: -0.65, x: -0.25 };
        this.gkLegTargetL = { z: 0 };
        this.gkLegTargetR = { z: 0 };
        this.setGoalkeeperNeutralPose();
    }

    startKick(points, duration, shotEvaluation, willWallJump) {
        this.restoreGoalkeeperLimbs();
        this.flightPoints = points;
        this.shotSamples = this.buildShotSamples(points);
        this.previousBallPosition.copy(this.ball.position);
        this.kickDuration = duration;
        this.activeShotResult = shotEvaluation;
        this.wallJumps = willWallJump;
        this.kickProgress = 0;
        this.isKicking = true;
        this.shotCompleted = false;
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
                this.gkTargetX = Math.min(1.85, Math.max(0, zLanding - 0.82));
                this.gkTargetY = Math.max(-0.25, Math.min(yLanding - 0.60, 0.95));
                this.gkTargetRotZ = -1.25; // Inclinación horizontal atlética ~72°
                this.gkLeapHeight = Math.max(0.35, Math.min(yLanding * 0.45, 0.85));
                this.gkArmTargetL = { z: 1.20, x: -0.72 };
                this.gkArmTargetR = { z: 1.56, x: -0.92 };
                this.gkLegTargetL = { z: -0.55 }; // Pierna de empuje extendida
                this.gkLegTargetR = { z: 0.35 };
            } else if (zLanding < -0.3) {
                // Vuelo hacia la izquierda
                this.gkTargetX = Math.max(-1.85, Math.min(0, zLanding + 0.82));
                this.gkTargetY = Math.max(-0.25, Math.min(yLanding - 0.60, 0.95));
                this.gkTargetRotZ = 1.25; // Inclinación horizontal ~72°
                this.gkLeapHeight = Math.max(0.35, Math.min(yLanding * 0.45, 0.85));
                this.gkArmTargetL = { z: -1.56, x: -0.92 };
                this.gkArmTargetR = { z: -1.20, x: -0.72 };
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
                // Remate centrado: reacción corta, sin elegir un lado al azar.
                this.gkTargetX = zLanding * 0.35;
                this.gkTargetY = Math.min(0.25, Math.max(-0.15, yLanding - 1.45));
                this.gkTargetRotZ = 0;
                this.gkLeapHeight = 0.25;
                this.gkArmTargetL = { z: 0.35, x: -0.85 };
                this.gkArmTargetR = { z: -0.35, x: -0.85 };
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

    finishShot() {
        if (this.shotCompleted) return;
        this.shotCompleted = true;
        this.isKicking = false;

        if (this.activeShotResult && this.activeShotResult.outcome.includes('GOAL')) {
            this.triggerGoalCelebration();
        }

        if (this.onShotComplete) {
            this.onShotComplete(this.activeShotResult);
        }
    }

    drawTrajectoryLine(points) {
        if (this.trajectoryLine) {
            this.scene.remove(this.trajectoryLine);
        }

        const curvePoints = points.map(p => new THREE.Vector3(p.z || 0, Math.max(0.1, p.y), this.shotZ - p.x));
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
            this.restoreGoalkeeperLimbs();

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
                this.ball.position.z = this.shotZ - currentPt.x;
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
                if (this.goalkeeper && this.gkState === 'dive') {
                    const timeToGoal = Math.max(0.1, this.activeShotResult?.tGoal || this.kickDuration);
                    const shotTime = Number.isFinite(currentPt.t) ? currentPt.t : ballElapsed;
                    const diveProg = THREE.MathUtils.clamp(shotTime / timeToGoal, 0, 1);
                    const smoothDive = diveProg * diveProg * (3 - 2 * diveProg);
                    const leapArc = Math.sin(diveProg * Math.PI / 2) * (this.gkLeapHeight || 0.45);

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

                const goalkeeperHit = this.checkGoalkeeperCollision(this.ball.position, 0.11);
                if (goalkeeperHit) {
                    this.registerGoalkeeperImpact(goalkeeperHit, currentPt, elapsed);
                } else {
                    this.previousBallPosition.copy(this.ball.position);
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
                if (progress >= 1.0 && this.isKicking) {
                    this.finishShot();

                    // Programar retorno suave del arquero a su posición inicial tras la jugada
                    setTimeout(() => {
                        this.resetGoalkeeper();
                    }, 1600);
                }
            }
        }

        if (this.goalkeeperRebound) {
            const rebound = this.goalkeeperRebound;
            const t = Math.min((now - rebound.startTime) / 1000, rebound.duration);
            this.ball.position.copy(rebound.start).addScaledVector(rebound.velocity, t);
            this.ball.position.y = Math.max(0.11, rebound.start.y + rebound.velocity.y * t - 4.9 * t * t);
            if (this.ballShadow) {
                this.ballShadow.position.set(this.ball.position.x, 0.006, this.ball.position.z);
            }
            if (t >= rebound.duration) {
                this.goalkeeperRebound = null;
                this.finishShot();
                setTimeout(() => this.resetGoalkeeper(), 1600);
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
