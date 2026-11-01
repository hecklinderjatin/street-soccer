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
  const gameRequests = [];
  const completed = new Set();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/api/**', (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    // Existing gameplay tests simulate analytics being unavailable. Dedicated
    // Journeys tests cover accepted/denied/outage lifecycle requests.
    if (path.startsWith('/api/journeys/'))
      return route.fulfill({ status: 204 });
    if (path === '/api/speed-leaders')
      return route.fulfill({
        json: {
          day: '2026-10-31',
          top: [
            { rank: 1, username: 'rocket', kmh: 131 },
            { rank: 2, username: 'tester', kmh: 112 },
          ],
          me: { rank: 2, username: 'tester', kmh: 112 },
        },
      });
    if (path.startsWith('/api/games')) {
      if (request.method() === 'POST') {
        const body = request.postDataJSON();
        gameRequests.push({ path, id: body.id });
        if (path.endsWith('/complete')) completed.add(body.id);
      }
      return route.fulfill({
        json: { registered: true, gamesPlayed: 127 + completed.size },
      });
    }
    if (request.method() === 'POST') mutations.push(path);
    return route.fulfill({
      json: {
        day: '2026-10-24',
        top: [
          { rank: 1, username: 'street_legend', goalsFor: 4, goalsAgainst: 1 },
          { rank: 2, username: 'backheel_hero', goalsFor: 3, goalsAgainst: 1 },
          {
            rank: 3,
            username: 'a_very_long_reddit_username',
            goalsFor: 2,
            goalsAgainst: 0,
          },
        ],
        me: null,
      },
    });
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
  return { page, context, errors, mutations, gameRequests };
}

async function finishBriefing(page) {
  await page.waitForFunction(
    () => window.__game.scene.getScene('Hud').detailsLayer.visible
  );
  // Startup Escape advances to controls rather than skipping both pages.
  await page.keyboard.press('Escape');
  await page.waitForFunction(
    () => window.__game.scene.getScene('Hud').helpLayer.visible
  );
  assert.equal(
    await page.evaluate(() => window.__game.scene.isPaused('Match')),
    true
  );
  await page.evaluate(() => {
    const h = window.__game.scene.getScene('Hud');
    const back = h.helpLayer.list.find(
      (item) => item.x === 430 && item.y === 660
    );
    back.emit('pointerdown');
    back.emit('pointerup');
  });
  await page.waitForFunction(
    () => window.__game.scene.getScene('Hud').detailsLayer.visible
  );
  const clock = await page.evaluate(
    () => window.__game.scene.getScene('Match').flow.clock
  );
  await page.evaluate(() => {
    const h = window.__game.scene.getScene('Hud');
    const next = h.detailsLayer.list.find(
      (item) => item.x === 640 && item.y === 647
    );
    next.emit('pointerdown');
    next.emit('pointerup');
  });
  await page.waitForFunction(
    () => window.__game.scene.getScene('Hud').helpLayer.visible
  );
  assert.equal(
    await page.evaluate(() => window.__game.scene.isPaused('Match')),
    true
  );
  assert.equal(
    await page.evaluate(() => window.__game.scene.getScene('Match').flow.clock),
    clock
  );
  await page.evaluate(() => {
    const h = window.__game.scene.getScene('Hud');
    const play = h.helpLayer.list.find(
      (item) => item.x === 800 && item.y === 660
    );
    play.emit('pointerdown');
    play.emit('pointerup');
  });
  await waitForMatch(page);
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
    const { page, context, errors, mutations, gameRequests } = await pageFor(
      viewport,
      {
        matchType: 'daily',
        match: config,
      }
    );
    await page.goto(new URL('casual.html?debug', base).href);
    await page
      .getByRole('button', { name: 'START MATCH', exact: true })
      .waitFor();
    assert.equal(
      await page.getByRole('status', { name: 'Your formation' }).textContent(),
      '2-1-1'
    );
    await page
      .getByRole('button', { name: 'Previous your formation', exact: true })
      .click();
    for (let step = 0; step < 6; step++)
      await page
        .getByRole('button', { name: 'Next your colour', exact: true })
        .click();
    await page
      .getByRole('button', { name: 'Previous opponent colour', exact: true })
      .click();
    assert.equal(
      await page.getByRole('status', { name: 'Your colour' }).textContent(),
      'ORANGE'
    );
    assert.equal(
      await page.getByRole('status', { name: 'Opponent colour' }).textContent(),
      'TEAL'
    );
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
    assert.equal(await page.locator('.casual-pitch').count(), 0);
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
      '1-3',
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
    assert.equal(start.config.home.formation, '1-3');
    assert.equal(start.config.home.jersey, 'orange');
    assert.equal(start.config.away.jersey, 'teal');
    assert.equal(start.config.away.formation, '1-3');
    assert.equal(start.config.durationSec, 30);
    assert.equal(start.config.locked, false);
    assert.equal(start.clock, 30);
    assert.deepEqual(
      start.score,
      { home: 0, away: 0 },
      'does not inherit the challenge head start'
    );
    await finishBriefing(page); // dismiss the existing help overlay
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
    for (
      let wait = 0;
      wait < 40 &&
      gameRequests.filter((request) => request.path.endsWith('/complete'))
        .length < 3;
      wait++
    )
      await page.waitForTimeout(50);
    const starts = gameRequests.filter((request) =>
      request.path.endsWith('/start')
    );
    assert.equal(
      new Set(starts.map((request) => request.id)).size,
      4,
      'new receipt per match, including rematches'
    );
    assert.equal(
      gameRequests.filter((request) => request.path.endsWith('/complete'))
        .length,
      3,
      'abandoned match does not complete'
    );
    await page.goto(new URL('splash.html?debug', base).href);
    await page.waitForFunction(
      () => document.querySelector('.preview-games')?.textContent === '130'
    );
    await context.close();
    console.log(
      `ok Casual setup, persisted settings, help, match, results, rematch and exit (${viewport.width}px)`
    );
  }

  // Real keyboard strike -> launch snapshot -> goal -> personal record -> results.
  for (const type of ['daily', 'casual']) {
    const { page, context, errors, mutations } = await pageFor(
      { width: 390, height: 600 },
      { matchType: type, match: config }
    );
    await page.goto(
      new URL(
        type === 'casual' ? 'casual.html?debug' : 'index.html?debug',
        base
      ).href
    );
    if (type === 'casual')
      await page
        .getByRole('button', { name: 'START MATCH', exact: true })
        .click();
    await waitForMatch(page, true);
    await finishBriefing(page);
    await waitForMatch(page);
    await page.evaluate(() => {
      const scene = window.__game.scene.getScene('Match');
      scene.flow.phase = 'live';
      scene.flow.awaitingKickoff = false;
      scene.flow.clockRunning = true;
      for (const p of scene.everyone) {
        p.x = 400;
        p.y = 400;
        p.lockUntil = 99999;
      }
      const p = scene.home.find((p) => p.role !== 'keeper');
      p.x = 1800;
      p.y = 715;
      p.heading = 0;
      p.vx = p.vy = 0;
      p.speed = 0;
      p.lockUntil = 0;
      scene.setControlled(p);
      scene.ball.placeAt(1820, 715);
      scene.ball.owner = p;
      scene.ball.lastTouch = p;
      p.dribbleAngle = 0;
      p.dribbleDist = 20;
    });
    await page.keyboard.down('k');
    await page.waitForFunction(
      () => window.__game.scene.getScene('Match').chargeSince !== null
    );
    await page.waitForTimeout(350);
    await page.keyboard.up('k');
    await page.waitForFunction(
      () =>
        window.__game.scene.getScene('Match').ball.goalStrike?.team === 'home'
    );
    const speed = await page.evaluate(() => {
      const s = window.__game.scene.getScene('Match');
      const speed = s.ball.goalStrike.kmh;
      s.ball.x = 2658;
      s.ball.y = 715;
      s.ball.z = 20;
      s.ball.vx = 10;
      s.ball.vy = s.ball.vz = 0;
      s.ball.owner = null;
      return speed;
    });
    await page.waitForFunction(
      () => window.__game.scene.getScene('Match').flow.phase === 'goal'
    );
    const achievement = await page.evaluate(() => {
      const s = window.__game.scene.getScene('Match');
      return {
        fastest: s.fastestGoalKmh,
        detail: s.hudState.goalDetail,
        record: s.hudState.goalRecord,
      };
    });
    assert.equal(achievement.fastest, speed);
    assert.ok(achievement.detail.includes(`${speed} KM/H`));
    assert.equal(achievement.record, 'NEW DEVICE BEST!');
    if (process.env.CASUAL_SCREENSHOTS)
      await page.screenshot({
        path: `${process.env.CASUAL_SCREENSHOTS}/goal-${type}.png`,
      });
    await page.evaluate(
      () => (window.__game.scene.getScene('Match').flow.finished = true)
    );
    await page.locator('.results-speed-highlight').waitFor();
    assert.ok(
      (await page.locator('.results-speed-highlight').textContent()).includes(
        `${speed} KM/H`
      )
    );
    if (type === 'daily') {
      await page
        .getByRole('button', { name: 'FASTEST GOALS', exact: true })
        .click();
      await page
        .locator('.results-board')
        .getByText('131 km/h', { exact: true })
        .waitFor();
      await page
        .getByRole('button', { name: 'MATCH RESULTS', exact: true })
        .click();
      await page.locator('.results-board li').nth(2).waitFor();
      assert.deepEqual(mutations, ['/api/result']);
    } else {
      assert.equal(
        await page
          .getByRole('button', { name: 'FASTEST GOALS', exact: true })
          .count(),
        0
      );
      assert.deepEqual(mutations, []);
    }
    const geometry = await page.locator('.results-screen').evaluate((root) => ({
      scroll: root.scrollHeight - root.clientHeight,
      bottom: root.querySelector('.results-actions').getBoundingClientRect()
        .bottom,
      height: innerHeight,
    }));
    assert.ok(
      geometry.scroll <= 1 && geometry.bottom <= geometry.height,
      JSON.stringify(geometry)
    );
    if (process.env.CASUAL_SCREENSHOTS)
      await page.screenshot({
        path: `${process.env.CASUAL_SCREENSHOTS}/results-speed-${type}.png`,
      });
    assert.deepEqual(errors, []);
    await context.close();
    console.log(
      `ok ${type} launch-speed goal, device best, results highlight and ranking isolation`
    );
  }

  // Ranked results now use native buttons too. Check that moving the UI
  // preserves ranked saving, rematches and the explicit sharing decision.
  for (const type of ['daily', 'classic']) {
    const { page, context, errors, mutations } = await pageFor(
      { width: 390, height: 600 },
      { matchType: type, match: config }
    );
    await page.goto(new URL('index.html?debug', base).href);
    await waitForMatch(page, true);
    await finishBriefing(page);
    await waitForMatch(page);
    await page.evaluate(() => {
      window.__game.scene.getScene('Match').flow.finished = true;
    });
    await page
      .getByRole('button', { name: 'PLAY AGAIN', exact: true })
      .waitFor();
    await page.locator('.results-board li').nth(2).waitFor();
    assert.deepEqual(mutations, ['/api/result']);
    await page.getByRole('button', { name: 'PLAY AGAIN', exact: true }).click();
    await waitForMatch(page);
    const replay = await page.evaluate(
      () => window.__game.scene.getScene('Match').config
    );
    assert.equal(replay.durationSec, config.durationSec);
    assert.equal(replay.startGoalsAgainst, config.startGoalsAgainst);
    assert.equal(replay.locked, true);
    await page.evaluate(() => {
      window.__game.scene.getScene('Match').flow.finished = true;
    });
    await page
      .getByRole('button', { name: 'POST MY SCORE', exact: true })
      .waitFor();
    await page.locator('.results-board li').nth(2).waitFor();
    assert.deepEqual(mutations, ['/api/result', '/api/result']);
    if (type === 'classic') {
      await page.route('**/api/speed-leaders', (route) =>
        route.fulfill({ status: 503, json: { error: 'Unavailable' } })
      );
      await page
        .getByRole('button', { name: 'FASTEST GOALS', exact: true })
        .click();
      await page
        .getByText('SPEED BOARD UNAVAILABLE', { exact: true })
        .waitFor();
      await page
        .getByRole('button', { name: 'MATCH RESULTS', exact: true })
        .click();
      await page.locator('.results-board li').nth(2).waitFor();
    }

    await page
      .getByRole('button', { name: 'POST MY SCORE', exact: true })
      .click();
    await page.waitForFunction(() =>
      window.hostMessages.some((message) => message.showForm)
    );
    assert.equal(
      mutations.includes('/api/post-score'),
      false,
      'opening the form cannot post'
    );
    await page.evaluate(() => {
      const message = window.hostMessages.find((message) => message.showForm);
      window.postMessage(
        { type: 'devvit-message', data: { id: message.id } },
        '*'
      ); // cancel
    });
    await page.waitForTimeout(30);
    assert.equal(
      mutations.includes('/api/post-score'),
      false,
      'cancelled form cannot post'
    );
    await page
      .getByRole('button', { name: 'POST MY SCORE', exact: true })
      .click();
    await page.waitForFunction(
      () =>
        window.hostMessages.filter((message) => message.showForm).length === 2
    );
    if (type === 'classic') {
      await page
        .getByRole('button', { name: 'PLAY CUSTOM', exact: true })
        .click();
      await page
        .getByRole('button', { name: 'START MATCH', exact: true })
        .waitFor();
    }
    await page.evaluate(() => {
      const message = window.hostMessages
        .filter((message) => message.showForm)
        .at(-1);
      window.postMessage(
        {
          type: 'devvit-message',
          data: {
            id: message.id,
            formSubmitted: {
              results: {
                comment: { fieldType: 1, stringValue: '' }, // SDK paragraph field
                includeStats: { fieldType: 3, boolValue: true }, // SDK boolean field
              },
            },
          },
        },
        '*'
      );
    });
    if (type === 'daily') {
      await page
        .getByRole('button', { name: 'POSTED!', exact: true })
        .waitFor();
      assert.equal(
        mutations.filter((path) => path === '/api/post-score').length,
        1
      );
      await page
        .getByRole('button', { name: 'PLAY CUSTOM', exact: true })
        .click();
    } else {
      await page.waitForTimeout(50);
      assert.equal(
        mutations.includes('/api/post-score'),
        false,
        'late submission from an old results card is ignored'
      );
    }
    await page
      .getByRole('button', { name: 'START MATCH', exact: true })
      .waitFor();
    assert.equal(await page.locator('.results-screen').count(), 0);
    await page
      .getByRole('button', { name: 'START MATCH', exact: true })
      .click();
    await waitForMatch(page, true);
    const casual = await page.evaluate(
      () => window.__game.scene.getScene('Match').config
    );
    assert.equal(casual.mode, 'casual');
    assert.equal(casual.startGoalsAgainst, 0);
    assert.equal(mutations.filter((path) => path === '/api/result').length, 2);
    assert.deepEqual(errors, []);
    await context.close();
    console.log(
      `ok ${type} responsive results: ranked rematch, consent-based sharing and Casual transition`
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
      const { page, context, errors, mutations, gameRequests } = await pageFor(
        viewport,
        postData
      );
      await page.goto(new URL('splash.html?debug', base).href);
      if (viewport.width < 700)
        await page.locator('#mobile-lobby.is-portrait').waitFor();
      else
        await page.waitForFunction(() => window.__game?.scene.isActive('Menu'));
      if (type !== 'casual') {
        await page.getByRole('button', { name: 'ALL >', exact: true }).click();
        await page
          .getByRole('button', { name: 'FASTEST GOALS', exact: true })
          .click();
        await page
          .locator('.mobile-board-rows')
          .getByText('131 km/h', { exact: true })
          .waitFor();
        await page
          .getByRole('button', { name: 'MATCH RESULTS', exact: true })
          .click();
        await page.locator('.mobile-board-rows li').nth(2).waitFor();
        await page
          .getByRole('button', { name: 'Close leaderboard', exact: true })
          .click();
      }
      const label =
        type === 'casual'
          ? 'PLAY CUSTOM'
          : type === 'classic'
            ? 'PLAY CLASSIC'
            : 'PLAY CHALLENGE';
      await page.getByRole('button', { name: label, exact: true }).click();
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
        await page
          .getByRole('button', { name: 'PLAY CUSTOM', exact: true })
          .click();
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
      assert.deepEqual(
        gameRequests,
        [],
        'AI preview never registers or completes a game'
      );
      assert.equal(await page.locator('.preview-games').textContent(), '127');
      assert.equal(
        await page.evaluate(() => {
          const stage = document
            .querySelector('.preview-stage')
            .getBoundingClientRect();
          const panel = document
            .querySelector('.mobile-lobby-details')
            .getBoundingClientRect();
          return (
            stage.top === 0 &&
            stage.left === 0 &&
            stage.width === innerWidth &&
            stage.height === innerHeight &&
            panel.width === stage.width &&
            panel.top > stage.top &&
            panel.bottom <= stage.bottom
          );
        }),
        true,
        'controls overlay the full-card preview'
      );
      if (process.env.CASUAL_SCREENSHOTS) {
        await page.waitForFunction(
          () => window.__game.scene.getScene('Match').ready
        );
        await page.screenshot({
          path: `${process.env.CASUAL_SCREENSHOTS}/preview-${type}-${viewport.width}.png`,
        });
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

  for (const viewport of [
    { width: 320, height: 480 },
    { width: 390, height: 600 },
    { width: 360, height: 640 },
    { width: 844, height: 390 },
    { width: 640, height: 320 },
  ]) {
    const { page, context, errors } = await pageFor(viewport);
    await page.goto(new URL('casual.html?debug', base).href);
    await page
      .getByRole('button', { name: 'START MATCH', exact: true })
      .waitFor();
    const layout = await page.evaluate(() => {
      const root = document.querySelector('.casual-screen');
      const panel = document
        .querySelector('.casual-panel')
        .getBoundingClientRect();
      const buttons = [...root.querySelectorAll('button')].map((button) => {
        const rect = button.getBoundingClientRect();
        return (
          rect.top >= 0 &&
          rect.bottom <= innerHeight &&
          rect.left >= 0 &&
          rect.right <= innerWidth &&
          rect.height >= 44
        );
      });
      return {
        scroll: root.scrollHeight > root.clientHeight + 1,
        fits: panel.bottom <= innerHeight && panel.top >= 0,
        buttons: buttons.every(Boolean),
      };
    });
    assert.deepEqual(
      layout,
      { scroll: false, fits: true, buttons: true },
      `${viewport.width}x${viewport.height}: every control fits without scrolling`
    );
    await page
      .getByRole('button', { name: 'Next match time', exact: true })
      .click();
    if (process.env.CASUAL_SCREENSHOTS)
      await page.screenshot({
        path: `${process.env.CASUAL_SCREENSHOTS}/setup-${viewport.width}x${viewport.height}.png`,
      });
    if (viewport.width === 320) {
      await page.evaluate(() => {
        document.querySelector('.casual-screen').style.padding =
          '40px 12px 34px';
        dispatchEvent(new Event('resize'));
      });
      assert.equal(
        await page.evaluate(() => {
          const root = document.querySelector('.casual-screen');
          return root.scrollHeight > root.clientHeight;
        }),
        false,
        'safe-area padding must not introduce scrolling'
      );
      await page.setViewportSize({ width: 640, height: 320 });
      assert.equal(
        await page.evaluate(() => {
          const root = document.querySelector('.casual-screen');
          return root.scrollHeight > root.clientHeight;
        }),
        false,
        'rotation must refit the setup'
      );
    }
    assert.deepEqual(errors, []);
    await context.close();
    console.log(
      `ok no-scroll setup and visible touch controls (${viewport.width}x${viewport.height})`
    );
  }

  for (const viewport of [
    { width: 320, height: 480 },
    { width: 390, height: 600 },
  ]) {
    for (const type of ['daily', 'casual']) {
      const { page, context, errors, gameRequests } = await pageFor(viewport, {
        matchType: type,
        match: config,
      });
      await page.goto(new URL('splash.html?debug', base).href);
      await page.waitForFunction(
        () => document.querySelector('.preview-games')?.textContent === '127'
      );
      const fits = await page.evaluate(() => {
        const root = document.querySelector('#mobile-lobby');
        const stage = document
          .querySelector('.preview-stage')
          .getBoundingClientRect();
        const panel = document
          .querySelector('.mobile-lobby-details')
          .getBoundingClientRect();
        const buttons = [
          ...document.querySelectorAll('.preview-actions button'),
        ].filter((button) => !button.hidden);
        return (
          root.scrollHeight <= root.clientHeight + 1 &&
          panel.bottom <= innerHeight &&
          stage.height >= 100 &&
          buttons.every(
            (button) => button.getBoundingClientRect().bottom <= innerHeight
          )
        );
      });
      assert.equal(
        fits,
        true,
        `${type} card fits ${viewport.width}x${viewport.height}`
      );
      assert.deepEqual(gameRequests, []);
      assert.deepEqual(errors, []);
      if (process.env.CASUAL_SCREENSHOTS) {
        await page.waitForFunction(
          () => window.__game.scene.getScene('Match').ready
        );
        await page.screenshot({
          path: `${process.env.CASUAL_SCREENSHOTS}/preview-${type}-${viewport.width}x${viewport.height}.png`,
        });
      }
      await context.close();
    }
  }
  {
    const { page, context, errors } = await pageFor(
      { width: 390, height: 600 },
      { matchType: 'casual', match: config }
    );
    await page.route('**/api/games', (route) =>
      route.fulfill({ status: 503, json: { error: 'unavailable' } })
    );
    await page.goto(new URL('splash.html?debug', base).href);
    await page
      .getByRole('button', { name: 'PLAY CUSTOM', exact: true })
      .waitFor();
    assert.equal(
      await page.locator('.preview-games').textContent(),
      '—',
      'an unavailable count must not pretend to be zero'
    );
    await page
      .getByRole('button', { name: 'PLAY CUSTOM', exact: true })
      .click();
    await page.waitForFunction(() =>
      window.hostMessages.some((message) => message.immersiveMode?.entryUrl)
    );
    assert.deepEqual(errors, []);
    await context.close();
    console.log(
      'ok compact preview cards, no preview counting, and unavailable counter fallback'
    );
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
} catch (error) {
  for (const context of browser.contexts())
    for (const page of context.pages()) {
      console.error(
        'Browser failure state:',
        await page
          .evaluate(() => {
            const game = window.__game;
            const match = game?.scene.getScene('Match');
            return {
              scenes: game?.scene.getScenes(true).map((s) => s.scene.key),
              phase: match?.flow?.phase,
              clock: match?.flow?.clock,
              owner: match?.ball?.owner?.role,
              shots: match?.stats?.shots,
              finished: match?.flow?.finished,
              paused: game?.scene.isPaused('Match'),
              results: document.querySelector('.results-screen')?.textContent,
            };
          })
          .catch(() => 'Page unavailable')
      );
    }
  throw error;
} finally {
  await browser.close();
}
