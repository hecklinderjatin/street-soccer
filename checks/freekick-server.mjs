// Real Hono handlers and Redis WATCH semantics with a local SDK; no Reddit writes.
import assert from 'node:assert/strict';
import { build } from 'rolldown';
const state = {
  name: 'alice',
  context: { postId: 't3_fk', postData: { matchType: 'freekick' } },
  values: new Map(),
  hashes: new Map(),
  boards: new Map(),
  versions: new Map(),
  expires: new Map(),
  comments: [],
};
globalThis.fkServerTest = state;
await build({
  input: {
    api: 'src/server/routes/freeKick.ts',
    privacy: 'src/server/core/privacyData.ts',
    threads: 'src/server/core/scoreThread.ts',
  },
  platform: 'node',
  output: {
    dir: 'node_modules/.cache/fk-server',
    format: 'esm',
    entryFileNames: '[name].mjs',
  },
  plugins: [
    {
      name: 'mock-sdk',
      resolveId(s) {
        if (s === '@devvit/web/server') return '\0mock-sdk';
      },
      load(id) {
        if (id !== '\0mock-sdk') return;
        return `
const s=globalThis.fkServerTest;
const bump=k=>s.versions.set(k,(s.versions.get(k)??0)+1);
export const context=s.context;
export const redis={
 get:async k=>s.values.get(k),
 set:async(k,v)=>{s.values.set(k,v);bump(k);},
 del:async(...ks)=>{for(const k of ks){s.values.delete(k);s.boards.delete(k);s.hashes.delete(k);bump(k);}},
 expire:async(k,ttl)=>s.expires.set(k,ttl),
 hGet:async(k,u)=>s.hashes.get(k)?.get(u),
 hSet:async(k,vs)=>{const map=s.hashes.get(k)??new Map();for(const [u,v] of Object.entries(vs))map.set(u,v);s.hashes.set(k,map);bump(k);},
 hDel:async(k,us)=>{for(const u of us)s.hashes.get(k)?.delete(u);bump(k);},
 zAdd:async(k,v)=>{const map=s.boards.get(k)??new Map();map.set(v.member,v.score);s.boards.set(k,map);bump(k);},
 zScore:async(k,u)=>s.boards.get(k)?.get(u),
 zRange:async k=>[...(s.boards.get(k)??[])].map(([member,score])=>({member,score})),
 zRem:async(k,us)=>{for(const u of us)s.boards.get(k)?.delete(u);bump(k);},
 watch:async(...keys)=>{
  const snapshot=keys.map(k=>s.versions.get(k)??0);const ops=[];
  const tx={multi:async()=>{},discard:async()=>{ops.length=0;},exec:async()=>{if(keys.some((k,i)=>(s.versions.get(k)??0)!==snapshot[i]))return [];const result=[];for(const op of ops){op();result.push(1);}return result;}};
  for(const name of ['zAdd','hSet','expire','set','del'])tx[name]=async(...args)=>ops.push(()=>redis[name](...args));return tx;
 }
};
export const reddit={getCurrentUsername:async()=>s.name,getCommentById:async()=>({id:'t1_scores',postId:'t3_fk',stickied:true,removed:false,body:'Scores'}),submitComment:async input=>{s.comments.push(input);return {id:'t1_shared'};}};
`;
      },
    },
  ],
});
const { freeKickApi: api } =
  await import('../node_modules/.cache/fk-server/api.mjs');
const { removePlayerResults } =
  await import('../node_modules/.cache/fk-server/privacy.mjs');
const { forgetPost } =
  await import('../node_modules/.cache/fk-server/threads.mjs');
