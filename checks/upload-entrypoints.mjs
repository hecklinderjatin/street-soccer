// A new Devvit upload deduplicates equal contents. Distinct JS filenames with
// identical bytes can lose an alias in its webview asset map (Infinity 0.0.39).
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';

const root = resolve('dist/client');
const unique = new Map();
const uploaded = new Set();
for (const file of (await readdir(root))
  .filter((file) => file.endsWith('.js'))
  .sort()) {
  const hash = createHash('sha256')
    .update(await readFile(resolve(root, file)))
    .digest('hex');
  assert.ok(
    !unique.has(hash),
    `JS upload aliases would be lost: ${unique.get(hash)} and ${file}`
  );
  if (!unique.has(hash)) {
    unique.set(hash, file);
    uploaded.add(file);
  }
}
const entries = JSON.parse(await readFile('devvit.json', 'utf8')).post
  .entrypoints;
for (const [name, { entry }] of Object.entries(entries)) {
  const { document } = new JSDOM(await readFile(resolve(root, entry), 'utf8'))
    .window;
  const scripts = [...document.querySelectorAll('script[type="module"][src]')];
  assert.ok(scripts.length, `${name} has a module entry`);
  for (const script of scripts) {
    const src = script.getAttribute('src').replace(/^\//, '');
    assert.ok(
      uploaded.has(src),
      `${name}: ${src} would be missing after upload content deduplication`
    );
  }
}
console.log(
  'All configured entry scripts survive upload content deduplication'
);
