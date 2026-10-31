// Exercise the real Hono form handlers with a local SDK stand-in. No Reddit writes.
import assert from 'node:assert/strict';
import { build } from 'rolldown';

await build({
  input: {
    forms: 'src/server/routes/forms.ts',
    daily: 'src/server/core/daily.ts',
  },
  platform: 'node',
  output: {
    dir: 'node_modules/.cache/daily-forms',
    entryFileNames: '[name].mjs',
    format: 'esm',
  },
  plugins: [
    {
      name: 'local-devvit',
      resolveId(source) {
        if (source === '@devvit/web/server') return '\0local-devvit';
      },
      load(id) {
        if (id !== '\0local-devvit') return;
        return `
        globalThis.formPosts = []; globalThis.formIsModerator = true;
        globalThis.testBoards = {}; globalThis.testHashes = {};
        export const context = { subredditName: 'test' };
        export const redis = { get: async key => key.startsWith('scorethread:') ? 't1_scores' : undefined, set: async () => {}, del: async () => {}, zRange: async key => globalThis.testBoards[key] ?? [], hGetAll: async key => globalThis.testHashes[key] ?? {} };
        export const reddit = {
          getCurrentUser: async () => ({getModPermissionsForSubreddit: async () => globalThis.formIsModerator ? ['all'] : []}),
          getCommentById: async () => ({id:'t1_scores',postId:'t3_new',stickied:true,removed:false}),
          submitCustomPost: async options => { globalThis.formPosts.push(options); return {id:'t3_new'}; },
        };
      `;
      },
    },
  ],
});
const { forms } = await import('../node_modules/.cache/daily-forms/forms.mjs');
const post = async (path, body) => {
  const response = await forms.request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return response.json();
};
const daily = await post('/match-type', { matchType: ['daily'] });
assert.equal(daily.showForm.name, 'dailyModeForm');
assert.deepEqual(
  daily.showForm.form.fields[0].options.map((o) => o.value),
  ['comeback', 'hold-lead', 'survival', 'chaos']
);
for (const mode of ['comeback', 'hold-lead', 'survival', 'chaos']) {
  const response = await post('/daily-mode', { dailyMode: [mode] });
  const form = response.showForm;
  assert.equal(form.name, 'challengeForm');
  assert.deepEqual(form.data.dailyMode, [mode]);
  const names = form.form.fields.map((f) => f.name);
  assert.equal(names.includes('difficulty'), mode !== 'survival');
  assert.equal(names.includes('durationSec'), mode !== 'survival');
  assert.equal(names.includes('survivalGoals'), mode === 'survival');
  assert.equal(names.includes('survivalConceded'), mode === 'survival');
  assert.equal(names.includes('startGoalsFor'), mode === 'hold-lead');
  assert.equal(
    names.includes('startGoalsAgainst'),
    mode === 'comeback' || mode === 'chaos'
  );
  if (mode === 'survival') {
    form.data.survivalGoals = ['7'];
    form.data.survivalConceded = ['4'];
  }
  if (mode === 'chaos') {
    assert.ok(names.includes('chaosEffect') && names.includes('chaosStrength'));
    assert.equal(form.data.chaosStrength, 100);
    assert.deepEqual(form.data.startGoalsAgainst, ['0']);
    form.data.chaosEffect = ['goals'];
    form.data.chaosStrength = 150;
  }
  const created = await post('/challenge-submit', form.data);
  assert.ok(created.navigateTo?.includes('t3_new'), JSON.stringify(created));
  const saved = globalThis.formPosts.at(-1);
  assert.equal(saved.postData.match.dailyMode, mode);
  if (mode === 'chaos') {
    assert.equal(saved.postData.match.chaosEffect, 'goals');
    assert.equal(saved.postData.match.chaosStrength, 150);
  }
  assert.equal(saved.runAs, 'USER');
  if (mode === 'survival') {
    assert.equal(saved.postData.match.survivalGoals, 7);
    assert.equal(saved.postData.match.survivalConceded, 4);
    assert.equal(saved.postData.match.durationSec, 300);
  }
  assert.ok(saved.userGeneratedContent.text.includes(mode));
}
const chaosForm = await post('/daily-mode', { dailyMode: ['chaos'] });
const invalidChaos = await post('/challenge-submit', {
  ...chaosForm.showForm.data,
  chaosEffect: ['slippery'],
  chaosStrength: 75,
});
assert.ok(invalidChaos.showToast);
assert.equal(invalidChaos.showForm.data.chaosStrength, 75);
const invalid = await post('/challenge-submit', {
  ...(await post('/daily-mode', { dailyMode: ['hold-lead'] })).showForm.data,
  startGoalsFor: ['0'],
});
assert.ok(invalid.showToast);
assert.equal(
  invalid.showForm.form.fields.some((f) => f.name === 'startGoalsFor'),
  true
);
assert.deepEqual(invalid.showForm.data.startGoalsFor, ['0']);
for (const type of ['classic', 'casual']) {
  const response = await post('/match-type', { matchType: [type] });
  assert.equal(response.showForm.name, 'challengeForm');
  assert.equal(
    response.showForm.form.fields.some((f) => f.name === 'dailyMode'),
    false
  );
}
const before = globalThis.formPosts.length;
globalThis.formIsModerator = false;
for (const [path, body] of [
  ['/match-type', { matchType: ['daily'] }],
  ['/daily-mode', { dailyMode: ['survival'] }],
  ['/challenge-submit', daily.showForm.data],
]) {
  const denied = await post(path, body);
  assert.ok(denied.showToast.includes('Only moderators'));
}
assert.equal(globalThis.formPosts.length, before);
console.log(
  'Daily posting handlers passed: type/template/settings/create, canonical postData, invalid retry, Classic/Casual and moderator checks (mock SDK)'
);

const dailyStore = await import('../node_modules/.cache/daily-forms/daily.mjs');
const day = dailyStore.today(),
  board = dailyStore.boardKey('t3_surv', day),
  hash = dailyStore.statsKey('t3_surv', day);
const base = {
  dailyMode: 'survival',
  difficulty: 'noob',
  goalsFor: 5,
  goalsAgainst: 0,
  shots: 5,
  passes: 3,
  tacklesWon: 1,
  elapsedSec: 90,
};
globalThis.testBoards[board] = [
  { member: 'clean_slow', score: 99999 },
  { member: 'fast', score: 1 },
  { member: 'failed', score: 1e10 },
];
globalThis.testHashes[hash] = {
  clean_slow: JSON.stringify(base),
  fast: JSON.stringify({ ...base, goalsAgainst: 2, elapsedSec: 20 }),
  failed: JSON.stringify({
    ...base,
    goalsFor: 4,
    goalsAgainst: 3,
    elapsedSec: 20,
  }),
};
const canonical = {
  ...globalThis.formPosts.find((p) => p.postData.match.dailyMode === 'survival')
    .postData.match,
  survivalGoals: 5,
  survivalConceded: 3,
};
const times = await dailyStore.dailyLeaders(
  't3_surv',
  'clean_slow',
  25,
  canonical
);
assert.deepEqual(
  times.top.map((row) => row.username),
  ['fast', 'clean_slow']
);
assert.equal(times.me.rank, 2);
console.log(
  'Actual leaderboard reader reorders legacy scores by time and excludes failed rows (mock Redis)'
);
