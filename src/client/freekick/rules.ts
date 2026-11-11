import { BALL, FREE_KICK as FK, PITCH } from '../../shared/tuning';
import {
  freeKickRoundLevel,
  challengeProgress,
  challengeRandom,
  type FreeKickChallengeConfig,
} from '../../shared/freeKickChallenge';
import { customLevel, type CustomKick } from '../../shared/freeKickCustom';

// Free Kick rules: the spot, wall and keeper of each kick, reading the
// swipe, the strike, the flight (gravity, drag, curl, dip) and how the kick
// ends. Pure (no Phaser, no DOM), so checks/freekick-check.ts drives it
// directly. World px as the match: x along the pitch, y across it, z up;
// kicks are always at the right-hand goal (goal line x = PITCH.width).
// Unlike the match, the ball's z is its centre height (R when resting).

export const GOAL_X = PITCH.width;
export const GOAL_Y = PITCH.height / 2;
export const POST_HALF = PITCH.goalMouth / 2; // goal centre to a post
export const BAR_Z = PITCH.goalHeight;
const R = BALL.radius;
const NET_TOP_BACK = BAR_Z * 0.7; // the roof net slopes down to the back

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

export type Spot = { x: number; y: number };

export type Level = {
  level: number; // 1..FK.maxLevel
  wallMen: number; // total defenders, including any lying behind the wall
  reactSec: number; // keeper reaction
  readNoise: number; // keeper misjudges the crossing point by up to this
  diveReach: number; // keeper hands' farthest reach from its spot
  keeperShade: number; // keeper stands this share of the open part toward the wall
  wallJump: number; // the wall's extra reach at the top of its jump
  maxDistance: number;
  maxAngle: number; // radians either side of the centre line
  wallJumpChance: number;
  wallLyerChance: number;
  keeperCheatChance: number;
  keeperGuessChance: number;
  keeperCurlRead: number; // share of curl / dip the keeper allows for
};

export function levelFor(goals: number): Level {
  const level = Math.min(FK.maxLevel, 1 + Math.floor(goals / FK.goalsPerLevel));
  const t = (level - 1) / (FK.maxLevel - 1);
  return {
    level,
    wallMen: FK.wallMen[level - 1] ?? 3,
    reactSec: lerp(FK.keeperReactSec[0], FK.keeperReactSec[1], t),
    readNoise: lerp(FK.keeperReadNoise[0], FK.keeperReadNoise[1], t),
    diveReach: lerp(FK.keeperDiveReach[0], FK.keeperDiveReach[1], t),
    keeperShade: lerp(FK.keeperWallShade[0], FK.keeperWallShade[1], t),
    wallJump: lerp(FK.wallJumpHeight[0], FK.wallJumpHeight[1], t),
    maxDistance: Math.min(
      FK.maxDistance,
      FK.firstMaxDistance + (level - 1) * FK.distancePerLevel
    ),
    maxAngle:
      (Math.min(
        FK.maxAngleDeg,
        FK.firstMaxAngleDeg + (level - 1) * FK.anglePerLevelDeg
      ) *
        Math.PI) /
      180,
    wallJumpChance: lerp(FK.wallJumpChance[0], FK.wallJumpChance[1], t),
    wallLyerChance: lerp(FK.wallLyerChance[0], FK.wallLyerChance[1], t),
    keeperCheatChance: lerp(
      FK.keeperCheatChance[0],
      FK.keeperCheatChance[1],
      t
    ),
    keeperGuessChance: lerp(
      FK.keeperGuessChance[0],
      FK.keeperGuessChance[1],
      t
    ),
    keeperCurlRead: lerp(FK.keeperCurlRead[0], FK.keeperCurlRead[1], t),
  };
}

// The wall stands on one x; its men are lateral centres. It jumps at
// `jumpAt` (Infinity: it stays down). `lyer`: a man lies behind it.
export type Wall = {
  x: number;
  men: number[];
  jump: number;
  jumpAt: number;
  lyer: boolean;
};

export type KeeperMode = 'set' | 'dive' | 'jump' | 'down';
export type Keeper = {
  x: number;
  y: number;
  mode: KeeperMode;
  modeAt: number; // play time the mode began
  dir: -1 | 1; // dive direction along y
  fromY: number;
  toY: number;
  readAt: number; // play time it reads the shot
  read: boolean;
  guessY: number | null; // a corner it guessed at the strike, if it did
};

// 'cheat': stands toward the wall, guarding the ball over it.
export type KeeperStyle = 'line' | 'cheat';

export type KickSetup = {
  spot: Spot;
  distance: number; // to the goal centre
  level: Level;
  wall: Wall;
  keeperY: number;
  keeperStyle: KeeperStyle;
  nearSide: -1 | 1; // the side of the goal (along y) the wall covers
};

