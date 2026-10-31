import { chaosRules, NORMAL_RULES, chaosLabel } from '../src/shared/chaos';
import { collideBall } from '../src/client/systems/ballPhysics';
import { stepPlayer, constrainMove } from '../src/client/systems/movement';
import {
  launchSpeedKmh,
  qualifyingGoal,
  goalStyle,
} from '../src/shared/goalSpeed';
import { gainBall } from '../src/client/systems/possession';
import { kickShot, kickPass } from '../src/client/systems/actions';
// Logic checks for the Phase 3 rules (tackles, keeper reaction, AI brain,
// pass weight): pure functions driven with hand-made players, no game and
// no browser. Run with `npm run test:logic` (bundles this file with rolldown,
// since the source imports have no file extensions, then runs it in node).
// Fake players / balls are plain objects with just the fields used.
import assert from 'node:assert/strict';
import {
  resolveTackle,
  startTackle,
  tacklePhase,
} from '../src/client/systems/tackle';
import {
  cpuKeeperReact,
  keeperStick,
  stepKeeperHands,
} from '../src/client/systems/keeper';
import { TeamBrain, interceptPoint } from '../src/client/systems/ai';
import {
  assistedShotDirection,
  idealPassWeight,
  passWeight,
} from '../src/client/systems/actions';
import {
  AI,
  FORMATIONS,
  KEEPER,
  LEVELS,
  PASS,
  PITCH,
  SHOOT,
  TACKLE,
} from '../src/shared/tuning';
import {
  DEFAULT_MATCH_CONFIG,
  parseMatchConfig,
} from '../src/shared/matchConfig';
import {
  CASUAL_OPTIONS,
  casualConfig,
  cycleOption,
  setCasualJersey,
} from '../src/shared/casual';
import { competitiveResultAllowed, postType } from '../src/shared/postType';
import { challengeFormFor } from '../src/server/core/challengeForm';
import { DIFFICULTIES } from '../src/shared/types';
import { readChallenge } from '../src/server/core/challengeForm';
import { postConfig, readStats } from '../src/server/core/matchStats';
import { scoreComment } from '../src/server/core/scoreComment';
import { MatchFlow } from '../src/client/systems/MatchFlow';

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log('ok  ' + name);
}

function player(o: Record<string, unknown>): any {
  return {
    x: 0,
    y: 0,
    z: 0,
    heading: 0,
    speed: 0,
    vx: 0,
    vy: 0,
    team: 'home',
    role: 'outfield',
    stamina: 100,
    sprinting: false,
    sprintLocked: false,
    controlled: false,
    receiving: false,
    holding: false,
    lockUntil: 0,
    tackleAt: -Infinity,
    tackleUntil: -Infinity,
    tackleDir: 0,
    tackleSprint: false,
    tackleDone: false,
    stumbling: false,
    jukeRef: null,
    staggerUntil: -Infinity,
    tackleReadyAt: 0,
    wantDir: 0,
    lying: false,
    diveUntil: 0,
    recoverUntil: 0,
    diveDir: 0,
    reactAt: -1,
    reactKind: '',
    jumpAt: -Infinity,
    jumpUntil: 0,
    jumpLandUntil: 0,
    blockAt: -Infinity,
    blockUntil: 0,
    blockTackle: false,
    diveAt: -Infinity,
    z: 0,
    holdTimer: 0,
    stopShot() {},
    playShoot() {},
    playTackle() {},
    playDive() {},
    playHurt() {},
    ...o,
  };
}
function ball(o: Record<string, unknown>): any {
  return {
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    spin: 0,
    dip: 0,
    owner: null,
    lastTouch: null,
    priority: null,
    priorityUntil: 0,
    inNet: 0,
    out: 0,
    get speed() {
      return Math.hypot(this.vx, this.vy);
    },
    ...o,
  };
}

// --- Tackles ---------------------------------------------------------------
check('tackle timeline: windup -> active -> recover -> none', () => {
  const p = player({});
  assert.equal(startTackle(p, 0, 10, null), true);
  assert.equal(tacklePhase(p, 10.05), 'windup');
  assert.equal(tacklePhase(p, 10.15), 'active');
  assert.equal(tacklePhase(p, 10.3), 'recover');
  assert.equal(tacklePhase(p, 10.61), 'none');
  assert.equal(
    startTackle(p, 0, 10.2, null),
    false,
    'no new tackle mid-tackle'
  );
});

