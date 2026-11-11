import { postFreeKickChallenge } from '../../shared/freeKickChallenge';
import { context, redis } from '@devvit/web/server';
import { FREE_KICK as FK } from '../../shared/tuning';
import {
  rankFreeKicks,
  readFreeKickStats,
  freeKickDay,
  type FreeKickRun,
  type FreeKickBoard,
  type FreeKickLeader,
  type FreeKickStats,
} from '../../shared/freeKick';
import { boardExpiry, registerBoard, WINDOW_DAYS } from './privacy';
import { gamesDeletedKey, gamesKey } from './gamesPlayed';
import { saveSpeed } from './speedBoard';

export const freeKickKey = (
  post: string,
  day: string,
  kind: 'score' | 'speed' | 'goals' | 'runs' | 'attempts'
) => `fk-${kind}:${post}:${day}`;
const today = () => new Date().toISOString().slice(0, 10);
type Receipt = {
  id: string;
  started: number;
  result: FreeKickStats | null;
  completedDay: string | null;
};
function receipts(raw: string | undefined): Receipt[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    const entries: unknown[] = Array.isArray(parsed) ? parsed : [parsed];
    return entries.flatMap((body) => {
      if (!body || typeof body !== 'object') return [];
      const id: unknown = Reflect.get(body, 'id'),
        started: unknown = Reflect.get(body, 'started');
      if (typeof id !== 'string' || typeof started !== 'number') return [];
      return [
        {
          id,
          started,
          result: readFreeKickStats(
            Reflect.get(body, 'result'),
            postFreeKickChallenge(context.postData)
          ),
          completedDay: freeKickDay(Reflect.get(body, 'completedDay')),
        },
      ];
    });
  } catch {
    return [];
  }
}

