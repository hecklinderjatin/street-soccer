// Trailer recorder (dev only, never shipped). Needs the local build served
// (npm start, http://localhost:4173) and Playwright's Chromium.
//
//   node tools/trailer/trailer.mjs search <fromSeed> <toSeed>
//     plays whole AI-vs-AI matches without drawing and lists the best
//     moments (passing moves, dribbles past tackles, dive saves, goals)
//   node tools/trailer/trailer.mjs render <plan.json>
//     renders each planned segment frame by frame (1280 x 720, 30 fps)
//     into tools/trailer/out/frames/<name>/ plus its event log
import { chromium } from 'playwright';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'out');
const BASE = process.env.BASE ?? 'http://localhost:4173/';
// Full Chromium in new headless mode, WebGL through SwiftShader.
const LAUNCH = {
  channel: 'chromium',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
};
const FPS = 30;
const FRAME_MS = 1000 / FPS;
export const CONFIG = {
  difficulty: 'normal', // same level as the home AI: an even match, a believable score
  durationSec: 180,
  startGoalsAgainst: 0,
  locked: false,
  home: { name: 'RED', jersey: 'red', formation: '2-1-1' },
  away: { name: 'BLUE', jersey: 'blue', formation: '2-1-1' },
};

async function openGame(browser) {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
  });
  page.on('pageerror', (e) => console.error('page error:', e.message));
  await page.addInitScript({ path: join(HERE, 'harness.js') });
  await page.goto(`${BASE}?film`);
  // Boot downloads in real time; keep the virtual clock ticking meanwhile.
  for (let i = 0; i < 600; i++) {
    if (await page.evaluate(() => window.__film.booted())) return page;
    await page.evaluate(() => window.__film.step(1, 1000 / 30));
    await page.waitForTimeout(50);
  }
  throw new Error('game did not finish booting');
}

async function startMatch(page, seed) {
  await page.evaluate(([c, s]) => window.__film.start(c, s), [CONFIG, seed]);
  for (let i = 0; i < 300; i++) {
    await page.evaluate((ms) => window.__film.step(1, ms), FRAME_MS);
    if (await page.evaluate(() => window.__film.ready())) return;
  }
  throw new Error('match did not get ready');
}

// Steps hidden (no drawing) in chunks; returns the events.
async function fastForward(page, frames) {
  await page.evaluate(() => window.__film.setVisible(false));
  const events = [];
  for (let done = 0; done < frames; ) {
    const n = Math.min(600, frames - done);
    events.push(...(await page.evaluate(([n, ms]) => window.__film.step(n, ms), [n, FRAME_MS])));
    done += n;
  }
  await page.evaluate(() => window.__film.setVisible(true));
  return events;
}

// ---- moment search -------------------------------------------------------

function moments(seed, events) {
  const pos = new Map();
  for (const e of events) if (e.type === 'pos') pos.set(e.f, e);
  const ev = events.filter((e) => e.type !== 'pos');
  const live = (f) => pos.get(f)?.phase === 'live';
  // Average movement of the side without the ball over frames a..b.
  const defending = (a, b, attackers) => {
    let sum = 0;
    let n = 0;
    for (let f = a; f <= b; f++) {
      const p = pos.get(f);
      if (!p) continue;
      sum += attackers === 'home' ? p.ma : p.mh;
      n++;
    }
    return n ? sum / n : 0;
  };
  const found = [];

  // Completed passes: a kick by team X, then the next gain is X, another player.
  const passes = [];
  for (let i = 0; i < ev.length; i++) {
    const k = ev[i];
    if (k.type !== 'kick' || !k.team) continue;
    const g = ev.slice(i + 1).find((e) => e.type === 'gain');
    if (g && g.team === k.team && g.by !== k.by && !g.keeper && g.f - k.f < 60)
      passes.push({ f: k.f, end: g.f, team: k.team });
  }
  // Passing moves: 3+ passes in a row by one side, each within 3 s.
  for (let i = 0; i < passes.length; ) {
    let j = i;
    while (j + 1 < passes.length && passes[j + 1].team === passes[i].team && passes[j + 1].f - passes[j].end < 90) j++;
    const n = j - i + 1;
    if (n >= 3) {
      const a = passes[i].f - 15;
      const b = passes[j].end + 20;
      if (live(a) && live(b))
        found.push({ kind: 'passing', seed, from: a, to: b, passes: n, team: passes[i].team, press: Math.round(defending(a, b, passes[i].team)), score: n * 10 + defending(a, b, passes[i].team) / 10 - (b - a) / 30 });
    }
    i = j + 1;
  }
  // Dribbles: tackles the carrier survives (keeps the ball 1 s later).
  const beaten = [];
  for (const t of ev.filter((e) => e.type === 'tackle' && e.carrier >= 0)) {
    const lost = ev.find((e) => e.type === 'gain' && e.f > t.f && e.f - t.f < 30 && e.team === t.team);
    if (!lost) beaten.push(t);
  }
  for (let i = 0; i < beaten.length; i++) {
    const group = beaten.filter((t) => t.carrier === beaten[i].carrier && t.f >= beaten[i].f && t.f - beaten[i].f < 120);
    const a = beaten[i].f - 40;
    const b = group[group.length - 1].f + 35;
    if (live(a)) found.push({ kind: 'dribble', seed, from: a, to: b, beaten: group.length, press: Math.round(defending(a, b, null)), score: group.length * 20 + (b - a < 120 ? 5 : 0) });
  }
  // Saves: a shot ending in a keeper dive / jump / block.
  for (let i = 0; i < ev.length; i++) {
    const s = ev[i];
    if (s.type !== 'shot') continue;
    const end = ev.slice(i + 1).find((e) => e.type === 'shotEnd' || e.type === 'goal');
    if (end?.type === 'shotEnd' && end.save)
      found.push({ kind: 'save', seed, from: s.f - 45, to: end.f + 30, shotFrame: s.f, endFrame: end.f, dive: end.dive, speed: s.speed, z: s.z, score: s.speed / 20 + s.z / 5 + (end.dive ? 30 : 0) });
    if (end?.type === 'goal') {
      const before = passes.filter((p) => p.team === s.team && p.f > s.f - 240 && p.f < s.f).length;
      const cel = ev.find((e) => e.type === 'celebrate' && e.f >= end.f);
      found.push({ kind: 'goal', seed, from: s.f - 90, to: end.f + 120, shotFrame: s.f, goalFrame: end.f, celebrateFrame: cel?.f ?? null, speed: s.speed, z: s.z, passesBefore: before, score: s.speed / 20 + before * 8 + s.z / 5 });
    }
  }
  return found;
}

