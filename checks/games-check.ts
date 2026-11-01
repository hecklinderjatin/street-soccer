import { DAILY } from '../src/shared/tuning';
import assert from 'node:assert/strict';
import {
  beginGame,
  finishGame,
  gamesPlayed,
  deleteGameCounts,
  gameDuration,
  gamesKey,
  gameId,
  GAME_RECEIPT_MS,
  type GamesStore,
} from '../src/server/core/gamesPlayed';
import { DEFAULT_MATCH_CONFIG } from '../src/shared/matchConfig';

// Model Redis WATCH/MULTI with version checks and all-or-nothing execution.
// Faults include a failed commit and a committed request whose reply is lost.
function harness() {
  const values = new Map<string, { value: string; expires?: number }>();
  const versions = new Map<string, number>();
  let now = 0;
  let failCommit = false;
  let loseReply = false;
  let conflict = false;
  const change = (key: string) =>
    versions.set(key, (versions.get(key) ?? 0) + 1);
  const read = (key: string) => {
    const item = values.get(key);
    if (item?.expires !== undefined && item.expires <= now) {
      values.delete(key);
      change(key);
      return undefined;
    }
    return item?.value;
  };
  const store: GamesStore = {
    get: async (key) => read(key),
    watch: async (...keys) => {
      keys.forEach(read);
      const snapshot = keys.map((key) => versions.get(key) ?? 0);
      const operations: (() => unknown)[] = [];
      let queued = false;
      return {
        multi: async () => {
          queued = true;
        },
        discard: async () => {
          assert.ok(queued, 'DISCARD requires MULTI');
          operations.length = 0;
        },
        set: async (key, value, options) => {
          operations.push(() => {
            values.set(key, { value, expires: options?.expiration.getTime() });
            change(key);
            return 'OK';
          });
        },
        del: async (...keys) => {
          operations.push(() => {
            keys.forEach((key) => {
              values.delete(key);
              change(key);
            });
            return keys.length;
          });
        },
        incrBy: async (key, amount) => {
          operations.push(() => {
            const value = Number(read(key) ?? '0') + amount;
            values.set(key, { value: String(value) });
            change(key);
            return value;
          });
        },
        exec: async () => {
          assert.ok(queued);
          if (failCommit) {
            failCommit = false;
            throw new Error('connection failed before commit');
          }
          if (conflict) {
            conflict = false;
            return [];
          }
          keys.forEach(read);
          if (keys.some((key, i) => (versions.get(key) ?? 0) !== snapshot[i]))
            return [];
          const result = operations.map((operation) => operation());
          if (loseReply) {
            loseReply = false;
            throw new Error('reply lost after commit');
          }
          return result;
        },
      };
    },
  };
  return {
    store,
    values,
    advance: (ms: number) => {
      now += ms;
    },
    now: () => now,
    fail: () => {
      failCommit = true;
    },
    lostReply: () => {
      loseReply = true;
    },
    contention: () => {
      conflict = true;
    },
  };
}
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const h = harness();
await beginGame(h.store, 'post', id(1), 30, h.now());
assert.equal(
  await gamesPlayed(h.store, 'post'),
  0,
  'starting is not a completed game'
);
await assert.rejects(
  finishGame(h.store, 'post', id(1), h.now()),
  /long enough/
);
h.advance(24000);
await beginGame(h.store, 'post', id(1), 30, h.now()); // retry must not restart the clock
await Promise.all(
  Array.from({ length: 8 }, () => finishGame(h.store, 'post', id(1), h.now()))
);
assert.equal(
  await gamesPlayed(h.store, 'post'),
  1,
  'simultaneous completion retries count once'
);
await Promise.all([
  beginGame(h.store, 'post', id(2), 30, h.now()),
  beginGame(h.store, 'post', id(3), 30, h.now()),
]);
h.advance(24000);
await Promise.all([
  finishGame(h.store, 'post', id(2), h.now()),
  finishGame(h.store, 'post', id(3), h.now()),
]);
assert.equal(
  await gamesPlayed(h.store, 'post'),
  3,
  'different games do not lose increments'
);
assert.equal(await gamesPlayed(h.store, 'another-post'), 0);
await assert.rejects(
  finishGame(h.store, 'another-post', id(1), h.now()),
  /missing/
);

