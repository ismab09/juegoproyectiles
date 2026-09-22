const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const THREE = require('./three.min.js');
const source = fs.readFileSync('scene3d.js', 'utf8');
const FootballScene = vm.runInNewContext(source + '\nFootballScene', { THREE, performance: { now: () => 0 } });
const scene = Object.create(FootballScene.prototype);
scene.goalZ = -35;
scene.distGoal = 22;
scene.shotZ = -13;
scene.previousBallPosition = new THREE.Vector3();
scene.cameraMode = 'player';
scene.camera = new THREE.PerspectiveCamera(54, 1.4, .05, 500);
scene.cameraTarget = new THREE.Vector3();
scene.orbitAngles = {};
scene.fpsLook = {};
scene.goalGroup = { position: { z: -35 } };
scene.goalLinesGroup = { position: { z: -35 } };
scene.goalkeeper = { position: { z: -34.65 } };
scene.targetMarker = { position: { z: -34.95 } };
scene.standsGroup = { position: { z: 0 } };
scene.kicker = { position: { z: 0 }, visible: true };
scene.wallGroup = { position: { z: 0 } };
scene.sprayLines = [{ position: { z: 0 } }];
scene.ballSpray = { position: { z: 0 } };
scene.ball = { position: new THREE.Vector3(), rotation: { set() {} } };
scene.ballShadow = { position: new THREE.Vector3(), scale: { set() {} }, material: {} };
scene.stopGoalCelebration = () => {};
scene.resetGoalkeeper = () => {};
scene.scene = { remove() {} };
for (const dist of [35, 32, 26, 22, 18]) {
    scene.setDistance(dist);
    assert.equal(scene.goalGroup.position.z, -35);
    assert.equal(scene.goalLinesGroup.position.z, -35);
    assert.equal(scene.goalkeeper.position.z, -34.65);
    assert.equal(scene.targetMarker.position.z, -34.95);
    assert.equal(scene.standsGroup.position.z, 0);
    assert.equal(scene.shotZ, -35 + dist);
    assert.equal(scene.ball.position.z, scene.shotZ);
    assert.equal(scene.kicker.position.z, scene.shotZ + .42);
    assert.equal(scene.wallGroup.position.z, scene.shotZ - 9.15);
    assert.equal(scene.sprayLines[0].position.z, scene.shotZ - 9.15);
    assert.equal(scene.ballSpray.position.z, scene.shotZ);
    assert.equal(scene.camera.position.z, scene.shotZ + 3.4);
}
scene.scene = { add(x) { scene.line = x; }, remove() {} };
scene.drawTrajectoryLine([{x: 0, y: .11, z: 0}, {x: 18, y: 1.2, z: 0}]);
const vertices = scene.line.geometry.attributes.position.array;
assert.equal(vertices[2], scene.shotZ);
assert.equal(vertices[5], scene.goalZ);
scene.setCameraView('goal');
for (let i = 0; i < 100; i++) scene.handleCameraZoom(1);
assert.equal(scene.orbitAngles.radius, 240);
scene.handleCameraZoom(-1);
assert(scene.orbitAngles.radius < 240);
for (let i = 0; i < 100; i++) scene.handleCameraZoom(-1);
assert.equal(scene.orbitAngles.radius, 2.7);
scene.handleCameraZoom(1);
assert(scene.orbitAngles.radius > 2.7);
assert(scene.camera.far - scene.orbitAngles.radius >= 120);
for (const mode of ['player', 'follow', 'side', 'goal']) {
    scene.setCameraView(mode);
    assert(Number.isFinite(scene.camera.position.x));
    assert(Number.isFinite(scene.camera.position.z));
}
scene.scene = { add(group) { scene.facade = group; } };
scene.createExteriorFacade();
assert(scene.facade.children.length > 40);
for (const part of scene.facade.children) {
    if (!part.isMesh) continue;
    const data = part.geometry.attributes.position.array;
    for (let i = 0; i < data.length; i += 3) {
        if (data[i + 1] < 20.9) continue;
        assert(Math.abs(data[i]) >= 40 || data[i + 2] < -42 || data[i + 2] > 48);
    }
}
console.log('5 distancias, trayectoria, zoom, cuatro cámaras y fachada: OK');
