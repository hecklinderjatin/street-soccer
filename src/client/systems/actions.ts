import { rulesOf } from '../../shared/chaos';
import { launchSpeedKmh } from '../../shared/goalSpeed';
import { AI, BALL, PASS, PITCH, SHOOT, SIM, STICK } from '../../shared/tuning';
import type { Ball } from '../entities/Ball';
import type { Player } from '../entities/Player';
import { stepFreeBall } from './ballPhysics';
import type { StickInput, SwipeVec } from './Controls';
import { DEG, angleDiff, clamp, distToSegment, lerp } from './geometry';

// The teammate a pass goes to: the NEAREST outfield teammate in the
// direction of the stick (the facing direction when the stick is neutral).
// Only teammates inside a narrow cone count; if nobody is there the cone
// widens step by step (PASS.coneStepsDeg) until someone is found.
export function choosePassTarget(
  passer: Player,
  teammates: readonly Player[],
  move: StickInput
): Player | null {
  const aim =
    move.r > STICK.deadZone ? Math.atan2(move.y, move.x) : passer.heading;
  for (const cone of PASS.coneStepsDeg) {
    const target = nearestInCone(passer, teammates, aim, (cone / 2) * DEG);
    if (target) return target;
  }
  return null;
}

function nearestInCone(
  passer: Player,
  teammates: readonly Player[],
  aim: number,
  halfCone: number
) {
  let best: Player | null = null;
  let bestDist = Infinity;
  for (const t of teammates) {
    if (t === passer || t.role === 'keeper') continue;
    const dx = t.x - passer.x;
    const dy = t.y - passer.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1 || Math.abs(angleDiff(Math.atan2(dy, dx), aim)) > halfCone)
      continue;
    if (dist < bestDist) {
      best = t;
      bestDist = dist;
    }
  }
  return best;
}

// Strike speed for a rolling pass to cover `dist` and still arrive at about
// PASS.arriveSpeed. Rolling follows dv/dt = -k v - a (k = -ln groundDrag,
// a = rollFriction), so the distance covered slowing from v0 to v1 is
// (v0 - v1)/k - (a/k^2) ln((v0 + a/k)/(v1 + a/k)); v0 is found by bisection.
const ROLL_K = -Math.log(BALL.groundDrag);
const ROLL_A = BALL.rollFriction;
function rollDistance(v0: number, v1: number) {
  const c = ROLL_A / ROLL_K;
  return (
    (v0 - v1) / ROLL_K -
    (ROLL_A / (ROLL_K * ROLL_K)) * Math.log((v0 + c) / (v1 + c))
  );
}
export function passSpeed(dist: number, maxSpeed: number = PASS.maxSpeed) {
  let lo: number = PASS.arriveSpeed;
  let hi: number = maxSpeed * 2;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (rollDistance(mid, PASS.arriveSpeed) < dist) lo = mid;
    else hi = mid;
  }
  return clamp(hi, PASS.minSpeed, maxSpeed);
}

// Weighted pass: the charge (0..1) for a PASS held `held` seconds (it
// starts filling once the hold is longer than a tap), the roll distance a
// charge asks for (curved, so short passes get more of the hold), and the
// charge that would weigh a pass over `dist` just right.
export function passWeight(held: number) {
  return clamp(
    (held - PASS.weightTapSec) / (PASS.weightChargeSec - PASS.weightTapSec),
    0,
    1
  );
}
function weightDistance(weight: number) {
  return (
    PASS.weightMinDist +
    (PASS.weightMaxDist - PASS.weightMinDist) * weight ** PASS.weightCurve
  );
}
export function idealPassWeight(dist: number) {
  const f = clamp(
    (dist - PASS.weightMinDist) / (PASS.weightMaxDist - PASS.weightMinDist),
    0,
    1
  );
  return f ** (1 / PASS.weightCurve);
}