async function search(from, to) {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch(LAUNCH);
  const page = await openGame(browser);
  const all = [];
  const frames = Math.round((CONFIG.durationSec + 60) * FPS);
  for (let seed = from; seed <= to; seed++) {
    const t0 = Date.now();
    await startMatch(page, seed);
    const events = await fastForward(page, frames);
    await writeFile(join(OUT, `events-${seed}.json`), JSON.stringify(events));
    const m = moments(seed, events);
    all.push(...m);
    const count = (k) => m.filter((x) => x.kind === k).length;
    console.log(`seed ${seed}: ${count('passing')} passing, ${count('dribble')} dribble, ${count('save')} save, ${count('goal')} goal (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  }
  await browser.close();
  const best = {};
  for (const kind of ['passing', 'dribble', 'save', 'goal'])
    best[kind] = all.filter((m) => m.kind === kind).sort((a, b) => b.score - a.score).slice(0, 8);
  await writeFile(join(OUT, `moments-${from}-${to}.json`), JSON.stringify(best, null, 1));
  for (const [kind, list] of Object.entries(best)) {
    console.log(`\n${kind}:`);
    for (const m of list) console.log(' ', JSON.stringify(m));
  }
}

// ---- render ----------------------------------------------------------------

// plan: { segments: [{ name, seed, from, frames, speed?, shakeAt?: [frame] }] }
async function render(planFile) {
  const plan = JSON.parse(await readFile(planFile, 'utf8'));
  const browser = await chromium.launch(LAUNCH);
  const page = await openGame(browser);
  const only = process.argv[4];
  for (const seg of plan.segments) {
    if (only && seg.name !== only) continue;
    const dir = join(OUT, 'frames', seg.name);
    await mkdir(dir, { recursive: true });
    await startMatch(page, seg.seed);
    await fastForward(page, seg.from);
    const speed = seg.speed ?? 1;
    const log = [];
    for (let i = 0; i < seg.frames; i++) {
      const at = seg.from + i * speed;
      if (seg.shakeAt?.some((f) => f >= at && f < at + speed))
        await page.evaluate(() => window.__film.shake(160, 0.006));
      const { ev, png } = await page.evaluate(([ms]) => window.__film.stepCapture(ms), [FRAME_MS * speed]);
      for (const e of ev) if (e.type !== 'pos') log.push({ ...e, out: i });
      await writeFile(join(dir, `${String(i).padStart(5, '0')}.png`), Buffer.from(png.split(',')[1], 'base64'));
    }
    await writeFile(join(dir, 'events.json'), JSON.stringify(log, null, 1));
    console.log(`${seg.name}: ${seg.frames} frames`);
  }
  await browser.close();
}

// Same seed three times (twice on one page, once on a fresh page): the
// first frame where the event logs differ, if any.
async function check(seed, frames) {
  const browser = await chromium.launch(LAUNCH);
  const runs = [];
  for (const fresh of [true, false, true]) {
    const page = fresh || !runs.page ? await openGame(browser) : runs.page;
    runs.page = page;
    await startMatch(page, seed);
    const ev = await fastForward(page, frames);
    runs.push(ev.filter((e) => e.type !== 'pos').map((e) => `${e.f} ${e.type} ${e.by ?? ''}`));
  }
  await browser.close();
  for (const i of [1, 2]) {
    const d = runs[0].findIndex((x, k) => x !== runs[i][k]);
    console.log(`run ${i + 1} vs run 1: ${d < 0 ? 'identical' : `differs at event ${d}: ${runs[0][d]} / ${runs[i][d]}`} (${runs[i].length} events)`);
  }
}

const [cmd, a, b] = process.argv.slice(2);
if (cmd === 'search') await search(Number(a), Number(b));
else if (cmd === 'check') await check(Number(a), Number(b));
else if (cmd === 'render') await render(a);
else console.log('usage: trailer.mjs search <from> <to> | render <plan.json> [segment]');