function tackleSetup(rand: number, jukeTurn = 0, carrierHeading = Math.PI) {
  // Tackler at (100,100) lunging +x; carrier at (160,100) facing the tackler
  // (heading pi = front), ball between them at (130,100).
  const carrier = player({
    team: 'away',
    x: 160,
    y: 100,
    heading: carrierHeading,
    wantDir: Math.PI,
  });
  const b = ball({ x: 130, y: 100, owner: carrier });
  const p = player({ x: 100, y: 100 });
  startTackle(p, 0, 0, carrier);
  carrier.wantDir = Math.PI + jukeTurn;
  const r = resolveTackle(p, b, 0.15, () => rand);
  return { p, b, carrier, r };
}
check(
  'tackle from the front: won at a low roll, ball loose, carrier staggered',
  () => {
    const { p, b, carrier, r } = tackleSetup(0);
    assert.equal(r, 'won');
    assert.equal(b.owner, null);
    assert.equal(b.priority, p);
    assert.ok(carrier.staggerUntil > 0.15);
    assert.equal(p.stumbling, false);
  }
);
check('tackle from the front: 70% chance (fails at 0.71, wins at 0.69)', () => {
  assert.equal(tackleSetup(0.71).r, 'failed');
  assert.equal(tackleSetup(0.69).r, 'won');
});
check('tackle from behind: 25% chance', () => {
  // Carrier facing away from the tackler (heading 0 = +x).
  assert.equal(tackleSetup(0.24, 0, 0).r, 'won');
  assert.equal(tackleSetup(0.26, 0, 0).r, 'failed');
});
check('juke (stick turned > 90 deg since the start) always fails', () => {
  const { p, r } = tackleSetup(0, 2.2);
  assert.equal(r, 'failed');
  assert.equal(p.stumbling, true);
});
check(
  'no contact outside the arc / reach, and only one contact per tackle',
  () => {
    const carrier = player({ team: 'away', x: 100, y: 200 });
    const b = ball({ x: 100, y: 140, owner: carrier }); // 40 px away but 90 deg off the lunge
    const p = player({ x: 100, y: 100 });
    startTackle(p, 0, 0, carrier);
    assert.equal(
      resolveTackle(p, b, 0.15, () => 0),
      null
    );
    const s = tackleSetup(0.9);
    assert.equal(s.r, 'failed');
    assert.equal(
      resolveTackle(s.p, s.b, 0.16, () => 0),
      null
    );
  }
);
check("a teammate's ball is never contested", () => {
  const mate = player({ x: 160, y: 100 });
  const b = ball({ x: 130, y: 100, owner: mate });
  const p = player({ x: 100, y: 100 });
  startTackle(p, 0, 0, mate);
  assert.equal(
    resolveTackle(p, b, 0.15, () => 0),
    null
  );
});

// --- Keeper reaction (stage 6 fix) -----------------------------------------
check(
  'keeper: a shot after a carrier threat restarts the reaction time',
  () => {
    // Away keeper on its line; a home carrier close in its box.
    const k = player({
      team: 'away',
      role: 'keeper',
      x: PITCH.width - 50,
      y: PITCH.height / 2,
    });
    const carrier = player({ x: PITCH.width - 120, y: PITCH.height / 2 });
    const b = ball({
      x: PITCH.width - 110,
      y: PITCH.height / 2,
      owner: carrier,
    });
    const react = LEVELS.normal.keeperReactSec;
    cpuKeeperReact(k, b, 10, react, () => 0.5); // jitter 0
    assert.equal(k.reactKind, 'tackle', 'carrier at its feet: standing tackle');
    assert.ok(Math.abs(k.reactAt - (10 + react)) < 1e-9);
    // 0.3 s later the carrier shoots toward the top corner.
    b.owner = null;
    b.vx = 1100;
    b.vy = -600; // crosses the keeper about 33 px to its side, inside the post
    cpuKeeperReact(k, b, 10.3, react, () => 0.5);
    assert.equal(k.reactKind, 'dive', 'now a shot');
    assert.ok(Math.abs(k.reactAt - (10.3 + react)) < 1e-9, 'timer restarted');
    // Not diving yet at the old smother deadline.
    cpuKeeperReact(k, b, 10 + react + 0.01, react, () => 0.5);
    assert.equal(k.diveUntil, 0);
  }
);

check('keeper: reads a shot before side-stepping toward it', () => {
  const k = player({
    team: 'away',
    role: 'keeper',
    x: PITCH.width - 50,
    y: PITCH.height / 2,
  });
  const b = ball({
    x: PITCH.width - 450,
    y: PITCH.height / 2,
    vx: 1100,
    vy: 220, // crosses its line about 80 px to its side, inside the post
  });
  cpuKeeperReact(k, b, 10, LEVELS.normal.keeperReactSec, () => 0.5);
  assert.equal(k.reactKind, 'dive');
  assert.equal(keeperStick(k, b, [], [], 10).move.r, 0, 'still reading it');
  const step = keeperStick(k, b, [], [], 10 + KEEPER.shuffleDelay);
  assert.ok(step.move.r > 0 && step.move.y > 0, 'then side-steps toward it');
});

// --- Finishing assist ------------------------------------------------------
check(
  'shot assist: a shot at the keeper is pulled toward the open side',
  () => {
    const gy = PITCH.height / 2;
    const shooter = player({ x: PITCH.width - 300, y: gy - 40 });
    const k = player({
      team: 'away',
      role: 'keeper',
      x: PITCH.width - 60,
      y: gy,
    });
    const straight = { x: 1, y: 0, r: 1 }; // at the keeper's chest
    const cross = (aim: number) => shooter.y + 300 * Math.tan(aim);
    const mid = cross(assistedShotDirection(shooter, straight, k, () => 0.5));
    const low = cross(assistedShotDirection(shooter, straight, k, () => 0));
    const high = cross(assistedShotDirection(shooter, straight, k, () => 1));
    // The keeper sits slightly low as seen from the shooter: the open side is up.
    assert.ok(mid < shooter.y - 20, 'moved off the keeper toward the gap');
    assert.ok(high < mid && mid < low, 'more pull with a stronger roll');
    assert.ok(
      high > gy - PITCH.goalMouth / 2 + SHOOT.assistInset * 0.9,
      'still inside the post'
    );
    // Aimed clearly wide, or from long range: the stick is kept.
    const wide = { x: Math.cos(0.9), y: Math.sin(0.9), r: 1 };
    assert.ok(
      Math.abs(assistedShotDirection(shooter, wide, k, () => 0.5) - 0.9) < 1e-9
    );
    const far = player({ x: PITCH.width - SHOOT.assistRange - 50, y: gy });
    assert.equal(
      assistedShotDirection(far, straight, k, () => 0.5),
      0
    );
  }
);