// A kick for this level: a spot outside the box, the wall across the line
// to the near post (shoulder to shoulder from just outside it inward), and
// the keeper in the part of the goal the wall leaves open.
//
// `place` (a challenge post's round): the spot's distance and the wall's
// distance from goal, world px, instead of the level's. The wall stays at
// least FK.challengeWallGapM from the ball. A Playground kick also fixes
// whether a man lies behind the wall (`lyer`) and slides the wall
// sideways by `shift` world px (`level.wallMen` is its size).
export function makeKick(
  level: Level,
  rand: () => number,
  place?: {
    distance: number;
    wallFromGoal: number;
    angle?: number;
    lyer?: boolean;
    shift?: number;
  }
): KickSetup {
  const rolled = lerp(FK.minDistance, level.maxDistance, rand());
  const distance = place?.distance ?? rolled;
  const rolledAngle = (rand() * 2 - 1) * level.maxAngle;
  const angle = place?.angle ?? rolledAngle;
  const spot = {
    x: GOAL_X - distance * Math.cos(angle),
    y: GOAL_Y + distance * Math.sin(angle),
  };
  const nearSide: -1 | 1 =
    Math.abs(spot.y - GOAL_Y) > 1
      ? spot.y > GOAL_Y
        ? 1
        : -1
      : rand() < 0.5
        ? -1
        : 1;
  const dx = GOAL_X - spot.x;
  const gap = place
    ? Math.max(
        distance - place.wallFromGoal,
        FK.challengeWallGapM * FK.pxPerMetre
      )
    : clamp(distance * FK.wallShare, FK.wallMinDistance, FK.wallMaxDistance);
  const wallX = spot.x + (gap * dx) / distance;
  // Lateral position at x of the line from the spot to (GOAL_X, y), and back.
  const atWall = (y: number) => spot.y + ((y - spot.y) * (wallX - spot.x)) / dx;
  const atGoal = (y: number) => spot.y + ((y - spot.y) * dx) / (wallX - spot.x);
  const edge =
    atWall(GOAL_Y + nearSide * (POST_HALF + FK.wallCover)) +
    (place?.shift ?? 0);
  // A lying defender replaces one standing player, keeping the total capped.
  // (Always rolled, so a fixed choice leaves the seeded rolls after it alone.)
  const rolledLyer = rand() < level.wallLyerChance && level.wallMen >= 3;
  const lyer = place?.lyer ?? rolledLyer;
  const standing = level.wallMen - (lyer ? 1 : 0);
  const men = Array.from(
    { length: standing },
    (_, i) => edge - nearSide * (FK.wallHalfWidth + i * FK.wallSpacing)
  );
  const inner =
    edge - nearSide * (2 * FK.wallHalfWidth + (standing - 1) * FK.wallSpacing);
  const shadow = clamp(atGoal(inner), GOAL_Y - POST_HALF, GOAL_Y + POST_HALF);
  const open = (GOAL_Y - nearSide * POST_HALF + shadow) / 2;
  // Visible keeper variety, rolled after the spot and wall.
  const keeperStyle: KeeperStyle =
    rand() < level.keeperCheatChance ? 'cheat' : 'line';
  const shade = Math.min(
    1,
    level.keeperShade + (keeperStyle === 'cheat' ? FK.keeperCheatShade : 0)
  );
  return {
    spot,
    distance,
    level,
    wall: { x: wallX, men, jump: level.wallJump, jumpAt: Infinity, lyer },
    keeperY: lerp(open, shadow, shade),
    keeperStyle,
    nearSide,
  };
}

// Share of the jump's height the wall is at, at play time t (0 standing).
function jumpShare(wall: Wall, t: number) {
  const u = (t - wall.jumpAt) / FK.wallJumpSec;
  return u > 0 && u < 1 ? Math.sin(Math.PI * u) : 0;
}

// Reach of the wall (head, or hands at the top of the jump) at play time t.
export function wallTop(wall: Wall, t: number) {
  return FK.wallHeight + jumpShare(wall, t) * wall.jump;
}

// Height of the jumping wall's feet at play time t: a ball wholly below
// them slips under.
export function wallFeet(wall: Wall, t: number) {
  return jumpShare(wall, t) * FK.wallFeetLift;
}

// The wall's lateral span (outer edges of its end men).
export function wallSpan(wall: Wall) {
  return {
    lo: Math.min(...wall.men) - FK.wallHalfWidth,
    hi: Math.max(...wall.men) + FK.wallHalfWidth,
  };
}

// ---- The swipe ------------------------------------------------------------

export type ScreenPoint = { x: number; y: number };
export type Contact = { x: number; y: number }; // right and down, in ball radii

export function ballContact(x: number, y: number): Contact {
  const radius = Math.max(1, Math.hypot(x, y));
  return { x: x / radius, y: y / radius };
}

export type Swipe = {
  dirX: number; // unit chord direction on screen
  dirY: number;
};

// The chord gives the launch direction. A tap or a swipe that isn't up
// won't shoot.
export function readSwipe(
  points: readonly ScreenPoint[],
  minDistance: number = FK.swipeMinPx
): Swipe | null {
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) return null;
  const cx = last.x - first.x;
  const cy = last.y - first.y;
  const length = Math.hypot(cx, cy);
  if (length < minDistance || cy > -minDistance / 2) return null;
  return { dirX: cx / length, dirY: cy / length };
}

