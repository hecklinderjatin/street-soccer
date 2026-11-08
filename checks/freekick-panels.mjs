// Exercise the actual scene methods without a renderer or production build.
// Remove imports only; injected display/audio objects stand in for Phaser.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const path = 'src/client/freekick/FreeKickScene.ts';
const parsed = ts.createSourceFile(
  path,
  readFileSync(path, 'utf8'),
  ts.ScriptTarget.Latest,
  true
);
const source = ts.factory.updateSourceFile(
  parsed,
  parsed.statements.filter((node) => !ts.isImportDeclaration(node))
);
const code = ts.transpileModule(ts.createPrinter().printFile(source), {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS,
  },
}).outputText;
let savedBests = 0;
const exports = {};
const document = { hidden: false, getElementById: () => null };
vm.runInNewContext(
  code,
  {
    exports,
    document,
    Phaser: {
      Scene: class {},
      Cameras: { Scene2D: { Events: { FADE_OUT_COMPLETE: 'fade' } } },
    },
    BALL: { radius: 10 },
    FK: { pxPerMetre: 30, fadeSec: 0.4 },
    PAL: { yellow: 1, blue: 2, orange: 3 },
    levelFor: (goals) => ({ level: 1 + Math.floor(goals / 2) }),
    scoreGoal: () => ({ points: 100, tags: [] }),
    localStorage: {
      getItem: () => null,
      setItem: () => {
        savedBests++;
      },
    },
    newProjected: () => ({}),
    buildFreeKickOverlay: (_scene, options) => ({
      options,
      destroy() {},
      setDepth() {
        return this;
      },
    }),
  },
  { filename: path }
);

const scene = Object.create(exports.FreeKickScene.prototype);
let worldUpdates = 0;
let musicResumes = 0;
let shots = 0;
let tweensPaused = false;
Object.assign(scene, {
  phase: 'flight',
  stage: {},
  overlay: null,
  overlayLayer: null,
  helpReturn: null,
  clock: 10,
  phaseAt: 9.5,
  acc: 0.01,
  play: null,
  lives: 2,
  setup: { level: { level: 3 }, distance: 600 },
  gesture: { id: 1, mode: 'swipe' },
  swipe: [{ x: 400, y: 1000 }],
  swipeTrailUntil: 20,
  swipeTrail: { clear() {} },
  tweens: {
    pauseAll() {
      tweensPaused = true;
    },
    resumeAll() {
      tweensPaused = false;
    },
  },
  music: {
    stop() {},
    pause() {},
    resume() {
      musicResumes++;
    },
  },
  drawControls() {},
  drawSwipeTrail() {},
  drawWorld() {
    worldUpdates++;
  },
  fly() {},
  shoot() {
    shots++;
  },
});

scene.setOverlay('pause');
assert.equal(scene.gesture, null);
assert.equal(scene.swipe.length, 0);
assert.equal(scene.swipeTrailUntil, 0);
assert.equal(tweensPaused, true);
for (let i = 0; i < 120; i++) scene.update(i * 16, 16);
assert.equal(scene.clock, 10, 'paused clock cannot advance');
assert.equal(scene.acc, 0.01, 'paused physics accumulator is retained');
assert.equal(worldUpdates, 0, 'no world animation or simulation while paused');
scene.onDown({ id: 2, x: 400, y: 1000 }, []);
scene.onUp({ id: 1, x: 400, y: 700 });
assert.equal(scene.gesture, null);
assert.equal(shots, 0, 'opening a panel cancels a pending shooting release');

scene.overlayLayer.options.help();
assert.equal(scene.overlay, 'details');
scene.overlayLayer.options.next();
assert.equal(scene.overlay, 'help');
assert.equal(scene.overlayLayer.options.backToPause, true);
scene.update(5000, 1000);
assert.equal(scene.clock, 10, 'help remains paused');
assert.equal(musicResumes, 0, 'pause to help does not resume music');
scene.overlayLayer.options.back();
assert.equal(scene.overlay, 'pause');
scene.overlayLayer.options.resume();
assert.equal(scene.overlay, null);
assert.equal(tweensPaused, false);
assert.equal(musicResumes, 1);
scene.update(6000, 16);
assert.ok(scene.clock > 10, 'resume advances the same kick again');
assert.equal(scene.phaseAt, 9.5);
assert.equal(worldUpdates, 1);

