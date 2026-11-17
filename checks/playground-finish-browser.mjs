// Production shared Playground UI, mocked API/goal outcome; no Reddit writes.
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium',
  args: [
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--mute-audio',
  ],
});
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 650 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') console.error(m.text());
  });
  page.on('requestfailed', (r) =>
    console.error('request failed', r.url(), r.failure())
  );
  const context = {
    postId: 't3_playground',
    userId: 't2_player',
    username: 'Player',
    subredditName: 'test',
    postData: {
      matchType: 'freekick',
      freeKick: {
        mode: 'custom',
        kicker: 'pink',
        wall: 'blue',
        custom: {
          distanceM: 25,
          angleDeg: 10,
          wallGapM: 9,
          wallShift: 0,
          wallMen: 3,
          jump: true,
          lyer: false,
          difficulty: 'normal',
        },
      },
    },
  };
  const empty = { top: [], me: null };
  const me = { rank: 1, username: 'Player', value: 12347 };
  const boards = {
    day: '2026-11-17',
    score: { top: [{ ...me, value: 500 }], me: null },
    finish: { top: [me], me },
    speed: { top: [{ ...me, value: 90 }], me: { ...me, value: 90 } },
    goals: empty,
  };
  let starts = 0,
    results = 0,
    locked = false;
  let failNextResult = false;
  const payloads = [];
  await page.route('http://localhost/**', async (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname === '/api/freekick/start') {
      starts++;
      const body = route.request().postDataJSON();
      return route.fulfill({
        json: {
          ...body,
          day: '2026-11-17',
          finish: { elapsedMs: locked ? 12347 : (starts - 1) * 1000, locked },
        },
      });
    }
    if (pathname === '/api/freekick/result') {
      results++;
      payloads.push(route.request().postDataJSON());
      if (failNextResult) {
        failNextResult = false;
        return route.fulfill({
          status: 503,
          json: { error: 'Temporary failure' },
        });
      }
      locked = true;
      return route.fulfill({ json: boards });
    }
    if (pathname === '/api/freekick/leaders')
      return route.fulfill({ json: boards });
    if (pathname.startsWith('/api/')) return route.fulfill({ status: 204 });
    return route.fulfill({
      path: resolve(
        'dist/client',
        pathname === '/' ? 'index.html' : pathname.slice(1)
      ),
    });
  });
  await page.addInitScript((context) => {
    window.devvit = { context };
  }, context);
  const ready = () =>
    page
      .waitForFunction(() => window.__game?.scene.getScene('FreeKick')?.stage)
      .catch(async (error) => {
        console.error(errors, await page.locator('body').innerText());
        throw error;
      });
  const play = () =>
    page.evaluate(() =>
      window.__game.scene.getScene('FreeKick').setOverlay(null, true)
    );
  await page.goto('http://localhost/freekick-challenge.html?debug');
  await ready();
  assert.equal(starts, 0, 'briefing does not start the timer');
  await play();
  await page.waitForFunction(
    () => window.__game.scene.getScene('FreeKick').records.elapsedMs() !== null
  );
  assert.equal(starts, 1, 'timer starts before the first shot');
  assert.equal(
    await page.evaluate(() => window.__game.scene.getScene('FreeKick').shots),
    0
  );
  // Miss, pause and restart: each new run reuses the server clock.
  await page.evaluate(() => {
    const s = window.__game.scene.getScene('FreeKick');
    s.shoot({ power: 0.8, targetY: 0, contact: { x: 0, y: 0 } });
    s.strikeBall();
    s.play.outcome = 'saved';
    s.onOutcome(s.play);
    s.setOverlay('pause');
    s.restart();
  });
  await play();
  await page.waitForFunction(
    () => window.__game.scene.getScene('FreeKick').records.elapsedMs() >= 1000
  );
  assert.equal(results, 0, 'misses never finish the timer');
  await page.reload();
  await ready();
  await play();
  await page.waitForFunction(
    () => window.__game.scene.getScene('FreeKick').records.elapsedMs() >= 2000
  );
  assert.equal(starts, 3);
  await page.evaluate(() => {
    const s = window.__game.scene.getScene('FreeKick');
    s.shoot({ power: 0.8, targetY: 0, contact: { x: 0, y: 0 } });
    s.strikeBall();
    s.play.outcome = 'goal';
    s.onOutcome(s.play);
  });
  await page.waitForFunction(
    () => window.__game.scene.getScene('FreeKick').records.finishLocked
  );
  assert.equal(results, 1, 'goal is submitted before the results card');
  assert.equal(await page.locator('.fk-results-screen').count(), 0);
  await page.evaluate(() =>
    window.__game.scene.getScene('FreeKick').gameOver()
  );
  await page
    .getByText('First finish locked. Replay to improve your goal speed.', {
      exact: true,
    })
    .waitFor();
  assert.equal(
    await page.locator('.fk-results-scoreboard').innerText(),
    '12.347 s\nFIRST FINISH'
  );
  assert.equal(results, 1, 'result card reuses the goal snapshot');
  assert.equal(payloads[0].result.mode, 'custom');
  assert.equal(payloads[0].result.goals, 1);
  assert.equal(
    await page
      .getByRole('button', { name: 'HIGHEST SCORE', exact: true })
      .count(),
    0
  );
  await page
    .getByRole('button', { name: 'FASTEST FINISH', exact: true })
    .click();
  assert.match(
    await page.locator('.results-board ol').innerText(),
    /12\.347 s/
  );
  await page
    .getByRole('button', { name: 'FASTEST GOALS', exact: true })
    .click();
  assert.match(await page.locator('.results-board ol').innerText(), /90 km\/h/);
  await page
    .getByRole('button', { name: 'FASTEST FINISH', exact: true })
    .click();
  for (const viewport of [
    { width: 390, height: 650 },
    { width: 1280, height: 720 },
  ]) {
    await page.setViewportSize(viewport);
    await page.screenshot({
      path: `/tmp/playground-finish-${viewport.width}.png`,
    });
    assert.equal(
      await page
        .locator('.results-panel')
        .evaluate((e) => e.scrollWidth > e.clientWidth),
      false
    );
  }
  await page.getByRole('button', { name: 'PLAY AGAIN', exact: true }).click();
  await play();
  await page.waitForFunction(
    () => window.__game.scene.getScene('FreeKick').records.finishLocked
  );
  assert.equal(
    await page.evaluate(() =>
      window.__game.scene.getScene('FreeKick').records.elapsedMs()
    ),
    12347
  );
  // A failed immediate report retries the identical frozen goal snapshot.
  failNextResult = true;
  const failedReport = page.waitForResponse(
    (r) => r.url().endsWith('/api/freekick/result') && r.status() === 503
  );
  await page.evaluate(() => {
    const s = window.__game.scene.getScene('FreeKick');
    s.shoot({ power: 0.8, targetY: 0, contact: { x: 0, y: 0 } });
    s.strikeBall();
    s.play.outcome = 'goal';
    s.onOutcome(s.play);
  });
  await failedReport;
  await page.waitForFunction(
    () => window.__game.scene.getScene('FreeKick').records.saving === null
  );
  await page.evaluate(() =>
    window.__game.scene.getScene('FreeKick').gameOver()
  );
  await page
    .getByText('First finish locked. Replay to improve your goal speed.', {
      exact: true,
    })
    .waitFor();
  assert.equal(results, 3);
  assert.deepEqual(payloads[1].result, payloads[2].result);
  assert.equal(
    await page.locator('.fk-results-scoreboard').innerText(),
    '12.347 s\nFIRST FINISH'
  );
  await page.goto('http://localhost/splash.html');
  await page
    .locator('.mobile-leaders')
    .getByText('12.347 s', { exact: true })
    .waitFor();
  await page.locator('.mobile-more').click();
  await page
    .getByRole('button', { name: 'FASTEST FINISH', exact: true })
    .waitFor();
  assert.deepEqual(errors, []);
  console.log(
    'Playground production browser passed: briefing/start, miss/restart/refresh, immediate goal snapshot, time/speed tabs, results/feed, locked replay, report retries and responsive cards.'
  );
} finally {
  await browser.close();
}
