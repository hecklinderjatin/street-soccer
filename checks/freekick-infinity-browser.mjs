// Real Free Kick renderer/UI served directly from source; Reddit/Redis APIs mocked.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const scratch = await mkdtemp(join(tmpdir(), 'fk-flow-'));
const sdk = join(scratch, 'client.ts');
await writeFile(
  sdk,
  `export const context={postId:'t3_fk',username:'tester',postData:{matchType:'freekick',freeKick:{mode:'infinity',kicker:'pink',wall:'blue',lives:2}}};
export const canRunAsUser=async()=>true;
export const requestExpandedMode=()=>{};
export const exitExpandedMode=event=>{if(!event.isTrusted||event.type!=='click')throw Error('Quit requires native click');window.__exited=true;};
export const showForm=async form=>{(window.__forms??=[]).push(form);return {action:window.__cancel?'CANCELED':'SUBMITTED',values:{comment:'Great run',includeStats:true}};};
export const showToast=value=>{window.__toast=value;};`
);
const server = await createServer({
  configFile: false,
  root: process.cwd() + '/src/client',
  publicDir: process.cwd() + '/public-release',
  resolve: { alias: { '@devvit/web/client': sdk } },
  define: { __JOURNEYS_ENABLED__: 'true' },
  server: {
    host: '127.0.0.1',
    port: 0,
    fs: { allow: [process.cwd(), scratch] },
  },
});
await server.listen();
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH }
      : {}),
    args: [
      '--no-sandbox',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--disable-dev-shm-usage',
      '--mute-audio',
    ],
  });
  const address = server.httpServer.address();
  assert.ok(address && typeof address === 'object');
  const base = `http://127.0.0.1:${address.port}`;
  const page = await browser.newPage({ viewport: { width: 390, height: 600 } });
  let denied = false;
  const events = [];
  const errors = [],
    starts = [],
    saves = [],
    posts = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const boards = {
    day: '2026-11-08',
    score: {
      top: [{ rank: 1, username: 'alice', value: 1000 }],
      me: { rank: 2, username: 'tester', value: 750 },
    },
    speed: {
      top: [{ rank: 1, username: 'bob', value: 125 }],
      me: { rank: 2, username: 'tester', value: 120 },
    },
  };
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    const body =
      route.request().method() === 'POST'
        ? route.request().postDataJSON()
        : null;
    if (path.startsWith('/api/journeys/')) {
      events.push({ path, body });
      if (path.endsWith('/start'))
        return route.fulfill({
          json: { journeyId: denied ? '' : `fk_${events.length}` },
        });
      return route.fulfill({ status: 204 });
    }
    if (path === '/api/freekick/start') {
      starts.push(body);
      return route.fulfill({ json: { id: body.id, day: '2026-11-08' } });
    }
    if (path === '/api/freekick/result') {
      saves.push(body);
      return route.fulfill({ json: boards });
    }
    if (path === '/api/freekick/post-score') {
      posts.push(body);
      return route.fulfill({ json: { commentId: 't1_shared' } });
    }
    if (path === '/api/freekick/leaders')
      return route.fulfill({ json: boards });
    return route.fulfill({ status: 204 });
  });
  const ready = async () =>
    page.waitForFunction(
      () => window.__game?.scene.getScene('FreeKick')?.overlay === 'details',
      null,
      { timeout: 60000 }
    );
  const press = async (label) => {
    const point = await page.evaluate((label) => {
      const g = window.__game,
        s = g.scene.getScene('FreeKick');
      const button = s.overlayLayer?.list.find((b) => b.label?.text === label);
      if (!button) throw Error('Missing button ' + label);
      const b = button,
        r = g.canvas.getBoundingClientRect();
      return {
        x: r.x + (b.x * r.width) / g.scale.width,
        y: r.y + (b.y * r.height) / g.scale.height,
      };
    }, label);
    await page.mouse.click(point.x, point.y, { delay: 70 });
    await page.waitForTimeout(80);
  };

  await page.goto(base + '/freekick-infinity.html?debug');
  await ready();
  const details = await page.evaluate(() =>
    window.__game.scene
      .getScene('FreeKick')
      .overlayLayer.list.filter((n) => typeof n.text === 'string')
      .map((n) => n.text)
      .join(' ')
  );
  assert.match(details, /INFINITY/);
  assert.doesNotMatch(details, /0 GOALS/);
  assert.equal(events.filter((e) => e.path.endsWith('/start')).length, 0);
  await press('NEXT');
  await press('PLAY');
  await page.waitForTimeout(100);
  const journey = events.find((e) => e.path.endsWith('/start')).body;
  assert.equal(journey.mode, 'freekick-infinity');
  assert.equal(journey.goalTarget, 0);
  assert.equal(journey.level, 2);
  await page.evaluate(() =>
    window.__game.scene.getScene('FreeKick').records.start()
  );
  await page.waitForTimeout(100);
  assert.equal(starts[0].mode, 'infinity');
  const phases = await page.evaluate(() => {
    const s = window.__game.scene.getScene('FreeKick');
    const levels = [];
    for (const goals of [0, 2, 6, 10, 16, 30]) {
      s.goals = goals;
      s.newKick(false);
      levels.push(s.setup.level.level);
    }
    const before = JSON.stringify(s.setup);
    s.newKick(true);
    return {
      levels,
      retry: before === JSON.stringify(s.setup),
      phase: s.phase,
    };
  });
  assert.deepEqual(phases.levels, [2, 3, 5, 7, 10, 10]);
  assert.equal(phases.retry, true);
  assert.equal(phases.phase, 'aim');
  await page.evaluate(() =>
    window.__game.scene.getScene('FreeKick').setOverlay('pause')
  );
  await press('RESTART');
  await ready();
  assert.equal(
    await page.evaluate(
      () => window.__game.scene.getScene('FreeKick').setup.level.level
    ),
    2
  );
  await press('START GAME');
  await page.evaluate(async () => {
    const s = window.__game.scene.getScene('FreeKick');
    s.records.start();
    await s.records.startRequest;
    s.goals = 2;
    s.newKick(false);
    s.shots = 4;
    s.score = 500;
    s.bestStreak = 2;
    s.lives = 0;
    s.clock = 30;
    s.gameOver();
  });
  await page.getByRole('button', { name: 'PLAY AGAIN', exact: true }).waitFor();
  await page.waitForTimeout(150);
  assert.equal(saves.length, 1);
  assert.equal(saves[0].mode, 'infinity');
  assert.equal(saves[0].result.level, 3);
  assert.match(await page.locator('.results-hero').innerText(), /RUN COMPLETE/);
  assert.doesNotMatch(
    await page.locator('.results-hero').innerText(),
    /FAILED/
  );
  await page
    .getByRole('button', { name: 'HIGHEST SCORE', exact: true })
    .waitFor();
  await page
    .getByRole('button', { name: 'FASTEST GOALS', exact: true })
    .waitFor();
  const end = events.filter((e) => e.path.endsWith('/end')).at(-1).body;
  assert.equal(end.mode, 'freekick-infinity');
  assert.equal(end.outcome, 'completed');
  await page.screenshot({ path: '/tmp/freekick-infinity-results.png' });
  await page.getByRole('button', { name: 'PLAY AGAIN', exact: true }).click();
  await ready();
  assert.equal(
    await page.evaluate(() => window.__game.scene.getScene('FreeKick').goals),
    0
  );
  await press('START GAME');
  await page.evaluate(() =>
    window.__game.scene.getScene('FreeKick').setOverlay('pause')
  );
  await page.locator('.fk-pause-quit').click();
  assert.equal(await page.evaluate(() => window.__exited), true);
  assert.deepEqual(errors, []);
  console.log(
    'Infinity browser passed: intro, start, Easy-to-Pro/endless continuation, same-spot retry, restart, native quit, terminal results/boards/save and Journeys.'
  );
} finally {
  await browser?.close();
  await server.close();
  await rm(scratch, { recursive: true, force: true });
}