// Sends the ball toward where the receiver will be, at a speed scaled by
// distance, with a small aim error (bigger under pressure). An opponent
// close to the pass line turns it into a chip over them. With a `weight`
// (a held PASS, 0..1) the player sets the pace instead: it can stop short
// of the receiver or run past them. `swipe` shapes the human's pass (see
// passAirShare): up = aerial, down = ground, left / right = curl (aerial
// when held hard, on the ground otherwise).
// `errorScale` scales the aim error (the CPU team's difficulty).
export function kickPass(
  ball: Ball,
  passer: Player,
  receiver: Player,
  opponents: readonly Player[],
  rand: () => number,
  weight: number | null = null,
  errorScale = 1, // x the aim error (AI difficulty; 1 for the human)
  swipe?: SwipeVec
) {
  const dist = Math.hypot(receiver.x - ball.x, receiver.y - ball.y);
  const baseSpeed =
    weight === null
      ? passSpeed(dist)
      : passSpeed(weightDistance(weight), PASS.weightMaxSpeed);
  const shape =
    swipe && (swipe.x !== 0 || swipe.y !== 0) ? shotShape(swipe) : undefined;
  const speed = baseSpeed * (1 + PASS.driveSpeedGain * (shape?.power ?? 0));
  const air = shape ? passAirShare(shape, weight) : 0;
  // An aerial pass hangs: lead the receiver by its flight time instead.
  const travel = lerp(dist / speed, airPass(dist).time, air);
  const tx = receiver.x + receiver.vx * travel * PASS.leadFactor;
  const ty = receiver.y + receiver.vy * travel * PASS.leadFactor;
  strikePass(
    ball,
    passer,
    receiver,
    tx,
    ty,
    speed,
    opponents,
    rand,
    errorScale,
    shape,
    air
  );
}

// How aerial (0..1) a swiped pass is. Up lifts it (a chip that carries all
// the way to the receiver), scaled by the swipe; down keeps it on the
// ground. A curl (user request) flies when the pass is held to at least
// PASS.curlAirWeight and rolls on the ground otherwise (a tap included).
export function passAirShare(
  shape: ReturnType<typeof shotShape>,
  weight: number | null
) {
  let air = shape.chip;
  if (Math.abs(shape.curl) >= PASS.curlMin) {
    const curlAir = weight !== null && weight >= PASS.curlAirWeight ? 1 : 0;
    air = Math.max(air, curlAir);
  }
  return air * (1 - shape.power);
}

// An aerial pass (user request): as high as a chip shot, but a pass, so it
// carries to the receiver. The lift is the chip shot's (SHOOT.chipMinLift
// for a short pass up to chipMaxLift at PASS.airFullDist); the pace is the
// one whose first bounce lands `dist` away despite air drag, capped at
// PASS.airMaxSpeed (a very long one drops a little short). Returns the
// strike and its time in the air.
export function airPass(dist: number) {
  const vz = lerp(
    SHOOT.chipMinLift,
    SHOOT.chipMaxLift,
    clamp(dist / PASS.airFullDist, 0, 1)
  );
  const time = (2 * vz) / BALL.gravity;
  const k = -Math.log(BALL.airDrag);
  const carry = (1 - Math.exp(-k * time)) / k; // px covered per px/s of pace
  return { vz, speed: Math.min(dist / carry, PASS.airMaxSpeed), time };
}

// A through ball (AI): into the path of a teammate running forward, struck
// to throughSpot() at the pace that gets it there. Same aim error and chip
// rule as any pass.
export function kickThroughPass(
  ball: Ball,
  passer: Player,
  receiver: Player,
  opponents: readonly Player[],
  rand: () => number,
  errorScale = 1
) {
  const spot = throughSpot(ball.x, ball.y, receiver);
  const speed = passSpeed(Math.hypot(spot.x - ball.x, spot.y - ball.y));
  strikePass(
    ball,
    passer,
    receiver,
    spot.x,
    spot.y,
    speed,
    opponents,
    rand,
    errorScale
  );
  receiver.receivingThrough = true; // runs onto it: no receiver hold
}

