import { TACKLE } from '../../shared/tuning';
import type { Ball } from '../entities/Ball';
import type { Player } from '../entities/Player';
import { DEG, angleDiff, clamp } from './geometry';

// Tackles, for the human (B1 without the ball) and the AI alike.
// Timeline from the start: start-up (TACKLE.windupSec, the player slows),
// lunge (activeSec, TACKLE.lungeDist covered along tackleDir; contact
// counts only now), then recovery (recoverSec). One contact per tackle:
// an opposing carrier's ball within TACKLE.reach and TACKLE.arcDeg of the
// lunge direction. Then a success chance decides:
//   base 55%, +15% from the carrier's front or side / -30% from behind,
//   -15% if the carrier is sprinting, +10% if the tackler went in at a
//   sprint; and if the carrier's stick turned more than 120 degrees since
//   the tackle started (a juke), it always fails.
// Win: the ball is knocked loose, nudged onto the tackler's path just ahead
// (still sliding from the lunge, it usually collects it), the carrier staggers (no moving,
// no touching the ball) and the tackler has first touch for a moment.
// Fail: the tackler stumbles (down, drawn on its side).
export type TacklePhase = 'none' | 'windup' | 'active' | 'recover';
export type TackleResult = 'won' | 'failed' | null;

export function tacklePhase(p: Player, time: number): TacklePhase {
  if (time >= p.tackleUntil) return 'none';
  const since = time - p.tackleAt;
  if (since < TACKLE.windupSec) return 'windup';
  if (since < TACKLE.windupSec + TACKLE.activeSec && !p.tackleDone)
    return 'active';
  return 'recover';
}

export function canTackle(p: Player, time: number) {
  return time >= p.tackleUntil && time >= p.staggerUntil && !p.holding;
}

// Starts a tackle along `dir` (the stick, the facing, or for the AI at the
// ball). `carrier` is whoever has the ball now (for the juke check).
export function startTackle(
  p: Player,
  dir: number,
  time: number,
  carrier: Player | null
) {
  if (!canTackle(p, time)) return false;
  p.tackleAt = time;
  p.tackleDir = dir;
  p.tackleSprint = p.sprinting;
  p.tackleDone = false;
  p.stumbling = false;
  p.tackleUntil =
    time + TACKLE.windupSec + TACKLE.activeSec + TACKLE.recoverSec;
  p.jukeRef = carrier && carrier.team !== p.team ? carrier.wantDir : null;
  p.playShoot(); // the strike animation reads as a poke at the ball
  return true;
}

// The lunge moves the body directly (like a keeper's dive). Returns true
// when it did; in the other phases the caller steps the player with a
// centred stick (it slows down and stands).
export function stepLunge(p: Player, time: number, dt: number) {
  p.lying = time < p.tackleUntil && p.stumbling;
  if (tacklePhase(p, time) !== 'active') return false;
  const speed = TACKLE.lungeDist / TACKLE.activeSec;
  p.heading = p.tackleDir;
  p.speed = speed;
  p.x += Math.cos(p.tackleDir) * speed * dt;
  p.y += Math.sin(p.tackleDir) * speed * dt;
  return true;
}

// Contact check for a lunging player; resolves the tackle on contact.
export function resolveTackle(
  p: Player,
  ball: Ball,
  time: number,
  rand: () => number
): TackleResult {
  if (tacklePhase(p, time) !== 'active') return null;
  const carrier = ball.owner;
  if (!carrier || carrier.team === p.team || carrier.holding) return null;
  const dx = ball.x - p.x;
  const dy = ball.y - p.y;
  if (Math.hypot(dx, dy) > TACKLE.reach) return null;
  if (
    Math.abs(angleDiff(Math.atan2(dy, dx), p.tackleDir)) >
    TACKLE.arcDeg * DEG
  )
    return null;

  p.tackleDone = true;
  const juked =
    p.jukeRef !== null &&
    Math.abs(angleDiff(carrier.wantDir, p.jukeRef)) > TACKLE.jukeDeg * DEG;
  const fromFront =
    Math.abs(
      angleDiff(Math.atan2(p.y - carrier.y, p.x - carrier.x), carrier.heading)
    ) <=
    TACKLE.frontArcDeg * DEG;
  const chance = clamp(
    TACKLE.baseChance +
      (fromFront ? TACKLE.frontBonus : -TACKLE.behindPenalty) -
      (carrier.sprinting ? TACKLE.carrierSprintPenalty : 0) +
      (p.tackleSprint ? TACKLE.tacklerSprintBonus : 0),
    0,
    1
  );
  if (juked || rand() >= chance) {
    p.tackleUntil = time + TACKLE.stumbleSec;
    p.stumbling = true;
    p.diveDir = p.tackleDir; // drawn on its side, falling that way
    return 'failed';
  }

  // Won: knocked loose, nudged toward a point just ahead on the lunge
  // line, where the sliding tackler arrives (first touch is theirs for a
  // moment). Popping it along the lunge sent it away from the tackler (to
  // the carrier's teammates); a random side often took it out of reach.
  const side = Math.atan2(
    p.y + Math.sin(p.tackleDir) * TACKLE.popAhead - ball.y,
    p.x + Math.cos(p.tackleDir) * TACKLE.popAhead - ball.x
  );
  ball.owner = null;
  ball.lastTouch = p;
  ball.vx = Math.cos(side) * TACKLE.popSpeed;
  ball.vy = Math.sin(side) * TACKLE.popSpeed;
  ball.vz = 0;
  ball.spin = 0;
  ball.dip = 0;
  ball.priority = p;
  ball.priorityUntil = time + TACKLE.priorityTackleSec;
  carrier.staggerUntil = time + TACKLE.staggerSec;
  carrier.lockUntil = time + TACKLE.staggerSec;
  carrier.receiving = false;
  p.tackleUntil = time + TACKLE.winRecoverSec;
  p.stumbling = false;
  return 'won';
}