// How far the swipe bends off the straight line between its ends, as a
// share of that line's length: below 0 it bulges to the left of the way it
// travels (a path that curls to the right), above 0 to the right.
export function swipeBow(points: readonly ScreenPoint[]) {
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) return 0;
  const cx = last.x - first.x;
  const cy = last.y - first.y;
  const length2 = cx * cx + cy * cy;
  if (length2 < 1) return 0;
  let bow = 0;
  for (const p of points) {
    const off = (cx * (p.y - first.y) - cy * (p.x - first.x)) / length2;
    if (Math.abs(off) > Math.abs(bow)) bow = off;
  }
  return bow;
}

// Screen point with the world y it shows on the goal line, and its
// distance from the camera (`d`; leave out for a square-on view).
export type GoalLinePoint = { sx: number; sy: number; y: number; d?: number };

// Where the swipe direction from the ball's screen position crosses the
// goal line on screen, as a world y on that line (two goal-line ground
// points give the line). Null if it never gets there.
export function aimAtGoalLine(
  ball: ScreenPoint,
  dirX: number,
  dirY: number,
  a: GoalLinePoint,
  b: GoalLinePoint
) {
  const ex = b.sx - a.sx;
  const ey = b.sy - a.sy;
  const den = dirX * ey - dirY * ex;
  if (Math.abs(den) < 1e-6) return null;
  const ax = a.sx - ball.x;
  const ay = a.sy - ball.y;
  const t = (ax * ey - ay * ex) / den;
  const s = (ax * dirY - ay * dirX) / den;
  if (t <= 0) return null;
  // Seen at an angle, equal steps along the line shrink on screen with
  // distance: weigh each end by how near it is.
  const wa = (1 - s) / (a.d ?? 1);
  const wb = s / (b.d ?? 1);
  const u = wa + wb > 1e-9 ? wb / (wa + wb) : s < 0 ? -1e6 : 1e6;
  return clamp(
    lerp(a.y, b.y, u),
    GOAL_Y - 3 * POST_HALF,
    GOAL_Y + 3 * POST_HALF
  );
}

// ---- The strike and the flight -------------------------------------------

export type Ball = {
  x: number;
  y: number;
  z: number; // centre height
  vx: number;
  vy: number;
  vz: number;
  spin: number; // rad/s the horizontal velocity turns (curl)
  dip: number; // topspin: extra gravity share on the way down
};

export const restingBall = (spot: Spot): Ball => ({
  x: spot.x,
  y: spot.y,
  z: R,
  vx: 0,
  vy: 0,
  vz: 0,
  spin: 0,
  dip: 0,
});

export type Strike = {
  power: number; // 0..1 slider value
  targetY: number; // where the launch heading points on the goal line
  contact: Contact;
};

export const STEP = 1 / FK.simHz;

// Free flight for one step: gravity (more on the way down with topspin),
// air drag, curl turning the horizontal velocity, bounces and rolling.
export function stepBall(b: Ball, dt: number) {
  const airborne = b.z > R + 0.01 || b.vz > 0;
  b.vz -= FK.gravity * (1 + (b.vz < 0 ? b.dip : 0)) * dt;
  const keep = (airborne ? FK.airDrag : FK.rollDrag) ** dt;
  b.vx *= keep;
  b.vy *= keep;
  if (airborne) b.vz *= keep;
  if (b.spin !== 0) {
    const a = b.spin * dt;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const vx = b.vx * c - b.vy * s;
    b.vy = b.vx * s + b.vy * c;
    b.vx = vx;
    b.spin *= FK.spinDecay ** dt;
  }
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  b.z += b.vz * dt;
  if (b.z < R) {
    b.z = R;
    b.vz = b.vz < -90 ? -b.vz * FK.bounce : 0;
    b.dip = 0;
    b.spin = 0; // sidespin barely bends a ball once it's down
  }
}

// Where a free-flying ball first crosses the plane x (no wall, keeper or
// goal), or null if it never does.
export function crossing(ball: Ball, x: number) {
  const b = { ...ball };
  for (let t = 0; t < FK.maxFlightSec; t += STEP) {
    const px = b.x;
    const py = b.y;
    const pz = b.z;
    stepBall(b, STEP);
    if (px < x && b.x >= x) {
      const f = (x - px) / (b.x - px);
      return {
        y: py + (b.y - py) * f,
        z: pz + (b.z - pz) * f,
        t: t + STEP * f,
      };
    }
    if (b.vx <= 0 || (b.z <= R && Math.hypot(b.vx, b.vy) < 30)) return null;
  }
  return null;
}

