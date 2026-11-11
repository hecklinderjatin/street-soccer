// Real Hono handlers and Redis WATCH semantics with a local SDK; no Reddit writes.
import assert from 'node:assert/strict';
import { build } from 'rolldown';
const state = {
  name: 'alice',
  // A 2-goal Challenge with 4 lives: `valid` below (2 goals, 3 misses) completes it.
  context: {
    postId: 't3_fk',
    postData: {
      matchType: 'freekick',
      freeKick: { kicker: 'pink', wall: 'blue', lives: 4, goals: 2, distanceM: 25, wallGapM: 9, difficulty: 'normal' },
    },
  },
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
    playground: 'src/server/core/playground.ts',
    cleanup: 'src/server/core/privacy.ts',
    custom: 'src/shared/freeKickCustom.ts',
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
 incrBy:async(k,n)=>{s.values.set(k,String(Number(s.values.get(k)??0)+n));bump(k);},
 del:async(...ks)=>{for(const k of ks){s.values.delete(k);s.boards.delete(k);s.hashes.delete(k);bump(k);}},
 expire:async(k,ttl)=>s.expires.set(k,ttl),
 hGetAll:async k=>Object.fromEntries(s.hashes.get(k)??[]),
 hGet:async(k,u)=>s.hashes.get(k)?.get(u),
 hSet:async(k,vs)=>{const map=s.hashes.get(k)??new Map();for(const [u,v] of Object.entries(vs))map.set(u,v);s.hashes.set(k,map);bump(k);},
 hDel:async(k,us)=>{for(const u of us)s.hashes.get(k)?.delete(u);bump(k);},
 zAdd:async(k,v)=>{const map=s.boards.get(k)??new Map();map.set(v.member,v.score);s.boards.set(k,map);bump(k);},
 zIncrBy:async(k,u,n)=>{const map=s.boards.get(k)??new Map();map.set(u,(map.get(u)??0)+n);s.boards.set(k,map);bump(k);},
 zScore:async(k,u)=>s.boards.get(k)?.get(u),
 zRange:async k=>[...(s.boards.get(k)??[])].map(([member,score])=>({member,score})),
 zRemRangeByScore:async(k,min,max)=>{for(const [m,v] of s.boards.get(k)??[])if(v>=min&&v<=max)s.boards.get(k).delete(m);},
 zScan:async k=>({cursor:0,members:await redis.zRange(k)}),
 zRem:async(k,us)=>{for(const u of us)s.boards.get(k)?.delete(u);bump(k);},
 watch:async(...keys)=>{
  const snapshot=keys.map(k=>s.versions.get(k)??0);const ops=[];
  const tx={multi:async()=>{},discard:async()=>{ops.length=0;},exec:async()=>{if(keys.some((k,i)=>(s.versions.get(k)??0)!==snapshot[i]))return [];const result=[];for(const op of ops){op();result.push(1);}return result;}};
  for(const name of ['zAdd','hSet','expire','set','del','incrBy','zIncrBy'])tx[name]=async(...args)=>ops.push(()=>redis[name](...args));return tx;
 }
};
export const reddit={getCurrentUsername:async()=>s.name,getUserByUsername:async name=>{if(s.lookupError)throw Error("Reddit unavailable");return s.accounts?.has(name)?{name}:null;},getPostById:async()=>({subredditName:"test",getPostData:async()=>s.oldPost,mergePostData:async patch=>Object.assign(s.oldPost,patch)}),submitCustomPost:async input=>{s.newPost=input;return {id:"t3_fk",url:"https://www.reddit.com/r/test/comments/fk"};},getCommentById:async()=>({id:'t1_scores',postId:'t3_fk',stickied:true,removed:false,body:'Scores'}),submitComment:async input=>{s.comments.push(input);return {id:'t1_shared'};}};
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
  mode: 'challenge',
  score: 500,
  goals: 2,
  shots: 5,
  bestStreak: 2,
  level: 5,
  fastestGoalKmh: 100,
  elapsedSec: 20,
};
const start = async (suffix) => {
  const r = await call('/start', {
    mode: 'challenge',
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
  (await call('/start', { mode: 'challenge', id: 'run-test-identifier-guest' }))
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
assert.equal(
  (await call('/start', { mode: 'play', id: 'old-play-run-identifier' }))
    .status,
  400
);
const run = await start('one');
assert.equal(
  (await call('/result', { ...run, mode: 'challenge', result: valid })).status,
  400,
  'instant completion rejected'
);
age(run);
assert.equal(
  (
    await call('/result', {
      ...run,
      mode: 'challenge',
      result: { ...valid, shots: 7 }, // 5 misses: more than the post's 4 lives
    })
  ).status,
  400
);
const saved = await call('/result', {
  ...run,
  mode: 'challenge',
  result: valid,
});
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
  (await call('/result', { ...run, mode: 'challenge', result: valid })).status,
  200,
  'same result retry is idempotent'
);
assert.equal(
  state.values.get('games:t3_fk'),
  '1',
  'a completed run counts once toward games played, retries included'
);
assert.equal(
  (
    await call('/result', {
      ...run,
      mode: 'challenge',
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
  mode: 'challenge',
  result: { ...valid, score: 400, fastestGoalKmh: 110 },
});
const boards = (await call('/leaders')).body;
assert.equal(boards.score.me.value, 500);
assert.equal(boards.speed.me.value, 110, 'independent speed record');
state.values.set('scorethread:t3_fk', 't1_scores');
const shared = await call('/post-score', {
  ...next,
  mode: 'challenge',
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
      mode: 'challenge',
      comment: 'Nice run',
      includeStats: true,
    })
  ).status,
  429
);
state.values.delete('cooldown:comment:t3_fk:alice');
await call('/post-score', {
  ...next,
  mode: 'challenge',
  comment: 'Nice run',
  includeStats: true,
});
assert.equal(state.comments.at(-1).id, 't3_fk', 'own words are top-level');
const race = await start('concurrent');
age(race);
const outcomes = await Promise.all(
  [600, 700].map((score) =>
    call('/result', { ...race, mode: 'challenge', result: { ...valid, score } })
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
  (await call('/result', { ...tabA, mode: 'challenge', result: valid })).status,
  200,
  'another open run must not erase a completed run'
);
assert.equal(
  (await call('/result', { ...tabB, mode: 'challenge', result: valid })).status,
  200
);
const blocked = await start('erase');
age(blocked);
state.values.set('privacy:deleting:alice', '1');
assert.equal(
  (await call('/result', { ...blocked, mode: 'challenge', result: valid }))
    .status,
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
// Each started run is one attempt toward "best in N attempts".
assert.ok(completedChallenge.body.score.me.attempts >= 1);
// A failed Challenge (out of lives short of the target) is saved, not ranked.
state.name = 'bob';
const failedRun = await call('/start', {
  mode: 'challenge',
  id: 'challenge-run-identifier-fail',
});
assert.equal(failedRun.status, 200);
age(failedRun.body);
const failed = await call('/result', {
  ...failedRun.body,
  mode: 'challenge',
  result: { ...challengeStats, goals: 1, shots: 3, bestStreak: 1, score: 400 },
});
assert.equal(failed.status, 200);
assert.equal(failed.body.score.me, null, 'failed challenges do not rank');
assert.equal(failed.body.speed.me, null);
assert.ok(!failed.body.score.top.some((row) => row.username === 'bob'));
state.name = 'alice';

state.context.postData.freeKick={mode:'infinity',kicker:'pink',wall:'blue',lives:2};
const inf=await call('/start',{mode:'infinity',id:'infinity-run-identifier-1234'});
assert.equal(inf.status,200);age(inf.body);
const infStats={...valid,mode:'infinity',goals:2,shots:4,level:3,greatSaves:0};
assert.equal((await call('/result',{...inf.body,mode:'challenge',result:infStats})).status,400);
assert.equal((await call('/result',{...inf.body,mode:'infinity',result:{...infStats,shots:3}})).status,400);
assert.equal((await call('/result',{...inf.body,mode:'infinity',result:infStats})).status,200);
const infSaved=await call('/result',{...inf.body,mode:'infinity',result:infStats});
assert.equal(infSaved.status,200);
assert.ok(infSaved.body.goals.me.value>=2,'Infinity runs rank on Most Goals');

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

const {
  savePlayground,
  sharePlayground,
  cleanPlaygroundDescription,
  PLAYGROUND_OWNERS,
  playgroundSavesKey,
  playgroundCooldownKey,
  playgroundSharesKey,
} = await import('../node_modules/.cache/fk-server/playground.mjs');
const { cleanupDeletedAccounts, forgetPlayer } =
  await import('../node_modules/.cache/fk-server/cleanup.mjs');
const { CUSTOM_KICK_DEFAULT, PLAYGROUND_DESCRIPTION } =
  await import('../node_modules/.cache/fk-server/custom.mjs');
const setup = {
  title: 'Corner practice',
  kicker: 'pink',
  wall: 'blue',
  kick: CUSTOM_KICK_DEFAULT,
};
state.boards.clear();
state.values.set('privacy:legacy-indexed', '1');
state.accounts = new Set(['active']);
await savePlayground('active', setup);
const [first, second] = await Promise.all([
  savePlayground('playgroundOnly', setup),
  savePlayground('playgroundOnly', setup),
]);
assert.deepEqual([first.slot, second.slot].sort(), [0, 1]);
assert.ok(state.boards.get(PLAYGROUND_OWNERS).has('playgroundOnly'));
state.values.set(playgroundCooldownKey('playgroundOnly'), '1');
state.values.set(playgroundSharesKey('playgroundOnly'), '1');
state.lookupError = true;
await assert.rejects(cleanupDeletedAccounts(), /Reddit unavailable/);
assert.ok(state.hashes.has(playgroundSavesKey('playgroundOnly')));
state.lookupError = false;
await cleanupDeletedAccounts();
assert.equal(state.hashes.has(playgroundSavesKey('playgroundOnly')), false);
assert.equal(state.values.has(playgroundCooldownKey('playgroundOnly')), false);
assert.equal(state.values.has(playgroundSharesKey('playgroundOnly')), false);
assert.equal(state.boards.get(PLAYGROUND_OWNERS).has('playgroundOnly'), false);
assert.ok(state.hashes.has(playgroundSavesKey('active')));
await forgetPlayer('active');
assert.equal(state.boards.get(PLAYGROUND_OWNERS).has('active'), false);
await assert.rejects(savePlayground('active', setup), /Please retry shortly/);

state.values.set('scorethread:t3_fk', 't1_scores');
await sharePlayground('testSharer', setup);
assert.equal(state.newPost.postData.description, PLAYGROUND_DESCRIPTION);
assert.ok(!JSON.stringify(state.newPost.postData).includes('testSharer'));
const legacy = 'A custom free kick built by u/oldPlayer in the Playground. One shot: score it to rank.';
state.oldPost = {
  matchType: 'freekick',
  freeKick: { mode: 'custom', custom: CUSTOM_KICK_DEFAULT },
  description: legacy,
  other: 42,
};
assert.equal(await cleanPlaygroundDescription('t3_fk', 'other'), false);
assert.equal(state.oldPost.description, legacy);
assert.equal(await cleanPlaygroundDescription('t3_fk', 'test'), true);
assert.equal(state.oldPost.description, PLAYGROUND_DESCRIPTION);
assert.equal(state.oldPost.other, 42);
assert.deepEqual(state.oldPost.freeKick.custom, CUSTOM_KICK_DEFAULT);
assert.equal(await cleanPlaygroundDescription('t3_fk', 'test'), false);
console.log('Playground privacy passed: save-only cleanup, lookup outage, save isolation, and legacy post descriptions.');
