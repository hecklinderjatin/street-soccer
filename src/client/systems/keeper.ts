import { rulesOf } from '../../shared/chaos';
import {
  BALL,
  KEEPER,
  PITCH,
  PLAYER,
  STICK,
  TACKLE,
} from '../../shared/tuning';
import type { Ball } from '../entities/Ball';
import type { Player } from '../entities/Player';
import { kickPass } from './actions';
import { interceptPoint } from './ai';
import type { StickInput } from './Controls';
import { clamp, distToSegment } from './geometry';

// Goalkeepers (both teams share this code; ours is AI-driven too whenever
// the human isn't controlling it):
// - keeperStick: where to stand or run: claim a loose ball it reaches
//   first, rush out at a carrier through on goal, otherwise narrow the
//   angle on the line from goal centre toward the ball;
// - cpuKeeperReact: after its reaction time, dive at a shot it can reach,
//   or at the feet of a carrier close in its box (smother);
// - stepKeeperHands: catch / parry / smother with its hands (only inside
//   its box), hold, then distribute: throw to an open teammate or punt.
// Every save comes from real contact: reach, timing and the dive.
export type KeeperEvent =
  'caught' | 'smothered' | 'parried' | 'thrown' | 'punted' | null;

export type KeeperSteer = { move: StickInput; sprint: boolean };

// What the AI keeper does about a threat: dive at a shot to its side, jump
// at a high one coming at it, dive at a carrier's feet (smother) or, right
// at its feet, a standing tackle.
type KeeperMove = 'dive' | 'jump' | 'smother' | 'tackle';

const STAND: KeeperSteer = { move: { x: 0, y: 0, r: 0 }, sprint: false };

// The keeper's own big box, where it may use its hands. Outside it the
// keeper is free to roam but plays the ball with its feet like anyone else.
function boxBounds(keeper: Player, inset: number) {
  const top = (PITCH.height - rulesOf(keeper).pitch.boxHeight) / 2 + inset;
  const bottom = (PITCH.height + rulesOf(keeper).pitch.boxHeight) / 2 - inset;
  const [minX, maxX] =
    keeper.team === 'home'
      ? [inset, PITCH.boxDepth - inset]
      : [PITCH.width - PITCH.boxDepth + inset, PITCH.width - inset];
  return { minX, maxX, top, bottom };
}

function inBox(keeper: Player, x: number, y: number, margin = 0) {
  const b = boxBounds(keeper, -margin);
  return x >= b.minX && x <= b.maxX && y >= b.top && y <= b.bottom;
}

export function inOwnBox(keeper: Player) {
  return inBox(keeper, keeper.x, keeper.y);
}

// A keeper holding the ball in its hands can't carry it out of the box.
export function keepInBox(keeper: Player) {
  const b = boxBounds(keeper, PLAYER.radius);
  keeper.x = Math.max(b.minX, Math.min(b.maxX, keeper.x));
  keeper.y = Math.max(b.top, Math.min(b.bottom, keeper.y));
}

