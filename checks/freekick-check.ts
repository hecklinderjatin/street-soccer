import assert from 'node:assert/strict';
import { FREE_KICK as FK, PITCH } from '../src/shared/tuning';
import {
  GOAL_X,
  GOAL_Y,
  POST_HALF,
  STEP,
  aimAtGoalLine,
  crossing,
  levelFor,
  makeKick,
  powerBand,
  readSwipe,
  scoreGoal,
  startPlay,
  stepPlay,
  strikeBall,
  swipePower,
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

function playOut(setup: KickSetup, strike: Strike) {
  const play = startPlay(setup, strike, steady);
  while (play.outcome === null) stepPlay(play, STEP);
  return play;
}

check('swipe: length is power, a tap or a downward swipe is no shot', () => {
  const up = (length: number) => [
    { x: 300, y: 900 },
    { x: 300, y: 900 - length / 2 },
    { x: 300, y: 900 - length },
  ];
  assert.equal(readSwipe([{ x: 1, y: 1 }]), null);
  assert.equal(readSwipe(up(FK.swipeMinPx - 1)), null);
  assert.equal(readSwipe(up(-200)), null);
  assert.equal(readSwipe(up(FK.swipeFullPx))?.power, 1);
  assert.equal(readSwipe(up(FK.swipeMinPx))?.power, 0);
  assert.equal(swipePower(FK.swipeFullPx * 3), 1);
  const swipe = readSwipe(up(300));
  assert.ok(swipe && swipe.curl === 0 && swipe.dirX === 0 && swipe.dirY === -1);
});

check('swipe: bulging right curls +, left curls -', () => {
  const bowed = (side: number) => [
    { x: 300, y: 900 },
    { x: 300 + side * 70, y: 750 },
    { x: 300, y: 600 },
  ];
  assert.ok((readSwipe(bowed(1))?.curl ?? 0) > 0.9);
  assert.ok((readSwipe(bowed(-1))?.curl ?? 0) < -0.9);
});

check('aim: the swipe direction picks the goal-line point it crosses', () => {
  const a = { sx: 100, sy: 100, y: GOAL_Y - POST_HALF };
  const b = { sx: 500, sy: 100, y: GOAL_Y + POST_HALF };
  assert.equal(aimAtGoalLine({ x: 300, y: 500 }, 0, -1, a, b), GOAL_Y);
  const left = aimAtGoalLine({ x: 300, y: 500 }, -0.2, -0.98, a, b);
  assert.ok(left !== null && left < GOAL_Y);
  assert.equal(aimAtGoalLine({ x: 300, y: 500 }, 0, 1, a, b), null);
});

check('strike: straight and curled shots reach the aimed point', () => {
  const spot = { x: GOAL_X - 600, y: GOAL_Y + 120 };
  for (const curl of [0, 0.8, -0.8]) {
    const targetY = GOAL_Y - 80;
    const end = crossing(
      strikeBall(spot, { power: 0.5, targetY, curl }),
      GOAL_X
    );
    assert.ok(end && Math.abs(end.y - targetY) < 3, `curl ${curl}`);
  }
});

check(
  'strike: + curl bends the path like a swipe bulging right (to -y)',
  () => {
    const spot = { x: GOAL_X - 600, y: GOAL_Y };
    const mid = GOAL_X - 300;
    const at = (curl: number) =>
      crossing(strikeBall(spot, { power: 0.5, targetY: GOAL_Y, curl }), mid)?.y;
    assert.ok((at(1) ?? GOAL_Y) < GOAL_Y - 10);
    assert.ok((at(-1) ?? GOAL_Y) > GOAL_Y + 10);
  }
);

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

check('outcomes: too soft hits the wall, too hard goes over', () => {
  const rand = seeded(3);
  for (let i = 0; i < 20; i++) {
    const kick = makeKick(levelFor(0), rand);
    const mid = kick.wall.men.reduce((s, m) => s + m, 0) / kick.wall.men.length;
    const targetY =
      kick.spot.y +
      ((mid - kick.spot.y) * (GOAL_X - kick.spot.x)) /
        (kick.wall.x - kick.spot.x);
    assert.equal(playOut(kick, { power: 0, targetY, curl: 0 }).outcome, 'wall');
    assert.equal(playOut(kick, { power: 1, targetY, curl: 0 }).outcome, 'over');
  }
});

check('outcomes: inside the power band a shot clears the wall', () => {
  const rand = seeded(11);
  for (let i = 0; i < 20; i++) {
    const kick = makeKick(levelFor(0), rand);
    const band = powerBand(kick);
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
      curl: 0,
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
    for (const curl of [0, 0.6, -0.6])
      for (let p = 0.3; p <= 0.8 && !scored; p += 0.05)
        for (let f = -0.85; f <= 0.85 && !scored; f += 0.17)
          scored =
            playOut(kick, { power: p, targetY: GOAL_Y + f * POST_HALF, curl })
              .outcome === 'goal';
    assert.ok(scored, `kick ${i} has a way in`);
  }
});

check('keeper: a shot straight at it is saved', () => {
  const kick = makeKick(levelFor(0), seeded(9));
  // Clear the wall out of the way: only the keeper stands in it.
  const open = { ...kick, wall: { ...kick.wall, men: [] } };
  const play = playOut(open, { power: 0.3, targetY: kick.keeperY, curl: 0 });
  assert.equal(play.outcome, 'saved');
});

check('scoring: style tags and a capped streak multiplier', () => {
  const kick = makeKick(levelFor(0), seeded(13));
  const open = { ...kick, wall: { ...kick.wall, men: [] } };
  const play = startPlay(
    open,
    { power: 0.5, targetY: GOAL_Y, curl: 0.9 },
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
