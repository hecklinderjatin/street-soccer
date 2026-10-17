import { redis } from '@devvit/web/server';
import type {
  DailyLeader,
  DailyLeadersResponse,
  MatchStats,
} from '../../shared/api';
import { readStats } from './matchStats';

// Today's leaderboard for one post (a challenge): each player's best match
// of the UTC day, ranked by goal difference, then goals scored. Kept a week
// after the day ends.

const KEEP_SEC = 8 * 24 * 60 * 60;
const TOP = 3;

export const today = () => new Date().toISOString().slice(0, 10);
export const boardKey = (postId: string, day: string) =>
  `daily:${postId}:${day}`;
export const statsKey = (postId: string, day: string) =>
  `daily:${postId}:${day}:stats`;

// Higher is better: goal difference first, then goals scored.
const rankScore = (s: MatchStats) =>
  (s.goalsFor - s.goalsAgainst + 1000) * 1000 + s.goalsFor;

function readSaved(json: string | undefined): MatchStats | null {
  if (!json) return null;
  try {
    const parsed: unknown = JSON.parse(json);
    const stats = readStats(parsed, null);
    return typeof stats === 'string' ? null : stats;
  } catch {
    return null;
  }
}

// Keeps the match if it is the player's best today.
export async function saveResult(
  postId: string,
  username: string,
  stats: MatchStats
) {
  const day = today();
  const board = boardKey(postId, day);
  const score = rankScore(stats);
  const best = await redis.zScore(board, username);
  if (best !== undefined && best !== null && best >= score) return;
  await redis.zAdd(board, { member: username, score });
  await redis.hSet(statsKey(postId, day), {
    [username]: JSON.stringify(stats),
  });
  await redis.expire(board, KEEP_SEC);
  await redis.expire(statsKey(postId, day), KEEP_SEC);
}

export async function dailyLeaders(
  postId: string,
  username: string | null,
  limit = TOP
): Promise<DailyLeadersResponse> {
  const day = today();
  const board = boardKey(postId, day);
  const count = Number.isFinite(limit)
    ? Math.max(1, Math.min(25, Math.floor(limit)))
    : TOP;
  const top = await redis.zRange(board, 0, count - 1, {
    by: 'rank',
    reverse: true,
  });
  const leader = async (
    name: string,
    rank: number
  ): Promise<DailyLeader | null> => {
    const stats = readSaved(await redis.hGet(statsKey(postId, day), name));
    return stats ? { ...stats, rank, username: name } : null;
  };
  const leaders: DailyLeader[] = [];
  for (const [i, entry] of top.entries()) {
    const l = await leader(entry.member, i + 1);
    if (l) leaders.push(l);
  }
  let me: DailyLeader | null = null;
  if (username) {
    const ascending = await redis.zRank(board, username);
    const total = await redis.zCard(board);
    if (ascending !== undefined && ascending !== null)
      me = await leader(username, total - ascending);
  }
  return { day, top: leaders, me };
}