// Where a through ball to `q` goes: where it will be on its run when the
// ball (a normal pass from `fromX`, `fromY`) gets there, plus
// AI.throughAhead into the space beyond; refined a few times, since the
// travel time depends on the distance. Kept inside the pitch.
export function throughSpot(fromX: number, fromY: number, q: Player) {
  const run = Math.hypot(q.vx, q.vy) || 1;
  const ux = q.vx / run;
  const uy = q.vy / run;
  let x = q.x;
  let y = q.y;
  for (let i = 0; i < 3; i++) {
    const t = passTravelTime(Math.hypot(x - fromX, y - fromY));
    x = q.x + q.vx * t + ux * AI.throughAhead;
    y = q.y + q.vy * t + uy * AI.throughAhead;
  }
  return {
    x: clamp(x, AI.throughEdge, PITCH.width - AI.throughEdge),
    y: clamp(y, AI.throughEdge, PITCH.height - AI.throughEdge),
  };
}

// Seconds a normal pass takes to roll `dist`: struck at passSpeed(dist),
// it covers x(t) = (v0 + c)(1 - e^(-k t)) / k - c t (c = a / k, the
// rolling law above); solved for t by bisection. A pass too long to get
// there takes the time until it stops.
export function passTravelTime(dist: number) {
  const v0 = passSpeed(dist);
  const c = ROLL_A / ROLL_K;
  const covered = (t: number) =>
    ((v0 + c) * (1 - Math.exp(-ROLL_K * t))) / ROLL_K - c * t;
  const stopAt = Math.log((v0 + c) / c) / ROLL_K;
  if (covered(stopAt) <= dist) return stopAt;
  let lo = 0;
  let hi = stopAt;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (covered(mid) < dist) lo = mid;
    else hi = mid;
  }
  return hi;
}

// Strikes a pass toward (tx, ty) at `speed` (kickPass, kickThroughPass):
// a small aim error (bigger under pressure, x errorScale); an opponent
// close to the line ahead turns it into a chip over them. Marks the
// receiver.
function strikePass(
  ball: Ball,
  passer: Player,
  receiver: Player,
  tx: number,
  ty: number,
  speed: number,
  opponents: readonly Player[],
  rand: () => number,
  errorScale: number,
  shape?: ReturnType<typeof shotShape>,
  air = 0 // 0..1: rolling .. aerial (passAirShare)
) {
  ball.strikes += 1;
  ball.pendingShot = false;
  ball.goalStrike = null;
  const pressured = opponents.some(
    (o) => Math.hypot(o.x - passer.x, o.y - passer.y) < PASS.pressureRadius
  );
  const error =
    (pressured ? PASS.pressureErrorDeg : PASS.errorDeg) *
    errorScale *
    DEG *
    (rand() * 2 - 1);
  // Chipped only over an opponent the ball still has to pass (one beside
  // or behind the passer, like a presser at its shoulder, isn't in the way).
  const lineLen = Math.hypot(tx - ball.x, ty - ball.y) || 1;
  const ux = (tx - ball.x) / lineLen;
  const uy = (ty - ball.y) / lineLen;
  const chip = opponents.some(
    (o) =>
      (o.x - ball.x) * ux + (o.y - ball.y) * uy > PASS.chipFromAhead &&
      distToSegment(o.x, o.y, ball.x, ball.y, tx, ty) < PASS.chipLane
  );

  let lift = chip ? PASS.chipVz : 0;
  let pace = speed;
  let spin = 0;
  let angle = Math.atan2(ty - ball.y, tx - ball.x) + error;
  if (shape) {
    // A chosen ground pass (down, or a soft curl) stays down: no auto-chip.
    const ground = Math.max(
      shape.power,
      Math.abs(shape.curl) >= PASS.curlMin ? 1 - air : 0
    );
    const flight = airPass(lineLen);
    lift = lerp(lift * (1 - ground), flight.vz, air);
    pace = lerp(speed, flight.speed, air);
    spin = shape.curl * PASS.curlSpin;
    if (spin !== 0) angle -= passCurlOffset(lineLen, pace, lift, spin);
  }
  ball.vx = Math.cos(angle) * pace;
  ball.vy = Math.sin(angle) * pace;
  ball.vz = lift;
  ball.spin = spin;
  ball.dip = 0;
  ball.lastTouch = passer;
  receiver.receiving = true;
  receiver.receivingThrough = false;
}