check('keeper: a high ball straight at it is a jump, timed to meet it', () => {
  const k = player({
    team: 'away',
    role: 'keeper',
    x: PITCH.width - 40,
    y: PITCH.height / 2,
  });
  // Straight at the keeper, arriving about 110 high (over its standing
  // reach, under the jump reach), 0.6 s away.
  const b = ball({
    x: PITCH.width - 40 - 600,
    y: PITCH.height / 2,
    z: 110,
    vx: 1000,
    vz: 0.6 * 700,
  });
  const react = LEVELS.normal.keeperReactSec;
  cpuKeeperReact(k, b, 10, react, () => 0.5);
  assert.equal(k.reactKind, 'jump');
  // Reaction done but the ball still 0.6 s out: waits for it.
  cpuKeeperReact(k, b, 10 + react + 0.01, react, () => 0.5);
  assert.equal(k.jumpAt, -Infinity, 'too early to jump');
  // 0.2 s out: jumps (straight up, no dive).
  b.x = PITCH.width - 40 - 200;
  b.vz = 0.2 * 700;
  cpuKeeperReact(k, b, 10 + react + 0.02, react, () => 0.5);
  assert.ok(Math.abs(k.jumpAt - (10 + react + 0.02)) < 1e-9, 'jumped');
  assert.equal(k.diveUntil, 0, 'no dive');
});
check('keeper: a standing tackle takes a carrier ball in reach', () => {
  const k = player({
    team: 'away',
    role: 'keeper',
    x: PITCH.width - 60,
    y: PITCH.height / 2,
    blockAt: 5,
    blockUntil: 5 + KEEPER.blockSec,
    blockTackle: true,
  });
  const carrier = player({ x: PITCH.width - 110, y: PITCH.height / 2 });
  const b = ball({ x: PITCH.width - 95, y: PITCH.height / 2, owner: carrier });
  const event = stepKeeperHands(
    k,
    b,
    [],
    [carrier],
    5.1,
    1 / 60,
    () => 0.5,
    false
  );
  assert.equal(event, 'smothered');
  assert.equal(b.owner, k);
});

// --- Passing helpers --------------------------------------------------------
check(
  'weighted pass: tap is no charge, full hold is 1, ideal weights span 0..1',
  () => {
    assert.equal(passWeight(PASS.weightTapSec), 0);
    assert.equal(passWeight(PASS.weightChargeSec), 1);
    assert.equal(idealPassWeight(PASS.weightMinDist), 0);
    assert.equal(idealPassWeight(PASS.weightMaxDist), 1);
    assert.ok(idealPassWeight(300) < idealPassWeight(600));
  }
);

// --- Team brain (stage 6 fixes) ---------------------------------------------
function view(mates: any[], opponents: any[], b: any, human: any = null): any {
  return {
    mates,
    opponents,
    human,
    ball: b,
    oppKeeper: player({ team: 'away', role: 'keeper', x: 2360, y: 650 }),
    canTackle: true,
    rand: () => 0.5,
  };
}
function team(teamName: 'home' | 'away', xs: number[]) {
  return xs.map((x, i) => player({ team: teamName, x, y: 400 + i * 150 }));
}
check(
  'brain: no AI decisions for a ball the human controls (keeper included)',
  () => {
    const brain = new TeamBrain('home', LEVELS.normal);
    const mates = team('home', [500, 500, 800, 1100]);
    const opps = team('away', [1900, 1900, 1600, 1300]);
    const keeper = player({ role: 'keeper', x: 400, y: 650, controlled: true });
    const b = ball({ x: 410, y: 650, owner: keeper });
    brain.think(view(mates, opps, b), 1);
    assert.equal(brain.orders.get(keeper), undefined);
    for (let t = 1; t < 3; t += 0.05)
      assert.equal(brain.takeAction(t, b), null);
  }
);
check('brain: no chaser while the ball is out behind a goal', () => {
  const brain = new TeamBrain('home', LEVELS.normal);
  const mates = team('home', [500, 500, 800, 1100]);
  const opps = team('away', [1900, 1900, 1600, 1300]);
  const b = ball({ x: 2420, y: 600, out: 1 });
  brain.think(view(mates, opps, b), 1);
  for (const m of mates) assert.notEqual(brain.orders.get(m)?.role, 'chase');
  b.out = 0;
  b.x = 900;
  brain.wake();
  brain.think(view(mates, opps, b), 2);
  assert.equal(
    mates.filter((m) => brain.orders.get(m)?.role === 'chase').length,
    1
  );
});
check('brain: reset drops a queued pass / shot', () => {
  const brain = new TeamBrain('away', LEVELS.hard);
  const mates = team('away', [1900, 1900, 1600, 400]);
  const opps = team('home', [500, 500, 800, 1100]);
  // Away forward with the ball 250 px from our goal, nobody near: shoots.
  const c = mates[3];
  c.x = 250;
  c.y = 650;
  const b = ball({ x: 235, y: 650, owner: c });
  const v = view(mates, opps, b);
  v.oppKeeper = player({ role: 'keeper', x: 40, y: 650 });
  brain.think(v, 1);
  brain.reset();
  for (let t = 1; t < 3; t += 0.05) assert.equal(brain.takeAction(t, b), null);
  // Without the reset the same situation does produce an action.
  const brain2 = new TeamBrain('away', LEVELS.hard);
  brain2.think(v, 1);
  let got = null;
  for (let t = 1; t < 3 && !got; t += 0.05) got = brain2.takeAction(t, b);
  assert.ok(got, 'control case: an action is queued');
});
check('interceptPoint: a stopped ball is met where it lies', () => {
  const p = player({ x: 0, y: 0 });
  const r = interceptPoint(p, ball({ x: 330, y: 0 }));
  assert.equal(r.x, 330);
  assert.ok(r.t > 0.8 && r.t < 1.1);
});
check(
  'difficulty table: harder = quicker and sharper, never different physics',
  () => {
    const order = DIFFICULTIES.map((d) => LEVELS[d]);
    order.slice(1).forEach((level, i) => {
      const easier = order[i];
      assert.ok(easier, 'levels listed easiest first');
      assert.ok(easier.thinkSec > level.thinkSec);
      assert.ok(easier.keeperReactSec > level.keeperReactSec);
      assert.ok(easier.tackleChance < level.tackleChance);
      assert.ok(easier.keeperDiveError > level.keeperDiveError);
    });
    assert.ok(
      LEVELS.pro.keeperReactSec - KEEPER.reactJitter > 0,
      'the sharpest keeper still has a reaction time'
    );
    assert.ok(TACKLE.baseChance > 0 && TACKLE.baseChance < 1);
  }
);

