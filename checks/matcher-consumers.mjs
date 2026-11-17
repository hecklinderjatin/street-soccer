// Check real consumers against their original API major, using patched local forks.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { once } from 'node:events';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { basename, isAbsolute, join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { glob } from 'tinyglobby';
import chokidar from 'chokidar';

const require = createRequire(import.meta.url);
for (const consumer of [
  'anymatch',
  'micromatch',
  'readdirp',
  'tinyglobby',
  'vite',
]) {
  const fromConsumer = createRequire(require.resolve(consumer));
  const major = ['anymatch', 'micromatch', 'readdirp'].includes(consumer)
    ? 2
    : 4;
  assert.equal(
    fromConsumer('picomatch/package.json').name,
    `@street-soccer/picomatch-v${major}`,
    consumer
  );
}
const micromatch = require('micromatch');
const anymatch = require('anymatch');
assert.deepEqual(
  micromatch(['src/a.ts', 'src/b.tsx', 'dist/a.js'], 'src/**/*.{ts,tsx}'),
  ['src/a.ts', 'src/b.tsx']
);
assert.deepEqual(micromatch.capture('*.js', 'entry.js'), ['entry']);
assert.equal(
  micromatch.scan('src/**/test.{js,ts}', { tokens: true }).isGlob,
  true
);
assert.equal(
  anymatch(['**/*.{ts,tsx}', '!**/node_modules/**'], 'src/a.ts'),
  true
);
assert.equal(
  anymatch(['**/*.{ts,tsx}', '!**/node_modules/**'], 'node_modules/a.ts'),
  false
);

const fixture = await mkdtemp(join(tmpdir(), 'street-soccer-matcher-'));
let watcher;
async function bounded(promise) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('File watcher timed out')),
          10000
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
try {
  await mkdir(join(fixture, 'src'));
  await mkdir(join(fixture, 'node_modules'));
  for (const path of [
    'src/a.ts',
    'src/b.tsx',
    'src/c.js',
    'node_modules/d.ts',
  ]) {
    await writeFile(join(fixture, path), 'fixture');
  }
  const expected = ['src/a.ts', 'src/b.tsx'];
  assert.deepEqual(
    (
      await glob('**/*.{ts,tsx}', { cwd: fixture, ignore: ['node_modules/**'] })
    ).sort(),
    expected
  );
  const files = await require('readdirp').promise(fixture, {
    fileFilter: ['*.ts', '*.tsx'],
    directoryFilter: ['!node_modules'],
  });
  assert.deepEqual(
    files.map((file) => file.path.replaceAll('\\', '/')).sort(),
    expected
  );
  watcher = chokidar.watch(join(fixture, 'src'), {
    ignoreInitial: true,
    // Windows' sandbox temp directory contains glob metacharacters. Watch the
    // literal fixture path; glob behavior is exercised separately above.
    disableGlobbing: true,
    usePolling: true,
    interval: 30,
  });
  await bounded(once(watcher, 'ready'));
  const added = once(watcher, 'add');
  await writeFile(join(fixture, 'src/watch.ts'), 'watch fixture');
  assert.equal(basename((await bounded(added))[0]), 'watch.ts');
} finally {
  await watcher?.close();
  const target = relative(tmpdir(), fixture);
  assert.ok(target && !target.startsWith('..') && !isAbsolute(target));
  await rm(fixture, { recursive: true, force: true });
}
console.log(
  'Matcher consumers passed: micromatch capture/scan, anymatch exclusions, readdirp, tinyglobby and chokidar file events'
);