// Start a curl wide enough for it to bend back toward the same receiver.
// Simulate along +x first, then rotate the path by the resulting offset.
function passCurlOffset(
  dist: number,
  pace: number,
  lift: number,
  spin: number
) {
  const flight = {
    x: 0,
    y: 0,
    z: 0,
    vx: pace,
    vy: 0,
    vz: lift,
    dip: 0,
    spin,
    get speed() {
      return Math.hypot(this.vx, this.vy);
    },
  };
  while (flight.speed > 0 && Math.hypot(flight.x, flight.y) < dist)
    stepFreeBall(flight, 1 / SIM.hz);
  return Math.atan2(flight.y, flight.x);
}

// Shot (skill-based, user request: no help from the game). The ball leaves
// exactly along the stick, or the facing with the stick centred: no aim
// assist, no snapping to the goal, no auto-ranging. Charge 0..1 sets the
// pace and height. The shooter's run feeds the strike: running onto it adds
// pace and height, shooting back across the run costs power and accuracy.
// Accuracy is timing: releasing in the green band just below the sweet spot
// is a perfect strike (strays at most 0.5 degrees); any other release strays
// up to 2 degrees, and over-hitting past the sweet spot adds stray and lift
// (over the bar). Sprinting, shooting back across the run and a defender
// close by add stray too. The stray is a triangular spread, mostly small.
//
// `swipe` (analog, from the SHOOT button) shapes the strike; each effect is
// scaled by how far that way the thumb slid, and they mix:
// - up = chip: blends toward a lob whose distance the charge sets;
// - down = power: more pace and lift with topspin that makes it dip;
// - left / right = curl: sidespin bending the ball that way as the shooter
//   sees it (moving right on screen, a left curl bends up the screen). It
//   leaves along the stick and bends away from that line.
export function kickShot(
  ball: Ball,
  shooter: Player,
  move: StickInput,
  charge: number,
  opponents: readonly Player[],
  rand: () => number,
  swipe: SwipeVec = { x: 0, y: 0 },
  maxErrorDeg = Infinity
) {
  ball.strikes += 1;
  ball.shotAnimationAge = 0;
  ball.pendingShot = true;
  const shape = shotShape(swipe);
  const aim = shotDirection(shooter, move);
  const { speed, lift, across, overHit } = shotPace(
    shooter,
    aim,
    charge,
    shape
  );

  // Stray: timing first, then body shape and pressure, scaled by the shape.
  const pressured = opponents.some(
    (o) => Math.hypot(o.x - shooter.x, o.y - shooter.y) < PASS.pressureRadius
  );
  const shapeScale = Math.max(
    0.4,
    1 +
      SHOOT.powerErrorMore * shape.power -
      SHOOT.chipErrorLess * shape.chip -
      SHOOT.curlErrorLess * Math.abs(shape.curl)
  );
  const errorDeg =
    shapeScale *
    ((isPerfectCharge(charge) ? SHOOT.perfectErrorDeg : SHOOT.normalErrorDeg) +
      SHOOT.overHitErrorDeg * overHit +
      (shooter.sprinting ? SHOOT.sprintErrorDeg : 0) +
      SHOOT.acrossErrorDeg * across +
      (pressured ? SHOOT.pressureErrorDeg : 0));
  const launch =
    aim + Math.min(errorDeg, maxErrorDeg) * DEG * (rand() + rand() - 1);

  ball.vx = Math.cos(launch) * speed;
  ball.vy = Math.sin(launch) * speed;
  ball.vz = lift;
  ball.spin = shape.curl * SHOOT.curlSpin;
  ball.dip = SHOOT.powerDip * shape.power;
  ball.lastTouch = shooter;
  ball.goalStrike = {
    human: shooter.controlled,
    team: shooter.team,
    kmh: launchSpeedKmh(ball.vx, ball.vy, ball.vz),
    style:
      shape.chip >= 0.5
        ? 'CHIP'
        : Math.abs(shape.curl) >= 0.5
          ? 'CURL'
          : 'STRIKE',
  };
}

