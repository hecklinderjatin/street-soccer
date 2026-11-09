import { rulesOf } from '../../shared/chaos';
import { DRIBBLE, TACKLE } from '../../shared/tuning';
import type { Ball } from '../entities/Ball';
import type { Player } from '../entities/Player';
import { DEG, angleDiff, clamp, lerp } from './geometry';

// Tackles, for the human (B1 without the ball) and the AI alike, of two
// kinds: a slide (TACKLE) and, with the ball close, a standing poke
// (TACKLE.poke: the same timeline and checks, quicker and shorter).
// Timeline from the start: start-up (windupSec, the player slows), lunge
// (activeSec, lungeDist covered along tackleDir; contact counts only now),
// then recovery (recoverSec). One contact per tackle: an opposing carrier's
// ball within reach and arcDeg of the lunge direction. Then one roll
// against a success chance decides:
//   base 55% (slide) / 50% (poke), +15% from the carrier's front or side /
//   -30% from behind, -15% if the carrier is sprinting, +10% for a slide
//   at a sprint, up to +20% with the carrier's ball knocked away from its
//   feet (time it on a heavy touch); and if the carrier's stick turned more
//   than 90 degrees since the tackle started (a juke), it always fails.
// Won with a low roll is a clean win, a narrow one knocks the ball loose:
// - slide: clean = nudged onto the tackler's path just ahead (still sliding
//   from the lunge, it usually collects it: first touch for a moment);
//   loose = knocked on along the lunge for anyone. The carrier falls
//   (stagger: no moving, no touching the ball).
// - poke: clean from in front of the carrier = taken (rolled onto the
//   tackler's feet); otherwise poked loose, deflected off to one side.
//   Nobody falls; the carrier can't touch the ball for a moment.
// Failed: a slide stumbles (down, drawn on its side); a poke is off balance
// for a moment, on its feet.
export type TacklePhase = 'none' | 'windup' | 'active' | 'recover';
export type TackleResult = 'won' | 'failed' | null;
export type TackleKind = Player['tackleKind'];

// A carrier's ball beyond its jogging touch is exposed, fully at a sprint knock-on.
const CONTROLLED = DRIBBLE.walkLead + DRIBBLE.walkTouch;
const KNOCKED_ON = DRIBBLE.sprintLead + DRIBBLE.sprintTouch;

// The numbers of this player's current tackle.
export const tackleSpec = (p: Player) =>
  p.tackleKind === 'poke' ? TACKLE.poke : TACKLE;

export function tacklePhase(p: Player, time: number): TacklePhase {
  if (time >= p.tackleUntil) return 'none';
  const spec = tackleSpec(p);
  const since = time - p.tackleAt;
  if (since < spec.windupSec) return 'windup';
  if (since < spec.windupSec + spec.activeSec && !p.tackleDone)
    return 'active';
  return 'recover';
}

export function canTackle(p: Player, time: number) {
  return time >= p.tackleUntil && time >= p.staggerUntil && !p.holding;
}

// Starts a tackle along `dir` (the stick, the facing, at the ball for a
// poke, or for the AI where it reads the ball). `carrier` is whoever has
// the ball now (for the juke check).
export function startTackle(
  p: Player,
  dir: number,
  time: number,
  carrier: Player | null,
  kind: TackleKind = 'slide'
) {
  if (!canTackle(p, time)) return false;
  p.tackleKind = kind;
  const spec = tackleSpec(p);
  p.tackleAt = time;
  p.tackleDir = dir;
  p.tackleSprint = p.sprinting;
  p.tackleDone = false;
  p.stumbling = false;
  p.tackleUntil = time + spec.windupSec + spec.activeSec + spec.recoverSec;
  p.jukeRef = carrier && carrier.team !== p.team ? carrier.wantDir : null;
  p.playTackle();
  return true;
}

