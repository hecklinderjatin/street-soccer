// Run against `npm start`. This mocks Reddit's host context and messages;
// it does not create posts or establish live Reddit integration readiness.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

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
const config = {
  difficulty: 'hard',
  durationSec: 120,
  startGoalsAgainst: 2,
  locked: true,
  home: { name: 'RED', jersey: 'red', formation: '3-1' },
  away: { name: 'BLUE', jersey: 'blue', formation: '1-2-1' },
};

async function pageFor(viewport, postData) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const errors = [];
  const mutations = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/api/**', (route) => {
    if (route.request().method() === 'POST')
      mutations.push(new URL(route.request().url()).pathname);
    return route.fulfill({ json: { day: '2026-10-24', top: [], me: null } });
  });
  if (postData)
    await page.addInitScript((data) => {
      window.devvit = {
        context: {
          postId: 't3_test',
          subredditName: 'test',
          username: 'tester',
          postData: data,
        },
        entrypoints: {
          game: `${location.origin}/index.html`,
          casual: `${location.origin}/casual.html`,
        },
        webViewMode: 2,
      };
      window.hostMessages = [];
      addEventListener('message', (event) => {
        if (event.data?.type === 'devvit-internal')
          window.hostMessages.push(event.data);
      });
    }, postData);
  return { page, context, errors, mutations };
}

async function waitForMatch(page, paused = false) {
  await page.waitForFunction(
    () => {
      const game = window.__game;
      return game?.scene.isActive('Hud') && game.scene.getScene('Match')?.ready;
    },
    null,
    { timeout: 60000 }
  );
  await page.waitForFunction(
    (expected) => window.__game.scene.isPaused('Match') === expected,
    paused
  );
}

try {
  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 390, height: 844 },
  ]) {
    const { page, context, errors, mutations } = await pageFor(viewport, {
      matchType: 'daily',
      match: config,
    });
    await page.goto(new URL('casual.html?debug', base).href);
    await page
      .getByRole('button', { name: 'START MATCH', exact: true })
      .waitFor();
    assert.equal(
      await page.getByRole('status', { name: 'Your formation' }).textContent(),
      '2-1-1'
    );
    await page
      .getByRole('button', { name: 'Next your formation', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'Previous opponent formation', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'Previous difficulty', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'Previous match time', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'Previous match time', exact: true })
      .click();
    assert.equal(
      await page.getByRole('status', { name: 'Match time' }).textContent(),
      '0:30'
    );
    assert.equal(
      await page.getByRole('img', { name: /^Your 1-2-1/ }).count(),
      1
    );
    const overflow = await page.evaluate(
      () =>
        document.querySelector('.casual-panel').scrollWidth >
        document.documentElement.clientWidth
    );
    assert.equal(overflow, false, 'setup fits the viewport');
    if (process.env.CASUAL_SCREENSHOTS) {
      await mkdir(process.env.CASUAL_SCREENSHOTS, { recursive: true });
      await page.screenshot({
        path: `${process.env.CASUAL_SCREENSHOTS}/casual-${viewport.width}.png`,
        fullPage: true,
      });
    }
    await page.reload();
    await page
      .getByRole('button', { name: 'START MATCH', exact: true })
      .waitFor();
    assert.equal(
      await page.getByRole('status', { name: 'Your formation' }).textContent(),
      '1-2-1',
      'settings survive reload'
    );
    await page
      .getByRole('button', { name: 'START MATCH', exact: true })
      .click();
    await waitForMatch(page, true);
    const start = await page.evaluate(() => {
      const match = window.__game.scene.getScene('Match');
      return {
        config: match.config,
        clock: match.flow.clock,
        score: match.flow.score,
      };
    });
    assert.equal(start.config.mode, 'casual');
    assert.equal(start.config.difficulty, 'easy');
    assert.equal(start.config.home.formation, '1-2-1');
    assert.equal(start.config.away.formation, '3-1');
    assert.equal(start.config.durationSec, 30);
    assert.equal(start.config.locked, false);
    assert.equal(start.clock, 30);
    assert.deepEqual(
      start.score,
      { home: 0, away: 0 },
      'does not inherit the challenge head start'
    );
    await page.keyboard.press('i'); // dismiss the existing help overlay
    await waitForMatch(page);
    // Accelerate the clock into the final golden-goal period, then let the
    // real match update and full-time transition produce the result screen.
    await page.evaluate(() => {
      const flow = window.__game.scene.getScene('Match').flow;
      flow.phase = 'live';
      flow.awaitingKickoff = false;
      flow.clockRunning = true;
      flow.goldenGoal = true;
      flow.clock = 0.02;
    });
    await page
      .getByRole('button', { name: 'REMATCH', exact: true })
      .waitFor({ timeout: 30000 });
    assert.equal(
      await page
        .getByRole('button', { name: 'POST MY SCORE', exact: true })
        .count(),
      0
    );
    assert.deepEqual(mutations, [], 'Casual never submits results or comments');
    await page.getByRole('button', { name: 'REMATCH', exact: true }).click();
    await waitForMatch(page);
    assert.deepEqual(
      await page.evaluate(() => window.__game.scene.getScene('Match').config),
      start.config
    );
    // Quit through the normal pause overlay to check returning to settings.
    await page.keyboard.press('Escape');
    await page.evaluate(() => {
      const hud = window.__game.scene.getScene('Hud');
      const quit = hud.pauseLayer.list.find(
        (item) => item.x === 640 && item.y === 470
      );
      quit.emit('pointerdown');
      quit.emit('pointerup');
    });
    await page
      .getByRole('button', { name: 'START MATCH', exact: true })
      .waitFor();
    assert.equal(
      await page.getByRole('status', { name: 'Match time' }).textContent(),
      '0:30'
    );
    // Use the real result screen again to exercise Change Settings and Exit.
    await page
      .getByRole('button', { name: 'START MATCH', exact: true })
      .click();
    await waitForMatch(page);
    await page.evaluate(() => {
      window.__game.scene.getScene('Match').flow.finished = true;
    });
    await page
      .getByRole('button', { name: 'CHANGE SETTINGS', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'START MATCH', exact: true })
      .click();
    await waitForMatch(page);
    await page.evaluate(() => {
      window.__game.scene.getScene('Match').flow.finished = true;
    });
    await page.getByRole('button', { name: 'EXIT', exact: true }).click();
    await page.waitForFunction(() =>
      window.hostMessages.some(
        (message) => message.immersiveMode?.immersiveMode === 1
      )
    );
    assert.deepEqual(errors, []);
    assert.deepEqual(mutations, []);
    await context.close();
    console.log(
      `ok Casual setup, persisted settings, help, match, results, rematch and exit (${viewport.width}px)`
    );
  }

  for (const type of ['daily', 'classic', 'casual', 'legacy']) {
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 1280, height: 720 },
    ]) {
      const postData =
        type === 'legacy'
          ? { match: config }
          : { matchType: type, match: config };
      const { page, context, errors, mutations } = await pageFor(
        viewport,
        postData
      );
      await page.goto(new URL('splash.html?debug', base).href);
      if (viewport.width < 700)
        await page.locator('#mobile-lobby.is-portrait').waitFor();
      else
        await page.waitForFunction(() => window.__game?.scene.isActive('Menu'));
      const label =
        type === 'casual'
          ? 'PLAY CASUAL'
          : type === 'classic'
            ? 'PLAY CLASSIC'
            : 'PLAY CHALLENGE';
      if (viewport.width < 700)
        await page.getByRole('button', { name: label, exact: true }).click();
      else await page.mouse.click(256, 435);
      await page.waitForFunction(() =>
        window.hostMessages.some((message) => message.immersiveMode?.entryUrl)
      );
      const entry = await page.evaluate(
        () =>
          window.hostMessages.find((message) => message.immersiveMode?.entryUrl)
            .immersiveMode.entryUrl
      );
      assert.equal(
        new URL(entry).pathname,
        type === 'casual' ? '/casual.html' : '/index.html'
      );
      if (type !== 'casual') {
        if (viewport.width < 700)
          await page
            .getByRole('button', { name: 'PLAY CASUAL', exact: true })
            .click();
        else await page.mouse.click(256, 494);
        await page.waitForFunction(() =>
          window.hostMessages.some((message) =>
            message.immersiveMode?.entryUrl?.includes('/casual.html')
          )
        );
      } else {
        assert.equal(
          await page.locator('.mobile-board-heading').isVisible(),
          false
        );
      }
      await page.goto(new URL('index.html?debug', base).href);
      if (type === 'casual')
        await page
          .getByRole('button', { name: 'START MATCH', exact: true })
          .waitFor();
      else {
        await waitForMatch(page, true);
        const actual = await page.evaluate(
          () => window.__game.scene.getScene('Match').config
        );
        assert.equal(actual.difficulty, config.difficulty);
        assert.equal(actual.durationSec, config.durationSec);
        assert.equal(actual.startGoalsAgainst, config.startGoalsAgainst);
        assert.notEqual(actual.mode, 'casual');
      }
      assert.deepEqual(errors, []);
      assert.deepEqual(mutations, []);
      await context.close();
      console.log(
        `ok ${type} feed buttons, entry routing and legacy compatibility (${viewport.width}px)`
      );
    }
  }

  const { page, context, errors } = await pageFor({ width: 390, height: 844 });
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new Error('storage disabled');
    };
    Storage.prototype.setItem = () => {
      throw new Error('storage disabled');
    };
  });
  await page.goto(new URL('casual.html?debug', base).href);
  await page
    .getByRole('button', { name: 'Next difficulty', exact: true })
    .click();
  await page.getByRole('button', { name: 'START MATCH', exact: true }).click();
  await waitForMatch(page, true);
  assert.equal(
    await page.evaluate(
      () => window.__game.scene.getScene('Match').config.difficulty
    ),
    'hard'
  );
  assert.deepEqual(errors, []);
  await context.close();
  console.log('ok guest Casual gameplay with browser storage disabled');
} finally {
  await browser.close();
}
