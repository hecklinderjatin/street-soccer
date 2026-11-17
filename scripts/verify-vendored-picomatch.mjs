// Local forks are not covered by npm's registry advisory scan. Verify the
// reviewed vendored sources separately; behavior is checked by test:dependencies.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
for (const major of [2, 4]) {
  const path = resolve(root, `vendor/picomatch-v${major}`);
  const metadata = JSON.parse(
    readFileSync(resolve(path, 'package.json'), 'utf8')
  );
  assert.equal(metadata.name, `@street-soccer/picomatch-v${major}`);
  assert.equal(metadata.private, true);
  assert.equal(metadata.upstream.version, metadata.version);
  const hashes = JSON.parse(
    readFileSync(resolve(path, 'source-integrity.json'), 'utf8')
  );
  const codeFiles = [
    'index.js',
    ...(major === 4 ? ['posix.js'] : []),
    ...readdirSync(resolve(path, 'lib')).map((name) => `lib/${name}`),
  ];
  assert.deepEqual(
    Object.keys(hashes)
      .filter((name) => name.endsWith('.js'))
      .sort(),
    codeFiles.sort()
  );
  for (const [name, hash] of Object.entries(hashes)) {
    // Git can convert text line endings on Windows without changing JS behavior.
    const source = readFileSync(resolve(path, name), 'utf8').replaceAll(
      '\r\n',
      '\n'
    );
    const actual = createHash('sha256').update(source).digest('hex');
    assert.equal(
      actual,
      hash,
      `Review vendored security source change: v${major}/${name}`
    );
  }
}
console.log('Verified vendored picomatch forks against reviewed source hashes');