// Shared by the strike and Chaos AI's flight check. Running onto the ball
// adds pace and lift; shooting back across the run reduces pace and accuracy.
function shotPace(
  shooter: Player,
  aim: number,
  charge: number,
  shape: ReturnType<typeof shotShape>
) {
  const overHit = Math.max(
    0,
    (charge - SHOOT.sweetSpot) / (1 - SHOOT.sweetSpot)
  );
  const runCos = Math.cos(angleDiff(shooter.heading, aim));
  const runAlong = shooter.speed * runCos;
  const across = shooter.speed > 20 ? (1 - runCos) / 2 : 0;
  // The driven strike: pace and lift from the charge and the run, more
  // with power, less with curl.
  const drivenSpeed = Math.max(
    SHOOT.tapSpeed * 0.6,
    lerp(SHOOT.tapSpeed, SHOOT.fullSpeed, charge) *
      (1 + SHOOT.powerSpeedGain * shape.power) *
      (1 - SHOOT.curlSpeedLoss * Math.abs(shape.curl)) *
      (1 - SHOOT.acrossPowerLoss * across) +
      SHOOT.runCarry * runAlong
  );
  const drivenLift =
    (lerp(SHOOT.tapLift, SHOOT.fullLift, charge) +
      SHOOT.runLift * Math.max(0, runAlong)) *
    (1 + SHOOT.powerLiftGain * shape.power) *
    (1 - SHOOT.curlLiftLoss * Math.abs(shape.curl));
  // The lob it blends toward with chip.
  const lobSpeed = lerp(SHOOT.chipMinSpeed, SHOOT.chipMaxSpeed, charge);
  const lobLift = lerp(SHOOT.chipMinLift, SHOOT.chipMaxLift, charge);

  const power = rulesOf(shooter).power;
  return {
    speed: lerp(drivenSpeed, lobSpeed, shape.chip) * power,
    lift:
      (lerp(drivenLift, lobLift, shape.chip) +
        SHOOT.overHitLift * overHit * (1 + SHOOT.powerOverHit * shape.power)) *
      power,
    across,
    overHit,
  };
}

export function kickBotShot(
  ball: Ball,
  shooter: Player,
  target: { x: number; y: number; charge: number; chip: number },
  opponents: readonly Player[],
  rand: () => number
) {
  const { pitch, power } = rulesOf(shooter);
  const resized = pitch.goalMouth !== PITCH.goalMouth;
  const origin = resized || power !== 1 ? ball : shooter;
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const len = Math.hypot(dx, dy) || 1;
  const aim = Math.atan2(dy, dx);
  const swipe = { x: 0, y: -target.chip };
  const charge =
    (power !== 1 || pitch.goalHeight < PITCH.goalHeight) &&
    Math.abs(dx) > BALL.radius
      ? fitBotCharge(
          ball.z,
          shooter,
          aim,
          target.charge,
          shotShape(swipe),
          Math.abs(dx),
          len,
          pitch.goalHeight
        )
      : target.charge;
  let maxError = Infinity;
  if (pitch.goalMouth < PITCH.goalMouth) {
    const safeHalf = pitch.goalMouth / 2 - BALL.radius - BALL.postRadius;
    const centre = pitch.height / 2 - origin.y;
    const angleToEdge = (y: number) =>
      Math.abs(angleDiff(Math.atan2(y, dx), aim));
    maxError =
      Math.min(angleToEdge(centre - safeHalf), angleToEdge(centre + safeHalf)) /
      DEG;
  }
  kickShot(
    ball,
    shooter,
    { x: dx / len, y: dy / len, r: 1 },
    charge,
    opponents,
    rand,
    swipe,
    maxError
  );
}

