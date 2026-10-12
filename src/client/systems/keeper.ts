import { BALL, KEEPER, PITCH, PLAYER } from '../../shared/tuning';
import type { Ball } from '../entities/Ball';
import type { Player } from '../entities/Player';

export type KeeperEvent = 'caught' | 'parried' | 'thrown' | null;

// The keeper's own big box, where it may use its hands. Outside it the
// keeper is free to roam but plays the ball with its feet like anyone else.
function boxBounds(keeper: Player, inset: number) {
  const top = (PITCH.height - PITCH.boxHeight) / 2 + inset;
  const bottom = (PITCH.height + PITCH.boxHeight) / 2 - inset;
  const [minX, maxX] =
    keeper.team === 'home'
      ? [inset, PITCH.boxDepth - inset]
      : [PITCH.width - PITCH.boxDepth + inset, PITCH.width - inset];
  return { minX, maxX, top, bottom };
}

export function inOwnBox(keeper: Player) {
  const b = boxBounds(keeper, 0);
  return (
    keeper.x >= b.minX &&
    keeper.x <= b.maxX &&
    keeper.y >= b.top &&
    keeper.y <= b.bottom
  );
}

// A keeper holding the ball in its hands can't carry it out of the box.
export function keepInBox(keeper: Player) {
  const b = boxBounds(keeper, PLAYER.radius);
  keeper.x = Math.max(b.minX, Math.min(b.maxX, keeper.x));
  keeper.y = Math.max(b.top, Math.min(b.bottom, keeper.y));
}

// Phase 2 stand-in goalkeeper: stands still on its goal line. A ball it can
// reach is caught if slow, parried back into play if fast. A caught ball is
// held in the hands; a CPU keeper throws it to the nearest teammate (or
// upfield) after a moment, while a human-controlled keeper decides itself
// (throw or kick, see MatchScene) and only auto-throws after a long hold.
// Phase 3 replaces the positioning with arc positioning, prediction and dives.
export function stepDummyKeeper(
  keeper: Player,
  ball: Ball,
  teammates: readonly Player[],
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

    let target = { x: PITCH.width / 2, y: PITCH.height / 2 };
    let receiver: Player | null = null;
    let best = Infinity;
    for (const t of teammates) {
      if (t === keeper || t.role === 'keeper') continue;
      const d = Math.hypot(t.x - keeper.x, t.y - keeper.y);
      if (d < best) {
        best = d;
        receiver = t;
        target = { x: t.x, y: t.y };
      }
    }
    const angle = Math.atan2(target.y - ball.y, target.x - ball.x);
    ball.vx = Math.cos(angle) * KEEPER.throwSpeed;
    ball.vy = Math.sin(angle) * KEEPER.throwSpeed;
    ball.vz = KEEPER.throwLift;
    ball.owner = null;
    ball.lastTouch = keeper;
    if (receiver) receiver.receiving = true;
    keeper.holdTimer = 0;
    keeper.holding = false;
    keeper.lockUntil = time + KEEPER.lockAfterSec;
    return 'thrown';
  }

  // Hands only inside its own box.
  if (
    time < keeper.lockUntil ||
    ball.owner ||
    ball.inNet !== 0 ||
    !inOwnBox(keeper)
  )
    return null;
  const dist = Math.hypot(ball.x - keeper.x, ball.y - keeper.y);
  const diving = time < keeper.diveUntil;
  const reach = diving ? KEEPER.diveReach : KEEPER.reach;
  const reachHeight = diving ? KEEPER.reachHeight : KEEPER.standReachHeight;
  if (dist > reach || ball.z > reachHeight) return null;

  if (ball.speed > KEEPER.parryAbove) {
    const angle = (outward > 0 ? 0 : Math.PI) + (rand() - 0.5) * 1.4;
    const speed = ball.speed * KEEPER.parryKeep;
    ball.vx = Math.cos(angle) * speed;
    ball.vy = Math.sin(angle) * speed;
    ball.vz = Math.max(ball.vz, 140);
    ball.spin = 0;
    ball.dip = 0;
    ball.lastTouch = keeper;
    keeper.lockUntil = time + KEEPER.lockAfterSec;
    return 'parried';
  }

  ball.owner = keeper;
  ball.lastTouch = keeper;
  ball.spin = 0;
  ball.dip = 0;
  keeper.holdTimer = 0;
  keeper.holding = true;
  return 'caught';
}

// CPU keeper reaction (stand-in until Phase 3): when a shot is heading for
// its goal it waits its reaction time (KEEPER.reactSec), then dives toward
// where the ball will pass it, only as far as needed. Only what it can
// reach in the time left gets saved, so a fast shot placed toward a corner
// beats it and a slow or central one doesn't. The prediction is a straight
// line with gravity (no curl), so a late-bending curler can fool it.
export function cpuKeeperReact(keeper: Player, ball: Ball, time: number) {
  if (time < keeper.recoverUntil || ball.owner || ball.inNet !== 0) {
    keeper.reactAt = -1;
    return;
  }
  const goalX = keeper.team === 'home' ? 0 : PITCH.width;
  const t =
    Math.abs(ball.vx) > KEEPER.reactMinSpeed &&
    Math.sign(goalX - ball.x) === Math.sign(ball.vx)
      ? (keeper.x - ball.x) / ball.vx
      : -1;
  if (t <= 0 || t > KEEPER.reactHorizonSec) {
    keeper.reactAt = -1;
    return;
  }
  // Where and how high the ball passes the keeper.
  const y = ball.y + ball.vy * t;
  const z = ball.z + ball.vz * t - 0.5 * BALL.gravity * (1 + ball.dip) * t * t;
  const mouthTop = (PITCH.height - PITCH.goalMouth) / 2;
  const mouthBottom = (PITCH.height + PITCH.goalMouth) / 2;
  const onTarget =
    y > mouthTop - KEEPER.reactMargin && y < mouthBottom + KEEPER.reactMargin;
  const offset = y - keeper.y;
  if (
    !onTarget ||
    z > KEEPER.reachHeight ||
    Math.abs(offset) < KEEPER.reach * 0.7 // coming at it: no dive needed
  ) {
    keeper.reactAt = -1;
    return;
  }
  if (keeper.reactAt < 0) {
    keeper.reactAt = time + KEEPER.reactSec;
    return;
  }
  if (time < keeper.reactAt) return;
  keeper.reactAt = -1;
  startDive(
    keeper,
    offset < 0 ? -Math.PI / 2 : Math.PI / 2,
    time,
    Math.abs(offset) - KEEPER.diveReach / 2
  );
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
  keeper.diveUntil = time + Math.max(0.08, sec);
  keeper.recoverUntil = keeper.diveUntil + KEEPER.diveRecoverSec;
}

// While diving or down, the dive overrides normal movement. Returns true if
// it did (the caller then skips the stick for this keeper).
export function stepKeeperBody(keeper: Player, time: number, dt: number) {
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
