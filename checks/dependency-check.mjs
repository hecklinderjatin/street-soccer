// Exercise the real consumers affected by the security overrides. These checks
// need no Reddit credentials and never upload or publish the application.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const from = (parent, name) => createRequire(parent.resolve(name));
const cli = from(require, '@devvit/cli');
const inquirer = from(cli, 'inquirer');
const editorModule = from(inquirer, 'external-editor');
const tmp = editorModule('tmp');
const { ExternalEditor } = inquirer('external-editor');
const twirp = from(cli, 'twirp-ts');
const dot = from(twirp, 'dot-object');
const glob = dot('glob');
const oclif = from(cli, '@oclif/core');
const ejs = from(oclif, 'ejs');
const jake = from(ejs, 'jake');
const { FileList } = jake('filelist');

const fixture = mkdtempSync(join(tmpdir(), 'street-soccer-dependencies-'));
const originalCwd = process.cwd();
try {
  mkdirSync(join(fixture, 'nested'));
  for (const name of ['a.js', 'b.ts', 'nested/c.js', '.hidden.js'])
    writeFileSync(join(fixture, name), 'fixture');
  const pattern = '**/*.{js,ts}';
  assert.deepEqual(glob.sync(pattern, { cwd: fixture }).sort(), [
    'a.js',
    'b.ts',
    'nested/c.js',
  ]);
  const asyncMatches = await new Promise((resolve, reject) =>
    glob(pattern, { cwd: fixture, ignore: ['nested/**'] }, (error, paths) =>
      error ? reject(error) : resolve(paths.sort())
    )
  );
  assert.deepEqual(asyncMatches, ['a.js', 'b.ts']);
  assert.equal(glob.hasMagic(pattern), true);
  assert.deepEqual(glob.sync('**/*.js', { cwd: fixture, dot: true }).sort(), [
    '.hidden.js',
    'a.js',
    'nested/c.js',
  ]);
  assert.deepEqual(glob.sync('@(a|b).*', { cwd: fixture }).sort(), [
    'a.js',
    'b.ts',
  ]);
  assert.deepEqual(glob.sync('A.JS', { cwd: fixture, nocase: true }), ['a.js']);
  const streamed = await new Promise((resolve, reject) => {
    const paths = [];
    glob(pattern, { cwd: fixture })
      .on('match', (path) => paths.push(path))
      .on('error', reject)
      .on('end', () => resolve(paths.sort()));
  });
  assert.deepEqual(streamed, ['a.js', 'b.ts', 'nested/c.js']);
  process.chdir(fixture);
  const files = new FileList();
  files.include(pattern);
  files.exclude('nested/**');
  assert.deepEqual(files.toArray().sort(), ['a.js', 'b.ts']);
  process.chdir(originalCwd);

  // Inquirer's editor uses tmpNameSync rather than fileSync. Check that both
  // APIs still work and the patched package rejects path-traversing names.
  const editor = new ExternalEditor('Street Soccer', {
    prefix: 'street-soccer-',
    postfix: '.txt',
  });
  try {
    assert.equal(readFileSync(editor.tempFile, 'utf8'), 'Street Soccer');
  } finally {
    editor.cleanup();
  }
  assert.equal(existsSync(editor.tempFile), false);
  const temporary = tmp.fileSync({ prefix: 'street-soccer-' });
  assert.equal(existsSync(temporary.name), true);
  temporary.removeCallback();
  assert.equal(existsSync(temporary.name), false);
  assert.throws(() => tmp.tmpNameSync({ prefix: '../escape-' }));
  assert.throws(() => tmp.tmpNameSync({ postfix: '/../../escape' }));
  console.log(
    'Dependency compatibility passed: Devvit glob/filelist, async matching, editor temp files and traversal rejection'
  );
} finally {
  process.chdir(originalCwd);
  rmSync(fixture, { recursive: true, force: true });
}
