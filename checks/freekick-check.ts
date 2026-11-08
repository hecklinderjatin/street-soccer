import assert from 'node:assert/strict';
import { FREE_KICK as FK, PITCH } from '../src/shared/tuning';
import {
  GOAL_X,
  GOAL_Y,
  POST_HALF,
  STEP,
  aimAtGoalLine,
  ballContact,
  crossing,
  levelFor,
  makeKick,
  powerBand,
  readSwipe,
  scoreGoal,
  startPlay,
  stepPlay,
  strikeBall,
  type KickSetup,
  type Strike,
} from '../src/client/freekick/rules';

// Free Kick rules (src/client/freekick/rules.ts): the swipe, the strike,
// the flight and how kicks end.

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log('ok  ' + name);
}

function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}
const steady = () => 0.5; // keeper with no misread and no jitter
const centre = ballContact(0, 0);

function playOut(setup: KickSetup, strike: Strike) {
  const play = startPlay(setup, strike, steady);
  while (play.outcome === null) stepPlay(play, STEP);
  return play;
}

check('swipe: a tap or a downward swipe is no shot', () => {
  const up = (length: number) => [
    { x: 300, y: 900 },
    { x: 300, y: 900 - length / 2 },
    { x: 300, y: 900 - length },
  ];
  assert.equal(readSwipe([{ x: 1, y: 1 }]), null);
  assert.equal(readSwipe(up(FK.swipeMinPx - 1)), null);
  assert.equal(readSwipe(up(-200)), null);
  assert.deepEqual(readSwipe(up(FK.swipeMinPx)), { dirX: 0, dirY: -1 });
  assert.deepEqual(readSwipe(up(300)), readSwipe(up(FK.swipeMinPx)));
});

check('swipe: only the direction between the endpoints changes the aim', () => {
  const swipe = (side: number) => [
    { x: 300, y: 900 },
    { x: 300 + side * 70, y: 750 },
    { x: 200, y: 600 },
  ];
  assert.deepEqual(readSwipe(swipe(1)), readSwipe(swipe(-1)));
  assert.ok((readSwipe(swipe(1))?.dirX ?? 0) < 0);
});

check('aim: the swipe direction picks the goal-line point it crosses', () => {
  const a = { sx: 100, sy: 100, y: GOAL_Y - POST_HALF };
  const b = { sx: 500, sy: 100, y: GOAL_Y + POST_HALF };
  assert.equal(aimAtGoalLine({ x: 300, y: 500 }, 0, -1, a, b), GOAL_Y);
  const left = aimAtGoalLine({ x: 300, y: 500 }, -0.2, -0.98, a, b);
  assert.ok(left !== null && left < GOAL_Y);
  assert.equal(aimAtGoalLine({ x: 300, y: 500 }, 0, 1, a, b), null);
});

check('strike: contact controls flight while the swipe keeps the launch heading', () => {
  const spot = { x: GOAL_X - 600, y: GOAL_Y + 120 };
  const targetY = GOAL_Y - 80;
  const shot = (x: number, y: number, power = 0.65) =>
    strikeBall(spot, { power, targetY, contact: ballContact(x, y) });
  const drive = shot(0, 0);
  const chip = shot(0, 1);
  const low = shot(0, -1);
  const blend = shot(1, 1);
  const end = crossing(drive, GOAL_X);
  assert.ok(end && Math.abs(end.y - targetY) < 0.5);
  assert.equal(drive.spin, 0);
  assert.ok(chip.vz > drive.vz && low.vz < drive.vz);
  assert.ok(drive.vx > chip.vx && shot(0, 0, 1).vx > shot(0, 0, 0).vx);
  assert.ok(blend.vz > drive.vz && blend.spin > 0);
  assert.ok(Math.abs(blend.vy / blend.vx - drive.vy / drive.vx) < 1e-9);
  assert.ok(Math.abs(Math.hypot(blend.spin / FK.curlMax, ballContact(1, 1).y) - 1) < 1e-9);
});

check('strike: each side bends away from the selected contact', () => {
  const spot = { x: GOAL_X - 600, y: GOAL_Y };
  const at = (x: number) =>
    crossing(strikeBall(spot, { power: 0.65, targetY: GOAL_Y, contact: ballContact(x, 0) }), GOAL_X)?.y;
  assert.ok((at(1) ?? GOAL_Y) > GOAL_Y + 10);
  assert.ok((at(-1) ?? GOAL_Y) < GOAL_Y - 10);
});

check('levels: up every two goals, capped', () => {
  assert.equal(levelFor(0).level, 1);
  assert.equal(levelFor(FK.goalsPerLevel).level, 2);
  assert.equal(levelFor(1000).level, FK.maxLevel);
  assert.ok(levelFor(1000).reactSec < levelFor(0).reactSec);
});

