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
  wallGapM: number; // the wall's distance from the ball, every round
  difficulty: Difficulty; // where the rounds start and how hard they get
};

export const FREE_KICK_CHALLENGE_DEFAULT: FreeKickChallengeConfig = {
  kicker: 'pink',
  wall: 'blue',
  lives: 3,
  goals: 5,
  distanceM: 25,
  wallGapM: 9,
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

// The wall's distance from the ball: one of the choices, or (older posts)
// what their saved distance from goal left at the base distance, capped
// at the furthest choice so a far spot no longer leaves the wall far off.
function wallGap(gap: unknown, legacyFromGoal: unknown, distanceM: number) {
  const choices = FK.challengeWallGapChoicesM;
  if (gap !== undefined) return choice(gap, choices);
  const fromGoal = choice(legacyFromGoal, FK.challengeWallChoicesM);
  if (fromGoal === null || distanceM - fromGoal < FK.challengeWallGapM)
    return null;
  return Math.min(
    choices[choices.length - 1] ?? FK.challengeWallGapM,
    distanceM - fromGoal
  );
}

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
  // A Playground post: its one kick, retaken until it is scored (a
  // one-goal target; misses cost no life but each retry lowers the
  // spot's prize, as in Practice). `lives` is unused for it.
  if (mode === 'custom') {
    const custom = parseCustomKick(get('custom'));
    if (typeof custom === 'string') return custom;
    return {
      mode,
      custom,
      kicker,
      wall,
      lives: 1,
      goals: 1,
      distanceM: custom.distanceM,
      wallGapM: custom.wallGapM,
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
  // The wall stands this far from the ball on every round (user request,
  // 2026-11-11). Posts made before that saved its distance from goal
  // (`wallFromGoalM`): read as the gap it left at the base distance.
  const wallGapM = wallGap(get('wallGapM'), get('wallFromGoalM'), distanceM);
  if (wallGapM === null) return 'choose a wall distance';
  const difficulty = choice(get('difficulty'), DIFFICULTIES);
  if (difficulty === null) return 'choose a difficulty';
  return { kicker, wall, lives, goals, distanceM, wallGapM, difficulty };
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

// Infinity runs have no goal target: they end on lives. (A Playground
// post is a one-shot run: one goal to win, one life.)
export const endlessFreeKick = (config: FreeKickChallengeConfig) =>
  config.mode === 'infinity';

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
    : challengeRoundLevel(config.difficulty);
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

// An Infinity run's Pro+ tier after `goals` goals: 0 up to level 10, then
// one more every FK.infinityGoalsPerLevel goals (1 = PRO 2), capped.
export function infinityTier(goals: number) {
  const steps =
    Math.floor(Math.max(0, goals) / FK.infinityGoalsPerLevel) -
    (FK.maxLevel - FK.infinityStartLevel);
  return Math.max(0, Math.min(FK.infinityMaxTier, steps));
}

// What an Infinity run is called after `goals` goals: EASY .. PRO, PRO 2 ...
export function infinitySkill(goals: number) {
  const tier = infinityTier(goals);
  if (tier > 0) return `PRO ${tier + 1}`;
  return freeKickSkill(
    Math.min(
      FK.maxLevel,
      FK.infinityStartLevel +
        Math.floor(Math.max(0, goals) / FK.infinityGoalsPerLevel)
    )
  );
}

// Progress spans this post's full goal target; one-goal posts use the first spot.
export function challengeProgress(round: number, goals: number) {
  return goals <= 1 ? 0 : Math.min(1, Math.max(0, round) / (goals - 1));
}

// Every round of a Challenge plays at its difficulty's one level, whatever
// the goal target (the spots still move further out and wider).
export const challengeRoundLevel = (difficulty: Difficulty) =>
  FK.difficultyLevels[difficulty];

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
  // A Playground post is retried until it is scored: it is never lost.
  if (config.mode === 'custom') return 'open';
  return lives <= 0 ? 'lost' : 'open';
}
