// glob 7 reads the private RegExp._glob field from minimatch <=10. Patched
// minimatch 11 uses a nonrecursive Matcher with the public `pattern` field.
// Retain glob 7's callback/EventEmitter API required by dot-object's CLI;
// Adapt that lookup and use test() (shared by RegExp and Matcher), without
// changing minimatch's security fixes or converting a Matcher into a RegExp.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
// Resolve through a production dependency so --omit=dev also stays compatible.
const web = createRequire(require.resolve('@devvit/web/server'));
const protos = createRequire(web.resolve('@devvit/protos'));
const twirp = createRequire(protos.resolve('twirp-ts'));
const dot = createRequire(twirp.resolve('dot-object'));
const directory = dirname(dot.resolve('glob/package.json'));
const metadata = JSON.parse(
  readFileSync(join(directory, 'package.json'), 'utf8')
);
if (metadata.version !== '7.2.3')
  throw new Error(
    'Review/remove the glob compatibility patch for the new glob version'
  );

const replacements = [
  ['var rawGlob = pn._glob', 'var rawGlob = pn._glob || pn.pattern'],
  ['!e.match(pn)', '!pn.test(e)'],
  ['m = e.match(pn)', 'm = pn.test(e)'],
];
for (const file of ['glob.js', 'sync.js']) {
  const path = join(directory, file);
  let source = readFileSync(path, 'utf8');
  for (const [before, after] of replacements) {
    if (source.includes(after)) continue; // idempotent install
    if (source.split(before).length !== 2)
      throw new Error(
        `Unexpected glob ${file}; compatibility patch needs review`
      );
    source = source.replace(before, after);
  }
  writeFileSync(path, source);
}
console.log('Applied glob 7 compatibility with patched minimatch 11');

// filelist normalizes candidate paths to '/', but normalizes patterns to '\\'
// on Windows. Minimatch 11 treats those backslashes as escapes. Keep both
// sides in the same form without downgrading the patched matcher.
const root = new URL('../', import.meta.url);
const lock = JSON.parse(
  readFileSync(new URL('package-lock.json', root), 'utf8')
);
for (const path of Object.keys(lock.packages)) {
  if (!path.endsWith('/filelist')) continue;
  const file = new URL(`${path}/index.js`, root);
  let source;
  try {
    source = readFileSync(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') continue; // omitted dev dependency
    throw error;
  }
  const metadata = JSON.parse(
    readFileSync(new URL(`${path}/package.json`, root), 'utf8')
  );
  if (metadata.version !== '1.0.6')
    throw new Error(
      'Review/remove the filelist compatibility patch for the new version'
    );
  const before = 'pat = path.normalize(pat);';
  const after = String.raw`pat = path.normalize(pat).replace(/\\/g, '/');`;
  if (source.includes(after)) continue;
  if (source.split(before).length !== 2)
    throw new Error(
      'Unexpected filelist source; compatibility patch needs review'
    );
  writeFileSync(file, source.replace(before, after));
  console.log('Applied filelist Windows path compatibility with minimatch 11');
}