// Centre contact transfers the most pace. Striking low adds lift and
// reduces dip, and striking either side bends the ball away from that side.
export function strikeBall(spot: Spot, strike: Strike): Ball {
  const p = clamp(strike.power, 0, 1);
  const contact = ballContact(strike.contact.x, strike.contact.y);
  const loft = contact.y;
  const range = Math.hypot(GOAL_X - spot.x, GOAL_Y - spot.y);
  const speed =
    lerp(FK.speedMin, FK.speedMax, p) *
    (1 - Math.hypot(contact.x, loft) * FK.offCentrePaceLoss) *
    (range / FK.rangeDistance) ** FK.rangeExp;
  const heading = Math.atan2(strike.targetY - spot.y, GOAL_X - spot.x);
  return {
    ...restingBall(spot),
    vx: speed * Math.cos(heading),
    vy: speed * Math.sin(heading),
    vz:
      lerp(FK.liftMin, FK.liftMax, p) +
      loft * (loft >= 0 ? FK.chipLift : FK.lowDriveLift),
    spin: contact.x * FK.curlMax,
    dip: FK.dipMax * p * (1 - loft),
  };
}

// The strike for a curved swipe: the bend sets the curl (in place of the
// ball dot's side) and the launch heading is turned so the curling ball
// still arrives where the swipe pointed, as the drawn path does. A straight
// swipe leaves the strike as it is.
export function curvedStrike(spot: Spot, strike: Strike, bow: number): Strike {
  if (Math.abs(bow) < FK.swipeBowMin) return strike;
  const contact = ballContact(
    clamp(bow / FK.swipeBowFull, -1, 1),
    strike.contact.y
  );
  let targetY = strike.targetY;
  for (let i = 0; i < 4; i++) {
    const at = crossing(
      strikeBall(spot, { ...strike, contact, targetY }),
      GOAL_X
    );
    if (!at) break;
    targetY += strike.targetY - at.y;
  }
  return { ...strike, contact, targetY };
}

// ---- Playing the kick out -------------------------------------------------

export type Outcome =
  'goal' | 'saved' | 'wall' | 'post' | 'over' | 'wide' | 'short';

export type KickPlay = {
  setup: KickSetup;
  strike: Strike;
  ball: Ball;
  wall: Wall;
  keeper: Keeper;
  t: number; // seconds since the strike
  outcome: Outcome | null;
  outcomeAt: number;
  hitPost: boolean;
  overWall: boolean; // went over the wall's men
  underWall: boolean; // slipped under the jumping wall's feet
  blockedBy: 'wall' | 'lyer' | null; // what stopped it at the wall
  screened: boolean; // the keeper lost it behind the wall
  inNet: boolean;
  crossed: { y: number; z: number } | null; // where a goal crossed the line
  netHit: { y: number; z: number; t: number } | null; // first touch of the back net
  noise: number; // the keeper's misread this kick
};

export function startPlay(
  setup: KickSetup,
  strike: Strike,
  rand: () => number
): KickPlay {
  const ball = strikeBall(setup.spot, strike);
  // Struck at the wall's men: the keeper only picks it up as it comes over.
  const atWall = crossing(ball, setup.wall.x);
  const screened =
    atWall !== null &&
    setup.wall.men.some((m) => Math.abs(atWall.y - m) < FK.wallHalfWidth + R);
  const reactJitter = (rand() * 2 - 1) * FK.keeperReactJitter;
  const noise = (rand() * 2 - 1) * setup.level.readNoise;
  // Unseen until the strike: whether the wall jumps (it always does with a
  // man lying behind it) and whether the keeper guesses a corner.
  // (A Playground wall set not to jump has no jump chance, lyer or not.)
  const jumps =
    (setup.wall.lyer && setup.level.wallJumpChance > 0) ||
    rand() < setup.level.wallJumpChance;
  const guesses = rand() < setup.level.keeperGuessChance;
  const guessSide = rand() < 0.5 ? -1 : 1;
  const guessY = guesses ? GOAL_Y + guessSide * (POST_HALF - 40) : null;
  const wall = {
    ...setup.wall,
    men: [...setup.wall.men],
    jumpAt: jumps ? FK.wallReactSec : Infinity,
  };
  return {
    setup,
    strike,
    ball,
    wall,
    keeper: {
      x: GOAL_X - FK.keeperLineOff,
      y: setup.keeperY,
      mode: 'set',
      modeAt: 0,
      dir: 1,
      fromY: setup.keeperY,
      toY: setup.keeperY,
      readAt:
        setup.level.reactSec +
        reactJitter +
        (screened ? FK.keeperScreenedSec : 0) +
        (guesses ? FK.keeperGuessReadDelay : 0),
      read: false,
      guessY,
    },
    t: 0,
    outcome: null,
    outcomeAt: 0,
    hitPost: false,
    overWall: false,
    underWall: false,
    blockedBy: null,
    screened,
    inNet: false,
    crossed: null,
    netHit: null,
    noise,
  };
}

