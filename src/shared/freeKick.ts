import { FREE_KICK as FK, GOAL_FEEDBACK } from './tuning';

export type FreeKickStats = {
  mode: 'play';
  score: number;
  goals: number;
  shots: number;
  bestStreak: number;
  level: number;
  fastestGoalKmh: number;
  elapsedSec: number;
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

export function readFreeKickStats(body: unknown): FreeKickStats | null {
  if (!body || typeof body !== 'object' || Reflect.get(body, 'mode') !== 'play')
    return null;
  const integer = (key: string, max: number) => {
    const v: unknown = Reflect.get(body, key);
    return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= max
      ? v
      : null;
  };
  const score = integer('score', 12_000_000),
    goals = integer('goals', 10_000),
    shots = integer('shots', 10_003);
  const bestStreak = integer('bestStreak', 10_000),
    level = integer('level', FK.maxLevel);
  const fastestGoalKmh = integer('fastestGoalKmh', freeKickMaxKmh),
    elapsedSec = integer('elapsedSec', 86_400);
  if (
    score === null ||
    goals === null ||
    shots === null ||
    bestStreak === null ||
    level === null ||
    fastestGoalKmh === null ||
    elapsedSec === null
  )
    return null;
  if (
    elapsedSec + 1 <
      (shots * (FK.runupSec + FK.resultSec) - FK.resultSec) * 0.7 ||
    (goals > 0 && fastestGoalKmh === 0)
  )
    return null;
  if (
    shots !== goals + FK.lives ||
    bestStreak > goals ||
    (goals > 0 && bestStreak < 1)
  )
    return null;
  if (level !== Math.min(FK.maxLevel, 1 + Math.floor(goals / FK.goalsPerLevel)))
    return null;
  if (
    (goals === 0 && (score !== 0 || fastestGoalKmh !== 0)) ||
    score < goals * FK.goalPoints ||
    score > goals * (FK.goalPoints + FK.bonusPoints * 6) * FK.streakMax
  )
    return null;
  return {
    mode: 'play',
    score,
    goals,
    shots,
    bestStreak,
    level,
    fastestGoalKmh,
    elapsedSec,
  };
}

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