// Where the keeper goes this step (when the human isn't controlling it):
// 1. Claim: a loose, not-too-fast ball it can meet in or near its box
//    sooner than any opponent (by KEEPER.claimMargin) and any teammate:
//    it sprints to the meeting point.
// 2. A shot (a fast free ball) heading for its goal: it sets itself,
//    side-stepping along its line toward where the ball will cross it at
//    a walk (KEEPER.shuffleStick) until its reaction dive (cpuKeeperReact).
//    Not at a sprint, and only once it has read the shot
//    (KEEPER.shuffleDelay after cpuKeeperReact first sees it): a
//    well-placed shot still beats it.
// 3. Rush out: an opposing carrier near goal with none of our outfielders
//    between it and the goal: it comes out toward the carrier (to
//    KEEPER.rushGap from it, at most KEEPER.rushMax off its line).
// 4. Otherwise it narrows the angle: on the bisector of the angle between
//    the ball and the two posts (both posts equally covered, so nearer the
//    near post when the ball is wide), further off the line the closer the
//    ball, within the mouth.
export function keeperStick(
  k: Player,
  ball: Ball,
  mates: readonly Player[],
  opponents: readonly Player[],
  time: number
): KeeperSteer {
  const gx = k.team === 'home' ? 0 : PITCH.width;
  const gy = PITCH.height / 2;

  if (
    !ball.owner &&
    ball.inNet === 0 &&
    ball.out === 0 &&
    ball.speed < KEEPER.setAbove
  ) {
    const meet = interceptPoint(k, ball);
    if (inBox(k, meet.x, meet.y, KEEPER.claimBoxMargin)) {
      const beats = (ps: readonly Player[], margin: number) =>
        ps.every((p) => meet.t + margin < interceptPoint(p, ball).t);
      if (beats(opponents, KEEPER.claimMargin) && beats(mates, 0))
        return toward(k, meet.x, meet.y, true);
    }
  }
  const halfMouth = rulesOf(k).pitch.goalMouth / 2;
  if (!ball.owner && ball.speed > KEEPER.setAbove) {
    // Where the ball will cross the keeper's line, if it is coming at the
    // goal (on target, or just wide); otherwise it holds.
    if (Math.abs(ball.vx) < 1 || Math.sign(k.x - ball.x) !== Math.sign(ball.vx))
      return STAND;
    const cross = ball.y + (ball.vy * (k.x - ball.x)) / ball.vx;
    if (Math.abs(cross - gy) > halfMouth + KEEPER.reactMargin) return STAND;
    if (time < k.shuffleAt) return STAND;
    const dy = clamp(cross, gy - halfMouth, gy + halfMouth) - k.y;
    if (Math.abs(dy) < 6) return STAND;
    return {
      move: {
        x: 0,
        y: Math.sign(dy),
        r: KEEPER.shuffleStick * Math.min(1, Math.abs(dy) / 40),
      },
      sprint: false,
    };
  }

  const c = ball.owner;
  if (c && c.team !== k.team && c.role !== 'keeper') {
    const dc = Math.hypot(c.x - gx, c.y - gy);
    const through = mates.every((m) => Math.hypot(m.x - gx, m.y - gy) > dc);
    if (dc < KEEPER.rushDist && through) {
      const out = clamp(dc - KEEPER.rushGap, KEEPER.lineOut, KEEPER.rushMax);
      const b = boxBounds(k, PLAYER.radius);
      return toward(
        k,
        clamp(gx + ((c.x - gx) / dc) * out, b.minX, b.maxX),
        clamp(gy + ((c.y - gy) / dc) * out, b.top, b.bottom),
        true
      );
    }
  }

  // The bisector meets the goal line where it splits the mouth in the ratio
  // of the ball's distances to the two posts (angle bisector theorem).
  const toTop = Math.hypot(ball.x - gx, ball.y - (gy - halfMouth));
  const toBottom = Math.hypot(ball.x - gx, ball.y - (gy + halfMouth));
  const ay =
    gy - halfMouth + (2 * halfMouth * toTop) / Math.max(1, toTop + toBottom);
  const bx = ball.x - gx;
  const by = ball.y - ay;
  const d = Math.hypot(bx, by);
  const near = clamp(
    (KEEPER.outFarDist - d) / (KEEPER.outFarDist - KEEPER.outNearDist),
    0,
    1
  );
  const out = KEEPER.lineOut + (KEEPER.maxOut - KEEPER.lineOut) * near;
  const ux = d > 1 ? Math.abs(bx) / d : 1; // always out into the pitch
  const uy = d > 1 ? by / d : 0;
  const tx =
    gx + (k.team === 'home' ? 1 : -1) * Math.max(KEEPER.lineOut, ux * out);
  const ty = clamp(ay + uy * out, gy - halfMouth, gy + halfMouth);
  return toward(k, tx, ty, false);
}