// --- Defending (A recovery runs, B cover + hand-over, C show wide) ---------
// The home brain defends the goal at x = 0; the away carrier stands still
// (seen as it is: seenAgo returns itself). mates[3] is the outlet forward.
function carrierAt(x: number, y: number) {
  const c = player({ team: 'away', x, y, heading: Math.PI });
  c.seenAgo = () => c;
  return c;
}
function defend(mates: any[], c: any) {
  const brain = new TeamBrain('home', LEVELS.normal);
  const opps = [c, ...team('away', [1900, 1900, 1600])];
  const b = ball({ x: c.x - 20, y: c.y, owner: c });
  brain.think(view(mates, opps, b), 1);
  return brain;
}
function straightPress(c: any) {
  const gy = PITCH.height / 2;
  const len = Math.hypot(0 - c.x, gy - c.y);
  return {
    x: c.x + (-c.x / len) * AI.pressGapClose,
    y: c.y + ((gy - c.y) / len) * AI.pressGapClose,
  };
}
check(
  'defending C: the presser shows a wide carrier toward the touchline',
  () => {
    const gy = PITCH.height / 2;
    const c = carrierAt(900, gy - 420); // wide, upper side, well out
    const mates = team('home', [800, 300, 300, 1500]);
    mates[0].y = c.y + 60;
    const brain = defend(mates, c);
    const o = brain.orders.get(mates[0]);
    assert.equal(o?.role, 'press');
    const straight = straightPress(c);
    assert.ok(
      o!.y - straight.y > 30,
      `inside shoulder (${o!.y} vs ${straight.y})`
    );
    // In the box: straight goal-side again.
    const c2 = carrierAt(250, gy - 420);
    const m2 = team('home', [180, 600, 600, 1500]);
    m2[0].y = c2.y + 40;
    const o2 = defend(m2, c2).orders.get(m2[0]);
    assert.equal(o2?.role, 'press');
    assert.ok(Math.abs(o2!.y - straightPress(c2).y) < 1, 'no shift in the box');
  }
);
check('defending: AI players keep AI.mateMinGap apart (chaser exempt)', () => {
  // Three attackers bunched in front of our goal pull markers and zones
  // together; walk the defenders for 4 s and measure the gaps.
  const gy = PITCH.height / 2;
  const c = carrierAt(420, gy);
  const brain = new TeamBrain('home', LEVELS.normal);
  const opps = [
    c,
    ...team('away', [380, 380, 380]).map((o, i) => {
      o.y = gy - 60 + i * 60;
      o.seenAgo = () => o;
      return o;
    }),
  ];
  const mates = team('home', [250, 260, 270, 280]);
  mates.forEach((m, i) => (m.y = gy - 30 + i * 20));
  const b = ball({ x: c.x - 20, y: c.y, owner: c });
  const dt = 1 / 60;
  for (let t = 1; t < 5; t += dt) {
    brain.think(view(mates, opps, b), t);
    for (const m of mates) {
      const s = brain.steer(m, view(mates, opps, b));
      m.x += s.move.x * s.move.r * 250 * dt;
      m.y += s.move.y * s.move.r * 250 * dt;
    }
  }
  const bound = mates.filter((m) => {
    const role = brain.orders.get(m)?.role;
    return role !== 'press' && role !== 'chase';
  });
  for (const m of bound)
    for (const q of mates)
      if (q !== m)
        assert.ok(
          Math.hypot(q.x - m.x, q.y - m.y) > AI.mateMinGap - 15,
          `${Math.round(Math.hypot(q.x - m.x, q.y - m.y))} px apart`
        );
});
check('defending B: a backup covers behind the presser, goal-side', () => {
  const gy = PITCH.height / 2;
  const c = carrierAt(1000, gy);
  const mates = team('home', [900, 500, 500, 1500]);
  mates[0].y = gy;
  const brain = defend(mates, c);
  const press = brain.orders.get(mates[0]);
  assert.equal(press?.role, 'press');
  const backups = mates.filter((m) => brain.orders.get(m)?.role === 'backup');
  assert.equal(backups.length, 1);
  assert.notEqual(backups[0], mates[3], 'never the outlet forward');
  const bo = brain.orders.get(backups[0])!;
  assert.ok(
    bo.x < press!.x - 100,
    `behind the presser (${bo.x} vs ${press!.x})`
  );
  assert.ok(Math.abs(bo.y - gy) < 1, 'on the line to goal');
});
check('defending B+A: a beaten presser hands over and sprints back', () => {
  const gy = PITCH.height / 2;
  const c = carrierAt(1000, gy);
  const mates = team('home', [1080, 800, 400, 1500]);
  mates[0].y = gy; // got past: 80 px upfield of the carrier, only 80 px away
  mates[1].y = gy + 40; // goal-side, 200 px away
  const brain = defend(mates, c);
  assert.equal(
    brain.orders.get(mates[1])?.role,
    'press',
    'the goal-side one steps up'
  );
  const beaten = brain.orders.get(mates[0]);
  assert.notEqual(beaten?.role, 'press');
  assert.equal(beaten?.sprint, true, 'recovery run');
});
check('defending A: no recovery run for a goal-side defender', () => {
  const gy = PITCH.height / 2;
  const c = carrierAt(1000, gy);
  const mates = team('home', [900, 600, 600, 1500]);
  mates[0].y = gy;
  const brain = defend(mates, c);
  for (const m of mates.slice(1, 3))
    assert.equal(brain.orders.get(m)?.sprint, false);
});