// After its reaction time the keeper reads the shot as if it flew mostly
// straight on: it allows for only its level's share of the curl and dip
// (none at level 1). It side-steps toward that line and, once the ball is
// close in time, commits to staying, a jump or a dive. A guessing keeper
// first drifts toward the corner it guessed and reads the shot later.
function moveKeeper(play: KickPlay, dt: number) {
  const k = play.keeper;
  const b = play.ball;
  const tt = b.vx > 1 ? (k.x - b.x) / b.vx : -1;
  const edge = (y: number) =>
    clamp(y, GOAL_Y - POST_HALF + 10, GOAL_Y + POST_HALF - 10);
  if (
    k.guessY !== null &&
    !k.read &&
    play.t >= FK.keeperGuessSec &&
    play.t < k.readAt &&
    play.outcome === null
  ) {
    const step = FK.keeperGuessSpeed * dt;
    k.y = edge(k.y + clamp(k.guessY - k.y, -step, step));
  }
  if (!k.read && play.t >= k.readAt && play.outcome === null && tt > 0) {
    const straight = b.y + b.vy * tt;
    const curlRead = play.setup.level.keeperCurlRead;
    const real = curlRead > 0 ? crossing(b, k.x) : null;
    const y = (real ? lerp(straight, real.y, curlRead) : straight) + play.noise;
    if (tt > FK.keeperCommitSec) {
      const step = FK.keeperShuffleSpeed * dt;
      k.y = edge(k.y + clamp(y - k.y, -step, step));
    } else {
      k.read = true;
      const straightZ = b.z + b.vz * tt - 0.5 * FK.gravity * tt * tt;
      const z = real ? lerp(straightZ, real.z, curlRead) : straightZ;
      const off = y - k.y;
      if (Math.abs(off) > FK.keeperStandReach) {
        k.mode = 'dive';
        k.modeAt = play.t;
        k.dir = off < 0 ? -1 : 1;
        k.fromY = k.y;
        k.toY =
          k.y +
          k.dir *
            clamp(
              Math.abs(off) - FK.keeperHandReach * 0.8,
              0,
              play.setup.level.diveReach - FK.keeperHandReach
            );
      } else if (z > FK.keeperStandReachZ) {
        k.mode = 'jump';
        k.modeAt = play.t;
      }
    }
  }
  const u = (play.t - k.modeAt) / FK.keeperDiveSec;
  if (k.mode === 'dive') {
    k.y = lerp(k.fromY, k.toY, 1 - (1 - Math.min(1, u)) ** 2);
    if (u >= 1) k.mode = 'down';
  } else if (k.mode === 'jump' && play.t - k.modeAt >= FK.keeperJumpSec)
    k.mode = 'set';
}

// True if the keeper gets a hand or body to a ball centre at (y, z) as it
// passes the keeper at play time t.
export function keeperCovers(k: Keeper, t: number, y: number, z: number) {
  const off = y - k.y;
  if (k.mode === 'set')
    return Math.abs(off) <= FK.keeperStandReach && z <= FK.keeperStandReachZ;
  if (k.mode === 'jump') {
    const u = clamp((t - k.modeAt) / FK.keeperJumpSec, 0, 1);
    const top = lerp(
      FK.keeperStandReachZ,
      FK.keeperJumpReachZ,
      Math.sin(Math.PI * u)
    );
    return Math.abs(off) <= FK.keeperStandReach && z <= top;
  }
  // Diving (or down): body from just behind its centre to the hands, which
  // reach out as it flies; a full stretch reaches less high.
  const u = clamp((t - k.modeAt) / FK.keeperDiveSec, 0, 1);
  const hands = FK.keeperHandReach * Math.min(1, u * 1.6) + R;
  const along = off * k.dir;
  const top =
    k.mode === 'down'
      ? 40
      : lerp(FK.keeperDiveTopZ[0], FK.keeperDiveTopZ[1], u);
  return along >= -24 && along <= hands && z <= top;
}

// Posts and crossbar; true on contact.
function hitFrame(b: Ball) {
  let hit = false;
  const min = R + BALL.postRadius;
  const bounce = (nx: number, ny: number, nz: number) => {
    const vn = b.vx * nx + b.vy * ny + b.vz * nz;
    if (vn < 0) {
      b.vx -= 1.6 * vn * nx;
      b.vy -= 1.6 * vn * ny;
      b.vz -= 1.6 * vn * nz;
    }
    b.spin = 0;
    hit = true;
  };
  for (const py of [GOAL_Y - POST_HALF, GOAL_Y + POST_HALF]) {
    const dx = b.x - GOAL_X;
    const dy = b.y - py;
    const d = Math.hypot(dx, dy);
    if (b.z > BAR_Z || d >= min || d === 0) continue;
    b.x = GOAL_X + (dx / d) * min;
    b.y = py + (dy / d) * min;
    bounce(dx / d, dy / d, 0);
  }
  if (Math.abs(b.y - GOAL_Y) < POST_HALF) {
    const dx = b.x - GOAL_X;
    const dz = b.z - BAR_Z;
    const d = Math.hypot(dx, dz);
    if (d < min && d > 0) {
      b.x = GOAL_X + (dx / d) * min;
      b.z = BAR_Z + (dz / d) * min;
      bounce(dx / d, 0, dz / d);
    }
  }
  return hit;
}