// Stick toward a point: slows as it arrives (no jitter), stops there.
function toward(k: Player, tx: number, ty: number, sprint: boolean) {
  const dx = tx - k.x;
  const dy = ty - k.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 6) return STAND;
  return {
    move: {
      x: dx / dist,
      y: dy / dist,
      r: sprint ? 1 : STICK.sprintAt * Math.min(1, dist / 40),
    },
    sprint: sprint && dist > 40,
  };
}

// A keeper's hands, for one step (only inside its own box). A ball it can
// reach is caught if slow; faster, it is caught or parried back into play
// by chance (KEEPER.catchSureBelow .. catchNoneAbove, less in a dive), one
// roll per touch (a parry locks the keeper out for a moment). Diving at an
// opposing carrier's feet with the ball in reach smothers it (the carrier
// staggers, as after a lost tackle). A held ball is distributed after
// KEEPER.holdSec (a human-controlled keeper decides itself, see
// MatchScene, and only auto-distributes after KEEPER.humanHoldMaxSec).
export function stepKeeperHands(
  keeper: Player,
  ball: Ball,
  teammates: readonly Player[],
  opponents: readonly Player[],
  time: number,
  dt: number,
  rand: () => number,
  humanControlled: boolean
): KeeperEvent {
  const outward = keeper.team === 'home' ? 1 : -1; // direction away from its own goal

  // At its feet (outside the box) the ball is dribbled like anyone's.
  if (ball.owner === keeper && !keeper.holding) return null;

  if (ball.owner === keeper) {
    keeper.holdTimer += dt;
    ball.x = keeper.x + outward * 14;
    ball.y = keeper.y + 2;
    ball.z = 36;
    ball.vx = ball.vy = ball.vz = 0;
    if (
      keeper.holdTimer <
      (humanControlled ? KEEPER.humanHoldMaxSec : KEEPER.holdSec)
    )
      return null;
    return distribute(keeper, ball, teammates, opponents, time, rand);
  }

  if (time < keeper.lockUntil || ball.inNet !== 0 || !inOwnBox(keeper))
    return null;
  const dist = Math.hypot(ball.x - keeper.x, ball.y - keeper.y);
  const diving = time < keeper.diveUntil;

  const jumping = time < keeper.jumpUntil;
  const standTackle = time < keeper.blockUntil && keeper.blockTackle;

  const carrier = ball.owner;
  if (carrier) {
    if (
      !(diving || standTackle) ||
      carrier.team === keeper.team ||
      carrier.holding ||
      dist > (diving ? KEEPER.diveReach : KEEPER.standTackleReach)
    )
      return null;
    carrier.staggerUntil = time + TACKLE.staggerSec;
    carrier.playHurt(time, carrier.heading);
    carrier.lockUntil = time + TACKLE.staggerSec;
    carrier.receiving = false;
    take(ball, keeper);
    return 'smothered';
  }

  const reach = diving
    ? KEEPER.diveReach
    : jumping
      ? KEEPER.jumpReach
      : KEEPER.reach;
  const reachHeight = diving
    ? diveReachHeight(keeper, time)
    : jumping
      ? jumpReachHeight(keeper, time)
      : KEEPER.standReachHeight;
  if (dist > reach || ball.z > reachHeight) return null;
  // A save made standing shows the block pose.
  const standing = !diving && !jumping;

  // Slow balls are always caught; faster, the catch gets less likely (and
  // less again in a dive) and the rest are parried: rebounds.
  const catchChance =
    ball.speed <= KEEPER.catchSureBelow
      ? 1
      : clamp(
          (KEEPER.catchNoneAbove - ball.speed) /
            (KEEPER.catchNoneAbove - KEEPER.catchSureBelow),
          0,
          1
        ) * (diving ? KEEPER.diveCatchFactor : 1);
  if (catchChance < 1 && rand() >= catchChance) {
    const angle = (outward > 0 ? 0 : Math.PI) + (rand() - 0.5) * 1.4;
    const speed = ball.speed * KEEPER.parryKeep;
    ball.vx = Math.cos(angle) * speed;
    ball.vy = Math.sin(angle) * speed;
    ball.vz = Math.max(ball.vz, 140);
    ball.spin = 0;
    ball.dip = 0;
    ball.lastTouch = keeper;
    ball.goalStrike = null;
    keeper.lockUntil = time + KEEPER.lockAfterSec;
    if (standing) startBlock(keeper, time, false);
    return 'parried';
  }

  take(ball, keeper);
  if (standing) startBlock(keeper, time, false);
  return 'caught';
}

