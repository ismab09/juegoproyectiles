const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const THREE = require('./three.min.js');
const source = fs.readFileSync('scene3d.js', 'utf8');
const FootballScene = vm.runInNewContext(source + '\nFootballScene', { THREE });

const scene = Object.create(FootballScene.prototype);
scene.isKicking = true;
scene.shotCompleted = false;
scene.triggerGoalCelebration = () => { scene.celebrations++; };
scene.celebrations = 0;
scene.completed = [];
scene.onShotComplete = result => scene.completed.push(result.outcome);

function finish(outcome) {
    scene.activeShotResult = { outcome };
    scene.shotCompleted = false;
    scene.isKicking = true;
    scene.finishShot();
    scene.finishShot();
}

for (let i = 0; i < 5; i++) finish('GOAL');
for (let i = 0; i < 3; i++) finish('SAVED');
for (const outcome of ['CROSSBAR', 'POST', 'WALL_HIT_GROUND', 'MISS']) finish(outcome);

assert.equal(scene.completed.length, 12, 'cada tiro debe completarse una sola vez');
assert.equal(scene.completed.filter(outcome => outcome.includes('GOAL')).length, 5);
assert.equal(scene.celebrations, 5, 'solo los goles deben iniciar el festejo');

const main = fs.readFileSync('main.js', 'utf8');
assert(main.includes("result.outcome && result.outcome.includes('GOAL')"));
assert(main.includes('AudioFX.playGoal()'));
console.log('5 goles, 3 atajadas y resultados no gol completados una sola vez: OK');