// Keeps a scored ball in the net; the net soaks up most of its speed.
function holdInNet(play: KickPlay) {
  const b = play.ball;
  const soak = 0.15;
  const back = GOAL_X + FK.goalDepth - R;
  if (b.x > back) {
    if (!play.netHit) play.netHit = { y: b.y, z: b.z, t: play.t };
    b.x = back;
    b.vx = -Math.abs(b.vx) * soak;
  }
  if (b.x < GOAL_X + R) {
    b.x = GOAL_X + R;
    b.vx = Math.abs(b.vx) * soak;
  }
  if (Math.abs(b.y - GOAL_Y) > POST_HALF - R) {
    b.y = GOAL_Y + Math.sign(b.y - GOAL_Y) * (POST_HALF - R);
    b.vy = -b.vy * soak;
  }
  const roof = lerp(BAR_Z, NET_TOP_BACK, (b.x - GOAL_X) / FK.goalDepth) - R;
  if (b.z > roof) {
    b.z = roof;
    b.vz = -Math.abs(b.vz) * soak;
  }
}

function end(play: KickPlay, outcome: Outcome) {
  if (play.outcome !== null) return;
  play.outcome = outcome;
  play.outcomeAt = play.t;
}

// One step of the kick: the ball flies, the wall jumps, the keeper reacts,
// and the first thing that decides the kick sets its outcome. The ball keeps
// moving after that (rebounds, the net), so it can be drawn to rest.
export function stepPlay(play: KickPlay, dt: number) {
  const b = play.ball;
  const px = b.x;
  const py = b.y;
  const pz = b.z;
  play.t += dt;
  stepBall(b, dt);
  const cross = (x: number) => {
    if (!(px < x && b.x >= x)) return null;
    const f = (x - px) / (b.x - px);
    return { y: py + (b.y - py) * f, z: pz + (b.z - pz) * f };
  };

  const atWall = play.outcome === null ? cross(play.wall.x) : null;
  if (atWall) {
    const man = play.wall.men.find(
      (m) => Math.abs(atWall.y - m) < FK.wallHalfWidth + R * 0.8
    );
    if (man !== undefined) {
      if (
        atWall.z + R * 0.8 < wallFeet(play.wall, play.t) &&
        play.strike.power >= FK.underWallMinPower
      )
        play.underWall = true; // driven under the jumping men's feet
      else if (atWall.z - R * 0.8 < wallTop(play.wall, play.t)) {
        end(play, 'wall');
        play.blockedBy = 'wall';
        b.x = play.wall.x - 1;
        b.vx = -Math.abs(b.vx) * 0.3;
        b.vy = b.vy * 0.4 + (atWall.y - man) * 4;
        b.vz = Math.max(b.vz, 0) * 0.3 + 160;
        b.spin = b.dip = 0;
      } else play.overWall = true;
    }
  }
  // The man lying behind the wall stops a low ball along its span.
  const lyerX = play.wall.x + FK.wallLyerBehind;
  const atLyer =
    play.outcome === null && play.wall.lyer && play.wall.men.length > 0
      ? cross(lyerX)
      : null;
  if (atLyer) {
    const span = wallSpan(play.wall);
    if (
      atLyer.y > span.lo - R &&
      atLyer.y < span.hi + R &&
      atLyer.z - R * 0.8 < FK.wallLyerHeight
    ) {
      end(play, 'wall');
      play.blockedBy = 'lyer';
      play.underWall = false;
      b.x = lyerX - 1;
      b.vx = -Math.abs(b.vx) * 0.25;
      b.vz = 140;
      b.spin = b.dip = 0;
    }
  }

  moveKeeper(play, dt);
  const k = play.keeper;
  const atKeeper = play.outcome === null ? cross(k.x) : null;
  if (atKeeper && keeperCovers(k, play.t, atKeeper.y, atKeeper.z)) {
    end(play, 'saved');
    const away = atKeeper.y >= k.y ? 1 : -1;
    b.x = k.x - 1;
    b.vx = -Math.abs(b.vx) * FK.keeperParryKeep;
    b.vy = away * (120 + Math.abs(b.vy) * 0.3);
    b.vz = Math.abs(b.vz) * 0.3 + 120;
    b.spin = b.dip = 0;
  }

  if (!play.inNet && hitFrame(b)) play.hitPost = true;
  const atLine = play.outcome === null ? cross(GOAL_X) : null;
  if (atLine) {
    if (Math.abs(atLine.y - GOAL_Y) < POST_HALF && atLine.z < BAR_Z) {
      play.inNet = true;
      play.crossed = atLine;
      end(play, 'goal');
    } else
      end(play, play.hitPost ? 'post' : atLine.z >= BAR_Z ? 'over' : 'wide');
  }
  if (play.inNet) holdInNet(play);

  const resting = b.z <= R + 0.5 && Math.hypot(b.vx, b.vy) < 40;
  if (play.t > FK.maxFlightSec || resting || (b.vx < 0 && play.hitPost))
    end(play, play.hitPost ? 'post' : 'short');
}

// ---- Expected goals ----------------------------------------------------------