// --- Custom match settings (moderator form -> postData -> game) ---

const formValues = (o: Record<string, unknown> = {}) => ({
  title: '  Comeback night ',
  description: '',
  homeName: ' red  devils ',
  homeJersey: ['red'],
  homeFormation: ['3-1'],
  awayName: 'CPU',
  awayJersey: ['black'],
  awayFormation: ['1-2-1'],
  difficulty: ['hard'],
  durationSec: ['300'],
  startGoalsAgainst: ['2'],
  ...o,
});
check('custom match: a valid form becomes a locked config', () => {
  const c = readChallenge(formValues(), parseMatchConfig);
  assert.ok(typeof c !== 'string', String(c));
  assert.equal(c.title, 'Comeback night');
  assert.deepEqual(c.config, {
    mode: 'competitive',
    difficulty: 'hard',
    durationSec: 300,
    startGoalsAgainst: 2,
    home: { name: 'RED DEVILS', jersey: 'red', formation: '3-1' },
    away: { name: 'CPU', jersey: 'black', formation: '1-2-1' },
    locked: true,
  });
  // What the client reads back from postData is the same config.
  assert.deepEqual(
    parseMatchConfig(JSON.parse(JSON.stringify(c.config))),
    c.config
  );
});
check('custom match: bad answers are rejected with a reason', () => {
  const bad: Record<string, unknown>[] = [
    { title: '   ' },
    { durationSec: ['330'] }, // over 5:00
    { durationSec: ['20'] }, // under 0:30
    { startGoalsAgainst: ['6'] },
    { homeName: 'TOO LONG NAME' },
    { awayName: 'émile' }, // the pixel font has no accents
    { awayJersey: ['red'] }, // same as home
    { homeJersey: ['green'] }, // a keeper colour
    { awayFormation: ['4-4-2'] },
    { difficulty: ['legend'] },
  ];
  for (const o of bad)
    assert.equal(
      typeof readChallenge(formValues(o), parseMatchConfig),
      'string',
      JSON.stringify(o)
    );
  assert.equal(typeof parseMatchConfig(undefined), 'string');
  assert.equal(typeof parseMatchConfig(DEFAULT_MATCH_CONFIG), 'object');
});
check('custom match: clock and score start from the settings', () => {
  const flow = new MatchFlow(120, { home: 0, away: 3 });
  assert.equal(flow.clock, 120);
  assert.deepEqual(flow.score, { home: 0, away: 3 });
  const plain = new MatchFlow();
  assert.deepEqual(plain.score, { home: 0, away: 0 });
});
check('formations: 4 spots in our half, outside the centre circle', () => {
  for (const [name, spots] of Object.entries(FORMATIONS)) {
    assert.equal(spots.length, 4, name);
    // The forward (last) is moved to the kickoff spot at every kickoff.
    for (const s of spots.slice(0, -1)) {
      assert.ok(s.x < PITCH.width / 2, `${name} in our half`);
      const d = Math.hypot(s.x - PITCH.width / 2, s.y - PITCH.height / 2);
      assert.ok(d > PITCH.centerCircle, `${name} outside the circle`);
    }
    assert.equal(spots[spots.length - 1]?.line, 'fwd', `${name} forward last`);
  }
});

// --- Match results (leaderboard) and the POST MY SCORE comment ---

