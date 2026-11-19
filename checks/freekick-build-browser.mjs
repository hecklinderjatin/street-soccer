// Run after the production build to exercise the shipped trimmed Phaser.
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH }
    : {}),
  args: [
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--mute-audio',
  ],
});
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 600 } });
  const origin = 'http://localhost';
  const shared = [];
  const leaders = Array.from({ length: 9 }, (_, i) => ({
    rank: i + 1,
    username: `Player${i + 1}`,
    value: 90 - i,
    goalsFor: 3,
    goalsAgainst: 1,
  }));
  await page.route(`${origin}/**`, async (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname === '/api/playground/share') {
      shared.push(route.request().postDataJSON());
      return route.fulfill({
        status: 429,
        json: { error: 'Test post blocked' },
      });
    }
    if (pathname === '/api/freekick/leaders') {
      const board = { top: leaders, me: null };
      return route.fulfill({
        json: { score: board, speed: board, goals: board },
      });
    }
    if (pathname === '/api/daily-leaders' || pathname === '/api/result')
      return route.fulfill({ json: { top: leaders, me: null } });
    if (pathname.startsWith('/api/')) return route.fulfill({ status: 204 });
    return route.fulfill({ path: resolve('dist/client', '.' + pathname) });
  });
  const errors = [];
  const art = [];
  let musicRequests = 0;
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    const { pathname } = new URL(request.url());
    if (pathname.startsWith('/art/')) art.push(pathname);
    if (pathname === '/audio/bgm.mp3') musicRequests++;
  });
  await page.addInitScript(() => {
    const flags = new URLSearchParams(location.search);
    if (flags.has('muted')) localStorage.setItem('street-soccer-muted', 'true');
    if (flags.has('share') || flags.has('board'))
      window.devvit = {
        context: {
          postId: 't3_test',
          subredditName: 'street_soccer_dev',
          userId: 't2_player',
          username: 'KickTester',
          postData: {
            matchType: flags.has('freeKick') ? 'freekick' : 'classic',
          },
        },
      };
    if (!location.pathname.endsWith('/splash.html')) return;
    if (flags.has('freeKick') && !flags.has('board'))
      window.devvit = { context: { postData: { matchType: 'freekick' } } };
    window.IntersectionObserver = class {
      constructor(callback) {
        window.setFeedVisibility = (visible) =>
          callback([
            { isIntersecting: visible, intersectionRatio: visible ? 1 : 0 },
          ]);
      }
      observe() {}
      disconnect() {}
    };
  });
  for (const freeKick of [false, true]) {
    art.length = 0;
    const previewKeeper = freeKick
      ? '/art/player-awayKeeper-preview.webp'
      : '/art/player-awayKeeper.webp';
    const prefetch = page.waitForRequest((request) =>
      request.url().endsWith(previewKeeper)
    );
    await page.goto(
      `${origin}/splash.html?debug${freeKick ? '&freeKick' : ''}`
    );
    await page.locator('.mobile-play').waitFor();
    if (freeKick) {
      const create = page.getByRole('link', { name: 'CREATE', exact: true });
      await create.waitFor();
      assert.equal(await create.getAttribute('href'), 'freekick-playground.html');
    }
    assert.equal(await page.locator('canvas').count(), 0);
    await page.evaluate(() => {
      window.setFeedVisibility(true);
      window.setFeedVisibility(false);
    });
    // A brief impression may download art. It must not create the renderer.
    await Promise.all([prefetch, page.waitForTimeout(450)]);
    assert.equal(await page.locator('canvas').count(), 0);
    await page.evaluate(() => window.setFeedVisibility(true));
    await page.locator('canvas').waitFor();
    await page.waitForFunction((freeKick) => {
      if (freeKick)
        return window.__freekickPreview?.scene.getScene('FreeKickPreview')
          ?.stage;
      return window.__game?.scene.getScene('Match')?.ready;
    }, freeKick);
    assert.ok(art.includes(previewKeeper));
    assert.equal(art.includes('/art/player-homeKeeper.webp'), !freeKick);
    assert.equal(await page.locator('.mobile-play').count(), 1);
  }
  for (const freeKick of [false, true]) {
    await page.goto(
      `${origin}/splash.html?board${freeKick ? '&freeKick' : ''}`
    );
    const viewport = await page
      .locator('meta[name="viewport"]')
      .getAttribute('content');
    assert.doesNotMatch(viewport, /user-scalable|maximum-scale/);
    assert.equal(
      await page
        .locator('body')
        .evaluate((body) => getComputedStyle(body).touchAction),
      'auto'
    );
    await page.locator('.mobile-more').click();
    const rows = page.locator('.mobile-board-rows li');
    await rows.first().waitFor();
    assert.equal(await rows.count(), 5);
    await page.setViewportSize({ width: 560, height: 250 });
    await page.waitForFunction(
      () => document.querySelectorAll('.mobile-board-rows li').length === 1
    );
    const sheet = page.locator('.mobile-board-sheet');
    assert.equal(
      await sheet.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return (
          rect.top >= 0 &&
          rect.bottom <= innerHeight &&
          element.scrollHeight === element.clientHeight &&
          getComputedStyle(element).overflowY === 'visible'
        );
      }),
      true
    );
    await page.locator('.mobile-board-next').click();
    assert.match(await rows.first().textContent(), /Player2/);
    await page.locator('.mobile-board-prev').click();
    assert.match(await rows.first().textContent(), /Player1/);
    await page.setViewportSize({ width: 390, height: 600 });
  }
  await page.goto(`${origin}/splash.html?debug`);
  await page.getByRole('button', { name: 'PLAY CLASSIC' }).click();
  await page.waitForFunction(() => {
    const match = window.__game?.scene.getScene('Match');
    return match?.ready && !match.demo;
  });
  assert.equal(await page.locator('#mobile-lobby').count(), 0);
  await page.waitForFunction(() => window.__game.scene.getScene('Match').music);
  assert.equal(musicRequests, 0);
  const matchMusic = page.waitForRequest((request) =>
    request.url().endsWith('/audio/bgm.mp3')
  );
  await page.keyboard.press('A');
  await matchMusic;
  const savedMatch = page.waitForRequest((request) =>
    request.url().endsWith('/api/result') && request.method() === 'POST'
  );
  await page.evaluate(() => {
    const match = window.__game.scene.getScene('Match');
    match.flow.score = { home: 2, away: 1 };
    match.flow.finished = true;
  });
  assert.equal((await savedMatch).postDataJSON().goalsFor, 2);
  await page.getByRole('button', { name: 'PLAY AGAIN' }).waitFor();
  assert.equal(await page.locator('.results-hero h1').textContent(), 'YOU WIN!');
  await page
    .locator('.results-board')
    .getByText('u/Player1', { exact: true })
    .waitFor();
  art.length = 0;
  for (const entry of ['infinity', 'challenge', 'practice', 'playground']) {
    const beforeMusic = musicRequests;
    await page.goto(
      `${origin}/freekick-${entry}.html?debug${entry === 'playground' ? '&muted&share' : ''}`
    );
    if (entry === 'practice')
      await page.getByRole('button', { name: 'START PRACTICE' }).click();
    await page
      .waitForFunction(
        () => window.__game?.scene.getScene('FreeKick')?.stage,
        null,
        {
          timeout: 15000,
        }
      )
      .catch((error) => {
        throw new Error(
          `Free Kick ${entry} did not start: ${errors.join('; ')}`,
          {
            cause: error,
          }
        );
      });
    await page.locator('#boot-loading').waitFor({ state: 'hidden' });
    assert.equal(musicRequests, beforeMusic);
    if (entry === 'challenge') {
      await page.evaluate(() =>
        window.__game.scene.getScene('FreeKick').setOverlay(null, true)
      );
      const freeKickMusic = page.waitForRequest((request) =>
        request.url().endsWith('/audio/bgm.mp3')
      );
      await page.keyboard.press('A');
      await freeKickMusic;
      await page.evaluate(() =>
        window.__game.scene.getScene('FreeKick').setOverlay('pause')
      );
      assert.equal(
        await page.evaluate(
          () => window.__game.scene.getScene('FreeKick').music.el.paused
        ),
        true
      );
      await page.evaluate(() =>
        window.__game.scene.getScene('FreeKick').setOverlay(null)
      );
      await page.waitForFunction(
        () => !window.__game.scene.getScene('FreeKick').music.el.paused
      );
      await page.evaluate(() => {
        const scene = window.__game.scene.getScene('FreeKick');
        scene.lives = 0;
        scene.gameOver();
      });
      const replay = page.getByRole('button', { name: 'PLAY AGAIN' });
      const create = page.getByRole('link', { name: 'CREATE', exact: true });
      assert.equal(
        await replay.evaluate(
          (button) => getComputedStyle(button).backgroundColor
        ),
        'rgb(255, 163, 0)'
      );
      assert.equal(
        await create.evaluate(
          (button) => getComputedStyle(button).backgroundColor
        ),
        'rgb(0, 228, 54)'
      );
    }
    if (entry === 'playground') {
      const settings = page.locator('.pg-sheet .pg-body');
      const footer = page.locator('.pg-sheet .pg-foot');
      const keeperNext = page.getByRole('button', { name: 'KEEPER: next' });
      for (const viewport of [
        { width: 905, height: 745 },
        { width: 950, height: 640 },
        { width: 720, height: 480 },
      ]) {
        await page.setViewportSize(viewport);
        await page.locator('.pg-sheet.is-docked').waitFor();
        const footerBefore = await footer.boundingBox();
        const keeper = await keeperNext.boundingBox();
        const body = await settings.boundingBox();
        assert.ok(
          keeper.y >= body.y && keeper.y + keeper.height <= body.y + body.height
        );
        assert.deepEqual(await footer.boundingBox(), footerBefore);
        assert.ok(await settings.evaluate((element) =>
          element.scrollHeight <= element.clientHeight + 1
        ));
        const controls = await settings.locator('button:visible, output:visible, .pg-check:visible')
          .evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().toJSON()));
        assert.ok(controls.every((control) =>
          control.top >= body.y && control.bottom <= body.y + body.height
        ));
        await keeperNext.click({ trial: true });
      }
      await page.setViewportSize({ width: 390, height: 600 });
      await page.locator('.pg-sheet:not(.is-docked)').waitFor();
      await page.keyboard.press('A');
      assert.equal(musicRequests, beforeMusic);
      assert.equal(
        await page.evaluate(() =>
          window.__game.scene.getScene('FreeKick').music.el.hasAttribute('src')
        ),
        false
      );
      await page.evaluate(() =>
        window.__game.scene.getScene('FreeKick').playground.onGoal()
      );
      await page.locator('.pg-next:visible').click();
      const title = page.getByRole('textbox', { name: 'TITLE' });
      await title.fill('Curl around the wall');
      await page.getByRole('button', { name: 'SHARE TO SUB' }).click();
      const confirmation = page.getByRole('alertdialog', {
        name: 'SHARE THIS KICK?',
      });
      assert.match(
        await confirmation.textContent(),
        /Curl around the wall.*r\/street_soccer_dev.*u\/KickTester/
      );
      assert.equal(shared.length, 0);
      await confirmation.getByRole('button', { name: 'CANCEL' }).click();
      assert.equal(await title.inputValue(), 'Curl around the wall');
      assert.equal(shared.length, 0);
      await page.getByRole('button', { name: 'SHARE TO SUB' }).click();
      await confirmation.getByRole('button', { name: 'POST AS ME' }).click();
      await page.getByRole('alertdialog', { name: "COULDN'T SHARE" }).waitFor();
      assert.equal(shared.length, 1);
      assert.equal(shared[0].setup.title, 'Curl around the wall');
    }
    assert.deepEqual(errors, [], `Free Kick ${entry} failed during startup`);
  }
  assert.ok(!art.includes('/art/player-homeKeeper.webp'));
  console.log(
    'Production preview prefetch, lazy rendering, Classic feed-to-results and all four Free Kick entrypoints passed.'
  );
} finally {
  await browser.close();
}
