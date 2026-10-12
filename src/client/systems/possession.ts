import { BALL, DRIBBLE, PLAYER, POSSESSION } from '../../shared/tuning';
import type { Ball } from '../entities/Ball';
import type { Player } from '../entities/Player';
import { DEG, clamp, lerp, rotateTowards } from './geometry';
import { inOwnBox } from './keeper';

export type PossessionEvents = {
  gained: Player | null; // took control this step
  lost: Player | null; // carrier lost the ball (it ran away from them)
  deflected: Player | null; // a fast ball bounced off this player
};

// Who has the ball, for one fixed step.
// - A carrier keeps it while it stays within the leash, dribbled in close
//   control (see dribble() below).
// - A loose ball goes to the nearest eligible player in reach: slow and low
//   enough = control; too fast = it deflects off them. The intended
//   receiver of a pass always controls it (automatic first touch), and the
//   passer's other teammates leave it to them while it travels.
// Keepers are handled by systems/keeper.ts.
export function stepPossession(
  ball: Ball,
  players: readonly Player[],
  time: number,
  dt: number
): PossessionEvents {
  const events: PossessionEvents = {
    gained: null,
    lost: null,
    deflected: null,
  };

  const owner = ball.owner;
  if (owner) {
    if (owner.role === 'keeper' && owner.holding) return events; // in the keeper's hands
    const dist = Math.hypot(ball.x - owner.x, ball.y - owner.y);
    if (dist > POSSESSION.leash || ball.inNet !== 0) {
      releaseBall(ball, owner, time);
      events.lost = owner;
    } else {
      dribble(ball, owner, dt);
      return events;
    }
  }

  if (ball.z > POSSESSION.maxControlHeight || ball.inNet !== 0) return events;
  let best: Player | null = null;
  let bestDist = Infinity;
  // A pass in flight is the receiver's: the passer's other teammates don't
  // cut it out (they move by themselves now and stood in its way), though
  // opponents can intercept.
  const passTo = players.find((q) => q.receiving);
  for (const p of players) {
    if (passTo && p !== passTo && p.team === passTo.team) continue;
    // A keeper inside its box uses its hands (systems/keeper.ts); outside, its feet.
    if ((p.role === 'keeper' && inOwnBox(p)) || time < p.lockUntil) continue;
    // Right after a won tackle only the tackler may take it.
    if (ball.priority && ball.priority !== p && time < ball.priorityUntil)
      continue;
    const reach =
      POSSESSION.controlRadius +
      (p.receiving ? POSSESSION.receiveBonusRadius : 0);
    const dist = Math.hypot(ball.x - p.x, ball.y - p.y);
    if (dist < reach && dist < bestDist) {
      best = p;
      bestDist = dist;
    }
  }
  if (!best) return events;

  if (ball.speed <= POSSESSION.maxControlSpeed || best.receiving) {
    gainBall(ball, best);
    events.gained = best;
  } else {
    deflect(ball, best);
    best.lockUntil = time + POSSESSION.regainLockSec;
    events.deflected = best;
  }
  return events;
}

// Takes control: the dribble starts from where the ball actually is, plus a
// little run-on for a fast ball, then eases into place (a cushioned first
// touch rather than a snap to the feet).
export function gainBall(ball: Ball, p: Player) {
  const dx = ball.x - p.x;
  const dy = ball.y - p.y;
  p.dribbleAngle = Math.atan2(dy, dx);
  p.dribbleDist =
    Math.hypot(dx, dy) +
    Math.min(DRIBBLE.cushionMax, ball.speed * DRIBBLE.cushionPerSpeed);
  ball.owner = p;
  ball.lastTouch = p;
  ball.z = 0;
  ball.vz = 0;
  ball.spin = 0;
  ball.dip = 0;
  p.receiving = false;
  p.touchTimer = 0;
}

// The carrier lets go (pass, shot, or lost it); they can't retouch it at once.
export function releaseBall(ball: Ball, p: Player, time: number) {
  if (ball.owner === p) ball.owner = null;
  p.lockUntil = time + POSSESSION.regainLockSec;
}

// A fast ball bounces off the player, keeping a fraction of its speed.
function deflect(ball: Ball, p: Player) {
  let nx = ball.x - p.x;
  let ny = ball.y - p.y;
  const d = Math.hypot(nx, ny);
  if (d === 0) {
    nx = -ball.vx;
    ny = -ball.vy;
  }
  const len = Math.hypot(nx, ny) || 1;
  nx /= len;
  ny /= len;
  const vn = ball.vx * nx + ball.vy * ny;
  if (vn < 0) {
    ball.vx -= 2 * vn * nx;
    ball.vy -= 2 * vn * ny;
  }
  ball.vx *= BALL.deflectKeep;
  ball.vy *= BALL.deflectKeep;
  ball.vz *= BALL.deflectKeep;
  ball.spin = 0;
  ball.dip = 0;
  ball.lastTouch = p;
}

// Close-control dribbling (FIFA-like). The ball's place is kept relative to
// the carrier as an angle and a distance:
// - distance: close to the feet when slow, further ahead when jogging, and
//   pushed out on sprint knock-ons; small rhythmic taps on top (smooth
//   out-and-back, no jolts). It eases to its target, which also cushions
//   the first touch when the ball arrives.
// - angle: follows the carrier's facing but turns at a limited rate, so on a
//   turn the ball is dragged round the player in an arc instead of cutting
//   through their body, and trails a little in fast turns.
// The ball's velocity is derived from its movement, so rolling frames,
// camera look-ahead and later tackles all see a real moving ball.
function dribble(ball: Ball, p: Player, dt: number) {
  const moving = p.speed > 20;
  const walkFrac = clamp(p.speed / PLAYER.walkWithBallSpeed, 0, 1);
  const base = p.sprinting
    ? DRIBBLE.sprintLead
    : lerp(DRIBBLE.closeLead, DRIBBLE.walkLead, walkFrac);
  const every = p.sprinting ? DRIBBLE.touchEverySprint : DRIBBLE.touchEveryWalk;
  p.touchTimer = moving ? (p.touchTimer + dt) % every : 0;
  const tap =
    (p.sprinting ? DRIBBLE.sprintTouch : DRIBBLE.walkTouch * walkFrac) *
    0.5 *
    (1 - Math.cos((2 * Math.PI * p.touchTimer) / every));

  p.dribbleAngle = rotateTowards(
    p.dribbleAngle,
    p.heading,
    DRIBBLE.swingRate * DEG * dt
  );
  p.dribbleDist +=
    (base + tap - p.dribbleDist) * (1 - Math.exp(-DRIBBLE.settleRate * dt));

  const nx = p.x + Math.cos(p.dribbleAngle) * p.dribbleDist;
  const ny = p.y + Math.sin(p.dribbleAngle) * p.dribbleDist;
  ball.vx = (nx - ball.x) / dt;
  ball.vy = (ny - ball.y) / dt;
  ball.x = nx;
  ball.y = ny;
  ball.z = 0;
  ball.vz = 0;
}
