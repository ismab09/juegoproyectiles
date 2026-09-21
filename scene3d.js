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

        const jerseyNeonMat = new THREE.MeshLambertMaterial({ color: 0xf97316 });
        const jerseyTrimMat = new THREE.MeshLambertMaterial({ color: 0x0f172a });
        const skinMat = new THREE.MeshLambertMaterial({ color: 0xd4a373 });
        const glovePalmMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.8 });
        const gloveBackMat = new THREE.MeshLambertMaterial({ color: 0xef4444 });
        const hairMat = new THREE.MeshLambertMaterial({ color: 0x1c1917 });
        const shortsMat = new THREE.MeshLambertMaterial({ color: 0x1e293b });
        const socksMat = new THREE.MeshLambertMaterial({ color: 0xf97316 });
        const bootsMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 });

        this.gkLegL = new THREE.Group();
        this.gkLegL.position.set(-0.22, 0.95, 0.1);

        const thighL = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.085, 0.5, 16), skinMat);
        thighL.position.set(0, -0.22, 0);
        this.gkLegL.add(thighL);

        const padL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.14), jerseyTrimMat);
        padL.position.set(0, -0.44, 0.02);
        this.gkLegL.add(padL);

        const calfL = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.07, 0.54, 16), socksMat);
        calfL.position.set(0, -0.7, 0);
        this.gkLegL.add(calfL);

        const bootL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.1, 0.28), bootsMat);
        bootL.position.set(0, -0.97, 0.05);
        this.gkLegL.add(bootL);

        this.goalkeeper.add(this.gkLegL);

        this.gkLegR = new THREE.Group();
        this.gkLegR.position.set(0.22, 0.95, 0.1);

        const thighR = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.085, 0.5, 16), skinMat);
        thighR.position.set(0, -0.22, 0);
        this.gkLegR.add(thighR);

        const padR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.14), jerseyTrimMat);
        padR.position.set(0, -0.44, 0.02);
        this.gkLegR.add(padR);

        const calfR = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.07, 0.54, 16), socksMat);
        calfR.position.set(0, -0.7, 0);
        this.gkLegR.add(calfR);

        const bootR = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.1, 0.28), bootsMat);
        bootR.position.set(0, -0.97, 0.05);
        this.gkLegR.add(bootR);

        this.goalkeeper.add(this.gkLegR);

        const shorts = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.30, 0.36, 12), shortsMat);
        shorts.position.set(0, 1.08, 0.02);
        shorts.castShadow = true;
        this.goalkeeper.add(shorts);

        const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.21, 0.68, 16), jerseyNeonMat);
        torso.scale.z = 0.74;
        torso.position.set(0, 1.58, 0.03);
        torso.castShadow = true;
        this.goalkeeper.add(torso);

        const sidePanelL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.54, 0.3), jerseyTrimMat);
        sidePanelL.position.set(-0.28, 1.58, 0.03);
        this.goalkeeper.add(sidePanelL);

        const sidePanelR = sidePanelL.clone();
        sidePanelR.position.x = 0.28;
        this.goalkeeper.add(sidePanelR);

        const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.16, 14), skinMat);
        neck.position.set(0, 1.96, 0.02);
        this.goalkeeper.add(neck);

        const shoulderL = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 16), jerseyNeonMat);
        shoulderL.position.set(-0.36, 1.8, 0.02);
        this.goalkeeper.add(shoulderL);

        const shoulderR = shoulderL.clone();
        shoulderR.position.x = 0.36;
        this.goalkeeper.add(shoulderR);

        this.gkArmBaseL = { z: 0.72, x: -0.18 };
        this.gkArmBaseR = { z: -0.72, x: -0.18 };

        this.gkArmL = new THREE.Group();
        this.gkArmL.position.set(-0.36, 1.82, 0.02);
        this.gkArmL.rotation.z = this.gkArmBaseL.z;
        this.gkArmL.rotation.x = this.gkArmBaseL.x;

        const armMeshL = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.063, 0.54, 12), jerseyNeonMat);
        armMeshL.position.set(0, -0.26, 0);
        this.gkArmL.add(armMeshL);

        const armBandL = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.08, 12), new THREE.MeshBasicMaterial({ color: 0xfacc15 }));
        armBandL.position.set(0, -0.12, 0);
        this.gkArmL.add(armBandL);

        const gloveLGroup = new THREE.Group();
        gloveLGroup.position.set(0, -0.57, 0.02);

        const glovePalmL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.2, 0.08), gloveBackMat);
        gloveLGroup.add(glovePalmL);

        const palmL = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.18), glovePalmMat);
        palmL.position.set(0, 0, 0.045);
        gloveLGroup.add(palmL);

        for (let f = 0; f < 4; f++) {
            const finger = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.018, 0.09, 8), gloveBackMat);
            finger.position.set(-0.05 + f * 0.033, -0.12, 0);
            gloveLGroup.add(finger);
        }

        const thumbL = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.018, 0.08, 8), gloveBackMat);
        thumbL.rotation.z = -Math.PI / 4;
        thumbL.position.set(0.08, -0.035, 0.02);
        gloveLGroup.add(thumbL);

        this.gkArmL.add(gloveLGroup);
        this.gkGloveL = gloveLGroup;
        this.goalkeeper.add(this.gkArmL);

        this.gkArmR = new THREE.Group();
        this.gkArmR.position.set(0.36, 1.82, 0.02);
        this.gkArmR.rotation.z = this.gkArmBaseR.z;
        this.gkArmR.rotation.x = this.gkArmBaseR.x;

        const armMeshR = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.063, 0.54, 12), jerseyNeonMat);
        armMeshR.position.set(0, -0.26, 0);
        this.gkArmR.add(armMeshR);

        const gloveRGroup = new THREE.Group();
        gloveRGroup.position.set(0, -0.57, 0.02);

        const glovePalmR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.2, 0.08), gloveBackMat);
        gloveRGroup.add(glovePalmR);

        const palmR = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.18), glovePalmMat);
        palmR.position.set(0, 0, 0.045);
        gloveRGroup.add(palmR);

        for (let f = 0; f < 4; f++) {
            const finger = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.018, 0.09, 8), gloveBackMat);
            finger.position.set(-0.05 + f * 0.033, -0.12, 0);
            gloveRGroup.add(finger);
        }

        const thumbR = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.018, 0.08, 8), gloveBackMat);
        thumbR.rotation.z = Math.PI / 4;
        thumbR.position.set(-0.08, -0.035, 0.02);
        gloveRGroup.add(thumbR);

        this.gkArmR.add(gloveRGroup);
        this.gkGloveR = gloveRGroup;
        this.goalkeeper.add(this.gkArmR);

        const head = new THREE.Mesh(new THREE.SphereGeometry(0.135, 18, 18), skinMat);
        head.position.set(0, 2.12, 0.02);
        head.castShadow = true;
        this.goalkeeper.add(head);

        const hair = new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 14, 0, Math.PI * 2, 0, Math.PI / 2.1), hairMat);
        hair.position.set(0, 2.15, 0.02);
        this.goalkeeper.add(hair);

        const beard = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.09, 0.12), new THREE.MeshLambertMaterial({ color: 0x33261d }));
        beard.position.set(0, 2.03, 0.09);
        this.goalkeeper.add(beard);

        const nose = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.06, 6), skinMat);
        nose.rotation.x = -Math.PI / 2;
        nose.position.set(0, 2.09, 0.15);
        this.goalkeeper.add(nose);

        this.goalkeeper.position.set(0, 0, this.goalZ + 0.35);
        this.scene.add(this.goalkeeper);
    }

    // =========================================================================
    // 10. FUTBOLISTA PATEADOR REALISTA JUNTO AL BALÓN
    // =========================================================================
    createKicker() {
        this.kicker = new THREE.Group();

        const skinMat = new THREE.MeshLambertMaterial({ color: 0xd4a373 });
        const jerseyMat = new THREE.MeshLambertMaterial({ color: 0x0284c7 });
        const shortsMat = new THREE.MeshLambertMaterial({ color: 0x0f172a });
        const socksMat = new THREE.MeshLambertMaterial({ color: 0x38bdf8 });
        const bootsMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.35 });
        const lacesMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
        const studsMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8 });

        function createSoccerBoot() {
            const boot = new THREE.Group();

            const sole = new THREE.Mesh(new THREE.BoxGeometry(0.125, 0.03, 0.25), bootsMat);
            sole.position.set(0, 0.015, -0.05);
            sole.castShadow = true;
            boot.add(sole);

            const vamp = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.065, 0.15), bootsMat);
            vamp.position.set(0, 0.05, -0.09);
            boot.add(vamp);

            const heel = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.10), bootsMat);
            heel.position.set(0, 0.06, 0.025);
            boot.add(heel);

            const laces = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.015, 0.09), lacesMat);
            laces.position.set(0, 0.085, -0.08);
            boot.add(laces);

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

        this.plantFoot = createSoccerBoot();
        this.plantFoot.position.set(-0.35, 0, -0.02);
        this.kicker.add(this.plantFoot);

        const plantLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.058, 0.86, 14), socksMat);
        plantLeg.position.set(-0.35, 0.46, 0.0);
        plantLeg.rotation.z = -0.05;
        this.kicker.add(plantLeg);

        this.kickerLegR = new THREE.Group();
        this.kickerLegR.position.set(0.14, 0.9, 0);

        const kickThigh = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.068, 0.44, 14), skinMat);
        kickThigh.position.set(0, -0.22, 0);
        this.kickerLegR.add(kickThigh);

        this.kickerKneeR = new THREE.Group();
        this.kickerKneeR.position.set(0, -0.44, 0);

        const kneeCap = new THREE.Mesh(new THREE.SphereGeometry(0.066, 12, 12), skinMat);
        kneeCap.position.set(0, 0, 0.01);
        this.kickerKneeR.add(kneeCap);

        const kickCalf = new THREE.Mesh(new THREE.CylinderGeometry(0.066, 0.054, 0.42, 14), socksMat);
        kickCalf.position.set(0, -0.21, 0);
        this.kickerKneeR.add(kickCalf);

        this.kickBoot = createSoccerBoot();
        this.kickBoot.position.set(0, -0.42, 0);
        this.kickBoot.rotation.y = -0.15;
        this.kickerKneeR.add(this.kickBoot);

        this.kickerLegR.add(this.kickerKneeR);
        this.kicker.add(this.kickerLegR);

        this.kickerTorso = new THREE.Group();
        this.kickerTorso.position.set(-0.10, 1.05, 0);

        const shorts = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.27, 0.34, 12), shortsMat);
        shorts.position.set(0, 0.03, 0.02);
        this.kickerTorso.add(shorts);

        const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.18, 0.58, 16), jerseyMat);
        torso.scale.z = 0.75;
        torso.position.set(0, 0.38, 0.02);
        torso.castShadow = true;
        this.kickerTorso.add(torso);

        const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.12, 12), skinMat);
        neck.position.set(0, 0.72, 0.02);
        this.kickerTorso.add(neck);

        const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 18, 18), skinMat);
        head.position.set(0, 0.84, 0.05);
        head.rotation.x = -0.12;
        this.kickerTorso.add(head);

        const hair = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 14, 0, Math.PI * 2, 0, Math.PI / 2.1), new THREE.MeshLambertMaterial({ color: 0x1c1917 }));
        hair.position.set(0, 0.90, 0.04);
        this.kickerTorso.add(hair);

        this.kicker.add(this.kickerTorso);

        this.kickerArmL = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.5, 12), jerseyMat);
        this.kickerArmL.position.set(-0.38, 1.45, 0.08);
        this.kickerArmL.rotation.z = 0.55;
        this.kickerArmL.rotation.x = -0.35;
        this.kicker.add(this.kickerArmL);

        this.kickerArmR = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.5, 12), jerseyMat);
        this.kickerArmR.position.set(0.22, 1.42, -0.06);
        this.kickerArmR.rotation.z = -0.45;
        this.kickerArmR.rotation.x = 0.1;
        this.kicker.add(this.kickerArmR);

        this.kicker.position.set(-0.06, 0, this.shotZ + 0.42);
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
        this.kickProgress = 0;
        this.ball.position.set(0, 0.11, this.shotZ);
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
