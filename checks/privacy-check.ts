import assert from 'node:assert/strict';
import { requirePinnedThread } from '../src/server/core/pinnedThread';
import {
  removePlayerResults,
  removeUnavailableAccounts,
} from '../src/server/core/privacyData';

const postId = 't3_game';
function threadHarness() {
  let saved: string | undefined;
  let published = 0;
  let created = 0;
  let failPin = false;
  const id: `t1_${string}` = 't1_scores';
  const comment = {
    id,
    postId,
    stickied: false,
    removed: false,
    body: 'Scores',
    distinguish: async () => {
      if (failPin) throw new Error('Cannot pin');
      comment.stickied = true;
    },
  };
  const store = {
    saved: async () => saved,
    pending: async (id: string) => {
      saved = id;
    },
    published: async () => {
      published++;
    },
    fetch: async () => comment,
    create: async () => {
      created++;
      return comment;
    },
  };
  return {
    store,
    comment,
    fail: () => {
      failPin = true;
    },
    recover: () => {
      failPin = false;
    },
    counts: () => ({ published, created }),
  };
}

const h = threadHarness();
h.fail();
await assert.rejects(requirePinnedThread(postId, h.store), /Cannot pin/);
assert.deepEqual(h.counts(), { published: 0, created: 1 });
h.recover();
assert.equal(await requirePinnedThread(postId, h.store), 't1_scores');
assert.deepEqual(h.counts(), { published: 1, created: 1 });
// A formerly pinned cached comment must be repinned before it can be used.
h.comment.stickied = false;
h.fail();
await assert.rejects(requirePinnedThread(postId, h.store), /Cannot pin/);
assert.equal(h.counts().published, 1);
h.recover();
await assert.rejects(requirePinnedThread('t3_wrong', h.store), /another post/);
// A successful API call that does not actually pin also fails closed.
const unchanged = threadHarness();
unchanged.comment.distinguish = async () => {};
await assert.rejects(
  requirePinnedThread(postId, unchanged.store),
  /could not be pinned/
);

const boards = ['daily:t3_one:2026-10-17', 'daily:t3_two:2026-10-16', 'speed:t3_one:2026-10-17'];
const results = new Map(boards.map((b) => [b, new Set(['alice', 'bob'])]));
const stats = new Map(
  boards.map((b) => [`${b}:stats`, new Set(['alice', 'bob'])])
);
const deletedKeys: string[] = [];
await removePlayerResults(
  {
    zRem: async (key, names) => {
      names.forEach((n) => results.get(key)?.delete(n));
    },
    hDel: async (key, names) => {
      names.forEach((n) => stats.get(key)?.delete(n));
    },
    del: async (...keys) => {
      deletedKeys.push(...keys);
    },
  },
  boards,
  'alice'
);
for (const names of [...results.values(), ...stats.values()]) {
  assert.deepEqual([...names], ['bob']);
}
assert.equal(deletedKeys.length, 6);
assert.ok(deletedKeys.every((key) => key.endsWith(':alice')));
const removed: string[] = [];
await removeUnavailableAccounts(
  ['alice', 'bob', 'alice'],
  async (name) => name === 'bob',
  async (name) => {
    removed.push(name);
  }
);
assert.deepEqual(removed, ['alice']);
await assert.rejects(
  removeUnavailableAccounts(
    ['bob'],
    async () => {
      throw new Error('Reddit offline');
    },
    async (name) => {
      removed.push(name);
    }
  ),
  /Reddit offline/
);
assert.deepEqual(removed, ['alice']);
console.log('Privacy and pinned-score regression checks passed');
