// Local mitigation for GHSA-fc5q-39xc-vjpf / CVE-2026-112366. There is no
// patched npm release as of 2026-11-18. Keep upstream versions/audit visible.
// Adapted from the conservative, capture-aware upstream v2 proposal:
// https://github.com/micromatch/picomatch/pull/246
// f03bec2c02e46f063fbfdc161aae1d0f854b2565 (MIT; see patches/picomatch-LICENSE).
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const hashes = {
  '2.3.2': '3a91656f440069aa8f8e15c9d695b9f6b2209df1eab2be8127c72cbcca45ff5f',
  '4.0.7': '4e1e05447668aa1e94366c5516a2bcd8f5fff800cc92b1d0cd7d77703b8618c4',
};
const helper = String.raw`// Single-branch star repetition absorbs further repetitions. Restrict this
// rewrite to literal/star branches; preserve the existing handling otherwise.
const isSelfRepeatingStarBranch = branch => {
  return branch.includes('*') &&
    !branch.includes('**') &&
    !/[\\/"?()[\]{}|!+@]/.test(branch);
};

`;
const anchors = [
  [
    'const analyzeRepeatedExtglob = (body, options) => {',
    helper + 'const analyzeRepeatedExtglob = (body, options) => {',
  ],
  [
    '  const branches = splitTopLevel(body).map(branch => branch.trim());\n\n  if (branches.length > 1) {',
    `  const branches = splitTopLevel(body).map(branch => branch.trim());

  if (branches.length === 1 && isSelfRepeatingStarBranch(branches[0])) {
    // Repeated captures cannot be collapsed without changing capture semantics.
    return options.capture === true ? { risky: true } : { risky: false, collapse: true };
  }

  if (branches.length > 1) {`,
  ],
  [
    "    let output = token.close + (opts.capture ? ')' : '');",
    `    if (analysis.collapse === true && (token.type === 'plus' || token.type === 'star')) {
      token.close = token.type === 'plus' ? ')' : ')?';
    }

    let output = token.close + (opts.capture ? ')' : '');`,
  ],
];

const digest = (source) => createHash('sha256').update(source).digest('hex');
const lock = JSON.parse(
  readFileSync(resolve(root, 'package-lock.json'), 'utf8')
);
const planned = [];
for (const path of Object.keys(lock.packages)) {
  if (!path.endsWith('/picomatch')) continue;
  const directory = resolve(root, path);
  // npm ci --omit=dev need not install tooling-only picomatch copies.
  if (!existsSync(resolve(directory, 'package.json'))) continue;
  const { version } = JSON.parse(
    readFileSync(resolve(directory, 'package.json'), 'utf8')
  );
  const file = resolve(directory, 'lib/parse.js');
  const source = readFileSync(file, 'utf8').replaceAll('\r\n', '\n');
  let original = source;
  for (const [before, after] of anchors)
    original = original.replace(after, before);
  if (!hashes[version] || digest(original) !== hashes[version]) {
    throw new Error(
      `Review/remove the picomatch mitigation for ${path}@${version}: unexpected source`
    );
  }
  let patched = original;
  for (const [before, after] of anchors) {
    if (patched.split(before).length !== 2)
      throw new Error(`Unexpected picomatch patch anchor in ${path}`);
    patched = patched.replace(before, after);
  }
  if (source !== original && source !== patched)
    throw new Error(`Partial picomatch mitigation in ${path}`);
  planned.push({ file, source, patched });
}
// Check every installed copy before writing any of them. Re-running is safe.
for (const { file, source, patched } of planned) {
  if (source !== patched) writeFileSync(file, patched);
}
console.log(
  `Applied picomatch repeated-extglob mitigation to ${planned.length} copies; npm audit still reports upstream versions`
);