scene.setOverlay('help');
assert.equal(scene.overlayLayer.options.backToPause, false);
const before = scene.clock;
scene.renderOverlay(); // resize rebuild must retain the open panel and return target
assert.equal(scene.overlay, 'help');
assert.equal(scene.overlayLayer.options.backToPause, false);
scene.update(8000, 1000);
assert.equal(scene.clock, before);
document.hidden = true;
scene.overlayLayer.options.back();
assert.equal(scene.overlay, null);
assert.equal(
  musicResumes,
  1,
  'closing a panel in a hidden page does not restart music'
);

scene.stage = null;
scene.phase = 'loading';
scene.setOverlay('pause');
assert.equal(scene.overlay, null, 'panels cannot open before assets are ready');
console.log(
  'Free Kick panels passed: pause/help clocks, held input, return flow, resume, resize and hidden audio'
);

// Practice keeps misses retryable and cannot write the normal best score.
Object.assign(scene, {
  practice: true,
  shotKmh: 100,
  fastestGoalKmh: 0,
  phase: 'flight',
  stage: {},
  lives: 3,
  score: 0,
  goals: 1,
  streak: 1,
  bestStreak: 1,
  hint: '',
  strike: { power: 0.6 },
  reducedMotion: { matches: true },
  measure() {},
  sfx() {},
  showBanner() {},
  updateHud() {},
  showCard() {},
});
scene.onOutcome({ outcome: 'wide' });
assert.equal(scene.lives, 3, 'practice misses do not spend lives');
scene.onOutcome({ outcome: 'goal' });
assert.equal(scene.goals, 2);
assert.ok(
  !scene.hint.startsWith('LEVEL'),
  'practice goals do not announce level progression'
);
scene.gameOver();
assert.equal(savedBests, 0, 'practice cannot update normal best scores');
let retried = null;
let transition = null;
scene.cameras = {
  main: {
    fadeOut() {},
    fadeIn() {},
    once(_event, callback) {
      transition = callback;
    },
  },
};
scene.newKick = (retry) => {
  retried = retry;
};
scene.play = { outcome: 'goal' };
scene.endKick();
assert.ok(transition);
transition();
assert.equal(
  retried,
  true,
  'practice repeats the same setup even after a goal'
);
scene.practice = false;
scene.onOutcome({ outcome: 'wide' });
assert.equal(scene.lives, 2, 'normal play still spends lives');
scene.gameOver();
assert.equal(savedBests, 1, 'normal play still saves its best score');
console.log(
  'Practice passed: unlimited attempts, same-spot retry, no level-up announcement, isolated best score and normal-run regression'
);

// Intro cannot start play until the two info pages have been shown.
scene.stage = {};
scene.phase = 'aim';
scene.overlay = null;
scene.introPending = true;
scene.setOverlay('details');
assert.equal(scene.overlay, 'details');
const introClock = scene.clock;
scene.update(0, 5000);
assert.equal(scene.clock, introClock);
scene.setOverlay(null);
assert.equal(
  scene.overlay,
  'help',
  'closing intro details advances to Controls'
);
scene.overlayLayer.options.back();
assert.equal(scene.overlay, null);
assert.equal(scene.introPending, false);
assert.equal(
  scene.fastestGoalKmh,
  100,
  'scored shots record their launch speed'
);
scene.shotKmh = 150;
scene.onOutcome({ outcome: 'wide' });
assert.equal(scene.fastestGoalKmh, 100, 'misses cannot become fastest goals');
console.log(
  'Free Kick intro/speed passed: required two pages, paused clock, scored-launch records only'
);
