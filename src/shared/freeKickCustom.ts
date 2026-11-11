import { FREE_KICK as FK, PITCH } from './tuning';
import {
  DIFFICULTIES,
  JERSEY_COLORS,
  type Difficulty,
  type JerseyColor,
} from './types';

// A Playground kick (user request, 2026-11-11): one fixed free kick a
// player builds, plays and shares as its own post with one life. Every
// number is a whole step so the builder's arrows and the server's checks
// agree exactly.
export type CustomKick = {
  distanceM: number; // shot distance from the goal centre
  angleDeg: number; // off the centre line: above 0 left of it from the kicker, below 0 right
  wallGapM: number; // the wall's distance from the ball
  wallShift: number; // steps of FK.customShiftPx: above 0 to the kicker's right
  wallMen: number; // including one lying behind the wall
  jump: boolean; // the wall jumps at the strike
  lyer: boolean; // one man lies behind the wall (needs 3+)
  difficulty: Difficulty; // keeper sharpness and wall jump height
};

// What a shared Playground post saves besides the kick.
export type CustomSetup = {
  kick: CustomKick;
  kicker: JerseyColor;
  wall: JerseyColor;
  title: string;
};

export const CUSTOM_KICK_DEFAULT: CustomKick = {
  distanceM: 25,
  angleDeg: 10,
  wallGapM: 9,
  wallShift: 0,
  wallMen: 3,
  jump: true,
  lyer: false,
  difficulty: 'normal',
};

// The widest angle from this distance that keeps the spot outside the box.
export function customMaxAngle(distanceM: number) {
  const d = distanceM * FK.pxPerMetre;
  const inside = (PITCH.boxDepth + FK.customBoxClearance) / d;
  const clear = inside >= 1 ? 0 : (Math.acos(inside) * 180) / Math.PI;
  return Math.min(FK.customMaxAngleDeg, Math.floor(clear));
}

// The furthest the wall may stand from the ball at this distance.
export function customMaxWallGap(distanceM: number) {
  return Math.max(
    FK.customWallGapM[0],
    Math.min(FK.customWallGapM[1], distanceM - FK.customWallFromGoalM)
  );
}

export const customLevel = (kick: CustomKick) =>
  FK.difficultyLevels[kick.difficulty];

const whole = (value: unknown, lo: number, hi: number) =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= lo &&
  value <= hi
    ? value
    : null;

// The kick, or why it can't be played.
export function parseCustomKick(raw: unknown): CustomKick | string {
  if (typeof raw !== 'object' || raw === null) return 'missing kick';
  const get = (key: string): unknown => Reflect.get(raw, key);
  const [nearest, furthest] = FK.customDistanceM;
  const distanceM = whole(get('distanceM'), nearest, furthest);
  if (distanceM === null) return `shot distance: ${nearest} to ${furthest} m`;
  const maxAngle = customMaxAngle(distanceM);
  const angleDeg = whole(get('angleDeg'), -maxAngle, maxAngle);
  if (angleDeg === null)
    return `angle at ${distanceM} m: up to ${maxAngle} degrees either side`;
  const maxGap = customMaxWallGap(distanceM);
  const wallGapM = whole(get('wallGapM'), FK.customWallGapM[0], maxGap);
  if (wallGapM === null)
    return `wall distance from the ball: ${FK.customWallGapM[0]} to ${maxGap} m`;
  const wallShift = whole(
    get('wallShift'),
    -FK.customShiftSteps,
    FK.customShiftSteps
  );
  if (wallShift === null) return 'wall sideways shift out of range';
  const [fewest, most] = FK.customWallMen;
  const wallMen = whole(get('wallMen'), fewest, most);
  if (wallMen === null) return `wall players: ${fewest} to ${most}`;
  const jump = get('jump');
  const lyer = get('lyer');
  if (typeof jump !== 'boolean' || typeof lyer !== 'boolean')
    return 'choose the wall jump and lying player';
  if (lyer && wallMen < 3) return 'a lying player needs 3 or more in the wall';
  const difficulty = DIFFICULTIES.find((d) => d === get('difficulty'));
  if (!difficulty) return 'choose a difficulty';
  return {
    distanceM,
    angleDeg,
    wallGapM,
    wallShift,
    wallMen,
    jump,
    lyer,
    difficulty,
  };
}

// Titles are shown on the post and in the game: one plain line.
export function parseCustomTitle(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const title = raw.replace(/\s+/g, ' ').trim();
  return title.length >= 3 && title.length <= FK.customTitleMax ? title : null;
}

// A saved draft may be untitled (title ''); a shared setup may not.
export function parseCustomSetup(
  raw: unknown,
  draft = false
): CustomSetup | string {
  if (typeof raw !== 'object' || raw === null) return 'missing setup';
  const kick = parseCustomKick(Reflect.get(raw, 'kick'));
  if (typeof kick === 'string') return kick;
  const kicker = JERSEY_COLORS.find((c) => c === Reflect.get(raw, 'kicker'));
  const wall = JERSEY_COLORS.find((c) => c === Reflect.get(raw, 'wall'));
  if (!kicker || !wall) return 'choose both kits';
  if (kicker === wall) return 'the kicker and the wall need different kits';
  const rawTitle: unknown = Reflect.get(raw, 'title');
  const untitled =
    draft && typeof rawTitle === 'string' && rawTitle.trim() === '';
  const title = untitled ? '' : parseCustomTitle(rawTitle);
  if (title === null)
    return `title: 3 to ${FK.customTitleMax} characters`;
  return { kick, kicker, wall, title };
}
