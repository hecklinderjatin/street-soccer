import assert from 'node:assert/strict';
import { build } from 'rolldown';
const state = {
  context: { userId: 't2_u', postId: 't3_p', subredditId: 't5_s' },
  calls: 0,
  fail: false,
};
globalThis.communityServer = state;
await build({
  input: 'src/server/routes/api.ts',
  platform: 'node',
  output: { file: 'node_modules/.cache/community-api.mjs', format: 'esm' },
  plugins: [
    {
      name: 'mock-sdk',
      resolveId(s) {
        if (s === '@devvit/web/server') return '\0mock-sdk';
      },
      load(id) {
        if (id === '\0mock-sdk')
          return `const s=globalThis.communityServer;export const context=s.context;export const redis={};export const reddit={subscribeToCurrentSubreddit:async()=>{s.calls++;if(s.fail)throw Error('Denied');}};`;
      },
    },
  ],
});
const { api } = await import('../node_modules/.cache/community-api.mjs');
let response = await api.request('/community/join', { method: 'POST' });
assert.equal(response.status, 200);
assert.deepEqual(await response.json(), { joined: true });
assert.equal(state.calls, 1);
state.context.userId = undefined;
response = await api.request('/community/join', { method: 'POST' });
assert.equal(response.status, 401);
assert.equal(state.calls, 1);
state.context.userId = 't2_u';
state.context.postId = undefined;
response = await api.request('/community/join', { method: 'POST' });
assert.equal(response.status, 400);
assert.equal(state.calls, 1);
state.context.postId = 't3_p';
state.fail = true;
response = await api.request('/community/join', { method: 'POST' });
assert.equal(response.status, 503);
assert.equal(state.calls, 2);
response = await api.request('/community/join');
assert.equal(response.status, 404);
assert.equal(state.calls, 2);
console.log(
  'Community API passed: explicit POST, login/community guards, subscribe success and failure; no live Reddit writes.'
);