const stats = (o: Record<string, unknown> = {}) => ({
  difficulty: 'easy',
  goalsFor: 3,
  goalsAgainst: 2,
  shots: 7,
  passes: 14,
  tacklesWon: 4,
  ...o,
});
check('results: a locked post forces its difficulty and head start', () => {
  const locked = readChallenge(formValues(), parseMatchConfig);
  assert.ok(typeof locked !== 'string');
  const config = postConfig({ match: locked.config, description: '' });
  assert.ok(config, 'locked postData reads back');
  const ok = readStats(stats(), config);
  assert.ok(typeof ok !== 'string');
  assert.equal(ok.difficulty, 'hard', "the post's level, not the client's");
  // The AI started 2 up: fewer than 2 against is impossible.
  assert.equal(typeof readStats(stats({ goalsAgainst: 1 }), config), 'string');
  assert.equal(postConfig({ match: DEFAULT_MATCH_CONFIG }), null, 'unlocked');
  assert.equal(postConfig(undefined), null);
});
check('results: junk and out-of-range numbers are rejected', () => {
  for (const o of [
    { goalsFor: -1 },
    { goalsFor: 1.5 },
    { shots: '7' },
    { goalsFor: 100 },
    { passes: 1000 },
    { difficulty: 'legend' },
  ])
    assert.equal(typeof readStats(stats(o), null), 'string', JSON.stringify(o));
  assert.equal(typeof readStats(null, null), 'string');
});
check('results: more goals than the match length allows are rejected', () => {
  // A default match: 90 s + 30 s golden goal, at least 4 s a goal = 30.
  assert.ok(typeof readStats(stats({ goalsFor: 30 }), null) !== 'string');
  assert.equal(typeof readStats(stats({ goalsFor: 31 }), null), 'string');
  assert.equal(typeof readStats(stats({ goalsAgainst: 31 }), null), 'string');
});
check('POST MY SCORE: comment text with and without stats', () => {
  const s = readStats(stats(), null);
  assert.ok(typeof s !== 'string');
  const both = scoreComment('  gg ', true, s, null);
  assert.ok(both.startsWith('gg\n\n'), both);
  assert.match(both, /Won 3-2.*Easy AI.*Shots 7.*Passes 14.*Tackles won 4/);
  assert.equal(scoreComment('gg', false, s, null), 'gg');
  assert.match(
    scoreComment('', true, s, null, 'kicker'),
    /^\*\*u\/kicker:\*\*\n\n/
  );
});

check(
  'post types: old challenges and install posts retain their entry flow',
  () => {
    assert.equal(
      postType({ match: { ...DEFAULT_MATCH_CONFIG, locked: true } }),
      'daily'
    );
    assert.equal(postType(undefined), 'classic');
    for (const type of ['daily', 'classic', 'casual'])
      assert.equal(postType({ matchType: type }), type);
  }
);
check(
  'Daily Challenge adds a template selector; both types save fixed matches',
  () => {
    const fields = (type: 'daily' | 'classic') =>
      challengeFormFor(type).fields.filter(
        (field) => field.type !== 'select' || field.name !== 'matchType'
      );
    assert.ok(
      fields('daily').some(
        (field) => field.type === 'select' && field.name === 'dailyMode'
      )
    );
    assert.equal(
      fields('classic').some(
        (field) => field.type === 'select' && field.name === 'dailyMode'
      ),
      false
    );
    for (const type of ['daily', 'classic']) {
      const result = readChallenge(
        formValues({ matchType: [type] }),
        parseMatchConfig
      );
      assert.ok(typeof result !== 'string');
      assert.equal(result.matchType, type);
      assert.equal(result.config.locked, true);
      assert.equal(result.config.mode, 'competitive');
    }
  }
);
check(
  'Casual posts need only title and description; reject invalid post types',
  () => {
    const result = readChallenge(
      { title: 'Free play', matchType: ['casual'] },
      parseMatchConfig
    );
    assert.ok(typeof result !== 'string');
    assert.equal(result.config.mode, 'casual');
    assert.equal(result.config.locked, false);
    assert.equal(result.config.startGoalsAgainst, 0);
    assert.equal(challengeFormFor('casual').fields.length, 3);
    assert.equal(
      typeof readChallenge(
        formValues({ matchType: ['unknown'] }),
        parseMatchConfig
      ),
      'string'
    );
  }
);
check(
  'Casual settings normalize persisted data and never inherit challenge advantages',
  () => {
    const result = casualConfig({
      ...DEFAULT_MATCH_CONFIG,
      difficulty: 'pro',
      durationSec: 300,
      locked: true,
      startGoalsAgainst: 5,
      home: { ...DEFAULT_MATCH_CONFIG.home, formation: '3-1' },
    });
    assert.equal(result.difficulty, 'pro');
    assert.equal(result.durationSec, 300);
    assert.equal(result.home.formation, '3-1');
    assert.equal(result.startGoalsAgainst, 0);
    assert.equal(result.locked, false);
    assert.equal(result.mode, 'casual');
    assert.equal(
      casualConfig({}).durationSec,
      DEFAULT_MATCH_CONFIG.durationSec
    );
    assert.equal(
      casualConfig({ ...DEFAULT_MATCH_CONFIG, durationSec: 31 }).durationSec,
      DEFAULT_MATCH_CONFIG.durationSec
    );
  }
);
check(
  'Casual selectors wrap through every premade option in both directions',
  () => {
    for (const choices of Object.values(CASUAL_OPTIONS)) {
      const values: readonly (string | number)[] = choices;
      const first = values[0]!;
      let value = first;
      for (const expected of values.slice(1)) {
        value = cycleOption(values, value, 1);
        assert.equal(value, expected);
      }
      assert.equal(cycleOption(values, value, 1), first);
      assert.equal(cycleOption(values, first, -1), values.at(-1));
    }
  }
);
check(
  'ranked result and sharing policy rejects Casual on every post type',
  () => {
    for (const type of ['daily', 'classic', 'casual']) {
      const post = { matchType: type };
      assert.equal(competitiveResultAllowed(post, { mode: 'casual' }), false);
      assert.equal(
        competitiveResultAllowed(post, { mode: 'competitive' }),
        type !== 'casual'
      );
      assert.equal(competitiveResultAllowed(post, {}), type !== 'casual');
      assert.equal(competitiveResultAllowed(post, { mode: 'unknown' }), false);
    }
    assert.equal(
      competitiveResultAllowed(undefined, {}),
      true,
      'legacy clients'
    );
    assert.equal(competitiveResultAllowed(undefined, null), false);
  }
);

