import { survivalReceiptMinimum } from '../../shared/dailyMode';
import {
  DURATION_CHOICES,
  DEFAULT_MATCH_CONFIG,
  parseMatchConfig,
} from '../../shared/matchConfig';
import { postType } from '../../shared/postType';

// Anonymous, transient match receipts; no account IDs or scores are stored.
export const GAME_RECEIPT_MS = 24 * 60 * 60 * 1000;
export const gamesKey = (postId: string) => `games:${postId}`;
export const gamesDeletedKey = (postId: string) => `games-deleted:${postId}`;
const receiptKey = (postId: string, id: string) =>
  `game-receipt:${postId}:${id}`;

type Transaction = {
  multi(): Promise<void>;
  set(
    key: string,
    value: string,
    options?: { expiration: Date }
  ): Promise<unknown>;
  incrBy(key: string, amount: number): Promise<unknown>;
  del(...keys: string[]): Promise<unknown>;
  exec(): Promise<unknown[]>;
  discard(): Promise<void>;
};
export type GamesStore = {
  get(key: string): Promise<string | undefined>;
  watch(...keys: string[]): Promise<Transaction>;
};
export class GameCountError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 409 | 410 = 400
  ) {
    super(message);
  }
}

export function gameId(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  )
    throw new GameCountError('Invalid match identifier');
  return value.toLowerCase();
}

export function gameDuration(value: unknown, postData: unknown): number {
  const config = parseMatchConfig(value);
  if (
    typeof config === 'string' ||
    !DURATION_CHOICES.includes(config.durationSec)
  )
    throw new GameCountError('Invalid match settings');
  if (config.mode === 'casual') return config.durationSec;
  if (postType(postData) === 'casual')
    throw new GameCountError('This post is Custom');
  const stored =
    typeof postData === 'object' && postData !== null
      ? parseMatchConfig(Reflect.get(postData, 'match'))
      : 'missing';
  return typeof stored === 'string'
    ? DEFAULT_MATCH_CONFIG.durationSec
    : stored.durationSec;
}

export function gameMinimumSeconds(value: unknown, postData: unknown) {
  const config = parseMatchConfig(value);
  const stored =
    postType(postData) === 'daily' && postData && typeof postData === 'object'
      ? parseMatchConfig(Reflect.get(postData, 'match'))
      : 'none';
  return typeof config !== 'string' &&
    config.mode !== 'casual' &&
    typeof stored !== 'string' &&
    stored.dailyMode === 'survival'
    ? survivalReceiptMinimum(stored)
    : gameDuration(value, postData) * 0.8;
}

type Receipt = { earliestFinish: number; expires: number; completed: boolean };
function receipt(raw: string): Receipt {
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object')
    throw new Error('Invalid stored match receipt');
  const earliestFinish: unknown = Reflect.get(value, 'earliestFinish');
  const expires: unknown = Reflect.get(value, 'expires');
  const completed: unknown = Reflect.get(value, 'completed');
  if (
    typeof earliestFinish !== 'number' ||
    typeof expires !== 'number' ||
    typeof completed !== 'boolean'
  )
    throw new Error('Invalid stored match receipt');
  return { earliestFinish, expires, completed };
}
async function available(store: GamesStore, postId: string) {
  if (await store.get(gamesDeletedKey(postId)))
    throw new GameCountError('Post deleted', 410);
}
export async function gamesPlayed(store: GamesStore, postId: string) {
  await available(store, postId);
  const raw = await store.get(gamesKey(postId));
  if (raw === undefined) return 0;
  const count = Number(raw);
  if (!Number.isSafeInteger(count) || count < 0)
    throw new Error('Invalid stored game count');
  return count;
}

export async function beginGame(
  store: GamesStore,
  postId: string,
  id: string,
  duration: number,
  now = Date.now(),
  minimumSec = duration * 0.8
) {
  id = gameId(id);
  if (!Number.isFinite(minimumSec) || minimumSec < 1 || minimumSec > duration)
    throw new GameCountError('Invalid match minimum');
  if (!DURATION_CHOICES.includes(duration))
    throw new GameCountError('Invalid match duration');
  const key = receiptKey(postId, id);
  for (let attempt = 0; attempt < 3; attempt++) {
    const tx = await store.watch(key, gamesDeletedKey(postId));
    let queued = false;
    try {
      await available(store, postId);
      const saved = await store.get(key);
      if (saved) {
        await tx.multi();
        await tx.discard();
        return;
      }
      const value: Receipt = {
        earliestFinish: now + minimumSec * 1000,
        expires: now + GAME_RECEIPT_MS,
        completed: false,
      };
      await tx.multi();
      queued = true;
      await tx.set(key, JSON.stringify(value), {
        expiration: new Date(value.expires),
      });
      const result = await tx.exec();
      if (result.length === 1) return;
    } catch (error) {
      if (!queued) await tx.multi().catch(() => {});
      await tx.discard().catch(() => {});
      throw error;
    }
  }
  throw new GameCountError('Match registration busy; retry', 409);
}

export async function finishGame(
  store: GamesStore,
  postId: string,
  id: string,
  now = Date.now()
) {
  id = gameId(id);
  const key = receiptKey(postId, id);
  for (let attempt = 0; attempt < 3; attempt++) {
    const tx = await store.watch(key, gamesDeletedKey(postId));
    let queued = false;
    try {
      await available(store, postId);
      const raw = await store.get(key);
      if (!raw)
        throw new GameCountError('Match receipt expired or missing', 410);
      const value = receipt(raw);
      if (now >= value.expires)
        throw new GameCountError('Match receipt expired', 410);
      if (value.completed) {
        await tx.multi();
        await tx.discard();
        return gamesPlayed(store, postId);
      }
      if (now < value.earliestFinish)
        throw new GameCountError('Match has not run long enough', 409);
      await tx.multi();
      queued = true;
      await tx.set(key, JSON.stringify({ ...value, completed: true }), {
        expiration: new Date(value.expires),
      });
      await tx.incrBy(gamesKey(postId), 1);
      const result = await tx.exec();
      if (result.length === 2) return gamesPlayed(store, postId);
    } catch (error) {
      if (!queued) await tx.multi().catch(() => {});
      await tx.discard().catch(() => {});
      throw error;
    }
  }
  throw new GameCountError('Game count busy; retry', 409);
}

export async function deleteGameCounts(
  store: GamesStore,
  postId: string,
  now = Date.now()
) {
  const tx = await store.watch(gamesDeletedKey(postId));
  try {
    await tx.multi();
    // Pending receipts expire within 24 hours. This marker prevents them
    // from recreating the count after the post-deletion trigger clears it.
    await tx.set(gamesDeletedKey(postId), '1', {
      expiration: new Date(now + GAME_RECEIPT_MS),
    });
    await tx.del(gamesKey(postId));
    if ((await tx.exec()).length !== 2)
      throw new Error('Could not delete game count');
  } catch (error) {
    await tx.discard().catch(() => {});
    throw error;
  }
}
