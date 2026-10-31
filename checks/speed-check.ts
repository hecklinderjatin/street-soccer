import { recordGoalSpeed } from '../src/client/goalRecords';
import assert from 'node:assert/strict';
import {
  rankSpeeds,
  saveSpeed,
  speedKey,
  type SpeedStore,
} from '../src/server/core/speedBoard';
import { removePlayerResults } from '../src/server/core/privacyData';

// Redis WATCH model: concurrent commits invalidate an earlier snapshot.
const values = new Map<string, string>();
const boards = new Map<string, Map<string, number>>();
const versions = new Map<string, number>();
const expiry = new Map<string, number>();
const change = (key: string) => versions.set(key, (versions.get(key) ?? 0) + 1);
let fail = false;
let deleteAtCommit = false;
const guard = 'privacy:deleting:alice';
const postGuard = 'games-deleted:t3_one';
const store: SpeedStore = {
  get: async (key) => values.get(key),
  zScore: async (key, name) => boards.get(key)?.get(name),
  watch: async (...keys) => {
    const snapshot = keys.map((k) => versions.get(k) ?? 0);
    const operations: (() => number)[] = [];
    let queued = false;
    return {
      multi: async () => {
        queued = true;
      },
      discard: async () => {
        assert.ok(queued);
        operations.length = 0;
      },
      zAdd: async (key, { member, score }) => {
        operations.push(() => {
          const board = boards.get(key) ?? new Map<string, number>();
          board.set(member, score);
          boards.set(key, board);
          change(key);
          return 1;
        });
      },
      expire: async (key, sec) => {
        operations.push(() => {
          expiry.set(key, sec);
          change(key);
          return 1;
        });
      },
      exec: async () => {
        assert.ok(queued);
        if (fail) {
          fail = false;
          throw new Error('connection failed');
        }
        if (deleteAtCommit) {
          deleteAtCommit = false;
          values.set(guard, '1');
          change(guard);
        }
        if (keys.some((key, i) => (versions.get(key) ?? 0) !== snapshot[i]))
          return [];
        return operations.map((fn) => fn());
      },
    };
  },
};
const key = speedKey('t3_one', '2026-10-31');
const save = (kmh: number) =>
  saveSpeed(store, key, 'alice', kmh, 7000, [guard, postGuard], 0);
await Promise.all([save(90), save(120)]);
assert.equal(await store.zScore(key, 'alice'), 120);
await save(100);
assert.equal(
  await store.zScore(key, 'alice'),
  120,
  'slower goals cannot replace records'
);
assert.equal(expiry.get(key), 7, 'expiry stays tied to UTC board date');
fail = true;
await assert.rejects(save(150), /connection failed/);
assert.equal(
  await store.zScore(key, 'alice'),
  120,
  'failed transaction cannot change rank'
);
await save(150);
assert.equal(await store.zScore(key, 'alice'), 150);
deleteAtCommit = true;
await save(160);
assert.equal(
  await store.zScore(key, 'alice'),
  150,
  'deletion racing a record blocks it'
);
values.delete(guard);
change(guard);
values.set(postGuard, '1');
change(postGuard);
await save(170);
assert.equal(
  await store.zScore(key, 'alice'),
  150,
  'deleted posts cannot accept records'
);
await saveSpeed(
  store,
  speedKey('t3_two', '2026-10-31'),
  'alice',
  80,
  7000,
  [],
  0
);
assert.equal(await store.zScore(key, 'alice'), 150, 'posts remain separate');
await saveSpeed(store, 'expired', 'alice', 80, 0, [], 1);
assert.equal(boards.has('expired'), false);
const ranked = rankSpeeds(
  [
    { member: 'alice', score: 90 },
    { member: 'alice', score: 150 },
    { member: 'bob', score: 150 },
    { member: 'carol', score: 100 },
  ],
  '2026-10-31',
  'carol',
  2
);
assert.deepEqual(
  ranked.top.map((p) => [p.username, p.kmh]),
  [
    ['alice', 150],
    ['bob', 150],
  ]
);
assert.equal(ranked.me?.rank, 3);
await removePlayerResults(
  {
    zRem: async (key, names) => {
      names.forEach((name) => boards.get(key)?.delete(name));
    },
    hDel: async () => {},
    del: async () => {},
  },
  [key],
  'alice'
);
assert.equal(
  await store.zScore(key, 'alice'),
  undefined,
  'speed board uses existing account erasure'
);
const originalStorage = Object.getOwnPropertyDescriptor(
  globalThis,
  'localStorage'
);
const device = new Map<string, string>();
try {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => device.get(key) ?? null,
      setItem: (key: string, value: string) => {
        device.set(key, value);
      },
    },
  });
  assert.equal(recordGoalSpeed(120, false), true);
  assert.equal(recordGoalSpeed(120, false), false);
  assert.equal(recordGoalSpeed(90, false), false);
  assert.equal(
    recordGoalSpeed(90, true),
    true,
    'practice records are separate'
  );
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get: () => {
      throw new Error('storage disabled');
    },
  });
  assert.equal(
    recordGoalSpeed(140, false),
    false,
    'no false persistent best when storage is blocked'
  );
} finally {
  if (originalStorage)
    Object.defineProperty(globalThis, 'localStorage', originalStorage);
  else Reflect.deleteProperty(globalThis, 'localStorage');
}
console.log(
  'Speed records: concurrency, best-only updates, expiry, failures, erasure, post isolation and ranking passed'
);