check(
  'Casual kits: colour clashes swap teams and saved colours survive reload',
  () => {
    const initial = casualConfig();
    const swapped = setCasualJersey(initial, 'home', initial.away.jersey);
    assert.equal(swapped.home.jersey, 'blue');
    assert.equal(swapped.away.jersey, 'pink');
    const custom = setCasualJersey(
      setCasualJersey(swapped, 'home', 'orange'),
      'away',
      'teal'
    );
    assert.equal(casualConfig(custom).home.jersey, 'orange');
    assert.equal(casualConfig(custom).away.jersey, 'teal');
    assert.notEqual(custom.home.jersey, custom.away.jersey);
  }
);
check(
  'new kits validate and retired formation migrates for posts and Casual',
  () => {
    const result = readChallenge(
      formValues({
        homeJersey: ['orange'],
        awayJersey: ['teal'],
        homeFormation: ['1-3'],
        awayFormation: ['0-3-1'],
      }),
      parseMatchConfig
    );
    assert.ok(typeof result !== 'string');
    assert.equal(result.config.home.formation, '1-3');
    assert.equal(result.config.away.formation, '1-2-1');
    assert.equal(
      casualConfig({
        ...DEFAULT_MATCH_CONFIG,
        away: { ...DEFAULT_MATCH_CONFIG.away, formation: '0-3-1' },
      }).away.formation,
      '1-2-1'
    );
  }
);

check(
  'goal speed: sampled launch velocity survives flight, but not a new touch or pass',
  () => {
    const shooter = player({
      x: 2000,
      y: 715,
      heading: 0,
      team: 'home',
      controlled: true,
    });
    const b = ball({ x: 2010, y: 715, owner: shooter });
    kickShot(b, shooter, { x: 1, y: 0, r: 1 }, 0.7, [], () => 0.5);
    const launch = b.goalStrike;
    assert.equal(launch.human, true);
    assert.equal(launch.kmh, launchSpeedKmh(b.vx, b.vy, b.vz));
    b.vx *= 0.1;
    b.vz = 0;
    assert.equal(qualifyingGoal(b.goalStrike, 'home')?.kmh, launch.kmh);
    assert.equal(
      qualifyingGoal(b.goalStrike, 'away'),
      null,
      'own goals cannot qualify'
    );
    gainBall(b, shooter);
    assert.equal(
      b.goalStrike,
      null,
      'rebound possession cancels old attribution'
    );
    kickShot(b, shooter, { x: 1, y: 0, r: 1 }, 0.7, [], () => 0.5, {
      x: 0,
      y: -1,
    });
    assert.equal(goalStyle(b.goalStrike), 'CHIP');
    kickPass(b, shooter, player({ x: 2200, y: 715 }), [], () => 0.5);
    assert.equal(b.goalStrike, null, 'passes cannot inherit shot speed');
    assert.equal(qualifyingGoal(null, 'home'), null);
  }
);
check(
  'goal speed: server rejects invalid values and records without a scored shot; old clients work',
  () => {
    for (const fastestGoalKmh of [-1, 201, Infinity, NaN, 99.5, '100'])
      assert.equal(typeof readStats(stats({ fastestGoalKmh }), null), 'string');
    assert.equal(
      typeof readStats(stats({ fastestGoalKmh: 120, goalsFor: 0 }), null),
      'string'
    );
    assert.equal(
      typeof readStats(stats({ fastestGoalKmh: 120, shots: 0 }), null),
      'string'
    );
    const valid = readStats(stats({ fastestGoalKmh: 120 }), null);
    assert.ok(typeof valid !== 'string');
    assert.equal(valid.fastestGoalKmh, 120);
    const legacy = readStats(stats(), null);
    assert.ok(typeof legacy !== 'string');
    assert.equal(legacy.fastestGoalKmh, undefined);
  }
);

check(
  'Chaos creation percentages are validated and Casual strips rules',
  () => {
    for (const effect of ['power', 'slippery', 'goals']) {
      const raw = {
        ...DEFAULT_MATCH_CONFIG,
        dailyMode: 'chaos',
        chaosEffect: effect,
        chaosStrength: 100,
      };
      const parsed = parseMatchConfig(raw);
      assert.notEqual(typeof parsed, 'string');
      if (typeof parsed === 'string') throw new Error(parsed);
      const rules = chaosRules(parsed);
      assert.deepEqual(rules.pitch, PITCH);
      assert.equal(rules.power, 1);
      assert.equal(rules.movement, 1);
      assert.equal(rules.tackle, 1);
      assert.equal(casualConfig(parsed).chaosEffect, undefined);
      assert.equal(chaosRules(casualConfig(parsed)), NORMAL_RULES);
      for (const percent of [0, 49, 151, 100.5, '125'])
        assert.equal(
          typeof parseMatchConfig({ ...raw, chaosStrength: percent }),
          'string'
        );
    }
    assert.equal(
      typeof parseMatchConfig({
        ...DEFAULT_MATCH_CONFIG,
        dailyMode: 'chaos',
        chaosEffect: 'slippery',
        chaosStrength: 75,
      }),
      'string'
    );
  }
);
const makeChaos = (effect: 'power' | 'slippery' | 'goals', percent: number) =>
  chaosRules({
    dailyMode: 'chaos',
    chaosEffect: effect,
    chaosStrength: percent,
  });
