const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const THREE = require('./three.min.js');
global.Physics = require('./physics.js');
const actualChallenges = require('./challenges.js');
assert.equal(actualChallenges.generateChallenge(false, 22).wallActive, false);
assert.equal(actualChallenges.generateChallenge(true, 22).wallActive, true);

function element(dataset = {}, value = '') {
    const classes = new Set();
    return {
        dataset, value, textContent: '', innerHTML: '', style: {}, events: {},
        classList: {
            add(name) { classes.add(name); },
            remove(name) { classes.delete(name); },
            toggle(name, active) { active ? classes.add(name) : classes.delete(name); },
            contains(name) { return classes.has(name); }
        },
        addEventListener(name, handler) { this.events[name] = handler; },
        click() { assert(this.events.click); this.events.click({ target: this }); }
    };
}

const modes = [element({ wall: 'false' }), element({ wall: 'true' })];
modes[0].classList.add('active');
const targetData = [
    [2.8, 2.15, 'Ángulo Der.'], [-2.8, 2.15, 'Ángulo Izq.'],
    [2.6, .35, 'Abajo Der.'], [-2.6, .35, 'Abajo Izq.'],
    [0, 2.35, 'Travesaño'], [0, 1.2, 'Centro']
];
const targets = targetData.map(([tx, ty, name]) => element({ tx: String(tx), ty: String(ty), name }));
const inputs = { viSlider: '22', alphaSlider: '25', latSlider: '4.5' };
const byId = new Map();
const document = {
    addEventListener(name, handler) { if (name === 'DOMContentLoaded') handler(); },
    getElementById(id) {
        if (!byId.has(id)) byId.set(id, element({}, inputs[id] || '0'));
        return byId.get(id);
    },
    querySelectorAll(selector) {
        if (selector === '.mode-tab') return modes;
        if (selector === '.target-pill') return targets;
        return [];
    },
    querySelector() { return element(); }
};
let gameScene;
class FootballScene {
    constructor() {
        this.goalZ = -35;
        this.targetMarker = { position: new THREE.Vector3(2.8, 2.15, -34.95), visible: true };
        this.goalGroup = { position: new THREE.Vector3(0, 0, -35) };
        this.goalkeeper = { position: new THREE.Vector3(0, 0, -34.65) };
        this.camera = { position: new THREE.Vector3() };
        this.standsGroup = { position: new THREE.Vector3() };
        gameScene = this;
    }
    setTargetPosition(x, y) { this.targetMarker.position.set(x, y, this.goalZ + .05); }
    setTargetMode(mode) { this.targetMode = mode; }
    setWallVisibility(enabled) { this.wallVisible = enabled; }
    setWallLateralAim() {}
}
const Physics = {
    degToRad: x => x * Math.PI / 180,
    getTimeForDistance: () => 1,
    getVfx: () => 20,
    getVfy: () => 5,
    getYf: () => 1
};
const Challenges = { generateChallenge: wallEnabled => ({
    title: String(wallEnabled), badge: String(wallEnabled), question: String(wallEnabled), unknownUnit: 'm',
    stepByStep: [], formulaId: 'yf', wallActive: wallEnabled
}) };
vm.runInNewContext(fs.readFileSync('main.js', 'utf8'), {
    document, FootballScene, Physics, Challenges, THREE, AudioFX: {}, console, setTimeout
});
function checkTarget(name, wallEnabled) {
    const expected = targetData.find(item => item[2] === name);
    assert.equal(gameScene.targetMarker.position.x, expected[0]);
    assert.equal(gameScene.targetMarker.position.y, expected[1]);
    assert.equal(gameScene.targetMarker.position.z, -34.95);
    assert(modes.find(button => button.dataset.wall === String(wallEnabled)).classList.contains('active'));
    assert.equal(gameScene.wallVisible, wallEnabled);
    assert.equal(byId.get('wallJumpGroup').style.display, wallEnabled ? 'flex' : 'none');
    assert.equal(gameScene.goalGroup.position.z, -35);
    assert.equal(gameScene.goalkeeper.position.z, -34.65);
}
checkTarget('Ángulo Der.', false);
targets[3].click(); checkTarget('Abajo Izq.', false);
modes[1].click(); checkTarget('Abajo Izq.', true);
targets[5].click(); checkTarget('Centro', true);
modes[0].click(); checkTarget('Centro', false);
targets[4].click(); checkTarget('Travesaño', false);
modes[1].click(); checkTarget('Travesaño', true);
console.log('Diana independiente de barrera: OK');