function take(ball: Ball, keeper: Player) {
  ball.owner = keeper;
  ball.lastTouch = keeper;
  ball.goalStrike = null;
  ball.spin = 0;
  ball.dip = 0;
  keeper.holdTimer = 0;
  keeper.holding = true;
}

// Out of the hands: a throw to the best open teammate (open, a safe lane,
// further upfield; the normal pass, lofted), or a long punt upfield toward
// the most advanced teammate's side when nobody is open enough.
function distribute(
  keeper: Player,
  ball: Ball,
  teammates: readonly Player[],
  opponents: readonly Player[],
  time: number,
  rand: () => number
): KeeperEvent {
  const outward = keeper.team === 'home' ? 1 : -1;
  let best: Player | null = null;
  let bestScore = -Infinity;
  let front: Player | null = null;
  for (const t of teammates) {
    if (t.role === 'keeper') continue;
    if (!front || (t.x - front.x) * outward > 0) front = t;
    const d = Math.hypot(t.x - keeper.x, t.y - keeper.y);
    if (d < KEEPER.throwMinDist || d > KEEPER.throwMaxDist) continue;
    let near = Infinity;
    let lane = Infinity;
    for (const o of opponents) {
      near = Math.min(near, Math.hypot(o.x - t.x, o.y - t.y));
      lane = Math.min(
        lane,
        distToSegment(o.x, o.y, keeper.x, keeper.y, t.x, t.y)
      );
    }
    const score =
      0.5 * clamp(near / KEEPER.throwOpenDist, 0, 1) +
      0.35 * clamp(lane / 60, 0, 1) +
      0.25 * clamp(((t.x - keeper.x) * outward) / 800, 0, 1) +
      0.1 * rand();
    if (score > bestScore) {
      best = t;
      bestScore = score;
    }
  }

  ball.owner = null;
  ball.lastTouch = keeper;
  ball.goalStrike = null;
  keeper.holdTimer = 0;
  keeper.holding = false;
  keeper.lockUntil = time + KEEPER.lockAfterSec;
  if (best && bestScore >= KEEPER.throwMinScore) {
    kickPass(ball, keeper, best, opponents, rand);
    ball.vz = KEEPER.throwLift;
    return 'thrown';
  }
  const tx = clamp(keeper.x + outward * 1100, 0, PITCH.width);
  const ty = front ? front.y : PITCH.height / 2;
  const angle = Math.atan2(ty - ball.y, tx - ball.x);
  ball.vx = Math.cos(angle) * KEEPER.puntSpeed * rulesOf(keeper).power;
  ball.vy = Math.sin(angle) * KEEPER.puntSpeed * rulesOf(keeper).power;
  ball.vz = KEEPER.puntLift * rulesOf(keeper).power;
  ball.spin = 0;
  ball.dip = 0;
  return 'punted';
}