// The lunge moves the body directly (like a keeper's dive). Returns true
// when it did; in the other phases the caller steps the player with a
// centred stick (it slows down and stands).
export function stepLunge(p: Player, time: number, dt: number) {
  p.lying = time < p.tackleUntil && p.stumbling;
  if (tacklePhase(p, time) !== 'active') return false;
  const spec = tackleSpec(p);
  const speed = (spec.lungeDist * rulesOf(p).tackle) / spec.activeSec;
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
  const spec = tackleSpec(p);
  const dx = ball.x - p.x;
  const dy = ball.y - p.y;
  if (Math.hypot(dx, dy) > spec.reach * rulesOf(p).tackle) return null;
  if (Math.abs(angleDiff(Math.atan2(dy, dx), p.tackleDir)) > spec.arcDeg * DEG)
    return null;

  p.tackleDone = true;
  const poke = p.tackleKind === 'poke';
  const juked =
    p.jukeRef !== null &&
    Math.abs(angleDiff(carrier.wantDir, p.jukeRef)) > TACKLE.jukeDeg * DEG;
  const side = Math.abs(
    angleDiff(Math.atan2(p.y - carrier.y, p.x - carrier.x), carrier.heading)
  ); // 0 = right in front of the carrier
  const exposed = clamp(
    (Math.hypot(ball.x - carrier.x, ball.y - carrier.y) - CONTROLLED) /
      (KNOCKED_ON - CONTROLLED),
    0,
    1
  );
  const chance = clamp(
    spec.baseChance +
      (side <= TACKLE.frontArcDeg * DEG
        ? TACKLE.frontBonus
        : -TACKLE.behindPenalty) -
      (carrier.sprinting ? TACKLE.carrierSprintPenalty : 0) +
      (p.tackleSprint && !poke ? TACKLE.tacklerSprintBonus : 0) +
      TACKLE.exposedBonus * exposed,
    0,
    1
  );
  const roll = rand();
  if (juked || roll >= chance) {
    if (poke) {
      p.tackleUntil = time + TACKLE.poke.failSec; // off balance, standing
      return 'failed';
    }
    p.tackleUntil = time + TACKLE.stumbleSec;
    p.stumbling = true;
    p.diveDir = p.tackleDir; // drawn on its side, falling that way
    return 'failed';
  }

  const clean = roll < chance * (1 - TACKLE.looseShare);
  ball.owner = null;
  ball.lastTouch = p;
  ball.goalStrike = null;
  ball.vz = 0;
  ball.spin = 0;
  ball.dip = 0;
  ball.priority = null;
  carrier.receiving = false;
  if (poke) {
    if (clean && side <= TACKLE.poke.stealArcDeg * DEG) {
      // Taken: rolled back onto the tackler's feet, first touch theirs.
      const back = Math.atan2(p.y - ball.y, p.x - ball.x);
      ball.vx = Math.cos(back) * TACKLE.popSpeed;
      ball.vy = Math.sin(back) * TACKLE.popSpeed;
      ball.priority = p;
      ball.priorityUntil = time + TACKLE.priorityTackleSec;
    } else {
      // Poked loose, deflected off the poke to one side: anyone's. (Not
      // straight on along the carrier's run: that sent it past the tackler
      // for the carrier to run onto.)
      const r = rand() * 2 - 1;
      const off =
        (r < 0 ? -1 : 1) *
        lerp(TACKLE.poke.knockMinDeg, TACKLE.poke.knockMaxDeg, Math.abs(r));
      ball.vx = Math.cos(p.tackleDir + off * DEG) * TACKLE.poke.knockSpeed;
      ball.vy = Math.sin(p.tackleDir + off * DEG) * TACKLE.poke.knockSpeed;
    }
    carrier.lockUntil = time + TACKLE.poke.lockSec;
    p.tackleUntil = time + TACKLE.poke.recoverSec;
    return 'won';
  }

  if (clean) {
    // Nudged toward a point just ahead on the lunge line, where the sliding
    // tackler arrives (first touch is theirs for a moment). Popping it along
    // the lunge sent it away from the tackler (to the carrier's teammates);
    // a random side often took it out of reach.
    const to = Math.atan2(
      p.y + Math.sin(p.tackleDir) * TACKLE.popAhead - ball.y,
      p.x + Math.cos(p.tackleDir) * TACKLE.popAhead - ball.x
    );
    ball.vx = Math.cos(to) * TACKLE.popSpeed;
    ball.vy = Math.sin(to) * TACKLE.popSpeed;
    ball.priority = p;
    ball.priorityUntil = time + TACKLE.priorityTackleSec;
  } else {
    // Got a toe to it: knocked on along the lunge, for anyone.
    ball.vx = Math.cos(p.tackleDir) * TACKLE.looseSpeed;
    ball.vy = Math.sin(p.tackleDir) * TACKLE.looseSpeed;
  }
  carrier.staggerUntil = time + TACKLE.staggerSec;
  carrier.playHurt(time, carrier.heading);
  carrier.lockUntil = time + TACKLE.staggerSec;
  p.tackleUntil = time + TACKLE.winRecoverSec;
  p.stumbling = false;
  return 'won';
}
