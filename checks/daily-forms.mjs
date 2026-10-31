// Exercise the real Hono form handlers with a local SDK stand-in. No Reddit writes.
import assert from 'node:assert/strict';
import { build } from 'rolldown';

await build({
  input: 'src/server/routes/forms.ts',
  platform: 'node',
  output: {
    dir: 'node_modules/.cache/daily-forms',
    entryFileNames: 'forms.mjs',
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
        export const context = { subredditName: 'test' };
        export const redis = { get: async () => 't1_scores', set: async () => {}, del: async () => {} };
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
  ['comeback', 'hold-lead', 'survival']
);
for (const mode of ['comeback', 'hold-lead', 'survival']) {
  const response = await post('/daily-mode', { dailyMode: [mode] });
  const form = response.showForm;
  assert.equal(form.name, 'challengeForm');
  assert.deepEqual(form.data.dailyMode, [mode]);
  const names = form.form.fields.map((f) => f.name);
  assert.equal(names.includes('difficulty'), mode !== 'survival');
  assert.equal(names.includes('startGoalsFor'), mode === 'hold-lead');
  assert.equal(names.includes('startGoalsAgainst'), mode === 'comeback');
  const created = await post('/challenge-submit', form.data);
  assert.ok(created.navigateTo?.includes('t3_new'), JSON.stringify(created));
  const saved = globalThis.formPosts.at(-1);
  assert.equal(saved.postData.match.dailyMode, mode);
  assert.equal(saved.runAs, 'USER');
  assert.ok(saved.userGeneratedContent.text.includes(mode));
}
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