// Keeper reactions (whenever the human isn't controlling it), after its
// reaction time `reactSec` (LEVELS.keeperReactSec, +- KEEPER.reactJitter):
// - a shot heading for its goal: a dive toward where the ball will pass
//   it, only as far as needed. Only what it can reach in the time left gets
//   saved, so a fast shot placed toward a corner beats it and a slow or
//   central one doesn't. The prediction is a straight line with gravity
//   (no curl), so a late-bending curler can fool it.
// - a carrier close in its box (KEEPER.smotherRange): a dive at the ball's
//   coming position (smother, see stepKeeperHands). Dribbling round it or
//   shooting first beats it.
// Either dive's length is off by up to `diveError` (by difficulty), so a
// weaker keeper sometimes dives short or past the ball.
export function cpuKeeperReact(
  keeper: Player,
  ball: Ball,
  time: number,
  reactSec: number,
  rand: () => number,
  diveError = 0 // px the dive may fall short or overshoot by (LEVELS.keeperDiveError)
) {
  const target = keeperThreat(keeper, ball, time);
  if (!target) {
    keeper.reactAt = -1;
    return;
  }
  // A new threat, or a different kind (the carrier it was setting itself
  // to smother shoots): the reaction time starts again, so a close-range
  // shot doesn't inherit a half-run smother countdown.
  if (keeper.reactAt < 0 || keeper.reactKind !== target.kind) {
    keeper.reactKind = target.kind;
    keeper.reactAt = time + reactSec + (rand() * 2 - 1) * KEEPER.reactJitter;
    keeper.shuffleAt = time + KEEPER.shuffleDelay;
    return;
  }
  if (time < keeper.reactAt) return;
  // Ready to jump: wait until the ball is close enough for the top of the
  // jump to meet it.
  if (target.kind === 'jump' && target.t > KEEPER.jumpLead) return;
  keeper.reactAt = -1;
  if (target.kind === 'jump') startJump(keeper, time);
  else if (target.kind === 'tackle') startBlock(keeper, time, true);
  else
    startDive(
      keeper,
      target.dir,
      time,
      target.dist + (rand() * 2 - 1) * diveError
    );
}

// What the keeper would do now (KeeperMove), with the dive's direction and
// distance and the time until the ball arrives, or null.
function keeperThreat(
  keeper: Player,
  ball: Ball,
  time: number
): { kind: KeeperMove; dir: number; dist: number; t: number } | null {
  if (
    time < keeper.recoverUntil ||
    time < keeper.jumpLandUntil ||
    time < keeper.blockUntil ||
    ball.inNet !== 0
  )
    return null;
  const c = ball.owner;
  if (c) {
    if (c.team === keeper.team || c.holding || !inOwnBox(keeper)) return null;
    if (!inBox(keeper, ball.x, ball.y)) return null;
    // Where the ball will be as the dive gets there.
    const bx = ball.x + ball.vx * 0.15;
    const by = ball.y + ball.vy * 0.15;
    const d = Math.hypot(bx - keeper.x, by - keeper.y);
    if (d > KEEPER.smotherRange) return null;
    return {
      kind: d <= KEEPER.standTackleRange ? 'tackle' : 'smother',
      dir: Math.atan2(by - keeper.y, bx - keeper.x),
      dist: d,
      t: 0,
    };
  }
  const goalX = keeper.team === 'home' ? 0 : PITCH.width;
  const t =
    Math.abs(ball.vx) > KEEPER.reactMinSpeed &&
    Math.sign(goalX - ball.x) === Math.sign(ball.vx)
      ? (keeper.x - ball.x) / ball.vx
      : -1;
  if (t <= 0 || t > KEEPER.reactHorizonSec) return null;
  // Where and how high the ball passes the keeper.
  const y = ball.y + ball.vy * t;
  const z = ball.z + ball.vz * t - 0.5 * BALL.gravity * (1 + ball.dip) * t * t;
  const mouthTop = (PITCH.height - rulesOf(keeper).pitch.goalMouth) / 2;
  const mouthBottom = (PITCH.height + rulesOf(keeper).pitch.goalMouth) / 2;
  const onTarget =
    y > mouthTop - KEEPER.reactMargin && y < mouthBottom + KEEPER.reactMargin;
  const offset = y - keeper.y;
  if (!onTarget) return null;
  // Coming at it: no dive needed; a jump if it is too high to reach standing.
  if (Math.abs(offset) < KEEPER.reach * 0.7) {
    if (z <= KEEPER.standReachHeight || z > KEEPER.jumpReachHeight) return null;
    return { kind: 'jump', dir: 0, dist: 0, t };
  }
  if (z > KEEPER.reachHeight) return null;
  return {
    kind: 'dive',
    dir: offset < 0 ? -Math.PI / 2 : Math.PI / 2,
    dist: Math.abs(offset) - KEEPER.diveReach / 2,
    t,
  };
}

