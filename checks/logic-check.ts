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
import { cpuKeeperReact } from '../src/client/systems/keeper';
import { TeamBrain, interceptPoint } from '../src/client/systems/ai';
import { idealPassWeight, passWeight } from '../src/client/systems/actions';
import { LEVELS, PASS, PITCH, TACKLE } from '../src/shared/tuning';

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
    reactSmother: false,
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
  'keeper: a shot after a smother threat restarts the reaction time',
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
    assert.equal(k.reactSmother, true);
    assert.ok(Math.abs(k.reactAt - (10 + react)) < 1e-9);
    // 0.3 s later the carrier shoots toward the top corner.
    b.owner = null;
    b.vx = 1100;
    b.vy = -600; // crosses the keeper about 33 px to its side, inside the post
    cpuKeeperReact(k, b, 10.3, react, () => 0.5);
    assert.equal(k.reactSmother, false, 'now a shot');
    assert.ok(Math.abs(k.reactAt - (10.3 + react)) < 1e-9, 'timer restarted');
    // Not diving yet at the old smother deadline.
    cpuKeeperReact(k, b, 10 + react + 0.01, react, () => 0.5);
    assert.equal(k.diveUntil, 0);
  }
);

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
    const { easy, normal, hard } = LEVELS;
    assert.ok(
      easy.thinkSec > normal.thinkSec && normal.thinkSec > hard.thinkSec
    );
    assert.ok(
      easy.keeperReactSec > normal.keeperReactSec &&
        normal.keeperReactSec > hard.keeperReactSec
    );
    assert.ok(
      easy.tackleChance < normal.tackleChance &&
        normal.tackleChance < hard.tackleChance
    );
    assert.ok(TACKLE.baseChance > 0 && TACKLE.baseChance < 1);
  }
);

console.log(`\n${passed} checks passed`);