// A small seeded generator (mulberry32): the same spot or shot always gets
// the same xG / xGOT.
export function seededRandom(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const seedOf = (...values: number[]) =>
  values.reduce(
    (h, v) => Math.imul(h ^ Math.round(v * 16), 0x01000193),
    0x811c9dc5
  );

// Plays a kick until something decides it.
export function playToEnd(play: KickPlay) {
  while (play.outcome === null) stepPlay(play, STEP);
  return play;
}

// One average kick: any sensible strike, equally likely (power, any
// contact, a heading anywhere from just outside one post to the other).
function averageStrike(rand: () => number): Strike {
  return {
    power: lerp(0.2, 1, rand()),
    targetY: GOAL_Y + lerp(-1.1, 1.1, rand()) * POST_HALF,
    contact: ballContact(lerp(-0.8, 0.8, rand()), lerp(-0.5, 0.5, rand())),
  };
}

// The spot's xG: the share of average kicks that score from it, against
// its wall and keeper (their unseen rolls included), held in
// [FK.xgMin, FK.xgMax]. Worked out a slice at a time (step) so a phone
// doesn't stall; value() finishes it.
export class SpotXg {
  private readonly rand: () => number;
  private done = 0;
  private goals = 0;

  constructor(private readonly setup: KickSetup) {
    this.rand = seededRandom(
      seedOf(
        setup.spot.x,
        setup.spot.y,
        setup.level.level,
        setup.wall.men.length
      )
    );
  }

  get ready() {
    return this.done >= FK.xgSamples;
  }

  step(samples: number) {
    const end = Math.min(FK.xgSamples, this.done + samples);
    for (; this.done < end; this.done++) {
      const play = startPlay(this.setup, averageStrike(this.rand), this.rand);
      if (playToEnd(play).outcome === 'goal') this.goals++;
    }
  }

  value() {
    this.step(FK.xgSamples);
    return clamp(this.goals / FK.xgSamples, FK.xgMin, FK.xgMax);
  }
}

export const spotXg = (setup: KickSetup) => new SpotXg(setup).value();

// The spot's xG for its nth retry (0: the first attempt).
export const retryXg = (xg: number, retries: number) =>
  retries > 0 ? Math.min(FK.xgRetryMax, xg * FK.xgRetryScale ** retries) : xg;

// A shot's xGOT: 0 off target (wide, over, the frame, the wall, short);
// on target, the share of keeper reactions (reaction time, misread, a
// guess) that the same strike beats, with the wall as it actually was.
// The real reaction counts as one of them, so a goal is never 0.
export function shotXgot(play: KickPlay) {
  if (play.outcome !== 'goal' && play.outcome !== 'saved') return 0;
  const { strike } = play;
  const rand = seededRandom(
    seedOf(strike.power, strike.targetY, strike.contact.x, strike.contact.y)
  );
  let goals = play.outcome === 'goal' ? 1 : 0;
  for (let i = 0; i < FK.xgotSamples; i++) {
    const sim = startPlay(play.setup, strike, rand);
    sim.wall.jumpAt = play.wall.jumpAt;
    if (playToEnd(sim).outcome === 'goal') goals++;
  }
  return goals / (FK.xgotSamples + 1);
}

export const streakMultiplier = (streak: number) =>
  Math.min(FK.streakMax, 1 + FK.streakStep * Math.max(0, streak - 1));

// A goal's points: harder spots (lower xG) are worth more, better finishes
// (higher xGOT) up to three times a weak one, times the streak (`streak`
// counts this goal).
export const goalPoints = (xg: number, xgot: number, streak: number) =>
  Math.round(
    (FK.pointsPerXg / clamp(xg, FK.xgMin, 1)) *
      (FK.finishBase + clamp(xgot, 0, 1)) *
      streakMultiplier(streak)
  );

// What a great save scores (it costs no life).
export const greatSavePoints = (xgot: number) =>
  Math.round(FK.greatSavePoints * clamp(xgot, 0, 1));

// ---- The challenge ---------------------------------------------------------

// A challenge post's round `round` (0 = first spot): its difficulty's
// level for that round, a fixed per-post angle, the spot within
// FK.challengeDistanceRangeM of the post's distance (never nearer than
// FK.challengeNearestM nor beyond FK.maxDistance) and the wall at the
// post's distance from goal.
export function challengeKick(
  config: FreeKickChallengeConfig,
  round: number,
  postId: string
): KickSetup {
  const progress = challengeProgress(
    round,
    config.mode === 'infinity'
      ? (FK.maxLevel - FK.infinityStartLevel) * FK.infinityGoalsPerLevel + 1
      : config.goals
  );
  const level = levelFor(
    (freeKickRoundLevel(config, round) - 1) * FK.goalsPerLevel
  );
  const rand = challengeRandom(
    postId,
    config.mode === 'infinity' && progress === 1 ? `layout:${round}` : 'layout'
  );
  const side = rand() < 0.5 ? -1 : 1;
  const postAngle = lerp(
    FK.challengePostAngleShare[0],
    FK.challengePostAngleShare[1],
    rand()
  );
  const angle =
    side *
    (round % 2 ? -1 : 1) *
    level.maxAngle *
    postAngle *
    lerp(FK.challengeAngleShare[0], FK.challengeAngleShare[1], progress);
  const nearest = Math.max(
    FK.challengeNearestM,
    config.distanceM - FK.challengeDistanceRangeM
  );
  const furthest = Math.min(
    FK.maxDistance / FK.pxPerMetre,
    config.distanceM + FK.challengeDistanceRangeM
  );
  return makeKick(level, rand, {
    distance: lerp(nearest, furthest, progress) * FK.pxPerMetre,
    wallFromGoal: config.wallFromGoalM * FK.pxPerMetre,
    angle,
  });
}

// Practice uses the same post geometry as Challenge, at a fixed chosen level.
export function practiceKick(
  config: FreeKickChallengeConfig,
  level: number,
  rand: () => number
): KickSetup {
  return configuredKick(config, clamp(Math.round(level), 1, FK.maxLevel), rand);
}
// A Playground kick: exactly as built. Seeded by the kick itself, so the
// builder's preview, its test shots and the shared post all set up the
// same (the keeper's stance included).
export function customKick(kick: CustomKick): KickSetup {
  const level = {
    ...levelFor((customLevel(kick) - 1) * FK.goalsPerLevel),
    wallMen: kick.wallMen,
    wallJumpChance: kick.jump ? 1 : 0,
  };
  return makeKick(level, challengeRandom('playground', JSON.stringify(kick)), {
    distance: kick.distanceM * FK.pxPerMetre,
    wallFromGoal: (kick.distanceM - kick.wallGapM) * FK.pxPerMetre,
    angle: (kick.angleDeg * Math.PI) / 180,
    lyer: kick.lyer,
    shift: -kick.wallShift * FK.customShiftPx, // the kicker's right is world -y
  });
}

// A ranked run's kick for this round: a Playground post's one kick, or
// the next of a Challenge or Infinity post's fixed sequence.
export function postKick(
  config: FreeKickChallengeConfig,
  round: number,
  postId: string
): KickSetup {
  return config.mode === 'custom' && config.custom
    ? customKick(config.custom)
    : challengeKick(config, round, postId);
}

function configuredKick(
  config: FreeKickChallengeConfig,
  level: number,
  rand: () => number
): KickSetup {
  const metres =
    config.distanceM + (rand() * 2 - 1) * FK.challengeDistanceRangeM;
  const distance = clamp(
    metres * FK.pxPerMetre,
    FK.challengeNearestM * FK.pxPerMetre,
    FK.maxDistance
  );
  return makeKick(levelFor((level - 1) * FK.goalsPerLevel), rand, {
    distance,
    wallFromGoal: config.wallFromGoalM * FK.pxPerMetre,
  });
}

// ---- Scoring and the power guide -------------------------------------------

export type GoalScore = { points: number; tags: string[] };

// A goal's points (goalPoints) and its style tags, which are labels only.
export function scoreGoal(
  play: KickPlay,
  streak: number,
  xg: number,
  xgot: number
): GoalScore {
  const tags: string[] = [];
  const c = play.crossed;
  if (c && c.z >= BAR_Z * 0.6 && Math.abs(c.y - GOAL_Y) >= POST_HALF - 55)
    tags.push('TOP BINS');
  if (play.overWall) tags.push('OVER THE WALL');
  if (play.underWall) tags.push('UNDER THE WALL');
  if (Math.abs(play.strike.contact.x) >= 0.5) tags.push('CURLER');
  if (play.hitPost) tags.push('OFF THE POST');
  if (play.setup.distance >= FK.longRange) tags.push('LONG RANGE');
  return { points: goalPoints(xg, xgot, streak), tags };
}

// The power range that clears the wall's height and stays below the bar,
// using the selected contact and a launch heading toward the wall.
export function powerBand(setup: KickSetup, contact: Contact) {
  const { spot, wall } = setup;
  if (wall.men.length === 0) return null;
  const mid = wall.men.reduce((sum, m) => sum + m, 0) / wall.men.length;
  const targetY = clamp(
    spot.y + ((mid - spot.y) * (GOAL_X - spot.x)) / (wall.x - spot.x),
    GOAL_Y - POST_HALF + 20,
    GOAL_Y + POST_HALF - 20
  );
  const jumping = { ...wall, jumpAt: FK.wallReactSec };
  let lo = -1;
  let hi = -1;
  for (let i = 0; i <= 50; i++) {
    const power = i / 50;
    const ball = strikeBall(spot, { power, targetY, contact });
    const over = crossing(ball, wall.x);
    const under = crossing(ball, GOAL_X);
    if (
      over &&
      under &&
      over.z - R * 0.8 >= wallTop(jumping, over.t) &&
      under.z < BAR_Z - R
    ) {
      if (lo < 0) lo = power;
      hi = power;
    }
  }
  return lo < 0 ? null : { lo, hi };
}
