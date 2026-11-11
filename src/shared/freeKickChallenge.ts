import { FREE_KICK as FK } from './tuning';
import {
  DIFFICULTIES,
  JERSEY_COLORS,
  type Difficulty,
  type JerseyColor,
} from './types';
import {
  customLevel,
  parseCustomKick,
  type CustomKick,
} from './freeKickCustom';

// A Free Kick post's Challenge settings, chosen by its creator and saved as
// the post's postData `freeKick` (server/core/post.ts). Older Free Kick
// posts have none and play FREE_KICK_CHALLENGE_DEFAULT.
export type FreeKickChallengeConfig = {
  mode?: 'challenge' | 'infinity' | 'custom';
  custom?: CustomKick; // a Playground post's one fixed kick (mode 'custom')
  kicker: JerseyColor; // the kicker's kit
  wall: JerseyColor; // the wall's kit
  lives: number; // misses allowed
  goals: number; // goals to win
  distanceM: number; // base distance; the fixed sequence progresses around it
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
  const mode: unknown = get('mode');
  if (
    mode !== undefined &&
    mode !== 'challenge' &&
    mode !== 'infinity' &&
    mode !== 'custom'
  )
    return 'choose a Free Kick mode';
  // A Playground post: its one kick, one life, until the first miss.
  if (mode === 'custom') {
    const custom = parseCustomKick(get('custom'));
    if (typeof custom === 'string') return custom;
    return {
      mode,
      custom,
      kicker,
      wall,
      lives: 1,
      goals: 0,
      distanceM: custom.distanceM,
      wallFromGoalM: custom.distanceM - custom.wallGapM,
      difficulty: custom.difficulty,
    };
  }
  const lives = whole(get('lives'), 1, FK.challengeMaxLives);
  if (lives === null) return `lives: 1 to ${FK.challengeMaxLives}`;
  if (mode === 'infinity')
    return {
      ...FREE_KICK_CHALLENGE_DEFAULT,
      mode,
      kicker,
      wall,
      lives,
      goals: 0,
      difficulty: 'easy',
    };
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

// Infinity and Playground runs have no goal target: they end on lives.
export const endlessFreeKick = (config: FreeKickChallengeConfig) =>
  config.mode === 'infinity' || config.mode === 'custom';

// The ranked mode a post's runs are saved under.
export const freeKickRankedMode = (config: FreeKickChallengeConfig) =>
  config.mode === 'infinity' || config.mode === 'custom'
    ? config.mode
    : 'challenge';

export function freeKickRoundLevel(
  config: FreeKickChallengeConfig,
  goals: number
) {
  if (config.mode === 'custom' && config.custom)
    return customLevel(config.custom);
  return config.mode === 'infinity'
    ? Math.min(
        FK.maxLevel,
        FK.infinityStartLevel +
          Math.floor(Math.max(0, goals) / FK.infinityGoalsPerLevel)
      )
    : challengeRoundLevel(config.difficulty, goals, config.goals);
}
export function freeKickSkill(level: number) {
  return level >= FK.challengeLevels.pro[0]
    ? 'PRO'
    : level >= FK.challengeLevels.hard[0]
      ? 'HARD'
      : level >= FK.challengeLevels.normal[0]
        ? 'NORMAL'
        : 'EASY';
}

// Progress spans this post's full goal target; one-goal posts use the first spot.
export function challengeProgress(round: number, goals: number) {
  return goals <= 1 ? 0 : Math.min(1, Math.max(0, round) / (goals - 1));
}

// Spread the difficulty range across the whole challenge, not just early goals.
export function challengeRoundLevel(
  difficulty: Difficulty,
  round: number,
  goals: number
) {
  const [first, top] = FK.challengeLevels[difficulty];
  return Math.floor(first + (top - first) * challengeProgress(round, goals));
}

// Stable per-post streams: never use user identity, date or attempt counters.
// Separate layout/defence streams prevent shot retries from rerolling a setup.
export function challengeRandom(postId: string, stream: string) {
  let seed = 2166136261;
  for (const char of `freekick-v1:${postId}:${stream}`)
    seed = Math.imul(seed ^ char.charCodeAt(0), 16777619);
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

// Where the challenge stands: won on the goals, lost when out of lives.
export function challengeOutcome(
  goals: number,
  lives: number,
  config: FreeKickChallengeConfig
): 'won' | 'lost' | 'open' {
  if (!endlessFreeKick(config) && goals >= config.goals) return 'won';
  return lives <= 0 ? 'lost' : 'open';
}