await beginGame(h.store, 'post', id(4), 30, h.now());
h.advance(24000);
h.fail();
await assert.rejects(
  finishGame(h.store, 'post', id(4), h.now()),
  /before commit/
);
assert.equal(
  await gamesPlayed(h.store, 'post'),
  3,
  'failed commit changes neither receipt nor count'
);
assert.equal(await finishGame(h.store, 'post', id(4), h.now()), 4);
await beginGame(h.store, 'post', id(5), 30, h.now());
h.advance(24000);
h.lostReply();
await assert.rejects(finishGame(h.store, 'post', id(5), h.now()), /reply lost/);
assert.equal(
  await finishGame(h.store, 'post', id(5), h.now()),
  5,
  'retry after a lost reply cannot double count'
);
await beginGame(h.store, 'post', id(6), 30, h.now());
h.advance(24000);
h.contention();
assert.equal(
  await finishGame(h.store, 'post', id(6), h.now()),
  6,
  'aborted WATCH retries safely'
);
h.advance(GAME_RECEIPT_MS);
await assert.rejects(
  finishGame(h.store, 'post', id(6), h.now()),
  /expired|missing/
);
assert.equal(
  await gamesPlayed(h.store, 'post'),
  6,
  'aggregate outlives anonymous receipts'
);
await beginGame(h.store, 'post', id(7), 30, h.now());
await deleteGameCounts(h.store, 'post', h.now());
assert.equal(h.values.has(gamesKey('post')), false);
await assert.rejects(
  finishGame(h.store, 'post', id(7), h.now() + 24000),
  /deleted/
);
await assert.rejects(beginGame(h.store, 'post', id(8), 30, h.now()), /deleted/);
await assert.rejects(gamesPlayed(h.store, 'post'), /deleted/);
const race = harness();
await beginGame(race.store, 'racing-post', id(20), 30, race.now());
race.advance(24000);
await Promise.allSettled([
  finishGame(race.store, 'racing-post', id(20), race.now()),
  deleteGameCounts(race.store, 'racing-post', race.now()),
]);
assert.equal(
  race.values.has(gamesKey('racing-post')),
  false,
  'completion racing with deletion cannot resurrect the count'
);
await assert.rejects(
  finishGame(race.store, 'racing-post', id(20), race.now()),
  /deleted/
);
await Promise.allSettled([
  beginGame(race.store, 'starting-post', id(21), 30, race.now()),
  deleteGameCounts(race.store, 'starting-post', race.now()),
]);
await assert.rejects(
  finishGame(race.store, 'starting-post', id(21), race.now() + 24000),
  /deleted/
);
assert.throws(() => gameId('invalid'), /identifier/);
assert.equal(
  gameDuration(
    { ...DEFAULT_MATCH_CONFIG, mode: 'casual', durationSec: 30 },
    { matchType: 'casual' }
  ),
  30
);
assert.equal(
  gameDuration(
    { ...DEFAULT_MATCH_CONFIG, durationSec: 30 },
    {
      matchType: 'classic',
      match: { ...DEFAULT_MATCH_CONFIG, durationSec: 180 },
    }
  ),
  180,
  'ranked duration comes from the post'
);
assert.throws(
  () => gameDuration({ ...DEFAULT_MATCH_CONFIG, durationSec: 31 }, null),
  /settings/
);
assert.throws(
  () => gameDuration(DEFAULT_MATCH_CONFIG, { matchType: 'casual' }),
  /Custom/
);
const survivalRun = harness();
await beginGame(
  survivalRun.store,
  'survival',
  id(99),
  120,
  survivalRun.now(),
  DAILY.earlyFinishMinSec
);
survivalRun.advance(DAILY.earlyFinishMinSec * 1000 - 1);
await assert.rejects(
  finishGame(survivalRun.store, 'survival', id(99), survivalRun.now()),
  /long enough/
);
survivalRun.advance(1);
assert.equal(
  await finishGame(survivalRun.store, 'survival', id(99), survivalRun.now()),
  1,
  'early terminal runs can count before the configured clock expires'
);
console.log(
  'Game count checks passed: concurrency, retry, failures, expiry, post isolation, deletion and validation'
);