check(
  'Chaos shot power scales the actual strike and leaves ordinary shots alone',
  () => {
    const fire = (percent: number) => {
      const rules = makeChaos('power', percent),
        p = player({ rules }),
        b = ball({ rules });
      kickShot(b, p, { x: 1, y: 0, r: 1 }, 0.7, [], () => 0.5);
      return b;
    };
    const base = fire(100),
      high = fire(150),
      low = fire(50);
    assert.equal(high.vx, base.vx * 1.5);
    assert.equal(high.vz, base.vz * 1.5);
    assert.equal(low.vx, base.vx * 0.5);
    assert.equal(
      chaosLabel({
        dailyMode: 'chaos',
        chaosEffect: 'power',
        chaosStrength: 125,
      }),
      'POWER SURGE 125%'
    );
  }
);
check(
  'Chaos slippery speed and contact reach increase equally for both teams',
  () => {
    for (const team of ['home', 'away']) {
      const base = player({ team, x: 500, y: 500 }),
        fast = player({
          team,
          x: 500,
          y: 500,
          rules: makeChaos('slippery', 150),
        });
      for (let i = 0; i < 30; i++) {
        stepPlayer(base, { x: 1, y: 0, r: 1 }, true, 1 / 60, false);
        stepPlayer(fast, { x: 1, y: 0, r: 1 }, true, 1 / 60, false);
      }
      assert.ok(Math.abs(fast.speed - base.speed * 1.5) < 0.00001);
    }
    const attempt = (percent: number) => {
      const carrier = player({
        team: 'away',
        x: TACKLE.reach * 1.2,
        heading: Math.PI,
      });
      const p = player({ rules: makeChaos('slippery', percent) }),
        b = ball({ x: carrier.x, owner: carrier });
      startTackle(p, 0, 10, carrier);
      return resolveTackle(p, b, 10.15, () => 0);
    };
    assert.equal(attempt(100), null);
    assert.equal(attempt(150), 'won');
  }
);
check(
  'Chaos resized opening, crossbar, end wall and player bounds agree',
  () => {
    const wide = makeChaos('goals', 150),
      small = makeChaos('goals', 50);
    assert.equal(wide.pitch.goalHeight, PITCH.goalHeight * 1.5);
    assert.equal(wide.pitch.endWallHeight, PITCH.endWallHeight * 1.5);
    assert.equal(wide.pitch.wallHeight, PITCH.wallHeight);
    const probe = (rules = NORMAL_RULES, y = PITCH.height / 2 + 190, z = 20) =>
      collideBall(ball({ rules, x: PITCH.width + 20, y, z, vx: 30 }));
    assert.equal(probe().goal, 0);
    assert.equal(probe(wide).goal, 1);
    assert.equal(probe(small, PITCH.height / 2 + 100).goal, 0);
    assert.equal(probe(wide, PITCH.height / 2, 140).goal, 1);
    assert.equal(probe(NORMAL_RULES, PITCH.height / 2, 140).out, 1);
    assert.equal(probe(NORMAL_RULES, 100, 170).out, 1);
    assert.equal(probe(wide, 100, 170).hitWall, true);
    const y = PITCH.height / 2 + 190;
    assert.ok(
      constrainMove(y, PITCH.width + 20, y, 10, wide.pitch)[0] > PITCH.width
    );
    assert.ok(constrainMove(y, PITCH.width + 20, y)[0] < PITCH.width);
    assert.deepEqual(chaosRules(DEFAULT_MATCH_CONFIG), NORMAL_RULES);
  }
);
check(
  'Chaos uses regulation-only Daily outcomes and legal boosted speed bounds',
  () => {
    const config = {
      ...DEFAULT_MATCH_CONFIG,
      dailyMode: 'chaos',
      chaosEffect: 'power',
      chaosStrength: 150,
    };
    const parsed = parseMatchConfig(config);
    if (typeof parsed === 'string') throw new Error(parsed);
    const flow = new MatchFlow(30, { home: 0, away: 0 }, 'chaos');
    flow.phase = 'live';
    flow.clockRunning = true;
    flow.tickClock(30);
    assert.equal(flow.goldenGoal, false);
    assert.equal(flow.phase, 'fulltime');
    const stats = {
      difficulty: 'normal',
      elapsedSec: parsed.durationSec,
      goalsFor: 2,
      goalsAgainst: 1,
      shots: 2,
      passes: 0,
      tacklesWon: 0,
      fastestGoalKmh: 260,
    };
    assert.notEqual(typeof readStats(stats, parsed), 'string');
    assert.equal(typeof readStats(stats, DEFAULT_MATCH_CONFIG), 'string');
  }
);
console.log(`\n${passed} checks passed`);