check('kicks: outside the box, the wall between ball and goal', () => {
  const rand = seeded(7);
  for (let goals = 0; goals < 20; goals++) {
    const level = levelFor(goals);
    for (let i = 0; i < 20; i++) {
      const kick = makeKick(level, rand);
      assert.ok(kick.spot.x < GOAL_X - PITCH.boxDepth);
      assert.ok(kick.distance >= FK.minDistance - 1);
      assert.ok(kick.distance <= level.maxDistance + 1);
      assert.equal(kick.wall.men.length, level.wallMen);
      assert.ok(kick.wall.x > kick.spot.x && kick.wall.x < GOAL_X);
      assert.ok(Math.abs(kick.keeperY - GOAL_Y) < POST_HALF);
    }
  }
});

check('outcomes: a soft drive hits the wall, a full-power chip is too high', () => {
  const rand = seeded(3);
  for (let i = 0; i < 20; i++) {
    const kick = makeKick(levelFor(0), rand);
    const mid = kick.wall.men.reduce((s, m) => s + m, 0) / kick.wall.men.length;
    const targetY =
      kick.spot.y +
      ((mid - kick.spot.y) * (GOAL_X - kick.spot.x)) /
        (kick.wall.x - kick.spot.x);
    assert.equal(playOut(kick, { power: 0, targetY, contact: centre }).outcome, 'wall');
    const chip = playOut(kick, { power: 1, targetY, contact: ballContact(0, 1) });
    assert.ok(chip.outcome === 'over' || chip.outcome === 'post');
  }
});

check('outcomes: inside the power band a shot clears the wall', () => {
  const rand = seeded(11);
  for (let i = 0; i < 20; i++) {
    const kick = makeKick(levelFor(0), rand);
    const contact = ballContact(0, 0.55);
    const band = powerBand(kick, contact);
    assert.ok(band && band.hi >= band.lo, 'a level 1 kick has a band');
    const mid = kick.wall.men.reduce((s, m) => s + m, 0) / kick.wall.men.length;
    const targetY = Math.max(
      GOAL_Y - POST_HALF + 20,
      Math.min(
        GOAL_Y + POST_HALF - 20,
        kick.spot.y +
          ((mid - kick.spot.y) * (GOAL_X - kick.spot.x)) /
            (kick.wall.x - kick.spot.x)
      )
    );
    const play = playOut(kick, {
      power: (band.lo + band.hi) / 2,
      targetY,
      contact,
    });
    assert.ok(play.overWall, 'went over the wall');
    assert.notEqual(play.outcome, 'wall');
    assert.notEqual(play.outcome, 'over');
  }
});

check('outcomes: every level 1 kick can be scored', () => {
  const rand = seeded(5);
  for (let i = 0; i < 12; i++) {
    const kick = makeKick(levelFor(0), rand);
    let scored = false;
    for (const contact of [centre, ballContact(0, 0.6), ballContact(0.6, 0.35), ballContact(-0.6, 0.35)])
      for (let p = 0.3; p <= 0.8 && !scored; p += 0.05)
        for (let f = -0.85; f <= 0.85 && !scored; f += 0.17)
          scored =
            playOut(kick, { power: p, targetY: GOAL_Y + f * POST_HALF, contact })
              .outcome === 'goal';
    assert.ok(scored, `kick ${i} has a way in`);
  }
});

check('keeper: a shot straight at it is saved', () => {
  const kick = makeKick(levelFor(0), seeded(9));
  // Clear the wall out of the way: only the keeper stands in it.
  const open = { ...kick, wall: { ...kick.wall, men: [] } };
  const play = playOut(open, { power: 0.3, targetY: kick.keeperY, contact: centre });
  assert.equal(play.outcome, 'saved');
});

check('scoring: style tags and a capped streak multiplier', () => {
  const kick = makeKick(levelFor(0), seeded(13));
  const open = { ...kick, wall: { ...kick.wall, men: [] } };
  const play = startPlay(
    open,
    { power: 0.5, targetY: GOAL_Y, contact: ballContact(0.9, 0) },
    steady
  );
  assert.deepEqual(scoreGoal(play, 1), {
    points: FK.goalPoints + FK.bonusPoints,
    tags: ['CURLER'],
  });
  assert.equal(scoreGoal(play, 3).points, (FK.goalPoints + FK.bonusPoints) * 2);
  assert.equal(
    scoreGoal(play, 99).points,
    (FK.goalPoints + FK.bonusPoints) * FK.streakMax
  );
});

console.log(`\n${passed} checks passed`);
