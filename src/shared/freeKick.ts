import {
  challengeRoundLevel,
  type FreeKickChallengeConfig,
} from './freeKickChallenge';
import { FREE_KICK as FK, GOAL_FEEDBACK } from './tuning';

export type FreeKickStats = {
  mode: 'play' | 'challenge';
  score: number;
  goals: number;
  shots: number;
  bestStreak: number;
  level: number;
  fastestGoalKmh: number;
  elapsedSec: number;
  greatSaves: number; // saved shots on target that cost no life
  xg: number; // the run's expected goals (sum over shots), in hundredths
};
export type FreeKickRun = { id: string; day: string };
export type FreeKickLeader = { rank: number; username: string; value: number };
export type FreeKickBoard = {
  top: FreeKickLeader[];
  me: FreeKickLeader | null;
};
export type FreeKickBoards = {
  day: string;
  score: FreeKickBoard;
  speed: FreeKickBoard;
};
export const freeKickMaxKmh = Math.ceil(
  Math.hypot(
    FK.speedMax * (FK.maxDistance / FK.rangeDistance) ** FK.rangeExp,
    FK.liftMax + FK.chipLift
  ) * GOAL_FEEDBACK.kmhPerUnit
);
export const freeKickRunId = (value: unknown) =>
  typeof value === 'string' && /^[a-zA-Z0-9-]{16,64}$/.test(value)
    ? value
    : null;
export const freeKickDay = (value: unknown) =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(`${value}T00:00:00Z`))
    ? value
    : null;

export function readFreeKickStats(
  body: unknown,
  challenge?: FreeKickChallengeConfig
): FreeKickStats | null {
  if (!body || typeof body !== 'object') return null;
  const mode: unknown = Reflect.get(body, 'mode');
  if (mode !== 'play' && mode !== 'challenge') return null;
  if (mode === 'challenge' && !challenge) return null;
  const integer = (key: string, max: number) => {
    const v: unknown = Reflect.get(body, key);
    return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= max
      ? v
      : null;
  };
  // (Runs saved before xG scoring have neither of the last two: 0.)
  const optional = (key: string, max: number) =>
    Reflect.get(body, key) === undefined ? 0 : integer(key, max);
  const score = integer('score', 60_000_000),
    goals = integer('goals', 10_000),
    shots = integer('shots', 20_003);
  const bestStreak = integer('bestStreak', 10_000),
    level = integer('level', FK.maxLevel);
  const fastestGoalKmh = integer('fastestGoalKmh', freeKickMaxKmh),
    elapsedSec = integer('elapsedSec', 86_400);
  const greatSaves = optional('greatSaves', 10_000),
    xg = optional('xg', 2_000_300);
  if (
    score === null ||
    goals === null ||
    shots === null ||
    bestStreak === null ||
    level === null ||
    fastestGoalKmh === null ||
    elapsedSec === null ||
    greatSaves === null ||
    xg === null
  )
    return null;
  if (
    elapsedSec + 1 <
      (shots * (FK.runupSec + FK.resultSec) - FK.resultSec) * 0.7 ||
    (goals > 0 && fastestGoalKmh === 0)
  )
    return null;
  if (
    (mode === 'play' && shots !== goals + FK.lives + greatSaves) ||
    bestStreak > goals ||
    (goals > 0 && bestStreak < 1)
  )
    return null;
  if (mode === 'challenge' && challenge) {
    const misses = shots - goals;
    const won = goals === challenge.goals;
    if (
      goals > challenge.goals ||
      greatSaves !== 0 ||
      misses < 0 ||
      (won ? misses >= challenge.lives : misses !== challenge.lives) ||
      level !==
        challengeRoundLevel(
          challenge.difficulty,
          Math.max(0, goals - (won ? 1 : 0))
        )
    )
      return null;
  } else if (
    level !== Math.min(FK.maxLevel, 1 + Math.floor(goals / FK.goalsPerLevel))
  )
    return null;
  // Every shot's xG lies in [xgMin, max(xgMax, xgRetryMax)] (0: not sent).
  if (
    xg > 0 &&
    (xg < Math.floor(shots * FK.xgMin * 100) ||
      xg > Math.ceil(shots * Math.max(FK.xgMax, FK.xgRetryMax) * 100))
  )
    return null;
  if (
    (goals === 0 && fastestGoalKmh !== 0) ||
    score < goals * freeKickGoalMin ||
    score > goals * freeKickGoalMax + greatSaves * FK.greatSavePoints
  )
    return null;
  return {
    mode,
    score,
    goals,
    shots,
    bestStreak,
    level,
    fastestGoalKmh,
    elapsedSec,
    greatSaves,
    xg,
  };
}

// The fewest and most points a single goal can score (rules.ts
// goalPoints): the easiest retried spot with the weakest finish and no
// streak, and the hardest spot with a perfect finish at the top streak.
export const freeKickGoalMin = Math.floor(
  (FK.pointsPerXg / Math.max(FK.xgMax, FK.xgRetryMax)) * FK.finishBase
);
export const freeKickGoalMax = Math.ceil(
  (FK.pointsPerXg / FK.xgMin) * (FK.finishBase + 1) * FK.streakMax
);

export function rankFreeKicks(
  entries: readonly { member: string; score: number }[],
  username: string | null,
  limit = 3
): FreeKickBoard {
  const best = new Map<string, number>();
  for (const row of entries)
    if (
      Number.isFinite(row.score) &&
      row.score >= 0 &&
      row.score > (best.get(row.member) ?? -1)
    )
      best.set(row.member, row.score);
  const rows = [...best]
    .sort(([a, x], [b, y]) => y - x || a.localeCompare(b))
    .map(([name, value], i) => ({ username: name, value, rank: i + 1 }));
  return {
    top: rows.slice(0, limit),
    me: rows.find((row) => row.username === username) ?? null,
  };
}
