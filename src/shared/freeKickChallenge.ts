import { FREE_KICK as FK } from './tuning';
import {
  DIFFICULTIES,
  JERSEY_COLORS,
  type Difficulty,
  type JerseyColor,
} from './types';

// A Free Kick post's Challenge settings, chosen by its creator and saved as
// the post's postData `freeKick` (server/core/post.ts). Older Free Kick
// posts have none and play FREE_KICK_CHALLENGE_DEFAULT.
export type FreeKickChallengeConfig = {
  kicker: JerseyColor; // the kicker's kit
  wall: JerseyColor; // the wall's kit
  lives: number; // misses allowed
  goals: number; // goals to win
  distanceM: number; // shot distance from goal; each round varies around it
  wallFromGoalM: number; // the wall's distance from goal
  difficulty: Difficulty; // where the rounds start and how hard they get
};

export const FREE_KICK_CHALLENGE_DEFAULT: FreeKickChallengeConfig = {
  kicker: 'pink',
  wall: 'blue',
  lives: 3,
  goals: 5,
  distanceM: 25,
  wallFromGoalM: 14,
  difficulty: 'normal',
};

const choice = <T extends string | number>(
  value: unknown,
  choices: readonly T[]
): T | null => choices.find((c) => c === value) ?? null;

const whole = (value: unknown, lo: number, hi: number) =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= lo &&
  value <= hi
    ? value
    : null;

// The settings, or why they can't be played.
export function parseFreeKickChallenge(
  raw: unknown
): FreeKickChallengeConfig | string {
  if (typeof raw !== 'object' || raw === null) return 'missing settings';
  const get = (key: string): unknown => Reflect.get(raw, key);
  const kicker = choice(get('kicker'), JERSEY_COLORS);
  const wall = choice(get('wall'), JERSEY_COLORS);
  if (!kicker || !wall) return 'choose both team colours';
  if (kicker === wall) return 'the kicker and the wall need different colours';
  const lives = whole(get('lives'), 1, FK.challengeMaxLives);
  if (lives === null) return `lives: 1 to ${FK.challengeMaxLives}`;
  const goals = whole(get('goals'), 1, FK.challengeMaxGoals);
  if (goals === null) return `goals to win: 1 to ${FK.challengeMaxGoals}`;
  const distanceM = choice(get('distanceM'), FK.challengeDistanceChoicesM);
  if (distanceM === null) return 'choose a shot distance';
  const wallFromGoalM = choice(get('wallFromGoalM'), FK.challengeWallChoicesM);
  if (wallFromGoalM === null) return 'choose a wall distance';
  if (distanceM - wallFromGoalM < FK.challengeWallGapM)
    return `the wall must stand at least ${FK.challengeWallGapM} m in front of the ball: at ${distanceM} m, at most ${distanceM - FK.challengeWallGapM} m from goal`;
  const difficulty = choice(get('difficulty'), DIFFICULTIES);
  if (difficulty === null) return 'choose a difficulty';
  return { kicker, wall, lives, goals, distanceM, wallFromGoalM, difficulty };
}

// A post's saved settings (its postData), or the default for older posts.
export function postFreeKickChallenge(postData: unknown) {
  const raw: unknown =
    typeof postData === 'object' && postData !== null
      ? Reflect.get(postData, 'freeKick')
      : undefined;
  const config = parseFreeKickChallenge(raw);
  return typeof config === 'string' ? FREE_KICK_CHALLENGE_DEFAULT : config;
}

// Round `round` (0 = the first spot)'s level: one harder per round, from
// the difficulty's first level up to its top.
export function challengeRoundLevel(difficulty: Difficulty, round: number) {
  const [first, top] = FK.challengeLevels[difficulty];
  return Math.min(top, first + Math.max(0, Math.floor(round)));
}

// Where the challenge stands: won on the goals, lost when out of lives.
export function challengeOutcome(
  goals: number,
  lives: number,
  config: FreeKickChallengeConfig
): 'won' | 'lost' | 'open' {
  if (goals >= config.goals) return 'won';
  return lives <= 0 ? 'lost' : 'open';
}
