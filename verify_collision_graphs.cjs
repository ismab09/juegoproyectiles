const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const THREE = require('./three.min.js');
const source = fs.readFileSync('scene3d.js', 'utf8');
const FootballScene = vm.runInNewContext(source + '\nFootballScene', { THREE, performance: { now: () => 1000 } });
const scene = Object.create(FootballScene.prototype);
scene.goalkeeper = new THREE.Group();
scene.goalZ = -35;
scene.goalkeeper.position.set(0, 0, -34.65);
scene.gkArmL = new THREE.Group(); scene.gkArmL.position.set(-.36, 1.82, 0);
scene.gkArmR = new THREE.Group(); scene.gkArmR.position.set(.36, 1.82, 0);
scene.gkGloveL = new THREE.Group(); scene.gkGloveL.position.set(0, -.57, 0);
scene.gkGloveR = new THREE.Group(); scene.gkGloveR.position.set(0, -.57, 0);
scene.gkArmL.add(scene.gkGloveL); scene.gkArmR.add(scene.gkGloveR);
scene.gkLegL = new THREE.Group(); scene.gkLegL.position.set(-.22, .95, .1);
scene.gkLegR = new THREE.Group(); scene.gkLegR.position.set(.22, .95, .1);
scene.goalkeeper.add(scene.gkArmL, scene.gkArmR, scene.gkLegL, scene.gkLegR);
scene.goalkeeperHitboxes = [];
scene.createGoalkeeperHitboxes();
scene.previousBallPosition = new THREE.Vector3(0, 1.52, -34.1);
const torsoHit = scene.checkGoalkeeperCollision(new THREE.Vector3(0, 1.52, -35.1), .11);
assert(torsoHit && torsoHit.name === 'torso');
scene.previousBallPosition = new THREE.Vector3(2.5, 1.5, -34.1);
assert.equal(scene.checkGoalkeeperCollision(new THREE.Vector3(2.5, 1.5, -35.1), .11), null);
scene.goalkeeper.updateMatrixWorld(true);
const gloveBox = scene.goalkeeperHitboxes.find(box => box.name === 'guante derecho');
const gloveCenter = new THREE.Vector3(); gloveBox.anchor.getWorldPosition(gloveCenter);
scene.previousBallPosition.copy(gloveCenter);
assert.equal(scene.checkGoalkeeperCollision(gloveCenter.clone(), .11).name, 'guante derecho');
const legBox = scene.goalkeeperHitboxes.find(box => box.name === 'pierna izquierda');
const legCenter = new THREE.Vector3(); legBox.anchor.getWorldPosition(legCenter);
scene.previousBallPosition.copy(legCenter);
assert.equal(scene.checkGoalkeeperCollision(legCenter.clone(), .11).name, 'pierna izquierda');
const testShots = [
    new THREE.Vector3(0, 1.52, -35),       // centro: cuerpo
    gloveCenter.clone(),                    // lateral alcanzable: guante
    new THREE.Vector3(2.65, 2.35, -35),    // ángulo, fuera de las hitboxes
    new THREE.Vector3(-2.65, 2.35, -35),   // ángulo opuesto
    new THREE.Vector3(3.05, 2.30, -35),    // fuera del alcance humano configurado
    new THREE.Vector3(0, 2.65, -35)        // demasiado alto
];
const outcomes = testShots.map(position => {
    scene.previousBallPosition.copy(position);
    return scene.checkGoalkeeperCollision(position, .11) ? 'SAVED' : 'GOAL';
});
assert(outcomes.includes('SAVED'));
assert(outcomes.includes('GOAL'));
assert(outcomes.filter(outcome => outcome === 'SAVED').length < outcomes.length);
const samples = scene.buildShotSamples([
    { t: 0, x: 0, y: .11 }, { t: .1, x: 2, y: 1 }, { t: .2, x: 4, y: 1.79 }
]);
assert.equal(samples.length, 3);
assert(Math.abs(samples[1].vx - 20) < .001);
assert(samples.every(sample => ['t','x','y','vx','vy','ax','ay'].every(key => Number.isFinite(sample[key]))));
scene.ball = { position: new THREE.Vector3(0, .11, -13), rotation: { set() {} } };
scene.previousBallPosition = new THREE.Vector3();
scene.drawTrajectoryLine = () => {};
scene.goalkeeper = null;
scene.startKick([
    { t: 0, x: 0, y: .11, z: 0 },
    { t: .5, x: 11, y: 1.5, z: 0 },
    { t: 1, x: 22, y: 1.2, z: 0 }
], 1, { outcome: 'GOAL', yAtGoal: 1.2, zAtGoal: 0 }, false);
assert(scene.isKicking);
assert(scene.shotSamples.length > 1);
assert(scene.previousBallPosition.equals(scene.ball.position));
scene.shotZ = -13;
scene.goalkeeperRebound = {};
scene.ballShadow = null;
scene.wallGroup = null;
scene.trajectoryLine = null;
scene.resetGoalkeeper = () => {};
scene.stopGoalCelebration = () => {};
scene.cameraMode = 'side';
scene.resetBall();
assert(scene.previousBallPosition.equals(scene.ball.position));
assert.notEqual(scene.previousBallPosition, null);
const html = fs.readFileSync('index.html', 'utf8');
const main = fs.readFileSync('main.js', 'utf8');
assert(html.includes('id="showGraphsBtn"') && html.includes('id="graphsModal"'));
for (const graph of ['x(t)', 'y(t)', 'vx(t)', 'vy(t)', 'ax(t)', 'ay(t)']) assert(main.includes(`'${graph}'`));
console.log('Colisión barrida, muestras reales y seis gráficas: OK');