// Keep the difficulty's chosen charge when it works. Only look for another
// on a shot that would run out of pace or reach the goal above the bar.
function fitBotCharge(
  startHeight: number,
  shooter: Player,
  aim: number,
  preferred: number,
  shape: ReturnType<typeof shotShape>,
  depth: number,
  distance: number,
  goalHeight: number
) {
  const near = distance * (1 - BALL.radius / depth);
  const far = distance * (1 + BALL.radius / depth);
  const under = goalHeight - BALL.radius - AI.chaosBarMargin;
  const miss = (charge: number) => {
    const { speed, lift } = shotPace(shooter, aim, charge, shape);
    const flight = {
      x: 0,
      y: 0,
      z: startHeight,
      vx: speed,
      vy: 0,
      vz: lift,
      spin: 0,
      dip: 0,
      get speed() {
        return this.vx;
      },
    };
    let high = 0;
    while (flight.x <= far && flight.speed > 0) {
      stepFreeBall(flight, 1 / SIM.hz);
      if (flight.x >= near) high = Math.max(high, flight.z);
    }
    return flight.x <= far ? far - flight.x : Math.max(0, high - under);
  };
  let best = preferred;
  let bestMiss = miss(preferred);
  if (bestMiss === 0) return best;
  let closest = Infinity;
  for (let i = 0; i <= AI.chaosChargeSteps; i++) {
    const charge = i / AI.chaosChargeSteps;
    const change = Math.abs(charge - preferred);
    if (change >= closest) continue;
    const error = miss(charge);
    if (error > bestMiss) continue;
    best = charge;
    bestMiss = error;
    if (error === 0) closest = change;
  }
  return best;
}

// A swipe as amounts of each effect: chip and power 0..1 (up / down),
// curl -1..1 (left / right; + bends to the shooter's right, which is how
// positive spin turns in stepFreeBall).
export function shotShape(swipe: SwipeVec) {
  return {
    chip: Math.max(0, -swipe.y),
    power: Math.max(0, swipe.y),
    curl: swipe.x,
  };
}

// Short label for a swipe, for the HUD: e.g. "CHIP 60 CURL R 40". For a
// pass, `weight` (the charge so far) tells an aerial curl from a ground one.
export function strikeLabel(
  swipe: SwipeVec,
  action: 'shoot' | 'kick' | 'pass',
  weight: number | null = null
) {
  const s = shotShape(swipe);
  const pct = (v: number) => Math.round(Math.abs(v) * 10) * 10;
  const parts: string[] = [];
  if (pct(s.chip) > 0)
    parts.push(
      `${action === 'pass' ? 'AIR' : action === 'kick' ? 'PUNT' : 'CHIP'} ${pct(s.chip)}`
    );
  if (pct(s.power) > 0)
    parts.push(
      `${action === 'shoot' ? 'POWER' : action === 'pass' ? 'GROUND' : 'DRIVE'} ${pct(s.power)}`
    );
  if (pct(s.curl) > 0) {
    const kind =
      action === 'pass' && Math.abs(s.curl) >= PASS.curlMin
        ? passAirShare(s, weight) >= 0.5
          ? 'AIR '
          : 'LOW '
        : '';
    parts.push(`${kind}CURL ${s.curl < 0 ? 'L' : 'R'} ${pct(s.curl)}`);
  }
  return parts.join(' ');
}

// The direction a shot leaves in: the stick, or the facing when centred.
export function shotDirection(shooter: Player, move: StickInput) {
  return move.r > STICK.deadZone ? Math.atan2(move.y, move.x) : shooter.heading;
}

