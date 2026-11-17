import { redis } from '@devvit/web/server';
import { boardExpiry, registerBoard, WINDOW_DAYS } from './privacy';
import { gamesDeletedKey } from './gamesPlayed';

// The clock shares the leaderboard's seven-UTC-day retention and erasure index.
// A -1 member is an unfinished clock; nonnegative values are locked finish ms.
export async function playgroundFinish(
  post: string,
  username: string,
  finish = false,
  now = Date.now()
) {
  const days = Array.from({ length: WINDOW_DAYS }, (_, i) =>
    new Date(
      Date.parse(new Date(now).toISOString().slice(0, 10)) - i * 86400000
    )
      .toISOString()
      .slice(0, 10)
  );
  const keys = days.map((day) => `fk-finish:${post}:${day}`);
  const hashes = keys.map((key) => `${key}:stats`);
  const guards = [`privacy:deleting:${username}`, gamesDeletedKey(post)];
  await registerBoard(keys[0]!, days[0]!);
  // Watch tomorrow too: concurrent starts straddling midnight must conflict.
  const tomorrow = new Date(Date.parse(days[0]!) + 86400000)
    .toISOString()
    .slice(0, 10);
  const nextHash = `fk-finish:${post}:${tomorrow}:stats`;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (!finish && new Date().toISOString().slice(0, 10) !== days[0])
      return playgroundFinish(post, username);
    const tx = await redis.watch(...hashes, nextHash, ...guards);
    let queued = false;
    try {
      if (
        (await Promise.all(guards.map((key) => redis.get(key)))).some(Boolean)
      )
        throw new Error('Run unavailable');
      const states = await Promise.all(
        hashes.map((key) => redis.hGet(key, username))
      );
      // Earliest retained clock wins, including one started on a previous day.
      let index = -1;
      let started = now;
      let elapsedMs: number | null = null;
      for (let i = 0; i < states.length; i++) {
        const raw = states[i];
        if (!raw) continue;
        const state: unknown = JSON.parse(raw);
        if (!state || typeof state !== 'object')
          throw new Error('Clock unavailable');
        const time: unknown = Reflect.get(state, 'started');
        const elapsed: unknown = Reflect.get(state, 'elapsedMs');
        if (
          typeof time !== 'number' ||
          !Number.isSafeInteger(time) ||
          time > now ||
          !(
            elapsed === null ||
            (typeof elapsed === 'number' &&
              Number.isSafeInteger(elapsed) &&
              elapsed >= 0)
          )
        )
          throw new Error('Clock unavailable');
        if (index < 0 || time < started) {
          index = i;
          started = time;
          elapsedMs = elapsed;
        }
      }
      if (finish && index < 0) throw new Error('Start the timed kick first');
      if (index < 0) index = 0;
      if (finish && elapsedMs === null) elapsedMs = now - started;
      await tx.multi();
      queued = true;
      await tx.zAdd(keys[index]!, { member: username, score: elapsedMs ?? -1 });
      await tx.hSet(hashes[index]!, {
        [username]: JSON.stringify({ started, elapsedMs }),
      });
      const ttl = Math.ceil((boardExpiry(days[index]!) - now) / 1000);
      await tx.expire(keys[index]!, ttl);
      await tx.expire(hashes[index]!, ttl);
      if ((await tx.exec()).length === 4)
        return {
          elapsedMs: elapsedMs ?? now - started,
          locked: elapsedMs !== null,
        };
    } catch (error) {
      if (!queued) await tx.multi().catch(() => {});
      await tx.discard().catch(() => {});
      throw error;
    }
  }
  throw new Error('Clock busy; please retry');
}
