import { redis } from '@devvit/web/server';
import { FREE_KICK as FK } from '../../shared/tuning';
import {
  rankFreeKicks,
  readFreeKickStats,
  freeKickDay,
  type FreeKickRun,
  type FreeKickStats,
} from '../../shared/freeKick';
import { boardExpiry, registerBoard, WINDOW_DAYS } from './privacy';
import { gamesDeletedKey } from './gamesPlayed';
import { saveSpeed } from './speedBoard';

export const freeKickKey = (
  post: string,
  day: string,
  kind: 'score' | 'speed' | 'runs'
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
          result: readFreeKickStats(Reflect.get(body, 'result')),
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
  await registerBoard(board, run.day);
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
      if ((await tx.exec()).length === 4) return next;
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
  const day = receipt.completedDay ?? run.day,
    guards = [`privacy:deleting:${username}`, gamesDeletedKey(post)];
  for (const [kind, value] of [
    ['score', stats.score],
    ['speed', stats.fastestGoalKmh],
  ] as const) {
    if (kind === 'speed' && value === 0) continue;
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
  const read = async (kind: 'score' | 'speed') =>
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
  return { day, score: await read('score'), speed: await read('speed') };
}