// Finishing assist (user request: scoring was too hard, shots went
// straight at the keeper). A human shot from within SHOOT.assistRange that
// would cross the goal line in or near the mouth is steered part of the way
// (SHOOT.assistMin..assistMax, random per shot so the finish isn't all or
// nothing) toward a spot SHOOT.assistInset inside the post on
// the open side: the side the stick picked relative to the keeper, or the
// bigger gap when aimed right at it. The pull fades out toward the range
// limit. Clearly wide shots, shots away from goal and long range keep the
// stick, so the keeper still saves weak, central or speculative efforts.
export function assistedShotDirection(
  shooter: Player,
  move: StickInput,
  keeper: Player,
  rand: () => number
) {
  const aim = shotDirection(shooter, move);
  const dx = (shooter.team === 'home' ? PITCH.width : 0) - shooter.x;
  const gy = PITCH.height / 2;
  const half = rulesOf(shooter).pitch.goalMouth / 2;
  const dist = Math.hypot(dx, gy - shooter.y);
  const along = Math.cos(aim) * Math.sign(dx);
  if (Math.abs(dx) < 1 || along < 0.2 || dist > SHOOT.assistRange) return aim;
  const cross = shooter.y + (dx * Math.sin(aim)) / Math.cos(aim);
  if (Math.abs(cross - gy) > half + SHOOT.assistMargin) return aim;
  // Where the keeper stands, seen from the shooter, on the goal line.
  const kdx = keeper.x - shooter.x;
  const kCross =
    Math.sign(kdx) === Math.sign(dx) && Math.abs(kdx) > 1
      ? clamp(
          shooter.y + ((keeper.y - shooter.y) * dx) / kdx,
          gy - half,
          gy + half
        )
      : gy;
  const side =
    Math.abs(cross - kCross) > SHOOT.assistKeeperBand
      ? Math.sign(cross - kCross)
      : kCross === gy
        ? Math.sign(cross - gy) || Math.sign(gy - shooter.y) || 1
        : Math.sign(gy - kCross);
  const target = gy + side * (half - SHOOT.assistInset);
  const fade = clamp(
    (SHOOT.assistRange - dist) / (SHOOT.assistRange - SHOOT.assistFullRange),
    0,
    1
  );
  const strength = lerp(SHOOT.assistMin, SHOOT.assistMax, rand());
  const y = lerp(cross, target, strength * fade);
  return Math.atan2(y - shooter.y, dx);
}

// Is this charge a perfect (green) release?
export function isPerfectCharge(charge: number) {
  return (
    charge >= SHOOT.sweetSpot - SHOOT.perfectBand && charge <= SHOOT.sweetSpot
  );
}

// The flight of a full chip (swipe all the way up) struck at `charge` from
// the ground, stepped like stepFreeBall (gravity, air drag; a full chip's
// pace and lift come from the charge alone): its height at each of the
// ground distances `at` along the way (0 once it has come down) and where it
// first lands. The AI uses it to pick a chip that clears a keeper off its
// line and still dips under the bar.
export function chipFlight(charge: number, at: readonly number[], power = 1) {
  const overHit = Math.max(
    0,
    (charge - SHOOT.sweetSpot) / (1 - SHOOT.sweetSpot)
  );
  const dt = 1 / SIM.hz;
  const keep = Math.pow(BALL.airDrag, dt);
  let v = lerp(SHOOT.chipMinSpeed, SHOOT.chipMaxSpeed, charge);
  let vz =
    lerp(SHOOT.chipMinLift, SHOOT.chipMaxLift, charge) +
    SHOOT.overHitLift * overHit;
  v *= power;
  vz *= power;
  const heights = at.map(() => 0);
  let x = 0;
  let z = 0;
  for (let i = 0; i < SIM.hz * 5; i++) {
    vz -= BALL.gravity * dt;
    const nz = z + vz * dt;
    v *= keep;
    const nx = x + v * dt;
    if (nz <= 0) {
      x = nx;
      break;
    }
    at.forEach((d, j) => {
      if (d > x && d <= nx) heights[j] = nz;
    });
    x = nx;
    z = nz;
  }
  return { heights, landing: x };
}