// Receipts are indexed by account in the same erasable/expiring board format.
// WATCH makes completion immutable and prevents writes racing with erasure.
export async function freeKickReceipt(
  post: string,
  username: string,
  run: FreeKickRun,
  result?: FreeKickStats
) {
  const board = freeKickKey(post, run.day, 'runs'),
    hash = `${board}:stats`;
  const guards = [`privacy:deleting:${username}`, gamesDeletedKey(post)];
  const attempts = freeKickKey(post, run.day, 'attempts');
  await registerBoard(board, run.day);
  await registerBoard(attempts, run.day);
  for (let attempt = 0; attempt < 3; attempt++) {
    const tx = await redis.watch(hash, ...guards);
    let queued = false;
    try {
      const blocked = (
        await Promise.all(guards.map((key) => redis.get(key)))
      ).some(Boolean);
      const runs = receipts(await redis.hGet(hash, username));
      const previous = runs.find((item) => item.id === run.id);
      if (blocked || boardExpiry(run.day) <= Date.now())
        throw new Error('Run is no longer available');
      if (
        result &&
        (!previous ||
          previous.id !== run.id ||
          Date.now() - previous.started > 86_400_000)
      )
        throw new Error('Start a new run before saving');
      if (
        result &&
        previous?.result &&
        JSON.stringify(previous.result) !== JSON.stringify(result)
      )
        throw new Error('This run was already completed');
      const minimum = result
        ? (result.shots * (FK.runupSec + FK.resultSec) - FK.resultSec) * 0.7
        : 0;
      if (
        result &&
        previous &&
        Date.now() - previous.started + 1000 < minimum * 1000
      )
        throw new Error('Run finished too quickly');
      const next: Receipt =
        previous?.id === run.id
          ? {
              ...previous,
              result: result ?? previous.result,
              completedDay: previous.completedDay ?? (result ? today() : null),
            }
          : {
              id: run.id,
              started: Date.now(),
              result: null,
              completedDay: null,
            };
      await tx.multi();
      queued = true;
      await tx.zAdd(board, { member: username, score: next.started });
      const recent = [
        ...runs.filter(
          (item) =>
            item.id !== next.id && Date.now() - item.started < 86_400_000
        ),
        next,
      ].slice(-16);
      await tx.hSet(hash, { [username]: JSON.stringify(recent) });
      const ttl = Math.ceil((boardExpiry(run.day) - Date.now()) / 1000);
      await tx.expire(board, ttl);
      await tx.expire(hash, ttl);
      // A run's first completion counts once toward the post's games
      // played (the same counter as matches; shown on Playground cards).
      const firstCompletion = Boolean(result) && !previous?.result;
      if (firstCompletion) await tx.incrBy(gamesKey(post), 1);
      // A new run is one attempt for the player's "best in N attempts"
      // (an erasable seven-day board like the scores).
      const newRun = !result && !previous;
      if (newRun) {
        await tx.zIncrBy(attempts, username, 1);
        await tx.expire(attempts, ttl);
      }
      const ops = 4 + (firstCompletion ? 1 : 0) + (newRun ? 2 : 0);
      if ((await tx.exec()).length === ops) return next;
    } catch (error) {
      if (!queued) await tx.multi().catch(() => {});
      await tx.discard().catch(() => {});
      throw error;
    }
  }
  throw new Error('Run busy; please retry');
}
export async function beginFreeKick(
  post: string,
  username: string,
  id: string
) {
  const run = { id, day: today() };
  await freeKickReceipt(post, username, run);
  return run;
}
export async function finishedFreeKick(
  post: string,
  username: string,
  run: FreeKickRun
) {
  const saved = receipts(
    await redis.hGet(`${freeKickKey(post, run.day, 'runs')}:stats`, username)
  ).find((item) => item.id === run.id);
  return saved?.result ?? null;
}
export async function saveFreeKick(
  post: string,
  username: string,
  run: FreeKickRun,
  stats: FreeKickStats
) {
  const receipt = await freeKickReceipt(post, username, run, stats);
  // Only Challenges that reached their goal target rank (user request,
  // 2026-11-11); a failed run is recorded (games played) but not ranked.
  const config = postFreeKickChallenge(context.postData);
  if (stats.mode === 'challenge' && stats.goals < config.goals) return;
  const day = receipt.completedDay ?? run.day,
    guards = [`privacy:deleting:${username}`, gamesDeletedKey(post)];
  for (const [kind, value] of [
    ['score', stats.score],
    ['speed', stats.fastestGoalKmh],
    ['goals', stats.goals], // Infinity's Most Goals board
  ] as const) {
    if (value === 0 && kind !== 'score') continue;
    const key = freeKickKey(post, day, kind);
    await registerBoard(key, day);
    await saveSpeed(redis, key, username, value, boardExpiry(day), guards);
  }
}
export async function freeKickLeaders(
  post: string,
  username: string | null,
  limit = 3
) {
  const day = today(),
    start = Date.parse(`${day}T00:00:00Z`);
  const days = Array.from({ length: WINDOW_DAYS }, (_, i) =>
    new Date(start - i * 86_400_000).toISOString().slice(0, 10)
  );
  const read = async (kind: 'score' | 'speed' | 'goals') =>
    rankFreeKicks(
      (
        await Promise.all(
          days.map((d) =>
            redis.zRange(freeKickKey(post, d, kind), 0, -1, { by: 'rank' })
          )
        )
      ).flat(),
      username,
      limit
    );
  // Each player's runs started over the same seven days.
  const tries = new Map<string, number>();
  for (const rows of await Promise.all(
    days.map((d) =>
      redis.zRange(freeKickKey(post, d, 'attempts'), 0, -1, { by: 'rank' })
    )
  ))
    for (const row of rows)
      tries.set(row.member, (tries.get(row.member) ?? 0) + row.score);
  const withTries = (board: FreeKickBoard): FreeKickBoard => {
    const add = (leader: FreeKickLeader) => {
      const attempts = tries.get(leader.username);
      return attempts ? { ...leader, attempts } : leader;
    };
    return { top: board.top.map(add), me: board.me ? add(board.me) : null };
  };
  return {
    day,
    score: withTries(await read('score')),
    speed: withTries(await read('speed')),
    goals: withTries(await read('goals')),
  };
}
