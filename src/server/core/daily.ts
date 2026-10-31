import { resultRankScore } from '../../shared/dailyMode';
import { rankSpeeds, saveSpeed, speedKey } from './speedBoard';
import { gamesDeletedKey } from './gamesPlayed';
import { redis } from '@devvit/web/server';
import type {
  DailyLeader,
  DailyLeadersResponse,
  MatchStats,
  SpeedLeadersResponse,
} from '../../shared/api';
import { readStats } from './matchStats';
import {
  boardExpiry,
  deletionInProgress,
  registerBoard,
  WINDOW_DAYS,
} from './privacy';

// One post's (a challenge's) leaderboard: each player's best match of the
// last 7 UTC days (today included), ranked by goal difference, then goals
// scored. Stored as one board per UTC day; a day is deleted when it becomes
// the 8th day back.

const TOP = 3;

export const today = () => new Date().toISOString().slice(0, 10);
// Today first, then the previous WINDOW_DAYS - 1 UTC days.
const windowDays = () => {
  const start = Date.parse(`${today()}T00:00:00Z`);
  return Array.from({ length: WINDOW_DAYS }, (_, back) =>
    new Date(start - back * 86_400_000).toISOString().slice(0, 10)
  );
};
export const boardKey = (postId: string, day: string) =>
  `daily:${postId}:${day}`;
export const statsKey = (postId: string, day: string) =>
  `daily:${postId}:${day}:stats`;

// Higher is better: goal difference first, then goals scored.
const rankScore = resultRankScore;

function readSaved(json: string | undefined): MatchStats | null {
  if (!json) return null;
  try {
    const parsed: unknown = JSON.parse(json);
    const stats = readStats(parsed, null, true);
    return typeof stats === 'string' ? null : stats;
  } catch {
    return null;
  }
}

// Keeps the match if it is the player's best today.
export async function saveResult(
  postId: string,
  username: string,
  stats: MatchStats,
  fixed = false
) {
  const day = today();
  const board = boardKey(postId, day);
  if (await deletionInProgress(username)) return;
  await registerBoard(board, day);
  if (fixed && stats.fastestGoalKmh) {
    const key = speedKey(postId, day);
    try {
      await registerBoard(key, day);
      await saveSpeed(
        redis,
        key,
        username,
        stats.fastestGoalKmh,
        boardExpiry(day),
        [`privacy:deleting:${username}`, gamesDeletedKey(postId)]
      );
    } catch (error) {
      console.warn('Speed record unavailable; retaining match result:', error);
    }
  }
  const score = rankScore(stats);
  const best = await redis.zScore(board, username);
  if (best !== undefined && best !== null && best >= score) return;
  await redis.zAdd(board, { member: username, score });
  await redis.hSet(statsKey(postId, day), {
    [username]: JSON.stringify(stats),
  });
  const ttl = Math.ceil((boardExpiry(day) - Date.now()) / 1000);
  await redis.expire(board, ttl);
  await redis.expire(statsKey(postId, day), ttl);
  if (await deletionInProgress(username)) {
    await redis.zRem(board, [username]);
    await redis.hDel(statsKey(postId, day), [username]);
  }
}

export async function dailyLeaders(
  postId: string,
  username: string | null,
  limit = TOP
): Promise<DailyLeadersResponse> {
  const count = Number.isFinite(limit)
    ? Math.max(1, Math.min(25, Math.floor(limit)))
    : TOP;
  // Each player's best score across the window, and the day it was set.
  const best = new Map<string, { score: number; day: string }>();
  for (const day of windowDays()) {
    const entries = await redis.zRange(boardKey(postId, day), 0, -1, {
      by: 'rank',
    });
    for (const { member, score } of entries) {
      const prev = best.get(member);
      if (!prev || score > prev.score) best.set(member, { score, day });
    }
  }
  const ranked = [...best.entries()].sort(
    ([a, x], [b, y]) => y.score - x.score || a.localeCompare(b)
  );
  const leader = async (
    name: string,
    rank: number
  ): Promise<DailyLeader | null> => {
    const day = best.get(name)?.day;
    if (!day) return null;
    const stats = readSaved(await redis.hGet(statsKey(postId, day), name));
    return stats ? { ...stats, rank, username: name } : null;
  };
  const leaders: DailyLeader[] = [];
  for (const [i, [name]] of ranked.slice(0, count).entries()) {
    const l = await leader(name, i + 1);
    if (l) leaders.push(l);
  }
  let me: DailyLeader | null = null;
  if (username) {
    const index = ranked.findIndex(([name]) => name === username);
    if (index >= 0) me = await leader(username, index + 1);
  }
  return { day: today(), top: leaders, me };
}

export async function speedLeaders(
  postId: string,
  username: string | null,
  limit = TOP
): Promise<SpeedLeadersResponse> {
  const count = Number.isFinite(limit)
    ? Math.max(1, Math.min(25, Math.floor(limit)))
    : TOP;
  const days = await Promise.all(
    windowDays().map((day) =>
      redis.zRange(speedKey(postId, day), 0, -1, { by: 'rank' })
    )
  );
  return rankSpeeds(days.flat(), today(), username, count);
}
