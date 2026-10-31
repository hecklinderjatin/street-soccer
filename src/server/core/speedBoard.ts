import type { SpeedLeadersResponse } from '../../shared/api';

type SpeedTransaction = {
  multi(): Promise<void>;
  zAdd(key: string, value: { member: string; score: number }): Promise<unknown>;
  expire(key: string, seconds: number): Promise<unknown>;
  exec(): Promise<unknown[]>;
  discard(): Promise<void>;
};
export type SpeedStore = {
  get(key: string): Promise<string | undefined>;
  zScore(key: string, member: string): Promise<number | undefined>;
  watch(...keys: string[]): Promise<SpeedTransaction>;
};
export const speedKey = (postId: string, day: string) =>
  `speed:${postId}:${day}`;

// A single sorted set stores both the record and its ordering. WATCH keeps
// concurrent slower submissions from replacing a faster one. Guard keys are
// watched too, so erasure/post deletion wins against an in-flight submission.
export async function saveSpeed(
  store: SpeedStore,
  key: string,
  username: string,
  kmh: number,
  expires: number,
  guards: readonly string[],
  now = Date.now()
) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const tx = await store.watch(key, ...guards);
    let queued = false;
    try {
      const blocked = (await Promise.all(guards.map((k) => store.get(k)))).some(
        Boolean
      );
      const previous = await store.zScore(key, username);
      await tx.multi();
      queued = true;
      if (
        blocked ||
        expires <= now ||
        (previous !== undefined && previous >= kmh)
      ) {
        await tx.discard();
        return;
      }
      await tx.zAdd(key, { member: username, score: kmh });
      await tx.expire(key, Math.ceil((expires - now) / 1000));
      if ((await tx.exec()).length === 2) return;
    } catch (error) {
      if (!queued) await tx.multi().catch(() => {});
      await tx.discard().catch(() => {});
      throw error;
    }
  }
  throw new Error('Speed leaderboard busy; retry');
}

export function rankSpeeds(
  entries: readonly { member: string; score: number }[],
  day: string,
  username: string | null,
  limit = 3
): SpeedLeadersResponse {
  const best = new Map<string, number>();
  for (const { member, score } of entries)
    if (score > (best.get(member) ?? 0)) best.set(member, score);
  const ranked = [...best]
    .sort(([a, x], [b, y]) => y - x || a.localeCompare(b))
    .map(([name, kmh], i) => ({ username: name, kmh, rank: i + 1 }));
  return {
    day,
    top: ranked.slice(0, limit),
    me: ranked.find((r) => r.username === username) ?? null,
  };
}
