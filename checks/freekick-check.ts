import { readFileSync } from 'node:fs';
import {
  readFreeKickStats,
  rankFreeKicks,
  freeKickMaxKmh,
  freeKickGoalMax,
  freeKickGoalMin,
} from '../src/shared/freeKick';
import { practiceLevel } from '../src/client/freekick/mode';
import { postType, competitiveResultAllowed } from '../src/shared/postType';
import { challengeFormFor, readChallenge } from '../src/server/core/challengeForm';
import { parseMatchConfig } from '../src/shared/matchConfig';
import {
  FREE_KICK_CHALLENGE_DEFAULT,
  challengeOutcome,
  challengeRoundLevel,
  parseFreeKickChallenge,
  postFreeKickChallenge,
} from '../src/shared/freeKickChallenge';
import { DIFFICULTIES } from '../src/shared/types';
import {
  freeKickControls,
  freeKickGesture,
} from '../src/client/freekick/controls';
import assert from 'node:assert/strict';
import { FREE_KICK as FK, PITCH } from '../src/shared/tuning';
import {
  GOAL_X,
  GOAL_Y,
  POST_HALF,
  STEP,
  aimAtGoalLine,
  ballContact,
  challengeKick,
  curvedStrike,
  swipeBow,
  crossing,
  levelFor,
  makeKick,
  powerBand,
  goalPoints,
  readSwipe,
  retryXg,
  scoreGoal,
  shotXgot,
  spotXg,
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

check(
  'controls: left shot selector stays below the power bar and outside shooting area',
  () => {
    for (const [width, height] of [
      [720, 1280],
      [720, 1560],
      [960, 1280],
    ]) {
      const layout = freeKickControls(width!, height!);
      const { contact, power, shooting } = layout;
      assert.ok(
        contact.y - contact.frame > power.bottom + 58,
        'touch targets do not overlap'
      );
      assert.ok(
        contact.x + contact.frame < shooting.left,
        'selector is outside swipe area'
      );
      assert.ok(
        contact.y + contact.frame + 48 < height! - 124,
        'style label clears the bottom hint'
      );
      assert.equal(freeKickGesture(contact, layout), 'contact');
      assert.equal(
        freeKickGesture(
          { x: power.x, y: (power.top + power.bottom) / 2 },
          layout
        ),
        'power'
      );
      assert.equal(
        freeKickGesture({ x: width! * 0.7, y: height! * 0.65 }, layout),
        'swipe'
      );
      assert.equal(
        freeKickGesture({ x: width! / 2, y: 80 }, layout),
        null,
        'HUD cannot shoot'
      );
      assert.equal(
        freeKickGesture({ x: 15, y: height! - 10 }, layout),
        null,
        'unused left edge cannot shoot'
      );
    }
  }
);
check(
  'controls: the physical ball and clear pitch now start shooting swipes',
  () => {
    const layout = freeKickControls(720, 1280);
    assert.equal(freeKickGesture({ x: 390, y: 1030 }, layout), 'swipe');
    assert.equal(freeKickGesture({ x: 510, y: 640 }, layout), 'swipe');

  }
);
check('Free Kick posts ask for challenge settings, not match settings, and reject match leaderboards', () => {
  const form = challengeFormFor('freekick');
  assert.ok(!form.fields.some(field => ['dailyMode', 'difficulty', 'durationSec', 'homeJersey'].includes(field.name)));
  const names = form.fields.flatMap(field => field.type === 'group' ? field.fields.map(f => f.name) : [field.name]);
  for (const name of ['fkKicker', 'fkWall', 'fkLives', 'fkGoals', 'fkDistance', 'fkWallDistance', 'fkDifficulty'])
    assert.ok(names.includes(name), name);
  const values = { matchType: ['freekick'], title: 'Free Kick', description: 'Beat the wall', fkKicker: ['red'], fkWall: ['white'], fkLives: ['4'], fkGoals: ['6'], fkDistance: ['30'], fkWallDistance: ['18'], fkDifficulty: ['noob'] };
  const created = readChallenge(values, parseMatchConfig);
  assert.ok(typeof created !== 'string');
  assert.deepEqual(created.freeKick, { kicker: 'red', wall: 'white', lives: 4, goals: 6, distanceM: 30, wallFromGoalM: 18, difficulty: 'noob' });
  assert.equal(created.matchType, 'freekick');
  // Too near the ball, the same kit twice, or out of range: rejected.
  for (const bad of [{ fkWallDistance: ['24'] }, { fkWall: ['red'] }, { fkLives: ['0'] }, { fkGoals: ['99'] }, { fkDistance: ['27'] }])
    assert.equal(typeof readChallenge({ ...values, ...bad }, parseMatchConfig), 'string', JSON.stringify(bad));
  assert.equal(postType({ matchType: 'freekick' }), 'freekick');
  assert.equal(competitiveResultAllowed({ matchType: 'freekick' }, { mode: 'competitive' }), false);
});
check('practice levels accept the supported whole levels only', () => {
  for (let level = 1; level <= FK.maxLevel; level++) assert.equal(practiceLevel(level), level);
  for (const value of [0, -1, FK.maxLevel + 1, 1.5, '3', null, undefined, Infinity]) assert.equal(practiceLevel(value), 1);
});
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

check('scoring: xG x finish x a capped streak; tags are labels only', () => {
  const kick = makeKick(levelFor(0), seeded(13));
  const open = { ...kick, wall: { ...kick.wall, men: [] } };
  const play = startPlay(
    open,
    { power: 0.5, targetY: GOAL_Y, contact: ballContact(0.9, 0) },
    steady
  );
  const base = (FK.pointsPerXg / 0.1) * (FK.finishBase + 0.5);
  assert.deepEqual(scoreGoal(play, 1, 0.1, 0.5), {
    points: Math.round(base),
    tags: ['CURLER'],
  });
  assert.equal(scoreGoal(play, 3, 0.1, 0.5).points, Math.round(base * 1.5));
  assert.equal(
    scoreGoal(play, 99, 0.1, 0.5).points,
    Math.round(base * FK.streakMax)
  );
  // Harder spots and better finishes are worth more.
  assert.ok(goalPoints(0.05, 0.5, 1) > goalPoints(0.2, 0.5, 1));
  assert.ok(goalPoints(0.1, 0.9, 1) > goalPoints(0.1, 0.1, 1));
  assert.equal(goalPoints(0.1, 1, 1), goalPoints(0.1, 0, 1) * 3);
  // Every goal lies within the bounds the server accepts.
  for (const xg of [FK.xgMin, 0.05, FK.xgMax, FK.xgRetryMax])
    for (const xgot of [0, 1])
      for (const streak of [1, 99]) {
        const points = goalPoints(xg, xgot, streak);
        assert.ok(points >= freeKickGoalMin && points <= freeKickGoalMax);
      }
});

check('xG: harder levels give lower spot xG, retries raise it', () => {
  const mean = (goals: number) => {
    const rand = seeded(21);
    let sum = 0;
    for (let i = 0; i < 6; i++) sum += spotXg(makeKick(levelFor(goals), rand));
    return sum / 6;
  };
  const easy = mean(0);
  const hard = mean((FK.maxLevel - 1) * FK.goalsPerLevel);
  assert.ok(easy > hard * 2, `level 1 ${easy} vs top ${hard}`);
  assert.ok(easy >= FK.xgMin && easy <= FK.xgMax);
  // Seeded by the spot: the same spot always shows the same xG.
  const kick = makeKick(levelFor(0), seeded(5));
  assert.equal(spotXg(kick), spotXg(kick));
  assert.equal(retryXg(0.1, 0), 0.1);
  assert.ok(Math.abs(retryXg(0.1, 1) - 0.1 * FK.xgRetryScale) < 1e-9);
  assert.equal(retryXg(0.1, 20), FK.xgRetryMax);
});

check('xGOT: 0 off target, higher for a corner than at the keeper', () => {
  const kick = makeKick(levelFor(0), seeded(9));
  const open = { ...kick, wall: { ...kick.wall, men: [] } };
  const atKeeper = playOut(open, {
    power: 0.3,
    targetY: kick.keeperY,
    contact: centre,
  });
  assert.equal(atKeeper.outcome, 'saved');
  const wide = playOut(open, {
    power: 0.6,
    targetY: GOAL_Y + 2.5 * POST_HALF,
    contact: centre,
  });
  assert.notEqual(wide.outcome, 'goal');
  assert.equal(shotXgot(wide), 0);
  // The best of a sweep of corner shots beats the keeper most of the time.
  let best = 0;
  for (const side of [-1, 1])
    for (const power of [0.5, 0.7, 0.9])
      for (const cx of [-0.8, 0, 0.8]) {
        const play = playOut(open, {
          power,
          targetY: GOAL_Y + side * (POST_HALF - 20),
          contact: ballContact(cx, 0),
        });
        best = Math.max(best, shotXgot(play));
      }
  assert.ok(best > shotXgot(atKeeper) + 0.3, `corner ${best}`);
  assert.ok(best <= 1);
});

// A low drive at the middle of the wall: struck through the middle or
// over the top of the ball (lowAtWall's `top` 0..1).
function lowAtWall(kick: KickSetup, power: number, top = 0.5): Strike {
  const mid = kick.wall.men.reduce((s, m) => s + m, 0) / kick.wall.men.length;
  return {
    power,
    targetY:
      kick.spot.y +
      ((mid - kick.spot.y) * (GOAL_X - kick.spot.x)) /
        (kick.wall.x - kick.spot.x),
    contact: ballContact(0, -top),
  };
}
// Low strikes to try, softest first.
const LOW_TRIES = [0, 0.5, 1].flatMap((top) =>
  Array.from({ length: 13 }, (_, i) => ({ top, power: i * 0.05 }))
);
const always = (v: number) => () => v;

check('wall: a low drive slips under the jumping wall, not a standing one', () => {
  const rand = seeded(21);
  let under = 0;
  for (let i = 0; i < 20; i++) {
    const kick = makeKick(levelFor(0), rand);
    for (const { top, power } of LOW_TRIES) {
      const strike = lowAtWall(kick, power, top);
      // 0.5: the wall jumps (chance 0.85 at level 1), the keeper doesn't guess.
      const jumped = startPlay(kick, strike, steady);
      while (jumped.outcome === null) stepPlay(jumped, STEP);
      if (!jumped.underWall) continue;
      under++;
      assert.notEqual(jumped.outcome, 'wall');
      assert.ok(scoreGoal(jumped, 1).tags.includes('UNDER THE WALL'));
      // 0.99: the wall stays down and blocks the same shot.
      const stood = startPlay(kick, strike, always(0.99));
      assert.equal(stood.wall.jumpAt, Infinity);
      while (stood.outcome === null) stepPlay(stood, STEP);
      assert.equal(stood.outcome, 'wall');
      assert.equal(stood.blockedBy, 'wall');
      break;
    }
  }
  assert.ok(under >= 10, `low drives got under on ${under} of 20 kicks`);
});

check('wall: a man lying behind it stops the low drive', () => {
  const rand = seeded(21);
  let stopped = 0;
  for (let i = 0; i < 20; i++) {
    const base = makeKick(levelFor(0), rand);
    const kick = { ...base, wall: { ...base.wall, lyer: true } };
    for (const { top, power } of LOW_TRIES) {
      const strike = lowAtWall(base, power, top);
      const free = playOut(base, strike);
      if (!free.underWall) continue;
      const play = startPlay(kick, strike, always(0.99));
      assert.equal(play.wall.jumpAt, FK.wallReactSec, 'a wall with a lyer jumps');
      while (play.outcome === null) stepPlay(play, STEP);
      assert.equal(play.outcome, 'wall');
      assert.equal(play.blockedBy, 'lyer');
      assert.equal(play.underWall, false);
      stopped++;
      break;
    }
  }
  assert.ok(stopped >= 10);
});

check('variety: lyers and cheating keepers appear only as levels rise', () => {
  const rand = seeded(31);
  let lyers = 0;
  let cheats = 0;
  for (let i = 0; i < 200; i++) {
    assert.equal(makeKick(levelFor(0), rand).wall.lyer, false);
    const top = makeKick(levelFor(1000), rand);
    if (top.wall.lyer) lyers++;
    if (top.keeperStyle === 'cheat') cheats++;
  }
  assert.ok(lyers > 40 && lyers < 120, `${lyers} lyers in 200 top-level kicks`);
  assert.ok(cheats > 40 && cheats < 110, `${cheats} cheats in 200`);
});

check('keeper: a cheating keeper stands nearer the wall', () => {
  // The same spot: the cheat roll is the last one makeKick makes.
  const rolls = (cheat: boolean) => {
    const base = seeded(41);
    let n = 0;
    return () => (++n === 4 ? (cheat ? 0 : 0.99) : base());
  };
  const line = makeKick(levelFor(0), rolls(false));
  const cheat = makeKick(levelFor(0), rolls(true));
  assert.equal(line.keeperStyle, 'line');
  assert.equal(cheat.keeperStyle, 'cheat');
  assert.deepEqual(cheat.spot, line.spot);
  // Toward the near side (where the wall stands).
  assert.ok((cheat.keeperY - line.keeperY) * cheat.nearSide > 5);
});

check('keeper: a guessing keeper drifts to its corner before reading', () => {
  const kick = makeKick(levelFor(0), seeded(9));
  const open = { ...kick, wall: { ...kick.wall, men: [] } };
  // 0.01: it guesses (chance 0.1 at level 1), the -y corner.
  const play = startPlay(open, { power: 0.5, targetY: GOAL_Y, contact: centre }, always(0.01));
  const guess = play.keeper.guessY;
  assert.ok(guess !== null && guess < GOAL_Y);
  const from = play.keeper.y;
  while (play.t < play.keeper.readAt - STEP && play.outcome === null)
    stepPlay(play, STEP);
  assert.ok(play.keeper.y < from - 10, 'moved toward the guess');
});

check('keeper: higher levels allow for part of the curl', () => {
  const kick = makeKick(levelFor(0), seeded(9));
  const open = { ...kick, wall: { ...kick.wall, men: [] } };
  // A curler that bends well off its launch line but stays inside the posts.
  const keeperX = GOAL_X - FK.keeperLineOff;
  const strikes = Array.from({ length: 40 }, (_, i) => ({
    power: 0.5,
    targetY: GOAL_Y - POST_HALF + i * 8,
    contact: ballContact(1, 0),
  }));
  const strike = strikes.find((s) => {
    const c = crossing(strikeBall(kick.spot, s), keeperX);
    return c && Math.abs(c.y - GOAL_Y) < POST_HALF - 40 && Math.abs(c.y - s.targetY) > 40;
  });
  assert.ok(strike, 'a curler inside the posts');
  const real = crossing(strikeBall(kick.spot, strike), keeperX);
  assert.ok(real);
  const readAt = (curlRead: number) => {
    const setup = { ...open, level: { ...open.level, keeperCurlRead: curlRead } };
    const play = startPlay(setup, strike, steady);
    while (!play.keeper.read && play.outcome === null) stepPlay(play, STEP);
    return play.keeper.mode === 'dive' ? play.keeper.toY : play.keeper.y;
  };
  const blind = Math.abs(readAt(0) - real.y);
  const reading = Math.abs(readAt(0.6) - real.y);
  assert.ok(reading < blind - 5, `read ${reading} vs blind ${blind}`);
});


check('historical Play receipts remain readable and boards keep two independent bests', () => {
  const result={mode:'play',score:500,goals:2,shots:5,bestStreak:2,level:2,fastestGoalKmh:100,elapsedSec:20};
  assert.ok(readFreeKickStats(result));
  for(const change of [{mode:'practice'},{shots:4},{score:100000},{goals:0},{level:10},{fastestGoalKmh:freeKickMaxKmh+1},{elapsedSec:0},{bestStreak:3}]) assert.equal(readFreeKickStats({...result,...change}),null);
  // Great saves are extra shots that cost no life; xG must fit the shots.
  const xgRun={...result,shots:6,greatSaves:1,xg:60,elapsedSec:30};
  assert.deepEqual(readFreeKickStats(xgRun),{...xgRun});
  assert.equal(readFreeKickStats({...result})?.greatSaves,0,'older runs read as no great saves');
  for(const change of [{greatSaves:0},{xg:1},{xg:600},{score:2*freeKickGoalMax+21}]) assert.equal(readFreeKickStats({...xgRun,...change}),null);
  assert.ok(readFreeKickStats({...xgRun,score:2*freeKickGoalMax+20}));
  assert.equal(readFreeKickStats({...xgRun,score:2*freeKickGoalMin-1}),null);
  const board=rankFreeKicks([{member:'alice',score:400},{member:'alice',score:500},{member:'bob',score:500},{member:'zero',score:0}],'zero');
  assert.equal(board.top[0]?.username,'alice');
  assert.equal(board.top[1]?.username,'bob');
  assert.equal(board.me?.value,0);
});

check('challenge: won on the post goals, lost when the lives run out', () => {
  const config = { ...FREE_KICK_CHALLENGE_DEFAULT, goals: 3, lives: 2 };
  // Plays kicks (true = goal) until the challenge is decided.
  const run = (kicks: boolean[]) => {
    let goals = 0;
    let lives = config.lives;
    for (const goal of kicks) {
      assert.equal(challengeOutcome(goals, lives, config), 'open', 'already decided');
      if (goal) goals++;
      else lives--;
    }
    return challengeOutcome(goals, lives, config);
  };
  assert.equal(run([true, true, true]), 'won');
  assert.equal(run([false, true, true, true]), 'won');
  assert.equal(run([false, false]), 'lost');
  assert.equal(run([true, false, true, false]), 'lost');
  assert.equal(run([true, false, true]), 'open');
});

check('challenge settings: saved on the post, defaults for older posts', () => {
  const saved = { kicker: 'teal', wall: 'black', lives: 1, goals: 20, distanceM: 35, wallFromGoalM: 26, difficulty: 'pro' };
  assert.deepEqual(postFreeKickChallenge({ matchType: 'freekick', freeKick: saved }), saved);
  assert.deepEqual(postFreeKickChallenge({ matchType: 'freekick' }), FREE_KICK_CHALLENGE_DEFAULT);
  assert.deepEqual(postFreeKickChallenge({ freeKick: { ...saved, wallFromGoalM: 30 } }), FREE_KICK_CHALLENGE_DEFAULT);
  assert.equal(typeof parseFreeKickChallenge(FREE_KICK_CHALLENGE_DEFAULT), 'object');
});

check('challenge rounds: one level harder per round, within the difficulty', () => {
  for (const difficulty of DIFFICULTIES) {
    const [first, top] = FK.challengeLevels[difficulty];
    assert.equal(challengeRoundLevel(difficulty, 0), first);
    for (let round = 1; round < 15; round++) {
      const level = challengeRoundLevel(difficulty, round);
      assert.equal(level, Math.min(top, challengeRoundLevel(difficulty, round - 1) + 1), `${difficulty} round ${round}`);
    }
    assert.equal(challengeRoundLevel(difficulty, 99), top);
  }
});

check('challenge kicks: spots around the post distance from new angles, wall at its distance from goal', () => {
  const rand = seeded(11);
  for (const distanceM of FK.challengeDistanceChoicesM)
    for (const wallFromGoalM of FK.challengeWallChoicesM) {
      if (distanceM - wallFromGoalM < FK.challengeWallGapM) continue;
      const config = { ...FREE_KICK_CHALLENGE_DEFAULT, distanceM, wallFromGoalM };
      const angles = new Set<number>();
      for (let round = 0; round < 6; round++) {
        const kick = challengeKick(config, round, rand);
        const metres = kick.distance / FK.pxPerMetre;
        assert.ok(metres >= Math.max(FK.challengeNearestM, distanceM - FK.challengeDistanceRangeM) - 1e-9, `${distanceM} m: ${metres}`);
        assert.ok(metres <= Math.min(FK.maxDistance / FK.pxPerMetre, distanceM + FK.challengeDistanceRangeM) + 1e-9, `${distanceM} m: ${metres}`);
        assert.equal(kick.level.level, challengeRoundLevel(config.difficulty, round));
        // The wall: the post's distance from goal along the shot line, or
        // pulled toward goal to stay challengeWallGapM from the ball.
        const toGoal = Math.hypot(GOAL_X - kick.spot.x, GOAL_Y - kick.spot.y);
        const gap = ((kick.wall.x - kick.spot.x) / (GOAL_X - kick.spot.x)) * toGoal;
        const expected = Math.max(toGoal - wallFromGoalM * FK.pxPerMetre, FK.challengeWallGapM * FK.pxPerMetre);
        assert.ok(Math.abs(gap - expected) < 1e-6, `wall gap ${gap} vs ${expected}`);
        angles.add(Math.round(Math.atan2(kick.spot.y - GOAL_Y, GOAL_X - kick.spot.x) * 1000));
      }
      assert.ok(angles.size > 1, 'rounds come from different angles');
    }
});

check('aim: seen at an angle, the far half of the goal line is shorter on screen', () => {
  // The near post twice as close as the far one: the screen midpoint of the
  // line is a third of the way from the near post in the world.
  const a = { sx: 200, sy: 300, y: GOAL_Y - POST_HALF, d: 500 };
  const b = { sx: 500, sy: 300, y: GOAL_Y + POST_HALF, d: 1000 };
  const mid = aimAtGoalLine({ x: 350, y: 800 }, 0, -1, a, b);
  assert.ok(mid !== null);
  assert.ok(Math.abs(mid - (GOAL_Y - POST_HALF / 3)) < 1e-6, String(mid));
  // Beyond the far post it still runs out to the wide limit, never back.
  const wide = aimAtGoalLine({ x: 5000, y: 800 }, 0, -1, a, b);
  assert.equal(wide, GOAL_Y + 3 * POST_HALF);
});

check('swipe: a curved path curls the ball along it and still ends where it pointed', () => {
  // Up the screen, bulging to one side by `bulge` px at the middle.
  const arc = (bulge: number) =>
    Array.from({ length: 21 }, (_, i) => ({
      x: 300 + bulge * Math.sin((Math.PI * i) / 20),
      y: 900 - i * 15,
    }));
  assert.equal(swipeBow(arc(0)), 0);
  assert.ok(swipeBow(arc(-60)) < 0 && swipeBow(arc(60)) > 0);
  assert.equal(swipeBow(arc(-60)), -swipeBow(arc(60)), 'both sides read alike');
  const spot = { x: GOAL_X - 620, y: GOAL_Y + 60 };
  const base = { power: 0.7, targetY: GOAL_Y - 40, contact: ballContact(0, 0) };
  assert.equal(curvedStrike(spot, base, 0.01), base, 'a straight swipe is unchanged');
  for (const bulge of [-60, 60]) {
    const strike = curvedStrike(spot, base, swipeBow(arc(bulge)));
    const ball = strikeBall(spot, strike);
    const end = crossing(ball, GOAL_X);
    assert.ok(end && Math.abs(end.y - base.targetY) < 3, `ends at the aim (${end?.y})`);
    // Screen left is world +y: bulging left starts out left and curls right.
    assert.equal(Math.sign(strike.targetY - base.targetY), -Math.sign(bulge));
    assert.equal(Math.sign(ball.spin), Math.sign(bulge));
  }
});

check('challenge records: validate completed wins/losses against the post settings', () => {
  const config = {...FREE_KICK_CHALLENGE_DEFAULT, goals:3, lives:2};
  const win = {mode:'challenge',score:1200,goals:3,shots:4,bestStreak:2,level:challengeRoundLevel(config.difficulty,2),fastestGoalKmh:100,elapsedSec:30,greatSaves:0,xg:100};
  assert.ok(readFreeKickStats(win,config));
  assert.equal(readFreeKickStats(win),null);
  assert.equal(readFreeKickStats({...win,shots:5},config),null);
  assert.equal(readFreeKickStats({...win,level:10},config),null);
  const loss={...win,goals:1,shots:3,bestStreak:1,score:400,level:challengeRoundLevel(config.difficulty,1)};
  assert.ok(readFreeKickStats(loss,config));
  assert.equal(readFreeKickStats({...loss,shots:2},config),null);
  assert.equal(readFreeKickStats({...loss,greatSaves:1},config),null);
});

check('only Challenge and Practice remain registered Free Kick entries', () => {
  const entries=JSON.parse(readFileSync('devvit.json','utf8')).post.entrypoints;
  assert.equal(entries.freekick,undefined);
  assert.ok(entries['freekick-challenge']);assert.ok(entries['freekick-practice']);
});

console.log(`\n${passed} checks passed`);
