import { PITCH, PLAYER, STAMINA, STICK } from '../../shared/tuning';
import type { Player } from '../entities/Player';
import type { StickInput } from './Controls';
import { DEG, angleDiff, clamp, rotateTowards } from './geometry';

// One fixed step of player movement plus sprint stamina, with momentum
// (FIFA-like): speed ramps up and down instead of jumping; the heading turns
// toward the stick quickly when slow (a pivot on the spot) and in wider arcs
// at speed; the further the heading is off the stick, the more the player
// eases off, so a sharp reversal plants, turns and re-accelerates. With the
// ball: a little slower, slower to accelerate and to turn.
export function stepPlayer(
  player: Player,
  move: StickInput,
  wantsSprint: boolean,
  dt: number,
  hasBall: boolean
) {
  const active = move.r > STICK.deadZone;

  // Sprint only while moving, with stamina left and not locked out.
  const sprinting =
    active && wantsSprint && !player.sprintLocked && player.stamina > 0;

  // Analog walk below the sprint ring; flat sprint speed past it.
  const walkSpeed = hasBall ? PLAYER.walkWithBallSpeed : PLAYER.walkSpeed;
  const sprintSpeed = hasBall ? PLAYER.sprintWithBallSpeed : PLAYER.sprintSpeed;
  let targetSpeed = 0;
  if (sprinting) {
    targetSpeed = sprintSpeed;
  } else if (active) {
    const t = Math.min(
      1,
      (move.r - STICK.deadZone) / (STICK.sprintAt - STICK.deadZone)
    );
    targetSpeed =
      walkSpeed * (PLAYER.minWalkFraction + (1 - PLAYER.minWalkFraction) * t);
  }

  if (active) {
    const desired = Math.atan2(move.y, move.x);
    const speedFrac = Math.min(1, player.speed / PLAYER.sprintSpeed);
    const turnRate =
      player.speed < PLAYER.pivotBelowSpeed
        ? PLAYER.pivotRate
        : (PLAYER.turnRateSlow +
            (PLAYER.turnRateFast - PLAYER.turnRateSlow) * speedFrac) *
          (hasBall ? PLAYER.turnWithBallFactor : 1);
    player.heading = rotateTowards(
      player.heading,
      desired,
      turnRate * DEG * dt
    );

    // Ease off while the heading is still well off the stick direction.
    const off = Math.abs(angleDiff(player.heading, desired)) / DEG;
    const ease =
      1 -
      Math.min(
        1,
        Math.max(
          0,
          (off - PLAYER.slowTurnFromDeg) /
            (PLAYER.stopTurnAtDeg - PLAYER.slowTurnFromDeg)
        )
      );
    targetSpeed *= ease;
  }

  const accel = hasBall ? PLAYER.accelWithBall : PLAYER.accel;
  player.speed =
    targetSpeed >= player.speed
      ? Math.min(targetSpeed, player.speed + accel * dt)
      : Math.max(targetSpeed, player.speed - PLAYER.decel * dt);

  const [x, y] = constrainMove(
    player.y,
    player.x + Math.cos(player.heading) * player.speed * dt,
    player.y + Math.sin(player.heading) * player.speed * dt
  );
  player.x = x;
  player.y = y;

  stepStamina(player, sprinting && player.speed > 0, dt);
}

const GOAL_TOP = (PITCH.height - PITCH.goalMouth) / 2;
const GOAL_BOTTOM = (PITCH.height + PITCH.goalMouth) / 2;

// Moves feet from row fromY toward (toX, toY) inside the court, which
// includes both goals: the pitch rectangle plus each net's area behind the
// goal line. Resolved one axis at a time (x against the current row, then y
// against the new column), so the posts and net sides act like walls:
// pushing into a side net slides along it instead of popping the player
// back out of the goal. A player in the net leaves only by moving back out
// through the mouth.
export function constrainMove(
  fromY: number,
  toX: number,
  toY: number,
  r: number = PLAYER.radius
): [number, number] {
  // X first, using the current row: only the goal-mouth band reaches into a net.
  const inMouthBand = fromY >= GOAL_TOP + r && fromY <= GOAL_BOTTOM - r;
  const x = inMouthBand
    ? clamp(toX, -PITCH.goalDepth + r, PITCH.width + PITCH.goalDepth - r)
    : clamp(toX, r, PITCH.width - r);
  // Then Y, using the new column: inside a net, the side nets bound it.
  const insideNet = x < r || x > PITCH.width - r;
  const y = insideNet
    ? clamp(toY, GOAL_TOP + r, GOAL_BOTTOM - r)
    : clamp(toY, r, PITCH.height - r);
  return [x, y];
}

function stepStamina(player: Player, sprinting: boolean, dt: number) {
  player.sprinting = sprinting;
  if (sprinting) {
    player.sinceSprint = 0;
    player.stamina = Math.max(0, player.stamina - STAMINA.drainPerSec * dt);
    if (player.stamina === 0) player.sprintLocked = true;
    return;
  }
  player.sinceSprint += dt;
  if (player.sinceSprint >= STAMINA.regenDelaySec) {
    player.stamina = Math.min(
      STAMINA.max,
      player.stamina + STAMINA.regenPerSec * dt
    );
  }
  if (player.sprintLocked && player.stamina >= STAMINA.unlockAt)
    player.sprintLocked = false;
}
