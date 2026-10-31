import type { MatchStats } from '../../shared/api';
import { resultRankScore } from '../../shared/dailyMode';
import { readStats } from './matchStats';

type Transaction = {
  multi(): Promise<void>;
  zAdd(key: string, value: { member: string; score: number }): Promise<unknown>;
  hSet(key: string, values: Record<string, string>): Promise<unknown>;
  expire(key: string, seconds: number): Promise<unknown>;
  exec(): Promise<unknown[]>;
  discard(): Promise<void>;
};
export type FinisherStore = {
  get(key: string): Promise<string | undefined>;
  hGet(key: string, field: string): Promise<string | undefined>;
  watch(...keys: string[]): Promise<Transaction>;
};

// Keep rank and statistics together; concurrent slower runs and retries
// cannot overwrite a personal best, including records with older ZSET scores.
export async function saveFinisher(
  store: FinisherStore,
  board: string,
  username: string,
  stats: MatchStats,
  expires: number,
  guards: readonly string[],
  now = Date.now()
) {
  if (stats.dailyMode !== 'survival' || !stats.cleared) return;
  const hash = `${board}:stats`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const tx = await store.watch(board, hash, ...guards);
    let queued = false;
    try {
      const blocked = (
        await Promise.all(guards.map((key) => store.get(key)))
      ).some(Boolean);
      const raw = await store.hGet(hash, username);
      let parsed: MatchStats | string = 'none';
      try {
        if (raw) parsed = readStats(JSON.parse(raw), null, true);
      } catch {
        /* replace malformed old data */
      }
      await tx.multi();
      queued = true;
      if (
        blocked ||
        now >= expires ||
        (typeof parsed !== 'string' &&
          resultRankScore(parsed) >= resultRankScore(stats))
      ) {
        await tx.discard();
        return;
      }
      await tx.zAdd(board, { member: username, score: resultRankScore(stats) });
      await tx.hSet(hash, { [username]: JSON.stringify(stats) });
      const ttl = Math.ceil((expires - now) / 1000);
      await tx.expire(board, ttl);
      await tx.expire(hash, ttl);
      if ((await tx.exec()).length === 4) return;
    } catch (error) {
      if (!queued) await tx.multi().catch(() => {});
      await tx.discard().catch(() => {});
      throw error;
    }
  }
  throw new Error('Finisher board busy; retry');
}