// How high a diving keeper reaches: KEEPER.reachHeight on a short dive,
// down to KEEPER.stretchReachHeight at full stretch (a full-length dive), so
// a ball into the top corner beats a keeper who has to go all the way across.
function diveReachHeight(keeper: Player, time: number) {
  const stretch = clamp((time - keeper.diveAt) / KEEPER.diveSec, 0, 1);
  return (
    KEEPER.reachHeight +
    (KEEPER.stretchReachHeight - KEEPER.reachHeight) * stretch
  );
}

// How high a jumping keeper reaches: from its standing reach up to
// KEEPER.jumpReachHeight at the top of the jump and back.
function jumpReachHeight(keeper: Player, time: number) {
  const p = clamp((time - keeper.jumpAt) / KEEPER.jumpSec, 0, 1);
  return (
    KEEPER.standReachHeight +
    (KEEPER.jumpReachHeight - KEEPER.standReachHeight) * Math.sin(Math.PI * p)
  );
}

// Starts a jump save: straight up (reach above the standing reach), then a
// short landing. Not while diving, down, or already jumping.
export function startJump(keeper: Player, time: number) {
  if (time < keeper.recoverUntil || time < keeper.jumpLandUntil) return;
  keeper.jumpAt = time;
  keeper.jumpUntil = time + KEEPER.jumpSec;
  keeper.jumpLandUntil = keeper.jumpUntil + KEEPER.jumpLandSec;
  keeper.stopShot();
}

// The block pose: after a standing save, or as a standing tackle
// (`tackle`: it takes a carrier's ball in reach, see stepKeeperHands).
export function startBlock(keeper: Player, time: number, tackle: boolean) {
  keeper.blockAt = time;
  keeper.blockUntil = time + KEEPER.blockSec;
  keeper.blockTackle = tackle;
  keeper.stopShot();
}

// Starts a dive: a short lunge (with extended reach), then a moment down on
// the ground. Movement during both is applied by stepKeeperBody().
// `distance` (optional) shortens the dive to just what is needed, so an
// aimed dive stops at the ball instead of flying past it.
export function startDive(
  keeper: Player,
  direction: number,
  time: number,
  distance?: number
) {
  if (time < keeper.recoverUntil) return;
  const full = KEEPER.diveSpeed * KEEPER.diveSec;
  const sec =
    distance === undefined
      ? KEEPER.diveSec
      : (Math.min(full, Math.max(0, distance)) / full) * KEEPER.diveSec;
  keeper.diveDir = direction;
  keeper.diveAt = time;
  keeper.diveUntil = time + Math.max(0.08, sec);
  keeper.recoverUntil = keeper.diveUntil + KEEPER.diveRecoverSec;
  keeper.playDive();
}

// While diving or down, the dive overrides normal movement. Returns true if
// it did (the caller then skips the stick for this keeper).
export function stepKeeperBody(keeper: Player, time: number, dt: number) {
  // Jumping (and landing): straight up and down, no running.
  if (time < keeper.jumpLandUntil) {
    const p = (time - keeper.jumpAt) / KEEPER.jumpSec;
    keeper.z = p < 1 ? 4 * KEEPER.jumpHeight * p * (1 - p) : 0;
    keeper.speed = 0;
    keeper.lying = false;
    return true;
  }
  keeper.z = 0;
  // The block pose is made standing still.
  if (time < keeper.blockUntil) {
    keeper.speed = 0;
    keeper.lying = false;
    return true;
  }
  keeper.lying = time < keeper.recoverUntil;
  if (!keeper.lying) return false;
  const diving = time < keeper.diveUntil;
  keeper.speed = diving ? KEEPER.diveSpeed : 0;
  keeper.heading = keeper.diveDir;
  if (diving) {
    keeper.x += Math.cos(keeper.diveDir) * KEEPER.diveSpeed * dt;
    keeper.y += Math.sin(keeper.diveDir) * KEEPER.diveSpeed * dt;
  }
  return true;
}