const call = async (path, body) => {
  const res = await api.request(
    path,
    body === undefined
      ? {}
      : {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
  );
  return { status: res.status, body: await res.json() };
};
const valid = {
  mode: 'play',
  score: 500,
  goals: 2,
  shots: 5,
  bestStreak: 2,
  level: 2,
  fastestGoalKmh: 100,
  elapsedSec: 20,
};
const start = async (suffix) => {
  const r = await call('/start', {
    mode: 'play',
    id: `run-test-identifier-${suffix}`,
  });
  assert.equal(r.status, 200);
  return r.body;
};
const age = (run) => {
  const key = `fk-runs:t3_fk:${run.day}:stats`;
  const receipts = JSON.parse(state.hashes.get(key).get(state.name));
  receipts.find((item) => item.id === run.id).started -= 60_000;
  state.hashes.get(key).set(state.name, JSON.stringify(receipts));
};
state.name = undefined;
assert.equal(
  (await call('/start', { mode: 'play', id: 'run-test-identifier-guest' }))
    .status,
  401
);
assert.equal((await call('/leaders')).status, 200);
state.name = 'alice';
assert.equal(
  (
    await call('/start', {
      mode: 'practice',
      id: 'run-test-identifier-practice',
    })
  ).status,
  400
);
const run = await start('one');
assert.equal(
  (await call('/result', { ...run, mode: 'play', result: valid })).status,
  400,
  'instant completion rejected'
);
age(run);
assert.equal(
  (
    await call('/result', {
      ...run,
      mode: 'play',
      result: { ...valid, shots: 4 },
    })
  ).status,
  400
);
const saved = await call('/result', { ...run, mode: 'play', result: valid });
assert.equal(saved.status, 200);
assert.equal(saved.body.score.me.value, 500);
assert.equal(saved.body.speed.me.value, 100);
assert.equal(
  JSON.parse(
    state.hashes.get(`fk-runs:t3_fk:${run.day}:stats`).get('alice')
  ).find((item) => item.id === run.id).completedDay,
  run.day,
  'record day is fixed at first completion'
);
assert.equal(
  (await call('/result', { ...run, mode: 'play', result: valid })).status,
  200,
  'same result retry is idempotent'
);
assert.equal(
  (
    await call('/result', {
      ...run,
      mode: 'play',
      result: { ...valid, score: 600 },
    })
  ).status,
  400,
  'completed run immutable'
);
const next = await start('two');
age(next);
await call('/result', {
  ...next,
  mode: 'play',
  result: { ...valid, score: 400, fastestGoalKmh: 110 },
});
const boards = (await call('/leaders')).body;
assert.equal(boards.score.me.value, 500);
assert.equal(boards.speed.me.value, 110, 'independent speed record');
state.values.set('scorethread:t3_fk', 't1_scores');
const shared = await call('/post-score', {
  ...next,
  mode: 'play',
  comment: '',
  includeStats: true,
});
assert.equal(shared.status, 200);
assert.equal(state.comments[0].runAs, 'USER');
assert.equal(state.comments[0].id, 't1_scores');
assert.match(state.comments[0].text, /400 points/);
assert.equal(
  (
    await call('/post-score', {
      ...next,
      mode: 'play',
      comment: 'Nice run',
      includeStats: true,
    })
  ).status,
  429
);
state.values.delete('cooldown:comment:t3_fk:alice');
await call('/post-score', {
  ...next,
  mode: 'play',
  comment: 'Nice run',
  includeStats: true,
});
assert.equal(state.comments.at(-1).id, 't3_fk', 'own words are top-level');
const race = await start('concurrent');
age(race);
const outcomes = await Promise.all(
  [600, 700].map((score) =>
    call('/result', { ...race, mode: 'play', result: { ...valid, score } })
  )
);
assert.deepEqual(
  outcomes.map((r) => r.status).sort(),
  [200, 400],
  'concurrent conflicting completions cannot both win'
);
const tabA = await start('tab-a'),
  tabB = await start('tab-b');
age(tabA);
age(tabB);
assert.equal(
  (await call('/result', { ...tabA, mode: 'play', result: valid })).status,
  200,
  'another open run must not erase a completed run'
);
assert.equal(
  (await call('/result', { ...tabB, mode: 'play', result: valid })).status,
  200
);
const blocked = await start('erase');
age(blocked);
state.values.set('privacy:deleting:alice', '1');
assert.equal(
  (await call('/result', { ...blocked, mode: 'play', result: valid })).status,
  400
);
state.values.delete('privacy:deleting:alice');
// Exercise the real erasure helper on all registered boards, including run receipts.
const eraser = {
  zRem: async (k, us) => {
    for (const u of us) state.boards.get(k)?.delete(u);
  },
  hDel: async (k, us) => {
    for (const u of us) state.hashes.get(k)?.delete(u);
  },
  del: async (...keys) => {
    for (const k of keys) state.values.delete(k);
  },
};
// Challenge completions use the post's own target/lives/difficulty.
state.context.postData.freeKick = {
  kicker: 'pink',
  wall: 'blue',
  lives: 2,
  goals: 3,
  distanceM: 25,
  wallFromGoalM: 14,
  difficulty: 'normal',
};
const challengeRun = await call('/start', {
  mode: 'challenge',
  id: 'challenge-run-identifier-1234',
});
assert.equal(challengeRun.status, 200);
age(challengeRun.body);
const challengeStats = {
  ...valid,
  mode: 'challenge',
  goals: 3,
  shots: 4,
  score: 1500,
  bestStreak: 3,
  level: 5,
};
assert.equal(
  (
    await call('/result', {
      ...challengeRun.body,
      mode: 'challenge',
      result: { ...challengeStats, shots: 5 },
    })
  ).status,
  400
);
assert.equal(
  (
    await call('/result', {
      ...challengeRun.body,
      mode: 'challenge',
      result: challengeStats,
    })
  ).status,
  200
);
const completedChallenge = await call('/result', {
  ...challengeRun.body,
  mode: 'challenge',
  result: challengeStats,
});
assert.equal(
  completedChallenge.status,
  200,
  'challenge receipt survives immutable retry'
);
assert.ok(completedChallenge.body.score.me.value >= 1500);
assert.ok(completedChallenge.body.speed.me.value >= 100);

await removePlayerResults(
  eraser,
  [...(state.boards.get('privacy:boards') ?? new Map()).keys()],
  'alice'
);
assert.equal((await call('/leaders')).body.score.me, null);
assert.equal(
  state.hashes.get(`fk-runs:t3_fk:${run.day}:stats`)?.has('alice'),
  false
);
await forgetPost('t3_fk');
assert.ok(state.values.get('games-deleted:t3_fk'));
assert.ok(![...state.boards.keys()].some((k) => k.startsWith('fk-')));
assert.ok(![...state.hashes.keys()].some((k) => k.startsWith('fk-')));
state.context.postData = { matchType: 'classic' };
assert.equal((await call('/leaders')).status, 400);
console.log(
  'Free Kick server passed: auth/post/mode guards, receipts, timing, immutable retry, independent boards, sharing placement/cooldown, erasure and post deletion'
);
