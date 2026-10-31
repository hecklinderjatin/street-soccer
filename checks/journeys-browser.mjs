// Run against a local build. All Reddit endpoints are mocked; no telemetry
// reaches Reddit. EXPECT_JOURNEYS=false tests an explicitly disabled build.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const enabled = process.env.EXPECT_JOURNEYS !== 'false';
const base = process.env.BASE ?? 'http://127.0.0.1:4173/';
const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH }
    : {}),
  headless: true,
  args: [
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
  ],
});
try {
  for (const failure of enabled
    ? ['none', 'denied', 'offline', 'timeout']
    : ['disabled']) {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });
    const page = await context.newPage();
    const events = [],
      errors = [];
    let serial = 0;
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(() => {
      window.devvit = {
        context: {
          postId: 't3_mock',
          subredditName: 'test',
          username: 'private_test_user',
          postData: {
            matchType: 'daily',
            match: {
              difficulty: 'noob',
              durationSec: 300,
              dailyMode: 'survival',
              survivalGoals: 7,
              survivalConceded: 4,
              startGoalsAgainst: 0,
              locked: true,
              home: { name: 'SECRET', jersey: 'red', formation: '3-1' },
              away: { name: 'CPU', jersey: 'blue', formation: '1-2-1' },
            },
          },
        },
        entrypoints: {
          game: `${location.origin}/index.html`,
          casual: `${location.origin}/casual.html`,
        },
        webViewMode: 2,
      };
    });
    await page.route('**/api/**', (route) => {
      const request = route.request(),
        path = new URL(request.url()).pathname;
      if (path.startsWith('/api/journeys/')) {
        events.push({ path, body: request.postDataJSON() });
        if (failure === 'offline') return route.abort();
        if (failure === 'timeout' && path.endsWith('/start')) return; // client aborts after its bounded timeout
        if (path.endsWith('/start'))
          return route.fulfill({
            json: {
              journeyId: failure === 'denied' ? '' : `journey_${++serial}`,
            },
          });
        return route.fulfill({ status: 204 });
      }
      if (path.startsWith('/api/games'))
        return route.fulfill({ json: { registered: true, gamesPlayed: 1 } });
      return route.fulfill({ json: { day: '2026-10-31', top: [], me: null } });
    });
    if (failure === 'none') {
      await page.goto(new URL('splash.html?debug', base).href);
      await page.locator('.mobile-play').waitFor();
      await page.waitForTimeout(200);
      assert.equal(
        events.filter((v) => v.path.endsWith('/start')).length,
        0,
        'watching the AI preview is not a journey'
      );
      events.length = 0; // next navigation is a fresh expanded page
    }
    await page.goto(new URL('index.html?debug', base).href);
    await page.waitForFunction(
      () => window.__game?.scene.getScene('Hud')?.detailsLayer?.visible,
      null,
      { timeout: 60000 }
    );
    assert.equal(
      events.filter((v) => v.path.endsWith('/start')).length,
      0,
      'briefing is not a journey start'
    );
    await page.mouse.click(640, 647); // NEXT
    await page.waitForFunction(
      () => window.__game.scene.getScene('Hud').helpLayer.visible
    );
    await page.mouse.move(800, 660);
    await page.mouse.down();
    assert.equal(
      events.filter((v) => v.path.endsWith('/start')).length,
      0,
      'pointerdown is not a commitment'
    );
    await page.mouse.up(); // PLAY MATCH commits
    await page.waitForFunction(() => !window.__game.scene.isPaused('Match'));
    if (enabled)
      await page.waitForFunction(() =>
        performance
          .getEntriesByType('resource')
          .some((v) => v.name.includes('/api/journeys/start'))
      );
    await page.evaluate(() => {
      const s = window.__game.scene.getScene('Match');
      s.flow.score = { home: 7, away: 1 };
      s.flow.elapsedSec = 44;
      s.flow.finished = true;
    });
    await page
      .getByRole('button', { name: 'PLAY AGAIN', exact: true })
      .waitFor();
    if (enabled && failure === 'none') {
      await page.waitForFunction(() =>
        performance
          .getEntriesByType('resource')
          .some((v) => v.name.includes('/api/journeys/end'))
      );
      const start = events.find((v) => v.path.endsWith('/start'));
      assert.deepEqual(start.body, {
        mode: 'rampage',
        difficulty: 'rising',
        durationSec: 300,
        rematch: false,
      });
      assert.deepEqual(events.find((v) => v.path.endsWith('/end')).body, {
        journeyId: 'journey_1',
        outcome: 'cleared',
        goalsFor: 7,
        goalsAgainst: 1,
        elapsedSec: 44,
      });
    }
    await page.getByRole('button', { name: 'PLAY AGAIN', exact: true }).click();
    await page.waitForFunction(
      () =>
        window.__game.scene.getScene('Match').ready &&
        window.__game.scene.isActive('Hud') &&
        !window.__game.scene.isPaused('Match')
    );
    // Wait for the rematch start to settle before testing explicit quit.
    if (enabled)
      for (
        let i = 0;
        i < 100 && events.filter((v) => v.path.endsWith('/start')).length < 2;
        i++
      )
        await page.waitForTimeout(20);
    await page.keyboard.press('Escape');
    await page.waitForFunction(
      () => window.__game.scene.getScene('Hud').pauseLayer.visible
    );
    await page.waitForFunction(() => window.__game.scene.isPaused('Match'));
    await page.waitForTimeout(100); // allow Phaser to refresh visible hit areas
    await page.mouse.click(640, 470); // QUIT
    await page.waitForFunction(() => window.__game.scene.isActive('Menu'));
    await page.waitForTimeout(100);
    if (!enabled) assert.deepEqual(events, []);
    else {
      assert.equal(events.filter((v) => v.path.endsWith('/ready')).length, 1);
      const starts = events.filter((v) => v.path.endsWith('/start'));
      assert.equal(starts.length, 2);
      assert.equal(starts[1].body.rematch, true);
      const ends = events.filter((v) => v.path.endsWith('/end'));
      assert.equal(ends.length, failure === 'none' ? 2 : 0);
      if (failure === 'none') {
        assert.equal(ends[1].body.journeyId, 'journey_2');
        assert.equal(ends[1].body.outcome, 'quit');
      }
      const payloads = JSON.stringify(events);
      assert.ok(
        !payloads.includes('SECRET') &&
          !payloads.includes('private_test_user') &&
          !payloads.includes('t3_mock')
      );
    }
    assert.deepEqual(errors, []);
    await context.close();
    console.log(
      `Journeys browser ${failure}: committed start, result, rematch, explicit quit and gameplay continuity passed`
    );
  }
} finally {
  await browser.close();
}
