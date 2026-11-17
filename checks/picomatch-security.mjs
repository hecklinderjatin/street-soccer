// Keep a regression from blocking CI: exercise hostile patterns in a child
// process with a hard timeout, then verify normal matching in every installed copy.
import assert from 'node:assert/strict';
import '../scripts/verify-vendored-picomatch.mjs';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';

const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
let checked = 0;
for (const path of Object.keys(lock.packages)) {
  if (!path.endsWith('/picomatch')) continue;
  assert.match(lock.packages[path].resolved, /^vendor\/picomatch-v[24]$/);
  assert.equal(
    lock.packages[path].link,
    true,
    'no affected registry picomatch copies may remain'
  );
  if (!existsSync(resolve(path, 'package.json'))) continue;
  const entry = resolve(path);
  const metadata = JSON.parse(
    readFileSync(resolve(entry, 'package.json'), 'utf8')
  );
  assert.match(
    metadata.name,
    /^@street-soccer\/picomatch-v[24]$/,
    'every consumer must use a reviewed fork'
  );
  const major = metadata.name.endsWith('v2') ? 2 : 4;
  assert.equal(lock.packages[path].resolved, `vendor/picomatch-v${major}`);
  assert.equal(realpathSync(entry), realpathSync(`vendor/picomatch-v${major}`));
  execFileSync(
    process.execPath,
    [
      '-e',
      `
    const assert = require('node:assert/strict');
    const pm = require(${JSON.stringify(entry)});
    for (const pattern of ['+(*a)', '*(*a)', '+(*a)c', 'x+(*a)']) {
      for (const options of [{}, { capture: true }, { maxExtglobRecursion: 1 }]) {
        assert.equal(pm.isMatch('a'.repeat(50) + 'b', pattern, options), false);
      }
    }
    for (const pattern of ['+(*)', '+(*a)', '*(*a)', '+(a*)', '+(a*b)', '*(*.js)']) {
      assert(!/\\)[+*]/.test(pm.makeRe(pattern).source), pattern);
    }
    const patterns = ['+(*)', '+(*a)', '*(*a)', '+(a*)', '+(a*b)', '*(*.js)', 'x+(*a)y', '+(*)c'];
    const inputs = ['', 'a', 'aa', 'ab', 'a.a', '.a', 'a/b', 'abc', 'axbayb', 'foo.js', 'foo.ts', 'xaay'];
    for (const options of [{}, { dot: true }, { windows: true }, { bash: true }]) {
      for (const pattern of patterns) for (const input of inputs) {
        assert.deepEqual(pm.makeRe(pattern, options).exec(input),
          pm.makeRe(pattern, { ...options, maxExtglobRecursion: false }).exec(input),
          JSON.stringify({pattern, input, options}));
      }
    }
    assert.equal(pm.isMatch('src/client/main.ts', '**/*.{ts,tsx}'), true);
    assert.equal(pm.isMatch('node_modules/a.js', 'src/**/*.js'), false);
    assert.equal(pm.isMatch('a.js', '@(a|b).*'), true);
    assert.equal(pm.isMatch('a.ts', '!*.js'), true);
    assert.equal(pm.isMatch('a', '[ab]'), true);
  `,
    ],
    { timeout: 3000, stdio: 'pipe' }
  );
  checked++;
  console.log(`Picomatch ReDoS and compatibility checks passed: ${path}`);
}
assert.ok(
  checked > 0,
  'full dependency check must exercise installed picomatch'
);
